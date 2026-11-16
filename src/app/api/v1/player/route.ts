import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveRequestToken, withPlayerCookie } from '@/server/http';
import { getOrCreatePlayer, updatePlayerProfile } from '@/server/service';

const UpdateSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  avatar: z.string().max(40).optional(),
  district: z.string().max(40).nullable().optional(),
  lang: z.enum(['bn', 'en']).optional(),
  musicOn: z.boolean().optional(),
  sfxOn: z.boolean().optional(),
  tutorialsSeen: z.array(z.string().max(50)).max(150).optional(),
});

export async function GET(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  const player = await getOrCreatePlayer(token);
  return withPlayerCookie({ ok: true, token, player }, token);
}

export async function POST(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withPlayerCookie({ ok: false, error: 'invalid_json' }, token, 400);
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return withPlayerCookie({ ok: false, error: 'validation_error' }, token, 400);
  }
  const player = await updatePlayerProfile(token, parsed.data);
  return withPlayerCookie({ ok: true, token, player }, token);
}
