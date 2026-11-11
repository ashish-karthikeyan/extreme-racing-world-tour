// ---------- drawing: UI ----------

// ---------- the look: the same style as the Garage (css/garage.css) - its font, dark glass panels with an orange accent line, italic 900 headings ----------
const UI_FONT = '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
const UI_ACC = "#ffb21a", UI_ACC_RGB = "255,178,26";
let uiSeen = "", uiT0 = 0, titleOutT = -1e9; // menu transitions: the screen shown last frame, and when the current one opened
const uiIn = (delay = 0) => smooth(clamp((performance.now() - uiT0 - delay) / 280, 0, 1)); // 0 -> 1 as a screen opens (delay in ms staggers its parts)
function glass(x, y, w, h, r = 14, acc = UI_ACC, on = false) { // a dark glass panel: gradient, hairline border, a glowing accent line along the top
  const dom = glassUI.panel(x, y, w, h, r, acc || "", ctx.globalAlpha, on); // (3D: real frosted glass in HTML under the canvas does the fill, the blur and the border)
  ctx.save();
  roundRect(x, y, w, h, r);
  if (!dom) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "rgba(26,30,46,0.78)"); g.addColorStop(1, "rgba(8,10,17,0.86)");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.stroke();
  }
  if (acc) {
    ctx.clip(); const ag = ctx.createLinearGradient(x, 0, x + w, 0); ag.addColorStop(0, "rgba(0,0,0,0)"); ag.addColorStop(0.5, acc); ag.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ag; ctx.fillRect(x, y, w, 2);
    const hg = ctx.createLinearGradient(0, y, 0, y + 26); hg.addColorStop(0, "rgba(255,255,255,0.07)"); hg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = hg; ctx.fillRect(x, y, w, 26);
  }
  ctx.restore();
}
function heading(str, y, size = 28, x = W / 2) { // italic 900 capitals with the slanted accent bar in front, like the Garage title
  ctx.save(); ctx.font = `italic 900 ${size}px ${UI_FONT}`; ctx.textAlign = "left"; try { ctx.letterSpacing = `${(size * 0.05).toFixed(1)}px`; } catch (e) {}
  let s = size; while (ctx.measureText(str).width > W - 60 && s > 12) { s--; ctx.font = `italic 900 ${s}px ${UI_FONT}`; }
  const w = ctx.measureText(str).width, bar = s * 0.32, left = x - (w + bar * 1.6) / 2, bh = s * 0.74;
  ctx.fillStyle = UI_ACC; ctx.shadowColor = `rgba(${UI_ACC_RGB},0.9)`; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(left + bar * 0.55, y - bh); ctx.lineTo(left + bar, y - bh); ctx.lineTo(left + bar * 0.45, y); ctx.lineTo(left, y); ctx.closePath(); ctx.fill();
  ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2; ctx.fillStyle = "#f3f6fb"; ctx.fillText(str, left + bar * 1.6, y);
  ctx.restore();
}
function menuBackdrop(moy) { // darker at the top and bottom where the text is, lighter in the middle (like the title)
  const g = ctx.createLinearGradient(0, -moy, 0, H - moy); g.addColorStop(0, "rgba(6,8,16,0.86)"); g.addColorStop(0.45, "rgba(6,8,16,0.58)"); g.addColorStop(1, "rgba(6,8,16,0.88)");
  ctx.fillStyle = g; ctx.fillRect(0, -moy, W, H);
}
function pill(x, y, w, h, fill = "rgba(10,12,20,0.6)") { roundRect(x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; ctx.stroke(); }

// ---------- popups: one stack, top centre under the score; never two of the same ----------
// The centre column under the score holds, top to bottom: the start hint, the combo, the bypass prompt, (on a narrow screen) the city card, then the
// popups. Each part that is showing pushes the next one down, so they never sit on top of each other.
const bannerNarrow = () => !!banner && state === "playing" && grid && grid.done && W < 560;
let titleToastY = 0; // (the title on a phone: notes go just under its logo and tagline, not over them; 0 = at the top)
function hudStackTop(withBanner = true) {
  const racing = state === "playing" || state === "paused" || state === "camera";
  if (state === "title" && titleToastY) return titleToastY;
  if (!racing) return state === "cleared" || state === "over" ? Math.max(10, (menuOY() + 84 - 28 * Math.min(3, toasts.length)) / 2) : 10; // (a results card on a tall phone: in the space above it, not against the top edge)
  let top = mode === "vs" || mode === "multi" ? 98 : level ? 92 : mode === "tutorial" ? 106 : 74; const p0 = racers[0]; // (the test drive: under its instruction)
  if (mode !== "vs" && mode !== "multi") { if (p0.comboT > 0 && p0.combo >= 2) top += 28; if (p0.alive && p0.bypass) top += 34; }
  if (state === "playing" && grid && grid.done && frame < grid.goFrame + 120) top += 22; // (the start hint)
  if (withBanner && bannerNarrow()) top += 52;
  return top;
}
function drawToasts() {
  let y = hudStackTop(); const quiet = mode === "tutorial" && (state === "playing" || state === "paused" || state === "camera"); // (the test drive's instruction is the only sentence on screen)
  for (let i = 0; i < Math.min(3, toasts.length); i++) {
    if (quiet && !toasts[i].key) continue; // (only the keyed ones you asked for: camera, controller)
    const t = toasts[i], a = clamp(Math.min(t.t / 8, (t.life - t.t) / 18), 0, 1);
    t.y = t.y === undefined ? y : t.y + (y - t.y) * 0.25; // slide up smoothly when the one above leaves
    let fs = 13; ctx.font = `700 ${fs}px ${UI_FONT}`; while (ctx.measureText(t.text).width > W - 56 && fs > 9) { fs--; ctx.font = `700 ${fs}px ${UI_FONT}`; }
    const w = ctx.measureText(t.text).width + 30, x = W / 2 - w / 2;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * -6);
    glass(x, t.y, w, 24, 12, t.col || UI_ACC);
    ctx.fillStyle = t.col || UI_ACC; ctx.beginPath(); ctx.arc(x + 12, t.y + 12, 3, 0, TAU); ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = "#f3f6fb"; ctx.fillText(t.text, W / 2 + 5, t.y + 16.5);
    ctx.restore();
    y += 28;
  }
}


function textAt(str, x, y, size, align = "center", color = "#fff") {
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.62)";
  ctx.lineWidth = Math.max(1.6, size / 7);
  ctx.lineJoin = "round";
  ctx.font = `800 ${size}px ${UI_FONT}`;
  ctx.textAlign = align;
  ctx.strokeText(str, x, y);
  ctx.fillText(str, x, y);
}

function text(str, y, size, align = "center", color = "#fff") {
  textAt(str, align === "left" ? 46 : align === "right" ? W - 12 : W / 2, y, size, align, color);
}

