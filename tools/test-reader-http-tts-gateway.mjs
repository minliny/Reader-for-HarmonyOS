import assert from 'node:assert/strict';

import { ReaderHttpTtsGateway } from
  '../entry/src/main/ets/features/reading/ReaderHttpTtsGateway.ts';

const config = {
  id: 42,
  name: '受控在线引擎',
  url: 'http://10.0.2.2:18084/tts?text={{text}}',
  contentType: 'audio/mpeg',
  concurrentRate: '1',
  lastUpdateTime: 1_786_464_000_000,
};
const calls = [];
const runtime = {
  async request(method, params) {
    calls.push({ method, params });
    if (method === 'http-tts.put') return { data: { tts: params } };
    if (method === 'http-tts.get') return { data: { tts: config } };
    if (method === 'http-tts.list') return { data: { items: [config] } };
    if (method === 'http-tts.delete') return { data: { id: params.id, deleted: true } };
    if (method === 'http-tts.build-request') {
      return {
        data: {
          method: 'GET',
          url: `http://10.0.2.2:18084/tts?text=${encodeURIComponent(params.text)}`,
          headers: { Authorization: 'redacted-fixture-token' },
          contentType: 'audio/mpeg',
          concurrentRate: '1',
        },
      };
    }
    throw new Error(`unexpected ${method}`);
  },
};

const gateway = new ReaderHttpTtsGateway(runtime);
assert.deepEqual(await gateway.put(config), config);
assert.deepEqual(await gateway.get(42), config);
assert.deepEqual(await gateway.list(), [config]);
assert.deepEqual(await gateway.delete(42), { id: 42, deleted: true });
const descriptor = await gateway.buildRequest(42, '第一句。');
assert.equal(descriptor.method, 'GET');
assert.equal(descriptor.contentType, 'audio/mpeg');
assert.equal(descriptor.headers.Authorization, 'redacted-fixture-token');
assert.match(descriptor.url, /%E7%AC%AC/);
assert.deepEqual(calls.map(call => call.method), [
  'http-tts.put', 'http-tts.get', 'http-tts.list', 'http-tts.delete', 'http-tts.build-request',
]);

await assert.rejects(() => gateway.buildRequest(42, '   '), /non-empty text/);

const invalid = new ReaderHttpTtsGateway({
  async request() {
    return { data: { method: 'POST', url: 'https://example.invalid', headers: {} } };
  },
});
await assert.rejects(() => invalid.buildRequest(1, 'x'), /unsupported descriptor/);

console.log('reader HttpTTS strict gateway: PASS');
