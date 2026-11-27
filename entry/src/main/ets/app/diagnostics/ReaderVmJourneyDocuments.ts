import fileIo from '@ohos.file.fs';
import fileUri from '@ohos.file.fileuri';
import util from '@ohos.util';
import { readerHostCacheDirectory, readerVmJourneyFixtureActive } from './ReaderPublicFixtureScope';

let admittedCache: string | undefined;
let directory: Promise<string> | undefined;
const ARCHIVE = 'roundtrip.readerbackup';

export function enableReaderVmJourneyDocuments(cacheDir: string): void {
  if (!readerVmJourneyFixtureActive() || !cacheDir.startsWith('/data/storage/el4/')) {
    throw new Error('VM journey documents require the admitted isolated fixture');
  }
  admittedCache = readerHostCacheDirectory(cacheDir);
}

export function readerVmJourneyDocumentsEnabled(): boolean {
  return admittedCache !== undefined;
}

function journeyDirectory(cacheDir: string): Promise<string> {
  if (admittedCache === undefined || !readerVmJourneyFixtureActive() || readerHostCacheDirectory(cacheDir) !== admittedCache) {
    throw new Error('VM journey document scope changed');
  }
  if (directory === undefined) {
    const parent = admittedCache;
    directory = (async (): Promise<string> => {
      const stat = await fileIo.lstat(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('VM journey cache is not an isolated directory');
      const path = `${parent}/documents-${util.generateRandomUUID()}`;
      await fileIo.mkdir(path);
      return path;
    })();
  }
  return directory;
}

/** Fixed app-private selection used only when the isolated Debug journey is explicitly armed. */
export async function readerVmJourneyRecoveryDocument(cacheDir: string, save: boolean): Promise<string> {
  const path = `${await journeyDirectory(cacheDir)}/${ARCHIVE}`;
  if (!save || await fileIo.access(path)) {
    const stat = await fileIo.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('VM recovery fixture archive is not a regular file');
  }
  return path;
}

export async function readerVmJourneyInvalidBookUri(cacheDir: string): Promise<string> {
  const path = `${await journeyDirectory(cacheDir)}/invalid.epub`;
  if (!await fileIo.access(path)) {
    const bytes = new util.TextEncoder('utf-8').encodeInto('Reader J14 fixture. Deliberately invalid EPUB.');
    const file = await fileIo.open(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.WRITE_ONLY);
    try {
      if (await fileIo.write(file.fd, bytes.buffer) !== bytes.length) throw new Error('VM invalid book fixture was not written');
    } finally { await fileIo.close(file); }
  }
  const stat = await fileIo.lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('VM invalid book fixture is not a regular file');
  return fileUri.getUriFromPath(path);
}
