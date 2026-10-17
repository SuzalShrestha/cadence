import {
  api, esc, icon, $, $$, dur, durText, short, pct, delta, hm, nowS, today, addDays, keyOf, dateOf, tsOf, longDate, shortDate, weekday,
  rangeOf, stepRange, catColor, catLabel, SESSION, popover, closePopover, modal, confirmBox, menu, donut, barChart, tips, tip,
  toInputTime, fromInputTime, options, emptyState, notice,
} from '../lib.js';

const HOUR = 76;
let el, ctx, view = localStorage.getItem('home.view') || 'day', key = today(), data = null, ents = { projects: [], clients: [], tasks: [] };
let dim = localStorage.getItem('home.dim') || 'projects';
let scrolled = false;

export async function mount(root, c) {
  el = root; ctx = c; scrolled = false;
  view = localStorage.getItem('home.view') || view;
  if (ctx.sub && /^\d{4}-\d{2}-\d{2}$/.test(ctx.sub)) { key = ctx.sub; view = 'day'; }
  await load();
}
export const refresh = () => load();
export function tick() { if (view === 'day' && key === today()) drawNow(); }
export function unmount() { closePopover(); }

async function load() {
  const [projects, clients, tasks] = await Promise.all([api('list', 'projects'), api('list', 'clients'), api('list', 'tasks')]);
  ents = { projects, clients, tasks };
  if (view === 'day') data = await api('day', key);
  else { const [a, b] = rangeOf(view, key); data = await api('range', a, b); data.from = a; data.to = b; }
  draw();
}

// ---------------------------------------------------------------- frame
function title() {
  if (view === 'day') return longDate(key);
  const [a, b] = rangeOf(view, key);
  if (view === 'week') return `${shortDate(a)} – ${shortDate(b)}, ${dateOf(b).getFullYear()}`;
  if (view === 'month') return dateOf(a).toLocaleDateString([], { month: 'long', year: 'numeric' });
  return String(dateOf(a).getFullYear());
}

