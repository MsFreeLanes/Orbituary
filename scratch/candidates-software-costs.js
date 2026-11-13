/* ── candidates: software-costs table, awaiting a ruling ───────────────
   The 100-row cost table handed over on 2026-11-12, transcribed into the
   museum's own entry shape and sorted high cost → low, as it arrived.

   Nothing here is live: src/data.js is still the only source of truth for
   the building. This file exists so the merge can be checked before it
   happens. `node scratch/check-candidates.mjs` reports what it would do.

   Extra fields, dropped on merge if we decide not to carry cost:
     cost  — display string, exactly as the table gave it
     dead  — the domain does not resolve at all; the entry is almost
             certainly invented, and there is nothing to put on a plinth
     fix   — the product is real but the URL in the table is wrong
     sus   — the domain resolves but does not belong to this product

   Category `c` is my proposal, not a decision: everything lands in the
   twelve rooms that already exist, because the plan locks rooms to the
   categories that already have links.

   Already dropped from the table, rather than carried here:
     Kdenlive — the collection has had it in the Atelier since v1.
   Kept but flagged as duplicates to resolve on merge:
     Docker Desktop vs the existing Docker entry
     Obsidian Canvas vs the existing Obsidian entry
     Tdarr Agent vs Tdarr (same project, two rows in the table) */
