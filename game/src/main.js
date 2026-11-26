// main.js — the game loop and mission logic.
// One clear job: own the game state (menu / flying / paused / ended), run the
// missions and scoring, and call the renderer each frame. It wires together
// config, world, physics, input, audio, render and hud — and nothing else.

import { CONFIG, MISSIONS } from './config.js';
import { buildWorld } from './world.js';
import { createPlane, resetPlane, stepPlane } from './physics.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const input = createInput(canvas);
const audio = createAudio();
const world = buildWorld();
const plane = createPlane();

const game = {
  state: 'menu',           // menu | flying | paused | ended
  mission: MISSIONS[0],
  missionIndex: 0,
  score: 0,
  best: 0,
  elapsed: 0,
  nextRing: 0,
  ringsDone: 0,
  townsDone: 0,
  message: '',
  messageAge: 99,
  endTitle: '',
  endLines: [],
  muted: false,
  startedAt: 0,
};

function showMessage(text) {
  game.message = text;
  game.messageAge = 0;
}

function startMission(index) {
  game.missionIndex = index;
  game.mission = MISSIONS[index];
  game.score = 0;
  game.elapsed = 0;
  game.nextRing = 0;
  game.ringsDone = 0;
  game.townsDone = 0;
  game.message = '';
  game.messageAge = 99;
  world.rings.forEach((r) => { r.passed = false; });
  world.towns.forEach((t) => { t.delivered = false; });
  resetPlane(plane, game.mission.id);
  game.state = 'flying';
  game.startedAt = performance.now();
  audio.unlock();
  audio.click();
  showMessage(`${game.mission.name} — ${game.mission.tagline}`);
}

function finishMission(kind, lines) {
  game.state = 'ended';
  game.endTitle = kind === 'complete' ? 'MISSION COMPLETE' : kind === 'crash' ? 'CRASHED' : 'MISSION OVER';
  const timeBonus = kind === 'complete'
    ? Math.max(0, Math.round((game.mission.par - game.elapsed) * CONFIG.timeBonusRate))
    : 0;
  if (timeBonus > 0) {
    game.score += timeBonus;
    lines.push(`Time bonus: +${timeBonus}`);
  }
  game.endLines = lines;
  if (game.score > game.best) game.best = game.score;
  if (kind === 'crash') audio.crash();
  else if (kind === 'complete') audio.touchdown();
}

function checkRings() {
  const ring = world.rings[game.nextRing];
  if (!ring || ring.passed) return;
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  if (dx * dx + dy * dy + dz * dz < ring.r * ring.r) {
    ring.passed = true;
    game.ringsDone++;
    game.nextRing++;
    game.score += CONFIG.ringPoints;
    audio.ring();
    showMessage(`RING ${game.ringsDone} CLEARED! +${CONFIG.ringPoints}`);
    if (game.ringsDone === CONFIG.ringCount) {
      showMessage('ALL RINGS! Now land on the runway.');
    }
  }
}

function checkTowns() {
  for (const town of world.towns) {
    if (town.delivered) continue;
    const dx = plane.x - town.x;
    const dz = plane.z - town.z;
    if (dx * dx + dz * dz < 70 * 70 && plane.y < 170) {
      town.delivered = true;
      game.townsDone++;
      game.score += CONFIG.townPoints;
      audio.delivery();
      showMessage(`MAIL DELIVERED — ${town.name}! +${CONFIG.townPoints}`);
    }
  }
}

function landingScore() {
  const softness = Math.max(0.4, Math.min(1, 1 - Math.abs(plane.verticalSpeed) / 9));
  const centre = Math.max(0, 1 - Math.abs(plane.x) / (CONFIG.runwayWidth / 2));
  return Math.round(CONFIG.landingMax * softness * centre);
}

function update(dt) {
  game.messageAge += dt;
  if (game.state !== 'flying') return;
  game.elapsed += dt;

  // Edge-triggered keys.
  if (input.wasPressed('KeyP')) { game.state = 'paused'; return; }
  if (input.wasPressed('KeyM')) { game.muted = audio.toggleMute(); }
  if (input.wasPressed('KeyR')) { startMission(game.missionIndex); return; }

  stepPlane(plane, world, input, dt);
  audio.update(plane, true);

  if (plane.crashed) {
    finishMission('crash', [
      plane.crashReason,
      `${game.ringsDone} rings · ${game.townsDone} deliveries`,
      'The valley keeps the wreckage. The insurance does not.',
    ]);
    return;
  }

  if (game.mission.id === 'rings') checkRings();
  if (game.mission.id === 'courier') checkTowns();

  if (plane.landed) {
    if (game.mission.id === 'landing') {
      const pts = landingScore();
      game.score += pts;
      finishMission('complete', [
        `Touchdown ${Math.round(Math.abs(plane.x))} m off the centreline`,
        `Descent ${Math.abs(plane.verticalSpeed).toFixed(1)} m/s — ${pts} landing points`,
      ]);
    } else if (game.mission.id === 'rings' && game.ringsDone === CONFIG.ringCount) {
      finishMission('complete', [
        `All ${CONFIG.ringCount} rings cleared`,
        `Landed safely on runway 26`,
      ]);
    } else if (game.mission.id === 'courier' && game.townsDone === CONFIG.townCount) {
      finishMission('complete', [
        `All ${CONFIG.townCount} towns served`,
        `Landed safely on runway 26`,
      ]);
    } else {
      finishMission('short', [
        game.mission.id === 'rings'
          ? `Landed with ${game.ringsDone} of ${CONFIG.ringCount} rings`
          : `Landed with ${game.townsDone} of ${CONFIG.townCount} deliveries`,
        'The course is still out there. Fly it again.',
      ]);
    }
    return;
  }

  // Out of fuel over nowhere: the glide ends wherever it ends.
  if (plane.fuel <= 0 && !plane.airborne && plane.speed < 1 && plane.y === 0) {
    finishMission('short', ['Out of fuel on the ground.', 'The mail will be late.']);
  }
}

