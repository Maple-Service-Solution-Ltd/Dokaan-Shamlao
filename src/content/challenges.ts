/**
 * Central challenge registry. Every challenge is structured data: what it changes in the shop
 * (customer mix, modifiers, timeline events), how success is measured (objectives), and its rewards.
 * The level builder and the random generator both compose levels from these templates,
 * so adding a challenge never requires touching the engine.
 */
import type { ArchetypeId, DemandTag, L10n, MetricKey, Modifiers, TimelineKind } from '@/core/types';

export type ChallengeCategory = 'customer' | 'inventory' | 'cash' | 'emergency' | 'supplier' | 'seasonal' | 'skill';
/** A value per intensity level (1..3), or one value for all. */
export type Scaled = number | [number, number, number];

export interface ObjectiveTemplate {
  metric: MetricKey;
  op: '>=' | '<=';
  target: Scaled;
  /** 'pct' = percent of the customer count, 'each' = multiplied by the customer count. */
  scale?: 'pct' | 'each';
  primary?: boolean;
}

export interface EventTemplate {
  kind: TimelineKind;
  /** Trigger: percent of level progress. */
  at: number;
  n?: Scaled;
  /** Only added from this intensity upward. */
  from?: number;
}

export interface ChallengeEffects {
  mix?: Partial<Record<ArchetypeId, number>>;
  guaranteed?: Partial<Record<ArchetypeId, Scaled>>;
  mods?: Modifiers;
  /** Numeric modifiers that scale with intensity. */
  scaledMods?: Partial<Record<'fakeNotePct' | 'couponPct' | 'bigNotePct' | 'swapPct' | 'inspectPct' | 'transportPct' | 'supplierCartons' | 'supplierDebt' | 'maxMistakes', Scaled>>;
  /** changeHidden only from this intensity. */
  changeHiddenFrom?: number;
  events?: EventTemplate[];
  /** Multipliers in percent (100 = unchanged). */
  patiencePct?: number;
  intervalPct?: number;
  startCashPct?: number;
  stockPct?: number;
  minSlots?: number;
  lineCap?: number;
  exactPct?: number;
  mobilePct?: number;
  /** Forbids restocking even if another challenge enables it. */
  lockRestock?: boolean;
}

export interface ChallengeDef {
  id: string;
  category: ChallengeCategory;
  name: L10n;
  /** What happens. */
  description: L10n;
  /** What the player must do (shown on the tutorial card). */
  howTo: L10n;
  /** How failure is determined, in words (the machine-readable part is the primary objectives / modifiers). */
  failure: L10n;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Story level from which the challenge may appear (prerequisite progression). */
  minLevel: number;
  /** Challenges that must already have been introduced. */
  requires?: string[];
  /** Typical extra seconds the challenge adds to a level. */
  durationSec: number;
  needsTag?: DemandTag;
  needsCold?: boolean;
  incompatible?: string[];
  effects: ChallengeEffects;
  objectives: ObjectiveTemplate[];
  /** Score rule: bonus points when all of this challenge's objectives are met (on top of +100 per objective). */
  bonus: number;
  rewards: { coins: number; xp: number };
  tutorial: boolean;
}

type Txt = [bn: string, en: string];
const t = (x: Txt): L10n => ({ bn: x[0], en: x[1] });

function def(
  id: string, category: ChallengeCategory, difficulty: ChallengeDef['difficulty'], minLevel: number,
  name: Txt, description: Txt, howTo: Txt, failure: Txt,
  effects: ChallengeEffects, objectives: ObjectiveTemplate[], extra: Partial<ChallengeDef> = {},
): ChallengeDef {
  return {
    id, category, difficulty, minLevel, name: t(name), description: t(description), howTo: t(howTo), failure: t(failure),
    effects, objectives: objectives.map((o) => ({ primary: true, ...o })), durationSec: 10 + difficulty * 5,
    bonus: 50 * difficulty, rewards: { coins: 10 * difficulty, xp: 15 * difficulty }, tutorial: true, ...extra,
  };
}

const ge = (metric: MetricKey, target: Scaled, scale?: 'pct' | 'each'): ObjectiveTemplate => ({ metric, op: '>=', target, scale });
const le = (metric: MetricKey, target: Scaled): ObjectiveTemplate => ({ metric, op: '<=', target });