function drawButtons() {
  const menu = currentMenu();
  menu.items.forEach((item, i) => {
    const r0 = btnRect(menu, i), e = uiIn(30 + i * 24), r = { x: r0.x, y: r0.y + (1 - e) * 16, w: r0.w, h: r0.h };
    const on = i === sel, lab = typeof item.label === "function" ? item.label() : item.label, rich = !lab, rad = Math.min(14, r.h * 0.36);
    ctx.save(); ctx.globalAlpha *= e;
    let ink = "#f3f6fb";
    if (item.big) { // the main action (RACE, RETRY, NEXT CITY): accent gradient with dark text, like the Garage's Buy button
      if (on) { ctx.shadowColor = `rgba(${UI_ACC_RGB},0.85)`; ctx.shadowBlur = 22; }
      roundRect(r.x, r.y, r.w, r.h, rad); const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, "#ffd98a"); g.addColorStop(0.5, UI_ACC); g.addColorStop(1, "#ff8a1a"); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
      if (on) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
      ink = "#1a1006";
    } else if (on && !rich) { // the chosen button: bright white, accent glow ring
      ctx.shadowColor = `rgba(${UI_ACC_RGB},0.7)`; ctx.shadowBlur = 16;
      roundRect(r.x, r.y, r.w, r.h, rad); const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "rgba(255,255,255,0.84)"); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(${UI_ACC_RGB},0.95)`; ctx.lineWidth = 2; roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, rad + 2); ctx.stroke();
      ink = "#0b0d12";
    } else { // the rest: dark glass (rows drawn over by their own screen keep this look when chosen, with the accent ring)
      roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = on ? "rgba(40,46,66,0.9)" : "rgba(12,14,22,0.72)"; ctx.fill();
      ctx.strokeStyle = on ? `rgba(${UI_ACC_RGB},0.95)` : "rgba(255,255,255,0.2)"; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
      if (on) { ctx.shadowColor = `rgba(${UI_ACC_RGB},0.55)`; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0; }
    }
    if (lab) {
      ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = item.big ? `italic 900 ${Math.min(24, r.h * 0.5)}px ${UI_FONT}` : `700 ${Math.min(17, r.h * 0.48)}px ${UI_FONT}`;
      ctx.fillText(lab, r.x + r.w / 2, r.y + r.h / 2 + 1);
      ctx.textBaseline = "alphabetic";
      if (!onTouch()) { // the button's own shortcut (Esc / B for Back, R / X for Retry), or Enter / A on the chosen one
        const short = /^(Back|Resume|Menu)$/i.test(lab) ? "back" : /^(Retry|Restart)( Lesson)?$/i.test(lab) ? "retry" : on ? "confirm" : null;
        if (short) { const s = Math.min(18, r.h - 14), g = glyphsFor(short)[0]; ctx.globalAlpha *= on ? 1 : 0.7; drawGlyph(g, r.x + r.w - glyphWidth(g, s) - 9, r.y + r.h / 2, s); }
      }
    }
    ctx.restore();
  });
}

function drawFirstTime() { // the small card that offers the test drive (its two buttons are FIRST_MENU)
  const pw = Math.min(W - 32, 340), e = uiIn();
  ctx.save(); ctx.globalAlpha *= e; glass((W - pw) / 2, 150 + (1 - e) * 12, pw, 202, 18); ctx.restore();
  heading("FIRST TIME?", 198, 26);
  text("Take a 90-second test drive", 226, 15, "center", "#dfe5ef");
}

// The briefing: with 3D, the city card sits to the side (on a phone: at the bottom) so the flyover of the city's landmarks shows beside it.
function briefLayout() {
  const pw = Math.min(W - 24, W >= 540 ? Math.min(380, W - 240) : 380);
  if (!window.R3D) return { px: (W - pw) / 2, py: 40, pw };
  if (W >= 540) return { px: W - pw - Math.max(14, W * 0.045), py: 22, pw };
  return { px: (W - pw) / 2, py: Math.max(40, H - menuOY() - 444), pw };
}
function drawBrief() { // the city card between the map and the race
  const i = mapIdx, st = ROUTE[i], tg = starTargets(i), stars = cityStars[i] || 0, L = briefLayout(), pw = L.pw, px = L.px, cx = px + pw / 2, e = window.R3D ? uiIn(180) : 1, y0 = L.py - 40 + (1 - e) * 14; // (3D: the card comes in once the flyover is under way)
  ctx.save(); ctx.globalAlpha *= e;
  glass(px, y0 + 40, pw, 322, 16);
  ctx.save(); ctx.translate(cx - 30, y0 + 56); drawFlag(st.flag, 60, 38); ctx.restore();
  heading(st.venue.toUpperCase(), y0 + 128, 26, cx); textAt(`${st.country}  -  ${roundLabel(st)}`, cx, y0 + 148, 11, "center", "rgba(255,255,255,0.65)");
  for (let k = 0; k < 3; k++) drawStar(cx - 26 + k * 26, y0 + 172, 10, k < stars);
  pill(cx - Math.min(pw - 40, 300) / 2, y0 + 188, Math.min(pw - 40, 300), 24, "rgba(255,178,26,0.12)");
  textAt(i === ROUTE.length - 1 ? `Win the final   2 stars ${tg[0]}   3 stars ${tg[1]}` : `TARGETS   2 stars: ${tg[0]}     3 stars: ${tg[1]}`, cx, y0 + 205, 12, "center", "#ffd23f");
  textAt("MISSIONS", px + 18, y0 + 238, 11, "left", "rgba(255,255,255,0.55)");
  cityMissions(i).forEach((m, k) => {
    const done = missionState(i)[k], y = y0 + 262 + k * 30;
    roundRect(px + 18, y - 13, 16, 16, 5); ctx.fillStyle = done ? "#7cfc9a" : "rgba(255,255,255,0.12)"; ctx.fill();
    if (done) { ctx.strokeStyle = "#0b2d14"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px + 22, y - 5); ctx.lineTo(px + 25, y - 1); ctx.lineTo(px + 31, y - 9); ctx.stroke(); } // tick
    textAt(m.label, px + 44, y, 13, "left", done ? "#9be89b" : "#f3f6fb");
    textAt(done ? "done" : `+${missionReward(i)}c`, px + pw - 16, y, 12, "right", done ? "#9be89b" : "#ffd23f");
  });
  ctx.restore();
}

function drawStats() { // lifetime numbers on top, the achievements underneath
  heading("STATS & AWARDS", 32, 24);
  const rows = [["Distance", `${stats.km.toFixed(1)} km`], ["Cars passed", stats.cars], ["Near misses", stats.nearMisses], ["Best combo", `x${stats.bestCombo}`],
    ["Top speed", `${stats.topSpeed} km/h`], ["Crashes", stats.crashes], ["Races", stats.races], ["Coins collected", stats.coins], ["Shields used", stats.shields]];
  const cw = Math.min(W - 24, 520), x0 = (W - cw) / 2, half = Math.ceil(rows.length / 2);
  rows.forEach(([k, v], i) => {
    const c = i < half ? 0 : 1, y = 58 + (i % half) * 17, x = x0 + c * (cw / 2 + 6);
    textAt(k, x, y, 11, "left", "#bbb"); textAt(String(v), x + cw / 2 - 12, y, 12, "right", "#fff");
  });
  textAt(`ACHIEVEMENTS  ${achieved.length} / ${ACHIEVEMENTS.length}`, W / 2, 158, 13, "center", "#ffd23f");
  const aw = (cw - 6) / 2;
  ACHIEVEMENTS.forEach((a, i) => {
    const c = i % 2, y = 166 + Math.floor(i / 2) * 30, x = x0 + c * (aw + 6), got = achieved.includes(a.id);
    roundRect(x, y, aw, 27, 6); ctx.fillStyle = got ? "rgba(255,210,63,0.16)" : "rgba(0,0,0,0.5)"; ctx.fill();
    ctx.globalAlpha = got ? 1 : 0.45;
    ctx.fillStyle = got ? "#ffd23f" : "#777"; // a little trophy
    ctx.beginPath(); ctx.moveTo(x + 8, y + 7); ctx.lineTo(x + 20, y + 7); ctx.lineTo(x + 18, y + 15); ctx.lineTo(x + 10, y + 15); ctx.closePath(); ctx.fill(); ctx.fillRect(x + 13, y + 15, 2, 4); ctx.fillRect(x + 10, y + 19, 8, 2);
    textAt(a.name, x + 26, y + 12, 11, "left", got ? "#fff" : "#ccc"); textAt(a.desc, x + 26, y + 23, 9, "left", "#aaa");
    ctx.globalAlpha = 1;
  });
}

// ---- the World Tour map's backdrop: the world as a grid of dots (js/data/worldmap.js), the tour's route arcing from city to city in running
// order (gold up to where you have got, faint after), a glowing pin for every city and a pulsing ring round the one picked. The dots are
// drawn once into a picture of their own (redrawn only when the window changes size): each frame only the route and the pins are drawn. ----
const CITY_GEO = { Sydney: [-33.9, 151.2], Shanghai: [31.2, 121.5], Tokyo: [35.7, 139.7], Miami: [25.8, -80.2], Montreal: [45.5, -73.6], "Monte Carlo": [43.7, 7.4],
  Barcelona: [41.4, 2.2], Salzburg: [47.8, 13.0], London: [51.5, -0.1], Brussels: [50.9, 4.4], Budapest: [47.5, 19.0], Amsterdam: [52.4, 4.9], Rome: [41.9, 12.5],
  Madrid: [40.4, -3.7], Baku: [40.4, 49.9], Singapore: [1.4, 103.8], Austin: [30.3, -97.7], "Mexico City": [19.4, -99.1], "Sao Paulo": [-23.6, -46.6],
  "Las Vegas": [36.2, -115.1], Doha: [25.3, 51.5], "Abu Dhabi": [24.5, 54.4] };
let worldPic = null, worldKey = ""; const worldPts = new Float32Array(44), glowPics = {}; // (the pins' places, worked out with the dots; their glows drawn once each)
const glowPic = (rgb, on) => { const k = rgb + on; let c = glowPics[k]; if (c) return c; const R = on ? 14 : 7, px = Math.ceil(R * 2 * RES); c = glowPics[k] = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d"), gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2); gr.addColorStop(0, `rgba(${rgb},${on ? 0.7 : 0.45})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, px, px); return c; };
function worldFrame() { // where the map sits on the screen: as wide as fits, a little below the heading
  const D = WORLD_DOTS, aspect = 360 / (D.lat0 - D.lat1); let mw = W * 0.99, mh = mw / aspect; if (mh > H * 0.8) { mh = H * 0.8; mw = mh * aspect; }
  return { x: (W - mw) / 2, y: Math.max(40, (H - mh) / 2 + 8), w: mw, h: mh };
}
const worldXY = (f, lat, lon) => [f.x + (lon + 180) / 360 * f.w, f.y + (WORLD_DOTS.lat0 - lat) / (WORLD_DOTS.lat0 - WORLD_DOTS.lat1) * f.h];
function drawWorldMap() {
  const D = WORLD_DOTS, f = worldFrame(), key = W + "x" + H + "@" + RES;
  if (key !== worldKey) { // the dots, drawn once at this size
    worldKey = key; worldPic = worldPic || document.createElement("canvas"); worldPic.width = Math.round(W * RES); worldPic.height = Math.round(H * RES);
    const g = worldPic.getContext("2d"); g.setTransform(RES, 0, 0, RES, 0, 0); g.clearRect(0, 0, W, H);
    const cw = f.w / D.cols, ch = f.h / D.rows, r = Math.max(0.6, Math.min(cw, ch) * 0.34);
    for (let i = 0; i < D.cols * D.rows; i++) {
      if (!((parseInt(D.hex[i >> 2], 16) >> (3 - (i & 3))) & 1)) continue;
      const c = i % D.cols, row = (i / D.cols) | 0, x = f.x + (c + 0.5) * cw, y = f.y + (row + 0.5) * ch;
      g.fillStyle = `rgba(150,195,255,${(0.3 + 0.16 * Math.sin(c * 0.7 + row * 1.3) ** 2).toFixed(3)})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    ROUTE.forEach((st, i) => { const ll = CITY_GEO[st.venue] || [0, 0], p = worldXY(f, ll[0], ll[1]); worldPts[i * 2] = p[0]; worldPts[i * 2 + 1] = p[1]; });
    for (const k in glowPics) delete glowPics[k]; // (sharp at the new size)
  }
  const e = uiIn(); ctx.save(); ctx.globalAlpha *= e;
  { const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.75); g.addColorStop(0, "rgba(8,14,30,0.55)"); g.addColorStop(1, "rgba(3,6,14,0.85)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); } // a deep night-blue wash: the map reads like a screen in a control room
  ctx.drawImage(worldPic, 0, 0, W, H);
  const t = performance.now() / 1000, N = ROUTE.length;
  ctx.lineWidth = 1.4; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 8;
  for (let i = 0; i < N - 1; i++) { // the route: a gentle arc from each city to the next
    const ax = worldPts[i * 2], ay = worldPts[i * 2 + 1], bx = worldPts[i * 2 + 2], by = worldPts[i * 2 + 3], mx = (ax + bx) / 2, my = (ay + by) / 2 - Math.min(40, Math.hypot(bx - ax, by - ay) * 0.22);
    ctx.strokeStyle = i < tourCleared ? "rgba(255,210,63,0.75)" : "rgba(255,255,255,0.16)"; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (let i = 0; i < N; i++) { // the pins
    const x = worldPts[i * 2], y = worldPts[i * 2 + 1], open = unlocked(i), on = i === mapIdx, col = (cityStars[i] || 0) > 0 ? "255,210,63" : open ? "120,200,255" : "160,170,190", R = on ? 14 : 7;
    ctx.drawImage(glowPic(col, on), x - R, y - R, R * 2, R * 2);
    ctx.fillStyle = `rgba(${col},${open ? 1 : 0.6})`; ctx.beginPath(); ctx.arc(x, y, on ? 3 : 2, 0, TAU); ctx.fill();
    if (on) { const k = (t * 0.9) % 1; ctx.strokeStyle = `rgba(${col},${(1 - k).toFixed(3)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 4 + k * 16, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
}

function drawMap() {
  if (typeof WORLD_DOTS !== "undefined") drawWorldMap(); // (the world behind the list of cities)
  heading("WORLD TOUR", 38, 26);
  if (window.R3D) { const t0 = mapTile(0), last = mapTile(ROUTE.length - 1), e = uiIn(); ctx.save(); ctx.globalAlpha *= e; glass(t0.x - 9, t0.y - 9, (last.x + last.w) - t0.x + 18, MAP_ROWS * 34 + 14, 16); ctx.restore(); } // one glass board behind the cities, over the blurred city
  drawStar(W / 2 - 40, 53, 7, true); textAt(`${totalStars()} / ${ROUTE.length * 3}`, W / 2 - 28, 58, 13, "left", "#ffd23f");
  ROUTE.forEach((st, i) => {
    const r0 = mapTile(i), open = unlocked(i), on = i === mapIdx, stars = cityStars[i] || 0, e = uiIn(Math.min(i, 21) * 9), r = { ...r0, x: r0.x + (1 - e) * (i < MAP_ROWS ? -18 : 18) };
    ctx.save(); ctx.globalAlpha *= e;
    roundRect(r.x, r.y, r.w, r.h, 9);
    if (on) { ctx.shadowColor = `rgba(${UI_ACC_RGB},0.7)`; ctx.shadowBlur = 14; const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, "rgba(255,255,255,0.22)"); g.addColorStop(1, "rgba(255,255,255,0.1)"); ctx.fillStyle = "rgba(14,16,26,0.9)"; ctx.fill(); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0; }
    else { ctx.fillStyle = open ? "rgba(12,14,22,0.74)" : "rgba(12,14,22,0.5)"; ctx.fill(); }
    ctx.strokeStyle = on ? UI_ACC : "rgba(255,255,255,0.16)"; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
    ctx.globalAlpha *= open ? 1 : 0.45;
    textAt(String(st.n), r.x + 14, r.y + 20, 11, "center", on ? UI_ACC : "rgba(255,255,255,0.55)");
    ctx.save(); ctx.translate(r.x + 26, r.y + 9); drawFlag(st.flag, 20, 13); ctx.restore();
    const room = r.w - 52 - (open ? 46 : 32); // shrink long names to fit between the flag and the stars, then shorten them if needed
    let nm = st.venue, fs = 12;
    const fits = () => { ctx.font = `800 ${fs}px ${UI_FONT}`; return ctx.measureText(nm).width + 4 <= room; };
    while (!fits() && fs > 10) fs--;
    while (!fits() && nm.length > 4) nm = nm.slice(0, nm.endsWith(".") ? -2 : -1).trimEnd() + ".";
    textAt(nm, r.x + 52, r.y + 20, fs, "left", "#fff");
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= e;
    if (open) {
      for (let k = 0; k < 3; k++) drawStar(r.x + r.w - 40 + k * 13, r.y + r.h / 2 + 2, 5.5, k < stars);
      missionState(i).forEach((d, k) => { ctx.fillStyle = d ? "#7cfc9a" : "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(r.x + r.w - 40 + k * 13, r.y + 5, 2.2, 0, TAU); ctx.fill(); }); // missions done
    }
    else { // a little padlock
      const lx = r.x + r.w - 22, ly = r.y + r.h / 2;
      ctx.strokeStyle = "#8a909c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly - 3, 4, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = "#8a909c"; ctx.fillRect(lx - 6, ly - 3, 12, 9);
    }
    ctx.restore();
  });
}

function drawGarage() {
  const t = TEAMS[garageIdx], isOwned = owned.includes(garageIdx);
  text("GARAGE", 58, 34);
  text(`Coins ${wallet}`, 84, 16, "center", "#ffd23f");
  ctx.save();
  ctx.translate(W / 2, 190);
  ctx.scale(2.0, 2.0);
  if (!window.R3D) drawCar(t, { slip: false }); // with 3D on, the car is on the turntable behind this canvas
  ctx.restore();
  textAt("<", 12, 204, 44, "left");
  textAt(">", W - 12, 204, 44, "right");
  text(`${garageIdx + 1}/${TEAMS.length}`, 104, 13, "center", "#ccc");
  text(t.name.toUpperCase(), 290, 22);
  [t.p, t.s, t.a].forEach((c, i) => { ctx.fillStyle = c; ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2 - 18 + i * 18, 304, 6, 0, TAU); ctx.fill(); ctx.stroke(); });
  if (isOwned) text(garageIdx === equipped ? "EQUIPPED" : "OWNED", 327, 15, "center", "#7CFC9A");
  else text(wallet >= t.cost ? `Price ${t.cost} coins` : `Need ${t.cost - wallet} more coins`, 327, 15, "center", wallet >= t.cost ? "#fff" : "#ff7b7b");
}

const sliderBar = r => ({ x: r.x + 100, y: r.y + r.h / 2 - 5, w: r.w - 160, h: 10 }); // the bar inside a slider row
function drawSliders() {
  const menu = currentMenu();
  OPTIONS_MENU.forEach((it, i) => {
    if (!it.slider) return;
    const r = btnRect(menu, i), b = sliderBar(r), v = settings[it.slider];
    textAt(it.name, r.x + 14, r.y + r.h / 2 + 5, 14, "left");
    roundRect(b.x, b.y + 2, b.w, b.h - 4, 4); ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fill();
    const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0); g.addColorStop(0, "#ff8a1a"); g.addColorStop(1, "#ffd98a");
    roundRect(b.x, b.y + 2, Math.max(b.h - 4, b.w * v), b.h - 4, 4); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x + Math.max(3, b.w * v), b.y + b.h / 2, 6, 0, TAU); ctx.fill(); // the handle
    textAt(`${Math.round(v * 100)}%`, r.x + r.w - 12, r.y + r.h / 2 + 5, 13, "right");
  });
}
function drawCredits() {
  drawLogo(W / 2, 120, Math.min(0.8, (W - 30) / 330));
  text("Made by Ashish", 196, 22, "center", "#ffd23f");
  text(`Version ${VERSION}`, 222, 13, "center", "#ccc");
  text(window.R3D ? "Models by Kenney and Poly Haven, skies by Poly Haven," : "Everything you see and hear is drawn and synthesised in code:", 252, 12, "center", "#ddd");
  if (window.R3D) text("textures by ambientCG (all CC0), map: Natural Earth.", 268, 12, "center", "#ddd");
  text(window.R3D ? "Three.js engine. Music and sounds are made in code." : "no image or sound files.", window.R3D ? 284 : 280, 12, "center", "#ddd");
  text("All teams, cars and liveries are fictional.", 314, 12, "center", "#ddd");
  text("Thanks for playing!", 366, 18);
}
const drawVersion = () => { if (state === "title" && window.R3D && W >= 600 && W / H >= 1.3) return; textAt(`v${VERSION}`, W - 14, H - 10, 10, "right", "rgba(255,255,255,0.55)"); }; // bottom-right of the title and main menu (the wide 3D title draws it in its text column)

// footer prompts per menu screen (keyboard / controller; touch keeps its own words)
const FOOTER = {
  menu: [["choose", "Choose"], ["confirm", "Go"]], carousel: [["change", "Choose"], ["confirm", "Go"]], firsttime: [["choose", "Choose"], ["confirm", "Go"], ["back", "Skip"]], garage: [["browse", "Browse"], ["confirm", "Pick"], ["back", "Back"]],
  upgrades: [["change", "Choose"], ["confirm", "Upgrade"], ["back", "Back"]], graphics: [["choose", "Setting"], ["change", "Change"], ["back", "Back"]],
  options: [["choose", "Choose"], ["change", "Adjust"], ["confirm", "Select"], ["back", "Back"]], tyres: [["change", "Tyre"], ["confirm", "Race"], ["back", "Back"]],
  difficulty: [["choose", "Choose"], ["confirm", "Select"], ["back", "Back"]], songs: [["choose", "Choose"], ["confirm", "Select"], ["back", "Back"]],
};
// every way to play: three pages (Keyboard, Controller, Touch); Left / Right flips between them, and it opens on the one you are using
const CONTROL_PAGES = [
  ["KEYBOARD", () => [[["k:←", "k:→", "/", "k:A", "k:D"], "Change lane"], [["k:↑", "/", "k:W"], "Gas"], [["k:↓", "/", "k:S", "/", "k:Space"], "Brake"], [["k:↑", "+", "k:↓"], "Hold on the grid: launch"],
    [["k:C"], "Camera menu"], [["k:V", "/", "k:1", "k:2", "k:3"], "Next camera / pick one"], [["k:Esc", "/", "k:P"], "Pause"], [["k:R"], "Restart (paused) / retry"], [["k:P"], "Photo mode (paused)"],
    [["k:Q", "k:E"], "Turn the car (Garage)"], [["k:M", "k:F", "k:N"], "Mute / fullscreen / song"], [[], "Multiplayer: P1 arrows, P2 W A S D"]]],
  ["CONTROLLER", () => [[["p:LS", "/", "p:DLR"], "Change lane"], [["p:RT", "/", "p:A"], "Gas"], [["p:LT", "/", "p:B", "/", "p:X"], "Brake"], [["p:RT", "+", "p:LT"], "Hold on the grid: launch"],
    [["p:Y", "/", "p:VIEW"], "Camera menu"], [["p:LB", "p:RB"], "Next camera"], [["p:START"], "Pause"], [["p:X"], "Restart (paused) / retry"], [["p:Y"], "Photo mode (paused)"],
    [["p:RS"], "Turn the car (Garage)"], [["p:LB", "p:RB"], "Browse cars (Garage)"], [["p:Y"], "Next song (menus)"]]],
  ["TOUCH", () => [[[], "Tap the left / right half: change lane"], [[], "GAS and BRAKE pads at the bottom"], [[], "Hold both on the grid: launch"], [[], "Camera top-left, pause bottom-right"], [[], "Drag the car to turn it (Garage)"], [[], "Swipe the main menu cards"]]],
];
function drawControls() {
  heading("CONTROLS", 40, 28);
  const tw = Math.min(110, (W - 70) / 3), x0 = W / 2 - tw * 1.5;
  CONTROL_PAGES.forEach(([name], i) => { roundRect(x0 + i * tw + 2, 54, tw - 4, 24, 12); ctx.fillStyle = i === controlsTab ? "#1d70f5" : "rgba(0,0,0,0.5)"; ctx.fill(); textAt(name, x0 + i * tw + tw / 2, 71, 11, "center", i === controlsTab ? "#fff" : "#aaa"); });
  if (!onTouch()) { const a = onPad() ? "p:LB" : "k:←", b = onPad() ? "p:RB" : "k:→"; drawGlyph(a, x0 - glyphWidth(a, 16) - 4, 66, 16); drawGlyph(b, x0 + tw * 3 + 4, 66, 16); }
  const using = onPad() ? PAD_NAME[padKind] : onTouch() ? "the touch screen" : "the keyboard";
  text(`You are using ${using}`, 96, 11, "center", "#7fffd4");
  const rows = CONTROL_PAGES[controlsTab][1](), lx = W / 2 - 20;
  const was = inputDev; if (controlsTab === 1) inputDev = "pad"; else if (controlsTab === 0) inputDev = "kb"; // (each page draws its own device's glyphs, whatever you hold)
  rows.forEach(([toks, label], i) => {
    const y = 120 + i * 25;
    if (!toks.length) { textAt(label, W / 2, y + 4, 12, "center", "#ddd"); return; }
    let w = 0; toks.forEach(t => w += glyphWidth(t, 18) + 3); let x = lx - w;
    for (const t of toks) x += drawGlyph(t, x, y, 18) + 3;
    textAt(label, lx + 8, y + 4, 12, "left", "#ddd");
  });
  inputDev = was;
}

// ---- main menu carousel: cards side by side, each with a live little preview of what it is ----
const CARD_INFO = [ // per MAIN_MENU entry: colour, tagline, badge, preview
  { col: "#ff4d4d", tag: "Race the CPU, Easy to Impossible!", badge: () => "4 levels", art: "vs" },
  { col: "#ff7a1a", tag: "22 cities, stars and missions", badge: () => `${totalStars()} / ${ROUTE.length * 3} stars`, art: "tour" },
  { col: "#ffd23f", tag: "Same race for everyone today", badge: () => daily.streak ? `${daily.streak}-day streak` : "Play today", art: "daily" },
  { col: "#3dff6e", tag: "How far can you go?", badge: () => `Best ${best}`, art: "endless" },
  { col: "#b06bff", tag: "Two players, one keyboard", badge: () => "P1 vs P2", art: "multi" },
  { col: "#5fd4ff", tag: "Cars, liveries and upgrades", badge: () => `${wallet} coins`, art: "garage" },
  { col: "#ffb347", tag: "Your records and awards", badge: () => `${achieved.length} / ${ACHIEVEMENTS.length} awards`, art: "stats" },
  { col: "#aab4c0", tag: "Sound, graphics and controls", badge: () => `v${VERSION}`, art: "settings" },
];
// ---- the 3D main menu: the car stands in the studio on one side, the cards are a column of glass panels on the other (on a portrait phone: the car
// on top, the cards below). The chosen card opens up to show its live preview; the others are slim rows. ----
const RAIL = { wide: true, x: 0, w: 300, top: 40, bottom: 440, hc: 34, he: 120, gap: 6, logoX: 0, logoY: 0, logoK: 0.42, out: [] };
// Three layouts: wide (the car to the left, the cards in a column on the right), a tall phone (the car on top, the cards below) and, for a squarish
// window, a compact one (the logo and the coins share the top row, the car stands under them, the slim cards fill the bottom). The card sizes are
// worked out so the column always fits: nothing ever runs into the prompt line.
function railLayout() { // (menu coordinates: pushed down by menuOY() on a tall screen)
  const moy = menuOY(), wide = W >= 540, n = MAIN_MENU.length, R = RAIL; R.wide = wide; R.compact = !wide && H < 600; R.gap = R.compact ? 4 : 6;
  if (wide) {
    R.w = Math.min(380, Math.max(250, W * 0.36)); R.x = W - R.w - Math.max(18, W * 0.045); R.top = 34; R.bottom = 436;
    R.logoK = Math.min(0.46, (R.x - 30) / 400); R.logoX = 26 + 200 * R.logoK; R.logoY = 50; R.coinsX = R.logoX; R.coinsY = R.logoY + 128 * R.logoK + 8; R.coinsRight = false;
    setRect(studioRects.menu, 0.02, (R.x - 8) / W, 0.25, 0.96);
  } else if (R.compact) {
    R.w = W - 28; R.x = 14; R.top = H * 0.42 - moy; R.bottom = H - moy - 30;
    R.logoK = 0.3; R.logoX = 22 + 200 * 0.3; R.logoY = 26 - moy; R.coinsX = W - 14; R.coinsY = 30 - moy; R.coinsRight = true;
    setRect(studioRects.menu, 0.04, 0.96, 62 / H, (R.top + moy - 8) / H);
  } else {
    R.w = W - 28; R.x = 14; R.top = Math.max(H * 0.42 - moy, 150); R.bottom = H - moy - 56;
    R.logoK = Math.min(0.42, (W - 40) / 400); R.logoX = W / 2; R.logoY = 30 - moy; R.coinsX = R.logoX; R.coinsY = R.logoY + 128 * R.logoK + 8; R.coinsRight = false;
    setRect(studioRects.menu, 0.04, 0.96, (R.coinsY + moy + 16) / H, (R.top + moy - 6) / H);
  }
  const A = R.bottom - R.top; R.he = clamp(A * 0.3, R.compact ? 68 : 92, 128); R.hc = (A - R.he - (n - 1) * R.gap) / (n - 1);
  if (R.hc < 20) { R.hc = 20; R.he = Math.max(56, A - (n - 1) * (R.hc + R.gap)); } R.hc = Math.min(R.hc, 38);
  return R;
}
function railCards() { // each row: eased open by how close the carousel position (menuCar) is to it, sliding in from the side when the menu opens
  const R = railLayout(), out = R.out; out.length = 0; let y = R.top;
  MAIN_MENU.forEach((_, i) => {
    const e = smooth(clamp(1 - Math.abs(i - menuCar), 0, 1)), h = R.hc + (R.he - R.hc) * e, intro = clamp((clock - menuIntroT - i * 1.6) / 16, 0, 1), fly = (1 - intro) * (1 - intro);
    out.push({ i, d: i - menuCar, s: 1, e, x: R.x + fly * (R.wide ? 70 : 0), y: y + fly * (R.wide ? 0 : 40), w: R.w, h, a: intro });
    y += h + R.gap;
  });
  return out;
}
function drawRail() {
  for (const c of railCards()) {
    const info = CARD_INFO[c.i], on = c.i === sel, item = MAIN_MENU[c.i], label = typeof item.label === "function" ? item.label() : item.label, e = c.e;
    ctx.save(); ctx.globalAlpha = c.a;
    glass(c.x, c.y, c.w, c.h, 12, on ? info.col : "", on);
    ctx.save(); roundRect(c.x, c.y, c.w, c.h, 12); ctx.clip();
    ctx.fillStyle = info.col; ctx.globalAlpha = c.a * (0.55 + 0.45 * e); ctx.fillRect(c.x, c.y + 6, 3, c.h - 12); ctx.globalAlpha = c.a; // the card's colour, a slim bar on its edge
    // the live preview, opening with the card
    const ah = c.h - 16, aw = Math.min(ah * 1.45, c.w * 0.44);
    if (e > 0.05) {
      ctx.save(); ctx.globalAlpha = c.a * smooth((e - 0.05) / 0.6); const ax = c.x + 12, ay = c.y + 8;
      roundRect(ax, ay, aw, ah, 9); ctx.clip(); ctx.fillStyle = "#07080c"; ctx.fillRect(ax, ay, aw, ah);
      ctx.translate(ax + aw / 2, ay + ah / 2); const k = ah / 150; ctx.scale(k, k); drawCardArt(info.art, aw / k, ah / k, info.col);
      ctx.restore();
      if (on) { const sx = c.x + ((clock * 4) % (c.w * 3)) - c.w, g = ctx.createLinearGradient(sx, 0, sx + 70, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.09)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(c.x, c.y, c.w, c.h); } // a sheen across the chosen card
    }
    // the words: the label slides right as the preview opens; the tagline and the badge fade in under it
    const tx = c.x + 16 + (aw + 8) * e, room = c.x + c.w - tx - 12, bt = info.badge();
    const fit = (str, size, max) => { ctx.font = `800 ${size}px ${UI_FONT}`; const w = ctx.measureText(str).width; return w > max ? size * max / w : size; };
    const midY = c.y + c.h / 2, ly = lerp(midY + 5, c.y + c.h * (RAIL.compact ? 0.36 : 0.42), e), tagDy = RAIL.compact ? 16 : 20, badgeDy = RAIL.compact ? 24 : 32; // (compact: the tagline and badge sit tighter)
    ctx.font = `800 11px ${UI_FONT}`; const bw = ctx.measureText(bt).width + 16;
    textAt(label, tx, ly, fit(label, lerp(RAIL.compact ? 13 : 15, RAIL.compact ? 17 : 19, e), room - (1 - e) * (bw + 6)), "left", on ? "#fff" : "rgba(243,246,251,0.82)");
    if (e < 0.98) { ctx.globalAlpha = c.a * (1 - e); roundRect(c.x + c.w - bw - 10, midY - 9, bw, 18, 9); ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill(); textAt(bt, c.x + c.w - 10 - bw / 2, midY + 4, 11, "center", "rgba(255,255,255,0.7)"); }
    if (e > 0.02) {
      ctx.globalAlpha = c.a * e; textAt(info.tag, tx, ly + tagDy, fit(info.tag, RAIL.compact ? 11 : 12, room), "left", "#c8ced8");
      roundRect(tx, ly + badgeDy, bw, 19, 9.5); ctx.fillStyle = shade(info.col, -0.35); ctx.fill(); textAt(bt, tx + bw / 2, ly + badgeDy + 13.5, 11, "center", "#fff");
    }
    ctx.restore(); ctx.restore();
  }
}
function drawRailHeader() { // the logo, small, in the corner over the studio (on a phone: across the top), and your coins and stars under it
  const R = RAIL; drawTitleLogo(R.logoX, R.logoY, R.logoK);
  const line = `Coins ${wallet}     `, tail = `${totalStars()} / ${ROUTE.length * 3}`; ctx.font = `800 13px ${UI_FONT}`;
  const w1 = ctx.measureText(line).width, w2 = ctx.measureText(tail).width, y = R.coinsY, x0 = R.coinsRight ? R.coinsX - 14 - (w1 + 16 + w2) : R.coinsX - (w1 + 16 + w2) / 2; // (the compact layout puts the pill top right, on the logo's row)
  pill(x0 - 12, y - 15, w1 + w2 + 40, 22, "rgba(10,12,20,0.5)");
  textAt(line, x0, y, 13, "left", "#ffd23f"); drawStar(x0 + w1 + 6, y - 5, 6, true); textAt(tail, x0 + w1 + 16, y, 13, "left", "#ffd23f");
}
// where a screen's prompt line goes (menu coordinates; null = nowhere: no room): under the menu's column of cards, under the tyre panel, or centred
const FOOT = { x: 0, y: 0, ty: 0 };
function footPos() {
  const moy = menuOY(); FOOT.x = W / 2; FOOT.y = 466; FOOT.ty = 470;
  if (window.R3D && state === "menu") { FOOT.x = RAIL.x + RAIL.w / 2; FOOT.y = FOOT.ty = H - moy - (RAIL.compact ? 11 : 14); }
  else if (window.R3D && state === "tyres") { if (W < 600) return null; const L = tyreLayout(); FOOT.x = L.cx; FOOT.y = FOOT.ty = L.py + L.ph + 22; } // (a phone: the panel fills the bottom; its Back button is the way out)
  return FOOT;
}
function menuCards() { // where each card is right now (centre card biggest; drawn far-to-near)
  if (window.R3D) return railCards();
  const cw = Math.min(196, W * 0.56), ch = 266, top = 132, step = cw * 0.8 + 10, out = [];
  MAIN_MENU.forEach((_, i) => {
    const d = i - menuCar, ad = Math.abs(d);
    if (ad > 3.2) return;
    const s = 1 - Math.min(ad, 2) * 0.17, intro = clamp((clock - menuIntroT - i * 3) / 22, 0, 1), fly = (1 - intro) * (1 - intro);
    const w = cw * s, h = ch * s, bob = i === sel ? Math.sin(clock / 18) * 3 - 5 : 0;
    out.push({ i, d, s, x: W / 2 + d * step - w / 2, y: top + (ch - h) / 2 + bob + fly * 260, w, h, a: clamp(1 - ad * 0.28, 0.25, 1) * intro });
  });
  return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
}
function drawCarousel() {
  if (window.R3D) { drawRail(); return; }
  for (const c of menuCards()) {
    const info = CARD_INFO[c.i], on = c.i === sel, item = MAIN_MENU[c.i];
    ctx.save(); ctx.globalAlpha = c.a;
    if (on) { ctx.shadowColor = info.col; ctx.shadowBlur = 22 + 8 * Math.sin(clock / 10); }
    roundRect(c.x, c.y, c.w, c.h, 16);
    const bg = ctx.createLinearGradient(0, c.y, 0, c.y + c.h); bg.addColorStop(0, shade(info.col, -0.55)); bg.addColorStop(1, "#0d0e13");
    ctx.fillStyle = bg; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? info.col : "rgba(255,255,255,0.18)"; ctx.stroke();
    // the preview window
    const px = c.x + 10 * c.s, py = c.y + 10 * c.s, pw = c.w - 20 * c.s, ph = c.h * 0.56;
    ctx.save(); roundRect(px, py, pw, ph, 10); ctx.clip();
    ctx.fillStyle = "#07080c"; ctx.fillRect(px, py, pw, ph);
    ctx.translate(px + pw / 2, py + ph / 2); ctx.scale(c.s, c.s);
    drawCardArt(info.art, pw / c.s, ph / c.s, info.col);
    ctx.restore();
    if (on) { // a sheen that sweeps across the selected card
      ctx.save(); roundRect(c.x, c.y, c.w, c.h, 16); ctx.clip();
      const sx = c.x + ((clock * 4) % (c.w * 3)) - c.w, g = ctx.createLinearGradient(sx, 0, sx + 60, 0);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.13)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.restore();
    }
    const ty = py + ph;
    ctx.save(); roundRect(c.x + 2, c.y, c.w - 4, c.h, 16); ctx.clip(); // side cards are narrower: keep their text inside
    const room = c.w - 18 * c.s, fit = (str, size) => { ctx.font = `800 ${size}px ${UI_FONT}`; const w = ctx.measureText(str).width; return w > room ? size * room / w : size; }; // shrink text that would run past the card's edges
    const label = typeof item.label === "function" ? item.label() : item.label;
    textAt(label, c.x + c.w / 2, ty + 28 * c.s, fit(label, 19 * c.s), "center", "#fff");
    textAt(info.tag, c.x + c.w / 2, ty + 50 * c.s, fit(info.tag, 11 * c.s), "center", "#c8ced8");
    const bt = info.badge(); ctx.font = `800 ${Math.round(11 * c.s)}px ${UI_FONT}`; const bw = ctx.measureText(bt).width + 18 * c.s;
    roundRect(c.x + c.w / 2 - bw / 2, ty + 62 * c.s, bw, 20 * c.s, 10 * c.s); ctx.fillStyle = shade(info.col, -0.35); ctx.fill();
    textAt(bt, c.x + c.w / 2, ty + 76 * c.s, 11 * c.s, "center", "#fff");
    ctx.restore();
    ctx.restore();
  }
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(clock / 9); // pulsing arrows at the sides
  if (sel > 0) textAt("<", 14 - Math.sin(clock / 9) * 3, 272, 34, "left", "#fff");
  if (sel < MAIN_MENU.length - 1) textAt(">", W - 14 + Math.sin(clock / 9) * 3, 272, 34, "right", "#fff");
  ctx.globalAlpha = 1;
}
function drawGear(x, y, r, teeth, rot, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * TAU, rr = i % 2 ? r * 0.78 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a + TAU / teeth / 2) * rr, Math.sin(a + TAU / teeth / 2) * rr); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = "#07080c"; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, TAU); ctx.fill(); ctx.restore();
}
function drawCardArt(art, w, h, col) { // centred on (0, 0) inside a w x h window
  const t = clock;
  if (art === "tour") { // city flags streaming past, a route line and your car
    ctx.fillStyle = "#0f2a44"; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(0, 0, w * 0.45, h * 0.42 * Math.abs(Math.cos(t / 90 + k * 0.45)) + 1, 0, 0, TAU); ctx.stroke(); }
    for (let k = 0; k < 7; k++) {
      const span = 46 * 7, raw = k * 46 - t * 0.9, x = ((raw % span) + span) % span - 46 * 3.5, y = Math.sin(k * 1.7 + t / 40) * 18 - 14;
      const lap = Math.floor(-raw / span), n = ROUTE.length; // each time a flag wraps round it becomes the next city along
      ctx.save(); ctx.translate(x - 13, y - 8); drawFlag(ROUTE[(((k + lap * 7) % n) + n) % n].flag, 26, 16); ctx.restore();
    }
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t; ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.28); ctx.quadraticCurveTo(0, h * 0.05, w / 2, h * 0.3); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(0, h * 0.18); ctx.rotate(Math.PI / 2); ctx.scale(0.42, 0.42); drawCar(TEAMS[equipped]); ctx.restore();
  } else if (art === "daily") { // a calendar page with today's date and city
    const d = new Date();
    ctx.fillStyle = "#1d1206"; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.save(); ctx.rotate(Math.sin(t / 30) * 0.04);
    roundRect(-46, -50, 92, 98, 8); ctx.fillStyle = "#f4f1ea"; ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(-46, -50, 92, 24); textAt(d.toLocaleString("en", { month: "short" }).toUpperCase(), 0, -32, 13, "center", "#1d1206");
    textAt(String(d.getDate()), 0, 18, 40, "center", "#1d1206");
    ctx.save(); ctx.translate(-14, 26); drawFlag(ROUTE[dailyCity()].flag, 28, 17); ctx.restore();
    ctx.restore();
    for (let k = 0; k < 6; k++) { const a = t / 25 + k; glow(Math.cos(a) * w * 0.4, Math.sin(a * 1.3) * h * 0.38, 8, "255,210,63", 0.6); }
  } else if (art === "endless") { // a road rushing towards you forever
    const hor = -h * 0.3; ctx.fillStyle = "#0a1a10"; ctx.fillRect(-w / 2, -h / 2, w, h);
    const sky = ctx.createLinearGradient(0, -h / 2, 0, hor); sky.addColorStop(0, "#09131d"); sky.addColorStop(1, "#1f4d33"); ctx.fillStyle = sky; ctx.fillRect(-w / 2, -h / 2, w, hor + h / 2);
    ctx.fillStyle = "#2a2c33"; ctx.beginPath(); ctx.moveTo(-4, hor); ctx.lineTo(4, hor); ctx.lineTo(w * 0.55, h / 2); ctx.lineTo(-w * 0.55, h / 2); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 9; k++) { const z = ((k / 9 + t / 70) % 1), y = hor + (h / 2 - hor) * z * z, ww = 1 + z * 5, hh = 2 + z * 14; ctx.fillStyle = col; ctx.fillRect(-ww / 2, y, ww, hh); }
    glow(0, hor, 40, "61,255,110", 0.5);
  } else if (art === "vs") { // you and the CPU, neck and neck
    ctx.fillStyle = "#1e0b0b"; ctx.fillRect(-w / 2, -h / 2, w, h);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(-2, ((k * 30 + t * 3) % 180) - h / 2, 4, 14); }
    const lead = Math.sin(t / 35) * 14;
    ctx.save(); ctx.translate(-30, 6 - lead); ctx.scale(0.55, 0.55); drawCar(TEAMS[equipped]); ctx.restore();
    ctx.save(); ctx.translate(30, 6 + lead); ctx.scale(0.55, 0.55); drawCar(rivalTeam()); ctx.restore();
    textAt("VS", 0, -h / 2 + 30, 24, "center", col);
  } else if (art === "multi") { // P1 and P2 with their keys
    ctx.fillStyle = "#150b20"; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(-1, -h / 2, 2, h);
    for (const [s, team, lab, keys] of [[-1, TEAMS[equipped], "P1", "arrows"], [1, rivalTeam(), "P2", "WASD"]]) {
      ctx.save(); ctx.translate(s * w * 0.24, 4 + Math.sin(t / 20 + s) * 4); ctx.scale(0.5, 0.5); drawCar(team); ctx.restore();
      textAt(lab, s * w * 0.24, -h / 2 + 22, 15, "center", col); textAt(keys, s * w * 0.24, h / 2 - 10, 11, "center", "#ccc");
    }
  } else if (art === "garage") { // your car on a turntable
    ctx.fillStyle = "#06141c"; ctx.fillRect(-w / 2, -h / 2, w, h);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, h * 0.55); g.addColorStop(0, "rgba(95,212,255,0.35)"); g.addColorStop(1, "rgba(95,212,255,0)"); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = "rgba(95,212,255,0.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, h * 0.42, 0, TAU); ctx.stroke();
    ctx.save(); ctx.rotate(t / 60); ctx.scale(0.75, 0.75); drawCar(TEAMS[equipped]); ctx.restore();
  } else if (art === "stats") { // a trophy over rising bars
    ctx.fillStyle = "#1c1206"; ctx.fillRect(-w / 2, -h / 2, w, h);
    for (let k = 0; k < 5; k++) { const bh = (0.3 + 0.7 * Math.abs(Math.sin(t / 50 + k))) * h * 0.4; ctx.fillStyle = shade(col, -0.2 + k * 0.08); ctx.fillRect(-w * 0.4 + k * w * 0.17, h / 2 - bh, w * 0.12, bh); }
    ctx.save(); ctx.translate(0, -h * 0.08); ctx.scale(1.6, 1.6); ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(14, -18); ctx.lineTo(10, 2); ctx.quadraticCurveTo(0, 8, -10, 2); ctx.closePath(); ctx.fill(); ctx.fillRect(-2.5, 4, 5, 8); ctx.fillRect(-9, 12, 18, 4);
    ctx.restore();
    for (let k = 0; k < 4; k++) { const a = t / 20 + k * 1.6, x = Math.cos(a) * 34, y = -h * 0.12 + Math.sin(a) * 20; glow(x, y, 7 + 3 * Math.sin(t / 7 + k), "255,240,180", 0.8); }
  } else { // settings: gears turning together
    ctx.fillStyle = "#101318"; ctx.fillRect(-w / 2, -h / 2, w, h);
    drawGear(-18, 6, 34, 10, t / 40, "#7d8794"); drawGear(32, -24, 22, 7, -t / 40 * (10 / 7) + 0.2, "#aab4c0"); drawGear(34, 34, 16, 6, -t / 40 * (10 / 6), "#5f6873");
  }
}

