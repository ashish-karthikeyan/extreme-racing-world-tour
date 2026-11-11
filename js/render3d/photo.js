// Photo mode (press P while paused, or Y on a controller): a free camera, filters, depth of field and a hidden HUD, for great screenshots.
// Keyboard: WASD fly, arrow keys look, Q/E down/up, Z/X zoom.  Controller: left stick fly, right stick look, triggers down/up, LB/RB zoom.  Mouse: drag to look, wheel to zoom.
import * as THREE from "three";

export const FILTERS = ["Normal", "Noir", "Vintage", "Vivid", "Cool"];

export function createPhoto() {
  const held = new Set(), padIn = { mx: 0, my: 0, lx: 0, ly: 0, up: 0, zoom: 0, fast: false };
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const ph = {
    active: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 55, filter: 0, hideHud: false, dof: false, aperture: 0.0012, capture: false, note: "",
    enter(fromCamera) { // start from where the race camera is looking
      const e = new THREE.Euler().setFromQuaternion(fromCamera.quaternion, "YXZ");
      ph.pos.copy(fromCamera.position); ph.yaw = e.y; ph.pitch = e.x; ph.fov = fromCamera.fov; ph.active = true; ph.hideHud = false; held.clear();
    },
    exit() { ph.active = false; ph.filter = 0; ph.dof = false; held.clear(); },
    act(a) { // one-shot actions, shared by the keyboard and the controller
      if (a === "exit") ph.exit();
      else if (a === "filter") { ph.filter = (ph.filter + 1) % FILTERS.length; ph.note = FILTERS[ph.filter]; }
      else if (a === "hide") ph.hideHud = !ph.hideHud;
      else if (a === "dof") { ph.dof = !ph.dof; ph.note = ph.dof ? "Depth of field on" : "Depth of field off"; }
      else if (a === "capture") ph.capture = true;
    },
    key(e, down) { // returns true if the key was used
      const c = e.code;
      if (!down) { held.delete(c); return false; }
      if (e.repeat && !["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyZ", "KeyX", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(c)) return true;
      if (c === "KeyP" || c === "Escape") { ph.act("exit"); return true; }
      if (c === "KeyV") { ph.act("filter"); return true; }
      if (c === "KeyH") { ph.act("hide"); return true; }
      if (c === "KeyB") { ph.act("dof"); return true; }
      if (c === "BracketLeft") { ph.aperture = Math.max(0.0002, ph.aperture * 0.7); return true; }
      if (c === "BracketRight") { ph.aperture = Math.min(0.01, ph.aperture * 1.4); return true; }
      if (c === "Enter" || c === "Space") { ph.act("capture"); return true; }
      held.add(c); return true;
    },
    pad(p) { Object.assign(padIn, p); },
    look(dx, dy) { ph.yaw -= dx * 0.004; ph.pitch = Math.max(-1.5, Math.min(1.5, ph.pitch - dy * 0.004)); },
    wheel(dy) { ph.fov = Math.max(15, Math.min(100, ph.fov + dy * 0.02)); },
    update(dt) {
      if (!ph.active) { padIn.mx = padIn.my = padIn.lx = padIn.ly = padIn.up = padIn.zoom = 0; return; }
      const fast = held.has("ShiftLeft") || held.has("ShiftRight") || padIn.fast ? 3 : 1, sp = 14 * fast * dt;
      // look: arrow keys or the right stick
      const lx = (held.has("ArrowRight") ? 1 : 0) - (held.has("ArrowLeft") ? 1 : 0) + padIn.lx, ly = (held.has("ArrowDown") ? 1 : 0) - (held.has("ArrowUp") ? 1 : 0) + padIn.ly;
      if (lx || ly) ph.look(lx * 420 * dt, ly * 300 * dt);
      fwd.set(-Math.sin(ph.yaw) * Math.cos(ph.pitch), Math.sin(ph.pitch), -Math.cos(ph.yaw) * Math.cos(ph.pitch)); right.set(Math.cos(ph.yaw), 0, -Math.sin(ph.yaw));
      const mf = (held.has("KeyW") ? 1 : 0) - (held.has("KeyS") ? 1 : 0) - padIn.my, mr = (held.has("KeyD") ? 1 : 0) - (held.has("KeyA") ? 1 : 0) + padIn.mx;
      ph.pos.addScaledVector(fwd, mf * sp).addScaledVector(right, mr * sp);
      const up = (held.has("KeyE") ? 1 : 0) - (held.has("KeyQ") ? 1 : 0) + padIn.up; ph.pos.y = Math.max(0.3, ph.pos.y + up * sp);
      const z = (held.has("KeyX") ? 1 : 0) - (held.has("KeyZ") ? 1 : 0) + padIn.zoom; ph.fov = Math.max(15, Math.min(100, ph.fov + z * 30 * dt));
    },
  };
  return ph;
}
