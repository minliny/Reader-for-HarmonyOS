import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const definitions = {
  'same-boot-witness': 'Physical boot quantization requires complete clock/milestone/SceneBoard witnesses; exact kernel identities remain exact',
  'build-binding': 'Core contract/input/Native and immutable HAP companion bindings reject substitutions',
  'live-admission': 'Observed layouts, backup/write barrier, live identity and WAL recheck govern admission',
  'signing-separation': 'A verified signing identity and saved PASS JSON cannot authorize data replacement',
  'snapshot-wal': 'SQLite Backup API includes committed WAL and leaves retained raw evidence unchanged',
  'lease-session': 'One bounded server lease spans the deployment batch and clears proxy environment',
  'collector-parsing': 'Actual BM UID, complete process inventory and DB/WAL/sidecar observations reject missing or changed facts',
  'legacy-admission': 'Only Core-observed explicit legacy source/target plans in the candidate contract are admitted',
};
for (const id of selectContractCases(definitions)) {
  await runCase(id);
  recordContractCasePass(id);
}
async function runCase(id) {
  const { default: assert } = await import('node:assert/strict');
  if (id === 'same-boot-witness') {
    const { assertSameTargetBoot, targetReadiness } = await import('../scripts/lib/hap-delivery-evidence.mjs');
    const { createHash } = await import('node:crypto');
    const hash = value => createHash('sha256').update(value).digest('hex');
    const milestones = ['881433', '7026507', '7156994', '7756549', '14402801', '17482085'];
    const epoch = Date.UTC(2026, 9, 30, 12), bootStart = epoch - 100000;
    const sample = (offset, delta = 0) => ({ bootStart: bootStart + delta, milestones,
      guestStart: epoch + offset, guestEnd: epoch + offset + 100,
      hostStart: epoch + offset, hostEnd: epoch + offset + 100,
      monotonicStart: offset, monotonicEnd: offset + 100 });
    const ready = (offset, delta = 0) => ({ status: 'PASS', bootCompleted: true, sceneBoardStable: true,
      bootIdentitySource: 'physical-boot-milestones-v1', bootIdSha256: hash(String(delta)), sceneBoardPidSha256: hash('1643'),
      physicalBootWitness: { version: 1, milestonesSha256: hash(JSON.stringify(milestones)),
        samples: [sample(offset, delta), sample(offset + 2100, delta)] } });
    const initial = ready(0), current = ready(10000, 1000);
    assert.notEqual(initial.bootIdSha256, current.bootIdSha256);
    assertSameTargetBoot(initial, current);
    assertSameTargetBoot(ready(0, 1000), ready(10000));
    const reject = change => { const altered = structuredClone(current); change(altered); assert.throws(() => assertSameTargetBoot(initial, altered), /boot changed/); };
    reject(x => delete x.physicalBootWitness);
    reject(x => x.sceneBoardPidSha256 = hash('1644'));
    reject(x => x.bootIdentitySource = 'kernel-boot-id');
    reject(x => x.physicalBootWitness.samples[0].bootStart += 1000);
    reject(x => x.physicalBootWitness.samples[0].milestones[0] = '0881433');
    reject(x => x.physicalBootWitness.samples[0].guestStart += 3000);
    reject(x => x.physicalBootWitness.samples[0].hostStart += 2000);
    reject(x => x.physicalBootWitness.samples[0].monotonicStart = -1);
    reject(x => x.physicalBootWitness.samples.reverse());
    const kernel = { ...initial, bootIdentitySource: 'kernel-boot-id' };
    assertSameTargetBoot(kernel, structuredClone(kernel));
    assert.throws(() => assertSameTargetBoot(kernel, { ...kernel, bootIdSha256: hash('new boot') }), /boot changed/);
    // Production readiness must actually emit both timed samples, including host clocks.
    let elapsed = 0;
    const names = ['kernel', 'init', 'samgr.ready', 'appspawn.started', 'wms.ready', 'boot.completed'];
    const result = targetReadiness({ targetKind: 'physical', now: () => epoch + elapsed,
      monotonicNow: () => elapsed, wait() { elapsed += 2000; }, query(command) {
        if (command === 'param get bootevent.boot.completed') return 'true';
        if (command.includes('/proc/sys/kernel/random/boot_id')) return '/bin/sh: cat: /proc/sys/kernel/random/boot_id: Permission denied';
        if (command.startsWith('pidof')) return '1643';
        if (command.startsWith('date')) { elapsed += 10; return ((epoch + elapsed) / 1000).toFixed(9); }
        if (command === 'TZ=UTC uptime -s') return new Date(bootStart + (elapsed > 2000 ? 1000 : 0)).toISOString().slice(0, 19).replace('T', ' ');
        return milestones[names.indexOf(command.replace('param get ohos.boot.time.', ''))];
      } });
    assert.equal(result.physicalBootWitness.samples.length, 2);
    assert.ok(result.physicalBootWitness.samples.every(s => Number.isFinite(s.hostStart) && Number.isFinite(s.hostEnd)));
    return;
  }
  if (id === 'collector-parsing') {
    const { parseStorageBundleDetails, assertStorageProcessInventory, parseStorageFileObservation,
      assertStorageFilesUnchanged } = await import('../scripts/lib/storage-device-evidence.mjs');
    const bundle = 'io.reader.minliny';
    const metadata = JSON.stringify({ name: bundle, applicationInfo: { uid: 20020074 } });
    assert.equal(parseStorageBundleDetails(metadata, bundle).uid, 20020074);
    for (const value of [JSON.stringify({ name: 'other', applicationInfo: { uid: 20020074 } }),
      JSON.stringify({ name: bundle, applicationInfo: {} }), JSON.stringify({ name: bundle, applicationInfo: { uid: '20020074' } })]) {
      assert.throws(() => parseStorageBundleDetails(value, bundle), /UID is unavailable/);
    }
    const stopped = 'UID PID PPID NAME\n0 1 0 init\n2000 200 1 sh';
    assertStorageProcessInventory(stopped, 20020074);
    assert.throws(() => assertStorageProcessInventory(stopped + '\n20020074 300 1 reader:background', 20020074), /writer process/);
    for (const invalid of ['', 'UID PID PPID NAME', 'Permission denied', stopped + '\ntruncated']) {
      assert.throws(() => assertStorageProcessInventory(invalid, 20020074), /inventory is unavailable/);
    }
    const prefix = 'data/storage/el2/base/haps/entry/files/reader-core/';
    const output = ['reader-core.sqlite3', 'reader-core.sqlite3-wal', 'reader-core.sqlite3-shm'].map(name =>
      `${'a'.repeat(64)}  ${prefix}${name}`).concat(['MISSING storage-meta.json', 'MISSING reader-core.sqlite3-journal']).join('\n');
    const observed = parseStorageFileObservation(output);
    assert.equal(observed[3].sha256, null, 'missing sidecar is preserved as missing, not an inferred generation');
    assertStorageFilesUnchanged(observed, parseStorageFileObservation(output));
    const missingWal = output.replace(`${'a'.repeat(64)}  ${prefix}reader-core.sqlite3-wal`, 'MISSING reader-core.sqlite3-wal');
    assert.throws(() => assertStorageFilesUnchanged(observed, parseStorageFileObservation(missingWal)), /changed after storage admission/);
    assert.throws(() => parseStorageFileObservation(output.split('\n').slice(0, 4).join('\n')), /incomplete/);
    assert.throws(() => parseStorageFileObservation(output.replace('MISSING reader-core.sqlite3-journal', `${'a'.repeat(64)}  ${prefix}reader-core.sqlite3-journal`)), /rollback journal/);
    assert.throws(() => parseStorageFileObservation(output.replace(prefix, 'unrelated/')), /invalid/);
    return;
  }
  if (id === 'snapshot-wal') {
    const { mkdtempSync, rmSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { execFileSync } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const { resolveHostTool } = await import('./lib/tool-environment.mjs');
    const python = resolveHostTool('python');
    const directory = mkdtempSync(join(tmpdir(), 'reader-storage-wal-'));
    try {
      execFileSync(python, ['-c', `import pathlib,sqlite3,shutil,sys
p=pathlib.Path(sys.argv[1]); live=p/'live.sqlite3'; raw=p/'raw'; raw.mkdir()
c=sqlite3.connect(live); c.execute('PRAGMA journal_mode=WAL'); c.execute('CREATE TABLE fact(value TEXT)'); c.commit(); c.execute('PRAGMA wal_checkpoint(TRUNCATE)'); c.execute("INSERT INTO fact VALUES ('committed-only-in-wal')"); c.commit()
for suffix in ('','-wal','-shm'): shutil.copyfile(str(live)+suffix,raw/('reader-core.sqlite3'+suffix))
c.close()`, directory]);
      const output = execFileSync(python, [fileURLToPath(new URL('../scripts/lib/storage-snapshot.py', import.meta.url)),
        join(directory, 'raw'), join(directory, 'analysis')], { encoding: 'utf8' });
      const receipt = JSON.parse(output);
      assert.equal(receipt.quickCheck, 'ok');
      assert.ok(receipt.rawFiles.find(file => file.name.endsWith('-wal')).bytes > 0);
      const values = execFileSync(python, ['-c', `import sqlite3,json,sys
c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); print(json.dumps(c.execute('SELECT value FROM fact').fetchall())); c.close()`,
        join(directory, 'analysis/admission/reader-core.sqlite3')], { encoding: 'utf8' });
      assert.deepEqual(JSON.parse(values), [['committed-only-in-wal']]);
      const { storageSha256 } = await import('../../Reader-Core/scripts/storage-build-contract.mjs');
      for (const record of receipt.rawFiles) assert.equal(storageSha256(readFileSync(join(directory, 'raw', record.name))), record.sha256);
    } finally { rmSync(directory, { recursive: true, force: true }); }
    return;
  }
  if (id === 'lease-session') {
    const { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { withHdcCommandSession, targetRef } = await import('./reader-hdc-lease.mjs');
    const directory = mkdtempSync(join(tmpdir(), 'reader-storage-lease-'));
    const prior = process.env.READER_HDC_LEASE_ROOT;
    process.env.READER_HDC_LEASE_ROOT = join(directory, 'locks');
    try {
      const fixture = join(directory, 'fixture.cjs'), executable = join(directory, 'fixture-hdc');
      writeFileSync(fixture, `process.stdout.write(JSON.stringify({argv:process.argv.slice(2),proxy:process.env.HTTP_PROXY??null,noProxy:process.env.NO_PROXY})+'\\n');`);
      const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
      writeFileSync(executable, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fixture)} "$@"\n`, { mode: 0o700 });
      const options = { hdc: executable, target: 'fixture-device', serverKey: '127.0.0.1:18710', waitMs: 0 };
      let retained;
      await withHdcCommandSession(options, async session => {
        retained = session;
        const lock = join(process.env.READER_HDC_LEASE_ROOT, `${targetRef(options.serverKey)}.lock`, 'owner.json');
        const token = JSON.parse(readFileSync(lock, 'utf8')).token;
        for (const command of [['shell', 'echo fixture'], ['list', 'targets', '-v']]) {
          const result = JSON.parse(session.runSync(command, { env: { ...process.env, HTTP_PROXY: 'http://invalid:9' } }).stdout);
          assert.equal(result.proxy, null); assert.equal(result.noProxy, '*');
          assert.equal(JSON.parse(readFileSync(lock, 'utf8')).token, token);
          assert.equal(result.argv[0], '-p');
        }
        assert.throws(() => session.runSync(['shell', 'echo fixture'], { timeoutMs: 30001 }), /budget/);
        await assert.rejects(withHdcCommandSession(options, () => {}), /lease wait timed out/);
      });
      assert.throws(() => retained.runSync(['list', 'targets']), /expired/);
      assert.equal(readdirSync(process.env.READER_HDC_LEASE_ROOT).some(name => name.endsWith('.lock')), false);
    } finally {
      if (prior === undefined) delete process.env.READER_HDC_LEASE_ROOT; else process.env.READER_HDC_LEASE_ROOT = prior;
      rmSync(directory, { recursive: true, force: true });
    }
    return;
  }
  const { createStorageBuildContract, verifyStorageBuildContract, storageSha256: sha } = await import('../../Reader-Core/scripts/storage-build-contract.mjs');
  const admission = await import('../scripts/lib/storage-deployment-admission.mjs');
  const contract = { format: 'reader.storage-contract', version: 1, productCompatibilityLine: '0.2',
    acceptedDirectoryPolicies: ['fixture-directory-policy-v1'],
    dataFormatGenerations: [1], normalOpen: { migrateExisting: false, acceptedLayouts: [44, 46] },
    layouts: [44, 46].map(schemaVersion => ({ schemaVersion, layoutId: `reader-layout-${schemaVersion}`,
      read: true, write: true, syncProtocolVersions: schemaVersion === 44 ? [] : [1],
      syncEpochOwner: schemaVersion === 44 ? 'none' : 'clock', syncLogReceipts: false })),
    migrations: { automaticExisting: false, targetSchemaVersion: 44, explicitLegacyRange: [0, 43], preserveLegacyFactsBefore: [8, 9] } };
  const contractSource = JSON.stringify(contract) + '\n';
  const identityBytes = Buffer.from(JSON.stringify({ buildId: sha('build') }));
  const nativeBytes = Buffer.from('actual-native-fixture');
  const snapshot = { fingerprint: sha('source'), files: [{ path: 'storage/storage-contract.v1.json', type: 'file', sha256: sha(contractSource) }] };
  const build = createStorageBuildContract({ contractSource, identityBytes, coreInputSnapshot: snapshot, nativeBytes });
  if (id === 'build-binding') {
    assert.equal(verifyStorageBuildContract(build).contract.layouts[1].schemaVersion, 46);
    assert.throws(() => createStorageBuildContract({ contractSource: contractSource + ' ', identityBytes, coreInputSnapshot: snapshot, nativeBytes }), /actual Core build inputs/);
    assert.throws(() => verifyStorageBuildContract(build, { nativeRecord: { sha256: sha('other'), bytes: nativeBytes.length } }), /Native bytes mismatch/);
    assert.throws(() => verifyStorageBuildContract({ ...build, contractSource: contractSource.replace('clock', 'state') }), /contract bytes/);
    assert.throws(() => verifyStorageBuildContract(build, { coreInputSnapshot: { ...snapshot, fingerprint: sha('stale') } }), /fingerprint mismatch/);
    const { mkdtempSync, rmSync, readFileSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { publishStorageDeliveryContract, verifyStorageDeliveryContract, storageBootstrapIdentityBytes,
      verifyStorageBootstrapIdentity, STORAGE_BOOTSTRAP_RESOURCE } = await import('../scripts/lib/storage-delivery-contract.mjs');
    const directory = mkdtempSync(join(tmpdir(), 'reader-storage-binding-'));
    try {
      const artifact = { kind: 'signed', sha256: sha('hap'), embeddedCoreNapi: { sha256: sha('stripped'), bytes: 8 } };
      const bootstrap = storageBootstrapIdentityBytes(build);
      verifyStorageBootstrapIdentity(bootstrap, build);
      assert.throws(() => verifyStorageBootstrapIdentity(storageBootstrapIdentityBytes({ ...build, coreBuildId: sha('other-build') }), build), /does not match/);
      artifact.requiredResources = [{ path: `resources/rawfile/${STORAGE_BOOTSTRAP_RESOURCE}`, bytes: bootstrap.length, sha256: sha(bootstrap) }];
      const native = { sha256: sha(nativeBytes), bytes: nativeBytes.length };
      const provenance = { storageBuildContract: build,
        core: { buildIdentity: JSON.parse(identityBytes), buildIdentityArtifact: { sha256: sha(identityBytes) }, buildInputFingerprint: snapshot.fingerprint },
        napi: { nativeInput: native }, hap: { sha256: artifact.sha256, embeddedNative: artifact.embeddedCoreNapi },
        harmony: { nativePackaging: { arguments: ['--strip-all'], output: artifact.embeddedCoreNapi } } };
      artifact.storageContract = publishStorageDeliveryContract(directory, artifact, provenance);
      assert.equal(verifyStorageDeliveryContract(directory, artifact, native).contractSha256, sha(contractSource));
      assert.throws(() => verifyStorageDeliveryContract(directory, { ...artifact, sha256: sha('replacement') }, native), /binding mismatch/);
      assert.throws(() => verifyStorageDeliveryContract(directory, artifact, { ...native, sha256: sha('different') }), /Native bytes mismatch/);
      assert.throws(() => verifyStorageDeliveryContract(directory, { ...artifact, requiredResources: [] }, native), /bootstrap resource/);
      const file = join(directory, artifact.storageContract.path);
      writeFileSync(file, readFileSync(file, 'utf8') + ' ');
      assert.throws(() => verifyStorageDeliveryContract(directory, artifact, native), /artifact changed/);
      assert.equal(verifyStorageDeliveryContract(directory, { kind: 'signed' }, native), null);
    } finally { rmSync(directory, { recursive: true, force: true }); }
    return;
  }
  const installed = { bundlePresent: true, appProvisionType: 'debug', appIdSha256: 'app', versionName: '0.2.0' };
  const artifact = { sha256: sha('hap'), embeddedCoreNapi: { sha256: sha('stripped') },
    signature: { status: 'signed', verified: true, profileType: 'debug', appIdSha256: 'app' } };
  const context = { mode: 'install', targetKind: 'vm', target: 'fixture-target', serverKey: '127.0.0.1:8710',
    bundleName: 'io.reader.minliny', bootIdSha256: sha('boot'), installed,
    installedIdentitySha256: admission.installedStorageIdentity(installed),
    candidate: { contract, hapSha256: artifact.sha256, nativeSha256: artifact.embeddedCoreNapi.sha256,
      contractSha256: build.contractSha256, coreBuildId: build.coreBuildId, coreInputFingerprint: build.coreInputFingerprint } };
  const facts = { binding: { target: context.target, serverKey: context.serverKey, bundleName: context.bundleName,
      bootIdSha256: context.bootIdSha256, installedIdentitySha256: context.installedIdentitySha256 },
    barrier: { kind: 'fixture-stopped-process', held: true, tokenSha256: sha('barrier') },
    snapshot: { manifestSha256: sha('snapshot'), databaseSha256: sha('db'), walSha256: sha('wal'), backupReceiptSha256: sha('backup') },
    layout: { schemaVersion: 46, layoutId: 'reader-layout-46', schemaFingerprint: sha('shape'), schemaCookie: 26,
      syncEpochOwner: 'clock', dataFormatGeneration: 1, syncProtocolVersion: 1, directoryPolicyId: 'fixture-directory-policy-v1' } };
  let releases = 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  const collector = () => ({ facts: clone(facts), recovery: { directory: '/private/fixture-recovery', snapshot: 'snapshot.json', backup: 'backup.json' }, revalidate: () => clone(facts), release: () => { releases++; },
    verifyInstalled: () => ({ nativeSha256: context.candidate.nativeSha256, hapSha256: context.candidate.hapSha256 }) });
  const route = { targetKind: 'vm', installed, artifact };
  if (id === 'legacy-admission') {
    facts.layout = null;
    facts.dataFormatGeneration = null;
    facts.requiresMigration = true;
    facts.explicitMigration = { sourceSchemaVersion: 38, targetSchemaVersion: 44 };
    for (const source of [0, 38, 43]) {
      facts.explicitMigration.sourceSchemaVersion = source;
      const session = admission.collectStorageAdmission(context, collector);
      assert.equal(session.storageLayout, null, 'migration target is never reported as an observed layout');
      assert.deepEqual(session.migration, { sourceSchemaVersion: source, targetSchemaVersion: 44 });
      assert.equal(admission.revalidateStorageAdmission(session).status, 'PASS');
      admission.releaseStorageAdmission(session);
    }
    for (const alter of [value => { value.explicitMigration.sourceSchemaVersion = -1; },
      value => { value.explicitMigration.sourceSchemaVersion = 44; },
      value => { value.explicitMigration.targetSchemaVersion = 45; },
      value => { value.explicitMigration = null; }, value => { value.requiresMigration = false; },
      value => { value.layout = { schemaVersion: 44 }; }, value => { value.dataFormatGeneration = 2; }]) {
      assert.throws(() => admission.collectStorageAdmission(context, () => { const owned = collector(); alter(owned.facts); return owned; }));
    }
    return;
  }
  if (id === 'signing-separation') {
    const { deploymentRoute, signingDeploymentRoute } = await import('../scripts/hap-pipeline.mjs');
    assert.equal(signingDeploymentRoute(route).allowed, true);
    assert.equal(deploymentRoute(route).allowed, false);
    assert.equal(deploymentRoute({ ...route, storageAdmission: { status: 'PASS', ...context.candidate } }).allowed, false);
    const session = admission.collectStorageAdmission(context, collector);
    assert.equal(deploymentRoute({ ...route, storageAdmission: session }).allowed, true);
    assert.equal(deploymentRoute({ ...route, artifact: { ...artifact, sha256: sha('other') }, storageAdmission: session }).allowed, false);
    admission.releaseStorageAdmission(session);
    assert.equal(deploymentRoute({ ...route, storageAdmission: session }).allowed, false);
    return;
  }
  assert.throws(() => admission.collectStorageAdmission({ ...context, candidate: null }, collector), /no verified storage/);
  for (const alter of [value => { value.layout.schemaVersion = 47; }, value => { value.layout.layoutId = 'unknown'; },
    value => { value.layout.syncEpochOwner = 'state'; }, value => { value.layout.syncProtocolVersion = 2; },
    value => { value.layout.syncProtocolVersions = [2]; }, value => { value.layout.dataFormatGeneration = 2; },
    value => { value.layout.directoryPolicyId = 'unknown-policy'; },
    value => { value.barrier.held = false; }, value => { delete value.snapshot.backupReceiptSha256; },
    value => { value.binding.bootIdSha256 = sha('new-boot'); }, value => { value.snapshot.walSha256 = undefined; }]) {
    assert.throws(() => admission.collectStorageAdmission(context, () => { const value = collector(); alter(value.facts); return value; }));
  }
  const observed = admission.collectStorageAdmission({ ...context, mode: 'inspect' }, collector);
  assert.equal(observed.status, 'OBSERVED');
  assert.equal(admission.storageAdmissionAllowed(observed, route), false);
  admission.releaseStorageAdmission(observed);
  const session = admission.collectStorageAdmission(context, collector);
  assert.equal(session.recovery.directory, '/private/fixture-recovery');
  assert.equal(Object.isFrozen(session.recovery), true);
  assert.equal(admission.storageAdmissionAllowed(session, route), true);
  assert.equal(admission.revalidateStorageAdmission(session).status, 'PASS');
  assert.equal(admission.recordInstalledStorageCandidate(session, installed).status, 'CANDIDATE_BOUND');
  assert.equal(admission.recordInstalledStorageCandidate(session, installed).actualNativeIdentity, 'OPEN');
  assert.throws(() => admission.revalidateStorageAdmission(session), /consumed/);
  admission.releaseStorageAdmission(session);
  const changed = admission.collectStorageAdmission(context, collector);
  facts.snapshot.walSha256 = sha('new-wal');
  assert.throws(() => admission.revalidateStorageAdmission(changed), /changed after admission/);
  admission.releaseStorageAdmission(changed);
  assert.ok(releases >= 10, 'all rejected and completed collectors release their owned barrier');
}
