// A SlotMesh is ONE instanced mesh (one draw call) that holds the buildings / trees / signs of a whole row of road "chunks".
// It is cut into slots, one slot per chunk. When a chunk scrolls out of sight behind you, its slot is rewritten with the next chunk
// ahead of you. Nothing is created or destroyed while driving: only numbers inside fixed arrays change.
//
// Each slot keeps its instances in its own stage area. flush() then packs all the used instances together at the start of the
// real instance buffer, so the GPU draws only what exists (not the empty room reserved for busy chunks).
import * as THREE from "three";

export class SlotMesh {
  // opt: color (per-instance tint), seed (per-instance random number for the shader), rect (per-instance texture rectangle), shadow
  constructor(parent, geometry, material, slots, cap, opt = {}) {
    this.cap = cap; this.slots = slots; this.used = new Int32Array(slots); this.n = 0; this.base = 0; this.slot = -1; this.dirty = false; this.mask = null;
    const total = slots * cap, geo = opt.seed || opt.rect ? geometry.clone() : geometry;
    this.stage = new Float32Array(total * 16);
    if (opt.color) this.stageC = new Float32Array(total * 3).fill(1);
    if (opt.seed) { this.stageS = new Float32Array(total); geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(total), 1).setUsage(THREE.DynamicDrawUsage)); }
    if (opt.rect) { this.stageR = new Float32Array(total * 4); geo.setAttribute("aRect", new THREE.InstancedBufferAttribute(new Float32Array(total * 4), 4).setUsage(THREE.DynamicDrawUsage)); }
    const mesh = this.mesh = new THREE.InstancedMesh(geo, material, total);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceMatrix.array.fill(0); mesh.count = 0;
    if (opt.color) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.castShadow = !!opt.shadow; mesh.receiveShadow = opt.receive !== false; mesh.visible = false; // (hidden while it has nothing to draw: three.js would still set everything up for it every frame)
    parent.add(mesh);
  }
  begin(slot) { this.slot = slot; this.base = slot * this.cap; this.n = 0; }
  // position x,y,z · size sx,sy,sz · turned ry about the vertical axis · tint r,g,b · shader seed · texture rect [x,y,w,h]
  add(x, y, z, sx, sy, sz, ry = 0, r = 1, g = 1, b = 1, seed = 0, rect = null) {
    if (this.n >= this.cap) return false;
    const i = this.base + this.n++, a = this.stage, o = i * 16, c = Math.cos(ry), s = Math.sin(ry);
    a[o] = c * sx; a[o + 1] = 0; a[o + 2] = -s * sx; a[o + 3] = 0;
    a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = s * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0;
    a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
    if (this.stageC) { this.stageC[i * 3] = r; this.stageC[i * 3 + 1] = g; this.stageC[i * 3 + 2] = b; }
    if (this.stageS) this.stageS[i] = seed;
    if (rect) this.stageR.set(rect, i * 4);
    return true;
  }
  end() { this.used[this.slot] = this.n; this.dirty = true; }
  // hide every instance for which fn(x, z) is true (instance positions as stored: the layer's own coordinates), or null to show them all again
  setMask(fn) { if (fn !== this.mask) this.dirty = true; this.mask = fn; if (fn) this.dirty = true; }
  clear(slot) { if (this.used[slot]) { this.used[slot] = 0; this.dirty = true; } }
  // pack the used instances of every slot together and upload them
  flush() {
    if (!this.dirty) return; this.dirty = false;
    const m = this.mesh, cap = this.cap, dm = m.instanceMatrix.array, dc = m.instanceColor && m.instanceColor.array;
    const ds = this.stageS && m.geometry.attributes.aSeed.array, dr = this.stageR && m.geometry.attributes.aRect.array;
    let o = 0;
    for (let s = 0; s < this.slots; s++) {
      const u = this.used[s]; if (!u) continue; const from = s * cap;
      dm.set(this.stage.subarray(from * 16, (from + u) * 16), o * 16);
      if (this.mask) for (let i = 0; i < u; i++) { const q = (from + i) * 16; if (this.mask(this.stage[q + 12], this.stage[q + 14])) dm.fill(0, (o + i) * 16, (o + i) * 16 + 16); } // (a zeroed matrix draws nothing)
      if (dc) dc.set(this.stageC.subarray(from * 3, (from + u) * 3), o * 3);
      if (ds) ds.set(this.stageS.subarray(from, from + u), o);
      if (dr) dr.set(this.stageR.subarray(from * 4, (from + u) * 4), o * 4);
      o += u;
    }
    m.count = o; m.visible = o > 0; m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, o * 16); m.instanceMatrix.needsUpdate = true;
    if (dc) { m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, o * 3); m.instanceColor.needsUpdate = true; }
    if (ds) { const a = m.geometry.attributes.aSeed; a.clearUpdateRanges(); a.addUpdateRange(0, o); a.needsUpdate = true; }
    if (dr) { const a = m.geometry.attributes.aRect; a.clearUpdateRanges(); a.addUpdateRange(0, o * 4); a.needsUpdate = true; }
  }
}
