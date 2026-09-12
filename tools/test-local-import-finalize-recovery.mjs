import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const gateway = read('entry/src/main/ets/features/bookshelf/LocalBookImportGateway.ts');

// Static contract: the cleanup token is app-private, bounded, atomically
// replaced, and drained before a runtime is published. These checks do not
// claim VM/device behavior; they fence regressions in the production source.
assert.match(host, /pending-finalize-v1\.json/);
assert.match(host, /PendingLocalImportFinalizeMaxEntries = 8/);
assert.match(host, /PendingLocalImportFinalizeMaxTokenBytes = 256 \* 1024/);
assert.match(host, /PendingLocalImportFinalizeMaxFileBytes = 2 \* 1024 \* 1024/);
assert.match(host, /new fileIo\.AtomicFile\(this\.pendingLocalImportFinalizePath\(\)\)/);
assert.match(host, /JSON\.parse\(raw\)[\s\S]*decodePendingLocalImportFinalizeDocument/);
assert.match(host, /rollbackToken: value as JsonObject/);
assert.match(owner, /await this\.recoverPendingLocalImportFinalizes\(runtime\)/);
assert.match(owner, /removePendingLocalImportFinalize\(entry\.transactionId\)/);
assert.match(owner, /isAlreadyFinalizedLocalImportError\(error\)/);
assert.match(owner, /Pending local import finalize recovery: queued=/);
assert.match(gateway, /enqueuePendingLocalImportFinalize\(rollbackToken\)/);
assert.doesNotMatch(gateway, /lastError\?\.message/);

// Execute the real gateway method with a deterministic failing Core request.
// It must retry exactly three times, enqueue the same opaque token, and never
// interpolate token contents into a log argument.
function method(source, name) {
  const start = source.indexOf(`  private ${name}`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}
const finalizeMethod = method(gateway, 'async finalizeCommittedImport(');
const logCalls = [];
const queued = [];
let attempts = 0;
const FinalizeProbe = new Function(
  'hilog',
  'DOMAIN',
  `${stripTypeScriptTypes(`class FinalizeProbe { ${finalizeMethod} }`)};return FinalizeProbe;`,
)({
  warn(...args) { logCalls.push(args); },
  error(...args) { logCalls.push(args); },
}, 0x5244);
const token = {
  kind: 'localBook',
  token: { transactionId: 'local-import-test', journal: { storedLocalBookJournal: 'opaque-ref' } },
};
const probe = new FinalizeProbe();
Object.assign(probe, {
  runtimeOwner: {
    async request() {
      attempts += 1;
      throw new Error('synthetic transport failure');
    },
    async enqueuePendingLocalImportFinalize(value) {
      queued.push(value);
    },
  },
});
assert.equal(await probe.finalizeCommittedImport(token), false);
assert.equal(attempts, 3);
assert.deepEqual(queued, [token]);
assert.equal(logCalls.some((args) => args.some((value) => String(value).includes('opaque-ref'))), false,
  'finalize recovery logs must not contain opaque token data');

// Execute the production queue envelope validators in isolation. This keeps
// the checks runnable on Node while using the exact source methods; Harmony's
// TextEncoder API returns a byte array from encodeInto(value), so the shim
// mirrors that API for the test.
function extractMethod(source, signature) {
  const start = source.indexOf(`  private ${signature}`);
  assert.ok(start >= 0, signature);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}
const validatorMethods = [
  extractMethod(host, 'decodePendingLocalImportFinalizeDocument(value: unknown)'),
  extractMethod(host, 'decodePendingLocalImportFinalizeToken(value: unknown)'),
  extractMethod(host, 'requirePendingFinalizeTransactionId(value: unknown)'),
  extractMethod(host, 'isJsonObject(value: unknown)'),
].join('\n');
const Validator = new Function(
  'util',
  `${stripTypeScriptTypes(`class ReaderHostRegistry {
    static PendingLocalImportFinalizeFormatVersion = 1;
    static PendingLocalImportFinalizeMaxEntries = 8;
    static PendingLocalImportFinalizeMaxTokenBytes = 256 * 1024;
    ${validatorMethods}
  }`)};return ReaderHostRegistry;`,
)({
  TextEncoder: class {
    encodeInto(value) { return new TextEncoder().encode(value); }
  },
});
const validator = new Validator();
const validToken = {
  kind: 'localBook',
  token: { transactionId: 'tx-1', journal: { storedLocalBookJournal: 'opaque' } },
};
assert.deepEqual(validator.decodePendingLocalImportFinalizeDocument({
  formatVersion: 1,
  entries: [{ transactionId: 'tx-1', rollbackToken: validToken }],
}), [{ transactionId: 'tx-1', rollbackToken: validToken }]);
assert.throws(() => validator.decodePendingLocalImportFinalizeToken({
  kind: 'bookSource',
  token: validToken.token,
}), /kind is invalid/);
assert.throws(() => validator.decodePendingLocalImportFinalizeDocument({
  formatVersion: 1,
  entries: [
    { transactionId: 'tx-1', rollbackToken: validToken },
    { transactionId: 'tx-1', rollbackToken: validToken },
  ],
}), /identity is invalid/);
assert.throws(() => validator.decodePendingLocalImportFinalizeToken({
  kind: 'localBook',
  token: { transactionId: 'tx-2', journal: { content: 'x'.repeat(300 * 1024) } },
}), /size limit/);

// A lost response after Core has already removed its journal must not leave a
// permanent retry loop. The production classifier accepts only the exact
// deterministic local-journal-unavailable error, never a generic validation
// failure.
const staleErrorMethod = method(owner, 'isAlreadyFinalizedLocalImportError(');
const OwnerProbe = new Function(
  `${stripTypeScriptTypes(`class OwnerProbe { ${staleErrorMethod} }`)};return OwnerProbe;`,
)();
const ownerProbe = new OwnerProbe();
assert.equal(ownerProbe.isAlreadyFinalizedLocalImportError({
  event: { error: { code: 'INVALID_PARAMS', message: 'import.finalize local book journal unavailable' } },
}), true);
assert.equal(ownerProbe.isAlreadyFinalizedLocalImportError({
  event: { error: { code: 'INVALID_PARAMS', message: 'import transactionId is invalid' } },
}), false);

console.log('local import finalize recovery queue: PASS (bounded app-private atomic queue, startup drain, strict envelope)');