function drawConfetti(oy) { // tumbling paper rectangles (oy undoes the menu centring: confetti fills the whole screen)
  for (const c of confetti) {
    ctx.save(); ctx.translate(c.x, c.y + oy); ctx.rotate(c.rot); ctx.scale(1, Math.abs(Math.cos(c.ph * 1.3)) + 0.15);
    ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
  }
}

// ---- title screen: animated logo over the demo race, your tour progress, press any key ----
function drawLogo(cx, cy, k) {
  ctx.save(); ctx.translate(cx, cy + Math.sin(clock / 30) * 3); ctx.scale(k, k); ctx.transform(1, 0, -0.18, 1, 0, 0); // a racing lean
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
  const word = (s, y, size, fill) => {
    ctx.font = `900 ${size}px sans-serif`;
    ctx.lineWidth = size / 6; ctx.strokeStyle = "#120a04"; ctx.strokeText(s, 0, y);
    ctx.fillStyle = fill; ctx.fillText(s, 0, y);
    const w = ctx.measureText(s).width, p = ((clock % 150) / 150) * (w + 200) - w / 2 - 100; // a shine sweeping across the letters
    const sh = ctx.createLinearGradient(p - 40, 0, p + 40, 0); sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.5, "rgba(255,255,255,0.75)"); sh.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sh; ctx.fillText(s, 0, y);
  };
  const g = ctx.createLinearGradient(0, -60, 0, 0); g.addColorStop(0, "#ffe25a"); g.addColorStop(1, "#ff6a1a");
  word("EXTREME", -6, 58, g);
  word("RACING", 44, 46, "#ffffff");
  ctx.restore();
}
// ---- the title screen: your car gliding through a golden-hour city, a big glowing logo, and nothing else in the way ----
const TITLE_FONT = `900 italic %spx "Arial Black", Impact, "Helvetica Neue", sans-serif`;
function spaced(s, x, y, gap, mode) { // text drawn letter by letter with extra spacing, centred on x; mode "stroke" | "fill"
  let w = 0; for (const c of s) w += ctx.measureText(c).width + gap; w -= gap; let px = x - w / 2;
  ctx.textAlign = "left"; for (const c of s) { if (mode === "stroke") ctx.strokeText(c, px, y); else ctx.fillText(c, px, y); px += ctx.measureText(c).width + gap; }
  return w;
}
function drawTitleLogo(cx, cy, k) {
  ctx.save(); ctx.translate(cx, cy + Math.sin(clock / 45) * 2); ctx.scale(k, k); ctx.transform(1, 0, -0.16, 1, 0, 0); ctx.lineJoin = "round"; ctx.textBaseline = "alphabetic";
  // racing stripes either side of RACING
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { ctx.fillStyle = ["#ff3b30", "#ff9500", "#ffd60a"][i]; ctx.globalAlpha = 0.95 - i * 0.12; ctx.save(); ctx.scale(s, 1); ctx.beginPath(); ctx.moveTo(100 + i * 9, 30 + i * 9); ctx.lineTo(224 + i * 9, 30 + i * 9); ctx.lineTo(214 + i * 9, 38 + i * 9); ctx.lineTo(94 + i * 9, 38 + i * 9); ctx.closePath(); ctx.fill(); ctx.restore(); }
  ctx.globalAlpha = 1;
  // EXTREME: warm metal gradient, a dark edge, an orange glow
  ctx.font = TITLE_FONT.replace("%s", 70);
  const g = ctx.createLinearGradient(0, -62, 0, 6); g.addColorStop(0, "#fffbe8"); g.addColorStop(0.45, "#ffd84a"); g.addColorStop(1, "#ff5a14");
  ctx.shadowColor = "rgba(255,120,30,0.65)"; ctx.shadowBlur = 28; ctx.lineWidth = 12; ctx.strokeStyle = "#1a0b05"; spaced("EXTREME", 0, 0, 2, "stroke"); ctx.shadowBlur = 0;
  ctx.fillStyle = g; const w = spaced("EXTREME", 0, 0, 2, "fill");
  // a bright glint sweeping across the word every few seconds
  const cyc = (clock % 260) / 260, px = (cyc * 1.6 - 0.3) * w - w / 2; if (cyc < 0.6) { const sh = ctx.createLinearGradient(px - 40, -60, px + 40, 10); sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.5, "rgba(255,255,255,0.85)"); sh.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = sh; spaced("EXTREME", 0, 0, 2, "fill"); }
  // RACING: crisp white, wide-set
  ctx.font = TITLE_FONT.replace("%s", 56); ctx.lineWidth = 10; ctx.strokeStyle = "#0d0f1c"; ctx.shadowColor = "rgba(120,170,255,0.5)"; ctx.shadowBlur = 20; spaced("RACING", 0, 62, 10, "stroke"); ctx.shadowBlur = 0;
  const g2 = ctx.createLinearGradient(0, 20, 0, 66); g2.addColorStop(0, "#ffffff"); g2.addColorStop(1, "#b9d4ff"); ctx.fillStyle = g2; spaced("RACING", 0, 62, 10, "fill");
  ctx.restore();
}
// ---- the 3D title: a car-launch reel of your car (showroom.js) with the text in its own calm, dark area ----
// Wide screen: all the text in a column on the left over a soft dark gradient, the reel framed in the space to its right.
// Squarish window or phone: the text in a dark band at the top and one at the bottom, the reel letterboxed between them.
// The studio frames every shot in the free area it is told about (studioRects.title), so the car and its highlights never sit behind a word.
function drawTitleReel(moy, out) {
  const wide = W >= 600 && W / H >= 1.3, top = -moy, bot = H - moy, ink = al => `rgba(6,5,9,${al})`;
  let cx, k, logoY, tagY, promptY, nextY, flagsY, colW;
  if (wide) {
    colW = Math.min(W * 0.42, 440); cx = colW / 2 + 6; k = Math.min(0.78, (colW - 36) / 400);
    logoY = 150; tagY = logoY + 90 * k + 18; promptY = 322; nextY = 358; flagsY = 378;
    setRect(studioRects.title, (colW + 46) / W, 0.985, 0.05, 0.95); titleToastY = 0;
  } else {
    colW = W; cx = W / 2; k = Math.min(0.7, (W - 24) / 400);
    logoY = top + 18 + 62 * k; tagY = logoY + 90 * k + 14; flagsY = bot - 26; nextY = flagsY - 22; promptY = nextY - 34;
    titleToastY = tagY + 12 + moy; // (screen space)
    setRect(studioRects.title, 0.02, 0.98, (tagY + 26 + moy) / H, (promptY - 32 + moy) / H);
  }
  ctx.save(); ctx.globalAlpha = 1 - out;
  // the calm area behind the text: nearly black next to the words, fading into the studio
  if (wide) { const e = colW + 170, g = ctx.createLinearGradient(0, 0, e, 0); g.addColorStop(0, ink(0.96)); g.addColorStop((colW + 14) / e, ink(0.93)); g.addColorStop((colW + 60) / e, ink(0.6)); g.addColorStop((colW + 110) / e, ink(0.2)); g.addColorStop(1, ink(0)); ctx.fillStyle = g; ctx.fillRect(0, top, e, H); } // (a long, eased fade: no visible edge; nearly black under every word, even when a close-up of the car fills the picture)
  else {
    const t1 = tagY + 26, b0 = promptY - 32;
    ctx.fillStyle = ink(0.95); ctx.fillRect(0, top, W, t1 - 6 - top); ctx.fillRect(0, b0 + 6, W, bot - b0 - 6);
    let g = ctx.createLinearGradient(0, t1 - 6, 0, t1 + 30); g.addColorStop(0, ink(0.95)); g.addColorStop(1, ink(0)); ctx.fillStyle = g; ctx.fillRect(0, t1 - 6, W, 36);
    g = ctx.createLinearGradient(0, b0 - 30, 0, b0 + 6); g.addColorStop(0, ink(0)); g.addColorStop(1, ink(0.95)); ctx.fillStyle = g; ctx.fillRect(0, b0 - 30, W, 36);
  }
  drawTitleLogo(cx, logoY, k * (1 + 0.25 * out));
  // tagline (with thin rules either side when there is room)
  ctx.font = `800 ${wide ? 12 : 13}px ${UI_FONT}`; ctx.textAlign = "center";
  const tag = "22 CITIES   -   ONE WORLD TOUR", tw = (() => { let w = 0; for (const c of tag) w += ctx.measureText(c).width + 3; return w; })();
  if (tw + 110 < colW) { ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(cx - tw / 2 - 52, tagY - 5, 40, 1); ctx.fillRect(cx + tw / 2 + 12, tagY - 5, 40, 1); }
  ctx.fillStyle = "#cfd8ff"; spaced(tag, cx, tagY, 3, "fill");
  // the prompt: breathing
  const pulse = 0.6 + 0.4 * Math.sin(clock / 14), prompt = onTouch() ? "TAP TO START" : onPad() || hasPad ? "PRESS ANY BUTTON" : "PRESS ANY KEY";
  let ps = 19; ctx.font = `800 ${ps}px ${UI_FONT}`; while (ps > 13 && ctx.measureText(prompt).width + prompt.length * 4 > colW - 24) { ps--; ctx.font = `800 ${ps}px ${UI_FONT}`; }
  ctx.save(); ctx.globalAlpha *= pulse; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(255,210,140,0.6)"; ctx.shadowBlur = 12; spaced(prompt, cx, promptY, 4, "fill"); ctx.restore();
  // where you are in the tour, and your stars, on one line
  const next = Math.min(tourCleared, ROUTE.length - 1), st = ROUTE[next], done = tourCleared >= ROUTE.length, line = done ? "TOUR COMPLETE" : `NEXT STOP  ${st.venue.toUpperCase()}`, stars = totalStars() ? `${totalStars()} / ${ROUTE.length * 3}` : "";
  ctx.font = `800 13px ${UI_FONT}`; const lw = ctx.measureText(line).width, sw = stars ? ctx.measureText(stars).width + 34 : 0, fl = done ? 0 : 26, x0 = cx - (fl + lw + sw) / 2;
  if (!done) { ctx.save(); ctx.translate(x0, nextY - 11); drawFlag(st.flag, 18, 12); ctx.restore(); }
  textAt(line, x0 + fl, nextY, 13, "left", "#ffd23f");
  if (stars) { drawStar(x0 + fl + lw + 22, nextY - 5, 6, true); textAt(stars, x0 + fl + lw + 32, nextY, 13, "left", "#ffd23f"); }
  // the 22 flags: the ones you have raced bright, the rest dim
  const fw = Math.min(15, (colW - 24) / ROUTE.length - 3), fh = fw * 0.66, fx0 = cx - (ROUTE.length * (fw + 3) - 3) / 2;
  ROUTE.forEach((c, i) => { ctx.save(); ctx.globalAlpha *= i < tourCleared ? 1 : i === tourCleared ? 0.85 : 0.32; ctx.translate(fx0 + i * (fw + 3), flagsY); drawFlag(c.flag, fw, fh); ctx.restore(); });
  if (wide) textAt(`v${VERSION}`, 14, bot - 10, 10, "left", "rgba(255,255,255,0.45)"); // (in the text column, not over the reel)
  ctx.restore();
}
function drawTitle(moy, out = 0) { // out: 0 .. 1 as the title leaves (the logo grows and fades while the camera pushes in)
  if (window.R3D) { drawTitleReel(moy, out); return; }
  const top = -moy, bot = H - moy, studio = false;
  ctx.save(); ctx.globalAlpha = 1 - out;
  // light, cinematic grading: dark at the top and bottom, clear in the middle where the car is (the studio is dark already: just a touch)
  let g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, `rgba(6,8,20,${studio ? 0.5 : 0.78})`); g.addColorStop(0.3, `rgba(6,8,20,${studio ? 0.04 : 0.18})`); g.addColorStop(0.62, "rgba(6,8,20,0.0)"); g.addColorStop(1, `rgba(6,8,20,${studio ? 0.6 : 0.88})`);
  ctx.fillStyle = g; ctx.fillRect(0, top, W, H);
  // cinema bars top and bottom (a wide screen only), with thin golden lines on their edges
  const bar = studio && W / H > 1.2 ? Math.round(H * 0.075 * (1 - out)) : 0;
  if (bar) { ctx.fillStyle = "#000"; ctx.fillRect(0, top, W, bar); ctx.fillRect(0, bot - bar, W, bar); }
  ctx.fillStyle = "rgba(255,200,90,0.55)"; ctx.fillRect(0, top + Math.max(14, bar), W, 1); ctx.fillRect(0, bot - Math.max(14, bar) - 1, W, 1);
  // warm light motes drifting up
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < (settings.lowfx ? 10 : 34); i++) {
    const sp = 0.15 + (i % 5) * 0.07, x = (i * 97 + Math.sin(clock / 90 + i) * 14) % W, y = bot - ((clock * sp + i * 53) % (H + 40)), r = 1 + (i % 3) * 0.9;
    ctx.fillStyle = `rgba(255,${190 + (i % 4) * 15},120,${0.12 + (i % 4) * 0.05})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
  const ly = studio ? 84 : 128, lk = (studio ? 0.86 : 1.05) * (1 + 0.25 * out); // (over the studio the logo sits higher and a little smaller: the car is the hero)
  drawTitleLogo(W / 2, ly, Math.min(lk, (W - 24) / 400 * (1 + 0.25 * out)));
  // tagline between two thin rules
  ctx.font = `800 13px ${UI_FONT}`; ctx.textAlign = "center";
  const tag = "22 CITIES   -   ONE WORLD TOUR", tw = (() => { let w = 0; for (const c of tag) w += ctx.measureText(c).width + 3; return w; })(), ty = studio ? 166 : 224;
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(W / 2 - tw / 2 - 52, ty, 40, 1); ctx.fillRect(W / 2 + tw / 2 + 12, ty, 40, 1);
  ctx.fillStyle = "#cfd8ff"; spaced(tag, W / 2, ty + 5, 3, "fill");
  // where you are in the tour
  const next = Math.min(tourCleared, ROUTE.length - 1), st = ROUTE[next], done = tourCleared >= ROUTE.length;
  textAt(done ? "TOUR COMPLETE" : `NEXT STOP  ${st.venue.toUpperCase()}`, W / 2 + (done ? 0 : 12), 438, 13, "center", "#ffd23f");
  if (!done) { ctx.save(); ctx.translate(W / 2 - ctx.measureText(`NEXT STOP  ${st.venue.toUpperCase()}`).width / 2 - 10, 427); drawFlag(st.flag, 18, 12); ctx.restore(); }
  // the 22 flags: the ones you have raced bright, the rest dim
  const fw = Math.min(17, (W - 40) / ROUTE.length - 3), fh = fw * 0.66, x0 = W / 2 - (ROUTE.length * (fw + 3) - 3) / 2;
  ROUTE.forEach((c, i) => { ctx.globalAlpha = i < tourCleared ? 1 : i === tourCleared ? 0.85 : 0.32; ctx.save(); ctx.translate(x0 + i * (fw + 3), 452); drawFlag(c.flag, fw, fh); ctx.restore(); });
  ctx.globalAlpha = 1;
  if (totalStars()) { drawStar(W - 60, 438, 6, true); textAt(`${totalStars()} / ${ROUTE.length * 3}`, W - 50, 442, 12, "left", "#ffd23f"); }
  // the prompt: breathing, with a little chevron
  const pulse = 0.6 + 0.4 * Math.sin(clock / 14);
  ctx.globalAlpha = pulse; ctx.font = `800 19px ${UI_FONT}`; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(255,255,255,0.7)"; ctx.shadowBlur = 12;
  spaced(onTouch() ? "TAP TO START" : onPad() || hasPad ? "PRESS ANY BUTTON" : "PRESS ANY KEY", W / 2, studio ? 410 : 398, 4, "fill"); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  ctx.restore();
}
// Where the 2D layer leaves room for the car in the studio, as fractions of the screen (showroom.js frames the car in it). Reused objects.
const studioRects = { title: { left: 0, right: 1, top: 0.36, bottom: 0.9 }, menu: { left: 0.02, right: 0.56, top: 0.12, bottom: 0.9 }, tyre: { left: 0.02, right: 0.56, top: 0.12, bottom: 0.9 } };
window.studioRects = studioRects;
const setRect = (r, l, rt, t, b) => { r.left = l; r.right = rt; r.top = t; r.bottom = b; };

function drawUpgrades() {
  heading("UPGRADES", 46, 30);
  text(`Coins ${wallet}`, 74, 16, "center", "#ffd23f");
}
function drawUpgradeRows() { // on top of the row buttons: name, what it does now (and next), level pips, next price
  const menu = currentMenu();
  UPGRADES.forEach((u, i) => {
    const r = btnRect(menu, i), l = upLvl(u.key), max = l >= 5, cost = UPG_COST[l];
    textAt(u.name, r.x + 14, r.y + 22, 16, "left");
    textAt(max ? u.now(l) : `${u.now(l)}  >  ${u.next(l + 1)}`, r.x + 14, r.y + 44, 11, "left", "#cfd8e3");
    for (let k = 0; k < 5; k++) { roundRect(r.x + r.w - 150 + k * 16, r.y + 12, 12, 12, 3); ctx.fillStyle = k < l ? "#3dff6e" : "rgba(255,255,255,0.18)"; ctx.fill(); }
    textAt(max ? "MAX" : `${cost}c`, r.x + r.w - 14, r.y + 24, 15, "right", max ? "#3dff6e" : wallet >= cost ? "#ffd23f" : "#ff7b7b");
  });
}

function drawGauge(r) { // the speedo: a half dial at the bottom left (low enough to sit under the touch pedals), the speed big inside it, the gear beside it
  const cx = 60, cy = H - 8, R = 46, f = clamp(effV(r) / NITRO_MAX, 0, 1), nitro = r.nitro > 0;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 7, Math.PI, TAU); ctx.closePath();
  const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, R + 7); bg.addColorStop(0, "rgba(8,10,17,0.9)"); bg.addColorStop(1, "rgba(22,26,40,0.78)"); ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.lineCap = "round"; ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.arc(cx, cy, R - 3, Math.PI, TAU); ctx.stroke();
  const g = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  if (nitro) { g.addColorStop(0, "#2a7bff"); g.addColorStop(1, "#7fe8ff"); } else { g.addColorStop(0, "#4cd964"); g.addColorStop(0.55, "#ffd23f"); g.addColorStop(1, "#ff3b30"); }
  ctx.strokeStyle = g; ctx.shadowColor = nitro ? "rgba(95,212,255,0.9)" : `rgba(${UI_ACC_RGB},0.6)`; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(cx, cy, R - 3, Math.PI, Math.PI + Math.max(0.02, f) * Math.PI); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.lineCap = "butt"; ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI, k = i % 5 ? 0 : 3; ctx.moveTo(cx + Math.cos(a) * (R - 10 - k), cy + Math.sin(a) * (R - 10 - k)); ctx.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); }
  ctx.stroke();
  const a = Math.PI + f * Math.PI + (f > 0.98 ? Math.sin(clock * 1.9) * 0.035 + rnd(-0.015, 0.015) : 0); // pinned: the tip quivers
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3), 3.6, 0, TAU); ctx.fill();
  ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = `italic 900 21px ${UI_FONT}`; ctx.fillText(String(Math.round(r.v * 60)), cx, cy - 11);
  ctx.font = `700 8px ${UI_FONT}`; ctx.fillStyle = "rgba(255,255,255,0.6)"; try { ctx.letterSpacing = "1px"; } catch (e) {} ctx.fillText("KM/H", cx, cy - 1); try { ctx.letterSpacing = "0px"; } catch (e) {}
  // the gear: a small glass tile
  const gx = cx + R + 10, gy = cy - 34;
  roundRect(gx, gy, 26, 30, 7); ctx.fillStyle = "rgba(10,12,20,0.72)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.stroke();
  ctx.fillStyle = UI_ACC; ctx.fillRect(gx + 7, gy, 12, 2);
  ctx.fillStyle = "#fff"; ctx.font = `italic 900 17px ${UI_FONT}`; ctx.fillText(String(gearOf(r.v)), gx + 13, gy + 20);
  ctx.font = `700 6px ${UI_FONT}`; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText("GEAR", gx + 13, gy + 27);
  ctx.restore();
  if (r.v >= 4.6) textAt("SLIPSTREAM", gx, gy - 6, 10, "left", "#39ff14");
}

const roundLabel = st => level && level.daily && state !== "map" && state !== "brief" ? `DAILY CHALLENGE` : st.n === ROUTE.length ? `GRAND FINAL` : st.venue.toUpperCase() === st.country ? `ROUND ${st.n}` : `ROUND ${st.n}  -  ${st.venue.toUpperCase()}`; // no 'ABU DHABI - ABU DHABI'
function drawStageBar() { // which city you're in, and how far through it: a glass track between the speedo and the pause button, halfway and finish marked, your car on it
  const st = ROUTE[stageIdx], x0 = Math.max(150, W / 2 - 140), x1 = Math.min(W - 52, W / 2 + 140), w = x1 - x0, y = H - 16, mid = (x0 + x1) / 2;
  ctx.font = `800 12px ${UI_FONT}`;
  const tw = ctx.measureText(st.country).width, fw = 18, fx = mid - (tw + fw + 6) / 2, top = level ? 22 : 0; // (the country line moves up to make room for the labels)
  ctx.save(); ctx.translate(fx, y - 30 - top); drawFlag(st.flag, fw, 12); ctx.restore();
  textAt(st.country, fx + fw + 6, y - 19 - top, 12, "left", "#fff");
  pill(x0 - 2, y - 6, w + 4, 10, "rgba(10,12,20,0.7)");
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, "#ff8a1a"); g.addColorStop(1, "#ffd98a");
  ctx.save(); ctx.shadowColor = `rgba(${UI_ACC_RGB},0.8)`; ctx.shadowBlur = 8; roundRect(x0, y - 4, Math.max(6, w * clamp(stageFrac, 0, 1)), 6, 3); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  if (level) {
    const hx = x0 + w / 2, past = stageFrac >= 0.5, fx2 = x1, carX = x0 + w * clamp(stageFrac, 0, 1);
    ctx.fillStyle = past ? "#7CFC9A" : "rgba(255,255,255,0.85)"; ctx.fillRect(hx - 1, y - 11, 2, 13); // halfway
    textAt("HALFWAY", hx, y - 14, 8, "center", past ? "#7CFC9A" : "rgba(255,255,255,0.85)");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(fx2 - 1, y - 20, 1.5, 22); // finish: a chequered flag on a pole
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? "#ffffff" : "#111111"; ctx.fillRect(fx2 + 0.5 + i * 3, y - 20 + j * 3, 3, 3); }
    textAt("FINISH", fx2 + 6, y - 24, 8, "center", "#ffffff");
    ctx.save(); ctx.translate(carX, y - 1); ctx.rotate(Math.PI / 2); ctx.scale(0.17, 0.17); drawCar(racers[0] ? racers[0].team : TEAMS[equipped], { slip: false }); ctx.restore(); // your own car, in your colours
    if (Math.abs(carX - hx) > 24 && Math.abs(carX - fx2) > 24 && carX > x0 + 38) textAt("YOU", carX, y - 10, 8, "center", "#ffe11a"); else textAt("YOU", carX, y + 13, 8, "center", "#ffe11a");
  }
  textAt(`${st.n}/${ROUTE.length}   ${runKm()} km`, mid, y + 13, 10, "center", "rgba(255,255,255,0.75)");
}

function drawBanner() { // a small card that slides in from the left edge and leaves again, clear of the road
  const t = banner.t, st = ROUTE[banner.idx];
  const inK = smooth(Math.min(t, 24) / 24), outK = t > 170 ? smooth((t - 170) / 30) : 0;
  // fit the text: the card grows to the widest line, and a line that is still too wide shrinks (long names like "BRUSSELS" were spilling out of the box)
  const line2 = roundLabel(st), fit = (s, size, max) => { ctx.font = `800 ${size}px ${UI_FONT}`; const w = ctx.measureText(s).width; return w > max ? Math.max(7, Math.floor(size * max / w)) : size; };
  const maxW = Math.min(W * 0.55, 230);
  const s1 = fit(st.country, 12, maxW - 58), s2 = fit(line2, 9, maxW - 58);
  ctx.font = `800 ${s1}px ${UI_FONT}`; const w1 = ctx.measureText(st.country).width; ctx.font = `800 ${s2}px ${UI_FONT}`; const w2 = ctx.measureText(line2).width;
  const cardW = Math.max(150, 48 + Math.max(w1, w2) + 12);
  ctx.save();
  ctx.globalAlpha = clamp(1 - outK, 0, 1);
  if (bannerNarrow()) ctx.translate(W / 2 - cardW / 2, hudStackTop(false) + (1 - inK) * -10); // (a narrow screen: in the centre column, where it cannot cover the combo or the popups)
  else ctx.translate(6 - (1 - inK) * (cardW + 6) - outK * (cardW + 6), 104);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(0, 0, cardW, 44, 9); ctx.fill();
  ctx.save(); ctx.translate(8, 11); drawFlag(st.flag, 32, 22); ctx.restore();
  textAt(st.country, 48, 19, s1, "left", "#fff");
  textAt(line2, 48, 34, s2, "left", "#ffd23f");
  ctx.restore();
}

function drawCameraIcon() {
  ctx.save();
  ctx.translate(24, 24);
  ctx.fillStyle = "rgba(10,12,20,0.6)"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#fff"; roundRect(-8, -4.5, 16, 11, 2.5); ctx.fill(); ctx.fillRect(-3.5, -7.5, 7, 4);
  ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(0, 1, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(-1, 0, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

// First touch race only: light up the two halves of the screen so it's obvious where to tap to change lanes
function drawSteerHint() {
  const top = 160, bot = pedalRects().gas.y - 14, mid = (top + bot) / 2, pulse = 0.5 + 0.5 * Math.sin(clock / 9);
  for (const side of [-1, 1]) {
    const x = side < 0 ? 0 : W / 2, cx = side < 0 ? W * 0.25 : W * 0.75;
    ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.06 * pulse})`; ctx.fillRect(x + 6, top, W / 2 - 12, bot - top);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(x + 6, top, W / 2 - 12, bot - top); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`; poly([[cx - side * 16, mid - 22], [cx - side * 16, mid + 22], [cx + side * 20, mid]]); // arrow pointing outwards
    textAt("TAP", cx, mid + 48, 18);
    textAt(side < 0 ? "to move left" : "to move right", cx, mid + 66, 12, "center", "#ddd");
  }
}

// a five-pointed star; gold when earned, an empty outline when not
function drawStar(cx, cy, r, on) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
  if (on) { ctx.fillStyle = "#ffd23f"; ctx.fill(); ctx.strokeStyle = "#b8860b"; } else { ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.5)"; }
  ctx.lineWidth = 2; ctx.stroke();
}

// the Daily Challenge's card on the grid: today's city, best and streak
function drawDailyCard() {
  const st = ROUTE[level.idx], y = 168;
  ctx.fillStyle = "rgba(0,0,0,0.6)"; roundRect(W / 2 - 120, y, 240, 100, 12); ctx.fill();
  textAt("DAILY CHALLENGE", W / 2, y + 22, 14, "center", "#ffd23f");
  textAt(`${st.venue}, ${st.country}`, W / 2, y + 45, 13);
  textAt(`Today's best: ${dailyBest()}`, W / 2, y + 68, 13, "center", "#9be89b");
  textAt(`Streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"} in a row`, W / 2, y + 89, 12, "center", "#ffb347");
}

