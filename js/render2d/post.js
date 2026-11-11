// ---------- post-processing: speed blur, bloom, colour grade, lens flare, vignette (all off with Reduce effects) ----------
const FX_FILTER = (() => { try { return typeof document.createElement("canvas").getContext("2d").filter === "string"; } catch (e) { return false; } })();
const fxBuf = {};
function fxCanvas(name, w, h) { // reusable offscreen buffers
  let c = fxBuf[name];
  if (!c) c = fxBuf[name] = document.createElement("canvas");
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}
let vigCache = null, vigKey = "";
function vignette() { // a dark edge, drawn from a cached image
  const key = `${W}x${H}`;
  if (vigKey !== key) {
    vigKey = key; vigCache = document.createElement("canvas"); vigCache.width = Math.ceil(W / 2); vigCache.height = Math.ceil(H / 2);
    const g = vigCache.getContext("2d"), cw = vigCache.width, ch = vigCache.height, gr = g.createRadialGradient(cw / 2, ch * 0.52, Math.min(cw, ch) * 0.35, cw / 2, ch * 0.52, Math.hypot(cw, ch) * 0.62);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.7, "rgba(0,0,0,0.18)"); gr.addColorStop(1, "rgba(0,0,0,0.62)");
    g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
  }
  return vigCache;
}
// where the sun sits on screen in the 3D views (matches drawSky), or null when it isn't out
function sunScreen() {
  const v = view3D();
  if (!v || pal.sun <= 0.05 || rainI > 0.5 || pal.dark > 0.08) return null;
  const C = camFor(v);
  return { x: W * 0.72 - camOff * 0.12, y: C.hor - 72, a: pal.sun * (1 - rainI * 1.6) };
}
function postFX() {
  if (settings.lowfx) return;
  const cw = canvas.width, ch = canvas.height, v3 = view3D(), p0 = racers && racers[0], racing = state === "playing" && p0;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 1. speed blur: faint enlarged copies of the frame streak everything out from the vanishing point
  const spd = v3 && racing ? clamp((p0.v - 3.8) / 3, 0, 1) * 0.55 + nitroFx * 0.75 + kickFx * 0.4 : 0;
  if (spd > 0.03) {
    const m = fxCanvas("mid", cw >> 1, ch >> 1), mg = m.getContext("2d");
    mg.globalCompositeOperation = "copy"; mg.drawImage(canvas, 0, 0, m.width, m.height);
    const cx = cw / 2, cy = camFor(v3).hor * RES;
    for (let k = 1; k <= 2; k++) {
      const s = 1 + 0.03 * k * (0.5 + spd);
      ctx.globalAlpha = Math.min(0.2, 0.18 * spd) / k;
      ctx.drawImage(m, cx - cx * s, cy - cy * s, cw * s, ch * s);
    }
    ctx.globalAlpha = 1;
  }
  // 2. bloom: keep only the brightest parts, blur them at quarter size and add them back on top
  if (FX_FILTER) {
    const night = clamp(pal.dark * 4, 0, 1), sw = Math.ceil(W / 4), sh = Math.ceil(H / 4), b = fxCanvas("bloom", sw, sh), bg = b.getContext("2d");
    // by day only true highlights pass (sky and grass would wash everything out); at night every light glows
    bg.globalCompositeOperation = "copy"; bg.filter = `brightness(${0.6 + night * 0.14}) contrast(${8 - night * 3}) saturate(1.5) blur(${2 + night * 1.2}px)`;
    bg.drawImage(canvas, 0, 0, sw, sh);
    if (night > 0.1) { // the wider, softer night halo is added inside the small buffer, so the screen only takes one bloom layer
      bg.globalCompositeOperation = "lighter"; bg.globalAlpha = 0.9 * night; bg.filter = "blur(6px)"; bg.drawImage(b, 0, 0); bg.globalAlpha = 1; bg.globalCompositeOperation = "source-over";
    }
    bg.filter = "none";
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.16 + night * 0.75 + nitroFx * 0.08;
    ctx.drawImage(b, 0, 0, cw, ch);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
  // 3. colour grade: warm in the sun, cool and violet at night, steely in the rain
  const night = clamp(pal.dark * 4, 0, 1), wetk = clamp(rainI * 1.4, 0, 1);
  const grade = mix(mix([255, 168, 92], [70, 90, 255], night), [90, 130, 170], wetk * (1 - night));
  ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = rgb(grade, 0.34 + night * 0.12); ctx.fillRect(0, 0, W, H); ctx.restore();
  // 4. lens flare when you look towards the sun
  const sun = sunScreen();
  if (sun && sun.a > 0.05) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.55, dx = cx - sun.x, dy = cy - sun.y;
    ctx.globalAlpha = 0.5 * sun.a; ctx.fillStyle = "rgba(255,240,200,0.5)"; ctx.fillRect(sun.x - 160, sun.y - 1.2, 320, 2.4); // anamorphic streak
    for (const [k, r, col, a] of [[0.35, 16, "255,200,120", 0.25], [0.6, 8, "120,220,255", 0.3], [0.9, 26, "255,120,200", 0.14], [1.25, 12, "160,255,180", 0.22], [1.6, 38, "255,220,140", 0.1]]) {
      ctx.globalAlpha = sun.a; glow(sun.x + dx * k, sun.y + dy * k, r, col, a);
    }
    ctx.restore();
  }
  // 5. vignette
  ctx.drawImage(vignette(), 0, 0, W, H);
}

