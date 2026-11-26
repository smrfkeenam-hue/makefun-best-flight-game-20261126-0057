// input.js — keyboard and mouse, nothing else.
// One clear job: turn raw DOM events into a plain control state the flight
// model reads each frame. No game logic lives here.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitch: 0,        // -1 (nose down) .. +1 (nose up), from keys or mouse
    roll: 0,         // -1 (left) .. +1 (right)
    throttleUp: false,
    throttleDown: false,
    mouseSteer: false,
    mouseX: 0,
    mouseY: 0,
    pressed: new Set(), // keys pressed since last frame (edge-triggered actions)
  };

  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys.has(e.code)) input.pressed.add(e.code);
    keys.add(e.code);
  };
  const up = (e) => keys.delete(e.code);
  const blur = () => { keys.clear(); input.mouseSteer = false; };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);

  canvas.addEventListener('mousedown', (e) => {
    input.mouseSteer = true;
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });
  window.addEventListener('mouseup', () => { input.mouseSteer = false; });
  window.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });

  // Recompute the analog axes from whatever is held right now.
  input.poll = () => {
    let pitch = 0;
    let roll = 0;
    if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    if (input.mouseSteer) {
      const rect = canvas.getBoundingClientRect();
      const dx = (input.mouseX - rect.left - rect.width / 2) / (rect.width / 2);
      const dy = (input.mouseY - rect.top - rect.height / 2) / (rect.height / 2);
      roll += Math.max(-1, Math.min(1, dx * 1.4));
      pitch += Math.max(-1, Math.min(1, -dy * 1.2));
    }
    input.pitch = Math.max(-1, Math.min(1, pitch));
    input.roll = Math.max(-1, Math.min(1, roll));
    input.throttleUp = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal') || keys.has('NumpadAdd');
    input.throttleDown = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('Minus') || keys.has('NumpadSubtract');
  };

  // Edge-triggered: true once for the frame the key went down.
  input.wasPressed = (code) => input.pressed.has(code);
  input.endFrame = () => input.pressed.clear();

  return input;
}
