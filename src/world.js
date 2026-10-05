// world: the five maps, people styles, collision, warps. Pure data + logic (needs gfx only for tile solidity).
var G = (globalThis.G ||= {}); // var, not const: browser scripts share one global scope
G.World = (() => {
  const TILES = G.gfx.TILES;

  // skinTone 0 (light) .. 3 (dark); hairCol and shirtCol name palettes in gfx. You = Toastmasters blue, Manager = maroon, Host = yellow.
  const STYLES = {
    you:       { hairStyle: 'short', skinTone: 0, hairCol: 'black',  shirtCol: 'navy' },
    manager:   { hairStyle: 'short', skinTone: 2, hairCol: 'grey',   shirtCol: 'maroon', glasses: true, tie: true },
    host:      { hairStyle: 'curly', skinTone: 1, hairCol: 'black',  shirtCol: 'yellow' },
    ttm:       { hairStyle: 'bun',   skinTone: 0, hairCol: 'brown',  shirtCol: 'teal' },
    evaluator: { hairStyle: 'short', skinTone: 3, hairCol: 'black',  shirtCol: 'green', glasses: true },
    tod:       { hairStyle: 'long',  skinTone: 1, hairCol: 'brown',  shirtCol: 'purple' },
    timer:     { hairStyle: 'short', skinTone: 0, hairCol: 'blonde', shirtCol: 'orange' },
    grammarian: { hairStyle: 'bun',  skinTone: 2, hairCol: 'black',  shirtCol: 'gray', glasses: true },
    ahcounter: { hairStyle: 'short', skinTone: 1, hairCol: 'red',    shirtCol: 'teal' },
    geneval:   { hairStyle: 'bald',  skinTone: 3, hairCol: 'black',  shirtCol: 'navy', tie: true },
    mentor:    { hairStyle: 'long',  skinTone: 0, hairCol: 'grey',   shirtCol: 'green' },
    pal:       { hairStyle: 'short', skinTone: 0, hairCol: 'brown',  shirtCol: 'orange' },
    pal2:      { hairStyle: 'long',  skinTone: 1, hairCol: 'black',  shirtCol: 'purple' },
    pal3:      { hairStyle: 'curly', skinTone: 2, hairCol: 'brown',  shirtCol: 'gray' },
    officer1:  { hairStyle: 'short', skinTone: 0, hairCol: 'brown',  shirtCol: 'navy', tie: true },
    officer2:  { hairStyle: 'long',  skinTone: 3, hairCol: 'black',  shirtCol: 'maroon' },
    officer3:  { hairStyle: 'curly', skinTone: 1, hairCol: 'black',  shirtCol: 'yellow' },
    officer4:  { hairStyle: 'bun',   skinTone: 0, hairCol: 'blonde', shirtCol: 'green' },
    officer5:  { hairStyle: 'short', skinTone: 2, hairCol: 'grey',   shirtCol: 'teal', glasses: true },
    officer6:  { hairStyle: 'bald',  skinTone: 1, hairCol: 'black',  shirtCol: 'red' },
    officer7:  { hairStyle: 'short', skinTone: 0, hairCol: 'red',    shirtCol: 'purple', tie: true },
  };

  // tiny map builder: floor everywhere, then walls and furniture placed by rectangle
  function build(w, h, floor, fn) {
    const g = Array.from({ length: h }, () => Array(w).fill(floor));
    const fill = (x, y, ww, hh, c) => { for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) g[j][i] = c; };
    const put = (x, y, c) => { g[y][x] = c; };
    fill(0, 0, w, 2, '#'); fill(0, 0, 1, h, '#'); fill(w - 1, 0, 1, h, '#'); fill(0, h - 1, w, 1, '#');   // two-tile top wall, 1-tile sides/bottom
    fn({ fill, put });
    return g.map(r => r.join(''));
  }
  const npc = (id, x, y, style, name, dir = 'down') => ({ id, x, y, style, name, dir });

  const MAPS = {
    office: {
      w: 12, h: 10, floor: '.',
      tiles: build(12, 10, '.', ({ fill, put }) => {
        for (const x of [2, 5, 8]) put(x, 1, 'W');
        fill(4, 4, 4, 2, 'T'); fill(4, 3, 4, 1, 'c'); fill(4, 6, 4, 1, 'c');
        put(1, 2, 'p'); put(10, 2, 'p'); put(1, 7, 'p'); put(10, 7, 'p');
        put(5, 9, 'D');
      }),
      npcs: [npc('manager', 5, 2, 'manager', 'MANAGER')],
      objs: [],
      warps: [{ x: 5, y: 9, to: 'corridor', tx: 1, ty: 3, needs: 'never', face: 'up', msg: "THE MEETING ISN'T OVER." }],
    },
    corridor: {
      w: 24, h: 7, floor: ',',
      tiles: build(24, 7, ',', ({ fill, put }) => {
        for (const x of [3, 7, 11, 15, 19]) put(x, 1, 'W');
        put(22, 1, 'P'); put(23, 3, 'D');
        put(4, 5, 'p'); put(12, 5, 'p'); put(20, 5, 'p');
      }),
      npcs: [npc('pal1', 8, 3, 'pal', 'COLLEAGUE'), npc('pal2', 13, 2, 'pal2', 'COLLEAGUE', 'left'), npc('pal3', 17, 4, 'pal3', 'COLLEAGUE')],
      objs: [{ id: 'poster', x: 22, y: 1 }],
      warps: [{ x: 23, y: 3, to: 'club', tx: 10, ty: 14, face: 'up', needs: 'enter_club', msg: 'FIND OUT WHAT THE POSTER IS ABOUT FIRST.' }],
    },
    club: {
      w: 20, h: 16, floor: '_',
      tiles: build(20, 16, '_', ({ fill, put }) => {
        for (const x of [6, 9, 12]) put(x, 1, 'W');
        put(3, 1, 'D'); put(16, 1, 'D'); put(10, 15, 'D');
        for (const x of [6, 8, 10, 12, 14]) put(x, 2, 'K');
        fill(1, 6, 6, 3, 'S'); put(3, 6, 'L');
        fill(14, 7, 4, 3, 'r'); put(18, 5, 'b'); put(18, 6, 'b');
        for (let y = 10; y <= 12; y++) for (const x of [6, 7, 8, 12, 13, 14]) put(x, y, 'a');
        put(1, 13, 'p'); put(1, 14, 'p'); put(10, 14, 'm');
      }),
      npcs: [
        npc('host', 9, 13, 'host', 'HOST'), npc('ttm', 4, 7, 'ttm', 'TOPICS MASTER'), npc('evaluator', 16, 8, 'evaluator', 'EVALUATOR'),
        npc('tod', 6, 3, 'tod', 'TOASTMASTER'), npc('timer', 8, 3, 'timer', 'TIMER'), npc('grammarian', 10, 3, 'grammarian', 'GRAMMARIAN'),
        npc('ahcounter', 12, 3, 'ahcounter', 'AH-COUNTER'), npc('geneval', 14, 3, 'geneval', 'GEN EVALUATOR'),
        npc('mentor', 3, 13, 'mentor', 'MENTOR'),
      ],
      objs: [],
      warps: [
        { x: 3, y: 1, to: 'pathways', tx: 6, ty: 5, face: 'up', needs: 'pathways_door', msg: 'NOT YET.' },
        { x: 16, y: 1, to: 'officers', tx: 6, ty: 7, face: 'up', needs: 'officers_door', msg: 'NOT YET.' },
        { x: 10, y: 15, to: 'corridor', tx: 22, ty: 3, face: 'left', needs: 'never', msg: "YOU CAME HERE TO LEARN. STAY!" },
      ],
    },
    pathways: {
      w: 13, h: 7, floor: '_',
      tiles: build(13, 7, '_', ({ put }) => {
        [1, 2, 3, 4, 5, 6].forEach((n, i) => put(1 + i * 2, 1, String(n)));
        put(6, 6, 'D');
      }),
      npcs: [],
      objs: [1, 2, 3, 4, 5, 6].map((n, i) => ({ id: 'door' + n, x: 1 + i * 2, y: 1 })),
      warps: [{ x: 6, y: 6, to: 'club', tx: 3, ty: 2, face: 'down', needs: 'leave_hall', msg: 'OPEN ALL SIX DOORS FIRST.' }],
    },
    officers: {
      w: 12, h: 9, floor: '_',
      tiles: build(12, 9, '_', ({ fill, put }) => { fill(4, 3, 4, 2, 'T'); put(6, 8, 'D'); }),
      npcs: [
        npc('president', 4, 2, 'officer1', 'PRESIDENT'), npc('vpe', 6, 2, 'officer2', 'VP EDUCATION'), npc('vpm', 8, 3, 'officer3', 'VP MEMBERSHIP', 'left'),
        npc('vppr', 3, 3, 'officer4', 'VP PUB RELATIONS', 'right'), npc('secretary', 3, 4, 'officer5', 'SECRETARY', 'right'),
        npc('treasurer', 5, 5, 'officer6', 'TREASURER', 'up'), npc('saa', 7, 5, 'officer7', 'SGT AT ARMS', 'up'),
      ],
      objs: [],
      warps: [{ x: 6, y: 8, to: 'club', tx: 16, ty: 2, face: 'down', needs: 'leave_officers', msg: 'MEET ALL SEVEN FIRST.' }],
    },
  };
  // the room the player returns to for the finale: same office, same manager
  MAPS.office.finale = true;

  const inBounds = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
  function solidTile(id, x, y) { const m = MAPS[id]; return !inBounds(m, x, y) || TILES[m.tiles[y][x]].solid; }
  function at(id, x, y) {
    const m = MAPS[id];
    const n = m.npcs.find(o => o.x === x && o.y === y); if (n) return { kind: 'npc', id: n.id };
    const o = m.objs.find(o => o.x === x && o.y === y); return o ? { kind: 'obj', id: o.id } : null;
  }
  const blocked = (id, x, y) => solidTile(id, x, y) || MAPS[id].npcs.some(n => n.x === x && n.y === y);
  const warpAt = (id, x, y) => MAPS[id].warps.find(w => w.x === x && w.y === y) || null;

  // tiles reachable by walking from (sx, sy); a warp tile is reachable but is not walked through
  function reach(id, sx, sy) {
    const seen = new Set([`${sx},${sy}`]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (warpAt(id, x, y)) continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (!seen.has(k) && !blocked(id, nx, ny)) { seen.add(k); q.push([nx, ny]); }
      }
    }
    return seen;
  }
  // shortest walk (list of directions) from (sx, sy) to any tile in `goals` (array of [x, y]); null if none
  function path(id, sx, sy, goals) {
    const want = new Set(goals.map(g => g.join(',')));
    const prev = new Map([[`${sx},${sy}`, null]]), q = [[sx, sy]];
    const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    while (q.length) {
      const [x, y] = q.shift(), k = `${x},${y}`;
      if (want.has(k)) { const out = []; for (let c = k; prev.get(c); c = prev.get(c).from) out.unshift(prev.get(c).dir); return out; }
      if (warpAt(id, x, y) && !want.has(k)) continue;
      for (const [dir, [dx, dy]] of Object.entries(D)) {
        const nx = x + dx, ny = y + dy, nk = `${nx},${ny}`;
        if (!prev.has(nk) && !blocked(id, nx, ny)) { prev.set(nk, { from: k, dir }); q.push([nx, ny]); }
      }
    }
    return null;
  }
  return { MAPS, STYLES, solidTile, blocked, at, warpAt, reach, path, inBounds };
})();
if (typeof module !== 'undefined') module.exports = G.World;
