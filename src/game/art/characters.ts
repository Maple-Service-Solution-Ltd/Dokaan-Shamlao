/**
 * Original, procedurally drawn cartoon characters (SVG).
 * One parametric builder gives every character the same proportions, outline weight and palette,
 * so the cast reads as one consistent art style. Faces (expressions) are separate overlays shared
 * by all characters, which is what makes reactions cheap to animate.
 */
export const INK = '#3B2314';
export const CHAR_W = 220;
export const CHAR_H = 290;
/** Where the face overlay is centred on the body texture. */
export const FACE_ANCHOR = { x: 110, y: 118 };
export const FACE_W = 130;
export const FACE_H = 100;

type Hair = 'short' | 'side' | 'bald' | 'bun' | 'long' | 'spiky' | 'pigtails' | 'curly' | 'none';
type Top = 'shirt' | 'panjabi' | 'saree' | 'kameez' | 'tshirt' | 'uniform' | 'suit' | 'ganji' | 'stripes' | 'apron';
type Extra =
  | 'glasses' | 'tupi' | 'orna' | 'hijab' | 'beard' | 'whitebeard' | 'mustache' | 'bigmustache' | 'sunglasses' | 'crown'
  | 'cap' | 'gamcha' | 'tie' | 'earrings' | 'chain' | 'bag' | 'mask' | 'kid' | 'sweat' | 'cane' | 'child' | 'pen' | 'necklace' | 'sack';

export interface CharSpec {
  skin: string;
  hair: Hair;
  hairColor: string;
  top: Top;
  c1: string;
  c2: string;
  extras?: Extra[];
  /** Children have bigger heads and narrower shoulders. */
  kid?: boolean;
  /** Wider body (bosses, bulk buyer). */
  wide?: boolean;
  /** Fully custom drawing (non-human bosses). */
  custom?: 'storm' | 'ghost';
}

