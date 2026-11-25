import { readerMotionAnimateParam, readerMotionReducedFadeParam } from '../../ui/foundation/ReaderMotionPolicy';
import type { ReaderRouteMotionKind } from './ReaderNavigation';

export const READER_ROUTE_PARENT_PARALLAX = 0.16;
export const READER_ROUTE_PARENT_DIM = 0.04;

export function readerRouteTransition(kind: ReaderRouteMotionKind | 'none', width: number,
  reduced: boolean): TransitionEffect {
  if (kind === 'none') return TransitionEffect.IDENTITY;
  if (reduced) return TransitionEffect.opacity(0).animation(readerMotionReducedFadeParam());
  if (kind === 'tab') {
    return TransitionEffect.opacity(0.72).combine(TransitionEffect.scale({ x: 0.992, y: 0.992 }))
      .animation(readerMotionAnimateParam('app.navigation.tab', false));
  }

  const fullWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const foreground = fullWidth > 0 ? TransitionEffect.translate({ x: fullWidth, y: 0 }) :
    TransitionEffect.move(TransitionEdge.END);
  const background = TransitionEffect.translate({ x: -fullWidth * READER_ROUTE_PARENT_PARALLAX, y: 0 })
    .combine(TransitionEffect.opacity(1 - READER_ROUTE_PARENT_DIM));
  const timing = readerMotionAnimateParam(kind === 'push' ? 'app.navigation.push' : 'app.navigation.pop', false);
  return TransitionEffect.asymmetric(
    (kind === 'push' ? foreground : background).animation(timing),
    (kind === 'pop' ? foreground : background).animation(timing),
  );
}
