import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
globalThis.G = {};
const load = (...files) => files.forEach(f => require(`./src/${f}.js`));

// ── input: edge detection ────────────────────────────────────────────
load('input');
{
  const f = G.Input.frame({ a: true, up: true }, { up: true });
  assert.equal(f.a, true); assert.equal(f.aPress, true);
  assert.equal(f.up, true); assert.equal(f.upPress, false);   // held, not newly pressed
  assert.equal(f.b, false); assert.equal(f.bPress, false);
  assert.equal(G.Input.KEYMAP.z, 'a'); assert.equal(G.Input.KEYMAP.ArrowLeft, 'left');
  console.log('input OK');
}

// ── gfx: framebuffer, font, text box ─────────────────────────────────
load('gfx');
{
  const { Screen, text, textW, wrap, FONT, tileImg, TILES, personImg } = G.gfx;
  const s = new Screen(); s.clear(3);
  s.rect(-5, -5, 10, 10, 0);                       // clipped at the corner
  assert.equal(s.px[0], 0); assert.equal(s.px[5 * 160 + 5], 3);
  s.pixel(200, 200, 1);                            // out of bounds: ignored, no throw
  const t = new Screen(20, 9); t.clear(3); text(t, 'A', 1, 1, 0);
  assert.ok(t.px.some(v => v === 0), 'glyph A draws pixels');
  assert.equal(textW('HI'), 11);
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?'\":-+/()%<>*") assert.ok(FONT[ch], `font glyph '${ch}'`);
  for (const l of wrap('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG AGAIN', 12)) assert.ok(l.length <= 12, `wrap overflow: ${l}`);
  assert.deepEqual(wrap('SUPERCALIFRAGILISTIC', 8), ['SUPERCAL', 'IFRAGILI', 'STIC']);   // long words are broken
  for (const [ch, def] of Object.entries(TILES)) {
    const img = tileImg(ch, '.');
    assert.equal(img.px.length, 256, `tile '${ch}' is 16x16`);
    assert.ok(typeof def.solid === 'boolean', `tile '${ch}' has solid flag`);
  }
  for (const dir of ['up', 'down', 'left', 'right']) for (const fr of [0, 1, 2]) {
    const img = personImg({ hair: 0, hairStyle: 'short', shirt: 1 }, dir, fr);
    assert.ok(img.px.some(v => v !== 255), `person ${dir}/${fr} draws something`);
  }
  console.log('gfx OK');
}

// ── world: maps, collision, warps, NPCs, reachability ────────────────
load('world');
const World = G.World, TILES = G.gfx.TILES;
for (const [id, m] of Object.entries(World.MAPS)) {
  assert.equal(m.tiles.length, m.h, `${id}: height`);
  m.tiles.forEach((row, y) => { assert.equal(row.length, m.w, `${id}: row ${y} width`); for (const ch of row) assert.ok(TILES[ch], `${id}: unknown tile '${ch}'`); });
  assert.ok(TILES[m.floor] && !TILES[m.floor].solid, `${id}: floor tile`);
  const seen = new Set();
  for (const o of [...m.npcs, ...m.objs]) {
    const k = `${o.x},${o.y}`;
    assert.ok(o.x >= 0 && o.y >= 0 && o.x < m.w && o.y < m.h, `${id}/${o.id}: in bounds`);
    assert.ok(!seen.has(k), `${id}/${o.id}: overlaps another object`); seen.add(k);
  }
  for (const n of m.npcs) { assert.ok(!World.solidTile(id, n.x, n.y), `${id}/${n.id}: stands on a solid tile`); assert.ok(World.STYLES[n.style], `${id}/${n.id}: style ${n.style}`); }
  for (const w of m.warps) {
    assert.equal(m.tiles[w.y][w.x], 'D', `${id}: warp at ${w.x},${w.y} must be a door tile`);
    const to = World.MAPS[w.to]; assert.ok(to, `${id}: warp target ${w.to}`);
    assert.ok(!World.blocked(w.to, w.tx, w.ty), `${id}: warp lands on a blocked tile in ${w.to}`);
    assert.ok(w.needs, `${id}: warp at ${w.x},${w.y} needs a step id`);
  }
}
// every NPC/object can be talked to (a reachable tile next to it) and every warp can be reached,
// starting from the tile the player arrives on
const arrivals = { office: [5, 8], corridor: [1, 3], club: [10, 14], pathways: [6, 5], officers: [6, 7] };
for (const [id, m] of Object.entries(World.MAPS)) {
  const [sx, sy] = arrivals[id], reach = World.reach(id, sx, sy);
  for (const o of [...m.npcs, ...m.objs]) {
    const ok = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => reach.has(`${o.x + dx},${o.y + dy}`));
    assert.ok(ok, `${id}/${o.id}: no reachable tile next to it`);
  }
  for (const w of m.warps) assert.ok(reach.has(`${w.x},${w.y}`), `${id}: warp ${w.x},${w.y} unreachable`);
}
assert.equal(World.at('office', 5, 2).id, 'manager'); assert.equal(World.at('office', 0, 0), null);
assert.equal(World.blocked('office', -1, 3), true);                 // out of bounds
assert.equal(World.blocked('office', 5, 2), true);                  // NPC
assert.equal(World.blocked('office', 2, 2), false);
console.log('world OK');

