/**
 * Product icons: a handful of parametric packaging templates (sack, bottle, packet, box…) coloured
 * and labelled per product. All drawn with the same ink outline as the characters.
 */
import type { IconSpec } from '@/core/types';
import { INK } from './characters';

export const ICON = 128;
const S = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;

function label(text: string | undefined, x: number, y: number, w: number, fill: string, color = '#FFFFFF', size = 22): string {
  if (!text) return '';
  const fs = text.length > 5 ? size - 6 : text.length > 3 ? size - 3 : size;
  return `<rect x="${x - w / 2}" y="${y - 17}" width="${w}" height="32" rx="8" fill="${fill}" stroke="${INK}" stroke-width="3"/>`
    + `<text x="${x}" y="${y + 7}" font-family="'Baloo Da 2','Hind Siliguri',sans-serif" font-weight="700" font-size="${fs}" text-anchor="middle" fill="${color}">${text}</text>`;
}

export function productSvg(i: IconSpec): string {
  let o = '';
  switch (i.t) {
    case 'sack':
      o = `<path d="M30 46 C18 70 16 104 30 116 L98 116 C112 104 110 70 98 46 Z" fill="${i.c1}" ${S}/>`
        + `<path d="M40 46 C44 30 52 22 46 14 L82 14 C76 22 84 30 88 46 Z" fill="${i.c1}" ${S}/><path d="M38 44 L90 44" stroke="${i.c2}" stroke-width="7" stroke-linecap="round"/>`
        + label(i.g, 64, 82, 62, i.c2);
      break;
    case 'bottle':
      o = `<rect x="52" y="8" width="24" height="16" rx="4" fill="${i.c2}" ${S}/><path d="M50 24 L78 24 L80 40 C94 48 96 58 96 70 L96 108 C96 114 92 118 86 118 L42 118 C36 118 32 114 32 108 L32 70 C32 58 34 48 48 40 Z" fill="${i.c1}" ${S}/>`
        + `<path d="M42 62 C42 54 46 50 50 48" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.7" fill="none"/>` + label(i.g, 64, 88, 56, i.c2);
      break;
    case 'packet':
      o = `<path d="M24 22 L32 14 L40 22 L48 14 L56 22 L64 14 L72 22 L80 14 L88 22 L96 14 L104 22 L104 106 L96 114 L88 106 L80 114 L72 106 L64 114 L56 106 L48 114 L40 106 L32 114 L24 106 Z" fill="${i.c1}" ${S}/>`
        + `<circle cx="64" cy="48" r="16" fill="${i.c2}" stroke="${INK}" stroke-width="3"/><circle cx="58" cy="43" r="5" fill="#FFFFFF" opacity="0.6"/>` + label(i.g, 64, 88, 70, i.c2);
      break;
    case 'box':
      o = `<path d="M22 36 L64 22 L106 36 L106 100 L64 114 L22 100 Z" fill="${i.c1}" ${S}/><path d="M22 36 L64 50 L106 36 M64 50 L64 114" fill="none" ${S}/>`
        + `<path d="M30 46 L56 55 L56 70 L30 61 Z" fill="${i.c2}" stroke="${INK}" stroke-width="3"/>` + label(i.g, 64, 92, 60, i.c2);
      break;
    case 'jar':
      o = `<rect x="38" y="12" width="52" height="18" rx="6" fill="${i.c2}" ${S}/><path d="M34 34 L94 34 C102 40 104 48 104 58 L104 104 C104 112 98 116 92 116 L36 116 C30 116 24 112 24 104 L24 58 C24 48 26 40 34 34 Z" fill="${i.c1}" ${S}/>`
        + `<path d="M34 58 C34 50 38 46 42 44" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.7" fill="none"/>` + label(i.g, 64, 82, 66, i.c2);
      break;
    case 'bar':
      o = `<rect x="16" y="42" width="96" height="52" rx="14" fill="${i.c1}" ${S}/><rect x="34" y="54" width="60" height="28" rx="10" fill="${i.c2}" stroke="${INK}" stroke-width="3"/>`
        + `<circle cx="100" cy="30" r="8" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><circle cx="112" cy="18" r="5" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>`;
      break;
    case 'carton':
      o = `<path d="M36 40 L64 14 L92 40 L92 112 L36 112 Z" fill="${i.c1}" ${S}/><path d="M36 40 L92 40 M64 14 L64 40" fill="none" ${S}/><path d="M36 66 L92 66 L92 92 L36 92 Z" fill="${i.c2}" stroke="${INK}" stroke-width="3"/>`
        + label(i.g, 64, 80, 52, i.c2);
      break;
    case 'round':
      o = `<circle cx="64" cy="68" r="44" fill="${i.c1}" ${S}/><path d="M36 54 C42 40 54 34 64 34" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.5" fill="none"/>`
        + `<circle cx="64" cy="68" r="26" fill="none" stroke="${i.c2}" stroke-width="7"/><circle cx="64" cy="68" r="9" fill="${i.c2}" stroke="${INK}" stroke-width="3"/>`;
      break;
    case 'stick':
      o = `<g transform="rotate(35 64 64)"><rect x="50" y="12" width="28" height="104" rx="10" fill="${i.c1}" ${S}/><rect x="50" y="12" width="28" height="26" rx="10" fill="${i.c2}" ${S}/><path d="M58 50 L58 100" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.6"/></g>`;
      break;
    case 'tray':
      o = `<path d="M12 70 L116 70 L106 110 L22 110 Z" fill="${i.c2}" ${S}/>`
        + [32, 64, 96].map((x) => `<ellipse cx="${x}" cy="60" rx="17" ry="22" fill="${i.c1}" ${S}/><path d="M${x - 8} 50 Q${x - 4} 42 ${x + 2} 42" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none"/>`).join('')
        + `<path d="M12 70 L116 70" ${S}/>`;
      break;
    case 'umbrella':
      o = `<path d="M10 66 C14 20 114 20 118 66 Q104 54 91 66 Q78 54 64 66 Q50 54 37 66 Q24 54 10 66 Z" fill="${i.c1}" ${S}/><path d="M64 24 L64 14" ${S}/>`
        + `<path d="M64 66 L64 104 Q64 116 52 114" fill="none" stroke="${i.c2}" stroke-width="7" stroke-linecap="round"/>`;
      break;
    case 'pile':
      o = [[40, 84, 26], [86, 86, 24], [64, 54, 26]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i.c1}" ${S}/><path d="M${x! - 12} ${y! - 8} Q${x! - 6} ${y! - 18} ${x! + 4} ${y! - 18}" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.5" fill="none"/><circle cx="${x! + 8}" cy="${y! + 8}" r="3" fill="${i.c2}"/>`).join('');
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${ICON}" viewBox="0 0 ${ICON} ${ICON}">${o}</svg>`;
}
