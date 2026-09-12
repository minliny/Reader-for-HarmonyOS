import assert from 'node:assert/strict';

import { ReaderHttpTtsGateway } from
  '../entry/src/main/ets/features/reading/ReaderHttpTtsGateway.ts';
import {
  isReaderTtsCredentialAliasForConfig,
  readerOnlineTtsEditedProfile,
  readerOnlineTtsProfile,
} from '../entry/src/main/ets/features/reading/ReaderOnlineTtsProfile.ts';

const config = {
  id: 42,
  name: '受控在线引擎',
  url: 'https://tts.example.test/audio?text={{text}}',
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
          url: `https://tts.example.test/audio?text=${encodeURIComponent(params.text)}`,
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

const postData = { method: 'POST', url: 'https://example.invalid', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: '中文正文', speed: .75 }) };
const post = new ReaderHttpTtsGateway({ async request() { return { data: postData }; } });
assert.deepEqual(await post.buildRequest(1, '中文正文', 75), postData, 'Core-owned POST body and headers cross the strict boundary intact');

const invalid = new ReaderHttpTtsGateway({
  async request() {
    return { data: { method: 'PATCH', url: 'https://example.invalid', headers: {} } };
  },
});
await assert.rejects(() => invalid.buildRequest(1, 'x'), /unsupported descriptor/);
const invalidBody = new ReaderHttpTtsGateway({ async request() { return { data: { ...postData, body: {} } }; } });
await assert.rejects(() => invalidBody.buildRequest(1, 'x'), /invalid body/);
for (const unsafeUrl of ['http://tts.example.test/audio', 'https://127.0.0.1/audio',
  'https://100.64.0.1/audio', 'file:///private/audio']) {
  const unsafe = new ReaderHttpTtsGateway({ async request() {
    return { data: { method: 'GET', url: unsafeUrl, headers: {} } };
  } });
  await assert.rejects(() => unsafe.buildRequest(1, 'x'), /HTTPS URL on a public network target/);
}
const injectedHeader = new ReaderHttpTtsGateway({ async request() {
  return { data: { method: 'GET', url: 'https://tts.example.test/audio',
    headers: { Authorization: 'safe\r\nX-Leak: value' } } };
} });
await assert.rejects(() => injectedHeader.buildRequest(1, 'x'), /invalid headers/);

console.log('reader HttpTTS strict gateway: PASS');

const extended = { ...config, readerProfile: JSON.stringify({version:1,voice:'晓晓',format:'wav'}) };
assert.deepEqual(await gateway.put(extended), extended);
await assert.rejects(() => gateway.put({...config, apiKey:'must-not-reach-core'}), /unknown field apiKey/);
await assert.rejects(() => gateway.buildRequest(42,'正文',77), /语速无效/);
const playback = {format:'mp3',sampleRate:null,channels:null,sampleFormat:'s16le',credentialRef:null,
  credentialHeader:null,credentialPrefix:'',rateApplied:true,ratePercent:75};
const typed = new ReaderHttpTtsGateway({async request(){return {data:{...postData,playback}};}});
const normalized = (await typed.buildRequest(42,'正文',75)).playback;
assert.equal(normalized.sampleRate, undefined);
assert.equal(normalized.credentialRef, undefined);
assert.equal(normalized.ratePercent,75);
playback.format='pcm';
await assert.rejects(() => typed.buildRequest(42,'正文',75), /缺少采样率或声道/);
playback.sampleRate=24000; playback.channels=1;
assert.equal((await typed.buildRequest(42,'正文',75)).playback.sampleRate,24000);
playback.credentialHeader='Authorization\r\nInjected';
await assert.rejects(() => typed.buildRequest(42,'正文',75), /鉴权请求头无效/);
console.log('reader HttpTTS profile, secret boundary and nullable playback: PASS');

// A URL-bound key is a valid Host-only credential path even when no header is
// configured. The gateway must preserve the opaque placeholder for the Host,
// while still rejecting a placeholder that has no credential alias.
const urlCredentialDescriptor = {
  method: 'GET',
  url: 'https://tts.example.test/audio?token={{apiKey}}&text=hello',
  headers: {},
  playback: {
    format: 'mp3', sampleRate: null, channels: null, sampleFormat: 's16le',
    credentialRef: 'reader.tts.42.fixture-token', credentialHeader: null,
    credentialPrefix: '', rateApplied: true, ratePercent: 100,
  },
};
const urlCredentialGateway = new ReaderHttpTtsGateway({
  async request() { return { data: urlCredentialDescriptor }; },
});
const urlCredential = await urlCredentialGateway.buildRequest(42, '正文');
assert.match(urlCredential.url, /token=\{\{apiKey\}\}/);
assert.equal(urlCredential.playback.credentialRef, 'reader.tts.42.fixture-token');
const unboundUrlCredentialGateway = new ReaderHttpTtsGateway({
  async request() {
    return { data: { ...urlCredentialDescriptor,
      playback: { ...urlCredentialDescriptor.playback, credentialRef: null } } };
  },
});
await assert.rejects(() => unboundUrlCredentialGateway.buildRequest(42, '正文'), /密钥占位符缺少密钥引用/);
console.log('reader HttpTTS URL credential placeholder boundary: PASS');

// The persisted profile is an untrusted Core string. It must be copied only
// after exact field, protocol, alias and PCM metadata validation.
const safeProfile = readerOnlineTtsProfile(JSON.stringify({
  version: 1, format: 'pcm', pcmSampleRate: 24000, pcmChannels: 1,
  credentialRef: 'reader.tts.42.fixture-token', credentialHeader: 'X-Api-Key',
  credentialPrefix: 'Bearer ', protocol: 'template-get', model: 'safe-model',
}));
assert.equal(safeProfile.voice, '');
assert.equal(safeProfile.pcmSampleRate, 24000);
assert.equal(isReaderTtsCredentialAliasForConfig(safeProfile.credentialRef, 42), true);
assert.equal(isReaderTtsCredentialAliasForConfig(safeProfile.credentialRef, 7), false);
assert.equal(readerOnlineTtsProfile(readerOnlineTtsEditedProfile(undefined, 'voice', 'wav')).format, 'wav');
for (const raw of [
  'null', '[]', '{"version":1,"format":"mp3","unknown":true}',
  '{"version":1,"format":"mp3","voice":"bad\\nvoice"}',
  '{"version":1,"format":"mp3","protocol":"javascript"}',
  '{"version":1,"format":"mp3","credentialRef":"reader.tts.42/../x"}',
  '{"version":1,"format":"pcm","pcmSampleRate":12000,"pcmChannels":1}',
  '{"version":1,"format":"pcm","pcmSampleRate":24000,"pcmChannels":3}',
  '{"version":1,"format":"mp3","credentialHeader":"X-Api-Key\\r\\nInjected"}',
]) {
  assert.throws(() => readerOnlineTtsProfile(raw), /在线语音配置格式无效/);
}
assert.throws(() => readerOnlineTtsProfile(null), /在线语音配置格式无效/);
assert.equal(isReaderTtsCredentialAliasForConfig('reader.tts.42.fixture-token', 42), true);
assert.equal(isReaderTtsCredentialAliasForConfig('reader.tts.042.fixture-token', 42), false);
console.log('reader OnlineTTS profile validator and credential alias binding: PASS');
