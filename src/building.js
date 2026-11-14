/* ── building ────────────────────────────────────────────────────────────
   The shell: floors, walls with real openings, ceilings, the rotunda drum
   and its cupola, the pressure hull over the whole wheel, the stair down to
   the cellar, viewport frames and glazing, and a plinth for every exhibit.

   The shell is painted from six tokens — PALETTE, in materials.js. The hull,
   the frames, the structural metal and the ceiling fittings are panel and
   panel-shadow sitting against the void; the palette's cyan and amber are
   kept for the lit edges and the markers, because those are the parts of the
   silhouette that have to survive being eighty metres away. The floors and
   the museum's own finishes — marble, oak, brick, plaster, carpet, velvet —
   keep what they were: this is the station's skin, not the exhibits, and the
   rooms' colours are replaced by a separate step that has not landed yet.

   Walls are built as runs of boxes with the texture tiling baked into the
   geometry UVs, so one material per surface type serves the whole building
   and nothing is stretched. Every wall opening is a real hole — you can walk
   through it, and the light outside comes through it.

   Both storeys come out of the same builder: the plan says what floor a room
   or a corridor is on, and one offset puts its whole shell on that floor. The
   two storeys are joined by one thing, the stair, and it is joined by a hole:
   the same rectangle missing from the rotunda floor and the stair hall's
   ceiling.

   Fifty-one spaces is a great many boxes, and a box that is its own mesh
   costs a draw call — which, not the triangles, is what a walk pays for. So
   the pieces are no longer handed to the renderer one at a time: each one is
   filed under its material and welded into a single buffer per room
   (`batch`), and anything repeated at the same size — a plinth, a pilaster —
   becomes an InstancedMesh instead. A wall run and a window frame cannot be
   instances of one geometry, because they are not the same size; they can
   still be one buffer, because the transform is baked in before the weld and
   the UVs were written before that.

   And the twelve ranges are independent of each other, so the frame no longer
   submits the eleven you cannot see from where you are standing. That is
   `spokeCull`, at the bottom of the file. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S } from './scale.js';
import { PALETTE } from './materials.js';
import { LINKS } from './data.js';
import {
  plaqueSheets, roomSign, uvRect, rulesBoardTexture, trophyPlaqueTexture,
  wantedCardTexture, counterSignTexture
} from './signage.js';
import { furnish, furnishRotunda } from './props.js';
import { cellarArm, stairHall } from './atmosphere.js';
import { tubeEnvelope, tubePhase } from './tube.js';

const TAU = Math.PI * 2;

/* which storey an object's shell is drawn on. the plan says what floor a room
   or a corridor is on; this is the only place that turns that into a height,
   and every room and corridor below hangs its whole group off it, so the
   cellar can sit under the rotunda without a second copy of the builder. */
const yOf = (o) => (o.floor === 'basement' ? S.FLOOR_BASE : 0);

/* a box whose UVs repeat the texture every `scale` metres on every face */
function boxUV(w, h, d, scale) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faces[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * su / scale, uv.getY(k) * sv / scale);
    }
  }
  uv.needsUpdate = true;
  return g;
}

/* scale an existing geometry's UVs so a texture keeps its real-world tiling
   on curved surfaces (cylinders, spheres, discs) the way boxUV does for walls */
function uvScale(geo, ru, rv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  uv.needsUpdate = true;
  return geo;
}

function planeUV(w, d, scale) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * w / scale, uv.getY(i) * d / scale);
  }
  uv.needsUpdate = true;
  return g;
}

/* ── welding the shell ───────────────────────────────────────────────────
   `put` takes a piece of shell, bakes its transform into the vertices and
   files it under its material; `flush` welds each pile into one mesh and
   hands it to the group. The weld happens after the UVs are written, so the
   tiling a wall was given survives it, and it happens in the group's own
   frame, so a room's whole shell is still one transform on the CPU.

   One mesh per (group, material) is the floor for anything whose pieces are
   all different sizes. The shadow flags are the pile's, not the piece's: a
   wall that casts and a shelf that does not are different materials, so in
   practice no pile ever mixes them, and where one did the cast wins. */
function batch(parent) {
  const piles = new Map();
  const p = new THREE.Vector3(), e = new THREE.Euler(),
    q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1),
    m = new THREE.Matrix4();
  return {
    put(geo, mat, x, y, z, o) {
      o = o || {};
      e.set(o.rx || 0, o.ry || 0, o.rz || 0);
      q.setFromEuler(e);
      m.compose(p.set(x, y, z), q, one);
      /* kit geometries are shared between rooms, so a weld must not bend the
         copy everybody else is standing on */
      const g = o.kit ? geo.clone() : geo;
      g.applyMatrix4(m);
      let pile = piles.get(mat.uuid);
      if (!pile) {
        pile = { mat, parts: [], cast: false, receive: false, order: 0, userData: null };
        piles.set(mat.uuid, pile);
      }
      pile.parts.push(g);
      if (o.cast) pile.cast = true;
      if (o.receive) pile.receive = true;
      if (o.order !== undefined) pile.order = o.order;
      if (o.userData) pile.userData = Object.assign(pile.userData || {}, o.userData);
    },
    flush() {
      for (const pile of piles.values()) {
        let geo = null;
        if (pile.parts.length > 1) geo = mergeGeometries(pile.parts);
        if (!geo) {
          /* a weld that could not happen (a geometry with an attribute the
             others have not got) leaves the pieces as they were rather than
             quietly deleting the room */
          for (const part of pile.parts) {
            const loose = new THREE.Mesh(part, pile.mat);
            loose.castShadow = pile.cast;
            loose.receiveShadow = pile.receive;
            loose.renderOrder = pile.order;
            parent.add(loose);
          }
          continue;
        }
        const welded = new THREE.Mesh(geo, pile.mat);
        welded.castShadow = pile.cast;
        welded.receiveShadow = pile.receive;
        welded.renderOrder = pile.order;
        if (pile.userData) Object.assign(welded.userData, pile.userData);
        parent.add(welded);
      }
      piles.clear();
    }
  };
}

/* A wall running along `run` ('x' or 'z') at the perpendicular coordinate
   `at`, spanning from→to, pierced by openings [{ c, w, y0, y1 }] where c is
   measured along the run. Returns nothing; the pieces go into the batch,
   which keeps the transform stack shallow and the draw calls at one. */
function addWall(B, mat, o) {
  const { run, at, from, to, h, t, openings = [], scale = 2.4 } = o;
  const along = (a, b) => {
    if (b - a < 0.01) return;
    const len = b - a, mid = (a + b) / 2;
    const geo = run === 'x' ? boxUV(len, h, t, scale) : boxUV(t, h, len, scale);
    B.put(geo, mat,
      run === 'x' ? mid : at, h / 2, run === 'x' ? at : mid,
      { cast: true, receive: true });
  };
  const sorted = openings.slice().sort((a, b) => a.c - b.c);
  let cursor = from;
  for (const op of sorted) {
    const lo = op.c - op.w / 2, hi = op.c + op.w / 2;
    along(cursor, lo);
    if (op.y0 > 0.01) {
      const geo = run === 'x' ? boxUV(op.w, op.y0, t, scale) : boxUV(t, op.y0, op.w, scale);
      B.put(geo, mat, run === 'x' ? op.c : at, op.y0 / 2, run === 'x' ? at : op.c,
        { cast: true, receive: true });
    }
    if (op.y1 < h - 0.01) {
      const gh = h - op.y1;
      const geo = run === 'x' ? boxUV(op.w, gh, t, scale) : boxUV(t, gh, op.w, scale);
      B.put(geo, mat, run === 'x' ? op.c : at, op.y1 + gh / 2, run === 'x' ? at : op.c,
        { cast: true, receive: true });
    }
    cursor = hi;
  }
  along(cursor, to);
}

/* frame + glazing sitting in an opening. Out of a window in a building you
   look at the reveal of the wall and then the garden; out of a viewport you
   look through a hull, so the reveal is lined with metal all the way from the
   room face to the outside of the skin, opens up as it goes (the bevel a
   pressure frame needs so the plate can carry the load), and stops at a
   collar. The opening in the hull is wider than the glazing by the frame's
   own width on every side, which is what the bevel is cut to. */
function addWindow(B, M, o) {
  const { run, at, c, w, y0, y1, t } = o;
  const glassMat = M.glass;
  /* the pressure frame is painted the same panel-shadow as the rest of the
     station's fittings. It is a metal at 0.6, and the environment map runs at
     a tenth strength, so the token reads as a light frame only where a lamp
     or the sun actually finds it — which is the way a painted frame behaves
     and the reason it does not need a darker colour to sit quietly. */
  const frame = M.solid(PALETTE.panelShadow, { roughness: 0.45, metalness: 0.6 });
  const fw = 0.06, fd = 0.10;
  const pane = new THREE.PlaneGeometry(w - fw * 2, y1 - y0 - fw * 2);
  B.put(pane, glassMat, run === 'x' ? c : at, (y0 + y1) / 2, run === 'x' ? at : c,
    { ry: run === 'x' ? 0 : Math.PI / 2, order: 5, userData: { window: true } });
  /* the pane must not write depth. it is drawn in the transparent pass, and a
     pane that writes depth at eight metres quietly deletes the entire night
     sky standing three hundred and eighty metres behind it. */
  const bars = [
    [w, fw, c, y0 + fw / 2], [w, fw, c, y1 - fw / 2],
    [fw, y1 - y0, c - w / 2 + fw / 2, (y0 + y1) / 2], [fw, y1 - y0, c + w / 2 - fw / 2, (y0 + y1) / 2],
    [fw * 0.7, y1 - y0, c, (y0 + y1) / 2]           // centre mullion
  ];
  for (const [bw, bh, bx, by] of bars) {
    const geo = run === 'x' ? new THREE.BoxGeometry(bw, bh, fd) : new THREE.BoxGeometry(fd, bh, bw);
    B.put(geo, frame, run === 'x' ? bx : at, by, run === 'x' ? at : bx, { cast: false });
  }

  /* the reveal, through both leaves. zIn is the room face of the wall, zOut
     the outside of the pressure hull; the four plates run between them and
     splay outwards by exactly the frame's width. The plan only ever glazes
     the wall opposite the door, so this is built in the room's own frame with
     the depth running along +z. */
  const bev = S.VIEW_FLANGE;
  const zIn = at - t / 2, zOut = at + S.HULL_OUT;
  const dz = zOut - zIn, ang = Math.atan2(bev, dz), L = Math.hypot(dz, bev);
  const zc = (zIn + zOut) / 2, plate = 0.04;
  for (const sy of [1, -1]) {
    B.put(new THREE.BoxGeometry(w, plate, L), frame, c,
      (sy > 0 ? y1 : y0) + sy * bev / 2, zc, { rx: -sy * ang, cast: false });
  }
  for (const sx of [1, -1]) {
    B.put(new THREE.BoxGeometry(plate, y1 - y0 + bev * 2, L), frame,
      c + sx * (w / 2 + bev / 2), (y0 + y1) / 2, zc, { ry: sx * ang, cast: false });
  }
  /* the pressure frame itself: a collar on the room face, standing proud of
     the plaster so the opening reads as fitted into the wall rather than cut
     out of it */
  const fl = 0.14, pr = 0.09, zf = zIn - pr / 2 + 0.02;
  for (const sy of [1, -1]) {
    B.put(new THREE.BoxGeometry(w + fl * 2, fl, pr), frame, c,
      (sy > 0 ? y1 : y0) + sy * fl / 2, zf, { cast: false });
  }
  for (const sx of [1, -1]) {
    B.put(new THREE.BoxGeometry(fl, y1 - y0, pr), frame, c + sx * (w / 2 + fl / 2),
      (y0 + y1) / 2, zf, { cast: false });
  }
  /* the sill, now part of the frame: a stone sill lip on a hull is the one
     detail that would put the building back on the ground */
  const sillGeo = run === 'x'
    ? new THREE.BoxGeometry(w + 0.16, 0.05, t + 0.14)
    : new THREE.BoxGeometry(t + 0.14, 0.05, w + 0.16);
  B.put(sillGeo, frame, run === 'x' ? c : at, y0 - 0.02, run === 'x' ? at : c,
    { cast: false, receive: true });
}

/* every lamp in the building shares two materials: a panel-shadow metal shade
   and a warm emissive disc. The shade is the palette's panel-shadow and still
   reads as a dark fitting, which is not a contradiction: it is metal, and the
   environment map it has to reflect is held at a tenth strength, so a token
   that would be white in daylight is a fitting in this building.
   The disc is the one thing that has to clear the bloom threshold, because a
   lamp you cannot see the face of makes a ceiling read as unlit. The
   threshold is 0.70 now, not the 1.30 it was, so the intensity that used to
   be needed to cross it would blow the disc out: the disc is set just over
   the line instead. */
function lampMats(M) {
  return {
    shade: M.solid(PALETTE.panelShadow, { roughness: 0.45, metalness: 0.7 }),
    glow: new THREE.MeshStandardMaterial({
      color: 0x14161a, emissive: 0xffe3b8, emissiveIntensity: 0.95, roughness: 0.5, metalness: 0
    })
  };
}

/* Downstairs the lamps are a different fitting: a cold tube in a steel shade,
   because there is no window to blend with and no colour in the room to warm
   up. Where the plan says the tube is failing (`room.flicker`) the room gets
   its own material so it can fail on its own; the warm set stays shared by
   the whole ground floor, so nothing upstairs recompiles. */
function lampsFor(M, warm, o) {
  if (o.floor !== 'basement') return warm;
  if (!o._lamps) {
    /* the tube keeps its cool phosphor rather than taking the palette's cyan:
       the cyan is the station's own signalling, and a cellar that has gone
       cyan is a cellar whose room colour — which a later step replaces — has
       been painted over twice. the intensity is the same retune as the warm
       set: over the 0.70 threshold, not over the 1.30 that is gone. */
    const glow = new THREE.MeshStandardMaterial({
      color: 0x0f1216, emissive: 0xa9c8e8, emissiveIntensity: 0.95, roughness: 0.35, metalness: 0
    });
    if (o.flicker) {
      /* a failing starter, not a strobe: the tube sits dark, flashes once or
         twice, and either catches or gives up. tube.js owns that shape and the
         light pool calls the same function with the same clock, so the glow and
         the candela fail together instead of arguing. */
      const base = glow.emissiveIntensity, k = o.flicker;
      const phase = tubePhase(o.id);
      glow.onBeforeRender = () => {
        const env = tubeEnvelope(performance.now() * 0.001, phase, k);
        glow.emissiveIntensity = base * env;
        glow.userData.env = env;   // so a probe can read the same number back
      };
    }
    o._lamps = { shade: M.solid(PALETTE.panelShadow, { roughness: 0.4, metalness: 0.75 }), glow };
  }
  return o._lamps;
}

