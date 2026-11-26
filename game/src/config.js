// config.js — tuning constants for Skyline Courier.
// One clear job: every number the flight model, world and HUD share lives here.
export const CONFIG = {
  // Canvas / camera
  focal: 760,          // perspective focal length in pixels (at 1280x800)
  horizonBase: 0.40,   // horizon height as a fraction of canvas height
  nearPlane: 6,        // metres ahead of the camera below which objects are culled
  farPlane: 2600,      // metres ahead of the camera beyond which objects fade out

  // Flight model (arcade, forgiving)
  maxSpeed: 92,        // m/s at full throttle, level flight
  cruiseSpeed: 62,     // m/s the plane settles toward at 70% throttle
  minFlySpeed: 26,     // m/s — below this the wing stalls and the nose drops
  accelRate: 9,        // m/s^2 gained at full throttle
  dragRate: 0.055,     // 1/s speed bleed toward the throttle's target speed
  pitchRate: 0.55,     // rad/s of pitch authority at full deflection
  rollRate: 1.15,      // rad/s of roll authority
  maxRoll: 1.05,       // rad of bank before the turn saturates
  turnRate: 0.42,      // rad/s of heading change at full bank
  climbFactor: 0.85,   // how much of pitch becomes vertical speed
  gravitySink: 6,      // m/s^2 the nose drops when stalled
  groundEffect: 12,    // metres above ground where lift firms up for landing

  // Fuel and damage
  fuelCapacity: 100,   // units
  fuelBurn: 0.55,      // units/s at full throttle (plus a small idle burn)
  fuelIdleBurn: 0.06,  // units/s at idle
  crashDescent: 4.5,   // m/s of descent that a touchdown can survive
  crashSpeed: 58,      // m/s above which a runway touchdown is a crash

  // World
  runwayLength: 900,   // metres
  runwayWidth: 34,     // metres
  ringRadius: 26,      // metres
  ringCount: 10,       // rings in the Ring Run mission
  townCount: 3,        // courier stops in the Courier Dash mission
  seed: 20261126,      // world-generation seed (same world every run)

  // Scoring
  ringPoints: 500,
  townPoints: 800,
  landingMax: 2000,    // perfect touchdown
  timeBonusRate: 4,     // points per second under par
};

// Mission definitions: same flight engine, three different goals.
export const MISSIONS = [
  {
    id: 'rings',
    name: 'RING RUN',
    tagline: 'Thread all 10 rings, then bring her home.',
    par: 240, // seconds
    blurb: 'Fly the valley course. Each ring is worth 500. Land on the runway to bank a time bonus.',
  },
  {
    id: 'courier',
    name: 'COURIER DASH',
    tagline: 'Three towns, one tank of fuel.',
    par: 210,
    blurb: 'Drop low over each town beacon to deliver the mail. Fuel is the real enemy — mind the throttle.',
  },
  {
    id: 'landing',
    name: 'SUNSET LANDING',
    tagline: 'One perfect touchdown.',
    par: 180,
    blurb: 'Take off, climb out, come back around and grease it on the centreline. Soft and straight wins.',
  },
];
