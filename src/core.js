// Pure tracking logic. No Electron here, so node:test can run it.
// Constants and state machines follow Rize 3.0.45 main/index.js (see docs/findings.md).

const TICK_MS = 5e3;           // Rize ticks every 15 s; 5 s also catches short app switches
const IDLE_TEST = 30;          // Idler: >30s  -> "maybe idle" (events frozen)
const IDLE_FULL = 300;         // Idler: >300s -> idle
const IDLE_DEAD = 3600;        // Idler: >1h   -> stop recording idle
const CHUNK_SECS = 180;        // ActiveEvent.exceedsMaxDuration
const DISCARD_SECS = 600;      // ActiveEvent.close drops longer events

const toTs = (d) => Math.floor(d.getTime() / 1000);

// Port of Rize "Idler".
class Idler {
  constructor() { this.test = false; this.full = false; this.dead = false; this.start = null; }
  update(idleSecs, now = new Date()) {
    const dead = idleSecs > IDLE_DEAD;
    const full = idleSecs > IDLE_FULL && !dead;
    const test = idleSecs > IDLE_TEST && !full && !dead;
    const active = !test && !full && !dead;
    const fullChanged = this.full !== full;
    const started = fullChanged && full;
    const stopped = fullChanged && active;
    const extended = this.dead !== dead && dead;
    // Rize sets start only on entering "test"; a jump straight past 30s (e.g. launch while away) left it null and crashed the tick.
    if ((this.test !== test && test) || (!active && !this.start)) this.start = new Date(now.getTime() - idleSecs * 1000);
    if (active) this.start = null;
    Object.assign(this, { test, full, dead });
    return { idle: full, idleStart: this.start, idleBypass: test || dead, idleStarted: started, idleStopped: stopped, idleExtended: extended };
  }
}

// Port of Rize "Active Event". Calls emit(event) when an event closes.
class Segmenter {
  constructor(emit, privacy = {}) { this.emit = emit; this.privacy = privacy; this.prev = null; }
  props({ app, idle, rule, time }) {
    if (!app || !rule || rule.doNotTrack) return null;
    const p = this.privacy;
    let url = app.url || null;
    if (url && (p.doNotTrackAnyUrls || rule.doNotTrackAnyUrls)) url = null;
    else if (url && (p.urlHostOnly || rule.trackFullUrl === false)) { try { url = new URL(url).origin; } catch { url = null; } }
    const hideTitle = p.stripTitles || rule.trackTitles === false;
    return {
      appName: app.name, bundleId: app.bundleId, category: rule.category, idle: !!idle,
      title: hideTitle ? '' : app.title || '', path: hideTitle ? null : app.path || null, url, ruleName: rule.name,
      trackingRuleHostKey: rule.hostKey, focus: !!rule.focus, meeting: !!rule.meeting, startTimestamp: toTs(time),
    };
  }
  differs(a, b) { return a?.bundleId !== b?.bundleId || a?.title !== b?.title || a?.url !== b?.url || a?.path !== b?.path; }
  change(ctx) {
    const next = this.props(ctx);
    const prev = this.prev;
    const diff = this.differs(prev, next);
    const tooLong = prev && toTs(ctx.time) - prev.startTimestamp > CHUNK_SECS;
    if (prev && (diff || tooLong)) this.close(ctx.time);
    if (next && (diff || tooLong)) this.prev = next;
  }
  open(ctx) { const p = this.props(ctx); if (p) this.prev = p; }
  close(time) {
    const prev = this.prev;
    this.prev = null;
    if (!prev) return;
    const ev = { ...prev, endTimestamp: toTs(time) };
    const len = ev.endTimestamp - ev.startTimestamp;
    if (len > 0 && len <= DISCARD_SECS) this.emit(ev);
  }
  clear() { this.prev = null; }
  // Port of Tracker.checkEvent.
  tick(c) {
    const { time, idle, idleStart, idleBypass, idleStarted, idleStopped, idleExtended, app, rule, skipIdle } = c;
    if (!skipIdle && idleStarted) { this.close(idleStart); this.open({ app, idle, rule, time: idleStart }); }
    else if (!skipIdle && idleStopped) { this.close(time); this.open({ app, idle, rule, time }); }
    else if (!skipIdle && idleExtended) this.close(time);
    else if (skipIdle || !idleBypass) this.change({ app, idle, rule, time });
  }
}

