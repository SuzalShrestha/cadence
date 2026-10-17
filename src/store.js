// Local storage: settings.json, rules.json, db.json (mutable records), events/YYYY-MM-DD.jsonl (append-only activity).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeRule } = require('./core');

const H = 3600;
// Defaults observed in Rize "Identity State" / "Tracker State" unless marked "local".
const DEFAULTS = {
  trackingEnabled: true,
  productivityMode: false,                    // local: off = just track; no "since break", break reminders or target nudges
  theme: 'dark',                              // local: 'dark' | 'light' | 'system'
  defaultFocusSessionTime: 2700,
  defaultMeetingSessionTime: 1800,
  defaultBreakSessionTime: 300,
  defaultSnoozeTime: 300,
  distractionBlockingEnabled: true,
  distractionBlockingType: 'window',          // 'window' | 'notification'
  distractionBlockingUrgeSurfingEnabled: false,
  refocusThreshold: 300,                      // seconds; Rize's unit is unconfirmed
  fullScreenBreakEnabled: true,
  autoBreakDetection: true,                   // docs: Settings > Breaks
  autoStartPlannedSessions: false,
  plannedNotifyMinutes: 5,                    // local
  breakReminderMinutes: 90,                   // local, 0 = off
  toasterEnabled: true,
  widgetEnabled: true,
  widgetAutoHide: true,
  globalShortcutEnabled: true,
  globalShortcutAccelerator: 'CommandOrControl+E',
  workHoursTargets: [0, 8 * H, 8 * H, 8 * H, 8 * H, 8 * H, 0], // Sun..Sat; docs: 8h Mon-Fri
  twentyFourHourEnabled: false,
  stripTrackedTitlesEnabled: false,
  urlHostOnlyEnabled: false,
  doNotTrackAnyUrlsGlobal: false,
  openAtLogin: false,
  autoUpdateEnabled: true,                    // local: check GitHub Releases on launch and every 6 h
  weeklyReportEnabled: true,                  // local: Monday notification for last week's report
  weeklyReportSent: '',                       // local: Monday (YYYY-MM-DD) of the last week notified
};

const KINDS = {
  clients: ['name', 'color', 'rate', 'keywords', 'archived'],
  projects: ['name', 'color', 'clientId', 'rate', 'keywords', 'budgetHours', 'archived'],
  tasks: ['name', 'projectId', 'keywords', 'done'],
  entries: ['start', 'stop', 'description', 'projectId', 'clientId', 'taskId', 'billable', 'status'],
  sessions: ['type', 'start', 'stop', 'title', 'projectId', 'score', 'rating', 'source'],
  planned: ['type', 'start', 'stop', 'title', 'projectId'],
};

const EMPTY_DB = { clients: [], projects: [], tasks: [], entries: [], sessions: [], planned: [], dismissed: [], pto: [] };

