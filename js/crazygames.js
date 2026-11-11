// ---------- CrazyGames (their HTML5 SDK v3) ----------
// index.html loads CrazyGames' SDK from their server. It is only used when the game really runs on CrazyGames: there crazy.on becomes
// true, saves go to CrazyGames (SDK.data, so they follow a signed-in player to any device), CrazyGames is told when a race is running and
// when something is loading, and its mute switch silences the game. Everywhere else (itch.io, Live Server, offline, the SDK blocked or
// missing) crazy.on stays false, every call below does nothing, and the game saves in the browser (localStorage) exactly as before.
//
// This file runs first. The game's own scripts read the save the moment they run, so crazy.boot() starts them only once it knows where
// the save lives. Off CrazyGames there is nothing to wait for and they start straight away. (Asking the SDK first everywhere would cost
// 7 seconds on every other site: that is how long SDK.init() waits for an answer from CrazyGames before it gives up.)
const crazy = {
  on: false, sdk: null,
  data: null,       // where saves go: SDK.data on CrazyGames (it works like localStorage), null = the browser's own localStorage
  muted: false,     // CrazyGames' own mute switch: it wins over the game's sound settings (sound.applyMute)
  playing: false,   // what CrazyGames was last told: a race is running (gameplayStart) or not (gameplayStop)
  loads: 0, loadingOn: false, firstLoad: true, // how many loadings are running, and whether CrazyGames was told "loading"

  call(fn) { try { this.sdk.game[fn](); } catch (e) { console.warn(`CrazyGames ${fn}:`, e && e.message); } },
  // main.js asks every frame: is a race (or the test drive) running right now? Only a change is passed on.
  setPlaying(p) {
    if (!this.on || p === this.playing) return;
    this.playing = p;
    if (p && this.loadingOn) { this.loadingOn = false; this.call("loadingStop"); } // (a city's pack still downloading as the race starts: the race wins)
    this.call(p ? "gameplayStart" : "gameplayStop");
  },
  // around anything that loads: the first loading screen (boot, then loaded()) and each city's pack (citypack.js)
  loadStart() { if (this.on && ++this.loads === 1 && !this.playing) { this.loadingOn = true; this.call("loadingStart"); } },
  loadStop() { if (this.on && this.loads > 0 && --this.loads === 0 && this.loadingOn) { this.loadingOn = false; this.call("loadingStop"); } },
  loaded() { if (this.firstLoad) { this.firstLoad = false; this.loadStop(); } }, // the first loading screen is gone (boot.js, or the watchdog in index.html)

  // index.html calls this with the game's scripts (run in order) and the 3D renderer's module (run after them)
  async boot(scripts, module) {
    const q = new URLSearchParams(location.search);
    const where = location.hostname + " " + document.referrer + " " + Array.from(location.ancestorOrigins || []).join(" "); // (the game's own address and the pages it is framed in)
    if (/crazygames/i.test(where) || q.has("crazygames")) { // (testing: ?crazygames asks the SDK even here)
      for (const src of scripts) this.preload("preload", src); // (the game's files download while we wait for CrazyGames' answer)
      this.preload("modulepreload", module);
      await this.connect();
    }
    this.run(scripts, module);
  },
  preload(rel, href) { const l = document.createElement("link"); l.rel = rel; l.href = href; if (rel === "preload") l.as = "script"; document.head.appendChild(l); },

  async connect() {
    window.SDK_WAIT = true; // (the 3D loading watchdog in index.html doesn't count this wait)
    try {
      const tag = document.getElementById("crazysdk"), t0 = Date.now();
      while (!window.CrazyGames && !(tag && tag.dataset.failed) && Date.now() - t0 < 8000) await new Promise(r => setTimeout(r, 50)); // the SDK script arrives (or fails)
      const SDK = window.CrazyGames && window.CrazyGames.SDK;
      if (!SDK) throw new Error("the SDK script didn't load");
      await Promise.race([SDK.init(), new Promise((_, no) => setTimeout(() => no(new Error("SDK.init() took too long")), 10000))]);
      if (SDK.environment !== "crazygames") { console.info(`CrazyGames SDK not used here (environment: ${SDK.environment})`); return; }
      this.sdk = SDK; this.on = true;
      this.loadStart(); // the first loading screen (loaded() ends it)
      document.addEventListener("visibilitychange", () => { if (document.hidden) this.setPlaying(false); }); // (a hidden tab runs no frames, so main.js can't say it)
      try { SDK.data.getItem("cardodge.copied"); this.data = SDK.data; this.copySave(); } // (it throws if "Progress Save" wasn't ticked in the developer portal)
      catch (e) { console.warn("CrazyGames saves unavailable, saving in this browser instead:", e && e.message); }
      try {
        this.muted = !!SDK.game.settings.muteAudio;
        SDK.game.addSettingsChangeListener(s => { this.muted = !!(s && s.muteAudio); try { sound.applyMute(); } catch (e) {} });
      } catch (e) { console.warn("CrazyGames settings:", e && e.message); }
      console.info("CrazyGames SDK on" + (this.data ? ", saving to CrazyGames" : "") + (this.muted ? ", muted" : ""));
    } catch (e) { console.warn("CrazyGames SDK off:", (e && e.message) || e); }
    finally { window.SDK_WAIT = false; }
  },

  // The first time on CrazyGames: copy the save this browser already has (from before the SDK) into SDK.data, so nobody loses progress.
  // A name SDK.data already holds is left alone, and "cardodge.copied" makes sure this happens only once.
  copySave() {
    const d = this.data;
    if (d.getItem("cardodge.copied") !== null || new URLSearchParams(location.search).has("fresh")) return;
    let n = 0;
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("cardodge.") && d.getItem(k) === null) { d.setItem(k, localStorage.getItem(k)); n++; } } catch (e) {}
    d.setItem("cardodge.copied", "true");
    if (n) console.info(`CrazyGames: copied ${n} saved values from this browser`);
  },

  // the game's scripts run in the order given (async = false keeps the order), then the 3D module, which needs them all
  run(scripts, module) {
    let left = scripts.length;
    const next = () => { if (--left === 0) { const m = document.createElement("script"); m.type = "module"; m.src = module; document.body.appendChild(m); } };
    for (const src of scripts) { const s = document.createElement("script"); s.src = src; s.async = false; s.onload = s.onerror = next; document.body.appendChild(s); }
  },
};
