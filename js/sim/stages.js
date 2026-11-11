// ---------- stages, scenery & weather ----------

// ---------- which city you're in ----------
// World Tour and the Daily: one city over the level's length. Endless and Vs Computer: each city lasts about CITY_SECS of driving,
// however fast you're going (at 300 km/h that's ~25 km of road, at 1000 km/h ~20 km). Its end can't simply be placed when the time is up:
// the 3D city is built up to CITY_AHEAD up the road, and all of that is already this city. So until its end is pinned, everything ahead
// counts as this city; every tick we work out where flat out would take you by the time the city is up, and the moment that spot comes
// within CITY_AHEAD, the end is pinned there (past anything already built). From then on it is a fixed distance, like a tour level.
function setCity(i, d0) { // you're in city i (counting along the route), which starts at d0
  cityPrev.idx = i - 1; cityPrev.d0 = d0 - STAGE_LEN;
  cityLeg.idx = i; cityLeg.d0 = d0; cityLeg.d1 = Infinity; cityLeg.t = 0; cityLeg.f0 = 0; cityLeg.dc = 0;
}
function driveCity() { // once a tick while racing: this city's driving time, and its end pinned once it is close enough
  const c = cityLeg; if (level || !grid.done || mode === "tutorial") return; // (the test drive stays in Tokyo)
  c.t += 1 / 60;
  if (c.d1 < Infinity) return;
  let v = speed, d = 0; // (in 1 s steps: v is per tick, so a second covers 60 v)
  for (let s = CITY_SECS - c.t; s > 0 && d < CITY_AHEAD; s--) { const a = accelAt(v) * 60 * Math.min(1, s); d += (v + a / 2) * 60 * Math.min(1, s); v += a; }
  if (d < CITY_AHEAD) { c.d1 = dist + CITY_AHEAD; c.dc = dist; c.f0 = Math.min(0.8, c.t / CITY_SECS); }
}
function cityProgress() { // 0..1 through the city: by time until its end is pinned, then by distance (the last fifth fades into the next country)
  const c = cityLeg;
  if (dist >= c.d1) { cityPrev.idx = c.idx; cityPrev.d0 = c.d0; c.idx++; c.d0 = c.d1; c.d1 = Infinity; c.t = 0; c.f0 = 0; c.dc = 0; } // into the next city
  return c.d1 < Infinity ? c.f0 + (1 - c.f0) * clamp((dist - c.dc) / (c.d1 - c.dc), 0, 0.999) : Math.min(0.8, c.t / CITY_SECS);
}

function updateStage() {
  const y = level ? level.idx + clamp((dist - level.d0) / level.len, 0, 0.999) : state === "title" ? TITLE_CITY + 0.1 : cityLeg.idx + cityProgress(), whole = Math.floor(y); // a tour level never drifts into the next city; the title stays in its own
  stageIdx = whole % ROUTE.length;
  stageFrac = y - whole;
  stA = ROUTE[stageIdx]; stB = ROUTE[(stageIdx + 1) % ROUTE.length];
  const b = stBlend = level ? 0 : smooth((stageFrac - 0.8) / 0.2), A = stA, B = stB; // the last fifth of a stage fades into the next country
  pal = {
    grass: mix(A.g, B.g, b), grassAlt: mix(A.ga, B.ga, b), road: mix(A.rd, B.rd, b),
    sky0: mix(A.s0, B.s0, b), sky1: mix(A.s1, B.s1, b), mount: mix(A.mc, B.mc, b), hill: mix(A.hc, B.hc, b), leaf: mix(A.lf, B.lf, b),
    tint: mix(A.tint, B.tint, b), dark: lerp(A.night, B.night, b), sun: lerp(A.sunA, B.sunA, b), rain: lerp(A.rain, B.rain, b), petals: lerp(A.petals, B.petals, b),
  };
  rainI = pal.rain;
  wind = 0.5 + 0.5 * Math.sin(dist / 240);
  wet += (rainI - wet) * 0.01;
}

