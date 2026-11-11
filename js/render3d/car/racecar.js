// The race car: a modern open-wheel car built entirely in code (no model files, no real team's design).
//   body, sidepods, airbox   lofted through rounded cross-sections (so every surface is curved, nothing is a box)
//   wings, floor, endplates  bevelled extrusions of airfoil profiles
//   halo, suspension         shaped tubes
//   tyres, rims, brake discs lathes (the discs glow when you brake hard)
//   paint                    MeshPhysicalMaterial with a clear coat, wearing the team livery drawn in liveries.js
// Three levels of detail (THREE.LOD): close up (the player, the garage), mid distance, and far (a handful of triangles) so six
// rivals stay cheap. The geometry is built once and shared by every car; only the materials differ per team.
//
// The car faces -Z, stands on Y = 0, is centred on X = 0 and about 3.75 wide and 8.6 long.
import * as THREE from "three";
import { carbonTexture, topLivery, sideDecal, tyreSidewall } from "./liveries.js";
import { contactShadow } from "./traffic.js";
import { addFlakes } from "./flakes.js";
import { V2, V3, TAU, merge, mergeGeometries, tinted, moved, loft, foil, poly, extrudeX, extrudeY, tube, useDetail } from "./loft.js";


// ---------------------------------------------------------------------------------------------------------------------
// the shape of the car (key cross-sections: z, centre x, centre y, width, height, roundness)
// ---------------------------------------------------------------------------------------------------------------------
const BODY = [
  [-3.75, 0, 0.50, 0.14, 0.13, 2.2], [-3.20, 0, 0.54, 0.40, 0.25, 2.5], [-2.40, 0, 0.62, 0.62, 0.38, 2.6], [-1.60, 0, 0.74, 0.90, 0.60, 2.8],
  [-0.80, 0, 0.88, 1.14, 0.88, 3.0], [0.00, 0, 0.90, 1.22, 0.96, 3.0], [0.90, 0, 0.92, 1.12, 0.96, 3.0], [1.65, 0, 1.00, 0.84, 0.92, 2.8],
  [2.45, 0, 1.02, 0.56, 0.74, 2.6], [3.15, 0, 0.98, 0.36, 0.52, 2.4], [3.68, 0, 0.94, 0.22, 0.32, 2.2],
];
const POD = s => [
  [-1.20, 0.88 * s, 0.62, 0.34, 0.54, 2.4], [-0.70, 0.88 * s, 0.70, 0.58, 0.70, 2.6], [0.20, 0.84 * s, 0.72, 0.66, 0.74, 2.8],
  [1.30, 0.74 * s, 0.66, 0.58, 0.66, 2.8], [2.20, 0.62 * s, 0.58, 0.40, 0.46, 2.6], [3.00, 0.50 * s, 0.52, 0.20, 0.26, 2.4],
];
const AIRBOX = [[1.00, 0, 1.66, 0.34, 0.38, 2.1], [1.40, 0, 1.72, 0.40, 0.48, 2.1], [2.00, 0, 1.66, 0.36, 0.50, 2.2], [2.60, 0, 1.50, 0.20, 0.30, 2.2]];
const WHEELS = [ // x, z, radius, width
  { x: -1.35, z: -2.6, R: 0.70, W: 0.85, front: true }, { x: 1.35, z: -2.6, R: 0.70, W: 0.85, front: true },
  { x: -1.35, z: 2.4, R: 0.80, W: 1.05, front: false }, { x: 1.35, z: 2.4, R: 0.80, W: 1.05, front: false },
];

// detail levels: how finely the surfaces are cut
const QL = [
  { long: 56, around: 30, pl: 34, pa: 20, seg: 40, rad: 8, spokes: true, small: true, tubeSeg: 36, foilN: 14, bev: 2, helmet: [24, 16], ring: 28 },
  { long: 20, around: 14, pl: 12, pa: 9, seg: 16, rad: 4, spokes: false, small: true, tubeSeg: 12, foilN: 6, bev: 0, helmet: [12, 8], ring: 0 },
  { long: 10, around: 10, pl: 7, pa: 8, seg: 10, rad: 3, spokes: false, small: false, tubeSeg: 6, foilN: 4, bev: 0, helmet: [8, 6], ring: 0 },
];

