// ---------- gameplay ----------

// ---- near misses & combos ----
// A late dodge (pulling out when the car ahead is within ~60 of your nose) or a cut-in (moving over just in front of a car
// you passed) is a near miss: bonus points times the combo, which also multiplies overtakes until it lapses.
const COMBO_T = 180; // frames a combo survives without another near miss
let pops = [], slowT = 0; // "CLOSE!" popups; slow-motion frames left
const COMBO_MAX = 5; // the chain can keep counting, but it never pays more than x5
const comboMult = r => r.comboT > 0 ? clamp(r.combo, 1, COMBO_MAX) : 1;
// Score balance: everything scales with speed, so fast, risky driving always out-scores slow, safe driving.
// An overtake pays 1 point at ~180 km/h or below, 2 at 240, 3 at 300, 4 at 360... with no ceiling.
const passPoints = v => Math.max(1, Math.round((v * 60 - 120) / 60));
const SPEED_PAR = 150; // World Tour: every second under 150 s at the finish is worth 4 points (~60 s flat out, ~90 s carefully)
function nearMiss(r, e) { // (e: the vehicle you shaved past, for the side its whoosh comes from)
  r.combo = (r.comboT > 0 ? r.combo : 0) + 1; r.comboT = COMBO_T;
  r.nm = (r.nm || 0) + 1; r.bestCombo = Math.max(r.bestCombo || 0, r.combo); // for missions and stats
  if (!r.ai) {
    bump("nearMisses"); if (r.combo > stats.bestCombo) bump("bestCombo", r.combo - stats.bestCombo);
    unlock("close"); if (r.nm >= 10) unlock("near10"); if (r.combo >= 5) unlock("combo5"); if (r.combo >= 10) unlock("combo10");
  }
  r.score += 5 * passPoints(r.v) * comboMult(r); // a close shave at speed is worth more
  if (r.ai) return;
  pops.push({ r, text: r.combo > 1 ? `CLOSE! x${r.combo}` : "CLOSE!", t: 0 });
  sound.passBy(e && Math.abs(e.x - r.x) > 8 ? Math.sign(e.x - r.x) : 0, true); shake = Math.max(shake, 3); rumbleSoft(); // a loud whoosh on its side, and a little jolt you can feel
  if (!settings.lowfx) glowBurst(r.x, r.y - 6, ["#ffffff", "#7fffd4", "#ffe08a"], 16 + Math.min(r.combo, 6) * 3, 5, 18, [1.5, 3]);
}

function setLane(r, lane) {
  if (lane === r.lane) return;
  r.fromLane = r.lane;
  r.lane = lane;
  r.lastMove = frame;
  if (state !== "playing" || !grid.done) return;
  for (const e of enemies) {
    const ahead = r.y - e.y; // > 0: it's in front of us
    if (e.lane === r.fromLane && ahead > 0 && ahead < CAR_H + 60) (e.dodged = e.dodged || {})[r.id] = true; // late dodge: pays out as we pass it
    if (e.lane === lane && e.passed[r.id] && -ahead < CAR_H + 40) nearMiss(r, e); // cut in right in front of it
  }
}

function steer(r, dir) {
  if (!r || !r.alive || !grid.done) return;
  if (r.bypassing) return; // on the side track: the track steers
  const b = r.bypass;
  if (b && b.state === "armed" && dir === b.side) { setLane(r, b.lane); startBypass(r); return; } // steering out of the road, into the bypass: while the pop-up shows, the arrow always takes it
  setLane(r, clamp(r.lane + dir, 0, LANES - 1));
}

const KEYS = {
  p1: { up: ["ArrowUp"], down: ["ArrowDown"] },
  shared: { up: ["ArrowUp", "KeyW"], down: ["ArrowDown", "KeyS", "Space"] }, // (Space brakes too, like a handbrake)
  p2: { up: ["KeyW"], down: ["KeyS"] },
};

// the two pedals, 0..1 each: analog from a controller's triggers, digital from keys / touch
function pedals(r) {
  const set = mode === "multi" ? (r.id === 0 ? KEYS.p1 : KEYS.p2) : KEYS.shared;
  let gas = set.up.some(k => held.has(k)) ? 1 : 0, brake = set.down.some(k => held.has(k)) ? 1 : 0;
  if (r.id === 0) { if (touch.gas) gas = 1; if (touch.brake) brake = 1; }
  return { gas: Math.max(gas, padG[r.id] || 0), brake: Math.max(brake, padB[r.id] || 0) };
}
const throttleFor = r => { const p = pedals(r); return clamp(p.gas - p.brake, -1, 1); }; // -1..1 while driving

// ---- tyres: how well the chosen compound holds the road as it is right now (0.5 .. 1) ----
const wetnessNow = () => clamp(((pal && pal.rain) || 0) / 0.7, 0, 1);
const gripNow = r => r.ai ? 1 : gripOf(r.tyre || "dry", wetnessNow());

// ---- the start-line launch: hold gas and brake together (RT + LT, Up + Down) to rev; the needle sweeps up and down; let go in the green ----
// The start-line launch needle sweeps up and down while you hold gas + brake together; let go and the zone it is in decides your launch speed.
const NEEDLE_PERIOD = 130; // frames for one full sweep up and back
function chargeLaunch(r) {
  if (r.launched || r.launchLocked) { r.charging = false; return; }
  const p = pedals(r), both = p.gas > 0.3 && p.brake > 0.3;
  if (both) {
    r.charging = true; r.needleT = (r.needleT || 0) + 1; r.needle = 0.5 - 0.5 * Math.cos(r.needleT / NEEDLE_PERIOD * TAU); r.rev = clamp(0.2 + 0.8 * r.needle, 0, 1); // (the engine note follows the needle)
    return;
  }
  if (r.charging) { // let go of a pedal: the needle's place decides the launch
    r.charging = false; r.launchLocked = true; const z = launchZoneOf(r.needle || 0); r.launchZone = z; r.launchGoal = z.v; r.rev = 0.3;
    if (z === LAUNCH_ZONES[0]) unlock("react");
    pops.push({ r, text: `${z.name} START! ${Math.round(z.v * 60)}`, t: 0 }); sound.tone(520, 1040, 0.18, "triangle", 0.07);
  } else r.rev += clamp(p.gas - r.rev, -0.08, 0.05); // gas alone just revs the engine
}


// ---- the bypass: the pop-up in an outside lane arms it; steering out of the road (left in the left lane, right in the right lane) then
// curves you round the next vehicle on a track of its own, at nitro speed, and drops you back where the lane is clear (with nothing ahead to
// curve round, at nitro speed the car ahead is often already gone, it is a short run along the side track: the press is never wasted) ----
const BYPASS_OFF = 112, BYPASS_RAMP = 170, BYPASS_BACK = 120; // how far beside the lane the side track runs, and how long the curve out / back onto the road takes (the way back is quicker)
function bypassTarget(r, b) { let best = null; for (const e of enemies) if (e.lane === b.lane && e.y < r.y - 20 && (!best || e.y > best.y)) best = e; return best; } // the nearest vehicle ahead in that lane
function startBypass(r) {
  const b = r.bypass;
  // the track runs just far enough to pass the vehicle (and any others bunched right behind it), then a short clear stretch
  const vp = Math.max(r.v, 2.2) + 1.8, ahead = enemies.filter(e => e.lane === b.lane && e.y < r.y - 20).sort((a, c) => c.y - a.y); // nearest first
  let last = ahead[0], need = 0; // (nothing ahead: need stays 0 and the track is the shortest one)
  for (const e of ahead) { if (e !== ahead[0] && last.y - e.y > 340) break; const rel = Math.max(0.6, vp - e.cur); need = Math.max(need, (r.y - e.y + lenOf(e) / 2 + CAR_H / 2 + 40) / rel * vp); last = e; }
  b.L = clamp(need + (BYPASS_RAMP + BYPASS_BACK) * 0.5 + 110, 460, 1250); b.d = 0; b.state = "active"; r.bypassing = true;
  bypassTrack = { side: b.side, lane: b.lane, y0: r.y, L: b.L, OFF: BYPASS_OFF, RAMP: BYPASS_RAMP, BACK: BYPASS_BACK };
  const used = r.usedNitro; startNitro(r); r.usedNitro = used; // nitro speed, but it doesn't count as "picking up nitro" for missions
  for (const o of racers) if (o.ai) o.noChaseUntil = Infinity; // the Vs CPU can't surge to match you while you're out on the bypass
  if (mode === "vs") r.heat = (r.heat || 0) + 1.5; // (chaining boosts winds the CPU up: see vsPace)
  r.score += 25 * comboMult(r); pops.push({ r, text: "BYPASS!", t: 0 }); sound.tone(500, 1500, 0.3, "triangle", 0.08);
}
function stepBypass(r) {
  const b = r.bypass; if (!b) return;
  if (b.state === "armed") {
    if (r.lane !== b.lane || --b.timeLeft <= 0) { r.bypass = null; return; } // moved away, or took too long
    b.target = bypassTarget(r, b); return;
  }
  b.d += speed; // distance covered on the side track
  const k = clamp(b.d / BYPASS_RAMP, 0, 1), kOut = smooth(Math.min(k, clamp((b.L - b.d) / BYPASS_BACK, 0, 1)));
  r.bypassX = laneX(b.lane) + b.side * BYPASS_OFF * kOut; r.bypassK = kOut; // the car follows the curved track exactly (bypassK: how far up the ramp it is)
  r.x = r.bypassX;
  if (b.d >= b.L) { r.bypassing = false; r.bypass = null; bypassTrack = null; r.x = laneX(r.lane); if (!window.__recordingRun) r.ghost = Math.max(r.ghost || 0, 90); r.bypassX = undefined; bypassEdge(r); } // back on the road; a moment of grace in case
}
// Against the CPU the bypass pays: you rejoin the road a little faster than it is going (even once the nitro wears off),
// and it gets no catch-up for 4 more seconds, so the ground you gained is yours to keep.
function bypassEdge(r) {
  for (const o of racers) {
    if (!o.ai || o === r) continue;
    o.noChaseUntil = frame + Math.round(240 / (1 + (r.heat || 0) * 0.6)); // (shorter when you keep chaining boosts)
    if (!o.alive) continue;
    const floor = o.v + 0.35; // ~20 km/h quicker than the CPU
    r.v = Math.max(r.v, floor); if (r.cruise !== undefined) r.cruise = Math.max(r.cruise, floor);
  }
}

