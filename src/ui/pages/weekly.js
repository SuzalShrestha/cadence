// Weekly productivity assessment: the sections of Rize's weekly PDF, computed locally (core.weeklyReport).
import { api, esc, icon, $, $$, today, rangeOf, addDays, shortDate, weekday, durText, dur, hm, catColor, catLabel, barChart, tips } from '../lib.js';

let el, from, r;
const lastWeek = () => rangeOf('week', addDays(today(), -7))[0];

export async function mount(root, { sub }) { el = root; from = /^\d{4}-\d{2}-\d{2}$/.test(sub || '') ? rangeOf('week', sub)[0] : lastWeek(); await load(); }
export const refresh = () => load();

async function load() { r = await api('weekly', from); draw(); }

const p100 = (x) => `${Math.round(x * 100)}%`;
const pts = (d) => (d == null ? '<span class="delta flat">—</span>' : `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '+' : ''}${d} pts</span>`);
const diff = (cur, base, fmt = durText) => { const d = cur - base; return `${fmt(Math.abs(d))} ${d > 0 ? '↑' : d < 0 ? '↓' : ''}`; };
// Four numbers per metric, like the PDF: this week, 4-week average, and the difference.
const quad = (a, av, b, bv) => `<div class="wk-quad"><div><div class="label">${a}</div><div class="mid">${av}</div></div><div><div class="label">${b}</div><div class="mid">${bv}</div></div></div>`;
const section = (title, body, aside = '') => `<section class="card wk-sec"><div class="card-head"><span class="wk-h">${title}</span><span class="silent">${aside}</span></div>${body}</section>`;
const note = (t) => `<p class="wk-note">${esc(t)}</p>`;
const dayBars = (key, color, unit = 3600) => barChart(r.work.days.map((d) => ({ label: weekday(d.key), target: 0, stacks: [{ value: d[key], color }], tip: `<b>${esc(weekday(d.key, 'long'))}</b>${durText(d[key])}` })), { height: 150, showTarget: false, unit });

function timeline() {
  const ds = r.work.days.filter((d) => d.first);
  if (!ds.length) return '<div class="silent">No activity.</div>';
  const hour = (t) => { const x = new Date(t * 1000); return x.getHours() + x.getMinutes() / 60; };
  const lo = Math.floor(Math.min(...ds.map((d) => hour(d.first)))), hi = Math.ceil(Math.max(...ds.map((d) => hour(d.last) || 24)));
  const pos = (h) => ((h - lo) / Math.max(1, hi - lo)) * 100;
  return r.work.days.map((d) => `<div class="wk-row"><span>${weekday(d.key)}</span><div class="wk-track">${d.first ? `<i style="left:${pos(hour(d.first))}%;width:${Math.max(1, pos(hour(d.last) || 24) - pos(hour(d.first)))}%" data-tip="${hm(d.first)} – ${hm(d.last)}"></i>` : ''}</div><span class="quiet tnum">${d.first ? `${hm(d.first)} – ${hm(d.last)}` : ''}</span></div>`).join('');
}

function restVsOver() {
  const cap = 8 * 3600;
  return r.work.days.map((d) => {
    const x = d.active ? d.active - d.target : 0, w = (Math.min(cap, Math.abs(x)) / cap) * 50;
    return `<div class="wk-row"><span>${weekday(d.key)}</span><div class="wk-track wk-div">${x ? `<i style="${x < 0 ? `right:50%` : 'left:50%'};width:${w}%;background:${x > 0 ? 'var(--negative)' : 'var(--accent)'}"></i>` : ''}</div><span class="quiet tnum">${x ? `${x > 0 ? '+' : '−'}${durText(Math.abs(x))}` : ''}</span></div>`;
  }).join('') + '<div class="wk-row silent" style="font-size:11px"><span></span><div class="row" style="justify-content:space-between"><span>Resting</span><span>Target</span><span>Overworking</span></div><span></span></div>';
}

