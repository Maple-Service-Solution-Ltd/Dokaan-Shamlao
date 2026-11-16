# DEPLOYMENT GUIDE — দোকান সামলাও! (Dokaan Shamlao)

## 1. Environment Variables
Configure the following variables in production (`.env` / hosting provider secrets):

```env
# Managed PostgreSQL connection string (UTF-8 encoding)
DATABASE_URL="postgresql://user:password@host:5432/dokaan?schema=public"

# Long random secret used for HMAC player tokens and deterministic Daily Challenge seeds
GAME_SECRET="replace-with-64-char-random-production-secret"

# Public URL where the game is hosted
NEXT_PUBLIC_SITE_URL="https://play.hellokhata.com"

# Sponsor target URL (campaign UTM parameters are appended automatically)
NEXT_PUBLIC_HELLOKHATA_URL="https://hellokhata.com"
```

## 2. Database Migration & Seeding
```bash
# Push or apply Prisma migrations to the production PostgreSQL database
npx prisma db push

# Seed the 100 levels, 67 challenge templates, 20 achievements, customizations, and leaderboards
npm run db:seed
```

## 3. Production Build & Verification
```bash
# 1. Export static content pack
npm run content:build

# 2. Run typecheck, unit tests, and integration tests
npm run test:all

# 3. Build standalone Next.js production bundle
npm run build

# 4. Start production server
npm run start
```

## 4. Hosting & CDN Recommendations
- **Domain**: `play.hellokhata.com` over HTTPS (TLS 1.3).
- **Security Headers**: Configured automatically in `next.config.ts` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
- **Database Isolation**: Keep `DATABASE_URL` pointing to a dedicated game PostgreSQL database, completely isolated from HelloKhata's operational ERP database.
