# Rize 3.0.45: reverse-engineering findings

Target: `/Applications/Rize.app` (bundle id `io.rize`, version 3.0.45, Electron 38.3.0, repo name `rize-io/sol`).
Method: static reading of the shipped JavaScript only. I did not run Rize, did not capture its traffic, and did not call its servers.

## Evidence sources

| Source | What it gave | Limit |
|---|---|---|
| REA `analyze_javascript_application` on `.webpack/main` (evidence `ev_5d71f308…b6c7`) | Parse OK, 303,447 AST nodes, 90 findings | **Partial.** The worker ran out of heap during semantic analysis. 0 modules and 0 windows were recovered. That does not mean none exist. |
| REA on the full `app/` and `.webpack/` trees | Nothing | MCP request timed out (14 MB of JS). |
| Text reading of `main/index.js` (1.3 MB, webpack 5, names not mangled) | Everything below | Static only; runtime order and server behavior are inferred. |

The bundle was split into 782 webpack factories. 51 app modules were found by their log prefixes (`[Tracker]`, `[Idler]` …).

## Architecture (observed)

- **Thin client.** The desktop app records focus events and sends them to `https://api.rize.io` GraphQL (Apollo client and ActionCable subscriptions).
- **Dashboard is remote.** `https://app.rize.io/dashboard`, `/settings`, `/widget` load in a BrowserView. Categories, projects, reports and AI tagging are server-side and are **not** in the bundle.
- **Local windows** (`renderer/*`): blocker, rest (break), shortcut, toaster, preflight (permissions), online, sign-in, widget, error, performance.
- **Updates**: `update.electronjs.org/rize-io/lua/…`. **Errors**: Sentry. **Analytics**: Amplitude.

## Tracking loop (observed, module 88603)

- One tick each **15 s**, serialized with a lock. Chain: context → sync → status → active app → event → blocker → screenshot → planned-session notify/start.
- Tick stops for: tracking disabled, account canceled, unpaid, screen locked, system suspended. The open event closes.
- **Idle** (`powerMonitor.getSystemIdleTime`): >30 s means "maybe idle" (events freeze). >300 s means idle (back-dated to the last input). >3600 s means "dead" (idle recording stops).
- Categories in `nonIdleTimeCategories` skip idle detection.
- **Events** key on bundleId + title + url. A change closes and opens an event. An event is chunked when it is longer than **180 s**. An event longer than **600 s** is discarded. Timestamps are epoch seconds.
- Event fields: `appName, bundleId, category, idle, path, pid, source, tabId, title, trackingRuleHostKey, url, start/endTimestamp`.
- **Event queue**: batches of 50, sent with `BATCH_CREATE_TRACKING_EVENTS_V2` every 60 s with 0–2 s jitter. The queue is stashed to `electron-store` at quit or update.

## Rules (observed, module 90033)

- Rules come from the server (`GET_TRACKING_RULES_V2`, paged, live updates).
- Fields: `appNameRegexJavascript`, `urlRegexJavascript`, `titleRegexJavascript`, `hostKey`, `category{key,name}`, `alwaysBlock`, `blockInFocus/Break/Meeting`, `trackTitlesEnabled`, `trackFullUrlEnabled`, `doNotTrackAnyUrls`, `screenshotsEnabled`.
- Match: URL rules if a URL exists (also the naked domain via the public-suffix list), else app-name rules. Title regex narrows. **Longest `hostKey` wins.** Fallback: category `miscellaneous`.

## Sessions, blocker, breaks (observed)

- Session types: `focus`, `meeting`, `break`. Defaults: 2700 s, 1800 s, 300 s. Snooze: 300 s. Shortcut: `CommandOrControl+E`. Daily target: 28800 s.
- Mutations: `START_SESSION_TIMER`, `STOP_SESSION_TIMER`. Sessions from the calendar or "coach" count down. Other auto-detected sessions count up.
- **Blocker**: a rule blocks when `alwaysBlock`, or when its `blockIn<Type>` flag matches the current session. A full-screen window appears on each display after the refocus threshold. Actions: close, snooze, end session, mark category non-interrupting.
- **Rest window**: a full-screen window on each display at break start. Actions: end, extend +5 min, turn off full-screen breaks.
- **Tray** (macOS): title updates every 996 ms. It shows the session time, or the time since the last break.

## OCR / screenshots (observed, off by default)