// before the lights go green in a tour city: what each star needs
function drawTargets() {
  const tg = starTargets(level.idx), y = 168, rows = [[1, level.final ? "Beat the CPU to the line" : "Finish the city"], [2, `Score ${tg[0]}`], [3, `Score ${tg[1]}`]];
  ctx.fillStyle = "rgba(0,0,0,0.6)"; roundRect(W / 2 - 110, y, 220, 104, 12); ctx.fill();
  textAt("CITY TARGETS", W / 2, y + 20, 13, "center", "#ffd23f");
  rows.forEach(([n, label], i) => {
    for (let k = 0; k < 3; k++) drawStar(W / 2 - 84 + k * 15, y + 40 + i * 24, 6, k < n);
    textAt(label, W / 2 - 30, y + 45 + i * 24, 13, "left", (cityStars[level.idx] || 0) >= n ? "#9be89b" : "#fff");
  });
}

const hudBands = { h: -1, t: null, b: null };
function drawHud() {
  if (splitScreen()) { drawSplitHud(); return; } // two players, half the screen each (below)
  const p0 = racers[0];
  if (window.R3D) { // soft dark bands behind the top and bottom rows of the HUD: the numbers never sit on a bright sky, a white car or a lit road (made once per screen height)
    if (hudBands.h !== H) { hudBands.h = H; const t = hudBands.t = ctx.createLinearGradient(0, 0, 0, 96); t.addColorStop(0, "rgba(4,6,12,0.42)"); t.addColorStop(1, "rgba(4,6,12,0)"); const b = hudBands.b = ctx.createLinearGradient(0, H - 120, 0, H); b.addColorStop(0, "rgba(4,6,12,0)"); b.addColorStop(1, "rgba(4,6,12,0.5)"); }
    ctx.fillStyle = hudBands.t; ctx.fillRect(0, 0, W, 96); ctx.fillStyle = hudBands.b; ctx.fillRect(0, H - 120, W, 120);
  }
  if (mode === "single" || mode === "tour" || mode === "daily" || mode === "tutorial") {
    if (grid.done || mode === "single") { // (on the grid there is no score yet: keep the start lights clear)
      ctx.save(); ctx.font = `italic 900 34px ${UI_FONT}`; ctx.textAlign = "center"; try { ctx.letterSpacing = "1px"; } catch (e) {}
      ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = "#fff"; ctx.fillText(String(p0.score), W / 2, 54); ctx.restore();
    }
    ctx.font = `800 14px ${UI_FONT}`; const cw = ctx.measureText(String(p0.coins)).width; pill(44, 13, cw + 38, 22); drawCoin(57, 24, 7, 1); textAt(String(p0.coins), 70, 29, 14, "left", "#ffd23f");
    if (level && level.daily) { if (grid.done) text(`Today's best ${dailyBest()}`, 76, 12, "center", "#9be89b"); }
    else if (level) { // the next star to chase, right under the score
      const tg = starTargets(level.idx), next = p0.score < tg[0] ? [2, tg[0]] : p0.score < tg[1] ? [3, tg[1]] : null;
      if (grid.done) { // the next star to chase, in a small pill under the score
        ctx.font = `800 12px ${UI_FONT}`; const n = next ? next[0] : 3, lab = next ? String(next[1]) : "", pw = n * 11 + (lab ? ctx.measureText(lab).width + 10 : 0) + 16;
        pill(W / 2 - pw / 2, 64, pw, 18); for (let k = 0; k < n; k++) drawStar(W / 2 - pw / 2 + 13 + k * 11, 73, 4.5, true); if (lab) textAt(lab, W / 2 - pw / 2 + 10 + n * 11 + 4, 77.5, 12, "left", "#ffd23f");
      }
      if (level.final) { // where the CPU really is: 1st / 2nd and the gap in seconds
        const c = racers[1], cy = c.trueY === undefined ? c.y : c.trueY, first = !c.alive || racers[0].y <= cy, gap = Math.abs(cy - racers[0].y) / Math.max(1, racers[0].v * 60);
        text(first ? "1st" : "2nd", 34, 20, "right", first ? "#3dff6e" : "#ff5a5a");
        if (grid.done && racers[0].v > 1) text(`${first ? "+" : "-"}${gap.toFixed(1)}s`, 56, 13, "right", "#ddd");
      }
    }
  } else {
    racers.forEach((r, i) => {
      text(`${r.label} ${r.score}`, 34, 20, i === 0 ? "left" : "right");
      text(`${Math.round(r.v * 60)} km/h`, 72, 12, i === 0 ? "left" : "right", "#ddd");
    });
    const c = racers[1];
    if (mode === "vs" && c && c.alive && grid.done && p0.v > 1) { // where the CPU really is (it can be off screen): ahead of you or behind, in seconds
      const cy = c.trueY === undefined ? c.y : c.trueY, gap = Math.abs(cy - p0.y) / (p0.v * 60), ahead = cy < p0.y;
      text(gap < 0.05 ? "LEVEL" : `${ahead ? "AHEAD" : "BEHIND"} ${gap.toFixed(1)}s`, 88, 12, "right", gap < 0.05 ? "#ffd23f" : ahead ? "#ff5a5a" : "#3dff6e");
    }
  }
  if (p0.shield && p0.alive) drawShieldIcon(24, 64, 11, clock); // shield ready (under the camera button)
  if (p0.comboT > 0 && p0.combo >= 2) { // the live combo and how long it has left
    const y = level ? 104 : 88, k = p0.comboT / COMBO_T, pulse = 1 + 0.15 * Math.max(0, 1 - (COMBO_T - p0.comboT) / 10);
    textAt(`COMBO x${p0.combo}`, W / 2, y, 16 * pulse, "center", p0.combo >= 5 ? "#ff7a1a" : "#ffd23f");
    ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(W / 2 - 40, y + 5, 80, 4, 2); ctx.fill();
    ctx.fillStyle = p0.combo >= 5 ? "#ff7a1a" : "#ffd23f"; roundRect(W / 2 - 40, y + 5, Math.max(4, 80 * k), 4, 2); ctx.fill();
  }
  for (const p of pops) { // "CLOSE!" rising beside the car
    const s = racerScreen(p.r), side = s.x < W / 2 ? 1 : -1;
    ctx.globalAlpha = clamp((50 - p.t) / 15, 0, 1);
    textAt(p.text, s.x + side * 58, s.y - p.t * 0.8, 15 + Math.min(p.t, 6), "center", p.col || "#7fffd4");
    ctx.globalAlpha = 1;
  }
  if (p0.alive && p0.bypass) drawBypass(p0);
  if (p0.alive && cam !== 2 && !p0.ai && grid.done) drawTyreChip(p0); // (not on the grid: the tyre screen told you already)
  if (p0.alive && state === "playing" && !p0.launched && (!grid.done || p0.charging || p0.launchLocked) && !p0.ai) drawLaunchGauge(p0);
  if (p0.alive && p0.nitro > 0) { // nitro burn bar
    const w = 130, x = W / 2 - w / 2, y = 10, g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#2a7bff"); g.addColorStop(1, "#7fe8ff");
    ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(x - 2, y - 2, w + 4, 12, 6); ctx.fill();
    ctx.fillStyle = g; roundRect(x, y, Math.max(6, w * p0.nitro / (p0.nitroMax || NITRO_FRAMES)), 8, 4); ctx.fill();
  }
  const menuUp = state === "paused" || state === "camera"; // (a menu is open over the race: the bottom of the HUD steps aside for its prompts)
  if (p0.alive && cam !== 2 && !menuUp) drawGauge(p0);
  if (menuUp) {} else if (cam === 2) textAt(`${ROUTE[stageIdx].country}  ${runKm()} km`, 46, 52, 11, "left", "#fff"); // (beside the shield icon, under the coins) // the wheel covers the bottom bar
  else if (mode === "tutorial") drawTutorialDots(H - 16); // (the test drive: how far through the lessons you are)
  else drawStageBar();
  if (cam === 2 && !menuUp && mode === "tutorial") drawTutorialDots(tutSkipRect().y + 44, true); // (cockpit: the wheel covers the bottom, so the dots sit top right)
  if (state === "playing" && mode !== "tutorial" && (!grid.done || frame < grid.goFrame + 120)) { // what to do, tucked low so it never covers the road
    const f = grid.done ? clamp((grid.goFrame + 120 - frame) / 30, 0, 1) : 1;
    ctx.globalAlpha = f;
    // (on the grid the launch gauge carries the only hint; after the green, how to steer, up under the score and clear of the car)
    if (grid.done) { if (onTouch() && mode !== "multi") text("Tap a side to steer", 100, 13); else if (mode === "multi") text("P1: Arrows    P2: W A S D", 100, 13); else drawPrompt([["steer", "Steer"]], W / 2, 96, 15); } // (just the one thing you need right now; the popups wait below it)
    ctx.globalAlpha = 1;
  }
  if (banner && state === "playing" && grid.done) drawBanner(); // (the city card waits for the green: the tyre screen named the city)
  drawCameraIcon();
  if (hasTouch) { // touch pedals, only shown once the screen has actually been touched
    if (steerHint && state === "playing" && grid.done && mode !== "tutorial") drawSteerHint(); // (the test drive teaches steering itself) // (not on the grid: you cannot steer yet, and the zones would cover the start lights)
    drawPedals();
  }
  drawPauseButton();
}
function drawPedals() {
  const pr = pedalRects();
  for (const [r, on, label, col] of [[pr.brake, touch.brake, "BRAKE", "#ff4d4d"], [pr.gas, touch.gas, "GAS", "#39d353"]]) {
    ctx.globalAlpha = on ? 0.9 : 0.55;
    ctx.fillStyle = on ? col : "rgba(0,0,0,0.6)"; roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; roundRect(r.x, r.y, r.w, r.h, 14); ctx.stroke();
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 8, up = label === "GAS"; // an arrow pointing the way the speed goes
    ctx.fillStyle = on ? "#fff" : col; poly([[cx, cy + (up ? -14 : 14)], [cx + 14, cy + (up ? 8 : -8)], [cx - 14, cy + (up ? 8 : -8)]]);
    textAt(label, cx, r.y + r.h - 12, 13);
  }
}
function drawPauseButton() {
  ctx.fillStyle = "rgba(10,12,20,0.6)";
  ctx.beginPath(); ctx.arc(W - 24, H - 24, 14, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fillRect(W - 29, H - 31, 4, 14); ctx.fillRect(W - 21, H - 31, 4, 14);
}

// ---------- split-screen multiplayer (3D): each player's half of the screen gets its own HUD ----------
// While a half draws, the canvas is moved and clipped to it and W and H are set to its size, so the usual HUD pieces (speedo, launch gauge,
// popups...) lay themselves out inside that half without knowing about it. Side by side on a wide screen, one above the other on a tall one,
// exactly like the 3D halves (renderer.js renderSplit).
const splitScreen = () => !!window.R3D && mode === "multi" && !!racers && racers.length > 1;
const SPLIT_VIEWS = [{ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }];
function splitViews() {
  const side = W >= H, v = SPLIT_VIEWS;
  v[0].w = v[1].w = side ? W / 2 : W; v[0].h = v[1].h = side ? H : H / 2;
  v[0].x = v[0].y = 0; v[1].x = side ? W / 2 : 0; v[1].y = side ? 0 : H / 2;
  return v;
}
function drawSplitHud() {
  const FW = W, FH = H, views = splitViews(), menuUp = state === "paused" || state === "camera";
  for (let k = 0; k < 2; k++) {
    const v = views[k];
    ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip(); ctx.translate(v.x, v.y);
    W = v.w; H = v.h;
    try { drawPlayerHud(racers[k], k, menuUp); } finally { W = FW; H = FH; ctx.restore(); }
  }
  ctx.fillStyle = "rgba(6,8,14,0.85)"; if (W >= H) ctx.fillRect(W / 2 - 1.5, 0, 3, H); else ctx.fillRect(0, H / 2 - 1.5, W, 3); // the line between the halves
  drawCameraIcon();
  if (hasTouch) drawPedals(); // (touch drives Player 1)
  drawPauseButton();
}
function drawPlayerHud(r, k, menuUp) { // one player's HUD, in their own half (W x H is the half here)
  const keys = playerKeys(k);
  { // the score, with the player's tag in their team colour beside it
    ctx.save(); ctx.font = `italic 900 30px ${UI_FONT}`; ctx.textAlign = "center"; const s = String(r.score), sw = ctx.measureText(s).width, cx = W / 2 + 20;
    ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = "#fff"; ctx.fillText(s, cx, 50); ctx.restore();
    const tx = cx - sw / 2 - 46; roundRect(tx, 27, 36, 22, 11); ctx.fillStyle = r.team.p; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5; ctx.stroke();
    textAt(r.label, tx + 18, 43, 13, "center", "#fff");
  }
  if (r.shield && r.alive) drawShieldIcon(24, 64, 11, clock);
  if (r.comboT > 0 && r.combo >= 2) { // the live combo and how long it has left
    const y = 80, kk = r.comboT / COMBO_T, pulse = 1 + 0.15 * Math.max(0, 1 - (COMBO_T - r.comboT) / 10);
    textAt(`COMBO x${r.combo}`, W / 2, y, 15 * pulse, "center", r.combo >= 5 ? "#ff7a1a" : "#ffd23f");
    ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(W / 2 - 40, y + 5, 80, 4, 2); ctx.fill();
    ctx.fillStyle = r.combo >= 5 ? "#ff7a1a" : "#ffd23f"; roundRect(W / 2 - 40, y + 5, Math.max(4, 80 * kk), 4, 2); ctx.fill();
  }
  for (const p of pops) { // "CLOSE!" and the launch result, beside this player's car as their own camera sees it
    if (p.r !== r) continue;
    const s = R3D.racerScreen(r, k), side = s.x < W / 2 ? 1 : -1;
    ctx.globalAlpha = clamp((50 - p.t) / 15, 0, 1);
    textAt(p.text, s.x + side * 58, s.y - p.t * 0.8, 15 + Math.min(p.t, 6), "center", p.col || "#7fffd4");
    ctx.globalAlpha = 1;
  }
  if (r.alive && r.bypass) drawBypass(r, keys);
  if (r.alive && state === "playing" && !r.launched && (!grid.done || r.charging || r.launchLocked)) drawLaunchGauge(r, keys); // the start: hold gas + brake, let go in the green (with this player's keys)
  if (r.alive && r.nitro > 0) { // nitro burn bar
    const w = 120, x = W / 2 - w / 2, y = 10, g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, "#2a7bff"); g.addColorStop(1, "#7fe8ff");
    ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(x - 2, y - 2, w + 4, 12, 6); ctx.fill(); ctx.fillStyle = g; roundRect(x, y, Math.max(6, w * r.nitro / (r.nitroMax || NITRO_FRAMES)), 8, 4); ctx.fill();
  }
  if (r.alive && cam !== 2 && !menuUp) drawGauge(r);
  if (!menuUp && cam !== 2) drawStageBar();
  if (state === "playing" && grid.done && frame < grid.goFrame + 120) { // how to steer, for a moment after the green
    ctx.globalAlpha = clamp((grid.goFrame + 120 - frame) / 30, 0, 1);
    if (onTouch() && k === 0) text("Tap a side to steer", 108, 13); else drawPrompt([[keys.steer, "Steer"]], W / 2, 104, 15);
    ctx.globalAlpha = 1;
  }
  if (banner && state === "playing" && grid.done) drawBanner();
  if (!r.alive) textAt("CRASHED", W / 2, H * 0.42, 26, "center", "#ff5a4a");
}

