// The three race cameras (Overhead, Chase, Cockpit) plus a menu camera, and the 3D cockpit that rides on the camera. (The title screen has its
// own camera, the reel in titlereel.js.)
import * as THREE from "three";

// cockpit parts are drawn on top of the car body (no depth test) in the order they were added, so they never vanish inside the tub
const part = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, depthTest: false, ...o });
const dark = part(0x15161a), trim = part(0x2c2f36, { metalness: 0.5 }), carbon = part(0x0c0c0e, { roughness: 0.4 });
const add = (parent, mesh, order) => { mesh.renderOrder = order; parent.add(mesh); return mesh; };

const smooth01 = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export const INTRO_BLEND = 0.8; // the last part of the race-start sweep, in seconds, glides into the race camera
export function createCameraRig(scene) {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.3, 2800);
  scene.add(camera);

  // ---- cockpit furniture, parented to the camera so it always sits in front of the driver's eyes ----
  const cockpit = new THREE.Group(); cockpit.visible = false; camera.add(cockpit);
  const dash = add(cockpit, new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), carbon), 20); dash.position.set(0, -0.66, -1.1);
  const wheel = new THREE.Group(); wheel.position.set(0, -0.5, -0.95); wheel.rotation.x = -0.6; cockpit.add(wheel);
  add(wheel, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 8, 24), dark), 21);
  add(wheel, new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.03), dark), 21);
  add(wheel, new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.04), trim), 22);
  // the little screen on the wheel: rev lights, gear and speed, redrawn only when a number changes
  const dc = document.createElement("canvas"); dc.width = 192; dc.height = 112; const dg = dc.getContext("2d");
  const dispTex = new THREE.CanvasTexture(dc); dispTex.colorSpace = THREE.SRGBColorSpace;
  const display = add(wheel, new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.175), new THREE.MeshBasicMaterial({ map: dispTex, depthTest: false })), 23);
  display.position.z = 0.025;
  let dispKey = "";
  const rigDraw = (kmh, gear, lit) => { // (each rig has its own: split-screen multiplayer has two cockpits)
    const key = `${kmh}|${gear}|${lit}`; if (key === dispKey) return; dispKey = key;
    dg.fillStyle = "#050607"; dg.fillRect(0, 0, 192, 112);
    for (let i = 0; i < 10; i++) { dg.fillStyle = i < lit ? (i < 4 ? "#39ff6a" : i < 8 ? "#ff3b30" : "#3b82ff") : "#262830"; dg.beginPath(); dg.arc(21 + i * 16.7, 16, 6, 0, Math.PI * 2); dg.fill(); }
    dg.textAlign = "center"; dg.fillStyle = "#fff"; dg.font = "bold 56px sans-serif"; dg.fillText(String(gear), 52, 86);
    dg.fillStyle = "#ffd23f"; dg.font = "bold 36px sans-serif"; dg.fillText(String(kmh), 135, 74); dg.fillStyle = "#aaa"; dg.font = "16px sans-serif"; dg.fillText("km/h", 135, 100);
    dispTex.needsUpdate = true;
  };
  for (const s of [-1, 1]) { const grip = add(wheel, new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.06), dark), 22); grip.position.set(s * 0.21, 0, 0); }
  const halo = add(cockpit, new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.9), trim), 20); halo.position.set(0, 0.58, -1.45); halo.rotation.x = 0.22;

  // ---- the two mirrors: small rear cameras drawn onto little screens ----
  const mirrors = [-1, 1].map(side => {
    const rt = new THREE.WebGLRenderTarget(256, 128, { depthBuffer: true });
    const cam = new THREE.PerspectiveCamera(42, 2, 0.5, 300);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: rt.texture, side: THREE.DoubleSide, depthTest: false }));
    screen.scale.x = -1; // a mirror image
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.18, 0.02), dark);
    const holder = new THREE.Group(); holder.position.set(side * 0.9, -0.02, -1.0); holder.rotation.y = -side * 0.45;
    frame.position.z = -0.012; add(holder, frame, 23); add(holder, screen, 24); cockpit.add(holder);
    return { side, rt, cam };
  });

  const rig = { camera, cockpit, mirrors, camX: 0, back: 16, fov: 60, wheelAngle: 0, shakeV: new THREE.Vector3(), t: 0, mode: "" };
  // Arriving in the menu or briefing camera (or switching landmark in the briefing) is a glide from wherever the camera was, never a cut.
  const BLEND_INTO = new Set(["menu", "brief"]), blend = { k: 1, pos: new THREE.Vector3(), quat: new THREE.Quaternion() }, lookV = new THREE.Vector3(), fromV = new THREE.Vector3(), toV = new THREE.Vector3(), qTo = new THREE.Quaternion();
  rig.glide = () => { blend.k = 0; blend.pos.copy(camera.position); blend.quat.copy(camera.quaternion); };

  // t = the car being followed { x, z, v, tilt, nitro }, fx = { kick, shake, time, briefT, lm }
  rig.update = function (mode, t, dt, fx) {
    const sm = rate => 1 - Math.exp(-dt * rate);
    const vv = Math.min(t.v, 9);
    if (mode !== rig.mode) { if (rig.mode === "title") camera.updateProjectionMatrix(); if (BLEND_INTO.has(mode) && rig.mode) rig.glide(); rig.mode = mode; } // (the title reel shifts the picture: undo that)
    cockpit.visible = mode === "cockpit";
    let fovGoal = 60;
    const pk = Math.min(1, Math.max(0, (1.25 - camera.aspect) / 0.75)); // 0 on a wide screen .. 1 on a tall phone: the view widens and the camera backs off so the road still fits
    if (mode === "overhead") {
      rig.camX += (t.x * 0.35 - rig.camX) * sm(5);
      camera.position.set(rig.camX, 64 + 38 * pk, t.z + 32 + 14 * pk);
      camera.lookAt(rig.camX, 0, t.z - 25); camera.rotation.z = 0;
      fovGoal = 42;
    } else if (mode === "chase") {
      rig.camX += (t.x - rig.camX) * sm(6); // spring: the camera trails the car across the road...
      const backGoal = (14.5 + vv * 1.25 + (t.nitro ? 3.5 : 0)) * (1 + 0.45 * pk);
      rig.back += (backGoal - rig.back) * sm(2.5); // ...and drops back the faster you go
      const lean = t.x - rig.camX;
      camera.position.set(rig.camX, (5.4 + vv * 0.12) * (1 + 0.5 * pk), t.z + rig.back);
      camera.lookAt(rig.camX * 0.4 + t.x * 0.6, 1.5, t.z - 30);
      camera.rotateZ(-lean * 0.02); // lean into the lane change
      fovGoal = 58 + vv * 2.6 + (t.nitro ? 6 : 0);
    } else if (mode === "cockpit") {
      rig.camX = t.x;
      camera.position.set(t.x, 2.0, t.z + 1.35);
      camera.rotation.set(-0.1, -t.tilt * 0.6, -t.tilt * 0.12, "YXZ");
      fovGoal = 72 + vv * 1.6 + (t.nitro ? 6 : 0);
      rig.wheelAngle += (-t.tilt * 3.2 - rig.wheelAngle) * sm(14);
      wheel.rotation.z = rig.wheelAngle;
      rigDraw(Math.round(t.v * 60), fx.gear, fx.lit);
    } else if (mode === "intro") { // the race start, before the lights: a low sweep past your car from the front, round its side to behind it, handing over
      // to the race camera you use (fx.introTo) so that it arrives exactly where that camera is when the countdown starts
      const T = fx.introT, L = fx.introLen, e = smooth01(T / L), a = Math.PI * (0.82 - 0.66 * e), R = 6.4 + 3.2 * e, hh = 0.55 + 1.5 * e * e;
      fromV.set(t.x + Math.sin(a) * R, hh, t.z + Math.cos(a) * R); lookV.set(t.x, 0.75 + 0.6 * e, t.z - 0.4 - 6 * e * e);
      rig.update(fx.introTo, t, dt, fx); // (the race camera's own pose this frame: running it now also keeps its springs warm, so the hand-over is seamless)
      const w = smooth01((T - (L - INTRO_BLEND)) / INTRO_BLEND), fovTo = camera.fov;
      toV.copy(camera.position); qTo.copy(camera.quaternion);
      camera.position.copy(fromV); camera.lookAt(lookV); camera.position.lerp(toV, w); camera.quaternion.slerp(qTo, w);
      const f = 44 + (fovTo - 44) * w; if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
      cockpit.visible = fx.introTo === "cockpit" && w > 0.97; rig.mode = "intro";
      return;
    } else if (mode === "crash") { // the crash camera: slow-motion orbit round the wreck
      const k = fx.crashT, a = 0.3 + k * 0.75, R = 14 - Math.min(k, 2) * 2.6, hh = 3.6 - Math.min(k, 2) * 0.7;
      camera.position.set(t.x + Math.sin(a) * R, hh, t.z + Math.cos(a) * R); camera.lookAt(t.x, 1, t.z);
      fovGoal = 50;
    } else if (mode === "finish") { // after the line: the camera swings round to the front of the car
      const k = Math.min(1, fx.finishT / 2.6), e = k * k * (3 - 2 * k), a = Math.PI * e + 0.1, R = 13 - 2 * e;
      camera.position.set(t.x + Math.sin(a) * R, 3.4 - 1.0 * e, t.z + Math.cos(a) * R); camera.lookAt(t.x, 1.3, t.z - 2 * (1 - e));
      fovGoal = 55;
    } else if (mode === "photo") { // free camera: position and angles come from the photo-mode controller
      camera.position.copy(fx.photo.pos); camera.rotation.set(fx.photo.pitch, fx.photo.yaw, 0, "YXZ"); fovGoal = fx.photo.fov;
    } else if (mode === "inspect") {
      const q = new URLSearchParams(location.search).get("inspect");
      const zm = +new URLSearchParams(location.search).get("zoom") || 1, o = (q === "front" ? [5, 2.5, -9] : q === "top" ? [0.5, 14, 2] : q === "rear" ? [4, 3, 9] : q === "q34" ? [7.5, 3.4, -7.5] : q === "q34r" ? [-7.5, 3.4, 8] : [9, 3, 1]).map(v => v * zm);
      camera.position.set(t.x + o[0], o[1], t.z + o[2]); camera.lookAt(t.x, 1, t.z - 0.5); fovGoal = 45;
    } else if (mode === "brief") { // the briefing: a low drone flight from just behind the cars along the street to the city's signature landmark, ending on a
      // postcard view of it (low, looking level at it, so it stands against the sky and the city, never down onto flat ground), then a slow drift round it
      const T = 4.2, bt = fx.briefT, e = smooth01(bt / T), lm = fx.lm, lx = lm ? lm.x : t.x + 70, ly = lm ? lm.y : 20, lz = lm ? lm.z : t.z - 380;
      fromV.set(t.x + 2.5, 8.5, t.z + 24); if (lm && lm.cx !== undefined) toV.set(lm.cx, lm.cy, lm.cz); else toV.set(lx * 0.15, 14, lz + Math.max(110, (lm ? lm.rad : 34) * 3.2)); // (the briefing's own landmark says where to end)
      camera.position.lerpVectors(fromV, toV, e); camera.position.y += Math.sin(Math.PI * e) * 3.5; // (a gentle rise and fall on the way)
      if (bt > T && lm) { // afterwards: a slow drift round the landmark, easing to a stop, rising a little
        // (at most about 8 degrees: the camera stays over the plaza, clear of the city round it)
        const a = 0.14 * (1 - Math.exp(-(bt - T) / 7)) * (lm.side || 1), dx = camera.position.x - lx, dz = camera.position.z - lz, c = Math.cos(a), s = Math.sin(a);
        camera.position.x = lx + dx * c - dz * s; camera.position.z = lz + dx * s + dz * c; camera.position.y += 4 * (1 - Math.exp(-(bt - T) / 7));
      }
      const k = smooth01((bt - 0.2) / (T - 0.5)), lyk = lm && lm.ly !== undefined && lm.cx !== undefined ? lm.ly : ly * 0.75; lookV.set(t.x + (lx - t.x) * k, 3.5 + (lyk - 3.5) * k, (t.z - 90) + (lz - (t.z - 90)) * k);
      camera.lookAt(lookV); fovGoal = 48 - 6 * e;
      const tv = Math.tan(rig.fov * Math.PI / 360); // (turn a little so the target sits in the open part of the screen, not behind the city card: left on a wide screen, top on a phone)
      if (fx.briefSX) camera.rotateY(-Math.atan(tv * camera.aspect * fx.briefSX)); if (fx.briefSY) camera.rotateX(-Math.atan(tv * fx.briefSY));
    } else { // menu: a slow, low sweep round the demo race
      rig.camX += (t.x - rig.camX) * sm(3);
      const a = fx.time * 0.18;
      camera.position.set(rig.camX + Math.sin(a) * 11, 3.4 + Math.sin(a * 0.7) * 0.8, t.z + 15 + Math.cos(a) * 3);
      camera.lookAt(rig.camX, 1.4, t.z - 22);
      fovGoal = 55;
    }
    fovGoal *= 1 + 0.38 * pk; // (portrait)
    rig.fov += (fovGoal + fx.kick * 12 - rig.fov) * sm(8);
    if (Math.abs(camera.fov - rig.fov) > 0.01) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
    if (blend.k < 1) { blend.k = Math.min(1, blend.k + dt / 0.45); const k = smooth01(blend.k); camera.position.lerpVectors(blend.pos, camera.position, k); camera.quaternion.slerpQuaternions(blend.quat, camera.quaternion, k); } // (the glide into this camera)
    if (fx.shake > 0.5) { // a hit or a hard landing: smooth waves at three speeds (it rings, then settles), and a little roll
      const s = fx.shake * 0.02, tt = fx.time;
      camera.position.add(rig.shakeV.set((Math.sin(tt * 47.3) + 0.6 * Math.sin(tt * 29.1 + 1.7) + 0.3 * Math.sin(tt * 83.9)) * s, (Math.sin(tt * 53.7 + 0.8) + 0.6 * Math.sin(tt * 31.3 + 2.9) + 0.3 * Math.sin(tt * 91.1)) * s, 0));
      camera.rotateZ((Math.sin(tt * 41.7) + 0.5 * Math.sin(tt * 67.3)) * fx.shake * 0.0009);
    }

    if (mode === "cockpit") for (const m of mirrors) { // aim each mirror camera backwards from beside the car
      m.cam.position.set(t.x + m.side * 1.9, 1.5, t.z + 1.2);
      m.cam.lookAt(t.x + m.side * 3.2, 1.3, t.z + 60);
    }
  };
  return rig;
}
