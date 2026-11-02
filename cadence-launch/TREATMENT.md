# Cadence — "Where did the day go?"

Style: Dark Tech Keynote. 1920×1080, 24 fps, 73.125 s. English voice (Kokoro `af_heart`), toast captions burned in + `cadence-launch.srt`.
Accent: Cadence cyan `#22E4F5` (the dot on the app icon's ring). Problem colour: signal red `#FF4D5E`, only before the turn; at the freeze it drains to grey and never returns.
The app icon's own cyan→violet→pink ring gradient appears only on the brand mark.

## 1. Three candidate structures

1. **A release checklist countdown** ("tracks ✓ focus ✓ blocks ✓ reports ✓"). Clean, but a feature list with no person in it. Nobody relates to a checklist.
2. **Side by side**: two Tuesdays split-screen, one without Cadence losing its hours, one with it. Strong, but it halves the frame for the whole film and makes the product a comparison, not a protagonist.
3. **The number first, then a zoom ladder (chosen).** Open on a number everyone has felt: 9 h 47 m at your desk. Ask where it went. Show the day as you remember it: three blocks and a blur. Freeze. Cadence's ring arrives; its dot becomes a playhead that gives the day back. Then the signature: dive into one 15-second sample and pull back, rung by rung, to a whole year. Features follow as UI moments; the timesheet that asked the question gets answered; the film ends on the same number, now explained.

Why 3: the hook is a feeling, not a feature; the signature (15 s → 1 h → 1 day → 1 week → 1 year) *is* how the product works (a sample every 15 seconds); and the payoff (Friday's timesheet, the same 9 h 47 m) closes the loop the opening opened.

A first draft used a pile-up of windows → freeze → snap grid; next to the style demo it matched in structure, signature move, camera path and score shape, so it was dropped.

## 2. Logline and arc

A knowledge worker can't say where nine hours went; Cadence quietly samples the day every 15 seconds and gives it back — as a calendar, a focus guard, a report and a filled-in timesheet — without the data leaving the Mac.

- **Setup** (0–18.25): the number; the day as gaps and a red blur of app switches; Friday's timesheet with an empty Tuesday.
- **Turn** (18.25–25): freeze, digital silence, push-in on the empty field. The caret turns cyan, becomes a dot, draws the Cadence ring.
- **Development** (25.9–62.5): the dot is a playhead that resolves the day; category lanes; the zoom ladder; focus session + blocker + focus score; reports; the timesheet answered; three outside services cut away, the Mac lights.
- **Ending** (62.5–73.125): the same number, now with its breakdown; end card; everything put away until one cyan dot is left.

## 3. Benchmark

- **Developer-tool launch films** (black stage, one accent, UI as the protagonist, one line per screen). Learn: one idea per shot, snap motion, a sound for every UI action, restraint. Don't take: any interface, typeface, melody, logo or shot.
- **Powers-of-ten style scale films** (one continuous zoom across orders of magnitude). Learn: each rung is a new fact and the camera never cuts. Don't take: any imagery.

## 4. Shot list

| # | Time | Framing | Camera | What | Why |
|---|---|---|---|---|---|
| 1 | 0.0–5.0 | Extreme close-up | Locked, push ×1.00→1.05 | `9h 47m` scrambles and locks; "TUESDAY · 6:47 PM", "AT YOUR DESK TODAY" | Number first: the hook is a feeling |
| 2 | 5.0–15.0 | Medium | Slow lateral track along the day at ×1.42; 1–2° Dutch tilt + handheld wobble from 12.5 | The number's underline becomes the day bar; three remembered blocks; hatched gaps with "?"; red app-switch slivers multiply; chips ("chat", "mail", "tab"); counter climbs | Order read by the eye — then lost |
| 3 | 15.0–18.28 | Medium | Same track; card expands from the 6:47 PM now-line | Timesheet: Mon "8?", Tue empty field with a blinking caret | The question everyone dreads |
| 4 | 18.28–20.0 | Close | Push-in ×1→×2.6 through the frozen frame onto the empty field | Freeze: slivers stop and drain to grey; digital zero | Time stopped |
| 5 | 20.0–25.9 | Close → medium | Pan with the ring as it draws, then near-locked with light reveal | Caret → cyan dot (2-frame squash) → the ring draws (glock arpeggio) → squircle light-revealed → wordmark "Cadence" + "Automatic time tracking for macOS" | Product as hero |
| 6 | 25.9–32.5 | Wide | Locked; the icon puts itself away into its dot, the dot flies to 9 AM | Playhead sweeps 9 AM → 6:47 PM; gaps resolve into category blocks; blocks fly on curved trails into seven lanes; totals lock | Light reveal used as data reveal; type streams |
| 7 | 32.5–32.8 | Insert | Dive (log zoom ×16) into the Code lane at 10:42 | Match cut through the block's colour | Going inside the detail |
| 8 | 32.8–42.5 | Close → extreme wide | **Signature:** one continuous log pull-out, one rung per notch | 15-second sample card (held 2.2 s) → 1 hour (240 samples) → 1 day → 1 week → week rows fold into one column of a year heatmap; light sweep. A fixed scale ruler at the top (15 SEC · 1 HOUR · 1 DAY · 1 WEEK · 1 YEAR) moves its cyan marker per rung, over "ONE SAMPLE EVERY 15 SECONDS" | Scale: the whole product idea in one move |
| 9 | 42.5–50.0 | Medium | Tuesday's cell expands into the frame; locked | Focus ring counting down; a "Video feed" tile slides in; blocker "Getting distracted?"; "Thanks for the reminder!" pressed; ring completes; Focus score 86/100 | Cause and effect |
| 10 | 50.0–55.0 | Medium | Slow lateral drift + settle | Reports by project; Export CSV → the timesheet returns, every day filled, total 41.3, "Ready" | Payoff of shot 3 |
| 11 | 55.3–62.5 | Wide → medium | Locked, then pan + push onto the Mac | "Your Mac" with its real data files; Account / Cloud sync / Analytics cut away on the narrator's words; near-silence; the outline lights in cyan | Privacy as a picture |
| 12 | 62.5–66.25 | Extreme close-up | Locked — same framing as shot 1 | `9h 47m` again, with the stacked bar and legend | Rhyme: what changed |
| 13 | 66.25–73.125 | Wide | Near-locked, light reveal | End card; put away one element per beat; the cyan dot switches off | Shipped state, then darkness |

## 5. Beat sheet (key times in `timeline.js`)

0.5 digits scramble · 1.25/1.41/1.56 lock · 1.9 VO1 · 5.0 bar opens · 5.3 VO2 · 7.6 VO3 · 8.13/8.75/9.69 Standup/Lunch/Bug fix? pop on their words · 10.0 hatch · 10.63 slivers · 11.95 VO4 · 12.5 tilt · 15.0 timesheet · 15.6 VO5 · **18.28 freeze, digital zero** · **20.0 first sound: felt + sine drop**, caret → dot · 20.5 VO6 · 21.25 squircle · 21.88 wordmark · 22.6 VO7 · 25.94 icon puts away · 26.2 VO8 · 26.56–29.69 playhead · 30.0 lanes · 31.25 totals · 32.5 dive · 32.75 VO9 · 32.81 tile · 35.0 → hour · 35.63 hour fills · 37.0 VO10 · 37.19 → day · 37.81 → week · 38.44 → year · 39.06 year lands · 39.38 sweep · 42.5 focus · 42.8 VO11 · 43.75 feed · 44.06 blocker · 46.88 press · 47.19 squash · 47.5 ring full · 47.7 VO12 · 47.81/47.97 score locks · 50.0 report · 50.3 VO13 · 51.56 export · 51.88 timesheet · 52.19–52.97 days lock · 52.75 VO14 · 55.31 privacy · 55.6 VO15 · 56.25/57.19/58.13 cuts · **59.38 near silence** · 60.0 rim + VO16 · 62.5 number · 62.9 VO17 · 63.13 legend · 66.25 end card · 67.0 VO18 (on screen) · 70.94 put-away · 72.81 dot off · 73.125 end.

## 6. Cue map

96 BPM, 4/4 (beat 0.625 s, bar 2.5 s), D Lydian. Every key action is on the 16th grid (`timeline.js`, checked by `tools/cuecheck.py`).

| Time | Section | Music |
|---|---|---|
| 0–5 | Hook | low sine pulse (half notes); glock on each digit lock; soft vibraphone fifth |
| 5–18.25 | Day | marimba ostinato in 8ths whose notes drop out more and more (memory holes); a second marimba detuned +30 cents enters with the slivers; shaker 8ths → 16ths → sextuplets; bowed vibraphone D against D# (the only notes outside the mode) |
| 18.25–20 | Freeze | digital zero |
| 20–25 | Turn | bowed vibraphone D maj7(#11); glock arpeggio up as the ring draws; vibraphone on the icon, marimba D3 on the wordmark |
| 25.6–32.5 | Playhead | the ostinato returns whole; one vibraphone note per resolved block; glock run as the lanes fly |
| 32.5–42.5 | Ladder | additive by register: glock (15 s) → marimba 16ths (1 h) → vibraphone chords (1 day) → bass marimba + sine (1 week) → bowed pad (1 year) → all land on D at 39.06 |
| 42.5–55 | Features | groove: ostinato + pulse + shaker; it thins under the blocker; D maj9 on the completed ring; one note per report bar; chord on the timesheet total |
| 55–62.5 | Privacy | subtractive: shaker out at the first cut, ostinato at the second, pulse at the third; pad fades to nothing at 59.38; one vibraphone note when the Mac lights |
| 62.5–73.125 | Ending | glock locks echo the hook; marimba legend notes; one D maj9 chord rings out; glock steps down with each put-away |

## 7. Sound design table

| Section | Ambience | Main foley | Music |
|---|---|---|---|
| Hook | quiet room | caret tick, digit grains, glass locks | low pulse, glock |
| Day | room + fan + coil whine rising | scattered plucks per app switch (detuned, random timbre, panned to the sliver), chip pops, felt pops for remembered blocks, window whoosh + plop for the timesheet, caret ticks on the beat | ostinato with holes, detuned double, shaker, dissonant pad |
| Freeze | digital zero | — | — |
| Turn | room | felt mallet + sine drop, rising shimmer under the ring, soft whoosh for the wordmark | Lydian pad, glock arpeggio |
| Playhead | room | in-key glass per resolved block, felt landings per lane, ticks on totals | whole ostinato |
| Ladder | room | dive whoosh, glass sample ping, whoosh + deepening thump per rung, tiny ticks for samples, big thump on the year | additive by register |
| Features | room | card thump, press (felt + short sine drop), CRT-off squash, shimmer on the ring, felt per report bar, glass on the CSV chip and check, digit grains | groove |
| Privacy | room → −60 dB | file plops, CRT-off per cut, shimmer on the rim | subtractive → near silence → one note |
| Ending | room | close whoosh, legend ticks, end-card thump + shimmer, small CRT-offs | one chord |

J-cut: a faint crowd of notification pops under the hook's last second, before the day opens. L-cuts: the Lydian pad from the turn rings into the playhead; the ladder's landing chord rings into the year hold. Ducking: music −8 dB, foley −4 dB under voice. Master −14 LUFS, no grain.

## 8. Subtitle and title design

- Captions are a UI toast: bottom-centre translucent pill, 1 px light border, Inter 500 40 px, cyan "speaking" dot, 0.16 s rise + fade, held ≥ max(1.8 s, line + 0.6 s).
- VO1 and VO18 are on screen as type (the number, the end card), so they are not toasted twice; they are in the `.srt`.
- Headlines Inter 600–700; numbers Inter Tight 600 (tracking −4.5 %); labels, files and paths JetBrains Mono in wide-tracked caps.

## 9. Narration

1. "Nine hours, forty-seven minutes at your desk." (on screen)
2. "So where did the day go?"
3. "You remember the standup. Lunch. A bug fix, maybe."
4. "The rest is a blur of tabs, chats, and quick checks."
5. "Then Friday, someone asks for your hours."
6. "Meet Cadence."
7. "It remembers your day, so you don't have to."
8. "It notes the app or site in front of you, and gives you back the whole day."
9. "Every fifteen seconds. Quietly. Automatically."
10. "Minutes become your day. Your week. Your year."
11. "Start a focus session, and Cadence keeps distractions out."
12. "Every session gets a focus score."
13. "Reports by project and client."
14. "And Friday's timesheet? Already done."
15. "No account. No cloud. No analytics."
16. "Your data stays on your Mac."
17. "Nine forty-seven. Now you know where it went."
18. "Cadence. Free, for your Mac." (on screen)

## 10. Facts used (all from this repository's README)

- Records the frontmost app, window title and browser URL every 15 s.
- Day / week / month / year views; focus sessions with a countdown ring; distraction blocker with "Getting distracted?", "Thanks for the reminder!", "This is not a distraction.", "End this focus session now"; focus score 0–100.
- Reports by project, client, task, label or app; CSV export.
- No account, telemetry or analytics; data in `~/Library/Application Support/Cadence/` (`events/YYYY-MM-DD.jsonl`, `db.json`, `settings.json`, `rules.json`).
- MIT licence, free download. Website: suzalshrestha.github.io/cadence.
- The day, projects, clients and numbers in the film are illustrative sample data.

## 11. Compared with the style demo (DIRECTOR §11)

| | Demo | This film | Same? |
|---|---|---|---|
| Structure | mess → freeze → one press → snap grid → number → put-away → echo | number → gaps & blur → freeze → ring → playhead resolves → zoom ladder → features → timesheet answered → privacy cuts → number explained | different |
| Opening | cursor typing a title in close-up | a stat scrambling in on black | different |
| Signature | 264 elements fly into a grid in one beat | continuous log pull-out 15 s → 1 year | different |
| Camera path | one pull-back, inserts, push-in, whip out, turn-in | lateral track, push-in, pan with a drawing ring, dive, ladder pull-out, cell expand, push onto the Mac | different |
| Score | phasing marimbas → silence → one chord → subtractive | ostinato with holes → zero → arpeggio → whole ostinato → additive by register → groove → subtractive → one chord | mostly different (both end subtractive → chord) |
| Ending | the opening framing; the cursor blinks out | the opening framing with its answer; end card; the dot switches off | similar |