/* a pendant: stem from the ceiling, a shallow shade, a glowing face under it */
function addPendant(B, L, x, y, z, ceil, r) {
  B.put(new THREE.CylinderGeometry(0.014, 0.014, ceil - y, 6), L.shade, x, (y + ceil) / 2, z, { cast: false });
  B.put(new THREE.CylinderGeometry(r, r * 0.62, 0.07, 20), L.shade, x, y, z, { cast: false });
  B.put(new THREE.CircleGeometry(r * 0.66, 20), L.glow, x, y - 0.038, z, { cast: false, rx: Math.PI / 2 });
}

/* a downlight recessed into a ceiling: a ring and a glowing disc */
function addDownlight(B, L, x, y, z, r) {
  B.put(new THREE.TorusGeometry(r * 1.15, 0.022, 6, 20), L.shade, x, y - 0.012, z,
    { cast: false, rx: Math.PI / 2 });
  B.put(new THREE.CircleGeometry(r, 16), L.glow, x, y - 0.02, z, { cast: false, rx: Math.PI / 2 });
}

/* a wall sconce: a small metal box with a glowing lip, for the rotunda piers */
function addSconce(B, L, x, y, z, a) {
  B.put(new THREE.BoxGeometry(0.16, 0.30, 0.09), L.shade, x, y, z, { cast: false, ry: a });
  B.put(new THREE.BoxGeometry(0.13, 0.03, 0.07), L.glow, x, y + 0.17, z, { cast: false, ry: a });
}

/* each room type gets a different ceiling, so twelve rooms do not read as one.
   Everything hangs below the ceiling plane, so the light anchors stay valid. */
function addCeiling(B, L, M, room) {
  const w = room.w, d = room.d, h = room.ceil, zc = d / 2;
  const key = room.ceilKey;

  if (key === 'beam') {
    const beamMat = M.solid(0x3e3126, { roughness: 0.78, metalness: 0.02 });
    for (let i = 1; i <= 4; i++) {
      B.put(new THREE.BoxGeometry(w - 0.3, 0.26, 0.22), beamMat, 0, h - 0.13, (i / 5) * d, { cast: false });
    }
  } else if (key === 'coffer') {
    const rib = M.solid(PALETTE.panelShadow, { roughness: 0.72 });
    for (let i = 1; i <= 2; i++) {
      B.put(new THREE.BoxGeometry(w - 0.4, 0.16, 0.14), rib, 0, h - 0.08, (i / 3) * d, { cast: false });
      B.put(new THREE.BoxGeometry(0.14, 0.16, d - 0.4), rib, (i - 1.5) * (w / 3), h - 0.08, zc, { cast: false });
    }
  } else if (key === 'tray') {
    /* the recess stays the darkest thing in the ceiling and the bevel around
       it takes panel-shadow: a tray ceiling reads because of that step, and
       painting the recess the same token as the bevel is a flat ceiling with
       a lip on it. */
    const panel = M.solid(0x191b20, { roughness: 0.9 });
    const iw = w - 2.4, id = d - 2.4;
    B.put(planeUV(iw, id, 2.6), panel, 0, h - 0.32, zc, { cast: false, rx: Math.PI / 2 });
    const edge = M.solid(PALETTE.panelShadow, { roughness: 0.85 });
    const rim = [
      [iw, 0.06, 0, zc - id / 2], [iw, 0.06, 0, zc + id / 2],
      [0.06, id, -iw / 2, zc], [0.06, id, iw / 2, zc]
    ];
    for (const [bw, bd, bx, bz] of rim) {
      B.put(new THREE.BoxGeometry(bw, 0.32, bd), edge, bx, h - 0.16, bz, { cast: false });
      B.put(new THREE.BoxGeometry(bw * 0.94, 0.04, bd * 0.94), L.glow, bx, h - 0.31, bz, { cast: false });
    }
  } else if (key === 'gallery') {
    for (const sx of [-1, 1]) {
      for (let i = 1; i <= 3; i++) addDownlight(B, L, sx * (w / 4), h - 0.01, (i / 4) * d, 0.08);
    }
  } else if (key === 'clerestory') {
    for (const sx of [-1, 1]) {
      B.put(new THREE.BoxGeometry(0.05, 0.11, d - 1.4), L.glow, sx * (w / 2 - 0.16), h - 0.46, zc, { cast: false });
    }
  }
}

/* ── the plinth kit ──────────────────────────────────────────────────────
   The plinth is the one thing repeated 198 times, and every one of them is
   the same three boxes at the same size — so it is the one thing that can be
   an InstancedMesh outright. One welded geometry, one instance per exhibit,
   one draw call for the room's whole row of pedestals.

   The wall label and the colour puck stay per-room and get welded rather
   than instanced: each room's labels are one plaque sheet and each room's
   pucks are one material, which is what lets an ambient event light a whole
   room at once. */
function plinthKit(M) {
  const h = S.PLINTH_H, w = S.PLINTH_W;
  return {
    body: mergeGeometries([
      boxUV(w, h, w, 1.2).translate(0, h / 2, 0),
      boxUV(w + 0.08, 0.05, w + 0.08, 1.2).translate(0, h + 0.025, 0),
      boxUV(w + 0.12, 0.07, w + 0.12, 1.2).translate(0, 0.035, 0)
    ]),
    /* the pointer's target: a box the size of the plinth with a material the
       renderer is told not to draw. aiming at an exhibit and pressing enter
       still works, and the weld did not take the thing you aim at away. */
    pick: new THREE.BoxGeometry(w, h + 0.12, w),
    pickMat: new THREE.MeshBasicMaterial({ color: 0x000000, visible: false }),
    puck: new THREE.CylinderGeometry(0.09, 0.09, 0.012, 24),
    bodyMat: M.solid(0x6f6b62, { roughness: 0.55, metalness: 0.02 })
  };
}

/* the colour puck: this is how you know which room you are in from a glance.
   one material per room, so an ambient event can light a whole room at once.
   it is an inlay, not a lamp — the room colour mixed back toward stone, and
   just enough emissive to find in the dark. at full saturation these read as
   neon plates and the room stops looking like a building. */
function puckMat(room) {
  if (!room._puckMat) {
    const c = room.color, k = 0.5, g = 82;
    const mix = (v) => Math.round(v * k + g * (1 - k));
    const inlay = (mix(c >> 16 & 255) << 16) | (mix(c >> 8 & 255) << 8) | mix(c & 255);
    room._puckMat = new THREE.MeshStandardMaterial({
      color: inlay,
      emissive: inlay,
      emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.1
    });
  }
  return room._puckMat;
}

/* One space's row of plinths: the stone instanced, the labels and the pucks
   welded into the room's batch, and an invisible box each for the pointer. */
function addPlinths(g, B, kit, room, pickables, spots, linkAt) {
  if (!spots.length) return;
  const inst = new THREE.InstancedMesh(kit.body, kit.bodyMat, spots.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4(), e = new THREE.Euler(),
    p = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const puck = puckMat(room);
  const labelD = S.PLINTH_W / 2 + 0.008;
  spots.forEach((spot, i) => {
    e.set(0, spot.face, 0);
    q.setFromEuler(e);
    p.set(spot.u, 0, spot.v);
    inst.setMatrixAt(i, m.compose(p, q, one));

    /* the wall label, on the face that looks back at the door. one plaque
       sheet per room — per sixteen labels, rather — so the words cost a
       texture each, not one per plinth */
    const cell = room._cells && room._cells[i];
    if (cell && room._labelMats) {
      B.put(uvRect(new THREE.PlaneGeometry(0.44, 0.22), cell), room._labelMats[cell.sheet],
        Math.sin(spot.face) * labelD, 0.66, Math.cos(spot.face) * labelD, { ry: spot.face });
    }
    B.put(kit.puck, puck, spot.u, S.PLINTH_H + 0.055, spot.v, { kit: true, cast: false });

    const node = new THREE.Mesh(kit.pick, kit.pickMat);
    node.position.set(spot.u, S.PLINTH_H / 2, spot.v);
    node.rotation.y = spot.face;
    node.userData.exhibit = linkAt(room, i, spot);
    spot.node = node;
    pickables.push(node);
    g.add(node);
  });
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);
}

/* ── the four rooms that are about the museum itself ─────────────────────
   The Box Office, the Acquisitions Hall, the Rules Room and the Trophy Hall
   are four identical cabinets off the rotunda and the only rooms in the
   building with no plinths in them. Left empty they read as unfinished
   rooms; furnished they are the argument for the other forty-seven, which is
   why they get fittings the plinth kit cannot give them.

   The words on their walls are the words on the ticket — painted by
   signage.js out of identity.js — so the boards cannot drift from what the
   visitor agreed to at the door. Everything else here is the same batcher
   and the same materials as the walls: the four rooms cost about sixty
   boxes, which weld into the piles the room already has, and four textures
   between them. */
const PURPOSE = new Set(['Box Office', 'Acquisitions Hall', 'Rules Room', 'Trophy Hall']);

function addPurposeFittings(B, M, room) {
  const t = S.WALL_T, w = room.w;
  const cat = room.cat;
  const trim = M.solid(PALETTE.panelShadow, { roughness: 0.42, metalness: 0.7 });
  const dark = M.solid(0x24272c, { roughness: 0.6, metalness: 0.2 });
  /* the palette's rust, on the one surface a visitor wears: a bench seat */
  const seat = M.solid(PALETTE.rust, { roughness: 0.78 });
  const paper = M.solid(PALETTE.panel, { roughness: 0.85 });
  const board = (tex) => new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55,
    roughness: 0.85, side: THREE.DoubleSide
  });
  /* a board hung flat against a wall with no frame is a decal. the frame is
     four pieces of the same fitting metal the rails are, and it is what makes
     the thing read as hung rather than printed on the plaster. */
  const hang = (tex, cw, ch, x, y, z, ry) => {
    B.put(new THREE.PlaneGeometry(cw, ch), board(tex), x, y, z, { ry });
    const f = 0.05;
    /* which way the board is turned decides which axis its width runs along:
       one on the far wall spans x, one on a side wall spans z. the frame is
       two uprights and a head and a sill, and that is all it is. */
    const alongZ = (ry === Math.PI / 2 || ry === -Math.PI / 2);
    for (const s of [-1, 1]) {
      if (alongZ) {
        B.put(boxUV(f, ch + 2 * f, f, 1), trim, x, y, z + s * (cw / 2 + f / 2), { ry });
        B.put(boxUV(f, f, cw + 2 * f, 1), trim, x, y + s * (ch / 2 + f / 2), z, { ry });
      } else {
        B.put(boxUV(f, ch + 2 * f, f, 1), trim, x + s * (cw / 2 + f / 2), y, z, { ry });
        B.put(boxUV(cw + 2 * f, f, f, 1), trim, x, y + s * (ch / 2 + f / 2), z, { ry });
      }
    }
  };
  const bench = (x, z, ry) => {
    B.put(boxUV(1.50, 0.09, 0.44, 1.2), seat, x, 0.45, z, { ry, cast: true, receive: true });
    for (const sx of [-1, 1]) {
      B.put(boxUV(0.09, 0.45, 0.40, 1.2), dark,
        x + sx * 0.62 * Math.cos(ry), 0.225, z - sx * 0.62 * Math.sin(ry), { ry, cast: true });
    }
  };

  if (cat === 'Trophy Hall') {
    /* three stands and nothing on any of them. The mounting plate is the only
       thing on the cap: an empty plinth with a trophy cast bronze into it is a
       lie, and the whole room is here to say not yet. */
    for (const x of [-1.85, 0, 1.85]) {
      const z = 3.4;
      B.put(boxUV(0.62, 0.12, 0.62, 1.2), dark, x, 0.06, z, { cast: true, receive: true });
      B.put(boxUV(0.44, 0.95, 0.44, 1.2), paper, x, 0.595, z, { cast: true, receive: true });
      B.put(boxUV(0.54, 0.07, 0.54, 1.2), trim, x, 1.105, z, { cast: true });
      B.put(uvScale(new THREE.CylinderGeometry(0.13, 0.13, 0.014, 20), 0.4, 0.4), trim, x, 1.147, z);
      /* the small plate that will one day carry a name, blank for now */
      B.put(new THREE.PlaneGeometry(0.30, 0.10), paper, x, 0.82, z - 0.226, { ry: Math.PI });
    }
    /* the plaque goes on a side wall, not the far one. The far wall of every
       room in this building is the window wall, and a board hung there sits
       behind the window frame's inner lip, which then cuts a grey cross
       through the words. */
    hang(trophyPlaqueTexture(room, THREE, 8), 2.00, 1.00, -w / 2 + t / 2 + 0.04, 1.95, 3.4, Math.PI / 2);
    bench(-1.35, 1.9, Math.PI / 2);
    return;
  }

  if (cat === 'Rules Room') {
    /* the ticket, the size of a door, on the wall you turn to once you are in */
    hang(rulesBoardTexture(THREE, 8), 2.10, 2.10, -w / 2 + t / 2 + 0.04, 1.90, 3.1, Math.PI / 2);
    bench(-1.30, 3.1, Math.PI / 2);
    return;
  }

  if (cat === 'Box Office') {
    /* the counter faces the door you came in by, because this is the room
       where the museum hands you the thing you already agreed to */
    const cx = 0.2, cz = 2.35;
    B.put(boxUV(2.30, 0.10, 0.70, 1.2), dark, cx, 0.05, cz, { receive: true });
    B.put(boxUV(2.30, 0.95, 0.66, 1.2), dark, cx, 0.525, cz, { cast: true, receive: true });
    B.put(boxUV(2.50, 0.06, 0.80, 1.2), trim, cx, 1.03, cz, { cast: true });
    /* the front of the counter is the one face a visitor reads, so it is the
       same paper white as the ticket and the brochure rather than the machine
       grey of the carcass: the brand's one piece of furniture */
    B.put(new THREE.PlaneGeometry(2.30, 0.95), paper,
      cx, 0.525, cz - 0.335, { ry: Math.PI });
    /* the sign is on the face of the counter that looks at the door, not on
       the wall behind the visitor: this is the first thing in the room that
       speaks to you, and it should speak from where the counter is */
    hang(counterSignTexture(THREE, 8), 1.05, 0.26, cx, 0.70, cz - 0.345, Math.PI);
    /* ticket blanks, squared up badly, the way a stack goes after a day */
    for (let i = 0; i < 6; i++) {
      B.put(boxUV(0.22, 0.008, 0.14, 1.2), paper,
        cx - 0.72 + (i % 2) * 0.012, 1.066 + i * 0.009, cz - 0.16 + (i % 3) * 0.011,
        { ry: -0.05 + i * 0.035 });
    }
    /* the stool behind it, pushed in */
    B.put(uvScale(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 20), 0.5, 0.5), seat, cx + 1.05, 0.62, cz + 0.75, { cast: true });
    B.put(uvScale(new THREE.CylinderGeometry(0.04, 0.05, 0.62, 12), 0.3, 0.6), trim, cx + 1.05, 0.31, cz + 0.75, { cast: true });
    return;
  }

  if (cat === 'Acquisitions Hall') {
    /* four frames, nothing in them but the card. One texture serves all four:
       the emptiness is the same emptiness in every corner of this museum.
       Both side walls, because the far wall is the window wall. */
    const card = wantedCardTexture(room.zoneName ? room.zoneName.toLowerCase() : 'museum', THREE, 8);
    const cw = 0.62, ch = 0.775;
    const at = [
      [-w / 2 + t / 2 + 0.04, 2.2, Math.PI / 2], [-w / 2 + t / 2 + 0.04, 4.2, Math.PI / 2],
      [w / 2 - t / 2 - 0.04, 2.2, -Math.PI / 2], [w / 2 - t / 2 - 0.04, 4.2, -Math.PI / 2]
    ];
    for (const [ax, az, ry] of at) hang(card, cw, ch, ax, 1.72, az, ry);
    /* the crates and the ladder: this is the room where things arrive, and a
       museum that has twenty walls still empty has not put its tools away */
    B.put(boxUV(0.80, 0.50, 0.60, 1.2), dark, -2.25, 0.25, 1.05, { cast: true, receive: true });
    B.put(boxUV(0.70, 0.44, 0.55, 1.2), dark, -2.20, 0.72, 1.02, { ry: 0.22, cast: true });
    /* the ladder leans on the far wall: a positive rx takes the top of a
       vertical box towards +z, which is the wall, and the rungs have to be
       set on the same tilted line the rails stand on or the whole thing is a
       parallelogram */
    const lean = 0.13, lz = 5.55, ly = 1.28;
    for (const sx of [-0.24, 0.24]) {
      B.put(boxUV(0.06, 2.60, 0.06, 1.2), trim, 2.35 + sx, ly, lz, { rx: lean, cast: true });
    }
    for (let i = 0; i < 5; i++) {
      const rungY = 0.42 + i * 0.46;
      B.put(boxUV(0.54, 0.05, 0.06, 1.2), trim, 2.35, rungY, lz + (rungY - ly) * Math.tan(lean), { cast: true });
    }
    return;
  }
}

