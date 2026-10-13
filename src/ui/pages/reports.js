import { api, esc, icon, $, $$, today, addDays, rangeOf, shortDate, weekday, dateOf, short, durText, pct, catColor, catLabel, barChart, donut, tips, emptyState, notice } from '../lib.js';

const PRESETS = [
  ['this-week', 'This week', () => rangeOf('week', today())],
  ['last-week', 'Last week', () => rangeOf('week', addDays(today(), -7))],
  ['this-month', 'This month', () => rangeOf('month', today())],
  ['last-30', 'Last 30 days', () => [addDays(today(), -29), today()]],
  ['this-year', 'This year', () => rangeOf('year', today())],
];
const GROUPS = [['project', 'Projects'], ['client', 'Clients'], ['task', 'Tasks'], ['category', 'Labels'], ['app', 'Apps']];
let el, preset = 'this-week', from, to, groupBy = 'project', data = null;

export async function mount(root) { el = root; [from, to] = PRESETS[0][2](); await load(); }
export const refresh = () => load();

async function load() { data = await api('report', { from, to, groupBy }); draw(); }

const nameOf = (r) => (groupBy === 'category' ? catLabel(r.name) : r.name);
const colorOf = (r, i) => (groupBy === 'category' ? catColor(r.name) : r.color || ['var(--c-code)', 'var(--c-communication)', 'var(--c-meetings)', 'var(--c-social)', 'var(--c-design)', 'var(--c-learning)', 'var(--c-docs)', 'var(--c-entertainment)'][i % 8]);

function draw() {
  const rows = data.rows, total = rows.reduce((a, r) => a + r.secs, 0);
  const money = ['project', 'client', 'task'].includes(groupBy);
  const bill = rows.reduce((a, r) => a + r.billable, 0), amount = rows.reduce((a, r) => a + r.amount, 0);
  const long = data.daily.length > 62;
  let daily = data.daily;
  if (long) { // fold a year into months
    const m = new Map();
    for (const d of daily) { const k = d.key.slice(0, 7); m.set(k, (m.get(k) || 0) + d.secs); }
    daily = [...m].map(([k, secs]) => ({ key: `${k}-01`, secs, month: true }));
  }
  el.innerHTML = `
    <header class="bar"><div class="title">Reports</div><div class="grow"></div>
      <select class="input" id="preset" style="width:auto;height:30px">${PRESETS.map(([k, l]) => `<option value="${k}" ${k === preset ? 'selected' : ''}>${l}</option>`).join('')}<option value="custom" ${preset === 'custom' ? 'selected' : ''}>Custom range</option></select>
      <input class="input" type="date" id="from" value="${from}" style="width:auto;height:30px"><span class="silent">–</span><input class="input" type="date" id="to" value="${to}" style="width:auto;height:30px">
      <button class="btn sm" id="csv">${icon('download', 14)}Export CSV</button></header>
    <div class="page"><div style="max-width:1120px;margin:0 auto;display:grid;gap:16px">
      <div class="row" style="justify-content:space-between"><div class="seg" role="group" aria-label="Group by">${GROUPS.map(([k, l]) => `<button data-g="${k}" aria-pressed="${k === groupBy}">${l}</button>`).join('')}</div>
        <span class="silent">${esc(shortDate(from))} – ${esc(shortDate(to))}, ${dateOf(to).getFullYear()}</span></div>
      <div class="grid${money ? 4 : 2}">
        <div class="card kpi"><div class="label">${money ? 'Tracked time' : 'Active time'}</div><div class="big">${short(total)}</div><div class="sub">${data.daily.filter((d) => d.secs > 0).length} active days</div></div>
        <div class="card kpi"><div class="label">Daily average</div><div class="big">${short(total / Math.max(1, data.daily.filter((d) => d.secs > 0).length))}</div><div class="sub">On days with time</div></div>
        ${money ? `<div class="card kpi"><div class="label">Billable</div><div class="big">${short(bill)}</div><div class="sub">${pct(bill, total)}% of tracked</div></div>
        <div class="card kpi"><div class="label">Amount</div><div class="big">${amount.toFixed(2)}</div><div class="sub">Billable hours × rate</div></div>` : ''}
      </div>
      <div class="card"><div class="card-head"><span class="label">${money ? 'Tracked' : 'Active'} time by ${long ? 'month' : 'day'}</span></div>
        ${barChart(daily.map((d) => ({ label: d.month ? dateOf(d.key).toLocaleDateString([], { month: 'short' }) : daily.length <= 7 ? weekday(d.key) : String(dateOf(d.key).getDate()),
          stacks: [{ value: d.secs, color: 'var(--violet)' }], tip: `<b>${d.month ? dateOf(d.key).toLocaleDateString([], { month: 'long', year: 'numeric' }) : `${weekday(d.key, 'long')}, ${shortDate(d.key)}`}</b>${durText(d.secs)}` })), { height: 200, showTarget: false, unit: long ? 36000 : 3600 })}
      </div>
      ${rows.length ? `<div style="display:grid;grid-template-columns:260px 1fr;gap:16px;align-items:start">
        <div class="card" style="display:grid;justify-items:center;gap:12px;padding:20px">${donut(rows.slice(0, 8).map((r, i) => ({ value: r.secs, color: colorOf(r, i), tip: `<b>${esc(nameOf(r))}</b>${durText(r.secs)} · ${pct(r.secs, total)}%` })), 180, 22)}
          <div class="silent" style="font-size:12px">Top ${Math.min(8, rows.length)} of ${rows.length}</div></div>
        <div class="card flush"><table class="table"><thead><tr><th>${esc(GROUPS.find((g) => g[0] === groupBy)[1].replace(/s$/, ''))}</th><th class="r">Time</th><th class="r">Share</th>${money ? '<th class="r">Billable</th><th class="r">Amount</th>' : ''}</tr></thead><tbody>
          ${rows.map((r, i) => `<tr><td><span class="row" style="gap:8px"><span class="swatch" style="background:${colorOf(r, i)}"></span><span class="ellipsis">${esc(nameOf(r))}</span></span></td>
            <td class="r tnum" style="color:var(--text-strong)">${short(r.secs)}</td><td class="r tnum quiet">${pct(r.secs, total)}%</td>
            ${money ? `<td class="r tnum quiet">${short(r.billable)}</td><td class="r tnum">${r.amount.toFixed(2)}</td>` : ''}</tr>`).join('')}
        </tbody></table></div></div>`
      : `<div class="card">${emptyState('chart-column', 'Nothing to report', money ? 'No time entries in this range. Accept suggestions or add entries to see them here.' : 'No activity in this range.')}</div>`}
    </div></div>`;
  tips(el);
  $('#preset', el).onchange = (e) => { preset = e.target.value; const p = PRESETS.find((x) => x[0] === preset); if (p) { [from, to] = p[2](); load(); } };
  for (const id of ['from', 'to']) $(`#${id}`, el).onchange = () => {
    const a = $('#from', el).value, b = $('#to', el).value;
    if (!a || !b || a > b) return notice('Pick a start date before the end date');
    from = a; to = b; preset = 'custom'; load();
  };
  $$('[data-g]', el).forEach((b) => b.onclick = () => { groupBy = b.dataset.g; load(); });
  $('#csv', el).onclick = async () => { const r = await api('exportCsv', { from, to }); if (r) notice(`Saved ${r.rows} entries`); };
}
