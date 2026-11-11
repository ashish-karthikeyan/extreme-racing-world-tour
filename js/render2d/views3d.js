// ---------- drawing: 3D views (chase cam and cockpit) ----------

function seeded(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---- sky dressing: shaded cloud sprites, a starfield, lightning ----
const cloudSprites = {};
function cloudSprite(v, dark) { // a puffy cloud lit from above; dark = the rain-city version
  const key = v + (dark ? "d" : "l");
  if (cloudSprites[key]) return cloudSprites[key];
  const c = cloudSprites[key] = document.createElement("canvas"); c.width = 220; c.height = 96;
  const g = c.getContext("2d"), puffs = [[0.5, 0.58, 0.26], [0.32, 0.66, 0.2], [0.68, 0.66, 0.21], [0.42, 0.45, 0.2], [0.6, 0.47, 0.17], [0.2, 0.74, 0.13], [0.82, 0.74, 0.13]];
  for (let i = 0; i < puffs.length; i++) {
    const [x, y, r] = puffs[(i + v) % puffs.length].map((n, k) => k === 2 ? n * (0.85 + ((v * 7 + i) % 5) * 0.06) : n);
    const cx = x * 220, cy = y * 96, rr = r * 220, gr = g.createRadialGradient(cx, cy - rr * 0.45, rr * 0.15, cx, cy, rr);
    gr.addColorStop(0, dark ? "rgba(170,178,192,1)" : "rgba(255,255,255,1)"); gr.addColorStop(0.65, dark ? "rgba(118,126,142,1)" : "rgba(236,240,248,1)"); gr.addColorStop(1, dark ? "rgba(92,100,116,0)" : "rgba(200,212,232,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill();
  }
  return c;
}
let starField = null, starKey = "";
function stars(w, h) { // twinkle-free base layer, drawn once per size
  const key = `${Math.round(w)}x${Math.round(h)}`;
  if (starKey !== key) {
    starKey = key; starField = document.createElement("canvas"); starField.width = Math.ceil(w); starField.height = Math.ceil(h);
    const g = starField.getContext("2d");
    const band = g.createLinearGradient(0, h, w, 0); band.addColorStop(0.3, "rgba(140,120,255,0)"); band.addColorStop(0.5, "rgba(170,150,255,0.16)"); band.addColorStop(0.7, "rgba(140,120,255,0)");
    g.fillStyle = band; g.fillRect(0, 0, w, h); // a faint galaxy band
    for (let i = 0; i < 260; i++) { const s = seeded(i * 3 + 7); g.fillStyle = `rgba(255,${235 + s * 20},${210 + s * 45},${0.25 + s * 0.6})`; const r = s > 0.93 ? 1.6 : s > 0.7 ? 1.1 : 0.7; g.beginPath(); g.arc(seeded(i) * w, seeded(i + 500) * h, r, 0, TAU); g.fill(); }
  }
  return starField;
}
let lightning = { t: 0, x: 0, pts: null }; // rain cities: a flash, a bolt on the skyline, thunder a moment later
function strike() {
  const x = rnd(W * 0.1, W * 0.9), pts = [[x, 0]];
  for (let y = 0, cx = x; y < 120;) { y += rnd(10, 22); cx += rnd(-16, 16); pts.push([cx, y]); }
  lightning = { t: 1, x, pts };
  sound.burst(0.08, 0.5, "highpass", 4000, 2000); sound.burst(1.6, 0.6, "lowpass", 420, 50, 0.35 + Math.random() * 0.6); sound.burst(1.1, 0.4, "lowpass", 260, 40, 0.9);
}

function drawSky(C) {
  const hor = C.hor, g = ctx.createLinearGradient(0, 0, 0, hor);
  const dim = rainI * 0.35, top = mix(pal.sky0, [88, 98, 112], dim), bot = mix(pal.sky1, [150, 160, 172], dim);
  g.addColorStop(0, rgb(mix(top, [0, 0, 0], 0.15))); g.addColorStop(0.55, rgb(top)); g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, hor + 22);
  const px = -camOff * 0.12, night = Math.min(1, pal.dark * 4);
  const glowBand = ctx.createLinearGradient(0, hor - 70, 0, hor); // light pooling on the horizon (warm by day, city-orange at night)
  glowBand.addColorStop(0, "rgba(255,200,140,0)"); glowBand.addColorStop(1, night > 0.3 ? `rgba(255,140,90,${0.35 * night})` : `rgba(255,236,200,${0.35 * (1 - rainI)})`);
  ctx.fillStyle = glowBand; ctx.fillRect(-20, hor - 70, W + 40, 72);
  if (night > 0.05) { // stars, a galaxy band and a glowing moon
    ctx.globalAlpha = night; ctx.drawImage(stars(W + 40, hor), -20 + px * 0.3, 0);
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 24; i++) { const tw = Math.sin(clock / (18 + i % 7) + i * 3); if (tw > 0.6) { ctx.globalAlpha = night * (tw - 0.6) * 2.5; ctx.fillRect(seeded(i + 40) * W - 1, seeded(i + 140) * (hor - 50) - 1, 2.4, 2.4); } }
    const mx = W * 0.78 + px, my = hor - 88;
    ctx.globalAlpha = night; glow(mx, my, 60, "200,215,255", 0.35);
    ctx.fillStyle = "#f4f0dc"; circle(mx, my, 12);
    ctx.fillStyle = "rgba(170,165,140,0.5)"; circle(mx - 4, my - 3, 3); circle(mx + 4, my + 4, 2.2); circle(mx + 3, my - 5, 1.6); // craters
    ctx.globalAlpha = 1;
  }
  if (pal.sun > 0.02 && rainI < 0.6) { // sun with god rays turning slowly behind it
    const sx = W * 0.72 + px, sy = hor - 72, sa = pal.sun * (1 - rainI);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const rg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260); rg.addColorStop(0, `rgba(255,236,190,${0.16 * sa})`); rg.addColorStop(1, "rgba(255,236,190,0)");
    ctx.fillStyle = rg;
    for (let i = 0; i < 12; i++) { const a = clock / 900 + i * TAU / 12, w = 0.07 + 0.04 * Math.sin(i * 2.3); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - w) * 260, sy + Math.sin(a - w) * 260); ctx.lineTo(sx + Math.cos(a + w) * 260, sy + Math.sin(a + w) * 260); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 80);
    sg.addColorStop(0, `rgba(255,252,230,${sa})`); sg.addColorStop(0.12, `rgba(255,246,205,${0.95 * sa})`); sg.addColorStop(0.3, `rgba(255,226,160,${0.45 * sa})`); sg.addColorStop(1, "rgba(255,220,150,0)");
    ctx.fillStyle = sg; ctx.fillRect(sx - 80, sy - 80, 160, 160);
  }
  const dark = rainI > 0.3, n = dark ? 9 : 6; // clouds at three depths, the near ones bigger and quicker
  for (let i = 0; i < n; i++) {
    const depth = 0.45 + (i % 3) * 0.3, cw = 150 * depth * (dark ? 1.35 : 1), span = W + 2 * cw;
    const cx = ((clock * 0.12 * depth + i * 197) % span) - cw + px * depth, cy = 8 + ((i * 37) % Math.max(30, hor - 70)) * (0.5 + 0.5 * (1 - depth));
    ctx.globalAlpha = (dark ? 0.92 : 0.85) * (1 - night * 0.75) * (0.55 + depth * 0.45);
    ctx.drawImage(cloudSprite(i % 4, dark), cx, cy, cw, cw * 0.44);
  }
  ctx.globalAlpha = 1;
  if (lightning.t > 0.02 && lightning.pts) { // the bolt
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineJoin = "round";
    for (const [lw, a] of [[7, 0.25], [2.2, 1]]) { ctx.strokeStyle = `rgba(210,225,255,${a * lightning.t})`; ctx.lineWidth = lw; ctx.beginPath(); lightning.pts.forEach(([x, y], k) => k ? ctx.lineTo(x + px, Math.min(y, hor - 4)) : ctx.moveTo(x + px, y)); ctx.stroke(); }
    ctx.restore();
  }
  drawHorizon(stA, 1 - stBlend, hor, px);
  if (stBlend > 0.01) drawHorizon(stB, stBlend, hor, px);
  const hh = x => 10 + 7 * Math.sin((x + px * 4) * 0.02 + 2) + 4 * Math.sin((x + px * 4) * 0.07); // low rolling hills in front
  ctx.fillStyle = rgb(pal.hill); ctx.beginPath(); ctx.moveTo(-10, hor + 2);
  for (let x = -10; x <= W + 10; x += 8) ctx.lineTo(x, hor - hh(x));
  ctx.lineTo(W + 10, hor + 2); ctx.closePath(); ctx.fill();
}

// what sits on the skyline for each country
function drawHorizon(st, a, hor, px) {
  if (a < 0.01) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = rgb(st.mc);
  const k = st.horizon;
  if (k === "peaks" || k === "alps" || k === "volcano") {
    const tall = k === "alps" ? 1.5 : 1;
    const mh = x => k === "volcano" ? Math.max(8, 74 - Math.abs(x - (W * 0.3 + px * 2)) * 0.55) : tall * (20 + 26 * Math.abs(Math.sin((x + px * 2) * 0.016 + 1.3)) + 12 * Math.abs(Math.sin((x + px * 2) * 0.05)));
    ctx.beginPath(); ctx.moveTo(-10, hor);
    for (let x = -10; x <= W + 10; x += 6) ctx.lineTo(x, hor - mh(x));
    ctx.lineTo(W + 10, hor); ctx.closePath(); ctx.fill();
    if (k === "alps") { ctx.fillStyle = "rgba(255,255,255,0.92)"; for (let x = -10; x <= W + 10; x += 6) { const h = mh(x); if (h > 52) ctx.fillRect(x, hor - h, 6, (h - 50) * 0.6); } }
  } else if (k === "fuji") {
    const cx = W * 0.6 + px * 2;
    poly([[cx - 140, hor], [cx - 18, hor - 84], [cx + 18, hor - 84], [cx + 140, hor]]);
    ctx.fillStyle = "#fff"; poly([[cx - 18, hor - 84], [cx + 18, hor - 84], [cx + 32, hor - 60], [cx + 14, hor - 67], [cx, hor - 58], [cx - 14, hor - 67], [cx - 32, hor - 60]]);
  } else if (k === "dunes" || k === "hills") {
    const amp = k === "dunes" ? 22 : 26;
    ctx.beginPath(); ctx.moveTo(-10, hor);
    for (let x = -10; x <= W + 10; x += 6) ctx.lineTo(x, hor - amp * (0.6 + 0.4 * Math.sin((x + px * 2) * 0.014 + 1)) - 8 * Math.sin((x + px * 2) * 0.04));
    ctx.lineTo(W + 10, hor); ctx.closePath(); ctx.fill();
  } else if (k === "pines") {
    ctx.fillStyle = rgb(mix(PINE, [0, 0, 0], 0.2));
    for (let i = 0; i < 46; i++) { const x = ((i * 23) % (W + 60)) - 30 + px * 4, h = 22 + (i % 5) * 5; poly([[x - 7, hor], [x + 7, hor], [x, hor - h]]); }
  } else if (k === "city") drawCity(st, hor, px);
  if (st.landmark) drawLandmark(st, hor, px);
  ctx.globalAlpha = 1;
}

function drawCity(st, hor, px) {
  const night = st.night > 0.1, ox = px * 3;
  const cols = st.bcols || (night ? ["#10132e", "#171b3d", "#0d1030"] : [rgb(mix(st.mc, [0, 0, 0], 0.18)), rgb(mix(st.mc, [0, 0, 0], 0.3)), rgb(mix(st.mc, [255, 255, 255], 0.1))]);
  let x = -20, i = 0;
  while (x < W + 20) {
    const w = 10 + seeded(i + st.seed) * 14, h = (14 + seeded(i * 3 + st.seed) * 40) * (st.cityH || 1);
    ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x + ox, hor - h, w, h);
    if (night) {
      ctx.fillStyle = "rgba(255,220,130,0.9)";
      for (let wy = hor - h + 4; wy < hor - 3; wy += 5) for (let wxx = x + 2; wxx < x + w - 2; wxx += 4) if (seeded(wy * 7 + wxx) > 0.5) ctx.fillRect(wxx + ox, wy, 1.5, 2);
    }
    x += w + 1; i++;
  }
}

function drawLandmark(st, hor, px) {
  const night = st.night > 0.1, ox = px * 2.5;
  switch (st.landmark) {
    case "pearl": { // Shanghai: a tower with two spheres
      const x = W * 0.3 + ox;
      ctx.fillStyle = "#c9cdd6"; ctx.fillRect(x - 1.5, hor - 100, 3, 100); ctx.fillRect(x - 6, hor - 40, 2, 40); ctx.fillRect(x + 4, hor - 40, 2, 40);
      ctx.fillStyle = "#d96aa7"; circle(x, hor - 62, 10); ctx.fillStyle = "#c85a9a"; circle(x, hor - 94, 6);
      break;
    }
    case "flame": { // Baku: three flame-shaped towers
      const x = W * 0.62 + ox;
      [[-15, 70], [0, 82], [15, 62]].forEach(([dx, h], i) => {
        ctx.fillStyle = i === 1 ? "#6fb4dc" : "#86c6e8";
        ctx.beginPath(); ctx.moveTo(x + dx - 9, hor); ctx.quadraticCurveTo(x + dx - 9, hor - h * 0.6, x + dx + (dx < 0 ? -3 : 3), hor - h); ctx.quadraticCurveTo(x + dx + 10, hor - h * 0.5, x + dx + 9, hor); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(x + dx - 4, hor - h * 0.7, 2, h * 0.6);
      });
      break;
    }
    case "mbs": { // Singapore: three towers carrying a deck
      const x = W * 0.42 + ox, c = night ? "#ffe2a8" : "#cfd6e0";
      ctx.fillStyle = c; for (const dx of [-22, 0, 22]) ctx.fillRect(x + dx - 6, hor - 66, 12, 66);
      ctx.fillRect(x - 36, hor - 72, 72, 6); ctx.fillStyle = night ? "#9fe8ff" : "#9fb4c8"; ell(x + 30, hor - 74, 12, 2.5);
      break;
    }
    case "sphere": { // Las Vegas: a glowing orb
      const x = W * 0.42 + ox, hue = (clock * 1.5) % 360;
      ctx.fillStyle = `hsl(${hue},90%,55%)`; circle(x, hor - 34, 28);
      ctx.fillStyle = "rgba(255,255,255,0.3)"; circle(x - 9, hor - 44, 9);
      ctx.fillStyle = "#1c1236"; ctx.fillRect(x - 70, hor - 54, 22, 54); ctx.fillRect(x + 48, hor - 64, 24, 64);
      ctx.fillStyle = `hsl(${(hue + 120) % 360},90%,60%)`; ctx.fillRect(x - 70, hor - 54, 3, 54); ctx.fillRect(x + 48, hor - 64, 3, 64);
      break;
    }
    case "tower": { // Austin: an observation tower
      const x = W * 0.32 + ox;
      ctx.fillStyle = "#c9ccd2"; ctx.fillRect(x - 1.5, hor - 90, 3, 90); ell(x, hor - 74, 11, 3.5); ctx.fillStyle = "#e10600"; ell(x, hor - 90, 2.5, 3);
      break;
    }
    case "hotel": { // Abu Dhabi: the glowing hotel over the marina
      const x = W * 0.55 + ox, hue = (clock * 2) % 360;
      ctx.fillStyle = "#2a2440"; ctx.fillRect(x - 40, hor - 18, 80, 18);
      ctx.fillStyle = `hsl(${hue},85%,60%)`; ctx.fillRect(x - 40, hor - 22, 80, 4);
      ctx.fillStyle = `hsl(${(hue + 90) % 360},85%,60%)`; ctx.fillRect(x - 28, hor - 30, 56, 3);
      break;
    }
  }
}

