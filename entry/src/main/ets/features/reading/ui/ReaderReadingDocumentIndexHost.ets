import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReadingChapterWindow } from '../application/ReadingChapterWindow';
import { createCoreReadingLayout, type CoreReadingLayout } from '../application/ReadingMeasurementFacts';
import type { ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import { readableReaderDirectoryEntries, readerDirectoryEntryRanks } from '../presentation/ReaderDirectoryProjection';
import { KnownReadingContentVersion } from '../presentation/ReaderPagePresentationModels';
import { createNativeReadingPaginationLayoutSignature, readerAppearanceFontScale,
  readerAppearanceLineHeight } from './ReaderAppearanceRenderStyle';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { ReaderReadingImageResidencyHost } from './ReaderReadingImageResidencyHost';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingViewportHost } from './ReaderReadingSurfaceHost';

export interface ReaderReadingDocumentIdentity {
  readonly sourceId: string;
  readonly bookId: string;
}

export interface ReaderReadingDocumentIndexView {
  readonly identity: () => ReaderReadingDocumentIdentity;
  readonly appearance: () => ReaderAppearanceSnapshot;
  readonly toc: () => LocalReadingTocEntry[];
}

/** Connects the mounted chapter window and measured layout to their exact
 * content/layout keys. Directory ranks and known versions follow the same
 * window and physical index through each ready frame and replacement. */
export class ReaderReadingDocumentIndexHost {
  private readonly window: ReadingChapterWindow;
  private readonly measured: ReaderMeasuredPagePublication;
  private readonly mount: ReaderReadingMountHost;
  private readonly viewport: ReaderReadingViewportHost;
  private readonly images: ReaderReadingImageResidencyHost;
  private readonly view: ReaderReadingDocumentIndexView;
  private readonly knownContentVersions: KnownReadingContentVersion[] = [];
  private tocSource: LocalReadingTocEntry[] | undefined = undefined;
  private tocProjection: LocalReadingTocEntry[] = [];
  private tocRanks: Map<number, number> = new Map<number, number>();

  constructor(window: ReadingChapterWindow, measured: ReaderMeasuredPagePublication, mount: ReaderReadingMountHost,
    viewport: ReaderReadingViewportHost, images: ReaderReadingImageResidencyHost, view: ReaderReadingDocumentIndexView) {
    this.window = window;
    this.measured = measured;
    this.mount = mount;
    this.viewport = viewport;
    this.images = images;
    this.view = view;
  }

  coreLayout(): CoreReadingLayout {
    const layout = this.viewport.readingLayout();
    return createCoreReadingLayout(
      layout.viewportWidth,
      layout.viewportHeight,
      readerAppearanceFontScale(this.view.appearance()) * layout.systemFontScale,
      readerAppearanceLineHeight(this.view.appearance()),
    );
  }

  paginationLayoutSignature(): string {
    const layout = this.viewport.readingLayout();
    return createNativeReadingPaginationLayoutSignature(layout, this.view.appearance(), this.measured.nativeMeasurement.punctuationOverflow);
  }

  currentPaginationKey(): ReadingPaginationKey {
    const chapter = this.measured.requireChapter();
    if (this.measured.materializedContentVersion.length === 0) throw new Error('READING_CONTENT_VERSION_NOT_READY');
    const identity = this.view.identity();
    return {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      chapterIndex: chapter.chapterIndex,
      layoutSignature: this.paginationLayoutSignature(),
      contentVersion: this.measured.materializedContentVersion,
    };
  }

  paginationKeyForChapter(chapterIndex: number): ReadingPaginationKey | undefined {
    const chapter = this.window.get(chapterIndex);
    const contentVersion = chapter?.contentVersion ?? this.knownContentVersion(chapterIndex);
    if (contentVersion === undefined) return undefined;
    const identity = this.view.identity();
    return {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      chapterIndex,
      layoutSignature: this.paginationLayoutSignature(),
      contentVersion,
    };
  }

  admitChapterContentVersion(chapterIndex: number, contentVersion: string): void {
    for (const known of this.knownContentVersions) {
      if (known.chapterIndex !== chapterIndex) continue;
      if (known.contentVersion !== contentVersion) {
        // A replaced body invalidates every physical layout of that chapter.
        const identity = this.view.identity();
        this.measured.physicalPagination.index.invalidateChapter(identity.sourceId, identity.bookId, chapterIndex);
        known.contentVersion = contentVersion;
        this.measured.resetPaginationDraft();
      }
      return;
    }
    this.knownContentVersions.push(new KnownReadingContentVersion(chapterIndex, contentVersion));
  }

  knownContentVersion(chapterIndex: number): string | undefined {
    for (const known of this.knownContentVersions) {
      if (known.chapterIndex === chapterIndex) return known.contentVersion;
    }
    return undefined;
  }

  retainCurrentChapterWindow(): void {
    const retained = this.window.retainedChapterIndexes();
    const identity = this.view.identity();
    this.measured.physicalPagination.index.retainChapterWindow(identity.sourceId, identity.bookId, retained);
    for (let index = this.knownContentVersions.length - 1; index >= 0; index -= 1) {
      if (retained.indexOf(this.knownContentVersions[index].chapterIndex) < 0) {
        this.knownContentVersions.splice(index, 1);
      }
    }
    this.images.releaseUnretainedReadingImages();
  }

  /** A new processed document cannot reuse cached physical pages or bodies. */
  invalidateProcessedContent(): void {
    const identity = this.view.identity();
    this.measured.physicalPagination.index.invalidateBook(identity.sourceId, identity.bookId);
    this.window.clear();
    this.knownContentVersions.splice(0, this.knownContentVersions.length);
    this.measured.resetPaginationDraft();
  }

  readingTocEntries(): LocalReadingTocEntry[] {
    const source = this.view.toc();
    if (this.tocSource !== source) {
      this.tocSource = source;
      this.tocProjection = readableReaderDirectoryEntries(source);
      this.tocRanks = readerDirectoryEntryRanks(this.tocProjection);
    }
    return this.tocProjection;
  }

  tocEntryAt(chapterIndex: number): LocalReadingTocEntry | undefined {
    return this.readingTocEntries()[this.tocRanks.get(chapterIndex) ?? -1];
  }

  readableChapterPosition(chapterIndex: number): number {
    const admitted = this.mount.entryChapterPosition(chapterIndex);
    if (admitted !== undefined) return admitted;
    if (this.mount.entryCatalogPending) return -1;
    this.readingTocEntries();
    return this.tocRanks.get(chapterIndex) ?? -1;
  }

  adjacentChapterIndex(chapterIndex: number, delta: number): number | undefined {
    return this.window.adjacentChapterIndex(chapterIndex, delta);
  }

  isKnownControlChapter(chapterIndex: number): boolean {
    return this.window.contains(chapterIndex);
  }
}
