// AI tuning: think = frames between decisions, look = how far ahead it sees (px),
// miss = chance it fails to notice a given car, cooldown = min frames between lane changes,
// greedy = detours for coins when the road is clear, speed = the pace it likes to hold
// Vs CPU: late = how many frames before impact it finally spots a car it failed to notice and swerves (a last-second dodge, sometimes too late),
// push = how far above your speed it will go to get back in the fight, attack = how often its race plan is to take the lead
const DIFFS = {
  easy:   { wander: true, think: 24, look: 120, miss: 0.35, cooldown: 30, greedy: false, speed: 1.9, launch: 1.67, late: 16, push: 0.3, attack: 0.25 },
  medium: { wander: true, think: 14, look: 170, miss: 0.12, cooldown: 18, greedy: true,  speed: 2.5, launch: 2.5, late: 12, push: 0.6, attack: 0.4 },
  hard:   { wander: true, think: 6,  look: 230, miss: 0.02, cooldown: 8,  greedy: true,  speed: 3.1, launch: 3.33, late: 8, push: 0.9, attack: 0.5 },
  impossible: { wander: true, think: 1, look: 400, miss: 0, cooldown: 3, greedy: true, speed: 4.4, plan: true, accel: 0.05, launch: 5, push: 1.3, attack: 0.6 }, // never misses a car, reacts every frame and runs flat out
};
// The title's autopilot (and the demo behind the menus): cruise = its speed on the title (300 km/h), menu = elsewhere; comfort = how close (sim units,
// past touching) a vehicle ahead may come before it moves over; gap = the room it always keeps, nose to tail, past the cars' real 3D size;
// spring = how quickly a lane change happens (smaller = a longer, smoother S-curve); row = the road between
// one demo car and the next (each in a different lane from the one before: see demoRow)
const DEMO_AI = { pilot: true, cruise: 5, menu: 2.8, comfort: 260, gap: 34, spring: 0.062, row: 380 };

// camera views: the first is top-down; the other two are projected 3D road views
const CAMS = [
  { name: "Overhead", desc: "Top-down view of the road" },
  { name: "Chase", desc: "Right behind the car", f: 240, back: 230, h: 218, hor: 150, kx: 0.55 },
  { name: "Cockpit", desc: "Through the driver's eyes", f: 300, back: 8, h: 30, hor: 215, kx: 0.55 },
];

