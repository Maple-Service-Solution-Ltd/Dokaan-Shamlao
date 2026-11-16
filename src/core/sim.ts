/**
 * Deterministic shop simulation. No rendering, no timers, no Math.random:
 * the same config + seed + action log always produces the same result,
 * which lets the server replay a run to validate its score.
 */
import { Rng, mixSeed } from './rng';
import {
  Act, DENOMS, TICKS_PER_SEC,
  type ActionTuple, type ArchetypeId, type Customer, type CustomerState, type Decision, type Delivery, type EndReason,
  type FlagName, type GameConfig, type Hotspot, type MetricKey, type ObjectiveResult, type OrderLine, type RunResult,
  type SimEvent, type StatKey, type Stats, type TimelineEvent,
} from './types';
import { PRODUCT_MAP } from '@/content/products';
import { ARCHETYPES } from '@/content/archetypes';
import { startDecisionFor, resolveDecision, bossMove, closingDecision, billTotal, giveCredit } from './decisions';
import { fireTimeline, tapHotspot, expireHotspot, tickTimers } from './events';

const TRANSITIONS: Record<CustomerState, CustomerState[]> = {
  entering: ['waiting'],
  waiting: ['ordering', 'deciding', 'complaining', 'lostPatience', 'leaving'],
  ordering: ['deciding', 'paying', 'lostPatience', 'leaving', 'satisfied', 'angry', 'complaining'],
  deciding: ['ordering', 'paying', 'satisfied', 'angry', 'leaving', 'lostPatience', 'complaining'],
  paying: ['deciding', 'satisfied', 'angry', 'lostPatience', 'leaving'],
  complaining: ['ordering', 'satisfied', 'angry', 'leaving', 'lostPatience'],
  satisfied: ['leaving'],
  angry: ['leaving'],
  lostPatience: ['leaving'],
  leaving: ['gone'],
  gone: [],
};

export function canTransition(from: CustomerState, to: CustomerState): boolean {
  return TRANSITIONS[from].includes(to);
}

const STAT_KEYS: StatKey[] = [
  'served', 'lost', 'taps', 'wrongTaps', 'perfect', 'maxCombo', 'streak', 'bestStreak', 'units', 'revenue', 'cogs',
  'expenses', 'supplierSpend', 'supplierBase', 'creditGiven', 'creditCollected', 'creditOutstanding', 'waste',
  'wasteValue', 'mismatch', 'decisionsGood', 'decisionsBad', 'mistakes', 'satSum', 'fastServes', 'fastPays',
  'changeGiven', 'fakeCaught', 'shortCaught', 'hotspotsDone', 'hotspotsMissed', 'stolen', 'bossHits', 'strikes',
  'bulkServed', 'serveTicks', 'bookingsDone', 'bookingsFailed', 'restocks', 'apologies', 'vipServed', 'secretStars',
  'debtPaid', 'debtFailed', 'overLimit', 'tagUnits', 'deferred', 'cashSales', 'collected', 'paidOut', 'tips',
];

export const BASE_PATIENCE = 300;
const ENTER_TICKS = 6;
const EXIT_TICKS = 9;
export const TILL_START = [1, 3, 2, 3, 4, 4];
export const TILL_REFILL = [1, 5, 4, 5, 6, 6];

export const round5 = (n: number): number => Math.floor(n / 5) * 5;

interface Debtor { amount: number; trust: number; due: number; }
interface Special { tick: number; arch: ArchetypeId; debt?: number; lines?: { p: string; qty: number }[]; advance?: number; }

export class Sim {
  readonly cfg: GameConfig;
  tick = 0;
  ended = false;
  result: RunResult | null = null;

  cash: number;
  stock: Record<string, number> = {};
  hidden: Record<string, number> = {};
  sell: Record<string, number> = {};
  buy: Record<string, number> = {};
  buyPct: Record<string, number> = {};
  discount: Record<string, number> = {};
  expiring: Record<string, { units: number; at: number }> = {};
  damaged: Record<string, number> = {};
  priceRaised: Record<string, boolean> = {};
  noRestockUntil: Record<string, number> = {};
  forceProduct: { p: string; left: number } | null = null;
  focusP = '';

  customers: Customer[] = [];
  line: Customer[] = [];
  spawned = 0;
  processed = 0;
  nextSpawnTick = 12;
  burst = 0;
  selected = -1;
  specials: Special[] = [];

  decisions: Decision[] = [];
  hotspots: Hotspot[] = [];
  deliveries: Delivery[] = [];
  flagUntil: Record<FlagName, number> = { dark: 0, rain: 0, outage: 0, powerOut: 0, fridge: 0, closed: 0, fire: 0 };
  till: number[] | null = null;
  cartonsLeft = -1;
  restockCount = 0;
  spoilAt = 0;
  fridgeFixAt = 0;
  deferred = 0;
  debtors: Debtor[] = [];
  repeatOrders: Record<number, { lines: { p: string; qty: number }[]; look: string }> = {};
  repeatSeen = 0;
  /** Credit King boss: his running tab. */
  kingOut = 0;

  score = 0;
  combo = 0;
  reputation = 100;
  stats: Stats;
  boss: { hp: number; strikes: number; nextMove: number; phase: number; moves: number } | null = null;
  closingStage = 0;
  closingQueue: ('closing' | 'profit' | 'ledger')[] = [];

