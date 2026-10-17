// electron-builder afterPack hook: sign the .app before the dmg and zip are made.
// With CADENCE_SIGN_P12 (base64 .p12) and CADENCE_SIGN_PASSWORD, sign with that certificate.
// A stable certificate keeps the designated requirement the same across releases, so the
// updater accepts new builds and macOS keeps the Accessibility permission. Without it, sign ad hoc.
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

module.exports = async function sign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const p12 = process.env.CADENCE_SIGN_P12;
  if (!p12) {
    console.log('  • sign-mac: no CADENCE_SIGN_P12, signing ad hoc (updates and permissions will not carry over)');
    run('codesign', ['--force', '--deep', '--sign', '-', app]);
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-sign-'));
  const kc = path.join(dir, 'sign.keychain-db');
  const kcPass = crypto.randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(path.join(dir, 'cert.p12'), Buffer.from(p12, 'base64'), { mode: 0o600 });
    run('security', ['create-keychain', '-p', kcPass, kc]);
    run('security', ['unlock-keychain', '-p', kcPass, kc]);
    run('security', ['import', path.join(dir, 'cert.p12'), '-k', kc, '-P', process.env.CADENCE_SIGN_PASSWORD || '', '-T', '/usr/bin/codesign']);
    run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', kcPass, kc]);
    // No -v: a self-signed certificate is not trusted, but codesign can still use it.
    const id = run('security', ['find-identity', '-p', 'codesigning', kc]).match(/\b([0-9A-F]{40})\b/)?.[1];
    if (!id) throw new Error('sign-mac: no code signing identity in CADENCE_SIGN_P12');
    run('codesign', ['--force', '--deep', '--keychain', kc, '--sign', id, app]);
    run('codesign', ['--verify', '--deep', '--strict', app]);
    console.log(`  • sign-mac: signed with ${id}`);
  } finally {
    try { run('security', ['delete-keychain', kc]); } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
};
