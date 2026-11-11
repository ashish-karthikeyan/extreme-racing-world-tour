// Everyday traffic, built in code like the race car: cars, a van, a taxi, lorries and a bus, all with smooth curved bodies, glossy
// clear-coated paint in the colours the simulation chooses, dark glass, working lights and wheels that spin (and nothing else does).
//   cars     a lofted lower body plus a lofted cabin; the windows are painted onto the cabin through its texture coordinates
//   lorries  a cab, a box / container / tanker trailer, and a bus: boxy shapes with flat side panels for the logos and windows
// Everything is built once per model and shared; a vehicle costs a few draw calls (far away: three).
//
// Vehicles face -Z, stand on Y = 0 and are centred on X = 0, Z = 0. The wheels are in userData.wheels.
import * as THREE from "three";
import { V2, V3, TAU, merge, mergeGeometries, tinted, moved, loft, poly, extrudeX, tube, useDetail } from "./loft.js";
import { addFlakes } from "./flakes.js";

// ---------------------------------------------------------------------------------------------------------------------
// materials shared by every vehicle
// ---------------------------------------------------------------------------------------------------------------------
export const trafficLamp = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); // the renderer turns .color up at night
const H = { head: [1.0, 0.95, 0.8], tail: [0.95, 0.04, 0.03], amber: [1.0, 0.55, 0.05], sign: [1.0, 0.9, 0.55] };
let SH = null;
function shared() {
  return SH || (SH = {
    detail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
    wheel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.35, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0c131b, metalness: 0.7, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide }),
    shadow: new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.38, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false }),
    brake: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.1, 0.05), toneMapped: false, fog: true }), // brake lights: brighter than the tail lamps, they bloom (the renderer shows them while the car slows)
    pool: new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: true, polygonOffset: true, polygonOffsetFactor: -3 }),
  });
}
function blobTexture() { // a soft dark patch: the contact shadow under a car
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  r.addColorStop(0, "rgba(0,0,0,0.95)"); r.addColorStop(0.55, "rgba(0,0,0,0.55)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function poolTexture() { // the pool of light a car's headlamps throw on the road ahead (night only)
  const c = document.createElement("canvas"); c.width = 32; c.height = 128; const g = c.getContext("2d"), r = g.createLinearGradient(0, 0, 0, 128);
  r.addColorStop(0, "rgba(255,240,200,0)"); r.addColorStop(1, "rgba(255,236,190,0.9)"); g.fillStyle = r; g.fillRect(0, 0, 32, 128);
  g.globalCompositeOperation = "destination-in"; const h = g.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, "rgba(0,0,0,0)"); h.addColorStop(0.5, "#000"); h.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = h; g.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const trafficPool = () => shared().pool; // (the renderer sets its opacity from the time of day)
const flatGeos = new Map(); // (one shape per size, shared by every vehicle that uses it: a new car or lorry adds no geometry)
const flatGeo = (w, l) => { const k = w + "x" + l; let g = flatGeos.get(k); if (!g) flatGeos.set(k, g = new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2)); return g; };
export function contactShadow(w, l) { // a dark soft patch lying on the road under a vehicle
  const m = new THREE.Mesh(flatGeo(w, l), shared().shadow); m.position.y = 0.06; m.renderOrder = 1; m.frustumCulled = false; return m;
}

const paints = new Map();
function paintMat(hex, map) { // glossy clear-coated paint; `map` (optional) paints the windows black through the texture
  const key = hex + (map ? map.uuid : ""); let m = paints.get(key);
  if (!m) paints.set(key, m = addFlakes(new THREE.MeshPhysicalMaterial({ color: hex, map: map || null, roughness: 0.34, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }), 90, 0.28));
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// small parts
// ---------------------------------------------------------------------------------------------------------------------
const col = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
function vc(g, rgb) { // paint a geometry one flat colour (vertex colours)
  const n = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(k)) n.deleteAttribute(k);
  const a = new Float32Array(n.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = rgb[0]; a[i + 1] = rgb[1]; a[i + 2] = rgb[2]; }
  n.setAttribute("color", new THREE.BufferAttribute(a, 3)); return n;
}
const box = (w, h, d, x, y, z, rgb, ry = 0) => vc(moved(new THREE.BoxGeometry(w, h, d).rotateY(ry), x, y, z), rgb);
// a rounded lamp unit: a thin bevelled slab `w` wide whose side profile is a little wedge
const lampUnit = (w, h, d, x, y, z, rgb) => vc(moved(extrudeX(poly([[d / 2, -h / 2], [d / 2, h / 2], [-d / 2, h / 2 - 0.02], [-d / 2, -h / 2 + 0.02]]), w, 0.03), x, y, z), rgb);
const DARK = [0.03, 0.03, 0.035], CHROME = [0.62, 0.64, 0.68], PLATE = [0.9, 0.9, 0.85], TYRE = [0.045, 0.045, 0.05], RIM = [0.62, 0.65, 0.7], HUB = [0.2, 0.21, 0.24];

