/**
 * Shop customization catalogue, player XP/level progression, avatars and Bangladeshi districts.
 * All customizations are purely visual and earned through gameplay coins & progression.
 */
import type { L10n } from '@/core/types';

export type CustomizationCategory = 'sign' | 'shelf' | 'decor' | 'outfit' | 'counter' | 'env';

export interface CustomizationItem {
  id: string;
  category: CustomizationCategory;
  name: L10n;
  description: L10n;
  costCoins: number;
  /** Minimum story level reached to unlock for purchase (1 = available immediately). */
  unlockLevel: number;
  /** Visual palette / style metadata used by the shop renderer. */
  style: {
    primary: string;
    secondary: string;
    accent: string;
    bannerText?: L10n;
  };
}

export const DEFAULT_EQUIPPED: Record<CustomizationCategory, string> = {
  sign: 'sign_default',
  shelf: 'shelf_wood',
  decor: 'decor_bulb',
  outfit: 'outfit_apron',
  counter: 'counter_wood',
  env: 'env_para',
};

export const CUSTOMIZATION_CATEGORIES: { id: CustomizationCategory; name: L10n; icon: string }[] = [
  { id: 'sign', name: { bn: 'সাইনবোর্ড', en: 'Shop Sign' }, icon: '🪧' },
  { id: 'shelf', name: { bn: 'তাক', en: 'Shelves' }, icon: '🗄️' },
  { id: 'decor', name: { bn: 'সাজসজ্জা', en: 'Decorations' }, icon: '🏮' },
  { id: 'outfit', name: { bn: 'পোশাক', en: 'Outfit' }, icon: '👕' },
  { id: 'counter', name: { bn: 'কাউন্টার', en: 'Counter' }, icon: '🧮' },
  { id: 'env', name: { bn: 'দোকানের পরিবেশ', en: 'Environment' }, icon: '🏪' },
];

