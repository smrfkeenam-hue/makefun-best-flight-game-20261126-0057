// render.js — everything the eye sees.
// One clear job: draw the sky, terrain, plane and HUD on the canvas, plus the
// menu and results overlays. It never changes game state.

import { CONFIG, MISSIONS } from './config.js';
import { groundHeightAt } from './world.js';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;

  function resize(w, h) {
    W = w; H = h;
    canvas.width = w;
    canvas.height = h;
  }

  // Camera sits just behind and above the plane, looking down the heading.
  function camera(plane) {
    const fx = Math.sin(plane.heading);
    const fz = Math.cos(plane.heading);
    return {
      x: plane.x - fx * 16,
      z: plane.z - fz * 16,
      y: plane.y + 4,
      sinH: fx,
      cosH: fz,
    };
  }

  function horizonY(plane) {
    return H * CONFIG.horizonBase - plane.pitch * 620;
  }

  // Project a world point to the screen. Null when behind the camera.
  function project(cam, horizon, wx, wy, wz) {
    const dx = wx - cam.x;
    const dz = wz - cam.z;
    const forward = dx * cam.sinH + dz * cam.cosH;
    if (forward < CONFIG.nearPlane) return null;
    const lateral = dx * cam.cosH - dz * cam.sinH;
    const scale = CONFIG.focal / forward;
    return {
      x: W / 2 + lateral * scale,
      y: horizon + (cam.y - wy) * scale,
      scale,
      depth: forward,
    };
  }

  function fade(depth) {
    // Far objects melt into the haze.
    return Math.max(0, Math.min(1, 1.25 - depth / CONFIG.farPlane));
  }

  function drawSky(plane, time) {
    const horizon = horizonY(plane);
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 1));
    sky.addColorStop(0, '#24355e');
    sky.addColorStop(0.45, '#5d6fa3');
    sky.addColorStop(0.8, '#e8823f');
    sky.addColorStop(1, '#f7b267');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Math.max(horizon, 1));
    // Low sun, drifting slowly with the heading so the light feels real.
    const sunX = W * 0.72 - plane.heading * 120;
    const sunY = horizon - 46 + Math.sin(time * 0.0001) * 4;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 190, 110, 0.55)');
    glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = '#ffedbe';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, TAU);
    ctx.fill();
  }

  function drawGround(plane, world) {
    const horizon = horizonY(plane);
    const cam = camera(plane);
    // The valley floor below the horizon.
    const g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, '#7a9a4a');
    g.addColorStop(1, '#3d5c26');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, W, H - horizon);

    // Patchwork fields, nearest first so nearer paint over farther.
    const fields = world.fields
      .map((f) => ({ f, p0: project(cam, horizon, f.x0, 0, f.z0), p1: project(cam, horizon, f.x1, 0, f.z0), p2: project(cam, horizon, f.x1, 0, f.z1), p3: project(cam, horizon, f.x0, 0, f.z1) }))
      .filter((o) => o.p0 && o.p1 && o.p2 && o.p3)
      .sort((a, b) => b.p0.depth - a.p0.depth);
    for (const { f, p0, p1, p2, p3 } of fields) {
      ctx.globalAlpha = 0.85 * fade(p0.depth);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Faint distance grid, for speed sensation.
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let z = Math.floor((cam.z + 40) / 200) * 200; z < cam.z + 2400; z += 200) {
      const a = project(cam, horizon, -1200, 0, z);
      const b = project(cam, horizon, 1200, 0, z);
      if (a && b) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (let x = -1200; x <= 1200; x += 200) {
      const a = project(cam, horizon, x, 0, cam.z + 40);
      const b = project(cam, horizon, x, 0, cam.z + 2400);
      if (a && b) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }

  function drawHills(plane, world) {
    const horizon = horizonY(plane);
    const cam = camera(plane);
    for (const hill of world.hills) {
      const p = project(cam, horizon, hill.x, 0, hill.z);
      if (!p) continue;
      const w = hill.r * p.scale * 2;
      const h = hill.h * p.scale;
      if (w < 4) continue;
      ctx.globalAlpha = 0.9 * fade(p.depth);
      ctx.fillStyle = '#4a6b8f';
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2, p.y + 2);
      ctx.quadraticCurveTo(p.x, p.y - h, p.x + w / 2, p.y + 2);
      ctx.closePath();
      ctx.fill();
      // Snow on the high ones.
      if (hill.h > 280) {
        ctx.fillStyle = 'rgba(255,250,240,0.85)';
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.14, p.y - h * 0.72);
        ctx.quadraticCurveTo(p.x, p.y - h, p.x + w * 0.14, p.y - h * 0.72);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRunway(plane, world) {
    const horizon = horizonY(plane);
    const cam = camera(plane);
    const r = world.runway;
    const hw = r.width / 2;
    // Work in camera space so the strip clips correctly whatever way the
    // plane faces: a corner behind the lens is pulled to the near plane
    // instead of hiding the whole runway.
    const toScreen = (wx, wz) => {
      const dx = wx - cam.x;
      const dz = wz - cam.z;
      const fwd = Math.max(dx * cam.sinH + dz * cam.cosH, CONFIG.nearPlane + 1);
      const lat = dx * cam.cosH - dz * cam.sinH;
      const scale = CONFIG.focal / fwd;
      return { x: W / 2 + lat * scale, y: horizon + cam.y * scale, scale };
    };
    const corners = [
      toScreen(-hw, r.z0), toScreen(hw, r.z0),
      toScreen(hw, r.z1), toScreen(-hw, r.z1),
    ];
    if (corners.some((c) => !c)) return;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
    // Edge lines and centreline dashes.
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y); ctx.lineTo(corners[3].x, corners[3].y);
    ctx.moveTo(corners[1].x, corners[1].y); ctx.lineTo(corners[2].x, corners[2].y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(245,245,245,0.9)';
    ctx.lineWidth = 3;
    for (let z = r.z0 + 40; z < r.z1 - 20; z += 90) {
      const a = project(cam, horizon, 0, 0, z);
      const b = project(cam, horizon, 0, 0, z + 45);
      if (a && b) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    // Threshold bars at both ends.
    for (const z of [r.z0 + 12, r.z1 - 12]) {
      const a = project(cam, horizon, -hw + 3, 0, z);
      const b = project(cam, horizon, hw - 3, 0, z);
      if (a && b) {
        ctx.strokeStyle = '#ffd94a';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTreesHouses(plane, world) {
    const horizon = horizonY(plane);
    const cam = camera(plane);
    for (const t of world.trees) {
      const p = project(cam, horizon, t.x, 0, t.z);
      if (!p) continue;
      const h = t.h * p.scale;
      if (h < 2) continue;
      ctx.globalAlpha = fade(p.depth);
      ctx.fillStyle = '#2c4d22';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h);
      ctx.lineTo(p.x - h * 0.32, p.y);
      ctx.lineTo(p.x + h * 0.32, p.y);
      ctx.closePath();
      ctx.fill();
    }
    for (const hs of world.houses) {
      const p = project(cam, horizon, hs.x, 0, hs.z);
      if (!p) continue;
      const w = hs.w * p.scale;
      const h = w * 0.8;
      if (w < 2) continue;
      ctx.globalAlpha = fade(p.depth);
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(p.x - w / 2, p.y - h, w, h);
      ctx.fillStyle = hs.roof;
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2 - 1, p.y - h);
      ctx.lineTo(p.x, p.y - h * 1.55);
      ctx.lineTo(p.x + w / 2 + 1, p.y - h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(plane, world) {
    const horizon = horizonY(plane);
    const cam = camera(plane);
    ctx.fillStyle = 'rgba(255,244,230,0.85)';
    for (const c of world.clouds) {
      const p = project(cam, horizon, c.x, c.y, c.z);
      if (!p) continue;
      const s = c.s * p.scale;
      if (s < 3) continue;
      ctx.globalAlpha = 0.75 * fade(p.depth);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.38, 0, 0, TAU);
      ctx.ellipse(p.x - s * 0.5, p.y + s * 0.08, s * 0.6, s * 0.3, 0, 0, TAU);
      ctx.ellipse(p.x + s * 0.5, p.y + s * 0.08, s * 0.6, s * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(plane, world, nextRing) {
    const horizon = horizonY(plane);
    const cam = camera(plane);
    world.rings.forEach((ring, i) => {
      const p = project(cam, horizon, ring.x, ring.y, ring.z);
      if (!p) return;
      const rx = ring.r * p.scale;
      const ry = rx * 0.94;
      if (rx < 2) return;
      const isNext = i === nextRing;
      const color = ring.passed ? '#58d68d' : isNext ? '#ffd94a' : '#59c2e8';
      ctx.globalAlpha = ring.passed ? 0.35 : 0.95 * fade(p.depth);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, rx * 0.09);
      ctx.shadowColor = color;
      ctx.shadowBlur = isNext ? 22 : 8;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (isNext) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(13, rx * 0.28)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${i + 1}`, p.x, p.y - ry - 10);
      }
    });
    ctx.globalAlpha = 1;
  }

  function drawBeacons(plane, world) {
    const horizon = horizonY(plane);
    const cam = camera(plane);
    for (const town of world.towns) {
      if (town.delivered) continue;
      const p = project(cam, horizon, town.x, 0, town.z);
      if (!p) continue;
      const w = 26 * p.scale;
      if (w < 2) return;
      // A column of light the pilot can spot from miles out.
      const beam = ctx.createLinearGradient(0, p.y - 320 * p.scale, 0, p.y);
      beam.addColorStop(0, 'rgba(255, 217, 74, 0)');
      beam.addColorStop(1, 'rgba(255, 217, 74, 0.5)');
      ctx.fillStyle = beam;
      ctx.fillRect(p.x - w / 2, p.y - 320 * p.scale, w, 320 * p.scale);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 46 * p.scale - 14);
      ctx.lineTo(p.x + 12, p.y - 46 * p.scale);
      ctx.lineTo(p.x, p.y - 46 * p.scale + 14);
      ctx.lineTo(p.x - 12, p.y - 46 * p.scale);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(12, 15 * p.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(town.name, p.x, p.y - 46 * p.scale - 24);
    }
  }

  // The plane itself, seen from the chase camera: cream fuselage, red wings.
  function drawPlane(plane, time) {
    const cx = W / 2;
    const cy = H * 0.60;
    const s = 1.0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.roll * 0.9);
    // Propeller blur.
    const propSpin = (time * 0.02) % TAU;
    ctx.fillStyle = 'rgba(200,200,210,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, -6 * s, 7 * s, 46 * s, propSpin * 0.3, 0, TAU);
    ctx.fill();
    // Wings.
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-14 * s, 2 * s); ctx.lineTo(-86 * s, 16 * s); ctx.lineTo(-80 * s, 26 * s); ctx.lineTo(-10 * s, 12 * s);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14 * s, 2 * s); ctx.lineTo(86 * s, 16 * s); ctx.lineTo(80 * s, 26 * s); ctx.lineTo(10 * s, 12 * s);
    ctx.closePath(); ctx.fill();
    // Tailplane.
    ctx.fillStyle = '#a93226';
    ctx.beginPath();
    ctx.moveTo(-8 * s, 34 * s); ctx.lineTo(-34 * s, 44 * s); ctx.lineTo(-30 * s, 50 * s); ctx.lineTo(-6 * s, 40 * s);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8 * s, 34 * s); ctx.lineTo(34 * s, 44 * s); ctx.lineTo(30 * s, 50 * s); ctx.lineTo(6 * s, 40 * s);
    ctx.closePath(); ctx.fill();
    // Fuselage, tapering toward the tail.
    const fus = ctx.createLinearGradient(-12, 0, 12, 0);
    fus.addColorStop(0, '#f7ead0');
    fus.addColorStop(0.5, '#fdf6e3');
    fus.addColorStop(1, '#f7ead0');
    ctx.fillStyle = fus;
    ctx.beginPath();
    ctx.moveTo(-13 * s, -14 * s);
    ctx.quadraticCurveTo(-15 * s, 18 * s, -7 * s, 46 * s);
    ctx.lineTo(7 * s, 46 * s);
    ctx.quadraticCurveTo(15 * s, 18 * s, 13 * s, -14 * s);
    ctx.quadraticCurveTo(0, -22 * s, -13 * s, -14 * s);
    ctx.closePath();
    ctx.fill();
    // Canopy glint.
    ctx.fillStyle = 'rgba(90,140,200,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -2 * s, 7 * s, 11 * s, 0, 0, TAU);
    ctx.fill();
    // Fin with the registration.
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-2 * s, 30 * s); ctx.lineTo(-3 * s, 52 * s); ctx.lineTo(3 * s, 52 * s); ctx.lineTo(2 * s, 30 * s);
    ctx.closePath(); ctx.fill();
    // Navigation lights.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(-84 * s, 21 * s, 3 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#34c759';
    ctx.beginPath(); ctx.arc(84 * s, 21 * s, 3 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  return { resize, drawSky, drawGround, drawHills, drawRunway, drawTreesHouses, drawClouds, drawRings, drawBeacons, drawPlane, project, camera, horizonY };
}
