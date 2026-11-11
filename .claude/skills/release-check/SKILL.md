---
name: release-check
description: Check Extreme Racer is ready to upload to itch.io, CrazyGames or Poki: size, file paths, brands, credits, errors, every preset and device. Use before a release or when the user says "is it ready".
---

# Release check

Report a checklist with PASS / FAIL and a one-line fix for each FAIL. Don't change code unless asked.

1. Size: the game folder (without .git, .claude, .screenshots, node_modules) is under 40 MB. List the 10 biggest files.
2. Paths: every file the game loads uses a relative path, and the exact upper/lower case matches the real file name (web hosts are case-sensitive, Windows and Mac are not). No CDN links, no localhost URLs, no absolute paths.
3. Brands: search all text, team names, liveries and file names for real F1 teams, drivers, sponsors or car makers. Everything must be fictional.
4. Credits: every asset in models/ and sounds/ is listed in CREDITS.md with its CC0 or own-work source.
5. Clean start: serve the folder from a zip-like copy (only the files that would be uploaded) and load index.html headless with a fresh profile (no saved data). No console errors from the title to the end of the first race.
6. Presets: Low, Medium, High, Ultra and Max each load the title, menu and a race without errors (`?gfx=low` etc.).
7. Devices: keyboard, controller (simulated) and touch at 390x844 can each start a race, pause, and get back to the menu.
8. Portal basics: the game pauses and mutes when the tab is hidden, has a mute key, never opens pop-ups, and works inside an iframe.
9. Close every test browser and stop the server. Give a short list of what the user must still check on a real phone and a weak laptop.
