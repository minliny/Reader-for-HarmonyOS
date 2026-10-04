import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { CapabilityRouter } from '../entry/vendor/core-harmony/sdk/reader_core.ts';
import { MangaImageDecodeHost } from '../entry/src/main/ets/app/MangaImageDecodeHost.ts';
import { MangaImageMetadataHost } from '../entry/src/main/ets/app/MangaImageMetadataHost.ts';

// Execute the complete current registry and the real SDK/transfer owners.
// Only native IO/graphics are replaced; no platform or network work occurs.
const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts', import.meta.url), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const calls = [];
let fetchGate;
const graphics = {
  async inspect(bytes, current) { assert.equal(current(), true); calls.push(['inspect', [...bytes]]); return { width: 2, height: 3 }; },
  async transform(bytes, plan, current) { assert.equal(current(), true); calls.push(['transform', plan]); return bytes.slice().reverse(); },
};
const body = {
  async fetchRequestBytes(params, current, maxBytes) {
    calls.push(['image-http', params, maxBytes]); assert.equal(current(), true);
    if (fetchGate) await fetchGate;
    if (!current()) throw Error('BODY_CANCELLED');
    return new Uint8Array([1, 2, 3]);
  },
  readDataUriBytes(dataUri, current, maxBytes) {
    assert.equal(current(), true); assert.equal(dataUri, 'data:image/png;base64,AQID');
    calls.push(['data-uri', maxBytes]); return new Uint8Array([1, 2, 3]);
  },
  async validateBytes(bytes, current, position) {
    assert.equal(current(), true); assert.equal(position, 0);
    calls.push(['validate', [...bytes]]);
  },
};
const http = {
  async execute(params, requestId) { calls.push(['http', params, requestId]); return { status: 200 }; },
  async executeForCore(params, requestId, operationId, bridge) {
    calls.push(['core-http', params, requestId, operationId, bridge]); return { assetId: 91 };
  },
  cancel(requestId) { calls.push(['cancel-http', requestId]); },
};
const Registry = new Function('CapabilityRouter', 'HttpExecuteHost', 'CookieSessionStore', 'ArkWebExecutor',
  'MangaImageDecodeHost', 'MangaImageMetadataHost', 'MangaImageGraphicsHost', 'ReadingBodyImageHost',
  executable + '\nreturn ReaderHostRegistry;')(
  CapabilityRouter, { instance: http }, { instance: { getCapability: async () => ({ cookie: 'fixture' }), setCapability: async () => ({ ok: true }) } },
  { instance: { execute: async () => ({ value: 'fixture' }), cancel() {} } },
  MangaImageDecodeHost, MangaImageMetadataHost, { instance: graphics }, { instance: body },
);
const registry = Object.create(Registry.prototype);
registry.readSnapshot = async () => ({ value: 'fixture' });
registry.writeSnapshot = async () => ({ ok: true });
const event = (params, operationId = 17, requestId = 7, capability = 'manga.resource.transfer') =>
  ({ protocolVersion: 1, type: 'host.request', capability, requestId, operationId, params });
const router = registry.createCapabilityRouter();
for (const name of ['http.execute', 'persistence.get', 'persistence.put', 'cookie.get', 'cookie.set', 'webview.evaluateJavaScript', 'manga.resource.transfer']) {
  assert.equal(router.has(name), true, `existing capability ${name} remains registered`);
}
await assert.rejects(router.route(event({ stage: 'input' })), /MANGA_DECODE_ASSET_BRIDGE/);

