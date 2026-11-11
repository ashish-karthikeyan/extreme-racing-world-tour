// Detailed rebuilds of the landmarks a city shows off in its briefing (and on its skyline): real proportions, columns, windows, domes and roofs in
// the right colours, instead of a few plain shapes. Each builder works in its own units (written in the comment: "built 64 wide"), facing +Z,
// standing on the ground at the origin, then scales itself to the size the old, simple version had (so the city places it exactly as before).
// The small parts (columns, balusters, pinnacles, statues) are only built when `H.full()` is true: Low keeps the shapes, not the trimmings.
// The shape helpers come from landmarks.js (see the bottom of that file): box / cyl / cone / lathe stand on y, sph / tor sit at their centre.
import * as THREE from "three";

export function detailBuilders(H) {
  const { m, glow, nightGlow, box, cyl, sph, cone, tor, lathe, archWin, fbox, beam, G } = H, full = H.full;

  // one Opera House shell: a ridge rising from the back (x = -0.3 L) to the apex (Ht high, L forward along +x), and two curved faces falling from
  // it to the base edges, which run from the back point out to the two front corners (W apart, under the overhanging apex). The mouth between
  // the apex and the front corners stays open (a glass wall fills it). One surface; its material shows both faces (L < 0: facing back).
  const shellGeo = (Ht, W, L) => G("shell" + [Ht, W, L], () => {
    const S = 16, T = 9, pos = [], idx = [];
    for (const sg of [-1, 1]) {
      const base = pos.length / 3;
      for (let i = 0; i <= S; i++) {
        const s = i / S, rx = -0.3 * L + 1.3 * L * s, ry = Ht * Math.pow(s, 0.72), bx = -0.3 * L + L * s, bz = sg * (W / 2) * Math.sin(s * Math.PI / 2);
        for (let j = 0; j <= T; j++) { const t = j / T; pos.push(rx + (bx - rx) * t, ry * (1 - Math.pow(t, 1.6)), bz * Math.pow(t, 0.7)); }
      }
      for (let i = 0; i < S; i++) for (let j = 0; j < T; j++) { const a = base + i * (T + 1) + j, b = a + 1, c = a + T + 1, d = c + 1; if (sg > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  });
  const triGeo = (pts) => G("tri" + pts.flat(), () => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[1]], 3)); g.computeVertexNormals(); return g; });
  const pedGeo = (w, hh, d) => G("ped" + [w, hh, d], () => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, hh); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); });
  const add = (p, geo, mat, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o; };
  const ring = (p, n, r, y, x0, z0, f) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; f(x0 + Math.cos(a) * r, y, z0 + Math.sin(a) * r, a); } };

  return {
    opera: (h) => { // Sydney Opera House: a granite podium with its great stairs, two rows of white tiled shells (the concert hall and the theatre)
      // leaning out to the harbour, bronze glass walls filling their mouths, and the restaurant's small pair. Built 64 wide, scaled to 2.2 x h.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const TILE = m(0xf4f1e8, { roughness: 0.42, metalness: 0.0, side: THREE.DoubleSide }), RIB = m(0xe3ddd0, { roughness: 0.5 }), POD = m(0xc9a982, { roughness: 0.85 }), GL = nightGlow("operaGlass", 0x3a3026, 0xffc27a, 1.2, { roughness: 0.15, metalness: 0.6 });
      fbox(w, 64, 4.6, 34, 0, 0, 0, 0xc9a982, "stone");                                         // the podium
      for (let i = 0; i < 9; i++) box(w, 2.2, 4.6 - i * 0.5, 26, -32 - 1.1 - i * 2.2, 0, -2, POD); // the monumental stairs down to the forecourt
      const shells = (z, k, flip) => {
        const set = [[26, 20, 14, -10], [21, 17, 11, 3], [15, 13, 8, 13], [10, 9, 5.5, 20.5]];
        for (const [Ht, W, L, x] of set) {
          add(w, shellGeo(Ht * k, W * k, L * k), TILE, x * k, 4.6, z);
          add(w, triGeo([[L * k * 0.7, 0, -W * k * 0.47], [L * k * 0.7, 0, W * k * 0.47], [L * k * 0.97, Ht * k * 0.96, 0]]), GL, x * k, 4.6, z); // the glass wall in its mouth
          if (full()) box(w, 1.2 * k, 0.3, W * k * 0.9, x * k + L * k * 0.7, 4.6, z, RIB); // the step under the glass
        }
        add(w, shellGeo(12 * k, 14 * k, -8 * k), TILE, -14 * k, 4.6, z); // the back shell, facing the other way
      };
      shells(-8, 1, false); shells(9.5, 0.84, false);
      add(w, shellGeo(7, 8, 4), TILE, 25, 4.6, -12); add(w, shellGeo(5, 6, -3.2), TILE, 22, 4.6, -12); // the restaurant
      if (full()) for (let x = -28; x <= 28; x += 4) box(w, 0.4, 0.9, 0.4, x, 4.6, 16.8, POD); // the podium's railing posts
      w.scale.setScalar(h * 2.2 / 64); return g;
    },

    mosque: (h) => { // Sheikh Zayed Grand Mosque (Abu Dhabi): white marble on a raised platform, a great central dome among smaller ones, four tall
      // minarets with balconies, a colonnade of columns with gilded tops round the courtyard, reflecting pools. Built 64 wide, scaled to 2.3 x h.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const MB = m(0xf8f6f0, { roughness: 0.35 }), MB2 = m(0xe9e6dd, { roughness: 0.45 }), GD = m(0xd9b44a, { metalness: 0.85, roughness: 0.3 }), POOL = m(0x1f5a7a, { roughness: 0.05, metalness: 0.3 });
      const ARCH = nightGlow("mosqueArch", 0xcfd6dc, 0x9fc8ff, 1.3, { roughness: 0.4 });
      box(w, 64, 1.6, 48, 0, 0, 0, MB2);                                                       // the platform
      box(w, 34, 9, 22, 0, 1.6, -9, MB);                                                       // the prayer hall
      const dome = (r, x, y, z) => { cyl(w, r * 1.02, r * 1.02, r * 0.45, x, y, z, MB, 24); lathe(w, [[r, 0], [r * 1.04, r * 0.35], [r * 0.96, r * 0.75], [r * 0.7, r * 1.1], [r * 0.34, r * 1.36], [0.04, r * 1.5]], x, y + r * 0.45, z, MB, 28); cyl(w, 0.12 * r / 3, 0.06 * r / 3, r * 0.5, x, y + r * 1.95, z, GD, 6); if (full()) tor(w, r * 0.13, r * 0.03, x, y + r * 2.6, z, GD, 0, 0, Math.PI * 1.4, 12); };
      dome(8.5, 0, 10.6, -9);                                                                  // the main dome
      for (const [x, z] of [[-11, -15], [11, -15], [-11, -3], [11, -3]]) dome(4, x, 10.6, z);
      if (full()) for (const x of [-15, -7.5, 7.5, 15]) dome(2.4, x, 10.6, -18.5);
      // the courtyard colonnade: arcades on three sides with small domes over them
      for (const s of [-1, 1]) { box(w, 4, 7.5, 26, s * 29, 1.6, 9, MB); for (let z = -2; z <= 20; z += 4.4) { archWin(w, 2.6, 5.6, s * 26.9, 1.6, z, ARCH, s * Math.PI / 2); if (full()) dome(1.3, s * 29, 9.1, z); } }
      box(w, 54, 7.5, 4, 0, 1.6, 22, MB); for (let x = -22; x <= 22; x += 4.4) { archWin(w, 2.6, 5.6, x, 1.6, 24.05, ARCH); if (full()) dome(1.3, x, 9.1, 22); }
      for (let x = -14; x <= 14; x += 4) { archWin(w, 2.8, 6.4, x, 1.6, 2.05, ARCH); if (full()) { cyl(w, 0.45, 0.45, 6, x + 2, 1.6, 2.6, MB, 10); box(w, 1.1, 0.8, 1.1, x + 2, 7.4, 2.6, GD); } } // the hall's arcaded front, gilded capitals
      box(w, 50, 0.2, 3, 0, 1.62, 27.5, POOL); for (const s of [-1, 1]) box(w, 3, 0.2, 26, s * 33.5, 1.62, 9, POOL); // the reflecting pools
      for (const [x, z] of [[-30, -22], [30, -22], [-30, 22], [30, 22]]) {                      // the four minarets
        box(w, 4.2, 9, 4.2, x, 1.6, z, MB); cyl(w, 1.6, 1.35, 22, x, 10.6, z, MB, 8); tor(w, 2.0, 0.35, x, 21, z, MB2, Math.PI / 2, 0, Math.PI * 2, 16); cyl(w, 1.25, 1.05, 10, x, 32.6, z, MB, 8);
        tor(w, 1.7, 0.3, x, 37, z, MB2, Math.PI / 2, 0, Math.PI * 2, 16); cyl(w, 0.95, 0.95, 4, x, 42.6, z, MB, 8); lathe(w, [[1.05, 0], [1.0, 0.8], [0.6, 1.8], [0.05, 2.4]], x, 46.6, z, GD, 12); cyl(w, 0.06, 0.04, 1.6, x, 49, z, GD, 5);
      }
      w.scale.setScalar(h * 2.3 / 64); return g;
    },

    sagrada: (h) => { // Sagrada Família (Barcelona): a sandstone nave with Gothic windows, the Nativity facade's four perforated spires topped with
      // coloured mosaic pinnacles, the Passion facade's four behind, the tall central tower with its cross, and a construction crane. Built 50 wide.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const SS = m(0xcdb48c, { roughness: 0.9 }), SD = m(0xa58e6a, { roughness: 0.9 }), RD = m(0xd23c2c, { roughness: 0.5 }), YL = m(0xe8c23a, { roughness: 0.5 }), WT = m(0xf2efe6, { roughness: 0.5 }), CR = m(0xf0b81e, { metalness: 0.3, roughness: 0.6 });
      fbox(w, 44, 20, 22, 0, 0, -2, 0xcdb48c, "gothic");                                        // the nave
      box(w, 46, 1.4, 24, 0, 20, -2, SD); lathe(w, [[11, 0], [10, 4], [6, 9], [0.5, 12]], 0, 21.4, -2, SD, 4); // its steep roof
      const spire = (x, z, H, M, top) => {
        lathe(w, [[M * 1.35, 0], [M * 1.3, H * 0.4], [M * 1.05, H * 0.65], [M * 0.7, H * 0.83], [M * 0.35, H * 0.95], [0.1, H]], x, 0, z, top === "dark" ? SD : SS, 12);
        if (full()) for (let y = H * 0.18; y < H * 0.8; y += H * 0.07) tor(w, M * (1.32 - 0.6 * y / H), 0.12, x, y, z, SD, Math.PI / 2, 0, Math.PI * 2, 12); // the openings' rings
        if (top !== "dark") { sph(w, M * 0.45, x, H + M * 0.2, z, RD, 1, 10); if (full()) { for (let i = 0; i < 4; i++) sph(w, M * 0.2, x + Math.cos(i * 1.57) * M * 0.4, H + M * 0.45, z + Math.sin(i * 1.57) * M * 0.4, i % 2 ? YL : WT, 1, 8); cone(w, M * 0.12, M * 0.9, x, H + M * 0.5, z, YL, 6); } }
      };
      for (const [x, H] of [[-10, 38], [-3.6, 44], [3.6, 44], [10, 38]]) spire(x, 9.5, H, 2.3);           // the Nativity facade
      for (const [x, H] of [[-10, 36], [-3.6, 42], [3.6, 42], [10, 36]]) spire(x, -13.5, H, 2.2, "dark");  // the Passion facade, behind
      lathe(w, [[5.2, 0], [5, 30], [3.8, 44], [2.2, 54], [0.8, 60], [0.1, 63]], 0, 0, -3, SS, 16);        // the central tower (Jesus Christ)
      box(w, 0.5, 4.4, 0.5, 0, 62, -3, WT); box(w, 3, 0.5, 0.5, 0, 63.6, -3, WT); box(w, 0.5, 0.5, 3, 0, 63.6, -3, WT); // its cross
      archWin(w, 7, 14, 0, 0, 9.12, m(0x3b3226)); archWin(w, 4, 10, -6.8, 0, 9.12, m(0x3b3226)); archWin(w, 4, 10, 6.8, 0, 9.12, m(0x3b3226)); // the portals
      if (full()) { // a tower crane: always part of the picture here
        const cx = 17, cz = -14; for (let y = 0; y < 50; y += 2.5) { for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) box(w, 0.15, 2.5, 0.15, cx + a, y, cz + b, CR); beam(w, cx - 0.6, y, cz + 0.6, cx + 0.6, y + 2.5, cz + 0.6, 0.1, CR); }
        box(w, 30, 1, 1, cx - 9, 50, cz, CR); box(w, 2, 2, 2, cx + 3.5, 51, cz, m(0x4a4f57)); box(w, 3, 3, 3, cx + 5, 47.5, cz, m(0x7a7f87)); beam(w, cx, 54, cz, cx - 22, 50.5, cz, 0.12, CR); beam(w, cx, 54, cz, cx + 6, 50.5, cz, 0.12, CR); box(w, 0.4, 4, 0.4, cx, 50, cz, CR);
      }
      w.scale.setScalar(h * 2.0 / 50); return g;
    },

    parliament: (h) => { // the Hungarian Parliament (Budapest): a long neo-Gothic facade on the Danube in cream stone, steep red-brown roofs, rows of
      // white pinnacles, two spired towers and corner pavilions, and the great ribbed dome over the middle with its spire. Built 80 wide.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const ST = m(0xece2cb, { roughness: 0.8 }), RF = m(0x8f4a3c, { roughness: 0.75 }), RB = m(0xd8ccb4, { roughness: 0.7 }), DM = m(0x9a5442, { roughness: 0.6 });
      fbox(w, 74, 13, 16, 0, 0, 0, 0xece2cb, "gothic");                                         // the river front
      fbox(w, 30, 16, 22, 0, 0, -2, 0xece2cb, "gothic");                                        // the middle block, under the dome
      for (const s of [-1, 1]) { fbox(w, 9, 17, 18, s * 33, 0, 0, 0xece2cb, "gothic"); lathe(w, [[7, 0], [6, 3], [2.5, 8], [0.3, 11]], s * 33, 17, 0, RF, 4); } // corner pavilions with steep pyramid roofs
      for (const s of [-1, 1]) { const x0 = s * 18.5; box(w, 20, 1, 17, x0 + s * 1, 13, 0, RF); lathe(w, [[10.5, 0], [8, 2.5], [1, 5]], x0 + s * 1, 14, 0, RF, 4).scale.z = 0.8; } // the wings' roofs
      for (const s of [-1, 1]) { const tx = s * 12; fbox(w, 4.4, 26, 4.4, tx, 0, 7, 0xece2cb, "gothic"); lathe(w, [[3.3, 0], [2.6, 3], [1.0, 9], [0.1, 13]], tx, 26, 7, RF, 8); cyl(w, 0.08, 0.05, 2, tx, 39, 7, RB, 5); } // the two front towers
      cyl(w, 9.4, 9.4, 9, 0, 16, -2, ST, 16);                                                   // the dome's drum
      if (full()) ring(w, 16, 9.6, 16, 0, -2, (x, y, z, a) => { box(w, 0.9, 10, 0.9, x, y, z, RB); cone(w, 0.5, 3, x, y + 10, z, RB, 6); }); // buttresses and pinnacles round it
      lathe(w, [[9.2, 0], [9.0, 3], [7.8, 7.5], [5.6, 11], [3, 13.5], [1.4, 14.5]], 0, 25, -2, DM, 16); // the dome
      if (full()) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; beam(w, Math.cos(a) * 9.1, 25, -2 + Math.sin(a) * 9.1, Math.cos(a) * 1.6, 39.4, -2 + Math.sin(a) * 1.6, 0.35, RB); } // its white ribs
      cyl(w, 1.5, 1.2, 4, 0, 39.4, -2, ST, 12); cone(w, 1.2, 10, 0, 43.4, -2, DM, 12); cyl(w, 0.08, 0.05, 2.5, 0, 53.4, -2, RB, 5); // the lantern and spire
      if (full()) for (let x = -36; x <= 36; x += 3) { if (Math.abs(x) < 15.5 || Math.abs(Math.abs(x) - 33) < 4.6) continue; cone(w, 0.35, 3.2, x, 13, 8.1, RB, 6); } // pinnacles along the roofline
      if (full()) for (let x = -34; x <= 34; x += 2.6) archWin(w, 1.6, 4.2, x, 0.4, 8.12, m(0x3e4248)); // the arcade at the river level
      w.scale.setScalar(h * 2.6 / 80); return g;
    },

    alcala: (h) => { // Puerta de Alcalá (Madrid): a granite gate with three great arches and two square side openings, paired Ionic columns, a
      // cornice, and over the middle a raised attic with a pediment, the royal arms and statues. Built 40 wide, scaled to 1.9 x h.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const GR = m(0xb8afa0, { roughness: 0.9 }), LS = m(0xe8dfcc, { roughness: 0.8 }), DK = m(0x2b2622), SC = m(0xd8cfbd, { roughness: 0.7 });
      box(w, 38, 1, 7, 0, 0, 0, GR); box(w, 36, 12.5, 6, 0, 1, 0, LS);
      for (const x of [-7, 0, 7]) { archWin(w, 4, 9.2, x, 1, 3.03, DK); archWin(w, 4, 9.2, x, 1, -3.03, DK, Math.PI); if (full()) archWin(w, 4.8, 9.8, x, 0.9, 3.0, SC); }
      for (const s of [-1, 1]) { box(w, 3.2, 6.2, 6.4, s * 14, 1, 0, DK); if (full()) box(w, 3.9, 0.5, 6.5, s * 14, 7.2, 0, SC); }
      if (full()) for (const x of [-10.5, -3.5, 3.5, 10.5]) for (const dx of [-0.75, 0.75]) { cyl(w, 0.42, 0.38, 10.6, x + dx, 1.4, 3.4, LS, 12); box(w, 1.1, 0.5, 1.1, x + dx, 12, 3.4, SC); box(w, 1.2, 0.4, 1.2, x + dx, 1.0, 3.4, GR); } // paired columns
      box(w, 37.2, 1.3, 7.2, 0, 13.5, 0, SC); box(w, 37.8, 0.5, 7.6, 0, 14.8, 0, LS);               // entablature and cornice
      box(w, 14, 5.2, 5, 0, 15.3, 0, LS); add(w, pedGeo(15, 3.2, 5.4), LS, 0, 20.5, 0); box(w, 15.6, 0.45, 5.6, 0, 20.5, 0, SC); // the attic and its pediment
      if (full()) { box(w, 5, 3.4, 0.6, 0, 16, 2.8, SC); sph(w, 1.0, 0, 18.2, 3.0, m(0xc9a54a, { metalness: 0.6, roughness: 0.4 }), 1, 10); // the royal arms
        for (const x of [-15, -9, 9, 15]) { box(w, 1.8, 1.4, 1.8, x, 15.3, 0, LS); lathe(w, [[0.7, 0], [0.8, 1.2], [0.5, 2.6], [0.6, 3.2], [0.01, 3.6]], x, 16.7, 0, SC, 8); } // trophies and statues
        for (const x of [-5.5, 5.5]) { cyl(w, 0.5, 0.45, 2.4, x, 23.7 - Math.abs(x) * 0.42, 0, SC, 8); sph(w, 0.45, x, 26.5 - Math.abs(x) * 0.42, 0, SC, 1, 8); } }
      w.scale.setScalar(h * 1.9 / 40); return g;
    },

    capitol: (h) => { // the Texas State Capitol (Austin): a pink granite palace with two wings, a columned portico under a pediment, and the tall
      // cream dome on a colonnaded drum, its lantern and the Goddess of Liberty on top. Built 64 wide, scaled to 2.0 x h.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const PG = m(0xd29a80, { roughness: 0.85 }), PL = m(0xe8b9a2, { roughness: 0.8 }), CR = m(0xebe1cf, { roughness: 0.6 }), GD = m(0xd8b45a, { metalness: 0.7, roughness: 0.35 });
      fbox(w, 26, 15, 22, 0, 0, 0, 0xd29a80, "classic"); for (const s of [-1, 1]) fbox(w, 19, 13, 18, s * 22.5, 0, 0, 0xd29a80, "classic");
      box(w, 64.6, 0.8, 22.6, 0, 13, 0, PL); box(w, 27, 1, 23, 0, 15, 0, PL);
      for (const s of [-1, 1]) { box(w, 4, 15.5, 20, s * 31, 0, 0, PG); add(w, pedGeo(19, 2.6, 18), PL, s * 22.5, 13.8, 0).rotation.y = Math.PI / 2; } // end pavilions
      box(w, 12, 1, 4, 0, 0, 12, PL); for (let i = 0; i < 4; i++) cyl(w, 0.6, 0.55, 11, -4.5 + i * 3, 1, 13, PL, 12); box(w, 12.6, 1.4, 4.6, 0, 12, 12, PL); add(w, pedGeo(13, 3.2, 4.6), PL, 0, 13.4, 12); // the portico
      cyl(w, 8.6, 8.6, 2, 0, 16, 0, PL, 24); cyl(w, 7.6, 7.6, 8, 0, 18, 0, CR, 24);              // the drum
      if (full()) ring(w, 20, 8.1, 18, 0, 0, (x, y, z) => cyl(w, 0.32, 0.3, 7.4, x, y, z, CR, 8));  // its colonnade
      cyl(w, 7.9, 7.9, 1, 0, 26, 0, CR, 24);
      lathe(w, [[7.4, 0], [7.3, 2.5], [6.4, 6.5], [4.6, 9.8], [2.4, 12], [1.2, 12.6]], 0, 27, 0, CR, 24); // the dome
      cyl(w, 1.4, 1.2, 3, 0, 39.6, 0, CR, 12); lathe(w, [[1.4, 0], [1.1, 0.8], [0.4, 1.6], [0.05, 1.9]], 0, 42.6, 0, CR, 12); // the lantern
      cyl(w, 0.25, 0.2, 2.6, 0, 44.4, 0, GD, 6); sph(w, 0.3, 0, 47.3, 0, GD, 1, 8); if (full()) beam(w, 0, 46.5, 0, 0.5, 48.2, 0, 0.16, GD); // the Goddess of Liberty, holding up her star
      w.scale.setScalar(h * 2.0 / 64); return g;
    },

    freedomtower: (h) => { // the Freedom Tower (Miami): Mediterranean Revival in cream stucco, a three-storey wing with red tile roofs, the square
      // tower with its arched windows, an open belfry with columns and a domed cupola with a lantern. Built 30 wide and 56 tall, scaled to 2.9 x h tall.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const CR = m(0xf2e3c2, { roughness: 0.75 }), TR = m(0xdcc49a, { roughness: 0.7 }), TL = m(0xb85a3a, { roughness: 0.8 }), DK = m(0x2c2f34), GL = nightGlow("ftWin", 0x34404a, 0xffc87a, 1.1);
      fbox(w, 30, 9, 16, 0, 0, 0, 0xf2e3c2, "classic"); box(w, 31, 0.5, 17, 0, 9, 0, TR);
      for (const s of [-1, 1]) lathe(w, [[10.5, 0], [8, 1.6], [1, 3]], s * 9.5, 9.5, 0, TL, 4).scale.set(1, 1, 1.2); // red tile roofs on the wing
      fbox(w, 10, 36, 10, 0, 0, 0, 0xf2e3c2, "classic"); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(w, 1, 36, 1, x * 5, 0, z * 5, TR); // the tower and its corners
      box(w, 11, 0.8, 11, 0, 36, 0, TR); box(w, 9, 6, 9, 0, 36.8, 0, DK);                         // the belfry's shaded inside
      for (const [dx, dz, ry] of [[0, 4.6, 0], [4.6, 0, Math.PI / 2], [-4.6, 0, -Math.PI / 2], [0, -4.6, Math.PI]]) for (const k of [-2, 2]) archWin(w, 2.6, 5, dx + (dz ? k : 0), 37, dz + (dx ? k : 0), CR, ry); // the open arches (their frames)
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(w, 1.6, 6, 1.6, x * 4.4, 36.8, z * 4.4, CR);
      box(w, 10.4, 1, 10.4, 0, 42.8, 0, TR); cyl(w, 4.2, 3.8, 4, 0, 43.8, 0, CR, 8);              // the octagon
      lathe(w, [[4.0, 0], [3.9, 1], [3.2, 2.6], [1.8, 3.8], [0.6, 4.3]], 0, 47.8, 0, TL, 16); cyl(w, 0.7, 0.6, 1.6, 0, 52, 0, CR, 8); cone(w, 0.65, 1.4, 0, 53.6, 0, TL, 8); cyl(w, 0.05, 0.04, 1.4, 0, 55, 0, TR, 4); // cupola, lantern, finial
      if (full()) for (let y = 12; y < 34; y += 3.6) for (const [dx, dz, ry] of [[0, 5.05, 0], [5.05, 0, Math.PI / 2]]) archWin(w, 1.3, 2.2, dx, y, dz, GL, ry);
      w.scale.setScalar(h * 2.9 / 56); return g;
    },

    fortress: (h) => { // Hohensalzburg (Salzburg): a long white fortress crowning a steep wooded rock, its palace with red roofs, round towers with
      // red cones, curtain walls following the cliff, and the bell tower with a green onion dome. Built 70 wide, scaled to 2.3 x h.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const WH = m(0xf1ece0, { roughness: 0.85 }), WD = m(0xd9d1bf, { roughness: 0.9 }), RF = m(0x9a3f2e, { roughness: 0.8 }), CU = m(0x5f9d86, { roughness: 0.55, metalness: 0.2 });
      const ROCK = m(0x7a7464, { roughness: 1, flatShading: true }), WOOD = m(0x3f6b3a, { roughness: 1, flatShading: true });
      const rock = new THREE.Mesh(G("fortRock", () => new THREE.DodecahedronGeometry(1, 1)), ROCK); rock.scale.set(31, 22, 17); rock.position.set(0, 0, 0); w.add(rock);
      const wood = new THREE.Mesh(G("fortWood", () => new THREE.DodecahedronGeometry(1, 1)), WOOD); wood.scale.set(37, 7, 22); wood.position.set(0, -1.5, 2); w.add(wood);
      const Y = 18; // the top of the rock
      for (const [x, z, ww, dd] of [[-22, 6, 14, 1.6], [0, 9, 30, 1.6], [22, 5, 14, 1.6], [-30, -2, 1.6, 12], [30, -2, 1.6, 12]]) box(w, ww, 7, dd, x, Y - 4, z, WD); // curtain walls along the cliff
      fbox(w, 26, 12, 12, 2, Y, -1, 0xf1ece0, "classic"); lathe(w, [[18.5, 0], [12, 4], [2, 6]], 2, Y + 12, -1, RF, 4).scale.set(1, 1, 0.5); // the palace
      fbox(w, 12, 9, 9, -15, Y - 1, 1, 0xf1ece0, "classic"); lathe(w, [[8.6, 0], [5, 3], [1, 4.4]], -15, Y + 8, 1, RF, 4).scale.set(1, 1, 0.8);
      fbox(w, 9, 8, 9, 17, Y - 1, 0, 0xf1ece0, "stone"); lathe(w, [[6.6, 0], [4, 2.4], [0.8, 3.5]], 17, Y + 7, 0, RF, 4);
      for (const [x, z, r, hh] of [[-26, 3, 2.6, 13], [26, 2, 2.6, 12], [-7, 8, 2.2, 15], [9, -7, 2.4, 14]]) { cyl(w, r, r, hh, x, Y - 4, z, WH, 12); cone(w, r * 1.15, r * 1.6, x, Y - 4 + hh, z, RF, 12); } // round towers
      fbox(w, 4.4, 26, 4.4, 4, Y, 4, 0xf1ece0, "classic"); lathe(w, [[2.7, 0], [3.0, 1.2], [2.2, 2.6], [0.8, 3.6], [0.4, 4.6], [0.6, 5.4], [0.05, 7]], 4, Y + 26, 4, CU, 12); // the bell tower
      if (full()) for (let x = -26; x <= 26; x += 2.2) box(w, 1.0, 1.0, 1.7, x, Y + 3, Math.abs(x) < 15 ? 9 : 6, WD); // battlements
      w.scale.setScalar(h * 2.3 / 70); return g;
    },

    colosseum: (h) => { // the Colosseum (Rome): an oval of travertine, three storeys of arches framed by half-columns and a solid attic above with
      // its small windows; on one side the outer ring has fallen, showing the lower inner ring and the arena's tiers. Built 52 wide.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const TV = m(0xd6c09a, { roughness: 0.95 }), TV2 = m(0xc4ab84, { roughness: 0.95 }), DK = m(0x3a3128, { roughness: 1 }), SAND = m(0xc9b08a, { roughness: 1 });
      const A = 26, Bz = 21, N = 56, seg = (a) => [Math.cos(a) * A, Math.sin(a) * Bz];
      for (let i = 0; i < N; i++) {
        const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, am = (a0 + a1) / 2, [x0, z0] = seg(a0), [x1, z1] = seg(a1), [xm, zm] = seg(am), len = Math.hypot(x1 - x0, z1 - z0) + 0.05, ry = -Math.atan2(z1 - z0, x1 - x0);
        const broken = am > 1.1 && am < 2.5, top = broken ? 12.4 + 5 * Math.abs(Math.sin(am * 9)) : 25; // (the fallen side: a jagged top at the second storey)
        const wall = box(w, len, top, 2.2, xm, 0, zm, TV); wall.rotation.y = ry;
        if (!broken) { const at = box(w, len + 0.04, 0.6, 2.4, xm, 18.6, zm, TV2); at.rotation.y = ry; } // the cornice under the attic
        for (const [y, hh] of [[0.4, 5.6], [6.6, 5.2], [12.6, 5.0]]) { if (y + hh > top) continue; const o = archWin(w, len * 0.7, hh, xm + Math.cos(am) * 0.02, y, zm + Math.sin(am) * 0.02, DK); o.rotation.y = Math.PI / 2 - am; o.position.set(xm + Math.cos(am) * 1.2, y, zm + Math.sin(am) * 1.2); }
        if (full() && !broken) for (const y of [0.4, 6.6, 12.6]) { const c = cyl(w, 0.3, 0.28, 5.4, x0 + Math.cos(a0) * 1.2, y, z0 + Math.sin(a0) * 1.2, TV2, 8); }
        if (!broken && full() && i % 2 === 0) { const o = box(w, 0.9, 1.4, 0.2, xm + Math.cos(am) * 1.12, 20.6, zm + Math.sin(am) * 1.12, DK); o.rotation.y = Math.PI / 2 - am; } // attic windows
      }
      const inner = cyl(w, 20, 20, 15, 0, 0, 0, TV2, 40); inner.scale.z = 0.78;                    // the inner ring, seen where the outer one fell
      for (let k = 0; k < 4; k++) { const t = cyl(w, 18 - k * 2.6, 18 - k * 2.6, 0.9, 0, 12 - k * 3, 0, TV2, 40); t.scale.z = 0.78; } // the seating tiers stepping down
      const arena = cyl(w, 8.5, 8.5, 0.6, 0, 0, 0, SAND, 32); arena.scale.z = 0.7;
      w.scale.setScalar(h * 2.0 / 52); return g;
    },

    stpeters: (h) => { // St Peter's Basilica (Rome): a travertine facade with giant columns and statues along the top, and Michelangelo's dome on its
      // columned drum, pale grey-blue with ribs, a lantern and a cross. Built 44 wide, scaled to 2.0 x h.
      const g = new THREE.Group(), w = new THREE.Group(); g.add(w);
      const TV = m(0xe4d8c0, { roughness: 0.85 }), TV2 = m(0xd2c4a8, { roughness: 0.85 }), DM = m(0xaeb9bd, { roughness: 0.6, metalness: 0.2 }), DK = m(0x3a332b);
      fbox(w, 44, 14, 12, 0, 0, 6, 0xe4d8c0, "classic"); box(w, 45, 1.4, 13, 0, 14, 6, TV2); box(w, 30, 3.2, 10, 0, 15.4, 6, TV); // the facade and its attic
      add(w, pedGeo(16, 3.6, 3), TV, 0, 15.4, 11.6); for (let x = -15; x <= 15; x += 6) archWin(w, 2.6, 6, x, 0, 12.05, DK);
      if (full()) { for (let x = -19; x <= 19; x += 3.2) cyl(w, 0.6, 0.55, 13.6, x, 0.2, 12.4, TV, 12); for (let x = -14; x <= 14; x += 2.3) { cyl(w, 0.32, 0.28, 1.6, x, 18.6, 10.6, TV2, 6); sph(w, 0.3, x, 20.5, 10.6, TV2, 1, 6); } }
      fbox(w, 30, 14, 30, 0, 0, -12, 0xe4d8c0, "classic");                                       // the church behind
      cyl(w, 11.5, 11.5, 2, 0, 14, -12, TV2, 32); cyl(w, 10.5, 10.5, 8, 0, 16, -12, TV, 32);       // the drum
      if (full()) ring(w, 16, 10.9, 16, 0, -12, (x, y, z) => { cyl(w, 0.4, 0.38, 7.4, x, y, z, TV, 8); });
      lathe(w, [[10.3, 0], [10.1, 3], [8.9, 8], [6.5, 12], [3.4, 14.6], [1.6, 15.2]], 0, 24, -12, DM, 32); // the dome
      if (full()) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; beam(w, Math.cos(a) * 10.2, 24.2, -12 + Math.sin(a) * 10.2, Math.cos(a) * 1.7, 39, -12 + Math.sin(a) * 1.7, 0.3, TV2); }
      cyl(w, 1.8, 1.6, 4, 0, 39, -12, TV, 12); lathe(w, [[1.8, 0], [1.4, 1], [0.5, 2], [0.05, 2.6]], 0, 43, -12, DM, 12); box(w, 0.3, 2.4, 0.3, 0, 45.4, -12, m(0xd8b45a, { metalness: 0.7 })); box(w, 1.4, 0.3, 0.3, 0, 46.6, -12, m(0xd8b45a, { metalness: 0.7 })); // lantern and cross
      w.scale.setScalar(h * 2.0 / 44); return g;
    },
  };
}
