import { api, esc, icon, $, $$, durText, catColor, catLabel, CATS, modal, confirmBox, notice } from '../lib.js';
import { ruleForm, readRuleForm, FLAGS } from './activity.js';

const SECTIONS = [
  ['general', 'settings', 'General'],
  ['tracking', 'eye-off', 'Tracking & Privacy'],
  ['sessions', 'timer', 'Sessions & Breaks'],
  ['blocker', 'shield', 'Distraction Blocker'],
  ['hours', 'target', 'Work Hours'],
  ['rules', 'sliders-horizontal', 'Apps & Websites'],
  ['shortcut', 'keyboard', 'Shortcut & Widget'],
  ['data', 'download', 'Data'],
];
let el, ctx, sec = 'general', rules = null, rq = '';

export async function mount(root, c) { el = root; ctx = c; sec = SECTIONS.some((s) => s[0] === c.sub) ? c.sub : 'general'; await draw(); }
export const refresh = () => { if (sec !== 'rules') draw(); };

const S = () => ctx.app.state.settings;
const save = async (patch) => { await api('saveSettings', patch); await ctx.refreshState(); };

// ---- small builders --------------------------------------------------------
const row = (t, d, control) => `<div class="setting"><div><div class="t">${t}</div>${d ? `<div class="d">${d}</div>` : ''}</div>${control}</div>`;
const sw = (k, on = S()[k]) => `<label class="switch"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><i></i></label>`;
const minutes = (k, list) => `<select class="input" data-min="${k}">${list.map((m) => `<option value="${m}" ${S()[k] === m * 60 ? 'selected' : ''}>${m ? durText(m * 60) : 'Off'}</option>`).join('')}${list.includes(S()[k] / 60) ? '' : `<option selected value="${S()[k] / 60}">${durText(S()[k])}</option>`}</select>`;
const pick = (k, opts) => `<select class="input" data-pick="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(S()[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
const group = (title, rows) => `<div class="card" style="padding:4px 18px">${title ? `<div class="eyebrow" style="padding:14px 0 2px">${title}</div>` : ''}${rows.join('')}</div>`;

async function draw() {
  el.innerHTML = `
    <header class="bar"><div class="title">Settings</div></header>
    <div class="page"><div style="display:grid;grid-template-columns:210px minmax(0,760px);gap:28px;justify-content:center">
      <nav class="subnav">${SECTIONS.map(([k, ic, l]) => `<button data-sec="${k}" aria-pressed="${k === sec}">${icon(ic, 15)}${l}</button>`).join('')}</nav>
      <div class="stack-v" id="body" style="gap:16px">${await body()}</div>
    </div></div>`;
  $$('[data-sec]', el).forEach((b) => b.onclick = () => { history.replaceState(null, '', `#settings/${b.dataset.sec}`); sec = b.dataset.sec; draw(); });
  wire();
}