// Port of Rize "TrackingRuleMatcher". Longest hostKey wins; fallback is miscellaneous.
// ponytail: no public-suffix list, so "naked domain" matching is skipped; write url regexes against the full URL.
const re = (s) => new RegExp(s, 'i');
function matchRule(app, rules) {
  const hit = (key, list, inputs) => list.filter((r) => r[key] != null && inputs.some((i) => re(r[key]).test(i || '')));
  let found;
  if (app.url) {
    const byUrl = hit('url', rules.filter((r) => r.url != null), [app.url]);
    const byTitle = hit('title', byUrl.filter((r) => r.title != null), [app.title]);
    found = byTitle.length ? byTitle : byUrl.filter((r) => r.title == null);
  }
  if (!found?.length) { // Rize stops at URL rules; we fall back to the app rule so a browser is never "misc" by default
    const byApp = hit('app', rules.filter((r) => r.url == null), [app.name, app.bundleId]);
    const byTitle = hit('title', byApp.filter((r) => r.title != null), [app.title]);
    found = byTitle.length ? byTitle : byApp.filter((r) => r.title == null);
  }
  if (found.length) return [...found].sort((a, b) => (b.hostKey || '').length - (a.hostKey || '').length)[0];
  let host = null;
  try { host = app.url && new URL(app.url).hostname.replace(/^www\./, ''); } catch {}
  return { hostKey: null, name: host || app.name, category: 'miscellaneous' };
}

// Rize Blocker.isBlockerTrackingRule
const isBlockRule = (r, sessionType) =>
  !!(r && (r.alwaysBlock || (r.blockInBreak && sessionType === 'break') || (r.blockInFocus && sessionType === 'focus') || (r.blockInMeeting && sessionType === 'meeting')));

// Rize Session State formatter (includeSeconds form).
function clock(secs) {
  secs = Math.max(0, Math.floor(secs));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// ---- Analysis (Rize computes these on its server; rules below follow docs.rize.io) ----

const len = (e) => e.endTimestamp - e.startTimestamp;
const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } };
const sortEv = (events) => [...events].sort((a, b) => a.startTimestamp - b.startTimestamp);
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// Rules saved before focus/meeting flags existed get them from their category.
const FOCUS_CATS = ['code', 'design', 'docs', 'learning'];
const normalizeRule = (r) => ({
  detectIdle: r.category !== 'meetings', trackTitles: true, trackFullUrl: true,
  focus: FOCUS_CATS.includes(r.category), meeting: r.category === 'meetings', ...r,
});

// Automatic sessions. Docs: focus when ~75% of a 15+ min window is in focus apps;
// meeting after 15+ min in a meeting app; break when idle is detected.
const GAP = 120, MIN_AUTO = 900;
function detectSessions(events, manual = []) {
  const ev = sortEv(events);
  const out = [];
  for (let i = 0; i < ev.length; i++) {
    const s = ev[i];
    if (s.idle || !s.focus) continue;
    let focus = 0, total = 0, prevEnd = s.startTimestamp, best = null;
    for (let j = i; j < ev.length; j++) {
      const e = ev[j], gap = e.startTimestamp - prevEnd;
      if (e.idle || gap > GAP) break;
      total += len(e) + Math.max(0, gap);
      if (e.focus) focus += len(e);
      if (e.focus && focus / total >= 0.75) best = j;
      if (focus / total < 0.5) break;
      prevEnd = e.endTimestamp;
    }
    if (best != null && ev[best].endTimestamp - s.startTimestamp >= MIN_AUTO) {
      out.push({ type: 'focus', start: s.startTimestamp, stop: ev[best].endTimestamp, auto: true });
      i = best;
    }
  }
  const runs = (pred, type, min) => {
    let cur = null;
    const flush = () => { if (cur && cur.stop - cur.start >= min) out.push(cur); cur = null; };
    for (const e of ev) {
      if (!pred(e)) continue;
      if (cur && e.startTimestamp - cur.stop <= GAP) cur.stop = Math.max(cur.stop, e.endTimestamp);
      else { flush(); cur = { type, start: e.startTimestamp, stop: e.endTimestamp, auto: true }; }
    }
    flush();
  };
  runs((e) => !e.idle && e.meeting, 'meeting', MIN_AUTO);
  runs((e) => e.idle, 'break', 300);
  // ponytail: an auto session touching a manual one is dropped whole; trim instead if partial overlap matters.
  return out
    .filter((a) => !manual.some((m) => overlap(a.start, a.stop, m.start, m.stop) > 0))
    .sort((a, b) => a.start - b.start);
}

