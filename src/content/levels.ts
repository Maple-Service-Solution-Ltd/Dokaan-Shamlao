/**
 * Story Mode: 100 levels in five chapters. Each row names the challenges (and their intensity 1–3)
 * that define the level; the builder derives customers, objectives, timing and rewards from them.
 */
import type { BossConfig, BossId, GameConfig, L10n } from '@/core/types';
import { hashString } from '@/core/rng';
import { applyChallenge, baseDraft, calibrate, challenge, finalize, withStars, CONTENT_VERSION } from './builder';

export interface LevelRow {
  n: number;
  title: L10n;
  /** [challengeId, intensity] pairs. */
  ch: [string, number][];
  boss?: BossId;
  /** Built-in tutorial cards (besides the challenge cards). */
  tut?: string[];
}

export interface ChapterDef { n: number; name: L10n; env: string; from: number; to: number; teaches: L10n; }

export const CHAPTERS: ChapterDef[] = [
  { n: 1, name: { bn: 'পাড়ার ছোট দোকান', en: 'Small Neighbourhood Shop' }, env: 'para', from: 1, to: 20,
    teaches: { bn: 'পণ্য বাছাই, অর্ডার, টাকা নেওয়া, খুচরা ফেরত, কাস্টমার সেবা', en: 'Product selection, orders, payment, change, customer service' } },
  { n: 2, name: { bn: 'ব্যস্ত মুদি দোকান', en: 'Busy Grocery Shop' }, env: 'bazar', from: 21, to: 40,
    teaches: { bn: 'লাইন, দরদাম, বাকি, স্টক, মাল তোলা', en: 'Queues, bargaining, credit, inventory, restocking' } },
  { n: 3, name: { bn: 'এলাকার জনপ্রিয় স্টোর', en: 'Popular Local Store' }, env: 'store', from: 41, to: 60,
    teaches: { bn: 'মহাজন, পাইকারি, খরচ, ক্যাশ মেলানো, জরুরি অবস্থা', en: 'Suppliers, bulk orders, expenses, cash reconciliation, emergencies' } },
  { n: 4, name: { bn: 'সুপার শপ', en: 'Super Shop' }, env: 'super', from: 61, to: 80,
    teaches: { bn: 'একসাথে অনেক কাস্টমার, জটিল স্টক, মহাজনের প্রতিযোগিতা, মৌসুমি চাহিদা', en: 'Simultaneous customers, complex inventory, supplier competition, seasonal demand' } },
  { n: 5, name: { bn: 'দোকান সম্রাটের চ্যালেঞ্জ', en: 'Shop King Challenge' }, env: 'king', from: 81, to: 100,
    teaches: { bn: 'সব কৌশল একসাথে, একাধিক বস, চূড়ান্ত লড়াই', en: 'Everything combined, multiple bosses, the final showdown' } },
];

const L = (n: number, bn: string, en: string, ch: [string, number][] = [], extra: Partial<LevelRow> = {}): LevelRow => ({ n, title: { bn, en }, ch, ...extra });