// ---- traffic: plain road cars, then long trucks and roadworks, introduced gradually; nothing ever changes lane ----
const ROAD_COLS = ["#f2f2f0", "#b9bec6", "#2a2c31", "#c0392b", "#2f5fa8", "#7d838c", "#2f6b4f", "#d8c9a3", "#8a1f2b", "#e0e3e8"];
const TRUCK_LEN = 160, WORKS_LEN = 420, SIGN_AHEAD = 650; // roadworks: the warning sign stands this far before the cones
const lenOf = e => e.len || CAR_H;
const NEW_KINDS = { truck: "NEW: Trucks - longer to pass", works: "NEW: Roadworks - cones close a lane", shield: "NEW: Shield - absorbs one crash" };
let seenKinds = store.get("seenKinds", []);
// World Tour adds a new kind every few cities; Endless as you pass cars (the menu's demo traffic stays plain)
function trafficKinds() {
  const p = racers ? Math.max(0, ...racers.map(r => r.passed)) : 0;
  const has = (city, cars) => state === "playing" && (level ? level.idx >= city : p >= cars);
  return { truck: has(6, 40), works: false }; // (roadworks were removed)
}
// is this stretch of a lane taken? (lengths count, so trucks block what they really cover)
const laneBusy = (lane, y, len, pad, skip) => enemies.some(o => o !== skip && o.lane === lane && Math.abs(o.y - y) < (lenOf(o) + len) / 2 + pad);
// a pickup (coin, nitro, shield, bypass) is already near this spot of a lane?
const pickupNear = (lane, y, len, pad) => pickups.some(k => k.lane === lane && Math.abs(k.y - y) < len / 2 + pad);
function wouldWall(lane, y, len, skip) { // something in all three lanes within a stretch would leave no way through: keep a clear lane at all times
  const near = new Set([lane]);
  for (const o of enemies) if (o !== skip && Math.abs(o.y - y) < (lenOf(o) + len) / 2 + 340) near.add(o.lane);
  return near.size >= LANES;
}
// pick a model by weight: [name, km/h, weight]
function pickModel(list) { let x = Math.random() * list.reduce((a, m) => a + m[2], 0); for (const m of list) { if ((x -= m[2]) < 0) return m; } return list[0]; }

function spawnEnemyAt(y) {
  const k = trafficKinds(), roll = grand();
  let kind = "car";
  if (k.truck && roll < 0.15) kind = "truck";
  const len = kind === "truck" ? TRUCK_LEN : CAR_H, yc = y - (len - CAR_H) / 2; // long things stretch on up the road
  for (let tries = 0; tries < 4; tries++) {
    const lane = Math.floor(grand() * LANES);
    if (laneBusy(lane, yc, len, 130) || wouldWall(lane, yc, len) || pickupNear(lane, yc, len, 90) || (bypassTrack && bypassTrack.lane === lane && yc < bypassTrack.y0 && yc > bypassTrack.y0 - bypassTrack.L - 300)) continue; // spot taken, it would wall off the road, or it would block a bypass
    const m = pickModel(kind === "truck" ? TRUCK_MODELS : CAR_MODELS), v = m[1] / 60 * (0.97 + Math.random() * 0.06); // its own cruising speed, a touch different each time
    enemies.push({ kind, model: m[0], lane, x: laneX(lane), y: yc, len, v, cur: v, col: gpick(ROAD_COLS), passed: {}, miss: {} });
    return;
  }
}
const spawnEnemy = () => spawnEnemyAt(-AHEAD);
// Traffic drives: everyone holds their own speed, but queues up behind a slower vehicle in the same lane instead of driving through it.
// (Nothing ever changes lane, so the relative speeds are what make the road feel alive.)
function flowTraffic() {
  for (let lane = 0; lane < LANES; lane++) {
    const q = enemies.filter(e => e.lane === lane).sort((a, b) => a.y - b.y); // front of the queue first
    for (let i = 0; i < q.length; i++) {
      const e = q[i], lead = q[i - 1]; let want = e.v;
      if (lead) {
        const gap = e.y - lead.y - (lenOf(e) + lenOf(lead)) / 2;
        if (gap < 120 && lead.cur < want) want = lead.cur + (gap < 50 ? -0.05 : 0); // closing on a slower vehicle: match its speed
        if (gap < 12) { e.y = lead.y + (lenOf(e) + lenOf(lead)) / 2 + 12; want = Math.min(want, lead.cur); } // never overlap
      }
      e.cur += (want - e.cur) * 0.08;
    }
  }
}
// Against an Impossible CPU, keep cars far enough apart that a clean line always exists (otherwise nobody could survive the walls the spawner can create)
const trafficGap = () => racers.some(r => r.ai === DIFFS.impossible) ? 260 : 190;
function seedTraffic(y0 = -60) { const lo = trafficGap() > 190 ? 280 : 230; let y = y0; while ((y -= grnd(lo, lo + 140)) > -AHEAD + 40) spawnEnemyAt(y); } // the road is already busy when you arrive

function spawnPickup(y = -AHEAD, forceNitro = false) {
  const lane = Math.floor(grand() * LANES);
  if (laneBusy(lane, y, 20, 220) || pickupNear(lane, y, 20, 120)) return; // never in a closed lane or under a car
  if (forceNitro || grand() < 0.3) pickups.push({ type: !forceNitro && grand() < 0.25 ? "shield" : "nitro", lane, x: laneX(lane), y }); // a rare shield instead of nitro
  else for (let i = 0; i < 4; i++) pickups.push({ type: "coin", lane, x: laneX(lane), y: y - i * 45 });
}
// the bypass pop-up: only in the two outside lanes, and not often
function spawnCurve(y = -AHEAD) {
  const lane = grand() < 0.5 ? 0 : LANES - 1;
  if (laneBusy(lane, y, 30, 260) || pickupNear(lane, y, 30, 160)) return;
  pickups.push({ type: "curve", lane, x: laneX(lane), y });
}

// ---- the CPU rival in Vs (and the Grand Final) has a place on the road of its own: the camera follows you, and it drives at its own
// speed through the same traffic, a few car lengths ahead or behind. (In the other modes everyone is held on screen at the fastest car's pace.) ----
const freeCpu = () => mode === "vs" || !!(level && level.final);
const CPU_BEHIND = 1200; // how far below your car the Vs CPU can still be (the traffic you've passed is kept until it has passed it too)
const roadPace = r => freeCpu() ? r.v : Math.max(r.v, speed); // how fast the traffic comes at this car
// are you in that lane, close by? (with a free choice the Vs CPU passes round you rather than through you; it never risks a crash for it)
function youNear(r, lane) {
  const you = racers[0], d = r.y - you.y;
  return mode === "vs" && r !== you && you.alive && !you.bypassing && you.lane === lane && d > -200 && d < 320;
}
// Vs CPU pace: it races its own race. Every few seconds it picks a plan (attack: take the lead; stalk: sit a few lengths back;
// side by side) and drives at whatever speed gets it there, so you trade places instead of driving in formation.
// While you're on a bypass and for a few seconds after, it gets no catch-up: what the bypass gains you is yours to keep.
// Chain nitros and bypasses and it gets wound up (heat): it pushes harder and closes to just behind you, so it stays a fight.
function vsPace(r, base) {
  const you = racers[0], p = r.ai, gap = (r.trueY === undefined ? r.y : r.trueY) - you.y, hk = vsHeat(); // > 0: it's behind you
  if (frame >= (r.planUntil || 0)) {
    const roll = Math.random();
    r.planGap = roll < p.attack ? -rnd(110, 260) : roll < p.attack + 0.3 ? rnd(-30, 30) : rnd(90, 220);
    r.planUntil = frame + Math.round(rnd(180, 420)); // 3 to 7 seconds
  }
  if (!you.alive) return base;
  let aim = r.planGap;
  if (hk > 0.2 && aim > 0) aim = Math.min(aim, 210 - 110 * hk); // wound up: it hunts you down to a couple of lengths back
  if (r.lane === you.lane && Math.abs(aim) < 150) aim = gap >= 0 ? 150 : -150; // in your lane it keeps a couple of lengths clear (tucked in behind, or ahead), never inside you
  const want = Math.max(base, you.v + clamp((gap - aim) * (0.006 + 0.01 * hk), -0.6, p.push + 1.4 * hk));
  return frame < (r.noChaseUntil || 0) ? Math.min(want, you.v - 0.35) : want;
}