function buildRoom(parent, plan, M, room, pickables, L, kit) {
  const g = new THREE.Group();
  /* one offset for the whole room: the slab, the four walls, the ceiling, the
     plinths, the sign and the pendant all hang off this group, so a cellar
     room goes down a storey without a single mesh having to know about it */
  g.position.set(room.entry.x, yOf(room), room.entry.z);
  g.rotation.y = room.angle;
  parent.add(g);

  const lamps = lampsFor(M, L, room);
  const wallMat = M.mat(room.wall, 1, 1);
  /* room.floor is now which storey the room is on; room.floorMat is what the
     surface underfoot is made of. The fallback is for any room still carrying
     the old key. */
  const floorMat = M.mat(room.floorMat || room.floor, 1, 1);
  /* the ceiling is always a darker surface than the walls: a lamp hanging in
     a room will always find the ceiling closest, and a bright plaster slab
     overhead is the surest way to flatten the whole picture */
  const ceilMat = M.mat('plasterDark', 1, 1);
  const t = S.WALL_T, h = room.ceil;
  const B = batch(g);

  /* floor and ceiling */
  if (room.floorHole) {
    /* the Cupola's floor carries the well: the same circle the deck ring
       runs around, cut out of the room's own sheet — otherwise the gallery
       has a marble floor with a view painted on top of it. The sheet is
       drawn in x/y and turned over, so a hole at room-local z sits at
       shape y = -z, exactly as the rotunda disc does. */
    const shp = new THREE.Shape();
    shp.moveTo(-room.w / 2, 0);
    shp.lineTo(room.w / 2, 0);
    shp.lineTo(room.w / 2, -room.d);
    shp.lineTo(-room.w / 2, -room.d);
    shp.closePath();
    const hole = new THREE.Path();
    hole.absarc(room.floorHole.x, -room.floorHole.z, room.floorHole.r, 0, TAU, true);
    shp.holes.push(hole);
    B.put(uvScale(new THREE.ShapeGeometry(shp, 32), 1 / 2.2, 1 / 2.2), floorMat, 0, 0, 0,
      { rx: -Math.PI / 2, receive: true });
  } else {
    B.put(planeUV(room.w, room.d, 2.2), floorMat, 0, 0, room.d / 2,
      { rx: -Math.PI / 2, receive: true });
  }
  /* the ceiling has to cast: the sun is a directional light, and a roof that
     throws no shadow is a roof that lets the whole sky pour into the room.
     for a cellar room this one sheet is the slab the ground floor stands on,
     so it stays unbroken: the corridor ceiling out there is at the same height
     on the same storey, and the joint at the doorway lets no light through.
     the Cupola is the exception: its ceiling is the dome, and a flat sheet at
     rotunda height would close the oculus and wall off the planet. */
  if (!room.noCeil) {
    B.put(planeUV(room.w, room.d, 2.6), ceilMat, 0, h, room.d / 2,
      { rx: Math.PI / 2, cast: true, receive: true });
  }

  /* four walls: door wall at z=0, window wall at z=d, sides at x=±w/2 */
  addWall(B, wallMat, {
    run: 'x', at: 0, from: -room.w / 2, to: room.w / 2, h, t,
    openings: [{ c: 0, w: room.door.w, y0: 0, y1: room.door.h }], scale: 2.4
  });
  addWall(B, wallMat, {
    run: 'x', at: room.d, from: -room.w / 2, to: room.w / 2, h, t,
    openings: room.windows.map((win) => ({
      c: win.u, w: room.winW, y0: room.winSill, y1: room.winSill + room.winH
    })), scale: 2.4
  });
  addWall(B, wallMat, { run: 'z', at: -room.w / 2, from: -t, to: room.d + t, h, t, openings: [], scale: 2.4 });
  addWall(B, wallMat, { run: 'z', at: room.w / 2, from: -t, to: room.d + t, h, t, openings: [], scale: 2.4 });

  for (const win of room.windows) {
    addWindow(B, M, {
      run: 'x', at: room.d, c: win.u, w: room.winW,
      y0: room.winSill, y1: room.winSill + room.winH, t
    });
  }

  /* words on the walls: a plate over the door for the corridor, and one
     plaque sheet per sixteen plinth labels in here */
  if (room.items.length && !room._labelMats) {
    const atlas = plaqueSheets(room, LINKS, THREE, 4);
    room._cells = atlas.cells;
    room._labelMats = atlas.texs.map((tex) => new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex,
      emissiveIntensity: 0.40, roughness: 0.7, metalness: 0
    }));
  }
  const signY = room.door.h + 0.32;
  if (signY < room.ceil - 0.45) {
    if (!room._signMat) {
      const signTex = roomSign(Object.assign({ no: plan.rooms.indexOf(room) + 1 }, room), THREE, 4);
      signTex.userData.room = room.id;
      /* 0.72 rather than 0.5: a corridor lamp sits directly over every door
         plate on the ground floor, and at 0.5 the code line along the top of
         the plate was washed out by the bloom of a lamp it is not even
         lit by. The plate is a sign, not a surface — it should outshine the
         thing behind it. */
      room._signMat = new THREE.MeshStandardMaterial({
        map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.72,
        roughness: 0.8, side: THREE.DoubleSide
      });
    }
    B.put(new THREE.PlaneGeometry(1.44, 0.36), room._signMat,
      0, signY, -S.WALL_T / 2 - 0.02, { ry: Math.PI });
  }

  /* the four rooms about the museum itself, furnished with more than plinths
     can give them. before the ceiling, because the boards are hung from it */
  if (PURPOSE.has(room.cat)) addPurposeFittings(B, M, room);

  /* and the rooms that have furniture of their own — a workbench, a shelf, a
     counter, a rack of CRTs. `furnish` returns null for the rooms that have
     nothing written for them yet, which is most of them. */
  furnish(g, plan, room, M);

  addCeiling(B, lamps, M, room);
  /* the pendant the room's key light hangs from. The group origin is the door,
     local +Z runs into the room, so the room centre is (0, ?, d/2). A cellar
     ceiling is too low to hang anything from, so there the tube sits back
     against the slab the way a service room's does. */
  addPendant(B, lamps, 0, room.ceil - (room.ceil > S.CEIL_BASE ? 1.6 : 0.5),
    room.d / 2, room.ceil, room.kind === 'hall' ? 0.26 : 0.17);

  addPlinths(g, B, kit, room, pickables, room.plinths,
    (r, i, spot) => ({ room: r.id, link: r.items[i], spot }));
  B.flush();
  room.group = g;
  return g;
}

/* Where a corridor's shell begins. The plan puts a corridor's own start (`t0`)
   at the centre of whatever it grows out of, so the walls have to begin
   further out, at that hall's wall. The stair hall is already in the plan's
   walkable record — reading the edge there is what keeps the shell and the
   walkable union from disagreeing about where the four cellar doors are. */
function hallWall(plan, c) {
  const hall = plan.walkable.rects.find((r) => r.room === plan.stair.to);
  if (!hall) return c.t0;
  const st = Math.sin(hall.angle), ct = Math.cos(hall.angle);
  const lx = Math.abs(c.dir.x * ct - c.dir.z * st);   // the arm, in the hall's frame
  const lz = Math.abs(c.dir.x * st + c.dir.z * ct);
  return c.t0 + Math.min(lx > 1e-6 ? hall.halfX / lx : Infinity,
    lz > 1e-6 ? hall.halfZ / lz : Infinity);
}

/* the same line, as a rect: the range's own shell, from its first wall to its
   last. the cull reads this to know whether the visitor is standing in a
   range, and the walkable union deliberately starts further back than it. */
function shellRect(plan, c) {
  const a0 = c.floor === 'basement' ? hallWall(plan, c) : S.ROTUNDA_R - 0.4;
  const mid = (a0 + c.t1) / 2;
  return {
    cx: c.dir.x * mid, cz: c.dir.z * mid,
    halfX: c.half, halfZ: (c.t1 - a0) / 2,
    angle: Math.atan2(c.dir.x, c.dir.z)
  };
}

function buildCorridor(parent, M, corridor, L, plan, H) {
  const g = new THREE.Group();
  g.position.set(0, yOf(corridor), 0);
  g.rotation.y = Math.atan2(corridor.dir.x, corridor.dir.z);
  parent.add(g);

  const lamps = lampsFor(M, L, corridor);
  const t = S.WALL_T, h = corridor.ceil, half = corridor.half;
  /* a ground range starts inside the drum, under the arch; a cellar arm starts
     at the wall of the stair hall it opens off */
  const z0 = corridor.floor === 'basement' ? hallWall(plan, corridor) : S.ROTUNDA_R - 0.4;
  const z1 = corridor.t1;
  const B = batch(g);

  /* the cellar arms are swept concrete, not the terrazzo the processional
     ranges are laid in: these are service corridors, and the same floor runs
     on into the stair hall and the rooms off the arm */
  const floorMat = corridor.floor === 'basement' ? M.mat('concrete', 1, 1) : M.mat('terrazzo', 1, 1);
  B.put(planeUV(half * 2, z1 - z0, 2.2), floorMat, 0, 0, (z0 + z1) / 2,
    { rx: -Math.PI / 2, receive: true });
  /* the same sheet the cellar rooms' ceilings are cut from, at the same height,
     so the slab over your head runs the length of the arm without a joint */
  B.put(planeUV(half * 2, z1 - z0, 2.6), M.mat('plasterDark', 1, 1), 0, h, (z0 + z1) / 2,
    { rx: Math.PI / 2, cast: true, receive: true });

  /* The range's shell must not be laid through the mouth of a room. The plan
     puts every room's door wall exactly on the corridor's own side plane —
     dx comes out at ±half to the centimetre for all forty-seven — so a shell
     that runs the whole length lands on the same surface as the wall it is
     supposed to be behind. Two coplanar sheets welded from different batches
     then fight for the depth buffer, and the fight prints as a hairline along
     every triangle edge: scratch/dump-at.mjs fires a ray into the cellar
     plaster and gets two hits at the same distance, one plasterDark from the
     room and one plaster from the range. So the shell stops at the room's own
     wall, which already closes that span. */
  const mouths = (side) => plan.rooms.filter((r) => {
    if (r.floor !== corridor.floor) return false;
    const dz = r.entry.x * corridor.dir.x + r.entry.z * corridor.dir.z;
    const dx = r.entry.x * corridor.dir.z - r.entry.z * corridor.dir.x;
    return Math.abs(dx - side * half) < 0.2 && dz > z0 - 0.5 && dz < z1 + 0.5;
  }).map((r) => ({
    c: r.entry.x * corridor.dir.x + r.entry.z * corridor.dir.z,
    w: r.w, y0: 0, y1: h,
  }));

  const lined = (side, ops) => {
    /* the shell stops at the mouth, so the mouth still needs a face: a lining
       the same material as the shell, 2 mm proud of where the shell's own face
       would have been, standing on the corridor side of the room's wall. the
       room's wall is never seen from the range, the two sheets are never in the
       same plane, and the arm keeps the plaster it was lined in. */
    const x = side * (half - t / 2 - 0.012);
    ops.forEach((op) => B.put(boxUV(0.02, h, op.w, 2.4), M.mat('plaster', 1, 1),
      x, h / 2, op.c, { cast: true, receive: true }));
  };
  const left = mouths(-1), right = mouths(1);
  addWall(B, M.mat('plaster', 1, 1), { run: 'z', at: -half, from: z0, to: z1, h, t, openings: left, scale: 2.4 });
  addWall(B, M.mat('plaster', 1, 1), { run: 'z', at: half, from: z0, to: z1, h, t, openings: right, scale: 2.4 });
  lined(-1, left);
  lined(1, right);

  /* the same downlights the light pool follows, so the black ceiling reads as
     lit. the pool's anchors are still laid out for the ground ranges, so the
     cellar lamps keep their own spacing from the near end of the shell. */
  const first = corridor.floor === 'basement' ? z0 + 1.4 : S.ROTUNDA_R + 1.5;
  for (let p = first; p < corridor.t1; p += 3.6) addDownlight(B, lamps, 0, h - 0.01, p, 0.11);

  /* the range's own hull, welded into this same batch: the range is one mesh
     with or without it, and the cull that hides the range hides its skin too */
  if (corridor.floor !== 'basement') buildArmHull(B, H, plan, corridor);
  B.flush();
  corridor.group = g;
  return g;
}

