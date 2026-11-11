// ---------- the world tour: 22 cities, each with its own look ----------

const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PINE = [24, 86, 52];

// flags, drawn into a w x h box at the origin
const stripes = (cols, vertical, ratio) => (w, h) => {
  const tot = ratio ? ratio.reduce((a, b) => a + b, 0) : cols.length;
  let at = 0;
  cols.forEach((c, i) => {
    const f = (ratio ? ratio[i] : 1) / tot;
    ctx.fillStyle = c;
    if (vertical) ctx.fillRect(at * w, 0, f * w + 0.5, h); else ctx.fillRect(0, at * h, w, f * h + 0.5);
    at += f;
  });
};
const dot = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const crescent = (x, y, r, c, bg) => { dot(x, y, r, c); dot(x + r * 0.4, y, r * 0.8, bg); };
const FLAGS = {
  au: (w, h) => {
    ctx.fillStyle = "#00247d"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, h * 0.2, w * 0.5, h * 0.1); ctx.fillRect(w * 0.2, 0, w * 0.1, h * 0.5);
    ctx.fillStyle = "#cf142b"; ctx.fillRect(0, h * 0.22, w * 0.5, h * 0.06); ctx.fillRect(w * 0.22, 0, w * 0.06, h * 0.5);
    for (const [x, y] of [[0.25, 0.8], [0.72, 0.2], [0.84, 0.5], [0.72, 0.8], [0.6, 0.5]]) dot(w * x, h * y, h * 0.06, "#fff");
  },
  cn: (w, h) => { ctx.fillStyle = "#de2910"; ctx.fillRect(0, 0, w, h); dot(w * 0.22, h * 0.3, h * 0.17, "#ffde00"); },
  jp: (w, h) => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); dot(w / 2, h / 2, h * 0.3, "#bc002d"); },
  us: (w, h) => { stripes(["#b22234", "#fff", "#b22234", "#fff", "#b22234", "#fff", "#b22234"])(w, h); ctx.fillStyle = "#3c3b6e"; ctx.fillRect(0, 0, w * 0.45, h * 0.54); },
  ca: (w, h) => { stripes(["#d52b1e", "#fff", "#d52b1e"], true, [1, 2, 1])(w, h); dot(w / 2, h / 2, h * 0.2, "#d52b1e"); },
  mc: stripes(["#ce1126", "#fff"]),
  es: stripes(["#aa151b", "#f1bf00", "#aa151b"], false, [1, 2, 1]),
  at: stripes(["#ed2939", "#fff", "#ed2939"]),
  gb: (w, h) => {
    ctx.fillStyle = "#012169"; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = h * 0.2; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
    ctx.lineWidth = h * 0.08; ctx.strokeStyle = "#c8102e"; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillRect(w * 0.4, 0, w * 0.2, h); ctx.fillRect(0, h * 0.35, w, h * 0.3);
    ctx.fillStyle = "#c8102e"; ctx.fillRect(w * 0.44, 0, w * 0.12, h); ctx.fillRect(0, h * 0.4, w, h * 0.2);
  },
  be: stripes(["#111111", "#fae042", "#ed2939"], true),
  hu: stripes(["#ce2939", "#fff", "#477050"]),
  nl: stripes(["#ae1c28", "#fff", "#21468b"]),
  it: stripes(["#009246", "#fff", "#ce2b37"], true),
  az: (w, h) => { stripes(["#00b5e2", "#ef3340", "#509e2f"])(w, h); crescent(w * 0.45, h * 0.5, h * 0.15, "#fff", "#ef3340"); },
  sg: (w, h) => { stripes(["#ef3340", "#fff"])(w, h); crescent(w * 0.2, h * 0.25, h * 0.18, "#fff", "#ef3340"); },
  mx: (w, h) => { stripes(["#006847", "#fff", "#ce1126"], true)(w, h); dot(w / 2, h / 2, h * 0.12, "#8a5a2b"); },
  br: (w, h) => {
    ctx.fillStyle = "#009b3a"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fedf00"; ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.1); ctx.lineTo(w * 0.9, h * 0.5); ctx.lineTo(w * 0.5, h * 0.9); ctx.lineTo(w * 0.1, h * 0.5); ctx.closePath(); ctx.fill();
    dot(w / 2, h / 2, h * 0.23, "#002776");
  },
  qa: (w, h) => { ctx.fillStyle = "#8d1b3d"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.3, 0); for (let i = 0; i < 5; i++) { ctx.lineTo(w * 0.38, h * (i + 0.5) / 5); ctx.lineTo(w * 0.3, h * (i + 1) / 5); } ctx.lineTo(0, h); ctx.closePath(); ctx.fill(); },
  ae: (w, h) => { stripes(["#00732f", "#fff", "#000"])(w, h); ctx.fillStyle = "#ff0000"; ctx.fillRect(0, 0, w * 0.25, h); },
};
function drawFlag(key, w, h) { FLAGS[key](w, h); ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.8; ctx.strokeRect(0, 0, w, h); }

