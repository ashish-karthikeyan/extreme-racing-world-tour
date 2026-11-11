# Extreme Racer: notes for Claude Code

Browser racing game. Three.js r170 3D renderer (branch `3D`) over a fixed 60 Hz simulation. The finished 2D game lives on branch `2D`. Plain JavaScript ES modules, no build step, no npm. Served with VS Code Live Server.

## About me

- I'm a beginner learning to code (CS50). Before each change, explain in plain language what you'll do and why. Afterwards, tell me exactly what to look at in the game.
- I want to understand my own code, so when you change something important, name the file and the function and say in one or two sentences how it works.

## How the code is organised

- `js/sim/` is the game itself: cars, traffic, scoring, AI, stages. It never knows about 3D. `js/sim/tutorial.js` is the test drive (mode "tutorial": a lesson script places all traffic; `?dev=tutorial,N` jumps to lesson N); `js/ui/hints.js` holds the one-time tips.
- `js/render3d/` only reads the sim's state. `js/render3d/mapping.js` is the one place that turns sim coordinates into 3D world units.
- `js/render3d/city/` builds the scenery (`profiles.js` holds per-city looks). `landmarks.js` holds the landmarks.
- `js/render3d/quality.js` holds the graphics presets (Low to Max). Anything new must be added to every preset.
- `js/ui/` holds menus, the HUD, the Garage and input (`devices.js` detects keyboard, controller and touch).
- `js/data/` holds teams, the 22 cities (index 0 Australia to 21 Abu Dhabi), saves and tuning.
- `js/crazygames.js` runs first: it starts the game's scripts (listed in `index.html`) and holds the CrazyGames SDK v3 glue (saves through `SDK.data`, gameplay and loading events, mute). It does nothing unless `SDK.environment` is "crazygames"; test it with `?crazygames` and a fake SDK.
- `lib/three/` holds the pinned Three.js. Don't upgrade it and don't load anything from a CDN (the one exception: CrazyGames' SDK script, which must come from their server).

## Rules

- Don't change gameplay (lanes, collisions, scoring, timings, AI, saves) unless I ask for it.
- No real brands, F1 team names or logos. Use only CC0 assets and update CREDITS.md.
- Size: the first download (title, menu, one race) must stay under 40 MB and the whole game under 200 MB. Assets used by one city only go in that city's pack (`assets/cities/<city>/`, see `js/render3d/citypack.js`), loaded on the map, briefing or tyre screen, never mid-race. Compress everything: glTF with meshopt, textures as WebP (1K normally, 2K only for hero assets).
- Performance: nothing allocated every frame. Use instancing and merged geometry. Low must hold 60 fps on a weak laptop or phone.
- Every on-screen prompt must work with keyboard, controller and touch, and must not overlap the car, the HUD or buttons (check a portrait phone at 390x844 too).
- Commit after each finished step with a clear message. Never force-push or rewrite history.
- After finishing any task, run a thorough bug check before saying you're done: every screen that the change could touch, Low and High presets, keyboard, controller and touch, a race in at least 3 cities, Vs Computer and the Test Drive, no console errors. Fix what you find, commit and push, and list what you checked.

## Testing

- Use the dev URL shortcuts in `js/main.js` (e.g. `index.html?dev=tour,3,1&ff=420&god`, `?gfx=low`, `?2d`, `?perf=N`) instead of playing through menus.
- Run browser tests headless, and always close every test browser when you're done. Save screenshots to `.screenshots/` in the project (add it to .gitignore), not to Temp.
- For small fixes, don't take screenshots at all. Just check the console for errors.