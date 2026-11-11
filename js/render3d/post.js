// Post-processing: the finished 3D picture goes through bloom, speed blur, chromatic aberration (nitro), a per-city colour grade,
// vignette, heat shimmer, a lens flare, depth of field (menus / photo mode), tone mapping and anti-aliasing.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

// Everything that looks like a "lens" or "grade" lives in one shader so it costs a single full-screen pass.
const FXShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, aspect: { value: 1.7 },
    blur: { value: 0 }, aberr: { value: 0 }, vig: { value: 0.3 }, heat: { value: 0 },
    sat: { value: 1 }, contrast: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) }, lift: { value: 0 }, shTint: { value: new THREE.Color(1, 1, 1) }, hiTint: { value: new THREE.Color(1, 1, 1) },
    flarePos: { value: new THREE.Vector2(0.5, 0.5) }, flareAmt: { value: 0 }, flareCol: { value: new THREE.Color(1, 0.9, 0.7) },
    fmode: { value: 0 }, grain: { value: 0 }, mdir: { value: new THREE.Vector2(0, 0) }, speedK: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, aspect, blur, aberr, vig, heat, sat, contrast, lift, flareAmt, grain, speedK; uniform int fmode;
    uniform vec3 tint, flareCol, shTint, hiTint; uniform vec2 flarePos, mdir; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv, c = uv - 0.5;
      if (heat > 0.0) { // heat shimmer: the air wobbles above the hot road
        float band = smoothstep(0.0, 0.3, uv.y) * (1.0 - smoothstep(0.3, 0.62, uv.y));
        uv.x += sin(uv.y * 95.0 + time * 4.0) * 0.0016 * heat * band; uv.y += cos(uv.x * 70.0 + time * 3.0) * 0.0007 * heat * band;
      }
      vec2 off = c * aberr; vec3 col = vec3(0.0);
      if (dot(mdir, mdir) > 1e-8) { // light motion blur along the camera's movement (the title reel's moving shots)
        for (int i = 0; i < 7; i++) { float t = float(i) / 6.0 - 0.5; col += texture2D(tDiffuse, uv + mdir * t).rgb; }
        col /= 7.0;
      } else if (blur > 0.002) { // radial blur from the centre: speed
        const int N = 7;
        for (int i = 0; i < N; i++) { float t = float(i) / float(N - 1); vec2 u = uv - c * blur * t * 0.14;
          col += vec3(texture2D(tDiffuse, u + off).r, texture2D(tDiffuse, u).g, texture2D(tDiffuse, u - off).b); }
        col /= float(N);
      } else col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      // lens flare when looking into the sun
      if (flareAmt > 0.001) {
        vec2 d = (flarePos - 0.5) * vec2(aspect, 1.0), p = (uv - 0.5) * vec2(aspect, 1.0); vec3 fl = vec3(0.0);
        fl += flareCol * exp(-length(p - d) * 5.0) * 0.55;
        for (int i = 1; i <= 4; i++) { float k = -0.35 * float(i); vec2 g = d * k; fl += flareCol * (0.5 + 0.1 * float(i)) * smoothstep(0.09 + 0.02 * float(i), 0.0, length(p - g)) * 0.12; }
        fl += flareCol * smoothstep(0.012, 0.0, abs(p.y - d.y)) * exp(-abs(p.x - d.x) * 2.5) * 0.3; // the horizontal streak
        col += fl * flareAmt;
      }
      // grade: saturation, contrast, tint, lift, then split toning: the shadows and the highlights each get their own tint (each city's look:
      // warm sun and teal shade on the Riviera, cool and grey in London, magenta night in Las Vegas)
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, sat); col = (col - 0.18) * contrast + 0.18; col = col * tint + lift;
      col *= mix(shTint, hiTint, smoothstep(0.03, 0.75, l));
      if (fmode == 1) { l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = vec3(l) * 1.1; col = (col - 0.18) * 1.25 + 0.18; }                       // noir
      else if (fmode == 2) { col = mix(col, vec3(dot(col, vec3(0.33))), 0.25) * vec3(1.12, 0.98, 0.78) + 0.015; }                                      // vintage
      else if (fmode == 3) { l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, 1.6); }                                               // vivid
      else if (fmode == 4) { col *= vec3(0.82, 0.95, 1.2); }                                                                                           // cool
      if (speedK > 0.001) { // speed lines: thin streaks rushing outwards near the edges of the picture, each in its own direction and rhythm
        vec2 p = c * vec2(aspect, 1.0); float ang = atan(p.y, p.x), r = length(p), lane = floor(ang * 38.0), rnd = hash(vec2(lane, 3.7));
        float streak = step(0.72, rnd) * smoothstep(0.42, 0.8, r) * (1.0 - smoothstep(0.04, 0.12, abs(fract(ang * 38.0) - 0.5)));
        streak *= smoothstep(0.0, 0.3, fract(r * 2.2 - time * (2.6 + rnd * 2.0) + rnd * 7.0)) * (1.0 - smoothstep(0.3, 0.55, fract(r * 2.2 - time * (2.6 + rnd * 2.0) + rnd * 7.0)));
        col += vec3(0.85, 0.92, 1.0) * streak * speedK * 0.28;
      }
      float v = smoothstep(0.9, 0.2, length(c * vec2(aspect * 0.85, 1.0))); col *= mix(1.0 - vig, 1.0, v); // vignette
      col += (hash(uv * 900.0 + time) - 0.5) * grain;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

