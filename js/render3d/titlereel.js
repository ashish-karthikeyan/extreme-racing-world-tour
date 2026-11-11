// The title screen's reel: your car racing through the city at night (driven by the autopilot in sim/gameplay.js), filmed like the best moment
// of a racing game trailer. Nine shots of about two seconds, cut with a quick dip to black:
//   flyby   a low camera at the side of the road: the car flies past it          sidepod  sliding along the livery, riding with the car
//   front   a long lens from up the road, looking back as it weaves through traffic wheel    gliding past the spinning front wheel
//   track   a low tracking shot beside it, light streaks rushing past behind     nose     the front wing from low down, pushing in
//   rear    rear three-quarter, the rear wing glowing red                         helmet   the driver's helmet and halo, close
//   crane   rising up behind it, the road, the traffic and the skyline ahead
// Shots that ride with the car are written in the car's own frame (nose to -z, the camera on its left; m = -1 mirrors to its right). Every shot
// is framed in the free area beside the title text (studioRects.title): a projection shift moves the subject there and a wider lens sizes it.
// A shot whose camera would end up inside a vehicle is skipped (and one that is about to is cut short), so the camera never clips through traffic.
// On Low (simple lighting, no post-processing) close-ups look flat and blocky, and a dip to black would leave the neon floating in the dark,
// so Low plays only the four wide shots (low: true), each slower and longer, with straight cuts. If the frame rate still can't keep up, Low
// settles on one slow shot that never cuts: high behind the car, drifting gently from side to side (CALM).
import * as THREE from "three";

const lerp = (a, b, t) => a + (b - a) * t, smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
// p = the pose to fill: car-frame position / look (or world, for road shots), fov; u = 0..1 through the shot; c = { helmet, vw (road speed, units/s), T }
const SHOTS = [
  { name: "flyby", dur: 2.6, road: true, low: true, ap: 0.0016, mb: [0.0025, 0] },  // (placed by the road: see roadShot)
  { name: "sidepod", dur: 2.2, ap: 0.0065, mb: [0.004, 0], set(p, u) { const z = lerp(-0.5, 2.2, u); p.pos.set(-3.1, 1.02, z - 0.7); p.look.set(-1.17, 0.78, z + 0.2); p.fov = 30; } },
  { name: "front", dur: 2.6, low: true, ap: 0.0012, flare: true, follow: true, set(p, u) { p.pos.set(0, lerp(3.1, 2.7, u), lerp(-27, -24, u)); p.look.set(0, 0.9, -1); p.fov = 19; } },
  { name: "wheel", dur: 2, ap: 0.0045, mb: [0.005, 0], set(p, u) { p.look.set(-1.45, 0.7, -2.6); p.pos.set(lerp(-3.9, -3.5, u), lerp(0.55, 0.75, u), lerp(-5.2, -1.3, u)); p.fov = 32; } },
  { name: "track", dur: 2.3, ap: 0.0014, mb: [0.007, 0], streaks: true, nitro: true, set(p, u) { const z = lerp(-4.2, 4.2, u); p.pos.set(-5.6, 0.62, z); p.look.set(0, 0.72, z * 0.8); p.fov = 42; } },
  { name: "nose", dur: 2.1, ap: 0.003, set(p, u) { p.look.set(0, 0.42, -3.7); p.pos.set(lerp(1.0, 0.45, u), 0.34, lerp(-9.6, -7.4, u)); p.fov = 32; } },
  { name: "rear", dur: 2.2, low: true, ap: 0.002, rear: true, set(p, u) { p.look.set(0, 1.25, 3.4); const a = lerp(2.62, 2.42, u), e = lerp(0.16, 0.1, u), d = lerp(8.4, 7.6, u); p.pos.set(p.look.x - Math.sin(a) * Math.cos(e) * d, p.look.y + Math.sin(e) * d, p.look.z - Math.cos(a) * Math.cos(e) * d); p.fov = 30; } },
  { name: "helmet", dur: 2, ap: 0.006, set(p, u, c) { const h = c.helmet; p.look.copy(h); p.pos.set(h.x - lerp(1.8, 1.45, u), h.y + lerp(1.05, 0.9, u), h.z - lerp(1.6, 1.1, u)); p.fov = 30; } },
  { name: "crane", dur: 2.8, low: true, ap: 0, follow: true, set(p, u) { const k = smooth(u); p.pos.set(0, lerp(1.6, 8.5, k), lerp(9, 15, k)); p.look.set(0, lerp(1.4, 4, k), -60); p.fov = 40; } },
];
// Low's fallback: one shot for as long as the title is up, above the roofs (so no vehicle can ever come into the lens)
const CALM = [{ name: "calm", dur: 1e9, ap: 0, set(p, u, c) { const a = Math.sin(c.T * 0.11), b = Math.sin(c.T * 0.07 + 1); p.pos.set(1.8 * a, 3.5 + 0.3 * b, 11.5 + 1.2 * b); p.look.set(0.5 * a, 1.2, -32); p.fov = 34; } }]; // (it rides with the car across the road, so a lane change never takes it out of shot)
const LOW_SHOTS = SHOTS.filter(s => s.low), LOW_SLOW = 1.6; // (Low: each shot this much longer, its camera moving this much slower)
const CALM_FT = 1 / 45, CALM_AFTER = 2; // (Low: frames averaging slower than ~45 fps for 2 s: the calm shot from then on)
const DIP = 0.14, FADE_IN = 0.45; // (seconds: the dip to black between shots; the fade up when the title appears)
const TT = new URLSearchParams(location.search).get("tt"), ONLY = new URLSearchParams(location.search).get("shot"), FORCE_CALM = new URLSearchParams(location.search).has("calm"); // testing: &shot=NAME plays only that shot, &tt=SECONDS holds it at that moment (for screenshots), &calm plays Low's fallback shot straight away

