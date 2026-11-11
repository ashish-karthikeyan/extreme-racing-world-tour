// City packs: the assets that belong to one city only, each in its own folder (assets/cities/<slug>/), so the first download stays small.
// A pack is fetched in the background when the World Tour map or briefing shows the city, or when the tyre screen before any race does;
// never during a race. Only one pack is kept: asking for another city's pack drops the old one (its textures leave the graphics memory).
// If a pack isn't there yet (or a city has none), the city simply uses the shared look: nothing waits for a pack.
//
// What a pack holds so far (pack.json says): "towers", two real facade photos for the city's skyscrapers (ambientCG, CC0), side by side in
// towers.webp, their lit windows at night in towers-glow.webp, and for each facade how many units one repeat covers, how rough and metallic
// it is and how bright its windows glow.
import * as THREE from "three";

export const slugOf = venue => venue.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const HAS = new Set(["sydney", "shanghai", "tokyo", "miami", "montreal", "london", "brussels", "madrid", "baku", "singapore", "austin", "sao-paulo", "las-vegas", "doha", "abu-dhabi"]);
export const hasPack = venue => HAS.has(slugOf(venue));

const loader = new THREE.TextureLoader(), loading = new Map(); // venue -> promise of the pack (or null)
const tex = url => new Promise(res => loader.load(url, t => res(t), undefined, () => res(null)));
function load(venue) {
  const dir = `assets/cities/${slugOf(venue)}/`;
  return (async () => {
    try {
      const info = await (await fetch(dir + "pack.json")).json(), pack = { venue, info, textures: [] };
      if (info.towers) {
        const [col, glow] = await Promise.all([tex(dir + "towers.webp"), tex(dir + "towers-glow.webp")]);
        if (col && glow) {
          col.colorSpace = glow.colorSpace = THREE.SRGBColorSpace; col.anisotropy = 4; glow.wrapT = col.wrapT = THREE.RepeatWrapping;
          pack.towers = { ...info.towers, colTex: col, glowTex: glow }; pack.textures.push(col, glow);
        }
      }
      return pack;
    } catch (e) { console.warn("city pack failed:", venue, e.message || e); return null; }
  })();
}
// start fetching a city's pack (cheap to call again); resolves to the pack, or null if the city has none
export function requestPack(venue) {
  if (!hasPack(venue)) return Promise.resolve(null);
  let p = loading.get(venue); if (!p) { crazy.loadStart(); p = load(venue).finally(() => crazy.loadStop()); loading.set(venue, p); } // (CrazyGames is told while a pack downloads)
  for (const [v, q] of loading) if (v !== venue) { loading.delete(v); q.then(old => { if (old) for (const t of old.textures) t.dispose(); }); } // (only one pack is kept)
  return p;
}
