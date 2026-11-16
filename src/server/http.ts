import { NextRequest, NextResponse } from 'next/server';
import { PLAYER_COOKIE, verifyOrCreateToken } from './auth';

export function resolveRequestToken(req: NextRequest): { token: string; isNew: boolean } {
  const headerToken = req.headers.get('x-player-token');
  const cookieToken = req.cookies.get(PLAYER_COOKIE)?.value;
  return verifyOrCreateToken(headerToken || cookieToken || null);
}

export function withPlayerCookie<T>(data: T, token: string, status = 200): NextResponse<T> {
  const res = NextResponse.json(data, { status });
  res.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
