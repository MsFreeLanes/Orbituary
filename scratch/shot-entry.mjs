/* shot-entry.mjs — the door: the ticket, the brochure, and the first look at
 * the HUD once you are inside.
 *
 *   node scratch/shot-entry.mjs
 *
 * The entry sequence is the one part of the museum that is pure paper, so it
 * is checked as paper: three screenshots, one of each stage, plus the text of
 * the ticket read back out of the DOM so a missing rule or a stray `undefined`
 * is caught by the console output rather than by squinting at a PNG.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);

  const shot = async (name) => {
    await nap(700);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', name), Buffer.from(img.data, 'base64'));
    console.log('wrote scratch/' + name);
  };

  /* 1 · the ticket, before anything has been agreed to */
  const ticket = await evaluate(`(() => {
    const t = document.querySelector('.ticket');
    if (!t) return { ok: false, why: 'no .ticket' };
    return {
      ok: true,
      head: document.querySelector('.ticket-head').innerText.replace(/\\n/g, ' | '),
      title: t.querySelector('h1').textContent,
      count: t.querySelector('.ticket-count').textContent,
      rules: [...t.querySelectorAll('.ticket-rules li b')].map((b) => b.textContent),
      button: t.querySelector('.stamp').textContent,
      foot: t.querySelector('.ticket-foot').textContent,
      gateVisible: window.__museum.hud.gateVisible
    };
  })()`);
  console.log('ticket:', JSON.stringify(ticket, null, 1));
  await shot('entry-ticket.png');

  /* the keys must not do anything while the ticket is still in hand */
  const guarded = await evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
    return { touring: !!window.__museum.rig.touring, gate: window.__museum.hud.gateVisible };
  })()`);
  console.log('T while ticket is up:', JSON.stringify(guarded));

  /* 2 · tear it */
  await evaluate(`document.querySelector('.stamp').click()`);
  await nap(1100);
  const book = await evaluate(`(() => {
    const b = document.querySelector('.brochure');
    if (!b || b.style.display === 'none') return { ok: false, why: 'no brochure' };
    return {
      ok: true,
      title: b.querySelector('h2').textContent,
      sections: [...b.querySelectorAll('.kicker')].map((k) => k.textContent),
      ask: [...b.querySelectorAll('.brochure-blank')].map((p) => p.textContent),
      gateGone: document.querySelector('.intro').style.display === 'none'
    };
  })()`);
  console.log('brochure:', JSON.stringify(book, null, 1));
  await shot('entry-brochure.png');

  /* 3 · inside: the brochure answers H, and the card carries the entity */
  await evaluate(`document.querySelector('.brochure-go').click()`);
  await nap(400);
  const hint = await evaluate(`(() => {
    const t = [...document.querySelectorAll('.toast')].map((n) => n.textContent);
    return { toasts: t, touring: !!window.__museum.rig.touring };
  })()`);
  console.log('after walking in:', JSON.stringify(hint));
  await nap(500);
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }))`);
  await nap(500);
  const inside = await evaluate(`(() => {
    const b = document.querySelector('.brochure');
    return {
      reopenedByH: b.style.display !== 'none',
      title: b.querySelector('h2').textContent,
      brand: document.querySelector('.brand').textContent,
      gateVisible: window.__museum.hud.gateVisible
    };
  })()`);
  console.log('inside:', JSON.stringify(inside, null, 1));
  await shot('entry-brochure-help.png');

  await evaluate(`window.__museum.hud.closeBrochure()`);
  await nap(600);
  await shot('entry-inside.png');

  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