// a wheel (axle along X): tyre, a silver dished rim with a dark centre; `s` = which way is outwards (-1 left, +1 right)
function wheelGeo(R, W, s, seg) {
  const h = W / 2, rot = g => g.rotateZ(-Math.PI / 2);
  const tp = [[0.62, -h], [0.86, -h], [0.95, -h * 0.9], [1, -h * 0.55], [1, h * 0.55], [0.95, h * 0.9], [0.86, h], [0.62, h], [0.62, -h]].map(([r, a]) => V2(r * R, a));
  const tyre = vc(rot(new THREE.LatheGeometry(tp, seg)), TYRE);
  const rim = vc(rot(new THREE.LatheGeometry([V2(0.0, h * 0.62), V2(0.6 * R, h * 0.72), V2(0.66 * R, h * 0.55), V2(0.64 * R, -h * 0.4), V2(0.0, -h * 0.4)].map(p => V2(p.x, p.y * s)), seg)), RIM);
  const hub = vc(rot(moved(new THREE.CylinderGeometry(0.16 * R, 0.16 * R, 0.06, 10), 0, s * h * 0.7, 0)), HUB);
  return mergeGeometries([tyre, rim, hub]);
}

// ---------------------------------------------------------------------------------------------------------------------
// the cars: key cross-sections written as S(z, top, bottom, width, roundness)
// ---------------------------------------------------------------------------------------------------------------------
const S = (z, top, bottom, w, n = 3.2) => [z, 0, (top + bottom) / 2, w, top - bottom, n];
const C = (z, top, bottom, w, n = 3.2) => S(z, bottom + (top - bottom) * 1.28, bottom, w, n); // a cabin row: the same, but 28% taller (the cars are as wide as real ones but need more roof)
const CARS = {
  sedan: {
    lower: [S(-3.6, .72, .45, 2.9, 3), S(-3.35, .96, .4, 3.3), S(-2.6, 1.14, .38, 3.5, 3.4), S(-1.5, 1.22, .36, 3.5, 3.4), S(1.5, 1.24, .36, 3.5, 3.4), S(2.7, 1.27, .38, 3.5, 3.4), S(3.35, 1.1, .4, 3.3), S(3.6, .88, .45, 2.9, 3)],
    cabin: [C(-2.0, 1.2, .98, 2.95, 3), C(-1.15, 1.62, .98, 3.0, 3), C(-0.45, 1.86, .98, 2.95, 3.2), C(0.9, 1.88, .98, 2.9, 3.2), C(1.8, 1.72, .98, 2.95, 3), C(2.5, 1.34, .98, 3.0, 3), C(2.75, 1.26, .98, 3.0, 3)],
    win: { side: [[-1.1, 0.45], [0.75, 2.2]], front: [-1.85, -0.55], rear: [1.85, 2.6] }, wheels: { fz: -2.3, rz: 2.3, R: 0.62, W: 0.52 }, nose: -3.6, tail: 3.6, plateY: 0.62, mirrors: [-1.45, 1.4],
  },
  hatch: {
    lower: [S(-3.4, .72, .45, 2.9, 3), S(-3.15, .96, .4, 3.3), S(-2.4, 1.12, .38, 3.5, 3.4), S(-1.4, 1.2, .36, 3.5, 3.4), S(1.8, 1.3, .36, 3.5, 3.4), S(2.9, 1.22, .4, 3.45), S(3.4, .92, .45, 3.0, 3)],
    cabin: [C(-1.9, 1.18, .98, 2.95, 3), C(-1.1, 1.6, .98, 3.0, 3), C(-0.4, 1.86, .98, 2.95, 3.2), C(1.9, 1.88, .98, 2.9, 3.2), C(2.9, 1.56, .98, 2.95, 3), C(3.2, 1.3, .98, 2.9, 3)],
    win: { side: [[-1.0, 0.4], [0.7, 2.7]], front: [-1.75, -0.5], rear: [2.2, 3.05] }, wheels: { fz: -2.15, rz: 2.2, R: 0.6, W: 0.5 }, nose: -3.4, tail: 3.4, plateY: 0.66, mirrors: [-1.35, 1.38],
  },
  suv: {
    lower: [S(-3.6, .95, .55, 3.1, 3), S(-3.35, 1.22, .5, 3.45), S(-2.6, 1.42, .48, 3.55, 3.4), S(-1.4, 1.47, .46, 3.55, 3.5), S(2.2, 1.52, .46, 3.55, 3.5), S(3.3, 1.45, .5, 3.5, 3.4), S(3.6, 1.12, .55, 3.2, 3)],
    cabin: [C(-1.9, 1.5, 1.25, 3.15, 3), C(-1.2, 1.98, 1.25, 3.2, 3.2), C(-0.4, 2.32, 1.25, 3.2, 3.4), C(2.7, 2.34, 1.25, 3.15, 3.4), C(3.3, 2.02, 1.25, 3.15, 3.2), C(3.45, 1.55, 1.25, 3.1, 3)],
    win: { side: [[-1.1, 0.5], [0.8, 3.0]], front: [-1.8, -0.6], rear: [3.0, 3.4] }, wheels: { fz: -2.3, rz: 2.4, R: 0.7, W: 0.55 }, nose: -3.6, tail: 3.6, plateY: 0.75, mirrors: [-1.45, 1.75], spare: true,
  },
  van: {
    lower: [S(-3.6, .98, .52, 3.1, 3), S(-3.3, 1.22, .46, 3.45), S(-2.5, 1.38, .44, 3.55, 3.4), S(-1.6, 1.52, .44, 3.55, 3.5), S(3.4, 1.55, .44, 3.55, 3.5), S(3.6, 1.38, .5, 3.4, 3.2)],
    cabin: [S(-2.3, 1.55, .62, 3.3, 3), S(-1.6, 2.3, .62, 3.45, 3.6), S(-0.8, 2.95, .62, 3.5, 4.2), S(3.45, 3.0, .62, 3.5, 4.2), S(3.62, 2.75, .7, 3.4, 3.6)],
    win: { side: [[-1.4, -0.1]], front: [-2.0, -0.85], rear: null }, wheels: { fz: -2.3, rz: 2.4, R: 0.66, W: 0.52 }, nose: -3.6, tail: 3.62, plateY: 0.7, mirrors: [-2.0, 1.9],
  },
  coupe: {
    lower: [S(-3.6, .66, .4, 2.95, 3), S(-3.3, .86, .34, 3.4), S(-2.6, 1.0, .32, 3.6, 3.4), S(-1.2, 1.06, .3, 3.6, 3.4), S(1.6, 1.12, .3, 3.6, 3.4), S(2.9, 1.12, .34, 3.5, 3.4), S(3.4, .96, .38, 3.3), S(3.6, .8, .4, 3.0, 3)],
    cabin: [C(-1.6, 1.0, .8, 2.95, 3), C(-0.7, 1.4, .8, 3.0, 3), C(0.2, 1.57, .8, 2.9, 3.2), C(1.5, 1.5, .8, 2.9, 3.2), C(2.4, 1.18, .8, 2.95, 3), C(2.7, 1.1, .8, 2.95, 3)],
    win: { side: [[-0.9, 1.9]], front: [-1.45, -0.45], rear: [1.55, 2.4] }, wheels: { fz: -2.4, rz: 2.3, R: 0.6, W: 0.58 }, nose: -3.6, tail: 3.6, plateY: 0.55, mirrors: [-1.1, 1.2],
  },
};
CARS.taxi = { ...CARS.sedan, taxi: true };