function drawRoad3D(C) {
  const gA = rgb(pal.grassAlt), roadA = rgb(pal.road), roadB = rgb(mix(pal.road, [0, 0, 0], 0.07));
  ctx.fillStyle = rgb(pal.grass); ctx.fillRect(-20, C.hor, W + 40, H - C.hor + 20);
  const dl = startObj ? C.back + camRefY - startObj.y : -1e9; // where the start line is, in depth
  const dlF = finishObj ? C.back + camRefY - finishObj.y : -1e9; // ...and the finish line
  for (let y = Math.ceil(C.hor) + 1; y < H + 2; y += 2) {
    const d = C.f * C.h / (y - C.hor), sc = C.f / d, zw = d + scrollPos;
    const cx = W / 2 - camOff * C.kx * sc, hw = 160 * C.kx * sc, rw = 10 * C.kx * sc;
    if (Math.floor(zw / 60) % 2) { ctx.fillStyle = gA; ctx.fillRect(0, y, W, 2.6); }
    ctx.fillStyle = Math.floor(zw / 40) % 2 ? "#d62828" : "#f1f1f1";
    ctx.fillRect(cx - hw - rw, y, rw, 2.6); ctx.fillRect(cx + hw, y, rw, 2.6);
    ctx.fillStyle = Math.floor(zw / 50) % 2 ? roadA : roadB; ctx.fillRect(cx - hw, y, 2 * hw, 2.6);
    ctx.fillStyle = "#eee";
    const lw = Math.max(1, 3 * C.kx * sc);
    ctx.fillRect(cx - hw, y, lw, 2.6); ctx.fillRect(cx + hw - lw, y, lw, 2.6);
    if (zw % 40 < 22) { const dw = Math.max(1, 4 * C.kx * sc); for (let l = 1; l < LANES; l++) ctx.fillRect(cx - hw + l * (2 * hw / LANES) - dw / 2, y, dw, 2.6); }
    for (const dd of [dl, dlF]) if (Math.abs(d - dd) < 5) { const rb = d < dd ? 0 : 1; for (let i = 0; i < 12; i++) { ctx.fillStyle = (i + rb) % 2 ? "#111" : "#f4f4f4"; ctx.fillRect(cx - hw + i * 2 * hw / 12, y, 2 * hw / 12 + 0.6, 2.6); } }
  }
}

function toScreen(C, x, y, pad = 0) { // game-space ground point -> screen (null when behind / too close)
  const d = C.back + (camRefY - y) - pad;
  if (d < 6) return null;
  const sc = C.f / (d + pad * 0.5);
  return { d, sc, sx: W / 2 + (x - W / 2 - camOff) * C.kx * sc, sy: C.hor + C.f * C.h / d };
}
const fade3D = (C, d) => clamp((C.back + AHEAD - 60 - d) / 140, 0, 1); // only the very far end of the road fades, far beyond what you can make out

function drawTree3D(s) {
  const r = s.r * 1.25, sway = Math.sin(clock / 50 + s.ph) * (0.6 + wind * 1.2);
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ell(r * 0.25, 0, r * 1.3, r * 0.3);
  if (s.style === "pine") {
    ctx.fillStyle = "#5a4230"; ctx.fillRect(-r * 0.14, -r * 0.8, r * 0.28, r * 0.8);
    for (let i = 0; i < 3; i++) {
      const by = -r * (0.6 + 0.8 * i), hw = r * (1.5 - 0.35 * i), ay = by - r * 1.4, sx = sway * (0.2 + 0.2 * i);
      ctx.fillStyle = rgb(mix(PINE, [0, 0, 0], 0.18)); poly([[-hw, by], [hw, by], [sx, ay]]);
      ctx.fillStyle = rgb(mix(PINE, [255, 255, 255], 0.1)); poly([[-hw, by], [0, by], [sx, ay]]);
    }
  } else if (s.style === "palm") {
    const tx = sway + r * 0.5, ty = -r * 2.8;
    ctx.strokeStyle = "#8a6a44"; ctx.lineWidth = r * 0.3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.5, ty * 0.5, tx, ty); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 1; k < 5; k++) { const t = k / 5; ctx.moveTo(r * (0.5 * t) - 3, ty * t); ctx.lineTo(r * (0.5 * t) + 3, ty * t); } ctx.stroke();
    ctx.lineWidth = 3.4; ctx.strokeStyle = "#2f9a45";
    for (let i = 0; i < 7; i++) { const a = -Math.PI + (i / 6) * Math.PI, ex = tx + Math.cos(a) * r * 1.7, ey = ty + Math.sin(a) * r * 0.9 + r * 0.7; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * r * 0.9, ty + Math.sin(a) * r * 1.2 - r * 0.3, ex, ey); ctx.stroke(); }
    ctx.lineCap = "butt"; ctx.fillStyle = "#6b4a2a"; circle(tx - 2, ty + 3, 2); circle(tx + 2, ty + 3, 2);
  } else if (s.style === "cypress") { // tall slim Italian cypress
    ctx.fillStyle = "#4a3a2a"; ctx.fillRect(-r * 0.08, -r * 0.5, r * 0.16, r * 0.5);
    ctx.fillStyle = rgb(mix(PINE, [0, 0, 0], 0.25)); ctx.beginPath(); ctx.moveTo(0, -r * 3.9); ctx.quadraticCurveTo(r * 0.75, -r * 2, r * 0.45, -r * 0.4); ctx.lineTo(-r * 0.45, -r * 0.4); ctx.quadraticCurveTo(-r * 0.75, -r * 2, 0, -r * 3.9); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 3.7); ctx.quadraticCurveTo(-r * 0.5, -r * 2, -r * 0.3, -r * 0.6); ctx.lineTo(-r * 0.05, -r * 0.6); ctx.fill();
  } else if (s.style === "gum") { // eucalyptus: pale trunk, wispy blue-green tufts
    ctx.fillStyle = "#d3ccbc"; poly([[-r * 0.14, 0], [-r * 0.07, -r * 3], [r * 0.07, -r * 3], [r * 0.14, 0]]); ctx.fillStyle = "rgba(120,100,70,0.35)"; ctx.fillRect(-r * 0.05, -r * 1.4, r * 0.1, r * 0.6);
    const lc = rgb(mix(pal.leaf, [120, 160, 140], 0.45));
    [[-0.7, -2.6, 0.9], [0.7, -3.0, 1.0], [0, -3.5, 0.85], [0.9, -2.2, 0.7], [-0.4, -3.1, 0.8]].forEach(([dx, dy, k]) => { ctx.fillStyle = lc; ell(dx * r + sway * 0.3, dy * r, r * 0.8 * k, r * 0.36 * k); });
  } else if (s.style === "cactus") {
    ctx.fillStyle = "#3f8a4a"; roundRect(-r * 0.3, -r * 2.4, r * 0.6, r * 2.4, r * 0.3); ctx.fill();
    roundRect(-r * 0.95, -r * 1.4, r * 0.7, r * 0.3, r * 0.15); ctx.fill(); roundRect(-r * 0.95, -r * 1.95, r * 0.3, r * 0.85, r * 0.15); ctx.fill();
    roundRect(r * 0.25, -r * 1.1, r * 0.7, r * 0.3, r * 0.15); ctx.fill(); roundRect(r * 0.65, -r * 1.55, r * 0.3, r * 0.75, r * 0.15); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(-r * 0.12, -r * 2.3, r * 0.1, r * 2.1);
  } else { // round
    const tg = ctx.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
    tg.addColorStop(0, "#3e2c1f"); tg.addColorStop(0.5, "#6b4e37"); tg.addColorStop(1, "#3a291d");
    ctx.fillStyle = tg; poly([[-r * 0.28, 0], [-r * 0.12, -r * 1.8], [r * 0.12, -r * 1.8], [r * 0.28, 0]]);
    const cy = -r * 2.2;
    ctx.fillStyle = rgb(mix(pal.leaf, [0, 0, 0], 0.25)); circle(r * 0.35 + sway * 0.3, cy + r * 0.35, r * 0.95); circle(-r * 0.45 + sway * 0.3, cy + r * 0.25, r * 0.85);
    ctx.fillStyle = rgb(mix(pal.leaf, [0, 0, 0], 0.08)); circle(sway * 0.3, cy, r * 1.15);
    ctx.fillStyle = rgb(mix(pal.leaf, [255, 255, 255], 0.28), 0.8); circle(-r * 0.35 + sway * 0.3, cy - r * 0.4, r * 0.6);
    if (s.style === "fruit" && s.fruit) { ctx.fillStyle = s.fruit; for (let i = 0; i < 9; i++) circle(Math.cos(i * 2.4) * r * 0.85, cy + Math.sin(i * 2.4) * r * 0.7, 2.2); } // oranges, lemons, pomegranates
  }
}

function drawFlag3D(s) {
  ctx.fillStyle = "#cfd2d8"; ctx.fillRect(-1, -58, 2, 58); circle(0, -59, 2);
  ctx.save(); ctx.translate(1, -57); ctx.transform(1, Math.sin(clock / 14 + s.ph) * 0.05, 0, 1, 0, 0); drawFlag(s.flag, 28, 18); ctx.restore();
}

