import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  'storage-format-dto': { description: 'Actual Host decoder with current Core producer/source-schema DTO and malformed/contradictory operation facts; no Rust/Native execution', resources: [] },
  'legacy-snapshot-barrier': { description: 'Actual startup methods preserve old Host snapshot/marker for Library47 and unknown operation support; fake platform/background ports only', resources: [] },
  'sdk-type-resolution': { description: 'Actual installed ArkTS OHPM resolver/type checker resolves SDK subpath types and rejects old root imports; no full app build claim', resources: [] },
};
for (const id of selectContractCases(CONTRACT_CASES)) {
  if (id === 'storage-format-dto') await storageFormatDto();
  else if (id === 'legacy-snapshot-barrier') await legacySnapshotBarrier();
  else await sdkTypeResolution();
  recordContractCasePass(id);
}

async function sdkTypeResolution() {
  const { default: assert } = await import('node:assert/strict');
  const { mkdtempSync, mkdirSync, symlinkSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ts } = installedEtsCompiler();
  const directory = mkdtempSync(join(tmpdir(), 'reader-storage-sdk-types-'));
  const scope = join(directory, 'entry/oh_modules/@reader'); mkdirSync(scope, { recursive: true });
  const vendor = fileURLToPath(new URL('../entry/vendor/core-harmony', import.meta.url));
  symlinkSync(vendor, join(scope, 'core-harmony'), 'dir');
  const file = join(directory, 'entry/src/main/ets/app/StorageTypeImportCheck.ts');
  const options = { noEmit: true, skipLibCheck: true, types: [],
    moduleResolution: ts.ModuleResolutionKind.NodeJs, packageManagerType: 'ohpm',
    target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.ESNext };
  const module = '@reader/core-harmony/sdk/reader_core';
  const host = ts.createCompilerHost(options);
  const resolved = ts.resolveModuleName(module, file, options, host).resolvedModule;
  assert.equal(resolve(resolved?.resolvedFileName ?? ''), resolve(vendor, 'sdk/reader_core.ts'),
    'the actual OHPM resolver reaches the existing SDK file through an oh_modules package link');
  const ownerSource = readFileSync(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url), 'utf8');
  const ownerTree = ts.createSourceFile('ReaderRuntimeOwner.ts', ownerSource, ts.ScriptTarget.Latest, true);
  const actualImport = ownerTree.statements.find(node => ts.isImportDeclaration(node) &&
    node.moduleSpecifier.text === module && node.importClause?.isTypeOnly);
  assert.ok(actualImport, 'the actual Host uses the SDK type subpath');
  const declarations = actualImport.getText(ownerTree);
  const check = (specifier, assignment = 'fact') => {
    const source = declarations.replace(module, specifier) + '\n' +
      'declare const fact: CoreStorageFormatInfo;\n' +
      'declare const capabilities: CoreStorageCapabilities;\n' +
      'const admitted: CoreStorageFormatInfo = ' + assignment + ';\n' +
      'const matrix: CoreStorageCapabilities | undefined = admitted.capabilities;\n' +
      'const importAllowed: boolean = capabilities.legacyHostImport;\n';
    const compilerHost = ts.createCompilerHost(options), get = compilerHost.getSourceFile.bind(compilerHost);
    compilerHost.getSourceFile = (name, ...args) => name === file ?
      ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true) : get(name, ...args);
    const program = ts.createProgram([file], options, compilerHost);
    const consumer = program.getSourceFile(file); assert.ok(consumer);
    return program.getSemanticDiagnostics(consumer).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
  };
  assert.deepEqual(check(module), [], 'the actual imported declarations resolve and type-check against the existing SDK');
  const wrongRoot = check('@reader/core-harmony');
  assert.equal(wrongRoot.filter(diagnostic => diagnostic.code === 2305).length, 2,
    'negative control reproduces both former missing package-root exports behind10505001');
  assert.ok(check(module, "{ format: 'library47', portableSnapshotSupported: 'yes' }").length > 0,
    'the resolved SDK type rejects a wrong wire-field type rather than silently becoming any');
  // The new private fixture is retained under /tmp; it contains only a package
  // symlink, no credentials, copied SDK or production edits. This narrow check
  // proves module/type binding, not full Host ArkTS semantics or a passing HAP.
}

