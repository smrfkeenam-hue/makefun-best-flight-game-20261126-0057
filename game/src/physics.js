// physics.js — the arcade flight model.
// One clear job: given the control state and a time step, move the plane.
// It knows nothing about drawing, missions or scoring — it only flies.

import { CONFIG } from './config.js';
import { groundHeightAt, onRunway } from './world.js';

export function createPlane() {
  return {
    x: 0, y: 0, z: 40,        // metres; y is altitude above the valley floor
    heading: 0,               // rad, 0 = down the runway (+z)
    pitch: 0,                 // rad, positive = nose up
    roll: 0,                  // rad, positive = bank right
    speed: 0,                 // m/s
    throttle: 0,              // 0..1
    fuel: CONFIG.fuelCapacity,
    verticalSpeed: 0,         // m/s, for the HUD and landing checks
    airborne: false,
    crashed: false,
    landed: false,
    crashReason: '',
    prevY: 0,            // altitude at the previous step
    prevAirborne: false, // airborne at the previous step (touchdown detection)
  };
}

// Reset the plane to the start of the runway, ready for takeoff.
export function resetPlane(plane, missionId) {
  plane.x = 0; plane.y = 0; plane.z = 40;
  plane.heading = 0; plane.pitch = 0; plane.roll = 0;
  plane.speed = 0; plane.throttle = 0;
  plane.fuel = CONFIG.fuelCapacity;
  plane.verticalSpeed = 0;
  plane.airborne = false;
  plane.crashed = false;
  plane.landed = false;
  plane.crashReason = '';
  plane.prevY = 0;
  plane.prevAirborne = false;
  // The landing mission starts airborne on the downwind leg.
  if (missionId === 'landing') {
    plane.x = 320; plane.y = 160; plane.z = 1500;
    plane.heading = Math.PI; // flying back toward the runway
    plane.speed = 58; plane.throttle = 0.55;
    plane.airborne = true;
  }
}

export function stepPlane(plane, world, input, dt) {
  if (plane.crashed) return;
  const C = CONFIG;

  // Landed: she rolls out along the runway and stops. Nothing else to do.
  if (plane.landed) {
    plane.speed = Math.max(0, plane.speed - 22 * dt);
    plane.x += Math.sin(plane.heading) * plane.speed * dt;
    plane.z += Math.cos(plane.heading) * plane.speed * dt;
    return;
  }
  // Remember the state before this step moves her: a touchdown only counts
  // when she comes down onto the ground from the air — the frame she
  // rotates, she was still rolling on the pavement, and that is a takeoff.
  plane.prevY = plane.y;
  plane.prevAirborne = plane.airborne;

  // Throttle: Shift spools up, Ctrl spools down; it stays where you leave it.
  if (input.throttleUp) plane.throttle = Math.min(1, plane.throttle + dt * 0.7);
  if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - dt * 0.7);

  // Fuel: the engine drinks with the throttle; empty means a glide.
  const burn = (C.fuelIdleBurn + plane.throttle * C.fuelBurn) * dt;
  plane.fuel = Math.max(0, plane.fuel - burn);
  const engineOn = plane.fuel > 0;

  // Speed: thrust pushes toward the throttle's target speed; drag bleeds
  // the rest off. Full throttle settles at maxSpeed, idle glides to a stop.
  const targetSpeed = engineOn ? plane.throttle * C.maxSpeed : 0;
  if (plane.speed < targetSpeed) {
    plane.speed = Math.min(targetSpeed, plane.speed + C.accelRate * plane.throttle * dt);
  } else if (plane.speed > targetSpeed) {
    plane.speed = Math.max(targetSpeed, plane.speed - 14 * dt);
  }

  // Attitude: pitch and roll ease toward the pilot's input.
  const pitchTarget = input.pitch * 0.42;
  const rollTarget = input.roll * C.maxRoll;
  plane.pitch += (pitchTarget - plane.pitch) * Math.min(1, dt * 3.2);
  plane.roll += (rollTarget - plane.roll) * Math.min(1, dt * 3.6);

  // A bank turns the nose; a steep bank without speed bleeds lift.
  plane.heading += plane.roll * C.turnRate * Math.min(1, plane.speed / C.cruiseSpeed) * dt;

  // Lift: enough speed and the pitch becomes climb; too slow and she sinks.
  // The stall bites whenever she is airborne and slow — near the ground
  // included, or a stalled wing would hover forever two metres up.
  const stalled = plane.speed < C.minFlySpeed;
  let climb = 0;
  if (plane.airborne) {
    climb = Math.sin(plane.pitch) * plane.speed * C.climbFactor;
    if (stalled) climb -= C.gravitySink * (1 - plane.speed / C.minFlySpeed);
    // Ground effect firms the lift up a few metres above the pavement — a
    // cushion that peaks mid-way and fades to nothing at the pavement itself,
    // so a nose-down descent always settles instead of floating forever.
    if (plane.y < C.groundEffect && plane.y > 0) {
      climb += Math.sin((Math.PI * plane.y) / C.groundEffect) * 0.6;
    }
  }
  plane.verticalSpeed = climb;

  // Move along the heading, and up or down with the climb.
  const fx = Math.sin(plane.heading);
  const fz = Math.cos(plane.heading);
  plane.x += fx * plane.speed * dt;
  plane.z += fz * plane.speed * dt;
  plane.y += climb * dt;

  // Rotation: once fast enough on the runway she lifts off.
  if (!plane.airborne) {
    if (plane.speed > 34 && plane.pitch > 0.06) plane.airborne = true;
    plane.y = 0;
  }

  // Terrain: the ground is a hard stop everywhere except a good landing.
  // Only a descent from the air counts: the frame she rotates, she was
  // still rolling on the pavement, and that is a takeoff, not a touchdown.
  const ground = groundHeightAt(world, plane.x, plane.z);
  if (plane.y <= ground) {
    plane.y = ground;
    if (plane.airborne && plane.prevAirborne) {
      const overRunway = ground === 0 && onRunway(world, plane.x, plane.z);
      const softEnough = plane.verticalSpeed > -C.crashDescent;
      const slowEnough = plane.speed < C.crashSpeed;
      if (overRunway && softEnough && slowEnough) {
        plane.landed = true;
      } else {
        plane.crashed = true;
        plane.crashReason = overRunway
          ? (softEnough ? 'Too fast for the runway' : 'Slammed into the runway')
          : 'Flew into the ground';
      }
    } else if (plane.throttle < 0.15) {
      // Parked or taxiing with the engine at idle: she slows to a stop.
      plane.speed = Math.max(0, plane.speed - 22 * dt);
      plane.pitch = 0;
      plane.roll = 0;
      if (plane.speed < 1) plane.airborne = false;
    }
    // At takeoff power on the runway there is no braking: the roll builds speed.
  }

  // The valley ends: turning back is the pilot's problem, the wall is not.
  if (Math.abs(plane.x) > 1500 || plane.z > 2900 || plane.z < -400) {
    plane.heading += Math.PI * dt * 0.6; // a gentle nudge back toward home
  }
}
