/* probe: the descent. the rig walks from the rotunda, down the stair, into
 * the Stair Hall and into a cellar room, and says where it is at every stop.
 *
 *   node scratch/probe-cellar.mjs
 *
 * The rig carries its own storey and its own eye height now, so the probe
 * only reads them: `rig.state.storey` is the level the feet are on,
 * `rig.state.level` is the slab under them, and the camera sits EYE_H above
 * that. Nothing here is installed over the rig — what the probe reports is
 * what the page is doing on its own.
 *
 * And at five of those stops it reads the room card out of the DOM — the same
 * text a visitor reads, not the plan behind it — because the thing that broke
 * was the card: below ground it went on naming the rotunda. The name
 * scrambles into place over a few animation frames, so the reader waits for
 * the text to stop changing instead of trusting a nap.
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

await withBrowser(async ({ send, evaluate, sleep: nap, consoleLines }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate('window.__museum.hud.hideIntro()');

  /* what the card says before anybody walks anywhere, and what the door it
     came through says: both are counted off the plan, not written down. */
  console.log('at rest', JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, p = m.plan;
    return { links: p.rooms.reduce((n, r) => n + r.items.length, 0),
      withThings: p.rooms.filter((r) => r.items.length && r.floor !== 'basement').length,
      waitingDownstairs: p.rooms.filter((r) => r.floor === 'basement').length,
      intro: document.querySelector('.intro-kicker').textContent };
  })()`)));

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

  /* every stop reports what the rig itself knows: the storey its feet are on,
     the slab under them, the camera height, and the room it would name. */
  const stop = async (label) => {
    const at = await evaluate(`(() => {
      const m = window.__museum, s = m.rig.state;
      return { x: +s.x.toFixed(2), z: +s.z.toFixed(2), yaw: +s.yaw.toFixed(2),
        storey: s.storey, level: +s.level.toFixed(2),
        camY: +m.camera.position.y.toFixed(2),
        eyeOverSlab: +(m.camera.position.y - s.level).toFixed(2),
        room: s.room, roomAt: m.rig.roomAt(s.x, s.z),
        onFlight: m.rig.flightT(s.x, s.z) !== null };
    })()`);
    console.log('stop ' + label, JSON.stringify(at));
    return at;
  };

  /* What the visitor reads. The card is DOM over the canvas, so this reads the
     DOM — the name, the line under it, the colour down its left edge, and the
     floor plan's own state — rather than the plan the card was built from. The
     name scrambles in over a few animation frames and the headless page only
     paints twice a second, so the reader waits for the text to stop changing. */
  const cards = {};
  const card = async (label, key) => {
    const read = `(() => {
      const m = window.__museum, c = document.querySelector('.card'), box = document.querySelector('.mapbox');
      const text = (root, sel) => { const n = root.querySelector(sel); return n ? n.textContent : ''; };
      const svg = box.querySelector('svg');
      const hints = box.querySelectorAll('.map-hint');
      const drawn = Array.from(svg.querySelectorAll('g'))
        .filter((g) => g.getAttribute('display') !== 'none').length;
      return { room: m.rig.state.room, storey: m.rig.state.storey,
        name: text(c, '.room-name'), sub: text(c, '.room-sub'),
        accent: getComputedStyle(c).borderLeftColor,
        kicker: text(box, '.kicker'),
        here: hints[0] ? hints[0].textContent : '', other: hints[1] ? hints[1].textContent : '',
        viewBox: svg.getAttribute('viewBox'), layersDrawn: drawn,
        roomsDrawn: svg.querySelectorAll('g:not([display="none"]) polygon').length };
    })()`;
    let out = null, last = '', steady = 0;
    for (let i = 0; i < 24; i++) {
      out = await evaluate(read);
      const key2 = out.name + '|' + out.sub;
      if (key2 === last) { if (++steady >= 2) break; } else { steady = 0; last = key2; }
      await nap(220);
    }
    console.log('card ' + label, JSON.stringify(out));
    cards[key] = out;
    return out;
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
  await card('in the rotunda', 'rotunda');
  await shot(send, 'probe-stair-rotunda.png');

  /* south across the rotunda to the head of the stair. the walkable union is
     the disc here, so this leg proves the opening is where the floor is not. */
  await walk('south to the head of the stair', 0, 9.5);
  await evaluate('window.__museum.rig.setYawPitch(Math.PI, -0.62)');
  await nap(1400);
  await card('at the head of the stair', 'head');
  await shot(send, 'probe-stair-head.png');

  /* about turn and down: the flight runs back north into the hall */
  await walk('down the flight', Math.PI, 3.4);
  await evaluate('window.__museum.rig.setYawPitch(Math.PI, -0.14)');
  await nap(1800);
  await stop('on the stair');
  await card('mid-flight', 'flight');
  await shot(send, 'probe-stair-flight.png');

  await walk('to the foot of the stair', Math.PI, 4.2);
  await evaluate('window.__museum.rig.setYawPitch(0, 0.30)');
  await nap(1800);
  await stop('in the Stair Hall, looking back up the flight');
  await card('in the Stair Hall', 'hall');
  await shot(send, 'probe-stair-hall.png');

  /* north up the cellar arm and through a door. the arm leg stops at the door
     mouth, not past it: the door rect is 1.10 m along the corridor, and with
     a body radius in it that is only 0.54 m of latitude to cross on. */
  await walk('along the north cellar arm', Math.PI, 7.9);
  await stop('on the north cellar arm');
  await card('on the north cellar arm', 'arm');
  await walk('through the door', -Math.PI / 2, 2.2);
  await evaluate('window.__museum.rig.setYawPitch(-Math.PI / 2, 0.05)');
  await nap(1800);
  const end = await stop('in ' + pick.cat);
  await card('in ' + pick.cat, 'room');
  await shot(send, 'probe-cellar-room.png');

  console.log('cellar room pick', JSON.stringify(pick), 'ended in', JSON.stringify(end));

  /* the five strings, in the order a visitor reads them on the way down. The
     card is allowed to name the rotunda in exactly one of them: the first. */
  console.log('card, on the way down:');
  for (const k of ['rotunda', 'head', 'flight', 'hall', 'arm', 'room']) {
    const c = cards[k];
    console.log('  ' + k.padEnd(8) + ' [' + c.room + '/' + c.storey + '] "' + c.name +
      '" — "' + c.sub + '"');
  }
  const lying = Object.keys(cards)
    .filter((k) => cards[k].room !== 'rotunda' && /rotunda/i.test(cards[k].name));
  console.log(lying.length ? 'FAIL: the card names the rotunda at ' + lying.join(', ')
    : 'card: never says "The Rotunda" once the rig is off the rotunda floor');
  const floors = Object.keys(cards).map((k) => cards[k].kicker + ' ' + cards[k].viewBox);
  console.log('map: ' + (new Set(floors).size === 2 ? 'two spans, one per storey' : 'span did not change') +
    ' — ' + [...new Set(floors)].join(' | '));

  /* and the sound of the place. the page never gets a click in here, so the
     probe starts the audio context itself: the cellar tone, the drip it
     schedules, and footsteps on the concrete. what matters is that the graph
     builds without throwing, twice over — once down there and once back
     upstairs — because the storey and the material are now two different
     lookups and a room record has to satisfy both. */
  const sound = await evaluate(`(() => {
    const m = window.__museum;
    const down = m.plan.byId('apple-dev'), up = m.plan.byId('gaming');
    m.audio.resume();
    m.audio.enterRoom(down);
    for (let i = 0; i < 4; i++) m.audio.step(down, 1);
    m.audio.enterRoom(up);
    for (let i = 0; i < 2; i++) m.audio.step(up, 1);
    return { started: m.audio.started, level: +m.audio.level().toFixed(3),
      cellar: { floor: down.floor, floorMat: down.floorMat, tone: down.tone },
      upstairs: { floor: up.floor, floorMat: up.floorMat, tone: up.tone } };
  })()`);
  console.log('sound', JSON.stringify(sound));

  const noise = consoleLines.filter((l) => !/favicon|Autoplay|GPU stall|GroupMarkerNotSet|deprecated/i.test(l));
  console.log(noise.length ? 'CONSOLE:\n' + noise.slice(0, 8).join('\n') : 'console: clean');
});
