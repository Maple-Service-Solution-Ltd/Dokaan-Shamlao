# GAME ARCHITECTURE — দোকান সামলাও! (Dokaan Shamlao)

## 1. Layered Architecture Overview

The codebase is organized into five strictly separated layers:

```text
src/
├── core/         # Layer A & B: Deterministic Simulation, Decisions, Events, Bot, Replay
├── content/      # Layer E: Data-driven Products, Archetypes, 67 Challenges, 100 Levels, Modes, i18n
├── game/         # Layer A (View): Phaser 3 Scene, Parametric SVG Art, Web Audio Synthesizer
├── components/   # Layer C: React 19 Mobile-First UI Shell & HUD (9 Screens)
├── server/       # Layer D: Prisma PostgreSQL Service, Auth, Anti-Cheat Replay, Rate Limiter
└── app/          # Next.js 15 App Router Pages & Versioned REST API (/api/v1/*)
```

## 2. Deterministic Simulation & Server Replay (`src/core/`)
- **`Sim` (`src/core/sim.ts`)**: Advances in discrete ticks (`TICKS_PER_SEC = 10`). Contains zero `Math.random()` or wall-clock calls; all randomness uses `Rng` (`src/core/rng.ts`) seeded from `GameConfig.seed` + deterministic salts.
- **Action Log (`ActionTuple`)**: Every player input is recorded as `[tick, actionType, a, b, ...rest]`.
- **Server Validation (`src/core/replay.ts`)**: When a client submits a completed run to `POST /api/v1/sessions/submit`, the server reconstructs the exact `GameConfig` from the stored session descriptor and replays the `ActionTuple[]` log through a fresh `Sim` instance. The server never trusts client-supplied scores.

## 3. Rendering & Audio Architecture (`src/game/`)
- **Phaser 3 Stage (`src/game/PhaserStage.tsx`)**: Mounted dynamically on the client. Reads live state from a mutable bridge ref (`bridgeRef`) inside the Phaser `update()` loop so 60 FPS animations run without triggering React re-renders.
- **Procedural Vector Art (`src/game/art/`)**: Characters (`characters.ts`), products (`products.ts`), and banknotes/hotspots (`shop.ts`) are generated from compact parametric SVG specifications and cached as textures.
- **Web Audio Synthesizer (`src/game/audio.ts`)**: Synthesizes folk-inspired background music and 12 distinct sound effects using the browser's native `AudioContext`, avoiding large audio downloads on mobile data connections.

## 4. Database & Persistence (`prisma/` & `src/server/`)
- **Primary Store**: PostgreSQL managed via Prisma (`prisma/schema.prisma`).
- **Offline / Dev Resilience**: `src/server/service.ts` automatically detects database availability and synced local backups (`localStorage`) so players can start playing immediately without registration and never lose progress across refreshes or intermittent mobile connections.
