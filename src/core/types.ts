/**
 * Shared type definitions for the deterministic game core.
 * Everything here is plain data so configs can be serialized (content packs, DB, API).
 */

export type Lang = 'bn' | 'en';
export interface L10n {
  bn: string;
  en: string;
}

export const TICKS_PER_SEC = 10;
export const DENOMS = [500, 100, 50, 20, 10, 5] as const;

export type Mode = 'story' | 'endless' | 'time' | 'survival' | 'daily' | 'friend';
export type TabId = 'mudi' | 'snack' | 'cold' | 'home' | 'extra';
export type DemandTag =
  | 'ramadan' | 'eid' | 'rain' | 'cricket' | 'school' | 'winter' | 'puja' | 'wedding' | 'party' | 'boishakh' | 'kids';

export interface IconSpec {
  /** Drawing template. */
  t: 'sack' | 'bottle' | 'packet' | 'box' | 'jar' | 'bar' | 'carton' | 'round' | 'stick' | 'tray' | 'umbrella' | 'pile';
  c1: string;
  c2: string;
  /** Short label painted on the product (Bangla). */
  g?: string;
}

export interface ProductDef {
  id: string;
  bn: string;
  en: string;
  category: string;
  tab: TabId;
  /** Game purchase price per unit (integer taka). */
  buy: number;
  /** Game selling price per unit (integer taka, multiple of 5). */
  sell: number;
  initStock: number;
  maxStock: number;
  /** Units per supplier carton. */
  carton: number;
  cold?: boolean;
  perishable?: boolean;
  /** Story level at which the product appears on the shelf. */
  unlock: number;
  tags?: DemandTag[];
  /** Riddle used by confused customers. */
  clue?: L10n;
  icon: IconSpec;
}

export type ArchetypeId =
  | 'regular' | 'impatient' | 'bargain' | 'elderly' | 'child' | 'vip' | 'bulk' | 'credit' | 'angry'
  | 'confused' | 'forgetful' | 'kipta' | 'repeat' | 'secret' | 'family' | 'debtor' | 'booker' | 'pickup';

export interface ArchetypeDef {
  id: ArchetypeId;
  name: L10n;
  /** Character sprite ids this archetype can use. */
  looks: string[];
  patiencePct: number;
  scorePct: number;
  /** Added to the configured order-size range. */
  sizeAdd: number;
  /** Reputation lost when this customer walks out. */
  lostRep: number;
  /** Personality blurb for docs/tutorial. */
  about: L10n;
}

export type CustomerState =
  | 'entering' | 'waiting' | 'ordering' | 'deciding' | 'paying' | 'complaining' | 'satisfied' | 'angry' | 'lostPatience' | 'leaving' | 'gone';

export interface OrderLine {
  p: string;
  qty: number;
  /** Units already bagged. */
  got: number;
  /** Line becomes active once the customer's wave counter reaches this value. */
  wave: number;
  /** Shown as a riddle instead of a product icon. */
  clue?: boolean;
  /** Marked unavailable by the player ("নেই"). */
  na?: boolean;
  /** When fully bagged the customer changes their mind to this product. */
  swapTo?: string;
  /** Complimentary item (not charged). */
  free?: boolean;
}

export type PayMethod = 'exact' | 'cash' | 'mobile' | 'credit';

export interface Payment {
  method: PayMethod;
  total: number;
  given: number;
  fake?: boolean;
  /** Which visual defect the fake note shows (0..2). */
  fakeTell?: number;
  short?: boolean;
  discountPct: number;
  startTick: number;
}

export interface Customer {
  id: number;
  idx: number;
  arch: ArchetypeId;
  look: string;
  slot: number; // -1 = outside line
  state: CustomerState;
  stateTick: number;
  patience: number;
  patienceMax: number;
  order: OrderLine[];
  wave: number;
  waves: number;
  hiddenOrder?: boolean;
  revealed?: boolean;
  secret?: boolean;
  repeatKey?: number;
  mistakes: number;
  pay?: Payment;
  /** One-shot behaviours still pending. */
  pendingComplaint?: boolean;
  wantsBargain?: boolean;
  wantsCredit?: boolean;
  wantsCoupon?: boolean;
  childShort?: boolean;
  /** Hidden attributes that decisions reveal through hints. */
  trust: number; // 1..5
  flex: number; // 0 soft, 1 mid, 2 hard
  hasCash: boolean;
  satisfaction: number;
  /** Tick the player first selected this customer. */
  firstSelTick: number;
  debt?: number;
  debtorType?: number;
  booking?: { lines: { p: string; qty: number }[]; advance: number };
  /** Part of the bill put on credit (half-cash deals). */
  creditPart?: number;
  /** Amount already paid in advance (booking pickups). */
  advance?: number;
  usedMobile?: boolean;
  priceHit?: boolean;
  /** Discount agreed through bargaining or a coupon. */
  discountPct?: number;
  /** Bill total fixed by an earlier decision (overrides the computed subtotal). */
  fixedTotal?: number;
  /** A decision settled that this customer pays the exact amount in cash. */
  forceExact?: boolean;
  /** The bill was already added up by hand (power failure). */
  totalChecked?: boolean;
}

