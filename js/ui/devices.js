// ---------- which device you are playing with ----------
// The game watches what you last touched: the keyboard (or mouse), a controller, or a touch screen. Every prompt on screen follows it,
// drawn as the real thing: key caps for the keyboard, the right face buttons for an Xbox, PlayStation or Nintendo pad.
// Switching is instant (press a key and the prompts turn into keys; touch a stick and they turn into buttons).

let inputDev = "kb", padKind = "xbox", devSwitchT = -1e9; // "kb" | "pad" | "touch";  "xbox" | "ps" | "nin"
const padKindOf = id => /054c|playstation|dualsense|dualshock|wireless controller/i.test(id || "") ? "ps" : /057e|nintendo|switch|pro controller|joy-?con/i.test(id || "") ? "nin" : "xbox";
const PAD_NAME = { xbox: "Xbox controller", ps: "PlayStation controller", nin: "Nintendo controller" };
const onPad = () => inputDev === "pad", onTouch = () => inputDev === "touch", onKeys = () => inputDev === "kb";

function useDevice(d, padId) {
  if (padId) { const k = padKindOf(padId); if (k !== padKind && d === "pad") { padKind = k; devSwitchT = -1e9; } }
  hasTouch = d === "touch" ? true : d === "kb" ? false : hasTouch; // (touch pedals and tap hints only while you are using the touch screen)
  if (d === inputDev) return;
  inputDev = d;
  document.body.classList.toggle("dev-pad", d === "pad"); document.body.classList.toggle("dev-touch", d === "touch");
  const now = performance.now();
  if (state !== "title" && now - devSwitchT > 2500) say(d === "pad" ? `${PAD_NAME[padKind]}: button prompts on` : d === "kb" ? "Keyboard: key prompts on" : "Touch controls on", { key: "device" });
  devSwitchT = now;
}

// ---- which keys you drive with: the prompts show the ones you last pressed for each job (arrows, W A S D, or a mix like W + Down) ----
const KB = { gas: "↑", brake: "↓", side: "arrows" };
function noteKey(code) { // (input.js calls this on every key press; in a two-player race W A S D belong to player 2, so nothing changes)
  if (mode === "multi" && state === "playing") return;
  if (code === "ArrowUp") KB.gas = "↑"; else if (code === "KeyW") KB.gas = "W";
  else if (code === "ArrowDown") KB.brake = "↓"; else if (code === "KeyS") KB.brake = "S"; else if (code === "Space" && state === "playing") KB.brake = "Space";
  else if (code === "ArrowLeft" || code === "ArrowRight") KB.side = "arrows"; else if (code === "KeyA" || code === "KeyD") KB.side = "ad";
}
const kbSide = () => KB.side === "ad" ? ["k:A", "k:D"] : ["k:←", "k:→"];
// ---- actions -> the buttons that do them, per device ----
// tokens: "k:<label>" a key cap, "p:<button>" a controller button (A B X Y LB RB LT RT START VIEW LS RS DPAD DLR DUD), "+" / "/" joiners
const ACTIONS = {
  confirm: { kb: ["k:Enter"], pad: ["p:A"] },
  back:    { kb: ["k:Esc"], pad: ["p:B"] },
  steer:   { kb: kbSide, pad: ["p:LS", "/", "p:DLR"] },
  steer2:  { kb: ["k:A", "k:D"], pad: ["p:LS"] },
  gas:     { kb: () => ["k:" + KB.gas], pad: ["p:RT"] },
  brake:   { kb: () => ["k:" + KB.brake], pad: ["p:LT"] },
  launch:  { kb: () => ["k:" + KB.gas, "+", "k:" + KB.brake], pad: ["p:RT", "+", "p:LT"] },
  camera:  { kb: ["k:C"], pad: ["p:Y"] },
  camNext: { kb: ["k:V"], pad: ["p:LB", "p:RB"] },
  pause:   { kb: ["k:Esc"], pad: ["p:START"] },
  retry:   { kb: ["k:R"], pad: ["p:X"] },
  photo:   { kb: ["k:P"], pad: ["p:Y"] },
  browse:  { kb: kbSide, pad: ["p:LB", "p:RB"] },
  choose:  { kb: () => [KB.gas === "W" ? "k:W" : "k:↑", KB.brake === "S" ? "k:S" : "k:↓"], pad: ["p:DUD"] },
  change:  { kb: kbSide, pad: ["p:DLR"] },
  spin:    { kb: ["k:Q", "k:E"], pad: ["p:RS"] },
  song:    { kb: ["k:N"], pad: ["p:Y"] },
  start:   { kb: ["k:Enter"], pad: ["p:A"] },
};
// ---- split-screen multiplayer: each player's own keys. Player 1: the arrows (or the first controller); Player 2: W A S D (or a second controller) ----
const PK_ARROWS = { steer: ["k:←", "k:→"], left: "k:←", right: "k:→", brake: "k:↓", both: ["k:↑", "+", "k:↓"] };
const PK_WASD = { steer: ["k:A", "k:D"], left: "k:A", right: "k:D", brake: "k:S", both: ["k:W", "+", "k:S"] };
const PK_PAD = { steer: ["p:LS", "/", "p:DLR"], left: "p:DLR", right: "p:DLR", brake: "p:LT", both: ["p:RT", "+", "p:LT"] };
const playerKeys = k => k === 0 ? (onPad() ? PK_PAD : PK_ARROWS) : (padCount > 1 ? PK_PAD : PK_WASD);
const glyphsFor = a => { const e = ACTIONS[a]; return e ? (onPad() ? e.pad : typeof e.kb === "function" ? e.kb() : e.kb) : []; };

