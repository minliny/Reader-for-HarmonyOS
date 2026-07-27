import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

test('Slice 9 local five-format admission is explicit and fail-closed', async () => {
  const policy = await source('entry/src/main/ets/host/LocalBookFormatPolicy.ets');
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const picker = await source('entry/src/main/ets/ui/components/StructuralPageComponents.ets');
  for (const suffix of ['.txt', '.epub', '.pdf', '.mobi', '.umd']) {
    assert.ok(policy.includes(`'${suffix}'`), `missing ${suffix} policy`);
  }
  assert.match(policy, /pdf'[\s\S]*protocol-required/);
  assert.match(policy, /mobi'[\s\S]*protocol-required/);
  assert.match(policy, /umd'[\s\S]*protocol-required/);
  assert.match(policy, /format: 'unsupported', admission: 'unsupported'/);
  assert.ok(effects.includes("formatDecision.admission === 'protocol-required'"));
  assert.ok(policy.includes('不能回退为文本阅读'));
  assert.ok(picker.includes('LocalBookFormatPolicy.supportedSuffixFilters()'));
});

test('Slice 9 file and media paths preserve binary bytes and bounds', async () => {
  const file = await source('entry/src/main/ets/host/adapters/FileHostAdapter.ets');
  const http = await source('entry/src/main/ets/host/adapters/HttpHostAdapter.ets');
  const media = await source('entry/src/main/ets/host/adapters/CoreHostAdapter.ets');
  assert.ok(file.includes('event.byteOffset'));
  assert.ok(file.includes('event.maxBytes'));
  assert.ok(file.includes('decodeSync(event.contentBase64)'));
  assert.ok(file.includes('fs.OpenMode.APPEND'));
  assert.ok(file.includes('async writeAtomic'));
  assert.ok(file.includes('openAtomicPart'));
  assert.ok(file.includes('appendAtomicPart'));
  assert.ok(file.includes('commitAtomicPart'));
  assert.ok(file.includes('fs.fsyncSync(fd)'));
  assert.ok(file.includes("parts[index] === '..'"));
  assert.ok(http.includes('requestInStream'));
  assert.ok(http.includes('downloadToFile'));
  assert.ok(http.includes('binary download body exceeds the admitted limit'));
  assert.ok(media.includes("headers['Range']"));
  assert.ok(media.includes("headers['If-None-Match']"));
  assert.ok(media.includes('request.maxBytes'));
  assert.ok(media.includes('httpAdapter.downloadToFile'));
  assert.ok(!media.includes('httpAdapter.executeBinary'));
  assert.ok(!media.includes('content: body'));
});

test('Slice 9 Host errors and notification identity survive dispatch', async () => {
  const bridge = await source('entry/src/main/ets/bridge/core/sdk/reader_core.ts');
  const dispatcher = await source('entry/src/main/ets/host/ReaderUiHostDispatcher.ets');
  const platform = await source('entry/src/main/ets/host/HarmonyReaderUiHostPlatform.ets');
  const notification = await source('entry/src/main/ets/host/adapters/NotificationHostAdapter.ets');
  assert.ok(bridge.includes('hostError?: unknown'));
  assert.ok(dispatcher.includes('e instanceof HostErrorWrapper'));
  assert.ok(dispatcher.includes("this.requiredString(payload, 'id')"));
  assert.ok(platform.includes("id: payload['id'] as string"));
  assert.ok(notification.includes('hashStringToNumericId(request.id)'));
  assert.ok(notification.includes('id: request.id'));
});
