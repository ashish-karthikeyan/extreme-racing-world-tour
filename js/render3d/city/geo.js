// Small shared shapes the city is built from.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cloneModel, hasModel } from "../assets.js";
import { rng } from "./rng.js";

const flat = g => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (k !== "position" && k !== "normal") o.deleteAttribute(k); return o; };

export const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // 1x1x1, standing on the ground, centred in x and z
export const unitPlane = new THREE.PlaneGeometry(1, 1);                       // faces +Z

// a gable roof: a triangular prism, 1 wide, 1 long, 0.5 high, the ridge running along Z
export function roofGeo() {
  const p = [[-.5, 0, -.5], [.5, 0, -.5], [0, .5, -.5], [-.5, 0, .5], [.5, 0, .5], [0, .5, .5]];
  const tri = (a, b, c) => [...p[a], ...p[b], ...p[c]];
  const v = [...tri(0, 2, 1), ...tri(3, 4, 5), ...tri(0, 3, 5), ...tri(0, 5, 2), ...tri(1, 2, 5), ...tri(1, 5, 4), ...tri(0, 1, 4), ...tri(0, 4, 3)];
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}

// a street lamp: pole, arm reaching towards +X (the road), lamp head
export function lampGeo() {
  const pole = new THREE.CylinderGeometry(0.11, 0.17, 9, 6).translate(0, 4.5, 0);
  const arm = new THREE.BoxGeometry(2.7, 0.18, 0.18).translate(1.3, 9, 0);
  const head = new THREE.BoxGeometry(1.2, 0.26, 0.55).translate(2.4, 8.92, 0);
  return mergeGeometries([flat(pole), flat(arm), flat(head)]);
}
export const lampGlowGeo = () => new THREE.BoxGeometry(1.0, 0.1, 0.42).translate(2.4, 8.75, 0);

export const personGeo = () => flat(new THREE.CapsuleGeometry(0.34, 1.25, 3, 6).translate(0, 1.0, 0));
export const headGeo = () => new THREE.SphereGeometry(0.3, 6, 5).translate(0, 2.15, 0);

// low-poly mountain: a rough, squashed icosahedron, base at y=0
export function hillGeo(detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail); g.translate(0, 0.0, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, Math.max(y, -0.15)); }
  g.computeVertexNormals(); return g;
}

// A tree from one of the Kenney models, split into trunk and leaves, each as ONE geometry with the model's size scaled to
// height 1 and its base at y=0 (so an instance scale of 10 is a 10-unit tree).
export function treeGeos(name) {
  if (!hasModel(name)) return null;
  const root = cloneModel(name); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), trunk = [], leaves = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = flat(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
    (/leaf|leafs|grass|plant|cactus/i.test(o.material.name) ? leaves : trunk).push(g);
  });
  const all = mergeGeometries([...trunk, ...leaves]); all.computeBoundingBox();
  const bb = all.boundingBox, k = 1 / (bb.max.y - bb.min.y), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const fit = g => g.translate(-cx, -bb.min.y, -cz).scale(k, k, k);
  return { trunk: trunk.length ? fit(mergeGeometries(trunk)) : null, leaves: leaves.length ? fit(mergeGeometries(leaves)) : null, width: (bb.max.x - bb.min.x) * k };
}

