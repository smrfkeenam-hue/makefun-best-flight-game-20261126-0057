// world.js — the valley the game flies over.
// One clear job: build the terrain, runway, rings, towns and sky from a fixed
// seed, and answer "what is at this point" for the flight model and renderer.
// Nothing here touches the canvas or the keyboard.

import { CONFIG } from './config.js';

// A small deterministic PRNG so the world is identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorld() {
  const rand = mulberry32(CONFIG.seed);
  const world = {
    fields: [],   // {x0,z0,x1,z1,color} ground patches
    trees: [],    // {x,z,h} cone trees
    houses: [],   // {x,z,w,roof} little houses
    hills: [],    // {x,z,r,h} distant rounded hills
    clouds: [],   // {x,y,z,s} drifting puffs
    rings: [],    // {x,y,z,r,passed}
    towns: [],    // {x,z,name,delivered}
    runway: { x: 0, z0: 0, z1: CONFIG.runwayLength, width: CONFIG.runwayWidth },
  };

  // Patchwork fields: a quilt of greens and wheat across the valley floor.
  const fieldColors = ['#5d8a3c', '#6b9a44', '#547a35', '#7fae4e', '#c2a95c', '#8aa84f'];
  for (let gx = -6; gx <= 6; gx++) {
    for (let gz = 0; gz < 14; gz++) {
      const w = 190 + rand() * 60;
      const d = 190 + rand() * 60;
      world.fields.push({
        x0: gx * 200 - 100, z0: gz * 200 - 40,
        x1: gx * 200 - 100 + w, z1: gz * 200 - 40 + d,
        color: fieldColors[(gx * 7 + gz * 3 + Math.floor(rand() * 6)) % fieldColors.length],
      });
    }
  }

  // Trees scattered off the runway corridor.
  for (let i = 0; i < 260; i++) {
    const x = (rand() - 0.5) * 2400;
    const z = rand() * 2700 - 100;
    if (Math.abs(x) < 60 && z > -60 && z < CONFIG.runwayLength + 120) continue;
    world.trees.push({ x, z, h: 9 + rand() * 9 });
  }

  // Distant hills ringing the valley.
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    world.hills.push({
      x: side * (1150 + rand() * 700),
      z: 300 + rand() * 2400,
      r: 320 + rand() * 260,
      h: 190 + rand() * 160,
    });
  }

  // Clouds at several heights, spread wide so the sky never feels empty.
  for (let i = 0; i < 26; i++) {
    world.clouds.push({
      x: (rand() - 0.5) * 3600,
      y: 260 + rand() * 260,
      z: rand() * 2800 - 200,
      s: 60 + rand() * 110,
    });
  }

  // The ring course: a gentle slalom down the valley, heights 60–170 m.
  let rx = 0;
  for (let i = 0; i < CONFIG.ringCount; i++) {
    const z = 420 + i * 210;
    rx += (rand() - 0.5) * 260;
    rx = Math.max(-260, Math.min(260, rx));
    world.rings.push({
      x: rx, y: 65 + rand() * 105, z, r: CONFIG.ringRadius, passed: false,
    });
  }

  // Courier towns: three little clusters with a name each.
  const townDefs = [
    { x: -420, z: 700, name: 'MAPLEWICK' },
    { x: 380, z: 1450, name: 'FERNFIELD' },
    { x: -180, z: 2150, name: 'OLD QUAY' },
  ];
  for (const t of townDefs) {
    world.towns.push({ ...t, delivered: false });
    for (let i = 0; i < 9; i++) {
      world.houses.push({
        x: t.x + (rand() - 0.5) * 150,
        z: t.z + (rand() - 0.5) * 150,
        w: 12 + rand() * 10,
        roof: ['#b5543a', '#7a5a3a', '#4a6b8a', '#8a4a3a'][Math.floor(rand() * 4)],
      });
    }
  }

  return world;
}

// Ground height: flat valley floor (0) that rises into the hills' skirts.
export function groundHeightAt(world, x, z) {
  let h = 0;
  for (const hill of world.hills) {
    const dx = x - hill.x;
    const dz = z - hill.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < hill.r) {
      const k = 1 - d / hill.r;
      h += hill.h * k * k;
    }
  }
  return h;
}

// True when the point is over the runway pavement.
export function onRunway(world, x, z) {
  const r = world.runway;
  return Math.abs(x) <= r.width / 2 && z >= r.z0 && z <= r.z1;
}
