import { motionSegment } from '../common/MotionTimeline.ts';
import type { ReaderSessionMorphSourceKind, ReaderSessionMorphSourceMeasurement } from './ReaderSessionMorphState';
import type { ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import {
  READER_SESSION_LAUNCH_BLUR_IN_MS,
  READER_SESSION_LAUNCH_BLUR_IN_START_MS,
  READER_SESSION_LAUNCH_BLUR_OUT_MS,
  READER_SESSION_LAUNCH_BLUR_OUT_START_MS,
  READER_SESSION_LAUNCH_BLUR_VP,
  READER_SESSION_LAUNCH_CONTROL_RELEASE_MS,
  READER_SESSION_LAUNCH_DOT_SIZE_VP,
  READER_SESSION_LAUNCH_DURATION_MS,
  READER_SESSION_LAUNCH_EXPAND_MS,
  READER_SESSION_LAUNCH_EXPAND_START_MS,
  READER_SESSION_LAUNCH_FLIGHT_MS,
  READER_SESSION_LAUNCH_FLIGHT_START_MS,
  READER_SESSION_LAUNCH_FOOTER_FIRST_MS,
  READER_SESSION_LAUNCH_FOOTER_FIRST_START_MS,
  READER_SESSION_LAUNCH_FOOTER_SECOND_MS,
  READER_SESSION_LAUNCH_FOOTER_SECOND_START_MS,
  READER_SESSION_LAUNCH_HANDOFF_MS,
  READER_SESSION_LAUNCH_HANDOFF_START_MS,
  READER_SESSION_LAUNCH_INFO_MS,
  READER_SESSION_LAUNCH_INFO_START_MS,
  READER_SESSION_LAUNCH_OUTGOING_MS,
  READER_SESSION_LAUNCH_OUTGOING_START_MS,
  READER_SESSION_LAUNCH_PAUSE_GAP_VP,
  READER_SESSION_LAUNCH_SETTLED_MS,
  READER_SESSION_LAUNCH_SHARP_MS,
  READER_SESSION_LAUNCH_SHARP_START_MS,
  READER_SESSION_LAUNCH_SOURCE_RELEASE_MS,
} from './ReaderSessionLaunchTimeline.ts';

export interface ReaderSessionLaunchCurves {
  flight: (p: number) => number;
  expand: (p: number) => number;
  easeIn: (p: number) => number;
  easeOut: (p: number) => number;
  easeInOut: (p: number) => number;
}

export interface ReaderSessionLaunchDesign {
  readonly type: ReaderSessionCapsuleType;
  readonly width: number;
  readonly height: number;
  readonly capsuleWidth: number;
  readonly contentScale: number;
  readonly contentTranslateX: number;
  readonly contentTranslateY: number;
  readonly contentBaseOffset: number;
  readonly sourceRadius: number;
  readonly footerStart: number;
  readonly footerDot: number;
  readonly footerEnd: number;
  readonly dockExitDistance: number;
}

const QUICK_AUTO: ReaderSessionLaunchDesign = {
  type: 'autoPage', width: 286, height: 196, capsuleWidth: 96, contentScale: .084,
  contentTranslateX: -131, contentTranslateY: -86, contentBaseOffset: -1, sourceRadius: 8,
  footerStart: 101.45, footerDot: 72, footerEnd: 0, dockExitDistance: 348.557,
};
const QUICK_TTS: ReaderSessionLaunchDesign = {
  type: 'tts', width: 286, height: 190, capsuleWidth: 94, contentScale: .084,
  contentTranslateX: -131, contentTranslateY: -83, contentBaseOffset: -1, sourceRadius: 8,
  footerStart: 101.452, footerDot: 72, footerEnd: 2, dockExitDistance: 348.557,
};
const FULL_AUTO: ReaderSessionLaunchDesign = {
  type: 'autoPage', width: 316.675, height: 104.384, capsuleWidth: 96, contentScale: .076,
  contentTranslateX: -146.337, contentTranslateY: -40.192, contentBaseOffset: 0, sourceRadius: 12,
  footerStart: 101, footerDot: 72, footerEnd: 0, dockExitDistance: 755.5,
};
const FULL_TTS: ReaderSessionLaunchDesign = {
  type: 'tts', width: 312, height: 128, capsuleWidth: 94, contentScale: .077,
  contentTranslateX: -144, contentTranslateY: -52, contentBaseOffset: 0, sourceRadius: 12,
  footerStart: 99, footerDot: 70, footerEnd: 0, dockExitDistance: 755,
};

export function readerSessionLaunchDesign(kind: ReaderSessionMorphSourceKind): ReaderSessionLaunchDesign {
  if (kind === 'quickAutoPage') return QUICK_AUTO;
  if (kind === 'quickTts') return QUICK_TTS;
  if (kind === 'fullAutoPagePlayback') return FULL_AUTO;
  return FULL_TTS;
}

export interface ReaderSessionLaunchGeometryInput {
  readonly source: ReaderSessionMorphSourceMeasurement;
  /** Final capsule's left/top in the same viewport coordinates as source. */
  readonly targetLeft: number;
  readonly targetTop: number;
  /** Measured localized width; never smaller than the authored 96/94. */
  readonly capsuleWidth?: number;
  /** Positive distances based on current top bar / dock geometry, not screen type. */
  readonly topBarExitDistance: number;
  readonly dockExitDistance: number;
}

export interface ReaderSessionLaunchGeometry {
  readonly kind: ReaderSessionMorphSourceKind;
  readonly type: ReaderSessionCapsuleType;
  readonly sourceLeft: number;
  readonly sourceTop: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly sourceRevision: number;
  readonly sourceActorId: string;
  readonly sourceClipLeft: number;
  readonly sourceClipTop: number;
  readonly sourceClipRightInset: number;
  readonly sourceClipBottomInset: number;
  readonly targetLeft: number;
  readonly targetTop: number;
  readonly capsuleWidth: number;
  readonly dotLeft: number;
  readonly topBarExitDistance: number;
  readonly dockExitDistance: number;
  readonly contentFinalScale: number;
  readonly contentFinalTranslateX: number;
  readonly contentFinalTranslateY: number;
  readonly contentBaseOffset: number;
  readonly sourceRadius: number;
  readonly footerStart: number;
  readonly footerDot: number;
  readonly footerEnd: number;
}

/** No UI lookup, snapshot capture or hidden layout is performed by this builder. */
export function buildReaderSessionLaunchGeometry(
  input: ReaderSessionLaunchGeometryInput,
): ReaderSessionLaunchGeometry | undefined {
  const source = input.source;
  const design = readerSessionLaunchDesign(source.kind);
  const width = input.capsuleWidth === undefined ? design.capsuleWidth : input.capsuleWidth;
  if (!Number.isFinite(source.left) || !Number.isFinite(source.top) ||
    !Number.isFinite(source.width) || !Number.isFinite(source.height) ||
    source.width <= 0 || source.height <= 0 || !Number.isFinite(source.revision) ||
    !Number.isFinite(input.targetLeft) || !Number.isFinite(input.targetTop) ||
    !Number.isFinite(width) || width < design.capsuleWidth ||
    !Number.isFinite(input.topBarExitDistance) || input.topBarExitDistance < 0 ||
    !Number.isFinite(input.dockExitDistance) || input.dockExitDistance < 0) return undefined;
  const clipLeft = source.visibleLeft ?? 0, clipTop = source.visibleTop ?? 0;
  const clipRight = source.visibleRight ?? source.width, clipBottom = source.visibleBottom ?? source.height;
  if (![clipLeft, clipTop, clipRight, clipBottom].every(Number.isFinite) || clipLeft < 0 || clipTop < 0 ||
    clipRight > source.width || clipBottom > source.height || clipRight <= clipLeft || clipBottom <= clipTop ||
    (source.cornerRadius !== undefined && (!Number.isFinite(source.cornerRadius) || source.cornerRadius < 0))) return undefined;
  return {
    kind: source.kind, type: design.type,
    sourceLeft: source.left, sourceTop: source.top, sourceWidth: source.width, sourceHeight: source.height,
    sourceRevision: source.revision, sourceActorId: source.actorId,
    sourceClipLeft: Math.max(0, source.visibleLeft ?? 0),
    sourceClipTop: Math.max(0, source.visibleTop ?? 0),
    sourceClipRightInset: Math.max(0, source.width - (source.visibleRight ?? source.width)),
    sourceClipBottomInset: Math.max(0, source.height - (source.visibleBottom ?? source.height)),
    targetLeft: input.targetLeft, targetTop: input.targetTop, capsuleWidth: width,
    dotLeft: input.targetLeft + width - READER_SESSION_LAUNCH_DOT_SIZE_VP,
    topBarExitDistance: input.topBarExitDistance, dockExitDistance: input.dockExitDistance,
    // Retain the original quantized Figma scale at its authored size. For a
    // responsive source, scale uniformly; never independently squeeze x/y.
    contentFinalScale: design.contentScale * design.width / source.width,
    contentFinalTranslateX: design.contentTranslateX *
      (source.width - READER_SESSION_LAUNCH_DOT_SIZE_VP) / (design.width - READER_SESSION_LAUNCH_DOT_SIZE_VP),
    contentFinalTranslateY: design.contentTranslateY *
      (source.height - READER_SESSION_LAUNCH_DOT_SIZE_VP) / (design.height - READER_SESSION_LAUNCH_DOT_SIZE_VP),
    contentBaseOffset: design.contentBaseOffset, sourceRadius: source.cornerRadius ?? design.sourceRadius,
    footerStart: design.footerStart + width - design.capsuleWidth,
    footerDot: design.footerDot + width - design.capsuleWidth, footerEnd: design.footerEnd,
  };
}

export type ReaderSessionLaunchPhase = 'initial' | 'flight' | 'dotHold' | 'expand' | 'settled';

/** One immutable render sample, shared by all twelve actors and the Window owner. */
export interface ReaderSessionLaunchSample {
  readonly timeMs: number;
  readonly phase: ReaderSessionLaunchPhase;
  readonly type: ReaderSessionCapsuleType;
  readonly finished: boolean;
  readonly settled: boolean;
  readonly sourceNeeded: boolean;
  readonly controlsPresented: boolean;
  readonly flight: number;
  readonly expansion: number;
  readonly proxyLeft: number;
  readonly proxyTop: number;
  readonly proxyWidth: number;
  readonly proxyHeight: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly sourceRadius: number;
  readonly sourceClipLeft: number;
  readonly sourceClipTop: number;
  readonly sourceClipRightInset: number;
  readonly sourceClipBottomInset: number;
  readonly sourceContentBaseOffset: number;
  readonly sourceSurfaceOpacity: number;
  readonly canonicalSurfaceOpacity: number;
  readonly sharpOpacity: number;
  readonly blurOpacity: number;
  readonly blurRadius: number;
  readonly sourceContentScale: number;
  readonly sourceContentTranslateX: number;
  readonly sourceContentTranslateY: number;
  readonly leadingOffsetX: number;
  readonly leadingOpacity: number;
  readonly pauseX: number;
  readonly pauseOpacity: number;
  readonly capsuleWidth: number;
  readonly footerTranslateX: number;
  readonly footerOpacity: number;
  readonly immersiveOpacity: number;
  readonly topBarOffsetY: number;
  readonly dockOffsetY: number;
}

/** Platform-native Beziers are injected once; no per-frame curve construction. */
export function sampleReaderSessionLaunch(
  elapsedMs: number, geometry: ReaderSessionLaunchGeometry, curves: ReaderSessionLaunchCurves,
  reducedMotion: boolean = false,
): ReaderSessionLaunchSample {
  const time = reducedMotion ? READER_SESSION_LAUNCH_DURATION_MS :
    Math.max(0, Math.min(READER_SESSION_LAUNCH_DURATION_MS, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  const flight = motionSegment(time, READER_SESSION_LAUNCH_FLIGHT_START_MS, READER_SESSION_LAUNCH_FLIGHT_MS, curves.flight);
  const expansion = motionSegment(time, READER_SESSION_LAUNCH_EXPAND_START_MS, READER_SESSION_LAUNCH_EXPAND_MS, curves.expand);
  const handoff = motionSegment(time, READER_SESSION_LAUNCH_HANDOFF_START_MS, READER_SESSION_LAUNCH_HANDOFF_MS, curves.easeOut);
  const sharp = 1 - motionSegment(time, READER_SESSION_LAUNCH_SHARP_START_MS, READER_SESSION_LAUNCH_SHARP_MS, curves.easeIn);
  const blur = time < READER_SESSION_LAUNCH_BLUR_OUT_START_MS ?
    .6 * motionSegment(time, READER_SESSION_LAUNCH_BLUR_IN_START_MS, READER_SESSION_LAUNCH_BLUR_IN_MS, curves.easeInOut) :
    .6 * (1 - motionSegment(time, READER_SESSION_LAUNCH_BLUR_OUT_START_MS, READER_SESSION_LAUNCH_BLUR_OUT_MS, curves.easeOut));
  const info = motionSegment(time, READER_SESSION_LAUNCH_INFO_START_MS, READER_SESSION_LAUNCH_INFO_MS, curves.easeOut);
  const outgoing = motionSegment(time, READER_SESSION_LAUNCH_OUTGOING_START_MS, READER_SESSION_LAUNCH_OUTGOING_MS, curves.easeIn);
  const expandedWidth = geometry.capsuleWidth - READER_SESSION_LAUNCH_DOT_SIZE_VP;
  const footerDot = geometry.footerDot;
  const footerFirst = motionSegment(time, READER_SESSION_LAUNCH_FOOTER_FIRST_START_MS, READER_SESSION_LAUNCH_FOOTER_FIRST_MS, curves.easeInOut);
  const footerSecond = motionSegment(time, READER_SESSION_LAUNCH_FOOTER_SECOND_START_MS, READER_SESSION_LAUNCH_FOOTER_SECOND_MS, curves.easeInOut);
  const proxyLeft = geometry.sourceLeft + (geometry.dotLeft - geometry.sourceLeft) * flight - expandedWidth * expansion;
  const authoredFooter = geometry.footerStart + (footerDot - geometry.footerStart) * footerFirst +
    (geometry.footerEnd - footerDot) * footerSecond;
  // PH10: the authored footer ease-in-out lags the shell's fast expansion.
  // Preserve all 3500ms tracks; once both actors share the footer lane, project
  // the footer onto the non-intersecting side of the moving shell. The final
  // localized text layout already reserves the canonical five-vp gap.
  const footerOffset = time >= READER_SESSION_LAUNCH_SOURCE_RELEASE_MS ?
    Math.min(authoredFooter, proxyLeft - geometry.targetLeft) : authoredFooter;
  return {
    timeMs: time, phase: time < READER_SESSION_LAUNCH_FLIGHT_START_MS ? 'initial' :
      time < READER_SESSION_LAUNCH_SOURCE_RELEASE_MS ? 'flight' :
        time < READER_SESSION_LAUNCH_EXPAND_START_MS ? 'dotHold' :
          time < READER_SESSION_LAUNCH_SETTLED_MS ? 'expand' : 'settled',
    type: geometry.type, finished: time >= READER_SESSION_LAUNCH_DURATION_MS,
    settled: time >= READER_SESSION_LAUNCH_SETTLED_MS,
    sourceNeeded: time < READER_SESSION_LAUNCH_SOURCE_RELEASE_MS,
    controlsPresented: time < READER_SESSION_LAUNCH_CONTROL_RELEASE_MS,
    flight, expansion,
    proxyLeft,
    proxyTop: geometry.sourceTop + (geometry.targetTop - geometry.sourceTop) * flight,
    proxyWidth: geometry.sourceWidth +
      (READER_SESSION_LAUNCH_DOT_SIZE_VP - geometry.sourceWidth) * flight + expandedWidth * expansion,
    proxyHeight: geometry.sourceHeight + (24 - geometry.sourceHeight) * flight,
    sourceWidth: geometry.sourceWidth, sourceHeight: geometry.sourceHeight, sourceRadius: geometry.sourceRadius,
    // Actual Scroll viewport clipping is retained on the first frame and
    // releases continuously as the existing flight leaves the source region.
    sourceClipLeft: geometry.sourceClipLeft * (1 - flight),
    sourceClipTop: geometry.sourceClipTop * (1 - flight),
    sourceClipRightInset: geometry.sourceClipRightInset * (1 - flight),
    sourceClipBottomInset: geometry.sourceClipBottomInset * (1 - flight),
    sourceContentBaseOffset: geometry.contentBaseOffset,
    sourceSurfaceOpacity: 1 - handoff, canonicalSurfaceOpacity: handoff,
    sharpOpacity: sharp, blurOpacity: blur, blurRadius: READER_SESSION_LAUNCH_BLUR_VP,
    sourceContentScale: 1 + (geometry.contentFinalScale - 1) * flight,
    sourceContentTranslateX: geometry.contentFinalTranslateX * flight,
    sourceContentTranslateY: geometry.contentFinalTranslateY * flight,
    leadingOffsetX: -expandedWidth * (1 - expansion),
    // Figma HOLD/step-end: visible on the boundary, not after a later fade.
    leadingOpacity: time >= READER_SESSION_LAUNCH_EXPAND_START_MS ? 1 : 0,
    pauseX: READER_SESSION_LAUNCH_PAUSE_GAP_VP + expandedWidth * expansion, pauseOpacity: handoff,
    capsuleWidth: geometry.capsuleWidth,
    footerTranslateX: footerOffset,
    footerOpacity: info, immersiveOpacity: info,
    topBarOffsetY: -geometry.topBarExitDistance * outgoing,
    dockOffsetY: geometry.dockExitDistance * outgoing,
  };
}
