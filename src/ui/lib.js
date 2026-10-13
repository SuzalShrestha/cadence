import { icon } from './icons.js';
export { icon };

export const api = (m, ...a) => window.cadence.call(m, ...a);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const nowS = () => Math.floor(Date.now() / 1000);

// ---- durations ----------------------------------------------------------
const parts = (secs) => { const m = Math.round(Math.max(0, secs) / 60); return [Math.floor(m / 60), m % 60]; };
/** "8 hr 22 min" as HTML with quiet units (use inside .big / .mid). */
export function dur(secs) {
  const [h, m] = parts(secs);
  return h ? `${h}<span class="u">hr</span>${m}<span class="u">min</span>` : `${m}<span class="u">min</span>`;
}
export const durText = (secs) => { const [h, m] = parts(secs); return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`; };
export const short = (secs) => { const [h, m] = parts(secs); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`; };
export const clock = (secs) => {
  secs = Math.max(0, Math.floor(secs));
  const h = Math.floor(secs / 3600), p = (n) => String(n).padStart(2, '0');
  return (h ? `${h}:` : '') + `${p(Math.floor((secs % 3600) / 60))}:${p(secs % 60)}`;
};
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export function delta(cur, base, suffix) {
  if (!base) return `<span class="delta flat">No data ${suffix}</span>`;
  const d = Math.round(((cur - base) / base) * 100);
  return `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '+' : ''}${d}% ${suffix}</span>`;
}