// a white motor yacht: a hull that narrows to a raked bow, two decks with dark window bands, a flybridge and a radar mast; bow towards -Z,
// base at y = 0, 1 wide and about 3.6 long. Coloured per vertex (white, dark glass, teak), so the instance tint can still vary the white.
// a motor yacht, bow towards -Z, 1 wide, about 3.9 long, sitting on the water at y = 0 (vertex colours: white hull and decks, a dark
// stripe at the waterline, teak decks, tinted glass). The hull is lofted through nine stations, so it is smooth, flares to a fine raked bow
// and rises to it; three decks step back above it, their fronts raked like a real yacht's windscreens.
const smoothPart = (pos, quads, c, centre) => { // quads [a, b, c, d] of indices into pos; each face is turned to face away from centre(point)
  const idx = [], P = i => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (const q of quads) for (const t of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
    if (t[1] === t[2] || t[0] === t[2]) continue;
    const A = P(t[0]), B = P(t[1]), C = P(t[2]); e1.subVectors(B, A); e2.subVectors(C, A); n.crossVectors(e1, e2); m.copy(A).add(B).add(C).multiplyScalar(1 / 3);
    if (n.dot(m.sub(centre(m.clone()))) < 0) idx.push(t[0], t[2], t[1]); else idx.push(t[0], t[1], t[2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const o = g.toNonIndexed(), col = new Float32Array(o.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) col.set(c, i); o.setAttribute("color", new THREE.BufferAttribute(col, 3)); return o;
};
export function yachtGeo() {
  const W = [1, 1, 1], GLS = [0.07, 0.09, 0.12], TEAK = [0.62, 0.45, 0.3], STRIPE = [0.1, 0.14, 0.24], parts = [];
  const col = (g, c) => { const o = flat(g), a = new Float32Array(o.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; } o.setAttribute("color", new THREE.BufferAttribute(a, 3)); return o; };
  // the hull: stations from the stern (t = 0, z = 1.7) to the bow (t = 1, z = -2.15)
  const N = 9, st = [];
  for (let i = 0; i < N; i++) { const t = i / (N - 1), hw = 0.5 * (t < 0.5 ? 1 - 0.06 * t : Math.max(0.025, Math.cos((t - 0.5) / 0.5 * Math.PI / 2) * 0.97)), deck = 0.42 + 0.16 * t * t; st.push({ z: 1.7 - 3.85 * t, hw, deck }); }
  const up = [], low = []; // upper hull: deck edge to chine; lower: chine to the keel line (the dark stripe)
  for (const s of st) up.push(-s.hw, s.deck, s.z, -s.hw * 0.94, 0.12, s.z, s.hw * 0.94, 0.12, s.z, s.hw, s.deck, s.z); // 4 per station: 0 left deck, 1 left chine, 2 right chine, 3 right deck
  for (const s of st) low.push(-s.hw * 0.94, 0.12, s.z, 0, -0.06, s.z, s.hw * 0.94, 0.12, s.z);                           // 3 per station: chine, keel, chine
  const out = p => new THREE.Vector3(0, 0.2, p.z), qu = [], ql = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 4, b = (i + 1) * 4; qu.push([a, a + 1, b + 1, b], [a + 2, a + 3, b + 3, b + 2]); const c = i * 3, d = (i + 1) * 3; ql.push([c, c + 1, d + 1, d], [c + 1, c + 2, d + 2, d + 1]); }
  parts.push(smoothPart(up, qu, W, out), smoothPart(low, ql, STRIPE, out));
  // the transom (the flat stern) and the deck
  const s0 = st[0], tr = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([-s0.hw, s0.deck, s0.z, -s0.hw * 0.94, 0.12, s0.z, s0.hw * 0.94, 0.12, s0.z, -s0.hw, s0.deck, s0.z, s0.hw * 0.94, 0.12, s0.z, s0.hw, s0.deck, s0.z, -s0.hw * 0.94, 0.12, s0.z, 0, -0.06, s0.z, s0.hw * 0.94, 0.12, s0.z], 3)); tr.computeVertexNormals(); parts.push(col(tr, W));
  const dk = []; for (let i = 0; i < N - 1; i++) { const p = st[i], q = st[i + 1]; dk.push(-p.hw, p.deck, p.z, p.hw, p.deck, p.z, q.hw, q.deck, q.z, -p.hw, p.deck, p.z, q.hw, q.deck, q.z, -q.hw, q.deck, q.z); }
  { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(dk, 3)); g.computeVertexNormals(); parts.push(col(g, TEAK)); } // (wound so it faces up)
  // decks: boxes whose front top edge is pushed back (a raked windscreen)
  const raked = (w, h, z0, z1, y, rake, c) => { const g = new THREE.BoxGeometry(w, h, z1 - z0).translate(0, y + h / 2, (z0 + z1) / 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > y + h / 2 && p.getZ(i) < (z0 + z1) / 2) p.setZ(i, p.getZ(i) + rake); g.computeVertexNormals(); return col(g, c); };
  parts.push(raked(0.8, 0.34, -0.8, 1.3, 0.46, 0.32, W), raked(0.815, 0.15, -0.72, 1.22, 0.55, 0.3, GLS));     // main deck, its window band
  parts.push(raked(0.66, 0.28, -0.35, 1.05, 0.8, 0.26, W), raked(0.675, 0.12, -0.28, 0.98, 0.87, 0.24, GLS));  // upper deck, its windows
  parts.push(raked(0.6, 0.05, -0.05, 1.0, 1.08, 0.08, W), raked(0.5, 0.12, 0.12, 0.42, 1.13, 0.1, GLS));      // flybridge roof, windscreen
  parts.push(col(new THREE.BoxGeometry(0.05, 0.3, 0.05).translate(-0.24, 1.28, 0.65), W), col(new THREE.BoxGeometry(0.05, 0.3, 0.05).translate(0.24, 1.28, 0.65), W), col(new THREE.BoxGeometry(0.53, 0.05, 0.12).translate(0, 1.44, 0.65), W)); // radar arch
  parts.push(col(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8).translate(0, 1.48, 0.65), W)); // radome
  return mergeGeometries(parts);
}