// Focus score 0-100: share of focus-app time, less a penalty for app switching. A local design, not Rize's 20-attribute model.
function focusScore(events, start, stop) {
  let active = 0, focus = 0, switches = 0, last = null;
  for (const e of sortEv(events)) {
    const d = overlap(e.startTimestamp, e.endTimestamp, start, stop);
    if (!d || e.idle) continue;
    active += d;
    if (e.focus) focus += d;
    if (last && last !== e.appName) switches++;
    last = e.appName;
  }
  if (active < 60) return null;
  const perHour = switches / (active / 3600);
  return Math.max(0, Math.min(100, Math.round(100 * (focus / active) * Math.max(0.4, 1 - perHour / 60))));
}
const focusLabel = (s) => (s == null ? 'No Focus Score' : s >= 80 ? 'Very Focused' : s >= 60 ? 'Focused' : s >= 40 ? 'Somewhat Focused' : 'Not Focused');

// Apps & websites inside a time range (entry popover).
function appsInRange(events, start, stop) {
  const m = new Map();
  let total = 0;
  for (const e of events) {
    if (e.idle) continue;
    const d = overlap(e.startTimestamp, e.endTimestamp, start, stop);
    if (!d) continue;
    add(m, (e.url && host(e.url)) || e.appName, d);
    total += d;
  }
  return [...m].sort((a, b) => b[1] - a[1]).map(([name, secs]) => ({ name, secs, pct: total ? secs / total : 0 }));
}

// Time entry suggestions from keywords on tasks, projects and clients (Rize uses AI + keywords).
function suggestEntries(events, { tasks = [], projects = [], clients = [] }, entries = [], dismissed = []) {
  const kws = [
    ...tasks.map((t) => ({ kw: t.keywords, taskId: t.id, projectId: t.projectId || null })),
    ...projects.map((p) => ({ kw: p.keywords, projectId: p.id })),
    ...clients.map((c) => ({ kw: c.keywords, clientId: c.id })),
  ].filter((k) => k.kw?.length);
  if (!kws.length) return [];
  const pOf = (id) => projects.find((p) => p.id === id);
  const runs = [];
  let cur = null;
  for (const e of sortEv(events)) {
    if (e.idle) continue;
    const text = `${e.appName} ${e.title} ${e.url || ''}`.toLowerCase();
    const k = kws.find((k) => k.kw.some((w) => w && text.includes(w.toLowerCase())));
    if (!k) continue;
    const key = `${k.taskId || ''}|${k.projectId || ''}|${k.clientId || ''}`;
    if (cur && cur.key === key && e.startTimestamp - cur.stop <= 300) { cur.stop = e.endTimestamp; cur.hit += len(e); add(cur.titles, e.title, len(e)); }
    else {
      cur = { key, k, start: e.startTimestamp, stop: e.endTimestamp, hit: len(e), titles: new Map([[e.title, len(e)]]) };
      runs.push(cur);
    }
  }
  return runs
    .filter((r) => r.stop - r.start >= 300)
    .filter((r) => !entries.some((x) => overlap(r.start, r.stop, x.start, x.stop) > 0))
    .map((r) => {
      const projectId = r.k.projectId || null;
      const id = `s:${r.key}:${r.start}`;
      return {
        id, start: r.start, stop: r.stop, taskId: r.k.taskId || null, projectId,
        clientId: r.k.clientId || pOf(projectId)?.clientId || null,
        description: [...r.titles].sort((a, b) => b[1] - a[1])[0][0] || '',
        confidence: Math.round((r.hit / (r.stop - r.start)) * 100), status: 'suggested',
      };
    })
    .filter((s) => !dismissed.includes(s.id));
}

