// Projects, Clients and Tasks share one page: a table, a detail column and a CRUD modal.
import { api, esc, icon, $, $$, today, addDays, short, pct, ENTITY_COLORS, modal, confirmBox, options, emptyState, notice } from '../lib.js';

const META = {
  projects: { one: 'project', title: 'Projects', icon: 'box', hint: 'Group time entries by project. Keywords match window titles and URLs to suggest entries.' },
  clients: { one: 'client', title: 'Clients', icon: 'building-2', hint: 'Clients own projects. Their rate applies when a project has none.' },
  tasks: { one: 'task', title: 'Tasks', icon: 'square-check-big', hint: 'Tasks belong to a project. Mark them done to hide them from pickers.' },
};
let el, kind, lists = {}, totals = new Map(), showArchived = false, q = '';

export async function mount(root, ctx) { el = root; kind = ctx.kind; await load(); }
export const refresh = () => load();

async function load() {
  const [projects, clients, tasks, range] = await Promise.all([api('list', 'projects'), api('list', 'clients'), api('list', 'tasks'), api('range', addDays(today(), -29), today())]);
  lists = { projects, clients, tasks };
  // Last 30 days of tracked time per entity.
  totals = new Map();
  const add = (id, s) => id && totals.set(id, (totals.get(id) || 0) + s);
  for (const e of range.entries) {
    const s = e.stop - e.start, t = tasks.find((x) => x.id === e.taskId), pid = e.projectId || t?.projectId;
    const p = projects.find((x) => x.id === pid);
    add(e.taskId, s); add(pid, s); add(e.clientId || p?.clientId, s);
  }
  draw();
}

const by = (k, id) => lists[k].find((x) => x.id === id);

function draw() {
  const m = META[kind];
  const all = lists[kind];
  const rows = all.filter((x) => (showArchived || !(x.archived || x.done)) && (!q || x.name.toLowerCase().includes(q))).sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0) || a.name.localeCompare(b.name));
  const hidden = all.filter((x) => x.archived || x.done).length;
  el.innerHTML = `
    <header class="bar"><div class="title">${m.title}</div><span class="silent">${all.length - hidden} active</span><div class="grow"></div>
      <button class="btn accent sm" id="new">${icon('plus', 14)}New ${m.one}</button></header>
    <div class="page"><div style="max-width:1080px;margin:0 auto">
      <div class="toolbar"><label class="input" style="display:flex;align-items:center;gap:8px;width:280px">${icon('search', 15)}<input id="q" placeholder="Search ${m.title.toLowerCase()}" value="${esc(q)}" style="border:0;background:none;outline:0;color:inherit;flex:1;font:inherit"></label>
        <div class="grow"></div>${hidden ? `<label class="row" style="gap:8px"><span class="quiet">Show ${kind === 'tasks' ? 'done' : 'archived'} (${hidden})</span><span class="switch"><input type="checkbox" id="arch" ${showArchived ? 'checked' : ''}><i></i></span></label>` : ''}</div>
      ${rows.length ? `<div class="card flush"><table class="table"><thead><tr>${head()}</tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>`
        : `<div class="card">${emptyState(m.icon, q ? 'No matches' : `No ${m.title.toLowerCase()} yet`, esc(m.hint), q ? '' : `<button class="btn accent" id="new2" style="margin-top:8px">${icon('plus', 14)}New ${m.one}</button>`)}</div>`}
    </div></div>`;
  $('#new', el).onclick = () => edit({});
  $('#new2', el)?.addEventListener('click', () => edit({}));
  $('#arch', el)?.addEventListener('change', (e) => { showArchived = e.target.checked; draw(); });
  const qi = $('#q', el);
  qi.oninput = () => { q = qi.value.trim().toLowerCase(); const p = qi.selectionStart; draw(); const n = $('#q', el); n.focus(); n.setSelectionRange(p, p); };
  $$('[data-id]', el).forEach((r) => r.onclick = (ev) => { if (ev.target.closest('button,input')) return; edit(all.find((x) => x.id === r.dataset.id)); });
  $$('[data-done]', el).forEach((c) => c.onchange = () => api('save', 'tasks', { id: c.dataset.done, done: c.checked }));
}

function head() {
  if (kind === 'projects') return '<th>Project</th><th>Client</th><th class="r">Rate</th><th>Budget</th><th class="r">Last 30 days</th>';
  if (kind === 'clients') return '<th>Client</th><th class="r">Projects</th><th class="r">Rate</th><th class="r">Last 30 days</th>';
  return '<th style="width:36px"></th><th>Task</th><th>Project</th><th>Keywords</th><th class="r">Last 30 days</th>';
}

