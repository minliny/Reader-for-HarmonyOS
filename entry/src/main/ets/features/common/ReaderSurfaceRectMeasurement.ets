import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderSurfaceRect, ReaderSurfaceRectIdentity, readerSurfaceRectIdentityMatches,
  readerSurfaceRectInHost } from './ReaderSurfaceRect';

/** Read unscaled page and host nodes in the same window, rejecting a stale owner.
 * FrameNode position includes transforms; ComponentInfo size is in physical pixels.
 * Callers must keep both nodes and their ancestor geometry unscaled and unrotated. */
export function readerMeasureSurfaceRect(context: UIContext, targetId: string, hostId: string,
  presented: ReaderSurfaceRectIdentity, current: () => ReaderSurfaceRectIdentity): ReaderSurfaceRect | undefined {
  if (!readerSurfaceRectIdentityMatches(presented, current()) || targetId.length === 0 || hostId.length === 0) {
    return undefined;
  }
  try {
    const targetNode = context.getFrameNodeById(targetId);
    const hostNode = context.getFrameNodeById(hostId);
    if (targetNode === null || hostNode === null) return undefined;
    const target = context.getComponentUtils().getRectangleById(targetId);
    const host = context.getComponentUtils().getRectangleById(hostId);
    if (target.scale.x !== 1 || target.scale.y !== 1 || host.scale.x !== 1 || host.scale.y !== 1 ||
      target.rotate.angle !== 0 || host.rotate.angle !== 0) {
      return undefined;
    }
    const targetPosition = targetNode.getPositionToWindowWithTransform();
    const hostPosition = hostNode.getPositionToWindowWithTransform();
    const targetRect: ReaderSurfaceRect = { x: targetPosition.x, y: targetPosition.y,
      width: context.px2vp(target.size.width), height: context.px2vp(target.size.height) };
    const hostRect: ReaderSurfaceRect = { x: hostPosition.x, y: hostPosition.y,
      width: context.px2vp(host.size.width), height: context.px2vp(host.size.height) };
    return readerSurfaceRectInHost({ identity: presented, rect: targetRect }, current(), hostRect);
  } catch (_error) {
    // Nodes may disappear between scheduling and reading a frame.
    return undefined;
  }
}
