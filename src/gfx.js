// gfx: a 160x144 framebuffer of shade indices (0 darkest .. 3 lightest), a 5x7 bitmap font,
// tiles and people drawn from rectangles. No DOM, so it renders the same in Node and the browser.
var G = (globalThis.G ||= {}); // var, not const: browser scripts share one global scope
G.gfx = (() => {
  const W = 160, H = 144, T = 16, CLEAR = 255;

  // ── palettes: like the Game Boy Color, every tile, person and screen picks one of several 4-colour palettes ──
  // each palette is darkest -> lightest; shade 0 is outline/text, shade 3 is background/highlight
  const PALS = [], P = {};
  const pal = (name, colors) => { P[name] = PALS.length; PALS.push(colors); return P[name]; };
  pal('UI',    ['#1b1b3a', '#4a4e8c', '#c9d1ee', '#fbf7ea']);   // dialogue boxes, text: navy on cream
  pal('INK',   ['#161616', '#161616', '#161616', '#161616']);   // outlines, void
  pal('TITLE', ['#772432', '#4a4e8c', '#c9d1ee', '#fbf7ea']);   // title / ending: Toastmasters maroon on cream
  pal('CUT',   ['#1b1b3a', '#6a6fb0', '#c9d1ee', '#fbf7ea']);   // cutscene captions
  pal('MARK',  ['#7a1010', '#c62828', '#ffd23a', '#fff4b0']);   // the "!" marker
  pal('CF_LOW',  ['#1b1b3a', '#4a4e8c', '#c9d1ee', '#ef5350']); // Confidence bar: red, amber, green as it grows
  pal('CF_MID',  ['#1b1b3a', '#4a4e8c', '#c9d1ee', '#ffc83a']);
  pal('CF_HIGH', ['#1b1b3a', '#4a4e8c', '#c9d1ee', '#7be06b']);
  // rooms and furniture
  pal('FLOOR_O', ['#3b4a63', '#6f86a6', '#b5c8de', '#e4eef7']);  // office: cool blue-grey
  pal('WOOD',    ['#5a3a1e', '#9a6a3a', '#d2a366', '#f2d9a6']);  // club room: warm wood
  pal('TEAL',    ['#1f4a47', '#3f8a82', '#9ad0c4', '#e1f4ec']);  // corridor
  pal('BRICK',   ['#4a1f26', '#8a3a40', '#c0645a', '#e8a07e']);
  pal('SKY',     ['#1d4e89', '#4a8fd0', '#9ed0f2', '#e6f6ff']);
  pal('TABLE',   ['#3a2210', '#6e4524', '#a8733a', '#d9a566']);
  pal('SEAT_R',  ['#3a0f18', '#7a2432', '#b8485a', '#e6909a']);
  pal('SEAT_B',  ['#0f2a45', '#1f5a8a', '#4a90c8', '#9ad0f0']);
  pal('LEAF',    ['#16401e', '#2e7d32', '#6cc060', '#b8f090']);
  pal('POT',     ['#4a2216', '#8a4a2e', '#c47a50', '#e8b088']);
  pal('DOOR',    ['#2a1a10', '#5a3a22', '#8a5a32', '#c08a52']);
  pal('PAPER',   ['#2a2a2a', '#6a6a6a', '#d8d0b8', '#fbf6e4']);
  pal('RUG',     ['#4a0f1e', '#772432', '#c0506a', '#f2c2a0']);
  pal('STAGE',   ['#5a4a1e', '#a58a2e', '#e0c04a', '#f7e58a']);
  pal('GOLD',    ['#6a4a00', '#b08a1a', '#f2df74', '#fff4b0']);
  pal('MAT',     ['#33261a', '#6a4a2a', '#9a7a4a', '#c8aa72']);
  // six Pathways doors, six colours
  const DOORS = [
    pal('DOOR1', ['#001a2a', '#004165', '#2a7aa8', '#8ac8e8']), pal('DOOR2', ['#2a0a10', '#772432', '#b84a5a', '#e8a0a8']),
    pal('DOOR3', ['#7a6a10', '#f2df74', '#f8eca0', '#fff8d0']), pal('DOOR4', ['#0f3a1a', '#2e7d32', '#6cc060', '#b8f090']),
    pal('DOOR5', ['#4a0f0f', '#c62828', '#ef6a5a', '#ffb8a8']), pal('DOOR6', ['#4a5252', '#a9b2b1', '#c8d0cf', '#e8eeed']),
  ];
  // people: skin tone, hair colour, shirt colour (shirt shade 1 is the brand colour)
  P.SKIN = [
    pal('SKIN0', ['#4a2a1a', '#a8643c', '#e0a070', '#f8d0a8']), pal('SKIN1', ['#3a1f10', '#8a4a28', '#c47a48', '#e8a878']),
    pal('SKIN2', ['#2a150a', '#6a3a1a', '#a0602e', '#c88850']), pal('SKIN3', ['#1a0e08', '#4a2810', '#7a4420', '#a8683c']),
  ];
  P.HAIR = {
    black: pal('HAIR_BLACK', ['#0c0c0c', '#1f1f1f', '#383838', '#555555']), brown: pal('HAIR_BROWN', ['#2a160a', '#4a2a14', '#6e4426', '#946a3e']),
    grey: pal('HAIR_GREY', ['#555555', '#8c8c8c', '#b8b8b8', '#e0e0e0']), red: pal('HAIR_RED', ['#5a1a0a', '#a03a1a', '#d4622a', '#f09050']),
    blonde: pal('HAIR_BLONDE', ['#6a5a1a', '#b09a3a', '#e0c860', '#f6e8a0']),
  };
  P.SHIRT = {
    navy: DOORS[0], maroon: DOORS[1], yellow: DOORS[2], green: DOORS[3], red: DOORS[4], gray: DOORS[5],
    teal: pal('SHIRT_TEAL', ['#1f4a47', '#3f8a82', '#9ad0c4', '#e1f4ec']), purple: pal('SHIRT_PURPLE', ['#2a1a4a', '#5a3a9a', '#9a7ad0', '#d0c0f0']),
    orange: pal('SHIRT_ORANGE', ['#4a2000', '#c05a10', '#f09040', '#ffd0a0']),
  };
  P.DOORS = DOORS;
  // mini-game backdrops (shade 3 is the playfield) and word / bubble colours
  pal('G_STUMBLE', ['#3a0f18', '#8a3a4a', '#e0a0a8', '#fbe4e0']); pal('G_THINK', ['#0f2a45', '#2a6a9a', '#a8d0ee', '#eef8ff']);
  pal('G_ORG', ['#0f3a2a', '#2a8a62', '#a0e0c0', '#eefcf4']); pal('G_SWAT', ['#2a1a4a', '#6a4aa8', '#c8b8f0', '#f4eeff']);
  pal('G_FEED', ['#16401e', '#3a8a3a', '#b0e0a0', '#f2fcea']); pal('G_TIMER', ['#4a2a00', '#b06a10', '#f0c070', '#fff6dc']);
  pal('G_REH', ['#1f4a47', '#3f8a82', '#9ad0c4', '#e8f8f2']); pal('G_PRES', ['#001a2a', '#004165', '#9ac0dc', '#f4f8ff']);
  pal('WORD', ['#5a0f0f', '#a02020', '#e05050', '#fff0f0']);
  pal('GOODB', ['#0f3a1a', '#2e7d32', '#6cc060', '#e8fbe0']); pal('BADB', ['#4a0f0f', '#c62828', '#ef6a5a', '#ffe4e0']);

  // a framebuffer: shade (0..3) plus palette id per pixel. Drawing uses the current palette, scr.pal.
  class Screen {
    constructor(w = W, h = H, fill = 3) { this.w = w; this.h = h; this.pal = 0; this.px = new Uint8Array(w * h).fill(fill); this.pl = new Uint8Array(w * h); }
    clear(s = 3) { this.px.fill(s); this.pl.fill(this.pal); }
    pixel(x, y, s) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) { const i = y * this.w + x; this.px[i] = s; this.pl[i] = this.pal; } }
    rect(x, y, w, h, s) {
      const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
      for (let j = y0; j < y1; j++) { this.px.fill(s, j * this.w + x0, j * this.w + x1); this.pl.fill(this.pal, j * this.w + x0, j * this.w + x1); }
    }
    frame(x, y, w, h, s) { this.rect(x, y, w, 1, s); this.rect(x, y + h - 1, w, 1, s); this.rect(x, y, 1, h, s); this.rect(x + w - 1, y, 1, h, s); }
    blit(img, x, y, flip = false) {     // copies shade and palette, so images keep their own colours
      for (let j = 0; j < img.h; j++) for (let i = 0; i < img.w; i++) {
        const k = j * img.w + (flip ? img.w - 1 - i : i), v = img.px[k];
        if (v === CLEAR) continue;
        const px = x + i, py = y + j;
        if (px >= 0 && py >= 0 && px < this.w && py < this.h) { this.px[py * this.w + px] = v; this.pl[py * this.w + px] = img.pl[k]; }
      }
    }
  }

  // ── font: 5x7, rows top to bottom, '1' = ink ───────────────────────
  const GLYPHS = {
    A: '01110/10001/10001/11111/10001/10001/10001', B: '11110/10001/10001/11110/10001/10001/11110',
    C: '01110/10001/10000/10000/10000/10001/01110', D: '11110/10001/10001/10001/10001/10001/11110',
    E: '11111/10000/10000/11110/10000/10000/11111', F: '11111/10000/10000/11110/10000/10000/10000',
    G: '01110/10001/10000/10111/10001/10001/01111', H: '10001/10001/10001/11111/10001/10001/10001',
    I: '01110/00100/00100/00100/00100/00100/01110', J: '00111/00010/00010/00010/00010/10010/01100',
    K: '10001/10010/10100/11000/10100/10010/10001', L: '10000/10000/10000/10000/10000/10000/11111',
    M: '10001/11011/10101/10101/10001/10001/10001', N: '10001/11001/10101/10011/10001/10001/10001',
    O: '01110/10001/10001/10001/10001/10001/01110', P: '11110/10001/10001/11110/10000/10000/10000',
    Q: '01110/10001/10001/10001/10101/10010/01101', R: '11110/10001/10001/11110/10100/10010/10001',
    S: '01111/10000/10000/01110/00001/00001/11110', T: '11111/00100/00100/00100/00100/00100/00100',
    U: '10001/10001/10001/10001/10001/10001/01110', V: '10001/10001/10001/10001/10001/01010/00100',
    W: '10001/10001/10001/10101/10101/10101/01010', X: '10001/10001/01010/00100/01010/10001/10001',
    Y: '10001/10001/01010/00100/00100/00100/00100', Z: '11111/00001/00010/00100/01000/10000/11111',
    0: '01110/10001/10011/10101/11001/10001/01110', 1: '00100/01100/00100/00100/00100/00100/01110',
    2: '01110/10001/00001/00010/00100/01000/11111', 3: '11110/00001/00001/01110/00001/00001/11110',
    4: '00010/00110/01010/10010/11111/00010/00010', 5: '11111/10000/11110/00001/00001/10001/01110',
    6: '00110/01000/10000/11110/10001/10001/01110', 7: '11111/00001/00010/00100/01000/01000/01000',
    8: '01110/10001/10001/01110/10001/10001/01110', 9: '01110/10001/10001/01111/00001/00010/01100',
    '.': '00000/00000/00000/00000/00000/01100/01100', ',': '00000/00000/00000/00000/01100/00100/01000',
    '!': '00100/00100/00100/00100/00100/00000/00100', '?': '01110/10001/00001/00010/00100/00000/00100',
    "'": '01100/00100/01000/00000/00000/00000/00000', '"': '01010/01010/00000/00000/00000/00000/00000',
    ':': '00000/01100/01100/00000/01100/01100/00000', '-': '00000/00000/00000/11111/00000/00000/00000',
    '+': '00000/00100/00100/11111/00100/00100/00000', '/': '00001/00010/00010/00100/01000/01000/10000',
    '(': '00010/00100/01000/01000/01000/00100/00010', ')': '01000/00100/00010/00010/00010/00100/01000',
    '%': '11001/11010/00010/00100/01000/01011/10011', '>': '10000/01000/00100/00010/00100/01000/10000',
    '<': '00001/00010/00100/01000/00100/00010/00001', '*': '00000/10101/01110/11111/01110/10101/00000',
  };
  const FONT = {};
  for (const [ch, rows] of Object.entries(GLYPHS)) FONT[ch] = rows.split('/');
  const ADV = 6;
  const textW = s => (s.length ? s.length * ADV - 1 : 0);
  let textLog = null, textTag = null;   // tests record every string drawn (and whether it is on a card), to check spacing
  function text(scr, s, x, y, shade = 0) {
    if (textLog) textLog.push({ s, x, y, w: textW(s), tag: textTag });
    for (let i = 0; i < s.length; i++) {
      const g = FONT[s[i]]; if (!g) continue;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1') scr.pixel(x + i * ADV + c, y + r, shade);
    }
  }
  function textBig(scr, s, x, y, shade, k = 2) {   // each font pixel becomes a k x k block
    for (let i = 0; i < s.length; i++) {
      const g = FONT[s[i]]; if (!g) continue;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '1') scr.rect(x + i * ADV * k + c * k, y + r * k, k, k, shade);
    }
  }
  // greedy word wrap; words longer than a line are broken
  function wrap(s, cols) {
    const lines = []; let cur = '';
    for (let word of s.split(' ')) {
      while (word.length > cols) { if (cur) { lines.push(cur); cur = ''; } lines.push(word.slice(0, cols)); word = word.slice(cols); }
      if (!cur) cur = word;
      else if ((cur + ' ' + word).length <= cols) cur += ' ' + word;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ── UI helpers ─────────────────────────────────────────────────────
  function box(scr, x, y, w, h) {   // double-border dialogue box
    scr.pal = P.UI; scr.rect(x, y, w, h, 0); scr.rect(x + 1, y + 1, w - 2, h - 2, 3); scr.frame(x + 2, y + 2, w - 4, h - 4, 1);
  }
  function hud(scr, conf) {         // "CF" + bar in the top-left corner; the bar goes red, amber, green
    scr.pal = P.UI;
    scr.rect(0, 0, 62, 11, 0);
    text(scr, 'CF', 2, 2, 3);
    scr.rect(16, 2, 44, 7, 1); scr.rect(17, 3, 42, 5, 0);
    scr.pal = conf < 34 ? P.CF_LOW : conf < 67 ? P.CF_MID : P.CF_HIGH;
    scr.rect(17, 3, Math.round(42 * Math.max(0, Math.min(100, conf)) / 100), 5, 3);
    scr.pal = P.UI;
  }

  // ── tiles ──────────────────────────────────────────────────────────
  // over: drawn on top of the map's floor tile (transparent background). draw(s) picks palettes as it goes.
  const TILES = {};
  const def = (ch, solid, draw, over = false) => { TILES[ch] = { solid, draw, over }; };
  def(' ', true, s => { s.pal = P.INK; s.clear(0); });
  def('.', false, s => { s.pal = P.FLOOR_O; s.clear(3); s.pixel(3, 3, 2); s.pixel(11, 11, 2); s.pixel(11, 4, 2); s.pixel(4, 12, 2); });
  def('_', false, s => { s.pal = P.WOOD; s.clear(3); s.rect(0, 7, 16, 1, 2); s.rect(0, 15, 16, 1, 2); s.rect(4, 0, 1, 7, 2); s.rect(11, 8, 1, 7, 2); });
  def(',', false, s => { s.pal = P.TEAL; s.clear(2); s.rect(0, 0, 8, 8, 3); s.rect(8, 8, 8, 8, 3); });
  const brick = s => { s.pal = P.BRICK; s.clear(1); for (const y of [4, 9, 14]) s.rect(0, y, 16, 1, 0); s.rect(5, 0, 1, 4, 0); s.rect(11, 5, 1, 4, 0); s.rect(5, 10, 1, 4, 0); s.rect(0, 15, 16, 1, 0); s.rect(0, 0, 16, 1, 2); };
  def('#', true, brick);
  def('W', true, s => { brick(s); s.pal = P.INK; s.rect(2, 1, 12, 11, 0); s.pal = P.SKY; s.rect(3, 2, 10, 9, 2); s.rect(3, 2, 10, 3, 3); s.pal = P.INK; s.rect(7, 2, 2, 9, 0); s.rect(3, 6, 10, 1, 0); });
  def('T', true, s => { s.pal = P.TABLE; s.rect(0, 3, 16, 12, 0); s.rect(1, 4, 14, 9, 1); s.rect(1, 4, 14, 2, 3); s.rect(1, 6, 14, 1, 2); }, true);
  def('c', true, s => { s.pal = P.TABLE; s.rect(4, 3, 8, 11, 0); s.pal = P.SEAT_R; s.rect(5, 4, 6, 3, 1); s.rect(5, 8, 6, 5, 2); s.rect(5, 8, 6, 1, 3); }, true);
  def('p', true, s => { s.pal = P.POT; s.rect(5, 10, 6, 5, 0); s.rect(6, 11, 4, 3, 2); s.pal = P.LEAF; s.rect(3, 1, 10, 9, 0); s.rect(4, 2, 8, 7, 1); s.pixel(6, 4, 3); s.pixel(9, 5, 3); s.pixel(7, 7, 2); s.rect(4, 2, 8, 1, 2); }, true);
  def('D', false, s => { brick(s); s.pal = P.INK; s.rect(2, 0, 12, 16, 0); s.pal = P.DOOR; s.rect(3, 1, 10, 15, 2); s.rect(3, 1, 10, 1, 3); s.rect(3, 9, 10, 1, 1); s.pal = P.GOLD; s.rect(10, 8, 2, 2, 2); });
  def('P', true, s => { brick(s); s.pal = P.INK; s.rect(3, 1, 10, 13, 0); s.pal = P.PAPER; s.rect(4, 2, 8, 11, 3); s.pal = P.TITLE; s.rect(5, 4, 6, 2, 0); s.pal = P.PAPER; s.rect(5, 7, 6, 1, 1); s.rect(5, 9, 5, 1, 1); s.rect(5, 11, 4, 1, 1); });
  def('r', false, s => { s.pal = P.RUG; s.rect(0, 0, 16, 16, 1); s.rect(1, 1, 14, 14, 2); s.frame(3, 3, 10, 10, 1); s.pal = P.GOLD; s.frame(2, 2, 12, 12, 2); }, true);
  def('S', false, s => { s.pal = P.STAGE; s.clear(2); s.rect(0, 0, 16, 1, 3); s.rect(0, 14, 16, 2, 1); });
  def('L', true, s => { s.pal = P.TABLE; s.rect(3, 1, 10, 14, 0); s.rect(4, 7, 8, 7, 1); s.pal = P.GOLD; s.rect(4, 2, 8, 4, 2); s.rect(4, 2, 8, 1, 3); }, true);
  def('a', true, s => { s.pal = P.SEAT_B; s.rect(3, 2, 10, 5, 0); s.rect(4, 3, 8, 3, 2); s.rect(3, 7, 10, 7, 0); s.rect(4, 8, 8, 5, 1); s.rect(4, 8, 8, 1, 3); }, true);
  def('K', true, s => { s.pal = P.TABLE; s.rect(0, 5, 16, 10, 0); s.rect(1, 6, 14, 7, 1); s.rect(1, 6, 14, 2, 3); }, true);
  def('b', true, s => { s.pal = P.INK; s.clear(0); const cols = [P.DOOR2, P.DOOR1, P.DOOR3, P.DOOR4]; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { s.pal = cols[(r + c) % 4]; s.rect(1 + c * 4, 1 + r * 5, 3, 4, 2); s.rect(1 + c * 4, 1 + r * 5, 3, 1, 3); } });
  def('m', false, s => { s.pal = P.MAT; s.rect(1, 4, 14, 9, 0); s.rect(2, 5, 12, 7, 2); s.frame(2, 5, 12, 7, 1); }, true);
  '123456'.split('').forEach((n, i) => def(n, true, s => { brick(s); s.pal = P.INK; s.rect(2, 0, 12, 16, 0); s.pal = P.DOORS[i]; s.rect(3, 1, 10, 15, 1); s.rect(3, 1, 10, 2, 3); s.rect(3, 3, 1, 13, 2); text(s, n, 6, 5, 3); s.rect(10, 11, 2, 2, 3); }));

  const cache = new Map();
  function tileImg(ch, floorCh) {
    const def = TILES[ch], key = ch + '|' + (def.over ? floorCh : '');
    if (!cache.has(key)) {
      const s = new Screen(T, T, CLEAR);
      if (def.over) TILES[floorCh].draw(s);
      def.draw(s);
      cache.set(key, s);
    }
    return cache.get(key);
  }

  // ── people ─────────────────────────────────────────────────────────
  // style: {hairStyle: 'short'|'long'|'curly'|'bun'|'bald', skinTone: 0-3, hairCol, shirtCol, glasses, tie}
  function personImg(style, dir, frame) {
    const key = JSON.stringify([style, dir, frame]);
    if (cache.has(key)) return cache.get(key);
    const side = dir === 'left' || dir === 'right';
    const s = new Screen(T, T, CLEAR);
    const SK = P.SKIN[style.skinTone ?? 0], HR = P.HAIR[style.hairCol ?? 'black'], SH = P.SHIRT[style.shirtCol ?? 'navy'];
    const foot = (x, up) => { s.pal = P.INK; s.rect(x, up ? 13 : 14, 3, 2, 0); };
    foot(4, frame === 1); foot(9, frame === 2);
    s.pal = P.INK; s.rect(3, 9, 10, 5, 0);                       // body outline
    s.pal = SH; s.rect(4, 9, 8, 4, 1); s.rect(4, 9, 8, 1, 2);    // shirt, with a lighter collar
    if (style.tie && dir === 'down') { s.pal = P.INK; s.rect(7, 10, 2, 3, 0); }
    s.pal = P.INK; s.rect(4, 1, 8, 8, 0);                        // head outline
    s.pal = SK; s.rect(5, 3, 6, 5, 3);                           // face
    const hs = style.hairStyle || 'short', hair = (x, y, w, h) => { s.pal = HR; s.rect(x, y, w, h, 1); };
    const hairOutline = (x, y, w, h) => { s.pal = P.INK; s.rect(x, y, w, h, 0); };
    if (dir === 'up') {
      if (hs === 'bald') { s.pal = SK; s.rect(5, 2, 6, 6, 2); } else hair(5, 2, 6, 6);
      if (hs === 'curly') { hairOutline(3, 0, 10, 8); hair(4, 1, 8, 6); }
    } else {
      if (hs !== 'bald') hair(5, 2, 6, 2);
      if (hs === 'long') { hair(4, 3, 2, 6); hair(10, 3, 2, 6); }
      if (hs === 'curly') { hairOutline(3, 0, 10, 4); hair(4, 1, 8, 2); hairOutline(3, 4, 2, 3); hairOutline(11, 4, 2, 3); hair(4, 4, 1, 2); hair(11, 4, 1, 2); }
      if (hs === 'bun') { hairOutline(6, 0, 4, 2); hair(7, 0, 2, 1); }
      s.pal = P.INK;
      if (side) { s.pixel(5, 5, 0); s.rect(9, 5, 2, 1, 0); s.pal = SK; s.pixel(5, 6, 3); }
      else { s.pixel(6, 5, 0); s.pixel(9, 5, 0); s.pal = SK; s.rect(7, 7, 2, 1, 1); s.pixel(5, 6, 2); s.pixel(10, 6, 2); }   // mouth and a touch of cheek
      if (style.glasses) { s.pal = P.INK; s.rect(5, 4, 3, 1, 0); s.rect(8, 4, 3, 1, 0); }
    }
    const img = dir === 'right' ? flipImg(s) : s;
    cache.set(key, img);
    return img;
  }
  function flipImg(s) { const o = new Screen(s.w, s.h, CLEAR); o.blit(s, 0, 0, true); return o; }

  // little "!" quest marker (8x8): red outline, yellow bubble, red exclamation mark
  const MARK = ['.000000.', '03333330', '03311330', '03311330', '03311330', '03333330', '03311330', '.000000.'];
  function marker(scr, x, y) {
    const keep = scr.pal; scr.pal = P.MARK;
    MARK.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') scr.pixel(x + i, y + j, +c); }));
    scr.pal = keep;
  }

  function toRGBA(scr, out) {     // framebuffer -> RGBA bytes for ImageData
    const rgb = PALS.map(p => p.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]));
    for (let i = 0; i < scr.px.length; i++) { const c = rgb[scr.pl[i]][scr.px[i] & 3]; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; }
    return out;
  }

  return { setTextLog: l => { textLog = l; }, setTextTag: t => { textTag = t; }, W, H, T, CLEAR, PALS, P, Screen, FONT, ADV, text, textW, textBig, wrap, box, hud, TILES, tileImg, personImg, marker, toRGBA };
})();
if (typeof module !== 'undefined') module.exports = G.gfx;