const S = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, '0')}`;
};

function body(s: CharSpec): string {
  const w = s.wide ? 100 : s.kid ? 62 : 82;
  const top = s.kid ? 200 : 188;
  const L = 110 - w;
  const R = 110 + w;
  const base = `M${L - 6} 292 C${L - 8} ${top + 40} ${L + 6} ${top + 6} ${110 - 30} ${top} L${110 + 30} ${top} C${R - 6} ${top + 6} ${R + 8} ${top + 40} ${R + 6} 292 Z`;
  let o = `<path d="${base}" fill="${s.c1}" ${S}/>`;
  const dark = shade(s.c1, 0.82);
  switch (s.top) {
    case 'shirt':
      o += `<path d="M110 ${top + 2} L110 292" stroke="${INK}" stroke-width="3"/><path d="M${110 - 30} ${top} L110 ${top + 30} L${110 + 30} ${top}" fill="${s.c2}" ${S}/>`;
      o += `<circle cx="110" cy="${top + 52}" r="4" fill="${INK}"/><circle cx="110" cy="${top + 78}" r="4" fill="${INK}"/>`;
      break;
    case 'panjabi':
      o += `<path d="M${110 - 26} ${top} Q110 ${top + 26} ${110 + 26} ${top}" fill="none" ${S}/><path d="M110 ${top + 14} L110 ${top + 70}" stroke="${INK}" stroke-width="3"/>`;
      o += `<circle cx="110" cy="${top + 30}" r="3.5" fill="${s.c2}" stroke="${INK}" stroke-width="2"/><circle cx="110" cy="${top + 48}" r="3.5" fill="${s.c2}" stroke="${INK}" stroke-width="2"/>`;
      break;
    case 'saree':
      o += `<path d="M${L - 4} 292 C${L + 10} ${top + 40} ${110 + 10} ${top + 20} ${110 + 34} ${top} L${R - 8} ${top + 12} C${R + 6} ${top + 50} ${R + 6} 260 ${R + 6} 292 Z" fill="${s.c2}" ${S}/>`;
      o += `<path d="M${L + 2} 270 C${L + 30} ${top + 60} ${110 + 6} ${top + 34} ${110 + 26} ${top + 8}" fill="none" stroke="${shade(s.c2, 0.75)}" stroke-width="6"/>`;
      break;
    case 'kameez':
      o += `<path d="M${110 - 24} ${top} Q110 ${top + 34} ${110 + 24} ${top}" fill="${s.skin}" ${S}/><path d="M${L + 14} ${top + 30} Q110 ${top + 70} ${R - 14} ${top + 30}" fill="none" stroke="${s.c2}" stroke-width="10" stroke-linecap="round"/>`;
      break;
    case 'tshirt':
      o += `<path d="M${110 - 24} ${top} Q110 ${top + 22} ${110 + 24} ${top}" fill="${s.skin}" ${S}/><rect x="84" y="${top + 38}" width="52" height="30" rx="8" fill="${s.c2}" stroke="${INK}" stroke-width="3"/>`;
      break;
    case 'uniform':
      o += `<path d="M${110 - 28} ${top} L110 ${top + 26} L${110 + 28} ${top}" fill="#FFFFFF" ${S}/><path d="M110 ${top + 26} L98 ${top + 70} L110 ${top + 84} L122 ${top + 70} Z" fill="${s.c2}" stroke="${INK}" stroke-width="3"/>`;
      break;
    case 'suit':
      o += `<path d="M${110 - 30} ${top} L110 ${top + 60} L${110 + 30} ${top}" fill="#FFFFFF" ${S}/><path d="M${110 - 30} ${top} L${110 - 46} ${top + 44} L110 ${top + 60} Z" fill="${dark}" ${S}/><path d="M${110 + 30} ${top} L${110 + 46} ${top + 44} L110 ${top + 60} Z" fill="${dark}" ${S}/>`;
      break;
    case 'ganji':
      o += `<path d="M${110 - 34} ${top + 2} Q110 ${top + 44} ${110 + 34} ${top + 2}" fill="${s.skin}" ${S}/>`;
      break;
    case 'stripes':
      for (let y = top + 22; y < 290; y += 26) o += `<path d="M${L + 2} ${y} L${R - 2} ${y}" stroke="${s.c2}" stroke-width="11"/>`;
      o += `<path d="${base}" fill="none" ${S}/>`;
      break;
    case 'apron':
      o += `<path d="M${110 - 28} ${top} L110 ${top + 24} L${110 + 28} ${top}" fill="${shade(s.c1, 1.15)}" ${S}/>`;
      o += `<path d="M${110 - 46} 292 L${110 - 40} ${top + 44} L${110 + 40} ${top + 44} L${110 + 46} 292 Z" fill="${s.c2}" ${S}/><path d="M${110 - 40} ${top + 44} L${110 - 22} ${top + 6} M${110 + 40} ${top + 44} L${110 + 22} ${top + 6}" stroke="${INK}" stroke-width="4" fill="none"/>`;
      o += `<rect x="92" y="${top + 62}" width="36" height="22" rx="5" fill="${shade(s.c2, 0.85)}" stroke="${INK}" stroke-width="3"/>`;
      break;
  }
  return o;
}

function head(s: CharSpec): string {
  const ry = s.kid ? 62 : 66;
  const rx = s.kid ? 62 : 58;
  const cy = FACE_ANCHOR.y - 6;
  const neckTop = cy + ry - 16;
  let o = `<rect x="${110 - 20}" y="${neckTop}" width="40" height="44" rx="14" fill="${shade(s.skin, 0.9)}" ${S}/>`;
  o += `<ellipse cx="${110 - rx + 2}" cy="${cy + 6}" rx="11" ry="15" fill="${s.skin}" ${S}/><ellipse cx="${110 + rx - 2}" cy="${cy + 6}" rx="11" ry="15" fill="${s.skin}" ${S}/>`;
  o += `<ellipse cx="110" cy="${cy}" rx="${rx}" ry="${ry}" fill="${s.skin}" ${S}/>`;
  o += `<ellipse cx="${110 - 32}" cy="${cy + 26}" rx="12" ry="8" fill="#E8735A" opacity="0.28"/><ellipse cx="${110 + 32}" cy="${cy + 26}" rx="12" ry="8" fill="#E8735A" opacity="0.28"/>`;
  return o;
}

function hair(s: CharSpec): string {
  const c = s.hairColor;
  const cy = FACE_ANCHOR.y - 6;
  const rx = s.kid ? 62 : 58;
  const t = cy - (s.kid ? 62 : 66);
  switch (s.hair) {
    case 'short': return `<path d="M${110 - rx - 2} ${cy - 8} C${110 - rx - 6} ${t - 14} ${110 + rx + 6} ${t - 14} ${110 + rx + 2} ${cy - 8} C${110 + rx - 14} ${t + 26} ${110 - rx + 14} ${t + 26} ${110 - rx - 2} ${cy - 8} Z" fill="${c}" ${S}/>`;
    case 'side': return `<path d="M${110 - rx - 2} ${cy - 2} C${110 - rx - 8} ${t - 16} ${110 + rx + 8} ${t - 18} ${110 + rx + 2} ${cy - 6} C${110 + rx - 6} ${t + 16} ${110 + 10} ${t + 14} ${110 - 6} ${t + 34} C${110 - 26} ${t + 22} ${110 - rx + 6} ${t + 30} ${110 - rx - 2} ${cy - 2} Z" fill="${c}" ${S}/>`;
    case 'bald': return `<path d="M${110 - rx} ${cy - 2} C${110 - rx - 6} ${cy - 30} ${110 - rx + 8} ${cy - 36} ${110 - rx + 12} ${cy - 22} M${110 + rx} ${cy - 2} C${110 + rx + 6} ${cy - 30} ${110 + rx - 8} ${cy - 36} ${110 + rx - 12} ${cy - 22}" fill="${c}" ${S}/>`;
    case 'bun': return `<circle cx="110" cy="${t - 8}" r="24" fill="${c}" ${S}/><path d="M${110 - rx - 2} ${cy - 4} C${110 - rx - 4} ${t - 12} ${110 + rx + 4} ${t - 12} ${110 + rx + 2} ${cy - 4} C${110 + rx - 20} ${t + 20} ${110} ${t + 14} ${110} ${t + 22} C${110} ${t + 14} ${110 - rx + 20} ${t + 20} ${110 - rx - 2} ${cy - 4} Z" fill="${c}" ${S}/>`;
    case 'long': return `<path d="M${110 - rx - 10} ${cy + 80} C${110 - rx - 22} ${t - 30} ${110 + rx + 22} ${t - 30} ${110 + rx + 10} ${cy + 80} L${110 + rx - 6} ${cy + 70} C${110 + rx + 2} ${t + 30} ${110 + 6} ${t + 16} 110 ${t + 26} C${110 - 6} ${t + 16} ${110 - rx - 2} ${t + 30} ${110 - rx + 6} ${cy + 70} Z" fill="${c}" ${S}/>`;
    case 'spiky': return `<path d="M${110 - rx - 2} ${cy - 6} L${110 - rx + 4} ${t - 6} L${110 - 30} ${t + 12} L${110 - 22} ${t - 22} L${110 - 2} ${t + 6} L${110 + 14} ${t - 24} L${110 + 28} ${t + 8} L${110 + rx - 6} ${t - 8} L${110 + rx + 2} ${cy - 6} C${110 + rx - 16} ${t + 30} ${110 - rx + 16} ${t + 30} ${110 - rx - 2} ${cy - 6} Z" fill="${c}" ${S}/>`;
    case 'pigtails': return `<ellipse cx="${110 - rx - 14}" cy="${cy + 10}" rx="17" ry="30" fill="${c}" ${S}/><ellipse cx="${110 + rx + 14}" cy="${cy + 10}" rx="17" ry="30" fill="${c}" ${S}/><circle cx="${110 - rx - 6}" cy="${cy - 20}" r="9" fill="#E63946" ${S}/><circle cx="${110 + rx + 6}" cy="${cy - 20}" r="9" fill="#E63946" ${S}/><path d="M${110 - rx - 2} ${cy - 6} C${110 - rx - 6} ${t - 14} ${110 + rx + 6} ${t - 14} ${110 + rx + 2} ${cy - 6} C${110 + rx - 20} ${t + 26} 110 ${t + 10} 110 ${t + 28} C110 ${t + 10} ${110 - rx + 20} ${t + 26} ${110 - rx - 2} ${cy - 6} Z" fill="${c}" ${S}/>`;
    case 'curly': {
      let o = '';
      for (let i = 0; i < 7; i++) { const a = Math.PI * (1 + i / 6); o += `<circle cx="${(110 + Math.cos(a) * (rx - 2)).toFixed(1)}" cy="${(cy - 8 + Math.sin(a) * 58).toFixed(1)}" r="21" fill="${c}" ${S}/>`; }
      return o;
    }
    default: return '';
  }
}

function extras(s: CharSpec, layer: 'back' | 'front'): string {
  const ex = s.extras ?? [];
  const cy = FACE_ANCHOR.y - 6;
  const rx = s.kid ? 62 : 58;
  const t = cy - (s.kid ? 62 : 66);
  let o = '';
  const has = (e: Extra): boolean => ex.includes(e);
  if (layer === 'back') {
    if (has('orna')) o += `<path d="M${110 - rx - 20} ${cy + 96} C${110 - rx - 34} ${t - 34} ${110 + rx + 34} ${t - 34} ${110 + rx + 20} ${cy + 96} Z" fill="${s.c2}" ${S}/>`;
    if (has('sack')) o += `<path d="M168 150 C214 140 226 220 204 262 C190 284 150 280 150 250 Z" fill="#B08D57" ${S}/><path d="M176 152 L186 138 L196 152" fill="#8D6E3F" ${S}/>`;
    return o;
  }
  if (has('hijab')) {
    o += `<path d="M${110 - rx - 12} ${cy + 86} C${110 - rx - 30} ${t - 30} ${110 + rx + 30} ${t - 30} ${110 + rx + 12} ${cy + 86} C${110 + 40} ${cy + 110} ${110 - 40} ${cy + 110} ${110 - rx - 12} ${cy + 86} Z M${110 - rx + 10} ${cy + 4} C${110 - rx + 10} ${cy + 64} ${110 + rx - 10} ${cy + 64} ${110 + rx - 10} ${cy + 4} C${110 + rx - 12} ${t + 22} ${110 - rx + 12} ${t + 22} ${110 - rx + 10} ${cy + 4} Z" fill="${s.c2}" fill-rule="evenodd" ${S}/>`;
  }
  if (has('orna')) o += `<path d="M${110 - rx - 4} ${cy - 4} C${110 - rx - 6} ${t - 16} ${110 + rx + 6} ${t - 16} ${110 + rx + 4} ${cy - 4} C${110 + rx - 14} ${t + 18} ${110 - rx + 14} ${t + 18} ${110 - rx - 4} ${cy - 4} Z" fill="${s.c2}" ${S}/>`;
  if (has('tupi')) o += `<path d="M${110 - rx + 8} ${t + 22} C${110 - rx + 10} ${t - 20} ${110 + rx - 10} ${t - 20} ${110 + rx - 8} ${t + 22} Z" fill="#FFFFFF" ${S}/><path d="M${110 - rx + 12} ${t + 12} L${110 + rx - 12} ${t + 12}" stroke="#CFCFCF" stroke-width="3"/>`;
  if (has('cap')) o += `<path d="M${110 - rx + 2} ${t + 26} C${110 - rx + 4} ${t - 22} ${110 + rx - 4} ${t - 22} ${110 + rx - 2} ${t + 26} Z" fill="${s.c2}" ${S}/><path d="M${110 - 6} ${t + 26} L${110 + rx + 30} ${t + 30} L${110 + rx - 2} ${t + 14} Z" fill="${shade(s.c2, 0.8)}" ${S}/>`;
  if (has('crown')) o += `<path d="M${110 - 50} ${t + 16} L${110 - 58} ${t - 40} L${110 - 28} ${t - 12} L110 ${t - 52} L${110 + 28} ${t - 12} L${110 + 58} ${t - 40} L${110 + 50} ${t + 16} Z" fill="#F6C445" ${S}/><circle cx="110" cy="${t - 6}" r="8" fill="#E63946" stroke="${INK}" stroke-width="3"/><circle cx="${110 - 34}" cy="${t + 2}" r="5" fill="#2A9D8F" stroke="${INK}" stroke-width="2"/><circle cx="${110 + 34}" cy="${t + 2}" r="5" fill="#2A9D8F" stroke="${INK}" stroke-width="2"/>`;
  if (has('whitebeard')) o += `<path d="M${110 - rx + 6} ${cy + 16} C${110 - rx + 4} ${cy + 96} ${110 + rx - 4} ${cy + 96} ${110 + rx - 6} ${cy + 16} C${110 + 30} ${cy + 50} ${110 - 30} ${cy + 50} ${110 - rx + 6} ${cy + 16} Z" fill="#F4F4F4" ${S}/>`;
  if (has('beard')) o += `<path d="M${110 - rx + 6} ${cy + 14} C${110 - rx + 6} ${cy + 84} ${110 + rx - 6} ${cy + 84} ${110 + rx - 6} ${cy + 14} C${110 + 30} ${cy + 52} ${110 - 30} ${cy + 52} ${110 - rx + 6} ${cy + 14} Z" fill="${s.hairColor}" ${S}/>`;
  if (has('mustache')) o += `<path d="M${110 - 30} ${cy + 34} Q110 ${cy + 16} ${110 + 30} ${cy + 34} Q110 ${cy + 30} ${110 - 30} ${cy + 34} Z" fill="${s.hairColor}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  if (has('bigmustache')) o += `<path d="M${110 - 46} ${cy + 40} C${110 - 30} ${cy + 10} ${110 - 6} ${cy + 22} 110 ${cy + 28} C${110 + 6} ${cy + 22} ${110 + 30} ${cy + 10} ${110 + 46} ${cy + 40} C${110 + 24} ${cy + 36} ${110 + 10} ${cy + 38} 110 ${cy + 34} C${110 - 10} ${cy + 38} ${110 - 24} ${cy + 36} ${110 - 46} ${cy + 40} Z" fill="${s.hairColor}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  if (has('glasses')) o += `<circle cx="${110 - 26}" cy="${cy + 2}" r="19" fill="#FFFFFF" fill-opacity="0.35" stroke="${INK}" stroke-width="4"/><circle cx="${110 + 26}" cy="${cy + 2}" r="19" fill="#FFFFFF" fill-opacity="0.35" stroke="${INK}" stroke-width="4"/><path d="M${110 - 7} ${cy + 2} L${110 + 7} ${cy + 2}" stroke="${INK}" stroke-width="4"/>`;
  if (has('sunglasses')) o += `<path d="M${110 - 50} ${cy - 10} L${110 - 6} ${cy - 10} L${110 - 10} ${cy + 16} Q${110 - 28} ${cy + 24} ${110 - 46} ${cy + 16} Z M${110 + 50} ${cy - 10} L${110 + 6} ${cy - 10} L${110 + 10} ${cy + 16} Q${110 + 28} ${cy + 24} ${110 + 46} ${cy + 16} Z" fill="#1B1B1B" ${S}/><path d="M${110 - 6} ${cy - 6} L${110 + 6} ${cy - 6}" stroke="${INK}" stroke-width="5"/>`;
  if (has('mask')) o += `<path d="M${110 - rx + 2} ${cy - 16} L${110 + rx - 2} ${cy - 16} L${110 + rx - 2} ${cy + 16} L${110 - rx + 2} ${cy + 16} Z" fill="#1B1B1B" ${S}/><ellipse cx="${110 - 24}" cy="${cy}" rx="15" ry="10" fill="${s.skin}" stroke="${INK}" stroke-width="3"/><ellipse cx="${110 + 24}" cy="${cy}" rx="15" ry="10" fill="${s.skin}" stroke="${INK}" stroke-width="3"/>`;
  if (has('earrings')) o += `<circle cx="${110 - rx}" cy="${cy + 26}" r="6" fill="#F6C445" stroke="${INK}" stroke-width="3"/><circle cx="${110 + rx}" cy="${cy + 26}" r="6" fill="#F6C445" stroke="${INK}" stroke-width="3"/>`;
  if (has('gamcha')) o += `<path d="M36 214 C70 196 96 200 110 222 L96 286 L40 290 Z" fill="#E63946" ${S}/><path d="M48 226 L98 232 M44 252 L96 258 M42 276 L94 280" stroke="#FFFFFF" stroke-width="4"/>`;
  if (has('tie')) o += `<path d="M110 212 L100 228 L110 276 L120 228 Z" fill="${s.c2}" ${S}/>`;
  if (has('chain')) o += `<path d="M78 204 Q110 262 142 204" fill="none" stroke="#F6C445" stroke-width="8"/><circle cx="110" cy="240" r="11" fill="#F6C445" stroke="${INK}" stroke-width="3"/>`;
  if (has('necklace')) o += `<path d="M84 206 Q110 236 136 206" fill="none" stroke="#F6C445" stroke-width="5"/>`;
  if (has('bag')) o += `<rect x="150" y="226" width="56" height="60" rx="8" fill="#F4A261" ${S}/><path d="M162 226 Q178 200 194 226" fill="none" ${S}/>`;
  if (has('pen')) o += `<path d="M152 100 L170 82" stroke="#1565C0" stroke-width="7" stroke-linecap="round"/>`;
  if (has('sweat')) o += `<path d="M178 70 Q186 86 178 92 Q170 86 178 70 Z" fill="#7FD3F7" stroke="${INK}" stroke-width="3"/>`;
  if (has('cane')) o += `<path d="M188 290 L188 190 Q188 170 172 172" fill="none" stroke="#8D6E3F" stroke-width="9" stroke-linecap="round"/>`;
  if (has('child')) {
    o += `<circle cx="44" cy="232" r="34" fill="${shade(s.skin, 1.05)}" ${S}/><path d="M12 226 C10 190 78 190 76 226 C62 208 26 208 12 226 Z" fill="${s.hairColor}" ${S}/>`;
    o += `<circle cx="33" cy="234" r="4.5" fill="${INK}"/><circle cx="55" cy="234" r="4.5" fill="${INK}"/><path d="M34 248 Q44 258 54 248" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  }
  return o;
}

function stormSvg(): string {
  let o = '';
  const clouds: [number, number, number][] = [[70, 90, 44], [118, 70, 54], [160, 96, 42], [96, 122, 46], [140, 126, 44]];
  for (const [x, y, r] of clouds) o += `<circle cx="${x}" cy="${y}" r="${r}" fill="#5C6B8A" ${S}/>`;
  for (const [x, y, r] of clouds) o += `<circle cx="${x}" cy="${y}" r="${r - 4}" fill="#6F80A3"/>`;
  o += `<path d="M60 160 L160 160 L132 200 L150 200 L104 284 L116 226 L92 226 Z" fill="#8E9DBF" ${S}/>`;
  o += `<path d="M150 164 L132 204 L158 200 L140 250" fill="none" stroke="#F6C445" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>`;
  o += `<path d="M72 84 L104 96 M164 84 L132 96" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><circle cx="92" cy="108" r="10" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/><circle cx="144" cy="108" r="10" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/><circle cx="94" cy="109" r="4" fill="${INK}"/><circle cx="142" cy="109" r="4" fill="${INK}"/>`;
  o += `<path d="M96 140 Q118 126 140 140" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  return o;
}

