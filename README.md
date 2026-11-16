# দোকান সামলাও! — Dokaan Shamlao

**দোকান সামলাও! (Dokaan Shamlao)** is a free-to-play, mobile-first Bangladeshi grocery shopkeeping arcade browser game built with **Next.js 15**, **Phaser 3**, **React 19**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**, presented by **HelloKhata** (**Maple Service Solution Limited**).

---

## Key Features

- **Authentic Bangladeshi Identity**: 38 familiar grocery products across 5 shelf categories (`মুদি`, `নাস্তা`, `ঠান্ডা`, `ঘরোয়া`, `বিশেষ`), 18 distinct customer personalities (Bargain Master, Kipta Customer, Confused Aunty, VIP, Credit Customer, Elderly, Child, Family, Old Debtor, etc.), Bangla & English localization with Bangla default (`৳` numerals), and Bangladeshi Taka banknotes (`৳500` down to `৳5`) with counterfeit visual inspection.
- **6 Complete Game Modes**:
  1. **Story Mode**: 100 handcrafted levels across 5 chapters (`পাড়ার ছোট দোকান` → `দোকান সম্রাটের চ্যালেঞ্জ`) with 1–3 star ratings.
  2. **Endless Mode**: Continuous customer waves with escalating arrival speed and shrinking patience.
  3. **Time Attack**: 60-second and 120-second high-speed order rushes.
  4. **Survival Mode**: Escalating emergencies (load shedding, monsoon rain, roof leaks, fridge breakdowns, thieves, flood warnings).
  5. **Daily Challenge**: Server-seeded daily challenge (`Asia/Dhaka` timezone) with 7-day history and daily leaderboard.
  6. **Challenge a Friend**: Generate 6-character shareable challenge codes and compete head-to-head on a friend leaderboard.
- **67 Data-Driven Challenges Across 7 Categories**:
  - Customer (15), Inventory (12), Cash & Accounting (10), Emergency (10), Supplier (8), Seasonal (12), and Skill (10).
- **5 Multi-Phase Boss Encounters**:
  - **কাস্টমার ঝড় (Customer Storm)**, **বাকি সম্রাট (Credit King)**, **পাইকারি মহাজন (Wholesale Tycoon)**, **চোর ধরো (Missing Stock)**, and **হিসাবের ভূত (Accounting Ghost)**.
- **Authoritative Server-Side Score Validation**:
  - The simulation (`src/core/sim.ts`) is 100% deterministic (`10 ticks/sec`). When a run finishes, the server replays the player's action log via `src/core/replay.ts` to compute the authoritative score, stars, coins, XP, and achievement progress.
- **20 Achievements & 24 Visual Shop Customizations**:
  - Unlock shop signs, shelves, festive decorations, shopkeeper outfits, counters, and shop environments with earned coins.
- **Natural HelloKhata Integration**:
  - Playable immediately without registration or login. Completely independent of HelloKhata ERP data, with subtle non-intrusive HelloKhata attribution links.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Start embedded local PostgreSQL & seed content
npm run db:dev

# 3. Start development server on http://localhost:3000
npm run dev
```

## Scripts & Verification Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server on port 3000 |
| `npm run build` | Generate Prisma client and build standalone Next.js production bundle |
| `npm run typecheck` | Run strict TypeScript check (`tsc --noEmit`) |
| `npm run test` | Run Vitest unit test suite (simulation, 100 levels, 67 challenges, i18n, art) |
| `npm run test:integration` | Run Vitest integration test suite against embedded PostgreSQL |
| `npm run test:e2e` | Run Playwright end-to-end browser tests |
| `npm run test:all` | Run typecheck + unit tests + integration tests |
| `npm run content:build` | Validate and export `public/content-pack.json` |
