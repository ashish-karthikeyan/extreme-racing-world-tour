// ---------- state ----------

let state = "title"; // "title" | "menu" | "firsttime" (the test drive card) | "difficulty" | "garage" | "options" | "map" | "playing" | "paused" | "camera" | "over" ...
const leaveTitle = () => { // any key / click / tap / button (the title is filmed in the city, the menu stands in the studio: a light sweep covers the change)
  const to = () => openMenu(tutorialSeen() ? "menu" : "firsttime"); // (never played: the card offering the test drive comes first)
  if (window.R3D && typeof screenFx !== "undefined") { if (screenFx.busy) return; screenFx.go(() => { if (state === "title") to(); }); }
  else to();
  sound.ensure(); sound.tone(440, 880, 0.12);
};
let menuCar = 0, menuIntroT = -999, swipe = null; // the main menu carousel: eased position, when it opened (cards fly in), a swipe in progress
let mode = "single"; // "single" | "vs" | "multi"
let difficulty = "medium";
let racers, enemies, pickups, particles, scenery, roadItems, wx;
let frame, clock, speed, scroll, scrollPos, dist, sceneAcc, spawnAcc, pickupAcc, shake, tier, newBest, banner, lastStage, result;
let cityLeg = { idx: 0, d0: 0, d1: Infinity, t: 0, f0: 0, dc: 0 }, cityPrev = { idx: 0, d0: 0 }; // Endless / Vs: the city you're in and the one before it (see stages.js)
let pal, stageIdx = 0, stageFrac = 0, stA = null, stB = null, stBlend = 0, rainI = 0, wind = 0, wet = 0, camOff = 0, camRefY = 0, nitroFx = 0;
let curveAcc = 2600, bypassTrack = null, halfObj = null; // distance until the next bypass pop-up; the bypass side track (if one is running); the halfway gantry
let grid = null, startObj = null; // grid = the start-lights sequence, startObj = the start line + gantry (they scroll away once you're racing)
let level = null, finishObj = null, levelTime = 0; // World Tour: the city being raced ({ idx, d0, len }) and its finish line
let tourCleared = store.count("tourCleared", ROUTE.length); // how many cities of the tour are done, in order
let cityStars = store.get("stars", []); // best stars (0-3) per city

// ---- Daily Challenge: one city and one traffic pattern from today's date, the same for everyone ----
// Gameplay randomness (traffic, pickups) goes through grand(): Math.random normally, a seeded generator in the Daily.
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let grand = Math.random;
const grnd = (a, b) => a + grand() * (b - a), gpick = a => a[Math.floor(grand() * a.length)];
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const dailySeed = () => hashStr("extreme-racer " + dayKey());
const dailyCity = () => dailySeed() % ROUTE.length;
let daily = store.get("daily", { day: "", best: 0, streak: 0, last: "" }); // today's best score, and days in a row played
const dailyBest = () => daily.day === dayKey() ? daily.best : 0;
function markDailyPlayed() {
  const today = dayKey(), y = new Date(); y.setDate(y.getDate() - 1);
  if (daily.last === today) return;
  daily.streak = daily.last === dayKey(y) ? daily.streak + 1 : 1; daily.last = today;
  unlock("daily"); if (daily.streak >= 3) unlock("streak3");
  store.set("daily", daily);
}
function saveDailyScore(s) {
  if (daily.day !== dayKey()) { daily.day = dayKey(); daily.best = 0; }
  level.newBest = s > daily.best;
  if (level.newBest) daily.best = s;
  store.set("daily", daily);
}
let starAnim = null, uiFx = []; // CITY COMPLETE: stars popping in one by one, and their sparkle (screen-space particles)
// score needed for [2, 3] stars in each city, from how many cars it has (measured: ~77 + 0.85 per city):
// 2 stars = passing them all at ~240 km/h plus some coins; 3 stars = passing at 300+ km/h and chaining some near misses
const round10 = x => Math.round(x / 10) * 10;
const TOUR_K = LEVEL_LEN / 20000; // World Tour cities used to be 20000 long: the missions' counts grow with the length...
const starTargets = i => { const n = 77 + 0.85 * i, k = TOUR_K ** 1.5; return [round10(k * (2 * n + 60)), round10(k * (3.6 * n + 160))]; }; // ...and the score faster (measured: the extra road is driven faster, and a pass at speed is worth more)
// World Tour difficulty: early cities are roomy and relaxed, later ones busier with a higher minimum pace
function tourParams(i) {
  const k = clamp(i / (ROUTE.length - 2), 0, 1);
  return { gap: Math.round(250 - 85 * k), vmin: 1.2 + 2.1 * k }; // 250 -> 165 between cars; ~72 -> ~198 km/h floor
}
const FINAL_CPU = { ...DIFFS.hard, wander: false, speed: 4.7, miss: 0.01 }; // the Grand Final rival: Hard's reflexes, cruising at ~282 km/h
const totalStars = () => cityStars.reduce((a, s) => a + (s || 0), 0);
let sel = 0, overAt = 0, garageIdx = 0, garageSpin = 0 /* right stick in the Garage: spins the turntable */, mapIdx = 0, runStage = 0, startDist = 0, toast = null, padG = [0, 0], padB = [0, 0], hasPad = false, hasTouch = false;
const held = new Set();
const touch = { gas: false, brake: false, gasId: null, brakeId: null }; // ids = which finger is on which pedal
let steerHint = !store.get("steerHint", false), steerTaps = 0; // the first touch race shows where to tap to steer
// big thumb pads for touch screens: brake bottom-left, gas bottom-right, above the speedo and the pause button
function pedalRects() {
  const w = 74, h = 92, y = H - 64 - h;
  return { brake: { x: 8, y, w, h }, gas: { x: W - 8 - w, y, w, h } };
}
const inRect = (p, r, pad = 8) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

