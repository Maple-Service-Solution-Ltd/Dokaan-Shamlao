/**
 * Shop visual assets, Bangladeshi Taka banknote SVG generator (with counterfeit tells),
 * hotspot icons, and SVG-to-Data-URI helpers shared by Phaser 3 and React UI components.
 */
import type { HotspotKind, IconSpec } from '@/core/types';
import { CHARACTERS, CHAR_H, CHAR_W, FACE_ANCHOR, FACE_H, FACE_W, INK, NO_FACE, characterSvg, faceSvg, shopkeeperSpec, type CharSpec, type Expression } from './characters';
import { productSvg } from './products';

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Combines a character body and facial expression into a single composite SVG. */
export function fullCharacterSvg(lookOrSpec: string | CharSpec, expr: Expression = 'neutral'): string {
  const spec: CharSpec = typeof lookOrSpec === 'string' ? (CHARACTERS[lookOrSpec] ?? CHARACTERS.bhai!) : lookOrSpec;
  const body = characterSvg(spec);
  const noFace = typeof lookOrSpec === 'string' && NO_FACE.has(lookOrSpec);
  if (noFace || spec.custom) return body;

  const faceInner = faceSvg(expr)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  const fx = FACE_ANCHOR.x - FACE_W / 2;
  const fy = FACE_ANCHOR.y - FACE_H / 2;
  const overlay = `<g transform="translate(${fx}, ${fy})">${faceInner}</g>`;
  return body.replace(/<\/svg>$/, `${overlay}</svg>`);
}

const charUrlCache = new Map<string, string>();
export function characterDataUrl(look: string, expr: Expression = 'neutral'): string {
  const key = `${look}:${expr}`;
  let url = charUrlCache.get(key);
  if (!url) {
    url = svgToDataUrl(fullCharacterSvg(look, expr));
    charUrlCache.set(key, url);
  }
  return url;
}

export function shopkeeperDataUrl(outfit: string, expr: Expression = 'neutral'): string {
  const key = `sk:${outfit}:${expr}`;
  let url = charUrlCache.get(key);
  if (!url) {
    url = svgToDataUrl(fullCharacterSvg(shopkeeperSpec(outfit), expr));
    charUrlCache.set(key, url);
  }
  return url;
}

const prodUrlCache = new Map<string, string>();
export function productDataUrl(id: string, icon: IconSpec): string {
  let url = prodUrlCache.get(id);
  if (!url) {
    url = svgToDataUrl(productSvg(icon));
    prodUrlCache.set(id, url);
  }
  return url;
}

const NOTE_PALETTE: Record<number, { bg: string; border: string; accent: string; bn: string }> = {
  5: { bg: '#FDE8D7', border: '#B5532B', accent: '#E07A5F', bn: '৫' },
  10: { bg: '#FCE4EC', border: '#AD1457', accent: '#EC407A', bn: '১০' },
  20: { bg: '#E8F5E9', border: '#2E7D32', accent: '#66BB6A', bn: '২০' },
  50: { bg: '#FFF3E0', border: '#E65100', accent: '#FFA726', bn: '৫০' },
  100: { bg: '#E3F2FD', border: '#1565C0', accent: '#42A5F5', bn: '১০০' },
  500: { bg: '#F3E5F5', border: '#6A1B9A', accent: '#AB47BC', bn: '৫০০' },
  1000: { bg: '#EDE7F6', border: '#4527A0', accent: '#7E57C2', bn: '১০০০' },
};

/**
 * Generates an SVG illustration of a fictional Bangladeshi Taka banknote.
 * When `fake` is true, `fakeTell` (0..2) introduces a clear visual defect:
 * - 0: Missing watermark circle
 * - 1: Strange sickly green/grey colour tint
 * - 2: Missing metallic security thread
 */
