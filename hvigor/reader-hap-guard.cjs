const { readFileSync, lstatSync, realpathSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');

function isPackageTask(name) {
  return /(?:^|[:@])(?:assemble|package|sign)(?:hap|app|hsp|har)$/i.test(name);
}

// An accidental IDE Run must fail before deployment can uninstall the app.
// This is an invocation guard, not an authentication/security boundary.
function assertCanonicalHapInvocation(tasks, cwd = process.cwd(), env = process.env) {
  if (!tasks.some(isPackageTask)) return;
  const stop = () => { throw new Error('Reader HAP packaging requires: node scripts/hap-pipeline.mjs build --class iteration. DevEco Run must not install shared or unsigned outputs.'); };
  try {
    if (!env.READER_HAP_PIPELINE_ROOT || realpathSync(cwd) !== realpathSync(env.READER_HAP_PIPELINE_ROOT)) stop();
    const markerPath = resolve(cwd, '.reader-pipeline-session.json');
    const stat = lstatSync(markerPath);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) stop();
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    const digest = createHash('sha256').update(readFileSync(resolve(cwd, 'build-profile.json5'))).digest('hex');
    if (!marker.token || marker.token !== env.READER_HAP_PIPELINE_TOKEN || marker.profileSha256 !== digest) stop();
  } catch (_) { stop(); }
}

module.exports = { assertCanonicalHapInvocation, isPackageTask };
