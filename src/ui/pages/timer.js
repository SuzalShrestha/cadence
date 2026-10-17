import { api, esc, icon, $, $$, clock, nowS, hm, today, tsOf, durText, short, SESSION, modal, menu, confirmBox, options, toInputTime, fromInputTime, notice } from '../lib.js';

const LENGTHS = [15, 25, 45, 60, 90];
let el, ctx, type = 'focus', mins = null, projects = [], planned = [];

export async function mount(root, c) { el = root; ctx = c; await load(); }
export const refresh = () => load();
export function tick() {
  const s = ctx.app.state.session;
  if (!s) return;
  const left = Math.max(0, s.stop - nowS()), total = s.stop - s.start;
  const arc = $('#arc', el);
  if (arc) { arc.removeAttribute('visibility'); arc.setAttribute('stroke-dasharray', `${(1 - left / total) * C} ${C}`); }
}

async function load() {
  [projects, planned] = await Promise.all([api('list', 'projects'), api('list', 'planned')]);
  draw();
}

const R = 100, C = 2 * Math.PI * R;
function ring(s) {
  const st = ctx.app.state.settings;
  const total = s ? s.stop - s.start : (mins || defaultMins()) * 60;
  const done = s ? Math.min(1, (nowS() - s.start) / total) : 0;
  const color = SESSION[s?.type || type].color;
  return `<div class="ringwrap"><svg viewBox="0 0 220 220" width="220" height="220"><circle cx="110" cy="110" r="${R}" fill="none" stroke="var(--input)" stroke-width="8"/>
    <circle id="arc" ${done ? '' : 'visibility="hidden"'} cx="110" cy="110" r="${R}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${done * C} ${C}"/></svg>
    <div class="center"><div><div class="eyebrow" style="color:${color}">${s ? SESSION[s.type].label : 'Ready'}</div>
    <div style="font-size:44px;font-weight:300;color:var(--text-strong);font-variant-numeric:tabular-nums;letter-spacing:-.02em" ${s ? `data-clock="down" data-at="${s.stop}"` : ''}>${clock(s ? s.stop - nowS() : total)}</div>
    <div class="silent" style="font-size:12px">${s ? `Ends at ${hm(s.stop)}` : `${st.trackingEnabled ? 'Tracking is on' : 'Tracking is paused'}`}</div></div></div></div>`;
}
const defaultMins = () => Math.round(ctx.app.state.settings[{ focus: 'defaultFocusSessionTime', meeting: 'defaultMeetingSessionTime', break: 'defaultBreakSessionTime' }[type]] / 60);

function draw() {
  const st = ctx.app.state, s = st.session;
  const up = planned.filter((p) => p.stop > nowS()).sort((a, b) => a.start - b.start);
  el.innerHTML = `
    <header class="bar"><div class="title">Timer</div><div class="grow"></div>
      <button class="btn ghost sm" id="more">${icon('zap', 14)}Plan</button></header>
    <div class="page"><div style="display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:20px;max-width:1080px;margin:0 auto">
      <div class="card" style="display:grid;justify-items:center;gap:18px;padding:28px 24px">
        ${s ? '' : `<div class="seg" role="group" aria-label="Session type">${Object.entries(SESSION).map(([t, v]) => `<button data-type="${t}" aria-pressed="${t === type}">${icon(v.icon, 14)}${v.label}</button>`).join('')}</div>`}
        ${ring(s)}
        ${s ? `
          <div class="form" style="width:min(420px,100%)">
            <input class="input" id="title" placeholder="What are you working on?" value="${esc(s.title)}">
            <select class="input" id="proj">${options(projects, s.projectId, 'No project')}</select>
          </div>
          <div class="row"><button class="btn" data-ext="300">${icon('plus', 14)}5 min</button><button class="btn" data-ext="900">${icon('plus', 14)}15 min</button>
            <button class="btn danger" id="end">${icon('square', 14)}End ${SESSION[s.type].label.toLowerCase()}</button></div>`
        : `
          <div class="chips" role="group" aria-label="Length">${LENGTHS.map((m) => `<button data-m="${m}" aria-pressed="${(mins || defaultMins()) === m}">${m} min</button>`).join('')}</div>
          <div class="form" style="width:min(420px,100%)">
            <input class="input" id="title" placeholder="What will you work on? (optional)">
            <select class="input" id="proj">${options(projects, null, 'No project')}</select>
          </div>
          <button class="btn accent lg" id="start">${icon('play', 15)}Start ${SESSION[type].label.toLowerCase()} session</button>`}
      </div>
      <div class="stack-v">
        <div class="card"><div class="card-head"><span class="label">Planned sessions</span><button class="btn ghost sm" id="add">${icon('plus', 14)}Plan</button></div>
          ${up.length ? `<div class="planlist">${up.map(planRow).join('')}</div>` : `<div class="silent" style="font-size:12.5px">No planned sessions. Plan focus blocks ahead, or start a Pomodoro set.</div>`}
        </div>
        <div class="card">
          <div class="setting" style="padding-top:0"><div><div class="t">Auto-start planned sessions</div><div class="d">Start at the planned time without asking.</div></div>
            <label class="switch"><input type="checkbox" id="auto" ${st.settings.autoStartPlannedSessions ? 'checked' : ''}><i></i></label></div>
          <div class="setting" style="padding-bottom:0"><div><div class="t">Shortcut</div><div class="d">Opens the quick start window from any app.</div></div>
            <span class="kbd">${esc(st.settings.globalShortcutAccelerator.replace('CommandOrControl', st.platform === 'darwin' ? '⌘' : 'Ctrl').replace(/\+/g, ' '))}</span></div>
        </div>
        ${sinceBreak(st)}
      </div>
    </div></div>`;
  wire(s);
}

