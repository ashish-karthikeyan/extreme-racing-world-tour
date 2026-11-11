// THE BRIEFING'S PLAZA: the square round a city's signature landmark, where the briefing's flyover ends. It replaces the bare ground the city
// leaves there (its street front and blocks are hidden on the plaza: see setShowcase in city.js) with a real place: patterned paving, a
// forecourt, formal gardens with hedges and flower beds, a fountain, trees, lamp posts, benches, parked cars, people, and a row of buildings
// framing it at the far end. Built once per city (when the map picks it), with each kind of thing ONE instanced mesh.
//
// Coordinates: the group's origin is the landmark's centre. u = distance from the middle of the road (the landmark's centre is at u = uc),
// v = along the road, positive towards the camera (down the road, towards the cars). The camera ends at (cam.u, cam.v), cam.y high.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng, hash } from "./rng.js";
import { unitBox, personGeo, headGeo, flowerBedGeo } from "./geo.js";
import { PALETTES } from "./profiles.js";

const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const flat = g => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") o.deleteAttribute(k); return o; };

// the look of each city's plaza (the defaults, then each city's own in its profile's `plaza`)
const STYLE = {
  paving: ["#cfccc4", "#a9a59b", "#b8b2a6"], // base stone, joints, inlay
  pattern: "grid",                          // grid (square slabs) | fan (cobble fans) | herringbone (brick)
  lamp: "classic",                          // classic (a lantern on a post) | modern (a slim pole with a long head)
  lampCol: "#2b2f2c", fountain: true, cars: true, frame: { floors: [4, 6], roof: "mansard", roofCol: "#5f9d86" }, hedge: "#2f5a2c",
};

