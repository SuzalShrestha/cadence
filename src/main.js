// Cadence: local-first clone of the Rize desktop tracker.
const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, ipcMain, nativeImage, nativeTheme, powerMonitor, screen, shell, dialog, systemPreferences } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./core');
const { TICK_MS, Idler, Segmenter, matchRule, isBlockRule, clock, hrMin, focusScore, focusLabel, detectSessions, summarize, appsInRange, suggestEntries, overlap } = core;
const { getActiveApp } = require('./active');
const createStore = require('./store');

if (process.env.CADENCE_DATA) app.setPath('userData', process.env.CADENCE_DATA);
if (!app.requestSingleInstanceLock()) app.quit();

const UI = (f) => path.join(__dirname, 'ui', f);
const PRELOAD = path.join(__dirname, 'preload.js');
const now = () => Math.floor(Date.now() / 1000);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

let store, settings, db;
let session = null;                 // running session: { type, start, stop, title, projectId, source, plannedId }
let lastBreakEnd = now();
let locked = false, suspended = false;
let current = { app: null, rule: null, at: 0 };
let todayKey = null, todayActive = 0;
const flags = { notified: new Set(), started: new Set(), target: new Set(), lastReminder: 0 };
let blocker = { since: null, snoozeUntil: 0, nonInterrupting: [], unblocked: [], disabled: false };
let tray, dashboard, widget, quick, toastWin, overlays = [], overlayInfo = null, toastInfo = null;
let tickTimer = null, ticking = false;
const dayCache = new Map();         // summaries of past days

const idler = new Idler();
const seg = new Segmenter((ev) => {
  store.appendEvent(ev);
  dayCache.delete(store.dayKey(new Date(ev.startTimestamp * 1000)));
  if (ev.idle && settings.autoBreakDetection) lastBreakEnd = Math.max(lastBreakEnd, ev.endTimestamp);
  if (!ev.idle && store.dayKey(new Date(ev.startTimestamp * 1000)) === todayKey) todayActive += ev.endTimestamp - ev.startTimestamp;
  broadcast();
});

// ---------------------------------------------------------------- tracker (Rize Tracker.track)
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const time = new Date();
    rollDay();
    const idle = idler.update(powerMonitor.getSystemIdleTime(), time);
    if (idle.idleStopped && settings.autoBreakDetection) lastBreakEnd = now();
    if (!settings.trackingEnabled || locked || suspended) { seg.close(time); return; }
    const activeApp = await getActiveApp();
    const rule = activeApp ? matchRule(activeApp, store.rules()) : null;
    const skipIdle = !!rule && rule.detectIdle === false;
    seg.tick({ time, ...idle, app: activeApp, rule, skipIdle });
    current = { app: activeApp, rule, at: now(), idle: idle.idle };
    checkBlocker(rule);
    checkPlanner();
    checkReminders(idle);
  } catch (e) {
    console.error('[Tracker] tick failed', e);
  } finally {
    ticking = false;
    clearTimeout(tickTimer);
    tickTimer = setTimeout(tick, TICK_MS);
  }
}
const restartTick = () => { seg.clear(); clearTimeout(tickTimer); tick(); };

function rollDay() {
  const k = store.dayKey(new Date());
  if (k === todayKey) return;
  todayKey = k;
  todayActive = store.events(k).filter((e) => !e.idle).reduce((a, e) => a + e.endTimestamp - e.startTimestamp, 0);
}

// ---------------------------------------------------------------- sessions (Rize Session State)
const LENGTH = { focus: 'defaultFocusSessionTime', meeting: 'defaultMeetingSessionTime', break: 'defaultBreakSessionTime' };

function startSession(type, opts = {}) {
  if (!LENGTH[type]) return;
  if (session) stopSession();
  const t = now();
  const length = Math.max(60, Math.min(8 * 3600, Number(opts.length) || settings[LENGTH[type]]));
  session = { type, start: t, stop: t + length, title: opts.title ? String(opts.title).slice(0, 200) : '', projectId: opts.projectId || null, source: opts.source || 'manual', plannedId: opts.plannedId || null };
  blocker = { ...blocker, since: null, nonInterrupting: [], unblocked: [], disabled: false };
  if (type === 'break' && settings.fullScreenBreakEnabled) showOverlays('break');
  broadcast();
}

