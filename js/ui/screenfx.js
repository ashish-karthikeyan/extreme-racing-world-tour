// ---------- screen transitions ----------
// Changing between the studio (title, menu, Garage, tyres) and a city (map, briefing, race) cannot be a camera move: it is a different scene.
// screenFx.go(fn) covers the screen with a quick light sweep (a dark veil and a bright band crossing it), runs fn (the actual screen change)
// while it is covered, then reveals the new screen: about 0.4 s in all. It is CSS animation, so it stays smooth even if the new scene's first
// frame takes a moment to build. Without the 3D renderer there is no scene change, so fn just runs.
const screenFx = (() => {
  const COVER = 150, REVEAL = 260;
  let el = null, band = null, busy = false;
  try {
    el = document.createElement("div"); el.id = "sfx"; el.setAttribute("aria-hidden", "true");
    band = document.createElement("i"); el.appendChild(band); document.getElementById("stage").appendChild(el);
  } catch (e) { el = null; }
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  return {
    get busy() { return busy; },
    // run fn behind the sweep (a second request while one is running is dropped: a double press must not do two things)
    go(fn) {
      if (busy) return;
      if (!el || !window.R3D || !el.animate) { fn(); return; }
      busy = true;
      const short = reduced() ? 0.4 : 1;
      const cover = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: COVER * short, easing: "ease-in", fill: "forwards" });
      band.animate([{ transform: "translateX(-60%) skewX(-18deg)", opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 1, offset: 0.65 }, { transform: "translateX(160%) skewX(-18deg)", opacity: 0 }], { duration: (COVER + REVEAL) * short, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
      setTimeout(() => {
        try { fn(); } catch (e) { console.error(e); }
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: REVEAL * short, easing: "ease-out" }); cover.cancel(); // (the reveal starts where the cover ended; nothing is left behind)
        setTimeout(() => { busy = false; }, REVEAL * short * 0.5); // (the next change may start once the new screen is half revealed)
      }, COVER * short);
    },
    // a quick dip of the 3D picture (the city behind the World Tour map changes at its darkest point, 0.11 s in)
    dip() { const gl = document.getElementById("gl"); if (gl && gl.animate) gl.animate([{ opacity: 1 }, { opacity: 0.2, offset: 0.35 }, { opacity: 1 }], { duration: 320, easing: "ease-in-out" }); },
    // a quick white flash (leaving the title)
    flash(ms = 380) { if (el && el.animate) el.animate([{ opacity: 0.85, background: "#fff" }, { opacity: 0, background: "#fff" }], { duration: ms, easing: "ease-out" }); },
  };
})();
