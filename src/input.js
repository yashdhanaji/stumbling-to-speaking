// Input: one frame-state object from keyboard, touch pad or a test bot. No DOM here.
var G = (globalThis.G ||= {}); // var, not const: browser scripts share one global scope
G.Input = (() => {
  const KEYS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];
  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
    z: 'a', Z: 'a', ' ': 'a', x: 'b', X: 'b', Enter: 'start', Shift: 'select',
  };
  // held / prev: {key: bool}. Returns {key, keyPress} for every key (Press = went down this frame).
  function frame(held, prev) {
    const f = {};
    for (const k of KEYS) { f[k] = !!held[k]; f[k + 'Press'] = !!held[k] && !(prev && prev[k]); }
    return f;
  }
  // stateful helper for the browser and bots: set keys, then poll() once per frame
  function make() {
    const held = {}, prev = {};
    return {
      held,
      set(k, v) { held[k] = !!v; },
      poll() { const f = frame(held, prev); for (const k of KEYS) prev[k] = !!held[k]; return f; },
    };
  }
  return { KEYS, KEYMAP, frame, make };
})();
if (typeof module !== 'undefined') module.exports = G.Input;
