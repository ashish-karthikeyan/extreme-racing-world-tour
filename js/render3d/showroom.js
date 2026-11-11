// The studio: a showroom with the car on a turntable set into a polished floor. It is its own little scene, built once while the game loads
// and reused for the main menu, the Garage and the tyre choice, drawn instead of the race (the title is filmed in the city: titlereel.js). Those screens are one place:
// only the camera moves between them.
//
//   room        a dark curved wall washed in the team's colour, two light bars, soft haze shafts, a reflective floor, a turntable ring
//   lighting    a studio reflection map (long strip-light highlights on the paint), a key light, team-coloured rim lights; the wall, the bars
//               and the lights turn with the camera (like a photographer's rig), so the car is lit the same from every side
//   views       menu    the car on one side of the screen, the cards on the other; each card nudges the camera and tints a rim light
//               garage  front three-quarter, long lens, fitted into the free area between the top bar and the panel
//               tyre    a close-up of the front wheel, with the chosen compound's band on the sidewall
//               Changing view is a camera move (under half a second), never a cut.
//   switching   lights dim, the turntable sinks, the car is swapped, it rises and the lights come back up in the new colour (< 0.7 s)
//   parade      on the main menu the cars take turns (the renderer picks the next team every few seconds): the turntable lines the car up,
//               it drives off to the left, the next one rolls in from the right and stops on the turntable while the lights change colour
//   quality     Low: no reflection, no haze, no shadows, no depth of field. Medium: half-size reflection. High and up: full reflection, haze,
//               self-shadowing and depth of field.
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { createFloorMaterials, createReflection } from "./showfloor.js";
import { createConfetti, createShockRing, makeLock } from "./showfx.js";

const ROLL_OUT = 0.7, ROLL_IN = 1.0, ROLL_D = 26, EXIT_TURN = 0.45, SHOW_TURN = 0.95; // the parade: seconds to drive off / roll in, how far, the heading it leaves on (from straight across the screen) and how far it turns to show its front in between
const ROOM = 34, TABLE_R = 5.1, DROP = 2.8, AUTO = 0.3, WALL_Y = 8, MOVE = 0.45; // (seconds: a move between views)
const TARGET = new THREE.Vector3(0, 0.85, 0), CAM_AZ = 36 * Math.PI / 180, CAM_EL = 10 * Math.PI / 180;
const CORNERS = []; for (const x of [-1.95, 1.95]) for (const y of [0, 2.1]) for (const z of [-4, 4]) CORNERS.push(new THREE.Vector3(x, y, z)); // the car's bounding box
const WHEEL = { x: 1.35, y: 0.7, z: -2.6, r: 1.25 }; // the front wheel (car's own frame: the nose points to -z), and how much round it a close-up shows
const sizeV = new THREE.Vector2(), TEX_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "alphaMap", "aoMap"];
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const easeIO = t => { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = x => Math.min(1, Math.max(0, x));

// A camera "pose": where it is, what it looks at, its field of view, and a shift of the picture (sx, sy, in screen units -1..1) that moves
// the subject off-centre without turning the camera (the way a tilt-shift lens does). focus / aperture drive the depth of field (0 = sharp).
const pose = () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 26, sx: 0, sy: 0, focus: 18, aperture: 0 });
function copyPose(o, a) { o.pos.copy(a.pos); o.look.copy(a.look); o.up.copy(a.up); o.fov = a.fov; o.sx = a.sx; o.sy = a.sy; o.focus = a.focus; o.aperture = a.aperture; return o; }
function lerpPose(o, a, b, k) { o.pos.lerpVectors(a.pos, b.pos, k); o.look.lerpVectors(a.look, b.look, k); o.up.lerpVectors(a.up, b.up, k).normalize(); o.fov = lerp(a.fov, b.fov, k); o.sx = lerp(a.sx, b.sx, k); o.sy = lerp(a.sy, b.sy, k); o.focus = lerp(a.focus, b.focus, k); o.aperture = lerp(a.aperture, b.aperture, k); return o; }
// a camera `d` from `look`, at azimuth `az` (0 = straight in front of the car, positive = round to its left side) and elevation `el`
function orbit(o, look, d, az, el) { o.set(look.x - Math.sin(az) * Math.cos(el) * d, look.y + Math.sin(el) * d, look.z - Math.cos(az) * Math.cos(el) * d); return o; }

