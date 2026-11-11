/* ── 04 · layout ─────────────────────────────────────────────────────────
   The floor plan. A single ring of 88 exhibits overlaps itself (88 plinths
   need ~350 world units of circumference, a comfortable ring offers ~150), so
   the collection is arranged the way a real museum arranges a crowded annexe:

     · each wing owns a wedge of the rotunda, sized to its own width;
     · a wing's exhibits sit on 1–3 concentric arcs, widest arc outermost;
     · plaques rise with radius (CFG.ySlope), so the rows in front of you are
       always lower than the rows behind them — stadium seating, no occlusion.

   Wedges are allocated proportionally to (exhibits in the widest row + a gap
   allowance), which makes every wing's outer arc land at roughly the same
   radius while narrow wings recede into alcoves. Every number downstream —
   camera limits, wall, plan view, tour — is derived from this result.
   ───────────────────────────────────────────────────────────────────────── */
const plan = { wings: [], rMax: 0, rMin: 0, wallR: 0, floorR: 0 };

function buildFloorPlan() {
  const grouped = new Map();
  LINKS.forEach((link, i) => {
    if (!grouped.has(link.c)) grouped.set(link.c, []);
    grouped.get(link.c).push(i);
  });

  /* 1 · slice each wing into rows: never more than perRowCap wide, never more
        than maxRows deep, and always widest-row-first (outermost). */
  const wings = WING_NAMES.filter((name) => grouped.has(name)).map((name) => {
    const items = grouped.get(name);
    const depth = clamp(Math.ceil(items.length / CFG.perRowCap), 1, CFG.maxRows);
    const perRow = Math.ceil(items.length / depth);
    const rows = [];
    for (let start = 0; start < items.length; start += perRow) {
      rows.push(items.slice(start, start + perRow));
    }
    rows.sort((a, b) => b.length - a.length);
    return {
      name, hex: WING_HEX[name], color: WING_COLOR[name],
      _id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),   // stable slug for DOM ids
      items, rows, count: items.length, widest: rows[0].length
    };
  });

  /* 2 · allocate wedges. The gap allowance (gapItems, expressed in exhibits)
        is what keeps wings from grinding against each other. */
  let footprint = 0;
  wings.forEach((w) => { footprint += w.widest + CFG.gapItems; });
  const scale = TAU / footprint;
  let cursor = 0;
  wings.forEach((wing) => {
    wing.wedge = (wing.widest + CFG.gapItems) * scale;
    wing.aCenter = cursor + wing.wedge / 2;
    cursor += wing.wedge;
  });

  /* 3 · radii. A row of n exhibits needs n * pitch of arc, so the smallest
        radius it can sit at without spilling out of its wedge is
        n * pitch / wedge. Rows are then packed inward at rowGap spacing, and
        where that would squeeze a row past its wedge the row is allowed to
        lean into the gap between wings instead — radial neighbours are 6.5
        units apart, wider than any plaque, so leaning never collides. */
  wings.forEach((wing) => {
    wing.rows.forEach((row, depth) => {
      const tightest = (row.length * CFG.pitch) / wing.wedge;
      if (depth === 0) { row._r = tightest; return; }
      const outer = wing.rows[depth - 1]._r;
      row._r = clamp(tightest, outer - 2 * CFG.rowGap, outer - CFG.rowGap);
    });
    wing.rMax = wing.rows[0]._r;
    wing.rMin = wing.rows[wing.rows.length - 1]._r;
    wing.midR = (wing.rMax + wing.rMin) / 2;
  });

  plan.wings = wings;
  plan.rMax = Math.max(...wings.map((w) => w.rMax));
  plan.rMin = Math.min(...wings.map((w) => w.rMin));
  plan.wallR = plan.rMax + CFG.wallPad;
  plan.floorR = plan.rMax + CFG.floorPad;
  plan.camMax = Math.min(24, plan.rMin - 1.5);
  /* the architecture of the halls, derived once so every module agrees on
     where a room begins: the backdrop wall, and the partitions that start
     just outside the innermost row (which keeps the hub one open plaza). */
  plan.hallR = plan.wallR - CFG.washInset;
  plan.dividerR = plan.rMin + CFG.dividerIn;
  plan.dividerOutR = plan.wallR - 1.0;

  /* 4 · bake every exhibit's position into the link record. Depth 0 is the
        outer row, so `depth` counts down as the radius shrinks. */
  wings.forEach((wing) => {
    wing.rows.forEach((row, depth) => {
      row._y = CFG.yBase + (row._r - plan.rMin) * CFG.ySlope;
      const step = CFG.pitch / row._r;                       // constant world spacing
      row.forEach((linkIndex, k) => {
        const angle = wing.aCenter + (k - (row.length - 1) / 2) * step;
        const link = LINKS[linkIndex];
        link._i = linkIndex;
        link._wing = wing;
        link._r = row._r;
        link._y = row._y;
        link._depth = depth;
        link._a = angle;
        link._x = polarX(angle, row._r);
        link._z = polarZ(angle, row._r);
        link._plaque = { x: link._x, y: row._y, z: link._z };
      });
    });
    wing.midY = CFG.yBase + (wing.midR - plan.rMin) * CFG.ySlope;
    /* the floor footprint of the whole wing, used by the dais and plan view */
    wing.aSpan = wing.wedge * 0.94;
    wing.aStart = wing.aCenter - wing.aSpan / 2;
    /* the true boundary with the next wing around, where the piers stand */
    wing.aEnd = wing.aCenter + wing.wedge / 2;
  });

  /* plaques stand just inside their frame; the frame's outer shell is what the
     lights catch, so the two are offset by a hair rather than coplanar. */
  LINKS.forEach((link) => {
    link._plate = { x: polarX(link._a, link._r - 0.14), y: link._y, z: polarZ(link._a, link._r - 0.14) };
  });
}

/* Camera limits depend on the solved plan, so they are finalised after it. */
function applyCameraLimits() {
  CFG.camRadius = clamp(CFG.camRadius, CFG.camMin + 3, plan.camMax);
}