function draw() {
  const { work: w, breakdown: b, focus: f, meetings: m, breaks: br, coach } = r;
  const to = addDays(from, 6), last = from >= lastWeek();
  el.innerHTML = `
    <header class="bar"><div class="title">Weekly report</div><span class="silent">${esc(`${shortDate(from)} – ${shortDate(to)}`)}</span><div class="grow"></div>
      <button class="btn sm" data-pdf>${icon('download', 14)}Save PDF</button>
      <div class="seg"><button data-step="-7" aria-label="Previous week">${icon('chevron-left')}</button><button data-step="7" aria-label="Next week" ${last ? 'disabled' : ''}>${icon('chevron-right')}</button></div></header>
    <div class="page"><div class="wk">
      <section class="card wk-sec wk-coach"><div class="card-head"><span class="wk-h">${icon('zap', 16)} Productivity coach</span></div>
        <div class="label">Insight</div><p>${esc(coach.insight)}</p><div class="label">Recommendation</div><p>${esc(coach.recommendation)}</p></section>

      ${section('Work hours', `
        ${quad('Work hours', dur(w.total), 'Percent of target', w.pctTarget == null ? '—' : `${w.pctTarget}%<span class="u">of ${durText(w.target)}</span>`)}
        ${quad('4-week average', dur(w.avg4), 'Difference', diff(w.total, w.avg4))}
        ${note(w.text)}
        <div class="label">Work hours by day</div>${barChart(w.days.map((d) => ({ label: weekday(d.key), target: d.target, stacks: [{ value: d.active, color: 'var(--violet)' }], tip: `<b>${esc(weekday(d.key, 'long'))}</b>${durText(d.active)}` })), { height: 160, showTarget: true })}
        ${quad('Average per work day', dur(w.perDay), '4-week average', dur(w.perDay4))}
        ${note('A 6–8 hour work day is ideal. Days longer than 8 hours are linked to more stress.')}
        <div class="label">Timeline by day</div>${timeline()}
        ${note('A regular, consistent work schedule can reduce stress and anxiety.')}
        <div class="label">Resting vs. overworking</div>${restVsOver()}
        ${note(w.overText)}`)}

      ${section('Breakdown', `
        ${b.rows.map((x, i) => `<div class="legend-row" style="grid-template-columns:10px 90px 1fr 48px 64px"><span class="dot" style="background:${['var(--focus)', 'var(--meeting)', 'var(--break)', 'var(--idle)'][i]}"></span><span>${x.name}</span>
          <div class="meter" style="height:5px"><i style="width:${p100(x.share)};background:${['var(--focus)', 'var(--meeting)', 'var(--break)', 'var(--idle)'][i]}"></i></div><span class="tnum" style="text-align:right">${p100(x.share)}</span><span style="text-align:right">${pts(x.diff)}</span></div>`).join('')}
        ${note(b.text)}
        <div class="label" style="margin-top:12px">Top labels</div>
        ${r.categories.length ? r.categories.map((c) => `<div class="legend-row" style="grid-template-columns:10px 1fr 64px 48px 64px"><span class="dot" style="background:${catColor(c.name)}"></span><span class="ellipsis">${esc(catLabel(c.name))}</span><span class="quiet tnum" style="text-align:right">${durText(c.secs)}</span><span class="tnum" style="text-align:right">${p100(c.share)}</span><span style="text-align:right">${pts(c.diff)}</span></div>`).join('') : '<div class="silent">No activity.</div>'}
        <div class="label" style="margin-top:12px">Top projects</div>
        ${r.projects.length ? r.projects.map((x) => `<div class="legend-row" style="grid-template-columns:1fr auto"><span class="ellipsis">${esc(x.name)}</span><span class="quiet tnum">${durText(x.secs)}</span></div>`).join('') : '<div class="silent">No time entries with a project this week. Projects collect time across labels.</div>'}`, 'vs. 4-week average')}

      ${section('Focus', `
        <div class="wk-score"><div class="big">${f.score ?? '—'}</div><div><div class="label">Rating</div><div class="mid">${esc(f.label)}</div><div class="silent">4-week average ${f.score4 ?? '—'}</div></div></div>
        ${note('The focus score uses the share of focus apps in your sessions, less a penalty for app switching.')}
        ${quad('Focus time per day', dur(f.perDay), 'Avg. session length', dur(f.avgLen))}
        ${quad('4-week average', dur(f.perDay4), 'Difference', diff(f.perDay, f.perDay4))}
        <div class="label">Focus time by day</div>${dayBars('focus', 'var(--focus)')}
        ${quad('Context switches per session', f.switches.toFixed(1), 'Highest in a session', String(f.switchesMax))}
        ${quad('4-week average', f.switches4.toFixed(1), 'Difference', diff(f.switches, f.switches4, (x) => x.toFixed(1)))}
        ${note('A context switch is a move to a non-focus app or site during a focus session. Frequent switches reduce concentration.')}
        <div class="label">Top distractors</div>
        ${f.distractors.length ? f.distractors.map((x) => `<div class="legend-row" style="grid-template-columns:1fr auto"><span class="ellipsis">${esc(x.name)}</span><span class="quiet tnum">${durText(x.secs)}</span></div>`).join('') : '<div class="silent">No distractions during focus sessions.</div>'}`)}

      ${section('Meetings', `
        ${quad('Total meeting time', dur(m.total), 'Avg. meeting length', dur(m.avgLen))}
        ${quad('4-week average', dur(m.total4), 'Difference', diff(m.total, m.total4))}
        <div class="label">Meeting time by day</div>${dayBars('meeting', 'var(--meeting)')}
        ${quad('Number of meetings', String(m.count), 'Average per day', m.perDay.toFixed(1))}
        ${note('Meetings help a team stay aligned, but they break up deep work. Cut the ones you do not need.')}`)}

      ${section('Breaks', `
        ${quad('Percent of work hours', p100(br.pct), 'Avg. break length', dur(br.avgLen))}
        ${quad('4-week average', p100(br.pct4), 'Difference', `${Math.abs(Math.round((br.pct - br.pct4) * 100))}% ${br.pct > br.pct4 ? '↑' : br.pct < br.pct4 ? '↓' : ''}`)}
        <div class="label">Break percent by day</div>
        ${w.days.map((d) => `<div class="wk-row"><span>${weekday(d.key)}</span><div class="meter" style="height:6px"><i style="width:${Math.min(100, d.breakPct * 100 / 0.3)}%;background:var(--break)"></i></div><span class="quiet tnum">${d.active ? p100(d.breakPct) : ''}</span></div>`).join('')}
        ${note('Short breaks let your mind recover. Walk, stretch or rest; do not check email or social media.')}`)}
    </div></div>`;
  tips(el);
  $$('[data-step]', el).forEach((x) => x.onclick = () => { from = addDays(from, Number(x.dataset.step)); location.hash = `weekly/${from}`; });
  $('[data-pdf]', el).onclick = () => api('savePdf', from);
}
