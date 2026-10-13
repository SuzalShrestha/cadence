import { api, esc, icon, $, $$, today, addDays, rangeOf, stepRange, keyOf, tsOf, shortDate, weekday, short, hm, nowS, confirmBox, emptyState, notice } from '../lib.js';

let el, ctx, key = today(), filter = 'all', data = null, sugg = [], ents = {};
let entryModal; // shared with Home

export async function mount(root, c) {
  el = root; ctx = c;
  ({ entryModal } = await import('./home.js'));
  await load();
}
export const refresh = () => load();

async function load() {
  const [a, b] = rangeOf('week', key);
  const [projects, clients, tasks, range, day] = await Promise.all([api('list', 'projects'), api('list', 'clients'), api('list', 'tasks'), api('range', a, b), api('day', today())]);
  ents = { projects, clients, tasks };
  data = range; data.from = a; data.to = b;
  sugg = key <= today() && today() <= b && a <= today() ? day.suggestions : [];
  draw();
}

const find = (k, id) => ents[k].find((x) => x.id === id);
function resolve(e) {
  const task = find('tasks', e.taskId), project = find('projects', e.projectId || task?.projectId), client = find('clients', e.clientId || project?.clientId);
  return { task, project, client, rate: project?.rate ?? client?.rate ?? 0 };
}

function draw() {
  const list = data.entries.filter((e) => filter === 'all' || (filter === 'billable' ? e.billable : !e.billable)).sort((x, y) => y.start - x.start);
  const days = new Map();
  for (const e of list) { const k = keyOf(new Date(e.start * 1000)); (days.get(k) || days.set(k, []).get(k)).push(e); }
  const total = list.reduce((a, e) => a + e.stop - e.start, 0);
  const bill = list.filter((e) => e.billable).reduce((a, e) => a + e.stop - e.start, 0);
  const amount = list.filter((e) => e.billable).reduce((a, e) => a + ((e.stop - e.start) / 3600) * resolve(e).rate, 0);
  el.innerHTML = `
    <header class="bar"><div class="title">Time Entries</div><span class="silent">${esc(shortDate(data.from))} – ${esc(shortDate(data.to))}</span><div class="grow"></div>
      <div class="seg" role="group">${['all', 'billable', 'nonbillable'].map((f) => `<button data-f="${f}" aria-pressed="${f === filter}">${{ all: 'All', billable: 'Billable', nonbillable: 'Non-billable' }[f]}</button>`).join('')}</div>
      <div class="seg"><button data-step="-1" aria-label="Previous week">${icon('chevron-left')}</button><button data-today title="This week">${icon('calendar-days')}</button><button data-step="1" aria-label="Next week">${icon('chevron-right')}</button></div>
      <button class="btn accent sm" id="add">${icon('plus', 14)}Add entry</button></header>
    <div class="page"><div style="max-width:1080px;margin:0 auto;display:grid;gap:16px">
      <div class="grid3">
        <div class="card kpi"><div class="label">Tracked</div><div class="big">${short(total)}</div><div class="sub">${list.length} entries</div></div>
        <div class="card kpi"><div class="label">Billable</div><div class="big">${short(bill)}</div><div class="sub">${total ? Math.round((bill / total) * 100) : 0}% of tracked</div></div>
        <div class="card kpi"><div class="label">Amount</div><div class="big">${amount.toFixed(2)}</div><div class="sub">From project and client rates</div></div>
      </div>
      ${sugg.length ? `<div class="card"><div class="card-head"><div class="row"><span style="color:var(--accent)">${icon('zap', 15)}</span><span class="label">Suggested for today</span></div>
          <button class="btn sm" id="acceptAll">${icon('check', 14)}Accept all</button></div>
        ${sugg.map((s) => { const r = resolve(s); return `<div class="list-row" style="grid-template-columns:12px 1fr 120px 70px auto;padding:8px 0">
          <span class="swatch" style="background:${r.project?.color || r.client?.color || 'var(--violet)'}"></span>
          <div class="ellipsis"><span style="color:var(--text-strong)">${esc(r.project?.name || r.task?.name || r.client?.name)}</span> <span class="silent">· ${s.confidence}% match</span></div>
          <span class="tnum quiet">${hm(s.start)} – ${hm(s.stop)}</span><span class="tnum" style="text-align:right">${short(s.stop - s.start)}</span>
          <div class="row" style="gap:4px"><button class="btn ghost sm" data-dis="${esc(s.id)}">Dismiss</button><button class="btn sm" data-acc="${esc(s.id)}">${icon('check', 14)}Accept</button></div></div>`; }).join('')}</div>` : ''}
      ${days.size ? [...days].map(([k, es]) => `
        <div><div class="row" style="justify-content:space-between;padding:0 4px 8px"><span class="label">${esc(weekday(k, 'long'))}, ${esc(shortDate(k))}</span><span class="silent tnum">${short(es.reduce((a, e) => a + e.stop - e.start, 0))}</span></div>
          <div class="card flush">${es.map(row).join('')}</div></div>`).join('')
      : `<div class="card">${emptyState('list', 'No time entries this week', 'Add an entry, drag on the Home calendar, or accept a suggestion. Suggestions come from project, client and task keywords.')}</div>`}
    </div></div>`;
  wire(list);
}

