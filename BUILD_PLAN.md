# BUILD PLAN — দোকান সামলাও! (Dokaan Shamlao)

## 1. Repository Audit Summary

- **Framework & Stack**: Next.js 15 (`App Router`, standalone output), React 19, Phaser 3.90, TypeScript 5.9 (`strict: true`), Prisma 6.19 with PostgreSQL (`embedded-postgres` for zero-config local/CI dev and standard `DATABASE_URL` for managed PostgreSQL), Zod 3.25, Vitest 3.2, Playwright 1.65.
- **Completed Core & Content Modules**:
  - `src/core/types.ts`: Complete type definitions for simulation, customers, orders, payments, decisions, hotspots, modifiers, bosses, objectives, actions, and results.
  - `src/core/rng.ts`: Deterministic PRNG (`Rng`, `mixSeed`, `hashString`).
  - `src/core/sim.ts`: Full deterministic tick-based (`10 ticks/sec`) shop simulation engine with state machine transitions, customer spawning, order waves, stock reservation, payment & change drawer subset-sum verification, decision queue, timeline events, hotspots, and boss phases.
  - `src/core/decisions.ts`: All 22 modal decision builders & resolvers.
  - `src/core/events.ts`: All 25 timeline event triggers and 10 interactive scene hotspot handlers.
  - `src/core/replay.ts`: Deterministic server-side action-log replay & anti-cheat validator.
  - `src/core/bot.ts`: Reference AI bots (`BOT_SKILLED`, `BOT_STEADY`, `BOT_CASUAL`) proving playability of all 100 levels and procedural challenges.
  - `src/content/products.ts`: 38 authentic Bangladeshi grocery products across 5 shelf tabs (`মুদি`, `নাস্তা`, `ঠান্ডা`, `ঘরোয়া`, `বিশেষ`).
  - `src/content/archetypes.ts`: 18 distinct customer archetypes with Bangla/English personalities.
  - `src/content/challenges.ts`: 77 data-driven challenge templates across all 7 categories (Customer, Inventory, Cash & Accounting, Emergency, Supplier, Seasonal, Skill).
  - `src/content/levels.ts`: 100 Story Mode levels across 5 chapters + 5 Boss Encounters (`storm`, `creditKing`, `tycoon`, `thief`, `ghost`) with two difficulty tiers.
  - `src/content/modes.ts`: All 6 game modes (`story`, `endless`, `time`, `survival`, `daily`, `friend`) + controlled procedural challenge generator.
  - `src/content/builder.ts`: Draft composer, structural validator (`validateConfig`), and bot calibrator (`calibrate`, `withStars`).
  - `src/content/i18n/bn.ts`, `src/content/i18n/en.ts`, `src/lib/i18n.ts`: Complete Bangla (default) and English localization dictionary with Bangla numeral formatting (`৳`).
  - `src/game/art/characters.ts`, `src/game/art/products.ts`, `src/game/art/shop.ts`: Parametric SVG cartoon character generator (25 cast looks + 7 facial expressions + 6 shopkeeper outfits), 12 packaging icon templates, and Bangladeshi Taka notes with counterfeit tells.

---

## 2. Prioritized Implementation Checklist

### Phase 1 & 2: Remaining Content, Achievements, Customization & Shop Art
- [x] Audit repository and verify 100 levels + 6 modes via `scripts/check-levels.ts`
- [x] Create `src/content/achievements.ts` with 20 achievements, progress evaluators, bilingual descriptions, icons, and coin/XP rewards
- [x] Create `src/content/customization.ts` with 6 categories of unlockable shop customizations (`sign`, `shelf`, `decor`, `outfit`, `counter`, `env`), Bangladesh districts list (`DISTRICTS`), and XP/level progression helpers
- [x] Create `src/game/art/shop.ts` with SVG generators for Bangladeshi Taka notes (`৳500`, `৳100`, `৳50`, `৳20`, `৳10`, `৳5` including counterfeit visual tells), shop environments, signboards, counters, decorations, and hotspot badges
- [x] Verify `src/content/i18n/bn.ts` and `src/content/i18n/en.ts` parity and Bangla numeral formatting

### Phase 3 & 4: Audio Synthesizer & Phaser 3 Shop Scene
- [x] Create `src/game/audio.ts` Web Audio API procedural sound effects and Bangladeshi arcade background music loop with mute/volume controls and tab-visibility handling
- [x] Create `src/game/PhaserStage.tsx` Phaser 3 scene rendering the animated shop interior, shopkeeper with outfits & expressions, walking/waiting customer slots, patience bars, weather/emergency overlays (load-shedding darkness, monsoon rain, smoke/fire alarm), floating score/cash popups, and interactive scene hotspots

### Phase 5 & 6: Database Schema, Prisma Backend, Score Validation & APIs
- [x] Create `prisma/schema.prisma` with all 18 required entities (`Player`, `PlayerProfile`, `PlayerProgress`, `GameSession`, `SessionAction`, `Level`, `ChallengeTemplate`, `ChallengeEvent`, `ChallengeRun`, `Score`, `Leaderboard`, `Achievement`, `PlayerAchievement`, `Reward`, `PlayerReward`, `DailyChallenge`, `FriendChallenge`, `AnalyticsEvent`)
- [x] Create `src/server/db.ts`, `src/server/auth.ts`, `src/server/rate-limit.ts`, `src/server/http.ts`, and `src/server/service.ts`
- [x] Create Next.js API routes under `src/app/api/v1/` (`player`, `sessions/start`, `sessions/submit`, `daily`, `friends`, `leaderboards`, `customize`, `analytics`, `content`)
- [x] Create `prisma/seed.ts`, `scripts/dev-db.ts`, `scripts/build-content.ts`, `scripts/export-content.ts`

### Phase 7: Complete Application UI (All 9 Screens + Legal Pages + PWA)
- [x] Build `src/components/GameView.tsx` (Screen 4 Gameplay HUD + Phaser stage + Shelf tabs + Cash/Change drawer + Decision modals + Tutorials + Boss intro + Screen 5 Pause overlay + Screen 6 Results screen with shareable score card & HelloKhata CTA)
- [x] Build `src/components/DokaanApp.tsx` (Screen 1 Home, Screen 2 Mode Selection, Screen 3 Level Selection, Screen 7 Leaderboard, Screen 8 Player Profile, Screen 9 Shop Customization, Daily Challenge, Friend Challenge, Settings)
- [x] Build `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/rules/page.tsx`
- [x] Add `public/manifest.json` and `public/sw.js`

### Phase 8: Automated Testing, Verification & Documentation
- [x] Write Unit Tests (`tests/unit/`)
- [x] Write Integration Tests (`tests/integration/`)
- [x] Write Playwright E2E Tests (`tests/e2e/` + `playwright.config.ts`)
- [x] Write all 13 required documentation files (`README.md`, `BUILD_PLAN.md`, `GAME_DESIGN_DOCUMENT.md`, `GAME_ARCHITECTURE.md`, `CHALLENGE_CATALOG.md`, `LEVEL_DESIGN.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, `ART_ASSET_GUIDE.md`, `TESTING_PLAN.md`, `DEPLOYMENT_GUIDE.md`, `CHANGELOG.md`, `PROGRESS.md`)
- [x] Run `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run build`, and `npm run test:e2e`