export const LEVEL_ROWS: LevelRow[] = [
  // ── Chapter 1: পাড়ার ছোট দোকান ──
  L(1, 'প্রথম খদ্দের', 'First Customer', [], { tut: ['basics'] }),
  L(2, 'দুই পদের বাজার', 'Two-Item Orders', [], { tut: ['multi'] }),
  L(3, 'খুচরা ফেরত', 'Giving Change', [], { tut: ['change'] }),
  L(4, 'পরিমাণ মিলিয়ে', 'Mind the Quantity', [], { tut: ['qty'] }),
  L(5, 'লাইন পড়েছে', 'A Line Forms', [], { tut: ['queue'] }),
  L(6, 'অধৈর্য ভাই', 'In a Hurry', [['impatient', 1]]),
  L(7, 'ঝটপট হাত', 'Quick Hands', [['speed_master', 1]]),
  L(8, 'সকালের তাড়া', 'Morning Rush', [['impatient', 2]]),
  L(9, 'ঘড়ির সাথে পাল্লা', 'Beat the Clock', [['speed_master', 2], ['impatient', 1]]),
  L(10, 'নিখুঁত দিন', 'A Perfect Day', [['perfect_accuracy', 1]]),
  L(11, 'ভুলোমনা খালা', 'The Confused Aunty', [['confused', 1]]),
  L(12, 'ওহ্‌, ভুলে গেছি!', 'Oh, I Forgot!', [['forgetful', 1]]),
  L(13, 'মত বদল', 'Change of Mind', [['wrong_order', 1]]),
  L(14, 'বড় নোট, ছোট ফেরত', 'Big Notes', [['change_master', 1]]),
  L(15, 'কিপ্টা কাস্টমার', 'The Miser', [['kipta', 1]]),
  L(16, 'রাগী কাস্টমার', 'The Angry One', [['angry', 1], ['customer_happiness', 1]]),
  L(17, 'পাঁচে পাঁচ', 'Five in a Row', [['five_perfect', 1], ['forgetful', 1]]),
  L(18, 'লাইনের বিপর্যয়', 'Queue Disaster', [['queue_disaster', 1]]),
  L(19, 'খুচরার আকাল', 'No Small Change', [['change_problem', 1], ['kipta', 1]]),
  L(20, 'বস: কাস্টমার ঝড়', 'Boss: Customer Storm', [], { boss: 'storm' }),
  // ── Chapter 2: ব্যস্ত মুদি দোকান ──
  L(21, 'মাল ফুরালো!', 'Out of Stock!', [['stock_out', 1]], { tut: ['restock'] }),
  L(22, 'দরদামের ওস্তাদ', 'Bargain Master', [['bargain', 1]]),
  L(23, 'বাকির খাতা', 'The Credit Book', [['credit', 1]]),
  L(24, 'তিনজন একসাথে', 'Three at Once', [['queue_disaster', 2], ['impatient', 1]]),
  L(25, 'শেষ পিস', 'The Last Piece', [['last_piece', 1]]),
  L(26, 'পাইকারি ক্রেতা', 'Bulk Buyer', [['bulk', 1], ['stock_out', 1]]),
  L(27, 'মেয়াদ শেষের পথে', 'Expiry Alert', [['expiry', 1]]),
  L(28, 'স্কুল খুলেছে', 'School Reopens', [['school_reopening', 1]]),
  L(29, 'ভিআইপি এসেছেন', 'VIP in the House', [['vip', 1], ['perfect_accuracy', 1]]),
  L(30, 'রমজানের ভিড়', 'Ramadan Rush', [['ramadan_rush', 1]]),
  L(31, 'আগের মতোই দেন', 'Same as Before', [['repeat', 1]]),
  L(32, 'ডেলিভারি দেরি', 'Delivery Delay', [['delivery_delay', 1]]),
  L(33, 'দাম বেড়েছে!', 'Price Shock', [['price_shock', 1], ['bargain', 1]]),
  L(34, 'পুরো পরিবার', 'Family Shopping', [['family', 1], ['forgetful', 2]]),
  L(35, 'বাকি আদায়', 'Collecting Dues', [['credit_collection', 1], ['credit', 1]]),
  L(36, 'নষ্ট মাল', 'Damaged Goods', [['damaged_goods', 1], ['angry', 1]]),
  L(37, 'গোপন ক্রেতা', 'Secret Shopper', [['secret_shopper', 1], ['bargain', 2]]),
  L(38, 'ঈদের চাহিদা', 'Eid Demand', [['eid_demand', 1], ['bulk', 1]]),
  L(39, 'শূন্য অপচয়', 'Zero Waste', [['zero_waste', 1], ['damaged_goods', 1]]),
  L(40, 'বস: বাকি সম্রাট', 'Boss: Credit King', [], { boss: 'creditKing' }),
  // ── Chapter 3: এলাকার জনপ্রিয় স্টোর ──
  L(41, 'পাইকারি বাজেট', 'Wholesale Budget', [['wholesale_budget', 1]]),
  L(42, 'লোডশেডিং', 'Load Shedding', [['load_shedding', 1]]),
  L(43, 'হঠাৎ খরচ', 'Unexpected Expense', [['unexpected_expense', 1], ['vip', 1]]),
  L(44, 'দিনের হিসাব', 'Daily Closing', [['daily_closing', 1]]),
  L(45, 'ডেলিভারি পরীক্ষা', 'Delivery Inspection', [['delivery_inspection', 1]]),
  L(46, 'ঝুম বৃষ্টি', 'Heavy Rain', [['heavy_rain', 1], ['sudden_crowd', 1]]),
  L(47, 'জাল নোট!', 'Fake Note!', [['suspicious_note', 1]]),
  L(48, 'মহাজনের সাথে দরাদরি', 'Supplier Negotiation', [['supplier_negotiation', 1]]),
  L(49, 'ক্যাশ মিলছে না', 'Cash Mismatch', [['cash_mismatch', 1], ['change_master', 2]]),
  L(50, 'পহেলা বৈশাখ — হালখাতা', 'Pohela Boishakh', [['pohela_boishakh', 1]]),
  L(51, 'ভুল চালান', 'Wrong Shipment', [['wrong_shipment', 1]]),
  L(52, 'ছাদ চুঁইছে', 'Leaky Roof', [['water_leakage', 1], ['heavy_rain', 1]]),
  L(53, 'ছাড়ের ফাঁদ', 'Discount Trap', [['discount_trap', 1], ['kipta', 2]]),
  L(54, 'মহাজনের দেনা', 'Supplier Debt', [['supplier_debt', 1]]),
  L(55, 'ফ্রিজ নষ্ট', 'Fridge Breakdown', [['fridge_breakdown', 1]]),
  L(56, 'হিসাবের গোলমাল', 'Hisab Golmal', [['hisab_golmal', 1], ['credit', 2]]),
  L(57, 'চোর চোর!', 'Thief!', [['security_alert', 1], ['bulk', 2]]),
  L(58, 'লাভ না ক্ষতি?', 'Profit or Loss?', [['profit_or_loss', 1], ['unexpected_expense', 1]]),
  L(59, 'বর্ষার বাজার', 'Monsoon Market', [['monsoon_market', 1]]),
  L(60, 'বস: পাইকারি মহাজন', 'Boss: Wholesale Tycoon', [], { boss: 'tycoon' }),
  // ── Chapter 4: সুপার শপ ──
  L(61, 'তিন মহাজনের দৌড়', 'Three Supplier Race', [['three_supplier_race', 1]]),
  L(62, 'নেট নেই!', 'Internet Outage', [['internet_outage', 1]]),
  L(63, 'গুদামে দৌড়', 'Warehouse Rush', [['warehouse_rush', 1], ['bulk', 2]]),
  L(64, 'ক্রিকেট জ্বর', 'Cricket Fever', [['cricket_tournament', 1]]),
  L(65, 'ক্যালকুলেটর বন্ধ', 'Dead Calculator', [['power_failure', 1]]),
  L(66, 'নকল ছাড়', 'Fake Discount', [['fake_discount', 1], ['stock_out', 2]]),
  L(67, 'বন্যার সতর্কতা', 'Flood Warning', [['flood_warning', 1], ['heavy_rain', 2]]),
  L(68, 'বিয়ের মৌসুম', 'Wedding Season', [['wedding_season', 1]]),
  L(69, 'সীমিত মাল', 'Limited Stock', [['limited_stock', 1], ['last_piece', 2]]),
  L(70, 'শীতের বাজার', 'Winter Market', [['winter_market', 1], ['confused', 2]]),
  L(71, 'খুঁজে বের করো', 'Product Hunt', [['product_hunt', 1], ['impatient', 2]]),
  L(72, 'গাড়ি আটকা', 'Transport Trouble', [['transport_trouble', 1], ['delivery_delay', 1]]),
  L(73, 'বাজারদরের দৌড়', 'Market Price Race', [['market_price_race', 1]]),
  L(74, 'লুকানো মাল', 'Hidden Stock', [['hidden_stock', 1], ['family', 2]]),
  L(75, 'পূজার কেনাকাটা', 'Puja Shopping', [['puja_shopping', 1]]),
  L(76, 'অতিরিক্ত মাল', 'Overstock', [['overstock', 1], ['expiry', 2]]),
  L(77, 'ফায়ার অ্যালার্ম', 'Fire Alarm', [['fire_alarm', 1], ['sudden_crowd', 2]]),
  L(78, 'স্মৃতির পরীক্ষা', 'Memory Test', [['inventory_memory', 1], ['repeat', 2]]),
  L(79, 'চাঁদ রাত', 'Chand Raat', [['chand_raat', 1]]),
  L(80, 'বস: চোর ধরো', 'Boss: Missing Stock', [], { boss: 'thief' }),
  // ── Chapter 5: দোকান সম্রাটের চ্যালেঞ্জ ──
  L(81, 'ঈদের কেনাকাটা', 'Eid Shopping Rush', [['eid_shopping_rush', 2], ['bargain', 2]]),
  L(82, 'টানাটানির দিন', 'Tight Budget', [['limited_budget', 1], ['supplier_debt', 1], ['credit', 2]]),
  L(83, 'নববর্ষের রাত', 'New Year Night', [['new_year_shopping', 2], ['discount_trap', 2]]),
  L(84, 'বস: বাকি সম্রাট ফিরে এলো', 'Boss: Credit King Returns', [], { boss: 'creditKing' }),
  L(85, 'উৎসবে দামের আগুন', 'Festival Price Shock', [['festival_price_shock', 2], ['kipta', 2]]),
  L(86, 'ক্যাশ কাউন্টার মাস্টার', 'Cash Counter Master', [['cash_counter_master', 2], ['suspicious_note', 2]]),
  L(87, 'ভুল চলবে না', 'No Mistakes', [['no_mistakes', 1], ['confused', 2], ['wrong_order', 2]]),
  L(88, 'বস: মহাজনের প্রতিশোধ', 'Boss: Tycoon\'s Revenge', [], { boss: 'tycoon' }),
  L(89, 'ঝড়-বৃষ্টি-লোডশেডিং', 'Storm, Rain & Blackout', [['heavy_rain', 2], ['load_shedding', 2], ['water_leakage', 2], ['internet_outage', 1]]),
  L(90, 'ফাস্ট চেকআউট', 'Fast Checkout', [['fast_checkout', 2], ['queue_disaster', 2], ['impatient', 2]]),
  L(91, 'সাপ্লাই চেইন', 'Supply Chain', [['three_supplier_race', 2], ['delivery_inspection', 2], ['transport_trouble', 1]]),
  L(92, 'বস: মহাঝড়', 'Boss: The Great Storm', [], { boss: 'storm' }),
  L(93, 'হরেক রকম কাস্টমার', 'All Kinds of Customers', [['family', 2], ['vip', 2], ['secret_shopper', 2], ['angry', 2]]),
  L(94, 'হিসাবের দিন', 'Day of Reckoning', [['daily_closing', 2], ['profit_or_loss', 2], ['hisab_golmal', 2], ['unexpected_expense', 2]]),
  L(95, 'উৎসবের মহাভিড়', 'Festival Mega Rush', [['eid_shopping_rush', 2], ['price_shock', 2], ['family', 1]]),
  L(96, 'বস: চোরের দল', 'Boss: The Thief Gang', [], { boss: 'thief' }),
  L(97, 'বিপদের দিন', 'Day of Disasters', [['fire_alarm', 2], ['security_alert', 2], ['power_failure', 2], ['flood_warning', 2]]),
  L(98, 'শেষ প্রস্তুতি', 'Final Preparation', [['customer_happiness', 3], ['five_perfect', 3], ['speed_master', 2], ['bulk', 2]]),
  L(99, 'দোকান সম্রাটের পরীক্ষা', 'The Shop King\'s Exam', [['bargain', 3], ['credit', 2], ['stock_out', 2], ['daily_closing', 2], ['suspicious_note', 2], ['heavy_rain', 2]]),
  L(100, 'শেষ বস: হিসাবের ভূত', 'Final Boss: Accounting Ghost', [], { boss: 'ghost' }),
];

