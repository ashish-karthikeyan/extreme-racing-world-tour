// Graphics quality: five presets (Low, Medium, High, Ultra, Max), plus "Auto", which picks one from a quick benchmark on each launch
// and drops a level for the session whenever the frame rate stays low. Each setting can also be changed by hand in the Settings menu.

export const LEVELS = ["low", "medium", "high", "ultra", "max"];

// The numbers behind each preset.
//   scale     render resolution in the race (1 = the window's real pixels); menuScale / garageScale = the same for the title + main menu / the Garage
//   maxPR     the most pixels drawn per window pixel, on any screen (a Retina screen has 2 or 3: drawing them all costs 4 to 9 times as much)
//   direct    draw straight to the screen with no post-processing at all (no buffers in between: the cheapest way there is)
//   simple    simple lighting on every shiny material: no highlights, clear coat or sky reflections (lowshading.js)
//   shadows   shadow-map size (0 = off); shadowArea = how far ahead the sun's shadows reach (units); garageShadows = the showroom's shadow map
//   msaa      multisampling;  fxaa / smaa = the anti-aliasing pass;  bloom / grade = post-processing;  flare / ca / dof = lens effects
//   particles sparks / smoke / spray (0..1.5);  rain = raindrops (0..1);  dist = fog / draw distance (0..1.2)
//   cityAhead how far ahead the city is built (x the full distance);  cityDensity = how many lots are built on (0.5 sparse .. 1.25 packed)
//   cityDetail 1 = each city's extra signature detail (roofs, marinas, hill towns, the small parts of landmarks, the briefing plaza's dressing); 0 = shapes only
//   carLod    how far away cars keep their detail (1 normal; smaller = cheaper models sooner)
//   ibl       lighting from the sky image (off = a cheap fixed ambient);  mirrorRes = cockpit mirror size;  reflect = planar reflections on a wet road
//   ao        ambient occlusion (GTAO) at this fraction of the screen's resolution (0 = off);  trails = the nitro streaks
//   paint     how strongly the race cars' clear-coated paint reflects the city's sky (x the city's own light; 0 = like everything else)
// Low is for a weak laptop or a phone: 60 fps first. Max is everything the renderer can do, for a strong desktop graphics card.
export const PRESETS = {
  low:    { scale: 0.75, maxPR: 1,   direct: true,  simple: true,  menuScale: 1.0, garageScale: 1.0, shadows: 0,    shadowArea: 70,  garageShadows: 0,    msaa: 0, fxaa: true,  smaa: false, bloom: false, grade: false, flare: false, ca: false, dof: false, particles: 0.3, rain: 0.45, dist: 0.7,  ibl: false, mirrorRes: 128,  reflect: false, trails: false, cityAhead: 0.5,  cityDensity: 0.5,  cityDetail: 0, carLod: 0.45, ao: 0, paint: 0 },
  medium: { scale: 1.0,  maxPR: 1.5, direct: false, simple: false, menuScale: 1.25, garageScale: 1.2, shadows: 1024, shadowArea: 70,  garageShadows: 1024, msaa: 0, fxaa: true,  smaa: false, bloom: true,  grade: true,  flare: false, ca: true,  dof: false, particles: 0.6, rain: 0.7,  dist: 0.85, ibl: true,  mirrorRes: 192,  reflect: false, trails: true,  cityAhead: 0.75, cityDensity: 0.75, cityDetail: 1, carLod: 0.8,  ao: 0, paint: 0 },
  high:   { scale: 1.0,  maxPR: 2,   direct: false, simple: false, menuScale: 1.6, garageScale: 1.4, shadows: 2048, shadowArea: 100, garageShadows: 2048, msaa: 4, fxaa: false, smaa: true,  bloom: true,  grade: true,  flare: true,  ca: true,  dof: true,  particles: 1.0, rain: 1.0,  dist: 1.0,  ibl: true,  mirrorRes: 256,  reflect: true,  trails: true,  cityAhead: 1,    cityDensity: 1,    cityDetail: 1, carLod: 1,    ao: 0.5, paint: 1.7 },
  ultra:  { scale: 1.25, maxPR: 2.6, direct: false, simple: false, menuScale: 1.6, garageScale: 1.6, shadows: 4096, shadowArea: 125, garageShadows: 2048, msaa: 4, fxaa: false, smaa: true,  bloom: true,  grade: true,  flare: true,  ca: true,  dof: true,  particles: 1.4, rain: 1.0,  dist: 1.0,  ibl: true,  mirrorRes: 512,  reflect: true,  trails: true,  cityAhead: 1,    cityDensity: 1,    cityDetail: 1, carLod: 1.7,  ao: 0.75, paint: 1.85 },
  max:    { scale: 1.5,  maxPR: 2.6, direct: false, simple: false, menuScale: 2.0, garageScale: 2.0, shadows: 4096, shadowArea: 105, garageShadows: 4096, msaa: 8, fxaa: false, smaa: true,  bloom: true,  grade: true,  flare: true,  ca: true,  dof: true,  particles: 1.5, rain: 1.0,  dist: 1.2,  ibl: true,  mirrorRes: 1024, reflect: true,  trails: true,  cityAhead: 1.3,  cityDensity: 1.25, cityDetail: 1, carLod: 2.5,  ao: 1.0, paint: 2.0 },
};
export const MAX_CITY_AHEAD = 1.3; // (the city builder sizes its rings for the furthest preset)

