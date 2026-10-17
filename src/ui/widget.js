import { api, clock, nowS, short, pct, SESSION } from './lib.js';

const w = document.getElementById('w');
let st = null;

async function load() { st = await api('state'); draw(); }

function draw() {
  if (!st) return;
  const s = st.session;
  const color = s ? SESSION[s.type].color : st.settings.trackingEnabled ? 'var(--positive)' : '#75747c';
  const coach = st.settings.productivityMode;
  const k = s ? `${SESSION[s.type].label} left` : !st.settings.trackingEnabled ? 'Paused' : coach ? 'Since break' : 'Tracked today';
  const v = s ? clock(s.stop - nowS()) : coach ? clock(nowS() - st.lastBreakEnd) : short(st.todayActive);
  // textContent only: nothing here is user text, but keep the widget free of HTML sinks.
  w.replaceChildren();
  const bar = el('span', 'bar4'); bar.style.background = color;
  const mid = el('div'); mid.append(el('div', 'k', k), el('div', 'v', v));
  const side = el('div', 'side');
  const a = el('div');
  if (coach || s) a.append(el('b', '', short(st.todayActive)), ' today');
  else a.append(el('b', '', st.current?.app?.name || '—'));
  const b = el('div', '', coach ? (st.target ? `${pct(st.todayActive, st.target)}% of target` : 'No target today') : (st.current?.rule?.name !== st.current?.app?.name && st.current?.rule?.name || ''));
  side.append(a, b);
  w.append(bar, mid, side);
}
const el = (tag, cls = '', text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

w.addEventListener('mouseenter', () => { if (st?.settings.widgetAutoHide) w.classList.add('fade'); });
w.addEventListener('mouseleave', () => w.classList.remove('fade'));
w.addEventListener('contextmenu', (e) => { e.preventDefault(); api('menu', 'widget'); });
w.addEventListener('dblclick', () => api('showDashboard'));
window.cadence.on('changed', load);
setInterval(draw, 1000);
load();
