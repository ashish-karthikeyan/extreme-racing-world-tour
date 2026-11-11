// Little roadside props that give each country its own flavour (the "props" lists in the city data). Low-poly, from simple shapes.
import * as THREE from "three";
import { glows } from "./landmarks.js";

const cache = new Map(), geo = new Map();
const m = (hex, o = {}) => { const k = hex + JSON.stringify(o); let v = cache.get(k); if (!v) cache.set(k, v = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, ...o })); return v; };
const glow = (hex, base = 1.6) => { const k = "pg" + hex; let v = cache.get(k); if (!v) { cache.set(k, v = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.2 })); glows.push({ mat: v, base }); } return v; };
const G = (k, f) => { let v = geo.get(k); if (!v) geo.set(k, v = f()); return v; };
const box = (p, w, h, d, x, y, z, mat) => { const o = new THREE.Mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; };
const cyl = (p, r0, r1, h, x, y, z, mat, seg = 10) => { const o = new THREE.Mesh(G(`c${r0},${r1},${h},${seg}`, () => new THREE.CylinderGeometry(r1, r0, h, seg)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; };
const sph = (p, r, x, y, z, mat, sy = 1) => { const o = new THREE.Mesh(G(`s${r}`, () => new THREE.SphereGeometry(r, 12, 8)), mat); o.position.set(x, y, z); o.scale.y = sy; p.add(o); return o; };
const cone = (p, r, h, x, y, z, mat, seg = 8) => { const o = new THREE.Mesh(G(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat); o.position.set(x, y + h / 2, z); p.add(o); return o; };

const RED = m(0xc8281e), WOOD = m(0x8a5a3a), WHITE = m(0xf0f0ea), DARK = m(0x2a2c31), GREEN = m(0x3f8a45), STONE = m(0xaaa59a), YEL = m(0xf2c23a);

const P = {
  lanternpole: g => { cyl(g, 0.12, 0.12, 6, 0, 0, 0, DARK); sph(g, 0.6, 0, 6.5, 0, glow(0xff3a2a, 1.6), 1.3); },
  paifang: g => { for (const x of [-3.5, 3.5]) cyl(g, 0.35, 0.35, 6, x, 0, 0, RED); box(g, 8.6, 0.8, 0.9, 0, 6, 0, RED); box(g, 9.4, 0.3, 1.3, 0, 6.8, 0, m(0xd4a62a)); cone(g, 1.2, 0.7, 0, 7.1, 0, m(0x2e6f5a), 4); },
  bamboo: g => { for (let i = 0; i < 7; i++) cyl(g, 0.12, 0.09, 6 + (i * 13 % 3), (i % 3 - 1) * 0.5, 0, (i % 2) * 0.5, m(0x7fb040), 6); },
  torii: g => { for (const x of [-2.4, 2.4]) cyl(g, 0.3, 0.26, 6, x, 0, 0, RED); box(g, 7, 0.55, 0.7, 0, 5.4, 0, RED); box(g, 5.4, 0.4, 0.5, 0, 4.2, 0, RED); },
  stonelantern: g => { box(g, 0.9, 0.5, 0.9, 0, 0, 0, STONE); cyl(g, 0.22, 0.22, 1.1, 0, 0.5, 0, STONE); box(g, 0.9, 0.7, 0.9, 0, 1.6, 0, STONE); cone(g, 0.8, 0.7, 0, 2.3, 0, STONE, 4); },
  neonsign: g => { cyl(g, 0.15, 0.15, 5, 0, 0, 0, DARK); const a = box(g, 4.5, 2, 0.3, 0, 5, 0, DARK); box(g, 4.1, 0.4, 0.4, 0, 6.2, 0, glow(0xff3ec8, 2)); box(g, 4.1, 0.4, 0.4, 0, 5.4, 0, glow(0x27e6ff, 2)); },
  flamingo: g => { cyl(g, 0.05, 0.05, 1.8, 0, 0, 0, m(0xf07a9a), 4); sph(g, 0.5, 0, 2.0, 0, m(0xf59ab4), 0.8); cyl(g, 0.05, 0.05, 1.0, 0.45, 2, 0, m(0xf07a9a), 4); },
  lifeguard: g => { box(g, 2.6, 0.2, 2.6, 0, 1.8, 0, WHITE); for (const x of [-1, 1]) for (const z of [-1, 1]) cyl(g, 0.1, 0.1, 1.8, x, 0, z, WOOD, 5); box(g, 1.8, 1.6, 1.8, 0, 2, 0, m(0xff6b4a)); cone(g, 1.8, 0.9, 0, 3.6, 0, WHITE, 4); },
  mapleleaf: g => { cyl(g, 0.14, 0.14, 4, 0, 0, 0, DARK, 6); const c = box(g, 2.6, 1.8, 0.2, 0, 3.8, 0, WHITE); box(g, 1.1, 1.1, 0.25, 0, 4.15, 0, m(0xd52b1e)).rotation.z = Math.PI / 4; },
  yacht: g => { box(g, 7, 1.2, 2.4, 0, 0.2, 0, WHITE); box(g, 3.4, 1, 1.9, -0.5, 1.4, 0, m(0xdfe6ee)); cyl(g, 0.1, 0.1, 5, 1, 2, 0, m(0x9aa0a8), 5); },
  mosaic: g => { for (let i = 0; i < 4; i++) box(g, 1.6, 0.6, 1.6, i * 1.7 - 2.5, 0, 0, m([0x3fb0d8, 0xf2c23a, 0xe0524a, 0x6bbf6a][i])); },
  chalet: g => { box(g, 4.4, 2.6, 3.6, 0, 0, 0, m(0xb88a5a)); cone(g, 3.6, 2, 0, 2.6, 0, m(0x6a4a34), 4).rotation.y = Math.PI / 4; box(g, 4.6, 0.25, 1, 0, 1.5, 1.9, WOOD); },
  cow: g => { box(g, 2.6, 1.3, 1.1, 0, 1, 0, WHITE); box(g, 0.8, 0.9, 0.9, 1.5, 1.7, 0, WHITE); box(g, 1.4, 0.7, 1.12, -0.3, 1.3, 0, DARK); for (const x of [-1, 1]) for (const z of [-0.4, 0.4]) cyl(g, 0.12, 0.12, 1, x, 0, z, DARK, 5); },
  phonebox: g => { box(g, 1.1, 2.6, 1.1, 0, 0, 0, RED); box(g, 0.9, 1.7, 0.12, 0, 0.6, 0.5, m(0xcfe6ee, { transparent: true, opacity: 0.6 })); box(g, 1.2, 0.2, 1.2, 0, 2.6, 0, RED); },
  bus: g => { box(g, 7.5, 2.8, 2.5, 0, 0.6, 0, RED); box(g, 7.5, 2.4, 2.5, 0, 3.4, 0, RED); box(g, 7.2, 0.9, 2.55, 0, 3.8, 0, m(0x1a1c20)); for (const x of [-2.4, 2.4]) { cyl(g, 0.6, 0.6, 0.5, x, 0, 1.2, DARK, 10).rotation.x = Math.PI / 2; } },
  sheep: g => { sph(g, 0.8, 0, 1, 0, m(0xf2efe8), 0.8); sph(g, 0.4, 0.8, 1.2, 0, DARK); for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) cyl(g, 0.07, 0.07, 0.6, x, 0, z, DARK, 4); },
  canalhouse: g => { box(g, 2.4, 6, 3, 0, 0, 0, m(0xb85a3a)); cone(g, 2.2, 1.6, 0, 6, 0, m(0x4a3a36), 4).rotation.y = Math.PI / 4; },
  sunflowers: g => { for (let i = 0; i < 9; i++) { const x = (i % 3 - 1) * 1.2, z = (Math.floor(i / 3) - 1) * 1.2; cyl(g, 0.06, 0.06, 2.4, x, 0, z, GREEN, 4); cyl(g, 0.5, 0.5, 0.15, x, 2.3, z, YEL, 10).rotation.x = 0.4; } },
  hayroll: g => { const c = cyl(g, 1.2, 1.2, 1.6, 0, 0, 0, m(0xd9b95a), 14); c.rotation.z = Math.PI / 2; c.position.y = 1.2; },
  tulips: g => { for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) sph(g, 0.28, i * 0.9 - 2.2, 0.5, r * 0.8 - 1.2, m([0xe0364a, 0xf2c23a, 0xff8ab0, 0xf0f0f0][r])); box(g, 5.6, 0.2, 3.4, 0, 0, 0, m(0x4f7a3a)); },
  villa: g => { box(g, 5, 3, 4, 0, 0, 0, m(0xe9cf9f)); cone(g, 4.2, 1.6, 0, 3, 0, m(0xb5532f), 4).rotation.y = Math.PI / 4; },
  vineyard: g => { for (let r = 0; r < 3; r++) { box(g, 7, 0.9, 0.5, 0, 0, r * 1.6 - 1.6, m(0x5a8a3a)); } },
  osborne: g => { box(g, 0.5, 8, 0.5, 0, 0, 0, DARK); box(g, 5, 4, 0.4, 0, 6, 0, DARK); box(g, 2, 0.9, 0.5, -1.2, 7.2, 0.1, RED); },
  stonearch: g => { for (const x of [-2.2, 2.2]) box(g, 1.2, 5, 1.4, x, 0, 0, STONE); box(g, 5.6, 1.2, 1.4, 0, 5, 0, STONE); },
  orchid: g => { cyl(g, 0.08, 0.08, 1.4, 0, 0, 0, GREEN, 4); for (let i = 0; i < 5; i++) sph(g, 0.3, Math.cos(i * 1.26) * 0.5, 1.6, Math.sin(i * 1.26) * 0.5, m(0xd96ad8), 0.6); },
  pumpjack: g => { box(g, 2, 1, 1.4, 0, 0, 0, m(0x3a5a8a)); const b = box(g, 5, 0.4, 0.5, 0, 3.2, 0, m(0x3a5a8a)); b.rotation.z = 0.12; box(g, 0.4, 3.2, 0.4, 0, 0.5, 0, DARK); box(g, 1, 1.4, 0.6, -2.2, 2.2, 0, DARK); },
  agave: g => { for (let i = 0; i < 8; i++) { const c = cone(g, 0.18, 2, Math.cos(i * 0.785) * 0.5, 0, Math.sin(i * 0.785) * 0.5, m(0x5fa08a), 4); c.rotation.set(Math.sin(i * 0.785) * 0.7, 0, -Math.cos(i * 0.785) * 0.7); } },
  papel: g => { for (let i = 0; i < 8; i++) box(g, 0.9, 0.7, 0.05, i * 1.1 - 3.8, 4.5 + Math.sin(i) * 0.3, 0, m([0xe0364a, 0xf2c23a, 0x3fb0d8, 0x6bbf6a, 0xff8ab0][i % 5])); cyl(g, 0.1, 0.1, 5, -4.4, 0, 0, WOOD, 5); cyl(g, 0.1, 0.1, 5, 4.4, 0, 0, WOOD, 5); },
  colorhouses: g => { [0xe0524a, 0xf2c23a, 0x3fb0d8, 0x6bbf6a, 0xff8ab0].forEach((c, i) => { box(g, 1.6, 2.4 + (i % 3) * 0.7, 2, i * 1.7 - 3.4, 0, 0, m(c)); }); },
  camel: g => { box(g, 2.6, 1.3, 1, 0, 1.6, 0, m(0xc9a46a)); sph(g, 0.6, 0, 3.2, 0, m(0xc9a46a), 1.1); cyl(g, 0.25, 0.2, 1.6, 1.4, 2.3, 0, m(0xc9a46a), 6).rotation.z = -0.5; sph(g, 0.4, 2.2, 3.5, 0, m(0xc9a46a)); for (const x of [-0.9, 0.9]) for (const z of [-0.3, 0.3]) cyl(g, 0.12, 0.1, 1.7, x, 0, z, m(0xb8925a), 5); },
};
export const hasProp = key => !!P[key];
export function makeProp(key) { const g = new THREE.Group(); P[key](g); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
export const PROP_KEYS = Object.keys(P);
