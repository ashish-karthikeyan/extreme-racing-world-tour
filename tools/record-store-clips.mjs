// Dev-only store clip capture. Each frame is a fixed simulation step followed by a real WebGL render.
// Run with: node tools/record-store-clips.mjs [--ffmpeg=C:\\path\\ffmpeg.exe]
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "release", "store");
const SCREENSHOTS = path.join(ROOT, ".screenshots", "clip", "review");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const WIDTHS = { landscape: [1920, 1080], portrait: [1080, 1620] };
const GAME_FRAMES = Number(process.argv.find(a => a.startsWith("--frames="))?.slice(9) || 1080), COVER_FRAMES = 60, MAX_ATTEMPTS = 8;
const explicitSeed = process.argv.find(a => a.startsWith("--seed="))?.slice(7);
const baseSeed = explicitSeed === undefined ? 6102026 : Number(explicitSeed);
const onlyLayout = process.argv.find(a => a.startsWith("--layout="))?.slice(9);
const ffmpeg = process.argv.slice(2).find(a => a.startsWith("--ffmpeg="))?.slice(9) || process.env.FFMPEG || "ffmpeg";
const coverFiles = {
  landscape: path.join(STORE, "crazygames-cover-landscape-1920x1080.png"),
  portrait: path.join(STORE, "crazygames-cover-portrait-800x1200.png"),
};
const outputFiles = {
  landscape: path.join(STORE, "gameplay-clip-1920x1080.mp4"),
  portrait: path.join(STORE, "gameplay-clip-portrait-1080x1620.mp4"),
};

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".hdr": "application/octet-stream", ".wasm": "application/wasm", ".json": "application/json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403).end(); return; }
    const body = await fs.readFile(file);
    res.writeHead(200, { "content-type": mime[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404).end("Not found"); }
});
await new Promise(resolve => server.listen(8765, "127.0.0.1", resolve));