function ghostSvg(): string {
  let o = `<path d="M40 280 L40 120 C40 30 180 30 180 120 L180 280 L156 256 L132 280 L110 256 L88 280 L64 256 Z" fill="#EDEBFF" fill-opacity="0.94" ${S}/>`;
  o += `<path d="M60 130 C60 60 150 54 160 110" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" opacity="0.8"/>`;
  o += `<circle cx="84" cy="120" r="21" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/><circle cx="136" cy="120" r="21" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/><path d="M105 120 L115 120" stroke="${INK}" stroke-width="5"/>`;
  o += `<circle cx="88" cy="124" r="8" fill="#6C4AB6"/><circle cx="132" cy="124" r="8" fill="#6C4AB6"/><path d="M64 92 L100 100 M156 92 L120 100" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  o += `<path d="M88 164 Q110 150 132 164 Q110 190 88 164 Z" fill="#3B2A6B" ${S}/>`;
  o += `<rect x="118" y="196" width="74" height="58" rx="6" fill="#C9462C" ${S} transform="rotate(-10 155 225)"/><path d="M130 214 L176 206 M132 228 L178 220 M134 242 L166 236" stroke="#FFF3D6" stroke-width="4" stroke-linecap="round"/>`;
  return o;
}

export function characterSvg(s: CharSpec): string {
  let inner: string;
  if (s.custom === 'storm') inner = stormSvg();
  else if (s.custom === 'ghost') inner = ghostSvg();
  else {
    const hairBack = s.hair === 'long' || s.hair === 'pigtails';
    inner = extras(s, 'back') + (hairBack ? hair(s) : '') + body(s) + head(s) + (hairBack ? '' : hair(s)) + extras(s, 'front');
    if (s.hair === 'long') inner += `<path d="M${110 - 60} ${FACE_ANCHOR.y - 14} C${110 - 50} ${FACE_ANCHOR.y - 70} ${110 + 10} ${FACE_ANCHOR.y - 76} 110 ${FACE_ANCHOR.y - 46} C${110 + 10} ${FACE_ANCHOR.y - 76} ${110 + 54} ${FACE_ANCHOR.y - 66} ${110 + 60} ${FACE_ANCHOR.y - 14} C${110 + 40} ${FACE_ANCHOR.y - 50} ${110 - 40} ${FACE_ANCHOR.y - 50} ${110 - 60} ${FACE_ANCHOR.y - 14} Z" fill="${s.hairColor}" ${S}/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHAR_W}" height="${CHAR_H}" viewBox="0 0 ${CHAR_W} ${CHAR_H}">${inner}</svg>`;
}