const SPONSORS = [["APEX", "#e10600"], ["TURBO OIL", "#ff8000"], ["NITRO X", "#00b2ff"], ["EXTREME RACING", "#7b2cbf"], ["REDLINE", "#d3202a"], ["G-FORCE", "#0a6e5c"], ["PIT STOP", "#ffcc00"]];

function pickKind(table) {
  const total = table.reduce((a, [, w]) => a + w, 0);
  let roll = Math.random() * total;
  for (const [k, w] of table) { if (roll < w) return k; roll -= w; }
  return table[0][0];
}

// near objects sit on the verge; far ones fill the countryside in the 3D views. Each country adds its own props and landmarks.
function sceneTable(st, far) {
  const night = st.night > 0.1, desert = !!st.desert, city = st.horizon === "city";
  return far
    ? [["tree", 0.3], ["bush", desert ? 0.03 : 0.08], ["rock", 0.05], ["dune", desert ? 0.14 : 0], ["building", city ? 0.12 : 0], ["stand", 0.04], ["flag", 0.07]]
    : [["tree", 0.4], ["bush", desert ? 0.04 : 0.1], ["rock", 0.06], ["dune", desert ? 0.18 : 0], ["flag", 0.06], ["lamp", night ? 0.4 : 0.05], ["prop", st.props && st.props.some(p => !p[2]) ? 0.22 : 0]];
}

function pickProp(st, nearOnly) {
  const list = (st.props || []).filter(p => !nearOnly || !p[2]);
  if (!list.length) return null;
  let roll = Math.random() * list.reduce((a, p) => a + p[1], 0);
  for (const p of list) { if (roll < p[1]) return p[0]; roll -= p[1]; }
  return list[0][0];
}

// half-widths of everything that can stand beside the road, so each can be placed with its nearest edge clear of the kerb
const PROP_HALF = { lanternpole: 20, paifang: 48, bamboo: 14, torii: 44, stonelantern: 10, neonsign: 24, flamingo: 10, lifeguard: 16, mapleleaf: 16, yacht: 42, mosaic: 28, chalet: 32, cow: 20, phonebox: 10, bus: 34, sheep: 12, canalhouse: 18, sunflowers: 28, hayroll: 14, tulips: 38, villa: 30, vineyard: 36, osborne: 32, stonearch: 28, orchid: 14, pumpjack: 30, agave: 18, papel: 42, colorhouses: 40, camel: 30 };
const LM_HALF = { opera: 104, bridge: 112, pearl: 44, shtower: 30, pagoda: 58, ferriswheel: 70, artdeco: 46, freedomtower: 34, biosphere: 54, olympictower: 66, casino: 80, palace: 96, sagrada: 104, torreglories: 22, church: 60, fortress: 100, bigben: 70, towerbridge: 104, londoneye: 78, atomium: 68, belfry: 26, parliament: 118, chainbridge: 108, dutchmill: 70, canalhouses: 90, colosseum: 84, pisa: 82, alcala: 66, kiotowers: 56, flame: 56, maiden: 100, heydar: 96, mbs: 116, supertrees: 84, merlion: 60, flyer: 76, capitol: 96, uttower: 30, angel: 42, pyramid: 68, christ: 108, sugarloaf: 132, ponte: 110, sphere: 72, luxor: 106, stratosphere: 26, eiffel: 44, welcome: 40, lusail: 98, aspire: 28, mosque: 124, themepark: 110, yashotel: 106, etihad: 62 };
function sceneHalf(kind, key, r) {
  switch (kind) {
    case "lm": return LM_HALF[key] || 110;
    case "prop": return PROP_HALF[key] || 40;
    case "tree": return r * 1.9;
    case "bush": return r * 1.4;
    case "rock": return r * 1.3;
    case "dune": return r * 1.6;
    case "stand": return 52;
    case "board": return 40;
    case "building": return 30;
    default: return 14;
  }
}

