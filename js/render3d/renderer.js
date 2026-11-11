// The Three.js renderer. It READS the simulation's globals (racers, enemies, pickups, scenery...) and never changes them.
//
// How smooth motion works: the simulation ticks at a fixed 60 Hz, but the screen may refresh at 144 Hz. After every sim tick
// we call tick(), which remembers where each thing was and where it is now. Every frame we call render(alpha), where alpha
// (0..1) says how far we are between the two ticks, and draw everything at the blended position.
import * as THREE from "three";
import { SCALE, simX, simZ, roadHalf, arrToHex, setCol } from "./mapping.js";
import * as M from "./models.js";
import { createWorld } from "./world.js";
import { createCameraRig, INTRO_BLEND } from "./cameras.js";
import { leafMat, leafDarkMat, grassTopMat } from "./scenery.js";
import { createCity } from "./city/city.js";
import { createBypass } from "./bypass.js";
import { profileOf } from "./city/profiles.js";
import { loadSky, setSkySafe, addSkyLight, FIRST_SKY, TODS, BRIEF_TOD } from "./env.js";
import { glows, tickLandmarks, makeLandmark, hasLandmark, setLandmarkDetail } from "./landmarks.js";
import { mergeStatic } from "./merge.js";
import { buildPlaza } from "./city/plaza.js";
import { SHOWCASE } from "./city/profiles.js";
import { createWeather } from "./weather.js";
import { createNight } from "./night.js";
import { createPost } from "./post.js";
import { createReflection } from "./reflect.js";
import { createFX } from "./fx.js";
import { createPhoto } from "./photo.js";
import { createShowroom } from "./showroom.js";
import { createTitleReel } from "./titlereel.js";
import { resolve, createAuto, gfxDefaults, OPTIONS } from "./quality.js";
import { readDevice } from "./device.js";
import { setLowShading, prepLow } from "./lowshading.js";
import { requestPack } from "./citypack.js";
import { setTowerPack } from "./city/materials.js";
import "./haze.js"; // (height fog with a glow towards the sun, for every material: must load before anything compiles)

const RACE_STATES = new Set(["playing", "over", "cleared", "paused", "camera"]);
const MODES = ["overhead", "chase", "cockpit"];
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const NIGHT_CAR_LIGHT = +(new URLSearchParams(location.search).get("ncl") || 420); // (testing: &ncl=N tries another strength)
const rnd = (a, b) => a + Math.random() * (b - a);
const START_FINISH = ["start", "half", "finish"], NO_GRADE = {}, ONE = [1, 1, 1], focus = { x: 0, z: 0, camPos: null }, playerLight = { x: 0, z: 0, yaw: 0, alive: true }, cin = { kick: 0, shake: 0, time: 0, gear: 1, lit: 0, grid01: 0, crashT: 0, finishT: 0, photo: null };
const sizeV = new THREE.Vector2(), sunV = new THREE.Vector3(), sunP = new THREE.Vector3(), camFwd = new THREE.Vector3();
const qTmp = new THREE.Quaternion(), pTmp = new THREE.Vector3(), sTmp = new THREE.Vector3(), mTmp = new THREE.Matrix4(), yAxis = new THREE.Vector3(0, 1, 0);

