# Security policy

## Supported versions

Only the latest release gets security fixes.

## Report a vulnerability

Do not open a public issue for a security problem.

Use GitHub private reporting: open the **Security** tab of this repository and click **Report a vulnerability**. Include the steps to reproduce and the version you use.

You will get a reply within 7 days.

## Scope

Cadence runs only on your computer and has no server. Important areas:

- The IPC bridge between the windows and the main process (`src/preload.js`, `src/main.js`).
- Stored data in `~/Library/Application Support/Cadence`.
- AppleScript calls that read the frontmost app and browser tab (`src/active.js`).
