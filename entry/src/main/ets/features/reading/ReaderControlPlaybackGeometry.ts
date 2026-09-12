import {
  readerControlActor, readerControlLerp, readerControlUnit, sampleReaderControlActor,
  type ReaderControlActorFrame,
} from './ReaderControlActorGeometry.ts';
import type { ReaderControlForm } from './ReaderControlSessionState.ts';
import type { ReaderSessionMorphSourceKind } from './ReaderSessionMorphState.ts';

/** Coordinates below are local to their named persistent parent, never a
 * flattened screen transform. TTS uses Make DEu3TuYhaJPLMEdSxorhwE v17;
 * AutoPage retains klhs2jMM4MncaJFqZMfqEK 1938:6245. The Session resolves one p.
 */
export type ReaderControlTransportKind = 'previous' | 'toggle' | 'stop' | 'next';
export interface ReaderControlTtsFrame {
  playback: ReaderControlActorFrame;
  playbackHeader: ReaderControlActorFrame;
  playbackCard: ReaderControlActorFrame;
  waveform: ReaderControlActorFrame;
  voice: ReaderControlActorFrame;
  quickPlaybackLabel: ReaderControlActorFrame;
  previous: ReaderControlActorFrame;
  toggle: ReaderControlActorFrame;
  stop: ReaderControlActorFrame;
  next: ReaderControlActorFrame;
  timer: ReaderControlActorFrame;
  timerHeader: ReaderControlActorFrame;
  timerCard: ReaderControlActorFrame;
  quickTimerLabel: ReaderControlActorFrame;
  quickTimerSelect: ReaderControlActorFrame;
  speed: ReaderControlActorFrame;
  speedHeader: ReaderControlActorFrame;
  speedCard: ReaderControlActorFrame;
  speedPresets: ReaderControlActorFrame;
  speedTrack: ReaderControlActorFrame;
  speedThumb: ReaderControlActorFrame;
  quickSpeedLabel: ReaderControlActorFrame;
  quickSpeedValue: ReaderControlActorFrame;
  detail: ReaderControlActorFrame;
  config: ReaderControlActorFrame;
  contentHeight: number;
}

/** Make DEu3TuYhaJPLMEdSxorhwE v17, measured 2026-09-11. Only the
 * TTS endpoints change; the Session, clock, scroll and AutoPage stay intact.
 * Coordinates are parent-local. The unchanged one p is reversible, including
 * the Timer/Speed order exchange. See reader-control-tts-make-20260911.json. */
