import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReadingEntryHandoff, registerReadingEntryMemoryRelease, estimateRetainedRemoteSessionBytes } from '../application/ReadingEntryHandoff';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingEntryNavigation } from '../application/ReadingEntrySnapshot';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReadingCommit } from '../application/ReadingCommit';
import { ReadingPaginationPrefix, type ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import type { RemoteReadingSession } from '../application/RemoteReadingFlowGateway';
import { ReadingSessionFlowGateway } from '../application/ReadingSessionFlowGateway';
import type { PhysicalReadingPage } from '../ui/ReadingMeasurementModels';
import { ReaderMaterializedChapterContext, ReaderRetainedPresentation } from './ReaderPagePresentationModels';

/** One optional retained lease registry per original Runtime; no second gateway or progress owner. */
const readingEntryHandoffs: WeakMap<ReaderRuntimeOwner, ReadingEntryHandoff<ReaderRetainedPresentation>> = new WeakMap();

export function readingEntryHandoff(owner: ReaderRuntimeOwner): ReadingEntryHandoff<ReaderRetainedPresentation> {
  let handoff = readingEntryHandoffs.get(owner);
  if (handoff === undefined) {
    handoff = new ReadingEntryHandoff<ReaderRetainedPresentation>();
    readingEntryHandoffs.set(owner, handoff);
    const retained = handoff;
    registerReadingEntryMemoryRelease(owner, (): void => retained.clear());
  }
  return handoff;
}

export function readerEntryPresentation(sourceId: string, bookId: string): ReaderRetainedPresentation | undefined {
  const owner = ReaderRuntimeOwner.current();
  if (!owner.optionalReadingEntryMemoryEnabled()) return undefined;
  return readingEntryHandoff(owner).current(sourceId, bookId);
}

export class ReaderRetainedPageInput {
  readonly owner: ReaderRuntimeOwner;
  readonly handoff: ReadingEntryHandoff<ReaderRetainedPresentation>;
  readonly page: PhysicalReadingPage;
  readonly chapter: ReadingSessionChapter;
  readonly progress: ReadingCommit;
  readonly gateway: ReadingSessionFlowGateway;
  readonly sourceId: string;
  readonly bookId: string;
  readonly toc: LocalReadingTocEntry[];
  readonly paragraphCount: number;
  readonly captureContext: () => ReaderMaterializedChapterContext;
  readonly matchesCurrentPagination: (key: ReadingPaginationKey) => boolean;
  readonly appearanceKey: () => string;
  readonly settingsKey: () => string;
  readonly layoutKey: () => string;
  readonly densityPixels: () => number;
  readonly navigation: ReadingEntryNavigation | undefined;
  readonly catalogPending: boolean;

  constructor(
    owner: ReaderRuntimeOwner,
    handoff: ReadingEntryHandoff<ReaderRetainedPresentation>,
    page: PhysicalReadingPage,
    chapter: ReadingSessionChapter,
    progress: ReadingCommit,
    gateway: ReadingSessionFlowGateway,
    sourceId: string,
    bookId: string,
    toc: LocalReadingTocEntry[],
    paragraphCount: number,
    captureContext: () => ReaderMaterializedChapterContext,
    matchesCurrentPagination: (key: ReadingPaginationKey) => boolean,
    appearanceKey: () => string,
    settingsKey: () => string,
    layoutKey: () => string,
    densityPixels: () => number,
    navigation: ReadingEntryNavigation | undefined,
    catalogPending: boolean,
  ) {
    this.owner = owner;
    this.handoff = handoff;
    this.page = page;
    this.chapter = chapter;
    this.progress = progress;
    this.gateway = gateway;
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.toc = toc;
    this.paragraphCount = paragraphCount;
    this.captureContext = captureContext;
    this.matchesCurrentPagination = matchesCurrentPagination;
    this.appearanceKey = appearanceKey;
    this.settingsKey = settingsKey;
    this.layoutKey = layoutKey;
    this.densityPixels = densityPixels;
    this.navigation = navigation;
    this.catalogPending = catalogPending;
  }
}

/** Publish only the confirmed page and budgeted text/catalog it owns. */
export function retainConfirmedReadingPage(input: ReaderRetainedPageInput): void {
  const owner = input.owner, handoff = input.handoff;
  const page = input.page, chapter = input.chapter, progress = input.progress;
  // Optional retention cannot first copy/serialize an arbitrarily large
  // catalog and only then discover that it exceeds the resource budget.
  const byteLimit = 16 * 1024 * 1024;
  if (chapter.content.length * 12 > byteLimit || input.paragraphCount > 4096 ||
    input.toc.length > 4096 || page.fragments.length > 1024) return;
  let retainedBytes = chapter.content.length * 12 + input.paragraphCount * 96 + 256;
  for (const entry of input.toc) {
    retainedBytes += entry.title.length * 2 + 128;
    if (retainedBytes > byteLimit) return;
  }
  const nativeRecipeKeys = new Set<string>();
  for (const fragment of page.fragments) {
    for (const recipe of [fragment.nativeParagraph, fragment.nativeTitle]) {
      if (recipe !== undefined && !nativeRecipeKeys.has(recipe.key)) {
        nativeRecipeKeys.add(recipe.key);
        retainedBytes += recipe.text.length * 2 + 256;
      }
    }
    retainedBytes += fragment.text.length * 2 + 128;
    if (retainedBytes > byteLimit) return;
  }
  const remote = input.gateway.remoteSession();
  if (remote !== undefined) {
    const remoteBytes = estimateRetainedRemoteSessionBytes(remote, byteLimit - retainedBytes);
    if (remoteBytes === undefined) return;
    retainedBytes += remoteBytes;
  }
  const context = input.captureContext();
  const observation = page.paginationObservation;
  const key = page.paginationKey;
  if (key === undefined || observation === undefined || !input.matchesCurrentPagination(key) ||
    observation.startScalar !== page.startScalar || observation.endScalarExclusive !== page.endScalar) return;
  const retainedContext = new ReaderMaterializedChapterContext(chapter, context.layoutMap,
    context.contentVersion, context.paragraphRanges, new ReadingPaginationPrefix(key, observation), page.startScalar,
    progress.chapterProgress, observation.requestScalar);
  // Bookmark annotations have their own read lifecycle; they are not part of
  // the content/position lease used to keep this real page alive.
  const retainedToc = input.toc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
    index: entry.index, title: entry.title, downloadState: entry.downloadState, navigable: entry.navigable,
    displayTitle: entry.displayTitle, isVip: entry.isVip, isPay: entry.isPay, contextTitle: entry.contextTitle,
    level: entry.level,
  }));
  let retainedGateway = input.gateway;
  if (remote !== undefined) {
    // The consumed acquisition snapshot can still contain a different
    // chapter and images. Retain only its catalog, accounted separately.
    const retainedRemote: RemoteReadingSession = {
      identity: remote.identity, acquisitionMode: remote.acquisitionMode, detailUrl: remote.detailUrl,
      tocUrl: remote.tocUrl, book: remote.book, continuationVariables: remote.continuationVariables,
      entries: remote.entries, hostRequirements: remote.hostRequirements, sourceVersion: remote.sourceVersion,
      catalogAt: remote.catalogAt, catalogVersion: remote.catalogVersion, contextVersion: remote.contextVersion,
      requiresContextRefresh: remote.requiresContextRefresh, refreshRecommended: remote.refreshRecommended,
    };
    retainedGateway = new ReadingSessionFlowGateway(input.sourceId, input.bookId,
      { kind: 'remote', session: retainedRemote }, owner);
  }
  const valid = owner.readingEntryPreparations().captureValidity(input.sourceId, input.bookId);
  const snapshot = new ReaderRetainedPresentation(input.sourceId, input.bookId, retainedGateway,
    retainedContext, page, retainedToc, progress, input.appearanceKey(),
    input.settingsKey(), input.layoutKey(),
    input.densityPixels(), valid, input.navigation, input.catalogPending);
  handoff.publish(input.sourceId, input.bookId, snapshot, retainedBytes, valid);
}
