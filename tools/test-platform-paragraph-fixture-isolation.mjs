import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Use the real SDK gate in a checkout-sized fixture with no historical evidence,
// installed project dependencies or build cache. Mutations remain local here.
const root = mkdtempSync(join(tmpdir(), 'reader-paragraph-fixture-'));
try {
  const gate = join(root, 'test-reader-platform-paragraph-probe.mjs');
  const fixture = join(root, 'fixtures/ReaderPlatformParagraphProbe.ts');
  mkdirSync(join(root, 'fixtures'));
  copyFileSync(new URL('./test-reader-platform-paragraph-probe.mjs', import.meta.url), gate);
  const original = readFileSync(new URL('./fixtures/ReaderPlatformParagraphProbe.ts', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'),
    'ceb4b9832348898e5942e5cec72dcfb0c2949e1f652506b05c3841d8700cfb9b');
  const run = (env = process.env) => {
    const result = spawnSync(process.execPath, [gate], { env, encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    return result;
  };
  writeFileSync(fixture, original);
  const valid = run();
  assert.equal(valid.status, 0, valid.stderr);
  rmSync(fixture);
  const missing = run();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /ENOENT.*ReaderPlatformParagraphProbe/s);
  writeFileSync(fixture, original);
  const wrongSdk = run({ ...process.env, OHOS_SDK_HOME: join(root, 'missing-sdk') });
  assert.notEqual(wrongSdk.status, 0);
  assert.match(wrongSdk.stderr, /ENOENT.*missing-sdk/s);
  const invalid = original.toString().replace('paragraph.layoutSync(widthPx)', 'paragraph.layoutSync("invalid-width")');
  assert.notEqual(invalid, original.toString());
  writeFileSync(fixture, invalid);
  const invalidApi = run();
  assert.notEqual(invalidApi.status, 0);
  assert.match(invalidApi.stderr, /not assignable to parameter of type 'number'/);
  console.log('Paragraph fixture isolation: PASS (original SHA, real SDK, missing asset, wrong SDK, invalid API signature)');
} finally {
  rmSync(root, { recursive: true, force: true });
}
