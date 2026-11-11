// Night lighting extras: street lights pooling on the road, glowing lamp heads, headlight beams that cut through the dark.
import * as THREE from "three";
import { roadHalf } from "./mapping.js";

function radialTex(inner = "rgba(255,214,150,0.9)", mid = "rgba(255,190,110,0.28)") {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, inner); grd.addColorStop(0.35, mid); grd.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createNight(scene) {
  const CAP = 90, dummy = new THREE.Object3D();

  // light pools on the tarmac under each street lamp
  const poolMat = new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: true, polygonOffset: true, polygonOffsetFactor: -3 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, CAP);
  pools.frustumCulled = false; pools.count = 0; pools.renderOrder = 2; scene.add(pools);

  // the glowing lamp heads (and a halo round each, which bloom later turns into a proper glow)
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(1.6), toneMapped: false, fog: true, transparent: true, opacity: 0 });
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6), headMat, CAP);
  heads.frustumCulled = false; heads.count = 0; scene.add(heads);
  const haloMat = new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,230,170,0.95)", "rgba(255,200,120,0.25)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: true });
  const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), haloMat, CAP);
  halos.frustumCulled = false; halos.count = 0; halos.renderOrder = 3; scene.add(halos);

  // headlight beam: a soft cone whose edges fade out
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { k: { value: 0 }, color: { value: new THREE.Color(1.0, 0.93, 0.75) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vT; void main() { vT = clamp(-position.z / 38.0, 0.0, 1.0); vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float k; uniform vec3 color; varying vec3 vN; varying vec3 vV; varying float vT;
      void main() { float f = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0001, 1.0), 1.6); float a = f * pow(clamp(1.0 - vT, 0.0001, 1.0), 1.4) * 0.17 * k; /* (clamped: pow of a negative number is NaN, which turns the whole screen black through the bloom) */ if (a < 0.004) discard; gl_FragColor = vec4(color * a * 2.0, a); }`,
  });
  const makeBeam = () => { // returns a mesh that lights up the road ahead of a car (child of the car, which faces -Z)
    const g = new THREE.ConeGeometry(5.5, 38, 20, 1, true); g.translate(0, -19, 0); g.rotateX(Math.PI / 2); // the tip is at the origin, the wide end 38 units ahead (-Z)
    const base = new THREE.Mesh(g, beamMat); base.position.set(0, 1.0, -3.6); base.renderOrder = 4; base.frustumCulled = false;
    return base;
  };

  // real lights from the player's car, so the road and other cars ahead are truly lit
  const spots = [-1, 1].map(() => { const s = new THREE.SpotLight(0xfff0d0, 0, 90, 0.5, 0.65, 1.2); s.castShadow = false; scene.add(s); scene.add(s.target); return s; });

  const RH = roadHalf();
  return {
    makeBeam, beamMat,
    // night 0..1; lamps = [{ hx, hy (the lamp head), z, side }]; player = car { x, z, yaw, alive } or null
    update(night, lamps, nLamps, player) {
      const on = night > 0.04;
      pools.visible = heads.visible = halos.visible = on;
      if (on) {
        let n = 0;
        for (let li = 0; li < nLamps; li++) { const l = lamps[li];
          if (n >= CAP) break;
          dummy.rotation.set(0, 0, 0);
          dummy.position.set(l.side * (RH - 4.5), 0.07, l.z); dummy.scale.set(15, 1, 15); dummy.updateMatrix(); pools.setMatrixAt(n, dummy.matrix);
          dummy.position.set(l.hx, l.hy, l.z); dummy.scale.setScalar(l.hy < 8 ? 0.7 : 1); dummy.updateMatrix(); heads.setMatrixAt(n, dummy.matrix); // (a Victorian lamp's lantern sits lower and is smaller)
          dummy.position.set(l.hx, l.hy, l.z); dummy.scale.setScalar(l.hy < 8 ? 3.4 : 4.2); dummy.updateMatrix(); halos.setMatrixAt(n, dummy.matrix);
          n++;
        }
        pools.count = heads.count = halos.count = n;
        pools.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = true;
        poolMat.opacity = Math.min(0.34, night * 0.4); headMat.opacity = Math.min(1, night * 1.5); haloMat.opacity = Math.min(0.5, night * 0.5);
      }
      beamMat.uniforms.k.value = night;
      spots.forEach((s, i) => {
        const live = on && player && player.alive;
        s.intensity = live ? 900 * night : 0;
        if (!live) return;
        const side = i ? 1 : -1, c = Math.cos(player.yaw), sn = Math.sin(player.yaw);
        s.position.set(player.x + side * 1.0 * c, 1.2, player.z - 3.4);
        s.target.position.set(player.x + side * 1.0 * c - sn * 30, 0, player.z - 34);
      });
    },
  };
}
