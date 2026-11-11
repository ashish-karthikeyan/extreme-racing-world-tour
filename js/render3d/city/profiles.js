// How each city looks: what kind of streets it has, how tall its buildings are, what the ground and water are like.
// The builder (city.js) only reads this table, so changing a city's character means editing a line here.
//
// zones   how likely each kind of neighbourhood is (they change every ~300 world units as you drive):
//           downtown (tall towers), urban (mid-rise streets), residential (houses and trees), park (trees and grass),
//           country (farms, fields), harbour (water on one side), desert (sand and sparse buildings)
// arch    the facade colours (see PALETTES)       height   how tall buildings are compared with a normal city
// water   { side: "L" | "R" | "B", color }: which side the sea / river / harbour is on
// sign    "paint" (shop signs by day) or "neon" (glowing signs)      tunnel  a tunnel every N world units (0 = none)
// hill    a hillside rising on one side, the city climbing it (Monaco)   skyline  extra height for the far towers
// hillStart  how far from the road the hillside starts rising (52 if not given)
// towers  false = no glass skyscraper models (old towns)       beach  the sea side is a sandy beach with palms, not a quay (Miami)
// span    a landmark built over the track itself (Abu Dhabi's hotel)  neonDense  extra blade signs and LED screens (Tokyo)
// trees   the 3D city's own tree list (overrides the 2D data's)       plaza   the look of the briefing's plaza round the landmark (see plaza.js)
// The signature details below show on Medium and up (the presets' cityDetail):
// roof    { cols, share, pitch }: pitched roofs in these colours on that share of the low and mid-rise buildings (Monaco's terracotta)
// hillTown { n, maxH }: the hillside built up with n small houses per stretch, none taller than maxH    marina  pontoons and moored yachts
// promenade  palms and a railing along the quay    opening { L, R, n }: the neighbourhoods lining the road for the first n x 300 units of the city
// horizon  overrides the 2D data's (peaks, alps...)    kenney  false: none of the stock Kenney buildings (they would spoil the city's own style)
// sea     the water side is open sea to the horizon (no far shore, hills or towers over there)
// lamp    "classic": Victorian lamp posts along the road instead of modern street lights (Medium and up, see kit.js)

export const PALETTES = {
  pastel:   ["#ead3ae", "#f2bfa6", "#cfdcea", "#f4e6bf", "#eadccb", "#f3cbc4"],
  brick:    ["#a65f48", "#b86e54", "#94503f", "#b09a82", "#7a5f50", "#c4a98f"],
  glass:    ["#8fb2d1", "#9dc0d8", "#7fa4c4", "#b3cfe0", "#6f93b3", "#c4d8e6"],
  concrete: ["#b2b5ba", "#9da1a7", "#c4c7cb", "#8b8f95", "#d1ccc2", "#a9aeab"],
  sand:     ["#e6cfa6", "#dcc08f", "#f1e0be", "#cdb083", "#f3e7cf", "#c4a77c"],
  white:    ["#f4f4f0", "#e8eaec", "#e0ded6", "#f8f6f1", "#d3d7dc", "#ece7da"],
  neon:     ["#4a4e62", "#565b72", "#41455a", "#626880", "#4d5168", "#6b7189"],
  colonial: ["#e6c383", "#df967a", "#abcdb2", "#ecd8a6", "#cfb0c2", "#98bad4"],
  warm:     ["#deab85", "#cc8466", "#ebcca4", "#c07a5a", "#dcbd96", "#b27456"],
};

const P = (arch, zones, extra = {}) => ({ arch, zones, height: 1, sign: "paint", water: null, tunnel: 0, hill: null, skyline: 1, towers: true, beach: false, span: null, neonDense: false, ...extra });

