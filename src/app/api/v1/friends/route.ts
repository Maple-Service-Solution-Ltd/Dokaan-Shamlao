import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveRequestToken, withPlayerCookie } from '@/server/http';
import { checkRateLimit } from '@/server/rate-limit';
import { createFriendChallenge, getFriendChallenge, recordAnalyticsEvent } from '@/server/service';

const CreateFriendSchema = z.object({
  creatorScore: z.number().int().min(0).max(1_000_000).optional(),
});

export async function GET(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  const code = req.nextUrl.searchParams.get('code') || 'FRIEND';
  const challenge = await getFriendChallenge(code);
  if (!challenge) {
    return withPlayerCookie({ ok: false, error: 'not_found_or_expired' }, token, 404);
  }
  return withPlayerCookie({ ok: true, challenge }, token);
}

export async function POST(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  const rl = checkRateLimit(`friend:${token}`, 20, 60_000);
  if (!rl.allowed) {
    return withPlayerCookie({ ok: false, error: 'rate_limited' }, token, 429);
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = CreateFriendSchema.safeParse(body);
  if (!parsed.success) {
    return withPlayerCookie({ ok: false, error: 'validation_error' }, token, 400);
  }
  const challenge = await createFriendChallenge(token, parsed.data);
  await recordAnalyticsEvent(token, 'friend_challenge_created', { code: challenge.code });
  return withPlayerCookie({ ok: true, challenge }, token);
}