async function body() {
  const s = S(), st = ctx.app.state, mac = st.platform === 'darwin';
  switch (sec) {
    case 'general': return group('', [
      row('Productivity coaching', s.productivityMode
        ? 'On. The widget counts time since your last break, and Cadence sends break reminders, target cards and the weekly assessment.'
        : 'Off. Cadence only records what you do. No break timer, reminders or targets. Sessions and the blocker still work when you start them.', sw('productivityMode')),
      row('Appearance', 'Dark is the default. System follows your OS.', `<div class="seg" role="group">${[['dark', 'moon', 'Dark'], ['light', 'sun', 'Light'], ['system', 'monitor', 'System']].map(([v, ic, l]) => `<button data-theme="${v}" aria-pressed="${s.theme === v}">${icon(ic, 14)}${l}</button>`).join('')}</div>`),
      row('24-hour clock', 'Show 14:30 instead of 2:30 PM.', sw('twentyFourHourEnabled')),
      row('Tracking', s.trackingEnabled ? 'Cadence records the app, window, URL and open file every 5 seconds.' : 'Paused. Nothing is recorded.', sw('trackingEnabled')),
      row('Session summary toasts', 'Show a focus score card after focus sessions and when you reach your target.', sw('toasterEnabled')),
      row('Weekly report', 'On Monday, show a notification for last week\'s productivity assessment.', sw('weeklyReportEnabled')),
      row('Open at login', 'Start Cadence when you sign in. Only works in a packaged build.', sw('openAtLogin')),
    ]) + group('Updates', [
      row(`Cadence ${esc(st.version)}`, updateText(st.update), updateButton(st.update)),
      row('Check for updates automatically', 'On launch and every 6 hours. Updates download in the background and install when you restart Cadence.', sw('autoUpdateEnabled')),
      ...(st.update.status === 'ready' && st.update.notes ? [`<div class="setting"><div><div class="t">What's new in ${esc(st.update.version)}</div><div class="d" style="white-space:pre-wrap;max-height:180px;overflow:auto">${esc(st.update.notes)}</div></div></div>`] : []),
    ]) + group('Permissions', [
      row('Accessibility', st.permissions.accessibility ? 'Granted. Cadence can read window titles.' : 'Needed to read window titles.', st.permissions.accessibility ? `<span class="pill" style="color:var(--positive)">${icon('check', 12)}Granted</span>` : `<button class="btn sm" data-perm="accessibility">Grant access</button>`),
      ...(mac ? [row('Automation', 'Needed for browser URLs. macOS asks once per browser.', `<button class="btn sm" data-perm="automation">Open settings</button>`)] : []),
    ]) + `<div class="silent" style="font-size:12px;padding:0 4px">Cadence ${esc(st.version)} · All data stays on this computer.</div>`;

    case 'tracking': return group('Privacy', [
      row('Strip window titles', 'Keep app names and hosts only. Titles are not saved.', sw('stripTrackedTitlesEnabled')),
      row('Host only for URLs', 'Save github.com instead of the full address.', sw('urlHostOnlyEnabled')),
      row("Don't track URLs", 'Never read browser addresses.', sw('doNotTrackAnyUrlsGlobal')),
    ]) + group('Idle', [
      row('Detect breaks automatically', 'Idle time of 5 minutes or more counts as a break and resets the "since break" timer.', sw('autoBreakDetection')),
    ]) + `<div class="silent" style="font-size:12px;padding:0 4px">Per-app privacy (don't track, titles, full URLs) is in <a href="#settings/rules" data-go="rules">Apps &amp; Websites</a>.</div>`;

    case 'sessions': return group('Default lengths', [
      row('Focus session', '', minutes('defaultFocusSessionTime', [15, 25, 30, 45, 50, 60, 90, 120])),
      row('Meeting', '', minutes('defaultMeetingSessionTime', [15, 30, 45, 60, 90])),
      row('Break', '', minutes('defaultBreakSessionTime', [5, 10, 15, 20, 30])),
    ]) + group('Breaks', [
      row('Full-screen break', 'Cover every display during a break with Extend and End buttons.', sw('fullScreenBreakEnabled')),
      row('Break reminder', 'Notify me after this long without a break.', pick('breakReminderMinutes', [[0, 'Off'], [45, '45 min'], [60, '1 hr'], [90, '1 hr 30 min'], [120, '2 hr']])),
    ]) + group('Planned sessions', [
      row('Auto-start planned sessions', 'Start at the planned time without asking.', sw('autoStartPlannedSessions')),
      row('Notify before start', '', pick('plannedNotifyMinutes', [[0, 'Off'], [1, '1 min before'], [5, '5 min before'], [10, '10 min before'], [15, '15 min before']])),
    ]);

    case 'blocker': {
      const r = await api('rules');
      const blocked = r.filter((x) => x.blockInFocus || x.blockInMeeting || x.blockInBreak || x.alwaysBlock);
      return group('', [
        row('Distraction blocker', 'Interrupt me when I open a blocked app or website during a session.', sw('distractionBlockingEnabled')),
        row('How to interrupt', 'A window covers the screen, or a notification appears.', pick('distractionBlockingType', [['window', 'Full-screen window'], ['notification', 'Notification']])),
        row('Urge surfing', 'Lock the blocker window for 10 seconds. Breathe before you choose.', sw('distractionBlockingUrgeSurfingEnabled')),
        row('Interrupt after', 'Time on a blocked app before the blocker appears, and between repeats.', pick('refocusThreshold', [[0, 'Right away'], [30, '30 sec'], [60, '1 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']])),
        row('Snooze length', 'Used by "Snooze" in the blocker window.', minutes('defaultSnoozeTime', [5, 10, 15, 30])),
      ]) + `<div class="card"><div class="card-head"><span class="label">Blocked apps &amp; websites</span><a href="#settings/rules" data-go="rules" class="row" style="gap:6px;font-size:12.5px">Edit in rules ${icon('arrow-up-right', 13)}</a></div>
        ${blocked.length ? `<div class="chips">${blocked.map((x) => `<span class="chip"><span class="dot" style="background:${catColor(x.category)}"></span>${esc(x.name)}<span class="silent">${[x.alwaysBlock && 'always', x.blockInFocus && 'focus', x.blockInMeeting && 'meetings', x.blockInBreak && 'breaks'].filter(Boolean).join(', ')}</span></span>`).join('')}</div>`
          : '<div class="silent">Nothing is blocked. Turn on "Block during focus" for a rule.</div>'}</div>`;
    }

    case 'hours': {
      const t = s.workHoursTargets;
      const order = [1, 2, 3, 4, 5, 6, 0];
      const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const total = t.reduce((a, b) => a + b, 0);
      return `<div class="card"><div class="card-head"><div><div class="label">Daily work hours targets</div><div class="silent" style="font-size:12px;margin-top:2px">Home shows progress against today's target. Mark a day as PTO from the Home summary.</div></div><span class="mid tnum">${durText(total)}<span class="silent" style="font-size:12px;font-weight:400"> / week</span></span></div>
        ${order.map((d) => `<div class="setting" style="padding:10px 0"><div class="row" style="gap:12px"><span class="switch"><input type="checkbox" data-day="${d}" ${t[d] ? 'checked' : ''}><i></i></span><span style="color:var(--text-strong);width:110px">${names[d]}</span></div>
          <div class="row" style="gap:8px"><input class="input tnum" type="number" min="0" max="24" step="0.5" data-hrs="${d}" value="${t[d] / 3600}" ${t[d] ? '' : 'disabled'} style="width:84px;text-align:right"><span class="silent">hours</span></div></div>`).join('')}</div>`;
    }

    case 'rules': return rulesView();

    case 'shortcut': return group('Keyboard', [
      row('Quick start shortcut', 'Open the quick start window from any app.', sw('globalShortcutEnabled')),
      row('Shortcut keys', 'Electron accelerator format, for example CommandOrControl+Shift+E.', `<input class="input mono" id="accel" value="${esc(s.globalShortcutAccelerator)}" style="width:240px">`),
    ]) + group('Desktop widget', [
      row('Show widget', 'A small timer in the top-right corner, above other windows. Right-click it for controls.', sw('widgetEnabled')),
      row('Auto-hide on hover', 'Fade the widget while the pointer is over it.', sw('widgetAutoHide')),
    ]);

    case 'data': return group('', [
      row('Export time entries', 'CSV with start, end, hours, client, project, task, billable and amount.', `<button class="btn sm" data-go="reports">${icon('chart-column', 14)}Open Reports</button>`),
      row('Rules file', 'Edit rules.json by hand. Cadence reloads it on each tick.', `<button class="btn sm" id="rulesfile">${icon('external-link', 14)}Open rules.json</button>`),
    ]) + `<div class="silent" style="font-size:12px;padding:0 4px">Data folder: activity in <span class="mono">events/YYYY-MM-DD.jsonl</span>, records in <span class="mono">db.json</span>, preferences in <span class="mono">settings.json</span>.</div>`;
  }
  return '';
}