export function createTitleReel(scene) {
  // light streaks for the tracking shot: thin glowing bars rushing past on the far side of the car
  const streakMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.86, 0.66).multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const streakMat2 = streakMat.clone(); streakMat2.color.setRGB(0.55, 0.8, 1.6);
  const streaks = new THREE.Group(), geo = new THREE.BoxGeometry(1, 1, 1); streaks.visible = false; scene.add(streaks);
  const rnd = (i, a, b) => a + ((Math.sin(i * 12.9898 + a * 78.2) * 43758.5453) % 1 + 1) % 1 * (b - a);
  for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(geo, i % 3 ? streakMat : streakMat2); s.userData.x = rnd(i, 7, 26); s.userData.z = rnd(i + 40, -40, 40); s.position.y = rnd(i + 80, 0.35, 5.5); s.scale.set(0.07, rnd(i + 9, 0.035, 0.1), rnd(i + 3, 6, 17)); s.frustumCulled = false; streaks.add(s); }

  const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30 }, wPos = new THREE.Vector3(), wLook = new THREE.Vector3(), v = new THREE.Vector3();
  const st = { t: 0, i: 0, shotT: 0, m: 1, camX: 0, flyZ: 0, flyX: 0, D0: 0, list: SHOTS, forceCut: false, first: true, slow: 1, ft: 1 / 60, slowT: 0, calm: FORCE_CALM };
  const out = { expo: 1, mb: [0, 0], flare: { x: 0.5, y: 0.5, a: 0 }, focus: 10, ap: 0, rear: false, nitro: false, key: new THREE.Vector3(), shot: "" };
  const shot = () => st.list[st.i % st.list.length], durOf = s => s.dur * st.slow;

  // where the camera of shot s would be (world) at u, for the car at car (x, z); also fills pose / wPos / wLook
  function place(s, u, car, c) {
    if (s.road) { // the flyby: a camera standing at the edge of the road, low, the car passing it at ~55% of the shot
      const z = TT !== null ? car.z + c.vw * (st.shotT - 0.55 * durOf(s)) : st.flyZ + (car.D - st.D0); 
      wPos.set(st.flyX, 0.55, z); wLook.set(car.x, 0.75, car.z - 1.6); pose.fov = 30; return; // (it stands still on the road; testing with tt: where it would be at that moment)
    }
    s.set(pose, u, c);
    const cx = s.follow ? st.camX : car.x;
    wPos.set(cx + st.m * pose.pos.x, pose.pos.y, car.z + pose.pos.z); // (st.m = 1: the camera on the car's left, as written; -1: mirrored to its right)
    wLook.set((s.follow ? lerp(cx, car.x, 0.6) : cx) + st.m * pose.look.x, pose.look.y, car.z + pose.look.z);
  }
  // is that spot inside (or within pad of) a vehicle, now or over the next `ahead` seconds? (vehicles never change lane; they close at their own speed)
  function blocked(x, y, z, ahead, ctx) {
    if (y > 2.9) return false; // (above the roofs)
    for (const o of ctx.traffic()) {
      if (Math.abs(o.x - x) > o.hw + 0.9) continue;
      const z1 = o.z + o.vz * ahead; if (z > Math.min(o.z, z1) - o.hl - 1.2 && z < Math.max(o.z, z1) + o.hl + 1.2) return true;
    }
    return false;
  }
  // would a vehicle in the outside lane on that side come within 26 units of a camera standing by the road there, during the shot? (to the camera
  // it drives on at its own speed: the road stands still for it)
  function laneNearCamera(side, dur, c, ctx) {
    for (const o of ctx.traffic()) {
      if (Math.abs(o.x - side * 10.67) > 2) continue;
      const rel0 = o.z - st.flyZ, rel1 = rel0 - (c.vw - o.vz) * dur; // (relative to the camera, from the start of the shot to its end)
      if (Math.max(rel0, rel1) > -26 && Math.min(rel0, rel1) < 26) return true;
    }
    return false;
  }
  function start(car, c, ctx) { // begin the next usable shot
    for (let n = 0; n < st.list.length * 2; n++) { // (twice round at most: if nothing is usable it stays on the last one)
      if (!st.first || n > 0) st.i = (st.i + 1) % st.list.length;
      st.first = false; if (ONLY && shot().name !== ONLY && st.list.some(s => s.name === ONLY)) continue;
      const s = shot(); st.shotT = 0; st.camX = car.x; st.m = car.lane === 0 ? -1 : car.lane === 2 ? 1 : Math.random() < 0.5 ? -1 : 1; // (the side with more road)
      if (s.road) { // the side of the road the car is on (either, from the middle lane), unless a vehicle in that outside lane would pass right in front of the lens
        st.D0 = car.D; st.flyZ = car.z - 0.55 * Math.max(8, c.vw) * durOf(s);
        const want = car.lane === 0 ? -1 : car.lane === 2 ? 1 : st.m;
        for (const side of [want, -want]) if (!laneNearCamera(side, durOf(s), c, ctx)) { st.flyX = side * 14.4; return; }
        continue;
      }
      let ok = true; for (const u of [0, 0.5, 1]) { place(s, u, car, c); if (blocked(wPos.x, wPos.y, wPos.z, 0.7, ctx)) { ok = false; break; } } // (it rides with the car, and the autopilot moves out of the way of anything ahead: a short look ahead is enough; a cut-away below covers the rest)
      if (ok) return;
    }
  }

  return {
    get shot() { return shot().name; }, get count() { return SHOTS.length; },
    force(i) { st.i = i; st.first = false; st.list = SHOTS; st.shotT = 0.5; st.t = 1; st.forceWarm = true; }, // (warming up: show shot i, with its effects, on the next update)
    reset() { st.t = 0; st.i = 0; st.first = true; st.forceCut = true; },
    cut() { st.forceCut = true; }, // (the sim looped the title's stretch of road: change shot on this very frame)
    // car = { x, z, D (world distance), lane, obj }; ctx = { low, capped (a frame-rate cap, not our work, sets the pace), aspect, rect, traffic() -> [{ x, z, hw, hl, vz }], vw }; writes the camera and returns `out`
    update(dt, car, ctx, camera) {
      const c = { helmet: helmetOf(car.obj), vw: ctx.vw, T: st.t };
      if (ctx.low && !st.calm && st.t > FADE_IN) { st.ft += (Math.min(dt, 0.2) - st.ft) * 0.05; st.slowT = st.ft > CALM_FT && !ctx.capped ? st.slowT + dt : 0; if (st.slowT > CALM_AFTER) { st.calm = true; st.forceCut = true; } } // (Low: is it keeping up?)
      const list = !ctx.low ? SHOTS : st.calm ? CALM : LOW_SHOTS; if (list !== st.list) { st.list = list; st.forceCut = true; }
      st.slow = ctx.low ? LOW_SLOW : 1;
      if (st.forceWarm) { st.forceWarm = false; st.forceCut = false; if (shot().road) { st.flyX = 14.4; st.D0 = car.D; st.flyZ = car.z - 10; } } // (warming up: this shot as it is)
      else if (st.forceCut) { st.forceCut = false; start(car, c, ctx); }
      st.t += dt; st.shotT = TT !== null ? Math.min(+TT, durOf(shot()) - 0.01) : st.shotT + dt;
      if (st.shotT >= durOf(shot())) start(car, c, ctx);
      const s = shot(), u = st.shotT / durOf(s);
      st.camX += (car.x - st.camX) * (1 - Math.exp(-dt * 2.5)); // (the long-lens shots follow the car across the road a little behind it: you see it weave)
      place(s, u, car, c);
      if (!s.road && st.shotT > DIP && blocked(wPos.x, wPos.y, wPos.z, 0.25, ctx)) { start(car, c, ctx); place(shot(), 0, car, c); } // (something is about to drive into the camera: cut away)
      // the free area beside the text: a wider lens for a smaller area, and a shift that centres the subject in it
      const r = ctx.rect, fz = Math.max(0.25, Math.min(r.bottom - r.top, (r.right - r.left) * ctx.aspect / 1.6));
      camera.position.copy(wPos); camera.up.set(0, 1, 0); camera.lookAt(wLook);
      camera.fov = Math.min(70, 2 * Math.atan(Math.tan(pose.fov * Math.PI / 360) / fz) * 180 / Math.PI); camera.aspect = ctx.aspect; camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8] = -(r.left + r.right - 1); camera.projectionMatrix.elements[9] = -(1 - (r.top + r.bottom)); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      camera.updateMatrixWorld();
      // this frame's effects
      const tt = durOf(shot()), k = TT !== null || ctx.low ? 1 : st.t < FADE_IN ? smooth(st.t / FADE_IN) : smooth(Math.min(st.shotT, tt - st.shotT) / DIP); // (Low: straight cuts)
      out.shot = s.name; out.expo = k; out.ap = s.ap; out.focus = wPos.distanceTo(v.set(car.x, 0.8, car.z));
      if (s.name === "helmet" || s.name === "wheel" || s.name === "sidepod" || s.name === "nose") out.focus = wPos.distanceTo(wLook);
      out.mb[0] = s.mb && !ctx.low ? s.mb[0] * k : 0; out.mb[1] = 0; // (across the screen: the road rushing past)
      out.rear = !!s.rear; out.nitro = !!s.nitro;
      if (s.flare) { v.set(car.x, 0.7, car.z - 4.2).project(camera); out.flare.x = v.x * 0.5 + 0.5; out.flare.y = v.y * 0.5 + 0.5; out.flare.a = k * (0.3 + 0.1 * Math.sin(st.t * 4.3)); } else out.flare.a = 0;
      out.key.set(wPos.x + 2.5 * st.m, wPos.y + 3, wPos.z + 1); // (the key light rides with the camera)
      // the light streaks (tracking shot): on the far side of the car from the camera, rushing backwards much faster than the road
      streaks.visible = !!s.streaks && !ctx.low;
      if (streaks.visible) { streakMat.opacity = streakMat2.opacity = k * 0.9; for (const b of streaks.children) { b.userData.z += dt * 95; if (b.userData.z > 40) b.userData.z -= 80; b.position.set(car.x - st.m * b.userData.x, b.position.y, car.z + b.userData.z); } }
      return out;
    },
    hide() { streaks.visible = false; },
  };
}

// where the helmet sits in the car's own frame (for the helmet close-up), measured once per car model
const helmets = new WeakMap(), box = new THREE.Box3(), hv = new THREE.Vector3(), DEFAULT_HELMET = new THREE.Vector3(0, 1.25, 0.2);
function helmetOf(obj) {
  if (!obj || !obj.userData.helmet) return DEFAULT_HELMET;
  let h = helmets.get(obj); if (h) return h;
  obj.updateMatrixWorld(true); box.setFromObject(obj.userData.helmet).getCenter(hv);
  h = new THREE.Vector3(hv.x - obj.position.x, hv.y - obj.position.y, hv.z - obj.position.z); helmets.set(obj, h); return h;
}