function stopSession() {
  if (!session) return null;
  const t = now(), s = session;
  session = null;
  const stop = Math.min(t, s.stop);
  let score = null;
  if (s.type === 'focus') score = focusScore(eventsBetween(s.start, stop), s.start, stop);
  const rec = stop - s.start >= 30 ? store.save('sessions', { type: s.type, start: s.start, stop, title: s.title, projectId: s.projectId, source: s.source, score }) : null;
  if (s.type === 'break') lastBreakEnd = t;
  closeOverlays();
  if (rec && s.type === 'focus' && stop - s.start >= 300 && settings.toasterEnabled) showToast({ kind: 'session', id: rec.id });
  dayCache.delete(store.dayKey(new Date(s.start * 1000)));
  broadcast();
  return rec;
}

function extendSession(secs) { if (session) { session.stop += Math.max(60, Math.min(3600, Number(secs) || 300)); broadcast(); } }

function eventsBetween(a, b) {
  const keys = new Set([store.dayKey(new Date(a * 1000)), store.dayKey(new Date(b * 1000))]);
  return [...keys].flatMap((k) => store.events(k)).filter((e) => overlap(e.startTimestamp, e.endTimestamp, a, b) > 0);
}

// ---------------------------------------------------------------- planner, reminders, target
function notify(title, body, onClick) {
  const n = new Notification({ title, body, silent: false });
  if (onClick) n.on('click', onClick);
  n.show();
}

function checkPlanner() {
  const t = now();
  for (const p of db.planned) {
    const lead = settings.plannedNotifyMinutes * 60;
    if (lead && !flags.notified.has(p.id) && t >= p.start - lead && t < p.start) {
      flags.notified.add(p.id);
      notify(`${cap(p.type)} session in ${Math.round((p.start - t) / 60)} min`, p.title || 'Planned session', () => openDashboard('timer'));
    }
    if (!flags.started.has(p.id) && t >= p.start && t < p.stop) {
      flags.started.add(p.id);
      const start = () => startSession(p.type, { length: p.stop - now(), title: p.title, projectId: p.projectId, source: 'planned', plannedId: p.id });
      if (settings.autoStartPlannedSessions) start();
      else notify(`Planned ${p.type} session starts now`, 'Click to start it.', start);
    }
  }
}

function checkReminders(idle) {
  const t = now();
  const mins = settings.breakReminderMinutes;
  if (mins && !session && !idle.idle && t - lastBreakEnd >= mins * 60 && t - flags.lastReminder >= mins * 60) {
    flags.lastReminder = t;
    notify('Time for a break?', `You have worked for ${hrMin(t - lastBreakEnd)} without a break. Click to start one.`, () => startSession('break'));
  }
  const target = store.target(todayKey);
  if (target && todayActive >= target && !flags.target.has(todayKey)) {
    flags.target.add(todayKey);
    if (settings.toasterEnabled) showToast({ kind: 'day', key: todayKey });
    else notify('Work hours target reached', `${hrMin(todayActive)} tracked today.`);
  }
}

// ---------------------------------------------------------------- distraction blocker (Rize Blocker.check)
const ruleKey = (r) => r?.hostKey || r?.name;
function checkBlocker(rule) {
  if (!settings.distractionBlockingEnabled || blocker.disabled || Date.now() < blocker.snoozeUntil || overlays.length) return;
  if (!isBlockRule(rule, session?.type) || blocker.unblocked.includes(ruleKey(rule))) { blocker.since = null; return; }
  blocker.since ??= Date.now();
  if (blocker.nonInterrupting.includes(rule.category)) return;
  if (Date.now() - blocker.since < settings.refocusThreshold * 1000) return;
  blocker.since = Date.now();
  if (settings.distractionBlockingType === 'notification') notify('Getting distracted?', `${rule.name} is blocked during ${session?.type || 'work'} time.`);
  else showOverlays('block', rule);
}

