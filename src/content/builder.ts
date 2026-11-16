/**
 * Turns challenge templates into playable GameConfigs.
 * Shared by the 100 story levels, the random challenge generator, and the server.
 */
import { hashString, Rng } from '@/core/rng';
import type { ArchetypeId, DemandTag, GameConfig, MetricKey, Modifiers, Objective } from '@/core/types';
import { Sim } from '@/core/sim';
import { botPlay, BOT_CASUAL, BOT_SKILLED, BOT_STEADY } from '@/core/bot';
import { ARCHETYPES } from './archetypes';
import { CHALLENGE_MAP, challenge, type ChallengeDef, type ObjectiveTemplate, type Scaled } from './challenges';
import { PRODUCTS, PRODUCT_MAP } from './products';

/** Bump when products, challenges or level data change in a way that affects simulation. */
export const CONTENT_VERSION = 1;

export interface Draft {
  cfg: GameConfig;
  templates: { t: ObjectiveTemplate; intensity: number }[];
  lockRestock: boolean;
  tags: DemandTag[];
  needsCold: boolean;
  extraTicks: number;
}

const pickScaled = (v: Scaled, intensity: number): number => (Array.isArray(v) ? v[Math.max(0, Math.min(2, intensity - 1))]! : v);

/** The difficulty curve: what an "ordinary day" looks like at a given story level. */
export function baseDraft(level: number, id: string, seed: number): Draft {
  const L = Math.max(1, Math.min(100, level));
  const count = L === 1 ? 3 : L === 2 ? 4 : Math.min(16, 5 + Math.floor(L / 8));
  const restock = L >= 21;
  const cfg: GameConfig = {
    id, mode: 'story', v: CONTENT_VERSION, seed, title: { bn: '', en: '' },
    chapter: Math.min(5, 1 + Math.floor((L - 1) / 20)), level: L, difficulty: Math.min(10, 1 + Math.floor((L - 1) / 11)),
    durationTicks: 0, products: [], startCash: 500 + 20 * L, stockPct: restock ? 100 : 1000,
    customers: {
      count, interval: Math.max(45, 105 - Math.floor((L * 6) / 10)), minInterval: 30, rampPct: 0, mix: { regular: 100 },
      slots: L < 5 ? 1 : L < 24 ? 2 : 3,
      size: L < 2 ? [1, 1] : L < 8 ? [1, 2] : L < 30 ? [1, 3] : L < 65 ? [2, 3] : [2, 4],
      qty: L < 4 ? [1, 1] : L < 35 ? [1, 2] : [1, 3],
      patiencePct: Math.max(85, 160 - Math.floor((L * 3) / 4)),
    },
    payment: { exactPct: L < 3 ? 100 : L < 7 ? 60 : 35, mobilePct: L >= 15 ? 15 : 0 },
    mods: restock ? { restock: true, leadTicks: 80 } : {},
    events: [], objectives: [], stars: [0, 0, 0], rewards: { coins: 20 + 3 * L, xp: 30 + 4 * L }, challenges: [], tutorials: [],
  };
  if (L <= 3) { cfg.guided = true; cfg.mods.noPatience = L === 1; }
  return { cfg, templates: [], lockRestock: false, tags: [], needsCold: false, extraTicks: 0 };
}

function mergeMods(target: Modifiers, src: Modifiers): void {
  for (const key of Object.keys(src) as (keyof Modifiers)[]) {
    const v = src[key];
    if (v === undefined) continue;
    if (key === 'demand') target.demand = { ...(target.demand ?? {}), ...(v as Modifiers['demand']) };
    else if (key === 'closing') target.closing = [...new Set([...(target.closing ?? []), ...(v as NonNullable<Modifiers['closing']>)])];
    else if (key === 'defects') target.defects = [...new Set([...(target.defects ?? []), ...(v as number[])])].sort();
    else if (key === 'leadTicks') target.leadTicks = Math.max(target.leadTicks ?? 0, v as number);
    else (target as Record<string, unknown>)[key] = v;
  }
}