let keepScroll = 0;
function draw() {
  keepScroll = $('#cal', el)?.scrollTop ?? keepScroll;
  const st = ctx.app.state;
  const perm = st.permissions;
  el.innerHTML = `
    <header class="bar">
      <div class="title">${esc(title())}</div><div class="grow"></div>
      <div class="seg" role="group" aria-label="Range">${['day', 'week', 'month', 'year'].map((v) => `<button data-view="${v}" aria-pressed="${v === view}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
      <div class="seg"><button data-step="-1" aria-label="Previous">${icon('chevron-left')}</button><button data-today title="Go to today">${icon('calendar-days')}</button><button data-step="1" aria-label="Next">${icon('chevron-right')}</button></div>
    </header>
    ${!perm.accessibility ? `<div class="banner">${icon('shield')}<div class="grow"><b>Allow Accessibility access</b><div class="silent">Cadence needs it to read window titles. App names and URLs still work without it. If Cadence is already on in the list, remove it with − and add it again.</div></div><button class="btn sm" data-perm>Open System Settings</button></div>` : ''}
    <div class="page split" id="split"><section id="canvas" style="min-height:0;overflow:hidden;position:relative"></section><aside class="sum" id="sum"></aside></div>`;
  $$('[data-view]', el).forEach((b) => b.onclick = () => { view = b.dataset.view; localStorage.setItem('home.view', view); scrolled = false; load(); });
  $$('[data-step]', el).forEach((b) => b.onclick = () => { key = stepRange(view, key, Number(b.dataset.step)); scrolled = false; load(); });
  $('[data-today]', el).onclick = () => { key = today(); scrolled = false; load(); };
  $('[data-perm]', el)?.addEventListener('click', () => api('openPermissions', 'accessibility'));
  if (view === 'day') { drawCalendar(); drawDaySummary(); } else { drawRange(); drawRangeSummary(); }
  tips($('#sum', el));
}

// ---------------------------------------------------------------- entity helpers
const find = (kind, id) => ents[kind].find((x) => x.id === id);
function resolve(e) {
  const task = find('tasks', e.taskId);
  const project = find('projects', e.projectId || task?.projectId);
  const client = find('clients', e.clientId || project?.clientId);
  return { task, project, client, color: project?.color || client?.color || '#6851ba' };
}

// ---------------------------------------------------------------- calendar (day)
const LANES = [
  { id: 'activity', w: '18px', label: '', icon: 'globe', tip: 'Activity' },
  { id: 'entries', w: '1fr', label: 'Time entries', icon: 'list' },
  { id: 'tasks', w: '1fr', label: 'Tasks', icon: 'square-check-big' },
  { id: 'projects', w: '1fr', label: 'Projects', icon: 'box' },
  { id: 'clients', w: '1fr', label: 'Clients', icon: 'building-2' },
  { id: 'sessions', w: '22px', label: '', icon: 'timer', tip: 'Sessions' },
];
const hourLabel = (h) => (ctx.app.state.settings.twentyFourHourEnabled ? `${String(h).padStart(2, '0')}:00` : `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`);
const cols = `56px ${LANES.map((l) => l.w).join(' ')}`;

function drawCalendar() {
  const day0 = tsOf(key);
  const y = (t) => ((t - day0) / 3600) * HOUR;
  const canvas = $('#canvas', el);
  canvas.innerHTML = `<div class="cal" id="cal">
    <div class="cal-head" style="grid-template-columns:${cols}"><div></div>${LANES.map((l) => `<div title="${l.tip || l.label}">${icon(l.icon, 14)}${l.label ? `<span>${l.label}</span>` : ''}</div>`).join('')}</div>
    <div class="cal-body" style="grid-template-columns:${cols};height:${24 * HOUR}px">
      <div class="cal-hours">${Array.from({ length: 24 }, (_, h) => h ? `<span style="top:${h * HOUR}px">${hourLabel(h)}</span>` : '').join('')}</div>
      ${LANES.map((l) => `<div class="lane ${l.w === '1fr' ? 'wide' : 'narrow'}" data-lane="${l.id}"></div>`).join('')}
      ${Array.from({ length: 24 }, (_, h) => `<div class="hline" style="top:${h * HOUR}px;left:56px"></div>`).join('')}
    </div></div>`;
  const lane = (id) => $(`[data-lane="${id}"]`, canvas);
  const blk = (lid, html) => lane(lid).insertAdjacentHTML('beforeend', html);
  const box = (a, b) => { const t = y(a), h = Math.max(4, y(b) - y(a) - 2); return { t, h, cls: h < 15 ? 'thin tiny' : h < 34 ? 'thin' : '' }; };

  // Activity strip: events merged by label.
  const strips = [];
  for (const e of data.events) {
    const k = e.i ? 'idle' : e.c, last = strips.at(-1);
    if (last && last.k === k && e.s - last.e <= 60) { last.e = e.e; last.apps[e.a] = (last.apps[e.a] || 0) + e.e - e.s; }
    else strips.push({ k, s: e.s, e: e.e, apps: { [e.a]: e.e - e.s } });
  }
  for (const s of strips) {
    const top = Object.entries(s.apps).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => esc(a)).join(', ');
    const tipHtml = `<b>${esc(catLabel(s.k))}</b>${hm(s.s)} – ${hm(s.e)} · ${short(s.e - s.s)}<br><span class="silent">${s.k === 'idle' ? 'Away from the computer' : top}</span>`;
    blk('activity', `<div class="strip ${s.k === 'idle' ? 'idle' : ''}" style="top:${y(s.s)}px;height:${Math.max(2, y(s.e) - y(s.s))}px;${s.k === 'idle' ? '' : `background:${catColor(s.k)}`}" data-tip="${esc(tipHtml)}"></div>`);
  }

  // Entries + derived task / project / client lanes.
  for (const e of data.entries) {
    const r = resolve(e), b = box(e.start, e.stop);
    const name = e.description || r.task?.name || r.project?.name || 'Time entry';
    const inner = (t) => `<div class="t">${esc(t)}</div><div class="s">${hm(e.start)} – ${hm(e.stop)}</div><span class="d ${b.cls ? 'hide' : ''}">${short(e.stop - e.start)}</span>`;
    blk('entries', `<div class="blk ${b.cls}" data-entry="${e.id}" style="top:${b.t}px;height:${b.h}px;background:${r.color}">${inner(name)}</div>`);
    if (r.task) blk('tasks', `<div class="blk ${b.cls}" data-entry="${e.id}" style="top:${b.t}px;height:${b.h}px;background:${r.color};filter:saturate(.85)">${inner(r.task.name)}</div>`);
    if (r.project) blk('projects', `<div class="blk ${b.cls}" data-entry="${e.id}" style="top:${b.t}px;height:${b.h}px;background:${r.project.color}">${inner(r.project.name)}</div>`);
    if (r.client) blk('clients', `<div class="blk ${b.cls}" data-entry="${e.id}" style="top:${b.t}px;height:${b.h}px;background:${r.client.color || '#7d7d86'}">${inner(r.client.name)}</div>`);
  }
  for (const s of data.suggestions) {
    const b = box(s.start, s.stop), r = resolve(s);
    const sname = r.project?.name || r.task?.name || r.client?.name || 'Suggestion';
    blk('entries', `<div class="blk sugg ${b.cls}" data-sugg="${esc(s.id)}" style="top:${b.t}px;height:${b.h}px" data-tip="${esc(`<b>Suggested: ${esc(sname)}</b>${hm(s.start)} – ${hm(s.stop)} · ${s.confidence}% match<br><span class="silent">Click to accept or dismiss</span>`)}">
      <div class="t">${esc(r.project?.name || r.task?.name || r.client?.name || 'Suggestion')}</div><div class="s">Suggested · <span class="conf">${s.confidence}%</span></div><span class="d ${b.cls ? 'hide' : ''}">${short(s.stop - s.start)}</span></div>`);
  }
  // "Tracking…": the current untagged run of activity (today only).
  if (key === today() && ctx.app.state.settings.trackingEnabled) {
    let start = null, end = null;
    for (let i = data.events.length - 1; i >= 0; i--) {
      const e = data.events[i];
      if (e.i) break;
      if (end == null) { if (nowS() - e.e > 300) break; end = e.e; }
      else if (start - e.e > 120) break;
      start = e.s;
    }
    if (start != null && !data.entries.some((x) => x.stop > start)) {
      const b = box(start, Math.max(nowS(), start + 300));
      blk('entries', `<div class="blk track ${b.cls}" style="top:${b.t}px;height:${b.h}px" data-tip="${esc('<b>Tracking…</b>Untagged activity. Drag over it to add a time entry.')}"><div class="t">Tracking…</div></div>`);
    }
  }

  // Sessions lane.
  for (const p of data.planned) {
    const b = box(p.start, p.stop);
    blk('sessions', `<div class="blk planned" data-planned="${p.id}" style="left:0;right:0;top:${b.t}px;height:${b.h}px;background:${SESSION[p.type].color};padding:0" data-tip="${esc(`<b>Planned ${SESSION[p.type].label}</b>${hm(p.start)} – ${hm(p.stop)}${p.title ? `<br>${esc(p.title)}` : ''}`)}"></div>`);
  }
  data.sessions.forEach((s, i) => {
    const b = box(s.start, s.stop);
    const t = `<b>${SESSION[s.type].label}${s.auto ? ' (auto)' : s.live ? ' (now)' : ''}</b>${hm(s.start)} – ${s.live ? 'now' : hm(s.stop)} · ${short(s.stop - s.start)}${s.score != null ? `<br>Focus score ${s.score}` : ''}${s.title ? `<br>${esc(s.title)}` : ''}`;
    blk('sessions', `<div class="blk" data-sess="${i}" style="left:0;right:0;top:${b.t}px;height:${b.h}px;background:${SESSION[s.type].color};padding:0" data-tip="${esc(t)}"></div>`);
  });

  canvas.insertAdjacentHTML('beforeend', '');
  drawNow();
  const cal = $('#cal', canvas);
  tips(cal);
  if (!scrolled) {
    const first = data.events[0]?.s ?? data.entries[0]?.start;
    // Start at the first activity; on today keep "now" in view as well.
    let top = y(first ? first - 1800 : day0 + 8 * 3600);
    if (key === today() && y(nowS()) > top + cal.clientHeight - 120) top = y(nowS()) - cal.clientHeight + 120;
    cal.scrollTop = Math.max(0, top);
    scrolled = true;
  } else cal.scrollTop = keepScroll;
  wireCalendar(cal, day0);
}

function drawNow() {
  const body = $('.cal-body', el);
  if (!body || key !== today()) return;
  let n = $('.now', body);
  if (!n) { n = document.createElement('div'); n.className = 'now'; n.style.left = '56px'; body.appendChild(n); }
  n.style.top = ((nowS() - tsOf(key)) / 3600) * HOUR + 'px';
}

function wireCalendar(cal, day0) {
  const toTs = (py) => day0 + Math.round(((py / HOUR) * 3600) / 300) * 300; // snap to 5 min
  for (const laneId of ['entries', 'tasks', 'projects', 'clients', 'sessions']) {
    const ln = $(`[data-lane="${laneId}"]`, cal);
    ln.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0 || ev.target.closest('.blk')) return;
      const r = ln.getBoundingClientRect();
      const y0 = ev.clientY - r.top;
      const sel = Object.assign(document.createElement('div'), { className: 'sel' });
      ln.appendChild(sel);
      const move = (m) => { const y1 = m.clientY - r.top; sel.style.top = Math.min(y0, y1) + 'px'; sel.style.height = Math.abs(y1 - y0) + 'px'; };
      const up = (m) => {
        removeEventListener('mousemove', move); removeEventListener('mouseup', up);
        sel.remove();
        let a = toTs(Math.min(y0, m.clientY - r.top)), b = toTs(Math.max(y0, m.clientY - r.top));
        if (b - a < 300) b = a + 1800;
        if (laneId === 'sessions') sessionModal({ start: a, stop: b });
        else entryModal({ start: a, stop: b });
      };
      move(ev);
      addEventListener('mousemove', move); addEventListener('mouseup', up);
    });
  }
  cal.addEventListener('click', (ev) => {
    const b = ev.target.closest('.blk');
    if (!b) return;
    tip(ev, null);
    if (b.dataset.entry) entryPopover(data.entries.find((x) => x.id === b.dataset.entry), b.getBoundingClientRect());
    else if (b.dataset.sugg) entryPopover(data.suggestions.find((x) => x.id === b.dataset.sugg), b.getBoundingClientRect(), true);
    else if (b.dataset.sess) sessionPopover(data.sessions[b.dataset.sess], b.getBoundingClientRect());
    else if (b.dataset.planned) plannedActions(data.planned.find((p) => p.id === b.dataset.planned), b);
  });
}

// ---------------------------------------------------------------- popovers & modals
async function entryPopover(e, rect, suggestion = false) {
  const r = resolve(e);
  const secs = e.stop - e.start;
  const rate = r.project?.rate ?? r.client?.rate ?? 0;
  const amount = rate && (e.billable || suggestion) ? `<span class="quiet tnum">${((secs / 3600) * rate).toFixed(2)}</span>` : '';
  const conf = suggestion ? `<span class="ring" title="Match confidence">${ringSvg(e.confidence)}${e.confidence}%</span>` : `<span class="pill">${icon('check', 12)} Approved</span>`;
  const chips = [
    r.task && `<span class="chip">${icon('square-check-big', 13)}${esc(r.task.name)}</span>`,
    r.project && `<span class="chip" style="background:${r.project.color};color:#fff">${icon('box', 13)}${esc(r.project.name)}</span>`,
    e.billable && !suggestion && `<span class="chip">${icon('briefcase', 13)}Billable</span>`,
  ].filter(Boolean).join('');
  const pop = popover(rect, `
    <div class="pop-top">
      <span class="chip">${icon('building-2', 13)}${esc(r.client?.name || 'No client')}</span><div class="grow"></div>${amount}${conf}
      ${suggestion ? '' : `<button class="btn round ghost" data-edit aria-label="Edit">${icon('pencil', 14)}</button><button class="btn round ghost" data-del aria-label="Delete">${icon('trash-2', 14)}</button>`}
      <button class="btn round ghost" data-close aria-label="Close">${icon('x', 14)}</button>
    </div>
    <div class="pop-title"><h3>${esc(e.description || r.project?.name || 'Time entry')}</h3><span class="quiet tnum" style="white-space:nowrap">${durText(secs)}</span></div>
    <div class="silent tnum" style="margin:-4px 0 10px">${hm(e.start)} – ${hm(e.stop)}</div>
    ${chips ? `<div class="chips" style="margin-bottom:14px">${chips}</div>` : ''}
    <div class="label" style="margin-bottom:6px">Apps &amp; Websites</div><div id="apps" class="silent">Loading…</div>
    ${suggestion ? `<div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn ghost" data-dismiss>Dismiss</button><button class="btn" data-editsugg>Edit</button><button class="btn accent" data-accept>${icon('check', 14)}Accept</button></div>` : ''}`,
  (p, close) => {
    $('[data-close]', p).onclick = close;
    $('[data-edit]', p)?.addEventListener('click', () => { close(); entryModal(e); });
    $('[data-del]', p)?.addEventListener('click', async () => { close(); if (await confirmBox('Delete time entry?', 'This removes the entry. Tracked activity stays.')) api('remove', 'entries', e.id); });
    $('[data-accept]', p)?.addEventListener('click', async () => { close(); await api('acceptSuggestion', strip(e)); notice('Time entry added'); });
    $('[data-dismiss]', p)?.addEventListener('click', () => { close(); api('dismissSuggestion', e.id); });
    $('[data-editsugg]', p)?.addEventListener('click', () => { close(); entryModal({ ...strip(e), id: undefined, billable: true }); });
  });
  const apps = await api('apps', e.start, e.stop);
  const box = $('#apps', pop);
  if (box) box.outerHTML = apps.length ? apps.map((a) => `<div class="approw"><span class="tnum">${Math.round(a.pct * 100)}%</span><div class="meter"><i style="width:${Math.round(a.pct * 100)}%"></i></div><span class="ellipsis" style="color:var(--text)">${esc(a.name)}</span><span class="silent tnum">${Math.max(1, Math.round(a.secs / 60))} min</span></div>`).join('')
    : '<div class="silent">No activity recorded in this range.</div>';
}
const strip = ({ start, stop, description, projectId, clientId, taskId }) => ({ start, stop, description, projectId, clientId, taskId });
const ringSvg = (v) => `<svg width="16" height="16" viewBox="0 0 16 16" style="transform:rotate(-90deg)"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--input)" stroke-width="2.5"/><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="${(v / 100) * 37.7} 40" stroke-linecap="round"/></svg>`;

