// Seeded random numbers: the same seed always gives the same stream, so a city is built the same way every run.

export function hash(a, b = 0, c = 0, d = 0) {
  let h = 2166136261 >>> 0;
  for (const v of [a, b, c, d]) { h ^= (v | 0) + 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16; }
  return h >>> 0;
}

export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.pick = list => list[Math.floor(f() * list.length)];
  f.chance = p => f() < p;
  return f;
}

// smooth 2D value noise (0..1), deterministic: used for "where the tall buildings are"
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const r = (i, j) => (hash(i, j, seed) & 0xffff) / 65535;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf);
  return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v;
}
export const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
