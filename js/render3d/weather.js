// Weather: rain streaks and splashes, cherry-blossom petals, puddles on the road, drops on the cockpit "windscreen", lightning.
// Rain and petals are drawn entirely on the GPU: each drop's position is worked out in the vertex shader from the clock, so there is no
// per-frame JavaScript per drop and nothing is created while racing.
import * as THREE from "three";

const BOX = new THREE.Vector3(70, 28, 90); // rain falls inside this box that follows the camera

function rand(n) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.random(); return a; }

function makeRain(count) { // each drop is a short line: two vertices (top, bottom)
  const base = new Float32Array(count * 6), thr = new Float32Array(count * 2), end = new Float32Array(count * 2), r = rand(count * 4);
  for (let i = 0; i < count; i++) {
    const x = r[i * 4] * BOX.x, y = r[i * 4 + 1] * BOX.y, z = r[i * 4 + 2] * BOX.z;
    for (let k = 0; k < 2; k++) { base.set([x, y, z], (i * 2 + k) * 3); thr[i * 2 + k] = r[i * 4 + 3]; end[i * 2 + k] = k; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(base, 3)); g.setAttribute("thr", new THREE.BufferAttribute(thr, 1)); g.setAttribute("end", new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, box: { value: BOX }, amount: { value: 0 }, wind: { value: 0 }, color: { value: new THREE.Color(0.75, 0.82, 0.92) } },
    vertexShader: `
      attribute float thr; attribute float end; uniform float time, amount, wind; uniform vec3 cam, box; varying float vA;
      void main() {
        vec3 vel = vec3(-3.0 - wind * 4.0, -46.0, 5.0); // wind pushes the rain sideways and back towards you
        vec3 p = mod(position + vel * time - cam, box) - 0.5 * box + cam;
        p -= normalize(vel) * end * 1.6;                 // the lower end of the streak trails behind
        float on = step(thr, amount);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vA = on * (0.5 - end * 0.35) * (1.0 - smoothstep(25.0, 60.0, length(mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 color; varying float vA; void main() { if (vA < 0.01) discard; gl_FragColor = vec4(color, vA); }`,
  });
  const o = new THREE.LineSegments(g, mat); o.frustumCulled = false; o.renderOrder = 5; return o;
}

function makePoints(count, size, soft = true) { // splashes on the road (rain) or falling petals
  const base = new Float32Array(count * 3), seed = rand(count * 2), r = rand(count * 3);
  for (let i = 0; i < count; i++) base.set([r[i * 3] * BOX.x, r[i * 3 + 1] * BOX.y, r[i * 3 + 2] * BOX.z], i * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(base, 3)); g.setAttribute("seed", new THREE.BufferAttribute(seed.slice(0, count), 1));
  return g;
}