export function applyChallenge(d: Draft, def: ChallengeDef, intensity: number): void {
  const e = def.effects;
  const cfg = d.cfg;
  const c = cfg.customers;
  for (const k of Object.keys(e.mix ?? {}) as ArchetypeId[]) c.mix[k] = (c.mix[k] ?? 0) + e.mix![k]!;
  if (e.guaranteed) {
    c.guaranteed = c.guaranteed ?? {};
    for (const k of Object.keys(e.guaranteed) as ArchetypeId[]) c.guaranteed[k] = Math.max(c.guaranteed[k] ?? 0, pickScaled(e.guaranteed[k]!, intensity));
  }
  if (e.mods) mergeMods(cfg.mods, e.mods);
  if (e.scaledMods) {
    for (const k of Object.keys(e.scaledMods) as (keyof NonNullable<typeof e.scaledMods>)[]) {
      const v = pickScaled(e.scaledMods[k]!, intensity);
      const cur = cfg.mods[k];
      // Limits take the stricter value, chances the higher one.
      cfg.mods[k] = cur === undefined ? v : k === 'supplierCartons' || k === 'maxMistakes' ? Math.min(cur, v) : Math.max(cur, v);
    }
  }
  if (e.changeHiddenFrom && intensity >= e.changeHiddenFrom) cfg.mods.changeHidden = true;
  for (const ev of e.events ?? []) {
    if (ev.from && intensity < ev.from) continue;
    cfg.events.push({ kind: ev.kind, at: ev.at, ...(ev.n !== undefined ? { n: pickScaled(ev.n, intensity) } : {}) });
  }
  if (e.patiencePct) c.patiencePct = Math.floor((c.patiencePct * e.patiencePct) / 100);
  if (e.intervalPct) c.interval = Math.floor((c.interval * e.intervalPct) / 100);
  if (e.startCashPct) cfg.startCash = Math.floor((cfg.startCash * e.startCashPct) / 500) * 5;
  if (e.stockPct) cfg.stockPct = Math.min(cfg.stockPct, e.stockPct);
  if (e.minSlots) c.slots = Math.max(c.slots, e.minSlots);
  if (e.lineCap) cfg.mods.lineCap = e.lineCap;
  if (e.exactPct !== undefined) cfg.payment.exactPct = Math.min(cfg.payment.exactPct, e.exactPct);
  if (e.mobilePct !== undefined) cfg.payment.mobilePct = e.mobilePct;
  if (e.lockRestock) d.lockRestock = true;
  if (def.needsTag) d.tags.push(def.needsTag);
  if (def.needsCold) d.needsCold = true;
  if (e.mods?.giftItem) d.tags.push('boishakh');
  d.extraTicks += def.durationSec * 10;
  for (const t of def.objectives) d.templates.push({ t, intensity });
  cfg.challenges.push(def.id);
  if (def.tutorial) cfg.tutorials.push(def.id);
  cfg.rewards.coins += def.rewards.coins;
  cfg.rewards.xp += def.rewards.xp;
}

/** Chooses which products are on the shelf: seasonal needs first, then staples, then variety. */
export function selectProducts(level: number, tags: DemandTag[], needsCold: boolean, seed: number, must: string[] = []): string[] {
  const pool = PRODUCTS.filter((p) => p.unlock <= level);
  const cap = level < 10 ? pool.length : Math.min(pool.length, 10 + Math.floor(level / 5));
  const chosen = new Set<string>(must.filter((id) => PRODUCT_MAP[id]));
  const perTab: Record<string, number> = {};
  const add = (id: string): boolean => {
    const p = PRODUCT_MAP[id]!;
    if (chosen.has(id)) return true;
    if ((perTab[p.tab] ?? 0) >= 12 || chosen.size >= Math.max(cap, must.length)) return false;
    chosen.add(id);
    perTab[p.tab] = (perTab[p.tab] ?? 0) + 1;
    return true;
  };
  for (const id of chosen) perTab[PRODUCT_MAP[id]!.tab] = (perTab[PRODUCT_MAP[id]!.tab] ?? 0) + 1;
  // Seasonal products come from the whole catalogue: a festival level stocks its festival goods.
  for (const tag of tags) {
    let n = 0;
    for (const p of PRODUCTS) if (p.tags?.includes(tag) && (p.unlock <= level || n < 4) && n < 7 && add(p.id)) n++;
  }
  if (needsCold) { let n = 0; for (const p of PRODUCTS) if (p.cold && n < 3 && add(p.id)) n++; }
  const staples = pool.slice().sort((a, b) => a.unlock - b.unlock);
  const half = Math.ceil(cap / 2);
  for (const p of staples) { if (chosen.size >= half) break; add(p.id); }
  const r = new Rng(seed ^ 0x51ed);
  for (const p of r.shuffle(pool.slice())) { if (chosen.size >= cap) break; add(p.id); }
  return PRODUCTS.filter((p) => chosen.has(p.id)).map((p) => p.id);
}

const SUMMED: MetricKey[] = ['decisionsGood'];

