// Merge a model built from many little meshes (a landmark, a prop, the briefing's plaza) into ONE mesh per material, so a detailed model
// costs a handful of draw calls instead of hundreds. Texture coordinates are kept (parts without them get zeros), everything else dropped.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function mergeStatic(grp, shadow = true) {
  if (grp.userData.spin || grp.userData.ball || grp.userData.keep) return grp; // (moving or see-through parts: kept as they are)
  grp.updateMatrixWorld(true); const by = new Map();
  grp.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return; // (instanced meshes are not merged: keep them out of models passed here)
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld); if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    (by.get(o.material) || by.set(o.material, []).get(o.material)).push(g);
  });
  const out = new THREE.Group();
  for (const [mat, list] of by) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = shadow && !mat.transparent; m.receiveShadow = true; out.add(m); }
  out.userData = { ...grp.userData }; return out;
}
