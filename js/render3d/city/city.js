// THE CITY: buildings, ground, water and street life, built around the road as you drive.
//
// The road is cut into "chunks" (slices along the route). Four layers each cut it differently:
//   F  street front   (0..30 units from the kerb, chunks of 40): buildings lining the circuit, shops, signs, lamps, trees, people, parked cars
//   B  city blocks    (50..360, chunks of 60): a grid of lots with mid- and high-rise buildings, houses, farms, boats
//   S  skyline        (340..1150, chunks of 120): a dense layer of cheap towers, hills and distant towns
//   G  ground         (chunks of 60): pavement, grass, sand, fields and water
//   H  heroes         (chunks of 60): landmarks, grandstands and country props, placed one by one
// Each chunk is built from a seeded random generator keyed by (city, chunk number), so a city looks the same on every run.
// Every layer is a ring of slots: when a chunk scrolls behind you its slot is rewritten with the next chunk ahead. Nothing is
// created while driving, and each kind of thing is ONE draw call however many copies are on screen.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SCALE, roadHalf } from "../mapping.js";
import { rng, hash, noise2 } from "./rng.js";
import { profileOf, ZONES, PALETTES, FACADES, WALLS, LANDMARKS_3D, cityColors } from "./profiles.js";
import { makeGate } from "../gate.js";
import { SlotMesh } from "./slotmesh.js";
import { KitMesh } from "./kit.js";
import { MAX_CITY_AHEAD } from "../quality.js";
import { unitBox, unitPlane, roofGeo, hipRoofGeo, lampGeo, lampGlowGeo, personGeo, headGeo, hillGeo, treeGeos, palmGeos, yachtGeo, busStopGeo, carGeo, fenceTexture, flowerBedGeo } from "./geo.js";
import { shared, buildingMaterial, solidMaterial, makeSignAtlas, signMaterial, signRect, SIGN_COUNT, makeBannerAtlas, groundMaterials, makeRoadSignAtlas, roadSignMaterial, roadSignRect, towerMaterial } from "./materials.js";
import { leafMat, crowdMat, setCrowd, lightWindows, windowMats } from "../scenery.js";
import { cloneModel, hasModel, fitModel, sceneOf } from "../assets.js";
import { makeLandmark, hasLandmark } from "../landmarks.js";
import { makeProp, hasProp } from "../props.js";
import { mergeStatic } from "../merge.js"; // (a landmark / prop is many little meshes: merged into one per material, so a hero costs a handful of draw calls)

const LF = 40, LB = 60, LS = 120, LG = 60, LH = 60;                // chunk lengths
const AHEAD = { F: 330, B: 640, S: 1450, G: 1450 }, BEHIND = { F: 100, B: 140, S: 140, G: 140 };
const ROAD_EDGE = 17.4;                                            // where the kerb ends
const X0 = 60;                                                     // the first column of city blocks starts this far from the road centre
const STRIPS = [[ROAD_EDGE, 28], [28, 340], [340, 1500]];          // ground strips (x from the road centre)
const FORCE_ZONE = new URLSearchParams(location.search).get("zone"); // testing: ?zone=harbour forces one neighbourhood type everywhere
const HERO_ALL = new URLSearchParams(location.search).has("heroes"); // testing: ?heroes puts a landmark, a grandstand and props in every chunk

const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const PAL = Object.fromEntries(Object.entries(PALETTES).map(([k, v]) => [k, v.map(lin)]));
const AWNINGS = ["#c8372d", "#2d6fb5", "#2e8b57", "#e0a526", "#7a3f9d", "#e9e9e4", "#d9622b"].map(lin);
const ROOF_KIT = ["#8b9096", "#6f757c", "#a7abb0", "#5d6269"].map(lin);
const BOAT = ["#f4f4f2", "#f4f4f2", "#1c2a3a", "#c8d4dc", "#e8e2d0"].map(lin);
const CAP = { F: { boxes: 36, roofs: 36, solid: 150, signs: 34, banners: 14, lamps: 6, glow: 6, light: 10, trees: 20, people: 24, cars: 4, stops: 2, fence: 12, models: 6, flowers: 6 },
  B: { boxes: 64, roofs: 64, solid: 120, trees: 40, houses: 26, yachts: 44, models: 12 }, S: { boxes: 110, roofs: 110, hills: 18 } };
const CAR_MODELS = ["sedan", "sedan-sports", "hatchback-sports", "suv", "taxi", "van"];
const BUILD_MODELS = ["building-a", "building-d", "building-i", "building-skyscraper-a", "building-skyscraper-d"];

const mod = (a, n) => ((a % n) + n) % n;
const ccCache = []; const ccOf = idx => ccCache[idx] || (ccCache[idx] = cityColors(ROUTE[idx].venue).map(lin)); // a city's colours, linear RGB
// a hillside (Monaco): the ground rises from 52 units out on the hill's side, and the city climbs it
const HILL_TOP = 150, hy = (x, s0 = 52) => Math.min(HILL_TOP, Math.max(0, (x - s0) * 0.42)); // (s0: how far from the road the slope starts, see hillStart in profiles.js)
const hillY = (prof, side, x) => prof.hill && (prof.hill === "L" ? -1 : 1) === side ? hy(x, prof.hillStart) : 0;

// Kenney building as one geometry scaled to a 1x1x1 box (base at y=0), so an instance size is the building's real size
function unitModel(name) {
  if (!hasModel(name)) return null;
  const root = cloneModel(name); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = []; let material = null;
  root.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); material = material || o.material; for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k); parts.push(g.index ? g.toNonIndexed() : g); });
  const all = mergeGeometries(parts); all.computeBoundingBox(); const bb = all.boundingBox, sz = new THREE.Vector3(); bb.getSize(sz);
  all.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(1 / sz.x, 1 / sz.y, 1 / sz.z);
  lightWindows([{ material }]);
  return { geometry: all, material, aspect: sz.y / Math.max(sz.x, sz.z), tower: name.includes("skyscraper") };
}


