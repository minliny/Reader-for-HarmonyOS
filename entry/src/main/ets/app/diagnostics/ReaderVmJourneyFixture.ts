import type { JsonObject } from '@reader/core-harmony';
import { ReaderCoreGateway } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import { SourceGateway } from '../../features/source/application/SourceGateway';
import { canonicalRulePayloadJson } from '../BundledBookSourceSupply';
import { prepareReaderPublicLongBook } from './ReaderPublicLongBook';
import type { ReaderPublicFixtureScope } from './ReaderPublicFixtureScope';
import { READER_VM_AUTHOR, READER_VM_IMPORT_SOURCE, READER_VM_JOURNEY_SCOPE, READER_VM_LOCAL_TITLE, READER_VM_SHELF_SOURCE,
  READER_VM_SHELF_TITLE, readerVmJourneyBookId, readerVmJourneySources, readerVmJourneyTitle } from './ReaderVmJourneyData';

/** Rebuild only the known public starting rows. Refuse an unexpected scope or
 * foreign records before any write to the isolated store. */
export async function prepareReaderVmJourneyFixture(owner: ReaderRuntimeOwner,
  fixture: ReaderPublicFixtureScope): Promise<void> {
  const current = (): boolean => fixture.id === READER_VM_JOURNEY_SCOPE && owner.isCurrentPublicFixture(fixture);
  const requireCurrent = (): void => {
    if (!current()) throw new Error('VM_JOURNEY_FIXTURE_RETIRED');
  };
  requireCurrent();
  const bookshelf = new ReaderCoreGateway(owner);
  const source = new SourceGateway(owner);
  const expected = readerVmJourneySources();
  const before = await bookshelf.loadBookshelf({ limit: 16 }, current);
  requireCurrent();
  if (before.books.length !== before.total || before.books.some(book => book.sourceId === 'local' ?
    book.title !== READER_VM_LOCAL_TITLE : readerVmJourneyTitle(book.sourceId, book.bookId) !== book.title)) {
    throw new Error('VM_JOURNEY_FIXTURE_UNEXPECTED_BOOKSHELF');
  }
  let imported = await source.loadSources(undefined, true, current);
  requireCurrent();
  if (imported.some(row => row.sourceId !== READER_VM_IMPORT_SOURCE &&
    !expected.some(definition => definition['bookSourceUrl'] === row.sourceId))) {
    throw new Error('VM_JOURNEY_FIXTURE_UNEXPECTED_SOURCES');
  }
  if (imported.some(row => row.sourceId === READER_VM_IMPORT_SOURCE)) {
    const cleanup = await source.deleteSources([READER_VM_IMPORT_SOURCE]);
    requireCurrent();
    if (cleanup.deletedCount !== 1 || cleanup.cookieCleanupFailures !== 0) throw new Error('VM_JOURNEY_FIXTURE_SOURCE_CLEANUP_FAILED');
    imported = await source.loadSources(undefined, true, current);
    requireCurrent();
    if (imported.some(row => row.sourceId === READER_VM_IMPORT_SOURCE)) throw new Error('VM_JOURNEY_FIXTURE_SOURCE_CLEANUP_UNCONFIRMED');
  }
  if (imported.length === 0) {
    const report = await source.importBookSourceDocument(JSON.stringify(expected), current);
    if (report.importedCount !== expected.length || report.failedCount !== 0) throw new Error('VM_JOURNEY_SOURCE_IMPORT_FAILED');
  } else if (imported.length !== expected.length) {
    throw new Error('VM_JOURNEY_FIXTURE_MISSING_SOURCE');
  }
  for (const definition of expected) {
    const row = await source.readSourceDefinition(String(definition['bookSourceUrl']), current);
    requireCurrent();
    if (row?.hasRawBookSource !== true || canonicalRulePayloadJson(JSON.parse(row.text) as JsonObject) !== canonicalRulePayloadJson(definition)) {
      throw new Error('VM_JOURNEY_SOURCE_DEFINITION_MISMATCH');
    }
  }
  await prepareReaderPublicLongBook(owner, fixture);
  const bookId = readerVmJourneyBookId(READER_VM_SHELF_SOURCE, READER_VM_SHELF_TITLE);
  for (const book of before.books) {
    if (book.sourceId === 'local' || (book.sourceId === READER_VM_SHELF_SOURCE && book.bookId === bookId)) continue;
    requireCurrent();
    await owner.request('bookshelf.remove', { sourceId: book.sourceId, bookId: book.bookId },
      { canDispatch: current, canContinue: current });
  }
  if (!before.books.some(book => book.sourceId === READER_VM_SHELF_SOURCE && book.bookId === bookId)) {
    requireCurrent();
    await owner.request('bookshelf.add', { sourceId: READER_VM_SHELF_SOURCE, bookId,
      title: READER_VM_SHELF_TITLE, author: READER_VM_AUTHOR, lastChapter: '第二章 校验' },
      { canDispatch: current, canContinue: current });
  }
  const after = await bookshelf.loadBookshelf({ limit: 16 }, current);
  requireCurrent();
  const localBook = after.books.find(book => book.sourceId === 'local' && book.title === READER_VM_LOCAL_TITLE);
  if (after.total !== 2 || !after.books.some(book => book.sourceId === READER_VM_SHELF_SOURCE && book.bookId === bookId &&
    book.contentKind === 'text') || localBook === undefined) {
    throw new Error('VM_JOURNEY_FIXTURE_BOOKSHELF_NOT_READY');
  }
  if (localBook.readingPosition === undefined) {
    const identity: JsonObject = { sourceId: 'local', bookId: localBook.bookId };
    const currentProgress = await owner.request('reading.progress.get', identity, { canDispatch: current, canContinue: current });
    requireCurrent();
    if (currentProgress.data['found'] === false) {
      const revision = currentProgress.data['progressRevision'];
      if (typeof revision !== 'string') throw new Error('VM_JOURNEY_FIXTURE_PROGRESS_REVISION_MISSING');
      // Seed a real location only for a fresh public book. Core determines
      // whether it has enough facts to project a whole-book percentage.
      const seeded = await owner.request('reading.progress.update', { ...identity, chapterIndex: 1,
        chapterOffset: 0, chapterProgress: 0, expectedProgressRevision: revision }, { canDispatch: current, canContinue: current });
      requireCurrent();
      if (seeded.data['stored'] !== true) throw new Error('VM_JOURNEY_FIXTURE_PROGRESS_NOT_STORED');
    }
  }
  owner.confirmPublicSearchHttpFixture(fixture);
  const session = await owner.bookAcquisitions().acquireBook({ sourceId: READER_VM_SHELF_SOURCE,
    bookId, detailUrl: bookId, title: READER_VM_SHELF_TITLE, author: READER_VM_AUTHOR, contentKind: 'text' }, { isCurrent: current });
  requireCurrent();
  if (session.entries.length !== 2) throw new Error('VM_JOURNEY_FIXTURE_CATALOG_NOT_READY');
}
