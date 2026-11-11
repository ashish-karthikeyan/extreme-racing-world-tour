# Extreme Racing: World Tour – release checklist

The game is now a **folder** (index.html + css/ + js/ + lib/ + assets/), not a single file. Upload the whole folder as a zip, with `index.html` at the top level.

## 1. Before you upload

- [ ] Bump `VERSION` in `js/data/config.js` (shown on the menu and in Credits).
- [ ] Run the game from a web server (VS Code **Live Server**). Opening `index.html` by double-click will NOT load the 3D models (browsers block that), so the game would fall back to the 2D look.
- [ ] Play one full city in each mode: World Tour, Daily Challenge, Endless, VS Computer, Multiplayer.
- [ ] Try all three cameras (C), pause / resume, crash and R to retry, the Garage, photo mode (P while paused).
- [ ] Try Settings → Graphics: Low, Medium, High, Ultra, Max and Auto. Turn on the FPS counter.
- [ ] Test on a phone (portrait and landscape) and with a controller if you have one.
- [ ] Test in a private / incognito window: a fresh player should see the loading screen, the title, then the tutorial on their first race.
- [ ] Sound starts after the first click or key, and goes quiet when you switch tabs.
- [ ] Open the game with `?2d` on the end of the address: the old 2D version should still work (it's the automatic fallback when WebGL 2 is missing).

## 2. Build the zip

From the `extreme-racer` folder, in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File toolsuild-release.ps1
```

This copies only what the game needs (`index.html`, `CREDITS.md`, `css/`, `js/`, `lib/`, `assets/`) into `release/build/`, zips it to `release/extreme-racer-v1.0.zip` with `index.html` at the top level, and checks the size and file count against the itch.io and CrazyGames limits. The version comes from `VERSION` in `js/data/config.js`. The zip is about **15 MB** (about **26 MB** unpacked, 306 files). The `release/` folder is not committed, except the upload guide `release/HOW-TO-UPLOAD.md` and the store text `release/store/listing.md`. Unzip the zip into an empty folder and test it with Live Server before uploading.

### Making it smaller (optional)

- The models (7.4 MB) are already small low-poly files. The five sky images (7.1 MB) are the biggest part (they zip down to almost nothing, but players download the zip contents unpacked). If a portal wants less, delete the sky you use least from `assets/hdri/` and from `TODS` in `js/render3d/env.js` (cities fall back to the midday sky), or use the 512-pixel versions from Poly Haven.
- To compress the models further, use `gltfpack` from [meshoptimizer](https://github.com/zeux/meshoptimizer/releases) (`gltfpack -i in.glb -o out.glb -cc`), then add the meshopt decoder to `js/render3d/assets.js` (`loader.setMeshoptDecoder(MeshoptDecoder)`). It is not needed at the current size.

## 3. itch.io page settings

- **Kind of project:** HTML
- **Uploads:** add the zip and tick **"This file will be played in the browser"**
- **Embed options:**
  - Viewport: **960 × 540** (16:9; the game stretches to fit; the 3D view works best at 1280 × 720 or larger, so a bigger viewport is fine too)
  - Tick **Mobile friendly** (orientation: Default; the game supports both)
  - Tick **Fullscreen button**
  - Leave **Enable scrollbars** off
- **Genre:** Racing. **Tags:** racing, arcade, cars, endless-runner, singleplayer, local-multiplayer, mobile, controller
- **Pricing:** free (optionally "No payments" or donations)
- Saves are kept in the browser's local storage on itch.io's game domain: they survive updates as long as players use the same browser.

## 4. CrazyGames

- Submit through the CrazyGames developer portal; they review every game.
- Their HTML5 SDK v3 is already in (`js/crazygames.js`): saves through `SDK.data`, gameplay start/stop, loading start/stop and their mute setting, all only when `SDK.environment` is "crazygames". Ads on CrazyGames also go through **their SDK** (for example ads between races and rewarded ads), and their rules don't allow other ad networks or external links in the game. Ads are the step still to do for an ad-supported release; **check their current developer docs for the exact rules first**.
- They test in an iframe like itch.io, so the iframe work (focus after a click, no scrollbars, blocked-controller handling, sound on first tap, the loading screen and the automatic 2D fallback) already covers the basics. Poki and CrazyGames both care about the size of the first download and about loading time: the loading screen shows progress, and Settings → Graphics → Auto picks a preset for the visitor's device.
- Prepare the cover / thumbnail images in the sizes the portal asks for.

## 5. Screenshots to take

Use a 1920 × 1080 browser window, press **F** for fullscreen, and capture with Win + Shift + S. Aim for 5–8:

1. **Title screen:** the animated logo over the 3D demo race (blurred background).
2. **Chase camera in Tokyo (cherry blossom) or Miami (sunset):** a busy road, landmarks on the skyline. Photo mode (P while paused) is the easiest way to get a great angle; Enter saves a PNG.
3. **Night in Las Vegas or Singapore:** neon signs, street-light pools, headlights, bloom.
4. **Rain in London:** rain streaks, wet road, Big Ben and the London Eye.
5. **A near-miss combo:** "CLOSE! x4" and COMBO on the HUD, ideally mid-nitro.
6. **CITY COMPLETE:** three stars and the flag-coloured confetti.
7. **The Garage showroom** (rotating turntable) or the **World Tour map**.
8. **Phone portrait:** in Chrome or Edge DevTools device mode (F12, then Ctrl + Shift + M), pick a phone and use "Capture screenshot".

itch.io also wants a **cover image (630 × 500)**: crop the title screen or a chase-camera shot.

## 6. Description (ready to paste)

**Game title (store page):** Extreme Racing: World Tour

**Short description:**
> Race through 22 world cities, dodge traffic at 300+ km/h and earn three stars in every city.

**Full description:**

> **Extreme Racing: World Tour** is an arcade racing game you play right in your browser.
>
> Drive an open-wheel race car on a World Tour through 22 cities, from Sydney to the Grand Final in Abu Dhabi. Every city has its own landmarks, weather and traffic: rain and spray in London, neon nights in Las Vegas, roadworks and long trucks.
>
> - **World Tour:** 22 cities, 3 stars and 3 missions each, and a head-to-head Grand Final
> - **Daily Challenge:** the same city and traffic for everyone each day; keep your streak going
> - **Endless, VS Computer and 2-player split controls**
> - **Near misses build combos**, nitro canisters fire you forward, and shields save you once
> - **Garage:** 11 teams to unlock and upgrades for handling, nitro, magnet and shield
> - Real 3D: dynamic weather, neon nights, crash cam, a photo mode and four graphics presets
> - Three cameras: overhead, chase and cockpit (with working mirrors)
> - Plays on keyboard, controller and touch screens
>
> **Controls:** Left / Right to change lanes, Up / Down for gas and brake (hold gas on the grid for a flying start), C to change camera, P to pause (and P again for photo mode). Drive through blue canisters for nitro. On a phone: tap a side to steer, and use the GAS and BRAKE buttons.
>
> Made by Ashish. All teams, cars and liveries are fictional.
