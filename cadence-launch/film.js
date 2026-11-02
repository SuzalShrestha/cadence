// film.js — "Where did the day go?" a launch film for Cadence.
// hook number → the day as gaps and blur → freeze → the ring → playhead gives the day back → zoom ladder 15 s → 1 year
// → focus + blocker → reports + timesheet → privacy → the number again → end card.
import * as E from './engine.js';
import { K, DUR, S16, S8, BEAT, BAR, CATS, CAT, DAY, T0, T1, NOW, fmt, TOTALS } from './timeline.js';
const { W, H, PAL, clamp, lerp, seg, ss, eo, ei, eio, back, spring, hash, mulberry, TAU, font, rr, rgba } = E;
export { DUR };

// ───────────────── text + readcheck registry ─────────────────
let REG = null;
function reg(g, id, s, x0, y0, x1, y1) {
  if (!REG) return;
  const m = g.getTransform(), P = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  const a = P(x0, y0), b = P(x1, y1);
  REG.push({ id, text: s, x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) });
}
function text(g, s, x, y, o = {}) {
  const { px = 24, wt = 500, fam = 'ui', col = PAL.text, align = 'left', base = 'alphabetic', alpha = 1, track = 0, id = null } = o;
  if (alpha <= 0.002) return 0;
  g.save(); g.globalAlpha *= alpha; g.font = font(px, wt, fam); g.fillStyle = col; g.textAlign = align; g.textBaseline = base;
  g.letterSpacing = `${track * px}px`;
  g.fillText(s, x, y); const w = g.measureText(s).width;
  if (id && alpha > 0.9) { const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; reg(g, id, s, x0, y - px, x0 + w, y + px * 0.3); }
  g.restore(); return w;
}
const label = (g, s, x, y, o = {}) => text(g, s, x, y, { px: 18, wt: 500, fam: 'mono', col: PAL.dim, track: 0.16, ...o });

function stage(g, o = {}) { E.bg(g, o); }
function vig(g) { E.vignette(g, 0.52); }
function gridCam(g, cam, alpha = 1) { const p = cam.proj(0, 0); E.grid(g, { ox: p.x, oy: p.y, scale: p.s, alpha }); }
// CRT-off: squash vertically into a line, then into a point. Returns [sx, sy, alpha]
function crt(u) { const a = ei(seg(u, 0, 0.6)), b = ei(seg(u, 0.55, 1)); return [lerp(1, 0.02, b), lerp(1, 0.012, a), 1 - seg(u, 0.85, 1)]; }

// ───────────────── shared geometry: the day bar ─────────────────
const X0 = 300, X1 = 1640, BAR_Y = 560, BAR_H = 96;
const xOf = m => X0 + (m - T0) / (T1 - T0) * (X1 - X0);
const MEM = [[570, 585, 'Standup'], [750, 785, 'Lunch'], [900, 960, 'Bug fix?']];
const inMem = m => MEM.some(([a, b]) => m >= a - 4 && m < b + 4);

// The blur: every app switch is a thin sliver. Spawn rate accelerates; positions avoid the remembered blocks.
const SLIV = (() => {
  const R = mulberry(4711), out = []; let t = K.slivers;
  while (t < K.freeze) {
    let m; do { m = T0 + R() * (NOW - T0); } while (inMem(m));
    out.push({ t, m, w: 2 + R() * 4, h: 0.3 + R() * 0.7, a: 0.55 + R() * 0.4, chip: R() < 0.3 ? Math.floor(R() * 10) : -1, pan: 0 });
    t += S16 / (1 + (t - K.slivers) * 2.0) * (0.5 + R() * 1.0);
  }
  return out;
})();
const CHIPS = ['chat', 'mail', 'tab', 'feed', 'news', 'cal', 'docs', 'tab', 'dm', 'search'];
const RED = PAL.red, GREY = '#3A4050';

function drawRuler(g, a = 1) {
  for (let h = 9; h <= 19; h++) {
    const x = xOf(h * 60);
    g.fillStyle = `rgba(255,255,255,${0.10 * a})`; g.fillRect(Math.round(x), BAR_Y - BAR_H / 2 - 18, 1, BAR_H + 36);
    label(g, `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`, x, BAR_Y - BAR_H / 2 - 34, { align: "center", px: 17, alpha: a, col: PAL.mute });
  }
}
function barShell(g, open = 1) {
  const h = BAR_H * open;
  E.panel(g, X0 - 8, BAR_Y - h / 2 - 8, X1 - X0 + 16, h + 16, { r: 14, fill: '#10131A', shadow: 0.7 });
}
function nowLine(g, a = 1) {
  const x = xOf(NOW);
  g.save(); g.globalAlpha *= a; g.fillStyle = 'rgba(232,234,240,.85)'; g.fillRect(x - 1, BAR_Y - BAR_H / 2 - 14, 2, BAR_H + 28);
  g.beginPath(); g.arc(x, BAR_Y - BAR_H / 2 - 14, 5, 0, TAU); g.fill();
  label(g, '6:47 PM', x + 12, BAR_Y + BAR_H / 2 + 36, { px: 15, col: PAL.text, alpha: 0.9 });
  g.restore();
}
function hatch(g, a, clipX = X0) {
  if (a <= 0) return;
  g.save(); g.beginPath();
  let m = T0;
  for (const [s, e] of MEM) { g.rect(Math.max(xOf(m), clipX), BAR_Y - BAR_H / 2, Math.max(0, xOf(s) - Math.max(xOf(m), clipX)), BAR_H); m = e; }
  g.rect(Math.max(xOf(m), clipX), BAR_Y - BAR_H / 2, Math.max(0, xOf(NOW) - Math.max(xOf(m), clipX)), BAR_H);
  g.clip();
  g.strokeStyle = `rgba(255,255,255,${0.07 * a})`; g.lineWidth = 1.5;
  g.beginPath(); for (let x = X0 - BAR_H; x < X1; x += 11) { g.moveTo(x, BAR_Y + BAR_H / 2); g.lineTo(x + BAR_H, BAR_Y - BAR_H / 2); } g.stroke();
  g.restore();
  // question marks in the large gaps
  let m2 = T0;
  for (const [s, e] of [...MEM, [NOW, NOW]]) {
    if (s - m2 > 50 && xOf((s + m2) / 2) > clipX + 20) text(g, '?', xOf((s + m2) / 2), BAR_Y + 15, { px: 44, wt: 300, col: PAL.mute, align: 'center', alpha: a * 0.8 });
    m2 = e;
  }
}
function memBlocks(g, t, a = 1, clipX = X0) {
  MEM.forEach(([s, e, name], i) => {
    const k = back(seg(t, K.rem[i], K.rem[i] + 0.22), 1.6); if (k <= 0) return;
    const x = xOf(s), w = xOf(e) - x;
    if (x + w < clipX) return;
    g.save(); g.globalAlpha *= a;
    const hh = (BAR_H - 16) * k;
    g.fillStyle = 'rgba(255,255,255,.07)'; rr(g, x, BAR_Y - hh / 2, w, hh, 8); g.fill();
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(232,234,240,.45)'; g.lineWidth = 1.2; rr(g, x + 0.5, BAR_Y - hh / 2 + 0.5, w - 1, hh - 1, 8); g.stroke(); g.setLineDash([]);
    text(g, name, x + w / 2, BAR_Y - BAR_H / 2 - 70, { px: 26, wt: 500, align: 'center', col: PAL.text, alpha: clamp(k), id: t < K.freeze ? 'mem' + i : null });
    g.fillStyle = 'rgba(232,234,240,.35)'; g.fillRect(x + w / 2 - 0.5, BAR_Y - BAR_H / 2 - 60, 1, 18);
    g.restore();
  });
}
// slivers; tf = frozen time; drain 0..1 red → grey; clipX hides what the playhead has resolved
function slivers(g, _t, tf, drain = 0, clipX = X0) {
  const fr = Math.floor(tf * 24), col = drain > 0 ? E.mix(RED, GREY, drain) : RED;
  g.save();
  for (let i = 0; i < SLIV.length; i++) {
    const s = SLIV[i]; if (s.t > tf) break;
    const x = xOf(s.m); if (x < clipX) continue;
    const k = clamp((tf - s.t) / 0.08), jit = drain > 0 ? 0 : (hash(fr * 7.3 + i * 1.7) - 0.5) * 4;
    const h = BAR_H * s.h * k;
    g.globalAlpha = s.a * (1 - drain * 0.35); g.fillStyle = col; g.fillRect(x + jit, BAR_Y - h / 2, s.w, h);
  }
  g.restore();
  // chips float up from the switches (only while the day plays)
  if (drain === 0) for (const s of SLIV) {
    if (s.chip < 0 || s.t > tf || tf - s.t > 0.75) continue;
    const u = (tf - s.t) / 0.75, x = xOf(s.m), y = BAR_Y - BAR_H / 2 - 20 - eo(u) * 70, a = Math.min(clamp(u * 8), 1 - ei(u));
    g.save(); g.globalAlpha = a * 0.9; g.font = font(14, 500, 'mono'); const w = g.measureText(CHIPS[s.chip]).width + 18;
    g.fillStyle = 'rgba(26,30,40,.95)'; rr(g, x - w / 2, y - 13, w, 24, 12); g.fill(); g.strokeStyle = rgba(RED, 0.5); g.lineWidth = 1; rr(g, x - w / 2 + .5, y - 12.5, w - 1, 23, 12); g.stroke();
    g.fillStyle = '#F2B3B9'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(CHIPS[s.chip], x, y); g.restore();
  }
}
const switchesAt = tf => SLIV.filter(s => s.t <= tf).length;

// ───────────────── 1. hook number (also the ending) ─────────────────
const NUM = [['9', 'big'], ['h', 'unit'], [' ', 'sp'], ['47', 'big'], ['m', 'unit']];
function bigNumber(g, t, locks, start, x, y, px, a = 1) {
  g.save(); g.globalAlpha *= a;
  const pu = px * 0.42; let tot = 0; const ws = [];
  for (const [s, k] of NUM) { g.font = font(k === 'big' ? px : pu, 600, 'disp'); const w = k === 'sp' ? px * 0.22 : g.measureText(s).width + (k === 'unit' ? px * 0.04 : -px * 0.03); ws.push(w); tot += w; }
  let cx = x - tot / 2, li = 0;
  NUM.forEach(([s, k], i) => {
    if (k === 'big') { E.scramble(g, s, cx, y, t, s.split('').map(() => locks[li++]), { px, wt: 600, fam: 'disp', tracking: -0.045, start }); }
    else if (k === 'unit') { const lk = locks[Math.min(li, locks.length) - 1]; if (t >= lk) text(g, s, cx + px * 0.02, y, { px: pu, wt: 500, fam: 'disp', col: PAL.dim, alpha: clamp((t - lk) * 12) }); }
    cx += ws[i];
  });
  if (t > locks[locks.length - 1] + 0.05) reg(g, 'num', '9h 47m', x - tot / 2, y - px * 0.75, x + tot / 2, y);
  g.restore(); return tot;
}
function sceneHook(g, t) {
  stage(g, { lift: 0.8 + 0.2 * seg(t, 0, 1.5) });
  const z = lerp(1, 1.05, ss(seg(t, 0, 5)));
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
  E.grid(g, { alpha: 0.8 });
  const out = seg(t, K.tlOpen, K.tlOpen + 0.3);
  const la = seg(t, K.hookLabel, K.hookLabel + 0.4) * (1 - out);
  label(g, 'TUESDAY  ·  6:47 PM', W / 2, 330, { align: 'center', px: 22, col: PAL.dim, alpha: la, id: 'hookLabel' });
  // number retracts upward (squash) at the open
  const sy = 1 - ei(out);
  if (sy > 0.01) { g.save(); g.translate(0, 600); g.scale(1, sy); g.translate(0, -600); bigNumber(g, t, K.locks, K.numIn, W / 2, 600, 270, 1 - out * 0.5); g.restore(); }
  label(g, 'AT YOUR DESK TODAY', W / 2, 700, { align: 'center', px: 20, col: PAL.mute, alpha: seg(t, 1.7, 2.1) * (1 - out), id: 'hookSub' });
  g.restore();
}