let nextAsset = 0;
const assets = new Map(), released = [];
const bridge = {
  begin(_request, _operation, count) { const id = ++nextAsset; assets.set(id, { bytes: new Uint8Array(count), offset: 0 }); return id; },
  write(_request, _operation, id, bytes) { const asset = assets.get(id); asset.bytes.set(bytes, asset.offset); asset.offset += bytes.length; return bytes.length; },
  commit(_request, _operation, id) { return assets.get(id).offset; },
  async read(_request, _operation, id, offset, count) { return assets.get(id).bytes.slice(offset, offset + count); },
  release(_request, _operation, id) { released.push(id); assets.delete(id); },
};
registry.setResponseAssetBridge(bridge);
for (const descriptor of [{ url: 'https://fixture.invalid/image' }, { dataUri: 'data:image/png;base64,AQID' }]) {
  calls.length = 0;
  const prepared = await MangaImageDecodeHost.instance.prepare({ resourceRef: 'fixture-resource' }, async params => {
    const input = await router.route(event({ ...params, stage: 'input', maxBytes: 8388608, request: descriptor, inspectGraphics: true }));
    assert.equal(input.width, 2); assert.equal(input.height, 3);
    bridge.release(7, 17, input.assetId);
    const output = bridge.begin(7, 17, 3);
    bridge.write(7, 17, output, new Uint8Array([4, 5, 6]));
    bridge.commit(7, 17, output);
    const receipt = await router.route(event({ ...params, stage: 'output', assetId: output, operationId: 17, bytes: 3, graphicsPlan: {} }, 18));
    assert.equal(receipt.consumed, true); assert.equal(assets.has(output), false, 'native output releases before acknowledgement');
    return { requestId: 7, data: { ...params, prepared: true, bytes: 3 } };
  }, () => true);
  assert.deepEqual(prepared, new Uint8Array([6, 5, 4]));
  assert.equal(calls.filter(call => call[0] === 'image-http').length, 'url' in descriptor ? 1 : 0);
  assert.equal(calls.find(call => call[0] === ('url' in descriptor ? 'image-http' : 'data-uri')).at(-1), 8388608);
  assert.deepEqual(calls.at(-1), ['validate', [6, 5, 4]]);
}

calls.length = 0;
const input = new Uint8Array([10, 11, 12]), sha256 = createHash('sha256').update(input).digest('hex');
const proof = await MangaImageMetadataHost.instance.inspect(input, sha256, async params => {
  const receipt = await router.route(event({ ...params, stage: 'inspectInput', maxBytes: 16777216 }, 19));
  assert.deepEqual(assets.get(receipt.assetId).bytes, input);
  bridge.release(7, 19, receipt.assetId);
  return { requestId: 7, data: { ...params, status: 'absent', orientation: null } };
}, () => true);
assert.equal(proof.status, 'absent'); assert.deepEqual(calls, [], 'metadata transfer performs no HTTP/decode/graphics');

const commit = bridge.commit;
await assert.rejects(MangaImageMetadataHost.instance.inspect(input, sha256, async params => {
  const requestEvent = event({ ...params, stage: 'inspectInput', maxBytes: 16777216 }, 20);
  bridge.commit = (...args) => { const count = commit(...args); router.cancel(requestEvent); return count; };
  try { await router.route(requestEvent); }
  finally { bridge.commit = commit; }
  assert.fail('cancelled metadata cannot complete');
}, () => true), /MANGA_INSPECT_COMMIT/);
assert.equal(MangaImageMetadataHost.instance.transfers.size, 0);
assert.equal(assets.size, 0, 'cancelled metadata commit releases its asset');

let releaseFetch, entered;
fetchGate = new Promise(resolve => { releaseFetch = resolve; });
const reachedFetch = new Promise(resolve => { entered = resolve; });
const pending = MangaImageDecodeHost.instance.prepare({ resourceRef: 'cancelled-resource' }, async params => {
  const requestEvent = event({ ...params, stage: 'input', maxBytes: 8388608, request: { url: 'https://fixture.invalid/cancel' } }, 21, 8);
  const fetching = router.route(requestEvent); entered(requestEvent);
  await fetching; assert.fail('cancelled transfer cannot complete');
}, () => true);
const cancelled = await reachedFetch;
router.cancel(cancelled);
releaseFetch();
await assert.rejects(pending, /BODY_CANCELLED/);
fetchGate = undefined;
assert.equal(MangaImageDecodeHost.instance.transfers.size, 0);
assert.equal(MangaImageMetadataHost.instance.transfers.size, 0);
assert.equal(assets.size, 0, 'cancelled transfer cannot allocate or publish assets');

calls.length = 0;
await router.route(event({ responseAsset: true }, 31, 9, 'http.execute'));
assert.deepEqual(calls[0], ['core-http', { responseAsset: true }, 9, 31, bridge]);
router.cancel(event({}, 31, 9, 'http.execute'));
assert.deepEqual(calls.at(-1), ['cancel-http', 9]);
await router.route(event({}, 32, 10, 'http.execute'));
assert.deepEqual(calls.at(-1), ['http', {}, 10]);
assert.doesNotMatch(source, /mangaOfflineProbe|beforeCoreHttp|beforeImageHttp/, 'R9 production registry never arms the frozen diagnostic probe');
console.log('PASS current registry + SDK + manga transfer owners: asset bridge, bounded HTTP/data URI, graphics, metadata-only path, cancellation and existing HTTP lifecycle');