function row(e) {
  const r = resolve(e);
  const name = e.description || r.task?.name || r.project?.name || 'No description';
  const sub = [r.project?.name, r.task?.name].filter((x) => x && x !== name).map(esc).join(' · ') || (r.project ? '' : 'No project');
  return `<div class="list-row" data-id="${e.id}" style="grid-template-columns:4px minmax(0,1.6fr) minmax(0,1fr) 120px 28px 70px 64px;cursor:pointer">
    <span style="align-self:stretch;border-radius:4px;background:${r.project?.color || r.client?.color || 'var(--border-strong)'}"></span>
    <div class="ellipsis"><div style="color:var(--text-strong)" class="ellipsis">${esc(name)}</div>
      ${sub ? `<div class="silent ellipsis" style="font-size:11.5px">${sub}</div>` : ''}</div>
    <span class="quiet row ellipsis" style="gap:6px">${r.client ? `${icon('building-2', 13)}<span class="ellipsis">${esc(r.client.name)}</span>` : '<span class="silent">—</span>'}</span>
    <span class="tnum quiet">${hm(e.start)} – ${hm(e.stop)}</span>
    <button class="btn ghost icon sm" data-bill="${e.id}" title="${e.billable ? 'Billable' : 'Not billable'}" aria-label="Toggle billable" style="color:${e.billable ? 'var(--accent)' : 'var(--text-silent)'}">${icon('briefcase', 14)}</button>
    <span class="tnum" style="text-align:right;color:var(--text-strong)">${short(e.stop - e.start)}</span>
    <button class="btn ghost icon sm" data-del="${e.id}" aria-label="Delete">${icon('trash-2', 14)}</button></div>`;
}

function wire(list) {
  $$('[data-f]', el).forEach((b) => b.onclick = () => { filter = b.dataset.f; draw(); });
  $$('[data-step]', el).forEach((b) => b.onclick = () => { key = stepRange('week', key, Number(b.dataset.step)); load(); });
  $('[data-today]', el).onclick = () => { key = today(); load(); };
  $('#add', el).onclick = () => { const t = Math.min(nowS(), tsOf(key) + 17 * 3600); entryModal({ start: t - 3600, stop: t }, ents); };
  $$('[data-id]', el).forEach((r) => r.onclick = (ev) => { if (ev.target.closest('button')) return; entryModal(list.find((e) => e.id === r.dataset.id), ents); });
  $$('[data-bill]', el).forEach((b) => b.onclick = () => { const e = list.find((x) => x.id === b.dataset.bill); api('save', 'entries', { id: e.id, billable: !e.billable }); });
  $$('[data-del]', el).forEach((b) => b.onclick = async () => { if (await confirmBox('Delete time entry?', 'Tracked activity stays. Only the entry goes.')) api('remove', 'entries', b.dataset.del); });
  const strip = ({ start, stop, projectId, clientId, taskId }) => ({ start, stop, projectId, clientId, taskId });
  $$('[data-acc]', el).forEach((b) => b.onclick = () => api('acceptSuggestion', strip(sugg.find((s) => s.id === b.dataset.acc))));
  $$('[data-dis]', el).forEach((b) => b.onclick = () => api('dismissSuggestion', b.dataset.dis));
  $('#acceptAll', el)?.addEventListener('click', async () => { for (const s of sugg) await api('acceptSuggestion', strip(s)); notice(`${sugg.length} entries added`); });
}
void addDays;
