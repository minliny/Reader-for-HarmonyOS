import { DEBUG, BUILD_MODE_NAME } from '../../../../../build/default/generated/profile/default/BuildProfile';
import type { LayoutInvariantTag } from '../layout/LayoutInvariantEvaluator';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderLayoutOverlayRoots } from '../layout/ReaderLayoutOverlayRoots';

export const READER_LAYOUT_DEBUG_BUILD: boolean = DEBUG && BUILD_MODE_NAME === 'debug';
export const READER_LAYOUT_INVARIANT_PROPERTY: string = 'readerLayoutInvariant';
export const READER_LAYOUT_SURFACE_HINT: string = 'readerLayoutSurfaceHint';
export const READER_LAYOUT_NATIVE_MATERIAL: string = 'readerLayoutNativeMaterial';
export const READER_LAYOUT_READING_PAPER: string = 'readerLayoutReadingPaper';
export const READER_LAYOUT_ROTATION_ENVELOPE: string = 'readerLayoutRotationEnvelope';
export const READER_LAYOUT_CLOSE_CONTROL: string = 'readerLayoutCloseControl';
export const READER_LAYOUT_FOOTER: string = 'readerLayoutFooter';
let nextModalId: number = 0;
let ownedModals: Map<number, LayoutInvariantTag> | undefined;
let overlayRoots: ReaderLayoutOverlayRoots | undefined;

/** Attach to the rendered native root's onAppear/onDisAppear lifecycle. */
export class ReaderLayoutOverlayRoot {
  private readonly debugId: string;
  private retire: (() => boolean) | undefined = undefined;

  private constructor(name: string) { this.debugId = `reader-layout-overlay:${name}:${newReaderLayoutModalId()}`; }

  static diagnostic(name: string): ReaderLayoutOverlayRoot | undefined {
    return READER_LAYOUT_DEBUG_BUILD ? new ReaderLayoutOverlayRoot(name) : undefined;
  }

  id(publicId: string = ''): string { return publicId.length > 0 ? publicId : this.debugId; }

  mount(context: UIContext, publicId: string = ''): void {
    this.unmount();
    if (overlayRoots === undefined) overlayRoots = new ReaderLayoutOverlayRoots();
    this.retire = overlayRoots.mount(context.getWindowId(), this.id(publicId));
    readerLayoutInvariantChanged();
  }

  unmount(): void {
    const retire = this.retire;
    this.retire = undefined;
    if (retire?.() === true) readerLayoutInvariantChanged();
  }
}

export function readerLayoutOverlayRoots(windowId: number | undefined): string[] {
  return overlayRoots?.active(windowId) ?? [];
}

export function readerLayoutInvariantChanged(): void {
  AppStorage.setOrCreate<number>('readerLayoutInvariantRevision',
    (AppStorage.get<number>('readerLayoutInvariantRevision') ?? 0) + 1);
}

export function newReaderLayoutModalId(): number { return ++nextModalId; }

// bindContentCover may be mounted outside the normal page's FrameNode tree.
// Keep its lifecycle receipt until the cover stops owning its input layer.
export function publishReaderLayoutModal(id: number, active: boolean, intercepts: boolean, closeDurationMs: number): void {
  if (!active && !intercepts) {
    if (ownedModals?.delete(id) === true) readerLayoutInvariantChanged();
    return;
  }
  if (ownedModals === undefined) ownedModals = new Map<number, LayoutInvariantTag>();
  const before = ownedModals.get(id);
  if (before?.active === active && before.intercepts === intercepts && before.closeDurationMs === closeDurationMs) return;
  ownedModals.set(id, { role: 'modal-overlay', id: `sheet-owner:${id}`, active, intercepts, closeDurationMs });
  readerLayoutInvariantChanged();
}

export function readerOwnedLayoutModals(): LayoutInvariantTag[] {
  return ownedModals === undefined ? [] : Array.from(ownedModals.values());
}
