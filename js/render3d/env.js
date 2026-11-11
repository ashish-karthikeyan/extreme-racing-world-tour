// Skies and image-based lighting. Five CC0 HDRI skies from Poly Haven (morning, midday, sunset, night, overcast) light the scene and
// show up in reflections. Each city uses one; between two cities the sky cross-fades and the lighting follows.
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

export const TODS = ["morning", "midday", "sunset", "night", "overcast", "clear", "golden", "dusk"];
// which sky each of the 22 cities gets (by venue name)
export const CITY_TOD = {
  Sydney: "morning", Shanghai: "midday", Tokyo: "dusk", Miami: "sunset", Montreal: "midday", "Monte Carlo": "clear", Barcelona: "golden", Salzburg: "morning",
  London: "overcast", Brussels: "overcast", Budapest: "morning", Amsterdam: "morning", Rome: "golden", Madrid: "clear", Baku: "sunset", Singapore: "night",
  Austin: "midday", "Mexico City": "golden", "Sao Paulo": "overcast", "Las Vegas": "night", Doha: "night", "Abu Dhabi": "dusk",
};
// sun / moon direction (azimuth: 0 = straight ahead, positive to the right; elevation in degrees), light colour and strength,
// env = how much soft light the sky image adds (less = more contrast: lit sides bright, shadowed sides dark),
// exp = exposure, skySat / skyGain = a grade on the sky picture itself (the raw images are pale and a little lilac: this makes them a clear blue)
export const LOOK = {
  morning:  { az: -50, el: 30, color: 0xffd6a0, sun: 4.6, env: 0.5,  exp: 1.0,  skySat: 1.0,  skyGain: [0.6, 0.75, 0.56] }, // (this photo's sky is very bright and violet: measured, then pulled to the midday photo's blue)
  midday:   { az: -35, el: 52, color: 0xfff0d6, sun: 5.0, env: 0.45, exp: 0.95, skySat: 1.45, skyGain: [0.84, 0.97, 1.14] },
  sunset:   { az: -48, el: 9,  color: 0xff9440, sun: 4.2, env: 0.5,  exp: 1.0,  skySat: 1.2,  skyGain: [1.06, 0.95, 0.9] },
  night:    { az: 30, el: 38,  color: 0x9fb4ff, sun: 0.3, env: 0.3,  exp: 0.95, skySat: 1.0,  skyGain: [1, 1, 1] },
  overcast: { az: -30, el: 50, color: 0xe8ecf2, sun: 0.9, env: 0.95, exp: 1.0,  skySat: 1.05, skyGain: [0.97, 1.0, 1.04] },
  // (added in the graphics overhaul: three more Poly Haven skies, so more cities get a light of their own)
  clear:    { az: -40, el: 48, color: 0xfff3dc, sun: 5.2, env: 0.42, exp: 0.95, skySat: 1.3,  skyGain: [0.86, 0.97, 1.12] }, // a crisp, deep-blue Mediterranean noon
  golden:   { az: -50, el: 16, color: 0xffc27a, sun: 4.8, env: 0.5,  exp: 1.0,  skySat: 1.15, skyGain: [1.04, 0.97, 0.9] },  // late afternoon: long warm light on stone
  dusk:     { az: -55, el: 8,  color: 0xffa868, sun: 2.0, env: 0.42, exp: 0.8,  skySat: 1.0,  skyGain: [1.0, 0.96, 0.98], lights: 0.6 }, // blue hour: the sun just down, the sky still glowing, the city's lights on (lights: how lit up the city is, 0 day .. 1 night)
  // the briefing's postcard light (the golden late-afternoon sky with the sun low and warm behind the camera, so the landmark's face glows against a blue sky): "golden+" when the
  // landmark stands right of the road (the camera looks right and ahead, the sun is behind it on the left), "golden-" when it stands left
  "golden+": { az: -140, el: 17, color: 0xffcf96, sun: 4.8, env: 0.55, exp: 1.0 },
  "golden-": { az: 140, el: 17, color: 0xffcf96, sun: 4.8, env: 0.55, exp: 1.0 },
};
export const BRIEF_TOD = { Singapore: "night", "Las Vegas": "night", Doha: "night" }; // the briefing's light: golden hour, except the cities that are at their best lit up at night
export const skyFileOf = name => name.startsWith("golden") ? "golden" : name; // (the briefing's golden looks use the late-afternoon sky image, its sun turned round behind the camera)
export const NIGHT_SKY = "night"; // this sky image only lights the scene: what you see overhead is drawn by the dome shader (clean stars, a moon)

const skies = {}; // tod -> { tex (equirect HDR, for the sky shader), env (PMREM, for lighting), horizon: THREE.Color, spot (where the sun is) }

