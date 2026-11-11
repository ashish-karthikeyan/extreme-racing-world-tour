# How to upload Extreme Racing: World Tour

A step-by-step guide for itch.io and the CrazyGames developer portal. Do itch.io first: it is quicker, and it gives you a public page to link to.

Everything you need is in this `release` folder:

| File | What it is |
| --- | --- |
| `extreme-racer-v1.0.zip` | the game (15 MB, 306 files, `index.html` at the top) |
| `store/listing.md` | the title, descriptions, controls, tags and every setting to choose, ready to copy and paste |
| `store/itch-cover-630x500.png` | the itch.io cover |
| `store/keyart-1920x1080.png` | the key art (banner, social media) |
| `store/crazygames-cover-*.png` | the three CrazyGames covers (landscape, portrait, square) |
| `store/screenshot-1-title.jpg` … `screenshot-6-near-miss.jpg` | six 1920 × 1080 screenshots |
| `store/gameplay-clip-1920x1080.mp4` and `gameplay-clip-portrait-1080x1620.mp4` | 15-second silent gameplay clips |

Keep `store/listing.md` open in VS Code while you fill in the forms.

---

## Before you start: test the zip once yourself

The zip was already tested (it ran the title, menu, Test Drive and races with no errors), but it takes two minutes to see it with your own eyes:

1. Right-click `extreme-racer-v1.0.zip` → **Extract All…** → extract into a new empty folder, for example `Desktop\er-test`.
2. In VS Code: **File → Open Folder…** → pick `er-test`.
3. Right-click `index.html` → **Open with Live Server**.
4. Play the Test Drive and one race. Then close that VS Code window and delete `er-test`.

**Made a change to the game later?** Build a new zip from the `extreme-racer` folder in a PowerShell terminal:

```powershell
powershell -ExecutionPolicy Bypass -File tools\build-release.ps1
```

It rebuilds `release/extreme-racer-v1.0.zip` and prints the size and file count with an OK / OVER check for each portal. (For a new version, first change `VERSION` in `js/data/config.js`, for example to `"1.0.1"`. The zip is then named `extreme-racer-v1.0.1.zip`.)

---

## Part 1: itch.io

### 1. Make an account