function sessionPopover(s, rect) {
  const editable = s.id && !s.live;
  popover(rect, `
    <div class="pop-top"><span class="chip"><span class="dot" style="background:${SESSION[s.type].color}"></span>${SESSION[s.type].label}${s.auto ? ' · detected' : s.source === 'planned' ? ' · planned' : ''}</span><div class="grow"></div>
      ${editable ? `<button class="btn round ghost" data-del aria-label="Delete">${icon('trash-2', 14)}</button>` : ''}<button class="btn round ghost" data-close aria-label="Close">${icon('x', 14)}</button></div>
    <div class="pop-title"><h3>${esc(s.title || `${SESSION[s.type].label} session`)}</h3><span class="quiet tnum">${durText(s.stop - s.start)}</span></div>
    <div class="silent tnum">${hm(s.start)} – ${s.live ? 'now' : hm(s.stop)}</div>
    ${s.score != null ? `<div class="divider"></div><div class="row"><div class="grow"><div class="label">Focus Score</div><div class="mid">${s.score}</div></div><div class="pill">${scoreLabel(s.score)}</div></div>` : ''}
    ${s.rating ? `<div class="silent" style="margin-top:8px">Your rating: ${'●'.repeat(s.rating)}${'○'.repeat(5 - s.rating)}</div>` : ''}
    ${s.auto ? '<div class="silent" style="margin-top:10px">Detected from your activity. It is not saved, so it updates when your rules change.</div>' : ''}`,
  (p, close) => {
    $('[data-close]', p).onclick = close;
    $('[data-del]', p)?.addEventListener('click', async () => { close(); if (await confirmBox('Delete session?', 'This removes the session from your history.')) api('remove', 'sessions', s.id); });
  });
}
const scoreLabel = (s) => (s >= 80 ? 'Very Focused' : s >= 60 ? 'Focused' : s >= 40 ? 'Somewhat Focused' : 'Not Focused');

