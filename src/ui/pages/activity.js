import { api, esc, icon, $, $$, today, stepRange, longDate, short, hm, catColor, catLabel, CATS, modal, emptyState, notice } from '../lib.js';

let el, key = today(), tab = 'apps', q = '', data = null, open = new Set();

export async function mount(root) { el = root; await load(); }
export const refresh = () => load();

async function load() { data = await api('activity', key); draw(); }

function draw() {
  const rows = data.rows.filter((r) => !q || `${r.name} ${r.app} ${r.rule || ''}`.toLowerCase().includes(q));
  const total = data.rows.reduce((a, r) => a + r.secs, 0);
  el.innerHTML = `
    <header class="bar"><div class="title">Activity</div><span class="silent">${esc(longDate(key))}</span><div class="grow"></div>
      <div class="seg" role="group"><button data-tab="apps" aria-pressed="${tab === 'apps'}">Apps &amp; Websites</button><button data-tab="files" aria-pressed="${tab === 'files'}">Files &amp; Projects</button><button data-tab="log" aria-pressed="${tab === 'log'}">Activity log</button></div>
      <div class="seg"><button data-step="-1" aria-label="Previous day">${icon('chevron-left')}</button><button data-today title="Today">${icon('calendar-days')}</button><button data-step="1" aria-label="Next day">${icon('chevron-right')}</button></div>
    </header>
    <div class="page"><div style="max-width:1080px;margin:0 auto">
      <div class="toolbar"><label class="input" style="display:flex;align-items:center;gap:8px;width:300px">${icon('search', 15)}<input id="q" placeholder="Filter apps and websites" value="${esc(q)}" style="border:0;background:none;outline:0;color:inherit;flex:1;font:inherit"></label>
        <div class="grow"></div><span class="silent">${data.rows.length} apps &amp; websites · ${short(total)} active</span>
        <button class="btn sm" id="rules">${icon('sliders-horizontal', 14)}Rules</button></div>
      ${tab === 'apps' ? appsView(rows, total) : tab === 'files' ? filesView() : logView()}
    </div></div>`;
  $$('[data-tab]', el).forEach((b) => b.onclick = () => { tab = b.dataset.tab; draw(); });
  $$('[data-step]', el).forEach((b) => b.onclick = () => { key = stepRange('day', key, Number(b.dataset.step)); load(); });
  $('[data-today]', el).onclick = () => { key = today(); load(); };
  const qi = $('#q', el);
  qi.oninput = () => { q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; draw(); const n = $('#q', el); n.focus(); n.setSelectionRange(pos, pos); };
  $('#rules', el).onclick = () => { location.hash = 'settings/rules'; };
  $$('[data-open]', el).forEach((b) => b.onclick = (ev) => { if (ev.target.closest('[data-rule]')) return; const n = b.dataset.open; open.has(n) ? open.delete(n) : open.add(n); draw(); });
  $$('[data-rule]', el).forEach((b) => b.onclick = () => ruleModal(data.rows.find((r) => r.name === b.dataset.rule)));
}

function appsView(rows, total) {
  if (!rows.length) return `<div class="card">${emptyState('app-window', q ? 'No matches' : 'No activity yet', q ? 'Try another filter.' : 'Cadence records the app in front every 5 seconds. Come back after some work.')}</div>`;
  const max = rows[0].secs;
  return `<div class="card flush">${rows.map((r) => `
    <div class="list-row" data-open="${esc(r.name)}" style="grid-template-columns:22px minmax(0,1.3fr) 132px minmax(0,1fr) 64px 44px 28px;cursor:pointer">
      <span class="silent">${icon(r.kind === 'site' ? 'globe' : 'app-window', 16)}</span>
      <div class="ellipsis"><div style="color:var(--text-strong);font-weight:700" class="ellipsis">${esc(r.name)}</div><div class="silent ellipsis" style="font-size:11.5px">${r.kind === 'site' ? `in ${esc(r.app)}` : esc(r.rule || 'No rule')}</div></div>
      <span class="chip"><span class="dot" style="background:${catColor(r.category)}"></span>${esc(catLabel(r.category))}</span>
      <div class="meter" style="height:6px"><i style="width:${(r.secs / max) * 100}%;background:${catColor(r.category)}"></i></div>
      <span class="tnum" style="text-align:right;color:var(--text-strong)">${short(r.secs)}</span>
      <span class="silent tnum" style="text-align:right">${Math.round((r.secs / total) * 100)}%</span>
      <button class="btn ghost icon sm" data-rule="${esc(r.name)}" aria-label="Edit rule" title="Edit rule">${icon('pencil', 14)}</button>
    </div>
    ${open.has(r.name) ? `<div style="padding:4px 14px 12px 48px;border-bottom:1px solid var(--border);background:var(--bg-sunken)">${r.titles.length ? r.titles.map((t) => `<div class="legend-row" style="grid-template-columns:1fr auto"><span class="ellipsis quiet">${esc(t.title)}</span><span class="silent tnum">${short(t.secs)}</span></div>`).join('') : '<div class="silent" style="padding:6px 0">No window titles recorded.</div>'}</div>` : ''}`).join('')}</div>`;
}