function planRow(p) {
  const cur = p.start <= nowS() && p.stop > nowS();
  return `<div class="plan ${cur ? 'cur' : ''}"><span class="bar4" style="background:${SESSION[p.type].color}"></span>
    <div class="tnum"><div style="color:var(--text-strong)">${hm(p.start)}</div><div class="silent" style="font-size:11px">${short(p.stop - p.start)}</div></div>
    <div class="ellipsis"><div style="color:var(--text-strong)">${esc(p.title || SESSION[p.type].label)}</div><div class="silent" style="font-size:11px">${p.start - tsOf(today()) >= 86400 ? new Date(p.start * 1000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : SESSION[p.type].label}</div></div>
    <button class="btn ghost icon" data-pm="${p.id}" aria-label="Options">${icon('ellipsis', 15)}</button></div>`;
}

function sinceBreak(st) {
  if (st.session || !st.settings.productivityMode) return '';
  const secs = nowS() - st.lastBreakEnd;
  return `<div class="card"><div class="label">Since last break</div><div class="mid tnum" data-clock="up" data-at="${st.lastBreakEnd}">${clock(secs)}</div>
    <div class="silent" style="font-size:12px;margin-top:4px">${st.settings.breakReminderMinutes ? `Cadence reminds you after ${durText(st.settings.breakReminderMinutes * 60)}.` : 'Break reminders are off.'}</div></div>`;
}

function wire(s) {
  $$('[data-type]', el).forEach((b) => b.onclick = () => { type = b.dataset.type; mins = null; draw(); });
  $$('[data-m]', el).forEach((b) => b.onclick = () => { mins = Number(b.dataset.m); draw(); });
  $('#start', el)?.addEventListener('click', () => api('startSession', type, { length: (mins || defaultMins()) * 60, title: $('#title', el).value.trim(), projectId: $('#proj', el).value || null }));
  $('#end', el)?.addEventListener('click', () => api('stopSession'));
  $$('[data-ext]', el).forEach((b) => b.onclick = () => api('extendSession', Number(b.dataset.ext)));
  if (s) {
    $('#title', el).onchange = (e) => api('updateSession', { title: e.target.value });
    $('#proj', el).onchange = (e) => api('updateSession', { projectId: e.target.value });
  }
  $('#auto', el).onchange = (e) => api('saveSettings', { autoStartPlannedSessions: e.target.checked });
  $('#add', el).onclick = () => planModal();
  $('#more', el).onclick = (ev) => menu(ev.currentTarget, [
    { label: 'Start Pomodoro set', hint: '4 × 25/5', icon: 'timer', onClick: async () => { await api('pomodoro'); notice('Pomodoro set planned'); } },
    { label: 'Plan a session…', icon: 'plus', onClick: () => planModal() },
    '-',
    { label: 'Clear planned sessions', icon: 'trash-2', onClick: async () => { if (await confirmBox('Clear planned sessions?', 'This removes all upcoming planned sessions.', 'Clear')) api('clearPlanned'); } },
  ]);
  $$('[data-pm]', el).forEach((b) => b.onclick = () => {
    const p = planned.find((x) => x.id === b.dataset.pm);
    menu(b, [
      { label: 'Start now', icon: 'play', onClick: () => api('startSession', p.type, { length: p.stop - p.start, title: p.title, projectId: p.projectId, source: 'planned' }) },
      { label: 'Edit…', icon: 'pencil', onClick: () => planModal(p) },
      { label: 'Remove', icon: 'trash-2', onClick: () => api('remove', 'planned', p.id) },
    ]);
  });
}

function planModal(p = {}) {
  const start = p.start || Math.ceil(nowS() / 900) * 900 + 900;
  const day = new Date(start * 1000);
  const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  modal({
    title: p.id ? 'Edit planned session' : 'Plan a session',
    body: `<div class="form"><div class="seg" role="group">${Object.entries(SESSION).map(([t, v]) => `<button data-t="${t}" aria-pressed="${t === (p.type || 'focus')}">${v.label}</button>`).join('')}</div>
      <label class="field"><span>Title</span><input class="input" name="title" value="${esc(p.title || '')}" placeholder="Optional"></label>
      <div class="two"><label class="field"><span>Day</span><input class="input" type="date" name="day" value="${dayKey}"></label>
      <label class="field"><span>Start</span><input class="input" type="time" name="start" value="${toInputTime(start)}"></label></div>
      <div class="two"><label class="field"><span>Length (minutes)</span><input class="input" type="number" min="5" max="480" step="5" name="len" value="${p.id ? Math.round((p.stop - p.start) / 60) : 45}"></label>
      <label class="field"><span>Project</span><select class="input" name="projectId">${options(projects, p.projectId, 'No project')}</select></label></div></div>`,
    onMount: (m) => $$('[data-t]', m).forEach((b) => b.onclick = () => $$('[data-t]', m).forEach((x) => x.setAttribute('aria-pressed', x === b))),
    actions: [{ label: 'Cancel' }, { label: p.id ? 'Save' : 'Plan session', kind: 'accent', onClick: async (m) => {
      const v = (n) => $(`[name=${n}]`, m).value;
      const a = fromInputTime(v('day'), v('start')), len = Math.max(5, Math.min(480, Number(v('len')) || 45)) * 60;
      await api('save', 'planned', { id: p.id, type: $('[aria-pressed="true"]', m).dataset.t, start: a, stop: a + len, title: v('title').trim(), projectId: v('projectId') || null });
    } }],
  });
}
