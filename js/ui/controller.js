// ---------- controller ----------

const padPrev = {};
let padCount = 0; // how many controllers are plugged in (split screen: with two, Player 2's prompts show controller buttons)
const SPIN_KEYS = { KeyQ: -1, KeyE: 1 }; // the keyboard's way to turn the car in the Garage (the controller uses the right stick, the mouse drags)

function pollPads() {
  padG = [0, 0]; padB = [0, 0]; garageSpin = 0;
  if (state === "garage" || state === "upgrades") for (const [k, d] of Object.entries(SPIN_KEYS)) if (held.has(k)) garageSpin += d * 0.8;
  let list = [];
  try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) {} // an iframe can block controllers (permissions policy): then there just aren't any
  const pads = Array.from(list || []).filter(g => g && g.connected);
  hasPad = pads.length > 0; padCount = pads.length;
  pads.forEach((g, k) => {
    const b = i => !!(g.buttons[i] && g.buttons[i].pressed), val = i => (g.buttons[i] ? g.buttons[i].value : 0);
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    // any real use of this pad (a button, or a stick pushed well over) makes the prompts show controller buttons
    if (g.buttons.some(x => x && (x.pressed || x.value > 0.5)) || [0, 1, 2, 3].some(i => Math.abs(g.axes[i] || 0) > 0.6)) useDevice("pad", g.id);
    const now = { left: ax < -0.5 || b(14), right: ax > 0.5 || b(15), up: ay < -0.5 || b(12), down: ay > 0.5 || b(13), a: b(0), b: b(1), x: b(2), y: b(3), start: b(9), back: b(8), lb: b(4), rb: b(5) };
    const prev = padPrev[g.index] || {}, edge = n => now[n] && !prev[n];
    padPrev[g.index] = now;
    for (const n in now) if (now[n] && !prev[n]) { dismissHint(); break; } // (any new press clears a one-time hint: js/ui/hints.js)

    if (k === 0 && window.R3D && R3D.photo.active) { // photo mode: fly the free camera
      const dz = v => Math.abs(v) > 0.15 ? v : 0;
      R3D.photo.pad({ mx: dz(ax), my: dz(ay), lx: dz(g.axes[2] || 0), ly: dz(g.axes[3] || 0), up: val(7) - val(6), zoom: (b(5) ? 1 : 0) - (b(4) ? 1 : 0), fast: b(10) });
      if (edge("a")) R3D.photo.act("capture");
      if (edge("b") || edge("start")) R3D.photo.act("exit");
      if (edge("x")) R3D.photo.act("filter");
      if (edge("y")) R3D.photo.act("dof");
      if (edge("up")) R3D.photo.act("hide");
      return;
    }
    if (state === "playing" && window.R3D && R3D.introHold) { if (Object.keys(now).some(n => edge(n))) R3D.skipIntro(); return; } // the race start's sweep: any button skips it
    if (state === "playing") {
      const rid = mode === "multi" && pads.length > 1 ? k : 0; // a second controller drives player 2
      if (rid > 1 || (mode !== "multi" && k > 0)) return;
      if (mode === "tutorial" && edge("b")) { leaveTutorial(); return; } // B skips the test drive (there LT is the brake)
      if (edge("left")) steer(racers[rid], -1);
      if (edge("right")) steer(racers[rid], 1);
      const gas = Math.max(val(7), b(0) ? 1 : 0, now.up ? 1 : 0), brake = Math.max(val(6), b(1) && mode !== "tutorial" ? 1 : 0, b(2) ? 1 : 0, now.down ? 1 : 0);
      padG[rid] = gas; padB[rid] = brake;
      if (edge("start")) pause();
      else if (edge("y") || edge("back")) openCamera();
      else if (rid === 0 && (edge("lb") || edge("rb"))) { cycleCamera(edge("lb") ? -1 : 1); say(`Camera: ${CAMS[cam].name}`, { key: "camera" }); } // shoulder buttons: next camera, straight away
    } else if (k === 0 && state === "title") {
      if (Object.keys(now).some(n => edge(n))) leaveTitle();
    } else if (k === 0) {
      if (state === "garage" || state === "upgrades") { const rx = g.axes[2] || 0; if (Math.abs(rx) > 0.18) garageSpin = rx; } // right stick: spin the turntable
      if (state === "garage") { if (edge("lb")) menuAction("left"); if (edge("rb")) menuAction("right"); } // shoulder buttons browse the cars too
      if (state === "paused" && edge("x")) { restartRace(); return; } // X: restart this race
      if (state === "paused" && edge("y") && window.R3D) { R3D.photo.enter(R3D.camera); return; } // Y: photo mode
      if (state === "over" && edge("x")) { activate(0); return; } // X: retry
      if (edge("up")) menuAction("up");
      if (edge("down")) menuAction("down");
      if (edge("left")) menuAction("left");
      if (edge("right")) menuAction("right");
      if (edge("a")) menuAction("confirm");
      if (edge("b") || edge("start")) menuAction("back");
      if (edge("y")) menuAction("next");
    }
  });
}
