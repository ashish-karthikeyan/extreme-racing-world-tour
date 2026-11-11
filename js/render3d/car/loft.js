// Geometry helpers shared by the race car and the traffic: smooth lofted bodies, airfoils, bevelled extrusions, tubes, and merging.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export { mergeGeometries };

export const V2 = (x, y) => new THREE.Vector2(x, y);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let cur = { foilN: 14, bev: 2 }; // the detail level being built: the helpers below read how many bevel steps and airfoil points it wants
export const useDetail = q => { cur = q; };
export const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------------------------------------------------
const KEEP = ["position", "normal", "uv", "color"];
export function prep(g) { // a plain non-indexed geometry with the same attributes as every other part, so they can be merged
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (!KEEP.includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  return n;
}
export const merge = list => mergeGeometries(list.map(prep));
export function tinted(g, hex) { // the same geometry with a vertex colour, for the far levels of detail (one material for many parts)
  const n = prep(g), c = new THREE.Color(hex), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  n.setAttribute("color", new THREE.BufferAttribute(a, 3)); return n;
}
export const moved = (g, x, y, z) => g.translate(x, y, z);

// smooth interpolation (Catmull-Rom) through a list of key cross-sections
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function resample(keys, n) {
  const out = [], m = keys.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n * m, k = Math.min(m - 1, Math.floor(u)), t = u - k;
    const p0 = keys[Math.max(0, k - 1)], p1 = keys[k], p2 = keys[k + 1], p3 = keys[Math.min(m, k + 2)], o = {};
    for (const f in p1) o[f] = cr(p0[f], p1[f], p2[f], p3[f], t);
    out.push(o);
  }
  return out;
}
const SEC = rows => rows.map(([z, cx, cy, w, h, n]) => ({ z, cx, cy, w, h, n }));

// A smooth lofted surface: rounded cross-sections (superellipses: n = 2 is an ellipse, higher is boxier) strung along Z.
// By default the UVs are a plan view of the car, so the team livery (drawn as a picture of the car from above) wraps over it.
// opts.start = the angle (radians, anticlockwise from +X seen from the front) where the ring starts and ends, so the texture seam can hide
// underneath; opts.uv = (x, y, z, u, v) => [u, v] with u = 0..1 round the ring and v = 0..1 along the body, for a custom mapping.
export function loft(rows, n, around, opts = {}) {
  const s = resample(SEC(rows), n), R = around + 1, start = opts.start || 0, pos = [], uv = [], idx = [];
  const planUV = (x, y, z) => [(x + 1.6) / 3.2, 1 - (z + 3.8) / 7.6], mapUV = opts.uv || planUV;
  const put = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(...mapUV(x, y, z, u, v)); };
  for (let i = 0; i <= n; i++) {
    const q = s[i], e = 2 / Math.max(1.2, q.n);
    for (let j = 0; j <= around; j++) { // (the last point repeats the first, so the texture can wrap cleanly)
      const a = start + j / around * TAU, c = Math.cos(a), sn = Math.sin(a);
      put(q.cx + Math.sign(c) * Math.pow(Math.abs(c), e) * q.w / 2, q.cy + Math.sign(sn) * Math.pow(Math.abs(sn), e) * q.h / 2, q.z, j / around, i / n);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < around; j++) {
    const a = i * R + j, b = a + 1, c = (i + 1) * R + j, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const f0 = (n + 1) * R, f1 = f0 + 1, q0 = s[0], q1 = s[n]; // flat end caps
  put(q0.cx, q0.cy, q0.z, 0.5, 0); put(q1.cx, q1.cy, q1.z, 0.5, 1);
  for (let j = 0; j < around; j++) { idx.push(f0, j + 1, j); idx.push(f1, n * R + j, n * R + j + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}

// an airfoil outline seen from the side (x = forward, y = up), leading edge forward; negative camber = an upside-down wing (downforce)
export function foil(chord, thick, camber, aoa) {
  const N = cur.foilN, pts = [], ca = Math.cos(aoa), sa = Math.sin(aoa);
  const P = (t, y) => { const x = (0.5 - t) * chord, yy = y * chord; return V2(x * ca - yy * sa, x * sa + yy * ca); };
  const prof = t => 5 * thick * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(P(t, 4 * camber * t * (1 - t) + prof(t))); }
  for (let i = N - 1; i > 0; i--) { const t = i / N; pts.push(P(t, 4 * camber * t * (1 - t) - prof(t))); }
  return new THREE.Shape(pts);
}
export const poly = pts => new THREE.Shape(pts.map(([x, y]) => V2(x, y)));
// extrude a side-view outline (x = forward, y = up) across the car, `width` wide and centred on X = 0; bevelled edges stay inside the outline
export function extrudeX(shape, width, bevel = 0) {
  bevel = cur.bev ? bevel : 0; const d = Math.max(0.001, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: cur.bev || 1, curveSegments: 4 });
  g.translate(0, 0, -d / 2); g.rotateY(Math.PI / 2); return g; // (shape x, y, depth) -> (depth, y, -shape x): forward ends up as -Z
}
// extrude a plan-view outline (x, z) downwards by `thick`, with its top face at height y
export function extrudeY(shape, thick, y, bevel = 0) {
  bevel = cur.bev ? bevel : 0; const d = Math.max(0.001, thick - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: cur.bev || 1, curveSegments: 4 });
  g.rotateX(Math.PI / 2); g.translate(0, y - bevel, 0); return g; // (x, z, depth) -> (x, -depth, z)
}
export const tube = (a, b, r, rad = 6) => new THREE.TubeGeometry(new THREE.LineCurve3(V3(...a), V3(...b)), 1, r, rad, false);
