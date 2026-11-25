import { motionAnimateParam } from '../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../ui/foundation/ReaderMotionPolicy';

export const READER_ROUTE_PARENT_PARALLAX = 0.16;
export const READER_ROUTE_PARENT_DIM = 0.04;

export function readerSceneTransition(width: number, reduceMotion: boolean, animated: boolean): TransitionEffect {
  if (!animated) return TransitionEffect.IDENTITY;
  if (reduceMotion) return TransitionEffect.opacity(0).animation(readerMotionReducedFadeParam());

  const fromRight = (): TransitionEffect => Number.isFinite(width) && width > 0 ?
    TransitionEffect.translate({ x: width, y: 0 }) : TransitionEffect.move(TransitionEdge.END);
  // ArkUI reuses the effect attached before the conditional reader is removed.
  return TransitionEffect.asymmetric(
    fromRight().animation(motionAnimateParam('app.navigation.push')),
    fromRight().animation(motionAnimateParam('app.navigation.pop')),
  );
}
