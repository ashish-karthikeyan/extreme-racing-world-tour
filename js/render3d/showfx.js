// Garage effects: the confetti shower and shock ring when you buy a car, and the padlock on a locked one.
import * as THREE from "three";

// Confetti: one InstancedMesh of small flat flakes, fired from two cannons beside the car and tumbling down. Nothing is allocated per frame.
export function createConfetti(scene, N = 190) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.36, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), N);
  mesh.frustumCulled = false; mesh.visible = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), rot = new Float32Array(N * 3), spin = new Float32Array(N * 3), life = new Float32Array(N), col = new THREE.Color(), dummy = new THREE.Object3D();
  for (let i = 0; i < N; i++) mesh.setColorAt(i, col.setRGB(1, 1, 1));
  let live = 0;
  const r = (a, b) => a + Math.random() * (b - a);
  return {
    mesh,
    burst(hexes) {
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1, k = i * 3;
        pos[k] = side * r(6, 8); pos[k + 1] = r(0.6, 1.6); pos[k + 2] = r(-6, 1);
        vel[k] = -side * r(3, 9); vel[k + 1] = r(9, 17); vel[k + 2] = r(-3, 4.5);
        for (let j = 0; j < 3; j++) { rot[k + j] = r(0, 6.28); spin[k + j] = r(-9, 9); }
        life[i] = r(2.6, 3.8); mesh.setColorAt(i, col.set(hexes[i % hexes.length]).multiplyScalar(r(1.1, 1.8)));
      }
      mesh.instanceColor.needsUpdate = true; mesh.visible = true; live = N;
    },
    update(dt) {
      if (!live) return; live = 0;
      for (let i = 0; i < N; i++) {
        const k = i * 3; let s = 0;
        if (life[i] > 0) {
          life[i] -= dt; live++; vel[k + 1] -= 15 * dt; const drag = Math.exp(-1.3 * dt); vel[k] *= drag; vel[k + 2] *= drag; vel[k + 1] *= Math.exp(-0.5 * dt);
          pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
          if (pos[k + 1] < 0.03) { pos[k + 1] = 0.03; vel[k] = vel[k + 1] = vel[k + 2] = 0; spin[k] = spin[k + 1] = spin[k + 2] = 0; } // landed
          for (let j = 0; j < 3; j++) rot[k + j] += spin[k + j] * dt;
          s = Math.min(1, life[i] * 2.5);
        }
        dummy.position.set(pos[k], pos[k + 1], pos[k + 2]); dummy.rotation.set(rot[k], rot[k + 1], rot[k + 2]); dummy.scale.setScalar(s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true; if (!live) mesh.visible = false;
    },
  };
}

// A ring of light that expands across the floor (the "pow" when you buy a car or an upgrade).
export function createShockRing(scene) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96).rotateX(-Math.PI / 2), mat); ring.position.y = 0.04; ring.visible = false; scene.add(ring);
  let t = 9;
  return {
    fire(color) { mat.color.copy(color).multiplyScalar(3); t = 0; ring.visible = true; },
    update(dt) { if (t > 1) return; t += dt / 0.7; const e = 1 - (1 - Math.min(1, t)) ** 3; ring.scale.setScalar(2 + e * 22); mat.opacity = (1 - Math.min(1, t)) * 0.9; if (t >= 1) ring.visible = false; },
  };
}

// The padlock shown over a locked car: a rounded body, a shackle and a keyhole, always facing the camera, drawn on top of the dark silhouette.
export function makeLock() {
  const g = new THREE.Group(), glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.88).multiplyScalar(0.95), depthTest: false, transparent: true, toneMapped: false });
  const hole = new THREE.MeshBasicMaterial({ color: 0x07080c, depthTest: false, transparent: true });
  const w = 1.5, h = 1.1, rad = 0.2, s = new THREE.Shape();
  s.moveTo(-w / 2 + rad, -h / 2); s.lineTo(w / 2 - rad, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rad); s.lineTo(w / 2, h / 2 - rad); s.quadraticCurveTo(w / 2, h / 2, w / 2 - rad, h / 2);
  s.lineTo(-w / 2 + rad, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rad); s.lineTo(-w / 2, -h / 2 + rad); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rad, -h / 2);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 10 }), glow); body.position.z = -0.1;
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.12, 10, 28, Math.PI), glow); shackle.position.y = h / 2 - 0.02;
  const legs = [-1, 1].map(x => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), glow); l.position.set(x * 0.42, h / 2 - 0.1, 0); return l; });
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), hole), slot = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.34), hole); dot.position.set(0, 0.1, 0.17); slot.position.set(0, -0.14, 0.17);
  g.add(body, shackle, ...legs, dot, slot); g.traverse(o => { o.renderOrder = 20; }); g.userData.mats = [glow, hole];
  return g;
}
