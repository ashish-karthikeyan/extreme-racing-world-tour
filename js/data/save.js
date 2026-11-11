// ---------- saved progress ----------

// A saved value must have the same shape as its default (a list where a list is expected, an object where an object is, a number where a
// number is...): anything else (a damaged or hand-edited save) counts as no save at all, so the game always starts.
const sameShape = (v, d) => Array.isArray(d) ? Array.isArray(v) : d !== null && typeof d === "object" ? v !== null && typeof v === "object" && !Array.isArray(v) : d === undefined || d === null || typeof v === typeof d;
// ?fresh (testing): play as a brand-new player on a throwaway save kept in memory. The real save is never read or written, and reloading
// or closing the tab forgets the test player, so the first-time experience can be tried again and again.
const FRESH = new URLSearchParams(location.search).has("fresh"), freshSave = new Map();
// Where the save lives: on CrazyGames their SDK.data (js/crazygames.js), everywhere else this browser's localStorage. Both hold the same
// names ("cardodge." + name) and work the same way: getItem, setItem, removeItem.
const disk = () => crazy.data || localStorage;
const store = {
  get(k, d) { try { const v = FRESH ? (freshSave.has(k) ? freshSave.get(k) : null) : disk().getItem("cardodge." + k); if (v == null) return d; const p = JSON.parse(v); return sameShape(p, d) ? p : d; } catch (e) { return d; } },
  set(k, v) { try { if (FRESH) freshSave.set(k, JSON.stringify(v)); else disk().setItem("cardodge." + k, JSON.stringify(v)); } catch (e) {} },
  // Reset progress (Settings): deletes every saved value (everything starting with "cardodge."), except the names in keep
  wipe(keep) {
    if (FRESH) { for (const k of [...freshSave.keys()]) if (!keep.includes(k)) freshSave.delete(k); return; }
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("cardodge.") && !keep.includes(k.slice(9))) localStorage.removeItem(k); } catch (e) {}
    // on CrazyGames the save there too: SDK.data can't list its names, so empty it and put back the ones to keep ("copied" as well, so the
    // old browser save is never copied over again)
    if (crazy.data) try {
      const d = crazy.data, kept = [...keep, "copied"].map(k => ["cardodge." + k, d.getItem("cardodge." + k)]);
      d.clear(); for (const [k, v] of kept) if (v != null) d.setItem(k, v);
    } catch (e) { console.warn("Reset on CrazyGames:", e && e.message); }
  },
  // a saved count (coins, cities done): a whole number from 0 up, capped at max; a negative, fractional or endless one counts as no save
  count(k, max) { const v = this.get(k, 0); return Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0; },
};

let best = store.get("best", 0);
let wallet = store.count("coins", 1e9);
let owned = store.get("teams", [0, 1]);
let equipped = store.get("team", 0);
if (!owned.includes(equipped)) equipped = 0;
const savedCam = () => { const c = store.get("camera", 1); return c >= 0 && c < CAMS.length ? c : 1; }; // your camera (a new player starts on 1, Chase)
let cam = savedCam();

// ---------- settings: volumes (1 = the original mix), screen shake, reduced effects for slow machines ----------
let settings = Object.assign({ music: 1, fx: 1, engine: 1, shake: true, lowfx: false, gfx: "auto", renderScale: 0, shadows: "", effects: "", drawDist: "", fps: false }, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);
function applyVolumes() {
  if (sound.fxBus) { sound.fxBus.gain.value = settings.fx; sound.raceFx.gain.value = settings.fx; sound.engBus.gain.value = settings.engine; }
  if (music.bus) music.bus.gain.setTargetAtTime(0.5 * settings.music, sound.ac.currentTime, 0.05);
  if (music.audio) music.audio.volume = 0.6 * settings.music;
}
const maxParticles = () => settings.lowfx ? 90 : 320;
// game feel: crash flash and freeze, finish confetti (screen space)
let flashT = 0, hitStop = 0, confetti = [];
const FLAG_COLS = { au: ["#012169", "#ffffff", "#e4002b"], cn: ["#de2910", "#ffde00"], jp: ["#ffffff", "#bc002d"], us: ["#b22234", "#ffffff", "#3c3b6e"], ca: ["#d52b1e", "#ffffff"],
  mc: ["#ce1126", "#ffffff"], es: ["#aa151b", "#f1bf00"], at: ["#ed2939", "#ffffff"], gb: ["#012169", "#ffffff", "#c8102e"], be: ["#1a1a1a", "#fdda24", "#ef3340"],
  hu: ["#ce2939", "#ffffff", "#477050"], nl: ["#ae1c28", "#ffffff", "#21468b"], it: ["#009246", "#ffffff", "#ce2b37"], az: ["#0092bc", "#e4002b", "#00af66"],
  sg: ["#ef3340", "#ffffff"], mx: ["#006847", "#ffffff", "#ce1126"], br: ["#009c3b", "#ffdf00", "#002776"], qa: ["#8a1538", "#ffffff"], ae: ["#00732f", "#ffffff", "#1a1a1a", "#ff0000"] };
function throwConfetti(flag) { // a shower in the city's flag colours
  const cols = FLAG_COLS[flag] || ["#ffd23f", "#ffffff"];
  for (let i = 0, n = settings.lowfx ? 50 : 140; i < n; i++) confetti.push({ x: rnd(0, W), y: rnd(-H * 0.6, -10), vx: rnd(-0.6, 0.6), vy: rnd(1, 2.6), rot: rnd(0, TAU), vr: rnd(-0.15, 0.15), w: rnd(4, 8), h: rnd(6, 11), ph: rnd(0, TAU), c: pick(cols) });
}
function rumbleSoft() { try { for (const g of navigator.getGamepads()) if (g && g.vibrationActuator) g.vibrationActuator.playEffect("dual-rumble", { duration: 110, strongMagnitude: 0.2, weakMagnitude: 0.5 }); } catch (e) {} }