// how wound up the Vs CPU is by your recent nitros and bypasses, 0..1 (each nitro adds 1, a bypass 1.5; it cools over ~20 s)
const vsHeat = () => mode === "vs" && racers[0] ? clamp(((racers[0].heat || 0) - 0.5) / 3, 0, 1) : 0;

// Time-aware planner (every Vs CPU below Impossible: that one has aiPlanReal): simulate every lane over the next stretch of road in short steps and pick the move
// that keeps the car alive longest, so it escapes staggered walls of traffic that a one-step dodge can't.
// (Each vehicle closes at our speed minus its own; a car the CPU hasn't noticed isn't in the plan at all.)
function aiPlan(r, p, look, ready, noticed, pref) {
  const v = Math.max(roadPace(r), 1), DT = 4,
     N = clamp(Math.ceil(look / (v * DT)), 4, 26), margin = CAR_H - 6 + 16;
  const safe = Array.from({ length: N + 2 }, () => [true, true, true]);
  for (const e of enemies) {
    const d0 = r.y - e.y, ext = (lenOf(e) - CAR_H) / 2, rel = freeCpu() ? Math.max(0.2, v - e.cur) : v; // d0 > 0: it's ahead of us; ext: how much longer than a car it is at each end
    if (d0 > look + 80 + ext || d0 < -margin - ext - 10 || !noticed(e)) continue;
    for (let t = 0; t <= N + 1; t++) { const d = d0 - rel * DT * t; if (Math.abs(d) < (d < 0 && freeCpu() ? CAR_H : margin) + ext) safe[t][e.lane] = false; } // (one it has already passed only needs real clearance: it's pulling away)
  }
  // it can only plan on moves it will really get to make: after a move, the next comes once the cooldown is over, at its next decision (worst case)
  const K = Math.max(1, Math.ceil((p.think + p.cooldown) / DT));
  const surv = Array.from({ length: N + 2 }, () => [0, 0, 0]); // how many steps we can keep going from (step, lane)
  for (let t = N + 1; t >= 0; t--) for (let l = 0; l < LANES; l++) {
    if (!safe[t][l]) continue;
    if (t === N + 1) { surv[t][l] = 1; continue; }
    let best = 0;
    for (let l2 = Math.max(0, l - 1); l2 <= Math.min(LANES - 1, l + 1); l2++) {
      if (l2 !== l && (t % K !== 0 || !safe[t][l2])) continue; // a lane change: only at its next decision, into a lane that's clear (the car is out of its old lane within a couple of frames)
      if (safe[t + 1][l2]) best = Math.max(best, surv[t + 1][l2]);
    }
    surv[t][l] = 1 + best;
  }
  const cur = r.lane;
  let bestLane = cur, bestVal = ready ? -1 : safe[1][cur] ? surv[1][cur] : 0;
  for (let l2 = Math.max(0, cur - 1); ready && l2 <= Math.min(LANES - 1, cur + 1); l2++) {
    if (l2 !== cur && !safe[0][l2]) continue;
    if (!safe[1][l2]) continue;
    let val = surv[1][l2];
    if (val >= N) { // several fully safe options: staying put is best, then lanes with coins or nitro ahead
      val += l2 === cur ? 0.5 : 0;
      if (p.greedy && pickups.some(k => k.lane === l2 && k.type !== "curve" && !k.cpuSkip && r.y - k.y > 0 && r.y - k.y < look * 0.6)) val += 0.8;
      if (pref !== undefined && Math.abs(l2 - pref) < Math.abs(cur - pref)) val += 0.7; // drifting towards its fancied lane (staying put is worth 0.5)
      if (youNear(r, l2)) val -= 1; // not right on top of you
    }
    if (val > bestVal) { bestVal = val; bestLane = l2; }
  }
  if (bestVal < N) { // no clear way through yet: brake and tuck in behind whatever is ahead in that lane until a gap opens
    let lead = null;
    for (const e of enemies) if (e.lane === bestLane && r.y - e.y > 0 && r.y - e.y < look && noticed(e) && (!lead || e.y > lead.y)) lead = e;
    if (lead) { r.followV = lead.cur; r.followUntil = frame + p.think + 4; }
  }
  if (bestLane !== cur) setLane(r, bestLane);
}

