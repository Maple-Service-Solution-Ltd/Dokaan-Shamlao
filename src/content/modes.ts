/**
 * Game modes and the controlled random challenge generator.
 * `configFor` is the single entry point used by both the client and the server, so a run descriptor
 * (mode + seed) always expands to exactly the same playable configuration on both sides.
 */
import { Rng, mixSeed } from '@/core/rng';
import type { GameConfig, L10n } from '@/core/types';
import { applyChallenge, baseDraft, calibrate, finalize, selectProducts, validateConfig, withStars, CONTENT_VERSION } from './builder';
import { CHALLENGES, CHALLENGE_MAP, type ChallengeDef } from './challenges';
import { storyConfig } from './levels';

export type RunDescriptor =
  | { mode: 'story'; level: number }
  | { mode: 'endless'; seed: number }
  | { mode: 'time'; seed: number; secs: 60 | 120 }
  | { mode: 'survival'; seed: number }
  | { mode: 'daily'; date: string; seed: number }
  | { mode: 'friend'; code: string; seed: number };

function shell(id: string, mode: GameConfig['mode'], seed: number, title: L10n): GameConfig {
  return {
    id, mode, v: CONTENT_VERSION, seed, title, chapter: 3, difficulty: 5, durationTicks: 0, products: [], startCash: 800, stockPct: 100,
    customers: { count: 0, interval: 80, minInterval: 20, rampPct: 2, mix: { regular: 100 }, slots: 3, size: [1, 3], qty: [1, 2], patiencePct: 115 },
    payment: { exactPct: 40, mobilePct: 15 }, mods: {}, events: [], objectives: [], stars: [0, 0, 0], rewards: { coins: 0, xp: 0 }, challenges: [], tutorials: [],
  };
}

export function endlessConfig(seed: number): GameConfig {
  const cfg = shell('endless', 'endless', seed, { bn: 'অফুরন্ত', en: 'Endless' });
  cfg.products = selectProducts(60, [], true, seed);
  cfg.customers.mix = { regular: 40, impatient: 12, elderly: 6, child: 8, bulk: 6, forgetful: 6, confused: 5, kipta: 5, bargain: 6, vip: 3, family: 3 };
  cfg.mods = { restock: true, leadTicks: 80, lineCap: 5 };
  cfg.events = [
    { kind: 'stockout', at: 50, every: 700 }, { kind: 'crowd', at: 75, every: 650, n: 3 },
    { kind: 'expiry', at: 90, every: 1100 }, { kind: 'thief', at: 100, every: 1300 },
  ];
  cfg.objectives = [{ metric: 'served', op: '>=', target: 20, primary: false, label: 'obj.served' }];
  cfg.tutorials = ['mode:endless'];
  return cfg;
}

export function timeConfig(seed: number, secs: 60 | 120): GameConfig {
  const cfg = shell(`time:${secs}`, 'time', seed, secs === 60 ? { bn: 'টাইম অ্যাটাক ৬০', en: 'Time Attack 60' } : { bn: 'টাইম অ্যাটাক ১২০', en: 'Time Attack 120' });
  cfg.durationTicks = secs * 10;
  cfg.products = selectProducts(20, [], false, seed);
  cfg.stockPct = 1000;
  cfg.customers = { count: 0, interval: 36, minInterval: 30, rampPct: 0, mix: { regular: 70, impatient: 15, child: 15 }, slots: 3, size: [1, 2], qty: [1, 2], patiencePct: 130 };
  cfg.payment = { exactPct: 55, mobilePct: 10 };
  cfg.objectives = [{ metric: 'served', op: '>=', target: secs / 6, primary: false, label: 'obj.served' }];
  cfg.tutorials = ['mode:time'];
  return cfg;
}

export function survivalConfig(seed: number): GameConfig {
  const cfg = shell('survival', 'survival', seed, { bn: 'টিকে থাকো', en: 'Survival' });
  cfg.products = selectProducts(60, ['rain'], true, seed);
  cfg.startCash = 600;
  cfg.stockPct = 60;
  cfg.customers = { count: 0, interval: 75, minInterval: 28, rampPct: 2, mix: { regular: 50, impatient: 15, bulk: 8, kipta: 7, angry: 6, forgetful: 7, elderly: 7 }, slots: 3, size: [1, 3], qty: [1, 2], patiencePct: 110 };
  cfg.mods = { restock: true, leadTicks: 90, lineCap: 5 };
  cfg.events = [
    { kind: 'stockout', at: 25, every: 500 }, { kind: 'expense', at: 40, every: 600 }, { kind: 'leak', at: 50, every: 700 },
    { kind: 'crowd', at: 60, every: 450, n: 3 }, { kind: 'fridge', at: 70, every: 1800 }, { kind: 'loadShedding', at: 80, every: 900, n: 200 },
    { kind: 'powerFailure', at: 85, every: 1300, n: 250 }, { kind: 'thief', at: 90, every: 800 }, { kind: 'flood', at: 95, every: 1400, n: 3 },
    { kind: 'rain', at: 100, every: 1500, n: 400 },
  ];
  cfg.objectives = [{ metric: 'surviveSec', op: '>=', target: 120, primary: false, label: 'obj.surviveSec' }];
  cfg.tutorials = ['mode:survival'];
  return cfg;
}

