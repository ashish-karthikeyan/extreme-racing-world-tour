// ---------- menus ----------

// ---- garage upgrades: 5 levels each, bought with coins; they only ever help human drivers ----
const UPGRADES = [
  // now(l): what level l does; next(l): the short version shown after the arrow
  { key: "handling", name: "Handling", now: l => `Lane changes +${l * 8}%`, next: l => `+${l * 8}%` },
  { key: "nitro", name: "Nitro", now: l => `Nitro burns ${(NITRO_FRAMES * (1 + 0.15 * l) / 60).toFixed(1)} s`, next: l => `${(NITRO_FRAMES * (1 + 0.15 * l) / 60).toFixed(1)} s` },
  { key: "magnet", name: "Magnet", now: l => l ? `Next-lane coins, range ${70 + 35 * l}` : "Off: pulls in next-lane coins", next: l => `range ${70 + 35 * l}` },
  { key: "shield", name: "Shield", now: l => `${l * 12}% chance to start shielded`, next: l => `${l * 12}%` },
];
const UPG_COST = [30, 60, 110, 180, 270]; // price of levels 1..5
let upg = store.get("upgrades", {});
const upLvl = k => upg[k] || 0;
const nitroFramesFor = r => r.ai ? NITRO_FRAMES : Math.round(NITRO_FRAMES * (1 + 0.15 * upLvl("nitro")));
function buyUpgrade(u) {
  const l = upLvl(u.key);
  if (l >= 5 || wallet < UPG_COST[l]) { sound.tone(200, 120, 0.2, "sawtooth", 0.05); garageFx.denied(); return; }
  wallet -= UPG_COST[l]; upg[u.key] = l + 1;
  if (l + 1 >= 5) unlock("maxup");
  store.set("coins", wallet); store.set("upgrades", upg);
  garageFx.upgraded();
}

function garageAction() {
  const t = TEAMS[garageIdx];
  if (owned.includes(garageIdx)) { equipped = garageIdx; store.set("team", equipped); garageFx.equipped(); return; }
  if (wallet < t.cost) { sound.tone(200, 120, 0.2, "sawtooth", 0.05); garageFx.denied(); return; }
  wallet -= t.cost; owned.push(garageIdx); equipped = garageIdx;
  store.set("coins", wallet); store.set("teams", owned); store.set("team", equipped);
  garageFx.bought(garageIdx);
}

const songInput = document.getElementById("songInput");
songInput.addEventListener("change", async () => {
  const files = Array.from(songInput.files || []);
  for (const f of files) {
    music.addBlob(f.name, f);
    try { await songDB.add(f.name, f); } catch (e) {}
  }
  if (files.length) say(`Added ${files.length} song${files.length > 1 ? "s" : ""}`);
  songInput.value = "";
});

