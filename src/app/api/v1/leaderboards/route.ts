import { NextRequest } from 'next/server';
import { resolveRequestToken, withPlayerCookie } from '@/server/http';
import { getLeaderboard } from '@/server/service';

export async function GET(req: NextRequest) {
  const { token } = resolveRequestToken(req);
  const sp = req.nextUrl.searchParams;
  const scopeRaw = sp.get('scope') || 'daily';
  const scope = (['daily', 'weekly', 'alltime', 'friends'].includes(scopeRaw) ? scopeRaw : 'daily') as
    | 'daily'
    | 'weekly'
    | 'alltime'
    | 'friends';
  const board = sp.get('board') || 'endless';
  const date = sp.get('date') || undefined;
  const code = sp.get('code') || undefined;
  const district = sp.get('district') || null;
  const limit = Number(sp.get('limit') || '20');

  const data = await getLeaderboard({ scope, board, date, code, district, limit });
  return withPlayerCookie({ ok: true, ...data }, token);
}
