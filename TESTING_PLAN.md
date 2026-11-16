# TESTING PLAN — দোকান সামলাও! (Dokaan Shamlao)

## 1. Automated Test Suites

### A. Unit Tests (`npm run test` — `tests/unit/`)
1. **`tests/unit/content-and-i18n.test.ts`**:
   - Verifies exact key parity between Bangla (`src/content/i18n/bn.ts`) and English (`src/content/i18n/en.ts`).
   - Verifies Bangla digit conversion (`০-৯`), Taka formatting (`৳`), and `#product` / `@i18n` token resolution.
   - Validates all 38 products, 18 customer archetypes, 25 character SVG specs, 67 challenge templates across all 7 categories, 20 achievements, and 24 shop customizations.
2. **`tests/unit/sim-and-mechanics.test.ts`**:
   - Tests customer state machine transitions (`canTransition`) and rejects illegal state jumps.
   - Tests change drawer subset-sum (`Sim.canMakeChange`) and greedy/DFS note selection (`makeChange`).
   - Tests product bagging, wrong-tap penalties, and payment collection.
   - Tests deterministic replay (`replay()`) and verifies rejection of tampered/out-of-order/illegal action logs.
3. **`tests/unit/levels-and-modes.test.ts`**:
   - Runs structural validation (`validateConfig`) and reference AI bots (`BOT_SKILLED`, `BOT_CASUAL`, `BOT_STEADY`) across **all 100 Story Mode levels** and **all 5 Boss encounters**.
   - Verifies Endless, Time Attack (60s/120s), Survival, Daily Challenge, Friend Challenge, and the procedural generator (`generateChallenge`).

### B. Backend Integration Tests (`npm run test:integration` — `tests/integration/`)
- Boots an isolated UTF-8 `embedded-postgres` instance (`tests/integration/global-setup.ts`), pushes the Prisma schema, and tests:
  - Anonymous player creation & profile persistence.
  - Display-name moderation (email/phone/profanity stripping).
  - Session creation, server-side replay score validation, Level 2 unlock, and duplicate submission rejection.
  - Tampered action log rejection (`illegal_action`).
  - Daily challenge seed consistency (`Asia/Dhaka`) and leaderboard rankings (`daily`, `weekly`, `alltime`, `district`).
  - Friend challenge creation/lookup and shop customization unlocking.

### C. End-to-End Browser Tests (`npm run test:e2e` — `tests/e2e/dokaan.spec.ts`)
- Runs Playwright in mobile portrait viewport (`Pixel 7`) through the full critical player journey:
  1. Open home screen without registration.
  2. Start Level 1, view tutorial modal, complete Level 1, and inspect Results screen.
  3. Confirm Level 2 is unlocked on the Level Map.
  4. Refresh browser and confirm progression is retained.
  5. Play Daily Challenge and submit score.
  6. Open Leaderboard and verify ranked entry.