export type DecisionKind =
  | 'bargain' | 'credit' | 'coupon' | 'complaint' | 'outage' | 'childShort' | 'priceShock' | 'expense' | 'inspect'
  | 'negotiate' | 'suppliers' | 'transport' | 'offers' | 'ledger' | 'closing' | 'profit' | 'stockAudit'
  | 'creditKing' | 'debtor' | 'hiddenTotal' | 'booking' | 'repair';

export interface DecisionRow {
  /** Cells are either literal strings/numbers or i18n keys prefixed with '@' or product refs prefixed with '#'. */
  cells: (string | number)[];
}

export interface DecisionOption {
  /** i18n key. */
  key: string;
  params?: Record<string, string | number>;
}

export interface Decision {
  id: number;
  kind: DecisionKind;
  customerId?: number;
  /** i18n key for title and prompt. */
  title: string;
  prompt: string;
  params: Record<string, string | number>;
  /** Optional i18n key hint (customer mood etc.). */
  hint?: string;
  header?: string[]; // i18n keys for table header
  rows?: DecisionRow[];
  /** If true, tapping a table row is the answer (option index = row index); extra options follow rows. */
  rowSelect?: boolean;
  options: DecisionOption[];
  /** Index of the best option (known to the sim for scoring; also used by tutorial hints & tests). */
  best: number;
  /** Options that are acceptable but not best (no penalty, no bonus). */
  ok?: number[];
  deadlineTick: number;
  /** Ticks allowed once the decision is at the front of the queue. */
  ttl: number;
  /** Arbitrary integer payload used by the resolver. */
  data: Record<string, number | string | number[] | string[]>;
  boss?: boolean;
}

export type HotspotKind =
  | 'box' | 'leak' | 'thief' | 'expiry' | 'damaged' | 'flood' | 'search' | 'fire' | 'light' | 'changeRun';

export interface Hotspot {
  id: number;
  kind: HotspotKind;
  p?: string;
  born: number;
  /** Tick at which it expires (0 = never). */
  until: number;
  taps: number;
  /** For sequence hotspots: the required order (0,1,2). */
  seq?: number;
  /** Position seed for the view (0..999). */
  pos: number;
  data?: number;
}

export interface Delivery {
  id: number;
  p: string;
  units: number;
  arrive: number;
  /** 0 none, 1 wrong product, 2 short quantity, 3 damaged units. */
  defect: number;
  defectP?: string;
  cost: number;
  inspected?: boolean;
}

export type TimelineKind =
  | 'stockout' | 'lastPiece' | 'expiry' | 'damaged' | 'priceShock' | 'deliveryRush' | 'loadShedding' | 'rain'
  | 'flood' | 'outage' | 'fridge' | 'powerFailure' | 'leak' | 'thief' | 'crowd' | 'fire' | 'expense'
  | 'debtDue' | 'debtor' | 'offer' | 'ledger' | 'priceTick' | 'hiddenStock' | 'overstock' | 'stockAudit';

export interface TimelineEvent {
  kind: TimelineKind;
  /** When it fires, as a percentage (0..100) of the level's time budget. */
  at: number;
  /** Optional repeat interval in ticks (for endless-style modes). */
  every?: number;
  /** Integer parameter (meaning depends on kind: duration, count, amount…). */
  n?: number;
  /** Demand tag / product filter. */
  tag?: string;
}