// A change between the studio (menu, Garage, tyres) and a city (map, briefing, race) goes behind a quick light sweep (js/ui/screenfx.js).
const sceneFx = fn => screenFx.go(fn);
const toMenuFx = () => sceneFx(toMenu);
const MAIN_MENU = [
  { label: "VS Computer", go: () => openMenu("difficulty", 1) }, // (first: the favourite mode)
  { label: "World Tour", go: () => sceneFx(openMap) }, // the map of all 22 cities
  { label: "Daily Challenge", go: () => startGame("daily", null, dailyCity()) },
  { label: "Endless", go: () => startGame("single") },
  { label: "Multiplayer", go: () => startGame("multi") },
  { label: "Garage", go: () => { garageIdx = equipped; openMenu("garage"); } },
  { label: "Stats & Awards", go: () => openMenu("stats") },
  { label: "Settings", go: () => { resetAsk = 0; openMenu("options"); } },
];
// Settings: three volume sliders (Left / Right or tap the bar), toggles, the controls page and the songs sub-menu
function setSlider(key, v) { settings[key] = Math.round(clamp(v, 0, 1) * 10) / 10; saveSettings(); applyVolumes(); if (key !== "music") sound.tone(600, 600, 0.05, "square", 0.03); }
// Performance mode: the Low graphics preset (or, in the 2D version, Reduce effects), easy to find at the top of Settings. Off goes back to Auto.
const perfOn = () => window.R3D ? settings.gfx === "low" : !!settings.lowfx;
function togglePerf() {
  if (!window.R3D) { settings.lowfx = !settings.lowfx; saveSettings(); fit(); return; }
  settings.gfx = settings.gfx === "low" ? "auto" : "low"; Object.assign(settings, { renderScale: 0, shadows: "", effects: "", drawDist: "" }); gfxApply(); // (the row itself shows ON / OFF)
}
const OPTIONS_MENU = [
  { id: "perf", label: () => `Performance mode: ${perfOn() ? "ON" : "OFF"}`, w: 300, go: togglePerf },
  { slider: "music", name: "Music", label: "", w: 300, go: () => {} },
  { slider: "fx", name: "Effects", label: "", w: 300, go: () => {} },
  { slider: "engine", name: "Engine", label: "", w: 300, go: () => {} },
  { label: () => `Screen shake: ${settings.shake ? "ON" : "OFF"}`, w: 300, go: () => { settings.shake = !settings.shake; saveSettings(); } },
  { id: "graphics", label: "Graphics...", w: 300, go: () => openMenu("graphics") },
  { label: () => `Fullscreen: ${document.fullscreenElement || document.webkitFullscreenElement ? "ON" : "OFF"}`, w: 300, go: () => toggleFullscreen() },
  { id: "controls", label: "Controls", w: 300, go: () => { controlsTab = onPad() ? 1 : onTouch() ? 2 : 0; openMenu("controls"); } }, // opens on the page for what you are holding
  { label: "How to Play", w: 300, go: () => howToPlay() }, // the test drive again
  { id: "credits", label: "Credits", w: 300, go: () => openMenu("credits") },
  { id: "songs", label: () => `Songs...${music.userCount ? ` (${music.userCount} of yours)` : ""}`, w: 300, go: () => openMenu("songs") },
  { id: "reset", label: "Reset progress...", w: 300, go: () => { resetAsk = 1; sel = 2; } },
  { label: "Back", go: () => openMenu("menu", 7) },
];
// ---- Reset progress: Settings asks twice, then deletes the save and starts the game again as a new player ----
// "Reset my progress" keeps the graphics, the volumes, the mute and the camera; "Reset everything" deletes those too. (Your own songs stay.)
let resetAsk = 0, resetAll = false; // 0: Settings as usual; 1: the first question; 2: the last check
const RESET_KEEP = ["settings", "sound", "music", "camera", "gfxAuto4", "gfxSafe", "perfGuard"]; // (gfxAuto4 and gfxSafe: what the graphics measured on this device)
const cancelReset = () => { resetAsk = 0; sel = optAt("reset"); };
const RESET_ASK = [
  { label: "Yes, reset my progress", w: 330, go: () => { resetAll = false; resetAsk = 2; sel = 1; } },
  { label: "Reset everything (settings too)", w: 330, go: () => { resetAll = true; resetAsk = 2; sel = 1; } },
  { label: "Cancel", w: 330, go: cancelReset },
];
const RESET_SURE = [
  { label: () => resetAll ? "Reset everything now" : "Reset my progress now", w: 330, go: () => { store.wipe(resetAll ? [] : RESET_KEEP); location.replace(location.pathname + (FRESH ? "?fresh" : "")); } }, // (back to the title, as a new player)
  { label: "Cancel", w: 330, go: cancelReset },
];
// ---- Graphics settings (the 3D renderer): a preset, then each setting on its own. Enter or Left / Right cycles a row. ----
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const optAt = id => OPTIONS_MENU.findIndex(o => o.id === id); // (where a row is in Settings, to come back to it)
const cycleIn = (list, cur, dir) => list[(list.indexOf(cur) + list.length + dir) % list.length];
function gfxApply() { saveSettings(); if (window.R3D) R3D.refreshQuality(); fit(); }
const gfxShown = key => settings[key] || (R3D.gfxDefaults(R3D.quality.level)[key]); // what a setting currently is (its own value, or the preset's)
const GRAPHICS_MENU = [
  { label: () => window.R3D ? `Graphics: ${settings.gfx === "auto" ? `Auto (${cap(R3D.quality.level)})` : cap(settings.gfx)}` : "Graphics: 2D mode", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.gfx = cycleIn(["auto", "low", "medium", "high", "ultra", "max"], settings.gfx, dir); Object.assign(settings, { renderScale: 0, shadows: "", effects: "", drawDist: "" }); gfxApply(); }, go: () => GRAPHICS_MENU[0].cycle(1) },
  { label: () => window.R3D ? `Render scale: ${Math.round(R3D.quality.scale * 100)}%` : "Render scale: -", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.renderScale = cycleIn(R3D.OPTIONS.SCALES, R3D.quality.scale, dir); gfxApply(); }, go: () => GRAPHICS_MENU[1].cycle(1) },
  { label: () => window.R3D ? `Shadows: ${cap(gfxShown("shadows"))}` : "Shadows: -", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.shadows = cycleIn(R3D.OPTIONS.SHADOWS, gfxShown("shadows"), dir); gfxApply(); }, go: () => GRAPHICS_MENU[2].cycle(1) },
  { label: () => window.R3D ? `Effects: ${cap(gfxShown("effects"))}` : "Effects: -", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.effects = cycleIn(R3D.OPTIONS.EFFECTS, gfxShown("effects"), dir); gfxApply(); }, go: () => GRAPHICS_MENU[3].cycle(1) },
  { label: () => window.R3D ? `Draw distance: ${cap(gfxShown("drawDist"))}` : "Draw distance: -", w: 300,
    cycle: dir => { if (!window.R3D) return; settings.drawDist = cycleIn(R3D.OPTIONS.DIST, gfxShown("drawDist"), dir); gfxApply(); }, go: () => GRAPHICS_MENU[4].cycle(1) },
  { label: () => `FPS counter: ${settings.fps ? "ON" : "OFF"}`, w: 300, cycle: () => { settings.fps = !settings.fps; saveSettings(); }, go: () => GRAPHICS_MENU[5].cycle(1) },
  { label: () => `Cinematic cameras: ${settings.cinema === false ? "OFF" : "ON"}`, w: 300, cycle: () => { settings.cinema = settings.cinema === false; saveSettings(); if (window.R3D) R3D.cinematic = settings.cinema; }, go: () => GRAPHICS_MENU[6].cycle(1) },
  { label: () => `Reduce effects (2D mode): ${settings.lowfx ? "ON" : "OFF"}`, w: 300, cycle: () => { settings.lowfx = !settings.lowfx; saveSettings(); fit(); }, go: () => GRAPHICS_MENU[7].cycle(1) },
  { label: "Back", go: () => openMenu("options", optAt("graphics")) },
];
const SONGS_MENU = [
  { label: "Next Song", go: () => music.next() },
  { label: () => `Add My Songs${music.userCount ? ` (${music.userCount})` : ""}`, go: () => songInput.click() },
  { label: "Clear My Songs", go: () => { music.clearUser(); songDB.clear().catch(() => {}); say("Songs cleared"); } },
  { label: "Back", go: () => openMenu("options", optAt("songs")) },
];
const CREDITS_MENU = [{ label: "Back", go: () => openMenu("options", optAt("credits")) }];
const CONTROLS_MENU = [{ label: "Back", go: () => openMenu("options", optAt("controls")) }];
let controlsTab = 0; // 0 keyboard, 1 controller, 2 touch
const DIFF_MENU = [
  { label: "Easy", go: () => startGame("vs", "easy") },
  { label: "Medium", go: () => startGame("vs", "medium") },
  { label: "Hard", go: () => startGame("vs", "hard") },
  { label: "Impossible", go: () => startGame("vs", "impossible") },
  { label: "Back", go: () => openMenu("menu", 0) },
];
// ---- World Tour map: 22 tiles in two columns; a city unlocks once the one before it is finished ----
const MAP_COLS = 2, MAP_ROWS = Math.ceil(ROUTE.length / MAP_COLS);
const unlocked = i => i <= tourCleared;
function openMap() { mapIdx = Math.min(tourCleared, ROUTE.length - 1); jumpTo(mapIdx, 0.3); if (window.R3D && R3D.prepShowcase) R3D.prepShowcase(mapIdx); openMenu("map"); sel = -1; } // starts on the next unfinished city
function mapTile(i) { // tiles run down the first column, then the second
  const tw = Math.min((W - 24) / 2, 250), x0 = W / 2 - tw - 3, c = Math.floor(i / MAP_ROWS), r = i % MAP_ROWS;
  return { x: x0 + c * (tw + 6), y: 64 + r * 34, w: tw, h: 31 };
}
let mapJump = 0; // (the city behind the map changes behind a quick dip of the picture, not with a cut)
function moveMap(i) {
  if (i === mapIdx) return; mapIdx = i; sound.tone(520, 520, 0.04, "square", 0.03);
  if (!window.R3D) { jumpTo(mapIdx, 0.3); return; }
  screenFx.dip(); clearTimeout(mapJump); mapJump = setTimeout(() => { if (state === "map" || state === "brief") { jumpTo(mapIdx, 0.3); if (R3D.prepShowcase) R3D.prepShowcase(mapIdx); } }, 110); // (the city's briefing landmark is built now, hidden by the dip)
}
function startCity(i) { // picking a city opens its briefing: targets and missions, then RACE
  if (!unlocked(i)) { sound.tone(200, 120, 0.2, "sawtooth", 0.05); say(`Finish ${ROUTE[i - 1].venue} to unlock`); return; }
  openMenu("brief");
}
const MAP_MENU = [{ label: "Back", go: () => sceneFx(() => { initDemo(); openMenu("menu", 1); }) }];
const BRIEF_MENU = [
  { label: "RACE", big: true, go: () => sceneFx(() => startGame("tour", null, mapIdx)) },
  { label: "Back", go: () => { openMenu("map"); sel = -1; } },
];

