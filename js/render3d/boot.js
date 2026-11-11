// Starts the 3D renderer if this browser can do WebGL 2; otherwise (or on any error, or if loading stalls) the 2D renderer keeps running.
// Add ?2d to the address to force the old 2D renderer, handy for comparing.
import * as THREE from "three";
import { loadAssets } from "./assets.js";
import { prepareSky, warmSkyShaders, setSkySafe, FIRST_SKY } from "./env.js";
import { readDevice } from "./device.js";
import { createRenderer3D, createContext } from "./renderer.js";

const TIPS = ["Near misses build a combo: the bigger the combo, the bigger the points.", "Nitro canisters boost you the moment you drive through them.", "Rain makes lane changes slower: plan your line early.",
  "Shields absorb one crash. Grab them!", "Hold the gas while the lights count down: more revs means a faster launch.", "Night cities: only tail lights show on far cars. Watch the glow.",
  "Press P while paused for photo mode.", "Grand Final: first car over the line wins."];
const overlay = document.getElementById("loading"), fill = document.getElementById("loadfill");
const progress = (p, from, span) => { window.R3D_BOOT = Date.now(); if (fill) fill.style.width = Math.round(from + p * span) + "%"; }; // (also tells the watchdog in index.html we're alive)
progress(0, 0, 0);
if (overlay) document.getElementById("loadtip").textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
const STATS = location.search.includes("stats"), T0 = performance.now(), mark = what => { if (STATS) console.info(`BOOT ${what} at ${Math.round(performance.now() - T0)} ms`); }; // (testing: ?stats times each step of loading)
const hideLoading = () => { mark("loading screen gone"); crazy.loaded(); window.R3D_PENDING = false; if (overlay && overlay.isConnected) { overlay.classList.add("done"); setTimeout(() => overlay.remove(), 600); } try { grabFocus(); } catch (e) {} };
// The very first launch: Auto times the title's city for up to 3 seconds to pick a graphics preset (quality.js). The loading screen stays
// up over it, its bar filling as the time runs (the game itself already runs underneath). Whatever happens, it is gone 3.5 s later.
function afterBenchmark(r) {
  if (!r.benchmarking || !overlay) { r.finishBenchmark(); r.loadingUp = false; hideLoading(); return; }
  window.R3D_PENDING = false; const tip = document.getElementById("loadtip"); if (tip) tip.textContent = "Tuning the graphics for your device...";
  const t0 = performance.now(), wait = () => {
    progress(r.benchProgress, 88, 12);
    if ((!r.benchmarking && !r.settling) || performance.now() - t0 > 3500) { r.finishBenchmark(); r.loadingUp = false; hideLoading(); } else setTimeout(wait, 50); // (settling: a change of level's shaders are still compiling)
  }; wait();
}

// the watchdog in index.html gave up waiting (a very slow connection) and the 2D renderer is already running: stop here, so a phone
// doesn't go on downloading the 3D models and skies for nothing
const stillWanted = () => { if (!window.R3D_PENDING) throw new Error("took too long, the 2D renderer is already running"); };

function webgl2OK() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
}

if (window.NO3D) { console.log("2D renderer forced by ?2d (or the engine lab)"); hideLoading(); }
else if (!webgl2OK()) { console.warn("No WebGL 2 here: using the 2D renderer"); hideLoading(); }
else {
  try {
    stillWanted(); // (the watchdog may have given up before this code even arrived)
    const gl = document.getElementById("gl"), loading = loadAssets(p => progress(p, 0, 55)); // (the downloads start first, then the WebGL context is made while they run)
    prepareSky(FIRST_SKY).catch(() => {}); // (the title's sky downloads and decodes alongside the models)
    const context = createContext(gl), dev = readDevice(context.getContext()); setSkySafe(!dev.floatRT); if (!dev.weak) warmSkyShaders(context); mark("WebGL context made"); // (no half-float pictures in this browser: the skies take the safe path; a weak machine starts on Low, which needs no sky lighting)
    const res = await loading;   // the loading bar: models 55%, the title's sky 10%, getting the title ready 23%, tuning the graphics 12%
    if (!res.loaded) throw new Error("no models could be loaded");
    stillWanted();
    mark("models loaded");
    const r = createRenderer3D(canvas, gl, context); mark("renderer created");
    await r.init(p => progress(p, 55, 10)); mark("title sky ready");
    stillWanted(); // the watchdog gave up while we were loading
    gl.addEventListener("webglcontextlost", e => { e.preventDefault(); disable3D("WebGL context lost"); });
    gl.style.display = "block"; canvas.classList.add("over3d"); // the 2D canvas becomes see-through: it only draws menus and HUD now
    window.R3D = r;
    r.tick(); await r.prepareTitle(p => progress(p, 65, 23)); mark("title ready");
    if (new URLSearchParams(location.search).has("photo")) { state = "paused"; r.render(1); r.photo.enter(r.camera); r.photo.dof = true; r.photo.pos.y += 1.5; r.photo.pitch -= 0.1; r.photo.filter = +new URLSearchParams(location.search).get("photo") || 0; } // testing shortcut
    console.log(`3D renderer on (Three.js r${THREE.REVISION}), ${res.loaded} models${res.failed ? `, ${res.failed} failed` : ""}. Graphics: ${r.quality.level}${r.benchmarking ? " (measuring)" : ""}${r.safe ? ", safe drawing path (no half-float pictures)" : ""}; ${r.device.gpu}${r.device.weak ? ` (starts on Low: ${r.device.why.join(", ")})` : ""}`);
    afterBenchmark(r);
    r.loadInBackground().catch(e => console.warn("background loading:", e)); // the other skies, the studio and the Garage cars, a piece per frame
  } catch (e) { disable3D(e); hideLoading(); }
}

// testing: ?stats prints draw calls, triangles and frame rate to the console every few seconds
if (new URLSearchParams(location.search).has("stats")) setInterval(() => { const r = window.R3D; if (r) { const i = r.renderer.info; console.log(`STATS calls=${i.render.calls} tris=${i.render.triangles} geos=${i.memory.geometries} textures=${i.memory.textures} fps=${Math.round(r.fps)} quality=${r.quality.level}`); } }, 2500);
