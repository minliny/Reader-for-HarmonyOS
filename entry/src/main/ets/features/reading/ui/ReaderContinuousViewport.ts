interface ReaderContinuousViewportParagraph {
  readonly key: string;
}

export interface ReaderContinuousViewportFragment {
  readonly id: string;
  readonly startScalar: number;
  readonly endScalar: number;
  readonly isParagraphStart: boolean;
  readonly continuousSpaceBefore?: boolean;
  readonly nativeParagraph?: ReaderContinuousViewportParagraph;
}

interface ReaderContinuousRowRect {
  readonly y: number;
  readonly height: number;
}

interface ReaderContinuousPosition {
  scalarForY(yVp: number): number;
}

interface ReaderContinuousRowPosition {
  owner: string;
  position: ReaderContinuousPosition;
}

interface ReaderContinuousVisibleItems {
  start: number;
  end: number;
}

interface ReaderContinuousAnchorTarget<T> {
  fragment: T;
  progress: number;
  scalar: number;
  paragraphSpace: number;
}

export interface ReaderContinuousImageAnchor {
  id: string;
  y: number;
  height: number;
  fraction: number;
  manualScroll: number;
}

export type ReaderContinuousInitialReceipt = 'exact' | 'clamped';

/** Converts List coordinates to canonical document positions. The stage
 * performs native commands and supplies their actual row geometry. */
export class ReaderContinuousViewport<T extends ReaderContinuousViewportFragment> {
  private firstVisible: number = 0;
  private lastVisible: number = 0;
  private readonly paragraphPositions: Map<string, ReaderContinuousRowPosition> = new Map();
  private readonly indexById: Map<string, number> = new Map();
  private imageAnchor: ReaderContinuousImageAnchor | undefined = undefined;
  private initialEpoch: number = 0;
  private awaitingInitialScroll: boolean = true;
  private issuedInitialScroll: boolean = false;
  private initialScrollCancelled: boolean = false;
  private protectSemanticAnchor: boolean = false;
  private targetIndex: number = -1;
  private targetOffset: number = 0;

  get visibleStart(): number { return this.firstVisible; }
  get visibleEnd(): number { return this.lastVisible; }
  get hasImageAnchor(): boolean { return this.imageAnchor !== undefined; }
  get initialGeneration(): number { return this.initialEpoch; }
  get initialPending(): boolean { return this.awaitingInitialScroll; }
  get initialRequested(): boolean { return this.issuedInitialScroll; }
  get allowSemanticReport(): boolean { return !this.awaitingInitialScroll && !this.protectSemanticAnchor; }
  get initialListIndex(): number { return this.targetIndex; }
  get initialOffset(): number { return this.targetOffset; }

  retireInitialReceipt(): void { this.initialEpoch += 1; }

  beginInitialScroll(): void {
    this.retireInitialReceipt();
    this.awaitingInitialScroll = true;
    this.issuedInitialScroll = false;
    this.initialScrollCancelled = false;
    this.protectSemanticAnchor = false;
    this.targetIndex = -1;
  }

  cancelInitialForInput(): void {
    if (this.allowSemanticReport) return;
    this.retireInitialReceipt();
    this.initialScrollCancelled = true;
    // DOWN prevents a late receipt. Only actual List movement replaces the semantic anchor.
  }

  admitListMovement(): void {
    this.awaitingInitialScroll = false;
    this.protectSemanticAnchor = false;
  }

  initialTarget(fragments: T[], requestedIndex: number, readProgress: () => number,
    spacing: () => number): ReaderContinuousAnchorTarget<T> {
    const index = this.clampIndex(fragments.length, requestedIndex);
    this.firstVisible = index;
    this.lastVisible = index;
    const fragment = fragments[index];
    if (fragment === undefined) throw new Error('CONTINUOUS_INITIAL_CONTENT_UNAVAILABLE');
    const progress = Math.max(0, Math.min(1, readProgress()));
    const scalar = fragment.startScalar + Math.round((fragment.endScalar - fragment.startScalar) * progress);
    return { fragment: fragment, progress: progress, scalar: scalar,
      paragraphSpace: this.paragraphSpace(fragment, index, spacing) };
  }

  listIndex(fragments: T[], requestedIndex: number, readProgress: () => number, hasTitle: () => boolean): number {
    const index = this.clampIndex(fragments.length, requestedIndex);
    const startsChapter = index === 0 && fragments[index]?.startScalar === 0 && readProgress() === 0;
    return startsChapter && hasTitle() ? 0 : index + (hasTitle() ? 1 : 0);
  }

  setInitialCommand(index: number, y: number, paragraphSpace: number, hasTitle: () => boolean): void {
    this.targetIndex = index;
    const startsWithTitle = hasTitle() && this.targetIndex === 0;
    this.targetOffset = startsWithTitle ? 0 : y + paragraphSpace;
  }

  canIssueInitialScroll(generation: number): boolean {
    return this.isInitialReceiptCurrent(generation) && !this.issuedInitialScroll;
  }

  markInitialScrollIssued(): void { this.issuedInitialScroll = true; }

  canConfirmInitialScroll(generation: number): boolean {
    return this.isInitialReceiptCurrent(generation) && this.issuedInitialScroll;
  }

