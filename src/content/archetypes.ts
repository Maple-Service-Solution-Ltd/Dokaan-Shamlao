import type { ArchetypeDef, ArchetypeId } from '@/core/types';

/** Customer personalities. `looks` reference character ids in game/art/characters.ts. */
export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
  regular: {
    id: 'regular', name: { bn: 'সাধারণ কাস্টমার', en: 'Regular Customer' },
    looks: ['bhai', 'apa', 'chacha', 'student'], patiencePct: 100, scorePct: 100, sizeAdd: 0, lostRep: 12,
    about: { bn: 'পাড়ার চেনা মুখ। যা চায় তা-ই দিন।', en: 'A familiar neighbourhood face. Just give them what they ask for.' },
  },
  impatient: {
    id: 'impatient', name: { bn: 'অধৈর্য কাস্টমার', en: 'Impatient Customer' },
    looks: ['impatient'], patiencePct: 50, scorePct: 130, sizeAdd: 0, lostRep: 14,
    about: { bn: 'সব সময় তাড়া। ধৈর্য অর্ধেক, তবে দ্রুত সামলালে বোনাস বেশি।', en: 'Always in a hurry. Half the patience, but a bigger bonus when served fast.' },
  },
  bargain: {
    id: 'bargain', name: { bn: 'দরদামের ওস্তাদ', en: 'Bargain Master' },
    looks: ['bargain'], patiencePct: 110, scorePct: 120, sizeAdd: 0, lostRep: 10,
    about: { bn: 'দাম কমাতে চাইবেই। মুখ দেখে বুঝুন কতটা ছাড় দিলে চলবে।', en: 'Will always haggle. Read their mood to decide how much discount is enough.' },
  },
  elderly: {
    id: 'elderly', name: { bn: 'দাদু / নানি', en: 'Elderly Customer' },
    looks: ['dadu', 'nani'], patiencePct: 170, scorePct: 110, sizeAdd: 0, lostRep: 14,
    about: { bn: 'ধীরে ধীরে একটা একটা করে জিনিস বলেন। ধৈর্য অনেক।', en: 'Asks for items slowly, one at a time. Very patient.' },
  },
  child: {
    id: 'child', name: { bn: 'পিচ্চি কাস্টমার', en: 'Child Customer' },
    looks: ['pichchi', 'schoolgirl'], patiencePct: 120, scorePct: 100, sizeAdd: -1, lostRep: 8,
    about: { bn: 'হাতে গোনা টাকা। টাকায় না কুলালে কোনটা বাদ যাবে আপনিই ঠিক করুন।', en: 'Carries exact pocket money. If it is not enough, you decide what to leave out.' },
  },
  vip: {
    id: 'vip', name: { bn: 'ভিআইপি কাস্টমার', en: 'VIP Customer' },
    looks: ['vip'], patiencePct: 70, scorePct: 180, sizeAdd: 2, lostRep: 25,
    about: { bn: 'বড় অর্ডার, বড় নোট, ভুল একদম সহ্য করেন না। নিখুঁত হলে বকশিশ।', en: 'Big order, big notes, zero tolerance for mistakes. Tips for perfect service.' },
  },
  bulk: {
    id: 'bulk', name: { bn: 'পাইকারি ক্রেতা', en: 'Bulk Buyer' },
    looks: ['bulk'], patiencePct: 120, scorePct: 140, sizeAdd: -1, lostRep: 16,
    about: { bn: 'এক জিনিস অনেকগুলো নেন। ×৫ বোতাম কাজে লাগান।', en: 'Buys many units of the same thing. Use the ×5 button.' },
  },
  credit: {
    id: 'credit', name: { bn: 'বাকির কাস্টমার', en: 'Credit Customer' },
    looks: ['credit'], patiencePct: 100, scorePct: 120, sizeAdd: 0, lostRep: 8,
    about: { bn: 'বাকিতে চাইবেন। বিশ্বাসযোগ্যতা আর বাকির সীমা দেখে সিদ্ধান্ত নিন।', en: 'Asks for credit. Decide using their trust rating and your credit limit.' },
  },
  angry: {
    id: 'angry', name: { bn: 'রাগী কাস্টমার', en: 'Angry Customer' },
    looks: ['angry'], patiencePct: 75, scorePct: 130, sizeAdd: 0, lostRep: 14,
    about: { bn: 'অভিযোগ নিয়ে আসেন। ঠিকমতো সামলালে শান্ত হন।', en: 'Arrives with a complaint. Handle it right and they calm down.' },
  },
  confused: {
    id: 'confused', name: { bn: 'ভুলোমনা খালা', en: 'Confused Customer' },
    looks: ['confused'], patiencePct: 130, scorePct: 130, sizeAdd: 0, lostRep: 10,
    about: { bn: 'জিনিসের নাম মনে নেই, বর্ণনা দেন। ধাঁধা বুঝে পণ্য দিন।', en: 'Forgets product names and describes them. Solve the riddle.' },
  },
  forgetful: {
    id: 'forgetful', name: { bn: 'ভুলে-যাওয়া কাস্টমার', en: 'Forgetful Customer' },
    looks: ['chacha', 'apa'], patiencePct: 110, scorePct: 115, sizeAdd: 0, lostRep: 10,
    about: { bn: 'শেষ মুহূর্তে "ওহ্‌, আরেকটা জিনিস!" বলবেন।', en: 'Will add "oh, one more thing!" at the last second.' },
  },
  kipta: {
    id: 'kipta', name: { bn: 'কিপ্টা কাস্টমার', en: 'Miserly Customer' },
    looks: ['kipta'], patiencePct: 110, scorePct: 130, sizeAdd: 0, lostRep: 8,
    about: { bn: 'টাকা কম দিয়ে পার পেতে চান। টাকা গুনে নিন!', en: 'Tries to underpay. Count the money!' },
  },
  repeat: {
    id: 'repeat', name: { bn: 'নিয়মিত কাস্টমার', en: 'Repeat Customer' },
    looks: ['regular2'], patiencePct: 110, scorePct: 150, sizeAdd: 0, lostRep: 12,
    about: { bn: 'দ্বিতীয়বার এসে বলবেন "আগের মতোই দেন" — মনে রাখুন!', en: 'Returns saying "same as before" — remember the order!' },
  },
  secret: {
    id: 'secret', name: { bn: 'গোপন ক্রেতা', en: 'Secret Shopper' },
    looks: ['bhai', 'apa', 'student'], patiencePct: 90, scorePct: 150, sizeAdd: 0, lostRep: 20,
    about: { bn: 'দেখতে সাধারণ, কিন্তু আপনার সেবার রেটিং দেন।', en: 'Looks ordinary but secretly rates your service.' },
  },
  family: {
    id: 'family', name: { bn: 'পুরো পরিবার', en: 'Family Shopping' },
    looks: ['family'], patiencePct: 150, scorePct: 150, sizeAdd: 0, lostRep: 16,
    about: { bn: 'একজনের পর একজন জিনিস যোগ করেন। অর্ডার ধাপে ধাপে আসে।', en: 'Each family member adds items. The order arrives in waves.' },
  },
  debtor: {
    id: 'debtor', name: { bn: 'পুরনো বাকিদার', en: 'Old Debtor' },
    looks: ['credit', 'chacha'], patiencePct: 120, scorePct: 100, sizeAdd: 0, lostRep: 0,
    about: { bn: 'বাকি শোধ করতে পারেন — কীভাবে চাইবেন তার ওপর নির্ভর করে।', en: 'May repay their dues — depending on how you ask.' },
  },
  booker: {
    id: 'booker', name: { bn: 'বিয়ের বাজার', en: 'Wedding Booking' },
    looks: ['vip', 'chacha'], patiencePct: 130, scorePct: 100, sizeAdd: 0, lostRep: 6,
    about: { bn: 'আগাম বুকিং দেন, পরে এসে মাল নেন। স্টক রেখে দিন!', en: 'Books in advance and collects later. Keep the stock ready!' },
  },
  pickup: {
    id: 'pickup', name: { bn: 'বুকিংয়ের মাল নিতে', en: 'Booking Pickup' },
    looks: ['vip', 'chacha'], patiencePct: 110, scorePct: 170, sizeAdd: 0, lostRep: 20,
    about: { bn: 'বুকিংয়ের মাল নিতে এসেছেন।', en: 'Here to collect a booked order.' },
  },
};