function draw(time) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // The world turns with the bank; the HUD never does.
  ctx.save();
  ctx.translate(W / 2, H * 0.45);
  ctx.rotate(-plane.roll * 0.55);
  ctx.translate(-W / 2, -H * 0.45);
  renderer.drawSky(plane, time);
  renderer.drawHills(plane, world);
  renderer.drawGround(plane, world);
  renderer.drawRunway(plane, world);
  renderer.drawTreesHouses(plane, world);
  // Rings belong to the Ring Run, beacons to the Courier Dash; the landing
  // mission flies a clean final with neither in the way.
  if (game.mission.id === 'rings') renderer.drawRings(plane, world, game.nextRing);
  if (game.mission.id === 'courier') renderer.drawBeacons(plane, world);
  renderer.drawClouds(plane, world);
  ctx.restore();

  if (game.state !== 'menu') renderer.drawPlane(plane, time);

  if (game.state === 'flying' || game.state === 'paused') {
    hud.drawHud({
      plane, mission: game.mission, score: game.score, elapsed: game.elapsed,
      message: game.message, messageAge: game.messageAge,
      nextRing: game.nextRing, ringsDone: game.ringsDone, townsDone: game.townsDone,
    });
  }
  if (game.state === 'paused') hud.drawPaused();
  if (game.state === 'menu') hud.drawMenu(game.missionIndex, game.best);
  if (game.state === 'ended') hud.drawEnd(game.endTitle, game.endLines, game.score, game.best);
}

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// Screenshot scenes (?scene=takeoff|ring|landing|menu): a fixed, good-looking
// state rendered by the game's own code — the same frames a player sees.
function applyScene(scene) {
  const ring = world.rings[3];
  if (scene === 'takeoff') {
    startMission(0);
    plane.throttle = 0.9;
    plane.speed = 32;
    plane.pitch = 0.1;
    plane.z = 60;
  } else if (scene === 'ring') {
    startMission(0);
    world.rings[0].passed = true;
    world.rings[1].passed = true;
    world.rings[2].passed = true;
    game.ringsDone = 3;
    game.nextRing = 3;
    plane.x = ring.x - 30;
    plane.y = ring.y + 6;
    plane.z = ring.z - 300;
    plane.heading = Math.atan2(ring.x - plane.x, ring.z - plane.z);
    plane.speed = 62;
    plane.throttle = 0.7;
    plane.airborne = true;
    game.score = 1500;
    game.elapsed = 47;
    showMessage('RING 4 AHEAD');
  } else if (scene === 'landing') {
    startMission(2);
    plane.x = 10;
    plane.y = 58;
    plane.z = 1350;
    plane.heading = Math.PI;
    plane.speed = 55;
    plane.throttle = 0.5;
    plane.airborne = true;
    plane.pitch = -0.06;
    game.elapsed = 96;
    showMessage('FINAL — RUNWAY 26');
  }
  // In scene mode the frame is frozen and the state stays 'flying': the shot
  // is the state itself, with the live HUD and no pause overlay.
  game.state = scene === 'menu' ? 'menu' : 'flying';
}

function frame(time) {
  const dt = Math.min(0.05, (time - frame.last) / 1000 || 0.016);
  frame.last = time;
  input.poll();
  if (game.state === 'menu') {
    if (input.wasPressed('Digit1')) startMission(0);
    else if (input.wasPressed('Digit2')) startMission(1);
    else if (input.wasPressed('Digit3')) startMission(2);
    else if (input.wasPressed('ArrowUp')) game.missionIndex = (game.missionIndex + 2) % 3;
    else if (input.wasPressed('ArrowDown')) game.missionIndex = (game.missionIndex + 1) % 3;
    else if (input.wasPressed('Enter') || input.wasPressed('Space')) startMission(game.missionIndex);
    audio.unlock();
  } else if (game.state === 'ended') {
    if (input.wasPressed('KeyR')) startMission(game.missionIndex);
    else if (input.wasPressed('KeyM')) game.state = 'menu';
  } else if (game.state === 'paused' && !SCENE_MODE) {
    if (input.wasPressed('KeyP')) game.state = 'flying';
    else if (input.wasPressed('KeyR')) startMission(game.missionIndex);
    else if (input.wasPressed('KeyM')) game.state = 'menu';
  }
  if (!SCENE_MODE) update(dt);
  draw(time);
  input.endFrame();
  requestAnimationFrame(frame);
}
frame.last = 0;

const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');
const SCENE_MODE = scene !== null;
if (SCENE_MODE) applyScene(scene);
requestAnimationFrame(frame);
