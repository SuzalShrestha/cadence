# Changelog

## Unreleased

### Added
- Weekly Report page (Insights): last week's work hours, breakdown, top labels and projects, focus, meetings and breaks, compared with the 4-week average. It has a coach insight and recommendation, and Save PDF.
- A Monday notification opens the report for the last full week. Turn it off in Settings → General.
- "Productivity coaching" setting (Settings → General, and the tray menu). It is off by default: Cadence only records. The widget, tray and sidebar show time tracked today and the current app, not "since break". Break reminders, target cards, the Monday notification, the target and focus cards on Home, and the Productivity and Weekly Report pages appear only when coaching is on. Sessions and the blocker still work when you start them.
- Cadence records the open file or folder of the front window (macOS `AXDocument`: editors, Preview, Office, terminal working folder). Activity → Files & Projects lists files and folders and groups them by git folder. "Strip window titles" also removes paths.
- Browsers with no AppleScript URL support (for example Firefox) give their URL through `AXDocument` when they expose it.

### Changed
- The tracker reads the front window every 5 s, not 15 s (Rize uses 15 s), so short app switches are recorded.

## 0.2.1 - 2026-10-13

### Security
- Only Cadence's own UI files can call the app API. Before, any `file://` page could call it.
- Windows block navigation to other pages and block new windows.
- CSV export puts a `'` before cells that start with `=`, `+`, `-` or `@`, so spreadsheet apps do not run them as formulas.

## 0.2.0 - 2026-10-13

First public release.

### Added
- Home calendar with lanes for activity, time entries, tasks, projects, clients and sessions. Day, Week, Month and Year views.
- Summary column: work hours, percent of target, focus time, productivity metrics, time by label and top apps.
- Focus, meeting and break sessions. Planned sessions, Pomodoro sets, automatic session detection and a focus score.
- Distraction blocker with snooze and urge surfing. Full-screen break window.
- Activity, Time Entries, Reports (CSV export) and Productivity pages.
- Projects, clients and tasks with rates, budgets and keywords. Suggested time entries.
- Desktop widget, quick start window (`Cmd+E`) and menu-bar timer.
- Settings for theme, clock, sessions, blocker, rules, privacy and work-hour targets.
- macOS app build (dmg and zip, Apple Silicon and Intel).

### Changed
- Electron 38 to Electron 44.7.0 (Electron 38 is out of support and has known security issues).

## 0.1.0

- Tracking loop, rule matcher, local storage and a first dashboard.
