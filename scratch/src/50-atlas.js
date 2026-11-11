/* ── 06 · labels ─────────────────────────────────────────────────────────
   Every word that appears inside the 3D room is drawn once into one canvas
   atlas — 88 plaques and 12 wing banners, two texture binds in total. The
   plaques share a single InstancedMesh; a custom shader picks the right tile
   per instance and paints the reverse side in the wing's colour, so the room
   still reads beautifully from above and from outside. */
const FONTS = {
  display: "600 {size}px 'Bahnschrift', 'Segoe UI Semibold', 'Segoe UI', system-ui, sans-serif",
  body: "{weight} {size}px 'Segoe UI', system-ui, sans-serif",
  mono: "{weight} {size}px 'Cascadia Code', Consolas, monospace"
};
const font = (kind, size, weight) => FONTS[kind]
  .replace('{size}', size)
  .replace('{weight}', weight || '400');

function roundRect(ctx, px, py, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + w, py, px + w, py + h, r);
  ctx.arcTo(px + w, py + h, px, py + h, r);
  ctx.arcTo(px, py + h, px, py, r);
  ctx.arcTo(px, py, px + w, py, r);
  ctx.closePath();
}

/* Word wrap that never pretends a hyphenated remainder is a whole word. */
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  let remainder = false;
  for (let i = 0; i < words.length; i++) {
    const attempt = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) { remainder = true; break; }
    } else {
      line = attempt;
    }
  }
  if (!remainder && lines.length < maxLines && line) lines.push(line);
  /* anything we had to leave out is shown as an ellipsis, not silence */
  if (lines.length === maxLines &&
      (remainder || ctx.measureText(lines[maxLines - 1]).width > maxWidth)) {
    let last = lines[maxLines - 1];
    while (last.length > 4 && ctx.measureText(last + '…').width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last.replace(/[\s,;:]+$/, '') + '…';
  }
  return lines;
}

/* Letterspacing, since canvas has no tracking property and museum labels live
   and die by their tracking. */
function drawTracked(ctx, text, x, y, tracking) {
  let cursor = x;
  for (const ch of String(text)) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  return cursor - x - tracking;
}
function measureTracked(ctx, text, tracking) {
  let w = 0;
  for (const ch of String(text)) w += ctx.measureText(ch).width + tracking;
  return w - tracking;
}
function rightTracked(ctx, text, right, y, tracking) {
  drawTracked(ctx, text, right - measureTracked(ctx, text, tracking), y, tracking);
}

/* One plaque tile: an acrylic label with a coloured rule, an accession number,
   the exhibit's name, what it is, and where it lives. */