export const PROFILES = {
  Sydney:        P("pastel",   { urban: 0.3, downtown: 0.2, harbour: 0.35, park: 0.15 }, { roof: { cols: ["#b5552f", "#8a3a2a", "#a24a30"], share: 0.25, pitch: 0.3 }, water: { side: "R", color: "#2f86b8" } }),
  Shanghai:      P("glass",    { downtown: 0.55, urban: 0.35, park: 0.1 }, { height: 1.35, sign: "neon", water: { side: "L", color: "#6d8b7c" }, skyline: 1.4 }),
  Tokyo:         P("concrete", { downtown: 0.35, urban: 0.5, park: 0.15 }, { sign: "neon-jp", height: 1.05, neonDense: true }),
  Miami:         P("pastel",   { urban: 0.35, residential: 0.2, harbour: 0.35, downtown: 0.1 }, { sign: "neon", water: { side: "R", color: "#2fc0cf" }, beach: true, height: 0.8 }),
  Montreal:      P("brick",    { urban: 0.45, downtown: 0.25, park: 0.2, residential: 0.1 }, { roof: { cols: ["#4a6b62", "#3f4348", "#7c6a5a"], share: 0.4, pitch: 0.4 }, lamp: "classic", water: { side: "L", color: "#4a7ba2" } }),
  "Monte Carlo": P("pastel",   { urban: 0.55, harbour: 0.35, residential: 0.1 }, { lamp: "classic", water: { side: "R", color: "#2a92c8" }, tunnel: 700, hill: "L", hillStart: 125, height: 0.55, skyline: 0.45, towers: false,
    trees: ["palm", "palm", "palm", "round"], kenney: false, horizon: "peaks", sea: true, promenade: true, marina: true, opening: { L: "urban", R: "harbour", n: 3 },
    roof: { cols: ["#c4643a", "#b5552f", "#cf7a4a", "#a8502e"], share: 0.85, pitch: 0.36 }, hillTown: { n: 34, maxH: 34 },
    plaza: { paving: ["#ebe0c8", "#b8a684", "#c9a274"], pattern: "fan", lamp: "classic", lampCol: "#24302b", hedge: "#2e5b2e", frame: { floors: [4, 6], roof: "mansard", roofCol: "#5f9d86" } } }),
  Barcelona:     P("warm",     { urban: 0.5, downtown: 0.15, park: 0.1, harbour: 0.25 }, { roof: { cols: ["#c4643a", "#b5552f", "#cf7a4a", "#a8502e"], share: 0.55, pitch: 0.3 }, lamp: "classic", water: { side: "R", color: "#2f87b4" }, height: 0.85, towers: false }),
  Salzburg:      P("white",    { residential: 0.35, country: 0.35, urban: 0.3 }, { roof: { cols: ["#4a4f55", "#5f7f6e", "#7b3b2c", "#3f4448"], share: 0.85, pitch: 0.48 }, lamp: "classic", height: 0.6, towers: false }),
  London:        P("brick",    { urban: 0.45, downtown: 0.2, park: 0.2, residential: 0.15 }, { roof: { cols: ["#3b3f45", "#4a4e54", "#5e4a3e"], share: 0.55, pitch: 0.4 }, lamp: "classic", water: { side: "L", color: "#5b6b62" }, height: 0.9 }),
  Brussels:      P("brick",    { urban: 0.5, residential: 0.25, park: 0.15, downtown: 0.1 }, { roof: { cols: ["#33363b", "#3e4247", "#6b4031"], share: 0.75, pitch: 0.5 }, lamp: "classic", height: 0.85 }),
  Budapest:      P("colonial", { urban: 0.5, downtown: 0.1, harbour: 0.25, park: 0.15 }, { roof: { cols: ["#4b5056", "#6a8f7f", "#7a5a40", "#55595f"], share: 0.6, pitch: 0.42 }, lamp: "classic", water: { side: "R", color: "#4f7a96" }, height: 0.8, towers: false }),
  Amsterdam:     P("brick",    { urban: 0.45, residential: 0.25, park: 0.15, country: 0.15 }, { roof: { cols: ["#2f3236", "#3c3f44", "#5a3a2c"], share: 0.85, pitch: 0.62 }, lamp: "classic", water: { side: "L", color: "#4b7c8c" }, height: 0.65, towers: false }),
  Rome:          P("warm",     { urban: 0.5, residential: 0.2, park: 0.2, downtown: 0.1 }, { roof: { cols: ["#b85a34", "#c4643a", "#a64a2c", "#cf7a4a"], share: 0.8, pitch: 0.3 }, lamp: "classic", height: 0.75, towers: false }),
  Madrid:        P("warm",     { urban: 0.5, downtown: 0.3, park: 0.2 }, { roof: { cols: ["#b85a34", "#a8502e", "#c4703f"], share: 0.45, pitch: 0.28 }, lamp: "classic", height: 0.95 }),
  Baku:          P("sand",     { urban: 0.35, downtown: 0.3, harbour: 0.2, desert: 0.15 }, { lamp: "classic", water: { side: "R", color: "#2c7fa6" }, height: 1.1 }),
  Singapore:     P("glass",    { downtown: 0.45, urban: 0.15, harbour: 0.4 }, { sign: "neon", water: { side: "R", color: "#1b5a86" }, height: 1.3, skyline: 1.3 }),
  Austin:        P("concrete", { urban: 0.4, downtown: 0.2, country: 0.25, residential: 0.15 }, { height: 0.85 }),
  "Mexico City": P("colonial", { urban: 0.5, downtown: 0.15, residential: 0.2, country: 0.15 }, { height: 0.8, towers: false }),
  "Sao Paulo":   P("concrete", { downtown: 0.5, urban: 0.4, park: 0.1 }, { height: 1.25, skyline: 1.3 }),
  "Las Vegas":   P("neon",     { downtown: 0.5, urban: 0.2, desert: 0.3 }, { sign: "neon", height: 1.2, neonDense: true }),
  Doha:          P("sand",     { downtown: 0.35, urban: 0.2, harbour: 0.2, desert: 0.25 }, { water: { side: "L", color: "#1f6f94" }, height: 1.15, skyline: 1.2 }),
  "Abu Dhabi":   P("sand",     { downtown: 0.25, urban: 0.15, harbour: 0.3, desert: 0.3 }, { water: { side: "R", color: "#2b8aa8" }, height: 1.1, span: "yasspan" }),
};
export const profileOf = venue => PROFILES[venue] || PROFILES.Sydney;