// Every screen change cross-fades the 2D layer: the last frame of the old screen is kept and fades out over the new one (the new one's parts
// fade and slide in on their own). The 3D side moves its camera instead.
const uiPrev = document.createElement("canvas"); let uiPrevT = -1e9, introWas = false, hudInT = -1e9;
const BLUR_BG = new Set(["map", "options", "graphics", "songs", "controls", "credits", "stats", "difficulty", "firsttime"]), stageEl = document.getElementById("stage");
function draw() {
  { const k = state + (state === "controls" ? controlsTab : "");
    if (k !== uiSeen && uiSeen && uiSeen !== "title" && window.R3D && canvas.width > 0) { if (uiPrev.width !== canvas.width || uiPrev.height !== canvas.height) { uiPrev.width = canvas.width; uiPrev.height = canvas.height; } const g = uiPrev.getContext("2d"); g.clearRect(0, 0, uiPrev.width, uiPrev.height); g.drawImage(canvas, 0, 0); uiPrevT = performance.now(); } }
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!window.R3D) { drawWorld(); drawAtmosphere(); postFX(); } // with the 3D renderer on, the world is drawn behind this canvas
  if (window.R3D && R3D.photo.active) { glassUI.begin("photo"); drawPhotoHint(); glassUI.end(); return; } // photo mode: just a hint (or nothing at all when the HUD is hidden)

  const intro = !!(window.R3D && R3D.introHold); if (intro) introWas = true; else if (introWas) { introWas = false; hudInT = performance.now(); }
  if (intro) drawIntroCard(); // the race start's cinematic sweep: no HUD yet, just the city's name
  else if (state === "playing" || state === "paused" || state === "camera") {
    drawHud();
    const k = (performance.now() - hudInT) / 300; // (after the sweep the HUD fades in: the canvas holds only the HUD here, so rubbing part of it out is a fade)
    if (k < 1) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = `rgba(0,0,0,${(1 - smooth(k)).toFixed(3)})`; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); }
  }
  if (flashT > 0.02) { ctx.fillStyle = `rgba(255,255,255,${flashT})`; ctx.fillRect(0, 0, W, H); }

  garageUI.sync(); // the Garage / Upgrades screens are HTML over the 3D showroom: shown, hidden and refreshed here
  const moy = menuOY(); // menus and overlays are laid out for a 480-high screen: centre them on taller ones
  const uiKey = state + (state === "controls" ? controlsTab : ""); if (uiKey !== uiSeen) { if (uiSeen === "title") titleOutT = performance.now(); uiSeen = uiKey; uiT0 = performance.now(); } // a new screen: its parts fade and slide in
  glassUI.begin(uiKey);
  { const bg = !window.R3D ? "" : BLUR_BG.has(state) ? (R3D.quality.level === "low" ? "dim" : "blur") : ""; if (stageEl.dataset.bg !== bg) stageEl.dataset.bg = bg; } // the blurred, darkened 3D picture behind the map and the sub-screens
  ctx.save(); ctx.translate(0, moy); glassUI.oy = moy;

  if (state === "title" || state === "menu") { ctx.save(); ctx.translate(0, -moy); drawVersion(); ctx.restore(); }
  if (state === "title") drawTitle(moy);
  else if (performance.now() - titleOutT < 320) drawTitle(moy, smooth((performance.now() - titleOutT) / 320)); // (leaving the title: its logo grows and fades as the camera pushes in)
  if (!domMenuActive() && (state === "menu" || state === "firsttime" || state === "difficulty" || state === "tyres" || state === "garage" || state === "upgrades" || state === "options" || state === "graphics" || state === "songs" || state === "controls" || state === "credits" || state === "map" || state === "brief" || state === "stats")) {
    if (!window.R3D) menuBackdrop(moy); // fade the road behind the menu (with 3D: the studio needs no fade, and the map and the sub-screens blur and darken the 3D picture instead)
    if (state === "map") drawMap();
    else if (state === "stats") drawStats();
    else if (state === "brief") drawBrief();
    else if (state === "firsttime") drawFirstTime();
    else if (state === "tyres") { if (window.R3D) drawTyres3D(); else drawTyres(); }
    else if (state === "garage") drawGarage();
    else if (state === "upgrades") drawUpgrades();
    else if (state === "graphics") { heading("GRAPHICS", 46, 30); text(!window.R3D ? "3D is off here: showing the 2D game" : onTouch() ? "Tap a row to change it" : "", 64, 12, "center", "#ccc"); }
    else if (state === "options" && resetAsk) { // Reset progress: the two questions
      heading("RESET PROGRESS", 46, 30);
      const narrow = W < 520; // (a phone: the long lines split in two)
      if (resetAsk === 1) { if (narrow) { text("This deletes your coins, cars,", 138, 17); text("stars and stats.", 162, 17); } else text("This deletes your coins, cars, stars and stats.", 150, 17); text("Are you sure?", 194, 17); }
      else {
        text("Last check: this can't be undone.", 150, 17);
        const keep = resetAll ? ["Your settings go back to the start too."] : narrow ? ["Your graphics, volume and", "control settings are kept."] : ["Your graphics, volume and control settings are kept."];
        keep.forEach((l, i) => text(l, 182 + i * 20, 14, "center", "#ccc"));
      }
    } else if (state === "options") {
      heading("SETTINGS", 46, 30);
      text(`Now playing: ${music.playing ? music.name : "-"}`, 74, 12, "center", "#ccc");
    } else if (state === "credits") { drawCredits();
    } else if (state === "songs" || state === "controls") { // drawn after the buttons, below
    } else {
      if (state === "difficulty") { drawTitleLogo(W / 2, 92, Math.min(0.62, (W - 24) / 400)); heading("VS COMPUTER", 180, 22); }
      else if (window.R3D) drawRailHeader();
      else {
        drawTitleLogo(W / 2, 54, Math.min(0.5, (W - 24) / 400)); // the title screen's logo, smaller up top: the cards get the room
        const line = `Coins ${wallet}     `, tail = `${totalStars()} / ${ROUTE.length * 3}`;
        ctx.font = `800 13px ${UI_FONT}`;
        const w1 = ctx.measureText(line).width, w2 = ctx.measureText(tail).width, x0 = W / 2 - (w1 + 16 + w2) / 2;
        textAt(line, x0, 112, 13, "left", "#ffd23f"); drawStar(x0 + w1 + 6, 107, 6, true); textAt(tail, x0 + w1 + 16, 112, 13, "left", "#ffd23f");
      }
    }
    if (state === "menu") drawCarousel(); else drawButtons();
    if (state === "upgrades") drawUpgradeRows();
    if (state === "tyres") drawTyreRows();
    if (state === "options" && !resetAsk) drawSliders();
    if (state === "songs") { heading("SONGS", 96, 30); text(`Now playing: ${music.playing ? music.name : "-"}`, 128, 12, "center", "#ccc"); }
    if (state === "controls") drawControls();
    ctx.fillStyle = "#ccc";
    ctx.font = `600 13px ${UI_FONT}`;
    ctx.textAlign = "center";
    const musicNote = music.on && sound.on ? (music.playing ? `Now playing: ${music.name}` : onTouch() ? "Tap to start the music" : onPad() ? "Click or press a key to start the music" : "Press any key to start the music") : ""; // (browsers only let sound start after a key, click or tap: a controller button doesn't count)
    const F = footPos(), fx = F ? F.x : 0, fy = F ? F.y : 0; // (on a tall phone the menu's prompts sit at the very bottom, under its cards)
    if (state === "menu" && musicNote && !(window.R3D && RAIL.compact)) { /* (no room for this line in a squarish window) */ if (onTouch() || !music.playing) ctx.fillText(musicNote, fx, fy - 18); else drawPrompt([[[], musicNote], ["song", "Next song"]], fx, fy - 22, 14, "center", "#ccc"); }
    if (!F) { /* no room for a prompt line */ }
    else if (!onTouch()) { const fp = state === "menu" && !window.R3D ? FOOTER.carousel : state === "options" && resetAsk ? FOOTER.difficulty : FOOTER[state]; if (fp) drawPrompt(fp, fx, fy, 15, "center", "#ddd"); }
    else ctx.fillText(state === "menu" ? (hasTouch ? (window.R3D ? "Tap a card" : "Swipe or tap a card") : "Left / Right to choose, Enter to go") : state === "brief" || state === "stats" || state === "controls" || state === "credits" ? "" /* buttons sit there */ : state === "upgrades" ? (hasTouch ? "Tap an upgrade to buy its next level" : "Up / Down to choose, Enter to upgrade")  : state === "firsttime" ? "" /* its buttons say it */ : state === "garage" ? "Left / Right to browse, Enter to pick" : state === "map" ? "" /* the map has its own Back button there */ : "Tap an option", fx, F.ty);
  }

  if (state === "paused") {
    ctx.fillStyle = "rgba(6,8,16,0.55)"; ctx.fillRect(0, -moy, W, H);
    { const pw = Math.min(W - 24, 320), e = uiIn(); ctx.save(); ctx.globalAlpha = e; glass(W / 2 - pw / 2, 150 + (1 - e) * 12, pw, 294, 18); ctx.restore(); }
    heading(mode === "tutorial" ? "TEST DRIVE" : "PAUSED", 196, 36);
    if (!onTouch()) drawPrompt([...(window.R3D ? [["photo", "Photo mode"]] : []), ["retry", "Restart"], ["back", "Resume"]], W / 2, 458, 15, "center", "#ddd");
    if (sel === 1 && !onTouch()) drawPrompt([["change", "Change camera"]], W / 2, 221, 15, "center", "#ccc");
    else text(sel === 1 ? "Tap to change the camera" : CAMS[cam].desc, 225, 14, "center", "#ccc");
    drawButtons();
  }

  if (state === "camera") {
    ctx.fillStyle = "rgba(6,8,16,0.6)"; ctx.fillRect(0, -moy, W, H);
    { const pw = Math.min(W - 24, 300); glass(W / 2 - pw / 2, 100, pw, 300, 18); }
    heading("CAMERA", 144, 32);
    text(CAMS[sel] ? CAMS[sel].desc : "Back to the race", 175, 14, "center", "#ccc");
    drawButtons();
  }

  if (state === "cleared") { menuBackdrop(moy); drawConfetti(-moy); const pw = Math.min(W - 20, 420), e = uiIn(); ctx.save(); ctx.globalAlpha = e; glass(W / 2 - pw / 2, 84 + (1 - e) * 14, pw, 214, 18, "#7cfc9a"); ctx.restore(); }
  if (state === "cleared" && mode === "tutorial") drawTutorialDone();
  else if (state === "cleared" && level.daily) { // the Daily: score, today's best, streak
    const r = racers[0], s = Math.floor(levelTime);
    heading("DAILY COMPLETE", 124, Math.min(32, (W - 24) / 9.4));
    text(`${ROUTE[level.idx].venue}  -  ${dayKey()}`, 150, 14, "center", "#ddd");
    text(`Score ${r.score}`, 192, 24);
    text(`Time ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}   speed bonus +${level.bonus}`, 222, 13, "center", "#9be89b");
    text(level.newBest ? "NEW BEST TODAY!" : `Today's best ${dailyBest()}`, 252, 16, "center", "#ffd23f");
    text(`Streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"}`, 278, 13, "center", "#ffb347");
    drawButtons();
  } else if (state === "cleared") {
    const st = ROUTE[level.idx], r = racers[0], s = Math.floor(levelTime);
    heading(lastCity() ? "TOUR CHAMPION!" : "CITY COMPLETE", 124, Math.min(32, (W - 24) / 9.4));
    text(`${st.venue}, ${st.country}  -  ${st.n} / ${ROUTE.length}`, 150, 14, "center", "#ddd");
    const bonus = level.bonus ? `incl. speed bonus +${level.bonus}` : "", reward = `Finish reward +${level.reward} coins   Missions ${missionState(level.idx).filter(Boolean).length}/3`;
    ctx.font = `800 11px ${UI_FONT}`; const wrap = !!bonus && ctx.measureText(`${bonus}   ${reward}`).width > Math.min(W - 20, 420) - 28; // too wide for the card (a phone): two lines
    text(`Time ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, wrap ? 180 : 186, 20);
    text(`Score ${r.score}   Cars ${r.passed}   Coins +${r.coins}`, wrap ? 205 : 214, 15);
    if (wrap) { text(bonus, 221, 11, "center", "#9be89b"); text(reward, 234, 11, "center", "#9be89b"); }
    else text(bonus ? `${bonus}   ${reward}` : reward, 232, 11, "center", "#9be89b");
    for (let i = 0; i < 3; i++) { // the stars fill in one at a time, the newest one popping bigger
      const on = starAnim && i < starAnim.shown, pop = on && i === starAnim.shown - 1 ? 1 + 0.5 * Math.max(0, 1 - starAnim.t / 12) : 1;
      drawStar(W / 2 + (i - 1) * 64, 270, 22 * pop, on);
    }
    if (starAnim && starAnim.shown >= starAnim.got && starAnim.got > starAnim.prev && starAnim.prev > 0) text("New best!", 296, 12, "center", "#ffd23f");
    for (const p of uiFx) { ctx.globalAlpha = clamp(p.life / 30, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
    ctx.globalAlpha = 1;
    drawButtons();
  }

  if (state === "over" && !(window.R3D && performance.now() - overAt < R3D.overDelay())) { // (3D: the crash camera plays first)
    menuBackdrop(moy);
    { const pw = Math.min(W - 20, 420), e = uiIn(); ctx.save(); ctx.globalAlpha = e; glass(W / 2 - pw / 2, 88 + (1 - e) * 14, pw, (mode === "daily" ? 240 : mode === "tour" ? 244 : mode === "single" ? 272 : 256) - 88, 18, "#ff5a4a"); ctx.restore(); }
    const reached = `Reached ${ROUTE[stageIdx].country}  -  ${runKm()} km`, rc = "#ffd23f";
    heading(String(result).toUpperCase(), 136, 34);
    if (mode === "daily") {
      const r = racers[0];
      text(`Score ${r.score}`, 170, 20);
      text(level.newBest ? "NEW BEST TODAY!" : `Today's best ${dailyBest()}`, 200, 16, "center", "#ffd23f");
      text(`Streak: ${daily.streak} day${daily.streak === 1 ? "" : "s"}   -   ${Math.round(stageFrac * 100)}% of ${ROUTE[level.idx].venue}`, 228, 13, "center", "#ffb347");
    } else if (mode === "tour") {
      const r = racers[0];
      text(`Score ${r.score}   Cars ${r.passed}`, 170, 20);
      text(`Reached ${Math.round(stageFrac * 100)}% of ${ROUTE[level.idx].venue}`, 228, 16);
    } else if (mode === "single") {
      const r = racers[0];
      text(`Score ${r.score}   Best ${best}`, 170, 20);
      if (newBest) text("NEW BEST!", 198, 18, "center", "#ffd23f");
      text(`Cars ${r.passed}   Coins +${r.coins}`, 228, 16);
      text(reached, 258, 14, "center", rc);
    } else {
      text(racers.map(r => `${r.label} ${r.score}`).join("    "), 180, 22);
      text(racers.map(r => `${r.label}: ${r.passed} cars, ${r.coins} coins`).join("   "), 210, 13);
      text(reached, 240, 14, "center", rc);
    }
    drawButtons();
    if (!onTouch()) drawPrompt([["retry", "Retry"], ["back", "Menu"]], W / 2, 466, 15, "center", "#ddd");
  }

  ctx.restore(); glassUI.oy = 0;
  { const k = (performance.now() - uiPrevT) / 220; if (k < 1) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - smooth(k); ctx.drawImage(uiPrev, 0, 0); ctx.restore(); } } // the old screen fading out
  if (mode === "tutorial" && (state === "playing" || state === "paused" || state === "camera") && !intro) drawTutorialHud(racers[0]); // (here, after glassUI.begin: its pill is real glass)
  drawHints(); // the one-time tip for a screen opened for the first time (js/ui/hints.js)
  drawToasts(); // (in screen space: the stack sits under the score in a race, at the top elsewhere)
  drawFps();
  glassUI.end();
}

