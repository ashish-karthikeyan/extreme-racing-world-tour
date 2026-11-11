// Fixed 60 Hz simulation so the game runs the same speed on any monitor.
const STEP = 1000 / 60;
let lastTime = 0, acc = 0;
const devTicks = new URLSearchParams(location.search).get("ticks"); // ?ticks=N (testing): run exactly N sim ticks once loading is done, then freeze
let ticksLeft = devTicks === null ? Infinity : +devTicks;
// If a device can't keep up with the full effects (frames averaging over ~22 ms for 3 s of racing), turn on Reduce effects once
let perfAvg = 16.7, perfT = 0, perfDone = store.get("perfGuard", false);
function perfGuard(dt) {
  if (perfDone || settings.lowfx || state !== "playing" || dt > 250 || document.hidden) { perfT = 0; return; }
  perfAvg += (dt - perfAvg) * 0.05;
  if (perfAvg > 22) { if ((perfT += dt) > 3000) { settings.lowfx = true; saveSettings(); fit(); perfDone = true; store.set("perfGuard", true); say("Reduce effects turned on for smoother play"); } }
  else perfT = 0;
}

// ---- the 3D renderer (js/render3d) is optional: if WebGL is missing or anything in it throws, we drop back to the 2D renderer ----
function disable3D(why) {
  console.warn("3D renderer off, using the 2D one:", why, why && why.stack);
  window.R3D = null;
  const gl = document.getElementById("gl"); if (gl) gl.style.display = "none";
  canvas.classList.remove("over3d");
}
let r3dErrors = 0; const r3dFail = e => { console.error("3D error:", e); if (++r3dErrors > 8) disable3D(e); }; // (a one-off hiccup must not throw you into the 2D version: only a renderer that keeps failing is switched off)
function tick3D() { try { R3D.tick(); } catch (e) { r3dFail(e); } }
const FILM = new URLSearchParams(location.search).get("film"); let filmT = null; const filmShots = []; // testing: film=0.2,0.6,1.2 captures the 3D view that many seconds after the crash and shows the shots side by side
function filmFrame() {
  if (!FILM || !(state === "title" || (state === "over" && !racers[0].alive))) return; const want = FILM.split(",").map(Number); if (filmT === null) filmT = clock;
  const t = (clock - filmT) / 60; if (filmShots.length < want.length && t >= want[filmShots.length]) { const c = document.createElement("canvas"); c.width = 520; c.height = 300; c.getContext("2d").drawImage(R3D.renderer.domElement, 0, 0, 520, 300); filmShots.push(c); }
  if (filmShots.length === want.length && !document.getElementById("film")) { const d = document.createElement("div"); d.id = "film"; d.style.cssText = "position:fixed;inset:0;background:#111;z-index:99;display:flex;flex-wrap:wrap;gap:4px"; filmShots.forEach((c, i) => { c.style.width = "calc(33% - 4px)"; d.appendChild(c); }); document.body.appendChild(d); }
}
let infoN = 0; const SHOW_STATS = new URLSearchParams(location.search).has("info"); // testing: ?info logs draw calls and triangles after 40 frames
const PERF = +new URLSearchParams(location.search).get("perf") || 0; let perfN = 0, perfSum = 0, perfLast = 0, perfMax = 0; const perfAll = new Float32Array(PERF), perfCost = new Float32Array(PERF); // testing: ?perf=N logs the average frame time (and GPU work) over N rendered frames of racing
const PERF_ALL = new URLSearchParams(location.search).has("perfall"); // (testing: &perfall measures any screen, not just racing)
function perfLog() { if (!PERF || (state !== "playing" && !PERF_ALL)) return; const now = performance.now(); if (perfLast && perfN < PERF) { perfSum += now - perfLast; perfMax = Math.max(perfMax, now - perfLast); perfAll[perfN] = now - perfLast; perfCost[perfN] = R3D.cost || 0; if (now - perfLast > 25 && new URLSearchParams(location.search).has("spikes")) { const i = R3D.renderer.info; console.info("SPIKE " + (now - perfLast).toFixed(1) + " ms at frame " + perfN + " clock " + clock + " programs " + (i.programs ? i.programs.length : "?") + " geo " + i.memory.geometries + " tex " + i.memory.textures + (R3D.reelShot ? " shot " + R3D.reelShot : "")); } if (++perfN === PERF) { const i = R3D.renderer.info, med = perfAll.slice().sort()[PERF >> 1]; console.info("PERF frames=" + perfN + " avgMs=" + (perfSum / perfN).toFixed(2) + " medianMs=" + med.toFixed(2) + " costMs=" + perfCost.slice().sort()[PERF >> 1].toFixed(2) + " fps=" + (1000 * perfN / perfSum).toFixed(1) + " worstMs=" + perfMax.toFixed(1) + " calls=" + i.render.calls + " tris=" + i.render.triangles + " level=" + R3D.quality.level + " px=" + R3D.renderer.domElement.width + "x" + R3D.renderer.domElement.height + " state=" + state); } } perfLast = now; }
function render3D(alpha) { try { R3D.render(alpha); perfLog(); filmFrame(); if (r3dErrors > 0 && Math.random() < 0.01) r3dErrors--; if (SHOW_STATS && ++infoN === 40) { const i = R3D.renderer.info; console.info("INFO calls=" + i.render.calls + " triangles=" + i.render.triangles + " geometries=" + i.memory.geometries + " textures=" + i.memory.textures); } } catch (e) { r3dFail(e); } }

