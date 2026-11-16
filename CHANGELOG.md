# CHANGELOG — দোকান সামলাও! (Dokaan Shamlao)

## v0.1.0 — Production Launch Candidate (2026-11-16)

### Added
- **Deterministic Simulation Engine (`src/core/`)**:
  - Tick-based (`10 ticks/sec`) shop simulation (`sim.ts`), 22 modal decision builders & resolvers (`decisions.ts`), 25 timeline events & 10 interactive scene hotspots (`events.ts`), server-side replay validator (`replay.ts`), and reference AI bots (`bot.ts`).
- **Content & Localization (`src/content/`)**:
  - 38 Bangladeshi grocery products across 5 tabs (`products.ts`).
  - 18 customer archetypes (`archetypes.ts`).
  - 67 data-driven challenge templates across all 7 categories (`challenges.ts`).
  - 100 Story Mode levels across 5 chapters and 5 multi-phase Boss Encounters (`levels.ts`).
  - 6 game modes (`story`, `endless`, `time`, `survival`, `daily`, `friend`) and controlled procedural challenge generator (`modes.ts`).
  - 20 achievements (`achievements.ts`) and 24 visual shop customizations across 6 categories (`customization.ts`).
  - Complete Bangla (default) and English localization (`i18n/bn.ts`, `i18n/en.ts`, `lib/i18n.ts`).
- **Phaser 3 Stage, Art & Audio (`src/game/`)**:
  - Parametric SVG character, expression, outfit, product, and Bangladeshi Taka banknote generators (`art/characters.ts`, `art/products.ts`, `art/shop.ts`).
  - Web Audio API procedural sound effects and folk-inspired background music (`audio.ts`).
  - Interactive Phaser 3 shop stage (`PhaserStage.tsx`).
- **Frontend Application (`src/components/`, `src/app/`)**:
  - All 9 required game screens (`Home`, `Mode Selection`, `Level Selection`, `Gameplay HUD`, `Pause`, `Results`, `Leaderboard`, `Player Profile`, `Shop Customization`), legal pages (`/privacy`, `/terms`, `/rules`), and PWA manifest/service worker.
- **Backend & Database (`prisma/`, `src/server/`, `src/app/api/v1/`)**:
  - 18-model PostgreSQL Prisma schema (`prisma/schema.prisma`), seed script (`prisma/seed.ts`), embedded dev database runner (`scripts/dev-db.ts`), and versioned `/api/v1/*` endpoints with server-side `replay()` score validation.
- **Automated QA (`tests/`)**:
  - Unit tests (`tests/unit/`), PostgreSQL integration tests (`tests/integration/`), and Playwright mobile E2E tests (`tests/e2e/`).
