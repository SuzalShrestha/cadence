const test = require('node:test');
const assert = require('node:assert');
const { Idler, Segmenter, matchRule, isBlockRule, clock, summarize } = require('../src/core');
const rules = require('../src/rules.default.json');

const t0 = new Date('2026-10-12T09:00:00Z');
const at = (s) => new Date(t0.getTime() + s * 1000);
const code = { name: 'Code', bundleId: 'com.microsoft.VSCode', title: 'main.js', url: null };
const yt = { name: 'Google Chrome', bundleId: 'com.google.Chrome', title: 'Cats', url: 'https://www.youtube.com/watch?v=1' };

test('rule matching: url beats app, longest hostKey wins, fallback is miscellaneous', () => {
  assert.equal(matchRule(code, rules).category, 'code');
  assert.equal(matchRule(yt, rules).name, 'YouTube');
  assert.equal(matchRule({ ...yt, url: 'https://example.org/a' }, rules).category, 'miscellaneous');
  assert.equal(matchRule({ ...yt, url: 'https://example.org/a' }, rules).name, 'example.org');
  const two = [{ hostKey: 'a.com', category: 'x', url: 'a\\.com' }, { hostKey: 'docs.a.com', category: 'y', url: 'docs\\.a\\.com' }];
  assert.equal(matchRule({ url: 'https://docs.a.com' }, two).category, 'y');
  assert.equal(matchRule({ name: 'Unknown', url: null }, rules).name, 'Unknown');
});

test('idler thresholds: 30s maybe-idle, 300s idle, 3600s dead', () => {
  const i = new Idler();
  assert.deepEqual(i.update(0, at(0)).idleBypass, false);
  assert.equal(i.update(31, at(31)).idleBypass, true);
  const s = i.update(301, at(301));
  assert.equal(s.idleStarted, true);
  assert.equal(s.idleStart.getTime(), at(0).getTime());
  assert.equal(i.update(3601, at(3601)).idleExtended, true);
  assert.equal(i.update(0, at(3700)).idleBypass, false);
  const fresh = new Idler().update(400, at(400)); // launched while already away
  assert.equal(fresh.idleStarted, true);
  assert.equal(fresh.idleStart.getTime(), at(0).getTime());
});

test('segmenter: splits on app change, chunks at 180s, records idle, drops >600s', () => {
  const out = [];
  const seg = new Segmenter((e) => out.push(e));
  const i = new Idler();
  const step = (s, app, idleSecs = 0) => seg.tick({ time: at(s), ...i.update(idleSecs, at(s)), app, rule: matchRule(app, rules), skipIdle: false });
  step(0, code); step(15, code); step(30, yt);              // switch app at 30s
  assert.deepEqual(out.map((e) => [e.category, e.endTimestamp - e.startTimestamp]), [['code', 30]]);
  for (let s = 45; s <= 225; s += 15) step(s, yt);          // >180s on one page -> chunk
  assert.equal(out.length, 2);
  assert.equal(out[1].category, 'entertainment');
  step(240, yt, 40); step(255, yt, 55);                     // maybe-idle: events frozen
  assert.equal(out.length, 2);
  step(600, yt, 400);   // idle starts, back-dated to last input (200s); open chunk began at 225s, so Rize drops it
  assert.equal(out.length, 2);
  step(615, code, 0);   // back: idle event 200s..615s closes
  assert.deepEqual([out[2].idle, out[2].startTimestamp - out[0].startTimestamp, out[2].endTimestamp - out[2].startTimestamp], [true, 200, 415]);
  seg.close(at(615 + 900)); // stale event after sleep (>600s) is discarded
  assert.equal(out.length, 3);
});

test('privacy flags strip titles and reduce URLs', () => {
  const out = [];
  const seg = new Segmenter((e) => out.push(e), { stripTitles: true, urlHostOnly: true });
  seg.open({ app: yt, rule: matchRule(yt, rules), idle: false, time: at(0) });
  seg.close(at(10));
  assert.equal(out[0].title, '');
  assert.equal(out[0].url, 'https://www.youtube.com');
});

test('blocker rule, clock, summary', () => {
  const r = matchRule(yt, rules);
  assert.equal(isBlockRule(r, 'focus'), true);
  assert.equal(isBlockRule(r, undefined), false);
  assert.equal(clock(65), '01:05');
  assert.equal(clock(3725), '1:02:05');
  const ev = (s, e, category, extra = {}) => ({ startTimestamp: s, endTimestamp: e, category, appName: 'A', idle: false, ...extra });
  const sum = summarize([ev(0, 100, 'code'), ev(100, 160, 'code'), ev(160, 400, 'x', { idle: true }), ev(400, 500, 'social', { url: 'https://www.reddit.com/r' })],
    [{ type: 'focus', start: 0, stop: 1200 }]);
  assert.equal(sum.active, 260);
  assert.equal(sum.idle, 240);
  assert.deepEqual(sum.blocks.map((b) => b.key), ['code', 'idle', 'social']);
  assert.deepEqual(sum.sites, [{ name: 'reddit.com', secs: 100 }]);
  assert.equal(sum.focus, 1200);
});
