import { errorMessageOf } from '../../../app/ErrorMessage.ts';
import type { LocalReadingToc, LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { RemoteReadingSession } from './RemoteReadingFlowGateway';
import { sameRemoteSessionEvidence } from './RemoteReadingEvidence.ts';
import type { ReadingChapterWindow, ReadingSessionChapter } from './ReadingChapterWindow';

export interface ReadingCatalogRequest {
  isCurrent: () => boolean;
  load: () => Promise<LocalReadingToc>;
}

export interface ReadingCatalogHydrationHost {
  pending(): boolean;
  task(): Promise<void> | undefined;
  startRequest(): ReadingCatalogRequest;
  currentChapter(): ReadingSessionChapter | undefined;
  resumeOnlyChapterIndex(): number | undefined;
  installCatalog(entries: LocalReadingTocEntry[], current: ReadingSessionChapter): void;
  afterAdmitted(entries: LocalReadingTocEntry[]): void;
  track(operation: Promise<void>): void;
  fail(isCurrent: () => boolean): void;
  finish(operation: Promise<void>): void;
  resumePaging(): void;
}

export async function hydrateReadingEntryCatalog(window: ReadingChapterWindow, host: ReadingCatalogHydrationHost): Promise<void> {
  if (!host.pending()) return;
  const pending = host.task();
  if (pending !== undefined) return pending;
  const request = host.startRequest();
  const operation = request.load().then((toc: LocalReadingToc): void => {
    if (!request.isCurrent()) return;
    const current = host.currentChapter();
    if (current === undefined || !toc.entries.some((entry: LocalReadingTocEntry): boolean => entry.index === current.chapterIndex &&
      (entry.navigable !== false || entry.index === host.resumeOnlyChapterIndex()))) {
      throw new Error('READING_CATALOG_CURRENT_CHAPTER_MISSING');
    }
    const retained = retainedChapterBodies(window, undefined);
    host.installCatalog(toc.entries, current);
    readmitNeighbours(window, retained, current.chapterIndex);
    host.afterAdmitted(toc.entries);
  });
  host.track(operation);
  try { await operation; }
  catch (error) {
    host.fail(request.isCurrent);
    if (error instanceof Error) throw error;
    throw new Error(errorMessageOf(error));
  }
  finally {
    host.finish(operation);
  }
  if (request.isCurrent()) host.resumePaging();
}

export interface ReadingCatalogProtectedWindow {
  bodies: (ReadingSessionChapter | undefined)[];
  discardUnprotectedPreparations(): void;
}

export interface ReadingObservedCatalogHost {
  catalogPending(): boolean;
  currentToc(): LocalReadingTocEntry[];
  protectedWindow(): ReadingCatalogProtectedWindow;
  admitSession(): boolean;
  beginCatalogUpdate(): void;
  installCatalog(entries: LocalReadingTocEntry[], current: ReadingSessionChapter): void;
  afterAdmitted(): void;
}

/** An observed catalog may extend the mounted reader only if every live body keeps its address. */
export function admitObservedReadingCatalog(
  session: RemoteReadingSession,
  ownerSession: RemoteReadingSession | undefined,
  current: ReadingSessionChapter,
  sourceId: string,
  bookId: string,
  window: ReadingChapterWindow,
  host: ReadingObservedCatalogHost,
): void {
  const alreadyInstalled = sameRemoteSessionEvidence(ownerSession, session);
  // Matching gateway evidence can precede the matching mounted reader TOC.
  if (alreadyInstalled && !host.catalogPending() && host.currentToc().length === session.entries.length) return;
  if (alreadyInstalled) {
    if (host.currentToc().length > session.entries.length) return;
    for (let position = 0; position < host.currentToc().length; position += 1) {
      const before = host.currentToc()[position];
      const after = host.catalogPending() ? session.entries.find((item): boolean => item.index === before.index) : session.entries[position];
      if (after === undefined || before.index !== after.index || before.title !== after.title ||
        (before.navigable !== false) !== (after.url.trim().length > 0)) return;
    }
  }
  const protection = host.protectedWindow();
  const protectedIndexes = new Set<number>();
  for (const body of protection.bodies) {
    if (body === undefined) continue;
    const entry = session.entries.find((item): boolean => item.index === body.chapterIndex);
    if (body.sourceId !== sourceId || body.bookId !== bookId || entry === undefined ||
      entry.url.trim().length === 0 || body.chapterUrl !== entry.url ||
      (alreadyInstalled && body.chapterTitle !== entry.title)) return;
    protectedIndexes.add(body.chapterIndex);
  }
  if (!host.admitSession()) return;
  const retained = retainedChapterBodies(window, alreadyInstalled ? protectedIndexes : undefined);
  if (alreadyInstalled) protection.discardUnprotectedPreparations();
  host.beginCatalogUpdate();
  host.installCatalog(session.entries.map((item): LocalReadingTocEntry => ({ index: item.index,
    title: item.title, displayTitle: item.displayTitle, isVip: item.isVip, isPay: item.isPay,
    contextTitle: item.contextTitle, level: item.level,
    navigable: item.navigable !== false && item.url.trim().length > 0, downloadState: 'unknown' })), current);
  readmitNeighbours(window, retained, current.chapterIndex);
  host.afterAdmitted();
}

function retainedChapterBodies(window: ReadingChapterWindow, protectedIndexes: ReadonlySet<number> | undefined):
  (ReadingSessionChapter | undefined)[] {
  const indexes = window.retainedChapterIndexes();
  const retained = protectedIndexes === undefined ? indexes : indexes.filter((index: number): boolean => protectedIndexes.has(index));
  return retained.map((index: number): ReadingSessionChapter | undefined => window.get(index));
}

function readmitNeighbours(window: ReadingChapterWindow, retained: (ReadingSessionChapter | undefined)[],
  currentChapterIndex: number): void {
  for (const chapter of retained) {
    if (chapter !== undefined && chapter.chapterIndex !== currentChapterIndex) window.admitNeighbour(chapter);
  }
}