function buildRotunda(parent, plan, M, pickables, L, kit, H) {
  const g = new THREE.Group();
  parent.add(g);
  const R = S.ROTUNDA_R, h = S.CEIL_ROTUNDA;
  const marble = M.mat('marble', 1, 1);
  const wallMat = M.mat('marbleDark', 1, 1);
  const well = wellOf(plan);
  const B = batch(g);

  /* the floor is a disc with the stair well cut out of it. ShapeGeometry
     hands back UVs in the shape's own metres, so the tiling is a plain
     divide rather than the scale-the-0-to-1-uv trick the circle needed.
     the shape is drawn in x/y and the mesh is turned over, so a hole at
     world z sits at shape y = -z. */
  const disc = new THREE.Shape();
  disc.absarc(0, 0, R, 0, TAU, false);
  const cut = new THREE.Path();
  cut.moveTo(well.x0, -well.z0);
  cut.lineTo(well.x1, -well.z0);
  cut.lineTo(well.x1, -well.z1);
  cut.lineTo(well.x0, -well.z1);
  cut.closePath();
  disc.holes.push(cut);
  /* the Cupola well: the glazed opening under the oculus. It shares this
     sheet with the stair well, and it sits north of the drum's centre on
     purpose — the two holes must not meet, or they are one hole with a
     thread of marble across it instead of two rooms' windows. */
  const cupWell = new THREE.Path();
  cupWell.absarc(0, -S.CUPOLA_WELL_Z, S.CUPOLA_WELL_R, 0, TAU, true);
  disc.holes.push(cupWell);
  B.put(uvScale(new THREE.ShapeGeometry(disc, 64), 1 / 2.4, 1 / 2.4), marble, 0, 0, 0,
    { rx: -Math.PI / 2, receive: true });

  /* the drum, pierced by one arch per range: twelve ranges at 30°, not the
     four the first building had, so every corridor meets a doorway instead of
     a wall. what is left between the arches is a pier of R*(step - 2*half)
     ≈ 1.6 m, which is where the pilasters below stand. */
  const half = Math.asin(S.CORRIDOR_W / 2 / R);
  /* the drum is a single sheet with no thickness, and at the twelve arch
     mouths you see its outer face and its edge from inside the hub, so the
     double side stays on the shared marble, as it always was */
  wallMat.side = THREE.DoubleSide;
  for (let i = 0; i < S.SPOKE_COUNT; i++) {
    const a = i * S.SPOKE_STEP;
    const start = a + half, span = S.SPOKE_STEP - half * 2;
    const seg = uvScale(new THREE.CylinderGeometry(R, R, h, 12, 1, true, start, span),
      (R * span) / 2.4, h / 2.4);
    B.put(seg, wallMat, 0, h / 2, 0, { cast: true, receive: true });

    /* the arch above each doorway */
    const lintelH = h - S.DOOR_BIG_H;
    const lintel = uvScale(new THREE.CylinderGeometry(R, R, lintelH, 4, 1, true, a - half, half * 2),
      (R * half * 2) / 2.4, lintelH / 2.4);
    B.put(lintel, wallMat, 0, S.DOOR_BIG_H + lintelH / 2, 0, { cast: true, receive: true });
  }

  /* pilasters on the piers between the arches, so the twelve doorways read as
     doorways. one per pier, at the bisector between two ranges — at the old
     eight the piers would have stood in the middle of the arches. */
  for (let i = 0; i < S.SPOKE_COUNT; i++) {
    const a = i * S.SPOKE_STEP + S.SPOKE_STEP / 2;
    B.put(boxUV(0.5, h, 0.5, 1.6), M.solid(0xa9a49a, { roughness: 0.5 }),
      Math.sin(a) * (R - 0.28), h / 2, Math.cos(a) * (R - 0.28), { cast: true, receive: true, ry: a });
    addSconce(B, L, Math.sin(a) * (R - 0.66), 2.6, Math.cos(a) * (R - 0.66), a);
  }

  /* one big pendant under the oculus, so the hall has a single bright object */
  addPendant(B, L, 0, S.CEIL_ROTUNDA - 0.8, 0, S.CEIL_ROTUNDA + S.DOME_RISE, 0.34);

  addPlinths(g, B, kit, plan.rotunda, pickables, plan.rotunda.plinths,
    (r, i, spot) => ({ room: 'rotunda', link: null, spot }));
  B.flush();

  /* dome with an oculus, sitting on the drum. the oculus is the one place in
     this building where the sky is not framed by a window: stand in the middle
     of the rotunda and the star map is directly overhead */
  const thetaHole = 0.30;
  const dome = new THREE.Mesh(
    uvScale(new THREE.SphereGeometry(R, 48, 24, 0, TAU, thetaHole, Math.PI / 2 - thetaHole),
      (TAU * R) / 2.6, (R * (Math.PI / 2 - thetaHole)) / 2.6),
    new THREE.MeshStandardMaterial({ map: M.textureFor('plaster'), side: THREE.DoubleSide, roughness: 0.92, color: 0xa9a49a })
  );
  dome.scale.y = S.DOME_RISE / R;
  dome.position.y = h;
  dome.castShadow = true;
  dome.receiveShadow = true;
  g.add(dome);

  /* ribs along the meridians: eight torus arcs, each one the curve the dome
     already follows, so the bowl reads as built rather than printed. they and
     the cornice are the same fitting metal, so they weld into one buffer. */
  const ribMat = M.solid(PALETTE.panelShadow, { roughness: 0.85 });
  for (let i = 0; i < 8; i++) {
    const arc = new THREE.TorusGeometry(R - 0.06, 0.11, 6, 22, Math.PI / 2 - thetaHole);
    arc.scale(S.DOME_RISE / R, 1, 1);
    B.put(arc, ribMat, 0, h, 0, { ry: (i / 8) * TAU + TAU / 16 });
  }
  /* a cornice ring where the dome meets the drum, the usual place for a moulding */
  B.put(new THREE.TorusGeometry(R - 0.10, 0.14, 8, 64), ribMat, 0, h + 0.06, 0, { rx: Math.PI / 2 });

  const oculusR = R * Math.sin(thetaHole);
  /* the ring the oculus is trimmed with was brass, which is what a museum puts
     round a hole in its roof. this building is a station with a museum inside
     it, and the fitting at the top of its drum is machined like every other
     one: panel-shadow, polished. */
  B.put(new THREE.TorusGeometry(oculusR, 0.16, 10, 64),
    M.solid(PALETTE.panelShadow, { roughness: 0.35, metalness: 0.8 }),
    0, h + R * Math.cos(thetaHole) * (S.DOME_RISE / R), 0, { rx: Math.PI / 2 });

  /* the meridians, the cornice and the oculus ring are laid on after the
     hub's first weld, so they need this second one: a pile that is never
     flushed is a piece of the building that does not exist */
  B.flush();

  /* the hub's own skin, and the cupola the oculus is now set in. One batch
     for both, so the drum, the bowl, the collar and the junction posts are
     one mesh on the hub the cull already switches */
  const HB = batch(g);
  buildDrumHull(HB, H, plan);
  buildCupola(HB, H, M, thetaHole);
  HB.flush();

  /* the gallery under the oculus — deck, rail, benches, plinth ring — hung
     on the hub, because the hub is the thing the cull switches and the
     gallery is part of the hub: you see the well exactly when you see the
     drum */
  buildCupolaGallery(g, plan, M, H, kit, pickables);

  /* the crates, the hand truck and the ladder: the hub is where the museum
     keeps the things it has taken in and not yet put on a wall */
  furnishRotunda(g, plan, M);

  plan.rotunda.group = g;
  return g;
}

/* ── the stair well ──────────────────────────────────────────────────────
   One rectangle in plan that has to be missing from three different sheets:
   the rotunda floor it descends through, the stair hall's ceiling below it,
   and the hull's keel, which runs under the whole drum and would otherwise
   be the first thing you saw down the well — a lid on the only way down. The
   plan says where it is — the stair record's x/z is the head of the flight
   and the flight runs `run` metres from there — so the well and the stair
   cannot drift apart. */
function wellOf(plan) {
  const s = plan.stair;
  return { x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z, z1: s.z + s.run };
}

/* the underside of the ground slab, which is also the cellar ceiling */
const SOFFIT = S.FLOOR_BASE + S.CEIL_BASE;