// the windows, painted into a texture: white = paint, dark = glass. Coordinates: u goes round the cabin (0 = underneath, 0.25 = right
// side, 0.5 = roof, 0.75 = left side), v goes from the front of the cabin (0) to the back (1).
const winTex = new Map();
function windowTexture(type) {
  if (winTex.has(type)) return winTex.get(type);
  const spec = CARS[type], z0 = spec.cabin[0][0], z1 = spec.cabin[spec.cabin.length - 1][0], V = z => (z - z0) / (z1 - z0), N = 256;
  const c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, N, N);
  const glass = (u0, u1, v0, v1) => { const x = u0 * N, w = (u1 - u0) * N, y = (1 - v1) * N, h = (v1 - v0) * N, r = Math.min(10, w / 3, h / 3), gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, "#1d2a38"); gr.addColorStop(0.45, "#0c131b"); gr.addColorStop(1, "#070b10"); g.fillStyle = gr;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); };
  const [ua, ub] = type === "van" ? [0.2, 0.37] : [0.19, 0.385];
  for (const [za, zb] of spec.win.side) { glass(ua, ub, V(za), V(zb)); glass(1 - ub, 1 - ua, V(za), V(zb)); }
  if (spec.win.front) glass(0.4, 0.6, V(spec.win.front[0]), V(spec.win.front[1]));
  if (spec.win.rear) glass(0.4, 0.6, V(spec.win.rear[0]), V(spec.win.rear[1]));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; winTex.set(type, t); return t;
}