// ---- missions: 3 optional goals per tour city, paid in coins (the counts grow with the city's length: TOUR_K). Count goals complete the moment you reach them;
// the "finish without..." ones are checked at the line. ----
const MISSION_TYPES = [
  { text: n => `${n} near misses in one run`, n: i => Math.round(TOUR_K * (3 + Math.floor(i / 4))), now: r => r.nm || 0 },
  { text: n => `Collect ${n} coins`, n: i => Math.round(TOUR_K * (12 + Math.floor(i * 0.8))), now: r => r.coins },
  { text: n => `Pass ${n} cars`, n: i => 5 * Math.round(TOUR_K * (40 + Math.floor(i * 1.5)) / 5), now: r => r.passed },
  { text: n => `Reach a x${n} combo`, n: i => 3 + Math.floor(i / 6), now: r => r.bestCombo || 0 },
  { text: n => `Hit ${n} km/h`, n: i => 320 + 10 * Math.floor(i / 2), now: r => Math.round((r.topV || 0) * 60) },
  { text: () => "Finish without braking", finish: r => !r.braked },
  { text: () => "Finish without picking up nitro", finish: r => !r.usedNitro },
];
const cityMissions = i => [i, i + 2, i + 4].map(k => { const m = MISSION_TYPES[k % MISSION_TYPES.length], n = m.n ? m.n(i) : 0; return { ...m, n, label: m.text(n) }; });
const missionReward = i => 20 + 2 * i;
let missionsDone = store.get("missions", {}); // { cityIndex: [done, done, done] }
const missionState = i => missionsDone[i] || [false, false, false];
function completeMission(i, k, m) {
  const st = missionState(i).slice(); if (st[k]) return;
  st[k] = true; missionsDone[i] = st; store.set("missions", missionsDone);
  wallet += missionReward(i); store.set("coins", wallet);
  level.missionsNow = (level.missionsNow || 0) + 1;
  say(`Mission complete: ${m.label}  +${missionReward(i)} coins`); sound.tone(660, 1320, 0.25, "triangle", 0.08);
}
function checkMissions(atFinish) {
  if (!level || level.daily) return;
  const r = racers[0];
  cityMissions(level.idx).forEach((m, k) => {
    if (missionState(level.idx)[k]) return;
    if (m.finish ? atFinish && m.finish(r) : m.now(r) >= m.n) completeMission(level.idx, k, m);
  });
}
const GARAGE_MENU = [
  { label: () => owned.includes(garageIdx) ? (garageIdx === equipped ? "Equipped" : "Equip") : `Buy - ${TEAMS[garageIdx].cost} coins`, go: garageAction },
  { label: "Upgrades", go: () => openMenu("upgrades") },
  { label: "Back", go: () => openMenu("menu", 5) },
];
function cycleCamera(dir) { cam = (cam + CAMS.length + dir) % CAMS.length; store.set("camera", cam); }
const PAUSE_MENU = [
  { label: "Resume", go: () => { state = "playing"; } },
  { label: () => `Camera: ${CAMS[cam].name}`, go: () => cycleCamera(1) }, // the paused race behind previews it
  { label: "Restart", go: () => restartRace() },
  { label: "How to Play", go: () => howToPlay() }, // the test drive (this race ends)
  { label: "Quit to Menu", go: toMenuFx },
];
function restartRace() { if (mode === "tutorial") { if (state === "paused" || state === "camera") tutorialRestart(); return; } if (state === "paused" || state === "camera") startGame(mode, difficulty, runStage); } // the same race again from the grid (tyres first, as always; the test drive: this lesson again)
const TUT_PAUSE_MENU = [ // paused in the test drive
  PAUSE_MENU[0], PAUSE_MENU[1], // (Resume, Camera)
  { label: "Restart Lesson", go: () => tutorialRestart() },
  { label: "Skip Test Drive", go: () => leaveTutorial() },
];
const TUT_DONE_MENU = [{ label: "LET'S RACE", big: true, go: () => leaveTutorial() }]; // the test drive's finish screen
const CAMERA_MENU = [
  ...CAMS.map((c, i) => ({ label: c.name, go: () => { cam = i; store.set("camera", cam); state = "playing"; } })),
  { label: "Resume", go: () => { state = "playing"; } },
];
// ---- the test drive (js/sim/tutorial.js): offered once by a small card after the title, and before the first race in any mode, until it has
// been done or skipped (save key tutorialSeen). "Let's go" starts it; "Skip" (Esc / B) goes on to the menu or the race you picked. ----
let afterTutorial = null; // the race to start once the test drive is done or skipped (null: the main menu)
const FIRST_MENU = [
  { label: "LET'S GO", big: true, go: () => sceneFx(() => startTutorial()) },
  { label: "Skip", go: () => skipFirstTime() },
];
const tutorialSeen = () => store.get("tutorialSeen", false) || new URLSearchParams(location.search).has("dev"); // (dev shortcuts never stop at the card)
function skipFirstTime() { store.set("tutorialSeen", true); const next = afterTutorial; afterTutorial = null; if (next) next(); else openMenu("menu"); }
function howToPlay() { afterTutorial = null; saveStats(); sceneFx(() => startTutorial()); } // Settings and the pause menu: the test drive again (no coins the second time)

