# Contributing

Thank you for your help. Keep changes small and focused.

## Set up

```bash
npm install
npm start
```

Use a scratch data folder when you test, so your real data stays safe:

```bash
CADENCE_DATA=/tmp/cadence-dev npm start
```

## Before you open a pull request

1. Run the unit tests: `npm test`.
2. Run the render check. It opens every page and window, saves screenshots and prints renderer errors:
   ```bash
   CADENCE_DATA=/tmp/cadence-dev CADENCE_SMOKE=/tmp/cadence-shots npm start
   ```
   The last line must be `SMOKE renderer errors: none`. Look at the screenshots for layout problems.
3. For a UI change, add a before and after screenshot to the pull request.

## Code style

- Plain JavaScript and ES modules. No framework and no build step for the UI.
- Do not add a dependency for something a few lines can do.
- Pure logic goes in `src/core.js` and gets a test in `test/`.
- Keep the security model: `contextIsolation`, `sandbox`, the CSP in each HTML file, and the IPC method allow-list in `src/main.js`.
- All data stays on the computer. Do not add network calls, telemetry or analytics.

## Project layout

| Path | What it holds |
|---|---|
| `src/main.js` | Electron main process: tracking loop, windows, tray, IPC |
| `src/core.js` | Pure logic: idle states, event segments, rule matcher, sessions, focus score |
| `src/store.js` | Local JSON and JSONL storage |
| `src/active.js` | Reads the frontmost app, window title and browser URL (AppleScript) |
| `src/ui/` | Dashboard pages and small windows |
| `docs/findings.md` | Research notes |
| `docs/index.html` | Website (GitHub Pages, served from `docs/`) |

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