const QC = [{ long: 30, around: 22, seg: 20, full: true }, { long: 12, around: 12, seg: 10, full: false }];
const carGeos = new Map();
function carGeometry(type, lod) {
  const key = type + lod; if (carGeos.has(key)) return carGeos.get(key);
  const spec = CARS[type], q = QC[lod]; useDetail({ foilN: 6, bev: lod === 0 ? 1 : 0 });
  const z0 = spec.cabin[0][0], z1 = spec.cabin[spec.cabin.length - 1][0];
  const lower = loft(spec.lower, q.long, q.around, { start: -Math.PI / 2, uv: () => [0.003, 0.003] });
  const cabin = loft(spec.cabin, q.long, q.around, { start: -Math.PI / 2, uv: (x, y, z, u) => [u, (z - z0) / (z1 - z0)] });
  const shell = merge([lower, cabin]);
  const det = [], lamps = [], N = spec.nose, T = spec.tail;
  const topAt = z => { let top = 0; for (const r of spec.lower) if (Math.abs(r[0] - z) < 0.6) top = Math.max(top, r[2] + r[4] / 2); return top; };
  // under the paint: a dark skirt, so the body doesn't look like it sits on the road
  det.push(vc(loft([S(N + 0.2, .5, .22, 2.6, 3), S(N + 0.8, .5, .2, 3.3, 3), S(T - 0.8, .5, .2, 3.3, 3), S(T - 0.2, .5, .22, 2.6, 3)], 6, 10, { start: -Math.PI / 2 }), DARK));
  // front: grille, bumper lip, lamps; rear: bumper, plate, lamps, exhausts
  const fy = topAt(N + 0.4) - 0.34;
  det.push(box(1.5, 0.3, 0.12, 0, fy, N - 0.03, DARK)); det.push(box(2.9, 0.12, 0.2, 0, 0.5, N + 0.1, DARK)); det.push(box(2.9, 0.12, 0.2, 0, 0.52, T - 0.1, DARK));
  det.push(box(0.95, 0.24, 0.05, 0, spec.plateY + 0.1, T + 0.02, PLATE), box(0.95, 0.24, 0.05, 0, spec.plateY + 0.1, N - 0.02, PLATE));
  const ty = topAt(T - 0.4) - 0.3;
  for (const sx of [-1, 1]) {
    lamps.push(lampUnit(0.95, 0.24, 0.16, sx * 1.12, fy + 0.05, N + 0.08, H.head), lampUnit(1.0, 0.26, 0.16, sx * 1.1, ty, T - 0.08, H.tail));
    det.push(vc(moved(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8).rotateX(Math.PI / 2), sx * 0.85, 0.4, T + 0.05), CHROME));
    det.push(box(0.3, 0.2, 0.22, sx * 1.78, spec.mirrors[1], spec.mirrors[0], DARK)); // wing mirrors
  }
  if (spec.taxi) { lamps.push(lampUnit(1.0, 0.26, 0.4, 0, spec.cabin[3][2] + 0.14, 0.5, H.sign)); det.push(box(1.0, 0.04, 0.42, 0, spec.cabin[3][2] + 0.0, 0.5, DARK)); }
  if (spec.spare) det.push(vc(moved(new THREE.LatheGeometry([V2(0.18, -0.15), V2(0.6, -0.15), V2(0.66, -0.07), V2(0.66, 0.07), V2(0.6, 0.15), V2(0.18, 0.15)], 18).rotateX(Math.PI / 2), 0, 1.45, T + 0.15), TYRE)); // a spare wheel on the back door (it never turns)
  const wheels = []; const w = spec.wheels;
  for (const [x, z] of [[-1.5, w.fz], [1.5, w.fz], [-1.5, w.rz], [1.5, w.rz]]) wheels.push({ x, z, R: w.R, geo: wheelGeo(w.R, w.W, x < 0 ? -1 : 1, q.seg) });
  const out = { shell, detail: merge(det), lamps: lamps.length ? merge(lamps) : null, wheels, spec, win: windowTexture(type), brake: { y: ty, z: T } };
  if (lod === 1) { out.detail = mergeGeometries([out.detail, ...wheels.map(w => moved(w.geo.clone(), w.x, w.R, w.z))]); }
  carGeos.set(key, out); return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// assembling a vehicle
// ---------------------------------------------------------------------------------------------------------------------
const lods = new Set(); let bias = 1;
export function setTrafficDetail(k) { bias = k; for (const l of lods) l.levels[1].distance = 95 * bias; }
const mesh = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; return o; };

function finish(near, far, wheels, kind, extra = {}) {
  const lod = new THREE.LOD(); lod.addLevel(near, 0); lod.addLevel(far, 95 * bias); lods.add(lod);
  const grp = new THREE.Group(); grp.add(lod);
  grp.userData = { wheels, kind, ...extra };
  return grp;
}

export const CAR_TYPES = ["sedan", "hatch", "suv", "van", "taxi", "coupe"];
const TYPE_WEIGHT = [3, 3, 2, 1.2, 0.8, 0.9]; const TW = TYPE_WEIGHT.reduce((a, b) => a + b);
export function carTypeFor(r) { let x = r * TW; for (let i = 0; i < CAR_TYPES.length; i++) if ((x -= TYPE_WEIGHT[i]) < 0) return CAR_TYPES[i]; return CAR_TYPES[0]; }

