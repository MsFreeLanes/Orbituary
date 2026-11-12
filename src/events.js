/* ── events ──────────────────────────────────────────────────────────────
   The building doing something when you are not looking at it. A light
   coming up in another room, a door somewhere off in the dark, footsteps
   that stop.

   The scheduling is the whole craft here. Real ambience is not random: it
   never fires twice in a row of the same kind, never twice in the same room
   inside a minute and a half, never while you are being walked somewhere,
   and never in the first three quarters of a minute after you arrive, when
   you are still finding your feet. Roughly six in ten minutes, which is
   about how often a real building clears its throat. */

const GAP_MIN = 60, GAP_JITTER = 80;
const ROOM_COOL = 90;
const LEAD_IN = 45;

export function createScheduler(seed = 1) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  const TYPES = ['peek', 'peek', 'door', 'steps', 'chime', 'breath'];
  let bag = [];
  let nextAt = LEAD_IN;
  const history = [];
  const roomLast = new Map();
  let bornAt = 0;

  function drawBag() {
    bag = TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
    }
  }

  function takeType() {
    if (!bag.length) drawBag();
    let type = bag.pop();
    let guard = 0;
    /* never a third of one kind inside any five, and never two peeks back to
       back — a peek is the loudest of these and reads as a cheat if repeated */
    const crowded = (t) => history.slice(-5).filter((h) => h === t).length >= 2;
    while ((crowded(type) || (type === 'peek' && history[history.length - 1] === 'peek')) && guard++ < 12) {
      if (!bag.length) drawBag();
      type = bag.pop();
    }
    return type;
  }

  /* now is seconds since the visitor arrived. state carries where they are
     and whether a guided walk is running. */
  function next(now, state) {
    if (now < bornAt + LEAD_IN) return null;
    if (state && state.touring) return null;
    if (now < nextAt) return null;

    /* pick the room first: a type drawn for an event that cannot fire would
       still burn its place in the anti-repetition history */
    const pool = (state && state.rooms ? state.rooms : []).filter((id) => {
      const last = roomLast.get(id);
      return last === undefined || now - last > ROOM_COOL;
    }).filter((id) => id !== (state && state.room));
    if (!pool.length) return null;

    const type = takeType();
    history.push(type);
    if (history.length > 12) history.shift();

    const room = pool[(rand() * pool.length) | 0];
    roomLast.set(room, now);
    nextAt = now + GAP_MIN + rand() * GAP_JITTER;
    return { type, room, at: now };
  }

  return {
    next,
    reset(now) { bornAt = now; nextAt = now + LEAD_IN; history.length = 0; roomLast.clear(); },
    get stats() { return { history: history.slice(), nextAt }; }
  };
}
