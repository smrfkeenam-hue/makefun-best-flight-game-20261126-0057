// hud.js — instruments and screens.
// One clear job: draw the HUD (speed, altitude, heading, fuel, objectives)
// and the menu / results / crash overlays on top of the world. Read-only:
// it never changes game state.

import { MISSIONS } from './config.js';

const TAU = Math.PI * 2;

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 16, 32, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawHud(state) {
    const { plane, mission, score, elapsed, message, messageAge, nextRing, ringsDone, townsDone } = state;
    const W = canvas.width;
    const H = canvas.height;
    const kts = Math.round(plane.speed * 1.944);
    const feet = Math.round(plane.y * 3.281);
    const headingDeg = Math.round(((plane.heading * 180 / Math.PI) % 360 + 360) % 360);

    // --- Top-left: mission and objective ---
    panel(14, 14, 300, 64);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mission.name, 28, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    const objective = mission.id === 'rings'
      ? `Rings ${ringsDone} / 10 — then land`
      : mission.id === 'courier'
        ? `Deliveries ${townsDone} / 3`
        : (plane.landed ? 'Landed — nice work' : 'Land on the runway');
    ctx.fillText(objective, 28, 62);

    // --- Top-right: score and time ---
    panel(W - 214, 14, 200, 64);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE ${score}`, W - 28, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    const mm = Math.floor(elapsed / 60);
    const ss = Math.floor(elapsed % 60).toString().padStart(2, '0');
    ctx.fillText(`TIME ${mm}:${ss}`, W - 28, 62);

    // --- Left: airspeed + throttle ---
    panel(14, H - 128, 150, 114);
    ctx.fillStyle = '#9fc3e8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('AIRSPEED', 28, H - 104);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${kts}`, 28, H - 70);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#cfe0f0';
    ctx.fillText('knots', 78, H - 70);
    // Throttle bar.
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(28, H - 52, 122, 10);
    ctx.fillStyle = plane.fuel > 0 ? '#58d68d' : '#888';
    ctx.fillRect(28, H - 52, 122 * plane.throttle, 10);
    ctx.fillStyle = '#cfe0f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`THR ${Math.round(plane.throttle * 100)}%`, 28, H - 26);

    // --- Right: altitude + vertical speed ---
    panel(W - 164, H - 128, 150, 114);
    ctx.fillStyle = '#9fc3e8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALTITUDE', W - 150, H - 104);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${feet}`, W - 150, H - 70);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#cfe0f0';
    ctx.fillText('ft', W - 96, H - 70);
    const vs = plane.verticalSpeed;
    const arrow = vs > 0.5 ? '▲ climbing' : vs < -0.5 ? '▼ descending' : '— level';
    ctx.fillStyle = vs < -3 ? '#ff9a8a' : '#cfe0f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${arrow} ${Math.abs(Math.round(vs * 3.281))} ft/s`, W - 150, H - 40);
    ctx.fillStyle = '#cfe0f0';
    ctx.fillText(`HDG ${headingDeg.toString().padStart(3, '0')}°`, W - 150, H - 26);

    // --- Bottom centre: heading compass tape ---
    const tapeW = 340;
    const tapeX = (W - tapeW) / 2;
    const tapeY = H - 46;
    panel(tapeX - 10, tapeY - 8, tapeW + 20, 36);
    ctx.save();
    ctx.beginPath();
    ctx.rect(tapeX, tapeY - 8, tapeW, 36);
    ctx.clip();
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let d = -60; d <= 60; d += 5) {
      const deg = ((headingDeg + d) % 360 + 360) % 360;
      const x = tapeX + tapeW / 2 + d * 2.6;
      const major = deg % 45 === 0;
      ctx.strokeStyle = major ? '#fff' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, tapeY + (major ? 2 : 8));
      ctx.lineTo(x, tapeY + 16);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[Math.round(deg / 45) % 8], x, tapeY + 28);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 6, tapeY - 8);
    ctx.lineTo(W / 2 + 6, tapeY - 8);
    ctx.lineTo(W / 2, tapeY + 2);
    ctx.closePath();
    ctx.fill();

    // --- Fuel bar, bottom-left ---
    const fuelW = 170;
    panel(14, H - 172, fuelW + 28, 32);
    ctx.fillStyle = plane.fuel < 20 ? '#ff6b5e' : '#cfe0f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', 28, H - 150);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(78, H - 160, fuelW - 64, 10);
    ctx.fillStyle = plane.fuel < 20 ? '#ff6b5e' : '#58d68d';
    ctx.fillRect(78, H - 160, (fuelW - 64) * plane.fuel / 100, 10);

    // --- Centre crosshair ---
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    const cx = W / 2;
    const cy = H * 0.60;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12);
    ctx.stroke();

    // --- Warnings ---
    ctx.textAlign = 'center';
    if (plane.speed < 26 && plane.airborne && !plane.landed) {
      ctx.fillStyle = Math.floor(Date.now() / 300) % 2 ? '#ff6b5e' : '#ffb0a8';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('⚠ STALL — NOSE DOWN, THROTTLE UP', cx, H * 0.30);
    } else if (plane.y < 30 && plane.verticalSpeed < -3 && plane.airborne && !plane.landed) {
      ctx.fillStyle = '#ff6b5e';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('⚠ PULL UP', cx, H * 0.30);
    }
    if (plane.fuel < 20 && plane.fuel > 0) {
      ctx.fillStyle = '#ffb0a8';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('LOW FUEL', cx, H * 0.34);
    }

    // --- Transient message banner ---
    if (message && messageAge < 2.6) {
      ctx.globalAlpha = Math.min(1, (2.6 - messageAge) / 0.6);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(message, cx, H * 0.20);
      ctx.globalAlpha = 1;
    }
    void nextRing;
  }

  function drawMenu(selected, best) {
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = 'rgba(8, 12, 26, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('SKYLINE COURIER', W / 2, H * 0.20);
    ctx.fillStyle = '#f7ead0';
    ctx.font = '20px sans-serif';
    ctx.fillText('A golden-hour flight game — rings, mail runs and one perfect landing.', W / 2, H * 0.20 + 36);
    MISSIONS.forEach((m, i) => {
      const y = H * 0.36 + i * 92;
      const sel = i === selected;
      if (sel) {
        ctx.fillStyle = 'rgba(255, 217, 74, 0.16)';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 330, y - 34, 660, 72, 12);
        ctx.fill();
        ctx.strokeStyle = '#ffd94a';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = sel ? '#ffd94a' : '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`${i + 1}. ${m.name} — ${m.tagline}`, W / 2, y);
      ctx.fillStyle = '#cfe0f0';
      ctx.font = '16px sans-serif';
      ctx.fillText(m.blurb, W / 2, y + 26);
    });
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '16px sans-serif';
    ctx.fillText('↑ / W pitch up · ↓ / S pitch down · ← → / A D bank · SHIFT throttle up · CTRL throttle down', W / 2, H * 0.70);
    ctx.fillText('Mouse: hold and drag to steer · P pause · M mute · ENTER fly · R restart', W / 2, H * 0.70 + 26);
    if (best > 0) {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`Best score so far: ${best}`, W / 2, H * 0.70 + 62);
    }
    ctx.fillStyle = '#9fb2cc';
    ctx.font = '14px sans-serif';
    ctx.fillText('An original game — no borrowed planes, places or music.', W / 2, H - 24);
  }

  function drawPaused() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = 'rgba(8, 12, 26, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2 - 10);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#cfe0f0';
    ctx.fillText('Press P to keep flying · R to restart · M to mute', W / 2, H / 2 + 28);
  }

  function drawEnd(title, lines, score, best) {
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = 'rgba(8, 12, 26, 0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(title, W / 2, H * 0.30);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.30 + 44 + i * 32));
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`SCORE ${score}`, W / 2, H * 0.30 + 44 + lines.length * 32 + 30);
    if (best > 0) {
      ctx.fillStyle = '#cfe0f0';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Best: ${best}`, W / 2, H * 0.30 + 44 + lines.length * 32 + 62);
    }
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '18px sans-serif';
    ctx.fillText('Press R to fly again · M for menu', W / 2, H * 0.30 + 44 + lines.length * 32 + 104);
  }

  return { drawHud, drawMenu, drawPaused, drawEnd };
}
