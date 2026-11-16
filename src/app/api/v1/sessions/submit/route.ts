import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveRequestToken, withPlayerCookie } from '@/server/http';
import { checkRateLimit } from '@/server/rate-limit';
import { recordAnalyticsEvent, submitGameSession } from '@/server/service';

const SubmitSchema = z.object({
  sessionId: z.string().min(1).max(80),
  log: z.array(z.array(z.number().int()).min(2).max(10)).max(6000),
  endTick: z.number().int().min(0).max(36000),
  quit: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  const rl = checkRateLimit(`submit:${token}`, 30, 60_000);
  if (!rl.allowed) {
    return withPlayerCookie({ ok: false, error: 'rate_limited' }, token, 429);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withPlayerCookie({ ok: false, error: 'invalid_json' }, token, 400);
  }
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return withPlayerCookie({ ok: false, error: 'validation_error' }, token, 400);
  }

  const outcome = await submitGameSession(token, parsed.data);
  if (!outcome.ok) {
    return withPlayerCookie(outcome, token, 400);
  }

  if (outcome.result) {
    await recordAnalyticsEvent(
      token,
      outcome.result.won ? 'level_completed' : 'level_failed',
      {
        score: outcome.result.score,
        stars: outcome.result.stars,
        reason: outcome.result.reason,
      },
      parsed.data.sessionId,
    );
    if (outcome.result.reason === 'bossDefeated') {
      await recordAnalyticsEvent(token, 'boss_defeated', { score: outcome.result.score }, parsed.data.sessionId);
    }
  }

  return withPlayerCookie(outcome, token);
}