// ── story: text fits the screen, quest steps point at real things ────
load('story');
const Story = G.Story, { STEPS, STEP_INDEX } = Story;
{
  const ids = STEPS.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'step ids are unique');
  const texts = [];
  const walk = list => { for (const a of (typeof list === 'function' ? list({ conf: 0, flags: {} }) : list || [])) { if (a.say !== undefined) texts.push(a.say, a.text); if (a.cut) texts.push(...a.cut.frames); if (a.when) { walk(a.then); walk(a.else); } } };
  for (const st of STEPS) { walk(st.script); walk(st.onEnter); walk(st.after); for (const it of Object.values(st.items || {})) walk(it); }
  for (const lines of Object.values(Story.IDLE)) texts.push(...lines);
  texts.push(...Story.HINT.map(h => h.text));
  for (const w of Object.values(World.MAPS).flatMap(m => m.warps)) texts.push(w.msg);
  for (const t of texts) for (const ch of t) if (ch !== ' ') assert.ok(G.gfx.FONT[ch], `font is missing '${ch}' in: ${t}`);
  for (const t of texts) for (const l of G.gfx.wrap(t, Story.COLS)) assert.ok(l.length <= Story.COLS, `line too long: ${l}`);

  for (const st of STEPS) {
    if (st.type === 'talk') assert.ok(World.MAPS[st.at.map] && [...World.MAPS[st.at.map].npcs, ...World.MAPS[st.at.map].objs].some(o => o.id === st.at.id), `${st.id}: talk target exists`);
    if (st.type === 'collect') {
      const m = World.MAPS[st.map]; assert.ok(m, `${st.id}: map`);
      for (const id of Object.keys(st.items)) assert.ok([...m.npcs, ...m.objs].some(o => o.id === id), `${st.id}: item ${id} exists`);
    }
    if (st.type === 'door') {
      const w = World.warpAt(st.warp.map, st.warp.x, st.warp.y); assert.ok(w, `${st.id}: door warp exists`);
      assert.equal(w.needs, st.id, `${st.id}: its warp needs this step`);
    }
  }
  for (const w of Object.values(World.MAPS).flatMap(m => m.warps)) assert.ok(w.needs === 'never' || STEP_INDEX[w.needs] !== undefined, `warp needs unknown step ${w.needs}`);
  console.log('story OK');
}

