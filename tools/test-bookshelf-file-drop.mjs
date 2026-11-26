import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookshelfOperationClass as actual } from './lib/bookshelf-operation-owner-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { ReaderWriteEvidence } from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { localImportFailure } from '../entry/src/main/ets/app/LocalImportFailure.ts';
import { isReaderLocalBookFileName } from '../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts';

const UniformDataType = { FILE_URI: 'general.file-uri', FILE: 'general.file', DIRECTORY: 'general.directory' };
const readDrop = () => actual('features/bookshelf/application/BookshelfFileDrop.ts', 'readBookshelfFileDrop',
  { uniformTypeDescriptor: { UniformDataType } });
const DragResult = { DROP_ENABLED: 3, DROP_DISABLED: 4, DRAG_SUCCESSFUL: 0, DRAG_FAILED: 1 };
const DragBehavior = { COPY: 0, MOVE: 1 };

function modern(oriUri, fileType = 'general.text') {
  return { getTypes: () => [UniformDataType.FILE_URI],
    getEntry: () => ({ uniformDataType: UniformDataType.FILE_URI, oriUri, fileType }) };
}

function legacy(uri) {
  return { getTypes: () => [UniformDataType.FILE], getType: () => UniformDataType.FILE, uri };
}

test('Bookshelf drop accepts modern and legacy local file records and ignores unrelated entries', () => {
  const first = 'file://docs/storage/Example%20book.EPUB';
  const second = 'file://provider/Example.azw3';
  const unrelated = { getTypes: () => ['general.plain-text'], getType: () => 'general.plain-text',
    uri: 'file://provider/forged.txt' };
  const malformed = { getTypes() { throw Error('unreadable record'); } };
  const result = readDrop()([modern(first), unrelated, malformed, legacy(second), legacy(first),
    modern('https://example.test/book.txt'), modern('file://provider/folder.txt', UniformDataType.DIRECTORY)]);
  assert.deepEqual(result, { uris: [first, second] });
});

test('Bookshelf drop rejects empty and oversized payloads before any file grants are read', () => {
  assert.deepEqual(readDrop()([]), { uris: [], failure: 'noLocalFile' });
  assert.deepEqual(readDrop()([modern('/private/app/book.txt'), legacy('file://docs/bad\u0000.txt')]),
    { uris: [], failure: 'noLocalFile' });
  const reads = [];
  const tooLarge = Array.from({ length: 51 }, () => ({ getTypes: () => { reads.push('unexpected'); return []; } }));
  assert.deepEqual(readDrop()(tooLarge), { uris: [], failure: 'tooManyFiles' });
  assert.deepEqual(reads, []);
});

test('Bookshelf drop disables covered and remote drags, acknowledges only a submitted copy, and respects reduced motion', () => {
  const { dispatchBookshelfFileDrop, showBookshelfFileDropFeedback } = actual(
    'features/bookshelf/ui/BookshelfFileDropEvent.ets', '({dispatchBookshelfFileDrop,showBookshelfFileDropFeedback})',
    { readBookshelfFileDrop: readDrop(), DragResult, DragBehavior });
  const uri = 'file://docs/book.txt';
  const results = [], submissions = [];
  const event = { dragBehavior: DragBehavior.MOVE, remote: false,
    getData: () => ({ getRecords: () => [modern(uri)] }), isRemote() { return this.remote; },
    setResult: value => { results.push(value); } };
  assert.equal(showBookshelfFileDropFeedback(event, false), false);
  assert.equal(showBookshelfFileDropFeedback(event, true), true);
  const submit = drop => { submissions.push(drop); return drop.uris.length > 0; };
  dispatchBookshelfFileDrop(event, true, true, submit);
  assert.equal(event.dragBehavior, DragBehavior.COPY);
  assert.equal(event.useCustomDropAnimation, true);
  event.remote = true;
  assert.equal(showBookshelfFileDropFeedback(event, true), false);
  dispatchBookshelfFileDrop(event, true, false, submit);
  dispatchBookshelfFileDrop(event, false, false, submit);
  assert.deepEqual(submissions, [{ uris: [uri] }]);
  assert.deepEqual(results, [4, 3, 0, 4, 1, 1]);
});

