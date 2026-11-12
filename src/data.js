/* ── data ────────────────────────────────────────────────────────────────
   The collection. Curated by hand, bundled at build time — nothing is
   fetched at runtime, so the page works offline and nothing the visitor
   types can reach the network. `n` name · `u` url · `c` category (room) ·
   `d` wall-label text.
   Single source of truth for v2. tools/check-data-v2.mjs compares this
   against the v1 table at the git tag `v1-rotunda` so nothing drifts. */
export const LINKS = [
  { n: 'Pirate Ship',            u: 'https://www.pirateship.com/',                                   c: 'Shopping', d: 'Free UPS and USPS-certified shipping software with pre-negotiated discounts.' },
  { n: 'Grayjay',                u: 'https://grayjay.app/',                                          c: 'Media',    d: 'YouTube, Twitch and more, all in one place.' },
  { n: 'Stremio',                u: 'https://www.stremio.com/',                                      c: 'Media',    d: 'Watch videos, movies, TV series and TV channels instantly.' },
  { n: 'Morphe',                 u: 'https://morphe.software/',                                      c: 'Android',  d: 'Android client for YouTube, YouTube Music and Reddit with pro features.' },
  { n: 'uBlock Origin',          u: 'https://ublockorigin.com/',                                     c: 'Privacy',  d: 'Free, open-source ad blocker. Use this on your phones and computers, dear god.' },
  { n: 'Lain Animated Theme',    u: 'https://addons.mozilla.org/en-US/firefox/addon/lain-animated-theme/', c: 'Privacy', d: "Cool theme for Firefox, Waterfox, Floorp and LibreWolf. Let's all love Lain!" },
  { n: 'Waterfox',               u: 'https://www.waterfox.com/',                                     c: 'Privacy',  d: 'Open source web browser that respects your privacy.' },
  { n: 'Proton VPN',             u: 'https://protonvpn.com/',                                        c: 'Privacy',  d: 'Free VPN for torrents. Fast, secure, 120+ countries.' },
  { n: 'Bitwarden',              u: 'https://bitwarden.com/',                                        c: 'Privacy',  d: 'Password manager. Open source, free tier, works everywhere.' },
  { n: 'APKMirror',              u: 'https://www.apkmirror.com/',                                    c: 'Android',  d: 'Get most pro/paid apps free on Android — no Play Store needed.' },
  { n: 'microG GmsCore',         u: 'https://github.com/microg/GmsCore/releases/tag/v0.3.12.250932',  c: 'Android',  d: 'For people who hate Google Play Services.' },
  { n: 'Bazzite',                u: 'https://bazzite.gg/',                                           c: 'Linux',    d: 'Gaming OS — performs way better than Windows. Desktop, handheld and HTPC.' },
  { n: 'EndeavourOS',            u: 'https://endeavouros.com/',                                      c: 'Linux',    d: 'Traditional desktop workspace OS — lightweight Arch-based, terminal centric.' },
  { n: 'Obsidian',               u: 'https://obsidian.md/',                                          c: 'Creative', d: 'One of my writing tools. Local-first markdown notes that link together.' },
  { n: 'Standard Notes',         u: 'https://standardnotes.com/',                                    c: 'Creative', d: 'Encrypted notes, end to end.' },
  { n: 'LibreOffice',            u: 'https://www.libreoffice.org/',                                  c: 'Creative', d: 'No more Google Docs or paying for Word.' },
  { n: 'Photopea',               u: 'https://www.photopea.com/',                                     c: 'Creative', d: 'Photoshop, in the browser. Opens PSDs, free, no install.' },
  { n: 'Kdenlive',               u: 'https://kdenlive.org/',                                         c: 'Creative', d: "Open source video editor, if you don't use DaVinci." },
  { n: 'remove.bg',              u: 'https://www.remove.bg/upload',                                  c: 'Creative', d: 'Removes image backgrounds automatically in 5 seconds. My secret weapon.' },
  { n: 'MakeAGif',               u: 'https://makeagif.com/youtube-to-gif',                           c: 'Creative', d: 'YouTube to GIF, quick and painless.' },
  { n: 'ytmp3',                  u: 'https://ytmp3.ai/',                                             c: 'Media',    d: 'I use this to download music.' },
  { n: 'Salt Player',            u: 'https://github.com/Moriafly/SaltPlayerSource',                  c: 'Android',  d: 'FOSS local music player for Android with lots of features. Works well.' },
  { n: 'projectM',               u: 'https://projectm-visualizer.org/',                              c: 'Media',    d: 'Miss the days of Xbox music players and PS2 visualizers? Tons of presets, MilkDrop compatible.' },
  { n: 'Tuta',                   u: 'https://mail.tutanota.com/',                                    c: 'Privacy',  d: 'End-to-end encrypted email and calendar.' },
  { n: 'OsmAnd',                 u: 'https://osmand.net/',                                           c: 'Privacy',  d: 'Offline maps and navigation. Stored on your phone, not the cloud.' },
  { n: 'Fossify Messages',       u: 'https://f-droid.org/packages/org.fossify.messages/',            c: 'Android',  d: 'Open-source, ad-free SMS/MMS app. Get away from big tech.' },
  { n: 'Aurora Store',           u: 'https://store.auroraoss.com/',                                  c: 'Android',  d: 'My main app store alongside F-Droid. Play Store without the Play Store.' },
  { n: 'Sunshine',               u: 'https://github.com/LizardByte/Sunshine',                        c: 'Gaming',   d: 'Have a good host PC? Stream games to other devices and play in bed on your phone or tablet.' },
  { n: 'Moonlight',              u: 'https://moonlight-stream.org/',                                 c: 'Gaming',   d: 'Companion for Sunshine — install on the device you want to play on.' },
  { n: "Anna's Archive",         u: 'https://annas-archive.li/',                                     c: 'Reading',  d: "Free books and music. Great for books you can't find on sale, manga, comics." },
  { n: 'Discuit',                u: 'https://discuit.org/',                                          c: 'Media',    d: 'Reddit alternative with about 10k people. Making discussions better.' },
  { n: 'Jellyfin',               u: 'https://jellyfin.org/',                                         c: 'Media',    d: 'Like Plex but less shitty — think Netflix at home, self-hosted.' },
  { n: '9Anime',                 u: 'https://9anime.za.com/',                                        c: 'Media',    d: 'ANIME.' },
  { n: 'Globe TV',               u: 'https://globetv.app/',                                          c: 'Media',    d: 'Free live TV worldwide. No account, no tracking.' },
  { n: 'Streameast',             u: 'https://www.istreameast.is/',                                   c: 'Media',    d: 'Live sports streaming — NFL, NBA, MLB, UFC, soccer and more.' },
  { n: 'r/roms',                 u: 'https://r-roms.github.io/',                                     c: 'Gaming',   d: 'Get games for your emulator here.' },
  { n: 'Anime Planet',           u: 'https://www.anime-planet.com/anime/watch-online/',              c: 'Media',    d: 'Another anime source, with a solid catalogue and watch lists.' },
  { n: 'PriceLasso',             u: 'https://pricelasso.com/app/',                                   c: 'Shopping', d: 'Price tracking and extension — see history before you buy.' },
  { n: 'SteamDB',                u: 'https://steamdb.info/',                                         c: 'Shopping', d: "See if you're actually getting a deal. Extension too." },
  { n: 'Koofr',                  u: 'https://koofr.eu/',                                             c: 'Tools',    d: 'European cloud storage that respects privacy. Get away from Google Storage.' },
  { n: 'Parsec',                 u: 'https://parsec.app/downloads',                                  c: 'Gaming',   d: 'Share your desktop with a friend — great for playing games together or collabing.' },
  { n: 'Let your chat bully you', u: 'https://remasuri3.itch.io/tits',                               c: 'Gaming',   d: 'Tool I use to throw shit at me on stream.' },
  { n: 'EmuDeck',                u: 'https://www.emudeck.com/',                                      c: 'Gaming',   d: 'Easy all-in-one emulator setup for SteamOS, Steam Deck and ROG Ally.' },
  { n: 'Aegis',                  u: 'https://getaegis.app/',                                         c: 'Privacy',  d: '2FA authenticator — the alternative to Authy.' },
  { n: 'Useful Steam apps',      u: 'https://imgur.com/a/ba1NqR8',                                   c: 'Gaming',   d: 'An imgur album of Steam apps that are actually useful.' },
  { n: 'Firefox Relay',          u: 'https://relay.firefox.com/',                                    c: 'Privacy',  d: 'Mask your email and phone number when signing up for things.' },
  { n: 'n-Track Studio',         u: 'https://ntrack.com/download.php',                               c: 'Creative', d: 'Make music. Full recording studio on Windows, Mac and mobile.' },
  { n: 'ScienceOpen',            u: 'https://www.scienceopen.com/',                                  c: 'Reading',  d: 'Free academic papers.' },
  { n: 'Audion',                 u: 'https://www.audionplayer.com/',                                 c: 'Media',    d: 'Like Stremio but for music. Modern local player with synced lyrics and plugins.' },
  { n: 'Awesome Piracy',         u: 'https://shakil-shahadat.github.io/awesome-piracy/',             c: 'Reading',  d: 'A guide to the good life on the internet.' },
  { n: 'LumpySoft',              u: 'https://lumpysoft.com/',                                        c: 'Tools',    d: 'Alternate to Google search.' },
  { n: 'Google DeepMind',        u: 'https://deepmind.google/',                                      c: 'AI',       d: "Google's AI research lab. Behind Gemini, AlphaFold, and much of Google's AI stack." },
  { n: 'DeepSeek',               u: 'https://www.deepseek.com/',                                     c: 'AI',       d: 'Chinese open-weight LLM family. Strong coding and reasoning, free chat, cheap API.' },
  { n: 'DeepL',                  u: 'https://www.deepl.com/',                                        c: 'AI',       d: 'AI translator that consistently beats Google Translate for natural phrasing.' },
  { n: 'Hugging Face',           u: 'https://huggingface.co/',                                       c: 'AI',       d: 'The GitHub of AI — millions of open models, datasets and browser-run demo apps.' },
  { n: 'Antstream Arcade',       u: 'https://www.antstream.com/gameslist',                           c: 'Gaming',   d: 'Cloud-stream 1,300+ licensed retro games. Subscription, no downloads.' },
  { n: 'ASCII Paste Builder',    u: 'https://amwhoi.github.io/ascii-bin/builder.html',               c: 'Creative', d: 'Build and copy ASCII art bins for pasting into forums, chat, or comments.' },
  { n: 'GDQ Donation Generator', u: 'http://taskinoz.com/gdq/',                                      c: 'Tools',    d: 'Generates fake meme Games Done Quick donation comments.' },
  { n: 'GrapheneOS',             u: 'https://grapheneos.org/',                                       c: 'Privacy',  d: 'Hardened, de-Googled Android OS for Pixel devices. Sandboxed apps, no Play Services.' },
  { n: 'UEVR',                   u: 'https://github.com/praydog/UEVR',                               c: 'Gaming',   d: "Praydog's Universal Unreal Engine VR injector. Adds VR to UE4/5 games." },
  { n: 'Fanatical',              u: 'https://www.fanatical.com/',                                    c: 'Shopping', d: 'Official game key store (formerly Bundle Stars). Keys direct from publishers.' },
  { n: 'Liquipedia',             u: 'https://liquipedia.net/',                                       c: 'Gaming',   d: "Team Liquid's community esports wiki. 60+ games, match histories." },
  { n: 'Nexus Mods',             u: 'https://www.nexusmods.com/',                                    c: 'Gaming',   d: 'Largest game mod repository: 750k+ mods across 2,500+ games. Home of Vortex.' },
  { n: 'Game Compressor',        u: 'https://store.steampowered.com/app/4339880/',                   c: 'Gaming',   d: 'Steam utility that uses Windows LZX to shrink installed games by up to 50%.' },
  { n: '3D Controller Overlay',  u: 'https://store.steampowered.com/app/1951950/',                   c: 'Gaming',   d: 'Live 3D model of your controller, keyboard, and mouse for streams.' },
  { n: 'Lossless Scaling',       u: 'https://store.steampowered.com/app/993090/',                    c: 'Gaming',   d: 'Steam tool that adds frame generation and upscaling to almost any game.' },
  { n: 'Vortex',                 u: 'https://www.nexusmods.com/about/vortex/',                       c: 'Gaming',   d: "Nexus Mods' official mod manager. One-click installs, conflict resolution, profiles." },
  { n: 'Wallpaper Engine',       u: 'https://store.steampowered.com/app/431960/',                    c: 'Creative', d: 'Steam app for animated/live wallpapers. Import videos or websites.' },
  { n: 'PNGTuber Plus',          u: 'https://store.steampowered.com/app/2596880/',                   c: 'Creative', d: '2D PNGTuber software with sine-wave motion, sprite parenting.' },
  { n: '3tene',                  u: 'https://3tene.com/',                                            c: 'Creative', d: 'Real-time VRM/Live2D avatar app for VTubing. Webcam face tracking.' },
  { n: 'Aseprite',               u: 'https://www.aseprite.org/',                                     c: 'Creative', d: 'Pixel-art and animated sprite editor. Layers, frames, onion skinning, tilemaps.' },
  { n: 'WordPress',              u: 'https://wordpress.org/',                                        c: 'Dev',      d: 'Open-source CMS powering ~43% of the web. Blogs to stores.' },
  { n: 'Docker',                 u: 'https://www.docker.com/',                                       c: 'Dev',      d: 'Container platform for building and running apps consistently anywhere.' },
  { n: 'Astro',                  u: 'https://astro.build/',                                          c: 'Dev',      d: 'Content-focused web framework. Islands architecture ships zero JS by default.' },
  { n: 'OpenCCTV',               u: 'https://opencctv.org/',                                         c: 'Dev',      d: 'Open-source CCTV video analytics platform. Middleware + web app.' },
  { n: 'Android Developer Roadmap', u: 'https://github.com/skydoves/android-developer-roadmap',      c: 'Dev',      d: 'Community-maintained roadmap for learning Android dev: Kotlin, Compose.' },
  { n: 'Awesome C++',            u: 'https://github.com/fffaraz/awesome-cpp',                        c: 'Dev',      d: 'Curated list of C/C++ frameworks, libraries, and resources.' },
  { n: 'Awesome Creative Coding', u: 'https://github.com/terkelg/awesome-creative-coding',           c: 'Dev',      d: 'Curated resources for generative art, data visualization, and interaction design.' },
  { n: 'SpriteFusion',           u: 'https://www.spritefusion.com/editor',                           c: 'Creative', d: 'Browser pixel-art generator and editor. Exports Phaser-compatible spritesheets.' },
  { n: 'CPU-Z',                  u: 'https://www.cpuid.com/softwares/cpu-z.html',                     c: 'Tools',    d: 'Free system profiler: CPU name/codename/voltage, motherboard, RAM timings.' },
  { n: 'GPU-Z',                  u: 'https://www.techpowerup.com/gpuz/',                             c: 'Tools',    d: 'Lightweight GPU info utility: clocks, temps, fan speed, BIOS backup.' },
  { n: 'MSI Afterburner',        u: 'https://www.msi.com/Landing/afterburner/graphics-cards',        c: 'Tools',    d: 'Free GPU overclocking and monitoring tool. OC Scanner for one-click overclocking.' },
  { n: 'HWiNFO',                 u: 'https://www.hwinfo.com/',                                       c: 'Tools',    d: 'Deep hardware inventory and real-time sensor monitoring.' },
  { n: 'Linktree',               u: 'https://linktr.ee/',                                            c: 'Tools',    d: 'Link-in-bio page that bundles all your links into one URL.' },
  { n: 'Neal.fun',               u: 'https://neal.fun/',                                             c: 'Fun',      d: "Neal Agarwal's collection of 40+ free browser toys: The Password Game, Asteroid Launcher." },
  { n: 'PointlessSites',         u: 'https://www.pointlesssites.com/',                               c: 'Fun',      d: 'Curated directory of deliberately useless websites since 2002.' },
  { n: 'Rocket League Tracker',  u: 'https://overwolf.com/app/tracker_network-rocket_league_tracker', c: 'Gaming',  d: "Live match overlay showing every player's rank and MMR. Runs on Overwolf." },
  { n: 'Loaded',                 u: 'https://www.loaded.com/',                                       c: 'Shopping', d: 'CDKeys rebranded to Loaded in Sept 2025. Digital game keys for PC and consoles.' }
];