// ── game: the whole quest chain plays through headlessly ─────────────
load('game');
require('./tests/bots.js');
{
  const { Game } = G, bots = G.bots;
  // save / restore round trip and validation
  const g0 = Game.make(); g0.newGame(); g0.s.step = 5; g0.s.conf = 42;
  const g1 = Game.make(); assert.equal(g1.restore(JSON.parse(JSON.stringify(g0.serialize()))), true);
  assert.equal(g1.s.step, 5); assert.equal(g1.s.conf, 42); assert.equal(g1.mode, 'play');
  assert.equal(Game.make().restore({ s: { map: 'nowhere', step: 1 } }), false);
  assert.equal(Game.make().restore(null), false);

  // dialogue pagination: 3 lines of 24 columns per page
  const pages = Game.paginate('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG. ' .repeat(4));
  assert.ok(pages.length >= 2 && pages.every(p => p.length <= 3 && p.every(l => l.length <= Story.COLS)));

  // play the whole quest (no mini-games yet: they score 0), must reach the ending with the "still growing" branch
  const g = Game.make(); g.newGame();
  const res = bots.playToEnd(g, { maxFrames: 200000 });
  assert.equal(g.mode, 'end', `quest chain stalled at step ${STEPS[g.s.step] && STEPS[g.s.step].id} in ${g.s.map} (${res.frames} frames)`);
  assert.equal(g.s.step, STEPS.length - 1, 'ended on the finale step');
  assert.equal(g.s.conf, 35, 'no mini-games: 15 + 5 doors + 5 officers + 10 montage');
  assert.equal(g.s.flags.ending, 'growing', 'low Confidence takes the still-growing ending');
  console.log(`quest chain OK (${res.frames} frames, conf ${g.s.conf})`);
}

// ── mini-games: perfect bots score high, idle players score low, both endings stay reachable ─
load('minigames');
{
  const MG = G.Minigames, bots = G.bots, Input = G.Input;
  const run = (name, opts, policy) => {   // play one mini-game to its end with a bot policy
    const mg = MG.make(name, opts || {}); let prev = {}, f = 0;
    for (; f < 6000 && !mg.done; f++) { const held = policy(mg, f % 2 === 0) || {}; mg.step(Input.frame(held, prev)); prev = held; }
    assert.ok(mg.done, `${name}: never finished (stuck in ${mg.state || mg.phase})`);
    return mg;
  };
  const best = (mg, tap) => bots.minigame(mg, tap), idle = () => ({});
  const flags = {};
  const expect = { stumble: [0, 2], topics: [0, 24], feedback: [0, 8], timercards: [0, 15], ahcounter: [0, 6], rehearse: [0, 8], present: [0, 0] };
  for (const [name, [lo, hi]] of Object.entries(expect)) {
    assert.equal(MG.MAX[name], hi, `${name}: declared max`);
    const i = run(name, { flags }, idle), b = run(name, { flags }, best);
    assert.ok(i.score >= lo && i.score <= hi, `${name}: idle score ${i.score} out of range`);
    assert.ok(b.score >= lo && b.score <= hi, `${name}: bot score ${b.score} out of range`);
    if (name === 'stumble') assert.equal(i.score, 0, 'idle player cannot survive the filler words');
    else if (hi > 0) { assert.equal(b.score, hi, `${name}: a perfect bot should max it out (got ${b.score})`); assert.ok(i.score < hi, `${name}: idle must not max it`); }
  }
  assert.equal(flags.breathed, true, 'the presentation bot pressed B to breathe');

  // both Scene 13 branches stay reachable: worst-case path < gate <= best-case path
  let lo = 15, hi = 15;
  for (const st of Story.STEPS) {
    const games = []; const scan = list => { for (const a of (typeof list === 'function' ? list({ conf: 0, flags: {} }) : list || [])) { if (a.game) games.push(a.game); if (a.cut) hi += a.cut.bonus || 0, lo += a.cut.bonus || 0; if (a.when) { scan(a.then); } } };
    scan(st.script); for (const it of Object.values(st.items || {})) scan(it);
    if (st.id === 'finale') continue;                       // the gate itself; nothing after it changes the branch
    for (const n of games) { assert.ok(MG.MAX[n] !== undefined, `story uses unknown mini-game ${n}`); hi += MG.MAX[n]; }
    if (st.type === 'collect') { lo += st.bonus || 0; hi += st.bonus || 0; }
  }
  assert.ok(lo < Story.CONF_GATE && Story.CONF_GATE <= hi, `gate ${Story.CONF_GATE} must lie in (${lo}, ${hi}]`);
  console.log(`minigames OK (confidence range ${lo}..${hi}, gate ${Story.CONF_GATE})`);
}

