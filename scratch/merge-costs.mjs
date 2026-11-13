/* merge-costs.mjs — one pass, old twelve rooms → the new taxonomy.
 *
 *   node scratch/merge-costs.mjs            # report only
 *   node scratch/merge-costs.mjs --write    # rewrite src/data.js
 *
 * Reads the live collection (src/data.js) and the transcribed cost table
 * (scratch/candidates-software-costs.js), drops the rows that turned out to
 * be invented or duplicated, re-categorises everything into the room list
 * the owner dictated, and writes the result back as src/data.js.
 *
 * Every move is either a whole-category default (CAT) or a named exception
 * (OVER). Anything the owner added by hand, or anything that matches
 * neither, is printed as UNMAPPED and the write is refused — the collection
 * never silently guesses.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const load = async (p) => {
  const src = readFileSync(p, 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
};
const live = await load('src/data.js');
const { CANDIDATES } = await load('scratch/candidates-software-costs.js');
const write = process.argv.includes('--write');

/* ── the rooms, as dictated 2026-11-13 ───────────────────────────────
   45 categories + a charity room + three sub-rooms hung off their parent.
   `sub` rooms are entered through their parent, not off a corridor.
   Which rooms sit on the ground floor and which are banished to the
   basement is decided by the plan, not here: the fifteen with the fewest
   exhibits go downstairs. */
const ROOMS = [
  ['Privacy', 'The Vault'],
  ['AI', 'The Engine'],
  ['Content Creation', 'The Studio'],
  ['Self Hosting', 'The Server Farm'],
  ['Gaming', 'The Arcade Wing'],
  ['Media', 'The Screening Rooms'],
  ['Reverse Engineering', 'The Teardown Bench'],
  ['Programming', 'The Scriptorium'],
  ['Game Development', 'The Foundry'],
  ['Windows and Mac', 'The Front Desk'],
  ['Linux', 'The Server Alcove'],
  ['Web Dev', 'The Print Shop'],
  ['Android Dev', 'The Green Hall'],
  ['Apple Dev', 'The Orchard'],
  ['PC Tweaks', 'The Instrument Room'],
  ['Open Source', 'The Commons'],
  ['Art', 'The Atelier'],
  ['Creative Writing', 'The Writing Room'],
  ['Accessibility', 'The Ramp'],
  ['Modding', 'The Workbench'],
  ['Mod Development', 'The Back Room', { parent: 'Modding' }],
  ['Web Extension', 'The Frame'],
  ['Vtubing', 'The Green Room'],
  ['GitHub Repo', 'The Stacks'],
  ['Science', 'The Lecture Hall'],
  ['History and Archives', 'The Archive'],
  ['Sports', 'The Grandstand'],
  ['Journalism', 'The Newsroom'],
  ['Psychology', 'The Consulting Room'],
  ['Philosophy', 'The Colonnade'],
  ['Emulation and Re(de)omps', 'The Cabinet of Curiosities'],
  ['Recompiles and Decompiles', 'The Bench', { parent: 'Emulation and Re(de)omps' }],
  ['Audio', 'The Live Room'],
  ['Hobbies', 'The Shed'],
  ['Astronomy', 'The Observatory'],
  ['Business', 'The Counting House'],
  ['Productivity', 'The Desk'],
  ['Photo and Video', 'The Darkroom'],
  ['Education', 'The Classroom'],
  ['Paid', 'The Gilded Gallery'],
  ['Reading', 'The Library'],
  ['Social Networks', 'The Atrium'],
  ['Music', 'The Music Room'],
  ['Ethical Shopping', 'The Back Counter', { parent: 'Shopping' }],
  ['Shopping', 'The Customs House'],
  ['Red and Blue Hat', 'The Range', { parent: 'Privacy' }],
  ['Charity', 'The Alms House']
];