// One bad pixel (NaN or infinity) in the HDR picture would be smeared over the whole screen by the bloom blur, which shows as the screen
// flashing black. This pass sits in front of the bloom and replaces such pixels with the average of their good neighbours, and caps
// absurdly bright ones.
const CleanShader = {
  uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, debug: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 texel; uniform float debug; varying vec2 vUv;
    bool bad1(float x) { return (floatBitsToUint(x) & 0x7F800000u) == 0x7F800000u; } // exponent all ones = NaN or infinity (checked on the raw bits, so the compiler cannot optimise it away)
    bool bad(vec3 c) { return bad1(c.r) || bad1(c.g) || bad1(c.b); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c.rgb)) {
        vec3 s = vec3(0.0); float n = 0.0;
        for (int i = 0; i < 4; i++) { vec2 o = vec2(i < 2 ? (i == 0 ? 2.0 : -2.0) : 0.0, i >= 2 ? (i == 2 ? 2.0 : -2.0) : 0.0) * texel; vec3 t = texture2D(tDiffuse, vUv + o).rgb; if (!bad(t)) { s += t; n += 1.0; } }
        c.rgb = debug > 0.5 ? vec3(40.0, 0.0, 40.0) : n > 0.0 ? s / n : vec3(0.0); // (debug: bad pixels shown in magenta)
      }
      gl_FragColor = vec4(clamp(c.rgb, vec3(0.0), vec3(64.0)), 1.0);
    }`,
};

// Ambient occlusion (High / Ultra): GTAO darkens the creases where things meet (under cars, along kerbs, at the foot of buildings), so
// everything sits in the scene instead of floating. It needs a second render of the scene's depth and normals, so it is built only when
// a preset asks for it, at a fraction of the screen's resolution, and only near the camera (far away it would only darken the haze).
function makeAO(scene, camera, w, h) {
  const ao = new GTAOPass(scene, camera, w, h);
  ao.updateGtaoMaterial({ radius: 2.6, distanceExponent: 1.5, thickness: 2.0, scale: 1.15, samples: 12, distanceFallOff: 1.0 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  ao.blendIntensity = 0.85;
  ao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)));
  // the depth / normal pre-pass must skip see-through effects (headlight cones, light pools, halos, glass bubbles, the sky): they would cast AO
  const cache = new Map();
  ao.overrideVisibility = () => { ao.scene.traverse(o => { cache.set(o, o.visible); const m = o.material; if (o.isPoints || o.isLine || o.isSprite || (m && !Array.isArray(m) && (m.transparent || m.depthWrite === false || m.blending === THREE.AdditiveBlending))) o.visible = false; }); };
  ao.restoreVisibility = () => { for (const [o, v] of cache) o.visible = v; cache.clear(); };
  return ao;
}

const BLACK_TEST = typeof location !== "undefined" && location.search.includes("blacktest");
export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }); // 4x multisampling inside the pipeline
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  const bokeh = new BokehPass(scene, camera, { focus: 18, aperture: 0.0012, maxblur: 0.012 }); bokeh.enabled = false;
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.55, 1.0);
  const clean = new ShaderPass(CleanShader);
  const fx = new ShaderPass(FXShader);
  const output = new OutputPass();
  const smaa = new SMAAPass(size.x, size.y);
  const fxaa = new ShaderPass(FXAAShader); fxaa.enabled = false;
  [renderPass, bokeh, clean, bloom, fx, output, smaa, fxaa].forEach(p => composer.addPass(p));
  const u = fx.uniforms;
  let ao = null, aoScale = 0, px = { w: size.x, h: size.y };
  const aoSize = () => { if (ao) ao.setSize(Math.max(64, Math.round(px.w * aoScale)), Math.max(64, Math.round(px.h * aoScale))); };
  const quadScene = new THREE.Scene(), quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quadScene.add(quadMesh);
  const api = {
    composer, renderPass, bokeh, clean, bloom, fx, smaa, fxaa, u,
    // the full-screen materials of the passes that are switched on (so their shaders can be compiled ahead of time), and a one-quad scene to compile one with
    materials() { const out = []; for (const p of composer.passes) if (p.enabled) for (const k in p) { const v = p[k]; if (v && v.isMaterial) out.push(v); else if (Array.isArray(v)) for (const x of v) if (x && x.isMaterial) out.push(x); } return out; },
    quad(m) { quadMesh.material = m; return quadScene; },
    aoOff: false, // set for a frame to skip the AO (scenes other than the race)
    direct: false, // Low: the scene is drawn straight to the screen (tone mapping and colours done by each material), with no passes at all
    setSize(w, h, pr) {
      composer.setPixelRatio(pr); composer.setSize(w, h); // (the buffers keep their size on Low too: nothing is drawn into them, and switching back up needs no resize) px = { w: w * pr, h: h * pr }; aoSize();
      fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); u.aspect.value = w / h; clean.uniforms.texel.value.set(1 / (w * pr), 1 / (h * pr));
    },
    // scale = the AO's resolution as a fraction of the screen's (0 = off)
    setAO(scale) {
      aoScale = scale;
      if (scale > 0 && !ao) { ao = makeAO(scene, camera, 64, 64); composer.insertPass(ao, 1); }
      if (ao) { ao.enabled = scale > 0; aoSize(); }
    },
    setScene(s, c) { renderPass.scene = s; renderPass.camera = c; bokeh.scene = s; bokeh.camera = c; },
    render(dt, camPos) {
      if (ao) {
        const on = aoScale > 0 && !api.aoOff && renderPass.scene === scene; ao.enabled = on;
        if (on && camPos) { const U = ao.gtaoMaterial.uniforms; U.sceneBoxMin.value.set(camPos.x - 130, -5, camPos.z - 170); U.sceneBoxMax.value.set(camPos.x + 130, 160, camPos.z + 40); } // only near the camera
      }
      api.aoOff = false;
      if (api.direct) { renderer.setRenderTarget(null); renderer.render(renderPass.scene, renderPass.camera); return; }
      if (BLACK_TEST) { renderer.setRenderTarget(null); renderer.clear(); return; } // (testing: &blacktest acts like a browser whose post-processing comes out black)
      composer.render(dt);
    },
  };
  return api;
}