function drawBoard3D(s) {
  const [name, col] = s.sponsor, w = 70, h = 24;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ell(4, 0, 38, 4);
  ctx.fillStyle = "#44474d"; ctx.fillRect(-w / 2 + 6, -h - 8, 3, h + 8); ctx.fillRect(w / 2 - 9, -h - 8, 3, h + 8);
  ctx.fillStyle = "#16171a"; roundRect(-w / 2 - 2, -h - 12, w + 4, h + 4, 3); ctx.fill();
  ctx.fillStyle = col; roundRect(-w / 2, -h - 10, w, h, 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(-w / 2, -h - 10, w, 3);
  ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = col === "#ffcc00" ? "#16171a" : "#fff"; ctx.fillText(name, 0, -h - 10 + h / 2 + 4, w - 6); // (squeezed to fit the board)
}

function drawStand3D(s) {
  const w = 90, rows = 3, rh = 10;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ell(6, 0, w * 0.6, 5);
  for (let i = 0; i < rows; i++) {
    const wid = w - i * 5, y0 = -i * rh;
    ctx.fillStyle = i % 2 ? "#7c818a" : "#8c919a"; ctx.fillRect(-wid / 2, y0 - rh, wid, rh);
    for (let j = 0; j < 14; j++) {
      const cx = -wid / 2 + 4 + j * (wid - 8) / 13, bob = Math.sin(clock * 0.16 + j * 1.7 + i) * 0.8;
      ctx.fillStyle = s.crowd[i][j]; ell(cx, y0 - rh * 0.4 + bob * 0.5, 2.6, 3.2); ctx.fillStyle = "#f0c8a0"; circle(cx, y0 - rh * 0.8 + bob, 1.5);
    }
  }
  const ty = -rows * rh - 18;
  ctx.fillStyle = "#2a2d34"; ctx.fillRect(-w / 2 - 4, ty, w + 8, 5); ctx.fillStyle = s.roofColor; ctx.fillRect(-w / 2 - 4, ty, w + 8, 2);
  ctx.fillStyle = "#555"; ctx.fillRect(-w / 2, ty + 5, 2.4, rows * rh + 13); ctx.fillRect(w / 2 - 2.4, ty + 5, 2.4, rows * rh + 13);
}

function drawBuilding3D(s) {
  const { bw: w, bh: h } = s, night = pal.dark > 0.08;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ell(6, 0, w * 0.7, 4);
  ctx.fillStyle = s.bcol; ctx.fillRect(-w / 2, -h, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(w * 0.15, -h, w * 0.35, h);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(-w / 2, -h, w, 3);
  for (let wy = -h + 8; wy < -6; wy += 8) for (let wxx = -w / 2 + 4; wxx < w / 2 - 4; wxx += 7) {
    const lit = night && seeded(wy * 3 + wxx * 5 + s.ph) > 0.45;
    ctx.fillStyle = night ? (lit ? "rgba(255,222,140,0.95)" : "rgba(20,24,50,0.6)") : "rgba(190,215,240,0.75)";
    ctx.fillRect(wxx, wy, 4, 4);
  }
}

function drawLamp3D(s) {
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ell(2, 0, 6, 1.5);
  ctx.fillStyle = "#3a3d44"; ctx.fillRect(-1, -46, 2, 46);
  ctx.strokeStyle = "#3a3d44"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -46); ctx.quadraticCurveTo(-s.side * 4, -52, -s.side * 12, -50); ctx.stroke();
  ctx.fillStyle = "#e8e8ee"; ell(-s.side * 12, -49, 4, 1.8);
  if (pal.dark > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(-s.side * 12, -47, 1, -s.side * 12, -40, 40);
    g.addColorStop(0, `rgba(255,214,130,${Math.min(0.9, pal.dark * 4.5)})`); g.addColorStop(1, "rgba(255,214,130,0)");
    ctx.fillStyle = g; ctx.fillRect(-s.side * 12 - 40, -87, 80, 90); ctx.restore();
  }
}

// ---- the main attractions of every country (origin = ground centre, up is negative y) ----

const lit = () => clamp(pal.dark * 4, 0, 1); // 0 by day .. ~1 at night
function box(x, y, w, h, col) { // a shaded block standing on y
  ctx.fillStyle = col; ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x, y - h, w * 0.3, h);
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(x + w * 0.65, y - h, w * 0.35, h);
}
function windows(x, y, w, h, gx, gy, seed) {
  const n = lit();
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    const on = seeded(seed + i * 7 + j * 13) > 0.45;
    ctx.fillStyle = n > 0.2 ? (on ? "rgba(255,222,140,0.95)" : "rgba(18,22,50,0.7)") : "rgba(170,200,230,0.8)";
    ctx.fillRect(x + (i + 0.25) * w / gx, y - h + (j + 0.25) * h / gy, w / gx * 0.5, h / gy * 0.5);
  }
}
function dome(cx, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, y, r, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.arc(cx - r * 0.25, y - r * 0.15, r * 0.6, Math.PI * 1.1, Math.PI * 1.75); ctx.lineTo(cx - r * 0.25, y - r * 0.15); ctx.fill();
}
function spire(cx, y, w, h, col) { ctx.fillStyle = col; poly([[cx - w / 2, y], [cx + w / 2, y], [cx, y - h]]); ctx.fillStyle = "rgba(0,0,0,0.18)"; poly([[cx, y], [cx + w / 2, y], [cx, y - h]]); }
// glows are drawn from a radial-gradient sprite made once per colour (instead of building a new gradient every call)
const glowSprites = {};
// every "r,g,b" colour string in this script (the glow colours), so the menus can build their sprites ahead of time, one a frame
const GLOW_PREWARM = [...new Set((document.currentScript ? document.currentScript.textContent : "").match(/"\d{1,3},\d{1,3},\d{1,3}"/g) || [])].map(s => s.slice(1, -1));
function glowSprite(col) {
  let c = glowSprites[col];
  if (!c) {
    c = glowSprites[col] = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  return c;
}
function glow(x, y, r, col, a) {
  if (settings.lowfx) { ctx.fillStyle = `rgba(${col},${a * 0.35})`; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, TAU); ctx.fill(); return; } // reduced effects: a cheap dot instead of a gradient
  if (a <= 0.003 || r <= 0) return;
  const pa = ctx.globalAlpha, pc = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = pa * Math.min(1, a);
  ctx.drawImage(glowSprite(col), x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = pa; ctx.globalCompositeOperation = pc;
}
function arches(x, y, w, h, n, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) { const ax = x + (i + 0.5) * w / n, aw = w / n * 0.62; ctx.beginPath(); ctx.moveTo(ax - aw / 2, y); ctx.lineTo(ax - aw / 2, y - h + aw / 2); ctx.arc(ax, y - h + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw / 2, y); ctx.closePath(); ctx.fill(); }
}
function shadowAt(w) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ell(w * 0.1, 0, w * 0.6, Math.max(3, w * 0.07)); }
function water(w, h) {
  const g = ctx.createLinearGradient(0, -h, 0, h); g.addColorStop(0, "#6fb6dc"); g.addColorStop(1, "#2f6f9f");
  ctx.fillStyle = g; ell(0, 0, w, h); ctx.fillStyle = "rgba(255,255,255,0.25)"; ell(-w * 0.3, -h * 0.2, w * 0.3, h * 0.18);
}
function wheel(r, rim, capCol, legCol, n) {
  const cy = -r - 8, rot = clock * 0.004;
  ctx.strokeStyle = legCol; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(0, cy); ctx.lineTo(r * 0.5, 0); ctx.stroke();
  ctx.strokeStyle = rim; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, cy, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 0.8; ctx.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * TAU + rot; ctx.moveTo(0, cy); ctx.lineTo(Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.stroke();
  for (let i = 0; i < n; i++) { const a = i / n * TAU + rot; ctx.fillStyle = capCol(i); circle(Math.cos(a) * r, cy + Math.sin(a) * r, 3.4); }
  if (lit() > 0.2) glow(0, cy, r * 1.1, "255,230,160", 0.35 * lit());
}

const LMS = {
  // ----- Australia -----
  opera: () => { // Sydney Opera House
    water(100, 9); ctx.fillStyle = "#cfd3d8"; ctx.fillRect(-72, -10, 144, 10); ctx.fillStyle = "#b6bbc2"; ctx.fillRect(-72, -4, 144, 4);
    const sh = (x, w, h, f) => { ctx.fillStyle = "#f4f1ea"; ctx.beginPath(); ctx.moveTo(x, -10); ctx.quadraticCurveTo(x + f * w * 0.1, -10 - h * 1.05, x + f * w, -10 - h * 0.05); ctx.lineTo(x + f * w, -10); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(150,150,160,0.55)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + f * w * 0.1, -10 - h * 0.3); ctx.quadraticCurveTo(x + f * w * 0.3, -10 - h * 0.7, x + f * w * 0.8, -10 - h * 0.1); ctx.stroke(); };
    sh(-62, 46, 56, 1); sh(-44, 44, 74, 1); sh(-26, 42, 92, 1); sh(64, 40, 46, -1); sh(48, 38, 62, -1); sh(32, 36, 76, -1);
    if (lit() > 0.2) glow(0, -30, 90, "255,225,170", 0.3 * lit());
  },
  bridge: () => { // Sydney Harbour Bridge
    water(110, 8);
    ctx.fillStyle = "#8a8f96"; ctx.fillRect(-98, -54, 16, 54); ctx.fillRect(82, -54, 16, 54); ctx.fillStyle = "#6b7078"; ctx.fillRect(-98, -58, 16, 5); ctx.fillRect(82, -58, 16, 5);
    ctx.strokeStyle = "#6e7680"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-90, -30); ctx.quadraticCurveTo(0, -150, 90, -30); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-90, -26); ctx.quadraticCurveTo(0, -118, 90, -26); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "#7d858e"; ctx.beginPath(); for (let i = -7; i <= 7; i++) { const x = i * 11; ctx.moveTo(x, -30 - (1 - (x / 90) ** 2) * 58); ctx.lineTo(x, -22); } ctx.stroke();
    ctx.fillStyle = "#3a3d44"; ctx.fillRect(-102, -24, 204, 4);
  },
  // ----- China -----
  pearl: () => { // Oriental Pearl Tower
    shadowAt(40); ctx.strokeStyle = "#c9ced8"; ctx.lineWidth = 4; ctx.beginPath(); for (const dx of [-22, 0, 22]) { ctx.moveTo(dx, 0); ctx.lineTo(dx * 0.35, -92); } ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(0, -198); ctx.stroke();
    const ball = (y, r, c1, c2) => { const g = ctx.createRadialGradient(-r * 0.3, y - r * 0.3, 1, 0, y, r); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; circle(0, y, r); };
    ball(-70, 15, "#ff9ad0", "#a8458f"); ball(-108, 11, "#ffb4dc", "#b2509a"); ball(-150, 8, "#ff9ad0", "#9a3f86"); ball(-182, 5, "#ffb4dc", "#9a3f86");
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -70, 15, 0.2, 2.9); ctx.stroke();
    if (lit() > 0.2) { glow(0, -70, 38, "255,120,200", 0.5 * lit()); glow(0, -150, 24, "255,120,200", 0.4 * lit()); }
  },
  shtower: () => { // Shanghai Tower, twisting as it climbs
    shadowAt(30);
    for (let i = 0; i < 12; i++) {
      const t = i / 12, w = lerp(38, 12, t), x = Math.sin(t * 2.6) * 7 - w / 2, y = -i * 15, g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, "#7fa2c4"); g.addColorStop(0.5, "#cfe3f4"); g.addColorStop(1, "#6a8db0"); ctx.fillStyle = g; ctx.fillRect(x, y - 16, w, 16);
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(x, y - 16, w, 2);
      if (lit() > 0.2) { ctx.fillStyle = `rgba(255,230,160,${0.7 * lit()})`; for (let k = 0; k < 4; k++) ctx.fillRect(x + 3 + k * (w - 6) / 4, y - 12, 2, 8); }
    }
    ctx.fillStyle = "#cfd6df"; ctx.fillRect(Math.sin(2.6 * 11 / 12) * 7 - 0.7, -12 * 15 - 14, 1.5, 14);
  },
  // ----- Japan -----
  pagoda: () => { // five-storey pagoda
    shadowAt(60);
    for (let i = 0; i < 5; i++) {
      const w = 46 - i * 6, y = -i * 26;
      box(-w / 2 + 3, y, w - 6, 20, "#b03a2e");
      ctx.fillStyle = "#3b4650"; ctx.beginPath(); ctx.moveTo(-w / 2 - 14, y - 16); ctx.quadraticCurveTo(-w / 2 - 4, y - 19, -w / 2 + 2, y - 27); ctx.lineTo(w / 2 - 2, y - 27); ctx.quadraticCurveTo(w / 2 + 4, y - 19, w / 2 + 14, y - 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#222c34"; ctx.fillRect(-w / 2 - 12, y - 18, w + 24, 2);
    }
    ctx.fillStyle = "#d4af37"; ctx.fillRect(-1, -158, 2, 26); for (let k = 0; k < 4; k++) ell(0, -140 - k * 5, 4, 1.2);
  },
  ferriswheel: () => { shadowAt(60); wheel(56, "#d9dde4", i => ["#e8505b", "#f4c542", "#4aa3df", "#6cc070"][i % 4], "#9aa3ad", 18); }, // a big funfair Ferris wheel
  // ----- USA: Miami -----
  artdeco: () => { // South Beach art-deco hotel
    shadowAt(70); box(-40, 0, 80, 54, "#f2b8c6"); box(-40, -54, 80, 8, "#7fd6d0"); box(-30, -62, 60, 16, "#f6e4b8"); ctx.fillStyle = "#fff"; ctx.fillRect(-5, -118, 10, 56);
    windows(-40, 0, 80, 54, 8, 5, 3); windows(-30, -46, 60, 16, 6, 1, 9);
    ctx.fillStyle = "#33f0ff"; ctx.fillRect(-40, -56, 80, 2.5); ctx.fillRect(-30, -63, 60, 2);
    ctx.save(); ctx.translate(0, -90); ctx.rotate(-Math.PI / 2); ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#ff4fa0"; ctx.fillText("MIAMI", 0, 3); ctx.restore();
    glow(0, -56, 60, "50,240,255", 0.25 + 0.35 * lit());
  },
  freedomtower: () => { // Freedom Tower
    shadowAt(40); box(-28, 0, 56, 42, "#e8d9b8"); box(-17, -42, 34, 72, "#efe2c4"); arches(-17, -42, 34, 24, 3, "#8a6a4a"); arches(-17, -74, 34, 24, 3, "#8a6a4a");
    box(-12, -114, 24, 14, "#e8d9b8"); arches(-12, -114, 24, 12, 2, "#8a6a4a"); ctx.fillStyle = "#b5472f"; poly([[-14, -128], [14, -128], [0, -156]]); ctx.fillStyle = "#d4af37"; ctx.fillRect(-0.8, -168, 1.6, 12);
    if (lit() > 0.2) glow(0, -100, 50, "255,220,150", 0.35 * lit());
  },
  // ----- Canada -----
  biosphere: () => { // Montreal Biosphere
    shadowAt(70); const cy = -58, r = 50, g = ctx.createRadialGradient(-16, cy - 16, 4, 0, cy, r);
    g.addColorStop(0, "#f2f6fa"); g.addColorStop(1, "#8a9bb0"); ctx.fillStyle = g; circle(0, cy, r);
    ctx.save(); ctx.beginPath(); ctx.arc(0, cy, r, 0, TAU); ctx.clip(); ctx.strokeStyle = "rgba(60,80,110,0.55)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = -4; i <= 4; i++) { ctx.moveTo(-r, cy + i * 11); ctx.lineTo(r, cy + i * 11 + 6); ctx.moveTo(i * 12, cy - r); ctx.lineTo(i * 12 + 18, cy + r); ctx.moveTo(i * 12, cy - r); ctx.lineTo(i * 12 - 18, cy + r); }
    ctx.stroke(); ctx.restore(); ctx.fillStyle = "#6a7686"; ctx.fillRect(-18, -8, 36, 8);
    if (lit() > 0.2) glow(0, cy, 70, "170,210,255", 0.3 * lit());
  },
  olympictower: () => { // Montreal Tower and the Olympic Stadium
    shadowAt(120); ctx.fillStyle = "#b9bcc2"; ctx.fillRect(-64, -16, 128, 16); ctx.fillStyle = "#a6a9b0"; ell(0, -16, 64, 8);
    ctx.fillStyle = "#cfd2d8"; poly([[-8, -14], [10, -14], [50, -186], [41, -190]]); ctx.fillStyle = "rgba(0,0,0,0.15)"; poly([[10, -14], [50, -186], [41, -190]]);
    ctx.strokeStyle = "rgba(220,224,230,0.85)"; ctx.lineWidth = 1; for (const x of [-56, -26, 24, 56]) { ctx.beginPath(); ctx.moveTo(46, -176); ctx.lineTo(x, -18); ctx.stroke(); }
    ctx.fillStyle = "#9aa0aa"; ctx.fillRect(38, -194, 14, 6);
  },
  // ----- Monaco -----
  casino: () => { // Monte-Carlo Casino
    shadowAt(130); box(-62, 0, 124, 52, "#efe3c6"); box(-44, -52, 88, 16, "#e6d8b6"); arches(-56, -2, 112, 30, 7, "#7a6a48"); windows(-56, -34, 112, 14, 9, 1, 5);
    for (const sx of [-1, 1]) { box(sx * 62 - 12, -52, 24, 46, "#efe3c6"); dome(sx * 62, -98, 13, "#4f9a82"); ctx.fillStyle = "#d4af37"; ctx.fillRect(sx * 62 - 1, -120, 2, 9); }
    ctx.fillStyle = "#e6d8b6"; poly([[-26, -52], [26, -52], [0, -74]]); dome(0, -74, 11, "#4f9a82");
    if (lit() > 0.2) glow(0, -40, 90, "255,225,160", 0.4 * lit());
  },
  palace: () => { // the Prince's Palace on its rock
    ctx.fillStyle = "#9a9486"; poly([[-86, 0], [-56, -42], [-12, -58], [40, -54], [78, -32], [94, 0]]); ctx.fillStyle = "rgba(0,0,0,0.15)"; poly([[10, 0], [40, -54], [78, -32], [94, 0]]);
    box(-38, -54, 72, 30, "#f0e6d0"); box(-12, -84, 24, 30, "#e8dcc2"); ctx.fillStyle = "#e8dcc2"; for (let i = 0; i < 6; i++) ctx.fillRect(-12 + i * 4.2, -88, 2.4, 4);
    box(32, -54, 16, 46, "#f0e6d0"); spire(40, -100, 20, 16, "#c0563c"); windows(-38, -54, 72, 30, 8, 2, 11);
    ctx.fillStyle = "#c8102e"; ctx.fillRect(0, -104, 12, 6); ctx.fillStyle = "#ddd"; ctx.fillRect(-1, -110, 1.6, 26);
  },
  // ----- Spain: Barcelona -----
  sagrada: () => { // Sagrada Familia
    shadowAt(150);
    for (const [x, h, w] of [[-58, 120, 14], [-38, 150, 15], [-13, 180, 17], [14, 194, 18], [40, 160, 15], [60, 128, 14]]) {
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, "#d9bd90"); g.addColorStop(1, "#a88a5e"); ctx.fillStyle = g;
      poly([[x - w / 2, -30], [x + w / 2, -30], [x + w * 0.28, -h + 14], [x - w * 0.28, -h + 14]]); poly([[x - w * 0.34, -h + 14], [x + w * 0.34, -h + 14], [x, -h - 8]]);
      ctx.fillStyle = "rgba(40,30,20,0.35)"; for (let k = 0; k < 6; k++) ctx.fillRect(x - 1.2, -38 - k * (h - 56) / 6, 2.4, 8);
      ctx.fillStyle = ["#e0594a", "#f0b840", "#59a5d8"][Math.abs(Math.round(x)) % 3]; circle(x, -h - 10, 3);
    }
    box(-72, 0, 144, 46, "#c3a276"); arches(-66, 0, 132, 26, 9, "#6a5236");
    ctx.strokeStyle = "#e8b020"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(86, 0); ctx.lineTo(86, -160); ctx.lineTo(30, -160); ctx.moveTo(86, -160); ctx.lineTo(100, -160); ctx.stroke();
    if (lit() > 0.2) glow(0, -100, 100, "255,215,150", 0.25 * lit());
  },
  torreglories: () => { // Torre Glories
    shadowAt(40); const w = 34, g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, "#d4423a"); g.addColorStop(0.5, "#6fa5e0"); g.addColorStop(1, "#3a63b8");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -120); ctx.quadraticCurveTo(0, -178, w / 2, -120); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)"; for (let y = -10; y > -130; y -= 9) ctx.fillRect(-w / 2, y, w, 1.5);
    if (lit() > 0.2) glow(0, -100, 56, `${120 + 80 * Math.sin(clock / 30)},180,255`, 0.4 * lit());
  },
  // ----- Austria -----
  church: () => { // village church with an onion dome
    shadowAt(80); box(-52, 0, 66, 40, "#f3efe6"); ctx.fillStyle = "#b5472f"; poly([[-58, -40], [24, -40], [-17, -64]]);
    box(18, 0, 24, 88, "#f3efe6"); box(15, -88, 30, 6, "#e8e2d4");
    ctx.fillStyle = "#3d8a72"; ctx.beginPath(); ctx.moveTo(18, -94); ctx.quadraticCurveTo(8, -112, 30, -128); ctx.quadraticCurveTo(52, -112, 42, -94); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d4af37"; ctx.fillRect(29, -146, 2, 18); ctx.fillRect(25, -140, 10, 2); ctx.fillStyle = "#8a6a4a"; roundRect(-8, -22, 14, 22, 7); ctx.fill();
    windows(-52, -6, 52, 26, 4, 1, 6); ctx.fillStyle = "#cfd8de"; circle(30, -70, 5);
  },
  fortress: () => { // hilltop fortress
    ctx.fillStyle = "#8f8a7e"; poly([[-92, 0], [-62, -52], [-22, -68], [32, -64], [72, -42], [98, 0]]); ctx.fillStyle = "#4f9a46"; poly([[-62, -52], [-22, -68], [32, -64], [72, -42], [64, -38], [28, -58], [-22, -62], [-56, -46]]);
    box(-58, -52, 112, 26, "#efe9dc"); for (const x of [-62, 40]) { box(x, -52, 16, 44, "#efe9dc"); spire(x + 8, -96, 20, 18, "#b5472f"); }
    box(-14, -78, 36, 40, "#f4efe4"); spire(4, -118, 44, 24, "#b5472f"); ctx.fillStyle = "#c8102e"; ctx.fillRect(5, -150, 10, 5); ctx.fillStyle = "#ddd"; ctx.fillRect(4, -156, 1.4, 20);
    windows(-58, -52, 112, 26, 10, 2, 8);
  },
  // ----- Great Britain -----
  bigben: () => { // Elizabeth Tower and the Palace of Westminster
    shadowAt(90); box(-66, 0, 78, 52, "#cdb68a"); arches(-62, 0, 70, 28, 7, "#6b5a3e"); windows(-66, -28, 78, 20, 8, 1, 7);
    for (let i = 0; i < 5; i++) spire(-60 + i * 16, -52, 7, 16, "#bfa77a");
    const tx = 20; box(tx - 13, 0, 26, 130, "#d6bf92"); ctx.fillStyle = "#c4ab7c"; ctx.fillRect(tx - 16, -130, 32, 22);
    ctx.fillStyle = "#f4f1e6"; circle(tx, -96, 9); ctx.strokeStyle = "#3a3a3a"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(tx, -96); ctx.lineTo(tx + Math.cos(clock * 0.01) * 6, -96 + Math.sin(clock * 0.01) * 6); ctx.moveTo(tx, -96); ctx.lineTo(tx + 2, -102); ctx.stroke();
    if (lit() > 0.2) glow(tx, -96, 28, "255,230,150", 0.8 * lit());
    ctx.fillStyle = "#4a6a5a"; poly([[tx - 15, -152], [tx + 15, -152], [tx, -194]]); ctx.fillStyle = "#d4af37"; ctx.fillRect(tx - 0.8, -208, 1.6, 14);
  },
  towerbridge: () => { // Tower Bridge
    water(104, 8);
    for (const sx of [-1, 1]) { const x = sx * 40; box(x - 12, 0, 24, 96, "#9ea6b0"); for (const tx of [-9, 9]) spire(x + tx, -96, 8, 16, "#6a7684"); spire(x, -96, 12, 22, "#6a7684"); windows(x - 12, 0, 24, 96, 2, 7, sx * 9 + 5); }
    ctx.fillStyle = "#2f6fb0"; ctx.fillRect(-28, -80, 56, 5); ctx.fillRect(-28, -86, 56, 2);
    ctx.strokeStyle = "#2f6fb0"; ctx.lineWidth = 2; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 40, -96); ctx.quadraticCurveTo(sx * 74, -50, sx * 98, -26); ctx.stroke(); }
    ctx.fillStyle = "#2f6fb0"; ctx.fillRect(-102, -28, 204, 4);
    if (lit() > 0.2) glow(0, -80, 90, "120,170,255", 0.3 * lit());
  },
  londoneye: () => { shadowAt(70); wheel(62, "#eef1f5", () => "#dfe6ee", "#c9d0d8", 22); }, // London Eye
  // ----- Belgium -----
  atomium: () => { // the Atomium
    shadowAt(70); const S = [[0, -166], [-52, -122], [52, -122], [0, -122], [-52, -70], [52, -70], [0, -70], [0, -28], [0, -96]];
    ctx.strokeStyle = "#aab4c0"; ctx.lineWidth = 5; ctx.beginPath();
    for (const [a, b] of [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [1, 4], [2, 5], [3, 6], [4, 6], [5, 6], [4, 5], [6, 7], [4, 7], [5, 7]]) { ctx.moveTo(S[a][0], S[a][1]); ctx.lineTo(S[b][0], S[b][1]); }
    ctx.stroke();
    for (const [x, y] of S) { const g = ctx.createRadialGradient(x - 5, y - 5, 1, x, y, 15); g.addColorStop(0, "#fafcff"); g.addColorStop(0.6, "#b9c4d2"); g.addColorStop(1, "#707c8c"); ctx.fillStyle = g; circle(x, y, 14); }
    if (lit() > 0.2) glow(0, -100, 100, "200,220,255", 0.3 * lit());
  },
  belfry: () => { // medieval belfry
    shadowAt(50); box(-20, 0, 40, 100, "#a65a3c"); box(-23, -100, 46, 14, "#9a5236"); ctx.fillStyle = "#9a5236"; for (let i = 0; i < 6; i++) ctx.fillRect(-23 + i * 8.4, -108, 5, 8);
    box(-15, -114, 30, 32, "#a65a3c"); ctx.fillStyle = "#566a68"; poly([[-17, -146], [17, -146], [0, -188]]);
    ctx.fillStyle = "#e8e4d6"; circle(0, -70, 8); ctx.strokeStyle = "#333"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, -75); ctx.moveTo(0, -70); ctx.lineTo(4, -68); ctx.stroke();
    ctx.fillStyle = "#2a1a18"; roundRect(-4, -30, 8, 18, 4); ctx.fill(); windows(-15, -84, 30, 24, 3, 1, 4);
  },
  // ----- Hungary -----
  parliament: () => { // Hungarian Parliament
    water(116, 7); box(-96, -4, 192, 46, "#e9e2d2"); arches(-92, -4, 184, 28, 18, "#7d7260");
    for (let i = -4; i <= 4; i++) if (i) spire(i * 20, -50, 8, 24, "#d9d1be");
    box(-26, -4, 52, 74, "#efe8d8"); ctx.fillStyle = "#cfc6b0"; ctx.beginPath(); ctx.moveTo(-24, -78); ctx.quadraticCurveTo(0, -122, 24, -78); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b53a2c"; ctx.beginPath(); ctx.moveTo(-18, -80); ctx.quadraticCurveTo(0, -130, 18, -80); ctx.fill(); spire(0, -118, 6, 40, "#d9d1be"); ctx.fillStyle = "#d4af37"; circle(0, -160, 2.4);
    for (const sx of [-1, 1]) { box(sx * 90 - 8, -4, 16, 66, "#efe8d8"); spire(sx * 90, -70, 16, 34, "#d9d1be"); }
    windows(-90, -2, 180, 28, 20, 2, 3); if (lit() > 0.2) glow(0, -50, 120, "255,215,150", 0.3 * lit());
  },
  chainbridge: () => { // Szechenyi Chain Bridge
    water(104, 8);
    for (const sx of [-1, 1]) { const x = sx * 46; box(x - 11, 0, 22, 76, "#d8d2c0"); arches(x - 9, 0, 18, 32, 1, "#6e6858"); box(x - 13, -76, 26, 8, "#cfc9b6"); spire(x, -84, 14, 14, "#cfc9b6"); }
    ctx.strokeStyle = "#454a52"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-46, -74); ctx.quadraticCurveTo(0, -26, 46, -74); ctx.moveTo(-104, -26); ctx.quadraticCurveTo(-74, -58, -46, -74); ctx.moveTo(104, -26); ctx.quadraticCurveTo(74, -58, 46, -74); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); for (let i = -4; i <= 4; i++) { const x = i * 10, ty = -26 - (1 - (x / 46) ** 2) * 0; ctx.moveTo(x, -50 + (x / 46) ** 2 * 24 - 0); ctx.lineTo(x, -26); } ctx.stroke();
    ctx.fillStyle = "#3a3d44"; ctx.fillRect(-106, -26, 212, 4); if (lit() > 0.2) glow(0, -50, 100, "255,220,150", 0.3 * lit());
  },
  // ----- Netherlands -----
  dutchmill: () => { // traditional Dutch windmill
    shadowAt(70); ctx.fillStyle = "#3a2c22"; poly([[-26, 0], [26, 0], [16, -82], [-16, -82]]); ctx.fillStyle = "rgba(255,255,255,0.1)"; poly([[-26, 0], [0, 0], [0, -82], [-16, -82]]);
    ctx.fillStyle = "#f2efe6"; ctx.fillRect(-22, -24, 44, 5); ctx.fillStyle = "#7a5a3a"; roundRect(-6, -18, 12, 18, 6); ctx.fill(); ctx.fillStyle = "#e8e2d0"; ctx.fillRect(-4, -54, 8, 10);
    ctx.fillStyle = "#6e5a3c"; poly([[-20, -82], [20, -82], [0, -108]]);
    ctx.save(); ctx.translate(0, -90); ctx.rotate(clock * 0.011 + 1); for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = "#4a3a2c"; ctx.fillRect(0, -1.5, 68, 3); ctx.fillStyle = "rgba(250,246,232,0.95)"; ctx.fillRect(10, -13, 54, 13); ctx.strokeStyle = "#8a7a5a"; ctx.lineWidth = 0.8; ctx.beginPath(); for (let j = 0; j < 7; j++) { ctx.moveTo(10 + j * 8, -13); ctx.lineTo(10 + j * 8, 0); } ctx.stroke(); }
    ctx.fillStyle = "#2a1f18"; circle(0, 0, 5); ctx.restore();
  },
  canalhouses: () => { // gabled canal houses
    water(86, 6); const cols = ["#a8442f", "#e8d6a8", "#2f4f78", "#c98a3c"];
    cols.forEach((c, i) => {
      const x = -64 + i * 33, h = 74 + (i % 2) * 16; box(x, 0, 31, h, c); ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(x, -h); ctx.quadraticCurveTo(x + 4, -h - 10, x + 10, -h - 12); ctx.lineTo(x + 21, -h - 12); ctx.quadraticCurveTo(x + 27, -h - 10, x + 31, -h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(x, -h, 31, 3); windows(x, 0, 31, h, 2, 4, i * 11 + 2); ctx.fillStyle = "#222"; ctx.fillRect(x + 14, -h - 18, 3, 7);
    });
  },
  // ----- Italy -----
  colosseum: () => { // the Colosseum
    shadowAt(180); const w = 160;
    const silh = () => { ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -78); ctx.lineTo(w * 0.16, -78); ctx.lineTo(w * 0.26, -62); ctx.lineTo(w * 0.38, -54); ctx.lineTo(w / 2, -40); ctx.lineTo(w / 2, 0); ctx.closePath(); };
    silh(); ctx.fillStyle = "#d8c196"; ctx.fill(); ctx.save(); silh(); ctx.clip();
    for (let t = 0; t < 3; t++) { arches(-w / 2 + 2, -t * 22, w - 4, 20, 16, "#7a6444"); ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.fillRect(-w / 2, -t * 22 - 2, w, 2.5); }
    ctx.fillStyle = "#8a7048"; for (let i = 0; i < 12; i++) ctx.fillRect(-w / 2 + 6 + i * 11.5, -74, 4, 6);
    ctx.fillStyle = "rgba(0,0,0,0.1)"; ctx.fillRect(w * 0.1, -80, w * 0.45, 80); ctx.restore();
  },
  pisa: () => { // Leaning Tower of Pisa and the cathedral
    shadowAt(120); box(-76, 0, 76, 38, "#f1ede2"); arches(-72, 0, 68, 18, 8, "#bcb59f"); box(-60, -38, 48, 18, "#ece7da"); dome(-36, -56, 14, "#c8c2b0");
    ctx.save(); ctx.translate(38, 0); ctx.rotate(0.07);
    for (let i = 0; i < 8; i++) { const y = -i * 14, w = i === 7 ? 18 : 26; box(-w / 2, y, w, 14, "#f6f3ea"); ctx.fillStyle = "rgba(90,80,60,0.45)"; for (let k = 0; k < 6; k++) ctx.fillRect(-w / 2 + 2 + k * (w - 4) / 6, y - 12, 2, 10); }
    ctx.fillStyle = "#e0dccc"; ctx.fillRect(-7, -124, 14, 8); ctx.restore();
  },
  // ----- Spain: Madrid -----
  alcala: () => { // Puerta de Alcala
    shadowAt(130); const st = "#d9d2c2"; box(-62, 0, 124, 52, st); ctx.fillStyle = "#3a352c"; arches(-14, 0, 28, 40, 1, "#2e2a22"); ctx.fillRect(-50, -34, 18, 34); ctx.fillRect(32, -34, 18, 34);
    ctx.fillStyle = "rgba(255,255,255,0.4)"; for (const x of [-56, -26, 22, 52]) ctx.fillRect(x, -48, 5, 48);
    box(-62, -52, 124, 16, st); ctx.fillStyle = "#cfc8b6"; poly([[-20, -68], [20, -68], [0, -84]]); ctx.fillStyle = "#6a6558"; for (const x of [-40, 0, 40]) ell(x, -76, 4, 5);
  },
  kiotowers: () => { // Puerta de Europa: two leaning towers
    shadowAt(80);
    for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * 30, 0); ctx.transform(1, 0, sx * 0.12, 1, 0, 0); box(-14, 0, 28, 150, "#8aa4c2"); windows(-14, 0, 28, 150, 4, 14, sx * 6 + 4); box(-14, -150, 28, 12, "#4a5a70"); ctx.restore(); }
    if (lit() > 0.2) glow(0, -80, 100, "150,190,255", 0.25 * lit());
  },
  // ----- Azerbaijan -----
  flame: () => { // the Flame Towers
    shadowAt(80);
    [[-30, 120, 40], [4, 152, 46], [38, 104, 36]].forEach(([x, h, w], i) => {
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, "#5a8fb8"); g.addColorStop(0.5, "#bfe6f7"); g.addColorStop(1, "#4a7aa0"); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - w / 2, 0); ctx.bezierCurveTo(x - w / 2, -h * 0.5, x - w * 0.1, -h * 0.8, x + (i - 1) * 4, -h); ctx.bezierCurveTo(x + w * 0.6, -h * 0.7, x + w / 2, -h * 0.4, x + w / 2, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 1; k < 7; k++) { ctx.moveTo(x - w / 2 + 3, -k * h / 7); ctx.lineTo(x + w / 2 - 3, -k * h / 7 - 4); } ctx.stroke();
      if (lit() > 0.2) glow(x, -h * 0.6, 46, "255,110,40", 0.7 * lit() * (0.7 + 0.3 * Math.sin(clock / 8 + i)));
    });
  },
  maiden: () => { // Maiden Tower and the old walls
    shadowAt(120); ctx.fillStyle = "#b8a07a"; ctx.fillRect(-100, -26, 64, 26); ctx.fillStyle = "#a88f68"; for (let i = 0; i < 7; i++) ctx.fillRect(-100 + i * 9.6, -32, 5, 6); arches(-96, 0, 56, 18, 3, "#6a5a3c");
    const g = ctx.createLinearGradient(-22, 0, 22, 0); g.addColorStop(0, "#c8ad84"); g.addColorStop(1, "#8a7350"); ctx.fillStyle = g; ctx.fillRect(-22, -98, 44, 98);
    ctx.fillStyle = "#a08760"; ctx.fillRect(14, -78, 14, 78); for (let i = 0; i < 6; i++) ctx.fillRect(-22 + i * 8, -106, 5, 8); ctx.fillStyle = "#9a8058"; poly([[-18, -98], [18, -98], [0, -124]]);
    ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1; ctx.beginPath(); for (let y = -10; y > -96; y -= 8) { ctx.moveTo(-22, y); ctx.lineTo(22, y); } ctx.stroke(); ctx.fillStyle = "#3a2c1c"; ctx.fillRect(-3, -60, 4, 10); ctx.fillRect(-3, -34, 4, 10);
  },
  heydar: () => { // Heydar Aliyev Center
    shadowAt(180); ctx.fillStyle = "#f6f8fa"; ctx.beginPath(); ctx.moveTo(-92, 0); ctx.bezierCurveTo(-92, -40, -62, -20, -42, -52); ctx.bezierCurveTo(-22, -88, 6, -68, 28, -42); ctx.bezierCurveTo(50, -14, 72, -36, 92, -10); ctx.lineTo(92, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(120,140,170,0.45)"; ctx.lineWidth = 1; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-88 + i * 4, -2); ctx.bezierCurveTo(-86, -34 - i * 4, -56, -18, -38 + i * 4, -46 - i * 6); ctx.stroke(); }
    ctx.fillStyle = "rgba(60,90,130,0.12)"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.bezierCurveTo(30, -30, 72, -30, 92, -10); ctx.lineTo(92, 0); ctx.fill();
    if (lit() > 0.2) glow(0, -40, 110, "150,200,255", 0.35 * lit());
  },
  // ----- Singapore -----
  mbs: () => { // Marina Bay Sands
    water(112, 8);
    [-1, 0, 1].forEach(i => { ctx.save(); ctx.translate(i * 40, 0); ctx.transform(1, 0, i * 0.06, 1, 0, 0); const g = ctx.createLinearGradient(-17, 0, 17, 0); g.addColorStop(0, "#c4ced9"); g.addColorStop(0.5, "#eef2f6"); g.addColorStop(1, "#98a6b6"); ctx.fillStyle = g; ctx.fillRect(-17, -150, 34, 150); windows(-17, 0, 34, 150, 6, 18, i * 7 + 21); ctx.restore(); });
    ctx.fillStyle = "#e6ebf0"; ctx.beginPath(); ctx.moveTo(-74, -150); ctx.lineTo(70, -150); ctx.quadraticCurveTo(100, -156, 116, -160); ctx.lineTo(60, -166); ctx.lineTo(-74, -164); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#4fa05a"; ctx.fillRect(-70, -170, 126, 4); ctx.fillStyle = "#7fd6f0"; ctx.fillRect(-36, -168, 76, 2.5); ctx.fillStyle = "#3a8a4a"; for (let i = 0; i < 12; i++) circle(-66 + i * 10, -171, 2.4);
    if (lit() > 0.2) { glow(20, -160, 80, "120,220,255", 0.4 * lit()); glow(0, -80, 90, "255,230,180", 0.18 * lit()); }
  },
  supertrees: () => { // Gardens by the Bay Supertrees
    shadowAt(80);
    [[-46, 112, 28], [4, 142, 34], [52, 98, 25]].forEach(([x, h, r], i) => {
      ctx.strokeStyle = "#4a4f58"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 7, 0); ctx.quadraticCurveTo(x - 3, -h * 0.5, x - 4, -h); ctx.moveTo(x + 7, 0); ctx.quadraticCurveTo(x + 3, -h * 0.5, x + 4, -h); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); for (let k = 1; k < 8; k++) { ctx.moveTo(x - 5, -k * h / 8); ctx.lineTo(x + 5, -k * h / 8 - 6); } ctx.stroke();
      ctx.fillStyle = "#3f9a4a"; for (let k = 0; k < 18; k++) circle(x + Math.sin(k * 2.1) * 5, -10 - k * h / 20, 3);
      const col = ["#c0398a", "#7a52c8", "#2aa89a"][i]; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - r, -h + 6); ctx.quadraticCurveTo(x, -h - 26, x + r, -h + 6); ctx.quadraticCurveTo(x, -h - 2, x - r, -h + 6); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 0.8; ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(x, -h - 8); ctx.lineTo(x + k * r * 0.4, -h + 4); } ctx.stroke();
      if (lit() > 0.2) glow(x, -h - 4, r * 2, ["255,60,170", "140,90,255", "60,230,200"][i], 0.6 * lit());
    });
    ctx.fillStyle = "#6a6f78"; ctx.fillRect(-46, -74, 98, 3);
  },
  merlion: () => { // the Merlion
    water(76, 6); ctx.fillStyle = "#f2f2ee"; ctx.beginPath(); ctx.moveTo(-15, -4); ctx.bezierCurveTo(-28, -30, -10, -50, -16, -72); ctx.lineTo(16, -72); ctx.bezierCurveTo(22, -50, 10, -30, 15, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.1)"; ctx.beginPath(); ctx.moveTo(4, -4); ctx.bezierCurveTo(14, -30, 6, -50, 16, -72); ctx.lineTo(16, -72); ctx.bezierCurveTo(22, -50, 10, -30, 15, -4); ctx.fill();
    ctx.strokeStyle = "rgba(120,130,140,0.4)"; ctx.lineWidth = 0.8; ctx.beginPath(); for (let y = -10; y > -66; y -= 6) { ctx.moveTo(-12, y); ctx.quadraticCurveTo(0, y + 4, 12, y); } ctx.stroke();
    ctx.fillStyle = "#f2f2ee"; for (let i = 0; i < 12; i++) circle(Math.cos(i / 12 * TAU) * 17, -86 + Math.sin(i / 12 * TAU) * 17, 5); circle(0, -86, 15);
    ctx.fillStyle = "#3a3a3a"; circle(-5, -89, 1.6); circle(5, -89, 1.6); ctx.fillStyle = "#d9a07a"; ell(0, -82, 4, 2.5);
    ctx.strokeStyle = "rgba(150,210,245,0.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -80); ctx.quadraticCurveTo(46, -92, 54, -6); ctx.stroke();
    ctx.fillStyle = "rgba(190,230,250,0.9)"; for (let i = 0; i < 4; i++) { const t = (clock * 0.02 + i * 0.25) % 1; circle(6 + 48 * t, -80 + (-12 * Math.sin(t * Math.PI)) + 74 * t * t, 1.6); }
    if (lit() > 0.2) glow(0, -50, 60, "200,230,255", 0.3 * lit());
  },
  flyer: () => { shadowAt(80); wheel(66, "#e6ebf1", () => "#cfd7e0", "#b8c0ca", 24); }, // Singapore Flyer
  // ----- USA: Austin -----
  capitol: () => { // Texas State Capitol
    shadowAt(180); const pink = "#c98a78"; box(-92, 0, 184, 40, pink); box(-62, -40, 124, 16, "#c18170"); windows(-92, 0, 184, 40, 16, 2, 4);
    ctx.fillStyle = "#e8c9b8"; for (let i = 0; i < 8; i++) ctx.fillRect(-30 + i * 8, -38, 4, 38); ctx.fillStyle = "#d9a898"; poly([[-36, -40], [36, -40], [0, -60]]);
    box(-22, -60, 44, 28, "#cf9684"); dome(0, -86, 26, "#b7a69c"); ctx.fillStyle = "#e8e0c8"; poly([[-3, -112], [3, -112], [0, -134]]); ctx.fillStyle = "#ffd23f"; circle(0, -138, 3);
    if (lit() > 0.2) glow(0, -80, 110, "255,215,170", 0.3 * lit());
  },
  uttower: () => { // the UT Tower, burnt orange at night
    shadowAt(50); box(-26, 0, 52, 34, "#d8c8a0"); box(-14, -34, 28, 98, "#e0d0a8"); ctx.fillStyle = "rgba(60,40,20,0.3)"; for (let i = 0; i < 5; i++) ctx.fillRect(-4, -44 - i * 16, 8, 10);
    box(-16, -132, 32, 14, "#d2c298"); box(-12, -146, 24, 14, "#e6d8b2"); ctx.fillStyle = "#b88a4a"; poly([[-14, -160], [14, -160], [0, -180]]);
    if (lit() > 0.2) { ctx.fillStyle = `rgba(255,120,30,${0.35 * lit()})`; ctx.fillRect(-14, -132, 28, 132); glow(0, -90, 70, "255,120,30", 0.4 * lit()); }
  },
  // ----- Mexico -----
  angel: () => { // the Angel of Independence
    shadowAt(80); box(-40, 0, 80, 8, "#b6b4ac"); box(-32, -8, 64, 8, "#c4c2ba"); box(-24, -16, 48, 8, "#d0cec6"); box(-14, -24, 28, 28, "#e8e4d8");
    const g = ctx.createLinearGradient(-7, 0, 7, 0); g.addColorStop(0, "#d8d0bc"); g.addColorStop(1, "#a8a08c"); ctx.fillStyle = g; poly([[-7, -52], [7, -52], [5.5, -152], [-5.5, -152]]);
    ctx.fillStyle = "#e8e0c8"; ctx.fillRect(-9, -158, 18, 5); ctx.fillStyle = "#e6b830"; ell(0, -174, 3, 9); poly([[-3, -176], [-20, -190], [-15, -168]]); poly([[3, -176], [20, -190], [15, -168]]); circle(0, -186, 3);
    glow(0, -176, 40, "255,215,90", 0.35 + 0.4 * lit());
  },
  pyramid: () => { // the Pyramid of the Sun
    shadowAt(140);
    for (let i = 0; i < 5; i++) { const w = 132 - i * 22, y = -i * 20; ctx.fillStyle = i % 2 ? "#a8997c" : "#b6a688"; ctx.fillRect(-w / 2, y - 20, w, 20); ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(w * 0.15, y - 20, w * 0.35, 20); }
    ctx.fillStyle = "#c9bd9f"; poly([[-10, 0], [10, 0], [5, -100], [-5, -100]]); ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 0.8; ctx.beginPath(); for (let y = -8; y > -98; y -= 8) { ctx.moveTo(-8 + (-y) * 0.03, y); ctx.lineTo(8 - (-y) * 0.03, y); } ctx.stroke();
    ctx.fillStyle = "#8f8268"; ctx.fillRect(-10, -108, 20, 8);
  },
  // ----- Brazil -----
  christ: () => { // Christ the Redeemer
    shadowAt(180); ctx.fillStyle = "#3f7a4a"; poly([[-104, 0], [-62, -40], [-26, -74], [26, -74], [66, -38], [106, 0]]); ctx.fillStyle = "rgba(0,0,0,0.18)"; poly([[10, 0], [26, -74], [66, -38], [106, 0]]);
    ctx.fillStyle = "#e8ebea"; ctx.fillRect(-7, -90, 14, 18); poly([[-6, -142], [6, -142], [8, -90], [-8, -90]]); ctx.fillRect(-38, -138, 76, 7); circle(0, -148, 6);
    ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, -138, 38, 7); glow(0, -118, 48, "255,255,240", 0.2 + 0.4 * lit());
  },
  sugarloaf: () => { // Sugarloaf Mountain with its cable car
    shadowAt(180); const g = ctx.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, "#9a9484"); g.addColorStop(1, "#6a655a"); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-86, 0); ctx.bezierCurveTo(-82, -60, -58, -110, -6, -114); ctx.bezierCurveTo(44, -114, 68, -60, 76, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#3f7a4a"; poly([[-86, 0], [-80, -26], [-50, -14], [-30, 0]]); ctx.fillStyle = "#4a8a52"; ctx.beginPath(); ctx.ellipse(-6, -112, 20, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#7a7468"; ctx.beginPath(); ctx.moveTo(-130, 0); ctx.quadraticCurveTo(-120, -50, -96, -52); ctx.quadraticCurveTo(-76, -40, -72, 0); ctx.fill();
    ctx.strokeStyle = "#444"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-98, -52); ctx.lineTo(-8, -112); ctx.stroke(); const t = (clock * 0.003) % 1; ctx.fillStyle = "#e8505b"; ctx.fillRect(-98 + 90 * t - 4, -52 - 60 * t - 2, 8, 6);
  },
  ponte: () => { // Octavio Frias de Oliveira cable-stayed bridge
    water(100, 7); ctx.strokeStyle = "#e6e8ec"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(14, -170); ctx.moveTo(26, 0); ctx.lineTo(-14, -170); ctx.stroke();
    ctx.strokeStyle = "rgba(230,234,238,0.8)"; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 10; i++) { const y = -168 + i * 5; ctx.moveTo(0, y); ctx.lineTo(-100 + i * 9, -24); ctx.moveTo(0, y); ctx.lineTo(100 - i * 9, -24); } ctx.stroke();
    ctx.fillStyle = "#8a8f98"; ctx.fillRect(-106, -26, 212, 4); if (lit() > 0.2) glow(0, -80, 110, "200,225,255", 0.3 * lit());
  },
  // ----- USA: Las Vegas -----
  sphere: () => { // the Sphere
    shadowAt(120); const cy = -80, r = 68, hue = (clock * 1.2) % 360, g = ctx.createRadialGradient(-20, cy - 20, 6, 0, cy, r);
    g.addColorStop(0, `hsl(${hue},95%,70%)`); g.addColorStop(0.6, `hsl(${(hue + 60) % 360},90%,48%)`); g.addColorStop(1, `hsl(${(hue + 140) % 360},90%,25%)`); ctx.fillStyle = g; circle(0, cy, r);
    ctx.save(); ctx.beginPath(); ctx.arc(0, cy, r, 0, TAU); ctx.clip(); ctx.fillStyle = "rgba(255,255,255,0.18)"; for (let y = -r; y < r; y += 6) for (let x = -r; x < r; x += 6) ctx.fillRect(x, cy + y, 1.6, 1.6);
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, cy + Math.sin(clock / 40) * 14, r, r * 0.3, 0.4, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.fillStyle = "#2a2540"; ctx.fillRect(-32, -14, 64, 14); glow(0, cy, r * 1.6, "180,120,255", 0.4);
  },
  luxor: () => { // the Luxor pyramid and its beam
    shadowAt(150); ctx.fillStyle = "#14161f"; poly([[-72, 0], [72, 0], [0, -120]]); ctx.fillStyle = "rgba(255,255,255,0.08)"; poly([[-72, 0], [0, -120], [0, 0]]);
    ctx.strokeStyle = "#cfa94a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-72, 0); ctx.lineTo(0, -120); ctx.lineTo(72, 0); ctx.stroke(); ctx.strokeStyle = "rgba(90,130,200,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 1; k < 8; k++) { const y = -k * 15; ctx.moveTo(-72 * (1 + y / 120), y); ctx.lineTo(72 * (1 + y / 120), y); } ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = "lighter"; const bg = ctx.createLinearGradient(0, -120, 0, -440); bg.addColorStop(0, `rgba(190,235,255,${0.55 + 0.3 * lit()})`); bg.addColorStop(1, "rgba(190,235,255,0)"); ctx.fillStyle = bg; ctx.fillRect(-6, -440, 12, 322); ctx.fillStyle = "rgba(190,235,255,0.12)"; poly([[-20, -120], [20, -120], [60, -440], [-60, -440]]); ctx.restore();
    ctx.fillStyle = "#cdb88a"; ctx.fillRect(-104, -10, 28, 10); circle(-76, -14, 6);
  },
  stratosphere: () => { // the Stratosphere tower
    shadowAt(40); ctx.fillStyle = "#cfd3da"; poly([[-12, 0], [12, 0], [4, -150], [-4, -150]]); ctx.fillStyle = "#b8bec8"; poly([[-6, -150], [6, -150], [22, -178], [-22, -178]]);
    ctx.fillStyle = "#e8ecf2"; ctx.fillRect(-24, -182, 48, 5); ctx.fillRect(-15, -188, 30, 6); ctx.fillRect(-1, -240, 2, 52);
    if (Math.floor(clock / 20) % 2) { ctx.fillStyle = "#ff3030"; circle(0, -240, 2.5); glow(0, -240, 18, "255,40,40", 0.7); }
    if (lit() > 0.2) glow(0, -176, 60, "255,80,160", 0.6 * lit());
  },
  eiffel: () => { // Paris Las Vegas Eiffel Tower
    shadowAt(70); const c = lit() > 0.2 ? "#d9a84a" : "#6a5a4a"; ctx.fillStyle = c;
    poly([[-40, 0], [-30, 0], [-8, -82], [-13, -82]]); poly([[40, 0], [30, 0], [8, -82], [13, -82]]); poly([[-13, -82], [13, -82], [6, -152], [-6, -152]]); poly([[-4, -152], [4, -152], [0, -194]]); ctx.fillRect(-34, -44, 68, 4); ctx.fillRect(-15, -82, 30, 5);
    ctx.strokeStyle = c; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, -18, 25, Math.PI, 0); for (let k = 0; k < 6; k++) { ctx.moveTo(-9 - k, -84 - k * 11); ctx.lineTo(9 + k * 0, -90 - k * 11); } ctx.stroke();
    if (lit() > 0.2) { glow(0, -90, 80, "255,200,100", 0.45 * lit()); ctx.fillStyle = "#fff"; for (let i = 0; i < 6; i++) if (seeded(Math.floor(clock / 4) + i) > 0.5) circle(seeded(i + 9) * 40 - 20, -30 - seeded(i + 3) * 140, 1.5); }
  },
  welcome: () => { // "Welcome to Fabulous Las Vegas"
    shadowAt(30); ctx.fillStyle = "#3a3d44"; ctx.fillRect(-2, -36, 4, 36);
    ctx.save(); ctx.translate(0, -74); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#fff"; ctx.fillRect(-27, -27, 54, 54); ctx.strokeStyle = "#d3202a"; ctx.lineWidth = 4; ctx.strokeRect(-25, -25, 50, 50); ctx.restore();
    ctx.fillStyle = "#d3202a"; ctx.textAlign = "center"; ctx.font = "bold 6.5px sans-serif"; ctx.fillText("WELCOME", 0, -86); ctx.fillText("TO FABULOUS", 0, -78); ctx.font = "bold 9px sans-serif"; ctx.fillText("LAS VEGAS", 0, -68); ctx.fillStyle = "#ffd23f"; circle(0, -58, 4);
    for (const [x, y] of [[0, -112], [38, -74], [0, -36], [-38, -74]]) { ctx.fillStyle = "#ffd23f"; circle(x, y, 2.4); }
    glow(0, -74, 50, "255,210,90", 0.25 + 0.45 * lit());
  },
  // ----- Qatar -----
  lusail: () => { // Lusail Stadium, the golden bowl
    shadowAt(180); ctx.fillStyle = "#2a2d34"; ell(0, -4, 92, 10); const g = ctx.createLinearGradient(-92, 0, 92, 0); g.addColorStop(0, "#b8892c"); g.addColorStop(0.5, "#ffd86a"); g.addColorStop(1, "#a07420"); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-92, -4); ctx.bezierCurveTo(-98, -50, -76, -76, -58, -86); ctx.lineTo(58, -86); ctx.bezierCurveTo(76, -76, 98, -50, 92, -4); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = "rgba(70,45,0,0.45)"; ctx.lineWidth = 1; ctx.beginPath(); for (let i = -12; i <= 12; i++) { ctx.moveTo(i * 9, -4); ctx.lineTo(i * 9 + 30, -86); ctx.moveTo(i * 9, -4); ctx.lineTo(i * 9 - 30, -86); } ctx.stroke(); ctx.restore();
    ctx.fillStyle = "#1e2026"; ell(0, -86, 58, 7); glow(0, -50, 130, "255,200,80", 0.15 + 0.4 * lit());
  },
  aspire: () => { // Aspire Tower, the Torch
    shadowAt(50); const g = ctx.createLinearGradient(-22, 0, 22, 0); g.addColorStop(0, "#9ab4cc"); g.addColorStop(0.5, "#e6f1fa"); g.addColorStop(1, "#7f9ab4"); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.bezierCurveTo(-8, -50, -8, -110, -20, -152); ctx.lineTo(20, -152); ctx.bezierCurveTo(8, -110, 8, -50, 22, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 1; k < 10; k++) { const y = -k * 15; ctx.moveTo(-14, y); ctx.lineTo(14, y); } ctx.stroke();
    ctx.fillStyle = "#6a7a8a"; ell(0, -154, 26, 6); ctx.fillStyle = "#9ab"; ctx.fillRect(-24, -162, 48, 8); ctx.fillStyle = "rgba(255,150,40,0.9)"; ell(0, -174 - Math.sin(clock / 5) * 2, 8, 13); ctx.fillStyle = "rgba(255,230,120,0.9)"; ell(0, -170, 4, 8); glow(0, -172, 44, "255,140,40", 0.55);
  },
  // ----- Abu Dhabi -----
  mosque: () => { // Sheikh Zayed Grand Mosque
    water(120, 8); const w = "#f7f5ef", sh = "#e0ddd2";
    box(-92, -2, 184, 40, w); arches(-88, -2, 176, 30, 15, "#d7d3c6");
    for (const x of [-62, -38, 38, 62]) { dome(x, -38, 14, w); ctx.fillStyle = "#d4af37"; ctx.fillRect(x - 0.7, -62, 1.4, 10); }
    dome(0, -42, 38, w); ctx.fillStyle = "#d4af37"; ctx.fillRect(-0.8, -90, 1.6, 12); circle(0, -92, 2);
    for (const x of [-104, 104, -78, 78]) { box(x - 5, 0, 10, x > 90 || x < -90 ? 118 : 96, w); box(x - 7, x > 90 || x < -90 ? -118 : -96, 14, 5, sh); dome(x, x > 90 || x < -90 ? -123 : -101, 6, w); ctx.fillStyle = "#d4af37"; ctx.fillRect(x - 0.7, x > 90 || x < -90 ? -141 : -119, 1.4, 12); }
    if (lit() > 0.2) glow(0, -70, 100, "255,236,190", 0.4 * lit());
  },
  themepark: () => { // a wavy-roofed indoor theme park with a roller-coaster tower
    shadowAt(200); ctx.fillStyle = "#1f8fa8"; ctx.beginPath(); ctx.moveTo(-104, 0); ctx.quadraticCurveTo(-94, -74, -20, -58); ctx.quadraticCurveTo(40, -46, 72, -76); ctx.quadraticCurveTo(102, -62, 106, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-90, -4); ctx.quadraticCurveTo(-60, -52, -10, -46); ctx.moveTo(-70, -4); ctx.quadraticCurveTo(-40, -40, 0, -36); ctx.stroke();
    ctx.strokeStyle = "#e8e8ee"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, -62); ctx.lineTo(56, -158); ctx.stroke(); ctx.fillStyle = "#f2a23a"; ctx.fillRect(52, -158, 5, 96); glow(0, -50, 130, "60,200,230", 0.15 + 0.4 * lit());
  },
  yashotel: () => { // Yas Viceroy and its glowing grid shell
    water(104, 7); box(-72, 0, 56, 72, "#cfd3e0"); box(16, 0, 56, 58, "#cfd3e0"); windows(-72, 0, 56, 72, 5, 7, 6); windows(16, 0, 56, 58, 5, 6, 8);
    const hue = (clock * 2) % 360; ctx.strokeStyle = lit() > 0.2 ? `hsla(${hue},90%,65%,0.95)` : "rgba(120,130,150,0.8)"; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const x = -16 + i * 3.2; ctx.moveTo(x, -62); ctx.lineTo(x + 12, -38); ctx.moveTo(x, -38); ctx.lineTo(x + 12, -62); } ctx.stroke();
    glow(0, -52, 90, `${Math.round(128 + 127 * Math.sin(clock / 30))},120,255`, 0.2 + 0.4 * lit());
  },
  etihad: () => { // Etihad Towers
    shadowAt(80);
    [[-46, 100], [-20, 132], [8, 154], [34, 118], [58, 92]].forEach(([x, h]) => {
      const g = ctx.createLinearGradient(x - 11, 0, x + 11, 0); g.addColorStop(0, "#6f9ac4"); g.addColorStop(0.5, "#d9ecfa"); g.addColorStop(1, "#5a86b0"); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 11, 0); ctx.lineTo(x - 11, -h * 0.8); ctx.quadraticCurveTo(x - 10, -h, x + 11, -h - 4); ctx.lineTo(x + 11, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lit() > 0.2 ? "rgba(255,230,160,0.55)" : "rgba(255,255,255,0.18)"; for (let y = -8; y > -h * 0.85; y -= 9) ctx.fillRect(x - 9, y, 18, 1.8);
    });
  },
};