export function finalize(d: Draft): GameConfig {
  const cfg = d.cfg;
  const c = cfg.customers;
  if (d.lockRestock) cfg.mods.restock = false;
  if (cfg.mods.restock) cfg.stockPct = Math.min(cfg.stockPct, 100);
  cfg.products = selectProducts(cfg.level ?? 50, d.tags, d.needsCold, cfg.seed, cfg.mods.giftItem ? [cfg.mods.giftItem] : []);
  // Guaranteed archetypes must fit in the plan.
  const g = c.guaranteed ?? {};
  let need = 0;
  for (const k of Object.keys(g) as ArchetypeId[]) need += g[k]! * (k === 'repeat' ? 2 : 1);
  if (c.count > 0 && need + 1 > c.count) c.count = need + 2;
  const merged = new Map<string, Objective>();
  const put = (o: Objective): void => {
    const key = `${o.metric}|${o.op}`;
    const prev = merged.get(key);
    if (!prev) { merged.set(key, o); return; }
    if (SUMMED.includes(o.metric)) prev.target += o.target;
    else prev.target = o.op === '>=' ? Math.max(prev.target, o.target) : Math.min(prev.target, o.target);
    prev.primary = prev.primary || o.primary;
  };
  if (!cfg.boss && c.count > 0) {
    put({ metric: 'served', op: '>=', target: Math.max(1, Math.ceil((c.count * ((cfg.level ?? 50) < 10 ? 60 : 70)) / 100)), primary: true, label: 'obj.served' });
  }
  if (cfg.boss) put({ metric: 'bossDefeated', op: '>=', target: 1, primary: true, label: 'obj.bossDefeated' });
  for (const { t, intensity } of d.templates) {
    let target = pickScaled(t.target, intensity);
    if (t.scale === 'pct') target = Math.max(1, Math.floor((c.count * target) / 100));
    if (t.scale === 'each') target *= c.count;
    put({ metric: t.metric, op: t.op, target, primary: t.primary ?? true, label: `obj.${t.metric}` });
  }
  cfg.objectives = [...merged.values()];
  if (cfg.durationTicks === 0 && c.count > 0) {
    const perCustomer = c.interval + 70 + 25 * c.size[1] * c.qty[1];
    cfg.durationTicks = Math.floor(((c.count * perCustomer + 400 + d.extraTicks) * 8) / 100) * 10;
  }
  return cfg;
}

/** Structural validation: catches broken content before anyone plays it. Returns a list of problems. */
export function validateConfig(cfg: GameConfig): string[] {
  const errs: string[] = [];
  const c = cfg.customers;
  if (cfg.products.length === 0) errs.push('no products');
  for (const p of cfg.products) if (!PRODUCT_MAP[p]) errs.push(`unknown product ${p}`);
  if (new Set(cfg.products).size !== cfg.products.length) errs.push('duplicate products');
  for (const id of cfg.challenges) if (!id.startsWith('mod:') && !CHALLENGE_MAP[id]) errs.push(`unknown challenge ${id}`);
  for (const k of Object.keys(c.mix)) if (!ARCHETYPES[k as ArchetypeId]) errs.push(`unknown archetype ${k}`);
  if (c.slots < 1 || c.slots > 3) errs.push('slots out of range');
  if (c.size[0] < 1 || c.size[0] > c.size[1]) errs.push('bad order size range');
  if (c.qty[0] < 1 || c.qty[0] > c.qty[1]) errs.push('bad quantity range');
  let need = 0;
  for (const k of Object.keys(c.guaranteed ?? {}) as ArchetypeId[]) need += c.guaranteed![k]! * (k === 'repeat' ? 2 : 1);
  if (c.count > 0 && need > c.count) errs.push('guaranteed customers exceed plan');
  for (const e of cfg.events) if (e.at < 0 || e.at > 100) errs.push(`event ${e.kind} trigger out of range`);
  if (cfg.objectives.length === 0) errs.push('no objectives');
  for (const o of cfg.objectives) {
    if (o.metric === 'served' && c.count > 0 && o.target > c.count) errs.push('serve target exceeds customers');
    if (o.target < 0) errs.push(`negative target for ${o.metric}`);
  }
  if (!(cfg.stars[0] <= cfg.stars[1] && cfg.stars[1] <= cfg.stars[2])) errs.push('star thresholds not ascending');
  if (cfg.mods.giftItem && !cfg.products.includes(cfg.mods.giftItem)) errs.push('gift item not on shelf');
  if (cfg.mods.focusTag && !cfg.products.some((p) => PRODUCT_MAP[p]?.tags?.includes(cfg.mods.focusTag!))) errs.push('no products for focus tag');
  if (cfg.events.some((e) => e.kind === 'fridge') && !cfg.products.some((p) => PRODUCT_MAP[p]?.cold)) errs.push('fridge event without cold products');
  if (cfg.durationTicks < 0) errs.push('negative duration');
  if (cfg.mode === 'story' && !cfg.boss && c.count <= 0) errs.push('story level without customers');
  return errs;
}

export interface Calibration { casualWon: boolean; skilledWon: boolean; skilledScore: number; casualScore: number }

/**
 * Plays the config with the reference bots. A config is "playable" when the skilled bot wins it and
 * a slower reference player also wins: the casual bot (0.8s per tap) up to difficulty 6 / story level 60,
 * the steady bot (0.6s per tap) beyond that, where the game is meant to demand skill.
 */
export function calibrate(cfg: GameConfig): Calibration {
  const skilled = botPlay(new Sim(cfg), BOT_SKILLED).result!;
  const hard = cfg.mode === 'story' ? (cfg.level ?? 1) > 60 : cfg.difficulty > 6;
  const casual = botPlay(new Sim(cfg), hard ? BOT_STEADY : BOT_CASUAL).result!;
  return { casualWon: casual.won, skilledWon: skilled.won, skilledScore: skilled.score, casualScore: casual.score };
}

/** Star thresholds: 1★ = complete, 2★ = 50% and 3★ = 75% of the reference skilled score. */
export function withStars(cfg: GameConfig, skilledScore: number): GameConfig {
  cfg.stars = [0, Math.floor((skilledScore * 50) / 100), Math.floor((skilledScore * 75) / 100)];
  return cfg;
}

export { challenge, hashString };