/* ── rows that do not survive the merge ────────────────────────────── */
const DROP = {
  'Strong': 'no such product — strong.io is embedded hardware, strong.app is a gym log',
  'Movora': 'no such product — movora.com makes veterinary orthopaedic implants',
  'Ethereal': 'Ethereal is what Wireshark was called until 2003; it belongs on the Wireshark plaque, not on its own',
  'Kdenlive': 'already in the collection since v1',
  'Docker Desktop': 'same product as the existing Docker entry',
  'Tdarr Agent': 'same project as Tdarr',
  'Monkey': 'no AI voice/video API found at monkey.app',
  'Melon': 'the product became Streamlabs Talk Studio',
  'Unmanarr': 'checked: umanari-ai.com is a Japanese blog about one man\'s horse-racing prediction program, not a product'
};

/* ── whole-category defaults for the old 88 ────────────────────────── */
const CAT = {
  Shopping: 'Shopping', Media: 'Media', Android: 'Android Dev', Privacy: 'Privacy',
  Linux: 'Linux', Creative: 'Content Creation', Reading: 'Reading', Tools: 'PC Tweaks',
  AI: 'AI', Gaming: 'Gaming', Dev: 'Programming', Fun: 'Emulation and Re(de)omps'
};

/* ── named exceptions, old collection ──────────────────────────────── */
const OVER = {
  'Discuit': 'Social Networks',
  'projectM': 'Audio', 'Audion': 'Audio', 'n-Track Studio': 'Audio',
  'Photopea': 'Photo and Video',
  'Obsidian': 'Productivity', 'Standard Notes': 'Productivity', 'LibreOffice': 'Productivity',
  'Aseprite': 'Art', 'SpriteFusion': 'Art', 'ASCII Paste Builder': 'Art',
  'PNGTuber Plus': 'Vtubing', '3tene': 'Vtubing', 'Wallpaper Engine': 'Media',
  'WordPress': 'Web Dev', 'Astro': 'Web Dev',
  'Docker': 'Self Hosting', 'OpenCCTV': 'Self Hosting',
  'Awesome C++': 'Programming', 'Awesome Creative Coding': 'Programming',
  'Android Developer Roadmap': 'Android Dev',
  'Linktree': 'Social Networks', 'GDQ Donation Generator': 'Gaming',
  'GrapheneOS': 'Android Dev',
  'Nexus Mods': 'Modding', 'Vortex': 'Modding', 'xEdit': 'Modding',
  'UEVR': 'Modding', 'r/roms': 'Emulation and Re(de)omps', 'EmuDeck': 'Emulation and Re(de)omps',
  'Game Compressor': 'PC Tweaks', 'Lossless Scaling': 'PC Tweaks', '3D Controller Overlay': 'Media',
  'Parsec': 'Windows and Mac',
  'Loaded': 'Ethical Shopping',
  'Awesome Piracy': 'Emulation and Re(de)omps'
};

