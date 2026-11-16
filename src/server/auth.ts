import crypto from 'node:crypto';
import { hashString } from '@/core/rng';
import { DISTRICTS } from '@/content/customization';

export const PLAYER_COOKIE = 'dokaan_player_token';

const SECRET = (): string => process.env.GAME_SECRET || 'dokaan-shamlao-default-dev-secret-2026';

export function generatePlayerToken(): string {
  const raw = crypto.randomBytes(24).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET()).update(raw).digest('base64url').slice(0, 16);
  return `${raw}.${sig}`;
}

export function verifyOrCreateToken(token?: string | null): { token: string; isNew: boolean } {
  if (token && typeof token === 'string' && token.includes('.')) {
    const [raw, sig] = token.split('.');
    if (raw && sig && raw.length >= 16) {
      const expected = crypto.createHmac('sha256', SECRET()).update(raw).digest('base64url').slice(0, 16);
      if (sig === expected) {
        return { token, isNew: false };
      }
    }
  }
  return { token: generatePlayerToken(), isNew: true };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(`${token}:${SECRET()}`).digest('hex');
}

export function generateAccountCode(seedHex: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'HK-';
  for (let i = 0; i < 8; i++) {
    const byte = parseInt(seedHex.slice(i * 2, i * 2 + 2) || '42', 16);
    out += chars[byte % chars.length];
    if (i === 3) out += '-';
  }
  return out;
}

/** Current date in Asia/Dhaka (UTC+6) as YYYY-MM-DD. */
export function dhakaDateString(now: Date = new Date()): string {
  const dhakaMs = now.getTime() + 6 * 60 * 60 * 1000;
  const d = new Date(dhakaMs);
  return d.toISOString().slice(0, 10);
}

/** Previous N dates in Asia/Dhaka (including today or before today). */
export function recentDhakaDates(count: number, fromDateStr?: string): string[] {
  const base = fromDateStr ? new Date(`${fromDateStr}T00:00:00Z`) : new Date(Date.now() + 6 * 3600 * 1000);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime() - i * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** ISO week key in Asia/Dhaka (e.g. "2026-W47") for weekly leaderboards. */
export function dhakaWeekKey(now: Date = new Date()): string {
  const dateStr = dhakaDateString(now);
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Deterministic daily challenge seed derived from the date and server secret. */
export function dailySeedForDate(date: string): number {
  const hmac = crypto.createHmac('sha256', SECRET()).update(`daily:${date}`).digest('hex');
  return hashString(hmac.slice(0, 16)) & 0x7fffffff;
}

const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'sex', 'porn', 'admin', 'moderator'];

/**
 * Display-name moderation:
 * - Strips HTML tags, control chars, emails, and phone numbers (privacy protection!)
 * - Rejects profanity
 * - Enforces length 2..20
 */
export function sanitizeDisplayName(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'দোকানদার';
  let cleaned = raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    // Strip email-like patterns
    .replace(/\S+@\S+\.\S+/g, '')
    // Strip phone numbers (7+ consecutive digits / Bangla digits)
    .replace(/[0-9০-৯+\-\s]{8,}/g, '')
    .trim();

  const lower = cleaned.toLowerCase();
  if (BAD_WORDS.some((w) => lower.includes(w))) {
    return 'দোকানদার';
  }
  if (cleaned.length < 2) return 'দোকানদার';
  if (cleaned.length > 20) cleaned = Array.from(cleaned).slice(0, 20).join('');
  return cleaned;
}

export function sanitizeDistrict(district?: string | null): string | null {
  if (!district) return null;
  return DISTRICTS.some((d) => d.id === district) ? district : null;
}