const SCALES = [0.5, 0.75, 1, 1.25, 1.5];
const SHADOWS = { off: 0, low: 1024, high: 2048, ultra: 4096 };
const EFFECTS = { low: 0.3, medium: 0.6, high: 1.0, max: 1.5 };
const DIST = { short: 0.7, medium: 0.85, long: 1.0, max: 1.2 };

// Turn the saved settings + the Auto level into the numbers to use now.
export function resolve(settings, autoLevel) {
  const name = settings.gfx === "auto" || !PRESETS[settings.gfx] ? LEVELS[autoLevel] : settings.gfx;
  const q = { ...PRESETS[name], level: name };
  if (settings.renderScale) { q.scale = settings.renderScale; q.maxPR = 2.6; } // (a resolution picked by hand is taken as it is)
  if (settings.shadows && SHADOWS[settings.shadows] !== undefined) q.shadows = SHADOWS[settings.shadows];
  if (settings.effects && EFFECTS[settings.effects] !== undefined) { q.particles = EFFECTS[settings.effects]; q.rain = Math.min(1, 0.3 + EFFECTS[settings.effects] * 0.7); if (settings.effects === "low") { q.flare = false; q.ca = false; q.trails = false; } }
  if (settings.drawDist && DIST[settings.drawDist]) q.dist = DIST[settings.drawDist];
  return q;
}
export const gfxDefaults = name => { const p = PRESETS[name] || PRESETS.high; return { renderScale: p.scale, shadows: p.shadows === 0 ? "off" : p.shadows <= 1024 ? "low" : p.shadows <= 2048 ? "high" : "ultra", effects: p.particles <= 0.3 ? "low" : p.particles <= 0.6 ? "medium" : p.particles <= 1 ? "high" : "max", drawDist: p.dist <= 0.7 ? "short" : p.dist <= 0.85 ? "medium" : p.dist <= 1 ? "long" : "max" }; };
export const OPTIONS = { SCALES, SHADOWS: Object.keys(SHADOWS), EFFECTS: Object.keys(EFFECTS), DIST: Object.keys(DIST) };

