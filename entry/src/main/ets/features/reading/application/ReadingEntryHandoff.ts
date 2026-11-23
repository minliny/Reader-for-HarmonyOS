import type { RemoteReadingSession } from './RemoteReadingFlowGateway';
import type { RemoteReadingVariable } from './RemoteReadingContract';

/** One optional, confirmed reading handoff. This is not a persistent resume
 * cache or a general eviction policy; dropping it never prevents normal entry. */
export class ReadingEntryHandoff<T> {
  private sourceId: string = '';
  private bookId: string = '';
  private value: T | undefined = undefined;
  private valid: (() => boolean) | undefined = undefined;

  publish(sourceId: string, bookId: string, value: T, retainedBytes: number,
    valid: () => boolean): boolean {
    this.clear();
    // Includes the chapter's scalar map/ranges, not just displayed characters.
    // This caps retained optional data, not the active reading working set.
    if (!Number.isSafeInteger(retainedBytes) || retainedBytes < 0 ||
      retainedBytes > 16 * 1024 * 1024 || !valid()) return false;
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.value = value;
    this.valid = valid;
    return true;
  }

  current(sourceId: string, bookId: string): T | undefined {
    if (this.valid?.() !== true) { this.clear(); return undefined; }
    return sourceId === this.sourceId && bookId === this.bookId ? this.value : undefined;
  }

  clear(): void {
    this.value = undefined;
    this.valid = undefined;
    this.sourceId = '';
    this.bookId = '';
  }
}

/** Account only the catalog facts retained by the handoff, without serializing
 * source variables or walking an unbounded catalog on the normal exit path. */
export function estimateRetainedRemoteSessionBytes(session: RemoteReadingSession,
  limit: number): number | undefined {
  if (session.entries.length > 4096 || session.continuationVariables.length > 4096) return undefined;
  let bytes = 512;
  let remainingItems = 8192;
  const countStrings = (values: (string | undefined)[]): void => {
    for (const value of values) bytes += (value?.length ?? 0) * 2 + 32;
  };
  const countVariables = (variables: RemoteReadingVariable[]): boolean => {
    if (variables.length > remainingItems) return false;
    remainingItems -= variables.length;
    for (const variable of variables) {
      countStrings([variable.name, variable.value]);
      if (bytes > limit) return false;
    }
    return true;
  };
  const book = session.book;
  countStrings([session.identity.sourceId, session.identity.bookId, session.detailUrl, session.tocUrl,
    session.sourceVersion, session.catalogVersion, session.contextVersion, book.title, book.author,
    book.coverUrl, book.intro, book.kind, book.lastChapter]);
  const proof = book.authorIdentity;
  if (proof !== undefined) countStrings([proof.sourceVersion, proof.field, proof.raw, proof.label, proof.rule]);
  bytes += (session.hostRequirements?.length ?? 0) * 128;
  if (bytes > limit || !countVariables(session.continuationVariables)) return undefined;
  for (const entry of session.entries) {
    if (--remainingItems < 0) return undefined;
    bytes += 128;
    countStrings([entry.title, entry.url]);
    if (bytes > limit || !countVariables(entry.variables)) return undefined;
  }
  return bytes;
}

// Runtime/ability cleanup does not import the reading component or own its UI.
const memoryReleases: WeakMap<object, Set<() => void>> = new WeakMap();
export function registerReadingEntryMemoryRelease(owner: object, release: () => void): void {
  let releases = memoryReleases.get(owner);
  if (releases === undefined) { releases = new Set(); memoryReleases.set(owner, releases); }
  releases.add(release);
}
export function releaseReadingEntryMemory(owner: object): void {
  const releases = memoryReleases.get(owner);
  if (releases !== undefined) for (const release of releases) release();
}
