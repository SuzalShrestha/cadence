// Full-screen blocker and break windows. Button text follows Rize's docs.
import { api, esc, icon, $, $$, clock, nowS, catLabel } from './lib.js';

const o = $('#o');
const act = (a) => api('overlay', a);
let st;

async function load() {
  st = await api('state');
  const info = st.overlay;
  if (!info) return;
  if (info.mode === 'break') breakView(); else blockView(info);
}

function blockView(info) {
  const s = st.session;
  const what = s ? `${s.type === 'focus' ? 'a focus session' : s.type === 'meeting' ? 'a meeting' : 'a break'}` : 'work time';
  o.innerHTML = `
    <span style="color:var(--accent-bright)">${icon('shield', 34)}</span>
    <h1>Getting distracted?</h1>
    <div class="lead"><b style="color:#f2f2f4">${esc(info.rule?.name || 'This app')}</b> (${esc(catLabel(info.rule?.category))}) is blocked during ${what}.${s ? ` <span class="tnum" data-left>${clock(s.stop - nowS())}</span> left.` : ''}</div>
    ${info.urgeSurfing ? '<div class="breath" id="breath">10</div><div class="silent" id="urge">Breathe in… and out. The choices unlock in a moment.</div>' : ''}
    <div class="actions" id="acts">
      <button class="btn accent lg" data-a="thanks">Thanks for the reminder!</button>
      <button class="btn lg" data-a="notDistraction">This is not a distraction.</button>
      ${s ? `<button class="btn lg" data-a="end">End this ${s.type} session now</button>` : ''}
    </div>
    <div class="links" id="links">
      ${s ? '<button data-a="disableForSession">Disable blocker for this session</button>' : ''}
      <button data-a="snooze">Snooze for ${Math.round(st.settings.defaultSnoozeTime / 60)} min</button>
      <button data-a="settings">Update blocker settings</button>
    </div>`;
  wire();
  if (info.urgeSurfing) lock(10);
}

function lock(n) {
  const parts = [$('#acts'), $('#links')];
  parts.forEach((p) => p.setAttribute('disabled', ''));
  const b = $('#breath');
  const t = setInterval(() => {
    n -= 1;
    b.textContent = String(Math.max(0, n));
    if (n <= 0) { clearInterval(t); parts.forEach((p) => p.removeAttribute('disabled')); $('#urge').textContent = 'Ready. What would you like to do?'; }
  }, 1000);
}

function breakView() {
  const s = st.session;
  o.innerHTML = `
    <span style="color:var(--break)">${icon('coffee', 34)}</span>
    <h1>Take Your Break!</h1>
    <div class="big-clock" data-left>${s ? clock(s.stop - nowS()) : '0:00'}</div>
    <div class="lead">Step away from the screen. Stretch, drink some water, look at something far away.</div>
    <div class="actions" style="grid-template-columns:1fr 1fr">
      <button class="btn lg" data-a="extend">${icon('plus', 15)}Extend by 5 min</button>
      <button class="btn accent lg" data-a="end">End Break</button>
    </div>
    <div class="links"><button data-a="close">Close Break Screen</button><button data-a="disableBreakScreen">Turn off this setting</button></div>`;
  wire();
}

function wire() { $$('[data-a]', o).forEach((b) => b.onclick = () => act(b.dataset.a)); }

setInterval(() => { const l = $('[data-left]'); if (l && st?.session) l.textContent = clock(st.session.stop - nowS()); }, 1000);
window.cadence.on('changed', async () => { st = await api('state'); });
load();