function drawPlaqueTile(ctx, px, py, link, number) {
  const S = CFG.tilePx;
  const hex = WING_HEX[link.c];
  const pad = Math.round(S * 0.105);
  const inner = S - pad * 2;

  ctx.save();
  roundRect(ctx, px + 3, py + 3, S - 6, S - 6, Math.round(S * 0.09));
  const panel = ctx.createLinearGradient(px, py, px, py + S);
  panel.addColorStop(0, 'rgba(24,27,41,0.97)');
  panel.addColorStop(0.55, 'rgba(15,17,27,0.97)');
  panel.addColorStop(1, 'rgba(9,10,18,0.97)');
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, S * 0.006);
  ctx.strokeStyle = hex + '55';
  ctx.stroke();
  ctx.clip();

  /* sheen: a soft light from the upper left, like a spotlight on acrylic */
  const sheen = ctx.createLinearGradient(px, py, px + S, py + S);
  sheen.addColorStop(0, 'rgba(255,255,255,0.075)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0.012)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(px, py, S, S);

  /* accession number, top right, in the wing's colour */
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = font('mono', Math.round(S * 0.062), '600');
  ctx.fillStyle = hex + 'cc';
  drawTracked(ctx, pad2(number), px + S - pad - Math.round(S * 0.10), py + pad + Math.round(S * 0.075), S * 0.012);

  /* wing, top left */
  ctx.font = font('body', Math.round(S * 0.052), '700');
  ctx.fillStyle = hex;
  drawTracked(ctx, link.c.toUpperCase(), px + pad, py + pad + Math.round(S * 0.062), S * 0.022);

  /* the rule */
  ctx.fillStyle = hex + '66';
  ctx.fillRect(px + pad, py + pad + Math.round(S * 0.10), inner, Math.max(1, S * 0.005));

  /* name */
  const nameSize = Math.round(S * (link.n.length > 18 ? 0.098 : 0.118));
  ctx.font = font('display', nameSize);
  const nameLines = wrapLines(ctx, link.n, inner, 3);
  let cursorY = py + pad + Math.round(S * 0.235);
  ctx.fillStyle = '#f2f5ff';
  nameLines.forEach((line, i) => {
    drawTracked(ctx, line, px + pad, cursorY + i * Math.round(nameSize * 1.14), S * 0.004);
  });
  cursorY += nameLines.length * Math.round(nameSize * 1.14);

  /* what it is — as many lines as are left between the name and the footer */
  ctx.font = font('body', Math.round(S * 0.062), '400');
  ctx.fillStyle = 'rgba(190,199,226,0.86)';
  const descTop = cursorY + Math.round(S * 0.075);
  const descRoom = (py + S - pad - Math.round(S * 0.03)) - descTop;
  const descLine = Math.round(S * 0.082);
  const descLines = wrapLines(ctx, link.d, inner, Math.max(1, Math.floor(descRoom / descLine)));
  descLines.forEach((line, i) => {
    ctx.fillText(line, px + pad, descTop + i * descLine);
  });

  /* where it lives — the "OPEN ↗" mark owns the right end of the footer, so the
     domain gets the tile width minus both margins minus whatever that mark needs */
  ctx.font = font('mono', Math.round(S * 0.052), '400');
  ctx.fillStyle = 'rgba(122,133,166,0.9)';
  const room = (S - pad * 2) - Math.round(S * 0.3);
  let host = hostOf(link.u);
  while (host.length > 4 && ctx.measureText(host + '…').width > room) host = host.slice(0, -1);
  if (host !== hostOf(link.u)) host += '…';
  ctx.fillText(host, px + pad, py + S - pad - Math.round(S * 0.02));
  ctx.fillStyle = hex;
  rightTracked(ctx, 'OPEN', px + S - pad - Math.round(S * 0.085), py + S - pad - Math.round(S * 0.02), S * 0.02);
  ctx.textAlign = 'right';
  ctx.font = font('body', Math.round(S * 0.058), '700');
  ctx.fillText('↗', px + S - pad, py + S - pad - Math.round(S * 0.02));
  ctx.textAlign = 'left';

  ctx.restore();
}

/* One banner tile: the wing's name, hung above its hall. */
function drawBannerTile(ctx, px, py, wing) {
  const W = CFG.bannerTile.w, H = CFG.bannerTile.h;
  ctx.save();
  const bg = ctx.createLinearGradient(px, py, px, py + H);
  bg.addColorStop(0, 'rgba(20,23,36,0.0)');
  bg.addColorStop(0.5, 'rgba(16,18,30,0.85)');
  bg.addColorStop(1, 'rgba(12,13,22,0.0)');
  ctx.fillStyle = bg;
  ctx.fillRect(px, py, W, H);
  ctx.fillStyle = wing.hex;
  ctx.fillRect(px + 18, py + H * 0.5 - 1, W - 36, 2);
  ctx.font = font('display', 54);
  ctx.fillStyle = '#f4f7ff';
  const label = wing.name.toUpperCase();
  const tracking = 8;
  const w = measureTracked(ctx, label, tracking);
  drawTracked(ctx, label, px + (W - w) / 2, py + H * 0.5 - 14, tracking);
  ctx.font = font('mono', 22, '400');
  ctx.fillStyle = wing.hex + 'dd';
  const sub = wing.count + (wing.count === 1 ? ' EXHIBIT' : ' EXHIBITS');
  const sw = measureTracked(ctx, sub, 4);
  drawTracked(ctx, sub, px + (W - sw) / 2, py + H * 0.5 + 34, 4);
  ctx.restore();
}

/* An emblem per wing: geometric, drawn here, belonging to nothing but this
   museum. Twelve different marks so each hall can be recognised from across
   the rotunda — the arch above a doorway, in effect. */
