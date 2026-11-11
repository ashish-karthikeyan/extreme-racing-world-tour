// ---------- the TEST DRIVE: a short tutorial you play, one small thing at a time ----------
// It is a real race (same car, physics, traffic and HUD) in mode "tutorial", in Tokyo at sunset. Nothing on the road is random: a script of
// lessons puts every car and pickup exactly where the lesson needs it. Each lesson in LESSONS is a small object:
//   start(r)  sets the lesson up (r = your car), e.g. one slow car well ahead in your lane
//   step(r)   runs every tick (60 a second) and returns true once you have done the thing
//   say(r)    the one short instruction to show: [prompt, words, touch words] (see MSG)
//   bump(r)   (optional) what a crash does in this lesson; without it the lesson simply starts again
// The engine below runs the current lesson: when step() says it is done you get a tick, a sound and +5 coins, and the next lesson starts
// straight away. gameplay.js calls three hooks: tutorialDrive (after the pedals: the 300 km/h limit and pulling up at the start line),
// tutorialBump (instead of a crash) and tutorialTick (instead of the game-over and finish-line checks). hud.js draws it (drawTutorialHud).

const TUT_CITY = 2;          // Tokyo (drawn at sunset by the 3D renderer while the test drive is on)
const TUT_VMAX = 5;          // 300 km/h: the test drive's limit outside nitro and bypasses, so every lesson stays easy to read
const TUT_V = 80 / 60;       // the lessons' traffic drives at 80 km/h
const FOLLOW_LOCK = 380;     // a lesson car moves into your lane while it is further ahead than this, then stays put (see followLanes)
const LESSON_COINS = 5;      // paid for each lesson done
const TUT_BONUS = 100;       // paid at the finish, the first time only
const FINAL_LEN = 7500;      // the final test's road to the finish line (~25 s)
const STOP_DECEL = 0.04;     // pulling up at the start line: speed lost per tick (300 km/h to a stop in ~2 s)

// tut: everything about the test drive in progress. i = which lesson (0-based), t = ticks in this lesson, phase / n = the lesson's own progress
const tut = { on: false, i: 0, t: 0, phase: 0, n: 0, cur: null, van: null, lane: 0, nm0: 0, items: [], stopV: 0, gantryAt: 0, finishD: 0,
  acc: 0, pacc: 0, doneT: 0, againT: 0, againMsg: null, word: 0, result: null };

// ---- the words. [prompt, words, words on a touch screen]: the prompt is an action from devices.js (drawn as the key / button you use) ----
const MSG = {
  gas: ["gas", "Hold GAS to go"], brake: ["brake", "BRAKE to slow down"],
  lanes: ["steer", "Switch lanes", "Tap the left or right side of the screen"],
  dodge: [null, "Dodge the traffic"], truck: [null, "Trucks are longer, give them room"],
  close: [null, "Pass close to cars for a CLOSE! bonus"], chain: [null, "Keep chaining them: the combo multiplies your points"],
  coins: [null, "Grab coins, they buy new cars in the Garage"], nitro: [null, "Drive through nitro for a boost"],
  shield: [null, "Grab the shield"], shieldHit: [null, "A shield saves you from one crash"],
  arrow: [null, "Drive over the blue arrow"],
  outL: ["left", "Steer out now to curve round the car", "Tap LEFT now to curve round the car"],
  outR: ["right", "Steer out now to curve round the car", "Tap RIGHT now to curve round the car"],
  launch: ["launch", "Hold GAS + BRAKE together, let go in the GREEN", "Hold GAS + BRAKE, let go in the GREEN"],
  again: [null, "Try again"], againLaunch: [null, "Try again: let go in the GREEN"],
};
const DONE_WORDS = ["Nice!", "Great!", "Got it!", "Perfect!", "Smooth!"];