export type Expression = 'neutral' | 'happy' | 'angry' | 'talk' | 'sad' | 'surprised' | 'blink';
export const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'angry', 'talk', 'sad', 'surprised', 'blink'];

export function faceSvg(e: Expression): string {
  const st = `stroke="${INK}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const eye = (x: number, y = 40): string => `<ellipse cx="${x}" cy="${y}" rx="8" ry="10" fill="${INK}"/><circle cx="${x + 3}" cy="${y - 4}" r="3" fill="#FFFFFF"/>`;
  const L = 38;
  const R = 92;
  let o = '';
  switch (e) {
    case 'neutral': o = `${eye(L)}${eye(R)}<path d="M24 20 Q38 12 50 20 M80 20 Q92 12 106 20" ${st} stroke-width="5"/><path d="M50 76 Q65 86 80 76" ${st} stroke-width="5"/>`; break;
    case 'happy': o = `<path d="M26 44 Q38 26 50 44 M80 44 Q92 26 104 44" ${st} stroke-width="6"/><path d="M24 18 Q38 8 50 16 M80 16 Q92 8 106 18" ${st} stroke-width="5"/><path d="M42 68 Q65 100 88 68 Z" fill="#7A2E1D" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M52 84 Q65 94 78 84" fill="#F28B82" stroke="none"/>`; break;
    case 'angry': o = `${eye(L, 44)}${eye(R, 44)}<path d="M22 14 L52 28 M108 14 L78 28" ${st} stroke-width="7"/><path d="M46 86 Q65 68 84 86" ${st} stroke-width="6"/>`; break;
    case 'talk': o = `${eye(L)}${eye(R)}<path d="M24 20 Q38 10 50 18 M80 18 Q92 10 106 20" ${st} stroke-width="5"/><ellipse cx="65" cy="80" rx="14" ry="11" fill="#7A2E1D" stroke="${INK}" stroke-width="5"/>`; break;
    case 'sad': o = `${eye(L, 44)}${eye(R, 44)}<path d="M24 26 L50 16 M106 26 L80 16" ${st} stroke-width="5"/><path d="M48 86 Q65 74 82 86" ${st} stroke-width="5"/>`; break;
    case 'surprised': o = `<circle cx="${L}" cy="40" r="12" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/><circle cx="${R}" cy="40" r="12" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/><circle cx="${L}" cy="41" r="5" fill="${INK}"/><circle cx="${R}" cy="41" r="5" fill="${INK}"/><path d="M24 14 Q38 4 50 12 M80 12 Q92 4 106 14" ${st} stroke-width="5"/><ellipse cx="65" cy="82" rx="10" ry="12" fill="#7A2E1D" stroke="${INK}" stroke-width="5"/>`; break;
    case 'blink': o = `<path d="M28 42 L48 42 M82 42 L102 42" ${st} stroke-width="6"/><path d="M24 20 Q38 12 50 20 M80 20 Q92 12 106 20" ${st} stroke-width="5"/><path d="M50 76 Q65 86 80 76" ${st} stroke-width="5"/>`; break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FACE_W}" height="${FACE_H}" viewBox="0 0 ${FACE_W} ${FACE_H}">${o}</svg>`;
}

