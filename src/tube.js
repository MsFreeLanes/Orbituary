/* The cellar's tubes and the light that comes out of them.
 *
 * A fluorescent tube with a failing starter does not wobble. It sits dark,
 * flashes once or twice, goes dark again, and either catches or gives up for a
 * few seconds. That shape has to be computed in two places — the light pool
 * needs it for the room's candela, and the fitting's own glow needs it for the
 * thing you can actually look at — and if the two files invent their own
 * versions they disagree and the room reads as a strobe with a steady lamp in
 * it. So the shape lives here, as a pure function of the wall clock and a phase
 * taken from the room's name: same room, same tube, same moment, everywhere.
 */

/* A phase in seconds, from the room's name. Two rooms on the same arm must
   never strike together, and the answer has to be stable across a reload so a
   screenshot and a probe see the same tube. */
export function tubePhase(id) {
  let h = 2166136261;
  for (const ch of String(id || '')) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
  return (h % 9973) / 9973 * 19.7;
}

/* k is how hard the tube is trying — 0.05 in the Accessibility room, 0.45 in
   Journalism. A worse starter strikes more often and sits darker between
   attempts. Returns a multiplier on the fixture's own level. */
export function tubeEnvelope(now, phase, k) {
  const s = now + phase;
  const T = 7 + 16 * (1 - k);            // seconds between attempts
  const cyc = Math.floor(s / T);
  const u = s - cyc * T;
  /* one number per attempt, used for how many flashes, how long each gap is,
     and whether this attempt catches at all */
  const r = Math.abs(Math.sin(cyc * 78.233 + phase * 3.11)) % 1;
  const tries = 1 + Math.floor(r * 3);   // one, two or three flashes
  const end = 0.28 + tries * 0.34;

  if (u < end) {
    let t = u;
    for (let i = 0; i < tries; i++) {
      const gap = 0.16 + 0.1 * ((r * (i + 3)) % 1);
      if (t < gap) return 0.05;                       // dark
      t -= gap;
      const flash = 0.07 + 0.05 * ((r * (i + 7)) % 1);
      if (t < flash) return 1.35 + 0.5 * ((r * (i + 2)) % 1);   // the strike
      t -= flash;
    }
    return r > 0.42 ? 0.55 : 0.05;      // caught and warming, or gave up
  }

  /* Between attempts the tube holds, and a failing one still beats a little:
     two sines at unrelated rates, phased off the same number as the strikes. */
  const w = 0.5 + 0.5 * Math.sin(now * 2.9 + phase) * Math.sin(now * 7.7 + phase * 1.7);
  const settled = 1 - k * (0.2 + 0.8 * w);
  const since = u - end;
  if (r > 0.42) return settled * (0.62 + 0.38 * Math.min(1, since / 1.1));
  // it failed: dark for a beat, then it comes back on its own, and stops there
  return settled * Math.max(0.06, Math.min(1, 0.06 + (since - 2.4) / 2.0));
}
