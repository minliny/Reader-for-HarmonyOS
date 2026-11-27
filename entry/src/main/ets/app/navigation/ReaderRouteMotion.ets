import { motionAnimateParam } from '../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../ui/foundation/ReaderMotionPolicy';
import { readerConditionalSceneMotion } from './ReaderRouteMotionModel';
export { READER_ROUTE_PARENT_PARALLAX, READER_ROUTE_PARENT_DIM } from './ReaderRouteMotionModel';

export function readerSceneTransition(width: number, reduceMotion: boolean, animated: boolean,
  retainedParent: boolean = false): TransitionEffect {
  const motion = readerConditionalSceneMotion(animated, retainedParent);
  if (motion.enter === 'none' && motion.exit === 'none') return TransitionEffect.IDENTITY;
  if (reduceMotion) return TransitionEffect.opacity(0).animation(readerMotionReducedFadeParam());

  const fromRight = (): TransitionEffect => Number.isFinite(width) && width > 0 ?
    TransitionEffect.translate({ x: width, y: 0 }) : TransitionEffect.move(TransitionEdge.END);
  // ArkUI reuses the effect attached before the conditional reader is removed.
  return TransitionEffect.asymmetric(
    fromRight().animation(motionAnimateParam('app.navigation.push')),
    fromRight().animation(motionAnimateParam('app.navigation.pop')),
  );
}
