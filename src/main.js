// main: the browser glue. Canvas scaling, keyboard + touch input, fixed 60 Hz loop, save/load. All game logic is in game.js.
(() => {
  const G = globalThis.G;
  const canvas = document.getElementById('screen'), ctx2d = canvas.getContext('2d');
  const pad = document.getElementById('pad');
  const img = ctx2d.createImageData(160, 144), scr = new G.gfx.Screen();
  const game = G.Game.make(), input = G.Input.make();
  window.__game = game; window.__input = input;           // debug hooks for the test pages

  // progress is saved at every quest step; storage failures (private windows etc.) are ignored
  const KEY = 'tm-gb-save';
  try { game.save = JSON.parse(localStorage.getItem(KEY)); } catch (e) { game.save = null; }
  game.onSave = obj => { try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) { /* storage is a convenience */ } };
  game.onEnd = () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

  // keyboard
  const release = () => G.Input.KEYS.forEach(k => input.set(k, false));
  addEventListener('keydown', e => {
    const k = G.Input.KEYMAP[e.key];
    if (e.key === 'm' || e.key === 'M') { G.audio.unlock(); G.audio.toggle(); return; }
    if (!k) return;
    G.audio.unlock(); input.set(k, true); e.preventDefault();
  });
  addEventListener('keyup', e => { const k = G.Input.KEYMAP[e.key]; if (k) { input.set(k, false); e.preventDefault(); } });
  addEventListener('blur', release);

  // touch pad: every button is held while a pointer is down on it, so D-pad and A can be used together
  const touch = matchMedia('(pointer: coarse)').matches || /[?&]touch\b/.test(location.search);
  document.body.classList.toggle('touch', touch);
  pad.querySelectorAll('[data-key]').forEach(b => {
    const k = b.dataset.key;
    const down = e => { e.preventDefault(); G.audio.unlock(); input.set(k, true); b.classList.add('on'); };
    const up = e => { e.preventDefault(); input.set(k, false); b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });

  // whole-number scaling keeps pixels square and sharp
  function fit() {
    const padH = touch ? pad.offsetHeight : 0;
    const k = Math.max(1, Math.floor(Math.min(innerWidth / 160, (innerHeight - padH) / 144)));
    canvas.style.width = 160 * k + 'px'; canvas.style.height = 144 * k + 'px';
  }
  addEventListener('resize', fit); fit();

  // fixed 60 Hz updates, drawing on every animation frame
  const STEP = 1000 / 60; let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= STEP) { game.update(input.poll()); acc -= STEP; }
    game.draw(scr); G.gfx.toRGBA(scr, img.data); ctx2d.putImageData(img, 0, 0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
