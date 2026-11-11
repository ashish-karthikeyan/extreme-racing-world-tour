---
name: perf-check
description: Measure Extreme Racer's speed on a simulated weak laptop and find what is slowing it down. Use when the user says it is laggy, slow to load, or before release.
---

# Performance check

1. Serve the game and open it headless in Chrome with CPU throttling 4x and a 1280x720 window. Close every browser when done.
2. Measure, for Low and High: time from opening the page to the title being visible, to the menu being usable, and the average and worst frame time over 10 seconds of the title, the menu and a race (`?perf=N`, `?gfx=low`, `?dev=tour,19,1&ff=600&god`).
3. If anything is slow, find out why: count draw calls and triangles (renderer.info), look for objects or arrays created every frame, big textures, shaders compiling mid-game, or effects that should be off on Low.
4. Report a small table (scene, preset, load time, average fps, worst frame) and the top 3 causes with the file and function, explained for a beginner. Don't change code unless asked.
5. Low must hold 60 fps on a weak laptop. Say clearly if it doesn't.
