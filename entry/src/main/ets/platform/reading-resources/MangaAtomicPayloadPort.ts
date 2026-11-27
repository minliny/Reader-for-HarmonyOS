export type AtomicPayloadMetadata = boolean | 'text-manifest';

export type MangaAtomicPayloadReader = (path: string, expectedBytes: number, maximumBytes: number,
  current: () => boolean, metadata?: AtomicPayloadMetadata) => Promise<Uint8Array>;

// ETS owns the official Concurrent worker for reading-cache images and manifests.
// The Ability installs this typed port before Runtime creation. The binding
// captures no Ability context and stays bound for the process.
let mangaAtomicPayloadReader: MangaAtomicPayloadReader | undefined;

export function bindMangaAtomicPayloadReader(reader: MangaAtomicPayloadReader): void {
  if (mangaAtomicPayloadReader !== undefined && mangaAtomicPayloadReader !== reader)
    throw new Error('MANGA_ATOMIC_READER_ALREADY_INSTALLED');
  mangaAtomicPayloadReader = reader;
}

export async function readMangaAtomicPayload(path: string, expectedBytes: number, maximumBytes: number,
  current: () => boolean, metadata: AtomicPayloadMetadata = false): Promise<Uint8Array> {
  const reader = mangaAtomicPayloadReader;
  if (reader === undefined) throw new Error('MANGA_ATOMIC_READER_UNAVAILABLE');
  return reader(path, expectedBytes, maximumBytes, current, metadata);
}
