/* ── 02 · utils ────────────────────────────────────────────────────────── */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
/* Slow-in / slow-out — the curve every camera flight and transition rides. */
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad2 = (n) => String(n).padStart(2, '0');
/* Deterministic jitter from an integer: same exhibit, same wobble, every load. */
const hash01 = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch (err) { return url.slice(0, 40); }
};
/* The only user-typed string in the app is the search term, and it only ever
   reaches innerHTML through here. */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
function highlight(name, query) {
  if (!query) return esc(name);
  const i = name.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return esc(name);
  return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + query.length)) +
         '</mark>' + esc(name.slice(i + query.length));
}
const polarX = (a, r) => Math.sin(a) * r;
const polarZ = (a, r) => Math.cos(a) * r;
/* three's ring/cylinder arcs start at +X and sweep to +Y; our polar angles
   start at +Z and sweep to +X. One offset reconciles them, everywhere. */
const arcTheta = (a) => a - Math.PI / 2;

/* localStorage, wrapped so private-mode failures can never break a visit. */
const store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem('museum.' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) { return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem('museum.' + key, JSON.stringify(value)); } catch (err) { /* ignore */ }
  }
};

let toastTimer = 0;
function toast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2600);
}
function announce(message) { dom.a11y.textContent = message; }

function curtain(progress, step) {
  dom.curtainBar.style.width = Math.round(progress * 100) + '%';
  if (step) dom.curtainStep.textContent = step;
}