// ── whole games with the mini-games on: a perfect player and a hopeless one reach different endings ──
{
  const { Game } = G, bots = G.bots;
  const good = Game.make(); good.newGame(); const rg = bots.playToEnd(good);
  assert.equal(good.mode, 'end', 'perfect player reaches the end');
  assert.ok(good.s.conf >= 96, `perfect player Confidence ${good.s.conf}`);
  assert.equal(good.s.flags.ending, 'confident'); assert.equal(good.s.flags.breathed, true);
  const bad = Game.make(); bad.newGame(); const rb = bots.playToEnd(bad, { idle: true });
  assert.equal(bad.mode, 'end', 'hopeless player still reaches the end (nobody gets stuck)');
  assert.ok(bad.s.conf < Story.CONF_GATE, `hopeless player Confidence ${bad.s.conf}`);
  assert.equal(bad.s.flags.ending, 'growing');
  console.log(`full games OK (perfect: ${good.s.conf} confident in ${rg.frames}f; hopeless: ${bad.s.conf} growing in ${rb.frames}f)`);
}

// ── colour: every pixel carries a palette id; palettes are readable ──────────────────────────
{
  const { PALS, P, Screen, TILES, tileImg, personImg, box, hud, text, marker } = G.gfx;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lum = h => { const [r, g, b] = hex(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  assert.ok(PALS.length > 20 && PALS.length < 256, 'a sensible number of palettes');
  PALS.forEach((p, i) => {
    assert.equal(p.length, 4, `palette ${i} has 4 colours`); p.forEach(c => assert.match(c, /^#[0-9a-f]{6}$/i, `palette ${i}: ${c}`));
    if (![P.INK, P.CF_LOW, P.CF_MID, P.CF_HIGH].includes(i)) for (let s = 0; s < 3; s++) assert.ok(lum(p[s]) < lum(p[s + 1]), `palette ${i}: shade ${s} must be darker than shade ${s + 1}`);
  });
  for (const id of [P.UI, P.TITLE, P.CUT]) assert.ok(contrast(PALS[id][0], PALS[id][3]) >= 7, `text palette ${id} is readable`);
  assert.ok(contrast(PALS[P.CUT][3], PALS[P.CUT][0]) >= 7, 'cutscene text is readable');
  // every drawing routine writes valid palette ids
  const s = new Screen(), seen = new Set();
  for (const ch of Object.keys(TILES)) { const t = tileImg(ch, ch === 'a' || ch === 'K' ? '_' : '.'); t.pl.forEach(v => seen.add(v)); }
  for (const st of Object.values(G.World.STYLES)) for (const d of ['up', 'down', 'left', 'right']) personImg(st, d, 1).pl.forEach(v => seen.add(v));
  box(s, 0, 96, 160, 48); hud(s, 10); hud(s, 50); hud(s, 90); marker(s, 10, 10); s.pal = P.UI; text(s, 'HI', 5, 5, 0);
  s.pl.forEach(v => seen.add(v));
  for (const v of seen) assert.ok(v < PALS.length, `palette id ${v} exists`);
  assert.ok(seen.size >= 25, `the art uses many palettes (${seen.size})`);
  // people are individually coloured: every style names real skin/hair/shirt palettes
  for (const [name, st] of Object.entries(G.World.STYLES)) {
    assert.ok(P.SKIN[st.skinTone] !== undefined, `${name}: skinTone`); assert.ok(P.HAIR[st.hairCol] !== undefined, `${name}: hairCol`); assert.ok(P.SHIRT[st.shirtCol] !== undefined, `${name}: shirtCol`);
  }
  // each Pathways door has its own colour
  const doors = '123456'.split('').map(n => tileImg(n, '_').pl.join(','));
  assert.equal(new Set(doors).size, 6, 'six differently coloured doors');
  console.log(`colour OK (${PALS.length} palettes, ${seen.size} in use)`);
}

// ── text layout: nothing touches an edge or a box border, and no two strings overlap ────────────
{
  const { Game } = G, bots = G.bots, MG = G.Minigames, gfx = G.gfx;
  const MOVING = new Set(['UM', 'UH', 'ER', 'LIKE', 'SO', 'ACTUALLY', 'AH']);   // words that fly across the screen
  const log = []; gfx.setTextLog(log);
  // lo..hi = the x range text must stay inside; card = a message card (its own, tighter range) hiding what is behind it
  const audit = (label, lo, hi, card) => {
    const inCard = e => card && e.x >= card.x && e.x + e.w <= card.x + card.w && e.y >= card.y && e.y + 7 <= card.y + card.h;
    const items = log.splice(0).filter(e => !MOVING.has(e.s) && (e.tag === 'card' || !inCard(e)));
    for (const e of items) {
      const [a, b] = e.tag === 'card' ? [card.x + 10, card.x + card.w - 10] : [lo, hi];   // card text keeps 10px from the card border
      if (e.y > 12) assert.ok(e.x >= a && e.x + e.w <= b, `${label}: "${e.s}" spans x ${e.x}..${e.x + e.w}, outside ${a}..${b}`);
      assert.ok(e.y >= 1 && e.y + 7 <= 143, `${label}: "${e.s}" at y ${e.y} is off the screen`);
      if (e.tag === 'card') assert.ok(e.y >= card.y + 6 && e.y + 7 <= card.y + card.h - 6, `${label}: "${e.s}" is too close to the card's top or bottom`);
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const hit = a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + 8 && b.y < a.y + 8;
      assert.ok(!hit, `${label}: "${a.s}" overlaps "${b.s}"`);
    }
  };
  const scr = new gfx.Screen();
  for (const name of Object.keys(MG.MAX)) {
    const mg = MG.make(name, { flags: {} }); let prev = {}, seen = new Set();
    for (let f = 0; f < 9000 && !mg.done; f++) {
      const c = mg.cur ? mg.cur() : mg;
      const at = c.state === 'play' ? [50, 150, 230, 330, 450, 600].includes(c.t) : c.state === 'intro' ? c.t === 15 : c.rt === 22 || c.rt === 60;
      const key = `${c.name}:${c.state}:${c.state === 'result' ? c.rt : c.t}`;
      if (at && !seen.has(key)) { seen.add(key); scr.clear(3); mg.draw(scr); gfx.hud(scr, 40); audit(key, 8, 152, c.card); }
      const held = bots.minigame(mg, f % 2 === 0); mg.step(G.Input.frame(held, prev)); prev = held;
    }
    log.length = 0;
  }
  // every word fits inside its bubble with at least 4px of padding each side
  for (const [game, bubbles] of Object.entries(MG.LAYOUT)) for (const b of bubbles) for (const l of b.lines)
    assert.ok(gfx.textW(l) <= b.w - 2 - 8, `${game}: "${l}" (${gfx.textW(l)}px) is too wide for a ${b.w}px bubble`);
  // dialogue pages: every line of every story text, drawn in the real box
  const g = Game.make(); g.newGame();
  const all = [];
  const gather = list => { for (const a of (typeof list === 'function' ? list({ conf: 0, flags: {} }) : list || [])) { if (a.say !== undefined) all.push(a); if (a.when) { gather(a.then); gather(a.else); } } };
  for (const st of Story.STEPS) { gather(st.script); gather(st.onEnter); gather(st.after); for (const it of Object.values(st.items || {})) gather(it); }
  gather(Story.HINT);
  for (const a of all) {
    g.box = { who: a.say, pages: Game.paginate(a.text), page: 0, shown: 9999 };
    for (g.box.page = 0; g.box.page < g.box.pages.length; g.box.page++) { g.mode = 'say'; g.draw(scr); audit(`dialogue "${a.text.slice(0, 20)}"`, 10, 150); }
  }
  // title, cutscene and ending screens
  g.mode = 'title'; g.t = 40; g.draw(scr); audit('title', 8, 152); g.save = {}; g.draw(scr); audit('title (continue)', 8, 152); g.save = null;
  for (const st of Story.STEPS) for (const a of [].concat(typeof st.script === 'function' ? st.script({ conf: 0, flags: {} }) : st.script || [])) if (a.cut) {
    g.cut = { frames: a.cut.frames, bonus: 0, i: 0, t: 0 }; g.mode = 'cut';
    for (g.cut.i = 0; g.cut.i < a.cut.frames.length; g.cut.i++) { g.draw(scr); audit(`cutscene ${g.cut.i}`, 8, 152); }
  }
  g.mode = 'end'; g.t = 40; g.s.flags.ending = 'growing'; g.draw(scr); audit('ending', 8, 152); g.s.flags.ending = 'confident'; g.draw(scr); audit('ending 2', 8, 152);
  gfx.setTextLog(null);
  console.log('text layout OK (mini-game cards and play screens, dialogue, title, cutscenes, ending)');
}