  /** Events for the view; drained by whoever renders. */
  out: SimEvent[] = [];
  private nextId = 1;
  private plan: ArchetypeId[] = [];
  private timeline: { ev: TimelineEvent; idx: number; fired: number; next: number }[] = [];
  /** Recorded actions (the replay log). */
  log: ActionTuple[] = [];

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.cash = cfg.startCash;
    this.stats = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as unknown as Stats;
    this.stats.arch = {};
    for (const id of cfg.products) {
      const p = PRODUCT_MAP[id];
      if (!p) throw new Error(`Config references unknown product ${id}`);
      this.stock[id] = Math.max(1, Math.floor((p.initStock * cfg.stockPct) / 100));
      this.sell[id] = p.sell;
      this.buy[id] = p.buy;
      this.buyPct[id] = 100;
    }
    const m = cfg.mods;
    if (m.limitedTill) this.till = [...TILL_START];
    if (m.supplierCartons) this.cartonsLeft = m.supplierCartons;
    this.buildPlan();
    cfg.events.forEach((ev, idx) => this.timeline.push({ ev, idx, fired: 0, next: this.eventTick(ev) }));
    if (m.hiddenStock) {
      const r = new Rng(mixSeed(cfg.seed, 0x41d));
      const picks = r.shuffle([...cfg.products]).slice(0, Math.min(3, cfg.products.length));
      for (const id of picks) {
        const move = Math.floor((this.stock[id]! * 4) / 5);
        this.hidden[id] = move;
        this.stock[id]! -= move;
      }
      this.addHotspot({ kind: 'search', until: 0, taps: 1 });
    }
    if (m.limitedTill) this.addHotspot({ kind: 'changeRun', until: 0, taps: 1 });
    if (cfg.boss) {
      this.boss = { hp: cfg.boss.hp, strikes: 0, nextMove: 40, phase: 0, moves: 0 };
      this.emit({ t: 'boss', what: 'intro' });
    }
  }

  // ───────────────────────── helpers ─────────────────────────
  emit(e: SimEvent): void { this.out.push(e); }
  id(): number { return this.nextId++; }
  rng(...salt: number[]): Rng { return new Rng(mixSeed(this.cfg.seed, ...salt)); }
  flag(name: FlagName): boolean { return this.tick < this.flagUntil[name]; }
  setFlag(name: FlagName, ticks: number): void {
    const was = this.flag(name);
    this.flagUntil[name] = ticks <= 0 ? 0 : this.tick + ticks;
    if (was !== ticks > 0) this.emit({ t: 'flag', name, on: ticks > 0 });
  }
  cust(id: number): Customer | undefined { return this.customers.find((c) => c.id === id); }
  get current(): Customer | undefined { return this.cust(this.selected); }
  get decision(): Decision | undefined { return this.decisions[0]; }
  finite(): boolean { return this.cfg.customers.count > 0; }

  /** Units of a product already promised to customers' bags. */
  reserved(p: string, except?: Customer): number {
    let n = 0;
    for (const c of this.customers) {
      if (c === except) continue;
      for (const l of c.order) if (l.p === p) n += l.got;
    }
    return n;
  }
  available(p: string): number { return (this.stock[p] ?? 0) - this.reserved(p); }
  unitPrice(p: string): number {
    const d = this.discount[p] ?? 0;
    return Math.max(5, round5((this.sell[p]! * (100 - d)) / 100));
  }
  cartonCost(p: string): number {
    const def = PRODUCT_MAP[p]!;
    return Math.max(5, round5((this.buy[p]! * def.carton * this.buyPct[p]!) / 100));
  }
  addPoints(n: number, why: string): void {
    if (n === 0) return;
    this.score = Math.max(0, this.score + n);
    this.emit({ t: 'points', n, why });
  }
  addRep(n: number): void { this.reputation = Math.max(0, Math.min(100, this.reputation + n)); }
  addCash(delta: number): void {
    if (delta === 0) return;
    this.cash += delta;
    this.emit({ t: 'cash', delta });
  }
  payExpense(amount: number): void {
    this.addCash(-amount);
    this.stats.expenses += amount;
    this.stats.paidOut += amount;
  }
  wasteUnits(p: string, units: number): void {
    const n = Math.max(0, Math.min(units, this.stock[p] ?? 0));
    if (n <= 0) return;
    this.stock[p]! -= n;
    this.stats.waste += n;
    this.stats.wasteValue += n * this.buy[p]!;
    this.emit({ t: 'stock', p });
  }
  addHotspot(h: Partial<Hotspot> & { kind: Hotspot['kind'] }): Hotspot {
    const hs: Hotspot = { id: this.id(), born: this.tick, until: 0, taps: 1, pos: (this.id() * 379) % 1000, ...h };
    this.hotspots.push(hs);
    this.emit({ t: 'hotspot', id: hs.id });
    return hs;
  }
  expectedCash(): number {
    const s = this.stats;
    return this.cfg.startCash + s.cashSales + s.collected - s.supplierSpend - s.paidOut;
  }
  mismatch(): number { return Math.abs(this.expectedCash() - this.cash); }
  profit(): number {
    const s = this.stats;
    return s.revenue - s.cogs - s.expenses - s.wasteValue;
  }

  // ───────────────────────── customer plan ─────────────────────────
  private buildPlan(): void {
    const c = this.cfg.customers;
    if (c.count <= 0) return;
    const r = this.rng(0x91a7);
    const mix = Object.keys(c.mix).length ? c.mix : { regular: 1 };
    for (let i = 0; i < c.count; i++) this.plan.push(r.weighted(mix));
    const g = c.guaranteed ?? {};
    const locked = new Set<number>();
    for (const arch of (Object.keys(g) as ArchetypeId[]).sort()) {
      const need = (g[arch] ?? 0) * (arch === 'repeat' ? 2 : 1);
      let have = 0;
      this.plan.forEach((a, i) => { if (a === arch) { have++; locked.add(i); } });
      let guard = 0;
      while (have < need && locked.size < this.plan.length && guard++ < 500) {
        // Never put a special behaviour on the very first customer; give the player a warm-up.
        const i = r.range(Math.min(1, this.plan.length - 1), this.plan.length - 1);
        if (locked.has(i)) continue;
        this.plan[i] = arch;
        locked.add(i);
        have++;
      }
    }
    // Repeat customers come in pairs (first visit, then "same as before").
    const reps = this.plan.map((a, i) => (a === 'repeat' ? i : -1)).filter((i) => i >= 0);
    if (reps.length % 2 === 1) this.plan[reps[reps.length - 1]!] = 'regular';
  }

  private eventTick(ev: TimelineEvent): number {
    // Finite plans key events to customer progress; open-ended modes use the clock.
    if (this.finite()) return -1;
    const base = this.cfg.durationTicks > 0 ? this.cfg.durationTicks : 1200;
    return Math.max(1, Math.floor((base * ev.at) / 100));
  }

  private spawnInterval(idx: number): number {
    const c = this.cfg.customers;
    let iv = this.cfg.boss?.id === 'storm' && this.boss
      ? this.cfg.boss.phases[this.boss.phase]!.every
      : Math.max(
        // In open-ended modes the floor itself keeps sinking, so every run eventually ends.
        this.finite() || c.rampPct <= 0 ? c.minInterval : Math.max(8, c.minInterval - Math.floor(idx / 12)),
        c.interval - Math.floor((c.interval * c.rampPct * idx) / 100),
      );
    if (this.flag('rain')) iv = Math.floor((iv * 14) / 10);
    const r = this.rng(0x1e7, idx);
    return Math.max(4, Math.floor((iv * r.range(80, 120)) / 100));
  }

  makeCustomer(idx: number, special?: Special): Customer {
    const cfg = this.cfg;
    const r = this.rng(0xc0ffee, idx, special ? 7 : 0);
    const arch: ArchetypeId = special?.arch ?? this.plan[idx] ?? r.weighted(Object.keys(cfg.customers.mix).length ? cfg.customers.mix : { regular: 1 });
    const def = ARCHETYPES[arch];
    let patienceMax = Math.floor((((BASE_PATIENCE * def.patiencePct) / 100) * cfg.customers.patiencePct) / 100);
    if (this.flag('rain')) patienceMax = Math.floor((patienceMax * 8) / 10);
    // Open-ended modes keep getting harder: patience shrinks as the run goes on.
    if (!this.finite() && cfg.customers.rampPct > 0) patienceMax = Math.floor((patienceMax * Math.max(35, 100 - Math.floor((idx * cfg.customers.rampPct) / 3))) / 100);
    const c: Customer = {
      id: this.id(), idx, arch, look: r.pick(def.looks), slot: -1, state: 'entering', stateTick: this.tick,
      patience: patienceMax, patienceMax, order: [], wave: 0, waves: 1, mistakes: 0,
      trust: r.range(1, 5), flex: r.int(3), hasCash: r.chance(55), satisfaction: 0, firstSelTick: -1,
    };
    if (arch === 'debtor') {
      c.debt = special?.debt ?? r.pick([200, 300, 400, 500]);
      c.debtorType = r.int(3);
    } else if (arch === 'booker') {
      const pool = this.pickProducts(r, 2, 'wedding');
      const lines = pool.map((p) => ({ p, qty: r.pick([5, 5, 10]) }));
      const value = lines.reduce((s, l) => s + l.qty * this.sell[l.p]!, 0);
      c.booking = { lines, advance: round5(value / 5) };
    } else if (arch === 'pickup' && special?.lines) {
      c.order = special.lines.map((l) => ({ p: l.p, qty: l.qty, got: 0, wave: 0 }));
      c.advance = special.advance ?? 0;
    } else {
      this.genOrder(c, r);
    }
    if (arch === 'angry') c.pendingComplaint = true;
    if (arch === 'bargain') c.wantsBargain = true;
    if (arch === 'credit') c.wantsCredit = true;
    if (arch === 'secret') c.secret = true;
    if (arch === 'regular' && cfg.mods.couponPct && r.chance(cfg.mods.couponPct)) c.wantsCoupon = true;
    if (arch === 'child' && c.order.length >= 2 && r.chance(65)) c.childShort = true;
    return c;
  }

  /** Weighted sample of distinct products, honouring demand tags, promotions and stock. */
  pickProducts(r: Rng, n: number, preferTag?: string, onlyClue = false): string[] {
    const m = this.cfg.mods;
    const weights: Record<string, number> = {};
    for (const id of this.cfg.products) {
      const p = PRODUCT_MAP[id]!;
      if (onlyClue && !p.clue) continue;
      let w = 10;
      for (const t of p.tags ?? []) {
        const pct = m.demand?.[t];
        if (pct) w = Math.floor((w * pct) / 100);
        if (preferTag && t === preferTag) w *= 6;
      }
      if ((this.discount[id] ?? 0) > 0) w *= 5;
      if (id === this.focusP) w *= 2;
      const pending = this.deliveries.some((d) => d.p === id);
      if (this.available(id) <= 0 && !m.restock && !pending && !(this.hidden[id]! > 0)) w = 0;
      if (id === m.giftItem) w = 0;
      if (w > 0) weights[id] = w;
    }
    const out: string[] = [];
    while (out.length < n && Object.keys(weights).length > 0) {
      const id = r.weighted(weights);
      out.push(id);
      delete weights[id];
    }
    return out;
  }

  private genOrder(c: Customer, r: Rng): void {
    const cfg = this.cfg;
    const plan = cfg.customers;
    const def = ARCHETYPES[c.arch];
    if (c.arch === 'repeat') {
      const key = Math.floor(this.repeatSeen / 2);
      const second = this.repeatSeen % 2 === 1;
      this.repeatSeen++;
      c.repeatKey = key;
      const prev = this.repeatOrders[key];
      if (second && prev) {
        c.look = prev.look;
        c.order = prev.lines.map((l) => ({ p: l.p, qty: l.qty, got: 0, wave: 0 }));
        c.hiddenOrder = true;
        return;
      }
    }
    let size = Math.max(1, r.range(plan.size[0], plan.size[1]) + def.sizeAdd);
    if (c.arch === 'family') size = Math.max(3, size + 1);
    if (c.arch === 'bulk') size = Math.max(1, Math.min(2, size));
    if (c.arch === 'forgetful') size = Math.max(2, size);
    size = Math.min(size, 5, cfg.products.length);
    let ids: string[];
    if (c.arch === 'confused') {
      ids = this.pickProducts(r, size, undefined, true);
      if (ids.length === 0) ids = this.pickProducts(r, size);
    } else {
      ids = this.pickProducts(r, size, c.arch === 'child' ? 'kids' : cfg.mods.focusTag);
    }
    if (this.forceProduct && this.forceProduct.left > 0 && c.arch !== 'bulk') {
      const fp = this.forceProduct.p;
      ids = [fp, ...ids.filter((x) => x !== fp)].slice(0, Math.max(1, size));
      this.forceProduct.left--;
    }
    c.order = ids.map((p, i): OrderLine => {
      let qty = r.range(plan.qty[0], plan.qty[1]);
      if (c.arch === 'bulk') qty = r.pick([5, 5, 10, 6, 10, 7]);
      if (this.forceProduct && p === this.forceProduct.p) qty = 1;
      const line: OrderLine = { p, qty, got: 0, wave: 0 };
      if (c.arch === 'elderly') line.wave = i;
      if (c.arch === 'family') line.wave = Math.min(2, Math.floor((i * 3) / ids.length));
      if (c.arch === 'forgetful' && i === ids.length - 1) line.wave = 1;
      if (c.arch === 'confused' && PRODUCT_MAP[p]!.clue && (i === 0 || r.chance(50))) line.clue = true;
      return line;
    });
    if (c.arch === 'regular' && cfg.mods.swapPct && r.chance(cfg.mods.swapPct) && c.order.length > 0) {
      const alt = this.pickProducts(r, 6).find((p) => !c.order.some((l) => l.p === p));
      if (alt) c.order[0]!.swapTo = alt;
    }
    if (cfg.mods.giftItem && cfg.products.includes(cfg.mods.giftItem)) {
      c.order.push({ p: cfg.mods.giftItem, qty: 1, got: 0, wave: 0, free: true });
    }
    c.waves = c.order.reduce((mx, l) => Math.max(mx, l.wave), 0) + 1;
    // The free gift is always handed over last.
    for (const l of c.order) if (l.free) l.wave = c.waves - 1;
    if (c.arch === 'repeat' && c.repeatKey !== undefined) {
      this.repeatOrders[c.repeatKey] = { lines: c.order.map((l) => ({ p: l.p, qty: l.qty })), look: c.look };
    }
  }

  setState(c: Customer, to: CustomerState): void {
    if (c.state === to) return;
    if (!canTransition(c.state, to)) throw new Error(`Illegal customer transition ${c.state} -> ${to}`);
    c.state = to;
    c.stateTick = this.tick;
    this.emit({ t: 'state', id: c.id, state: to });
  }

  private freeSlot(): number {
    for (let s = 0; s < this.cfg.customers.slots; s++) if (!this.customers.some((c) => c.slot === s)) return s;
    return -1;
  }

  private arrive(c: Customer): void {
    const slot = this.freeSlot();
    if (slot >= 0) {
      c.slot = slot;
      c.stateTick = this.tick;
      this.customers.push(c);
      this.emit({ t: 'spawn', id: c.id });
    } else if (this.line.length < (this.cfg.mods.lineCap ?? 5)) {
      this.line.push(c);
    } else {
      // Line is full: the customer walks past.
      this.stats.lost++;
      this.processed++;
      this.addRep(-5);
      this.combo = 0;
      this.emit({ t: 'banner', key: 'ev.balk', tone: 'bad' });
    }
  }

  private spawnTick(): void {
    const plan = this.cfg.customers;
    for (let i = this.specials.length - 1; i >= 0; i--) {
      const sp = this.specials[i]!;
      if (this.tick >= sp.tick) {
        this.specials.splice(i, 1);
        this.arrive(this.makeCustomer(10_000 + this.tick, sp));
      }
    }
    const more = !this.finite() || this.spawned < plan.count;
    if (!more || this.closingStage > 0) return;
    // Keep the pace up: an idle counter pulls the next customer forward.
    if (this.customers.length === 0 && this.line.length === 0) this.nextSpawnTick = Math.min(this.nextSpawnTick, this.tick + 8);
    if (this.tick < this.nextSpawnTick) return;
    const idx = this.spawned++;
    this.arrive(this.makeCustomer(idx));
    if (this.burst > 0) { this.burst--; this.nextSpawnTick = this.tick + 5; }
    else this.nextSpawnTick = this.tick + this.spawnInterval(idx);
  }

  private progressEvents(): void {
    const plan = this.cfg.customers;
    if (this.finite()) {
      for (const t of this.timeline) {
        // Money deadlines follow customers actually dealt with; everything else follows arrivals.
        const progress = t.ev.kind === 'debtDue' ? this.processed : this.spawned;
        if (t.fired === 0 && progress >= Math.max(1, Math.ceil((plan.count * t.ev.at) / 100))) {
          t.fired = 1;
          fireTimeline(this, t.ev, t.idx, 0);
        }
      }
    }
  }

  // ───────────────────────── step ─────────────────────────
  step(): void {
    if (this.ended) return;
    this.tick++;
    const t = this.tick;
    for (const name of Object.keys(this.flagUntil) as FlagName[]) {
      if (this.flagUntil[name] === t) { this.flagUntil[name] = 0; this.emit({ t: 'flag', name, on: false }); }
    }
    if (!this.finite()) {
      for (const tl of this.timeline) {
        if (tl.next > 0 && t >= tl.next) {
          fireTimeline(this, tl.ev, tl.idx, tl.fired++);
          tl.next = tl.ev.every ? t + tl.ev.every : 0;
        }
      }
    } else if (t === 1) {
      for (const tl of this.timeline) if (tl.ev.at === 0 && tl.fired === 0) { tl.fired = 1; fireTimeline(this, tl.ev, tl.idx, 0); }
    }
    this.spawnTick();
    this.progressEvents();
    this.updateCustomers();
    for (let i = this.deliveries.length - 1; i >= 0; i--) {
      const d = this.deliveries[i]!;
      if (d.arrive > 0 && t >= d.arrive) {
        d.arrive = 0;
        this.addHotspot({ kind: 'box', p: d.p, data: d.id });
        this.emit({ t: 'delivery', p: d.p });
      }
    }
    for (let i = this.hotspots.length - 1; i >= 0; i--) {
      const h = this.hotspots[i]!;
      if (h.until > 0 && t >= h.until) expireHotspot(this, h);
    }
    const d = this.decision;
    if (d && t >= d.deadlineTick) this.resolve(d, -1);
    tickTimers(this);
    if (this.boss && this.cfg.boss && this.cfg.boss.id !== 'storm' && !this.decision && t >= this.boss.nextMove) {
      bossMove(this);
    }
    this.checkEnd();
  }

  private updateCustomers(): void {
    const t = this.tick;
    const noDrain = !!this.cfg.mods.noPatience || this.flag('fire');
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i]!;
      switch (c.state) {
        case 'entering':
          if (t - c.stateTick >= ENTER_TICKS) {
            this.setState(c, 'waiting');
            this.emit({ t: 'say', id: c.id, key: `say.greet.${c.arch}` });
          }
          break;
        case 'waiting': case 'ordering': case 'complaining':
          if (!noDrain) c.patience--;
          break;
        case 'deciding': case 'paying':
          if (!noDrain && t % 2 === 0) c.patience--;
          break;
        case 'satisfied': case 'angry': case 'lostPatience':
          if (t - c.stateTick >= EXIT_TICKS) this.setState(c, 'leaving');
          break;
        case 'leaving':
          if (t - c.stateTick >= ENTER_TICKS) {
            c.state = 'gone';
            this.customers.splice(i, 1);
            this.emit({ t: 'state', id: c.id, state: 'gone' });
          }
          break;
        default: break;
      }
      if (c.patience <= 0 && ['waiting', 'ordering', 'deciding', 'paying', 'complaining'].includes(c.state)) this.loseCustomer(c);
    }
    for (let i = this.line.length - 1; i >= 0; i--) {
      const c = this.line[i]!;
      if (!noDrain && t % 2 === 0) c.patience--;
      if (c.patience <= 0) {
        this.line.splice(i, 1);
        this.stats.lost++;
        this.processed++;
        this.addRep(-Math.ceil(ARCHETYPES[c.arch].lostRep / 2));
        this.combo = 0;
        this.stats.streak = 0;
        this.bossStormStrike();
        this.emit({ t: 'banner', key: 'ev.lineLeft', tone: 'bad' });
      }
    }
    while (this.line.length > 0 && this.freeSlot() >= 0) {
      const c = this.line.shift()!;
      c.state = 'entering';
      this.arrive(c);
    }
    if (this.selected === -1 || !this.current || !['waiting', 'ordering', 'deciding', 'paying', 'complaining'].includes(this.current.state)) {
      this.selected = -1;
      this.autoSelect();
    }
  }

  private autoSelect(): void {
    if (this.decision) return;
    let best: Customer | undefined;
    for (const c of this.customers) {
      if (c.state !== 'waiting' && c.state !== 'ordering' && c.state !== 'paying') continue;
      if (!best || c.patience * best.patienceMax < best.patience * c.patienceMax) best = c;
    }
    if (best) this.select(best);
  }

  private select(c: Customer): void {
    this.selected = c.id;
    if (c.state === 'waiting') {
      if (c.firstSelTick < 0) c.firstSelTick = this.tick;
      if (c.pendingComplaint) { c.pendingComplaint = false; startDecisionFor(this, c, 'complaint'); return; }
      if (c.arch === 'debtor') { startDecisionFor(this, c, 'debtor'); return; }
      if (c.arch === 'booker') { startDecisionFor(this, c, 'booking'); return; }
      this.setState(c, 'ordering');
      this.emit({ t: 'say', id: c.id, key: c.hiddenOrder ? 'say.same' : `say.order.${c.arch}` });
    }
  }

  loseCustomer(c: Customer): void {
    this.decisions = this.decisions.filter((d) => d.customerId !== c.id);
    this.promoteDecision();
    this.setState(c, 'lostPatience');
    this.stats.lost++;
    this.processed++;
    this.addRep(-ARCHETYPES[c.arch].lostRep);
    this.combo = 0;
    this.stats.streak = 0;
    if (c.arch === 'pickup') this.stats.bookingsFailed++;
    if (c.secret) { this.stats.secretStars += 1; this.emit({ t: 'banner', key: 'ev.secretBad', tone: 'bad', params: { n: 1 } }); }
    if (this.selected === c.id) this.selected = -1;
    this.bossStormStrike();
    this.emit({ t: 'lost', id: c.id });
    this.emit({ t: 'say', id: c.id, key: 'say.lost' });
  }

  /** Customer leaves without buying (refused credit, failed bargain, nothing in stock…). */
  dismiss(c: Customer, mood: 'ok' | 'sad' | 'angry', sayKey?: string): void {
    for (const l of c.order) l.got = 0;
    this.decisions = this.decisions.filter((d) => d.customerId !== c.id);
    this.promoteDecision();
    this.processed++;
    if (mood === 'angry') { this.addRep(-5); this.combo = 0; this.stats.streak = 0; }
    if (mood === 'sad') this.addRep(-2);
    if (c.arch === 'pickup') this.stats.bookingsFailed++;
    if (sayKey) this.emit({ t: 'say', id: c.id, key: sayKey });
    this.setState(c, mood === 'ok' ? 'satisfied' : 'angry');
    if (this.selected === c.id) this.selected = -1;
  }

  mistake(c?: Customer, weight = 1): void {
    this.stats.mistakes += weight;
    this.combo = 0;
    this.stats.streak = 0;
    this.addRep(c?.arch === 'vip' ? -6 : -2);
    if (c) c.mistakes += weight;
  }

  private bossStormStrike(): void {
    if (this.boss && this.cfg.boss?.id === 'storm') this.bossStrike();
  }
  bossHit(): void {
    if (!this.boss || !this.cfg.boss) return;
    this.boss.hp = Math.max(0, this.boss.hp - 1);
    this.stats.bossHits++;
    this.addPoints(100, 'boss');
    this.emit({ t: 'boss', what: 'hit' });
    const ph = this.cfg.boss.phases;
    let next = this.boss.phase;
    while (next < ph.length - 1 && this.boss.hp <= ph[next]!.untilHp) next++;
    if (next !== this.boss.phase && this.boss.hp > 0) {
      this.boss.phase = next;
      this.emit({ t: 'boss', what: 'phase' });
    }
  }
  bossStrike(): void {
    if (!this.boss) return;
    this.boss.strikes++;
    this.stats.strikes++;
    this.emit({ t: 'boss', what: 'strike' });
  }

  // ───────────────────────── decisions ─────────────────────────
  pushDecision(d: Omit<Decision, 'id' | 'deadlineTick'>): Decision {
    const full: Decision = { ...d, id: this.id(), deadlineTick: 0 };
    this.decisions.push(full);
    if (this.decisions.length === 1) this.promoteDecision();
    return full;
  }
  promoteDecision(): void {
    const d = this.decisions[0];
    if (d && d.deadlineTick === 0) {
      d.deadlineTick = this.tick + d.ttl;
      this.emit({ t: 'decision', id: d.id });
    }
  }
  resolve(d: Decision, option: number): void {
    const i = this.decisions.indexOf(d);
    if (i < 0) return;
    this.decisions.splice(i, 1);
    const good = option === d.best;
    const ok = !good && option >= 0 && (d.ok ?? []).includes(option);
    const c = d.customerId !== undefined ? this.cust(d.customerId) : undefined;
    if (good) {
      this.stats.decisionsGood++;
      this.addPoints(30, 'decision');
      if (d.boss) this.bossHit();
    } else if (!ok) {
      this.stats.decisionsBad++;
      this.mistake(c);
      if (d.boss) this.bossStrike();
    }
    this.emit({ t: 'decided', id: d.id, good, ok, kind: d.kind });
    resolveDecision(this, d, option, good, c);
    if (this.boss) this.boss.nextMove = this.tick + (this.cfg.boss!.phases[this.boss.phase]?.every ?? 100);
    this.promoteDecision();
  }

  // ───────────────────────── order & payment ─────────────────────────
  private activeLines(c: Customer): OrderLine[] {
    return c.order.filter((l) => l.wave <= c.wave && !l.na);
  }

  private afterLineChange(c: Customer): void {
    const active = this.activeLines(c);
    if (active.some((l) => l.got < l.qty)) return;
    if (c.wave < c.waves - 1) {
      c.wave++;
      this.emit({ t: 'say', id: c.id, key: c.arch === 'forgetful' ? 'say.forgot' : c.arch === 'family' ? 'say.family' : 'say.next' });
      this.emit({ t: 'orderChange', id: c.id });
      // A new wave may consist only of lines that are already satisfied.
      this.afterLineChange(c);
      return;
    }
    if (c.order.every((l) => l.got === 0)) { this.dismiss(c, 'sad', 'say.nothing'); return; }
    this.advancePayment(c);
  }

  subtotal(c: Customer): number {
    let sum = 0;
    for (const l of c.order) if (!l.free) sum += l.got * this.unitPrice(l.p);
    return sum;
  }

  /** Runs the pre-payment decision chain, then opens the payment. */
  advancePayment(c: Customer): void {
    if (c.state === 'ordering' || c.state === 'deciding') {
      if (this.flag('powerOut') && !c.totalChecked) {
        c.totalChecked = true;
        if (startDecisionFor(this, c, 'hiddenTotal')) return;
      }
      if (c.wantsBargain) { c.wantsBargain = false; startDecisionFor(this, c, 'bargain'); return; }
      if (c.wantsCoupon) { c.wantsCoupon = false; startDecisionFor(this, c, 'coupon'); return; }
      if (c.childShort) { c.childShort = false; if (startDecisionFor(this, c, 'childShort')) return; }
      if (c.wantsCredit) { c.wantsCredit = false; startDecisionFor(this, c, 'credit'); return; }
    }
    this.openPayment(c);
  }

  private openPayment(c: Customer): void {
    const r = this.rng(0x9a7, c.idx, c.id);
    const disc = c.discountPct ?? 0;
    const total = Math.max(5, billTotal(this, c) - (c.advance ?? 0) - (c.creditPart ?? 0));
    const pay = { method: 'exact' as 'exact' | 'cash' | 'mobile', total, given: total, discountPct: disc, startTick: this.tick, fake: false, short: false, fakeTell: 0 };
    const mods = this.cfg.mods;
    if (c.forceExact || c.arch === 'child') {
      // exact
    } else if (c.arch === 'kipta' && total >= 30) {
      pay.method = 'exact';
      pay.given = total - Math.min(total - 5, r.pick([5, 10, 10, 20]));
      pay.short = true;
    } else if (r.chance(c.arch === 'vip' ? Math.min(90, this.cfg.payment.mobilePct * 2) : this.cfg.payment.mobilePct)) {
      c.usedMobile = true;
      if (this.flag('outage')) {
        startDecisionFor(this, c, 'outage');
        return;
      }
      pay.method = 'mobile';
    } else if (!r.chance(this.cfg.payment.exactPct)) {
      const cands: number[] = [];
      for (const step of [10, 50, 100, 500, 1000]) {
        const up = Math.ceil((total + 1) / step) * step;
        if (up > total && !cands.includes(up)) cands.push(up);
      }
      const big = c.arch === 'vip' || r.chance(mods.bigNotePct ?? 0);
      const pool = big ? cands.slice(-2) : cands.slice(0, 3);
      pay.given = r.pick(pool);
      pay.method = 'cash';
      if (mods.fakeNotePct && pay.given >= 100 && r.chance(mods.fakeNotePct)) { pay.fake = true; pay.fakeTell = r.int(3); }
    }
    c.pay = pay;
    if (c.state !== 'paying') this.setState(c, 'paying');
    this.emit({ t: 'payStart', id: c.id });
    this.emit({ t: 'say', id: c.id, key: pay.method === 'mobile' ? 'say.mobile' : pay.short ? 'say.kipta' : pay.given > pay.total ? 'say.change' : 'say.pay' });
  }

  /** Finalises a sale. `received` is the cash that actually entered the drawer. */
  complete(c: Customer, received: number): void {
    const pay = c.pay!;
    const def = ARCHETYPES[c.arch];
    let units = 0;
    let cogs = 0;
    for (const l of c.order) {
      if (l.got <= 0) continue;
      units += l.got;
      this.stock[l.p]! -= l.got;
      cogs += l.got * this.buy[l.p]!;
      const prod = PRODUCT_MAP[l.p]!;
      const exp = this.expiring[l.p];
      if (exp) exp.units = Math.max(0, exp.units - l.got);
      if (l.p === this.focusP || (this.cfg.mods.focusTag && prod.tags?.includes(this.cfg.mods.focusTag))) this.stats.tagUnits += l.got;
      if (this.priceRaised[l.p]) c.priceHit = true;
      l.got = 0; // released from the reservation; stock already reduced
      this.emit({ t: 'stock', p: l.p });
    }
    const credit = c.creditPart ?? 0;
    if (credit > 0) giveCredit(this, c, credit);
    const s = this.stats;
    s.units += units;
    s.cogs += cogs;
    s.revenue += pay.total + credit;
    if (pay.method !== 'credit') s.cashSales += pay.total;
    this.addCash(received);
    const perfect = c.mistakes === 0 && !c.revealed && !c.order.some((l) => l.na);
    if (perfect) { this.combo++; s.perfect++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); }
    else { this.combo = 0; s.streak = 0; }
    s.maxCombo = Math.max(s.maxCombo, this.combo);
    const ratio = Math.max(0, c.patience) / c.patienceMax;
    const base = 40 + 8 * Math.min(units, 12) + Math.floor(40 * ratio) + (perfect ? 25 : 0);
    const comboPct = 100 + 10 * Math.min(this.combo, 10);
    const points = Math.floor((((base * def.scorePct) / 100) * comboPct) / 100);
    let sat = Math.floor(50 + 50 * ratio) - 12 * c.mistakes + c.satisfaction + ((c.discountPct ?? 0) > 0 ? 8 : 0) - (c.priceHit ? 10 : 0);
    sat = Math.max(0, Math.min(100, sat));
    s.satSum += sat;
    s.served++;
    this.processed++;
    s.arch[c.arch] = (s.arch[c.arch] ?? 0) + 1;
    if (c.patience * 10 >= c.patienceMax * 6) s.fastServes++;
    if (this.tick - pay.startTick <= 50) s.fastPays++;
    s.serveTicks += this.tick - (c.firstSelTick < 0 ? this.tick : c.firstSelTick);
    if (c.arch === 'bulk') s.bulkServed++;
    if (c.arch === 'vip') {
      s.vipServed++;
      if (perfect) {
        const tip = Math.max(5, round5(pay.total / 10));
        s.tips += tip; s.cashSales += tip; s.revenue += tip;
        this.addCash(tip);
        this.emit({ t: 'banner', key: 'ev.tip', tone: 'good', params: { n: tip } });
      }
    }
    if (c.arch === 'pickup') { if (c.order.some((l) => l.na)) s.bookingsFailed++; else s.bookingsDone++; }
    if (c.secret) {
      let stars = 5 - 2 * c.mistakes - (ratio < 0.3 ? 1 : 0) - (ratio < 0.6 ? 1 : 0);
      stars = Math.max(1, Math.min(5, stars));
      s.secretStars += stars;
      if (stars >= 4) { this.addPoints(100, 'secret'); this.addRep(8); }
      else this.addRep(-8);
      this.emit({ t: 'banner', key: stars >= 4 ? 'ev.secretGood' : 'ev.secretBad', tone: stars >= 4 ? 'good' : 'bad', params: { n: stars } });
    }
    this.addRep(perfect ? 3 : 1);
    this.score += points;
    c.pay = undefined;
    this.setState(c, sat >= 30 ? 'satisfied' : 'angry');
    this.emit({ t: 'served', id: c.id, points, perfect, combo: this.combo, cash: received });
    this.emit({ t: 'say', id: c.id, key: sat >= 30 ? `say.thanks.${c.arch}` : 'say.grumble' });
    if (this.selected === c.id) this.selected = -1;
    if (this.boss && this.cfg.boss?.id === 'storm') this.bossHit();
  }

  /** Bounded subset-sum: can `amount` be paid out from the given note counts? */
  static canMakeChange(amount: number, till: number[]): boolean {
    if (amount % 5 !== 0) return false;
    const target = amount / 5;
    const reach = new Uint8Array(target + 1);
    reach[0] = 1;
    DENOMS.forEach((d, i) => {
      const v = d / 5;
      for (let k = 0; k < (till[i] ?? 0); k++) {
        for (let a = target; a >= v; a--) if (reach[a - v]) reach[a] = 1;
      }
    });
    return reach[target] === 1;
  }

  /** The drawer after the customer's notes go in (greedy decomposition of what they handed over). */
  tillWith(given: number): number[] {
    const t = [...(this.till ?? [])];
    let rest = given;
    DENOMS.forEach((d, i) => { const n = Math.floor(rest / d); t[i] = (t[i] ?? 0) + n; rest -= n * d; });
    return t;
  }

  // ───────────────────────── actions ─────────────────────────
  /** Apply a player action at the current tick. Returns false if it was not legal (and was ignored). */
  act(type: number, a = 0, b = 0, rest: number[] = []): boolean {
    if (this.ended) return false;
    const ok = this.apply(type, a, b, rest);
    if (ok) this.log.push([this.tick, type, a, b, ...rest]);
    return ok;
  }

  private apply(type: number, a: number, b: number, rest: number[]): boolean {
    switch (type) {
      case Act.Decide: {
        const d = this.decision;
        if (!d || d.id !== a) return false;
        const max = (d.rowSelect ? d.rows?.length ?? 0 : 0) + d.options.length;
        if (!Number.isInteger(b) || b < 0 || b >= max) return false;
        this.resolve(d, b);
        return true;
      }
      case Act.Hotspot: {
        const h = this.hotspots.find((x) => x.id === a);
        if (!h) return false;
        return tapHotspot(this, h);
      }
      default: break;
    }
    if (this.decision) return false; // a modal decision blocks the counter
    if (this.flag('closed')) { this.emit({ t: 'tapBad', p: '', why: 'closed' }); return false; }
    switch (type) {
      case Act.Select: {
        const c = this.cust(a);
        if (!c || !['waiting', 'ordering', 'paying'].includes(c.state)) return false;
        if (this.selected === c.id) return false;
        this.select(c);
        return true;
      }
      case Act.Add: return this.addItem(a, b);
      case Act.NotAvailable: {
        const c = this.current;
        if (!c || c.state !== 'ordering') return false;
        const l = c.order[a];
        if (!l || l.na || l.wave > c.wave || l.got >= l.qty) return false;
        if (this.available(l.p) > 0) return false;
        l.na = true;
        c.satisfaction -= 15;
        this.stats.apologies++;
        this.emit({ t: 'say', id: c.id, key: 'say.noStock' });
        this.emit({ t: 'orderChange', id: c.id });
        this.afterLineChange(c);
        return true;
      }
      case Act.Reveal: {
        const c = this.current;
        if (!c || !c.hiddenOrder || c.revealed) return false;
        c.revealed = true;
        c.satisfaction -= 20;
        this.emit({ t: 'orderChange', id: c.id });
        return true;
      }
      case Act.Collect: {
        const c = this.current;
        if (!c || c.state !== 'paying' || !c.pay) return false;
        const p = c.pay;
        if (p.given > p.total) return false;
        if (p.fake) { this.mistake(c); this.emit({ t: 'payBad', id: c.id, why: 'fake' }); this.complete(c, 0); return true; }
        if (p.given < p.total) { this.mistake(c); this.emit({ t: 'payBad', id: c.id, why: 'short' }); }
        this.complete(c, p.given);
        return true;
      }
      case Act.Change: {
        const c = this.current;
        if (!c || c.state !== 'paying' || !c.pay) return false;
        const p = c.pay;
        if (p.given <= p.total) return false;
        const counts = [a, b, ...rest].slice(0, DENOMS.length);
        if (counts.some((n) => !Number.isInteger(n) || n < 0 || n > 40)) return false;
        const sum = DENOMS.reduce((s, d, i) => s + d * (counts[i] ?? 0), 0);
        const due = p.given - p.total;
        if (sum <= 0) return false;
        if (this.till) {
          const t = this.tillWith(p.given);
          if (counts.some((n, i) => (n ?? 0) > t[i]!)) { this.emit({ t: 'payBad', id: c.id, why: 'till' }); return false; }
        }
        if (sum < due && !p.fake) {
          this.mistake(c);
          c.patience -= Math.floor(c.patienceMax / 10);
          this.emit({ t: 'payBad', id: c.id, why: 'less' });
          this.emit({ t: 'say', id: c.id, key: 'say.lessChange' });
          return true;
        }
        if (this.till) {
          const t = this.tillWith(p.given);
          this.till = t.map((n, i) => n - (counts[i] ?? 0));
        }
        if (p.fake) {
          this.mistake(c, 2);
          this.emit({ t: 'payBad', id: c.id, why: 'fake' });
          this.complete(c, -sum);
          return true;
        }
        if (sum > due) { this.mistake(c); this.emit({ t: 'payBad', id: c.id, why: 'over' }); }
        else this.stats.changeGiven++;
        this.complete(c, p.given - sum);
        return true;
      }
      case Act.Flag: {
        const c = this.current;
        if (!c || c.state !== 'paying' || !c.pay) return false;
        const p = c.pay;
        if (a === 1) {
          if (p.fake) { p.fake = false; this.stats.fakeCaught++; this.addPoints(30, 'catch'); this.emit({ t: 'say', id: c.id, key: 'say.fakeSorry' }); }
          else this.offend(c);
          return true;
        }
        if (a === 2) {
          if (p.given < p.total) { p.given = p.total; p.short = false; this.stats.shortCaught++; this.addPoints(30, 'catch'); this.emit({ t: 'say', id: c.id, key: 'say.kiptaCaught' }); this.emit({ t: 'payStart', id: c.id }); }
          else this.offend(c);
          return true;
        }
        if (a === 3) {
          if (!this.till || p.given <= p.total) return false;
          if (!Sim.canMakeChange(p.given - p.total, this.tillWith(p.given))) {
            p.given = p.total; p.method = 'exact'; p.fake = false;
            c.patience -= Math.floor((c.patienceMax * 15) / 100);
            c.satisfaction -= 5;
            this.emit({ t: 'say', id: c.id, key: 'say.smallNote' });
            this.emit({ t: 'payStart', id: c.id });
          } else this.offend(c);
          return true;
        }
        return false;
      }
      case Act.Restock: return this.restock(a);
      default: return false;
    }
  }

  private offend(c: Customer): void {
    this.mistake(c);
    c.satisfaction -= 20;
    c.patience -= Math.floor((c.patienceMax * 15) / 100);
    this.emit({ t: 'payBad', id: c.id, why: 'offend' });
    this.emit({ t: 'say', id: c.id, key: 'say.offended' });
  }

  private addItem(pidx: number, n: number): boolean {
    const c = this.current;
    const p = this.cfg.products[pidx];
    if (!c || !p || c.state !== 'ordering' || !Number.isInteger(n) || n < 1 || n > 5) return false;
    this.stats.taps++;
    const line = this.activeLines(c).find((l) => l.p === p && l.got < l.qty);
    if (!line) {
      this.stats.wrongTaps++;
      this.mistake(c);
      c.patience -= Math.floor(c.patienceMax / 20);
      this.emit({ t: 'tapBad', p, why: 'wrong' });
      return true;
    }
    if ((this.damaged[p] ?? 0) > 0) {
      // Handing over damaged goods: the unit is wasted and the customer objects.
      this.damaged[p]!--;
      this.stock[p] = Math.max(0, this.stock[p]! - 1);
      this.stats.waste++;
      this.stats.wasteValue += this.buy[p]!;
      this.stats.wrongTaps++;
      this.mistake(c);
      this.emit({ t: 'tapBad', p, why: 'wrong' });
      this.emit({ t: 'banner', key: 'ev.damagedSold', tone: 'bad' });
      this.emit({ t: 'stock', p });
      return true;
    }
    const units = Math.min(n, line.qty - line.got, this.available(p));
    if (units <= 0) { this.stats.taps--; this.emit({ t: 'tapBad', p, why: 'stock' }); return false; }
    line.got += units;
    const done = line.got >= line.qty;
    this.emit({ t: 'tapOk', id: c.id, p, done });
    if (done && line.swapTo) {
      line.p = line.swapTo;
      line.swapTo = undefined;
      line.got = 0;
      this.emit({ t: 'say', id: c.id, key: 'say.changeMind' });
      this.emit({ t: 'orderChange', id: c.id });
      return true;
    }
    this.afterLineChange(c);
    return true;
  }

  private restock(pidx: number): boolean {
    const p = this.cfg.products[pidx];
    const m = this.cfg.mods;
    if (!p || !m.restock || this.cartonsLeft === 0) return false;
    if ((this.noRestockUntil[p] ?? 0) > this.tick) return false;
    if (this.deliveries.filter((d) => d.p === p).length >= 2) return false;
    const cost = this.cartonCost(p);
    if (this.cash < cost) { this.emit({ t: 'banner', key: 'ev.noCash', tone: 'bad' }); return false; }
    const n = this.restockCount++;
    const r = this.rng(0x5eed, n);
    const kind = r.chance(m.negotiatePct ?? 0) ? 'negotiate' : r.chance(m.suppliersPct ?? 0) ? 'suppliers' : '';
    if (kind) { startDecisionFor(this, undefined, kind, p); return true; }
    this.orderDelivery(p, cost, m.leadTicks ?? 80, 100, n);
    return true;
  }

  /** Pays the supplier and schedules a delivery. */
  orderDelivery(p: string, cost: number, lead: number, qualityPct: number, n: number, units?: number): Delivery {
    const m = this.cfg.mods;
    const def = PRODUCT_MAP[p]!;
    const r = this.rng(0xde11, n, this.tick);
    const total = units ?? def.carton;
    const good = Math.max(1, Math.floor((total * qualityPct) / 100));
    if (good < total) { this.stats.waste += total - good; this.stats.wasteValue += (total - good) * this.buy[p]!; }
    this.addCash(-cost);
    this.stats.supplierSpend += cost;
    this.stats.supplierBase += def.buy * total;
    this.stats.restocks++;
    if (this.cartonsLeft > 0) this.cartonsLeft--;
    if (this.flag('rain')) lead *= 2;
    const d: Delivery = { id: this.id(), p, units: good, arrive: this.tick + lead, defect: 0, cost };
    if (m.inspectPct && r.chance(m.inspectPct)) {
      d.defect = r.pick(m.defects && m.defects.length ? m.defects : [1, 2, 3]);
      if (d.defect === 1) d.defectP = r.pick(this.cfg.products.filter((x) => x !== p).concat(p === this.cfg.products[0] ? [] : [this.cfg.products[0]!]));
    }
    this.deliveries.push(d);
    if (m.transportPct && r.chance(m.transportPct)) startDecisionFor(this, undefined, 'transport', p, d.id);
    return d;
  }

  // ───────────────────────── end of run ─────────────────────────
  private checkEnd(): void {
    const cfg = this.cfg;
    if (this.reputation <= 0) return this.finalize('reputation');
    if (cfg.mods.maxMistakes !== undefined && this.stats.mistakes > cfg.mods.maxMistakes) return this.finalize('mistakes');
    if (cfg.mode === 'survival' && this.cash < 0) return this.finalize('cash');
    if (this.boss && cfg.boss) {
      if (this.boss.strikes >= cfg.boss.maxStrikes) return this.finalize('boss');
      if (this.boss.hp <= 0) return this.finalize('bossDefeated');
    }
    if (cfg.durationTicks > 0 && this.tick >= cfg.durationTicks) return this.finalize('time');
    if (this.finite() && !this.boss && this.spawned >= cfg.customers.count && this.customers.length === 0
      && this.line.length === 0 && this.specials.length === 0 && this.decisions.length === 0) {
      if (this.closingStage === 0) {
        this.closingStage = 1;
        this.settleDeferred();
        this.closingQueue = [...(cfg.mods.closing ?? [])];
      }
      const next = this.closingQueue.shift();
      if (next) { closingDecision(this, next); return; }
      this.finalize('complete');
    }
  }

  private settleDeferred(): void {
    if (this.deferred > 0) {
      this.payExpense(this.deferred);
      this.deferred = 0;
    }
  }

  metric(key: MetricKey): number {
    const s = this.stats;
    if (key.startsWith('arch:')) return s.arch[key.slice(5) as ArchetypeId] ?? 0;
    switch (key) {
      case 'accuracy': {
        const actions = s.taps + s.decisionsGood + s.decisionsBad + s.served;
        return actions <= 0 ? 100 : Math.max(0, Math.floor((100 * (actions - s.mistakes)) / actions));
      }
      case 'satisfaction': return s.served <= 0 ? 0 : Math.floor(s.satSum / s.served);
      case 'profit': return this.profit();
      case 'cash': return this.cash;
      case 'surviveSec': return Math.floor(this.tick / TICKS_PER_SEC);
      case 'bossDefeated': return this.boss && this.boss.hp <= 0 ? 1 : 0;
      case 'score': return this.score;
      case 'avgServeSec': return s.served <= 0 ? 999 : Math.ceil(s.serveTicks / s.served / TICKS_PER_SEC);
      case 'buyEfficiency': return s.supplierSpend <= 0 ? 100 : Math.floor((100 * s.supplierBase) / s.supplierSpend);
      case 'reputation': return this.reputation;
      case 'mismatch': return this.mismatch();
      case 'creditOutstanding': return s.creditOutstanding;
      default: return s[key as StatKey] ?? 0;
    }
  }

  objectiveResults(): ObjectiveResult[] {
    return this.cfg.objectives.map((o) => {
      const value = this.metric(o.metric);
      return { objective: o, value, done: o.op === '>=' ? value >= o.target : value <= o.target };
    });
  }

  /** End the run early (player quit). */
  quit(): void { if (!this.ended) this.finalize('quit'); }

  finalize(reason: EndReason): void {
    if (this.ended) return;
    this.settleDeferred();
    const cfg = this.cfg;
    const objectives = this.objectiveResults();
    const failed = reason === 'reputation' || reason === 'mistakes' || reason === 'boss' || reason === 'cash' || reason === 'quit';
    const scoreMode = cfg.mode === 'endless' || cfg.mode === 'time' || cfg.mode === 'survival';
    let won: boolean;
    if (scoreMode) won = reason !== 'quit';
    else if (cfg.boss) won = reason === 'bossDefeated' && objectives.every((o) => !o.objective.primary || o.done);
    else won = !failed && objectives.every((o) => !o.objective.primary || o.done);
    if (won || scoreMode) {
      for (const o of objectives) if (o.done) this.score += 100;
      if (!scoreMode) {
        if (cfg.durationTicks > 0) this.score += Math.floor((300 * Math.max(0, cfg.durationTicks - this.tick)) / cfg.durationTicks);
        const profit = this.profit();
        if (profit > 0) this.score += Math.min(200, Math.floor(profit / 10));
      }
      this.score -= Math.min(200, this.mismatch());
      this.score -= Math.min(150, this.stats.waste * 5);
      this.score = Math.max(0, this.score);
    }
    if (cfg.mode === 'survival') this.score += Math.floor(this.tick / TICKS_PER_SEC) * 5;
    let stars = 0;
    if (won && !scoreMode) stars = this.score >= cfg.stars[2] ? 3 : this.score >= cfg.stars[1] ? 2 : 1;
    this.ended = true;
    this.result = {
      won, reason, score: this.score, stars, ticks: this.tick, objectives,
      accuracy: this.metric('accuracy'), satisfaction: this.metric('satisfaction'), profit: this.profit(),
      stats: { ...this.stats, arch: { ...this.stats.arch }, mismatch: this.mismatch() },
    };
    if (this.boss) this.emit({ t: 'boss', what: reason === 'bossDefeated' ? 'defeated' : 'won' });
    this.emit({ t: 'end' });
  }
}
