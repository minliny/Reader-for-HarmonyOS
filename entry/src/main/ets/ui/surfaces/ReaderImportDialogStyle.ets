import { readerMotionStandardCurve } from '../foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../foundation/ReaderMotionPolicy';
import { READER_REDUCED_FADE_MS } from '../foundation/ProductMotionTiming';

export function readerImportCloseDurationMs(reduceMotion: boolean): number {
  return reduceMotion ? READER_REDUCED_FADE_MS : 180;
}

function readerDialogAnimation(entering: boolean): AnimateParam {
  return { duration: entering ? 220 : readerImportCloseDurationMs(false), curve: readerMotionStandardCurve() };
}

export function readerImportOverlayTransition(reduceMotion: boolean): TransitionEffect {
  if (reduceMotion) return TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam());
  return TransitionEffect.asymmetric(
    TransitionEffect.OPACITY.animation(readerDialogAnimation(true)),
    TransitionEffect.OPACITY.animation(readerDialogAnimation(false)));
}

export function readerImportCardTransition(reduceMotion: boolean): TransitionEffect {
  if (reduceMotion) return TransitionEffect.IDENTITY;
  return TransitionEffect.asymmetric(
    readerImportCardPose().animation(readerDialogAnimation(true)),
    readerImportCardPose().animation(readerDialogAnimation(false)));
}

function readerImportCardPose(): TransitionEffect {
  return TransitionEffect.scale({ x: 0.95, y: 0.95 }).combine(TransitionEffect.translate({ y: 8 }));
}
