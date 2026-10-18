const { readFileSync, lstatSync, realpathSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { assertPrivateFilePermissions } = require('../scripts/lib/private-file.cjs');

function isPackageTask(name) {
  return /(?:^|[:@])(?:assemble|package|sign)(?:hap|app|hsp|har)$/i.test(name);
}

function isBuildResourceTask(name) {
  return isPackageTask(name) || /(?:^|[:@])(?:compileArkTS|compileTS|compileJS|compileNative|ConfigureCmake|BuildNativeWithCmake|BuildNativeWithNinja|cleanNative|clean)$/i.test(name);
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

let buildLease, buildLeaseReady, buildEnvironmentBefore, buildGeneration = 0;
async function beginIdeBuild(ide) {
  if (!ide || buildLease) return;
  if (!buildLeaseReady) {
    const admittedGeneration = buildGeneration;
    buildLeaseReady = import('../../Reader-Core-Native/scripts/lib/build-resource-lock.mjs').then(({ acquireBuildLease }) => {
    if (admittedGeneration !== buildGeneration) throw new Error('Reader IDE build ended before resource admission');
    buildLease = acquireBuildLease();
    buildEnvironmentBefore = new Map();
    for (const [key, value] of Object.entries(buildLease.env)) {
      if (process.env[key] === value) continue;
      buildEnvironmentBefore.set(key, { before: process.env[key], applied: value });
      process.env[key] = value;
    }
    });
  }
  const pending = buildLeaseReady;
  try { await pending; }
  catch (error) { if (buildLeaseReady === pending) buildLeaseReady = undefined; throw error; }
}
function finishIdeBuild() {
  const lease = buildLease, previous = buildEnvironmentBefore;
  buildGeneration++;
  buildLease = undefined; buildLeaseReady = undefined; buildEnvironmentBefore = undefined;
  try { lease?.release(); }
  finally {
    for (const [key, { before, applied }] of previous ?? []) {
      if (process.env[key] !== applied) continue;
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    }
  }
}
module.exports.beginIdeBuild = beginIdeBuild;
module.exports.finishIdeBuild = finishIdeBuild;
