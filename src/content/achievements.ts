/**
 * Achievement definitions and deterministic progress evaluation.
 * Used by both client and server so achievement unlocks and rewards stay in sync.
 */
import type { GameConfig, L10n, RunResult } from '@/core/types';
import { CHALLENGE_MAP } from './challenges';

export interface LifetimeStats {
  totalServed: number;
  totalPerfect: number;
  totalRevenue: number;
  totalProfit: number;
  totalRestocks: number;
  totalCreditCollected: number;
  totalDecisionsGood: number;
  totalFakeCaught: number;
  totalShortCaught: number;
  bossesDefeated: string[];
  dailyWins: number;
  festivalWins: number;
  zeroWasteWins: number;
  noMistakeWins: number;
  hisabWins: number;
  speedWins: number;
  queueWins: number;
  bestEndlessServed: number;
  bestSurvivalSec: number;
  bestStreak: number;
  runsPlayed: number;
  runsWon: number;
}

export const EMPTY_LIFETIME_STATS: LifetimeStats = {
  totalServed: 0,
  totalPerfect: 0,
  totalRevenue: 0,
  totalProfit: 0,
  totalRestocks: 0,
  totalCreditCollected: 0,
  totalDecisionsGood: 0,
  totalFakeCaught: 0,
  totalShortCaught: 0,
  bossesDefeated: [],
  dailyWins: 0,
  festivalWins: 0,
  zeroWasteWins: 0,
  noMistakeWins: 0,
  hisabWins: 0,
  speedWins: 0,
  queueWins: 0,
  bestEndlessServed: 0,
  bestSurvivalSec: 0,
  bestStreak: 0,
  runsPlayed: 0,
  runsWon: 0,
};

export interface AchievementEvalContext {
  lifetime: LifetimeStats;
  /** Map of story level number ("1".."100") -> stars earned (1..3). */
  storyStars: Record<string, number>;
}

export interface AchievementDef {
  id: string;
  name: L10n;
  description: L10n;
  icon: string;
  target: number;
  reward: { coins: number; xp: number };
  progress: (ctx: AchievementEvalContext) => number;
}