// ───────────────── 2. the day: gaps and blur ─────────────────
function camDay(t) {
  const tf = Math.min(t, K.freeze);
  const u = eio(seg(tf, K.tlOpen + 0.6, K.freeze + 1.5));
  const zoom = lerp(1, 1.42, eio(seg(tf, K.tlOpen + 0.4, 8.0)));
  const x = lerp(970, lerp(780, 1180, u), seg(tf, K.tlOpen + 0.4, 6.4)), y = BAR_Y - 20;
  const pr = ss(seg(tf, K.tilt, 15.0)), amp = 3.5 * pr, k = tf * 24;
  return E.camera({ x, y, zoom, rot: 0.017 * pr, sx: amp * (Math.sin(k * 1.7) * 0.6 + Math.sin(k * 3.1 + 1) * 0.4), sy: amp * (Math.sin(k * 2.3 + 2) * 0.6 + Math.sin(k * 0.9) * 0.4) });
}
function sceneDay(g, t) {
  const tf = Math.min(t, K.freeze), drain = seg(t, K.freeze, K.freeze + 0.5);
  stage(g); const cam = camDay(t); gridCam(g, cam, 0.9);
  g.save(); cam.apply(g);
  // open from the hook's underline: a hairline grows, then the bar opens
  const ow = eo(seg(t, K.tlOpen, K.tlOpen + 0.35)), oh = back(seg(t, K.tlOpen + 0.3, K.tlOpen + 0.6), 1.4);
  if (oh <= 0) { g.fillStyle = 'rgba(232,234,240,.7)'; const w = lerp(560, X1 - X0, ow); g.fillRect(970 - w / 2, BAR_Y, w, 1.5); }
  else {
    barShell(g, oh); drawRuler(g, clamp(oh));
    g.save(); g.beginPath(); g.rect(X0, BAR_Y - BAR_H / 2, X1 - X0, BAR_H); g.clip();
    hatch(g, seg(t, K.hatch, K.hatch + 0.4));
    slivers(g, t, tf, drain);
    g.restore();
    memBlocks(g, t);
    nowLine(g, seg(t, 6.0, 6.4));
  }
  g.restore();
  // switch counter (screen space)
  const ca = seg(t, K.slivers, K.slivers + 0.3);
  if (ca > 0) {
    label(g, 'APP SWITCHES TODAY', 1780, 120, { align: 'right', px: 16, alpha: ca, id: 'swLabel' });
    text(g, String(switchesAt(tf)), 1780, 178, { px: 52, wt: 600, fam: 'disp', align: 'right', col: drain > 0 ? E.mix(RED, '#8A90A0', drain) : RED, alpha: ca });
  }
  vig(g);
}

// ───────────────── 3. timesheet card ─────────────────
const SH = { x: 600, y: 300, w: 720, h: 470 };
const SH_ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], SH_DONE = ['8.2', '9.8', '8.9', '7.6', '6.8'];
const fieldOf = i => ({ x: SH.x + SH.w - 220, y: SH.y + 118 + i * 54 - 31, w: 180, h: 44 });
export const CARET = (() => { const f = fieldOf(1); return { x: f.x + 22, y: f.y + f.h / 2 }; })();
function drawSheet(g, t, mode) {
  const { x, y, w, h } = SH;
  E.panel(g, x, y, w, h, { r: 22, fill: '#141821', shadow: 1.2 });
  text(g, 'Timesheet', x + 40, y + 62, { px: 36, wt: 600, id: mode + 'Sheet' });
  label(g, 'WEEK 45 · DUE FRIDAY', x + w - 40, y + 58, { align: 'right', px: 15 });
  g.fillStyle = PAL.line; g.fillRect(x + 28, y + 86, w - 56, 1);
  SH_ROWS.forEach((d, i) => {
    const f = fieldOf(i), cy = f.y + f.h / 2;
    text(g, d, x + 40, cy + 9, { px: 24, col: PAL.dim });
    g.fillStyle = i === 1 && mode === 'ask' ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.035)'; rr(g, f.x, f.y, f.w, f.h, 10); g.fill();
    if (i === 1 && mode === 'ask') { g.strokeStyle = 'rgba(232,234,240,.4)'; g.lineWidth = 1.5; rr(g, f.x + .5, f.y + .5, f.w - 1, f.h - 1, 10); g.stroke(); }
    if (mode === 'ask') {
      const v = i === 0 ? '8?' : i === 1 ? '' : '—';
      if (v) text(g, v, f.x + f.w - 18, cy + 9, { px: 24, fam: 'mono', align: 'right', col: i === 0 ? PAL.dim : PAL.mute });
    } else {
      E.scramble(g, SH_DONE[i], f.x + f.w - 18, cy + 9, t, [K.sheetLocks[i] - 0.05, K.sheetLocks[i] - 0.05, K.sheetLocks[i]], { px: 26, wt: 500, fam: 'mono', align: 'right', tracking: 0, start: K.sheetBack + 0.15 });
    }
  });
  const ty = y + h - 44;
  g.fillStyle = PAL.line; g.fillRect(x + 28, ty - 40, w - 56, 1);
  text(g, 'Total', x + 40, ty + 4, { px: 26, wt: 600 });
  if (mode === 'ask') text(g, '—', x + w - 58, ty + 4, { px: 26, fam: 'mono', align: 'right', col: PAL.mute });
  else {
    const lk = K.sheetLocks[5];
    E.scramble(g, '41.3', x + w - 58, ty + 4, t, [lk - 0.1, lk - 0.1, lk - 0.05, lk], { px: 30, wt: 600, fam: 'mono', align: 'right', tracking: 0, color: PAL.accent, start: K.sheetBack + 0.15 });
    const ca = back(seg(t, lk + 0.1, lk + 0.3), 1.6);
    if (ca > 0) { g.save(); g.globalAlpha *= clamp(ca); E.glow(g, x + w - 290, ty - 4, 40, PAL.accent, 0.25); g.strokeStyle = PAL.accent; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + w - 300, ty - 4); g.lineTo(x + w - 292, ty + 4); g.lineTo(x + w - 278, ty - 12); g.stroke(); g.restore(); text(g, 'Ready', x + w - 266, ty + 2, { px: 20, col: PAL.accent, alpha: clamp(ca), id: 'ready' }); }
  }
}
function sheetFrame(g, t, t0, mode, from) {
  const p = eo(seg(t, t0, t0 + 0.28)), q = back(seg(t, t0, t0 + 0.32), 1.25);
  if (p <= 0) return;
  g.save();
  const cx = lerp(from.x, SH.x + SH.w / 2, p), cy = lerp(from.y, SH.y + SH.h / 2, p), s = lerp(0.08, 1, q);
  g.translate(cx, cy); g.scale(s, lerp(0.04, 1, q)); g.translate(-(SH.x + SH.w / 2), -(SH.y + SH.h / 2));
  g.globalAlpha = clamp(p * 3); drawSheet(g, t, mode); g.restore();
}
function caretBlink(t) { return (t % BEAT) < BEAT * 0.55 ? 1 : 0.0; }

function sceneAsk(g, t) {
  // push-in through the frozen frame toward the empty field
  const u = eio(seg(t, K.freeze, K.turn));
  const S = Math.exp(lerp(0, Math.log(2.6), u)), fx = lerp(W / 2, CARET.x, u), fy = lerp(H / 2, CARET.y, u);
  g.save(); g.translate(W / 2, H / 2); g.scale(S, S); g.translate(-fx, -fy);
  sceneDay(g, t);
  g.fillStyle = `rgba(4,5,8,${0.5 * seg(t, K.sheet, K.sheet + 0.3)})`; g.fillRect(-W, -H, W * 3, H * 3);
  const cam = camDay(t), np = cam.proj(xOf(NOW), BAR_Y - BAR_H / 2);
  sheetFrame(g, t, K.sheet, 'ask', np);
  if (t > K.sheet + 0.3) E.caret(g, CARET.x, CARET.y, 26, { on: caretBlink(t), color: '#E8EAF0', glow: 0.2, wr: 1 / 12 });
  g.restore();
}

