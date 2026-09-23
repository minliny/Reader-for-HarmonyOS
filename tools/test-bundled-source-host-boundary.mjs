import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const registry = readFileSync(new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts', import.meta.url), 'utf8');
const start = registry.indexOf('  async readBundledRawFileText(');
const end = registry.indexOf('\n  /** Clear every Host-owned credential', start);
assert.ok(start >= 0 && end > start, 'exercise the production Host method');
const limit = registry.match(/static readonly JsonDocumentLimitBytes = ([^;]+);/);
assert.ok(limit, 'retain the production resource size limit');
const Host = new Function('util', 'errorMessageOf', `${stripTypeScriptTypes(`
  class ReaderHostRegistry {
    static JsonDocumentLimitBytes = ${limit[1]};
    constructor(resourceManager) { this.context = { resourceManager }; }
    ${registry.slice(start, end)}
  }
`)}; return ReaderHostRegistry;`)(
  { TextDecoder: { create: (encoding, options) => ({
    decodeToString: bytes => new TextDecoder(encoding, options).decode(bytes),
  }) } },
  error => error.message,
);

const reads = [];
let payload = new TextEncoder().encode('{"resource":"fixture"}');
const host = new Host({ getRawFileContent: async file => { reads.push(file); return payload; } });
const itemPath = `bundled-sources/${'a'.repeat(64)}.json`;
for (const file of ['reader-tested-book-source-collection.json', 'bundled-sources/index.json', itemPath]) {
  assert.equal(await host.readBundledRawFileText(file), '{"resource":"fixture"}');
  assert.equal(reads.at(-1), file, 'preserve the packaged relative path at resourceManager');
}
for (const file of [
  '', ' ', '.', '..', '/bundled-sources/index.json', '../index.json',
  'bundled-sources/../index.json', 'bundled-sources/./index.json',
  'bundled-sources//index.json', 'bundled-sources/', 'bundled-sources/index.json/',
  'bundled-sources\\index.json', 'C:\\bundled-sources\\index.json',
  'other/index.json', 'bundled-sources/unlisted.json',
  `bundled-sources/${'a'.repeat(63)}.json`, `bundled-sources/${'A'.repeat(64)}.json`,
  `${itemPath}?version=1`, `bundled-sources/${'a'.repeat(64)}.json/extra`,
]) {
  const before = reads.length;
  await assert.rejects(host.readBundledRawFileText(file), /Bundled raw-file name/, file);
  assert.equal(reads.length, before, 'reject invalid paths before resource I/O');
}
payload = new Uint8Array();
await assert.rejects(host.readBundledRawFileText(itemPath), /invalid size/);
payload = new Uint8Array(Host.JsonDocumentLimitBytes + 1);
await assert.rejects(host.readBundledRawFileText(itemPath), /invalid size/);
payload = new Uint8Array([0xc3, 0x28]);
await assert.rejects(host.readBundledRawFileText(itemPath), /not valid UTF-8/);
const unavailable = new Host({ getRawFileContent: async () => { throw new Error('missing fixture'); } });
await assert.rejects(unavailable.readBundledRawFileText(itemPath), /is unavailable: missing fixture/);

// Exercise supply -> the real Host validator -> resourceManager together.
// Synthetic resources avoid reading source documents or credentials.
const sha256Hex = async text => createHash('sha256').update(text).digest('hex');
const document = JSON.stringify({ bookSourceUrl: 'https://fixture.invalid', bookSourceName: 'Fixture' });
const itemDigest = await sha256Hex(document);
const index = { schemaVersion: 1, bundleId: 'reader-tested-book-sources', digest: 'fixture',
  collectionRecords: 1, items: [{ sourceId: 'https://fixture.invalid', itemDigest, file: itemPath }] };
const indexText = JSON.stringify(index);
const resources = new Map([['bundled-sources/index.json', indexText], [itemPath, document]]);
const supplyReads = [];
const supplyHost = new Host({ getRawFileContent: async file => {
  supplyReads.push(file);
  assert.ok(resources.has(file));
  return new TextEncoder().encode(resources.get(file));
} });
const source = readFileSync(new URL('../entry/src/main/ets/app/IncrementalBundledSourceSupply.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/export /g, '');
const supply = new Function('sha256Hex', 'BUNDLED_SOURCE_INDEX_SHA256',
  `${stripTypeScriptTypes(source)}; return supplyBundledSources;`)(sha256Hex, await sha256Hex(indexText));
const calls = [];
const summary = await supply({ digest: index.digest, current: () => true, legacyIds: async () => [],
  read: file => supplyHost.readBundledRawFileText(file), request: async params => {
    calls.push(params);
    if (params.operation === 'status') return { data: { complete: false, items: [] } };
    if (params.operation === 'apply') assert.equal(params.document, document);
    return { data: { accepted: true, changed: true, complete: true } };
  } });
assert.deepEqual(supplyReads, ['bundled-sources/index.json', itemPath]);
assert.deepEqual(calls.map(call => call.operation), ['status', 'apply', 'finish']);
assert.equal(summary.failed, 0);
assert.equal(summary.installedOrUpgraded, 1);
console.log('Bundled source Host boundary: controlled paths, unchanged I/O guards, real supply-to-Host wiring PASS');