function buildStairHall(parent, plan, M, L) {
  const g = new THREE.Group();
  g.position.set(0, S.FLOOR_BASE, 0);
  parent.add(g);
  const t = S.WALL_T, h = S.CEIL_BASE;
  const hw = S.STAIR_HALL_W / 2, hd = S.STAIR_HALL_D / 2;
  const well = wellOf(plan);
  const wallMat = M.mat('plasterDark', 1, 1);
  const lamps = lampsFor(M, L, { floor: 'basement', id: 'stair-hall', flicker: 0.12 });
  const B = batch(g);

  /* laid concrete, and laid a centimetre low: the last tread of the flight
     lands flush on this sheet, and two up-facing sheets at the same height
     flicker wherever they overlap. The Cupola well pierces this sheet too:
     the well is a two-storey shaft, and the planet under the keel is meant
     to be read from the gallery above and from this hall below.

     It pierces it as a mouth 5.4 m across, not as the 1.45 m tube the
     rotunda floor carries, and that is not generosity: a straight tube puts
     this slab 5.25 m under a Cupola eye, and at 1.45 m the slab is then the
     whole of the view — a grey plate with a coin of planet in the middle of
     it, which is what the first Cupola drawings looked like. Opened out, the
     3.2 m of ceiling void between reads as a depth you are looking into, and
     the mouth is what frames the planet.

     The mouth used to be a whole circle and the stair was let into it: the
     lining left a sector out, the glazing spanned the lot, and the bottom
     landing stood inside the window, an island of pale concrete in the planet.
     That is what the Cupola photograph shows — not a bloom artefact: the slab
     sits well under the bloom threshold, it is simply the brightest thing in
     front of the planet, and muting it takes the parallelogram out of the disc
     while taking 0.4 of the frame's haze with it (measured 2026-11-13).

     So the mouth is cut by a flat now, and the wall, the glazing, the steel
     edge and the hole in this slab all stop at that one line. Of the four ways
     to settle the landing — darken it, sink it, narrow the glass over that
     sector, move the foot of the flight — narrowing the glass is the only one
     that asks nothing else of the building. The landing cannot sink: the cellar
     slab is the lowest floor there is. The foot of the flight cannot move: the
     stair well's place in the plan is what keeps the two holes in the rotunda
     floor from meeting, and the walkable union is not this file's to change.
     Darkening it alone trades a pale bar across the planet for a dark one. The
     flat stands at the bottom landing's north edge, so the whole flight and
     the whole landing are on this slab and the well's wall rises on the edge
     of the landing rather than through the middle of it: 0.80 m of floor in
     front of the last tread, which is what a landing is for. The tube's round
     holes overhang the flat by up to 0.57 m, and what they look down on is the
     stair's own dark steel and the wall behind it, not pale concrete. The
     mouth keeps 5.2 m of glass where the planet is, and the stair reads as a
     stair arriving at a wall. */
  const lr = S.CUPOLA_LIGHT_R;
  /* the flat, and the two numbers that fall out of standing 1.00 m south of
     the axis: the half-angle of the arc the wall still carries, and the
     length of the flat itself. */
  const cut = S.CUPOLA_LIGHT_CHORD;
  const arc = Math.acos(cut / (lr + 0.10));
  const flat = 2 * Math.sqrt((lr + 0.10) * (lr + 0.10) - cut * cut);
  const slab = new THREE.Shape();
  slab.moveTo(-hw, -hd);
  slab.lineTo(hw, -hd);
  slab.lineTo(hw, hd);
  slab.lineTo(-hw, hd);
  slab.closePath();
  const floorWell = new THREE.Path();
  /* the hole follows the outline the wall makes: the arc, closed by the flat.
     Shape space is world x and world -z, so the cap the flat removes is the
     one towards shape +y. */
  const wellCap = Math.asin(cut / (lr + 0.10));
  floorWell.absarc(0, -S.CUPOLA_WELL_Z, lr + 0.10, Math.PI - wellCap, TAU + wellCap, false);
  slab.holes.push(floorWell);
  B.put(uvScale(new THREE.ShapeGeometry(slab, 24), 1 / 2.2, 1 / 2.2), M.mat('concrete', 1, 1),
    0, -0.012, 0, { rx: -Math.PI / 2, receive: true });

  /* the lining: one cone, open at both ends, welded to nothing else because
     its material is its own. DoubleSide, since it is seen from inside the
     shaft and from the hall at the same time. It is a dark matte steel, and
     the two adjectives are doing different work: dark, because a polished
     cone off a shaft full of lamps is a bright plate again — the grey disc
     this was meant to stop being; matte, because a polished cone also throws
     the lamps' specular into the bloom and washes the photograph. Not black:
     the hall's lamp and the planet both light this surface, and a shaft whose
     walls take no light at all reads as a pasted hole rather than as three
     and a half metres of building you are looking through. What it leaves out is
     the sector the flat closes, and the flat is a wall, not an opening: the
     stair used to cross the circle this cone sweeps about 3.1 m down, so the
     wall had to stop short of south and let it through. The flat sits north of
     that crossing, so the wall can run the whole arc of the mouth and the
     south side of the shaft can be a plane you can stand against. */
  const shaft = M.solid(0x2b3037, { roughness: 0.75, metalness: 0.25, side: THREE.DoubleSide });
  B.put(new THREE.CylinderGeometry(S.CUPOLA_WELL_R + 0.10, lr + 0.10, h, 44, 1, true,
    Math.PI + arc, TAU - arc * 2), shaft, 0, h / 2, S.CUPOLA_WELL_Z, { cast: false });
  B.put(new THREE.PlaneGeometry(flat, h), shaft, 0, h / 2, S.CUPOLA_WELL_Z - cut, { cast: false });

  /* the pane over the mouth, and the sheen on it. From the gallery this is
     the floor the planet shows through; from here it is the floor under your
     feet with 300 m of nothing below, and the same near-invisible wall
     glazing cannot say both. The pane is the walking glazing, and the sheen
     is the faint reflection of the hall's own lamp in it. Both are cut to the
     mouth's own outline rather than to a disc: glass under the flat would be
     glass where the building has a floor, and the flight would be standing on
     nothing. Shape space here is the pane's own x and -z, so the cap the flat
     removes is the one towards shape +y. */
  const pane = (r) => {
    const s = new THREE.Shape();
    const b = Math.asin(cut / r);
    s.absarc(0, 0, r, Math.PI - b, TAU + b, false);
    return new THREE.ShapeGeometry(s, 40);
  };
  B.put(pane(lr - 0.02), M.floorGlass, 0, 0.05, S.CUPOLA_WELL_Z,
    { rx: -Math.PI / 2, order: 5, userData: { window: true } });
  B.put(pane(lr - 0.06), M.glazingSheen, 0, 0.07, S.CUPOLA_WELL_Z,
    { rx: -Math.PI / 2, order: 6 });

  /* the steel edge round the mouth: the arc the wall leaves, and a bar across
     the flat. The bar is the line where the glass ends and the hall's own
     floor begins, and the flight stops against it, so it is the fitting that
     says where the planet is underfoot. */
  const edge = M.solid(PALETTE.panelShadow, { roughness: 0.45, metalness: 0.6 });
  const collar = new THREE.TorusGeometry(lr + 0.09, 0.09, 8, 44, TAU - arc * 2);
  collar.rotateZ(arc - Math.PI / 2);
  B.put(collar, edge, 0, -0.01, S.CUPOLA_WELL_Z, { rx: Math.PI / 2, cast: false });
  B.put(boxUV(flat + 0.18, 0.18, 0.18, 2.4), edge, 0, -0.01, S.CUPOLA_WELL_Z - cut, { cast: false });

  /* the ceiling is the soffit of the rotunda floor, so it is at the same
     height as the cellar corridors' and runs away under the drum. three
     sheets rather than one pierced one because the well runs off the south
     edge of the hall: the flight comes in through that wall, so the notch
     reaches the boundary and is not a hole. The north sheet carries the
     Cupola well as a real hole, though — the well is cut through four
     sheets (the rotunda floor, this ceiling, this hall's own slab, and the
     keel under the drum), and earthlight that stops at any one of them
     never reaches the stair hall. */
  const north = new THREE.Shape();
  north.moveTo(-hw, well.z1);
  north.lineTo(hw, well.z1);
  north.lineTo(hw, hd);
  north.lineTo(-hw, hd);
  north.closePath();
  const cupWell = new THREE.Path();
  cupWell.absarc(0, S.CUPOLA_WELL_Z, S.CUPOLA_WELL_R + 0.10, 0, TAU, true);
  north.holes.push(cupWell);
  const sheets = [
    [well.x0 + hw, well.z1 + hd, (-hw + well.x0) / 2, (-hd + well.z1) / 2],
    [hw - well.x1, well.z1 + hd, (well.x1 + hw) / 2, (-hd + well.z1) / 2]
  ];
  B.put(uvScale(new THREE.ShapeGeometry(north, 24), 1 / 2.6, 1 / 2.6), wallMat, 0, h, 0,
    { rx: Math.PI / 2, cast: true, receive: true });
  for (const [w, d, cx, cz] of sheets) {
    B.put(planeUV(w, d, 2.6), wallMat, cx, h, cz, { rx: Math.PI / 2, cast: true, receive: true });
  }

  /* four walls, each pierced where a cellar arm starts. the arm shells begin
     at hallWall(), which reads the hall's own walkable rect, so putting the
     openings on those same four lines is what makes the doors land where the
     plan thinks they are. the south mouth is the stair's width, not the
     corridor's: the flight is wider than the arm it lands in. */
  const mouth = S.BASE_CORRIDOR_W;
  const stairMouth = Math.max(S.STAIR_W, mouth);
  addWall(B, wallMat, { run: 'x', at: hd, from: -hw, to: hw, h, t, openings: [{ c: 0, w: mouth, y0: 0, y1: h }], scale: 2.4 });
  addWall(B, wallMat, { run: 'x', at: -hd, from: -hw, to: hw, h, t, openings: [{ c: 0, w: stairMouth, y0: 0, y1: h }], scale: 2.4 });
  addWall(B, wallMat, { run: 'z', at: -hw, from: -hd - t, to: hd + t, h, t, openings: [{ c: 0, w: mouth, y0: 0, y1: h }], scale: 2.4 });
  addWall(B, wallMat, { run: 'z', at: hw, from: -hd - t, to: hd + t, h, t, openings: [{ c: 0, w: mouth, y0: 0, y1: h }], scale: 2.4 });

  /* the arm is 2.20 wide and the stair 3.00, so at the south mouth the arm's
     walls finish 0.40 short of the stair's. without these returns the hall
     looks into a slot that goes nowhere */
  const ret = S.STAIR_W / 2 - S.BASE_CORRIDOR_W / 2;
  if (ret > 0.01) {
    for (const sx of [-1, 1]) {
      B.put(boxUV(ret, h, t, 2.4), wallMat, sx * (S.BASE_CORRIDOR_W / 2 + ret / 2), h / 2, -hd,
        { cast: true, receive: true });
    }
  }

  /* one cold tube, east of the well so it lights the hall and the doors off
     it rather than shining down the stair — and clear of the light well's
     mouth, because a lamp hung inside a glazed floor is a lamp standing in
     front of the planet for anyone looking down. The mouth is 2.70 m across,
     so the tube stands 3.30 m out from the well's axis: the old spot, 2.10 m
     north of it, is now inside the window. It hangs low for the same reason:
     the lower it is, the steeper the light that reaches the mouth, and the
     more of it finds its way up the shaft to light the walls of the well that
     the rotunda is looking down into. it carries a light of its own:
     lighting.js lays its pool out from plan.rooms and plan.corridors, and the
     stair hall is neither — the plan only records it as a walkable rect — so
     nothing else in the building knows to light it. this is one static light
     added at boot, not a member of the pool, so the pool's count, and the
     shaders that depend on it, never change. */
  addPendant(B, lamps, 3.30, h - 1.20, S.CUPOLA_WELL_Z + 0.30, h, 0.2);
  B.flush();
  const lamp = new THREE.PointLight(0xa9c8e8, 30, 12, 2);
  lamp.position.set(3.30, h - 1.32, S.CUPOLA_WELL_Z + 0.30);
  g.add(lamp);
  /* the hall is the one cellar space with four doors, no window and a stair
     coming down into it, and it is where people stop. it gets the damp and
     the webs on its own terms — see atmosphere.js — and its cloud is gated on
     the hub's own visibility, because the hall's group never turns itself off */
  g.userData.anim = stairHall(g, hw, hd, parent);
  return g;
}

function buildStair(parent, plan, M, L) {
  const g = new THREE.Group();
  parent.add(g);
  const s = plan.stair;
  const steps = Math.round(S.STAIR_DROP / S.STAIR_RISER);   // twenty
  const rise = S.STAIR_DROP / steps;                        // 0.18
  const tread = s.run / steps;                              // 0.28, twice the rise plus the tread is 0.64
  const stone = M.mat('concrete', 1, 1);
  /* the flight and the bottom landing are steel rather than the hall's
     concrete. The mouth's flat now stops at the landing's north edge, so the
     stair is out of the window — but the tube's round hole is 1.45 to 1.57 m
     across and the flat stands only 1.00 m south of the axis, so a 0.57 m
     crescent of the well still looks straight down on the landing. Pale
     concrete there is the same pale plate, only smaller and tucked against the
     edge where it would read as part of the planet's disc. Steel also lets the
     stair and the wall it arrives against read as one fitting, which is what
     they look like from the hall below in any case. */
  const steel = M.solid(0x33383f, { roughness: 0.8, metalness: 0.25 });
  const well = wellOf(plan);
  const zBack = s.z - S.STAIR_LAND / 2;                     // back of the top landing
  const zHall = -S.STAIR_HALL_D / 2;                        // the hall wall the flight comes through
  const B = batch(g);

  /* twenty treads cut into one sloping slab. the underside stays straight,
     not stepped and not filled to the cellar floor, because the south cellar
     arm runs under the flight for its first two metres — the plan's union
     says that stretch is walkable, and a mass of masonry under the stair
     would be a wall the plan cannot see. 0.26 m of stone leaves 1.67 m of
     headroom where the arm passes under, which is why the arm is a service
     corridor and not a processional one.

     The slab used to sit with its top 2 cm below the nosing line, so the
     twenty tread boxes the loop lays next were 2 cm ribs in a smooth ramp:
     the HUD said twenty steps down, the audio played twenty footfalls, and
     the flight looked like a slide. The stone is thinner now and hung lower,
     which costs 4 cm of headroom under the arm and gives the steps 10 cm of
     riser you can actually see. */
  const slope = Math.atan(s.drop / s.run);
  const len = Math.hypot(s.run, s.drop);
  /* the well is 3.00 m wide and the flight now only needs 1.84 of it: the
     lift stands in the remaining 1.10 m, against the east wall, and the well's
     rectangle in the plan — the hole in the rotunda floor, the hole in the
     stair hall's ceiling, the walkable union — does not move by a centimetre.
     Everything below that used `s.w` and `s.x` is the flight, so it narrows
     and shifts west with it. */
  const fw = s.w - S.LIFT_W - S.LIFT_PARTITION;
  const fx = s.x - (S.LIFT_W + S.LIFT_PARTITION) / 2;
  B.put(boxUV(fw, 0.18, len, 1.6), steel, fx, -s.drop / 2 - 0.19, s.z + s.run / 2,
    { cast: true, receive: true, rx: slope });
  for (let i = 1; i <= steps; i++) {
    const top = -i * rise;
    B.put(boxUV(fw, 0.07, tread, 1.6), steel, fx, top - 0.035, s.z + (i - 0.5) * tread,
      { cast: true, receive: true });
  }

  /* the two landings, flagged so you can feel where the slope starts and
     ends: the top one is the rotunda floor and stays in the floor's own
     concrete, the bottom one is the well's sill and stays in the stair's
     steel. In both cases the flag sits a centimetre proud of the sheet under
     it instead of coplanar with it */
  B.put(boxUV(fw, 0.024, S.STAIR_LAND / 2, 2.2), stone, fx, 0,
    s.z - S.STAIR_LAND / 4, { cast: false, receive: true });
  B.put(boxUV(fw, 0.024, S.STAIR_LAND / 2, 2.2), steel, fx, S.FLOOR_BASE,
    s.z + s.run + S.STAIR_LAND / 4, { cast: false, receive: true });

  /* two side walls, the whole length of the well. above the ground floor they
     are the drum's own stone and stand as a parapet, so nobody walks into
     the hole from the side; below it they are the damp plaster the cellar is
     plastered in. */
  for (const sx of [-1, 1]) {
    const at = s.x + sx * (s.w / 2 + S.WALL_T / 2);
    B.put(boxUV(S.WALL_T, -S.FLOOR_BASE, zHall - zBack, 2.4), M.mat('plasterDark', 1, 1),
      at, S.FLOOR_BASE / 2, (zBack + zHall) / 2, { cast: true, receive: true });
    B.put(boxUV(S.WALL_T, 0.9, zHall - zBack, 2.4), M.mat('marbleDark', 1, 1),
      at, 0.45, (zBack + zHall) / 2, { cast: true, receive: true });
  }

  /* a handrail down one side, hung 0.90 above the nosing line. Polished, and
     so the one fitting in the cellar that takes `panel` rather than
     `panel-shadow`: in this palette the brighter token is the highlights, and
     a handrail is where a room puts them. It used to stand on the east side of
     the flight, which is where the lift shaft is now: the rail is on the west
     side, against the well's own wall, and the glass partition between the
     stair and the cabin carries the other. */
  const rail = M.solid(PALETTE.panel, { roughness: 0.35, metalness: 0.75 });
  const rx = fx - fw / 2 + 0.10;
  B.put(new THREE.CylinderGeometry(0.028, 0.028, len, 10), rail,
    rx, 0.9 - s.drop / 2, s.z + s.run / 2, { cast: true, rx: Math.atan2(s.run, -s.drop) });
  for (let k = 0; k <= 5; k++) {
    const z = s.z + (k / 5) * s.run;
    const y = -(z - s.z) / s.run * s.drop;
    B.put(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 8), rail, rx, y + 0.45, z, { cast: true });
  }

  /* the slab edge round the well: the 0.40 m between the top of the ground
     slab and the cellar soffit, lined on the two ends. the sides are already
     lined by the well walls above. */
  for (const z of [well.z0, well.z1]) {
    B.put(boxUV(well.x1 - well.x0, -SOFFIT, 0.2, 2.4), M.mat('marbleDark', 1, 1),
      (well.x0 + well.x1) / 2, SOFFIT / 2, z, { cast: false, receive: true });
  }
  B.flush();
  return g;
}

/* ── the lift ────────────────────────────────────────────────────────────
   The second way down, standing in the east 1.10 m of the stair well. The
   owner asked for the grand stair to stay *and* for a lift, and the well is
   the one place in the building where a shaft already exists: 3.00 m wide, of
   which the flight only needs 1.84. So the lift takes the remainder, and the
   plan does not change at all — the well's rectangle, the holes it leaves in
   the rotunda floor and in the stair hall's ceiling, and the walkable union
   are exactly what they were.

   It is a glass shaft on purpose. A lift in a dark hole in the middle of the
   drum would be a door you cannot find; behind glass you can see the cabin
   going down while you are still deciding, and from the cabin you can see the
   flight you did not take, which is the whole reason the two are side by side.

   The cabin is its own group rather than part of the welded hub, because it
   moves. It docks with its floor flush with whichever floor it is at: the
   rotunda's terrazzo above, the stair hall's concrete below, and the door at
   the north end, which is the end the well's opening faces on both storeys. */
