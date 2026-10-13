import { api, clock, nowS, short, pct, SESSION } from './lib.js';

const w = document.getElementById('w');
let st = null;

async function load() { st = await api('state'); draw(); }

function draw() {
  if (!st) return;
  const s = st.session;
  const color = s ? SESSION[s.type].color : st.settings.trackingEnabled ? 'var(--positive)' : '#75747c';
  const k = s ? `${SESSION[s.type].label} left` : st.settings.trackingEnabled ? 'Since break' : 'Paused';
  const v = s ? clock(s.stop - nowS()) : clock(nowS() - st.lastBreakEnd);
  // textContent only: nothing here is user text, but keep the widget free of HTML sinks.
  w.replaceChildren();
  const bar = el('span', 'bar4'); bar.style.background = color;
  const mid = el('div'); mid.append(el('div', 'k', k), el('div', 'v', v));
  const side = el('div', 'side');
  const a = el('div'); a.append(el('b', '', short(st.todayActive)), ' today');
  const b = el('div', '', st.target ? `${pct(st.todayActive, st.target)}% of target` : 'No target today');
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