const UPGRADE_MENU = [
  ...UPGRADES.map(u => ({ label: "", w: 330, h: 60, go: () => buyUpgrade(u) })), // rows are drawn by drawUpgrades
  { label: "Back", go: () => openMenu("garage", 1) },
];
const DAILY_MENU = [
  { label: "RETRY", big: true, go: () => startGame("daily", null, dailyCity()) },
  { label: "Menu", go: toMenuFx },
];
const STATS_MENU = [{ label: "Back", go: () => openMenu("menu", 6) }];
const lastCity = () => level && level.idx >= ROUTE.length - 1;
const CLEARED_MENU = [
  { label: () => lastCity() ? "MENU" : "NEXT CITY", big: true, go: () => lastCity() ? toMenuFx() : startGame("tour", null, level.idx + 1) },
  { label: "Replay City", go: () => startGame("tour", null, level.idx) },
  { label: "Menu", go: toMenuFx },
];

const OVER_MENU = [
  { label: "RETRY", big: true, go: () => startGame(mode, difficulty, runStage) }, // same mode, level and starting city; R / A / tap
  { label: "Menu", go: toMenuFx },
];

const BTN_W = 210;

function currentMenu() {
  switch (state) {
    case "menu": return { items: MAIN_MENU, top: 176, h: 27, gap: 5 };
    case "stats": return { items: STATS_MENU, top: 440, h: 28, gap: 0 };
    case "map": return { items: MAP_MENU, top: 446, h: 28, gap: 0 };
    case "brief": { const L = briefLayout(); return { items: BRIEF_MENU, top: L.py + 330, h: 34, gap: 8, cx: L.px + L.pw / 2 }; } // (under the city card, which sits to the side of the flyover)
    case "options": return resetAsk ? { items: resetAsk === 1 ? RESET_ASK : RESET_SURE, top: 236, h: 40, gap: 10 } : { items: OPTIONS_MENU, top: 86, h: 24, gap: 3 }; // (thirteen rows; or the Reset progress questions)
    case "graphics": return { items: GRAPHICS_MENU, top: 84, h: 31, gap: 6 };
    case "credits": return { items: CREDITS_MENU, top: 420, h: 32, gap: 0 };
    case "songs": return { items: SONGS_MENU, top: 150, h: 36, gap: 8 };
    case "controls": return { items: CONTROLS_MENU, top: 440, h: 30, gap: 0 };
    case "difficulty": return { items: DIFF_MENU, top: 200, h: 40, gap: 10 };
    case "garage": return { items: GARAGE_MENU, top: 336, h: 36, gap: 6 };
    case "upgrades": return { items: UPGRADE_MENU, top: 92, h: 36, gap: 8 };
    case "paused": return { items: mode === "tutorial" ? TUT_PAUSE_MENU : PAUSE_MENU, top: 238, h: 34, gap: 6 };
    case "camera": return { items: CAMERA_MENU, top: 205, h: 44, gap: 10 };
    case "firsttime": return { items: FIRST_MENU, top: 246, h: 34, gap: 8 };
    case "tyres": { if (!window.R3D) return { items: TYRES_MENU, top: 262, h: 48, gap: 6 }; const L = tyreLayout(); return { items: TYRES_MENU, top: L.rows, h: 48, gap: 6, cx: L.cx }; } // (3D: in the panel beside the wheel close-up)
    case "cleared": return { items: mode === "tutorial" ? TUT_DONE_MENU : level && level.daily ? DAILY_MENU : CLEARED_MENU, top: 306, h: 38, gap: 8 };
    case "over": return { items: OVER_MENU, top: 328, h: 44, gap: 14 };
  }
  return null;
}