// the wall: a grey-scale mask (dark panels, a broad glow, lit slats and a thin light strip) that is tinted with the team colour at run time
function wallTexture() {
  const W = 2048, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"), img = g.createImageData(W, H), d = img.data, ss = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  // every term is (something of x) times (something of y): work those out once per column and once per row, then each pixel is a few multiplications
  const base = new Float32Array(W), glowLit = new Float32Array(W), stripX = new Float32Array(W), sideX = new Float32Array(W), glowY = new Float32Array(H), stripY = new Float32Array(H), sideY = new Float32Array(H);
  for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / 330, slat = 0.5 + 0.5 * Math.cos(x / W * 6.2832 * 72), lit = 0.5 + 0.5 * ss(0.15, 0.85, slat);
    base[x] = 0.035 + 0.02 * ss(0.4, 0.6, slat); glowLit[x] = 0.5 * Math.exp(-dx * dx) * lit; stripX[x] = 0.9 * Math.exp(-(((x - W / 2) / 360) ** 4)); sideX[x] = 0.1 * Math.exp(-(dx * dx) / 3);
  }
  for (let y = 0; y < H; y++) { const dy = (y - 360) / 190; glowY[y] = Math.exp(-dy * dy); stripY[y] = Math.exp(-(((y - 318) / 2.4) ** 2)); sideY[y] = ss(0.2, 1, y / H); }
  for (let y = 0, i = 0; y < H; y++) {
    const gy = glowY[y], sy = stripY[y], ky = sideY[y];
    for (let x = 0; x < W; x++, i += 4) { const v = base[x] + glowLit[x] * gy + stripX[x] * sy + sideX[x] * ky; d[i] = d[i + 1] = d[i + 2] = Math.min(255, v * 255); d[i + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

// a soft dark patch, for the contact shadows under the tyres and body
function blobTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.45, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// The light the paint reflects: bright strips overhead, soft boxes at the sides and front. Made once, then blurred into a reflection map.
// photo (optional): a real photographed studio (Poly Haven's Studio Small 09, CC0) behind the strips, dimmed, so the paint and glass also
// reflect a real room: softboxes, walls and floor, not only the drawn strips.
function studioEnvironment(renderer, photo = null) {
  const s = new THREE.Scene(); s.background = photo || new THREE.Color(0x020203); if (photo) s.backgroundIntensity = 0.32;
  const lamp = k => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.92).multiplyScalar(k), side: THREE.DoubleSide });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); s.add(b); };
  for (const x of [-6, 0, 6]) box(0.7, 0.1, 30, x, 12, 0, lamp(8));
  box(0.2, 8, 6, -14, 5, -2, lamp(4)); box(0.2, 8, 6, 14, 5, -2, lamp(4)); box(10, 6, 0.2, -4, 6, -16, lamp(2.5));
  box(70, 0.2, 70, 0, -0.1, 0, lamp(0.03)); box(70, 30, 0.2, 0, 10, 24, lamp(0.05)); box(70, 0.2, 70, 0, 24, 0, lamp(0.02));
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.03).texture; pm.dispose(); return tex;
}

// the real studio photo (assets/hdri/studio.hdr): read as plain numbers, any too-bright texel capped (an infinite one would turn the reflections
// black), then turned into half floats, the graphics chip's format
let studioPhoto = null;
function loadStudioPhoto() {
  return studioPhoto || (studioPhoto = new RGBELoader().setDataType(THREE.FloatType).loadAsync("assets/hdri/studio.hdr").then(t => {
    const d = t.image.data, h = new Uint16Array(d.length); for (let i = 0; i < d.length; i++) h[i] = THREE.DataUtils.toHalfFloat(d[i] < 4000 ? d[i] : d[i] === d[i] ? 4000 : 0);
    t.image.data = h; t.type = THREE.HalfFloatType; t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.LinearSRGBColorSpace; t.needsUpdate = true; return t;
  }).catch(e => { console.warn("studio photo failed:", e.message || e); return null; }));
}

