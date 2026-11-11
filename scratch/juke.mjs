/* scratch/juke.mjs — drives the jukebox with trusted input and reports what
   the audio graph actually did. An AudioContext only starts inside a real
   user gesture, so this script clicks with Input.dispatchMouseEvent rather
   than calling .click() from the page. */
import { withBrowser, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';

const URL = 'file:///C:/Users/skyee/Documents/Strata/Workspace/index.html';

await withBrowser(async ({ send, evaluate, consoleLines }) => {
  await send('Page.navigate', { url: URL });
  await sleep(9000);

  const centre = async (selector) => evaluate(
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();` +
    `return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);

  const click = async (selector) => {
    const { x, y } = await centre(selector);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', {
        type, x, y, button: 'left', clickCount: 1,
        buttons: type === 'mousePressed' ? 1 : 0
      });
    }
  };

  const probe = () => evaluate(`JSON.stringify({
    open: document.getElementById('juke').classList.contains('open'),
    playingClass: document.getElementById('juke').classList.contains('playing'),
    playing: museum.juke.playing,
    ctx: museum.juke.ctx ? museum.juke.ctx.state : 'none',
    clock: museum.juke.ctx ? +museum.juke.ctx.currentTime.toFixed(2) : 0,
    timer: museum.juke.timer > 0,
    peak: Math.max(...[...document.querySelectorAll('#juke-vu i')]
      .map((b) => parseFloat(b.style.height) || 0)),
    title: document.getElementById('juke-title').textContent,
    deckName: (document.querySelector('#juke-list [aria-current="true"] .nm') || {})
      .firstChild ? document.querySelector('#juke-list [aria-current="true"] .nm').firstChild.textContent.trim() : 'none',
    bpm: document.getElementById('juke-bpm').textContent,
    side: document.getElementById('juke-side').textContent,
    rows: document.querySelectorAll('#juke-list .jk-row').length,
    current: (document.querySelector('#juke-list [aria-current="true"] .nm') || {})
      .textContent || 'none',
    focus: document.activeElement.id
  })`);

  const results = [];
  const check = (label, ok, detail) => {
    results.push((ok ? 'ok    ' : 'FAIL  ') + label + (detail ? '  — ' + detail : ''));
  };

  /* 1 · the topbar button opens the deck and the machine starts */
  await click('#btn-juke');
  await evaluate(`(() => { const v = document.getElementById('juke-vol');` +
    `v.value = '100'; v.dispatchEvent(new Event('input')); })()`);
  await sleep(1500);
  let s = JSON.parse(await probe());
  check('the jukebox button flies the deck out', s.open);
  check('the sequencer is running against a live clock',
    s.playing && s.timer && s.ctx === 'running' && s.clock > 0.2,
    `ctx=${s.ctx} clock=${s.clock} timer=${s.timer}`);
  check('the level meter sees real signal', s.peak > 3, 'peak=' + s.peak.toFixed(1) + 'px');
  check('the deck names the tune it is playing, and the column agrees',
    s.title.length > 3 && s.title === s.deckName && /^\d+ bpm$/.test(s.bpm),
    s.title + ' / ' + s.bpm + ' / ' + s.side + ' / column: ' + s.deckName);
  check('twelve requests in the column', s.rows === 12, 'rows=' + s.rows);
  check('the play button holds the focus so space works', s.focus === 'juke-play', s.focus);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('scratch/shot-juke.png', Buffer.from(shot.data, 'base64'));

  /* 2 · space pauses it (the focused play button answers to it) */
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', text: ' ' });
  await sleep(500);
  s = JSON.parse(await probe());
  check('space stops the machine', !s.playing && !s.playingClass, 'playing=' + s.playing);

  /* 3 · picking another request starts it again, in its own colour */
  await click('#juke-list [data-tune="2"]');
  await sleep(1200);
  s = JSON.parse(await probe());
  check('a request column entry plays and repaints the deck',
    s.playing && /Magical Girl Waltz/.test(s.title) && /104 bpm/.test(s.bpm) && /side a/.test(s.side),
    s.title + ' / ' + s.bpm + ' / ' + s.side);
  check('the meter wakes again', s.peak > 3, 'peak=' + s.peak.toFixed(1) + 'px');

  /* 4 · the column scrolls, and next wraps past the last request */
  await evaluate(`document.querySelector('[data-tune="11"]').scrollIntoView({ block: 'center' })`);
  await sleep(250);
  await click('#juke-list [data-tune="11"]');
  await sleep(400);
  s = JSON.parse(await probe());
  check('the last request is reachable and labelled side b',
    /Boss Gate/.test(s.title) && /side b/.test(s.side), s.title + ' / ' + s.side);
  await click('#juke-next');
  await sleep(300);
  s = JSON.parse(await probe());
  check('next wraps past the last request', /Overworld Bounce/.test(s.title), s.title);

  /* 5 · the deck remembers what it was asked for */
  const remembered = await evaluate(`localStorage.getItem('museum.jukebox')`);
  check('the request and the volume are remembered', /"i":0/.test(remembered || ''), remembered);

  /* 6 · J closes it, and the music keeps playing in the room */
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'j', code: 'KeyJ', text: 'j' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'j', code: 'KeyJ', text: 'j' });
  await sleep(400);
  s = JSON.parse(await probe());
  check('J tucks the deck away without stopping the tune', !s.open && s.playing);

  await click('#btn-juke');
  await sleep(300);
  s = JSON.parse(await probe());
  check('and opens it again where it left off', s.open && s.playing && /Overworld/.test(s.title));

  /* 7 · the volume slider moves the bus */
  await evaluate(`(() => { const v = document.getElementById('juke-vol'); v.value = 12; v.dispatchEvent(new Event('input')); })()`);
  await sleep(200);
  const gain = await evaluate(`+museum.juke.bus.gain.value.toFixed(3)`);
  check('the volume slider drives the bus', Math.abs(gain - 0.12) < 0.02, 'gain=' + gain);

  console.log(results.join('\n'));
  const noisy = consoleLines.filter((line) => /error|uncaught|undefined is not|TypeError/i.test(line));
  console.log('\nconsole: ' + (noisy.length ? noisy.join('\n') : 'clean'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) || noisy.length ? 1 : 0;
});