// ───────────────── 4. the turn: the Cadence ring ─────────────────
const A0 = -Math.PI / 4, SWEEP = Math.PI * 1.5;   // start top-right, counter-clockwise 270°
function ringPath(g, cx, cy, r, p, o = {}) {
  const { width = r * 0.256, alpha = 1, track = 0, dot = 1, glowA = 0.5 } = o;
  g.save(); g.globalAlpha *= alpha; g.lineCap = 'round'; g.lineWidth = width;
  if (track > 0) { g.strokeStyle = `rgba(43,42,48,${track})`; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
  if (p > 0.001) {
    const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gr.addColorStop(0, '#00EDFF'); gr.addColorStop(0.55, '#8B7BC8'); gr.addColorStop(1, '#EFB3FF');
    g.strokeStyle = gr; g.shadowColor = rgba('#00EDFF', 0.35 * glowA); g.shadowBlur = r * 0.25;
    g.beginPath(); g.arc(cx, cy, r, A0, A0 - SWEEP * p, true); g.stroke(); g.shadowColor = 'transparent';
  }
  if (dot > 0) {
    const dx = cx + Math.cos(A0) * r, dy = cy + Math.sin(A0) * r, dr = Math.max(3, r * 0.08) * dot;
    E.glow(g, dx, dy, dr * 6, '#00EDFF', 0.35 * glowA); g.fillStyle = '#00EDFF'; g.beginPath(); g.arc(dx, dy, dr, 0, TAU); g.fill();
  }
  g.restore();
}
// The app icon: squircle + ring. s = squircle side
function appIcon(g, cx, cy, s, o = {}) {
  const { alpha = 1, p = 1, panelA = 1 } = o;
  g.save(); g.globalAlpha *= alpha;
  if (panelA > 0) {
    g.save(); g.globalAlpha *= panelA;
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = s * 0.18; g.shadowOffsetY = s * 0.06;
    const gr = g.createLinearGradient(0, cy - s / 2, 0, cy + s / 2); gr.addColorStop(0, '#24222E'); gr.addColorStop(1, '#121117');
    g.fillStyle = gr; rr(g, cx - s / 2, cy - s / 2, s, s, s * 0.2245); g.fill(); g.shadowColor = 'transparent';
    const rg = g.createRadialGradient(cx, cy - s * 0.4, 0, cx, cy - s * 0.4, s * 0.7); rg.addColorStop(0, 'rgba(104,87,147,.45)'); rg.addColorStop(1, 'rgba(104,87,147,0)');
    g.fillStyle = rg; rr(g, cx - s / 2, cy - s / 2, s, s, s * 0.2245); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = Math.max(1, s * 0.0036); rr(g, cx - s / 2, cy - s / 2, s, s, s * 0.2245); g.stroke();
    g.restore();
  }
  ringPath(g, cx, cy, s * 0.3034, p, { track: panelA, glowA: 0.6 });
  g.restore();
}
const R_DRAW = 150;
const RC0 = { x: W / 2 - Math.cos(A0) * R_DRAW, y: H / 2 - Math.sin(A0) * R_DRAW };  // ring centre when its dot sits where the caret was
function iconPose(t) {
  // returns ring centre, ring radius, squircle side, panel alpha
  const pan = eio(seg(t, K.turn, K.ringDone)), shrink = eio(seg(t, K.ringDone, K.ringDone + 0.7)), side = eio(seg(t, K.word, K.word + 0.5));
  const c = { x: lerp(RC0.x, 960, pan), y: lerp(RC0.y, 500, pan) };
  const r = lerp(R_DRAW, 112, shrink);
  return { x: lerp(c.x, 645, side), y: lerp(c.y, 520, side), r: lerp(r, 100, side) };
}
function sceneTurn(g, t) {
  stage(g, { lift: 0.6 + 0.4 * seg(t, K.turn, K.turn + 1.5), cool: seg(t, K.turn, K.turn + 2) });
  E.grid(g, { alpha: 0.55 + 0.45 * seg(t, K.ringDone, K.ringDone + 1) });
  const P = iconPose(t), s = P.r / 0.3034;
  const p = eo(seg(t, K.turn + 0.1, K.ringDone));
  // the caret became a dot: two-frame squash at the turn
  const k = t - K.turn, dotS = k < 2 / 24 ? 1.6 : lerp(1.6, 1, spring((k - 2 / 24) / 0.5, 8, 0.4));
  const pa = seg(t, K.icon, K.icon + 0.6);
  if (pa > 0) {
    // light reveal of the squircle
    const [c, cg] = E.buf('icon', 900, 900); cg.clearRect(0, 0, 900, 900);
    appIcon(cg, 450, 450, s, { p: 0, panelA: 1 });
    E.lightReveal(g, c, P.x - 450, P.y - 450, 900, 900, eio(seg(t, K.icon, K.icon + 1.1)), { base: 0.0, soft: 320, glint: 0.18 });
  }
  ringPath(g, P.x, P.y, P.r, p, { dot: dotS, glowA: 1, track: 0.8 * pa });
  // wordmark + line
  const wa = seg(t, K.word + 0.1, K.word + 0.55);
  if (wa > 0) {
    g.save(); g.beginPath(); g.rect(860, 300, 1000 * eo(wa), 400); g.clip();
    text(g, 'Cadence', 860, 545, { px: 150, wt: 600, track: -0.035, id: 'wordmark' });
    g.restore();
    text(g, 'Automatic time tracking for macOS', 866, 618, { px: 36, wt: 400, col: PAL.dim, alpha: seg(t, K.word + 0.25, K.word + 0.5), id: "tagline" });
  }
  vig(g);
}

// ───────────────── 5. the playhead gives the day back, then lanes ─────────────────
const playMin = t => lerp(T0, NOW, ss(seg(t, K.sweep0, K.sweep1)));
const LANE_Y = i => 360 + i * 64, LANE_H = 40;
function segPose(s, t) {
  const li = CAT[s.c].i, d0 = K.lanes + li * 0.045 + (s.a - T0) / 587 * 0.12, u = seg(t, d0, d0 + 0.5);
  const q = back(u, 1.35), y = lerp(BAR_Y, LANE_Y(li), q), h = lerp(BAR_H - 12, LANE_H, eo(u));
  const bend = Math.sin(Math.PI * clamp(u)) * 50;
  return { y, h, x0: xOf(s.a) + bend, x1: xOf(s.b) + bend, u, d0 };
}
function scenePlay(g, t) {
  stage(g); E.grid(g, { alpha: 0.9 });
  const lanesU = seg(t, K.lanes, K.lanes + 0.8);
  // header
  label(g, "TUESDAY", X0, 300, { px: 18, alpha: seg(t, K.sweep0, K.sweep0 + 0.4) });
  const pm = playMin(t), px = xOf(pm);
  const tracked = Math.round(pm - T0);
  text(g, fmt(tracked), X0, 362, { px: 46, wt: 600, fam: 'disp', alpha: seg(t, K.sweep0, K.sweep0 + 0.4) });
  label(g, "TRACKED", X0 + 214, 360, { px: 16, col: PAL.accent, alpha: seg(t, K.sweep0, K.sweep0 + 0.4) });
  // ruler + shell (fade as the lanes form)
  const open = eo(seg(t, K.collapse + 0.45, K.collapse + 0.75));
  g.save(); g.globalAlpha *= 1 - lanesU;
  if (open > 0) {
    g.save(); g.translate(X0, BAR_Y); g.scale(open, 1); g.translate(-X0, -BAR_Y); barShell(g, 1); g.restore();
    drawRuler(g, open);
    g.save(); g.beginPath(); g.rect(px, BAR_Y - BAR_H / 2, X1 - px, BAR_H); g.clip();
    g.globalAlpha *= open; hatch(g, 1, px); slivers(g, t, K.freeze, 1, px); g.restore();
    memBlocks(g, 1e9, open * 0.9 * (1 - seg(t, K.sweep0, K.sweep0 + 0.6)), px);
  }
  g.restore();
  // resolved blocks
  for (const s of DAY) {
    if (s.a >= pm) continue;
    const c = CAT[s.c], b = Math.min(s.b, pm);
    const P = t < K.lanes ? { y: BAR_Y, h: BAR_H - 12, x0: xOf(s.a), x1: xOf(b), u: 0 } : segPose(s, t);
    const age = clamp((pm - s.a) / 6);
    if (P.u > 0 && P.u < 1) { const pts = []; for (let k = 0; k < 8; k++) { const q = segPose(s, t - k * 0.02); pts.unshift([(q.x0 + q.x1) / 2, q.y]); } E.trail(g, pts, { color: c.col, width: 5, alpha: 0.7 }); }
    g.save(); g.globalAlpha *= age;
    g.fillStyle = c.col; g.shadowColor = rgba(c.col, 0.35); g.shadowBlur = 14;
    rr(g, P.x0 + 1, P.y - P.h / 2, Math.max(2, P.x1 - P.x0 - 2), P.h, 7); g.fill(); g.shadowColor = 'transparent';
    const gr = g.createLinearGradient(0, P.y - P.h / 2, 0, P.y + P.h / 2); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = gr; rr(g, P.x0 + 1, P.y - P.h / 2, Math.max(2, P.x1 - P.x0 - 2), P.h, 7); g.fill();
    g.restore();
    if (t < K.lanes && s.b - s.a >= 55 && pm > s.a + 12) text(g, `${c.name}  ${fmt(s.b - s.a)}`, (xOf(s.a) + xOf(s.b)) / 2, BAR_Y + BAR_H / 2 + 40, { px: 20, align: 'center', col: PAL.text, alpha: clamp((pm - s.a - 12) / 8) * (1 - lanesU) });
  }
  // the playhead: the ring's dot, now a cursor of light
  if (t < K.lanes + 0.3) {
    const a = 1 - seg(t, K.lanes, K.lanes + 0.3);
    const fly = eio(seg(t, K.collapse + 0.25, K.collapse + 0.55));
    const dot = { x: lerp(600 + Math.cos(A0) * 100, xOf(T0), fly), y: lerp(520 + Math.sin(A0) * 100, BAR_Y - BAR_H / 2 - 14, fly) - Math.sin(Math.PI * fly) * 80 };
    g.save(); g.globalAlpha *= a;
    if (open > 0.5) {
      const bandW = 240, gr = g.createLinearGradient(px - bandW, 0, px, 0); gr.addColorStop(0, rgba(PAL.accent, 0)); gr.addColorStop(1, rgba(PAL.accent, 0.12));
      g.fillStyle = gr; g.fillRect(px - bandW, BAR_Y - BAR_H / 2, bandW, BAR_H);
      g.fillStyle = PAL.accent; g.shadowColor = rgba(PAL.accent, 0.9); g.shadowBlur = 16; g.fillRect(px - 1.5, BAR_Y - BAR_H / 2 - 14, 3, BAR_H + 28); g.shadowColor = 'transparent';
    }
    const dpos = t < K.sweep0 ? dot : { x: px, y: BAR_Y - BAR_H / 2 - 14 };
    E.glow(g, dpos.x, dpos.y, 48, PAL.accent, 0.4); g.fillStyle = PAL.accent; g.beginPath(); g.arc(dpos.x, dpos.y, 7, 0, TAU); g.fill();
    g.restore();
  }
  // lanes: labels + totals
  if (t >= K.lanes) CATS.forEach((c, i) => {
    const la = seg(t, K.lanes + 0.05 + i * 0.03, K.lanes + 0.25 + i * 0.03);
    g.save(); g.globalAlpha *= la; g.fillStyle = c.col; g.beginPath(); g.arc(X0 - 190, LANE_Y(i), 6, 0, TAU); g.fill(); g.restore();
    text(g, c.name, X0 - 174, LANE_Y(i) + 8, { px: 22, col: PAL.text, alpha: la, id: 'lane' + i });
    const lk = K.laneLand + i * S16, v = fmt(TOTALS[i]);
    if (t > K.laneLand - 0.3) E.scramble(g, v, 1790, LANE_Y(i) + 9, t, v.split('').map(() => lk), { px: 24, wt: 500, fam: 'mono', align: 'right', tracking: 0, color: PAL.dim, start: K.laneLand - 0.3 });
  });
  vig(g);
}

// ───────────────── 6. the zoom ladder: 15 s → 1 hour → 1 day → 1 week → 1 year ─────────────────
const TILE_C = { x: 660, y: 390, w: 600, h: 300 };
const L1 = { k: 1.35, cols: 16, rows: 15, tw: 40, th: 20, gap: 6 };
L1.w = (L1.cols * (L1.tw + L1.gap) - L1.gap) * L1.k; L1.h = (L1.rows * (L1.th + L1.gap) - L1.gap) * L1.k;
L1.x = W / 2 - L1.w / 2; L1.y = 570 - L1.h / 2;
const TILE_I = 169;
const L1cell = i => ({ x: L1.x + (i % 16) * (L1.tw + L1.gap) * L1.k, y: L1.y + Math.floor(i / 16) * (L1.th + L1.gap) * L1.k, w: L1.tw * L1.k, h: L1.th * L1.k });
const L2 = { cw: 140, gap: 10 }; L2.ch = L2.cw / ((L1.w) / (L1.h)); L2.w = 10 * (L2.cw + L2.gap) - L2.gap; L2.x = W / 2 - L2.w / 2; L2.y = 560 - L2.ch / 2;
const L2cell = h => ({ x: L2.x + (h - 9) * (L2.cw + L2.gap), y: L2.y, w: L2.cw, h: L2.ch });
const L3 = { k: 1200 / L2.w }; L3.rh = L2.ch * L3.k; L3.gap = 20; L3.w = 1200; L3.h = 7 * (L3.rh + L3.gap) - L3.gap; L3.x = W / 2 - L3.w / 2 + 40; L3.y = 585 - L3.h / 2;
const L3row = d => ({ x: L3.x, y: L3.y + d * (L3.rh + L3.gap), w: L3.w, h: L3.rh });
const L4 = { cols: 53, cell: 25, gap: 6 }; L4.w = L4.cols * (L4.cell + L4.gap) - L4.gap; L4.h = 7 * (L4.cell + L4.gap) - L4.gap; L4.x = W / 2 - L4.w / 2; L4.y = 590 - L4.h / 2;
const WEEKCOL = 44;
const L4cell = (c, d) => ({ x: L4.x + c * (L4.cell + L4.gap), y: L4.y + d * (L4.cell + L4.gap), w: L4.cell, h: L4.cell });
// other days of the week: seeded schedules ending at their total
const WEEK_MIN = [492, 587, 534, 456, 408, 0, 0];
const WEEK_DAYS = WEEK_MIN.map((tot, d) => {
  if (d === 1) return DAY; if (!tot) return [];
  const R = mulberry(900 + d), out = []; let m = T0; const end = T0 + tot;
  const pick = () => { const r = R(); return r < 0.34 ? 'code' : r < 0.52 ? 'docs' : r < 0.66 ? 'meet' : r < 0.8 ? 'comms' : r < 0.88 ? 'breaks' : r < 0.95 ? 'feed' : 'learn'; };
  while (m < end) { const len = Math.min(end - m, 10 + Math.floor(R() * 70)); out.push({ a: m, b: m + len, c: pick() }); m += len; }
  return out;
});
const catIn = (day, m) => day.find(s => m >= s.a && m < s.b)?.c;
// draw one hour as a tile grid in rect r (detail by size)
function hourTiles(g, day, h, r, a = 1, fill = 1) {
  const cols = 16, rows = 15, gx = r.w / (cols * (L1.tw + L1.gap) - L1.gap), tw = L1.tw * gx, th = L1.th * gx, gp = L1.gap * gx;
  g.save(); g.globalAlpha *= a;
  if (tw < 2.2) {   // tiny: draw runs per row
    for (let j = 0; j < rows; j++) {
      let i = 0;
      while (i < cols) {
        const m = h * 60 + Math.floor((j * cols + i) / 4), c = catIn(day, m); let k = i + 1;
        while (k < cols && catIn(day, h * 60 + Math.floor((j * cols + k) / 4)) === c) k++;
        if (c && (j * cols + i) / 240 < fill) { g.fillStyle = CAT[c].col; g.fillRect(r.x + i * (tw + gp), r.y + j * (th + gp), (k - i) * (tw + gp) - gp, Math.max(0.8, th)); }
        i = k;
      }
    }
  } else {
    for (let n = 0; n < 240; n++) {
      if (n / 240 >= fill) break;
      const i = n % cols, j = Math.floor(n / cols), m = h * 60 + Math.floor(n / 4), c = catIn(day, m);
      const x = r.x + i * (tw + gp), y = r.y + j * (th + gp);
      if (!c) { g.fillStyle = 'rgba(255,255,255,.04)'; rr(g, x, y, tw, th, th * 0.22); g.fill(); continue; }
      const idle = hash(n * 3.7 + h) < 0.035;
      g.fillStyle = idle ? 'rgba(255,255,255,.1)' : E.mix(CAT[c].col, '#0A0B0F', 0.08 + 0.18 * hash(n * 1.3 + h * 7)); rr(g, x, y, tw, th, th * 0.22); g.fill();
    }
  }
  g.restore();
}
function dayRow(g, day, r, a = 1) {
  const cw = r.w / (10 + 9 * L2.gap / L2.cw), gp = cw * L2.gap / L2.cw;
  for (let h = 9; h < 19; h++) {
    const cr = { x: r.x + (h - 9) * (cw + gp), y: r.y, w: cw, h: r.h };
    g.fillStyle = `rgba(255,255,255,${0.035 * a})`; rr(g, cr.x, cr.y, cr.w, cr.h, Math.min(8, cr.h * 0.12)); g.fill();
    hourTiles(g, day, h, cr, a);
  }
}
// the scale ruler: one persistent row; a cyan marker snaps to the current rung
const RUNGS = ['15 SEC', '1 HOUR', '1 DAY', '1 WEEK', '1 YEAR'];
function rungBar(g, t) {
  const a = seg(t, K.tile + 0.1, K.tile + 0.35) * (1 - seg(t, K.focus - 0.2, K.focus)); if (a <= 0) return;
  const at = [K.tile, K.hour, K.rungs[0], K.rungs[1], K.rungs[2]], gap = 64;
  g.save(); g.font = font(20, 500, 'mono'); g.letterSpacing = '3px';
  const ws = RUNGS.map(s => g.measureText(s).width), tot = ws.reduce((p, q) => p + q, 0) + gap * 4;
  const xs = []; let x = W / 2 - tot / 2; ws.forEach(w => { xs.push(x); x += w + gap; }); g.restore();
  let k = 0; for (let i = 0; i < 5; i++) if (t >= at[i]) k = i;
  const u = eio(seg(t, at[k], at[k] + 0.3)), j = Math.max(0, k - 1);
  const mx = k === 0 ? xs[0] : lerp(xs[j], xs[k], u), mw = k === 0 ? ws[0] : lerp(ws[j], ws[k], u);
  g.save(); g.globalAlpha *= a;
  RUNGS.forEach((s, i) => {
    label(g, s, xs[i], 186, { px: 20, track: 0.15, col: i === k ? PAL.text : PAL.mute });
    if (i < 4) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(xs[i] + ws[i] + 14, 179, gap - 28, 1); }
  });
  g.fillStyle = PAL.accent; g.shadowColor = rgba(PAL.accent, 0.9); g.shadowBlur = 12; g.fillRect(mx, 202, mw, 3); g.shadowColor = 'transparent';
  label(g, 'ONE SAMPLE EVERY 15 SECONDS', W / 2, 246, { align: 'center', px: 15, col: PAL.mute });
  g.restore();
  if (a > 0.9) reg(g, 'rungs', RUNGS.join(' · '), xs[0], 166, xs[4] + ws[4], 210);
}
// transform helper: maps rect `from` (child framing) onto cell `to` at log-progress u (0 = cell fills the child's framing)
function zoomT(from, to, u) {
  const s0 = from.w / to.w, s = Math.exp(Math.log(s0) * (1 - u));
  const cx = lerp(from.x + from.w / 2, to.x + to.w / 2, u), cy = lerp(from.y + from.h / 2, to.y + to.h / 2, u);
  return { s, cx, cy, tcx: to.x + to.w / 2, tcy: to.y + to.h / 2 };
}
const applyParent = (g, Z) => { g.translate(Z.cx, Z.cy); g.scale(Z.s, Z.s); g.translate(-Z.tcx, -Z.tcy); };
const applyChild = (g, Z, from, to) => { const k = Z.s * to.w / from.w; g.translate(Z.cx, Z.cy); g.scale(k, k); g.translate(-(from.x + from.w / 2), -(from.y + from.h / 2)); };