const menuOY = () => (H - 480) / 2; // how far menus are pushed down to sit in the middle of a tall screen

const btnH = (menu, i) => menu.items[i].h || menu.h + (menu.items[i].big ? 18 : 0); // a "big" button is taller and wider than the rest; some set their own size

function btnRect(menu, i) {
  let y = menu.top;
  for (let k = 0; k < i; k++) y += btnH(menu, k) + menu.gap;
  const w = menu.items[i].w ? Math.min(menu.items[i].w, W - 20) : menu.items[i].big ? 260 : BTN_W;
  return { x: (menu.cx ?? W / 2) - w / 2, y, w, h: btnH(menu, i) }; // (centred on the screen, or on the menu's own column)
}

function menuIndexAt(px, py) {
  if (domMenuActive()) return -1; // the Garage and Upgrades buttons are HTML: the canvas has none to hit
  if (state === "menu") { const hit = menuCards().slice().reverse().find(c => px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h); return hit ? hit.i : -1; } // nearest card first
  const menu = currentMenu();
  if (!menu) return -1;
  return menu.items.findIndex((_, i) => {
    const r = btnRect(menu, i);
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  });
}

function activate(index) {
  const menu = currentMenu();
  if (!menu || performance.now() - overAt < Math.max(600, window.R3D ? R3D.overDelay() : 0)) return; // don't let crash-time taps hit buttons (or skip the crash camera)
  if (state !== "garage") sound.tone(440, 700, 0.08);
  menu.items[index].go();
}

