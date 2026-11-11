// ---------- one-time hints ----------
// Instead of explaining everything up front, the first time you open certain screens (after the test drive has been done or skipped) one short
// tip shows in a small glass bubble, placed where it covers no button and no text. It goes after your first key / button / tap, or 5 seconds.
// Each one shows only once ever (save key hintsSeen). The Garage is HTML, so its tip is an HTML bubble too (garageUI.tip).
//   HINTS[screen]  text: the words (or, for the pause menu, prompt parts drawn as the keys / buttons you use)
//                  at(): where the bubble goes, in screen units: { cx: its centre, y: its top, max: the widest it may be }

const HINT_MS = 5000;
const HINTS = {
  menu: { text: () => "Vs Computer: race the AI. World Tour: 22 cities to conquer.", at: () => {
    const moy = menuOY();
    if (!window.R3D) return { cx: W / 2, y: 404 + moy, max: W - 24 }; // (2D: under the cards)
    const R = railLayout();
    if (R.wide) return { cx: (18 + R.x - 18) / 2, y: R.coinsY + moy + 20, max: R.x - 36 }; // (beside the cards, under the coins)
    return { cx: W / 2, y: (R.compact ? 44 : R.coinsY + moy + 16), max: W - 24 }; // (a phone: under the logo and coins)
  } },
  tyres: { text: () => "Wet city? Pick inters or wets for more grip.", at: () => {
    if (!window.R3D) return { cx: W / 2, y: 4, max: W - 24 };
    const L = tyreLayout();
    return W >= 540 ? { cx: (L.px - 16) / 2, y: 16, max: L.px - 40 } : { cx: W / 2, y: 10, max: W - 24 }; // (over the wheel's corner of the studio)
  } },
  brief: { text: () => "Beat the targets for stars, finish missions for coins.", at: () => {
    if (!window.R3D) return { cx: W / 2, y: 4, max: W - 24 };
    const L = briefLayout();
    return W >= 540 ? { cx: L.px / 2, y: 16, max: L.px - 30 } : { cx: W / 2, y: 10, max: W - 24 }; // (over the flyover, beside the city card)
  } },
  garage: { text: () => "Spend coins on cars and upgrades.", at: () => ({ cx: W / 2, y: 4, max: W - 24 }) }, // (2D only: with 3D it is the HTML bubble)
  paused: { text: () => onTouch() ? "Tap the camera button (top left) to change the view" // (the right buttons for what you are holding)
    : onPad() ? [[["p:LB", "p:RB"], "change camera,"], [["p:X"], window.R3D ? "restarts," : "restarts"], ...(window.R3D ? [[["p:Y"], "photo mode"]] : [])]
    : [[["k:V"], "changes camera,"], [["k:R"], window.R3D ? "restarts," : "restarts"], ...(window.R3D ? [[["k:P"], "while paused = photo mode"]] : [])],
    at: () => ({ cx: W / 2, y: 150 + menuOY() - 46, max: W - 24 }) }, // (just above the pause panel)
};
let hintsSeen = store.get("hintsSeen", []);
const hint = { id: null, t0: 0, out: 0, words: null, parts: null }; // the one on screen (out: when it started to fade away)

function hintWanted() { // which screen's hint could show now
  if (mode === "tutorial" || !store.get("tutorialSeen", false) || (window.R3D && R3D.photo.active)) return null;
  const id = state === "garage" ? "garage" : state;
  return HINTS[id] && !hintsSeen.includes(id) ? id : null;
}
function dismissHint() { if (hint.id && !hint.out && performance.now() - hint.t0 > 120) hint.out = performance.now(); } // (the press that opened the screen doesn't count)
document.addEventListener("keydown", e => { if (!e.repeat) dismissHint(); }, true); // (a key held down from the race doesn't count)
document.addEventListener("pointerdown", dismissHint, true);

// once a frame, from draw(): start a hint when its screen opens, fade it out, and draw it
function drawHints() {
  const now = performance.now();
  if (hint.id && (hint.id !== (state === "garage" ? "garage" : state) || now - hint.t0 > HINT_MS)) { if (!hint.out) hint.out = now; } // (the screen changed, or its time is up)
  if (hint.out && now - hint.out > 200) { if (hint.id === "garage") garageUI.tip(null); hint.id = null; hint.out = 0; }
  if (!hint.id) {
    const id = hintWanted(); if (!id) return;
    hint.id = id; hint.t0 = now; hint.out = 0; hintsSeen.push(id); store.set("hintsSeen", hintsSeen);
    if (id === "garage" && domMenuActive()) garageUI.tip(HINTS.garage.text());
  }
  if (hint.id === "garage" && domMenuActive()) { if (hint.out) garageUI.tip(null); return; } // (the HTML bubble shows itself)
  const H_ = HINTS[hint.id], a = Math.min(smooth((now - hint.t0) / 220), hint.out ? 1 - smooth((now - hint.out) / 200) : 1);
  if (a <= 0) return;
  const pos = H_.at(), what = H_.text(), prompt = Array.isArray(what), chip = 34;
  let s = 13, lines = [what], w;
  if (prompt) { let ps = 17; while (promptWidth(what, ps) + chip + 24 > pos.max && ps > 11) ps--; s = ps; w = promptWidth(what, ps) + chip + 24; }
  else {
    const fit = () => { ctx.font = `700 ${s}px ${UI_FONT}`; return Math.max(...lines.map(l => ctx.measureText(l).width)) + chip + 24; };
    while ((w = fit()) > pos.max && s > 11) s--;
    if (w > pos.max) { const words = what.split(" "), half = Math.ceil(words.length / 2); lines = [words.slice(0, half).join(" "), words.slice(half).join(" ")]; s = 13; while ((w = fit()) > pos.max && s > 10) s--; } // (two lines on a narrow screen)
  }
  const h = lines.length > 1 ? 44 : 30, x = clamp(pos.cx - w / 2, 8, W - 8 - w), y = pos.y + (1 - a) * -6;
  ctx.save(); ctx.globalAlpha = a;
  glass(x, y, w, h, 14, UI_ACC);
  roundRect(x + 9, y + h / 2 - 8, chip - 6, 16, 8); ctx.fillStyle = `rgba(${UI_ACC_RGB},0.9)`; ctx.fill(); // the little TIP chip
  ctx.font = `900 9px ${UI_FONT}`; ctx.textAlign = "center"; ctx.fillStyle = "#1a1006"; ctx.fillText("TIP", x + 9 + (chip - 6) / 2, y + h / 2 + 3.5);
  if (prompt) drawPrompt(what, x + chip + 12, y + h / 2, s, "left", "#f3f6fb");
  else lines.forEach((l, i) => textAt(l, x + chip + 12, y + h / 2 + s * 0.36 + (i - (lines.length - 1) / 2) * (s + 3), s, "left", "#f3f6fb"));
  ctx.restore();
}