function drawTileCard(g, _t, a = 1) {
  const { x, y, w, h } = TILE_C;
  g.save(); g.globalAlpha *= a;
  E.panel(g, x, y, w, h, { r: 26, fill: '#151925', shadow: 1 });
  g.strokeStyle = rgba(PAL.accent, 0.8); g.lineWidth = 2; g.shadowColor = rgba(PAL.accent, 0.6); g.shadowBlur = 18; rr(g, x + 1, y + 1, w - 2, h - 2, 26); g.stroke(); g.shadowColor = 'transparent';
  label(g, 'ONE SAMPLE', x + 40, y + 56, { px: 16, col: PAL.accent });
  label(g, 'EVERY 15 S', x + w - 40, y + 56, { px: 16, align: 'right' });
  text(g, '10:42:15', x + 40, y + 160, { px: 92, wt: 600, fam: 'disp', track: -0.03, id: a > 0.95 ? 'tileTime' : null });
  g.fillStyle = CAT.code.col; rr(g, x + 40, y + 200, 52, 52, 13); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x + 60, y + 214); g.lineTo(x + 52, y + 226); g.lineTo(x + 60, y + 238); g.moveTo(x + 72, y + 214); g.lineTo(x + 80, y + 226); g.lineTo(x + 72, y + 238); g.stroke();
  text(g, 'Code editor', x + 112, y + 224, { px: 28, wt: 600 });
  text(g, 'checkout.ts — cart totals', x + 112, y + 252, { px: 19, fam: 'mono', col: PAL.dim });
  g.restore();
}
function drawHour(g, _t, fillT = 1) {
  g.fillStyle = 'rgba(255,255,255,.02)'; rr(g, L1.x - 24, L1.y - 24, L1.w + 48, L1.h + 48, 22); g.fill();
  hourTiles(g, DAY, 10, { x: L1.x, y: L1.y, w: L1.w, h: L1.h }, 1, fillT);
  const c = L1cell(TILE_I);
  g.strokeStyle = PAL.accent; g.lineWidth = 2; g.shadowColor = rgba(PAL.accent, 0.8); g.shadowBlur = 10; rr(g, c.x - 1, c.y - 1, c.w + 2, c.h + 2, 6); g.stroke(); g.shadowColor = 'transparent';
}
function drawDay(g, _t, a = 1, labels = 1) {
  dayRow(g, DAY, { x: L2.x, y: L2.y, w: L2.w, h: L2.ch }, a);
  for (let h = 9; h < 19; h++) { const c = L2cell(h); label(g, `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`, c.x + c.w / 2, c.y + c.h + 30, { align: 'center', px: 14, col: PAL.mute, alpha: labels }); }
  const c = L2cell(10); g.strokeStyle = PAL.accent; g.lineWidth = 2; rr(g, c.x - 2, c.y - 2, c.w + 4, c.h + 4, 8); g.stroke();
}
function drawWeek(g, _t, a = 1, labels = 1) {
  ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach((d, i) => {
    const r = L3row(i);
    label(g, d, r.x - 24, r.y + r.h / 2 + 6, { align: 'right', px: 16, col: i === 1 ? PAL.text : PAL.mute, alpha: labels });
    if (!WEEK_MIN[i]) { g.fillStyle = 'rgba(255,255,255,.025)'; rr(g, r.x, r.y, r.w, r.h, 8); g.fill(); return; }
    dayRow(g, WEEK_DAYS[i], r, a);
    label(g, fmt(WEEK_MIN[i]), r.x + r.w + 24, r.y + r.h / 2 + 6, { px: 16, col: i === 1 ? PAL.text : PAL.dim, alpha: labels });
  });
  const r = L3row(1); g.strokeStyle = PAL.accent; g.lineWidth = 2; rr(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 9); g.stroke();
}
const YEAR_H = (c, d) => { if (c > WEEKCOL || (c === WEEKCOL && d > 4)) return -1; if (c === 0 && d < 3) return -1; if (d >= 5) return hash(c * 7.7 + d) < 0.12 ? 0.25 : 0; return hash(c * 3.3 + d * 9.1) < 0.06 ? 0 : 0.35 + 0.65 * hash(c * 1.9 + d * 5.3); };
function drawYear(g, t, t0, sweep = -1) {
  for (let c = 0; c < L4.cols; c++) for (let d = 0; d < 7; d++) {
    if (c === WEEKCOL && t < K.rungs[3]) continue;
    const dist = Math.abs(c - WEEKCOL) + Math.abs(d - 1) * 0.5, k = back(seg(t, t0 + dist * 0.011, t0 + dist * 0.011 + 0.2), 1.5); if (k <= 0) continue;
    const r = L4cell(c, d), v = YEAR_H(c, d), s = L4.cell * clamp(k, 0, 1.2);
    g.fillStyle = v < 0 ? 'rgba(255,255,255,.03)' : v === 0 ? 'rgba(255,255,255,.06)' : rgba(PAL.accent, 0.12 + 0.78 * v);
    rr(g, r.x + (L4.cell - s) / 2, r.y + (L4.cell - s) / 2, s, s, 5); g.fill();
  }
  ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].forEach((m, i) => label(g, m, L4.x + (i * 4.42) * (L4.cell + L4.gap), L4.y - 22, { px: 14, col: PAL.mute, alpha: seg(t, t0 + 0.2, t0 + 0.5) }));
  if (sweep >= 0 && sweep <= 1) { // light sweep across the heatmap
    const x = lerp(L4.x - 200, L4.x + L4.w + 200, sweep), gr = g.createLinearGradient(x - 180, 0, x + 40, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(235,250,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(L4.x - 10, L4.y - 10, L4.w + 20, L4.h + 20); g.restore();
  }
}
function sceneLadder(g, t) {
  stage(g); E.grid(g, { alpha: 0.75 });
  const [r1, r2, r3, r4] = K.rungs;
  if (t < K.tile) {   // dive into the code lane at 10:42
    const u = ei(seg(t, K.dive, K.tile)), z = Math.exp(lerp(0, Math.log(16), u));
    const px = xOf(10 * 60 + 42), py = LANE_Y(0);
    g.save(); g.translate(lerp(W / 2, W / 2, u), H / 2); g.scale(z, z); g.translate(-lerp(W / 2, px, eio(seg(t, K.dive, K.tile))), -lerp(H / 2, py, eio(seg(t, K.dive, K.tile))));
    scenePlayStatic(g, t);
    g.restore();
    g.fillStyle = rgba(CAT.code.col, ei(seg(t, K.tile - 0.2, K.tile))); g.fillRect(0, 0, W, H);
  } else if (t < K.hour) {
    const p = back(seg(t, K.tile, K.tile + 0.3), 1.4);
    g.fillStyle = rgba(CAT.code.col, 1 - eo(seg(t, K.tile, K.tile + 0.3))); g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, 540); g.scale(lerp(0.3, 1, p), lerp(0.3, 1, p)); g.translate(-W / 2, -540);
    drawTileCard(g, t, clamp(p * 2)); g.restore();
  } else if (t < r1) {  // tile → hour
    const u = eio(seg(t, K.hour, K.hourFill)), Z = zoomT(TILE_C, L1cell(TILE_I), u);
    const fill = lerp((TILE_I + 1) / 240, 1, seg(t, K.hourFill, r1 - 0.2));
    g.save(); applyParent(g, Z); drawHour(g, t, fill); g.restore();
    if (u < 1) { g.save(); applyChild(g, Z, TILE_C, L1cell(TILE_I)); drawTileCard(g, t, 1 - seg(u, 0.25, 0.7)); g.restore(); }
  } else if (t < r2) {  // hour → day
    const u = eio(seg(t, r1, r2)), from = { x: L1.x, y: L1.y, w: L1.w, h: L1.h }, Z = zoomT(from, L2cell(10), u);
    g.save(); applyParent(g, Z); drawDay(g, t, 1, seg(u, 0.5, 1)); g.restore();
    g.save(); applyChild(g, Z, from, L2cell(10)); g.globalAlpha = 1 - seg(u, 0.4, 0.9); drawHour(g, t, 1); g.restore();
  } else if (t < r3) {  // day → week
    const u = eio(seg(t, r2, r3)), from = { x: L2.x, y: L2.y, w: L2.w, h: L2.ch }, Z = zoomT(from, L3row(1), u);
    g.save(); applyParent(g, Z); drawWeek(g, t, 1, seg(u, 0.5, 1)); g.restore();
  } else {              // week → year (rows fold into one column of days), then hold
    const u = eio(seg(t, r3, r4));
    drawYear(g, t, r3 + 0.1, seg(t, K.yearSweep, K.yearSweep + 1.3));
    for (let d = 0; d < 7; d++) {
      const a = L3row(d), b = L4cell(WEEKCOL, d);
      const w = Math.exp(lerp(Math.log(a.w), Math.log(b.w), u)), h = Math.exp(lerp(Math.log(a.h), Math.log(b.h), u));
      const cx = lerp(a.x + a.w / 2, b.x + b.w / 2, u), cy = lerp(a.y + a.h / 2, b.y + b.h / 2, u);
      const r = { x: cx - w / 2, y: cy - h / 2, w, h }, v = YEAR_H(WEEKCOL, d);
      if (u < 1 && WEEK_MIN[d]) { g.save(); g.globalAlpha = 1 - seg(u, 0.2, 0.75); dayRow(g, WEEK_DAYS[d], r, 1); g.restore(); }
      g.fillStyle = v < 0 ? `rgba(255,255,255,${0.03})` : rgba(PAL.accent, (0.12 + 0.78 * Math.max(0, v)) * seg(u, 0.4, 1));
      if (d === 1) g.fillStyle = rgba(PAL.accent, seg(u, 0.4, 1));
      rr(g, r.x, r.y, r.w, r.h, lerp(8, 5, u)); g.fill();
      if (d === 1) { g.strokeStyle = PAL.accent; g.lineWidth = 2; g.shadowColor = rgba(PAL.accent, 0.8); g.shadowBlur = 12 * u; rr(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 7); g.stroke(); g.shadowColor = 'transparent'; }
    }
  }
  rungBar(g, t);
  vig(g);
}
// the lanes frame without the playhead (for the dive)
function scenePlayStatic(g, _t) { scenePlay(g, K.laneLand + 1.2); }