// ---------------------------------------------------------------------------------------------------------------------
// a wheel: slick tyre (lathe), rim with open spokes, brake disc behind the spokes, lettering on the sidewall
// ---------------------------------------------------------------------------------------------------------------------
function wheelGeo(R, W, s, q) { // s = -1 for a wheel on the left, +1 on the right (which way is "out")
  const h = W / 2, rot = g => g.rotateZ(-Math.PI / 2); // lathes spin about Y; the wheel's axle is X
  const tp = [[0.60, -h], [0.84, -h], [0.93, -h * 0.96], [0.985, -h * 0.84], [1, -h * 0.6], [1, h * 0.6], [0.985, h * 0.84], [0.93, h * 0.96], [0.84, h], [0.60, h], [0.60, -h]].map(([r, a]) => V2(r * R, a));
  const tyre = rot(new THREE.LatheGeometry(tp, q.seg));
  const rimParts = [rot(new THREE.LatheGeometry([V2(0.5 * R, 0.78 * h), V2(0.58 * R, 0.78 * h), V2(0.58 * R, -0.78 * h), V2(0.5 * R, -0.78 * h), V2(0.5 * R, 0.78 * h)], q.seg))];
  rimParts.push(moved(rot(new THREE.LatheGeometry([V2(0.0, 0), V2(0.15 * R, 0), V2(0.15 * R, 0.16 * h), V2(0.1 * R, 0.2 * h), V2(0, 0.2 * h)], 12)), s * 0.74 * h, 0, 0)); // hub
  if (q.spokes) for (let i = 0; i < 10; i++) rimParts.push(moved(new THREE.BoxGeometry(0.05 * R, 0.5 * R, 0.075 * R), s * 0.72 * h, 0.31 * R, 0).rotateX(i * TAU / 10));
  else rimParts.push(moved(rot(new THREE.LatheGeometry([V2(0.05 * R, 0), V2(0.52 * R, 0), V2(0.52 * R, 0.05), V2(0.05 * R, 0.05)], q.seg)), s * 0.7 * h, 0, 0)); // a solid disc for the far levels
  const a = -s * 0.38 * h;
  const disc = rot(new THREE.LatheGeometry([V2(0.22 * R, a - 0.03 * R), V2(0.47 * R, a - 0.03 * R), V2(0.47 * R, a + 0.03 * R), V2(0.22 * R, a + 0.03 * R), V2(0.22 * R, a - 0.03 * R)], q.seg));
  const decal = merge([0, 1].map(k => { const sd = k ? 1 : -1; return moved(new THREE.RingGeometry(0.57 * R, 0.985 * R, q.seg).rotateY(sd * Math.PI / 2), sd * (h + 0.004), 0, 0); }));
  return { tyre, rim: merge(rimParts), disc, decal };
}

