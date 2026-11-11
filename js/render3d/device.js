// What kind of machine is this? Read once, before anything is drawn, so a weak laptop starts on Low straight away instead of spending
// seconds proving it is weak. Nothing here is exact (browsers hide a lot), so a "weak" guess only picks the starting preset: the
// first-launch benchmark (quality.js) can still step up from there if the frames come in fast.
const seen = new WeakMap();
export function readDevice(gl) { let d = seen.get(gl); if (!d) seen.set(gl, d = read(gl)); return d; }
function read(gl) {
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "");
  const ua = navigator.userAgent;
  const safari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPR\/|Android/.test(ua); // (Safari hides the real graphics chip: it always says "Apple GPU")
  const cores = navigator.hardwareConcurrency || 0, mem = navigator.deviceMemory || 0; // (0 = the browser doesn't say; Safari and Firefox never give the memory)
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
  const phone = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 800;
  const weak = [];
  if (/Intel.*(HD|UHD|Iris)|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Software|Basic Render|GeForce MX|Radeon (R[2-7] |HD )/i.test(gpu)) weak.push("graphics chip");
  if (cores && cores <= 4) weak.push(`${cores} CPU threads`);
  if (mem && mem <= 4) weak.push(`${mem} GB memory`);
  if (maxTex && maxTex < 8192) weak.push("small textures");
  if (safari) weak.push("Safari");
  if (phone) weak.push("phone");
  if (location.search.includes("weak")) weak.push("testing: &weak"); // (testing: treat this machine as a weak one)
  const software = /SwiftShader|llvmpipe|Software|Basic Render/i.test(gpu); // (no graphics chip at all: the CPU draws everything)
  // a strong graphics card, known by its name: NVIDIA RTX, AMD Radeon RX 5000 and newer (four digits: RX 5700, 6800, 7900, 9070...), Apple
  // M Pro / Max / Ultra (Chrome names the chip; Safari only says "Apple GPU"). Auto starts it on Ultra and measures from there.
  const strong = weak.length === 0 && /\bRTX\b|Radeon(\(TM\))? RX ?[5-9]\d{3}|Apple M\d+ (Pro|Max|Ultra)/i.test(gpu);
  const float = floatTargets(gl);
  return { gpu, safari, cores, mem, maxTex, phone, software, weak: weak.length > 0, strong, why: weak, floatRT: float.rt, floatMSAA: float.msaa };
}

// Can this browser really draw into a picture made of half floats (16-bit numbers), plain and multisampled? The post-processing, the sky's
// lighting and the mirrors all need it. WebGL 2 only allows it with an extension, and some browsers (older Safari among them) can't, or
// can't multisample it: then those pictures would come out black. Tested by building one tiny such picture and asking if it is complete.
function floatTargets(gl) {
  if (location.search.includes("nofloat")) return { rt: false, msaa: false }; // (testing: act like a browser without them)
  const ok = { rt: false, msaa: false };
  if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) return ok;
  const fb = gl.createFramebuffer(), tex = gl.createTexture(), rb = gl.createRenderbuffer(), prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING), prevTex = gl.getParameter(gl.TEXTURE_BINDING_2D), prevRb = gl.getParameter(gl.RENDERBUFFER_BINDING);
  try {
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    ok.rt = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (ok.rt) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0), gl.RGBA16F, 4, 4);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
      ok.msaa = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
  } catch (e) { ok.rt = ok.msaa = false; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb); gl.bindTexture(gl.TEXTURE_2D, prevTex); gl.bindRenderbuffer(gl.RENDERBUFFER, prevRb);
  gl.deleteFramebuffer(fb); gl.deleteTexture(tex); gl.deleteRenderbuffer(rb); while (gl.getError()) {} // (leave no error behind for three.js to find)
  return ok;
}
