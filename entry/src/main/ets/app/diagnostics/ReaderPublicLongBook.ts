import cryptoFramework from '@ohos.security.cryptoFramework';
import fileIo from '@ohos.file.fs';
import fileUri from '@ohos.file.fileuri';
import util from '@ohos.util';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderCoreGateway, type BookshelfState } from '../ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import { LocalBookImportGateway } from '../../features/bookshelf/application/LocalBookImportGateway';
import { SourceGateway } from '../../features/source/application/SourceGateway';
import { buildReaderPublicFixtureDirectory, isReaderNamedPublicFixture, type ReaderPublicFixtureScope } from './ReaderPublicFixtureScope';

interface PublicLocalBook {
  rawFile: string;
  title: string;
  bytes: number;
  sha256: string;
}

const LONG_BOOK: PublicLocalBook = {
  rawFile: 'reader-public-fixture-long-book-v1.txt', title: 'Reader Phase 1 公共长目录', bytes: 3362,
  sha256: '27792a0e5906b59c33ecf8fd5a9984654aadbdcf46d668dd61ad7a6a623b48df',
};

const SCROLLED_BOOKS: PublicLocalBook[] = [
  { rawFile: 'reader-public-fixture-scroll-book-01-v1.txt', title: '移窗样本 01', bytes: 312,
    sha256: '3ee0881a76f041b20fd3d05ef582715aedde000dcb81cf98cd1a19c02fd62680' },
  { rawFile: 'reader-public-fixture-scroll-book-02-v1.txt', title: '移窗样本 02', bytes: 312,
    sha256: '595b444a55174f40e69ef1b6fd0d1868f795f3391cb907169bb522e34c3e1f47' },
  { rawFile: 'reader-public-fixture-scroll-book-03-v1.txt', title: '移窗样本 03', bytes: 312,
    sha256: '9e77ad763cb93d80ae2e7336da88c8a702724de4073f7a8646737378c73e11ba' },
  { rawFile: 'reader-public-fixture-scroll-book-04-v1.txt', title: '移窗样本 04', bytes: 312,
    sha256: '16c8cf3128ca68ba46db046d4f6c35cbb4041c752b74add324fa6b1ef784736c' },
  { rawFile: 'reader-public-fixture-scroll-book-05-v1.txt', title: '移窗样本 05', bytes: 312,
    sha256: '2399aa0212b1e2835adb7be48ea36fb08a2fc9303e43f68d3cceffcd58a54d7d' },
  { rawFile: 'reader-public-fixture-scroll-book-06-v1.txt', title: '移窗样本 06', bytes: 312,
    sha256: '59469dd01500ac97e4113b6993b2784073b0bddc1c830e2faf4475699e32f5d1' },
  { rawFile: 'reader-public-fixture-scroll-book-07-v1.txt', title: '移窗样本 07', bytes: 312,
    sha256: '77e95d00a45d220186826b88e348327f57e6d287aad52354f2b7de5ded62ca82' },
  { rawFile: 'reader-public-fixture-scroll-book-08-v1.txt', title: '终点移窗样本', bytes: 312,
    sha256: '8553f20ea726719f7e663dd61d49c0d2b3544bc9e1e60348160319f8b77dd229' },
];

/** Staging and import still use the ordinary local-file and Core owners. */
export async function prepareReaderPublicLongBook(owner: ReaderRuntimeOwner, fixture: ReaderPublicFixtureScope): Promise<void> {
  const current = (): boolean => fixture.kind === 'fixture' && fixture.id !== 'search-detail-scroll-corpus' &&
    (fixture.id === 'empty-sources' || isReaderNamedPublicFixture(fixture.id)) && owner.isCurrentPublicFixture(fixture);
  await preparePublicBooks(owner, fixture, [LONG_BOOK], fixture.id === 'empty-sources', current);
}

export async function prepareReaderPublicScrolledBooks(owner: ReaderRuntimeOwner, fixture: ReaderPublicFixtureScope): Promise<void> {
  const current = (): boolean => fixture.kind === 'fixture' && fixture.id === 'search-detail-scroll-corpus' &&
    owner.isCurrentPublicFixture(fixture);
  await preparePublicBooks(owner, fixture, SCROLLED_BOOKS, true, current);
}

