// Simple lighting for Low. Every shiny material in the game (three.js "standard" and "physical" materials: the cars' clear-coated paint,
// metal, glass, the city) normally works out a full lighting model for each pixel: a highlight for each light, a reflection of the sky,
// a clear coat on top. On Low they are lit the cheap way instead: just how much each light falls on the surface (like MeshLambertMaterial).
// It costs far less on a weak graphics chip, and its shaders are smaller, so they compile sooner on the first launch.
//
// How: the shader code three.js builds every such material from gets a switch (LOW_SHADING). A material is given that switch just before
// it is next drawn (a hook every material runs), so materials made later (new cars, new parts of the city) follow it too, and nothing
// that changes a material while the game runs needs to know about it.
import * as THREE from "three";

const C = THREE.ShaderChunk;
function patch(name, find, add, after = false) { // (if this three.js ever changes these lines, the patch is skipped: everything still works, with full lighting)
  if (!C[name].includes(find)) { console.warn("lowshading: three.js shader changed, simple lighting is off:", name); return false; }
  C[name] = C[name].replace(find, after ? find + add : add + find); return true;
}
// no clear coat, sheen or iridescence at all
patch("common", "#define PI 3.141592653589793", "#ifdef LOW_SHADING\n#undef USE_CLEARCOAT\n#undef USE_SHEEN\n#undef USE_IRIDESCENCE\n#endif\n");
// each light: only how much of it falls on the surface (no highlight)
patch("lights_physical_pars_fragment", "inout ReflectedLight reflectedLight ) {\n\tfloat dotNL = saturate( dot( geometryNormal, directLight.direction ) );",
  "\n#ifdef LOW_SHADING\n\treflectedLight.directDiffuse += saturate( dot( geometryNormal, directLight.direction ) ) * directLight.color * BRDF_Lambert( material.diffuseColor ); return;\n#endif", true);
// no reflections of the sky (the soft light from it stays)
patch("lights_physical_pars_fragment", "inout ReflectedLight reflectedLight) {", "\n#ifdef LOW_SHADING\n\treturn;\n#endif", true);
// metal has no colour of its own in the full model (it only reflects); lit simply, it keeps half of its colour instead of turning black
patch("lights_physical_fragment", "material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );", "\n#ifdef LOW_SHADING\nmaterial.diffuseColor = diffuseColor.rgb * ( 1.0 - 0.5 * metalnessFactor );\n#endif", true);

let low = false;
function apply(m) { m._low = low; if (low) m.defines.LOW_SHADING = ""; else delete m.defines.LOW_SHADING; m.needsUpdate = true; }
// make one material follow the switch now (renderer.compile() doesn't run the hook below, so the renderer calls this before compiling ahead)
export function prepLow(m) { if (Array.isArray(m)) { for (const x of m) prepLow(x); return; } if (m && m.isMeshStandardMaterial && m.defines && (m._low || false) !== low) apply(m); }
export function setLowShading(on) { low = !!on; }
const hook = THREE.Material.prototype.onBeforeRender;
THREE.Material.prototype.onBeforeRender = function (...a) { if (this.isMeshStandardMaterial && (this._low || false) !== low && this.defines) apply(this); return hook.apply(this, a); };