// a palm tree, 1 high, base at y = 0: a gently curving, ringed trunk, a crown of drooping fronds made of leaflets (both sides drawn), coconuts
export function palmGeos() {
  const r = rng(77), trunk = [], leaves = [], lean = new THREE.Vector3(0.09, 0, 0.03);
  const at = t => new THREE.Vector3(lean.x * t * t, t * 0.9, lean.z * t * t); // the trunk's centre line (it ends at 0.9: the crown fills the rest)
  const SEG = 9, SIDES = 6;
  for (let i = 0; i < SEG; i++) { // ringed segments: each a short cone, wider at its foot
    const t0 = i / SEG, t1 = (i + 1) / SEG, a = at(t0), b = at(t1), r0 = 0.032 - 0.012 * t0, r1 = 0.028 - 0.012 * t1, h = b.y - a.y;
    const g = new THREE.CylinderGeometry(r1, r0 * 1.12, h, SIDES, 1).translate(0, h / 2, 0); g.rotateZ(-Math.atan2(b.x - a.x, h)); g.translate(a.x, a.y, a.z); trunk.push(flat(g));
  }
  const top = at(1), FR = 8;
  for (let f = 0; f < FR; f++) {
    const ang = f / FR * Math.PI * 2 + r.range(-0.2, 0.2), dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), len = r.range(0.34, 0.42), rise = r.range(0.05, 0.14), droop = r.range(0.32, 0.5);
    const side = new THREE.Vector3(-dir.z, 0, dir.x), pts = [], SEGS = 8, pos = [];
    for (let s = 0; s <= SEGS; s++) { const u = s / SEGS; pts.push(top.clone().addScaledVector(dir, len * u).add(new THREE.Vector3(0, rise * u - droop * u * u * len, 0))); }
    for (let s = 0; s < SEGS; s++) { // leaflets: a V either side of the rib, widest a third of the way out
      const u0 = s / SEGS, u1 = (s + 1) / SEGS, w0 = 0.09 * Math.sin(Math.PI * Math.min(1, u0 * 1.15 + 0.05)), w1 = 0.09 * Math.sin(Math.PI * Math.min(1, u1 * 1.15 + 0.05)), A = pts[s], B = pts[s + 1];
      for (const sg of [-1, 1]) { const A2 = A.clone().addScaledVector(side, sg * w0).add(new THREE.Vector3(0, -0.035 * (0.4 + u0), 0)), B2 = B.clone().addScaledVector(side, sg * w1).add(new THREE.Vector3(0, -0.035 * (0.4 + u1), 0));
        for (const [p, q, o] of [[A, A2, B], [A2, B2, B]]) { pos.push(p.x, p.y, p.z, q.x, q.y, q.z, o.x, o.y, o.z, p.x, p.y, p.z, o.x, o.y, o.z, q.x, q.y, q.z); } } // (front and back)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); leaves.push(g);
  }
  for (let i = 0; i < 3; i++) { const a = i * 2.1; trunk.push(flat(new THREE.SphereGeometry(0.022, 5, 4).translate(top.x + Math.cos(a) * 0.028, top.y - 0.03, top.z + Math.sin(a) * 0.028))); } // coconuts
  const t = mergeGeometries(trunk), l = mergeGeometries(leaves); const bb = new THREE.Box3().setFromBufferAttribute(l.attributes.position).union(new THREE.Box3().setFromBufferAttribute(t.attributes.position));
  const k = 1 / (bb.max.y - bb.min.y); t.scale(k, k, k); l.scale(k, k, k);
  return { trunk: t, leaves: l, width: (bb.max.x - bb.min.x) * k };
}

