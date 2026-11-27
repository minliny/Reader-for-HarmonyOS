import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { hasKnownReadingImageGeometry, type ReadingChapterWindow, type ReadingSessionChapter,
  type ReadingSessionImage } from '../application/ReadingChapterWindow';
import { ReaderReadingImageResources, sameReaderReadingImageResource, sameReadingImageChapter,
  type ReaderReadingImageAllocator } from '../application/ReaderReadingImageResources';
import type { PreparedReaderPageTurn } from '../presentation/ReaderPagePresentationModels';
import type { ReaderControlDirectoryOperationsHost } from './ReaderControlDirectoryOperationsHost';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { ReaderPageTurnPresentation } from './ReaderPageTurnPresentation';
import type { ReaderPageTurnSettlementHost } from './ReaderPageTurnSettlementHost';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingRecoveryHost } from './ReaderReadingRecoveryHost';
import type { ReaderReadingSurfaceHost } from './ReaderReadingSurfaceHost';
import type { MeasurementParagraph, PhysicalReadingPage } from './ReadingMeasurementModels';
import { ReadingSurfacePageFragment } from './ReadingSurface';

export interface ReaderReadingImageResidencyOwners {
  readonly measured: ReaderMeasuredPagePublication;
  readonly mount: ReaderReadingMountHost;
  readonly surface: ReaderReadingSurfaceHost;
  readonly window: ReadingChapterWindow;
  readonly turn: ReaderPageTurnSettlementHost;
  readonly turnPresentation: ReaderPageTurnPresentation<PreparedReaderPageTurn>;
  readonly directory: ReaderControlDirectoryOperationsHost;
  readonly recovery: ReaderReadingRecoveryHost;
}

export interface ReaderReadingImageScope {
  readonly sourceId: string;
  readonly bookId: string;
  readonly selection: number;
}

export interface ReaderReadingImageResidencyView {
  readonly scope: () => ReaderReadingImageScope;
  readonly continuous: () => boolean;
  readonly turnIdle: () => boolean;
  readonly chromeFrozen: () => boolean;
  readonly visibleFragments: () => ReadingSurfacePageFragment[];
  readonly readyPage: () => PhysicalReadingPage | undefined;
  readonly retainedChapter: () => ReadingSessionChapter | undefined;
  readonly retainWindow: () => void;
  readonly publishVisibleFragments: (fragments: ReadingSurfacePageFragment[]) => void;
  readonly publishContinuousRevision: () => void;
  readonly publishPageTurnRevision: () => void;
}

/** Tracks the original allocator's image leases for the actual page and
 * measurement owners. Decode and native title/paragraph retirement use the
 * same retained physical objects as the visible and speculative surfaces. */
export class ReaderReadingImageResidencyHost {
  private readonly resources: ReaderReadingImageResources;
  private readonly owners: ReaderReadingImageResidencyOwners;
  private readonly view: ReaderReadingImageResidencyView;

  constructor(owners: ReaderReadingImageResidencyOwners, view: ReaderReadingImageResidencyView,
    allocator: ReaderReadingImageAllocator = ReaderRuntimeOwner.current()) {
    this.owners = owners;
    this.view = view;
    this.resources = new ReaderReadingImageResources(allocator, (error: Error): void => {
      hilog.error(0x5244, 'Reader', '%{private}s', `Reading image release failed: ${error.message}`);
    });
  }

  indexChapter(chapter: ReadingSessionChapter): void { this.resources.indexChapter(chapter); }
  atScalar(startScalar: number): ReadingSessionImage | undefined { return this.resources.atScalar(startScalar); }
  resetChapter(): void { this.resources.resetChapter(); }

  close(): void {
    this.resources.close();
    this.owners.measured.nativeParagraphResources.close();
  }