async function fixtureTypes(withStartup = false) {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const methods = ['requireCoreStorageFormat', 'requireCoreStorageCapabilities'];
  if (withStartup) methods.push('startRuntime', 'supportsCoreCapability', 'legacySnapshotMigrationRecovery', 'requireSourceSwitchRecoveryCount');
  let active;
  const Type = selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
    'ReaderRuntimeOwner', methods, {
      ReaderStartupTrace: { measure: (_name, run) => run(), current: () => undefined },
      createReaderCoreRuntimeAsync: async (_config, current) => {
        if (!current()) throw new Error('retired startup');
        return active;
      },
      ReadingBodyImageHost: { instance: { setMangaMetadataInspector() {} } },
      MangaImageMetadataHost: { instance: {} },
      hilog: { info() {}, warn() {}, error() {} }, LOG_DOMAIN: 0x5244,
    });
  return { Type, setRuntime: value => { active = value; } };
}

// A finite fixture reads the current Rust producer's declared bool constants
// and serde wire names. It does not execute Rust or simulate storage admission.
// Existing same-input formal-FFI evidence remains a separate evidence layer.
async function currentCoreFormat(format = 'library47') {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../../Reader-Core/crates/reader-storage/src/sqlite_backend/compatibility.rs', import.meta.url), 'utf8');
  const schema = JSON.parse(readFileSync(new URL('../../Reader-Core/protocol/reader-event.schema.json', import.meta.url), 'utf8'));
  const definition = /CoreStorageCapabilities\s*\{([^}]+)\}/.exec(source)?.[1];
  assert.ok(definition, 'the actual producer declares a finite capability matrix');
  const capabilities = {};
  for (const declaration of definition.split(',').map(text => text.trim()).filter(Boolean)) {
    const match = /^([a-z_]+)\s*:\s*(true|false|physical)$/.exec(declaration);
    assert.ok(match, 'producer fixture supports declared bool constants, not arbitrary Rust evaluation');
    const key = match[1].replace(/_([a-z])/g, (_text, character) => character.toUpperCase());
    assert.equal(Object.hasOwn(capabilities, key), false);
    capabilities[key] = match[2] === 'physical' ? format === 'library47' : match[2] === 'true';
  }
  const required = schema.$defs.CoreStorageCapabilities.required;
  assert.deepEqual(Object.keys(capabilities).sort(), [...required].sort(), 'the source-derived wire matrix matches the current protocol schema');
  assert.equal(schema.$defs.CoreStorageCapabilities.additionalProperties, false);
  return { format, portableSnapshotSupported: capabilities.logicalExport && capabilities.logicalRestore && capabilities.legacyHostImport, capabilities };
}

