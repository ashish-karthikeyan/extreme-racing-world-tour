// Low-poly stylised landmarks, built from simple shapes. They only need to be recognisable silhouettes on the skyline.
// Each builder gets `h` = half the width the landmark may occupy, in world units, and returns a Group standing on the ground at the
// origin. Glowing parts use shared materials (registered in `glows`) so the renderer can light them up at night.
import * as THREE from "three";
import { detailBuilders } from "./landmarks-detail.js";

const cache = new Map();
// every landmark surface is floodlit at night: it glows softly in its own colour, so the landmarks read against the dark sky (see tickLandmarks)
const floods = [];
const m = (hex, o = {}) => { const k = hex + JSON.stringify(o); let v = cache.get(k); if (!v) { cache.set(k, v = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.75, metalness: 0.05, emissive: hex, emissiveIntensity: 0, ...o })); floods.push(v); } return v; };
export const glows = []; // [{ mat, base, nightOnly }]: emissive materials, intensity driven by how dark it is (nightOnly: dark by day)
const glow = (hex, base = 1.5) => { const k = "g" + hex; let v = cache.get(k); if (!v) { cache.set(k, v = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.2, roughness: 0.5 })); glows.push({ mat: v, base }); } return v; };
// a material that looks like `hex` by day and glows `glowHex` only at night (the Flame Towers' LED flames, the Yas hotel's lit canopy)
const nightGlow = (key, hex, glowHex, base, o = {}) => { let v = cache.get(key); if (!v) { cache.set(key, v = new THREE.MeshStandardMaterial({ color: hex, emissive: glowHex, emissiveIntensity: 0, roughness: 0.4, ...o })); glows.push({ mat: v, base, nightOnly: true }); } return v; };