const brakeGeos = new Map(); // (each car type's brake-light pair, built once)
export function makeCar(type, hex, ownTaxi = false) { // (ownTaxi: the taxi keeps the colour given, a city's own cab colour, instead of yellow)
  if (!CARS[type]) type = "sedan";
  const S_ = shared(), paint = paintMat(type === "taxi" && !ownTaxi ? "#f2c230" : hex, windowTexture(type));
  const g0 = carGeometry(type, 0), g1 = carGeometry(type, 1), near = new THREE.Group(), far = new THREE.Group(), wheels = [];
  near.add(mesh(g0.shell, paint), mesh(g0.detail, S_.detail, false)); if (g0.lamps) near.add(mesh(g0.lamps, trafficLamp, false));
  for (const w of g0.wheels) { const ax = new THREE.Group(); ax.position.set(w.x, w.R, w.z); ax.add(mesh(w.geo, S_.wheel, false)); near.add(ax); wheels.push(ax); }
  far.add(mesh(g1.shell, paint, false), mesh(g1.detail, S_.detail, false)); if (g1.lamps) far.add(mesh(g1.lamps, trafficLamp, false));
  const car = finish(near, far, wheels, "car");
  const sp = g0.spec, len = sp.tail - sp.nose, shadow = contactShadow(4.6, len + 1.6); shadow.position.z = (sp.nose + sp.tail) / 2; car.add(shadow);
  const bk = g0.brake; let bg = brakeGeos.get(type); if (!bg) brakeGeos.set(type, bg = merge([-1, 1].map(sx => new THREE.PlaneGeometry(1.06, 0.3).translate(sx * 1.1, bk.y, bk.z + 0.02)))); const br = new THREE.Mesh(bg, S_.brake); br.visible = false; near.add(br); car.userData.brakeLight = br; // (over the tail lamps, facing back)
  const pool = new THREE.Mesh(flatGeo(4.4, 11), S_.pool); pool.position.set(0, 0.07, sp.nose - 5.2); pool.renderOrder = 2; pool.frustumCulled = false; car.add(pool);
  return car;
}

// ---------------------------------------------------------------------------------------------------------------------
// lorries and the bus: boxy bodies with flat panels (decals) on the sides for windows, logos and doors
// ---------------------------------------------------------------------------------------------------------------------
const BRANDS = [["TRANSPORTA", "#d6342a", "#f2f2f0"], ["FRESHLY", "#2e8b57", "#f2f2f0"], ["NORDHAUL", "#1f4f9c", "#e9eef4"], ["VELOX FREIGHT", "#f0a020", "#2a2d33"], ["BLUEWAVE", "#2a9bd6", "#f2f2f0"], ["KITE CARGO", "#8a3fa8", "#ece8f2"], ["GREENMILE", "#4aa04a", "#f2f2f0"], ["ORBIT LOGISTICS", "#c0392b", "#dfe3e8"]];
const CONTAINERS = ["#b8322a", "#2a5aa6", "#2f7a4f", "#d9822b", "#6f7680", "#c9a227"];
const SHIPLINES = ["NORDLINE", "VELOCITA SEA", "KITE MARITIME", "ORBIT SHIPPING", "BLUEWAVE"];
const panels = new Map();
function decal(key, w, h, draw) { // a transparent picture for a flat panel on a vehicle's side
  let m = panels.get(key); if (m) return m;
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  panels.set(key, m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.55, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
  return m;
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const plane = (w, h, x, y, z, ry = 0) => moved(new THREE.PlaneGeometry(w, h).rotateY(ry), x, y, z);
const sidePlanes = (w, h, x, y, z) => [plane(w, h, x, y, z, Math.PI / 2), plane(w, h, -x, y, z, -Math.PI / 2)]; // [right, left]
const hashHex = hex => (hex.charCodeAt(1) * 7 + hex.charCodeAt(3) * 3 + hex.charCodeAt(5)) | 0;

function trailerPanel(kind, brand, hex) { // the logo / corrugation picture for the long sides of a trailer
  return decal(`trailer-${kind}-${brand}-${hex}`, 1024, 256, (g, w, h) => {
    g.textAlign = "center"; g.textBaseline = "middle";
    if (kind === "container") { // corrugated steel with a shipping line's name
      for (let x = 0; x < w; x += 14) { g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(x, 0, 5, h); g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(x + 6, 0, 3, h); }
      g.fillStyle = "rgba(255,255,255,0.92)"; g.font = "900 96px Arial, sans-serif"; g.fillText(SHIPLINES[brand % SHIPLINES.length], w / 2, h * 0.5, 900);
      g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(40, 20, w - 80, 8); g.fillRect(40, h - 28, w - 80, 8);
    } else {
      const [name, a, b] = BRANDS[brand % BRANDS.length];
      g.fillStyle = a; g.fillRect(0, h * 0.74, w, h * 0.12); g.fillStyle = b === "#2a2d33" ? b : a; g.fillRect(0, h * 0.9, w, h * 0.05);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.2, 0); g.lineTo(0, h * 0.5); g.fill(); // a corner flash
      g.fillStyle = a; g.font = "italic 900 104px Arial, sans-serif"; g.fillText(name, w * 0.55, h * 0.38, 800);
    }
  });
}
function busPanel(operator, accent, doors) { // windows, doors, a stripe and the operator's name along one section of a bus
  return decal(`bus-${operator}-${accent}-${doors}`, 1024, 256, (g, w, h) => {
    const glass = (x, y, ww, hh, light) => { const gr = g.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, light ? "#2a3a4a" : "#1d2a38"); gr.addColorStop(1, "#070b10"); g.fillStyle = gr; rr(g, x, y, ww, hh, 10); g.fill(); };
    const doorX = doors.map(d => d * w); let x = 24;
    while (x < w - 70) { const hit = doorX.find(d => x + 110 > d - 6 && x < d + 90); if (hit !== undefined) { x = hit + 96; continue; } glass(x, 40, 110, 96, false); x += 118; }
    for (const d of doorX) { g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(d - 2, 36, 92, 170); glass(d + 2, 40, 40, 150, true); glass(d + 46, 40, 40, 150, true); } // folding doors
    g.fillStyle = accent; g.fillRect(0, 150, w, 22); g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(0, 176, w, 6);
    g.fillStyle = "rgba(255,255,255,0.95)"; g.font = "900 40px Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(operator, 200, 222, 600);
  });
}