function buildLift(parent, plan, M, L) {
  const s = plan.stair;
  const well = wellOf(plan);
  const partX = s.x + s.w / 2 - S.LIFT_W;            // the west face of the shaft
  const liftX = partX + S.LIFT_W / 2;                // the shaft's axis
  const z0 = well.z0, z1 = well.z1;
  const g = new THREE.Group();
  parent.add(g);
  const B = batch(g);
  const steel = M.solid(0x33383f, { roughness: 0.8, metalness: 0.25 });
  const bright = M.solid(PALETTE.panel, { roughness: 0.35, metalness: 0.75 });
  /* the cabin's walls: painted steel, the same token the handrail and the
     ticket are printed in, because a lift box is a fitting and not a wall */
  const panel = M.solid(PALETTE.panel, { roughness: 0.55, metalness: 0.15 });
  const pt = S.LIFT_PARTITION;

  /* the partition between the stair and the shaft, glazed for the whole
     height of the well, with the same 0.90 m parapet the well's own walls
     carry above the ground floor: the shaft is a hole in the floor, and the
     building puts a rail across its holes */
  B.put(boxUV(pt, -S.FLOOR_BASE, z1 - z0, 2.4), M.glass,
    partX + pt / 2, S.FLOOR_BASE / 2, (z0 + z1) / 2, { cast: false, receive: false });
  B.put(boxUV(pt, 0.9, z1 - z0, 2.4), M.mat('marbleDark', 1, 1),
    partX + pt / 2, 0.45, (z0 + z1) / 2, { cast: true, receive: true });
  /* the guide the cabin runs on, in the shaft's east corner, and the cill the
     shaft's two doors are hung from */
  B.put(new THREE.CylinderGeometry(0.05, 0.05, -S.FLOOR_BASE + 1.0, 8), steel,
    s.x + s.w / 2 - 0.14, S.FLOOR_BASE + (-S.FLOOR_BASE + 1.0) / 2, (z0 + z1) / 2, { cast: true });
  for (const z of [z0, z1]) {
    B.put(boxUV(S.LIFT_W, 0.04, 0.14, 1), bright, liftX, 0.004, z, { receive: true });
    B.put(boxUV(S.LIFT_W, 0.04, 0.14, 1), bright, liftX, S.FLOOR_BASE + 0.004, z, { receive: true });
  }
  /* the two landings. A lift in a hole in the floor needs a door standing on
     the floor, not a cabin standing in the hole: without the frame the shaft
     reads as a white booth on the terrazzo and the well is hidden behind it.
     The frame stands just outside the well's edge, so it never moves and the
     cabin never touches it, and the cabin's own opening lines up with it when
     the cabin arrives. */
  const zf = z0 - 0.07;
  for (const y of [0, S.FLOOR_BASE]) {
    for (const x of [partX + 0.06, s.x + s.w / 2 - 0.06]) {
      B.put(boxUV(0.09, 2.16, 0.10, 1), M.mat('marbleDark', 1, 1), x, y + 1.08, zf, { cast: true, receive: true });
    }
    B.put(boxUV(S.LIFT_W + 0.18, 0.12, 0.10, 1), M.mat('marbleDark', 1, 1),
      liftX, y + 2.20, zf, { cast: true, receive: false });
    B.put(boxUV(0.14, 0.20, 0.05, 1), bright, partX + 0.20, y + 1.20, zf - 0.06, { cast: false });
  }
  B.flush();

  /* the cabin. 1.00 m by 1.60 m inside, which is a lift for one person and a
     box of books, and not a lift for a stretcher — the stair keeps that job. */
  const cabin = new THREE.Group();
  g.add(cabin);
  const cb = batch(cabin);
  const inZ = S.LIFT_IN;
  const cz = z0 + inZ / 2;
  const w = S.LIFT_W - 0.14;
  const cx = partX + 0.07 + w / 2;
  const H = 2.10;
  const doorW = 0.92;
  cb.put(boxUV(w, 0.10, inZ, 1.6), steel, cx, -0.05, cz, { receive: true });
  cb.put(boxUV(w, 0.08, inZ, 1.6), panel, cx, H + 0.04, cz, { cast: false });
  cb.put(boxUV(0.05, H, inZ - 0.2, 1.6), M.glass, partX + 0.09, H / 2, cz, { cast: false });
  cb.put(boxUV(0.06, H, inZ, 1.6), steel, s.x + s.w / 2 - 0.11, H / 2, cz, {});
  cb.put(boxUV(w, H, 0.06, 1.6), steel, cx, H / 2, z0 + inZ - 0.03, {});
  /* the north face is the door: jambs each side and a header over a 0.92 m
     opening, so the cabin and the floor it docks with are one threshold. The
     outside of the box is the well's own dark steel and the inside is the
     palette's bright token: from the rotunda it reads as a machine in a shaft,
     and from inside it reads as a room. */
  const jamb = (w - doorW) / 2;
  for (const sx of [-1, 1]) {
    cb.put(boxUV(jamb, H, 0.05, 1), steel,
      cx + sx * (doorW / 2 + jamb / 2), H / 2, z0 + 0.025, {});
  }
  cb.put(boxUV(doorW, H - 1.95, 0.05, 1), panel,
    cx, 1.95 + (H - 1.95) / 2, z0 + 0.025, {});
  cb.put(boxUV(w - 0.36, 0.05, 0.14, 1), L.glow, cx, H - 0.02, cz, { cast: false });
  cb.put(boxUV(0.10, 0.16, 0.06, 1), bright, partX + 0.16, 1.15, z0 + 0.10, { cast: false });
  cb.flush();

  return { group: g, cabin, x: cx, z: cz, top: 0, bottom: S.FLOOR_BASE,
    ride: S.LIFT_RIDE, door: { x: cx, z: z0 } };
}

/* ── the pressure hull ───────────────────────────────────────────────────
   There is no courtyard and no ground any more: out here the outside of the
   outer wall is the outside of the station. So the wheel gets a second skin —
   plate over the drum and over every range, jointed into panels, stiffened
   where the ranges meet the drum, and pierced only where a viewport goes
   through. The plate is bolted flat onto the outside of the outer wall: a
   viewport still passes through both leaves, and the reveal between the room
   face and the outside of the skin is what tells you the wall is a hull and
   not a facade — but there is no cavity behind it, and none is needed: the
   tightest pair of rooms on two ranges stands 1.16 m clear of each other
   (scratch/hull-clearance.mjs measures it), and a skin standing off the wall
   on both sides of that gap does not fit.

   The skin follows the plan rather than wrapping it in a tube: at 30° the
   ranges interleave in the wedge between them, and a constant-width hull
   would meet its neighbour before the first room band. Each range is
   therefore a chain of bays — the corridor's own width between the room
   bands, the room's width over the room, the hall's width over the hall —
   with a step closed where one hands over to the next.

   None of it is a separate draw call: the skin, the stiffeners and the rim
   strips are welded into the range's own batch, so a range that the cull
   switches off takes its hull with it. */
function hullMats(M) {
  return {
    skin: M.mat('hull', 1, 1),
    /* the hard rim light: a strip of the station's own cyan laid along every
       top edge of the skin. Out here there is no ground to bounce the lamps
       back, so without it the hull is a black mass on a black sky and the
       only thing that reads is the lit patch through a viewport. It is
       emissive geometry rather than a light — a real lamp would recompile
       every shader in the building and move the sun's shadow. */
    /* The edge lighting is the palette's cyan, and it is two materials rather
       than one because the same line has two jobs. Seen from outside, at
       eighty metres, it is the station's silhouette. Seen from inside the
       Cupola, three metres from your eye, it is a bar of light across the
       photograph — and the bloom pass does not care which one you meant.
       The intensity is what the 0.70 threshold wants: cyan at 1.15 is already
       over the line, so the 2.4 that was needed to clear the old 1.30 is now
       four times too much, and the strips are half as proud to match. */
    rim: new THREE.MeshStandardMaterial({
      color: 0x0f1216, emissive: PALETTE.signalCyan, emissiveIntensity: 1.15,
      roughness: 0.4, metalness: 0.3
    }),
    /* the same edge where the room is the one looking at it: the well's lip,
       the oculus's own ring. Held under the threshold on purpose, so it keeps
       a lit edge you can follow without lending the gallery a haze. */
    rimTrim: new THREE.MeshStandardMaterial({
      color: 0x0f1216, emissive: PALETTE.signalCyan, emissiveIntensity: 0.60,
      roughness: 0.4, metalness: 0.3
    }),
    /* and the marker at the upper corners of an end cap. In this palette a
       warning is amber, and a marker whose only job is to say "the range
       stops here" is a warning rather than a seam. */
    rimWarn: new THREE.MeshStandardMaterial({
      color: 0x1a1206, emissive: PALETTE.terminalAmber, emissiveIntensity: 1.25,
      roughness: 0.5, metalness: 0.2
    })
  };
}

/* a run of hull plate, pierced by viewports. Same arithmetic as addWall —
   the holes are real holes, and the void has to be able to see you through
   them — but measured from y0 up rather than from the floor, and with the
   plate standing off the wall it covers. */
function hullRun(B, H, o) {
  const { run, at, from, to, y0, y1, openings = [] } = o;
  const t = S.HULL_T, h = y1 - y0, scale = 1.6;
  const along = (a, b) => {
    if (b - a < 0.01) return;
    const len = b - a, mid = (a + b) / 2;
    const geo = run === 'z' ? boxUV(t, h, len, scale) : boxUV(len, h, t, scale);
    B.put(geo, H.skin, run === 'z' ? at : mid, y0 + h / 2, run === 'z' ? mid : at,
      { cast: true, receive: true });
  };
  const sorted = openings.slice().sort((a, b) => a.c - b.c);
  let cursor = from;
  for (const op of sorted) {
    const lo = op.c - op.w / 2, hi = op.c + op.w / 2;
    along(cursor, lo);
    if (op.y0 > y0 + 0.01) {
      const gh = op.y0 - y0;
      const geo = run === 'z' ? boxUV(t, gh, op.w, scale) : boxUV(op.w, gh, t, scale);
      B.put(geo, H.skin, run === 'z' ? at : op.c, y0 + gh / 2, run === 'z' ? op.c : at,
        { cast: true, receive: true });
    }
    if (op.y1 < y1 - 0.01) {
      const gh = y1 - op.y1;
      const geo = run === 'z' ? boxUV(t, gh, op.w, scale) : boxUV(op.w, gh, t, scale);
      B.put(geo, H.skin, run === 'z' ? at : op.c, op.y1 + gh / 2, run === 'z' ? op.c : at,
        { cast: true, receive: true });
    }
    cursor = hi;
  }
  along(cursor, to);
}

/* a stiffener: a hoop standing proud of the skin at a bay junction. It is
   welded from four plates rather than instanced because it is the same
   material as the skin it stiffens, and a weld costs nothing — the whole
   range, hull and all, is still one mesh. */
function hullHoop(B, H, t, p, n, y0, y1) {
  const proud = 0.24, wide = 0.28;
  for (const sx of [1, -1]) {
    const at = (sx > 0 ? p : -n) + sx * proud / 2;
    B.put(boxUV(wide, y1 - y0 + proud * 2, proud, 1.2), H.skin,
      at, (y0 + y1) / 2, t, { cast: true, receive: true });
  }
  for (const sy of [1, -1]) {
    const y = (sy > 0 ? y1 : y0) + sy * proud / 2;
    B.put(boxUV(p + n + proud * 2, wide, proud, 1.2), H.skin,
      (p - n) / 2, y, t, { cast: true, receive: true });
  }
}

/* One range's hull, in the range's own frame: +z along the spoke, +x to the
   +side. The bays come out of the plan — every room on this range is a bay,
   and the stretches between them are the corridor's own width. */
