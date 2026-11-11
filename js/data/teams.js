// ---------- the teams: p = body, s = stripes, a = wings & accents, tag = the one-liner shown in the Garage ----------

const TEAMS = [
  { name: "Volt Racing",        tag: "Loud yellow works team. Never subtle.",          p: "#ffe11a", s: "#141416", a: "#141416", helmet: "#141416", cost: 0 },
  { name: "Nightjar",           tag: "Purple after dark. Quiet until green.",          p: "#3d1a6e", s: "#c3c7cf", a: "#c3c7cf", helmet: "#c3c7cf", cost: 0 },
  { name: "Kestrel Motorsport", tag: "Sky-blue precision with an orange sting.",       p: "#6cc4f0", s: "#ffffff", a: "#ff7a1a", helmet: "#ff7a1a", cost: 30 },
  { name: "Ironbark",           tag: "Forest green and old gold. Built to last.",      p: "#1e4a26", s: "#d6a92c", a: "#d6a92c", helmet: "#d6a92c", cost: 45 },
  { name: "Solstice",           tag: "Sunset orange on midnight blue.",                p: "#ff5a36", s: "#1a2a50", a: "#1a2a50", helmet: "#1a2a50", cost: 60 },
  { name: "Glacier",            tag: "Ice white, cold nerves, clean lines.",           p: "#f3f7fa", s: "#8ed4f5", a: "#4fb3e6", helmet: "#8ed4f5", cost: 75 },
  { name: "Ember",              tag: "Deep wine red. A slow burn, a fast finish.",     p: "#9c1430", s: "#35373d", a: "#35373d", helmet: "#ff7a3d", cost: 90 },
  { name: "Mako",               tag: "Teal and charcoal. Hunts traffic head-on.",      p: "#12898a", s: "#32363c", a: "#32363c", helmet: "#32363c", cost: 110 },
  { name: "Stratos",            tag: "Electric pink on black. Impossible to miss.",    p: "#ff2e93", s: "#141416", a: "#141416", helmet: "#141416", cost: 130 },
  { name: "Titan Works",        tag: "Raw gunmetal with lime-green attitude.",         p: "#4a4f57", s: "#a6e22e", a: "#a6e22e", helmet: "#a6e22e", cost: 150 },
  { name: "Aurora",             tag: "Violet and mint, like northern lights at speed.", p: "#8a5ae0", s: "#7ef2c6", a: "#7ef2c6", helmet: "#7ef2c6", cost: 180 },
];

// The colour a team is shown in on the Garage screen (lights, bars, buttons): its body colour if that is vivid, otherwise its most vivid
// accent; always lifted a little so a dark livery (deep purple, forest green) still glows. Returns "#rrggbb".
function teamAccent(t) {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255), chroma = c => Math.max(...c) - Math.min(...c);
  const cs = [t.p, t.s, t.a].map(rgb), score = i => chroma(cs[i]) * (i ? 1 : 1.5); // (the body colour gets a head start)
  const best = chroma(cs[0]) >= 0.25 ? 0 : [1, 2].reduce((b, i) => score(i) > score(b) ? i : b, 0);
  const [r, g, b] = cs[best], mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d > 0) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const sat = d < 0.08 ? 0 : Math.max(0.65, d / (1 - Math.abs(mx + mn - 1) || 1)), lig = Math.min(0.62, Math.max(0.52, (mx + mn) / 2));
  const f = n => { const k = (n + h * 2) % 12, a = Math.min(1, sat) * Math.min(lig, 1 - lig); return lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return "#" + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}