export function createCity(scene) {
  const root = new THREE.Group(); root.name = "city"; scene.add(root);
  const gF = new THREE.Group(), gB = new THREE.Group(), gS = new THREE.Group(), gG = new THREE.Group(), gH = new THREE.Group(), gBack = new THREE.Group(); root.add(gF, gB, gS, gG, gH, gBack);

  const bMat = buildingMaterial(), sMat = solidMaterial(), ground = groundMaterials(), tMat = towerMaterial();
  const signTex = { paint: makeSignAtlas("paint"), neon: makeSignAtlas("neon"), "neon-jp": makeSignAtlas("neon-jp") }; // (Tokyo's in Japanese)
  const signMat = signMaterial(signTex.paint);
  const sponsors = typeof SPONSORS !== "undefined" ? SPONSORS : [["EXTREME RACING", "#7b2cbf"]];
  const banners = makeBannerAtlas(sponsors), bannerMat = signMaterial(banners.tex);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.9 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.5 });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.82, 0.5), toneMapped: false });
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.9, 0.7), toneMapped: false });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a77e, roughness: 0.8 });
  const stopMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.85 });
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTexture(), alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 }); // (lit galvanised steel; with multisampling its thin wires are smoothed instead of flickering)
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1, vertexColors: true }); // (the yacht shape carries its own white, glass and teak)
  const TYPES = { round: "tree_default", pine: "tree_pineTallA", palm: "tree_palmTall", cactus: "cactus_tall" };
  const treeG = {}; for (const [k, name] of Object.entries(TYPES)) treeG[k] = treeGeos(name);
  treeG.palmHD = palmGeos(); // (Medium and up: a palm with a curving ringed trunk and real fronds instead of the low-poly one; see addTree)
  const carG = CAR_MODELS.map(carGeo).filter(Boolean), modelG = BUILD_MODELS.map(unitModel).filter(Boolean);
  const modelPick = { all: modelG.map((_, i) => i), low: modelG.map((g, i) => g.tower ? -1 : i).filter(i => i >= 0) }; // (old towns get no glass skyscrapers)
  const modelsFor = prof => prof.kenney === false ? [] : prof.towers === false ? modelPick.low : modelPick.all; // (kenney: false, a city whose own style the stock buildings would spoil)

  const slotsOf = id => Math.ceil((AHEAD[id] * MAX_CITY_AHEAD + BEHIND[id]) / { F: LF, B: LB, S: LS, G: LG }[id]) + 2; // (room for the furthest graphics preset)
  const nF = slotsOf("F"), nB = slotsOf("B"), nS = slotsOf("S"), nG = slotsOf("G");

  // ---- the instanced meshes ----
  const F = {
    boxes: new SlotMesh(gF, unitBox, bMat, nF, CAP.F.boxes, { color: true, seed: true, shadow: true }),
    roofs: new SlotMesh(gF, hipRoofGeo(), sMat, nF, CAP.F.roofs, { color: true, shadow: true }),
    solid: new SlotMesh(gF, unitBox, sMat, nF, CAP.F.solid, { color: true, shadow: true }),
    signs: new SlotMesh(gF, unitPlane, signMat, nF, CAP.F.signs, { rect: true }),
    banners: new SlotMesh(gF, unitPlane, bannerMat, nF, CAP.F.banners, { rect: true }),
    lamps: new SlotMesh(gF, lampGeo(), lampMat, nF, CAP.F.lamps, { shadow: true }),
    glow: new SlotMesh(gF, lampGlowGeo(), glowMat, nF, CAP.F.glow, {}),
    light: new SlotMesh(gF, unitBox, lightMat, nF, CAP.F.light, {}),
    people: new SlotMesh(gF, personGeo(), sMat, nF, CAP.F.people, { color: true }),
    heads: new SlotMesh(gF, headGeo(), skinMat, nF, CAP.F.people, {}),
    stops: new SlotMesh(gF, busStopGeo(), stopMat, nF, CAP.F.stops, { shadow: true }),
    fence: new SlotMesh(gF, unitPlane, fenceMat, nF, CAP.F.fence, {}),
    flowers: new SlotMesh(gF, flowerBedGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), nF, CAP.F.flowers, {}),
    cars: carG.map(c => new SlotMesh(gF, c.geometry, c.material, nF, CAP.F.cars, { shadow: true })),
    models: modelG.map(c => new SlotMesh(gF, c.geometry, c.material, nF, CAP.F.models, { shadow: true })),
    trees: {},
  };
  // the street kit (real CC0 models, Medium and up): concrete barriers painted in the city's colours, Victorian lamp posts in the old cities, and
  // bins, fire hydrants, benches and utility boxes on the pavements (see kit.js)
  const K = {
    barrier: new KitMesh(gF, "barrier", nF, 22, { color: true, shadow: true }),
    lamp: new KitMesh(gF, "lamp-a", nF, 6, { shadow: true }),
    bin: new KitMesh(gF, "bin", nF, 4, { shadow: true }),
    hydrant: new KitMesh(gF, "hydrant", nF, 3, {}),
    bench: new KitMesh(gF, "bench-modern", nF, 3, { shadow: true }),
    box: new KitMesh(gF, "utility-box", nF, 3, { shadow: true }),
    signs: new SlotMesh(gF, unitPlane, roadSignMaterial(makeRoadSignAtlas()), nF, 3, { rect: true }), // fictional road signs on posts
    towers: new SlotMesh(gF, unitBox, tMat, nF, 8, { seed: true, shadow: true }), // skyscrapers clad in the city pack's facade photos (see towered)
  };
  const towersB = new SlotMesh(gB, unitBox, tMat, nB, 24, { seed: true, shadow: true }), towersS = new SlotMesh(gS, unitBox, tMat, nS, 48, { seed: true });
  const B = {
    boxes: new SlotMesh(gB, unitBox, bMat, nB, CAP.B.boxes, { color: true, seed: true, shadow: true }),
    solid: new SlotMesh(gB, unitBox, sMat, nB, CAP.B.solid, { color: true }),
    houses: new SlotMesh(gB, unitBox, sMat, nB, CAP.B.houses, { color: true, shadow: true }),
    roofs: new SlotMesh(gB, roofGeo(), sMat, nB, CAP.B.houses, { color: true }),
    hroofs: new SlotMesh(gB, hipRoofGeo(), sMat, nB, CAP.B.roofs, { color: true }),
    yachts: new SlotMesh(gB, yachtGeo(), boatMat, nB, CAP.B.yachts, { color: true }),
    models: modelG.map(c => new SlotMesh(gB, c.geometry, c.material, nB, CAP.B.models, { shadow: true })),
    trees: {},
  };
  const S = {
    boxes: new SlotMesh(gS, unitBox, bMat, nS, CAP.S.boxes, { color: true, seed: true }),
    roofs: new SlotMesh(gS, hipRoofGeo(), sMat, nS, CAP.S.roofs, { color: true }),
    hills: new SlotMesh(gS, hillGeo(1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), nS, CAP.S.hills, { color: true }),
  };
  for (const k of Object.keys(treeG)) {
    const t = treeG[k]; if (!t) continue;
    F.trees[k] = { trunk: t.trunk ? new SlotMesh(gF, t.trunk, trunkMat, nF, CAP.F.trees, { shadow: true }) : null, leaves: t.leaves ? new SlotMesh(gF, t.leaves, leafMat, nF, CAP.F.trees, { shadow: true }) : null };
    B.trees[k] = { trunk: t.trunk ? new SlotMesh(gB, t.trunk, trunkMat, nB, CAP.B.trees, {}) : null, leaves: t.leaves ? new SlotMesh(gB, t.leaves, leafMat, nB, CAP.B.trees, {}) : null };
  }
  const treeMeshes = T => Object.values(T).flatMap(t => [t.trunk, t.leaves]).filter(Boolean);
  const listF = [F.boxes, F.roofs, F.solid, F.signs, F.banners, F.lamps, F.glow, F.light, F.people, F.heads, F.stops, F.fence, F.flowers, ...F.cars, ...F.models, ...treeMeshes(F.trees), ...Object.values(K).flatMap(k => k.meshes || [k])];
  const listB = [B.boxes, B.solid, B.houses, B.roofs, B.hroofs, B.yachts, ...B.models, ...treeMeshes(B.trees), towersB];
  const listS = [S.boxes, S.roofs, S.hills, towersS];
  // a city whose pack has arrived (citypack.js) clads its skyscrapers in real facade photos (Medium and up); set by setTowers()
  let towerVenue = null; const towered = ctx => !!quality.detail && towerVenue === ctx.st.venue && ctx.prof.towers !== false;

  // ---- ground: for each chunk slot, three strips per side ----
  const gslots = [];
  const stripGeo = (side, x0, x1) => { // a quad lying on the ground; UVs are world units so every texture says how big its own repeat is
    const a = side * x0, b = side * x1, g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([a, 0, 0, b, 0, 0, b, 0, -LG, a, 0, -LG], 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([x0, 0, x1, 0, x1, LG, x0, LG], 2));
    g.setIndex(side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); return g;
  };
  const geos = [-1, 1].map(side => STRIPS.map(([x0, x1]) => stripGeo(side, x0, x1)));
  const hillStrip = (side, x0, x1, s0) => { // the same strip, rising up the hillside
    const xs = []; for (let x = x0; x < x1; x += x < 520 ? 24 : 240) xs.push(x); xs.push(x1);
    const pos = [], uv = [], idx = [];
    for (const x of xs) for (const z of [0, -LG]) { pos.push(side * x, hy(x, s0), z); uv.push(x, -z); }
    for (let i = 0; i < xs.length - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (side > 0) idx.push(a, c, d, a, d, b); else idx.push(a, d, c, a, b, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const hillGeoCache = new Map(), hillGeos = s0 => hillGeoCache.get(s0) || hillGeoCache.set(s0, [-1, 1].map(side => STRIPS.map(([x0, x1]) => hillStrip(side, x0, x1, s0)))).get(s0); // (one set per slope start)
  ground.city.map.offset.set(-X0 / 30, 0);
  for (let i = 0; i < nG; i++) {
    const grp = new THREE.Group(), meshes = [];
    for (let si = 0; si < 2; si++) { meshes.push([]); for (let st = 0; st < 3; st++) { const m = new THREE.Mesh(geos[si][st], ground.grass); m.receiveShadow = true; grp.add(m); meshes[si].push(m); } }
    gG.add(grp); gslots.push({ grp, meshes, chunk: NaN, city: -1, start: 0 });
  }

  // ---- bookkeeping per layer ----
  const mkLayer = (id, L, n, meshes) => ({ id, L, n, meshes, chunk: new Float64Array(n).fill(NaN), city: new Int32Array(n).fill(-1), start: new Float64Array(n), data: Array.from({ length: n }, () => ({})) });
  const lay = { F: mkLayer("F", LF, nF, listF), B: mkLayer("B", LB, nB, listB), S: mkLayer("S", LS, nS, listS) };
  let sBase = 0, lastD = 0, quality = { ahead: 1, density: 1, detail: 1 }, bypassClear = null;
  let showcase = null; // the briefing's plaza beside the road, cleared for the city's signature landmark: { side, x0, x1, zNear, zFar } in world units
  const inShowcase = (x, wz) => { const s = showcase; return !!s && x * s.side > s.x0 && x * s.side < s.x1 && wz < s.zNear && wz > s.zFar; };
  let maskZ = 0; const maskFn = (x, z) => inClearing(x, z + maskZ) || inShowcase(x, z + maskZ);
  const inClearing = (x, wz) => { const t = bypassClear; return !!t && x * t.side > 17 && x * t.side < 28.6 && wz < t.zBack + 12 && wz > t.zFront - 14; }; // world z: the track runs from zBack (where it starts) up the road to zFront
  const lamps = []; let lampCount = 0;

  // ---- which city / neighbourhood is at a place on the route ----
  function cityForS(s) { // s in world units along the route
    if (typeof level !== "undefined" && level) return { idx: level.idx, start: level.d0 * SCALE };
    if (state === "title") return { idx: TITLE_CITY, start: STAGE_LEN * TITLE_CITY * SCALE }; // the title drives on through its one city for as long as it is up
    const sim = s / SCALE, c = sim >= cityLeg.d1 ? null : sim >= cityLeg.d0 ? cityLeg : cityPrev; // (Endless / Vs: cities last a set time, see sim/stages.js)
    return c ? { idx: mod(c.idx, ROUTE.length), start: c.d0 * SCALE } : { idx: mod(cityLeg.idx + 1, ROUTE.length), start: cityLeg.d1 * SCALE };
  }
  const zonePick = (profile, city, block) => {
    if (FORCE_ZONE) return FORCE_ZONE;
    const r = rng(hash(city, block, 1234)), entries = Object.entries(profile.zones), tot = entries.reduce((a, [, w]) => a + w, 0);
    let x = r() * tot; for (const [name, w] of entries) { if ((x -= w) < 0) return name; } return entries[0][0];
  };
  function zoneAt(prof, city, sRel, side) { // the neighbourhood next to the road at sRel, on one side
    const block = Math.floor(sRel / 300), op = prof.opening; // (a city can choose what lines the road as you arrive: Monaco opens on its harbour)
    const name = op && block >= 0 && block < (op.n || 2) && op[side < 0 ? "L" : "R"] ? op[side < 0 ? "L" : "R"] : zonePick(prof, city, block);
    const wsd = prof.water && (prof.water.side === "B" || (prof.water.side === "L" ? -1 : 1) === side);
    if (name === "harbour") return wsd ? (prof.beach ? { type: "beach", water: true, beach: true } : { type: "harbour", water: true }) : { type: "urban", water: false };
    return { type: name, water: false };
  }
  function chunkCtx(L, k) {
    const s0 = k * L, c = cityForS(s0 + L / 2), prof = profileOf(ROUTE[c.idx].venue);
    return { city: c.idx, start: c.start, rel: Math.floor((s0 - c.start) / L), s0, prof, st: ROUTE[c.idx], sRel: s0 - c.start + L / 2, zone: side => zoneAt(prof, c.idx, s0 - c.start + L / 2, side) };
  }
  const tunnelAt = (prof, sRel) => prof.tunnel > 0 && mod(sRel, prof.tunnel) > prof.tunnel * 0.5 && mod(sRel, prof.tunnel) < prof.tunnel * 0.5 + 95; // (Monaco)

  // a city with its own roofs (prof.roof: { cols, share, pitch }): does this building get one? Decided by the building's own seed, so nothing
  // else in the city changes; Medium and up only. The roof (hipped, a little wider than the walls) goes into `mesh`.
  const roofCols = new Map();
  function roofOf(prof, seed, mesh, x, y, z, d, w) {
    const rf = prof.roof; if (!rf || !quality.detail) return false;
    if ((seed * 7.31) % 1 > (rf.share ?? 0.8)) return false;
    let cols = roofCols.get(rf); if (!cols) roofCols.set(rf, cols = rf.cols.map(lin));
    const c = cols[Math.floor(((seed * 13.7) % 1) * cols.length)], rh = Math.min(d, w) * (rf.pitch ?? 0.35);
    mesh.add(x, y, z, d * 1.08, rh, w * 1.08, 0, c[0], c[1], c[2]); return true;
  }
  const hsv = (r, pal) => { const c = pal[r.int(0, pal.length - 1)], k = r.range(0.9, 1.08); return [c[0] * k, c[1] * k, c[2] * k]; };
  const treeKind = (st, r, prof) => { const list = (prof && prof.trees) || st.trees, t = list ? r.pick(list) : "round"; return t === "pine" || t === "cypress" ? "pine" : t === "palm" ? "palm" : t === "cactus" ? "cactus" : "round"; };
  const treeSize = { round: [9, 14], pine: [12, 19], palm: [12, 16], cactus: [3.5, 6] };
  function addTree(meshes, kind, x, z, r, scale = 1, y = 0) {
    const m = (kind === "palm" && quality.detail && meshes.palmHD) || meshes[kind] || meshes.round; if (!m) return; const [lo, hi] = treeSize[kind] || treeSize.round, h = r.range(lo, hi) * scale;
    m.trunk && m.trunk.add(x, y, z, h, h, h, r() * 6.28); m.leaves && m.leaves.add(x, y, z, h, h, h, r() * 6.28);
  }

  // =================================================================================================================================
  // H: heroes - landmarks, grandstands, country props (a short list per chunk, built once and remembered)
  // =================================================================================================================================
  const heroCache = new Map();
  function heroesOfChunk(k) {
    let list = heroCache.get(k); if (list) return list;
    list = []; const ctx = chunkCtx(LH, k), lms = LANDMARKS_3D[ctx.st.venue] || ctx.st.lms || [];
    // 0. a landmark built over the track itself (Abu Dhabi's Yas hotel): every ~800 units
    const span = ctx.prof.span && hasLandmark(ctx.prof.span) && (HERO_ALL || mod(ctx.rel, 13) === 6);
    if (span) list.push({ kind: "lm", key: ctx.prof.span, s: ctx.s0 + 30, x: 0, side: 0, sc: 1, ry: 0, rad: 30, radX: 58, range: 1500 });
    // 0b. a welcome gantry over the road in the city's colours: once, soon after you arrive (clear of the start lights;
    // a city with a landmark over the road there, Abu Dhabi, has it a little further on)
    if (!span && ((HERO_ALL && mod(ctx.rel, 4) === 1) || ctx.rel === (ctx.prof.span && hasLandmark(ctx.prof.span) ? 8 : 6))) list.push({ kind: "gate", key: ctx.st.venue, city: ctx.city, s: ctx.s0 + 30, x: 0, side: 0, sc: 1, ry: 0, rad: 3, radX: 24, range: 1500 });
    // 1. the city's attractions, one every ~120 units, alternating sides and cycling through the list: big, close to the street, impossible to miss
    //    (the street front around each one is kept low-rise, so you can see it coming: see lmNear)
    if (lms.length && !span && (HERO_ALL || mod(ctx.rel, 2) === 0)) {
      const q = Math.floor(ctx.rel / 2), r2 = rng(hash(ctx.city, q, 501)), key = lms[mod(q, lms.length)], s0 = mod(q, 2) ? -1 : 1, side = ctx.zone(s0).beach ? -s0 : s0, zi = ctx.zone(side), far = zi.water, u = r2.range(10, 50); // (never out in the surf: across the road instead)
      if (hasLandmark(key)) list.push({ kind: "lm", key, s: ctx.s0 + u, x: side * (far ? r2.range(300, 400) : r2.range(68, 84)), side, sc: far ? 3.6 : 3.2, ry: -side * 0.3, rad: far ? 60 : 34, range: 1500 });
    }
    // 2. the city's signature on the skyline: the first attraction, huge, far off, so each city has a recognisable horizon
    if (lms.length && (HERO_ALL || mod(ctx.rel, 5) === 3)) { // (every ~300 units, huge, close enough to read clearly through the haze)
      const r4 = rng(hash(ctx.city, Math.floor(ctx.rel / 5), 777)), key = lms[mod(Math.floor(ctx.rel / 5), Math.min(2, lms.length))], side = r4.chance(0.5) ? -1 : 1;
      if (hasLandmark(key)) list.push({ kind: "lm", key, s: ctx.s0 + r4.range(10, 50), x: side * r4.range(300, 440), side, sc: 9, ry: -side * 0.4, rad: 70, range: 1500 });
    }
    const r3 = rng(hash(ctx.city, Math.floor(ctx.rel / 7), 502));
    if (HERO_ALL || mod(ctx.rel, 7) === r3.int(0, 6)) for (const side of [-1, 1]) { // grandstands with crowds
      const zi = ctx.zone(side); if (zi.water || ["country", "desert", "residential"].includes(zi.type) || !r3.chance(0.8)) continue;
      list.push({ kind: "stand", key: r3.chance(0.5) ? "grandStand" : "grandStandCovered", s: ctx.s0 + r3.range(14, 46), x: side * 39, side, sc: 18, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, rad: 12, range: 520 });
    }
    const rp = rng(hash(ctx.city, ctx.rel, 503)), props = ctx.st.props || [];
    for (const side of [-1, 1]) { // the city's own roadside things: out in the quiet neighbourhoods, and along the pavement in the busy ones
      const zi = ctx.zone(side);
      if (zi.beach) { if (hasProp("lifeguard") && rp.chance(0.55)) list.push({ kind: "prop", key: "lifeguard", s: ctx.s0 + rp.range(8, 52), x: side * rp.range(36, 44), side, sc: 1.6, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, rad: 5, range: 420 }); continue; } // lifeguard towers on the sand
      if (zi.water || !props.length) continue;
      if (["park", "country", "residential", "desert"].includes(zi.type)) {
        const n = rp.int(0, 2); for (let i = 0; i < n; i++) { const key = props[rp.int(0, props.length - 1)][0]; if (hasProp(key)) list.push({ kind: "prop", key, s: ctx.s0 + rp.range(2, 58), x: side * rp.range(28, 58), side, sc: 1.5, ry: -side * 0.5 + rp.range(-0.4, 0.4), rad: 7, range: 380 }); }
      } else if (rp.chance(0.7)) { // street dressing: a lantern pole, phone box, neon sign... standing on the pavement
        const near = props.filter(p => !p[2]); if (!near.length) continue;
        const key = near[rp.int(0, near.length - 1)][0]; if (hasProp(key)) list.push({ kind: "prop", key, s: ctx.s0 + rp.range(4, 56), x: side * rp.range(21.8, 24.2), side, sc: 1.25, ry: side > 0 ? Math.PI / 2 : -Math.PI / 2, rad: 4, range: 300 });
      }
    }
    heroCache.set(k, list); if (heroCache.size > 400) heroCache.delete(heroCache.keys().next().value);
    return list;
  }
  const heroBlocks = (side, s0, s1, x0, x1) => { // is a hero standing on the strip s0..s1 x x0..x1 on this side? (side 0: it spans the road)
    for (let k = Math.floor((s0 - 40) / LH); k <= Math.floor((s1 + 40) / LH); k++) for (const h of heroesOfChunk(k)) { const rx = h.radX ?? h.rad; if ((h.side === side || h.side === 0) && h.s + h.rad > s0 && h.s - h.rad < s1 && Math.abs(h.x) + rx > x0 && Math.abs(h.x) - rx < x1) return true; }
    return false;
  };
  // is a landmark standing near the road within `d` of s on this side? Then the buildings round it stay low, so it can be seen from the road
  const lmNear = (side, s, d) => {
    for (let k = Math.floor((s - d) / LH); k <= Math.floor((s + d) / LH); k++) for (const h of heroesOfChunk(k)) if (h.kind === "lm" && (h.side === side || h.side === 0) && Math.abs(h.x) < 130 && Math.abs(h.s - s) < d) return true;
    return false;
  };
  const heroPool = new Map(), heroActive = new Map(), heroUsed = new Map(); let heroStamp = 0;
  // A pooled landmark, gantry or prop that has not been on show for about a minute belongs to a city you have left: its shapes are freed (a
  // long Endless run would otherwise keep every city it passed in memory). Shared shapes and materials are never freed; grandstands (the
  // shared model itself) are kept.
  function evictHeroes() {
    for (const [key, list] of heroPool) {
      if (key.startsWith("stand:") || heroStamp - (heroUsed.get(key) || 0) < 3600) continue;
      for (const o of list) { const shared = o.userData.spin || o.userData.ball || o.userData.keep, gate = key.startsWith("gate:"); o.traverse(c => { if (!c.isMesh) return; if (gate || !shared) c.geometry.dispose(); if (gate) c.material.dispose(); }); }
      heroPool.delete(key); heroUsed.delete(key);
    }
  }
  function makeHero(h) {
    if (h.kind === "lm") return mergeStatic(makeLandmark(h.key, 9));
    if (h.kind === "prop") return mergeStatic(makeProp(h.key));
    if (h.kind === "gate") return makeGate(ROUTE[h.city], cityColors(ROUTE[h.city].venue));
    const m = cloneModel(h.key); m.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material.name === "red") o.material = crowdMat; } });
    return fitModel(m, { width: 1 });
  }
  function updateHeroes(D, ahead) {
    heroStamp++;
    const kmin = Math.floor((D - 100) / LH), kmax = Math.floor((D + ahead) / LH);
    for (let k = kmin; k <= kmax; k++) {
      const list = heroesOfChunk(k);
      for (let i = 0; i < list.length; i++) {
        const h = list[i], z = D - h.s; if (z < -h.range * Math.min(1, ahead / 1000 + 0.3)) continue;
        const id = k * 16 + i; let a = heroActive.get(id);
        if (!a) { const key = h.kind + ":" + h.key, p = heroPool.get(key), obj = p && p.pop() || makeHero(h); obj.userData.poolKey = key; obj.scale.setScalar(h.sc); obj.rotation.y = h.ry; obj.position.x = h.x; gH.add(obj); a = { obj, stamp: 0 }; heroActive.set(id, a); }
        a.stamp = heroStamp; a.obj.position.z = z; a.obj.visible = !(h.kind === "prop" && inClearing(h.x, z)) && !inShowcase(h.x, z) && !((h.kind === "lm" || h.kind === "gate") && showcase && Math.abs(z - showcase.zLm) < 420); // (street dressing in the way of the bypass track is hidden; so is anything on the briefing's plaza, and the city's own copies of its landmarks near it)
      }
    }
    for (const a of heroActive.values()) heroUsed.set(a.obj.userData.poolKey, heroStamp);
    if (heroStamp % 300 === 0) evictHeroes();
    for (const [id, a] of heroActive) if (a.stamp !== heroStamp) { gH.remove(a.obj); const key = a.obj.userData.poolKey; (heroPool.get(key) || heroPool.set(key, []).get(key)).push(a.obj); heroActive.delete(id); }
  }

  // =================================================================================================================================
  // F: the street front
  // =================================================================================================================================
  function buildF(slot, k) {
    const ctx = chunkCtx(LF, k), data = lay.F.data[slot] = { lamps: [] }, ms = lay.F.meshes; for (const m of ms) m.begin(slot);
    const zl = u => -(ctx.s0 + u - sBase), prof = ctx.prof, pal = PAL[prof.arch];
    const tun = tunnelAt(prof, ctx.sRel - LF / 2) || tunnelAt(prof, ctx.sRel + LF / 2) || tunnelAt(prof, ctx.sRel);
    const rb = rng(hash(ctx.city, ctx.rel, 77)), zl0 = ctx.zone(-1), zr0 = ctx.zone(1);
    for (const side of [-1, 1]) {
      const zi = side < 0 ? zl0 : zr0, Z = ZONES[zi.type], r = rng(hash(ctx.city, ctx.rel, 100 + (side > 0 ? 1 : 0))), neon = prof.sign.startsWith("neon");
      const faceRot = side < 0 ? Math.PI / 2 : -Math.PI / 2, built = Z.fh[1] > 0 && !zi.water, urbanish = Z.shops || zi.type === "harbour";
      // barrier along the track, painted in the city's colours (no banners)
      const cc = ccOf(ctx.city);
      if (quality.detail && K.barrier.ok) for (let u = 2; u < LF; u += 4) { const c = cc[mod(Math.floor((ctx.s0 + u - 2) / 8), cc.length)], bs = K.barrier.size; K.barrier.add(side * 18.8, 0, zl(u), 4.02 / bs.x, 1.35 / bs.y, 0.95 / bs.z, Math.PI / 2, Math.min(1.7, c[0] * 1.6 + 0.04), Math.min(1.7, c[1] * 1.6 + 0.04), Math.min(1.7, c[2] * 1.6 + 0.04)); } // real concrete barriers, painted (Medium and up)
      else for (let u = 4; u < LF; u += 8) { const c = cc[mod(Math.floor((ctx.s0 + u) / 8), cc.length)]; F.solid.add(side * 18.8, 0, zl(u), 1.0, 1.05, 8, 0, c[0], c[1], c[2]); }
      if (urbanish && !tun && r.chance(0.3) && !(prof.promenade && zi.water)) for (let u = 4; u < LF; u += 8) F.fence.add(side * 19.3, 3.45, zl(u), 8, 4.8, 1, faceRot); // catch fencing (never in front of a promenade: you see the harbour)
      // street lamps (every 20 units, staggered between the two sides)
      const classic = prof.lamp === "classic" && quality.detail && K.lamp.ok; // (the old cities: a Victorian lamp post instead of a modern street light)
      if ((zi.type !== "country" || r.chance(0.4)) && !tun) for (let u = side < 0 ? 7 : 17; u < LF; u += 20) {
        if (classic) { K.lamp.add(side * 19.9, 0, zl(u), 1, 1, 1, 0); data.lamps.push({ s: ctx.s0 + u, hx: side * 19.9, hy: 6.75, side }); continue; }
        F.lamps.add(side * 20.2, 0, zl(u), 1, 1, 1, side > 0 ? Math.PI : 0); F.glow.add(side * 20.2, 0, zl(u), 1, 1, 1, side > 0 ? Math.PI : 0);
        for (let i = 0; i < 3; i++) { const c = cc[i % cc.length]; F.solid.add(side * 19.45, 7.3 - i * 1.15, zl(u), 1.4, 1.15, 0.07, 0, c[0], c[1], c[2]); } // a banner in the city's colours, hanging off the post towards the road
        data.lamps.push({ s: ctx.s0 + u, hx: side * (20.2 - 2.4), side });
      }
      if (zi.beach) { // a beach: palms along the sand and people out on it
        for (let i = r.int(2, 4); i > 0; i--) addTree(F.trees, "palm", side * r.range(23, 42), zl(r.range(0, LF)), r);
        for (let i = r.int(1, 4); i > 0; i--) { const c = hsv(r, PAL.colonial), x = side * r.range(26, 46), z = zl(r.range(0, LF)); F.people.add(x, 0, z, 0.85, 0.85, 0.85, r() * 6, c[0], c[1], c[2]); F.heads.add(x, 0, z, 0.85, 0.85, 0.85); }
        continue;
      }
      if (zi.water) { // harbour: quay, bollards (and in a city with a promenade: palms along it and a railing at the water's edge)
        for (let u = 3; u < LF; u += 9) F.solid.add(side * 33, 0, zl(u), 0.5, 1.6, 0.5, 0, 0.18, 0.18, 0.2);
        if (prof.promenade && quality.detail) { const rp = rng(hash(ctx.city, ctx.rel, 150 + (side > 0 ? 1 : 0))); for (let u = rp.range(2, 8); u < LF; u += rp.range(11, 15)) addTree(F.trees, treeKind(ctx.st, rp, prof), side * rp.range(25, 27.5), zl(u), rp); F.solid.add(side * 32.2, 1.05, zl(LF / 2), 0.14, 0.12, LF, 0, 0.9, 0.9, 0.88); for (let u = 2; u < LF; u += 4) F.solid.add(side * 32.2, 0, zl(u), 0.12, 1.1, 0.12, 0, 0.9, 0.9, 0.88); }
        continue;
      }
      if (!tun) {
        if (urbanish || zi.type === "residential") { // planter trees, parked cars, a bus stop
          for (let u = side < 0 ? 17 : 7; u < LF; u += 20) if (r.chance(0.75)) { F.solid.add(side * 20.6, 0, zl(u), 1.5, 0.9, 1.5, 0, 0.45, 0.4, 0.38); addTree(F.trees, treeKind(ctx.st, r, ctx.prof), side * 20.6, zl(u), r, 0.55); }
          if (carG.length) for (let i = r.int(0, 2); i > 0; i--) F.cars[r.int(0, F.cars.length - 1)].add(side * 23.6, 0, zl(r.range(3, LF - 3)), 1, 1, 1, r.chance(0.5) ? 0 : Math.PI);
          if (r.chance(0.12)) F.stops.add(side * 22.4, 0, zl(r.range(8, 32)), 1, 1, 1, side > 0 ? Math.PI : 0);
          if (r.chance(zi.type === "residential" ? 0.5 : 0.32)) F.flowers.add(side * 26.9, 0, zl(r.range(4, 36)), 1, 1, 1, 0); // a flower bed against the frontage
          if (quality.detail) { // street furniture (Medium and up): a bin by a lamp post, a fire hydrant at the kerb, a bench facing the road, a utility box against a wall
            const rk = rng(hash(ctx.city, ctx.rel, 170 + (side > 0 ? 1 : 0)));
            if (rk.chance(0.6)) K.bin.add(side * 21.5, 0, zl(side < 0 ? 9.6 : 19.6), 1, 1, 1, rk() * 6.28);
            if (rk.chance(0.25)) K.hydrant.add(side * 21.1, 0, zl(rk.range(1, 39)), 1, 1, 1, rk() * 6.28);
            if (urbanish && rk.chance(0.32)) K.bench.add(side * 26.0, 0, zl(rk.range(11, 29)), 1, 1, 1, faceRot);
            if (urbanish && rk.chance(0.28)) K.box.add(side * 27.3, 0, zl(rk.chance(0.5) ? rk.range(1, 9) : rk.range(31, 39)), 1, 1, 1, faceRot);
            if (rk.chance(0.3)) { const u = rk.range(24, 36), i = rk.int(0, 7), wide = i < 4, w = wide ? 3.4 : 1.7, h = 1.7; F.solid.add(side * 21.0, 0, zl(u), 0.14, wide ? 4.6 : 3.6, 0.14, 0, 0.45, 0.47, 0.5); K.signs.add(side * 21.0, (wide ? 4.6 : 3.6) - h / 2 + 0.1, zl(u) + 0.09, w, h, 1, 0, 1, 1, 1, 0, roadSignRect(i)); } // a road sign facing the traffic
          }
        }
      }
      if (built) {
        const xEdge = zi.type === "residential" ? 31 : 28, standHere = heroBlocks(side, ctx.s0, ctx.s0 + LF, 26, 52), mlist = modelsFor(prof);
        const lowK = lmNear(side, ctx.s0 + LF / 2, 130) ? 0.38 : 1; // a landmark close by: low-rise here, so it can be seen from the road
        let u = r.range(0, 3);
        while (u < LF - 6) {
          let w = r.range(Z.fw[0], Z.fw[1]); if (u + w > LF) w = LF - u; if (w < 6) break;
          if (standHere && heroBlocks(side, ctx.s0 + u, ctx.s0 + u + w, 26, 52)) { u += w + 1; continue; } // a grandstand stands here
          const d = r.range(13, 21), floors = r.int(Z.fh[0], Z.fh[1]);
          const h = Math.max(7, floors * 4.4 * prof.height * lowK * (zi.type === "residential" ? 1 : r.range(0.85, 1.15))), xc = side * (xEdge + d / 2 + r.range(0, 1.5)), col = hsv(r, pal), seed = r(), zc = zl(u + w / 2);
          if (mlist.length && Z.shops && lowK === 1 && r.chance(0.26)) { // a hand-made Kenney building for variety
            const mi = mlist[r.int(0, mlist.length - 1)], mg = modelG[mi], fp = Math.min(w * 0.95, 20), mh = Math.max(14, floors * 4.2);
            F.models[mi].add(side * (xEdge + fp * 0.5 + 0.4), 0, zc, fp, Math.min(mh, fp * mg.aspect * 1.3), fp * 0.9, faceRot - (side < 0 ? Math.PI / 2 : -Math.PI / 2) + (side < 0 ? Math.PI / 2 : -Math.PI / 2), 1, 1, 1);
            u += w + r.range(0.2, 1); continue;
          }
          const podium = zi.type === "downtown" && floors >= 12 && lowK === 1 && r.chance(0.55);
          const tw = floors >= 14 && towered(ctx) ? K.towers : F.boxes; // (a skyscraper in a city with its pack: real facade photos)
          if (podium) { // a wide base with a narrower tower on top
            F.boxes.add(side * (xEdge + d * 0.58), 0, zc, d * 1.16, 9.5, w, 0, col[0] * 0.92, col[1] * 0.92, col[2] * 0.92, r());
            tw.add(side * (xEdge + d * 0.78), 0, zc, d * 0.72, h, w * 0.78, 0, col[0], col[1], col[2], seed);
          } else tw.add(xc, 0, zc, d, h, w, 0, col[0], col[1], col[2], seed);
          const roofed = !podium && floors < 14 && roofOf(prof, seed, F.roofs, xc, h, zc, d, w); // (a city with its own roofs: terracotta, slate... instead of a flat top)
          if (Z.houses && !roofed) { const c2 = hsv(r, PAL.warm); F.solid.add(xc, h, zc, d * 1.05, h * 0.35, w * 1.05, 0, c2[0] * 0.8, c2[1] * 0.5, c2[2] * 0.45); }
          if (floors >= 14 && lowK === 1) { const th = h * r.range(0.15, 0.35); tw.add(xc + side * d * 0.1, h, zc, d * 0.68, th, w * 0.72, 0, col[0] * 0.95, col[1] * 0.95, col[2] * 0.95, r()); }
          if (Z.shops) {
            const a = AWNINGS[r.int(0, AWNINGS.length - 1)];
            F.solid.add(side * (xEdge - 1.1), 3.2, zc, 2.3, 0.3, w * 0.84, 0, a[0], a[1], a[2]);
            const sw = Math.min(w * 0.62, 8.5);
            F.signs.add(side * (xEdge - 0.08), 3.55, zc, sw, sw / 4.4, 1, faceRot, 1, 1, 1, 0, signRect(r.int(0, SIGN_COUNT - 1)));
            if (neon || r.chance(0.3)) F.signs.add(side * (xEdge - 0.9), 9 + r.range(0, 8), zl(u + w * r.range(0.15, 0.85)), 1.6, 5.5, 1, 0, 1, 1, 1, 0, signRect(r.int(0, SIGN_COUNT - 1))); // blade sign over the street
            if (neon && floors >= 6 && r.chance(0.45)) F.signs.add(side * (xEdge - 0.12), Math.min(h * 0.6, 40), zc, Math.min(w * 0.85, 17), Math.min(w * 0.85, 17) / 4.4, 1, faceRot, 1, 1, 1, 0, signRect(r.int(0, SIGN_COUNT - 1))); // a big LED screen
            if (prof.neonDense) { // Tokyo, Las Vegas: signs stacked up the frontage, one over the other
              for (let i = r.int(1, 3); i > 0; i--) F.signs.add(side * (xEdge - 0.9 - r.range(0, 0.6)), 6 + r.range(0, Math.max(4, Math.min(h - 8, 30))), zl(u + w * r.range(0.1, 0.9)), 1.4, r.range(4, 8), 1, 0, 1, 1, 1, 0, signRect(r.int(0, SIGN_COUNT - 1)));
              if (h > 14 && r.chance(0.6)) F.signs.add(side * (xEdge - 0.12), r.range(7, Math.min(h - 3, 24)), zl(u + w * r.range(0.3, 0.7)), Math.min(w * 0.6, 10), Math.min(w * 0.6, 10) / 4.4, 1, faceRot, 1, 1, 1, 0, signRect(r.int(0, SIGN_COUNT - 1)));
            }
          }
          for (let i = r.int(0, 2); i > 0; i--) { const g = ROOF_KIT[r.int(0, 3)]; if (!roofed) F.solid.add(xc + r.range(-d * 0.3, d * 0.3), h, zc + r.range(-w * 0.3, w * 0.3), r.range(1.5, 4), r.range(1, 2.8), r.range(1.5, 4), 0, g[0], g[1], g[2]); }
          if (floors > 12 && r.chance(0.4)) F.solid.add(xc, h, zc, 0.35, r.range(6, 15), 0.35, 0, 0.7, 0.7, 0.72);
          u += w + (r.chance(0.2) ? r.range(3, 6) : r.range(0.2, 1.0));
        }
      } else if (zi.type !== "country" || r.chance(0.5)) { // park / countryside: scattered trees
        if (zi.type === "park" && r.chance(0.6)) F.flowers.add(side * r.range(22, 32), 0, zl(r.range(4, 36)), r.range(0.9, 1.3), 1, r.range(1, 1.5), 0); // flower beds in the park
        for (let i = Math.round(Z.tree * 5); i > 0; i--) addTree(F.trees, treeKind(ctx.st, r, ctx.prof), side * r.range(23, 70), zl(r.range(0, LF)), r);
      }
      if (Z.shops && !tun) for (let i = r.int(0, 3); i > 0; i--) { const c = hsv(r, PAL.colonial), x = side * r.range(24.6, 26.6), z = zl(r.range(0, LF)); F.people.add(x, 0, z, 0.85, 0.85, 0.85, r() * 6, c[0], c[1], c[2]); F.heads.add(x, 0, z, 0.85, 0.85, 0.85); } // people on the pavement
    }
    if (tun) for (let u = 0; u < LF; u += 4) { // a tunnel: roof, side walls and ceiling lights over the part of this chunk that is inside it
      if (!tunnelAt(prof, ctx.sRel - LF / 2 + u + 2)) continue;
      F.solid.add(0, 11, zl(u + 2), 40, 1.6, 4.05, 0, 0.32, 0.33, 0.35);
      for (const side of [-1, 1]) F.solid.add(side * 19.6, 0, zl(u + 2), 1.6, 11, 4.05, 0, 0.36, 0.37, 0.4);
      if (u % 8 === 0) for (const x of [-8, 8]) F.light.add(x, 10.7, zl(u + 2), 0.5, 0.2, 3.2);
    }
    for (const m of ms) m.end();
  }

  // =================================================================================================================================
  // B: city blocks
  // =================================================================================================================================
  // A marina (Monaco): concrete pontoons reaching out from the quay every 18 units, white motor yachts moored stern-to along both sides of each
  // (bows pointing out to sea), and a few superyachts anchored further out
  function marina(side, ctx, zl) {
    const rm = rng(hash(ctx.city, ctx.rel, 260 + (side > 0 ? 1 : 0))), off = mod(ctx.s0, 18), boatRy = -side * Math.PI / 2;
    for (let u = 9 - off; u < LB; u += 18) {
      if (u > 0) B.solid.add(side * 73, 0.05, zl(u), 76, 0.55, 1.8, 0, 0.82, 0.8, 0.76); // a pontoon
      for (const dz of [-4.6, 4.6]) for (const x0 of [37, 63]) {
        const uu = u + dz; if (uu < 0.5 || uu > LB - 0.5 || rm() < 0.18) continue;
        const s = rm.range(6.2, 7.6), c = rm() < 0.12 ? BOAT[2] : BOAT[0], len = s * 3.6; // (white; the odd navy hull)
        B.yachts.add(side * (x0 + len / 2 - 2), 0, zl(uu), s, s * 0.72, s, boatRy + rm.range(-0.04, 0.04), c[0], c[1], c[2]); // (a touch lower than drawn: sleek)
      }
    }
    for (let i = rm.int(1, 2); i > 0; i--) { const s = rm.range(12, 17); B.yachts.add(side * rm.range(140, 280), 0, zl(rm.range(0, LB)), s, s, s, rm.chance(0.5) ? rm.range(-0.3, 0.3) : Math.PI + rm.range(-0.3, 0.3), 1, 1, 1); } // superyachts at anchor
  }
  function buildB(slot, k) {
    const ctx = chunkCtx(LB, k), ms = lay.B.meshes; for (const m of ms) m.begin(slot);
    const zl = u => -(ctx.s0 + u - sBase), prof = ctx.prof, pal = PAL[prof.arch], dens = quality.density;
    for (const side of [-1, 1]) {
      const zi = ctx.zone(side), Z = ZONES[zi.type], r = rng(hash(ctx.city, ctx.rel, 200 + (side > 0 ? 1 : 0)));
      if (zi.water && !zi.beach && prof.marina && quality.detail) { marina(side, ctx, zl); continue; } // a marina: pontoons and rows of moored yachts
      if (zi.water) { for (let i = r.int(2, 5); i > 0; i--) { const c = BOAT[r.int(0, BOAT.length - 1)], s = r.range(5, 11); B.yachts.add(side * r.range(zi.beach ? 90 : 55, 300), 0.0, zl(r.range(0, LB)), s, s, s, r.range(-0.4, 0.4) + (r.chance(0.5) ? 0 : Math.PI), c[0], c[1], c[2]); } continue; } // boats on the water (off a beach: out past the surf)
      const mlist = modelsFor(prof);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 10; col++) {
        const cx = X0 + col * 30 + 11 + r.range(-2, 2), cz = row * 30 + 11 + r.range(-2, 2);
        if (heroBlocks(side, ctx.s0 + cz - 12, ctx.s0 + cz + 12, cx - 12, cx + 12)) continue;
        const y0 = hillY(prof, side, cx), sink = y0 > 0 ? 6 : 0, by = y0 - sink; // on a hillside each building stands on the slope (its foot sunk into it)
        if (r() > Z.occ * (0.55 + 0.45 * dens) || (dens < 0.7 && (col + row) % 2)) { if (Z.tree > 0.4 && r.chance(0.7)) for (let i = r.int(1, 3); i > 0; i--) { const tx = cx + r.range(-9, 9); addTree(B.trees, treeKind(ctx.st, r, ctx.prof), side * tx, zl(cz + r.range(-9, 9)), r, 1, hillY(prof, side, tx)); } continue; }
        const fpx = r.range(12, 20), fpz = r.range(12, 20), nse = noise2((ctx.s0 + cz) * 0.004, cx * 0.006, ctx.city);
        const lowK = cx < 200 && lmNear(side, ctx.s0 + cz, 130) ? 0.4 : 1;
        const hillTop = prof.hillTown && hillY(prof, side, 400) > 0 ? prof.hillTown.maxH : Infinity; // (the hill town's houses stay low, so they read as a town climbing the slope)
        const floors = Z.bh[0] + (Z.bh[1] - Z.bh[0]) * Math.pow(nse, 1.35) * r.range(0.6, 1.1), h = Math.min(hillTop, Math.max(6, floors * 4.4 * prof.height * lowK)) + sink;
        const col3 = hsv(r, pal), seed = r();
        if (Z.houses || Z.farm) { // houses and farm buildings: a coloured box with a roof
          const hh = r.range(5, 9) + sink, c2 = hsv(r, PAL.warm);
          B.houses.add(side * cx, by, zl(cz), fpx * 0.7, hh, fpz * 0.7, 0, col3[0], col3[1], col3[2]); B.roofs.add(side * cx, by + hh, zl(cz), fpx * 0.78, (hh - sink) * 0.55, fpz * 0.78, 0, c2[0] * 0.7, c2[1] * 0.4, c2[2] * 0.35);
          if (Z.farm && r.chance(0.6)) { B.houses.add(side * (cx + 11), 0, zl(cz + 4), 10, 9, 14, 0, 0.62, 0.18, 0.14); B.roofs.add(side * (cx + 11), 9, zl(cz + 4), 11, 6, 15, 0, 0.3, 0.3, 0.32); B.solid.add(side * (cx - 10), 0, zl(cz + 3), 4, 16, 4, 0, 0.8, 0.8, 0.78); } // barn and silo
        } else if (mlist.length && lowK === 1 && r.chance(0.3)) { // a hand-made Kenney building
          const mi = mlist[r.int(0, mlist.length - 1)], mg = modelG[mi], fp = r.range(13, 20);
          B.models[mi].add(side * cx, by, zl(cz), fp, Math.min(h, fp * mg.aspect * r.range(1.1, 2.2) + sink), fp * r.range(0.85, 1.1), r.chance(0.5) ? 0 : Math.PI, 1, 1, 1);
        } else {
          const tw = floors >= 14 && towered(ctx) ? towersB : B.boxes;
          tw.add(side * cx, by, zl(cz), fpx, h, fpz, 0, col3[0], col3[1], col3[2], seed);
          const roofed = floors < 16 && roofOf(prof, seed, B.hroofs, side * cx, by + h, zl(cz), fpx, fpz);
          if (floors >= 16 && lowK === 1 && !roofed) tw.add(side * (cx + 1), by + h, zl(cz), fpx * 0.66, h * r.range(0.12, 0.3), fpz * 0.66, 0, col3[0], col3[1], col3[2], r());
          if (r.chance(0.6)) { const g = ROOF_KIT[r.int(0, 3)]; if (!roofed) B.solid.add(side * cx + r.range(-3, 3), by + h, zl(cz) + r.range(-3, 3), r.range(2, 4.5), r.range(1.2, 3), r.range(2, 4.5), 0, g[0], g[1], g[2]); }
        }
        if (r.chance(Z.tree * 0.6)) { const tx = cx + r.range(-10, 10); addTree(B.trees, treeKind(ctx.st, r, ctx.prof), side * tx, zl(cz + 13), r, 1, hillY(prof, side, tx)); }
      }
    }
    for (const m of ms) m.end();
  }

  // =================================================================================================================================
  // S: the skyline
  // =================================================================================================================================
  function buildS(slot, k) {
    const ctx = chunkCtx(LS, k), ms = lay.S.meshes; for (const m of ms) m.begin(slot);
    const zl = u => -(ctx.s0 + u - sBase), prof = ctx.prof, pal = PAL[prof.arch], dens = quality.density;
    const hill = lin(ctx.st.mount || "#8aa5b8"), green = lin(ctx.st.hill || "#6fae5c"), peaky = ["peaks", "alps", "fuji", "volcano"].includes(ctx.prof.horizon || ctx.st.horizon);
    for (const side of [-1, 1]) {
      const zi = ctx.zone(side), r = rng(hash(ctx.city, ctx.rel, 300 + (side > 0 ? 1 : 0)));
      if (zi.beach || (zi.water && prof.sea)) continue; // the open sea
      const onHill = hillY(prof, side, 400) > 0;
      const urban = zi.type === "downtown" || zi.type === "urban" || zi.type === "harbour";
      if (onHill && prof.hillTown && quality.detail) { // the hill town (Monaco): many small pastel houses with roofs, stacked up the slope
        const ht = prof.hillTown, n2 = Math.round(ht.n * dens);
        for (let j = 0; j < n2; j++) {
          const x = 340 + (j + r()) / n2 * 800, u = r() * LS, w = r.range(13, 24), d = r.range(13, 22), h = r.range(9, ht.maxH * 0.8), c = hsv(r, pal), seed = r(), y = hy(x, prof.hillStart) - 5;
          S.boxes.add(side * x, y, zl(u), w, h + 5, d, 0, c[0], c[1], c[2], seed); roofOf(prof, seed * 0.999, S.roofs, side * x, y + h + 5, zl(u), w, d);
        }
        continue;
      }
      const n = Math.round((urban ? 14 : zi.type === "residential" ? 9 : 5) * dens);
      for (let j = 0; j < n; j++) {
        const x = 340 + (j + r()) / Math.max(1, n) * 780, u = r() * LS, w = r.range(22, 56), d = r.range(22, 56);
        const nse = noise2((ctx.s0 + u) * 0.0025, x * 0.003, ctx.city + 5);
        let h = (urban ? 50 + 280 * Math.pow(nse, 1.5) : zi.type === "residential" ? 25 + 30 * nse : 12 + 14 * nse) * prof.skyline * (urban ? 0.8 + (x - 340) / 700 : 1);
        if (zi.type === "downtown") h *= 1.2;
        if (onHill) h = Math.min(h, 60); // the hill town: low, climbing the slope
        const c = hsv(r, pal), y = onHill ? hy(x, prof.hillStart) - 8 : 0, tw = urban && !onHill && h > 70 && towered(ctx) ? towersS : S.boxes; tw.add(side * x, y, zl(u), w, h + (onHill ? 8 : 0), d, 0, c[0], c[1], c[2], r());
        if (h > 120 && r.chance(0.4)) tw.add(side * x, h, zl(u), w * 0.55, h * r.range(0.1, 0.25), d * 0.55, 0, c[0], c[1], c[2], r());
      }
      if (onHill) continue; // (the hill itself is the ground here)
      for (let j = zi.type === "downtown" ? 1 : r.int(2, 4); j > 0; j--) {
        const w = r.range(150, 320), hgt = r.range(25, 70) * (peaky ? 2.6 : 1), x = r.range(420, 1150), g = r.chance(0.5) ? hill : green;
        S.hills.add(side * x, -hgt * 0.1, zl(r() * LS), w, hgt, w * r.range(0.7, 1.2), r() * 6, g[0], g[1], g[2]);
      }
    }
    for (const m of ms) m.end();
  }

  // =================================================================================================================================
  // G: the ground
  // =================================================================================================================================
  function buildG(gs, k) {
    const ctx = chunkCtx(LG, k), desert = ["Las Vegas", "Doha", "Abu Dhabi"].includes(ROUTE[ctx.city].venue);
    for (let si = 0; si < 2; si++) {
      const side = si ? 1 : -1, zi = ctx.zone(side), Z = ZONES[zi.type], m = gs.meshes[si], hill = !zi.water && hillY(ctx.prof, side, 400) > 0;
      const s0 = zi.beach ? "beach" : zi.water ? "quay" : Z.ground === "city" ? "pavement" : Z.ground === "sand" ? "sand" : "grass";
      const s1 = zi.beach ? "beach" : zi.water ? "water" : hill ? "hill" : Z.ground, s2 = zi.beach || (zi.water && ctx.prof.sea) ? "water" : hill ? "hill" : desert ? "sand" : "grass"; // (a hillside: its own ground all the way up, never the street grid)
      m[0].material = ground[s0]; m[1].material = ground[s1]; m[2].material = ground[s2];
      for (let st = 1; st < 3; st++) m[st].geometry = (hill ? hillGeos(ctx.prof.hillStart ?? 52) : geos)[si][st]; // (a hillside rises; everywhere else is flat)
      m[1].position.y = zi.water && !zi.beach ? -0.02 : 0; m[0].position.y = zi.water && !zi.beach ? 0.4 : 0; // (water sits just above the big ground disc under everything)
    }
    gs.chunk = k; gs.city = ctx.city; gs.start = ctx.start;
  }

  // =================================================================================================================================
  // the far backdrop: a skyline of towers (or hills) across the end of the road, so the horizon is never empty
  // =================================================================================================================================
  const backBoxes = new THREE.InstancedMesh(unitBox, bMat, 150), backHills = new THREE.InstancedMesh(hillGeo(1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), 40);
  for (const m of [backBoxes, backHills]) { m.frustumCulled = false; gBack.add(m); }
  backBoxes.geometry = backBoxes.geometry.clone(); backBoxes.geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(150), 1));
  backHills.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3).fill(1), 3); backBoxes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(150 * 3).fill(1), 3);
  const dm = new THREE.Object3D(); let backCity = -1;
  function buildBackdrop(idx) {
    backCity = idx; const st = ROUTE[idx], prof = profileOf(st.venue), pal = PAL[prof.arch], r = rng(hash(idx, 0, 909));
    const urban = (prof.zones.downtown || 0) + (prof.zones.urban || 0) + (prof.zones.harbour || 0) >= 0.55, hill = lin(st.mount || "#8aa5b8");
    const sea = prof.sea && prof.water ? (prof.water.side === "L" ? -1 : prof.water.side === "R" ? 1 : 0) : 0; // (an open sea on that side: nothing on its horizon)
    for (let i = 0; i < 150; i++) {
      const x = -1250 + i * 16.7 + r.range(-6, 6), w = r.range(30, 70), c = hsv(r, pal), hillUp = hillY(prof, Math.sign(x), Math.abs(x));
      const h = hillUp > 0 ? r.range(15, 50) : urban ? r.range(60, 340) * prof.skyline * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.37))) : r.range(8, 40);
      dm.position.set(x, hillUp > 0 ? hillUp - 6 : 0, -1450 - r.range(0, 160)); dm.scale.set(w, h, w); if (sea && x * sea > 40) dm.scale.setScalar(0.001); dm.rotation.set(0, 0, 0); dm.updateMatrix(); backBoxes.setMatrixAt(i, dm.matrix); backBoxes.setColorAt(i, new THREE.Color(c[0], c[1], c[2])); backBoxes.geometry.attributes.aSeed.array[i] = r();
    }
    for (let i = 0; i < 40; i++) {
      const w = r.range(260, 520), h = r.range(60, 150) * (["peaks", "alps", "fuji", "volcano"].includes(prof.horizon || st.horizon) ? 2.2 : 1), x = -1300 + i * 65 + r.range(-20, 20);
      dm.position.set(x, -h * 0.1, -1500 - r.range(0, 200)); dm.scale.set(w, h, w * 0.8); if (sea && x * sea > -w * 0.3) dm.scale.setScalar(0.001); dm.rotation.set(0, r() * 6, 0); dm.updateMatrix(); backHills.setMatrixAt(i, dm.matrix); backHills.setColorAt(i, new THREE.Color(hill[0], hill[1], hill[2]));
    }
    for (const m of [backBoxes, backHills]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    backBoxes.geometry.attributes.aSeed.needsUpdate = true; backBoxes.visible = urban; backHills.visible = true;
  }

  // =================================================================================================================================
  // the update, called every frame
  // =================================================================================================================================
  const builders = { F: buildF, B: buildB, S: buildS };
  function ensure(layer, D, budget) {
    const L = layer.L, id = layer.id, kmin = Math.floor((D - BEHIND[id]) / L), kmax = Math.floor((D + AHEAD[id] * quality.ahead) / L), need = [];
    for (let k = kmin; k <= kmax; k++) { const slot = mod(k, layer.n), c = cityForS(k * L + L / 2); if (layer.chunk[slot] !== k || layer.city[slot] !== c.idx || layer.start[slot] !== c.start) need.push(k); }
    if (need.length > budget) need.sort((a, b) => Math.abs(a * L - D) - Math.abs(b * L - D));
    const nb = need.length > layer.n * 0.6 ? need.length : Math.min(budget, need.length);
    for (let i = 0; i < nb; i++) { const k = need[i], slot = mod(k, layer.n), c = cityForS(k * L + L / 2); builders[id](slot, k); layer.chunk[slot] = k; layer.city[slot] = c.idx; layer.start[slot] = c.start; }
    for (let s = 0; s < layer.n; s++) { const c = layer.chunk[s]; if (c === c && (c > kmax || c < kmin - 1)) { for (const m of layer.meshes) m.clear(s); layer.chunk[s] = NaN; layer.data[s] = {}; } }
  }
  function ensureG(D, budget) {
    const kmin = Math.floor((D - BEHIND.G) / LG), kmax = Math.floor((D + AHEAD.G * quality.ahead) / LG); let built = 0;
    for (let k = kmin; k <= kmax; k++) {
      const gs = gslots[mod(k, nG)], c = cityForS(k * LG + LG / 2);
      if (gs.chunk !== k || gs.city !== c.idx || gs.start !== c.start) { if (built++ >= budget && gs.chunk === gs.chunk) continue; buildG(gs, k); }
    }
    for (let s = 0; s < nG; s++) { const gs = gslots[s]; gs.grp.visible = gs.chunk === gs.chunk && gs.chunk >= kmin - 1 && gs.chunk <= kmax; if (gs.grp.visible) gs.grp.position.z = D - gs.chunk * LG; }
  }

  return {
    root, ground, lamps, get lampCount() { return lampCount; },
    setQuality(q) {
      const detail = q.detail ?? 1, changed = detail !== quality.detail;
      quality = { ahead: Math.min(MAX_CITY_AHEAD, q.ahead ?? 1), density: q.density ?? 1, detail };
      if (changed) { for (const L of Object.values(lay)) L.chunk.fill(NaN); for (const a of heroActive.values()) gH.remove(a.obj); heroActive.clear(); heroPool.clear(); } // (more or less detail: everything is rebuilt as it comes into view)
    },
    // what the briefing's plaza is built from: the city's own materials and models, so it matches the streets around it
    get kit() { return { bMat, sMat, trunkMat, lampMat, glowMat, skinMat, boatMat, leafMat, treeG, carG, ground }; },
    setSignStyle(style) { signMat.map = signTex[style] || signTex.paint; },
    // build a city's landmarks (two of each) and its welcome gantry ahead of time, outside a race, so none is built while you drive (a
    // detailed landmark takes a moment to build)
    prewarm(idx) {
      const st = ROUTE[idx], prof = profileOf(st.venue), keys = [...(LANDMARKS_3D[st.venue] || st.lms || [])]; if (prof.span) keys.push(prof.span);
      for (const key of keys) { if (!hasLandmark(key)) continue; const pk = "lm:" + key, p = heroPool.get(pk) || heroPool.set(pk, []).get(pk); while (p.length < 2) { const o = makeHero({ kind: "lm", key }); o.userData.poolKey = pk; p.push(o); } heroUsed.set(pk, heroStamp); }
    },
    // the city whose pack (citypack.js) has arrived: its skyscrapers get the pack's facade photos; everything is rebuilt as it comes into view
    setTowers(venue) { if (venue === towerVenue) return; towerVenue = venue; for (const L of Object.values(lay)) L.chunk.fill(NaN); },
    // clear everything beside the road along the bypass track (barrier, lamps, trees, parked cars, people, signs, props): you should see only the track
    setBypass(track) { bypassClear = track || null; },
    // clear a plaza beside the road (street front, blocks, trees, props) for the briefing's signature landmark; null puts everything back
    setShowcase(s) { showcase = s || null; },
    // the next landmark beside the road between `from` and `to` units ahead of D (the briefing's flyover aims at it): { s, x, sc } or null.
    // A close one (by the street) is preferred over a far skyline one.
    landmarkAhead(D, from = 150, to = 900, out = {}) {
      let best = null, bestK = 1e9;
      for (let k = Math.floor((D + from) / LH); k <= Math.floor((D + to) / LH); k++) for (const h of heroesOfChunk(k)) {
        if (h.kind !== "lm" || h.side === 0 || h.s < D + from || h.s > D + to) continue;
        const score = (h.s - D) + (Math.abs(h.x) > 130 ? 600 : 0); if (score < bestK) { bestK = score; best = h; }
      }
      if (!best) return null; out.s = best.s; out.x = best.x; out.sc = best.sc; out.rad = best.rad; return out;
    },
    // is the point at distance D along the route (world units) inside a tunnel?
    inTunnel(s) { const c = cityForS(s); return tunnelAt(profileOf(ROUTE[c.idx].venue), s - c.start); },
    // D = how far along the route the car is (world units); st = the current city's sim data; camZ = where the camera is
    update(D, dt, night, pal, fogColor, st, camZ) {
      if (Math.abs(D - sBase) > 6000 || Math.abs(D - lastD) > 250) { // a far jump (new race, map preview) or a very long drive: start the layers afresh
        const jump = Math.abs(D - lastD) > 250; sBase = Math.round(D / 2000) * 2000;
        for (const L of Object.values(lay)) L.chunk.fill(NaN); if (jump) for (const L of Object.values(lay)) L.city.fill(-1);
        for (const gs of gslots) gs.chunk = NaN; heroCache.clear();
      }
      lastD = D;
      { const fa = FACADES[st.venue] || [0, 0, 0, 0, 0]; shared.uStyleA.value.set(fa[0], fa[1], fa[2], fa[3]); const wl = quality.detail && WALLS[st.venue] || null; shared.uStyleB.value.set(fa[4], wl ? wl[0] : 0, fa[5] || 0, wl ? wl[1] : 5); } // this city's facade character (and its wall texture, Medium and up)
      shared.uNight.value = night; shared.uSky.value.setRGB(Math.min(1, fogColor.r * 1.1 + 0.05), Math.min(1, fogColor.g * 1.1 + 0.07), Math.min(1, fogColor.b * 1.1 + 0.1));
      ensure(lay.F, D, 3); ensure(lay.B, D, 3); ensure(lay.S, D, 2); ensureG(D, 4);
      maskZ = D - sBase; { const on = bypassClear || showcase ? maskFn : null; for (const m of listF) m.setMask(on); for (const m of listB) m.setMask(showcase ? maskFn : null); } // clear the street front beside the bypass track (and the briefing's plaza)
      for (const L of Object.values(lay)) for (const m of L.meshes) m.flush();
      const z = D - sBase; gF.position.z = gB.position.z = gS.position.z = z;
      updateHeroes(D, 1500 * quality.ahead);
      const cidx = cityForS(D).idx; if (cidx !== backCity) buildBackdrop(cidx);
      gBack.position.z = camZ;
      // ground colours follow the city's palette; ripples slide over the water
      ground.lawnU.uD.value = D; const g = pal.grass; ground.grass.color.setRGB(g[0] / 255, g[1] / 255, g[2] / 255, THREE.SRGBColorSpace);
      ground.sand.color.setRGB(Math.min(1, g[0] * 1.15 / 255), Math.min(1, g[1] * 1.12 / 255), Math.min(1, g[2] * 1.1 / 255), THREE.SRGBColorSpace);
      ground.field.color.setRGB(Math.min(1, g[0] * 1.15 / 255), Math.min(1, g[1] * 1.1 / 255), g[2] * 0.8 / 255, THREE.SRGBColorSpace);
      const wc = profileOf(st.venue).water; if (wc) { ground.water.color.set(wc.color); ground.beachU.uSea.value.set(wc.color); }
      ground.hill.color.set(st.hill || "#6fae5c"); ground.beach.color.setRGB(0.93, 0.85, 0.66, THREE.SRGBColorSpace); // (real sand colour: the "sand" ground follows each city's grass colour, which is green in Miami) ground.beachU.uT.value += dt;
      ground.waterNormal.offset.x += dt * 0.012; ground.waterNormal.offset.y += dt * 0.007; ground.waterU.uWT.value += dt;
      setCrowd(st.crowd); for (const w of windowMats) w.emissiveIntensity = 1.4 * night; // grandstand crowds wear the city's colours; Kenney windows light up
      // the street lamps near the car, for the night lighting
      lampCount = 0; const kc = Math.floor(D / LF);
      for (let k = kc - 2; k <= kc + 8; k++) { const sl = lay.F.chunk[mod(k, lay.F.n)] === k ? lay.F.data[mod(k, lay.F.n)] : null; if (!sl || !sl.lamps) continue; for (const l of sl.lamps) { if (inClearing(l.hx, D - l.s)) continue; const o = lamps[lampCount] || (lamps[lampCount] = { hx: 0, hy: 8.8, z: 0, side: 1 }); o.hx = l.hx; o.hy = l.hy || 8.8; o.z = D - l.s; o.side = l.side; lampCount++; } }
    },
  };
}