// ---------------------------------------------------------------------------------------------------------------------
// the fixed parts of the car (everything that doesn't move on its own), as a list of { k: material class, g: geometry }
// ---------------------------------------------------------------------------------------------------------------------
function statics(q) {
  useDetail(q); const P = [], add = (k, g, extra) => P.push({ k, g, ...extra });
  // floor and splitter
  add("carbon", extrudeY(poly([[-0.7, -3.15], [0.7, -3.15], [1.05, -1.6], [1.1, 2.3], [0.9, 3.4], [-0.9, 3.4], [-1.1, 2.3], [-1.05, -1.6]]), 0.1, 0.27, 0.02));
  // front wing: three elements, endplates, two pylons joining it to the nose
  add("carbon", moved(extrudeX(foil(0.85, 0.08, -0.05, -0.05), 3.3), 0, 0.2, -4.2), { fw: true });
  add("accent", moved(extrudeX(foil(0.55, 0.07, -0.08, -0.22), 3.2), 0, 0.38, -4.08), { fw: true });
  add("accent", moved(extrudeX(foil(0.42, 0.06, -0.09, -0.34), 3.0), 0, 0.55, -3.98), { fw: true });
  for (const sx of [-1, 1]) {
    add("accent", moved(extrudeX(poly([[0.62, 0.08], [0.64, 0.3], [0.15, 0.62], [-0.5, 0.66], [-0.58, 0.08]]), 0.07, 0.02), sx * 1.7, 0, -4.15), { fw: true });
    add("metal", tube([sx * 0.16, 0.46, -3.45], [sx * 0.2, 0.26, -4.05], 0.035, q.rad), { fw: true });
  }
  // rear wing: main plane, upper flap, endplates, a beam wing underneath, and the pylon that carries the lights
  add("accent", moved(extrudeX(foil(0.85, 0.08, -0.05, -0.15), 2.5), 0, 1.98, 3.55));
  add("accent", moved(extrudeX(foil(0.55, 0.07, -0.08, -0.38), 2.4), 0, 2.32, 3.48));
  add("carbon", moved(extrudeX(foil(0.5, 0.07, -0.05, -0.1), 1.7), 0, 1.3, 3.95));
  for (const sx of [-1, 1]) add("accent", moved(extrudeX(poly([[0.62, 1.35], [0.62, 2.2], [0.3, 2.46], [-0.4, 2.46], [-0.55, 2.0], [-0.55, 1.35]]), 0.07, 0.02), sx * 1.3, 0, 3.7));
  add("carbon", moved(extrudeX(poly([[0.25, 0.9], [0.25, 1.98], [-0.2, 1.98], [-0.25, 0.9]]), 0.14, 0.02), 0, 0, 3.55));
  // halo: a titanium loop over the cockpit with a centre pillar
  const halo = new THREE.CatmullRomCurve3([V3(0.43, 1.37, 0.75), V3(0.5, 1.62, 0.25), V3(0.4, 1.84, -0.4), V3(0.18, 1.93, -0.92), V3(0, 1.95, -1.1), V3(-0.18, 1.93, -0.92), V3(-0.4, 1.84, -0.4), V3(-0.5, 1.62, 0.25), V3(-0.43, 1.37, 0.75)]);
  add("metal", new THREE.TubeGeometry(halo, q.tubeSeg, 0.045, q.rad, false));
  add("metal", tube([0, 1.95, -1.1], [0, 1.1, -1.42], 0.05, q.rad));
  // cockpit: a dark liner with a carbon rim, an air intake and the sidepod inlets
  const ring = []; for (let i = 0; i < q.ring; i++) { const a = i / q.ring * TAU; ring.push(V3(Math.sin(a) * 0.4, 1.392, 0.42 + Math.cos(a) * 0.58)); }
  if (q.ring) add("carbon", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), q.ring, 0.04, 6, true));
  add("dark", moved(new THREE.CircleGeometry(1, q.small ? 20 : 8).scale(0.4, 0.58, 1).rotateX(-Math.PI / 2), 0, 1.39, 0.42));
  if (q.small) add("dark", moved(new THREE.CircleGeometry(1, 16).scale(0.15, 0.17, 1).rotateY(Math.PI), 0, 1.68, 0.995));
  if (q.small) for (const sx of [-1, 1]) add("dark", moved(new THREE.CircleGeometry(1, 14).scale(0.12, 0.2, 1).rotateY(Math.PI), sx * 0.88, 0.62, -1.205));
  // exhaust
  if (q.small) add("metal", moved(new THREE.LatheGeometry([V2(0.1, 0), V2(0.1, 0.3), V2(0.075, 0.34), V2(0.06, 0.3)], 12).rotateX(Math.PI / 2), 0, 0.97, 3.5));
  // the driver: helmet, visor, headrest, steering wheel
  add("helmet", moved(new THREE.SphereGeometry(0.3, q.helmet[0], q.helmet[1]).scale(0.95, 1, 1.08), 0, 1.62, 0.5));
  add("visor", moved(new THREE.SphereGeometry(0.306, q.helmet[0], q.helmet[1], 4.712 - 0.95, 1.9, 1.2, 0.55).scale(0.95, 1, 1.08), 0, 1.62, 0.5));
  if (q.small) add("dark", moved(new THREE.SphereGeometry(0.3, 12, 8).scale(0.95, 1.1, 0.5), 0, 1.5, 0.98));
  if (q.small) {
    add("dark", moved(new THREE.BoxGeometry(0.42, 0.1, 0.09).rotateX(0.5), 0, 1.5, -0.12));
    // suspension: wishbones, pushrods and the stubs that carry the wheels
    for (const sx of [-1, 1]) {
      for (const [a, b] of [[[0.3, 0.86, -2.2], [0.95, 0.8, -2.6]], [[0.3, 0.86, -3.0], [0.95, 0.8, -2.6]], [[0.3, 0.5, -2.1], [0.95, 0.52, -2.6]], [[0.3, 0.5, -3.1], [0.95, 0.52, -2.6]], [[0.4, 1.06, -2.5], [0.95, 0.7, -2.6]], [[0.3, 0.7, -3.0], [0.95, 0.66, -2.62]],
        [[0.3, 0.9, 1.95], [0.85, 0.9, 2.4]], [[0.3, 0.9, 2.85], [0.85, 0.9, 2.4]], [[0.3, 0.5, 1.95], [0.85, 0.58, 2.4]], [[0.3, 0.5, 2.85], [0.85, 0.58, 2.4]], [[0.45, 1.1, 2.3], [0.85, 0.8, 2.4]]])
        add("metal", tube([a[0] * sx, a[1], a[2]], [b[0] * sx, b[1], b[2]], 0.032, q.rad));
      add("metal", tube([sx * 0.9, 0.7, -2.6], [sx * 1.3, 0.7, -2.6], 0.07, q.rad)); add("metal", tube([sx * 0.8, 0.8, 2.4], [sx * 1.3, 0.8, 2.4], 0.08, q.rad));
      // wing mirrors on stalks
      add("metal", tube([sx * 0.52, 1.2, -0.7], [sx * 0.98, 1.32, -0.62], 0.025, 5));
      add("accent", moved(extrudeX(poly([[0.12, 0.0], [0.12, 0.15], [0.0, 0.18], [-0.12, 0.15], [-0.12, 0.0]]), 0.2, 0.025), sx * 1.05, 1.28, -0.6));
      add("visor", moved(new THREE.PlaneGeometry(0.19, 0.12).rotateX(0.0), sx * 1.05, 1.36, -0.468));
    }
  }
  return P;
}