// ---- drawing on the 2D canvas ----
const FACE = { // standard-mapping face buttons per family: [label, colour]
  xbox: { A: ["A", "#3dbb4a"], B: ["B", "#e0473c"], X: ["X", "#2f7de1"], Y: ["Y", "#f2c230"], LB: "LB", RB: "RB", LT: "LT", RT: "RT", START: "☰", VIEW: "⧉" },
  ps:   { A: ["✕", "#8fb4ff"], B: ["○", "#ff6b6b"], X: ["□", "#ff8ad0"], Y: ["△", "#43d6a4"], LB: "L1", RB: "R1", LT: "L2", RT: "R2", START: "OPTIONS", VIEW: "CREATE" },
  nin:  { A: ["B", "#d8d8d8"], B: ["A", "#d8d8d8"], X: ["Y", "#d8d8d8"], Y: ["X", "#d8d8d8"], LB: "L", RB: "R", LT: "ZL", RT: "ZR", START: "+", VIEW: "−" },
};
function glyphWidth(tok, s) {
  if (tok === "+" || tok === "/") return s * 0.55;
  ctx.font = `bold ${Math.round(s * 0.56)}px ${UI_FONT}`;
  if (tok.startsWith("k:")) { const l = tok.slice(2); return Math.max(s, ctx.measureText(l).width + s * 0.55); }
  const b = tok.slice(2), f = FACE[padKind][b];
  if (Array.isArray(f) || b === "LS" || b === "RS" || b.startsWith("D")) return s;
  return Math.max(s * 1.25, ctx.measureText(f).width + s * 0.6);
}
// draws one token with its left edge at x, centred on y; returns its width (tint: paint the key cap / button in that colour instead)
function drawGlyph(tok, x, y, s, tint) {
  const w = glyphWidth(tok, s), h = s, top = y - h / 2;
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (tok === "+" || tok === "/") { ctx.font = `bold ${Math.round(s * 0.62)}px ${UI_FONT}`; ctx.fillStyle = "#fff"; ctx.fillText(tok, x + w / 2, y + 1); ctx.restore(); return w; }
  if (tok.startsWith("k:")) { // a key cap: light, with a darker lip at the bottom
    const l = tok.slice(2);
    roundRect(x, top + 1.5, w, h, s * 0.22); ctx.fillStyle = tint ? "rgba(0,0,0,0.45)" : "#8d929c"; ctx.fill();
    roundRect(x, top, w, h - 1.5, s * 0.22); ctx.fillStyle = tint || "#f4f5f7"; ctx.fill();
    ctx.font = `bold ${Math.round(s * (l.length > 2 ? 0.46 : 0.62))}px ${UI_FONT}`; ctx.fillStyle = "#17181c"; ctx.fillText(l, x + w / 2, y);
    ctx.restore(); return w;
  }
  const b = tok.slice(2), f = FACE[padKind][b], cx = x + w / 2;
  if (Array.isArray(f)) { // a face button: dark disc, coloured symbol
    ctx.fillStyle = "#16181d"; ctx.beginPath(); ctx.arc(cx, y, h / 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = f[1]; ctx.lineWidth = Math.max(1.5, s * 0.09); ctx.beginPath(); ctx.arc(cx, y, h / 2 - ctx.lineWidth / 2, 0, TAU); ctx.stroke();
    ctx.fillStyle = f[1]; ctx.font = `bold ${Math.round(s * 0.6)}px ${UI_FONT}`; ctx.fillText(f[0], cx, y + (padKind === "ps" ? 0 : 1));
  } else if (b === "LS" || b === "RS") { // a thumbstick: ring with a cap and its letter
    ctx.fillStyle = "#16181d"; ctx.beginPath(); ctx.arc(cx, y, h / 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#cfd3da"; ctx.lineWidth = Math.max(1.2, s * 0.07); ctx.beginPath(); ctx.arc(cx, y, h * 0.32, 0, TAU); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.round(s * 0.42)}px ${UI_FONT}`; ctx.fillText(b[0], cx, y + 1);
  } else if (b.startsWith("D")) { // the d-pad, with the used directions lit
    const a = s * 0.17, L = s * 0.48, lit = b === "DPAD" ? "udlr" : b === "DLR" ? "lr" : "ud";
    ctx.fillStyle = "#16181d"; ctx.beginPath(); ctx.arc(cx, y, h / 2, 0, TAU); ctx.fill();
    for (const [d, dx, dy] of [["u", 0, -1], ["d", 0, 1], ["l", -1, 0], ["r", 1, 0]]) {
      ctx.fillStyle = lit.includes(d) ? "#fff" : "#5a5f69";
      ctx.fillRect(cx + (dx ? dx * a * 0.5 + (dx > 0 ? 0 : -L * 0.68) : -a), y + (dy ? dy * a * 0.5 + (dy > 0 ? 0 : -L * 0.68) : -a), dx ? L * 0.68 : 2 * a, dy ? L * 0.68 : 2 * a);
    }
    ctx.fillStyle = "#5a5f69"; ctx.fillRect(cx - a, y - a, 2 * a, 2 * a);
  } else { // shoulder buttons, triggers, Start / View: a dark pill
    const trig = b === "LT" || b === "RT";
    roundRect(x, top, w, h, trig ? s * 0.18 : h / 2); ctx.fillStyle = tint || "#16181d"; ctx.fill();
    ctx.strokeStyle = tint ? "rgba(0,0,0,0.35)" : "#cfd3da"; ctx.lineWidth = 1.2; roundRect(x + 0.6, top + 0.6, w - 1.2, h - 1.2, trig ? s * 0.18 : h / 2); ctx.stroke();
    ctx.fillStyle = tint ? "#0b1a10" : "#fff"; ctx.font = `bold ${Math.round(s * (f.length > 3 ? 0.36 : 0.5))}px ${UI_FONT}`; ctx.fillText(f, cx, y + 1);
  }
  ctx.restore(); return w;
}
// a prompt line: [[action or token list, "label"], ...] laid out as  [glyphs] label   [glyphs] label  around x (align "center" | "left" | "right")
function promptWidth(parts, s) {
  let w = 0; ctx.font = `bold ${Math.round(s * 0.78)}px ${UI_FONT}`;
  parts.forEach(([g, label], i) => { const toks = typeof g === "string" ? glyphsFor(g) : g; toks.forEach(t => w += glyphWidth(t, s) + s * 0.18); ctx.font = `bold ${Math.round(s * 0.78)}px ${UI_FONT}`; w += label ? ctx.measureText(label).width + s * 0.2 : 0; if (i < parts.length - 1) w += s * 0.9; });
  return w;
}
function drawPrompt(parts, x, y, s = 18, align = "center", color = "#fff") {
  if (onTouch()) return 0;
  const total = promptWidth(parts, s); let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  parts.forEach(([g, label], i) => {
    const toks = typeof g === "string" ? glyphsFor(g) : g;
    for (const t of toks) cx += drawGlyph(t, cx, y, s) + s * 0.18;
    if (label) { ctx.font = `bold ${Math.round(s * 0.78)}px ${UI_FONT}`; const lw = ctx.measureText(label).width; textAt(label, cx + s * 0.06, y + s * 0.28, Math.round(s * 0.78), "left", color); cx += lw + s * 0.2; }
    cx += s * 0.9;
  });
  return total;
}

// ---- the same prompts as HTML (the Garage screens are HTML) ----
function promptHTML(parts) {
  if (onTouch()) return "Drag the car to turn it";
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tokHTML = t => {
    if (t === "+" || t === "/") return `<i class="gp-j">${t}</i>`;
    if (t.startsWith("k:")) return `<kbd class="gp-k">${esc(t.slice(2))}</kbd>`;
    const b = t.slice(2), f = FACE[padKind][b];
    if (Array.isArray(f)) return `<b class="gp-f" style="--c:${f[1]}">${f[0]}</b>`;
    if (b === "LS" || b === "RS") return `<b class="gp-s">${b[0]}</b>`;
    if (b.startsWith("D")) return `<b class="gp-d">✚</b>`;
    return `<b class="gp-p">${esc(f)}</b>`;
  };
  return parts.map(([g, label]) => `<span class="gp">${(typeof g === "string" ? glyphsFor(g) : g).map(tokHTML).join("")}${label ? `<span>${esc(label)}</span>` : ""}</span>`).join("");
}
