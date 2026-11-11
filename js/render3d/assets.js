// Loads the .glb models (all free CC0 packs, see CREDITS.md) and hands out copies of them.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js"; // (the street kit and the city packs are meshopt-compressed: this is the decoder that ships with three.js r170)

const BASE = "assets/models/";
const list = (folder, names) => Object.fromEntries(names.map(n => [n, `${folder}/${n}.glb`]));

// name in the game -> file under assets/models
export const FILES = {
  ...list("race", ["raceCarRed", "grandStand", "grandStandCovered", "grandStandRound", "billboard", "billboardLow", "flagCheckers", "flagRed", "flagGreen",
    "lightPostModern", "lightPostLarge", "barrierWall", "barrierRed", "barrierWhite", "pylon", "overhead", "overheadLights", "bannerTowerRed", "bannerTowerGreen", "tent", "tentClosed", "fenceStraight"]),
  ...list("traffic", ["sedan", "sedan-sports", "hatchback-sports", "suv", "suv-luxury", "taxi", "van", "delivery", "truck", "cone"]),
  ...list("debris", ["debris-bumper", "debris-door", "debris-door-window", "debris-drivetrain", "debris-drivetrain-axle", "debris-plate-a", "debris-plate-b",
    "debris-plate-small-a", "debris-plate-small-b", "debris-spoiler-a", "debris-spoiler-b", "debris-tire", "debris-bolt", "debris-nut"]),
  ...list("nature", ["tree_default", "tree_oak", "tree_fat", "tree_tall", "tree_thin", "tree_simple", "tree_cone", "tree_small", "tree_palmTall", "tree_palmDetailedTall",
    "tree_palmShort", "tree_palmBend", "tree_pineTallA", "tree_pineTallB", "tree_pineTallC", "tree_pineRoundA", "tree_pineSmallA", "cactus_short", "cactus_tall",
    "plant_bush", "plant_bushLarge", "plant_bushDetailed", "rock_largeA", "rock_largeB", "rock_largeC", "rock_tallA", "rock_tallB", "rock_smallA", "rock_smallB",
    "stone_largeA", "stone_largeB", "stone_tallA", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "statue_obelisk", "statue_column", "statue_block", "statue_ring", "cliff_rock"]),
  ...list("city", ["building-a", "building-b", "building-c", "building-d", "building-e", "building-f", "building-g", "building-h", "building-i", "building-j", "building-k",
    "building-l", "building-m", "building-n", "building-skyscraper-a", "building-skyscraper-b", "building-skyscraper-c", "building-skyscraper-d", "building-skyscraper-e",
    "low-detail-building-a", "low-detail-building-b", "low-detail-building-c", "low-detail-building-d", "low-detail-building-e", "low-detail-building-wide-a", "low-detail-building-wide-b"]),
  ...list("suburb", ["building-type-a", "building-type-b", "building-type-c", "building-type-d", "building-type-e", "building-type-f", "building-type-g", "building-type-h",
    "building-type-i", "building-type-j", "tree-large", "tree-small"]),
  ...list("street", ["barrier", "lamp-a", "bin", "hydrant", "bench-modern", "utility-box"]), // (Poly Haven, CC0: see city/kit.js)
};

const scenes = new Map();
export const hasModel = name => scenes.has(name);

// loads everything in parallel; onProgress(0..1) feeds the loading bar. A model that fails to load is simply missing (placeholders cover it).
// onProgress is also called (with the same value) whenever a piece of any file arrives: on a slow connection many models wait for their
// shared Textures/colormap.png, which queues behind all the others, so whole seconds can pass with data flowing but no model finished;
// those calls tell the loading watchdog (index.html) that we're still alive, so it only gives up when the connection really stops.
export async function loadAssets(onProgress = () => {}) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), names = Object.keys(FILES), alive = () => onProgress(done / names.length);
  let done = 0, failed = 0;
  await Promise.all(names.map(n => loader.loadAsync(BASE + FILES[n], alive).then(g => scenes.set(n, g.scene)).catch(e => { failed++; console.warn("model failed:", n, e.message || e); }).finally(() => onProgress(++done / names.length))));
  return { loaded: scenes.size, failed };
}

// a fresh copy of a model (geometry and materials are shared with the original, so copies are cheap)
export function cloneModel(name) { return scenes.get(name).clone(true); }
export const sceneOf = name => scenes.get(name);

// Scale a model so its longest chosen axis is `size` long, centre it left/right and front/back, and put its feet on the ground.
// Returns a wrapper Group so the caller can still move and rotate it freely.
export function fitModel(model, { length, width, height, rotY = 0, scale }) {
  const wrap = new THREE.Group(); model.rotation.y = rotY; wrap.add(model);
  wrap.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  const k = scale || (length ? length / size.z : width ? width / size.x : height / size.y);
  model.scale.setScalar(k); wrap.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -box.min.y, -c.z); wrap.updateMatrixWorld(true);
  wrap.userData.size = box.getSize(new THREE.Vector3()); wrap.userData.k = k;
  return wrap;
}