const countStars = (storyStars: Record<string, number>, minStar = 1): number =>
  Object.values(storyStars).filter((s) => s >= minStar).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_sale',
    name: { bn: 'প্রথম বিক্রি', en: 'First Sale' },
    description: { bn: 'দোকানে প্রথম কাস্টমারকে সফলভাবে সামলান।', en: 'Serve your very first customer in the shop.' },
    icon: '🛍️',
    target: 1,
    reward: { coins: 25, xp: 30 },
    progress: ({ lifetime }) => Math.min(1, lifetime.totalServed),
  },
  {
    id: 'speed_master',
    name: { bn: 'স্পিড মাস্টার', en: 'Speed Master' },
    description: { bn: 'গড়ে ১০ সেকেন্ড বা কম সময়ে কাস্টমার সামলে একটি লেভেল জিতুন।', en: 'Win a level averaging 10 seconds or less per customer.' },
    icon: '⚡',
    target: 1,
    reward: { coins: 60, xp: 80 },
    progress: ({ lifetime }) => Math.min(1, lifetime.speedWins),
  },
  {
    id: 'hisab_master',
    name: { bn: 'হিসাব মাস্টার', en: 'Hisab Master' },
    description: { bn: 'এক টাকাও ক্যাশ গরমিল ছাড়া ৫টি লেভেল জিতুন।', en: 'Win 5 levels with zero cash mismatch.' },
    icon: '🧮',
    target: 5,
    reward: { coins: 80, xp: 100 },
    progress: ({ lifetime }) => Math.min(5, lifetime.hisabWins),
  },
  {
    id: 'customer_hero',
    name: { bn: 'কাস্টমার হিরো', en: 'Customer Hero' },
    description: { bn: 'এক নাগাড়ে ১০ জন কাস্টমারকে নিখুঁত সেবা দিন।', en: 'Achieve a streak of 10 perfect orders in a single run.' },
    icon: '🌟',
    target: 10,
    reward: { coins: 75, xp: 90 },
    progress: ({ lifetime }) => Math.min(10, lifetime.bestStreak),
  },
  {
    id: 'zero_waste',
    name: { bn: 'শূন্য অপচয়', en: 'Zero Waste' },
    description: { bn: 'কোনো মাল নষ্ট না করে ৫টি লেভেল জিতুন।', en: 'Win 5 levels without wasting a single unit of stock.' },
    icon: '♻️',
    target: 5,
    reward: { coins: 70, xp: 80 },
    progress: ({ lifetime }) => Math.min(5, lifetime.zeroWasteWins),
  },
  {
    id: 'credit_collector',
    name: { bn: 'বাকি আদায়কারী', en: 'Credit Collector' },
    description: { bn: 'বাকিদারদের কাছ থেকে মোট ৳১,০০০ বাকি আদায় করুন।', en: 'Collect a total of ৳1,000 in outstanding credit dues.' },
    icon: '📒',
    target: 1000,
    reward: { coins: 90, xp: 110 },
    progress: ({ lifetime }) => Math.min(1000, lifetime.totalCreditCollected),
  },
  {
    id: 'market_legend',
    name: { bn: 'বাজারের কিংবদন্তি', en: 'Market Legend' },
    description: { bn: 'মোট ৳২৫,০০০ মূল্যের পণ্য বিক্রি করুন।', en: 'Reach ৳25,000 in lifetime shop sales.' },
    icon: '🏆',
    target: 25000,
    reward: { coins: 150, xp: 200 },
    progress: ({ lifetime }) => Math.min(25000, lifetime.totalRevenue),
  },
  {
    id: 'boss_slayer',
    name: { bn: 'বস বিজয়ী', en: 'Boss Slayer' },
    description: { bn: '৫ জন ভিন্ন বসকেই পরাজিত করুন।', en: 'Defeat all 5 distinct boss characters.' },
    icon: '⚔️',
    target: 5,
    reward: { coins: 200, xp: 250 },
    progress: ({ lifetime }) => Math.min(5, new Set(lifetime.bossesDefeated).size),
  },
  {
    id: 'shop_king',
    name: { bn: 'দোকান সম্রাট', en: 'Shop King' },
    description: { bn: 'স্টোরি মোডের সব ১০০টি লেভেল সম্পন্ন করুন।', en: 'Complete all 100 levels in Story Mode.' },
    icon: '👑',
    target: 100,
    reward: { coins: 500, xp: 600 },
    progress: ({ storyStars }) => Math.min(100, countStars(storyStars, 1)),
  },
  {
    id: 'perfect_order',
    name: { bn: 'নিখুঁত অর্ডার', en: 'Perfect Order' },
    description: { bn: 'মোট ২৫টি অর্ডার কোনো ভুল ছাড়াই সম্পন্ন করুন।', en: 'Complete 25 orders without a single mistake.' },
    icon: '✨',
    target: 25,
    reward: { coins: 50, xp: 60 },
    progress: ({ lifetime }) => Math.min(25, lifetime.totalPerfect),
  },
  {
    id: 'no_mistakes',
    name: { bn: 'ভুলহীন দিন', en: 'No Mistakes' },
    description: { bn: 'একটিও ভুল না করে ৩টি লেভেল জিতুন।', en: 'Win 3 levels with zero mistakes.' },
    icon: '🎯',
    target: 3,
    reward: { coins: 70, xp: 90 },
    progress: ({ lifetime }) => Math.min(3, lifetime.noMistakeWins),
  },
  {
    id: 'daily_champion',
    name: { bn: 'ডেইলি চ্যাম্পিয়ন', en: 'Daily Champion' },
    description: { bn: 'ডেইলি চ্যালেঞ্জে জিতুন।', en: 'Win a Daily Challenge.' },
    icon: '📅',
    target: 1,
    reward: { coins: 80, xp: 100 },
    progress: ({ lifetime }) => Math.min(1, lifetime.dailyWins),
  },
  {
    id: 'queue_master',
    name: { bn: 'লাইন মাস্টার', en: 'Queue Master' },
    description: { bn: 'একজনও কাস্টমার না হারিয়ে ১০+ কাস্টমারের লেভেল জিতুন।', en: 'Win a level with 10+ customers served and zero customers lost.' },
    icon: '🚶',
    target: 1,
    reward: { coins: 75, xp: 90 },
    progress: ({ lifetime }) => Math.min(1, lifetime.queueWins),
  },
  {
    id: 'supplier_expert',
    name: { bn: 'মহাজন বিশেষজ্ঞ', en: 'Supplier Expert' },
    description: { bn: 'মহাজনের কাছ থেকে মোট ২০ কার্টন মাল তুলুন।', en: 'Order and restock 20 cartons from suppliers.' },
    icon: '🚚',
    target: 20,
    reward: { coins: 80, xp: 100 },
    progress: ({ lifetime }) => Math.min(20, lifetime.totalRestocks),
  },
  {
    id: 'survival_expert',
    name: { bn: 'টিকে থাকার ওস্তাদ', en: 'Survival Expert' },
    description: { bn: 'টিকে থাকো (Survival) মোডে ১৮০ সেকেন্ড টিকে থাকুন।', en: 'Survive for 180 seconds in Survival Mode.' },
    icon: '🛡️',
    target: 180,
    reward: { coins: 120, xp: 150 },
    progress: ({ lifetime }) => Math.min(180, lifetime.bestSurvivalSec),
  },
  {
    id: 'orders_100',
    name: { bn: '১০০ অর্ডার', en: '100 Orders' },
    description: { bn: 'মোট ১০০ জন কাস্টমারকে সেবা দিন।', en: 'Serve 100 customers across all modes.' },
    icon: '💯',
    target: 100,
    reward: { coins: 100, xp: 120 },
    progress: ({ lifetime }) => Math.min(100, lifetime.totalServed),
  },
  {
    id: 'orders_500',
    name: { bn: '৫০০ অর্ডার', en: '500 Orders' },
    description: { bn: 'মোট ৫০০ জন কাস্টমারকে সেবা দিন।', en: 'Serve 500 customers across all modes.' },
    icon: '🏪',
    target: 500,
    reward: { coins: 250, xp: 300 },
    progress: ({ lifetime }) => Math.min(500, lifetime.totalServed),
  },
  {
    id: 'festival_champion',
    name: { bn: 'উৎসব চ্যাম্পিয়ন', en: 'Festival Champion' },
    description: { bn: 'রমজান, ঈদ, বৈশাখ বা পূজার ৫টি মৌসুমি চ্যালেঞ্জ জিতুন।', en: 'Win 5 seasonal festival challenges.' },
    icon: '🎉',
    target: 5,
    reward: { coins: 100, xp: 130 },
    progress: ({ lifetime }) => Math.min(5, lifetime.festivalWins),
  },
  {
    id: 'three_star_collector',
    name: { bn: 'তিন-তারা সংগ্রাহক', en: 'Three-Star Collector' },
    description: { bn: 'স্টোরি মোডে ২৫টি লেভেলে ৩ তারা (★★★) অর্জন করুন।', en: 'Earn 3 stars on 25 Story Mode levels.' },
    icon: '⭐',
    target: 25,
    reward: { coins: 180, xp: 220 },
    progress: ({ storyStars }) => Math.min(25, countStars(storyStars, 3)),
  },
  {
    id: 'endless_survivor',
    name: { bn: 'অফুরন্ত যোদ্ধা', en: 'Endless Survivor' },
    description: { bn: 'অফুরন্ত (Endless) মোডে এক রানে ৩০ জন কাস্টমার সামলান।', en: 'Serve 30 customers in a single Endless Mode run.' },
    icon: '♾️',
    target: 30,
    reward: { coins: 130, xp: 160 },
    progress: ({ lifetime }) => Math.min(30, lifetime.bestEndlessServed),
  },
];

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** Apply a completed run to the player's lifetime statistics (pure function). */
export function mergeRunIntoLifetime(prev: LifetimeStats, cfg: GameConfig, res: RunResult): LifetimeStats {
  const s = res.stats;
  const next: LifetimeStats = {
    ...prev,
    bossesDefeated: [...prev.bossesDefeated],
    totalServed: prev.totalServed + s.served,
    totalPerfect: prev.totalPerfect + s.perfect,
    totalRevenue: prev.totalRevenue + s.revenue,
    totalProfit: prev.totalProfit + Math.max(0, res.profit),
    totalRestocks: prev.totalRestocks + s.restocks,
    totalCreditCollected: prev.totalCreditCollected + s.creditCollected,
    totalDecisionsGood: prev.totalDecisionsGood + s.decisionsGood,
    totalFakeCaught: prev.totalFakeCaught + s.fakeCaught,
    totalShortCaught: prev.totalShortCaught + s.shortCaught,
    bestStreak: Math.max(prev.bestStreak, s.bestStreak),
    runsPlayed: prev.runsPlayed + 1,
    runsWon: prev.runsWon + (res.won ? 1 : 0),
  };

  if (cfg.mode === 'endless') {
    next.bestEndlessServed = Math.max(prev.bestEndlessServed, s.served);
  }
  if (cfg.mode === 'survival') {
    const sec = Math.floor(res.ticks / 10);
    next.bestSurvivalSec = Math.max(prev.bestSurvivalSec, sec);
  }
  if (res.won) {
    if (cfg.mode === 'daily') next.dailyWins += 1;
    if (cfg.boss && res.reason === 'bossDefeated' && !next.bossesDefeated.includes(cfg.boss.id)) {
      next.bossesDefeated.push(cfg.boss.id);
    }
    const isSeasonal = cfg.challenges.some((cid) => CHALLENGE_MAP[cid]?.category === 'seasonal');
    if (isSeasonal) next.festivalWins += 1;
    if (s.served >= 3 && s.waste === 0) next.zeroWasteWins += 1;
    if (s.served >= 3 && s.mistakes === 0) next.noMistakeWins += 1;
    if (s.served >= 3 && s.mismatch === 0) next.hisabWins += 1;
    const avgSec = s.served > 0 ? Math.ceil(s.serveTicks / s.served / 10) : 999;
    if (s.served >= 3 && avgSec <= 10) next.speedWins += 1;
    if (s.served >= 10 && s.lost === 0) next.queueWins += 1;
  }

  return next;
}

export interface AchievementStatus {
  id: string;
  progress: number;
  target: number;
  unlocked: boolean;
  newlyUnlocked: boolean;
}

/** Evaluates all achievements and returns status + newly unlocked IDs. */
export function evaluateAchievements(
  ctx: AchievementEvalContext,
  alreadyUnlocked: string[],
): { statuses: AchievementStatus[]; newlyUnlocked: AchievementDef[] } {
  const unlockedSet = new Set(alreadyUnlocked);
  const statuses: AchievementStatus[] = [];
  const newlyUnlocked: AchievementDef[] = [];

  for (const def of ACHIEVEMENTS) {
    const raw = def.progress(ctx);
    const progress = Math.max(0, Math.min(def.target, raw));
    const wasUnlocked = unlockedSet.has(def.id);
    const unlocked = wasUnlocked || progress >= def.target;
    const isNew = !wasUnlocked && unlocked;
    if (isNew) newlyUnlocked.push(def);
    statuses.push({ id: def.id, progress, target: def.target, unlocked, newlyUnlocked: isNew });
  }

  return { statuses, newlyUnlocked };
}
