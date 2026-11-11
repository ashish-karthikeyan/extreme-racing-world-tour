// The bypass: a short side track that appears beside the road, curves out round the vehicle ahead and rejoins the lane further on.
// It is drawn like a real piece of track: asphalt, white edge lines, a dashed centre line and red and white kerbs.
// The simulation decides where it runs (bypassTrack = { side, lane, y0, L, OFF, RAMP }); this only draws it, in the same shape the car follows.
import * as THREE from "three";
import { SCALE, simX, simZ } from "./mapping.js";

function canvasTex(w, h, draw, repeatY) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function createBypass(scene) {
  const asphalt = canvasTex(128, 256, (g, w, h) => { // one repeat = 16 world units of track
    g.fillStyle = "#4a4c52"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 60 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    g.fillStyle = "#e8e8e0"; g.fillRect(8, 0, 6, h); g.fillRect(w - 14, 0, 6, h);            // edge lines
    g.fillStyle = "#e8e8e0"; g.fillRect(w / 2 - 3, 0, 6, h * 0.4); g.fillRect(w / 2 - 3, h * 0.6, 6, h * 0.4); // dashed centre line
  });
  const kerb = canvasTex(32, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#ededed" : "#c9261c"; g.fillRect(0, i * 32, w, 32); } });
  const road = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const kerbM = new THREE.MeshStandardMaterial({ map: kerb, roughness: 0.7 });
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const surface = new THREE.Mesh(new THREE.BufferGeometry(), road), kerbL = new THREE.Mesh(new THREE.BufferGeometry(), kerbM), kerbR = new THREE.Mesh(new THREE.BufferGeometry(), kerbM);
  for (const m of [surface, kerbL, kerbR]) { m.frustumCulled = false; m.receiveShadow = true; group.add(m); }
  const RISE = 0.28; // the track climbs this much as it leaves the road, so it sits above the pavement and quay and the car is lifted onto it (see r.bypassK)
  const side = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.9, side: THREE.DoubleSide }), skirtL = new THREE.Mesh(new THREE.BufferGeometry(), side), skirtR = new THREE.Mesh(new THREE.BufferGeometry(), side);
  for (const m of [skirtL, skirtR]) { m.frustumCulled = false; group.add(m); }
  let current = null, prevY0 = 0, lastY0 = 0;
  const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

  // a strip following the path: from `a` to `b` world units across (relative to the path centre), at height y, with uv.y running along the track
  function strip(t, a, b, y, uvScale) {
    const pos = [], uv = [], idx = [], step = 12, n = Math.ceil(t.L / step);
    for (let i = 0; i <= n; i++) {
      const d = Math.min(t.L, i * step), k = smooth(Math.min(d / t.RAMP, (t.L - d) / t.BACK)), x = simX(laneX(t.lane) + t.side * t.OFF * k), z = -d * SCALE;
      const h = y + RISE * k; pos.push(x + a, h, z, x + b, h, z); uv.push(0, d * SCALE / uvScale, 1, d * SCALE / uvScale);
      if (i < n) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals(); if (g.attributes.normal.array[1] < 0) for (let i = 1; i < g.attributes.normal.array.length; i += 3) g.attributes.normal.array[i] *= -1; // (always face up)
    return g;
  }
  function wall(t, across, top) { // a vertical side wall under the kerb, from the top of the track down below the ground
    const pos = [], idx = [], step = 12, n = Math.ceil(t.L / step);
    for (let i = 0; i <= n; i++) { const d = Math.min(t.L, i * step), k = smooth(Math.min(d / t.RAMP, (t.L - d) / t.BACK)), x = simX(laneX(t.lane) + t.side * t.OFF * k) + across, z = -d * SCALE; pos.push(x, top + RISE * k, z, x, -0.2, z); if (i < n) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function build(t) { // built once per bypass
    const half = 3.4; for (const [m, g] of [[skirtL, wall(t, -half - 0.7, 0.2)], [skirtR, wall(t, half + 0.7, 0.2)]]) { m.geometry.dispose(); m.geometry = g; }
    for (const [m, g] of [[surface, strip(t, -half, half, 0.17, 16)], [kerbL, strip(t, -half - 0.7, -half, 0.2, 4.8)], [kerbR, strip(t, half, half + 0.7, 0.2, 4.8)]]) { m.geometry.dispose(); m.geometry = g; }
    // faces must point up whichever way the strip was wound
    for (const m of [surface, kerbL, kerbR]) { const p = m.geometry.attributes.position, idx = m.geometry.index.array; const ax = p.getX(idx[1]) - p.getX(idx[0]), az = p.getZ(idx[1]) - p.getZ(idx[0]), bx = p.getX(idx[2]) - p.getX(idx[0]), bz = p.getZ(idx[2]) - p.getZ(idx[0]); if (az * bx - ax * bz < 0) { /* clockwise from above: flip */ for (let i = 0; i < idx.length; i += 3) { const s = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = s; } } }
    for (const m of [surface, kerbL, kerbR]) { m.geometry.computeVertexNormals(); }
    for (const m of [surface, kerbL, kerbR]) m.material.side = THREE.DoubleSide;
  }
  return {
    update(track, alpha, time) {
      if (!track) { group.visible = false; current = null; return; }
      if (track !== current) { current = track; build(track); lastY0 = prevY0 = track.y0; }
      if (track.y0 !== lastY0) { prevY0 = lastY0; lastY0 = track.y0; }
      group.visible = true; group.position.z = simZ(prevY0 + (track.y0 - prevY0) * alpha);
    },
  };
}