// ---- the race start's cinematic sweep (3D, before the lights): cinema bars, the city's name and how to skip ----
function drawIntroCard() {
  const k = R3D.introK, inK = smooth(clamp(k / 0.12, 0, 1)), outK = smooth(clamp((k - 0.74) / 0.2, 0, 1)), show = inK * (1 - outK), bar = Math.round(H * 0.085 * show);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  const st = ROUTE[stageIdx], sub = level && level.daily ? "DAILY CHALLENGE" : mode === "tour" ? (level && level.final ? "GRAND FINAL" : `WORLD TOUR  -  ROUND ${st.n}`) : mode === "vs" ? `VS COMPUTER  -  ${String(difficulty).toUpperCase()}` : mode === "multi" ? "MULTIPLAYER" : "ENDLESS";
  const tk = smooth(clamp((k - 0.06) / 0.2, 0, 1)) * (1 - outK), x = 26 - (1 - tk) * 24, y = H - Math.max(bar, 20) - 22, name = st.venue.toUpperCase();
  ctx.save(); ctx.globalAlpha = tk;
  ctx.save(); ctx.translate(x, y - 58); drawFlag(st.flag, 30, 20); ctx.restore();
  textAt(sub, x + 40, y - 42, 12, "left", UI_ACC);
  let s = 40; ctx.font = `italic 900 ${s}px ${UI_FONT}`; while (ctx.measureText(name).width > W - 60 && s > 16) { s--; ctx.font = `italic 900 ${s}px ${UI_FONT}`; }
  ctx.textAlign = "left"; ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 16; ctx.fillStyle = "#f3f6fb"; ctx.fillText(name, x, y); ctx.shadowBlur = 0;
  ctx.fillStyle = UI_ACC; ctx.fillRect(x, y + 8, Math.min(W - 60, ctx.measureText(name).width) * tk, 2);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = show * 0.85; // skip: bottom right, inside the lower bar
  if (onTouch()) textAt("Tap to skip", W - 18, H - Math.max(bar, 20) / 2 + 4, 12, "right", "#ddd"); else drawPrompt([["confirm", "Skip"]], W - 18, H - Math.max(bar, 20) / 2 - 2, 14, "right", "#ddd");
  ctx.restore();
}