// The tour in running order. grass/alt = verge colours (sand in the desert), horizon = what sits on the skyline,
// night = how dark it is, rain/petals = weather.
const ROUTE = [
  { country: "AUSTRALIA", venue: "Sydney", flag: "au", grass: "#5fae4a", alt: "#55a043", road: "#4a4c52", sky: ["#4aa3ea", "#bfe3fa"], mount: "#8aa5b8", hill: "#6fae5c", horizon: "city", leaf: "#5e9a58", trees: ["gum", "gum", "round"], props: [], lms: ["opera", "bridge"] },
  { country: "CHINA", venue: "Shanghai", flag: "cn", grass: "#6aa85c", alt: "#5e9a52", road: "#4a4c54", sky: ["#8fa6bc", "#dde5ec"], mount: "#a7b4c0", hill: "#7aa86c", horizon: "city", leaf: "#5a9a5a", trees: ["round", "pine"], sun: 0.35, cityH: 1.3, props: [["lanternpole", 3], ["paifang", 1, 1], ["bamboo", 3]], lms: ["pearl", "shtower"] },
  { country: "JAPAN", venue: "Tokyo", flag: "jp", grass: "#5faa5a", alt: "#549d50", road: "#484a50", sky: ["#7cc0ee", "#dcefff"], mount: "#8fa6c0", hill: "#6eae6a", horizon: "fuji", leaf: "#ffb7d0", trees: ["round", "round", "pine"], petals: 0.8, props: [["torii", 2, 1], ["stonelantern", 3]], lms: ["pagoda", "ferriswheel"] },
  { country: "UNITED STATES", venue: "Miami", flag: "us", grass: "#53b36a", alt: "#49a75f", road: "#4a4a52", sky: ["#ff8fb8", "#ffd9a8"], mount: "#c7a0c0", hill: "#58b878", horizon: "city", leaf: "#3f9a55", trees: ["palm"], sun: 0.6, cityH: 1.2, tint: [255, 140, 190, 0.07], props: [["neonsign", 2], ["flamingo", 3], ["lifeguard", 1]], lms: ["artdeco", "freedomtower"] },
  { country: "CANADA", venue: "Montreal", flag: "ca", grass: "#4e9a52", alt: "#458f49", road: "#484a50", sky: ["#6fb3e8", "#d4ebfa"], mount: "#7f95a8", hill: "#5c9a5c", horizon: "city", leaf: "#d2552b", trees: ["round", "round", "pine"], props: [["mapleleaf", 2]], lms: ["biosphere", "olympictower"] },
  { country: "MONACO", venue: "Monte Carlo", flag: "mc", grass: "#a8a69e", alt: "#9c9a92", road: "#44464c", sky: ["#58b4f2", "#d2ecff"], mount: "#9aa8b4", hill: "#8fae7a", horizon: "city", leaf: "#4f9a58", trees: ["palm", "round"], cityH: 1.1, bcols: ["#e8c9a0", "#f2b6a0", "#c9d8e8", "#f4e2b8"], props: [["yacht", 4]], lms: ["casino", "palace"] },
  { country: "SPAIN", venue: "Barcelona", flag: "es", grass: "#b3b45c", alt: "#a9aa52", road: "#4a4a4e", sky: ["#58a8e8", "#c8e4f8"], mount: "#b49a84", hill: "#a8a860", horizon: "peaks", leaf: "#7a9a4a", trees: ["pine", "fruit", "round"], fruit: "#ff8a1f", props: [["mosaic", 3]], lms: ["sagrada", "torreglories"] },
  { country: "AUSTRIA", venue: "Salzburg", flag: "at", grass: "#4aa83e", alt: "#419b37", road: "#484a50", sky: ["#62b4f0", "#d6ecfb"], mount: "#7f95ac", hill: "#4f9a46", horizon: "alps", leaf: "#3f8a45", trees: ["pine", "pine", "round"], props: [["chalet", 3], ["cow", 3]], lms: ["church", "fortress"] },
  { country: "GREAT BRITAIN", venue: "London", flag: "gb", grass: "#4b9a4a", alt: "#418f43", road: "#45474c", sky: ["#8f9cab", "#cdd6de"], mount: "#8a98a4", hill: "#55945a", horizon: "hills", leaf: "#3d7a45", trees: ["round"], rain: 0.5, sun: 0, props: [["phonebox", 2], ["bus", 1], ["sheep", 3]], lms: ["bigben", "towerbridge", "londoneye"] },
  { country: "BELGIUM", venue: "Brussels", flag: "be", grass: "#3f8a45", alt: "#37803d", road: "#414349", sky: ["#7c8894", "#bcc6ce"], mount: "#6f7f86", hill: "#3b7a48", horizon: "pines", leaf: "#2f7040", trees: ["pine"], rain: 0.7, sun: 0, props: [["canalhouse", 3]], lms: ["atomium", "belfry"] },
  { country: "HUNGARY", venue: "Budapest", flag: "hu", grass: "#c0b04e", alt: "#b4a444", road: "#4a4a4e", sky: ["#5fb0ee", "#d8ecfa"], mount: "#a9a888", hill: "#b4aa58", horizon: "hills", leaf: "#6a9a40", trees: ["round"], props: [["sunflowers", 4], ["hayroll", 2]], lms: ["parliament", "chainbridge"] },
  { country: "NETHERLANDS", venue: "Amsterdam", flag: "nl", grass: "#a9b86a", alt: "#9eae60", road: "#4a4c52", sky: ["#6fb8f0", "#d9edfb"], mount: "#d8c98f", hill: "#b6c070", horizon: "dunes", leaf: "#4f8a4a", trees: ["pine", "round"], crowd: ["#ff6a00", "#fff", "#ff6a00", "#21468b"], props: [["tulips", 5], ["canalhouse", 2]], lms: ["dutchmill", "canalhouses"] },
  { country: "ITALY", venue: "Rome", flag: "it", grass: "#4d9a47", alt: "#44903f", road: "#484a50", sky: ["#66b4ec", "#d6ecfa"], mount: "#8a9fb4", hill: "#58a050", horizon: "hills", leaf: "#2f7a3f", trees: ["cypress", "cypress", "round"], crowd: ["#d4001f", "#fff", "#009246", "#d4001f"], props: [["villa", 2], ["vineyard", 3]], lms: ["colosseum", "pisa"] },
  { country: "SPAIN", venue: "Madrid", flag: "es", grass: "#b9a85c", alt: "#ae9d52", road: "#4a4a4e", sky: ["#5aa8ee", "#d4e8f8"], mount: "#a8a39a", hill: "#b6a860", horizon: "city", leaf: "#7a8a4a", trees: ["round", "fruit"], fruit: "#e8b020", cityH: 1.2, props: [["osborne", 2]], lms: ["alcala", "kiotowers"] },
  { country: "AZERBAIJAN", venue: "Baku", flag: "az", grass: "#b9a888", alt: "#ae9d7e", road: "#46484e", sky: ["#6bb2ec", "#d9ecf8"], mount: "#a6b4c0", hill: "#b8aa86", horizon: "city", leaf: "#6a8a4a", trees: ["round", "fruit"], fruit: "#c8283c", props: [["stonearch", 2]], lms: ["flame", "maiden", "heydar"] },
  { country: "SINGAPORE", venue: "Singapore", flag: "sg", grass: "#245f43", alt: "#1f563b", road: "#2a2c34", sky: ["#080c24", "#2b2f5e"], mount: "#1a1e44", hill: "#1f4a3a", horizon: "city", leaf: "#2a7a4a", trees: ["palm"], night: 0.2, cityH: 1.3, props: [["orchid", 3]], lms: ["mbs", "supertrees", "merlion", "flyer"] },
  { country: "UNITED STATES", venue: "Austin", flag: "us", grass: "#b7aa5a", alt: "#ac9f50", road: "#4a4a4e", sky: ["#5aa8ee", "#ecdcb4"], mount: "#a99a82", hill: "#b4a85c", horizon: "hills", leaf: "#7a8a42", trees: ["round", "cactus"], props: [["pumpjack", 3], ["hayroll", 1]], lms: ["capitol", "uttower"] },
  { country: "MEXICO", venue: "Mexico City", flag: "mx", grass: "#6ca24a", alt: "#619642", road: "#484a50", sky: ["#5db1ee", "#cfe6f6"], mount: "#8a7f7a", hill: "#6a9a4a", horizon: "volcano", leaf: "#4f8a3a", trees: ["cactus", "round"], props: [["agave", 3], ["papel", 3]], lms: ["angel", "pyramid"] },
  { country: "BRAZIL", venue: "Sao Paulo", flag: "br", grass: "#2f9a4a", alt: "#298f43", road: "#42444a", sky: ["#8a9cb0", "#cbd8e2"], mount: "#6f8a8a", hill: "#2f8a4a", horizon: "hills", leaf: "#1f8a3a", trees: ["palm", "round"], rain: 0.4, sun: 0.1, props: [["colorhouses", 2]], lms: ["christ", "sugarloaf", "ponte"] },
  { country: "UNITED STATES", venue: "Las Vegas", flag: "us", desert: true, grass: "#6e5640", alt: "#654e3a", road: "#2c2e36", sky: ["#14082e", "#4a1f6a"], mount: "#2a1a44", hill: "#4a3a30", horizon: "city", leaf: "#4a7a3a", trees: ["palm"], night: 0.2, cityH: 1.4, props: [["neonsign", 4]], lms: ["sphere", "luxor", "stratosphere", "eiffel", "welcome"] },
  { country: "QATAR", venue: "Doha", flag: "qa", desert: true, grass: "#8a7650", alt: "#7f6c48", road: "#2c2e36", sky: ["#060a22", "#223463"], mount: "#1a2144", hill: "#6a5a3c", horizon: "city", leaf: "#4a6a3a", trees: ["palm"], night: 0.2, props: [["camel", 2]], lms: ["lusail", "aspire"] },
  { country: "ABU DHABI", venue: "Abu Dhabi", flag: "ae", desert: true, grass: "#b89a68", alt: "#ad9060", road: "#3c3e46", sky: ["#34306e", "#ff9a5a"], mount: "#5a4a6a", hill: "#a88a5c", horizon: "city", leaf: "#5a7a3a", trees: ["palm"], night: 0.12, sun: 0.5, props: [["camel", 2]], lms: ["mosque", "themepark", "yashotel", "etihad"] },
];
ROUTE.forEach(st => {
  st.g = hx(st.grass); st.ga = hx(st.alt); st.rd = hx(st.road); st.s0 = hx(st.sky[0]); st.s1 = hx(st.sky[1]);
  st.mc = hx(st.mount); st.hc = hx(st.hill); st.lf = hx(st.leaf);
  st.night = st.night || 0; st.rain = st.rain || 0; st.petals = st.petals || 0;
  st.sunA = st.sun === undefined ? (st.night > 0.1 ? 0 : 0.8) : st.sun;
  st.tint = st.tint || [0, 0, 0, 0];
  st.crowd = st.crowd || [...new Set(Object.values({ a: "#fff", b: "#ffd23f", c: "#e10600", d: "#2b5bd7" }))];
});
ROUTE.forEach((st, i) => { st.n = i + 1; st.seed = i * 17 + 3; });
const INFO = {
  "Sydney": "Opera House - Harbour Bridge", "Shanghai": "Pearl Tower - Shanghai Tower", "Tokyo": "Pagoda - Ferris wheel - Mt Fuji",
  "Miami": "Art-deco hotel - Freedom Tower", "Montreal": "Biosphere - Olympic Tower", "Monte Carlo": "Casino - Prince's Palace",
  "Barcelona": "Sagrada Familia - Torre Glories", "Salzburg": "Village church - Fortress - Alps", "London": "Big Ben - Tower Bridge - London Eye",
  "Brussels": "Atomium - Belfry", "Budapest": "Parliament - Chain Bridge", "Amsterdam": "Windmill - Canal houses",
  "Rome": "Colosseum - Tower of Pisa", "Madrid": "Puerta de Alcala - KIO Towers", "Baku": "Flame Towers - Maiden Tower - Heydar Center",
  "Singapore": "Marina Bay Sands - Supertrees - Merlion", "Austin": "Texas Capitol - UT Tower", "Mexico City": "Angel of Independence - Pyramid",
  "Sao Paulo": "Christ the Redeemer - Sugarloaf - Cable bridge", "Las Vegas": "Sphere - Luxor - Stratosphere - Eiffel", "Doha": "Lusail Stadium - Aspire Tower",
  "Abu Dhabi": "Grand Mosque - Theme park - Etihad Towers",
};
ROUTE.forEach(st => { st.info = INFO[st.venue] || ""; });

