// Metallic flakes in car paint (Medium and up): real metallic paint has tiny aluminium flakes under its clear coat, each tilted a little
// differently, so the highlight on a car sparkles. Here the paint's base layer gets a slightly different tilt for every tiny cell of the
// car's own surface (about 5 mm, in the model's coordinates, so the pattern stays on the car as it moves), while the clear coat on top stays
// mirror-smooth. Further away, where a cell would be smaller than a pixel, the flakes fade out, so the paint never shimmers.
export function addFlakes(m, scale = 110, amount = 0.32) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(m, sh, r);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vFlakeP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvFlakeP = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFlakeP;\nfloat flH(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }")
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        #ifndef LOW_SHADING
        { vec3 fp = vFlakeP * ${scale.toFixed(1)}; float fade = 1.0 - smoothstep(0.3, 0.85, length(fwidth(fp)));
          if (fade > 0.0) { vec3 fc = floor(fp); normal = normalize(normal + (vec3(flH(fc), flH(fc + 1.37), flH(fc + 2.71)) - 0.5) * ${amount.toFixed(2)} * fade); } }
        #endif`);
  };
  m.customProgramCacheKey = () => (prevKey && prevKey !== Object.getPrototypeOf(m).customProgramCacheKey ? prevKey.call(m) : "") + "flakes";
  return m;
}