// ---- photo mode and the fps counter (3D renderer only) ----
function drawPhotoHint() {
  const ph = R3D.photo;
  if (ph.hideHud) return;
  ctx.save(); ctx.textAlign = "center";
  const pw = Math.min(W - 16, 470);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(W / 2 - pw / 2, H - 84, pw, 76, 10); ctx.fill();
  const pad = onPad(), P = (...t) => t.map(x => (pad ? "p:" : "k:") + x);
  drawPrompt([[[], "PHOTO MODE"], [P(pad ? "A" : "Enter"), "Save picture"], [P(pad ? "B" : "Esc"), "Back"]], W / 2, H - 70, 15);
  drawPrompt(pad ? [[P("LS"), "Move"], [P("RS"), "Look"], [P("LT", "RT"), "Down / up"], [P("LB", "RB"), "Zoom"]] : [[P("W", "A", "S", "D"), "Move"], [P("←", "→", "↑", "↓"), "Look"], [P("Q", "E"), "Down / up"], [P("Z", "X"), "Zoom"]], W / 2, H - 46, 13, "center", "#ddd");
  drawPrompt(pad ? [[P("X"), "Filter"], [P("Y"), "Blur"], [P("DUD"), "Hide this"]] : [[P("V"), "Filter"], [P("B"), "Blur"], [P("H"), "Hide this"], [[], "Drag: look, wheel: zoom"]], W / 2, H - 24, 13, "center", "#ddd");
  if (ph.note) { textAt(ph.note, W / 2, 30, 15, "center", "#ffd23f"); }
  ctx.restore();
}
function drawFps() {
  if (!settings.fps || !window.R3D) return;
  const q = R3D.quality;
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(W - 112, 4, 108, 20);
  textAt(`${Math.round(R3D.fps)} fps  ${q.level}`, W - 58, 18, 12, "center", R3D.fps >= 55 ? "#7CFC9A" : R3D.fps >= 35 ? "#ffd23f" : "#ff7b7b"); ctx.restore();
}

// ---------- tyre choice (before every race) ----------
// a tyre seen from the side of the car: black rubber, a coloured band for the compound, a rim with spokes; `rot` turns it
function drawTyreIcon(cx, cy, r, tyre, rot) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = "#101114"; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#2a2c31"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, TAU); ctx.stroke();
  ctx.strokeStyle = tyre.band; ctx.lineWidth = Math.max(3, r * 0.07); ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.stroke(); // the compound band
  ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = `800 ${Math.max(7, r * 0.12)}px ${UI_FONT}`; ctx.textAlign = "center";
  for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(rot * 0.3 + i / 12 * TAU); ctx.fillText("VELOCITA", 0, -r * 0.9); ctx.restore(); } // sidewall lettering
  ctx.rotate(rot);
  ctx.fillStyle = "#3a3d44"; ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, TAU); ctx.fill();
  ctx.fillStyle = "#8a8f98"; for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i / 10 * TAU); ctx.fillRect(-r * 0.04, -r * 0.5, r * 0.08, r * 0.36); ctx.restore(); }
  ctx.fillStyle = "#c9ccd2"; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}
// a strip of the tread pattern: smooth for slicks, shallow grooves for intermediates, deep channels for wets
function drawTreadStrip(x, y, w, h, key) {
  ctx.fillStyle = "#17181c"; roundRect(x, y, w, h, 4); ctx.fill();
  ctx.strokeStyle = "#3d4048"; ctx.lineWidth = key === "wet" ? 3 : 2; ctx.beginPath();
  if (key === "dry") { ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 4, y + h / 2); }
  else { const step = key === "wet" ? 9 : 14; for (let i = 6; i < w - 4; i += step) { ctx.moveTo(x + i, y + h - 2); ctx.lineTo(x + i + (key === "wet" ? 6 : 3), y + 2); } if (key === "wet") { ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 4, y + h / 2); } }
  ctx.stroke();
}
function drawTyres() {
  const st = ROUTE[tyreCity], w = cityWetness(st), sel_ = TYRES[Math.min(sel, TYRES.length - 1)];
  heading("TYRES", 42, 28);
  const p = pendingStart || [], endless = p[0] === "single", line = endless ? "Weather changes as you travel" : `${st.venue.toUpperCase()}   -   ${wetLabel(w)}`;
  text(line, 66, 13, "center", w < 0.12 ? "#ffd23f" : "#7fd4ff");
  if (!endless) { // a little weather icon: sun, or cloud and rain
    ctx.save(); ctx.font = `800 13px ${UI_FONT}`; ctx.translate(W / 2 + ctx.measureText(line).width / 2 + 20, 62);
    if (w < 0.12) { ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = "#c9d3de"; ctx.beginPath(); ctx.arc(-4, 0, 6, 0, TAU); ctx.arc(4, -1, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = "#5fb4ff"; ctx.lineWidth = 2; for (let i = 0; i < (w > 0.75 ? 3 : 2); i++) { ctx.beginPath(); ctx.moveTo(-5 + i * 5, 8); ctx.lineTo(-7 + i * 5, 13); ctx.stroke(); } }
    ctx.restore();
  }
  // what the race asks of you (shown here, not over the car on the grid): the conditions, and the city's star targets
  const warn = endless ? "" : st.rain > 0.3 ? "Wet road: the right tyres matter - watch the grip bars" : st.night > 0.15 ? "Night race: distant cars show only their tail lights" : "";
  if (warn) text(warn, 86, 11, "center", "#ffb347");
  const tour = p[0] === "tour", isDaily = p[0] === "daily", idx = p[2] % ROUTE.length;
  if (tour || isDaily) {
    const pw = Math.min(W - 40, 330), px = W / 2 - pw / 2; pill(px, 96, pw, 22, "rgba(255,178,26,0.1)");
    if (isDaily) textAt(`DAILY   Today's best ${dailyBest()}   -   streak ${daily.streak}`, W / 2, 111, 11, "center", "#ffd23f");
    else {
      const tg = starTargets(idx), final = idx === ROUTE.length - 1, items = [[1, final ? "beat the CPU" : "finish"], [2, String(tg[0])], [3, String(tg[1])]];
      ctx.font = `800 11px ${UI_FONT}`; const iw = items.map(([n, l]) => n * 10 + 6 + ctx.measureText(l).width), tot = iw.reduce((a, b) => a + b, 0) + 22 * 2 + ctx.measureText("TARGETS").width + 14;
      let x = W / 2 - tot / 2; textAt("TARGETS", x, 111, 11, "left", "rgba(255,255,255,0.6)"); x += ctx.measureText("TARGETS").width + 14;
      items.forEach(([n, l], k) => { for (let s = 0; s < n; s++) drawStar(x + 5 + s * 10, 107, 4.5, true); textAt(l, x + n * 10 + 4, 111, 11, "left", (cityStars[idx] || 0) >= n ? "#9be89b" : "#fff"); x += iw[k] + 22; });
    }
  }
  drawTyreIcon(W / 2, 166, 36, sel_, clock * 0.04);
  drawTreadStrip(W / 2 - 40, 208, 80, 12, sel_.key);
  text(sel_.name + " TYRES", 238, 16, "center", sel_.band);
  const lines = []; ctx.font = `600 11px ${UI_FONT}`; { let cur = ""; for (const wd of sel_.blurb.split(" ")) { if (ctx.measureText(cur + wd).width > W - 60) { lines.push(cur); cur = ""; } cur += wd + " "; } lines.push(cur); }
  lines.slice(0, 1).forEach((s, i) => textAt(s.trim(), W / 2, 254 + i * 14, 10, "center", "#c8ced8"));
}
// With 3D the tyre choice is a glass panel beside a close-up of your car's real front wheel in the studio (on a phone: the wheel on top, the
// panel below); the wheel's band takes the colour of the compound you are on. The 2D version keeps its drawn tyre (drawTyres below).
function tyreLayout() { // wide: the panel right, the wheel left; a phone: the wheel on top; a squarish window: the same, with a slimmer panel (no blurb, no targets line)
  const wide = W >= 540, compact = !wide && H < 600, pw = Math.min(W - 24, 360), ph = compact ? 290 : 364, moy = menuOY();
  const px = wide ? W - pw - Math.max(14, W * 0.045) : (W - pw) / 2, py = wide ? Math.round((480 - ph) / 2) : Math.max(8, H - moy - ph - 10);
  if (wide) setRect(studioRects.tyre, 0.02, (px - 16) / W, 0.06, 0.95); else setRect(studioRects.tyre, 0.04, 0.96, 0.04, (py + moy - 8) / H);
  return { px, py, pw, ph, cx: px + pw / 2, rows: py + (compact ? 86 : 154), compact };
}
function drawTyres3D() {
  const st = ROUTE[tyreCity], w = cityWetness(st), sel_ = TYRES[Math.min(sel, TYRES.length - 1)], L = tyreLayout(), cx = L.cx, y = L.py, e = uiIn();
  if (L.compact) { // the slim panel: the heading, the city and its weather, the chosen tyre; the rows below
    ctx.save(); ctx.globalAlpha *= e; glass(L.px, y + (1 - e) * 12, L.pw, L.ph, 16, sel_.band); ctx.restore();
    const p = pendingStart || [], line = p[0] === "single" ? "Weather changes as you travel" : `${st.venue.toUpperCase()}   -   ${wetLabel(w)}`;
    heading("TYRES", y + 30, 22, cx); textAt(line, cx, y + 50, 12, "center", w < 0.12 ? "#ffd23f" : "#7fd4ff"); textAt(sel_.name + " TYRES", cx, y + 72, 14, "center", sel_.band);
    return;
  }
  ctx.save(); ctx.globalAlpha *= e; glass(L.px, y + (1 - e) * 12, L.pw, L.ph, 16, sel_.band); ctx.restore();
  heading("TYRES", y + 34, 26, cx);
  const p = pendingStart || [], endless = p[0] === "single", line = endless ? "Weather changes as you travel" : `${st.venue.toUpperCase()}   -   ${wetLabel(w)}`;
  textAt(line, cx, y + 56, 13, "center", w < 0.12 ? "#ffd23f" : "#7fd4ff");
  const warn = endless ? "" : st.rain > 0.3 ? "Wet road: the right tyres matter - watch the grip bars" : st.night > 0.15 ? "Night race: distant cars show only their tail lights" : "";
  if (warn) textAt(warn, cx, y + 74, 11, "center", "#ffb347");
  const tour = p[0] === "tour", isDaily = p[0] === "daily", idx = p[2] % ROUTE.length;
  if (tour || isDaily) {
    const pw = L.pw - 30, px = cx - pw / 2, ty = y + 99; pill(px, ty - 15, pw, 22, "rgba(255,178,26,0.1)");
    if (isDaily) textAt(`DAILY   Today's best ${dailyBest()}   -   streak ${daily.streak}`, cx, ty, 11, "center", "#ffd23f");
    else {
      const tg = starTargets(idx), final = idx === ROUTE.length - 1, items = [[1, final ? "beat the CPU" : "finish"], [2, String(tg[0])], [3, String(tg[1])]];
      ctx.font = `800 11px ${UI_FONT}`; const iw = items.map(([n, l]) => n * 10 + 6 + ctx.measureText(l).width), tot = iw.reduce((a, b) => a + b, 0) + 22 * 2 + ctx.measureText("TARGETS").width + 14;
      let x = cx - tot / 2; textAt("TARGETS", x, ty, 11, "left", "rgba(255,255,255,0.6)"); x += ctx.measureText("TARGETS").width + 14;
      items.forEach(([n, l], k) => { for (let s = 0; s < n; s++) drawStar(x + 5 + s * 10, ty - 4, 4.5, true); textAt(l, x + n * 10 + 4, ty, 11, "left", (cityStars[idx] || 0) >= n ? "#9be89b" : "#fff"); x += iw[k] + 22; });
    }
  }
  textAt(sel_.name + " TYRES", cx, y + 126, 16, "center", sel_.band);
  ctx.font = `600 11px ${UI_FONT}`; let s = sel_.blurb; while (ctx.measureText(s).width > L.pw - 30 && s.length > 8) s = s.slice(0, s.lastIndexOf(" ")) + "...";
  textAt(s, cx, y + 142, 10, "center", "#c8ced8");
}
function drawTyreRows() { // on top of the three buttons: the compound's colour, name, what it is for, how well it grips today and whether it is the sensible pick
  const menu = currentMenu(), st = ROUTE[tyreCity], w = cityWetness(st), best = bestTyre(w), endless = pendingStart && pendingStart[0] === "single";
  TYRES.forEach((t, i) => {
    const r = btnRect(menu, i), g = endless ? gripOf(t.key, 0) : gripOf(t.key, w);
    ctx.fillStyle = t.band; ctx.beginPath(); ctx.arc(r.x + 22, r.y + r.h / 2, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.stroke();
    textAt(t.name, r.x + 42, r.y + 21, 15, "left", "#fff"); textAt(t.sub, r.x + 42, r.y + 38, 11, "left", "#ccc");
    if (!endless) { // grip bar: how well this tyre holds in this city
      const bx = r.x + r.w - 120, by = r.y + 28;
      ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(bx, by, 90, 6, 3); ctx.fill();
      ctx.fillStyle = g > 0.85 ? "#4cd964" : g > 0.68 ? "#ffcc00" : "#ff5a4a"; roundRect(bx, by, Math.max(6, 90 * (g - 0.4) / 0.6), 6, 3); ctx.fill();
      textAt("GRIP", bx, by - 4, 9, "left", "#bbb");
      if (t.key === best) textAt("BEST", r.x + r.w - 14, r.y + 16, 11, "right", "#7CFC9A");
    } else if (t.key === "dry") textAt("USUAL", r.x + r.w - 14, r.y + 16, 11, "right", "#7CFC9A");
  });
}

// ---------- the launch gauge (on the grid) ----------
// A half dial: red / orange / green zones and a needle that sweeps up and down while you hold gas + brake together. Let go in the green.
function drawLaunchGauge(r, keys) { // at the bottom right, clear of the car and the start lights; one short hint above it (keys: split screen, this player's own)
  const R = W < 420 ? 40 : 46, cx = W - R - 16, a = n => Math.PI + n * Math.PI;
  const under = Math.min(W - 52, W / 2 + 140) + 20 > cx - R - 8; // (a narrow screen: the progress bar's finish flag and country line reach under it, so it sits above them, clear of the pause button)
  const cy = hasTouch && !keys ? pedalRects().gas.y - 14 : under ? H - 80 : H - 52;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R + 8, Math.PI, TAU); ctx.closePath(); ctx.fillStyle = "rgba(10,12,20,0.78)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.lineWidth = 9; ctx.lineCap = "butt";
  for (const [from, to, col] of [[0, 0.5, "#e03a3a"], [0.5, 0.72, "#ffa31a"], [0.72, 0.88, "#39ff6a"], [0.88, 0.95, "#ffa31a"], [0.95, 1, "#e03a3a"]]) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R - 5, a(from), a(to)); ctx.stroke(); }
  const live = r.charging, n = live ? r.needle || 0 : r.launchLocked ? r.needle || 0 : 0;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a(n)) * (R - 2), cy + Math.sin(a(n)) * (R - 2)); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, TAU); ctx.fill();
  ctx.restore();
  const lx = W - 12, ly = cy - R - 16;
  if (r.launchLocked && r.launchZone) textAt(`${r.launchZone.name}  ${Math.round(r.launchZone.v * 60)} km/h`, lx, ly, 13, "right", r.launchZone.color);
  else if (live && (keys || mode !== "multi") && !onTouch()) { // which pedal to let go: the brake, drawn as its own key / trigger, lit green
    const tok = keys ? keys.brake : onPad() ? "p:LT" : "k:" + KB.brake, gw = glyphWidth(tok, 18); // (the brake key you are actually holding)
    drawGlyph(tok, lx - gw, ly - 4, 18, "#39ff6a"); textAt("LET GO", lx - gw - 7, ly + 1, 14, "right", "#39ff6a");
  }
  else if (live) textAt(onTouch() ? "LET GO" : "LET GO IN THE GREEN", lx, ly, 12, "right", "#39ff6a");
  else if (keys && !onTouch()) drawPrompt([[keys.both, "HOLD"]], lx, ly - 4, 16, "right"); // (split screen: this player's gas + brake)
  else if (mode === "multi") textAt("P1 ↑+↓   P2 W+S", lx, ly, 12, "right", "#fff");
  else if (onPad()) drawPrompt([[["p:RT", "+", "p:LT"], "HOLD"]], lx, ly - 4, 16, "right");
  else if (onTouch()) textAt("HOLD BOTH", lx, ly, 12, "right", "#fff"); // (short: on a phone a long line would run into your car)
  else drawPrompt([["launch", "HOLD"]], lx, ly - 4, 16, "right"); // (the keys you drive with: arrows, W + S, or a mix)
}

