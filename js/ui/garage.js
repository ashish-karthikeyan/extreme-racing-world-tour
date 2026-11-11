// ---------- the Garage and Upgrades screens ----------
// With the 3D renderer on, these two screens are HTML laid over the 3D showroom (css/garage.css): a top bar with the coins, a glass panel with the
// team, its stats and the buttons, and the free area in between where the car is drawn. Keyboard, controller, mouse and touch all end in the same
// menuAction / activate calls the canvas menus used, so what each button does is unchanged (prices, saves, unlocks and buying live in menus.js).
// Without 3D, the old canvas screens are drawn instead.

const GX_COIN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="url(#gxc)" stroke="#8a5a00" stroke-width="1.2"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#b97a00" stroke-width="1.4"/><path d="M12 7.4v9.2M9.6 9.8c.5-.8 1.3-1.2 2.4-1.2 1.5 0 2.5.8 2.5 1.9 0 2.6-5 1.3-5 3.9 0 1.2 1 2 2.6 2 1.1 0 2-.4 2.5-1.2" fill="none" stroke="#a36a00" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const GX_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const GX_ICON = {
  handling: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/><path d="M3.5 10.5h6M14.5 10.5h6M12 14.5V21"/></svg>`,
  nitro: `<svg viewBox="0 0 24 24"><path d="M13 2L5 13.5h5.5L9.5 22 19 9.5h-5.8z" fill="currentColor"/></svg>`,
  magnet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 3v8a7 7 0 0014 0V3h-4v8a3 3 0 01-6 0V3z"/><path d="M5 7h4M15 7h4"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/></svg>`,
};
// The bars: Top speed and Acceleration are the same for every car (all cars drive alike; only the livery differs). Handling and Nitro start at
// the base value and grow with the upgrades you have bought (5 levels = a full bar), shown as a brighter segment.
// text = beside the bar on a wide screen, short = beside the name on a phone.
const nitroSecs = () => (NITRO_FRAMES * (1 + 0.15 * upLvl("nitro")) / 60).toFixed(1);
const GX_STATS = [
  { key: "top", name: "Top speed", base: () => 0.82, bonus: () => 0, text: () => "300+ km/h", short: () => "300+" },
  { key: "acc", name: "Acceleration", base: () => 0.78, bonus: () => 0, text: () => "0-100 in 1.8 s", short: () => "1.8 s" },
  { key: "han", name: "Handling", base: () => 0.5, bonus: () => 0.1 * upLvl("handling"), text: () => upLvl("handling") ? `+${upLvl("handling") * 8}% turn` : "Standard", short: () => upLvl("handling") ? `+${upLvl("handling") * 8}%` : "Std" },
  { key: "nit", name: "Nitro", base: () => 0.5, bonus: () => 0.1 * upLvl("nitro"), text: () => `${nitroSecs()} s burn`, short: () => `${nitroSecs()} s` },
];
const gxHint = () => promptHTML(state === "upgrades" ? [["change", "Choose"], ["confirm", "Upgrade"], ["back", "Back"]] : [["browse", "Browse"], ["confirm", "Select"], ["spin", "Turn"], ["back", "Back"]]); // follows the device you are using (keys, Xbox / PlayStation buttons, or touch)