1. Go to **itch.io** and click **Register** (top right).
2. Fill in a username (this becomes your web address, for example `ashish.itch.io`), an email and a password. Confirm the email they send you.
3. When it asks what you want to do, choose **"I'm interested in distributing content on itch.io"**. (If you missed this, it's in **Settings → Profile**.)

### 2. Create the project

1. Click the arrow next to your name (top right) → **Upload new project**.
2. Fill in the top of the form from `store/listing.md` → *itch.io settings*:
   - **Title:** `Extreme Racing: World Tour`
   - **Project URL:** for example `extreme-racing`
   - **Short description or tagline:** the tagline
   - **Classification:** Games
   - **Kind of project:** **HTML** ← important, this is what makes it playable in the browser
   - **Release status:** Released
   - **Pricing:** **No payments** (or "$0 or donate" if you'd like tips)

### 3. Upload the game

1. Under **Uploads**, click **Upload files** and choose `release/extreme-racer-v1.0.zip`.
2. Wait for the bar to finish. Then tick **This file will be played in the browser** under the file.
3. A new **Embed options** box appears. Set:
   - **How should your project be run in your page?** → **Embed in page**
   - **Viewport dimensions:** **960** × **540**
   - **Mobile friendly:** ticked, **Orientation:** Default
   - **Automatically start on page load:** *not* ticked (the Click to Play button lets the sound start)
   - **Fullscreen button:** ticked
   - **Enable scrollbars:** not ticked
   - **SharedArrayBuffer support:** not ticked

### 4. Description, genre and tags

1. **Description:** paste the long description from `listing.md`. In itch.io's editor, the **bold** markers show as bold once you paste. If they show up as `**stars**`, just remove the stars and use the editor's **B** button.
2. **Genre:** Racing.
3. **Tags:** type them one by one: racing, arcade, 3d, driving, cars, singleplayer, local-multiplayer, low-poly, controller, mobile.
4. **AI generation disclosure:** answer honestly (the code was written with help from an AI assistant; the 3D models, skies and textures are CC0 assets listed in CREDITS.md).
5. Leave **App store links** and **Custom noun** empty.

### 5. Pictures and video

1. **Cover image** (right side of the form): `store/itch-cover-630x500.png`.
2. **Screenshots:** upload all six `store/screenshot-*.jpg`, in order 1 to 6.
3. **Gameplay video or trailer:** itch.io only takes a YouTube or Vimeo link. If you want one, upload `store/gameplay-clip-1920x1080.mp4` to YouTube first, then paste its link here. Otherwise leave it empty.

### 6. Save as a draft and test it on itch.io

1. **Visibility & access:** choose **Draft**. Click **Save & view page**.
2. On your page, click **Run game**. Check:
   - the loading bar, then the title screen with the car in Las Vegas
   - press a key: the menu opens, and there is sound after your first click
   - play the Test Drive and one race
   - the fullscreen button (bottom right of the game) works
3. On your phone, open the same page (you are logged in, so you can see the draft). It should start in fullscreen when you tap **Run game**. Try portrait and landscape.

### 7. Make it public

1. Back on **Edit game**: **Visibility & access** → **Public**. Click **Save**.
2. Optional, for a nicer page: **Edit theme** (on your game page) → use `store/keyart-1920x1080.png` as the **Banner** or **Background** and pick colours to match (dark background, orange links).

**Updating later:** on **Edit game**, upload the new zip, tick **This file will be played in the browser** on the new one, delete the old file, then save. Players keep their saves, because the game stores them in the browser under the same itch.io address.

---

## Part 2: CrazyGames (Basic Launch)

How it works: you submit the game, their QA team checks it, and then it goes live to a small audience for 7 to 21 days ("Basic Launch"). During that time they measure three things: how long people play (strong games: 10+ minutes), how many come back the next day (10 to 15%), and how many keep playing past the first minute (80%+). If the numbers are good, they invite you to the Full Launch, which needs their SDK (ads and revenue share). That is a later step, and you can ask me when you get there. Basic Launch doesn't require the SDK, but the game already has it built in (HTML5 SDK v3, no ads yet): on CrazyGames, progress is saved through their save system, so a signed-in player keeps it on any device. The game also tells CrazyGames when a race starts and stops and when it is loading, and it follows their mute button. Anywhere else (itch.io, your own PC) the SDK is ignored and the game works exactly as before.

Rules that matter for Basic Launch (the game already follows them all): no ads, no outside logins, no links to other sites, relative file paths only, and the whole game at 50 MB or less (ours is 26 MB unpacked, 306 files; the limit is 1,500).

### 1. Make a developer account

1. Go to **developer.crazygames.com** and sign up (or log in with your normal CrazyGames account).
2. Fill in your developer profile (name, country, email). Payment details are only needed for Full Launch.

### 2. Start a submission and try the preview

1. In the portal, open **Games** → **Submit a game** (or **Add game**).
2. Choose **HTML5** as the engine or type.
3. Upload `release/extreme-racer-v1.0.zip`.
4. Open the **Preview** tool. It shows the game exactly as it will look on CrazyGames, in their frame. Play the Test Drive and one race. Try their mobile preview too if it offers one. If you open the browser's console (F12), it should say `CrazyGames SDK on, saving to CrazyGames`.

### 3. Fill in the game details

The QA tool leads you through the pages. The labels may differ slightly from these:

- **Game name:** `Extreme Racing: World Tour`
- **Short / long description:** from `listing.md`
- **Controls:** the Controls section from `listing.md` (keyboard, controller and touch)
- **Category:** Driving (or "Car games")
- **Tags:** Racing, Car, 3D, Driving, Arcade, Multiplayer (local), Mobile
- **Supported devices:** Desktop **and** Mobile
- **Orientation:** both Landscape and Portrait
- **Age rating / content:** no blood, no gore, no bad language, no chat, no in-app purchases. Cars crash and bounce, nobody is hurt. That fits their PEGI 12 rule easily.
- **Uses the CrazyGames SDK?** Yes, HTML5 SDK v3 (no ads). If the portal offers **Progress Save** (cloud saves), turn it on: the game saves through it. With it off, the game quietly saves in the browser instead.
- **Collects personal data?** No. On CrazyGames, progress is saved through their own save system; anywhere else, in the browser (localStorage). The game sends nothing anywhere else.

### 4. Covers and videos

- **Landscape cover (16:9, 1920 × 1080):** `store/crazygames-cover-landscape-1920x1080.png`
- **Portrait cover (2:3, 800 × 1200):** `store/crazygames-cover-portrait-800x1200.png`
- **Square cover (1:1, 800 × 800):** `store/crazygames-cover-square-800x800.png`
- **Landscape preview video:** `store/gameplay-clip-1920x1080.mp4`
- **Portrait preview video:** `store/gameplay-clip-portrait-1080x1620.mp4`

These already follow their rules: the only text on the covers is the game's title, there are no borders or "Play now" badges, the videos are 15 seconds with no sound and no black bars, nothing is sped up, and each video starts on its cover picture so the thumbnail flows into the preview.

### 5. Submit

1. Check the summary page and click **Submit for review**.
2. Their QA team usually answers by email within a few days. If they ask for a change, tell me what they wrote and we'll fix it, rebuild the zip with `tools\build-release.ps1`, and upload the new one to the same game in the portal.
3. Once it's live, the portal shows your play time, retention and conversion numbers.

Good to know: CrazyGames shows games on its **mobile homepage** only if the first download is 20 MB or less. The game now reports its loading to their SDK (loading start and stop), which is how they tell the first download apart from the rest. But it still fetches all nine sky images in the background during the first race (about 26 MB in its first 25 seconds), so it may still count as more than 20 MB. The game still works on phones; it just may not be featured on the mobile homepage. Getting under 20 MB would need the game itself to load less at the start. That belongs with the Full Launch work, if CrazyGames invites you.

---

## If something goes wrong

| What you see | Why, and what to do |
| --- | --- |
| itch.io says "no index.html found" | You zipped the folder instead of what's inside it. Use the zip from `tools\build-release.ps1`, which is already right. |
| The game shows the old flat 2D look instead of 3D | The browser couldn't start WebGL 2 or the 3D files didn't load. Try another browser (Chrome or Edge) and check that the whole zip uploaded (15 MB). |
| No sound | Browsers only allow sound after you click or press a key. Click the game once. M toggles mute. |
| Keys don't work on itch.io | Click inside the game once, so it has the keyboard's attention (normal for any embedded game). |
| You changed something and the zip got bigger | `tools\build-release.ps1` prints OK or OVER for each limit. |

---

## Optional: record your own clip on your PC

The two MP4 clips in `store/` were recorded frame by frame on High, so they are perfectly smooth. If you'd like a different clip, for example a different city or your own driving, record one with the Xbox Game Bar that comes with Windows:

1. One-time setup: **Settings → Gaming → Captures**. Set **Video frame rate** to **60 fps** and **Video quality** to **High**. Turn **Capture audio when recording a game** off (store clips must be silent) and **Capture mouse cursor when recording a game** off (CrazyGames doesn't allow the mouse pointer in videos).
2. Open the game in Edge or Chrome with Live Server, **maximise** the window and press **F** for the game's own fullscreen, which hides the browser's bars.
3. In Settings → Graphics choose **High**.
4. Start a race: **World Tour → Las Vegas** (night, neon). Get up to speed.
5. Press **Win + Alt + R** to start recording. A small timer appears (it is not recorded). Weave through traffic, leave your lane at the last moment for near misses, and drive through a blue canister for nitro. Record about 25 seconds so you can trim it.
6. Press **Win + Alt + R** again to stop. The video is in **Videos → Captures**.
7. Trim it to 15 seconds: open it in the **Photos** app → **Edit** (or **Trim**) → drag the ends → **Save as copy**. Or use **Clipchamp** (free, comes with Windows 11), which can also make the 2:3 portrait version CrazyGames asks for: **Aspect ratio → 2:3**.
