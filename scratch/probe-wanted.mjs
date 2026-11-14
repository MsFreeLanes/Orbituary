/* probe-wanted.mjs — are the cellar's empty plinths, and their cards, actually
 * where they should be?
 *   node scratch/probe-wanted.mjs
 *
 * The plan hands a plinth to every cellar room with nothing to show. This asks
 * the plan how many it handed out, asks the scene where the cards were welded,
 * and asks whether the pointer can pick one up (it should not: there is no
 * exhibit behind it).
 *
 * The second question is the interesting one. A plinth's label is welded into
 * the room's batch, and a batch is one mesh per material, so a label whose
 * position is computed from the plinth's *face* without the plinth's own place
 * in the room lands by the doorway instead of on the stone.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const probe = `(() => {
  const m = window.__museum;
  const wanted = m.plan.rooms.filter((r) => (r.plinths || []).some((s) => s.wanted));
  const pickables = m.built.pickables;

  const plinths = wanted.map((r) => {
    const s = r.plinths.find((x) => x.wanted);
    const nx = Math.sin(r.angle), nz = Math.cos(r.angle);
    const ux = Math.cos(r.angle), uz = -Math.sin(r.angle);
    return { code: r.code, at: [+(r.entry.x + s.v * nx + s.u * ux).toFixed(2),
      +(r.entry.z + s.v * nz + s.u * uz).toFixed(2)] };
  });

  const cards = [];
  m.scene.traverse((o) => {
    const tex = o.material && o.material.map;
    if (!tex || !tex.userData || tex.userData.kind !== 'wantedPlinth') return;
    const b = new m.THREE.Box3().setFromObject(o);
    cards.push({ at: [ +((b.min.x + b.max.x) / 2).toFixed(2), +((b.min.z + b.max.z) / 2).toFixed(2) ],
      y: +((b.min.y + b.max.y) / 2).toFixed(2) });
  });

  const pairs = plinths.map((p) => {
    let best = null;
    cards.forEach((c, i) => {
      const d = Math.hypot(c.at[0] - p.at[0], c.at[1] - p.at[1]);
      if (!best || d < best.d) best = { i, d: +d.toFixed(2) };
    });
    return { code: p.code, plinth: p.at, card: best ? cards[best.i].at : null,
      cardY: best ? cards[best.i].y : null, off: best ? best.d : null };
  });
  return {
    rooms: wanted.length,
    cards: cards.length,
    pickNodes: pickables.length,
    pickNodesWithoutExhibit: pickables.filter((n) => !n.userData.exhibit).length,
    pairs: pairs.slice(0, 5),
    worstOff: Math.max(...pairs.map((p) => p.off || 0))
  };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4600);
  const r = await evaluate(probe);
  console.log('rooms with an empty plinth:', r.rooms, '| cards welded:', r.cards);
  console.log('pick nodes:', r.pickNodes, '| without an exhibit:', r.pickNodesWithoutExhibit);
  r.pairs.forEach((p) => console.log(' ', p.code, 'plinth', JSON.stringify(p.plinth),
    'card', JSON.stringify(p.card), 'y', p.cardY, 'off by', p.off, 'm'));
  console.log('worst card-to-plinth distance:', r.worstOff, 'm');
});