export const CANDIDATES = [
  // ── live production, editing, and the things you stream through ──
  { n: 'vMix', u: 'https://vmix.com/', c: 'Media', cost: '$300 (free)', d: 'The live production switcher broadcasters actually use — multi-camera, graphics, recording, streaming in one app.' },
  { n: 'DaVinci Resolve', u: 'https://blackmagicdesign.com/products/davinciresolve', c: 'Creative', cost: '$299 (free)', d: 'The free tier is a full edit suite; the paid one adds the colour page everyone grades in.' },
  { n: 'Adobe Premiere Elements', u: 'https://adobe.com/products/premiere-elements.html', c: 'Creative', cost: '$80', d: 'The home version of Premiere: guided edits, automatic organising, no timeline degree needed.' },
  { n: 'Unleash', u: 'https://getunleash.io/', c: 'Dev', cost: '$75 (free)', d: 'Feature flags and experimentation platform — ship the code, decide later who sees it.' },
  { n: 'Substance 3D Painter', u: 'https://adobe.com/products/substance3d-painter', c: 'Creative', cost: '$60/mo', fix: 'the table linked adobe.com/subst, which is not a page', d: 'Paint PBR textures straight onto a 3D model instead of UV-mapping and praying.' },
  { n: '010 Editor', u: 'https://sweetwatersystems.com/010editor', c: 'Tools', cost: '$60', fix: 'the table linked sweetberry.com, which is a different company', d: 'Hex editor with binary templates that parse a file format into readable fields.' },
  { n: 'Filmora', u: 'https://filmora.wondershare.com/', c: 'Creative', cost: '$45/yr (free)', d: 'Consumer video editor: effects built in, exports before you have learned anything.' },
  { n: 'CryEngine', u: 'https://cryengine.com/', c: 'Creative', cost: '$40/mo', d: 'The engine behind Crysis and Far Cry — still gorgeous, still not for beginners.' },
  { n: 'Strong', u: 'https://strong.io/', c: 'Gaming', cost: '$40/mo', sus: 'strong.io is an embedded-hardware API company, not a game-dev tool', d: 'Claimed as game development automation — unverified.' },
  { n: 'Wirecast', u: 'https://wirecast.com/', c: 'Media', cost: '$40/mo', d: 'Multi-camera live production for people who do weddings and church services.' },
  { n: 'Switcher Studio', u: 'https://switcher.studio/', c: 'Media', cost: '$40/mo', d: 'Turn several iPads or iPhones into one switched, live-broadcast multicam rig.' },
  { n: 'OneStream', u: 'https://onestream.app/', c: 'Media', cost: '$40/mo', d: 'Streaming that runs in the cloud, so your PC is free while the stream is up.' },
  { n: 'Vegas Pro', u: 'https://vegascreativ.com/', c: 'Creative', cost: '$40/mo', fix: 'Sony sold Vegas to Magix in 2016; the table still points at a Sony URL', d: 'Audio-first timeline editor — the one editors used before Resolve ate the world.' },
  { n: 'Burp Suite', u: 'https://portswigger.net/burp', c: 'Privacy', cost: '$40 (free)', d: 'The web security proxy: intercept every request your browser makes and change it.' },
  { n: 'Drauger', u: 'https://drauger.io', c: 'Privacy', cost: '$40/mo', dead: 'domain does not resolve', d: 'Claimed as a malware sandbox automation API — no such site.' },
  { n: 'FuzzIt', u: 'https://fuzzit.io', c: 'Dev', cost: '$40/mo', dead: 'domain does not resolve', d: 'Claimed as continuous fuzzing for web APIs — no such site.' },
  { n: 'GDevelop', u: 'https://gdevelop.io/', c: 'Gaming', cost: '$40 (free)', d: 'No-code, event-driven game engine. Real games ship out of it.' },
  { n: 'Docker Desktop', u: 'https://docker.com/products/docker-desktop', c: 'Dev', cost: '$40 (free)', dup: 'same product as the existing Docker entry — merge, do not double up', d: 'The Windows and Mac app that runs containers without a Linux box.' },
  { n: 'Lightworks', u: 'https://lightworks.io/', c: 'Creative', cost: '$40 (free)', fix: 'the table linked lightworksos.com, which does not resolve', d: 'The oldest pro NLE going — the one that cut the French Lieutenant\'s Woman.' },
  { n: 'Movora', u: 'https://movora.ai', c: 'AI', cost: '$30/mo', sus: 'real domain, but I cannot confirm it is an AI video generation API', d: 'Claimed as an AI video generation service — unverified.' },
  { n: 'Ethereal', u: 'https://ethereal.ai', c: 'Tools', cost: '$30/mo', sus: 'ethereal.ai is a fintech API company, not a traffic analyzer', d: 'Claimed as an AI network traffic analyzer — unverified.' },
  { n: 'GetStream', u: 'https://getstream.io/', c: 'Dev', cost: '$30 (free)', d: 'The chat and activity-feed API behind a lot of social apps you have used.' },
  { n: 'Sentry', u: 'https://sentry.io/', c: 'Dev', cost: '$29 (free)', d: 'Error tracking that tells you which line broke, in production, before users email you.' },
  { n: 'Postman', u: 'https://postman.com/', c: 'Dev', cost: '$25 (free)', d: 'The API workbench: build the request, save the collection, share the environment.' },
  { n: 'Restream', u: 'https://restream.io/', c: 'Media', cost: '$25 (free)', d: 'Send one stream to every platform at once instead of running six encoders.' },
  { n: 'StreamYard', u: 'https://streamyard.com/', c: 'Media', cost: '$25 (free)', d: 'Browser studio for interviews and live shows — no OBS, no capture card.' },
  { n: 'Monkey', u: 'https://monkey.app', c: 'AI', cost: '$25/mo', sus: 'melon.com and monkey.app are Korean companies, not voice APIs', d: 'Claimed as an AI voice and video generation API — unverified.' },
  { n: 'Castr', u: 'https://castr.io/', c: 'Media', cost: '$25/mo', d: 'Restream-style multi-destination streaming with a restream-to-anything endpoint.' },
  { n: 'LiveWeb', u: 'https://liveweb.com', c: 'Dev', cost: '$25/mo', dead: 'domain does not resolve', d: 'Claimed as a web server and hosting platform — no such site.' },
  { n: 'Astra', u: 'https://astra.io', c: 'Dev', cost: '$25/mo', sus: 'astra.io is a web-hosting brand, not a Kubernetes UI', d: 'Claimed as a Kubernetes cluster management UI — unverified.' },
  { n: 'Cascadeur Physics', u: 'https://cascadeur.com/physics', c: 'Creative', cost: '$19/mo', d: 'Physics-assisted keyframe animation: it checks that your character could actually stand up.' },
  { n: 'GlitchTip', u: 'https://github.com/glitchtip/glitchtip', c: 'Dev', cost: '$15 (free)', d: 'Self-hosted error tracking, Sentry-compatible, no vendor in the middle.' },
  { n: 'Coda', u: 'https://coda.io/', c: 'Creative', cost: '$15 (free)', d: 'Documents that are secretly apps — tables, buttons and automations inside a page.' },
  { n: 'CapCut', u: 'https://capcut.com/', c: 'Creative', cost: '$15 (free)', d: 'The editor that cut short video to death: auto captions, keyframes, templates.' },
  { n: 'SAMMI', u: 'https://sammi.app', c: 'Media', cost: '$15/mo', dead: 'domain does not resolve', d: 'Claimed as stream automation — no such site.' },
  { n: 'Mural', u: 'https://mural.co/', c: 'Creative', cost: '$12 (free)', d: 'Enterprise whiteboard with facilitation features — voting, timers, private mode.' },
  { n: 'Conceptboard', u: 'https://conceptboard.com/', c: 'Creative', cost: '$12 (free)', d: 'Infinite whiteboard aimed at engineering and product teams.' },
  { n: 'Notion', u: 'https://notion.so/', c: 'Creative', cost: '$12 (free)', fix: 'notion.so redirects; notion.so is the canonical one', d: 'Docs, wikis and databases in one block-based page.' },
  { n: 'Miro', u: 'https://miro.com/', c: 'Creative', cost: '$10 (free)', d: 'The whiteboard every company discovered during lockdown and never gave back.' },
  { n: 'Lucidspark', u: 'https://lucidspark.com/', c: 'Creative', cost: '$10 (free)', d: 'Brainstorming board from the Lucidchart people — sticky notes with structure.' },
  { n: 'Melon', u: 'https://melon.com', c: 'Media', cost: '$10/mo', sus: 'melon.com is a Korean e-commerce site, not an overlay platform', d: 'Claimed as a stream overlay and widget platform — unverified.' },
  { n: 'F8N-Scanner', u: 'https://f8nscanner.io', c: 'Privacy', cost: '$10/mo', dead: 'domain does not resolve', d: 'Claimed as a webhook credential scanner — no such site.' },
  { n: 'FigJam', u: 'https://figma.com/figjam', c: 'Creative', cost: '$5 (free)', d: 'Figma\'s whiteboard: same fonts, same feel, infinite canvas.' },
  { n: 'GitKraken', u: 'https://gitkraken.com/', c: 'Dev', cost: '$5 (free)', d: 'Git GUI with a history graph you can actually read.' },
  { n: 'Portainer', u: 'https://portainer.io/', c: 'Dev', cost: '$4 (free)', d: 'A web UI over the Docker socket — containers without the command line.' },
  { n: 'Terraform Cloud', u: 'https://terraform.io/cloud', c: 'Dev', cost: '$0.47/resource/mo (free)', d: 'Managed infrastructure as code: the plan runs somewhere other than your laptop.' },

  // ── free, but not cheap ──
  { n: 'Unreal Engine 5', u: 'https://unrealengine.com/', c: 'Creative', cost: 'free (5% royalty over $1M)', d: 'Nanite, Lumen, and the renderer half of Hollywood now shoots on.' },
  { n: 'Metasploit', u: 'https://metasploit.com/', c: 'Privacy', cost: 'free (Pro ~$149/mo)', fix: 'metasploit.com redirects to rapid7.com/metasploit', d: 'The exploitation framework: exploit database, payloads, post-exploitation.' },
  { n: 'Vagrant', u: 'https://vagrantup.com/', c: 'Dev', cost: 'free (commercial licence)', d: 'Describe a whole dev machine in one file; `vagrant up` builds it.' },
  { n: 'Packer', u: 'https://packer.io/', c: 'Dev', cost: 'free (commercial licence)', d: 'Build one machine image and emit it for every cloud at once.' },
  { n: 'Traefik', u: 'https://traefik.io/', c: 'Dev', cost: 'free (Hub per node)', d: 'Reverse proxy that notices your containers and reconfigures itself.' },
  { n: 'Ansible', u: 'https://ansible.com/', c: 'Dev', cost: 'free (paid Red Hat platform)', d: 'Agentless configuration management: plain YAML, SSH, no daemon on the target.' },

  // ── the free tier of everything ──
  { n: 'Hoppscotch', u: 'https://hoppscotch.io/', c: 'Dev', cost: 'free', fix: 'the table linked hoppscale.io, which does not resolve', d: 'A Postman that lives in a browser tab and opens in half a second.' },
  { n: 'xEdit', u: 'https://nexusmods.com/site', c: 'Gaming', cost: 'free', d: 'The Bethesda plugin editor — clean a masters file, find what two mods both changed.' },
  { n: 'Blender', u: 'https://blender.org/', c: 'Creative', cost: 'free', d: 'Modelling, sculpting, rigging, simulation, rendering, editing, the whole pipeline.' },
  { n: 'Quixel Mixer', u: 'https://quixel.com/mixer', c: 'Creative', cost: 'free', d: 'Mix scanned material layers into PBR textures, with the Megascans library behind it.' },
  { n: 'F4SE', u: 'https://f4se.silverlock.org/', c: 'Gaming', cost: 'free', d: 'Script extender for Fallout 4 — the floor under most of what modders write.' },
  { n: 'BepInEx', u: 'https://bepinex.dev/', c: 'Gaming', cost: 'free', d: 'The plugin framework half of Unity modding runs on.' },
  { n: 'MelonLoader', u: 'https://melonloader.com/', c: 'Gaming', cost: 'free', sus: 'the project lives on GitHub; melonloader.com may not be its site', d: 'C# mod loader for Unity games — Valheim, Lethal Company, and friends.' },
  { n: 'Unity Hub', u: 'https://unity.com/hub', c: 'Creative', cost: 'free', d: 'The one window that keeps your Unity versions, licences and projects straight.' },
  { n: 'Avidemux', u: 'https://avidemux.org/', c: 'Creative', cost: 'free', d: 'Cut and re-encode a video without pretending it is an edit.' },
  { n: 'Whiteboard.fi', u: 'https://whiteboard.fi/', c: 'Creative', cost: 'free', d: 'One whiteboard per student, all visible to the teacher, no accounts.' },
  { n: 'Microsoft Whiteboard', u: 'https://microsoft.com/whiteboard', c: 'Creative', cost: 'free', d: 'The Windows and Teams whiteboard — free with the account you already have.' },
  { n: 'Obsidian Canvas', u: 'https://obsidian.md/canvas', c: 'Creative', cost: 'free', d: 'Infinite node canvas inside the same vault as your notes.' },
  { n: 'Open3D Engine', u: 'https://o3de.org/', c: 'Creative', cost: 'free', fix: 'the table linked o3de.io, which does not resolve', d: 'Amazon\'s engine, open-sourced and renamed: Lumberyard\'s successor.' },
  { n: 'Flax Engine', u: 'https://flaxengine.com/', c: 'Creative', cost: 'free', d: 'C++ engine with a friendly editor — smaller than Unreal, faster to start.' },
  { n: 'Armory3D', u: 'https://armory3d.org/', c: 'Creative', cost: 'free', d: 'A game engine that lives inside Blender — model it, then run it.' },
  { n: 'Godot', u: 'https://godotengine.org/', c: 'Creative', cost: 'free', d: 'The free engine everyone moved to after the Unity pricing mess.' },
  { n: 'Cocos2d-x', u: 'https://cocos2d-x.org/', c: 'Gaming', cost: 'free', d: 'The C++ engine behind an enormous share of mobile games.' },
  { n: 'LioranBoard', u: 'https://lioranboard.com', c: 'Media', cost: 'free', dead: 'domain does not resolve', d: 'Claimed as an OBS control surface — the site is gone.' },
  { n: 'Minikube', u: 'https://minikube.sigs.k8s.io/', c: 'Dev', cost: 'free', d: 'A single-node Kubernetes cluster on your own machine.' },
  { n: 'K3s', u: 'https://k3s.io/', c: 'Dev', cost: 'free', d: 'Kubernetes cut down to under 100 MB so it runs on a Raspberry Pi.' },
  { n: 'Nginx Proxy Manager', u: 'https://nginxproxymanager.com/', c: 'Dev', cost: 'free', d: 'Certificates, redirects and proxy hosts behind a web form.' },
  { n: 'Cockpit', u: 'https://cockpit-project.org/', c: 'Linux', cost: 'free', fix: 'the table linked cockpit-project.com, which does not resolve', d: 'A real web console for a Linux server, shipped in the distro.' },
  { n: 'Shotcut', u: 'https://shotcut.org/', c: 'Creative', cost: 'free', d: 'Cross-platform editor with no account, no upsell, no phone-home.' },
  { n: 'Tdarr', u: 'https://tdarr.app/', c: 'Media', cost: 'free', fix: 'the table linked tdarr.dev, which does not resolve', d: 'Distributed transcoding queue — a farm of nodes chewing a library down.' },
  { n: 'Bazarr', u: 'https://bazarr.media/', c: 'Media', cost: 'free', d: 'The arr that hunts subtitles for everything the other arrs fetched.' },
  { n: 'Radarr', u: 'https://radarr.video/', c: 'Media', cost: 'free', d: 'Movie collection manager: want list, quality profile, library.' },
  { n: 'Sonarr', u: 'https://sonarr.tv/', c: 'Media', cost: 'free', d: 'The same idea for episodes, with season and episode granularity.' },
  { n: 'Prowlarr', u: 'https://prowlarr.com/', c: 'Media', cost: 'free', d: 'One place to configure indexers for the whole arr stack.' },
  { n: 'Unmanarr', u: 'https://unmanarr.org', c: 'Media', cost: 'free', dead: 'domain does not resolve', d: 'Claimed as media automation — no such project.' },
  { n: 'HandBrake', u: 'https://handbrake.fr/', c: 'Creative', cost: 'free', d: 'The transcoder: pick a preset, point it at the file, walk away.' },
  { n: 'FFmpeg', u: 'https://ffmpeg.org/', c: 'Creative', cost: 'free', d: 'The multimedia framework underneath almost every other entry in this room.' },
  { n: 'Subtitle Edit', u: 'https://subtitleedit.nl/', c: 'Creative', cost: 'free', fix: 'the table linked subtitleedit.com', d: 'The subtitle editor: sync, translate, spellcheck, convert between formats.' },
  { n: 'Tdarr Agent', u: 'https://tdarr.app/', c: 'Media', cost: 'free', dup: 'same project as Tdarr above — one plinth, not two', fix: 'linked tdarr.dev, which does not resolve', d: 'The worker node that joins a Tdarr server and does the actual encoding.' },
  { n: 'Fritzing', u: 'https://fritzing.org/', c: 'Tools', cost: 'free', d: 'Breadboard view to schematic to PCB, for people who wire things up.' },
  { n: 'TiddlyWiki', u: 'https://tiddlywiki.com/', c: 'Creative', cost: 'free', d: 'An entire personal wiki that is one HTML file you can email to yourself.' },
  { n: 'OpenSCAD', u: 'https://openscad.org/', c: 'Creative', cost: 'free', d: 'Model by writing code — version it, parameterise it, print it.' },
  { n: 'Krita', u: 'https://krita.org/', c: 'Creative', cost: 'free', d: 'Brush engine built for painting, with animation and HDR on top.' },
  { n: 'Inkscape', u: 'https://inkscape.org/', c: 'Creative', cost: 'free', d: 'The free vector editor: SVG as the native format, not an import.' },
  { n: 'Audacity', u: 'https://audacityteam.org/', c: 'Creative', cost: 'free', d: 'Record, cut, denoise, export. Still the first thing anyone installs.' },
  { n: 'GIMP', u: 'https://gimp.org/', c: 'Creative', cost: 'free', d: 'The free image editor, layers and masks and all of it.' },
  { n: 'VLC', u: 'https://videolan.org/', c: 'Media', cost: 'free', d: 'Plays the file. On every platform. Has always played the file.' },
  { n: 'OBS Studio', u: 'https://obsproject.com/', c: 'Media', cost: 'free', d: 'Scenes, sources, encoders — the free layer between your camera and the internet.' },
  { n: 'Wireshark', u: 'https://wireshark.org/', c: 'Tools', cost: 'free', d: 'Read the packets. The whole conversation, decoded, in colour.' },
  { n: 'Nmap', u: 'https://nmap.org/', c: 'Privacy', cost: 'free', d: 'The network scanner everything else is measured against.' },
  { n: 'Hashcat', u: 'https://hashcat.net/', c: 'Privacy', cost: 'free', d: 'GPU password recovery — the fastest thing at rule-based attacks.' },
  { n: 'John the Ripper', u: 'https://openwall.com/john', c: 'Privacy', cost: 'free', d: 'The original cracker: CPU, wordlists, rules, formats for everything.' },
  { n: 'TruffleHog', u: 'https://trufflesec.com/', c: 'Dev', cost: 'free', fix: 'the table linked trufflehog.io, which is not the project site', d: 'Finds secrets in git history, verified against the provider so you know they are live.' },
  { n: 'Gitleaks', u: 'https://gitleaks.io/', c: 'Dev', cost: 'free', d: 'Regex secret scanner built to run as a CI step and fail the build.' },
  { n: 'KubeSpy', u: 'https://github.com/kubespy', c: 'Dev', cost: 'free', dead: 'no such GitHub organisation', d: 'Claimed as a pod network visualiser — no such project.' },
  { n: 'Gopass', u: 'https://gopass.pw/', c: 'Privacy', cost: 'free', sus: 'the project site may be gopass.io', d: 'Password store for people who live in a terminal and trust git.' },
  { n: 'Zoxide', u: 'https://github.com/ajeetdsouza/zoxide', c: 'Linux', cost: 'free', d: 'A smarter cd that learns where you actually go.' },
  { n: 'Broot', u: 'https://github.com/canop/broot', c: 'Linux', cost: 'free', d: 'A tree view you can search, preview and open from in one screen.' },
  { n: 'Cheat.sh', u: 'https://cheat.sh/', c: 'Linux', cost: 'free', d: 'Community man pages in a terminal: `curl cheat.sh/tar`.' },
  { n: 'Lazydocker', u: 'https://github.com/jesseduffield/lazydocker', c: 'Dev', cost: 'free', d: 'A terminal dashboard for containers and their logs.' },
  { n: 'Gogs', u: 'https://gogs.io/', c: 'Dev', cost: 'free', d: 'A git server in one small Go binary — runs on the same Pi as K3s.' },
  { n: 'BunkerWeb', u: 'https://bunkerweb.io/', c: 'Privacy', cost: 'free', d: 'A hardened nginx with a WAF, already configured, in a container.' },
  { n: 'Skaffold', u: 'https://skaffold.dev/', c: 'Dev', cost: 'free', d: 'Save a file, rebuild, redeploy, tail the logs — on loop while you work.' },
  { n: 'Charybdis', u: 'https://charybdis.org', c: 'Tools', cost: 'free', sus: 'charybdis.org is an IRC daemon, not a packet capture engine', d: 'Claimed as a high-speed packet capture engine — unverified.' }
];
