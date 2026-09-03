import assert from 'node:assert/strict';

import {
  ReaderChineseConversionGateway,
} from '../entry/src/main/ets/features/reading/ReaderChineseConversionGateway.ts';

const calls = [];
const runtime = {
  async request(method, params = {}) {
    calls.push({ method, params });
    if (method === 'reader.chinese-conversion.get') {
      return { data: { config: { configId: 'global', mode: 't2s' } } };
    }
    return { data: { config: { configId: 'global', mode: params.mode } } };
  },
};

const gateway = new ReaderChineseConversionGateway(runtime);
assert.equal(await gateway.getMode(), 't2s');
assert.equal(await gateway.putMode('s2t'), 's2t');
assert.deepEqual(calls, [
  { method: 'reader.chinese-conversion.get', params: {} },
  { method: 'reader.chinese-conversion.put', params: { mode: 's2t' } },
]);

await assert.rejects(
  () => gateway.putMode('invalid'),
  /must be none, t2s, or s2t/,
);

const invalidGateway = new ReaderChineseConversionGateway({
  async request() {
    return { data: { config: { mode: 'unexpected' } } };
  },
});
await assert.rejects(
  () => invalidGateway.getMode(),
  /config\.mode must be none, t2s, or s2t/,
);

console.log('reader Chinese conversion gateway contract: PASS');