// The Impossible CPU's planner: like aiPlan, but tick by tick, with the game's real physics (the stepped plan above can step right over a car
// once the road comes at it faster than ~40 units a tick, and that is where the Impossible CPU kept crashing):
// - how fast the road really comes at it: its own speed, or yours while it is held at the back (or front) of the stretch of road that exists
//   (stepRacers). It may speed up (nitro, or you pulling it along) or slow down after that, so a vehicle ahead is assumed to come as fast as it
//   could and one alongside to fall back as slowly as it could
// - traffic at different speeds: a vehicle closing on a slower one queues behind it (flowTraffic), so it can't be further on than that
// - a crash is a real overlap: the same distances as the collision check in updatePlaying
// - a lane change eases the car across (stepRacers): it is out of the old lane's way after moveOut ticks and in the new lane's way from moveIn
// If every way ends in a crash soon, it brakes hard (aiBrake, in updatePlaying), when braking can help.
const IMP_T = 100, IMP_PAD = 10, IMP_BRAKE = 20, IMP_MAXE = 96, IMP_N = IMP_T + IMP_PAD + 2; // ticks planned (~1.7 s); spare ticks; brake when a crash is this close; vehicles followed
const impSafe = Array.from({ length: IMP_N }, () => [true, true, true]), impFar = impSafe.map(() => [0, 0, 0]);
const impFast = new Float64Array(IMP_N), impSlow = new Float64Array(IMP_N), impLo = new Float64Array(IMP_MAXE * IMP_N), impHi = new Float64Array(IMP_MAXE * IMP_N);
const impQ = new Int32Array(IMP_MAXE), impSlot = new Int32Array(1024); // (reused: nothing allocated per tick; past IMP_MAXE vehicles the rest are planned at their own speed)
function aiPlanReal(r, p, look, ready, pref) {
  // how far it really moves up the road this tick (stepRacers), and whether it is held at the back, where braking can't slow it
  let cr, held = false;
  if (r.trueY !== undefined || freeCpu()) {
    const ty = r.trueY === undefined ? r.y : r.trueY; let ny = ty + speed - r.v;
    if (mode === "vs") { ny = clamp(ny, -AHEAD + 300, H + CPU_BEHIND); held = ny >= H + CPU_BEHIND; }
    cr = speed - (ny - ty);
  } else { const ny = clamp(r.y + (speed - r.v) - 0.015 * (r.y - r.ty), 80, H - 38); held = ny >= H - 38; cr = speed - (ny - r.y); }
  cr = Math.max(0.3, cr);
  const L = clamp(Math.ceil(look / cr), 30, IMP_T) + IMP_PAD, acc = r.nitro > 0 || held ? 0.1 : 0.06; // (held, it goes at your pace, and your nitro pulls it along)
  for (let t = 1, f = 0, s = 0, cf = cr, cs = cr; t <= L; t++) { f += cf; s += cs; impFast[t] = f; impSlow[t] = s; cf = Math.min(cr + 3, cf + acc); cs = Math.max(cr - 1.5, cs - 0.05); } // road covered by tick t, at the most and the least
  // where each vehicle can be by tick t, lane by lane from the front of each queue: it holds its own speed, but can't drive through a slower one
  // ahead (it can only get as close as flowTraffic lets it), and it never drops back further than queueing behind it allows
  let n = 0;
  for (let i = 0; i < enemies.length; i++) impSlot[i] = -1;
  for (let lane = 0; lane < LANES; lane++) {
    let q = 0;
    for (let i = 0; i < enemies.length && q < IMP_MAXE; i++) if (enemies[i].lane === lane) { let j = q++; while (j > 0 && enemies[impQ[j - 1]].y > enemies[i].y) { impQ[j] = impQ[j - 1]; j--; } impQ[j] = i; } // front of the queue first
    let slowest = Infinity;
    for (let j = 0; j < q && n < IMP_MAXE; j++) {
      const e = enemies[impQ[j]], s = n++, o = s * IMP_N, lo = Math.min(e.cur, e.v), hi = Math.max(e.cur, e.v); impSlot[impQ[j]] = s;
      const ls = j > 0 ? impSlot[impQ[j - 1]] : -1, lead = j > 0 ? enemies[impQ[j - 1]] : null, gap = lead ? e.y - lead.y - (lenOf(e) + lenOf(lead)) / 2 : 0;
      for (let t = 0; t <= L; t++) {
        let a = lo * t, b = hi * t;
        if (ls >= 0) { b = Math.min(b, impHi[ls * IMP_N + t] + gap - 12); a = Math.min(a, Math.max(impLo[ls * IMP_N + t] + gap - 120, (slowest - 0.06) * t)); }
        impLo[o + t] = Math.min(a, b); impHi[o + t] = b;
      }
      slowest = Math.min(slowest, lo);
    }
  }
  // which lanes would be a crash at each tick
  for (let t = 0; t <= L + 1; t++) impSafe[t][0] = impSafe[t][1] = impSafe[t][2] = true;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i], d0 = r.y - e.y, hit = (lenOf(e) + CAR_H) / 2 - 6 + (window.__recordingRun ? 18 : 0), s = impSlot[i]; // d0 > 0: it's ahead of us; hit: the centre-to-centre distance of a crash
    if (d0 < -hit || (e.passed[r.id] && d0 < 0)) continue; // already behind us: it can never hit us
    for (let t = Math.max(1, (r.ghost || 0) + 1); t <= L; t++) { // (still flashing from a bump: nothing can hit it yet)
      const lo = s >= 0 ? impLo[s * IMP_N + t] : e.cur * t, hi = s >= 0 ? impHi[s * IMP_N + t] : e.cur * t;
      if (d0 - impFast[t] + lo < hit + 4 && d0 - impSlow[t] + hi > -hit) impSafe[t][e.lane] = false;
    }
  }
  // the lane change: the same easing as stepRacers (moveOut: the checks it is still in the old lane's way for; from moveIn on it is in the new lane's)
  const k = 0.3 * (0.4 + 0.6 * gripNow(r)), W = window.__recordingRun ? (CAR_WIDE + TRAFFIC_WIDE) / 2 : CAR_W - 4; let moveOut = -1, moveIn = 0;
  for (let m = 0, rem = LANE_W; m < 30; m++) { rem *= 1 - k; if (moveOut < 0 && LANE_W - rem >= W) moveOut = m; if (rem < W) { moveIn = m; break; } }
  // impFar[t][l]: the last tick it can still be alive at, deciding at tick t while in lane l: stay, or start a move (its old lane must stay clear
  // until it is out of the way, then the new lane takes over)
  for (let l = 0; l < LANES; l++) impFar[L + 1][l] = L;
  for (let t = L; t >= 1; t--) for (let l = 0; l < LANES; l++) {
    let f = impSafe[t][l] ? impFar[t + 1][l] : t - 1, out = L;
    for (let m = 0; m < moveOut; m++) if (t + m <= L && !impSafe[t + m][l]) { out = t + m - 1; break; }
    for (let l2 = l - 1; l2 <= l + 1; l2 += 2) if (l2 >= 0 && l2 < LANES) f = Math.max(f, out < L ? out : t + moveIn > L ? L : impFar[t + moveIn][l2]);
    impFar[t][l] = f;
  }
  // what heading for each lane now leads to: the car slides from where it really is (it may still be crossing from its last move), and every
  // lane it is in the way of on the way must be clear while it is
  const reach = lane => {
    let x = r.x;
    for (let t = 1; t <= L; t++) {
      x += (laneX(lane) - x) * k;
      let alone = true;
      for (let l = 0; l < LANES; l++) if (Math.abs(x - laneX(l)) < W) { if (!impSafe[t][l]) return t - 1; if (l !== lane) alone = false; }
      if (alone && Math.abs(x - laneX(lane)) < W) return impFar[t + 1][lane];
    }
    return L;
  };
  const cur = r.lane, stay = reach(cur);
  if (!ready && stay >= L) return; // (between moves, unless staying put would crash)
  const score = (l2, val) => { // several fully safe options: staying put is best, then lanes with coins or nitro ahead, then its fancied lane, not right on top of you
    if (val < L) return val;
    let s = L + 2 + (l2 === cur ? 0.5 : 0);
    if (p.greedy && pickups.some(k => k.lane === l2 && k.type !== "curve" && !k.cpuSkip && r.y - k.y > 0 && r.y - k.y < look * 0.6)) s += 0.8;
    if (pref !== undefined && Math.abs(l2 - pref) < Math.abs(cur - pref)) s += 0.7;
    if (youNear(r, l2)) s -= 1;
    return s;
  };
  let bestLane = cur, bestVal = stay, best = score(cur, stay) + (stay < L ? 0.5 : 0); // (staying put wins a tie)
  for (let l2 = cur - 1; l2 <= cur + 1; l2 += 2) {
    if (l2 < 0 || l2 >= LANES) continue;
    const val = reach(l2), s = score(l2, val);
    if (s > best) { best = s; bestVal = val; bestLane = l2; }
  }
  if (bestVal < IMP_BRAKE && !held) r.aiBrake = frame + 2; // a crash is coming whatever it does: brake (held at the back it goes at your pace, so braking can't help)
  if (bestLane !== cur) setLane(r, bestLane);
}

// the CPU's fancied lane: re-picked every few seconds, always a different lane from yours, so it doesn't just shadow your moves
function wanderLane(r) {
  const you = racers[0];
  if (r.wanderLane === undefined || frame >= r.wanderUntil || (you && r.wanderLane === you.lane && frame > r.wanderAt + 40)) {
    const opts = [0, 1, 2].filter(l => !you || l !== you.lane);
    r.wanderLane = opts[Math.floor(Math.random() * opts.length)]; r.wanderAt = frame; r.wanderUntil = frame + Math.round(rnd(90, 260));
  }
  return r.wanderLane;
}

// Lane-change decision: dodge when a car in our lane is within sight, preferring the neighbour with more room.
function aiThink(r) {
  const p = r.ai;
  if (!aiGo() || frame < r.nextThink) return;
  r.nextThink = frame + p.think;
  const look = p.look * Math.max(1, roadPace(r) / 2); // look further the faster the road is coming at us
  const noticed = e => { // has it seen this vehicle? (a missed one is never seen; with late, it's spotted a moment before it would hit: a last-second swerve, sometimes too late)
    if (e.miss[r.id] === undefined) e.miss[r.id] = Math.random() < p.miss;
    return !e.miss[r.id] || (!!p.late && r.y - e.y - (lenOf(e) - CAR_H) / 2 < CAR_H + Math.max(0, roadPace(r) - e.cur) * p.late);
  };

  const clearance = lane => {
    let c = Infinity;
    for (const e of enemies) {
      if (e.lane !== lane || !noticed(e)) continue;
      const ext = (lenOf(e) - CAR_H) / 2, d = r.y - e.y - ext; // > 0: its tail is ahead of us
      if (d > -CAR_H - 2 * ext && d < look) c = Math.min(c, d);
    }
    return c;
  };

  const ready = frame - r.lastMove >= p.cooldown;
  const pref = p.wander ? wanderLane(r) : undefined; // a lane it fancies for a while, never the one you are in: it races its own race

  if (p.plan) { aiPlanReal(r, p, look, ready, pref); return; }
  if (mode === "vs") { aiPlan(r, p, look, ready, noticed, pref); return; }
  const here = clearance(r.lane);

  if (here === Infinity) {
    if (p.greedy && ready) {
      const pk = pickups.filter(k => Math.abs(k.lane - r.lane) === 1 && k.type !== "curve" && !k.cpuSkip && r.y - k.y > 0 && r.y - k.y < look * 0.7).sort((a, b) => b.y - a.y)[0];
      if (pk && clearance(pk.lane) === Infinity) { setLane(r, pk.lane); return; }
    }
    if (pref !== undefined && ready && r.lane !== pref) { const l = r.lane + Math.sign(pref - r.lane); if (clearance(l) === Infinity) setLane(r, l); }
    return;
  }
  if (!ready) return;
  let bestLane = r.lane, bestC = here;
  const side = pref !== undefined && pref !== r.lane ? Math.sign(pref - r.lane) : Math.random() < 0.5 ? -1 : 1; // when both sides are open: towards the lane it fancies, else either way (not always the same side as you)
  for (const l of [r.lane + side, r.lane - side]) {
    if (l < 0 || l >= LANES) continue;
    const c = clearance(l);
    if (c > bestC + 60 || (c === Infinity && bestC !== Infinity)) { bestLane = l; bestC = c; }
  }
  setLane(r, bestLane);
}