export function sampleReaderControlTts(progress: number, availableWidth: number,
  rateFraction: number = 1 / 3, seekHeight: number = 0, onlineService: boolean = false): ReaderControlTtsFrame {
  const p = readerControlUnit(progress);
  const widthDelta = availableWidth - readerControlLerp(286, 338, p);
  const innerWidth = Math.max(0, readerControlLerp(264, 312, p) + widthDelta);
  const fullChildWidth = Math.max(0, 312 + widthDelta);
  const x = readerControlLerp(11, 13, p);
  // Retain real sentence-seek/error rows below Playback, without scaling text.
  const seek = Math.max(0, seekHeight) * p;
  const onlineReduction = onlineService ? 48 : 0;
  const childShift = widthDelta * readerControlLerp(1, 0.5, p);
  const previous = sampleReaderControlActor(readerControlActor(125, 19, 28, 28),
    readerControlActor(61, 93, 42, 42), p);
  const toggle = sampleReaderControlActor(readerControlActor(156, 15, 36, 36),
    readerControlActor(127, 85, 58, 58), p);
  const stop = sampleReaderControlActor(readerControlActor(195, 19, 28, 28),
    readerControlActor(239, 161, 57, 21), p);
  const next = sampleReaderControlActor(readerControlActor(226, 19, 28, 28),
    readerControlActor(209, 93, 42, 42), p);
  previous.x += childShift; toggle.x += childShift; next.x += childShift;
  stop.x += widthDelta;
  const speedTrack = sampleReaderControlActor(readerControlActor(79, 18, 130, 6),
    readerControlActor(16, 50, 280, 6), p);
  speedTrack.width = Math.max(0, speedTrack.width + widthDelta);
  const fraction = readerControlUnit(rateFraction);
  return {
    playback: readerControlActor(x, readerControlLerp(13, 16, p), innerWidth,
      readerControlLerp(66, 198, p) + seek),
    playbackHeader: readerControlActor(0, 0, innerWidth, 18, p),
    playbackCard: readerControlActor(0, 27 * p, innerWidth,
      readerControlLerp(66, 171, p) + seek),
    waveform: readerControlActor(16, 43, Math.max(0, innerWidth - 32), 28, p),
    voice: readerControlActor(16, 161, Math.max(0, innerWidth - 97), 21, p),
    quickPlaybackLabel: readerControlActor(13, readerControlLerp(16, 24, p),
      Math.max(44, 106 + Math.min(0, widthDelta)), 34, 1 - p),
    previous: previous, toggle: toggle, stop: stop, next: next,
    timer: readerControlActor(x, readerControlLerp(87, 401.5, p) + seek, innerWidth,
      readerControlLerp(42, 194, p)),
    timerHeader: readerControlActor(0, 0, innerWidth, 17, p),
    timerCard: readerControlActor(0, 26, fullChildWidth, 168, p),
    quickTimerLabel: readerControlActor(11, 8, 120, 26, 1 - p),
    quickTimerSelect: readerControlActor(175 + widthDelta, 6, 78, 30, 1 - p),
    speed: readerControlActor(x, readerControlLerp(137, 234, p) + seek, innerWidth,
      readerControlLerp(42, 147.5, p)),
    speedHeader: readerControlActor(0, 0, innerWidth, 17, p),
    speedCard: readerControlActor(0, 26 * p, innerWidth, readerControlLerp(42, 121.5, p)),
    speedPresets: readerControlActor(16, 99.5, Math.max(0, innerWidth - 32), 32, p),
    speedTrack: speedTrack,
    speedThumb: readerControlActor(speedTrack.x + speedTrack.width * fraction - 9,
      readerControlLerp(12, 44, p), 18, 18),
    quickSpeedLabel: readerControlActor(11, 8, 72, 26, 1 - p),
    quickSpeedValue: readerControlActor(219 + widthDelta, 12, 34, 18, 1 - p),
    // Make EngineModule: two System rows or one Online service-info row.
    // Audio concurrency remains the existing mixing toggle; failure policy is the fourth config row.
    config: readerControlActor(x, readerControlLerp(649.5, 615.5, p) + seek, innerWidth, 238 - onlineReduction, p),
    detail: readerControlActor(x, readerControlLerp(899.5 - onlineReduction, 873.5 - onlineReduction, p) + seek, innerWidth, 270, p),
    contentHeight: readerControlLerp(190, 1159.5 - onlineReduction, p) + seek,
  };
}

export interface ReaderControlTtsClipRect {
  x: number; y: number; width: number; height: number;
}

/** Speed is painted above Timer during their order exchange. Subtract its
 * actual actor silhouette so translucent content never double-paints. This is
 * paint geometry on the same p, not another clock, fade or route switch. */
export function readerControlTtsTimerVisibleRects(rects: ReaderControlTtsClipRect[],
  frame: ReaderControlTtsFrame, speedRects: ReaderControlTtsClipRect[]): ReaderControlTtsClipRect[] {
  let visible: ReaderControlTtsClipRect[] = rects;
  for (const speed of speedRects) {
    const occluder: ReaderControlTtsClipRect = { x: frame.speed.x + speed.x - frame.timer.x,
      y: frame.speed.y + speed.y - frame.timer.y, width: speed.width, height: speed.height };
    const result: ReaderControlTtsClipRect[] = [];
    for (const rect of visible) {
      const left = Math.max(rect.x, occluder.x);
      const right = Math.min(rect.x + rect.width, occluder.x + occluder.width);
      const top = Math.max(rect.y, occluder.y);
      const bottom = Math.min(rect.y + rect.height, occluder.y + occluder.height);
      if (right <= left || bottom <= top) { result.push(rect); continue; }
      if (top > rect.y) result.push({ x: rect.x, y: rect.y, width: rect.width, height: top - rect.y });
      if (bottom < rect.y + rect.height) result.push({ x: rect.x, y: bottom,
        width: rect.width, height: rect.y + rect.height - bottom });
      if (left > rect.x) result.push({ x: rect.x, y: top, width: left - rect.x, height: bottom - top });
      if (right < rect.x + rect.width) result.push({ x: right, y: top,
        width: rect.x + rect.width - right, height: bottom - top });
    }
    visible = result;
  }
  return visible;
}

