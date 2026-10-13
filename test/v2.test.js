const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { detectSessions, focusScore, suggestEntries, appsInRange } = require('../src/core');
const createStore = require('../src/store');

const T = 1_791_000_000;
// Build back-to-back 180 s events: [appName, secs, extra]
function run(parts, start = T) {
  const out = [];
  let t = start;
  for (const [appName, secs, extra = {}] of parts) {
    for (let left = secs; left > 0; left -= 180) {
      const len = Math.min(180, left);
      out.push({ appName, title: '', url: null, idle: false, startTimestamp: t, endTimestamp: t + len, ...extra });
      t += len;
    }
  }
  return out;
}
const focus = { focus: true }, meet = { meeting: true }, idle = { idle: true };

test('detectSessions: focus, meeting and break runs; manual sessions win', () => {
  const ev = run([['Code', 1800, focus], ['zoom.us', 1200, meet], ['Code', 600, { ...idle }], ['Slack', 300]]);
  const s = detectSessions(ev);
  assert.deepStrictEqual(s.map((x) => x.type), ['focus', 'meeting', 'break']);
  assert.ok(s.every((x) => x.auto));
  // A manual session over the focus run hides the automatic one.
  const m = detectSessions(ev, [{ type: 'focus', start: T, stop: T + 1800 }]);
  assert.deepStrictEqual(m.map((x) => x.type), ['meeting', 'break']);
  // Too short for an automatic session.
  assert.equal(detectSessions(run([['Code', 600, focus]])).length, 0);
});

test('focusScore: share of focus apps, penalised by switching; null when too little activity', () => {
  assert.equal(focusScore(run([['Code', 1800, focus]]), T, T + 1800), 100);
  const mixed = run([['Code', 900, focus], ['Slack', 900]]);
  assert.equal(focusScore(mixed, T, T + 1800), 48); // 50% focus × (1 − 2 switches/h ÷ 60)
  const hopping = run(Array.from({ length: 20 }, (_, i) => [i % 2 ? 'Code' : 'Cursor', 90, focus]));
  assert.ok(focusScore(hopping, T, T + 1800) < 100);
  assert.equal(focusScore(run([['Code', 30, focus]]), T, T + 30), null);
});

test('appsInRange: hosts for URLs, clipped to the range, idle ignored', () => {
  const ev = [...run([['Google Chrome', 600, { url: 'https://www.notion.so/x' }], ['Code', 600]]), ...run([['Code', 600, idle]], T + 1200)];
  const a = appsInRange(ev, T + 300, T + 1800);
  assert.deepStrictEqual(a.map((x) => [x.name, x.secs]), [['Code', 600], ['notion.so', 300]]);
  assert.ok(Math.abs(a[0].pct + a[1].pct - 1) < 1e-9);
});

test('suggestEntries: keyword runs become suggestions; existing entries and dismissals suppress them', () => {
  const ev = run([['Code', 900, { title: 'cart.ts — acme-web' }], ['Slack', 120], ['Code', 60, { title: 'acme-web' }]]);
  const lists = { projects: [{ id: 'p1', clientId: 'c1', keywords: ['acme-web'] }], clients: [], tasks: [] };
  const [s] = suggestEntries(ev, lists);
  assert.equal(s.projectId, 'p1');
  assert.equal(s.clientId, 'c1');
  assert.equal(s.start, T);
  assert.ok(s.stop >= T + 900 && s.confidence > 0 && s.confidence <= 100);
  assert.equal(suggestEntries(ev, lists, [{ start: T, stop: T + 60 }]).length, 0);
  assert.equal(suggestEntries(ev, lists, [], [s.id]).length, 0);
});

test('store: whitelists fields, keeps colors safe for style attributes, rejects bad settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-test-'));
  const st = createStore(dir, path.join(__dirname, '../src/rules.default.json'));
  try {
    const p = st.save('projects', { name: 'X', color: 'red;background:url(x)', rate: 'abc', evil: 1 });
    assert.equal(p.color, null);
    assert.equal(p.rate, null);
    assert.ok(!('evil' in p));
    assert.equal(st.save('projects', { id: p.id, color: '#12abEF' }).color, '#12abEF');
    st.saveSettings({ theme: 5, defaultFocusSessionTime: -1, workHoursTargets: [1, 2] });
    assert.equal(st.settings.theme, 'dark');
    assert.equal(st.settings.defaultFocusSessionTime, 2700);
    assert.equal(st.settings.workHoursTargets.length, 7);
    assert.throws(() => st.saveRules([{ name: 'bad', category: 'code', app: '(' }]));
    st.setPto('2026-10-13', true);
    assert.equal(st.target('2026-10-13'), 0);
  } finally { st.flush(); fs.rmSync(dir, { recursive: true, force: true }); }
});