export const CHALLENGES: ChallengeDef[] = [
  // ════════════════ A. Customer challenges ════════════════
  def('impatient', 'customer', 1, 6, ['অধৈর্য কাস্টমার', 'Impatient Customer'],
    ['তাড়াহুড়োর কাস্টমার আসে — ধৈর্য অর্ধেক।', 'Customers in a hurry arrive with half the patience.'],
    ['লাল ধৈর্য-বার দেখলেই আগে তাকে সামলান।', 'Serve them first when their patience bar turns red.'],
    ['অধৈর্য কাস্টমার চলে গেলে লক্ষ্য পূরণ হবে না।', 'The goal fails if impatient customers walk out.'],
    { mix: { impatient: 25 }, guaranteed: { impatient: [2, 3, 4] } }, [ge('arch:impatient', [2, 3, 4])]),
  def('bargain', 'customer', 2, 22, ['দরদামের ওস্তাদ', 'Bargain Master'],
    ['কাস্টমার দাম কমাতে বলে। কথার ধরনে বোঝা যায় কতটা ছাড় লাগবে।', 'A customer haggles. Their tone tells you how much discount it takes.'],
    ['নরম সুর → দাম ফিক্সড, মাঝারি → অল্প ছাড়, কড়া → পুরো ছাড়।', 'Soft tone → hold the price, medium → small discount, firm → full discount.'],
    ['ভুল জবাবে কাস্টমার রেগে চলে যায়।', 'The wrong answer makes the customer storm off.'],
    { mix: { bargain: 20 }, guaranteed: { bargain: [2, 3, 4] } }, [ge('arch:bargain', [1, 2, 3])]),
  def('credit', 'customer', 3, 23, ['বাকির কাস্টমার', 'Credit Customer'],
    ['কাস্টমার বাকিতে চায়। বাকির একটা সীমা আছে।', 'A customer wants to buy on credit. Your shop has a credit limit.'],
    ['বিশ্বাস ★★★★+ আর সীমার মধ্যে হলে বাকি দিন; নইলে অর্ধেক নগদ বা না।', 'Give credit to ★★★★+ trust within the limit; otherwise half cash or refuse.'],
    ['বাকির সীমা পার হলে লক্ষ্য ব্যর্থ।', 'Going over the credit limit fails the goal.'],
    { mix: { credit: 20 }, guaranteed: { credit: [2, 3, 3] }, mods: { creditLimit: 1500 } },
    [le('overLimit', 0), ge('decisionsGood', [1, 2, 2])]),
  def('confused', 'customer', 2, 11, ['ভুলোমনা খালা', 'Confused Customer'],
    ['নাম মনে নেই — পণ্যের বর্ণনা দেয়।', 'Cannot remember names — describes the product instead.'],
    ['ধাঁধা পড়ে ঠিক পণ্যটা দিন।', 'Read the riddle and pick the right product.'],
    ['ভুল পণ্য দিলে নির্ভুলতা কমে।', 'Wrong guesses reduce accuracy.'],
    { mix: { confused: 20 }, guaranteed: { confused: [2, 3, 4] } }, [ge('arch:confused', [2, 3, 4])]),
  def('angry', 'customer', 2, 16, ['রাগী কাস্টমার', 'Angry Customer'],
    ['অভিযোগ নিয়ে আসে — নষ্ট মাল বা বেশি দাম নেওয়ার।', 'Arrives with a complaint — bad goods or being overcharged.'],
    ['রসিদ মিলিয়ে দেখুন: অভিযোগ সত্যি হলে ফেরত, নইলে বুঝিয়ে বলুন।', 'Check the receipt: refund if the claim is true, otherwise explain politely.'],
    ['ভুল সামলালে ধৈর্য অর্ধেক হয়ে যায়।', 'Mishandling halves their patience.'],
    { mix: { angry: 15 }, guaranteed: { angry: [1, 2, 3] } }, [ge('arch:angry', [1, 2, 3])]),
  def('vip', 'customer', 3, 29, ['ভিআইপি কাস্টমার', 'VIP Customer'],
    ['বড় অর্ডার, বড় নোট, কম ধৈর্য।', 'Big order, big notes, little patience.'],
    ['নিখুঁতভাবে সামলালে বকশিশ পাবেন।', 'Serve flawlessly to earn a tip.'],
    ['ভিআইপি চলে গেলে সুনাম অনেক কমে।', 'Losing a VIP costs a lot of reputation.'],
    { mix: { vip: 10 }, guaranteed: { vip: [1, 2, 2] } }, [ge('vipServed', [1, 2, 2])]),
  def('bulk', 'customer', 2, 26, ['পাইকারি ক্রেতা', 'Bulk Buyer'],
    ['একই জিনিস ৫–১০টা করে নেয়।', 'Buys 5–10 units of the same item.'],
    ['×৫ বোতাম চালু করে দ্রুত দিন। স্টকের দিকে খেয়াল রাখুন।', 'Switch on ×5 to bag quickly. Watch your stock.'],
    ['পাইকারি অর্ডার পূরণ না হলে লক্ষ্য ব্যর্থ।', 'The goal fails if bulk orders are not fulfilled.'],
    { mix: { bulk: 15 }, guaranteed: { bulk: [2, 3, 3] } }, [ge('bulkServed', [2, 3, 3])]),
  def('forgetful', 'customer', 1, 12, ['ভুলে-যাওয়া কাস্টমার', 'Forgetful Customer'],
    ['সব দেওয়ার পর বলে "ওহ্‌, আরেকটা জিনিস!"', 'After everything is bagged: "oh, one more thing!"'],
    ['বাড়তি জিনিসটাও দিন, তারপর টাকা নিন।', 'Add the extra item, then take payment.'],
    ['ধৈর্য ফুরালে কাস্টমার হারাবেন।', 'You lose the customer if patience runs out.'],
    { mix: { forgetful: 20 }, guaranteed: { forgetful: [2, 3, 4] } }, [ge('arch:forgetful', [2, 3, 4])]),
  def('queue_disaster', 'customer', 3, 18, ['লাইনের বিপর্যয়', 'Queue Disaster'],
    ['একসাথে অনেকে এসে লাইন লম্বা করে ফেলে। লাইন ভরে গেলে লোক ফিরে যায়।', 'A rush fills the line. When it is full, people walk past.'],
    ['কার ধৈর্য কম দেখে কাস্টমার বেছে নিন — ট্যাপ করে বদলান।', 'Pick who to serve by patience — tap a customer to switch.'],
    ['নির্দিষ্ট সংখ্যার বেশি কাস্টমার হারালে ব্যর্থ।', 'Fails if too many customers are lost.'],
    { events: [{ kind: 'crowd', at: 30, n: [3, 4, 5] }, { kind: 'crowd', at: 70, n: 3, from: 3 }], minSlots: 2, lineCap: 4 },
    [le('lost', [2, 1, 1])]),
  def('wrong_order', 'customer', 2, 13, ['মত বদল', 'Wrong Order'],
    ['কাস্টমার মাঝপথে মত বদলায়: "না না, ওটা না, এটা দেন!"', 'The customer changes their mind mid-order.'],
    ['অর্ডারের বদলটা লক্ষ করুন, নতুন পণ্য দিন।', 'Notice the changed order and bag the new item.'],
    ['ভুল ট্যাপে নির্ভুলতা লক্ষ্যের নিচে নামলে ব্যর্থ।', 'Fails if wrong taps drag accuracy below target.'],
    { scaledMods: { swapPct: [50, 70, 90] } }, [ge('accuracy', [80, 85, 90])]),
  def('kipta', 'customer', 2, 15, ['কিপ্টা কাস্টমার', 'Kipta Customer'],
    ['টাকা কম দিয়ে পার পেতে চায়।', 'Tries to get away with paying less.'],
    ['দেওয়া টাকা বিলের চেয়ে কম হলে "টাকা কম!" চাপুন।', 'If the money handed over is less than the bill, press "Short!".'],
    ['কম টাকা নিয়ে নিলে ক্যাশে গরমিল হয়।', 'Accepting short payment causes a cash mismatch.'],
    { mix: { kipta: 20 }, guaranteed: { kipta: [2, 3, 3] } }, [ge('shortCaught', [1, 2, 3])]),
  def('change_problem', 'customer', 3, 19, ['খুচরার আকাল', 'Change Problem'],
    ['ড্রয়ারে খুচরা নোট সীমিত।', 'The drawer has limited small notes.'],
    ['যে নোট আছে তা দিয়েই ফেরত মেলান। অসম্ভব হলে "খুচরা নেই" চাপুন, বা ভাঙতি আনুন।', 'Make change from the notes you have. If impossible press "No change", or fetch change.'],
    ['ভুল ফেরতে ক্যাশ গরমিল হলে ব্যর্থ।', 'Fails if wrong change causes a cash mismatch.'],
    { mods: { limitedTill: true }, exactPct: 0, scaledMods: { bigNotePct: [40, 50, 60] } },
    [le('mismatch', 0), ge('changeGiven', [2, 3, 4])]),
  def('repeat', 'customer', 3, 31, ['নিয়মিত কাস্টমার', 'Repeat Customer'],
    ['প্রথমবার অর্ডার দেখায়, পরেরবার বলে "আগের মতোই দেন"।', 'Shows the order once, then returns asking for "the same as before".'],
    ['প্রথম অর্ডারটা মনে রাখুন। ভুলে গেলে "মনে নেই" চাপা যায় (পয়েন্ট কমে)।', 'Remember the first order. "Remind me" reveals it at a cost.'],
    ['দুবারই সামলাতে না পারলে ব্যর্থ।', 'Fails unless both visits are served.'],
    { guaranteed: { repeat: [1, 1, 2] } }, [ge('arch:repeat', [2, 2, 4])]),
  def('secret_shopper', 'customer', 4, 37, ['গোপন ক্রেতা', 'Secret Shopper'],
    ['সাধারণ চেহারার একজন আপনার সেবার রেটিং দিচ্ছে।', 'Someone ordinary-looking is secretly rating your service.'],
    ['সবাইকে নির্ভুল ও দ্রুত সেবা দিন — কে গোপন ক্রেতা জানা নেই।', 'Serve everyone quickly and flawlessly — you cannot tell who it is.'],
    ['রেটিং ৪ তারার কম হলে ব্যর্থ।', 'Fails if the rating is under 4 stars.'],
    { guaranteed: { secret: [1, 1, 2] } }, [ge('secretStars', [4, 4, 8])]),
  def('family', 'customer', 3, 34, ['পুরো পরিবার', 'Family Shopping'],
    ['পরিবারের একেকজন একেক জিনিস যোগ করে — অর্ডার ধাপে ধাপে বাড়ে।', 'Each family member adds items — the order grows in waves.'],
    ['প্রতিটা ধাপ শেষ করুন, তারপর বিল।', 'Finish every wave, then bill them.'],
    ['পরিবার চলে গেলে ব্যর্থ।', 'Fails if the family leaves.'],
    { mix: { family: 10 }, guaranteed: { family: [1, 2, 2] } }, [ge('arch:family', [1, 2, 2])]),

  // ════════════════ B. Inventory challenges ════════════════
  def('stock_out', 'inventory', 2, 21, ['মাল ফুরালো', 'Stock-out'],
    ['হঠাৎ একটা পণ্য শেষ হয়ে যায়।', 'A product suddenly runs out.'],
    ['পণ্যের ঘরে 🛒 চেপে মহাজনের কাছে কার্টন অর্ডার দিন, বাক্স এলে খুলুন।', 'Tap 🛒 on the product to order a carton; unpack the box when it arrives.'],
    ['বেশি বার "নেই" বললে ব্যর্থ।', 'Fails if you say "out of stock" too often.'],
    { mods: { restock: true }, stockPct: 100, events: [{ kind: 'stockout', at: 30 }, { kind: 'stockout', at: 60, from: 2 }] },
    [le('apologies', [1, 1, 0]), ge('restocks', 1)]),
  def('last_piece', 'inventory', 2, 25, ['শেষ পিস', 'Last Piece'],
    ['একটাই বাকি, অথচ দুজন চায়।', 'Only one left, but two customers want it.'],
    ['কাকে দেবেন ঠিক করুন; অন্যজনকে "নেই" বলুন বা দ্রুত অন্য জিনিস দিন।', 'Decide who gets it; apologise to the other or serve their other items fast.'],
    ['কাস্টমার হারালে ব্যর্থ।', 'Fails if customers are lost.'],
    { stockPct: 100, events: [{ kind: 'lastPiece', at: 40 }, { kind: 'lastPiece', at: 75, from: 3 }] }, [le('lost', [1, 0, 0])]),
  def('expiry', 'inventory', 2, 27, ['মেয়াদ শেষের পথে', 'Expiry Alert'],
    ['কিছু মালের মেয়াদ শেষ হতে চলেছে।', 'Some stock is about to expire.'],
    ['⏰ চিহ্নে ট্যাপ করে ছাড়ে বিক্রি চালু করুন — চাহিদা বাড়বে।', 'Tap the ⏰ badge to start a clearance sale — demand goes up.'],
    ['মেয়াদ পেরোলে মাল নষ্ট (অপচয়)।', 'Unsold stock is wasted when it expires.'],
    { stockPct: 100, events: [{ kind: 'expiry', at: 20 }, { kind: 'expiry', at: 50, from: 2 }] }, [le('waste', [4, 3, 2])]),
  def('delivery_delay', 'inventory', 3, 32, ['ডেলিভারি দেরি', 'Delivery Delay'],
    ['মহাজনের মাল আসতে অনেক দেরি হয়।', 'Supplier deliveries take much longer.'],
    ['ফুরানোর আগেই অর্ডার দিয়ে রাখুন।', 'Order before you run out.'],
    ['বেশি বার "নেই" বললে ব্যর্থ।', 'Fails if you say "out of stock" too often.'],
    { mods: { restock: true, leadTicks: 160 }, stockPct: 60, events: [{ kind: 'stockout', at: 25 }] }, [le('apologies', [3, 2, 1])]),
  def('wrong_shipment', 'inventory', 3, 51, ['ভুল চালান', 'Wrong Shipment'],
    ['ডেলিভারিতে ভুল পণ্য চলে আসে।', 'Deliveries sometimes contain the wrong product.'],
    ['চালান আর আসল মাল মিলিয়ে ভুল লাইনটা ধরুন।', 'Compare invoice and goods; tap the line that does not match.'],
    ['ভুল মাল মেনে নিলে দরকারি স্টক পাবেন না।', 'Accepting the wrong goods leaves you without the stock you need.'],
    { mods: { restock: true, defects: [1] }, scaledMods: { inspectPct: [60, 70, 80] }, stockPct: 45, events: [{ kind: 'stockout', at: 20 }, { kind: 'stockout', at: 50 }] },
    [ge('decisionsGood', [1, 2, 2])]),
  def('price_shock', 'inventory', 3, 33, ['দাম বেড়েছে!', 'Price Shock'],
    ['পাইকারি দাম হঠাৎ ২৫% বাড়ে।', 'A wholesale price suddenly jumps 25%.'],
    ['দাম বাড়াবেন (লাভ ঠিক, কাস্টমার অখুশি) নাকি আগের দামে (লাভ কম)? লক্ষ্য দেখে ঠিক করুন।', 'Raise the price (margin kept, customers grumble) or hold it (less margin)? Decide from your goals.'],
    ['ভুল সিদ্ধান্তে লক্ষ্য হাতছাড়া।', 'The wrong call misses the goal.'],
    { events: [{ kind: 'priceShock', at: 30 }, { kind: 'priceShock', at: 60, from: 2 }] }, [ge('decisionsGood', [1, 1, 2])]),
  def('damaged_goods', 'inventory', 2, 36, ['নষ্ট মাল', 'Damaged Goods'],
    ['তাকে কিছু মাল ভেঙে/ছিঁড়ে গেছে।', 'Some units on the shelf are damaged.'],
    ['🩹 চিহ্নে ট্যাপ করে নষ্ট মাল সরান — বিক্রির আগে!', 'Tap the 🩹 badge to pull damaged units — before selling them!'],
    ['নষ্ট মাল বিক্রি করলে অপচয় ও ভুল গোনা হয়।', 'Selling damaged goods counts as waste and a mistake.'],
    { stockPct: 100, events: [{ kind: 'damaged', at: 25 }, { kind: 'damaged', at: 55, from: 2 }] }, [le('waste', 0)]),
  def('product_hunt', 'inventory', 2, 71, ['খুঁজে বের করো', 'Product Hunt'],
    ['দোকান নতুন করে সাজানো — পণ্য চেনা জায়গায় নেই।', 'The shop was rearranged — nothing is where you expect.'],
    ['ট্যাব ঘুরে ঠিক পণ্য খুঁজে নিন।', 'Hunt through the tabs for the right product.'],
    ['ভুল ট্যাপে নির্ভুলতা লক্ষ্যের নিচে নামলে ব্যর্থ।', 'Fails if accuracy drops below target.'],
    { mods: { shelfShuffle: true } }, [ge('accuracy', [85, 90, 92])]),
  def('overstock', 'inventory', 3, 76, ['অতিরিক্ত মাল', 'Overstock'],
    ['একটা পণ্য গুদামে পাহাড় হয়ে আছে।', 'One product is piled up far beyond demand.'],
    ['🏷️ চিহ্নে ট্যাপ করে অফার দিন — কাস্টমাররা বেশি নেবে।', 'Tap the 🏷️ badge to run an offer — customers will buy more of it.'],
    ['লক্ষ্যমাত্রার চেয়ে কম বিক্রি হলে ব্যর্থ।', 'Fails if you sell fewer units than the target.'],
    { stockPct: 100, events: [{ kind: 'overstock', at: 0 }] }, [ge('tagUnits', [4, 6, 8])]),
  def('warehouse_rush', 'inventory', 3, 63, ['গুদামে দৌড়', 'Warehouse Rush'],
    ['একসাথে অনেক বাক্স এসে দরজা আটকে দিচ্ছে।', 'A pile of boxes arrives and blocks the entrance.'],
    ['কাস্টমার সামলানোর ফাঁকে বাক্সে ট্যাপ করে মাল তুলুন।', 'Tap boxes to unpack them between customers.'],
    ['সময়মতো না খুললে সুনাম কমে, লক্ষ্য ব্যর্থ।', 'Late unpacking costs reputation and fails the goal.'],
    { stockPct: 60, events: [{ kind: 'deliveryRush', at: 30, n: [3, 4, 5] }, { kind: 'deliveryRush', at: 70, n: 3, from: 3 }] },
    [le('hotspotsMissed', [1, 0, 0])]),
  def('eid_demand', 'inventory', 3, 38, ['ঈদের চাহিদা', 'Eid Demand'],
    ['সেমাই, চিনি, তেল, পোলাওয়ের চালের চাহিদা কয়েক গুণ।', 'Demand for semai, sugar, oil and polao rice multiplies.'],
    ['ঈদের মাল আগেভাগে স্টক করুন।', 'Stock up on Eid items early.'],
    ['লক্ষ্যমাত্রার ঈদের মাল বিক্রি না হলে ব্যর্থ।', 'Fails if you do not sell enough Eid items.'],
    { mods: { restock: true, demand: { eid: 400 }, focusTag: 'eid' }, stockPct: 70 }, [ge('tagUnits', [6, 9, 12])], { needsTag: 'eid' }),
  def('hidden_stock', 'inventory', 2, 74, ['লুকানো মাল', 'Hidden Stock'],
    ['তাকে নেই, কিন্তু গুদামে পড়ে আছে।', 'Empty on the shelf, but there is stock lying in storage.'],
    ['📦 গুদামের দরজায় ট্যাপ করে খুঁজুন (৩ সেকেন্ড লাগে)।', 'Tap the 📦 storage door to search (takes 3 seconds).'],
    ['মাল থাকতে "নেই" বললে ব্যর্থ।', 'Fails if you say "out of stock" while stock exists.'],
    { mods: { hiddenStock: true }, stockPct: 60 }, [le('apologies', 0)]),

  // ════════════════ C. Cash & accounting challenges ════════════════
  def('cash_mismatch', 'cash', 3, 49, ['ক্যাশ মিলছে না', 'Cash Mismatch'],
    ['দিন শেষে ক্যাশ গুনে মেলাতে হবে।', 'At the end of the day the drawer must match the books.'],
    ['প্রতিটা ফেরত নির্ভুল দিন, তারপর দিনের হিসাব মেলান।', 'Give exact change every time, then balance the day.'],
    ['এক টাকাও গরমিল হলে ব্যর্থ।', 'Fails on any mismatch at all.'],
    { mods: { closing: ['closing'] }, exactPct: 10 }, [le('mismatch', 0)]),
  def('change_master', 'cash', 2, 14, ['খুচরা মাস্টার', 'Change Master'],
    ['সবাই বড় নোট দেয় — ফেরত হিসাব করতে হবে।', 'Everyone pays with big notes — you must work out the change.'],
    ['নোটে ট্যাপ করে সঠিক ফেরত দিন।', 'Tap notes to give the exact change.'],
    ['যথেষ্ট সঠিক ফেরত না দিলে ব্যর্থ।', 'Fails without enough correct change transactions.'],
    { exactPct: 0, mobilePct: 0, scaledMods: { bigNotePct: [40, 60, 80] }, changeHiddenFrom: 2 }, [ge('changeGiven', [50, 60, 70], 'pct')]),
  def('suspicious_note', 'cash', 3, 47, ['জাল নোট', 'Suspicious Note'],
    ['কিছু নোট জাল — জলছাপ নেই, রং অন্যরকম, বা নিরাপত্তা সুতা নেই।', 'Some notes are fake — missing watermark, wrong colour or no security thread.'],
    ['নোটটা ভালো করে দেখুন; জাল হলে "জাল নোট!" চাপুন।', 'Inspect the note; press "Fake!" if it is counterfeit.'],
    ['জাল নোট নিলে ক্যাশে বড় গরমিল।', 'Accepting a fake leaves a big hole in the drawer.'],
    { exactPct: 0, mobilePct: 0, scaledMods: { fakeNotePct: [40, 50, 60], bigNotePct: [70, 70, 80] } }, [ge('fakeCaught', [1, 2, 2])]),
  def('credit_collection', 'cash', 3, 35, ['বাকি আদায়', 'Credit Collection'],
    ['পুরনো বাকিদাররা দোকানে আসে।', 'Old debtors stop by the shop.'],
    ['কথা বুঝে চান: বেতন পেয়েছে → পুরোটা, টানাটানি → কিস্তি, ভুলে গেছে → খাতা দেখান।', 'Ask the right way: just paid → full, tight month → instalment, forgot → show the ledger.'],
    ['লক্ষ্যমাত্রার বাকি আদায় না হলে ব্যর্থ।', 'Fails if you collect less than the target.'],
    { events: [{ kind: 'debtor', at: 25 }, { kind: 'debtor', at: 50 }, { kind: 'debtor', at: 75, from: 3 }] }, [ge('creditCollected', [200, 200, 300])]),
  def('daily_closing', 'cash', 3, 44, ['দিনের হিসাব', 'Daily Closing'],
    ['দোকান বন্ধের আগে দিনের হিসাব মেলাতে হবে।', 'Before closing you must balance the day.'],
    ['শুরুর ক্যাশ + নগদ বিক্রি + আদায় − মহাজন − খরচ = ? (বাকি বিক্রি ক্যাশে আসে না!)', 'Opening + cash sales + collections − supplier − expenses = ? (credit sales are not cash!)'],
    ['ভুল অঙ্ক বাছলে ব্যর্থ।', 'Fails if you pick the wrong figure.'],
    { mods: { closing: ['closing'] } }, [ge('decisionsGood', 1)]),
  def('discount_trap', 'cash', 3, 53, ['ছাড়ের ফাঁদ', 'Discount Trap'],
    ['কাস্টমার কুপন দেখায় — সব কুপন বৈধ নয়।', 'Customers show coupons — not all of them are valid.'],
    ['শর্ত মিলিয়ে দেখুন: ন্যূনতম কেনাকাটা, নির্দিষ্ট পণ্য, মেয়াদ।', 'Check the terms: minimum purchase, specific product, expiry date.'],
    ['অবৈধ কুপন নিলে বা বৈধ কুপন ফেরালে ভুল গোনা হয়।', 'Accepting invalid or rejecting valid coupons counts as a mistake.'],
    { scaledMods: { couponPct: [50, 60, 70] } }, [ge('decisionsGood', [1, 2, 3])]),
  def('unexpected_expense', 'cash', 2, 43, ['হঠাৎ খরচ', 'Unexpected Expense'],
    ['হঠাৎ বিল এসে হাজির — বিদ্যুৎ, মেরামত, পৌর কর।', 'A surprise bill arrives — electricity, repairs, municipal fee.'],
    ['ক্যাশ থাকলে এখনই দিন; না থাকলে কিস্তি বা পরে (জরিমানাসহ)।', 'Pay now if you have the cash; otherwise split it or defer (with a penalty).'],
    ['ভুল সিদ্ধান্তে বাড়তি জরিমানা।', 'The wrong choice costs a penalty.'],
    { events: [{ kind: 'expense', at: 40 }, { kind: 'expense', at: 70, from: 2 }] }, [ge('decisionsGood', [1, 1, 2])]),
  def('supplier_debt', 'cash', 4, 54, ['মহাজনের দেনা', 'Supplier Debt'],
    ['বিকেলে মহাজনের পাওনা শোধ করতে হবে।', 'The supplier\'s dues must be paid this afternoon.'],
    ['ততক্ষণে যথেষ্ট ক্যাশ জমান — বাকি দেওয়া আর বাড়তি খরচে সাবধান।', 'Build up enough cash by then — careful with credit and spending.'],
    ['সময়মতো শোধ না হলে ব্যর্থ।', 'Fails if the debt is not paid on time.'],
    { scaledMods: { supplierDebt: [300, 450, 600] }, startCashPct: 50, events: [{ kind: 'debtDue', at: 75 }] }, [ge('debtPaid', 1)]),
  def('profit_or_loss', 'cash', 4, 58, ['লাভ না ক্ষতি?', 'Profit or Loss'],
    ['দিন শেষে লাভ-ক্ষতির হিসাব কষতে হবে।', 'At day end you must work out the profit or loss.'],
    ['বিক্রি − মালের দাম − খরচ − অপচয় = লাভ।', 'Sales − cost of goods − expenses − waste = profit.'],
    ['লাভের লক্ষ্য পূরণ না হলে বা ভুল অঙ্ক বাছলে ব্যর্থ।', 'Fails if profit is under target or you pick the wrong figure.'],
    { mods: { closing: ['profit'] } }, [ge('profit', [12, 15, 18], 'each'), ge('decisionsGood', 1)]),
  def('hisab_golmal', 'cash', 3, 56, ['হিসাবের গোলমাল', 'Hisab Golmal'],
    ['খাতার একটা লাইনে গুণফল ভুল।', 'One line in the ledger has the wrong total.'],
    ['পরিমাণ × দর মিলিয়ে ভুল লাইনে ট্যাপ করুন।', 'Check quantity × price and tap the wrong line.'],
    ['ভুল লাইন ধরলে ব্যর্থ।', 'Fails if you pick the wrong line.'],
    { events: [{ kind: 'ledger', at: 35 }, { kind: 'ledger', at: 70, from: 2 }] }, [ge('decisionsGood', [1, 2, 2])]),

  // ════════════════ D. Emergency challenges ════════════════
  def('load_shedding', 'emergency', 2, 42, ['লোডশেডিং', 'Load Shedding'],
    ['কারেন্ট চলে গেছে — দোকান অন্ধকার, পণ্যের নাম দেখা যায় না।', 'The power is out — the shop goes dark and labels disappear.'],
    ['আকার দেখে পণ্য চিনুন, বা ৳৫০ দিয়ে চার্জার লাইট জ্বালান।', 'Recognise products by shape, or pay ৳50 to switch on the charger light.'],
    ['অন্ধকারে ভুল ট্যাপে নির্ভুলতা কমলে ব্যর্থ।', 'Fails if accuracy drops in the dark.'],
    { events: [{ kind: 'loadShedding', at: 30, n: [150, 220, 300] }] }, [ge('accuracy', [75, 80, 85])]),
  def('heavy_rain', 'emergency', 2, 46, ['ঝুম বৃষ্টি', 'Heavy Rain'],
    ['বৃষ্টিতে ভেজা কাস্টমারের ধৈর্য কম, ডেলিভারি দ্বিগুণ দেরি।', 'Soaked customers have less patience and deliveries take twice as long.'],
    ['দ্রুত সামলান; বৃষ্টির জিনিস (মোমবাতি, মুড়ি, চা) হাতের কাছে রাখুন।', 'Serve fast; keep rain items (candles, muri, tea) ready.'],
    ['কাস্টমার হারালে ব্যর্থ।', 'Fails if customers are lost.'],
    { mods: { demand: { rain: 300 } }, events: [{ kind: 'rain', at: 20, n: 500 }] }, [le('lost', [1, 1, 0])]),
  def('flood_warning', 'emergency', 3, 67, ['বন্যার সতর্কতা', 'Flood Warning'],
    ['পানি ঢুকছে — নিচের তাকের মাল ভিজে যাবে।', 'Water is coming in — stock on the low shelves will be ruined.'],
    ['⬆️ চিহ্নের পণ্যগুলোতে ট্যাপ করে উপরে তুলুন, ১৬ সেকেন্ডের মধ্যে।', 'Tap every ⬆️ product to lift it up within 16 seconds.'],
    ['না তুললে অর্ধেক মাল নষ্ট।', 'Anything not lifted loses half its stock.'],
    { stockPct: 100, events: [{ kind: 'flood', at: 40, n: [3, 4, 5] }] }, [le('hotspotsMissed', [1, 0, 0])]),
  def('internet_outage', 'emergency', 3, 62, ['নেট নেই!', 'Internet Outage'],
    ['নেট বন্ধ — মোবাইল পেমেন্ট হচ্ছে না।', 'The internet is down — mobile payments fail.'],
    ['নগদ আছে? নগদ নিন। নেই, কিন্তু বিশ্বস্ত? খাতায় লিখুন। নইলে পরে আসতে বলুন।', 'Has cash? Take cash. No cash but trusted? Write it in the khata. Otherwise ask them to return.'],
    ['ভুল সিদ্ধান্তে বিক্রি হারাবেন।', 'The wrong call loses the sale.'],
    { mobilePct: 60, events: [{ kind: 'outage', at: 10, n: 900 }] }, [ge('decisionsGood', [1, 2, 3])]),
  def('fridge_breakdown', 'emergency', 3, 55, ['ফ্রিজ নষ্ট', 'Refrigerator Breakdown'],
    ['ফ্রিজ বন্ধ — ঠান্ডা মাল নষ্ট হতে চলেছে।', 'The fridge has died — cold stock is about to spoil.'],
    ['ক্যাশ থাকলে মিস্ত্রি ডাকুন; না থাকলে ঠান্ডা মাল ছাড়ে বেচে দিন।', 'Call the mechanic if you can afford it; otherwise sell cold stock at a discount.'],
    ['কিছু না করলে সব ঠান্ডা মাল নষ্ট।', 'Do nothing and all cold stock is lost.'],
    { stockPct: 100, events: [{ kind: 'fridge', at: 30 }] }, [le('waste', [4, 2, 0])], { needsCold: true }),
  def('power_failure', 'emergency', 3, 65, ['ক্যালকুলেটর বন্ধ', 'Power Failure'],
    ['বিদ্যুৎ নেই — ক্যালকুলেটর আর মেশিন বন্ধ, বিল দেখাচ্ছে না।', 'No electricity — the calculator is dead and totals are hidden.'],
    ['নিজে যোগ করে সঠিক মোট বাছুন।', 'Add up the bill yourself and pick the right total.'],
    ['ভুল মোট বাছলে লোকসান বা কাস্টমার বিরক্ত।', 'A wrong total means a loss or an annoyed customer.'],
    { events: [{ kind: 'powerFailure', at: 20, n: [300, 450, 600] }] }, [ge('decisionsGood', [2, 3, 4])]),
  def('water_leakage', 'emergency', 2, 52, ['ছাদ চুঁইছে', 'Water Leakage'],
    ['ছাদ থেকে পানি পড়ছে।', 'Water is dripping from the roof.'],
    ['💧 জায়গায় তিনবার ট্যাপ করে বালতি বসান।', 'Tap the 💧 spot three times to place a bucket.'],
    ['না সামলালে পাশের মাল ভিজে নষ্ট।', 'Ignored leaks ruin nearby stock.'],
    { events: [{ kind: 'leak', at: 25 }, { kind: 'leak', at: 55 }, { kind: 'leak', at: 80, from: 3 }] }, [le('hotspotsMissed', [1, 0, 0])]),
  def('security_alert', 'emergency', 3, 57, ['চোর চোর!', 'Security Alert'],
    ['একজন সন্দেহজনক লোক তাকের কাছে ঘুরঘুর করছে।', 'A shifty character is lurking near the shelves.'],
    ['দেখামাত্র ট্যাপ করে ধরুন — ৫ সেকেন্ড সময়।', 'Tap them the moment you see them — you have 5 seconds.'],
    ['ধরতে না পারলে মাল চুরি।', 'Miss them and stock disappears.'],
    { stockPct: 100, events: [{ kind: 'thief', at: 30 }, { kind: 'thief', at: 60 }, { kind: 'thief', at: 85, from: 3 }] }, [le('stolen', [6, 0, 0])]),
  def('sudden_crowd', 'emergency', 2, 40, ['হঠাৎ ভিড়', 'Sudden Crowd'],
    ['বাস থেমেছে — একসাথে অনেক কাস্টমার।', 'A bus just stopped — a crowd pours in.'],
    ['ধৈর্য দেখে একে একে দ্রুত সামলান।', 'Work through them quickly in order of patience.'],
    ['কাস্টমার হারালে ব্যর্থ।', 'Fails if customers are lost.'],
    { events: [{ kind: 'crowd', at: 40, n: [3, 4, 5] }], minSlots: 2 }, [le('lost', [2, 1, 0])]),
  def('fire_alarm', 'emergency', 3, 77, ['ফায়ার অ্যালার্ম', 'Fire Alarm'],
    ['সুইচবোর্ড থেকে ধোঁয়া! অ্যালার্ম বাজছে।', 'Smoke from the switchboard! The alarm is ringing.'],
    ['ক্রম মেনে ট্যাপ করুন: ① মেইন সুইচ ② নির্বাপক ③ জানালা।', 'Tap in order: ① main switch ② extinguisher ③ window.'],
    ['১৩ সেকেন্ডে না পারলে দোকান কিছুক্ষণ বন্ধ ও মাল নষ্ট।', 'Miss the 13-second window and the shop closes briefly and stock is lost.'],
    { events: [{ kind: 'fire', at: 45 }] }, [le('hotspotsMissed', 0)]),

  // ════════════════ E. Supplier challenges ════════════════
  def('wholesale_budget', 'supplier', 3, 41, ['পাইকারি বাজেট', 'Wholesale Budget'],
    ['তাক প্রায় খালি, হাতে টাকাও কম।', 'Shelves are nearly empty and cash is short.'],
    ['যা বেশি চলে তা-ই কিনুন — সব কেনার টাকা নেই।', 'Buy what sells — you cannot afford everything.'],
    ['বেশি বার "নেই" বললে ব্যর্থ।', 'Fails if you say "out of stock" too often.'],
    { mods: { restock: true }, startCashPct: 60, stockPct: 30 }, [le('apologies', [2, 1, 1]), ge('cash', 0)]),
  def('supplier_negotiation', 'supplier', 3, 48, ['মহাজনের সাথে দরাদরি', 'Supplier Negotiation'],
    ['মহাজন বেশি দাম হাঁকে — এবার দরদাম আপনার পালা।', 'The supplier quotes high — now you do the haggling.'],
    ['মেজাজ বুঝুন: "মাল বেশি" → অনেক কম বলুন, "বাজার টাইট" → মেনে নিন।', 'Read the mood: "overstocked" → bid low, "market is tight" → accept.'],
    ['বেশি চাপ দিলে ডেলিভারি দেরি।', 'Push too hard and the delivery is delayed.'],
    { mods: { restock: true, negotiatePct: 100 }, stockPct: 40 }, [ge('decisionsGood', [1, 2, 2])]),
  def('three_supplier_race', 'supplier', 4, 61, ['তিন মহাজনের দৌড়', 'Three Supplier Race'],
    ['তিন মহাজন তিন রকম দাম, সময় আর মান দেয়।', 'Three suppliers offer different prices, speeds and quality.'],
    ['জরুরি হলে দ্রুততম; নইলে দাম ÷ ভালো মালের হারে সবচেয়ে সস্তা।', 'If urgent pick the fastest; otherwise the cheapest per good unit.'],
    ['বাজে অফার নিলে মাল নষ্ট বা দেরি।', 'A bad pick means waste or delay.'],
    { mods: { restock: true, suppliersPct: 100 }, stockPct: 40 }, [ge('decisionsGood', [1, 2, 2])]),
  def('limited_stock', 'supplier', 3, 69, ['সীমিত মাল', 'Limited Stock'],
    ['মহাজনের কাছে আজ মাত্র কয়েক কার্টন আছে।', 'The supplier only has a few cartons today.'],
    ['কোন পণ্য আনবেন ভেবে বাছুন।', 'Choose carefully which products to reorder.'],
    ['বেশি বার "নেই" বললে ব্যর্থ।', 'Fails if you say "out of stock" too often.'],
    { mods: { restock: true }, scaledMods: { supplierCartons: [6, 5, 4] }, stockPct: 50 }, [le('apologies', [3, 2, 2])]),
  def('delivery_inspection', 'supplier', 3, 45, ['ডেলিভারি পরীক্ষা', 'Delivery Inspection'],
    ['ডেলিভারিতে ভুল মাল, কম মাল বা ভাঙা মাল থাকতে পারে।', 'Deliveries may have wrong, short or damaged goods.'],
    ['বাক্স খোলার আগে চালান মিলিয়ে ভুল লাইনে ট্যাপ করুন; ঠিক থাকলে "সব ঠিক"।', 'Check the invoice before unpacking; tap the faulty line or "All OK".'],
    ['ভুল ধরতে না পারলে লোকসান।', 'Missed faults cost you stock.'],
    { mods: { restock: true, defects: [1, 2, 3] }, scaledMods: { inspectPct: [50, 60, 70] }, stockPct: 40 }, [ge('decisionsGood', [1, 2, 2])]),
  def('transport_trouble', 'supplier', 3, 72, ['গাড়ি আটকা', 'Transport Trouble'],
    ['মালের গাড়ি জ্যামে আটকে গেছে।', 'The delivery van is stuck in traffic.'],
    ['জরুরি হলে ভ্যান ভাড়া করুন; নইলে অপেক্ষা করুন।', 'Hire a van if it is urgent; otherwise wait.'],
    ['ভুল সিদ্ধান্তে বিক্রি হারাবেন বা বাড়তি খরচ।', 'The wrong call loses sales or wastes money.'],
    { mods: { restock: true }, scaledMods: { transportPct: [70, 80, 90] }, stockPct: 40 }, [ge('decisionsGood', [1, 1, 2])]),
  def('fake_discount', 'supplier', 4, 66, ['নকল ছাড়', 'Fake Discount'],
    ['"২৫% ছাড়!" — কিন্তু আসল দাম আগেই বাড়ানো।', '"25% off!" — but the list price was inflated first.'],
    ['প্রতি পিসের আসল দাম কষে সবচেয়ে সস্তা অফার বাছুন।', 'Work out the real price per unit and pick the cheapest offer.'],
    ['ভুল অফার নিলে বাড়তি টাকা যায়।', 'A bad pick overpays.'],
    { startCashPct: 150, events: [{ kind: 'offer', at: 30 }, { kind: 'offer', at: 65, from: 2 }] }, [ge('decisionsGood', [1, 2, 2])]),
  def('market_price_race', 'supplier', 4, 73, ['বাজারদরের দৌড়', 'Market Price Race'],
    ['পাইকারি দর বারবার ওঠানামা করে।', 'Wholesale prices keep moving up and down.'],
    ['▼ দেখালে কিনুন, ▲ দেখালে অপেক্ষা করুন।', 'Buy on ▼, wait on ▲.'],
    ['গড়ে বেশি দামে কিনলে ব্যর্থ।', 'Fails if your average purchase price is too high.'],
    { mods: { restock: true, marketPrices: true }, stockPct: 40, events: [{ kind: 'priceTick', at: 0 }, { kind: 'priceTick', at: 25 }, { kind: 'priceTick', at: 50 }, { kind: 'priceTick', at: 75 }] },
    [ge('buyEfficiency', [95, 100, 105]), ge('restocks', 2)]),

  // ════════════════ F. Seasonal challenges ════════════════
  def('ramadan_rush', 'seasonal', 3, 30, ['রমজানের ভিড়', 'Ramadan Rush'],
    ['ইফতারের আগে ছোলা, খেজুর, মুড়ি, বেসন, শরবতের জন্য হুড়োহুড়ি।', 'Before iftar there is a scramble for chickpeas, dates, muri, besan and sharbat.'],
    ['ইফতারের মাল সামনে রাখুন; শেষ দিকের ভিড়ের জন্য প্রস্তুত থাকুন।', 'Keep iftar items handy; brace for the late rush.'],
    ['ইফতারের মাল কম বিক্রি হলে বা বেশি কাস্টমার হারালে ব্যর্থ।', 'Fails if iftar sales are low or too many customers leave.'],
    { mods: { demand: { ramadan: 500 }, focusTag: 'ramadan' }, patiencePct: 90, events: [{ kind: 'crowd', at: 60, n: [3, 4, 5] }], minSlots: 2 },
    [ge('tagUnits', [5, 7, 9]), le('lost', [2, 1, 1])], { needsTag: 'ramadan' }),
  def('eid_shopping_rush', 'seasonal', 4, 81, ['ঈদের কেনাকাটা', 'Eid Shopping Rush'],
    ['ঈদের বাজার — বড় অর্ডার, ভিআইপি, পাইকারি ক্রেতা।', 'Eid shopping — big orders, VIPs and bulk buyers.'],
    ['সেমাই-চিনি-ঘি মজুত রাখুন, ভিড় সামলান।', 'Keep semai, sugar and ghee stocked and manage the rush.'],
    ['ঈদের মাল কম বিক্রি হলে ব্যর্থ।', 'Fails if Eid item sales fall short.'],
    { mods: { restock: true, demand: { eid: 500 }, focusTag: 'eid' }, guaranteed: { vip: 1, bulk: [1, 2, 2] }, events: [{ kind: 'crowd', at: 50, n: 4 }], minSlots: 3 },
    [ge('tagUnits', [8, 10, 14])], { needsTag: 'eid' }),
  def('chand_raat', 'seasonal', 4, 79, ['চাঁদ রাত', 'Chand Raat'],
    ['ঈদের আগের রাত — মহাজন বন্ধ, যা আছে তা-ই দিয়ে চালাতে হবে।', 'The night before Eid — suppliers are closed; make do with what you have.'],
    ['মাল ভাগ করে বেচুন, শেষ পিস কাকে দেবেন ভাবুন।', 'Ration your stock and think about who gets the last piece.'],
    ['বেশি কাস্টমার হারালে ব্যর্থ।', 'Fails if too many customers are lost.'],
    { mods: { demand: { eid: 400 }, focusTag: 'eid' }, lockRestock: true, stockPct: 70, events: [{ kind: 'crowd', at: 30, n: 3 }, { kind: 'lastPiece', at: 50 }, { kind: 'crowd', at: 70, n: 3 }], minSlots: 3 },
    [le('lost', [2, 1, 1])], { needsTag: 'eid', incompatible: ['stock_out', 'delivery_delay', 'wholesale_budget'] }),
  def('pohela_boishakh', 'seasonal', 3, 50, ['পহেলা বৈশাখ — হালখাতা', 'Pohela Boishakh — Halkhata'],
    ['হালখাতার দিন: পুরনো বাকিদাররা আসে, আর প্রত্যেক কাস্টমারকে মিষ্টিমুখ করাতে হয়।', 'Halkhata day: old debtors come to settle up, and every customer gets a sweet.'],
    ['প্রতি অর্ডারের শেষে মিষ্টি দিন; বাকিদারদের কাছ থেকে ঠিকভাবে আদায় করুন।', 'Add sweets to every order; collect dues the right way.'],
    ['লক্ষ্যমাত্রার বাকি আদায় না হলে ব্যর্থ।', 'Fails if collections fall short.'],
    { mods: { giftItem: 'misti', demand: { boishakh: 300 } }, events: [{ kind: 'debtor', at: 20 }, { kind: 'debtor', at: 45 }, { kind: 'debtor', at: 70 }] },
    [ge('creditCollected', [200, 300, 300])], { needsTag: 'boishakh' }),
  def('winter_market', 'seasonal', 2, 70, ['শীতের বাজার', 'Winter Market'],
    ['শীতে চা, গুড়, লোশন, দুধের চাহিদা বাড়ে; কুয়াশায় ডেলিভারি দেরি।', 'Winter lifts demand for tea, jaggery, lotion and milk; fog delays deliveries.'],
    ['শীতের মাল আগে থেকে মজুত করুন।', 'Stock winter goods ahead of time.'],
    ['শীতের মাল কম বিক্রি হলে ব্যর্থ।', 'Fails if winter item sales fall short.'],
    { mods: { restock: true, leadTicks: 160, demand: { winter: 500 }, focusTag: 'winter' }, patiencePct: 115, stockPct: 70 },
    [ge('tagUnits', [5, 7, 9])], { needsTag: 'winter' }),
  def('wedding_season', 'seasonal', 4, 68, ['বিয়ের মৌসুম', 'Wedding Season'],
    ['বিয়ের বাজারের আগাম বুকিং আসে — পরে এসে মাল নেবে।', 'Wedding orders are booked in advance and collected later.'],
    ['বুকিং নিন, অগ্রিম রাখুন, আর ডেলিভারির সময় পর্যন্ত মাল রেখে দিন।', 'Take the booking and advance, then keep the stock until pickup.'],
    ['বুকিংয়ের মাল দিতে না পারলে ব্যর্থ।', 'Fails if you cannot deliver a booked order.'],
    { mods: { restock: true, demand: { wedding: 300 } }, guaranteed: { booker: [1, 1, 2], bulk: 1 }, stockPct: 100 },
    [ge('bookingsDone', [1, 1, 2])], { needsTag: 'wedding' }),
  def('school_reopening', 'seasonal', 2, 28, ['স্কুল খুলেছে', 'School Reopening'],
    ['স্কুল খুলেছে — পিচ্চিদের ভিড়, খাতা-কলম-টিফিনের চাহিদা।', 'School is back — kids everywhere wanting notebooks, pens and tiffin.'],
    ['পিচ্চিদের টাকা গোনা; না কুলালে সস্তা জিনিসটা বাদ দিন।', 'Kids carry exact money; if short, drop the cheapest item.'],
    ['পিচ্চিরা চলে গেলে ব্যর্থ।', 'Fails if the children leave unserved.'],
    { mix: { child: 60 }, guaranteed: { child: [3, 4, 5] }, mods: { demand: { school: 400 }, focusTag: 'school' } },
    [ge('arch:child', [3, 4, 5])], { needsTag: 'school' }),
  def('cricket_tournament', 'seasonal', 3, 64, ['ক্রিকেট জ্বর', 'Cricket Tournament'],
    ['খেলার বিরতিতে চিপস-কোলার জন্য দল বেঁধে কাস্টমার আসে।', 'At every innings break a crowd rushes in for chips and cola.'],
    ['বিরতির আগে মাল গুছিয়ে রাখুন; সবাই তাড়ায় থাকে।', 'Get stock ready before each break; everyone is in a hurry.'],
    ['খেলার মাল কম বিক্রি হলে ব্যর্থ।', 'Fails if match-snack sales fall short.'],
    { mods: { demand: { cricket: 500 }, focusTag: 'cricket' }, patiencePct: 85, events: [{ kind: 'crowd', at: 25, n: 3 }, { kind: 'crowd', at: 60, n: 3 }, { kind: 'crowd', at: 85, n: 3, from: 3 }], minSlots: 3 },
    [ge('tagUnits', [6, 9, 12])], { needsTag: 'cricket' }),
  def('monsoon_market', 'seasonal', 3, 59, ['বর্ষার বাজার', 'Monsoon Market'],
    ['টানা বৃষ্টি: খিচুড়ির মাল, ছাতা, মোমবাতির চাহিদা; ছাদ চুঁইছে; ডেলিভারি দেরি।', 'Endless rain: demand for khichuri items, umbrellas and candles; leaks; slow deliveries.'],
    ['লিক সামলান, আগেভাগে অর্ডার দিন।', 'Fix leaks and order early.'],
    ['লিক না সামলালে বা বর্ষার মাল কম বিক্রি হলে ব্যর্থ।', 'Fails on unattended leaks or low monsoon sales.'],
    { mods: { restock: true, leadTicks: 140, demand: { rain: 400 }, focusTag: 'rain' }, stockPct: 80, events: [{ kind: 'rain', at: 10, n: 900 }, { kind: 'leak', at: 40 }, { kind: 'leak', at: 70, from: 2 }] },
    [le('hotspotsMissed', [1, 0, 0]), ge('tagUnits', [5, 7, 9])], { needsTag: 'rain' }),
  def('puja_shopping', 'seasonal', 3, 75, ['পূজার কেনাকাটা', 'Puja Shopping'],
    ['পূজার বাজার: নারকেল, গুড়, ঘি, ময়দা, মিষ্টি — পরিবার নিয়ে কেনাকাটা।', 'Puja shopping: coconut, jaggery, ghee, flour, sweets — families shop together.'],
    ['পরিবারের ধাপে ধাপে অর্ডার আর দরদাম — দুটোই সামলান।', 'Handle family orders in waves and a bargainer too.'],
    ['পূজার মাল কম বিক্রি হলে ব্যর্থ।', 'Fails if puja item sales fall short.'],
    { mods: { demand: { puja: 500 }, focusTag: 'puja' }, guaranteed: { family: 1, bargain: 1 } }, [ge('tagUnits', [6, 8, 10])], { needsTag: 'puja' }),
  def('new_year_shopping', 'seasonal', 3, 83, ['নববর্ষের রাত', 'New Year Shopping'],
    ['থার্টি-ফার্স্টের পার্টি: কেক, কোলা, চিপস, বেলুন — আর কুপনের ছড়াছড়ি।', 'New Year party: cake, cola, chips, balloons — and coupons everywhere.'],
    ['কুপন যাচাই করুন; মধ্যরাতের ভিড়ের জন্য তৈরি থাকুন।', 'Verify coupons; be ready for the midnight rush.'],
    ['পার্টির মাল কম বিক্রি হলে ব্যর্থ।', 'Fails if party item sales fall short.'],
    { mods: { demand: { party: 500 }, focusTag: 'party', couponPct: 50 }, events: [{ kind: 'crowd', at: 80, n: 4 }], minSlots: 3 },
    [ge('tagUnits', [6, 9, 12])], { needsTag: 'party' }),
  def('festival_price_shock', 'seasonal', 4, 85, ['উৎসবে দামের আগুন', 'Festival Price Shock'],
    ['উৎসবের মৌসুমে পাইকারি দাম বারবার বাড়ে, কাস্টমাররাও দরদাম করে।', 'In festival season wholesale prices keep jumping and customers haggle.'],
    ['প্রতিবার লক্ষ্য দেখে দাম ঠিক করুন, দরদাম সামলান।', 'Set prices against your goals each time and handle the bargaining.'],
    ['যথেষ্ট সঠিক সিদ্ধান্ত না হলে ব্যর্থ।', 'Fails without enough correct decisions.'],
    { mix: { bargain: 25 }, guaranteed: { bargain: 2 }, events: [{ kind: 'priceShock', at: 20 }, { kind: 'priceShock', at: 50 }, { kind: 'priceShock', at: 75, from: 3 }] },
    [ge('decisionsGood', [2, 3, 4])]),

  // ════════════════ G. Skill challenges ════════════════
  def('perfect_accuracy', 'skill', 3, 10, ['নিখুঁত নির্ভুলতা', 'Perfect Accuracy'],
    ['আজ ভুলের জায়গা নেই।', 'No room for error today.'],
    ['ট্যাপের আগে অর্ডার মিলিয়ে নিন।', 'Check the order before every tap.'],
    ['নির্ভুলতা লক্ষ্যের নিচে নামলে ব্যর্থ।', 'Fails if accuracy drops below target.'],
    {}, [ge('accuracy', [92, 96, 100])], { tutorial: false }),
  def('speed_master', 'skill', 3, 9, ['স্পিড মাস্টার', 'Speed Master'],
    ['প্রতি কাস্টমারে গড় সময় বেঁধে দেওয়া।', 'Your average time per customer is capped.'],
    ['দ্রুত ট্যাপ করুন, অযথা দেরি নয়।', 'Tap fast and waste no time.'],
    ['গড় সময় বেশি হলে ব্যর্থ।', 'Fails if your average is too slow.'],
    {}, [le('avgServeSec', [14, 11, 9])], { tutorial: false }),
  def('zero_waste', 'skill', 3, 39, ['শূন্য অপচয়', 'Zero Waste'],
    ['একটা মালও নষ্ট হওয়া চলবে না।', 'Not a single unit may go to waste.'],
    ['মেয়াদ, নষ্ট মাল, লিক — সব সময়মতো সামলান।', 'Handle expiry, damage and leaks in time.'],
    ['একটাও অপচয় হলে ব্যর্থ।', 'Fails on any waste.'],
    { stockPct: 100, events: [{ kind: 'expiry', at: 35 }] }, [le('waste', 0)], { tutorial: false, incompatible: ['fridge_breakdown', 'three_supplier_race'] }),
  def('no_mistakes', 'skill', 4, 87, ['ভুল চলবে না', 'No Mistakes'],
    ['নির্দিষ্ট সংখ্যার বেশি ভুল করলেই খেলা শেষ।', 'Exceed the mistake limit and the level ends immediately.'],
    ['ধীরে হলেও নির্ভুল।', 'Slow is fine — wrong is not.'],
    ['ভুলের সীমা পেরোলেই ব্যর্থ।', 'Fails the moment you pass the limit.'],
    { scaledMods: { maxMistakes: [2, 1, 0] } }, [le('mistakes', [2, 1, 0])], { tutorial: false }),
  def('fast_checkout', 'skill', 3, 90, ['ফাস্ট চেকআউট', 'Fast Checkout'],
    ['টাকা নেওয়া ও ফেরত দেওয়া ৫ সেকেন্ডে সারতে হবে।', 'Take payment and give change within 5 seconds.'],
    ['ফেরতের অঙ্ক মুখস্থ রাখুন, দ্রুত নোট বাছুন।', 'Know your change sums and pick notes fast.'],
    ['যথেষ্ট দ্রুত চেকআউট না হলে ব্যর্থ।', 'Fails without enough fast checkouts.'],
    { exactPct: 20 }, [ge('fastPays', [60, 70, 80], 'pct')], { tutorial: false }),
  def('five_perfect', 'skill', 2, 17, ['পাঁচে পাঁচ', 'Five Perfect Orders'],
    ['পরপর নিখুঁত অর্ডার চাই।', 'You need a streak of perfect orders.'],
    ['একটাও ভুল ট্যাপ ছাড়া টানা অর্ডার দিন।', 'Serve orders back to back without a single wrong tap.'],
    ['টানা নিখুঁত অর্ডারের লক্ষ্য না ছুঁলে ব্যর্থ।', 'Fails if the streak target is not reached.'],
    {}, [ge('bestStreak', [5, 6, 8])], { tutorial: false }),
  def('limited_budget', 'skill', 4, 82, ['টানাটানির দিন', 'Limited Budget'],
    ['ক্যাশ খুব কম, তাকও আধখালি।', 'Very little cash and half-empty shelves.'],
    ['বিক্রির টাকা দিয়ে ভেবেচিন্তে মাল তুলুন।', 'Reinvest your sales carefully.'],
    ['ক্যাশ ঋণাত্মক হলে বা বেশি "নেই" বললে ব্যর্থ।', 'Fails if cash goes negative or you run out too often.'],
    { mods: { restock: true }, startCashPct: 45, stockPct: 35 }, [ge('cash', 0), le('apologies', [2, 1, 1])], { tutorial: false }),
  def('customer_happiness', 'skill', 2, 16, ['খুশি রাখো', 'Customer Happiness'],
    ['গড় কাস্টমার সন্তুষ্টি উঁচু রাখতে হবে।', 'Average customer satisfaction must stay high.'],
    ['দ্রুত ও নির্ভুল সেবা = খুশি কাস্টমার।', 'Fast, accurate service = happy customers.'],
    ['গড় সন্তুষ্টি লক্ষ্যের নিচে হলে ব্যর্থ।', 'Fails if average satisfaction is under target.'],
    {}, [ge('satisfaction', [70, 75, 80])], { tutorial: false }),
  def('inventory_memory', 'skill', 4, 78, ['স্মৃতির পরীক্ষা', 'Inventory Memory'],
    ['তাকে স্টকের সংখ্যা দেখা যাচ্ছে না।', 'Stock numbers are hidden on the shelf.'],
    ['কী কত বিক্রি হলো মনে রেখে সময়মতো অর্ডার দিন।', 'Keep count in your head and reorder in time.'],
    ['"নেই" বলতে হলে ব্যর্থ।', 'Fails if you have to say "out of stock".'],
    { mods: { restock: true, stockHidden: true }, stockPct: 45 }, [le('apologies', [1, 0, 0])], { tutorial: false }),
  def('cash_counter_master', 'skill', 5, 86, ['ক্যাশ কাউন্টার মাস্টার', 'Cash Counter Master'],
    ['বড় নোট, সীমিত খুচরা, ফেরতের অঙ্ক লুকানো — আর দিন শেষে হিসাব।', 'Big notes, limited change, hidden change amounts — and a closing count.'],
    ['মাথায় হিসাব কষে নির্ভুল ফেরত দিন।', 'Do the sums in your head and give exact change.'],
    ['এক টাকাও গরমিল হলে ব্যর্থ।', 'Fails on any mismatch.'],
    { mods: { limitedTill: true, changeHidden: true, closing: ['closing'] }, exactPct: 0, mobilePct: 0, scaledMods: { bigNotePct: [50, 60, 70] } },
    [le('mismatch', 0), ge('changeGiven', [40, 50, 60], 'pct')], { tutorial: false }),
];

export const CHALLENGE_MAP: Record<string, ChallengeDef> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

export function challenge(id: string): ChallengeDef {
  const c = CHALLENGE_MAP[id];
  if (!c) throw new Error(`Unknown challenge: ${id}`);
  return c;
}

export const CATEGORY_NAMES: Record<ChallengeCategory, L10n> = {
  customer: { bn: 'কাস্টমার', en: 'Customer' },
  inventory: { bn: 'মালপত্র', en: 'Inventory' },
  cash: { bn: 'ক্যাশ ও হিসাব', en: 'Cash & Accounting' },
  emergency: { bn: 'জরুরি অবস্থা', en: 'Emergency' },
  supplier: { bn: 'মহাজন', en: 'Supplier' },
  seasonal: { bn: 'মৌসুমি', en: 'Seasonal' },
  skill: { bn: 'দক্ষতা', en: 'Skill' },
};
