'use strict';

// ============================================================
//  AUDIO — Web Audio API synth tones
// ============================================================
G.audio = (function () {
  let actx = null;

  function ensure() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }

  function tone(freq, dur, type, vol, slide) {
    const a = ensure(); if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (slide != null) o.frequency.linearRampToValueAtTime(slide, a.currentTime + dur);
    g.gain.value = vol || 0.18;
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  }

  return {
    ensure,
    ding:  () => tone(880, 0.10, 'triangle', 0.16, 1320),
    big:   () => { tone(523, 0.08, 'square', 0.16, 784); setTimeout(() => tone(880, 0.16, 'square', 0.16, 1175), 70); },
    thud:  () => tone(140, 0.24, 'sawtooth', 0.22, 60),
    swing: () => tone(380, 0.07, 'sine', 0.07, 720),
    land:  () => tone(220, 0.10, 'triangle', 0.10, 160),
    win:   () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.2), i * 110)); },
  };
})();