// ───────────────── 7. focus session + blocker + score ─────────────────
const RING = { x: 960, y: 520, r: 220 };
function sceneFocus(g, t) {
  stage(g); E.grid(g, { alpha: 0.8 });
  const run = seg(t, K.focusRun, K.ringFull), done = t >= K.ringFull;
  const ent = back(seg(t, K.focus + 0.1, K.focus + 0.45), 1.3);
  g.save(); g.translate(RING.x, RING.y); g.scale(ent, ent); g.translate(-RING.x, -RING.y);
  // ring
  g.lineCap = 'round'; g.lineWidth = 20; g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.arc(RING.x, RING.y, RING.r, 0, TAU); g.stroke();
  const frac = done ? eo(seg(t, K.ringFull + 0.25, K.ringFull + 0.95)) * 0.86 : 1 - run;
  if (frac > 0.001) {
    g.strokeStyle = PAL.accent; g.shadowColor = rgba(PAL.accent, 0.7); g.shadowBlur = 24;
    g.beginPath(); g.arc(RING.x, RING.y, RING.r, -Math.PI / 2, -Math.PI / 2 + TAU * frac); g.stroke(); g.shadowColor = 'transparent';
  }
  const flash = done ? 1 - seg(t, K.ringFull, K.ringFull + 0.4) : 0;
  if (flash > 0) { g.strokeStyle = rgba(PAL.accent, flash); g.lineWidth = 20 + 30 * (1 - flash); g.beginPath(); g.arc(RING.x, RING.y, RING.r, 0, TAU); g.stroke(); E.glow(g, RING.x, RING.y, 420, PAL.accent, 0.25 * flash); }
  if (!done || t < K.ringFull + 0.2) {
    const sec = Math.ceil(25 * 60 * (1 - run)), mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss2 = String(sec % 60).padStart(2, '0');
    text(g, `${mm}:${ss2}`, RING.x, RING.y + 38, { px: 112, wt: 600, fam: 'disp', align: 'center', track: -0.02, alpha: 1 - seg(t, K.ringFull, K.ringFull + 0.2) });
    label(g, 'FOCUS', RING.x, RING.y - 72, { align: 'center', px: 18, col: PAL.accent, alpha: 1 - seg(t, K.ringFull, K.ringFull + 0.2) });
  }
  if (t >= K.ringFull + 0.05) {
    label(g, 'FOCUS SCORE', RING.x, RING.y - 72, { align: 'center', px: 18, col: PAL.accent, alpha: seg(t, K.ringFull + 0.05, K.ringFull + 0.2), id: 'scoreLbl' });
    E.scramble(g, '86', RING.x - 14, RING.y + 50, t, K.scoreLocks, { px: 150, wt: 600, fam: 'disp', align: 'center', tracking: -0.045, start: K.ringFull + 0.25 });
    if (t > K.scoreLocks[1]) text(g, '/100', RING.x + 78, RING.y + 50, { px: 30, wt: 500, fam: 'disp', col: PAL.dim, alpha: seg(t, K.scoreLocks[1], K.scoreLocks[1] + 0.15) });
  }
  g.restore();
  label(g, 'FOCUS SESSION · 25 MIN', W / 2, 208, { align: 'center', px: 17, alpha: seg(t, K.focus + 0.3, K.focus + 0.6), id: 'focusHdr' });
  text(g, 'Checkout redesign  ·  Northwind', W / 2, 816, { px: 26, align: 'center', col: PAL.dim, alpha: seg(t, K.focus + 0.4, K.focus + 0.7) });
  // the distraction: a feed tile slides in, the blocker answers
  const fIn = eo(seg(t, K.feed, K.feed + 0.24)), sq = seg(t, K.squash, K.squash + 0.24);
  if (fIn > 0 && sq < 1) {
    const [sx, sy, al] = crt(sq); const fx = lerp(1980, 1420, fIn), fy = 330;
    g.save(); g.translate(fx + 150, fy + 90); g.scale(sx, sy); g.translate(-(fx + 150), -(fy + 90)); g.globalAlpha = al;
    E.panel(g, fx, fy, 300, 180, { r: 18, fill: '#1A1E28' });
    g.fillStyle = 'rgba(207,104,144,.18)'; rr(g, fx + 14, fy + 14, 272, 112, 12); g.fill();
    g.fillStyle = CAT.feed.col; g.beginPath(); g.moveTo(fx + 138, fy + 50); g.lineTo(fx + 168, fy + 70); g.lineTo(fx + 138, fy + 90); g.closePath(); g.fill();
    text(g, 'Video feed', fx + 16, fy + 158, { px: 20, wt: 600 }); text(g, 'Up next in 3…', fx + 150, fy + 158, { px: 16, col: PAL.dim });
    g.restore();
  }
  const bIn = seg(t, K.blocker, K.blocker + 0.3);
  if (bIn > 0 && sq < 1) {
    g.fillStyle = `rgba(4,5,8,${0.6 * eo(bIn) * (1 - sq)})`; g.fillRect(0, 0, W, H);
    const [sx, sy, al] = crt(sq), drop = (1 - back(bIn, 1.5)) * -60;
    const bx = 600, by = 240, bw = 720, bh = 560;
    g.save(); g.translate(W / 2, by + bh / 2); g.scale(sx, sy); g.translate(-W / 2, -(by + bh / 2)); g.translate(0, drop); g.globalAlpha = clamp(bIn * 4) * al;
    E.panel(g, bx, by, bw, bh, { r: 26, fill: '#11141B', shadow: 1.4 });
    // shield
    const sx0 = W / 2, sy0 = by + 92; g.strokeStyle = PAL.accent; g.lineWidth = 4; g.lineJoin = 'round'; g.shadowColor = rgba(PAL.accent, 0.7); g.shadowBlur = 14;
    g.beginPath(); g.moveTo(sx0, sy0 - 34); g.quadraticCurveTo(sx0 + 18, sy0 - 22, sx0 + 30, sy0 - 22); g.lineTo(sx0 + 30, sy0 + 2); g.quadraticCurveTo(sx0 + 28, sy0 + 26, sx0, sy0 + 38); g.quadraticCurveTo(sx0 - 28, sy0 + 26, sx0 - 30, sy0 + 2); g.lineTo(sx0 - 30, sy0 - 22); g.quadraticCurveTo(sx0 - 18, sy0 - 22, sx0, sy0 - 34); g.stroke(); g.shadowColor = 'transparent';
    text(g, 'Getting distracted?', W / 2, by + 200, { px: 50, wt: 700, align: 'center', track: -0.02, id: bIn >= 1 && sq === 0 ? 'blocker' : null });
    text(g, 'Video feed is blocked during this focus session.', W / 2, by + 250, { px: 23, align: 'center', col: PAL.dim });
    const pr = t >= K.press ? (t - K.press < 2 / 24 ? 0.94 : lerp(0.94, 1, spring((t - K.press - 2 / 24) / 0.4, 8, 0.4))) : 1;
    g.save(); g.translate(W / 2, by + 316); g.scale(pr, pr); g.translate(-W / 2, -(by + 316));
    g.fillStyle = t >= K.press && t < K.press + 0.25 ? E.mix(PAL.accent, '#ffffff', 0.35) : PAL.accent; g.shadowColor = rgba(PAL.accent, 0.4); g.shadowBlur = 20;
    rr(g, bx + 50, by + 286, bw - 100, 62, 14); g.fill(); g.shadowColor = 'transparent';
    text(g, 'Thanks for the reminder!', W / 2, by + 326, { px: 25, wt: 700, align: 'center', col: '#06222A' });
    g.restore();
    ['This is not a distraction.', 'End this focus session now'].forEach((s, i) => {
      const yy = by + 366 + i * 76; g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.2; rr(g, bx + 50.5, yy + .5, bw - 101, 61, 14); g.stroke();
      text(g, s, W / 2, yy + 40, { px: 23, align: 'center', col: PAL.text, alpha: 0.85 });
    });
    g.restore();
  }
  vig(g);
}