// Dashboard numbers for one day. Work hours = tracked non-idle time.
function summarize(events, sessions = []) {
  const cats = new Map(), apps = new Map(), sites = new Map();
  let active = 0, idle = 0, first = null, lastTs = null;
  const blocks = [];
  const evs = sortEv(events);
  for (const e of evs) {
    const d = len(e);
    if (e.idle) { idle += d; } else {
      active += d;
      first ??= e.startTimestamp;
      lastTs = Math.max(lastTs ?? 0, e.endTimestamp);
      add(cats, e.category, d);
      add(apps, e.appName, d);
      const h = e.url && host(e.url);
      if (h) add(sites, h, d);
    }
    const key = e.idle ? 'idle' : e.category;
    const last = blocks[blocks.length - 1];
    if (last && last.key === key && e.startTimestamp - last.end <= 60) last.end = Math.max(last.end, e.endTimestamp);
    else blocks.push({ key, start: e.startTimestamp, end: e.endTimestamp });
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, secs]) => ({ name, secs }));
  const of = (t) => sessions.filter((s) => s.type === t);
  const secs = (t) => of(t).reduce((a, s) => a + (s.stop - s.start), 0);
  const focus = secs('focus'), meeting = secs('meeting'), brk = secs('break');
  const scores = of('focus').map((s) => s.score ?? focusScore(events, s.start, s.stop)).filter((x) => x != null);
  // Context switches: moves from focus work to a non-focus app or site inside a focus session (Rize weekly report).
  const distract = new Map();
  const switches = of('focus').map((s) => {
    let n = 0, wasFocus = true;
    for (const e of evs) {
      const d = overlap(e.startTimestamp, e.endTimestamp, s.start, s.stop);
      if (!d || e.idle) continue;
      if (!e.focus) { if (wasFocus) n++; add(distract, (e.url && host(e.url)) || e.appName, d); }
      wasFocus = !!e.focus;
    }
    return n;
  });
  return {
    active, idle, blocks, first, last: lastTs, switches, distractors: top(distract, 10),
    categories: top(cats, 50), apps: top(apps, 10), sites: top(sites, 10),
    focus, meeting, break: brk, others: Math.max(0, active - focus - meeting),
    counts: { focus: of('focus').length, meeting: of('meeting').length, break: of('break').length },
    focusScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}

// "8 hr 22 min" (Rize's duration style).
function hrMin(secs) {
  const m = Math.round(Math.max(0, secs) / 60), h = Math.floor(m / 60);
  return h ? `${h} hr ${m % 60} min` : `${m} min`;
}

// ---- Weekly productivity assessment ----
// Layout and metrics follow Rize's weekly PDF (sections, "vs 4-week average", per day = week / 7,
// shares compared in percentage points). Rize builds the text on its server; the templates and coach rules here are local designs.
const DISTRACTING = ['entertainment', 'social', 'gaming'];

function weekTotals(days) {
  const t = { work: 0, target: 0, focus: 0, meeting: 0, break: 0, nFocus: 0, nMeet: 0, nBreak: 0, scoreSum: 0, scoreN: 0, switches: [], cats: new Map(), distract: new Map() };
  for (const d of days) {
    t.work += d.active; t.target += d.target || 0; t.focus += d.focus; t.meeting += d.meeting; t.break += d.break;
    t.nFocus += d.counts.focus; t.nMeet += d.counts.meeting; t.nBreak += d.counts.break;
    if (d.focusScore != null) { t.scoreSum += d.focusScore * d.counts.focus; t.scoreN += d.counts.focus; }
    t.switches.push(...(d.switches || []));
    for (const c of d.categories) add(t.cats, c.name, c.secs);
    for (const x of d.distractors || []) add(t.distract, x.name, x.secs);
  }
  // Rize's breakdown is a share of work hours with breaks inside them: focus 33 min of 85 = 39%, other = the rest.
  t.base = Math.max(t.work, t.focus + t.meeting + t.break);
  t.other = t.base - t.focus - t.meeting - t.break;
  return t;
}

