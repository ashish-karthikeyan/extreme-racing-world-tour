// ---------- helpers ----------

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function shade(hex, amt) { // amt -1..1 (darken..lighten)
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, t = Math.abs(amt);
  r = Math.round(r + (f - r) * t); g = Math.round(g + (f - g) * t); b = Math.round(b + (f - b) * t);
  return `rgb(${r},${g},${b})`;
}

// gears: 8 of them, each covering a slice of the speed range (shared by the gauge, the sound and the rev lights)
const effV = r => Math.max(r.v, (r.rev || 0) * 2.8); // what the engine sounds / the rev needle shows: revs count while you're on the grid
const gearOf = v => clamp(1 + Math.floor(v / 0.75), 1, 8);
function rpmOf(v) { const g = gearOf(v), lo = (g - 1) * 0.75; return clamp((v - lo) / 0.75, 0, 1); } // 8th redlines at 360 km/h, then sits on the limiter