// ---- dates (YYYY-MM-DD keys, local time) --------------------------------
export const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dateOf = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
export const today = () => keyOf(new Date());
export const tsOf = (k) => dateOf(k).getTime() / 1000;
export function rangeOf(view, k) {
  const d = dateOf(k);
  if (view === 'week') { const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const e = new Date(s); e.setDate(s.getDate() + 6); return [keyOf(s), keyOf(e)]; }
  if (view === 'month') return [keyOf(new Date(d.getFullYear(), d.getMonth(), 1)), keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (view === 'year') return [keyOf(new Date(d.getFullYear(), 0, 1)), keyOf(new Date(d.getFullYear(), 11, 31))];
  return [k, k];
}
export function stepRange(view, k, n) {
  const d = dateOf(k);
  if (view === 'week') d.setDate(d.getDate() + 7 * n);
  else if (view === 'month') d.setMonth(d.getMonth() + n, 1);
  else if (view === 'year') d.setFullYear(d.getFullYear() + n, 0, 1);
  else d.setDate(d.getDate() + n);
  return keyOf(d);
}
let h24 = false;
export const setClock24 = (v) => { h24 = !!v; };
export const hm = (ts) => {
  const d = new Date(ts * 1000);
  if (h24) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?(AM|PM)/i, (m) => m.trim().toLowerCase());
};
export const longDate = (k) => dateOf(k).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
export const shortDate = (k) => dateOf(k).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const weekday = (k, len = 'short') => dateOf(k).toLocaleDateString([], { weekday: len });
export const toInputTime = (ts) => { const d = new Date(ts * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const fromInputTime = (k, v) => { const [h, m] = v.split(':').map(Number); const d = dateOf(k); d.setHours(h, m, 0, 0); return d.getTime() / 1000; };

// ---- vocabularies -------------------------------------------------------
export const CATS = ['code', 'communication', 'meetings', 'social', 'design', 'learning', 'docs', 'entertainment'];
const CAT_LABEL = { code: 'Code', communication: 'Communication', meetings: 'Meetings', social: 'Social', design: 'Design', learning: 'Learning',
  docs: 'Docs & Planning', entertainment: 'Entertainment', miscellaneous: 'Miscellaneous', idle: 'Idle' };
export const catLabel = (k) => CAT_LABEL[k] || (k ? k[0].toUpperCase() + k.slice(1) : 'Unknown');
export const catColor = (k) => (k === 'idle' ? 'var(--idle)' : CATS.includes(k) || k === 'miscellaneous' ? `var(--c-${k})` : 'var(--c-miscellaneous)');
export const SESSION = {
  focus: { label: 'Focus', color: 'var(--focus)', icon: 'target' },
  meeting: { label: 'Meeting', color: 'var(--meeting)', icon: 'video' },
  break: { label: 'Break', color: 'var(--break)', icon: 'coffee' },
};
export const ENTITY_COLORS = ['#6851ba', '#5982db', '#13a3b0', '#1f9a5e', '#7fa800', '#c08200', '#d9625a', '#e0457b', '#a177c0', '#7d7d86'];

// ---- layers -------------------------------------------------------------
let tipEl;
export function tip(e, html) {
  tipEl ??= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tooltip', role: 'tooltip' }));
  if (!html) { tipEl.style.display = 'none'; return; }
  tipEl.innerHTML = html;
  tipEl.style.display = 'block';
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = Math.min(e.clientX + 14, innerWidth - r.width - 8) + 'px';
  tipEl.style.top = Math.min(e.clientY + 16, innerHeight - r.height - 8) + 'px';
}

export function notice(text) {
  const el = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toastbar', textContent: text }));
  setTimeout(() => el.remove(), 2600);
}

export function modal({ title, body, actions = [], onMount, wide }) {
  const scrim = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'scrim' }));
  scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="width:min(720px,calc(100vw - 32px))"' : ''}>
    <div class="modal-head"><h2>${esc(title)}</h2><button class="btn ghost icon" data-x aria-label="Close">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>
    ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-a="${i}" ${a.style ? `style="${a.style}"` : ''}>${esc(a.label)}</button>`).join('')}</div>` : ''}
  </div>`;
  const el = scrim.firstElementChild;
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  el.querySelector('[data-x]').onclick = close;
  el.querySelectorAll('[data-a]').forEach((b) => { b.onclick = async () => { const r = await actions[b.dataset.a].onClick?.(el); if (r !== false) close(); }; });
  onMount?.(el, close);
  el.querySelector('input,select,textarea')?.focus();
  return close;
}

export const confirmBox = (title, text, label = 'Delete') => new Promise((res) => {
  modal({ title, body: `<p class="quiet" style="margin:0">${esc(text)}</p>`, actions: [
    { label: 'Cancel', onClick: () => res(false) }, { label, kind: 'danger', onClick: () => res(true) }] });
});

let popEl;
export function popover(anchorRect, html, onMount) {
  closePopover();
  popEl = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'popover' }));
  popEl.innerHTML = html;
  const r = popEl.getBoundingClientRect();
  let left = anchorRect.right + 10;
  if (left + r.width > innerWidth - 12) left = Math.max(12, anchorRect.left - r.width - 10);
  popEl.style.left = left + 'px';
  popEl.style.top = Math.max(12, Math.min(anchorRect.top, innerHeight - r.height - 12)) + 'px';
  onMount?.(popEl, closePopover);
  setTimeout(() => document.addEventListener('mousedown', outside), 0);
  return popEl;
}
function outside(e) { if (popEl && !popEl.contains(e.target)) closePopover(); }
export function closePopover() { popEl?.remove(); popEl = null; document.removeEventListener('mousedown', outside); }

let menuEl;
export function menu(anchor, items) {
  menuEl?.remove();
  const r = anchor.getBoundingClientRect();
  menuEl = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'popover menu' }));
  menuEl.innerHTML = items.map((it, i) => it === '-' ? '<div class="divider" style="margin:4px 0"></div>'
    : `<button class="menu-item" data-i="${i}">${it.icon ? icon(it.icon, 15) : ''}<span>${esc(it.label)}</span>${it.hint ? `<span class="silent">${esc(it.hint)}</span>` : ''}</button>`).join('');
  menuEl.style.top = r.bottom + 6 + 'px';
  menuEl.style.left = Math.min(r.left, innerWidth - menuEl.offsetWidth - 12) + 'px';
  const close = () => { menuEl?.remove(); menuEl = null; document.removeEventListener('mousedown', off); };
  const off = (e) => { if (!menuEl?.contains(e.target)) close(); };
  menuEl.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => { close(); items[b.dataset.i].onClick(); }; });
  setTimeout(() => document.addEventListener('mousedown', off), 0);
}

// ---- charts -------------------------------------------------------------
/** Donut: segments [{value, color, label}], hover via data-tip. */
export function donut(segs, size = 92, stroke = 14) {
  const total = segs.reduce((a, s) => a + s.value, 0);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  if (!total) return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--input)" stroke-width="${stroke}"/></svg>`;
  const gap = segs.filter((s) => s.value).length > 1 ? 3 : 0;
  let off = 0;
  const arcs = segs.filter((s) => s.value).map((s) => {
    const len = (s.value / total) * c;
    const a = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
      stroke-dasharray="${Math.max(0.5, len - gap)} ${c}" stroke-dashoffset="${-off}" data-tip="${esc(s.tip || '')}"/>`;
    off += len;
    return a;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)" role="img">${arcs}</svg>`;
}

/** Vertical bars with optional stacks and a target tick. days: [{label, stacks:[{value,color}], target, tip}]
 *  The SVG stretches to the card width; axis text is HTML so it never stretches with it. */
export function barChart(days, { height = 220, unit = 3600, showTarget = true } = {}) {
  const W = 1000, H = height - 22;
  const maxV = Math.max(unit, ...days.map((d) => Math.max(d.stacks.reduce((a, s) => a + s.value, 0), showTarget ? d.target || 0 : 0)));
  const step = Math.ceil(maxV / unit / 5) * unit; // whole units, at most 5 gridlines
  const top = Math.ceil(maxV / step) * step;
  const y = (v) => H - (v / top) * (H - 8);
  const bw = W / days.length, barW = Math.max(3, Math.min(48, bw * 0.5));
  let g = '', yl = '';
  for (let i = 0; i <= top / step; i++) {
    const v = step * i;
    g += `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" ${i ? 'stroke-dasharray="2 4"' : ''} vector-effect="non-scaling-stroke"/>`;
    yl += `<span style="top:${y(v)}px">${Math.round(v / 3600)}h</span>`;
  }
  const bars = days.map((d, i) => {
    const x = i * bw + (bw - barW) / 2;
    let acc = 0;
    const st = d.stacks.filter((s) => s.value > 0);
    const rects = st.map((s, j) => {
      const y0 = y(acc), y1 = y(acc + s.value);
      acc += s.value;
      const last = j === st.length - 1, rx = last ? Math.min(3, (y0 - y1) / 2) : 0;
      return last
        ? `<path d="M${x},${y0} V${y1 + rx} Q${x},${y1} ${x + rx},${y1} H${x + barW - rx} Q${x + barW},${y1} ${x + barW},${y1 + rx} V${y0} Z" fill="${s.color}"/>`
        : `<rect x="${x}" y="${y1}" width="${barW}" height="${Math.max(1, y0 - y1 - 2)}" fill="${s.color}"/>`;
    }).join('');
    const t = showTarget && d.target ? `<line x1="${x - 6}" x2="${x + barW + 6}" y1="${y(d.target)}" y2="${y(d.target)}" stroke="var(--text-silent)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : '';
    return `<g><rect x="${i * bw}" y="0" width="${bw}" height="${H}" fill="transparent" data-tip="${esc(d.tip || '')}"/>${rects}${t}</g>`;
  }).join('');
  const every = Math.ceil(days.length / 16);
  return `<div class="bchart"><div class="bchart-y" style="height:${H}px">${yl}</div><div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${g}${bars}</svg>
    <div class="bchart-x" style="grid-template-columns:repeat(${days.length},minmax(0,1fr))">${days.map((d, i) => `<span>${i % every ? '' : esc(d.label)}</span>`).join('')}</div></div></div>`;
}

/** Wire [data-tip] hover tooltips inside a container. */
export function tips(root) {
  root.addEventListener('mousemove', (e) => { const t = e.target.closest('[data-tip]'); tip(e, t?.dataset.tip || null); });
  root.addEventListener('mouseleave', (e) => tip(e, null));
}

export function emptyState(ic, title, text, action = '') {
  return `<div class="empty">${icon(ic, 22)}<h3>${esc(title)}</h3><div>${text}</div>${action}</div>`;
}

/** Entity <select> options. */
export const options = (list, sel, none = 'None') =>
  `<option value="">${esc(none)}</option>` + list.filter((x) => !x.archived || x.id === sel).map((x) => `<option value="${esc(x.id)}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
