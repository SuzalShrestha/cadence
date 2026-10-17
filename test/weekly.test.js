const test = require('node:test');
const assert = require('node:assert');
const { weeklyReport, summarize } = require('../src/core');

// A day summary as main.js daySummary() returns it.
const day = (key, o = {}) => ({ key, target: 0, active: 0, focus: 0, meeting: 0, break: 0, counts: { focus: 0, meeting: 0, break: 0 },
  focusScore: null, categories: [], switches: [], distractors: [], first: null, last: null, ...o });
const H = 3600;

test('weeklyReport reproduces the numbers in Rize\'s Jul 20-27 PDF', () => {
  // The PDF week: 1 hr 25 min on Tuesday, one 33 min focus session (score 89, 5 switches), 19.5 min of breaks, target 8 h Mon-Fri.
  const week = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26'].map((k, i) => day(k, { target: i < 5 ? 8 * H : 0 }));
  Object.assign(week[1], {
    active: 5100, focus: 1980, break: 1170, counts: { focus: 1, meeting: 0, break: 1 }, focusScore: 89, switches: [5],
    categories: [{ name: 'social', secs: 1020 }, { name: 'entertainment', secs: 840 }, { name: 'gaming', secs: 720 }, { name: 'code', secs: 660 }],
    distractors: [{ name: 'youtube.com', secs: 120 }],
  });
  // The 4 weeks before: 2 hr 48 min of work in total (42 min per week), no sessions.
  const past = Array.from({ length: 28 }, (_, i) => day(`p${i}`, i === 3 ? { active: 168 * 60, categories: [{ name: 'code', secs: 168 * 60 }] } : {}));
  const r = weeklyReport(week, past);

  assert.equal(r.work.total, 5100);
  assert.equal(r.work.pctTarget, 4);                 // PDF: 4% of 40 hr 0 min
  assert.equal(r.work.avg4, 42 * 60);                // PDF: 4-week average 42 min
  assert.equal(r.work.total - r.work.avg4, 43 * 60); // PDF: difference 43 min
  // PDF breakdown: Focus 39% (+39), Meetings 0%, Breaks 23% (+23), Other 38% (-62).
  assert.deepStrictEqual(r.breakdown.rows.map((x) => [x.name, Math.round(x.share * 100), x.diff]),
    [['Focus', 39, 39], ['Meetings', 0, 0], ['Breaks', 23, 23], ['Other', 38, -62]]);
  assert.equal(r.focus.score, 89);
  assert.equal(r.focus.avgLen, 1980);                // PDF: avg. session length 33 min
  assert.equal(r.focus.switches, 5);                 // PDF: 5.0 per session, highest 5
  assert.equal(r.focus.switchesMax, 5);
  assert.deepStrictEqual(r.focus.distractors, [{ name: 'youtube.com', secs: 120 }]);
  assert.equal(Math.round(r.breaks.pct * 100), 23);  // PDF: breaks 23% of work hours
  assert.equal(r.categories[0].name, 'social');
  assert.equal(r.categories.find((c) => c.name === 'code').diff, 13 - 100);
  // Same theme as Rize's coach email: entertainment and social media pushed out work.
  assert.match(r.coach.recommendation, /^Entertainment and social media took 51%/);
  assert.match(r.coach.insight, /work hours this week was 1 hr 25 min.*\+102%/);
});

test('weeklyReport: an empty first week has no comparisons and no crash', () => {
  const r = weeklyReport(Array.from({ length: 7 }, (_, i) => day(`d${i}`)), []);
  assert.equal(r.hasPast, false);
  assert.equal(r.breakdown.rows[0].diff, null);
  assert.equal(r.focus.score, null);
  assert.match(r.coach.recommendation, /recorded no work/);
});

test('summarize: context switches and distractors inside focus sessions', () => {
  const T = 1_791_000_000;
  const ev = [
    { appName: 'Code', focus: true, startTimestamp: T, endTimestamp: T + 600 },
    { appName: 'Chrome', url: 'https://www.youtube.com/x', startTimestamp: T + 600, endTimestamp: T + 720 },
    { appName: 'Slack', startTimestamp: T + 720, endTimestamp: T + 780 }, // still away: same switch
    { appName: 'Code', focus: true, startTimestamp: T + 780, endTimestamp: T + 1500 },
    { appName: 'Slack', startTimestamp: T + 1500, endTimestamp: T + 1560 },
  ];
  const s = summarize(ev, [{ type: 'focus', start: T, stop: T + 1800 }]);
  assert.deepStrictEqual(s.switches, [2]);
  assert.deepStrictEqual(s.distractors, [{ name: 'youtube.com', secs: 120 }, { name: 'Slack', secs: 120 }]);
  assert.equal(s.first, T);
  assert.equal(s.last, T + 1560);
});
