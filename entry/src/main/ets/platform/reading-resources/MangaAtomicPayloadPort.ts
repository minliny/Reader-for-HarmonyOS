export type MangaAtomicPayloadReader = (path: string, expectedBytes: number, maximumBytes: number,
  current: () => boolean, metadata?: boolean) => Promise<Uint8Array>;

// ETS owns the official Concurrent worker. TS consumers depend only on this
// typed port, installed once by the Ability before Runtime creation. The stable
// module function captures no Ability/context and stays bound for the process.
let mangaAtomicPayloadReader: MangaAtomicPayloadReader | undefined;

export function bindMangaAtomicPayloadReader(reader: MangaAtomicPayloadReader): void {
  if (mangaAtomicPayloadReader !== undefined && mangaAtomicPayloadReader !== reader)
    throw new Error('MANGA_ATOMIC_READER_ALREADY_INSTALLED');
  mangaAtomicPayloadReader = reader;
}

export async function readMangaAtomicPayload(path: string, expectedBytes: number, maximumBytes: number,
  current: () => boolean, metadata: boolean = false): Promise<Uint8Array> {
  const reader = mangaAtomicPayloadReader;
  if (reader === undefined) throw new Error('MANGA_ATOMIC_READER_UNAVAILABLE');
  return reader(path, expectedBytes, maximumBytes, current, metadata);
}