// ---- the Las Vegas Sphere: an LED screen that cycles through shows (a colour swirl, a giant eye, pulsing rings), drawn as a grid of LED dots ----
const sphereU = { uTime: { value: 0 }, uBright: { value: 1.3 } };
let sphereMat = null;
function makeSphereMat() {
  if (sphereMat) return sphereMat;
  sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  sphereMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, sphereU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vLed;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvLed = uv;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      varying vec2 vLed; uniform float uTime, uBright;
      vec3 hsv(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      vec3 show(float m, vec2 c, float t) {
        if (m < 0.5) return hsv(fract(c.x * 2.0 + c.y * 1.3 + t * 0.08)) * (0.7 + 0.3 * sin(c.y * 40.0 - t * 3.0));       // colour swirl
        if (m < 1.5) { // a giant eye (four round the sphere, so one always looks at you)
          vec2 e = vec2((fract(c.x * 4.0) - 0.5) * 2.2, (c.y - 0.52) * 3.2); float r = length(e), look = sin(t * 0.7) * 0.12;
          vec3 col = vec3(0.05, 0.03, 0.03);
          col = mix(col, vec3(0.95, 0.92, 0.9) - vec3(0.0, 0.25, 0.25) * smoothstep(0.55, 0.9, r), step(r, 0.9));          // the white, pinker at the rim
          float ri = length(e - vec2(look, 0.0)); col = mix(col, vec3(0.15, 0.45, 0.95) * (0.6 + 0.4 * smoothstep(0.0, 0.38, ri)), step(ri, 0.38)); // iris
          col = mix(col, vec3(0.0), step(ri, 0.16)); return col;
        }
        float rr = length(vec2(c.x - 0.5, (c.y - 0.5) * 0.5)) * 6.0; return mix(vec3(0.6, 0.1, 1.0), vec3(0.1, 0.9, 1.0), 0.5 + 0.5 * sin(rr * 6.0 - t * 4.0)) * (0.6 + 0.4 * sin(rr * 6.0 - t * 4.0)); // pulsing rings
      }`).replace("#include <map_fragment>", `#include <map_fragment>
      { vec2 g = vLed * vec2(180.0, 90.0), f = fract(g) - 0.5, c = (floor(g) + 0.5) / vec2(180.0, 90.0);
        float dotLit = smoothstep(0.5, 0.25, length(f)), far = clamp(max(fwidth(g.x), fwidth(g.y)) * 1.6 - 0.4, 0.0, 1.0);
        dotLit = mix(dotLit, 0.45, far); // far away the dots blur into their average (no shimmer)
        float t = uTime, m = mod(floor(t / 8.0), 3.0), k = fract(t / 8.0);
        vec3 col = mix(show(m, c, t), show(mod(m + 1.0, 3.0), c, t), smoothstep(0.88, 1.0, k));
        diffuseColor.rgb = col * dotLit * uBright; }`);
  };
  sphereMat.customProgramCacheKey = () => "vegas-sphere";
  return sphereMat;
}
// call every frame: time in seconds, night 0..1
export function tickLandmarks(time, night) {
  sphereU.uTime.value = time; sphereU.uBright.value = 1.4 + 1.0 * night;
  const f = 0.22 * night; for (const v of floods) v.emissiveIntensity = f; // floodlights (a hundred or so materials: cheap)
}

// the Yas hotel's gridshell: a lattice of diamond panels (cut out of a texture), lit in colour at night
let latticeTex = null;
function lattice() {
  if (latticeTex) return latticeTex;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.strokeStyle = "#fff"; g.lineWidth = 16; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.moveTo(128, 0); g.lineTo(0, 128); g.stroke(); // an X per tile: tiled, a diamond lattice
  latticeTex = new THREE.CanvasTexture(c); latticeTex.wrapS = latticeTex.wrapT = THREE.RepeatWrapping; latticeTex.anisotropy = 4; latticeTex.colorSpace = THREE.SRGBColorSpace;
  return latticeTex;
}
// a flame outline (in x/y, base on y = 0), extruded `depth` thick
const flameGeo = (w, H, depth) => G(`flame${w},${H},${depth}`, () => {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0);
  s.bezierCurveTo(w * 0.64, H * 0.45, w * 0.4, H * 0.8, w * 0.04, H); s.bezierCurveTo(-w * 0.28, H * 0.78, -w * 0.58, H * 0.42, -w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.18, bevelSize: w * 0.06, bevelSegments: 3, curveSegments: 14 }); g.translate(0, 0, -depth / 2); return g;
});
// a curved slab: an arc of radius R (centred on the origin, bulging towards -Z), angle A, thickness T, height H
const arcGeo = (R, A, T, H) => G(`arc${R},${A},${T},${H}`, () => {
  const s = new THREE.Shape(), N = 20;
  for (let i = 0; i <= N; i++) { const a = -A / 2 + A * i / N, p = [Math.sin(a) * R, -Math.cos(a) * R]; i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]); }
  for (let i = N; i >= 0; i--) { const a = -A / 2 + A * i / N; s.lineTo(Math.sin(a) * (R - T), -Math.cos(a) * (R - T)); }
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; // (plan in x/z after the turn; height up)
});
// the Copan building's wave: an S-shaped band in plan, extruded upwards; its walls carry horizontal sun-shade bands
let bandTex = null;
const bands = () => { if (bandTex) return bandTex; const c = document.createElement("canvas"); c.width = 4; c.height = 32; const g = c.getContext("2d"); g.fillStyle = "#2c3238"; g.fillRect(0, 0, 4, 32); g.fillStyle = "#eeeae2"; g.fillRect(0, 0, 4, 13); bandTex = new THREE.CanvasTexture(c); bandTex.wrapS = bandTex.wrapT = THREE.RepeatWrapping; bandTex.colorSpace = THREE.SRGBColorSpace; bandTex.repeat.set(0.1, 0.62); return bandTex; }; // (one band per ~1.6 units of height)
const waveGeo = (L, A, T, H) => G(`wave${L},${A},${T},${H}`, () => {
  const pts = [], N = 40, s = new THREE.Shape();
  for (let i = 0; i <= N; i++) { const x = -L / 2 + L * i / N; pts.push([x, A * Math.sin(i / N * Math.PI * 1.6 - 0.3)]); }
  s.moveTo(pts[0][0], pts[0][1] - T / 2); for (const [x, y] of pts) s.lineTo(x, y - T / 2); for (let i = N; i >= 0; i--) s.lineTo(pts[i][0], pts[i][1] + T / 2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; // (extruded along +Z, turned so it grows upwards)
});

const geo = new Map();
const G = (key, make) => { let v = geo.get(key); if (!v) geo.set(key, v = make()); return v; };
// tiny builders: all take (parent, size..., position..., material)
const box = (p, w, h, d, x, y, z, mat) => { const o = new THREE.Mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; };       // y = bottom
const cyl = (p, r0, r1, h, x, y, z, mat, seg = 16) => { const o = new THREE.Mesh(G(`c${r0},${r1},${h},${seg}`, () => new THREE.CylinderGeometry(r1, r0, h, seg)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; }; // r0 = bottom radius
const sph = (p, r, x, y, z, mat, sy = 1, seg = 16) => { const o = new THREE.Mesh(G(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, seg >> 1)), mat); o.position.set(x, y, z); o.scale.y = sy; p.add(o); return o; };
const cone = (p, r, h, x, y, z, mat, seg = 12) => { const o = new THREE.Mesh(G(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; };
const tor = (p, R, r, x, y, z, mat, rx = 0, ry = 0, arc = Math.PI * 2, seg = 28) => { const o = new THREE.Mesh(G(`t${R},${r},${arc},${seg}`, () => new THREE.TorusGeometry(R, r, 8, seg, arc)), mat); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); p.add(o); return o; };
const beam = (p, x0, y0, z0, x1, y1, z1, t, mat) => { // a thin bar between two points
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), d = b.clone().sub(a), len = d.length();
  const o = new THREE.Mesh(G(`bm${t}`, () => new THREE.BoxGeometry(t, 1, t)), mat); o.position.copy(a).addScaledVector(d, 0.5); o.scale.y = len;
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); p.add(o); return o;
};
const window_rows = (p, w, d, y0, y1, step, mat) => { for (let y = y0; y < y1; y += step) { box(p, w + 0.06, 0.18, d + 0.06, 0, y, 0, mat); } }; // bands of lit windows
// a shape turned round the vertical axis: pts = [[radius, y], ...] from the bottom up; seg = 4 gives a square dome (turned so its sides face x and z)
const lathe = (p, pts, x, y, z, mat, seg = 24) => { const o = new THREE.Mesh(G(`la${pts.join("|")},${seg}`, () => { let g = new THREE.LatheGeometry(pts.map(([r, yy]) => new THREE.Vector2(r, yy)), seg); if (seg === 4) { g.rotateY(Math.PI / 4); g = g.toNonIndexed(); g.computeVertexNormals(); } return g; }), mat); o.position.set(x, y, z); p.add(o); return o; }; // (a square dome: flat faces, crisp corners)
// a window with a round head, facing +Z (or turned by ry): w wide, h tall to the top of the arch, a little proud of the wall
const archWin = (p, w, h, x, y, z, mat, ry = 0) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  box(g, w, h - w / 2, 0.2, 0, 0, 0, mat);
  const top = new THREE.Mesh(G(`arch${w}`, () => new THREE.CylinderGeometry(w / 2, w / 2, 0.2, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)), mat); top.position.y = h - w / 2; g.add(top); // (the half-disc that points up)
  return g;
};
// ---- facades: a wall with windows drawn on it, so no landmark is ever a big blank box beside the road ----
// fbox(...) is box(...) with a window pattern in one of five styles. The pattern is measured in the model's own units (one window bay is
// `bay` wide, one floor `floor` high), so a wall twice as big has twice as many windows, never stretched ones. By night the windows glow.
//   gothic   tall narrow pointed windows in pairs between buttresses, a string course under each floor (London, Brussels)
//   classic  punched windows with a pale surround and sill (palaces, capitols, churches)
//   deco     bands of windows with vertical fins between them (Miami)        stone  big ashlar blocks with the odd slit window (fortresses)
//   modern   a glass grid with slim mullions
const FACADE_STYLE = { gothic: [0.9, 1.7], classic: [1.1, 1.6], deco: [0.8, 1.2], stone: [1.6, 1.3], modern: [0.9, 1.1] }; // [bay, floor] in model units
const facadeTex = new Map();
function facadePattern(style) { // [colour map, window mask] for one bay x one floor
  let t = facadeTex.get(style); if (t) return t;
  const draw = mask => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), W = 128, wall = mask ? "#000" : "#e8e4dc", win = mask ? "#fff" : "#1e2630", trim = mask ? "#000" : "#ffffff", dark = mask ? "#000" : "#c9c3b8";
    g.fillStyle = wall; g.fillRect(0, 0, W, W);
    const arch = (x, y, w, h) => { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w * 0.6); g.quadraticCurveTo(x, y, x + w / 2, y - w * 0.15); g.quadraticCurveTo(x + w, y, x + w, y + w * 0.6); g.lineTo(x + w, y + h); g.closePath(); g.fill(); }; // a pointed arch
    if (style === "gothic") { g.fillStyle = dark; g.fillRect(0, 0, 10, W); g.fillRect(W - 10, 0, 10, W); g.fillRect(0, W - 12, W, 6); g.fillStyle = trim; g.fillRect(2, 0, 4, W); g.fillStyle = win; arch(26, 30, 30, 80); arch(72, 30, 30, 80); g.fillStyle = mask ? "#000" : dark; g.fillRect(24, 72, 80, 4); }
    else if (style === "classic") { g.fillStyle = trim; g.fillRect(30, 26, 68, 82); g.fillRect(24, 106, 80, 8); g.fillStyle = win; g.fillRect(38, 34, 52, 68); g.fillStyle = mask ? "#000" : "#5b6670"; g.fillRect(62, 34, 4, 68); g.fillRect(38, 66, 52, 3); }
    else if (style === "deco") { g.fillStyle = win; g.fillRect(0, 34, W, 54); g.fillStyle = mask ? "#000" : "#f6f2ea"; g.fillRect(58, 0, 12, W); g.fillRect(0, 96, W, 6); }
    else if (style === "stone") { g.fillStyle = dark; for (let y = 0; y < W; y += 32) { g.fillRect(0, y, W, 3); for (let x = (y / 32) % 2 * 32; x < W; x += 64) g.fillRect(x, y, 3, 32); } g.fillStyle = win; g.fillRect(58, 46, 10, 40); }
    else { g.fillStyle = win; g.fillRect(0, 0, W, W); g.fillStyle = mask ? "#000" : "#c8ccd2"; g.fillRect(0, 0, 6, W); g.fillRect(0, 0, W, 8); g.fillRect(62, 0, 3, W); }
    const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 4; if (!mask) tx.colorSpace = THREE.SRGBColorSpace; return tx; };
  facadeTex.set(style, t = [draw(false), draw(true)]); return t;
}
// a box whose UVs are in bays and floors (the windows keep their size on any wall); the roof and the floor get plain wall
const facadeGeo = (w, h, d, style) => G(`fb${w},${h},${d},${style}`, () => {
  const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, [bay, floor] = FACADE_STYLE[style];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + w / 2, y = p.getY(i) + h / 2, z = p.getZ(i) + d / 2;
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, 0.02, 0.02); else uv.setXY(i, (Math.abs(n.getX(i)) > 0.5 ? z : x) / bay, y / floor);
  }
  return g;
});
const facadeMat = (hex, style) => { const k = `fm${hex},${style}`; let v = cache.get(k); if (!v) { const [map, mask] = facadePattern(style); cache.set(k, v = new THREE.MeshStandardMaterial({ color: hex, map, roughness: 0.8, emissive: 0xffc27a, emissiveMap: mask, emissiveIntensity: 0 })); glows.push({ mat: v, base: 1.1, nightOnly: true }); } return v; };
const fbox = (p, w, h, d, x, y, z, hex, style = "classic") => { const o = new THREE.Mesh(facadeGeo(w, h, d, style), facadeMat(hex, style)); o.position.set(x, y + h / 2, z); p.add(o); return o; }; // y = bottom, like box()
// Low keeps every landmark's shape but leaves out the small parts (columns, balusters, mouldings): see setLandmarkDetail
let FULL = true;
export const setLandmarkDetail = full => { FULL = !!full; };

const WHITE = m(0xf1f1ec), STONE = m(0xcdbfa6), DARK = m(0x2a2d34, { metalness: 0.4 }), STEEL = m(0x8a929c, { metalness: 0.6, roughness: 0.4 }), GLASS = m(0x5d86b8, { metalness: 0.6, roughness: 0.2 });
const WIN = glow(0xffd98a, 1.2), NEON_C = glow(0x27e6ff, 2.2), NEON_P = glow(0xff3ec8, 2.2), NEON_Y = glow(0xffe14a, 1.8), NEON_R = glow(0xff3a3a, 2);

const B = {
  opera: (h) => { const g = new THREE.Group(); fbox(g, h * 1.9, 1.2, h * 1.2, 0, 0, 0, 0xcdbfa6, "stone"); for (let i = 0; i < 4; i++) { const s = 1 - i * 0.16; const c = cone(g, h * 0.3 * s, h * 1.1 * s, -h * 0.55 + i * h * 0.34, 1.2, 0, WHITE, 3); c.rotation.z = 0.2; c.scale.z = 1.6; } for (let i = 0; i < 3; i++) { const c = cone(g, h * 0.22, h * 0.8, h * 0.1 + i * h * 0.3, 1.2, h * 0.22, WHITE, 3); c.rotation.z = -0.25; } return g; },
  bridge: (h) => { const g = new THREE.Group(); box(g, h * 2, 0.5, 2.4, 0, h * 0.28, 0, DARK); tor(g, h * 0.95, 0.35, 0, h * 0.28, 0, STEEL, 0, 0, Math.PI, 40); for (let i = -4; i <= 4; i++) { const y = Math.sqrt(Math.max(0, 1 - (i / 4.4) ** 2)) * h * 0.95; beam(g, i * h * 0.21, h * 0.3, 0, i * h * 0.21, h * 0.28 + y, 0, 0.1, STEEL); } for (const s of [-1, 1]) box(g, 1.6, h * 0.5, 1.6, s * h * 0.97, 0, 0, STONE); g.rotation.y = Math.PI / 2; return g; },
  pearl: (h) => { const g = new THREE.Group(), P = m(0xd94a8a, { metalness: 0.5, roughness: 0.3 }); for (let i = 0; i < 3; i++) { const a = i * 2.094; beam(g, Math.cos(a) * h * 0.55, 0, Math.sin(a) * h * 0.55, 0, h * 1.2, 0, 0.5, STEEL); } sph(g, h * 0.62, 0, h * 1.2, 0, P); cyl(g, 0.5, 0.5, h * 1.4, 0, h * 1.4, 0, STEEL); sph(g, h * 0.38, 0, h * 2.8, 0, P); cone(g, 0.3, h * 1.8, 0, h * 3.1, 0, STEEL, 6); return g; },
  shtower: (h) => { // Shanghai Tower: the tallest on the skyline, a glass spiral narrowing and twisting as it rises, with a sloping crown
    const g = new THREE.Group(), Gs = m(0x7f9fbf, { metalness: 0.7, roughness: 0.18 }), N = 16, SH = 2.9;
    for (let i = 0; i < N; i++) { const r0 = h * (0.62 - i * 0.022), r1 = h * (0.62 - (i + 1) * 0.022), c = cyl(g, r0, r1, SH, 0, i * SH, 0, Gs, 9); c.rotation.y = i * 0.17; c.scale.z = 0.86; if (i % 2 === 0) { const b = cyl(g, r1 * 1.02, r1 * 1.02, 0.25, 0, (i + 1) * SH - 0.1, 0, WIN, 9); b.rotation.y = i * 0.17; b.scale.z = 0.86; } }
    const top = cyl(g, h * 0.27, h * 0.25, 2.8, 0, N * SH, 0, Gs, 9); top.rotation.y = N * 0.17; const cap = box(g, h * 0.55, 0.5, h * 0.5, 0, N * SH + 2.6, 0, STEEL); cap.rotation.z = 0.25; return g;
  },
  jinmao: (h) => { // Jin Mao Tower: a stepped, pagoda-like tower in silver-grey with a spire
    const g = new THREE.Group(), S = m(0x9aa3ad, { metalness: 0.6, roughness: 0.3 }); let y = 0;
    for (let i = 0; i < 9; i++) { const w = h * (0.7 - i * 0.055), hh = 4.2 - i * 0.25; box(g, w, hh, w, 0, y, 0, S); box(g, w * 1.12, 0.35, w * 1.12, 0, y + hh - 0.35, 0, i % 2 ? WIN : STEEL); y += hh; }
    cone(g, h * 0.18, 4, 0, y, 0, S, 8); cyl(g, 0.15, 0.08, 5, 0, y + 4, 0, STEEL, 6); return g;
  },
  tokyotower: (h) => { // Tokyo Tower: an orange-and-white lattice tower, splayed legs, two observation decks
    const g = new THREE.Group(), R = m(0xe8492e, { roughness: 0.5 }), Wt = m(0xf3f2ee, { roughness: 0.5 }), H = 31, N = 8;
    const legAt = t => h * 0.95 * Math.pow(1 - t, 1.8) + h * 0.07; // half the leg spread at height fraction t (wide at the foot)
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, mat = i % 2 ? Wt : R, y0 = t0 * H, y1 = t1 * H, a = legAt(t0), b = legAt(t1);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beam(g, sx * a, y0, sz * a, sx * b, y1, sz * b, 0.55, mat);
      for (const s of [-1, 1]) { beam(g, -a, y0, s * a, b, y1, s * b, 0.16, mat); beam(g, a, y0, s * a, -b, y1, s * b, 0.16, mat); beam(g, s * a, y0, -a, s * b, y1, b, 0.16, mat); beam(g, s * a, y0, a, s * b, y1, -b, 0.16, mat); } // X bracing on every face
    }
    const d1 = legAt(0.34), d2 = legAt(0.7);
    box(g, d1 * 2.5, 2.4, d1 * 2.5, 0, H * 0.34, 0, Wt); box(g, d1 * 2.52, 0.6, d1 * 2.52, 0, H * 0.34 + 0.9, 0, WIN);
    box(g, d2 * 2.8, 1.4, d2 * 2.8, 0, H * 0.7, 0, Wt); box(g, d2 * 2.82, 0.4, d2 * 2.82, 0, H * 0.7 + 0.5, 0, WIN);
    for (let i = 0; i < 4; i++) cyl(g, 0.32 - i * 0.06, 0.26 - i * 0.06, 2.4, 0, H + i * 2.4, 0, i % 2 ? Wt : R, 6); // the antenna
    return g;
  },
  pagoda: (h) => { const g = new THREE.Group(), R = m(0xb3392f), W = m(0xe8d3a8); box(g, h * 0.9, 1.2, h * 0.9, 0, 0, 0, STONE); for (let i = 0; i < 5; i++) { const s = 1 - i * 0.15; box(g, h * 0.7 * s, 1.6, h * 0.7 * s, 0, 1.2 + i * 3, 0, W); const c = cone(g, h * 1.15 * s, 1.3, 0, 2.8 + i * 3, 0, R, 4); c.rotation.y = Math.PI / 4; } cyl(g, 0.15, 0.15, 3, 0, 16, 0, STEEL, 6); return g; },
  ferriswheel: (h) => { const g = new THREE.Group(), R = h * 0.95; tor(g, R, 0.25, 0, R + 1, 0, WHITE); tor(g, R * 0.5, 0.1, 0, R + 1, 0, WHITE); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; beam(g, 0, R + 1, 0, Math.cos(a) * R, R + 1 + Math.sin(a) * R, 0, 0.08, WHITE); box(g, 0.9, 0.9, 1.2, Math.cos(a) * R, R + 0.2 + Math.sin(a) * R, 0, i % 2 ? NEON_P : NEON_C); } beam(g, -R * 0.4, 0, 0, 0, R + 1, 0, 0.3, STEEL); beam(g, R * 0.4, 0, 0, 0, R + 1, 0, 0.3, STEEL); return g; },
  artdeco: (h) => { const g = new THREE.Group(), P = m(0xf5b9d4), T = m(0x7fe0d4); fbox(g, h * 1.5, 6, h * 0.9, 0, 0, 0, 0xf5b9d4, "deco"); fbox(g, h * 1.1, 4, h * 0.7, 0, 6, 0, 0x7fe0d4, "deco"); fbox(g, h * 0.6, 3, h * 0.5, 0, 10, 0, 0xf5b9d4, "deco"); box(g, h * 1.52, 0.3, h * 0.92, 0, 6, 0, NEON_P); box(g, h * 1.12, 0.3, h * 0.72, 0, 10, 0, NEON_C); cone(g, 0.3, 3, 0, 13, 0, NEON_Y, 6); return g; },
  freedomtower: (h) => { const g = new THREE.Group(), B2 = m(0xd9c3a0); box(g, h * 0.9, 12, h * 0.9, 0, 0, 0, B2); box(g, h * 0.7, 5, h * 0.7, 0, 12, 0, B2); box(g, h * 0.5, 4, h * 0.5, 0, 17, 0, B2); cone(g, h * 0.45, 3, 0, 21, 0, m(0xc9a46a), 4).rotation.y = Math.PI / 4; window_rows(g, h * 0.9, h * 0.9, 2, 12, 2.2, WIN); return g; },
  biosphere: (h) => { const g = new THREE.Group(), s = h * 0.9, mesh = new THREE.Mesh(G("ico", () => new THREE.IcosahedronGeometry(1, 1)), m(0xe6eef5, { metalness: 0.4, roughness: 0.3, flatShading: true })); mesh.scale.setScalar(s); mesh.position.y = s; g.add(mesh); const rg = new THREE.Mesh(G("ico2", () => new THREE.IcosahedronGeometry(1.02, 1)), new THREE.MeshBasicMaterial({ color: 0x35424f, wireframe: true })); rg.scale.setScalar(s); rg.position.y = s; g.add(rg); return g; },
  olympictower: (h) => { const g = new THREE.Group(); const t = box(g, 2.6, 22, 2.6, 0, 0, 0, STONE); t.rotation.z = 0.1; const t2 = box(g, 2, 8, 2, h * 0.1 + 1.2, 20, 0, STONE); t2.rotation.z = 0.28; for (let i = 0; i < 4; i++) beam(g, h * 0.1 + 2.5, 26, 0, h * 0.9, 1 + i * 0.4, 0, 0.06, STEEL); return g; },
  casino: (h) => { // the Casino of Monte Carlo: a cream Beaux-Arts palace, two corner towers with square copper domes, a taller entrance pavilion with a
    // round window under a curved pediment, an arcade of arched windows, paired columns, a balustrade with urns and a green copper mansard roof.
    // Built 44 wide (front facing +Z), then scaled to 2.2 x h.
    const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
    const CR = m(0xeee2c4, { roughness: 0.7 }), OC = m(0xd6bf8e, { roughness: 0.7 }), PL = m(0xc8b98f, { roughness: 0.85 }), CU = m(0x5f9d86, { roughness: 0.55, metalness: 0.25 });
    const GD = m(0xd7b04a, { metalness: 0.8, roughness: 0.3 }), GL = nightGlow("casinoWin", 0x2b3742, 0xffbf6a, 1.5, { roughness: 0.15, metalness: 0.5 }), CAN = m(0xa9c0cc, { metalness: 0.6, roughness: 0.15 });
    const FZ = 7; // the front face
    box(w, 45, 0.8, 15, 0, 0, 0, PL);                                   // plinth
    box(w, 44, 12.2, 14, 0, 0.8, 0, CR);                                // the main block, up to the cornice
    if (FULL) for (let y = 1.4; y < 6; y += 0.62) box(w, 44.12, 0.07, 14.12, 0, y, 0, OC); // rusticated ground floor (grooves)
    box(w, 44.5, 0.5, 14.5, 0, 6, 0, OC);                               // the band between the floors
    box(w, 44.6, 1.1, 14.6, 0, 11.6, 0, OC); box(w, 45.4, 0.4, 15.4, 0, 12.7, 0, CR); // entablature and cornice
    // the front: arcade below, tall windows above, paired columns between; the sides the same, fewer bays
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const x = s * (6.8 + i * 2.05);
      archWin(w, 1.35, 3.9, x, 1.3, FZ + 0.02, GL); if (FULL) archWin(w, 1.75, 4.15, x, 1.2, FZ - 0.05, OC); // (a stone surround behind the glass)
      box(w, 1.15, 2.7, 0.2, x, 7.3, FZ + 0.02, GL); box(w, 1.6, 0.28, 0.5, x, 10.2, FZ + 0.1, OC); if (FULL) box(w, 1.45, 0.22, 0.35, x, 7.05, FZ + 0.1, OC); // window, its hood, its sill
      if (FULL && i < 3) for (const dx of [-0.32, 0.32]) { const cx = x + s * 1.02 + dx; cyl(w, 0.21, 0.19, 5.0, cx, 6.5, FZ + 0.3, CR, 10); box(w, 0.55, 0.3, 0.55, cx, 11.25, FZ + 0.3, OC); box(w, 0.5, 0.25, 0.5, cx, 6.5, FZ + 0.3, OC); }
    }
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -4.8 + i * 2.6; archWin(w, 1.3, 3.8, s * 22.02, 1.3, z, GL, s * Math.PI / 2); box(w, 0.2, 2.6, 1.1, s * 22.02, 7.3, z, GL); } // the sides
    for (let i = 0; i < 9; i++) archWin(w, 1.3, 3.8, -16 + i * 4, 1.3, -7.02, GL, Math.PI); // the back
    // the balustrade along the roof edge, with urns
    if (FULL) {
      for (const s of [-1, 1]) for (let x = 5.6; x < 13; x += 0.42) cyl(w, 0.11, 0.08, 0.75, s * x, 13.1, FZ - 0.1, CR, 6);
      for (const s of [-1, 1]) { box(w, 7.6, 0.22, 0.45, s * 9.3, 13.85, FZ - 0.1, CR); for (const x of [5.8, 9.3, 12.8]) { box(w, 0.5, 1.0, 0.5, s * x, 13.1, FZ - 0.1, CR); lathe(w, [[0.01, 0], [0.22, 0.05], [0.3, 0.28], [0.18, 0.55], [0.24, 0.7], [0.01, 0.75]], s * x, 14.1, FZ - 0.1, OC, 10); } }
    }
    // the green copper mansard over the main block, with round dormer windows
    const mans = new THREE.Mesh(G("casMans", () => new THREE.CylinderGeometry(0.62, 1, 1, 4, 1).rotateY(Math.PI / 4)), CU); mans.scale.set(44 / Math.SQRT2 * 1.02, 4, 13.6 / Math.SQRT2 * 1.02); mans.position.set(0, 15.1, -0.2); w.add(mans);
    if (FULL) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const x = s * (7 + i * 2.6); cyl(w, 0.55, 0.55, 0.5, x, 14.2, 5.4, CU, 12).rotation.x = Math.PI / 2; const o = cyl(w, 0.42, 0.42, 0.52, x, 14.2, 5.45, GL, 12); o.rotation.x = Math.PI / 2; }
    // the entrance pavilion: projecting, taller, a great arched doorway, a round window under a curved pediment, a lantern on top
    box(w, 10.4, 16.2, 2.4, 0, 0.8, FZ, CR); box(w, 10.9, 0.5, 2.9, 0, 6, FZ, OC); box(w, 11.1, 0.5, 3.1, 0, 16.7, FZ - 0.1, OC);
    archWin(w, 3.4, 5.6, 0, 0.8, FZ + 1.22, GL); if (FULL) archWin(w, 4.2, 6.0, 0, 0.8, FZ + 1.17, GD);
    archWin(w, 2.6, 4.4, 0, 7.0, FZ + 1.22, GL); if (FULL) archWin(w, 3.2, 4.8, 0, 6.8, FZ + 1.17, OC);
    if (FULL) for (const s of [-1, 1]) for (const dx of [2.9, 3.7]) { cyl(w, 0.3, 0.27, 5.1, s * dx, 0.9, FZ + 1.45, CR, 10); cyl(w, 0.26, 0.24, 4.8, s * dx, 6.5, FZ + 1.45, CR, 10); box(w, 0.75, 0.35, 0.75, s * dx, 11.3, FZ + 1.45, OC); }
    const clock = new THREE.Mesh(G("casClk", () => new THREE.CircleGeometry(1.25, 28)), glow(0xfff1c8, 1.2)); clock.position.set(0, 13.6, FZ + 1.24); w.add(clock); tor(w, 1.35, 0.18, 0, 13.6, FZ + 1.25, GD);
    tor(w, 4.6, 0.38, 0, 13.0, FZ + 1.05, OC, 0, 0, Math.PI, 30); // the curved pediment
    if (FULL) { for (const s of [-1, 1]) { const f = cyl(w, 0.32, 0.3, 1.4, s * 3.3, 17.2, FZ + 0.6, CR, 8); sph(w, 0.32, s * 3.3, 18.9, FZ + 0.6, CR, 1, 8); } lathe(w, [[0.01, 0], [0.7, 0.1], [0.5, 1.2], [0.25, 2.2], [0.01, 2.4]], 0, 17.2, FZ + 0.6, GD, 10); } // statues and a crown on the pediment
    lathe(w, [[5.6, 0], [5.4, 0.8], [4.2, 2.4], [2.2, 3.8], [0.4, 4.4]], 0, 17.2, FZ - 1.6, CU, 4); // the pavilion's dome
    box(w, 1.4, 1.6, 1.4, 0, 21.4, FZ - 1.6, CR); lathe(w, [[1.1, 0], [0.9, 0.7], [0.3, 1.4], [0.05, 1.6]], 0, 23, FZ - 1.6, CU, 4); cyl(w, 0.06, 0.04, 1.6, 0, 24.5, FZ - 1.6, GD, 5); sph(w, 0.22, 0, 26.1, FZ - 1.6, GD, 1, 8);
    // the glass marquee over the entrance, on slim posts
    box(w, 8.6, 0.28, 3.4, 0, 4.7, FZ + 2.9, CAN); box(w, 8.8, 0.18, 3.6, 0, 4.98, FZ + 2.9, GD); if (FULL) for (const s of [-1, 1]) cyl(w, 0.1, 0.1, 4.7, s * 4.1, 0, FZ + 4.4, GD, 6);
    // the two corner towers: stone shaft, an open loggia with columns, a square copper dome, a lantern and a gilded finial
    for (const s of [-1, 1]) {
      const tx = s * 17.4, tz = 2.6;
      box(w, 9, 18.8, 9, tx, 0.8, tz, CR); if (FULL) for (const [qx, qz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) box(w, 0.7, 18.8, 0.7, tx + qx * 4.3, 0.8, tz + qz * 4.3, OC); // quoins on the corners
      box(w, 9.6, 0.6, 9.6, tx, 6, tz, OC); box(w, 9.8, 0.7, 9.8, tx, 13.2, tz, OC);
      for (const [dx, dz, ry] of [[0, 4.52, 0], [4.52, 0, Math.PI / 2], [-4.52, 0, -Math.PI / 2], [0, -4.52, Math.PI]]) { archWin(w, 1.5, 4.0, tx + dx, 1.4, tz + dz, GL, ry); archWin(w, 1.35, 3.6, tx + dx, 7.4, tz + dz, GL, ry); const o = box(w, 1.2, 1.7, 0.2, tx + dx * 1.0, 14.4, tz + dz, GL); o.rotation.y = ry; }
      box(w, 7.4, 5.0, 7.4, tx, 19.6, tz, m(0x3a3a3c, { roughness: 0.9 })); // the loggia's shaded inside
      for (const [qx, qz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) box(w, 1.6, 5.0, 1.6, tx + qx * 3.7, 19.6, tz + qz * 3.7, CR); // its corner piers
      if (FULL) for (const [ax, az] of [[1, 0], [0, 1]]) for (const k of [-1.2, 1.2]) for (const sg of [-1, 1]) cyl(w, 0.22, 0.2, 5.0, tx + (ax ? k : sg * 3.75), 19.6, tz + (az ? k : sg * 3.75), CR, 8); // paired columns in each opening
      box(w, 9.4, 0.9, 9.4, tx, 24.6, tz, OC); box(w, 9.9, 0.3, 9.9, tx, 25.5, tz, CR);
      lathe(w, [[6.6, 0], [6.5, 0.6], [5.6, 2.0], [3.8, 3.6], [1.9, 4.8], [0.9, 5.3]], tx, 25.8, tz, CU, 4); // the square bell dome
      if (FULL) for (const [qx, qz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { box(w, 0.6, 0.7, 0.6, tx + qx * 4.4, 25.8, tz + qz * 4.4, CR); lathe(w, [[0.01, 0], [0.25, 0.06], [0.33, 0.3], [0.2, 0.6], [0.26, 0.75], [0.01, 0.8]], tx + qx * 4.4, 26.5, tz + qz * 4.4, OC, 8); }
      box(w, 1.6, 1.5, 1.6, tx, 30.9, tz, CR); lathe(w, [[1.3, 0], [1.1, 0.6], [0.4, 1.4], [0.05, 1.6]], tx, 32.4, tz, CU, 4); cyl(w, 0.07, 0.04, 2.2, tx, 33.8, tz, GD, 5); sph(w, 0.28, tx, 35.7, tz, GD, 1, 10);
    }
    // the great copper roof of the gaming rooms behind, with a lantern
    lathe(w, [[10.5, 0], [10.2, 1.2], [8.4, 3.6], [5.4, 6], [2.4, 7.2], [1.2, 7.5]], 0, 13.1, -2.6, CU, 4); box(w, 2.6, 2.2, 2.6, 0, 20.4, -2.6, CR); lathe(w, [[2.0, 0], [1.6, 1], [0.5, 2], [0.05, 2.3]], 0, 22.6, -2.6, CU, 4); sph(w, 0.3, 0, 25.1, -2.6, GD, 1, 8);
    w.scale.setScalar(h * 2.2 / 44);
    return g;
  },
  palace: (h) => { // the Prince's Palace (Monaco): a long ochre facade with crenellations, rows of shuttered windows, an arched gateway with a
    // pediment, a square crenellated tower with a flag in red and white. Built 40 wide (front facing +Z), then scaled to 2.1 x h.
    const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
    const OC = m(0xe6cf9f, { roughness: 0.75 }), CR = m(0xf2e6cc, { roughness: 0.7 }), SH = m(0x5f8a5a, { roughness: 0.8 }), GL = nightGlow("palaceWin", 0x2f3438, 0xffc070, 1.2), RD = m(0xc8102e), WT = m(0xf4f4f2), RF = m(0xb76040, { roughness: 0.8 });
    box(w, 40, 9.5, 12, 0, 0, 0, OC); box(w, 40.6, 0.5, 12.6, 0, 9.5, 0, CR); box(w, 40.6, 0.7, 12.6, 0, 0, 0, CR);   // the main block, cornice, base
    for (let x = -19.5; x <= 19.5; x += 1.5) box(w, 0.8, 0.9, 12.4, x, 10, 0, OC);                                      // crenellations
    for (const y of [1.6, 5.6]) for (let i = 0; i < 11; i++) { const x = -16.5 + i * 3.3; if (Math.abs(x) < 3) continue; box(w, 1.2, 2.2, 0.2, x, y, 6.02, GL); if (FULL) for (const s of [-1, 1]) box(w, 0.55, 2.2, 0.15, x + s * 0.9, y, 6.08, SH); box(w, 1.5, 0.25, 0.4, x, y + 2.3, 6.1, CR); } // shuttered windows
    archWin(w, 3.2, 5.6, 0, 0.7, 6.05, m(0x3a2c24)); box(w, 6.4, 7.2, 0.6, 0, 0.7, 6.0, CR); archWin(w, 3.2, 5.6, 0, 0.7, 6.35, m(0x3a2c24)); // the gateway in its stone frame
    const ped = new THREE.Mesh(G("palPed", () => { const s = new THREE.Shape(); s.moveTo(-4.2, 0); s.lineTo(4.2, 0); s.lineTo(0, 1.7); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false }); }), CR); ped.position.set(0, 7.9, 5.9); w.add(ped); // a triangular pediment over it
    const tx = -15, tz = -1; box(w, 7, 17, 7, tx, 0, tz, OC); box(w, 7.6, 0.5, 7.6, tx, 17, tz, CR); for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) box(w, 1.2, 1.1, 1.2, tx + cx * 3.2, 17.5, tz + cz * 3.2, OC); // the tower and its crenellations
    for (const y of [3, 8, 13]) archWin(w, 1.2, 2.6, tx, y, tz + 3.52, GL);
    cyl(w, 0.08, 0.06, 6, tx, 18.6, tz, m(0xdddddd), 5); box(w, 3, 1, 0.08, tx + 1.55, 23.6, tz, RD); box(w, 3, 1, 0.08, tx + 1.55, 22.6, tz, WT); // the flag: red over white
    box(w, 14, 0.6, 10, 12, 10.6, -1, RF); // a terracotta roof behind the crenellations on the east wing
    w.scale.setScalar(h * 2.1 / 40);
    return g;
  },
  sagrada: (h) => { const g = new THREE.Group(), S = m(0xd7c4a0); fbox(g, h * 1.6, 7, h * 0.9, 0, 0, 0, 0xd7c4a0, "gothic"); for (let i = 0; i < 4; i++) { cone(g, 1.0, 17 + (i % 2) * 5, -h * 0.65 + i * h * 0.43, 7, 0.1, S, 6); cyl(g, 1.0, 0.8, 7, -h * 0.65 + i * h * 0.43, 7, 0.1, S, 6); } cone(g, 1.4, 24, 0, 8, -h * 0.1, S, 6); box(g, 0.3, 3, 0.3, 0, 31, -h * 0.1, 0, WHITE); return g; },
  torreglories: (h) => { const g = new THREE.Group(), R = m(0xd24b4b, { metalness: 0.4 }); cyl(g, h * 0.55, h * 0.55, 15, 0, 0, 0, R, 20); sph(g, h * 0.55, 0, 15, 0, R, 1.8, 20); window_rows(g, h * 1.0, h * 1.0, 1, 14, 1.6, NEON_C); return g; },
  church: (h) => { const g = new THREE.Group(), W = m(0xf2ede2), R = m(0xb04030); fbox(g, h * 0.8, 5, h * 1.4, 0, 0, 0, 0xf2ede2, "classic"); cone(g, h * 0.65, 3, 0, 5, 0, R, 4).rotation.y = Math.PI / 4; fbox(g, 2, 12, 2, 0, 0, h * 0.5, 0xf2ede2, "classic"); cone(g, 1.5, 4, 0, 12, h * 0.5, m(0x3f8a6a), 8); return g; },
  fortress: (h) => { const g = new THREE.Group(), S = m(0xb9ab94), hill = sph(g, h * 1.2, 0, -h * 0.7, 0, m(0x5f8a4f, { roughness: 1 }), 0.8); fbox(g, h * 1.5, 4, h * 0.8, 0, h * 0.22, 0, 0xb9ab94, "stone"); for (let i = 0; i < 4; i++) { cyl(g, 1.6, 1.6, 7, (i % 2 ? 1 : -1) * h * 0.7, h * 0.22, (i < 2 ? 1 : -1) * h * 0.35, S, 10); cone(g, 2, 2.4, (i % 2 ? 1 : -1) * h * 0.7, h * 0.22 + 7, (i < 2 ? 1 : -1) * h * 0.35, m(0x8a3a30), 10); } return g; },
  bigben: (h) => { // the Elizabeth Tower (Big Ben) and the Palace of Westminster: a slender Gothic tower in golden stone with corner buttresses, four
    // clock faces in gilded surrounds, an arched belfry, a steep slate spire with corner pinnacles and a gilded finial; beside it the long
    // Gothic river front with a slate roof, a row of pinnacles, the central spire and the Victoria Tower. Built at h = 9 (the tower 4.6 wide).
    const g = new THREE.Group(), SC = h / 9, w = new THREE.Group(); g.add(w);
    const ST = 0xd2b27c, PL = m(0xe2c995, { roughness: 0.75 }), SL = m(0x47545c, { roughness: 0.6, metalness: 0.2 }), GD = m(0xd7b04a, { metalness: 0.8, roughness: 0.3 });
    const DIAL = glow(0xfff4d6, 0.9), INK = m(0x1a1a1a);
    // the tower: shaft, buttresses on the corners, the clock stage, the belfry, the spire
    fbox(w, 4.6, 19, 4.6, 0, 0, 0, ST, "gothic"); for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(w, 0.55, 19.4, 0.55, cx * 2.3, 0, cz * 2.3, PL);
    box(w, 5.3, 0.5, 5.3, 0, 19, 0, PL); fbox(w, 5.2, 5.2, 5.2, 0, 19.5, 0, ST, "gothic"); box(w, 5.5, 0.45, 5.5, 0, 24.7, 0, PL);
    for (const [dx, dz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]]) { // a clock on each face
      const f = new THREE.Group(); f.position.set(dx * 2.62, 22.1, dz * 2.62); f.rotation.y = ry; w.add(f);
      box(f, 4.6, 4.6, 0.12, 0, -2.3, -0.04, GD); const d = new THREE.Mesh(G("bbDial", () => new THREE.CircleGeometry(1.85, 32)), DIAL); d.position.z = 0.05; f.add(d); tor(f, 1.9, 0.12, 0, 0, 0.07, GD);
      if (FULL) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, o = box(f, 0.12, 0.34, 0.04, Math.sin(a) * 1.55, Math.cos(a) * 1.55 - 0.17, 0.08, INK); o.rotation.z = -a; }
      const hh = box(f, 0.14, 1.0, 0.04, 0, 0, 0.1, INK); hh.geometry = G("bbHour", () => new THREE.BoxGeometry(0.14, 1.0, 0.04).translate(0, 0.5, 0)); hh.position.y = 0; hh.rotation.z = 1.1; // ten past ten
      const mh = box(f, 0.09, 1.5, 0.04, 0, 0, 0.12, INK); mh.geometry = G("bbMin", () => new THREE.BoxGeometry(0.09, 1.5, 0.04).translate(0, 0.75, 0)); mh.position.y = 0; mh.rotation.z = -1.05;
    }
    box(w, 4.7, 3.0, 4.7, 0, 25.1, 0, PL); for (const [dx, dz, ry] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]]) for (const k of [-1.1, 0, 1.1]) archWin(w, 0.75, 2.2, dx * 2.36 + (dz ? k : 0), 25.4, dz * 2.36 + (dx ? k : 0), m(0x2a2a2c), ry); // the belfry
    box(w, 5.0, 0.4, 5.0, 0, 28.1, 0, PL);
    const sp = new THREE.Mesh(G("bbSpire", () => new THREE.ConeGeometry(2.6 * Math.SQRT2, 9, 4).rotateY(Math.PI / 4).translate(0, 4.5, 0)), SL); sp.position.y = 28.5; w.add(sp);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cyl(w, 0.3, 0.3, 1.6, cx * 2.2, 28.5, cz * 2.2, PL, 6); cone(w, 0.36, 2.0, cx * 2.2, 30.1, cz * 2.2, SL, 6); sph(w, 0.12, cx * 2.2, 32.15, cz * 2.2, GD, 1, 6); }
    if (FULL) for (const y of [31, 33.5]) { const b = new THREE.Mesh(G(`bbBand${y}`, () => { const r = 2.6 * (1 - (y - 28.5) / 9); return new THREE.CylinderGeometry(r * Math.SQRT2 + 0.05, r * Math.SQRT2 + 0.05, 0.25, 4).rotateY(Math.PI / 4); }), GD); b.position.y = y; w.add(b); }
    cyl(w, 0.12, 0.05, 2.6, 0, 37.4, 0, GD, 6); sph(w, 0.22, 0, 40.1, 0, GD, 1, 8);
    // the Palace of Westminster beside it: the long river front, its slate roof, pinnacles along the front, the central spire, the Victoria Tower
    const x0 = 2.9, L = 24, D = 6.5, H = 7.6;
    fbox(w, L, H, D, x0 + L / 2, 0, -0.6, ST, "gothic"); box(w, L + 0.3, 0.35, D + 0.3, x0 + L / 2, H, -0.6, PL);
    const roof = new THREE.Mesh(G("bbRoof", () => new THREE.CylinderGeometry(0.15, 1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0).scale(Math.SQRT1_2, 1, Math.SQRT1_2)), SL); roof.scale.set(L, 3, D); roof.position.set(x0 + L / 2, H + 0.35, -0.6); w.add(roof);
    for (let x = x0 + 0.8; x < x0 + L; x += FULL ? 1.6 : 3.2) { cyl(w, 0.13, 0.13, 1.1, x, H + 0.35, -0.6 + D / 2, PL, 5); cone(w, 0.17, 0.9, x, H + 1.45, -0.6 + D / 2, PL, 5); }
    cyl(w, 1.0, 1.0, 3.5, x0 + L * 0.45, H + 1.5, -0.6, PL, 8); cone(w, 1.1, 5.5, x0 + L * 0.45, H + 5, -0.6, SL, 8); sph(w, 0.15, x0 + L * 0.45, H + 10.6, -0.6, GD, 1, 6); // the central spire
    fbox(w, 6, 21, 6, x0 + L + 3, 0, -0.6, ST, "gothic"); box(w, 6.4, 0.5, 6.4, x0 + L + 3, 21, -0.6, PL); // the Victoria Tower
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cyl(w, 0.4, 0.4, 2.4, x0 + L + 3 + cx * 2.8, 21.5, -0.6 + cz * 2.8, PL, 8); cone(w, 0.45, 1.6, x0 + L + 3 + cx * 2.8, 23.9, -0.6 + cz * 2.8, SL, 8); }
    cyl(w, 0.06, 0.06, 3, x0 + L + 3, 21.5, -0.6, m(0xdddddd), 5);
    w.position.x = -(x0 + L + 6 - 2.3) / 2 * SC; w.scale.setScalar(SC); // (centred on its whole length)
    return g;
  },
  towerbridge: (h) => { const g = new THREE.Group(), B3 = m(0x5a7fa0, { metalness: 0.3 }), S = m(0xc9c2b4); for (const s of [-1, 1]) { box(g, 3, 14, 3, s * h * 0.45, 0, 0, S); cone(g, 2.4, 3, s * h * 0.45, 14, 0, B3, 4).rotation.y = Math.PI / 4; } box(g, h * 0.95, 0.8, 2.6, 0, 11, 0, B3); box(g, h * 2, 1.2, 3, 0, 4, 0, B3); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) beam(g, s * h * 0.45, 12, 0, s * (h * 0.7 + i * h * 0.1), 4.6, 0, 0.1, B3); return g; },
  londoneye: (h) => { const g = new THREE.Group(), R = h * 0.95; tor(g, R, 0.2, 0, R + 1.5, 0, WHITE); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; beam(g, 0, R + 1.5, 0, Math.cos(a) * R, R + 1.5 + Math.sin(a) * R, 0, 0.05, WHITE); sph(g, 0.5, Math.cos(a) * R, R + 1.5 + Math.sin(a) * R, 0.5, glow(0xaee6ff, 1.2), 1.4, 8); } beam(g, -R * 0.45, 0, 1.2, 0, R + 1.5, 0, 0.35, WHITE); beam(g, -R * 0.45, 0, -1.2, 0, R + 1.5, 0, 0.35, WHITE); return g; },
  atomium: (h) => { const g = new THREE.Group(), A = m(0xc9d1d8, { metalness: 0.9, roughness: 0.2 }), c = h * 0.55, sy = 8; const P = [[0, 0, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 0]]; for (const [x, y, z] of P) sph(g, 1.6, x * c, sy + y * c * 1.2, z * c, A); for (const [x, y, z] of P.slice(1, 5)) beam(g, 0, sy, 0, x * c, sy, z * c, 0.35, A); sph(g, 1.6, 0, sy + c * 1.2, 0, A); beam(g, 0, sy, 0, 0, sy + c * 1.2, 0, 0.35, A); for (const [x, , z] of P.slice(1, 5)) beam(g, x * c, sy, z * c, 0, sy + c * 1.2, 0, 0.3, A); for (const [x, , z] of P.slice(1, 5)) beam(g, x * c, 0, z * c, x * c, sy, z * c, 0.3, STEEL); return g; },
  belfry: (h) => { const g = new THREE.Group(), S = m(0xb9a98c); fbox(g, h * 0.8, 14, h * 0.8, 0, 0, 0, 0xb9a98c, "gothic"); fbox(g, h * 0.6, 4, h * 0.6, 0, 14, 0, 0xb9a98c, "gothic"); cone(g, h * 0.45, 7, 0, 18, 0, m(0x4d6a5a), 4).rotation.y = Math.PI / 4; return g; },
  parliament: (h) => { const g = new THREE.Group(), S = m(0xe9e1d0), D = m(0x4f8a8a); box(g, h * 2, 6, h * 0.8, 0, 0, 0, S); cyl(g, h * 0.28, h * 0.28, 6, 0, 6, 0, S, 16); sph(g, h * 0.3, 0, 12, 0, D, 1.3); cone(g, 0.4, 5, 0, 14, 0, STEEL, 6); for (const s of [-1, 1]) for (const k of [0.45, 0.8]) { cone(g, 0.7, 5, s * h * k, 6, 0, D, 6); cone(g, 0.7, 5, s * h * k, 6, h * 0.3, D, 6); } window_rows(g, h * 2, h * 0.8, 1, 5.5, 1.5, WIN); return g; },
  chainbridge: (h) => { const g = new THREE.Group(), S = m(0xc9c2b4), C = m(0x4a4f57, { metalness: 0.5 }); box(g, h * 2, 0.6, 3, 0, 3.4, 0, C); for (const s of [-1, 1]) { box(g, 2.2, 12, 3.2, s * h * 0.6, 0, 0, S); box(g, 2.6, 1, 3.4, s * h * 0.6, 12, 0, S); } for (let i = -9; i <= 9; i++) { const x = i * h * 0.1, y = 12 - Math.max(0, 1 - Math.abs(i * h * 0.1) / (h * 0.6)) * 0, sag = 12 - 8 * (1 - Math.min(1, (x / (h * 0.6)) ** 2)); beam(g, x, 4, 1.4, x, Math.max(4, sag + 1), 1.4, 0.06, C); } return g; },
  dutchmill: (h) => { const g = new THREE.Group(), W = m(0xf0ebe0); cyl(g, h * 0.45, h * 0.28, 12, 0, 0, 0, m(0x8a5a3a), 10); cone(g, h * 0.34, 3, 0, 12, 0, m(0x3a3a40), 10); const hub = new THREE.Group(); hub.position.set(0, 11, h * 0.35); for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; box(arm, 0.4, h * 1.4, 0.15, 0, 0.2, 0, W); box(arm, 0.2, h * 1.2, 0.1, 0.5, 0.4, 0, WHITE); hub.add(arm); } g.add(hub); g.userData.spin = hub; return g; },
  canalhouses: (h) => { const g = new THREE.Group(), C = [0xc8553d, 0xe8c07d, 0x6b8f71, 0x3f6f9a, 0xd98a9e, 0xf0e2c0]; for (let i = 0; i < 7; i++) { const w = h * 0.26, x = -h * 0.9 + i * h * 0.3, hh = 6 + (i * 37 % 4); box(g, w, hh, w * 1.4, x, 0, 0, m(C[i % C.length])); cone(g, w * 0.7, 1.8, x, hh, 0, m(0x4a3a36), 4).rotation.y = Math.PI / 4; for (let k = 1; k < 3; k++) box(g, w * 0.5, 0.9, 0.1, x, k * 2.2, w * 0.71, WIN); } return g; },
  colosseum: (h) => { const g = new THREE.Group(), S = m(0xd8c3a0, { roughness: 0.9 }); const ring = cyl(g, h * 0.95, h * 0.95, 8, 0, 0, 0, S, 32); ring.scale.z = 0.8; for (let i = 0; i < 32; i++) { const a = i / 32 * 6.283; for (const y of [1.2, 3.8, 6.2]) box(g, 0.9, 1.4, 0.6, Math.cos(a) * h * 0.95, y, Math.sin(a) * h * 0.95 * 0.8, DARK).rotation.y = -a + Math.PI / 2; } return g; },
  pisa: (h) => { const g = new THREE.Group(); const t = new THREE.Group(); for (let i = 0; i < 6; i++) { cyl(t, h * 0.42, h * 0.42, 2.2, 0, i * 2.4, 0, WHITE, 14); cyl(t, h * 0.46, h * 0.46, 0.25, 0, i * 2.4 + 2.2, 0, STONE, 14); } cyl(t, h * 0.3, h * 0.3, 2, 0, 14.4, 0, WHITE, 12); t.rotation.z = -0.1; g.add(t); fbox(g, h * 1.6, 3, h * 0.8, h * 1.1, 0, 0, 0xf1f1ec, "classic"); sph(g, h * 0.3, h * 1.1, 3, 0, m(0x9a8f7a), 0.8); return g; },
  alcala: (h) => { const g = new THREE.Group(), S = m(0xe6dfce); fbox(g, h * 1.8, 8, h * 0.8, 0, 0, 0, 0xe6dfce, "stone"); box(g, h * 0.45, 5, h * 0.9, 0, 0, 0, DARK); for (const s of [-1, 1]) box(g, h * 0.3, 4, h * 0.9, s * h * 0.55, 0, 0, DARK); box(g, h * 1.9, 0.8, h * 0.9, 0, 8, 0, S); fbox(g, h * 0.7, 2, h * 0.5, 0, 8.8, 0, 0xe6dfce, "stone"); return g; },
  kiotowers: (h) => { const g = new THREE.Group(), K = m(0x7f8a9a, { metalness: 0.5 }); for (const s of [-1, 1]) { const t = box(g, h * 0.45, 20, h * 0.45, s * h * 0.5, 0, 0, K); t.rotation.z = -s * 0.2; t.position.y = 10; t.position.x -= s * Math.sin(0.2) * 0 ; } box(g, h * 0.3, 1.5, h * 0.3, 0, 17, 0, glow(0x7fd9ff, 1.4)); return g; },
  flame: (h) => { // the Flame Towers: three curved glass flames on the hill; by night their skins become huge LED flames
    const g = new THREE.Group(), F = nightGlow("flameskin", 0x2f5c92, 0xff6a1a, 2.2, { metalness: 0.7, roughness: 0.18 });
    [[-h * 0.75, 19, h * 0.62, 0.35], [0, 27, h * 0.78, 0], [h * 0.75, 22, h * 0.62, -0.35]].forEach(([x, H, w, ry]) => { const o = new THREE.Mesh(flameGeo(w, H, w * 0.7), F); o.position.x = x; o.rotation.y = ry; g.add(o); });
    return g;
  },
  maiden: (h) => { const g = new THREE.Group(), S = m(0xb8a98a); cyl(g, h * 0.55, h * 0.5, 11, 0, 0, 0, S, 20); cyl(g, h * 0.3, h * 0.3, 4, h * 0.3, 11, 0, S, 14); cone(g, h * 0.34, 2.4, h * 0.3, 15, 0, m(0x8a5a3a), 14); return g; },
  heydar: (h) => { const g = new THREE.Group(), W = m(0xf4f6f8, { roughness: 0.3, metalness: 0.2 }); const a = sph(g, h * 0.9, 0, 0, 0, W, 0.45, 24); sph(g, h * 0.5, h * 0.4, 0.5, 0, W, 0.7, 20); sph(g, h * 0.4, -h * 0.5, 0.3, h * 0.2, W, 0.6, 20); box(g, h * 1.2, 0.3, h * 0.2, 0, 4, 0, NEON_C); return g; },
  mbs: (h) => { const g = new THREE.Group(), T = m(0xd9dde2, { metalness: 0.5, roughness: 0.3 }); for (let i = -1; i <= 1; i++) { const t = box(g, h * 0.45, 22, h * 0.4, i * h * 0.55, 0, 0, T); t.rotation.z = -i * 0.07; } box(g, h * 2.3, 1.4, h * 0.5, 0, 22, 0, T); box(g, h * 2.0, 0.4, h * 0.35, h * 0.1, 23.4, 0, glow(0x7fe9ff, 1.3)); cone(g, h * 0.28, 2.4, h * 1.2, 22.2, 0, T, 12).rotation.z = -1.57; window_rows(g, h * 1.9, h * 0.45, 1, 21, 2.2, WIN); return g; },
  supertrees: (h) => { const g = new THREE.Group(); [[-h * 0.5, 16], [h * 0.1, 22], [h * 0.65, 18]].forEach(([x, H], i) => { cyl(g, 0.9, 0.5, H, x, 0, 0, m(0x5a4a3a), 8); cyl(g, h * 0.45, h * 0.12, 3.5, x, H, 0, m(0x3a7a4a), 14); const ring = tor(g, h * 0.38, 0.12, x, H + 0.4, 0, i % 2 ? NEON_P : NEON_C, Math.PI / 2); }); return g; },
  merlion: (h) => { const g = new THREE.Group(), W = m(0xf0f0ee); cyl(g, h * 0.5, h * 0.35, 4, 0, 0, 0, STONE, 12); cone(g, h * 0.35, 5, 0, 4, 0, W, 10); sph(g, h * 0.3, 0, 9.4, 0.4, W); cone(g, 0.2, 2.2, 0, 8.2, 0.5, m(0x59c8ff), 6).rotation.x = 1.2; return g; },
  flyer: (h) => { const g = new THREE.Group(), R = h * 1.05; tor(g, R, 0.3, 0, R + 4, 0, STEEL); tor(g, R * 0.88, 0.1, 0, R + 4, 0, STEEL); for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; beam(g, 0, R + 4, 0, Math.cos(a) * R, R + 4 + Math.sin(a) * R, 0, 0.05, STEEL); } for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; box(g, 1, 1, 1, Math.cos(a) * R, R + 3.4 + Math.sin(a) * R, 0, NEON_Y); } fbox(g, h * 1.8, 4, h * 0.4, 0, 0, 0, 0x8a929c, "modern"); beam(g, -2, 4, 0, 0, R + 4, 0, 0.35, STEEL); beam(g, 2, 4, 0, 0, R + 4, 0, 0.35, STEEL); return g; },
  capitol: (h) => { const g = new THREE.Group(), P = m(0xd9a48a); fbox(g, h * 1.9, 6, h * 0.9, 0, 0, 0, 0xd9a48a, "classic"); cyl(g, h * 0.38, h * 0.38, 4, 0, 6, 0, P, 20); sph(g, h * 0.4, 0, 10, 0, m(0xc9c2b4, { metalness: 0.4 }), 0.9); cone(g, 0.3, 3, 0, 13.4, 0, m(0xffd23f), 5); fbox(g, h * 0.8, 3, 1.4, 0, 0, h * 0.5, 0xd9a48a, "classic"); return g; },
  uttower: (h) => { const g = new THREE.Group(), S = m(0xdcc9a4); box(g, h * 0.7, 20, h * 0.7, 0, 0, 0, S); box(g, h * 0.9, 3.5, h * 0.9, 0, 20, 0, S); box(g, h * 0.6, 3, h * 0.6, 0, 23.5, 0, S); cone(g, h * 0.3, 3, 0, 26.5, 0, m(0xc9a46a), 4).rotation.y = Math.PI / 4; window_rows(g, h * 0.7, h * 0.7, 2, 19, 2.6, WIN); return g; },
  angel: (h) => { const g = new THREE.Group(), S = m(0xe6dfce); box(g, h * 0.9, 1, h * 0.9, 0, 0, 0, S); box(g, h * 0.65, 1, h * 0.65, 0, 1, 0, S); cyl(g, h * 0.22, h * 0.17, 14, 0, 2, 0, S, 8); cyl(g, h * 0.3, h * 0.25, 1, 0, 15.5, 0, S, 8); const gold = m(0xf2c23a, { metalness: 0.8, roughness: 0.3 }); cyl(g, 0.5, 0.35, 3, 0, 16.5, 0, gold, 8); box(g, 3.2, 0.2, 0.5, 0, 19, 0, gold); sph(g, 0.4, 0, 19.8, 0, gold, 1, 8); return g; },
  pyramid: (h) => { const g = new THREE.Group(), S = m(0xc9b48a); for (let i = 0; i < 6; i++) { const w = h * (1.6 - i * 0.25); box(g, w, 2.2, w, 0, i * 2.2, 0, S); } box(g, h * 0.3, 2.4, h * 0.3, 0, 13.2, 0, STONE); return g; },
  christ: (h) => { const g = new THREE.Group(), R = m(0x5f7a5a, { roughness: 1 }), W = m(0xeef0ec); const mt = cone(g, h * 0.95, 14, 0, 0, 0, R, 8); box(g, 2, 3, 2, 0, 14, 0, WHITE); box(g, 0.8, 5, 0.8, 0, 17, 0, W); box(g, 6, 0.8, 0.8, 0, 20.4, 0, W); sph(g, 0.5, 0, 22.2, 0, W, 1, 8); return g; },
  sugarloaf: (h) => { const g = new THREE.Group(); sph(g, h * 1.0, 0, -h * 0.1, 0, m(0x8b8e92, { roughness: 1 }), 1.2); sph(g, h * 0.5, h * 0.9, -h * 0.2, 0, m(0x6a8a62, { roughness: 1 }), 0.9); return g; },
  ponte: (h) => { const g = new THREE.Group(), C = m(0xf0f0f0), D = m(0x555a60); box(g, h * 2, 0.7, 3, 0, 3.5, 0, D); const mast = (x) => { beam(g, x - 0.8, 3.5, 0, x, 20, 0, 0.5, C); beam(g, x + 0.8, 3.5, 0, x, 20, 0, 0.5, C); }; mast(0); for (let i = 1; i <= 7; i++) for (const s of [-1, 1]) { beam(g, 0, 20 - i * 0.7, 0, s * i * h * 0.12, 3.9, 0, 0.04, STEEL); } return g; },
  sphere: (h) => { // the Sphere: a huge LED ball (see makeSphereMat) on a dark plinth
    const g = new THREE.Group(), s = h * 1.15; const ball = new THREE.Mesh(G("sphere48", () => new THREE.SphereGeometry(1, 64, 40)), makeSphereMat()); ball.scale.setScalar(s); ball.position.y = s * 0.92; g.add(ball); g.userData.ball = ball;
    cyl(g, s * 0.62, s * 0.7, 2.2, 0, 0, 0, DARK, 24); cyl(g, s * 0.71, s * 0.71, 0.3, 0, 1.0, 0, NEON_P, 24); return g;
  },
  bellagio: (h) => { // a Strip resort: a long curved hotel in cream with terracotta roofs, a lake in front with its dancing fountains
    const g = new THREE.Group(), C = m(0xeadfc6, { roughness: 0.6 }), T = m(0xb8643c), Wa = m(0x1f5f8a, { metalness: 0.2, roughness: 0.08 });
    [[-0.9, 0.45, 17], [0, 0, 22], [0.9, 0.45, 17]].forEach(([x, z, H]) => { const b = box(g, h * 0.62, H, h * 0.42, x * h * 0.95, 0, -h * 0.4 - z * h * 0.6, C); b.rotation.y = -x * 0.45; box(g, h * 0.66, 1.2, h * 0.46, x * h * 0.95, H, -h * 0.4 - z * h * 0.6, T).rotation.y = -x * 0.45; });
    for (let y = 2; y < 20; y += 2.2) box(g, h * 0.64, 0.22, h * 0.44, 0, y, -h * 0.4, WIN);
    const lake = cyl(g, h * 1.25, h * 1.25, 0.3, 0, 0, h * 0.75, Wa, 32); lake.scale.z = 0.55; box(g, h * 2.6, 0.6, 0.6, 0, 0, h * 1.45, STONE);
    for (let i = 0; i < 11; i++) cyl(g, 0.12, 0.05, 3 + (i % 3) * 2.2, (i - 5) * h * 0.2, 0.3, h * 0.75, glow(0xe8f6ff, 1.6), 5); // fountains
    box(g, 1.6, 7, 0.6, h * 1.3, 0, h * 1.35, DARK); box(g, 4.4, 3, 0.5, h * 1.3, 7, h * 1.35, NEON_Y); return g;
  },
  wynn: (h) => { // a Strip resort: a tall curved slab of bronze glass
    const g = new THREE.Group(), Bz = m(0x8c5a2b, { metalness: 0.85, roughness: 0.22 }), R = h * 2.4;
    const slab = new THREE.Mesh(arcGeo(R, 0.75, 3.4, 30), Bz); slab.position.z = -R; g.add(slab); // (the arc's centre is behind it: it bulges towards the street)
    for (let y = 2; y < 30; y += 2.4) { const b = new THREE.Mesh(arcGeo(R + 0.05, 0.75, 3.5, 0.18), WIN); b.position.set(0, y, -R); g.add(b); }
    box(g, h * 1.6, 3, h * 0.9, 0, 0, -1, m(0xd8c4a0)); box(g, h * 1.2, 1.4, 0.4, 0, 30.2, -0.6, NEON_Y); return g;
  },
  caesars: (h) => { // a Strip resort: a white tower with a stepped crown above a colonnade
    const g = new THREE.Group(), Wt = m(0xf1ede4), Gd = m(0xd9b44a, { metalness: 0.7, roughness: 0.3 });
    box(g, h * 1.3, 20, h * 0.5, 0, 0, 0, Wt); box(g, h * 1.0, 3, h * 0.42, 0, 20, 0, Wt); box(g, h * 0.6, 2, h * 0.34, 0, 23, 0, Wt); box(g, h * 1.32, 0.4, h * 0.52, 0, 20, 0, Gd);
    for (let y = 2; y < 20; y += 1.8) box(g, h * 1.31, 0.2, h * 0.51, 0, y, 0, WIN);
    box(g, h * 2, 0.6, h * 0.5, 0, 5, h * 0.55, Wt); for (let i = 0; i < 11; i++) cyl(g, 0.35, 0.35, 5, (i - 5) * h * 0.18, 0, h * 0.55, Wt, 8);
    box(g, 1.2, 6, 0.6, -h * 0.9, 0, h * 0.95, DARK); box(g, 3.6, 2.4, 0.5, -h * 0.9, 6, h * 0.95, NEON_R); return g;
  },
  yasspan: () => { // Yas hotel (Abu Dhabi), built in world units: two hotels either side of the track, a bridge over it, all under a lit gridshell
    const g = new THREE.Group(), Wh = m(0xeef0f2, { roughness: 0.4 }), Gl = m(0x3a6688, { metalness: 0.6, roughness: 0.18 }), X0 = 27, X1 = 54, HH = 21, L = 36;
    for (const s of [-1, 1]) { box(g, X1 - X0, HH, L, s * (X0 + X1) / 2, 0, 0, Gl); for (let y = 2.5; y < HH; y += 3) box(g, X1 - X0 + 0.1, 0.3, L + 0.1, s * (X0 + X1) / 2, y, 0, WIN); box(g, X1 - X0 + 1, 0.6, L + 1, s * (X0 + X1) / 2, HH, 0, Wh); }
    box(g, X0 * 2 + 1, 3.6, 11, 0, 15.5, 0, Wh); box(g, X0 * 2 + 1.2, 1.4, 11.2, 0, 16.6, 0, Gl); // the bridge over the track
    const shellMat = cache.get("yasShell") || (() => { const mt = new THREE.MeshStandardMaterial({ color: 0xe9eef2, metalness: 0.5, roughness: 0.35, map: lattice(), alphaMap: lattice(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0xb15cff, emissiveMap: lattice(), emissiveIntensity: 0 }); mt.map.repeat.set(26, 7); cache.set("yasShell", mt); glows.push({ mat: mt, base: 1.6, nightOnly: true }); return mt; })();
    const shell = new THREE.Mesh(G("yasshell", () => new THREE.CylinderGeometry(1, 1, 1, 56, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)), shellMat);
    shell.scale.set(64, 34, L + 22); shell.position.y = 2; shell.castShadow = false; g.add(shell); // (high enough to sweep over both hotels and the bridge)
    g.userData.keep = true; return g; // (kept as separate meshes: the see-through shell must not cast a solid shadow)
  },
  masp: (h) => { // MASP, Sao Paulo: a glass box held high between two red concrete frames, an open plaza beneath
    const g = new THREE.Group(), Rr = m(0xc4231c, { roughness: 0.55 }), Gl = m(0x22303a, { metalness: 0.5, roughness: 0.2 }), L = h * 2.3, D = h * 0.95, y0 = 8;
    box(g, L * 1.1, 0.4, D * 2.2, 0, 0, 0, m(0xb9b4a8)); box(g, L * 0.96, 6, D, 0, y0, 0, Gl); for (let y = y0 + 1; y < y0 + 6; y += 1.2) box(g, L * 0.961, 0.12, D + 0.02, 0, y, 0, WIN);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 1.6, y0 + 7.6, 1.6, sx * L / 2, 0, sz * (D / 2 + 0.9), Rr); // the four red pillars
    for (const sz of [-1, 1]) { box(g, L + 1.6, 1.6, 1.6, 0, y0 + 6, sz * (D / 2 + 0.9), Rr); box(g, L + 1.6, 1.4, 1.6, 0, y0 - 1.2, sz * (D / 2 + 0.9), Rr); } // the beams
    return g;
  },
  copan: (h) => { // Copan, Sao Paulo: a long residential slab curving like a wave, striped with white sun-shades
    const g = new THREE.Group(), mt = cache.get("copan") || (() => { const v = new THREE.MeshStandardMaterial({ color: 0xffffff, map: bands(), roughness: 0.7 }); cache.set("copan", v); return v; })();
    const o = new THREE.Mesh(waveGeo(h * 3.2, h * 0.55, h * 0.36, 30), mt); g.add(o); box(g, h * 3.3, 3, h * 1.3, 0, 0, 0, m(0xbdb7aa)); return g;
  },
  banespa: (h) => { // Altino Arantes (Banespa) tower: a stepped Art Deco tower with a mast
    const g = new THREE.Group(), S = m(0xd8ccb2, { roughness: 0.75 });
    box(g, h * 1.3, 16, h * 1.0, 0, 0, 0, S); box(g, h * 0.95, 7, h * 0.75, 0, 16, 0, S); box(g, h * 0.62, 5, h * 0.5, 0, 23, 0, S); box(g, h * 0.36, 3, h * 0.3, 0, 28, 0, S);
    window_rows(g, h * 1.3, h * 1.0, 1, 15.5, 1.7, WIN); cyl(g, 0.3, 0.12, 8, 0, 31, 0, STEEL, 6); sph(g, 0.4, 0, 39, 0, NEON_R, 1, 8); return g;
  },
  cotatower: (h) => { // the Circuit of the Americas tower (Austin): a red column with a deck on top and a veil of red cables down to the ground
    const g = new THREE.Group(), R = m(0xc8142e, { roughness: 0.45, metalness: 0.2 }), H = 31;
    cyl(g, 1.0, 0.75, H, 0, 0, 0, R, 12); cyl(g, h * 0.34, h * 0.3, 1.4, 0, H - 1.4, 0, GLASS, 20); cyl(g, h * 0.36, h * 0.36, 0.6, 0, H, 0, R, 20);
    for (let i = 0; i < 22; i++) { const a = i / 22 * 6.2832; beam(g, Math.cos(a) * h * 0.33, H - 1.4, Math.sin(a) * h * 0.33, Math.cos(a) * h * 0.95, 0, Math.sin(a) * h * 0.95, 0.14, R); }
    return g;
  },
  dohatower: (h) => { // Burj Doha: a round tower wrapped in a lattice, a domed top and a spire
    const g = new THREE.Group(), S = m(0xb9c4cf, { metalness: 0.6, roughness: 0.3 });
    cyl(g, h * 0.48, h * 0.42, 26, 0, 0, 0, S, 24); for (let y = 1.5; y < 26; y += 2.2) cyl(g, h * 0.485 - y * 0.0023 * h, h * 0.485 - y * 0.0023 * h, 0.3, 0, y, 0, NEON_C, 24);
    sph(g, h * 0.42, 0, 26, 0, S, 0.8, 24); cyl(g, 0.3, 0.1, 7, 0, 29, 0, STEEL, 6); return g;
  },
  bellasartes: (h) => { // Palacio de Bellas Artes (Mexico City): white marble with a golden-orange tiled dome
    const g = new THREE.Group(), Mb = m(0xf1ece2, { roughness: 0.5 }), D = m(0xe2902e, { metalness: 0.5, roughness: 0.35 });
    box(g, h * 2, 7, h * 1.3, 0, 0, 0, Mb); box(g, h * 2.05, 0.7, h * 1.35, 0, 7, 0, Mb); box(g, h * 0.8, 9, h * 0.8, 0, 0, 0, Mb);
    sph(g, h * 0.46, 0, 9, 0, D, 1.15, 20); cyl(g, 0.6, 0.6, 2, 0, 9 + h * 0.5, 0, D, 10); sph(g, 0.8, 0, 11.5 + h * 0.5, 0, D, 1, 10);
    for (const s of [-1, 1]) { sph(g, h * 0.22, s * h * 0.75, 7.6, 0, D, 1.1, 14); } for (let i = 0; i < 8; i++) cyl(g, 0.3, 0.3, 6, (i - 3.5) * h * 0.22, 0, h * 0.68, Mb, 8);
    return g;
  },
  luxor: (h) => { const g = new THREE.Group(), P = m(0x15171c, { metalness: 0.8, roughness: 0.2 }); const p = cone(g, h * 0.95, 16, 0, 0, 0, P, 4); p.rotation.y = Math.PI / 4; const beamM = new THREE.Mesh(G("lux", () => new THREE.CylinderGeometry(0.4, 0.4, 70, 8, 1, true)), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.25, depthWrite: false })); beamM.position.y = 51; g.add(beamM); box(g, 0.4, 0.4, 0.4, 0, 16, 0, NEON_C); window_rows(g, h * 0.3, h * 0.3, 1, 6, 2, NEON_Y); return g; },
  stratosphere: (h) => { const g = new THREE.Group(), S = m(0xe2e2e8); cyl(g, 1.2, 0.8, 26, 0, 0, 0, S, 10); cyl(g, h * 0.45, h * 0.3, 2, 0, 26, 0, S, 14); cyl(g, h * 0.45, h * 0.45, 3, 0, 28, 0, NEON_R, 14); cyl(g, h * 0.3, h * 0.45, 1.2, 0, 31, 0, S, 14); cone(g, 0.3, 8, 0, 32, 0, NEON_R, 6); return g; },
  eiffel: (h) => { const g = new THREE.Group(), I = m(0x6a5a4a, { metalness: 0.6, roughness: 0.5 }); const base = h * 0.85; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { beam(g, sx * base, 0, sz * base, sx * h * 0.28, 12, sz * h * 0.28, 0.45, I); beam(g, sx * h * 0.28, 12, sz * h * 0.28, sx * h * 0.1, 26, sz * h * 0.1, 0.35, I); } for (const y of [12, 20]) box(g, h * (y === 12 ? 0.6 : 0.34), 0.35, h * (y === 12 ? 0.6 : 0.34), 0, y, 0, I); cone(g, 0.3, 8, 0, 26, 0, I, 6); box(g, h * 0.5, 0.2, h * 0.5, 0, 24, 0, NEON_Y); return g; },
  welcome: (h) => { const g = new THREE.Group(); cyl(g, 0.3, 0.3, 4, 0, 0, 0, DARK, 6); const d = box(g, 4.6, 4.6, 0.5, 0, 6.3, 0, glow(0xffd23f, 1.6)); d.rotation.z = Math.PI / 4; box(g, 3, 0.8, 0.6, 0, 6.0, 0, NEON_R); for (let i = 0; i < 6; i++) sph(g, 0.22, Math.cos(i * 1.047) * 3.4, 6.3 + Math.sin(i * 1.047) * 3.4, 0.4, NEON_Y, 1, 6); return g; },
  lusail: (h) => { const g = new THREE.Group(), G1 = m(0xd4a64a, { metalness: 0.7, roughness: 0.3 }); const b = cyl(g, h * 0.92, h * 0.7, 12, 0, 0, 0, G1, 28); cyl(g, h * 0.74, h * 0.74, 0.5, 0, 12, 0, DARK, 28); for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283; box(g, 0.5, 8, 0.2, Math.cos(a) * h * 0.82, 2, Math.sin(a) * h * 0.82, i % 2 ? glow(0xffe8a0, 1.2) : DARK).rotation.y = -a; } return g; },
  aspire: (h) => { const g = new THREE.Group(), S = m(0xc7ccd4, { metalness: 0.6, roughness: 0.3 }); cyl(g, h * 0.38, h * 0.2, 22, 0, 0, 0, S, 14); cyl(g, h * 0.4, h * 0.3, 3, 0, 22, 0, S, 14); tor(g, h * 0.38, 0.35, 0, 25.2, 0, glow(0xff9a3a, 2), Math.PI / 2); cone(g, h * 0.3, 4, 0, 25, 0, glow(0xff7a1a, 2), 10); return g; },
  mosque: (h) => { const g = new THREE.Group(), W = m(0xfbfaf4, { roughness: 0.4 }); box(g, h * 1.8, 5, h * 1.1, 0, 0, 0, W); sph(g, h * 0.5, 0, 5, 0, W, 0.9, 24); for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) sph(g, h * 0.2, x * h, 5, z * h, W, 0.9, 14); for (const [x, z] of [[-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6]]) { cyl(g, 0.6, 0.45, 15, x * h * 0.95, 0, z * h * 0.55, W, 8); cone(g, 0.7, 2.4, x * h * 0.95, 15, z * h * 0.55, glow(0xffe9b0, 0.8), 8); } return g; },
  themepark: (h) => { const g = new THREE.Group(), R = m(0xc8281e, { roughness: 0.5 }); const roof = sph(g, h * 1.0, 0, 0, 0, R, 0.28, 28); fbox(g, h * 1.8, 1.4, h * 1.2, 0, 0, 0, 0xbfc3c8, "modern"); tor(g, h * 0.45, 0.25, h * 0.5, h * 0.55 + 1.4, h * 0.3, STEEL, 0, Math.PI / 2); for (let i = 0; i < 3; i++) box(g, 0.4, 5 + i, 0.4, -h * 0.6 + i * h * 0.12, 1.4, -h * 0.4, WHITE); return g; },
  yashotel: (h) => { const g = new THREE.Group(), G2 = m(0x20344f, { metalness: 0.6, roughness: 0.3 }); box(g, h * 1.8, 10, h * 0.8, 0, 0, 0, G2); const arc = tor(g, h * 0.55, 0.5, 0, 10, 0, glow(0x39e6ff, 2), 0, 0, Math.PI, 28); arc.scale.set(1.5, 0.5, 1); box(g, h * 1.82, 0.2, h * 0.82, 0, 5, 0, NEON_P); window_rows(g, h * 1.8, h * 0.8, 1, 10, 1.6, NEON_C); return g; },
  etihad: (h) => { const g = new THREE.Group(), S = m(0xc3cad4, { metalness: 0.6, roughness: 0.25 }); [[-0.8, 17], [-0.4, 21], [0, 24], [0.45, 20], [0.85, 15]].forEach(([x, H], i) => { const t = box(g, h * 0.28, H, h * 0.34, x * h, 0, (i % 2) * 0.4, S); cone(g, h * 0.17, 3, x * h, H, (i % 2) * 0.4, S, 4).rotation.y = Math.PI / 4; }); window_rows(g, h * 2, h * 0.34, 2, 15, 2.4, WIN); return g; },
};
export const hasLandmark = key => !!B[key];
// build (once per instance) the landmark `key`, fitting `half` world units
// the detailed rebuilds (landmarks-detail.js) replace the simple versions of the same name, and add a few new ones (St Peter's)
Object.assign(B, detailBuilders({ m, glow, nightGlow, box, cyl, sph, cone, tor, lathe, archWin, fbox, beam, G, full: () => FULL }));
export function makeLandmark(key, half) { const g = B[key](half); g.traverse(o => { if (o.isMesh) o.castShadow = !(o.material && o.material.transparent); }); return g; } // (see-through parts, like the Yas gridshell, cast no solid shadow)
export const LANDMARK_KEYS = Object.keys(B);
