/* ── 12 · catalogue ──────────────────────────────────────────────────────
   The readable version of the same collection: press C and the rotunda becomes
   a list. It is not a consolation screen — it is how you actually browse 88
   items quickly — and it is driven by exactly the same filter, so the two
   views are always in agreement. */

function catalogueMarkup() {
  const query = state.query.trim();
  const lower = query.toLowerCase();
  const saved = state.favs.size;

  const intro =
    '<div class="cat-intro">' +
      '<h2>' + state.visible.length + ' of ' + LINKS.length + ' exhibits, in the order they stand around the room</h2>' +
      '<p>The same collection as the rotunda, in type. Wings run in plan order, clockwise from ' +
      'the entrance; the accession number in the corner of each card is the number painted on ' +
      'its plaque. Anything filtered out in the room is dimmed here too.</p>' +
      '<div class="keys">' +
        '<span>' + LINKS.length + ' exhibits</span>' +
        '<span>' + plan.wings.length + ' wings</span>' +
        '<span>' + saved + ' saved</span>' +
        '<span>' + (query ? 'filtered by “' + esc(query) + '”' : 'no filter') + '</span>' +
      '</div>' +
    '</div>';

  const blocks = plan.wings.map((wing) => {
    const shown = countInWing(wing, lower);
    const lit = state.wingsOn.has(wing.name);
    const cards = wing.items.map((i) => {
      const link = LINKS[i];
      const hit = query && matchesQuery(link, lower);
      return '<article class="card' + (hit ? ' hit' : '') + '" data-index="' + i + '"' +
          ' aria-fav="' + (state.favs.has(link.u) ? 'true' : 'false') + '"' +
          ' style="--wing:' + link._wing.hex + '" tabindex="0">' +
        '<div class="top">' +
          '<span class="no">#' + pad2(i + 1) + '</span>' +
          '<span class="nm">' + (query ? highlight(link.n, query) : esc(link.n)) + '</span>' +
          '<button class="fav" type="button" data-act="fav" title="Save to favourites" aria-label="Save ' + esc(link.n) + ' to favourites">★</button>' +
        '</div>' +
        '<p class="d">' + esc(link.d) + '</p>' +
        '<div class="u">' + esc(hostOf(link.u)) + '</div>' +
        '<div class="row">' +
          '<a href="' + esc(link.u) + '" target="_blank" rel="noopener noreferrer">Open ↗</a>' +
          '<button type="button" data-act="room">View in the room</button>' +
        '</div>' +
      '</article>';
    }).join('');

    return '<section class="wing-block' + (lit && shown ? '' : ' dimmed') + '"' +
        ' style="--wing:' + wing.hex + '" id="cat-' + wing._id + '">' +
      '<header class="wing-head">' +
        '<i class="dot"></i><h3>' + esc(wing.name) + '</h3>' +
        '<span class="sub">' + shown + ' / ' + wing.items.length + ' exhibits · radius ' + Math.round(wing.rMax) + 'm</span>' +
        '<button class="jump" type="button" data-wing="' + esc(wing.name) + '">Stand in this wing →</button>' +
      '</header>' +
      '<div class="grid">' + cards + '</div>' +
    '</section>';
  }).join('');

  return intro + blocks;
}

function paintCatalogue() {
  dom.catalogue.innerHTML = catalogueMarkup();
}

/* One delegated listener for the whole list: cards, stars and the wing
   shortcuts are all recognised from the markup itself. */
function bindCatalogue() {
  dom.catalogue.addEventListener('click', (event) => {
    const jump = event.target.closest('[data-wing]');
    if (jump) {
      setMode('rotunda');
      flyToWing(jump.dataset.wing, 1.4);
      return;
    }
    const card = event.target.closest('.card');
    if (!card) return;
    const index = Number(card.dataset.index);
    const action = event.target.closest('[data-act]');
    if (action && action.dataset.act === 'fav') { toggleFavourite(index); return; }
    if (action && action.dataset.act === 'room') {
      setMode('rotunda');
      requestAnimationFrame(() => selectExhibit(index, true));
      return;
    }
    /* clicking the card body itself is the "take me there" gesture */
    setMode('rotunda');
    requestAnimationFrame(() => selectExhibit(index, true));
  });

  dom.catalogue.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.card');
    if (!card) return;
    setMode('rotunda');
    requestAnimationFrame(() => selectExhibit(Number(card.dataset.index), true));
    event.preventDefault();
  });
}
