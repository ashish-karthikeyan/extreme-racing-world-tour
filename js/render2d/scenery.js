// ---------- drawing: scenery ----------

function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function ell(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
function poly(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); }
const sandColor = () => rgb(mix(pal.grass, [255, 240, 205], 0.3));

// overhead versions: plain simple shapes
function drawScenery(s) { // attractions and props shrink down into little roadside sprites
  const sway = Math.sin(clock / 50 + s.ph) * (0.6 + wind * 1.2);
  if (s.kind === "lm" || s.kind === "prop") {
    ctx.save(); ctx.translate(s.x, s.y); const k = s.kind === "lm" ? 0.26 : 0.5; ctx.scale(k, k);
    (s.kind === "lm" ? LMS : PROPS)[s.key](s);
    ctx.restore();
    return;
  }
  switch (s.kind) {
    case "tree":
      ctx.fillStyle = "rgba(0,0,0,0.22)"; circle(s.x + s.r * 0.35, s.y + s.r * 0.4, s.r);
      if (s.style === "pine") {
        ctx.fillStyle = rgb(PINE); circle(s.x, s.y, s.r);
        ctx.strokeStyle = rgb(mix(PINE, [0, 0, 0], 0.4)); ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(a) * s.r * 0.95, s.y + Math.sin(a) * s.r * 0.95); }
        ctx.stroke();
      } else if (s.style === "palm") {
        ctx.strokeStyle = "#2f8a3a"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
        for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + sway * 0.05; ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(a) * s.r * 1.2, s.y + Math.sin(a) * s.r * 1.2); }
        ctx.stroke(); ctx.lineCap = "butt"; ctx.fillStyle = "#6b4a2a"; circle(s.x, s.y, 2.5);
      } else if (s.style === "cypress") {
        ctx.fillStyle = rgb(mix(PINE, [0, 0, 0], 0.25)); circle(s.x, s.y, s.r * 0.55); ctx.fillStyle = "rgba(255,255,255,0.12)"; circle(s.x - 1, s.y - 1, s.r * 0.25);
      } else if (s.style === "cactus") {
        ctx.fillStyle = "#3f8a4a"; circle(s.x, s.y, s.r * 0.5); ctx.fillRect(s.x - s.r * 0.9, s.y - 2, s.r * 1.8, 4); ctx.fillStyle = "#56a560"; circle(s.x - 1, s.y - 1, s.r * 0.22);
      } else {
        ctx.fillStyle = rgb(mix(pal.leaf, s.style === "gum" ? [140, 170, 150] : [0, 0, 0], s.style === "gum" ? 0.4 : 0.15)); circle(s.x + sway * 0.3, s.y, s.r);
        ctx.fillStyle = rgb(mix(pal.leaf, [255, 255, 255], 0.25), 0.85); circle(s.x - s.r * 0.25 + sway * 0.3, s.y - s.r * 0.28, s.r * 0.55);
        if (s.style === "fruit" && s.fruit) { ctx.fillStyle = s.fruit; for (let i = 0; i < 5; i++) circle(s.x + Math.cos(i * 2.4) * s.r * 0.6, s.y + Math.sin(i * 2.4) * s.r * 0.6, 1.5); }
      }
      break;
    case "bush":
      ctx.fillStyle = "rgba(0,0,0,0.2)"; circle(s.x + 2, s.y + 3, s.r);
      ctx.fillStyle = rgb(mix(pal.leaf, [0, 0, 0], 0.1)); circle(s.x, s.y, s.r);
      ctx.fillStyle = "rgba(255,255,255,0.14)"; circle(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.45);
      break;
    case "rock":
      ctx.fillStyle = "rgba(0,0,0,0.22)"; circle(s.x + 2, s.y + 3, s.r);
      ctx.fillStyle = "#86898e"; circle(s.x, s.y, s.r);
      ctx.fillStyle = "rgba(255,255,255,0.22)"; circle(s.x - 1, s.y - 1, s.r * 0.5);
      break;
    case "dune":
      ctx.fillStyle = sandColor(); circle(s.x, s.y, s.r * 0.8);
      ctx.fillStyle = "rgba(120,90,40,0.18)"; circle(s.x + s.r * 0.25, s.y + s.r * 0.2, s.r * 0.5);
      break;
    case "flag":
      ctx.fillStyle = "#cfd2d8"; circle(s.x, s.y, 2);
      ctx.save(); ctx.translate(s.x + 1, s.y - 5); drawFlag(s.flag, 15, 10); ctx.restore();
      break;
    case "lamp":
      ctx.fillStyle = "#2b2d33"; circle(s.x, s.y, 2.6);
      if (pal.dark > 0.05) { // a warm pool of light at night
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 46);
        g.addColorStop(0, `rgba(255,214,130,${Math.min(0.6, pal.dark * 3)})`); g.addColorStop(1, "rgba(255,214,130,0)");
        ctx.fillStyle = g; ctx.fillRect(s.x - 46, s.y - 46, 92, 92); ctx.restore();
      }
      break;
  }
}

function drawRoadItem(it) { // puddles
  ctx.fillStyle = `rgba(140,170,210,${clamp(wet * 1.5, 0, 0.45)})`;
  ctx.beginPath(); ctx.ellipse(it.x, it.y, it.rx, it.ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${clamp(wet, 0, 0.35)})`; ctx.lineWidth = 1;
  const rip = (clock / 9 + it.x) % 1;
  ctx.beginPath(); ctx.ellipse(it.x, it.y, it.rx * rip, it.ry * rip, 0, 0, TAU); ctx.stroke();
}