// ---------------------------------------------------------------------------------------------------------------------
// shared geometry (built once per level of detail) and materials
// ---------------------------------------------------------------------------------------------------------------------
const GEO = [];
const CLASS_COLOR = { carbon: "#1b1c20", metal: "#8a9098", dark: "#0e0e10", visor: "#05060a" };
function geoFor(i) {
  if (GEO[i]) return GEO[i];
  const q = QL[i], parts = statics(q), g = { q, parts };
  g.body = loft(BODY, q.long, q.around); g.airbox = loft(AIRBOX, Math.ceil(q.long / 4), Math.max(10, q.around - 4));
  g.pods = [loft(POD(-1), q.pl, q.pa), loft(POD(1), q.pl, q.pa)];
  g.bodyAll = merge([g.body, g.pods[0], g.pods[1], g.airbox]); // body, sidepods and airbox are one mesh
  const by = {}; for (const p of parts) (by[p.k] = by[p.k] || []).push(p.g);
  g.byClass = {}; for (const k in by) g.byClass[k] = merge(by[k]);
  const fw = k => parts.filter(p => p.fw && p.k === k).map(p => p.g); g.fwAccent = merge(fw("accent")); g.fwCarbon = merge(fw("carbon"));
  if (i > 0) { // far levels: the bodywork is one mesh, and everything that is not team-coloured goes into one more mesh with vertex colours
    const rest = parts.filter(p => p.k !== "accent" && p.k !== "helmet" && (i < 2 || p.k !== "visor")).map(p => tinted(p.g, CLASS_COLOR[p.k] || "#222"));
    g.rest = mergeGeometries(rest);
  }
  g.wheels = WHEELS.map(w => { const s = w.x < 0 ? -1 : 1, wg = wheelGeo(w.R, w.W, s, q); return { ...w, s, ...wg }; });
  if (i === 1) for (const w of g.wheels) w.all = mergeGeometries([tinted(w.tyre, "#101012"), tinted(w.rim, "#6c7078"), tinted(w.disc, "#55575c")]);
  if (i === 2) g.allWheels = mergeGeometries(g.wheels.map(w => moved(mergeGeometries([tinted(w.tyre, "#101012"), tinted(w.rim, "#6c7078")]), w.x, w.R, w.z)));
  return (GEO[i] = g);
}