export function createShowroom({ renderer, makeCar, safe = false }) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 200);
  scene.background = new THREE.Color(0x020306); scene.environment = safe ? null : studioEnvironment(renderer); // (the safe path, for a browser that can't draw half-float pictures: no reflection map, no floor mirror)
  if (!safe) loadStudioPhoto().then(photo => { if (!photo || safe) return; const old = scene.environment; scene.environment = studioEnvironment(renderer, photo); if (old) old.dispose(); }); // (once the photo has arrived: reflections of a real studio too)
  const accent = new THREE.Color("#ffb21a"), accentTo = new THREE.Color("#ffb21a"), white = new THREE.Color(1, 1, 1), tint = new THREE.Color(1, 1, 1), tintTo = new THREE.Color(1, 1, 1), tmpC = new THREE.Color();
  const floorM = createFloorMaterials(), refl = createReflection(renderer, floorM.shared);
  const rig = new THREE.Group(); scene.add(rig); // everything that turns with the camera: the wall, the light bars, the lights and the haze

  // ---- the room ----
  const wallMat = new THREE.MeshBasicMaterial({ map: wallTexture(), side: THREE.BackSide, fog: false, color: accent.clone() });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM, ROOM, 26, 96, 1, true), wallMat); wall.position.y = WALL_Y; wall.rotation.y = CAM_AZ - Math.PI; rig.add(wall); // (the glow is straight behind the car, seen from the camera)
  const barMat = new THREE.MeshBasicMaterial({ color: accent.clone(), toneMapped: false });
  for (const k of [-1, 1]) { const a = CAM_AZ + k * 0.5, b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), barMat); b.position.set(Math.sin(a) * (ROOM - 3), 4, Math.cos(a) * (ROOM - 3)); rig.add(b); }
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(TABLE_R + 0.15, 70, 96, 1).rotateX(-Math.PI / 2), floorM.floor); floorRing.position.y = -0.01; scene.add(floorRing);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R + 0.15, TABLE_R + 0.15, 7, 64), new THREE.MeshBasicMaterial({ color: 0x010102, side: THREE.BackSide })); well.position.y = -3.5; scene.add(well);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R + 0.06, 0.1, 12, 120).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x252830, metalness: 1, roughness: 0.22 })); scene.add(bezel);
  const ledMat = new THREE.MeshBasicMaterial({ color: accent.clone(), toneMapped: false });
  const led = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R - 0.08, 0.045, 8, 120).rotateX(Math.PI / 2), ledMat); led.position.y = 0.03; scene.add(led);
  const floorLines = [9.2, 13.5].map((r, i) => { const m = new THREE.MeshBasicMaterial({ color: accent.clone(), toneMapped: false }), l = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.05, 128).rotateX(-Math.PI / 2), m); l.position.y = 0.005; scene.add(l); return { m, k: i ? 0.5 : 1 }; });
  const hazeMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Color(0.8, 0.88, 1) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vT; void main() { vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); vT = position.y / 12.0 + 0.5; gl_Position = projectionMatrix * m; }`,
    fragmentShader: `uniform float uI; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying float vT; void main() { float e = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0); gl_FragColor = vec4(uCol * uI * e * (0.15 + 0.85 * vT), 1.0); }`,
  });
  const hazeGeo = new THREE.CylinderGeometry(0.6, 3.6, 12, 24, 1, true), shafts = new THREE.Group(); rig.add(shafts);
  for (const [x, z] of [[-9, 6], [9, 6], [0, 13]]) { const m = new THREE.Mesh(hazeGeo, hazeMat); m.position.set(x, 6, z); m.frustumCulled = false; shafts.add(m); }

  // ---- the turntable: a disc (with a body that can sink into the well), contact shadows and the car ----
  const table = new THREE.Group(); scene.add(table);
  const discTop = new THREE.Mesh(new THREE.CircleGeometry(TABLE_R, 96).rotateX(-Math.PI / 2), floorM.table); discTop.position.y = -0.004; table.add(discTop);
  const discBody = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R - 0.1, DROP + 0.6, 64), new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.9, roughness: 0.35 })); discBody.position.y = -(DROP + 0.6) / 2 - 0.008; table.add(discBody);
  const holder = new THREE.Group(); table.add(holder); // the car and its contact shadows (they drive off together in the menu parade)
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const [x, z, w, l] of [[0, -0.1, 3.8, 9.6], [-1.35, -2.6, 1.7, 2.3], [1.35, -2.6, 1.7, 2.3], [-1.35, 2.4, 1.9, 2.6], [1.35, 2.4, 1.9, 2.6]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), blobMat); b.position.set(x, 0.02, z); b.renderOrder = 1; holder.add(b); }

  // ---- lights (on the rig: they turn with the camera) ----
  const hemi = new THREE.HemisphereLight(0x9fb0d8, 0x05060a, 0.5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2); key.position.set(-9, 15, -11); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 5, far: 40 }); rig.add(key);
  const spot = (x, y, z, ang) => { const s = new THREE.SpotLight(0xffffff, 0, 80, ang, 0.9, 1.3); s.position.set(x, y, z); s.target.position.set(0, 1, 0); rig.add(s); scene.add(s.target); return s; };
  const rimA = spot(-13, 11, 12, 0.6), rimB = spot(13, 10, 11, 0.6), top = spot(0, 16, -2, 0.5);
  const fill = new THREE.PointLight(0xaec4ff, 0, 40, 1.5); fill.position.set(11, 5, -17); rig.add(fill);
  const flashLight = new THREE.PointLight(0xffffff, 0, 30, 1.5); flashLight.position.set(0, 6, -5); rig.add(flashLight);

  // ---- effects ----
  const confetti = createConfetti(scene), ring = createShockRing(scene), lock = makeLock(); lock.visible = false; lock.position.set(0, 1.7, 0); scene.add(lock);
  const silhouette = new THREE.MeshStandardMaterial({ color: 0x0a0b10, roughness: 0.9, metalness: 0, envMapIntensity: 0.06 });

  // ---- cars: one per team, built the first time it is shown, kept for good ----
  const cars = new Map(); let shown = -1, want = -1, wantTeam = null;
  function carOf(i, team) {
    let e = cars.get(i);
    if (!e) {
      const obj = makeCar(team), mats = new Map(); obj.traverse(o => { if (o.isMesh) mats.set(o, o.material); });
      e = { obj, mats, locked: false, shadows: null, tyre: "" }; cars.set(i, e);
    }
    return e;
  }
  function setLocked(e, locked) { // a locked car is a black silhouette (the decals and stickers are hidden, the contact shadow stays)
    if (e.locked === locked) return; e.locked = locked;
    for (const [m, orig] of e.mats) { if (m.renderOrder === 1) continue; if (orig.transparent) m.visible = !locked; else m.material = locked ? silhouette : orig; }
  }
  function setCarShadows(e, on) { if (e.shadows === on) return; e.shadows = on; for (const m of e.mats.keys()) if (m.renderOrder !== 1 && !e.mats.get(m).transparent) { m.castShadow = on; m.receiveShadow = on; } }

  // ---- state ----
  let cw = 1280, ch = 720, layout = { top: 0.1, bottom: 0.7 }, dirty = true, info = null;
  let lvl = "high", shadowSize = 2048, t = 0, dip = 1, spinY = 0, vel = AUTO, idle = 99, dragging = false, velEst = 0, flashT = 0, lockS = 0, L = 1;
  let roll = null, arrivedT = 0; // the parade: a drive-off / roll-in in progress ({ phase 0 out | 1 in, t }), and when the car on show arrived
  let view = "", moveT = 1, expo = 1, menuOff = 0, wheelSide = -1, snapNext = true, stage = 1;
  const STAGE = { menu: 0.36, tyre: 0.42, garage: 1 }; // how bright the wall is in each view: the Garage the brightest
  const rects = { menu: { left: 0, right: 0.55, top: 0.12, bottom: 0.92 }, tyre: { left: 0, right: 0.55, top: 0.12, bottom: 0.92 } };
  const fits = { garage: { dist: 18, sx: 0, sy: 0 }, menu: { dist: 18, sx: 0, sy: 0 } };
  const cur = pose(), from = pose(), goal = pose(), vA = new THREE.Vector3(), vB = new THREE.Vector3();
  const hide = [floorRing, discTop, discBody, well, lock]; // (not drawn in the mirror image)
  const portrait = () => cw / ch < 0.9;

  // The projected size of the car over a full turn, with the camera `d` away at (az, el): as fractions of the screen; cx, cy = its centre (NDC)
  function measure(d, az, el) {
    camera.position.copy(orbit(vA, TARGET, d, az, el)); camera.lookAt(TARGET); camera.updateMatrixWorld();
    let w = 0, h = 0, n = 0, x0 = 9, x1 = -9, y0 = 9, y1 = -9; const v = vB;
    for (let a = 0; a < Math.PI; a += Math.PI / 24) { // (half a turn is enough: the box looks the same turned round)
      let ax = 9, bx = -9, ay = 9, by = -9; const c = Math.cos(a), s = Math.sin(a);
      for (const p of CORNERS) { v.set(p.x * c + p.z * s, p.y, -p.x * s + p.z * c).project(camera); ax = Math.min(ax, v.x); bx = Math.max(bx, v.x); ay = Math.min(ay, v.y); by = Math.max(by, v.y); }
      w = Math.max(w, (bx - ax) / 2); h = Math.max(h, (by - ay) / 2); n++; x0 = Math.min(x0, ax); x1 = Math.max(x1, bx); y0 = Math.min(y0, ay); y1 = Math.max(y1, by);
    }
    return { w, h, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, x1, y0, y1 };
  }
  const fovOf = v => portrait() ? (v === "menu" ? 34 : 32) : 26;
  // choose the camera distance so the car (at its widest point of the turn) fills `maxW` of the screen's width and fits the free height of `r`,
  // then shift the picture so the car is centred in `r` (fractions of the screen: left / right / top / bottom)
  function fitInto(f, r, maxW, hk, fov) {
    camera.aspect = cw / ch; camera.fov = fov; camera.updateProjectionMatrix();
    const freeH = Math.max(0.15, r.bottom - r.top);
    let lo = 6, hi = 90;
    for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2, m = measure(mid, CAM_AZ, CAM_EL); if (m.w > maxW || m.h > freeH * hk) lo = mid; else hi = mid; }
    const m = measure(hi, CAM_AZ, CAM_EL); f.dist = hi; f.sx = (r.left + r.right - 1) - m.cx; f.sy = (1 - (r.top + r.bottom)) - m.cy;
    return m;
  }
  function fit() {
    dirty = false; const aspect = cw / ch, pr = aspect < 0.9;
    const m = fitInto(fits.garage, { left: 0, right: 1, top: layout.top, bottom: layout.bottom }, pr ? 0.9 : aspect < 1.25 ? 0.8 : 0.66, 0.88, fovOf("garage")); fits.garage.sx = 0; // (the Garage's car is centred across the screen)
    info = { dist: fits.garage.dist, width: m.w, height: m.h, shift: fits.garage.sy, left: (m.x0 + 1) / 2, right: (m.x1 + 1) / 2, top: (1 - (m.y1 + fits.garage.sy)) / 2, bottom: (1 - (m.y0 + fits.garage.sy)) / 2 }; // (the car's outline over a full turn, as fractions of the screen)
    const r = rects.menu; fitInto(fits.menu, r, (r.right - r.left) * 0.86, 0.82, fovOf("menu")); // (at its widest point of the turn the car fills 86% of its side)
  }

  // ---- the views: each one writes the camera pose it wants this frame into `p` (world space) ----
  const toWorld = v => v.applyAxisAngle(THREE.Object3D.DEFAULT_UP, table.rotation.y); // car frame -> world (the car turns with the turntable)
  function goalOf(v, p) {
    p.sx = 0; p.sy = 0; p.aperture = 0;
    p.up.set(0, 1, 0);
if (v === "tyre") { // the front wheel on the camera's side, close, from low and a little ahead
      const r = rects.tyre, fov = portrait() ? 34 : 28, hFrac = Math.max(0.2, r.bottom - r.top), wFrac = Math.max(0.2, r.right - r.left) * cw / ch;
      const d = WHEEL.r / (Math.tan(fov * Math.PI / 360) * Math.min(hFrac, wFrac) * 0.82);
      p.look.set(WHEEL.x * wheelSide * 0.94, WHEEL.y + 0.05, WHEEL.z + 0.15);
      p.pos.set(p.look.x + wheelSide * d * 0.8, p.look.y + d * 0.1, p.look.z - d * 0.59); toWorld(p.look); toWorld(p.pos);
      p.fov = fov; p.sx = r.left + r.right - 1; p.sy = 1 - (r.top + r.bottom); p.aperture = 0.003;
    } else { // garage / menu: the fitted three-quarter view, swaying very slowly
      const f = v === "garage" ? fits.garage : fits.menu, az = CAM_AZ + Math.sin(t * 0.25) * 0.035 + (v === "garage" ? 0 : menuOff), el = CAM_EL + Math.sin(t * 0.37) * 0.012;
      p.look.copy(TARGET); orbit(p.pos, TARGET, f.dist, az, el); p.fov = fovOf(v); p.sx = f.sx; p.sy = f.sy; p.aperture = v === "garage" ? 0 : 0.0007;
    }
    p.focus = p.pos.distanceTo(p.look);
  }
  function apply(p) {
    camera.position.copy(p.pos); camera.up.copy(p.up); camera.lookAt(p.look); camera.aspect = cw / ch; camera.fov = p.fov; camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] = -p.sx; camera.projectionMatrix.elements[9] = -p.sy; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
  }

  function setQuality(Q) {
    const sh = Q.shadows > 0 ? (Q.garageShadows ?? Math.min(Q.shadows, 2048)) : 0;
    if (Q.level === lvl && sh === shadowSize) return;
    lvl = Q.level; shadowSize = sh; key.castShadow = sh > 0;
    if (sh > 0 && key.shadow.mapSize.x !== sh) { key.shadow.mapSize.set(sh, sh); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    scene.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; }); // (shadows on / off change the shaders)
  }

  const api = {
    scene, camera, get info() { return info; }, get dist() { return fits.garage.dist; },
    get exposure() { return expo; },                    // (eases back to 1 after a change of view)
    get focus() { return cur.focus; }, get aperture() { return cur.aperture; }, // depth of field for this frame (aperture 0 = none)
    haze: [shafts],                                     // (left out of the depth-of-field depth picture: they are see-through)
    get view() { return view; },
    debug: () => ({ dip, L, lvl, shown, want, spinY, shadowSize, refl: floorM.shared.uRefl.value, fade: floorM.shared.uFade.value, dist: fits.garage.dist, info, view, moveT }),
    setQuality,
    setSafe(on) { if (on && !safe) { safe = true; scene.environment = null; } },
    resize(w, h) { if (w !== cw || h !== ch) { cw = w; ch = h; dirty = true; } },
    setLayout(l) { if (l && (Math.abs(l.top - layout.top) > 0.002 || Math.abs(l.bottom - layout.bottom) > 0.002)) { layout = { top: l.top, bottom: l.bottom }; dirty = true; } },
    // where the 2D layer leaves room for the car on the menu and the tyre screen (fractions of the screen)
    setRect(name, r) { const o = rects[name]; if (!r || !o) return; if (Math.abs(r.left - o.left) + Math.abs(r.right - o.right) + Math.abs(r.top - o.top) + Math.abs(r.bottom - o.bottom) > 0.004) { Object.assign(o, r); if (name === "menu") dirty = true; } },
    spin(a) { spinY = a; vel = 0; idle = 0; },
    enter() { dip = 1; idle = 99; vel = AUTO; snapNext = true; }, // arriving from a city scene: the lights come up on a car that rises out of the floor, the camera starts in place
    grab() { dragging = true; idle = 0; vel = 0; velEst = 0; },
    drag(dx, dt) { spinY += dx * 0.011; velEst = lerp(velEst, dx * 0.011 / Math.max(dt, 1 / 120), 0.35); idle = 0; },
    release() { dragging = false; vel = Math.max(-7, Math.min(7, velEst)); idle = 0; },
    buy(team, big = true) { // the flash, shock ring and (for a car) confetti in the team's colours
      ring.fire(accentTo); flashT = 1; if (big) confetti.burst([team.p, team.s, team.a, teamAccent(team), "#ffffff", "#ffd23f"]);
    },
    warm(i, team) { if (cars.has(i)) return; const e = carOf(i, team); setCarShadows(e, shadowSize > 0); for (const m of e.mats.values()) for (const k of TEX_SLOTS) if (m[k]) renderer.initTexture(m[k]); }, // (build it and upload its textures before the first time it is on screen; every car shares the same shaders, compiled by the renderer)
    // call once per frame: v = { view, idx, team, locked, spinIn (right stick, -1..1), menuK (-1..1: which menu card), tint (a colour for one rim light, or null), tyre }
    update(dt, v) {
      t += dt;
      // ---- the camera: views and the moves between them ----
      const nv = v.view || "garage";
      if (nv !== view) {
        const was = view; view = nv;
        if (nv === "tyre") wheelSide = vA.copy(camera.position).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -table.rotation.y).x < 0 ? -1 : 1; // the front wheel on the side the camera is already on
        if (nv === "menu") arrivedT = t;
        if (snapNext || !was) { snapNext = false; moveT = 1; stage = STAGE[nv] ?? 1; }
        else { copyPose(from, cur); moveT = 0; }
      }
      if (dirty) fit();
      menuOff += ((v.menuK || 0) * 0.13 - menuOff) * (1 - Math.exp(-dt * 3)); // each card nudges the camera round a little
      goalOf(view, goal);
      if (moveT < 1) { moveT = Math.min(1, moveT + dt / MOVE); lerpPose(cur, from, goal, easeIO(moveT)); }
      else copyPose(cur, goal);
      expo += (1 - expo) * (1 - Math.exp(-dt * 7));
      apply(cur);
      rig.rotation.y = Math.atan2(-camera.position.x, -camera.position.z) - CAM_AZ; // the light rig faces the camera

      // ---- the car ----
      if (v.idx !== want || v.team !== wantTeam) { want = v.idx; wantTeam = v.team; }
      const swap = () => { if (shown >= 0 && cars.has(shown)) holder.remove(cars.get(shown).obj); const e = carOf(want, wantTeam); holder.add(e.obj); shown = want; accentTo.set(teamAccent(wantTeam)); }; // (take the new car and its colour)
      const parade = view === "menu" && !!v.parade;
      if (parade && !roll && shown >= 0 && want !== shown && dip < 0.01) roll = { phase: 0, t: 0 }; // the menu parade: drive off, roll the next car in
      if (roll && !parade) { roll = null; holder.position.z = 0; } // (left the menu half way: the dip below finishes the change)
      let rollDim = 0;
      if (roll) {
        roll.t += dt; const z0 = holder.position.z;
        if (roll.phase === 0) { const k = Math.min(1, roll.t / ROLL_OUT); holder.position.z = -ROLL_D * k * k * k; rollDim = 0.45 * k; if (k >= 1) { swap(); roll.phase = 1; roll.t = 0; holder.position.z = ROLL_D; } } // pulling away, faster and faster, off to the left
        else { const k = Math.min(1, roll.t / ROLL_IN); holder.position.z = ROLL_D * (1 - k) ** 3; rollDim = 0.45 * (1 - k); if (k >= 1) { roll = null; holder.position.z = 0; arrivedT = t; } } // the next one rolls in from the right and stops on the turntable
        const ud = cars.get(shown).obj.userData, moved = roll && roll.phase === 1 && roll.t === 0 ? 0 : z0 - holder.position.z; // (how far it went forward this frame: the nose is -z)
        if (ud.wheels) for (const w of ud.wheels) w.rotation.x -= moved / 0.7;
        dip = Math.max(0, dip - dt / 0.34);
      } else if (shown < 0 || (dip >= 1 && want !== shown)) swap(); // the lights are down: swap the car
      else if (want !== shown) dip = Math.min(1, dip + dt / 0.26);
      else dip = Math.max(0, dip - dt / 0.34);
      const e = cars.get(shown); setLocked(e, !!v.locked); setCarShadows(e, shadowSize > 0);
      const ud = e.obj.userData;
      if (v.tyre && ud.setTyre && e.tyre !== v.tyre) { e.tyre = v.tyre; ud.setTyre(v.tyre); } // the compound's band on the sidewalls
      if (view === "tyre" && ud.wheels) for (const w of ud.wheels) w.rotation.x -= dt * 0.9; // (the wheels roll slowly while you choose)
      const ed = smooth(dip); L = (1 - 0.9 * ed) * (1 - rollDim); // (the stage dims a little while it is empty in the parade)
      accent.lerp(accentTo, 1 - Math.exp(-dt * (parade ? 4 : 14))); // (in the parade the new colour washes in as the car rolls in)
      tintTo.set(v.tint || accentTo); tint.lerp(tintTo, 1 - Math.exp(-dt * 4));

      // spin: drag / right stick / coast to a stop, then ease back to the slow automatic turn (standing still for the tyre close-up)
      const still = view === "tyre";
      if (dragging) idle = 0;
      else if (Math.abs(v.spinIn || 0) > 0.12) { vel = v.spinIn * 3.2; idle = 0; spinY += vel * dt; }
      else if (still) { vel *= Math.exp(-dt * 5); spinY += vel * dt; idle = 99; }
      else if (parade) { // the parade: lined up to drive off to the left; while it is on show, it turns to show its front and back again
        const u = clamp01((t - arrivedT) / Math.max(1, v.paradeP - ROLL_OUT - ROLL_IN)), goal = CAM_AZ + menuOff - Math.PI / 2 + EXIT_TURN + SHOW_TURN * (1 - Math.cos(2 * Math.PI * u)) / 2;
        spinY = goal + Math.atan2(Math.sin(spinY - goal), Math.cos(spinY - goal)); spinY += (goal - spinY) * (1 - Math.exp(-dt * 5)); vel = 0; idle = 0; // (the shortest way round)
      }
      else { idle += dt; if (idle < 3) vel *= Math.exp(-dt * 2.2); else vel += (AUTO - vel) * (1 - Math.exp(-dt * 1.4)); spinY += vel * dt; }
      table.rotation.y = spinY; table.position.y = -DROP * ed;

      // lights, wall, rings: everything follows the team colour and the dim of the switch
      const lit = 0.12 + 0.88 * L; stage += ((STAGE[view] ?? 1) - stage) * (1 - Math.exp(-dt * 5));
      wallMat.color.copy(accent).multiplyScalar(0.85 * lit * stage); barMat.color.copy(accent).lerp(white, 0.3).multiplyScalar(1.7 * lit);
      ledMat.color.copy(accent).lerp(white, 0.15).multiplyScalar(1.7 * (0.5 + 0.5 * L) + flashT * 4);
      for (const f of floorLines) f.m.color.copy(accent).multiplyScalar(0.7 * f.k * lit);
      floorM.shared.accent.value.copy(accent); floorM.shared.uGlow.value = L; floorM.shared.uFade.value = 1 - smooth(dip * 3);
      scene.environmentIntensity = 0.7 * (0.15 + 0.85 * L);
      hemi.intensity = 0.3 * L; key.intensity = 1.5 * L; top.intensity = 70 * L; top.penumbra = 0.9; fill.intensity = 40 * L;
      rimA.intensity = rimB.intensity = 200 * L; rimA.color.copy(accent).lerp(white, 0.12); rimB.color.copy(accent).lerp(tmpC.copy(tint).lerp(white, 0.35), v.tint ? 0.4 : 1); // (rim B leans toward the colour of the menu card you are on; the team colour stays in charge)
      flashT = Math.max(0, flashT - dt * 2.2); flashLight.intensity = flashT * flashT * 900;
      shafts.visible = lvl !== "low"; hazeMat.uniforms.uI.value = 0.12 * L;
      const hz = hazeMat.uniforms.uCol.value; hz.copy(accent).lerp(white, 0.75);

      { const br = cars.get(shown) && cars.get(shown).obj.userData.brake; if (br) br.material.emissiveIntensity = 0.3; } // (the brake lights glow softly in the studio)
      // the padlock on a locked car
      lockS += ((v.locked && dip < 0.6 ? 1 : 0) - lockS) * (1 - Math.exp(-dt * 12)); lock.visible = lockS > 0.02;
      if (lock.visible) { lock.scale.setScalar(0.6 * lockS * (1 + 0.04 * Math.sin(t * 2.4))); lock.rotation.y = Math.atan2(camera.position.x - lock.position.x, camera.position.z - lock.position.z); for (const m of lock.userData.mats) m.opacity = Math.min(1, lockS); }
      confetti.update(dt); ring.update(dt);
    },
    // the mirror image for the floor (not on Low)
    beforeRender() {
      const on = lvl !== "low" && !safe; floorM.shared.uRefl.value = on ? 1 : 0; if (!on) return;
      const s = lvl === "medium" ? 0.5 : lvl === "high" ? 0.75 : 1, size = renderer.getDrawingBufferSize(sizeV);
      refl.setSize(Math.min(1600, size.x * s), Math.min(1600, size.x * s) * size.y / size.x);
      refl.render(scene, camera, hide);
    },
  };
  return api;
}