function stepRacers() {
  for (const r of racers) {
    const px = r.x;
    if (r.alive) {
      if (r.bypassing) stepBypass(r); // the bypass track places the car itself
      else { // the tyres' grip for the weather decides how quickly a lane change bites; the Handling upgrade quickens it
        const grip = gripNow(r); r.slip = grip < 0.78 && Math.abs(laneX(r.lane) - r.x) > 8;
        r.x += (laneX(r.lane) - r.x) * 0.3 * (0.4 + 0.6 * grip) * (r.ai ? 1 : 1 + 0.08 * upLvl("handling"));
        if (r.bypass) stepBypass(r);
      }
      // slower than the pace car -> slip back down the screen; the spring pulls you back when you keep up
      if (r.ai && (r.trueY !== undefined || (freeCpu() && state === "playing"))) { // the rival CPU: trueY is its real distance from you; y is where it can be drawn
        r.trueY = (r.trueY === undefined ? r.y : r.trueY) + (speed - r.v);
        if (mode === "vs" && state === "playing") { // the Vs CPU never leaves the stretch of road that has traffic on it (it can't hide from a crash): at either end it keeps your pace
          if (r.trueY > H + CPU_BEHIND) { r.trueY = H + CPU_BEHIND; r.v = Math.max(r.v, speed); }
          else if (r.trueY < -AHEAD + 300) { r.trueY = -AHEAD + 300; r.v = Math.min(r.v, speed); }
        }
        r.y = clamp(r.trueY, -AHEAD + 60, H + (level ? 400 : CPU_BEHIND));
      }
      else r.y = clamp(r.y + (speed - r.v) - 0.015 * (r.y - r.ty), 80, H - 38);
      const target = clamp(Math.atan2(r.x - px, 10), -0.45, 0.45);
      r.tilt += (target - r.tilt) * 0.3;
    } else {
      // a wreck keeps its momentum: it slides on up the road, slowing as it scrapes along, and spins on its way (the tyres and bodywork bite more and more)
      r.deadT++;
      r.wreckV = (r.wreckV || 0) * 0.972;
      r.y += scroll - r.wreckV; // (the road stops scrolling once you have crashed, so the wreck slides forward through the scene)
      r.x += r.drift; r.drift *= 0.955; r.yawV = (r.yawV || 0) * 0.962; r.tilt += r.yawV;
    }
  }
}

// ---- the autopilot behind the title (and the menus): your car racing through the city on its own ----
// Traffic never changes lane, so it can work out exactly where every vehicle will be. Every tick it plans the next 3.7 seconds lane by lane, in
// steps of 5 ticks (assuming it speeds back up to cruise): a lane is "blocked" at a step if a vehicle is beside it then, or less than a comfortable
// distance ahead; a lane change needs the new lane clear of anything beside it until the move has finished. It takes the move that keeps
// it going longest at full speed, starting it as soon as a vehicle comes within that comfortable distance (never at the last moment). If there is
// no clear way it eases off behind the vehicle in front (it can always stop closing in time) until a gap opens. A lane change is a smooth S-curve.
const CAR_LONG = 86, CAR_WIDE = 39, TRAFFIC_WIDE = 46; // the real 3D sizes in sim units (the race car is longer than its hit box)
const reachOf = e => (CAR_LONG + lenOf(e) + 10) / 2; // centre-to-centre distance along the road at which the race car would touch it
const PLAN_DT = 5, PLAN_N = 44, PLAN_MOVE = 9; // ticks per step, steps planned, steps a lane change takes (until it has settled in the new lane)
const planHard = Array.from({ length: PLAN_N + 2 }, () => [false, false, false]), planSoft = planHard.map(() => [false, false, false]), planS = planHard.map(() => [0, 0, 0]); // (reused: nothing allocated per tick)
function pilotPlan(r, cruise) {
  const p = r.ai;
  for (let t = 0; t <= PLAN_N + 1; t++) for (let l = 0; l < LANES; l++) { planHard[t][l] = planSoft[t][l] = false; planS[t][l] = 0; }
  for (const e of enemies) { // where it will be, step by step, relative to us
    const reach = reachOf(e) + p.gap; let d = r.y - e.y, v = r.v; // d > 0: it is ahead
    for (let t = 0; t <= PLAN_N; t++) {
      if (d > -reach && d < reach) planHard[t][e.lane] = true;
      if (d > -reach && d < reach + p.comfort) planSoft[t][e.lane] = true;
      v = Math.min(cruise, v + 0.03 * PLAN_DT); d -= (v - e.cur) * PLAN_DT;
    }
  }
  const moveOk = (t, a, b) => { if (b < 0 || b >= LANES || t + PLAN_MOVE > PLAN_N) return false; for (let k = t; k <= t + PLAN_MOVE; k++) if (planHard[k][b]) return false; return true; }; // (the lane it leaves needs no check: the speed below keeps it off anything there until it is out)
  for (let t = PLAN_N; t >= 0; t--) for (let l = 0; l < LANES; l++) { // how many steps it can keep going at full speed from step t in lane l
    let best = planSoft[t][l] ? 0 : 1 + planS[t + 1][l];
    for (const s of [-1, 1]) if (moveOk(t, l, l + s)) best = Math.max(best, PLAN_MOVE + planS[t + PLAN_MOVE][l + s]);
    planS[t][l] = best;
  }
  const stay = planSoft[0][r.lane] ? 0 : 1 + planS[1][r.lane];
  let lane = r.lane, val = stay + 1; // (staying put wins a tie: no weaving for nothing)
  for (const s of Math.random() < 0.5 ? [-1, 1] : [1, -1]) {
    const b = r.lane + s; if (!canMove(r, b)) continue;
    const v = PLAN_MOVE + planS[PLAN_MOVE][b] - (b === r.fromLane && frame - r.lastMove < 150 ? 6 : 0); // (not straight back into the lane it just left)
    if (v > val) { val = v; lane = b; }
  }
  if (lane !== r.lane) setLane(r, lane);
  return lane !== r.fromLane || frame !== r.lastMove; // (false: it has just started a move)
}
// can it move into lane b now? Nothing beside it there or catching up from behind, and anything ahead far enough off to brake for in time
function canMove(r, b) {
  if (b < 0 || b >= LANES) return false;
  const p = r.ai; // (from the moment it starts the move, its speed also answers to the new lane: see pilotDrive)
  for (const e of enemies) {
    if (e.lane !== b) continue;
    const d = r.y - e.y, reach = reachOf(e) + p.gap;
    if (d <= 0) { if (-d < reach || d + Math.max(0, e.cur - r.v) * 45 > -reach) return false; }
    else { const c = Math.max(0, r.v - e.cur); if (d - reach < c * c / 0.1 + 4) return false; }
  }
  return true;
}
function pilotDrive(r, cruise) {
  const p = r.ai, settled = Math.abs(laneX(r.lane) - r.x) < 12, stayed = settled ? pilotPlan(r, cruise) : true; // (a new move only once the last one has settled)
  // the speed: cruise, but never faster than lets it stop closing on anything ahead in its lane (the one it is moving to, too) or any lane it is
  // still partly in, before its gap
  let want = cruise;
  for (let l = 0; l < LANES; l++) {
    if (l !== r.lane && Math.abs(r.x - laneX(l)) >= (CAR_WIDE + TRAFFIC_WIDE) / 2 + 4) continue; // (not in that lane, even partly)
    for (const e of enemies) {
      const d = r.y - e.y; if (e.lane !== l || d <= 0) continue;
      want = Math.min(want, e.cur + Math.sqrt(2 * 0.05 * Math.max(0, d - reachOf(e) - p.gap)));
    }
  }
  r.boxed = settled && stayed && want < cruise - 0.2; // following something, with no way round it yet
  if (r.boxed) for (const s of [-1, 1]) for (const e of enemies) { // boxed in: ease off below whatever is beside it, so it goes by and leaves a gap to slot into
    if (e.lane === r.lane + s && Math.abs(r.y - e.y) < reachOf(e) + p.gap) want = Math.min(want, e.cur - 0.3);
  }
  r.braking = want < r.v - 0.02;
  r.v += clamp(want - r.v, -0.09, 0.03);
}
function pilotMove(r) { // the car follows its lane with a critically damped spring (a smooth S-curve), and turns into the move a little
  const k = r.ai.spring, px = r.x;
  r.vx = (r.vx || 0) + (laneX(r.lane) - r.x) * k * k - (r.vx || 0) * 2 * k; r.x += r.vx;
  r.tilt = clamp(Math.atan2(r.x - px, 10), -0.45, 0.45);
  r.y = clamp(r.y - 0.015 * (r.y - r.ty), 80, H - 38); // (the road comes at the car's own speed: it holds its place on screen)
}
// The demo's traffic is laid out so there is always a way through at full speed: one car every DEMO_AI.row units up the road, never in the same lane
// as the one before, all cruising at about 100 km/h (so the pattern holds: no queues, no walls). In a race each model keeps its own speed.
let demoLast = null;
function demoRow(y) {
  const lane = demoLast ? (demoLast.lane + 1 + Math.floor(Math.random() * 2)) % LANES : Math.floor(Math.random() * LANES), m = pickModel(CAR_MODELS), v = 100 / 60 * (0.99 + Math.random() * 0.02);
  enemies.push(demoLast = { kind: "car", model: m[0], lane, x: laneX(lane), y, len: CAR_H, v, cur: v, col: gpick(ROAD_COLS), passed: {}, miss: {} });
}
function seedDemoTraffic() { demoLast = null; enemies = []; for (let y = H - 100 - DEMO_AI.row * 1.4; y > -AHEAD; y -= DEMO_AI.row) demoRow(y); } // (the first car well up the road)
function updateDemo() {
  frame++;
  if (!(racers[0].ai && racers[0].ai.pilot)) { updateAfterRace(); return; } // (a screen opened straight from a race, like the tyre choice on Retry: that race's cars just roll on)
  const cruise = state === "title" ? DEMO_AI.cruise : DEMO_AI.menu;
  for (const r of racers) pilotDrive(r, cruise);
  speed = scroll = racers[0].v; // the road comes at your car's speed
  dist += speed;
  if (!demoLast || !enemies.includes(demoLast) || demoLast.y > -AHEAD + DEMO_AI.row) demoRow(demoLast && enemies.includes(demoLast) ? demoLast.y - DEMO_AI.row : -AHEAD); // the next row, exactly a row on from the last
  flowTraffic(); for (const e of enemies) e.y += speed - e.cur;
  enemies = enemies.filter(e => e.y - lenOf(e) / 2 < H + CAR_H && e.y > -AHEAD - 400);
  for (const r of racers) pilotMove(r);
}
function updateAfterRace() { // the cars of a finished race, rolling on at a steady speed behind a menu (easing off behind anything ahead of them)
  speed = scroll = 2.8;
  for (const r of racers) {
    r.v = 2.8; if (r.ai) aiThink(r);
    for (const e of enemies) { // never drive into the back of anything: ease down to its speed as the gap closes (the 3D car is longer than its hit box, so leave a margin)
      const gap = r.y - e.y - ((lenOf(e) + 86) / 2 + 8);
      if (e.y < r.y && Math.abs(e.x - r.x) < CAR_W + 16 && gap < 90) r.v = Math.min(r.v, e.cur + (2.8 - e.cur) * clamp(gap / 90, 0, 1));
    }
  }
  dist += speed;
  spawnAcc += speed;
  if (spawnAcc > 170) { spawnAcc = 0; spawnEnemy(); }
  flowTraffic(); for (const e of enemies) e.y += speed - e.cur;
  enemies = enemies.filter(e => e.y - lenOf(e) / 2 < H + CAR_H && e.y > -AHEAD - 400);
  stepRacers();
}

