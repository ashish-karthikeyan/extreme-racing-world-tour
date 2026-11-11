// Pictures for the race car, all drawn in code: carbon-fibre weave, each team's livery (stripes, number, fictional sponsors),
// tyre sidewalls with lettering and wheel faces.
import * as THREE from "three";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
export const NUMBERS = [1, 4, 7, 11, 14, 16, 22, 27, 33, 44, 55]; // one race number per team
const SPONSOR_WORDS = ["APEX", "TURBO OIL", "NITRO X", "REDLINE", "G-FORCE", "PIT STOP", "VOLTA", "ORBIT", "ZENO", "KITE", "NOVA", "AURA"];

// carbon-fibre twill: a diagonal weave of dark and slightly lighter threads (one repeat = a 2x2 weave)
export function carbonTexture() {
  const [c, g] = cv(128, 128); g.fillStyle = "#16171a"; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) {
    const a = ((x + y) / 16) % 2 === 0, grd = a ? g.createLinearGradient(x, y, x + 16, y) : g.createLinearGradient(x, y, x, y + 16);
    grd.addColorStop(0, "#0c0d10"); grd.addColorStop(0.5, a ? "#3b3e46" : "#2e3037"); grd.addColorStop(1, "#0c0d10");
    g.fillStyle = grd; g.fillRect(x + 1, y + 1, 14, 14);
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 14); return t;
}

// The body seen from above, 3.2 wide x 7.6 long (nose at the top). Everything outside the central strip is the plain team colour,
// so the paint wraps over the sides without any stretching.
export function topLivery(team, index) {
  const [c, g] = cv(512, 1024), W = 512, X = x => (x + 1.6) / 3.2 * W, Z = z => (z + 3.8) / 7.6 * 1024;
  g.fillStyle = team.p; g.fillRect(0, 0, W, 1024);
  const stripe = team.s, accent = team.a, pat = index % 6;
  g.fillStyle = stripe;
  if (pat === 0) g.fillRect(X(-0.17), 0, X(0.17) - X(-0.17), 1024);                                              // one centre stripe
  else if (pat === 1) { g.fillRect(X(-0.3), 0, X(-0.12) - X(-0.3), 1024); g.fillRect(X(0.12), 0, X(0.3) - X(0.12), 1024); }  // twin stripes
  else if (pat === 2) for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(X(-0.9), Z(-2.6 + i * 0.7)); g.lineTo(X(0), Z(-2.1 + i * 0.7)); g.lineTo(X(0.9), Z(-2.6 + i * 0.7)); g.lineTo(X(0.9), Z(-2.45 + i * 0.7)); g.lineTo(X(0), Z(-1.95 + i * 0.7)); g.lineTo(X(-0.9), Z(-2.45 + i * 0.7)); g.fill(); } // chevrons
  else if (pat === 3) { for (let r = 0; r < 24; r++) for (let q = 0; q < 6; q++) if ((r + q) % 2 === 0) g.fillRect(X(-0.3) + q * (X(0.3) - X(-0.3)) / 6, Z(-0.9) + r * 14, (X(0.3) - X(-0.3)) / 6, 14); } // chequer strip
  else if (pat === 4) { g.beginPath(); g.moveTo(0, Z(-1.4)); g.lineTo(W, Z(-2.4)); g.lineTo(W, Z(-1.6)); g.lineTo(0, Z(-0.6)); g.fill(); g.beginPath(); g.moveTo(0, Z(1.1)); g.lineTo(W, Z(0.1)); g.lineTo(W, Z(0.5)); g.lineTo(0, Z(1.5)); g.fill(); } // diagonals
  else { g.fillRect(0, Z(-3.8), W, Z(-0.2) - Z(-3.8)); g.fillRect(X(-0.17), 0, X(0.17) - X(-0.17), 1024); }       // nose in the stripe colour
  g.fillStyle = accent; g.fillRect(X(-0.17) - 5, 0, 3, 1024); g.fillRect(X(0.17) + 2, 0, 3, 1024);                  // fine accent lines
  // race number: in a disc on the nose and on the airbox
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const [z, r] of [[-1.95, 0.27], [0.85, 0.26]]) { g.fillStyle = "rgba(255,255,255,0.95)"; g.beginPath(); g.arc(X(0), Z(z), r * W / 3.2 * 1.05, 0, 7); g.fill(); g.fillStyle = "#15161a"; g.font = `bold ${Math.round(r * W / 3.2 * 1.45)}px "Arial Black", Arial, sans-serif`; g.fillText(String(NUMBERS[index % NUMBERS.length]), X(0), Z(z) + 3, r * W / 3.2 * 1.7); }
  // sponsor lettering across the engine cover
  g.save(); g.translate(X(0), Z(2.2)); g.fillStyle = "rgba(255,255,255,0.9)"; g.font = "bold 26px Arial, sans-serif"; g.fillText(SPONSOR_WORDS[(index * 3) % SPONSOR_WORDS.length], 0, 0); g.restore();
  return tex(c);
}