// ───────────────── 8. reports + the timesheet, done ─────────────────
const REP = [['Checkout redesign', 'Northwind', 860], ['Q4 roadmap', 'Internal', 545], ['Mobile app', 'Acme Co.', 460], ['Support', 'Northwind', 355], ['Learning', '—', 257]];
const RP = { x: 300, y: 190, w: 1320, h: 640 };
const EXPORT_BTN = { x: RP.x + RP.w - 230, y: RP.y + 40, w: 190, h: 50 };
function drawReport(g, t) {
  const { x, y, w, h } = RP;
  E.panel(g, x, y, w, h, { r: 24, fill: '#12151C', shadow: 1.2 });
  text(g, 'Reports', x + 48, y + 78, { px: 40, wt: 700, id: 'reports' });
  label(g, 'THIS WEEK · BY PROJECT', x + 48, y + 116, { px: 16 });
  ['Project', 'Client', 'Task', 'App'].forEach((s, i) => {
    const bx = x + 420 + i * 120; if (i === 0) { g.fillStyle = PAL.surf3; rr(g, bx - 10, y + 46, 110, 42, 10); g.fill(); }
    text(g, s, bx + 45, y + 74, { px: 19, align: 'center', col: i === 0 ? PAL.text : PAL.mute });
  });
  // export button
  const pressed = t >= K.export && t < K.export + 0.3, pk = t >= K.export ? (t - K.export < 2 / 24 ? 0.93 : lerp(0.93, 1, spring((t - K.export - 2 / 24) / 0.4, 8, 0.4))) : 1;
  const B = EXPORT_BTN; g.save(); g.translate(B.x + B.w / 2, B.y + B.h / 2); g.scale(pk, pk); g.translate(-(B.x + B.w / 2), -(B.y + B.h / 2));
  g.fillStyle = pressed ? PAL.accent : 'rgba(255,255,255,.05)'; rr(g, B.x, B.y, B.w, B.h, 12); g.fill();
  g.strokeStyle = rgba(PAL.accent, 0.7); g.lineWidth = 1.5; rr(g, B.x + .5, B.y + .5, B.w - 1, B.h - 1, 12); g.stroke();
  const ic = pressed ? '#06222A' : PAL.accent; g.strokeStyle = ic; g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(B.x + 30, B.y + 15); g.lineTo(B.x + 30, B.y + 31); g.moveTo(B.x + 23, B.y + 25); g.lineTo(B.x + 30, B.y + 32); g.lineTo(B.x + 37, B.y + 25); g.moveTo(B.x + 22, B.y + 37); g.lineTo(B.x + 38, B.y + 37); g.stroke();
  text(g, 'Export CSV', B.x + 52, B.y + 33, { px: 20, wt: 600, col: ic });
  g.restore();
  // rows
  REP.forEach(([p, c, min], i) => {
    const ry = y + 196 + i * 78, bt = K.bars[i], u = eo(seg(t, bt, bt + 0.35));
    text(g, p, x + 48, ry, { px: 25, wt: 600, alpha: seg(t, K.report + 0.2 + i * 0.05, K.report + 0.4 + i * 0.05) });
    text(g, c, x + 48, ry + 28, { px: 18, col: PAL.mute, alpha: seg(t, K.report + 0.2 + i * 0.05, K.report + 0.4 + i * 0.05) });
    const bx = x + 400, bw = 640 * min / 860 * u;
    g.fillStyle = 'rgba(255,255,255,.04)'; rr(g, bx, ry - 20, 640, 26, 8); g.fill();
    if (bw > 1) { g.fillStyle = rgba(PAL.accent, 0.9 - i * 0.14); rr(g, bx, ry - 20, bw, 26, 8); g.fill(); }
    if (t > bt - 0.15) { const v = fmt(min); E.scramble(g, v, x + w - 48, ry, t, v.split('').map(() => bt + 0.3), { px: 24, wt: 500, fam: 'mono', align: 'right', tracking: 0, color: PAL.text, start: bt - 0.15 }); }
    if (i < 4) { g.fillStyle = PAL.line; g.fillRect(x + 48, ry + 44, w - 96, 1); }
  });
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 48, y + h - 70, w - 96, 1);
  text(g, 'Total', x + 48, y + h - 28, { px: 25, wt: 700 });
  text(g, '41h 17m', x + w - 48, y + h - 28, { px: 26, wt: 600, fam: 'mono', align: 'right', alpha: seg(t, K.bars[4] + 0.3, K.bars[4] + 0.5) });
}
function sceneReport(g, t) {
  stage(g); E.grid(g, { alpha: 0.8 });
  const zIn = back(seg(t, K.report, K.report + 0.35), 1.3), cx = lerp(990, 930, eio(seg(t, K.report, K.sheetBack + 2.5)));
  g.save(); g.translate(W / 2, H / 2); g.scale(lerp(1.06, 1.0, eio(seg(t, K.report, K.sheetBack))), lerp(1.06, 1.0, eio(seg(t, K.report, K.sheetBack)))); g.translate(-cx, -H / 2);
  g.save(); g.translate(W / 2, H / 2); g.scale(zIn, lerp(0.05, 1, zIn)); g.translate(-W / 2, -H / 2); g.globalAlpha = clamp(zIn * 3); drawReport(g, t); g.restore();
  // file chip
  const ch = eo(seg(t, K.export + 0.15, K.export + 0.4));
  if (ch > 0 && t < K.sheetBack + 0.1) {
    const B = EXPORT_BTN, cy = B.y + B.h + 20 + 30 * ch; g.save(); g.globalAlpha = ch; g.font = font(17, 500, 'mono'); const s = 'timesheet-week45.csv', w = g.measureText(s).width + 40;
    g.fillStyle = '#1A1E28'; rr(g, B.x + B.w - w, cy, w, 36, 18); g.fill(); g.strokeStyle = rgba(PAL.accent, 0.5); rr(g, B.x + B.w - w + .5, cy + .5, w - 1, 35, 18); g.stroke();
    g.fillStyle = PAL.text; g.textBaseline = 'middle'; g.fillText(s, B.x + B.w - w + 20, cy + 18); g.restore();
  }
  if (t >= K.sheetBack) {
    g.fillStyle = `rgba(4,5,8,${0.55 * seg(t, K.sheetBack, K.sheetBack + 0.3)})`; g.fillRect(-W, -H, W * 3, H * 3);
    sheetFrame(g, t, K.sheetBack, 'done', { x: EXPORT_BTN.x + 100, y: EXPORT_BTN.y + EXPORT_BTN.h + 70 });
  }
  g.restore();
  vig(g);
}

