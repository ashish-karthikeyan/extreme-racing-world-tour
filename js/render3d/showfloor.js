// The Garage floor and turntable top: dark polished surfaces that show a mirror image of the car, the wall and the lights.
// The mirror image is the scene drawn a second time from a camera mirrored below the floor (the same idea as the wet-road reflection in
// reflect.js). One picture is shared by the floor and the turntable; both are plain shaders, so the reflection fades with distance and
// angle (stronger when you look along the floor, like a real polished surface) and costs nothing when it is switched off (Low).
import * as THREE from "three";

const VERT = `varying vec3 vW; varying vec3 vL;
  void main() { vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const FRAG = `uniform sampler2D tRef; uniform mat4 texMat; uniform vec3 accent, base; uniform float uRefl, uFade, uTable, uGlow;
  varying vec3 vW; varying vec3 vL;
  void main() {
    vec3 V = normalize(cameraPosition - vW);
    float cosT = clamp(V.y, 0.0, 1.0), fres = 0.2 + 0.8 * pow(clamp(1.0 - cosT, 0.0, 1.0), 3.0);
    float d = length(vW.xz);
    vec3 col = base;
    col += accent * uGlow * 0.05 * exp(-d * d / 120.0);                                   // a pool of team-coloured light spilling over the floor
    if (uTable > 0.5) {                                                                  // the turntable: brushed rings, grooves and tick marks (so you can see it turn)
      float r = length(vL.xz), a = atan(vL.z, vL.x + 0.0001);
      col *= 0.86 + 0.14 * sin(r * 150.0);
      col += vec3(0.05) * exp(-pow((r - 4.55) / 0.035, 2.0)) + vec3(0.04) * exp(-pow((r - 2.6) / 0.03, 2.0)) + vec3(0.035) * exp(-pow((r - 0.9) / 0.03, 2.0));
      float tk = step(0.8, fract(a * 6.0 / 3.14159265)) * smoothstep(4.78, 4.82, r) * (1.0 - smoothstep(5.2, 5.24, r));
      col += accent * (0.2 + 0.5 * uGlow) * tk;
    } else {                                                                             // the floor: panel seams that fade into the dark
      vec2 q = abs(fract(vW.xz / 7.0 + 0.5) - 0.5) * 7.0;
      float seam = (1.0 - smoothstep(0.0, 0.035, min(q.x, q.y))) * (1.0 - smoothstep(6.0, 30.0, d));
      col += vec3(0.02, 0.022, 0.03) * seam;
    }
    if (uRefl > 0.001) {
      vec4 rc = texMat * vec4(vW, 1.0); vec2 uv = clamp(rc.xy / max(rc.w, 0.0001), 0.002, 0.998);
      vec3 R = texture2D(tRef, uv, 1.1).rgb;
      col += R * uRefl * uFade * fres * (1.0 - 0.8 * smoothstep(5.0, 30.0, d)) * 0.55;
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

export function createFloorMaterials() {
  const shared = { tRef: { value: null }, texMat: { value: new THREE.Matrix4() }, accent: { value: new THREE.Color(1, 0.7, 0.1) }, uRefl: { value: 0 }, uFade: { value: 1 }, uGlow: { value: 1 } };
  const make = (base, table) => new THREE.ShaderMaterial({ uniforms: { ...shared, base: { value: new THREE.Color(base) }, uTable: { value: table } }, vertexShader: VERT, fragmentShader: FRAG });
  return { shared, floor: make(0x07080c, 0), table: make(0x0d0f15, 1) };
}

export function createReflection(renderer, shared) {
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  shared.tRef.value = rt.texture;
  const vcam = new THREE.PerspectiveCamera(), bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1), fwd = new THREE.Vector3();
  return {
    setSize(w, h) { w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); if (rt.width !== w || rt.height !== h) rt.setSize(w, h); },
    // draw `scene` as seen from a camera mirrored in the plane Y = 0; the floor itself (and anything below it) is hidden meanwhile
    render(scene, camera, hide) {
      camera.updateMatrixWorld(); camera.getWorldDirection(fwd);
      vcam.position.set(camera.position.x, -camera.position.y, camera.position.z);
      vcam.up.set(0, -1, 0); vcam.lookAt(camera.position.x + fwd.x, -camera.position.y - fwd.y, camera.position.z + fwd.z);
      vcam.projectionMatrix.copy(camera.projectionMatrix); vcam.updateMatrixWorld();
      shared.texMat.value.copy(bias).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
      const vis = hide.map(o => o.visible); for (const o of hide) o.visible = false;
      const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
      const was = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, vcam); renderer.setRenderTarget(was);
      renderer.shadowMap.autoUpdate = au; hide.forEach((o, i) => { o.visible = vis[i]; });
    },
  };
}