export const BOSS_NAMES: Record<BossId, { name: L10n; taunt: L10n; look: string; how: L10n }> = {
  storm: {
    name: { bn: 'কাস্টমার ঝড়', en: 'Customer Storm' }, look: 'boss_storm',
    taunt: { bn: 'পুরো পাড়া একসাথে এসেছে! সামলাও দেখি!', en: 'The whole neighbourhood is here at once! Handle that!' },
    how: { bn: 'ঝড় থামাতে সব কাস্টমারকে সামলান। ৩ জন হারালেই হার।', en: 'Serve every customer to calm the storm. Lose 3 and it is over.' },
  },
  creditKing: {
    name: { bn: 'বাকি সম্রাট', en: 'Credit King' }, look: 'boss_king',
    taunt: { bn: 'আমি এই পাড়ার বাকি সম্রাট! খাতায় লিখে রাখো…', en: 'I am the Credit King of this para! Put it on my tab…' },
    how: { bn: 'বাকির সীমা পার না করে সিদ্ধান্ত নিন: পুরো বাকি, অর্ধেক নগদ, নাকি না।', en: 'Decide without breaking the credit limit: full credit, half cash, or no.' },
  },
  tycoon: {
    name: { bn: 'পাইকারি মহাজন', en: 'Wholesale Tycoon' }, look: 'boss_tycoon',
    taunt: { bn: 'স্পেশাল ডিসকাউন্ট! শুধু আজকের জন্য! হে হে…', en: 'Special discount! Today only! Heh heh…' },
    how: { bn: 'প্রতি পিসের আসল দাম কষুন; বাজেটের মধ্যে সবচেয়ে সস্তা অফার বাছুন।', en: 'Work out the true unit price; pick the cheapest offer within budget.' },
  },
  thief: {
    name: { bn: 'চোর ধরো', en: 'Missing Stock' }, look: 'boss_thief',
    taunt: { bn: 'তাকের মাল হাওয়া! ধরতে পারলে ধরো!', en: 'Stock is vanishing! Catch me if you can!' },
    how: { bn: 'স্টক মিলিয়ে গরমিলের লাইন ধরুন, আর চোর দেখলেই ট্যাপ করুন।', en: 'Find the row where stock does not add up, and tap the thief on sight.' },
  },
  ghost: {
    name: { bn: 'হিসাবের ভূত', en: 'Accounting Ghost' }, look: 'boss_ghost',
    taunt: { bn: 'হু হু হু… তোমার খাতার সব অঙ্ক আমি গুলিয়ে দেব!', en: 'Whooo… I will scramble every number in your books!' },
    how: { bn: 'ভুল লাইন ধরুন, লাভ কষুন, দিনের ক্যাশ মেলান — ভূত তাড়ান!', en: 'Spot wrong lines, work out profit, balance the cash — banish the ghost!' },
  },
};