/** Extra knobs the generator can add on top of challenge templates. */
export const MODIFIERS: { id: string; name: L10n; intervalPct?: number; patiencePct?: number; sizeAdd?: number; countAdd?: number; minDifficulty: number }[] = [
  { id: 'rush_hour', name: { bn: 'রাশ আওয়ার', en: 'Rush Hour' }, intervalPct: 75, minDifficulty: 3 },
  { id: 'big_baskets', name: { bn: 'বড় বাজার', en: 'Big Baskets' }, sizeAdd: 1, minDifficulty: 4 },
  { id: 'short_tempers', name: { bn: 'মেজাজ চড়া', en: 'Short Tempers' }, patiencePct: 85, minDifficulty: 5 },
  { id: 'busy_day', name: { bn: 'জমজমাট দিন', en: 'Busy Day' }, countAdd: 3, minDifficulty: 2 },
  { id: 'calm_day', name: { bn: 'শান্ত দিন', en: 'Calm Day' }, patiencePct: 120, minDifficulty: 1 },
];

export interface GenerateOptions {
  seed: number;
  /** Player progression expressed as the story level reached (decides which templates are eligible). */
  level: number;
  /** Target difficulty 1..10. */
  difficulty: number;
  id: string;
  mode: 'daily' | 'friend' | 'story';
  title: L10n;
  customers?: number;
}

function compatible(picked: ChallengeDef[], cand: ChallengeDef): boolean {
  if (picked.some((p) => p.id === cand.id)) return false;
  if (cand.category === 'seasonal' && picked.some((p) => p.category === 'seasonal')) return false;
  if (cand.category === 'skill' && picked.some((p) => p.category === 'skill')) return false;
  if (picked.filter((p) => p.category === cand.category).length >= 2) return false;
  for (const p of picked) {
    if (p.incompatible?.includes(cand.id) || cand.incompatible?.includes(p.id)) return false;
    // A challenge that closes the supplier cannot be combined with one that depends on restocking.
    if ((p.effects.lockRestock && cand.effects.mods?.restock) || (cand.effects.lockRestock && p.effects.mods?.restock)) return false;
    // Two different seasonal focus tags would fight over the same objective metric.
    if (p.effects.mods?.focusTag && cand.effects.mods?.focusTag) return false;
    if (p.objectives.some((o) => o.metric === 'tagUnits') && cand.objectives.some((o) => o.metric === 'tagUnits')) return false;
    const strictWaste = (d: ChallengeDef): boolean => d.objectives.some((o) => o.metric === 'waste' && o.op === '<=');
    const wasteful = ['three_supplier_race', 'fridge_breakdown', 'flood_warning', 'water_leakage', 'fire_alarm', 'delivery_inspection'];
    if ((strictWaste(p) && wasteful.includes(cand.id)) || (strictWaste(cand) && wasteful.includes(p.id))) return false;
  }
  return true;
}

/**
 * Controlled procedural generation:
 * progression → eligible templates → compatible selection → modifiers → resources/products →
 * structural validation → bot validation (must be winnable) → deterministic, playable config.
 */
