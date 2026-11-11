// ---------- effects ----------

// glowing (additively blended) particles: sparks, fire, nitro exhaust
function glowBurst(x, y, colors, n, power, life = 30, size = [2, 4]) {
  for (let i = 0; i < n && particles.length < maxParticles() + 80; i++) {
    const a = rnd(0, TAU), s = rnd(0.5, power);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(life * 0.5, life), max: life, size: rnd(size[0], size[1]), color: pick(colors), add: true });
  }
}
function burst(x, y, colors, n, power) {
  for (let i = 0; i < n && particles.length < maxParticles() + 80; i++) {
    const a = rnd(0, TAU), s = rnd(0.5, power);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(20, 45), max: 45, size: rnd(2, 5), color: pick(colors) });
  }
}

// Rain and night change how a city plays, not just how it looks (London, Brussels, Sao Paulo / Singapore, Las Vegas, Doha)
const rainPlay = () => clamp((((stA && stA.rain) || 0) - 0.2) / 0.2, 0, 1);
const nightPlay = () => clamp((((stA && stA.night) || 0) - 0.13) / 0.07, 0, 1);
const nightHide = e => e.kind === "works" ? 0 : nightPlay() * clamp((camRefY - e.y - (lenOf(e) - CAR_H) / 2 - 200) / 120, 0, 1); // far cars: only their tail lights show
let sprayFog = 0, sprayCar = null; // the mist thrown up by the car right ahead of you in the wet

function sprayColor() {
  if (wet > 0.25) return "rgba(205,220,240,0.35)";
  if (stA && stA.desert) return "rgba(225,205,150,0.28)";
  return null;
}

function updateFx() {
  clock++;
  scrollPos += scroll;
  updateStage();
  if (stageIdx !== lastStage) { lastStage = stageIdx; if (state === "playing") startBanner(stageIdx); }
  sceneAcc += scroll;
  if (sceneAcc > 55) { sceneAcc -= 55; spawnScenery(-AHEAD); }
  for (const s of scenery) s.y += scroll;
  scenery = scenery.filter(s => s.y < H + 34);
  updateWeather();
  for (const p of particles) { p.x += p.vx; p.y += p.vy + scroll * 0.8; p.vx *= 0.96; p.vy *= 0.96; p.life--; }
  particles = particles.filter(p => p.life > 0);
  if (racers[0].alive) camOff += ((racers[0].x - W / 2) - camOff) * 0.12; // after a crash the 3D camera stays exactly where it was
  if (racers[0].alive) camRefY = racers[0].y; // the 3D camera stays put once you've crashed
  if (startObj) { startObj.y += scroll; if (startObj.y > camRefY + 500) startObj = null; }
  if (finishObj) finishObj.y += scroll;
  if (halfObj) { halfObj.y += scroll; if (halfObj.y > camRefY + 500) halfObj = null; }
  if (bypassTrack) { bypassTrack.y0 += scroll; if (bypassTrack.y0 - bypassTrack.L > camRefY + 400 && !(racers[0] && racers[0].bypassing)) bypassTrack = null; }
  nitroFx += ((racers[0].alive && racers[0].nitro > 0 ? 1 : 0) - nitroFx) * 0.12;
  if (nitroFx > 0.3) shake = Math.max(shake, 1.6 * nitroFx);
  if (banner && (!grid || grid.done) && ++banner.t > 200) banner = null; // (the city card waits for the green light)
  for (let i = 0; i < Math.min(3, toasts.length); i++) toasts[i].t++; // only the three on screen age; the rest wait their turn
  if (toasts.length && toasts[0].t >= toasts[0].life) toasts = toasts.filter(t => t.t < t.life);
  menuCar += (sel - menuCar) * 0.16;
  if (statsDirty && clock % 600 === 0) saveStats();
  kickFx *= 0.93;
  lightning.t *= 0.86;
  for (const s of splashes) s.life--; // rain splashes on the road (3D views)
  splashes = splashes.filter(s => s.life > 0);
  if (view3D() && rainI > 0.25 && !settings.lowfx) {
    const hor = camFor(view3D()).hor;
    for (let i = 0; i < 3 * rainI; i++) { const y = rnd(hor + 30, H), depth = (y - hor) / (H - hor); splashes.push({ x: W / 2 + rnd(-1, 1) * (40 + depth * W * 0.6), y, r: 2 + depth * 9, life: 12 }); }
  }
  if (stA && stA.rain > 0.3 && !settings.lowfx && Math.random() < 1 / 520) strike(); // the odd thunderstorm
  for (const p of pops) p.t++;
  pops = pops.filter(p => p.t < 50);
  shake *= 0.88;
}

