# Changelog

## [0.3.2](https://github.com/SuzalShrestha/cadence/compare/v0.3.1...v0.3.2) (2026-10-17)


### Bug Fixes

* **ui:** tell users to re-add Cadence when Accessibility looks on ([#8](https://github.com/SuzalShrestha/cadence/issues/8)) ([d24d866](https://github.com/SuzalShrestha/cadence/commit/d24d86659de2234ba0cf35ddb1b29955ec99d8b9))

## [0.3.1](https://github.com/SuzalShrestha/cadence/compare/v0.3.0...v0.3.1) (2026-10-17)


### Bug Fixes

* **release:** add the signing keychain to the search list ([#6](https://github.com/SuzalShrestha/cadence/issues/6)) ([fc121c4](https://github.com/SuzalShrestha/cadence/commit/fc121c49c8a3ff46f6b9b7fc87ad201f6821d7dc))

## [0.3.0](https://github.com/SuzalShrestha/cadence/compare/v0.2.1...v0.3.0) (2026-10-17)


### Features

* add a just-track mode; productivity coaching is now optional and off by default ([7a3aab8](https://github.com/SuzalShrestha/cadence/commit/7a3aab8711b7fc34a07749174ecbb97c09c11754))
* **reports:** add the Weekly Report page with a Monday notification for last week's assessment ([7a3aab8](https://github.com/SuzalShrestha/cadence/commit/7a3aab8711b7fc34a07749174ecbb97c09c11754))
* **tracker:** record the open file or folder of the front window and show time per file and git project in Activity ([7a3aab8](https://github.com/SuzalShrestha/cadence/commit/7a3aab8711b7fc34a07749174ecbb97c09c11754))
* **updater:** update Cadence automatically from GitHub Releases, with a Check now button and release notes in Settings ([7a3aab8](https://github.com/SuzalShrestha/cadence/commit/7a3aab8711b7fc34a07749174ecbb97c09c11754))


### Bug Fixes

* **tracker:** a tab in a window title can no longer fake the recorded file path ([7a3aab8](https://github.com/SuzalShrestha/cadence/commit/7a3aab8711b7fc34a07749174ecbb97c09c11754))


### Performance

* **tracker:** read the front window every 5 seconds instead of 15, so short app switches are recorded ([7a3aab8](https://github.com/SuzalShrestha/cadence/commit/7a3aab8711b7fc34a07749174ecbb97c09c11754))

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