function row(x) {
  const t = totals.get(x.id) || 0;
  const dim = x.archived || x.done ? 'style="opacity:.55;cursor:pointer"' : 'style="cursor:pointer"';
  const name = (color) => `<span class="row" style="gap:10px"><span class="swatch" style="background:${color || 'var(--border-strong)'}"></span><span style="color:var(--text-strong)">${esc(x.name)}</span>${x.archived ? '<span class="pill">Archived</span>' : ''}</span>`;
  if (kind === 'projects') {
    const c = by('clients', x.clientId);
    const used = x.budgetHours ? pct(t, x.budgetHours * 3600) : 0;
    return `<tr data-id="${x.id}" ${dim}><td>${name(x.color)}</td><td class="quiet">${c ? esc(c.name) : '<span class="silent">—</span>'}</td>
      <td class="r tnum quiet">${x.rate ? x.rate.toFixed(2) : c?.rate ? `<span class="silent" title="From ${esc(c.name)}">${c.rate.toFixed(2)}</span>` : '—'}</td>
      <td style="width:180px">${x.budgetHours ? `<div class="row" style="gap:8px"><div class="meter grow" style="height:5px"><i style="width:${Math.min(100, used)}%;${used > 100 ? 'background:var(--negative)' : ''}"></i></div><span class="silent tnum" style="font-size:11.5px">${used}% of ${x.budgetHours}h</span></div>` : '<span class="silent">—</span>'}</td>
      <td class="r tnum">${short(t)}</td></tr>`;
  }
  if (kind === 'clients') {
    const n = lists.projects.filter((p) => p.clientId === x.id && !p.archived).length;
    return `<tr data-id="${x.id}" ${dim}><td>${name(x.color)}</td><td class="r tnum quiet">${n}</td><td class="r tnum quiet">${x.rate ? x.rate.toFixed(2) : '—'}</td><td class="r tnum">${short(t)}</td></tr>`;
  }
  const p = by('projects', x.projectId);
  return `<tr data-id="${x.id}" ${dim}><td><label class="check"><input type="checkbox" data-done="${x.id}" ${x.done ? 'checked' : ''} aria-label="Done"></label></td>
    <td style="color:var(--text-strong);${x.done ? 'text-decoration:line-through' : ''}">${esc(x.name)}</td>
    <td>${p ? `<span class="row" style="gap:8px"><span class="swatch" style="background:${p.color}"></span>${esc(p.name)}</span>` : '<span class="silent">—</span>'}</td>
    <td class="silent ellipsis" style="max-width:240px">${esc((x.keywords || []).join(', ')) || '—'}</td><td class="r tnum">${short(t)}</td></tr>`;
}

function edit(x) {
  const m = META[kind];
  const color = x.color || ENTITY_COLORS[lists[kind].length % ENTITY_COLORS.length];
  const kw = esc((x.keywords || []).join(', '));
  const body = `<div class="form">
    <label class="field"><span>Name</span><input class="input" name="name" value="${esc(x.name || '')}" placeholder="${kind === 'tasks' ? 'Write release notes' : kind === 'clients' ? 'Acme Inc.' : 'Website redesign'}"></label>
    ${kind !== 'tasks' ? `<div class="field"><span>Color</span><div class="colors" id="colors">${ENTITY_COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}" aria-pressed="${c === color}" aria-label="Color ${c}"></button>`).join('')}</div></div>` : ''}
    ${kind === 'projects' ? `<div class="two"><label class="field"><span>Client</span><select class="input" name="clientId">${options(lists.clients, x.clientId, 'No client')}</select></label>
      <label class="field"><span>Budget (hours)</span><input class="input" type="number" min="0" step="1" name="budgetHours" value="${x.budgetHours || ''}" placeholder="None"></label></div>` : ''}
    ${kind === 'tasks' ? `<label class="field"><span>Project</span><select class="input" name="projectId">${options(lists.projects, x.projectId, 'No project')}</select></label>` : ''}
    ${kind !== 'tasks' ? `<label class="field"><span>Hourly rate</span><input class="input" type="number" min="0" step="0.01" name="rate" value="${x.rate ?? ''}" placeholder="${kind === 'projects' ? 'Use client rate' : '0.00'}"></label>` : ''}
    <label class="field"><span>Keywords</span><input class="input" name="keywords" value="${kw}" placeholder="acme, figma.com/file/abc"><span class="silent" style="font-size:11.5px">Comma separated. Matches window titles and URLs to suggest time entries.</span></label>
    ${x.id ? `<label class="row" style="justify-content:space-between"><span>${kind === 'tasks' ? 'Done' : 'Archived'}</span><span class="switch"><input type="checkbox" name="flag" ${(kind === 'tasks' ? x.done : x.archived) ? 'checked' : ''}><i></i></span></label>` : ''}
  </div>`;
  modal({
    title: x.id ? `Edit ${m.one}` : `New ${m.one}`, body,
    onMount: (mm) => $$('[data-c]', mm).forEach((b) => b.onclick = () => $$('[data-c]', mm).forEach((o) => o.setAttribute('aria-pressed', o === b))),
    actions: [
      ...(x.id ? [{ label: 'Delete', kind: 'danger', style: 'margin-right:auto', onClick: async () => {
        if (await confirmBox(`Delete ${m.one}?`, `Time entries keep their time but lose this ${m.one}.`)) api('remove', kind, x.id);
      } }] : []),
      { label: 'Cancel' },
      { label: x.id ? 'Save' : `Create ${m.one}`, kind: 'accent', onClick: async (mm) => {
        const v = (n) => $(`[name=${n}]`, mm);
        const name = v('name').value.trim();
        if (!name) { notice('Add a name'); return false; }
        const rec = { id: x.id, name, keywords: v('keywords').value.split(',').map((s) => s.trim()).filter(Boolean) };
        if (kind !== 'tasks') { rec.color = $('[data-c][aria-pressed="true"]', mm)?.dataset.c || color; const r = v('rate').value; rec.rate = r === '' ? null : Number(r); }
        if (kind === 'projects') { rec.clientId = v('clientId').value || null; const b = v('budgetHours').value; rec.budgetHours = b === '' ? null : Number(b); }
        if (kind === 'tasks') rec.projectId = v('projectId').value || null;
        if (x.id) rec[kind === 'tasks' ? 'done' : 'archived'] = v('flag').checked;
        await api('save', kind, rec);
      } },
    ],
  });
}