export function generateChallenge(opts: GenerateOptions): GameConfig {
  const difficulty = Math.max(1, Math.min(10, opts.difficulty));
  const eligible = CHALLENGES.filter((c) => c.minLevel <= opts.level && (c.requires ?? []).every((r) => (CHALLENGE_MAP[r]?.minLevel ?? 999) <= opts.level));
  const want = difficulty <= 3 ? 1 : difficulty <= 6 ? 2 : 3;
  for (let attempt = 0; attempt < 12; attempt++) {
    const seed = mixSeed(opts.seed, 0x6e4, attempt);
    const r = new Rng(seed);
    const d = baseDraft(Math.max(6, Math.min(100, opts.level)), opts.id, seed);
    const cfg = d.cfg;
    cfg.mode = opts.mode;
    cfg.title = opts.title;
    cfg.difficulty = difficulty;
    cfg.guided = false;
    cfg.customers.count = opts.customers ?? Math.min(16, 8 + Math.floor(difficulty / 2));
    const picked: ChallengeDef[] = [];
    // Later attempts ask for less, so generation always converges on something playable.
    const target = Math.max(0, want - Math.floor(attempt / 4));
    const pool = r.shuffle([...eligible]);
    for (const cand of pool) {
      if (picked.length >= target) break;
      if (cand.difficulty > Math.ceil(difficulty / 2) + 1) continue;
      if (compatible(picked, cand)) picked.push(cand);
    }
    const intensity = Math.max(1, Math.min(3, 1 + Math.floor((difficulty - 1) / 4)));
    for (const p of picked) applyChallenge(d, p, intensity);
    const mods = MODIFIERS.filter((m) => m.minDifficulty <= difficulty);
    if (mods.length && attempt < 8) {
      const m = r.pick(mods);
      if (m.intervalPct) cfg.customers.interval = Math.floor((cfg.customers.interval * m.intervalPct) / 100);
      if (m.patiencePct) cfg.customers.patiencePct = Math.floor((cfg.customers.patiencePct * m.patiencePct) / 100);
      if (m.sizeAdd) cfg.customers.size = [cfg.customers.size[0], Math.min(4, cfg.customers.size[1] + m.sizeAdd)];
      if (m.countAdd) cfg.customers.count += m.countAdd;
      cfg.challenges.push(`mod:${m.id}`);
    }
    finalize(d);
    cfg.rewards = { coins: 40 + 10 * difficulty, xp: 60 + 10 * difficulty };
    if (validateConfig(cfg).length > 0) continue;
    const cal = calibrate(cfg);
    if (!cal.casualWon || !cal.skilledWon) continue;
    return withStars(cfg, cal.skilledScore);
  }
  // Fallback: an ordinary day with no special challenge is always winnable.
  const d = baseDraft(Math.max(6, Math.min(100, opts.level)), opts.id, mixSeed(opts.seed, 0xfa11));
  d.cfg.mode = opts.mode;
  d.cfg.title = opts.title;
  d.cfg.guided = false;
  finalize(d);
  return withStars(d.cfg, calibrate(d.cfg).skilledScore);
}

const DAY_NAMES: L10n[] = [
  { bn: 'রবিবারের চ্যালেঞ্জ', en: 'Sunday Challenge' }, { bn: 'সোমবারের চ্যালেঞ্জ', en: 'Monday Challenge' },
  { bn: 'মঙ্গলবারের চ্যালেঞ্জ', en: 'Tuesday Challenge' }, { bn: 'বুধবারের চ্যালেঞ্জ', en: 'Wednesday Challenge' },
  { bn: 'বৃহস্পতিবারের চ্যালেঞ্জ', en: 'Thursday Challenge' }, { bn: 'শুক্রবারের চ্যালেঞ্জ', en: 'Friday Challenge' },
  { bn: 'শনিবারের চ্যালেঞ্জ', en: 'Saturday Challenge' },
];

/** Every player gets the same daily challenge: the config depends only on the date and the server seed. */
export function dailyConfig(date: string, seed: number): GameConfig {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  // Friday and Saturday (the Bangladeshi weekend) are tougher.
  const difficulty = day === 5 || day === 6 ? 7 : 4 + (day % 3);
  return generateChallenge({ seed, level: 70, difficulty, id: `daily:${date}`, mode: 'daily', title: DAY_NAMES[day]!, customers: 12 });
}

export function friendConfig(code: string, seed: number): GameConfig {
  return generateChallenge({ seed, level: 45, difficulty: 5, id: `friend:${code}`, mode: 'friend', title: { bn: 'বন্ধুর চ্যালেঞ্জ', en: 'Friend Challenge' }, customers: 10 });
}

const memo = new Map<string, GameConfig>();

export function configFor(d: RunDescriptor): GameConfig {
  switch (d.mode) {
    case 'story': return storyConfig(d.level);
    case 'endless': return endlessConfig(d.seed);
    case 'time': return timeConfig(d.seed, d.secs);
    case 'survival': return survivalConfig(d.seed);
    case 'daily': {
      const key = `d:${d.date}:${d.seed}`;
      if (!memo.has(key)) memo.set(key, dailyConfig(d.date, d.seed));
      return memo.get(key)!;
    }
    case 'friend': {
      const key = `f:${d.code}:${d.seed}`;
      if (!memo.has(key)) memo.set(key, friendConfig(d.code, d.seed));
      return memo.get(key)!;
    }
  }
}

/** Leaderboard board key for a finished run (null = not ranked). */
export function boardFor(d: RunDescriptor): string | null {
  switch (d.mode) {
    case 'endless': return 'endless';
    case 'time': return `time${d.secs}`;
    case 'survival': return 'survival';
    case 'daily': return `daily:${d.date}`;
    case 'friend': return `friend:${d.code}`;
    default: return null;
  }
}
