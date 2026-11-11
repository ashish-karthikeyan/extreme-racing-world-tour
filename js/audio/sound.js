// ---------- sound (synthesised, no assets) ----------

// how loud the whole race sound is: measured (A-weighted, as the ear hears it) to sit just under the menu music at full volume
const RACE_LEVEL = 0.26;

const sound = {
  on: store.get("sound", true), ac: null, master: null, out: null, eng: null, env: null, nit: null, noiseBuf: null,
  ensure() {
    if (!this.ac) {
      try {
        this.ac = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ac.createGain(); this.master.connect(this.ac.destination); // every sound (effects, engine, music) leaves through here
        this.applyMute();
        this.out = this.ac.createGain();
        this.out.gain.value = 0.22; // master level for effects: kept low
        this.out.connect(this.master);
        this.fxBus = this.ac.createGain(); this.fxBus.gain.value = settings.fx; this.fxBus.connect(this.out); // effects volume
        // the race sounds share a gentle compressor, so a nitro roar or a close pass never clips or pierces
        const c = this.raceComp = this.ac.createDynamicsCompressor();
        c.threshold.value = -28; c.knee.value = 12; c.ratio.value = 3.5; c.attack.value = 0.008; c.release.value = 0.25; c.connect(this.out);
        this.engBus = this.ac.createGain(); this.engBus.gain.value = settings.engine; this.engBus.connect(c); // engine volume (the engine, its nitro and its burble)
        this.raceFx = this.ac.createGain(); this.raceFx.gain.value = settings.fx; this.raceFx.connect(c); // effects volume for the race's wind, tyres and passing cars
      } catch (e) { this.ac = null; }
    }
    if (this.ac && this.ac.state !== "running" && this.ac.state !== "closed") this.ac.resume(); // (iOS can also leave it "interrupted" after the app was in the background)
    return this.ac;
  },
  noiseBuffer() {
    if (!this.noiseBuf) {
      const ac = this.ac, len = ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  },
  tone(f1, f2, dur, type = "square", vol = 0.06, delay = 0) {
    if (!this.on || !this.ensure()) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.fxBus);
    o.start(t); o.stop(t + dur);
  },
  // filtered noise burst whose filter sweeps from f0 to f1: the building block for clicks, whooshes and pops
  burst(dur, vol, type, f0, f1, delay = 0) {
    if (!this.on || !this.ensure()) return;
    const t = this.ac.currentTime + delay, src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    src.buffer = this.noiseBuffer(); f.type = type; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.fxBus);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  },
  coin() { this.tone(900, 1500, 0.09, "square", 0.04); },
  jingle(i) { // a short rising motif, pitched a little differently for each country
    const base = [523, 587, 659, 698, 784][i % 5];
    [1, 1.25, 1.5, 2].forEach((m, k) => this.tone(base * m, base * m, 0.28, "triangle", 0.05, k * 0.11));
  },
  // ---- the race sound: engine, nitro, wind, tyres and the cars rushing past ----
  // A fixed set of about 35 audio nodes is built when a race starts (buildRace), then only steered: every frame engineTick changes their
  // pitch, filters and volumes. A moment after the race stops (menus, pause, a hidden tab) they are taken apart, so nothing runs on the
  // menus and nothing is made per frame. The engine is synthesised: a warm stack of harmonics locked to the firing note (one oscillator
  // with a custom wave), a slightly detuned copy and a sub-bass an octave down for body, a little noise "grain" at the firing note,
  // soft saturation (rounded, never a raw square wave) and a gentle low-pass filter.
  brownNoise() { // deep "brown" noise (soft, no hiss) for the wind, the tyres and the whooshes: 4 s so its loop is never heard
    if (!this.brownBuf) {
      const ac = this.ac, len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      let b = 0; for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
      this.brownBuf = buf;
    }
    return this.brownBuf;
  },
  engineWave() { // the engine's harmonics: strong low ones, softly falling, with mixed phases so the wave has no sharp peaks
    if (!this.engWave) {
      const N = 24, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
      for (let n = 1; n <= N; n++) { const a = (n === 1 ? 1 : n === 2 ? 0.8 : n === 3 ? 0.62 : 0.9 / Math.pow(n, 0.85)) * (n % 4 === 0 ? 0.7 : 1), ph = n * 2.399; re[n] = a * Math.cos(ph); im[n] = a * Math.sin(ph); }
      this.engWave = this.ac.createPeriodicWave(re, im);
      const k = 1.7, curve = new Float32Array(1024); // soft saturation: tanh, so loud moments round off instead of buzzing
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
      this.satCurve = curve;
    }
    return this.engWave;
  },
  buildRace() {
    const ac = this.ac, G = v => { const g = ac.createGain(); g.gain.value = v; return g; }, F = (type, f, q) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const O = (type, f) => { const o = ac.createOscillator(); if (type === "engine") o.setPeriodicWave(this.engineWave()); else o.type = type; o.frequency.value = f; return o; };
    const N = (buf, rate = 1) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; return s; };
    const P = () => ac.createStereoPanner ? ac.createStereoPanner() : null; // (older Safari has no panner: the whoosh then stays in the middle)
    const engOut = G(0), fxOut = G(0); engOut.connect(this.engBus); fxOut.connect(this.raceFx); // both start silent and fade in
    // the engine voice
    const main = O("engine", 60), twin = O("engine", 60), sub = O("sine", 30), twinG = G(0.45), subG = G(0.35), mix = G(1), drive = G(0.42);
    const grain = N(this.noiseBuffer()), grainF = F("bandpass", 180, 2.2), grainG = G(0.05);
    const throb = O("sine", 8), throbG = G(0.08), amp = G(1); // a slow throb in the volume, like the cylinders' uneven beat
    const sat = ac.createWaveShaper(); sat.curve = this.satCurve; sat.oversample = "2x";
    const lp = F("lowpass", 900, 0.5), hp = F("highpass", 45, 0.7), voice = F("peaking", 450, 0.8), body = G(0.5); voice.gain.value = 5; // (voice: the exhaust's resonance, so a phone's small speaker still hears the engine)
    main.connect(mix); twin.connect(twinG); twinG.connect(mix); sub.connect(subG); subG.connect(mix);
    grain.connect(grainF); grainF.connect(grainG); grainG.connect(mix);
    mix.connect(drive); drive.connect(sat); sat.connect(amp); throb.connect(throbG); throbG.connect(amp.gain);
    amp.connect(lp); lp.connect(hp); hp.connect(voice); voice.connect(body); body.connect(engOut);
    // the burble when you lift off or brake: low noise, gently pulsing
    const burble = N(this.brownNoise(), 1.3), burbleF = F("lowpass", 320, 0.9), burbleAmp = G(0.5), flutter = O("sine", 11), flutterG = G(0.5), burbleG = G(0);
    burble.connect(burbleF); burbleF.connect(burbleAmp); flutter.connect(flutterG); flutterG.connect(burbleAmp.gain); burbleAmp.connect(burbleG); burbleG.connect(engOut);
    // nitro: a deep rushing roar under the engine
    const rush = N(this.brownNoise(), 0.8), rushF = F("lowpass", 700, 0.7), rushG = G(0);
    rush.connect(rushF); rushF.connect(rushG); rushG.connect(engOut);
    // wind past the car and the tyres' roar on the road
    const wind = N(this.brownNoise(), 1.7), windF = F("bandpass", 600, 0.55), windLp = F("lowpass", 2000, 0.5), windG = G(0);
    wind.connect(windF); windF.connect(windLp); windLp.connect(windG); windG.connect(fxOut);
    const tyre = N(this.brownNoise(), 0.6), tyreF = F("lowpass", 180, 0.8), tyreG = G(0);
    tyre.connect(tyreF); tyreF.connect(tyreG); tyreG.connect(fxOut);
    // a car rushing past: one voice, panned to its side, retriggered for each pass
    const whoosh = N(this.noiseBuffer()), whooshF = F("bandpass", 700, 0.9), whooshG = G(0), pan = P();
    whoosh.connect(whooshF); whooshF.connect(whooshG); if (pan) { whooshG.connect(pan); pan.connect(fxOut); } else whooshG.connect(fxOut);
    const srcs = [main, twin, sub, throb, flutter, grain, burble, rush, wind, tyre, whoosh];
    for (const s of srcs) { if (s.buffer) s.start(0, Math.random() * s.buffer.duration * 0.9); else s.start(); } // (each noise starts at its own place)
    this.race = { srcs, engOut, fxOut, main, twin, sub, subG, drive, grainF, grainG, throb, throbG, lp, voice, body, burbleG, flutter, rushG, rushF, windF, windG, tyreF, tyreG, whooshF, whooshG, pan,
      wander: 0, gust: 1, lift: 9, punch: -9, idle: 0 };
  },
  // the engine's firing note (Hz) at a speed: it climbs through each gear (a soft dip as the next gear comes in, no sound effect), and above
  // the 8th gear's redline (360 km/h) it settles into a high cruise note that keeps rising very slowly, never a limiter
  engineHz(v) {
    const kmh = v * 60, rpm = rpmOf(v);
    const base = kmh <= 360 ? 52 + 128 * Math.pow(Math.max(0, kmh) / 360, 0.8) : 180 + 26 * (1 - Math.exp(-(kmh - 360) / 320));
    return base * (1 + 0.11 * (rpm - 0.55));
  },
  // every frame: active = racing; v = the car's speed (revs on the grid); boost = nitro burning; load = gas (1) .. off (0) .. braking (-1)
  engineTick(active, v, boost = false, load = 1) {
    const ac = this.ac;
    if (!ac || ac.state !== "running") return;
    if (active && this.on) {
      if (!this.race) this.buildRace();
      const R = this.race, t = ac.currentTime, kmh = v * 60, on = load > 0.15;
      R.idle = 0;
      R.lift = on ? 0 : R.lift + 1 / 60; // seconds since you lifted off
      R.wander = R.wander * 0.98 + (Math.random() - 0.5) * 0.0016; // a little random drift, so it never sounds like a test tone
      const f = this.engineHz(v) * (on ? 1 : 0.97) * (boost ? 1.04 : 1) * (1 + R.wander + (Math.random() - 0.5) * 0.002);
      R.main.frequency.setTargetAtTime(f, t, 0.06);
      R.twin.frequency.setTargetAtTime(f * 1.007, t, 0.06);
      R.sub.frequency.setTargetAtTime(f * 0.5, t, 0.06);
      R.grainF.frequency.setTargetAtTime(f * 3, t, 0.06);
      R.throb.frequency.setTargetAtTime(6 + f * 0.04, t, 0.2);
      const punch = Math.max(0, 1 - (t - R.punch) / 0.5), hot = (boost ? 1 : 0) + punch * 0.6; // the first half second of a nitro: a fuller, deeper push
      R.drive.gain.setTargetAtTime((on ? 0.42 : 0.3) + hot * 0.1, t, 0.08);
      R.subG.gain.setTargetAtTime(0.35 + hot * 0.15, t, 0.08);
      R.voice.frequency.setTargetAtTime(380 + f * 2, t, 0.1);
      R.grainG.gain.setTargetAtTime(on ? 0.05 : 0.025, t, 0.1);
      R.throbG.gain.setTargetAtTime(on ? 0.08 : 0.16, t, 0.2);
      R.lp.frequency.setTargetAtTime(Math.min(2600, 520 + f * 7 + (on ? 250 : -120) + hot * 300), t, 0.08);
      R.body.gain.setTargetAtTime((on ? 0.5 : 0.36) * (1 + hot * 0.15), t, 0.1);
      // the burble: strongest just after lifting off (and while braking), fading after a second
      const burb = kmh > 40 ? (load < -0.2 ? 0.16 : 0) + (on ? 0 : 0.32 * Math.exp(-R.lift / 0.7)) : 0;
      R.burbleG.gain.setTargetAtTime(burb, t, 0.06);
      R.flutter.frequency.setTargetAtTime(8 + Math.random() * 6, t, 0.1);
      // nitro's rush, the wind and the tyres
      R.rushG.gain.setTargetAtTime(boost ? 0.22 + punch * 0.15 : 0, t, boost ? 0.05 : 0.25);
      R.rushF.frequency.setTargetAtTime(boost ? 600 + punch * 500 : 300, t, 0.1);
      const s = Math.min(kmh, 1000) / 1000;
      R.gust += (1 + (Math.random() - 0.5) * 0.5 - R.gust) * 0.02; // slow gusts
      R.windG.gain.setTargetAtTime(Math.pow(s, 1.5) * 0.55 * R.gust, t, 0.15);
      R.windF.frequency.setTargetAtTime(450 + s * 900, t, 0.2);
      R.tyreG.gain.setTargetAtTime(kmh > 5 ? 0.06 + Math.sqrt(s) * 0.22 : 0, t, 0.15);
      R.tyreF.frequency.setTargetAtTime(140 + s * 160, t, 0.2);
      R.engOut.gain.setTargetAtTime(RACE_LEVEL, t, 0.05); R.fxOut.gain.setTargetAtTime(RACE_LEVEL, t, 0.05);
    } else if (this.race) { // fade out quickly, then take it all apart
      const R = this.race;
      if (R.idle++ === 0) { const t = ac.currentTime; R.engOut.gain.setTargetAtTime(0, t, 0.04); R.fxOut.gain.setTargetAtTime(0, t, 0.04); }
      if (R.idle > 20) this.stopRace();
    }
  },
  stopRace() {
    const R = this.race; if (!R) return;
    this.race = null;
    try { R.engOut.gain.value = 0; R.fxOut.gain.value = 0; R.engOut.disconnect(); R.fxOut.disconnect(); for (const s of R.srcs) s.stop(); } catch (e) {}
  },
  // a car rushing past on one side (-1 left, 1 right, 0 behind you): louder on a near miss, and it swings out to its side
  passBy(side, near) {
    const R = this.race; if (!R || !this.on) return;
    const t = this.ac.currentTime, peak = near ? 1.8 : 0.8, g = R.whooshG.gain, f = R.whooshF.frequency;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(peak, t + 0.05); g.setTargetAtTime(0, t + 0.08, near ? 0.16 : 0.1);
    f.cancelScheduledValues(t); f.setValueAtTime(500, t); f.linearRampToValueAtTime(near ? 1500 : 1100, t + 0.06); f.setTargetAtTime(420, t + 0.08, 0.15);
    if (R.pan) { const p = R.pan.pan; p.cancelScheduledValues(t); p.setValueAtTime(side * 0.25, t); p.linearRampToValueAtTime(side * 0.85, t + 0.12); }
  },
  nitroStart() { if (this.race) this.race.punch = this.ac.currentTime; }, // the nitro's punch and roar are part of the engine (engineTick)
  nitroEnd() {}, // (the roar simply eases away)
  // everything cut dead the instant you crash
  silence() {
    this.stopRace();
    if (this.env) { this.env.rain.gain.cancelScheduledValues(0); this.env.wind.gain.cancelScheduledValues(0); this.env.rain.gain.value = 0; this.env.wind.gain.value = 0; }
  },
  thud() { this.burst(0.22, 0.5, "lowpass", 700, 120); this.tone(90, 35, 0.2, "sine", 0.18); },
  // ambience: rain hiss, wind and birdsong follow the weather
  envTick(active, rain, wind, birds) {
    if (!this.ac || this.ac.state !== "running") return;
    if (!this.env) {
      const ac = this.ac, buf = this.noiseBuffer();
      const mk = (type, freq, q) => {
        const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = buf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(this.fxBus); s.start();
        return g;
      };
      this.env = { rain: mk("highpass", 2200, 0.7), wind: mk("bandpass", 420, 0.9) };
    }
    const on = this.on && active, t = this.ac.currentTime;
    this.env.rain.gain.setTargetAtTime(on ? rain * 0.05 : 0, t, 0.4);
    this.env.wind.gain.setTargetAtTime(on ? wind * 0.07 : 0, t, 0.4);
    if (on && birds > 0.05 && Math.random() < 0.012 * birds) {
      const f = rnd(2600, 3500);
      this.tone(f, f * 1.25, 0.07, "sine", 0.025);
      this.tone(f * 1.1, f * 1.4, 0.07, "sine", 0.025, 0.1);
    }
  },
  toggle() { this.on = !this.on; store.set("sound", this.on); if (this.on) this.tone(500, 800, 0.1); },
  // CrazyGames' mute switch (crazy.muted): silences everything at the very end, so the game's own sound settings can't turn it back on
  applyMute() {
    if (this.master) this.master.gain.value = crazy.muted ? 0 : 1;
    if (music.audio) music.audio.muted = crazy.muted; // (a song of your own plays outside the sound graph)
  },
};