let errorsRecently = 0;
function loop(now) {
  requestAnimationFrame(loop); // (scheduled first: whatever goes wrong below, the game keeps running instead of freezing)
  if (window.R3D_PENDING || window.gFreeze) { lastTime = now; return; } // still loading (or frozen for a test screenshot) the 3D assets: hold the game
  crazy.setPlaying(state === "playing" && !document.hidden); // tells CrazyGames when a race or the test drive starts and stops (pause, menus, crash, finish); nothing elsewhere
  try {
    if (!window.R3D) perfGuard(now - lastTime); // (the 2D renderer's "reduce effects" watchdog; the 3D renderer has its own Auto quality)
    acc += Math.min(100, now - lastTime);
    lastTime = now;
    if (window.R3D && R3D.introHold) { acc = 0; try { pollPads(); } catch (e) {} } // the race start's cinematic sweep: the race waits (a button skips it)
    else while (acc >= STEP) { if (ticksLeft > 0) { update(); ticksLeft--; if (window.R3D) tick3D(); } acc -= STEP; }
    draw();
    if (window.R3D) render3D(acc / STEP); // acc / STEP = how far we are between two sim ticks (smooth motion on fast screens)
    if (errorsRecently > 0 && Math.random() < 0.002) errorsRecently--;
  } catch (e) { // a bug must never freeze the game: log it and drop back to a clean main menu (once or twice; if it keeps happening, stop trying)
    console.error("Game error:", e); acc = 0; lastTime = now;
    if (++errorsRecently <= 3) { try { toMenu(); } catch (e2) { console.error(e2); } }
  }
}

songDB.all().then(rows => { for (const r of rows || []) music.addBlob(r.name, r.blob); }).catch(() => {});
fit();
grabFocus();
initDemo(); // the title scene: Las Vegas at night, with your own car leading
if (FRESH) { console.info("?fresh: a brand-new test player on a throwaway save; your real save is not touched"); say("Test player: nothing is saved"); }
{ // testing: demotest=N runs the title's autopilot for N ticks and reports whether your car ever touched traffic (at the cars' real 3D sizes)
  const n = +new URLSearchParams(location.search).get("demotest");
  if (n) {
    const r = racers[0]; let touch = 0, minGap = 1e9, moves = 0, lane = r.lane, vSum = 0, slow = 0, loops = 0, lastD = dist;
    for (let i = 0; i < n; i++) {
      update(); vSum += r.v; if (new URLSearchParams(location.search).has("dtrace") && r.v < 4.4 && i % 20 === 0 && i < 9000) console.info("DT " + i + " v" + Math.round(r.v * 60) + " L" + r.lane + (r.boxed ? " BOXED" : "") + " x" + Math.round(r.x - laneX(r.lane)) + " | " + enemies.filter(e => r.y - e.y > -150 && r.y - e.y < 700).sort((a, b) => b.y - a.y).map(e => e.lane + "@" + Math.round(r.y - e.y) + "(" + Math.round(e.cur * 60) + ")").join(" ")); if (r.v < DEMO_AI.cruise - 0.5) slow++; if (r.lane !== lane) { moves++; lane = r.lane; } if (dist < lastD) loops++; lastD = dist;
      for (const e of enemies) {
        if (Math.abs(e.x - r.x) >= (CAR_WIDE + TRAFFIC_WIDE) / 2) continue; // (not overlapping across the road)
        const gap = Math.abs(r.y - e.y) - reachOf(e); minGap = Math.min(minGap, gap); if (gap < 0) touch++;
      }
    }
    console.info("DEMOTEST " + JSON.stringify({ ticks: n, state, touches: touch, closestGap: Math.round(minGap), laneChanges: moves, avgKmh: Math.round(vSum / n * 60), slowTicks: slow, loops, enemies: enemies.length }));
  }
}
requestAnimationFrame(loop);