export function noteSvg(denom: number, fake = false, fakeTell = 0): string {
  const base = NOTE_PALETTE[denom] ?? { bg: '#E8F5E9', border: '#2E7D32', accent: '#66BB6A', bn: String(denom) };
  const bg = fake && fakeTell === 1 ? '#D7E3B8' : base.bg;
  const border = fake && fakeTell === 1 ? '#556B2F' : base.border;
  const hasWatermark = !(fake && fakeTell === 0);
  const hasThread = !(fake && fakeTell === 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="84" viewBox="0 0 180 84">
    <rect x="3" y="3" width="174" height="78" rx="10" fill="${bg}" stroke="${INK}" stroke-width="3.5"/>
    <rect x="9" y="9" width="162" height="66" rx="6" fill="none" stroke="${border}" stroke-width="2.5" stroke-dasharray="6 3"/>
    ${hasThread ? `<line x1="62" y1="5" x2="62" y2="79" stroke="#90A4AE" stroke-width="3.5" stroke-dasharray="5 3"/>` : ''}
    ${hasWatermark ? `<circle cx="136" cy="42" r="18" fill="#FFFFFF" fill-opacity="0.7" stroke="${border}" stroke-width="1.8" stroke-dasharray="3 2"/><path d="M136 30 L141 42 L136 54 L131 42 Z" fill="${ base.accent }" opacity="0.45"/>` : `<circle cx="136" cy="42" r="18" fill="none" stroke="#BDBDBD" stroke-width="1.5" stroke-dasharray="2 4"/>`}
    <rect x="16" y="16" width="38" height="24" rx="5" fill="${border}"/>
    <text x="35" y="34" font-family="'Baloo Da 2','Hind Siliguri',sans-serif" font-weight="800" font-size="16" text-anchor="middle" fill="#FFFFFF">৳${base.bn}</text>
    <text x="95" y="52" font-family="'Baloo Da 2','Hind Siliguri',sans-serif" font-weight="800" font-size="26" text-anchor="middle" fill="${border}">৳${base.bn}</text>
    <text x="35" y="64" font-family="'Baloo Da 2','Hind Siliguri',sans-serif" font-weight="700" font-size="11" text-anchor="middle" fill="${INK}">${denom} TK</text>
  </svg>`;
}

export function hotspotBadgeInfo(kind: HotspotKind, seq?: number, taps?: number): { emoji: string; labelBn: string; labelEn: string; color: string } {
  switch (kind) {
    case 'box':
      return { emoji: '📦', labelBn: 'বাক্স খুলুন', labelEn: 'Unpack Box', color: '#D97706' };
    case 'leak':
      return { emoji: '💧', labelBn: `লিক (${taps ?? 1})`, labelEn: `Leak (${taps ?? 1})`, color: '#0284C7' };
    case 'thief':
      return { emoji: '🦹', labelBn: 'চোর ধরুন!', labelEn: 'Catch Thief!', color: '#DC2626' };
    case 'expiry':
      return { emoji: '⏰', labelBn: 'ছাড়ে দিন', labelEn: 'Clearance', color: '#EA580C' };
    case 'damaged':
      return { emoji: '🩹', labelBn: 'নষ্ট সরান', labelEn: 'Remove Bad', color: '#E11D48' };
    case 'flood':
      return { emoji: '⬆️', labelBn: 'উপরে তুলুন', labelEn: 'Lift High', color: '#2563EB' };
    case 'search':
      return { emoji: '🔍', labelBn: 'গুদাম খুঁজুন', labelEn: 'Search Store', color: '#7C3AED' };
    case 'fire': {
      const nums = ['①', '②', '③'];
      const namesBn = ['মেইন সুইচ', 'নির্বাপক', 'জানালা'];
      const namesEn = ['Main Switch', 'Extinguisher', 'Window'];
      const idx = Math.max(0, Math.min(2, seq ?? 0));
      return { emoji: `🔥${nums[idx]}`, labelBn: `${nums[idx]} ${namesBn[idx]}`, labelEn: `${nums[idx]} ${namesEn[idx]}`, color: '#DC2626' };
    }
    case 'light':
      return { emoji: '🔦', labelBn: 'লাইট (৳৫০)', labelEn: 'Light (৳50)', color: '#EAB308' };
    case 'changeRun':
      return { emoji: '🪙', labelBn: 'ভাঙতি আনুন', labelEn: 'Get Change', color: '#0D9488' };
  }
}

export { CHAR_W, CHAR_H };
