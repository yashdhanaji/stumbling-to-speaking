// game: the whole game as one deterministic state machine. update(frameInput) per frame; draw(screen) renders it.
var G = (globalThis.G ||= {}); // var, not const: browser scripts share one global scope
G.Game = (() => {
  const gfx = G.gfx, World = G.World, Story = G.Story;
  const { Screen, text, textW, textBig, wrap, box, hud, tileImg, personImg, marker, P } = gfx;
  const { STEPS, STEP_INDEX, IDLE, COLS } = Story;
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const SPEED = 2, TURN = 5, FADE = 10, CUT_FRAMES = 90;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const sfx = n => { if (G.audio) G.audio.play(n); };

  // 3 lines of up to COLS characters per page
  function paginate(t) {
    const lines = wrap(t, COLS), pages = [];
    for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    return pages;
  }
  const newState = () => ({ map: 'office', x: 5, y: 8, dir: 'up', step: 0, got: {}, conf: 15, flags: {}, talk: {} });

  function make() {
    const g = { mode: 'title', s: newState(), t: 0, off: { x: 0, y: 0 }, turn: 0, box: null, queue: [], fade: null, mg: null, cut: null, pending: null, npcDir: {}, save: null, onSave: null, onEnd: null };

    const addConf = n => { g.s.conf = clamp(g.s.conf + n, 0, 100); if (n) sfx(n > 0 ? 'up' : 'down'); };
    const saveNow = () => { if (g.onSave) g.onSave(g.serialize()); };
    function advanceStep() { g.s.step++; g.s.got = {}; saveNow(); }
    const resume = () => { g.mode = 'play'; g.npcDir = {}; };

    // ── scripts: a queue of actions run one after another ─────────────
    function runScript(list) { g.queue = list.slice(); next(); }
    function next() {
      while (g.queue.length) {
        const a = g.queue.shift();
        if (a.say !== undefined) return openSay(a);
        if (a.game) return startGame(a);
        if (a.warp) return startFade({ map: a.warp[0], x: a.warp[1], y: a.warp[2], dir: a.warp[3] || 'down' }, next);
        if (a.cut) return startCut(a.cut);
        if (a.conf) { addConf(a.conf); continue; }
        if (a.when) { g.queue.unshift(...(a.when(g.s) ? a.then : a.else || [])); continue; }
        if (a.fn) { a.fn(g.s); continue; }
        if (a.end) { g.mode = 'end'; sfx('win'); if (g.onEnd) g.onEnd(); return; }
      }
      resume();
    }

    // ── dialogue box with typewriter text ─────────────────────────────
    function openSay(a) { g.box = { who: a.say, pages: paginate(a.text), page: 0, shown: 0 }; g.mode = 'say'; }
    function updateSay(inp) {
      const b = g.box, total = b.pages[b.page].join('').length;
      if (b.shown < total) { b.shown = Math.min(total, b.shown + 2); if (g.t % 3 === 0) sfx('blip'); }
      if (inp.aPress || inp.bPress || inp.startPress) {
        if (b.shown < total) b.shown = total;
        else if (++b.page >= b.pages.length) { g.box = null; next(); } else { b.shown = 0; sfx('select'); }
      }
    }

    // ── mini-games plug in through G.Minigames (absent = skipped) ─────
    function startGame(a) {
      if (!G.Minigames) return next();
      g.mg = G.Minigames.make(a.game, { conf: g.s.conf, flags: g.s.flags, ...(a.opts || {}) });
      g.mode = 'minigame';
    }
    function updateMinigame(inp) {
      g.mg.step(inp);
      if (g.mg.done) { addConf(g.mg.score || 0); g.mg = null; next(); }
    }

    // ── cutscene captions ─────────────────────────────────────────────
    function startCut(c) { g.cut = { frames: c.frames, bonus: c.bonus || 0, i: 0, t: 0 }; g.mode = 'cut'; }
    function updateCut(inp) {
      const c = g.cut; c.t++;
      if ((inp.aPress && c.t > 12) || c.t >= CUT_FRAMES) {
        if (++c.i >= c.frames.length) { addConf(c.bonus); g.cut = null; next(); } else { c.t = 0; sfx('select'); }
      }
    }

    // ── screen transitions (and the move to another map) ──────────────
    function startFade(dest, done) { g.fade = { t: 0, phase: 'out', dest, done }; g.mode = 'fade'; }
    function updateFade() {
      const f = g.fade;
      if (++f.t < FADE) return;
      if (f.phase === 'out') {
        Object.assign(g.s, { map: f.dest.map, x: f.dest.x, y: f.dest.y, dir: f.dest.dir || g.s.dir });
        g.off = { x: 0, y: 0 }; g.npcDir = {}; f.phase = 'in'; f.t = 0; saveNow();
      } else { const d = f.done; g.fade = null; d(); }
    }

    // ── overworld ─────────────────────────────────────────────────────
    const allowed = w => w.needs !== 'never' && g.s.step >= STEP_INDEX[w.needs];
    function say(who, t) { g.queue = []; openSay({ say: who, text: Story.norm(t) }); }
    function tryMove(dir) {
      const [dx, dy] = DIRV[dir], nx = g.s.x + dx, ny = g.s.y + dy, m = g.s.map;
      const w = World.warpAt(m, nx, ny);
      if (w && !allowed(w)) { say('', w.msg); sfx('bump'); return; }
      if (World.blocked(m, nx, ny)) { sfx('bump'); return; }
      g.s.x = nx; g.s.y = ny; g.off = { x: -dx * 16, y: -dy * 16 };
      g.pending = w || null; sfx('step');
    }
    function arrive() {           // finished walking onto a tile
      const w = g.pending; g.pending = null;
      if (!w) return;
      const step = STEPS[g.s.step], from = g.s.map;
      const door = step.type === 'door' && step.warp.map === from && step.warp.x === w.x && step.warp.y === w.y;
      sfx('door');
      startFade({ map: w.to, x: w.tx, y: w.ty, dir: w.face }, () => {
        if (door) { advanceStep(); runScript(step.onEnter || []); } else resume();
      });
    }
    function updatePlay(inp) {
      if (g.off.x || g.off.y) {
        g.off.x -= Math.sign(g.off.x) * SPEED; g.off.y -= Math.sign(g.off.y) * SPEED;
        if (!g.off.x && !g.off.y) arrive();
        return;
      }
      const dir = inp.up ? 'up' : inp.down ? 'down' : inp.left ? 'left' : inp.right ? 'right' : null;
      if (dir) {
        if (g.s.dir !== dir) { g.s.dir = dir; g.turn = TURN; return; }   // turn in place first, like the real thing
        if (g.turn > 0) { g.turn--; return; }
        tryMove(dir); return;
      }
      if (inp.aPress) interact();
    }
    function interact() {
      const [dx, dy] = DIRV[g.s.dir], hit = World.at(g.s.map, g.s.x + dx, g.s.y + dy);
      if (!hit) return;
      const m = World.MAPS[g.s.map], who = (m.npcs.find(n => n.id === hit.id) || { name: '' }).name;
      if (hit.kind === 'npc') g.npcDir[hit.id] = OPP[g.s.dir];
      const step = STEPS[g.s.step];
      sfx('select');
      if (step.type === 'talk' && step.at.map === g.s.map && step.at.id === hit.id) {
        const list = typeof step.script === 'function' ? step.script(g.s) : step.script;
        return runScript([...list, { fn: advanceStep }]);
      }
      if (step.type === 'collect' && step.map === g.s.map && step.items[hit.id] && !g.s.got[hit.id]) {
        const rest = Object.keys(step.items).filter(k => k !== hit.id && !g.s.got[k]);
        const finish = rest.length ? [] : [...(step.after || []), { conf: step.bonus || 0 }, { fn: advanceStep }];
        return runScript([...step.items[hit.id], { fn: () => { g.s.got[hit.id] = true; saveNow(); } }, ...finish]);
      }
      const lines = IDLE[hit.id] || ['...'];
      const n = g.s.talk[hit.id] = (g.s.talk[hit.id] || 0) + 1;
      say(who, lines[(n - 1) % lines.length]);
    }

    // where the glowing "!" goes: the next thing the quest wants you to touch
    function markerTarget() {
      const st = STEPS[g.s.step]; if (!st) return null;
      const find = (map, id) => [...World.MAPS[map].npcs, ...World.MAPS[map].objs].find(o => o.id === id);
      if (st.type === 'talk') { const o = find(st.at.map, st.at.id); return { map: st.at.map, x: o.x, y: o.y, kind: 'talk', id: o.id }; }
      if (st.type === 'collect') { const id = Object.keys(st.items).find(k => !g.s.got[k]); if (!id) return null; const o = find(st.map, id); return { map: st.map, x: o.x, y: o.y, kind: 'talk', id }; }
      return { map: st.warp.map, x: st.warp.x, y: st.warp.y, kind: 'door' };
    }

    // ── game flow ─────────────────────────────────────────────────────
    g.newGame = () => { g.s = newState(); g.off = { x: 0, y: 0 }; g.turn = 0; g.queue = []; g.box = g.mg = g.cut = g.fade = g.pending = null; g.npcDir = {}; g.mode = 'play'; };
    g.serialize = () => ({ v: 1, s: JSON.parse(JSON.stringify(g.s)) });
    g.restore = obj => {
      try {
        const s = obj && obj.s; if (!s || !World.MAPS[s.map]) return false;
        if (!Number.isInteger(s.step) || s.step < 0 || s.step >= STEPS.length) return false;
        const m = World.MAPS[s.map];
        if (!World.inBounds(m, s.x, s.y) || World.blocked(s.map, s.x, s.y) && !World.warpAt(s.map, s.x, s.y)) return false;
        g.newGame(); g.s = { ...newState(), ...s, conf: clamp(+s.conf || 0, 0, 100) };
        return true;
      } catch (e) { return false; }
    };
    g.begin = () => { sfx('select'); if (g.save && g.restore(g.save)) return; g.newGame(); runScript(Story.HINT); };
    g.markerTarget = markerTarget;

    g.update = inp => {
      g.t++;
      switch (g.mode) {
        case 'title': if (inp.selectPress && g.save) { g.save = null; g.newGame(); } else if (inp.startPress || inp.aPress) g.begin(); break;
        case 'play': updatePlay(inp); break;
        case 'say': updateSay(inp); break;
        case 'minigame': updateMinigame(inp); break;
        case 'fade': updateFade(); break;
        case 'cut': updateCut(inp); break;
        case 'end': if (inp.startPress || inp.aPress) { g.mode = 'title'; g.save = null; } break;
      }
    };

    // ── drawing ───────────────────────────────────────────────────────
    function camera(m) {
      const px = g.s.x * 16 + g.off.x, py = g.s.y * 16 + g.off.y, mw = m.w * 16, mh = m.h * 16;
      const cx = mw <= 160 ? -Math.floor((160 - mw) / 2) : clamp(px + 8 - 80, 0, mw - 160);
      let cy = mh <= 144 ? -Math.floor((144 - mh) / 2) : clamp(py + 8 - 72, 0, mh - 144);
      if (g.mode === 'say' && py - cy + 16 > 86) cy = py + 16 - 86;      // keep the player above the dialogue box
      return [cx, cy];
    }
    function drawWorld(scr) {
      const m = World.MAPS[g.s.map], [cx, cy] = camera(m);
      scr.pal = P.INK; scr.clear(0);
      for (let y = Math.max(0, (cy >> 4)); y < Math.min(m.h, ((cy + 144) >> 4) + 1); y++)
        for (let x = Math.max(0, (cx >> 4)); x < Math.min(m.w, ((cx + 160) >> 4) + 1); x++)
          scr.blit(tileImg(m.tiles[y][x], m.floor), x * 16 - cx, y * 16 - cy);
      const walking = g.off.x || g.off.y, pf = walking ? 1 + ((g.t >> 3) & 1) : 0;
      const people = m.npcs.map(n => ({ y: n.y * 16, img: personImg(World.STYLES[n.style], g.npcDir[n.id] || n.dir, 0), x: n.x * 16 }));
      people.push({ y: g.s.y * 16 + g.off.y, img: personImg(World.STYLES.you, g.s.dir, pf), x: g.s.x * 16 + g.off.x });
      people.sort((a, b) => a.y - b.y).forEach(p => scr.blit(p.img, p.x - cx, p.y - cy));
      const mk = g.mode === 'play' || g.mode === 'say' ? markerTarget() : null;
      if (mk && mk.map === g.s.map) marker(scr, mk.x * 16 + 4 - cx, mk.y * 16 - 10 - cy + ((g.t >> 4) & 1) * 2);
      hud(scr, g.s.conf);
      const st = STEPS[g.s.step];
      if (st && st.type === 'collect' && st.map === g.s.map) {
        const all = Object.keys(st.items), n = all.filter(k => g.s.got[k]).length, label = `${n}/${all.length}`;
        scr.pal = P.UI; scr.rect(160 - textW(label) - 6, 0, textW(label) + 6, 11, 0); text(scr, label, 160 - textW(label) - 3, 2, 3);
      }
    }
    function drawSay(scr) {           // box 160x54; 11px of text margin each side, name row, then up to three lines
      const b = g.box; box(scr, 0, 90, 160, 54);
      if (b.who) text(scr, b.who, 11, 98, 1);
      let left = b.shown;
      b.pages[b.page].forEach((line, i) => { const part = line.slice(0, Math.max(0, left)); left -= line.length; text(scr, part, 11, (b.who ? 109 : 104) + i * 10, 0); });
      if (b.shown >= b.pages[b.page].join('').length && (g.t >> 4) & 1) scr.rect(143, 133, 5, 3, 0);   // "more" blip
    }
    function drawTitle(scr) {
      scr.pal = P.TITLE; scr.clear(3);
      scr.rect(0, 0, 160, 3, 0); scr.rect(0, 141, 160, 3, 0);
      textBig(scr, 'TOASTMASTERS', 8, 18, 0, 2);
      text(scr, 'FROM STUMBLING', 38, 44, 1); text(scr, 'TO SPEAKING', 49, 55, 1);
      scr.blit(tileImg('L', '_'), 72, 72); scr.blit(personImg(World.STYLES.you, 'down', 0), 50, 80); scr.blit(personImg(World.STYLES.host, 'down', 0), 94, 80);
      if ((g.t >> 5) & 1) text(scr, 'PRESS START', 49, 104, 0);
      text(scr, 'ARROWS MOVE  Z=A  X=B', 17, 118, 1);
      text(scr, g.save ? 'SHIFT: NEW GAME' : 'ENTER: START', g.save ? 34 : 44, 129, 1);
    }
    function drawCut(scr) {
      scr.pal = P.CUT; scr.clear(0);
      const lines = wrap(g.cut.frames[g.cut.i], 22), y0 = 72 - lines.length * 5;
      lines.forEach((l, i) => text(scr, l, 80 - Math.floor(textW(l) / 2), y0 + i * 10, 3));
      text(scr, `${g.cut.i + 1}/${g.cut.frames.length}`, 130, 134, 1);
    }
    function drawEnd(scr) {
      scr.pal = P.TITLE; scr.clear(3); scr.rect(0, 0, 160, 3, 0); scr.rect(0, 141, 160, 3, 0);
      textBig(scr, 'THE END', 34, 14, 0, 2);
      const label = g.s.flags.ending === 'confident' ? 'ENDING: CONFIDENT' : 'ENDING: STILL GROWING';
      text(scr, label, 80 - Math.floor(textW(label) / 2), 40, 1);
      text(scr, `CONFIDENCE ${g.s.conf}`, 80 - Math.floor(textW(`CONFIDENCE ${g.s.conf}`) / 2), 52, 1);
      wrap(Story.norm('Your next opportunity to speak could be your next opportunity to grow.'), 22).forEach((l, i) => text(scr, l, 80 - Math.floor(textW(l) / 2), 74 + i * 10, 0));
      if ((g.t >> 5) & 1) text(scr, 'PRESS START', 49, 124, 0);
    }
    g.draw = scr => {
      switch (g.mode) {
        case 'title': return drawTitle(scr);
        case 'cut': return drawCut(scr);
        case 'end': return drawEnd(scr);
        case 'minigame': scr.clear(3); g.mg.draw(scr); return hud(scr, g.s.conf);
      }
      drawWorld(scr);
      if (g.mode === 'say') drawSay(scr);
      if (g.mode === 'fade') {
        const p = g.fade.phase === 'out' ? g.fade.t / FADE : 1 - g.fade.t / FADE, h = Math.round(72 * p);
        scr.pal = P.INK; scr.rect(0, 0, 160, h, 0); scr.rect(0, 144 - h, 160, h, 0);
      }
    };
    return g;
  }
  return { make, paginate, newState };
})();
if (typeof module !== 'undefined') module.exports = G.Game;
