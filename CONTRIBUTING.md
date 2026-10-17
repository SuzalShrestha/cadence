# Contributing

Thank you for your help. Keep changes small and focused.

## Set up

Use Node 22 (`.nvmrc`).

```bash
npm install   # also installs the Git hooks (Husky)
npm start
```

Use a scratch data folder when you test, so your real data stays safe:

```bash
CADENCE_DATA=/tmp/cadence-dev npm start
```

## Before you open a pull request

1. Run lint and the unit tests: `npm run check`.
2. Run the render check. It opens every page and window, saves screenshots and prints renderer errors:
   ```bash
   SMOKE_DIR=/tmp/cadence-shots npm run smoke
   ```
   The last line must be `SMOKE renderer errors: none`. Look at the screenshots for layout problems.
3. For a UI change, add a before and after screenshot to the pull request.

CI runs the same checks on every pull request, plus CodeQL and a macOS build. The build is attached to the pull request as a dmg for testing.

## Commits and pull requests

Cadence uses [Conventional Commits](https://www.conventionalcommits.org). The release notes come from them, so write them for users:

```
feat(ui): show tracked time in the widget
fix(tracker): keep the window title when the URL is empty
docs: explain the update setting
```

| Type | Use it for | Release |
|---|---|---|
| `feat` | A new feature users can see | Minor version |
| `fix` | A bug fix | Patch version |
| `perf` | Faster or lighter | Patch version |
| `docs`, `refactor`, `test`, `build`, `ci`, `chore` | Changes users do not see | No release |

Add `!` after the type (`feat!:`) or a `BREAKING CHANGE:` footer for a breaking change.

Git hooks check this on your computer:

- `pre-commit` runs Biome lint on the staged files (lint-staged).
- `commit-msg` runs commitlint.

Pull requests are squash-merged. The pull request title becomes the commit on `main` and the line in the changelog, so CI checks the title too.

## Releases

Releases are automatic. Maintainers do not tag or upload by hand.

1. Each merge to `main` updates an open **Release PR** (release-please). It holds the next version number and the new `CHANGELOG.md` section.
2. A maintainer merges the Release PR when the release is ready.
3. The Release workflow tags `vX.Y.Z`, creates the GitHub Release, builds arm64 and x64, signs them, attests them, and uploads the dmg, zip, `latest-mac.yml` and `SHA256SUMS.txt`.
4. Installed copies of Cadence find the release within 6 hours, download it in the background and install it on the next restart.

### Signing

The in-app updater installs only a build signed with the same certificate as the installed app. Cadence uses one self-signed code signing certificate:

- SHA-1 fingerprint: `B8:75:E6:B5:43:CC:9D:BC:A9:6E:25:72:D5:ED:30:3C:5A:4F:E3:2D`
- Repository secrets: `CADENCE_SIGN_P12` (the `.p12` file, base64) and `CADENCE_SIGN_PASSWORD`.

Keep a backup of the `.p12` file and its password outside GitHub. If the key is lost, installed copies cannot update to a build signed with a new key. Users must then download the new version by hand once.

Optional secret `RELEASE_PLEASE_TOKEN`: a fine-grained token with Contents and Pull requests write access. With it, CI runs on the Release PR. Without it, release-please uses `GITHUB_TOKEN`, and GitHub does not start CI on the Release PR.

## Code style

- Plain JavaScript and ES modules. No framework and no build step for the UI.
- Do not add a dependency for something a few lines can do.
- Pure logic goes in `src/core.js` and gets a test in `test/`.
- Keep the security model: `contextIsolation`, `sandbox`, the CSP in each HTML file, and the IPC method allow-list in `src/main.js`.
- All data stays on the computer. Do not add network calls, telemetry or analytics. The only network call is the update check to GitHub Releases, and users can turn it off.

## Project layout

| Path | What it holds |
|---|---|
| `src/main.js` | Electron main process: tracking loop, windows, tray, IPC |
| `src/core.js` | Pure logic: idle states, event segments, rule matcher, sessions, focus score |
| `src/store.js` | Local JSON and JSONL storage |
| `src/active.js` | Reads the frontmost app, window title and browser URL (AppleScript) |
| `src/ui/` | Dashboard pages and small windows |
| `scripts/sign-mac.js` | Signs the app during the build (electron-builder `afterPack`) |
| `.github/workflows/` | CI, release, CodeQL, Scorecard, PR title check |
| `docs/findings.md` | Research notes |
| `docs/index.html` | Website (GitHub Pages, served from `docs/`) |

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