async function preparePublicBooks(owner: ReaderRuntimeOwner, fixture: ReaderPublicFixtureScope,
  books: PublicLocalBook[], requireEmptySources: boolean, current: () => boolean): Promise<void> {
  if (!current()) throw new Error('PUBLIC_LONG_BOOK_SCOPE_NOT_CURRENT');
  const context = owner.getUIAbilityContext();
  const root = buildReaderPublicFixtureDirectory(context.filesDir, fixture.id);
  if (root === undefined || !(await fileIo.lstat(root.slice(0, root.lastIndexOf('/')))).isDirectory() ||
    !(await fileIo.lstat(root)).isDirectory()) throw new Error('PUBLIC_LONG_BOOK_DIRECTORY_NOT_ISOLATED');

  // Check every packaged file before the first import.
  const resources: Uint8Array[] = [];
  for (const book of books) {
    const bytes = (await context.resourceManager.getRawFileContent(book.rawFile)).slice();
    await requireBookBytes(bytes, book);
    resources.push(bytes);
  }
  if (requireEmptySources) {
    const sources = await new SourceGateway(owner).loadSources(undefined, false, current);
    if (!current()) throw new Error('PUBLIC_LONG_BOOK_SCOPE_NOT_CURRENT');
    if (sources.length !== 0) throw new Error('PUBLIC_LONG_BOOK_EXPECTED_EMPTY_SOURCES');
  }

  const bookshelf = new ReaderCoreGateway(owner);
  const readShelf = (): Promise<BookshelfState> => bookshelf.loadBookshelf({ limit: books.length + 1 }, current);
  const before = await readShelf();
  requireBookPrefix(before, books);
  for (const book of books.slice(0, before.total)) {
    await verifyImportedBook(owner, book, root, current);
  }
  if (before.total === books.length) return;
  for (let index = before.total; index < books.length; index += 1) {
    const book = books[index];
    const retained = await owner.retainedLocalBookSourcePath(bookId(book), current);
    if (retained !== undefined) await verifyRetainedBook(retained, root, book);
    if (!current()) throw new Error('PUBLIC_LONG_BOOK_SCOPE_NOT_CURRENT');
    await importBook(owner, root, book, resources[index], current);
    await verifyImportedBook(owner, book, root, current);
  }
  const final = await readShelf();
  requireBookPrefix(final, books);
  if (final.total !== books.length || !current()) throw new Error('PUBLIC_LONG_BOOK_UNEXPECTED_BOOKSHELF');
}

function bookId(book: PublicLocalBook): string { return `local:${book.sha256}`; }

function requireBookPrefix(state: BookshelfState, books: PublicLocalBook[]): void {
  if (state.total !== state.books.length || state.total > books.length) throw new Error('PUBLIC_LONG_BOOK_UNEXPECTED_BOOKSHELF');
  const expected = new Map<string, string>();
  for (const book of books.slice(0, state.total)) expected.set(bookId(book), book.title);
  for (const book of state.books) {
    if (book.sourceId !== 'local' || expected.get(book.bookId) !== book.title) {
      throw new Error('PUBLIC_LONG_BOOK_UNEXPECTED_BOOKSHELF');
    }
    expected.delete(book.bookId);
  }
}

async function verifyImportedBook(owner: ReaderRuntimeOwner, book: PublicLocalBook, root: string,
  current: () => boolean): Promise<void> {
  const id = bookId(book);
  const presentation = await owner.request('local_book.presentation.kind.v1', { bookId: id },
    { canDispatch: current, canContinue: current });
  const kind = presentation.data;
  if (kind['sourceId'] !== 'local' || kind['bookId'] !== id || kind['kind'] !== 'text' ||
    kind['format'] !== 'txt' || kind['reimportRequired'] !== false) {
    throw new Error('PUBLIC_LONG_BOOK_UNEXPECTED_PRESENTATION');
  }
  await verifyRetainedBook(await owner.retainedLocalBookSourcePath(id, current), root, book);
  if (!current()) throw new Error('PUBLIC_LONG_BOOK_SCOPE_NOT_CURRENT');
}

