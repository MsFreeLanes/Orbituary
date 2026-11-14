/* ── identity ────────────────────────────────────────────────────────────
   The one file the owner edits. Everything the museum says about itself —
   who it is run by, what it promises at the door, where to find the keeper,
   where to send money — is here, in plain lists, so that no other file in the
   building has to be opened to change a sentence.

   The ticket and the brochure in hud.js read from this. If a list is empty the
   brochure leaves the section out rather than inventing something to fill it,
   which is why `socials` and `donation` are empty right now: the museum will
   not print a handle or a payment link it was not given. */

export const IDENTITY = {
  /* the entity the museum belongs to. the repository is named for it. */
  entity: 'ORBITUARY',
  parent: 'Celestial Being',

  /* the name of the building you are standing inside */
  building: 'The Museum of Useful Links',

  /* the thesis, in the owner's words */
  thesis: 'A clean archive that is quietly coming apart.',

  /* Printed on the ticket. Agreeing to these is the door: there is no account,
     no form, and nothing to scan. Keep them short enough to actually read. */
  rules: [
    ['Everything here points somewhere else',
      'A plinth is a label, not the thing. The museum hosts no files, no mirrors and no copies of anyone’s software.'],
    ['Nothing is tracked',
      'No account, no cookie, no analytics, no third-party script. The whole museum is one file that runs on your own machine.'],
    ['Some of it is dead',
      'A plaque that says a project is gone stays on the wall. A headstone is not an endorsement; it is a record.'],
    ['Some of it is sharp',
      'The security, reverse-engineering and modding rooms hold tools that are legal to own and illegal to point at something that is not yours. That line is yours to hold.'],
    ['Prices and versions go stale',
      'The cost on a plaque is what it cost the day the plaque was written. Check the vendor before you buy anything.'],
    ['No warranty of any kind',
      'Links move, products die, companies change their minds. A museum is a promise about the past, not about tomorrow.']
  ],

  /* The keeper’s channels, printed at the end of the brochure and at the end of
     the curated tour. Fill in like:
       { label: 'mastodon', url: 'https://…' }
     Empty means the brochure says so plainly instead of making something up. */
  socials: [],

  /* The ask. Fill in like:
       { url: 'https://…', line: 'what the money is for' } */
  donation: null,

  /* How the collection is kept, printed beside the ask. */
  curation: 'Curated by hand. No affiliate links, no sponsored plinths, no search ranking. If a link is on a wall, somebody opened it first.'
};
