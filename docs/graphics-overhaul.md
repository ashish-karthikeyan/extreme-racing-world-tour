# Graphics overhaul (overnight, 13 October 2026)

## Bug check (after the overhaul, 13 October 2026)

After the 8 graphics steps, the whole game was checked for bugs, headless (no window) and muted, on the `3D` branch. The PC shut down halfway
through the night; the check was picked up the next morning from where it stopped (nothing was half-done: the last commit was complete).
Every fix below is its own commit, pushed. Gameplay, scoring, timings, the AI and the save format were not changed.

### What was checked

| Area | What was done | Result |
|---|---|---|
| Every screen | Title, first-time question, the 10 test-drive lessons, menu, difficulty, map, briefing, tyres, race start, racing, pause, photo mode, crash, finish, Grand Final, Garage, Upgrades, Stats, Settings (every toggle, every graphics option), Controls, Songs, Credits, How to Play, Multiplayer (desktop and phone), camera choice | no errors |
| Every preset | The menu on Low, Medium, High, Ultra, Max and Auto; a race in **all 22 cities on Low, Medium, High and Max** (88 races) | no errors |
| Every briefing | All 22 city briefings on High and on Low | no errors |
| Every mode | Vs Computer (Easy to Impossible, the CPU's own self-test), the attract demo, the bypass pop-up, Next city, Retry, Daily Challenge, Multiplayer, the end of the Test Drive | no errors |
| Inputs | Keyboard, an Xbox and a PlayStation controller (simulated), touch on a 390x844 portrait phone and an 844x390 landscape phone | prompts right for each, nothing over the car or the HUD |
| Stress | 1,650 random keys and taps on the title and in a race; rotating a phone and resizing the window mid-race; switching tab and losing focus (both pause); Esc on every screen; 20 restarts in a row; 15 minutes of Endless | no errors, never stuck, never dropped to 2D |
| Saves | A fresh start, an old save, and 24 damaged save values (wrong type, negative, too big, nonsense) | the game always starts and races |
| Loading | Missing city packs, skies, models, textures or a 3D code file; no WebGL at all; going offline after the title; 4G, fast 3G and slow 3G | always ends up playable (3D, or the 2D version when 3D can't run) |
| Speed | Low on a processor slowed down 4 times (a weak laptop), in a laptop window (compared with the game from before the overhaul) and on a portrait phone | after the first second: 69 to 121 fps (before: 76 to 130), so Low still holds 60 fps |

### What was found and fixed

1. **The title's logo could sit on a close-up of the bright car** (`js/ui/hud.js`): the dark band behind the title text now reaches past the
   whole text column. *Look at:* the title screen for a minute while the camera flies round.
2. **Graphics memory crept up with every restart** (`js/render3d/car/traffic.js`): every new traffic car built its own copy of three small
   shapes (its shadow, its light pool and its brake lights). They are now made once per car size and shared. After 20 restarts the
   graphics card holds 287 shapes instead of 348 (and the number stops growing).
3. **A long Endless run kept every city's scenery in memory** (`js/render3d/city/city.js`): landmarks, gantries and props of cities you had
   already left stayed in the graphics card's memory. Pieces not used for about a minute are now freed. Over 10 minutes of Endless the
   graphics card levelled off at about 500 to 900 shapes instead of climbing past 2,500.
4. **The HUD's backing bands were rebuilt every frame** (`js/ui/hud.js`): their colour gradients are now made once per screen size, which
   gave a slow processor back the time the overhaul had taken.
5. **A hand-edited save could give negative coins** (`js/data/save.js`, the new `store.count()`): coins and "cities cleared" must now be a
   whole number from 0 up (cities cleared at most 22); anything else counts as no save, like every other damaged value. A normal save is
   untouched. *Nothing to look at* unless you edit your save by hand.
6. **The menu said "Press any key to start the music" on phones and with a controller** (`js/ui/hud.js`, where `musicNote` is set): it now
   says "Tap to start the music" on touch, and "Click or press a key to start the music" with a controller (browsers only allow sound after
   a key, a click or a tap; a controller button doesn't count). *Look at:* the bottom of the main menu before the music starts.
7. **On a slow connection the game gave up on 3D too early** (`js/render3d/assets.js`, `loadAssets`; `js/render3d/boot.js`, `stillWanted`).
   The loading screen has a watchdog: if loading makes no progress for 20 seconds, it switches to the 2D version so you are never stuck. On
   fast 3G the models kept arriving, but many of them wait for a small shared texture that is fetched last, so for over 20 seconds no model
   *finished*, and the watchdog wrongly gave up after about 50 seconds. Now every piece of data that arrives counts as progress, so on fast
   3G the 3D game loads (in about 80 seconds). And when the watchdog really does switch to 2D (slow 3G), the game no longer goes on
   downloading the 3D models and skies for nothing: 2.6 MB instead of about 12 MB. On a normal connection nothing changed.
   *Look at:* in Chrome's DevTools, Network tab, choose "Fast 3G" and reload: the bar keeps moving and the 3D title appears.
8. **The `?retry` test shortcut never reported** (`js/main.js`): it chose a tyre while the tyre screen was still sliding in, which the game
   (rightly) ignores. It now waits until the screen is showing. This was only a test tool, not a game bug.

### Looked at and left as they are

- On a portrait phone, the World Tour map's selected-city pin can glow faintly behind a card (Sydney's pin sits behind Abu Dhabi's padlock).
  The map is drawn behind the list on every screen size by design; on desktop the European pins sit behind the cards too.
- On Max, Abu Dhabi first showed 48 fps; measured properly it costs 8.7 ms a frame (the same as Monte Carlo), so it was just the first,
  heavy frames of the race.
- With the developer shortcuts that drop straight into a race (`&ff=`), the first second on a slow processor stutters a little more than
  before the overhaul (the city is built up in pieces). Starting a race the normal way, all of it happens behind the camera sweep and the
  start lights: once you're racing there was one slightly slow frame in the first six seconds.
- If `js/audio/music.js` or another core file is missing, the game errors: that only happens with a broken copy of the game, not to players.
- The test logs and screenshots are in `.screenshots/bugcheck*` (not in git).

## Summary (read this first)

**What got done** (all 8 graphics steps, each committed and pushed on the `3D` branch):
1. Light: three new real skies (clear Mediterranean noon, golden afternoon, blue-hour dusk), a haze that thins with height and glows towards
   the sun, a colour grade per city with separate tints for shadows and highlights, damp neon streets at night, wet-road reflections on High.
2. Streets: real CC0 concrete barriers in each city's colours, Victorian lamp posts in 11 old cities, bins, hydrants, benches, utility boxes,
   fictional road signs, steel chain-link catch fencing, leafy trees.
3. Cities: real plaster / brick / concrete / stone wall textures with window frames; city packs with real facade photos for the skyscrapers
   of 15 modern cities (lit windows at night); harbour water that mirrors the city on High; proper yachts and palms; Japanese shop signs in
   Tokyo; black cabs and red buses in London; each European city's own roof colours. A 22-city identity list is below.
4. Landmarks: 10 rebuilt in detail (Opera House, Grand Mosque, Sagrada Familia, Parliament, Puerta de Alcala, Texas Capitol, Freedom Tower,
   Hohensalzburg, Colosseum, St Peter's); briefings never blocked by a building any more.
5. Cars: metallic flakes in all paint, real traffic brake lights.
6. Screens: a dotted world map with the tour route and pins; the studio reflects a real photographed studio; the title's towers are real.
7. Effects: billowing smoke, white-hot sparks, licking nitro flames, speed lines, a smooth camera shake, HUD backing bands.
8. Final check: every preset, every mode, no errors; sizes and timings in the Step 8 section.

**What is left** (ideas for later, nothing is broken): the other 12 landmarks are still the simpler versions (they read well, but could get
the same detail); city packs could hold more per-city things (each has only its tower facades so far); in Endless, cities reached after the
first don't get their pack (by design: nothing loads mid-race); Low keeps the old simple street furniture and buildings on purpose.

**Look at first:** Monte Carlo on High (`index.html?dev=tour,5,1&ff=600&god&gfx=high`), Las Vegas at night (`tour,19`), the World Tour map,
and the Sydney and Abu Dhabi briefings (`?dev=brief,0` and `?dev=brief,21`, wait a few seconds).

This file explains, step by step, what changed in the look of Extreme Racer, why, which files were touched, and what to look at in the game.
Gameplay, controls, scoring, saves (the `cardodge.` prefix), prices and the test drive's lessons were not changed.

## Decisions I made on my own (so you know why things are the way they are)

- **Textures are WebP, models are glTF with meshopt compression.** KTX2 needs an extra decoder (a WebAssembly file, about 0.5 MB) and a tool that is not
  installed here; WebP needs nothing extra, three.js r170 reads it inside glTF files by itself (`EXT_texture_webp`), and it is 3 to 5 times smaller than PNG.
  The meshopt decoder is the one that ships with three.js r170 itself, copied into `lib/three/addons/libs/` (same version, nothing upgraded, no CDN).
- **The asset tools run outside the game.** I used glTF-Transform and sharp from a scratch folder to shrink every downloaded asset. Nothing was added to
  the game folder except the finished, compressed files.
- **Tone mapping stays ACES Filmic.** Everything in the game (the fog colours, the night lights, the bloom) is tuned for it; switching would have meant
  re-tuning all 22 cities. Instead each city got a richer colour grade (see Step 1).

## Step 1: lighting and post-processing (everywhere)

**What you should look at:** drive Monte Carlo (`?dev=tour,5,1&ff=600&god`), Tokyo (`tour,2`), Las Vegas (`tour,19`) and Abu Dhabi (`tour,21`) on High.
Look at the far end of the road (it now melts into a light haze, and glows warm when you drive towards the sun), at the colours (each city has its
own grade), and at Las Vegas's road (the neon now shines in the damp street).

What changed:

1. **Three new skies** from Poly Haven (CC0, 1K): `clear` (a deep-blue Mediterranean noon), `golden` (late afternoon, long warm light) and `dusk`
   (blue hour). Each city now has a sky that suits it (`CITY_TOD` in `js/render3d/env.js`):
   Monte Carlo and Madrid are clear and blue, Barcelona, Rome and Mexico City golden, Tokyo and Abu Dhabi at dusk (Abu Dhabi's real race is a twilight race).
   At dusk the city's windows, street lamps and headlights are already on (`lights` in `LOOK`, used by `world.js` and `renderer.js`).
   The briefing's golden-hour light now uses the real late-afternoon sky instead of the midday one turned round.
2. **Haze** (`js/render3d/haze.js`, new). three.js's fog fades everything to one flat colour by distance. The new fog behaves like real air:
   it builds up gradually, it is thickest near the ground (so the tops of tall towers and hills stay crisp against the sky), and when you look
   towards the sun it glows in the sun's colour. It works by replacing three.js's four small "fog" pieces of shader code before anything is compiled,
   so every material in the game gets it, on every preset, for the cost of a few sums per pixel.
3. **A colour grade per city with split toning** (`GRADE` in `js/render3d/renderer.js`, the shader in `js/render3d/post.js`). Besides saturation,
   contrast and an overall tint, each city now tints its shadows and its highlights separately: warm sunlight and teal shade on the Riviera,
   cool and grey in London, magenta shadows in Las Vegas, blue shade and amber lights in Abu Dhabi's twilight.
4. **Wet and damp roads reflect.** Real planar reflections of the city on a wet road were Ultra-only; they are now on High too (`reflect` in
   `js/render3d/quality.js`). At night (and at dusk), on Medium and up, the street is a little damp, so lamps, neon and tail lights shine in it
   (`roadWet` in `renderer.js`; only the picture changes, the car's grip still comes from the simulation's own `wet`).
5. **Sharper edges on High:** SMAA anti-aliasing is now on High as well as Ultra and Max (on top of High's 4x multisampling).

Cost (RTX 5070 Ti, headless, 1280x720, Monte Carlo / Las Vegas): Low unchanged at about 2 ms of graphics work per frame; High about 0.9 ms more
(the reflections). Low gets the haze only; everything else in this step is Medium and up.

Files: `js/render3d/haze.js` (new), `js/render3d/env.js`, `js/render3d/world.js`, `js/render3d/renderer.js`, `js/render3d/post.js`,
`js/render3d/quality.js`, `assets/hdri/clear.hdr`, `golden.hdr`, `dusk.hdr`, `CREDITS.md`.

## Step 2: the road and the streets

**What you should look at:** London (`?dev=tour,8,1&ff=500&god`) and Sydney (`tour,0`) on High. The trackside walls are now real concrete
barriers painted in the city's colours, the old cities have Victorian lamp posts, the catch fencing is fine steel chain-link instead of a white
criss-cross, the pavements have bins, fire hydrants, benches, utility boxes and road signs, and the trees have leafy clumps instead of flat blobs.

What changed:

1. **Real CC0 street furniture from Poly Haven** (`assets/models/street/`, about 1 MB in all): a concrete road barrier, a Victorian lamp post, a
   street bin, a fire hydrant, a park bench and a utility box. Each was cut down to one variant, simplified to a few hundred triangles (their
   normal maps keep the detail), given WebP textures and meshopt compression (`EXT_meshopt_compression`, decoded by the decoder that ships with
   three.js r170, now in `lib/three/addons/libs/meshopt_decoder.module.js`; `assets.js` hands it to the model loader).
2. **`js/render3d/city/kit.js` (new)** turns each model into instanced pieces: `kitModel()` converts the compressed numbers back to plain ones,
   merges the parts into one shape per material and sizes it in game units (`M2U`: 1.85 world units per real metre); a `KitMesh` stamps out a
   whole model in one draw call per material, exactly like the city's other instanced rows.
3. **The street front (`buildF` in `js/render3d/city/city.js`)**, on Medium and up: concrete barriers instead of plain boxes (still in the city's
   colours), Victorian lamps in the 11 old cities (`lamp: "classic"` in `profiles.js`; their night glow sits at the lantern, see `night.js`),
   and on the pavements a bin by a lamp post, hydrants at the kerb, benches facing the road, utility boxes against the walls and fictional road
   signs on posts (direction, speed limit, no stopping, tourist, warning, parking: `makeRoadSignAtlas()` in `city/materials.js`). Low keeps the
   simple boxes, so it stays as light as before.
4. **Catch fencing** (`fenceTexture()` in `city/geo.js`): fine galvanised chain-link with posts and rails, lit like metal; with multisampling its
   thin wires are smoothed (alpha to coverage) instead of flickering.
5. **Foliage detail** (`js/render3d/scenery.js`): a 3D noise in each tree's own coordinates breaks every leaf blob into darker and lighter
   clumps, each turned a little to the light, and darkens the inside of the crown (Medium and up; Low skips it).

Cost: about 0.5 ms more per frame on Medium and High; Low unchanged.

## Step 3: city identity

### What makes each city recognisable (the list)

For every city, the 4 to 6 things a person recognises at a glance, and **how the game shows them** in the first 10 seconds of a race
(the welcome gantry, the opening neighbourhoods, the skyline landmarks and the street front are all placed so they are on screen early).

| # | City | What you instantly recognise | How it shows in the game |
|---|------|------------------------------|--------------------------|
| 0 | Sydney | Opera House sails, Harbour Bridge arch, deep-blue harbour with ferries, sandstone and pastel terraces, gum trees, bright morning light | harbour on the right, Opera House and Bridge on the skyline, plaster walls, green-and-gold barriers, gum trees, morning sky |
| 1 | Shanghai | Oriental Pearl Tower (pink spheres), Shanghai Tower's twist, glass-and-steel skyline in haze, the Bund's river, red lanterns, paifang gates | glass towers (concrete walls), Pearl Tower and Shanghai Tower on the skyline, river on the left, lantern poles, a hazy midday |
| 2 | Tokyo | Tokyo Tower (red-and-white lattice), dense neon and blade signs, Mount Fuji, cherry blossom, torii gates and stone lanterns, dusk light | blade signs stacked up every frontage, pink blossom petals, Fuji on the horizon, Tokyo Tower, dusk sky with lights already on |
| 3 | Miami | Art Deco pastel hotels with neon trim, palm-lined ocean drive, turquoise sea and sand, lifeguard towers, pink sunset | beach and sea on the right, palms, lifeguard towers, pastel plaster walls with colour bands, neon, the sunset sky |
| 4 | Montreal | Biosphère dome, Olympic tower, red-brick terraces with iron stairs, maple trees in autumn red, the St Lawrence | brick walls, red autumn leaves, river on the left, Victorian lamps, the Biosphère and the leaning Olympic tower |
| 5 | Monte Carlo | the Casino (cream Beaux-Arts facade, corner towers, green copper roofs, palm garden and fountain), a harbour full of white yachts, a steep hillside of cream/peach/pink apartments with terracotta roofs, palms, red-and-white kerbs, mountains, bright blue sea | the harbour and marina on the right from the very first metre, the hill town on the left, terracotta roofs, palms, Victorian lamps, red-and-white barriers, peaks on the horizon, a clear deep-blue noon |
| 6 | Barcelona | Sagrada Família spires, Torre Glòries, Eixample blocks with chamfered corners in warm stone, palms and orange trees, the sea | warm plaster walls, golden late-afternoon light, palms and fruit trees, the sea on the right, Sagrada Família on the skyline, claret-and-blue barriers |
| 7 | Salzburg | the fortress on its hill, baroque church domes, white and pastel old town, the Alps, green meadows, chalets | Alps on the horizon, white plaster houses with shutters, pine trees, chalets and cows in the countryside, the fortress and church |
| 8 | London | Big Ben, Tower Bridge, the London Eye, red buses and phone boxes, brick terraces, grey drizzle, the Thames | rain, brick walls with white window frames, the Thames on the left, Big Ben/Eye on the skyline, Victorian lamps, red phone boxes and buses, red-white-and-blue barriers |
| 9 | Brussels | the Atomium, the belfry and Grand-Place gables, brick, drizzle | rain, brick walls, the Atomium and belfry, black-yellow-red barriers |
| 10 | Budapest | Parliament on the Danube, Chain Bridge, ornate stone facades, golden morning light | stone walls, the river on the right, Parliament and Chain Bridge, Victorian lamps |
| 11 | Amsterdam | narrow brick canal houses with gables, canals, windmills, bicycles, tulip fields | brick walls, canal on the left, windmills and tulips in the countryside, orange barriers |
| 12 | Rome | the Colosseum, ochre and terracotta plaster, umbrella pines and cypresses, golden light on stone | warm plaster walls, cypresses, the Colosseum, golden late-afternoon sky, Italian-flag barriers |
| 13 | Madrid | Puerta de Alcalá, the leaning KIO towers, stone and ochre facades, dry hot light | stone walls, clear hard light, the gate and the KIO towers |
| 14 | Baku | the Flame Towers, the Maiden Tower and old walls, sandstone, the Caspian promenade | sandstone walls, the sea on the right, the Flame Towers on the skyline, sunset |
| 15 | Singapore | Marina Bay Sands, Supertrees, the Merlion, the Flyer, glittering night skyline over the bay | night, the bay on the right, Marina Bay Sands and the Supertrees, damp streets reflecting the lights |
| 16 | Austin | the Capitol dome, UT tower, Texan brick and limestone, live oaks, big sky | brick walls, the Capitol, burnt-orange barriers, clear midday |
| 17 | Mexico City | the Angel of Independence, the pyramids, colourful colonial houses, papel picado, agave, volcanoes | colourful plaster, papel picado and agave, the volcano on the horizon, the Angel, golden light |
| 18 | Sao Paulo | Octávio Frias cable bridge, dense concrete towers, humid grey sky, tropical greenery | rain, concrete towers, the cable bridge, palms, green-yellow-blue barriers |
| 19 | Las Vegas | the Sphere, the Strip's casino resorts (pyramid, Eiffel tower, Stratosphere), neon everywhere, the desert at night, the welcome sign | night, neon on every frontage, the Sphere's LED show, the Luxor pyramid and Stratosphere, damp neon reflections, gold-and-black barriers |
| 20 | Doha | Lusail and Aspire towers, a lit-up skyline on the Corniche, the desert, palms | night, sandstone walls, palms, the sea on the left, Aspire's torch tower |
| 21 | Abu Dhabi | the Yas hotel's lit grid over the track, the Grand Mosque's white domes, desert, twilight race | dusk with the city lit, the hotel's grid over the road, the mosque, palms, sandstone |

### Real wall textures for every building (Medium and up)

**Look at:** any city on High, the buildings beside the road. Their walls now have real plaster, brick, concrete or sandstone surfaces with
relief, white (old towns) or dark aluminium (modern) window frames with mullions, and grime washed down under the window sills.

- Four ambientCG materials (CC0: Plaster003, Bricks101, Concrete034, Bricks084) were shrunk into two small atlases:
  `assets/textures/walls-detail.webp` (light and dark patches) and `walls-normal.webp` (relief), 450 KB together.
- The building shader (`FACADE` and `buildingMaterial()` in `js/render3d/city/materials.js`) reads them along each wall in world units, so a
  brick is always brick-sized. Which material each city uses is the `WALLS` table in `js/render3d/city/profiles.js`.

### City packs and real skyscrapers

**Look at:** Singapore or Las Vegas at night (`tour,15` / `tour,19`): the towers are real office facades with their own lit windows. By day,
Sydney, Tokyo, London's City, Miami and Shanghai have glass curtain walls that mirror the sky.

- **City packs** (`js/render3d/citypack.js`, new): each city's own files live in `assets/cities/<city>/`. A pack downloads in the background
  when the World Tour map or briefing shows the city, or while you pick tyres before any race (`openTyres` in `js/ui/menus.js`), and is only
  put to use once no race is running (`applyPack` in `renderer.js`). Only one pack is kept; asking for another one drops the old one's
  textures. A city without its pack (or Endless reaching a new city mid-run) simply uses the shared look, so nothing ever waits or pops in.
- The first content of the 15 modern cities' packs: two real facade photos each (ambientCG Facade001/005/006/009/017/018A, CC0) and their
  night-time lit windows, about 50 to 300 KB per city (`towers.webp`, `towers-glow.webp`, `pack.json`).
- **Towers** (`towerMaterial()` in `city/materials.js`): skyscrapers (14 floors and up) in a city whose pack has arrived are clad in those
  photos, repeated in world units (a taller tower simply has more floors), smooth and metallic so the glass mirrors the sky, glowing at night.
  The city builder puts them in their own instanced rows (`K.towers`, `towersB`, `towersS` in `city/city.js`).

### The harbour cities: water, yachts and palms (Monte Carlo first, and every city by the sea)

**Look at:** Monte Carlo (`tour,5`) on High: the harbour's water has two layers of ripples, lighter turquoise shallows along the quay that deepen
to the city's own sea colour, and on High and up it mirrors the yachts, the quay and the city (at night: the lights). The yachts are real
yacht shapes now, and the palms curve, with ringed trunks, drooping fronds and coconuts.

- **Water** (`mats.water` in `city/materials.js`): a second, larger ripple layer drifting the other way, and shallows near the quay.
- **Harbour reflections** (`js/render3d/reflect.js`): the reflection picture that wet roads use is now also mirrored, fully, by the water
  (bent by its ripples) in any city by the sea or a river, on High and up. When nothing is reflected in a frame, nothing stale can show (`idle()`).
- **Yachts** (`yachtGeo()` in `city/geo.js`): a smooth hull lofted through nine stations, flaring to a fine raked bow, a dark waterline stripe,
  a teak deck, three decks stepping back with raked windscreens and tinted glass bands, a radar arch. All harbour cities use them.
- **Palms** (`palmGeos()` in `city/geo.js`, Medium and up): a gently curving, ringed trunk, eight drooping fronds of leaflets, coconuts. Used
  by Monte Carlo, Miami, Barcelona, Singapore, Las Vegas, Doha, Abu Dhabi and Sao Paulo (`addTree` in `city/city.js` picks them).

### Tokyo, London and friends: small things you recognise

- **Tokyo's shop signs are in Japanese** (fictional names: ramen, sushi, karaoke, a hotel, a pharmacy...; `JP` and `makeSignAtlas("neon-jp")` in
  `city/materials.js`). They use whatever Japanese font the computer has; every common system has one.
- **City traffic colours** (picture only, the simulation's traffic is untouched; `CITY_TRAFFIC` in `renderer.js`): London's taxis are black
  cabs and its buses red, Tokyo's taxis deep indigo, Singapore's blue, Mexico City's pink; Budapest's and Amsterdam's buses blue.
- **Roofs per city** (`roof` in `city/profiles.js`, Medium and up): pitched roofs in each city's own colours on its low and mid-rise buildings:
  terracotta in Barcelona, Rome and Madrid (and some in Sydney), dark slate in London, Brussels and Amsterdam (steep, like canal-house
  gables), slate, copper green and red in Salzburg and Budapest, copper and slate in Montreal.

## Step 4: landmarks and the briefing flyover

**What you should look at:** the World Tour map, then the briefings of Sydney, Barcelona, Salzburg, Budapest, Rome, Madrid, Austin, Miami and
Abu Dhabi (`?dev=brief,N`, wait a few seconds). Each ends on its landmark in its plaza (gardens, a fountain, trees, lamp posts, people,
parked cars) at golden hour, filmed from drone height.

- **Ten landmarks rebuilt with real detail** (`js/render3d/landmarks-detail.js`, new; `landmarks.js` hands it its shape helpers and lets the
  new versions replace the old ones of the same name):
  Sydney Opera House (a granite podium with its great stairs, two rows of white shells lofted as real curved surfaces with bronze glass in their
  mouths, the restaurant's pair), Sheikh Zayed Grand Mosque (Abu Dhabi: white marble, a great dome among 8 smaller ones, 4 minarets with
  balconies and gilded tops, arcades with small domes, reflecting pools), Sagrada Família (8 spires with mosaic pinnacles, the central tower and
  its cross, Gothic portals, a tower crane), the Hungarian Parliament (a long neo-Gothic river front, red-brown roofs, rows of pinnacles, the
  ribbed dome and spire), Puerta de Alcalá (three arches, two side gates, paired Ionic columns, the attic, arms and statues), the Texas Capitol
  (pink granite wings, a portico, the colonnaded drum and tall dome with the Goddess of Liberty), the Freedom Tower (Miami: Mediterranean
  Revival tower, open belfry, domed cupola, red tile roofs), Hohensalzburg (white fortress, red roofs, round towers and the green onion
  bell tower on its rock), the Colosseum (three storeys of arcades, the attic, the fallen side showing the inner ring and tiers) and, new,
  St Peter's Basilica, which now stands on Rome's skyline instead of the Leaning Tower of Pisa (Pisa is not in Rome).
  Small parts are skipped on Low (`H.full()`), like the other landmarks.
- **No building ever blocks the briefing** (`plaza.js`, `renderer.js`, `cameras.js`): the plaza now reaches all the way under the camera and
  the city is cleared up to it (Tokyo's tower was hidden behind a building, and Abu Dhabi's flyover could end inside a wall); the slow drift at
  the end stops after about 8 degrees, so the camera never wanders off the plaza; the city's welcome gantry is hidden near the plaza.
- **The golden-hour sky loads first** after the title's, so even a quick trip to the map gets the warm briefing light.
- **Landmarks are built before the race** (`city.prewarm()`), while the briefing or tyre screen is up, so a detailed one never makes the game
  stutter when it first comes into view.

## Step 5: traffic and cars

**What you should look at:** the Garage (`?dev=garage,0`): turn the car under the lights and watch the highlights on the paint sparkle; and
any race behind traffic: when a car ahead slows, its brake lights flare up red (with a glow on Medium and up).

- The race cars already had clear-coated paint, carbon fibre with a clear coat, rubber, machined rims, brake discs that glow when you brake
  hard and glowing brake lights (`js/render3d/car/racecar.js`). What was missing is the sparkle of real metallic paint:
  **metallic flakes** (`js/render3d/car/flakes.js`, new) give the paint's base layer a slightly different tilt for every tiny cell of the
  car's surface, under a mirror-smooth clear coat, so highlights glitter; further away the flakes fade, so nothing shimmers. Used on the race
  cars' livery and accent paint and on every traffic car (Medium and up; Low's simple lighting has no highlights to sparkle).
- **Traffic brake lights** (`makeCar` in `car/traffic.js`, `renderer.js`): every car has real brake lights over its tail lamps, much
  brighter than them, which come on while the car slows down and stay on half a second (the picture only: the traffic itself is unchanged).
- About new CC0 traffic models: there are no realistic, free, CC0 car models that would fit (Poly Haven has no cars, Kenney's and
  Quaternius's are toy-like, like the old ones). The game's own traffic, built in code with curved bodies and real glass, stays; its paint
  and lights got the upgrades above.

## Step 6: title, menus, Garage and the map

**What you should look at:** the title (the street reel), the main menu and Garage, and the World Tour map.

- **The World Tour map** (`drawWorldMap()` in `js/ui/hud.js`, data in `js/data/worldmap.js`, new): behind the list of cities, a deep night-blue
  screen with the world drawn as a grid of glowing dots (made from Natural Earth's land outlines, public domain), the tour's route arcing from
  city to city in running order (gold as far as you have got, its dashes flowing), a glowing pin on every city (gold once you have a star
  there, blue when open, grey when locked) and a pulsing ring round the one you picked. The dots are drawn once into a picture of their own;
  each frame only draws the route and the 22 pins.
- **The title's street** is Las Vegas with everything from the steps before (haze, the city's grade, damp neon reflections) and its city
  pack is part of the first download, so the towers along the reel are real lit office facades from the first second.
- **The menu and Garage studio** (`studioEnvironment()` in `js/render3d/showroom.js`) now reflects a real photographed studio (Poly Haven's
  Studio Small 09, CC0, `assets/hdri/studio.hdr`) under its drawn light strips, so paint, glass and rims mirror real softboxes and walls.
  It loads in the background; until it arrives the studio looks as before.
- Text and the car: the title's logo and prompts sit on the dark left of the picture with the car framed to the right (as before); the menu
  keeps the car left of its cards.

## Step 7: effects and the HUD

**What you should look at:** fire a nitro (`?dev=tour,5,1&ff=300&god&inspect=q34r&nitro` shows it close up), crash (`?dev=tour,3,1&ff=300&crash`),
drive flat out past 330 km/h, and hit something with screen shake on.

- **Smoke** (`pointSystem` in `js/render3d/fx.js`): each puff now has a ragged, billowing edge (a little noise, turned differently for every
  particle) and is lit from above, instead of a flat soft disc. **Sparks and fire** have a white-hot core.
- **Nitro flames**: tongues of flame lick backwards along the cone (noise flowing with time), a white-blue core turning violet at the tips,
  a quick pulse like shock diamonds; less blinding than before.
- **Speed lines** (`speedK` in `post.js`, Medium and up): above about 330 km/h, thin faint streaks rush outwards near the edges of the
  picture, each in its own rhythm; none in the cockpit view, menus or replays.
- **Camera shake** (`cameras.js`): a hit now shakes the camera with smooth waves at three speeds and a little roll, which rings and settles,
  instead of random jumps every frame. It still follows the Screen shake setting.
- **The HUD** (`drawHud` in `js/ui/hud.js`): same information in the same places; soft dark bands now sit behind the top and bottom rows so the
  numbers never sit on a bright sky, a white car or a lit road. Checked on a portrait phone (390 x 844): nothing overlaps the car or buttons.
- Two places that made new arrays for every particle and every trail point each frame now fill their arrays in place (`emit`, `Trail.step`).

## Step 8: final check

Every preset (Low, Medium, High, Ultra, Max) was run headless on this PC's graphics card through the title, Endless, Vs Computer, the Test Drive
(from lesson 3) and three World Tour cities (Monte Carlo, London, Las Vegas). **No errors anywhere.** Then a contact sheet of the title, menu,
Garage, map, all 22 briefings and a race in each city was saved to `.screenshots/overnight/` (not in git: `.screenshots/` is ignored).

**Frame time** (the graphics card's own work per frame, in milliseconds, 1280 x 720 window; lower is better, 16.7 ms is 60 fps; the screen
here runs at 120 Hz so the frame interval itself is about 7.7 ms):

| Preset | Title | Endless | Vs | Test Drive | Monte Carlo | London | Las Vegas |
|---|---|---|---|---|---|---|---|
| Low    | 1.3 | 2.3 | 2.3 | 1.6 | 2.2 | 2.1 | 2.3 |
| Medium | 3.0 | 2.9 | 3.3 | 3.0 | 3.8 | 3.6 | 3.0 |
| High   | 4.7 | 5.7 | 5.8 | 4.2 | 5.4 | 5.5 | 5.5 |
| Ultra  | 5.7 | 5.9 | 6.3 | 4.6 | 6.1 | 5.9 | 5.9 |
| Max    | 7.3 | 7.4 | 7.2 | 5.8 | 7.0 | 6.7 | 6.8 |

Low is as light as before the overhaul (it was 2.0 ms in Monte Carlo then; everything new is Medium and up, except the haze, which costs a few
sums per pixel). The occasional long first frame (100 to 600 ms) in these numbers is the very first frame after a developer shortcut drops
straight into a race (textures and shapes going to the graphics card for the first time); in the real game that happens behind the race-start
camera sweep, and no shader ever compiles mid-race.

**Load time** to the title on Low with the processor slowed down 4 times (a weak laptop): **2.9 s** (1.3 s at full speed).

**Size:** the whole game is **27 MB** (limit 200 MB): skies 12 MB, models 8.4 MB, city packs 2.4 MB, textures 1.8 MB, code 2.4 MB.
The **first download** (title, menu and a race in Sydney, with everything that loads in the background) is **26.1 MB** (limit 40 MB).

What the contact sheet showed, and was fixed: the sun mirrored in Shanghai's glass towers was blinding, so the city packs' glass is now a
little less mirror-like (rougher, less metallic). Look at `.screenshots/overnight/sheet-screens.png`, `sheet-briefings.png` and `sheet-races.png`.