// ---- placing things on the road (ahead = how far up the road from your car) ----
const TUT_MODELS = ["sedan", "hatch", "suv", "taxi", "coupe"];
function tutCar(lane, ahead, o = {}) {
  const r = racers[0], truck = !!o.truck, len = truck ? TRUCK_LEN : CAR_H, v = (o.kmh || 80) / 60;
  const e = { kind: truck ? "truck" : "car", model: o.model || (truck ? "box" : pick(TUT_MODELS)), lane, x: laneX(lane), y: r.y - ahead - (len - CAR_H) / 2, len, v, cur: v,
    col: pick(ROAD_COLS), passed: {}, miss: {}, follow: o.follow !== false, lock: o.lock || FOLLOW_LOCK };
  enemies.push(e); return e;
}
function tutPickup(type, lane, ahead) { const k = { type, lane, x: laneX(lane), y: racers[0].y - ahead }; pickups.push(k); return k; }
const sideLane = r => r.lane === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1; // a lane next to yours, so you have to steer for it
const spawnAhead = r => clamp((r.v - TUT_V) * 170, 560, 900); // about 3 s away at your speed (never so close that it pops up in front of you)
const missed = k => k.gone || (!k.taken && k.y > racers[0].y + 40); // a pickup that went past you (or under a car)

// A lesson car slides into your lane while it is still far up the road, then keeps its lane. So "dodge the car in your lane" always has a
// car in your lane, whichever lane you were in when it appeared. (Real traffic never changes lane; this is only in the test drive.)
function followLanes(r) {
  if (r.bypassing) return;
  for (const e of enemies) {
    if (!e.follow) continue;
    if (r.y - e.y < e.lock) e.follow = false; // close now: it stays where it is
    else if (e.lane !== r.lane) e.lane = r.lane; // (its x eases across, so it drifts over smoothly)
  }
}