// ---- small roadside props that make each country feel different ----
const PROPS = {
  lanternpole: () => { shadowAt(20); ctx.fillStyle = "#3a3d44"; ctx.fillRect(-1, -52, 2, 52); ctx.fillRect(-1, -52, 18, 2); ctx.fillStyle = "#d3202a"; ell(15, -42, 6, 8); ctx.fillStyle = "#d4af37"; ctx.fillRect(9, -51, 12, 2); ctx.fillRect(14, -35, 2, 6); glow(15, -42, 24, "255,80,60", 0.2 + 0.5 * lit()); },
  paifang: () => { shadowAt(80); for (const x of [-34, 34]) { ctx.fillStyle = "#b02a22"; ctx.fillRect(x - 4, -62, 8, 62); } ctx.fillStyle = "#b02a22"; ctx.fillRect(-38, -62, 76, 8); ctx.fillStyle = "#2f7a4f"; ctx.beginPath(); ctx.moveTo(-46, -62); ctx.quadraticCurveTo(-36, -66, -30, -78); ctx.lineTo(30, -78); ctx.quadraticCurveTo(36, -66, 46, -62); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#d4af37"; ctx.fillRect(-20, -60, 40, 5); ctx.fillRect(-30, -80, 60, 2); },
  bamboo: () => { ctx.fillStyle = "rgba(0,0,0,0.2)"; ell(0, 0, 14, 3); for (let i = 0; i < 6; i++) { const x = -12 + i * 5, h = 54 + (i * 13) % 22; ctx.fillStyle = "#6aa84a"; ctx.fillRect(x, -h, 2.6, h); ctx.fillStyle = "#4a7a30"; for (let k = 1; k < 5; k++) ctx.fillRect(x - 0.4, -k * h / 5, 3.4, 1.2); ctx.fillStyle = "#7ac05a"; ell(x + 5, -h + 4, 6, 1.6); ell(x - 3, -h + 12, 6, 1.6); } },
  torii: () => { shadowAt(70); ctx.fillStyle = "#d3321f"; ctx.fillRect(-26, -70, 8, 70); ctx.fillRect(18, -70, 8, 70); ctx.fillRect(-34, -64, 68, 7); ctx.fillStyle = "#1c1c20"; ctx.beginPath(); ctx.moveTo(-42, -74); ctx.quadraticCurveTo(0, -66, 42, -74); ctx.lineTo(38, -80); ctx.quadraticCurveTo(0, -72, -38, -80); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#d3321f"; ctx.fillRect(-4, -64, 8, 8); },
  stonelantern: () => { shadowAt(20); ctx.fillStyle = "#8f9298"; ctx.fillRect(-4, -12, 8, 12); ctx.fillRect(-2.5, -26, 5, 14); ctx.fillStyle = "#7d8086"; ctx.fillRect(-8, -36, 16, 10); ctx.fillStyle = "rgba(255,210,120,0.9)"; ctx.fillRect(-4, -34, 8, 6); poly([[-11, -36], [11, -36], [0, -46]]); glow(0, -31, 24, "255,200,100", 0.2 + 0.5 * lit()); },
  neonsign: s => { const t = ["OPEN", "BAR", "CLUB", "HOTEL"][s.v % 4], c = ["255,60,160", "60,230,255", "255,200,60"][s.v % 3]; shadowAt(20); ctx.fillStyle = "#33363c"; ctx.fillRect(-1.5, -40, 3, 40); ctx.fillStyle = "#14151a"; roundRect(-22, -64, 44, 24, 4); ctx.fill(); ctx.strokeStyle = `rgb(${c})`; ctx.lineWidth = 2; roundRect(-20, -62, 40, 20, 3); ctx.stroke(); ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = `rgb(${c})`; ctx.fillText(t, 0, -48); glow(0, -52, 38, c, 0.25 + 0.5 * lit()); },
  flamingo: () => { shadowAt(16); ctx.strokeStyle = "#ff8aa8"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke(); ctx.fillStyle = "#ff8fb0"; ell(0, -26, 8, 5.5); ctx.strokeStyle = "#ff8fb0"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(5, -28); ctx.quadraticCurveTo(10, -40, 4, -46); ctx.stroke(); ctx.fillStyle = "#222"; poly([[2, -47], [-3, -45], [3, -43]]); },
  lifeguard: () => { shadowAt(30); ctx.fillStyle = "#e8e0d0"; ctx.fillRect(-12, -18, 3, 18); ctx.fillRect(9, -18, 3, 18); box(-14, -18, 28, 20, "#ff6a8a"); ctx.fillStyle = "#33d0e0"; ctx.fillRect(-14, -26, 28, 5); ctx.fillStyle = "#fff"; ctx.fillRect(-5, -32, 10, 6); spire(0, -38, 34, 10, "#33d0e0"); },
  mapleleaf: () => { shadowAt(20); ctx.fillStyle = "#555"; ctx.fillRect(-1, -30, 2, 30); ctx.fillStyle = "#d52b1e"; poly([[0, -72], [5, -62], [12, -64], [9, -54], [16, -50], [8, -46], [8, -40], [1, -43], [0, -34], [-1, -43], [-8, -40], [-8, -46], [-16, -50], [-9, -54], [-12, -64], [-5, -62]]); },
  yacht: () => { water(40, 5); ctx.fillStyle = "#f4f4f4"; poly([[-26, -3], [28, -3], [34, -9], [-30, -9]]); ctx.fillStyle = "#1c3f6a"; ctx.fillRect(-28, -6, 58, 2.4); box(-14, -9, 28, 9, "#fff"); ctx.fillStyle = "#4a6a8a"; ctx.fillRect(-12, -17, 24, 3); ctx.fillStyle = "#ddd"; ctx.fillRect(-1, -34, 2, 18); },
  mosaic: () => { shadowAt(50); ctx.fillStyle = "#e8e2d6"; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-18, -22, -8, -10); ctx.quadraticCurveTo(0, -24, 10, -10); ctx.quadraticCurveTo(20, -24, 26, 0); ctx.closePath(); ctx.fill(); for (let i = 0; i < 14; i++) { ctx.fillStyle = ["#e0594a", "#f0b840", "#59a5d8", "#5fb878"][i % 4]; ctx.fillRect(-22 + i * 3.4, -6 - Math.sin(i * 0.9) * 6, 2.4, 2.4); } },
  chalet: () => { shadowAt(50); box(-22, 0, 44, 22, "#f1ece0"); box(-22, -22, 44, 12, "#8a5a3a"); ctx.fillStyle = "#5a3a28"; poly([[-30, -34], [30, -34], [0, -58]]); ctx.fillStyle = "rgba(255,255,255,0.1)"; poly([[-30, -34], [0, -34], [0, -58]]); ctx.fillStyle = "#c8403a"; ctx.fillRect(-20, -20, 40, 3); for (let i = 0; i < 7; i++) circle(-18 + i * 6, -22, 1.6); ctx.fillStyle = "#6a4a30"; ctx.fillRect(-4, -14, 8, 14); ctx.fillStyle = "#8ec0e8"; ctx.fillRect(-18, -16, 6, 6); ctx.fillRect(12, -16, 6, 6); },
  cow: () => { shadowAt(24); ctx.fillStyle = "#f6f6f2"; ell(0, -14, 14, 8); ctx.fillStyle = "#222"; ell(-4, -16, 5, 4); ell(6, -12, 4, 3); ctx.fillStyle = "#f6f6f2"; ell(14, -20, 5, 4); ctx.fillStyle = "#222"; ctx.fillRect(14, -22, 4, 3); ctx.fillStyle = "#f6f6f2"; for (const x of [-9, -4, 5, 10]) ctx.fillRect(x, -8, 2.4, 8); ctx.fillStyle = "#e8a0a0"; ell(18, -18, 2, 2); },
  phonebox: () => { shadowAt(16); ctx.fillStyle = "#d3202a"; ctx.fillRect(-8, -40, 16, 40); ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(2, -40, 6, 40); ctx.fillStyle = "#cfe3f0"; for (let j = 0; j < 3; j++) { ctx.fillRect(-6, -36 + j * 11, 5, 9); ctx.fillRect(1, -36 + j * 11, 5, 9); } ctx.fillStyle = "#d3202a"; ctx.beginPath(); ctx.arc(0, -40, 8, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillRect(-4, -46, 8, 3); },
  bus: () => { shadowAt(60); ctx.fillStyle = "#d3202a"; roundRect(-32, -36, 64, 34, 3); ctx.fill(); ctx.fillStyle = "#b01a22"; ctx.fillRect(-32, -22, 64, 2); ctx.fillStyle = "#cfe3f0"; for (let i = 0; i < 6; i++) { ctx.fillRect(-28 + i * 10, -33, 7, 8); ctx.fillRect(-28 + i * 10, -18, 7, 8); } ctx.fillStyle = "#111"; circle(-18, -2, 5); circle(18, -2, 5); ctx.fillStyle = "#ddd"; circle(-18, -2, 2); circle(18, -2, 2); },
  sheep: () => { shadowAt(18); ctx.fillStyle = "#f2f0e8"; for (const [x, y] of [[-5, -13], [0, -16], [5, -13], [-2, -10], [3, -10]]) circle(x, y, 6); ctx.fillStyle = "#2a2a2a"; ell(11, -14, 3.4, 3); ctx.fillRect(-5, -8, 1.8, 8); ctx.fillRect(3, -8, 1.8, 8); },
  canalhouse: s => { const cols = ["#a8442f", "#e8d6a8", "#2f4f78", "#c98a3c"], c = cols[s.v % 4], h = 40 + (s.v % 2) * 10; shadowAt(34); box(-16, 0, 32, h, c); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-16, -h); ctx.quadraticCurveTo(-12, -h - 10, -6, -h - 12); ctx.lineTo(6, -h - 12); ctx.quadraticCurveTo(12, -h - 10, 16, -h); ctx.closePath(); ctx.fill(); windows(-16, 0, 32, h, 2, 4, s.v * 5 + 3); },
  sunflowers: () => { for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 7, h = 28 + (i * 7) % 12; ctx.strokeStyle = "#3f7a2a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -h); ctx.stroke(); ctx.fillStyle = "#ffd23f"; for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 4.6, -h + Math.sin(a) * 4.6, 2.8, 1.4, a, 0, TAU); ctx.fill(); } ctx.fillStyle = "#5a3a1a"; circle(x, -h, 3.2); } },
  hayroll: () => { shadowAt(24); ctx.fillStyle = "#d9b04a"; ell(0, -9, 11, 9); ctx.strokeStyle = "rgba(140,100,30,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -9, 5, 0, TAU); ctx.arc(0, -9, 8, 0, TAU); ctx.stroke(); },
  tulips: () => { for (let i = 0; i < 12; i++) { const x = -34 + i * 6 + (i % 2) * 2, h = 10 + (i * 5) % 6; ctx.strokeStyle = "#3f8a3c"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -h); ctx.stroke(); ctx.fillStyle = ["#e63946", "#ffd23f", "#ff7fc0", "#b388ff", "#ff8a5c"][Math.floor(i / 2.4) % 5]; ell(x, -h - 2, 2.8, 3.6); } },
  villa: () => { shadowAt(46); box(-22, 0, 44, 26, "#efe0c0"); ctx.fillStyle = "#c0603a"; poly([[-27, -26], [27, -26], [14, -40], [-14, -40]]); arches(-18, 0, 36, 14, 3, "#7a5a3a"); ctx.fillStyle = "#8ec0e8"; ctx.fillRect(-14, -20, 5, 7); ctx.fillRect(9, -20, 5, 7); ctx.fillStyle = "#c0603a"; ctx.fillRect(10, -48, 6, 10); },
  vineyard: () => { ctx.fillStyle = "rgba(0,0,0,0.15)"; ell(0, 0, 36, 4); for (let r = 0; r < 3; r++) { ctx.strokeStyle = "#8a6a4a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-32, -r * 7); ctx.lineTo(32, -r * 7); ctx.stroke(); ctx.fillStyle = "#4a9a3a"; for (let i = 0; i < 12; i++) ell(-30 + i * 5.6, -r * 7 - 3, 3.2, 3.4); ctx.fillStyle = "#6a3a7a"; for (let i = 0; i < 5; i++) circle(-24 + i * 12, -r * 7 + 1, 1.2); } },
  osborne: () => { shadowAt(50); ctx.fillStyle = "#44474d"; ctx.fillRect(-18, -42, 3, 42); ctx.fillRect(15, -42, 3, 42); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(-26, -58); ctx.quadraticCurveTo(-22, -74, -4, -72); ctx.quadraticCurveTo(10, -76, 24, -66); ctx.lineTo(28, -54); ctx.lineTo(24, -46); ctx.lineTo(22, -40); ctx.lineTo(18, -48); ctx.lineTo(8, -48); ctx.lineTo(4, -40); ctx.lineTo(0, -48); ctx.lineTo(-14, -48); ctx.lineTo(-18, -38); ctx.lineTo(-22, -50); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(24, -68); ctx.lineTo(30, -76); ctx.moveTo(18, -68); ctx.lineTo(14, -76); ctx.stroke(); },
  stonearch: () => { shadowAt(40); box(-24, 0, 14, 48, "#c8b48a"); box(10, 0, 14, 48, "#c8b48a"); ctx.fillStyle = "#c8b48a"; ctx.beginPath(); ctx.moveTo(-24, -48); ctx.lineTo(24, -48); ctx.lineTo(24, -40); ctx.arc(0, -40, 10, 0, Math.PI); ctx.lineTo(-24, -40); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#a89468"; ctx.fillRect(-26, -54, 52, 6); for (let i = 0; i < 6; i++) ctx.fillRect(-26 + i * 9, -58, 5, 5); },
  orchid: () => { ctx.fillStyle = "rgba(0,0,0,0.18)"; ell(0, 0, 14, 3); ctx.strokeStyle = "#3f8a3c"; ctx.lineWidth = 1.4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 6, 0); ctx.quadraticCurveTo(-8 + i * 6, -14, -4 + i * 6, -22); ctx.stroke(); for (let k = 0; k < 4; k++) { ctx.fillStyle = ["#d958a8", "#ffffff", "#b06ae0"][i]; ell(-5 + i * 6 + (k % 2) * 3, -22 + k * 3, 3, 2.2); } } },
  pumpjack: () => { const a = Math.sin(clock / 18) * 0.28; shadowAt(50); ctx.fillStyle = "#2f3a48"; poly([[-6, 0], [6, 0], [2, -28], [-2, -28]]); ctx.fillRect(-14, -4, 28, 4); ctx.save(); ctx.translate(0, -28); ctx.rotate(a); ctx.fillStyle = "#c8402e"; ctx.fillRect(-26, -3, 52, 6); ctx.fillStyle = "#222"; roundRect(18, -10, 12, 14, 6); ctx.fill(); ctx.restore(); ctx.strokeStyle = "#111"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-26 * Math.cos(a), -28 - 26 * Math.sin(a)); ctx.lineTo(-26 * Math.cos(a), -4); ctx.stroke(); ctx.fillStyle = "#e8e0c8"; circle(26 * Math.cos(a) + 2, -28 + 26 * Math.sin(a) - 4, 5); },
  agave: () => { ctx.fillStyle = "rgba(0,0,0,0.2)"; ell(0, 0, 14, 3); ctx.fillStyle = "#4f9a8a"; for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.34; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * 12, -10 + Math.sin(a) * 6, Math.cos(a) * 16, -6 + Math.sin(a) * 26); ctx.quadraticCurveTo(Math.cos(a) * 5, -8, 0, 0); ctx.fill(); } },
  papel: () => { shadowAt(20); ctx.fillStyle = "#6b4a2a"; ctx.fillRect(-1.5, -60, 3, 60); ctx.strokeStyle = "#555"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -58); ctx.quadraticCurveTo(22, -50, 40, -58); ctx.stroke(); for (let i = 0; i < 6; i++) { const x = 4 + i * 6, y = -56 + Math.sin(i * 0.5) * 2 + 2; ctx.fillStyle = ["#e63946", "#ffd23f", "#2fb6f0", "#5fb878", "#ff7fc0", "#b388ff"][i]; poly([[x, y], [x + 5, y], [x + 2.5, y + 8]]); } },
  colorhouses: () => { shadowAt(60); [[-28, 40, "#f2b8c6"], [-8, 54, "#8ed6d0"], [12, 36, "#f6e08a"], [30, 46, "#9ac0ee"]].forEach(([x, h, c], i) => { box(x - 10, 0, 20, h, c); windows(x - 10, 0, 20, h, 2, Math.floor(h / 12), i * 7 + 1); ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x - 10, -h, 20, 2); }); },
  camel: () => { shadowAt(34); ctx.fillStyle = "#c8a070"; ell(0, -22, 16, 8); circle(-6, -30, 6); circle(5, -31, 6); ctx.fillRect(-14, -18, 3, 18); ctx.fillRect(-7, -18, 3, 18); ctx.fillRect(5, -18, 3, 18); ctx.fillRect(12, -18, 3, 18); ctx.strokeStyle = "#c8a070"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(15, -24); ctx.quadraticCurveTo(24, -34, 24, -44); ctx.stroke(); ctx.lineCap = "butt"; ell(26, -46, 5, 3.2); ctx.fillStyle = "#222"; circle(27, -47, 0.9); },
};

