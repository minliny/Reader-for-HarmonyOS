import { motionSegment } from '../common/MotionTimeline.ts';
export interface ReaderSessionMorphTiming {
  flight: number; hold: number; expand: number; reveal: number;
  ghostStart: number; ghost: number; fadeStart: number; fade: number;
  handoffStart: number; handoff: number;
}
export interface ReaderSessionMorphSample {
  phase: 'flight' | 'dotHold' | 'expand' | 'reveal' | 'none';
  flight: number; expand: number; reveal: number;
  sourceOpacity: number; ghostOpacity: number; shellOpacity: number;
}
export function sampleReaderSessionMorphTimeline(time: number, timing: ReaderSessionMorphTiming,
  flightCurve: (p: number) => number, expandCurve: (p: number) => number,
  fadeCurve: (p: number) => number): ReaderSessionMorphSample {
  const expandStart = timing.flight + timing.hold;
  const revealStart = expandStart + timing.expand;
  const fade = motionSegment(time, timing.fadeStart, timing.fade, fadeCurve);
  return {
    phase: time < timing.flight ? 'flight' : time < expandStart ? 'dotHold' :
      time < revealStart ? 'expand' : time < revealStart + timing.reveal ? 'reveal' : 'none',
    flight: motionSegment(time, 0, timing.flight, flightCurve),
    expand: motionSegment(time, expandStart, timing.expand, expandCurve),
    reveal: motionSegment(time, revealStart, timing.reveal, fadeCurve),
    sourceOpacity: 1 - fade,
    ghostOpacity: .55 * motionSegment(time, timing.ghostStart, timing.ghost, fadeCurve) * (1 - fade),
    shellOpacity: motionSegment(time, timing.handoffStart, timing.handoff, fadeCurve),
  };
}