function bossConfig(id: BossId, tier: 1 | 2): BossConfig {
  const hard = tier === 2;
  switch (id) {
    case 'storm': return {
      id, hp: hard ? 18 : 12, maxStrikes: 3, phases: [
        { untilHp: hard ? 12 : 8, every: hard ? 46 : 58, deadline: 0, level: 1 },
        { untilHp: hard ? 6 : 4, every: hard ? 38 : 48, deadline: 0, level: 2 },
        { untilHp: 0, every: hard ? 32 : 40, deadline: 0, level: 3 },
      ],
    };
    case 'creditKing': return {
      id, hp: hard ? 8 : 6, maxStrikes: 3, phases: [
        { untilHp: hard ? 5 : 4, every: 110, deadline: hard ? 110 : 150, level: hard ? 2 : 1 },
        { untilHp: 2, every: 100, deadline: hard ? 90 : 120, level: hard ? 3 : 2 },
        { untilHp: 0, every: 90, deadline: hard ? 75 : 100, level: 3 },
      ],
    };
    case 'tycoon': return {
      id, hp: hard ? 7 : 5, maxStrikes: 3, phases: [
        { untilHp: hard ? 5 : 3, every: 120, deadline: hard ? 220 : 300, level: hard ? 2 : 1 },
        { untilHp: 2, every: 110, deadline: hard ? 190 : 260, level: hard ? 3 : 2 },
        { untilHp: 0, every: 100, deadline: hard ? 170 : 230, level: 3 },
      ],
    };
    case 'thief': return {
      id, hp: hard ? 10 : 8, maxStrikes: 3, phases: [
        { untilHp: hard ? 7 : 5, every: 90, deadline: hard ? 200 : 260, level: hard ? 2 : 1 },
        { untilHp: 3, every: 80, deadline: hard ? 170 : 220, level: hard ? 3 : 2 },
        { untilHp: 0, every: 70, deadline: hard ? 150 : 190, level: 3 },
      ],
    };
    default: return {
      id: 'ghost', hp: 8, maxStrikes: 3, phases: [
        { untilHp: 5, every: 110, deadline: 280, level: 2 },
        { untilHp: 2, every: 100, deadline: 240, level: 3 },
        { untilHp: 0, every: 90, deadline: 210, level: 3 },
      ],
    };
  }
}