// one place for menu navigation so keyboard and controller behave identically
function menuAction(a) {
  const menu = currentMenu();
  if (!menu) return;
  const n = menu.items.length;
  if (a === "next") { music.next(); return; }
  if (state === "garage" && (a === "left" || a === "right")) {
    garageIdx = (garageIdx + TEAMS.length + (a === "left" ? -1 : 1)) % TEAMS.length;
    sound.tone(520, 520, 0.05);
  } else if (state === "upgrades" && (a === "left" || a === "right")) { // the upgrade cards sit side by side: left / right step along them (and Back)
    sel = clamp(sel + (a === "left" ? -1 : 1), 0, n - 1); sound.tone(520, 520, 0.04, "square", 0.03);
  } else if (state === "map" && a !== "back") { // move around the grid; the road behind shows the selected city
    const c = Math.floor(mapIdx / MAP_ROWS), r = mapIdx % MAP_ROWS;
    if (a === "up") moveMap(c * MAP_ROWS + Math.max(0, r - 1));
    else if (a === "down") moveMap(Math.min(ROUTE.length - 1, c * MAP_ROWS + Math.min(MAP_ROWS - 1, r + 1)));
    else if (a === "left" || a === "right") moveMap(Math.min(ROUTE.length - 1, (a === "left" ? 0 : 1) * MAP_ROWS + r));
    else if (a === "confirm") startCity(mapIdx);
  } else if (state === "graphics" && GRAPHICS_MENU[sel] && GRAPHICS_MENU[sel].cycle && (a === "left" || a === "right")) { // change a graphics setting
    GRAPHICS_MENU[sel].cycle(a === "left" ? -1 : 1); sound.tone(600, 600, 0.04, "square", 0.03);
  } else if (state === "options" && !resetAsk && OPTIONS_MENU[sel] && OPTIONS_MENU[sel].slider && (a === "left" || a === "right")) { // nudge a volume
    const k = OPTIONS_MENU[sel].slider; setSlider(k, settings[k] + (a === "left" ? -0.1 : 0.1));
  } else if (state === "tyres" && (a === "left" || a === "right")) { // left / right step through the tyres too
    sel = clamp(sel + (a === "left" ? -1 : 1), 0, TYRES.length - 1); sound.tone(520, 520, 0.04, "square", 0.03);
  } else if (state === "controls" && (a === "left" || a === "right")) { // the Keyboard / Controller / Touch pages
    controlsTab = (controlsTab + (a === "left" ? 2 : 1)) % 3; sound.tone(520, 520, 0.04, "square", 0.03);
  } else if (state === "paused" && sel === 1 && (a === "left" || a === "right")) { // flick through the cameras
    cycleCamera(a === "left" ? -1 : 1);
    sound.tone(520, 520, 0.05);
  } else if (state === "menu" && ["left", "right", "up", "down"].includes(a)) { // the carousel: step along, stop at the ends
    const to = clamp(sel + (a === "left" || a === "up" ? -1 : 1), 0, n - 1);
    if (to !== sel) { sel = to; sound.tone(620, 760, 0.05, "triangle", 0.04); }
  } else if (a === "up") { sel = (sel + n - 1) % n; sound.tone(520, 520, 0.04, "square", 0.03); }
  else if (a === "down") { sel = (sel + 1) % n; sound.tone(520, 520, 0.04, "square", 0.03); }
  else if (a === "confirm") activate(sel);
  else if (a === "back") {
    if (state === "paused" || state === "camera") state = "playing";
    else if (state === "firsttime") skipFirstTime();
    else if (state === "difficulty") openMenu("menu", 0);
    else if (state === "tyres") TYRES_MENU[TYRES.length].go();
    else if (state === "map") sceneFx(() => { initDemo(); openMenu("menu", 1); });
    else if (state === "brief") { openMenu("map"); sel = -1; }
    else if (state === "garage") openMenu("menu", 5);
    else if (state === "upgrades") openMenu("garage", 1);
    else if (state === "options") { if (resetAsk) cancelReset(); else openMenu("menu", 7); }
    else if (state === "graphics") openMenu("options", optAt("graphics"));
    else if (state === "songs") openMenu("options", optAt("songs"));
    else if (state === "credits") openMenu("options", optAt("credits"));
    else if (state === "controls") openMenu("options", optAt("controls"));
    else if (state === "stats") openMenu("menu", 6);
    else if (state === "cleared" && mode === "tutorial") leaveTutorial();
    else if (state === "over" || state === "cleared") toMenuFx();
  }
}