// ---- the lessons, in order ----
const LESSONS = [
  { name: "Drive", // hold the gas up to ~200 km/h, then brake for a moment
    start() {},
    say() { return tut.phase === 0 ? MSG.gas : MSG.brake; },
    step(r) {
      if (tut.phase === 0) { if (r.v * 60 >= 198) tut.phase = 1; return false; }
      if (pedals(r).brake > 0.5) tut.n++;
      return tut.n >= 12; // a fifth of a second on the brake
    } },
  { name: "Lanes", count: 3, // change lane three times
    start(r) { tut.lane = r.lane; },
    say() { return MSG.lanes; },
    step(r) {
      if (r.lane !== tut.lane) { tut.lane = r.lane; tut.n++; if (tut.n < 3) tickSound(tut.n); }
      if (tut.n >= 3 && hasTouch && steerHint) { steerHint = false; store.set("steerHint", true); } // (learnt here: the first touch race needn't show where to tap)
      return tut.n >= 3;
    } },
  { name: "Dodge", count: 3, // three slow cars, one at a time, then a truck
    start(r) { tut.items.length = 0; tut.items.push(tut.cur = tutCar(r.lane, spawnAhead(r))); },
    say() { return tut.phase === 0 ? MSG.dodge : MSG.truck; },
    step(r) {
      let passed = 0; for (const e of tut.items) if (e.passed[0]) passed++;
      if (passed > tut.n) { tut.n = passed; if (passed < 3) tickSound(passed); }
      if (passed >= 3) tut.phase = 1; // three cars behind you: now the truck
      if (r.y - tut.cur.y < 220 && tut.items.length < 4) tut.items.push(tut.cur = tutCar(r.lane, spawnAhead(r), tut.items.length === 3 ? { truck: true, kmh: 60 } : undefined)); // the last one is close: the next appears up the road
      return tut.items.length === 4 && passed === 4; // the truck is behind you too
    } },
  { name: "Near miss", // a steady line of cars in your lane: wait until one is close, then dodge (CLOSE!), and chain them to x3
    start(r) { tut.nm0 = r.nm || 0; r.combo = 0; r.comboT = 0; tut.cur = null; },
    say() { return tut.phase === 0 ? MSG.close : MSG.chain; },
    step(r) {
      const gap = clamp((r.v - TUT_V) * 110, 260, 420); // closer together when you are slow, so the next one comes before the combo runs out
      if (!tut.cur || r.y - tut.cur.y < 950 - gap) { tut.cur = tutCar(r.lane, 950, { lock: 330 }); tut.n++; }
      if (tut.phase === 0 && (r.nm || 0) > tut.nm0) tut.phase = 1;
      return (r.combo >= 3 && r.comboT > 0) || (tut.phase === 1 && tut.n > 16) || tut.n > 24; // x3, or (after plenty of tries) at least one CLOSE!, or (after more) on anyway
    } },
  { name: "Coins", // a line of coins in the next lane
    start(r) { const lane = sideLane(r); tut.items.length = 0; for (let i = 0; i < 6; i++) tut.items.push(tutPickup("coin", lane, 820 + i * 45)); },
    say() { return MSG.coins; },
    step(r) {
      let got = 0, ahead = 0;
      for (const k of tut.items) { if (k.taken && !k.gone) got++; else if (!missed(k)) ahead++; }
      if (got >= 4 || (ahead === 0 && got >= 2)) return true;
      if (ahead === 0) LESSONS[tut.i].start(r); // missed the line: here comes another
      return false;
    } },
  { name: "Nitro", // drive through a canister and feel the boost
    start(r) { tut.cur = tutPickup("nitro", sideLane(r), 820); },
    say() { return MSG.nitro; },
    step(r) {
      if (tut.phase === 0) { if (r.nitro > 0) { tut.phase = 1; tut.n = 0; } else if (missed(tut.cur)) tut.cur = tutPickup("nitro", sideLane(r), 820); return false; }
      return ++tut.n > 130; // two seconds of the boost before the next lesson
    } },
  { name: "Shield", // grab a shield, then a wall of cars you cannot get round: the shield takes the hit
    start(r) { r.shield = false; tut.cur = tutPickup("shield", sideLane(r), 820); },
    say() { return tut.phase === 0 ? MSG.shield : MSG.shieldHit; },
    step(r) {
      if (tut.phase === 0) {
        if (r.shield) { tut.phase = 1; for (let l = 0; l < LANES; l++) tutCar(l, 800, { kmh: 60, follow: false }); }
        else if (missed(tut.cur)) tut.cur = tutPickup("shield", sideLane(r), 820);
        return false;
      }
      if (tut.phase === 1 && !r.shield) { tut.phase = 2; tut.n = 0; } // it broke: you drove on through
      return tut.phase === 2 && ++tut.n > 40;
    } },
  { name: "Bypass", // the arrow in an outside lane, a slow van ahead in that lane: steer out and curve round it
    start(r) {
      tut.lane = r.lane === LANES - 1 ? LANES - 1 : 0; tut.cur = tutPickup("curve", tut.lane, 620);
      if (!tut.van || !enemies.includes(tut.van) || r.y - tut.van.y < 700) tut.van = tutCar(tut.lane, 1080, { model: "van", kmh: 60, follow: false });
    },
    say() { return tut.phase === 0 ? MSG.arrow : tut.lane === 0 ? MSG.outL : MSG.outR; },
    step(r) {
      if (tut.phase === 0) { if (r.bypass) tut.phase = 1; else if (missed(tut.cur)) LESSONS[tut.i].start(r); return false; } // (missed the arrow: another one)
      if (tut.phase === 1) { if (r.bypassing) tut.phase = 2; else if (!r.bypass) { tut.phase = 0; LESSONS[tut.i].start(r); } return false; } // (moved away or waited too long)
      return !r.bypassing; // back on the road: done
    },
    bump() { tut.van = null; restartLesson(); } },
  { name: "Launch", // pull up at a start line; hold gas + brake, let go with the needle in the green (or orange)
    start(r) { pullUp(r); },
    say() { return tut.phase === 0 || tut.phase === 3 ? null : MSG.launch; },
    step(r) {
      if (tut.phase === 0) return false; // still pulling up (tutorialDrive brings the car to a stop at the line and sets the grid)
      if (tut.phase === 1) { // on the grid, then the launch
        if (!grid.done || !r.launched || r.launchGoal) return false;
        if (!r.launchZone) pops.push({ r, text: "SLOW START! 100", t: 0 }); // (gas alone after the green: the plain start)
        const z = r.launchZone || LAUNCH_ZONES[2];
        tut.n = 0; tut.phase = z === LAUNCH_ZONES[2] ? 3 : 2;
        if (tut.phase === 3) { tut.againT = 110; tut.againMsg = MSG.againLaunch; }
        return false;
      }
      if (tut.phase === 2) return ++tut.n > 50; // green or orange: done
      if (++tut.n > 70) pullUp(r); // red: once more
      return false;
    } },
  { name: "Final test", // a short race to a finish line: mixed traffic and pickups, no instructions
    start(r) { tut.finishD = dist + FINAL_LEN; tut.acc = 0; tut.pacc = 300; seedTraffic(r.y - 650); },
    say() { return null; },
    step(r) {
      if ((tut.acc += speed) >= 260) { tut.acc -= 260; spawnEnemy(); } // the same traffic and pickups as a real race, a little roomier
      if ((tut.pacc -= speed) <= 0) { spawnPickup(); tut.pacc = grnd(520, 960); }
      if (!finishObj && tut.finishD - dist < AHEAD - 100) finishObj = { y: r.y - (tut.finishD - dist) }; // the line appears up the road
      return !!finishObj && finishObj.y >= r.y - CAR_H / 2; // nose over the line
    },
    bump() { // a crash here doesn't start the race again: you lose some speed and the road just ahead is cleared
      const r = racers[0]; enemies = enemies.filter(e => r.y - e.y > 420 || e.y > r.y + 60);
    } },
];
const LAUNCH_LESSON = LESSONS.findIndex(L => L.name === "Launch");