function makeScenery(kind, y, far, st, key) {
  const left = Math.random() < 0.5, side = left ? -1 : 1;
  const r = kind === "tree" ? (far ? rnd(12, 20) : rnd(11, 15)) : kind === "dune" ? rnd(14, 26) : kind === "bush" ? rnd(6, 10) : kind === "rock" ? rnd(5, 8) : 1;
  const x = far ? (left ? 20 : W - 20) : kind === "lamp" ? (left ? ROAD_L - 12 : ROAD_R + 12) : (left ? 8 : ROAD_R + 8) + r + Math.random() * Math.max(0, ROAD_L - 18 - 2 * r);
  let off = kind === "lm" ? rnd(120, 300) : far ? (kind === "building" ? rnd(90, 260) : kind === "stand" ? rnd(70, 200) : rnd(26, 280)) : kind === "lamp" ? rnd(2, 8) : rnd(4, 26);
  off = Math.max(off, sceneHalf(kind, key, r) + 4); // nearest edge stays clear of the road and kerbs
  const o = { kind, key, x, y, r, far, side, half: sceneHalf(kind, key, r), x3: W / 2 + side * (172 + off), v: Math.floor(Math.random() * 3), ph: rnd(0, TAU), fruit: st.fruit };
  if (kind === "tree") o.style = pick(st.trees);
  else if (kind === "flag") o.flag = st.flag;
  else if (kind === "board") o.sponsor = pick(SPONSORS);
  else if (kind === "stand") { o.crowd = Array.from({ length: 3 }, () => Array.from({ length: 14 }, () => pick(st.crowd))); o.roofColor = st.crowd[0]; }
  else if (kind === "building") {
    o.bw = rnd(26, 44); o.bh = rnd(34, 86) * (st.cityH || 1);
    o.bcol = st.bcols ? pick(st.bcols) : st.night > 0.1 ? pick(["#1b1f46", "#232857", "#171a3c"]) : pick(["#8d96a3", "#a8b0bb", "#7b8490", "#b9c0c8"]);
  }
  return o;
}

function spawnScenery(y) {
  const st = Math.random() < stBlend ? stB : stA;
  scenery.push(makeScenery(pickKind(sceneTable(st, false)), y, false, st, pickProp(st, true)));
  scenery.push(makeScenery(pickKind(sceneTable(st, true)), y + rnd(-25, 25), true, st));
  const prop = Math.random() < 0.85 ? pickProp(st, false) : null;
  if (prop) scenery.push(makeScenery("prop", y + rnd(-25, 25), true, st, prop));
  if (st.lms && st.lms.length && Math.random() < 0.17) scenery.push(makeScenery("lm", y + rnd(-25, 25), true, st, pick(st.lms)));
}

function updateWeather() {
  const add = p => { if (wx.length < 300) wx.push(p); };
  if (Math.random() < 0.2 * pal.petals) add({ t: "petal", x: rnd(-20, W + 20), y: -10, vy: rnd(0.6, 1.3), rot: rnd(0, TAU), vr: rnd(-.08, .08), ph: rnd(0, TAU), s: rnd(3, 5), c: pick(["#ffc2dd", "#ffd9e8", "#fff0f6", "#ffadd0"]) });
  for (let i = 0, n = (settings.lowfx ? 1.5 : 4) * rainI + (Math.random() < ((settings.lowfx ? 1.5 : 4) * rainI) % 1 ? 1 : 0); i < Math.floor(n); i++) add({ t: "rain", x: rnd(-30, W + 30), y: -10, vx: -2.2 - wind, vy: rnd(11, 16), len: rnd(10, 18) });
  for (const p of wx) {
    if (p.t === "petal") { p.ph += 0.05; p.x += Math.sin(p.ph) * 0.7 - wind * 0.8; p.y += p.vy + scroll * 0.25; p.rot += p.vr; }
    else { p.x += p.vx; p.y += p.vy; }
  }
  wx = wx.filter(p => p.y < H + 30 && p.x > -90 && p.x < W + 90);
  if (wet > 0.25 && Math.random() < 0.01) roadItems.push({ k: "puddle", x: rnd(ROAD_L + 30, ROAD_R - 30), y: -20, rx: rnd(16, 30), ry: rnd(8, 14) }); // puddles scroll with the road
  for (const it of roadItems) it.y += scroll;
  roadItems = roadItems.filter(it => it.y < H + 30);
}