function buildArmHull(B, H, plan, corridor) {
  const dir = corridor.dir;
  /* the plan's world frame, read into the arm's frame: the group is already
     turned to the spoke, so this is the only place the spoke's angle appears */
  const local = (p) => ({ x: dir.z * p.x - dir.x * p.z, z: dir.x * p.x + dir.z * p.z });
  const stand = S.WALL_T / 2 + S.HULL_T / 2;   // wall centreline → skin centre
  const belly = S.HULL_BELLY;
  const rooms = plan.rooms
    .filter((r) => r.floor !== 'basement' && r.range === corridor.range)
    .map((r) => {
      const cs = [
        local(r.entry),
        local({ x: r.entry.x + r.n.x * r.d, z: r.entry.z + r.n.z * r.d }),
        local({ x: r.entry.x + Math.cos(r.angle) * r.w / 2, z: r.entry.z - Math.sin(r.angle) * r.w / 2 }),
        local({ x: r.entry.x - Math.cos(r.angle) * r.w / 2, z: r.entry.z + Math.sin(r.angle) * r.w / 2 })
      ];
      const along = cs.map((p) => p.z), across = cs.map((p) => p.x);
      return {
        room: r,
        t0: Math.min(...along), t1: Math.max(...along),
        x0: Math.min(...across), x1: Math.max(...across),
        wins: r.windows.map((w) => {
          const c = local({ x: w.x, z: w.z });
          return { c, along: c.z, across: c.x, w: w.w, y0: w.sill - S.VIEW_FLANGE, y1: w.sill + w.h + S.VIEW_FLANGE };
        })
      };
    })
    .sort((a, b) => a.t0 - b.t0);

  const corrHalf = corridor.half + stand;
  const bays = [];
  let cursor = S.ROTUNDA_R + 0.2;
  for (const r of rooms) {
    if (r.t0 - cursor > 0.01) {
      bays.push({ t0: cursor, t1: r.t0, p: corrHalf, n: corrHalf, top: corridor.ceil + S.HULL_CLEAR, wins: [] });
    }
    const hall = r.room.side === 0;
    const p = hall ? r.x1 + stand : Math.max(r.x1 + stand, corrHalf);
    const n = hall ? -r.x0 + stand : Math.max(-r.x0, corrHalf);
    bays.push({
      t0: r.t0, t1: r.t1 + stand, p, n, top: r.room.ceil + S.HULL_CLEAR,
      wins: r.wins, side: r.room.side, end: hall
    });
    cursor = r.t1 + stand;
  }

  /* the first hoop: where the range leaves the drum. It stands against the
     pair of junction posts on the drum's own ring, which is what makes the
     twelve spokes read as carried rather than butted on */
  if (bays.length) hullHoop(B, H, bays[0].t0, bays[0].p, bays[0].n, belly, bays[0].top);

  for (let i = 0; i < bays.length; i++) {
    const b = bays[i];
    /* a side room's glazing goes through the skin on the side it leans to; a
       terminus hall's goes through the end cap, and putting it in the side
       skins as well would leave a hole at each corner of the hall */
    const hole = (w, c) => ({ c, w: w.w + S.VIEW_FLANGE * 2, y0: w.y0, y1: w.y1 });
    const onSide = (sign) => (b.side === 0 ? [] : b.wins)
      .filter((w) => sign * w.across > 0)
      .map((w) => hole(w, w.along));
    hullRun(B, H, { run: 'z', at: b.p, from: b.t0, to: b.t1, y0: belly, y1: b.top, openings: onSide(1) });
    hullRun(B, H, { run: 'z', at: -b.n, from: b.t0, to: b.t1, y0: belly, y1: b.top, openings: onSide(-1) });

    /* the roof and the keel. The keel is the floor of the station: with the
       courtyard gone it is the only thing between the cellar and empty space,
       and it is what makes the silhouette a hull rather than a section. */
    const w = b.p + b.n, cz = (b.t0 + b.t1) / 2;
    B.put(planeUV(w, b.t1 - b.t0, 1.6), H.skin, (b.p - b.n) / 2, b.top, cz,
      { rx: -Math.PI / 2, cast: true, receive: true });
    B.put(planeUV(w, b.t1 - b.t0, 1.6), H.skin, (b.p - b.n) / 2, belly, cz,
      { rx: Math.PI / 2, cast: true, receive: true });

    /* the rim light: a strip along every long edge of the skin, at the roof
       and at the keel. Out here nothing bounces the lamps back, and the sun
       that does light the hull is off for the half of the dial the museum
       runs on, so without an edge that makes its own light the station is a
       black mass on a black sky and the only part of it you can see is the
       lit patch through a viewport. */
    const rw = S.RIM_W, rp = S.RIM_T, out = S.HULL_T / 2 - 0.03;
    for (const sx of [1, -1]) {
      const at = (sx > 0 ? b.p : -b.n) + sx * out;
      for (const sy of [1, -1]) {
        B.put(new THREE.BoxGeometry(rw, rp, b.t1 - b.t0 - 0.02), H.rim,
          at, (sy > 0 ? b.top : belly) + sy * 0.05, cz, { cast: false });
      }
    }
    if (b.end) {
      for (const sy of [1, -1]) {
        B.put(new THREE.BoxGeometry(b.p + b.n - rw, rp, rw), H.rim,
          (b.p - b.n) / 2, (sy > 0 ? b.top : belly) + sy * 0.05, b.t1 + out, { cast: false });
      }
      /* and a marker at each upper corner of the end cap, the way the end of
         every module on a station carries one: at eighty metres out it is the
         only thing that says where the range stops */
      for (const sx of [1, -1]) {
        B.put(new THREE.BoxGeometry(S.RIM_MARK, S.RIM_MARK, S.RIM_W), H.rimWarn,
          (sx > 0 ? b.p : -b.n) - sx * 0.34, b.top - 0.42, b.t1 + out + 0.04, { cast: false });
      }
    }

    /* where the next bay is a different shape, close the step. The strip is
       the difference between the two sections, so nothing is left open. */
    const nx = bays[i + 1];
    if (!nx) {
      hullRun(B, H, {
        run: 'x', at: b.t1, from: -b.n, to: b.p, y0: belly, y1: b.top,
        openings: (b.end ? b.wins : []).map((w) => hole(w, w.across))
      });
      hullHoop(B, H, b.t1, b.p, b.n, belly, b.top);
      continue;
    }
    const hi = Math.max(b.top, nx.top);
    hullHoop(B, H, nx.t0, Math.max(b.p, nx.p), Math.max(b.n, nx.n), belly, hi);
    if (Math.abs(b.p - nx.p) > 0.01) {
      hullRun(B, H, { run: 'x', at: nx.t0, from: Math.min(b.p, nx.p), to: Math.max(b.p, nx.p), y0: belly, y1: hi });
    }
    if (Math.abs(b.n - nx.n) > 0.01) {
      hullRun(B, H, { run: 'x', at: nx.t0, from: -Math.max(b.n, nx.n), to: -Math.min(b.n, nx.n), y0: belly, y1: hi });
    }
    if (Math.abs(b.top - nx.top) > 0.01) {
      hullRun(B, H, {
        run: 'x', at: nx.t0, from: -Math.min(b.n, nx.n), to: Math.min(b.p, nx.p),
        y0: Math.min(b.top, nx.top), y1: hi
      });
    }
  }
}

/* The drum's skin, and the cupola over it. The ring is cut at the twelve
   arches — the skin has to stop where the range begins or the hub is sealed
   off from its own spokes — and the gap it leaves is exactly the corridor's
   hull, so the two skins meet without either one knowing about the other. */
function buildDrumHull(B, H, plan) {
  const R = S.HULL_DRUM, y0 = S.HULL_BELLY, y1 = S.CEIL_ROTUNDA + S.HULL_CLEAR;
  const mouth = S.CORRIDOR_W / 2 + S.WALL_T / 2;
  const half = Math.asin(mouth / R);
  for (let i = 0; i < S.SPOKE_COUNT; i++) {
    const a = i * S.SPOKE_STEP;
    const start = a + half, span = S.SPOKE_STEP - half * 2;
    const seg = uvScale(new THREE.CylinderGeometry(R, R, y1 - y0, 10, 1, true, start, span),
      (R * span) / 1.6, (y1 - y0) / 1.6);
    B.put(seg, H.skin, 0, (y0 + y1) / 2, 0, { cast: true, receive: true });

    /* the junction ribs: a post either side of every arch, and the hoop the
       range's own first stiffener butts against. Twelve ranges, twenty-four
       posts, one weld. */
    for (const s of [-1, 1]) {
      const b = a + s * (mouth + 0.17);
      B.put(boxUV(0.34, y1 - y0 + 0.7, 0.34, 1.2), H.skin,
        Math.sin(b) * (R + 0.17), (y0 + y1) / 2, Math.cos(b) * (R + 0.17),
        { cast: true, receive: true, ry: b });
    }
  }
  /* stringers round the drum, so the plate reads as framed rather than as a
     painted cylinder */
  for (const y of [y0 + 0.4, (y0 + y1) / 2, y1 - 0.4]) {
    const ring = uvScale(new THREE.TorusGeometry(R + 0.17, 0.13, 6, 72), (TAU * R) / 1.6, 0.4);
    B.put(ring, H.skin, 0, y, 0, { rx: Math.PI / 2, cast: true, receive: true });
  }
  /* the keel under the drum, with the stair well cut out of it for the same
     reason the well is cut out of the rotunda floor: a plate across the well
     is a lid on the only way down. It sits two centimetres under the ranges'
     keel so the two sheets do not fight where they overlap at the junction. */
  const disc = new THREE.Shape();
  disc.absarc(0, 0, R, 0, TAU, false);
  const well = wellOf(plan);
  const cut = new THREE.Path();
  cut.moveTo(well.x0, well.z0);
  cut.lineTo(well.x1, well.z0);
  cut.lineTo(well.x1, well.z1);
  cut.lineTo(well.x0, well.z1);
  cut.closePath();
  disc.holes.push(cut);
  /* and the Cupola well: the keel is the third sheet the well passes
     through, and a plate across it is a lid on the station's other window */
  const cupWell = new THREE.Path();
  cupWell.absarc(0, S.CUPOLA_WELL_Z, S.CUPOLA_WELL_R + 0.12, 0, TAU, true);
  disc.holes.push(cupWell);
  B.put(uvScale(new THREE.ShapeGeometry(disc, 48), 1 / 1.6, 1 / 1.6), H.skin,
    0, y0 - 0.02, 0, { rx: Math.PI / 2, cast: true, receive: true });
  /* the rim light round the hub: one ring at the top of the drum's skin and
     one at the keel, so the drum reads as a body with an edge rather than as
     a shadow against the stars. The keel ring is the silhouette material; the
     top one is the trim, because the top of the drum is the level the Cupola
     gallery stands at, and a ring that glows hard enough to read from outside
     is a ring the gallery is looking straight along. */
  for (const [y, mat] of [[y1 - 0.02, H.rimTrim], [y0 + 0.02, H.rim]]) {
    B.put(new THREE.TorusGeometry(R + 0.06, S.RIM_TUBE, 6, 72), mat, 0, y, 0, { rx: Math.PI / 2 });
  }
  return y1;
}

/* The Cupola. The dome keeps its geometry and its oculus keeps its size —
   what changes is that the hole in the roof becomes a window: a shell one
   skin clear of the dome, a collar where the two meet, a pressure ring at
   the opening and the same glazing the viewports use. */
function buildCupola(B, H, M, thetaHole) {
  const h = S.CEIL_ROTUNDA, R = S.HULL_CUPOLA, rise = S.DOME_RISE;
  const y1 = h + S.HULL_CLEAR;                       // where the drum's skin ends
  const base = Math.acos((y1 - h) / (rise * R / S.ROTUNDA_R));
  const holeR = S.ROTUNDA_R * Math.sin(thetaHole) + 0.30;
  const hole = Math.asin(holeR / R);
  const shell = uvScale(new THREE.SphereGeometry(R, 48, 20, 0, TAU, hole, base - hole),
    (TAU * R) / 1.6, (R * (base - hole)) / 1.6);
  /* the bowl is an ellipsoid, so the squash is baked into the vertices before
     the weld: the batch only composes position and rotation */
  shell.scale(1, rise / S.ROTUNDA_R, 1);
  B.put(shell, H.skin, 0, h, 0, { cast: true, receive: true });

  const yHole = h + (rise * R / S.ROTUNDA_R) * Math.cos(hole);
  /* the collar: the bevel of the top window, running from the dome's own
     oculus out to the shell's opening, so the hole reads as a framed opening
     through two leaves rather than as a hole in a roof */
  const domeR = S.ROTUNDA_R * Math.sin(thetaHole);
  const yDome = h + rise * Math.cos(thetaHole);
  const collar = new THREE.CylinderGeometry(holeR, domeR, yHole - yDome, 48, 1, true);
  B.put(uvScale(collar, (TAU * domeR) / 1.6, (yHole - yDome) / 1.6), H.skin,
    0, (yHole + yDome) / 2, 0, { cast: false, receive: true });

  /* the pressure ring, and the glazing. The pane is the same material the
     viewports use and keeps its depthWrite: false — a pane that writes depth
     here would be the last thing between the rotunda and the whole sky. */
  const frame = M.solid(PALETTE.panelShadow, { roughness: 0.45, metalness: 0.6 });
  B.put(new THREE.TorusGeometry(domeR + 0.09, 0.11, 8, 48), frame, 0, yDome + 0.05, 0,
    { rx: Math.PI / 2, cast: false });
  B.put(new THREE.TorusGeometry(holeR + 0.06, 0.09, 8, 48), frame, 0, yHole - 0.04, 0,
    { rx: Math.PI / 2, cast: false });
  B.put(new THREE.CircleGeometry(holeR - 0.02, 48), M.glass, 0, yHole - 0.10, 0,
    { rx: -Math.PI / 2, order: 5, userData: { window: true } });
  B.put(new THREE.TorusGeometry(holeR + 0.02, S.RIM_TUBE, 6, 48), H.rim, 0, yHole + 0.02, 0,
    { rx: Math.PI / 2 });
  /* and the same lit edge at the room's end of the collar: from the rotunda
     floor the Cupola has to read as an opening with a frame, not as a hole
     punched in a roof, and the only thing that says so at night is its edge.
     This one is the trim material, not the silhouette material: it hangs nine
     metres above the gallery floor and the room is looking straight at it, so
     an emissive sized to read at eighty metres would be the brightest thing
     in the hall and the hall would be a bloom with a dome in it. */
  B.put(new THREE.TorusGeometry(domeR + 0.16, S.RIM_TUBE_TRIM, 6, 48), H.rimTrim, 0, yDome + 0.16, 0,
    { rx: Math.PI / 2 });
}

/* ── the Cupola gallery ──────────────────────────────────────────────────
   The oculus has had a sky over it since the first drawing and nothing under
   it: you looked up and saw a hole. This is the floor under the hole — a
   ring of deck around a glazed well, a rail at the well's edge, benches
   facing down into it, and the Observatory's plinth ring.

   The well is the room's window and it is in the floor. The sky dial is the
   sky above the region the station is over, which puts that region's zenith
   at the building's +Y and the planet itself on the -Y axis; so the one
   opening in this building you look *down* through is the one that shows
   Earth, and the benches face it. The well is lined with a steel shaft,
   because it pierces the rotunda slab, the stair hall's ceiling and the
   keel — and a hole through a pressure hull wants a collar, not a cut edge.

   The deck is a ring with a sector missing, not a full annulus: the stair
   well is under its south side, and a deck floating over the way down is a
   floor the plan cannot see. In the ring's own parameter the world bearing
   θ runs as t + 90°, so an 82° gap centred on south is the slot over the
   flight. */
