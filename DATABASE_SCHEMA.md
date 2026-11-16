# DATABASE SCHEMA — দোকান সামলাও! (Dokaan Shamlao)

Managed by **Prisma ORM** (`prisma/schema.prisma`) on **PostgreSQL** (UTF-8 encoding).

## Tables Overview

1. **`players`**: Anonymous player identity (`id`, `tokenHash` SHA-256 unique, `accountCode` `HK-XXXX-XXXX` unique, `createdAt`, `lastSeenAt`).
2. **`player_profiles`**: Display preferences (`playerId`, `displayName`, `avatar`, `district`, `lang`, `musicOn`, `sfxOn`).
3. **`player_progress`**: Authoritative progression (`playerId`, `coins`, `xp`, `highestLevel`, `storyStars` JSON, `bestScores` JSON, `unlockedItems` JSON, `equippedItems` JSON, `lifetimeStats` JSON, `tutorialsSeen` JSON).
4. **`game_sessions`**: Active & completed runs (`id`, `playerId`, `mode`, `configId`, `seed`, `descriptor` JSON, `status`, `startedAt`, `completedAt`).
5. **`session_actions`**: Recorded replay logs (`id`, `sessionId`, `actionCount`, `endTick`, `quit`, `peakActionsPerSec`, `log` JSON).
6. **`levels`**: Seeded 100 Story Mode level definitions (`levelNumber`, `chapter`, `titleBn`, `titleEn`, `bossId`, `challenges`, `config`, `version`).
7. **`challenge_templates`**: Seeded 67 challenge definitions (`id`, `category`, `difficulty`, `minLevel`, `nameBn`, `nameEn`, `definition`, `version`).
8. **`challenge_events`**: Timeline event metadata (`id`, `kind`, `description`).
9. **`challenge_runs`**: Validated run summaries (`id`, `sessionId`, `playerId`, `mode`, `configId`, `challengeIds`, `won`, `reason`, `score`, `stars`, `ticks`, `accuracy`, `satisfaction`, `profit`, `stats`).
10. **`scores`**: Ranked leaderboard entries (`id`, `sessionId`, `playerId`, `board`, `weekKey`, `score`, `stars`, `ticks`, `district`, `createdAt`) with composite indexes on `(board, score DESC, ticks ASC)`, `(board, weekKey, score DESC)`, and `(board, district, score DESC)`.
11. **`leaderboards`**: Leaderboard metadata (`id`, `titleBn`, `titleEn`, `mode`).
12. **`achievements`**: 20 achievement definitions (`id`, `nameBn`, `nameEn`, `descriptionBn`, `descriptionEn`, `icon`, `target`, `rewardCoins`, `rewardXp`).
13. **`player_achievements`**: Per-player achievement progress (`playerId`, `achievementId`, `progress`, `unlocked`, `unlockedAt`).
14. **`rewards`**: Unlockable shop customization catalog (`id`, `category`, `nameBn`, `nameEn`, `costCoins`, `unlockLevel`, `meta`).
15. **`player_rewards`**: Idempotent reward ledger (`id`, `playerId`, `rewardId`, `sourceKey`, `coins`, `xp`, `grantedAt`) with `@@unique([playerId, sourceKey])` to prevent duplicate reward grants.
16. **`daily_challenges`**: Server-seeded daily challenge configs (`date` YYYY-MM-DD in `Asia/Dhaka`, `seed`, `config`).
17. **`friend_challenges`**: Shareable friend challenges (`code` 6-char unique, `creatorId`, `creatorName`, `creatorScore`, `seed`, `config`, `expiresAt`).
18. **`analytics_events`**: Privacy-conscious telemetry (`id`, `playerId`, `sessionId`, `name`, `props`, `createdAt`).
