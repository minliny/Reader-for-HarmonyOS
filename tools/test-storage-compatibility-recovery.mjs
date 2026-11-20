import assert from 'node:assert/strict';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'runtime-gateway-reuse': 'Actual static forRuntime owner cache and active admission: reopening the presentation shares the in-flight original gateway; another Runtime receives another owner.',
  'cas-recovery-only-admission': 'Actual CAS Gateway opens existing v1 journal on CAS-only and log-capable ports without changing protocol or making network calls; prepare and presentation retirement preserve original.',
  'cas-original-commit-handoff': 'Actual Runtime CAS strong-revision identity, single commit, exact lost-ACK receipt and fake drain ordering use the same production retirement owner.',
  'recovery-only-admission': 'Actual Gateway open/prepare/retire methods: original local journal only, no automatic storage/network or new operation; dismissal preserves journal.',
  'registry-physical-drain': 'Actual Registry marker methods with fake AtomicFile completion: finish callback precedes drain; new writes reject after seal.',
  'original-commit-handoff': 'Actual Runtime original log commit methods: fake drain completion before dispatch, lost ACK resolved by exact receipt, invalid identity rejects and failed drain retains pending without commit.',
  'bootstrap-identity': 'Actual Host bootstrap comparison rejects mismatched build/contract/input and accepts only the candidate-bound identity resource.',
};
const ownerFile = 'entry/src/main/ets/app/ReaderRuntimeOwner.ts';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
for (const id of selectContractCases(cases)) {
  if (id === 'recovery-only-admission') {
    const events = [], original = { version: 2, operationId: `library-sync-${'a'.repeat(32)}`, phase: 'mayPublish', channelHash: 'b'.repeat(64) };
    let live = true;
    const Gateway = selectedProductionMethods('entry/src/main/ets/features/sync/ReaderLibraryLogSyncGateway.ts', 'ReaderLibraryLogSyncGateway',
      ['current', 'admitted', 'publish', 'canPrepare', 'prepare', 'open', 'retire'], {
        ReaderRuntimeOwner: { isCurrent: () => live }, empty: () => ({ status: 'idle', supported: false, conflicts: [], reviewRevision: 0 }),
      });
    const gateway = new Gateway();
    Object.assign(gateway, { state: {}, listeners: [], active: false, generation: 0, password: 'private-fixture',
      owner: { canConfigureBackupStorage: () => live, canRecoverLibraryRestoreFailure: () => false,
        async request(method) { events.push(method); return { data: { protocolVersion: 2, metadata: true, durable: true, immutableLog: true } }; } },
      journal: { async load() { events.push('journal.load'); return original; }, async clear() { throw Error('must retain original'); } },
      storage: { async open() { throw Error('open must not access storage/network'); } },
      async failed(error) { throw error; },
    });
    assert.equal(gateway.canPrepare(), false);
    await gateway.prepare('fixture-password', () => true);
    assert.deepEqual(events, []);
    await gateway.open(() => true);
    assert.deepEqual(events, ['library.sync.log.capabilities', 'journal.load']);
    assert.equal(gateway.state.operationId, original.operationId);
    assert.equal(gateway.state.status, 'pending');
    gateway.retire(); assert.equal(gateway.password, ''); assert.equal(original.phase, 'mayPublish');
    live = false; await gateway.open(() => true); assert.equal(events.length, 2);
  }
  if (id === 'runtime-gateway-reuse') {
    const ready = deferred(), original = { operationId: `library-sync-${'a'.repeat(32)}`, phase: 'mayPublish' };
    let calls = 0;
    const Gateway = selectedProductionMethods('entry/src/main/ets/features/sync/ReaderLibrarySyncGateway.ts', 'ReaderLibrarySyncGateway',
      ['retained', 'forRuntime', 'current', 'admitted', 'requireCurrent', 'publish', 'supportsLog', 'capability', 'open', 'retire'], {
        ReaderRuntimeOwner: { isCurrent: () => true }, emptySnapshot: () => ({ status: 'idle', supported: false, conflicts: [], reviewRevision: 0 }),
      });
    const owner = { canConfigureBackupStorage: () => true, canRecoverLibraryRestoreFailure: () => false, supportsCoreCapability: () => false,
      async request() { calls++; await ready.promise; return { data: { protocolVersion: 1, metadata: true, durable: true } }; } };
    const first = Gateway.forRuntime(owner);
    Object.assign(first, { owner, state: {}, listeners: [], active: false, logMode: false, generation: 0,
      journal: { async load() { return original; }, async clear() { throw Error('presentation close must not clear original'); } } });
    const originalOpen = first.open(() => true);
    first.retire();
    const reopened = Gateway.forRuntime(owner);assert.equal(reopened, first);
    await reopened.open(() => true);assert.equal(calls, 1, 'reopen shares actual active guard before any first await');
    assert.notEqual(Gateway.forRuntime({}), first, 'successor Runtime never inherits the retired gateway');
    ready.resolve();await originalOpen;assert.equal(first.state.operationId, original.operationId);
  }
  if (id === 'cas-recovery-only-admission') {
    for (const logCapable of [false, true]) {
      const events = [], original = { version: 1, operationId: `library-sync-${'a'.repeat(32)}`, phase: 'mayPublish' };
      let live = true;
      const Gateway = selectedProductionMethods('entry/src/main/ets/features/sync/ReaderLibrarySyncGateway.ts', 'ReaderLibrarySyncGateway',
        ['current', 'admitted', 'requireCurrent', 'publish', 'supportsLog', 'capability', 'canPrepare', 'prepare', 'open', 'retire'], {
          ReaderRuntimeOwner: { isCurrent: () => live }, emptySnapshot: () => ({ status: 'idle', supported: false, conflicts: [], reviewRevision: 0 }),
        });
      const gateway = new Gateway();
      Object.assign(gateway, { logMode: false, state: {}, listeners: [], active: false, generation: 0, reviewPassword: 'private-fixture',
        owner: { canConfigureBackupStorage: () => live, canRecoverLibraryRestoreFailure: () => false, supportsCoreCapability: () => logCapable,
          async request(method) { events.push(method); assert.equal(method, 'library.sync.capabilities'); return { data: { protocolVersion: 1, metadata: true, durable: true } }; } },
        journal: { async load() { events.push('journal.load'); return original; }, async clear() { throw Error('must retain original CAS'); } },
        storage: { async open() { throw Error('dialog open must not access remote storage'); } },
      });
      assert.equal(gateway.canPrepare(), false); await gateway.prepare('fixture', () => true); assert.deepEqual(events, []);
      await gateway.open(() => true); assert.equal(gateway.logMode, false); assert.equal(gateway.state.operationId, original.operationId);
      assert.equal(gateway.state.status, 'pending'); assert.equal(events.filter(v => v === 'library.sync.capabilities').length, 1);
      gateway.retire(); assert.equal(gateway.reviewPassword, ''); assert.equal(original.phase, 'mayPublish');
      const count=events.length;live=false;await gateway.open(() => true);assert.equal(events.length,count);
    }
  }
  if (id === 'registry-physical-drain') {
    const writing = deferred(), finishing = deferred(), events = [];
    class AtomicFile {
      startWrite() { return { on() {}, end(_value, _encoding, done) { events.push('write-start'); writing.resolve(); finishing.promise.then(done); } }; }
      finishWrite() { events.push('write-finally'); }
      failWrite() { events.push('write-failed'); }
    }
    const Registry = selectedProductionMethods('entry/src/main/ets/app/ReaderHostRegistry.ts', 'ReaderHostRegistry',
      ['quiesceForLibraryRestore', 'assertLibraryFileIoOpen', 'knownRetiredFileOperation', 'recordLibraryFileFailure',
        'trackLibraryFileOperation', 'drainLibraryFileOperations', 'markLegacySnapshotMigrated'], { fileIo: { AtomicFile } });
    const registry = new Registry();
    Object.assign(registry, { libraryRestoreQuiescing: false, activeLibraryFileOperations: new Set(),
      writeTail: Promise.resolve(), pendingFinalizeWriteTail: Promise.resolve(), async ensureDirectory() {},
      snapshotDirectory: () => '/fixture', snapshotMigrationMarkerPath: () => '/fixture/marker' });
    const original = registry.markLegacySnapshotMigrated(); await writing.promise;
    let drained = false; const drain = registry.quiesceForLibraryRestore().then(() => { drained = true; events.push('drained'); });
    await turn(); assert.equal(drained, false);
    await assert.rejects(registry.markLegacySnapshotMigrated(), /QUIESCED/);
    finishing.resolve(); await original; await drain;
    assert.deepEqual(events, ['write-start', 'write-finally', 'drained']);
  }
  if (id === 'original-commit-handoff' || id === 'cas-original-commit-handoff') {
    const immutable = id === 'original-commit-handoff';
    const events = []; let fact = 'missing';
    class Journal {
      async prepare(identity) { this.identity = identity; events.push('journal-prepared'); }
      async markMayApply() { events.push('journal-may-apply'); }
      async markCoreCommitted(value) { assert.equal(value.status, 'committedCurrent'); events.push('journal-committed'); }
    }
    const Owner = selectedProductionMethods(ownerFile, 'ReaderRuntimeOwner', [
      'isCurrent', 'supportsCoreCapability', 'canConfigureBackupStorage', 'canCommitOriginalLibrarySync',
      'applyLibraryLogSyncCommit', 'applyLibrarySyncCommit', 'applyLibrarySyncCommitOwned', 'decodeLibraryRestoreCoreFact',
      'registerLibraryRestoreHandoff', 'performLibraryRestoreHandoff', 'canRecoverLibraryRestoreFailure', 'retireRuntimeDomains',
      'pendingLibraryRestoreStartupFact', 'acknowledgeLibraryRestoreStartupFact',
    ], { ReaderLibraryRestoreJournal: Journal, ReaderThemeHost: { async prepareUserChange() {}, async sealForLibraryRestore() { events.push('settings-sealed'); } },
      MangaChapterPreparationCoordinator: { forRuntime: () => ({ async close() {} }) },
      ReadingBodyImageHost: { instance: { setMangaMetadataInspector() {} } },
    });
    const op = `library-sync-${'a'.repeat(32)}`, hash = 'b'.repeat(64), token = 'c'.repeat(64);
    const proof = { kind: 'immutableReadbackV2', objectId: `reader-sync-log-v2-${'d'.repeat(64)}-${'a'.repeat(32)}-${hash}.reader`, sha256: hash, bytes: 48 };
    function fixture(drain) {
      const owner = new Owner();
      Object.assign(owner, { state: 'ready', abilityLeases: 1, preparationWakeTimer: -1,
        coreCapabilities: new Set(['library.metadataRestore.status.v1', immutable ? 'library.sync.log.v2' : 'library.sync.v1']),
        host: { getContext: () => ({ filesDir: '/fixture' }) },
        runtime: { async request(method, params) {
          if (method === 'library.package.restore.status') { events.push('status'); return { data: { operationId: params.operationId, packageSha256: params.packageSha256, status: fact } }; }
          assert.equal(method, immutable ? 'library.sync.log.commit' : 'library.sync.commit');
          if (!immutable) assert.equal(params.remoteRevision, '"original-strong-etag"'); events.push('commit'); fact = 'committedCurrent'; throw Error('lost dispatch ACK');
        } },
        readingImageDiskCache: { close() { events.push('cache-close'); } }, ttsHost: { async close() {} },
        async requireLibraryRestoreHostSettings() { events.push('settings-drained'); },
        async quiesceHostFilesForLibraryRestore() { events.push('files-sealed'); await drain; events.push('files-drained'); },
        async closeRuntime() { this.state = 'closed'; Owner.instance = undefined; events.push('runtime-closed'); },
      });
      Owner.instance = owner;
      owner.registerLibraryRestoreHandoff(async () => { events.push('handoff'); });
      return owner;
    }
    const apply = owner => immutable ? owner.applyLibraryLogSyncCommit(op, token, proof, hash) :
      owner.applyLibrarySyncCommit(op, token, '"original-strong-etag"', hash);
    const gate = deferred(), owner = fixture(gate.promise);
    const operation = apply(owner);
    await turn(); assert.equal(events.includes('commit'), false); assert.equal(owner.canConfigureBackupStorage(), false);
    gate.resolve(); const result = await operation;
    assert.equal(result.status, 'committed'); assert.equal(result.restartRequired, false);
    assert.equal(events.filter(x => x === 'commit').length, 1); assert.equal(events.filter(x => x === 'status').length, 2);
    assert.ok(events.indexOf('files-drained') < events.indexOf('commit'));
    assert.ok(events.indexOf('journal-committed') < events.indexOf('runtime-closed'));
    assert.ok(events.indexOf('runtime-closed') < events.indexOf('handoff'));
    events.length = 0; fact = 'missing';
    const invalid = fixture(Promise.resolve());
    await assert.rejects(immutable ? invalid.applyLibraryLogSyncCommit(op, token, { ...proof, sha256: 'e'.repeat(64) }, hash) :
      invalid.applyLibrarySyncCommit(op, token, 'W/"weak-etag"', hash), /IDENTITY_INVALID/);
    assert.equal(events.includes('journal-prepared'), false);
    events.length = 0;
    const failure = deferred(), denied = fixture(failure.promise);
    const refused = apply(denied); await turn(); failure.reject(Error('physical close failed'));
    assert.equal((await refused).status, 'pending'); assert.equal(events.includes('commit'), false);
    const held = { operationId: op, packageSha256: hash, status: 'missing' }, successor = fixture(Promise.resolve());
    successor.libraryRestoreStartupFact = held;
    assert.equal(successor.pendingLibraryRestoreStartupFact(), held);
  }
  if (id === 'bootstrap-identity') {
    const resource = { format: 'reader.storage-bootstrap-identity', version: 1, buildId: 'a'.repeat(64), contractSha256: 'b'.repeat(64), coreInputFingerprint: 'c'.repeat(64) }, receipts = [];
    const Owner = selectedProductionMethods(ownerFile, 'ReaderRuntimeOwner', ['requireStorageProbeIdentity'], {
      hilog: { info(_domain, _tag, _message, receipt) { receipts.push(JSON.parse(receipt)); } }, LOG_DOMAIN: 0x5244,
      ReaderStartupTrace: { current: () => undefined },
    });
    const owner = new Owner(); owner.host = { async readBundledRawFileText(name) { assert.equal(name, 'reader-core-storage-identity.v1.json'); return JSON.stringify(resource); } };
    const probe = { buildIdentity: { buildId: resource.buildId }, contractSha256: resource.contractSha256, coreInputFingerprint: resource.coreInputFingerprint };
    await owner.requireStorageProbeIdentity(probe, () => true); assert.equal(receipts.length, 1);
    for (const key of ['contractSha256', 'coreInputFingerprint']) await assert.rejects(owner.requireStorageProbeIdentity({ ...probe, [key]: 'd'.repeat(64) }, () => true), /MISMATCH/);
    await assert.rejects(owner.requireStorageProbeIdentity({ ...probe, buildIdentity: { buildId: 'e'.repeat(64) } }, () => true), /MISMATCH/);
    await assert.rejects(owner.requireStorageProbeIdentity(probe, () => false), /RETIRED/);
    assert.equal(receipts.length, 1);
  }
  recordContractCasePass(id);
}
