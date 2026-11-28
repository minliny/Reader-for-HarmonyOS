import type { ReaderControlTransitionKind } from './ReaderControlSessionState.ts';

export type ReaderControlNativeMotionMode = 'visibility' | 'directSheet' | 'moduleNavigate' | 'morph' | 'frameLoop';

/** Decides whether a control-panel transition runs via ArkUI animateTo or JS frame sampling. */
export function readerControlNativeMotionMode(
  transitionKind: ReaderControlTransitionKind | string,
  fixedIslandMode: boolean,
  directSheet: boolean,
  visualDirectSheet: boolean,
  heldPointerId: number,
  transitionsProbed: boolean,
): ReaderControlNativeMotionMode {
  if (transitionsProbed || heldPointerId !== -1) return 'frameLoop';
  if (transitionKind === 'open' || transitionKind === 'dismiss') return 'visibility';
  if (directSheet || visualDirectSheet) return 'directSheet';
  if (fixedIslandMode && transitionKind === 'navigate') return 'moduleNavigate';
  if (transitionKind === 'morph' || transitionKind === 'navigate') return 'morph';
  return 'frameLoop';
}