function updateText(u) {
  if (!u.packaged) return 'Development build. Updates work only in the installed app.';
  return { checking: 'Checking for updates…', downloading: `Downloading ${esc(u.version || 'update')}… ${u.percent || 0}%`, ready: `Version ${esc(u.version)} is ready. Restart to install it.`,
    current: 'You have the latest version.', error: `Update failed: ${esc(u.error || 'unknown error')}. You can download the new version from GitHub.` }[u.status] || 'Cadence checks GitHub Releases for new versions.';
}
const updateButton = (u) => u.status === 'ready' ? `<button class="btn accent sm" data-upd="installUpdate">${icon('download', 14)}Restart to update</button>`
  : u.status === 'error' ? `<button class="btn sm" data-upd="openReleases">${icon('external-link', 14)}Open releases</button>`
  : `<button class="btn sm" data-upd="checkForUpdates" ${u.status === 'checking' || u.status === 'downloading' ? 'disabled' : ''}>Check now</button>`;

async function rulesView() {
  rules = await api('rules');
  const list = rules.map((r, i) => ({ r, i })).filter(({ r }) => !rq || `${r.name} ${r.hostKey || ''} ${r.category}`.toLowerCase().includes(rq));
  return `<div class="toolbar" style="margin:0"><label class="input" style="display:flex;align-items:center;gap:8px;flex:1">${icon('search', 15)}<input id="rq" placeholder="Search ${rules.length} rules" value="${esc(rq)}" style="border:0;background:none;outline:0;color:inherit;flex:1;font:inherit"></label>
    <button class="btn accent sm" id="addrule">${icon('plus', 14)}Add rule</button></div>
    <div class="silent" style="font-size:12px;padding:0 4px">Rules label apps and websites. The most specific match wins. Unmatched apps are Miscellaneous.</div>
    <div class="card flush">${list.map(({ r, i }) => `<div class="list-row" data-rule="${i}" style="grid-template-columns:minmax(0,1fr) 150px minmax(0,1fr) 28px;cursor:pointer">
      <div class="ellipsis"><div style="color:var(--text-strong)">${esc(r.name)}</div><div class="silent mono ellipsis" style="font-size:11px">${esc(r.url || r.app || r.title || '')}</div></div>
      <span class="row" style="gap:7px"><span class="dot" style="background:${catColor(r.category)}"></span>${esc(catLabel(r.category))}</span>
      <span class="silent ellipsis" style="font-size:12px">${FLAGS.filter(([k]) => k !== 'trackTitles' && k !== 'trackFullUrl' && k !== 'detectIdle' && r[k]).map(([, t]) => t).join(' · ') || ''}${r.detectIdle === false ? ' · No idle' : ''}</span>
      <span class="silent">${icon('chevron-right', 15)}</span></div>`).join('')}</div>`;
}

