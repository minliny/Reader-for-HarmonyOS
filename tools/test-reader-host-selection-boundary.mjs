import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(
  'entry/src/main/ets/app/ReaderHostRegistry.ts',
  'utf8',
);

// Keep this executable check on the production method itself.  The picker and
// filesystem APIs are replaced only at this boundary; no VM/device is needed
// to prove that malformed provider output cannot reject the whole batch.
const start = source.indexOf('  async selectLocalBookInputs()');
const end = source.indexOf('\n  private async ensureStageRecovery()', start);
assert.ok(start >= 0 && end > start, 'picker selection method must exist');
const method = source.slice(start, end);
assert.match(method, /const selectedUris = uris\.slice\(0, ReaderHostRegistry\.LocalBookSelectionLimit\)/);
assert.match(method, /let fileName = '未命名文件';[\s\S]*?try \{\s*fileName = this\.requireSelectedFileName/);

const Picker = {
  DocumentSelectOptions: class DocumentSelectOptions {},
  DocumentViewPicker: class DocumentViewPicker {
    constructor(_context) {}
    async select(_options) { return Picker.uris; }
  },
  uris: [],
};
const logs = [];
const Harness = new Function(
  'picker', 'ReaderHostRegistry', 'hilog', 'errorMessageOf', 'localImportFailure',
  'READER_LOCAL_BOOK_PICKER_FILTER', 'LOG_DOMAIN',
  `${stripTypeScriptTypes(`
    class Harness {
      ${method}
    }
  `)}; return Harness;`,
)(
  Picker,
  { LocalBookSelectionLimit: 50, LocalBookStagingConcurrency: 2 },
  {
    warn(...args) { logs.push(['warn', ...args]); },
    error(...args) { logs.push(['error', ...args]); },
  },
  error => error instanceof Error ? error.message : String(error),
  reason => ({ code: 'readFailed', message: String(reason) }),
  'TXT、EPUB|.txt,.epub',
  0x5244,
);

const harness = new Harness();
Object.assign(harness, {
  context: {},
  async ensureStageRecovery() {},
  requireSelectedFileName(uri) {
    if (uri === 'bad://provider-result') throw new Error('Selected document has no file name');
    return `${uri}.txt`;
  },
  async stageLocalBook(uri, fileName) {
    return { fileName, bookId: `local:${uri}`, stagedPath: `/stage/${uri}`, assetKind: 'source' };
  },
});

Picker.uris = ['good-a', 'bad://provider-result', 'good-b'];
const mixed = await harness.selectLocalBookInputs();
assert.equal(mixed.length, 3);
assert.deepEqual(mixed.map(item => item.state), ['ready', 'failed', 'ready']);
assert.equal(mixed[1].fileName, '未命名文件');
assert.equal(mixed[1].failure.code, 'readFailed');

Picker.uris = Array.from({ length: 55 }, (_value, index) => `book-${index}`);
const oversized = await harness.selectLocalBookInputs();
assert.equal(oversized.length, 50, 'provider over-return must be bounded before allocation');
assert.equal(oversized.at(-1).input.fileName, 'book-49.txt');
assert.ok(logs.some(entry => entry[0] === 'warn'), 'oversized provider result must be observable');

console.log('Reader Host picker selection boundary: PASS');