export const CUSTOMIZATION_ITEMS: CustomizationItem[] = [
  // ── 1. Shop Signs ──
  {
    id: 'sign_default',
    category: 'sign',
    name: { bn: 'বিসমিল্লাহ স্টোর', en: 'Bismillah Store' },
    description: { bn: 'পাড়ার চিরচেনা লাল-হলুদ টিনের সাইনবোর্ড।', en: 'Classic neighbourhood red-and-yellow tin signboard.' },
    costCoins: 0,
    unlockLevel: 1,
    style: { primary: '#C9462C', secondary: '#F6C445', accent: '#FFFFFF', bannerText: { bn: 'বিসমিল্লাহ স্টোর', en: 'Bismillah Store' } },
  },
  {
    id: 'sign_doa',
    category: 'sign',
    name: { bn: 'মা-বাবার দোয়া ভান্ডার', en: 'Ma-Babar Doa Bhandar' },
    description: { bn: 'সবুজ-সোনালি রঙের ঐতিহ্যবাহী মুদি দোকানের বোর্ড।', en: 'Traditional green and gold grocery signboard.' },
    costCoins: 120,
    unlockLevel: 5,
    style: { primary: '#006A4E', secondary: '#F6C445', accent: '#FFF8E7', bannerText: { bn: 'মা-বাবার দোয়া ভান্ডার', en: 'Ma-Babar Doa Bhandar' } },
  },
  {
    id: 'sign_bhaibhai',
    category: 'sign',
    name: { bn: 'ভাই ভাই সুপার স্টোর', en: 'Bhai Bhai Super Store' },
    description: { bn: 'উজ্জ্বল নীল এলইডি বর্ডার দেওয়া আধুনিক সাইনবোর্ড।', en: 'Modern blue signboard with bright trim.' },
    costCoins: 260,
    unlockLevel: 21,
    style: { primary: '#1D4ED8', secondary: '#38BDF8', accent: '#FFFFFF', bannerText: { bn: 'ভাই ভাই সুপার স্টোর', en: 'Bhai Bhai Super Store' } },
  },
  {
    id: 'sign_king',
    category: 'sign',
    name: { bn: 'সোনার বাংলা মেগা শপ', en: 'Sonar Bangla Mega Shop' },
    description: { bn: 'দোকান সম্রাটের রাজকীয় বেগুনি ও সোনালি সাইনবোর্ড।', en: 'Royal purple and gold signboard fit for a Shop King.' },
    costCoins: 500,
    unlockLevel: 61,
    style: { primary: '#5B21B6', secondary: '#F6C445', accent: '#FEF08A', bannerText: { bn: 'সোনার বাংলা মেগা শপ', en: 'Sonar Bangla Mega Shop' } },
  },

  // ── 2. Shelves ──
  {
    id: 'shelf_wood',
    category: 'shelf',
    name: { bn: 'কাঠের তাক', en: 'Wooden Shelves' },
    description: { bn: 'মজবুত দেশি কাঠের তৈরি সাধারণ তাক।', en: 'Sturdy shelves made of local timber.' },
    costCoins: 0,
    unlockLevel: 1,
    style: { primary: '#8D5B3C', secondary: '#6E4228', accent: '#D7B377' },
  },
  {
    id: 'shelf_steel',
    category: 'shelf',
    name: { bn: 'রঙিন স্টিলের তাক', en: 'Painted Steel Rack' },
    description: { bn: 'নীল-সাদা রঙের ঝকঝকে স্টিলের র‍্যাক।', en: 'Crisp blue-and-white painted steel racks.' },
    costCoins: 150,
    unlockLevel: 12,
    style: { primary: '#2563EB', secondary: '#1E40AF', accent: '#DBEAFE' },
  },
  {
    id: 'shelf_super',
    category: 'shelf',
    name: { bn: 'সুপার শপ গন্ডোলা', en: 'Super Shop Gondola' },
    description: { bn: 'আধুনিক সুপার শপের সবুজ-সাদা ডিসপ্লে তাক।', en: 'Modern green-and-cream supermarket display shelves.' },
    costCoins: 320,
    unlockLevel: 41,
    style: { primary: '#0F766E', secondary: '#115E59', accent: '#CCFBF1' },
  },
  {
    id: 'shelf_royal',
    category: 'shelf',
    name: { bn: 'রাজকীয় সেগুন তাক', en: 'Royal Teak Shelves' },
    description: { bn: 'সোনালি বর্ডার দেওয়া পালিশ করা সেগুন কাঠের তাক।', en: 'Polished Chittagong teak shelves with brass trim.' },
    costCoins: 550,
    unlockLevel: 75,
    style: { primary: '#5C2D16', secondary: '#3E1D0D', accent: '#F6C445' },
  },

  // ── 3. Shop Decorations ──
  {
    id: 'decor_bulb',
    category: 'decor',
    name: { bn: 'ঝুলন্ত বাল্ব', en: 'Hanging Bulb' },
    description: { bn: 'দোকানের মাঝখানে ঝুলন্ত উষ্ণ হলুদ বাল্ব।', en: 'A warm yellow bulb hanging over the counter.' },
    costCoins: 0,
    unlockLevel: 1,
    style: { primary: '#F6C445', secondary: '#FFF3B0', accent: '#3B2314' },
  },
  {
    id: 'decor_lights',
    category: 'decor',
    name: { bn: 'মরিচবাতি ও পতাকা', en: 'Fairy Lights & Bunting' },
    description: { bn: 'উৎসবের রঙিন মরিচবাতি ও কাগজের নিশান।', en: 'Festive string lights and colourful paper bunting.' },
    costCoins: 140,
    unlockLevel: 10,
    style: { primary: '#E63946', secondary: '#2A9D8F', accent: '#F6C445' },
  },
  {
    id: 'decor_radio',
    category: 'decor',
    name: { bn: 'রেডিও ও বাংলা ক্যালেন্ডার', en: 'Radio & Bangla Calendar' },
    description: { bn: 'দেয়ালে হালখাতার ক্যালেন্ডার আর তাকের কোণে রেডিও।', en: 'A Halkhata wall calendar and a classic shop radio.' },
    costCoins: 280,
    unlockLevel: 30,
    style: { primary: '#D97706', secondary: '#FEF3C7', accent: '#92400E' },
  },
  {
    id: 'decor_alpana',
    category: 'decor',
    name: { bn: 'উৎসবের আলপনা ও ঝাড়বাতি', en: 'Festival Alpana & Lanterns' },
    description: { bn: 'বৈশাখ ও ঈদের ঐতিহ্যবাহী আলপনা এবং রঙিন ফানুস।', en: 'Traditional Bengali alpana motifs and festive lanterns.' },
    costCoins: 480,
    unlockLevel: 50,
    style: { primary: '#EC4899', secondary: '#F6C445', accent: '#10B981' },
  },

  // ── 4. Shopkeeper Outfits ──
  {
    id: 'outfit_apron',
    category: 'outfit',
    name: { bn: 'দোকানদারের অ্যাপ্রন', en: 'Shopkeeper Apron' },
    description: { bn: 'সবুজ অ্যাপ্রন ও পাঞ্জাবি-শার্ট — কাজের জন্য সেরা।', en: 'Teal shopkeeper apron over a crisp shirt.' },
    costCoins: 0,
    unlockLevel: 1,
    style: { primary: '#0A9396', secondary: '#F4E9D0', accent: '#3B2314' },
  },
  {
    id: 'outfit_panjabi',
    category: 'outfit',
    name: { bn: 'সাদা পাঞ্জাবি ও টুপি', en: 'White Panjabi & Tupi' },
    description: { bn: 'শুক্রবার ও উৎসবের সোনালি বোতামের সাদা পাঞ্জাবি।', en: 'Crisp white panjabi with gold buttons and tupi.' },
    costCoins: 160,
    unlockLevel: 8,
    style: { primary: '#FFFFFF', secondary: '#F6C445', accent: '#3B2314' },
  },
  {
    id: 'outfit_lungi',
    category: 'outfit',
    name: { bn: 'গেঞ্জি ও লাল গামছা', en: 'Ganji & Red Gamcha' },
    description: { bn: 'গরমের দিনে কাঁধে লাল-সাদা গামছা।', en: 'Classic cotton vest with a checked red gamcha on the shoulder.' },
    costCoins: 200,
    unlockLevel: 18,
    style: { primary: '#E63946', secondary: '#FFFFFF', accent: '#3B2314' },
  },
  {
    id: 'outfit_cricket',
    category: 'outfit',
    name: { bn: 'টাইগার ক্রিকেট জার্সি', en: 'Tiger Cricket Jersey' },
    description: { bn: 'লাল-সবুজ বাংলাদেশ ক্রিকেট জার্সি ও ক্যাপ!', en: 'Red-and-green Bangladesh cricket jersey and cap!' },
    costCoins: 300,
    unlockLevel: 35,
    style: { primary: '#006A4E', secondary: '#F42A41', accent: '#F6C445' },
  },
  {
    id: 'outfit_boss',
    category: 'outfit',
    name: { bn: 'চেয়ারম্যান স্যুট', en: 'Chairman Suit' },
    description: { bn: 'কালো স্যুট, সোনালি টাই আর রোদচশমা।', en: 'Sharp dark suit, gold tie and sunglasses.' },
    costCoins: 450,
    unlockLevel: 60,
    style: { primary: '#1F2937', secondary: '#F6C445', accent: '#FFFFFF' },
  },
  {
    id: 'outfit_king',
    category: 'outfit',
    name: { bn: 'দোকান সম্রাটের মুকুট', en: 'Shop King Regalia' },
    description: { bn: 'মেরুন শেরওয়ানি, গলায় চেইন আর মাথায় সম্রাটের মুকুট!', en: 'Crimson sherwani, gold chain and the Shop King crown!' },
    costCoins: 750,
    unlockLevel: 80,
    style: { primary: '#9D0208', secondary: '#F6C445', accent: '#2A9D8F' },
  },

  // ── 5. Counter Designs ──
  {
    id: 'counter_wood',
    category: 'counter',
    name: { bn: 'কাঠের কাউন্টার', en: 'Wooden Counter' },
    description: { bn: 'পাড়ার দোকানের চিরচেনা তক্তার কাউন্টার।', en: 'Familiar timber plank counter.' },
    costCoins: 0,
    unlockLevel: 1,
    style: { primary: '#A47148', secondary: '#7F4F24', accent: '#E6CCB2' },
  },
  {
    id: 'counter_tiles',
    category: 'counter',
    name: { bn: 'মোজাইক টাইলস কাউন্টার', en: 'Mosaic Tile Counter' },
    description: { bn: 'ফিরোজা-সাদা টাইলস বসানো পরিষ্কার কাউন্টার।', en: 'Clean counter topped with turquoise mosaic tiles.' },
    costCoins: 180,
    unlockLevel: 15,
    style: { primary: '#0D9488', secondary: '#115E59', accent: '#CCFBF1' },
  },
  {
    id: 'counter_digital',
    category: 'counter',
    name: { bn: 'ডিজিটাল ক্যাশ কাউন্টার', en: 'Digital Cash Counter' },
    description: { bn: 'সুপার শপের আধুনিক চেকআউট কাউন্টার।', en: 'Sleek modern supermarket checkout counter.' },
    costCoins: 360,
    unlockLevel: 45,
    style: { primary: '#334155', secondary: '#1E293B', accent: '#38BDF8' },
  },
  {
    id: 'counter_gold',
    category: 'counter',
    name: { bn: 'সোনালি সম্রাট কাউন্টার', en: 'Golden King Counter' },
    description: { bn: 'সোনালি কারুকাজ করা রাজকীয় ক্যাশ কাউন্টার।', en: 'Ornate crimson and gold royal counter.' },
    costCoins: 600,
    unlockLevel: 70,
    style: { primary: '#991B1B', secondary: '#7F1D1D', accent: '#F6C445' },
  },

  // ── 6. Shop Environments ──
  {
    id: 'env_para',
    category: 'env',
    name: { bn: 'পাড়ার ছোট দোকান', en: 'Small Para Shop' },
    description: { bn: 'উষ্ণ হলুদ দেয়াল আর টিনের চালের পাড়ার দোকান।', en: 'Warm ochre walls and tin roof of a friendly neighbourhood shop.' },
    costCoins: 0,
    unlockLevel: 1,
    style: { primary: '#FFF3D6', secondary: '#F4D58D', accent: '#C9462C' },
  },
  {
    id: 'env_bazar',
    category: 'env',
    name: { bn: 'ব্যস্ত বাজারের দোকান', en: 'Busy Bazar Shop' },
    description: { bn: 'বাজারের মোড়ের জমজমাট মুদি দোকান।', en: 'Lively corner shop in a bustling Bangladeshi bazar.' },
    costCoins: 220,
    unlockLevel: 21,
    style: { primary: '#E8F5E9', secondary: '#A5D6A7', accent: '#2E7D32' },
  },
  {
    id: 'env_store',
    category: 'env',
    name: { bn: 'জনপ্রিয় জেনারেল স্টোর', en: 'Popular Local Store' },
    description: { bn: 'পাকা দেয়াল ও প্রশস্ত তাকের এলাকার সেরা স্টোর।', en: 'Brick-and-tile local store with bright lighting.' },
    costCoins: 380,
    unlockLevel: 41,
    style: { primary: '#E0F2FE', secondary: '#93C5FD', accent: '#1D4ED8' },
  },
  {
    id: 'env_super',
    category: 'env',
    name: { bn: 'আধুনিক সুপার শপ', en: 'Modern Super Shop' },
    description: { bn: 'এসি ও উজ্জ্বল আলোয় সাজানো শহরের সুপার শপ।', en: 'Air-conditioned modern city super shop.' },
    costCoins: 550,
    unlockLevel: 61,
    style: { primary: '#F0FDFA', secondary: '#99F6E4', accent: '#0F766E' },
  },
  {
    id: 'env_king',
    category: 'env',
    name: { bn: 'দোকান সম্রাটের দরবার', en: 'Shop King Emporium' },
    description: { bn: 'সোনালি আলো ও রাজকীয় মেঝের সেরা গ্রোসারি এম্পোরিয়াম!', en: 'Grand golden emporium of the Ultimate Shopkeeper!' },
    costCoins: 800,
    unlockLevel: 81,
    style: { primary: '#FAF5FF', secondary: '#E9D5FF', accent: '#6D28D9' },
  },
];