// ---- nitro: driving through a canister fires it straight away ----
let kickFx = 0; // the camera kick when a nitro lights up (chase & cockpit views)
function startNitro(r) {
  if (!(r.nitro > 0)) r.cruise = r.v; // the speed you'd be doing without it; a second canister mid-burn just extends it
  r.nitro = r.nitroMax = nitroFramesFor(r); // the Nitro upgrade makes it burn longer
  r.usedNitro = true;
  if (!r.ai && mode === "vs") r.heat = (r.heat || 0) + 1;
  if (!r.ai) { sound.nitroStart(); if (r.id === 0) kickFx = 1; if ((r.nitrosFired = (r.nitrosFired || 0) + 1) >= 3) unlock("nitro3"); }
}

function collect(r, k) {
  if (k.type === "shield") {
    r.shield = true;
    burst(k.x, k.y, ["#7fffff", "#ffffff", "#3ad0ff"], 16, 3);
    if (!r.ai) sound.tone(400, 1200, 0.25, "sine", 0.07);
    return;
  }
  if (k.type === "curve") {
    if (r.ai || r.bypassing) return; // (already out on a bypass track: one at a time)
    r.bypass = { state: "armed", lane: k.lane, side: k.lane === 0 ? -1 : 1, timeLeft: 600 }; // ten seconds to use it
    sound.tone(700, 1400, 0.25, "triangle", 0.08); // (the HUD arrow says BYPASS: steer LEFT / RIGHT: no extra popups)
    burst(k.x, k.y, ["#7fffd4", "#ffffff", "#3ad0ff"], 18, 4);
    return;
  }
  if (k.type === "nitro") {
    startNitro(r);
    burst(k.x, k.y, ["#5fd4ff", "#ffffff", "#2a7bff"], 18, 4);
    return;
  }
  r.coins++; r.score += 5;
  if (!r.ai) { bump("coins"); if (stats.coins >= 500) unlock("coins500"); }
  if ((r.id === 0 || mode === "multi") && mode !== "tutorial") { wallet++; store.set("coins", wallet); } // (the test drive pays its coins at the finish)
  sound.coin();
}

function rumble() {
  try {
    for (const g of navigator.getGamepads()) {
      if (g && g.vibrationActuator) g.vibrationActuator.playEffect("dual-rumble", { duration: 350, strongMagnitude: 1, weakMagnitude: 0.7 });
    }
  } catch (e) {}
}

// The round ends the instant anyone crashes: the other car wins (or the higher score if both go at once).
function endRound(beaten = false) {
  state = "over";
  overAt = performance.now();
  sel = 0;
  touch.gas = touch.brake = false;
  const [a, b] = racers;
  if (mode === "single") result = "Crash!";
  else if (mode === "tour") { if (!beaten) result = "City failed!"; }
  else if (mode === "daily") { result = "Crashed!"; saveDailyScore(a.score); }
  else {
    const w = a.alive ? a : b.alive ? b : a.score === b.score ? null : a.score > b.score ? a : b;
    result = !w ? "Draw!" : mode === "vs" ? (w === a ? "You win!" : "CPU wins!") : `${w.label} wins!`;
  }
  if (mode === "single" && a.score > best) { best = a.score; newBest = best > 0; store.set("best", best); }
  saveStats();
  sound.silence();
  if (!beaten) { sound.thud(); rumble(); }
}

