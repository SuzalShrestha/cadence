const test = require('node:test');
const assert = require('node:assert');
const { Segmenter, releaseNotesText } = require('../src/core');
const { parseDoc, splitFront } = require('../src/active');

const rule = { name: 'Zed', category: 'code' };
const app = (p) => ({ name: 'Zed', bundleId: 'dev.zed.Zed', title: 'main.js', url: null, path: p });
const at = (s) => new Date(1_791_000_000_000 + s * 1000);
const tick = (seg, p, s) => seg.tick({ time: at(s), idle: false, idleBypass: false, app: app(p), rule });

test('Segmenter: records the open file and splits when it changes', () => {
  const out = [];
  const seg = new Segmenter((e) => out.push(e));
  tick(seg, '/w/a.js', 0); tick(seg, '/w/a.js', 5); tick(seg, '/w/b.js', 10); seg.close(at(15));
  assert.deepStrictEqual(out.map((e) => [e.path, e.endTimestamp - e.startTimestamp]), [['/w/a.js', 10], ['/w/b.js', 5]]);
});

test('Segmenter: "strip titles" also drops the file path', () => {
  const out = [];
  const seg = new Segmenter((e) => out.push(e), { stripTitles: true });
  tick(seg, '/secret/plan.txt', 0); seg.close(at(5));
  assert.strictEqual(out[0].path, null);
  assert.strictEqual(out[0].title, '');
});

test('parseDoc: file URLs become paths, web URLs become urls', () => {
  assert.deepStrictEqual(parseDoc('file:///Users/me/My%20Doc.txt'), { path: '/Users/me/My Doc.txt', url: null });
  assert.deepStrictEqual(parseDoc('file:///Users/me/repo/'), { path: '/Users/me/repo', url: null });
  assert.deepStrictEqual(parseDoc('https://example.com/a'), { path: null, url: 'https://example.com/a' });
  assert.deepStrictEqual(parseDoc(''), { path: null, url: null });
  assert.deepStrictEqual(parseDoc('not a url'), { path: null, url: null });
});

test('splitFront: a tab in the window title cannot inject a document path', () => {
  assert.deepStrictEqual(splitFront('Zed\tdev.zed.Zed\tnotes\tfile:///etc/passwd\tfile:///w/a.js'), ['Zed', 'dev.zed.Zed', 'notes\tfile:///etc/passwd', 'file:///w/a.js']);
  assert.deepStrictEqual(splitFront('Zed\tdev.zed.Zed\tnotes\t'), ['Zed', 'dev.zed.Zed', 'notes', '']);
});

test('releaseNotesText: plain text only, even with nested or broken tags', () => {
  assert.strictEqual(releaseNotesText('<h2>Features</h2><ul><li>Auto-update</li></ul>'), 'FeaturesAuto-update');
  assert.ok(!/[<>]/.test(releaseNotesText('<<script>script>alert(1)<</script>/script>')));
  assert.ok(!/[<>]/.test(releaseNotesText('<img src=x onerror=alert(1)')));
  assert.strictEqual(releaseNotesText([{ note: '<p>a</p>' }, { note: null }, { note: '<p>b</p>' }]), 'a\n\nb');
  assert.strictEqual(releaseNotesText(null), '');
});