export const CUSTOMIZATION_MAP: Record<string, CustomizationItem> = Object.fromEntries(
  CUSTOMIZATION_ITEMS.map((item) => [item.id, item]),
);

export const AVATARS: { id: string; look: string; name: L10n }[] = [
  { id: 'shopkeeper', look: 'shopkeeper', name: { bn: 'দোকানদার ভাই', en: 'Shopkeeper Bhai' } },
  { id: 'apa', look: 'apa', name: { bn: 'উদ্যোক্তা আপা', en: 'Entrepreneur Apa' } },
  { id: 'chacha', look: 'chacha', name: { bn: 'মুরুব্বি চাচা', en: 'Chacha' } },
  { id: 'student', look: 'student', name: { bn: 'তরুণ দোকানি', en: 'Student Shopkeeper' } },
  { id: 'bargain', look: 'bargain', name: { bn: 'পাকা ব্যবসায়ী', en: 'Smart Trader' } },
  { id: 'vip', look: 'vip', name: { bn: 'স্মার্ট বস', en: 'Smart Boss' } },
];

export const DISTRICTS: { id: string; bn: string; en: string }[] = [
  { id: 'dhaka', bn: 'ঢাকা', en: 'Dhaka' },
  { id: 'chattogram', bn: 'চট্টগ্রাম', en: 'Chattogram' },
  { id: 'sylhet', bn: 'সিলেট', en: 'Sylhet' },
  { id: 'rajshahi', bn: 'রাজশাহী', en: 'Rajshahi' },
  { id: 'khulna', bn: 'খুলনা', en: 'Khulna' },
  { id: 'barishal', bn: 'বরিশাল', en: 'Barishal' },
  { id: 'rangpur', bn: 'রংপুর', en: 'Rangpur' },
  { id: 'mymensingh', bn: 'ময়মনসিংহ', en: 'Mymensingh' },
  { id: 'cumilla', bn: 'কুমিল্লা', en: 'Cumilla' },
  { id: 'bogura', bn: 'বগুড়া', en: 'Bogura' },
  { id: 'gazipur', bn: 'গাজীপুর', en: 'Gazipur' },
  { id: 'narayanganj', bn: 'নারায়ণগঞ্জ', en: 'Narayanganj' },
  { id: 'jashore', bn: 'যশোর', en: 'Jashore' },
  { id: 'coxsbazar', bn: 'কক্সবাজার', en: "Cox's Bazar" },
  { id: 'dinajpur', bn: 'দিনাজপুর', en: 'Dinajpur' },
  { id: 'noakhali', bn: 'নোয়াখালী', en: 'Noakhali' },
];