// This planner and manual renderer are reached only by the ?dev=record URL above.
// It predicts the real traffic positions before choosing a lane; the normal game loop and controls are unchanged.
function recordPilot(r) {
  if (r.bypassing) return;
  pickups = pickups.filter(k => k.type !== "shield"); // never collect / use an invincibility pickup in a take
  const activePickups = pickups.filter(k => (k.type === "nitro" || k.type === "curve") && r.y - k.y > 0 && r.y - k.y < 1100).sort((a, b) => r.y - a.y - (r.y - b.y));
  const preference = activePickups[0] && activePickups[0].lane;
  if (r.bypass && r.bypass.state === "armed") {
    const b = r.bypass, v = Math.max(r.v, speed, 2.2), accel = r.nitro > 0 ? 0.1 : 0.06;
    let clear = true;
    for (const e of enemies) if (e.lane === b.lane) for (let t = 0; t <= 40; t++) {
      const d = r.y - e.y + (e.cur - v) * t - accel * t * (t + 1) / 2;
      const off = BYPASS_OFF * smooth(clamp(v * t / BYPASS_RAMP, 0, 1));
      if (Math.abs(e.x - (laneX(b.lane) + b.side * off)) < (CAR_WIDE + TRAFFIC_WIDE) / 2 + 3 && Math.abs(d) < reachOf(e) + 4) { clear = false; break; }
    }
    if (clear && r.lane === b.lane) { held.add("ArrowUp"); held.delete("ArrowDown"); steer(r, b.side); r._recordPlan = { action: "bypass", clear: true }; return; }
  }
  // Reuse the game's real traffic planner, including its prediction of boost speed, traffic queues and lane-change hitboxes.
  const p = { think: 1, cooldown: 0, greedy: true, plan: true };
  const look = Math.max(500, Math.max(r.v, speed) * 100);
  aiPlanReal(r, p, look, true, r.bypass ? 1 : preference);
  if (r.aiBrake > frame) { held.delete("ArrowUp"); held.add("ArrowDown"); }
  else { held.add("ArrowUp"); held.delete("ArrowDown"); }
  r._recordPlan = { action: "traffic-plan", lane: r.lane, preference, braking: (r.aiBrake || 0) > frame, nitro: r.nitro || 0 };
}

