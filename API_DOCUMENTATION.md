# API DOCUMENTATION — দোকান সামলাও! (Dokaan Shamlao)

All endpoints are versioned under `/api/v1/*`. Anonymous authentication is handled automatically via the HTTP-only cookie `dokaan_player_token` or the `x-player-token` request header.

---

## 1. `GET /api/v1/player`
Bootstraps or retrieves the current anonymous player's profile, progress, and achievement statuses.

## 2. `POST /api/v1/player`
Updates player profile and preferences.
- **Body**: `{ displayName?: string, avatar?: string, district?: string | null, lang?: "bn" | "en", musicOn?: boolean, sfxOn?: boolean, tutorialsSeen?: string[] }`
- **Moderation**: Strips phone numbers, email addresses, HTML tags, and profanity from `displayName`.

## 3. `POST /api/v1/sessions/start`
Creates an authoritative `GameSession` and returns the session ID, deterministic seed, and `GameConfig`.
- **Body**: `{ mode: "story" | "endless" | "time" | "survival" | "daily" | "friend", level?: number, secs?: 60 | 120, date?: string, code?: string }`
- **Response**: `{ ok: true, sessionId, seed, config, descriptor }`

## 4. `POST /api/v1/sessions/submit`
Replays the player's recorded action log on the server via `src/core/replay.ts` to validate the score and grant rewards idempotently.
- **Body**: `{ sessionId: string, log: number[][], endTick: number, quit: boolean }`
- **Validation**:
  - Verifies session ownership and `status === "active"` (rejects duplicate submissions).
  - Re-simulates `log` tick-by-tick against the session's authoritative `GameConfig`.
  - Rejects malformed actions, out-of-order ticks, illegal actions, or `peakActionsPerSec > 35`.
- **Response**: `{ ok: true, result, rewardsGranted, player, leaderboardRank }`

## 5. `GET /api/v1/daily`
Returns today's (`Asia/Dhaka`) Daily Challenge configuration, leaderboard, retry policy, and 7-day history.

## 6. `GET /api/v1/friends?code=ABCDEF` & `POST /api/v1/friends`
- `POST`: Generates a new 6-character shareable Friend Challenge code valid for 7 days.
- `GET`: Fetches the challenge configuration and friend leaderboard for `code`.

## 7. `GET /api/v1/leaderboards`
Returns server-validated rankings.
- **Query Params**: `scope=daily|weekly|alltime|friends`, `board=endless|time60|time120|survival`, `district=<districtId>`, `code=<friendCode>`, `limit=20`.

## 8. `POST /api/v1/customize`
Unlocks (if not yet owned) and equips a visual shop customization item.
- **Body**: `{ itemId: string }`

## 9. `POST /api/v1/analytics`
Records a privacy-conscious analytics event (`game_started`, `level_started`, `level_completed`, `level_failed`, `boss_defeated`, `daily_challenge_played`, `friend_challenge_created`, `hello_khata_clicked`).

## 10. `GET /api/v1/content`
Returns versioned content metadata (levels, chapters, challenges, products, achievements, customizations, districts).
