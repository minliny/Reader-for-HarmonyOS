import { DEBUG, BUILD_MODE_NAME } from '../../../../../build/default/generated/profile/default/BuildProfile';
import type { LayoutInvariantTag } from '../layout/LayoutInvariantEvaluator';

export const READER_LAYOUT_DEBUG_BUILD: boolean = DEBUG && BUILD_MODE_NAME === 'debug';
export const READER_LAYOUT_INVARIANT_PROPERTY: string = 'readerLayoutInvariant';
let nextModalId: number = 0;
let ownedModals: Map<number, LayoutInvariantTag> | undefined;

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