function updatePlaying() {
  frame++;
  if (steerHint && hasTouch && grid.done && (steerTaps >= 2 || frame > grid.goFrame + 360)) { steerHint = false; store.set("steerHint", true); } // got the idea
  const top = Math.max(...racers.map(r => r.passed));
  const vmin = Math.max(PLAYER_MIN_V, level ? tourParams(level.idx).vmin : Math.min(1 + tier * 0.15, 4.4)); // Endless: the pace rises every 10 cars passed (up to 264 km/h); a tour city has its own floor
  if (Math.floor(top / 10) > tier) tier = Math.floor(top / 10);

  // the start lights: five reds come on one by one, hold for a random moment, then turn green
  if (!grid.done) {
    grid.t++;
    const lit = Math.min(5, Math.floor(grid.t / GRID_STEP));
    if (lit > grid.lit) { grid.lit = lit; sound.tone(560, 560, 0.14, "square", 0.05); }
    if (grid.lit === 5 && grid.hold < 0) grid.hold = Math.round(rnd(40, 120)); // a random wait, so nobody can guess it
    if (grid.lit === 5 && grid.t >= 5 * GRID_STEP + grid.hold) { grid.done = true; grid.goFrame = frame; sound.tone(980, 980, 0.4, "square", 0.06); }
  }

  // throttle / brake (nitro takes over completely while it burns)
  for (const r of racers) {
    if (!r.alive) continue;
    if (!grid.done) { // on the grid: hold the gas and the brake together to charge the launch; let go in the green
      r.v = 0; r.braking = false;
      if (!r.ai) chargeLaunch(r);
      continue;
    }
    const aiBrake = r.ai && r.aiBrake > frame; // (the Impossible CPU sees no way through: it brakes, see aiPlanReal)
    if (aiBrake && r.nitro > 0) r.nitro = 0;
    const since = frame - grid.goFrame, boost = r.nitro > 0;
    if (r.ai && since < AI_REACT) { r.v = 0; continue; } // the CPU reacts 0.100s after green, every time
    if (r.ai && r.launchGoal === undefined) r.launchGoal = r.ai.launch || 0; // the CPU gets a launch too, by difficulty
    if (!r.ai) chargeLaunch(r);
    if (r.launchGoal && r.v < r.launchGoal && !boost) { // the launch itself: a very quick surge up to the speed the timing earned
      r.v = Math.min(r.launchGoal, r.v + 0.24); r.launched = true; r.braking = false; r.rolling = r.rolling || r.v >= vmin;
      continue;
    }
    if (r.launchGoal && r.v >= r.launchGoal) { r.launchGoal = 0; r.launchLocked = false; } // launch done: the pedals are yours again
    if (boost) {
      r.nitro--; r.braking = false;
      r.cruise += accelAt(r.cruise); // flat-out throttle keeps counting underneath the boost
      r.v = Math.min(r.v + 0.1, r.cruise + NITRO_PUSH);
      if (r.nitro === 0 && r.id === 0) sound.nitroEnd();
    } else if (r.ai) {
      const base = clamp(r.ai.speed + tier * 0.12, vmin, VMAX), boxed = aiBrake || frame < (r.followUntil || 0); // boxed in: braking behind traffic until a gap opens
      const target = aiBrake ? 0 : boxed ? Math.min(r.followV, base) : mode === "vs" ? vsPace(r, base) : base;
      const tow = mode === "vs" && r.trueY > racers[0].y && r.trueY - racers[0].y < 500 ? 0.008 : 0; // in Vs, running behind you it gets a tow from your slipstream
      const hot = mode === "vs" ? 0.045 * vsHeat() : 0; // wound up: it pulls harder too
      r.v += clamp(target - r.v, boxed ? -0.05 : -0.04, Math.min((r.ai.accel || 0.03) + hot, accelAt(r.v) + tow + hot)); // same car, same physics (and the same brakes as yours)
      r.braking = target < r.v - 0.02;
    } else {
      const pd = pedals(r), grip = gripNow(r);
      let t = clamp(pd.gas - pd.brake, -1, 1);
      if (r.charging || r.launchLocked) t = 0; // the pedals belong to the launch until it is away
      if (!r.launched && pd.gas > 0.3 && !r.charging && !r.launchLocked) { // gas alone after green: a plain quick start (100 km/h)
        r.launched = true; r.launchGoal = LAUNCH_ZONES[2].v;
      }
      r.v += t > 0 ? accelAt(r.v) * t * (0.45 + 0.55 * grip) : 0.05 * t; // brakes ~5g; the wrong tyres for the weather lose some of the pull
      r.braking = t < -0.05;
      if (t < -0.3 && r.launched) r.braked = true; // for the "finish without braking" mission
      r.hardBrake = t < -0.6 && r.v > 2.5; // tyre smoke
    }
    if (!boost && r.cruise !== undefined) { // nitro wears off: ease back down to where the throttle alone would have got you
      if (r.v > r.cruise + 0.06) r.v -= 0.06;
      else r.cruise = undefined; // back to normal: the throttle's in charge again
    }
    if (!r.rolling && r.v >= vmin) r.rolling = true; // the pace floor only applies once you're up to speed
    r.v = Math.max(r.v, r.rolling ? vmin : 0);       // no top speed: keep your foot down and it keeps climbing
  }
  if (mode === "tutorial") tutorialDrive(racers[0]); // the test drive: its 300 km/h limit, and pulling up at a start line (js/sim/tutorial.js)
  if (racers[0].heat) racers[0].heat = Math.min(5, racers[0].heat) * 0.9994; // the CPU calms down again (~20 s)
  const live = racers.filter(r => r.alive);
  if (live.length) speed = freeCpu() && racers[0].alive ? racers[0].v : Math.max(...live.map(r => r.v)); // the camera follows the fastest car (against a CPU rival: you)
  scroll = speed;
  dist += speed; driveCity();

  if (level && !finishObj) { // the finish line appears up the road so it crosses the car exactly at the end of the level
    const left = level.d0 + level.len - dist;
    if (left < AHEAD - 100) finishObj = { y: racers[0].y - left };
  }
  if (level && !halfObj && !level.halfShown) { // the halfway gantry appears up the road so it crosses the car exactly at the midpoint
    const left = level.d0 + level.len / 2 - dist;
    if (left < AHEAD - 100) { halfObj = { y: racers[0].y - left }; level.halfShown = true; }
  }
  if (halfObj && !halfObj.crossed && halfObj.y >= racers[0].y - CAR_H / 2) { halfObj.crossed = true; say("HALFWAY THERE!"); sound.tone(660, 990, 0.25, "triangle", 0.08); sound.tone(990, 1320, 0.25, "triangle", 0.06); }
  if (grid.done && !finishObj && mode !== "tutorial") { // nothing new spawns past the finish line (and in the test drive its lessons place everything)
    spawnAcc += speed;
    const gap = level ? tourParams(level.idx).gap : Math.max(trafficGap(), SPAWN_PX - Math.floor(top / 3) * 4);
    if (spawnAcc >= gap) { spawnAcc -= gap; spawnEnemy(); }
    pickupAcc -= speed;
    if (pickupAcc <= 0) { spawnPickup(); pickupAcc = grnd(520, 960); }
    if ((curveAcc -= speed) <= 0) { spawnCurve(); curveAcc = grnd(3600, 5600); } // the bypass pop-up: now and then, in an outside lane
  }

  const spray = sprayColor(), rp = rainPlay(), p0 = racers[0];
  let fogT = 0; sprayCar = null;
  if (rp > 0) for (const e of enemies) {
    if (e.kind === "works") continue;
    const d = p0.y - e.y - (lenOf(e) - CAR_H) / 2; // from its tail
    if (d > 0 && d < 400 && frame % 4 === 0 && particles.length < maxParticles()) particles.push({ x: e.x + rnd(-14, 14), y: e.y + 34, vx: rnd(-.6, .6), vy: rnd(.6, 1.6), life: 20, max: 40, size: rnd(3, 5.5), color: "rgba(215,225,240,0.4)" });
    if (d > 0 && d < 280 && Math.abs(e.x - p0.x) < 40) { const k = 1 - d / 280; if (k > fogT) { fogT = k; sprayCar = e; } } // right behind it in your lane
  }
  sprayFog += (rp * fogT - sprayFog) * 0.08;
  if (slowT > 0) slowT--;
  for (const r of racers) {
    if (r.comboT > 0 && --r.comboT === 0) r.combo = 0; // the chain lapses
    if (r.ghost > 0) r.ghost--;
    if (r.ai && r.alive) aiThink(r);
    if (!r.alive || particles.length > maxParticles()) continue;
    if (frame % 3 === 0 && spray && r.v > 2) {
      for (const sx of [-18, 18]) particles.push({ x: r.x + sx, y: r.y + 30, vx: rnd(-.5, .5), vy: rnd(.4, 1.4), life: 18, max: 45, size: rnd(2.5, 4.5), color: spray });
    }
    if (r.nitro > 0) for (let i = 0, n = settings.lowfx ? 2 : 4; i < n; i++) particles.push({ x: r.x + rnd(-7, 7), y: r.y + 38, vx: rnd(-.9, .9), vy: rnd(3, 7), life: 16, max: 20, size: rnd(2.5, 6), color: pick(["#5fd4ff", "#ffffff", "#2a7bff", "#bfeaff", "#8a7dff"]), add: true });
    if (r.hardBrake && !spray && frame % 2 === 0) for (const sx of [-20, 20]) particles.push({ x: r.x + sx, y: r.y + 30, vx: rnd(-.4, .4), vy: rnd(.5, 1.4), life: 24, max: 40, size: rnd(4, 7), color: "rgba(210,210,210,0.45)" });
    if (r.v > 4.7 && frame % 2 === 0) {
      particles.push({ x: r.x + rnd(-5, 5), y: r.y + 34, vx: rnd(-1.6, 1.6), vy: rnd(.8, 2.6), life: 11, max: 20, size: rnd(1.4, 2.6), color: pick(["#ffb347", "#fff2a8", "#ff8c1a"]) });
    }
  }
  stepRacers();

  for (const k of pickups) {
    k.y += speed;
    if (k.type === "coin" && upLvl("magnet")) for (const r of racers) { // Magnet upgrade: coins in the next lane slide over to you
      const dy = r.y - k.y, dx = r.x - k.x;
      if (!r.ai && r.alive && dy > -20 && dy < 70 + 35 * upLvl("magnet") && Math.abs(dx) > 3 && Math.abs(dx) < LANE_W * 1.3) { k.x += dx * 0.14; break; }
    }
    if (k.type === "shield" && k.y > 0 && !seenKinds.includes("shield") && mode !== "tutorial") { seenKinds.push("shield"); store.set("seenKinds", seenKinds); say(NEW_KINDS.shield); }
    if (k.y < racers[0].y - 140) for (const e of enemies) if (e.lane === k.lane && Math.abs(k.y - e.y) < lenOf(e) / 2 + 55) { k.taken = k.gone = true; break; } // a pickup a vehicle is about to drive over just disappears: none is ever stuck inside a car
    for (const r of racers) {
      if (level && r.ai) continue; // the Grand Final CPU leaves pickups alone: a steady, readable rival
      if (r.ai && k.type === "curve") continue; // the bypass pop-up is yours: the CPU drives straight through it and leaves it there
      if (r.ai && k.type === "nitro" && (k.cpuSkip === undefined ? (k.cpuSkip = Math.random() < 0.5) : k.cpuSkip)) continue; // and it misses about half the nitros, so you can have them
      if (r.alive && Math.abs(k.x - r.x) < 26 && Math.abs(k.y - r.y) < 42) {
        collect(r, k); k.taken = true;
        if (k.type === "coin") burst(k.x, k.y, ["#ffd23f", "#fff3b0"], 8, 2.5);
        break;
      }
    }
  }
  const keepTo = mode === "vs" ? Math.max(H, ...racers.map(r => r.ai && r.alive ? r.y + 60 : 0)) : H; // in Vs the road you've passed stays until the CPU behind you has driven it too
  pickups = pickups.filter(k => !k.taken && k.y < keepTo + 20);
  if (grid.done) flowTraffic(); // queues form behind slower vehicles

  for (const e of enemies) {
    e.y += speed - (grid.done ? e.cur : 0); // the road scrolls at your speed; the car drives on at its own
    e.x += (laneX(e.lane) - e.x) * 0.06;
    if (e.kind !== "car" && mode !== "tutorial" && !seenKinds.includes(e.kind) && e.y + lenOf(e) / 2 + (e.kind === "works" ? SIGN_AHEAD : 0) > 0) { // first sighting ever
      seenKinds.push(e.kind); store.set("seenKinds", seenKinds); say(NEW_KINDS[e.kind]);
    }
    const reach = (lenOf(e) + CAR_H) / 2; // centre-to-centre distance at which it touches a car
    for (const r of racers) {
      if (!r.alive) continue;
      if (!e.passed[r.id] && e.y > r.y + reach) {
        e.passed[r.id] = true;
        if (e.kind !== "works") { // cones don't count as overtakes
          r.passed++; if (!r.ai) bump("cars");
          r.score += passPoints(r.v) * comboMult(r); // fast overtakes pay more, and the combo multiplies them
        }
        if (e.dodged && e.dodged[r.id]) nearMiss(r, e);
        else if (r.id === 0 && !r.ai && Math.abs(e.x - r.x) < LANE_W * 1.6) sound.passBy(Math.sign(e.x - r.x), false); // a softer whoosh as a car in the next lane goes by
      }
      let hitX = Math.abs(e.x - r.x) < CAR_W - 4, hitY = Math.abs(e.y - r.y) < reach - 6;
      if (e.passed[r.id] && e.y > r.y) hitY = false; // already behind you: it can never hit you
      if (r.bypassing) hitY = false;                 // on the bypass track you are beside the road, clear of everything
      if (r.through === e) { if (hitX && hitY) continue; if (e.passed[r.id]) r.through = null; } // driving on through a vehicle the shield saved you from: no second hit until you are out the other side
      if (hitX && hitY && r.ghost > 0) continue; // still flashing from a bump: no second hit
      if (r.trueY !== undefined && r.trueY !== r.y) continue; // the CPU is beyond the stretch of road that exists: nothing to hit there
      if (hitX && hitY && r.shield) { shieldBreak(r, e); continue; } // the shield takes it
      if (hitX && hitY && level && level.final && r.id === 1) { // the Grand Final CPU bumps off traffic instead of crashing: it loses speed and flashes for a second
        if (!(r.ghost > 0)) { r.v *= 0.6; r.ghost = 60; burst(r.x, r.y - 20, ["#ffffff", "#ffd23f"], 12, 3); }
        continue;
      }
      if (hitX && hitY && mode === "tutorial") { tutorialBump(r, e); continue; } // the test drive never ends in a crash: the lesson starts again
      if (hitX && hitY) {
        r.alive = false; r.drift = (r.x < e.x ? -1 : 1) * 1.5; r.wreckV = r.v; r.hitBy = e; r.yawV = (r.x < e.x ? -1 : 1) * rnd(0.16, 0.3) * clamp(r.v / 3, 0.5, 1.5); // the wreck keeps its momentum: it slides on and spins
        if (!r.ai) { bump("crashes"); flashT = settings.lowfx ? 0.35 : 0.75; hitStop = 5; } // white flash and a beat of freeze frame
        if (!settings.lowfx) { // a fireball, sparks flying and smoke rolling off
          glowBurst(r.x, r.y - 10, ["#fff4c2", "#ffd23f", "#ff9f1c", "#ff5a1f"], 46, 7, 34, [3, 8]);
          glowBurst(r.x, r.y - 10, ["#ffffff", "#ffe08a"], 30, 11, 22, [1.5, 3]);
          for (let i = 0; i < 26; i++) particles.push({ x: r.x + rnd(-14, 14), y: r.y + rnd(-20, 10), vx: rnd(-1.2, 1.2), vy: rnd(-1.5, 0.3), life: rnd(50, 90), max: 90, size: rnd(7, 14), color: pick(["rgba(40,40,44,0.55)", "rgba(70,70,76,0.5)", "rgba(30,30,32,0.6)"]) });
        }
        burst(r.x, r.y, [r.team.p, r.team.s, "#ff9f1c", "#ffd23f", "#444"], 40, 5.5);
        shake = 14;
      }
    }
  }
  enemies = enemies.filter(e => e.y - lenOf(e) / 2 < keepTo + CAR_H && e.y > -AHEAD - 400);

  if (mode === "tutorial") tutorialTick(); // the test drive: the lesson script runs instead of the game-over and finish-line checks
  else if (level ? !racers[0].alive : racers.some(r => !r.alive)) endRound(); // in the tour only your crash ends it (a crashed CPU is simply out)
  else if (finishObj && finishObj.y >= racers[0].y - CAR_H / 2) finishLevel(); // nose over the line
  else if (finishObj && level.final && racers[1].alive && finishObj.y >= (racers[1].trueY === undefined ? racers[1].y : racers[1].trueY) - CAR_H / 2) { result = "CPU won the final!"; endRound(true); } // beaten to the line
  if (racers[0].alive) racers[0].topV = Math.max(racers[0].topV || 0, racers[0].v);
  for (const r of racers) if (!r.ai && r.alive && grid.done) { // lifetime distance and top speed
    bump("km", r.v * KM_PER_UNIT);
    const kmh = Math.round(r.v * 60); if (kmh > stats.topSpeed) { stats.topSpeed = kmh; if (kmh >= 400) unlock("v400"); if (kmh >= 600) unlock("v600"); }
  }
  if (stats.km >= 100) unlock("km100");
  if (state === "playing") checkMissions(false);
  if (level && !level.daily && state === "playing") { // a little fanfare the moment a star target is beaten
    const tg = starTargets(level.idx), now = 1 + (racers[0].score >= tg[0]) + (racers[0].score >= tg[1]);
    if (now > (level.starNow || 1)) { level.starNow = now; say(`${now}-star score reached!`); sound.tone(880, 1760, 0.18, "triangle", 0.07); }
  }
}