// ---- Auto: the benchmark on every launch, and the watchdog ----
// The benchmark runs on each launch, behind the loading screen, on the title's city at night:
//   start    Ultra on a strong graphics card (device.js: NVIDIA RTX, AMD Radeon RX 5000 and newer, Apple M Pro / Max / Ultra in Chrome),
//            Low on a machine that looks weak; anything else starts on the level the last launch measured (Medium the very first time)
//   measure  each frame's real cost: the time the renderer spent on it, waiting until the graphics chip has finished. Not the time between
//            frames: a browser that caps a page at 30 fps (battery saver, a window in the background) would make any card look slow.
//            Frames don't count while the tab is hidden or the window isn't focused, while shaders compile or while loading runs.
//   decide   after about half a second at a level: over 18 ms a frame (it can't hold 60 fps), one level down; if the next level up should
//            still fit in about 12 ms (UP), one level up (never back up after a step down); otherwise keep it. Four very slow frames in a
//            row: Low at once.
//   limit    3 seconds the first time, 1.5 s afterwards (1.2 s on a weak machine). The result is saved: the next launch starts from it.
// The watchdog, afterwards, on every screen: frames staying slow (under ~42 fps for 3 s, or under ~22 fps for 1 s) drop a level, for this
// session only, never saved. After 30 s of smooth frames it steps back up again (on a menu, never in a race) to the benchmark's level;
// if that makes it slow again soon, it waits twice as long before trying again.
const KEY = "gfxAuto4"; // (a new save key: every player is measured again; the old one remembered the watchdog's drops for ever)
const BENCH_MS = 3000, BENCH_AGAIN_MS = 1500, BENCH_WEAK_MS = 1200, WARM_MS = 250, DOWN_MS = 18, VERY_SLOW = 70;
const UP = [5, 7.5, 9, 7]; // UP[l]: step up from level l when its frames take under this many ms (the next level costs ~1.3 to 2.4 times more: it should land under ~12 ms)
const UP_WAIT = 30000, UP_WAIT_MAX = 300000;
const LOG = typeof location !== "undefined" && location.search.includes("stats");
export function createAuto(store, device, forced = false) {
  const saved = store.get(KEY, -1); // -1 = never measured on this device
  const first = saved < 0;
  let level = device.weak ? 0 : device.strong ? 3 : first ? 1 : Math.min(saved, LEVELS.length - 1);
  const b = { on: !forced, limit: device.weak ? BENCH_WEAK_MS : first ? BENCH_MS : BENCH_AGAIN_MS, t: 0, since: 0, frames: 0, n: 0, s: new Float32Array(24), slow: 0, down: false, proven: -1, why: "" }; // (testing with ?gfx=...: no benchmark, nothing saved)
  let costAvg = 0, slowT = 0, hold = 0, avg = 16.7, screen = "", dyn = 1, dynT = 0, dynHold = 0, upWait = 6000, sinceUp = 1e9;
  let ceiling = level, smoothT = 0, wdWait = UP_WAIT, sinceWdUp = 1e9; // the watchdog: the benchmark's level, and when to try stepping back up to it
  const median = () => { const a = b.s.subarray(0, b.n); a.sort(); return a[b.n >> 1]; };
  const restart = to => { level = to; b.since = 0; b.frames = 0; b.n = 0; b.slow = 0; };
  function done(why, save = true) {
    if (!b.on) return; b.on = false; b.why = why; ceiling = level;
    if (save) store.set(KEY, level);
    if (LOG) console.info(`GFX benchmark: ${LEVELS[level]} after ${Math.round(b.t)} ms (${why})`);
  }
  return {
    get level() { return level; }, get benchmarking() { return b.on; },
    get progress() { return b.on ? Math.min(1, b.t / b.limit) : 1; }, // (for the loading bar)
    // what a frame really costs us, sampled now and then by the renderer: when it is far below the time between frames, something else
    // sets the pace (a browser's battery saver caps a page at 30 fps), and lowering the graphics would not help
    cost(ms) { costAvg = costAvg ? costAvg + (ms - costAvg) * 0.3 : ms; },
    get capped() { return costAvg > 0 && costAvg < avg * 0.5; }, // the frames are slow, but our own work isn't why (a frame-rate cap sets the pace)
    get dynScale() { return dyn; }, // Low only: the render resolution steps down (to 50%) while the frame rate stays under 60, and back up when there is room
    // stop the benchmark now (the loading screen gave up, or the player left the title): keep the last level that fitted; true if that changed it
    finish(why = "stopped", keep = false) { // keep: no fair frame could be measured at all (shaders still compiling): stay on this level, unsaved
      if (!b.on) return false; const was = level;
      if (keep) { done(why + ": measured again next launch", false); return false; }
      if (b.proven >= 0 && level > b.proven) level = b.proven; // (a step up that was never measured doesn't count)
      else if (b.n < 3) { done(why + ", too few clean frames: measured again next launch", false); return false; } // (nothing fair was measured: keep the starting level, unsaved)
      else if (median() > DOWN_MS) level = Math.max(0, level - 1); // (out of time with slow frames: a slow machine)
      done(why); return level !== was;
    },
    // Low only, once per frame: true when dynScale changed
    lowFrame(ms) {
      sinceUp += ms;
      if (dynHold > 0) { dynHold -= ms; return false; }
      const very = avg > 30, ours = !costAvg || costAvg > avg * 0.5; // (the slowness is our own work, not a frame-rate cap)
      if (avg > 17.8 && dyn > 0.5 && ours) {
        if ((dynT += ms) > (very ? 500 : 1500)) { if (sinceUp < 5000) upWait = Math.min(60000, upWait * 2); dyn = Math.max(0.5, dyn - (very ? 0.15 : 0.1)); dynT = 0; dynHold = very ? 1000 : 2500; return true; } // (a step up that made it slow again: wait longer before the next one)
      } else if (avg < 17.4 && dyn < 1) { // (steady at the screen's own rate: try a little sharper)
        if ((dynT += ms) > upWait) { dyn = Math.min(1, dyn + 0.1); dynT = 0; dynHold = 2500; sinceUp = 0; return true; }
      } else dynT = 0;
      return false;
    },
    // call once per frame: ms = the time since the last frame, cost = what the last frame really cost (benchmark only: -1 = no frame was drawn
    // or it compiled a shader), where = the screen on show, quiet = this frame doesn't count (hidden or unfocused, loading, shaders compiling).
    // Returns true when the level changed.
    frame(ms, cost, where, quiet = false) {
      if (b.on) {
        if (where !== "title") return this.finish("left the title");
        if (b.t > b.limit) return this.finish("time limit");
        if (quiet) { b.skip = true; return false; } // (the clock only runs while frames can be measured fairly)
        b.t += ms; b.since += ms; b.frames++;
        if (cost < 0) { b.skip = true; return false; } // (that frame compiled a shader: neither it nor the frame after it is a fair sample)
        if (b.skip) { b.skip = false; return false; }
        if (b.frames <= 2 || b.since < WARM_MS) return false; // (just after a change of level: shaders compile, the city is built)
        if (cost > VERY_SLOW) { if (++b.slow >= 4) { const was = level; level = 0; done("very slow"); return level !== was; } } else b.slow = 0;
        if (b.n < b.s.length) b.s[b.n++] = cost;
        if (b.n >= 16 || (b.since > 900 && b.n >= 6)) {
          const m = median();
          if (LOG) console.info(`GFX benchmark: ${LEVELS[level]} costs ${m.toFixed(1)} ms a frame`);
          if (m > DOWN_MS && level > 0) { b.down = true; restart(level - 1); if (level === 0 || level <= b.proven) done("too slow"); return true; }
          if (!b.down && level < LEVELS.length - 1 && m < UP[level]) { b.proven = level; restart(level + 1); return true; }
          done("fits");
        }
        return false;
      }
      // the watchdog, on every screen: frames averaging over 24 ms (under ~42 fps) for 3 s, or over 45 ms (under ~22 fps) for 1 s: one level
      // down for this session (not saved). Quiet frames (hidden, unfocused, loading, compiling) and a new screen's first moments don't count.
      sinceWdUp += ms;
      if (where !== screen) { screen = where; hold = Math.max(hold, 1500); } // (a new screen: its shaders compile and its scene is built; give it a moment)
      if (quiet) { hold = Math.max(hold, 500); slowT = smoothT = 0; return false; }
      avg += (Math.min(ms, 120) - avg) * 0.05; // (a hitch, or the first frame back from a hidden tab, counts only as one slow frame)
      if (hold > 0) { hold -= ms; slowT = 0; return false; }
      const very = avg > 45;
      if (avg > 24 && (!costAvg || costAvg > avg * 0.5)) {
        smoothT = 0;
        if ((slowT += ms) > (very ? 1000 : 3000) && level > 0) {
          if (sinceWdUp < 20000) wdWait = Math.min(UP_WAIT_MAX, wdWait * 2); // (the last step back up made it slow again: wait longer next time)
          level--; slowT = 0; hold = very ? 3000 : 8000; avg = 16.7; if (LOG) console.info(`GFX watchdog: down to ${LEVELS[level]} for this session`); return true;
        }
      } else {
        slowT = 0;
        // smooth for a while, below the benchmark's level: step back up, on a menu (never mid-race: the new level's shaders compile)
        if (level < ceiling && avg < 18) { smoothT += ms; if (smoothT > wdWait && where !== "playing") { level++; smoothT = 0; sinceWdUp = 0; hold = 3000; if (LOG) console.info(`GFX watchdog: back up to ${LEVELS[level]}`); return true; } }
        else smoothT = 0;
      }
      return false;
    },
  };
}