function horizonColour(d, width, height) { // average colour of the band just above the horizon: that is what the fog should fade to
  const c = new THREE.Color(0, 0, 0); let n = 0;
  for (let y = Math.floor(height * 0.46); y < Math.floor(height * 0.5); y++) for (let x = 0; x < width; x += 4) { const i = (y * width + x) * 4; c.r += d[i]; c.g += d[i + 1]; c.b += d[i + 2]; n++; }
  return c.multiplyScalar(1 / n);
}

// The brightest spots in a sky image (the sun, the moon) can be too bright for a half-float number and load as infinity. Filtering an
// infinite texel gives NaN, and a NaN pixel makes the whole screen flash black once bloom has smeared it. So: cap every texel.
// The raw sky photos are also pale, a little grey and (the morning one) lilac, so each is graded once as it loads (saturation, then a
// colour gain): the sky you see AND the light it casts on the city are a clear blue / warm gold, not a wash.
// Both are done on the picture as plain 32-bit numbers, which are then turned into half floats in one go (the graphics chip's format).
function gradeHDR(d, sat, gain, cap = 4000) {
  let n = 0; const grade = sat !== 1 || gain.some(g => g !== 1);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (!(r < cap) || !(g < cap) || !(b < cap)) { r = r < cap ? r : r === r ? cap : 0; g = g < cap ? g : g === g ? cap : 0; b = b < cap ? b : b === b ? cap : 0; n++; }
    if (grade) { const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = Math.max(0, l + (r - l) * sat) * gain[0]; g = Math.max(0, l + (g - l) * sat) * gain[1]; b = Math.max(0, l + (b - l) * sat) * gain[2]; }
    d[i] = Math.min(r, 65000); d[i + 1] = Math.min(g, 65000); d[i + 2] = Math.min(b, 65000); // (65504 is the biggest half float)
  }
  return n;
}
function toHalf(d) { const to = THREE.DataUtils.toHalfFloat, h = new Uint16Array(d.length); for (let i = 0; i < d.length; i++) h[i] = to(d[i]); return h; }

// where the brightest spot of a sky is (the sun, or the moon): { phi: atan(z, x) of its direction, el: elevation in radians }
function brightest(d, width, height) {
  let best = -1, bx = 0, by = 0;
  for (let y = 0, i = 0; y < height; y++) for (let x = 0; x < width; x++, i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; if (l > best) { best = l; bx = x; by = y; } }
  return { phi: ((bx + 0.5) / width - 0.5) * Math.PI * 2, el: ((by + 0.5) / height - 0.5) * Math.PI };
}

const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); // (wait for the next frame, so the game keeps moving between heavy steps)
let pmrem = null, safe = false;
const prepared = {};
// The safe path (a browser that can't draw into half-float pictures, see device.js): the skies get no mipmaps (making them needs that) and
// cast no soft lighting (PMREM is built in such pictures); the renderer lights the scene with its plain sky-coloured fill instead.
export function setSkySafe(on) {
  safe = !!on; if (!safe) return;
  for (const k in skies) { const t = skies[k].tex; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; skies[k].env = null; }
}
// Get a sky ready without the graphics chip: download it, decode it, grade it and turn it into half floats, a step per frame. It can start
// before the WebGL context exists (boot.js starts the title's sky together with the models).
export function prepareSky(name) {
  return prepared[name] || (prepared[name] = (async () => {
    const tex = await new RGBELoader().setDataType(THREE.FloatType).loadAsync(`assets/hdri/${name}.hdr`); await frame();
    const { data, width, height } = tex.image;
    const capped = gradeHDR(data, LOOK[name].skySat, LOOK[name].skyGain); if (capped) console.info(`sky ${name}: capped ${capped} out-of-range texels`);
    const horizon = horizonColour(data, width, height), spot = brightest(data, width, height); await frame();
    tex.image.data = toHalf(data); tex.type = THREE.HalfFloatType; // (half floats can be filtered and mipmapped on every WebGL 2 device; 32-bit floats can't on all of them)
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = safe ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = !safe; tex.needsUpdate = true; // mipmaps let the sky shader soften the magnified image
    return { tex, horizon, spot };
  })());
}
// The shaders that turn a sky into soft lighting: started as soon as the WebGL context exists, so they compile while the models download.
export function warmSkyShaders(renderer) { if (safe) return; pmrem = pmrem || new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader(); }
// Load one sky: get it ready (above), then build the soft lighting it casts (PMREM) on the next frame. light = false skips that lighting
// (Low doesn't use it: it lights the city with a plain sky-coloured fill); addSkyLight() builds it later if the graphics go up.
export async function loadSky(renderer, name, light = true) {
  if (skies[name]) return true;
  try {
    const { tex, horizon, spot } = await prepareSky(name); await frame();
    if (safe) { tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; skies[name] = { tex, env: null, horizon, spot }; return true; }
    if (!light) { skies[name] = { tex, env: null, horizon, spot }; return true; }
    pmrem = pmrem || new THREE.PMREMGenerator(renderer);
    skies[name] = { tex, env: pmrem.fromEquirectangular(tex).texture, horizon, spot };
    return true;
  } catch (e) { console.warn("sky failed:", name, e.message || e); return false; }
}
export function addSkyLight(renderer) {
  if (safe) return; for (const k in skies) if (!skies[k].env) { pmrem = pmrem || new THREE.PMREMGenerator(renderer); skies[k].env = pmrem.fromEquirectangular(skies[k].tex).texture; }
}
// The night sky (the title, Las Vegas) first, before the title shows; the others afterwards, one by one, while the title plays.
export const FIRST_SKY = "night";
export const hasSky = name => !!skies[name];
export const skyOf = name => skies[name] || skies.midday || skies[FIRST_SKY] || Object.values(skies)[0] || null;