function editRule(i) {
  const r = i == null ? { name: '', category: 'miscellaneous', detectIdle: true, trackTitles: true, trackFullUrl: true } : rules[i];
  modal({ title: i == null ? 'Add rule' : `Edit rule · ${r.name}`, body: ruleForm(r), wide: true, actions: [
    ...(i == null ? [] : [{ label: 'Delete', kind: 'danger', style: 'margin-right:auto', onClick: async () => {
      if (!(await confirmBox('Delete rule?', `${r.name} will count as Miscellaneous.`))) return;
      rules.splice(i, 1); await api('saveRules', rules); draw();
    } }]),
    { label: 'Cancel' },
    { label: 'Save rule', kind: 'accent', onClick: async (m) => {
      const next = readRuleForm(m, r);
      if (!next.name || !(next.app || next.url)) { notice('Add a name and an app or URL pattern'); return false; }
      next.hostKey ||= next.name;
      const copy = [...rules];
      if (i == null) copy.unshift(next); else copy[i] = next;
      try { await api('saveRules', copy); } catch (e) { notice(String(e.message || e).replace(/^.*Error: /, '')); return false; }
      draw();
    } },
  ] });
}

function wire() {
  $$('[data-k]', el).forEach((c) => c.onchange = () => save({ [c.dataset.k]: c.checked }));
  $$('[data-min]', el).forEach((c) => c.onchange = () => save({ [c.dataset.min]: Number(c.value) * 60 }));
  $$('[data-pick]', el).forEach((c) => c.onchange = () => { const n = Number(c.value); save({ [c.dataset.pick]: Number.isNaN(n) ? c.value : n }); });
  $$('[data-theme]', el).forEach((b) => b.onclick = () => save({ theme: b.dataset.theme }).then(draw));
  $$('[data-perm]', el).forEach((b) => b.onclick = () => api('openPermissions', b.dataset.perm));
  $$('[data-upd]', el).forEach((b) => b.onclick = () => api(b.dataset.upd));
  $$('[data-go]', el).forEach((a) => a.onclick = (e) => { e.preventDefault(); const g = a.dataset.go; if (g === 'reports') location.hash = 'reports'; else { sec = g; history.replaceState(null, '', `#settings/${g}`); draw(); } });
  $('#rulesfile', el)?.addEventListener('click', () => api('openRulesFile'));
  $('#accel', el)?.addEventListener('change', (e) => save({ globalShortcutAccelerator: e.target.value.trim() }).then(() => notice('Shortcut updated')));
  // Work hours
  const targets = () => {
    const t = [...S().workHoursTargets];
    $$('[data-day]', el).forEach((c) => { const d = Number(c.dataset.day), h = Number($(`[data-hrs="${d}"]`, el).value); t[d] = c.checked ? Math.round(Math.max(0, Math.min(24, h || 8)) * 3600) : 0; });
    return t;
  };
  $$('[data-day],[data-hrs]', el).forEach((c) => c.onchange = () => save({ workHoursTargets: targets() }).then(draw));
  // Rules
  $$('[data-rule]', el).forEach((r) => r.onclick = () => editRule(Number(r.dataset.rule)));
  $('#addrule', el)?.addEventListener('click', () => editRule(null));
  const qi = $('#rq', el);
  if (qi) qi.oninput = async () => { rq = qi.value.trim().toLowerCase(); const p = qi.selectionStart; await draw(); const n = $('#rq', el); n.focus(); n.setSelectionRange(p, p); };
}
void CATS;