function drawScenery3D(s) {
  const r = s.r;
  switch (s.kind) {
    case "lm": LMS[s.key](s); break;
    case "prop": PROPS[s.key](s); break;
    case "tree": drawTree3D(s); break;
    case "flag": drawFlag3D(s); break;
    case "board": drawBoard3D(s); break;
    case "stand": drawStand3D(s); break;
    case "building": drawBuilding3D(s); break;
    case "lamp": drawLamp3D(s); break;
    case "bush":
      ctx.fillStyle = rgb(mix(pal.leaf, [0, 0, 0], 0.1)); ell(0, -r * 0.6, r * 1.2, r * 0.9);
      ctx.fillStyle = "rgba(255,255,255,0.14)"; circle(-r * 0.3, -r * 0.9, r * 0.4);
      break;
    case "rock":
      ctx.fillStyle = "#86898e"; ell(0, -r * 0.45, r * 1.1, r * 0.8);
      ctx.fillStyle = "rgba(255,255,255,0.22)"; circle(-r * 0.3, -r * 0.7, r * 0.4);
      break;
    case "dune":
      ctx.fillStyle = sandColor(); ell(0, -r * 0.35, r * 1.5, r * 0.6);
      ctx.fillStyle = "rgba(120,90,40,0.16)"; ell(r * 0.4, -r * 0.25, r * 0.8, r * 0.4);
      break;
  }
}

