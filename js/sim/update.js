function update() {
  if (hitStop > 0) { hitStop--; return; } // freeze frame after a crash
  if (state !== "playing" && GLOW_PREWARM.length) glowSprite(GLOW_PREWARM.pop()); // build glow sprites while nobody is racing (no first-race hitch)
  flashT *= 0.85;
  for (const c of confetti) { c.x += c.vx + Math.sin(c.ph += 0.07) * 0.6; c.y += c.vy; c.rot += c.vr; }
  confetti = confetti.filter(c => c.y < H + 20);
  pollPads();
  if (state === "paused" || state === "camera") { sound.engineTick(false, 0); sound.envTick(false, 0, 0, 0); return; } // (paused: the race sound fades out, and comes back on Resume)
  if (state === "playing") updatePlaying();
  else if (state === "over") { scroll = view3D() === 0 ? 1 : 0; flowTraffic(); for (const e of enemies) e.y += scroll - e.cur; stepRacers(); } // the wreck slides on; the rest of the traffic keeps driving
  else if (state === "cleared") { // coast to a stop past the line
    speed *= 0.97; scroll = speed; dist += speed;
    flowTraffic(); for (const e of enemies) e.y += speed - e.cur;
    for (const r of racers) if (r.alive) r.v = speed;
    stepRacers();
  }
  else updateDemo();
  updateFx();
  if (starAnim && state === "cleared" && starAnim.shown < starAnim.got && ++starAnim.t >= 28) { // pop the next star
    starAnim.t = 0; const i = starAnim.shown++, sx = W / 2 + (i - 1) * 64;
    sound.tone(660 * (1 + i * 0.26), 1320 * (1 + i * 0.26), 0.3, "triangle", 0.09); sound.burst(0.25, 0.25, "highpass", 5000, 9000);
    for (let k = 0; k < 26; k++) { const a = rnd(0, TAU), s = rnd(1, 4.5); uiFx.push({ x: sx, y: 270, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(25, 45), color: pick(["#ffd23f", "#fff3b0", "#ffffff", "#ffb347"]) }); }
  }
  for (const p of uiFx) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.97; p.life--; }
  uiFx = uiFx.filter(p => p.life > 0);
  const r0 = racers[0]; // the engine follows your speed (your revs on the grid), the nitro and how hard you press the gas
  if (engineLab) engineLab.tick(); // (the engine lab sets the speed itself: js/ui/enginelab.js)
  else sound.engineTick(state === "playing", effV(r0), r0.nitro > 0, grid && !grid.done ? (r0.rev || 0) : throttleFor(r0));
  sound.envTick(state === "playing", Math.max(rainI, wet), 0, 0);
  music.tick(!engineLab && (state === "title" || state === "menu" || state === "firsttime" || state === "difficulty" || state === "tyres" || state === "garage" || state === "upgrades" || state === "options" || state === "graphics" || state === "songs" || state === "controls" || state === "credits" || state === "map" || state === "brief" || state === "stats"));
}
