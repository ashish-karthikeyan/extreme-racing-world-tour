---
name: playtest
description: Play-test Extreme Racer in a headless browser after a change: load key scenes with the dev URL shortcuts, check the console for errors, take a few screenshots, and report what looks broken.
---

# Play-test Extreme Racer

1. Serve the game folder on a local port (e.g. `npx http-server -p 8765` or `python -m http.server 8765`) unless Live Server is already running.
2. Use Playwright **headless** (no visible windows). Open one page at a time and close it after each scene.
3. Load these scenes with the dev shortcuts from `js/main.js` (city index 0 Australia to 21 Abu Dhabi; camera 0 Overhead, 1 Chase, 2 Cockpit):
   - Title: `index.html`
   - Menu: `index.html?dev=menu`
   - Day city: `index.html?dev=tour,5,1&ff=600&god`
   - Rain city: `index.html?dev=tour,8,1&ff=600&god`
   - Night city: `index.html?dev=tour,19,1&ff=600&god`
   - Race start: `index.html?dev=tour,9,1`
   - Crash: `index.html?dev=tour,3,1&ff=300&crash`
   - Finish: `index.html?dev=tour,0,1&ff=300&finish`
   - Garage: `index.html?dev=garage,3`
   - Phone: the day city at 390x844
   Only test the scenes that the change could affect, unless asked for a full test.
4. Collect page errors and console errors for each scene.
5. Save screenshots to `.screenshots/` in the project (it is gitignored), never to Temp.
6. **Close the browser and stop the server when done.** Never leave windows open.
7. Report in plain language: errors found (with file and line), what looks wrong in each screenshot, and what the user should check themselves on their own PC (fps, feel).
