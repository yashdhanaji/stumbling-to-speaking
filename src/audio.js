// audio: Game Boy-style square-wave beeps through WebAudio (no files). Browsers need a user gesture first: unlock().
var G = (globalThis.G ||= {}); // var, not const: browser scripts share one global scope
G.audio = (() => {
  let ctx = null, muted = false;
  const SOUNDS = {                       // [frequency Hz, seconds] sequences
    blip: [[880, 0.02]], select: [[660, 0.04], [990, 0.06]], bump: [[110, 0.07]], step: [[220, 0.012]],
    up: [[523, 0.07], [784, 0.1]], down: [[330, 0.08], [196, 0.12]], hit: [[988, 0.05]],
    win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]], door: [[392, 0.06], [294, 0.06], [196, 0.1]],
  };
  function unlock() {
    if (!ctx) { try { ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  function play(name) {
    const seq = SOUNDS[name];
    if (muted || !ctx || !seq) return;
    let t = ctx.currentTime;
    for (const [f, d] of seq) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(name === 'step' || name === 'blip' ? 0.015 : 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + d + 0.01);
      t += d;
    }
  }
  const toggle = () => { muted = !muted; return muted; };
  return { unlock, play, toggle, get muted() { return muted; } };
})();
if (typeof module !== 'undefined') module.exports = G.audio;
