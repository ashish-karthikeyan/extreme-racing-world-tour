// ---------- world setup ----------

function makeRacer(i, opts) {
  const lane = i === 0 ? 1 : 2, y = H - 100 + (i === 0 ? 0 : 44); // first car on pole in the middle, the second one row back
  return Object.assign({
    id: i, label: "", ai: null, team: TEAMS[0],
    lane, x: laneX(lane), y, ty: y, slot: { lane, off: i === 0 ? 0 : 44 },
    v: 0, rev: 0, launched: false, braking: false, tilt: 0, alive: true, score: 0, passed: 0, coins: 0, nitro: 0, rolling: false,
    fromLane: lane, lastMove: -99, nextThink: 0, drift: 0, deadT: 0,
  }, opts);
}

function initWorld() {
  enemies = []; pickups = []; particles = []; scenery = []; roadItems = []; wx = [];
  frame = 0; clock = 0; speed = 2; scroll = 2; scrollPos = 0; dist = 0; sceneAcc = 0; spawnAcc = 0; pickupAcc = 600; curveAcc = 2600; bypassTrack = null; halfObj = null;
  grid = newGrid(true); startObj = null; level = null; finishObj = null; starAnim = null; uiFx = []; grand = Math.random; confetti = []; flashT = 0; hitStop = 0; setCity(0, 0);
  shake = 0; sprayFog = 0; pops = []; slowT = 0; kickFx = 0; sprayCar = null; tier = 0; newBest = false; banner = null; lastStage = 0; wet = 0; result = ""; camOff = 0;
  updateStage();
  camRefY = H - 100; nitroFx = 0;
  for (let y = -AHEAD; y < H + 40; y += 55) spawnScenery(y);
}

const TITLE_CITY = 19; // Las Vegas: the title and menus are set at night, in neon
// the title scene: your car racing through Las Vegas at night (on its own, driven by the autopilot in gameplay.js)
function initDemo() {
  initWorld(); jumpTo(TITLE_CITY, 0.1); // (on the title the city never ends: see updateStage and the city builder)
  const y = H - 100; racers = [makeRacer(0, { team: TEAMS[equipped], ai: DEMO_AI, lane: 1, x: laneX(1), y, ty: y, v: state === "title" ? DEMO_AI.cruise : DEMO_AI.menu, fromLane: 1, rolling: true })]; // your car, on its own, driven by the autopilot (what the title camera films)
  seedDemoTraffic();
}

// the rival drives the top team (Aurora); if you're in Aurora or the similar purple Nightjar, it brings the hot pink Stratos
function rivalTeam() { return TEAMS[equipped === 10 || equipped === 1 ? 8 : 10]; }

// jump the world to the start of a given city (the World Tour map previews the selected city behind it)
function jumpTo(i, frac = 0) {
  dist = STAGE_LEN * (i + frac); setCity(i, STAGE_LEN * i);
  updateStage();
  scenery = [];
  for (let y = -AHEAD; y < H + 40; y += 55) spawnScenery(y);
}

function startGameNow(m, d, stage = 0) { // (startGame, in the menus, asks for tyres first and then calls this)
  mode = m;
  if (d) difficulty = d;
  initWorld();
  runStage = stage;
  if (m === "daily") { grand = mulberry32(dailySeed()); markDailyPlayed(); } // today's pattern, from the top every time
  if (m === "tour" || m === "daily") level = { idx: stage, d0: 0, len: LEVEL_LEN, daily: m === "daily" };
  if (stage) jumpTo(stage);
  startDist = dist;
  if (level) { level.d0 = dist; updateStage(); }
  lastStage = stageIdx;
  racers = [makeRacer(0, { label: m === "single" || m === "tour" || m === "daily" ? "" : m === "vs" ? "YOU" : "P1", team: TEAMS[equipped], tyre: tyreChoice })];
  if (m === "vs") racers.push(makeRacer(1, { label: "CPU", team: rivalTeam(), ai: DIFFS[difficulty] }));
  if (m === "multi") racers.push(makeRacer(1, { label: "P2", team: rivalTeam() }));
  if (m === "tour" && stage === ROUTE.length - 1) { // Grand Final: first to the line wins
    level.final = true; racers[0].label = "YOU";
    racers.push(makeRacer(1, { label: "CPU", team: rivalTeam(), ai: FINAL_CPU }));
  }
  if ((m === "single" || m === "tour" || m === "daily") && Math.random() < 0.12 * upLvl("shield")) racers[0].shield = true; // Shield upgrade: sometimes you start protected
  for (const r of racers) if (r.ai) r.tyre = bestTyre(cityWetness(ROUTE[stage % ROUTE.length])); // the CPU always picks the right tyre for the day
  if (racers[1] && !racers[1].ai) racers[1].tyre = tyreChoice; // (player 2 shares the choice)
  grid = newGrid(false); startObj = { y: H - 100 - 50 }; // cars sit on the grid behind the start line, under the lights
  seedTraffic(-260);
  spawnPickup(-450, true); // one nitro canister up the road
  state = "playing"; bump("races");
  startBanner(stageIdx, true);
  sound.ensure();
}

function openMenu(s, index = 0) { if (s === "menu" && state !== "menu") { menuIntroT = clock; menuCar = index; } state = s; sel = index; }
function toMenu() { saveStats(); initDemo(); openMenu("menu"); }
function pause() { if (state === "playing") { openMenu("paused"); touch.gas = touch.brake = false; saveStats(); } }
function openCamera() { if (state === "playing") { openMenu("camera", cam); touch.gas = touch.brake = false; } }
function startBanner(i, quiet) {
  banner = { idx: i, t: 0 }; if (!quiet) sound.jingle(i);
  const st = ROUTE[i]; // these cities drive differently: say so on arrival
  if (!grid || !grid.done) return; // (at the start of a race the tyre screen has said it already: only a city reached mid-run is announced)
  if (st.rain > 0.3) say("Wet road: the right tyres matter - check your grip");
  else if (st.night > 0.15) say("Night: distant cars show only tail lights");
}