async function storageFormatDto() {
  const { default: assert } = await import('node:assert/strict');
  const { Type } = await fixtureTypes();
  const owner = new Type();
  for (const format of ['library47', 'legacy']) {
    const current = await currentCoreFormat(format);
    assert.equal(current.portableSnapshotSupported, true, 'the current producer grants the logical operation set');
    assert.deepEqual(owner.requireCoreStorageFormat(current), current, 'current Core wire facts are admitted independently of storage format name');
    assert.equal(current.capabilities.physicalBackup, format === 'library47');
  }
  assert.equal(owner.requireCoreStorageFormat(undefined), undefined);
  for (const format of ['legacy', 'library47']) for (const portableSnapshotSupported of [true, false]) {
    assert.deepEqual(owner.requireCoreStorageFormat({ format, portableSnapshotSupported }), { format, portableSnapshotSupported },
      'old matrix-free declarations remain readable without inventing operation grants');
  }
  const current = await currentCoreFormat();
  const rejected = [null, [], {}, { ...current, format: 'unknown' }, { ...current, portableSnapshotSupported: 'true' },
    { ...current, portableSnapshotSupported: false }, { ...current, capabilities: null }, { ...current, capabilities: [] },
    { ...current, capabilities: {} }, { ...current, inventedPermission: true },
    { ...current, capabilities: { ...current.capabilities, inventedPermission: true } },
    { ...current, format: 'legacy' }];
  for (const key of Object.keys(current.capabilities)) {
    const missing = structuredClone(current); delete missing.capabilities[key]; rejected.push(missing);
    const wrongType = structuredClone(current); wrongType.capabilities[key] = 'true'; rejected.push(wrongType);
  }
  for (const key of ['activeLibrarySync', 'logicalExportRequiresDataPreflight', 'logicalRestoreRequiresCompleteCoverage', 'resourceEvidenceOnly', 'externalFilesIncluded']) {
    const unsupported = structuredClone(current); unsupported.capabilities[key] = !unsupported.capabilities[key]; rejected.push(unsupported);
  }
  for (const value of rejected) assert.throws(() => owner.requireCoreStorageFormat(value), /invalid storage format capability/);
}