function plannedActions(p, anchor) {
  menu(anchor, [
    { label: `Start ${SESSION[p.type].label} now`, icon: 'play', onClick: () => api('startSession', p.type, { length: p.stop - p.start, title: p.title, source: 'planned' }) },
    { label: 'Remove planned session', icon: 'trash-2', onClick: () => api('remove', 'planned', p.id) },
  ]);
}

export function entryModal(e, lists = ents) {
  const k = keyOf(new Date(e.start * 1000));
  const ents = lists;
  modal({
    title: e.id ? 'Edit time entry' : 'Add time entry',
    body: `<div class="form">
      <label class="field"><span>Description</span><textarea class="input" name="description" rows="2" placeholder="What did you work on?">${esc(e.description || '')}</textarea></label>
      <div class="two"><label class="field"><span>Start</span><input class="input" type="time" name="start" value="${toInputTime(e.start)}"></label>
      <label class="field"><span>End</span><input class="input" type="time" name="stop" value="${toInputTime(e.stop)}"></label></div>
      <div class="two"><label class="field"><span>Project</span><select class="input" name="projectId">${options(ents.projects, e.projectId)}</select></label>
      <label class="field"><span>Task</span><select class="input" name="taskId">${options(ents.tasks.filter((t) => !t.done || t.id === e.taskId), e.taskId)}</select></label></div>
      <label class="field"><span>Client</span><select class="input" name="clientId">${options(ents.clients, e.clientId, 'From project')}</select></label>
      <label class="row" style="justify-content:space-between"><span>Billable</span><span class="switch"><input type="checkbox" name="billable" ${e.billable !== false ? 'checked' : ''}><i></i></span></label>
    </div>`,
    actions: [
      ...(e.id ? [{ label: 'Delete', kind: 'danger', style: 'margin-right:auto', onClick: () => api('remove', 'entries', e.id) }] : []),
      { label: 'Cancel' },
      { label: e.id ? 'Save' : 'Add entry', kind: 'accent', onClick: async (m) => {
        const f = (n) => m.querySelector(`[name=${n}]`);
        let start = fromInputTime(k, f('start').value), stop = fromInputTime(k, f('stop').value);
        if (stop <= start) stop += 86400;
        await api('save', 'entries', { id: e.id, start, stop, description: f('description').value.trim(), projectId: f('projectId').value || null,
          taskId: f('taskId').value || null, clientId: f('clientId').value || null, billable: f('billable').checked, status: 'approved' });
      } },
    ],
  });
}