async function importBook(owner: ReaderRuntimeOwner, root: string, book: PublicLocalBook, bytes: Uint8Array,
  current: () => boolean): Promise<void> {
  // The directory belongs to this call from its exclusive mkdir onward.
  const directory = `${root}/long-book-input-${util.generateRandomUUID()}`;
  await fileIo.mkdir(directory);
  const fileName = `${book.title}.txt`;
  const path = `${directory}/${fileName}`;
  let importFailed = false;
  try {
    const file = await fileIo.open(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.WRITE_ONLY);
    let writeFailed = false;
    try {
      if (await fileIo.write(file.fd, bytes.buffer as ArrayBuffer) !== book.bytes) {
        throw new Error('PUBLIC_LONG_BOOK_INPUT_WRITE_INCOMPLETE');
      }
    } catch (error) {
      writeFailed = true;
      throw error;
    } finally {
      await closeBookFile(file, writeFailed);
    }
    if (!current()) throw new Error('PUBLIC_LONG_BOOK_SCOPE_NOT_CURRENT');
    const selection = await owner.prepareSystemLocalBookInput(fileUri.getUriFromPath(path));
    if (selection.state !== 'ready' || !selection.input.stagedPath.startsWith(`${root}/reader-import/staging/`)) {
      throw new Error('PUBLIC_LONG_BOOK_STAGING_NOT_ISOLATED');
    }
    const importer = new LocalBookImportGateway(owner);
    if (selection.input.bookId !== bookId(book) || selection.input.fileName !== fileName || !current()) {
      await importer.releaseUnusedSelections([selection]);
      throw new Error('PUBLIC_LONG_BOOK_STAGED_IDENTITY_MISMATCH');
    }
    const batch = await importer.importPreparedSelections([selection]);
    if (batch.state !== 'completed' || batch.imported !== 1 || batch.failed !== 0 || batch.items.length !== 1 ||
      batch.items[0].disposition !== 'created') throw new Error('PUBLIC_LONG_BOOK_IMPORT_NOT_CONFIRMED');
  } catch (error) {
    importFailed = true;
    throw error;
  } finally {
    // Only this call's exclusively created input directory belongs here.
    try { await fileIo.rmdir(directory); }
    catch (error) {
      const code = (error as { code?: number | string } | undefined)?.code;
      if (code !== 13900002 && code !== 'ENOENT') {
        if (!importFailed) throw error;
        hilog.warn(0x5244, 'Reader', 'Public long-book fixture input cleanup failed');
      }
    }
  }
}

async function requireBookBytes(bytes: Uint8Array, book: PublicLocalBook): Promise<void> {
  if (bytes.byteLength !== book.bytes) throw new Error('PUBLIC_LONG_BOOK_BYTE_COUNT_MISMATCH');
  const digest = cryptoFramework.createMd('SHA256');
  await digest.update({ data: bytes });
  const result = await digest.digest();
  const sha256 = Array.from(result.data, byte => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== book.sha256) throw new Error('PUBLIC_LONG_BOOK_DIGEST_MISMATCH');
}

async function verifyRetainedBook(path: string | undefined, root: string, book: PublicLocalBook): Promise<void> {
  if (path !== `${root}/reader-import/books/${book.sha256}.source`) {
    throw new Error('PUBLIC_LONG_BOOK_ARCHIVE_NOT_ISOLATED');
  }
  await requireBookBytes(await readBookBytes(path, book.bytes), book);
}

async function readBookBytes(path: string, expectedBytes: number): Promise<Uint8Array> {
  const stat = await fileIo.lstat(path);
  if (!stat.isFile() || stat.size !== expectedBytes) throw new Error('PUBLIC_LONG_BOOK_ARCHIVE_INVALID');
  const bytes = new Uint8Array(expectedBytes);
  const file = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
  let readFailed = false;
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const chunk = new ArrayBuffer(bytes.length - offset);
      const read = await fileIo.read(file.fd, chunk);
      if (read <= 0 || read > chunk.byteLength) throw new Error('PUBLIC_LONG_BOOK_ARCHIVE_INCOMPLETE');
      bytes.set(new Uint8Array(chunk, 0, read), offset);
      offset += read;
    }
  } catch (error) {
    readFailed = true;
    throw error;
  } finally {
    await closeBookFile(file, readFailed);
  }
  return bytes;
}

async function closeBookFile(file: fileIo.File, operationFailed: boolean): Promise<void> {
  try { await fileIo.close(file); }
  catch (error) {
    if (!operationFailed) throw error;
    hilog.warn(0x5244, 'Reader', 'Public long-book fixture file close failed');
  }
}