/* Rooms — one per category that already has links. The colour does the work
   of a label: plaque border, floor puck, door sign, minimap dot. */
export const WINGS = {
  Shopping: { hex: '#ffb84d', title: 'The Customs House' },
  Media:    { hex: '#5e9bff', title: 'The Screening Rooms' },
  Android:  { hex: '#3ddc84', title: 'The Green Hall' },
  Privacy:  { hex: '#22d3ee', title: 'The Vault' },
  Linux:    { hex: '#ff8a3d', title: 'The Server Alcove' },
  Creative: { hex: '#ff6ec7', title: 'The Atelier' },
  Reading:  { hex: '#c084fc', title: 'The Library' },
  Tools:    { hex: '#94a3b8', title: 'The Instrument Room' },
  AI:       { hex: '#34d399', title: 'The Engine' },
  Gaming:   { hex: '#ff5d7a', title: 'The Arcade Wing' },
  Dev:      { hex: '#60a5fa', title: 'The Print Shop' },
  Fun:      { hex: '#facc15', title: 'The Cabinet of Curiosities' }
};

export const WING_NAMES = Object.keys(WINGS);
export const WING_HEX = {};
export const WING_COLOR = {};
WING_NAMES.forEach((name) => {
  WING_HEX[name] = WINGS[name].hex;
  WING_COLOR[name] = parseInt(WINGS[name].hex.slice(1), 16);
});