const bigGeos = new Map();
const bigOnce = (key, build) => { if (!bigGeos.has(key)) bigGeos.set(key, build()); return bigGeos.get(key); };
const wheelSet = (list, R, W) => list.map(([x, z]) => ({ x, z, R, geo: wheelGeo(R, W, x < 0 ? -1 : 1, 18) }));
const STEEL = new THREE.MeshStandardMaterial({ color: 0xcfd4dc, metalness: 0.95, roughness: 0.22 });
const JOINT = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.8 });
function addWheels(group, list, S_, wheels) { for (const w of list) { const ax = new THREE.Group(); ax.position.set(w.x, w.R, w.z); ax.add(mesh(w.geo, S_.wheel, false)); group.add(ax); wheels.push(ax); } }
function addStatic(group, list, S_) { for (const w of list) { const m = mesh(w.geo, S_.wheel, false); m.position.set(w.x, w.R, w.z); group.add(m); } }
function headPool(vehicle, width, zNose) { const pool = new THREE.Mesh(flatGeo(width, 12), shared().pool); pool.position.set(0, 0.07, zNose - 5.8); pool.renderOrder = 2; pool.frustumCulled = false; vehicle.add(pool); }

// the front of a lorry: cab, chassis, lamps, mirrors (z0 = the nose)
function cabParts(z0) {
  const det = [], lamps = [], glass = [];
  const cab = loft([S(z0, 3.3, .9, 3.4, 4), S(z0 + 0.25, 3.7, .85, 3.5, 4.4), S(z0 + 3.0, 3.85, .85, 3.5, 4.6), S(z0 + 3.8, 3.85, .85, 3.5, 4.6), S(z0 + 4.0, 3.5, .9, 3.4, 4)], 14, 20, { start: -Math.PI / 2 });
  glass.push(plane(2.95, 1.05, 0, 2.75, z0 - 0.02, Math.PI), ...sidePlanes(2.0, 1.0, 1.77, 2.75, z0 + 1.5));
  det.push(box(2.3, 0.65, 0.1, 0, 1.35, z0 - 0.05, DARK), box(3.4, 0.2, 0.3, 0, 0.7, z0 - 0.1, DARK), box(3.0, 0.1, 0.1, 0, 1.0, z0 - 0.05, CHROME));
  for (const sx of [-1, 1]) {
    lamps.push(lampUnit(0.7, 0.36, 0.14, sx * 1.35, 1.35, z0 - 0.04, H.head));
    det.push(box(0.12, 0.9, 0.12, sx * 1.95, 2.65, z0 + 0.5, DARK), box(0.2, 0.7, 0.18, sx * 2.1, 2.55, z0 + 0.45, DARK)); // mirror arm and head
    det.push(vc(moved(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 10), sx * 1.62, 3.0, z0 + 4.1), CHROME)); // exhaust stack behind the cab
  }
  det.push(box(3.0, 0.45, 8.0, 0, 0.95, z0 + 5.0, DARK)); // the chassis rails under the trailer
  det.push(box(1.8, 0.2, 1.8, 0, 1.28, z0 + 6.4, [0.1, 0.1, 0.11])); // fifth wheel plate
  return { cab, det, lamps, glass };
}