/* ── named exceptions, the cost table ──────────────────────────────── */
const OVER2 = {
  'vMix': 'Media', 'DaVinci Resolve': 'Content Creation', 'Adobe Premiere Elements': 'Content Creation',
  'Substance 3D Painter': 'Art', '010 Editor': 'Reverse Engineering', 'Filmora': 'Content Creation',
  'CryEngine': 'Game Development', 'Wirecast': 'Media', 'Switcher Studio': 'Media',
  'OneStream': 'Media', 'Vegas Pro': 'Content Creation', 'Lightworks': 'Content Creation',
  'Burp Suite': 'Red and Blue Hat', 'Drauger': 'Linux', 'FuzzIt': 'Red and Blue Hat',
  'F8N-Scanner': 'Audio', 'Nmap': 'Red and Blue Hat', 'Hashcat': 'Red and Blue Hat',
  'John the Ripper': 'Red and Blue Hat', 'Metasploit': 'Red and Blue Hat', 'BunkerWeb': 'Self Hosting',
  'TruffleHog': 'Red and Blue Hat', 'Gitleaks': 'Red and Blue Hat',
  'GDevelop': 'Game Development', 'Unreal Engine 5': 'Game Development', 'Unity Hub': 'Game Development',
  'Godot': 'Game Development', 'Flax Engine': 'Game Development', 'Open3D Engine': 'Game Development',
  'Armory3D': 'Game Development', 'Cocos2d-x': 'Game Development', 'Blender': 'Content Creation',
  'Quixel Mixer': 'Art', 'Cascadeur Physics': 'Art', 'Krita': 'Art', 'Inkscape': 'Art', 'GIMP': 'Art',
  'OpenSCAD': 'Art', 'F4SE': 'Mod Development', 'BepInEx': 'Mod Development', 'MelonLoader': 'Mod Development',
  'xEdit': 'Modding',
  'GetStream': 'Programming', 'Sentry': 'Programming', 'Postman': 'Web Dev', 'Hoppscotch': 'Web Dev',
  'Restream': 'Media', 'StreamYard': 'Media', 'Castr': 'Media', 'SAMMI': 'Media', 'LioranBoard': 'Media',
  'LiveWeb': 'Web Dev', 'GPT-6 Astra': 'AI', 'GlitchTip': 'Programming', 'Coda': 'Productivity',
  'CapCut': 'Content Creation', 'Mural': 'Productivity', 'Conceptboard': 'Productivity',
  'Notion': 'Productivity', 'Miro': 'Productivity', 'Lucidspark': 'Productivity', 'FigJam': 'Productivity',
  'Obsidian Canvas': 'Productivity', 'Whiteboard.fi': 'Education', 'Microsoft Whiteboard': 'Productivity',
  'GitKraken': 'Programming', 'Gogs': 'Programming', 'Portainer': 'Self Hosting',
  'Terraform Cloud': 'Self Hosting', 'Vagrant': 'Self Hosting', 'Packer': 'Self Hosting',
  'Traefik': 'Self Hosting', 'Ansible': 'Self Hosting', 'Minikube': 'Self Hosting', 'K3s': 'Self Hosting',
  'Nginx Proxy Manager': 'Self Hosting', 'Cockpit': 'Linux', 'Lazydocker': 'Self Hosting',
  'KubeSpy': 'Self Hosting', 'Skaffold': 'Self Hosting', 'Unleash': 'Programming',
  'Shotcut': 'Content Creation', 'Avidemux': 'Content Creation', 'HandBrake': 'Content Creation',
  'FFmpeg': 'Content Creation', 'Subtitle Edit': 'Content Creation', 'Tdarr': 'Self Hosting',
  'Bazarr': 'Self Hosting', 'Radarr': 'Self Hosting', 'Sonarr': 'Self Hosting', 'Prowlarr': 'Self Hosting',
  'Unmanarr': 'Self Hosting', 'VLC': 'Media', 'OBS Studio': 'Media', 'Wireshark': 'PC Tweaks',
  'CPU-Z': 'PC Tweaks', 'GPU-Z': 'PC Tweaks', 'MSI Afterburner': 'PC Tweaks', 'HWiNFO': 'PC Tweaks',
  'Gopass': 'Privacy', 'Zoxide': 'Linux', 'Broot': 'Linux', 'Cheat.sh': 'Linux',
  'Charybdis': 'Linux', 'Audacity': 'Audio', 'Fritzing': 'Hobbies', 'TiddlyWiki': 'Productivity',
  'Umanari': 'Media', 'Board': 'Business', 'Plinth': 'Charity'
};

/* ── corrections the sweep settled (filled in by hand after the check) ─ */
const URLFIX = {};

const rooms = new Map(ROOMS.map(([name, title, extra]) => [name, { name, title, ...(extra || {}) }]));
const known = new Set(rooms.keys());

const moves = [];
const unmapped = [];
const dropped = [];
const out = [];

for (const l of live.LINKS) {
  const room = OVER[l.n] || CAT[l.c];
  if (!room || !known.has(room)) { unmapped.push([l.n, l.c]); continue; }
  if (room !== l.c) moves.push([l.n, l.c, room]);
  out.push({ ...l, c: room });
}
for (const c of CANDIDATES) {
  if (DROP[c.n]) { dropped.push([c.n, DROP[c.n]]); continue; }
  const room = OVER2[c.n] || null;
  if (!room || !known.has(room)) { unmapped.push([c.n, c.c]); continue; }
  out.push({ n: c.n, u: URLFIX[c.n] || c.u, c: room, d: c.d, cost: c.cost });
}