// ───────────────── 9. privacy: three connections cut, the data stays home ─────────────────
const MAC = { x: 240, y: 250, w: 900, h: 560 };
const GHOST = [['Account', 380], ['Cloud sync', 540], ['Analytics', 700]];
const FILES = ['events/2026-11-03.jsonl', 'db.json', 'rules.json', 'settings.json'];
function ghostIcon(g, i, x, y, a) {
  g.save(); g.globalAlpha *= a; g.strokeStyle = PAL.dim; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath();
  if (i === 0) { g.arc(x, y - 6, 7, 0, TAU); g.moveTo(x - 12, y + 13); g.quadraticCurveTo(x, y - 2, x + 12, y + 13); }
  else if (i === 1) { g.moveTo(x - 14, y + 9); g.lineTo(x + 12, y + 9); g.arc(x + 10, y + 1, 8, Math.PI / 2, -Math.PI / 2, true); g.arc(x - 1, y - 3, 10, 0, Math.PI, true); g.arc(x - 12, y + 3, 6, -Math.PI / 2, Math.PI / 2, true); }
  else { g.moveTo(x - 12, y + 12); g.lineTo(x - 12, y + 2); g.moveTo(x, y + 12); g.lineTo(x, y - 10); g.moveTo(x + 12, y + 12); g.lineTo(x + 12, y - 3); }
  g.stroke(); g.restore();
}
function scenePrivacy(g, t) {
  stage(g); E.grid(g, { alpha: 0.8 });
  const pan = eio(seg(t, K.cuts[2] + 0.3, K.rim)), z = lerp(1, 1.16, eio(seg(t, K.cuts[2] + 0.3, K.ending)));
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-lerp(W / 2, MAC.x + MAC.w / 2, pan), -lerp(H / 2, MAC.y + MAC.h / 2, pan));
  const op = eo(seg(t, K.privacy + 0.15, K.privacy + 0.5)), rim = seg(t, K.rim, K.rim + 0.5);
  // the Mac
  g.save(); g.globalAlpha = op;
  g.fillStyle = 'rgba(255,255,255,.018)'; rr(g, MAC.x, MAC.y, MAC.w, MAC.h, 36); g.fill();
  if (rim > 0) { g.shadowColor = rgba(PAL.accent, 0.8 * rim); g.shadowBlur = 40 * rim; }
  g.strokeStyle = rim > 0 ? E.mix('#5C6272', PAL.accent, rim) : 'rgba(232,234,240,.28)'; g.lineWidth = 1.5 + rim; rr(g, MAC.x + .5, MAC.y + .5, MAC.w - 1, MAC.h - 1, 36); g.stroke(); g.shadowColor = 'transparent';
  if (rim > 0) E.glow(g, MAC.x + MAC.w / 2, MAC.y + MAC.h / 2, 700, PAL.accent, 0.06 * rim);
  label(g, 'YOUR MAC', MAC.x + 44, MAC.y + 62, { px: 18, col: rim > 0 ? E.mix('#8A90A0', PAL.accent, rim) : PAL.dim, id: t > K.privacy + 0.6 ? 'yourMac' : null });
  FILES.forEach((f, i) => {
    const a = back(seg(t, K.privacy + 0.35 + i * S16, K.privacy + 0.6 + i * S16), 1.5), fy = MAC.y + 112 + i * 84;
    g.save(); g.globalAlpha *= clamp(a); g.translate(0, (1 - clamp(a)) * 20);
    E.panel(g, MAC.x + 44, fy, 560, 64, { r: 14, fill: '#161A23', shadow: 0.6 });
    g.fillStyle = 'rgba(255,255,255,.07)'; rr(g, MAC.x + 62, fy + 14, 36, 36, 8); g.fill();
    g.fillStyle = PAL.dim; for (let k = 0; k < 3; k++) g.fillRect(MAC.x + 70, fy + 23 + k * 7, k === 2 ? 12 : 20, 2);
    text(g, f, MAC.x + 116, fy + 40, { px: 21, fam: 'mono', col: PAL.text });
    g.restore();
  });
  label(g, '~/Library/Application Support/Cadence', MAC.x + 44, MAC.y + MAC.h - 40, { px: 16, col: PAL.mute, track: 0.04 });
  g.restore();
  // ghost services, cut one per word
  GHOST.forEach(([name, gy], i) => {
    const ct = K.cuts[i], ret = eio(seg(t, ct, ct + 0.18)), sq = seg(t, ct + 0.1, ct + 0.36); if (sq >= 1) return;
    const ap = seg(t, K.privacy + 0.15 + i * S16, K.privacy + 0.4 + i * S16); if (ap <= 0) return;
    const x0 = MAC.x + MAC.w, nx = 1420;
    g.save(); g.globalAlpha = ap;
    g.setLineDash([6, 8]); g.strokeStyle = 'rgba(232,234,240,.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(lerp(x0, nx, ret), gy); g.lineTo(nx, gy); g.stroke(); g.setLineDash([]);
    const [sx, sy, al] = crt(sq); g.translate(nx + 130, gy); g.scale(sx, sy); g.translate(-(nx + 130), -gy); g.globalAlpha *= al;
    g.setLineDash([5, 6]); g.strokeStyle = 'rgba(232,234,240,.35)'; rr(g, nx, gy - 34, 260, 68, 34); g.stroke(); g.setLineDash([]);
    ghostIcon(g, i, nx + 44, gy, 1); text(g, name, nx + 76, gy + 9, { px: 26, col: PAL.text, alpha: 0.8 });
    g.restore();
  });
  g.restore();
  vig(g);
}

// ───────────────── 10. the number again, then the end card ─────────────────
const BARX = 460, BARW = 1000;
function sceneEnding(g, t) {
  stage(g); E.grid(g, { alpha: 0.8 });
  const ec = K.endCard, out = seg(t, ec, ec + 0.3);
  if (t < ec + 0.35) {
    const locks = [K.ending + 0.3125, K.ending + 0.46875, K.ending + 0.625];
    const sy = 1 - ei(out);
    g.save(); g.translate(W / 2, 470); g.scale(1 - ei(out) * 0.6, sy); g.translate(-W / 2, -470);
    label(g, 'TUESDAY  ·  6:47 PM', W / 2, 250, { align: 'center', px: 22, alpha: seg(t, K.ending, K.ending + 0.3), id: 'endLabel' });
    bigNumber(g, t, locks, K.ending + 0.05, W / 2, 520, 270);
    g.restore();
    // the Mac outline closes into the bar
    const lineIn = eo(seg(t, K.ending, K.ending + 0.4));
    let x = BARX;
    CATS.forEach((c, i) => {
      const w = BARW * TOTALS[i] / 587, a = seg(t, K.ending + 0.3 + i * 0.04, K.ending + 0.5 + i * 0.04) * (1 - out);
      g.save(); g.globalAlpha *= a; g.fillStyle = c.col; rr(g, x + 1, 600, Math.max(2, w - 2) * lineIn, 16, 5); g.fill(); g.restore();
      x += w;
    });
    // legend: two centred rows, widths measured
    const itemW = i => { g.font = font(21, 500); const a = g.measureText(CATS[i].name).width; g.font = font(19, 500, 'mono'); return 18 + a + 12 + g.measureText(fmt(TOTALS[i])).width; };
    [[0, 1, 2, 3], [4, 5, 6]].forEach((row, r) => {
      const ws = row.map(itemW), gap = 52, tot = ws.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
      let lx = W / 2 - tot / 2;
      row.forEach((i, k) => {
        const c = CATS[i], ly = 690 + r * 52, la = clamp(back(seg(t, K.legend + i * S16, K.legend + i * S16 + 0.2), 1.5)) * (1 - out);
        if (la > 0) {
          g.save(); g.globalAlpha *= la; g.fillStyle = c.col; g.beginPath(); g.arc(lx + 6, ly - 7, 6, 0, TAU); g.fill(); g.restore();
          const nw = text(g, c.name, lx + 18, ly, { px: 21, col: PAL.text, alpha: la, id: t < ec ? 'leg' + i : null });
          text(g, fmt(TOTALS[i]), lx + 18 + nw + 12, ly, { px: 19, fam: 'mono', col: PAL.dim, alpha: la });
        }
        lx += ws[k] + gap;
      });
    });
  }
  if (t >= ec) {
    // end card; then put away one element per beat until only the dot is left
    const R = (k) => seg(t, K.outro + k * BEAT, K.outro + k * BEAT + 0.22);
    const ip = back(seg(t, ec + 0.05, ec + 0.45), 1.4), ringOut = eio(seg(t, K.outro + 2 * BEAT, K.outro + 2 * BEAT + 0.3));
    const s = 230 * clamp(ip, 0, 1.2), cy = 330;
    if (ringOut < 1) {
      g.save(); g.globalAlpha *= 1;
      const pAlpha = 1 - R(2);
      if (pAlpha > 0) {
        const [c, cg] = E.buf('icon2', 700, 700); cg.clearRect(0, 0, 700, 700); appIcon(cg, 350, 350, s, { p: 0, panelA: 1 });
        g.save(); g.globalAlpha *= pAlpha; E.lightReveal(g, c, W / 2 - 350, cy - 350, 700, 700, eio(seg(t, ec + 0.1, ec + 1.2)), { base: 0.0, soft: 300, glint: 0.18 }); g.restore();
      }
      ringPath(g, W / 2, cy, s * 0.3034, 1 - ringOut, { track: pAlpha, glowA: 0.8, dot: 1 });
      g.restore();
    } else {
      const off = seg(t, K.dotOff, K.dotOff + 0.22), [sx, sy, al] = crt(off);
      const dx = W / 2 + Math.cos(A0) * s * 0.3034, dy = cy + Math.sin(A0) * s * 0.3034;
      if (al > 0) { g.save(); g.translate(dx, dy); g.scale(sx * (1 + 0.3 * Math.sin(Math.PI * seg(t, K.outro + 2.5 * BEAT, K.dotOff))), sy); g.globalAlpha = al; E.glow(g, 0, 0, 60, '#00EDFF', 0.4); g.fillStyle = '#00EDFF'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.restore(); }
    }
    const wa = seg(t, ec + 0.3, ec + 0.6) * (1 - R(1.5));
    text(g, 'Cadence', W / 2, 590, { px: 120, wt: 600, align: 'center', track: -0.035, alpha: wa, id: 'endWord' });
    text(g, 'Automatic time tracking for macOS', W / 2, 656, { px: 34, wt: 400, align: 'center', col: PAL.dim, alpha: seg(t, ec + 0.5, ec + 0.8) * (1 - R(1)), id: 'endTag' });
    label(g, 'FREE  ·  OPEN SOURCE  ·  NO ACCOUNT', W / 2, 740, { align: 'center', px: 19, col: PAL.accent, alpha: seg(t, ec + 0.7, ec + 1.0) * (1 - R(0.5)), id: 'endFree' });
    text(g, 'suzalshrestha.github.io/cadence', W / 2, 800, { px: 24, fam: 'mono', align: 'center', col: PAL.text, alpha: seg(t, ec + 0.6, ec + 0.9) * (1 - R(0)), id: "endUrl" });
  }
  vig(g);
}

// ───────────────── subtitles ─────────────────
let LINES = null;
export function setLines(lines, dur) {
  LINES = lines.map(l => { const d = dur?.[l.id] ?? 1.5; return { id: l.id, text: l.sub || l.text, onscreen: !!l.onscreen, t0: K.vo[l.id], t1: K.vo[l.id] + Math.max(1.8, d + 0.6), d }; });
}
export function subs() { return (LINES || []).map(l => ({ t0: +l.t0.toFixed(3), t1: +l.t1.toFixed(3), text: l.text })); }
function drawSubs(g, t) {
  if (!LINES) return;
  for (const l of LINES) {
    if (l.onscreen || t < l.t0 || t > l.t1) continue;
    const a = Math.min(clamp((t - l.t0) / 0.16), clamp((l.t1 - t) / 0.16));
    E.toast(g, l.text, a, { dense: t < K.freeze ? 1 : 0 });
  }
}