const garageUI = (() => {
  let root, el = {}, ok = false, shown = false, key = "", idx = -1, lvls = {}, hideTimer = 0, drag = null;

  function build() {
    root = document.createElement("div"); root.id = "gx"; root.className = "gx"; root.hidden = true; root.dataset.page = "garage";
    root.innerHTML = `
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><radialGradient id="gxc" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff3a8"/><stop offset="0.5" stop-color="#ffd23f"/><stop offset="1" stop-color="#c98a00"/></radialGradient></defs></svg>
      <div class="gx-in">
        <header class="gx-top"><div class="gx-title"><span>Garage</span><small id="gx-sub"></small></div><div class="gx-coins" title="Coins">${GX_COIN}<span id="gx-wallet">0</span></div></header>
        <div class="gx-tip" id="gx-tip"><b>TIP</b><span></span></div>
        <div class="gx-zone"></div>
        <div class="gx-dock">
          <div class="gx-panel gx-page gx-p-garage">
            <section class="gx-info">
              <div class="gx-eyebrow"><span class="gx-badge" id="gx-badge"></span><span id="gx-pos"></span></div>
              <h1 class="gx-name" id="gx-name"></h1><p class="gx-tag" id="gx-tag"></p>
              <div class="gx-liv"><span>Livery</span><i></i><i></i><i></i></div>
            </section>
            <section class="gx-stats-sec"><h3 class="gx-sh">Performance</h3>
              ${GX_STATS.map(s => `<div class="gx-stat" data-stat="${s.key}"><span>${s.name}<em></em></span><div class="gx-bar"><b></b><b></b></div><em></em></div>`).join("")}
            </section>
            <section class="gx-act">
              <div class="gx-browse"><button class="gx-arrow" data-act="prev" aria-label="Previous car">‹</button>
                <div class="gx-count"><b id="gx-cur"></b><span id="gx-of"></span><div class="gx-dots" id="gx-dots"></div></div><button class="gx-arrow" data-act="next" aria-label="Next car">›</button></div>
              <button class="gx-btn gx-main" data-i="0" id="gx-main"></button>
              <div class="gx-need" id="gx-need"></div>
              <div class="gx-row"><button class="gx-btn gx-sec" data-i="1">Upgrades</button><button class="gx-btn gx-sec" data-i="2">Back</button></div>
              <div class="gx-hint" id="gx-hint"></div>
            </section>
          </div>
          <div class="gx-panel gx-page gx-p-upgrades">
            <div class="gx-uphead"><h2>Upgrades</h2><p>Permanent boosts that apply to every car you drive.</p><button class="gx-btn gx-sec" data-i="4">Back</button><div class="gx-hint" id="gx-hint2"></div></div>
            <div class="gx-ups">${UPGRADES.map((u, i) => `<button class="gx-btn gx-up" data-i="${i}"><div class="gx-up-top">${GX_ICON[u.key] || ""}<span>${u.name}</span></div><div class="gx-pips"><i></i><i></i><i></i><i></i><i></i></div><div class="gx-up-now"></div><div class="gx-up-next"></div><div class="gx-up-buy"></div></button>`).join("")}</div>
          </div>
        </div>
        <div class="gx-flash"></div>
      </div>`;
    document.getElementById("stage").appendChild(root);
    const q = s => root.querySelector(s), qa = s => Array.from(root.querySelectorAll(s));
    el = { sub: q("#gx-sub"), wallet: q("#gx-wallet"), coins: q(".gx-coins"), zone: q(".gx-zone"), badge: q("#gx-badge"), pos: q("#gx-pos"), name: q("#gx-name"), tag: q("#gx-tag"), liv: qa(".gx-liv i"),
      stats: qa(".gx-stat"), tip: q("#gx-tip"), cur: q("#gx-cur"), of: q("#gx-of"), dots: q("#gx-dots"), main: q("#gx-main"), need: q("#gx-need"), hints: qa(".gx-hint"), flash: q(".gx-flash"), ups: qa(".gx-up"), items: qa("[data-i]") };
    el.dots.innerHTML = TEAMS.map(() => "<i></i>").join(""); el.dotEls = Array.from(el.dots.children);

    // buttons: the same calls the keyboard and controller make. They never take keyboard focus (so Enter cannot press them a second time).
    root.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
    root.addEventListener("focusin", e => { if (e.target.blur) e.target.blur(); });
    root.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !root.contains(b)) return;
      sound.ensure();
      if (b.dataset.act) { menuAction(b.dataset.act === "prev" ? "left" : "right"); return; }
      const i = +b.dataset.i; if (Number.isNaN(i)) return; sel = i; activate(i);
    });
    root.addEventListener("pointerover", e => { if (e.pointerType !== "mouse") return; const b = e.target.closest("[data-i]"); if (b) sel = +b.dataset.i; }); // hover = choose, like the old menus

    // drag anywhere in the free area (it is the canvas underneath) to turn the car
    canvas.addEventListener("pointerdown", e => {
      if (!domMenuActive() || !R3D.showroom) return;
      drag = { id: e.pointerId, x: e.clientX, t: performance.now() }; R3D.showroom.grab(); try { canvas.setPointerCapture(e.pointerId); } catch (err) {} canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", e => {
      if (!drag || drag.id !== e.pointerId || !window.R3D || !R3D.showroom) return;
      const now = performance.now(); R3D.showroom.drag(e.clientX - drag.x, (now - drag.t) / 1000); drag.x = e.clientX; drag.t = now;
    });
    const end = e => { if (!drag || drag.id !== e.pointerId) return; drag = null; canvas.style.cursor = "grab"; if (window.R3D && R3D.showroom) R3D.showroom.release(); };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

    // tell the 3D scene which part of the screen is free for the car
    const measure = () => {
      const c = canvas.getBoundingClientRect(), z = el.zone.getBoundingClientRect(); if (c.height < 2 || z.height < 2) return; // (hidden: nothing to measure)
      window.garageLayout = { top: (z.top - c.top) / c.height, bottom: (z.bottom - c.top) / c.height };
      fitName();
    };
    el.measure = measure;
    if (window.ResizeObserver) { const ro = new ResizeObserver(measure); ro.observe(el.zone); ro.observe(root); }
    window.addEventListener("resize", measure);
  }
  try { build(); ok = true; } catch (e) { console.warn("The Garage screen could not be built; the canvas version is used instead", e); }

  function fitName() { // shrink a long team name until it fits on one line
    const n = el.name; if (!n || !shown) return; n.style.fontSize = ""; let s = parseFloat(getComputedStyle(n).fontSize), i = 0;
    while (n.scrollWidth > n.clientWidth + 1 && s > 10 && i++ < 24) { s *= 0.94; n.style.fontSize = s.toFixed(1) + "px"; }
  }
  function setColour(hex) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); root.style.setProperty("--team", hex); root.style.setProperty("--team-rgb", `${r}, ${g}, ${b}`); }

  function setBars(animate) { // the stat bars: refill from empty (a new car) or slide to the new values (an upgrade was bought)
    const vals = GX_STATS.map(s => ({ base: s.base(), bonus: s.bonus(), text: s.text(), short: s.short() }));
    el.stats.forEach((row, i) => {
      const [b0, b1] = row.querySelectorAll(".gx-bar b"), v = vals[i], ems = row.querySelectorAll("em");
      ems[0].textContent = v.short; ems[1].textContent = v.text; // (the short value sits beside the name on a phone, the full one at the end of the bar on a wide screen)
      const set = (delay, ease) => { b0.style.transition = `width 0.7s ${ease} ${delay}ms`; b1.style.transition = `width 0.7s ${ease} ${delay + 250}ms, left 0.7s ${ease} ${delay}ms`; b0.style.width = v.base * 100 + "%"; b1.style.left = v.base * 100 + "%"; b1.style.width = v.bonus * 100 + "%"; };
      if (animate) { b0.style.transition = b1.style.transition = "none"; b0.style.width = b1.style.width = "0%"; b1.style.left = "0%"; void b0.offsetWidth; set(60 + i * 70, "cubic-bezier(0.2, 0.8, 0.2, 1)"); }
      else set(0, "ease");
    });
  }
  const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  function update() {
    const upg = state === "upgrades";
    root.dataset.page = upg ? "upgrades" : "garage"; el.sub.textContent = upg ? "Upgrades" : "Choose your car";
    el.wallet.textContent = wallet; el.hints.forEach(h => { h.innerHTML = gxHint(); });
    for (const b of el.items) b.classList.toggle("sel", +b.dataset.i === sel);
    const t = TEAMS[garageIdx]; setColour(teamAccent(t));
    if (upg) { updateUpgrades(); return; }
    const own = owned.includes(garageIdx), eq = garageIdx === equipped, afford = wallet >= t.cost;
    if (idx !== garageIdx) { // a different car: the name and line slide in, the bars refill
      idx = garageIdx; el.name.textContent = t.name; el.tag.textContent = t.tag; el.pos.textContent = "";
      el.liv[0].style.background = t.p; el.liv[1].style.background = t.s; el.liv[2].style.background = t.a;
      for (const n of [el.name, el.tag]) retrigger(n, "gx-swap");
      el.cur.textContent = garageIdx + 1; el.of.textContent = ` / ${TEAMS.length}`; fitName(); setBars(true);
    }
    el.dotEls.forEach((d, i) => { d.classList.toggle("own", owned.includes(i)); d.classList.toggle("cur", i === garageIdx); });
    el.badge.textContent = eq ? "Equipped" : own ? "Owned" : "Locked"; el.badge.className = "gx-badge" + (eq ? "" : own ? " owned" : " locked");
    el.main.className = "gx-btn gx-main" + (eq ? " eq" : own ? "" : afford ? " buy" : " need") + (+el.main.dataset.i === sel ? " sel" : "");
    el.main.innerHTML = eq ? `${GX_CHECK}<span>Equipped</span>` : own ? `<span>Select</span>` : `${GX_COIN}<span>Buy - ${t.cost} coins</span>`;
    el.need.className = "gx-need" + (!own && !afford ? " bad" : "");
    el.need.innerHTML = !own && !afford ? `${GX_COIN}<span>Need ${t.cost - wallet} more coins</span>` : !own ? `<span>${wallet - t.cost} coins left after buying</span>` : eq ? "<span>This is your car</span>" : "<span>In your garage</span>";
    setBarsIfUpgraded();
  }
  let barKey = ""; // the bars follow the upgrades: slide them when one is bought
  function setBarsIfUpgraded() { const k = upLvl("handling") + "," + upLvl("nitro"); if (k !== barKey) { const first = barKey === ""; barKey = k; if (!first) setBars(false); } }

  function updateUpgrades() {
    UPGRADES.forEach((u, i) => {
      const card = el.ups[i], l = upLvl(u.key), max = l >= 5, cost = UPG_COST[l], afford = !max && wallet >= cost;
      card.classList.toggle("max", max); card.classList.toggle("need", !max && !afford);
      const pips = card.querySelectorAll(".gx-pips i");
      pips.forEach((p, k) => { p.classList.toggle("on", k < l); if (lvls[u.key] !== undefined && l > lvls[u.key] && k === l - 1) retrigger(p, "pop"); });
      lvls[u.key] = l;
      card.querySelector(".gx-up-now").textContent = u.now(l);
      card.querySelector(".gx-up-next").textContent = max ? "Fully upgraded" : `Next level: ${u.next(l + 1)}`;
      card.querySelector(".gx-up-buy").innerHTML = max ? "<span>MAX</span>" : `<span>${GX_COIN}${cost}</span><small>${afford ? "Upgrade" : `Need ${cost - wallet}`}</small>`;
    });
    setBarsIfUpgraded();
  }

  function show() {
    shown = true; clearTimeout(hideTimer); root.hidden = false; el.measure(); key = ""; idx = -1; lvls = {}; barKey = ""; canvas.style.cursor = "grab";
    requestAnimationFrame(() => { el.measure(); root.classList.add("in"); });
  }
  function hide() { shown = false; root.classList.remove("in"); canvas.style.cursor = ""; drag = null; hideTimer = setTimeout(() => { if (!shown) root.hidden = true; }, 400); }

  return {
    get ok() { return ok; },
    // once per frame (from draw): show / hide the screen and bring it up to date when something it shows has changed
    sync() {
      if (!ok) return;
      const want = !!window.R3D && (state === "garage" || state === "upgrades");
      if (!want) { if (shown) hide(); return; }
      if (!shown) show();
      const k = [state, garageIdx, equipped, wallet, owned.length, sel, inputDev, padKind, upLvl("handling"), upLvl("nitro"), upLvl("magnet"), upLvl("shield")].join("|");
      if (k !== key) { const w = el.wallet.textContent; key = k; update(); if (w !== String(wallet) && w !== "0") retrigger(el.coins, "pop"); }
    },
    flash() { el.flash.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 750, easing: "ease-out" }); retrigger(el.coins, "pop"); },
    shake() { retrigger(el.main, "gx-shake"); for (const c of el.ups) if (+c.dataset.i === sel) retrigger(c, "gx-shake"); },
    pop(node) { retrigger(node || el.badge, "pop"); },
    get badge() { return el.badge; },
    tip(text) { // the one-time hint (js/ui/hints.js): a small bubble under the top bar, in the page's flow so it never covers the car or a button
      if (!ok) return; if (text) el.tip.lastChild.textContent = text;
      el.tip.classList.toggle("on", !!text);
    },
  };
})();

