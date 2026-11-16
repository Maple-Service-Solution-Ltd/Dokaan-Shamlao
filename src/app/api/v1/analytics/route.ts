import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveRequestToken, withPlayerCookie } from '@/server/http';
import { checkRateLimit } from '@/server/rate-limit';
import { recordAnalyticsEvent } from '@/server/service';

const EventSchema = z.object({
  name: z.string().min(1).max(64),
  props: z.record(z.unknown()).optional(),
  sessionId: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  const rl = checkRateLimit(`analytics:${token}`, 120, 60_000);
  if (!rl.allowed) {
    return withPlayerCookie({ ok: false, error: 'rate_limited' }, token, 429);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withPlayerCookie({ ok: false, error: 'invalid_json' }, token, 400);
  }
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return withPlayerCookie({ ok: false, error: 'validation_error' }, token, 400);
  }
  await recordAnalyticsEvent(token, parsed.data.name, parsed.data.props ?? {}, parsed.data.sessionId);
  return withPlayerCookie({ ok: true }, token);
}