// (the WebGL context is made first, on its own, by boot.js: it can take most of a second, which then overlaps the downloads)
export const createContext = glCanvas => new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: "high-performance" }); // anti-aliasing comes from the post pipeline
export function createRenderer3D(canvas2d, glCanvas, renderer = createContext(glCanvas)) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false; // the composer renders several times per frame: reset once per frame ourselves so the totals mean "this frame"
  const scene = new THREE.Scene();
  const device = readDevice(renderer.getContext()); // (a weak laptop, a phone or Safari starts on Low)
  // The safe path: drawn straight to the screen, lit without the sky's image-based lighting, no reflections, bloom, AO or depth of field.
  // Taken when the browser can't draw into half-float pictures (device.js), or when the picture comes out black anyway (see checkBlack).
  const SAFE = { direct: true, ibl: false, reflect: false, bloom: false, ao: 0, dof: false, paint: 0 };
  let safe = !device.floatRT || (store.get("gfxSafe", false) && !location.search.includes("blacktest")); // (remembered once the picture has come out black on this browser)
  const world = createWorld(scene, device.weak);
  const rig = createCameraRig(scene);
  const camera = rig.camera;
  const rig2 = createCameraRig(scene), camera2 = rig2.camera; // split-screen multiplayer: Player 2's own camera (and cockpit)
  const weather = createWeather(scene, camera);
  const nightFx = createNight(scene);
  const city = createCity(scene); // the buildings, ground and water around the road
  const post = createPost(renderer, scene, camera);
  const titleLight = new THREE.SpotLight(0xffe2bd, 0, 70, 0.55, 0.85, 1.2); scene.add(titleLight, titleLight.target);
  const fx = createFX(scene, M.makeWheelDebris), bypass = createBypass(scene), bypassWin = { side: 1, zBack: 0, zFront: 0 };
  const reflect = createReflection(renderer, scene, camera, world.groundMeshes, world.reflectMats, [city.ground.water]); // wet-road and harbour reflections (High and up)
  const photo = createPhoto();
  const reel = createTitleReel(scene), reelCar = { x: 0, z: 0, D: 0, lane: 1, obj: null }, reelCtx = { low: false, capped: false, aspect: 1.7, rect: null, vw: 30, traffic: null }, reelTraffic = [];
  let reelOn = false, reflOn = false, reelNitro = false; const FULL_RECT = { left: 0, right: 1, top: 0, bottom: 1 };
  reelCtx.traffic = () => { // the vehicles near the title camera, in world units (reused objects: nothing allocated per frame)
    let n = 0; const vRoad = (typeof speed === "number" ? speed : 0) * SCALE * 60;
    for (const [e, rec] of enemiesT.recs) { const o = reelTraffic[n] || (reelTraffic[n] = {}); o.x = rec.cx; o.z = rec.cz; o.hw = 2.3; o.hl = lenOf(e) * SCALE / 2 + 0.4; o.vz = vRoad - (e.cur || 0) * SCALE * 60; n++; }
    reelTraffic.length = n; return reelTraffic;
  };
  // the screens drawn in the studio (showroom.js) instead of the city: the main menu and its sub-screens, the Garage, the tyre choice
  // (the title is filmed in the city itself: see titlereel.js)
  const STUDIO = new Set(["menu", "garage", "upgrades", "tyres", "options", "graphics", "songs", "controls", "credits", "stats", "difficulty", "firsttime"]);
  let showroom = null, showWas = false; const inShowroom = () => STUDIO.has(state);
  // each city's own colour grade (saturation, contrast, a tint): together with its sky, the thing that makes it feel like a different place
  const GRADE = {
    Sydney: { sat: 1.18, contrast: 1.08, tint: [0.98, 1.02, 1.06], sh: [0.97, 1.0, 1.05], hi: [1.03, 1.0, 0.96] },          // clean harbour blue
    Shanghai: { sat: 0.92, contrast: 1.1, tint: [0.97, 1.0, 1.05], sh: [0.96, 1.01, 1.05], hi: [1.01, 1.0, 0.97] },          // cool steel haze
    Tokyo: { sat: 1.12, contrast: 1.1, tint: [1.02, 0.99, 1.0], sh: [0.97, 0.98, 1.05], hi: [1.05, 0.99, 0.95] },           // violet dusk, warm lights
    Miami: { sat: 1.3, contrast: 1.08, tint: [1.06, 0.96, 1.05], sh: [0.95, 0.98, 1.09], hi: [1.08, 0.97, 0.94] },          // hot pink sunset, teal shade
    Montreal: { sat: 1.05, contrast: 1.12, tint: [1.03, 1.0, 0.96], sh: [0.98, 1.0, 1.03], hi: [1.04, 1.0, 0.94] },         // crisp autumn
    "Monte Carlo": { sat: 1.22, contrast: 1.1, tint: [1.02, 1.0, 1.0], sh: [0.94, 1.0, 1.07], hi: [1.07, 1.01, 0.91] },     // warm Riviera sun, teal shade, deep blue sea
    Barcelona: { sat: 1.2, contrast: 1.1, tint: [1.05, 1.0, 0.94], sh: [0.97, 0.99, 1.05], hi: [1.07, 1.0, 0.9] },          // warm terracotta
    Salzburg: { sat: 1.08, contrast: 1.06, tint: [0.98, 1.02, 1.03], sh: [0.97, 1.01, 1.04], hi: [1.02, 1.0, 0.97] },       // fresh alpine
    London: { sat: 0.8, contrast: 1.12, tint: [0.97, 0.99, 1.03], sh: [0.94, 1.0, 1.08], hi: [0.99, 1.0, 1.01] },           // cool, grey and moody
    Brussels: { sat: 0.85, contrast: 1.1, tint: [1.01, 1.0, 0.97], sh: [0.97, 1.0, 1.05], hi: [1.03, 1.0, 0.96] },          // old brick and drizzle
    Budapest: { sat: 1.1, contrast: 1.1, tint: [1.05, 1.0, 0.95], sh: [0.97, 0.99, 1.05], hi: [1.06, 1.0, 0.92] },          // golden Danube morning
    Amsterdam: { sat: 1.12, contrast: 1.06, tint: [1.0, 1.02, 1.0], sh: [0.96, 1.01, 1.05], hi: [1.03, 1.0, 0.96] },        // canal green
    Rome: { sat: 1.16, contrast: 1.12, tint: [1.06, 1.0, 0.92], sh: [0.97, 0.98, 1.04], hi: [1.08, 0.99, 0.88] },           // golden hour on stone
    Madrid: { sat: 1.12, contrast: 1.14, tint: [1.05, 1.0, 0.94], sh: [0.97, 1.0, 1.05], hi: [1.06, 1.0, 0.91] },           // dry hot light
    Baku: { sat: 1.15, contrast: 1.1, tint: [1.05, 0.98, 0.98], sh: [0.96, 0.97, 1.08], hi: [1.06, 0.98, 0.93] },           // Caspian dusk
    Singapore: { sat: 1.22, contrast: 1.12, tint: [0.98, 1.0, 1.06], sh: [0.94, 1.0, 1.11], hi: [1.03, 1.0, 0.99] },        // electric night
    Austin: { sat: 1.08, contrast: 1.1, tint: [1.06, 1.0, 0.92], sh: [0.98, 1.0, 1.03], hi: [1.07, 1.0, 0.9] },             // Texas sun
    "Mexico City": { sat: 1.24, contrast: 1.08, tint: [1.04, 1.0, 0.95], sh: [0.97, 1.0, 1.04], hi: [1.06, 1.0, 0.92] },    // bright colour
    "Sao Paulo": { sat: 0.96, contrast: 1.1, tint: [0.98, 1.02, 1.0], sh: [0.96, 1.02, 1.03], hi: [1.01, 1.01, 0.97] },     // humid green-grey
    "Las Vegas": { sat: 1.3, contrast: 1.16, tint: [1.04, 0.97, 1.06], sh: [1.04, 0.93, 1.12], hi: [1.05, 0.99, 0.95] },    // neon magenta
    Doha: { sat: 1.15, contrast: 1.1, tint: [1.05, 1.0, 0.92], sh: [0.96, 0.98, 1.08], hi: [1.08, 1.0, 0.88] },             // amber night
    "Abu Dhabi": { sat: 1.12, contrast: 1.1, tint: [1.04, 0.99, 0.95], sh: [0.96, 0.98, 1.06], hi: [1.07, 0.99, 0.91] },      // twilight: blue shade, amber lights
  };
  let nearPulse = 0, seenPop = null, tunnelK = 0;

  // ---------- graphics quality ----------
  const URLQ = new URLSearchParams(location.search).get("gfx"); // ?gfx=low|medium|high|ultra tries a preset without saving it
  const auto = createAuto(store, device, !!URLQ);
  const gl = renderer.getContext(), px1 = new Uint8Array(4); let benchCost = -1; // (the benchmark: what the last frame really cost, in ms)
  let bgLoading = false; // (the background loading is running: its frames don't count for Auto)
  let gfxNoted = !!URLQ || settings.gfx !== "auto" || store.get("gfxNoted", false); // (the "Graphics: Ultra (Auto)" note was shown once already, or Auto isn't in charge)
  const qSettings = () => URLQ ? { ...settings, gfx: URLQ } : settings;
  let Q = resolve(qSettings(), auto.level);
  const lowReel = () => reelOn && Q.level === "low"; // the title's reel on Low: a lighter street (see titlereel.js)
  const cityQuality = () => { // (Low's title: the city built a little less far ahead)
    const full = !!Q.cityDetail; if (full !== landmarkFull) { landmarkFull = full; setLandmarkDetail(full); showcases.clear(); if (scOn) { scene.remove(sc.set); city.setShowcase(null); scOn = false; } } // (the detail changed: landmarks are rebuilt as they are next needed)
    city.setQuality({ ahead: Q.cityAhead * Q.dist * (lowReel() ? 0.75 : 1), density: Q.cityDensity, detail: Q.cityDetail ? 1 : 0 });
  };
  let landmarkFull = true, briefK = 0;
  const showcases = new Map(); let sc = null, scOn = false, scS = 0; // the briefing's signature landmarks, built once each (see showcaseOf)
  function applyQuality() {
    Q = resolve(qSettings(), auto.level);
    for (const kv of (new URLSearchParams(location.search).get("q") || "").split(",")) { const [k, v] = kv.split(":"); if (k && v !== undefined) Q[k] = v === "true" ? true : v === "false" ? false : +v; } // testing: ?q=msaa:0,shadows:1024 overrides single quality values
    if (safe) Object.assign(Q, SAFE); // (a browser that can't draw half-float pictures: everything that needs them is off)
    if (!device.floatMSAA) Q.msaa = 0;
    setSkySafe(safe); if (showroom) showroom.setSafe(safe);
    if (Q.ibl && skiesLit) addSkyLight(renderer); // (the graphics went up from Low: the skies' soft lighting is built now)
    renderer.shadowMap.enabled = Q.shadows > 0; world.sun.castShadow = Q.shadows > 0;
    world.setShadowArea(Math.min(Q.shadowArea || 100, Q.shadows >= 4096 ? 125 : Q.shadows >= 2048 ? 100 : 70), Q.shadows >= 2048 ? 45 : 25); // sharper shadow maps can stretch over more of the road ahead
    post.setAO(Q.ao || 0);
    if (world.sun.shadow.mapSize.x !== Q.shadows && Q.shadows > 0) { world.sun.shadow.mapSize.set(Q.shadows, Q.shadows); if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; } }
    renderer.shadowMap.needsUpdate = true;
    fx.setDensity(Q.particles); reflOn = !!Q.reflect; reflect.enable(reflOn); cityQuality(); M.setCarDetail(Q.carLod ?? 1);
    post.direct = !!Q.direct; // (Low: straight to the screen, no post-processing)
    setLowShading(!!Q.simple); // (Low: simple lighting on every shiny material)
    post.bloom.enabled = post.clean.enabled = Q.bloom; post.clean.uniforms.debug.value = Q.debugnan ? 1 : 0; post.fx.enabled = Q.grade; post.smaa.enabled = Q.smaa; post.fxaa.enabled = Q.fxaa;
    for (const t of [post.composer.renderTarget1, post.composer.renderTarget2]) if (t.samples !== Q.msaa) { t.samples = Q.msaa; t.dispose(); }
    for (const m of rig.mirrors) m.rt.setSize(Q.mirrorRes, Q.mirrorRes / 2);
    sizeKey = ""; // the pixel ratio may have changed
    refreshMaterials(); // shadows on/off changes every material's shader
  }

  // after a quality change, every material must be rebuilt (e.g. shadows on/off changes its shader), including those of hidden pooled objects
  function refreshMaterials() {
    const seen = new Set(), mark = o => o.traverse(c => { const ms = c.material ? (Array.isArray(c.material) ? c.material : [c.material]) : []; for (const m of ms) if (!seen.has(m)) { seen.add(m); m.needsUpdate = true; } });
    mark(scene); for (const list of pools.values()) for (const o of list) mark(o);
  }

  // ---------- pools: finished objects are hidden and reused instead of rebuilt ----------
  const pools = new Map();
  const acquire = (key, make) => { const list = pools.get(key); const o = list && list.pop() || make(); o.userData.poolKey = key; if (o.userData.reset) o.userData.reset(); scene.add(o); return o; };
  const release = o => { scene.remove(o); const k = o.userData.poolKey; (pools.get(k) || pools.set(k, []).get(k)).push(o); };

  // ---------- trackers: one record per simulation object, holding its previous and current position ----------
  let tickId = 0, lastRacers = null;
  function makeTracker(keyOf, build, readExtra, xOf = e => e.x, onRemove) {
    const recs = new Map();
    return {
      recs,
      tick(list) {
        for (const e of list) {
          const x = simX(xOf(e)), z = simZ(e.y), ex = readExtra ? readExtra(e) : 0;
          let r = recs.get(e);
          if (!r) { const key = keyOf ? keyOf(e) : ""; r = { obj: build ? acquire(key, () => build(e)) : null, px: x, pz: z, cx: x, cz: z, pe: ex, ce: ex }; recs.set(e, r); }
          else { r.px = r.cx; r.pz = r.cz; r.cx = x; r.cz = z; r.pe = r.ce; r.ce = ex; }
          r.id = tickId;
        }
        for (const [e, r] of recs) if (r.id !== tickId) { if (onRemove) onRemove(e, r); if (r.obj) release(r.obj); recs.delete(e); }
      },
    };
  }
  const racersT = makeTracker(r => "race:" + r.team.name, r => M.makeRaceCar(r.team), r => r.tilt);
  // a city's own vehicles (the picture only: the simulation's traffic is unchanged): London's black cabs and red buses, Tokyo's indigo taxis,
  // Singapore's blue ones; everywhere else taxis are yellow and every vehicle keeps its own colour
  const CITY_TRAFFIC = { London: { taxi: "#151619", bus: "#c8102e" }, Tokyo: { taxi: "#1d2b4a" }, Singapore: { taxi: "#1f6fd1" }, "Mexico City": { taxi: "#c2185b" }, Budapest: { bus: "#1d4f9c" }, Amsterdam: { bus: "#1f4fa3" } };
  const cityCol = e => { const o = stA && CITY_TRAFFIC[stA.venue]; return (o && o[e.model]) || null; };
  const enemiesT = makeTracker(
    e => { const c = cityCol(e) || e.col; return e.kind === "truck" ? `truck:${e.len}:${c}:${e.model}` : e.kind === "works" ? `works:${e.len}` : `car:${c}:${e.model}`; },
    e => { const c = cityCol(e); return e.kind === "truck" ? M.makeTruck(e.len, c || e.col, e.model) : e.kind === "works" ? M.makeWorks(e.len) : M.makeTrafficCar(c || e.col, e.model, !!c); });
  const pickupsT = makeTracker(k => "pickup:" + k.type + (k.type === "curve" ? ":" + k.lane : ""), k => k.type === "coin" ? M.makeCoin() : k.type === "nitro" ? M.makeNitro() : k.type === "curve" ? M.makeCurve(k.lane === 0 ? -1 : 1) : M.makeShield(), null, e => e.x,
    (k, r) => { if (k.taken && !k.gone) fx.pickup(r.cx, r.cz, k.type); }); // a sparkle where a pickup was collected
  const puddlesT = makeTracker(() => "puddle", () => weather.puddleBuild());
  let distPrev = 0, distCur = 0; // how far along the route the car is (sim units), before and after the latest tick
  const marks = { start: null, half: null, finish: null }; // start gantry, halfway gantry and finish arch: { obj, pz, cz }
  function trackMark(name, src, finish) {
    const m = marks[name];
    if (src && !m) marks[name] = { obj: acquire(name, () => M.makeGantry(name === "half" ? "half" : finish, roadHalf())), pz: simZ(src.y), cz: simZ(src.y) };
    else if (src) { m.pz = m.cz; m.cz = simZ(src.y); }
    else if (m) { release(m.obj); marks[name] = null; }
  }

  function tick() {
    tickId++;
    if (racers !== lastRacers) { lastRacers = racers; fx.reset(); crashAt = -1; crashClock = 0; } // a new race: nothing left over from the last one
    racersT.tick(racers);
    enemiesT.tick(enemies);
    pickupsT.tick(pickups);
    puddlesT.tick(roadItems);
    trackMark("start", startObj, false);
    trackMark("half", halfObj, false);
    trackMark("finish", finishObj, true);
    distPrev = distCur; distCur = dist;
  }

  // ---------- sizing: match the 2D canvas, which fit() sizes to the window ----------
  let sizeKey = "";
  // ---------- split-screen multiplayer: in a two-player race each player gets half the screen (side by side on a wide screen, one above the other
  // on a tall one) and a camera of their own. Everything in the scene is set up once per frame; then it is drawn twice (see renderSplit). ----------
  const split = { on: false, side: true, cw: 0, ch: 0 };
  const splitNow = () => mode === "multi" && RACE_STATES.has(state) && !!racers && racers.length > 1 && !photo.active; // (photo mode: one full-screen camera)
  function resize() {
    const cw = canvas2d.clientWidth, ch = canvas2d.clientHeight; if (!cw || !ch) return;
    split.on = splitNow(); split.side = cw >= ch; split.cw = cw; split.ch = ch;
    const vw = split.on && split.side ? cw / 2 : cw, vh = split.on && !split.side ? ch / 2 : ch; // (the size of one player's half)
    const sc = inShowroom() ? Math.max(Q.scale, Q.menuScale || 1, Q.garageScale || 1) : state === "title" && Q.level !== "low" ? Math.max(Q.scale, Math.min(Q.menuScale || 1, Q.scale * 1.25)) /* (the title reel: a touch sharper than racing) */ : state === "map" ? Math.min(Q.scale, 0.6) /* (the map's city is blurred or darkened: 60% resolution is plenty, and cheaper than racing) */ : Q.scale; // the title, main menu and Garage are cheap scenes: they render sharper (by how much: the preset)
    // pixels drawn per window pixel: the screen's own (a Retina screen has 2) times the preset's scale, at most the preset's maxPR; on Low the
    // dynamic resolution then takes it down further (to half) while the frame rate stays low
    const pr = Math.round(Math.max(0.4, Math.min(Q.maxPR || 2.6, Math.min(Math.max(window.devicePixelRatio || 1, 1), 2) * sc) * (Q.level === "low" ? auto.dynScale : 1)) * 100) / 100, key = `${cw}x${ch}@${pr}${split.on ? "|split" : ""}`;
    if (key === sizeKey) return; sizeKey = key;
    renderer.setPixelRatio(pr); renderer.setSize(cw, ch, false); post.setSize(vw, vh, pr); // (split: the post-processing pictures are one half's size)
    camera.aspect = camera2.aspect = vw / vh; camera.updateProjectionMatrix(); camera2.updateProjectionMatrix();
    if (showroom) showroom.resize(cw, ch);
  }

  // ---------- per-frame ----------
  let last = performance.now(), time = 0, frozen = null, fps = 60, crashAt = -1, crashClock = 0, finishAt = -1, fwT = 0, lastState = "", briefAt = 0, lmOn = false, lmFirst = true;
  const BT = new URLSearchParams(location.search).get("bt"), lmAt = { s: 0, x: 0, sc: 1, rad: 34 }, lmV = { x: 0, y: 0, z: 0, rad: 34 }; // (the briefing's landmark: on the route, and in the world)
  const camTarget = { x: 0, z: 0, v: 0, tilt: 0, nitro: false }, camTarget2 = { x: 0, z: 0, v: 0, tilt: 0, nitro: false }, cin2 = {}; let frozen2 = null; // (Player 2's, in split screen)
  const R = { active: true, renderer, scene, camera, rig, tick, racerScreen, photo, get split() { return split.on; }, get showroom() { return showroom; }, refreshQuality: applyQuality, gfxDefaults, OPTIONS, cinematic: settings.cinema !== false, get fps() { return fps; }, get quality() { return Q; }, get autoLevel() { return auto.level; } };
  // ---------- the race start: a 2.6 s cinematic sweep past your car on the grid. The simulation waits for it (main.js), so the countdown and the
  // launch are unchanged; any key, button or tap skips to its last 0.45 s, the glide into your race camera. Off with "Cinematic cameras: OFF". ----------
  const IQ = new URLSearchParams(location.search); let intro = IQ.has("intro") ? { t: 0, len: 2.6 } : null; const IT = IQ.get("it"); // (testing: ?intro plays it on a dev start, &it=SECONDS holds it there)
  R.raceIntro = () => { tick(); tick(); intro = R.cinematic !== false ? { t: 0, len: 2.6 } : null; }; // (the race waits during the sweep, so the 3D side must take in the new race's cars now: otherwise the menu's demo cars would still stand on the grid)
  R.skipIntro = () => { if (intro && intro.t < intro.len - 0.45) intro.t = intro.len - 0.45; };
  Object.defineProperty(R, "introHold", { get: () => !!intro && state === "playing" && !!grid && !grid.done && grid.t === 0 }); // (true while the countdown waits)
  Object.defineProperty(R, "introK", { get: () => intro ? Math.min(1, intro.t / intro.len) : 1 });
  function stepIntro(dt) {
    if (!intro) return;
    if (state !== "playing" || !grid || grid.done || grid.t > 0) { intro = null; return; } // (paused, quit, or the lights already started)
    intro.t = IT !== null ? Math.min(+IT, intro.len - 0.01) : intro.t + dt; if (intro.t >= intro.len) intro = null;
  }

  const INSPECT = new URLSearchParams(location.search).get("inspect"); // ?inspect=side|front|top: a fixed close-up of your car, for checking models
  function modeNow() {
    if (photo.active) return "photo";
    if (INSPECT) return "inspect";
    if (intro && state === "playing") return "intro"; // the race start's cinematic sweep (the countdown waits for it)
    if (state === "over" && racers[0] && !racers[0].alive && crashAt >= 0) return "crash";
    if (state === "cleared") return "finish";
    if (state === "brief") return "brief"; // the city flyover behind the briefing
    if (state === "title") return "title";
    return RACE_STATES.has(state) ? MODES[cam] : "menu";
  }
  R.overDelay = () => (state === "over" && racers[0] && (!racers[0].alive || (split.on && racers[1] && !racers[1].alive)) && R.cinematic !== false ? 1700 : 0); // ms the crash camera plays before the Game Over screen (split screen: either player's)

  function render(alpha) {
    const now = performance.now(), ms = now - last, dt = Math.min(0.1, ms / 1000); last = now; time += dt;
    fps += (1000 / Math.max(1, ms) - fps) * 0.08; renderer.info.reset(); const programs = renderer.info.programs.length;
    if (gated.size) ungate(); // (shaders that finished compiling: show their things)
    if (packReady) applyPack();
    if (!warming) { // (not the warm-up renders behind the loading screen: they are slow on purpose)
      const quiet = document.hidden || !document.hasFocus() || gated.size > 0 || bgLoading; // (frames that say nothing about the graphics: the tab or window isn't in front, shaders are compiling, or loading is running)
      if (auto.frame(ms, benchCost, state, quiet)) { // (the benchmark on each launch, then the watchdog: a level down for this session when it stays slow, back up when smooth)
        applyQuality();
        if (state === "title") gate(compileQuietly(scene, camera).pending); // (on the title, e.g. behind the loading screen: the new level's shaders compile in the background, its things hidden until ready, instead of freezing the page; never in a race, where nothing may vanish)
        if (!auto.benchmarking && settings.gfx === "auto" && state === "playing") say(`Graphics lowered to ${Q.level[0].toUpperCase() + Q.level.slice(1)} for now, for smoother play`, { key: "perf" });
      }
      if (Q.level === "low" && !quiet && auto.lowFrame(ms)) sizeKey = ""; // (Low keeps 60 fps by trading resolution: see dynScale)
      if (!gfxNoted && !R.loadingUp && !auto.benchmarking && state === "title") { gfxNoted = true; store.set("gfxNoted", true); say(`Graphics: ${Q.level[0].toUpperCase() + Q.level.slice(1)} (Auto), change in Settings`, { key: "gfx", life: 320 }); } // (once, the first time Auto has picked a level here)
    }
    benchCost = -1;
    resize();
    if (inShowroom()) { renderShowroom(dt); return; }
    showWas = false;
    post.setScene(scene, camera);
    stepIntro(dt);
    const mode = modeNow();
    if (state !== lastState) { if (state === "cleared") finishAt = time; if (state === "brief") { briefAt = time; lmOn = false; } lastState = state; }

    // the cars
    const night = Math.max(Math.min(1, pal.dark * 4), world.lights), shiftZ = (state === "paused" || state === "camera" || photo.active) ? 0 : scroll * SCALE * 60 * dt;
    const fxDt = (state === "paused" || state === "camera" || photo.active) ? 0 : dt;
    for (const [r, rec] of racersT.recs) {
      const o = rec.obj, x = lerp(rec.px, rec.cx, alpha), z = lerp(rec.pz, rec.cz, alpha), tilt = lerp(rec.pe, rec.ce, alpha);
      o.rotation.order = "YXZ"; o.position.set(x, r.bypassing ? 0.28 * (r.bypassK || 0) : 0, z); o.rotation.y = -tilt; // (yaw first, then nose up / down, then roll: so a tumbling wreck turns about its own axes)
      if (!r.alive && rec.wreck && fxDt > 0) { // a wreck: it hops off what it hit, rolls over once if the impact was fast, and settles on its wheels
        const w = rec.wreck; w.vy -= 30 * fxDt; w.h += w.vy * fxDt;
        if (w.h < 0) { w.h = 0; w.vy = w.vy < -2 ? -w.vy * 0.28 : 0; w.rollV *= 0.8; }
        if (Math.abs(w.roll) < Math.PI * 2 && w.rollV) { w.roll += w.rollV * fxDt; if (Math.abs(w.roll) >= Math.PI * 2) { w.roll = 0; w.rollV = 0; w.done = true; } }
        if (w.h === 0 && w.vy === 0) { const k = Math.min(1, fxDt * 5); w.roll += (Math.round(w.roll / (Math.PI * 2)) * Math.PI * 2 - w.roll) * k; w.pitch *= 1 - k; w.rollV *= 1 - k; } // on the ground it comes to rest on its wheels
        o.position.y = w.h; o.rotation.z = w.roll; o.rotation.x = w.pitch * Math.min(1, w.h * 2 + 0.2);
      } else if (r.alive) { o.rotation.z = 0; o.rotation.x = 0; rec.wreck = null; }
      const ud = o.userData, spin = r.v * SCALE / 0.75 * dt * 60, c = Math.cos(-tilt), s = Math.sin(-tilt);
      for (const w of ud.wheels) w.rotation.x -= spin;
      for (const f of ud.front) f.rotation.y = -Math.max(-0.5, Math.min(0.5, tilt * 1.4));
      ud.brake.material.emissiveIntensity = r.braking ? 3 : 0.15;
      if (ud.setTyre && rec.tyre !== r.tyre) { rec.tyre = r.tyre; ud.setTyre(r.tyre || "dry"); } // the compound band on the sidewalls
      if (r.slip && fxDt > 0 && RACE_STATES.has(state) && Math.random() < 0.5) fx.tyreSmoke(x, z, [0.85, 0.86, 0.9], 0.28); // wrong tyres for the weather: they smoke as they slide
      if (ud.discMat) { const goal = r.alive ? (r.hardBrake ? 3.5 : r.braking ? 1.4 : 0) : 0, d = ud.discMat; d.emissiveIntensity += (goal - d.emissiveIntensity) * Math.min(1, dt * (goal > d.emissiveIntensity ? 14 : 3)); } // brake discs glow orange when you brake, and cool slowly
      if (!ud.beam) { ud.beam = nightFx.makeBeam(); o.add(ud.beam); ud.flame = fx.makeFlame(); o.add(ud.flame); }
      ud.beam.visible = pal.dark > 0.012 && r.alive && !(mode === "title" && camera.position.z < rec.cz - 1); // (the title reel filming it from in front: no glare from inside the headlight beam)
      ud.flame.visible = r.alive && (r.nitro > 0 || (mode === "title" && reelNitro)); fx.flameMat.uniforms.time.value = time; // (the title reel lights the flame for its tracking shot)
      if (ud.rain) ud.rain.material.emissiveIntensity = rainI > 0.25 ? 2 + Math.sin(time * 9) * 1.5 : 0; // the flashing rain light
      if (ud.setCockpit) ud.setCockpit(mode === "cockpit" && r === racers[0]); else ud.helmet.visible = !(mode === "cockpit" && r === racers[0]);
      o.visible = r.ghost > 0 && r.ghost < 1000 ? (frame >> 1) % 2 === 0 : true; // flashes after a bump
      if (r.shield && !ud.bubble) { ud.bubble = M.makeShieldBubble(); o.add(ud.bubble); }
      if (ud.bubble) ud.bubble.visible = !!r.shield;
      // ---- events: crash, shield break, nitro, tyre smoke, spray, trails ----
      if (!r.alive && !rec.crashed) { rec.crashed = true; rec.crashTime = time; fx.crash(x, z, r.team, -(r.wreckV || 0) * SCALE * 60); const fast = (r.wreckV || 0) > 3.2; rec.wreck = { h: 0, vy: Math.min(9, 1.5 + (r.wreckV || 0) * 1.3), roll: 0, rollV: fast ? (r.yawV >= 0 ? 1 : -1) * 5.2 : 0, pitch: -0.22, done: false }; if ((r.wreckV || 0) > 2.2 && ud.shed) { const pair = Math.random() < 0.5 ? [0, 3] : [1, 2]; ud.shed(pair[0]); ud.shed(pair[1]); } if (r === racers[0] || split.on) { crashAt = time; crashClock = 0; } }
      if (r.alive) rec.crashed = false;
      if (rec.crashed && time - rec.crashTime < 7 && fxDt > 0) { fx.fire(x, z); fx.fire(x, z); }
      if (rec.hadShield && !r.shield && r.alive) fx.shield(x, z); rec.hadShield = !!r.shield;
      if (r.nitro > 0 && !rec.nitroOn && fxDt > 0) fx.nitroStart(x, z); rec.nitroOn = r.nitro > 0;
      if (fxDt > 0 && r.alive && RACE_STATES.has(state) && !(cam === 2 && r.id === 0)) { // (no dust, spray or tyre smoke behind the demo cars on the title and menus: a clean picture; none from your own car in the cockpit, where it would bloom right in front of your eyes)
        if (r.hardBrake && Math.random() < 0.6) fx.tyreSmoke(x, z, [0.82, 0.82, 0.82]);
        else if (wet > 0.3 && r.v > 1.5 && Math.random() < 0.35 * Q.particles) fx.tyreSmoke(x, z, [0.75, 0.82, 0.92], 0.22);   // spray off a wet road
        else if (stA.desert && r.v > 1.5 && Math.random() < 0.25 * Q.particles) fx.tyreSmoke(x, z, [0.8, 0.7, 0.5], 0.25);       // dust in the desert
      }
      if (Q.trails && fxDt > 0 && RACE_STATES.has(state)) {
        const tr = fx.trailsFor(r.id), nit = r.alive && r.nitro > 0, amt = nit ? 1 : 0, rgb = [0.45, 0.8, 1.3]; // only during nitro: a thin blue streak that fades fast (no red tail-light ribbons at night)
        tr.l.step(x - 1.15 * c + 3.4 * s, 1.2, z + 1.15 * s + 3.4 * c, shiftZ, rgb, amt); tr.r.step(x + 1.15 * c + 3.4 * s, 1.2, z - 1.15 * s + 3.4 * c, shiftZ, rgb, amt);
      }
    }
    // traffic, pickups, scenery
    for (const [e, rec] of enemiesT.recs) {
      const o = rec.obj; o.position.set(lerp(rec.px, rec.cx, alpha), 0, lerp(rec.pz, rec.cz, alpha));
      o.visible = !(reelOn && Q.level === "low" && o.position.z < camTarget.z - 90); // (Low's title: only the traffic near your car is drawn)
      if (o.userData.wheels) for (const w of o.userData.wheels) w.rotation.x -= (e.cur || 0) * SCALE / 0.65 * dt * 60; // wheels turn with the vehicle's own speed
      const bl = o.userData.brakeLight; if (bl) { const ud = o.userData, c = e.cur || 0; if (ud.vPrev !== undefined && c < ud.vPrev - 1e-4) ud.brakeT = 0.5; else if (fxDt > 0) ud.brakeT = Math.max(0, (ud.brakeT || 0) - fxDt); ud.vPrev = c; bl.visible = ud.brakeT > 0; } // brake lights while it slows
    }
    for (const [k, rec] of pickupsT.recs) {
      const o = rec.obj; o.position.set(lerp(rec.px, rec.cx, alpha), 0, lerp(rec.pz, rec.cz, alpha));
      if (k.type !== "curve") o.rotation.y = time * 2.4 + (k.x || 0);
      if (k.type !== "coin") o.position.y = Math.sin(time * 3) * 0.25 + (k.type === "curve" ? 0.4 : 0);
    }
    for (const [it, rec] of puddlesT.recs) { rec.obj.position.set(rec.cx, 0.045, lerp(rec.pz, rec.cz, alpha)); rec.obj.scale.set(it.rx * SCALE * 1.4, 1, it.ry * SCALE * 1.8); }
    // everything leafy follows the city's colour, and the cars' lights come up at night
    setCol(leafMat.color, pal.leaf[0], pal.leaf[1], pal.leaf[2]); setCol(leafDarkMat.color, pal.leaf[0], pal.leaf[1], pal.leaf[2], 0.72); setCol(grassTopMat.color, pal.leaf[0], pal.leaf[1], pal.leaf[2], 1.12);
    M.lightMats.head.emissiveIntensity = 0.4 + 4 * night; M.lightMats.tail.emissiveIntensity = 0.8 + 2 * night;
    M.trafficLamp.color.setScalar(0.8 + 1.4 * night); { const p = M.trafficPool(); p.visible = night > 0.04; p.opacity = Math.min(0.32, night * 0.4); } // working lights on the traffic: lamps glow, headlamps light the road ahead
    for (const g of glows) g.mat.emissiveIntensity = g.base * (g.nightOnly ? night : 0.12 + 0.8 * night); // neon, lit windows and landmark lights come up at night (gently)
    tickLandmarks(time, night); // (the Las Vegas Sphere's LED shows)
    for (const name of START_FINISH) {
      const m = marks[name]; if (!m) continue;
      m.obj.position.set(0, 0, lerp(m.pz, m.cz, alpha));
      if (name === "start") { const dd = m.obj.position.distanceTo(camera.position), near = Math.min(1, Math.max(0, (dd - 6) / 30)); m.obj.userData.lights.forEach((mt, i) => { // (the lights fade down when the camera is right under them, or they would wash out the screen)
        const green = grid.done, red = !green && i < grid.lit;
        mt.emissive.set(green ? 0x00ff40 : red ? 0xff0000 : 0x000000); mt.emissiveIntensity = (green ? 2.4 : red ? 1.8 : 0) * (0.15 + 0.85 * near); mt.color.set(green ? 0x00aa30 : red ? 0xaa0000 : 0x220000); // (pure red at a lower strength: bright reds turn orange in the tone mapper)
      }); }
    }

    // what the camera follows: your car, interpolated. When you crash, the crash camera follows the wreck itself.
    const p0 = racers[0], rec0 = racersT.recs.get(p0);
    if (rec0 && (p0.alive || mode === "crash")) {
      camTarget.x = lerp(rec0.px, rec0.cx, alpha); camTarget.z = lerp(rec0.pz, rec0.cz, alpha); camTarget.tilt = lerp(rec0.pe, rec0.ce, alpha);
      camTarget.v = p0.alive ? p0.v : 0; camTarget.nitro = p0.alive && p0.nitro > 0; frozen = null;
    } else if (rec0 && !frozen) frozen = { x: camTarget.x, z: camTarget.z, tilt: 0, v: 0, nitro: false };
    const target = frozen || camTarget;
    // split screen: Player 2's camera follows Player 2 the same way (the crash camera if they crashed; the race camera if only Player 1 did)
    const p1 = split.on ? racers[1] : null, rec1 = p1 ? racersT.recs.get(p1) : null;
    const mode2 = !rec1 ? null : mode === "intro" ? "intro" : state === "over" && !p1.alive ? "crash" : mode === "crash" ? MODES[cam] : mode;
    if (rec1 && (p1.alive || mode2 === "crash")) {
      camTarget2.x = lerp(rec1.px, rec1.cx, alpha); camTarget2.z = lerp(rec1.pz, rec1.cz, alpha); camTarget2.tilt = lerp(rec1.pe, rec1.ce, alpha);
      camTarget2.v = p1.alive ? p1.v : 0; camTarget2.nitro = p1.alive && p1.nitro > 0; frozen2 = null;
    } else if (rec1 && !frozen2) frozen2 = { x: camTarget2.x, z: camTarget2.z, tilt: 0, v: 0, nitro: false };

    photo.update(dt);
    if (mode === "brief") { // the briefing's flyover ends on the city's signature landmark, on its plaza beside the road; when it has gone by, it is placed further up the road again (the camera glides over)
      const D0 = lerp(distPrev, distCur, alpha) * SCALE;
      if (!scOn) { sc = showcaseOf(mapIdx); if (sc) { scene.add(sc.set); scS = D0 + 300 + sc.r; scOn = true; } }
      if (scOn) {
        let z = D0 - scS; if (z > target.z - 20) { scS = D0 + 300 + sc.r; z = D0 - scS; rig.glide(); }
        const x = sc.side * sc.uc, pz = sc.plaza; sc.set.position.set(x, 0, z);
        // the city hands the plaza's ground over to it (its street front, blocks, trees and props there are hidden), and keeps its own copies of
        // the landmark out of the picture
        scClear.side = sc.side; scClear.x1 = pz ? pz.uMax : sc.uc + sc.r + 20; scClear.zNear = z + Math.max(pz ? pz.vNear : sc.r + 30, sc.cam.v + 25); scClear.zFar = z + (pz ? pz.vFar : -sc.r - 30); scClear.zLm = z; city.setShowcase(scClear);
        // where the flyover ends (see showcaseOf): a low postcard view across the plaza
        lmV.x = x; lmV.z = z; lmV.y = sc.h * 0.62; lmV.rad = sc.r; lmV.cx = sc.side * sc.cam.u; lmV.cy = sc.cam.y; lmV.cz = z + sc.cam.v; lmV.ly = sc.cam.ly; lmV.side = sc.side; lmOn = true;
      } else { // (a city without a signature model: the nearest landmark the city built)
        if (lmOn && D0 - lmAt.s > -60) { lmOn = false; rig.glide(); }
        if (!lmOn && city.landmarkAhead(D0, lmFirst ? 150 : 260, 900, lmAt)) { lmOn = true; lmFirst = false; }
        if (lmOn) { lmV.x = lmAt.x; lmV.z = D0 - lmAt.s; lmV.y = 6 * lmAt.sc; lmV.rad = lmAt.rad || 34; lmV.cx = undefined; }
      }
      cin.briefSX = W >= 540 ? (lmOn && lmV.cx !== undefined ? clamp(0.88 - 1.2 * lmV.rad / (Math.tan(21 * Math.PI / 180) * camera.aspect * Math.hypot(lmV.cx - lmV.x, lmV.cz - lmV.z)), 0.12, 0.42) : 0.42) : 0; cin.briefSY = W >= 540 ? 0 : 0.42; // (a wide landmark is moved left less, so it never runs off the edge) // (W: the 2D layout width; the city card is to the right, or at the bottom on a phone)
      cin.lm = lmOn ? lmV : null; cin.briefT = BT !== null ? +BT : time - briefAt; // (testing: ?bt=SECONDS holds the flyover at that moment)
    } else { lmFirst = true; if (scOn) { scene.remove(sc.set); city.setShowcase(null); scOn = false; } }
    // the briefing's postcard light (golden hour; a night city keeps its night), blended in over a second; a race always has the city's own sky
    world.briefTod = BRIEF_TOD[ROUTE[mapIdx] ? ROUTE[mapIdx].venue : ""] || (sc && sc.side < 0 ? "golden-" : "golden+");
    briefK = RACE_STATES.has(state) ? 0 : Math.max(0, Math.min(1, briefK + (mode === "brief" ? dt : -dt) * 1.2)); world.briefK = briefK * briefK * (3 - 2 * briefK);
    crashClock += dt * (time - crashAt < 1.0 ? 0.6 : 1); // the crash camera eases in gently
    cin.kick = kickFx; cin.shake = settings.shake ? shake : 0; cin.time = time; cin.gear = gearOf(p0.v); cin.lit = Math.round(rpmOf(effV(p0)) * 10);
    cin.crashT = crashClock; cin.finishT = time - finishAt; cin.photo = photo;
    if (intro) { cin.introT = intro.t; cin.introLen = intro.len; cin.introTo = MODES[cam]; }
    const D = lerp(distPrev, distCur, alpha) * SCALE; // how far along the route the car is (world units)
    let rf = null; // the title reel's effects this frame (null: not on the title)
    if (mode === "title") { // the title: the reel films your car racing through the city (titlereel.js) instead of a race camera
      if (!reelOn) { reelOn = true; reel.reset(); if (Q.level === "low") cityQuality(); }
      reelCar.x = target.x; reelCar.z = target.z; reelCar.D = D; reelCar.lane = p0.lane; reelCar.obj = rec0 ? rec0.obj : null;
      reelCtx.low = Q.level === "low"; reelCtx.capped = auto.capped; reelCtx.aspect = camera.aspect; reelCtx.rect = window.studioRects ? window.studioRects.title : FULL_RECT; reelCtx.vw = speed * SCALE * 60;
      rf = reel.update(dt, reelCar, reelCtx, camera); if (rf.shot !== R.reelShot && location.search.includes("stats")) console.info("SHOT " + rf.shot + " at " + time.toFixed(1) + " s, car lane " + p0.lane); R.reelShot = rf.shot; rig.mode = "title"; rig.cockpit.visible = false;
    } else {
      if (reelOn) { reelOn = false; reel.hide(); if (Q.level === "low") cityQuality(); } rig.update(mode, target, dt, cin);
      if (rec1) { Object.assign(cin2, cin); cin2.kick = 0; cin2.gear = gearOf(p1.v); cin2.lit = Math.round(rpmOf(effV(p1)) * 10); rig2.update(mode2, frozen2 || camTarget2, dt, cin2); } // (its own dashboard numbers; the nitro kick is Player 1's)
    }
    { // a soft light on your car: on the grid while the race-start sweep passes it, and in a race at night (from above and behind, like a broadcast
      // light, so your car never vanishes into the dark); on the title, a key light that rides with the reel's camera, or a red glow on the rear wing
      const k = mode === "intro" ? 120 * (1 - smooth01((intro.t - intro.len + 1.2) / 1.2)) : 0;
      const nk = RACE_STATES.has(state) && !photo.active && mode !== "crash" && p0.alive ? NIGHT_CAR_LIGHT * smooth01((night - 0.15) / 0.6) : 0;
      titleLight.intensity = Math.max(k, nk); titleLight.color.setHex(rf && rf.rear ? 0xff2a1a : 0xffe2bd);
      if (rf) { titleLight.intensity = rf.rear ? 320 : 11 * Math.pow(Math.max(2, rf.key.distanceTo(pTmp.set(target.x, 0.9, target.z))), 1.2); /* (as bright on the car from close up as from far: the light falls off with distance^1.2) */ if (rf.rear) { titleLight.position.set(target.x, 2.6, target.z + 8); titleLight.target.position.set(target.x, 1.1, target.z + 2.6); } else { titleLight.position.copy(rf.key); titleLight.target.position.set(target.x, 0.9, target.z); } }
      else if (k >= nk && k > 0) { titleLight.position.set(camera.position.x + 2.5, camera.position.y + 3, camera.position.z + 1); titleLight.target.position.set(target.x, 0.9, target.z); }
      else if (nk > 0) { titleLight.position.set(target.x, 15, target.z + 7); titleLight.target.position.set(target.x, 0.5, target.z - 1); }
    }
    if (rf && rec0) { const ud = rec0.obj.userData; reelNitro = rf.nitro; if (rf.rear) ud.brake.material.emissiveIntensity = 3.2 * (0.85 + 0.15 * Math.sin(time * 9)); if (ud.rain) ud.rain.material.emissiveIntensity = rf.rear ? 2 + Math.sin(time * 9) * 1.5 : 0; } // the rear shot: the rear wing glowing red
    focus.x = target.x; focus.z = target.z; focus.camPos = camera.position; // (reused every frame: nothing is allocated while racing)
    const roadWet = rf ? Math.max(wet, 0.75) : Math.max(wet, Q.level !== "low" ? 0.34 * smooth01((night - 0.3) / 0.5) : 0); // (the title's street is freshly wet: it mirrors the neon; a night city's streets are damp, so its lights shine in them: Medium and up)
    world.update(pal, rainI, D, focus, stA, stB, stBlend, roadWet); renderer.toneMappingExposure = world.exposure;
    city.setSignStyle(profileOf(stA.venue).sign); city.update(D, dt, night, pal, scene.fog.color, stA, camera.position.z);
    // inside a tunnel the sun and sky light are blocked out (the tunnel lights take over)
    tunnelK += ((city.inTunnel(D - camera.position.z) ? 1 : 0) - tunnelK) * Math.min(1, dt * 6);
    if (tunnelK > 0.01) { scene.environmentIntensity *= 1 - 0.8 * tunnelK; world.sun.intensity *= 1 - tunnelK; }
    scene.fog.near *= Q.dist; scene.fog.far *= Q.dist * (lowReel() ? 0.85 : 1);
    if (!Q.ibl) { scene.environment = null; world.fill.color.copy(scene.fog.color).multiplyScalar(1.5); world.fill.groundColor.copy(world.fill.color).multiplyScalar(0.45); world.fill.intensity = 2.3 - (lowReel() ? 0.7 : 1.5) * night; } // Low: no image-based lighting, so a plain sky-coloured ambient light instead
    else { world.fill.color.setRGB(0.56, 0.65, 1); world.fill.groundColor.setRGB(0.2, 0.25, 0.33); world.fill.intensity = 0.4 * night; } // (a little moonlight fill on the cars at night)
    // the race cars' paint (High and up): the city's own sky image as the paint's reflection map, stronger than on the rest of the city, so the
    // clear coat shows sharp sky and horizon highlights like the studio's strip lights. (The materials are shared with the studio, which undoes it.)
    { const env = Q.paint > 0 && Q.ibl ? scene.environment : null, k = Q.paint * scene.environmentIntensity; for (const rec of racersT.recs.values()) { const p = rec.obj.userData.paint; if (p) setPaint(p, env, k); } }
    const flash = weather.update(time, fxDt, camera.position, rainI, wind, pal.petals, mode, Q.rain);
    if (flash > 0) { scene.environmentIntensity += flash * 3; world.sun.intensity += flash * 4; } // lightning lights up the whole scene for a moment
    nightFx.update(night, city.lamps, city.lampCount, p0.alive && rec0 && !(rf && camera.position.z < camTarget.z - 1) /* (the title reel filming from in front: the headlights would glare off its wet road) */ ? (playerLight.x = camTarget.x, playerLight.z = camTarget.z, playerLight.yaw = -camTarget.tilt, playerLight) : null);
    const du = world.dome.material.uniforms; du.hazeAmt.value = night * 0.3; du.haze.value.setRGB(Math.pow(stA.s1[0] / 255, 2.2) * 0.5, Math.pow(stA.s1[1] / 255, 2.2) * 0.5, Math.pow(stA.s1[2] / 255, 2.2) * 0.5); // the glow of the city on the horizon
    du.glow.value.copy(du.haze.value).multiplyScalar(0.45); // (the drawn night sky's horizon glow: the same colour, gentler)

    // ---- finish line: fireworks and confetti in the city's flag colours ----
    if (state === "cleared" && level && fxDt > 0) {
      const cols = FLAG_COLS[ROUTE[level.idx].flag] || ["#ffd23f", "#ffffff"];
      if ((fwT -= dt) < 0 && time - finishAt < 9) { fwT = rnd(0.25, 0.55); fx.firework(target.x + rnd(-26, 26), rnd(24, 44), target.z - rnd(45, 85), cols); }
      if (time - finishAt < 0.2 && (R._cf = (R._cf || 0) + 1) % 3 === 0) fx.confetti(target.x, 8, target.z - 6, cols);
      if (Math.random() < 0.08) fx.confetti(target.x, 12, target.z - 8, cols);
    }
    // near miss: a streak of air
    const lp = pops.length ? pops[pops.length - 1] : null; if (lp && lp !== seenPop) { seenPop = lp; nearPulse = 1; if (rec0 && fxDt > 0) fx.nearMiss(camTarget.x, camTarget.z); } nearPulse *= Math.pow(0.04, dt);
    { const bt = typeof bypassTrack === "undefined" ? null : bypassTrack; bypass.update(bt, alpha, time); if (bt) { bypassWin.side = bt.side; bypassWin.zBack = simZ(bt.y0); bypassWin.zFront = bypassWin.zBack - bt.L * SCALE; city.setBypass(bypassWin); } else city.setBypass(null); }
    fx.update(fxDt * (time - crashAt < 1.0 && crashAt >= 0 && state === "over" ? 0.6 : 1), shiftZ, renderer.getDrawingBufferSize(sizeV).y / (2 * Math.tan(camera.fov * Math.PI / 360)));

    // ---- post-processing settings for this frame ----
    {
      const U = post.u, kmh = p0.v * 60, nf = typeof nitroFx === "number" ? nitroFx : 0;
      const gA = GRADE[stA.venue] || NO_GRADE, gB = GRADE[stB.venue] || NO_GRADE, mixv = (k, d) => (gA[k] ?? d) + ((gB[k] ?? d) - (gA[k] ?? d)) * stBlend;
      const wetDim = 1 - 0.12 * rainI;
      U.sat.value = mixv("sat", 1.1) * wetDim; U.contrast.value = mixv("contrast", 1.08) + 0.04 * night; // (a little punch by default: day cities read warm and crisp)
      const ta = gA.tint || [1, 1, 1], tb = gB.tint || [1, 1, 1];
      U.tint.value.setRGB(ta[0] + (tb[0] - ta[0]) * stBlend, ta[1] + (tb[1] - ta[1]) * stBlend, ta[2] + (tb[2] - ta[2]) * stBlend);
      const sa = gA.sh || ONE, sb = gB.sh || ONE, ha = gA.hi || ONE, hb = gB.hi || ONE; // (split toning: the shadows' and the highlights' own tints)
      U.shTint.value.setRGB(sa[0] + (sb[0] - sa[0]) * stBlend, sa[1] + (sb[1] - sa[1]) * stBlend, sa[2] + (sb[2] - sa[2]) * stBlend);
      U.hiTint.value.setRGB(ha[0] + (hb[0] - ha[0]) * stBlend, ha[1] + (hb[1] - ha[1]) * stBlend, ha[2] + (hb[2] - ha[2]) * stBlend);
      const sk = pal.tint; if (sk[3] > 0.005) U.tint.value.multiply(pTmpC.setRGB(1 + (sk[0] / 255 - 0.5) * sk[3] * 2, 1 + (sk[1] / 255 - 0.5) * sk[3] * 2, 1 + (sk[2] / 255 - 0.5) * sk[3] * 2));
      U.time.value = time; U.vig.value = 0.26 + 0.06 * nf + 0.08 * night;
      U.blur.value = Math.min(0.1, Math.max(0, (kmh - 300) / 1200) + nf * 0.05) * (mode === "menu" || mode === "title" || mode === "photo" || mode === "crash" || mode === "intro" || mode === "brief" ? 0 : 1);
      U.speedK.value = mode === "menu" || mode === "title" || mode === "photo" || mode === "crash" || mode === "intro" || mode === "brief" || mode === "cockpit" ? 0 : smooth01((kmh - 330) / 140) * (settings.shake === false ? 0.6 : 1); // speed lines past about 330 km/h (fewer with screen shake off)
      U.aberr.value = Q.ca ? nf * 0.003 : 0;   // (the picture stays clean and sharp at speed: only the faintest hint of speed blur, none from near misses or the nitro kick)
      U.heat.value = stA.desert ? (1 - night) * 0.9 : 0;       // heat shimmer in the desert cities by day
      U.fmode.value = photo.active ? photo.filter : 0; U.grain.value = photo.active && photo.filter === 2 ? 0.05 : 0; U.mdir.value.set(0, 0);
      { const crisp = (state === "title" || state === "menu") && Q.level !== "low"; post.smaa.enabled = Q.smaa || crisp; post.fxaa.enabled = Q.fxaa && !crisp; } // best anti-aliasing behind the title and menus
      post.bloom.strength = 0.1 + 0.16 * night + flash * 0.6 + nf * 0.2; post.bloom.threshold = 1.5 - 0.15 * night; post.bloom.radius = 0.4 + 0.05 * night; // (a soft, relaxed glow: no blinding halos; calm at night)
      // lens flare: only when the sun is on screen
      sunV.copy(world.sun.position).sub(camera.position).normalize(); const facing = sunV.dot(camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion));
      sunP.copy(camera.position).addScaledVector(sunV, 200).project(camera);
      const sunUp = Q.flare && world.sun.intensity > 1.2 && mode !== "overhead" && facing > 0.55 && sunP.z < 1;
      U.flareAmt.value = sunUp ? Math.min(1, (facing - 0.55) * 3) * Math.min(1, world.sun.intensity / 3) * (1 - rainI) * (1 - night) * 0.45 : 0;
      U.flarePos.value.set(sunP.x * 0.5 + 0.5, sunP.y * 0.5 + 0.5);
      // depth of field behind the menus and in photo mode
      const introDof = mode === "intro" && intro.t < intro.len - INTRO_BLEND * 0.6; // the race start's sweep: your car sharp, the city behind it soft (High and up)
      post.bokeh.enabled = Q.dof && ((photo.active && photo.dof) || introDof);
      if (post.bokeh.enabled) { const b = post.bokeh.uniforms; b.focus.value = camera.position.distanceTo(pTmp.set(target.x, 1, target.z)); b.aperture.value = photo.active ? photo.aperture : 0.0007; b.maxblur.value = photo.active ? 0.012 : 0.008; }
      if (mode === "intro") post.bloom.strength += 0.06; // (the city at its best: a touch more glow on the lights)
      if (rf) { // the title reel's lens: a deeper vignette, film grain, its motion blur, the flare off the nose, its depth of field, more glow on the neon, and its dips to black between shots
        U.vig.value = 0.5; U.grain.value = 0.03; U.mdir.value.set(rf.mb[0], rf.mb[1]); U.contrast.value += 0.04;
        U.flareAmt.value = Q.flare ? rf.flare.a : 0; if (rf.flare.a > 0) U.flarePos.value.set(rf.flare.x, rf.flare.y);
        post.bloom.strength += 0.1; post.bloom.threshold -= 0.1;
        post.bokeh.enabled = !!Q.dof && rf.ap > 0; if (post.bokeh.enabled) { const b = post.bokeh.uniforms; b.focus.value = rf.focus; b.aperture.value = rf.ap; b.maxblur.value = 0.01; }
        renderer.toneMappingExposure *= 0.03 + 0.97 * rf.expo;
      }
    }
    // mirrors first (cockpit view only), without the cockpit in them
    if (dry) return; // (getting the title ready behind the loading screen: everything is placed and built, nothing is drawn)
    if (split.on && rec1) { renderSplit(dt, mode, mode2); return; } // two players: each half of the screen, its own camera
    if (mode === "cockpit") {
      rig.cockpit.visible = false;
      const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; // the mirrors reuse the main view's shadows
      for (const m of rig.mirrors) { renderer.setRenderTarget(m.rt); renderer.render(scene, m.cam); }
      renderer.shadowMap.autoUpdate = au;
      renderer.setRenderTarget(null); rig.cockpit.visible = true;
    }
    const wantRefl = !!Q.reflect || (!!rf && !!Q.dof); if (wantRefl !== reflOn) { reflOn = wantRefl; reflect.enable(reflOn); } // (the title reel has real reflections on its wet street from High up)
    const waterNear = !!profileOf(stA.venue).water || !!profileOf(stB.venue).water; // (a city by the sea or a river: its water mirrors the city)
    if (reflOn && !split.on && (rf || ((roadWet > 0.12 || waterNear) && mode !== "menu"))) reflect.render(rf ? 0.85 : roadWet > 0.12 ? Math.min(1, roadWet * 1.3) : 0); else reflect.idle(); // High and up: reflections on a wet road (rain, or a damp night street) and on the water
    post.render(dt, camera.position);
    if (state === "playing") checkBlack("race");
    if (photo.capture) capture();
    if (auto.benchmarking && !warming && !gated.size) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); benchCost = renderer.info.programs.length !== programs ? -1 : performance.now() - now; } // (reading a pixel waits until the graphics chip has really finished the frame; a frame that had to compile a shader isn't a fair sample)
  }
  // ---------- split screen: the frame is drawn twice, Player 1's half then Player 2's, each with its own camera ----------
  // The renderer's viewport and scissor box limit drawing to one half; the post-processing pictures were sized for one half (resize), and only
  // their last step, onto the screen, lands in the half. The second half reuses the first one's shadows (the two cars are side by side).
  const halves = [{ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }];
  function renderSplit(dt, m0, m1) {
    const { cw, ch, side } = split, w = side ? cw / 2 : cw, h = side ? ch : ch / 2;
    halves[0].x = 0; halves[0].y = side ? 0 : h; halves[1].x = side ? w : 0; halves[1].y = 0; // (y counts up from the bottom: Player 1 on top when stacked)
    const au = renderer.shadowMap.autoUpdate, blur0 = post.u.blur.value;
    post.u.flareAmt.value = 0; // (the lens flare was worked out for one camera) (the wet-road and harbour reflections too: they are off in split screen, or each half would show the other camera's mirror image smeared over its road)
    renderer.setScissorTest(true);
    for (let k = 0; k < 2; k++) {
      const rg = k ? rig2 : rig, m = k ? m1 : m0, hv = halves[k], me = racers[k];
      for (const [r, rec] of racersT.recs) { const ud = rec.obj.userData, inside = m === "cockpit" && r === me; if (ud.setCockpit) ud.setCockpit(inside); else ud.helmet.visible = !inside; } // (in the cockpit view your own car's body is hidden)
      rig.cockpit.visible = rig2.cockpit.visible = false;
      if (m === "cockpit") { renderer.shadowMap.autoUpdate = false; for (const mr of rg.mirrors) { renderer.setRenderTarget(mr.rt); renderer.render(scene, mr.cam); } renderer.setRenderTarget(null); renderer.shadowMap.autoUpdate = k === 0 && au; }
      rg.cockpit.visible = m === "cockpit";
      renderer.setViewport(hv.x, hv.y, w, h); renderer.setScissor(hv.x, hv.y, w, h);
      post.u.blur.value = k === 0 ? blur0 : m === "crash" || m === "intro" ? 0 : Math.min(0.1, Math.max(0, (me.v * 60 - 300) / 1200)); // (the speed blur follows this player's own speed)
      post.setScene(scene, rg.camera); post.aoOff = true; post.render(dt, rg.camera.position); // (no ambient occlusion in split screen: it was set up for one camera, and two halves cost enough)
      renderer.shadowMap.autoUpdate = false;
    }
    renderer.shadowMap.autoUpdate = au; renderer.setScissorTest(false); renderer.setViewport(0, 0, cw, ch);
    post.setScene(scene, camera); rig.cockpit.visible = m0 === "cockpit"; rig2.cockpit.visible = false;
    if (state === "playing") checkBlack("race");
  }
  // ---------- the briefing's signature landmarks: built once each (when the map selects the city, not during the flyover), at full detail ----------
  const scClear = { side: -1, x0: 16.5, x1: 80, zNear: 0, zFar: 0, zLm: 0 }, scBox = new THREE.Box3(), scSize = new THREE.Vector3(), scCtr = new THREE.Vector3();
  const SHOWCASE_TURN = { mbs: -0.55 };
  // The landmark stands on a plaza beside the road (on the hillside's side, if the city has one: the town climbs the hill behind it), its front turned towards
  // where the flyover ends. Where that is: B_ANGLE round from straight across the road towards the cars, B_DIST x its size away (or further, so
  // a wide one fits), at about a third of its height: a low postcard view, the landmark against the sky and the city behind it.
  const B_ANGLE = 58 * Math.PI / 180;
  function showcaseOf(i) {
    const st = ROUTE[i], key = SHOWCASE[st.venue] || (st.lms || [])[0]; if (!key || !hasLandmark(key)) return null;
    const prof = profileOf(st.venue), side = prof.hill === "L" ? -1 : prof.hill === "R" ? 1 : prof.showSide || -1, id = key + side; // (on the hillside's side of the road: the city climbs the hill behind it)
    let e = showcases.get(id); if (e) return e;
    const raw = makeLandmark(key, 9); scBox.setFromObject(raw); scBox.getSize(scSize); scBox.getCenter(scCtr);
    const k = Math.min(64 / Math.max(1, scSize.y), 100 / Math.max(1, scSize.x, scSize.z), 7); // about 64 tall, at most 100 across
    const model = mergeStatic(raw); model.scale.setScalar(k); model.position.set(-scCtr.x * k, -scBox.min.y * k, -scCtr.z * k); // (stood on the ground, centred on its own footprint; merged: a few draw calls)
    const holder = new THREE.Group(); holder.add(model); holder.rotation.y = -side * (0.45 + (SHOWCASE_TURN[key] || 0)); // (its front turned most of the way to the camera: a three-quarter view)
    const r = Math.max(scSize.x, scSize.z) * k / 2, h = scSize.y * k, uc = 24 + r; // uc: its centre's distance from the middle of the road
    const d = Math.max(2.3 * h, 3.1 * r, 80), camU = Math.max(-10, uc - d * Math.cos(B_ANGLE)), camV = Math.sqrt(Math.max(1, d * d - (uc - camU) ** 2));
    const cam = { u: camU, v: camV, y: Math.min(30, Math.max(9, 0.34 * h + 5)), ly: 0.44 * h };
    const set = new THREE.Group(); set.add(holder);
    const plaza = buildPlaza(st, prof, { side, r, h, uc, cam }, city.kit, !!Q.cityDetail); if (plaza) set.add(plaza.group);
    e = { set, side, r, h, uc, cam, plaza }; showcases.set(id, e); return e;
  }
  R.prepShowcase = i => { try { showcaseOf(i); } catch (e) { console.warn(e); } R.preparePack(i); };
  // a city's own pack (citypack.js): fetched in the background now (the map, the briefing, the tyre screen before every race); it is put to use the
  // next time no race is running, so nothing ever changes or loads in the middle of one
  let packWanted = null, packReady = null;
  R.preparePack = i => { const st = ROUTE[i % ROUTE.length]; if (!st) return; const v = st.venue; packWanted = v; requestPack(v).then(p => { if (p && packWanted === v) packReady = p; }); if (!RACE_STATES.has(state)) setTimeout(() => { if (!RACE_STATES.has(state)) try { city.prewarm(i % ROUTE.length); } catch (e) { console.warn(e); } }, 60); }; // (and its landmarks are built now, not mid-race)
  function applyPack() { if (!packReady || RACE_STATES.has(state)) return; const p = packReady; packReady = null; if (p.towers) { setTowerPack(p.towers); city.setTowers(p.venue); } }
  const pTmpC = new THREE.Color(), painted = new Set();
  function setPaint(mats, env, k) {
    for (const m of mats) {
      if (env) { if (m.envMap !== env) m.envMap = env; m.envMapIntensity = k; m.envMapRotation.copy(scene.environmentRotation); painted.add(m); } // (turned like the sky, so the sun's highlight is where the sun is)
      else if (m.envMap) { m.envMap = null; m.envMapIntensity = 1; }
    }
  }
  const unpaint = () => { for (const m of painted) { m.envMap = null; m.envMapIntensity = 1; } painted.clear(); }; // (back in the studio: its own reflections)
  const MEASURE = new URLSearchParams(location.search).has("perf"); // (testing: ?perf also measures what each frame really costs, waiting for the graphics chip)
  let sampleN = 0; // (when frames are slow, every 30th one is timed to the end of the graphics chip's work: see auto.cost)
  const sampled = alpha => { const t = performance.now(); render(alpha); if (fps < 57 && ++sampleN % 30 === 0 && !auto.benchmarking) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); auto.cost(performance.now() - t); } };
  R.render = MEASURE ? alpha => { const t = performance.now(); render(alpha); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); R.cost = performance.now() - t; auto.cost(R.cost); } : sampled;
  // ---------- loading: only what the title needs comes first; everything else follows in the background while the title plays ----------
  const STATS = location.search.includes("stats"), nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  let warming = false, dry = false;
  // Compile every shader a scene needs without freezing the page: the graphics driver works on them in the background (where the browser
  // can: KHR_parallel_shader_compile), onProgress(0..1) says how many are ready. They are compiled for where the picture is really drawn
  // (the post-processing buffer, or the screen itself on Low), or they would only be compiled again on first use.
  // Only what is switched on is compiled (the cockpit, the rain, the bubbles... wait until they are first shown). They go to the driver in
  // small batches, `first` (a set of materials) in the first one: a browser that reports a batch only once all of it is done (Chrome on a
  // Mac does) still has the important ones ready early.
  const BATCH = 6;
  function compileQuietly(sc, cam, onProgress, first = null) {
    const objs = [], hidden = [], order = [], seen = new Set();
    const shown = new Set(); sc.traverseVisible(o => shown.add(o));
    sc.traverse(o => { if (!o.material) return; if (shown.has(o) || o.isInstancedMesh) { objs.push(o); prepLow(o.material); for (const m of [].concat(o.material)) if (!seen.has(m)) { seen.add(m); order.push(m); } } else hidden.push(o); }); // (three.js compiles hidden things too; the city's instanced rows are only hidden while empty, so they count)
    if (!post.direct) for (const m of post.materials()) if (!seen.has(m)) { seen.add(m); order.push(m); }
    const firstOnes = first ? order.filter(m => first.has(m)) : [], rest = order.filter(m => !firstOnes.includes(m)), batches = firstOnes.length ? [firstOnes] : [];
    for (let i = 0; i < rest.length; i += BATCH) batches.push(rest.slice(i, i + BATCH)); // (the essentials in one batch, then the rest six at a time)
    const mats = new Set(order), keep = objs.map(o => o.material), keepH = hidden.map(o => o.material);
    function compileBatch(list) {
      for (const m of list) unsent.delete(m);
      const want = new Set(list), was = renderer.getRenderTarget(); renderer.setRenderTarget(post.direct ? null : post.composer.readBuffer);
      try {
        for (const o of hidden) o.material = null;
        objs.forEach((o, i) => { o.material = [].concat(keep[i]).some(m => want.has(m)) ? keep[i] : null; });
        renderer.compile(sc, cam);
        for (const m of list) if (m.isShaderMaterial && !objs.some((o, i) => [].concat(keep[i]).includes(m))) renderer.compile(post.quad(m), cam); // (the post-processing passes' own materials)
      } finally { renderer.setRenderTarget(was); objs.forEach((o, i) => { o.material = keep[i]; }); hidden.forEach((o, i) => { o.material = keepH[i]; }); }
      gl.flush(); // (send them to the driver now: otherwise the browser may hold them until it next draws something)
    }
    for (const m of order) unsent.add(m);
    const total = Math.max(1, mats.size), job = { pending: mats, total, done: null, hold: false };
    let b = 0, sentAt = performance.now(), warm = false; if (batches.length) compileBatch(batches[b++]);
    job.done = new Promise(done => { const poll = () => {
      for (const m of mats) if (ready(m)) mats.delete(m);
      if (b < batches.length && !job.hold && !batches[b - 1].some(m => mats.has(m))) { // (the last batch is done: send the next; hold = not now)
        if (b === 1 && performance.now() - sentAt < 200) warm = true; // (the first batch came back at once: these shaders are cached, so send all the rest together)
        if (warm) { compileBatch(batches.slice(b).flat()); b = batches.length; } else compileBatch(batches[b++]);
      }
      if (onProgress) onProgress(1 - mats.size / total);
      if (mats.size || b < batches.length) setTimeout(poll, 20); else done(total);
    }; poll(); });
    return job; // { pending: the materials still compiling (shrinks as they finish), total, done: a promise }
  }
  const unsent = new Set(); // (materials waiting for their batch to go to the driver: not ready, whatever three.js says)
  const ready = m => { if (unsent.has(m)) return false; const p = renderer.properties.get(m).currentProgram; return !p || p.isReady(); };
  // A material whose shader is still compiling can be hidden (material.visible) until it is ready, then shown again by render(): the title
  // can appear before the last of its shaders are done, the rest appear a moment later, and nothing waits for a shader.
  const gated = new Set();
  function gate(mats) { for (const m of mats) if (m.visible) { m.visible = false; gated.add(m); } }
  function ungate() { const race = RACE_STATES.has(state); for (const m of gated) if (race || ready(m)) { m.visible = true; gated.delete(m); } } // (in a race everything shows at once, ready or not: an unseen car must never be on the road)
  // the title, behind the loading screen: its city is built and the shaders of everything in it start compiling. It appears when they are
  // all ready, or after 1.5 s once the essentials are (the sky, the road and your car: at most 8 s); whatever is still compiling then is
  // hidden until it is ready (a weak machine's first launch can spend many seconds compiling shaders)
  R.prepareTitle = async onProgress => {
    if (state !== "title") return; const t0 = performance.now();
    warming = dry = true; try { reel.force(0); render(1); } catch (e) { console.warn(e); } warming = dry = false; reelOn = false;
    if (STATS) console.info(`TITLE city built in ${Math.round(performance.now() - t0)} ms`);
    const key = new Set(), rec0 = racersT.recs.get(racers[0]);
    for (const o of [world.dome, ...world.groundMeshes, rec0 && rec0.obj]) if (o) o.traverse(c => { if (c.material) for (const m of [].concat(c.material)) key.add(m); });
    const job = compileQuietly(scene, camera, onProgress, key);
    for (;;) {
      const t = performance.now() - t0, keyLeft = [...key].some(m => job.pending.has(m));
      if (!job.pending.size || (t > 1500 && !keyLeft) || t > 8000) break;
      await new Promise(r => setTimeout(r, 20));
    }
    job.hold = true; // (no more batches until the title's first frame is drawn: anything that frame still has to compile would wait behind them)
    const n = job.total, left = job.pending.size; gate(job.pending);
    if (left) auto.finish("shaders still compiling", true); // (no frame can be measured fairly while they stream in: this level stays for now, unsaved, and the benchmark runs on the next launch; the watchdog still drops a level if it is too slow)
    warming = true; try { render(1); } catch (e) { console.warn(e); } warming = false; reelOn = false; job.hold = false; // (one real frame, still behind the loading screen: the last few shaders and the textures' uploads happen now, not in the benchmark)
    last = performance.now();
    if (STATS) console.info(`TITLE ready in ${Math.round(performance.now() - t0)} ms (${n} shaders${left ? `, ${left} still compiling: shown when ready` : ""})`);
  };
  let skiesLit = false; // (true once loading has begun: from then on a sky lacking its soft lighting gets it when the graphics need it)
  R.init = async onProgress => {
    const ok = await loadSky(renderer, FIRST_SKY, !!Q.ibl); onProgress(1); skiesLit = true; applyQuality();
    { const tp = await requestPack(ROUTE[TITLE_CITY].venue); if (tp && tp.towers) { setTowerPack(tp.towers); city.setTowers(tp.venue); } } // (the title's own city, Las Vegas: its pack is part of the first download)
    const dv = (new URLSearchParams(location.search).get("dev") || "").split(","); // (testing: a dev start goes straight into a race, so its city's pack is fetched here, before anything is shown)
    if (["tour", "single", "vs", "daily", "multi", "pause"].includes(dv[0])) { const i = (+dv[1] || 0) % ROUTE.length, st = ROUTE[i], p = await requestPack(st.venue); if (p && p.towers) { setTowerPack(p.towers); city.setTowers(p.venue); } city.prewarm(i); }
    return ok ? 1 : 0;
  }; // the title's sky (its lighting only if the preset uses it); call once before the first render // the title's sky (its lighting only if the preset uses it); call once before the first render
  // after the title is up: the other skies, then the studio (main menu, Garage) and its cars, a piece per frame
  R.loadInBackground = async () => {
    while (auto.benchmarking) await nextFrame(); // (after the benchmark: its frames must not include this loading's work)
    bgLoading = true; try { await loadBackground(); } finally { bgLoading = false; }
  };
  const loadBackground = async () => {
    const t0 = performance.now();
    for (const name of ["golden", ...TODS.filter(n => n !== "golden")]) await loadSky(renderer, name, !!Q.ibl); // (the briefing's golden-hour sky first: the map can be reached in a few seconds)
    if (STATS) console.info(`BACKGROUND skies done in ${Math.round(performance.now() - t0)} ms`);
    await nextFrame(); if (!showroom) buildShowroom();
    await nextFrame(); if (!showWas) { fillView(studioView, 0); showroom.update(0, studioView); } await compileQuietly(showroom.scene, showroom.camera).done; // (your car on the turntable, so its shaders are compiled with the studio's lights)
    for (let i = 0; i < TEAMS.length; i++) { await nextFrame(); showroom.warm(i, TEAMS[i]); } // (the menu parade never waits for a car to be built)
    if (STATS) console.info(`BACKGROUND loading done in ${Math.round(performance.now() - t0)} ms`);
  };
  Object.defineProperty(R, "benchmarking", { get: () => auto.benchmarking }); // (the first launch: Auto is timing the city to pick a preset)
  Object.defineProperty(R, "benchProgress", { get: () => auto.progress }); // (0..1, for the loading bar)
  R.finishBenchmark = () => { if (auto.finish("loading screen done")) applyQuality(); };
  R.loadingUp = true; // (boot.js clears it when the loading screen goes)
  Object.defineProperty(R, "settling", { get: () => gated.size > 0 }); // (shaders still compiling, their things hidden)
  R.device = device;

  // ---------- the Garage showroom (built once, reused; see showroom.js) ----------
  const SETTLE = new URLSearchParams(location.search).get("settle"); const GFIX = new URLSearchParams(location.search).has("gscript");
  { const pass = post.bokeh, draw = pass.render.bind(pass); pass.render = (...a) => { const hz = showroom && pass.scene === showroom.scene ? showroom.haze : null; if (hz) for (const o of hz) o.visible = false; draw(...a); if (hz) for (const o of hz) o.visible = Q.level !== "low"; }; } // (the see-through haze shafts stay out of the depth picture the depth of field reads)
  function buildShowroom() {
    const t0 = performance.now();
    showroom = createShowroom({ renderer, makeCar: team => M.makeRaceCar(team), safe });
    showroom.setQuality(Q); showroom.resize(canvas2d.clientWidth, canvas2d.clientHeight); showroom.warm(equipped, TEAMS[equipped]); sizeKey = ""; // (your own car first; the others follow in the background)
    if (location.search.includes("stats")) console.info("SHOWROOM built in " + Math.round(performance.now() - t0) + " ms");
  }
  // testing: ?gscript=F:action,... plays the Garage at a fixed 60 fps, doing each action (left, right, buy, ...) at frame F, and stops the game on the frame named "freeze", so a screenshot can show any moment of a transition
  function runGarageScript(view) {
    const steps = new URLSearchParams(location.search).get("gscript").split(",").map(s => s.split(":")); let f = 0; overAt = -1e9; // (no "just crashed" guard on the buttons)
    const frame = () => { f++; fillView(view, 1 / 60); showroom.update(1 / 60, view); };
    for (const [t, act] of steps) { while (f < +t) frame(); if (act === "freeze") { while (f < +t) frame(); window.gFreeze = true; document.getAnimations().forEach(a => a.pause()); console.info("GSCRIPT " + JSON.stringify({ d: showroom.debug(), layout: window.garageLayout })); return; } if (act === "buy") garageAction(); else if (/^(Arrow|Enter|Escape)/.test(act)) document.dispatchEvent(new KeyboardEvent("keydown", { code: act, bubbles: true })); else menuAction(act); }
  }
  // which camera view each studio screen uses (showroom.js): the menu (car to one side), the Garage, the tyre close-up
  const viewOf = s => s === "garage" || s === "upgrades" ? "garage" : s === "tyres" ? "tyre" : "menu";
  const studioView = { view: "", idx: 0, team: null, locked: false, spinIn: 0, menuK: 0, tint: null, tyre: "", parade: false, paradeP: 8 };
  // the main menu's parade: every PARADE seconds the next team's car takes the turntable (yellow, purple, ... round and round), starting with yours
  const PARADE = +(new URLSearchParams(location.search).get("parade") || 8), parade = { idx: -1, t: 0 }; // (testing: &parade=S switches every S seconds)
  function fillView(view, dt = 0) { // what the studio shows for the screen you are on
    const garage = state === "garage" || state === "upgrades", n = MAIN_MENU.length, menuish = viewOf(state) === "menu";
    if (menuish) { if (parade.idx < 0) parade.idx = equipped; if (state === "menu" && (parade.t += dt) >= PARADE) { parade.t -= PARADE; parade.idx = (parade.idx + 1) % TEAMS.length; if (location.search.includes("stats")) console.info("PARADE " + TEAMS[parade.idx].name); } } // (it only moves on while the main menu is up)
    view.view = viewOf(state); view.idx = garage ? garageIdx : menuish ? parade.idx : equipped; view.parade = menuish; view.paradeP = PARADE; view.team = TEAMS[view.idx]; view.locked = garage && !owned.includes(garageIdx); view.spinIn = garageSpin;
    view.menuK = state === "menu" && n > 1 ? clamp(sel, 0, n - 1) / (n - 1) * 2 - 1 : 0; view.tint = state === "menu" && CARD_INFO[sel] ? CARD_INFO[sel].col : null; // (each menu card turns the camera a little and tints a rim light)
    view.tyre = state === "tyres" ? TYRES[clamp(sel, 0, TYRES.length - 1)].key : "";
  }
  function renderShowroom(dt) {
    if (!showroom) buildShowroom();
    if (!showWas) { parade.idx = equipped; parade.t = 0; } // (arriving in the studio: your own car leads the parade)
    const view = studioView; fillView(view, dt);
    showroom.setQuality(Q); showroom.setLayout(window.garageLayout);
    const rs = window.studioRects; if (rs) { showroom.setRect("menu", rs.menu); showroom.setRect("tyre", rs.tyre); } // (where the 2D layer leaves room for the car)
    if (!showWas) { showWas = true; unpaint(); showroom.enter(); if (SETTLE !== null) { for (let i = 0; i < 30; i++) showroom.update(0.05, view); showroom.spin(+SETTLE || 0); } } // (testing: ?settle=ANGLE skips the intro and starts at that turntable angle)
    if (GFIX && !window.gDone) { window.gDone = true; runGarageScript(view); if (window.gFreeze) dt = 0; } // (testing)
    showroom.update(dt, view);
    showroom.beforeRender();
    post.setScene(showroom.scene, showroom.camera); renderer.toneMappingExposure = showroom.exposure; post.aoOff = true; // (the showroom has its own lighting and no AO)
    const U = post.u; U.speedK.value = 0; U.sat.value = 1.08; U.contrast.value = 1.06; U.tint.value.setRGB(1, 1, 1); U.shTint.value.setRGB(0.98, 1.0, 1.03); U.hiTint.value.setRGB(1.02, 1.0, 0.98); U.vig.value = 0.4; U.blur.value = 0; U.aberr.value = 0; U.heat.value = 0; U.fmode.value = 0; U.time.value = time;
    U.grain.value = 0; U.mdir.value.set(0, 0); U.flareAmt.value = 0;
    post.bloom.strength = 0.32; post.bloom.threshold = 1.2; post.bloom.radius = 0.6;
    post.bokeh.enabled = !!Q.dof && showroom.aperture > 0.0001; // depth of field (High and up): the subject sharp, the room behind it soft
    if (post.bokeh.enabled) { const b = post.bokeh.uniforms; b.focus.value = showroom.focus; b.aperture.value = showroom.aperture; b.maxblur.value = 0.011; }
    post.smaa.enabled = Q.level !== "low"; post.fxaa.enabled = !post.smaa.enabled && Q.fxaa; // (best anti-aliasing the machine can afford: the scene is cheap)
    post.render(dt);
    checkBlack("studio");
  }

  // ---------- the safety net: about 1.5 s into the studio, and into the first race, 12 pixels of the finished picture are read back, once.
  // If every one of them is pure black, the browser failed at something it said it could do: take the safe path (see SAFE above). ----------
  const blackFrames = { studio: 0, race: 0 };
  function checkBlack(kind) {
    if (safe || ++blackFrames[kind] !== 90) return;
    renderer.setRenderTarget(null); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; let sum = 0;
    for (let i = 1; i <= 4; i++) for (let j = 1; j <= 3; j++) { gl.readPixels(Math.floor(w * i / 5), Math.floor(h * j / 4), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); sum += px1[0] + px1[1] + px1[2]; }
    if (sum === 0) { console.warn(`3D picture came out black in the ${kind}: switching to the safe drawing path`); safe = true; if (!location.search.includes("blacktest")) store.set("gfxSafe", true); applyQuality(); }
  }
  R.forceBlackCheck = () => { blackFrames.studio = blackFrames.race = 0; }; // (testing)
  Object.defineProperty(R, "safe", { get: () => safe });

  // ---------- photo mode: save what's on screen as a PNG ----------
  function capture() {
    photo.capture = false;
    const c = document.createElement("canvas"); c.width = glCanvas.width; c.height = glCanvas.height; const g = c.getContext("2d");
    g.drawImage(glCanvas, 0, 0);
    if (!photo.hideHud) g.drawImage(canvas2d, 0, 0, c.width, c.height);
    c.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `extreme-racer-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); photo.note = "Saved to your Downloads"; });
  }

  // where a racer is on the 2D canvas right now (for the "CLOSE!" popups beside the car). k = 1: as Player 2's camera sees it (split screen;
  // the HUD then draws in that half, with W and H set to the half's size)
  const v3 = new THREE.Vector3();
  function racerScreen(r, k = 0) {
    const rec = racersT.recs.get(r);
    if (!rec) return { x: W / 2, y: H * 0.55 };
    v3.set(rec.cx, 2.2, rec.cz).project(k ? camera2 : camera);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
  }

  return R;
}
