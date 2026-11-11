// ---------- menu music ----------
// Original synth tracks (no audio files shipped), plus any songs the player adds from their own device.

const SYNTH_TRACKS = [
  { name: "Redline", bpm: 128, bass: [0, 3, 6, 8, 11, 14], chords: [[57, 0, 3, 7], [53, 0, 4, 7], [60, 0, 4, 7], [55, 0, 4, 7]] },
  { name: "Pole Position", bpm: 120, bass: [0, 2, 4, 6, 8, 10, 12, 14], chords: [[52, 0, 3, 7], [48, 0, 4, 7], [55, 0, 4, 7], [50, 0, 4, 7]] },
  { name: "Midnight Apex", bpm: 108, bass: [0, 6, 8, 14], chords: [[50, 0, 3, 7], [46, 0, 4, 7], [53, 0, 4, 7], [48, 0, 4, 7]] },
  { name: "Chequered Flag", bpm: 136, bass: [0, 3, 6, 8, 10, 12, 15], chords: [[48, 0, 3, 7], [44, 0, 4, 7], [51, 0, 4, 7], [46, 0, 4, 7]] },
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const music = {
  on: store.get("music", true), tracks: SYNTH_TRACKS.map(t => ({ name: t.name, synth: t })), idx: -1, playing: false,
  bus: null, timer: null, step: 0, nextT: 0, audio: null, userCount: 0,
  get name() { return this.idx >= 0 ? this.tracks[this.idx].name : "-"; },
  addBlob(name, blob) {
    this.tracks.push({ name: name.replace(/\.[^.]+$/, ""), url: URL.createObjectURL(blob) });
    this.userCount++;
  },
  clearUser() { this.stop(); this.tracks = this.tracks.filter(t => t.synth); this.userCount = 0; this.idx = -1; },
  tick(should) {
    const want = should && sound.on && this.on && settings.music > 0;
    if (want && !this.playing && sound.ac && sound.ac.state === "running") this.start();
    else if (!want && this.playing) this.stop();
  },
  start() {
    if (this.idx < 0) { const u = this.tracks.findIndex(t => !t.synth); this.idx = u >= 0 ? u : Math.floor(Math.random() * SYNTH_TRACKS.length); }
    const tr = this.tracks[this.idx];
    this.playing = true;
    if (tr.synth) {
      const ac = sound.ac;
      this.bus = ac.createGain(); this.bus.gain.value = 0; this.bus.connect(sound.master);
      this.bus.gain.setTargetAtTime(0.5 * settings.music, ac.currentTime, 0.15);
      this.step = 0; this.nextT = ac.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(tr.synth), 25);
    } else {
      this.audio = new Audio(tr.url); this.audio.volume = 0.6 * settings.music; this.audio.muted = crazy.muted;
      this.audio.onended = () => { this.stop(); this.next(); };
      this.audio.play().catch(() => {});
    }
  },
  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.bus) { const b = this.bus; try { b.gain.setTargetAtTime(0, sound.ac.currentTime, 0.08); } catch (e) {} setTimeout(() => { try { b.disconnect(); } catch (e) {} }, 500); this.bus = null; }
    if (this.audio) { this.audio.onended = null; this.audio.pause(); this.audio = null; }
  },
  next() { const was = this.playing; this.stop(); this.idx = (this.idx + 1) % this.tracks.length; if (was) this.start(); },
  schedule(def) {
    const ac = sound.ac, spb = 60 / def.bpm / 4; // one sixteenth
    while (this.nextT < ac.currentTime + 0.12) { this.play(def, this.step, this.nextT, spb); this.nextT += spb; this.step++; }
  },
  voice(type, midi, t, dur, vol, cutoff) {
    const ac = sound.ac, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.value = mtof(midi); f.type = "lowpass"; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noiseHit(t, dur, vol, type, freq) {
    const ac = sound.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = sound.noiseBuffer(); f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus);
    s.start(t, Math.random() * 0.5, dur + 0.02);
  },
  play(def, step, t, spb) {
    const ac = sound.ac, s = step % 16, ch = def.chords[Math.floor(step / 16) % 4], root = ch[0], tones = ch.slice(1).map(x => root + x);
    if (s % 4 === 0) { // kick
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.2);
    }
    if (s === 4 || s === 12) { this.noiseHit(t, 0.13, 0.32, "bandpass", 1900); this.voice("triangle", 55, t, 0.09, 0.2, 800); }
    this.noiseHit(t, 0.04, s % 2 === 0 ? (s % 4 === 2 ? 0.14 : 0.07) : 0.035, "highpass", 7500);
    if (def.bass.includes(s)) this.voice("sawtooth", root - 12, t, spb * 1.8, 0.3, 380);
    const a = ARP[s], note = a === 3 ? tones[0] + 12 : tones[a] + 12;
    this.voice("square", note, t, spb * 0.9, 0.05, 2400);
    if (s === 0) for (const n of tones) this.voice("sawtooth", n, t, spb * 15.5, 0.05, 700);
  },
};

const songDB = {
  open() {
    return new Promise((res, rej) => {
      try {
        const rq = indexedDB.open("cardodge-songs", 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      } catch (e) { rej(e); }
    });
  },
  async run(mode, fn) {
    if (FRESH) throw new Error("?fresh: a test player keeps no songs"); // (the test player neither sees nor changes your own songs)
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction("songs", mode), out = fn(tx.objectStore("songs"));
      tx.oncomplete = () => res(out && out.result);
      tx.onerror = () => rej(tx.error);
    });
  },
  all() { return this.run("readonly", s => s.getAll()); },
  add(name, blob) { return this.run("readwrite", s => s.add({ name, blob })); },
  clear() { return this.run("readwrite", s => s.clear()); },
};