export interface Modifiers {
  /** Restocking from the supplier is available. */
  restock?: boolean;
  /** Supplier lead time in ticks. */
  leadTicks?: number;
  /** Total cartons the supplier can provide this level (0/undefined = unlimited). */
  supplierCartons?: number;
  /** Percent chance a restock order triggers a negotiation. */
  negotiatePct?: number;
  /** Percent chance a restock order offers three suppliers. */
  suppliersPct?: number;
  /** Percent chance a delivery has transport trouble. */
  transportPct?: number;
  /** Percent chance a delivery is defective and needs inspection. */
  inspectPct?: number;
  /** Which defects can appear: 1 wrong product, 2 short, 3 damaged. */
  defects?: number[];
  /** Buy prices fluctuate (market price race). */
  marketPrices?: boolean;
  /** How the change due is presented. */
  changeHidden?: boolean;
  /** The till holds a finite number of notes per denomination. */
  limitedTill?: boolean;
  /** Percent chance a cash payer uses a large note. */
  bigNotePct?: number;
  fakeNotePct?: number;
  couponPct?: number;
  /** Shop credit limit (total outstanding allowed). */
  creditLimit?: number;
  /** Stock numbers are hidden from the player. */
  stockHidden?: boolean;
  /** Shelf positions are shuffled. */
  shelfShuffle?: boolean;
  /** End-of-day puzzles to run before the level finishes. */
  closing?: ('closing' | 'profit' | 'ledger')[];
  /** Level fails when mistakes exceed this number (undefined = no limit). */
  maxMistakes?: number;
  /** Extra demand weight per tag (percent, 100 = normal). */
  demand?: Partial<Record<DemandTag, number>>;
  /** Supplier debt that falls due at 70% of the level. */
  supplierDebt?: number;
  /** Every completed order also needs this free item (halkhata sweets). */
  giftItem?: string;
  /** Storage holds hidden stock that must be searched for. */
  hiddenStock?: boolean;
  /** Patience does not drain (guided tutorial levels). */
  noPatience?: boolean;
  /** Outside line capacity. */
  lineCap?: number;
  /** Percent chance a regular customer changes their mind about an item. */
  swapPct?: number;
  /** Percent chance a mobile-wallet/cash customer underpays (besides the miser). */
  focusTag?: DemandTag;
}

export type StatKey =
  | 'served' | 'lost' | 'taps' | 'wrongTaps' | 'perfect' | 'maxCombo' | 'streak' | 'bestStreak' | 'units' | 'revenue'
  | 'cogs' | 'expenses' | 'supplierSpend' | 'supplierBase' | 'creditGiven' | 'creditCollected' | 'creditOutstanding'
  | 'waste' | 'wasteValue' | 'mismatch' | 'decisionsGood' | 'decisionsBad' | 'mistakes' | 'satSum' | 'fastServes'
  | 'fastPays' | 'changeGiven' | 'fakeCaught' | 'shortCaught' | 'hotspotsDone' | 'hotspotsMissed' | 'stolen'
  | 'bossHits' | 'strikes' | 'bulkServed' | 'serveTicks' | 'bookingsDone' | 'bookingsFailed' | 'restocks'
  | 'apologies' | 'vipServed' | 'secretStars' | 'debtPaid' | 'debtFailed' | 'overLimit' | 'tagUnits' | 'deferred'
  | 'cashSales' | 'collected' | 'paidOut' | 'tips';

export type Stats = Record<StatKey, number> & { arch: Partial<Record<ArchetypeId, number>> };

/** Derived metrics objectives can test, on top of raw stats. */
export type MetricKey =
  | StatKey | 'accuracy' | 'satisfaction' | 'profit' | 'cash' | 'surviveSec' | 'bossDefeated' | 'score' | 'avgServeSec'
  | 'buyEfficiency' | 'reputation' | `arch:${ArchetypeId}`;

export interface Objective {
  metric: MetricKey;
  op: '>=' | '<=';
  target: number;
  /** Primary objectives must be met to win; bonus objectives only add score. */
  primary: boolean;
  /** i18n key for the label; receives {n}. */
  label: string;
}

export interface BossPhase {
  /** Phase is active while boss hp > this value. */
  untilHp: number;
  /** Ticks between boss moves. */
  every: number;
  /** Ticks allowed to answer a boss move. */
  deadline: number;
  /** Difficulty knob for puzzle generation (1..3). */
  level: number;
}

export type BossId = 'creditKing' | 'tycoon' | 'storm' | 'thief' | 'ghost';

export interface BossConfig {
  id: BossId;
  hp: number;
  maxStrikes: number;
  phases: BossPhase[];
}

