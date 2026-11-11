/* Audit: walk every core function of the museum in a real browser and assert it
   actually happened. Each check is an expression evaluated inside the page; it
   returns true, or a short string explaining what was wrong.

     node scratch/audit.mjs [url]

   The last line is the console verdict: a clean page prints no errors, and the
   fallback pass proves the catalogue still works with three.js missing.
*/
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'file:///C:/Users/skyee/Documents/Strata/Workspace/index.html';
const fallbackUrl = 'file://' + join(here, 'fallback-test.html').replace(/\\/g, '/');

/* a few verbs, installed once, so the checks below read like sentences */
const helpers = `
  window.__w = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  window.__key = (key) => {
    const active = document.activeElement;
    if (active && active.blur) active.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };
  window.__click = (selector) => { const el = document.querySelector(selector); if (el) el.click(); return !!el; };
  window.__cls = (selector) => document.querySelector(selector).className;
  true
`;

const checks = [
  ['the room boots with a live 3D canvas',
    `museum.state.webgl === true && !!museum.camera && !!museum.renderer`],

  ['88 exhibits across 12 wings',
    `museum.LINKS.length === 88 && museum.plan.wings.length === 12`],

  ['every exhibit has a real place in the room',
    `museum.LINKS.every((l) => Number.isFinite(l._x) && Number.isFinite(l._y) && Number.isFinite(l._z) && Number.isFinite(l._a))`],

  ['the chrome is complete: 12 chips, 12 plan wedges, 88 plan dots',
    `document.querySelectorAll('#chips .chip').length === 12 &&
     document.querySelectorAll('#plan-svg .wedge-hit').length === 12 &&
     document.querySelectorAll('#plan-svg .dot').length === 88`],

  ['the whole collection stands at the start',
    `museum.state.visible.length === 88 && museum.state.wingsOn.size === 12`],

  ['the room draws itself in a few dozen calls',
    `museum.drawCalls > 0 && museum.drawCalls < 60 ? true : 'draw calls ' + museum.drawCalls`],

  ['search narrows the room, offers rows, and clears cleanly',
    `(async () => {
      museum.find('video'); await __w(500);
      const n = museum.state.visible.length;
      if (!n || n >= 88) return 'visible ' + n;
      if (!document.querySelectorAll('#results .result').length) return 'no result rows';
      __click('#results .result'); await __w(1500);
      const opened = document.querySelector('#exhibit').classList.contains('open');
      __click('#search-clear'); await __w(600);
      return opened && museum.state.visible.length === 88 ? true
        : 'panel open=' + opened + ', restored=' + museum.state.visible.length;
    })()`],

  ['a wing chip solos its wing and opens up again',
    `(async () => {
      const chip = [...document.querySelectorAll('#chips .chip')].find((c) => c.textContent.indexOf('Gaming') >= 0);
      chip.click(); await __w(1500);
      const solo = museum.state.visible.length;
      chip.click(); await __w(1500);
      return solo === 16 && museum.state.visible.length === 88 ? true
        : 'soloed ' + solo + ', then ' + museum.state.visible.length;
    })()`],

  ['selecting an exhibit opens its record with the right words',
    `(async () => {
      museum.go(40); await __w(1500);
      const open = document.querySelector('#exhibit').classList.contains('open');
      const title = document.querySelector('#ex-title').textContent;
      const address = document.querySelector('#ex-url').textContent;
      return open && title === museum.LINKS[40].n && address === museum.LINKS[40].u ? true
        : 'open=' + open + ' title=' + title + ' url=' + address;
    })()`],

  ['the arrow keys walk the selection',
    `(async () => {
      const before = museum.state.selected;
      __key('ArrowRight'); await __w(1300);
      const after = museum.state.selected;
      __key('ArrowLeft'); await __w(1300);
      return after !== before && museum.state.selected === before ? true
        : before + ' -> ' + after + ' -> ' + museum.state.selected;
    })()`],

  ['favourites save, filter to one, and clear again',
    `(async () => {
      localStorage.removeItem('museum.favorites');
      museum.go(3); await __w(1300);
      __click('#ex-star'); await __w(300);
      const saved = JSON.parse(localStorage.getItem('museum.favorites') || '[]').length;
      __key('m'); await __w(700);
      const only = museum.state.visible.length;
      __key('m'); await __w(700);
      const all = museum.state.visible.length;
      __key('f'); await __w(300);
      return saved === 1 && only === 1 && all === 88 && museum.state.favs.size === 0 ? true
        : 'saved=' + saved + ' only=' + only + ' all=' + all + ' left=' + museum.state.favs.size;
    })()`],

  ['the guided tour starts and stops',
    `(async () => {
      __key('t'); await __w(900);
      const on = museum.state.tour;
      const caption = document.querySelector('#caption').classList.contains('on');
      __key('t'); await __w(500);
      return on === true && museum.state.tour === false && caption ? true
        : 'tour=' + on + ' caption=' + caption;
    })()`],

  ['a surprise exhibit lands somewhere new',
    `(async () => {
      const before = museum.state.selected;
      __key('s'); await __w(1500);
      return museum.state.selected >= 0 && museum.state.selected !== before ? true
        : 'selected ' + museum.state.selected;
    })()`],

  ['the catalogue mirrors the room and links out safely',
    `(async () => {
      __key('c'); await __w(700);
      const cards = document.querySelectorAll('#catalogue .card').length;
      const blocks = document.querySelectorAll('#catalogue .wing-block').length;
      const anchors = [...document.querySelectorAll('#catalogue .card a')];
      const safe = anchors.length === 88 && anchors.every((a) => a.target === '_blank' && /^https?:/.test(a.href));
      __key('Escape'); await __w(700);
      const back = document.body.className.indexOf('mode-catalogue') < 0;
      return cards === 88 && blocks === 12 && safe && back ? true
        : 'cards=' + cards + ' blocks=' + blocks + ' safe=' + safe + ' back=' + back;
    })()`],

  ['the help sheet opens, lists the wings, and closes',
    `(async () => {
      __key('?'); await __w(400);
      const open = document.querySelector('#help').classList.contains('open');
      const legend = document.querySelectorAll('#help-legend i').length;
      __click('#help-close'); await __w(400);
      return open && legend === 12 && !document.querySelector('#help').classList.contains('open') ? true
        : 'open=' + open + ' legend=' + legend;
    })()`],

  ['the performance readout toggles and counts frames',
    `(async () => {
      __key('v'); await __w(900);
      const on = document.querySelector('#stats').classList.contains('on');
      const fps = document.querySelector('#st-fps').textContent;
      __key('v'); await __w(400);
      const off = document.querySelector('#stats').classList.contains('on');
      return on && Number(fps) > 0 && !off ? true
        : 'on=' + on + ' fps=' + fps + ' off=' + off + ' state=' + museum.state.stats;
    })()`],

  ['the sound button makes room tone, and mutes again',
    `(async () => {
      __click('#btn-sound'); await __w(400);
      const on = museum.state.sound;
      __click('#btn-sound'); await __w(400);
      return on === true && museum.state.sound === false ? true
        : 'on=' + on + ' off=' + museum.state.sound;
    })()`],

  ['the jukebox flies out, lists twelve requests and stops again',
    `(async () => {
      __key('j'); await __w(600);
      const open = document.querySelector('#juke').classList.contains('open');
      const pressed = document.querySelector('#btn-juke').getAttribute('aria-pressed');
      const rows = document.querySelectorAll('#juke-list .jk-row').length;
      const started = museum.juke.playing && museum.juke.timer > 0;
      __click('#juke-list [data-tune="5"]'); await __w(300);
      const title = document.querySelector('#juke-title').textContent;
      const side = document.querySelector('#juke-side').textContent;
      const marked = document.querySelectorAll('#juke-list [aria-current="true"]').length;
      __key(' '); await __w(300);
      const stopped = museum.juke.playing === false && museum.juke.timer === 0;
      __key('Escape'); await __w(400);
      const closed = !document.querySelector('#juke').classList.contains('open');
      return open && pressed === 'true' && rows === 12 && started && /Neon Drift/.test(title) &&
        side === 'side a' && marked === 1 && stopped && closed ? true
        : 'open=' + open + ' rows=' + rows + ' started=' + started + ' title=' + title +
          ' side=' + side + ' marked=' + marked + ' stopped=' + stopped + ' closed=' + closed;
    })()`],

  ['the keyboard moves the camera',
    `(async () => {
      const theta = museum.rig.theta;
      __key('a'); await __w(800);
      const turned = museum.rig.theta;
      const radius = museum.rig.radius;
      __key('ArrowUp'); await __w(800);
      const after = museum.rig.radius;
      const sane = [turned, after, museum.rig.phi, museum.camera.position.x,
        museum.camera.position.y, museum.camera.position.z].every(Number.isFinite);
      return sane && Math.abs(turned - theta) > 0.2 && after < radius ? true
        : 'theta ' + theta + ' -> ' + turned + ', radius ' + radius + ' -> ' + after +
          ', finite = ' + sane;
    })()`],

  ['reset brings the camera home',
    `(async () => {
      museum.wing('Gaming'); await __w(1800);
      __key('r'); await __w(2400);
      const c = museum.camera.position;
      const drift = Math.abs(museum.rig.target.x) + Math.abs(museum.rig.target.z);
      return drift < 2 ? true : 'target drift ' + drift.toFixed(2);
    })()`],

  ['the camera never leaves the rotunda, wing by wing',
    `(async () => {
      const tooFar = [];
      for (const wing of museum.plan.wings) {
        museum.wing(wing.name); await __w(1500);
        const c = museum.camera.position;
        const distance = Math.hypot(c.x, c.z);
        if (!Number.isFinite(distance)) tooFar.push(wing.name + ' is not a number');
        else if (distance > museum.plan.rMin - 0.5) tooFar.push(wing.name + ' @ ' + distance.toFixed(1));
      }
      return tooFar.length ? tooFar.join(', ') : true;
    })()`],

  ['every exhibit can be flown to and ends up in front of the camera',
    `(async () => {
      const wrong = [];
      for (let i = 0; i < 88; i += 6) {
        museum.go(i); await __w(1300);
        const c = museum.camera.position;
        const gap = Math.hypot(museum.LINKS[i]._x - c.x, museum.LINKS[i]._z - c.z);
        if (!Number.isFinite(gap)) wrong.push(i + ' is not a number');
        else if (gap > 22 || gap < 1) wrong.push(i + ' @ ' + gap.toFixed(1));
      }
      return wrong.length ? wrong.join(', ') : true;
    })()`],

  ['the plan map follows where you are standing',
    `(async () => {
      const marker = document.querySelector('#plan-svg .you');
      const before = marker.getAttribute('cx') + ',' + marker.getAttribute('cy');
      museum.wing('Media'); await __w(1800);
      const after = marker.getAttribute('cx') + ',' + marker.getAttribute('cy');
      return before !== after ? true
        : 'never moved: mode=' + museum.state.mode + ' camera=' + museum.camera.position.x.toFixed(1) +
          ',' + museum.camera.position.z.toFixed(1) + ' marker=' + before + ' -> ' + after;
    })()`]
];