// ---- the engine ----
function startTutorial(first = 1) { // first = the lesson to begin at (1 = Drive ... 10 = the final test)
  mode = "tutorial"; state = "playing"; initWorld(); runStage = TUT_CITY; // (state first: the city is worked out for a race, not the title)
  jumpTo(TUT_CITY); startDist = dist; lastStage = stageIdx; banner = null;
  racers = [makeRacer(0, { team: TEAMS[equipped], tyre: "dry" })]; // (initWorld left the grid "done": no start lights, you set off when the first lesson says so)
  tut.on = true; tut.result = null; tut.doneT = 0; tut.againT = 0; tut.van = null; tut.word = 0;
  const r = racers[0], i = clamp(Math.round(first) - 1, 0, LESSONS.length - 1);
  cam = 1; // the test drive is shown from the Chase camera (not saved: leaving it goes back to your own camera)
  if (i > 0) { r.v = 4; r.launched = r.rolling = true; } // (jumping in later: already rolling at 240 km/h)
  sound.ensure();
  startLesson(i);
}
function startLesson(i) {
  const r = racers[0];
  for (const e of enemies) e.follow = false; // the last lesson's cars stay where they are
  tut.i = i; tut.t = 0; tut.phase = 0; tut.n = 0; tut.cur = null;
  LESSONS[i].start(r);
}
function restartLesson() { // after a crash (or "Restart" in the pause menu): an empty road and the lesson from the top
  enemies = []; pickups = []; bypassTrack = null;
  const r = racers[0]; r.bypass = null; r.bypassing = false; r.bypassX = undefined; r.x = laneX(r.lane);
  if (tut.i === LAUNCH_LESSON) { pullUp(r); return; }
  startLesson(tut.i);
}
function lessonDone() {
  const r = racers[0];
  if (tut.i < LESSONS.length - 1) { // (the final test has its own ending)
    r.coins += LESSON_COINS; tut.doneT = 42; tut.againT = 0; tut.word = (tut.word + 1) % DONE_WORDS.length;
    pops.push({ r, text: `+${LESSON_COINS}`, t: 0, col: "#ffd23f" });
    sound.tone(660, 990, 0.12, "triangle", 0.07); sound.tone(990, 1480, 0.16, "triangle", 0.06, 0.09); sound.coin();
  }
  if (tut.i + 1 < LESSONS.length) startLesson(tut.i + 1); else finishTutorial();
}
const tickSound = n => sound.tone(620 + n * 140, 760 + n * 140, 0.07, "triangle", 0.05); // one of three done

