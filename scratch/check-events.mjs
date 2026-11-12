/* stress the ambient event scheduler: 55 hours of walking, and check the
   rules that keep the building from reading as a random number generator. */
import { createScheduler } from '../src/events.js';

const ROOMS = ['gaming', 'creative', 'media', 'privacy', 'tools', 'dev',
  'android', 'shopping', 'ai', 'reading', 'linux', 'fun'];

const s = createScheduler(20261111);
const seq = [], rooms = [], times = [];
const state = { touring: false, room: 'rotunda', rooms: ROOMS };

for (let now = 0; now < 200000; now++) {
  const e = s.next(now, state);
  if (e) { seq.push(e.type); rooms.push(e.room); times.push(e.at); }
}

const fail = [];
/* 1. never two peeks back to back */
for (let i = 1; i < seq.length; i++) {
  if (seq[i] === 'peek' && seq[i - 1] === 'peek') fail.push(`peek twice in a row at #${i}`);
}
/* 2. never three of one kind inside any five */
for (let i = 0; i + 5 <= seq.length; i++) {
  const win = seq.slice(i, i + 5);
  for (const t of new Set(win)) {
    if (win.filter((x) => x === t).length >= 3) fail.push(`three ${t} inside five at #${i}`);
  }
}
/* 3. a room never fires twice inside ROOM_COOL */
const lastSeen = new Map();
for (let i = 0; i < rooms.length; i++) {
  const prev = lastSeen.get(rooms[i]);
  if (prev !== undefined && times[i] - prev <= 90) fail.push(`${rooms[i]} twice in ${times[i] - prev}s at #${i}`);
  lastSeen.set(rooms[i], times[i]);
}
/* 4. gaps stay inside the designed band */
let minGap = Infinity, maxGap = 0;
for (let i = 1; i < times.length; i++) {
  const g = times[i] - times[i - 1];
  if (g < minGap) minGap = g;
  if (g > maxGap) maxGap = g;
}
if (minGap < 60) fail.push(`gap of ${minGap}s below GAP_MIN`);
if (maxGap > 140) fail.push(`gap of ${maxGap}s above GAP_MIN+GAP_JITTER`);
/* 5. nothing in the first 45 seconds */
if (times.length && times[0] < 45) fail.push(`first event at ${times[0]}s, before LEAD_IN`);
/* 6. the current room is never the target */
if (rooms.includes('rotunda')) fail.push('fired at the visitor room');

/* 7. a guided walk silences the building */
const s2 = createScheduler(7);
let fired = 0;
for (let now = 0; now < 4000; now++) if (s2.next(now, { touring: true, room: 'ai', rooms: ROOMS })) fired++;
if (fired) fail.push(`${fired} events during a tour`);

const counts = {};
for (const t of seq) counts[t] = (counts[t] || 0) + 1;
const per10min = (seq.length / (200000 / 600)).toFixed(1);

console.log(JSON.stringify({
  events: seq.length, per10min, minGap, maxGap, counts,
  roomsUsed: [...new Set(rooms)].length, fail: fail.slice(0, 8), verdict: fail.length ? 'FAIL' : 'ok'
}, null, 1));
