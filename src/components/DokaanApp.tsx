'use client';

/**
 * Complete application shell for "দোকান সামলাও! — Dokaan Shamlao".
 * Implements Screen 1 (Home), Screen 2 (Mode Selection), Screen 3 (Level Selection),
 * Screen 4/5/6 (Gameplay / Pause / Results via GameView), Screen 7 (Leaderboard),
 * Screen 8 (Player Profile & Achievements), Screen 9 (Shop Customization), and Settings.
 */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { GameConfig, Lang, RunResult } from '@/core/types';
import { CHAPTERS, LEVEL_ROWS, BOSS_NAMES } from '@/content/levels';
import { CHALLENGE_MAP } from '@/content/challenges';
import { configFor, type RunDescriptor } from '@/content/modes';
import {
  ACHIEVEMENTS,
  EMPTY_LIFETIME_STATS,
  evaluateAchievements,
  mergeRunIntoLifetime,
} from '@/content/achievements';
import {
  AVATARS,
  CUSTOMIZATION_CATEGORIES,
  CUSTOMIZATION_ITEMS,
  DEFAULT_EQUIPPED,
  DISTRICTS,
  levelFromXp,
  shopTitleForLevel,
  type CustomizationCategory,
} from '@/content/customization';
import { digits, num, pick, taka } from '@/lib/i18n';
import { characterDataUrl, shopkeeperDataUrl } from '@/game/art/shop';
import { sound } from '@/game/audio';
import GameView from './GameView';
import type { LeaderboardRowDTO, PlayerStateDTO, SubmitSessionResponse } from '@/server/service';

type ScreenId = 'home' | 'modes' | 'levels' | 'play' | 'leaderboard' | 'profile' | 'customize' | 'daily' | 'friend';

const LOCAL_STORAGE_KEY = 'dokaan_player_backup_v1';
const TOKEN_STORAGE_KEY = 'dokaan_player_token_v1';

function createInitialPlayerState(): PlayerStateDTO {
  const { statuses } = evaluateAchievements({ lifetime: EMPTY_LIFETIME_STATS, storyStars: {} }, []);
  return {
    playerId: 'local_player',
    accountCode: 'HK-LOCAL-0001',
    profile: {
      displayName: 'দোকানদার',
      avatar: 'shopkeeper',
      district: null,
      lang: 'bn',
      musicOn: true,
      sfxOn: true,
    },
    progress: {
      coins: 100,
      xp: 0,
      level: 1,
      currentLevelXp: 0,
      nextLevelXp: 100,
      title: { bn: 'নতুন দোকানদার', en: 'New Shopkeeper' },
      highestLevel: 1,
      storyStars: {},
      bestScores: {},
      unlockedItems: ['sign_default', 'shelf_wood', 'decor_bulb', 'outfit_apron', 'counter_wood', 'env_para'],
      equippedItems: { ...DEFAULT_EQUIPPED },
      lifetimeStats: { ...EMPTY_LIFETIME_STATS },
      tutorialsSeen: [],
    },
    achievements: statuses,
  };
}

