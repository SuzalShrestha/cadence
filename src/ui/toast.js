// Toaster (Rize "Toaster"): focus score + rating after a focus session, or the day summary when the target is reached.
import { api, esc, icon, $, $$, durText, short, pct, hm, catColor, catLabel } from './lib.js';

const t = $('#t');
const label = (s) => (s == null ? 'No Focus Score' : s >= 80 ? 'Very Focused' : s >= 60 ? 'Focused' : s >= 40 ? 'Somewhat Focused' : 'Not Focused');
let timer, hover = false;
const arm = () => { clearTimeout(timer); timer = setTimeout(() => { if (!hover) api('closeToast'); else arm(); }, 20000); };

async function load() {
  const st = await api('state');
  const info = st.toast;
  if (!info) return api('closeToast');
  const close = `<button class="btn ghost icon sm" data-x aria-label="Close">${icon('x', 14)}</button>`;
  if (info.kind === 'session') {
    const s = (await api('list', 'sessions')).find((x) => x.id === info.id);
    if (!s) return api('closeToast');
    t.innerHTML = `
      <div class="row"><span class="dot round" style="background:var(--focus)"></span><span class="label">Focus session complete</span><div class="grow"></div>${close}</div>
      <div class="row" style="align-items:flex-end;justify-content:space-between">
        <div><div class="silent" style="font-size:11.5px;margin-bottom:4px">Focus Score</div><div class="score">${s.score ?? '—'}</div></div>
        <div style="text-align:right"><div style="color:var(--text-strong);font-weight:700">${label(s.score)}</div><div class="silent tnum" style="font-size:12px">${durText(s.stop - s.start)} · ${hm(s.start)} – ${hm(s.stop)}</div></div></div>
      <div><div class="silent" style="font-size:11.5px;margin-bottom:6px">How focused did you feel?</div>
        <div class="rate">${[1, 2, 3, 4, 5].map((n) => `<button data-r="${n}" aria-pressed="${s.rating === n}">${n}</button>`).join('')}</div></div>`;
    $$('[data-r]', t).forEach((b) => b.onclick = async () => { await api('rateSession', s.id, Number(b.dataset.r)); b.closest('.rate').outerHTML = '<div class="silent">Thanks. Your rating is saved.</div>'; setTimeout(() => api('closeToast'), 1600); });
  } else {
    const d = await api('day', info.key);
    const s = d.summary;
    t.innerHTML = `
      <div class="row"><span style="color:var(--accent)">${icon('target', 15)}</span><span class="label">Work hours target reached</span><div class="grow"></div>${close}</div>
      <div class="grid2"><div><div class="silent" style="font-size:11.5px">Work Hours</div><div class="mid">${short(s.active)}</div></div>
        <div><div class="silent" style="font-size:11.5px">Percent of Target</div><div class="mid">${pct(s.active, s.target)}%</div></div></div>
      <div><div class="silent" style="font-size:11.5px;margin-bottom:6px">Top Categories</div>
        ${s.categories.slice(0, 3).map((c) => `<div class="legend-row"><span class="dot" style="background:${catColor(c.name)}"></span><span>${esc(catLabel(c.name))}</span><span class="quiet tnum">${short(c.secs)}</span></div>`).join('')}</div>`;
  }
  $('[data-x]', t).onclick = () => api('closeToast');
  arm();
}
t.addEventListener('mouseenter', () => { hover = true; });
t.addEventListener('mouseleave', () => { hover = false; });
load();
