import type { ProductDef, TabId, L10n } from '@/core/types';

/**
 * Product catalogue. All prices and products are fictional gameplay data.
 * Sell prices are multiples of 5 so change-making stays readable.
 */
type Row = [
  id: string, bn: string, en: string, category: string, tab: TabId, buy: number, sell: number, initStock: number,
  carton: number, unlock: number, icon: ProductDef['icon'], extra?: Partial<ProductDef>,
];

const c = (bn: string, en: string): L10n => ({ bn, en });

const ROWS: Row[] = [
  // ── মুদি (staples) ─────────────────────────────────────────────
  ['rice', 'চাল', 'Rice', 'চাল', 'mudi', 60, 70, 24, 12, 1, { t: 'sack', c1: '#F4E9D0', c2: '#C9462C', g: 'চাল' },
    { clue: c('ভাত রান্না করব… সাদা সাদা দানা', 'For cooking bhaat… small white grains'), tags: ['rain'] }],
  ['dal', 'মসুর ডাল', 'Lentils', 'ডাল', 'mudi', 110, 125, 18, 10, 1, { t: 'sack', c1: '#F2A65A', c2: '#B5451B', g: 'ডাল' },
    { clue: c('কমলা রঙের দানা, ভাতের সাথে পাতলা করে খাই', 'Orange grains, eaten soupy with rice'), tags: ['rain'] }],
  ['oil', 'সয়াবিন তেল', 'Soybean Oil', 'তেল', 'mudi', 165, 180, 14, 8, 1, { t: 'bottle', c1: '#F6C445', c2: '#2E7D32', g: 'তেল' },
    { clue: c('ভাজাভুজি করতে লাগে, হলুদ বোতল', 'Needed for frying, yellow bottle'), tags: ['eid', 'wedding', 'rain'] }],
  ['salt', 'লবণ', 'Salt', 'লবণ', 'mudi', 30, 40, 20, 12, 2, { t: 'packet', c1: '#FFFFFF', c2: '#1E88E5', g: 'লবণ' },
    { clue: c('এটা ছাড়া তরকারি পানসে', 'Without it curry is bland') }],
  ['sugar', 'চিনি', 'Sugar', 'চিনি', 'mudi', 120, 135, 16, 10, 3, { t: 'sack', c1: '#FFFFFF', c2: '#D81B60', g: 'চিনি' },
    { clue: c('চায়ে দিলে মিষ্টি হয়', 'Makes tea sweet'), tags: ['eid', 'ramadan', 'puja'] }],
  ['atta', 'আটা', 'Atta Flour', 'আটা', 'mudi', 50, 60, 16, 10, 4, { t: 'sack', c1: '#E8D3A9', c2: '#6D4C41', g: 'আটা' },
    { clue: c('রুটি বানাব… বাদামি গুঁড়া', 'To make ruti… brownish powder') }],
  ['egg', 'ডিম (হালি)', 'Eggs (4)', 'অন্যান্য', 'mudi', 40, 50, 16, 10, 6, { t: 'tray', c1: '#F5E6CC', c2: '#C8A97E' },
    { clue: c('মুরগি পাড়ে, সকালে ভাজি করি', 'A hen lays them; fried at breakfast'), tags: ['rain'], perishable: true }],
  ['maida', 'ময়দা', 'Maida Flour', 'ময়দা', 'mudi', 60, 70, 14, 10, 8, { t: 'sack', c1: '#FDFDFD', c2: '#3949AB', g: 'ময়দা' },
    { clue: c('পরোটা-লুচি বানাব… একদম সাদা গুঁড়া', 'For porota & luchi… pure white powder'), tags: ['puja'] }],
  ['onion', 'পেঁয়াজ', 'Onion', 'অন্যান্য', 'mudi', 65, 80, 16, 10, 10, { t: 'pile', c1: '#B03A6B', c2: '#7B1E4A' },
    { clue: c('কাটলে চোখে পানি আসে', 'Makes you cry when you cut it') }],
  ['tea', 'চা পাতা', 'Tea Leaves', 'অন্যান্য', 'mudi', 90, 105, 12, 8, 12, { t: 'box', c1: '#2E7D32', c2: '#F6C445', g: 'চা' },
    { clue: c('সকালে গরম পানিতে দিয়ে খাই, ঘুম কাটে', 'Brewed hot every morning'), tags: ['winter', 'rain'] }],
  ['potato', 'আলু', 'Potato', 'অন্যান্য', 'mudi', 30, 40, 18, 12, 14, { t: 'pile', c1: '#C9A66B', c2: '#8D6E3F' },
    { clue: c('ভর্তা হয়, ভাজি হয়, চিপসও হয়', 'Mashed, fried, even made into chips'), tags: ['rain'] }],
  ['spice', 'মসলা', 'Spice Mix', 'অন্যান্য', 'mudi', 55, 65, 12, 8, 22, { t: 'packet', c1: '#E53935', c2: '#F6C445', g: 'মসলা' },
    { clue: c('হলুদ-মরিচের গুঁড়া, তরকারিতে রং আনে', 'Turmeric & chilli powder for curry'), tags: ['eid', 'wedding'] }],
  ['polao', 'পোলাওয়ের চাল', 'Polao Rice', 'চাল', 'mudi', 110, 130, 12, 8, 24, { t: 'sack', c1: '#FFF8E1', c2: '#00897B', g: 'পোলাও' },
    { clue: c('সুগন্ধি ছোট চাল, দাওয়াতে লাগে', 'Fragrant tiny rice for feasts'), tags: ['eid', 'wedding'] }],
  ['chola', 'ছোলা', 'Chickpeas', 'ডাল', 'mudi', 95, 110, 12, 8, 30, { t: 'sack', c1: '#D7B377', c2: '#5D4037', g: 'ছোলা' },
    { tags: ['ramadan'] }],
  ['besan', 'বেসন', 'Besan', 'আটা', 'mudi', 100, 120, 10, 8, 30, { t: 'packet', c1: '#F9D976', c2: '#EF6C00', g: 'বেসন' },
    { tags: ['ramadan'] }],
  ['semai', 'সেমাই', 'Semai', 'অন্যান্য', 'mudi', 45, 55, 12, 10, 32, { t: 'packet', c1: '#FFE0A3', c2: '#C2185B', g: 'সেমাই' },
    { tags: ['eid'] }],
  // ── নাস্তা (snacks) ────────────────────────────────────────────
  ['biscuit', 'বিস্কুট', 'Biscuits', 'বিস্কুট', 'snack', 20, 30, 24, 12, 2, { t: 'packet', c1: '#F9A825', c2: '#6D4C41', g: 'বিস্কুট' },
    { clue: c('চায়ে ডুবিয়ে খাই', 'I dunk it in tea'), tags: ['kids', 'school', 'winter'] }],
  ['chips', 'চিপস', 'Chips', 'চিপস', 'snack', 15, 20, 24, 12, 3, { t: 'packet', c1: '#E53935', c2: '#FDD835', g: 'চিপস' },
    { clue: c('মচমচে আলুর পাতলা টুকরা, প্যাকেটে হাওয়া বেশি', 'Crunchy potato slices, mostly air in the pack'), tags: ['kids', 'cricket', 'party', 'school'] }],
  ['chanachur', 'চানাচুর', 'Chanachur', 'চানাচুর', 'snack', 40, 50, 18, 10, 5, { t: 'packet', c1: '#FB8C00', c2: '#4E342E', g: 'চানাচুর' },
    { clue: c('ঝাল ঝাল মচমচে, মুড়ির সাথে মাখাই', 'Spicy crunchy mix, tossed with muri'), tags: ['cricket', 'rain'] }],
  ['choco', 'চকলেট', 'Chocolate', 'অন্যান্য', 'snack', 10, 15, 24, 12, 7, { t: 'bar', c1: '#6D4C41', c2: '#F6C445' },
    { tags: ['kids', 'school', 'party'] }],
  ['noodles', 'নুডলস', 'Noodles', 'অন্যান্য', 'snack', 20, 25, 20, 12, 9, { t: 'packet', c1: '#FDD835', c2: '#D32F2F', g: 'নুডলস' },
    { clue: c('দুই মিনিটে রান্না, প্যাঁচানো প্যাঁচানো', 'Cooks in two minutes, all curly'), tags: ['kids', 'school'] }],
  ['muri', 'মুড়ি', 'Puffed Rice', 'অন্যান্য', 'snack', 30, 40, 16, 10, 11, { t: 'sack', c1: '#FFFDE7', c2: '#F57F17', g: 'মুড়ি' },
    { clue: c('ফুলানো চাল, ঝালমুড়ি বানাই', 'Puffed rice for jhalmuri'), tags: ['ramadan', 'rain', 'cricket'] }],
  ['cake', 'কেক', 'Cake', 'অন্যান্য', 'snack', 15, 20, 18, 12, 16, { t: 'bar', c1: '#FFCC80', c2: '#EC407A' },
    { tags: ['kids', 'party', 'school'] }],
  ['gur', 'খেজুরের গুড়', 'Date Jaggery', 'অন্যান্য', 'snack', 140, 170, 10, 6, 42, { t: 'round', c1: '#8D5524', c2: '#5D3A1A' },
    { tags: ['winter', 'puja'] }],
  ['khejur', 'খেজুর', 'Dates', 'অন্যান্য', 'snack', 180, 220, 10, 6, 30, { t: 'box', c1: '#6D4C41', c2: '#F6C445', g: 'খেজুর' },
    { tags: ['ramadan'] }],
  ['misti', 'মিষ্টি', 'Sweets Box', 'অন্যান্য', 'snack', 200, 250, 10, 6, 44, { t: 'box', c1: '#FFFFFF', c2: '#E91E63', g: 'মিষ্টি' },
    { tags: ['boishakh', 'puja', 'wedding'] }],
  // ── ঠান্ডা (fridge) ────────────────────────────────────────────
  ['cola', 'কোমল পানীয়', 'Soft Drink', 'কোমল পানীয়', 'cold', 30, 40, 20, 12, 5, { t: 'bottle', c1: '#3E2723', c2: '#E53935', g: 'কোলা' },
    { clue: c('ঠান্ডা কালো পানি, খেলে ঢেকুর ওঠে', 'Cold dark fizzy drink'), cold: true, tags: ['cricket', 'party', 'eid'] }],
  ['water', 'পানি', 'Water Bottle', 'কোমল পানীয়', 'cold', 15, 20, 24, 12, 7, { t: 'bottle', c1: '#B3E5FC', c2: '#0277BD', g: 'পানি' },
    { tags: ['cricket'] }],
  ['juice', 'জুস', 'Juice', 'কোমল পানীয়', 'cold', 20, 25, 20, 12, 13, { t: 'carton', c1: '#FF9800', c2: '#43A047', g: 'জুস' },
    { cold: true, tags: ['kids', 'school', 'party'] }],
  ['milk', 'দুধ', 'Milk', 'অন্যান্য', 'cold', 80, 90, 12, 8, 18, { t: 'carton', c1: '#FFFFFF', c2: '#1565C0', g: 'দুধ' },
    { clue: c('গরু দেয়, সাদা, চায়ে মেশাই', 'From a cow, white, goes in tea'), cold: true, perishable: true, tags: ['eid', 'winter'] }],
  ['icecream', 'আইসক্রিম', 'Ice Cream', 'অন্যান্য', 'cold', 40, 50, 14, 10, 26, { t: 'stick', c1: '#F8BBD0', c2: '#8D6E63' },
    { cold: true, perishable: true, tags: ['kids', 'party'] }],
  ['doi', 'দই', 'Yogurt', 'অন্যান্য', 'cold', 60, 75, 10, 6, 34, { t: 'jar', c1: '#FFF8E1', c2: '#BF360C', g: 'দই' },
    { cold: true, perishable: true, tags: ['wedding', 'boishakh', 'eid'] }],
  ['sharbat', 'লাল শরবত', 'Rose Sharbat', 'কোমল পানীয়', 'cold', 250, 290, 8, 6, 30, { t: 'bottle', c1: '#D81B60', c2: '#F6C445', g: 'শরবত' },
    { tags: ['ramadan'] }],
  // ── ঘরোয়া (household) ─────────────────────────────────────────
  ['soap', 'সাবান', 'Soap', 'সাবান', 'home', 45, 55, 18, 12, 4, { t: 'bar', c1: '#F48FB1', c2: '#FFFFFF' },
    { clue: c('গোসলে লাগে, ফেনা হয়', 'For bathing, makes lather') }],
  ['match', 'দিয়াশলাই', 'Matchbox', 'অন্যান্য', 'home', 5, 10, 24, 12, 6, { t: 'box', c1: '#FDD835', c2: '#D32F2F' },
    { clue: c('চুলা ধরাব, কাঠি ঘষলে আগুন', 'To light the stove — strike a stick'), tags: ['rain'] }],
  ['candle', 'মোমবাতি', 'Candle', 'অন্যান্য', 'home', 10, 15, 24, 12, 15, { t: 'stick', c1: '#FFF9C4', c2: '#FB8C00' },
    { clue: c('কারেন্ট গেলে জ্বালাই', 'Lit when the power goes out'), tags: ['rain'] }],
  ['toothpaste', 'টুথপেস্ট', 'Toothpaste', 'টুথপেস্ট', 'home', 85, 100, 12, 8, 17, { t: 'box', c1: '#FFFFFF', c2: '#E53935', g: 'পেস্ট' },
    { clue: c('সকালে দাঁত মাজি', 'For brushing teeth in the morning') }],
  ['detergent', 'ডিটারজেন্ট', 'Detergent', 'ডিটারজেন্ট', 'home', 95, 110, 12, 8, 19, { t: 'packet', c1: '#1E88E5', c2: '#FFFFFF', g: 'ডিটারজেন্ট' },
    { clue: c('কাপড় ধোয়ার গুঁড়া', 'Powder for washing clothes') }],
  ['shampoo', 'শ্যাম্পু', 'Shampoo', 'শ্যাম্পু', 'home', 160, 185, 10, 6, 23, { t: 'bottle', c1: '#7E57C2', c2: '#FFFFFF', g: 'শ্যাম্পু' },
    { clue: c('চুল ধুই, বোতল থেকে ঢালি', 'I wash my hair with it') }],
  ['coil', 'মশার কয়েল', 'Mosquito Coil', 'অন্যান্য', 'home', 55, 65, 12, 8, 27, { t: 'round', c1: '#2E7D32', c2: '#1B5E20' },
    { clue: c('মশা তাড়াই, প্যাঁচানো সবুজ', 'Green spiral that chases mosquitoes'), tags: ['rain'] }],
  ['dishwash', 'বাসন মাজার সাবান', 'Dish Soap', 'সাবান', 'home', 30, 35, 14, 10, 36, { t: 'bar', c1: '#C0CA33', c2: '#FFFFFF' }],
  ['tissue', 'টিস্যু', 'Tissue', 'অন্যান্য', 'home', 35, 45, 14, 10, 46, { t: 'box', c1: '#B2EBF2', c2: '#00838F', g: 'টিস্যু' },
    { tags: ['wedding', 'party'] }],
  ['lotion', 'লোশন', 'Lotion', 'অন্যান্য', 'home', 90, 110, 10, 6, 52, { t: 'jar', c1: '#FFE0B2', c2: '#F06292', g: 'লোশন' },
    { tags: ['winter'] }],
  ['battery', 'ব্যাটারি', 'Battery', 'অন্যান্য', 'home', 30, 40, 16, 10, 56, { t: 'stick', c1: '#F6C445', c2: '#212121' },
    { tags: ['cricket', 'rain'] }],
  // ── বিশেষ (seasonal & stationery) ──────────────────────────────
  ['khata', 'খাতা', 'Notebook', 'অন্যান্য', 'extra', 30, 40, 16, 10, 28, { t: 'box', c1: '#4FC3F7', c2: '#01579B', g: 'খাতা' },
    { tags: ['school'] }],
  ['pen', 'কলম', 'Pen', 'অন্যান্য', 'extra', 5, 10, 24, 12, 28, { t: 'stick', c1: '#1565C0', c2: '#0D47A1' },
    { tags: ['school'] }],
  ['pencil', 'পেন্সিল', 'Pencil', 'অন্যান্য', 'extra', 10, 15, 20, 12, 38, { t: 'stick', c1: '#FDD835', c2: '#E53935' },
    { tags: ['school'] }],
  ['milkpowder', 'গুঁড়া দুধ', 'Milk Powder', 'অন্যান্য', 'extra', 380, 420, 8, 6, 48, { t: 'jar', c1: '#FFF3E0', c2: '#1565C0', g: 'গুঁড়া দুধ' },
    { tags: ['eid', 'puja'] }],
  ['ghee', 'ঘি', 'Ghee', 'তেল', 'extra', 550, 620, 6, 4, 54, { t: 'jar', c1: '#FBC02D', c2: '#33691E', g: 'ঘি' },
    { tags: ['eid', 'puja', 'wedding'] }],
  ['coconut', 'নারকেল', 'Coconut', 'অন্যান্য', 'extra', 80, 100, 10, 6, 58, { t: 'round', c1: '#795548', c2: '#4E342E' },
    { tags: ['puja', 'winter'] }],
  ['umbrella', 'ছাতা', 'Umbrella', 'অন্যান্য', 'extra', 250, 300, 6, 4, 58, { t: 'umbrella', c1: '#3949AB', c2: '#F6C445' },
    { tags: ['rain'] }],
  ['balloon', 'বেলুন', 'Balloons', 'অন্যান্য', 'extra', 5, 10, 24, 12, 66, { t: 'round', c1: '#EF5350', c2: '#C62828' },
    { tags: ['party', 'kids', 'boishakh'] }],
];

export const PRODUCTS: ProductDef[] = ROWS.map(([id, bn, en, category, tab, buy, sell, initStock, carton, unlock, icon, extra]) => ({
  id, bn, en, category, tab, buy, sell, initStock, maxStock: initStock * 2, carton, unlock, icon, ...extra,
}));

export const PRODUCT_MAP: Record<string, ProductDef> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const TABS: { id: TabId; name: L10n }[] = [
  { id: 'mudi', name: { bn: 'মুদি', en: 'Staples' } },
  { id: 'snack', name: { bn: 'নাস্তা', en: 'Snacks' } },
  { id: 'cold', name: { bn: 'ঠান্ডা', en: 'Cold' } },
  { id: 'home', name: { bn: 'ঘরোয়া', en: 'Home' } },
  { id: 'extra', name: { bn: 'বিশেষ', en: 'Special' } },
];

export function product(id: string): ProductDef {
  const p = PRODUCT_MAP[id];
  if (!p) throw new Error(`Unknown product: ${id}`);
  return p;
}

/** Products available at a given story level. */
export function productsForLevel(level: number): string[] {
  return PRODUCTS.filter((p) => p.unlock <= level).map((p) => p.id);
}