function sessionModal(s) {
  const k = keyOf(new Date(s.start * 1000));
  modal({
    title: 'Add session',
    body: `<div class="form"><div class="seg" role="group" id="stype">${Object.entries(SESSION).map(([t, v], i) => `<button data-t="${t}" aria-pressed="${i === 0}">${v.label}</button>`).join('')}</div>
      <div class="two"><label class="field"><span>Start</span><input class="input" type="time" name="start" value="${toInputTime(s.start)}"></label>
      <label class="field"><span>End</span><input class="input" type="time" name="stop" value="${toInputTime(s.stop)}"></label></div>
      <label class="field"><span>Title</span><input class="input" name="title" placeholder="Optional"></label></div>`,
    onMount: (m) => $$('[data-t]', m).forEach((b) => b.onclick = () => $$('[data-t]', m).forEach((x) => x.setAttribute('aria-pressed', x === b))),
    actions: [{ label: 'Cancel' }, { label: 'Add session', kind: 'accent', onClick: async (m) => {
      const type = $('[aria-pressed="true"]', m).dataset.t;
      const start = fromInputTime(k, $('[name=start]', m).value), stop = fromInputTime(k, $('[name=stop]', m).value);
      if (stop <= start) return false;
      const future = start > nowS();
      await api('save', future ? 'planned' : 'sessions', { type, start, stop, title: $('[name=title]', m).value.trim(), source: 'manual' });
    } }],
  });
}

