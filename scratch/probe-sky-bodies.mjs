/* probe-sky-bodies.mjs — every body in sky.js, measured against the bloom
 * threshold the frame is actually running.
 *
 *   node scratch/probe-sky-bodies.mjs
 *
 * The bloom pass reads the linear HDR buffer before tone mapping, so the
 * number that decides whether a body glows is the linear luminance of the
 * brightest thing that body can put into a pixel — not the colour it is named
 * by. Each body is measured where it lives:
 *
 *   painted canvas  → the canvas's own texels, sRGB-decoded then weighted
 *   point field     → the brightest vertex colour, times the dot sprite's peak
 *   flat colour     → the material colour, times its opacity if it is blended
 *
 * and the frame numbers at the end say what the Cupola pays for: the mean
 * luminance with the pass on and off, and the same pair with the planet hidden,
 * which is the only way to tell a hazy photograph from a bright one.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const READ = `(() => {
  const m = window.__museum;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const luma = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  /* two peaks per canvas: the brightest texel on its own, and the brightest
     thing the texel can actually deliver once its own alpha has had its say.
     A ring painted at half alpha over a planet cannot put more than half of
     itself into the frame, and reading the RGB alone calls it a bloom source
     when it is a smudge. */
  const peakCanvas = (img) => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let peak = 0, at = null, lit = 0, litAt = null;
    for (let i = 0; i < d.length; i += 4) {
      const l = luma(d[i], d[i + 1], d[i + 2]);
      if (l > peak) { peak = l; at = [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
      const a = l * (d[i + 3] / 255);
      if (a > lit) { lit = a; litAt = [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
    }
    return { peak, at, lit, litAt };
  };
  const peakColors = (attr) => {
    let peak = 0, at = null;
    for (let i = 0; i < attr.count; i++) {
      const r = attr.getX(i), g = attr.getY(i), b = attr.getZ(i);
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l > peak) { peak = l; at = [+r.toFixed(3), +g.toFixed(3), +b.toFixed(3)]; }
    }
    return { peak, at };
  };

  let vault = null, stars = null, moon = null, planets = null, haze = null,
    earth = null, limb = null;
  m.sky.group.traverse((o) => {
    if (o.isPoints) { if (o.material.size === 6) planets = o; else stars = o; return; }
    if (!o.isMesh) return;
    if (o.renderOrder === -2) earth = o;
    else if (o.renderOrder === -1) limb = o;
    else if (o.material.map && o.geometry.type === 'SphereGeometry') vault = o;
    else if (o.geometry.type === 'PlaneGeometry') moon = o;
    else if (o.geometry.type === 'CylinderGeometry') haze = o;
  });

  const out = {};
  const dot = stars.material.map;
  const dc = document.createElement('canvas');
  dc.width = dot.image.width; dc.height = dot.image.height;
  const dx = dc.getContext('2d');
  dx.drawImage(dot.image, 0, 0);
  const dd = dx.getImageData(0, 0, dc.width, dc.height).data;
  let dotPeak = 0;
  for (let i = 0; i < dd.length; i += 4) dotPeak = Math.max(dotPeak, (dd[i + 3] / 255) * luma(dd[i], dd[i + 1], dd[i + 2]));

  const v = peakCanvas(vault.material.map.image);
  out.vault = { peak: v.peak, at: v.at, toneMapped: vault.material.toneMapped };

  const s = peakColors(stars.geometry.attributes.color);
  out.stars = { peak: s.peak * dotPeak, at: s.at, size: stars.material.size,
    opacity: stars.material.opacity, additive: true };

  const mo = peakCanvas(moon.material.map.image);
  out.moon = { peak: mo.lit * moon.material.opacity, at: mo.litAt, visible: moon.visible };

  const p = peakColors(planets.geometry.attributes.color);
  out.planets = { peak: p.peak * dotPeak, at: p.at, size: planets.material.size, additive: true };

  const hc = haze.material.color;
  out.haze = { peak: (0.2126 * hc.r + 0.7152 * hc.g + 0.0722 * hc.b) * haze.material.opacity,
    at: ['#' + hc.getHexString(), haze.material.opacity] };

  const e = peakCanvas(earth.material.map.image);
  /* the peak alone does not make a photograph hazy; the peak over a third of
     the disc does. This is the share of the planet's own texels the high pass
     would take. */
  const fracOver = (img, thr) => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let over = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      n++;
      if (luma(d[i], d[i + 1], d[i + 2]) > thr) over++;
    }
    return +(100 * over / n).toFixed(1);
  };
  out.earth = { peak: e.peak, at: e.at, over: fracOver(earth.material.map.image, 0.70),
    toneMapped: earth.material.toneMapped };

  const lb = peakCanvas(limb.material.map.image);
  out.limb = { peak: lb.lit, at: lb.litAt };

  /* what the Cupola frame actually pays for, with and without the planet */
  for (let i = 0; i < 60; i++) m.lighting.update(m.camera.position, 0.05);
  const frame = () => {
    m.view.render(0.016, m.camera);
    const gl = m.view.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, blown = 0, n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      sum += l; if (l > 235) blown++;
    }
    return { mean: +(sum / n).toFixed(1), clip: +(100 * blown / n).toFixed(2) };
  };
  const on = frame();
  m.view.bloom.enabled = false;
  const off = frame();
  m.view.bloom.enabled = true;
  /* the planet, painted black rather than hidden: hiding it opens the well
     through to the vault and the star field behind it, and then the field
     glows in the hole and the arithmetic says the planet costs nothing. A
     black disc keeps its depth, so everything else in the frame is the same
     frame it was, and the difference in haze is the planet's. */
  earth.material.color.setHex(0x000000);
  limb.material.color.setHex(0x000000);
  const noEarthOn = frame();
  m.view.bloom.enabled = false;
  const noEarthOff = frame();
  m.view.bloom.enabled = true;
  earth.material.color.setHex(0xffffff);
  limb.material.color.setHex(0xffffff);
  out.frame = { haze: +(on.mean - off.mean).toFixed(1), clip: on.clip,
    earthHaze: +((on.mean - off.mean) - (noEarthOn.mean - noEarthOff.mean)).toFixed(1),
    earthClip: +(on.clip - noEarthOn.clip).toFixed(2),
    threshold: +m.view.bloom.threshold.toFixed(2) };
  return out;
})()`;

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  /* the hour probe-bloom frames at, so the two scripts are reading one frame */
  for (let i = 0; i < 2; i++) {
    await evaluate(`(() => { const s = document.querySelector('input.time');
      s.value = '${13 * 60}'; s.dispatchEvent(new Event('input')); })()`);
    await nap(350);
  }
  await evaluate(`(() => { const m = window.__museum;
    m.rig.teleportTo('cupola');
    m.rig.state.x = 0.20; m.rig.state.z = 0.95;
    m.rig.setYawPitch(Math.atan2(0.20, 0.15), -1.50);
    m.rig.update(0.016); })()`);
  await nap(1200);
  const r = await evaluate(READ);
  const line = (k) => {
    const b = r[k];
    console.log(k.padEnd(8), 'peak luma', String(b.peak.toFixed(3)).padStart(6),
      b.peak > r.frame.threshold ? 'OVER 0.70 → glows' : 'under',
      (b.over === undefined ? '' : '· ' + b.over + '% of the disc over ') + JSON.stringify(b.at));
  };
  for (const k of ['vault', 'haze', 'stars', 'planets', 'moon', 'limb', 'earth']) line(k);
  console.log('cupola frame', JSON.stringify(r.frame));
});
