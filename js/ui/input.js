// ---------- input ----------

const MENU_KEYS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Enter: "confirm", Space: "confirm", Escape: "back", KeyP: "back", KeyN: "next" };

// ---- fullscreen and Esc: Esc is the game's Back key, so in fullscreen the game keeps it (Keyboard Lock, in Chrome and Edge) and a quick second
// Esc leaves fullscreen. (Firefox and Safari have no Keyboard Lock: there Esc always leaves fullscreen, and a page can't stop that.) ----
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
let escAt = -1e9; // when Esc was last pressed (in fullscreen)
function escTwice(e) { // true when this Esc is the second quick one: it leaves fullscreen and does nothing else
  if (e.code !== "Escape" || e.repeat || !isFullscreen()) return false;
  const now = performance.now();
  if (now - escAt < 600) { escAt = -1e9; try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (err) {} return true; }
  escAt = now; return false;
}
document.addEventListener("fullscreenchange", () => {
  fit();
  try {
    const kb = navigator.keyboard;
    if (isFullscreen() && kb && kb.lock) kb.lock(["Escape"]).then(() => say("Press Esc twice to leave fullscreen", { key: "fullscreen" })).catch(() => {});
    else if (kb && kb.unlock) kb.unlock();
  } catch (err) {}
});

document.addEventListener("keydown", e => {
  useDevice("kb"); noteKey(e.code); // a key was pressed: prompts show keys (the ones you use: arrows, W A S D or a mix)
  if (escTwice(e)) return; // (a quick second Esc in fullscreen: leave fullscreen, nothing else)
  if (window.R3D && R3D.photo.active) { e.preventDefault(); R3D.photo.key(e, true); return; } // photo mode owns the keyboard
  const c = e.code;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(c)) e.preventDefault();
  held.add(c);
  sound.ensure();
  if (state === "title") { if (!e.repeat) leaveTitle(); return; }
  if (state === "paused" && c === "KeyP" && window.R3D) { R3D.photo.enter(R3D.camera); return; } // P while paused: photo mode
  if (state === "paused" && c === "KeyR") { if (!e.repeat) restartRace(); return; } // R while paused: restart this race
  if (c === "KeyM") { sound.toggle(); return; }
  if (c === "KeyF") { toggleFullscreen(); return; }
  if (state === "over" && c === "KeyR") { if (!e.repeat) activate(0); return; } // instant retry (activate ignores it for 0.6s after a crash)

  if (state === "playing") {
    if (e.repeat) return;
    if (window.R3D && R3D.introHold) { R3D.skipIntro(); return; } // the race start's sweep: any key skips it (a held gas or brake still counts when the lights start)
    const shared = mode !== "multi"; // in multiplayer WASD belongs to player 2
    if (c === "ArrowLeft" || (shared && c === "KeyA")) steer(racers[0], -1);
    else if (c === "ArrowRight" || (shared && c === "KeyD")) steer(racers[0], 1);
    if (mode === "multi") {
      if (c === "KeyA") steer(racers[1], -1);
      else if (c === "KeyD") steer(racers[1], 1);
    }
    if (c === "Escape" && mode === "tutorial") leaveTutorial(); // Esc skips the test drive (P still pauses)
    else if (c === "Escape" || c === "KeyP") pause();
    else if (c === "KeyC") openCamera();
    else if (c === "KeyV") { cycleCamera(e.shiftKey ? -1 : 1); say(`Camera: ${CAMS[cam].name}`, { key: "camera" }); } // V: next camera straight away (Shift+V: previous)
    else if (/^Digit[1-9]$/.test(c) && +c.slice(5) <= CAMS.length) { cam = +c.slice(5) - 1; store.set("camera", cam); say(`Camera: ${CAMS[cam].name}`, { key: "camera" }); } // 1 / 2 / 3: pick a camera
    return;
  }
  if (state === "camera" && c === "KeyC") { state = "playing"; return; }
  if ((state === "garage" || state === "paused") && e.repeat && (c === "ArrowLeft" || c === "ArrowRight" || c === "KeyA" || c === "KeyD")) return;
  if (e.repeat && MENU_KEYS[c] === "confirm") return; // (a key still held from the race, e.g. Space as the brake, must not press Retry by itself)
  if (state === "controls" && c === "Tab") { e.preventDefault(); menuAction("right"); return; } // Tab: next page of the controls
  if (MENU_KEYS[c]) menuAction(MENU_KEYS[c]);
});

