import { NextRequest } from 'next/server';
import { resolveRequestToken, withPlayerCookie } from '@/server/http';
import { getDailyChallengeInfo } from '@/server/service';

export async function GET(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  const date = req.nextUrl.searchParams.get('date') || undefined;
  const info = await getDailyChallengeInfo(token, date);
  return withPlayerCookie({ ok: true, ...info }, token);
}
