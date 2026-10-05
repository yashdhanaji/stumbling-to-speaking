// minigames: short action games, each a deterministic state machine. A, B and the D-pad only; no option menus.
// make(name, opts) -> { name, done, score, step(frameInput), draw(screen) }
var G = (globalThis.G ||= {}); // var, not const: browser scripts share one global scope
G.Minigames = (() => {
  const { text, textW, textBig, wrap, box, personImg, P } = G.gfx;
  const sfx = n => { if (G.audio) G.audio.play(n); };
  const LANE_Y = [44, 72, 100], COL_X = [40, 80, 120], COL_DIV = [60, 100];   // three columns; the widest bubble stays 8px clear of the screen edge
  const edgeLabel = (scr, s, y, shade, col) => text(scr, s, col === 0 ? 8 : col === 2 ? 152 - textW(s) : 80 - Math.floor(textW(s) / 2), y, shade);   // outer labels keep an 8px margin
  const center = (scr, s, y, shade = 0, cx = 80) => text(scr, s, cx - Math.floor(textW(s) / 2), y, shade);
  const you = () => G.World.STYLES.you;

  // shared shell: intro banner -> play -> result banner
  function core(name, title, help, max, impl, opts = {}) {
    const m = { name, max, score: 0, done: false, state: 'intro', t: 0, rt: 0, msg: '', opts };
    if (impl.init) impl.init(m, opts);
    m.finish = (score, msg) => { m.score = score; m.msg = msg; m.state = 'result'; m.rt = 0; sfx(score > 0 ? 'win' : 'down'); };
    m.step = inp => {
      if (m.state === 'intro') { if (++m.t >= 75 || (m.t > 20 && inp.aPress)) { m.state = 'play'; m.t = 0; } return; }
      if (m.state === 'play') { m.t++; impl.update(m, inp); return; }
      if (++m.rt > 160 || (m.rt > 25 && inp.aPress)) m.done = true;
    };
    m.draw = scr => {
      scr.pal = impl.pal; scr.clear(3);
      if (m.state === 'intro') {              // title, rule, instructions (up to 5 lines), PRESS A: generous padding all round
        m.card = { x: 8, y: 16, w: 144, h: 112 };
        box(scr, 8, 16, 144, 112); G.gfx.setTextTag('card');
        center(scr, title, 26, 0);
        scr.rect(28, 38, 104, 1, 2);
        wrap(help, 19).forEach((l, i) => center(scr, l, 46 + i * 11, 1));
        if ((m.t >> 3) & 1) center(scr, 'PRESS A', 112, 0);
        G.gfx.setTextTag(null);
        return;
      }
      impl.draw(m, scr);
      if (m.state === 'result') {             // the card grows with the message so the text never touches the border
        const lines = wrap(m.msg, 20), h = 18 + lines.length * 10 + (max > 0 ? 14 : 0) + 18, y = 72 - Math.floor(h / 2);
        m.card = { x: 8, y, w: 144, h };
        box(scr, 8, y, 144, h); G.gfx.setTextTag('card');
        lines.forEach((l, i) => center(scr, l, y + 10 + i * 10, 0));
        if (max > 0) center(scr, `+${m.score} CONFIDENCE`, y + 10 + lines.length * 10 + 4, 1);
        if (m.rt > 20 && (m.rt >> 3) & 1) center(scr, 'PRESS A', y + h - 16, 0);
        G.gfx.setTextTag(null);
      }
    };
    return m;
  }
  // run several parts back to back; score is the sum
  function seq(name, parts, max) {
    const m = { name, max, score: 0, done: false, i: 0, parts };
    m.cur = () => parts[Math.min(m.i, parts.length - 1)];
    m.step = inp => { const p = parts[m.i]; p.step(inp); if (p.done) { m.score += p.score; if (++m.i >= parts.length) m.done = true; } };
    m.draw = scr => m.cur().draw(scr);
    return m;
  }
  const lanes = (scr, ys) => ys.forEach(y => scr.rect(0, y + 14, 160, 1, 2));
  const counter = (scr, s) => text(scr, s, 157 - textW(s), 2, 0);   // top-right, clear of the HUD and the heading
  const word = (scr, s, x, y) => { const keep = scr.pal; scr.pal = P.WORD; scr.rect(x - 2, y - 2, textW(s) + 4, 11, 0); text(scr, s, x, y, 3); scr.pal = keep; };

  // ── 1. STUMBLE: you cannot win; filler words swarm and you lose your train of thought ──
  const STUMBLE = {
    pal: P.G_STUMBLE,
    init(m) { m.lane = 1; m.hits = 0; m.words = []; m.i = 0; m.freeze = 0; },
    update(m, inp) {
      if (m.t % 150 === 100) m.freeze = 24;                       // brain freeze
      if (m.freeze > 0) m.freeze--;
      else { if (inp.upPress) m.lane = Math.max(0, m.lane - 1); if (inp.downPress) m.lane = Math.min(2, m.lane + 1); }
      while (m.i < 27 && m.t >= 10 + 22 * m.i) { m.words.push({ x: 160, lane: [1, 0, 1, 2][m.i % 4], text: ['UM', 'UH', 'ER', 'LIKE'][m.i % 4], hit: false }); m.i++; }
      for (const w of m.words) { w.x -= 1.2; if (!w.hit && w.lane === m.lane && w.x < 40 && w.x > 12) { w.hit = true; m.hits++; sfx('down'); } }
      m.words = m.words.filter(w => w.x > -30);
      if (m.t >= 640) m.finish(m.hits <= 3 ? 2 : m.hits <= 8 ? 1 : 0, 'WORDS FAILED YOU...');
    },
    draw(m, scr) {
      center(scr, 'DODGE THE FILLER WORDS', 14, 1); lanes(scr, LANE_Y);
      scr.blit(personImg(you(), m.freeze ? 'down' : 'right', 0), 14, LANE_Y[m.lane] - 6);
      for (const w of m.words) word(scr, w.text, Math.round(w.x), LANE_Y[w.lane] - 2);
      counter(scr, `HITS ${m.hits}`);
      if (m.freeze) center(scr, 'BRAIN FREEZE!', 124, 0);
    },
  };

  // ── 2. TOPICS: THINK (timing), ORGANIZE (sorting puzzle), SPEAK (swat the ums) ──
  const THINK = {
    pal: P.G_THINK,
    init(m) { m.cx = 8; },
    update(m, inp) {
      m.cx = 8 + 144 * (1 - Math.abs((m.t % 150) / 75 - 1));
      if (inp.aPress) { const z = m.cx < 55 ? 0 : m.cx < 105 ? 1 : 2; m.pick = z; return m.finish([3, 8, 0][z], ['OK, BUT RISKY...', 'ONE REAL MOMENT!', 'AVOIDING IT?'][z]); }
      if (m.t >= 420) m.finish(0, 'TOO SLOW!');
    },
    draw(m, scr) {
      center(scr, 'PICK THE BEST TOPIC', 14, 1);
      [['BEST', 'FAILURE'], ['ONE', 'REAL', 'MOMENT'], ['NEVER', 'FAILED']].forEach((lines, i) => {
        const x = 8 + i * 50; scr.rect(x, 40, 46, 40, 0); scr.rect(x + 1, 41, 44, 38, 3);
        lines.forEach((l, j) => center(scr, l, 48 + j * 10, 0, x + 23));
      });
      const cx = Math.round(m.cx);
      scr.rect(cx, 86, 1, 20, 1);
      for (let i = 0; i < 5; i++) scr.rect(cx - 4 + i, 82 + i, 9 - 2 * i, 1, 0);
    },
  };
  const ORGANIZE = {
    pal: P.G_ORG,
    TARGET: ['HAPPENED', 'LEARNT', 'NOW'],
    init(m) { m.blocks = ['NOW', 'HAPPENED', 'LEARNT']; m.c = 0; m.held = null; m.swaps = 0; },
    update(m, inp) {
      if (inp.leftPress) m.c = Math.max(0, m.c - 1);
      if (inp.rightPress) m.c = Math.min(2, m.c + 1);
      if (inp.aPress) {
        if (m.held === null) m.held = m.c;
        else { if (m.held !== m.c) { [m.blocks[m.held], m.blocks[m.c]] = [m.blocks[m.c], m.blocks[m.held]]; m.swaps++; sfx('select'); } m.held = null; }
      }
      if (m.blocks.every((b, i) => b === ORGANIZE.TARGET[i])) return m.finish(Math.max(2, 8 - 2 * (m.swaps - 2)), 'WELL ORGANIZED!');
      if (m.t >= 900) m.finish(0, 'TIME UP!');
    },
    draw(m, scr) {
      center(scr, 'PUT THEM IN ORDER:', 14, 1); center(scr, 'HAPPENED, LEARNT, NOW', 25, 1);
      m.blocks.forEach((b, i) => {
        const x = 8 + i * 50, y = m.held === i ? 50 : 58;
        scr.rect(x, y, 46, 28, 0); scr.rect(x + 1, y + 1, 44, 26, m.held === i ? 2 : 3);
        center(scr, b, y + 10, 0, x + 23);
      });
      const cx = 8 + m.c * 50 + 23;
      for (let i = 0; i < 5; i++) scr.rect(cx - 4 + i, 94 - i, 9 - 2 * i, 1, 0);
      center(scr, m.held === null ? 'A: PICK UP' : 'A: SWAP HERE', 108, 0);
    },
  };
  // SWAT: words fly left in three lanes; swat each in the zone with A. Used for SPEAK and the Ah-Counter.
  const SWAT = {
    pal: P.G_SWAT,
    init(m, o) { m.lane = 1; m.sched = o.words; m.speed = o.speed; m.i = 0; m.alive = []; m.swatted = 0; m.slipped = 0; m.flash = 0; m.label = o.label; },
    update(m, inp) {
      if (inp.upPress) m.lane = Math.max(0, m.lane - 1);
      if (inp.downPress) m.lane = Math.min(2, m.lane + 1);
      while (m.i < m.sched.length && m.t >= m.sched[m.i].t) m.alive.push({ x: 160, ...m.sched[m.i++] });
      for (const w of m.alive) w.x -= m.speed;
      if (m.flash) m.flash--;
      if (inp.aPress) {
        const c = m.alive.filter(w => w.lane === m.lane && w.x <= 56 && w.x >= 8).sort((a, b) => a.x - b.x)[0];
        if (c) { c.dead = true; m.swatted++; m.flash = 6; sfx('hit'); } else sfx('bump');
      }
      m.alive = m.alive.filter(w => { if (w.dead) return false; if (w.x < 8) { m.slipped++; sfx('down'); return false; } return true; });
      if (m.i >= m.sched.length && !m.alive.length) m.finish(m.swatted, `${m.swatted} OF ${m.sched.length} SWATTED`);
    },
    draw(m, scr) {
      center(scr, m.label, 14, 1); lanes(scr, LANE_Y);
      scr.rect(56, 36, 1, 84, 1);                                      // swat zone edge
      scr.blit(personImg(you(), 'right', m.flash ? 2 : 0), 14, LANE_Y[m.lane] - 6);
      for (const w of m.alive) word(scr, w.text, Math.round(w.x), LANE_Y[w.lane] - 2);
      scr.rect(8, 128, 144, 6, 1); scr.rect(9, 129, 142, 4, 0);
      scr.rect(9, 129, Math.round(142 * (m.swatted + m.slipped) / m.sched.length), 4, 3);
      counter(scr, `SWATTED ${m.swatted}`);
    },
  };
  const swatWords = (list, gap, texts, lanesList) => list.map((_, i) => ({ t: 30 + i * gap, lane: lanesList[i], text: texts[i % texts.length] }));
  const SPEAK_WORDS = swatWords(Array(8).fill(0), 48, ['UM', 'UH', 'ER', 'LIKE', 'SO', 'ACTUALLY', 'UM', 'UH'], [1, 0, 2, 1, 2, 0, 1, 2]);
  const AH_WORDS = swatWords(Array(6).fill(0), 54, ['UM', 'AH', 'LIKE', 'ER', 'UM', 'SO'], [2, 0, 1, 2, 0, 1]);

  // ── 3. FEEDBACK CATCH: good feedback falls into the right lane; dodge empty praise and harsh criticism ──
  const BUBBLES = [
    { lines: ['OPENING', 'GRABBED', 'US'], lane: 0, pts: 3 }, { lines: ['GREAT', 'JOB!'], lane: 1, pts: -1 },
    { lines: ['SLOW', 'DOWN IN', 'MIDDLE'], lane: 1, pts: 3 }, { lines: ['TOO FAST', 'AND LONG'], lane: 2, pts: -1 },
    { lines: ['PAUSE', 'AT KEY', 'POINTS'], lane: 2, pts: 2 }, { lines: ['I LOVED', 'IT!'], lane: 0, pts: -1 },
  ];
  const FB_FALL = 98, CATCH_Y = 106;
  const FEEDBACK = {
    pal: P.G_FEED,
    init(m) { m.lane = 1; m.sum = 0; m.bub = BUBBLES.map((b, i) => ({ ...b, t: 20 + 70 * i, y: -99, state: 'wait' })); m.last = 0; },
    update(m, inp) {
      if (inp.leftPress) m.lane = Math.max(0, m.lane - 1);
      if (inp.rightPress) m.lane = Math.min(2, m.lane + 1);
      for (const b of m.bub) {
        if (b.state === 'done' || m.t < b.t) continue;
        b.y = 40 + (m.t - b.t) * (CATCH_Y - 40) / FB_FALL; b.state = 'fall';
        if (b.y >= CATCH_Y) {
          b.state = 'done';
          if (b.lane === m.lane) { m.sum += b.pts; m.last = b.pts; sfx(b.pts > 0 ? 'hit' : 'down'); }
        }
      }
      if (m.bub.every(b => b.state === 'done') && m.t > BUBBLES.length * 70 + FB_FALL + 20) {
        const s = Math.max(0, m.sum); m.finish(s, s >= 8 ? 'USEFUL FEEDBACK!' : s > 0 ? 'GOOD START' : 'NOT HELPFUL YET');
      }
    },
    draw(m, scr) {
      center(scr, 'CATCH GOOD FEEDBACK', 14, 1);
      COL_DIV.forEach(x => scr.rect(x, 28, 1, 96, 2));
      ['STRENGTH', 'IMPROVE', 'NEXT'].forEach((t, i) => edgeLabel(scr, t, 134, 1, i));
      for (const b of m.bub) if (b.state === 'fall') {
        const x = COL_X[b.lane] - FB_W / 2, y = Math.round(b.y) - 14, pad = Math.floor((37 - (b.lines.length * 9 - 2)) / 2);
        const keep = scr.pal; scr.pal = b.pts > 0 ? P.GOODB : P.BADB;
        scr.rect(x, y, FB_W, 37, 0); scr.rect(x + 1, y + 1, FB_W - 2, 35, 3);
        b.lines.forEach((l, j) => center(scr, l, y + pad + j * 9, 0, COL_X[b.lane]));
        scr.pal = keep;
      }
      scr.blit(personImg(you(), 'up', 0), COL_X[m.lane] - 8, 112);
      counter(scr, `SCORE ${Math.max(0, m.sum)}`);
    },
  };

  // ── 4. TIMER CARDS: the clock runs fast; hold up green, yellow, red at 1:00, 1:30, 2:00 ──
  const MARKS = [60, 90, 120], TOL = 10, CARDS = ['GREEN', 'YELLOW', 'RED'];
  const TIMER = {
    pal: P.G_TIMER,
    init(m) { m.k = 0; m.hits = []; },
    update(m, inp) {
      const c = m.t / 6;                                                // 10x speed
      if (inp.aPress && m.k < 3) { const ok = Math.abs(c - MARKS[m.k]) <= TOL; m.hits.push(ok); m.k++; sfx(ok ? 'hit' : 'down'); }
      if (m.k >= 3 || c > 135) { const n = m.hits.filter(Boolean).length; m.finish(n * 5, `${n} OF 3 CARDS ON TIME`); }
    },
    draw(m, scr) {
      const c = Math.min(135, Math.floor(m.t / 6));
      center(scr, `YOU ARE THE TIMER`, 14, 1);
      textBig(scr, `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`, 54, 34, 0, 3);
      scr.rect(10, 80, 140, 8, 0); scr.rect(11, 81, 138, 6, 3);
      MARKS.forEach((mk, i) => { const x = 10 + Math.round(mk * 140 / 135), keep = scr.pal; scr.pal = P.DOORS[[3, 2, 4][i]]; scr.rect(x - 7, 81, 14, 6, 1); scr.pal = keep; center(scr, ['G', 'Y', 'R'][i], 91, 0, x); });
      const px = 10 + Math.round(c * 140 / 135); scr.rect(px - 1, 76, 3, 16, 0);
      center(scr, m.k < 3 ? `PRESS A: ${CARDS[m.k]} CARD` : 'DONE', 106, 0);
      m.hits.forEach((ok, i) => text(scr, `${CARDS[i][0]}:${ok ? 'OK' : 'X'}`, 12 + i * 44, 120, 1));
    },
  };

  // ── 5. REHEARSE: press A on the beat, eight times ──
  const REHEARSE = {
    pal: P.G_REH,
    init(m) { m.beats = Array.from({ length: 8 }, (_, i) => ({ t: 60 + 40 * i, hit: false, miss: false })); m.hits = 0; m.flash = 0; },
    update(m, inp) {
      if (m.flash) m.flash--;
      if (inp.aPress) {
        const b = m.beats.filter(b => !b.hit && Math.abs(b.t - m.t) <= 8).sort((a, c) => Math.abs(a.t - m.t) - Math.abs(c.t - m.t))[0];
        if (b) { b.hit = true; m.hits++; m.flash = 8; sfx('hit'); } else sfx('bump');
      }
      if (m.t > m.beats[7].t + 30) m.finish(m.hits, `${m.hits} OF 8 ON THE BEAT`);
    },
    draw(m, scr) {
      center(scr, 'PRESS A ON THE BEAT', 14, 1);
      scr.rect(0, 62, 160, 20, 2); scr.rect(26, 56, 8, 32, 0); scr.rect(27, 57, 6, 30, m.flash ? 3 : 2);
      for (const b of m.beats) { const x = 30 + (b.t - m.t) * 2; if (x > -8 && x < 166) { scr.rect(x - 4, 66, 8, 12, b.hit ? 1 : 0); } }
      scr.blit(personImg(you(), 'down', m.flash ? 1 : 0), 72, 92);
      counter(scr, `${m.hits}/8`);
    },
  };

  // ── 6. PRESENT (finale): catch your three key points in order, then breathe when asked a hard question ──
  const PCOL = COL_X, PDIV = COL_DIV, FB_W = 58, PRES_W = 64;   // bubble widths: every word fits with 4px+ of padding (checked in check.mjs)
  const POINTS = [{ t: 'CHALLENGE', lane: 0 }, { t: 'SOLUTION', lane: 2 }, { t: 'IMPACT', lane: 1 }];
  const PRESENT = {
    pal: P.G_PRES,
    init(m, o) { m.lane = 1; m.req = 0; m.y = 52; m.wait = 20; m.miss = 0; m.bl = POINTS[0].lane; m.speed = o.steady ? 0.9 : 1.3; m.phase = 'catch'; m.qt = 0; m.flags = o.flags || {}; m.flags.breathed = false; },
    update(m, inp) {
      if (m.phase === 'catch') {
        if (inp.leftPress) m.lane = Math.max(0, m.lane - 1);
        if (inp.rightPress) m.lane = Math.min(2, m.lane + 1);
        if (m.wait > 0) { m.wait--; return; }
        m.y += m.speed;
        if (m.y >= CATCH_Y) {
          if (m.bl === m.lane) { m.req++; m.miss = 0; sfx('hit'); } else { m.miss++; sfx('bump'); }
          m.y = 52; m.wait = 20;
          if (m.req >= 3) { m.phase = 'question'; m.qt = 0; }
          else m.bl = m.miss >= 2 ? m.lane : POINTS[m.req].lane;      // missed twice: the point comes to you, so nobody gets stuck
        }
      } else {
        m.qt++;
        if (inp.bPress) { m.flags.breathed = true; return m.finish(0, 'YOU PAUSE. BREATHE.'); }
        if (m.qt >= 150) m.finish(0, 'YOU ANSWER ANYWAY.');
      }
    },
    draw(m, scr) {
      if (m.phase === 'catch') {
        center(scr, m.req < 3 ? `CATCH: ${POINTS[m.req].t}` : '', 14, 1);
        POINTS.forEach((p, i) => { scr.rect(62 + i * 14, 27, 10, 6, 0); scr.rect(63 + i * 14, 28, 8, 4, i < m.req ? 1 : 3); });   // three pips fill in as you catch each point
        PDIV.forEach(x => scr.rect(x, 38, 1, 86, 2));
        if (m.req < 3 && m.wait === 0) { const b = POINTS[m.req], x = PCOL[m.bl] - PRES_W / 2; scr.rect(x, Math.round(m.y) - 8, PRES_W, 17, 0); scr.rect(x + 1, Math.round(m.y) - 7, PRES_W - 2, 15, 3); center(scr, b.t, Math.round(m.y) - 3, 0, PCOL[m.bl]); }
        scr.blit(personImg(you(), 'up', 0), PCOL[m.lane] - 8, 112);
      } else {
        center(scr, 'THE MANAGER ASKS A', 24, 0); center(scr, 'HARD QUESTION...', 34, 0);
        scr.blit(personImg(G.World.STYLES.manager, 'down', 0), 72, 52); scr.blit(personImg(you(), 'up', 0), 72, 88);
        center(scr, 'PRESS B TO BREATHE', 114, 1);
        scr.rect(20, 126, 120, 6, 0); scr.rect(21, 127, Math.round(118 * (1 - m.qt / 150)), 4, 3);
      }
    },
  };

  const MAX = { stumble: 2, topics: 24, feedback: 8, timercards: 15, ahcounter: 6, rehearse: 8, present: 0 };
  function make(name, opts = {}) {
    switch (name) {
      case 'stumble': return core(name, 'PUT ON THE SPOT', 'UP/DOWN TO MOVE. DODGE THE UMS AND UHS!', MAX.stumble, STUMBLE, opts);
      case 'topics': return seq(name, [
        core('think', 'TABLE TOPICS: THINK', 'A TOPIC! PRESS A WHEN THE ARROW IS ON THE BEST ONE.', 8, THINK, opts),
        core('organize', 'ORGANIZE', 'LEFT/RIGHT TO MOVE. A TO PICK UP, A TO SWAP. PUT THEM IN ORDER.', 8, ORGANIZE, opts),
        core('speak', 'SPEAK!', 'UP/DOWN TO MOVE. PRESS A TO SWAT FILLER WORDS IN THE ZONE.', 8, SWAT, { ...opts, words: SPEAK_WORDS, speed: 1.4, label: 'SPEAK! SWAT THE UMS' }),
      ], MAX.topics);
      case 'feedback': return core(name, 'FEEDBACK CATCH', 'LEFT/RIGHT. CATCH FEEDBACK IN ITS OWN LANE. AVOID EMPTY PRAISE AND HARSH WORDS.', MAX.feedback, FEEDBACK, opts);
      case 'timercards': return core(name, 'TIMER CARDS', 'THE CLOCK RUNS FAST. PRESS A AT 1:00 FOR GREEN, 1:30 YELLOW, 2:00 RED.', MAX.timercards, TIMER, opts);
      case 'ahcounter': return core(name, 'AH-COUNTER', 'UP/DOWN TO MOVE. PRESS A TO SWAT EVERY FILLER WORD.', MAX.ahcounter, SWAT, { ...opts, words: AH_WORDS, speed: 1.2, label: 'COUNT AND SWAT THE UMS' });
      case 'rehearse': return core(name, 'REHEARSE', 'PRESS A WHEN A BEAT REACHES THE LINE.', MAX.rehearse, REHEARSE, opts);
      case 'present': return core(name, 'YOUR PRESENTATION', 'LEFT/RIGHT. CATCH YOUR 3 POINTS IN ORDER. B TO BREATHE.', MAX.present, PRESENT, opts);
    }
    throw new Error('unknown mini-game ' + name);
  }
  const LAYOUT = { feedback: BUBBLES.map(b => ({ w: FB_W, lines: b.lines })), present: POINTS.map(p => ({ w: PRES_W, lines: [p.t] })) };   // for the spacing checks
  return { make, MAX, ORGANIZE_TARGET: ORGANIZE.TARGET, MARKS, LAYOUT };
})();
if (typeof module !== 'undefined') module.exports = G.Minigames;
