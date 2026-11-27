import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';

type SourceFixture = { width: number; height: number; frames: number; sizeReady: Promise<void> };
const platform = globalThis as typeof globalThis & {
  readerBodyFixture: SourceFixture;
  readerBodySources: number;
  readerBodyPixelMaps: number;
};
const imageModule = `
  export const image = {
    createImageSource() {
      globalThis.readerBodySources++;
      const { width, height, frames, sizeReady } = globalThis.readerBodyFixture;
      const info = { size: { width, height }, mimeType: 'image/png' };
      return {
        async getImageInfo() { await sizeReady; return info; },
        async getFrameCount() { return frames; },
        async createPixelMap() {
          globalThis.readerBodyPixelMaps++;
          return { async getImageInfo() { return info; }, async release() {} };
        },
        async release() {},
      };
    },
  };
`;
const portModules = new Map<string, string>([
  ['@kit.ImageKit', imageModule],
  ['@kit.PerformanceAnalysisKit', 'export const hilog = {};'],
  ['@ohos.hilog', 'export default {};'],
  ['@ohos.util', 'export default {};'],
  ['@ohos.file.fs', 'export default {};'],
  ['@ohos.security.cryptoFramework', 'export default {};'],
  ['@ohos.net.http', 'export default {};'],
  ['@ohos.net.connection', 'export default {};'],
  ['@ohos.url', 'export default {};'],
  ['@ohos.security.asset', 'export default {};'],
  ['@ohos.xml', 'export default {};'],
  ['@reader/core-harmony', 'export function encodeSharedText() { throw Error("decode validation has no Core or transport call"); }'],
]);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const port = portModules.get(specifier);
    return port === undefined ? nextResolve(specifier, context) :
      { url: `data:text/javascript,${encodeURIComponent(port)}`, shortCircuit: true };
  },
});
const { ReadingBodyImageHost, ReadingImagePresentationPolicyError } =
  await import('../../entry/src/main/ets/platform/reading-resources/ReadingBodyImageHost.ts');
hooks.deregister();

test('body illustration validation holds no more than two native decode sources at once', async () => {
  let release = (): void => {};
  platform.readerBodyFixture = { width: 64, height: 64, frames: 1,
    sizeReady: new Promise<void>(resolve => { release = resolve; }) };
  platform.readerBodySources = 0;
  platform.readerBodyPixelMaps = 0;
  const host = new ReadingBodyImageHost();
  const requests = [1, 2, 3].map(value => host.validateBytes(Uint8Array.of(value)));
  try {
    await setImmediate();
    assert.equal(platform.readerBodySources, 2);
    assert.equal(platform.readerBodyPixelMaps, 0);
  } finally {
    release();
    await Promise.all(requests);
  }
  assert.equal(platform.readerBodySources, 3);
  assert.equal(platform.readerBodyPixelMaps, 3);
});

test('body illustration validation rejects oversized working surfaces and animated frames before pixel decode', async () => {
  const host = new ReadingBodyImageHost();
  const bytes = Uint8Array.of(1);
  platform.readerBodyPixelMaps = 0;
  platform.readerBodyFixture = { width: 4096, height: 4096, frames: 1, sizeReady: Promise.resolve() };
  await assert.rejects(host.validateBytes(bytes), error =>
    error instanceof ReadingImagePresentationPolicyError && error.message === 'READING_IMAGE_DECODE_WORKING_BUDGET');
  platform.readerBodyFixture = { width: 64, height: 64, frames: 2, sizeReady: Promise.resolve() };
  await assert.rejects(host.validateBytes(bytes), error =>
    error instanceof ReadingImagePresentationPolicyError && error.message === 'READING_IMAGE_FRAME_COUNT_INVALID');
  assert.equal(platform.readerBodyPixelMaps, 0);
});