// ---------- the bypass prompt ----------
function drawBypass(r, keys) {
  const b = r.bypass; if (!b) return;
  const pulse = 0.6 + 0.4 * Math.sin(clock * 0.3);
  if (b.state === "armed") {
    const left = b.side < 0, x = left ? 26 : W - 26, y = 190;
    ctx.globalAlpha = 0.5 + 0.5 * pulse; ctx.fillStyle = "#3ad0ff";
    poly(left ? [[x + 14, y - 22], [x - 14, y], [x + 14, y + 22]] : [[x - 14, y - 22], [x + 14, y], [x - 14, y + 22]]);
    ctx.globalAlpha = 1;
    if (mode !== "tutorial") textAt(`BYPASS: steer ${left ? "LEFT" : "RIGHT"}`, W / 2, 128, 15, "center", "#7fffd4"); // (the test drive's instruction says it)
    if (!onTouch() && mode !== "tutorial") { const g = keys ? (left ? keys.left : keys.right) : onPad() ? "p:DLR" : KB.side === "ad" ? (left ? "k:A" : "k:D") : left ? "k:←" : "k:→"; drawGlyph(g, W / 2 + 92, 123, 18); }
    ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(W / 2 - 40, 134, 80, 4, 2); ctx.fill(); ctx.fillStyle = "#7fffd4"; roundRect(W / 2 - 40, 134, Math.max(4, 80 * b.timeLeft / 600), 4, 2); ctx.fill();
  } else {
    textAt("BYPASS", W / 2, 128, 15, "center", "#7fffd4");
    ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(W / 2 - 40, 134, 80, 4, 2); ctx.fill(); ctx.fillStyle = "#3ad0ff"; roundRect(W / 2 - 40, 134, Math.max(4, 80 * (1 - b.d / b.L)), 4, 2); ctx.fill();
  }
}

// a little chip showing your tyres and how well they grip right now (only when it matters)
function drawTyreChip(r) {
  const t = TYRES.find(x => x.key === (r.tyre || "dry")) || TYRES[0], g = gripNow(r), x = 12, y = hasTouch ? pedalRects().brake.y - 12 : H - 70; // (above the brake pad on a touch screen)
  if (g > 0.96 && wetnessNow() < 0.12) return; // dry tyres on a dry road: nothing to say
  pill(x, y - 13, 86, 20);
  ctx.fillStyle = t.band; ctx.beginPath(); ctx.arc(x + 11, y - 3, 5.5, 0, TAU); ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.stroke();
  textAt(`GRIP ${Math.round(g * 100)}%`, x + 22, y + 1, 11, "left", g > 0.85 ? "#7CFC9A" : g > 0.68 ? "#ffd23f" : "#ff7b7b");
}

// ---------- the test drive (js/sim/tutorial.js) ----------
// One instruction at the top in a glass pill (with the key / button / touch words for what you are holding), a tick and a word when a lesson is
// done, progress dots at the bottom where the city bar usually is, a Skip button top right, and arrows beside the car in the lane lesson.
let tutMsgSeen = null, tutMsgT = 0;
function tutSkipRect() { // (input.js uses the same box for taps)
  ctx.font = `800 12px ${UI_FONT}`;
  const g = onTouch() ? 0 : glyphWidth(glyphsFor("back")[0], 16) + 6, w = Math.round(ctx.measureText("SKIP").width + 26 + g);
  return { x: W - w - 10, y: settings.fps && window.R3D ? 30 : 10, w, h: 26 }; // (under the fps counter when it is on)
}
function drawTutorialHud(r) {
  const k = tutSkipRect();
  pill(k.x, k.y, k.w, k.h);
  let sx = k.x + 13; if (!onTouch()) sx += drawGlyph(glyphsFor("back")[0], sx - 2, k.y + k.h / 2, 16) + 4;
  textAt("SKIP", sx, k.y + 17.5, 12, "left", "#f3f6fb");
  if (state !== "playing") return; // (paused: the menu is on top)
  const L = LESSONS[tut.i], done = tut.doneT > 0, again = !done && tut.againT > 0, final = tut.i === LESSONS.length - 1;
  const onGrid = tut.i === LAUNCH_LESSON && !grid.done && cam !== 0; // (behind the car on the grid, the start lights hang where the pill usually is)
  const y = onGrid ? 132 : 66 + (r.comboT > 0 && r.combo >= 2 ? 30 : 0); // (under the score, and under the combo when it shows)
  if (final && !done) { // the final test: just its name for a moment
    const a = clamp(Math.min(tut.t / 12, (150 - tut.t) / 25), 0, 1);
    if (a > 0) { ctx.save(); ctx.globalAlpha = a; heading("FINAL TEST", y + 26, 24); ctx.restore(); }
  } else if (done) { // the tick: a green disc and a word, popping in
    const e = smooth((42 - tut.doneT) / 8), word = DONE_WORDS[tut.word], s = 0.8 + 0.2 * e + 0.12 * Math.max(0, 1 - (42 - tut.doneT) / 10);
    ctx.font = `italic 900 17px ${UI_FONT}`; const w = ctx.measureText(word).width + 62;
    ctx.save(); ctx.globalAlpha = Math.min(1, tut.doneT / 8);
    glass(W / 2 - w * s / 2, y + 16 - 16 * s, w * s, 32 * s, 16 * s, "#7cfc9a"); // (the glass layer is placed in screen units: no canvas transform for it)
    ctx.translate(W / 2, y + 16); ctx.scale(s, s);
    ctx.fillStyle = "#3dd66a"; ctx.beginPath(); ctx.arc(-w / 2 + 18, 0, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(-w / 2 + 13, 0.5); ctx.lineTo(-w / 2 + 17, 4.5); ctx.lineTo(-w / 2 + 24, -4); ctx.stroke();
    ctx.font = `italic 900 17px ${UI_FONT}`; ctx.textAlign = "left"; ctx.fillStyle = "#f3f6fb"; ctx.fillText(word, -w / 2 + 36, 6);
    ctx.restore();
  } else {
    const msg = again ? tut.againMsg : L.say(r);
    if (msg) {
      if (msg !== tutMsgSeen) { tutMsgSeen = msg; tutMsgT = performance.now(); }
      const a = smooth((performance.now() - tutMsgT) / 220), act = onTouch() ? null : msg[0], words = onTouch() && msg[2] ? msg[2] : msg[1];
      const pips = L.count && tut.phase === 0 && !again ? L.count : 0, parts = msg.parts || (msg.parts = [[msg[0], msg[1]]]); // (made once per message)
      let s = 18, tw;
      const measure = () => { if (act) return promptWidth(parts, s); ctx.font = `800 ${Math.round(s * 0.78)}px ${UI_FONT}`; return ctx.measureText(words).width; };
      while ((tw = measure() + pips * 12) > W - 52 && s > 12) s--;
      const w = tw + 30, x = W / 2 - w / 2, py = y - (1 - a) * 8; // (slides down into place)
      ctx.save(); ctx.globalAlpha = a;
      glass(x, py, w, 32, 16, again ? "#ff9f40" : UI_ACC);
      if (act) drawPrompt(parts, x + 15, py + 16, s, "left", again ? "#ffc58a" : "#f3f6fb");
      else textAt(words, x + 15, py + 16 + s * 0.28, Math.round(s * 0.78), "left", again ? "#ffc58a" : "#f3f6fb");
      for (let i = 0; i < pips; i++) { ctx.fillStyle = i < tut.n ? "#7cfc9a" : "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(x + w - 15 - (pips - 1 - i) * 12 - 4, py + 16, 4, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  if (L.name === "Lanes" && !done) { // arrows either side of the car, pointing at the lanes you can move into
    const p = racerScreen(r), pulse = 0.5 + 0.5 * Math.sin(clock / 7), off = 62 + 6 * pulse;
    ctx.save(); ctx.globalAlpha = 0.65 + 0.35 * pulse; ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
    for (const d of [-1, 1]) {
      if (r.lane + d < 0 || r.lane + d >= LANES) continue;
      for (let c = 0; c < 2; c++) { const cx = p.x + d * (off + c * 14); ctx.beginPath(); ctx.moveTo(cx - d * 6, p.y - 13); ctx.lineTo(cx + d * 7, p.y); ctx.lineTo(cx - d * 6, p.y + 13); ctx.lineTo(cx - d * 1, p.y); ctx.closePath(); ctx.stroke(); ctx.fill(); }
    }
    ctx.restore();
  }
  if (hasTouch && !done) { // on a touch screen, the pedal the lesson wants glows
    const pr = pedalRects(), launch = tut.i === LAUNCH_LESSON && tut.phase === 1 && !grid.done, pulse = 0.5 + 0.5 * Math.sin(clock / 6);
    const want = tut.i === 0 ? (tut.phase === 0 ? [pr.gas] : [pr.brake]) : launch ? [pr.gas, pr.brake] : null;
    if (want) for (const q of want) { ctx.save(); ctx.strokeStyle = `rgba(255,210,63,${0.45 + 0.55 * pulse})`; ctx.lineWidth = 3; roundRect(q.x - 5, q.y - 5, q.w + 10, q.h + 10, 18); ctx.stroke(); ctx.restore(); }
  }
}
function drawTutorialDots(y, right) { // one dot per lesson: done (filled), now (a pulsing ring), still to come (faint)
  const n = LESSONS.length, gap = 14, wide = (n - 1) * gap;
  const mid = right ? W - 14 - wide / 2 : (Math.max(150, W / 2 - 140) + Math.min(W - 52, W / 2 + 140)) / 2; // (bottom: between the speedo and the pause button)
  if (!right) textAt("TEST DRIVE", mid, y - 11, 9, "center", "rgba(255,255,255,0.75)");
  pill(mid - wide / 2 - 10, y - 7, wide + 20, 14, "rgba(10,12,20,0.6)");
  for (let i = 0; i < n; i++) {
    const x = mid - wide / 2 + i * gap;
    ctx.beginPath();
    if (i < tut.i || (i === tut.i && tut.doneT > 0)) { ctx.fillStyle = UI_ACC; ctx.arc(x, y, 4, 0, TAU); ctx.fill(); }
    else if (i === tut.i) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.arc(x, y, 3.6 + Math.sin(clock / 8) * 0.8, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.arc(x, y, 2.6, 0, TAU); ctx.fill(); }
  }
}
function drawTutorialDone() { // YOU'RE READY! (over the finish, on the glass panel the cleared screen puts up)
  const res = tut.result || { earned: 0, first: false };
  heading("YOU'RE READY!", 128, Math.min(32, (W - 24) / 9.4));
  text("Test drive complete", 154, 14, "center", "#ddd");
  if (res.first) {
    ctx.font = `italic 900 30px ${UI_FONT}`; const line = `+${res.earned}`, lw = ctx.measureText(line).width;
    drawCoin(W / 2 - lw / 2 - 6, 192, 13, Math.cos(clock / 8)); ctx.textAlign = "left"; ctx.fillStyle = "#ffd23f"; ctx.fillText(line, W / 2 - lw / 2 + 14, 203); ctx.textAlign = "center";
    text(`coins, with a ${res.bonus} coin welcome bonus`, 232, 13, "center", "#9be89b");
    text("Spend them in the Garage", 256, 12, "center", "#c8ced8");
  } else {
    text(`Score ${res.score || 0}`, 200, 20);
    text("Practice run: coins are paid the first time only", 236, 12, "center", "#c8ced8");
  }
  drawButtons();
}
