import { SRGBColorSpace } from "three";
// THE ONE PLACE that turns simulation coordinates into 3D world units.
//
// The simulation works in flat "screen units": x goes across the road, y goes DOWN the screen, and the world scrolls
// down by `speed` every tick, so things further up the road have a smaller y.
// In 3D: x -> X (left/right), up is Y, and the road runs away from the camera into -Z.
// A car at the bottom of the screen is at Z = 0; the further up the road (smaller y), the more negative Z.
//
// W, H, ROAD_W, AHEAD... are the simulation's globals (declared by the classic scripts in js/), so this file just reads them.

export const SCALE = 0.1; // 1 sim unit = 0.1 world units: a 36-unit car is 3.6 wide, one lane is ~10.7, the road is 32 wide

export const simX = x => (x - W / 2) * SCALE;
export const simZ = y => (y - (H - 100)) * SCALE; // H - 100 is where the player's car starts, so it sits at Z ~ 0

export const roadHalf = () => ROAD_W * SCALE / 2; // half the road width in world units (16)
export const viewAhead = () => AHEAD * SCALE;     // how far up the road things exist, in world units (100)

// the simulation keeps palettes as [r, g, b] 0..255 arrays
export const arrToHex = c => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);

// set a THREE.Color from 0..255 sRGB numbers (times k) without making any garbage
export const setCol = (c, r, g, b, k = 1) => c.setRGB(Math.min(1, r * k / 255), Math.min(1, g * k / 255), Math.min(1, b * k / 255), SRGBColorSpace);
