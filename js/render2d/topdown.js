// ---------- drawing: top-down world (overhead camera) ----------

function drawGround() {
  ctx.fillStyle = rgb(pal.grass); ctx.fillRect(-20, -20, W + 40, H + 40);
  const alt = rgb(pal.grassAlt), off = scrollPos % 120; // mown stripes
  ctx.fillStyle = alt;
  for (let y = -120 + off; y < H; y += 120) { ctx.fillRect(-20, y, ROAD_L + 20, 60); ctx.fillRect(ROAD_R, y, W - ROAD_R + 20, 60); }
  if (grassPat) {
    ctx.save(); ctx.translate(0, scrollPos % 128);
    ctx.fillStyle = grassPat;
    ctx.fillRect(-20, -128, ROAD_L + 20, H + 256); ctx.fillRect(ROAD_R, -128, W - ROAD_R + 20, H + 256);
    ctx.restore();
  }
}

function drawRoad() {
  ctx.fillStyle = rgb(pal.road); ctx.fillRect(ROAD_L, -20, ROAD_W, H + 40);
  if (roadPat) {
    ctx.save(); ctx.translate(0, scrollPos % 128);
    ctx.fillStyle = roadPat; ctx.fillRect(ROAD_L, -128, ROAD_W, H + 256);
    ctx.restore();
  }
  if (wet > 0.03) { // wet-asphalt sheen
    const g = ctx.createLinearGradient(ROAD_L, 0, ROAD_R, H);
    g.addColorStop(0, "rgba(180,200,235,0)"); g.addColorStop(0.5, `rgba(180,200,235,${wet * 0.16})`); g.addColorStop(1, "rgba(180,200,235,0)");
    ctx.fillStyle = g; ctx.fillRect(ROAD_L, 0, ROAD_W, H);
  }
  for (const it of roadItems) drawRoadItem(it);

  const so = scrollPos % 40, edge = 1;
  for (let y = -40 + so; y < H; y += 40) { // rumble strips
    ctx.globalAlpha = edge;
    ctx.fillStyle = "#d62828"; ctx.fillRect(ROAD_L - 6, y, 6, 20); ctx.fillRect(ROAD_R, y, 6, 20);
    ctx.fillStyle = "#f1f1f1"; ctx.fillRect(ROAD_L - 6, y + 20, 6, 20); ctx.fillRect(ROAD_R, y + 20, 6, 20);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#eee";
  ctx.fillRect(ROAD_L, -20, 3, H + 40); ctx.fillRect(ROAD_R - 3, -20, 3, H + 40);
  for (let l = 1; l < LANES; l++) {
    for (let y = -40 + so; y < H; y += 40) ctx.fillRect(ROAD_L + l * LANE_W - 2, y, 4, 22);
  }
}

function drawSpeedLines() {
  const v = state === "playing" ? racers[0].v : 0;
  if (v < 3) return;
  ctx.strokeStyle = `rgba(255,255,255,${clamp((v - 3) / 3, 0, 1) * 0.16})`;
  ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const x = ROAD_L + 6 + (i * 53) % (ROAD_W - 12), y = (scrollPos * (1.6 + (i % 3) * 0.5) + i * 67) % (H + 120) - 60;
    ctx.moveTo(x, y); ctx.lineTo(x, y + 30 + v * 12);
  }
  ctx.stroke();
}

// ---- the start: chequered line, grid boxes and the five-light gantry ----
const lightStates = () => grid.done ? [2, 2, 2, 2, 2] : [0, 1, 2, 3, 4].map(i => i < grid.lit ? 1 : 0); // 0 off, 1 red, 2 green
function lamp(x, y, r, st) {
  ctx.fillStyle = st === 1 ? "#ff2b2b" : st === 2 ? "#3dff6e" : "#3a1b1b"; circle(x, y, r);
  ctx.fillStyle = "rgba(255,255,255,0.35)"; circle(x - r * 0.3, y - r * 0.3, r * 0.35);
  if (st) glow(x, y, r * 4, st === 1 ? "255,40,40" : "60,255,110", 0.55);
}