function drawSprites3D(C) {
  const list = [];
  for (const s of scenery) { const p = toScreen(C, s.x3, s.y); if (p && p.sc > (s.kind === "lm" ? 0.1 : 0.17) && p.sx > -240 && p.sx < W + 240) list.push({ d: p.d, p, fn: () => drawScenery3D(s) }); } // tiny, far objects aren't worth drawing
  for (const k of pickups) { const p = toScreen(C, k.x, k.y); if (p) list.push({ d: p.d, p, coin: k }); }
  for (const e of enemies) {
    const back = e.y + lenOf(e) / 2; // the end nearest us
    if (e.kind === "works") {
      for (let y = e.y - e.len / 2; y <= back - 70; y += 30) { const p = toScreen(C, e.x, y); if (p) list.push({ d: p.d, p, fn: drawCone3D }); }
      for (let i = 0; i < 4; i++) { const p = toScreen(C, e.x + (e.lane === 0 ? -1 : 1) * (38 - i * 12), back - 10 - i * 18); if (p) list.push({ d: p.d, p, fn: drawCone3D }); }
      const pb = toScreen(C, e.x, back - 4); if (pb) list.push({ d: pb.d, p: pb, fn: drawBarrier3D });
      const ps = toScreen(C, worksSignX(e), back + SIGN_AHEAD); if (ps) list.push({ d: ps.d, p: ps, fn: drawSign3D });
      continue;
    }
    const p = toScreen(C, e.x, back - CAR_H / 2, CAR_H / 2); if (p) list.push({ d: p.d, p, fn: () => drawEnemyRear(e) });
  }
  for (const r of racers) {
    const p = toScreen(C, r.x, r.y, CAR_H / 2);
    if (p) list.push({ d: p.d, p, fn: () => { if (r.ghost > 0 && Math.floor(r.ghost / 5) % 2) ctx.globalAlpha *= 0.35; drawCarRear(r.team, { brake: r.alive && r.braking, slip: r.alive && r.v >= 4.6, nitro: r.alive && r.nitro > 0 }); if (r.shield && r.alive) drawShieldBubble(0, -22, 40, 30); }, tilt: r.tilt, dead: !r.alive });
  }
  for (const it of roadItems) { const p = toScreen(C, it.x, it.y); if (p) list.push({ d: p.d + 0.5, p, item: it }); }
  if (startObj) { const p = toScreen(C, W / 2, startObj.y); if (p) list.push({ d: p.d, p, fn: () => drawGantry3D() }); }
  if (finishObj) { const p = toScreen(C, W / 2, finishObj.y); if (p) list.push({ d: p.d, p, fn: () => drawGantry3D(true) }); }
  list.sort((a, b) => b.d - a.d);
  for (const o of list) {
    const p = o.p, a = fade3D(C, p.d);
    if (a <= 0) continue;
    if (o.coin) { ctx.globalAlpha = a; drawPickupIcon(o.coin, p.sx, p.sy - (o.coin.type === "coin" ? 18 : 26) * p.sc, p.sc * (o.coin.type === "coin" ? 1 : 1.08)); ctx.globalAlpha = 1; continue; }
    if (o.item) { // flat things on the road: leaves and puddles
      const it = o.item, ry = it.ry ? it.ry * C.f * C.h / (p.d * p.d) : 2 * p.sc;
      ctx.globalAlpha = a;
      if (it.k === "leaf") { ctx.fillStyle = it.c; ctx.beginPath(); ctx.ellipse(p.sx, p.sy, it.s * p.sc, Math.max(0.6, ry * 0.6), it.rot * 0.3, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = `rgba(140,170,210,${clamp(wet * 1.5, 0, 0.45)})`; ctx.beginPath(); ctx.ellipse(p.sx, p.sy, it.rx * p.sc * 0.8, Math.max(1, ry), 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.save();
    ctx.globalAlpha = a * (o.dead ? 0.55 : 1);
    ctx.translate(p.sx, p.sy); ctx.scale(p.sc, p.sc);
    if (o.tilt) ctx.rotate(o.tilt * 0.5);
    o.fn();
    ctx.restore();
  }
  for (const q of particles) { // sparks, spray and debris (glowing ones blend additively)
    const p = toScreen(C, q.x, q.y);
    if (!p) continue;
    ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1) * fade3D(C, p.d);
    ctx.globalCompositeOperation = q.add ? "lighter" : "source-over";
    ctx.fillStyle = q.color;
    const s = Math.max(1, q.size * p.sc);
    if (q.add) { ctx.beginPath(); ctx.arc(p.sx, p.sy - s, s * 0.6, 0, TAU); ctx.fill(); } else ctx.fillRect(p.sx - s / 2, p.sy - s / 2, s, s);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
}

function drawSpeedStreaks3D(C) {
  const v = state === "playing" ? racers[0].v : 0;
  if (v < 3) return;
  const k = clamp((v - 3) / 3, 0, 1);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(230,240,255,${k * 0.32})`;
  ctx.lineWidth = 1.6; ctx.beginPath();
  const vx = W / 2 - camOff * 0.2, vy = C.hor;
  for (let i = 0, n = settings.lowfx ? 18 : 26 + Math.round(k * 26); i < n; i++) {
    const a = (i * 2.399) % TAU, ph = ((scrollPos * 0.012 * (0.7 + (i % 4) * 0.2) + i * 0.173) % 1), r0 = 40 + ph * ph * 380, r1 = r0 + 14 + ph * 70;
    const ca = Math.cos(a), sa = Math.sin(a) * 0.7;
    ctx.moveTo(vx + ca * r0, vy + 30 + sa * r0); ctx.lineTo(vx + ca * r1, vy + 30 + sa * r1);
  }
  ctx.stroke(); ctx.restore();
}

// ---- light on the road: wet sheen and reflections, headlights, underglow, rain splashes (3D views) ----
let splashes = [];
const brightest = team => [team.p, team.s, team.a].map(hx).sort((a, b) => (b[0] + b[1] + b[2]) - (a[0] + a[1] + a[2]))[0]; // the team's lightest colour, for underglow
function drawRoadFX(C) {
  if (settings.lowfx) return;
  const night = clamp(pal.dark * 4, 0, 1), wetk = clamp(wet * 1.6, 0, 1);
  ctx.save();
  if (wetk > 0.05) { // the sky mirrored in the far, wet asphalt
    const c = mix(pal.sky1, [210, 220, 235], 0.3), g = ctx.createLinearGradient(0, C.hor, 0, C.hor + 140);
    g.addColorStop(0, rgb(c, 0.32 * wetk)); g.addColorStop(1, rgb(c, 0));
    ctx.fillStyle = g; ctx.fillRect(0, C.hor, W, 140);
  }
  ctx.globalCompositeOperation = "lighter";
  const k = Math.max(wetk, night * 0.55);
  if (k > 0.05) for (const e of enemies) { // tail lights smeared down the road surface
    if (e.kind === "works") continue;
    const back = e.y + lenOf(e) / 2, p = toScreen(C, e.x, back - CAR_H / 2, CAR_H / 2);
    if (!p) continue;
    const a = k * fade3D(C, p.d) * (1 - nightHide(e) * 0.5), len = 70 * p.sc * (0.5 + wetk), w = 5 * p.sc;
    for (const s of [-1, 1]) {
      const x = p.sx + s * 21 * p.sc, g = ctx.createLinearGradient(0, p.sy, 0, p.sy + len);
      g.addColorStop(0, `rgba(255,50,40,${0.55 * a})`); g.addColorStop(1, "rgba(255,50,40,0)");
      ctx.fillStyle = g; ctx.fillRect(x - w, p.sy - 2, 2 * w, len);
    }
  }
  const r = racers && racers[0];
  if (r && r.alive && night > 0.1) {
    const pc = toScreen(C, r.x, r.y) || { sx: W / 2, sy: H + 10, sc: 3 }, far = toScreen(C, r.x, r.y - 460);
    if (far) { // headlight beam reaching up the road
      const g = ctx.createLinearGradient(0, pc.sy, 0, far.sy);
      g.addColorStop(0, `rgba(255,242,205,${0.42 * night})`); g.addColorStop(0.6, `rgba(255,242,205,${0.12 * night})`); g.addColorStop(1, "rgba(255,242,205,0)");
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(pc.sx - 30 * pc.sc, pc.sy - 30 * pc.sc); ctx.lineTo(pc.sx + 30 * pc.sc, pc.sy - 30 * pc.sc); ctx.lineTo(far.sx + 110 * far.sc, far.sy); ctx.lineTo(far.sx - 110 * far.sc, far.sy); ctx.closePath(); ctx.fill();
    }
    if (view3D() === 1) glow(pc.sx, pc.sy - 6 * pc.sc, 70 * pc.sc, brightest(r.team).join(","), 0.55 * night); // neon underglow
  }
  ctx.restore();
}
function drawSplashes() { // rain bouncing off the road, in screen space
  if (!splashes.length) return;
  ctx.save(); ctx.strokeStyle = "rgba(220,232,250,0.55)"; ctx.lineWidth = 1;
  for (const s of splashes) { const k = 1 - s.life / 12; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * (0.4 + k), s.r * (0.4 + k) * 0.35, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

function drawHaze(C) { // fades the far road into the sky so cars and trees never pop in
  const g = ctx.createLinearGradient(0, C.hor - 8, 0, C.hor + 90);
  const c = mix(pal.sky1, [150, 160, 172], rainI * 0.35);
  g.addColorStop(0, rgb(c, 0.95)); g.addColorStop(1, rgb(c, 0));
  ctx.fillStyle = g; ctx.fillRect(-20, C.hor - 8, W + 40, 100);
}

function draw3D(C) {
  const p0 = racers[0], vib = settings.shake ? (state === "playing" ? Math.min(p0.v / VMAX, 1.3) * 0.6 : 0) + nitroFx * 1.8 : 0; // no rattle with screen shake off
  ctx.save();
  ctx.translate(W / 2, H * 0.62);
  ctx.rotate(-(p0.alive ? clamp(p0.tilt, -0.45, 0.45) : 0) * 0.12); // the horizon rolls a touch as you change lanes (never once you've crashed)
  ctx.scale(1.06 + 0.1 * nitroFx, 1.06 + 0.1 * nitroFx);
  ctx.translate(-W / 2 + rnd(-vib, vib), -H * 0.62 + rnd(-vib, vib));
  drawSky(C);
  drawRoad3D(C);
  drawRoadFX(C);
  drawHaze(C);
  drawSpeedStreaks3D(C);
  drawSprites3D(C);
  drawSprayFog(C);
  drawSplashes();
  ctx.restore();
}

// What the driver sees from the cockpit: halo, nose, front wing, front tyres and the steering wheel.
// A rear-view mirror: the road behind you and the cars you've just passed, shrinking away.
function drawMirror(x, y, w, h, side) {
  const r = racers[0], hor = y + h * 0.38, bot = y + h, vx = x + w * (side < 0 ? 0.72 : 0.28), hw = w * 1.15;
  ctx.save();
  ctx.fillStyle = "#08080b"; roundRect(x - 5, y - 5, w + 10, h + 10, 11); ctx.fill();
  ctx.strokeStyle = "#3a3c44"; ctx.lineWidth = 1.5; roundRect(x - 5, y - 5, w + 10, h + 10, 11); ctx.stroke();
  roundRect(x, y, w, h, 7); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, hor); g.addColorStop(0, rgb(pal.sky0)); g.addColorStop(1, rgb(pal.sky1));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, hor - y);
  ctx.fillStyle = rgb(pal.hill); ctx.fillRect(x, hor - 3, w, 4);
  ctx.fillStyle = rgb(pal.grass); ctx.fillRect(x, hor, w, bot - hor);
  ctx.fillStyle = rgb(pal.road); poly([[vx - 1.5, hor], [vx + 1.5, hor], [vx + hw, bot], [vx - hw, bot]]);
  ctx.strokeStyle = "#eee"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(vx - 1.5, hor); ctx.lineTo(vx - hw, bot); ctx.moveTo(vx + 1.5, hor); ctx.lineTo(vx + hw, bot); ctx.stroke();
  ctx.setLineDash([4, 5]); ctx.lineDashOffset = (scrollPos * 0.35) % 9; ctx.beginPath();
  for (const k of [-1 / 3, 1 / 3]) { ctx.moveTo(vx, hor); ctx.lineTo(vx + k * hw, bot); }
  ctx.stroke(); ctx.setLineDash([]);
  const list = [];
  for (const e of enemies) { const dd = e.y - camRefY; if (e.kind !== "works" && dd > -50 && dd < 560) list.push({ dd, x: e.x, e }); }
  for (const o of racers) if (o !== r && o.alive) { const dd = o.y - r.y; if (dd > -50 && dd < 560) list.push({ dd, x: o.x, L: o.team }); }
  list.sort((a, b) => b.dd - a.dd); // farthest first
  for (const c of list) {
    const s = 1 / (1 + Math.max(c.dd, -40) / 90), cy = hor + (bot - hor) * s, cx = vx + ((c.x - W / 2) / (ROAD_W / 2)) * hw * s;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s * 0.9, s * 0.9); if (c.e) drawEnemyRear(c.e, true); else drawCarRear(c.L); ctx.restore();
  }
  const gl = ctx.createLinearGradient(x, y, x + w, y + h); gl.addColorStop(0, "rgba(255,255,255,0.24)"); gl.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = gl; ctx.fillRect(x, y, w, h); ctx.fillStyle = "rgba(120,170,255,0.07)"; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = "#101114"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h + 5); ctx.lineTo(x + w / 2 + (side < 0 ? 16 : -16), y + h + 34); ctx.stroke(); ctx.lineCap = "butt";
}

function drawCockpit(worldW) {
  const W = 400, ox = (worldW - 400) / 2, dy = H - 480; // the cockpit is drawn in a 400x480 frame, centred on wide screens and pinned to the bottom on tall ones
  ctx.save(); ctx.translate(ox, dy);
  const r = racers[0], L = r.team, sw = r.alive ? Math.sin(r.tilt * 2) * 0.35 : 0;
  const carbon = ctx.createLinearGradient(0, 0, W, 0);
  carbon.addColorStop(0, "#0c0c0f"); carbon.addColorStop(0.5, "#23242a"); carbon.addColorStop(1, "#0c0c0f");
  for (const sx of [0, 1]) { // tyres at the lower corners
    ctx.save(); if (sx) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = "#0a0a0c"; ctx.beginPath(); ctx.moveTo(-6, 372); ctx.quadraticCurveTo(70, 356, 118, 396); ctx.lineTo(132, 488); ctx.lineTo(-6, 488); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 400); ctx.quadraticCurveTo(70, 384, 108, 414); ctx.stroke();
    ctx.fillStyle = L.p; ctx.fillRect(-6, 452, 34, 36); ctx.fillStyle = L.s; ctx.fillRect(-6, 452, 34, 6);
    ctx.restore();
  }
  ctx.fillStyle = carbon; ctx.beginPath(); ctx.moveTo(0, 470); ctx.quadraticCurveTo(W / 2, 436, W, 470); ctx.lineTo(W, 488); ctx.lineTo(0, 488); ctx.closePath(); ctx.fill(); // front wing
  ctx.fillStyle = L.a; ctx.beginPath(); ctx.moveTo(30, 474); ctx.quadraticCurveTo(W / 2, 446, W - 30, 474); ctx.lineTo(W - 30, 479); ctx.quadraticCurveTo(W / 2, 452, 30, 479); ctx.closePath(); ctx.fill();
  const gn = ctx.createLinearGradient(W / 2 - 60, 0, W / 2 + 60, 0); // nose cone running up toward the horizon
  gn.addColorStop(0, shade(L.p, -0.35)); gn.addColorStop(0.5, shade(L.p, 0.2)); gn.addColorStop(1, shade(L.p, -0.35));
  ctx.fillStyle = gn; ctx.beginPath(); ctx.moveTo(W / 2 - 13, 330); ctx.lineTo(W / 2 + 13, 330); ctx.lineTo(W / 2 + 62, 462); ctx.lineTo(W / 2 - 62, 462); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#0c0c0f"; for (const [fx, fw] of [[-ox - 4, ox + 8], [396, ox + 8]]) { ctx.fillRect(fx, 470, fw, 22); ctx.fillRect(fx, -2 - dy, fw, 22); } // bands run out to the screen edges
  ctx.fillStyle = L.s; ctx.beginPath(); ctx.moveTo(W / 2 - 3, 330); ctx.lineTo(W / 2 + 3, 330); ctx.lineTo(W / 2 + 9, 462); ctx.lineTo(W / 2 - 9, 462); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(0, -dy); // the top of the opening stays at the top of the screen
  ctx.fillStyle = carbon; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 20); ctx.quadraticCurveTo(W / 2, 46, 0, 20); ctx.closePath(); ctx.fill(); // top of the opening
  ctx.restore();
  ctx.save(); ctx.translate(W / 2, 424); ctx.rotate(sw); // steering wheel (turns with the car) with its display
  roundRect(-78, -2, 156, 56, 14); ctx.fillStyle = "#15161a"; ctx.fill(); ctx.strokeStyle = "#3a3c44"; ctx.lineWidth = 2; ctx.stroke();
  roundRect(-38, 4, 76, 38, 5); ctx.fillStyle = "#050607"; ctx.fill();
  const lit = Math.round(rpmOf(effV(r)) * 10);
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i < lit ? (i < 4 ? "#39ff6a" : i < 8 ? "#ff3b30" : "#3b82ff") : "#262830"; ctx.beginPath(); ctx.arc(-31.5 + i * 7, 9.5, 2.3, 0, TAU); ctx.fill(); }
  textAt(String(gearOf(r.v)), -20, 36, 24, "center", "#fff");
  textAt(String(Math.round(r.v * 60)), 14, 30, 15, "center", "#ffd23f");
  textAt("km/h", 14, 40, 8, "center", "#aaa");
  ctx.fillStyle = L.a; ctx.beginPath(); ctx.arc(-62, 18, 5, 0, TAU); ctx.arc(62, 18, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = L.helmet; roundRect(-84, 30, 20, 26, 8); ctx.fill(); roundRect(64, 30, 20, 26, 8); ctx.fill(); // gloved hands
  ctx.restore();
  ctx.restore();
  drawMirror(16, 252 + dy, 100, 64, -1); drawMirror(worldW - 116, 252 + dy, 100, 64, 1); // side mirrors
}

// on a tall screen the chase cam's horizon drops by half the extra height; the cockpit's drops all the way so the dash stays at the bottom
const camFor = v => ({ ...CAMS[v], hor: CAMS[v].hor + (H - 480) * (v === 2 ? 1 : 0.5), f: CAMS[v].f * (1 - 0.16 * kickFx) }); // firing nitro briefly widens the view
// where a racer appears on screen in the current view (for popups beside the car)
function racerScreen(r) {
  if (window.R3D) return window.R3D.racerScreen(r);
  const v = view3D();
  if (v === 0) return { x: r.x, y: r.y - 30 };
  const p = v === 1 ? toScreen(camFor(v), r.x, r.y) : null;
  return p ? { x: p.sx, y: p.sy - 40 * p.sc } : { x: W / 2 + (r.x - W / 2) * 0.5, y: H * 0.55 };
}

function drawWorld() {
  const v = view3D();
  ctx.save();
  if (shake > 0.5 && settings.shake) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  if (v === 0) drawTopDown(); else draw3D(camFor(v));
  drawWeather();
  if (v === 2) drawCockpit(W);
  ctx.restore();
}

function drawWeather() {
  let any = false;
  ctx.strokeStyle = "rgba(200,218,240,0.5)"; ctx.lineWidth = 1.2; ctx.beginPath();
  for (const p of wx) if (p.t === "rain") { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 1.4, p.y - p.len); any = true; }
  if (any) ctx.stroke();
  for (const p of wx) if (p.t === "petal") { // cherry blossom
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
}

function drawAtmosphere() {
  // the city tint, rain gloom and night darkness used to be three full-screen fills; stacked alpha layers collapse into one
  const layers = [[pal.tint, pal.tint[3] > 0.005 ? pal.tint[3] : 0], [[40, 55, 80], rainI > 0.02 ? rainI * 0.2 : 0], [[5, 10, 45], pal.dark > 0.01 ? pal.dark : 0]];
  let A = 0; const col = [0, 0, 0];
  for (const [c, a] of layers) { if (!a) continue; for (let k = 0; k < 3; k++) col[k] = col[k] * A * (1 - a) + c[k] * a; A = A + a * (1 - A); for (let k = 0; k < 3; k++) col[k] /= A; }
  if (A > 0.005) { ctx.fillStyle = `rgba(${col.map(Math.round).join(",")},${A.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  if (lightning.t > 0.03) { ctx.fillStyle = `rgba(215,228,255,${0.45 * lightning.t * lightning.t})`; ctx.fillRect(0, 0, W, H); } // the flash

  if (pal.dark > 0.06 && view3D() === 0) { // headlight beams (overhead view)
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const r of racers) {
      if (!r.alive) continue;
      const y0 = r.y - CAR_H / 2 + 4, g = ctx.createLinearGradient(0, y0, 0, y0 - 190), a = Math.min(0.7, pal.dark * 2.5);
      g.addColorStop(0, `rgba(255,240,180,${a})`); g.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(r.x - 12, y0); ctx.lineTo(r.x + 12, y0); ctx.lineTo(r.x + 58, y0 - 190); ctx.lineTo(r.x - 58, y0 - 190);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  const nf = Math.min(1, nitroFx + (view3D() ? kickFx * 0.8 : 0)); // the moment you fire, the 3D views get an extra burst of streaks
  if (nf > 0.02) { // nitro: blue edge glow and streaks rushing out from the centre
    const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.78);
    g.addColorStop(0, "rgba(40,150,255,0)"); g.addColorStop(1, `rgba(40,150,255,${0.5 * nf})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (let i = 0, n = settings.lowfx ? 14 : 46; i < n; i++) {
      const ang = (i * 2.399) % TAU, ph = (clock * (0.035 + (i % 5) * 0.012) + i * 0.137) % 1, r0 = 70 + ph * ph * 340, r1 = r0 + 24 + ph * 120;
      ctx.strokeStyle = `rgba(${150 + (i % 3) * 35},230,255,${0.55 * nf * (0.25 + ph)})`; ctx.lineWidth = 1 + ph * 1.8;
      ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(ang) * r0, H * 0.5 + Math.sin(ang) * r0 * 1.15); ctx.lineTo(W / 2 + Math.cos(ang) * r1, H * 0.5 + Math.sin(ang) * r1 * 1.15); ctx.stroke();
    }
    ctx.restore();
  }
}