async function legacySnapshotBarrier() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { Type, setRuntime } = await fixtureTypes(true);
  async function startup(storageFormat, pending = true, failRestore = false, retireOnRecovery = false) {
    const events = [];
    let owner;
    const runtime = { assetBridge: () => ({}), setCapabilityRouter() {}, close() { events.push('runtime.close'); },
      async request(method) {
        events.push(method);
        assert.equal(owner.runtime, undefined, 'startup never exposes a tentative runtime');
        if (method === 'core.info') return { data: { buildIdentity: {}, capabilities: [], storageFormat } };
        if (method === 'runtime.storage.restore' && failRestore) throw new Error('original restore failed');
        if (method === 'source.switch.recover' && retireOnRecovery) owner.state = 'closing';
        return { data: { recovered: [] } };
      } };
    owner = Object.assign(new Type(), { state: 'starting', coreCapabilities: new Set(), legacySnapshotRecovery: 'none',
      host: { getContext: () => ({ filesDir: '/fixture/app' }), setResponseAssetBridge() {}, createCapabilityRouter: () => ({}),
        async needsLegacySnapshotMigration() { events.push('marker.read'); return pending; },
        async markLegacySnapshotMigrated() { events.push('marker.write'); } },
      requireCoreBuildIdentity: value => value,
      getReadingRecordGateway: () => ({ recover: async () => {} }), recoverReadingProgressInBackground() {},
      getDownloadStorageGateway: () => ({ restoreLegacyProtection: async () => {}, maintainAutomaticStorage: async () => {} }),
      getDownloadCoordinator: () => ({ restore: async () => {} }), scheduleImportFinalizeCleanup() {},
      installBundledBookSourceCollection: async () => ({ collectionRecords: 0, uniqueSourceIds: 0, processed: 0, installedOrUpgraded: 0, failed: 0, interrupted: false }),
    });
    setRuntime(runtime);
    let error;
    try { await owner.startRuntime(); await owner.sourceSupplyTask; } catch (failure) { error = failure; }
    assert.ok(events.every(method => ['marker.read', 'runtime.setHostCapabilities', 'core.info', 'runtime.storage.restore',
      'marker.write', 'source.switch.recover', 'runtime.close'].includes(method)), 'no original intent/snapshot payload I/O enters this Host composition');
    return { owner, runtime, events, error };
  }

  const library = await currentCoreFormat();
  let result = await startup(library);
  assert.equal(result.error, undefined); assert.equal(result.owner.state, 'ready'); assert.equal(result.owner.runtime, result.runtime);
  assert.equal(result.owner.legacySnapshotMigrationRecovery(), 'automaticImportDeferred');
  assert.ok(!result.events.includes('runtime.storage.restore') && !result.events.includes('marker.write'),
    'Library47 logical/legacy import support does not authorize automatic replay of an old Host snapshot');
  assert.ok(result.events.includes('source.switch.recover'), 'ordinary startup recovery still precedes publication');
  for (const fact of [undefined, { format: 'legacy', portableSnapshotSupported: true }, { format: 'library47', portableSnapshotSupported: true }]) {
    result = await startup(fact);
    assert.equal(result.error, undefined); assert.equal(result.owner.state, 'ready');
    assert.equal(result.owner.legacySnapshotMigrationRecovery(), 'storageCapabilityUnavailable');
    assert.ok(!result.events.includes('runtime.storage.restore') && !result.events.includes('marker.write'), 'missing operation matrix never authorizes a restore');
  }
  const legacy = await currentCoreFormat('legacy');
  result = await startup(legacy);
  assert.equal(result.error, undefined); assert.equal(result.owner.state, 'ready');
  assert.ok(result.events.indexOf('core.info') < result.events.indexOf('runtime.storage.restore'));
  assert.ok(result.events.indexOf('runtime.storage.restore') < result.events.indexOf('marker.write'));
  assert.ok(result.events.indexOf('marker.write') < result.events.indexOf('source.switch.recover'));
  const denied = structuredClone(legacy); denied.capabilities.legacyHostImport = false; denied.portableSnapshotSupported = false;
  result = await startup(denied);
  assert.equal(result.error, undefined); assert.equal(result.owner.legacySnapshotMigrationRecovery(), 'unsupportedStorageFormat');
  assert.ok(!result.events.includes('runtime.storage.restore') && !result.events.includes('marker.write'));
  const importOnly = structuredClone(legacy); importOnly.capabilities.logicalExport = false; importOnly.portableSnapshotSupported = false;
  result = await startup(importOnly);
  assert.equal(result.error, undefined); assert.ok(result.events.includes('runtime.storage.restore'), 'legacy migration uses its exact operation fact rather than an unrelated export summary');
  result = await startup(legacy, true, true);
  assert.match(result.error?.message ?? '', /original restore failed/); assert.equal(result.owner.runtime, undefined);
  assert.ok(!result.events.includes('marker.write')); assert.ok(result.events.includes('runtime.close'));
  result = await startup(library, false);
  assert.equal(result.error, undefined); assert.equal(result.owner.legacySnapshotMigrationRecovery(), 'none');
  result = await startup({ ...library, portableSnapshotSupported: false });
  assert.match(result.error?.message ?? '', /invalid storage format capability/); assert.equal(result.owner.runtime, undefined);
  assert.ok(!result.events.includes('source.switch.recover') && !result.events.includes('marker.write')); assert.ok(result.events.includes('runtime.close'));
  result = await startup(library, true, false, true);
  assert.match(result.error?.message ?? '', /closed during startup/); assert.equal(result.owner.runtime, undefined);
  assert.ok(!result.events.includes('runtime.storage.restore') && !result.events.includes('marker.write')); assert.ok(result.events.includes('runtime.close'));

  const { ts } = installedEtsCompiler();
  const emitted = ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/app/ReaderRecoveryProjection.ts', import.meta.url), 'utf8'), {
    reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
  });
  assert.deepEqual(emitted.diagnostics, []);
  const projection = {}; new Function('exports', emitted.outputText)(projection);
  const view = projection.readerLegacySnapshotRecoveryView('automaticImportDeferred');
  assert.equal(view.visible, true); assert.equal(view.canRetry, false);
  assert.match(view.message, /已保留/); assert.match(view.message, /不会自动导入/);
  assert.ok(!view.message.includes('不支持完整快照恢复'), 'a valid supported format is not mislabeled unsupported');
}
