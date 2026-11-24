import assert from 'node:assert/strict';
import { isReaderLocalBookFileName, READER_LOCAL_BOOK_PICKER_FILTER } from '../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts';
import { LocalBookSelectionFailure, localImportFailure } from '../entry/src/main/ets/app/LocalImportFailure.ts';
import { ReaderDocumentPickerActivity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';

const pickerAdmission = { current: true, foreground: true };
const canOpenPicker = () => pickerAdmission.current && pickerAdmission.foreground;
ReaderDocumentPickerActivity.bind(9202);
ReaderDocumentPickerActivity.setForeground(pickerAdmission.foreground);

const Picker = {
  DocumentSelectOptions: class DocumentSelectOptions {},
  DocumentViewPicker: class DocumentViewPicker {
    constructor(_context) {}
    async select(_options) { return Picker.uris; }
  },
  uris: [],
};
const Harness = selectedProductionMethods(
  new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts', import.meta.url), 'ReaderHostRegistry',
  ['LocalBookSelectionLimit', 'LocalBookStagingConcurrency', 'selectLocalBookInputs'], {
    picker: Picker, hilog: { error() {} }, LOG_DOMAIN: 0,
    errorMessageOf: error => error instanceof Error ? error.message : String(error),
    localImportFailure, LocalBookSelectionFailure, ReaderDocumentPickerActivity,
    READER_LOCAL_BOOK_PICKER_FILTER, isReaderLocalBookFileName,
  });

const harness = new Harness();
const namedUris = [];
const stagedUris = [];
Object.assign(harness, {
  context: {},
  async ensureStageRecovery() {},
  requireSelectedFileName(uri) {
    namedUris.push(uri);
    if (uri === 'bad://provider-result') throw new Error('Selected document has no file name');
    return uri.includes('.') ? uri : `${uri}.txt`;
  },
  async stageLocalBook(uri, fileName) {
    stagedUris.push(uri);
    return { fileName, bookId: `local:${uri}`, stagedPath: `/stage/${uri}`, assetKind: 'source' };
  },
});

Picker.uris = ['good-a', 'bad://provider-result', 'provider-returned.html', 'good-b'];
const mixed = await harness.selectLocalBookInputs(canOpenPicker);
assert.equal(mixed.length, 4);
assert.deepEqual(mixed.map(item => item.state), ['ready', 'failed', 'failed', 'ready']);
assert.equal(mixed[1].fileName, '未命名文件');
assert.equal(mixed[1].failure.code, 'readFailed');
assert.equal(mixed[2].fileName, 'provider-returned.html');
assert.equal(mixed[2].failure.code, 'invalidBook');
assert.deepEqual(namedUris, Picker.uris);
assert.deepEqual(stagedUris, ['good-a', 'good-b'],
  'provider-supplied unsupported files must fail without staging or dropping admitted neighbors');

Picker.uris = Array.from({ length: 55 }, (_value, index) => `book-${index}`);
await assert.rejects(() => harness.selectLocalBookInputs(canOpenPicker),
  error => error instanceof LocalBookSelectionFailure && error.reason === 'selectionLimit');
assert.equal(namedUris.length, 4, 'the oversized provider result is rejected before parsing filenames');
assert.deepEqual(stagedUris, ['good-a', 'good-b']);

Picker.uris = [];
assert.deepEqual(await harness.selectLocalBookInputs(canOpenPicker), []);
assert.equal(namedUris.length, 4);
assert.deepEqual(stagedUris, ['good-a', 'good-b']);

console.log('Reader Host picker selection boundary: PASS');
