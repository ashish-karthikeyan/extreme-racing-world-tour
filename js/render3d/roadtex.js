// Pictures drawn in code for the road: the "wear" layer (tyre marks, patches, cracks, manholes, drains, puddle spots), worn paint for the
// lane lines, and the kerb stripes. All of them use a seeded random generator, so the road looks the same on every run.
import * as THREE from "three";

function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };

export const WEAR_W = 32, WEAR_LEN = 64; // world units covered by the wear picture: the width of the road and one repeat along it

// ---- the wear layer ----
// red   = rubber and grime (0 clean .. 1 black)             green = tone (0.5 unchanged, lighter above, darker below): patches, cracks, covers
// blue  = where water gathers when it rains (low, smooth noise, deeper near the kerbs)
// k = the size of the picture (1 = 1024 x 2048; a machine that starts on Low draws it at 0.5, a quarter of the pixels: the same picture, softer)
export function wearTexture(laneCentres, roadHalf, k = 1) {
  const W = 1024, H = 2048, PW = Math.round(W * k), PH = Math.round(H * k), ppu = W / WEAR_W, rnd = rngOf(7311), R = (a, b) => a + rnd() * (b - a); // (everything is drawn in W x H units; the canvases are PW x PH pixels)
  const [cr, gr] = canvas(PW, PH), [cg, gg] = canvas(PW, PH); gr.scale(k, k); gg.scale(k, k);
  const X = u => (u / WEAR_W + 0.5) * W; // world x -> pixel
  const wrap = (y0, y1, fn) => { fn(0); if (y1 > H) fn(-H); if (y0 < 0) fn(H); };
  gr.fillStyle = "#000"; gr.fillRect(0, 0, W, H); gg.fillStyle = "rgb(128,128,128)"; gg.fillRect(0, 0, W, H);

  // -- rubber: a broad polished racing line down each lane and the two wheel tracks inside it, in streaks that fade in and out --
  for (const lc of laneCentres) {
    for (let y = 0; y < H;) {
      const len = R(80, 360), a = R(0.06, 0.22), g = gr.createLinearGradient(X(lc) - 3.2 * ppu, 0, X(lc) + 3.2 * ppu, 0);
      g.addColorStop(0, `rgba(255,255,255,0)`); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, `rgba(255,255,255,0)`);
      gr.fillStyle = g; wrap(y, y + len, o => gr.fillRect(X(lc) - 3.2 * ppu, y + o, 6.4 * ppu, len)); y += len * R(0.6, 1);
    }
    for (const side of [-1, 1]) {
      let x = X(lc + side * 1.5);
      for (let y = R(-100, 0); y < H;) {
        const len = R(160, 700), a = R(0.15, 0.6); gr.strokeStyle = `rgba(255,255,255,${a})`; gr.lineWidth = R(12, 20); gr.lineCap = "round"; gr.shadowColor = "rgba(255,255,255,0.8)"; gr.shadowBlur = 9 * k; // (a shadow's blur is in real pixels: the canvas scale doesn't shrink it)
        const y0 = y; wrap(y0, y0 + len, o => { gr.beginPath(); let xx = x; gr.moveTo(xx, y0 + o); for (let k = 1; k <= 6; k++) { xx += R(-3, 3); xx = Math.max(X(lc + side * 1.5) - 14, Math.min(X(lc + side * 1.5) + 14, xx)); gr.lineTo(xx, y0 + o + len * k / 6); } gr.stroke(); });
        y += len * R(0.7, 1.4);
      }
    }
    gr.shadowBlur = 0; // oil drips down the middle of the lane
    for (let i = 0; i < 38; i++) { const x = X(lc + R(-0.7, 0.7)), y = R(0, H), r = R(2, 6); gr.fillStyle = `rgba(255,255,255,${R(0.3, 0.7)})`; gr.beginPath(); gr.ellipse(x, y, r, r * R(1, 3), 0, 0, 7); gr.fill(); }
  }
  for (const s of [-1, 1]) { const g = gr.createLinearGradient(X(s * roadHalf), 0, X(s * (roadHalf - 2.2)), 0); g.addColorStop(0, "rgba(255,255,255,0.4)"); g.addColorStop(1, "rgba(255,255,255,0)"); gr.fillStyle = g; gr.fillRect(Math.min(X(s * roadHalf), X(s * (roadHalf - 2.2))), 0, 2.2 * ppu, H); } // grime along the kerbs

  // -- tone: soft blotches of lighter and darker asphalt, then patches, cracks, manholes, drain covers --
  for (let i = 0; i < 520; i++) { const x = R(0, W), y = R(0, H), r = R(24, 120), v = rnd() < 0.5 ? R(70, 108) : R(150, 190), g = gg.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${v},${v},${v},0.32)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); gg.fillStyle = g; wrap(y - r, y + r, o => gg.fillRect(x - r, y - r + o, r * 2, r * 2)); }
  for (let i = 0; i < 5; i++) { // repair patches: a neat rectangle of newer (or older) asphalt with a dark sealed edge
    const w = R(3, 9) * ppu, l = R(3, 14) * ppu, x = R(-roadHalf + 1, roadHalf - 1) * ppu + W / 2 - w / 2, y = R(0, H - l), v = rnd() < 0.55 ? R(104, 118) : R(140, 152);
    gg.fillStyle = `rgb(${v},${v},${v})`; gg.fillRect(x, y, w, l); gg.strokeStyle = "rgb(55,55,55)"; gg.lineWidth = 3; gg.strokeRect(x, y, w, l); gg.strokeStyle = "rgba(55,55,55,0.5)"; gg.lineWidth = 1.5; gg.strokeRect(x + 5, y + 5, w - 10, l - 10);
    gr.fillStyle = "rgba(255,255,255,0.0)";
  }
  gg.lineCap = "round"; gg.lineJoin = "round";
  for (let i = 0; i < 12; i++) { // cracks
    let x = R(0, W), y = R(0, H); const dir = R(0, Math.PI * 2), n = Math.floor(R(8, 26)); gg.strokeStyle = `rgba(40,40,40,${R(0.5, 0.9)})`; gg.lineWidth = R(1.5, 3); gg.beginPath(); gg.moveTo(x, y);
    let a = dir; for (let k = 0; k < n; k++) { a += R(-0.7, 0.7); x += Math.cos(a) * R(10, 26); y += Math.sin(a) * R(10, 26); gg.lineTo(x, y); } gg.stroke();
  }
  const manhole = (x, y) => { gg.fillStyle = "rgb(60,60,60)"; gg.beginPath(); gg.arc(x, y, 28, 0, 7); gg.fill(); gg.fillStyle = "rgb(150,152,155)"; gg.beginPath(); gg.arc(x, y, 23, 0, 7); gg.fill(); gg.strokeStyle = "rgb(95,95,98)"; gg.lineWidth = 2;
    for (let k = -2; k <= 2; k++) { gg.beginPath(); gg.moveTo(x - 20, y + k * 8); gg.lineTo(x + 20, y + k * 8); gg.stroke(); gg.beginPath(); gg.moveTo(x + k * 8, y - 20); gg.lineTo(x + k * 8, y + 20); gg.stroke(); } gg.beginPath(); gg.arc(x, y, 9, 0, 7); gg.stroke(); };
  for (let i = 0; i < 3; i++) manhole(R(-roadHalf + 2, roadHalf - 2) * ppu + W / 2, R(40, H - 40));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { // storm drains beside the kerb
    const x = X(s * (roadHalf - 0.9)) - 11, y = R(40, H - 80); gg.fillStyle = "rgb(40,40,40)"; gg.fillRect(x - 2, y - 2, 26, 62); gg.fillStyle = "rgb(150,150,152)"; for (let k = 0; k < 7; k++) gg.fillRect(x + 1, y + 2 + k * 8, 20, 4);
  }
  for (let i = 0; i < 4500; i++) { const v = rnd() < 0.5 ? 100 : 156; gg.fillStyle = `rgba(${v},${v},${v},0.25)`; gg.fillRect(R(0, W), R(0, H), 2, 2); } // grit

  // -- puddle spots: smooth tileable noise (more of it near the kerbs) --
  const pw = 256, ph = 512, [cb, gb] = canvas(pw, ph), img = gb.createImageData(pw, ph), waves = [];
  for (let k = 0; k < 9; k++) waves.push({ fx: 1 + Math.floor(rnd() * 5), fy: 2 + Math.floor(rnd() * 10), ph: R(0, 6.28), a: R(0.5, 1) / (1 + k * 0.2) });
  // each wave is sin(a + b) with a from x and b from y: sin a cos b + cos a sin b, so the sines are worked out once per column and once per row
  const NW = waves.length, sx = new Float32Array(NW * pw), cx = new Float32Array(NW * pw), sy = new Float32Array(NW * ph), cy = new Float32Array(NW * ph);
  waves.forEach((w, k) => { for (let x = 0; x < pw; x++) { const a = 6.2832 * w.fx * x / pw + w.ph; sx[k * pw + x] = Math.sin(a); cx[k * pw + x] = Math.cos(a); } for (let y = 0; y < ph; y++) { const b = 6.2832 * w.fy * y / ph; sy[k * ph + y] = Math.sin(b); cy[k * ph + y] = Math.cos(b); } });
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    let n = 0, t = 0; for (let k = 0; k < NW; k++) { const w = waves[k]; n += w.a * (sx[k * pw + x] * cy[k * ph + y] + cx[k * pw + x] * sy[k * ph + y]); t += w.a; }
    const ux = Math.abs(x / pw - 0.5) * 2, v = Math.max(0, Math.min(1, 0.5 + 0.5 * n / t * 1.6 + 0.28 * Math.max(0, ux - 0.72) / 0.28)), i = (y * pw + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255; img.data[i + 3] = 255;
  }
  gb.putImageData(img, 0, 0);
  const [cB, gB] = canvas(PW, PH); gB.imageSmoothingEnabled = true; gB.drawImage(cb, 0, 0, PW, PH);

  // -- pack the three pictures into one --
  const [out, go] = canvas(PW, PH), a = gr.getImageData(0, 0, PW, PH).data, b = gg.getImageData(0, 0, PW, PH).data, c = gB.getImageData(0, 0, PW, PH).data, o = go.createImageData(PW, PH);
  for (let i = 0; i < PW * PH * 4; i += 4) { o.data[i] = a[i]; o.data[i + 1] = b[i]; o.data[i + 2] = c[i]; o.data[i + 3] = 255; }
  go.putImageData(o, 0, 0);
  const t = new THREE.CanvasTexture(out); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t; // (colorSpace stays "no colour space": these are data, not colours)
}