// the trailer behind it: a box, a container or a steel tanker (zFront..zBack)
function trailerParts(kind, zFront, zBack) {
  const det = [], lamps = [], len = zBack - zFront, zc = (zFront + zBack) / 2;
  let body;
  if (kind === "tanker") { // a cylinder lying along the lorry, in polished steel
    const R = 1.55, pts = [V2(0.02, -len / 2), V2(R * 0.55, -len / 2 + 0.12), V2(R * 0.9, -len / 2 + 0.35), V2(R, -len / 2 + 0.7), V2(R, len / 2 - 0.7), V2(R * 0.9, len / 2 - 0.35), V2(R * 0.55, len / 2 - 0.12), V2(0.02, len / 2)];
    body = moved(new THREE.LatheGeometry(pts, 24).rotateX(Math.PI / 2), 0, 3.05, zc);
    for (let i = 0; i < 3; i++) det.push(vc(moved(new THREE.CylinderGeometry(0.34, 0.38, 0.28, 12), 0, 4.65, zFront + len * (0.22 + i * 0.28)), CHROME)); // hatches
    det.push(box(3.1, 0.3, len - 0.6, 0, 1.45, zc, DARK)); // the frame under the tank
  } else {
    const top = kind === "container" ? 4.35 : 4.45;
    body = loft([S(zFront, top, 1.65, 3.5, 6), S(zBack, top, 1.65, 3.5, 6)], 2, 20, { start: -Math.PI / 2 });
    det.push(box(3.1, 0.12, len - 0.4, 0, 1.55, zc, DARK));
  }
  det.push(box(3.3, 0.22, 0.16, 0, 1.2, zBack + 0.12, DARK), box(0.9, 0.24, 0.05, 0, 1.55, zBack + 0.05, PLATE)); // rear bumper bar and plate
  for (const sx of [-1, 1]) {
    lamps.push(lampUnit(0.5, 0.3, 0.12, sx * 1.4, 2.0, zBack + 0.02, H.tail));
    for (let k = 0; k < 5; k++) lamps.push(lampUnit(0.04, 0.12, 0.3, sx * 1.76, 1.7, zFront + 1.4 + k * (len - 2.8) / 4, H.amber)); // side marker lamps
  }
  return { body, det, lamps, len, zc };
}