module.exports = function createStore(dir, defaultRulesFile) {
  const f = (...p) => path.join(dir, ...p);
  const readJSON = (file, d) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return d; } };
  const writeJSON = (file, v) => { fs.writeFileSync(file + '.tmp', JSON.stringify(v, null, 2)); fs.renameSync(file + '.tmp', file); };

  fs.mkdirSync(f('events'), { recursive: true });
  if (!fs.existsSync(f('rules.json'))) fs.copyFileSync(defaultRulesFile, f('rules.json'));

  const saved = readJSON(f('settings.json'), {});
  if (saved.workHoursTarget && !saved.workHoursTargets) saved.workHoursTargets = DEFAULTS.workHoursTargets.map((t) => (t ? saved.workHoursTarget : 0));
  const settings = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (k in saved) settings[k] = saved[k];

  const db = { ...EMPTY_DB, ...readJSON(f('db.json'), {}) };
  if (fs.existsSync(f('sessions.jsonl')) && !db.sessions.length) { // v0.1 kept sessions in a log file
    db.sessions = readLines(f('sessions.jsonl')).map((s) => ({ id: uid(), source: 'manual', ...s }));
    fs.renameSync(f('sessions.jsonl'), f('sessions.jsonl.migrated'));
  }

  let timer = null;
  const persist = () => { clearTimeout(timer); timer = setTimeout(flush, 300); };
  const flush = () => { clearTimeout(timer); writeJSON(f('db.json'), db); };

  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayBounds = (key) => { const [y, m, d] = key.split('-').map(Number); const s = new Date(y, m - 1, d); const e = new Date(y, m - 1, d + 1); return [s.getTime() / 1000, e.getTime() / 1000]; };

  // Values from the UI are untrusted: keep only known fields with sane types.
  function clean(kind, obj) {
    const out = {};
    for (const k of KINDS[kind]) {
      if (!(k in obj)) continue;
      const v = obj[k];
      if (k === 'keywords') out[k] = Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 80)).slice(0, 50) : [];
      else if (['start', 'stop', 'rate', 'budgetHours', 'score', 'rating'].includes(k)) out[k] = v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
      else if (k === 'color') out[k] = /^#[0-9a-f]{6}$/i.test(v) ? v : null; // goes into style attributes
      else if (['archived', 'done', 'billable'].includes(k)) out[k] = !!v;
      else out[k] = v == null ? null : String(v).slice(0, 500);
    }
    return out;
  }

  return {
    settings, db, DEFAULTS, dayKey, dayBounds, flush,
    path: f,

    saveSettings(patch) {
      for (const [k, v] of Object.entries(patch || {})) {
        if (!(k in DEFAULTS)) continue;
        const d = DEFAULTS[k];
        const ok = Array.isArray(d) ? Array.isArray(v) && v.length === d.length && v.every((x) => typeof x === typeof d[0] && x >= 0)
          : typeof v === typeof d && !(typeof v === 'number' && !(v >= 0));
        if (ok) settings[k] = v;
      }
      writeJSON(f('settings.json'), settings);
      return settings;
    },

    rules() { return (readJSON(f('rules.json'), []) || []).map(normalizeRule); },
    saveRules(list) {
      if (!Array.isArray(list)) throw new Error('rules must be a list');
      const ok = list.filter((r) => r && typeof r.name === 'string' && typeof r.category === 'string').map((r) => {
        for (const k of ['app', 'url', 'title']) if (r[k]) new RegExp(r[k]); // throws on a bad pattern
        return r;
      });
      writeJSON(f('rules.json'), ok);
    },

    events(key) { return readLines(f('events', `${key}.jsonl`)); },
    appendEvent(ev) { fs.appendFileSync(f('events', `${dayKey(new Date(ev.startTimestamp * 1000))}.jsonl`), JSON.stringify(ev) + '\n'); },

    list(kind) { return db[kind]; },
    save(kind, obj) {
      if (!KINDS[kind]) throw new Error('unknown kind');
      const data = clean(kind, obj || {});
      let rec = obj?.id && db[kind].find((x) => x.id === obj.id);
      if (rec) Object.assign(rec, data);
      else { rec = { id: uid(), createdAt: Math.floor(Date.now() / 1000), ...data }; db[kind].push(rec); }
      persist();
      return rec;
    },
    remove(kind, id) {
      if (!KINDS[kind]) throw new Error('unknown kind');
      db[kind] = db[kind].filter((x) => x.id !== id);
      if (kind === 'projects') db.tasks.forEach((t) => { if (t.projectId === id) t.projectId = null; });
      persist();
    },
    dismiss(id) { if (!db.dismissed.includes(id)) db.dismissed.push(String(id)); persist(); },
    setPto(key, on) { db.pto = db.pto.filter((d) => d !== key); if (on) db.pto.push(key); persist(); },
    target(key) {
      if (db.pto.includes(key)) return 0;
      const [y, m, d] = key.split('-').map(Number);
      return settings.workHoursTargets[new Date(y, m - 1, d).getDay()];
    },
  };
};

function readLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; }
}
function uid() { return crypto.randomUUID().slice(0, 12); }