// ---- the white lane lines: 32 x 16 world units, two edge lines and two dashed lines, chipped and dirty ----
export function linesTexture() {
  const [c, g] = canvas(1024, 512), rnd = rngOf(991), R = (a, b) => a + rnd() * (b - a);
  g.clearRect(0, 0, 1024, 512); g.fillStyle = "rgba(240,240,232,0.97)";
  g.fillRect(12, 0, 16, 512); g.fillRect(1024 - 28, 0, 16, 512);
  for (const fx of [1 / 3, 2 / 3]) for (const y0 of [0, 256]) g.fillRect(1024 * fx - 8, y0, 16, 128);
  g.globalCompositeOperation = "destination-out"; // chips, scuffs and worn patches in the paint
  for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(0,0,0,${R(0.35, 1)})`; g.fillRect(R(0, 1024), R(0, 512), R(1, 5), R(1, 6)); }
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${R(0.2, 0.55)})`; g.fillRect(R(0, 1024), R(0, 512), R(2, 8), R(20, 80)); }
  for (let i = 0; i < 40; i++) { const x = R(0, 1024), y = R(0, 512), r = R(10, 36), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.globalCompositeOperation = "source-atop"; for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(90,85,75,${R(0.05, 0.2)})`; g.fillRect(R(0, 1024), R(0, 512), R(10, 40), R(10, 60)); } // dirt on the remaining paint
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// ---- the red and white kerb stripes (4 stripes per repeat), scuffed ----
// cols = the stripe colours (each city paints its kerbs in its own colours: two alternate, three go a-b-c-b, four in order); pass the
// texture back as `into` to repaint it in place when the city changes
export function kerbTexture(cols = ["#c9261c", "#ededed"], into = null) {
  const [c, g] = into ? [into.image, into.image.getContext("2d")] : canvas(128, 512), rnd = rngOf(55), R = (a, b) => a + rnd() * (b - a);
  const seq = cols.length === 2 ? [cols[0], cols[1], cols[0], cols[1]] : cols.length === 3 ? [cols[0], cols[1], cols[2], cols[1]] : cols.slice(0, 4);
  for (let i = 0; i < 4; i++) { g.fillStyle = seq[i]; g.fillRect(0, i * 128, 128, 128); }
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "255,255,255"},${R(0.04, 0.16)})`; g.fillRect(R(0, 128), R(0, 512), R(1, 4), R(1, 6)); }
  const e = g.createLinearGradient(0, 0, 128, 0); e.addColorStop(0, "rgba(0,0,0,0.35)"); e.addColorStop(0.08, "rgba(0,0,0,0)"); e.addColorStop(0.92, "rgba(0,0,0,0)"); e.addColorStop(1, "rgba(0,0,0,0.3)"); g.fillStyle = e; g.fillRect(0, 0, 128, 512);
  if (into) { into.needsUpdate = true; return into; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// ---- a kerb with real height: a low sloped ramp the full length of the road, striped by the texture (side = -1 left, +1 right) ----
export function kerbGeometry(side, len, tile, width = 1.4, height = 0.11) {
  const prof = [[0, 0], [0.05, height * 0.82], [0.22, height], [width - 0.2, height], [width, 0]], pos = [], uv = [], nor = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1], ey = y1 - y0, nl = Math.hypot(x1 - x0, ey); // (the slope of this piece of the kerb profile)
    const nX = (side > 0 ? -ey : ey) / nl, nY = Math.abs(x1 - x0) / nl; // its upward / outward normal
    const quad = [[x0, y0, 0], [x1, y1, 0], [x1, y1, 1], [x0, y0, 1]];
    for (const idx of side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) { const [x, y, t] = quad[idx]; pos.push(x * side, y, len / 2 - t * len); uv.push(x / width, t); nor.push(nX, nY, 0); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g; // (z runs from +len/2 at the near end to -len/2 far away; v = 0..1 along it)
}