// The 3D city's landmarks per city (the 2D game keeps its own list in js/data/cities.js). The first two also stand huge on the skyline.
// The one attraction each city shows off in its briefing (the flyover ends on it, at full detail, beside the road): every city has its own.
export const SHOWCASE = {
  Sydney: "opera", Shanghai: "pearl", Tokyo: "tokyotower", Miami: "freedomtower", Montreal: "biosphere", "Monte Carlo": "casino", Barcelona: "sagrada",
  Salzburg: "fortress", London: "bigben", Brussels: "atomium", Budapest: "parliament", Amsterdam: "dutchmill", Rome: "colosseum", Madrid: "alcala",
  Baku: "flame", Singapore: "mbs", Austin: "capitol", "Mexico City": "angel", "Sao Paulo": "ponte", "Las Vegas": "sphere", Doha: "aspire", "Abu Dhabi": "mosque",
};
export const LANDMARKS_3D = {
  Shanghai: ["pearl", "shtower", "jinmao"],
  Tokyo: ["tokyotower", "pagoda", "ferriswheel"],
  Rome: ["colosseum", "stpeters"],                                   // (St Peter's, not Pisa: Pisa is not in Rome)
  Austin: ["cotatower", "capitol", "uttower"],
  "Mexico City": ["angel", "bellasartes", "pyramid"],
  "Sao Paulo": ["banespa", "copan", "masp", "ponte"],                  // (not Rio's Christ and Sugarloaf)
  "Las Vegas": ["sphere", "stratosphere", "bellagio", "wynn", "luxor", "caesars", "eiffel", "welcome"],
  Doha: ["aspire", "dohatower", "lusail"],
  "Abu Dhabi": ["etihad", "mosque", "themepark"],                      // (and the Yas hotel over the track: see `span`)
};

// How each neighbourhood type shapes the street front (F), the city blocks (B) and the ground.
//   fh / bh   building height range (floors) in the street front / blocks      fw  frontage width range (along the road)
//   occ       how many block lots are filled (0..1)       tree  how many trees       ground  what the ground between blocks is
export const ZONES = {
  downtown:    { fh: [10, 26], bh: [14, 46], fw: [14, 26], occ: 0.88, tree: 0.15, ground: "city",  shops: 1 },
  urban:       { fh: [5, 13],  bh: [6, 22],  fw: [11, 22], occ: 0.78, tree: 0.3,  ground: "city",  shops: 1 },
  residential: { fh: [2, 4],   bh: [2, 4],   fw: [10, 16], occ: 0.6,  tree: 0.9,  ground: "grass", shops: 0, houses: 1 },
  park:        { fh: [0, 0],   bh: [3, 9],   fw: [10, 16], occ: 0.1,  tree: 1.8,  ground: "grass", shops: 0 },
  country:     { fh: [0, 0],   bh: [1, 3],   fw: [10, 16], occ: 0.06, tree: 0.7,  ground: "field", shops: 0, farm: 1 },
  harbour:     { fh: [4, 10],  bh: [5, 18],  fw: [12, 22], occ: 0.7,  tree: 0.2,  ground: "city",  shops: 1 },
  beach:       { fh: [0, 0],   bh: [0, 0],   fw: [10, 16], occ: 0,    tree: 0.6,  ground: "sand",  shops: 0 },   // (the sea side of a beach city)
  desert:      { fh: [1, 5],   bh: [2, 10],  fw: [12, 20], occ: 0.25, tree: 0.15, ground: "sand",  shops: 0 },
};