export default function DokaanApp(): React.ReactElement {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [player, setPlayer] = useState<PlayerStateDTO>(createInitialPlayerState);
  const [token, setToken] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [customTab, setCustomTab] = useState<CustomizationCategory>('sign');
  const [activeRun, setActiveRun] = useState<{
    sessionId: string;
    config: GameConfig;
    descriptor: RunDescriptor;
  } | null>(null);

  // Leaderboard state
  const [lbScope, setLbScope] = useState<'daily' | 'weekly' | 'alltime' | 'friends'>('daily');
  const [lbBoard, setLbBoard] = useState<'endless' | 'time60' | 'time120' | 'survival'>('endless');
  const [lbDistrict, setLbDistrict] = useState<string>('');
  const [lbFriendCode, setLbFriendCode] = useState<string>('FRIEND');
  const [lbEntries, setLbEntries] = useState<LeaderboardRowDTO[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // Daily challenge state
  const [dailyInfo, setDailyInfo] = useState<{
    date: string;
    seed: number;
    config: GameConfig;
    playerBestScore: number;
    retryPolicy: { bn: string; en: string };
    leaderboard: LeaderboardRowDTO[];
    history: { date: string; seed: number; title: { bn: string; en: string }; difficulty: number; challenges: string[]; bestScore: number }[];
  } | null>(null);

  // Friend challenge state
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [createdFriend, setCreatedFriend] = useState<{
    code: string;
    seed: number;
    config: GameConfig;
    creatorName: string;
    creatorScore: number;
  } | null>(null);

  // Settings & Profile edit state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [nameDraft, setNameDraft] = useState('দোকানদার');
  const [districtDraft, setDistrictDraft] = useState('');
  const [avatarDraft, setAvatarDraft] = useState('shopkeeper');
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  const lang: Lang = player.profile.lang;

  const saveLocalBackup = useCallback((state: PlayerStateDTO, tok?: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
      if (tok) localStorage.setItem(TOKEN_STORAGE_KEY, tok);
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const apiHeaders = useCallback(
    (tokOverride?: string): HeadersInit => {
      const t = tokOverride || token || (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) || '' : '');
      return {
        'Content-Type': 'application/json',
        ...(t ? { 'x-player-token': t } : {}),
      };
    },
    [token],
  );

  const trackEvent = useCallback(
    (name: string, props: Record<string, unknown> = {}, sessionId?: string) => {
      fetch('/api/v1/analytics', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ name, props, sessionId }),
      }).catch(() => undefined);
    },
    [apiHeaders],
  );

  // Bootstrap anonymous player on mount & merge any local backup
  useEffect(() => {
    let localBackup: PlayerStateDTO | null = null;
    let savedToken = '';
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) localBackup = JSON.parse(raw) as PlayerStateDTO;
      savedToken = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    } catch {
      localBackup = null;
    }
    if (localBackup) {
      setPlayer(localBackup);
      setNameDraft(localBackup.profile.displayName);
      setDistrictDraft(localBackup.profile.district || '');
      setAvatarDraft(localBackup.profile.avatar);
    }

    fetch('/api/v1/player', { headers: apiHeaders(savedToken) })
      .then((r) => r.json())
      .then((data: { ok?: boolean; token?: string; player?: PlayerStateDTO }) => {
        if (data.ok && data.player) {
          const srv = data.player;
          if (localBackup && localBackup.progress.highestLevel > srv.progress.highestLevel) {
            srv.progress.highestLevel = localBackup.progress.highestLevel;
            srv.progress.storyStars = { ...srv.progress.storyStars, ...localBackup.progress.storyStars };
            srv.progress.coins = Math.max(srv.progress.coins, localBackup.progress.coins);
            srv.progress.xp = Math.max(srv.progress.xp, localBackup.progress.xp);
          }
          setPlayer(srv);
          setNameDraft(srv.profile.displayName);
          setDistrictDraft(srv.profile.district || '');
          setAvatarDraft(srv.profile.avatar);
          sound.updateSettings({ musicOn: srv.profile.musicOn, sfxOn: srv.profile.sfxOn });
          if (data.token) setToken(data.token);
          saveLocalBackup(srv, data.token);
        }
      })
      .catch(() => undefined);

    // Check URL query param `?friend=CODE`
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const fCode = sp.get('friend');
      if (fCode) {
        setFriendCodeInput(fCode.toUpperCase());
        setScreen('friend');
      }
    }
  }, [apiHeaders, saveLocalBackup]);

  const updatePreferences = useCallback(
    async (patch: { lang?: Lang; musicOn?: boolean; sfxOn?: boolean; displayName?: string; avatar?: string; district?: string | null }) => {
      setPlayer((prev) => {
        const next: PlayerStateDTO = {
          ...prev,
          profile: {
            ...prev.profile,
            ...(patch.lang !== undefined ? { lang: patch.lang } : {}),
            ...(patch.musicOn !== undefined ? { musicOn: patch.musicOn } : {}),
            ...(patch.sfxOn !== undefined ? { sfxOn: patch.sfxOn } : {}),
            ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
            ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
            ...(patch.district !== undefined ? { district: patch.district } : {}),
          },
        };
        saveLocalBackup(next);
        return next;
      });
      if (patch.musicOn !== undefined || patch.sfxOn !== undefined) {
        sound.updateSettings({ musicOn: patch.musicOn, sfxOn: patch.sfxOn });
      }
      try {
        const res = await fetch('/api/v1/player', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as { ok?: boolean; player?: PlayerStateDTO };
        if (data.ok && data.player) {
          setPlayer((prev) => {
            const merged = {
              ...data.player!,
              progress: {
                ...data.player!.progress,
                highestLevel: Math.max(prev.progress.highestLevel, data.player!.progress.highestLevel),
                storyStars: { ...data.player!.progress.storyStars, ...prev.progress.storyStars },
              },
            };
            saveLocalBackup(merged);
            return merged;
          });
        }
      } catch {
        // Offline safe
      }
    },
    [apiHeaders, saveLocalBackup],
  );

  // Start a game run in any of the 6 modes
  const launchRun = useCallback(
    async (req: {
      mode: 'story' | 'endless' | 'time' | 'survival' | 'daily' | 'friend';
      level?: number;
      secs?: 60 | 120;
      date?: string;
      code?: string;
    }) => {
      try {
        const res = await fetch('/api/v1/sessions/start', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(req),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          sessionId?: string;
          config?: GameConfig;
          descriptor?: RunDescriptor;
        };
        if (data.ok && data.sessionId && data.config && data.descriptor) {
          setActiveRun({
            sessionId: data.sessionId,
            config: data.config,
            descriptor: data.descriptor,
          });
          setScreen('play');
          return;
        }
      } catch {
        // Fallback offline start
      }

      const fallbackSeed = Date.now() & 0x7fffffff;
      const descriptor: RunDescriptor =
        req.mode === 'story'
          ? { mode: 'story', level: req.level ?? 1 }
          : req.mode === 'time'
            ? { mode: 'time', seed: fallbackSeed, secs: req.secs ?? 60 }
            : req.mode === 'endless'
              ? { mode: 'endless', seed: fallbackSeed }
              : req.mode === 'survival'
                ? { mode: 'survival', seed: fallbackSeed }
                : req.mode === 'daily'
                  ? { mode: 'daily', date: req.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date()), seed: 123456 }
                  : { mode: 'friend', code: req.code || 'FRIEND', seed: 654321 };

      const cfg = configFor(descriptor);
      setActiveRun({
        sessionId: `local_${Date.now()}`,
        config: cfg,
        descriptor,
      });
      setScreen('play');
    },
    [apiHeaders],
  );

  // Handle run completion & server score validation
  const handleFinishRun = useCallback(
    async (payload: {
      sessionId: string;
      log: number[][];
      endTick: number;
      quit: boolean;
      localResult: RunResult;
    }): Promise<SubmitSessionResponse | null> => {
      const { localResult } = payload;
      const cfg = activeRun?.config;

      // Immediately update local state so offline/refresh retains progress
      if (cfg) {
        setPlayer((prev) => {
          const storyStars = { ...prev.progress.storyStars };
          const bestScores = { ...prev.progress.bestScores };
          let highestLevel = prev.progress.highestLevel;
          let addedCoins = localResult.won ? cfg.rewards.coins : 0;
          const addedXp = localResult.won ? cfg.rewards.xp : 0;

          if (cfg.mode === 'story' && cfg.level && localResult.won) {
            const key = String(cfg.level);
            const oldStars = storyStars[key] ?? 0;
            if (localResult.stars > oldStars) {
              addedCoins += (localResult.stars - oldStars) * 15;
              storyStars[key] = localResult.stars;
            }
            if (cfg.level >= highestLevel && cfg.level < 100) {
              highestLevel = cfg.level + 1;
            }
          }
          if (localResult.score > (bestScores[cfg.id] ?? 0)) {
            bestScores[cfg.id] = localResult.score;
          }

          const newLifetime = mergeRunIntoLifetime(prev.progress.lifetimeStats, cfg, localResult);
          const newXp = prev.progress.xp + addedXp;
          const xpInfo = levelFromXp(newXp);
          const completedCount = Object.values(storyStars).filter((s) => s >= 1).length;
          const achEval = evaluateAchievements(
            { lifetime: newLifetime, storyStars },
            prev.achievements.filter((a) => a.unlocked).map((a) => a.id),
          );

          const nextState: PlayerStateDTO = {
            ...prev,
            progress: {
              ...prev.progress,
              coins: prev.progress.coins + addedCoins,
              xp: newXp,
              level: xpInfo.level,
              currentLevelXp: xpInfo.currentLevelXp,
              nextLevelXp: xpInfo.nextLevelXp,
              title: shopTitleForLevel(xpInfo.level, completedCount),
              highestLevel,
              storyStars,
              bestScores,
              lifetimeStats: newLifetime,
            },
            achievements: achEval.statuses,
          };
          saveLocalBackup(nextState);
          return nextState;
        });
      }

      try {
        const res = await fetch('/api/v1/sessions/submit', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({
            sessionId: payload.sessionId,
            log: payload.log,
            endTick: payload.endTick,
            quit: payload.quit,
          }),
        });
        const data = (await res.json()) as SubmitSessionResponse;
        if (data.ok && data.player) {
          setPlayer(data.player);
          saveLocalBackup(data.player);
        }
        return data;
      } catch {
        return null;
      }
    },
    [activeRun, apiHeaders, saveLocalBackup],
  );

  // Fetch leaderboard when leaderboard screen or filters change
  useEffect(() => {
    if (screen !== 'leaderboard') return;
    setLbLoading(true);
    const params = new URLSearchParams({
      scope: lbScope,
      board: lbBoard,
      ...(lbDistrict ? { district: lbDistrict } : {}),
      ...(lbScope === 'friends' ? { code: lbFriendCode } : {}),
    });
    fetch(`/api/v1/leaderboards?${params.toString()}`, { headers: apiHeaders() })
      .then((r) => r.json())
      .then((data: { ok?: boolean; entries?: LeaderboardRowDTO[] }) => {
        if (data.ok && data.entries) setLbEntries(data.entries);
      })
      .catch(() => undefined)
      .finally(() => setLbLoading(false));
  }, [screen, lbScope, lbBoard, lbDistrict, lbFriendCode, apiHeaders]);

  // Fetch Daily Challenge info when daily screen opens
  useEffect(() => {
    if (screen !== 'daily') return;
    fetch('/api/v1/daily', { headers: apiHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDailyInfo(data);
      })
      .catch(() => undefined);
  }, [screen, apiHeaders]);

  const handleGenerateFriendChallenge = async (creatorScore = 0) => {
    try {
      const res = await fetch('/api/v1/friends', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ creatorScore }),
      });
      const data = await res.json();
      if (data.ok && data.challenge) {
        setCreatedFriend(data.challenge);
        setFriendCodeInput(data.challenge.code);
        setScreen('friend');
      }
    } catch {
      // ignore
    }
  };

  const handleCustomize = async (itemId: string) => {
    try {
      const res = await fetch('/api/v1/customize', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ itemId }),
      });
      const data = (await res.json()) as { ok?: boolean; player?: PlayerStateDTO };
      if (data.ok && data.player) {
        setPlayer(data.player);
        saveLocalBackup(data.player);
        sound.play('cash');
      }
    } catch {
      // ignore
    }
  };

  // If currently in active gameplay, render GameView
  if (screen === 'play' && activeRun) {
    return (
      <GameView
        key={activeRun.sessionId}
        sessionId={activeRun.sessionId}
        config={activeRun.config}
        lang={lang}
        equipped={player.progress.equippedItems}
        tutorialsSeen={player.progress.tutorialsSeen}
        musicOn={player.profile.musicOn}
        sfxOn={player.profile.sfxOn}
        onToggleMusic={(on) => updatePreferences({ musicOn: on })}
        onToggleSfx={(on) => updatePreferences({ sfxOn: on })}
        onFinishRun={handleFinishRun}
        onReplay={() => {
          const d = activeRun.descriptor;
          if (d.mode === 'story') launchRun({ mode: 'story', level: d.level });
          else if (d.mode === 'time') launchRun({ mode: 'time', secs: d.secs });
          else if (d.mode === 'daily') launchRun({ mode: 'daily', date: d.date });
          else if (d.mode === 'friend') launchRun({ mode: 'friend', code: d.code });
          else launchRun({ mode: d.mode });
        }}
        onNextLevel={
          activeRun.descriptor.mode === 'story' && activeRun.descriptor.level < 100
            ? () => launchRun({ mode: 'story', level: (activeRun.descriptor as { mode: 'story'; level: number }).level + 1 })
            : undefined
        }
        onExit={() => setScreen(activeRun.descriptor.mode === 'story' ? 'levels' : 'home')}
        onCreateFriendChallenge={(score) => handleGenerateFriendChallenge(score)}
        onHelloKhataClick={(placement) => trackEvent('hello_khata_clicked', { placement })}
      />
    );
  }

  const totalStarsEarned = Object.values(player.progress.storyStars).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-[#FFF8E7] text-[#3B2314]">
      {/* ── TOP APP HEADER ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-4 border-[#3B2314] bg-[#C9462C] px-4 py-2.5 text-white shadow-md">
        <button
          type="button"
          data-testid="nav-home"
          onClick={() => setScreen('home')}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-2xl">🏪</span>
          <div>
            <div className="text-lg leading-tight font-black tracking-tight text-[#F6C445]">দোকান সামলাও!</div>
            <div className="text-[11px] font-bold text-amber-100">Dokaan Shamlao</div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScreen('customize')}
            className="flex items-center gap-1 rounded-xl border-2 border-[#3B2314] bg-[#F6C445] px-2.5 py-1 text-xs font-extrabold text-[#3B2314]"
          >
            <span>🪙</span>
            <span data-testid="header-coins">{num(player.progress.coins, lang)}</span>
          </button>

          <button
            type="button"
            onClick={() => setScreen('levels')}
            className="flex items-center gap-1 rounded-xl border-2 border-[#3B2314] bg-white px-2.5 py-1 text-xs font-extrabold text-[#3B2314]"
          >
            <span>⭐</span>
            <span data-testid="header-stars">{digits(totalStarsEarned, lang)}</span>
          </button>

          <button
            type="button"
            data-testid="btn-lang-toggle"
            onClick={() => updatePreferences({ lang: lang === 'bn' ? 'en' : 'bn' })}
            className="rounded-xl border-2 border-[#3B2314] bg-[#2A9D8F] px-2.5 py-1 text-xs font-extrabold text-white"
          >
            {lang === 'bn' ? 'EN' : 'বাংলা'}
          </button>

          <button
            type="button"
            data-testid="btn-open-settings"
            onClick={() => setShowSettingsModal(true)}
            aria-label="Settings"
            className="rounded-xl border-2 border-[#3B2314] bg-white px-2.5 py-1 text-xs font-extrabold text-[#3B2314]"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ── MAIN BODY ── */}
      <main className="flex-1 p-4">
        {/* ════════════════ SCREEN 1: HOME ════════════════ */}
        {screen === 'home' && (
          <div data-testid="home-screen" className="space-y-4">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl border-4 border-[#3B2314] bg-gradient-to-b from-[#F4D58D] to-[#FFF3D6] p-5 shadow-lg">
              <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
                <div className="flex-1 space-y-2">
                  <span className="inline-block rounded-full border-2 border-[#3B2314] bg-[#C9462C] px-3 py-0.5 text-xs font-extrabold text-white">
                    🇧🇩 {lang === 'bn' ? 'পাড়ার মুদি দোকানের আর্কেড গেম' : 'Bangladeshi Grocery Shop Arcade Game'}
                  </span>
                  <h1 className="text-3xl font-black text-[#3B2314] sm:text-4xl">
                    {lang === 'bn' ? 'দোকান সামলাও!' : 'Dokaan Shamlao!'}
                  </h1>
                  <p className="text-sm font-bold text-[#6D4C41]">
                    {lang === 'bn'
                      ? 'কাস্টমারের ভিড়, দরদাম, বাকির খাতা, মহাজনের ডেলিভারি আর হিসাবের ভূত — সব সামলে হয়ে উঠুন দোকান সম্রাট!'
                      : 'Handle customer rushes, bargaining, credit tabs, supplier deliveries and the Accounting Ghost to become the Shop King!'}
                  </p>
                </div>
                <div className="mt-3 flex items-end justify-center gap-2 sm:mt-0">
                  <img
                    src={shopkeeperDataUrl(player.progress.equippedItems.outfit, 'happy')}
                    alt="Shopkeeper"
                    className="h-28 w-22 object-contain drop-shadow"
                  />
                  <img
                    src={characterDataUrl('bargain', 'talk')}
                    alt="Customer"
                    className="h-24 w-20 object-contain drop-shadow"
                  />
                </div>
              </div>

              {/* Visually Most Prominent PLAY Button */}
              <button
                type="button"
                data-testid="btn-main-play"
                onClick={() => launchRun({ mode: 'story', level: player.progress.highestLevel })}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-4 border-[#3B2314] bg-[#2E7D32] py-4 text-xl font-black text-white shadow-[0_5px_0_#3B2314] transition hover:bg-[#1B5E20] active:translate-y-1 active:shadow-none"
              >
                <span>▶️</span>
                <span>
                  {lang === 'bn'
                    ? `খেলুন! (লেভেল ${digits(player.progress.highestLevel, 'bn')})`
                    : `PLAY! (Level ${player.progress.highestLevel})`}
                </span>
              </button>
            </div>

            {/* Quick Mode & Feature Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                type="button"
                data-testid="home-btn-story"
                onClick={() => {
                  setSelectedChapter(Math.min(5, 1 + Math.floor((player.progress.highestLevel - 1) / 20)));
                  setScreen('levels');
                }}
                className="flex flex-col items-start rounded-2xl border-3 border-[#3B2314] bg-white p-3.5 text-left shadow-[0_4px_0_#3B2314] transition hover:bg-[#FFF3D6]"
              >
                <span className="text-2xl">🗺️</span>
                <span className="mt-1 text-base font-extrabold">{lang === 'bn' ? 'স্টোরি মোড' : 'Story Mode'}</span>
                <span className="text-xs font-bold text-[#6D4C41]">
                  {lang === 'bn' ? `১০০ লেভেল • ৫ অধ্যায়` : '100 Levels • 5 Chapters'}
                </span>
              </button>

              <button
                type="button"
                data-testid="home-btn-daily"
                onClick={() => setScreen('daily')}
                className="flex flex-col items-start rounded-2xl border-3 border-[#3B2314] bg-[#FEF3C7] p-3.5 text-left shadow-[0_4px_0_#3B2314] transition hover:bg-[#FDE68A]"
              >
                <span className="text-2xl">📅</span>
                <span className="mt-1 text-base font-extrabold">{lang === 'bn' ? 'ডেইলি চ্যালেঞ্জ' : 'Daily Challenge'}</span>
                <span className="text-xs font-bold text-[#92400E]">
                  {lang === 'bn' ? 'আজকের বিশেষ প্রতিযোগিতা' : "Today's Special Seed"}
                </span>
              </button>

              <button
                type="button"
                data-testid="home-btn-endless"
                onClick={() => launchRun({ mode: 'endless' })}
                className="flex flex-col items-start rounded-2xl border-3 border-[#3B2314] bg-[#E0F2FE] p-3.5 text-left shadow-[0_4px_0_#3B2314] transition hover:bg-[#BAE6FD]"
              >
                <span className="text-2xl">♾️</span>
                <span className="mt-1 text-base font-extrabold">{lang === 'bn' ? 'অফুরন্ত মোড' : 'Endless Mode'}</span>
                <span className="text-xs font-bold text-[#075985]">
                  {lang === 'bn' ? 'একটানা কাস্টমারের স্রোত' : 'Non-stop customer wave'}
                </span>
              </button>

              <button
                type="button"
                data-testid="home-btn-modes"
                onClick={() => setScreen('modes')}
                className="flex flex-col items-start rounded-2xl border-3 border-[#3B2314] bg-white p-3.5 text-left shadow-[0_4px_0_#3B2314] transition hover:bg-[#FFF3D6]"
              >
                <span className="text-2xl">🎮</span>
                <span className="mt-1 text-base font-extrabold">{lang === 'bn' ? 'সব গেম মোড (৬টি)' : 'All 6 Modes'}</span>
                <span className="text-xs font-bold text-[#6D4C41]">
                  {lang === 'bn' ? 'টাইম অ্যাটাক, টিকে থাকো, বন্ধু' : 'Time Attack, Survival, Friend'}
                </span>
              </button>

              <button
                type="button"
                data-testid="home-btn-leaderboard"
                onClick={() => setScreen('leaderboard')}
                className="flex flex-col items-start rounded-2xl border-3 border-[#3B2314] bg-white p-3.5 text-left shadow-[0_4px_0_#3B2314] transition hover:bg-[#FFF3D6]"
              >
                <span className="text-2xl">🏆</span>
                <span className="mt-1 text-base font-extrabold">{lang === 'bn' ? 'লিডারবোর্ড' : 'Leaderboard'}</span>
                <span className="text-xs font-bold text-[#6D4C41]">
                  {lang === 'bn' ? 'দৈনিক, সাপ্তাহিক ও জেলা র‍্যাঙ্ক' : 'Daily, Weekly & District'}
                </span>
              </button>

              <button
                type="button"
                data-testid="home-btn-customize"
                onClick={() => setScreen('customize')}
                className="flex flex-col items-start rounded-2xl border-3 border-[#3B2314] bg-white p-3.5 text-left shadow-[0_4px_0_#3B2314] transition hover:bg-[#FFF3D6]"
              >
                <span className="text-2xl">🎨</span>
                <span className="mt-1 text-base font-extrabold">{lang === 'bn' ? 'দোকান সাজান' : 'Customize Shop'}</span>
                <span className="text-xs font-bold text-[#6D4C41]">
                  {lang === 'bn' ? 'সাইনবোর্ড, তাক ও পোশাক' : 'Signs, Shelves & Outfits'}
                </span>
              </button>
            </div>

            {/* Player Profile Summary Card */}
            <div className="flex items-center justify-between rounded-2xl border-3 border-[#3B2314] bg-white p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <img
                  src={characterDataUrl(player.profile.avatar, 'happy')}
                  alt=""
                  className="h-12 w-10 rounded-lg border-2 border-[#3B2314] bg-[#FFF3D6] object-contain"
                />
                <div>
                  <div className="text-sm font-extrabold">{player.profile.displayName}</div>
                  <div className="text-xs font-bold text-[#2A9D8F]">
                    {pick(player.progress.title, lang)} • {lang === 'bn' ? 'লেভেল' : 'Lv'}{' '}
                    {digits(player.progress.level, lang)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                data-testid="home-btn-profile"
                onClick={() => setScreen('profile')}
                className="rounded-xl border-2 border-[#3B2314] bg-[#F6C445] px-3.5 py-2 text-xs font-extrabold text-[#3B2314]"
              >
                👤 {lang === 'bn' ? 'প্রোফাইল ও অর্জন' : 'Profile & Badges'}
              </button>
            </div>

            {/* Subtle HelloKhata Link on Home Screen (Section 17 & 22) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[#0A9396]/50 bg-[#E0F2F1] px-4 py-2.5 text-xs">
              <span className="font-bold text-[#004D40]">
                📒 {lang === 'bn' ? 'সৌজন্যে: HelloKhata — ব্যবসার ডিজিটাল হিসাবের খাতা' : 'Presented by HelloKhata — Smart Shop Accounting'}
              </span>
              <a
                href={`${process.env.NEXT_PUBLIC_HELLOKHATA_URL || 'https://hellokhata.com'}?utm_source=dokaan_shamlao&utm_medium=home_link&utm_campaign=game`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="hellokhata-home-link"
                onClick={() => trackEvent('hello_khata_clicked', { placement: 'home_screen' })}
                className="font-extrabold text-[#00695C] underline"
              >
                {lang === 'bn' ? 'HelloKhata সম্পর্কে জানুন →' : 'Visit HelloKhata →'}
              </a>
            </div>
          </div>
        )}

        {/* ════════════════ SCREEN 2: MODE SELECTION ════════════════ */}
        {screen === 'modes' && (
          <div data-testid="modes-screen" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">{lang === 'bn' ? 'গেম মোড বাছাই করুন' : 'Select Game Mode'}</h2>
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold"
              >
                ← {lang === 'bn' ? 'ফিরে যান' : 'Back'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Mode 1: Story Mode */}
              <div className="flex flex-col justify-between rounded-2xl border-3 border-[#3B2314] bg-white p-4 shadow-sm">
                <div>
                  <div className="text-2xl">📖</div>
                  <h3 className="mt-1 text-lg font-extrabold">{lang === 'bn' ? 'স্টোরি মোড' : 'Story Mode'}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6D4C41]">
                    {lang === 'bn'
                      ? 'পাড়ার ছোট দোকান থেকে সুপার শপ হয়ে দোকান সম্রাট! ১০০টি লেভেল ও ৫ জন বস।'
                      : 'Grow from a small neighbourhood shop to Shop King! 100 levels & 5 bosses.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="mode-select-story"
                  onClick={() => setScreen('levels')}
                  className="mt-3 w-full rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-2 text-sm font-extrabold text-white"
                >
                  {lang === 'bn' ? 'লেভেল ম্যাপ খুলুন' : 'Open Level Map'}
                </button>
              </div>

              {/* Mode 2: Endless Mode */}
              <div className="flex flex-col justify-between rounded-2xl border-3 border-[#3B2314] bg-white p-4 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">♾️</span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold">
                      {lang === 'bn' ? 'সেরা' : 'Best'}: {num(player.progress.bestScores.endless ?? 0, lang)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-extrabold">{lang === 'bn' ? 'অফুরন্ত (Endless)' : 'Endless Mode'}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6D4C41]">
                    {lang === 'bn'
                      ? 'কাস্টমার আসতেই থাকবে এবং গতি বাড়বে। সুনাম শূন্য হওয়ার আগে কত স্কোর করতে পারেন?'
                      : 'Continuous customers with rising speed. How high can you score before reputation hits zero?'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="mode-select-endless"
                  onClick={() => launchRun({ mode: 'endless' })}
                  className="mt-3 w-full rounded-xl border-2 border-[#3B2314] bg-[#F6C445] py-2 text-sm font-extrabold text-[#3B2314]"
                >
                  {lang === 'bn' ? 'শুরু করুন' : 'Play Endless'}
                </button>
              </div>

              {/* Mode 3: Time Attack (60s / 120s) */}
              <div className="flex flex-col justify-between rounded-2xl border-3 border-[#3B2314] bg-white p-4 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">⏱️</span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold">
                      60s: {num(player.progress.bestScores['time:60'] ?? 0, lang)} | 120s:{' '}
                      {num(player.progress.bestScores['time:120'] ?? 0, lang)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-extrabold">{lang === 'bn' ? 'টাইম অ্যাটাক' : 'Time Attack'}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6D4C41]">
                    {lang === 'bn'
                      ? '৬০ বা ১২০ সেকেন্ডের মধ্যে যত বেশি সম্ভব অর্ডার নিখুঁতভাবে সম্পন্ন করুন!'
                      : 'Complete as many accurate orders as possible in 60 or 120 seconds!'}
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    data-testid="mode-select-time60"
                    onClick={() => launchRun({ mode: 'time', secs: 60 })}
                    className="flex-1 rounded-xl border-2 border-[#3B2314] bg-[#2A9D8F] py-2 text-xs font-extrabold text-white"
                  >
                    ⚡ {lang === 'bn' ? '৬০ সেকেন্ড' : '60 Seconds'}
                  </button>
                  <button
                    type="button"
                    data-testid="mode-select-time120"
                    onClick={() => launchRun({ mode: 'time', secs: 120 })}
                    className="flex-1 rounded-xl border-2 border-[#3B2314] bg-[#1D4ED8] py-2 text-xs font-extrabold text-white"
                  >
                    🔥 {lang === 'bn' ? '১২০ সেকেন্ড' : '120 Seconds'}
                  </button>
                </div>
              </div>

              {/* Mode 4: Survival Mode */}
              <div className="flex flex-col justify-between rounded-2xl border-3 border-[#3B2314] bg-white p-4 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🛡️</span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold">
                      {lang === 'bn' ? 'সেরা' : 'Best'}: {num(player.progress.bestScores.survival ?? 0, lang)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-extrabold">{lang === 'bn' ? 'টিকে থাকো (Survival)' : 'Survival Mode'}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6D4C41]">
                    {lang === 'bn'
                      ? 'লোডশেডিং, ঝুম বৃষ্টি, ফ্রিজ নষ্ট, চোর ও হঠাৎ খরচের মাঝে দোকান বাঁচিয়ে রাখুন!'
                      : 'Keep the shop alive through blackouts, heavy rain, fridge breakdowns and thieves!'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="mode-select-survival"
                  onClick={() => launchRun({ mode: 'survival' })}
                  className="mt-3 w-full rounded-xl border-2 border-[#3B2314] bg-[#E63946] py-2 text-sm font-extrabold text-white"
                >
                  {lang === 'bn' ? 'শুরু করুন' : 'Play Survival'}
                </button>
              </div>

              {/* Mode 5: Daily Challenge */}
              <div className="flex flex-col justify-between rounded-2xl border-3 border-[#3B2314] bg-white p-4 shadow-sm">
                <div>
                  <div className="text-2xl">📅</div>
                  <h3 className="mt-1 text-lg font-extrabold">{lang === 'bn' ? 'ডেইলি চ্যালেঞ্জ' : 'Daily Challenge'}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6D4C41]">
                    {lang === 'bn'
                      ? 'প্রতিদিন বাংলাদেশের সব খেলোয়াড়ের জন্য একই বিশেষ চ্যালেঞ্জ ও লিডারবোর্ড।'
                      : 'Every player receives the exact same server-seeded challenge each day (Asia/Dhaka).'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="mode-select-daily"
                  onClick={() => setScreen('daily')}
                  className="mt-3 w-full rounded-xl border-2 border-[#3B2314] bg-[#F6C445] py-2 text-sm font-extrabold text-[#3B2314]"
                >
                  {lang === 'bn' ? 'আজকের চ্যালেঞ্জ দেখুন' : "View Today's Challenge"}
                </button>
              </div>

              {/* Mode 6: Challenge a Friend */}
              <div className="flex flex-col justify-between rounded-2xl border-3 border-[#3B2314] bg-white p-4 shadow-sm">
                <div>
                  <div className="text-2xl">🤝</div>
                  <h3 className="mt-1 text-lg font-extrabold">{lang === 'bn' ? 'বন্ধুকে চ্যালেঞ্জ' : 'Challenge a Friend'}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#6D4C41]">
                    {lang === 'bn'
                      ? 'নিজের চ্যালেঞ্জ কোড তৈরি করে বন্ধুকে পাঠান অথবা বন্ধুর কোড দিয়ে খেলুন!'
                      : 'Create a shareable challenge link or enter a friend code to compete head-to-head!'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="mode-select-friend"
                  onClick={() => setScreen('friend')}
                  className="mt-3 w-full rounded-xl border-2 border-[#3B2314] bg-[#6D28D9] py-2 text-sm font-extrabold text-white"
                >
                  {lang === 'bn' ? 'বন্ধু চ্যালেঞ্জ খুলুন' : 'Open Friend Challenge'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SCREEN 3: LEVEL SELECTION (100 LEVELS, 5 CHAPTERS) ════════════════ */}
        {screen === 'levels' && (
          <div data-testid="levels-screen" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">{lang === 'bn' ? 'স্টোরি মোড — ১০০ লেভেল' : 'Story Mode — 100 Levels'}</h2>
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold"
              >
                ← {lang === 'bn' ? 'হোম' : 'Home'}
              </button>
            </div>

            {/* 5 Chapter Selector Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {CHAPTERS.map((ch) => {
                const isSel = selectedChapter === ch.n;
                return (
                  <button
                    key={ch.n}
                    type="button"
                    data-testid={`chapter-tab-${ch.n}`}
                    onClick={() => setSelectedChapter(ch.n)}
                    className={`shrink-0 rounded-xl border-2 border-[#3B2314] px-3 py-2 text-left text-xs font-extrabold transition ${
                      isSel ? 'bg-[#C9462C] text-white' : 'bg-white text-[#3B2314]'
                    }`}
                  >
                    <div>
                      {lang === 'bn' ? `অধ্যায় ${digits(ch.n, 'bn')}` : `Chapter ${ch.n}`} ({digits(ch.from, lang)}–
                      {digits(ch.to, lang)})
                    </div>
                    <div className="text-[11px] opacity-90">{pick(ch.name, lang)}</div>
                  </button>
                );
              })}
            </div>

            {/* Selected Chapter Banner */}
            {(() => {
              const ch = CHAPTERS[selectedChapter - 1]!;
              const rows = LEVEL_ROWS.slice(ch.from - 1, ch.to);
              const chapterStars = rows.reduce((acc, r) => acc + (player.progress.storyStars[String(r.n)] ?? 0), 0);
              return (
                <>
                  <div className="flex items-center justify-between rounded-2xl border-2 border-[#3B2314] bg-[#F4D58D] px-4 py-2.5">
                    <div>
                      <div className="text-base font-extrabold">{pick(ch.name, lang)}</div>
                      <div className="text-xs font-semibold text-[#3B2314]/80">{pick(ch.teaches, lang)}</div>
                    </div>
                    <div className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold">
                      ⭐ {digits(chapterStars, lang)} / {digits(rows.length * 3, lang)}
                    </div>
                  </div>

                  {/* 20 Levels Grid */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {rows.map((row) => {
                      const stars = player.progress.storyStars[String(row.n)] ?? 0;
                      const unlocked = row.n <= player.progress.highestLevel;
                      const isBoss = Boolean(row.boss);
                      return (
                        <button
                          key={row.n}
                          type="button"
                          data-testid={`level-card-${row.n}`}
                          disabled={!unlocked}
                          onClick={() => launchRun({ mode: 'story', level: row.n })}
                          className={`flex flex-col justify-between rounded-xl border-2 p-3 text-left transition ${
                            !unlocked
                              ? 'border-slate-300 bg-slate-100 text-slate-400 opacity-70'
                              : isBoss
                                ? 'border-[#3B2314] bg-[#FEF2F2] hover:bg-[#FEE2E2] shadow-[0_3px_0_#3B2314]'
                                : 'border-[#3B2314] bg-white hover:bg-[#FFF3D6] shadow-[0_3px_0_#3B2314]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="rounded-md border border-[#3B2314] bg-[#F6C445] px-2 py-0.5 text-xs font-black text-[#3B2314]">
                              #{digits(row.n, lang)}
                            </span>
                            <span className="text-xs">
                              {!unlocked
                                ? '🔒'
                                : isBoss
                                  ? '👑'
                                  : [1, 2, 3].map((s) => (
                                      <span key={s} className={s <= stars ? 'text-[#F59E0B]' : 'text-slate-300'}>
                                        ★
                                      </span>
                                    ))}
                            </span>
                          </div>
                          <div className="mt-2 line-clamp-1 text-xs font-extrabold">{pick(row.title, lang)}</div>
                          {row.boss && (
                            <div className="mt-0.5 text-[10px] font-bold text-[#C9462C]">
                              {pick(BOSS_NAMES[row.boss].name, lang)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ════════════════ MODE 5 SCREEN: DAILY CHALLENGE ════════════════ */}
        {screen === 'daily' && (
          <div data-testid="daily-screen" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">📅 {lang === 'bn' ? 'ডেইলি চ্যালেঞ্জ' : 'Daily Challenge'}</h2>
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold"
              >
                ← {lang === 'bn' ? 'হোম' : 'Home'}
              </button>
            </div>

            <div className="rounded-2xl border-3 border-[#3B2314] bg-[#FEF3C7] p-4 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="rounded-full border border-[#3B2314] bg-white px-2.5 py-0.5 text-xs font-extrabold">
                    🌏 Asia/Dhaka • {dailyInfo?.date || 'Today'}
                  </span>
                  <h3 className="mt-1.5 text-xl font-black">
                    {dailyInfo ? pick(dailyInfo.config.title, lang) : lang === 'bn' ? 'আজকের চ্যালেঞ্জ' : "Today's Challenge"}
                  </h3>
                </div>
                <div className="text-right text-xs font-extrabold">
                  <div>{lang === 'bn' ? 'আপনার সেরা স্কোর' : 'Your Best Today'}</div>
                  <div className="text-lg text-[#C9462C]">{num(dailyInfo?.playerBestScore ?? 0, lang)}</div>
                </div>
              </div>

              {dailyInfo && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dailyInfo.config.challenges.map((cid) => {
                    const ch = CHALLENGE_MAP[cid];
                    return (
                      <span
                        key={cid}
                        className="rounded-lg border border-[#3B2314] bg-white px-2 py-0.5 text-xs font-bold"
                      >
                        ⚡ {ch ? pick(ch.name, lang) : cid}
                      </span>
                    );
                  })}
                </div>
              )}

              <p className="mt-2 text-xs font-semibold text-[#92400E]">
                {dailyInfo ? pick(dailyInfo.retryPolicy, lang) : ''}
              </p>

              <button
                type="button"
                data-testid="btn-play-daily"
                onClick={() => launchRun({ mode: 'daily', date: dailyInfo?.date })}
                className="mt-3 w-full rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-3 text-base font-extrabold text-white shadow"
              >
                ▶️ {lang === 'bn' ? 'ডেইলি চ্যালেঞ্জ খেলুন' : 'Play Daily Challenge'}
              </button>
            </div>

            {/* Today's Leaderboard */}
            <div className="rounded-2xl border-2 border-[#3B2314] bg-white p-4">
              <h4 className="text-sm font-extrabold">{lang === 'bn' ? 'আজকের শীর্ষ দোকানদার' : "Today's Leaderboard"}</h4>
              {dailyInfo?.leaderboard && dailyInfo.leaderboard.length > 0 ? (
                <div className="mt-2 divide-y divide-[#3B2314]/15 text-xs font-bold">
                  {dailyInfo.leaderboard.map((row) => (
                    <div key={row.playerId} className="flex items-center justify-between py-2">
                      <span>
                        #{digits(row.rank, lang)} {row.displayName}
                      </span>
                      <span className="font-extrabold text-[#C9462C]">{num(row.score, lang)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#6D4C41]">
                  {lang === 'bn' ? 'আজ এখনো কেউ স্কোর জমা দেয়নি — প্রথম হোন!' : 'No scores submitted yet today — be the first!'}
                </p>
              )}
            </div>

            {/* Previous 7 Days History */}
            {dailyInfo?.history && (
              <div className="rounded-2xl border-2 border-[#3B2314] bg-white p-4">
                <h4 className="text-sm font-extrabold">{lang === 'bn' ? 'বিগত দিনের চ্যালেঞ্জ' : 'Recent Daily Challenges'}</h4>
                <div className="mt-2 space-y-2">
                  {dailyInfo.history.map((h) => (
                    <div
                      key={h.date}
                      className="flex items-center justify-between rounded-xl border border-[#3B2314]/20 bg-[#FFF8E7] px-3 py-2 text-xs font-bold"
                    >
                      <div>
                        <div>
                          {h.date} — {pick(h.title, lang)}
                        </div>
                        <div className="text-[11px] text-[#6D4C41]">
                          {lang === 'bn' ? 'সেরা স্কোর' : 'Best'}: {num(h.bestScore, lang)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => launchRun({ mode: 'daily', date: h.date })}
                        className="rounded-lg border border-[#3B2314] bg-[#F6C445] px-2.5 py-1 text-xs font-extrabold"
                      >
                        {lang === 'bn' ? 'খেলুন' : 'Play'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ MODE 6 SCREEN: CHALLENGE A FRIEND ════════════════ */}
        {screen === 'friend' && (
          <div data-testid="friend-screen" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">🤝 {lang === 'bn' ? 'বন্ধুকে চ্যালেঞ্জ করুন' : 'Challenge a Friend'}</h2>
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold"
              >
                ← {lang === 'bn' ? 'হোম' : 'Home'}
              </button>
            </div>

            <div className="rounded-2xl border-3 border-[#3B2314] bg-white p-4 space-y-3">
              <h3 className="text-base font-extrabold">
                {lang === 'bn' ? '১. নতুন চ্যালেঞ্জ তৈরি করুন' : '1. Create a New Friend Challenge'}
              </h3>
              <button
                type="button"
                data-testid="btn-create-friend-challenge"
                onClick={() => handleGenerateFriendChallenge(0)}
                className="w-full rounded-xl border-2 border-[#3B2314] bg-[#6D28D9] py-2.5 text-sm font-extrabold text-white"
              >
                ✨ {lang === 'bn' ? 'চ্যালেঞ্জ কোড তৈরি করুন' : 'Generate Challenge Code'}
              </button>

              {createdFriend && (
                <div
                  data-testid="created-friend-box"
                  className="rounded-xl border-2 border-[#3B2314] bg-[#F3E8FF] p-3 text-center"
                >
                  <div className="text-xs font-bold text-[#6D28D9]">
                    {lang === 'bn' ? 'আপনার চ্যালেঞ্জ কোড (৭ দিন মেয়াদ)' : 'Your Challenge Code (Valid 7 Days)'}
                  </div>
                  <div className="mt-1 text-2xl font-black tracking-widest" data-testid="friend-code-value">
                    {createdFriend.code}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${window.location.origin}/?friend=${createdFriend.code}`);
                      }}
                      className="flex-1 rounded-lg border border-[#3B2314] bg-white py-1.5 text-xs font-extrabold"
                    >
                      🔗 {lang === 'bn' ? 'লিংক কপি করুন' : 'Copy Share Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => launchRun({ mode: 'friend', code: createdFriend.code })}
                      className="flex-1 rounded-lg border border-[#3B2314] bg-[#2E7D32] py-1.5 text-xs font-extrabold text-white"
                    >
                      ▶️ {lang === 'bn' ? 'এখনই খেলুন' : 'Play Now'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border-3 border-[#3B2314] bg-white p-4 space-y-3">
              <h3 className="text-base font-extrabold">
                {lang === 'bn' ? '২. বন্ধুর চ্যালেঞ্জ কোড দিয়ে খেলুন' : "2. Play a Friend's Challenge Code"}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  data-testid="input-friend-code"
                  value={friendCodeInput}
                  onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                  placeholder={lang === 'bn' ? 'কোড লিখুন (যেমন ABC123)' : 'Enter Code (e.g. ABC123)'}
                  className="flex-1 rounded-xl border-2 border-[#3B2314] px-3 py-2 text-sm font-extrabold uppercase"
                />
                <button
                  type="button"
                  data-testid="btn-join-friend-challenge"
                  onClick={() => launchRun({ mode: 'friend', code: friendCodeInput || 'FRIEND' })}
                  className="rounded-xl border-2 border-[#3B2314] bg-[#F6C445] px-4 py-2 text-sm font-extrabold"
                >
                  ▶️ {lang === 'bn' ? 'খেলুন' : 'Play'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SCREEN 7: LEADERBOARD ════════════════ */}
        {screen === 'leaderboard' && (
          <div data-testid="leaderboard-screen" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">🏆 {lang === 'bn' ? 'লিডারবোর্ড' : 'Leaderboard'}</h2>
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold"
              >
                ← {lang === 'bn' ? 'হোম' : 'Home'}
              </button>
            </div>

            {/* Scope Tabs: Daily, Weekly, All-time, Friends */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['daily', lang === 'bn' ? 'দৈনিক' : 'Daily'],
                  ['weekly', lang === 'bn' ? 'সাপ্তাহিক' : 'Weekly'],
                  ['alltime', lang === 'bn' ? 'সর্বকালের' : 'All-Time'],
                  ['friends', lang === 'bn' ? 'বন্ধুদের' : 'Friends'],
                ] as const
              ).map(([sc, label]) => (
                <button
                  key={sc}
                  type="button"
                  data-testid={`lb-scope-${sc}`}
                  onClick={() => setLbScope(sc)}
                  className={`rounded-xl border-2 border-[#3B2314] px-3 py-1.5 text-xs font-extrabold ${
                    lbScope === sc ? 'bg-[#C9462C] text-white' : 'bg-white text-[#3B2314]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Board & District Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {(lbScope === 'weekly' || lbScope === 'alltime') && (
                <select
                  aria-label="Board"
                  value={lbBoard}
                  onChange={(e) => setLbBoard(e.target.value as typeof lbBoard)}
                  className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1.5 text-xs font-extrabold"
                >
                  <option value="endless">{lang === 'bn' ? 'অফুরন্ত মোড' : 'Endless Mode'}</option>
                  <option value="time60">{lang === 'bn' ? 'টাইম অ্যাটাক ৬০সে.' : 'Time Attack 60s'}</option>
                  <option value="time120">{lang === 'bn' ? 'টাইম অ্যাটাক ১২০সে.' : 'Time Attack 120s'}</option>
                  <option value="survival">{lang === 'bn' ? 'টিকে থাকো মোড' : 'Survival Mode'}</option>
                </select>
              )}

              {lbScope === 'friends' && (
                <input
                  type="text"
                  value={lbFriendCode}
                  onChange={(e) => setLbFriendCode(e.target.value.toUpperCase())}
                  placeholder="FRIEND CODE"
                  className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1.5 text-xs font-extrabold uppercase"
                />
              )}

              <select
                aria-label="District"
                value={lbDistrict}
                onChange={(e) => setLbDistrict(e.target.value)}
                className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1.5 text-xs font-extrabold"
              >
                <option value="">{lang === 'bn' ? 'সব জেলা (বাংলাদেশ)' : 'All Districts'}</option>
                {DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {lang === 'bn' ? d.bn : d.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Rankings Table */}
            <div className="overflow-hidden rounded-2xl border-3 border-[#3B2314] bg-white shadow-sm">
              {lbLoading ? (
                <div className="p-6 text-center text-xs font-bold">{lang === 'bn' ? 'লোড হচ্ছে…' : 'Loading…'}</div>
              ) : lbEntries.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold text-[#6D4C41]">
                  {lang === 'bn'
                    ? 'এই বোর্ডে এখনো কোনো স্কোর নেই। একটি ম্যাচ খেলে তালিকায় নাম তুলুন!'
                    : 'No scores on this board yet. Play a run to claim #1!'}
                </div>
              ) : (
                <div className="divide-y divide-[#3B2314]/15">
                  {lbEntries.map((row) => {
                    const distObj = DISTRICTS.find((d) => d.id === row.district);
                    return (
                      <div
                        key={`${row.playerId}-${row.rank}`}
                        data-testid={`lb-row-${row.rank}`}
                        className="flex items-center justify-between px-4 py-2.5 text-xs font-bold"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#3B2314] bg-[#F6C445] font-black">
                            {digits(row.rank, lang)}
                          </span>
                          <img
                            src={characterDataUrl(row.avatar, 'happy')}
                            alt=""
                            className="h-8 w-7 object-contain"
                          />
                          <div>
                            <div className="font-extrabold">{row.displayName}</div>
                            {distObj && (
                              <div className="text-[10px] text-[#6D4C41]">📍 {lang === 'bn' ? distObj.bn : distObj.en}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-black text-[#C9462C]">{num(row.score, lang)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ SCREEN 8: PLAYER PROFILE & ACHIEVEMENTS ════════════════ */}
        {screen === 'profile' && (
          <div data-testid="profile-screen" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">👤 {lang === 'bn' ? 'খেলোয়াড় প্রোফাইল' : 'Player Profile'}</h2>
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold"
              >
                ← {lang === 'bn' ? 'হোম' : 'Home'}
              </button>
            </div>

            {/* Profile Card & Editor */}
            <div className="rounded-2xl border-3 border-[#3B2314] bg-white p-4 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={characterDataUrl(avatarDraft, 'happy')}
                    alt=""
                    className="h-16 w-14 rounded-xl border-2 border-[#3B2314] bg-[#FFF3D6] object-contain"
                  />
                  <div>
                    <div className="text-lg font-extrabold">{player.profile.displayName}</div>
                    <div className="text-xs font-bold text-[#2A9D8F]">
                      {pick(player.progress.title, lang)} • {lang === 'bn' ? 'লেভেল' : 'Level'}{' '}
                      {digits(player.progress.level, lang)}
                    </div>
                    <div className="text-[11px] font-semibold text-[#6D4C41]">
                      ID: {player.accountCode}
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-48">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>XP</span>
                    <span>
                      {digits(player.progress.currentLevelXp, lang)} / {digits(player.progress.nextLevelXp, lang)}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full border border-[#3B2314] bg-[#FFF3D6]">
                    <div
                      className="h-full bg-[#2E7D32]"
                      style={{
                        width: `${Math.min(100, Math.round((player.progress.currentLevelXp / Math.max(1, player.progress.nextLevelXp)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-extrabold">{lang === 'bn' ? 'নাম (ডাকনাম)' : 'Display Name'}</label>
                  <input
                    type="text"
                    data-testid="input-display-name"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={20}
                    className="mt-1 w-full rounded-xl border-2 border-[#3B2314] px-3 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold">{lang === 'bn' ? 'জেলা (ঐচ্ছিক)' : 'District (Optional)'}</label>
                  <select
                    value={districtDraft}
                    onChange={(e) => setDistrictDraft(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="">{lang === 'bn' ? 'নির্বাচন করুন' : 'None'}</option>
                    {DISTRICTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {lang === 'bn' ? d.bn : d.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold">{lang === 'bn' ? 'অ্যাভাটার বাছুন' : 'Choose Avatar'}</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setAvatarDraft(av.id)}
                      className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1 text-xs font-bold ${
                        avatarDraft === av.id ? 'border-[#3B2314] bg-[#F6C445]' : 'border-[#3B2314]/30 bg-[#FFF8E7]'
                      }`}
                    >
                      <img src={characterDataUrl(av.look, 'happy')} alt="" className="h-7 w-6 object-contain" />
                      <span>{pick(av.name, lang)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                data-testid="btn-save-profile"
                onClick={async () => {
                  await updatePreferences({
                    displayName: nameDraft,
                    district: districtDraft || null,
                    avatar: avatarDraft,
                  });
                  setProfileSavedToast(true);
                  setTimeout(() => setProfileSavedToast(false), 2500);
                }}
                className="w-full rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-2 text-xs font-extrabold text-white"
              >
                💾 {profileSavedToast ? (lang === 'bn' ? 'সংরক্ষিত হয়েছে!' : 'Saved!') : lang === 'bn' ? 'প্রোফাইল সংরক্ষণ করুন' : 'Save Profile'}
              </button>
            </div>

            {/* Lifetime Statistics */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border-2 border-[#3B2314] bg-white p-3 text-center">
                <div className="text-xs font-bold text-[#6D4C41]">{lang === 'bn' ? 'মোট কাস্টমার সেবা' : 'Customers Served'}</div>
                <div className="text-lg font-black">{num(player.progress.lifetimeStats.totalServed, lang)}</div>
              </div>
              <div className="rounded-xl border-2 border-[#3B2314] bg-white p-3 text-center">
                <div className="text-xs font-bold text-[#6D4C41]">{lang === 'bn' ? 'নিখুঁত অর্ডার' : 'Perfect Orders'}</div>
                <div className="text-lg font-black">{num(player.progress.lifetimeStats.totalPerfect, lang)}</div>
              </div>
              <div className="rounded-xl border-2 border-[#3B2314] bg-white p-3 text-center">
                <div className="text-xs font-bold text-[#6D4C41]">{lang === 'bn' ? 'মোট বিক্রি' : 'Total Sales'}</div>
                <div className="text-lg font-black">{taka(player.progress.lifetimeStats.totalRevenue, lang)}</div>
              </div>
              <div className="rounded-xl border-2 border-[#3B2314] bg-white p-3 text-center">
                <div className="text-xs font-bold text-[#6D4C41]">{lang === 'bn' ? 'বস পরাজিত' : 'Bosses Defeated'}</div>
                <div className="text-lg font-black">{digits(player.progress.lifetimeStats.bossesDefeated.length, lang)} / ৫</div>
              </div>
            </div>

            {/* 20 Achievements Grid */}
            <div className="rounded-2xl border-3 border-[#3B2314] bg-white p-4">
              <h3 className="text-base font-extrabold">
                🏅 {lang === 'bn' ? 'অর্জনসমূহ (Achievements)' : 'Achievements'} (
                {digits(player.achievements.filter((a) => a.unlocked).length, lang)}/{digits(ACHIEVEMENTS.length, lang)})
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ACHIEVEMENTS.map((def) => {
                  const st = player.achievements.find((a) => a.id === def.id) ?? {
                    progress: 0,
                    target: def.target,
                    unlocked: false,
                  };
                  const pct = Math.min(100, Math.round((st.progress / Math.max(1, def.target)) * 100));
                  return (
                    <div
                      key={def.id}
                      data-testid={`achievement-card-${def.id}`}
                      className={`rounded-xl border-2 p-3 ${
                        st.unlocked ? 'border-[#2E7D32] bg-[#E8F5E9]' : 'border-[#3B2314]/30 bg-[#FFF8E7]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{def.icon}</span>
                          <div>
                            <div className="text-xs font-extrabold">{pick(def.name, lang)}</div>
                            <div className="text-[11px] font-semibold text-[#6D4C41]">{pick(def.description, lang)}</div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-extrabold">
                          +{digits(def.reward.coins, lang)} 🪙
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                          <div className="h-full bg-[#2E7D32]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold">
                          {digits(st.progress, lang)}/{digits(def.target, lang)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SCREEN 9: CUSTOMIZATION SHOP ════════════════ */}
        {screen === 'customize' && (
          <div data-testid="customize-screen" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">🎨 {lang === 'bn' ? 'দোকান সাজান' : 'Shop Customization'}</h2>
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="rounded-xl border-2 border-[#3B2314] bg-white px-3 py-1 text-xs font-extrabold"
              >
                ← {lang === 'bn' ? 'হোম' : 'Home'}
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {CUSTOMIZATION_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`custom-tab-${cat.id}`}
                  onClick={() => setCustomTab(cat.id)}
                  className={`shrink-0 rounded-xl border-2 border-[#3B2314] px-3 py-1.5 text-xs font-extrabold ${
                    customTab === cat.id ? 'bg-[#C9462C] text-white' : 'bg-white text-[#3B2314]'
                  }`}
                >
                  {cat.icon} {pick(cat.name, lang)}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CUSTOMIZATION_ITEMS.filter((item) => item.category === customTab).map((item) => {
                const isUnlocked = player.progress.unlockedItems.includes(item.id);
                const isEquipped = player.progress.equippedItems[item.category] === item.id;
                const levelLocked = !isUnlocked && player.progress.highestLevel < item.unlockLevel;
                const canAfford = player.progress.coins >= item.costCoins;

                return (
                  <div
                    key={item.id}
                    data-testid={`custom-item-${item.id}`}
                    className={`flex flex-col justify-between rounded-2xl border-3 p-4 ${
                      isEquipped ? 'border-[#2E7D32] bg-[#E8F5E9]' : 'border-[#3B2314] bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-extrabold">{pick(item.name, lang)}</div>
                        <p className="mt-0.5 text-xs font-semibold text-[#6D4C41]">{pick(item.description, lang)}</p>
                      </div>
                      {item.category === 'outfit' ? (
                        <img
                          src={shopkeeperDataUrl(item.id, 'happy')}
                          alt=""
                          className="h-14 w-11 shrink-0 object-contain"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 shrink-0 rounded-xl border-2 border-[#3B2314]"
                          style={{ backgroundColor: item.style.primary }}
                        />
                      )}
                    </div>

                    <div className="mt-3">
                      {isEquipped ? (
                        <span className="block w-full rounded-xl border-2 border-[#2E7D32] bg-white py-1.5 text-center text-xs font-extrabold text-[#2E7D32]">
                          ✓ {lang === 'bn' ? 'ব্যবহৃত হচ্ছে' : 'Equipped'}
                        </span>
                      ) : isUnlocked ? (
                        <button
                          type="button"
                          onClick={() => handleCustomize(item.id)}
                          className="w-full rounded-xl border-2 border-[#3B2314] bg-[#F6C445] py-1.5 text-xs font-extrabold"
                        >
                          {lang === 'bn' ? 'ব্যবহার করুন' : 'Equip'}
                        </button>
                      ) : levelLocked ? (
                        <span className="block w-full rounded-xl border border-slate-300 bg-slate-100 py-1.5 text-center text-xs font-bold text-slate-500">
                          🔒 {lang === 'bn' ? `লেভেল ${digits(item.unlockLevel, 'bn')} প্রয়োজন` : `Requires Level ${item.unlockLevel}`}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => handleCustomize(item.id)}
                          className="w-full rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-1.5 text-xs font-extrabold text-white disabled:opacity-45"
                        >
                          🪙 {num(item.costCoins, lang)} — {lang === 'bn' ? 'কিনুন' : 'Unlock'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t-2 border-[#3B2314]/20 bg-[#F4E9D0] px-4 py-3 text-center text-xs font-bold text-[#6D4C41]">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/rules" className="hover:underline">
            {lang === 'bn' ? 'খেলার নিয়ম' : 'Game Rules'}
          </Link>
          <Link href="/privacy" className="hover:underline">
            {lang === 'bn' ? 'গোপনীয়তা নীতি' : 'Privacy Policy'}
          </Link>
          <Link href="/terms" className="hover:underline">
            {lang === 'bn' ? 'ব্যবহারের শর্তাবলি' : 'Terms of Use'}
          </Link>
          <a
            href={`${process.env.NEXT_PUBLIC_HELLOKHATA_URL || 'https://hellokhata.com'}?utm_source=dokaan_shamlao&utm_medium=footer`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('hello_khata_clicked', { placement: 'footer' })}
            className="text-[#0A9396] hover:underline"
          >
            HelloKhata.com
          </a>
        </div>
        <div className="mt-1 text-[11px] opacity-80">
          © Maple Service Solution Limited • দোকান সামলাও! (Dokaan Shamlao)
        </div>
      </footer>

      {/* ── SETTINGS MODAL ── */}
      {showSettingsModal && (
        <div
          data-testid="settings-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border-4 border-[#3B2314] bg-[#FFF8E7] p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">⚙️ {lang === 'bn' ? 'সেটিংস' : 'Settings'}</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg border border-[#3B2314] bg-white px-2.5 py-0.5 text-xs font-extrabold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border-2 border-[#3B2314] bg-white p-3 text-xs font-extrabold">
              <span>🔊 {lang === 'bn' ? 'সাউন্ড ইফেক্ট' : 'Sound Effects'}</span>
              <button
                type="button"
                onClick={() => updatePreferences({ sfxOn: !player.profile.sfxOn })}
                className={`rounded-lg border border-[#3B2314] px-3 py-1 ${
                  player.profile.sfxOn ? 'bg-[#2E7D32] text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {player.profile.sfxOn ? (lang === 'bn' ? 'চালু' : 'ON') : lang === 'bn' ? 'বন্ধ' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border-2 border-[#3B2314] bg-white p-3 text-xs font-extrabold">
              <span>🎵 {lang === 'bn' ? 'ব্যাকগ্রাউন্ড মিউজিক' : 'Background Music'}</span>
              <button
                type="button"
                onClick={() => updatePreferences({ musicOn: !player.profile.musicOn })}
                className={`rounded-lg border border-[#3B2314] px-3 py-1 ${
                  player.profile.musicOn ? 'bg-[#2E7D32] text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {player.profile.musicOn ? (lang === 'bn' ? 'চালু' : 'ON') : lang === 'bn' ? 'বন্ধ' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border-2 border-[#3B2314] bg-white p-3 text-xs font-extrabold">
              <span>🌐 {lang === 'bn' ? 'ভাষা (Language)' : 'Language'}</span>
              <button
                type="button"
                onClick={() => updatePreferences({ lang: lang === 'bn' ? 'en' : 'bn' })}
                className="rounded-lg border border-[#3B2314] bg-[#F6C445] px-3 py-1"
              >
                {lang === 'bn' ? 'বাংলা (Bangla)' : 'English'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full rounded-xl border-2 border-[#3B2314] bg-[#C9462C] py-2 text-xs font-extrabold text-white"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