// Developer shortcut for testing and screenshots (not linked from anywhere in the game):
//   index.html?dev=tour,3,1   starts World Tour city 4 (counting from 0: 3) with camera 1 (0 Overhead, 1 Chase, 2 Cockpit), gas held down
//   &ff=600  skips the first 10 seconds   &god  ignores crashes   &crash  crashes the car   &finish  crosses the finish line   &ticks=N  freeze after N ticks
//   dev=garage / dev=menu / dev=pause  open that screen.  Modes: tour, single, vs, garage, menu, pause
//   ?fresh  play as a brand-new player on a throwaway save (your real save is never touched; reload for another new player)
//   ?crazygames  asks CrazyGames' SDK even off CrazyGames (js/crazygames.js); on localhost it answers "local", so the game still ignores it
//   dev=engine,300  the engine lab: the race sound at 300 km/h with a slider (0 to 1000) and buttons, no graphics
//   dev=tutorial,5  the test drive from lesson 5 (1 Drive, 2 Lanes, 3 Dodge, 4 Near miss, 5 Coins, 6 Nitro, 7 Shield, 8 Bypass, 9 Launch, 10 Final test)
//   (no dev) the title:  &shot=NAME plays only that reel shot (flyby, sidepod, front, wheel, track, nose, rear, helmet, crane), &tt=S holds it there
//   &demotest=N runs the title's autopilot N ticks and reports any touch (&dtrace logs its slow moments)   &bypasstest=N   &parade=S (menu)   &spikes (with ?perf)
{
  const q = new URLSearchParams(location.search), dev = q.get("dev");
  if (q.has("keys")) { // keys=MS:Code,...: press those keys that many ms after the game is ready (testing a flow through the menus)
    const go = () => { if (window.R3D_PENDING) { setTimeout(go, 100); return; } for (const kv of q.get("keys").split(",")) { const [ms, code] = kv.split(":"); setTimeout(() => { document.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true })); setTimeout(() => document.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true })), 60); console.info("KEY " + code + " -> state " + state + (window.R3D ? " hold " + R3D.introHold + " introK " + R3D.introK.toFixed(2) : "") + (grid ? " gridT " + grid.t : "")); }, +ms); } };
    go();
  }
  if (q.has("input")) { const v = q.get("input"); if (v === "ps" || v === "nin" || v === "xbox") { padKind = v; useDevice("pad"); } else useDevice(v); toasts.length = 0; } // input=kb|xbox|ps|nin|touch: show that device's prompts (testing)
  if (dev) {
    const [m, c, k] = dev.split(",");
    if (m === "record") { // record,N: dev-only gameplay capture harness; never active in a normal game URL
      const seed = +(q.get("seed") || 6102026), rng = mulberry32(seed);
      Math.random = rng; grand = rng; // repeatable traffic so a failed take can be audited and repeated
      cam = +k || 1; window.__recordingRun = true;
      startGameNow("single", "medium", c === undefined ? 19 : +c);
      const r = racers[0]; r.shield = false; r.ghost = 0; r.launched = true; r.launchLocked = true; r.launchGoal = 4.7; r.rolling = true; r.v = 4.7; r.cruise = r.v;
      // Put two real pickups on clear stretches so the take can show nitro and the bypass mechanics.
      const startLane = [0, 2].sort((a, b) => {
        const clearance = lane => enemies.reduce((n, e) => e.lane === lane ? Math.min(n, Math.abs(e.y - r.y)) : n, Infinity);
        return clearance(b) - clearance(a);
      })[0];
      r.lane = r.fromLane = startLane; r.x = laneX(startLane); r.vx = 0;
      pickups = pickups.filter(p => p.type !== "nitro" && p.type !== "curve" && p.type !== "shield");
      pickups.push({ type: "nitro", lane: startLane, x: laneX(startLane), y: r.y - 850 });
      pickups.push({ type: "curve", lane: startLane, x: laneX(startLane), y: r.y - 1600 });
      grid.done = true; grid.goFrame = frame; startObj = null; banner = null; toasts.length = 0; pops.length = 0; held.add("ArrowUp"); window.gFreeze = true;
      document.body.style.cursor = "none";
      window.__record = {
        seed, frames: 0, overlapFrames: 0, crashFrames: 0, protectedFrames: 0, minClearance: Infinity,
        nearMisses: 0, nitrosPicked: 0, bypasses: 0, prevBypassing: false, errors: [], trace: [], events: [],
        step() {
          const p = racers[0]; if (!p || !p.alive || state !== "playing") { this.crashFrames = 1; this.firstCrash ||= { frame: this.frames, state, car: p && [p.x, p.y], lane: p && p.lane, hit: p && p.hitBy && { model: p.hitBy.model, lane: p.hitBy.lane, x: p.hitBy.x, y: p.hitBy.y } }; }
          const beforeNitro = p && (p.nitrosFired || 0), wasBypassing = !!(p && p.bypassing);
          if (p && p.alive && state === "playing") recordPilot(p);
          update(); this.frames++;
          if (p) {
            const bypassState = p.bypassing ? "running" : p.bypass ? p.bypass.state : "none";
            if (bypassState !== p._recordBypassState) { this.events.push({ frame: this.frames, bypassState, lane: p.lane, carY: p.y }); p._recordBypassState = bypassState; }
            if (this.frames % 15 === 0) this.trace.push({ frame: this.frames, lane: p.lane, x: Math.round(p.x), v: +p.v.toFixed(2), nitro: p.nitro || 0, plan: p._recordPlan || null, bypass: p.bypassing, bypassState: p.bypass && p.bypass.state, pickups: pickups.filter(k => k.type === "curve" || k.type === "nitro").map(k => [k.type, k.lane, Math.round(k.y - p.y)]), traffic: enemies.filter(e => Math.abs(r.y - e.y) < 500).map(e => [e.lane, Math.round(r.y - e.y), Math.round(e.cur * 60)]) });
            if (p.ghost > 0 || p.shield) this.protectedFrames++;
            this.nearMisses = p.nm || 0;
            if ((p.nitrosFired || 0) > beforeNitro && !wasBypassing && !p.bypassing) this.nitrosPicked++;
            if (!wasBypassing && p.bypassing) this.bypasses++;
            if (!p.alive || state === "over") { this.crashFrames = 1; this.firstCrash ||= { frame: this.frames, state, car: [p.x, p.y], lane: p.lane, hit: p.hitBy && { model: p.hitBy.model, lane: p.hitBy.lane, x: p.hitBy.x, y: p.hitBy.y } }; }
            for (const e of enemies) {
              const dx = Math.abs(e.x - p.x), dy = Math.abs(e.y - p.y), halfW = (CAR_WIDE + TRAFFIC_WIDE) / 2, halfL = reachOf(e);
              if (dx < halfW && dy < halfL) {
                this.overlapFrames++;
                this.minClearance = Math.min(this.minClearance, Math.hypot(halfW - dx, halfL - dy));
                this.firstOverlap ||= { frame: this.frames, model: e.model, lane: e.lane, dx, dy, halfW, halfL, playerLane: p.lane, player: [p.x, p.y], traffic: [e.x, e.y], bypassing: p.bypassing };
              }
            }
          }
          if (R3D) { tick3D(); draw(); render3D(0); }
          return { frame: this.frames, state, overlapFrames: this.overlapFrames, crashFrames: this.crashFrames, protectedFrames: this.protectedFrames, nearMisses: this.nearMisses, nitrosPicked: this.nitrosPicked, bypasses: this.bypasses, lane: p && p.lane, speed: p && p.v, car: p && [p.x, p.y], traffic: enemies.length, pickups: pickups.length };
        },
        report() { const crashFrame = this.firstOverlap && this.firstOverlap.frame; return { seed: this.seed, frames: this.frames, overlapFrames: this.overlapFrames, crashFrames: this.crashFrames, protectedFrames: this.protectedFrames, nearMisses: this.nearMisses, nitrosPicked: this.nitrosPicked, bypasses: this.bypasses, minClearance: this.minClearance, firstOverlap: this.firstOverlap || null, firstCrash: this.firstCrash || null, events: this.events, trace: this.trace.filter(t => crashFrame ? Math.abs(t.frame - crashFrame) <= 90 : t.frame > this.frames - 120), errors: this.errors }; }
      };
    }
    else if (m === "garage") { // garage,N: the Garage on team N.  &coins=N sets your coins, &own=all unlocks every car, &clean hides the 2D layer, &page=upgrades opens the Upgrades page, &buy=MS buys the car shown after MS ms
      garageIdx = +c || 0; if (q.has("coins")) wallet = +q.get("coins"); if (q.get("own") === "all") owned = TEAMS.map((_, i) => i);
      openMenu(q.get("page") === "upgrades" ? "upgrades" : "garage"); if (q.has("clean")) { document.getElementById("game").style.visibility = "hidden"; window.noGarageUI = true; }
      if (q.has("buy")) setTimeout(() => garageAction(), +q.get("buy"));
      if (q.has("gdebug")) setInterval(() => console.info("GDEBUG " + JSON.stringify(R3D.showroom && R3D.showroom.debug())), 2000);
    }
    else if (m === "tutorial") { startTutorial(+c || 1); if (k !== undefined) cam = +k; } // tutorial,N(,camera): the test drive from lesson N (1 Drive ... 10 the final test)
    else if (m === "menu" || m === "options" || m === "graphics" || m === "stats" || m === "upgrades" || m === "credits" || m === "controls" || m === "songs" || m === "difficulty" || m === "firsttime") openMenu(m);
    else if (m === "engine") startEngineLab(c === undefined ? 300 : +c); // engine,KMH: the engine lab, the race sound at that speed (js/ui/enginelab.js)
    else if (m === "tyres") startGame("tour", null, +c || 0); // the tyre choice before a World Tour race in city c
    else if (m === "map") openMap();
    else if (m === "brief") { mapIdx = +c || 0; jumpTo(mapIdx, 0.3); openMenu("brief"); }
    else {
      cam = +k || 0; startGameNow(m === "pause" || m === "camerapick" ? "tour" : m || "single", "medium", +c || 0); held.add("ArrowUp");
      if (q.has("god")) racers[0].ghost = 1e9; // god: crashes are ignored
      if (q.has("clean")) document.getElementById("game").style.visibility = "hidden"; // clean: hide the 2D HUD for screenshots
      if (q.has("team")) racers[0].team = TEAMS[+q.get("team") % TEAMS.length]; // team=N: drive that team's car
      if (q.has("bypass")) { const r0 = racers[0]; grid.done = true; grid.goFrame = 0; r0.launchGoal = 3.33; r0.lane = 0; r0.x = laneX(0); enemies = []; pickups = []; pickups.push({ type: "curve", lane: 0, x: laneX(0), y: r0.y - 300 }); enemies.push({ kind: "car", model: "van", lane: 0, x: laneX(0), y: r0.y - 950, len: CAR_H, v: 1.4, cur: 1.4, col: "#f2f2f0", passed: {}, miss: {} }); window.devSteer = +q.get("bypass") || 120; } // bypass=N: a bypass pop-up and a slow van in the left lane; steers left at tick N
      if (q.has("charge")) { held.add("ArrowDown"); window.devRel = +q.get("release") || 0; window.devRelGreen = q.has("onGreen") ? +q.get("onGreen") : null; } // charge: hold gas and brake together; release=N lets go of the brake at tick N
      for (let i = +q.get("ff") || 0; i > 0; i--) { if ((window.devRel && frame >= window.devRel) || (window.devRelGreen != null && grid.done && frame >= grid.goFrame + window.devRelGreen)) held.delete("ArrowDown"); if (window.devSteer && frame === window.devSteer) steer(racers[0], -1); update(); } // ff=600 fast-forwards 600 sim ticks (10 s)
      if (q.has("half") && level) dist = level.d0 + level.len / 2 - (+q.get("half") || 700); // half=N: jump to N units before the halfway point
      if (q.has("nitro")) startNitro(racers[0]); // nitro: fire a nitro canister straight away
      if (q.has("report")) { // testing: run the simulation flat out for a while and print what the traffic did
        const n = +q.get("report") || 3000, st = { ticks: 0, pickInCar: 0, carOverlap: 0, wall: 0, minGapAhead: 1e9, spd: {}, crashes: 0 }; let maxWall = 0;
        if (!q.has("charge")) { racers[0].launchGoal = 3.33; racers[0].launched = true; grid.done = true; grid.goFrame = frame; }
        const trace = [];
        for (let i = 0; i < n; i++) {
          if (!racers[0].alive) { st.crashes++; break; }
          if ((window.devRel && frame >= window.devRel) || (window.devRelGreen != null && grid.done && frame >= grid.goFrame + window.devRelGreen)) held.delete("ArrowDown"); update(); st.ticks++; if (i % 20 === 0 && i < 520) trace.push(`${frame}:${Math.round(racers[0].v * 60)}${grid.done ? "" : "(grid)"}`);
          for (const k of pickups) for (const e of enemies) if (e.lane === k.lane && Math.abs(k.y - e.y) < lenOf(e) / 2 + 6 && k.y < racers[0].y - 100) st.pickInCar++;
          for (const a of enemies) for (const b of enemies) if (a !== b && a.lane === b.lane && a.y < b.y && b.y - a.y < (lenOf(a) + lenOf(b)) / 2 - 2) st.carOverlap++;
          for (const e of enemies) { const s = st.spd[e.model] || (st.spd[e.model] = { n: 0, sum: 0, min: 1e9, max: 0 }); s.n++; s.sum += e.cur; s.min = Math.min(s.min, e.cur); s.max = Math.max(s.max, e.cur); }
          const win = enemies.filter(e => e.y > -700 && e.y < 200); // a wall: all three lanes occupied within 300 units of each other
          for (const e of win) { const near = new Set(win.filter(o => Math.abs(o.y - e.y) < 220).map(o => o.lane)); if (near.size >= 3) { st.wall++; break; } }
        }
        const sp = Object.fromEntries(Object.entries(st.spd).map(([k, s]) => [k, `avg ${(s.sum / s.n * 60).toFixed(0)} min ${(s.min * 60).toFixed(0)} max ${(s.max * 60).toFixed(0)} km/h`]));
        console.info("REPORT " + JSON.stringify({ trace: trace.join(" "), zone: racers[0].launchZone && racers[0].launchZone.name, ticks: st.ticks, crashed: st.crashes, speedKmh: Math.round(racers[0].v * 60), pickupsInsideCars: st.pickInCar, carsOverlapping: st.carOverlap, wallTicks: st.wall, speeds: sp, enemiesNow: enemies.length, pickupsNow: pickups.length }));
      }
      if (q.has("vstest")) { // testing: vstest=N races N rounds of Vs CPU (&diff=easy|medium|hard|impossible) with a simple bot in your car (it can't crash) and reports how the CPU drove
        const rounds = +q.get("vstest") || 10, T = +q.get("len") || 3600, diff = q.get("diff") || "medium";
        const st = { diff, rounds: 0, ticks: 0, cpuCrash: 0, crashNearBypass: 0, bypasses: 0, cpuMoves: 0, copied: 0, sameSpot: 0, exitLead: [], exitDv: [], leadAfter2s: [] };
        for (let n = 0; n < rounds; n++) {
          startGameNow("vs", diff, n % 22); const you = racers[0], cpu = racers[1]; you.ghost = 1e9;
          let youAt = -99, youDir = 0, bypassAt = -9999, cpuLane = cpu.lane, exitAt = -1;
          for (let i = 0; i < T && cpu.alive && state === "playing"; i++) {
            const clear = (l, d) => l >= 0 && l < LANES && !enemies.some(e => e.lane === l && you.y - e.y > -60 && you.y - e.y < d);
            if (you.bypass && you.bypass.state === "armed" && bypassTarget(you, you.bypass)) { steer(you, you.bypass.side); if (you.bypassing) { st.bypasses++; bypassAt = frame; } }
            else if (!you.bypassing && grid.done && frame - you.lastMove > 20) {
              const k = pickups.find(p => p.type === "curve" && Math.abs(p.lane - you.lane) === 1 && you.y - p.y > 0 && you.y - p.y < 500);
              let dir = 0;
              if (!clear(you.lane, 260)) { const opts = [-1, 1].filter(d => clear(you.lane + d, 200)); if (opts.length) dir = opts[Math.floor(Math.random() * opts.length)]; }
              else if (k && clear(k.lane, 300)) dir = k.lane - you.lane;
              else if (q.has("spam")) { const nk = pickups.find(p => p.type === "nitro" && Math.abs(p.lane - you.lane) === 1 && you.y - p.y > 0 && you.y - p.y < 400); if (nk && clear(nk.lane, 300)) dir = nk.lane - you.lane; } // spam: the bot also goes after every nitro
              if (dir) { steer(you, dir); youAt = frame; youDir = dir; }
            }
            if (q.has("cap")) { if (you.v * 60 > +q.get("cap")) held.delete("ArrowUp"); else held.add("ArrowUp"); } // cap=300: the bot cruises at about that speed instead of flooring it
            const was = you.bypassing, cn = cpu.nitro || 0, yn = you.nitro || 0; update(); st.ticks++;
            if ((cpu.nitro || 0) > cn) st.cpuNitros = (st.cpuNitros || 0) + 1; if ((you.nitro || 0) > yn) st.youNitros = (st.youNitros || 0) + 1;
            if (grid.done) { const h = (vsHeat() > 0.5 ? "hot" : "cold") + (you.nitro > 0 || you.bypassing ? "Boost" : ""), g = (cpu.trueY === undefined ? cpu.y : cpu.trueY) - you.y; st[h] = st[h] || { n: 0, gap: 0, behind900: 0 }; st[h].n++; st[h].gap += g; if (g > 900) st[h].behind900++; st.maxHeat = Math.max(st.maxHeat || 0, you.heat || 0); }
            if (q.has("trace")) { (window.vsHist = window.vsHist || []).push(`L${cpu.lane} v${Math.round(cpu.v * 60)}${frame < (cpu.followUntil || 0) || cpu.aiBrake > frame ? " BRK" : ""} you${you.lane}@${Math.round(cpu.y - you.y)} | ` + enemies.filter(e => cpu.y - e.y > -80 && cpu.y - e.y < 500).map(e => `${e.lane}@${Math.round(cpu.y - e.y)}(${Math.round(e.cur * 60)})`).join(" ")); if (window.vsHist.length > 90) window.vsHist.shift(); if (!cpu.alive) console.info("TRACE " + [80, 60, 40, 20, 5].map(k => window.vsHist[window.vsHist.length - k]).join(" || ")); }
            if (was && !you.bypassing) { st.exitLead.push(Math.round(cpu.y - you.y)); st.exitDv.push(Math.round((you.v - cpu.v) * 60)); exitAt = frame; }
            if (exitAt > 0 && frame === exitAt + 120) st.leadAfter2s.push(Math.round((cpu.trueY === undefined ? cpu.y : cpu.trueY) - you.y));
            if (cpu.lane !== cpuLane) { st.cpuMoves++; if (frame - youAt < 25 && Math.sign(cpu.lane - cpuLane) === youDir) st.copied++; cpuLane = cpu.lane; }
            if (grid.done && cpu.lane === you.lane && Math.abs((cpu.trueY === undefined ? cpu.y : cpu.trueY) - you.y) < 130) st.sameSpot++;
            if (grid.done && Math.abs(cpu.x - you.x) < CAR_W && Math.abs((cpu.trueY === undefined ? cpu.y : cpu.trueY) - you.y) < 90) st.overlap = (st.overlap || 0) + 1; // drawn on top of each other
          }
          st.rounds++; if (!cpu.alive) { st.cpuCrash++; if (frame - bypassAt < 360) st.crashNearBypass++; const e = cpu.hitBy; (st.why = st.why || []).push(`t${frame - grid.goFrame} v${Math.round(cpu.v * 60)}/${Math.round(you.v * 60)} gap${Math.round(cpu.trueY - you.y)} ${e.kind}${e.miss[1] ? " MISSED" : ""} lane${cpu.fromLane}>${cpu.lane} moved${frame - cpu.lastMove} dx${Math.round(e.x - cpu.x)} dy${Math.round(e.y - cpu.y)}`); }
        }
        for (const h of ["hot", "cold", "hotBoost", "coldBoost"]) if (st[h]) { st[h].gap = Math.round(st[h].gap / st[h].n); st[h].behind900 = (st[h].behind900 / st[h].n).toFixed(2); }
        console.info("VSTEST " + JSON.stringify(st));
      }
      if (q.has("bypasstest")) { // testing: bypasstest=N plays N bypass pop-ups in Endless (half of them during a nitro), presses the arrow at a random moment while each is showing, and counts presses that did nothing
        const st = { rounds: 0, pressed: 0, took: 0, nothing: 0, noCarAhead: 0, nitro: 0 };
        for (let n = 0; n < (+q.get("bypasstest") || 100); n++) {
          startGameNow("single", "medium", n % 22); const r = racers[0]; r.ghost = 1e9; grid.done = true; grid.goFrame = frame; r.launchGoal = 0; r.v = rnd(3, 5);
          for (let i = 0; i < 200; i++) update(); // (some traffic on the road first)
          const side = Math.random() < 0.5 ? -1 : 1, lane = side < 0 ? 0 : LANES - 1; setLane(r, lane); r.x = laneX(lane);
          if (Math.random() < 0.5) { startNitro(r); st.nitro++; }
          pickups.push({ type: "curve", lane, x: laneX(lane), y: r.y - 200 });
          let i = 0; while (!r.bypass && i++ < 300) update(); if (!r.bypass) continue;
          st.rounds++; const wait = Math.floor(Math.random() * 400); for (let j = 0; j < wait && r.bypass && r.bypass.state === "armed"; j++) update();
          if (!r.bypass || r.bypass.state !== "armed") continue; // (it timed out: nothing was showing to press)
          st.pressed++; if (!bypassTarget(r, r.bypass)) st.noCarAhead++;
          steer(r, side); if (r.bypassing) st.took++; else st.nothing++;
        }
        console.info("BYPASSTEST " + JSON.stringify(st));
      }
      if (q.has("crash")) { racers[0].ghost = 0; const r0 = racers[0]; enemies.push({ kind: "car", model: "sedan", lane: r0.lane, x: r0.x, y: r0.y - 100, len: CAR_H, v: 1.67, cur: 1.67, col: "#2f5fa8", passed: {}, miss: {} }); } // crash: a car appears just ahead, so the real crash physics plays out
      if (q.has("finish") && level) finishLevel();
      if (q.has("next")) { // testing: after finishing / crashing, choose the first menu button (Next city / Retry) and run the sim to see whether anything throws
        try { for (let i = 0; i < 5; i++) update(); const menu = currentMenu(); console.info("NEXT state=" + state); menu.items[0].go(); console.info("NEXT after click state=" + state); for (let i = 0; i < 200; i++) update(); console.info("NEXT survived 200 ticks, state=" + state); if (q.has("pick")) { TYRES_MENU[+q.get("pick")].go(); for (let i = 0; i < 700; i++) update(); console.info("NEXT raced: state=" + state + " mode=" + mode + " city=" + (level && level.idx) + " tyre=" + racers[0].tyre + " v=" + Math.round(racers[0].v * 60)); } }
        catch (e) { console.info("NEXT THREW " + e.message + " | " + (e.stack || "").split("\n")[1]); }
      }
      if (q.has("retry")) { // testing: after the crash screen has been up a moment, press Retry and pick the first tyre, like a player would
        let done = false, picked = false; const iv = setInterval(() => { if (!done && state === "over" && performance.now() - overAt > 2500) { done = true; try { currentMenu().items[0].go(); console.info("RETRY pressed, state=" + state); } catch (e) { console.info("RETRY THREW " + e.message); } } else if (done && !picked && state === "tyres" && !screenFx.busy) { picked = true; try { TYRES_MENU[0].go(); } catch (e) { console.info("RETRY THREW " + e.message); } } else if (picked && state === "playing" && frame > 200) { /* (the tyre screen comes in behind a sweep, so the tyre is chosen once it's showing) */ console.info("RETRY running 3D=" + !!window.R3D + " frame=" + frame); clearInterval(iv); } }, 200);
      }
      if (m === "pause") state = "paused";
      if (m === "camerapick") openMenu("camera", cam);
    }
  }
}
