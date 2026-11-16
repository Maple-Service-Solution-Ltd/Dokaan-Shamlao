/**
 * Deterministic pseudo-random number generation.
 * Only integer operations are used so results are identical on every JS engine
 * (required: the server re-simulates runs to validate scores).
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }

  /** Next unsigned 32-bit integer (mulberry32). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return n <= 1 ? 0 : this.next() % n;
  }

  /** Integer in [a, b] inclusive. */
  range(a: number, b: number): number {
    return b <= a ? a : a + this.int(b - a + 1);
  }

  /** True with the given integer percentage chance. */
  chance(pct: number): boolean {
    return this.int(100) < pct;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)] as T;
  }

  /** Pick a key from a weight map (integer weights). Keys are iterated in sorted order for stability. */
  weighted<K extends string>(weights: Partial<Record<K, number>>): K {
    const keys = (Object.keys(weights) as K[]).filter((k) => (weights[k] ?? 0) > 0).sort();
    let total = 0;
    for (const k of keys) total += weights[k] as number;
    let r = this.int(Math.max(1, total));
    for (const k of keys) {
      r -= weights[k] as number;
      if (r < 0) return k;
    }
    return keys[keys.length - 1] as K;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = tmp;
    }
    return arr;
  }
}

/** Mix integers into a new 32-bit seed (used to derive independent sub-streams). */
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** Hash a string to a 32-bit seed (FNV-1a). */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
