// High and up: real reflections on the wet road, and on the sea and harbours. The scene is drawn a second time from a camera mirrored below the
// road, at reduced resolution, and the road's material adds that picture on top of itself (stronger at glancing angles, like real water films);
// the water's material (waterMats) mirrors it fully, bent by its ripples, so yachts, quays and the lit city shine in the harbour.
import * as THREE from "three";

export function createReflection(renderer, scene, camera, hideWhileDrawing, materials, waterMats = []) {
  const rt = new THREE.WebGLRenderTarget(512, 256, { type: THREE.HalfFloatType });
  const vcam = new THREE.PerspectiveCamera(), texMat = new THREE.Matrix4(), bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const uniforms = { tReflect: { value: rt.texture }, texMat: { value: texMat }, uWet: { value: 0 }, uWaterK: { value: 0 } }; // (uWaterK: 1 when the picture was drawn this frame)
  const fwd = new THREE.Vector3();

  // put the reflection into a MeshStandardMaterial (only compiled in when USE_PLANAR_REFLECT is defined on it)
  for (const m of [...materials, ...waterMats]) {
    const water = waterMats.includes(m);
    const prevHook = m.onBeforeCompile, prevKey = m.customProgramCacheKey; // (the road material already has its own shader changes: keep them)
    m.onBeforeCompile = shader => {
      if (prevHook && prevHook !== THREE.Material.prototype.onBeforeCompile) prevHook.call(m, shader);
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = `#ifdef USE_PLANAR_REFLECT\nuniform sampler2D tReflect; uniform mat4 texMat; uniform float uWet, uWaterK;\n#endif\n` + shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        #ifdef USE_PLANAR_REFLECT
        {
          vec3 wp = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).xyz; vec4 rc = texMat * vec4(wp, 1.0); vec2 ruv = clamp(rc.xy / rc.w, 0.002, 0.998);
          ${water ? "ruv = clamp(ruv + normal.xy * 0.045, 0.002, 0.998); // (the ripples bend the reflection)" : "ruv.x += (fract(sin(dot(wp.xz, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.003;"}
          vec3 R = texture2D(tReflect, ruv).rgb; float fres = 0.25 + 0.75 * pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
          ${water ? "totalEmissiveRadiance += R * uWaterK * (0.2 + 0.8 * fres) * 0.85; // (open water: a real mirror, strongest at a glancing angle)" : "totalEmissiveRadiance += R * uWet * fres * 0.6; // (a film of water, not a mirror: the asphalt still shows through)"}
        }
        #endif`);
    };
    m.customProgramCacheKey = () => (prevKey && prevKey !== THREE.Material.prototype.customProgramCacheKey ? prevKey.call(m) : "") + (water ? "planar-water" : "planar-reflect");
  }

  return {
    // nothing drawn this frame: nothing stale may show on the road or the water
    idle() { uniforms.uWet.value = 0; uniforms.uWaterK.value = 0; },
    // switch the effect on / off for the road and water materials (changes their shader)
    enable(on) { for (const m of [...materials, ...waterMats]) { if (on) m.defines = { ...(m.defines || {}), USE_PLANAR_REFLECT: "" }; else if (m.defines) delete m.defines.USE_PLANAR_REFLECT; m.needsUpdate = true; } },
    render(wet) {
      uniforms.uWet.value = wet; uniforms.uWaterK.value = 1;
      // a camera mirrored in the road surface (the plane Y = 0)
      camera.getWorldDirection(fwd);
      vcam.position.set(camera.position.x, -camera.position.y, camera.position.z);
      vcam.up.set(0, -1, 0); vcam.lookAt(camera.position.x + fwd.x, -camera.position.y - fwd.y, camera.position.z + fwd.z);
      vcam.projectionMatrix.copy(camera.projectionMatrix); vcam.updateMatrixWorld();
      texMat.copy(bias).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
      const vis = hideWhileDrawing.map(o => o.visible); hideWhileDrawing.forEach(o => { o.visible = false; });
      const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, vcam); renderer.setRenderTarget(null);
      renderer.shadowMap.autoUpdate = au; hideWhileDrawing.forEach((o, i) => { o.visible = vis[i]; });
    },
  };
}