export interface CustomerPlan {
  /** Number of customers (0 = unlimited). */
  count: number;
  /** Ticks between arrivals at the start. */
  interval: number;
  /** Lower bound for the arrival interval. */
  minInterval: number;
  /** Interval reduction per customer (percent of interval, endless ramp). */
  rampPct: number;
  mix: Partial<Record<ArchetypeId, number>>;
  /** Archetypes guaranteed to appear at least this many times (finite plans). */
  guaranteed?: Partial<Record<ArchetypeId, number>>;
  slots: number;
  size: [number, number];
  qty: [number, number];
  patiencePct: number;
}

export interface PaymentPlan {
  /** Percent of customers paying the exact amount. */
  exactPct: number;
  /** Percent paying by mobile wallet (rest pay cash needing change). */
  mobilePct: number;
}

export interface GameConfig {
  id: string;
  mode: Mode;
  /** Content version the config was built with. */
  v: number;
  seed: number;
  title: L10n;
  chapter: number;
  level?: number;
  difficulty: number; // 1..10
  durationTicks: number;
  products: string[];
  startCash: number;
  /** Starting stock as a percent of each product's initStock. */
  stockPct: number;
  customers: CustomerPlan;
  payment: PaymentPlan;
  mods: Modifiers;
  events: TimelineEvent[];
  objectives: Objective[];
  /** Score thresholds for 1/2/3 stars. */
  stars: [number, number, number];
  rewards: { coins: number; xp: number };
  challenges: string[];
  boss?: BossConfig;
  /** Tutorial cards to show before play (challenge ids / tutorial ids). */
  tutorials: string[];
  /** Guided hints (tap highlights) are shown. */
  guided?: boolean;
}

/** Player actions, encoded compactly for recording & replay: [tick, code, a, b, ...]. */
export const Act = {
  /** a = customer id */
  Select: 1,
  /** a = product index in cfg.products, b = units */
  Add: 2,
  /** a = order line index ("নেই") */
  NotAvailable: 3,
  /** collect an exact / mobile payment */
  Collect: 4,
  /** a.. = note counts per DENOMS */
  Change: 5,
  /** a = 1 fake note, 2 short payment, 3 no change possible */
  Flag: 6,
  /** a = decision id, b = option index */
  Decide: 7,
  /** a = hotspot id */
  Hotspot: 8,
  /** a = product index */
  Restock: 9,
  /** reveal a hidden (remembered) order */
  Reveal: 10,
} as const;
export type ActionTuple = number[];

export type SimEvent =
  | { t: 'spawn'; id: number }
  | { t: 'state'; id: number; state: CustomerState }
  | { t: 'say'; id: number; key: string; params?: Record<string, string | number> }
  | { t: 'tapOk'; id: number; p: string; done: boolean }
  | { t: 'tapBad'; p: string; why: 'wrong' | 'stock' | 'closed' }
  | { t: 'orderChange'; id: number }
  | { t: 'payStart'; id: number }
  | { t: 'payBad'; id: number; why: string }
  | { t: 'served'; id: number; points: number; perfect: boolean; combo: number; cash: number }
  | { t: 'lost'; id: number }
  | { t: 'decision'; id: number }
  | { t: 'decided'; id: number; good: boolean; ok: boolean; kind: DecisionKind }
  | { t: 'hotspot'; id: number }
  | { t: 'hotspotDone'; id: number; ok: boolean; kind: HotspotKind }
  | { t: 'banner'; key: string; tone: 'warn' | 'info' | 'good' | 'bad'; params?: Record<string, string | number> }
  | { t: 'flag'; name: FlagName; on: boolean }
  | { t: 'cash'; delta: number }
  | { t: 'points'; n: number; why: string }
  | { t: 'stock'; p: string }
  | { t: 'delivery'; p: string }
  | { t: 'boss'; what: 'intro' | 'hit' | 'strike' | 'phase' | 'defeated' | 'won' }
  | { t: 'end' };

export type FlagName = 'dark' | 'rain' | 'outage' | 'powerOut' | 'fridge' | 'closed' | 'fire';

export interface ObjectiveResult {
  objective: Objective;
  value: number;
  done: boolean;
}

export type EndReason = 'complete' | 'time' | 'reputation' | 'mistakes' | 'boss' | 'bossDefeated' | 'cash' | 'quit';

export interface RunResult {
  won: boolean;
  reason: EndReason;
  score: number;
  stars: number;
  ticks: number;
  objectives: ObjectiveResult[];
  accuracy: number;
  satisfaction: number;
  profit: number;
  stats: Stats;
}
