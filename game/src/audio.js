// audio.js — every sound is synthesized, no audio files.
// One clear job: an engine hum that follows the throttle, plus short beeps
// for rings, deliveries and landings. Silent until the player first interacts.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // Engine: two detuned saws through a low-pass, the classic prop drone.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.7;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise whose level follows airspeed.
    const noiseLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
  }

  function beep(freq, dur, type = 'sine', vol = 0.16) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; return muted; },
    update(plane, flying) {
      if (!ctx || muted) return;
      const target = flying ? 0.05 + plane.throttle * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(48 + plane.throttle * 62 + plane.speed * 0.35, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.09, plane.speed * 0.0011) : 0, ctx.currentTime, 0.15);
    },
    ring() { beep(880, 0.12); setTimeout(() => beep(1318, 0.18), 90); },
    delivery() { beep(659, 0.12); setTimeout(() => beep(988, 0.2), 110); },
    touchdown() { beep(523, 0.15, 'triangle', 0.2); setTimeout(() => beep(784, 0.3, 'triangle', 0.2), 130); },
    crash() { beep(110, 0.5, 'square', 0.2); setTimeout(() => beep(65, 0.7, 'square', 0.18), 120); },
    click() { beep(1200, 0.05, 'square', 0.08); },
  };
}
