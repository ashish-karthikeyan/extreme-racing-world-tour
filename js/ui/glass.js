// ---------- real frosted glass under the canvas menus ----------
// The menus are drawn on the 2D canvas, which cannot blur what is behind it. With the 3D renderer on, the canvas is see-through, so each glass
// panel the menus draw is matched by an HTML panel placed exactly under it, between the 3D picture and the canvas. That panel uses the Garage's
// glass (css/garage.css: blur, a tint, a hairline border, the accent line), so the canvas only draws the text and pictures on top.
//   glassUI.begin(key)  at the start of each frame (key = the screen being shown: a new screen fades the old panels out)
//   glassUI.panel(x, y, w, h, r, acc, alpha, on)  one panel in canvas units; returns true if it is drawn in HTML (false: draw it on the canvas)
//   glassUI.end()       at the end of the frame: panels nobody asked for this frame fade out
// On Low the panels are flat (no blur): the cheapest look, and it holds 60 fps on a weak phone.
const glassUI = (() => {
  let root = null, key = "", n = 0, flat = null, oy = 0;
  const active = [], free = [];
  function build() {
    root = document.createElement("div"); root.id = "glassLayer"; root.setAttribute("aria-hidden", "true");
    const gl = document.getElementById("gl"); gl.parentNode.insertBefore(root, gl.nextSibling); // (above the 3D picture, under the 2D canvas)
  }
  try { build(); } catch (e) { root = null; }
  function take() {
    const el = free.pop() || Object.assign(document.createElement("div"), { _x: NaN, _y: NaN, _w: NaN, _h: NaN, _r: NaN, _a: NaN, _acc: "", _on: null });
    clearTimeout(el._timer); if (!el.parentNode) root.appendChild(el); el.style.visibility = "visible"; active.push(el); return el;
  }
  function retire(el) { el.style.opacity = "0"; el._a = 0; el._timer = setTimeout(() => { el.style.visibility = "hidden"; free.push(el); }, 240); }
  const near = (a, b) => Math.abs(a - b) < 0.3;
  return {
    get oy() { return oy; }, set oy(v) { oy = v; }, // (the menus are drawn pushed down by this much on a tall screen)
    begin(k) {
      n = 0; if (!root) return;
      const want = !!(window.R3D && R3D.quality && R3D.quality.level === "low"); if (want !== flat) { flat = want; root.classList.toggle("flat", flat); }
      if (k !== key) { key = k; while (active.length) retire(active.pop()); } // a new screen: the old panels fade out while the new ones fade in
    },
    panel(x, y, w, h, r = 14, acc = "", alpha = 1, on = false) {
      if (!root || !window.R3D) return false;
      const s = canvas.clientWidth / W, el = n < active.length ? active[n] : take(); n++;
      const px = x * s, py = (y + oy) * s, pw = w * s, ph = h * s, pr = r * s;
      if (!near(el._x, px) || !near(el._y, py)) { el._x = px; el._y = py; el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`; }
      if (!near(el._w, pw) || !near(el._h, ph)) { el._w = pw; el._h = ph; el.style.width = pw.toFixed(1) + "px"; el.style.height = ph.toFixed(1) + "px"; }
      if (!near(el._r, pr)) { el._r = pr; el.style.borderRadius = pr.toFixed(1) + "px"; }
      const a = Math.round(alpha * 100) / 100; if (a !== el._a) { el._a = a; el.style.opacity = String(a); }
      if (acc !== el._acc) { el._acc = acc; el.style.setProperty("--acc", acc || "rgba(255,255,255,0.14)"); }
      if (on !== el._on) { el._on = on; el.classList.toggle("on", on); }
      return true;
    },
    end() { if (!root) return; while (active.length > n) retire(active.pop()); },
  };
})();
