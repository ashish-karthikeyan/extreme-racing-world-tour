// Haze: a better fog for every material in the game, on every preset (it costs a few sums per pixel).
//
// three.js's own fog fades things to one flat colour by distance. Real air does two more things, and this file teaches every shader both:
//   1. the haze is thickest near the ground and thins out with height, so the tops of tall towers and hills stand out against the sky
//      while the far streets melt into it ("height fog");
//   2. looking towards the sun, the haze glows in the sun's colour (sunlight scattered by the air), so a sunset city turns golden on the
//      horizon and a midday city stays blue ("in-scattering").
// The game still sets scene.fog's colour, near and far exactly as before (world.js): this only changes how they are used.
// How: three.js builds every shader from small pieces of code called chunks; this file swaps the four fog chunks for its own before
// anything is compiled. Materials that are lit by the sun also know where the sun is (directionalLights[0]); unlit ones get the plain haze.
import * as THREE from "three";

const C = THREE.ShaderChunk;

C.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogView;
#endif`;

C.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogView = mvPosition.xyz;
#endif`;

C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogView;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;

C.fog_fragment = `#ifdef USE_FOG
  {
    float hzDist = length(vFogView);
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * hzDist * hzDist );
    #else
      // height above the ground: the camera's own height plus how far the point is above it (the view matrix's second row is "up")
      float hzCamY = cameraPosition.y;
      float hzDy = dot( vec3( viewMatrix[0].y, viewMatrix[1].y, viewMatrix[2].y ), vFogView );
      // the haze is as thick as three.js's linear fog at the far distance, but builds up like real air (exponentially) and thins with height
      float hzD = max( hzDist - fogNear, 0.0 );
      float hzDens = 2.1 / max( fogFar - fogNear, 1.0 );
      float hzK = 0.011;
      float hzA = hzK * hzDy;
      float hzH = exp( - hzK * max( hzCamY, 0.0 ) ) * ( abs( hzA ) > 0.001 ? ( 1.0 - exp( - hzA ) ) / hzA : 1.0 );
      float fogFactor = 1.0 - exp( - hzD * hzDens * clamp( hzH, 0.0, 4.0 ) );
      fogFactor = max( fogFactor, smoothstep( fogFar * 0.92, fogFar * 1.25, hzDist ) ); // (far past the end of the fog nothing shows through, as before)
    #endif
    vec3 hzCol = fogColor;
    #if defined( RE_Direct ) && NUM_DIR_LIGHTS > 0
      // towards the sun the haze glows in the sun's colour
      float hzSun = max( dot( normalize( vFogView ), directionalLights[ 0 ].direction ), 0.0 ); // (both in view space: 1 = looking straight at the sun)
      vec3 hzLight = directionalLights[ 0 ].color;
      float hzL = max( max( hzLight.r, hzLight.g ), hzLight.b );
      hzCol += hzLight / max( hzL, 0.001 ) * min( hzL * 0.06, 0.35 ) * ( pow( hzSun, 6.0 ) * 0.9 + pow( hzSun, 40.0 ) * 0.8 ) * fogFactor;
    #endif
    gl_FragColor.rgb = mix( gl_FragColor.rgb, hzCol, fogFactor );
  }
#endif`;

export const HAZE = true;