// week: 7 day summaries (Mon..Sun). past: the 28 day summaries before it. Weekly 4-week averages are past totals / 4.
function weeklyReport(week, past) {
  const w = weekTotals(week), p = weekTotals(past), hasPast = p.work > 0;
  const avg = (n, c) => (c ? n / c : 0);
  const share = (x, t) => avg(x, t.base);
  const pp = (a, b) => Math.round((a - b) * 100);
  const change = (cur, base) => (base ? Math.round(((cur - base) / base) * 100) : null);
  const vs = (cur, base) => {
    const c = change(cur, base);
    return c == null ? 'your first tracked week' : Math.abs(c) < 15 ? 'close to your 4-week average' : `${Math.abs(c)}% ${c > 0 ? 'above' : 'below'} your 4-week average`;
  };

  const days = week.map((d) => ({ key: d.key, active: d.active, target: d.target || 0, focus: d.focus, meeting: d.meeting, first: d.first, last: d.last,
    breakPct: avg(d.break, d.active) }));
  const worked = days.filter((d) => d.active > 0).length;
  const overDays = days.filter((d) => d.active > (d.target || 8 * 3600) + 2 * 3600);
  const pctTarget = w.target ? Math.round((w.work / w.target) * 100) : null;

  const work = {
    total: w.work, target: w.target, pctTarget, avg4: p.work / 4, perDay: avg(w.work, worked), perDay4: avg(p.work, past.filter((d) => d.active > 0).length), days,
    text: `You worked ${hrMin(w.work)} this week. That is ${vs(w.work, p.work / 4)}${pctTarget == null ? '' : ` and ${pctTarget}% of your ${hrMin(w.target)} target`}.`,
    overText: overDays.length
      ? `You worked more than 2 hours past your target on ${overDays.length} day${overDays.length > 1 ? 's' : ''}. Long days raise stress. Plan rest after a long day.`
      : 'No day went far past your target. This amount of work lets you stay productive without burnout.',
  };

  const rows = [['Focus', w.focus, p.focus], ['Meetings', w.meeting, p.meeting], ['Breaks', w.break, p.break], ['Other', w.other, p.other]]
    .map(([name, cur, base]) => ({ name, secs: cur, share: share(cur, w), diff: hasPast ? pp(share(cur, w), share(base, p)) : null }));
  const other = rows[3];
  const breakdown = {
    rows,
    text: other.diff == null ? 'Next week this compares against your 4-week average.'
      : Math.abs(other.diff) < 5 ? 'Your time outside focus sessions, meetings and breaks is about the same as usual.'
      : `Your time outside focus sessions, meetings and breaks went ${other.diff < 0 ? 'down' : 'up'} by ${Math.abs(other.diff)} points. ${other.diff < 0 ? 'More of your work is in planned sessions than usual.' : 'Less of your work is in planned sessions than usual.'}`,
  };

  const categories = [...w.cats].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, secs]) => ({ name, secs, share: avg(secs, w.work), diff: hasPast ? pp(avg(secs, w.work), avg(p.cats.get(name) || 0, p.work)) : null }));

  const score = w.scoreN ? Math.round(w.scoreSum / w.scoreN) : null;
  const sw = avg(w.switches.reduce((a, b) => a + b, 0), w.switches.length), sw4 = avg(p.switches.reduce((a, b) => a + b, 0), p.switches.length);
  const focus = {
    score, score4: p.scoreN ? Math.round(p.scoreSum / p.scoreN) : null, label: focusLabel(score),
    total: w.focus, perDay: w.focus / 7, perDay4: p.focus / 28, avgLen: avg(w.focus, w.nFocus), avgLen4: avg(p.focus, p.nFocus),
    switches: Math.round(sw * 10) / 10, switches4: Math.round(sw4 * 10) / 10, switchesMax: Math.max(0, ...w.switches),
    distractors: [...w.distract].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, secs]) => ({ name, secs })),
  };
  const meetings = { total: w.meeting, total4: p.meeting / 4, count: w.nMeet, count4: p.nMeet / 4, perDay: w.nMeet / 7, avgLen: avg(w.meeting, w.nMeet), avgLen4: avg(p.meeting, p.nMeet) };
  const breaks = { pct: avg(w.break, w.work), pct4: avg(p.break, p.work), avgLen: avg(w.break, w.nBreak), avgLen4: avg(p.break, p.nBreak), count: w.nBreak };

  // Coach: insight = the largest change vs the 4-week average; recommendation = first rule that fits.
  const moves = [['work hours', w.work, p.work / 4], ['focus time', w.focus, p.focus / 4], ['meeting time', w.meeting, p.meeting / 4], ['break time', w.break, p.break / 4]]
    .filter(([, , b]) => b > 0).map(([name, cur, base]) => ({ name, cur, base, c: change(cur, base) }))
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
  const m = moves[0];
  const insight = !hasPast ? `You worked ${hrMin(w.work)} this week, with ${hrMin(w.focus)} in focus sessions. Next week's report compares against this week.`
    : `Your ${m.name} this week was ${hrMin(m.cur)}, an average of ${hrMin(m.cur / 7)} per day. That is a ${m.c > 0 ? '+' : ''}${m.c}% change from your 4-week average of ${hrMin(m.base)}.`;
  const dShare = DISTRACTING.reduce((a, k) => a + avg(w.cats.get(k) || 0, w.work), 0);
  const dShare4 = DISTRACTING.reduce((a, k) => a + avg(p.cats.get(k) || 0, p.work), 0);
  const recommendation =
    dShare >= 0.2 || (hasPast && dShare - dShare4 >= 0.05)
      ? `Entertainment and social media took ${Math.round(dShare * 100)}% of your tracked time${hasPast ? ` (${pp(dShare, dShare4) >= 0 ? '+' : ''}${pp(dShare, dShare4)} points vs your 4-week average)` : ''}. Before you start work, start a focus session and set "Block in focus" on those sites in Settings → Apps & Websites, so the blocker keeps them closed until the session ends.`
    : sw >= 3 ? `Your focus sessions had ${focus.switches} context switches on average. Close chat and email before a session, and let the blocker stop the rest. Fewer switches give longer stretches of deep work.`
    : overDays.length >= 2 ? `You went far past your target on ${overDays.length} days. Set a fixed stop time and let the break reminder end your day, so you start the next day rested.`
    : w.work > 4 * 3600 && breaks.pct < 0.05 ? `Breaks were only ${Math.round(breaks.pct * 100)}% of your work hours. Take a 5-minute break after each focus session. Walk or stretch, and do not check messages.`
    : w.work > 0 && share(w.focus, w) < 0.25 ? `Only ${Math.round(share(w.focus, w) * 100)}% of your work was in focus sessions. Plan two focus blocks each morning, or start a Pomodoro set from the Timer page.`
    : w.work > 0 ? 'Your week is balanced. Keep the same routine: plan your focus sessions early in the day and protect them from meetings.'
    : 'Cadence recorded no work this week. Check that tracking is on and that Cadence has its macOS permissions.';

  return { from: week[0]?.key, to: week.at(-1)?.key, hasPast, work, breakdown, categories, focus, meetings, breaks, coach: { insight, recommendation } };
}

// GitHub release notes arrive as HTML (a string, or a list of { note }). Keep plain text only.
// A character scan, not a regex: text between < and > is dropped and < and > are never copied,
// so no markup can survive however the tags nest. Literal < in notes is &lt; in HTML, so no text is lost.
function releaseNotesText(notes) {
  const html = Array.isArray(notes) ? notes.map((n) => n?.note || '').join('\n') : String(notes || '');
  let text = '', inTag = false;
  for (const ch of html) {
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    else if (!inTag) text += ch;
  }
  return text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000);
}

module.exports = {
  weeklyReport, releaseNotesText,
  TICK_MS, IDLE_TEST, IDLE_FULL, IDLE_DEAD, CHUNK_SECS, DISCARD_SECS, Idler, Segmenter, matchRule, isBlockRule, clock, toTs,
  normalizeRule, detectSessions, focusScore, focusLabel, appsInRange, suggestEntries, summarize, hrMin, overlap,
};