// Facade character per city (read by the building shader): [brick, stone pilasters + cornices, coloured shutters, arched windows, pastel bands,
// classic = 1 for punched windows in solid walls (old towns: no glass ribbon windows)]
export const FACADES = {
  Sydney: [0, 0.35, 0, 0.2, 0], Shanghai: [0, 0, 0, 0, 0], Tokyo: [0, 0, 0, 0, 0], Miami: [0, 0, 0, 0.2, 1, 0.6], Montreal: [0.9, 0.2, 0, 0.3, 0],
  "Monte Carlo": [0, 0.4, 1, 0.8, 0, 1], Barcelona: [0, 0.5, 0.7, 0.4, 0, 1], Salzburg: [0, 0.3, 1, 0.6, 0, 1], London: [1, 0.3, 0, 0.4, 0], Brussels: [1, 0.4, 0, 0.2, 0],
  Budapest: [0, 1, 0, 1, 0, 1], Amsterdam: [1, 0.2, 0, 0.5, 0, 1], Rome: [0, 0.5, 1, 1, 0, 1], Madrid: [0.3, 0.9, 0.4, 0.5, 0], Baku: [0, 0.7, 0, 0.8, 0],
  Singapore: [0, 0, 0, 0, 0.5], Austin: [0.6, 0, 0, 0.2, 0], "Mexico City": [0, 0.3, 0.6, 0.5, 1, 1], "Sao Paulo": [0, 0, 0, 0, 0], "Las Vegas": [0, 0, 0, 0, 0],
  Doha: [0, 0.5, 0, 1, 0], "Abu Dhabi": [0, 0.4, 0, 0.9, 0],
};

// The real wall texture each city's buildings are made of (Medium and up; see the building shader in materials.js): [kind, size of one repeat in units]
//   kind 1 painted plaster (the Mediterranean, Latin America), 2 brick (London, the Low Countries, Montreal), 3 concrete (the modern Asian and
//   American cities), 4 sandstone blocks (the Gulf, Baku, Budapest's and Madrid's stone)
export const WALLS = {
  Sydney: [1, 5], Shanghai: [3, 6], Tokyo: [3, 5], Miami: [1, 5], Montreal: [2, 3.2], "Monte Carlo": [1, 5], Barcelona: [1, 5], Salzburg: [1, 5],
  London: [2, 3.2], Brussels: [2, 3.2], Budapest: [4, 4.5], Amsterdam: [2, 3.2], Rome: [1, 5], Madrid: [4, 4.5], Baku: [4, 4.5], Singapore: [3, 6],
  Austin: [2, 3.6], "Mexico City": [1, 5], "Sao Paulo": [3, 6], "Las Vegas": [3, 6], Doha: [4, 4.5], "Abu Dhabi": [4, 4.5],
};

// Each city's colours (mostly its flag; a few use the colours the place is known for): the kerbs, the trackside barriers, the banners
// on the lamp posts and the welcome gantries over the road are all painted in them, so you can tell where you are at a glance.
export const CITY_COLORS = {
  Sydney: ["#00843d", "#ffcd00"],                       // green and gold
  Shanghai: ["#de2910", "#ffde00"],
  Tokyo: ["#bc002d", "#f4f4f2"],
  Miami: ["#13c4c4", "#ff5fa2"],                        // Miami Vice teal and pink
  Montreal: ["#d52b1e", "#f4f4f2"],
  "Monte Carlo": ["#ce1126", "#f4f4f2"],
  Barcelona: ["#a50044", "#004d98", "#edbb00"],         // claret, blue and gold
  Salzburg: ["#c8102e", "#f4f4f2", "#c8102e"],
  London: ["#c8102e", "#f4f4f2", "#012169"],
  Brussels: ["#1a1a1a", "#fdda24", "#ef3340"],
  Budapest: ["#ce2939", "#f4f4f2", "#477050"],
  Amsterdam: ["#ff7f00", "#f4f4f2"],                    // Dutch orange
  Rome: ["#009246", "#f4f4f2", "#ce2b37"],
  Madrid: ["#c60b1e", "#ffc400"],
  Baku: ["#00b5e2", "#ef3340", "#509e2f"],
  Singapore: ["#ef3340", "#f4f4f2"],
  Austin: ["#bf5700", "#f4f4f2"],                       // burnt orange
  "Mexico City": ["#006847", "#f4f4f2", "#ce1126"],
  "Sao Paulo": ["#009c3b", "#ffdf00", "#002776"],
  "Las Vegas": ["#d4af37", "#141414"],                  // casino gold and black
  Doha: ["#8a1538", "#f4f4f2"],
  "Abu Dhabi": ["#00732f", "#f4f4f2", "#141414", "#ff0000"],
};
export const cityColors = venue => CITY_COLORS[venue] || ["#c9261c", "#ededed"];