// ---------------------------------------------------------------- summary (day)
function drawDaySummary() {
  const s = data.summary, sum = $('#sum', el);
  const label = key === today() ? 'Today' : shortDate(key);
  const span = data.events.length ? data.events.at(-1).e - data.events[0].s : 0;
  const coach = ctx.app.state.settings.productivityMode;
  sum.innerHTML = `
    <div class="sum-head"><div class="row"><span class="silent">${icon('chevrons-right', 14)}</span><h2>Summary · ${esc(label)}</h2></div>
      <button class="btn ghost sm" id="custom">${icon('sliders-horizontal', 14)}Customize</button></div>
    <div class="card"><div class="row" style="align-items:flex-start">
      <div class="grow"><div class="label">${coach ? 'Work Hours' : 'Tracked'}</div><div class="big">${dur(s.active)}</div><div style="margin-top:4px">${delta(s.active, data.yesterday, 'vs yesterday')}</div></div>
      <div style="text-align:right">${!coach ? `<div class="label">Active</div>${s.first ? `<div class="mid tnum">${hm(s.first)} – ${hm(s.last)}</div>` : '<div class="mid">—</div>'}`
        : `<div class="label">Percent of Target</div>`}${!coach ? '' : s.pto ? '<div class="mid">Day off</div><div class="silent">Marked as PTO</div>'
        : s.target ? `<div><span class="mid">${pct(s.active, s.target)}%</span> <span class="silent">of ${durText(s.target)}</span></div>` : '<div class="mid">—</div><div class="silent">No target today</div>'}</div>
    </div></div>
    ${breakdownCard()}
    ${coach ? `<div class="grid2">
      <div class="card"><div class="label">Percent of work day</div><div class="mid">${span ? pct(s.active, span) : 0}<span class="u">%</span></div><div class="silent" style="font-size:12px">of ${durText(span)} span</div></div>
      <div class="card"><div class="label">Focus Time</div><div class="mid">${dur(s.focus)}</div>${delta(s.focus, data.avgFocus, 'vs average')}</div>
    </div>
    ${metricsCard(s)}` : ''}
    ${categoriesCard(s.categories)}
    ${listCard('Top apps & websites', [...s.sites, ...s.apps].sort((a, b) => b.secs - a.secs).filter((x, i, a) => a.findIndex((y) => y.name === x.name) === i).slice(0, 6))}`;
  wireBreakdown(data.entries);
  $('#custom', sum).onclick = (ev) => menu(ev.currentTarget, [
    { label: s.pto ? 'Unmark day off (PTO)' : 'Mark as day off (PTO)', icon: 'plane', onClick: () => api('setPto', key, !s.pto) },
    { label: 'Work hours targets…', icon: 'target', onClick: () => { location.hash = 'settings/hours'; } },
    { label: 'Add time entry', icon: 'plus', onClick: () => entryModal({ start: Math.min(nowS(), tsOf(key) + 9 * 3600) - 1800, stop: Math.min(nowS(), tsOf(key) + 9 * 3600) }) },
  ]);
}

function breakdownCard(empty = 'No time entries yet. Drag on the calendar to add one, or accept a suggestion.') {
  return `<div class="card" id="bd"><div class="tabs" role="group">${[['tasks', 'square-check-big', 'Tasks'], ['projects', 'box', 'Projects'], ['clients', 'building-2', 'Clients']]
    .map(([d, ic, l]) => `<button data-dim="${d}" aria-pressed="${d === dim}">${icon(ic, 14)}${l}</button>`).join('')}</div><div id="bdbody"></div><template id="bdempty">${esc(empty)}</template></div>`;
}
function wireBreakdown(entries) {
  const body = $('#bdbody', el);
  const render = () => {
    const m = new Map();
    for (const e of entries) {
      const r = resolve(e), x = dim === 'tasks' ? r.task : dim === 'projects' ? r.project : r.client;
      const id = x?.id || 'none';
      const cur = m.get(id) || { name: x?.name || `No ${dim.slice(0, -1)}`, color: x?.color || (dim === 'tasks' ? r.color : '#55545c'), secs: 0 };
      cur.secs += e.stop - e.start;
      m.set(id, cur);
    }
    const rows = [...m.values()].sort((a, b) => b.secs - a.secs);
    const shown = rows.slice(0, 5), rest = rows.slice(5).reduce((a, r) => a + r.secs, 0);
    if (rest) shown.push({ name: 'Other', color: '#55545c', secs: rest });
    body.innerHTML = rows.length ? `<div class="row" style="gap:16px">${donut(shown.map((r) => ({ value: r.secs, color: r.color, tip: `<b>${esc(r.name)}</b>${durText(r.secs)}` })))}
      <div class="grow">${shown.map((r) => `<div class="legend-row"><span class="dot" style="background:${r.color}"></span><span class="ellipsis">${esc(r.name)}</span><span class="quiet tnum">${short(r.secs)}</span></div>`).join('')}</div></div>`
      : `<div class="silent" style="padding:6px 2px">${$('#bdempty', el).innerHTML}</div>`;
  };
  $$('[data-dim]', el).forEach((b) => b.onclick = () => { dim = b.dataset.dim; localStorage.setItem('home.dim', dim); $$('[data-dim]', el).forEach((x) => x.setAttribute('aria-pressed', x === b)); render(); });
  render();
}

