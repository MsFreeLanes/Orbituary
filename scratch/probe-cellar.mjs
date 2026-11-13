/* probe: one photograph from a cellar room and one from the rotunda, plus the
 * few facts that say the two storeys are really two storeys — where each
 * shell's group sits, where a cellar arm's shell begins, and that nothing
 * glazes over downstairs.
 *
 *   node scratch/probe-cellar.mjs
 *
 * The rig still stands at eye height above y = 0 wherever it is (it has no
 * floor of its own until it takes the stair), so the probe holds the camera
 * down at cellar eye height for the cellar shot. That is the probe's business:
 * nothing in src/ changes to make the photograph work.
 */
import { withBrowser } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const shot = async (send, name) => {
  const img = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(process.cwd(), 'scratch', name);
  writeFileSync(file, Buffer.from(img.data, 'base64'));
  console.log('wrote', name);
  return file;
};

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate('window.__museum.hud.hideIntro()');

  /* the two storeys, as the renderer actually placed them */
  console.log('storeys', JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, S = m.S, THREE = m.THREE;
    const sits = (o) => Math.abs(o.group.position.y - (o.floor === 'basement' ? S.FLOOR_BASE : 0));
    const onCellar = (list) => list.filter((o) => o.floor === 'basement' && sits(o) < 1e-6).length;
    const onGround = (list) => list.filter((o) => o.floor !== 'basement' && sits(o) < 1e-6).length;
    const box = new THREE.Box3();
    const arms = m.plan.corridors.filter((c) => c.floor === 'basement').map((c) => {
      box.makeEmpty();
      c.group.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
      const hall = m.plan.walkable.rects.find((r) => r.room === m.plan.stair.to);
      const st = Math.sin(hall.angle), ct = Math.cos(hall.angle);
      const lx = Math.abs(c.dir.x * ct - c.dir.z * st), lz = Math.abs(c.dir.x * st + c.dir.z * ct);
      const edge = Math.min(lx > 1e-6 ? hall.halfX / lx : Infinity, lz > 1e-6 ? hall.halfZ / lz : Infinity);
      let near = Infinity;
      for (const sx of [box.min.x, box.max.x]) {
        for (const sz of [box.min.z, box.max.z]) near = Math.min(near, sx * c.dir.x + sz * c.dir.z);
      }
      return { range: c.range, shellStartsAt: +near.toFixed(2), hallWall: +edge.toFixed(2),
        ceilAt: +(box.max.y).toFixed(2), slabAt: +(S.FLOOR_BASE + S.CEIL_BASE).toFixed(2) };
    });
    const glazed = m.plan.rooms.filter((r) => r.floor === 'basement')
      .filter((r) => { let n = 0; r.group.traverse((o) => { if (o.userData.window) n++; }); return n > 0; })
      .map((r) => r.cat);
    return { rooms: m.plan.rooms.length,
      roomsDown: m.plan.rooms.filter((r) => r.floor === 'basement').length,
      roomsUp: m.plan.rooms.filter((r) => r.floor !== 'basement').length,
      roomsSittingRight: onCellar(m.plan.rooms) + onGround(m.plan.rooms),
      armsSittingRight: onCellar(m.plan.corridors) + onGround(m.plan.corridors),
      arms, cellarRoomsWithWindows: glazed };
  })()`)));

  /* the emptiest category with most to look at, so the room is not bare */
  const pick = await evaluate(`(() => {
    const m = window.__museum;
    const down = m.plan.rooms.filter((r) => r.floor === 'basement');
    const room = down.slice().sort((a, b) => b.items.length - a.items.length || a.id.localeCompare(b.id))[0];
    return { id: room.id, cat: room.cat, items: room.items.length, flicker: room.flicker };
  })()`);
  console.log('cellar room', JSON.stringify(pick));

  await evaluate(`(() => {
    const m = window.__museum, rig = m.rig;
    const update = rig.update.bind(rig);
    rig.update = (dt) => {
      const s = update(dt);
      if (m.__eyeY !== null && m.__eyeY !== undefined) m.camera.position.y = m.__eyeY;
      return s;
    };
    m.__eyeY = null;
  })()`);

  await evaluate(`(() => {
    const m = window.__museum, S = m.S;
    const r = m.plan.byId(${JSON.stringify(pick.id)});
    m.rig.teleportTo(r.id);
    const stand = Math.min(1.1, r.d * 0.3);
    m.rig.state.x = r.entry.x + r.n.x * stand;
    m.rig.state.z = r.entry.z + r.n.z * stand;
    m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.05);
    m.__eyeY = S.FLOOR_BASE + S.EYE_H;
  })()`);
  await nap(1600);
  console.log('cellar camera', JSON.stringify(await evaluate(
    '({x: +window.__museum.camera.position.x.toFixed(2), y: +window.__museum.camera.position.y.toFixed(2), z: +window.__museum.camera.position.z.toFixed(2), room: window.__museum.rig.state.room})')));
  await shot(send, 'probe-cellar-room.png');

  await evaluate('window.__museum.__eyeY = null; window.__museum.rig.teleportTo("rotunda")');
  await nap(1600);
  console.log('rotunda camera', JSON.stringify(await evaluate(
    '({x: +window.__museum.camera.position.x.toFixed(2), y: +window.__museum.camera.position.y.toFixed(2), z: +window.__museum.camera.position.z.toFixed(2), room: window.__museum.rig.state.room})')));
  await shot(send, 'probe-rotunda.png');
});
