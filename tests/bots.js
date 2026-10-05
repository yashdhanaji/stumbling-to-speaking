// Test bots: play the game through Game.update with synthetic input. Used by check.mjs (Node) and the browser tests.
var G = (globalThis.G ||= {}); // var, not const: browser scripts share one global scope
G.bots = (() => {
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const NB = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  // one frame of overworld input: walk to the next quest target, face it, press A
  function overworld(g, tap) {
    const held = {}, s = g.s, tg = g.markerTarget();
    if (!tg || tg.map !== s.map) return held;
    if (g.off.x || g.off.y) { held[g.lastDir] = true; return held; }             // keep walking until the tile is done
    const World = G.World;
    if (tg.kind === 'door') {
      const p = World.path(s.map, s.x, s.y, [[tg.x, tg.y]]);
      if (p && p.length) { g.lastDir = p[0]; held[p[0]] = true; }
      return held;
    }
    const near = NB.map(([dx, dy]) => [tg.x + dx, tg.y + dy]).filter(([x, y]) => !World.blocked(s.map, x, y));
    if (near.some(([x, y]) => x === s.x && y === s.y)) {
      const want = Object.keys(D).find(k => s.x + D[k][0] === tg.x && s.y + D[k][1] === tg.y);
      if (s.dir !== want) { g.lastDir = want; held[want] = true; } else if (tap) held.a = true;
      return held;
    }
    const p = World.path(s.map, s.x, s.y, near);
    if (p && p.length) { g.lastDir = p[0]; held[p[0]] = true; }
    return held;
  }

  // play until the ending (or maxFrames). mini-game bots plug in via G.bots.minigame(mg, tap, g) when present
  function playToEnd(g, { maxFrames = 200000, idle = false } = {}) {
    const Input = G.Input; let prev = {}, frames = 0;
    for (; frames < maxFrames && !(g.mode === 'end'); frames++) {
      const tap = frames % 2 === 0; let held = {};
      switch (g.mode) {
        case 'title': held = tap ? { start: true } : {}; break;
        case 'say': case 'cut': held = tap ? { a: true } : {}; break;
        case 'play': held = overworld(g, tap); break;
        case 'minigame': held = !idle && G.bots.minigame ? G.bots.minigame(g.mg, tap, g) : {}; break;
      }
      g.update(Input.frame(held, prev)); prev = held;
    }
    return { frames };
  }
  // perfect play for each mini-game: one frame of input. `tap` alternates so every press is a fresh edge.
  function minigame(mg, tap) {
    const held = {}, cur = mg.cur ? mg.cur() : mg;
    if (cur.state === 'intro' || cur.state === 'result') { if (tap) held.a = true; return held; }
    const toward = (have, want, less, more) => { if (have < want) { if (tap) held[more] = true; } else if (have > want) { if (tap) held[less] = true; } };
    switch (cur.name) {
      case 'think': if (cur.cx >= 72 && cur.cx <= 88) held.a = true; break;
      case 'organize': {
        const T = G.Minigames.ORGANIZE_TARGET, i = cur.blocks.findIndex((b, k) => b !== T[k]);
        if (i < 0) break;
        const want = cur.held === null ? i : cur.blocks.indexOf(T[i]);
        if (cur.c === want) { if (tap) held.a = true; } else toward(cur.c, want, 'left', 'right');
        break;
      }
      case 'speak': case 'ahcounter': {
        const w = cur.alive.slice().sort((a, b) => a.x - b.x)[0];
        if (w) { if (cur.lane === w.lane) { if (w.x <= 52 && tap) held.a = true; } else toward(cur.lane, w.lane, 'up', 'down'); }
        break;
      }
      case 'feedback': {
        const nxt = cur.bub.find(b => b.state !== 'done');
        if (nxt) toward(cur.lane, nxt.pts < 0 ? (nxt.lane + 1) % 3 : nxt.lane, 'left', 'right');
        break;
      }
      case 'timercards': if (cur.k < 3 && cur.t >= G.Minigames.MARKS[cur.k] * 6) held.a = true; break;
      case 'rehearse': { const b = cur.beats.find(b => !b.hit); if (b && cur.t >= b.t - 1) held.a = true; break; }
      case 'present':
        if (cur.phase === 'catch') toward(cur.lane, cur.bl, 'left', 'right'); else if (tap) held.b = true;
        break;
      case 'stumble': {                       // best-effort dodge: slide to the lane with no word close by
        const free = [0, 1, 2].filter(l => !cur.words.some(w => w.lane === l && w.x > 12 && w.x < 110));
        const want = free.length ? (free.includes(cur.lane) ? cur.lane : free[0]) : cur.lane;
        toward(cur.lane, want, 'up', 'down');
        break;
      }
    }
    return held;
  }
  return { overworld, playToEnd, minigame };
})();
if (typeof module !== 'undefined') module.exports = G.bots;