export function createWeather(scene, camera) {
  const rain = makeRain(2600); rain.visible = false; scene.add(rain);

  // splashes: tiny expanding rings on the road, near the camera
  const splashGeo = makePoints(500, 1);
  const splash = new THREE.Points(splashGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, amount: { value: 0 }, scale: { value: 600 } },
    vertexShader: `
      attribute float seed; uniform float time, amount, scale; uniform vec3 cam; varying float vA;
      void main() {
        float ph = fract(time * 2.2 + seed * 7.0), id = fract(seed * 91.7);
        vec3 p = vec3(mod(position.x * 1.3 - cam.x, 36.0) - 18.0 + cam.x, 0.06, mod(position.z - cam.z, 60.0) - 50.0 + cam.z);
        // each splash re-appears in a new random spot every cycle
        p.x += (fract(floor(time * 2.2 + seed * 7.0) * 0.618 + seed) - 0.5) * 10.0; p.z += (fract(floor(time * 2.2 + seed * 7.0) * 0.377 + seed * 3.0) - 0.5) * 12.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vA = step(id, amount) * (1.0 - ph) * (1.0 - smoothstep(20.0, 55.0, -mv.z)) * smoothstep(6.0, 14.0, -mv.z);
        gl_PointSize = min(40.0, (3.0 + ph * 12.0) * scale / max(1.0, -mv.z) * 0.035);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; float ring = smoothstep(0.55, 0.9, d) * (1.0 - smoothstep(0.9, 1.0, d)); if (vA < 0.01 || ring < 0.02) discard; gl_FragColor = vec4(vec3(0.75, 0.82, 0.95) * ring, vA * 0.4); }`,
  }));
  splash.frustumCulled = false; splash.visible = false; scene.add(splash);

  // cherry-blossom petals drifting down
  const petals = new THREE.Points(makePoints(900, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, box: { value: BOX }, amount: { value: 0 }, scale: { value: 600 }, maxPx: { value: 9 } },
    vertexShader: `
      attribute float seed; uniform float time, amount, scale, maxPx; uniform vec3 cam, box; varying float vA; varying float vH;
      void main() {
        vec3 p = position + vec3(sin(time * 0.7 + seed * 40.0) * 2.0 - 6.0 * time, -2.2 * time, 2.0 * time + cos(time * 0.5 + seed * 30.0) * 1.5);
        p = mod(p - cam, box) - 0.5 * box + cam;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        // a petal drifting right past the lens would be drawn hundreds of pixels wide (a big flat white blob): fade petals out close to the camera and cap their size
        vA = step(seed, amount) * (1.0 - smoothstep(30.0, 70.0, -mv.z)) * smoothstep(4.0, 9.0, -mv.z); vH = fract(seed * 13.0);
        gl_PointSize = min(maxPx, (0.35 + seed * 0.25) * scale / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying float vH; void main() { vec2 q = gl_PointCoord - 0.5; if (length(q * vec2(1.0, 1.7)) > 0.5 || vA < 0.01) discard; gl_FragColor = vec4(mix(vec3(1.0, 0.72, 0.84), vec3(1.0, 0.92, 0.95), vH), vA); }`,
  }));
  petals.frustumCulled = false; petals.visible = false; scene.add(petals);

  // puddles: dark mirror-like patches on the road (the simulation scrolls them past)
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.88, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -4 });
  const puddleGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  const makePuddle = () => { const o = new THREE.Mesh(puddleGeo, puddleMat); o.position.y = 0.045; o.receiveShadow = false; return o; };

  // drops on the cockpit "windscreen": a see-through layer in front of the camera, drawn only in the cockpit view
  const dc = document.createElement("canvas"); dc.width = dc.height = 512; const dg = dc.getContext("2d");
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 3 + Math.random() * Math.random() * 15;
    const grd = dg.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); grd.addColorStop(0, "rgba(255,255,255,0.75)"); grd.addColorStop(0.5, "rgba(190,215,240,0.18)"); grd.addColorStop(1, "rgba(120,150,190,0.35)");
    dg.fillStyle = grd; dg.beginPath(); dg.ellipse(x, y, r, r * 1.25, 0, 0, 7); dg.fill();
  }
  const dropTex = new THREE.CanvasTexture(dc); dropTex.wrapS = dropTex.wrapT = THREE.RepeatWrapping; dropTex.colorSpace = THREE.SRGBColorSpace;
  const dropMat = new THREE.MeshBasicMaterial({ map: dropTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0, fog: false, toneMapped: false });
  const drops = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), dropMat); drops.position.z = -0.5; drops.renderOrder = 50; drops.visible = false; camera.add(drops);

  // lightning: a jagged bolt on the skyline plus a flash of light (the simulation says when and how strong: `lightning`)
  const boltGeo = new THREE.BufferGeometry(), boltMat = new THREE.LineBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const bolt = new THREE.Line(boltGeo, boltMat); bolt.frustumCulled = false; bolt.renderOrder = 6; scene.add(bolt);
  let lastBolt = null;

  return {
    puddleBuild: makePuddle,
    drops, bolt,
    // rainAmt 0..1, petals 0..1, quality 0..1 (fewer drops on slower settings)
    update(time, dt, camPos, rainAmt, wind, petalAmt, mode, quality = 1) {
      const rq = rainAmt * quality;
      rain.visible = rq > 0.02; splash.visible = rq > 0.1 && mode !== "overhead"; petals.visible = petalAmt > 0.05;
      if (rain.visible) { const u = rain.material.uniforms; u.time.value = time; u.cam.value.copy(camPos); u.amount.value = rq; u.wind.value = wind; }
      if (splash.visible) { const u = splash.material.uniforms; u.time.value = time; u.cam.value.copy(camPos); u.amount.value = rq; u.scale.value = innerHeight * 0.8; }
      if (petals.visible) { const u = petals.material.uniforms, pr = Math.min(2.6, window.devicePixelRatio || 1); u.time.value = time; u.cam.value.copy(camPos); u.amount.value = petalAmt * quality; u.scale.value = innerHeight * 0.8 * pr; u.maxPx.value = 9 * pr; } // (sizes are in real pixels: scaled by the screen's pixel ratio)
      // droplets on the visor, sliding slowly
      const showDrops = mode === "cockpit" && rainAmt > 0.15;
      drops.visible = showDrops; if (showDrops) { dropMat.opacity = Math.min(0.9, rainAmt * 1.4); dropTex.offset.y -= dt * 0.03; dropTex.offset.x = Math.sin(time * 0.2) * 0.02; }
      // lightning
      const L = lightning;
      if (L && L.t > 0.03) {
        if (L.pts !== lastBolt) { // a new strike: build its path
          lastBolt = L.pts; const v = []; for (const [px, py] of L.pts) v.push((px - W / 2) * 0.9, 95 - py * 0.9, -170);
          boltGeo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); boltGeo.computeBoundingSphere();
        }
        boltMat.opacity = Math.min(1, L.t * 1.4); bolt.position.set(camPos.x, 0, camPos.z);
      } else boltMat.opacity = 0;
      return L && L.t > 0.03 ? L.t : 0; // the flash strength, for the renderer to light the scene with
    },
  };
}