function metricsCard(s) {
  const parts = [['Focus', s.focus, 'var(--focus)'], ['Meetings', s.meeting, 'var(--meeting)'], ['Breaks', s.break, 'var(--break)'], ['Others', s.others, 'var(--other)']];
  const total = parts.reduce((a, p) => a + p[1], 0);
  return `<div class="card"><div class="card-head"><span class="label">Productivity Metrics</span><span class="silent" style="font-size:12px">Total: ${short(total)}</span></div>
    ${total ? `<div class="stack">${parts.filter((p) => p[1] > 0).map(([n, v, c]) => `<i style="flex:${v};background:${c}" data-tip="${esc(`<b>${n}</b>${durText(v)} · ${pct(v, total)}%`)}"></i>`).join('')}</div>`
      : '<div class="stack"><i style="flex:1;background:var(--input)"></i></div>'}
    <div class="metric-legend">${parts.map(([n, v, c]) => `<div><i style="background:${c}"></i>${n}<small>${short(v)}</small></div>`).join('')}</div></div>`;
}

function categoriesCard(cats) {
  if (!cats.length) return '';
  const max = cats[0].secs;
  return `<div class="card"><div class="card-head"><span class="label">Activity by label</span></div>
    ${cats.slice(0, 8).map((c) => `<div class="legend-row" style="grid-template-columns:10px 112px 1fr auto"><span class="dot" style="background:${catColor(c.name)}"></span><span class="ellipsis">${esc(catLabel(c.name))}</span>
      <div class="meter" style="height:5px"><i style="width:${(c.secs / max) * 100}%;background:${catColor(c.name)}"></i></div><span class="quiet tnum">${short(c.secs)}</span></div>`).join('')}</div>`;
}

