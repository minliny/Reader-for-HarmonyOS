import { FrameNode, UIContext } from '@kit.ArkUI';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { SourceVerificationOpening } from './SourceManagementVerification';

const CONTENT = 'reader-source-content';
const BACK = 'reader-source-back';
const LIST = 'reader-source-list';
const FOOTER = 'reader-source-footer';
const PROGRESS = 'reader-source-loading-progress';
export const SOURCE_READ_FAILURE_TITLE = 'reader-source-read-failure-title';

interface FrameBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface LoadingActor {
  id: string;
  uniqueId: number;
  ancestorIds: number[];
  type: string;
  visible: boolean;
  opacity: number;
  rectVp: FrameBounds;
}

export interface SourceReadLoadingFrame {
  owner: SourceVerificationOpening;
  readGeneration: number;
  windowId: string;
  density: number;
  widthVp: number;
  heightVp: number;
  keyboardHidden: boolean;
  progressVisibleRatio: number;
  actors: LoadingActor[];
  failureTitle: LoadingActor | null;
}

function actor(node: FrameNode, id: string, context: UIContext): LoadingActor | undefined {
  if (node.getId() !== id) return undefined;
  const uniqueId = node.getUniqueId();
  const position = node.getPositionToWindowWithTransform();
  const size = node.getMeasuredSize();
  const rectVp: FrameBounds = { left: position.x, top: position.y,
    width: context.px2vp(size.width), height: context.px2vp(size.height) };
  if (![rectVp.left, rectVp.top, rectVp.width, rectVp.height].every(Number.isFinite)) return undefined;
  const ancestorIds: number[] = [];
  const seen = new Set<number>([uniqueId]);
  let visible = true;
  let opacity = 1;
  for (let current: FrameNode | null = node; current !== null; current = current.getParent()) {
    if (ancestorIds.length >= 32 || current.isDisposed() || !current.isAttached()) return undefined;
    const currentId = current.getUniqueId();
    const localOpacity = current.getOpacity();
    if (!Number.isSafeInteger(currentId) || currentId <= 0 || !Number.isFinite(localOpacity) ||
      localOpacity < 0 || localOpacity > 1) return undefined;
    if (current !== node) {
      if (seen.has(currentId)) return undefined;
      seen.add(currentId);
      ancestorIds.push(currentId);
    }
    visible = current.isVisible() && visible;
    opacity *= localOpacity;
  }
  return { id, uniqueId, ancestorIds, type: node.getNodeType(), visible, opacity, rectVp };
}

/** Read the real attached ArkUI nodes in the LoadingProgress visibility callback. */
export function sourceReadLoadingFrame(context: UIContext, owner: SourceVerificationOpening, readGeneration: number,
  progressVisibleRatio: number): SourceReadLoadingFrame | undefined {
  try {
    const metrics = ReaderWindowCoordinator.metrics();
    const windowId = context.getWindowId();
    if (windowId === undefined || windowId <= 0 || windowId !== ReaderWindowCoordinator.diagnosticWindowId() ||
      !metrics.ready || !metrics.keyboardArea.available || metrics.keyboardArea.visible ||
      !Number.isFinite(progressVisibleRatio) || progressVisibleRatio <= 0 || progressVisibleRatio > 1) return undefined;
    const actors: LoadingActor[] = [];
    for (const id of [CONTENT, BACK, LIST, FOOTER, PROGRESS]) {
      const node = context.getAttachedFrameNodeById(id);
      if (node === null) return undefined;
      const fact = actor(node,id,context);
      if (fact === undefined) return undefined;
      actors.push(fact);
    }
    const failure = context.getAttachedFrameNodeById(SOURCE_READ_FAILURE_TITLE);
    const failureTitle = failure === null ? null : actor(failure,SOURCE_READ_FAILURE_TITLE,context);
    if (failureTitle === undefined || metrics.revision !== ReaderWindowCoordinator.metrics().revision) return undefined;
    return { owner, readGeneration, windowId: windowId.toString(), density: metrics.densityPixels,
      widthVp: metrics.windowRect.width, heightVp: metrics.windowRect.height,
      keyboardHidden: true, progressVisibleRatio, actors, failureTitle };
  } catch (_) {
    return undefined;
  }
}
