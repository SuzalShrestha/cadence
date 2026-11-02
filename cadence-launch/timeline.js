// timeline.js — tempo grid, key times, the day's data. Single source for picture, score, mix and checks.
export const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4, S8 = BEAT / 2, S16 = BEAT / 4, DUR = 73.125;
export const at = (bar, beat = 0, s16 = 0) => +(bar * BAR + beat * BEAT + s16 * S16).toFixed(5);

export const K = {
  hookLabel: 0.3, numIn: 0.5, locks: [1.25, 1.40625, 1.5625],
  tlOpen: 5.0,
  rem: [8.125, 8.75, 9.6875],                  // standup, lunch, bug fix (on the words of l3)
  hatch: 10.0, slivers: 10.625, tilt: 12.5,
  sheet: 15.0, freeze: 18.28125, turn: 20.0, ringDone: 21.25, icon: 21.25, word: 21.875,
  collapse: 25.9375, sweep0: 26.5625, sweep1: 29.6875, lanes: 30.0, laneLand: 31.25,
  dive: 32.5, tile: 32.8125, hour: 35.0, hourFill: 35.625,
  rungs: [37.1875, 37.8125, 38.4375, 39.0625],  // hour→day, day→week, week→year start / year lands
  yearSweep: 39.375,
  focus: 42.5, focusRun: 42.8125, feed: 43.75, blocker: 44.0625, press: 46.875, squash: 47.1875, ringFull: 47.5,
  scoreLocks: [47.8125, 47.96875],
  report: 50.0, bars: [50.3125, 50.46875, 50.625, 50.78125, 50.9375], export: 51.5625, sheetBack: 51.875,
  sheetLocks: [52.1875, 52.34375, 52.5, 52.65625, 52.8125, 52.96875],
  privacy: 55.3125, cuts: [56.25, 57.1875, 58.125], hush: 59.375, rim: 60.0,
  ending: 62.5, legend: 63.125, endCard: 66.25, outro: 70.9375, dotOff: 72.8125,
  vo: { l1: 1.9, l2: 5.3, l3: 7.6, l4: 11.95, l5: 15.6, l6: 20.5, l7: 22.6, l8: 26.2, l9: 32.75, l10: 37.0,
        l11: 42.8, l12: 47.7, l13: 50.3, l14: 52.75, l15: 55.6, l16: 60.0, l17: 62.9, l18: 67.0 },
};

// Categories (order = lanes, by total time). Desaturated codes, only in motion and data.
export const CATS = [
  { id: 'code', name: 'Code', col: '#7189E6' },
  { id: 'docs', name: 'Docs & planning', col: '#A389D6' },
  { id: 'meet', name: 'Meetings', col: '#4FA79E' },
  { id: 'comms', name: 'Chat & email', col: '#D3A04E' },
  { id: 'breaks', name: 'Breaks', col: '#7D8597' },
  { id: 'feed', name: 'Video feed', col: '#CF6890' },
  { id: 'learn', name: 'Learning', col: '#62AE7A' },
];
export const CAT = Object.fromEntries(CATS.map((c, i) => [c.id, { ...c, i }]));

// Tuesday, 9:00–18:47 (587 min = 9h 47m). Totals: code 185, docs 105, meet 80, comms 72, breaks 58, feed 47, learn 40.
const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const DAY = [
  ['9:00', '9:30', 'comms'], ['9:30', '9:45', 'meet', 'Standup'], ['9:45', '11:20', 'code'], ['11:20', '11:32', 'feed'],
  ['11:32', '12:20', 'docs'], ['12:20', '13:05', 'breaks', 'Lunch'], ['13:05', '13:25', 'comms'], ['13:25', '14:30', 'meet'],
  ['14:30', '14:50', 'feed'], ['14:50', '16:20', 'code', 'Bug fix?'], ['16:20', '16:33', 'breaks'], ['16:33', '17:30', 'docs'],
  ['17:30', '17:52', 'comms'], ['17:52', '18:32', 'learn'], ['18:32', '18:47', 'feed'],
].map(([a, b, c, mem]) => ({ a: hm(a), b: hm(b), c, mem }));
export const T0 = 9 * 60, T1 = 19 * 60, NOW = hm('18:47');
export const catAt = m => DAY.find(s => m >= s.a && m < s.b)?.c;
export const fmt = min => `${Math.floor(min / 60) ? Math.floor(min / 60) + 'h ' : ''}${String(min % 60).padStart(Math.floor(min / 60) ? 2 : 1, '0')}m`;
export const TOTALS = CATS.map(c => DAY.filter(s => s.c === c.id).reduce((a, s) => a + s.b - s.a, 0));