  retainNativeParagraphResources(): void {
    const owners = this.owners;
    const turn = owners.turn.pageTurn;
    const selection = owners.directory.selection;
    const keys = new Set<string>();
    const fragments = this.view.visibleFragments().concat(owners.surface.continuousProjection.fragments,
      turn.neighbour('previous')?.page.fragments ?? [], turn.neighbour('next')?.page.fragments ?? [],
      this.view.readyPage()?.fragments ?? [], selection.origin?.page.fragments ?? [], selection.candidate?.page.fragments ?? []);
    for (const fragment of fragments) {
      if (fragment.nativeParagraph !== undefined) keys.add(fragment.nativeParagraph.key);
      if (fragment.nativeTitle !== undefined) keys.add(fragment.nativeTitle.key);
    }
    const continuousTitle = owners.surface.continuousTitleRecipe;
    if (continuousTitle !== undefined) keys.add(continuousTitle.key);
    owners.measured.nativeParagraphResources.retain(keys);
  }

  /** Core supplies an exact one-scalar image block. Mixed text/image
   * paragraphs do not acquire a native image lease here. */
  readingImageForParagraph(paragraph: MeasurementParagraph): ReadingSessionImage | undefined {
    if (paragraph.text !== '\uFFFC' || paragraph.layoutMap.scalarCount() !== 1) return undefined;
    for (const image of this.owners.measured.requireMeasurementChapter().images) {
      if (image.startScalar === paragraph.chapterStartScalar && image.endScalar === paragraph.chapterStartScalar + 1) {
        return image;
      }
    }
    throw new Error('READING_IMAGE_BLOCK_MISSING');
  }

  resolvePendingReadingImage(image: ReadingSessionImage, generation: number,
    selectionToken: number, lifecycleToken: number): void {
    const owners = this.owners;
    const measured = owners.measured;
    measured.measurementRun.cancelDeadline();
    const current = (): boolean => measured.isMeasurementCurrent(generation, selectionToken, lifecycleToken);
    const gateway = owners.mount.activeGateway();
    void this.resources.resolvePending(measured.requireMeasurementChapter(), image, current, {
      load: (chapter: ReadingSessionChapter, requested: ReadingSessionImage, isCurrent: () => boolean): Promise<ReadingSessionImage> =>
        gateway.resolveReadingImage(chapter, requested, isCurrent),
      admit: (requested: ReadingSessionImage, resolved: ReadingSessionImage): void => {
        this.replaceResolvedReadingImage(requested, resolved);
        measured.armMeasurementDeadline(generation, selectionToken, lifecycleToken);
        measured.consumeMeasuredBatch(generation, selectionToken, lifecycleToken);
      },
      fail: (error: Error): void => owners.recovery.fail(error, lifecycleToken),
    });
  }