// ───────────────── assembly ─────────────────
export function renderFilm(g, t, o = {}) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  if (t < K.tlOpen) sceneHook(g, t);
  else if (t < K.sheet) sceneDay(g, t);
  else if (t < K.turn) sceneAsk(g, t);
  else if (t < K.collapse) sceneTurn(g, t);
  else if (t < K.collapse + 0.25) sceneCollapse(g, t);
  else if (t < K.dive) scenePlay(g, t);
  else if (t < K.focus) sceneLadder(g, t);
  else if (t < K.report) sceneFocus(g, t);
  else if (t < K.privacy) sceneReport(g, t);
  else if (t < K.ending) scenePrivacy(g, t);
  else sceneEnding(g, t);
  transitions(g, t);
  if (!o.nosub) drawSubs(g, t);
}
// 25.0–25.25: the icon puts itself away into its dot
function sceneCollapse(g, t) {
  stage(g); E.grid(g, { alpha: 1 });
  const u = seg(t, K.collapse, K.collapse + 0.25), P = iconPose(K.collapse - 0.01), s = P.r / 0.3034;
  const [, sy] = crt(u);
  g.save(); g.translate(P.x, P.y); g.scale(1, sy); g.translate(-P.x, -P.y); appIcon(g, P.x, P.y, s, { p: 0, panelA: 1 - u }); g.restore();
  ringPath(g, P.x, P.y, P.r, 1 - eio(u), { track: 0, glowA: 1 });
  g.save(); g.beginPath(); g.rect(860, 300, 1000 * (1 - eio(seg(u, 0, 0.7))), 400); g.clip();
  text(g, 'Cadence', 860, 545, { px: 150, wt: 600, track: -0.035 }); text(g, 'Automatic time tracking for macOS', 866, 618, { px: 36, wt: 400, col: PAL.dim });
  g.restore();
  vig(g);
}
// UI-expand transitions that live between scenes
function transitions(g, t) {
  // year → focus: Tuesday's cell grows into the whole frame
  if (t >= K.focus - 0.05 && t < K.focus + 0.35) {
    const u = eio(seg(t, K.focus - 0.05, K.focus + 0.2)), c = L4cell(WEEKCOL, 1), a = 1 - seg(t, K.focus + 0.15, K.focus + 0.35);
    g.save(); g.globalAlpha = a; g.fillStyle = E.mix(PAL.accent, '#12151C', u * 0.92);
    rr(g, lerp(c.x, -20, u), lerp(c.y, -20, u), lerp(c.w, W + 40, u), lerp(c.h, H + 40, u), lerp(5, 0, u)); g.fill(); g.restore();
  }
  // focus → report: the ring folds away
  if (t >= K.report && t < K.report + 0.25) {
    const [sx, sy, al] = crt(seg(t, K.report, K.report + 0.25));
    g.save(); g.translate(RING.x, RING.y); g.scale(sx, sy); g.globalAlpha = al; g.strokeStyle = PAL.accent; g.lineWidth = 20; g.beginPath(); g.arc(0, 0, RING.r, 0, TAU); g.stroke(); g.restore();
  }
  // report → privacy: the timesheet folds into a point, the Mac opens from it
  if (t >= K.privacy && t < K.privacy + 0.3) {
    const [sx, sy, al] = crt(seg(t, K.privacy, K.privacy + 0.3));
    g.save(); g.translate(SH.x + SH.w / 2, SH.y + SH.h / 2); g.scale(sx, sy); g.translate(-(SH.x + SH.w / 2), -(SH.y + SH.h / 2)); g.globalAlpha = al; drawSheet(g, K.privacy, 'done'); g.restore();
  }
  // privacy → ending: the Mac outline closes into the bar of the day
  if (t >= K.ending && t < K.ending + 0.35) {
    const u = eio(seg(t, K.ending, K.ending + 0.35));
    const z = 1.16;
    const x0 = lerp(W / 2 - MAC.w * z / 2, BARX, u), x1 = lerp(W / 2 + MAC.w * z / 2, BARX + BARW, u), y0 = lerp(H / 2 - MAC.h * z / 2, 600, u), y1 = lerp(H / 2 + MAC.h * z / 2, 616, u);
    g.save(); g.globalAlpha = 1 - seg(u, 0.7, 1); g.strokeStyle = PAL.accent; g.lineWidth = 2; g.shadowColor = rgba(PAL.accent, 0.8); g.shadowBlur = 20;
    rr(g, x0, y0, x1 - x0, y1 - y0, lerp(36 * z, 5, u)); g.stroke(); g.restore();
  }
}

// ───────────────── readcheck: texts on screen ─────────────────
export function textsAt(g, t) { REG = []; renderFilm(g, t, { nosub: true }); const r = REG; REG = null; return r; }

// ───────────────── events for the mix ─────────────────
export function buildEvents() {
  const ev = [], add = (t, type, x = {}) => ev.push({ t: +t.toFixed(4), type, ...x });
  const panX = x => +clamp(x / W * 2 - 1, -1, 1).toFixed(2);
  add(K.hookLabel, 'tick'); K.locks.forEach((t, i) => add(t, 'lock', { i }));
  add(K.numIn, 'grains', { d: K.locks[2] - K.numIn });
  add(K.tlOpen, 'open'); add(K.tlOpen + 0.3, 'bar_open');
  K.rem.forEach((t, i) => add(t, 'mem', { i, pan: panX(camDay(t).proj(xOf((MEM[i][0] + MEM[i][1]) / 2), BAR_Y).x) }));
  add(K.hatch, 'hatch');
  SLIV.forEach((s, i) => add(s.t, 'sliver', { i, pan: panX(camDay(s.t).proj(xOf(s.m), BAR_Y).x), chip: s.chip >= 0 ? 1 : 0 }));
  add(K.sheet, 'sheet'); add(K.freeze, 'freeze');
  for (let t = K.sheet + 0.5; t < K.freeze; t += BEAT) add(t, 'caret');
  add(K.turn, 'turn'); add(K.turn + 0.1, 'arc', { d: K.ringDone - K.turn - 0.1 }); add(K.icon - 0.35, 'shimmer', { d: 1.6 }); add(K.word + 0.1, 'word');
  add(K.collapse, 'collapse'); add(K.collapse + 0.25, 'fly'); add(K.collapse + 0.45, 'bar_open');
  DAY.forEach((s, _i) => { const u = (s.a - T0) / (NOW - T0); let lo = K.sweep0, hi = K.sweep1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (ss(seg(m, K.sweep0, K.sweep1)) < u) lo = m; else hi = m; } add(lo, 'resolve', { c: CAT[s.c].i, pan: panX(xOf(s.a)) }); });
  DAY.forEach((s, _i) => { const P = segPose(s, 0); add(P.d0 + 0.3, 'land', { c: CAT[s.c].i, pan: panX(xOf(s.a)) }); });
  CATS.forEach((_c, i) => add(K.laneLand + i * S16, 'total', { i }));
  add(K.dive, 'dive'); add(K.tile, 'tile'); add(K.hour, 'rung', { i: 0 });
  for (let n = TILE_I + 1; n < 240; n += 3) add(lerp(K.hourFill, K.rungs[0] - 0.2, (n - TILE_I - 1) / (240 - TILE_I - 1)), 'sample', { n });
  K.rungs.slice(0, 3).forEach((t, i) => add(t, 'rung', { i: i + 1 })); add(K.rungs[3], 'year'); add(K.yearSweep, 'shimmer', { d: 1.4 });
  add(K.focus - 0.05, 'expand'); add(K.focusRun, 'focus_start'); add(K.feed, 'feed'); add(K.blocker, 'blocker'); add(K.press, 'press'); add(K.squash, 'crt');
  add(K.ringFull, 'ring_full'); K.scoreLocks.forEach((t, i) => add(t, 'lock', { i: i + 3 })); add(K.ringFull + 0.25, 'grains', { d: 0.6 });
  add(K.report, 'crt'); add(K.report + 0.1, 'expand'); K.bars.forEach((t, i) => add(t, 'bar', { i })); add(K.export, 'press_soft'); add(K.export + 0.2, 'chip');
  add(K.sheetBack, 'sheet'); add(K.sheetBack + 0.15, 'grains', { d: K.sheetLocks[5] - K.sheetBack - 0.15 }); K.sheetLocks.forEach((t, i) => add(t, 'lock', { i: 10 + i })); add(K.sheetLocks[5] + 0.2, 'check');
  add(K.privacy, 'crt'); add(K.privacy + 0.15, 'expand'); FILES.forEach((_f, i) => add(K.privacy + 0.35 + i * S16, 'file', { i }));
  GHOST.forEach((_gh, i) => add(K.privacy + 0.15 + i * S16, 'ghost', { i })); K.cuts.forEach((t, i) => add(t, 'cut', { i }));
  add(K.hush, 'hush'); add(K.rim, 'rim');
  add(K.ending, 'close'); [0.3125, 0.46875, 0.625].forEach((d, i) => add(K.ending + d, 'lock', { i: 20 + i })); add(K.ending + 0.05, 'grains', { d: 0.58 });
  CATS.forEach((_c, i) => add(K.legend + i * S16, 'legend', { i }));
  add(K.endCard, 'end_card'); add(K.endCard + 0.1, 'shimmer', { d: 1.6 });
  [0, 0.5, 1, 1.5, 2].forEach((k, i) => add(K.outro + k * BEAT, 'retract', { i })); add(K.dotOff, 'dot_off');
  if (LINES) LINES.forEach(l => add(l.t0, 'vo', { id: l.id, d: l.d }));
  ev.sort((a, b) => a.t - b.t);
  ev.unshift({ t: 0, type: "meta", K, BEAT, DUR });
  return ev;
}
export const TIMELINE = { K, DUR, BEAT, BAR, S16, S8 };

// ───────────────── poster: the year, the mark, the question ─────────────────
export function renderPoster(g) {
  g.setTransform(1, 0, 0, 1, 0, 0); stage(g); E.grid(g, { alpha: 0.8 });
  g.save(); g.translate(0, 150); drawYear(g, 60, K.rungs[3], 0.62);
  const c = L4cell(WEEKCOL, 1); g.strokeStyle = PAL.accent; g.lineWidth = 2; g.shadowColor = rgba(PAL.accent, 0.9); g.shadowBlur = 14; rr(g, c.x - 3, c.y - 3, c.w + 6, c.h + 6, 7); g.stroke(); g.restore();
  appIcon(g, 640, 300, 190, { p: 1 });
  text(g, 'Cadence', 770, 300, { px: 112, wt: 600, track: -0.035 });
  text(g, 'Where did the day go?', 776, 362, { px: 40, wt: 400, col: PAL.dim });
  label(g, 'AUTOMATIC TIME TRACKING FOR macOS  ·  FREE  ·  OPEN SOURCE', W / 2, 1000, { align: 'center', px: 18, col: PAL.mute });
  vig(g);
}
