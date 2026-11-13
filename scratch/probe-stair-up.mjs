/* probe: the climb back up. the rig starts in a cellar room, walks out along
 * the arm, across the Stair Hall and up the flight, and the probe says where
 * it ends up — and how many times the storey changed on the way.
 *
 *   node scratch/probe-stair-up.mjs
 *
 * The claim being tested is that the storey is a fact about where the feet
 * are, not a guess. So the probe watches every step the rig takes and asks
 * two questions of it:
 *   - does the storey the rig reports agree with the room it is standing in?
 *     every room rect carries the storey it is on, so a rig standing in a
 *     cellar room and calling itself 'ground' is guessing.
 *   - when the storey does change, is the rig on the flight? that is the only
 *     place the building changes level, so a flip anywhere else — in the
 *     middle of a room, or at the mouth of the stair where the rotunda floor
 *     and the head of the flight are the same patch of plan — is the jitter
 *     this whole design is arranged to avoid.
 *
 * The walk is stepped, not timed, for the same reason probe-cellar.mjs steps:
 * the headless page runs at two frames a second.
 */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate('window.__museum.hud.hideIntro()');

  /* the watcher. it reads the rig and never corrects it: everything it
     reports is something the rig decided by itself. it goes in after the
     teleport, because a teleport is allowed to move the storey — the plan
     says which storey the room it drops you in sits on — and this probe is
     about whether a walk can move it. */
  const watch = async () => await evaluate('JSON.parse(JSON.stringify(window.__museum.__watch))');
  const installWatcher = async () => await evaluate(`(() => {
    const m = window.__museum, plan = m.plan;
    const inRect = (r, x, z) => {
      const st = Math.sin(r.angle), ct = Math.cos(r.angle);
      const px = x - r.cx, pz = z - r.cz;
      return Math.abs(px * ct - pz * st) <= r.halfX && Math.abs(px * st + pz * ct) <= r.halfZ;
    };
    m.__watch = { steps: 0, flips: [], flipOffFlight: 0, storeyWrong: 0, wrong: [],
      levelLo: 0, levelHi: 0, roomsSeen: [] };
    let prev = m.rig.state.storey;
    const update = m.rig.update.bind(m.rig);
    m.rig.update = (dt) => {
      const out = update(dt);
      const s = m.rig.state, w = m.__watch;
      w.steps++;
      w.levelLo = Math.min(w.levelLo, s.level);
      w.levelHi = Math.max(w.levelHi, s.level);
      /* the room under the feet, if it is a room: its own floor tag is the
         answer the rig has to agree with */
      const rect = plan.walkable.rects.find((r) => r.kind === 'room' && inRect(r, s.x, s.z));
      if (rect && rect.floor !== s.storey) {
        w.storeyWrong++;
        if (w.wrong.length < 4) w.wrong.push({ room: rect.room, wants: rect.floor, says: s.storey,
          at: [+s.x.toFixed(2), +s.z.toFixed(2)] });
      }
      if (s.storey !== prev) {
        const onFlight = m.rig.flightT(s.x, s.z) !== null;
        w.flips.push({ at: [+s.x.toFixed(2), +s.z.toFixed(2)], to: s.storey,
          room: s.room, onFlight });
        if (!onFlight) w.flipOffFlight++;
        prev = s.storey;
      }
      if (!w.roomsSeen.length || w.roomsSeen[w.roomsSeen.length - 1] !== s.room) w.roomsSeen.push(s.room);
      return out;
    };
  })()`);

  const stop = async (label) => {
    const at = await evaluate(`(() => {
      const m = window.__museum, s = m.rig.state;
      return { x: +s.x.toFixed(2), z: +s.z.toFixed(2), storey: s.storey,
        level: +s.level.toFixed(2), camY: +m.camera.position.y.toFixed(2),
        eyeOverSlab: +(m.camera.position.y - s.level).toFixed(2),
        room: s.room, roomAt: m.rig.roomAt(s.x, s.z),
        onFlight: m.rig.flightT(s.x, s.z) !== null };
    })()`);
    console.log('stop ' + label, JSON.stringify(at));
    return at;
  };

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

  /* the same cellar room probe-cellar.mjs walks into: the first door up the
     north arm. teleporting there is how the probe starts the climb, and the
     rig has to work out for itself that it is standing in the cellar. */
  const pick = await evaluate(`(() => {
    const m = window.__museum;
    const down = m.plan.rooms.filter((r) => r.floor === 'basement');
    const room = down.filter((r) => r.range === 'Basement North')
      .sort((a, b) => (a.entry.z - b.entry.z) || a.id.localeCompare(b.id))[0] || down[0];
    return { id: room.id, cat: room.cat, floor: room.floor, floorMat: room.floorMat };
  })()`);
  console.log('cellar room', JSON.stringify(pick));
  await evaluate(`window.__museum.rig.teleportTo(${JSON.stringify(pick.id)})`);
  await nap(1200);
  await stop('in ' + pick.cat + ', after teleporting in');
  await installWatcher();

  /* ── the climb ── */
  await walk('out through the door', Math.PI / 2, 2.2);
  await walk('back down the north arm', 0, 7.9);
  await walk('across the hall to the foot of the stair', 0, 2.0);
  await evaluate('window.__museum.rig.setYawPitch(0, 0.55)');
  await nap(900);
  await stop('on the flight, looking back down it');
  await walk('up the flight', 0, 5.6);
  await evaluate('window.__museum.rig.setYawPitch(0, 0)');
  await nap(900);
  await stop('at the head of the stair');
  await walk('into the rotunda', 0, 1.2);

  const end = await stop('ended');
  const seen = await watch();
  console.log('watch', JSON.stringify({
    steps: seen.steps, levelLo: +seen.levelLo.toFixed(2), levelHi: +seen.levelHi.toFixed(2),
    flips: seen.flips.length, flipOffFlight: seen.flipOffFlight,
    storeyWrong: seen.storeyWrong, wrong: seen.wrong, rooms: seen.roomsSeen
  }));
  console.log('flips', JSON.stringify(seen.flips));

  /* and the guided route: from here in the rotunda to a cellar room, the
     graph has to take the visitor down the flight, between the rails */
  const route = await evaluate(`(() => {
    const m = window.__museum, s = m.plan.stair;
    m.rig.teleportTo('rotunda');
    const ok = m.rig.walkTo(${JSON.stringify(pick.id)});
    const inWell = (p) => p.z >= s.z && p.z <= s.z + s.run && Math.abs(p.x - s.x) <= s.w / 2;
    const descent = (m.rig.touring ? m.rig.touring.legs : []).filter((l) => inWell(l.a) && inWell(l.b));
    const worst = descent.reduce((w, l) => Math.max(w, Math.abs(l.a.x - s.x), Math.abs(l.b.x - s.x)), 0);
    const out = { ok, legs: m.rig.touring ? m.rig.touring.legs.length : 0,
      descentLegs: descent.length, offCentreline: +worst.toFixed(2),
      rail: +(s.w / 2 - m.S.BODY_R).toFixed(2), total: m.rig.touring ? +m.rig.touring.total.toFixed(1) : null };
    m.rig.stopTour();
    return out;
  })()`);
  console.log('guided route', JSON.stringify(route));

  console.log('verdict', JSON.stringify({
    endsInRotunda: end.room === 'rotunda' && end.roomAt === 'rotunda',
    storeyAtEnd: end.storey, levelAtEnd: end.level, eyeOverSlab: end.eyeOverSlab,
    flips: seen.flips.length, flipsOffFlight: seen.flipOffFlight,
    storeyAgainstRoom: seen.storeyWrong,
    routeUsesStair: route.descentLegs > 0 && route.offCentreline <= route.rail
  }));
});