let SH = null;
function shared() {
  if (SH) return SH;
  const ct = carbonTexture(); ct.repeat.set(3, 3);
  return (SH = {
    carbon: new THREE.MeshPhysicalMaterial({ map: ct, roughness: 0.42, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb0b6c0, metalness: 0.75, roughness: 0.38 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x101013, roughness: 0.75, metalness: 0.1 }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x090a10, metalness: 0.8, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.03 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x131315, roughness: 0.92 }),
    sidewall: new THREE.MeshStandardMaterial({ map: tyreSidewall("#ffd21a"), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    sidewalls: Object.fromEntries([["dry", "#ffd21a"], ["inter", "#39c46a"], ["wet", "#2a7bff"]].map(([k, c]) => [k, new THREE.MeshStandardMaterial({ map: tyreSidewall(c), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })])),
    rim: new THREE.MeshStandardMaterial({ color: 0x4a4e56, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }),
    vc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide }),
  });
}
const teamCache = new Map();
function teamMats(team, idx) {
  let m = teamCache.get(team.name); if (m) return m;
  const paint = { roughness: 0.34, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 };
  teamCache.set(team.name, m = {
    livery: addFlakes(new THREE.MeshPhysicalMaterial({ map: topLivery(team, idx), ...paint })), // (metallic flakes under the clear coat: see flakes.js)
    accent: addFlakes(new THREE.MeshPhysicalMaterial({ color: team.a, ...paint, roughness: 0.38 })),
    helmet: new THREE.MeshPhysicalMaterial({ color: team.helmet, roughness: 0.22, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 }),
    decal: new THREE.MeshStandardMaterial({ map: sideDecal(team, idx), transparent: true, roughness: 0.45, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  });
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// putting a car together
// ---------------------------------------------------------------------------------------------------------------------
const lods = new Set(); let bias = 1; const DIST = [0, 55, 140];
// k < 1 switches to the cheaper levels sooner (weak hardware), k > 1 keeps the detail further out
export function setCarDetail(k) { bias = k; for (const l of lods) l.levels.forEach((lv, i) => { lv.distance = DIST[i] * bias; }); }

const mesh = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; return o; };
const teamIndex = team => { const i = typeof TEAMS !== "undefined" ? TEAMS.indexOf(team) : -1; if (i >= 0) return i; let h = 0; for (const c of team.name) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 11; };

export function makeProRaceCar(team) {
  const idx = teamIndex(team), S = shared(), T = teamMats(team, idx), car = new THREE.Group();
  const discMat = new THREE.MeshStandardMaterial({ color: 0x5a5c62, metalness: 0.6, roughness: 0.45, emissive: new THREE.Color(1, 0.32, 0.06), emissiveIntensity: 0, side: THREE.DoubleSide });
  const brakeMat = new THREE.MeshStandardMaterial({ color: "#5a0000", emissive: "#ff0000", emissiveIntensity: 0.3 });
  const rainMat = new THREE.MeshStandardMaterial({ color: "#550000", emissive: "#ff2020", emissiveIntensity: 0 });
  const matOf = { carbon: S.carbon, metal: S.metal, dark: S.dark, visor: S.visor, accent: T.accent, helmet: T.helmet };
  const lod = new THREE.LOD(), wheels = [], front = [], bodies = [], decals = [], pivots = [[], [], []]; let brake = null, rain = null, helmet = null;

  for (let i = 0; i < 3; i++) {
    const G = geoFor(i), lvl = new THREE.Group(), body = new THREE.Group(); lvl.add(body); bodies.push(body);
    body.add(mesh(G.bodyAll, T.livery, i < 2));
    if (i === 0) {
      for (const k in G.byClass) { const m = mesh(G.byClass[k], matOf[k], k !== "visor"); body.add(m); if (k === "helmet") helmet = m; }
      for (const sx of [-1, 1]) { // team name and sponsor stickers on the flanks of the sidepods
        const d = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55).rotateY(sx * Math.PI / 2), T.decal); d.position.set(sx * 1.172, 0.74, 0.75); body.add(d);
      }
    } else {
      body.add(mesh(G.rest, S.vc, i === 1), mesh(G.byClass.accent, T.accent, i === 1), mesh(G.byClass.helmet, T.helmet, false));
    }
    if (i < 2) { // brake light and rain light on the rear wing pylon
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.05), brakeMat); bl.position.set(0, 1.25, 3.7); body.add(bl);
      const rl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05), rainMat); rl.position.set(0, 1.62, 3.7); body.add(rl);
      if (i === 0) { brake = bl; rain = rl; }
    }
    // the wheels
    if (i === 2) { lvl.add(mesh(G.allWheels, S.vc)); }
    else for (const w of G.wheels) {
      const pivot = new THREE.Group(), axle = new THREE.Group(); pivot.position.set(w.x, w.R, w.z); pivot.add(axle); lvl.add(pivot);
      if (i === 0) { const dm = mesh(w.decal, S.sidewalls.dry, false); decals.push(dm); axle.add(mesh(w.tyre, S.rubber), mesh(w.rim, S.rim), mesh(w.disc, discMat, false), dm); }
      else axle.add(mesh(w.all, S.vc));
      wheels.push(axle); pivots[i].push(pivot); if (w.front) front.push(pivot);
    }
    lod.addLevel(lvl, DIST[i] * bias);
  }
  car.add(lod); lods.add(lod);

  // For the cockpit view the tall bodywork is hidden and swapped for a low tub, so the driver's eyes aren't inside the airbox
  const G0 = geoFor(0), proxy = new THREE.Group();
  for (const g of [G0.body, G0.pods[0], G0.pods[1]]) { const m = mesh(g, T.livery, false); m.scale.y = 0.72; proxy.add(m); } // (the same body, squashed low)
  proxy.add(mesh(G0.fwAccent, T.accent, false), mesh(G0.fwCarbon, S.carbon, false)); proxy.visible = false; car.add(proxy);
  const setCockpit = on => { for (const b of bodies) b.visible = !on; proxy.visible = on; };

  const shadow = contactShadow(5.2, 10.4); shadow.position.z = -0.1; car.add(shadow); // a soft dark patch, so the car never looks like it floats
  const setTyre = key => { const m = S.sidewalls[key] || S.sidewalls.dry; for (const d of decals) d.material = m; }; // the band colour of the chosen compound: yellow dry, green intermediate, blue wet
  const shed = k => { for (const l of pivots) if (l[k]) l[k].visible = false; };  // a wheel tears off in a crash
  const reset = () => { for (const l of pivots) for (const p of l) p.visible = true; setTyre("dry"); };
  car.userData = { wheels, front, helmet, brake, rain, kind: "race", setCockpit, discMat, setTyre, shed, reset, paint: [T.livery, T.accent, T.helmet] }; // (paint: the clear-coated materials, for the race's sky reflections)
  return car;
}

// a wheel that has come off in a crash: the tyre, the rim and the sidewall lettering, centred on its own middle
export function makeWheelDebris() {
  const S = shared(), w = geoFor(0).wheels[2], g = new THREE.Group();
  g.add(mesh(w.tyre, S.rubber), mesh(w.rim, S.rim), mesh(w.decal, S.sidewalls.dry, false)); return g;
}
