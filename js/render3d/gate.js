// A welcome gantry over the road in each city's colours: two pillars, a lit sign across the track ("WELCOME TO LONDON" on the front,
// the country and round on the back), flags on top. The city builder (city/city.js) stands one over the road soon after you arrive in a
// city and then every ~900 units, so you always know where you are. Built from a handful of meshes; one per city, then pooled.
import * as THREE from "three";

const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
const cache = new Map(); // venue -> { front, back } textures

function signTexture(lines, cols, big) {
  const c = document.createElement("canvas"); c.width = 2048; c.height = 256; const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, 256); bg.addColorStop(0, "#1b1e27"); bg.addColorStop(1, "#0b0d12"); g.fillStyle = bg; g.fillRect(0, 0, 2048, 256);
  const n = cols.length, bw = 150; // the city's colours as bands at both ends, and a thin line along the top and bottom
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i]; g.fillRect(i * bw / n, 0, bw / n + 1, 256); g.fillRect(2048 - bw + i * bw / n, 0, bw / n + 1, 256); g.fillRect(bw + i * (2048 - 2 * bw) / n, 0, (2048 - 2 * bw) / n + 1, 12); g.fillRect(bw + i * (2048 - 2 * bw) / n, 244, (2048 - 2 * bw) / n + 1, 12); }
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.shadowColor = cols[0]; g.shadowBlur = 18;
  let size = big ? 170 : 120; g.font = `italic 900 ${size}px ${FONT}`;
  const txt = lines.join("   ·   "); while (g.measureText(txt).width > 2048 - 2 * bw - 60 && size > 30) { size -= 4; g.font = `italic 900 ${size}px ${FONT}`; }
  g.fillText(txt, 1024, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function makeGate(st, cols) {
  let tx = cache.get(st.venue);
  if (!tx) { tx = { front: signTexture([`WELCOME TO ${st.venue.toUpperCase()}`], cols, true), back: signTexture([st.country, `ROUND ${st.n}`], cols, false) }; cache.set(st.venue, tx); }
  const grp = new THREE.Group(), W = 51, Y = 12.5, SH = (W - 1) / 8; // (the sign: 50 x 6.25 units, readable from far up the road)
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.45, metalness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(cols[0]), roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(cols[0]), emissiveIntensity: 0.25 });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; grp.add(o); return o; };
  for (const s of [-1, 1]) { // pillars with a coloured stripe and a footing
    box(1.7, Y + SH / 2 + 0.6, 1.7, dark, s * W / 2, (Y + SH / 2 + 0.6) / 2, 0);
    box(0.35, Y - 2, 1.75, accent, s * (W / 2 - 0.86), (Y - 2) / 2 + 1, 0);
    box(2.6, 0.9, 2.6, dark, s * W / 2, 0.45, 0);
  }
  box(W + 1.7, SH + 0.6, 1.3, dark, 0, Y, 0); // the beam
  for (const [z, map, ry] of [[0.67, tx.front, 0], [-0.67, tx.back, Math.PI]]) { // the lit signs on both faces (the front faces the cars coming up the road)
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.5 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, SH), m); p.position.set(0, Y, z); p.rotation.y = ry; grp.add(p);
  }
  box(W + 1.7, 0.3, 1.5, accent, 0, Y + SH / 2 + 0.45, 0); box(W + 1.7, 0.3, 1.5, accent, 0, Y - SH / 2 - 0.45, 0);
  const flagMats = cols.map(c => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.7, side: THREE.DoubleSide }));
  for (let i = 0; i < 7; i++) { // a row of flags along the top, in the city's colours
    const x = -W / 2 + 4 + i * (W - 8) / 6;
    box(0.12, 3.2, 0.12, dark, x, Y + SH / 2 + 0.6 + 1.6, 0);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), flagMats[i % flagMats.length]); f.position.set(x + 1.15, Y + SH / 2 + 3.5, 0); grp.add(f);
  }
  grp.userData.keep = true; // (few meshes and an emissive sign: not merged)
  return grp;
}
