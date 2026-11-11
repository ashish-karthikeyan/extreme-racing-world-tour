// Roadside scenery drawn with GPU instancing: every kind of tree / rock / building is ONE draw call per material,
// no matter how many copies are on screen. Each frame the renderer pushes one matrix per visible object.
import * as THREE from "three";
import { SCALE } from "./mapping.js";
import { hasModel, cloneModel, sceneOf } from "./assets.js";

// Materials shared by every tree / bush / rock, recoloured each frame to the current city's leaf colour (so cities blend smoothly)
export const leafMat = new THREE.MeshStandardMaterial({ color: 0x5e9a58, roughness: 0.85 });
export const leafDarkMat = new THREE.MeshStandardMaterial({ color: 0x3f7a42, roughness: 0.85 });
export const grassTopMat = new THREE.MeshStandardMaterial({ color: 0x5e9a58, roughness: 0.95 });
// Foliage detail (Medium and up): the low-poly leaf blobs get a clumpy, leafy surface. A 3D noise in the tree's own coordinates (so it
// never swims as the tree moves) breaks each blob into darker and lighter clumps, each clump turned a little to the light on its own, and the
// inside of the crown is shaded darker than its sunlit top.
for (const m of [leafMat, leafDarkMat]) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vLeafP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvLeafP = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      varying vec3 vLeafP;
      float lfH(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
      float lfN(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(lfH(i), lfH(i + vec3(1, 0, 0)), f.x), mix(lfH(i + vec3(0, 1, 0)), lfH(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(lfH(i + vec3(0, 0, 1)), lfH(i + vec3(1, 0, 1)), f.x), mix(lfH(i + vec3(0, 1, 1)), lfH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
      #ifndef LOW_SHADING
        float lfA = lfN(vLeafP * 7.0), lfB = lfN(vLeafP * 19.0 + 3.1);
        diffuseColor.rgb *= (0.62 + 0.55 * lfA) * (0.85 + 0.3 * lfB) * (0.75 + 0.35 * smoothstep(0.2, 0.9, vLeafP.y));
      #endif`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      #ifndef LOW_SHADING
        { vec3 lfC = floor(vLeafP * 9.0); normal = normalize(normal + (vec3(lfH(lfC), lfH(lfC + 5.7), lfH(lfC + 9.3)) - 0.5) * 0.9); }
      #endif`);
  };
  m.customProgramCacheKey = () => "leaf-detail";
}
const swap = name => /^leafsDark|^leafsPine/i.test(name) ? leafDarkMat : /^leafs/i.test(name) ? leafMat : /^grass$/i.test(name) ? grassTopMat : null;

// flatten a model into parts [{ geometry, material, matrix }] (one per mesh) so each can be instanced
export function partsOf(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = [];
  root.traverse(o => { if (o.isMesh) parts.push({ geometry: o.geometry, material: (o.material.name && swap(o.material.name)) || o.material, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) }); });
  return parts;
}

export class Instancer {
  constructor(scene, capacity = 160) { this.scene = scene; this.cap = capacity; this.pools = new Map(); this.m = new THREE.Matrix4(); }
  // key -> parts. Each part becomes an InstancedMesh.
  register(key, parts) {
    if (this.pools.has(key)) return this.pools.get(key);
    const meshes = parts.map(p => {
      const im = new THREE.InstancedMesh(p.geometry, p.material, this.cap);
      im.frustumCulled = false; im.count = 0; im.castShadow = true; im.receiveShadow = true; this.scene.add(im);
      return { im, local: p.matrix };
    });
    const pool = { meshes, n: 0 }; this.pools.set(key, pool); return pool;
  }
  begin() { for (const p of this.pools.values()) p.n = 0; }
  // world = a Matrix4 holding the object's position / rotation / scale
  push(key, world) {
    const p = this.pools.get(key); if (!p || p.n >= this.cap) return;
    for (const { im, local } of p.meshes) { this.m.multiplyMatrices(world, local); im.setMatrixAt(p.n, this.m); }
    p.n++;
  }
  end() { for (const p of this.pools.values()) for (const { im } of p.meshes) { im.count = p.n; im.instanceMatrix.needsUpdate = true; } }
}

// ---------- which model stands in for each simulation scenery object ----------
const TREES = {
  round: ["tree_default", "tree_oak", "tree_fat"], pine: ["tree_pineTallA", "tree_pineTallB", "tree_pineTallC", "tree_pineRoundA"], cypress: ["tree_thin", "tree_pineTallA"],
  palm: ["tree_palmTall", "tree_palmDetailedTall", "tree_palmShort"], gum: ["tree_tall", "tree_simple", "tree_oak"], fruit: ["tree_default", "tree_fat"], cactus: ["cactus_tall", "cactus_short"],
};
const BUSH = ["plant_bush", "plant_bushLarge", "plant_bushDetailed"], ROCK = ["rock_largeA", "rock_largeB", "rock_largeC", "stone_largeA", "stone_largeB"];
const LOW = ["building-a", "building-b", "building-c", "building-d", "building-e", "building-f", "building-g", "building-h", "building-i", "building-j", "building-k", "building-l"];
const SKY = ["building-skyscraper-a", "building-skyscraper-b", "building-skyscraper-c", "building-skyscraper-d", "building-skyscraper-e", "building-m", "building-n"];
const STAND = ["grandStand", "grandStandCovered", "grandStandRound"], LAMP = ["lightPostModern", "lightPostLarge"], HOUSE = ["building-type-a", "building-type-b", "building-type-c", "building-type-d", "building-type-e", "building-type-f"];
const pickBy = (list, s) => list[(s.v + Math.floor((s.ph || 0) * 7)) % list.length];

// returns { key, scaleToHeight | scaleToWidth, yaw } or null (then a simple placeholder box is used)
export function chooseModel(s) {
  const k = s.kind;
  if (k === "tree") { const name = pickBy(TREES[s.style] || TREES.round, s); return { name, height: s.style === "cactus" ? 4.5 + s.r * 0.15 : s.style === "palm" ? 10 + s.r * 0.15 : 6.5 + s.r * 0.3, yaw: s.ph }; }
  if (k === "bush") return { name: pickBy(BUSH, s), height: 1.3 + s.r * 0.12, yaw: s.ph };
  if (k === "rock") return { name: pickBy(ROCK, s), width: s.r * 0.55, yaw: s.ph };
  if (k === "building") return { name: s.bh > 62 ? pickBy(SKY, s) : pickBy(LOW, s), width: s.bw * 0.2, yaw: s.side > 0 ? Math.PI / 2 : -Math.PI / 2 };
  if (k === "stand") return { name: pickBy(STAND, s), width: 11, yaw: s.side > 0 ? -Math.PI / 2 : Math.PI / 2 };
  if (k === "board") return { name: "billboard", width: 6.5, yaw: s.side > 0 ? -Math.PI / 2 : Math.PI / 2, sponsor: s.sponsor };
  if (k === "lamp") return { name: pickBy(LAMP, s), height: 7.5, yaw: s.side > 0 ? -Math.PI / 2 : Math.PI / 2 };
  if (k === "flag") return { name: pickBy(["flagRed", "flagGreen", "flagCheckers"], s), height: 7, yaw: s.side > 0 ? -Math.PI / 2 : Math.PI / 2 };
  if (k === "prop" && ["chalet", "villa", "canalhouse", "colorhouses", "osborne"].includes(s.key)) return { name: pickBy(HOUSE, s), width: 7, yaw: s.side > 0 ? -Math.PI / 2 : Math.PI / 2 };
  return null;
}

const sponsorMats = new Map();
function sponsorMaterial(sp) { // the board's face: sponsor name on its colour
  let m = sponsorMats.get(sp[0]);
  if (!m) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d");
    g.fillStyle = sp[1]; g.fillRect(0, 0, 256, 128); g.fillStyle = "rgba(255,255,255,0.95)"; g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(sp[0], 128, 66, 236);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    sponsorMats.set(sp[0], m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  }
  return m;
}

// Register (once) the instanced parts for a choice, normalised to the requested size, standing on the ground at the origin.
const registered = new Map(), tmpBox = new THREE.Box3();
export function ensure(instancer, choice) {
  const key = choice.sponsor ? `${choice.name}|${choice.sponsor[0]}` : choice.name;
  let info = registered.get(key);
  if (info) return info;
  const model = cloneModel(choice.name); model.updateMatrixWorld(true);
  tmpBox.setFromObject(model); const size = tmpBox.getSize(new THREE.Vector3()), centre = tmpBox.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group(); wrap.add(model); model.position.set(-centre.x, -tmpBox.min.y, -centre.z);
  const parts = partsOf(wrap);
  if (choice.sponsor) for (const p of parts) if (p.material.map) p.material = sponsorMaterial(choice.sponsor); // the billboard's picture
  if (/^building-|^low-detail/.test(choice.name)) lightWindows(parts);
  if (/^grandStand/.test(choice.name)) for (const p of parts) if (p.material.name === "red") p.material = crowdMat; // the seats become a crowd
  instancer.register(key, parts);
  info = { key, w: size.x, h: size.y }; registered.set(key, info);
  return info;
}
export const hasChoice = c => c && hasModel(c.name);

// ---------- night: lit windows on the city buildings ----------
// The building texture is a palette of colour swatches; the blue "glass" swatches are the windows. Copy only those onto a black
// canvas and use it as the emissive map, so at night just the windows glow (the renderer sets windowMats' intensity from the darkness).
export const windowMats = [];
let windowTex = null;
export function lightWindows(parts) {
  for (const p of parts) {
    const mat = p.material, img = mat && mat.map && mat.map.image;
    if (!img || mat.userData.windowsLit) continue;
    if (!windowTex) {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d");
      g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
      const s = c.width / 512; g.drawImage(img, 256 * s, 128 * s, 128 * s, 128 * s, 256 * s, 128 * s, 128 * s, 128 * s); // the two blue swatches
      windowTex = new THREE.CanvasTexture(c); windowTex.flipY = mat.map.flipY; windowTex.colorSpace = THREE.SRGBColorSpace;
    }
    mat.emissiveMap = windowTex; mat.emissive = new THREE.Color(0xffd9a0); mat.emissiveIntensity = 0; mat.userData.windowsLit = true; mat.needsUpdate = true;
    windowMats.push(mat);
  }
}

// ---------- crowds in the grandstands ----------
// The stands' seat material is swapped for a speckled texture in the city's crowd colours (flags, shirts), so each stand looks full of people.
const crowdCanvas = document.createElement("canvas"); crowdCanvas.width = crowdCanvas.height = 64;
const crowdTex = new THREE.CanvasTexture(crowdCanvas); crowdTex.wrapS = crowdTex.wrapT = THREE.RepeatWrapping; crowdTex.repeat.set(8, 4); crowdTex.magFilter = THREE.NearestFilter; crowdTex.colorSpace = THREE.SRGBColorSpace;
export const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.9 });
let crowdKey = "";
export function setCrowd(colors) { // colors: ["#ff6a00", "#fff", ...]
  const key = colors.join(","); if (key === crowdKey) return; crowdKey = key;
  const g = crowdCanvas.getContext("2d"); g.fillStyle = "#2a2a30"; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) { g.fillStyle = colors[(Math.random() * colors.length) | 0]; g.fillRect(x + 1, y, 2, 3); g.fillStyle = "#e8c9a4"; g.fillRect(x + 1, y - 1 < 0 ? 0 : y - 1, 2, 1); } // a head over each shirt
  crowdTex.needsUpdate = true;
}
