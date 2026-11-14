/* probe-cellar-empty.mjs — how empty is the cellar, and is it the data or the plan?
 *   node scratch/probe-cellar-empty.mjs
 * Fourteen cellar rooms reported no plinths, no props and no pick nodes. Either
 * the link data has nothing for those categories, or the plan is throwing links
 * away. The answer decides whether this is a content gap or a bug.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4600);
  const out = await evaluate(`(() => {
    const m = window.__museum;
    const byCat = {};
    m.LINKS.forEach((l) => { byCat[l.cat] = (byCat[l.cat] || 0) + 1; });
    const cellar = m.plan.rooms.filter((r) => r.floor === 'basement');
    const ground = m.plan.rooms.filter((r) => r.floor === 'ground');
    return {
      links: m.LINKS.length,
      cats: Object.keys(byCat).length,
      cellar: cellar.map((r) => ({ id: r.id, cat: r.cat, items: (r.items || []).length,
        dataLinks: byCat[r.cat] || 0, plinths: (r.plinths || []).length })),
      cellarItems: cellar.reduce((a, r) => a + (r.items || []).length, 0),
      groundItems: ground.reduce((a, r) => a + (r.items || []).length, 0),
      groundEmpty: ground.filter((r) => !(r.items || []).length).map((r) => r.id),
      catsWithLinksButNoRoom: Object.keys(byCat).filter((c) => !m.plan.rooms.some((r) => r.cat === c)),
      unplaced: m.plan.unplaced || null
    };
  })()`);
  console.log('links', out.links, 'categories in data', out.cats);
  console.log('items placed: ground', out.groundItems, ' cellar', out.cellarItems);
  console.log('ground rooms with nothing in them:', out.groundEmpty.join(' ') || 'none');
  console.log('categories with links but no room:', out.catsWithLinksButNoRoom.join(' ') || 'none');
  console.log('plan.unplaced:', JSON.stringify(out.unplaced));
  console.log('\ncellar rooms:');
  for (const r of out.cellar) console.log('  ', r.id.padEnd(20), 'cat', String(r.cat).padEnd(20),
    'items', String(r.items).padStart(3), 'in data', String(r.dataLinks).padStart(3), 'plinths', r.plinths);
});
