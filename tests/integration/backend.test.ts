import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import { Sim } from '@/core/sim';
import { botPlay, BOT_SKILLED } from '@/core/bot';
import { generatePlayerToken, sanitizeDisplayName } from '@/server/auth';
import {
  createFriendChallenge,
  customizeShop,
  getDailyChallengeInfo,
  getFriendChallenge,
  getLeaderboard,
  getOrCreatePlayer,
  recordAnalyticsEvent,
  startGameSession,
  submitGameSession,
  updatePlayerProfile,
} from '@/server/service';

describe('Backend Integration: Anonymous Auth, Sessions, Replay Validation, Leaderboards & Customization', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('bootstraps an anonymous player, moderates display names, and persists profile updates', async () => {
    const token = generatePlayerToken();
    const initial = await getOrCreatePlayer(token);
    expect(initial.playerId).toBeTruthy();
    expect(initial.accountCode).toMatch(/^HK-/);
    expect(initial.progress.coins).toBe(100);
    expect(initial.progress.highestLevel).toBe(1);

    // Moderation strips phone numbers and emails
    expect(sanitizeDisplayName('test@example.com')).toBe('দোকানদার');
    expect(sanitizeDisplayName('01711223344')).toBe('দোকানদার');
    expect(sanitizeDisplayName('রহিম ভাই')).toBe('রহিম ভাই');

    const updated = await updatePlayerProfile(token, {
      displayName: 'রহিম স্টোর',
      district: 'dhaka',
      avatar: 'chacha',
      lang: 'bn',
    });
    expect(updated.profile.displayName).toBe('রহিম স্টোর');
    expect(updated.profile.district).toBe('dhaka');
    expect(updated.profile.avatar).toBe('chacha');
  });

  it('starts a Story Mode session, validates a real replay submission, unlocks Level 2, and blocks duplicate submissions', async () => {
    const token = generatePlayerToken();
    await getOrCreatePlayer(token);

    const sess = await startGameSession(token, { mode: 'story', level: 1 });
    expect(sess.sessionId).toBeTruthy();
    expect(sess.config.level).toBe(1);

    const played = botPlay(new Sim(sess.config), BOT_SKILLED);
    expect(played.result?.won).toBe(true);

    const sub = await submitGameSession(token, {
      sessionId: sess.sessionId,
      log: played.log,
      endTick: played.tick,
      quit: false,
    });
    expect(sub.ok).toBe(true);
    expect(sub.result?.won).toBe(true);
    expect(sub.result?.stars).toBeGreaterThanOrEqual(1);
    expect(sub.player?.progress.highestLevel).toBe(2);
    expect(sub.player?.progress.coins).toBeGreaterThan(100);
    expect(sub.rewardsGranted?.achievementsUnlocked.some((a) => a.id === 'first_sale')).toBe(true);

    // Duplicate submission of the same session must be rejected
    const dup = await submitGameSession(token, {
      sessionId: sess.sessionId,
      log: played.log,
      endTick: played.tick,
      quit: false,
    });
    expect(dup.ok).toBe(false);
    expect(dup.error).toBe('duplicate_submission');
  });

  it('rejects tampered or impossible action logs during score validation', async () => {
    const token = generatePlayerToken();
    const sess = await startGameSession(token, { mode: 'story', level: 2 });

    const badSub = await submitGameSession(token, {
      sessionId: sess.sessionId,
      log: [[1, 4, 0, 0]], // Illegal Collect action at tick 1 when no customer is paying
      endTick: 10,
      quit: false,
    });
    expect(badSub.ok).toBe(false);
    expect(badSub.error).toBe('illegal_action');
  });

  it('provides consistent Daily Challenge seeds (Asia/Dhaka) and ranks scores on Daily, Weekly, All-Time & District boards', async () => {
    const token1 = generatePlayerToken();
    const token2 = generatePlayerToken();
    await updatePlayerProfile(token1, { displayName: 'করিম ভাই', district: 'sylhet' });
    await updatePlayerProfile(token2, { displayName: 'সালমা আপা', district: 'dhaka' });

    const d1 = await getDailyChallengeInfo(token1, '2026-11-16');
    const d2 = await getDailyChallengeInfo(token2, '2026-11-16');
    expect(d1.seed).toBe(d2.seed);
    expect(d1.config.id).toBe('daily:2026-11-16');

    const sess = await startGameSession(token1, { mode: 'daily', date: '2026-11-16' });
    const played = botPlay(new Sim(sess.config), BOT_SKILLED);
    const sub = await submitGameSession(token1, {
      sessionId: sess.sessionId,
      log: played.log,
      endTick: played.tick,
      quit: false,
    });
    expect(sub.ok).toBe(true);
    expect(sub.leaderboardRank).toBe(1);

    const dailyBoard = await getLeaderboard({ scope: 'daily', date: '2026-11-16' });
    expect(dailyBoard.entries.length).toBeGreaterThanOrEqual(1);
    expect(dailyBoard.entries[0]?.displayName).toBe('করিম ভাই');

    const sylhetBoard = await getLeaderboard({ scope: 'daily', date: '2026-11-16', district: 'sylhet' });
    expect(sylhetBoard.entries.some((e) => e.displayName === 'করিম ভাই')).toBe(true);
  });

  it('creates and retrieves Friend Challenges and handles Shop Customization unlocking', async () => {
    const token = generatePlayerToken();
    // Play levels 1..5 to unlock level-5 customization item and earn coins
    for (let lvl = 1; lvl <= 5; lvl++) {
      const s = await startGameSession(token, { mode: 'story', level: lvl });
      const run = botPlay(new Sim(s.config), BOT_SKILLED);
      await submitGameSession(token, {
        sessionId: s.sessionId,
        log: run.log,
        endTick: run.tick,
        quit: false,
      });
    }

    const cust = await customizeShop(token, 'sign_doa');
    expect(cust.ok).toBe(true);
    expect(cust.player?.progress.equippedItems.sign).toBe('sign_doa');

    const fc = await createFriendChallenge(token, { creatorScore: 2500 });
    expect(fc.code).toHaveLength(6);
    const fetched = await getFriendChallenge(fc.code);
    expect(fetched?.code).toBe(fc.code);
    expect(fetched?.seed).toBe(fc.seed);

    await recordAnalyticsEvent(token, 'hello_khata_clicked', { placement: 'test' });
  });
});