// ---- the lorry ----
export const TRUCK_KINDS = ["box", "container", "tanker", "bus"];
export function makeTruck(lenWorld, hex, kind = "box") {
  if (kind === "bus") return makeBus(hex, lenWorld);
  const S_ = shared(), L = lenWorld, z0 = -L / 2, brand = Math.abs(hashHex(hex)) % BRANDS.length;
  const g = bigOnce(`truck-${kind}-${L}`, () => {
    useDetail({ foilN: 6, bev: 1 });
    const cab = cabParts(z0), tr = trailerParts(kind, z0 + 4.1, L / 2);
    const wheels = wheelSet([[-1.55, z0 + 1.8], [1.55, z0 + 1.8], [-1.55, L / 2 - 4.3], [1.55, L / 2 - 4.3], [-1.55, L / 2 - 2.9], [1.55, L / 2 - 2.9], [-1.55, L / 2 - 1.5], [1.55, L / 2 - 1.5]], 0.78, 0.6);
    return { cab, tr, detail: merge([...cab.det, ...tr.det]), lamps: merge([...cab.lamps, ...tr.lamps]), glass: merge(cab.glass), wheels };
  });
  const near = new THREE.Group(), far = new THREE.Group(), wheels = [], cabPaint = paintMat(hex);
  const trailHex = kind === "container" ? CONTAINERS[brand % CONTAINERS.length] : ["#f2f2f0", "#e9eef4", "#dfe3e8"][brand % 3];
  const bodyMat = kind === "tanker" ? STEEL : paintMat(trailHex);
  near.add(mesh(g.cab.cab, cabPaint), mesh(g.tr.body, bodyMat), mesh(g.detail, S_.detail, false), mesh(g.lamps, trafficLamp, false), mesh(g.glass, S_.glass, false));
  for (const [sx, ry] of [[1, Math.PI / 2], [-1, -Math.PI / 2]]) {
    const panel = kind === "tanker"
      ? decal(`tank-${brand}`, 512, 64, (c, w, h) => { c.fillStyle = BRANDS[brand][1]; c.fillRect(0, 0, w, h * 0.6); c.fillStyle = "#ffffff"; c.font = "900 40px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(BRANDS[brand][0], w / 2, h * 0.3, 480); })
      : trailerPanel(kind, brand, trailHex);
    const p = kind === "tanker" ? new THREE.Mesh(new THREE.PlaneGeometry(g.tr.len - 2, 0.9).rotateY(ry), panel) : new THREE.Mesh(new THREE.PlaneGeometry(g.tr.len - 0.6, 2.7).rotateY(ry), panel);
    p.position.set(sx * (kind === "tanker" ? 1.57 : 1.765), 3.0, g.tr.zc); near.add(p);
  }
  addWheels(near, g.wheels, S_, wheels);
  far.add(mesh(g.cab.cab, cabPaint, false), mesh(g.tr.body, bodyMat, false), mesh(g.detail, S_.detail, false), mesh(g.lamps, trafficLamp, false)); addStatic(far, g.wheels, S_);
  const truck = finish(near, far, wheels, "truck"); truck.add(contactShadow(4.8, L + 1.5)); headPool(truck, 5.2, z0);
  return truck;
}

// ---- the articulated bus ----
export function makeBus(hex, lenWorld = 16) {
  const S_ = shared(), L = lenWorld, z0 = -L / 2, h = Math.abs(hashHex(hex));
  const op = ["METROLINE", "CITYGO", "URBAN EXPRESS", "NOVA TRANSIT"][h % 4], accent = ["#e0a526", "#2d6fb5", "#d6342a", "#2e8b57", "#7a3f9d"][(h >> 2) % 5];
  const g = bigOnce(`bus-${L}`, () => {
    useDetail({ foilN: 6, bev: 1 });
    const zJ0 = z0 + 7.6, zJ1 = zJ0 + 1.0, det = [], lamps = [], glass = [];
    const front = loft([S(z0, 3.3, .55, 3.2, 5), S(z0 + 0.4, 3.45, .5, 3.5, 5.5), S(zJ0 - 0.2, 3.45, .5, 3.5, 5.5), S(zJ0, 3.4, .5, 3.4, 5)], 4, 22, { start: -Math.PI / 2 });
    const rear = loft([S(zJ1, 3.4, .5, 3.4, 5), S(zJ1 + 0.2, 3.45, .5, 3.5, 5.5), S(L / 2 - 0.4, 3.45, .5, 3.5, 5.5), S(L / 2, 3.3, .55, 3.3, 5)], 4, 22, { start: -Math.PI / 2 });
    const bellows = loft([S(zJ0 - 0.1, 3.3, .6, 3.2, 4), S((zJ0 + zJ1) / 2, 3.2, .7, 3.0, 4), S(zJ1 + 0.1, 3.3, .6, 3.2, 4)], 6, 16, { start: -Math.PI / 2 });
    glass.push(plane(3.0, 1.55, 0, 2.15, z0 - 0.02, Math.PI), plane(3.0, 1.0, 0, 2.4, L / 2 + 0.02, 0)); // windscreen, rear window
    lamps.push(lampUnit(1.7, 0.3, 0.1, 0, 3.15, z0 - 0.04, H.amber)); // the destination sign
    for (const sx of [-1, 1]) {
      lamps.push(lampUnit(0.5, 0.5, 0.14, sx * 1.35, 0.95, z0 - 0.04, H.head), lampUnit(0.35, 0.8, 0.14, sx * 1.5, 1.4, L / 2 + 0.03, H.tail));
      det.push(box(0.12, 0.8, 0.12, sx * 1.95, 2.6, z0 + 0.35, DARK), box(0.2, 0.55, 0.16, sx * 2.12, 2.45, z0 + 0.35, DARK));
    }
    det.push(box(3.3, 0.25, 0.2, 0, 0.65, z0 - 0.08, DARK), box(3.3, 0.25, 0.2, 0, 0.65, L / 2 + 0.08, DARK), box(2.6, 0.5, 0.1, 0, 3.55, L / 2 - 4, [0.78, 0.8, 0.82]), box(0.9, 0.24, 0.05, 0, 0.95, L / 2 + 0.03, PLATE));
    det.push(box(3.0, 0.3, L - 1.4, 0, 0.35, 0, DARK)); // underbody
    const wheels = wheelSet([[-1.55, z0 + 2.0], [1.55, z0 + 2.0], [-1.55, zJ0 - 2.0], [1.55, zJ0 - 2.0], [-1.55, L / 2 - 2.6], [1.55, L / 2 - 2.6]], 0.62, 0.52);
    return { front, rear, bellows, det: merge(det), lamps: merge(lamps), glass: merge(glass), wheels, zJ0, zJ1 };
  });
  const near = new THREE.Group(), far = new THREE.Group(), wheels = [], paint = paintMat(hex), secF = g.zJ0 - z0, secR = L / 2 - g.zJ1;
  near.add(mesh(g.front, paint), mesh(g.rear, paint), mesh(g.bellows, JOINT), mesh(g.det, S_.detail, false), mesh(g.lamps, trafficLamp, false), mesh(g.glass, S_.glass, false));
  for (const [sx, ry] of [[1, Math.PI / 2], [-1, -Math.PI / 2]]) { // windows, doors, stripe and name along both sections
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(secF - 0.9, 2.5).rotateY(ry), busPanel(op, accent, [0.2, 0.62])); pf.position.set(sx * 1.76, 2.0, z0 + secF / 2 + 0.2); near.add(pf);
    const pr = new THREE.Mesh(new THREE.PlaneGeometry(secR - 0.9, 2.5).rotateY(ry), busPanel(op, accent, [0.42])); pr.position.set(sx * 1.76, 2.0, g.zJ1 + secR / 2); near.add(pr);
  }
  addWheels(near, g.wheels, S_, wheels);
  far.add(mesh(g.front, paint, false), mesh(g.rear, paint, false), mesh(g.det, S_.detail, false), mesh(g.lamps, trafficLamp, false)); addStatic(far, g.wheels, S_);
  const bus = finish(near, far, wheels, "truck"); bus.add(contactShadow(4.8, L + 1.5)); headPool(bus, 5.2, z0);
  return bus;
}
