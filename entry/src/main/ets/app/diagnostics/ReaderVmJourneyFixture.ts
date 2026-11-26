import type { JsonObject } from '@reader/core-harmony';
import { ReaderCoreGateway } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import { SourceGateway } from '../../features/source/application/SourceGateway';
import { canonicalRulePayloadJson } from '../BundledBookSourceSupply';
import { prepareReaderPublicLongBook } from './ReaderPublicLongBook';
import type { ReaderPublicFixtureScope } from './ReaderPublicFixtureScope';
import { READER_VM_AUTHOR, READER_VM_JOURNEY_SCOPE, READER_VM_LOCAL_TITLE, READER_VM_SHELF_SOURCE,
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
  const imported = await source.loadSources(undefined, true, current);
  requireCurrent();
  if (imported.some(row => !expected.some(definition => definition['bookSourceUrl'] === row.sourceId))) {
    throw new Error('VM_JOURNEY_FIXTURE_UNEXPECTED_SOURCES');
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
  if (after.total !== 2 || !after.books.some(book => book.sourceId === READER_VM_SHELF_SOURCE && book.bookId === bookId &&
    book.contentKind === 'text') || !after.books.some(book => book.sourceId === 'local' && book.title === READER_VM_LOCAL_TITLE)) {
    throw new Error('VM_JOURNEY_FIXTURE_BOOKSHELF_NOT_READY');
  }
  owner.confirmPublicSearchHttpFixture(fixture);
  const session = await owner.bookAcquisitions().acquireBook({ sourceId: READER_VM_SHELF_SOURCE,
    bookId, detailUrl: bookId, title: READER_VM_SHELF_TITLE, author: READER_VM_AUTHOR, contentKind: 'text' }, { isCurrent: current });
  requireCurrent();
  if (session.entries.length !== 2) throw new Error('VM_JOURNEY_FIXTURE_CATALOG_NOT_READY');
}