function canvasTex(px, draw, worldSize) {
  const c = document.createElement("canvas"); c.width = c.height = px; draw(c.getContext("2d"), px);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.userData.size = worldSize; return t;
}
const tone = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return "#" + c.getHexString(); };
// the paving, one repeat = `size` world units
function pavingTex(style, seed) {
  const [base, joint] = style.paving, r = rng(seed);
  if (style.pattern === "fan") return canvasTex(512, (g, W) => { // cobblestone fans, overlapping like scales (each 4 units across)
    g.fillStyle = joint; g.fillRect(0, 0, W, W); const S = W / 3;
    for (let row = -1, y = -S / 2; y < W + S; row++, y += S / 2) for (let x = (row & 1) * S / 2 - S; x < W + S; x += S) {
      g.save(); g.beginPath(); g.arc(x, y + S / 2, S / 2, Math.PI, 0); g.closePath(); g.fillStyle = joint; g.fill(); g.clip();
      for (let k = 1; k <= 7; k++) { const rad = k * S / 14, n = Math.max(3, Math.round(k * 3.1)); for (let i = 0; i < n; i++) { const a = Math.PI + (i + 0.5) / n * Math.PI, sx = x + Math.cos(a) * rad, sy = y + S / 2 + Math.sin(a) * rad; g.fillStyle = tone(base, r.range(0.86, 1.06)); g.save(); g.translate(sx, sy); g.rotate(a); g.fillRect(-S / 32, -S / 34, S / 16, S / 17); g.restore(); } }
      g.restore();
    }
  }, 12);
  if (style.pattern === "herringbone") return canvasTex(512, (g, W) => { // brick in a herringbone
    g.fillStyle = joint; g.fillRect(0, 0, W, W); const b = W / 16;
    for (let y = -W; y < W * 2; y += b) for (let x = -W; x < W * 2; x += b * 2) { g.fillStyle = tone(base, r.range(0.85, 1.08)); const o = (Math.floor(y / b) % 2) * b; g.fillRect(x + o + 1, y + 1, b * 2 - 2, b - 2); }
  }, 8);
  return canvasTex(512, (g, W) => { // square slabs, each a little different
    g.fillStyle = joint; g.fillRect(0, 0, W, W); const s = W / 6;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { g.fillStyle = tone(base, r.range(0.9, 1.05)); g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
  }, 12);
}
// the forecourt round the landmark: a stone "rose" (rings and rays) inside a border, stretched over the forecourt once
function roseTex(style) {
  const [base, joint, inlay] = style.paving;
  return canvasTex(1024, (g, W) => {
    g.fillStyle = base; g.fillRect(0, 0, W, W);
    g.strokeStyle = joint; g.lineWidth = 3; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * W / 16, 0); g.lineTo(i * W / 16, W); g.moveTo(0, i * W / 16); g.lineTo(W, i * W / 16); g.stroke(); }
    g.fillStyle = inlay; g.fillRect(0, 0, W, W * 0.04); g.fillRect(0, W * 0.96, W, W * 0.04); g.fillRect(0, 0, W * 0.04, W); g.fillRect(W * 0.96, 0, W * 0.04, W); // the border
    const c = W / 2;
    for (let k = 5; k >= 1; k--) { g.beginPath(); g.arc(c, c, k * W * 0.085, 0, Math.PI * 2); g.fillStyle = k % 2 ? inlay : base; g.fill(); }
    g.strokeStyle = tone(inlay, 0.8); g.lineWidth = 6; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * W * 0.09, c + Math.sin(a) * W * 0.09); g.lineTo(c + Math.cos(a) * W * 0.42, c + Math.sin(a) * W * 0.42); g.stroke(); }
    g.beginPath(); g.arc(c, c, W * 0.43, 0, Math.PI * 2); g.lineWidth = 10; g.stroke();
  }, 1);
}
const lawnTex = () => canvasTex(128, (g, W) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f2f2f2" : "#ffffff"; g.fillRect(0, i * W / 8, W, W / 8); } for (let i = 0; i < 900; i++) { const v = 215 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); } }, 6); // mown stripes

// small shapes (each 1 instance = one thing, base at y = 0)
const benchGeo = () => mergeGeometries([new THREE.BoxGeometry(2.2, 0.12, 0.6).translate(0, 0.55, 0), new THREE.BoxGeometry(2.2, 0.55, 0.1).translate(0, 0.95, -0.27), new THREE.BoxGeometry(0.1, 0.55, 0.55).translate(-0.95, 0.27, 0), new THREE.BoxGeometry(0.1, 0.55, 0.55).translate(0.95, 0.27, 0)].map(flat));
function lampGeos(kind) {
  if (kind === "modern") return { post: mergeGeometries([new THREE.CylinderGeometry(0.09, 0.13, 6.5, 6).translate(0, 3.25, 0), new THREE.BoxGeometry(1.8, 0.16, 0.34).translate(0.75, 6.5, 0)].map(flat)), glow: new THREE.BoxGeometry(1.4, 0.06, 0.26).translate(0.8, 6.4, 0) };
  return { // a lantern on a fluted post, with a base and a little roof
    post: mergeGeometries([new THREE.CylinderGeometry(0.3, 0.36, 0.7, 8).translate(0, 0.35, 0), new THREE.CylinderGeometry(0.1, 0.15, 3.8, 8).translate(0, 2.6, 0), new THREE.CylinderGeometry(0.2, 0.12, 0.3, 8).translate(0, 4.55, 0), new THREE.CylinderGeometry(0.05, 0.42, 0.42, 4).rotateY(Math.PI / 4).translate(0, 5.82, 0), new THREE.SphereGeometry(0.1, 6, 4).translate(0, 6.1, 0)].map(flat)),
    glow: new THREE.CylinderGeometry(0.3, 0.22, 0.95, 4).rotateY(Math.PI / 4).translate(0, 5.15, 0),
  };
}
const mansardGeo = () => new THREE.CylinderGeometry(0.66, 1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(Math.SQRT2, 1, Math.SQRT2); // a 1x1 footprint, 1 high, sides sloping in
const hipGeo = () => new THREE.CylinderGeometry(0.02, 1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(Math.SQRT2 * 0.55, 1, Math.SQRT2 * 0.55);

// an instanced mesh filled from a list of [x, y, z, sx, sy, sz, ry, r, g, b]
function inst(geo, mat, list, { color = false, seed = false, shadow = true } = {}) {
  if (!list.length) return null;
  const g = seed ? geo.clone() : geo, n = list.length, m = new THREE.InstancedMesh(g, mat, n), o = new THREE.Object3D();
  if (seed) g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(list.map(e => e[10] ?? Math.random())), 1));
  if (color) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  list.forEach((e, i) => { o.position.set(e[0], e[1], e[2]); o.scale.set(e[3], e[4], e[5]); o.rotation.set(0, e[6] || 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (color) m.instanceColor.setXYZ(i, e[7] ?? 1, e[8] ?? 1, e[9] ?? 1); });
  m.castShadow = shadow; m.receiveShadow = true; m.computeBoundingSphere(); return m;
}

// st: the city (ROUTE entry), prof: its profile, geom: { side, r, h, uc, cam: { u, v, y, ly } }, kit: the city's materials and models (city.kit),
// full: the graphics preset's detail (Low leaves out the small things)
export function buildPlaza(st, prof, geom, kit, full) {
  if (!kit) return null;
  const S = { ...STYLE, ...(prof.plaza || {}), frame: { ...STYLE.frame, ...((prof.plaza || {}).frame || {}) } };
  const { side, r, uc, cam } = geom, R = rng(hash(st.n || 1, 7, 4242));
  const hillSide = prof.hill ? (prof.hill === "L" ? -1 : 1) : 0; // (on a hillside the plaza ends where the slope starts: the town rises behind it)
  const uMin = 17.6, uMax = hillSide === side ? Math.min(uc + r + 26, (prof.hillStart ?? 52) - 2) : uc + r + 26, vFar = -(r + 46), vNear = Math.max(r + 60, cam.v + 12), Y = 0.45; // (the plaza reaches under the camera, so nothing of the city stands between it and the landmark) // (the plaza floor stands a kerb's height up, above any quay or water under it)
  const X = u => side * (u - uc), ry0 = side > 0 ? 0 : Math.PI; // (a thing facing +u)
  const group = new THREE.Group(); group.name = "plaza";
  const add = o => { if (o) group.add(o); return o; };
  // is (u, v) between the camera and the landmark, in the cone of the view that the landmark fills? Then only low things may stand there
  const du = uc - cam.u, dv = -cam.v, dl = Math.hypot(du, dv);
  const inView = (u, v, pad = 3) => { const pu = u - cam.u, pv = v - cam.v, along = (pu * du + pv * dv) / dl, perp = Math.abs(pu * dv - pv * du) / dl; return along > 0 && along < dl + r && perp < r * 1.08 * Math.min(1, along / dl) + pad; };

  // ---- the floor: paving everywhere, a stone rose round the landmark, a kerb-high stone edge round it all ----
  const pave = pavingTex(S, hash(st.n || 1, 3, 77)), pw = uMax - uMin, pl = vNear - vFar;
  pave.repeat.set(pw / pave.userData.size, pl / pave.userData.size);
  const stoneCol = new THREE.Color(S.paving[0]), stoneMat = new THREE.MeshStandardMaterial({ color: stoneCol, roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(pw, pl).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pave, roughness: 0.9 }));
  floor.position.set(X((uMin + uMax) / 2), Y, (vFar + vNear) / 2); floor.receiveShadow = true; add(floor);
  const fr = r + 14, ru0 = Math.max(uMin, uc - fr), rw = uc + fr - ru0, rt = roseTex(S); // (cut off where it would reach the road)
  rt.wrapS = rt.wrapT = THREE.ClampToEdgeWrapping; rt.repeat.set(rw / (2 * fr), 1); rt.offset.set(side > 0 ? (ru0 - (uc - fr)) / (2 * fr) : 0, 0); // (the plane's left edge is its lowest u on the right of the road, its highest on the left)
  const rose = new THREE.Mesh(new THREE.PlaneGeometry(rw, fr * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }));
  rose.position.set(X((ru0 + uc + fr) / 2), Y + 0.02, 0); rose.receiveShadow = true; add(rose);
  add(inst(unitBox, stoneMat, [[X(uMin - 0.2), 0, (vFar + vNear) / 2, 0.6, Y + 0.05, pl, 0], [X(uMax), 0, (vFar + vNear) / 2, 0.8, Y + 0.05, pl, 0], [X((uMin + uMax) / 2), 0, vFar, pw, Y + 0.05, 0.8, 0], [X((uMin + uMax) / 2), 0, vNear, pw, Y + 0.05, 0.8, 0]], { shadow: false }));

  // ---- gardens: lawn panels with low hedges either side of a central walk on the landmark's axis, from the forecourt towards the camera ----
  const lawnMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...lin(st.grass || "#5fae4a")).multiplyScalar(0.95), map: lawnTex(), roughness: 1 });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: S.hedge, roughness: 0.95 });
  const lawns = [], hedges = [], beds = [], trees = [], lampsL = [], benches = [], people = [], cars = [];
  const treeKinds = (prof.trees || st.trees || ["round"]).map(t => t === "cypress" ? "pine" : t), tk = () => { const k = R.pick(treeKinds); return kit.treeG[k] ? k : "round"; };
  const v0 = r + 16, walk = 7; // where the gardens start, half the central walk's width
  for (let v = v0; v + 16 < vNear - 4; v += 22) for (const s of [-1, 1]) {
    const u0 = s < 0 ? uMin + 8 : uc + walk, u1 = s < 0 ? uc - walk : uMax - 6; if (u1 - u0 < 8) continue;
    const cu = (u0 + u1) / 2, cv = v + 9, wu = u1 - u0, wv = 18;
    lawns.push([X(cu), Y, cv, wu, 0.22, wv, 0]);
    for (const [hu, hv, hw, hd] of [[cu, cv - wv / 2, wu, 0.7], [cu, cv + wv / 2, wu, 0.7], [u0, cv, 0.7, wv], [u1, cv, 0.7, wv]]) hedges.push([X(hu), Y, hv, side > 0 ? hw : hw, 0.85, hd, 0]);
    if (full) for (let k = 0; k < 2; k++) beds.push([X(cu + (k ? 1 : -1) * wu * 0.22), Y + 0.2, cv, 1, 1, 1, Math.PI / 2]);
    // trees along the walk and the garden's outer edge (never in the view of the landmark)
    for (const tu of [s < 0 ? uc - walk - 2 : uc + walk + 2, s < 0 ? u0 + 2 : u1 - 2]) for (const tv of [v + 2, v + 13]) if (!inView(tu, tv, 4)) trees.push([tk(), X(tu), tv]);
    lampsL.push([X(s < 0 ? uc - walk + 0.6 : uc + walk - 0.6), Y, v + 7.5]);
    if (full) benches.push([X(s < 0 ? uc - walk + 1.6 : uc + walk - 1.6), Y, v + 15, 1, 1, 1, s < 0 ? -Math.PI / 2 * side : Math.PI / 2 * side]);
  }
  // round the forecourt: hedged lawns at its corners, lamps, and trees beside and behind the landmark
  for (const [du2, dv2] of [[-1, -1], [1, -1]]) { const cu = uc + du2 * (r + 8), cv = dv2 * (r + 6); if (cu > uMin + 6 && cu < uMax - 4) { lawns.push([X(cu), Y, cv, 9, 0.22, 9, 0]); } }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, u = uc + Math.cos(a) * (fr - 1.5), v = Math.sin(a) * (fr - 1.5); if (u > uMin + 2 && u < uMax - 2 && v < vNear - 2 && v > vFar + 20) lampsL.push([X(u), Y, v]); }
  for (let i = 0; i < 18; i++) { const a = R.range(0, Math.PI * 2), d = R.range(fr + 3, fr + 16), u = uc + Math.cos(a) * d, v = Math.sin(a) * d * 0.9; if (u > uMin + 6 && u < uMax - 3 && v > vFar + 20 && v < v0 && !inView(u, v, 5)) trees.push([tk(), X(u), v]); }
  // along the road: a low stone balustrade, lamp posts, a row of parked cars, trees between them
  const balus = [];
  for (let v = vFar + 2; v < vNear - 2; v += 4.5) balus.push([X(uMin + 0.3), Y, v + 2.25, 0.5, 0.9, 4.1, 0]);
  for (let v = vFar + 22; v < vNear - 6; v += 16) { lampsL.push([X(uMin + 1.6), Y, v]); if (!inView(26, v + 8, 2)) trees.push([tk(), X(26.5), v + 8]); }
  if (S.cars && full && kit.carG.length) for (let v = vFar + 24; v < vNear - 8; v += R.range(7, 9.5)) if (R.chance(0.72)) cars.push([R.int(0, kit.carG.length - 1), X(21.8), Y, v, R.chance(0.5) ? 0 : Math.PI]);
  // the far end: a row of buildings in the city's colours framing the plaza, their copper mansards over the street
  const pal = PALETTES[prof.arch] || PALETTES.pastel, fb = [], roofs = [], roofCol = lin(S.frame.roofCol);
  for (let u = 30; u < uMax - 4;) {
    const wdt = Math.min(R.range(16, 24), uMax - 4 - u); if (wdt < 8) break; const floors = R.int(S.frame.floors[0], S.frame.floors[1]), hgt = floors * 4.4, dep = 15, c = lin(R.pick(pal));
    const cu = u + wdt / 2, cv = vFar + 2 + dep / 2;
    fb.push([X(cu), Y, cv, wdt, hgt, dep, 0, c[0], c[1], c[2], R()]);
    if (S.frame.roof === "mansard") roofs.push([X(cu), Y + hgt, cv, wdt * 1.0, 4.2, dep * 1.0, 0, roofCol[0], roofCol[1], roofCol[2]]);
    else roofs.push([X(cu), Y + hgt, cv, wdt * 1.15, hgt * 0.22 + 2, dep * 1.15, 0, roofCol[0], roofCol[1], roofCol[2]]);
    u += wdt + R.range(0.4, 1.4);
  }
  // people out walking (on the walks and the forecourt)
  if (full) for (let i = 0; i < 46; i++) { const u = R.chance(0.5) ? uc + R.range(-walk + 1, walk - 1) : uc + R.range(-fr, fr), v = R.range(v0 - fr * 1.6, vNear - 10); if (u < uMin + 3 || u > uMax - 3 || Math.hypot(u - uc, v) < r + 2) continue; const c = lin(R.pick(["#c8372d", "#2d6fb5", "#f2f2ee", "#1f2228", "#e0a526", "#6a7a8a", "#f08ab0"])); people.push([X(u), Y, v, 0.85, 0.85, 0.85, R() * 6, c[0], c[1], c[2]]); }

  // ---- the fountain: a round stone basin with water, a two-tier centrepiece and jets ----
  if (S.fountain) {
    const fv = r + 16 + 2 + 10, fu = uc, fx = X(fu), water = new THREE.MeshStandardMaterial({ color: (prof.water && prof.water.color) || "#3f8fb4", roughness: 0.06, metalness: 0.35 });
    const jet = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.15, emissive: 0x9fd8ff, emissiveIntensity: 0.25 }), fg = new THREE.Group(); fg.position.set(fx, Y, fv);
    const lathe = (pts, mat, seg = 32) => { const o = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), mat); fg.add(o); return o; };
    lathe([[7.2, 0], [7.4, 0.15], [7.4, 0.95], [7.0, 1.05], [6.8, 0.95]], stoneMat); // the rim
    const wd = new THREE.Mesh(new THREE.CircleGeometry(6.85, 40).rotateX(-Math.PI / 2), water); wd.position.y = 0.75; fg.add(wd);
    lathe([[1.5, 0], [1.1, 0.5], [0.8, 2.2], [1.2, 2.5], [3.0, 2.8], [3.2, 3.1], [2.9, 3.25], [0.6, 3.3], [0.45, 4.6], [1.6, 4.9], [1.7, 5.1], [0.2, 5.3], [0.15, 6.2], [0.01, 6.4]], stoneMat, 24); // the centrepiece: a pedestal, a wide bowl, a small bowl, a finial
    if (full) { const jets = []; jets.push(new THREE.CylinderGeometry(0.12, 0.25, 3.2, 8).translate(0, 7.8, 0)); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; jets.push(new THREE.CylinderGeometry(0.06, 0.12, 2.6, 6).translate(0, 1.3, 0).rotateZ(0.5).rotateY(-a).translate(Math.cos(a) * 5.4, 0.8, Math.sin(a) * 5.4)); } fg.add(new THREE.Mesh(mergeGeometries(jets.map(flat)), jet)); }
    add(fg);
  }

  // ---- everything else, instanced ----
  add(inst(unitBox, lawnMat, lawns, { shadow: false })); add(inst(unitBox, hedgeMat, hedges)); add(inst(unitBox, stoneMat, balus));
  if (beds.length) add(inst(flowerBedGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), beds, { shadow: false }));
  const lg = lampGeos(S.lamp), lampMat = new THREE.MeshStandardMaterial({ color: S.lampCol, roughness: 0.5, metalness: 0.5 });
  add(inst(lg.post, lampMat, lampsL.map(([x, y, z]) => [x, y, z, 1, 1, 1, 0]))); add(inst(lg.glow, kit.glowMat, lampsL.map(([x, y, z]) => [x, y, z, 1, 1, 1, 0]), { shadow: false }));
  if (benches.length) add(inst(benchGeo(), new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.8 }), benches));
  if (people.length) { add(inst(personGeo(), kit.sMat, people, { color: true })); add(inst(headGeo(), kit.skinMat, people.map(p => p.slice(0, 7)))); }
  for (let i = 0; i < kit.carG.length; i++) { const l = cars.filter(c => c[0] === i).map(c => [c[1], c[2], c[3], 1, 1, 1, c[4]]); if (l.length) add(inst(kit.carG[i].geometry, kit.carG[i].material, l)); }
  const size = { round: [9, 13], pine: [12, 17], palm: [12, 16], cactus: [3.5, 6] };
  for (const k of new Set(trees.map(t => t[0]))) {
    const tg = kit.treeG[k]; if (!tg) continue; const list = trees.filter(t => t[0] === k).map(([, x, z]) => { const s = R.range(...(size[k] || size.round)); return [x, Y, z, s, s, s, R() * 6.28]; });
    if (!full) list.length = Math.ceil(list.length * 0.6);
    if (tg.trunk) add(inst(tg.trunk, kit.trunkMat, list)); if (tg.leaves) add(inst(tg.leaves, kit.leafMat, list));
  }
  add(inst(unitBox, kit.bMat, fb.map(e => e.slice(0, 10).concat([e[10]])), { color: true, seed: true }));
  add(inst(S.frame.roof === "mansard" ? mansardGeo() : hipGeo(), kit.sMat, roofs, { color: true }));
  return { group, uMax, vNear, vFar };
}
