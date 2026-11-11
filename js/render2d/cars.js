// ---------- drawing: cars ----------

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function tyre(x, y, w, h) {
  roundRect(x, y, w, h, 2.5);
  ctx.fillStyle = "#0d0d10"; ctx.fill();
  ctx.fillStyle = "#26262c"; ctx.fillRect(x + w / 2 - 0.6, y + 2, 1.2, h - 4);
  ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x + 1, y + 1, w - 2, 2.5);
}

// A top-down open-wheel race car centred on the origin, nose pointing up (about 76 units long, 52 wide).
function drawCar(L, o = {}) {
  const dark = "#17181c";
  ctx.fillStyle = "rgba(0,0,0,0.28)"; roundRect(-17, -27, 40, 66, 8); ctx.fill(); // ground shadow
  ctx.strokeStyle = "#2b2d33"; ctx.lineWidth = 1.6; ctx.beginPath();
  for (const sx of [-1, 1]) {
    ctx.moveTo(sx * 6, -20); ctx.lineTo(sx * 15, -19); ctx.moveTo(sx * 6, -14); ctx.lineTo(sx * 15, -17);
    ctx.moveTo(sx * 7, 16); ctx.lineTo(sx * 15, 17); ctx.moveTo(sx * 7, 22); ctx.lineTo(sx * 15, 20);
  }
  ctx.stroke();
  tyre(-24, -28, 9, 18); tyre(15, -28, 9, 18); tyre(-26, 6, 11, 22); tyre(15, 6, 11, 22);
  ctx.fillStyle = dark; roundRect(-23, -37, 46, 5, 1.5); ctx.fill();
  ctx.fillStyle = L.a; ctx.fillRect(-21, -32, 42, 2.2);
  ctx.fillStyle = L.p; ctx.fillRect(-24, -38, 2.6, 10); ctx.fillRect(21.4, -38, 2.6, 10);
  ctx.fillStyle = L.s; ctx.fillRect(-24, -38, 2.6, 3); ctx.fillRect(21.4, -38, 2.6, 3);
  const gn = ctx.createLinearGradient(-5, 0, 5, 0);
  gn.addColorStop(0, shade(L.p, -0.25)); gn.addColorStop(0.5, shade(L.p, 0.25)); gn.addColorStop(1, shade(L.p, -0.25));
  ctx.fillStyle = gn;
  ctx.beginPath(); ctx.moveTo(-2.5, -33); ctx.lineTo(2.5, -33); ctx.lineTo(5.5, -12); ctx.lineTo(-5.5, -12); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, shade(L.p, -0.3)); g.addColorStop(0.35, shade(L.p, 0.18)); g.addColorStop(0.65, shade(L.p, 0.1)); g.addColorStop(1, shade(L.p, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-5.5, -14); ctx.lineTo(5.5, -14); ctx.lineTo(9.5, -4); ctx.lineTo(12.5, 8); ctx.lineTo(10.5, 24);
  ctx.lineTo(6, 32); ctx.lineTo(-6, 32); ctx.lineTo(-10.5, 24); ctx.lineTo(-12.5, 8); ctx.lineTo(-9.5, -4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = L.s; ctx.lineWidth = 1.8; ctx.beginPath();
  ctx.moveTo(-10.5, 0); ctx.lineTo(-11, 22); ctx.moveTo(10.5, 0); ctx.lineTo(11, 22); ctx.stroke();
  ctx.fillStyle = "#0b0b0e"; ctx.fillRect(-10, -5, 3.5, 5); ctx.fillRect(6.5, -5, 3.5, 5);
  ctx.fillStyle = L.s; ctx.fillRect(-1.6, -31, 3.2, 17);
  ctx.fillStyle = L.s; roundRect(-3.6, 0, 7.2, 31, 3); ctx.fill();
  ctx.fillStyle = L.a; ctx.fillRect(-0.7, 4, 1.4, 26);
  ctx.fillStyle = "#0b0b0e"; ctx.beginPath(); ctx.ellipse(0, 3.5, 3.6, 4.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#08080b"; ctx.beginPath(); ctx.ellipse(0, -6, 4.8, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = L.helmet; ctx.beginPath(); ctx.arc(0, -5.5, 3.3, 0, TAU); ctx.fill();
  ctx.fillStyle = "#101018"; ctx.fillRect(-2.2, -8.2, 4.4, 1.8);
  ctx.strokeStyle = "#2c2e35"; ctx.lineWidth = 1.7; ctx.beginPath();
  ctx.moveTo(0, -13); ctx.lineTo(-4.6, -6); ctx.lineTo(-4, 2); ctx.moveTo(0, -13); ctx.lineTo(4.6, -6); ctx.lineTo(4, 2); ctx.stroke();
  ctx.fillStyle = dark; roundRect(-20, 29, 40, 5.5, 1.5); ctx.fill();
  if (o.slip) { ctx.fillStyle = "#3d3f46"; ctx.fillRect(-19, 35.6, 38, 1.2); ctx.fillStyle = "rgba(57,255,20,0.55)"; ctx.fillRect(-19, 34.4, 38, 1.1); }
  else { ctx.fillStyle = L.a; ctx.fillRect(-19, 34.5, 38, 3); }
  ctx.fillStyle = L.p; ctx.fillRect(-21, 28, 2.6, 11); ctx.fillRect(18.4, 28, 2.6, 11);
  if (o.brake) {
    const rg = ctx.createRadialGradient(0, 39, 1, 0, 39, 20);
    rg.addColorStop(0, "rgba(255,40,40,0.85)"); rg.addColorStop(1, "rgba(255,40,40,0)");
    ctx.fillStyle = rg; ctx.fillRect(-22, 20, 44, 40);
  }
  ctx.fillStyle = o.brake ? "#ff4040" : "#a01818"; ctx.fillRect(-2, 37.5, 4, 2);
  if (o.nitro) { // twin blue-white exhaust flames
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const len = 38 + Math.random() * 30, fg = ctx.createLinearGradient(0, 38, 0, 38 + len);
    fg.addColorStop(0, "rgba(255,255,255,0.95)"); fg.addColorStop(0.35, "rgba(110,210,255,0.85)"); fg.addColorStop(1, "rgba(40,110,255,0)");
    ctx.fillStyle = fg;
    for (const ex of [-4.5, 4.5]) { ctx.beginPath(); ctx.moveTo(ex - 3.6, 38); ctx.lineTo(ex + 3.6, 38); ctx.lineTo(ex + rnd(-1.5, 1.5), 38 + len); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}

// The same car seen from behind, for the chase and driver views. Origin = bottom centre (where the tyres meet the road).
function drawCarRear(L, o = {}) {
  const dark = "#17181c";
  ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(0, -1, 31, 6, 0, 0, TAU); ctx.fill();
  for (const x of [-27, 15]) { // rear tyres
    roundRect(x, -26, 12, 26, 3); ctx.fillStyle = "#0d0d10"; ctx.fill();
    ctx.fillStyle = "#26262c"; ctx.fillRect(x + 5.4, -23, 1.2, 20);
    ctx.fillStyle = "rgba(255,255,255,0.09)"; ctx.fillRect(x + 1, -25, 10, 2);
  }
  ctx.fillStyle = "#101114"; ctx.fillRect(-14, -5, 28, 5);          // diffuser
  ctx.fillStyle = "#2a2c32"; ctx.fillRect(-6, -19, 12, 15);         // gearbox
  const gs = ctx.createLinearGradient(-13, 0, 13, 0);
  gs.addColorStop(0, shade(L.p, -0.3)); gs.addColorStop(0.5, shade(L.p, 0.15)); gs.addColorStop(1, shade(L.p, -0.3));
  ctx.fillStyle = gs; ctx.fillRect(-13, -23, 7, 17); ctx.fillRect(6, -23, 7, 17); // sidepods
  ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(9, -8); ctx.lineTo(5.5, -34); ctx.lineTo(-5.5, -34); ctx.closePath(); ctx.fill(); // engine cover
  ctx.fillStyle = L.s; ctx.fillRect(-1.6, -34, 3.2, 26);
  ctx.strokeStyle = L.a; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-4, -33); ctx.moveTo(6, -10); ctx.lineTo(4, -33); ctx.stroke();
  ctx.fillStyle = "#0b0b0e"; ctx.beginPath(); ctx.ellipse(0, -36, 4.2, 5, 0, 0, TAU); ctx.fill(); // airbox
  ctx.fillStyle = L.helmet; ctx.beginPath(); ctx.arc(0, -41, 4.2, 0, TAU); ctx.fill();            // helmet
  ctx.strokeStyle = "#2c2e35"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -40, 7.5, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); // halo
  ctx.fillStyle = dark; ctx.fillRect(-1.6, -25, 3.2, 11);          // wing pillar
  ctx.fillStyle = dark; roundRect(-20, -31, 40, 6, 1.5); ctx.fill(); // rear wing
  if (o.slip) { ctx.fillStyle = L.a; ctx.fillRect(-19, -40, 38, 3.4); ctx.fillStyle = "rgba(57,255,20,0.5)"; ctx.fillRect(-19, -36.6, 38, 1.6); }
  else { ctx.fillStyle = L.a; ctx.fillRect(-19, -37, 38, 5.5); }
  ctx.fillStyle = L.p; ctx.fillRect(-22, -39, 2.6, 17); ctx.fillRect(19.4, -39, 2.6, 17);
  ctx.fillStyle = L.s; ctx.fillRect(-22, -39, 2.6, 4); ctx.fillRect(19.4, -39, 2.6, 4);
  if (o.brake) {
    const rg = ctx.createRadialGradient(0, -12, 1, 0, -12, 22);
    rg.addColorStop(0, "rgba(255,40,40,0.9)"); rg.addColorStop(1, "rgba(255,40,40,0)");
    ctx.fillStyle = rg; ctx.fillRect(-26, -36, 52, 48);
  }
  ctx.fillStyle = o.brake ? "#ff4040" : "#a01818"; ctx.fillRect(-2.5, -14, 5, 3.2);
  if (o.nitro) { // flames blasting toward the camera
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const ex of [-5, 5]) {
      const f = 0.8 + Math.random() * 0.5, g = ctx.createRadialGradient(ex, -10, 1, ex, -4, 24 * f);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.3, "rgba(120,210,255,0.8)"); g.addColorStop(1, "rgba(40,110,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, -2, 9 * f, 28 * f, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

function drawShieldIcon(x, y, r, t) { // a glowing cyan shield badge
  glow(x, y, r * 2.4, "80,230,255", 0.35 + 0.15 * Math.sin(t / 6));
  ctx.fillStyle = "#0d4a66"; ctx.strokeStyle = "#7fffff"; ctx.lineWidth = Math.max(1.5, r * 0.15);
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.85, y - r * 0.6); ctx.lineTo(x + r * 0.7, y + r * 0.35); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7, y + r * 0.35); ctx.lineTo(x - r * 0.85, y - r * 0.6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#7fffff"; ctx.fillRect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 1.0); ctx.fillRect(x - r * 0.45, y - r * 0.15, r * 0.9, r * 0.24);
}
function drawPickupIcon(k, x, y, s) {
  if (k.type === "nitro") return drawNitroIcon(x, y, 13 * s, clock);
  if (k.type === "shield") return drawShieldIcon(x, y, 13 * s, clock);
  if (!settings.lowfx) glow(x, y, 22 * s, "255,210,63", 0.35 + 0.15 * Math.sin(clock / 6 + k.y / 30)); // coins shimmer
  drawCoin(x, y, 10 * s, Math.cos(clock / 8 + k.y / 20));
}
function drawShieldBubble(cx, cy, rx, ry) { // the bubble round a shielded car
  const a = 0.35 + 0.12 * Math.sin(clock / 5);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(110,240,255,${a + 0.3})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = `rgba(80,220,255,${a * 0.35})`; ctx.fill();
  ctx.restore();
}

function drawNitroIcon(x, y, r, t) {
  ctx.save();
  ctx.translate(x, y);
  const pulse = 0.5 + 0.5 * Math.sin(t / 6), g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.4);
  g.addColorStop(0, `rgba(90,210,255,${0.55 + 0.3 * pulse})`); g.addColorStop(1, "rgba(40,120,255,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, TAU); ctx.fill();
  const cg = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
  cg.addColorStop(0, "#1b5cd6"); cg.addColorStop(0.5, "#6fe0ff"); cg.addColorStop(1, "#1b5cd6");
  roundRect(-r * 0.6, -r, r * 1.2, r * 2, r * 0.5); ctx.fillStyle = cg; ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath();
  ctx.moveTo(r * 0.15, -r * 0.75); ctx.lineTo(-r * 0.35, r * 0.1); ctx.lineTo(-r * 0.02, r * 0.1); ctx.lineTo(-r * 0.15, r * 0.75); ctx.lineTo(r * 0.38, -r * 0.15); ctx.lineTo(r * 0.05, -r * 0.15);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---- traffic drawing: overhead (nose up, centred) and from behind (origin where the tyres meet the road) ----
const blinkOn = e => e.blink > 0 && Math.floor(e.blink / 8) % 2 === 0;
function drawRoadCar(col) { // a plain saloon seen from above
  ctx.fillStyle = "rgba(0,0,0,0.28)"; roundRect(-15, -31, 34, 68, 9); ctx.fill();
  ctx.fillStyle = col; roundRect(-17, -34, 34, 68, 9); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(-14, -31, 8, 62, 4); ctx.fill(); // sheen
  ctx.fillStyle = "#1b2633"; roundRect(-13, -17, 26, 11, 3); ctx.fill(); roundRect(-12, 16, 24, 8, 3); ctx.fill(); // windscreen, rear window
  ctx.fillStyle = shade(col, -0.12); roundRect(-12, -6, 24, 22, 3); ctx.fill(); // roof
  ctx.fillStyle = "#fff6c8"; ctx.fillRect(-14, -34, 7, 3); ctx.fillRect(7, -34, 7, 3); // headlights
  ctx.fillStyle = "#c81e1e"; ctx.fillRect(-14, 31, 7, 3); ctx.fillRect(7, 31, 7, 3); // tail lights
  ctx.fillStyle = col; ctx.fillRect(-20, -12, 3, 5); ctx.fillRect(17, -12, 3, 5); // mirrors
}
function drawTruck(e) { // cab up front, a long box trailer behind
  const L = e.len, top = -L / 2;
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(-17, top + 4, 38, L);
  ctx.fillStyle = e.col; roundRect(-17, top, 34, 38, 6); ctx.fill();
  ctx.fillStyle = "#1b2633"; ctx.fillRect(-14, top + 6, 28, 9);
  ctx.fillStyle = "#d9dce1"; ctx.fillRect(-19, top + 42, 38, L - 42);
  ctx.fillStyle = "rgba(0,0,0,0.12)"; for (let y = top + 52; y < L / 2 - 6; y += 14) ctx.fillRect(-19, y, 38, 2); // roof ribs
  ctx.fillStyle = e.col; ctx.fillRect(-19, top + 42, 38, 5);
  ctx.fillStyle = "#c81e1e"; ctx.fillRect(-18, L / 2 - 3, 7, 3); ctx.fillRect(11, L / 2 - 3, 7, 3);
}
function drawCone(x, y, s = 1) { ctx.fillStyle = "#ff6a00"; ctx.beginPath(); ctx.arc(x, y, 6 * s, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 3 * s, 0, TAU); ctx.fill(); ctx.fillStyle = "#ff6a00"; ctx.beginPath(); ctx.arc(x, y, 1.5 * s, 0, TAU); ctx.fill(); }
function worksSignX(e) { return e.lane === 0 ? ROAD_L - 22 : ROAD_R + 22; } // on the verge beside the closed lane (right-hand verge for the middle)
function drawWorksSign(x, y) { // orange diamond on a post: ROAD WORKS
  ctx.fillStyle = "#555"; ctx.fillRect(x - 1.5, y - 4, 3, 22);
  ctx.save(); ctx.translate(x, y - 14); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#ff8c1a"; ctx.fillRect(-12, -12, 24, 24); ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.strokeRect(-10, -10, 20, 20); ctx.restore();
  textAt("!", x, y - 8, 14, "center", "#111");
}
function drawWorks(e) { // a lane closed by cones, with a striped barrier where it starts and a warning sign well before
  const L = e.len, near = L / 2, side = e.lane === 0 ? -1 : 1;
  for (let y = -L / 2; y <= near - 70; y += 30) drawCone(0, y);
  for (let i = 0; i < 4; i++) drawCone(side * (38 - i * 12), near - 10 - i * 18); // taper in from the lane edge
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#e8401c"; ctx.fillRect(-36 + i * 12, near - 6, 12, 6); } // barrier
  const sx = worksSignX(e) - e.x;
  if (worksSignX(e) > 30 && worksSignX(e) < W - 30) { drawWorksSign(sx, near + SIGN_AHEAD); textAt("ROAD WORKS", sx, near + SIGN_AHEAD + 30, 9, "center", "#ffb347"); } // only when the verge is on screen
  const ay = near + SIGN_AHEAD - 10, to = e.lane === 0 ? 1 : -1; // painted on the closed lane too (the verge can be off screen on a phone): an arrow toward the open lane
  ctx.fillStyle = "rgba(255,140,26,0.75)"; ctx.beginPath(); ctx.moveTo(-to * 18, ay + 22); ctx.lineTo(to * 6, ay - 4); ctx.lineTo(to * 6, ay - 14); ctx.lineTo(to * 26, ay); ctx.lineTo(to * 6, ay + 14); ctx.lineTo(to * 6, ay + 4); ctx.lineTo(-to * 10, ay + 22); ctx.closePath(); ctx.fill();
  textAt("LANE CLOSED", 0, ay + 40, 10, "center", "#ffb347");
}
function drawIndicator(e, x, y, r) { if (blinkOn(e)) glow(x + (e.to < e.lane ? -1 : 1) * Math.abs(r), y, 14, "255,170,0", 0.95); }

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.kind === "works") { drawWorks(e); ctx.restore(); return; }
  if (e.kind === "truck") drawTruck(e); else drawRoadCar(e.col);
  drawIndicator(e, 0, -30, 16); drawIndicator(e, 0, 30, 16); // front and rear indicators
  const h = nightHide(e), back = lenOf(e) / 2;
  if (h > 0) { // swallowed by the dark: just two red tail lights
    ctx.fillStyle = `rgba(4,6,16,${0.93 * h})`; roundRect(-22, -back - 4, 44, lenOf(e) + 8, 10); ctx.fill();
    for (const x of [-11, 11]) { glow(x, back - 2, 12, "255,30,30", 0.9 * h + 0.1); ctx.fillStyle = "#ff3030"; ctx.fillRect(x - 3, back - 4, 6, 3); }
    drawIndicator(e, 0, back - 2, 16);
  }
  ctx.restore();
}
// the wall of spray off the car right ahead: the road beyond it goes misty until you pull out of its wake
function drawSprayFog(C) {
  if (sprayFog < 0.02 || !sprayCar) return;
  let y0 = sprayCar.y + 10;
  if (C) { const p = toScreen(C, sprayCar.x, sprayCar.y); if (!p) return; y0 = p.sy; }
  const top = C ? C.hor - 10 : 0, a = 0.45 * sprayFog, g = ctx.createLinearGradient(0, y0, 0, Math.max(top, y0 - 90));
  g.addColorStop(0, "rgba(215,225,238,0)"); g.addColorStop(1, `rgba(215,225,238,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, Math.max(top, y0 - 90), W, y0 - Math.max(top, y0 - 90));
  if (y0 - 90 > top) { ctx.fillStyle = `rgba(215,225,238,${a})`; ctx.fillRect(0, top, W, y0 - 90 - top); }
}

function drawRoadCarRear(col) { // a saloon from behind
  ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(0, -1, 32, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#111"; ctx.fillRect(-27, -9, 11, 9); ctx.fillRect(16, -9, 11, 9); // tyres
  ctx.fillStyle = shade(col, -0.15); ctx.beginPath(); ctx.moveTo(-19, -46); ctx.lineTo(19, -46); ctx.lineTo(25, -30); ctx.lineTo(-25, -30); ctx.closePath(); ctx.fill(); // cabin
  ctx.fillStyle = "#1b2633"; ctx.beginPath(); ctx.moveTo(-16, -44); ctx.lineTo(16, -44); ctx.lineTo(21, -32); ctx.lineTo(-21, -32); ctx.closePath(); ctx.fill(); // rear window
  ctx.fillStyle = col; roundRect(-29, -31, 58, 25, 5); ctx.fill(); // boot and bumper
  ctx.fillStyle = "#c81e1e"; ctx.fillRect(-27, -26, 11, 6); ctx.fillRect(16, -26, 11, 6); // tail lights
  ctx.fillStyle = "#f2f2f2"; ctx.fillRect(-7, -17, 14, 6); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(-29, -9, 58, 3);
}
function drawTruckRear(col) { // a tall box trailer
  ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(0, -1, 34, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#111"; ctx.fillRect(-28, -10, 12, 10); ctx.fillRect(16, -10, 12, 10);
  ctx.fillStyle = "#d9dce1"; ctx.fillRect(-31, -96, 62, 84); ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1.5; ctx.strokeRect(-31, -96, 62, 84);
  ctx.beginPath(); ctx.moveTo(0, -94); ctx.lineTo(0, -14); ctx.stroke(); // doors
  ctx.fillStyle = col; ctx.fillRect(-31, -96, 62, 6);
  ctx.fillStyle = "#c81e1e"; ctx.fillRect(-30, -20, 9, 6); ctx.fillRect(21, -20, 9, 6);
  ctx.fillStyle = "#333"; ctx.fillRect(-28, -12, 56, 3); // under-run bar
}
function drawCone3D() { ctx.fillStyle = "#ff6a00"; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(1.5, -18); ctx.lineTo(-1.5, -18); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillRect(-4, -10, 8, 3); ctx.fillStyle = "#222"; ctx.fillRect(-8, -1, 16, 2); }
function drawBarrier3D() { ctx.fillStyle = "#444"; ctx.fillRect(-26, -16, 3, 16); ctx.fillRect(23, -16, 3, 16); for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#e8401c"; ctx.fillRect(-30 + i * 10, -26, 10, 10); } }
function drawSign3D() { ctx.fillStyle = "#555"; ctx.fillRect(-2, -60, 4, 60); ctx.save(); ctx.translate(0, -70); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#ff8c1a"; ctx.fillRect(-16, -16, 32, 32); ctx.strokeStyle = "#111"; ctx.lineWidth = 2.5; ctx.strokeRect(-13, -13, 26, 26); ctx.restore(); ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#111"; ctx.fillText("!", 0, -62); }

function drawEnemyRear(e, inMirror = false) { // 3D version: by kind, with indicators and the night treatment
  if (e.kind === "truck") drawTruckRear(e.col); else drawRoadCarRear(e.col);
  if (blinkOn(e)) glow((e.to < e.lane ? -1 : 1) * 22, -23, 16, "255,170,0", 0.95);
  const h = inMirror ? 0 : nightHide(e), tall = e.kind === "truck" ? 100 : 52;
  if (h > 0) {
    ctx.fillStyle = `rgba(4,6,16,${0.93 * h})`; ctx.fillRect(-33, -tall, 66, tall + 2);
    for (const x of [-21, 21]) { glow(x, -22, 14, "255,30,30", 0.9 * h + 0.1); ctx.fillStyle = "#ff3030"; ctx.fillRect(x - 4, -24, 8, 4); }
  }
}

function drawRacer(r) {
  ctx.save();
  if (!r.alive) ctx.globalAlpha = 0.55;
  else if (r.ghost > 0 && Math.floor(r.ghost / 5) % 2) ctx.globalAlpha = 0.35; // flashing after a bump
  ctx.translate(r.x, r.y);
  ctx.rotate(r.tilt);
  drawCar(r.team, { brake: r.alive && r.braking, slip: r.alive && r.v >= 4.6, nitro: r.alive && r.nitro > 0 });
  if (r.shield && r.alive) drawShieldBubble(0, 0, 34, 48);
  ctx.restore();
}

function drawCoin(x, y, r, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(0.25, Math.abs(spin)), 1);
  ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#c98f00"; ctx.lineWidth = Math.max(1, r * 0.2); ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.stroke();
  ctx.restore();
}

