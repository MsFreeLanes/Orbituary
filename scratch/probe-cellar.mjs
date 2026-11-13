/* probe: the descent. the rig walks from the rotunda, down the stair, into
 * the Stair Hall and into a cellar room, and says where it is at every stop.
 *
 *   node scratch/probe-cellar.mjs
 *
 * Two facts the building knows and the rig does not, so the probe supplies
 * them and says so out loud:
 *   - the rig has no floor of its own. it stands at eye height over y = 0
 *     wherever it is, so the probe puts the camera on the flight: the height
 *     the rig would be standing at is the same line the treads follow.
 *   - inside() and rig.roomAt are flat. they cannot tell the rotunda from the
 *     Stair Hall directly underneath it, so the probe carries the storey the
 *     rig is on — it changes when the rig steps onto the flight — and picks
 *     the walkable rect on that storey. that storey-aware check belongs in
 *     src/ (rig.roomAt wants it too); this probe is where it is proved first.
 *
 * The walk is stepped, not timed: rig.update(0.05) in a loop, because the
 * headless page runs at two frames a second and a real-time walk of thirty
 * metres would take a five-minute nap. Every step is still a collision test.
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

  /* the stair, as the renderer built it: treads counted, and a ray down
     through the well that must find a tread rather than the rotunda floor. */
  console.log('stair', JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, S = m.S, THREE = m.THREE, s = m.plan.stair;
    let treads = 0, lo = 1e9, hi = -1e9, arches = 0;
    m.view.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      if (g.type === 'BoxGeometry' && Math.abs(g.parameters.width - s.w) < 1e-6
          && Math.abs(g.parameters.depth - s.run / 20) < 1e-6) {
        treads++;
        lo = Math.min(lo, o.position.y); hi = Math.max(hi, o.position.y);
      }
      if (g.type === 'CylinderGeometry' && g.parameters.openEnded
          && g.parameters.height === S.CEIL_ROTUNDA) arches++;
    });
    const ray = new THREE.Raycaster();
    const shell = m.plan.rotunda.group.parent;
    const down = (x, z) => {
      ray.set(new THREE.Vector3(x, 2.5, z), new THREE.Vector3(0, -1, 0));
      const a = ray.intersectObject(shell, true)[0];
      ray.set(new THREE.Vector3(x, S.FLOOR_BASE + 0.3, z), new THREE.Vector3(0, 1, 0));
      const b = ray.intersectObject(shell, true)[0];
      return { at: [x, z], fromAbove: a ? +a.point.y.toFixed(2) : null,
        fromBelow: b ? +b.point.y.toFixed(2) : null };
    };
    return { treads, rise: +(S.STAIR_DROP / 20).toFixed(3), treadDepth: +(s.run / 20).toFixed(3),
      treadY: [+hi.toFixed(2), +lo.toFixed(2)], drop: s.drop, arches,
      well: [s.x - s.w / 2, s.z, s.x + s.w / 2, s.z + s.run],
      rays: [down(0, 0), down(0, -3.8), down(0, -6.0)] };
  })()`)));

  /* the storey the rig is standing on, and the camera height that goes with
     it. installed over rig.update so every step, however it is driven, keeps
     the rig honest about where its feet are. */
  await evaluate(`(() => {
    const m = window.__museum, S = m.S, plan = m.plan, s = plan.stair;
    const inRect = (r, x, z) => {
      const st = Math.sin(r.angle), ct = Math.cos(r.angle);
      const px = x - r.cx, pz = z - r.cz;
      return Math.abs(px * ct - pz * st) <= r.halfX && Math.abs(px * st + pz * ct) <= r.halfZ;
    };
    const onFlight = (x, z) => Math.abs(x - s.x) <= s.w / 2 && z >= s.z && z <= s.z + s.run;
    m.__storey = 'ground';
    m.__standY = (x, z) => onFlight(x, z) ? -(z - s.z) / s.run * s.drop
      : (m.__storey === 'basement' ? S.FLOOR_BASE : 0);
    m.__roomAt = (x, z) => {
      if (m.__storey === 'ground' && Math.hypot(x, z) <= S.ROTUNDA_R) return 'rotunda';
      /* a room or the stair hall first: the cellar arms are recorded from the
         hall centre outward, so a corridor rect always covers the hall too */
      let arm = null, off = 1e9;
      for (const r of plan.walkable.rects) {
        if ((r.floor || 'ground') !== m.__storey) continue;
        if (!inRect(r, x, z)) continue;
        if (r.room) return r.room;
        for (const c of plan.corridors) {
          if ((c.floor || 'ground') !== m.__storey) continue;
          const along = x * c.dir.x + z * c.dir.z;
          const lat = Math.abs(x * c.dir.z - z * c.dir.x);
          if (along >= 0 && along <= c.t1 && lat <= c.half && lat < off) { off = lat; arm = c.range; }
        }
      }
      return arm || 'corridor';
    };
    const update = m.rig.update.bind(m.rig);
    m.rig.update = (dt) => {
      const out = update(dt);
      const x = m.rig.state.x, z = m.rig.state.z;
      if (onFlight(x, z)) m.__storey = 'basement';
      else if (z < s.z) m.__storey = 'ground';
      m.camera.position.y = m.__standY(x, z) + S.EYE_H;
      return out;
    };
  })()`);

  const stop = async (label) => {
    const at = await evaluate(`(() => {
      const m = window.__museum, s = m.rig.state;
      return { x: +s.x.toFixed(2), z: +s.z.toFixed(2), yaw: +s.yaw.toFixed(2),
        eye: +m.__standY(s.x, s.z).toFixed(2), storey: m.__storey,
        probeRoom: m.__roomAt(s.x, s.z), rigRoom: s.room };
    })()`);
    console.log('stop ' + label, JSON.stringify(at));
    return at;
  };

  /* hold W and step the rig until it has gone so far. one evaluate per leg so
     the page's own two-frame-a-second loop cannot starve the walk. */
  const walk = async (label, yaw, metres) => {
    const out = await evaluate(`(() => {
      const m = window.__museum, rig = m.rig;
      rig.setYawPitch(${yaw}, rig.state.pitch);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      const a = { x: rig.state.x, z: rig.state.z };
      let moved = 0, steps = 0;
      while (steps < 3000) {
        rig.update(0.05);
        moved = Math.hypot(rig.state.x - a.x, rig.state.z - a.z);
        if (moved >= ${metres}) break;
        steps++;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      return { moved: +moved.toFixed(2), steps };
    })()`);
    console.log('walk ' + label, JSON.stringify(out));
    return stop(label);
  };

  /* the cellar room the walk finishes in: the first door up the north arm */
  const pick = await evaluate(`(() => {
    const m = window.__museum;
    const down = m.plan.rooms.filter((r) => r.floor === 'basement');
    const room = down.filter((r) => r.range === 'Basement North')
      .sort((a, b) => (a.entry.z - b.entry.z) || a.id.localeCompare(b.id))[0] || down[0];
    return { id: room.id, cat: room.cat, items: room.items.length, flicker: room.flicker,
      entry: { x: +room.entry.x.toFixed(2), z: +room.entry.z.toFixed(2) } };
  })()`);
  console.log('cellar room', JSON.stringify(pick));

  /* ── the walk ── */
  await evaluate('window.__museum.rig.teleportTo("rotunda")');
  await evaluate(`(() => { const m = window.__museum;
    m.rig.state.x = 0.6; m.rig.state.z = 3.0; m.rig.setYawPitch(0.12, -0.40); })()`);
  await nap(1800);
  await stop('rotunda, looking at the stair opening');
  await shot(send, 'probe-stair-rotunda.png');

  /* south across the rotunda to the head of the stair. the walkable union is
     the disc here, so this leg proves the opening is where the floor is not. */
  await walk('south to the head of the stair', 0, 9.5);
  await evaluate('window.__museum.rig.setYawPitch(Math.PI, -0.62)');
  await nap(1400);
  await shot(send, 'probe-stair-head.png');

  /* about turn and down: the flight runs back north into the hall */
  await walk('down the flight', Math.PI, 3.4);
  await evaluate('window.__museum.rig.setYawPitch(Math.PI, -0.14)');
  await nap(1800);
  await stop('on the stair');
  await shot(send, 'probe-stair-flight.png');

  await walk('to the foot of the stair', Math.PI, 4.2);
  await evaluate('window.__museum.rig.setYawPitch(0, 0.30)');
  await nap(1800);
  await stop('in the Stair Hall, looking back up the flight');
  await shot(send, 'probe-stair-hall.png');

  /* north up the cellar arm and through a door. the arm leg stops at the door
     mouth, not past it: the door rect is 1.10 m along the corridor, and with
     a body radius in it that is only 0.54 m of latitude to cross on. */
  await walk('along the north cellar arm', Math.PI, 7.9);
  await stop('on the north cellar arm');
  await walk('through the door', -Math.PI / 2, 2.2);
  await evaluate('window.__museum.rig.setYawPitch(-Math.PI / 2, 0.05)');
  await nap(1800);
  const end = await stop('in ' + pick.cat);
  await shot(send, 'probe-cellar-room.png');

  console.log('cellar room pick', JSON.stringify(pick), 'ended in', JSON.stringify(end));
});