export interface ReaderControlAutoPageFrame {
  content: ReaderControlActorFrame;
  control: ReaderControlActorFrame;
  controlHeader: ReaderControlActorFrame;
  previous: ReaderControlActorFrame;
  toggle: ReaderControlActorFrame;
  playIcon: ReaderControlActorFrame;
  next: ReaderControlActorFrame;
  stop: ReaderControlActorFrame;
  stopLabel: ReaderControlActorFrame;
  timer: ReaderControlActorFrame;
  details: ReaderControlActorFrame;
  detailsHeader: ReaderControlActorFrame;
  speed: ReaderControlActorFrame;
  follow: ReaderControlActorFrame;
  back: ReaderControlActorFrame;
  contentHeight: number;
}

export function sampleReaderControlAutoPage(progress: number,
  availableWidth: number): ReaderControlAutoPageFrame {
  const p = readerControlUnit(progress);
  const widthDelta = availableWidth - readerControlLerp(286, 338, p);
  // AutoPage's Figma ContentViewport sits at sheet y58 throughout, while the
  // common Stage viewport follows 29 -> 57. Compensate the local origin, not
  // the shared clock or shell. Full content x25 - Stage x13 = 12.
  const content = readerControlActor(12, readerControlLerp(40, 12, p),
    Math.max(0, 314 + widthDelta), 435.173);
  const previous = sampleReaderControlActor(readerControlActor(3.3, -4.841, 62, 52),
    readerControlActor(9.75, 5, 72, 52), p);
  const toggle = sampleReaderControlActor(readerControlActor(110.5501875, -2.341, 32, 32),
    readerControlActor(105.4921875, 5, 95, 52), p);
  const next = sampleReaderControlActor(readerControlActor(187.85, -4.841, 62, 52),
    readerControlActor(224.25, 5, 72, 52), p);
  next.x += widthDelta; toggle.x += widthDelta / 2;
  return {
    content: content,
    control: readerControlActor(0, 0, content.width, 104.391),
    controlHeader: readerControlActor(4, readerControlLerp(24, 10, p), Math.max(0, content.width - 8), 14.3906, p),
    previous: previous, toggle: toggle, next: next,
    // Exact node 1939:801 (round playback icon), NOT the static 1939:803 label.
    playIcon: sampleReaderControlActor(readerControlActor(0.0001875, 0, 32, 32),
      readerControlActor(31.4921875, 2.5, 32, 32), p),
    stop: readerControlActor(readerControlLerp(155.55025, 188.65625, p) + widthDelta / 2,
      readerControlLerp(5.659, 15.5, p), 24, 24),
    stopLabel: readerControlActor(readerControlLerp(158.55025, 191.65625, p) + widthDelta / 2,
      readerControlLerp(34.159, 44, p), 18, 9),
    timer: readerControlActor(0, readerControlLerp(126.391, 104.391, p), content.width, 181.391, p),
    details: readerControlActor(0, 285.782, content.width, 149.391),
    detailsHeader: readerControlActor(4, readerControlLerp(29, 11, p), Math.max(0, content.width - 8), 14.3906, p),
    speed: sampleReaderControlActor(readerControlActor(-1.45, -175.2324, 264 + widthDelta, 32),
      readerControlActor(4, 33.3906, 306 + widthDelta, 64), p),
    follow: readerControlActor(4, readerControlLerp(121.3906, 103.3906, p),
      Math.max(0, content.width - 8), 36, p),
    back: readerControlActor(10.44, readerControlLerp(12, 26, p), 58, 24, 1 - p),
    contentHeight: Math.max(190, content.y + content.height + 12),
  };
}

/** Identity is a semantic form supplied by the Session, never p>=0.5. */
export function readerControlPlaybackSourceKind(module: 'tts' | 'autoPage',
  form: ReaderControlForm): ReaderSessionMorphSourceKind {
  if (module === 'tts') return form === 'quick' ? 'quickTts' : 'fullTtsPlayback';
  return form === 'quick' ? 'quickAutoPage' : 'fullAutoPagePlayback';
}

export interface ReaderControlPlaybackMeasuredRect {
  left: number; top: number; width: number; height: number;
}

/** Missing native measurements stay missing. Never invent a capsule source. */
export function readerControlPlaybackMeasuredSource(form: ReaderControlForm,
  quick: ReaderControlPlaybackMeasuredRect | undefined,
  full: ReaderControlPlaybackMeasuredRect | undefined): ReaderControlPlaybackMeasuredRect | undefined {
  const measured = form === 'quick' ? quick : full;
  if (measured === undefined || !Number.isFinite(measured.left) || !Number.isFinite(measured.top) ||
    !Number.isFinite(measured.width) || !Number.isFinite(measured.height) ||
    measured.width <= 0 || measured.height <= 0) return undefined;
  return measured;
}
