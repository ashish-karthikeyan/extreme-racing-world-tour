const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// the tab icon, drawn here so the game stays a single file: a yellow race car from above on a dark tile, with a speed streak
(function makeFavicon() {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), box = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    g.fillStyle = "#16171c"; g.beginPath(); g.roundRect ? g.roundRect(0, 0, 64, 64, 14) : g.rect(0, 0, 64, 64); g.fill();
    box(6, 40, 12, 4, "#ff7a1a"); box(2, 48, 10, 3, "#ff7a1a"); // speed streaks
    for (const [x, y] of [[17, 13], [41, 13], [17, 39], [41, 39]]) box(x, y, 7, 13, "#0a0a0c"); // tyres
    box(19, 6, 26, 5, "#ffe11a"); box(18, 52, 28, 5, "#ffe11a"); // front and rear wings
    g.fillStyle = "#ffe11a"; g.beginPath(); g.moveTo(29, 8); g.lineTo(35, 8); g.lineTo(39, 34); g.lineTo(37, 54); g.lineTo(27, 54); g.lineTo(25, 34); g.closePath(); g.fill(); // body
    box(30, 26, 4, 12, "#141416"); g.fillStyle = "#141416"; g.beginPath(); g.arc(32, 32, 4, 0, Math.PI * 2); g.fill(); // cockpit and helmet
    document.getElementById("favicon").href = c.toDataURL("image/png");
  } catch (e) {}
})();

const VERSION = "1.0.0";
let W = 400, H = 480; // the width stretches to fit your screen; on a portrait phone the height grows instead
let ROAD_L = 40; const ROAD_W = 320; let ROAD_R = ROAD_L + ROAD_W; // grass verges either side of the road, always centred
const LANES = 3, LANE_W = ROAD_W / LANES, CAR_W = 36, CAR_H = 72;
const SPAWN_PX = 220;      // distance between traffic spawns at the start (shrinks as you progress)
const GRID_STEP = 55;      // frames between the five red start lights coming on (~0.9s each)
const AI_REACT = 6;        // the CPU pulls away exactly 6 frames = 0.100s after the lights turn green
const CITY_SECS = 75;      // Endless and Vs Computer: each city lasts about this long (seconds of driving), however fast you go
const CITY_AHEAD = 22000;  // how far ahead of the car the 3D city is ever built (the furthest preset: ~20100): a city's end is pinned no nearer than this
const STAGE_LEN = 7200;    // where each city starts when the game jumps straight to it (a run started in city N, the World Tour map's preview)
const LEVEL_LEN = 34000;   // World Tour: one city is one level (~60 s flat out from a perfect launch, ~90 s driving carefully)
const VMAX = 5.5;          // CPU top speed (x60 = km/h); the player has no cap
const NITRO_MAX = VMAX * 1.3;  // where the speed dial needle tops out
const NITRO_PUSH = 2.2;        // how far above your normal speed nitro can push you (~130 km/h)
// throttle pull at speed v, per frame: ~60 km/h per second off the line, fading like air drag does
// (0-100 in ~1.8s, 0-300 in ~7s), but never below 6 km/h per second, so holding on always gains speed
const accelAt = v => Math.max(60 / (1 + (v * 60 / 250) ** 3), 6) / 3600;
const NITRO_FRAMES = 200;      // nitro burn time (~3.3s)
const AHEAD = 1000;        // how far up the road traffic, coins and scenery exist, so the 3D views see an endless road
const TAU = Math.PI * 2;


// ---- traffic: what is on the road, and how fast each thing drives (km/h; the game uses km/h / 60 per frame) ----
// [model, km/h, how common]. Ordinary cars cruise at about 100; the sporty-looking ones are a little quicker, vans and taxis a little slower;
// lorries and buses are slow. The models are the ones the 3D renderer draws (js/render3d/car/traffic.js).
const CAR_MODELS = [["sedan", 100, 3], ["hatch", 95, 3], ["suv", 105, 2], ["van", 85, 1.2], ["taxi", 90, 0.8], ["coupe", 122, 0.9]];
const TRUCK_MODELS = [["box", 60, 0.4], ["container", 60, 0.25], ["tanker", 55, 0.15], ["bus", 65, 0.2]];
const PLAYER_MIN_V = 2.2;  // the slowest you can ever be rolling: ~130 km/h, so ordinary traffic never drives up behind you
const LAUNCH_ZONES = [ // the start-line rev needle: where it is (0..1) -> what you get. The needle sweeps up and down; release in the green.
  { name: "PERFECT", from: 0.72, to: 0.88, v: 5, color: "#39ff6a" },     // 300 km/h
  { name: "GOOD", from: 0.5, to: 0.95, v: 3.33, color: "#ffb020" },       // 200 km/h
  { name: "SLOW", from: 0, to: 1, v: 1.67, color: "#ff4040" },            // 100 km/h
];
const launchZoneOf = n => n >= 0.72 && n < 0.88 ? LAUNCH_ZONES[0] : (n >= 0.5 && n < 0.95) ? LAUNCH_ZONES[1] : LAUNCH_ZONES[2];

// ---- tyres: dry slicks, intermediates, full wets. How wet a city is (0..1) decides which one grips best. ----
const TYRES = [
  { key: "dry", name: "DRY", sub: "Slicks", band: "#ffd21a", blurb: "Maximum grip on a dry road. Slides about in the rain." },
  { key: "inter", name: "INTERMEDIATE", sub: "For drizzle", band: "#39c46a", blurb: "Copes with a damp road. Fine in a drizzle, a bit soft when dry." },
  { key: "wet", name: "WET", sub: "Full wets", band: "#2a7bff", blurb: "Cuts through standing water. Overheats and wanders on a dry road." },
];
const cityWetness = st => clamp(((st && st.rain) || 0) / 0.7, 0, 1);        // 0 dry .. ~0.6 drizzle .. 1 properly wet (London, Sao Paulo: drizzle; Brussels: wet)
const wetLabel = w => w < 0.12 ? "DRY" : w < 0.75 ? "DRIZZLE" : "WET";
const bestTyre = w => w < 0.25 ? "dry" : w < 0.8 ? "inter" : "wet";
function gripOf(tyre, w) { // 0.5 .. 1: how well this tyre holds this wetness
  if (tyre === "dry") return clamp(1 - 0.5 * Math.max(0, w - 0.05) / 0.95, 0.5, 1);
  if (tyre === "inter") return clamp(1 - 0.3 * Math.abs(w - 0.5), 0.5, 1);
  return clamp(0.62 + 0.38 * w, 0.5, 1);
}