function overlayAction(action) {
  const rule = overlayInfo?.rule;
  closeOverlays();
  switch (action) {
    case 'thanks': blocker.since = Date.now(); break;
    case 'notDistraction': if (rule) blocker.unblocked.push(rule.key); break;
    case 'disableForSession': blocker.disabled = true; break;
    case 'snooze': blocker.snoozeUntil = Date.now() + settings.defaultSnoozeTime * 1000; break;
    case 'settings': openDashboard('settings/blocker'); break;
    case 'end': stopSession(); break;
    case 'extend': extendSession(300); showOverlays('break'); break;
    case 'disableBreakScreen': saveSettings({ fullScreenBreakEnabled: false }); break;
  }
}

// ---------------------------------------------------------------- windows
const secureWeb = { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false };
const bg = () => (nativeTheme.shouldUseDarkColors ? '#121117' : '#f7f7fc');

function openDashboard(route) {
  if (dashboard) {
    if (route) dashboard.webContents.send('route', route);
    dashboard.show(); dashboard.focus();
    return;
  }
  dashboard = new BrowserWindow({
    width: 1360, height: 880, minWidth: 980, minHeight: 620, show: false, title: 'Cadence',
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 }, backgroundColor: bg(), webPreferences: secureWeb,
  });
  dashboard.loadFile(UI('app.html'), route ? { hash: route } : undefined);
  dashboard.once('ready-to-show', () => dashboard.show());
  dashboard.on('closed', () => { dashboard = null; });
}

function showOverlays(mode, rule) {
  closeOverlays();
  overlayInfo = { mode, urgeSurfing: settings.distractionBlockingUrgeSurfingEnabled, rule: rule ? { name: rule.name, category: rule.category, key: ruleKey(rule) } : null };
  for (const d of screen.getAllDisplays()) {
    const w = new BrowserWindow({
      ...d.bounds, frame: false, alwaysOnTop: true, movable: false, resizable: false, show: false, skipTaskbar: true,
      visibleOnAllWorkspaces: true, backgroundColor: '#0c0b10', webPreferences: secureWeb,
    });
    w.setAlwaysOnTop(true, 'screen-saver');
    w.once('ready-to-show', () => w.show());
    w.loadFile(UI('overlay.html'));
    overlays.push(w);
  }
}
function closeOverlays() {
  for (const w of overlays) if (!w.isDestroyed()) w.destroy();
  overlays = [];
  overlayInfo = null;
}

// Desktop widget (Rize "Widget"): floats top-right over all windows.
function toggleWidget(show = settings.widgetEnabled) {
  if (!show) { widget?.destroy(); widget = null; return; }
  if (widget) return;
  const wa = screen.getPrimaryDisplay().workArea;
  widget = new BrowserWindow({
    width: 248, height: 64, x: wa.x + wa.width - 264, y: wa.y + 12, frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, focusable: false, fullscreenable: false, show: false, webPreferences: secureWeb,
  });
  widget.setAlwaysOnTop(true, 'floating');
  widget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widget.loadFile(UI('widget.html'));
  widget.once('ready-to-show', () => widget.showInactive());
  widget.on('closed', () => { widget = null; });
}

// Quick start window (Rize "Shortcut" window, 480x360 frameless).
function toggleQuick() {
  if (quick?.isVisible()) return quick.hide();
  if (!quick) {
    quick = new BrowserWindow({ width: 460, height: 400, frame: false, resizable: false, show: false, skipTaskbar: true, alwaysOnTop: true, backgroundColor: bg(), webPreferences: secureWeb });
    quick.loadFile(UI('quick.html'));
    quick.on('blur', () => quick?.hide());
    quick.on('closed', () => { quick = null; });
    quick.once('ready-to-show', () => { quick.center(); quick.show(); });
    return;
  }
  quick.webContents.send('changed');
  quick.center(); quick.show(); quick.focus();
}

// Toaster (Rize "Toaster"): session summary with focus score + rating, or daily summary.
function showToast(info) {
  toastInfo = info;
  toastWin?.destroy();
  const wa = screen.getPrimaryDisplay().workArea;
  toastWin = new BrowserWindow({
    width: 360, height: 236, x: wa.x + wa.width - 376, y: wa.y + wa.height - 252, frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, focusable: false, hasShadow: false, webPreferences: secureWeb,
  });
  toastWin.setAlwaysOnTop(true, 'floating');
  toastWin.loadFile(UI('toast.html'));
  toastWin.once('ready-to-show', () => toastWin?.showInactive());
  toastWin.on('closed', () => { toastWin = null; });
}