- `ocrScreenshotsEnabled` and related flags default to `false`. Captures go to `BATCH_CREATE_CLOUD_VLM_CAPTURES` (base64 images to the cloud).
- A built-in deny list skips password managers (1Password, Bitwarden, Keychain …).

## Unknowns

- `refocusThreshold` default is `3e5` and is multiplied by 1000. That gives 83 h if the unit is seconds. The server value probably overrides it. The unit is **not confirmed**. The clone uses 300 s.
- The category list and the dashboard UI are server-side. Not observed.
- How the server turns events into timeline entries, projects and work hours. Not observed.
- `distractionBlockingType` constant values (module 51964). Not read.

## Cadence: what was ported vs. designed

| Part | Source |
|---|---|
| Tick, idle state machine, event segmentation, rule matcher, blocker condition, timer format, defaults | **Ported** from the observed code (`src/core.js`) |
| One fix: idle start was `null` when idle jumped past 30 s at launch, so the tick crashed | **Changed** (Rize has the same path; it recovers on the next tick) |
| Storage (JSONL per day), dashboard, categories and default rules, AppleScript window reader | **Designed** (Rize does these on the server or in a native addon) |
| Server sync, accounts, billing, calendar integrations, OCR cloud upload, auto-update, analytics | **Left out** |

## v2: design and feature research

The Rize dashboard is a remote web app, so its UI is not in the desktop bundle. The v2 design uses three sources:

| Source | What it gave |
|---|---|
| Theme module 23340 in the desktop main bundle | Colors (`black2 #121117`, `black3 #1C1B23`, `aqua1 #08AFC1`, `purple1 #373350`, `purple4 #8B7BC8`), gradients, Lato font, 8 px card and 4 px control radius, light tokens |
| Dashboard screenshot on rize.io | Sidebar items, calendar lanes (activity, time entries, tasks, projects, clients, sessions), block style with a duration pill, Day/Week/Month/Year control, summary cards ("Work Hours", "Percent of Target", "Focus Time … vs average", "Productivity Metrics"), entry popover with "Apps & Websites" bars |
| Rize help docs | Automatic sessions (≈75 % focus over 15+ min), planned sessions, Pomodoro 25/5 with 20 min long break, blocker choices and urge surfing (10 s), break-screen choices, work-hour targets per weekday and PTO, widget menu, rule flags, time-entry suggestions |

Not copied: the Rize name, logo and icons. Cadence uses its own "C" mark and Lucide icons (ISC).

Changed on purpose: Rize's category and session colors fail a color-blind check (teal vs. mauve ΔE ≈ 3). Cadence re-steps them. The palettes pass the dataviz validator for dark (`#1C1B23`) and light surfaces.

Not confirmed (no access to the live Rize dashboard): exact spacing, hover states, the Year view, the Reports and Productivity layouts, and the suggestion confidence formula. Those parts are Cadence designs in the Rize style.

## v0.3: weekly productivity assessment

Source: one Rize weekly report (email and PDF, week Jul 20–27 2026). Rize.app was not installed, so REA had no binary to read. The earlier static study already showed that reports are server-side.

| Observation (PDF) | Evidence |
|---|---|
| Rendered from HTML by Chromium | `pdfinfo`: Creator `Chromium`, Producer `Skia/PDF m104`, one page 270 × 4668 pt |
| Created Monday after the week | CreationDate Mon Jul 27 17:54 (+0545) |
| Sections | Work Hours, Breakdown, Top Categories, Top Projects, Focus, Meetings, Breaks (`pdftotext -layout`) |
| Breakdown is a share of work hours, breaks included | Focus 39 + Meetings 0 + Breaks 23 + Other 38 = 100; 33 min ÷ 85 min = 39% |
| "vs. 4-week average" for shares is in percentage points | Other 38% shows "62% ↓" against a 100% "other" past |
| 4-week average = past 4 weeks ÷ 4; difference = week − average | 85 min − 42 min = 43 min |
| Text is template-made | Grammar faults repeat ("consistent your normal amount", "1 hours") |
| Coach text in the email is free-form | Insight and recommendation not in the PDF |

`test/weekly.test.js` feeds the PDF's week into `core.weeklyReport` and gets the same numbers.

Designed in Cadence (not observable): the text templates, the coach rules, the overwork limit (target + 2 h), and the focus score (Cadence's own). Left out: internal/external meetings and "people you met with" (needs a calendar), email delivery and an LLM coach (both need a server; Cadence makes no network requests).
