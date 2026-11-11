// The street kit: real CC0 models (Poly Haven: a concrete road barrier, a Victorian lamp post, a bin, a fire hydrant, a park bench, a utility box)
// turned into pieces the city builder can stamp out by the hundred, one draw call per material.
//
// The files are glTF with meshopt compression (their numbers are stored as small integers to make them tiny) and WebP textures. Each model is
// read once here: its parts are converted back to plain numbers, merged into one shape per material, stood on the ground and centred, and
// sized in the game's own units (M2U world units per real metre), so an instance with scale 1 is the object's real size next to the cars.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { cloneModel, hasModel } from "../assets.js";
import { SlotMesh } from "./slotmesh.js";

export const M2U = 1.85; // world units in one real metre (a race car, about 2 m wide, is 3.6 units wide)

// a copy of a geometry with plain float position / normal / uv (meshopt files keep them as normalised integers: merging or moving those would lose precision)
function floatGeo(g, matrix) {
  const out = new THREE.BufferGeometry();
  for (const k of ["position", "normal", "uv"]) {
    const a = g.attributes[k]; if (!a) continue; const n = a.itemSize, arr = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { arr[i * n] = a.getX(i); if (n > 1) arr[i * n + 1] = a.getY(i); if (n > 2) arr[i * n + 2] = a.getZ(i); }
    out.setAttribute(k, new THREE.BufferAttribute(arr, n));
  }
  if (g.index) out.setIndex(new THREE.BufferAttribute(Uint32Array.from(g.index.array), 1));
  out.applyMatrix4(matrix);
  return out.index ? out.toNonIndexed() : out;
}

const cache = new Map();
// name (as in assets.js) -> { parts: [{ geometry, material }], size: Vector3 in world units } or null if the model is missing
export function kitModel(name) {
  if (cache.has(name)) return cache.get(name);
  let res = null;
  if (hasModel(name)) {
    const root = cloneModel(name); root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), byMat = new Map();
    root.traverse(o => { if (!o.isMesh) return; const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); const list = byMat.get(o.material) || byMat.set(o.material, []).get(o.material); list.push(floatGeo(o.geometry, m)); });
    const parts = [...byMat].map(([material, geos]) => ({ material, geometry: mergeGeometries(geos) }));
    const box = new THREE.Box3(); for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
    const c = box.getCenter(new THREE.Vector3());
    for (const p of parts) { p.geometry.translate(-c.x, -box.min.y, -c.z).scale(M2U, M2U, M2U); p.geometry.computeBoundingSphere(); }
    for (const p of parts) { const m = p.material; if (m.map) m.map.anisotropy = 4; m.envMapIntensity = 1; }
    res = { parts, size: box.getSize(new THREE.Vector3()).multiplyScalar(M2U) };
  }
  cache.set(name, res); return res;
}

// One SlotMesh per material of a kit model, used together: add() places the whole model.
export class KitMesh {
  constructor(parent, name, slots, cap, opt = {}) {
    const k = kitModel(name); this.ok = !!k; this.size = k ? k.size : new THREE.Vector3(1, 1, 1);
    this.meshes = k ? k.parts.map(p => new SlotMesh(parent, p.geometry, p.material, slots, cap, opt)) : [];
  }
  add(x, y, z, sx, sy, sz, ry = 0, r = 1, g = 1, b = 1) { for (const m of this.meshes) m.add(x, y, z, sx, sy, sz, ry, r, g, b); }
}