function controlMenu() {
  const s = !!session;
  return [
    { label: s ? `${cap(session.type)} · ${clock(session.stop - now())} left` : `Since last break · ${clock(now() - lastBreakEnd)}`, enabled: false },
    { type: 'separator' },
    ...(s ? [
      { label: 'Extend by 5 min', click: () => extendSession(300) },
      { label: `End ${session.type} session`, click: stopSession },
    ] : [
      { label: 'Start Focus Session', click: () => startSession('focus') },
      { label: 'Start Meeting', click: () => startSession('meeting') },
      { label: 'Take a Break', click: () => startSession('break') },
    ]),
    { label: 'Quick Start…', accelerator: settings.globalShortcutEnabled ? settings.globalShortcutAccelerator : undefined, click: toggleQuick },
    { type: 'separator' },
    { label: settings.trackingEnabled ? 'Pause Tracking' : 'Resume Tracking', click: () => saveSettings({ trackingEnabled: !settings.trackingEnabled }) },
    { label: 'Show Dashboard', click: () => openDashboard() },
    { label: 'Widget', submenu: [
      { label: 'Show on Desktop', type: 'checkbox', checked: settings.widgetEnabled, click: () => saveSettings({ widgetEnabled: !settings.widgetEnabled }) },
      { label: 'Auto-hide on Mouse Hover', type: 'checkbox', checked: settings.widgetAutoHide, click: () => saveSettings({ widgetAutoHide: !settings.widgetAutoHide }) },
      { label: 'Hide for 30 Minutes', enabled: !!widget, click: () => { widget?.hide(); setTimeout(() => widget?.showInactive(), 30 * 60e3); } },
    ] },
    { label: 'Settings…', click: () => openDashboard('settings') },
    { type: 'separator' },
    { label: 'Quit Cadence', role: 'quit' },
  ];
}

function broadcast(channel = 'changed') {
  for (const w of [dashboard, widget, quick, toastWin, ...overlays]) if (w && !w.isDestroyed()) w.webContents.send(channel);
}

function saveSettings(patch) {
  const before = { ...settings };
  store.saveSettings(patch);
  if (before.trackingEnabled !== settings.trackingEnabled) restartTick();
  applySettings(before);
  broadcast();
}