// ---- tyres: every race starts here. Dry slicks, intermediates or full wets; how well each one grips depends on how wet the city is. ----
let tyreChoice = store.get("tyre", "dry"), pendingStart = null, tyreBack = "menu", tyreCity = 0;
const TYRE_KEYS = TYRES.map(t => t.key);
function startGame(m, d, stage = 0) { // asks for tyres first; the tyre menu then starts the race
  if (!tutorialSeen()) { afterTutorial = () => startGame(m, d, stage); openMenu("firsttime"); return; } // never played: offer the test drive first
  if (window.R3D && ["over", "cleared", "paused", "camera", "playing"].includes(state)) { sceneFx(() => openTyres(m, d, stage)); return; } // (from a race: the city gives way to the studio behind the sweep)
  openTyres(m, d, stage);
}
function openTyres(m, d, stage) {
  pendingStart = [m, d, stage]; tyreBack = ["brief", "difficulty", "menu"].includes(state) ? state : "menu"; // (after a race, Back means the main menu: the finished race is gone)
  if (!racers || racers.some(r => !r.ai)) initDemo(); // coming from a real race (Next city, Retry): the menu needs its demo traffic back, not the finished race
  tyreCity = stage % ROUTE.length;
  if (window.R3D && R3D.preparePack) R3D.preparePack(tyreCity); // (the city's own assets download while you pick tyres: never during the race)
  if ((m === "tour" || m === "daily") && stage) jumpTo(tyreCity, 0.3); // the road behind the menu shows the city you are about to race
  const rec = bestTyre(cityWetness(ROUTE[tyreCity]));
  openMenu("tyres", TYRE_KEYS.indexOf(store.get("tyreSeen", false) ? tyreChoice : rec)); // the first time the sensible one is pre-selected, after that your last choice
}
const TYRES_MENU = [
  ...TYRES.map(t => ({ label: "", w: 330, h: 48, go: () => { tyreChoice = t.key; store.set("tyre", tyreChoice); store.set("tyreSeen", true); const p = pendingStart; if (!p) return; sceneFx(() => { pendingStart = null; startGameNow(p[0], p[1], p[2]); if (window.R3D) R3D.raceIntro(); }); } })), // (the studio gives way to the city's starting grid behind the sweep)
  { label: "Back", h: 32, go: () => { const back = () => { pendingStart = null; openMenu(tyreBack, tyreBack === "menu" ? 0 : 0); if (tyreBack === "brief") sel = 0; }; if (tyreBack === "brief") sceneFx(back); else back(); } },
];