function buildCupolaGallery(g, plan, M, H, kit, pickables) {
  const room = plan.byId('cupola');
  if (!room) return;
  const wz = S.CUPOLA_WELL_Z, wr = S.CUPOLA_WELL_R;
  const B = batch(g);
  const deckMat = M.solid(PALETTE.panelShadow, { roughness: 0.62, metalness: 0.45 });
  const frame = M.solid(PALETTE.panelShadow, { roughness: 0.45, metalness: 0.6 });
  /* the rails take `panel` rather than `panel-shadow`: they are the one thing
     in this room that is polished rather than painted, and the token's own
     description is highlights. A handrail is where a room puts its specular. */
  const steel = M.solid(PALETTE.panel, { roughness: 0.35, metalness: 0.75 });
  const seat = M.solid(0x46443e, { roughness: 0.8, metalness: 0.05 });

  const gap = 41 * Math.PI / 180;
  B.put(new THREE.RingGeometry(wr + 0.10, S.CUPOLA_RING_R, 72, 1,
    Math.PI / 2 + gap, TAU - gap * 2), deckMat, 0, 0.016, wz,
    { rx: -Math.PI / 2, receive: true });

  /* the shaft, the glazing and the collars. The pane keeps the depthWrite:
     false every window in this building has: a pane that writes depth here
     is the last thing between the gallery and a planet 300 m below.

     It is the walking glazing rather than the wall glazing, and the sheen
     over it is the reason the well reads as a floor at all: from the deck
     you are looking at a hole with a ring round it until something on the
     surface answers the room's own light back. The ring of lit steel is the
     edge; the sheen is the pane. */
  B.put(new THREE.CylinderGeometry(wr, wr, 0.42, 40, 1, true),
    M.solid(0x22262c, { roughness: 0.7, metalness: 0.35, side: THREE.DoubleSide }),
    0, -0.19, wz, { cast: false });
  B.put(new THREE.CircleGeometry(wr - 0.02, 48), M.floorGlass, 0, -0.05, wz,
    { rx: -Math.PI / 2, order: 5, userData: { window: true } });
  B.put(new THREE.CircleGeometry(wr - 0.06, 48), M.glazingSheen, 0, -0.03, wz,
    { rx: -Math.PI / 2, order: 6 });
  B.put(new THREE.TorusGeometry(wr + 0.09, 0.10, 8, 48), frame, 0, -0.01, wz,
    { rx: Math.PI / 2, cast: false });
  /* the lit lip. This is the ring that used to fog the Cupola: it sits at eye
     height, three metres from the eye that is meant to be looking at a planet,
     and it ran at the intensity an edge needs to read at eighty metres. Trim
     material, and a tube a third the size: the lip still catches the eye, it
     just stops being the subject of the photograph. */
  B.put(new THREE.TorusGeometry(wr + 0.05, S.RIM_TUBE_TRIM, 6, 48), H.rimTrim, 0, 0.03, wz,
    { rx: Math.PI / 2 });

  /* the rail at the well's edge: a station's edge protection — two rails
     and posts — not a museum's balustrade */
  for (const [ry, tube] of [[1.02, 0.028], [0.52, 0.016]]) {
    B.put(new THREE.TorusGeometry(S.CUPOLA_RAIL_R, tube, 8, 48), steel, 0, ry, wz,
      { rx: Math.PI / 2, cast: true });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    B.put(new THREE.CylinderGeometry(0.022, 0.022, 1.02, 8), steel,
      Math.sin(a) * S.CUPOLA_RAIL_R, 0.51, wz + Math.cos(a) * S.CUPOLA_RAIL_R, { cast: true });
  }

  /* four benches facing the well. They face down, not up: the window is in
     the floor, and the room's whole point is that the planet comes up at
     you from under your feet. */
  for (const deg of [45, 120, 240, 315]) {
    const a = deg * Math.PI / 180;
    const bx = Math.sin(a) * 2.55, bz = wz + Math.cos(a) * 2.55;
    B.put(new THREE.BoxGeometry(1.50, 0.09, 0.44), seat, bx, 0.45, bz,
      { ry: a, cast: true, receive: true });
    for (const sx of [-1, 1]) {
      B.put(new THREE.BoxGeometry(0.08, 0.45, 0.40), seat,
        bx + sx * 0.62 * Math.cos(a), 0.225, bz - sx * 0.62 * Math.sin(a), { ry: a, cast: true });
    }
  }

  /* the name plate over the room's mouth, facing the arch you came in by.
     Every other plate in the building is hung inside a room group that is
     turned to face its corridor, and the sign texture is painted for that:
     the generic builder puts its plate down with ry π. This one is hung in
     the hub frame with no turn, so the texture arrives back to front and the
     first thing a visitor reads at the front door is "yɿoʇsɒɘpʇǝ". The
     texture is flipped rather than the plate, because the plate has to face
     the door it is over. */
  if (!room._signMat) {
    const signTex = roomSign(Object.assign({ no: plan.rooms.indexOf(room) + 1 }, room), THREE, 4);
    signTex.userData.room = room.id;
    signTex.wrapS = THREE.RepeatWrapping;
    signTex.repeat.x = -1;
    signTex.offset.x = 1;
    room._signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: 0xffffff, emissiveMap: signTex,
      emissiveIntensity: 0.72, roughness: 0.8, side: THREE.DoubleSide
    });
  }
  const sz = wz + S.CUPOLA_RING_R + 0.12;
  B.put(new THREE.PlaneGeometry(1.44, 0.36), room._signMat, 0, 1.86, sz);
  for (const sx of [-1, 1]) {
    B.put(boxUV(0.06, 1.68, 0.06, 1.6), steel, sx * 0.66, 0.84, sz, { cast: true });
  }

  /* the Observatory's exhibits: acquisition slots for now — Astronomy holds
     nothing yet — standing in a ring that faces the well rather than a wall.
     The plan writes plinth spots in the room's own frame, which is turned π
     and hinged at the door; this group is the hub, unrotated, so the spots are
     carried across by hand. Read straight, the ring lands a few metres off
     where the plan put it — one pedestal ended up inside the well. */
  addPlinths(g, B, kit, room, pickables, room.plinths.map((s) => ({
    u: room.entry.x - s.u, v: room.entry.z - s.v, face: s.face
  })), (r, i, spot) => ({ room: r.id, link: r.items[i] === undefined ? null : r.items[i], spot }));
  B.flush();
}

/* ── culling by spoke ────────────────────────────────────────────────────
   The twelve ranges do not touch each other: from inside one you cannot look
   down another, and the wedge between two is a wall rather than a window. So
   the frame does not submit the eleven you are not standing in.

   This is deliberately not left to the frustum. The rotunda is a hub with
   twelve arches off it, and a camera in the middle of it has all twelve
   ranges inside its frustum even though the visitor can see down three of
   them; and a 40 m corridor keeps its bounding sphere touching the visitor
   from wherever they stand, so the frustum never drops it either. So the
   building is hung in explicit groups — one per range, one per cellar arm,
   one for the hub and one for the cellar floor — and this says which of them
   are on, from where the visitor is standing and which way they are facing.

   Two rules, both cheap:
     · a range is on if the visitor is in it or within REACH of its shell.
       REACH is not small on purpose: the side rooms lean out into the wedge
       between ranges, four or five metres from the next range's wall, and
       their windows look straight at it. a range culled while you are reading
       the room next door is a hole in the building.
     · while the visitor is in the hub, the ranges whose arch they are facing
       are on — three of them at 30° apart, which is what standing in the
       middle of a drum actually shows you.
   The cellar is gated by storey as well: nothing under the slab is submitted
   while you are walking upstairs, except the flight and the hall under the
   well, which you can see straight down at from the rotunda floor.

   What this does not do is keep the sun honest. The shadow map is one pass
   over whatever is on the list, so a wall in a range that is off stops
   throwing its shadow into the range that is on. It is a soft difference in
   a patch of light you are not looking at, and it is the price of the frame. */
const REACH = 6.0;                        // metres of shell either side of you
const HUB_REACH = 12.0;                   // how far down a range you still see the drum
const CONE = 55 * Math.PI / 180;          // ±two ranges either side of the way you face
/* A range that is already lit stays lit 3 m further out than one that is not,
   and a range in the hub's view cone stays in it 10° past the edge. Without
   that the threshold is a tripwire: walk down a corridor at the speed a body
   walks and the range on your left vanishes at the exact metre the arithmetic
   says it may. That is the pop-in — not the number of objects.
   AHEAD is the other half of the answer: a range you are walking towards comes
   on while it is still 7 m away, so it is there when you arrive rather than
   arriving as you arrive. */
const LEAVE = 3.0;
const AHEAD = 7.0;
const CONE_LEAVE = 10 * Math.PI / 180;
/* How long a wing stays up after it stops qualifying. Hysteresis widened the
   thresholds and the look-ahead point brought a wing on before you reach it,
   and what was left in `check-pop` was eleven wings flipping on and off as the
   visitor walked along the edge of one's reach — a threshold crossed twice in a
   second is the pop a visitor actually sees, because it happens in front of
   them rather than down a corridor they have just turned into. A quarter of a
   second of grace is longer than a stride and shorter than a glance, so the
   flicker goes and nothing visible is held on any longer than it was. */
const DWELL = 0.35;

/* one wing's decision, with the grace period attached to the wing rather than
   to the loop, so a wing that has been off for a while does not inherit
   somebody else's timer. Coming on is always instant; only going away waits.
   The wait is counted in seconds handed in by the frame, not by the wall clock:
   a probe that steps the building a hundred times in a heartbeat has to be
   asked about the same walk the visitor takes, and a cull that reads the clock
   would answer about the probe instead. */
function hold(w, show, dt, was) {
  if (show) { w.offFor = 0; return true; }
  if (!was) { w.offFor = 0; return false; }
  w.offFor = (w.offFor || 0) + dt;
  if (w.offFor >= DWELL) { w.offFor = 0; return false; }
  return true;
}

/* distance from a point to a rotated rect, 0 when inside it */
function distToRect(x, z, r) {
  const st = Math.sin(r.angle), ct = Math.cos(r.angle);
  const dx = x - r.cx, dz = z - r.cz;
  const lx = Math.abs(dx * ct - dz * st) - r.halfX;
  const lz = Math.abs(dx * st + dz * ct) - r.halfZ;
  const ax = lx > 0 ? lx : 0, az = lz > 0 ? lz : 0;
  return Math.sqrt(ax * ax + az * az);
}

function spokeCull(o) {
  const { wings, hub, cellarHub, hall, well } = o;
  let on = true;
  const groups = [hub, cellarHub].concat(wings.map((w) => w.group));
  /* the two hubs are not records of their own the way a wing is, so their
     dwell timers live here */
  const hubState = { offFor: 0 };
  const cellarState = { offFor: 0 };
  return {
    /* the probe wants the whole building on the GPU at once, once, to have
       something to compare the standing positions against */
    off() {
      on = false;
      groups.forEach((g) => { g.visible = true; });
      wings.forEach((w) => { w.offFor = 0; });
      hubState.offFor = cellarState.offFor = 0;
    },
    enable() { on = true; },
    update(pos, fwd, dt) {
      if (!on) return;
      const step = dt === undefined ? 1 / 60 : Math.min(Math.max(dt, 0), 0.25);
      /* the same storey line lighting.js draws for the light pool, so the
         rooms you can see and the rooms that light you are one answer */
      const basement = (pos.y - S.EYE_H) < S.FLOOR_BASE / 2;
      const r0 = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      const inHub = !basement && r0 < S.ROTUNDA_R;
      const inHall = basement && hall && distToRect(pos.x, pos.z, hall) < 1.0;
      const nearWell = distToRect(pos.x, pos.z, well) < 9.0;
      const facing = Math.atan2(fwd.x, fwd.z);
      const ax = pos.x + fwd.x * AHEAD, az = pos.z + fwd.z * AHEAD;
      for (const w of wings) {
        if ((w.storey === 'basement') !== basement) {
          /* the other storey is not a threshold, it is a different floor: that
             one switches the instant you are on the other side of the slab */
          w.group.visible = false; w.offFor = 0; continue;
        }
        const was = w.group.visible;
        const reach = was ? REACH + LEAVE : REACH;
        let show = false;
        for (const r of w.rects) {
          if (distToRect(pos.x, pos.z, r) < reach || distToRect(ax, az, r) < REACH) { show = true; break; }
        }
        if (!show && (inHub || inHall)) {
          let d = Math.atan2(w.dir.x, w.dir.z) - facing;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          show = Math.abs(d) < CONE + (was ? CONE_LEAVE : 0);
        }
        w.group.visible = hold(w, show, step, was);
      }
      /* the drum is visible from the first metres of every range, through the
         arch you came out of, and from the head of the stair looking down */
      hub.visible = hold(hubState,
        nearWell || (basement ? false : r0 < S.ROTUNDA_R + HUB_REACH), step, hub.visible);
      cellarHub.visible = hold(cellarState,
        nearWell || (basement && hall && distToRect(pos.x, pos.z, hall) < REACH), step, cellarHub.visible);
    }
  };
}

export function buildBuilding(THREE, plan, M) {
  const group = new THREE.Group();
  const pickables = [];
  const L = lampMats(M);
  const H = hullMats(M);
  const kit = plinthKit(M);
  /* the props write their collision circles here, and the hub is built before
     any room, so the list has to exist before the first `block` call */
  plan.obstacles = plan.obstacles || [];

  /* the building is hung in the spaces the visitor moves between, not in the
     order they were built: a hub, a cellar floor, and one group per range and
     per cellar arm, so the cull has something to switch off. There is no
     ground group any more: outside the hull there is nothing to switch. */
  const hub = new THREE.Group();
  const cellarHub = new THREE.Group();
  group.add(hub, cellarHub);

  buildRotunda(hub, plan, M, pickables, L, kit, H);
  const hall = buildStairHall(cellarHub, plan, M, L);
  buildStair(cellarHub, plan, M, L);
  /* the lift hangs on the hub and not on the cellar hub with the stair: the
     shaft and the cabin are meant to be seen from the rotunda, which is the
     place where the choice between the stair and the lift is made, and the
     cull keeps the hub on whenever the visitor is anywhere near the well */
  const lift = buildLift(hub, plan, M, L);
  const anim = (hall.userData.anim || []).slice();

  const wings = plan.corridors.map((c) => {
    const g = new THREE.Group();
    group.add(g);
    return {
      storey: c.floor === 'basement' ? 'basement' : 'ground',
      dir: c.dir,
      group: g,
      rects: [shellRect(plan, c)]
    };
  });
  const wingOf = new Map();
  plan.corridors.forEach((c, i) => {
    wingOf.set(c.range, wings[i]);
    buildCorridor(wings[i].group, M, c, L, plan, H);
  });
  plan.rooms.forEach((room) => {
    const w = wingOf.get(room.range) || wings[0];
    /* the room's own footprint, so standing in a side room that leans out of
       its range still counts as being in that range */
    w.rects.push({
      cx: room.center.x, cz: room.center.z,
      halfX: room.w / 2, halfZ: room.d / 2, angle: room.angle
    });
    /* The Observatory is a round gallery with its own builder — deck ring,
       well, rail, dome — and the generic room builder was laying a rectangular
       box of walls and a ceiling over the top of it, plus a second ring of
       pedestals in a second frame. Twelve pedestals for six spots, and a
       backwards sign. The gallery wins; the generic builder stands down. */
    if (room.kind === 'cupola') return;
    buildRoom(w.group, plan, M, room, pickables, L, kit);
  });

  /* the cellar gets its weather per arm: one damp sheet, one web sheet and
     one cloud of dust for each arm, welded across every room on it. That is
     deliberately not per room — the cull already switches a whole arm, so the
     damp and the drifting dust go off with it, and the building pays two draw
     calls per arm instead of six per room. */
  plan.corridors.forEach((c, i) => {
    if (c.floor !== 'basement') return;
    const rooms = plan.rooms.filter((r) => r.floor === 'basement' && r.range === c.range);
    const a = cellarArm(wings[i].group, rooms);
    if (a) anim.push(...a);
  });

  const well = wellOf(plan);
  const cull = spokeCull({
    wings, hub, cellarHub,
    hall: plan.walkable.rects.find((r) => r.room === plan.stair.to),
    well: {
      cx: (well.x0 + well.x1) / 2, cz: (well.z0 + well.z1) / 2,
      halfX: (well.x1 - well.x0) / 2, halfZ: (well.z1 - well.z0) / 2, angle: 0
    }
  });
  /* render.js finds this by name off the group it is handed, so the frame
     asks the building what it can see whether the composer or a probe is
     holding the renderer */
  group.userData.cull = cull;
  return { group, pickables, cull, anim, wings, lift };
}
