/* check-lift.mjs — the lift, end to end.
 *   node scratch/check-lift.mjs
 * The lift is a hole in two floors with a box in it, so the things worth
 * asserting are the ones that would be embarrassing if they were wrong: that
 * the cabin carries the visitor the whole 3.60 m and hands them over at the
 * right height; that the storey, the HUD's room and the light pool all change
 * at the door rather than halfway down the shaft; that the glass between the
 * stair and the shaft is solid at the height of the flight; and that the cabin
 * goes back to the rotunda on its own, because a top dock without a cabin in it
 * is a hole you can walk into.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++; };

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4800);
  await evaluate('window.__museum.hud.hideIntro()');

  const boot = await evaluate(`(() => { const m = window.__museum;
    const L = m.built.lift; if (!L) return 'no lift handle';
    m.rig.teleportTo('rotunda');
    const s = m.rig.state;
    s.x = L.x; s.z = L.z; s.yaw = Math.PI; s.pitch = 0;
    m.rig.update(0.05);
    return { x: L.x, z: L.z, top: L.top, bottom: L.bottom, ride: L.ride,
      cabin: L.cabin.position.y, storey: s.storey, level: s.level,
      inLift: m.rig.inLift(L.x, L.z),
      /* the shaft's glass at the height of the flight, and the mouth of the
         shaft at the landing, where it is meant to be open */
      glass: m.rig.blocked(L.x - 0.45, (m.plan.stair.z + m.plan.stair.run * 0.5), 'ground'),
      mouth: m.rig.blocked(L.x, m.plan.stair.z + 0.25, 'ground') };
  })()`);
  if (typeof boot === 'string') { console.log('FAIL ' + boot); fails++; }
  else {
    ok(boot.inLift, 'the rig knows the cabin is a place to stand');
    ok(boot.glass, 'the partition between the stair and the shaft is solid');
    ok(!boot.mouth, 'the shaft door is not blocked');
    ok(Math.abs(boot.cabin - boot.top) < 0.01, 'the cabin starts at the rotunda dock');
  }

  /* down */
  const down = await evaluate(`(() => { const m = window.__museum, S = m.S;
    const called = m.rig.callLift();
    const mid = [];
    for (let i = 0; i < 140; i++) {
      m.rig.update(0.05);
      if (i === 40 || i === 70) mid.push({ t: m.built.lift.cabin.position.y, s: m.rig.state.storey, l: m.rig.state.level });
    }
    const s = m.rig.state, L = m.built.lift;
    return { called, mid, storey: s.storey, level: s.level, cam: m.camera.position.y,
      cabin: L.cabin.position.y, bottom: L.bottom, top: L.top,
      ride: s.ride, room: s.room, x: s.x, z: s.z };
  })()`);
  ok(down.called, 'the lift answers E when you are standing in it');
  ok(down.ride === null, 'the ride ends');
  ok(Math.abs(down.cabin - down.bottom) < 0.01, `the cabin reached ${down.cabin.toFixed(2)} of ${down.bottom}`);
  ok(down.storey === 'basement', 'the visitor arrived on the cellar storey');
  ok(Math.abs(down.level - down.bottom) < 0.02, `the floor under the feet is ${down.level.toFixed(2)}`);
  ok(Math.abs(down.cam - (down.bottom + 1.65)) < 0.06, `the eye is at ${down.cam.toFixed(2)}`);
  ok(down.mid.every((p) => p.s === 'ground'), 'the storey does not flip halfway down the shaft');
  ok(down.mid.every((p) => p.t < -0.5 && p.t > -3.4), 'mid-ride the cabin is between the two floors');
  ok(down.mid[1].t < down.mid[0].t, 'and it is still going down');

  /* out of the cabin, and the cabin goes back up on its own */
  const back = await evaluate(`(() => { const m = window.__museum;
    const s = m.rig.state; s.z = m.plan.stair.z + m.plan.stair.run + 1.2;
    for (let i = 0; i < 200; i++) m.rig.update(0.05);
    return { cabin: m.built.lift.cabin.position.y, storey: s.storey };
  })()`);
  ok(back.storey === 'basement', 'the visitor is still downstairs');
  ok(Math.abs(back.cabin) < 0.02, `the cabin parked itself at the top dock (${back.cabin.toFixed(2)})`);

  /* up again */
  const up = await evaluate(`(() => { const m = window.__museum;
    const s = m.rig.state, L = m.built.lift;
    s.x = L.x; s.z = L.z;
    m.rig.update(0.05);
    const called = m.rig.callLift();
    for (let i = 0; i < 140; i++) m.rig.update(0.05);
    return { called, storey: s.storey, level: s.level, cabin: L.cabin.position.y, cam: m.camera.position.y };
  })()`);
  ok(up.called, 'the lift answers from the cellar dock too');
  ok(up.storey === 'ground', 'the visitor came back up');
  ok(Math.abs(up.level) < 0.02, `the rotunda floor is at ${up.level.toFixed(2)}`);
  ok(Math.abs(up.cabin) < 0.02, 'the cabin is at the top dock with them');

  /* and the refusal: E away from the lift should not move anybody */
  const no = await evaluate(`(() => { const m = window.__museum;
    const s = m.rig.state; s.x = 0; s.z = 0; m.rig.update(0.05);
    const before = { x: s.x, z: s.z, storey: s.storey };
    const called = m.rig.callLift();
    m.rig.update(0.05);
    return { called, same: s.x === before.x && s.z === before.z && s.storey === before.storey };
  })()`);
  ok(no.called === false && no.same, 'E away from the lift does nothing but tell you where the lift is');

  console.log(fails ? `\ncheck-lift: ${fails} FAIL` : '\ncheck-lift: the lift carries one person and a box of books');
  process.exitCode = fails ? 1 : 0;
});