document.addEventListener("keyup", e => { held.delete(e.code); if (window.R3D && R3D.photo.active) R3D.photo.key(e, false); });
window.addEventListener("blur", () => { held.clear(); touch.gas = touch.brake = false; pause(); }); // clicking outside an embedded game: pause rather than crash blind
const grabFocus = () => { try { window.focus(); } catch (e) {} try { canvas.focus({ preventScroll: true }); } catch (e) {} };
window.addEventListener("pointerdown", grabFocus, true); // restore iframe and canvas focus before any game tap handler can prevent the browser default
for (const ev of ["touchend", "click"]) document.addEventListener(ev, () => sound.ensure(), { passive: true }); // iOS Safari only unlocks audio on these
canvas.addEventListener("contextmenu", e => e.preventDefault()); // no long-press / right-click menu over the game
window.addEventListener("resize", fit);
window.addEventListener("gamepadconnected", e => { hasPad = true; padKind = padKindOf(e.gamepad && e.gamepad.id); say(`${PAD_NAME[padKind]} connected`, { key: "device" }); });
window.addEventListener("gamepaddisconnected", () => { if (inputDev === "pad") useDevice("kb"); say("Controller disconnected", { key: "device" }); });
canvas.addEventListener("wheel", e => { if (window.R3D && R3D.photo.active) { e.preventDefault(); R3D.photo.wheel(e.deltaY); } }, { passive: false }); // photo mode: wheel zooms
document.addEventListener("visibilitychange", () => { // hidden tab: pause and go quiet; back again: sound resumes
  if (document.hidden) { pause(); try { if (sound.ac) sound.ac.suspend(); } catch (e) {} }
  else try { if (sound.ac) sound.ac.resume(); } catch (e) {}
});

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
}

canvas.addEventListener("pointermove", e => {
  if (window.R3D && R3D.photo.active) { if (e.buttons) R3D.photo.look(e.movementX, e.movementY); return; } // photo mode: drag to look round
  const p = canvasPoint(e);
  if (state === "menu" && !window.R3D) return; // hovering doesn't slide the carousel around (the 3D menu's column of cards does follow the mouse)
  const i = menuIndexAt(p.x, p.y - menuOY());
  if (i >= 0) sel = i;
});

canvas.addEventListener("pointerdown", e => {
  grabFocus(); // inside an iframe, keys only reach the game once it has focus
  if (window.R3D && R3D.photo.active) return; // photo mode: no hidden buttons to hit
  const p = canvasPoint(e);
  sound.ensure();
  useDevice(e.pointerType === "touch" ? "touch" : "kb"); // (a mouse counts as the keyboard: you are at a computer)
  if (state === "title") { leaveTitle(); return; }
  if (state === "playing") {
    const pr = pedalRects();
    if (window.R3D && R3D.introHold) { R3D.skipIntro(); if (hasTouch && inRect(p, pr.gas)) { touch.gas = true; touch.gasId = e.pointerId; } else if (hasTouch && inRect(p, pr.brake)) { touch.brake = true; touch.brakeId = e.pointerId; } return; } // a tap skips the race start's sweep (a pedal you press stays pressed)
    if (mode === "tutorial" && inRect(p, tutSkipRect(), 10)) leaveTutorial(); // the test drive's Skip button
    else if (Math.hypot(p.x - 24, p.y - 24) < 20) openCamera();
    else if (Math.hypot(p.x - (W - 24), p.y - (H - 24)) < 22) pause();
    else if (hasTouch && inRect(p, pr.gas)) { touch.gas = true; touch.gasId = e.pointerId; }
    else if (hasTouch && inRect(p, pr.brake)) { touch.brake = true; touch.brakeId = e.pointerId; }
    else { steer(racers[0], p.x < W / 2 ? -1 : 1); if (grid.done) steerTaps++; }
    return;
  }
  p.y -= menuOY(); // menu screens are centred on tall screens
  if (state === "menu") { swipe = { x: p.x, y: p.y, id: e.pointerId }; return; } // decided on release: a swipe slides, a tap picks
  const i = menuIndexAt(p.x, p.y);
  if (i >= 0 && state === "options" && !resetAsk && OPTIONS_MENU[i].slider) { sel = i; const b = sliderBar(btnRect(currentMenu(), i)); setSlider(OPTIONS_MENU[i].slider, (p.x - b.x) / b.w); }
  else if (i >= 0) { sel = i; activate(i); }
  else if (state === "garage" && !domMenuActive() && p.y > 110 && p.y < 300) menuAction(p.x < W / 2 ? "left" : "right");
  else if (state === "map") { const t = ROUTE.findIndex((_, k) => inRect(p, mapTile(k), 0)); if (t >= 0) { moveMap(t); startCity(t); } } // tap a city to race it
});
const releasePedals = e => { // only the finger that pressed a pedal lets it go, so steering taps don't cut the throttle
  if (e.pointerId === touch.gasId || e.pointerType !== "touch") { touch.gas = false; touch.gasId = null; }
  if (e.pointerId === touch.brakeId || e.pointerType !== "touch") { touch.brake = false; touch.brakeId = null; }
};
canvas.addEventListener("pointerup", e => {
  releasePedals(e);
  if (state !== "menu" || !swipe || swipe.id !== e.pointerId) { swipe = null; return; }
  const p = canvasPoint(e); p.y -= menuOY();
  const dx = p.x - swipe.x; swipe = null;
  if (Math.abs(dx) > 36) { menuAction(dx < 0 ? "right" : "left"); return; } // swipe left = next card
  const i = menuIndexAt(p.x, p.y);
  if (i < 0) return;
  if (i === sel) activate(i); else { sel = i; sound.tone(620, 760, 0.05, "triangle", 0.04); } // tap a side card to bring it over, the centre one to go
});
canvas.addEventListener("pointercancel", releasePedals);
canvas.addEventListener("pointerleave", releasePedals);

