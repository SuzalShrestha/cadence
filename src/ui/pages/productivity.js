import { api, esc, icon, $, $$, today, rangeOf, stepRange, shortDate, weekday, dateOf, short, durText, dur, pct, delta, catColor, catLabel, barChart, tips, SESSION } from '../lib.js';

let el, view = 'week', key = today(), data = null, prev = null;

export async function mount(root) { el = root; await load(); }
export const refresh = () => load();

async function load() {
  const [a, b] = rangeOf(view, key), [pa, pb] = rangeOf(view, stepRange(view, key, -1));
  [data, prev] = await Promise.all([api('range', a, b), api('range', pa, pb)]);
  data.from = a; data.to = b;
  draw();
}

const sum = (days, k) => days.reduce((a, d) => a + (typeof k === 'function' ? k(d) : d[k]), 0);
const avgScore = (days) => { const s = days.map((d) => d.focusScore).filter((x) => x != null); return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null; };

function draw() {
  // A running period is compared with the same number of days of the previous one.
  const d = data.days, elapsed = d.filter((x) => x.key <= today()).length, p = prev.days.slice(0, elapsed || prev.days.length);
  const active = sum(d, 'active'), focus = sum(d, 'focus'), meet = sum(d, 'meeting'), brk = sum(d, 'break');
  const nFocus = sum(d, (x) => x.counts.focus), nMeet = sum(d, (x) => x.counts.meeting), nBreak = sum(d, (x) => x.counts.break);
  const score = avgScore(d), pScore = avgScore(p);
  const label = view === 'week' ? `${shortDate(data.from)} – ${shortDate(data.to)}` : view === 'month' ? dateOf(data.from).toLocaleDateString([], { month: 'long', year: 'numeric' }) : String(dateOf(data.from).getFullYear());
  const per = view === 'week' ? 'last week' : view === 'month' ? 'last month' : 'last year';
  const series = view === 'year' ? byMonth(d) : d.map((x) => ({ ...x, label: view === 'week' ? weekday(x.key) : String(dateOf(x.key).getDate()), name: `${weekday(x.key, 'long')}, ${shortDate(x.key)}` }));
  el.innerHTML = `
    <header class="bar"><div class="title">Productivity</div><span class="silent">${esc(label)}</span><div class="grow"></div>
      <div class="seg" role="group">${['week', 'month', 'year'].map((v) => `<button data-view="${v}" aria-pressed="${v === view}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
      <div class="seg"><button data-step="-1" aria-label="Previous">${icon('chevron-left')}</button><button data-today title="Now">${icon('calendar-days')}</button><button data-step="1" aria-label="Next">${icon('chevron-right')}</button></div></header>
    <div class="page"><div style="max-width:1120px;margin:0 auto;display:grid;gap:16px">
      <div class="grid4">
        ${kpi('Work hours', dur(active), delta(active, sum(p, 'active'), `vs ${per}`), `${pct(active, sum(d, 'target'))}% of ${durText(sum(d, 'target'))} target`)}
        ${kpi('Focus time', dur(focus), delta(focus, sum(p, 'focus'), `vs ${per}`), `${nFocus} sessions · avg ${nFocus ? short(focus / nFocus) : '0m'}`)}
        ${kpi('Focus score', score == null ? '—' : `${score}`, score != null && pScore != null ? delta(score, pScore, `vs ${per}`) : '', score == null ? 'No focus sessions yet' : scoreLabel(score))}
        ${kpi('Meetings', dur(meet), delta(meet, sum(p, 'meeting'), `vs ${per}`), `${nMeet} meetings · ${pct(meet, active)}% of work`)}
      </div>
      <div class="card"><div class="card-head"><span class="label">Focus, meetings and breaks</span>
        <div class="row" style="gap:14px;font-size:12px">${[['Focus', 'var(--focus)'], ['Meetings', 'var(--meeting)'], ['Breaks', 'var(--break)']].map(([n, c]) => `<span class="row" style="gap:6px"><span class="dot" style="background:${c}"></span>${n}</span>`).join('')}</div></div>
        ${barChart(series.map((x) => ({ label: x.label, stacks: [{ value: x.focus, color: 'var(--focus)' }, { value: x.meeting, color: 'var(--meeting)' }, { value: x.break, color: 'var(--break)' }],
          tip: `<b>${esc(x.name)}</b>Focus ${durText(x.focus)}<br>Meetings ${durText(x.meeting)}<br>Breaks ${durText(x.break)}` })), { height: 210, showTarget: false, unit: view === 'year' ? 36000 : 3600 })}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card"><div class="card-head"><span class="label">Session totals</span></div>
          ${[['focus', focus, nFocus], ['meeting', meet, nMeet], ['break', brk, nBreak]].map(([t, secs, n]) => `<div class="setting" style="padding:12px 0">
            <div class="row" style="gap:12px"><span class="chip" style="width:32px;justify-content:center;color:${SESSION[t].color}">${icon(SESSION[t].icon, 15)}</span><div><div class="t">${SESSION[t].label}</div><div class="d">${n} session${n === 1 ? '' : 's'}${n ? ` · avg ${short(secs / n)}` : ''}</div></div></div>
            <span class="mid tnum">${short(secs)}</span></div>`).join('')}
        </div>
        <div class="card"><div class="card-head"><span class="label">Time by label</span><span class="silent" style="font-size:12px">${short(active)} active</span></div>
          ${data.categories.length ? data.categories.slice(0, 9).map((c) => `<div class="legend-row" style="grid-template-columns:10px 120px 1fr 56px"><span class="dot" style="background:${catColor(c.name)}"></span><span class="ellipsis">${esc(catLabel(c.name))}</span>
            <div class="meter" style="height:5px"><i style="width:${pct(c.secs, data.categories[0].secs)}%;background:${catColor(c.name)}"></i></div><span class="quiet tnum" style="text-align:right">${short(c.secs)}</span></div>`).join('')
          : '<div class="silent">No activity in this range.</div>'}
        </div>
      </div>
      <div class="card"><div class="card-head"><span class="label">Work hours vs target</span></div>
        ${barChart(series.map((x) => ({ label: x.label, target: view === 'year' ? 0 : x.target, stacks: [{ value: x.active, color: x.target && x.active >= x.target ? 'var(--accent)' : 'var(--violet)' }],
          tip: `<b>${esc(x.name)}</b>Work hours ${durText(x.active)}${x.target ? `<br>${pct(x.active, x.target)}% of ${durText(x.target)}` : ''}` })), { height: 180, showTarget: view !== 'year', unit: view === 'year' ? 36000 : 3600 })}
      </div>
    </div></div>`;
  tips(el);
  $$('[data-view]', el).forEach((b) => b.onclick = () => { view = b.dataset.view; load(); });
  $$('[data-step]', el).forEach((b) => b.onclick = () => { key = stepRange(view, key, Number(b.dataset.step)); load(); });
  $('[data-today]', el).onclick = () => { key = today(); load(); };
}

const scoreLabel = (s) => (s >= 80 ? 'Very Focused' : s >= 60 ? 'Focused' : s >= 40 ? 'Somewhat Focused' : 'Not Focused');
const kpi = (label, value, change, sub) => `<div class="card kpi"><div class="label">${label}</div><div class="big">${value}</div><div style="margin-top:4px">${change || ''}</div><div class="sub">${esc(sub)}</div></div>`;

function byMonth(days) {
  const m = Array.from({ length: 12 }, (_, i) => ({ label: new Date(2000, i, 1).toLocaleDateString([], { month: 'short' }), name: new Date(2000, i, 1).toLocaleDateString([], { month: 'long' }), active: 0, focus: 0, meeting: 0, break: 0, target: 0 }));
  for (const d of days) { const x = m[dateOf(d.key).getMonth()]; for (const k of ['active', 'focus', 'meeting', 'break', 'target']) x[k] += d[k]; }
  return m;
}
