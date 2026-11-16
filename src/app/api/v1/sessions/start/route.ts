import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveRequestToken, withPlayerCookie } from '@/server/http';
import { checkRateLimit } from '@/server/rate-limit';
import { recordAnalyticsEvent, startGameSession } from '@/server/service';

const StartSchema = z.object({
  mode: z.enum(['story', 'endless', 'time', 'survival', 'daily', 'friend']),
  level: z.number().int().min(1).max(100).optional(),
  secs: z.union([z.literal(60), z.literal(120)]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  code: z.string().min(1).max(16).optional(),
  seed: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  const rl = checkRateLimit(`start:${token}`, 60, 60_000);
  if (!rl.allowed) {
    return withPlayerCookie({ ok: false, error: 'rate_limited' }, token, 429);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withPlayerCookie({ ok: false, error: 'invalid_json' }, token, 400);
  }
  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return withPlayerCookie({ ok: false, error: 'validation_error' }, token, 400);
  }
  const session = await startGameSession(token, parsed.data);
  await recordAnalyticsEvent(
    token,
    parsed.data.mode === 'daily' ? 'daily_challenge_played' : 'level_started',
    { mode: parsed.data.mode, configId: session.config.id },
    session.sessionId,
  );
  return withPlayerCookie({ ok: true, ...session }, token);
}
