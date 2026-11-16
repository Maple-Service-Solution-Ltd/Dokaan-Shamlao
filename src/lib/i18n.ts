import type { L10n, Lang } from '@/core/types';
import { bn } from '@/content/i18n/bn';
import { en } from '@/content/i18n/en';
import { PRODUCT_MAP } from '@/content/products';

const DICT: Record<Lang, Record<string, string | string[]>> = { bn, en };
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Convert ASCII digits to Bangla numerals when the language is Bangla. */
export function digits(s: string | number, lang: Lang): string {
  const str = String(s);
  return lang === 'bn' ? str.replace(/\d/g, (d) => BN_DIGITS[Number(d)]!) : str;
}

/** Grouped number (Bangladeshi style digit grouping is approximated with en-IN). */
export function num(n: number, lang: Lang): string {
  const sign = n < 0 ? '−' : '';
  return sign + digits(Math.abs(Math.round(n)).toLocaleString('en-IN'), lang);
}

export function taka(n: number, lang: Lang): string {
  return `${n < 0 ? '−' : ''}৳${digits(Math.abs(Math.round(n)).toLocaleString('en-IN'), lang)}`;
}

export function pick(l: L10n, lang: Lang): string {
  return l[lang] || l.bn;
}

export function productName(id: string, lang: Lang): string {
  const p = PRODUCT_MAP[id];
  return p ? p[lang] : id;
}

function lookup(key: string, lang: Lang): string | string[] | undefined {
  const d = DICT[lang];
  if (d[key] !== undefined) return d[key];
  // Fallback: "say.greet.vip" → "say.greet.default"
  const i = key.lastIndexOf('.');
  if (i > 0) return d[`${key.slice(0, i)}.default`];
  return undefined;
}

export function hasKey(key: string, lang: Lang = 'bn'): boolean {
  return lookup(key, lang) !== undefined;
}

/** Resolve "#productId" and "@i18n.key" tokens inside free text (used for decision table cells). */
export function tokens(text: string | number, lang: Lang): string {
  if (typeof text === 'number') return num(text, lang);
  const out = text
    .replace(/#([a-z]+)/g, (_, id: string) => productName(id, lang))
    .replace(/@([\w.:]+)/g, (_, key: string) => t(key, lang));
  return digits(out, lang);
}

/**
 * Translate a key. `params` values that start with '#' are product ids.
 * `variant` picks one entry when the translation is a list of alternatives.
 */
export function t(key: string, lang: Lang, params?: Record<string, string | number>, variant = 0): string {
  const raw = lookup(key, lang);
  if (raw === undefined) return key;
  let s = Array.isArray(raw) ? raw[Math.abs(variant) % raw.length]! : raw;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (m, name: string) => {
      const v = params[name];
      if (v === undefined) return m;
      if (typeof v === 'string') return v.startsWith('#') ? productName(v.slice(1), lang) : v;
      return Math.abs(v).toLocaleString('en-IN').replace(/^/, v < 0 ? '−' : '');
    });
  }
  return digits(s, lang);
}

export const ALL_KEYS = { bn: Object.keys(bn), en: Object.keys(en) };
