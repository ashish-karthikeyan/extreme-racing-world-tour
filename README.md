# Extreme Racing: World Tour

A browser racing game: dodge traffic in an open-wheel race car on a world tour through 22 cities. Built with Three.js and free CC0 models (see CREDITS.md). It falls back to a 2D renderer by itself when a browser has no WebGL 2.

**Play it:** https://ashish-karthikeyan.github.io/extreme-racing-world-tour/

## Run it

The game is a folder of files, so it must be served by a web server (opening `index.html` by double-click only gives you the 2D fallback):

- **VS Code:** right-click `index.html` → **Open with Live Server**

Press **F** for fullscreen. To publish it, see [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Modes and features

- **Test drive:** a 90-second playable tutorial for new players (offered after the title and before the first race; **Settings → How to Play** replays it): ten tiny lessons in Tokyo at sunset, from "hold GAS" to a launch start and a short final race, then one-time tips the first time you open a screen
- **World Tour:** 22 cities, each a level with a finish line, 1–3 stars and 3 missions; finish a city to unlock the next; the last one is a Grand Final against the CPU
- **Daily Challenge:** one city and traffic pattern per day (seeded from the date), best score and day streak
- **Endless**, **VS Computer** (Easy to Impossible) and **Multiplayer** (arrows + WASD, or two controllers): split screen in 3D, each player with their own camera, speedo and launch gauge
- Near misses build a combo that multiplies your score; faster driving always scores more
- Nitro canisters that boost you the moment you hit them, rare shields that absorb one crash
- Traffic that gets trickier: long trucks and roadworks; rain and night cities drive differently
- Garage: 11 fictional teams in a mirror-floor showroom (drag the car or use the right stick to spin it; locked cars are shown as silhouettes) and upgrades (Handling, Nitro, Magnet, Shield)
- Stats and 18 achievements; keyboard, controller (Xbox, PlayStation, Nintendo) and touch, including portrait phones. The game notices what you are holding and every on-screen prompt switches to those keys or buttons; Settings → Controls lists them all
- Three cameras: overhead, chase and cockpit (3D cockpit with working mirrors); crash camera, start-line sweep, finish swing
- **Photo mode:** pause, press **P**: free camera, filters, depth of field, hidden HUD, **Enter** saves a PNG
- **Settings → Graphics:** Auto / Low / Medium / High / Ultra / Max, render scale, shadows, effects, draw distance, FPS counter (Low lowers its resolution by itself to hold 60 fps)

## How the project is organised

```
index.html            the page: loading screen, import map, script list
css/                  page styles
js/data/              settings, teams, the 22 cities, saved progress
js/sim/               the game itself: cars, traffic, scoring, AI, stages (60 ticks per second)
js/audio/             synthesised sound and music
js/ui/                menus, HUD, input
js/render2d/          the original 2D renderer (kept as the fallback)
js/render3d/          the Three.js renderer: scene, models, cameras, weather, night, post-processing, photo mode
lib/three/            Three.js (pinned to r170) and the add-ons we use, no CDN
assets/               models (.glb) and sky images (.hdr)
tools/                inspect.html (model inspector) and the car / landmark / builder lab pages
```

The game logic never knows about 3D: `js/render3d/mapping.js` is the single place that turns the simulation's flat coordinates into 3D world units, and the 3D renderer only *reads* the simulation's state.

Handy testing shortcuts (not linked from the game): `index.html?dev=tour,3,1&ff=420&god` starts a World Tour race (city 3, chase camera), skips ahead and ignores crashes; `?dev=tutorial,5` starts the test drive at lesson 5; `?gfx=low` tries a graphics preset; `?2d` forces the 2D renderer. The full list is in `js/main.js`.

Made by Ashish. All teams, liveries and names in the game are fictional.

## How it was built

I built this game with AI assistance. The code was written with Claude Code, and I directed the design: the game modes, the 22-city world tour, the features and the look. I play-tested each version and decided what to change. The 3D models, skies and textures are free CC0 assets, credited in CREDITS.md.