// a decal for the side of the sidepod: team name and sponsor chips, transparent around them
export function sideDecal(team, index) {
  const [c, g] = cv(1024, 256); g.textBaseline = "middle";
  g.fillStyle = "rgba(0,0,0,0.0)"; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = team.s; g.fillRect(0, 214, 1024, 14); g.fillStyle = team.a; g.fillRect(0, 232, 1024, 6);
  g.fillStyle = "#ffffff"; g.font = "italic 900 118px 'Arial Black', Arial, sans-serif"; g.textAlign = "left";
  g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 6; g.fillText(team.name.toUpperCase(), 40, 100, 760); g.shadowBlur = 0;
  const chips = [0, 1, 2].map(i => SPONSOR_WORDS[(index * 2 + i * 5) % SPONSOR_WORDS.length]);
  g.font = "bold 40px Arial, sans-serif"; let x = 40;
  chips.forEach((name, i) => { const w = g.measureText(name).width + 34; g.fillStyle = ["rgba(0,0,0,0.55)", "rgba(255,255,255,0.88)", "rgba(0,0,0,0.55)"][i]; g.fillRect(x, 150, w, 52); g.fillStyle = i === 1 ? "#15161a" : "#ffffff"; g.fillText(name, x + 17, 177); x += w + 14; });
  g.textAlign = "right"; g.fillStyle = "#ffffff"; g.font = "italic 900 150px 'Arial Black', Arial, sans-serif"; g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 8; g.fillText(String(NUMBERS[index % NUMBERS.length]), 990, 100); g.shadowBlur = 0;
  return tex(c);
}

// tyre sidewall: black rubber with the compound colour band and brand lettering running round the edge
export function tyreSidewall(bandColor) {
  const [c, g] = cv(256, 256); g.fillStyle = "#101012"; g.fillRect(0, 0, 256, 256);
  g.translate(128, 128); g.strokeStyle = bandColor; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 78, 0, 7); g.stroke();
  g.fillStyle = "#e8e8e8"; g.font = "bold 20px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  const word = "VELOCITA  SLICK  ", n = word.length * 2;
  for (let i = 0; i < n; i++) { g.save(); g.rotate(i / n * Math.PI * 2); g.translate(0, -100); g.fillText(word[i % word.length], 0, 0); g.restore(); }
  return tex(c);
}

// the face of the wheel: dark graphite with spokes and a centre nut
export function rimFace() {
  const [c, g] = cv(256, 256); g.translate(128, 128);
  g.fillStyle = "#26282d"; g.beginPath(); g.arc(0, 0, 126, 0, 7); g.fill();
  g.strokeStyle = "#7d828b"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 118, 0, 7); g.stroke();
  for (let i = 0; i < 10; i++) { g.save(); g.rotate(i * Math.PI / 5); g.fillStyle = "#43464e"; g.fillRect(-9, -110, 18, 70); g.fillStyle = "#181a1e"; g.fillRect(-4, -108, 8, 66); g.restore(); }
  g.fillStyle = "#585c66"; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill(); g.fillStyle = "#c9ccd2"; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
  return tex(c);
}