  admitInitialGeometry(rect: ReaderContinuousRowRect, contentTop: () => number, atEnd: () => boolean,
    viewportBottom: () => number): ReaderContinuousInitialReceipt | undefined {
    if (rect.height <= 0 || !Number.isFinite(rect.y)) return undefined;
    const targetY = rect.y + this.targetOffset;
    const exact = Math.abs(targetY - contentTop()) <= 1;
    // An EOF clamp can admit a visible requested line. Only real user movement
    // may replace that semantic position with the earlier visual top.
    const clamped = !exact && atEnd() && targetY >= contentTop() &&
      targetY < viewportBottom() && this.targetOffset < rect.height;
    if (!exact && !clamped) return undefined;
    this.awaitingInitialScroll = false;
    this.protectSemanticAnchor = clamped;
    return clamped ? 'clamped' : 'exact';
  }

  updateVisibleItems(rowCount: number, start: number, end: number, titleOffset: number): ReaderContinuousVisibleItems {
    const startFragment = Math.max(0, Math.min(rowCount - 1, start - titleOffset));
    const endFragment = Math.max(startFragment, Math.min(rowCount - 1, end - titleOffset));
    this.firstVisible = startFragment;
    this.lastVisible = endFragment;
    return { start: startFragment, end: endFragment };
  }

  progressForVisibleRow(fragment: T, startFragment: number, rect: ReaderContinuousRowRect,
    contentTop: () => number, spacing: () => number): number | undefined {
    const position = this.paragraphPositions.get(fragment.id)?.position;
    const y = Math.max(0, contentTop() - rect.y - this.paragraphSpace(fragment, startFragment, spacing));
    const span = fragment.endScalar - fragment.startScalar;
    if (fragment.nativeParagraph !== undefined && position === undefined) return undefined;
    return position !== undefined && span > 0 ?
      Math.max(0, Math.min(1, (position.scalarForY(y) - fragment.startScalar) / span)) :
      Math.max(0, Math.min(1, y / rect.height));
  }

  reindex(fragments: T[]): void {
    this.indexById.clear();
    for (let index = 0; index < fragments.length; index += 1) this.indexById.set(fragments[index].id, index);
  }

  retainVisibleRows(previousId: string | undefined, rowCount: number): void {
    const visible = previousId === undefined ? -1 : (this.indexById.get(previousId) ?? -1);
    if (visible < 0) return;
    const span = this.lastVisible - this.firstVisible;
    this.firstVisible = visible;
    this.lastVisible = Math.min(rowCount - 1, visible + span);
  }

  bindParagraphPosition(id: string, owner: string, position: ReaderContinuousPosition): void {
    this.paragraphPositions.set(id, { owner: owner, position: position });
  }

  acceptParagraphPosition(id: string, owner: string, position: ReaderContinuousPosition | undefined,
    fragments: () => T[]): void {
    if (position === undefined) {
      if (this.paragraphPositions.get(id)?.owner === owner) this.paragraphPositions.delete(id);
      return;
    }
    // A recycled row may report after its geometry changed.
    const index = this.indexById.get(id);
    if (index === undefined || fragments()[index]?.nativeParagraph?.key !== owner) return;
    this.bindParagraphPosition(id, owner, position);
  }

  clearParagraphPositions(): void { this.paragraphPositions.clear(); }

  captureImageAnchor(id: string, rect: ReaderContinuousRowRect, contentTop: () => number): ReaderContinuousImageAnchor {
    const anchor: ReaderContinuousImageAnchor = { id: id, y: rect.y, height: rect.height,
      fraction: rect.height > 0 ? Math.max(0, Math.min(1, (contentTop() - rect.y) / rect.height)) : 0, manualScroll: 0 };
    this.imageAnchor = anchor;
    return anchor;
  }

  retireImageAnchor(): void { this.imageAnchor = undefined; }

  accumulateImageScroll(offset: number): void {
    if (this.imageAnchor !== undefined) this.imageAnchor.manualScroll += offset;
  }

  consumeImageAnchor(anchor: ReaderContinuousImageAnchor): number | undefined {
    if (anchor !== this.imageAnchor) return undefined;
    this.retireImageAnchor();
    return this.indexById.get(anchor.id);
  }

  imageAnchorDelta(anchor: ReaderContinuousImageAnchor, rect: ReaderContinuousRowRect): number {
    // Apply layout displacement while preserving scroll and inertia since capture.
    return rect.y - anchor.y + anchor.manualScroll + anchor.fraction * (rect.height - anchor.height);
  }

  private isInitialReceiptCurrent(generation: number): boolean {
    return generation === this.initialEpoch && this.awaitingInitialScroll && !this.initialScrollCancelled &&
      !(this.targetIndex < 0);
  }

  private paragraphSpace(fragment: T, index: number, readSpacing: () => number): number {
    return (fragment.continuousSpaceBefore ?? (index > 0)) && fragment.isParagraphStart ? readSpacing() : 0;
  }

  private clampIndex(count: number, requested: number): number {
    return Math.max(0, Math.min(Math.max(0, count - 1), requested));
  }
}