// Paths come from the front window's AXDocument: open files, terminal folders. Projects are the git folders above them.
function filesView() {
  const f = (list) => list.filter((x) => !q || x.path.toLowerCase().includes(q));
  const files = f(data.files), projects = f(data.projects);
  if (!files.length && !projects.length) return `<div class="card">${emptyState('file-text', 'No files recorded', 'Editors, terminals, Preview and Office apps report the open file or folder. Work in one and come back.')}</div>`;
  const list = (title, rows) => rows.length ? `<div class="card flush"><div class="card-head" style="padding:12px 14px 4px"><span class="label">${title}</span></div>${rows.map((r) => `
    <div class="list-row" style="grid-template-columns:minmax(0,1fr) 64px"><div class="ellipsis"><div style="color:var(--text-strong)" class="ellipsis">${esc(r.name)}</div><div class="silent mono ellipsis" style="font-size:11px">${esc(r.path)}</div></div>
      <span class="tnum" style="text-align:right;color:var(--text-strong)">${short(r.secs)}</span></div>`).join('')}</div>` : '';
  return `<div class="stack-v" style="gap:12px">${list('Projects (git folders)', projects)}${list('Files &amp; folders', files)}</div>`;
}

function logView() {
  const log = data.log.filter((e) => !q || `${e.a} ${e.t || ''} ${e.u || ''} ${e.p || ''}`.toLowerCase().includes(q));
  if (!log.length) return `<div class="card">${emptyState('list', 'Nothing logged', 'The activity log lists every recorded block for this day.')}</div>`;
  return `<div class="card flush"><table class="table"><thead><tr><th style="width:120px">Time</th><th style="width:70px" class="r">Length</th><th>App</th><th>Title / URL</th><th style="width:150px">Label</th></tr></thead><tbody>
    ${log.map((e) => `<tr><td class="tnum quiet">${hm(e.s)} – ${hm(e.e)}</td><td class="r tnum">${short(e.e - e.s)}</td><td>${e.i ? '<span class="silent">Idle</span>' : esc(e.a)}</td>
      <td class="ellipsis" style="max-width:420px"><span class="quiet">${esc(e.t || '')}</span>${e.u ? `<div class="silent ellipsis" style="font-size:11.5px">${esc(e.u)}</div>` : ''}${e.p ? `<div class="silent mono ellipsis" style="font-size:11px">${esc(e.p)}</div>` : ''}</td>
      <td><span class="row" style="gap:6px"><span class="dot" style="background:${catColor(e.i ? 'idle' : e.c)}"></span>${esc(catLabel(e.i ? 'idle' : e.c))}</span></td></tr>`).join('')}</tbody></table></div>`;
}

// Edit or create the rule that matches this app / website (Rize "Categorize" flow).
async function ruleModal(row) {
  const rules = await api('rules');
  const key = row.kind === 'site' ? row.name : row.app;
  const idx = rules.findIndex((r) => (row.rule && r.name === row.rule) || r.hostKey === key);
  const r = idx >= 0 ? rules[idx] : { hostKey: key, name: row.name, category: row.category || 'miscellaneous',
    ...(row.kind === 'site' ? { url: `^https?://([a-z0-9-]+\\.)*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } : { app: `^${row.app.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` }) };
  modal({ title: `${idx >= 0 ? 'Edit' : 'Add'} rule · ${row.name}`, body: ruleForm(r), wide: true,
    actions: [{ label: 'Cancel' }, { label: 'Save rule', kind: 'accent', onClick: async (m) => {
      const next = readRuleForm(m, r);
      if (idx >= 0) rules[idx] = next; else rules.unshift(next);
      try { await api('saveRules', rules); notice('Rule saved'); } catch (e) { notice(String(e.message || e).replace(/^.*Error: /, '')); return false; }
    } }] });
}

export const FLAGS = [
  ['focus', 'Counts as focus', 'Time here can start an automatic focus session.'],
  ['meeting', 'Counts as meeting', 'Time here can start an automatic meeting session.'],
  ['detectIdle', 'Detect idle time', 'Turn off for apps you watch without typing, like video calls.'],
  ['blockInFocus', 'Block during focus', 'The distraction blocker interrupts you here during focus sessions.'],
  ['blockInMeeting', 'Block during meetings', ''],
  ['blockInBreak', 'Block during breaks', ''],
  ['alwaysBlock', 'Always block', 'Interrupt at any time, also without a session.'],
  ['trackTitles', 'Track window titles', ''],
  ['trackFullUrl', 'Track full URLs', 'Off keeps only the host name.'],
  ['doNotTrack', "Don't track", 'Cadence records nothing while this is in front.'],
];

export function ruleForm(r) {
  return `<div class="form">
    <div class="two"><label class="field"><span>Name</span><input class="input" name="name" value="${esc(r.name)}"></label>
    <label class="field"><span>Label</span><select class="input" name="category">${[...CATS, 'miscellaneous'].map((c) => `<option value="${c}" ${c === r.category ? 'selected' : ''}>${esc(catLabel(c))}</option>`).join('')}</select></label></div>
    <div class="two"><label class="field"><span>App pattern (regex)</span><input class="input mono" name="app" value="${esc(r.app || '')}" placeholder="^Slack$"></label>
    <label class="field"><span>URL pattern (regex)</span><input class="input mono" name="url" value="${esc(r.url || '')}" placeholder="^https?://example\\.com"></label></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:24px">${FLAGS.map(([k, t, d]) => `<label class="setting" style="padding:10px 0"><div><div class="t" style="font-weight:400">${t}</div>${d ? `<div class="d">${d}</div>` : ''}</div>
      <span class="switch"><input type="checkbox" name="${k}" ${r[k] ? 'checked' : ''}><i></i></span></label>`).join('')}</div></div>`;
}
export function readRuleForm(m, r) {
  const v = (n) => $(`[name=${n}]`, m);
  const out = { ...r, name: v('name').value.trim() || r.name, category: v('category').value, app: v('app').value.trim() || undefined, url: v('url').value.trim() || undefined };
  for (const [k] of FLAGS) out[k] = v(k).checked;
  return out;
}