// a hipped roof over a 1 x 1 footprint, 1 high (its four sides slope up to a short ridge), base at y = 0
export function hipRoofGeo() { return flat(new THREE.CylinderGeometry(0.12, 1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(Math.SQRT1_2, 1, Math.SQRT1_2)); }

// a bus shelter: roof slab, back and side glass, a bench; open side towards +X (the road), 6 long, base at y=0
export function busStopGeo() {
  const roof = new THREE.BoxGeometry(2.6, 0.18, 6.4).translate(0, 3.5, 0);
  const back = new THREE.BoxGeometry(0.1, 3.3, 6.0).translate(-1.1, 1.75, 0);
  const sideA = new THREE.BoxGeometry(2.3, 3.3, 0.1).translate(0, 1.75, -3.0), sideB = new THREE.BoxGeometry(2.3, 3.3, 0.1).translate(0, 1.75, 3.0);
  const bench = new THREE.BoxGeometry(0.7, 0.14, 4.2).translate(-0.6, 1.0, 0);
  const pole = new THREE.CylinderGeometry(0.08, 0.08, 6, 5).translate(1.2, 3, 3.6);
  return mergeGeometries([flat(roof), flat(back), flat(sideA), flat(sideB), flat(bench), flat(pole)]);
}

// A car from the Kenney car kit as ONE geometry (body and wheels together), 6.2 long, facing -Z, standing on y=0.
// The material is the model's own, so the colours of the paint come from its picture.
export function carGeo(name) {
  if (!hasModel(name)) return null;
  const root = cloneModel(name); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = []; let material = null;
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); material = material || o.material;
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  const all = mergeGeometries(parts); all.rotateY(Math.PI); all.computeBoundingBox();
  const bb = all.boundingBox, k = 6.2 / (bb.max.z - bb.min.z);
  all.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(k, k, k);
  return { geometry: all, material, width: (bb.max.x - bb.min.x) * k };
}

// a catch-fence: a see-through diamond mesh (alpha texture), 1x1, facing +Z
// catch fencing: fine galvanised chain-link (half-unit diamonds) between a post at each end, a top and a bottom rail; one repeat is 4 units wide
export function fenceTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.strokeStyle = "#8d939b"; g.lineWidth = 2; g.beginPath(); for (let i = -256; i <= 512; i += 32) { g.moveTo(i, 0); g.lineTo(i + 256, 256); g.moveTo(i + 256, 0); g.lineTo(i, 256); } g.stroke();
  g.fillStyle = "#6c7279"; g.fillRect(0, 0, 256, 7); g.fillRect(0, 249, 256, 7); g.fillRect(0, 120, 256, 4); // rails
  g.fillStyle = "#5b6067"; g.fillRect(0, 0, 9, 256); g.fillRect(247, 0, 9, 256); // posts
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); t.anisotropy = 8; return t;
}

// a flower bed 6 long and 1.7 wide: dark soil, a mound of green leaves, and colourful flower heads (vertex colours; the layout is fixed)
export function flowerBedGeo() {
  const rnd = rng(4242), parts = [], col = (g, c) => { const o = flat(g), a = new Float32Array(o.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; } o.setAttribute("color", new THREE.BufferAttribute(a, 3)); return o; };
  const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }, GREENS = ["#2f6b2f", "#3d8a3a", "#4f9a3f", "#2a5f2e"].map(lin), FLOWERS = ["#d6342a", "#f08ab0", "#f2c230", "#ffffff", "#8a3fa8", "#ff8a1f", "#e8506a"].map(lin);
  parts.push(col(new THREE.BoxGeometry(6, 0.42, 1.7).translate(0, 0.21, 0), lin("#3a2a1f")));
  for (let i = 0; i < 40; i++) parts.push(col(new THREE.SphereGeometry(rnd.range(0.26, 0.42), 6, 4).scale(1, 0.75, 1).translate(rnd.range(-2.8, 2.8), 0.5, rnd.range(-0.62, 0.62)), rnd.pick(GREENS)));
  const tone = []; for (let k = 0; k < 4; k++) tone.push(rnd.pick(FLOWERS)); // each bed is mostly two or three colours
  for (let i = 0; i < 80; i++) parts.push(col(new THREE.SphereGeometry(rnd.range(0.1, 0.16), 5, 4).translate(rnd.range(-2.85, 2.85), rnd.range(0.62, 0.82), rnd.range(-0.7, 0.7)), tone[Math.floor(rnd() * (i < 55 ? 2 : 4))]));
  return mergeGeometries(parts);
}