const SK = { a: '#C68642', b: '#B5753A', c: '#D9A066', d: '#A9642B', e: '#E0AC69' };
const HR = { black: '#1E1611', brown: '#3E2A1C', grey: '#9A9A9A', white: '#EDEDED', henna: '#8A3B12' };

/** The cast. Outfits are swapped in for the shopkeeper through customisation. */
export const CHARACTERS: Record<string, CharSpec> = {
  shopkeeper: { skin: SK.a, hair: 'side', hairColor: HR.black, top: 'apron', c1: '#F4E9D0', c2: '#0A9396', extras: ['mustache'] },
  bhai: { skin: SK.b, hair: 'short', hairColor: HR.black, top: 'shirt', c1: '#5B8DEF', c2: '#3D6FD1' },
  apa: { skin: SK.c, hair: 'bun', hairColor: HR.black, top: 'kameez', c1: '#E76F9A', c2: '#F6C445', extras: ['earrings'] },
  chacha: { skin: SK.d, hair: 'bald', hairColor: HR.grey, top: 'panjabi', c1: '#E9E2D0', c2: '#C9B458', extras: ['tupi', 'beard'] },
  student: { skin: SK.e, hair: 'spiky', hairColor: HR.black, top: 'tshirt', c1: '#2A9D8F', c2: '#F6C445', extras: ['bag'] },
  regular2: { skin: SK.a, hair: 'curly', hairColor: HR.brown, top: 'shirt', c1: '#F4A261', c2: '#E76F51', extras: ['glasses'] },
  impatient: { skin: SK.c, hair: 'side', hairColor: HR.black, top: 'suit', c1: '#4A5568', c2: '#E63946', extras: ['tie', 'sweat'] },
  bargain: { skin: SK.b, hair: 'bun', hairColor: HR.henna, top: 'saree', c1: '#2A9D8F', c2: '#E63946', extras: ['earrings', 'necklace'] },
  dadu: { skin: SK.d, hair: 'bald', hairColor: HR.white, top: 'panjabi', c1: '#FFFFFF', c2: '#B0BEC5', extras: ['whitebeard', 'glasses', 'tupi', 'cane'] },
  nani: { skin: SK.c, hair: 'none', hairColor: HR.white, top: 'saree', c1: '#FFFFFF', c2: '#9C89B8', extras: ['orna', 'glasses'] },
  pichchi: { skin: SK.e, hair: 'spiky', hairColor: HR.black, top: 'tshirt', c1: '#F6C445', c2: '#E63946', kid: true },
  schoolgirl: { skin: SK.c, hair: 'pigtails', hairColor: HR.black, top: 'uniform', c1: '#3A86FF', c2: '#1D4ED8', kid: true },
  vip: { skin: SK.e, hair: 'side', hairColor: HR.black, top: 'suit', c1: '#1F2937', c2: '#F6C445', extras: ['sunglasses', 'tie'] },
  bulk: { skin: SK.a, hair: 'short', hairColor: HR.black, top: 'ganji', c1: '#FFFFFF', c2: '#FFFFFF', extras: ['mustache', 'gamcha'], wide: true },
  credit: { skin: SK.b, hair: 'side', hairColor: HR.brown, top: 'shirt', c1: '#A3B18A', c2: '#588157', extras: ['mustache'] },
  angry: { skin: SK.d, hair: 'short', hairColor: HR.black, top: 'shirt', c1: '#E63946', c2: '#9D0208', extras: ['bigmustache'] },
  confused: { skin: SK.c, hair: 'none', hairColor: HR.grey, top: 'saree', c1: '#F6C445', c2: '#6C4AB6', extras: ['orna', 'glasses'] },
  kipta: { skin: SK.a, hair: 'bald', hairColor: HR.black, top: 'panjabi', c1: '#C9B458', c2: '#8D6E3F', extras: ['mustache', 'glasses'] },
  family: { skin: SK.b, hair: 'long', hairColor: HR.black, top: 'kameez', c1: '#9C89B8', c2: '#F0A6CA', extras: ['child', 'earrings'] },
  supplier: { skin: SK.d, hair: 'short', hairColor: HR.black, top: 'shirt', c1: '#8D6E3F', c2: '#5D4037', extras: ['cap', 'pen'] },
  boss_king: { skin: SK.b, hair: 'side', hairColor: HR.black, top: 'panjabi', c1: '#6C4AB6', c2: '#F6C445', extras: ['crown', 'bigmustache', 'chain', 'sunglasses'], wide: true },
  boss_tycoon: { skin: SK.d, hair: 'bald', hairColor: HR.grey, top: 'panjabi', c1: '#FFFFFF', c2: '#F6C445', extras: ['tupi', 'beard', 'chain', 'glasses'], wide: true },
  boss_thief: { skin: SK.a, hair: 'short', hairColor: HR.black, top: 'stripes', c1: '#F4F4F4', c2: '#1B1B1B', extras: ['mask', 'cap', 'sack'] },
  boss_storm: { skin: SK.a, hair: 'none', hairColor: HR.black, top: 'shirt', c1: '#000', c2: '#000', custom: 'storm' },
  boss_ghost: { skin: SK.a, hair: 'none', hairColor: HR.black, top: 'shirt', c1: '#000', c2: '#000', custom: 'ghost' },
};

/** Characters whose face is drawn into the body (no expression overlay). */
export const NO_FACE = new Set(['boss_storm', 'boss_ghost', 'boss_thief']);

/** Shopkeeper outfits (customisation). */
export const OUTFITS: Record<string, Partial<CharSpec>> = {
  outfit_apron: {},
  outfit_panjabi: { top: 'panjabi', c1: '#FFFFFF', c2: '#F6C445', extras: ['mustache', 'tupi'] },
  outfit_lungi: { top: 'ganji', c1: '#FFFFFF', c2: '#FFFFFF', extras: ['mustache', 'gamcha'] },
  outfit_cricket: { top: 'tshirt', c1: '#006A4E', c2: '#F42A41', extras: ['mustache', 'cap'] },
  outfit_boss: { top: 'suit', c1: '#1F2937', c2: '#F6C445', extras: ['mustache', 'tie', 'sunglasses'] },
  outfit_king: { top: 'panjabi', c1: '#9D0208', c2: '#F6C445', extras: ['mustache', 'crown', 'chain'] },
};

export function shopkeeperSpec(outfit: string): CharSpec {
  return { ...CHARACTERS.shopkeeper!, ...(OUTFITS[outfit] ?? {}) };
}