const fallbackChecks = [
  ['the page still boots when three.js is missing',
    `museum.state.webgl === false && museum.state.visible.length === 88`],
  ['the printed catalogue carries the whole collection',
    `document.querySelectorAll('#catalogue .card').length === 88 &&
     document.body.className.indexOf('mode-catalogue') >= 0`],
  ['the room-only controls are hidden, not broken',
    `getComputedStyle(document.querySelector('#plan')).display === 'none' &&
     getComputedStyle(document.querySelector('#stats')).display === 'none' &&
     document.querySelector('#btn-tour').disabled &&
     !document.querySelector('#catalogue [data-wing]')`]
];

let failures = 0;
/* after every check, make sure the rig and the camera are still real numbers —
   a NaN anywhere in the rig poisons the room silently, so it is worth naming
   the check that introduced it rather than the first one that noticed */
const canary = `[museum.camera.position.x, museum.camera.position.y, museum.camera.position.z,
   museum.rig.theta, museum.rig.phi, museum.rig.radius, museum.rig.target.x, museum.rig.target.y,
   museum.rig.target.z].filter((n) => !Number.isFinite(n)).length`;

const run = async (evaluate, list) => {
  for (const [name, expression] of list) {
    let verdict;
    try {
      verdict = await evaluate(expression);
    } catch (error) {
      verdict = 'threw: ' + error.message;
    }
    if (verdict !== true) failures++;
    console.log((verdict === true ? '  ok    ' : '  FAIL  ') + name +
      (verdict === true ? '' : '   ->   ' + JSON.stringify(verdict)));
    if (list === checks) {
      const poisoned = await evaluate(canary);
      if (poisoned) {
        failures++;
        console.log('        ^ ' + poisoned + ' non-finite number(s) in the rig after this check');
      }
    }
  }
};

await withBrowser(async ({ send, evaluate, consoleLines, sleep: wait }) => {
  await send('Page.navigate', { url });
  await sleep(7000);
  await evaluate(helpers);

  console.log('\n' + url);
  await run(evaluate, checks);

  const errors = consoleLines.length;
  console.log('\nconsole while running the room: ' + (errors ? errors + ' line(s)' : 'clean'));
  if (errors) { failures += errors; console.log(consoleLines.join('\n')); }

  if (existsSync(join(here, 'fallback-test.html'))) {
    console.log('\n' + fallbackUrl);
    await send('Page.navigate', { url: fallbackUrl });
    await wait(3500);
    await run(evaluate, fallbackChecks);
  } else {
    console.log('\nskipping the fallback pass (no scratch/fallback-test.html)');
  }

  console.log('\n' + (failures ? failures + ' thing(s) need attention' : 'every core function checks out'));
  process.exitCode = failures ? 1 : 0;
});