  resolveContinuousImage(startScalar: number): void {
    const owners = this.owners;
    this.resources.resolveContinuous(owners.measured.chapter, startScalar, {
      captureCurrent: (chapter: ReadingSessionChapter): (() => boolean) => {
        const lifecycle = owners.mount.lifecycleToken, selection = this.view.scope().selection;
        return (): boolean => owners.mount.isSelectionActive(lifecycle, selection) && owners.measured.chapter === chapter &&
          this.view.continuous();
      },
      resolveGeometry: (chapter: ReadingSessionChapter, image: ReadingSessionImage): void =>
        this.resolveGeometryImagePixels(chapter, image),
      load: (chapter: ReadingSessionChapter, image: ReadingSessionImage, current: () => boolean): Promise<ReadingSessionImage> =>
        owners.mount.activeGateway().resolveReadingImage(chapter, image, current),
      admit: (requested: ReadingSessionImage, resolved: ReadingSessionImage): void => {
        this.replaceResolvedReadingImage(requested, resolved);
        if (!owners.surface.refreshContinuousImageFragment(resolved)) owners.surface.rebuildContinuousFragments();
      },
      fail: (error: Error): void =>
        hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience continuous image failed: ${error.message}`),
    });
  }

  /** Core's supplied geometry remains authoritative while pixels decode. */
  resolvePageImagePixels(chapter: ReadingSessionChapter, fragments: ReadingSurfacePageFragment[]): void {
    for (const image of chapter.images) {
      if (image.state === 'pending' && hasKnownReadingImageGeometry(image) && fragments.some(
        (fragment: ReadingSurfacePageFragment): boolean => fragment.text.length === 0 &&
          fragment.startScalar === image.startScalar && fragment.endScalar === image.endScalar)) {
        this.resolveGeometryImagePixels(chapter, image);
      }
    }
  }

  private imageOwnerCandidates(chapter: ReadingSessionChapter): (ReadingSessionChapter | undefined)[] {
    const owners = this.owners;
    const turn = owners.turn.pageTurn;
    const selection = owners.directory.selection;
    return [owners.measured.chapter, owners.measured.adjacentMeasurementContext?.chapter,
      turn.neighbour('previous')?.context.chapter, turn.neighbour('next')?.context.chapter,
      selection.origin?.context.chapter, selection.candidate?.context.chapter, owners.window.get(chapter.chapterIndex)];
  }

  private resolveGeometryImagePixels(chapter: ReadingSessionChapter, image: ReadingSessionImage): void {
    const mount = this.owners.mount;
    this.resources.resolveGeometry(chapter, image, {
      captureCurrent: (): (() => boolean) => {
        const lifecycle = mount.lifecycleToken;
        const contentCurrent = ReaderRuntimeOwner.current().captureReadingContentValidity(chapter.sourceId, chapter.bookId);
        return (): boolean => {
          if (!mount.isSessionActive(lifecycle) || !contentCurrent()) return false;
          const scope = this.view.scope();
          return chapter.sourceId === scope.sourceId && chapter.bookId === scope.bookId;
        };
      },
      ownerCandidates: (owner: ReadingSessionChapter): (ReadingSessionChapter | undefined)[] => this.imageOwnerCandidates(owner),
      load: (owner: ReadingSessionChapter, requested: ReadingSessionImage, current: () => boolean): Promise<ReadingSessionImage> =>
        mount.activeGateway().resolveReadingImage(owner, requested, current),
      ready: (): void => this.flushDeferredReadingImagePixels(),
      fail: (error: Error): void => hilog.error(0x5244, 'Reader', 'Reading image pixels failed: %{private}s', error.message),
    });
  }

  private replaceFragmentPixels(fragments: ReadingSurfacePageFragment[], image: ReadingSessionImage): boolean {
    if (image.state !== 'ready') return false;
    let changed = false;
    for (let index = 0; index < fragments.length; index += 1) {
      const fragment = fragments[index];
      if (fragment.text.length === 0 && fragment.startScalar === image.startScalar && fragment.endScalar === image.endScalar &&
        (fragment.fileUri !== image.fileUri || fragment.imageSource !== image.pixelMap)) {
        const replacement = new ReadingSurfacePageFragment(fragment.id, fragment.text, fragment.isParagraphStart,
          fragment.startScalar, fragment.endScalar, image.pixelMap, fragment.imageHeight, image.fileUri,
          fragment.layoutHeight, fragment.imageWidthBasisPoints);
        replacement.nativeParagraph = fragment.nativeParagraph;
        replacement.nativeTitle = fragment.nativeTitle;
        replacement.nativeParagraphFirst = fragment.nativeParagraphFirst;
        replacement.continuousSpaceBefore = fragment.continuousSpaceBefore;
        fragments[index] = replacement;
        changed = true;
      }
    }
    return changed;
  }

  private publishGeometryImagePixels(chapter: ReadingSessionChapter,
    chapterOwners: ReadingSessionChapter[], image: ReadingSessionImage): boolean {
    const owners = this.owners;
    const measured = owners.measured;
    const surface = owners.surface;
    const current = sameReadingImageChapter(measured.chapter, chapter);
    if (current && measured.chapter !== undefined) {
      this.resources.indexChapter(measured.chapter);
      owners.mount.setCurrentReadingChapter(measured.chapter);
    } else if (chapterOwners.length > 0) owners.window.admitNeighbour(chapterOwners[0]);
    let changed = false;
    if (current) {
      const visibleChanged = this.replaceFragmentPixels(this.view.visibleFragments(), image);
      changed = visibleChanged || changed;
      const page = measured.page;
      if (page !== undefined) {
        const pageChanged = this.replaceFragmentPixels(page.fragments, image);
        if (visibleChanged || pageChanged) page.fragments = page.fragments.slice();
        changed = pageChanged || changed;
      }
      const readyPage = this.view.readyPage();
      if (readyPage !== undefined && this.replaceFragmentPixels(readyPage.fragments, image)) {
        readyPage.fragments = readyPage.fragments.slice();
      }
      if (this.replaceFragmentPixels(surface.continuousProjection.fragments, image)) {
        surface.continuousProjection.republishFragments();
        // Publish all unchanged-geometry rows before ArkUI coalesces revision delivery.
        surface.continuousChangedFragmentIndex = -1;
        this.view.publishContinuousRevision();
        changed = true;
      }
      if (changed) this.view.publishVisibleFragments(this.view.visibleFragments().slice());
    }
    const turn = owners.turn.pageTurn;
    const selection = owners.directory.selection;
    for (const prepared of [turn.neighbour('previous'), turn.neighbour('next'), selection.origin, selection.candidate]) {
      if (prepared !== undefined && sameReadingImageChapter(prepared.context.chapter, chapter) &&
        this.replaceFragmentPixels(prepared.page.fragments, image)) {
        prepared.page.fragments = prepared.page.fragments.slice();
        changed = true;
      }
    }
    if (sameReadingImageChapter(measured.adjacentMeasurementContext?.chapter ?? measured.chapter, chapter)) {
      this.replaceFragmentPixels(measured.physicalPagination.fragments, image);
    }
    this.view.retainWindow();
    return changed;
  }

  flushDeferredReadingImagePixels(): void {
    if (!this.view.turnIdle() || this.view.chromeFrozen()) return;
    const changed = this.resources.flushGeometry(
      (chapter: ReadingSessionChapter): (ReadingSessionChapter | undefined)[] => this.imageOwnerCandidates(chapter),
      (chapter: ReadingSessionChapter, owners: ReadingSessionChapter[], resolved: ReadingSessionImage): boolean =>
        this.publishGeometryImagePixels(chapter, owners, resolved));
    if (changed) {
      this.view.publishPageTurnRevision();
      const presentation = this.owners.turnPresentation;
      presentation.texture.invalidate(true);
      presentation.session.clearCapturedTextures();
      presentation.texture.schedule();
    }
  }

  private replaceResolvedReadingImage(requested: ReadingSessionImage, resolved: ReadingSessionImage): void {
    const owners = this.owners;
    const chapter = owners.measured.requireMeasurementChapter();
    const visibleOwner = chapter === owners.measured.chapter;
    if (!this.resources.replacePending(chapter, visibleOwner, requested, resolved)) return;
    if (visibleOwner) owners.mount.setCurrentReadingChapter(chapter);
    else owners.window.admitNeighbour(chapter);
    this.view.retainWindow();
  }

  releaseUnretainedReadingImages(): void {
    this.resources.prune((resource: ReadingSessionImage): boolean => this.isReadingImageRetained(resource));
  }

  private isReadingImageRetained(resource: ReadingSessionImage): boolean {
    if (resource.fileUri.length === 0 && resource.pixelMap === undefined) return false;
    const owners = this.owners;
    const turn = owners.turn.pageTurn;
    const selection = owners.directory.selection;
    const chapterImages = (owners.measured.chapter?.images ?? []).concat(owners.measured.adjacentMeasurementContext?.chapter.images ?? []);
    // The retained origin can be remounted after a failed control selection.
    const originImages = (selection.origin?.context.chapter.images ?? []).concat(this.view.retainedChapter()?.images ?? []);
    const candidateImages = selection.candidate?.context.chapter.images ?? [];
    for (const image of chapterImages.concat(owners.window.retainedImages(), originImages, candidateImages)) {
      if (sameReaderReadingImageResource(resource, image)) return true;
    }
    const preparedFragments = (turn.neighbour('previous')?.page.fragments ?? []).concat(turn.neighbour('next')?.page.fragments ?? []);
    for (const fragment of this.view.visibleFragments().concat(owners.measured.physicalPagination.fragments, preparedFragments)) {
      if ((resource.fileUri.length > 0 && fragment.fileUri === resource.fileUri) ||
        (resource.pixelMap !== undefined && fragment.imageSource === resource.pixelMap)) return true;
    }
    return false;
  }
}
