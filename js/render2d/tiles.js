// ---------- tile textures (pre-rendered once per resolution) ----------

let RES = 1, roadPat = null, grassPat = null;

function makeTile(draw) {
  try {
    const k = Math.ceil(RES), c = document.createElement("canvas");
    c.width = c.height = 128 * k;
    const g = c.getContext("2d");
    g.scale(k, k);
    draw(g);
    const pat = ctx.createPattern(c, "repeat");
    if (pat && pat.setTransform && typeof DOMMatrix !== "undefined") pat.setTransform(new DOMMatrix().scale(1 / k));
    return pat;
  } catch (e) { return null; }
}

function initTiles() {
  roadPat = makeTile(g => {
    for (let i = 0; i < 1100; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.12)";
      g.fillRect(Math.random() * 128, Math.random() * 128, rnd(0.8, 2.2), rnd(0.8, 2.2));
    }
  });
  grassPat = makeTile(g => {
    g.lineWidth = 1;
    for (let i = 0; i < 700; i++) {
      const x = Math.random() * 128, y = Math.random() * 128;
      g.strokeStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y - rnd(3, 7)); g.stroke();
    }
  });
}

// Everything standing on the old road moves when the road moves (the window was resized or went full screen)
function rescaleWorld(oldL, oldR) {
  const dL = ROAD_L - oldL, ratio = oldL > 0 ? ROAD_L / oldL : 1;
  for (const o of [...(enemies || []), ...(pickups || []), ...(racers || []), ...(roadItems || [])]) o.x += dL;
  for (const o of scenery || []) o.x = o.x < oldL + (oldR - oldL) / 2 ? o.x * ratio : ROAD_R + (o.x - oldR) * ratio;
}

// The screen got taller or shorter: the world stays pinned to the bottom edge, so the new space at the top is more road ahead
function reheightWorld(dH) {
  for (const o of [...(enemies || []), ...(pickups || []), ...(racers || []), ...(roadItems || []), ...(scenery || []), ...(particles || []), ...(wx || [])]) {
    o.y += dH; if (o.ty !== undefined) o.ty += dH; if (o.trueY !== undefined) o.trueY += dH;
  }
  if (startObj) startObj.y += dH;
  if (finishObj) finishObj.y += dH;
  camRefY += dH;
}

function fit() { // fill the whole window; render at the real on-screen pixel size so everything stays sharp
  if (typeof window === "undefined") return;
  const aspect = window.innerWidth / window.innerHeight;
  let newW = Math.round(480 * aspect), newH = 480;
  if (newW < 340) { newW = 340; newH = clamp(Math.round(340 / aspect), 480, 820); } // portrait phone: keep the road's width, grow taller
  newW = Math.min(newW, 1100);
  if (newW !== W) { const oL = ROAD_L, oR = ROAD_R; W = newW; ROAD_L = (W - ROAD_W) / 2; ROAD_R = ROAD_L + ROAD_W; rescaleWorld(oL, oR); }
  if (newH !== H) { const dH = newH - H; H = newH; reheightWorld(dH); }
  let cssH = window.innerHeight, cssW = cssH * W / H;
  if (cssW > window.innerWidth) { cssW = window.innerWidth; cssH = cssW * H / W; }
  canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
  const res = clamp((window.devicePixelRatio || 1) * cssH / H, 1, settings.lowfx ? 1.25 : 2); // 2x is sharp on any phone (3x was ~2.3x the pixels for no visible gain); reduced effects: fewer still
  if (Math.abs(res - RES) < 0.01 && roadPat && canvas.width === Math.round(W * res) && canvas.height === Math.round(H * res)) return;
  RES = res;
  canvas.width = Math.round(W * RES);
  canvas.height = Math.round(H * RES);
  initTiles();
}

function toggleFullscreen() {
  const d = document, el = d.documentElement, refused = () => say("Fullscreen isn't allowed here"); // e.g. an iframe without allowfullscreen
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else if ((d.fullscreenEnabled || d.webkitFullscreenEnabled) && (el.requestFullscreen || el.webkitRequestFullscreen)) {
      const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(refused);
    } else refused();
  } catch (e) { refused(); }
}