console.log(`live ${live.LINKS.length} + table ${CANDIDATES.length} → ${out.length} exhibits`);
console.log(`dropped ${dropped.length}:`);
for (const [n, why] of dropped) console.log(`  ${n} — ${why}`);
if (unmapped.length) {
  console.log(`\nUNMAPPED ${unmapped.length} — refusing to write:`);
  for (const [n, c] of unmapped) console.log(`  ${n} (was ${c})`);
} else {
  console.log(`\nmoved ${moves.length} of the old 88:`);
  for (const [n, a, b] of moves) console.log(`  ${n}: ${a} → ${b}`);
}

const byRoom = {};
for (const e of out) (byRoom[e.c] ||= []).push(e);
console.log('\nroom load:');
for (const r of ROOMS) {
  const n = (byRoom[r[0]] || []).length;
  console.log(`  ${String(n).padStart(3)}  ${r[0]}${r[2] ? `  (sub of ${r[2].parent})` : ''}`);
}
const empty = ROOMS.filter((r) => !(byRoom[r[0]] || []).length);
console.log(`\nrooms with nothing in them: ${empty.length}`);
console.log('  ' + empty.map((r) => r[0]).join(', '));

if (unmapped.length) process.exit(1);
if (!write) { console.log('\ndry run — pass --write to rewrite src/data.js'); process.exit(0); }

/* emit src/data.js */
const hsl = (h, s, l) => {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};
const pad = (s, n) => String(s).padEnd(n);
const lines = [];
lines.push('/* ── data ────────────────────────────────────────────────────────────────');
lines.push('   The collection. Curated by hand, bundled at build time — nothing is');
lines.push('   fetched at runtime, so the page works offline and nothing the visitor');
lines.push('   types can reach the network. `n` name · `u` url · `c` room ·');
lines.push('   `d` wall-label text · `cost` price, shown on the plaque.');
lines.push('   Single source of truth for v2. scratch/check-data.mjs checks it for');
lines.push('   duplicates, dead categories and bad urls.');
lines.push('*/');
lines.push('export const LINKS = [');
for (const e of out) {
  const cost = e.cost ? ` cost: ${JSON.stringify(e.cost)},` : '';
  lines.push(`  { n: ${JSON.stringify(e.n)}, u: ${JSON.stringify(e.u)}, c: ${JSON.stringify(e.c)},${cost}`);
  lines.push(`    d: ${JSON.stringify(e.d)} },`);
}
lines.push('];');
lines.push('');
lines.push('/* Rooms. 45 categories plus a charity room and four sub-rooms entered');
lines.push('   through their parent. The plan decides who lives on the ground floor');
lines.push('   and who is banished to the basement: the fifteen with the fewest');
lines.push('   exhibits go downstairs, and a category with nothing in it is always');
lines.push('   downstairs until something arrives. */');
lines.push('export const ROOMS = [');
ROOMS.forEach(([name, title, extra], i) => {
  const hex = hsl(Math.round(i * 360 / ROOMS.length), 0.62, 0.66);
  const ex = extra ? `, parent: ${JSON.stringify(extra.parent)}` : '';
  lines.push(`  { name: ${JSON.stringify(name)}, title: ${JSON.stringify(title)}, hex: ${JSON.stringify(hex)}${ex} },`);
});
lines.push('];');
lines.push('');
lines.push('export const ROOM_NAMES = ROOMS.map((r) => r.name);');
lines.push('export const ROOM_BY_NAME = Object.fromEntries(ROOMS.map((r) => [r.name, r]));');
lines.push('export const ROOM_HEX = Object.fromEntries(ROOMS.map((r) => [r.name, r.hex]));');
lines.push('export const ROOM_COLOR = Object.fromEntries(ROOMS.map((r) => [r.name, parseInt(r.hex.slice(1), 16)]));');
lines.push('/* kept so the v1 tooling still resolves while the plan catches up */');
lines.push('export const WINGS = Object.fromEntries(ROOMS.map((r) => [r.name, { hex: r.hex, title: r.title }]));');
lines.push('export const WING_NAMES = ROOM_NAMES;');
lines.push('export const WING_HEX = ROOM_HEX;');
lines.push('export const WING_COLOR = ROOM_COLOR;');

writeFileSync('src/data.js', lines.join('\n') + '\n');
console.log(`\nwrote src/data.js — ${out.length} exhibits, ${ROOMS.length} rooms`);