function listCard(title, rows) {
  if (!rows.length) return '';
  return `<div class="card"><div class="card-head"><span class="label">${esc(title)}</span></div>${rows.map((r) => `<div class="legend-row" style="grid-template-columns:1fr auto"><span class="ellipsis">${esc(r.name)}</span><span class="quiet tnum">${short(r.secs)}</span></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- week / month / year
function drawRange() {
  const canvas = $('#canvas', el);
  canvas.style.overflow = 'auto';
  const days = data.days;
  const tot = (k) => days.reduce((a, d) => a + d[k], 0);
  const stacks = (d) => [
    { value: d.focus, color: 'var(--focus)' }, { value: d.meeting, color: 'var(--meeting)' }, { value: Math.max(0, d.active - d.focus - d.meeting), color: 'var(--other)' }];
  let chart;
  if (view === 'year') {
    const months = Array.from({ length: 12 }, (_, m) => ({ m, active: 0, focus: 0, meeting: 0, target: 0 }));
    for (const d of days) { const x = months[dateOf(d.key).getMonth()]; x.active += d.active; x.focus += d.focus; x.meeting += d.meeting; x.target += d.target; }
    chart = barChart(months.map((x) => ({ label: new Date(2000, x.m, 1).toLocaleDateString([], { month: 'short' }), stacks: stacks(x), target: 0,
      tip: `<b>${new Date(2000, x.m, 1).toLocaleDateString([], { month: 'long' })}</b>Work hours ${durText(x.active)}<br>Focus ${durText(x.focus)} · Meetings ${durText(x.meeting)}` })), { unit: 3600 * 10, showTarget: false });
  } else {
    chart = barChart(days.map((d) => ({ label: view === 'week' ? weekday(d.key) : String(dateOf(d.key).getDate()), stacks: stacks(d), target: d.target,
      tip: `<b>${weekday(d.key, 'long')}, ${shortDate(d.key)}</b>Work hours ${durText(d.active)}${d.target ? ` · ${pct(d.active, d.target)}% of target` : ''}<br>Focus ${durText(d.focus)} · Meetings ${durText(d.meeting)}` })));
  }
  const month = view === 'month' ? monthGrid(days) : '';
  canvas.innerHTML = `<div style="padding:20px;display:grid;gap:12px">
    <div class="card"><div class="card-head"><div><div class="label">Work hours by ${view === 'year' ? 'month' : 'day'}</div></div>
      <div class="row" style="gap:14px;font-size:12px" class="quiet">${[['Focus', 'var(--focus)'], ['Meetings', 'var(--meeting)'], ['Other work', 'var(--other)']].map(([n, c]) => `<span class="row" style="gap:6px"><span class="dot" style="background:${c}"></span>${n}</span>`).join('')}
      ${view !== 'year' ? '<span class="row" style="gap:6px"><span style="width:12px;height:2px;background:var(--text-silent);border-radius:2px"></span>Target</span>' : ''}</div></div>${chart}</div>
    ${month}
    ${view === 'week' ? weekTable(days) : ''}
  </div>`;
  tips(canvas);
  $$('[data-day]', canvas).forEach((c) => c.onclick = () => { key = c.dataset.day; view = 'day'; localStorage.setItem('home.view', view); scrolled = false; load(); });
  void tot;
}

function monthGrid(days) {
  const first = dateOf(days[0].key), lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: lead }, () => '<div class="mcell out"></div>');
  for (const d of days) {
    const p = d.target ? Math.min(100, pct(d.active, d.target)) : 0;
    cells.push(`<div class="mcell ${d.key === today() ? 'today' : ''}" data-day="${d.key}"><div class="n"><span>${dateOf(d.key).getDate()}</span>${d.pto ? `<span title="Day off">${icon('plane', 12)}</span>` : ''}</div>
      ${d.active ? `<div class="mid" style="font-size:15px">${short(d.active)}</div><div class="meter"><i style="width:${p}%"></i></div><div class="silent" style="font-size:11px">Focus ${short(d.focus)}</div>` : '<div class="silent" style="font-size:12px">—</div>'}</div>`);
  }
  return `<div class="month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="eyebrow" style="padding:0 4px">${d}</div>`).join('')}${cells.join('')}</div>`;
}

function weekTable(days) {
  return `<div class="card flush"><table class="table"><thead><tr><th>Day</th><th class="r">Work hours</th><th class="r">Target</th><th class="r">Focus</th><th class="r">Meetings</th><th class="r">Breaks</th><th class="r">Focus score</th></tr></thead><tbody>
    ${days.map((d) => `<tr data-day="${d.key}" style="cursor:pointer"><td>${weekday(d.key, 'long')} <span class="silent">${shortDate(d.key)}</span></td><td class="r tnum">${short(d.active)}</td>
      <td class="r tnum quiet">${d.pto ? 'PTO' : d.target && d.key <= today() ? `${pct(d.active, d.target)}%` : '—'}</td><td class="r tnum">${short(d.focus)}</td><td class="r tnum">${short(d.meeting)}</td><td class="r tnum">${short(d.break)}</td>
      <td class="r tnum">${d.focusScore ?? '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

function drawRangeSummary() {
  const days = data.days, sum = $('#sum', el);
  const t = (k) => days.reduce((a, d) => a + d[k], 0);
  const active = t('active'), target = t('target');
  const worked = days.filter((d) => d.active > 600).length;
  const scores = days.map((d) => d.focusScore).filter((x) => x != null);
  const s = { focus: t('focus'), meeting: t('meeting'), break: t('break'), others: Math.max(0, active - t('focus') - t('meeting')) };
  const coach = ctx.app.state.settings.productivityMode;
  sum.innerHTML = `
    <div class="sum-head"><div class="row"><span class="silent">${icon('chevrons-right', 14)}</span><h2>Summary · ${view[0].toUpperCase() + view.slice(1)}</h2></div></div>
    <div class="card"><div class="row" style="align-items:flex-start">
      <div class="grow"><div class="label">${coach ? 'Work Hours' : 'Tracked'}</div><div class="big">${dur(active)}</div><div class="silent" style="font-size:12px;margin-top:4px">${worked ? `${durText(active / worked)} avg per work day` : 'No work days yet'}</div></div>
      ${coach ? `<div style="text-align:right"><div class="label">Percent of Target</div><div><span class="mid">${pct(active, target)}%</span></div><div class="silent" style="font-size:12px">of ${durText(target)}</div></div>`
        : `<div style="text-align:right"><div class="label">Days tracked</div><div class="mid">${worked}</div></div>`}
    </div></div>
    ${breakdownCard('No time entries in this range.')}
    ${coach ? `<div class="grid2">
      <div class="card"><div class="label">Focus Time</div><div class="mid">${dur(s.focus)}</div><div class="silent" style="font-size:12px">${scores.length ? `Avg score ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}` : 'No focus sessions'}</div></div>
      <div class="card"><div class="label">Meetings</div><div class="mid">${dur(s.meeting)}</div><div class="silent" style="font-size:12px">${days.reduce((a, d) => a + d.counts.meeting, 0)} meetings</div></div>
    </div>
    ${metricsCard(s)}` : ''}
    ${categoriesCard(data.categories)}`;
  wireBreakdown(data.entries);
}

void emptyState; void addDays;
