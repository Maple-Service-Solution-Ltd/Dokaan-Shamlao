import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveRequestToken, withPlayerCookie } from '@/server/http';
import { customizeShop } from '@/server/service';

const CustomizeSchema = z.object({
  itemId: z.string().min(1).max(60),
});

export async function POST(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withPlayerCookie({ ok: false, error: 'invalid_json' }, token, 400);
  }
  const parsed = CustomizeSchema.safeParse(body);
  if (!parsed.success) {
    return withPlayerCookie({ ok: false, error: 'validation_error' }, token, 400);
  }
  const res = await customizeShop(token, parsed.data.itemId);
  if (!res.ok) {
    return withPlayerCookie(res, token, 400);
  }
  return withPlayerCookie(res, token);
}
