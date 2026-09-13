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
  // Start revealing during the latter half of shell expansion. Keep the
  // original total duration by extending the reveal track by the overlap;
  // this prevents the content from appearing only after the shell has already
  // reached full width, while all actors still use this one shared clock.
  const revealOverlap = Math.min(timing.reveal, timing.expand * 0.5);
  const revealStart = expandStart + timing.expand - revealOverlap;
  const revealDuration = timing.reveal + revealOverlap;
  const fade = motionSegment(time, timing.fadeStart, timing.fade, fadeCurve);
  return {
    phase: time < timing.flight ? 'flight' : time < expandStart ? 'dotHold' :
      time < revealStart ? 'expand' : time < revealStart + revealDuration ? 'reveal' : 'none',
    flight: motionSegment(time, 0, timing.flight, flightCurve),
    expand: motionSegment(time, expandStart, timing.expand, expandCurve),
    reveal: motionSegment(time, revealStart, revealDuration, fadeCurve),
    sourceOpacity: 1 - fade,
    ghostOpacity: .55 * motionSegment(time, timing.ghostStart, timing.ghost, fadeCurve) * (1 - fade),
    shellOpacity: motionSegment(time, timing.handoffStart, timing.handoff, fadeCurve),
  };
}