function importFixture() {
  const trace = { staged: [], discarded: [], committed: [], methods: [], stagedGate: undefined };
  const filter = { readingState: 'all', sourceKind: 'all' };
  const existing = { sourceId: 'local', bookId: 'local:exists', title: 'Already on the shelf', author: 'Author',
    currentChapterIndex: 12, lastReadAt: 100, addedAt: 30 };
  const errorMessageOf = error => error instanceof Error ? error.message : String(error);
  const hilog = { error() {} };
  const Host = selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts', import.meta.url),
    'ReaderHostRegistry', ['prepareSystemLocalBookInput'], { isReaderLocalBookFileName, localImportFailure, errorMessageOf });
  const runtime = {
    request: async (method, params) => {
      trace.methods.push(method);
      if (method === 'import.parse') {
        if (params.input.fileName === 'Corrupt.txt') throw Error('parse format failed');
        return { data: { preview: { summary: { integrity: { schemaVersion: 1, readability: 'complete' } } } } };
      }
      if (method === 'import.persist') return { data: {
        rollbackToken: { kind: 'localBook', token: { transactionId: 'drop' } },
        persisted: { kind: 'localBook', data: { book: { bookId: 'local:New.epub',
          title: 'New', author: 'Author', kind: 'EPUB' } } },
      } };
      if (method === 'import.finalize') return { data: { kind: 'localBook', data: { finalized: true } } };
      assert.fail('unexpected dispatch ' + method);
    },
    selectLocalBookInputs: () => assert.fail('drop must not open the system picker'),
    discardLocalBookInput: async input => { trace.discarded.push(input.fileName); },
    commitLocalBookInput: async input => { trace.committed.push(input.fileName); return { created: false }; },
    rollbackLocalBookAsset: async () => assert.fail('no started asset rollback'),
  };
  const host = Object.assign(new Host(), {
    requireSelectedFileName: uri => uri.split('/').at(-1),
    ensureStageRecovery: async () => {},
    stageLocalBook: async (_uri, name) => {
      trace.staged.push(name);
      await trace.stagedGate;
      return { fileName: name, bookId: name === 'Duplicate.AZW' ? existing.bookId : 'local:' + name,
        stagedPath: 'private/' + name, assetKind: 'source' };
    },
  });
  runtime.prepareSystemLocalBookInput = (uri, admit) => host.prepareSystemLocalBookInput(uri, admit);
  const deps = { errorMessageOf, localImportFailure, hilog, ReaderWriteEvidence, BOOKSHELF_DROP_FILE_LIMIT: 50,
    ReaderRuntimeOwner: { isCurrent: candidate => candidate === runtime },
    ReaderCoreGateway: class {
      async loadShelfBook(_source, id) {
        trace.methods.push('bookshelf.get');
        return id === existing.bookId ? existing : undefined;
      }
      async upsertBook() { trace.methods.push('bookshelf.add'); return { created: true }; }
      supportsShelfPages() { return false; }
      async loadBookshelf() {
        trace.methods.push('bookshelf.list');
        return { books: [existing], total: 1, unfilteredTotal: 1, unfilteredOnlineTotal: 0 };
      }
    },
  };
  const facts = actual('app/ReaderOperationFacts.ts', '({projectOperationFacts,projectCommitReadback})');
  deps.projectPersistedReceipt = actual('app/ReaderPersistedReceiptProjection.ts', 'projectPersistedReceipt', facts);
  deps.LocalBookImportGateway = actual('features/bookshelf/application/LocalBookImportGateway.ts', 'LocalBookImportGateway', deps);
  deps.BookshelfFlowGateway = actual('features/bookshelf/application/BookshelfFlowGateway.ts', 'BookshelfFlowGateway', deps);
  const removal = { blocked: false };
  deps.BookshelfRemovalGateway = class { async recover() { return removal; } };
  deps.BookshelfManagementIntentStore = { forRuntime: () => ({ snapshot: () => removal }) };
  deps.isBookshelfRemovalMethod = () => false;
  deps.LocalImportPresentationOwner = actual('features/bookshelf/presentation/LocalImportPresentationOwner.ts', 'LocalImportPresentationOwner');
  const Owner = actual('features/bookshelf/application/BookshelfOperationOwner.ts', 'BookshelfOperationOwner', deps);
  const owner = new Owner(runtime);
  owner.openImport(() => true, () => false);
  return { trace, existing, owner,
    prepareFromSystem: uri => runtime.prepareSystemLocalBookInput(uri),
    drop: uris => owner.importFiles(filter, () => true, uris.map(name => 'file://docs/' + name)) };
}

test('Bookshelf drop applies the admitted subset and carries failure and duplicate outcomes through the existing import dialog', async () => {
  const f = importFixture();
  const result = await f.drop(['New.epub', 'Unadmitted.pdf', 'Legacy.KF8', 'Duplicate.AZW', 'Corrupt.txt']);
  assert.deepEqual(f.trace.staged, ['New.epub', 'Duplicate.AZW', 'Corrupt.txt']);
  assert.deepEqual(f.trace.committed, ['New.epub', 'Duplicate.AZW']);
  assert.deepEqual(f.trace.discarded, ['Corrupt.txt']);
  assert.deepEqual(f.trace.methods, ['bookshelf.get', 'import.parse', 'import.persist', 'bookshelf.add', 'import.finalize',
    'bookshelf.get', 'bookshelf.get', 'import.parse', 'bookshelf.list']);
  assert.deepEqual(result.batch.items.map(item => [item.fileName, item.state, item.disposition ?? item.failure?.code]), [
    ['New.epub', 'success', 'created'], ['Unadmitted.pdf', 'failed', 'unsupportedFormat'],
    ['Legacy.KF8', 'failed', 'unsupportedFormat'],
    ['Duplicate.AZW', 'success', 'existing'], ['Corrupt.txt', 'failed', 'invalidBook'],
  ]);
  assert.equal(f.owner.current().importPresentation.state, 'result');
  assert.equal(result.shelf.shelf.books[0].currentChapterIndex, 12);
});

test('System opening keeps existing KF8 admission while drag does not stage that extension', async () => {
  const f = importFixture();
  const opened = await f.prepareFromSystem('file://docs/Existing.KF8');
  assert.equal(opened.state, 'ready');
  const dropped = await f.drop(['Existing.KF8']);
  assert.equal(dropped.batch.items[0].failure.code, 'unsupportedFormat');
  assert.deepEqual(f.trace.staged, ['Existing.KF8']);
  assert.deepEqual(f.trace.methods, ['bookshelf.list']);
});

test('Closing a drop while a file is being staged releases it and does not dispatch a write', async () => {
  const f = importFixture();
  let release;
  f.trace.stagedGate = new Promise(resolve => { release = resolve; });
  const result = f.drop(['New.epub', 'Next.txt']);
  for (let tick = 0; f.trace.staged.length === 0 && tick < 30; tick += 1) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.trace.staged, ['New.epub']);
  f.owner.closeImport();
  release();
  assert.equal(await result, undefined);
  assert.deepEqual(f.trace.discarded, ['New.epub']);
  assert.deepEqual(f.trace.staged, ['New.epub']);
  assert.deepEqual(f.trace.methods, []);
  assert.equal(f.owner.current().busy, false);
  assert.equal(f.owner.current().importPresentation, undefined);
});
