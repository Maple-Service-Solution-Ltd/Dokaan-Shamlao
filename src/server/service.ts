/**
 * Authoritative game backend service.
 * Uses PostgreSQL via Prisma as primary storage, with an automatic in-memory fallback
 * if a local developer runs `next dev` without starting PostgreSQL first.
 */
import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import {
  dailySeedForDate,
  dhakaDateString,
  dhakaWeekKey,
  generateAccountCode,
  hashToken,
  recentDhakaDates,
  sanitizeDisplayName,
  sanitizeDistrict,
} from './auth';
import { replay } from '@/core/replay';
import { hashString } from '@/core/rng';
import type { ActionTuple, GameConfig, Lang, RunResult } from '@/core/types';
import { boardFor, configFor, dailyConfig, friendConfig, type RunDescriptor } from '@/content/modes';
import {
  ACHIEVEMENTS,
  EMPTY_LIFETIME_STATS,
  evaluateAchievements,
  mergeRunIntoLifetime,
  type AchievementStatus,
  type LifetimeStats,
} from '@/content/achievements';
import {
  AVATARS,
  CUSTOMIZATION_MAP,
  DEFAULT_EQUIPPED,
  levelFromXp,
  shopTitleForLevel,
  type CustomizationCategory,
} from '@/content/customization';

export interface PlayerStateDTO {
  playerId: string;
  accountCode: string;
  profile: {
    displayName: string;
    avatar: string;
    district: string | null;
    lang: Lang;
    musicOn: boolean;
    sfxOn: boolean;
  };
  progress: {
    coins: number;
    xp: number;
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
    title: { bn: string; en: string };
    highestLevel: number;
    storyStars: Record<string, number>;
    bestScores: Record<string, number>;
    unlockedItems: string[];
    equippedItems: Record<CustomizationCategory, string>;
    lifetimeStats: LifetimeStats;
    tutorialsSeen: string[];
  };
  achievements: AchievementStatus[];
}

const DEFAULT_UNLOCKED = [
  'sign_default',
  'shelf_wood',
  'decor_bulb',
  'outfit_apron',
  'counter_wood',
  'env_para',
];

// ─────────────── Fallback in-memory store when DB is unreachable ───────────────
interface MemPlayer {
  id: string;
  tokenHash: string;
  accountCode: string;
  displayName: string;
  avatar: string;
  district: string | null;
  lang: Lang;
  musicOn: boolean;
  sfxOn: boolean;
  coins: number;
  xp: number;
  highestLevel: number;
  storyStars: Record<string, number>;
  bestScores: Record<string, number>;
  unlockedItems: string[];
  equippedItems: Record<CustomizationCategory, string>;
  lifetimeStats: LifetimeStats;
  tutorialsSeen: string[];
  achievements: Record<string, { progress: number; unlocked: boolean; unlockedAt?: string }>;
  rewardSources: Set<string>;
}

interface MemSession {
  id: string;
  playerId: string;
  mode: string;
  configId: string;
  seed: number;
  descriptor: RunDescriptor;
  status: 'active' | 'completed';
  startedAt: Date;
  completedAt?: Date;
}

interface MemScore {
  id: string;
  sessionId: string;
  playerId: string;
  board: string;
  weekKey: string;
  score: number;
  stars: number;
  ticks: number;
  district: string | null;
  createdAt: Date;
}

interface MemFriend {
  code: string;
  creatorId: string;
  creatorName: string;
  creatorScore: number;
  seed: number;
  config: GameConfig;
  expiresAt: Date;
  createdAt: Date;
}

const mem = {
  playersByHash: new Map<string, MemPlayer>(),
  playersById: new Map<string, MemPlayer>(),
  sessions: new Map<string, MemSession>(),
  scores: [] as MemScore[],
  friends: new Map<string, MemFriend>(),
  analytics: [] as { id: string; playerId?: string; sessionId?: string; name: string; props: Record<string, unknown>; createdAt: Date }[],
};

let dbAvailable: boolean | null = null;
let lastDbCheck = 0;