// ---------- the sky dome: mixes two equirect HDRIs (this city and the next) and tints them with the city's palette ----------
// At night the photo is replaced by a sky drawn here: a dark gradient, the city's glow on the horizon, a moon and small, steady stars
// (the night photo's own stars are noisy and it has a blurry tree in it; it still lights the scene).
export function createSkyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: true,
    uniforms: { tA: { value: null }, tB: { value: null }, mixB: { value: 0 }, expo: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) }, yawA: { value: 0 }, yawB: { value: 0 }, haze: { value: new THREE.Color(0.7, 0.8, 0.9) }, hazeAmt: { value: 0 },
      nightK: { value: 0 }, moonDir: { value: new THREE.Vector3(0.4, 0.6, -0.7) }, glow: { value: new THREE.Color(0.1, 0.08, 0.12) } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tA, tB; uniform float mixB, expo, yawA, yawB, hazeAmt, nightK; uniform vec3 tint, haze, moonDir, glow; varying vec3 vDir;
      vec2 eq(vec3 d, float yaw) { float a = atan(d.z, d.x) + yaw; return vec2(a / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5); }
      float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
      vec3 nightSky(vec3 d) {
        float up = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(vec3(0.016, 0.022, 0.05), vec3(0.003, 0.005, 0.014), smoothstep(0.0, 0.6, up));   // deep blue overhead, a touch lighter low down
        col += glow * exp(-max(d.y, 0.0) * 9.0);                                                           // the city's glow along the horizon
        // stars: one chance per cell of a grid on the sky; each star is a soft dot at least about a pixel wide, so it never sparkles as you move
        vec3 p = d * 160.0, c = floor(p), f = p - c - 0.5; float r = h31(c);
        if (r < 0.055 && d.y > 0.06) {
          vec3 o = (vec3(h31(c + 7.1), h31(c + 3.7), h31(c + 1.3)) - 0.5) * 0.5;
          float px = max(fwidth(p.x), fwidth(p.y)) * 0.9, dist = length(f - o);
          float s = smoothstep(max(0.05, px), 0.0, dist) * (0.35 + 1.4 * h31(c + 9.0)) * smoothstep(0.06, 0.25, d.y);
          col += vec3(0.85, 0.9, 1.0) * s * 0.9;
        }
        // the moon: a pale disc with a soft halo
        float m = dot(d, normalize(moonDir));
        col += vec3(0.95, 0.96, 1.0) * 2.6 * smoothstep(0.99935, 0.99955, m) + vec3(0.25, 0.3, 0.42) * pow(clamp(m, 0.0, 1.0), 400.0) * 0.6;
        return col;
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(texture2D(tA, eq(d, yawA), 1.5).rgb, texture2D(tB, eq(d, yawB), 1.5).rgb, mixB) * expo * tint;
        col = mix(col, haze, hazeAmt * (1.0 - smoothstep(0.0, 0.55, d.y)));
        if (nightK > 0.001) col = mix(col, nightSky(d), nightK);
        col = min(col, vec3(7.0)); // the sun disc is thousands of times brighter than the sky: cap it so it can't blow the bloom out
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), mat);
  mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}

// where the brightest spot of an HDRI is (the sun or moon): { phi: atan(z, x) of its direction, el: elevation in radians }
export function sunSpot(tex) {
  const { data, width, height } = tex.image, half = data instanceof Uint16Array;
  let best = -1, bx = 0, by = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, r = half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i], g = half ? THREE.DataUtils.fromHalfFloat(data[i + 1]) : data[i + 1], b = half ? THREE.DataUtils.fromHalfFloat(data[i + 2]) : data[i + 2];
    const l = r + g + b; if (l > best) { best = l; bx = x; by = y; }
  }
  return { phi: ((bx + 0.5) / width - 0.5) * Math.PI * 2, el: ((by + 0.5) / height - 0.5) * Math.PI };
}