async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}
async function waitFor(fn, timeout = 120000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { const value = await fn(); if (value) return value; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for headless game / renderer");
}
function connectCDP(url) {
  const ws = new WebSocket(url), pending = new Map(), errors = []; let nextId = 0;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", event => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails?.text || "Page exception");
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args?.map(a => a.value || a.description || "").join(" ") || "console.error");
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  return { ws, ready, errors, call(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  } };
}
async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Page evaluation failed");
  return result.result?.value;
}
async function closeTake(browser, cdp, target) {
  try { cdp?.ws.close(); } catch {}
  try { if (target) await fetch(`http://127.0.0.1:9222/json/close/${target.id}`); } catch {}
  if (browser && !browser.killed) { browser.kill(); await Promise.race([once(browser, "exit"), new Promise(r => setTimeout(r, 5000))]); }
}
async function recordOne(layout, attempt) {
  const [width, height] = WIDTHS[layout], seed = baseSeed + attempt * 9973;
  // High keeps all of its effects / detail; half-size WebGL rendering is scaled 2x only at capture.
  // This makes deterministic headless capture practical while keeping the requested output dimensions.
  const renderWidth = width / 2, renderHeight = height / 2;
  const profile = path.join(os.tmpdir(), `extreme-racer-store-${layout}-${attempt}`);
  const browser = spawn(EDGE, [
    "--headless=new", "--no-sandbox", "--enable-gpu", "--enable-webgl", "--use-gl=angle", "--use-angle=d3d11",
    "--no-proxy-server", "--disable-extensions", "--no-first-run", "--remote-allow-origins=*", "--remote-debugging-port=9222", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  let cdp, target, encoder;
  const temp = outputFiles[layout] + ".take.mp4";
  try {
    await waitFor(async () => (await json("http://127.0.0.1:9222/json/version")).webSocketDebuggerUrl, 30000);
    target = await json(`http://127.0.0.1:9222/json/new?http://127.0.0.1:8765/` + `index.html?dev=record,19,1&gfx=high&fresh&seed=${seed}`, { method: "PUT" });
    cdp = connectCDP(target.webSocketDebuggerUrl); await cdp.ready;
    await cdp.call("Page.enable"); await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", { width: renderWidth, height: renderHeight, deviceScaleFactor: 1, mobile: false });
    await cdp.call("Page.navigate", { url: `http://127.0.0.1:8765/index.html?dev=record,19,1&gfx=high&fresh&seed=${seed}` });
    const ready = await waitFor(async () => evaluate(cdp, "!!(window.__record && window.R3D && !window.R3D_PENDING)"), 180000);
    if (!ready) throw new Error("Game renderer did not become ready");
    await evaluate(cdp, "document.getElementById('loading')?.remove(); document.getElementById('game')?.focus(); document.body.style.cursor='none'");
    const scene = await evaluate(cdp, "(()=>{const gl=R3D.renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info'); return {state, quality:R3D.quality.level, size:[innerWidth,innerHeight], canvas:[document.getElementById('gl').clientWidth,document.getElementById('gl').clientHeight], ghost:racers[0].ghost, shield:racers[0].shield, renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}})()");
    if (scene.quality !== "high" || scene.size[0] !== renderWidth || scene.size[1] !== renderHeight || scene.state !== "playing" || /swiftshader|llvmpipe/i.test(scene.renderer)) throw new Error(`Wrong capture scene: ${JSON.stringify(scene)}`);
    await fs.mkdir(SCREENSHOTS, { recursive: true });
    const outWidth = width % 2 ? width - 1 : width, outHeight = height % 2 ? height - 1 : height;
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "60", "-t", "1", "-i", coverFiles[layout], "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", "60", "-i", "pipe:0", "-filter_complex", `[0:v]scale=${outWidth}:${outHeight}:flags=lanczos,setsar=1,trim=duration=1,setpts=PTS-STARTPTS[c];[1:v]scale=${outWidth}:${outHeight}:flags=lanczos,setsar=1,trim=duration=18,setpts=PTS-STARTPTS[g];[c][g]concat=n=2:v=1:a=0[out]`, "-map", "[out]", "-r", "60", "-frames:v", String(GAME_FRAMES + COVER_FRAMES), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", temp];
    encoder = spawn(ffmpeg, args, { stdio: ["pipe", "ignore", "pipe"], windowsHide: true });
    let ffError = ""; encoder.stderr.setEncoding("utf8"); encoder.stderr.on("data", chunk => { ffError += chunk; });
    await new Promise(resolve => setTimeout(resolve, 250));
    const step = await cdp.call("Runtime.evaluate", { expression: "window.__record.step()", returnByValue: true });
    if (step.exceptionDetails) throw new Error(step.exceptionDetails.text || "First sim step failed");
    // Each call advances exactly one 60 Hz sim tick and renders the resulting state before capture.
    for (let i = 0; i < GAME_FRAMES; i++) {
      if (i > 0) {
        const state = await cdp.call("Runtime.evaluate", { expression: "window.__record.step()", returnByValue: true });
        if (state.exceptionDetails) throw new Error(state.exceptionDetails.text || `Sim failed at frame ${i + 1}`);
      }
      const shot = await cdp.call("Page.captureScreenshot", { format: "jpeg", quality: 96, fromSurface: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: renderWidth, height: renderHeight, scale: 2 } });
      const jpg = Buffer.from(shot.data, "base64");
      if (!encoder.stdin.write(jpg)) await once(encoder.stdin, "drain");
      if (i % 270 === 269) await fs.writeFile(path.join(SCREENSHOTS, `${layout}-${String((i + 1) / 270).padStart(2, "0")}.jpg`), jpg);
      if (i % 90 === 89) console.log(`CAPTURE ${layout} seed=${seed} frame=${i + 1}/${GAME_FRAMES}`);
    }
    const report = await evaluate(cdp, "window.__record.report()"); report.consoleErrors = cdp.errors;
    encoder.stdin.end();
    const [code] = await once(encoder, "exit");
    if (code !== 0) throw new Error(`ffmpeg failed (${code}): ${ffError}`);
    const bad = report.overlapFrames || report.crashFrames || report.protectedFrames || report.consoleErrors.length || report.nearMisses < 2 || report.nitrosPicked < 1 || report.bypasses < 1 || report.frames !== GAME_FRAMES;
    return { report, scene, temp, bad };
  } catch (error) {
    try { encoder?.stdin.destroy(); } catch {}
    if (encoder && !encoder.killed) { encoder.kill(); await Promise.race([once(encoder, "exit"), new Promise(r => setTimeout(r, 2000))]); }
    throw error;
  } finally { await closeTake(browser, cdp, target); }
}

try {
  for (const layout of (onlyLayout ? [onlyLayout] : ["landscape", "portrait"])) {
    if (!WIDTHS[layout]) throw new Error(`Unknown layout: ${layout}`);
    const [width, height] = WIDTHS[layout];
    let accepted = null;
    for (let attempt = 0; attempt < (explicitSeed === undefined ? MAX_ATTEMPTS : 1); attempt++) {
      const take = await recordOne(layout, attempt);
      console.log(JSON.stringify({ layout, attempt: attempt + 1, scene: take.scene, report: take.report, clean: !take.bad }));
      if (!take.bad) { accepted = take; break; }
      await fs.rm(take.temp, { force: true }); // a failed take is discarded; it never replaces the last deliverable
    }
    if (!accepted) throw new Error(`${layout}: no collision-free take with the requested gameplay within ${MAX_ATTEMPTS} deterministic seeds`);
    const output = outputFiles[layout];
    await fs.rename(accepted.temp, output);
    const st = await fs.stat(output);
    if (st.size >= 50 * 1024 * 1024) throw new Error(`${layout} clip exceeds 50 MB (${st.size} bytes)`);
    const ffprobe = path.join(path.dirname(ffmpeg), path.basename(ffmpeg).replace(/ffmpeg(?:\.exe)?$/i, "ffprobe.exe"));
    const probed = spawn(ffprobe, ["-v", "error", "-show_entries", "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate", "-of", "json", output], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let probeOut = "", probeErr = ""; probed.stdout.setEncoding("utf8"); probed.stderr.setEncoding("utf8"); probed.stdout.on("data", x => probeOut += x); probed.stderr.on("data", x => probeErr += x);
    const [probeCode] = await once(probed, "exit"); if (probeCode !== 0) throw new Error(`ffprobe failed (${probeCode}): ${probeErr}`);
    const media = JSON.parse(probeOut), video = media.streams.find(s => s.codec_type === "video");
    if (!video || video.codec_name !== "h264" || video.width !== width || video.height !== height || media.streams.some(s => s.codec_type === "audio") || Math.abs(+media.format.duration - 19) > 0.02) throw new Error(`Unexpected video output: ${probeOut}`);
    console.log(JSON.stringify({ layout, output: path.relative(ROOT, output), bytes: st.size, durationSeconds: media.format.duration, frames: GAME_FRAMES + COVER_FRAMES, noAudio: true, video }));
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