async function useDb(): Promise<boolean> {
  if (process.env.FORCE_MEM_STORE === '1') return false;
  const now = Date.now();
  if (dbAvailable !== null && now - lastDbCheck < 10_000) return dbAvailable;
  lastDbCheck = now;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  return dbAvailable;
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (val && typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function buildPlayerDTO(
  id: string,
  accountCode: string,
  profile: { displayName: string; avatar: string; district: string | null; lang: string; musicOn: boolean; sfxOn: boolean },
  progress: {
    coins: number;
    xp: number;
    highestLevel: number;
    storyStars: Record<string, number>;
    bestScores: Record<string, number>;
    unlockedItems: string[];
    equippedItems: Record<CustomizationCategory, string>;
    lifetimeStats: LifetimeStats;
    tutorialsSeen: string[];
  },
  unlockedAchIds: string[],
): PlayerStateDTO {
  const xpInfo = levelFromXp(progress.xp);
  const completedCount = Object.values(progress.storyStars).filter((s) => s >= 1).length;
  const title = shopTitleForLevel(xpInfo.level, completedCount);
  const { statuses } = evaluateAchievements(
    { lifetime: progress.lifetimeStats, storyStars: progress.storyStars },
    unlockedAchIds,
  );
  return {
    playerId: id,
    accountCode,
    profile: {
      displayName: profile.displayName,
      avatar: profile.avatar,
      district: profile.district,
      lang: (profile.lang === 'en' ? 'en' : 'bn') as Lang,
      musicOn: profile.musicOn,
      sfxOn: profile.sfxOn,
    },
    progress: {
      coins: progress.coins,
      xp: progress.xp,
      level: xpInfo.level,
      currentLevelXp: xpInfo.currentLevelXp,
      nextLevelXp: xpInfo.nextLevelXp,
      title,
      highestLevel: progress.highestLevel,
      storyStars: progress.storyStars,
      bestScores: progress.bestScores,
      unlockedItems: progress.unlockedItems,
      equippedItems: { ...DEFAULT_EQUIPPED, ...progress.equippedItems },
      lifetimeStats: { ...EMPTY_LIFETIME_STATS, ...progress.lifetimeStats },
      tutorialsSeen: progress.tutorialsSeen,
    },
    achievements: statuses,
  };
}

export async function getOrCreatePlayer(rawToken: string): Promise<PlayerStateDTO> {
  const tokenHash = hashToken(rawToken);
  if (await useDb()) {
    let player = await prisma.player.findUnique({
      where: { tokenHash },
      include: { profile: true, progress: true, achievements: true },
    });
    if (!player) {
      const accountCode = generateAccountCode(tokenHash);
      player = await prisma.player.create({
        data: {
          tokenHash,
          accountCode,
          profile: { create: {} },
          progress: {
            create: {
              coins: 100,
              xp: 0,
              highestLevel: 1,
              storyStars: {},
              bestScores: {},
              unlockedItems: DEFAULT_UNLOCKED,
              equippedItems: DEFAULT_EQUIPPED,
              lifetimeStats: EMPTY_LIFETIME_STATS as unknown as Prisma.InputJsonValue,
              tutorialsSeen: [],
            },
          },
        },
        include: { profile: true, progress: true, achievements: true },
      });
    } else {
      await prisma.player.update({
        where: { id: player.id },
        data: { lastSeenAt: new Date() },
      });
    }
    const prof = player.profile!;
    const prog = player.progress!;
    const storyStars = parseJson<Record<string, number>>(prog.storyStars, {});
    const bestScores = parseJson<Record<string, number>>(prog.bestScores, {});
    const unlockedItems = parseJson<string[]>(prog.unlockedItems, DEFAULT_UNLOCKED);
    const equippedItems = parseJson<Record<CustomizationCategory, string>>(prog.equippedItems, DEFAULT_EQUIPPED);
    const lifetimeStats = { ...EMPTY_LIFETIME_STATS, ...parseJson<Partial<LifetimeStats>>(prog.lifetimeStats, {}) };
    const tutorialsSeen = parseJson<string[]>(prog.tutorialsSeen, []);
    const unlockedAchIds = player.achievements.filter((a) => a.unlocked).map((a) => a.achievementId);

    return buildPlayerDTO(
      player.id,
      player.accountCode,
      prof,
      {
        coins: prog.coins,
        xp: prog.xp,
        highestLevel: prog.highestLevel,
        storyStars,
        bestScores,
        unlockedItems,
        equippedItems,
        lifetimeStats,
        tutorialsSeen,
      },
      unlockedAchIds,
    );
  }

  // Fallback memory path
  let mp = mem.playersByHash.get(tokenHash);
  if (!mp) {
    const id = `plr_${tokenHash.slice(0, 12)}`;
    mp = {
      id,
      tokenHash,
      accountCode: generateAccountCode(tokenHash),
      displayName: 'দোকানদার',
      avatar: 'shopkeeper',
      district: null,
      lang: 'bn',
      musicOn: true,
      sfxOn: true,
      coins: 100,
      xp: 0,
      highestLevel: 1,
      storyStars: {},
      bestScores: {},
      unlockedItems: [...DEFAULT_UNLOCKED],
      equippedItems: { ...DEFAULT_EQUIPPED },
      lifetimeStats: { ...EMPTY_LIFETIME_STATS, bossesDefeated: [] },
      tutorialsSeen: [],
      achievements: {},
      rewardSources: new Set<string>(),
    };
    mem.playersByHash.set(tokenHash, mp);
    mem.playersById.set(id, mp);
  }
  const unlockedAchIds = Object.entries(mp.achievements)
    .filter(([, v]) => v.unlocked)
    .map(([k]) => k);
  return buildPlayerDTO(mp.id, mp.accountCode, mp, mp, unlockedAchIds);
}

export interface ProfileUpdateInput {
  displayName?: string;
  avatar?: string;
  district?: string | null;
  lang?: Lang;
  musicOn?: boolean;
  sfxOn?: boolean;
  tutorialsSeen?: string[];
}

export async function updatePlayerProfile(rawToken: string, input: ProfileUpdateInput): Promise<PlayerStateDTO> {
  const current = await getOrCreatePlayer(rawToken);
  const displayName = input.displayName !== undefined ? sanitizeDisplayName(input.displayName) : current.profile.displayName;
  const avatar = input.avatar && AVATARS.some((a) => a.id === input.avatar) ? input.avatar : current.profile.avatar;
  const district = input.district !== undefined ? sanitizeDistrict(input.district) : current.profile.district;
  const lang: Lang = input.lang === 'en' || input.lang === 'bn' ? input.lang : current.profile.lang;
  const musicOn = typeof input.musicOn === 'boolean' ? input.musicOn : current.profile.musicOn;
  const sfxOn = typeof input.sfxOn === 'boolean' ? input.sfxOn : current.profile.sfxOn;
  const tutorialsSeen = input.tutorialsSeen
    ? Array.from(new Set([...current.progress.tutorialsSeen, ...input.tutorialsSeen.slice(0, 120)]))
    : current.progress.tutorialsSeen;

  if (await useDb()) {
    await prisma.playerProfile.update({
      where: { playerId: current.playerId },
      data: { displayName, avatar, district, lang, musicOn, sfxOn },
    });
    if (input.tutorialsSeen) {
      await prisma.playerProgress.update({
        where: { playerId: current.playerId },
        data: { tutorialsSeen },
      });
    }
    return getOrCreatePlayer(rawToken);
  }

  const mp = mem.playersById.get(current.playerId)!;
  mp.displayName = displayName;
  mp.avatar = avatar;
  mp.district = district;
  mp.lang = lang;
  mp.musicOn = musicOn;
  mp.sfxOn = sfxOn;
  mp.tutorialsSeen = tutorialsSeen;
  return getOrCreatePlayer(rawToken);
}

export interface SessionStartResult {
  sessionId: string;
  seed: number;
  config: GameConfig;
  descriptor: RunDescriptor;
}

export async function startGameSession(
  rawToken: string,
  req: {
    mode: 'story' | 'endless' | 'time' | 'survival' | 'daily' | 'friend';
    level?: number;
    secs?: 60 | 120;
    date?: string;
    code?: string;
    seed?: number;
  },
): Promise<SessionStartResult> {
  const player = await getOrCreatePlayer(rawToken);
  let descriptor: RunDescriptor;

  switch (req.mode) {
    case 'story': {
      const level = Math.max(1, Math.min(100, Math.floor(req.level ?? 1)));
      descriptor = { mode: 'story', level };
      break;
    }
    case 'endless': {
      const seed = (req.seed && Number.isInteger(req.seed) ? req.seed : hashString(`${player.playerId}:${Date.now()}:endless`)) & 0x7fffffff;
      descriptor = { mode: 'endless', seed };
      break;
    }
    case 'time': {
      const secs = req.secs === 120 ? 120 : 60;
      const seed = (req.seed && Number.isInteger(req.seed) ? req.seed : hashString(`${player.playerId}:${Date.now()}:time:${secs}`)) & 0x7fffffff;
      descriptor = { mode: 'time', seed, secs };
      break;
    }
    case 'survival': {
      const seed = (req.seed && Number.isInteger(req.seed) ? req.seed : hashString(`${player.playerId}:${Date.now()}:survival`)) & 0x7fffffff;
      descriptor = { mode: 'survival', seed };
      break;
    }
    case 'daily': {
      const date = req.date && /^\d{4}-\d{2}-\d{2}$/.test(req.date) ? req.date : dhakaDateString();
      const seed = dailySeedForDate(date);
      descriptor = { mode: 'daily', date, seed };
      break;
    }
    case 'friend': {
      const code = (req.code || 'FRIEND').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'FRIEND';
      const friendChallenge = await getFriendChallenge(code);
      const seed = friendChallenge ? friendChallenge.seed : hashString(`friend:${code}`) & 0x7fffffff;
      descriptor = { mode: 'friend', code, seed };
      break;
    }
  }

  const config = configFor(descriptor);

  if (await useDb()) {
    const sess = await prisma.gameSession.create({
      data: {
        playerId: player.playerId,
        mode: config.mode,
        configId: config.id,
        seed: config.seed | 0,
        descriptor: descriptor as unknown as Prisma.InputJsonValue,
        status: 'active',
      },
    });
    return { sessionId: sess.id, seed: config.seed, config, descriptor };
  }

  const sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;
  mem.sessions.set(sessionId, {
    id: sessionId,
    playerId: player.playerId,
    mode: config.mode,
    configId: config.id,
    seed: config.seed,
    descriptor,
    status: 'active',
    startedAt: new Date(),
  });
  return { sessionId, seed: config.seed, config, descriptor };
}

export interface SubmitSessionInput {
  sessionId: string;
  descriptor?: RunDescriptor;
  log: ActionTuple[];
  endTick: number;
  quit: boolean;
}

export interface SubmitSessionResponse {
  ok: boolean;
  error?: string;
  result?: RunResult;
  rewardsGranted?: {
    coins: number;
    xp: number;
    firstTimeStarBonus: number;
    achievementsUnlocked: { id: string; name: { bn: string; en: string }; icon: string; coins: number; xp: number }[];
  };
  player?: PlayerStateDTO;
  leaderboardRank?: number | null;
}

export async function submitGameSession(rawToken: string, input: SubmitSessionInput): Promise<SubmitSessionResponse> {
  const player = await getOrCreatePlayer(rawToken);
  const usingDb = await useDb();

  let descriptor: RunDescriptor | null = null;
  let sessionStatus = 'active';

  if (usingDb) {
    const sess = await prisma.gameSession.findUnique({ where: { id: input.sessionId } });
    if (!sess || sess.playerId !== player.playerId) {
      return { ok: false, error: 'invalid_session' };
    }
    sessionStatus = sess.status;
    descriptor = parseJson<RunDescriptor | null>(sess.descriptor, null);
  } else {
    const sess = mem.sessions.get(input.sessionId);
    if (!sess) {
      if (!input.descriptor) return { ok: false, error: 'invalid_session' };
      descriptor = input.descriptor;
    } else {
      if (sess.playerId !== player.playerId) return { ok: false, error: 'invalid_session' };
      sessionStatus = sess.status;
      descriptor = sess.descriptor;
    }
  }

  if (sessionStatus === 'completed') {
    return { ok: false, error: 'duplicate_submission' };
  }
  if (!descriptor) {
    return { ok: false, error: 'missing_descriptor' };
  }

  // Reconstruct authoritative config from server descriptor
  const cfg = configFor(descriptor);

  // Server-side deterministic replay & anti-cheat check
  const outcome = replay(cfg, input.log, input.endTick, input.quit);
  if (!outcome.ok || !outcome.result) {
    return { ok: false, error: outcome.error || 'replay_failed' };
  }
  if (outcome.peakActionsPerSec > 35) {
    return { ok: false, error: 'impossible_action_rate' };
  }

  const res = outcome.result;
  const storyStars = { ...player.progress.storyStars };
  const bestScores = { ...player.progress.bestScores };
  let highestLevel = player.progress.highestLevel;

  let baseCoins = 0;
  let baseXp = 0;
  let firstTimeStarBonus = 0;

  if (res.won) {
    baseCoins = cfg.rewards.coins || Math.max(15, Math.floor(res.score / 120));
    baseXp = cfg.rewards.xp || Math.max(20, Math.floor(res.score / 100));
  } else {
    // Small consolation XP/coins for genuine effort if they served at least 2 customers
    if (res.stats.served >= 2) {
      baseCoins = 5;
      baseXp = 10;
    }
  }

  if (descriptor.mode === 'story' && res.won) {
    const lvlKey = String(descriptor.level);
    const prevStars = storyStars[lvlKey] ?? 0;
    if (res.stars > prevStars) {
      firstTimeStarBonus = (res.stars - prevStars) * 15;
      storyStars[lvlKey] = res.stars;
    }
    if (descriptor.level >= highestLevel && descriptor.level < 100) {
      highestLevel = descriptor.level + 1;
    }
  }

  const prevBest = bestScores[cfg.id] ?? 0;
  if (res.score > prevBest) {
    bestScores[cfg.id] = res.score;
  }

  const updatedLifetime = mergeRunIntoLifetime(player.progress.lifetimeStats, cfg, res);
  const alreadyUnlocked = player.achievements.filter((a) => a.unlocked).map((a) => a.id);
  const achEval = evaluateAchievements({ lifetime: updatedLifetime, storyStars }, alreadyUnlocked);

  let achCoins = 0;
  let achXp = 0;
  for (const a of achEval.newlyUnlocked) {
    achCoins += a.reward.coins;
    achXp += a.reward.xp;
  }

  const totalCoinsGranted = baseCoins + firstTimeStarBonus + achCoins;
  const totalXpGranted = baseXp + achXp;
  const newCoins = player.progress.coins + totalCoinsGranted;
  const newXp = player.progress.xp + totalXpGranted;
  const board = boardFor(descriptor);
  const weekKey = dhakaWeekKey();
  let leaderboardRank: number | null = null;

  if (usingDb) {
    const sourceKey = `session:${input.sessionId}`;
    const existingReward = await prisma.playerReward.findUnique({
      where: { playerId_sourceKey: { playerId: player.playerId, sourceKey } },
    });
    if (existingReward) {
      return { ok: false, error: 'duplicate_submission' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.gameSession.update({
        where: { id: input.sessionId },
        data: { status: 'completed', completedAt: new Date() },
      });

      await tx.sessionAction.create({
        data: {
          sessionId: input.sessionId,
          actionCount: input.log.length,
          endTick: input.endTick,
          quit: input.quit,
          peakActionsPerSec: outcome.peakActionsPerSec,
          log: input.log as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.challengeRun.create({
        data: {
          sessionId: input.sessionId,
          playerId: player.playerId,
          mode: cfg.mode,
          configId: cfg.id,
          challengeIds: cfg.challenges,
          won: res.won,
          reason: res.reason,
          score: res.score,
          stars: res.stars,
          ticks: res.ticks,
          accuracy: res.accuracy,
          satisfaction: res.satisfaction,
          profit: res.profit,
          stats: res.stats as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.playerReward.create({
        data: {
          playerId: player.playerId,
          sourceKey,
          coins: totalCoinsGranted,
          xp: totalXpGranted,
        },
      });

      await tx.playerProgress.update({
        where: { playerId: player.playerId },
        data: {
          coins: newCoins,
          xp: newXp,
          highestLevel,
          storyStars: storyStars as unknown as Prisma.InputJsonValue,
          bestScores: bestScores as unknown as Prisma.InputJsonValue,
          lifetimeStats: updatedLifetime as unknown as Prisma.InputJsonValue,
        },
      });

      for (const status of achEval.statuses) {
        if (status.progress > 0 || status.unlocked) {
          await tx.achievement.upsert({
            where: { id: status.id },
            update: {},
            create: {
              id: status.id,
              nameBn: ACHIEVEMENTS.find((x) => x.id === status.id)!.name.bn,
              nameEn: ACHIEVEMENTS.find((x) => x.id === status.id)!.name.en,
              descriptionBn: ACHIEVEMENTS.find((x) => x.id === status.id)!.description.bn,
              descriptionEn: ACHIEVEMENTS.find((x) => x.id === status.id)!.description.en,
              icon: ACHIEVEMENTS.find((x) => x.id === status.id)!.icon,
              target: status.target,
              rewardCoins: ACHIEVEMENTS.find((x) => x.id === status.id)!.reward.coins,
              rewardXp: ACHIEVEMENTS.find((x) => x.id === status.id)!.reward.xp,
            },
          });
          await tx.playerAchievement.upsert({
            where: { playerId_achievementId: { playerId: player.playerId, achievementId: status.id } },
            update: {
              progress: status.progress,
              unlocked: status.unlocked,
              ...(status.newlyUnlocked ? { unlockedAt: new Date() } : {}),
            },
            create: {
              playerId: player.playerId,
              achievementId: status.id,
              progress: status.progress,
              unlocked: status.unlocked,
              unlockedAt: status.unlocked ? new Date() : null,
            },
          });
        }
      }

      if (board && res.score > 0 && res.reason !== 'quit') {
        await tx.score.create({
          data: {
            sessionId: input.sessionId,
            playerId: player.playerId,
            board,
            weekKey,
            score: res.score,
            stars: res.stars,
            ticks: res.ticks,
            district: player.profile.district,
          },
        });
      }
    });

    if (board && res.score > 0 && res.reason !== 'quit') {
      const higherCount = await prisma.score.count({
        where: { board, score: { gt: res.score } },
      });
      leaderboardRank = higherCount + 1;
    }
  } else {
    const mp = mem.playersById.get(player.playerId)!;
    const sourceKey = `session:${input.sessionId}`;
    if (mp.rewardSources.has(sourceKey)) {
      return { ok: false, error: 'duplicate_submission' };
    }
    mp.rewardSources.add(sourceKey);
    const sess = mem.sessions.get(input.sessionId);
    if (sess) {
      sess.status = 'completed';
      sess.completedAt = new Date();
    }
    mp.coins = newCoins;
    mp.xp = newXp;
    mp.highestLevel = highestLevel;
    mp.storyStars = storyStars;
    mp.bestScores = bestScores;
    mp.lifetimeStats = updatedLifetime;
    for (const st of achEval.statuses) {
      mp.achievements[st.id] = {
        progress: st.progress,
        unlocked: st.unlocked,
        unlockedAt: st.newlyUnlocked ? new Date().toISOString() : mp.achievements[st.id]?.unlockedAt,
      };
    }
    if (board && res.score > 0 && res.reason !== 'quit') {
      mem.scores.push({
        id: `scr_${crypto.randomBytes(6).toString('hex')}`,
        sessionId: input.sessionId,
        playerId: player.playerId,
        board,
        weekKey,
        score: res.score,
        stars: res.stars,
        ticks: res.ticks,
        district: player.profile.district,
        createdAt: new Date(),
      });
      const higher = mem.scores.filter((s) => s.board === board && s.score > res.score).length;
      leaderboardRank = higher + 1;
    }
  }

  const updatedPlayer = await getOrCreatePlayer(rawToken);
  return {
    ok: true,
    result: res,
    rewardsGranted: {
      coins: totalCoinsGranted,
      xp: totalXpGranted,
      firstTimeStarBonus,
      achievementsUnlocked: achEval.newlyUnlocked.map((a) => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        coins: a.reward.coins,
        xp: a.reward.xp,
      })),
    },
    player: updatedPlayer,
    leaderboardRank,
  };
}

export interface LeaderboardRowDTO {
  rank: number;
  playerId: string;
  displayName: string;
  avatar: string;
  district: string | null;
  score: number;
  stars: number;
  ticks: number;
  createdAt: string;
}

export async function getLeaderboard(params: {
  scope: 'daily' | 'weekly' | 'alltime' | 'friends';
  board?: string;
  date?: string;
  code?: string;
  district?: string | null;
  limit?: number;
}): Promise<{ board: string; entries: LeaderboardRowDTO[] }> {
  const limit = Math.max(1, Math.min(50, params.limit ?? 20));
  const today = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : dhakaDateString();
  const weekKey = dhakaWeekKey();

  let targetBoard = params.board || 'endless';
  if (params.scope === 'daily') {
    targetBoard = `daily:${today}`;
  } else if (params.scope === 'friends') {
    targetBoard = `friend:${(params.code || 'FRIEND').toUpperCase()}`;
  }

  const districtFilter = sanitizeDistrict(params.district);

  if (await useDb()) {
    const where: Prisma.ScoreWhereInput = {
      board: targetBoard,
      ...(params.scope === 'weekly' ? { weekKey } : {}),
      ...(districtFilter ? { district: districtFilter } : {}),
    };
    const rawScores = await prisma.score.findMany({
      where,
      orderBy: [{ score: 'desc' }, { ticks: 'asc' }, { createdAt: 'asc' }],
      take: limit * 3,
      include: { player: { include: { profile: true } } },
    });

    // Keep highest score per player on this board
    const bestByPlayer = new Map<string, (typeof rawScores)[number]>();
    for (const row of rawScores) {
      if (!bestByPlayer.has(row.playerId)) {
        bestByPlayer.set(row.playerId, row);
      }
      if (bestByPlayer.size >= limit) break;
    }

    const entries: LeaderboardRowDTO[] = Array.from(bestByPlayer.values()).map((r, i) => ({
      rank: i + 1,
      playerId: r.playerId,
      displayName: r.player.profile?.displayName ?? 'দোকানদার',
      avatar: r.player.profile?.avatar ?? 'shopkeeper',
      district: r.district,
      score: r.score,
      stars: r.stars,
      ticks: r.ticks,
      createdAt: r.createdAt.toISOString(),
    }));
    return { board: targetBoard, entries };
  }

  // Fallback memory leaderboard
  const filtered = mem.scores
    .filter((s) => {
      if (s.board !== targetBoard) return false;
      if (params.scope === 'weekly' && s.weekKey !== weekKey) return false;
      if (districtFilter && s.district !== districtFilter) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score || a.ticks - b.ticks || a.createdAt.getTime() - b.createdAt.getTime());

  const bestByPlayer = new Map<string, MemScore>();
  for (const s of filtered) {
    if (!bestByPlayer.has(s.playerId)) bestByPlayer.set(s.playerId, s);
    if (bestByPlayer.size >= limit) break;
  }

  const entries: LeaderboardRowDTO[] = Array.from(bestByPlayer.values()).map((r, i) => {
    const p = mem.playersById.get(r.playerId);
    return {
      rank: i + 1,
      playerId: r.playerId,
      displayName: p?.displayName ?? 'দোকানদার',
      avatar: p?.avatar ?? 'shopkeeper',
      district: r.district,
      score: r.score,
      stars: r.stars,
      ticks: r.ticks,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return { board: targetBoard, entries };
}

export async function getDailyChallengeInfo(rawToken: string, requestedDate?: string) {
  const player = await getOrCreatePlayer(rawToken);
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : dhakaDateString();
  const seed = dailySeedForDate(date);
  const config = dailyConfig(date, seed);

  if (await useDb()) {
    await prisma.dailyChallenge.upsert({
      where: { date },
      update: {},
      create: { date, seed, config: config as unknown as Prisma.InputJsonValue },
    });
  }

  const historyDates = recentDhakaDates(7, date);
  const history = historyDates.map((d) => {
    const s = dailySeedForDate(d);
    const c = dailyConfig(d, s);
    return {
      date: d,
      seed: s,
      title: c.title,
      difficulty: c.difficulty,
      challenges: c.challenges,
      bestScore: player.progress.bestScores[`daily:${d}`] ?? 0,
    };
  });

  const board = await getLeaderboard({ scope: 'daily', date, limit: 15 });

  return {
    date,
    timezone: 'Asia/Dhaka',
    seed,
    config,
    playerBestScore: player.progress.bestScores[`daily:${date}`] ?? 0,
    retryPolicy: {
      bn: 'প্রতিদিন যতবার ইচ্ছা খেলা যাবে; আপনার সেরা বৈধ স্কোরটি লিডারবোর্ডে থাকবে।',
      en: 'You may play multiple attempts; your highest validated score is ranked on the daily leaderboard.',
    },
    leaderboard: board.entries,
    history,
  };
}

export async function createFriendChallenge(
  rawToken: string,
  opts?: { creatorScore?: number },
): Promise<{
  code: string;
  seed: number;
  config: GameConfig;
  creatorName: string;
  creatorScore: number;
  expiresAt: string;
}> {
  const player = await getOrCreatePlayer(rawToken);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) code += chars[bytes[i]! % chars.length];

  const seed = hashString(`friend:${code}:${Date.now()}`) & 0x7fffffff;
  const config = friendConfig(code, seed);
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);
  const creatorScore = Math.max(0, Math.floor(opts?.creatorScore ?? 0));

  if (await useDb()) {
    await prisma.friendChallenge.create({
      data: {
        code,
        creatorId: player.playerId,
        creatorName: player.profile.displayName,
        creatorScore,
        seed,
        config: config as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  } else {
    mem.friends.set(code, {
      code,
      creatorId: player.playerId,
      creatorName: player.profile.displayName,
      creatorScore,
      seed,
      config,
      expiresAt,
      createdAt: new Date(),
    });
  }

  return {
    code,
    seed,
    config,
    creatorName: player.profile.displayName,
    creatorScore,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getFriendChallenge(codeRaw: string) {
  const code = codeRaw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!code) return null;

  if (await useDb()) {
    const fc = await prisma.friendChallenge.findUnique({ where: { code } });
    if (fc) {
      if (fc.expiresAt.getTime() < Date.now()) {
        return null;
      }
      const board = await getLeaderboard({ scope: 'friends', code, limit: 20 });
      return {
        code: fc.code,
        creatorName: fc.creatorName,
        creatorScore: fc.creatorScore,
        seed: fc.seed,
        config: parseJson<GameConfig>(fc.config, friendConfig(fc.code, fc.seed)),
        expiresAt: fc.expiresAt.toISOString(),
        leaderboard: board.entries,
      };
    }
  } else {
    const fc = mem.friends.get(code);
    if (fc && fc.expiresAt.getTime() >= Date.now()) {
      const board = await getLeaderboard({ scope: 'friends', code, limit: 20 });
      return {
        code: fc.code,
        creatorName: fc.creatorName,
        creatorScore: fc.creatorScore,
        seed: fc.seed,
        config: fc.config,
        expiresAt: fc.expiresAt.toISOString(),
        leaderboard: board.entries,
      };
    }
  }

  // Deterministic ad-hoc code fallback so shared codes always work
  const seed = hashString(`friend:${code}`) & 0x7fffffff;
  const config = friendConfig(code, seed);
  const board = await getLeaderboard({ scope: 'friends', code, limit: 20 });
  return {
    code,
    creatorName: 'বন্ধু',
    creatorScore: 0,
    seed,
    config,
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    leaderboard: board.entries,
  };
}

export async function customizeShop(
  rawToken: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string; player?: PlayerStateDTO }> {
  const item = CUSTOMIZATION_MAP[itemId];
  if (!item) return { ok: false, error: 'unknown_item' };

  const player = await getOrCreatePlayer(rawToken);
  const unlocked = new Set(player.progress.unlockedItems);
  const equipped = { ...player.progress.equippedItems };
  let coins = player.progress.coins;

  if (!unlocked.has(item.id)) {
    if (player.progress.highestLevel < item.unlockLevel) {
      return { ok: false, error: 'level_locked' };
    }
    if (coins < item.costCoins) {
      return { ok: false, error: 'insufficient_coins' };
    }
    coins -= item.costCoins;
    unlocked.add(item.id);
  }

  equipped[item.category] = item.id;
  const unlockedArr = Array.from(unlocked);

  if (await useDb()) {
    await prisma.playerProgress.update({
      where: { playerId: player.playerId },
      data: {
        coins,
        unlockedItems: unlockedArr,
        equippedItems: equipped as unknown as Prisma.InputJsonValue,
      },
    });
  } else {
    const mp = mem.playersById.get(player.playerId)!;
    mp.coins = coins;
    mp.unlockedItems = unlockedArr;
    mp.equippedItems = equipped;
  }

  return { ok: true, player: await getOrCreatePlayer(rawToken) };
}

export async function recordAnalyticsEvent(
  rawToken: string | null,
  name: string,
  props: Record<string, unknown> = {},
  sessionId?: string,
): Promise<void> {
  const safeName = name.replace(/[^a-z0-9_]/gi, '').slice(0, 64);
  if (!safeName) return;

  let playerId: string | undefined;
  if (rawToken) {
    try {
      const p = await getOrCreatePlayer(rawToken);
      playerId = p.playerId;
    } catch {
      playerId = undefined;
    }
  }

  if (await useDb()) {
    await prisma.analyticsEvent.create({
      data: {
        playerId: playerId ?? null,
        sessionId: sessionId ?? null,
        name: safeName,
        props: props as unknown as Prisma.InputJsonValue,
      },
    });
  } else {
    mem.analytics.push({
      id: `ev_${Date.now()}`,
      playerId,
      sessionId,
      name: safeName,
      props,
      createdAt: new Date(),
    });
  }
}
