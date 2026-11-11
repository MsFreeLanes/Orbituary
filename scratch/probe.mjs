/* scratch/probe.mjs — a narrow diagnostic: what does the fps readout actually
   contain, and at which point does the camera start reporting NaN? */
import { withBrowser, sleep } from './cdp.mjs';

const url = 'file:///C:/Users/skyee/Documents/Strata/Workspace/index.html';

await withBrowser(async ({ send, evaluate }) => {
  await send('Page.navigate', { url });
  await sleep(7000);

  await evaluate(`
    window.__key = (key) => { const a = document.activeElement; if (a && a.blur) a.blur();
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); };
    window.__w = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    true`);

  /* 1 · the stats readout */
  console.log('stats: ' + await evaluate(`(async () => {
    __key('v'); await __w(1500);
    const read = (id) => document.querySelector('#' + id).textContent;
    const on = document.querySelector('#stats').classList.contains('on');
    const out = { on, state: museum.state.stats, fps: read('st-fps'), calls: read('st-calls'),
      tris: read('st-tris'), vis: read('st-vis'), hidden: document.hidden,
      visibility: document.visibilityState, busy: museum.state.busy,
      drawCalls: museum.drawCalls };
    __key('v'); await __w(300);
    out.off = document.querySelector('#stats').classList.contains('on');
    return JSON.stringify(out);
  })()`));

  /* 2 · walk the wings and watch the camera for NaN */
  console.log(await evaluate(`(async () => {
    const log = [];
    const snap = () => {
      const c = museum.camera.position, r = museum.rig;
      return [c.x, c.y, c.z].map((n) => (Number.isFinite(n) ? n.toFixed(1) : 'NaN')).join(' ') +
        ' | rig ' + [r.theta, r.phi, r.radius].map((n) => (Number.isFinite(n) ? n.toFixed(2) : 'NaN')).join(' ');
    };
    for (const wing of museum.plan.wings) {
      museum.wing(wing.name); await __w(1500);
      log.push(wing.name.padEnd(9) + snap());
    }
    return log.join('\\n');
  })()`));

  /* 3 · then fly to every sixth exhibit, same watch */
  console.log(await evaluate(`(async () => {
    const log = [];
    for (let i = 0; i < 88; i += 6) {
      museum.go(i); await __w(1300);
      const c = museum.camera.position;
      const bad = ![c.x, c.y, c.z].every(Number.isFinite);
      log.push(i + ' ' + museum.LINKS[i].n.slice(0, 14).padEnd(15) +
        [c.x, c.y, c.z].map((n) => (Number.isFinite(n) ? n.toFixed(1) : 'NaN')).join(' ') +
        (bad ? '   <-- NaN' : ''));
    }
    return log.join('\\n');
  })()`));

  /* 4 · what does the plan marker hold, and does the loop update it? */
  console.log('plan: ' + await evaluate(`(async () => {
    const marker = document.querySelector('#plan-svg .you');
    const before = marker.getAttribute('cx') + ',' + marker.getAttribute('cy');
    museum.wing('Media'); await __w(1800);
    return JSON.stringify({ before, after: marker.getAttribute('cx') + ',' + marker.getAttribute('cy'),
      cam: [museum.camera.position.x, museum.camera.position.z], mode: museum.state.mode,
      goal: !!museum.rig.goal, dirty: museum.state.dirty });
  })()`));
});