// Crossed the finish line of a World Tour city
// the shield absorbs a crash: bounce off, lose the combo and some speed, and it shatters
function shieldBreak(r, e) {
  r.shield = false; r.combo = 0; r.comboT = 0;
  if (!r.ai) { bump("shields"); unlock("shield"); }
  r.v *= 0.9; r.ghost = 45; r.through = e || null; // you carry on through the vehicle (a lorry is long: no second hit until you are out the other side)
  burst(r.x, r.y - 10, ["#7fffff", "#ffffff", "#3ad0ff", "#bff6ff"], 60, 7);
  shake = Math.max(shake, 10);
  if (!r.ai) { sound.burst(0.35, 0.5, "highpass", 3000, 9000); sound.tone(900, 220, 0.3, "triangle", 0.08); pops.push({ r, text: "SHIELD!", t: 0 }); rumble(); }
}

function finishLevel() {
  state = "cleared"; overAt = performance.now(); sel = 0; toast = null; // nothing covering the results
  touch.gas = touch.brake = false;
  levelTime = (frame - grid.goFrame) / 60;
  level.bonus = Math.max(0, Math.round((SPEED_PAR - levelTime) * 4)); racers[0].score += level.bonus; // the quicker the finish, the bigger the bonus
  throwConfetti(ROUTE[level.idx].flag);
  if (level.daily) { saveStats(); saveDailyScore(racers[0].score); sound.silence(); sound.jingle(level.idx); burst(racers[0].x, racers[0].y - 40, ["#ffd23f", "#ffffff", "#3dff6e", "#5fd4ff"], 50, 6); return; } // no stars, unlocks or missions in the Daily
  const firstClear = level.idx + 1 > tourCleared;
  if (firstClear) { tourCleared = level.idx + 1; store.set("tourCleared", tourCleared); }
  const tg = starTargets(level.idx), got = 1 + (racers[0].score >= tg[0]) + (racers[0].score >= tg[1]);
  const prev = cityStars[level.idx] || 0;
  if (got > prev) { cityStars[level.idx] = got; store.set("stars", cityStars); }
  checkMissions(true);
  unlock("firstcity"); if (got === 3) unlock("3stars"); if (tourCleared >= 11) unlock("half"); if (level.final) unlock("champ");
  saveStats();
  starAnim = { got, prev, shown: 0, t: 0 };
  level.reward = 5 * got + (firstClear ? 10 : 0); // coins for finishing: 5 a star, plus 10 the first time
  wallet += level.reward; store.set("coins", wallet);
  sound.silence(); sound.jingle(level.idx);
  burst(racers[0].x, racers[0].y - 40, ["#ffd23f", "#ffffff", "#3dff6e", "#5fd4ff"], 50, 6);
}