// Is the Garage / Upgrades HTML on screen? (If so the canvas menu behind it is not drawn and its invisible buttons do not react.)
function domMenuActive() { return !!(window.R3D && garageUI.ok && (state === "garage" || state === "upgrades")); }

// Effects for buying and equipping (called from menus.js). The sounds play with or without 3D.
const garageFx = {
  bought(i) { // a car was bought: a rising chime and a pop of confetti, a white flash, a ring of light and the car revealed in its colours
    [523, 659, 784, 1047].forEach((f, k) => sound.tone(f, f * 1.01, 0.3, "triangle", 0.07, k * 0.07));
    sound.tone(1568, 3136, 0.55, "sine", 0.05, 0.3); sound.burst(0.3, 0.4, "highpass", 3000, 9000, 0.05); sound.coin();
    if (window.R3D && R3D.showroom) { R3D.showroom.buy(TEAMS[i], true); if (domMenuActive()) garageUI.flash(); }
  },
  upgraded() { sound.tone(500, 1400, 0.3, "triangle", 0.08); sound.tone(1568, 2400, 0.25, "sine", 0.04, 0.12); if (window.R3D && R3D.showroom) { R3D.showroom.buy(TEAMS[garageIdx], false); } },
  equipped() { sound.tone(440, 880, 0.12); sound.tone(1320, 1760, 0.1, "sine", 0.04, 0.08); if (domMenuActive()) garageUI.pop(); },
  denied() { if (domMenuActive()) garageUI.shake(); },
};
