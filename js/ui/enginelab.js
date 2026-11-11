// ---------- the engine lab: index.html?dev=engine,300 plays the race sound at a chosen speed, with no graphics ----------
// A panel with a speed slider (0 to 1000 km/h) and buttons for the gas, the brake, the nitro and cars passing on either side. Auto drive
// accelerates through all eight gears to 1000 km/h, lifts off and brakes, again and again. While the lab is open, update.js asks
// engineLab.tick() for the speed instead of the race, the music stays off and the game behind it gets no keys.
let engineLab = null;
function startEngineLab(kmh) {
  const L = engineLab = { kmh: Math.max(0, Math.min(1000, kmh)), gas: true, brake: false, nitro: false, auto: false, phase: 0, hold: 0 };
  document.getElementById("game").style.display = "none"; const gl = document.getElementById("gl"); if (gl) gl.style.display = "none";
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:50;background:#0d1018;color:#eef;font:600 15px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;overflow:auto";
  const btn = "padding:12px 14px;margin:4px;border-radius:10px;border:1px solid #3a4560;background:#1b2233;color:#eef;font:inherit;min-width:120px;touch-action:manipulation;user-select:none";
  el.innerHTML = `<div style="max-width:560px;width:100%">
    <div style="font-size:22px;font-weight:800;margin-bottom:6px">Engine lab</div>
    <div id="labHint" style="color:#ffd23f;margin-bottom:10px">Click or tap anywhere to start the sound.</div>
    <div id="labRead" style="font-size:28px;font-weight:800;margin:6px 0">-</div>
    <input id="labSpeed" type="range" min="0" max="1000" step="1" style="width:100%;height:36px">
    <div style="display:flex;flex-wrap:wrap;margin:10px -4px">
      <button id="labGas" style="${btn}">Gas: on</button><button id="labBrake" style="${btn}">Brake (hold)</button><button id="labNitro" style="${btn}">Nitro (hold)</button>
      <button id="labAuto" style="${btn}">Auto drive: off</button><button id="labMute" style="${btn}">Sound: on</button>
      <button id="labPL" style="${btn}">Pass left</button><button id="labPR" style="${btn}">Pass right</button>
      <button id="labNL" style="${btn}">Near miss left</button><button id="labNR" style="${btn}">Near miss right</button>
    </div>
    <div style="color:#9aa3b8;font-weight:500;line-height:1.5">Keys: Up gas on/off, Down brake, Space nitro, Left / Right a car passing (with Shift: a near miss), A auto drive, M mute, - / + speed.
    Uses your Engine and Effects volumes from Settings.</div></div>`;
  document.body.appendChild(el);
  const $ = id => document.getElementById(id), speed = $("labSpeed");
  speed.value = L.kmh; speed.oninput = () => { L.kmh = +speed.value; L.auto = false; };
  const wake = () => sound.ensure();
  el.addEventListener("pointerdown", wake);
  const hold = (id, key) => { const b = $(id); b.onpointerdown = e => { e.preventDefault(); L[key] = true; }; b.onpointerup = b.onpointerleave = b.onpointercancel = () => { L[key] = false; }; };
  hold("labBrake", "brake"); hold("labNitro", "nitro");
  $("labGas").onclick = () => { L.gas = !L.gas; };
  $("labAuto").onclick = () => { L.auto = !L.auto; L.phase = 0; L.hold = 0; };
  $("labMute").onclick = () => sound.toggle();
  $("labPL").onclick = () => sound.passBy(-1, false); $("labPR").onclick = () => sound.passBy(1, false);
  $("labNL").onclick = () => sound.passBy(-1, true); $("labNR").onclick = () => sound.passBy(1, true);
  const keys = (e, down) => { // the lab's own keys; the game behind it hears none
    e.stopImmediatePropagation(); if (!down) { if (e.code === "Space") L.nitro = false; if (e.code === "ArrowDown") L.brake = false; return; }
    wake(); if (e.repeat) return;
    if (e.code === "ArrowUp") L.gas = !L.gas; else if (e.code === "ArrowDown") L.brake = true; else if (e.code === "Space") { e.preventDefault(); L.nitro = true; }
    else if (e.code === "ArrowLeft" || e.code === "ArrowRight") sound.passBy(e.code === "ArrowLeft" ? -1 : 1, e.shiftKey);
    else if (e.code === "KeyA") { L.auto = !L.auto; L.phase = 0; } else if (e.code === "KeyM") sound.toggle();
    else if (e.code === "Minus" || e.code === "Equal") { L.kmh = Math.max(0, Math.min(1000, L.kmh + (e.code === "Minus" ? -10 : 10))); L.auto = false; }
  };
  window.addEventListener("keydown", e => keys(e, true), true); window.addEventListener("keyup", e => keys(e, false), true);
  let shown = "";
  L.tick = () => {
    if (L.auto) { // 0 to 1000 km/h through the gears, a lift-off, braking back to 80, and again
      if (L.phase === 0) { L.gas = true; L.brake = false; L.kmh += L.kmh < 360 ? 1.1 : 0.4; if (L.kmh >= 1000) { L.kmh = 1000; L.phase = 1; L.hold = 0; } }
      else if (L.phase === 1) { L.gas = false; L.kmh -= 0.3; if (++L.hold > 150) L.phase = 2; }
      else { L.brake = true; L.kmh -= 4; if (L.kmh <= 80) { L.brake = false; L.phase = 0; } }
    } else if (L.brake && L.kmh > 0) L.kmh = Math.max(0, L.kmh - 4);
    const v = L.kmh / 60, load = L.brake ? -1 : L.gas ? 1 : 0;
    sound.engineTick(true, v, L.nitro, load);
    const txt = `${Math.round(L.kmh)} km/h · gear ${gearOf(v)} · note ${Math.round(sound.engineHz(v))} Hz${L.nitro ? " · NITRO" : ""}${L.brake ? " · braking" : !L.gas ? " · off the gas" : ""}`;
    if (txt !== shown) { shown = txt; $("labRead").textContent = txt; if (L.auto) speed.value = L.kmh; }
    $("labGas").textContent = `Gas: ${L.gas ? "on" : "off"}`; $("labAuto").textContent = `Auto drive: ${L.auto ? "on" : "off"}`; $("labMute").textContent = `Sound: ${sound.on ? "on" : "off (M)"}`;
    $("labHint").style.display = sound.ac && sound.ac.state === "running" ? "none" : "";
  };
  console.info("Engine lab: " + L.kmh + " km/h");
}