function applySettings(before = {}) {
  seg.privacy = { stripTitles: settings.stripTrackedTitlesEnabled, urlHostOnly: settings.urlHostOnlyEnabled, doNotTrackAnyUrls: settings.doNotTrackAnyUrlsGlobal };
  nativeTheme.themeSource = settings.theme;
  if (before.globalShortcutAccelerator !== settings.globalShortcutAccelerator || before.globalShortcutEnabled !== settings.globalShortcutEnabled) {
    globalShortcut.unregisterAll();
    if (settings.globalShortcutEnabled) { try { globalShortcut.register(settings.globalShortcutAccelerator, toggleQuick); } catch {} }
  }
  if (before.widgetEnabled !== settings.widgetEnabled) toggleWidget();
  if (before.openAtLogin !== settings.openAtLogin && app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
}

// ---------------------------------------------------------------- read models
function daySessions(key, events) {
  const [a, b] = store.dayBounds(key);
  const manual = db.sessions.filter((s) => overlap(s.start, s.stop, a, b) > 0);
  const live = session && overlap(session.start, now(), a, b) > 0 ? [{ ...session, stop: now(), live: true, plannedStop: session.stop }] : [];
  let auto = detectSessions(events, [...manual, ...live]);
  if (!settings.autoBreakDetection) auto = auto.filter((s) => s.type !== 'break');
  return [...manual, ...live, ...auto]
    .map((s) => ({ ...s, score: s.type === 'focus' ? (s.score ?? focusScore(events, s.start, s.stop)) : null }))
    .sort((x, y) => x.start - y.start);
}

function daySummary(key) {
  const today = key === todayKey;
  if (!today && dayCache.has(key)) return dayCache.get(key);
  const events = store.events(key);
  const sessions = daySessions(key, events);
  const s = { key, target: store.target(key), pto: db.pto.includes(key), ...summarize(events, sessions) };
  delete s.blocks;
  if (!today) dayCache.set(key, s);
  return s;
}

const keysBetween = (from, to) => {
  const out = [];
  const [y, m, d] = from.split('-').map(Number);
  for (let t = new Date(y, m - 1, d); store.dayKey(t) <= to && out.length < 400; t.setDate(t.getDate() + 1)) out.push(store.dayKey(t));
  return out;
};
const KEY = /^\d{4}-\d{2}-\d{2}$/;
const checkKey = (k) => { if (!KEY.test(k)) throw new Error('bad date'); return k; };
const nameOf = (kind, id) => db[kind].find((x) => x.id === id);

function entryRate(e) {
  const t = nameOf('tasks', e.taskId), p = nameOf('projects', e.projectId || t?.projectId), c = nameOf('clients', e.clientId || p?.clientId);
  return p?.rate ?? c?.rate ?? 0;
}

const api = {
  state: () => ({
    session, settings, lastBreakEnd, now: now(), todayKey, todayActive, target: store.target(todayKey),
    current: { app: current.app, rule: current.rule && { name: current.rule.name, category: current.rule.category }, idle: current.idle },
    overlay: overlayInfo, toast: toastInfo, platform: process.platform, version: app.getVersion(),
    permissions: { accessibility: process.platform !== 'darwin' || systemPreferences.isTrustedAccessibilityClient(false), tracking: !!current.app || !current.at },
  }),

  day(key) {
    checkKey(key);
    const events = store.events(key);
    const sessions = daySessions(key, events);
    const [a, b] = store.dayBounds(key);
    const entries = db.entries.filter((e) => overlap(e.start, e.stop, a, b) > 0);
    const prev = new Date(a * 1000 - 86400e3);
    const week = Array.from({ length: 7 }, (_, i) => daySummary(store.dayKey(new Date(a * 1000 - (i + 1) * 86400e3))));
    const avgFocus = week.reduce((x, d) => x + d.focus, 0) / 7;
    return {
      key, events: events.map((e) => ({ s: e.startTimestamp, e: e.endTimestamp, a: e.appName, t: e.title, u: e.url, c: e.category, i: e.idle || undefined })),
      sessions, entries, planned: db.planned.filter((p) => overlap(p.start, p.stop, a, b) > 0),
      suggestions: suggestEntries(events, db, db.entries, db.dismissed),
      summary: { ...summarize(events, sessions), target: store.target(key), pto: db.pto.includes(key) },
      yesterday: daySummary(store.dayKey(prev)).active, avgFocus,
    };
  },

  range(from, to) {
    checkKey(from); checkKey(to);
    const days = keysBetween(from, to).map(daySummary);
    const cats = new Map();
    for (const d of days) for (const c of d.categories) cats.set(c.name, (cats.get(c.name) || 0) + c.secs);
    const [a] = store.dayBounds(from), [, b] = store.dayBounds(to);
    const entries = db.entries.filter((e) => overlap(e.start, e.stop, a, b) > 0);
    return { days, categories: [...cats].sort((x, y) => y[1] - x[1]).map(([name, secs]) => ({ name, secs })), entries };
  },

  apps(start, stop) { return appsInRange(eventsBetween(Number(start), Number(stop)), Number(start), Number(stop)).slice(0, 8); },

  activity(key) {
    checkKey(key);
    const events = store.events(key);
    const rows = new Map();
    for (const e of events) {
      if (e.idle) continue;
      let host = null;
      try { host = e.url && new URL(e.url).hostname.replace(/^www\./, ''); } catch {}
      const name = host || e.appName;
      const r = rows.get(name) || { name, kind: host ? 'site' : 'app', app: e.appName, category: e.category, rule: e.ruleName, secs: 0, titles: new Map() };
      const d = e.endTimestamp - e.startTimestamp;
      r.secs += d;
      if (e.title) r.titles.set(e.title, (r.titles.get(e.title) || 0) + d);
      rows.set(name, r);
    }
    const list = [...rows.values()].sort((x, y) => y.secs - x.secs)
      .map((r) => ({ ...r, titles: [...r.titles].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([title, secs]) => ({ title, secs })) }));
    const log = events.slice(-400).reverse().map((e) => ({ s: e.startTimestamp, e: e.endTimestamp, a: e.appName, t: e.title, u: e.url, c: e.category, i: e.idle || undefined }));
    return { rows: list, log };
  },

  report({ from, to, groupBy }) {
    checkKey(from); checkKey(to);
    const [a] = store.dayBounds(from), [, b] = store.dayBounds(to);
    const keys = keysBetween(from, to);
    const rows = new Map();
    const daily = new Map(keys.map((k) => [k, 0]));
    const bump = (id, name, color, secs, billable, amount, k) => {
      const r = rows.get(id) || { id, name, color, secs: 0, billable: 0, amount: 0 };
      r.secs += secs; r.billable += billable; r.amount += amount;
      rows.set(id, r);
      if (daily.has(k)) daily.set(k, daily.get(k) + secs);
    };
    if (['project', 'client', 'task'].includes(groupBy)) {
      for (const e of db.entries) {
        const secs = overlap(e.start, e.stop, a, b);
        if (!secs) continue;
        const t = nameOf('tasks', e.taskId), p = nameOf('projects', e.projectId || t?.projectId), c = nameOf('clients', e.clientId || p?.clientId);
        const target = groupBy === 'project' ? p : groupBy === 'client' ? c : t;
        const bill = e.billable ? secs : 0;
        bump(target?.id || 'none', target?.name || `No ${groupBy}`, target?.color || p?.color || null, secs, bill, (bill / 3600) * entryRate(e), store.dayKey(new Date(e.start * 1000)));
      }
    } else {
      for (const k of keys) for (const e of store.events(k)) {
        if (e.idle) continue;
        const secs = e.endTimestamp - e.startTimestamp;
        const name = groupBy === 'app' ? e.appName : e.category;
        bump(name, name, null, secs, 0, 0, k);
      }
    }
    return { rows: [...rows.values()].sort((x, y) => y.secs - x.secs), daily: [...daily].map(([key, secs]) => ({ key, secs })) };
  },

  list: (kind) => store.list(kind),
  save(kind, obj) { const r = store.save(kind, obj); dayCache.clear(); broadcast(); return r; },
  remove(kind, id) { store.remove(kind, id); dayCache.clear(); broadcast(); },
  acceptSuggestion(s) { const r = store.save('entries', { ...s, billable: true, status: 'approved' }); broadcast(); return r; },
  dismissSuggestion(id) { store.dismiss(id); broadcast(); },

  startSession: (type, opts) => startSession(type, opts || {}),
  stopSession: () => stopSession(),
  extendSession: (secs) => extendSession(secs),
  updateSession(patch = {}) { if (session) { if ('title' in patch) session.title = String(patch.title || '').slice(0, 200); if ('projectId' in patch) session.projectId = patch.projectId || null; broadcast(); } },
  rateSession(id, rating) { const s = nameOf('sessions', id); if (s) store.save('sessions', { id, rating: Math.max(1, Math.min(5, Number(rating))) }); },

  pomodoro() { // docs: 25 focus / 5 break, 20 min long break after 4
    let t = Math.ceil(now() / 60) * 60;
    const add = (type, mins, title) => { store.save('planned', { type, start: t, stop: t + mins * 60, title }); t += mins * 60; };
    for (let i = 1; i <= 4; i++) { add('focus', 25, `Pomodoro ${i}`); add('break', i === 4 ? 20 : 5, i === 4 ? 'Long break' : 'Short break'); }
    flags.started.clear();
    broadcast();
  },
  clearPlanned() {
    for (const p of [...db.planned]) if (p.stop >= now()) store.remove('planned', p.id);
    broadcast();
  },

  rules: () => store.rules(),
  saveRules(list) { store.saveRules(list); broadcast(); },
  saveSettings: (patch) => { saveSettings(patch); return settings; },
  setPto(key, on) { store.setPto(checkKey(key), !!on); dayCache.delete(key); broadcast(); },

  async exportCsv({ from, to }) {
    checkKey(from); checkKey(to);
    const [a] = store.dayBounds(from), [, b] = store.dayBounds(to);
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const iso = (t) => new Date(t * 1000).toISOString();
    const lines = [['Start', 'End', 'Hours', 'Description', 'Client', 'Project', 'Task', 'Billable', 'Amount'].join(',')];
    for (const e of db.entries.filter((x) => overlap(x.start, x.stop, a, b) > 0).sort((x, y) => x.start - y.start)) {
      const t = nameOf('tasks', e.taskId), p = nameOf('projects', e.projectId || t?.projectId), c = nameOf('clients', e.clientId || p?.clientId);
      const h = (e.stop - e.start) / 3600;
      lines.push([iso(e.start), iso(e.stop), h.toFixed(2), q(e.description), q(c?.name), q(p?.name), q(t?.name), e.billable ? 'yes' : 'no', (e.billable ? h * entryRate(e) : 0).toFixed(2)].join(','));
    }
    const { filePath, canceled } = await dialog.showSaveDialog(dashboard, { defaultPath: `cadence-${from}-to-${to}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
    return { path: filePath, rows: lines.length - 1 };
  },

  openPermissions(kind) {
    const pane = kind === 'automation' ? 'Privacy_Automation' : 'Privacy_Accessibility';
    if (kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true);
    shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`);
  },
  overlay: (action) => overlayAction(action),
  menu(where) { Menu.buildFromTemplate(controlMenu()).popup({ window: where === 'widget' ? widget : dashboard }); },
  showDashboard: (route) => openDashboard(route),
  toggleQuick: () => toggleQuick(),
  closeToast() { toastWin?.destroy(); },
  openRulesFile: () => shell.openPath(store.path('rules.json')),
};

ipcMain.handle('api', (e, method, ...args) => {
  if (!e.senderFrame?.url.startsWith('file://')) throw new Error('blocked');
  if (!Object.hasOwn(api, method)) throw new Error(`unknown method ${method}`);
  return api[method](...args);
});

// ---------------------------------------------------------------- lifecycle
app.on('second-instance', () => openDashboard());
app.on('window-all-closed', () => {}); // keep running in the menu bar
app.on('activate', () => openDashboard());
app.on('will-quit', () => { seg.close(new Date()); stopSession(); store.flush(); globalShortcut.unregisterAll(); });

app.whenReady().then(() => {
  store = createStore(app.getPath('userData'), path.join(__dirname, 'rules.default.json'));
  settings = store.settings;
  db = store.db;
  rollDay();
  // "Since break" starts at today's last break (idle run of 5+ min or break session), else at the first activity.
  const evs = store.events(todayKey);
  let run = null, brk = 0;
  for (const e of evs) {
    if (!e.idle) continue;
    run = run && e.startTimestamp - run.e <= 60 ? { s: run.s, e: e.endTimestamp } : { s: e.startTimestamp, e: e.endTimestamp };
    if (run.e - run.s >= 300) brk = run.e;
  }
  for (const x of db.sessions) if (x.type === 'break' && store.dayKey(new Date(x.stop * 1000)) === todayKey) brk = Math.max(brk, x.stop);
  lastBreakEnd = brk || evs.find((e) => !e.idle)?.startTimestamp || now();
  applySettings();

  powerMonitor.on('lock-screen', () => { locked = true; seg.close(new Date()); });
  powerMonitor.on('unlock-screen', () => { locked = false; restartTick(); });
  powerMonitor.on('suspend', () => { suspended = true; seg.close(new Date()); });
  powerMonitor.on('resume', () => { suspended = false; restartTick(); });
  nativeTheme.on('updated', () => broadcast());

  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('Cadence');
  tray.on('click', () => tray.popUpContextMenu(Menu.buildFromTemplate(controlMenu())));
  tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate(controlMenu())));

  setInterval(() => {
    if (session && now() >= session.stop) {
      const type = session.type;
      stopSession();
      if (type !== 'focus' || !settings.toasterEnabled) notify(`${cap(type)} session complete`, type === 'break' ? 'Welcome back.' : 'Good time for a break.');
    }
    if (process.platform === 'darwin') tray.setTitle(session ? `${clock(session.stop - now())}` : settings.trackingEnabled ? clock(now() - lastBreakEnd) : 'Paused', { fontType: 'monospacedDigit' });
  }, 1000);

  openDashboard();
  tick();

  if (process.env.CADENCE_SMOKE) require('./smoke')({ app, api, getWindow: (n) => ({ dashboard, widget, quick, toast: toastWin, overlay: overlays[0] })[n], startSession, showToast, showOverlays, toggleQuick, matchRule });
}).catch((e) => { console.error('[Cadence] startup failed', e); dialog.showErrorBox('Cadence could not start', String(e?.stack || e)); app.exit(1); });