/** Player rank level derived from total XP. */
export function levelFromXp(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number } {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  let spent = 0;
  while (level < 50) {
    const needed = 100 + (level - 1) * 60;
    if (safeXp < spent + needed) {
      return { level, currentLevelXp: safeXp - spent, nextLevelXp: needed };
    }
    spent += needed;
    level++;
  }
  return { level: 50, currentLevelXp: safeXp - spent, nextLevelXp: 3000 };
}

export function shopTitleForLevel(level: number, storyCompleted: number): L10n {
  if (storyCompleted >= 100) return { bn: 'দোকান সম্রাট', en: 'Ultimate Shopkeeper' };
  if (level >= 25 || storyCompleted >= 80) return { bn: 'মহাজন সেরা', en: 'Grand Merchant' };
  if (level >= 15 || storyCompleted >= 60) return { bn: 'সুপার শপ মালিক', en: 'Super Shop Owner' };
  if (level >= 8 || storyCompleted >= 30) return { bn: 'পাকা দোকানদার', en: 'Seasoned Shopkeeper' };
  if (level >= 4 || storyCompleted >= 10) return { bn: 'বিশ্বস্ত মুদিওয়ালা', en: 'Trusted Grocer' };
  return { bn: 'নতুন দোকানদার', en: 'New Shopkeeper' };
}
