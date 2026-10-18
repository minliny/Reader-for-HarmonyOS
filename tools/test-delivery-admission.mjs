#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, lstatSync, symlinkSync, readlinkSync, linkSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter, relative, resolve, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { isBuildResourceTask, isPackageTask, beginIdeBuild, finishIdeBuild } = createRequire(import.meta.url)('../hvigor/reader-hap-guard.cjs');
import { requiredHapResources, verifyRequiredHapResources, currentCoreGate, verifyPublishedCoreGate, targetReadiness } from '../scripts/lib/hap-delivery-evidence.mjs';
import { contractToolchainLoaders, buildContractScope, prepareIdeNativeInputs, ideNativeBuildEnvironment, ideNativeInputState, releaseContractBuildWorkspace } from '../scripts/hap-pipeline.mjs';
import { hapStageReceipt } from '../scripts/lib/hap-stage-receipt.mjs';
import { reconcileIdeNativeCache } from '../scripts/lib/ide-native-cache.mjs';
import { contentSnapshot } from '../../Reader-Core-Native/scripts/build-input-snapshot.mjs';
import { createGateReceipt, gateInputs, digest } from '../../Reader-Core-Native/scripts/lib/gate-receipt.mjs';
import { CORE_GATE_STAGES } from '../../Reader-Core-Native/scripts/lib/core-gate-stages.mjs';
import { verifyBuildLease } from '../../Reader-Core-Native/scripts/lib/build-resource-lock.mjs';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'reader-delivery-admission-')));
const put = (path, value = '') => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); return path; };
try {
  assert.equal(buildContractScope(new Map([['--class', 'acceptance'], ['--core-gate-receipt', 'fixture-receipt.json']])), undefined);
  for (const task of ['compileNative', ':entry:default@ConfigureCmake', 'default@BuildNativeWithNinja', 'BuildNativeWithCmake',
    'ProcessLibs', ':entry:default@DoNativeStrip', 'default@CacheNativeLibs', 'clean', 'assembleHap']) assert.equal(isBuildResourceTask(task), true);
  assert.equal(isPackageTask('compileNative'), false); assert.equal(isBuildResourceTask('PreviewArkTS'), false);
  const cacheStages = ['cmake/default/obj', 'libs/default', 'stripped_native_libs/default'];
  const cacheLibraries = ['libc++_shared.so', 'libreader_bookturn_napi.so', 'libreader_core_napi.so'];
  const cachePath = (directory, stage, name) => join(directory, 'entry/build/default/intermediates', stage, 'arm64-v8a', name);
  const cacheFixture = label => {
    const directory = join(root, 'native-cache', label); mkdirSync(directory, { recursive: true }); return directory;
  };
  const treeSnapshot = directory => {
    const records = [];
    function visit(path) {
      const stat = lstatSync(path), record = { path: relative(directory, path), ino: stat.ino, dev: stat.dev, mode: stat.mode };
      if (stat.isSymbolicLink()) record.link = readlinkSync(path);
      else if (stat.isFile()) record.sha256 = digest(readFileSync(path));
      records.push(record);
      if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
    }
    visit(directory); return records;
  };
  const emptyCache = cacheFixture('empty');
  assert.deepEqual(reconcileIdeNativeCache(emptyCache), { removed: [], recoveryDirectory: null });
  assert.equal(lstatSync(join(emptyCache, '.reader-local'), { throwIfNoEntry: false }), undefined,
    'an empty generated cache must not create local recovery state');
  const cleanCache = cacheFixture('canonical-only');
  for (const stage of cacheStages) for (const library of cacheLibraries) put(cachePath(cleanCache, stage, library), `canonical:${stage}:${library}`);
  const cleanBefore = treeSnapshot(cleanCache);
  assert.deepEqual(reconcileIdeNativeCache(cleanCache), { removed: [], recoveryDirectory: null });
  assert.deepEqual(treeSnapshot(cleanCache), cleanBefore, 'current canonical caches must remain untouched');

  const repairedCache = cacheFixture('all-stages'), copies = new Map(), canonicalBefore = new Map();
  for (const stage of cacheStages) for (const [index, library] of cacheLibraries.entries()) {
    const bytes = Buffer.from(`fixture Native bytes:${stage}:${library}\0`), canonical = put(cachePath(repairedCache, stage, library), bytes);
    canonicalBefore.set(canonical, { bytes, stat: lstatSync(canonical) });
    const alias = put(cachePath(repairedCache, stage, library.replace(/\.so$/, ` ${index === 0 ? 1 : index === 1 ? 2 : 12}.so`)), bytes);
    copies.set(alias, { canonical, bytes, stat: lstatSync(alias) });
    if (library === 'libreader_core_napi.so') {
      const hardlink = cachePath(repairedCache, stage, library.replace(/\.so$/, ' 3.so'));
      linkSync(canonical, hardlink);
      copies.set(hardlink, { canonical, bytes, stat: lstatSync(hardlink) });
    }
  }
  const authored = put(join(repairedCache, 'entry/libs/arm64-v8a/libreader_core_napi.so'), 'authored Native input');
  const authoredAlias = put(join(dirname(authored), 'libreader_core_napi 2.so'), 'authored numbered input');
  const unrelated = put(join(repairedCache, 'entry/build/default/intermediates/unrelated/default/libunknown.so'), 'other generated input');
  const preserved = [authored, authoredAlias, unrelated].map(path => ({ path, bytes: readFileSync(path), stat: lstatSync(path) }));
  const recovery = reconcileIdeNativeCache(repairedCache);
  assert.equal(recovery.removed.length, copies.size, 'all three generated stages and known library names must be covered');
  assert.equal(isAbsolute(recovery.recoveryDirectory), true);
  assert.equal(dirname(recovery.recoveryDirectory), join(repairedCache, '.reader-local/native-cache-recovery'));
  assert.match(relative(dirname(recovery.recoveryDirectory), recovery.recoveryDirectory), /^recovery-/);
  const receiptFile = join(recovery.recoveryDirectory, 'receipt.json'), receiptBytes = readFileSync(receiptFile);
  const recoveryReceipt = JSON.parse(receiptBytes);
  assert.deepEqual(recoveryReceipt.files, recovery.removed, 'the receipt must describe exactly the returned recovery records');
  const seenCopies = new Set();
  for (const record of recovery.removed) {
    const path = resolve(repairedCache, record.path), expected = copies.get(path);
    assert.ok(expected, `unexpected recovery record: ${record.path}`);
    assert.equal(seenCopies.has(path), false, 'a generated copy must be recovered once'); seenCopies.add(path);
    assert.equal(resolve(repairedCache, record.canonical), expected.canonical);
    assert.equal(record.bytes, expected.bytes.length); assert.equal(record.sha256, digest(expected.bytes));
    const backup = resolve(recovery.recoveryDirectory, record.recoveryPath);
    assert.ok(backup.startsWith(`${recovery.recoveryDirectory}${sep}`), 'backup files must stay inside the private recovery directory');
    assert.deepEqual(readFileSync(backup), expected.bytes);
    const backupStat = lstatSync(backup);
    assert.equal(backupStat.isFile(), true);
    assert.notEqual(`${backupStat.dev}:${backupStat.ino}`, `${expected.stat.dev}:${expected.stat.ino}`,
      'a recovery file must own independent bytes, including when the original copy was a hardlink');
    assert.equal(lstatSync(path, { throwIfNoEntry: false }), undefined, 'only the recovered numbered copy must be removed');
  }
  for (const [path, before] of canonicalBefore) {
    assert.deepEqual(readFileSync(path), before.bytes);
    assert.equal(lstatSync(path).ino, before.stat.ino, 'canonical Native libraries must retain their filesystem identity');
  }
  for (const before of preserved) {
    assert.deepEqual(readFileSync(before.path), before.bytes);
    assert.equal(lstatSync(before.path).ino, before.stat.ino, 'authored and unrelated Native inputs must remain untouched');
  }
  const recoveredBefore = treeSnapshot(repairedCache);
  assert.deepEqual(reconcileIdeNativeCache(repairedCache), { removed: [], recoveryDirectory: null });
  assert.deepEqual(treeSnapshot(repairedCache), recoveredBefore, 'a second admission must make no filesystem changes');
  assert.deepEqual(readFileSync(receiptFile), receiptBytes, 'idempotent admission must preserve the recovery receipt');

  const goodCacheCopy = directory => {
    const canonical = put(cachePath(directory, cacheStages[0], cacheLibraries[1]), 'valid generated Native');
    const alias = put(cachePath(directory, cacheStages[0], 'libreader_bookturn_napi 2.so'), readFileSync(canonical));
    return { canonical, alias };
  };
  const invalidCacheCases = [
    { label: 'different-bytes', canonical: 'regular', alias: 'different' },
    { label: 'missing-canonical', canonical: 'missing', alias: 'regular' },
    { label: 'unknown-library', name: 'libunknown.so', canonical: 'missing', alias: 'regular' },
    { label: 'unknown-versioned-library', name: 'libunknown.so.1', canonical: 'missing', alias: 'regular' },
    { label: 'unknown-numbered-library', name: 'libunknown 2.so', canonical: 'missing', alias: 'regular' },
    { label: 'zero-number', name: 'libreader_core_napi 0.so', canonical: 'regular', alias: 'regular' },
    { label: 'leading-zero-number', name: 'libreader_core_napi 02.so', canonical: 'regular', alias: 'regular' },
    { label: 'alias-symlink', canonical: 'regular', alias: 'symlink' },
    { label: 'alias-dangling-symlink', canonical: 'regular', alias: 'dangling' },
    { label: 'canonical-symlink', canonical: 'symlink', alias: 'regular' },
    { label: 'canonical-dangling-symlink', canonical: 'dangling', alias: 'regular' },
    { label: 'alias-fifo', canonical: 'regular', alias: 'fifo' },
    { label: 'canonical-fifo', canonical: 'fifo', alias: 'regular' },
    { label: 'alias-directory', canonical: 'regular', alias: 'directory' },
  ];
  for (const test of invalidCacheCases) {
    const directory = cacheFixture(`invalid-${test.label}`); goodCacheCopy(directory);
    const canonical = cachePath(directory, cacheStages[2], cacheLibraries[2]);
    const alias = cachePath(directory, cacheStages[2], test.name ?? 'libreader_core_napi 2.so');
    const target = join(directory, 'external-input.so');
    function node(path, kind) {
      mkdirSync(dirname(path), { recursive: true });
      if (kind === 'regular' || kind === 'different') put(path, kind === 'different' ? 'different Native bytes' : 'invalid-case Native bytes');
      else if (kind === 'directory') mkdirSync(path);
      else if (kind === 'fifo') execFileSync('mkfifo', [path]);
      else if (kind === 'symlink' || kind === 'dangling') {
        if (kind === 'symlink') put(target, 'invalid-case Native bytes');
        symlinkSync(kind === 'symlink' ? target : join(directory, 'absent-target'), path);
      }
    }
    node(canonical, test.canonical); node(alias, test.alias);
    const before = treeSnapshot(directory);
    assert.throws(() => reconcileIdeNativeCache(directory), /Native/i, test.label);
    assert.deepEqual(treeSnapshot(directory), before,
      `${test.label}: the full inventory must be validated before backup or removal of an earlier valid copy`);
    assert.equal(lstatSync(join(directory, '.reader-local'), { throwIfNoEntry: false }), undefined,
      'rejected generated entries must not create a recovery directory');
  }
  for (const linkRelative of ['entry', 'entry/build', 'entry/build/default', 'entry/build/default/intermediates',
    'entry/build/default/intermediates/stripped_native_libs', 'entry/build/default/intermediates/stripped_native_libs/default',
    'entry/build/default/intermediates/stripped_native_libs/default/arm64-v8a']) {
    const label = linkRelative.replaceAll('/', '-'), directory = cacheFixture(`scan-parent-link-${label}`);
    const outside = cacheFixture(`outside-scan-parent-${label}`);
    const canonical = put(cachePath(outside, cacheStages[2], cacheLibraries[2]), 'outside generated Native');
    put(cachePath(outside, cacheStages[2], 'libreader_core_napi 2.so'), readFileSync(canonical));
    const link = join(directory, linkRelative); mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(outside, linkRelative), link, 'dir');
    const before = treeSnapshot(directory), outsideBefore = treeSnapshot(outside);
    assert.throws(() => reconcileIdeNativeCache(directory), /Native/i, `scan parent ${linkRelative}`);
    assert.deepEqual(treeSnapshot(directory), before); assert.deepEqual(treeSnapshot(outside), outsideBefore,
      'generated cache scanning must reject directory links without editing their outside targets');
  }
  for (const linkRelative of ['.reader-local', '.reader-local/native-cache-recovery']) {
    const label = linkRelative.replaceAll('/', '-'), directory = cacheFixture(`recovery-parent-link-${label}`);
    const outside = cacheFixture(`outside-recovery-parent-${label}`); put(join(outside, 'keep.txt'), 'outside recovery parent');
    goodCacheCopy(directory);
    const link = join(directory, linkRelative); mkdirSync(dirname(link), { recursive: true }); symlinkSync(outside, link, 'dir');
    const before = treeSnapshot(directory), outsideBefore = treeSnapshot(outside);
    assert.throws(() => reconcileIdeNativeCache(directory), /Native/i, `recovery parent ${linkRelative}`);
    assert.deepEqual(treeSnapshot(directory), before); assert.deepEqual(treeSnapshot(outside), outsideBefore,
      'recovery directory links must not redirect backup writes outside the repository');
  }
  const linkedCacheTarget = cacheFixture('outside-repository-link'); goodCacheCopy(linkedCacheTarget);
  const linkedCache = join(root, 'native-cache', 'repository-link'); symlinkSync(linkedCacheTarget, linkedCache, 'dir');
  const linkedBefore = treeSnapshot(linkedCacheTarget);
  assert.throws(() => reconcileIdeNativeCache(linkedCache), /Native/i, 'a symlink repository root must be rejected');
  assert.deepEqual(treeSnapshot(linkedCacheTarget), linkedBefore);
  const inputFixture = label => {
    const directory = join(root, 'native-input-types', label);
    const paths = { firstCore: put(join(directory, 'core-identity.json'), 'synthetic identity'),
      secondCore: put(join(directory, 'core-snapshot.json'), 'synthetic snapshot'),
      native: put(join(directory, 'native.so'), 'synthetic Native'), sdk: join(directory, 'sdk') };
    put(join(paths.sdk, 'Index.ts'), 'synthetic SDK');
    return { directory, paths, check: () => ideNativeInputState([paths.firstCore, paths.secondCore], paths.native, paths.sdk) };
  };
  assert.equal(inputFixture('all-current').check(), 'current');
  for (const { label, missing, expected } of [
    { label: 'core-missing', missing: ['firstCore'], expected: 'rebuild' },
    { label: 'native-missing', missing: ['native'], expected: 'synchronize' },
    { label: 'sdk-missing', missing: ['sdk'], expected: 'synchronize' },
    { label: 'all-missing', missing: ['firstCore', 'secondCore', 'native', 'sdk'], expected: 'rebuild' },
  ]) {
    const fixture = inputFixture(label);
    for (const name of missing) rmSync(fixture.paths[name], { recursive: true });
    assert.equal(fixture.check(), expected, label);
    for (const name of missing) assert.equal(lstatSync(fixture.paths[name], { throwIfNoEntry: false }), undefined,
      'classifying missing inputs must not create replacements');
  }
  for (const { label, special, kind, missing } of [
    { label: 'native-dangling-sdk-missing', special: 'native', kind: 'dangling', missing: 'sdk' },
    { label: 'native-link-sdk-missing', special: 'native', kind: 'symlink', missing: 'sdk' },
    { label: 'native-fifo-sdk-missing', special: 'native', kind: 'fifo', missing: 'sdk' },
    { label: 'sdk-dangling-native-missing', special: 'sdk', kind: 'dangling', missing: 'native' },
    { label: 'sdk-link-native-missing', special: 'sdk', kind: 'symlink', missing: 'native' },
    { label: 'sdk-fifo-native-missing', special: 'sdk', kind: 'fifo', missing: 'native' },
    { label: 'core-fifo-later-core-missing', special: 'firstCore', kind: 'fifo', missing: 'secondCore' },
    { label: 'core-fifo-earlier-core-missing', special: 'secondCore', kind: 'fifo', missing: 'firstCore' },
    { label: 'core-dangling-other-core-missing', special: 'secondCore', kind: 'dangling', missing: 'firstCore' },
    { label: 'native-fifo-core-missing', special: 'native', kind: 'fifo', missing: 'firstCore' },
    { label: 'sdk-fifo-core-missing', special: 'sdk', kind: 'fifo', missing: 'firstCore' },
  ]) {
    const fixture = inputFixture(label), path = fixture.paths[special], absent = fixture.paths[missing];
    rmSync(path, { recursive: true }); rmSync(absent, { recursive: true });
    let linkTarget;
    if (kind === 'fifo') execFileSync('mkfifo', [path]);
    else {
      linkTarget = join(fixture.directory, kind === 'dangling' ? 'absent-target' : 'real-target');
      if (kind === 'symlink') {
        if (special === 'sdk') mkdirSync(linkTarget);
        else put(linkTarget, 'original symlink target');
      }
      symlinkSync(linkTarget, path, special === 'sdk' ? 'dir' : 'file');
    }
    const before = lstatSync(path, { bigint: true });
    assert.equal(kind === 'fifo' ? before.isFIFO() : before.isSymbolicLink(), true);
    assert.throws(() => fixture.check(), /(?:Native build input must be a regular file|Host Native\/SDK inputs must be a regular file and real directory)/,
      `${label}: existing special nodes must take precedence over a missing input`);
    const after = lstatSync(path, { bigint: true });
    assert.equal(after.ino, before.ino, 'rejected input must retain its original filesystem node');
    assert.equal(after.mode, before.mode, 'rejected input must retain its original type and permissions');
    if (kind !== 'fifo') assert.equal(readlinkSync(path), linkTarget, 'rejected symlink target must remain unchanged');
    assert.equal(lstatSync(absent, { throwIfNoEntry: false }), undefined, 'rejection must not create the missing counterpart');
  }
  const nativeDiagnostic = message => new Error(`fixture generator failed (1): file:///fixture.mjs:7\nError: ${message}\n    at fixture`);
  const coreMismatch = 'Core build identity does not match the Core worktree used for the manifest';
  const contentMismatch = 'Core build inputs changed; rebuild the Native/SDK package';
  const repairCases = [
    { error: nativeDiagnostic(coreMismatch), expected: ['check', 'rebuild', 'synchronize', 'check'] },
    { error: nativeDiagnostic(contentMismatch), expected: ['check', 'rebuild', 'synchronize', 'check'] },
    { error: nativeDiagnostic('Harmony app native input does not match the NAPI package native library'), expected: ['check', 'synchronize', 'check'] },
    { error: nativeDiagnostic('Harmony vendored SDK does not match the NAPI package manifest'), expected: ['check', 'synchronize', 'check'] },
    { error: Object.assign(new Error('fixture package missing'), { code: 'READER_IDE_NATIVE_PACKAGE_MISSING' }), expected: ['check', 'rebuild', 'synchronize', 'check'] },
    { error: Object.assign(new Error('fixture Host inputs missing'), { code: 'READER_IDE_NATIVE_HOST_MISSING' }), expected: ['check', 'synchronize', 'check'] },
  ];
  const healthyEvents = [];
  assert.equal(prepareIdeNativeInputs({
    check() { healthyEvents.push('check'); return 'current pair'; },
    rebuild() { healthyEvents.push('rebuild'); }, synchronize() { healthyEvents.push('synchronize'); },
  }), 'current pair');
  assert.deepEqual(healthyEvents, ['check'], 'a current pair must not invoke either producer or synchronization');
  for (const { error, expected } of repairCases) {
    const events = []; let checked = false;
    assert.equal(prepareIdeNativeInputs({
      check() { events.push('check'); if (!checked) { checked = true; throw error; } return 'refreshed pair'; },
      rebuild() { events.push('rebuild'); }, synchronize() { events.push('synchronize'); },
    }), 'refreshed pair');
    assert.deepEqual(events, expected, error.message);
  }
  for (const error of [nativeDiagnostic('Native SDK smoke must pass; missing or skipped is not compatible evidence'),
    nativeDiagnostic('Core build evidence does not bind the identity and native library inputs'),
    nativeDiagnostic('build input must be a regular file: fixture'),
    nativeDiagnostic(`${coreMismatch}; unexpected suffix`),
    new Error(`unrecognized diagnostic containing Error: ${coreMismatch}\n`),
    Object.assign(new Error('fixture unexpected missing input'), { code: 'ENOENT' })]) {
    const events = [];
    assert.throws(() => prepareIdeNativeInputs({
      check() { events.push('check'); throw error; }, rebuild() { events.push('rebuild'); },
      synchronize() { events.push('synchronize'); },
    }), caught => caught === error, 'unknown or corrupt inputs must preserve the original failure');
    assert.deepEqual(events, ['check'], 'unknown failure must not trigger automatic repair');
  }
  for (const failedStage of ['rebuild', 'synchronize', 'recheck']) {
    const events = [], failure = nativeDiagnostic(contentMismatch); let checks = 0;
    assert.throws(() => prepareIdeNativeInputs({
      check() { events.push('check'); checks++; if (checks === 1) throw nativeDiagnostic(coreMismatch); throw failure; },
      rebuild() { events.push('rebuild'); if (failedStage === 'rebuild') throw failure; },
      synchronize() { events.push('synchronize'); if (failedStage === 'synchronize') throw failure; },
    }), caught => caught === failure);
    assert.deepEqual(events, failedStage === 'rebuild' ? ['check', 'rebuild'] :
      failedStage === 'synchronize' ? ['check', 'rebuild', 'synchronize'] : ['check', 'rebuild', 'synchronize', 'check'],
    'repair failure must stop without retrying or running later callbacks');
  }
  const suppliedEnv = { PATH: ['fixture preferred bin', 'fixture second bin'].join(delimiter),
    CARGO_HOME: join(root, 'Cargo home'), BUN_INSTALL: join(root, 'Bun home'),
    READER_NODE: 'explicit-reader-node', NODE: 'explicit-node', READER_BUILD_LEASE_TOKEN: 'fixture-lease' };
  const suppliedBefore = structuredClone(suppliedEnv), adaptedEnv = ideNativeBuildEnvironment(suppliedEnv);
  assert.deepEqual(suppliedEnv, suppliedBefore, 'GUI environment adaptation must not mutate the caller');
  assert.deepEqual(adaptedEnv.PATH.split(delimiter).slice(0, 2), suppliedEnv.PATH.split(delimiter),
    'configured PATH entries must keep priority over appended GUI fallbacks');
  for (const path of [dirname(process.execPath), join(suppliedEnv.CARGO_HOME, 'bin'), join(suppliedEnv.BUN_INSTALL, 'bin')]) {
    assert.equal(adaptedEnv.PATH.split(delimiter).filter(value => value === path).length, 1);
  }
  assert.equal(adaptedEnv.READER_NODE, suppliedEnv.READER_NODE); assert.equal(adaptedEnv.NODE, suppliedEnv.NODE);
  assert.equal(adaptedEnv.READER_BUILD_LEASE_TOKEN, suppliedEnv.READER_BUILD_LEASE_TOKEN);
  assert.equal(ideNativeBuildEnvironment({ NODE: 'explicit-node' }).READER_NODE, 'explicit-node');
  assert.equal(ideNativeBuildEnvironment({}).READER_NODE, process.execPath);
  const mixedCasePath = ideNativeBuildEnvironment({ Path: dirname(process.execPath) });
  assert.equal(mixedCasePath.PATH, undefined);
  assert.equal(mixedCasePath.Path.split(delimiter).filter(path => path === dirname(process.execPath)).length, 1);
  const oldLockRoot = process.env.READER_LOCK_DIR;
  const oldLeaseToken = process.env.READER_BUILD_LEASE_TOKEN;
  try {
    process.env.READER_LOCK_DIR = join(root, 'ide-locks');
    const retiredAdmission = beginIdeBuild({});
    finishIdeBuild();
    await assert.rejects(retiredAdmission, /ended before resource admission/);
    assert.equal(existsSync(join(process.env.READER_LOCK_DIR, 'reader-harmony-hap-build.lock')), false,
      'a late dynamic import cannot acquire a lease after buildFinished');
    delete process.env.READER_BUILD_LEASE_TOKEN;
    const [leaseEnv, repeatedEnv] = await Promise.all([beginIdeBuild({}), beginIdeBuild({})]);
    assert.ok(leaseEnv?.READER_BUILD_LEASE_TOKEN, 'IDE admission must return its child-process lease environment');
    assert.equal(repeatedEnv.READER_BUILD_LEASE_TOKEN, leaseEnv.READER_BUILD_LEASE_TOKEN,
      'concurrent callbacks must share one parent lease');
    const owner = verifyBuildLease(leaseEnv);
    assert.equal(owner.pid, process.pid);
    assert.equal((await beginIdeBuild({})).READER_BUILD_LEASE_TOKEN, owner.token,
      'an already admitted callback must retain the same lease environment');
    const lockModule = new URL('../../Reader-Core-Native/scripts/lib/build-resource-lock.mjs', import.meta.url).href;
    const child = (env, body) => spawnSync(process.execPath, ['--input-type=module', '-e',
      `import { acquireBuildLease, verifyBuildLease } from ${JSON.stringify(lockModule)}; ${body}`],
    { env, encoding: 'utf8', timeout: 10000 });
    const borrowed = child(leaseEnv, `
      const before = verifyBuildLease();
      const lease = acquireBuildLease();
      lease.release();
      const after = verifyBuildLease();
      console.log(JSON.stringify({ before, after, token: lease.env.READER_BUILD_LEASE_TOKEN }));
    `);
    assert.ifError(borrowed.error); assert.equal(borrowed.status, 0, borrowed.stderr);
    const borrowedOwner = JSON.parse(borrowed.stdout);
    assert.deepEqual(borrowedOwner.before, owner);
    assert.deepEqual(borrowedOwner.after, owner, 'a borrowing child release must preserve the parent lock');
    assert.equal(borrowedOwner.token, owner.token);
    assert.deepEqual(verifyBuildLease(leaseEnv), owner);
    const withoutToken = { ...leaseEnv }; delete withoutToken.READER_BUILD_LEASE_TOKEN;
    const occupied = child(withoutToken, 'acquireBuildLease();');
    assert.ifError(occupied.error); assert.notEqual(occupied.status, 0);
    assert.match(occupied.stderr, /occupied or has an unreconciled stale owner/);
    const forged = child({ ...leaseEnv, READER_BUILD_LEASE_TOKEN: 'forged-fixture-token' }, 'acquireBuildLease();');
    assert.ifError(forged.error); assert.notEqual(forged.status, 0); assert.match(forged.stderr, /Missing or retired/);
    assert.deepEqual(verifyBuildLease(leaseEnv), owner, 'rejected children must not alter parent ownership');
    finishIdeBuild();
    const retired = child(leaseEnv, 'acquireBuildLease();');
    assert.ifError(retired.error); assert.notEqual(retired.status, 0); assert.match(retired.stderr, /Missing or retired/);
    let failedEnv;
    await assert.rejects(async () => {
      try {
        failedEnv = await beginIdeBuild({});
        throw new Error('fixture Native preflight failed');
      } finally { finishIdeBuild(); }
    }, /fixture Native preflight failed/);
    assert.throws(() => verifyBuildLease(failedEnv), /Missing or retired/,
      'the failed preparation finally path must release the parent lease');
    const recoveredEnv = await beginIdeBuild({});
    assert.notEqual(recoveredEnv.READER_BUILD_LEASE_TOKEN, owner.token);
    verifyBuildLease(recoveredEnv); finishIdeBuild();
    assert.equal(process.env.READER_BUILD_LEASE_TOKEN, undefined, 'finished IDE invocation retires its token');
  } finally {
    finishIdeBuild();
    if (oldLockRoot === undefined) delete process.env.READER_LOCK_DIR; else process.env.READER_LOCK_DIR = oldLockRoot;
    if (oldLeaseToken === undefined) delete process.env.READER_BUILD_LEASE_TOKEN; else process.env.READER_BUILD_LEASE_TOKEN = oldLeaseToken;
  }
  const paths = JSON.parse(readFileSync(fileURLToPath(new URL('../scripts/lib/hap-required-resources.json', import.meta.url)))).paths;
  const processReport = join(root, 'owned-process-results.json');
  let releaseCount = 0;
  const retainedLease = { release() { releaseCount++; } };
  assert.equal(releaseContractBuildWorkspace(retainedLease, processReport, { dispatched: true }), false);
  assert.equal(releaseCount, 0, 'killed dispatcher without its receipt cannot authorize parent release');
  for (const report of [{ treeSettled: false }, { treeSettled: true, treeRecoveryBlocked: true }]) {
    put(processReport, JSON.stringify(report));
    assert.equal(releaseContractBuildWorkspace(retainedLease, processReport), false);
    assert.equal(releaseCount, 0, 'canonical parent must retain its lease while a nested process group survives');
  }
  put(processReport, JSON.stringify({ treeSettled: true, treeRecoveryBlocked: false }));
  assert.equal(releaseContractBuildWorkspace(retainedLease, processReport), true);
  assert.equal(releaseCount, 1);
  put(processReport, '{invalid');
  assert.throws(() => releaseContractBuildWorkspace(retainedLease, processReport), SyntaxError);
  assert.equal(releaseCount, 1, 'unreadable process settlement evidence cannot authorize release');
  for (const path of paths) put(join(root, 'entry/src/main/resources/rawfile', path), `fixture:${path}`);
  const records = requiredHapResources(root), names = records.map(r => r.path);
  const entry = path => readFileSync(join(root, 'entry/src/main', path));
  verifyRequiredHapResources(records, names, entry);
  assert.throws(() => verifyRequiredHapResources(records, names.slice(1), entry), /missing/);
  assert.throws(() => verifyRequiredHapResources(records, [...names, names[0]], entry), /duplicated/);
  assert.throws(() => verifyRequiredHapResources(records, names, () => Buffer.from('wrong')), /bytes differ/);
  assert.throws(() => currentCoreGate(undefined, root), /complete current Core gate/);

  // Receipt protocol fixture: these tiny processes do not claim a Core test run.
  put(join(root, 'input.txt'), 'fixture');
  const snapshot = contentSnapshot(root, ['input.txt']);
  const receipt = createGateReceipt({ kind: 'core-development', root, output: join(root, 'core-gate/receipt.json'), snapshot, expectedStages: CORE_GATE_STAGES });
  for (const id of CORE_GATE_STAGES) receipt.stage(id, process.execPath, ['-e', '']);
  receipt.finish(snapshot);
  const descriptor = { status: 'PASS', path: 'core-gate/receipt.json', sha256: digest(readFileSync(receipt.file)), inputFingerprint: snapshot.fingerprint, runId: receipt.report.runId };
  verifyPublishedCoreGate(root, descriptor);
  const data = JSON.parse(readFileSync(receipt.file)); data.stages.pop(); writeFileSync(receipt.file, JSON.stringify(data));
  assert.throws(() => verifyPublishedCoreGate(root, descriptor), /identity mismatch/);
  descriptor.sha256 = digest(readFileSync(receipt.file));
  assert.throws(() => verifyPublishedCoreGate(root, descriptor), /invalid/);

  const checkout = join(root, 'temporary core'); mkdirSync(checkout);
  const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { stdio: 'pipe' });
  put(join(checkout, '.gitignore'), '.reader-artifacts/\n'); put(join(checkout, 'tracked.txt'), 'before');
  git('init', '-q'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'temporary fixture');
  const realInputs = gateInputs(checkout);
  const current = createGateReceipt({ kind: 'core-development', root: checkout, expectedStages: CORE_GATE_STAGES });
  for (const id of CORE_GATE_STAGES) current.stage(id, process.execPath, ['-e', '']);
  current.finish(); currentCoreGate(current.file, checkout);
  put(join(checkout, '.reader-artifacts', 'extra.log'), 'ignored output');
  assert.deepEqual(gateInputs(checkout), realInputs); currentCoreGate(current.file, checkout);
  put(join(checkout, 'tracked.txt'), 'changed'); assert.throws(() => currentCoreGate(current.file, checkout), /current inputs/);
  put(join(checkout, 'tracked.txt'), 'before'); put(join(checkout, 'untracked.txt'), 'new input');
  assert.throws(() => currentCoreGate(current.file, checkout), /current inputs/);
  let pid = '123', boot = 'true', calls = [];
  const query = command => { calls.push(command); return command.includes('completed') ? boot : command.includes('boot_id') ? '12345678-1234-1234-1234-123456789abc' : command.includes('uptime') ? '100 200' : pid; };
  const vmLog = put(join(root, 'emulator.log'), 'Guest OS Boot Completed!!\n');
  const ready = targetReadiness({ targetKind: 'vm', query, vmLog, wait() {} });
  assert.equal(ready.sceneBoardStable, true); assert.equal(ready.emulatorLog.bootMarker, true);
  boot = 'false'; calls = [];
  assert.throws(() => targetReadiness({ targetKind: 'vm', query, vmLog, wait() {} }), /boot is not complete/); assert.equal(calls.length, 1);
  boot = 'true';
  assert.throws(() => targetReadiness({ targetKind: 'vm', query, wait() {} }), /vm-log/);
  put(vmLog, 'Guest OS Boot Completed!!\nLIFECYCLE_TIMEOUT\n');
  assert.throws(() => targetReadiness({ targetKind: 'vm', query, vmLog, wait() {} }), /instability/);
  put(vmLog, 'Guest OS Boot Completed!!\n');
  assert.throws(() => targetReadiness({ targetKind: 'physical', query, wait() { pid = '124'; } }), /changed/);
  assert.equal(calls.some(s => s.includes('bm ') || s.includes('aa ') || s.includes('install')), false);
  // A user-build physical shell may deny boot_id. The fallback must bind real
  // read-only clock/boot milestones, never the repeated permission-error text.
  const physicalMilestones = { kernel: '881433', init: '7026507', 'samgr.ready': '7156994',
    'appspawn.started': '7756549', 'wms.ready': '14402801', 'boot.completed': '17482085' };
  const physicalBootEpoch = Date.UTC(2026, 9, 16, 10, 29, 23), physicalCheckEpoch = physicalBootEpoch + 155_000;
  const physicalDenied = '/bin/sh: cat: /proc/sys/kernel/random/boot_id: Permission denied';
  const utcBootStamp = value => new Date(value).toISOString().slice(0, 19).replace('T', ' ');
  function physicalReadiness(options = {}) {
    const commands = []; let elapsed = 0, wallElapsed = 0, second = false;
    const guestQuery = command => {
      commands.push(command);
      if (command === 'cat /proc/sys/kernel/random/boot_id') {
        if (options.throwProc) throw new Error(physicalDenied);
        return second ? options.finalBootId ?? options.bootId ?? physicalDenied : options.bootId ?? physicalDenied;
      }
      if (command === 'param get bootevent.boot.completed') return second ? options.finalComplete ?? 'true' : 'true';
      if (command === 'pidof com.ohos.sceneboard') return second ? options.finalPid ?? '1643' : '1643';
      if (command === 'date -u +%s') return options.guestDate ?? String(Math.floor((physicalCheckEpoch + elapsed +
        (options.clockOffset ?? 0) + (second ? options.secondClockOffset ?? 0 : 0)) / 1000));
      if (command === 'TZ=UTC uptime -s') return options.bootTimestamp ?? utcBootStamp(physicalBootEpoch +
        (options.bootOffset ?? 0) + (second ? options.secondBootOffset ?? 1000 : 0));
      if (command === 'cat /proc/uptime') return '155 155';
      const name = command.replace('param get ohos.boot.time.', '');
      if (Object.hasOwn(physicalMilestones, name)) return String((second ? options.secondMilestones : options.milestones)?.[name] ?? physicalMilestones[name]);
      throw new Error(`Unexpected physical readiness query: ${command}`);
    };
    return { commands, run: () => targetReadiness({ targetKind: options.targetKind ?? 'physical', query: guestQuery,
      vmLog: options.vmLog, now: () => physicalCheckEpoch + wallElapsed, monotonicNow: () => elapsed,
      wait() { elapsed += options.waitMs ?? 2000; wallElapsed = elapsed + (options.hostWaitOffset ?? 0); second = true; } }) };
  }
  const physicalFixture = physicalReadiness(), physicalReady = physicalFixture.run();
  assert.equal(physicalReady.status, 'PASS'); assert.equal(physicalReady.bootIdentitySource, 'physical-boot-milestones-v1');
  assert.equal(physicalReady.uptimeSource, 'toybox-sysinfo'); assert.equal(physicalReady.observationMs, 2000);
  assert.match(physicalReady.bootIdSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(physicalReady.bootIdSha256, digest(physicalDenied), 'a denied procfs string cannot be the boot identity');
  assert.equal(physicalReady.emulatorLog, undefined, 'physical admission must not manufacture VM log evidence');
  assert.equal(physicalReady.sceneBoardStable, true); assert.equal(physicalReady.bootCompleted, true);
  assert.equal(physicalReadiness({ throwProc: true }).run().bootIdentitySource, 'physical-boot-milestones-v1',
    'a thrown, explicit permission error may use the same independently checked fallback');
  assert.equal(physicalReadiness().run().bootIdSha256, physicalReady.bootIdSha256);
  const differentPhysicalBoot = physicalReadiness({ milestones: { kernel: '881434' }, secondMilestones: { kernel: '881434' } }).run();
  assert.notEqual(differentPhysicalBoot.bootIdSha256, physicalReady.bootIdSha256,
    'different actual startup evidence must produce a different identity despite identical permission errors');
  const physicalUuid = physicalReadiness({ bootId: '12345678-1234-1234-1234-123456789abc' });
  assert.equal(physicalUuid.run().bootIdentitySource, 'kernel-boot-id', 'an available UUID remains authoritative');
  assert.equal(physicalUuid.commands.includes('TZ=UTC uptime -s'), false, 'the fallback is restricted to explicit procfs denial');
  for (const [label, options, expected] of [
    ['permission text alone', { bootId: 'Permission denied' }, /boot identity is unavailable/],
    ['unrelated denied path', { bootId: '/proc/uptime: Permission denied' }, /boot identity is unavailable/],
    ['missing boot id', { bootId: '' }, /boot identity is unavailable/],
    ['unknown boot id', { bootId: 'not-a-uuid' }, /boot identity is unavailable/],
    ['missing milestone', { milestones: { init: '' } }, /milestone identity is unavailable/],
    ['zero milestone', { milestones: { init: '0' } }, /milestone identity is unavailable/],
    ['denied milestone', { milestones: { init: 'Permission denied' } }, /milestone identity is unavailable/],
    ['unsafe integer milestone', { milestones: { init: '9007199254740992' } }, /milestone identity is unavailable/],
    ['milestone replacement', { secondMilestones: { kernel: '881434' } }, /changed during readiness/],
    ['milestone byte replacement', { secondMilestones: { kernel: '0881433' } }, /changed during readiness|milestone identity/],
    ['boot time replacement', { secondBootOffset: 120_000 }, /changed during readiness/],
    ['malformed boot timestamp', { bootTimestamp: '2026-02-30 10:29:23' }, /boot timestamp is invalid/],
    ['future boot timestamp', { bootOffset: 200_000 }, /milestone timing is inconsistent/],
    ['future milestone', { milestones: { kernel: '99000000' } }, /milestone timing is inconsistent/],
    ['unavailable guest clock', { guestDate: 'Permission denied' }, /guest clock is unavailable/],
    ['guest clock disagreement', { clockOffset: 5000 }, /clock or observation is inconsistent/],
    ['guest clock jump', { secondClockOffset: 5000 }, /clock or observation is inconsistent/],
    ['guest clock frozen', { guestDate: String((physicalCheckEpoch + 1000) / 1000) }, /changed during readiness|clock or observation/],
    ['host clock jump', { hostWaitOffset: 5000 }, /observation interval or clock/],
    ['no observation', { waitMs: 0 }, /observation interval/],
    ['short observation', { waitMs: 1000 }, /observation interval/],
    ['unbounded observation', { waitMs: 11_000 }, /observation interval/],
    ['SceneBoard replacement', { finalPid: '1644' }, /boot\/SceneBoard changed/],
    ['boot becomes incomplete', { finalComplete: 'false' }, /boot\/SceneBoard changed/],
    ['procfs result changes', { finalBootId: '12345678-1234-1234-1234-123456789abc' }, /boot\/SceneBoard changed/],
    ['VM procfs denial without current-instance log', { targetKind: 'vm', vmLog }, /no completed current-instance/],
    ['VM missing log', { targetKind: 'vm', bootId: '12345678-1234-1234-1234-123456789abc' }, /vm-log/],
  ]) assert.throws(() => physicalReadiness(options).run(), expected, label);
  assert.equal(physicalFixture.commands.some(command => /\bbm\b|\baa\b|install|\bsu\b|chmod|param set/.test(command)), false,
    'physical readiness invokes only minimal read-only probes');
  // Restricted VM shells deny procfs, while Toybox uptime uses sysinfo(). Run
  // the actual admission function with controlled read-only query/log ports.
  const milestoneValues = { kernel: 881433, init: 7026507, 'samgr.ready': 7156994,
    'appspawn.started': 7756549, 'wms.ready': 14402801, 'boot.completed': 17482085 };
  const utcStamp = value => new Date(value).toISOString().slice(0, 19).replace('T', ' ');
  const localStamp = value => { const d = new Date(value), pad = (n, width = 2) => String(n).padStart(width, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`; };
  const bootEpoch = Date.UTC(2026, 9, 16, 10, 29, 23), checkEpoch = bootEpoch + 155_000;
  const startLine = `${localStamp(bootEpoch + 491)} 8643510144 [Info] [TraceTool.cpp(InitPipe:27)][TraceTool] trace pipe name is: "fixture"`;
  const resetLine = `${localStamp(bootEpoch + 1348)} 6182121472 [Info] [QemuManager.cpp(OnSystemReset:640)]System is reset`;
  const markerLine = `${localStamp(bootEpoch + 19036)} 6286782464 [Info] [QemuManager.cpp(EmitGuestOSBootComplete:131)]Guest OS Boot Completed!!`;
  const instanceLog = `${startLine}\n${resetLine}\n${markerLine}\n`;
  let restrictedCase = 0;
  function restricted(options = {}) {
    const log = put(join(root, `restricted-${++restrictedCase}.log`), options.log ?? instanceLog), commands = [];
    const sampleBootEpoch = options.bootEpoch ?? bootEpoch, sampleCheckEpoch = options.checkEpoch ?? checkEpoch;
    let elapsed = 0, second = false;
    const guestQuery = command => {
      commands.push(command);
      if (command === 'cat /proc/sys/kernel/random/boot_id') {
        if (options.throwProc) throw new Error('/proc/sys/kernel/random/boot_id: Permission denied');
        return options.bootId ?? '/bin/sh: cat: /proc/sys/kernel/random/boot_id: Permission denied';
      }
      if (command === 'cat /proc/uptime') return options.procUptime ?? '/bin/sh: cat: /proc/uptime: Permission denied';
      if (command === 'param get bootevent.boot.completed') return second ? options.finalComplete ?? 'true' : 'true';
      if (command === 'pidof com.ohos.sceneboard') return second ? options.finalPid ?? '1643' : '1643';
      if (command === 'date -u +%s') return options.guestDate ?? String(Math.floor((sampleCheckEpoch + elapsed + (second ? options.secondClockOffset ?? 0 : 0)) / 1000));
      if (command === 'TZ=UTC uptime -s') return options.bootTimestamp ?? utcStamp(sampleBootEpoch + (second ? options.secondBootOffset ?? 1000 : 0));
      const name = command.replace('param get ohos.boot.time.', '');
      if (Object.hasOwn(milestoneValues, name)) return String((second ? options.secondMilestones ?? options.milestones : options.milestones)?.[name] ?? milestoneValues[name]);
      throw new Error(`Unexpected readiness query: ${command}`);
    };
    return { log, commands, run: () => targetReadiness({ targetKind: options.targetKind ?? 'vm', query: guestQuery, vmLog: log,
      now: () => sampleCheckEpoch + elapsed, monotonicNow: () => elapsed,
      wait() { elapsed += options.waitMs ?? 2000; second = true; options.changeLog?.(log); } }) };
  }
  assert.equal(restricted({ targetKind: 'physical' }).run().bootIdentitySource, 'physical-boot-milestones-v1',
    'physical procfs denial retains its independently checked milestone fallback');
  const restrictedReady = restricted(), fallbackReady = restrictedReady.run();
  assert.equal(fallbackReady.status, 'PASS'); assert.equal(fallbackReady.bootIdentitySource, 'vm-startup-fingerprint-v1');
  assert.equal(fallbackReady.uptimeSource, 'toybox-sysinfo'); assert.equal(fallbackReady.observationMs, 2000);
  assert.match(fallbackReady.bootIdSha256, /^[a-f0-9]{64}$/); assert.equal(fallbackReady.emulatorLog.instanceSha256, fallbackReady.bootIdSha256);
  assert.equal(restricted({ throwProc: true }).run().status, 'PASS', 'a genuine procfs permission error can use the same VM-only evidence');
  const uuidWithRestrictedUptime = restricted({ bootId: '12345678-1234-1234-1234-123456789abc' }).run();
  assert.equal(uuidWithRestrictedUptime.bootIdentitySource, 'kernel-boot-id', 'available real UUID remains authoritative');
  assert.equal(uuidWithRestrictedUptime.uptimeSource, 'toybox-sysinfo');
  // Recorded original VM startup: host TraceTool starts before the guest
  // kernel. These are actual event offsets and read-only guest milestones,
  // rendered in the test process's local timezone like the host log parser.
  const delayedBootEpoch = Date.UTC(2026, 9, 16, 14, 25, 4);
  const delayedStart = `${localStamp(delayedBootEpoch - 1643)} 8643510144 [Info] [TraceTool.cpp(InitPipe:27)][TraceTool] trace pipe name is: "fixture-delayed"`;
  const delayedReset = `${localStamp(delayedBootEpoch + 413)} 481606922240 [Info] [QemuManager.cpp(OnSystemReset:640)]System is reset`;
  const delayedMarker = `${localStamp(delayedBootEpoch + 55588)} 486059421696 [Info] [QemuManager.cpp(EmitGuestOSBootComplete:131)]Guest OS Boot Completed!!`;
  const delayed = restricted({ bootEpoch: delayedBootEpoch, checkEpoch: Date.UTC(2026, 9, 16, 16, 42, 12),
    log: `${delayedStart}\n${delayedReset}\n${delayedMarker}\n`,
    milestones: { kernel: 3115150, init: 15495746, 'samgr.ready': 15960417,
      'appspawn.started': 22674576, 'wms.ready': 42897755, 'boot.completed': 53561651 } });
  assert.equal(delayed.run().status, 'PASS', 'a real host-initialization delay is not a guest boot identity mismatch');
  for (const [label, options, expected] of [
    ['missing procfs identity', { bootId: '' }, /boot identity is unavailable/],
    ['malformed procfs identity', { bootId: 'not-a-uuid' }, /boot identity is unavailable/],
    ['missing procfs uptime', { procUptime: '' }, /uptime is unavailable/],
    ['malformed UTC startup', { bootTimestamp: '2026-02-30 10:29:23' }, /timestamp is invalid/],
    ['guest date unavailable', { guestDate: 'Permission denied' }, /guest clock is unavailable/],
    ['missing milestone', { milestones: { init: 0 } }, /milestone identity is unavailable/],
    ['future milestone', { milestones: { kernel: 99_000_000 } }, /milestone timing is inconsistent/],
    ['guest boot before host instance interval', { bootTimestamp: utcStamp(bootEpoch - 2000) }, /does not match/],
    ['guest boot after completed host interval', { bootTimestamp: utcStamp(bootEpoch + 21000) }, /does not match/],
    ['completion marker before guest milestone', { log: instanceLog.replace(markerLine, markerLine.replace(localStamp(bootEpoch + 19036), localStamp(bootEpoch + 14036))) }, /does not match/],
    ['completion marker exceeds existing milestone delay bound', { log: instanceLog.replace(markerLine, markerLine.replace(localStamp(bootEpoch + 19036), localStamp(bootEpoch + 25036))) }, /does not match/],
    ['milestone replacement', { secondMilestones: { kernel: 881434 } }, /changed during readiness/],
    ['boot time replacement', { secondBootOffset: 120_000 }, /does not match/],
    ['guest clock jump', { secondClockOffset: 5000 }, /clock or observation is inconsistent/],
    ['no observation', { waitMs: 0 }, /observation interval/],
    ['unbounded observation', { waitMs: 11_000 }, /observation interval/],
    ['SceneBoard replacement', { finalPid: '1644' }, /boot\/SceneBoard changed/],
    ['boot becomes incomplete', { finalComplete: 'false' }, /boot\/SceneBoard changed/],
    ['no instance start', { log: `${markerLine}\n` }, /no completed current-instance/],
    ['stale log despite current mtime', { log: instanceLog.replaceAll(localStamp(bootEpoch).slice(0, 10), localStamp(bootEpoch - 86_400_000).slice(0, 10)) }, /does not match/],
    ['startup without completion', { log: `${instanceLog}${startLine}\n` }, /no completed current-instance/],
    ['post-boot reset', { log: `${instanceLog}${resetLine}\n` }, /instability/],
    ['reset during observation', { changeLog: file => writeFileSync(file, `${instanceLog}${resetLine}\n`) }, /unstable/],
    ['log prefix replacement', { changeLog: file => writeFileSync(file, `changed prefix\n${instanceLog}`) }, /changed during readiness/],
    ['new startup during observation', { changeLog: file => writeFileSync(file, `${instanceLog}${startLine}\n`) }, /no completed current-instance/],
  ]) assert.throws(() => restricted(options).run(), expected, label);
  const appended = restricted({ changeLog: file => writeFileSync(file, `${instanceLog}benign emulator observation\n`) });
  const appendResult = appended.run(); assert.equal(appendResult.emulatorLog.sha256, digest(readFileSync(appended.log)), 'receipt binds the fully observed append-only log');
  assert.equal(restrictedReady.commands.some(command => /\bbm\b|\baa\b|install|\bsu\b|chmod|param set/.test(command)), false,
    'readiness never invokes application operations, privilege changes or parameter writes');
  const sdk = join(root, 'sdk'), normal = join(sdk, 'ets/build-tools/ets-loader'), overridden = join(root, 'override loader');
  mkdirSync(normal, { recursive: true }); mkdirSync(join(sdk, 'toolchains')); mkdirSync(overridden);
  assert.deepEqual(contractToolchainLoaders({ READER_HARMONY_SDK_HOME: sdk, READER_ETS_LOADER_ROOT: overridden, PATH: '' }), [normal, overridden]);
  const attempt = hapStageReceipt(join(root, 'attempts'), { source: 'fixture' }); attempt.protect({ password: 'private-test-value' });
  const row = attempt.begin('hvigor', ['assembleHap']); attempt.end(row, { status: 7, stderr: 'storePassword=private-test-value\ncompile failed' }, 2); attempt.finish(new Error('compile failed'));
  const log = readFileSync(join(dirname(attempt.file), '1.log'), 'utf8'); assert.doesNotMatch(log, /private-test-value/); assert.match(log, /compile failed/);
  assert.equal(JSON.parse(readFileSync(attempt.file)).status, 'FAIL');
  console.log('Delivery admission fixtures PASS: generated Native copy recovery/receipts/idempotence and unsafe inventory rejection, real Native/SDK file types before missing classification, bounded Native repair callbacks, GUI environment, nested IDE lease ownership/rejection/cleanup, resources, complete receipt, readiness, loader inputs and failure logs; no device/build run.');
} finally { rmSync(root, { recursive: true, force: true }); }
