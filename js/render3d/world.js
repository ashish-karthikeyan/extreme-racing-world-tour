// The static part of the scene: road, lane lines, kerbs, grass, sky, fog and lights.
// It never changes shape; update() recolours it for the current city, cross-fades skies and slides the road textures towards the camera.
import * as THREE from "three";
import { roadHalf, arrToHex, setCol } from "./mapping.js";
import { LOOK, CITY_TOD, NIGHT_SKY, skyOf, hasSky, createSkyDome, sunSpot, skyFileOf } from "./env.js";
import { wearTexture, linesTexture, kerbTexture, kerbGeometry, WEAR_W, WEAR_LEN } from "./roadtex.js";
import { cityColors } from "./city/profiles.js";

const ROAD_TILE = 16, KERB_TILE = 4.8, ASPH_TILE = 6; // world units of road covered by one repeat of each texture
const LEN = 1700, Z_START = 80;                         // the road runs from Z = +80 (behind the car) to Z = -1620, out to the horizon

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// ACES filmic (as three.js does it) applied by hand, so the fog can be the colour the sky horizon really ends up on screen
const aces = v => { v /= 0.6; return Math.min(1, Math.max(0, (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14))); };

export function createWorld(scene, light = false) { // (light: this machine starts on Low, so the road's wear picture is drawn smaller)
  const RH = roadHalf();

  // --- asphalt: real CC0 asphalt (colour, normal, roughness from ambientCG) plus a "wear" layer drawn in code: tyre marks down every lane,
  //     repair patches, cracks, manhole and drain covers, and the spots where puddles gather. The white lines sit on a see-through layer above. ---
  const texLoader = new THREE.TextureLoader();
  const pbr = (name, srgb) => { const t = texLoader.load(`assets/textures/asphalt_${name}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(RH * 2 / ASPH_TILE, LEN / ASPH_TILE); return t; };
  const asphalt = pbr("color", true), asphaltN = pbr("normal", false), asphaltR = pbr("roughness", false);
  const lane = RH * 2 / 3, wear = wearTexture([-lane, 0, lane], RH, light ? 0.5 : 1); // (a machine that starts on Low: a smaller picture, much quicker to draw)
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, normalMap: asphaltN, roughnessMap: asphaltR, normalScale: new THREE.Vector2(1.0, 1.0), color: 0x4a4c52, roughness: 1, metalness: 0 });
  const roadU = { uWear: { value: wear }, uD: { value: 0 }, uD2: { value: 0 }, uRoadWet: { value: 0 } };
  roadMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, roadU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vRoad;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvRoad = position.xz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vRoad; uniform sampler2D uWear; uniform float uD, uD2, uRoadWet;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        float wz = vRoad.y + (${(Z_START - LEN / 2).toFixed(3)});
        // the wear picture is sampled twice, at two different lengths and mirrored the second time, so its patches never repeat in step (a single copy looked like a pattern stamped along the whole track)
        vec4 w1 = texture2D(uWear, vec2(vRoad.x / ${WEAR_W.toFixed(1)} + 0.5, (uD - wz) / ${WEAR_LEN.toFixed(1)})), w2 = texture2D(uWear, vec2(0.5 - vRoad.x / ${WEAR_W.toFixed(1)}, (uD2 - wz + 29.7) / 103.6));
        float rub = max(w1.r, w2.r * 0.85), tone = (w1.g - 0.5) + (w2.g - 0.5), pud = smoothstep(0.58, 0.78, (w1.b + w2.b) * 0.5) * uRoadWet;
        diffuseColor.rgb *= (1.0 - 0.5 * rub) * (1.0 + 0.2 * tone) * (1.0 - 0.45 * pud);`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.16, uRoadWet * 0.7); roughnessFactor = mix(roughnessFactor, 0.03, pud); roughnessFactor *= 1.0 - 0.25 * rub;`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, clamp(pud + uRoadWet * 0.25, 0.0, 1.0)));`);
  };
  roadMat.customProgramCacheKey = () => "road-wear";
  const road = new THREE.Mesh(new THREE.PlaneGeometry(RH * 2, LEN).rotateX(-Math.PI / 2), roadMat);
  road.position.set(0, 0, Z_START - LEN / 2); road.receiveShadow = true; scene.add(road);

  const lines = linesTexture();
  lines.repeat.set(1, LEN / ROAD_TILE);
  const lineMat = new THREE.MeshStandardMaterial({ map: lines, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.6 });
  const lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(RH * 2, LEN).rotateX(-Math.PI / 2), lineMat);
  lineMesh.position.set(0, 0.02, Z_START - LEN / 2); scene.add(lineMesh);

  // --- red and white kerbs along both edges, with real height ---
  const kerbTex = kerbTexture(); let kerbVenue = "";
  kerbTex.repeat.set(1, LEN / KERB_TILE);
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.7 });
  for (const s of [-1, 1]) { const m = new THREE.Mesh(kerbGeometry(s, LEN, KERB_TILE), kerbMat); m.position.set(s * RH, 0, Z_START - LEN / 2); m.receiveShadow = true; m.castShadow = true; scene.add(m); }

  // --- the ground beyond (the city builder draws the pavements and grass; this disc is just the far horizon) ---
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5fae4a, roughness: 1 });
  const farGround = new THREE.Mesh(new THREE.CircleGeometry(2600, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fae4a, fog: true })); // a huge disc that follows the camera, so there is ground to the horizon in every direction
  farGround.position.set(0, -0.05, -100); scene.add(farGround);

  // --- sky, fog, lights ---
  const dome = createSkyDome(); scene.add(dome);
  scene.fog = new THREE.Fog(0xbfe3fa, 40, 125);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.position.set(-40, 70, 30); scene.add(sun); scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 80, bottom: -80, near: 10, far: 900 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; sun.shadow.radius = 3; // the shadow box follows the player
  const fill = new THREE.HemisphereLight(0x8fa6ff, 0x334055, 0.0); scene.add(fill); // a touch of ambient when the sky image is missing

  const spotCache = new Map();
  const spotOf = (name, sky) => { if (sky.spot) return sky.spot; let s = spotCache.get(sky); if (!s) spotCache.set(sky, s = sunSpot(sky.tex)); return s; };
  const fogCol = new THREE.Color(), dir = new THREE.Vector3(), toArr = c => [c.r, c.g, c.b];

  // the "mood" of a city: its sky, where its sun is (in the world, relative to the road) and how bright everything is
  const moods = new Map(), cA = new THREE.Color(), cB = new THREE.Color(), cT = new THREE.Color();
  const todOf = st => mode === "tutorial" && st.venue === "Tokyo" ? "sunset" : CITY_TOD[st.venue]; // a city's sky (the test drive is Tokyo at sunset)
  function mood(todName) {
    let md = moods.get(todName); if (md === undefined || (md && md.standIn && hasSky(skyFileOf(todName)))) { md = buildMood(todName); if (md) md.standIn = !hasSky(skyFileOf(todName)); moods.set(todName, md); } return md; // (a sky that is still loading gets a stand-in until it arrives)
  }
  function buildMood(todName) {
    const file = skyFileOf(todName), sky = skyOf(file), look = LOOK[todName] || LOOK.midday;
    if (!sky) return null;
    const spot = spotOf(file, sky), az = look.az * Math.PI / 180;
    const el = todName === "overcast" || file !== todName ? look.el * Math.PI / 180 : Math.max(0.12, spot.el); // under a clear sky the light comes from where the sun disc really is (the briefing's golden light: low, behind the camera, out of the picture)
    const phiWanted = Math.atan2(-Math.cos(az), Math.sin(az));
    return { sky, look, yaw: spot.phi - phiWanted, az, el, night: todName === NIGHT_SKY };
  }

  const shadowBox = { half: 70, ahead: 0 }; // the area the sun's shadows cover (set from the quality level): it sits ahead of the car, where the camera looks
  const api = {
    groundMeshes: [road, lineMesh], reflectMats: [roadMat, lineMat],
    sun, dome, fill, // (fill is a soft sky-coloured ambient: used when the image-based lighting is off, and a little at night)
    exposure: 1,     // the tone-mapping exposure for this mood (the renderer applies it)
    lights: 0,       // how lit up the city is by its sky alone (dusk: 0.6), on top of the simulation's own night
    briefTod: null, briefK: 0, // the briefing's own light (see LOOK in env.js) and how far it has blended in (0..1); the renderer sets both
    // bigger shadow maps can cover more road: half = half the width of the shadow area, ahead = how far up the road its centre sits
    setShadowArea(half, ahead) { shadowBox.half = half; shadowBox.ahead = ahead; Object.assign(sun.shadow.camera, { left: -half, right: half, top: half * 1.15, bottom: -half * 1.15 }); sun.shadow.camera.updateProjectionMatrix(); },
    // pal = the simulation's blended palette; stA / stB = this city and the next; b = how far through the blend (0..1)
    update(pal, rain, scrollWu, focus, stA, stB, b, wetness = 0) {
      const night = Math.min(1, pal.dark * 4);
      for (const t of [asphalt, asphaltN, asphaltR]) t.offset.y = (scrollWu / ASPH_TILE) % 1; lines.offset.y = (scrollWu / ROAD_TILE) % 1;
      roadU.uD.value = scrollWu % WEAR_LEN; roadU.uD2.value = scrollWu % 103.6; roadU.uRoadWet.value = wetness;
      kerbTex.offset.y = (scrollWu / KERB_TILE) % 1;
      const kv = b < 0.5 ? stA.venue : stB.venue; if (kv !== kerbVenue) { kerbVenue = kv; kerbTexture(cityColors(kv), kerbTex); } // the kerbs in this city's colours

      setCol(roadMat.color, pal.road[0], pal.road[1], pal.road[2], 2.3 - 0.7 * wetness); // (the asphalt picture is mid grey: the city's road colour is brightened to match)
      roadMat.metalness = 0.25 * wetness; lineMat.roughness = 0.6 - 0.3 * wetness; // wet asphalt shines (the shader lowers the roughness)
      setCol(grassMat.color, pal.grass[0], pal.grass[1], pal.grass[2]);
      setCol(farGround.material.color, pal.grass[0], pal.grass[1], pal.grass[2], 0.7 - 0.45 * night); farGround.position.set(focus.camPos.x, -0.05, focus.camPos.z);

      const mA = mood(todOf(stA)); let mB = mood(todOf(stB)) || mA;
      if (!mA) { scene.fog.color.setHex(arrToHex(pal.sky1)); sun.intensity = 2; fill.intensity = 1.2; return; }
      if (api.briefTod && api.briefK > 0.001) { const mG = mood(api.briefTod); if (mG) { mB = mG; b = api.briefK; } } // the briefing: this city's sky blends into its postcard light
      const u = dome.material.uniforms, lA = mA.look, lB = mB.look, mix = (a, c) => a + (c - a) * b;
      u.tA.value = mA.sky.tex; u.tB.value = mB.sky.tex; u.mixB.value = b; u.yawA.value = mA.yaw; u.yawB.value = mB.yaw;
      u.tint.value.setRGB(1, 1, 1).lerp(cT.setRGB(pal.tint[0] / 255, pal.tint[1] / 255, pal.tint[2] / 255), pal.tint[3] * 1.5);
      u.hazeAmt.value = 0; dome.position.copy(focus.camPos);
      u.nightK.value = mix(mA.night ? 1 : 0, mB.night ? 1 : 0);
      api.exposure = mix(lA.exp, lB.exp); api.lights = mix(lA.lights || 0, lB.lights || 0); // (dusk: windows, street lamps and headlights already on)

      // lighting from the sky image (both skies blended), plus the sun / moon as one directional light
      const m = b < 0.5 ? mA : mB;
      scene.environment = m.sky.env; scene.environmentRotation.y = m.yaw; // (swapping at the halfway point of a blend; intensities below are cross-faded)
      const envI = (mA.look.env + (mB.look.env - mA.look.env) * b) * (1 - 0.25 * rain);
      scene.environmentIntensity = envI;
      const az = mA.az + (mB.az - mA.az) * b, el = mA.el + (mB.el - mA.el) * b;
      dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      u.moonDir.value.copy(dir);
      const sz = focus.z - shadowBox.ahead; // the shadows cover the road ahead of the car (what the camera sees), not the road behind it
      sun.position.set(focus.x + dir.x * 330, dir.y * 330, sz + dir.z * 330); sun.target.position.set(focus.x, 0, sz);
      sun.color.copy(cA.set(mA.look.color)).lerp(cB.set(mB.look.color), b);
      sun.intensity = (mA.look.sun + (mB.look.sun - mA.look.sun) * b) * (1 - 0.85 * rain);

      // fog: the colour the horizon of the sky really shows
      const hA = mA.sky.horizon, hB = mB.sky.horizon;
      fogCol.setRGB(aces(hA.r + (hB.r - hA.r) * b), aces(hA.g + (hB.g - hA.g) * b), aces(hA.b + (hB.b - hA.b) * b));
      fogCol.multiplyScalar((1 - 0.6 * night) * (1 - 0.3 * api.lights)); scene.fog.color.copy(fogCol); // (at night the city glow on the horizon is kept subtle)
      scene.fog.near = 260 - 210 * rain - 100 * night; scene.fog.far = 1700 - 950 * rain - 450 * night; // light haze: the skyline stays visible by day
      const nk = u.nightK.value; if (nk > 0) scene.fog.color.lerp(cB.setRGB(0.035, 0.045, 0.085), nk * 0.75); // at night the far distance fades to a calm deep blue, not a brown haze
    },
  };
  return api;
}