function drawStartLine(y = startObj.y, boxes = true) { // also the finish line (no grid boxes there)
  for (let i = 0; i < 20; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? "#111" : "#f4f4f4"; ctx.fillRect(ROAD_L + i * ROAD_W / 20, y + j * 6, ROAD_W / 20 + 0.5, 6); }
  if (!boxes) return;
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2; // the grid boxes
  for (const r of racers) { const cx = laneX(r.slot.lane), cy = y + 50 + r.slot.off; ctx.beginPath(); ctx.moveTo(cx - 24, cy - 40); ctx.lineTo(cx - 24, cy - 28); ctx.moveTo(cx + 24, cy - 40); ctx.lineTo(cx + 24, cy - 28); ctx.moveTo(cx - 24, cy + 38); ctx.lineTo(cx - 24, cy + 28); ctx.moveTo(cx + 24, cy + 38); ctx.lineTo(cx + 24, cy + 28); ctx.stroke(); }
}

function drawGantryTop(y0 = startObj.y, finish = false) { // seen from above: a beam across the road, pillars on the verges, the lights (or a FINISH board) in the middle
  const y = y0 - 24, st = lightStates();
  ctx.fillStyle = "#26282e"; ctx.fillRect(ROAD_L - 16, y - 8, ROAD_W + 32, 16); ctx.fillStyle = "#3a3d46"; ctx.fillRect(ROAD_L - 16, y - 8, ROAD_W + 32, 3);
  ctx.fillStyle = "#15161a"; ctx.fillRect(ROAD_L - 24, y - 12, 14, 24); ctx.fillRect(ROAD_R + 10, y - 12, 14, 24);
  roundRect(W / 2 - 64, y - 11, 128, 22, 6); ctx.fillStyle = "#0d0e12"; ctx.fill();
  if (finish) textAt("FINISH", W / 2, y + 6, 15, "center", "#ffd23f");
  else st.forEach((s2, i) => lamp(W / 2 - 48 + i * 24, y, 7, s2));
}

function drawGantry3D(finish = false) { // local units; the road is 2*88 wide on screen; the finish gantry has a FINISH board instead of lights
  const st = lightStates(), hw = 94;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ell(0, 0, hw + 14, 4);
  ctx.fillStyle = "#2a2c33"; ctx.fillRect(-hw - 8, -90, 10, 90); ctx.fillRect(hw - 2, -90, 10, 90);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(-hw - 8, -90, 3, 90); ctx.fillRect(hw - 2, -90, 3, 90);
  ctx.fillStyle = "#1c1e24"; ctx.fillRect(-hw - 10, -100, 2 * hw + 20, 15); ctx.fillStyle = "#3a3d46"; ctx.fillRect(-hw - 10, -100, 2 * hw + 20, 3);
  ctx.fillStyle = "#e10600"; ctx.fillRect(-hw + 2, -97, 44, 10); ctx.fillRect(hw - 46, -97, 44, 10);
  ctx.font = "bold 7px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText("EXTREME", -hw + 24, -89.5); ctx.fillText("RACING", hw - 24, -89.5);
  roundRect(-42, -86, 84, 34, 6); ctx.fillStyle = "#0d0e12"; ctx.fill();
  if (finish) { ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#ffd23f"; ctx.fillText("FINISH", 0, -63); }
  else st.forEach((s2, i) => { lamp(-32 + i * 16, -77, 5.4, s2); lamp(-32 + i * 16, -62, 5.4, s2); });
}

function drawTopDown() {
  drawGround();
  for (const s of scenery) if ((!s.far || s.kind === "lm" || s.kind === "prop") && s.y > -80 && s.kind !== "tree") drawScenery(s);
  drawRoad();
  if (startObj) drawStartLine();
  if (finishObj) drawStartLine(finishObj.y, false);
  drawSpeedLines();
  for (const k of pickups) {
    if (k.y < -30) continue;
    drawPickupIcon(k, k.x, k.y, 1);
  }
  for (const e of enemies) if (e.y + lenOf(e) / 2 + (e.kind === "works" ? SIGN_AHEAD + 40 : 0) > -40) drawEnemy(e);
  for (const r of racers) drawRacer(r);
  drawSprayFog(null);
  if (startObj) drawGantryTop();
  if (finishObj) drawGantryTop(finishObj.y, true);
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1);
    ctx.globalCompositeOperation = p.add ? "lighter" : "source-over"; // glowing ones blend additively
    ctx.fillStyle = p.color;
    if (p.add) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, TAU); ctx.fill(); } else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  for (const s of scenery) if (!s.far && s.y > -50 && s.kind === "tree") drawScenery(s);
}