const newGrid = done => ({ t: 0, lit: 0, hold: -1, done, goFrame: done ? -1000 : -1 });
const aiGo = () => grid.done && frame >= grid.goFrame + AI_REACT;
function laneX(lane) { return ROAD_L + lane * LANE_W + LANE_W / 2; }
// popups ("toasts"): one stack under the score, three at a time, the rest wait. The same words are never shown twice in a row:
// a message already up (or shown in the last 30 s) is dropped; a keyed one (camera, controller) replaces its own earlier toast instead.
let toasts = []; const toastSeen = new Map();
function say(text, opt = {}) {
  if (window.__recordingRun) return; // store clip captures keep transient messages off the car
  const now = performance.now();
  if (opt.key) { const old = toasts.find(t => t.key === opt.key); if (old) { old.text = text; old.t = Math.min(old.t, 8); return; } }
  else { if (toasts.some(t => t.text === text) || now - (toastSeen.get(text) || -1e9) < 30000) return; toastSeen.set(text, now); }
  const col = /^ACHIEVEMENT/.test(text) ? "#ffd23f" : /^Mission complete/.test(text) ? "#7cfc9a" : opt.col;
  toasts.push({ text, t: 0, life: opt.life || 170, key: opt.key, col });
}

// ---- lifetime stats and achievements ----
let stats = Object.assign({ km: 0, cars: 0, nearMisses: 0, bestCombo: 0, topSpeed: 0, crashes: 0, races: 0, coins: 0, shields: 0 }, store.get("stats", {}));
let statsDirty = false;
const saveStats = () => { if (statsDirty) { store.set("stats", stats); statsDirty = false; } };
const bump = (k, n = 1) => { stats[k] += n; statsDirty = true; };
const ACHIEVEMENTS = [
  { id: "firstcity", name: "Passport Stamped", desc: "Finish your first city" },
  { id: "close", name: "Close Shave", desc: "Pull off a near miss" },
  { id: "near10", name: "Hair's Breadth", desc: "10 near misses in one run" },
  { id: "combo5", name: "Combo Artist", desc: "Reach a x5 combo" },
  { id: "combo10", name: "Chain Reaction", desc: "Reach a x10 combo" },
  { id: "v400", name: "Speed Demon", desc: "Hit 400 km/h" },
  { id: "v600", name: "Ludicrous Speed", desc: "Hit 600 km/h" },
  { id: "coins500", name: "Coin Hoarder", desc: "Collect 500 coins in total" },
  { id: "shield", name: "Bubble Wrapped", desc: "Let a shield save you" },
  { id: "3stars", name: "Hat-Trick", desc: "Earn 3 stars in a city" },
  { id: "half", name: "Globetrotter", desc: "Clear 11 cities" },
  { id: "champ", name: "World Champion", desc: "Win the Grand Final" },
  { id: "km100", name: "Long Hauler", desc: "Drive 100 km in total" },
  { id: "nitro3", name: "Rocket Fuel", desc: "Grab 3 nitros in one run" },
  { id: "react", name: "Perfect Launch", desc: "Full revs when the lights go green" },
  { id: "maxup", name: "Fully Loaded", desc: "Max out an upgrade" },
  { id: "daily", name: "Early Bird", desc: "Play a Daily Challenge" },
  { id: "streak3", name: "On a Roll", desc: "3-day Daily streak" },
];
let achieved = store.get("achievements", []);
function unlock(id) {
  if (achieved.includes(id)) return;
  achieved.push(id); store.set("achievements", achieved);
  const a = ACHIEVEMENTS.find(x => x.id === id);
  say(`ACHIEVEMENT: ${a.name}`); sound.tone(784, 1568, 0.35, "triangle", 0.08); sound.tone(1175, 2350, 0.3, "sine", 0.05, 0.12);
}
const KM_PER_UNIT = 1 / 3600; // 1 unit per frame is 60 km/h, so a unit of road is 1/3600 km (a tour city is ~9.4 km)
const runKm = () => ((dist - startDist) * KM_PER_UNIT).toFixed(1); // distance covered this run (not counting where you jumped in)
const view3D = () => (state === "playing" || state === "over" || state === "cleared" || state === "paused" || state === "camera") ? cam : 0;