export function levelRow(n: number): LevelRow {
  const row = LEVEL_ROWS[n - 1];
  if (!row || row.n !== n) throw new Error(`Unknown level ${n}`);
  return row;
}

export const storySeed = (n: number): number => hashString(`story:${n}:v${CONTENT_VERSION}`);

const cache = new Map<number, GameConfig>();

/** Builds the full, calibrated config for a story level (memoised; configs are treated as immutable). */
export function storyConfig(n: number): GameConfig {
  const hit = cache.get(n);
  if (hit) return hit;
  const row = levelRow(n);
  const d = baseDraft(n, `story:${n}`, storySeed(n));
  const cfg = d.cfg;
  cfg.title = row.title;
  for (const t of row.tut ?? []) cfg.tutorials.push(t);
  if (row.boss) {
    const tier = n > 80 && n < 100 ? 2 : 1;
    cfg.boss = bossConfig(row.boss, tier);
    cfg.tutorials.push(`boss:${row.boss}`);
    const c = cfg.customers;
    c.count = 0;
    c.slots = 3;
    cfg.durationTicks = row.boss === 'storm' ? (tier === 2 ? 2400 : 1900) : 2600;
    cfg.rewards = { coins: cfg.rewards.coins * 3, xp: cfg.rewards.xp * 3 };
    cfg.stockPct = 1000;
    cfg.mods = { lineCap: 6 };
    switch (row.boss) {
      case 'storm':
        c.mix = tier === 2 ? { regular: 40, impatient: 20, bulk: 10, child: 10, elderly: 10, forgetful: 10 } : { regular: 55, impatient: 20, child: 15, elderly: 10 };
        c.patiencePct = tier === 2 ? 115 : 135;
        break;
      case 'creditKing':
        c.mix = { regular: 60, credit: 25, bargain: 15 }; c.interval = 85; c.minInterval = 60; cfg.mods.creditLimit = 1500;
        break;
      case 'tycoon':
        c.mix = { regular: 70, bulk: 15, impatient: 15 }; c.interval = 95; c.minInterval = 70;
        break;
      case 'thief':
        c.mix = { regular: 70, impatient: 15, forgetful: 15 }; c.interval = 100; c.minInterval = 75;
        break;
      default:
        c.mix = { regular: 60, kipta: 20, confused: 20 }; c.interval = 110; c.minInterval = 80;
        cfg.events.push({ kind: 'powerFailure', at: 30, n: 300, every: 900 });
        break;
    }
  }
  for (const [id, intensity] of row.ch) applyChallenge(d, challenge(id), intensity);
  finalize(d);
  withStars(cfg, calibrate(cfg).skilledScore);
  cache.set(n, cfg);
  return cfg;
}

export const TOTAL_LEVELS = LEVEL_ROWS.length;
export const isBossLevel = (n: number): boolean => !!LEVEL_ROWS[n - 1]?.boss;
export const chapterOf = (n: number): ChapterDef => CHAPTERS[Math.min(4, Math.floor((n - 1) / 20))]!;