// every tick, after the cars have moved (from updatePlaying): run the lesson
function tutorialTick() {
  const r = racers[0];
  tut.t++; if (tut.doneT > 0) tut.doneT--; if (tut.againT > 0) tut.againT--;
  followLanes(r);
  if (LESSONS[tut.i].step(r)) lessonDone();
}
// after the pedals, before the road moves (from updatePlaying): the speed limit, and pulling up at the start line in the Launch lesson
function tutorialDrive(r) {
  if (tut.i === LAUNCH_LESSON && tut.phase === 0) {
    tut.stopV = Math.max(0, tut.stopV - STOP_DECEL); r.v = tut.stopV; r.rolling = false; r.braking = true;
    if (!startObj && tut.gantryAt) startObj = { y: r.y - (tut.gantryAt - dist) }; // (the start line appears a tick after the old one went)
    if (tut.stopV === 0) setGrid(r);
    return;
  }
  if (r.cruise !== undefined) r.cruise = Math.min(r.cruise, TUT_VMAX); // (after a nitro you settle back to the limit, not above it)
  if (r.v > TUT_VMAX && !(r.nitro > 0) && !r.bypassing && r.cruise === undefined) r.v = Math.max(TUT_VMAX, r.v - 0.06); // the limiter
}
function pullUp(r) { // the Launch lesson: brake to a stop with the start line just ahead
  enemies = []; pickups = []; r.nitro = 0; r.cruise = undefined; r.bypass = null;
  tut.phase = 0; tut.n = 0; tut.stopV = r.v; startObj = null;
  tut.gantryAt = dist + r.v * r.v / (2 * STOP_DECEL) + 50; // where the car will stop, plus the gap to the line
}
function setGrid(r) { // stopped: the start lights begin, and the launch is yours again
  startObj = { y: r.y - 50 }; tut.gantryAt = 0;
  Object.assign(r, { v: 0, launched: false, launchLocked: false, launchGoal: 0, launchZone: null, charging: false, needleT: 0, needle: 0, rolling: false, braking: false });
  grid = newGrid(false); tut.phase = 1;
}
// a crash (from the collision check in updatePlaying): no game over, the car flashes and the lesson starts again
function tutorialBump(r) {
  r.ghost = 100; r.v = Math.max(PLAYER_MIN_V, r.v * 0.7); r.combo = 0; r.comboT = 0;
  shake = Math.max(shake, 9); flashT = settings.lowfx ? 0.2 : 0.35; sound.thud(); rumbleSoft();
  burst(r.x, r.y - 20, ["#ffffff", "#ffd23f", r.team.p], 24, 4);
  tut.againT = 80; tut.againMsg = MSG.again;
  const L = LESSONS[tut.i]; if (L.bump) L.bump(r); else restartLesson();
}
function tutorialRestart() { // the pause menu's "Restart lesson" (and R / X while paused)
  const r = racers[0]; if (!r.alive) return;
  r.v = tut.i === 0 ? 0 : Math.max(r.v, 3.33); r.launched = r.rolling = tut.i > 0; r.ghost = 0;
  if (tut.i === 0) { r.launchGoal = 0; tut.phase = 0; tut.n = 0; } else restartLesson();
  state = "playing";
}

// over the finish line: YOU'RE READY! The coins are paid the first time only (so the test drive can't be farmed)
function finishTutorial() {
  const r = racers[0], first = !store.get("tutorialDone", false), earned = first ? r.coins + TUT_BONUS : 0;
  state = "cleared"; overAt = performance.now(); sel = 0; touch.gas = touch.brake = false;
  if (first) { wallet += earned; store.set("coins", wallet); store.set("tutorialDone", true); }
  store.set("tutorialSeen", true);
  tut.result = { earned, bonus: first ? TUT_BONUS : 0, first, score: r.score };
  saveStats(); throwConfetti(ROUTE[TUT_CITY].flag); sound.silence(); sound.jingle(TUT_CITY);
  burst(r.x, r.y - 40, ["#ffd23f", "#ffffff", "#3dff6e", "#5fd4ff"], 50, 6);
}
// leaving: Skip (any time), or LET'S RACE on the finish screen. Then the race you picked (if the card came up before one), or the menu
function leaveTutorial() {
  store.set("tutorialSeen", true);
  const next = afterTutorial; afterTutorial = null;
  sceneFx(() => { tut.on = false; mode = "single"; cam = savedCam(); touch.gas = touch.brake = false; if (next) { state = "menu"; next(); } else toMenu(); }); // (state "menu" first: from there the race's tyre screen opens straight away)
}