function drawEmblem(ctx, cx, cy, size, name, hex) {
  const r = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = hex;
  ctx.fillStyle = hex;
  ctx.lineWidth = Math.max(1.5, size * 0.055);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const poly = (points, close) => {
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = p[0] * r, y = p[1] * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    if (close !== false) ctx.closePath();
    ctx.stroke();
  };
  const dot = (x, y, rad) => {
    ctx.beginPath(); ctx.arc(x * r, y * r, rad * size, 0, TAU); ctx.fill();
  };
  if (name === 'Gaming') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0);
    ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5); ctx.stroke();
    dot(-0.62, -0.62, 0.055); dot(0.62, 0.62, 0.055);
  } else if (name === 'Creative') {
    [[-0.3, 0.12], [0.3, 0.12], [0, -0.3]].forEach((p) => {
      ctx.beginPath(); ctx.arc(p[0] * r, p[1] * r, r * 0.52, 0, TAU); ctx.stroke();
    });
  } else if (name === 'Media') {
    poly([[-0.45, -0.62], [0.62, 0], [-0.45, 0.62]]);
    ctx.beginPath();
    [-0.85, -0.7].forEach((x) => {
      ctx.moveTo(x * r, -r * 0.5); ctx.lineTo(x * r, r * 0.5);
    });
    ctx.stroke();
  } else if (name === 'Privacy') {
    const sides = [];
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 - Math.PI / 2;
      sides.push([Math.cos(a) * 0.92, Math.sin(a) * 0.92]);
    }
    poly(sides);
    ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.26, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, 0); ctx.lineTo(r * 0.12, 0);
    ctx.lineTo(r * 0.2, r * 0.5); ctx.lineTo(-r * 0.2, r * 0.5);
    ctx.closePath(); ctx.stroke();
  } else if (name === 'Tools') {
    const sides = [];
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      sides.push([Math.cos(a) * 0.88, Math.sin(a) * 0.88]);
    }
    poly(sides);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, TAU); ctx.stroke();
  } else if (name === 'Dev') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.6); ctx.lineTo(-r * 0.85, 0); ctx.lineTo(-r * 0.35, r * 0.6);
    ctx.moveTo(r * 0.35, -r * 0.6); ctx.lineTo(r * 0.85, 0); ctx.lineTo(r * 0.35, r * 0.6);
    ctx.moveTo(r * 0.12, -r * 0.7); ctx.lineTo(-r * 0.12, r * 0.7); ctx.stroke();
  } else if (name === 'Android') {
    roundRect(ctx, -r * 0.62, -r * 0.86, r * 1.24, r * 1.72, r * 0.16);
    ctx.stroke();
    [[-0.28, -0.5], [0, -0.5], [0.28, -0.5], [-0.28, 0], [0, 0], [0.28, 0]].forEach((p) => dot(p[0], p[1], 0.045));
  } else if (name === 'Shopping') {
    poly([[-0.72, -0.28], [0.72, -0.28], [0.5, 0.72], [-0.5, 0.72]]);
    ctx.beginPath();
    ctx.arc(0, -0.28 * r, r * 0.42, Math.PI, 0); ctx.stroke();
  } else if (name === 'AI') {
    const left = [[-0.7, -0.5], [-0.7, 0.5]], right = [[0.7, -0.62], [0.7, 0], [0.7, 0.62]];
    ctx.beginPath();
    left.forEach((a) => right.forEach((b) => {
      ctx.moveTo(a[0] * r, a[1] * r); ctx.lineTo(b[0] * r, b[1] * r);
    }));
    ctx.stroke();
    left.concat(right).forEach((p) => dot(p[0], p[1], 0.07));
  } else if (name === 'Reading') {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.quadraticCurveTo(-r * 0.6, -r * 0.75, -r * 0.9, -r * 0.45);
    ctx.lineTo(-r * 0.9, r * 0.55);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.3, 0, r * 0.55);
    ctx.quadraticCurveTo(r * 0.55, r * 0.3, r * 0.9, r * 0.55);
    ctx.lineTo(r * 0.9, -r * 0.45);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.75, 0, -r * 0.55);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.55); ctx.stroke();
  } else if (name === 'Linux') {
    roundRect(ctx, -r * 0.9, -r * 0.7, r * 1.8, r * 1.4, r * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.3); ctx.lineTo(-r * 0.3, -r * 0.02); ctx.lineTo(-r * 0.62, r * 0.26);
    ctx.moveTo(-r * 0.02, r * 0.3); ctx.lineTo(r * 0.55, r * 0.3); ctx.stroke();
  } else if (name === 'Fun') {
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    dot(0, 0, 0.1);
  } else {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

/* One hall tile: the sign over a doorway — an arch, the wing's own emblem,
   the wing's name, and how much is behind the door. */
function drawHallTile(ctx, px, py, wing) {
  const W = CFG.hallTile.w, H = CFG.hallTile.h;
  const hex = wing.hex;
  ctx.save();
  ctx.translate(px, py);

  /* the arch itself: a doorway, not a rectangle */
  ctx.strokeStyle = hex + '99';
  ctx.lineWidth = 3;
  const inset = W * 0.055;
  ctx.beginPath();
  ctx.moveTo(inset, H * 0.97);
  ctx.lineTo(inset, H * 0.34);
  ctx.quadraticCurveTo(inset, H * 0.06, W * 0.5, H * 0.06);
  ctx.quadraticCurveTo(W - inset, H * 0.06, W - inset, H * 0.34);
  ctx.lineTo(W - inset, H * 0.97);
  ctx.stroke();

  /* a keystone mark at the crown of the arch */
  ctx.fillStyle = hex + 'cc';
  ctx.fillRect(W * 0.5 - 14, H * 0.045, 28, 4);

  drawEmblem(ctx, W * 0.5, H * 0.30, W * 0.15, wing.name, hex);

  /* the name */
  ctx.fillStyle = '#f4f7ff';
  const label = wing.name.toUpperCase();
  let size = Math.round(W * 0.115);
  ctx.font = font('display', size);
  let tracking = size * 0.10;
  while (measureTracked(ctx, label, tracking) > W * 0.78 && size > 20) {
    size -= 2;
    tracking = size * 0.10;
    ctx.font = font('display', size);
  }
  drawTracked(ctx, label, (W - measureTracked(ctx, label, tracking)) / 2, H * 0.62, tracking);

  /* the rule, then the count */
  ctx.fillStyle = hex + '88';
  ctx.fillRect(W * 0.28, H * 0.70, W * 0.44, 2);
  ctx.font = font('mono', Math.round(W * 0.045), '500');
  ctx.fillStyle = hex + 'dd';
  const sub = wing.count + (wing.count === 1 ? ' EXHIBIT' : ' EXHIBITS');
  drawTracked(ctx, sub, (W - measureTracked(ctx, sub, 3)) / 2, H * 0.82, 3);

  ctx.restore();
}

/* Build the atlases and their textures. */
const labels = {
  plaque: null, banner: null, hall: null,
  plaqueTex: null, bannerTex: null, hallTex: null
};

function atlasTexture(sheet) {
  const t = new THREE.CanvasTexture(sheet);
  t.encoding = THREE.sRGBEncoding;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function buildAtlases() {
  const P = CFG.tilePx;
  const sheet = document.createElement('canvas');
  sheet.width = CFG.atlasCols * P;
  sheet.height = CFG.atlasRows * P;
  const ctx = sheet.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  LINKS.forEach((link, i) => {
    const col = i % CFG.atlasCols, row = Math.floor(i / CFG.atlasCols);
    drawPlaqueTile(ctx, col * P, row * P, link, i + 1);
  });
  labels.plaque = sheet;
  labels.plaqueTex = atlasTexture(sheet);
  labels.plaqueTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const BW = CFG.bannerTile.w, BH = CFG.bannerTile.h;
  const cloth = document.createElement('canvas');
  cloth.width = CFG.bannerCols * BW;
  cloth.height = CFG.bannerRows * BH;
  const bctx = cloth.getContext('2d');
  bctx.textBaseline = 'alphabetic';
  bctx.textAlign = 'left';
  plan.wings.forEach((wing, i) => {
    const col = i % CFG.bannerCols, row = Math.floor(i / CFG.bannerCols);
    drawBannerTile(bctx, col * BW, row * BH, wing);
  });
  labels.banner = cloth;
  labels.bannerTex = atlasTexture(cloth);

  const HW = CFG.hallTile.w, HH = CFG.hallTile.h;
  const sign = document.createElement('canvas');
  sign.width = CFG.hallCols * HW;
  sign.height = CFG.hallRows * HH;
  const sctx = sign.getContext('2d');
  sctx.textBaseline = 'alphabetic';
  sctx.textAlign = 'left';
  plan.wings.forEach((wing, i) => {
    const col = i % CFG.hallCols, row = Math.floor(i / CFG.hallCols);
    drawHallTile(sctx, col * HW, row * HH, wing);
  });
  labels.hall = sign;
  labels.hallTex = atlasTexture(sign);
}

/* Tile origin for an index in an atlas: canvas textures are flipped in v, so
   the top row of the canvas sits at the top of the uv square. */
function tileOrigin(index, cols, rows) {
  const col = index % cols, row = Math.floor(index / cols);
  return [col / cols, 1 - (row + 1) / rows];
}

/* The instanced panel material. One program serves plaques and banners:
   the front shows its atlas tile, the reverse shows a coloured backing board,
   and fog is applied by hand because this program opts out of three's chunks. */
const PANEL_SHADER = {
  vertex: [
    'attribute vec2 aTile;',
    'attribute float aAlpha;',
    'attribute float aGlow;',
    'attribute vec3 aWing;',
    'uniform vec2 uTileSize;',
    'varying vec2 vUv;',
    'varying vec2 vLocal;',
    'varying float vAlpha;',
    'varying float vGlow;',
    'varying vec3 vWing;',
    'varying float vDepth;',
    'void main(){',
    '  vLocal = uv;',
    '  vUv = aTile + uv * uTileSize;',
    '  vAlpha = aAlpha;',
    '  vGlow = aGlow;',
    '  vWing = aWing;',
    '  vec4 world = vec4(position, 1.0);',
    '  #ifdef USE_INSTANCING',
    '    world = instanceMatrix * world;',
    '  #endif',
    '  vec4 mv = modelViewMatrix * world;',
    '  vDepth = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n'),
  fragment: [
    'uniform sampler2D uAtlas;',
    'uniform vec3 uFogColor;',
    'uniform float uFogDensity;',
    'uniform float uBoost;',
    'varying vec2 vUv;',
    'varying vec2 vLocal;',
    'varying float vAlpha;',
    'varying float vGlow;',
    'varying vec3 vWing;',
    'varying float vDepth;',
    'void main(){',
    '  vec3 rgb;',
    '  float alpha;',
    '  if (gl_FrontFacing) {',
    '    vec4 tex = texture2D(uAtlas, vUv);',
    '    if (tex.a * vAlpha < 0.02) discard;',
    '    float lift = 0.86 + 0.14 * vLocal.y;',                 // light falls from above
    '    rgb = tex.rgb * lift * (1.0 + vGlow * 0.9);',
    '    alpha = tex.a * vAlpha;',
    '  } else {',
    '    if (vAlpha < 0.02) discard;',
    '    vec2 q = abs(vLocal - 0.5) * 2.0;',
    '    float edge = max(q.x, q.y);',
    '    float frame = smoothstep(0.72, 0.99, edge);',
    '    float mark = 1.0 - smoothstep(0.04, 0.10, length(vLocal - 0.5));',
    '    rgb = mix(vec3(0.035, 0.04, 0.075), vWing, frame * 0.7 + mark * 0.85) * (1.0 + vGlow * 0.5);',
    '    alpha = vAlpha;',
    '  }',
    '  float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);',
    '  rgb = mix(rgb, uFogColor, clamp(fog, 0.0, 1.0));',
    '  gl_FragColor = vec4(rgb * uBoost, alpha);',
    '}'
  ].join('\n')
};

function panelMaterial(texture, cols, rows, opts) {
  const options = opts || {};
  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: texture },
      uTileSize: { value: new THREE.Vector2(1 / cols, 1 / rows) },
      uFogColor: { value: new THREE.Color(CFG.fogColor) },
      uFogDensity: { value: CFG.fogDensity },
      uBoost: { value: options.boost === undefined ? 1.0 : options.boost }
    },
    vertexShader: PANEL_SHADER.vertex,
    fragmentShader: PANEL_SHADER.fragment,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: options.flat ? false : true
  });
}
