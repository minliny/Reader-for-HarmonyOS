const { readFileSync, lstatSync, realpathSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { assertPrivateFilePermissions } = require('../scripts/lib/private-file.cjs');

function isPackageTask(name) {
  return /(?:^|[:@])(?:assemble|package|sign)(?:hap|app|hsp|har)$/i.test(name);
}

function isBuildResourceTask(name) {
  return isPackageTask(name) || /(?:^|[:@])(?:compileNative|ConfigureCmake|BuildNativeWithCmake|BuildNativeWithNinja|cleanNative|clean)$/i.test(name);
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
    if (!stat.isFile() || stat.isSymbolicLink()) stop();
    assertPrivateFilePermissions(markerPath);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    const digest = createHash('sha256').update(readFileSync(resolve(cwd, 'build-profile.json5'))).digest('hex');
    if (!marker.token || marker.token !== env.READER_HAP_PIPELINE_TOKEN || marker.profileSha256 !== digest) stop();
  } catch (_) { stop(); }
}

async function configureIdeSigning(context, cwd = process.cwd(), env = process.env) {
  if (env.READER_HAP_PIPELINE_ROOT || env.READER_HAP_PIPELINE_TOKEN) {
    assertCanonicalHapInvocation(['assembleHap'], cwd, env);
    return undefined;
  }
  const pipeline = await import(pathToFileURL(resolve(cwd, 'scripts/hap-pipeline.mjs')).href);
  const session = pipeline.prepareIdeSigningProfile(context.getBuildProfileOpt());
  context.setBuildProfileOpt(session.profile);
  return { pipeline, session };
}

function assertReaderHapInvocation(tasks, ide, cwd = process.cwd(), env = process.env) {
  if (!tasks.some(isPackageTask)) return;
  if (env.READER_HAP_PIPELINE_ROOT || env.READER_HAP_PIPELINE_TOKEN || !ide) {
    return assertCanonicalHapInvocation(tasks, cwd, env);
  }
  ide.pipeline.assertIdeSigningUnchanged(ide.session);
}

function verifyIdeOutput(ide, cwd = process.cwd()) {
  if (!ide) return;
  const artifact = ide.pipeline.verifyIdeSignedHap(
    resolve(cwd, 'entry/build/default/outputs/default/entry-default-signed.hap'), ide.session);
  console.log(`Reader DevEco signed HAP verified: ${artifact.sha256}`);
}

module.exports = { assertCanonicalHapInvocation, isPackageTask, isBuildResourceTask, configureIdeSigning,
  assertReaderHapInvocation, verifyIdeOutput };

let buildLease, buildLeaseReady;
async function beginIdeBuild(ide) {
  if (!ide || buildLease) return;
  if (!buildLeaseReady) buildLeaseReady = import('../../Reader-Core-Native/scripts/lib/build-resource-lock.mjs').then(({ acquireBuildLease }) => { buildLease = acquireBuildLease(); });
  try { await buildLeaseReady; } catch (error) { buildLeaseReady = undefined; throw error; }
}
function finishIdeBuild() { const lease = buildLease; buildLease = undefined; buildLeaseReady = undefined; lease?.release(); }
module.exports.beginIdeBuild = beginIdeBuild;
module.exports.finishIdeBuild = finishIdeBuild;
