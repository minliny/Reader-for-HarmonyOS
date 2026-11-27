import { motionSegment } from '../../../ui/foundation/MotionTimeline.ts';
import type { ReaderSessionMorphSourceKind, ReaderSessionMorphSourceMeasurement } from './ReaderSessionMorphState';
import type { ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import {
  READER_SESSION_LAUNCH_CAPSULE_CONTENT_REVEAL_MS,
  READER_SESSION_LAUNCH_CONTROL_RELEASE_MS,
  READER_SESSION_LAUNCH_DOT_SIZE_VP,
  READER_SESSION_LAUNCH_DURATION_MS,
  READER_SESSION_LAUNCH_EXPAND_MS,
  READER_SESSION_LAUNCH_EXPAND_START_MS,
  READER_SESSION_LAUNCH_FLIGHT_MS,
  READER_SESSION_LAUNCH_PAUSE_GAP_VP,
  READER_SESSION_LAUNCH_SOURCE_CONTENT_FADE_START_MS,
  READER_SESSION_LAUNCH_SOURCE_RELEASE_MS,
} from './ReaderSessionLaunchTimeline.ts';

export interface ReaderSessionLaunchCurves {
  flight: (p: number) => number;
  expand: (p: number) => number;
  easeOut: (p: number) => number;
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
  /** The island source is the measured playback card at the active width and font scale. */
  readonly fixedIsland?: boolean;
  /** Final capsule's left/top in the same viewport coordinates as source. */
  readonly targetLeft: number;
  readonly targetTop: number;
  /** Measured localized width; never smaller than the authored 96/94. */
  readonly capsuleWidth?: number;
  readonly capsuleHeight?: number;
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
  readonly capsuleHeight: number;
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
  const legacy = input.fixedIsland === true ? undefined : readerSessionLaunchDesign(source.kind);
  const type: ReaderSessionCapsuleType = source.kind === 'quickAutoPage' || source.kind === 'fullAutoPagePlayback' ?
    'autoPage' : 'tts';
  const dotSize = READER_SESSION_LAUNCH_DOT_SIZE_VP;
  const minimumCapsuleWidth = type === 'autoPage' ? 96 : 94;
  const width = input.capsuleWidth ?? minimumCapsuleWidth;
  const height = input.capsuleHeight ?? dotSize;
  if (!Number.isFinite(source.left) || !Number.isFinite(source.top) ||
    !Number.isFinite(source.width) || !Number.isFinite(source.height) ||
    source.width <= 0 || source.height <= 0 || !Number.isFinite(source.revision) ||
    !Number.isFinite(input.targetLeft) || !Number.isFinite(input.targetTop) ||
    !Number.isFinite(width) || width < minimumCapsuleWidth ||
    !Number.isFinite(height) || height < dotSize ||
    !Number.isFinite(input.topBarExitDistance) || input.topBarExitDistance < 0 ||
    !Number.isFinite(input.dockExitDistance) || input.dockExitDistance < 0) return undefined;
  const clipLeft = source.visibleLeft ?? 0, clipTop = source.visibleTop ?? 0;
  const clipRight = source.visibleRight ?? source.width, clipBottom = source.visibleBottom ?? source.height;
  if (![clipLeft, clipTop, clipRight, clipBottom].every(Number.isFinite) || clipLeft < 0 || clipTop < 0 ||
    clipRight > source.width || clipBottom > source.height || clipRight <= clipLeft || clipBottom <= clipTop ||
    (source.cornerRadius !== undefined && (!Number.isFinite(source.cornerRadius) || source.cornerRadius < 0))) return undefined;
  return {
    kind: source.kind, type,
    sourceLeft: source.left, sourceTop: source.top, sourceWidth: source.width, sourceHeight: source.height,
    sourceRevision: source.revision, sourceActorId: source.actorId,
    sourceClipLeft: Math.max(0, source.visibleLeft ?? 0),
    sourceClipTop: Math.max(0, source.visibleTop ?? 0),
    sourceClipRightInset: Math.max(0, source.width - (source.visibleRight ?? source.width)),
    sourceClipBottomInset: Math.max(0, source.height - (source.visibleBottom ?? source.height)),
    targetLeft: input.targetLeft, targetTop: input.targetTop, capsuleWidth: width, capsuleHeight: height,
    dotLeft: input.targetLeft + width - dotSize,
    topBarExitDistance: input.topBarExitDistance, dockExitDistance: input.dockExitDistance,
    // Islands can reflow from one to four control columns. Fit their actual
    // rect uniformly and keep its center aligned to the center of the shrinking proxy.
    contentFinalScale: legacy === undefined ? Math.min(1, dotSize / Math.max(source.width, source.height)) :
      legacy.contentScale * legacy.width / source.width,
    contentFinalTranslateX: legacy === undefined ? (dotSize - source.width) / 2 :
      legacy.contentTranslateX * (source.width - dotSize) / (legacy.width - dotSize),
    contentFinalTranslateY: legacy === undefined ? (dotSize - source.height) / 2 :
      legacy.contentTranslateY * (source.height - dotSize) / (legacy.height - dotSize),
    contentBaseOffset: legacy?.contentBaseOffset ?? 0, sourceRadius: source.cornerRadius ?? legacy?.sourceRadius ?? 12,
    footerStart: legacy === undefined ? width : legacy.footerStart + width - legacy.capsuleWidth,
    footerDot: legacy === undefined ? width - dotSize : legacy.footerDot + width - legacy.capsuleWidth,
    footerEnd: legacy?.footerEnd ?? 0,
  };
}

export type ReaderSessionLaunchPhase = 'flight' | 'overlap' | 'expand' | 'settled';

/** One immutable render sample shared by the visual actors and the Window owner. */
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
  readonly sourceContentScale: number;
  readonly sourceContentTranslateX: number;
  readonly sourceContentTranslateY: number;
  readonly leadingOffsetX: number;
  readonly leadingOpacity: number;
  readonly pauseX: number;
  readonly pauseOpacity: number;
  readonly capsuleWidth: number;
  readonly capsuleHeight: number;
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
  const flight = motionSegment(time, 0, READER_SESSION_LAUNCH_FLIGHT_MS, curves.flight);
  const expansion = motionSegment(time, READER_SESSION_LAUNCH_EXPAND_START_MS, READER_SESSION_LAUNCH_EXPAND_MS, curves.expand);
  const handoff = motionSegment(time, READER_SESSION_LAUNCH_EXPAND_START_MS,
    READER_SESSION_LAUNCH_FLIGHT_MS - READER_SESSION_LAUNCH_EXPAND_START_MS, curves.easeOut);
  const sourceContentFade = motionSegment(time, READER_SESSION_LAUNCH_SOURCE_CONTENT_FADE_START_MS,
    READER_SESSION_LAUNCH_EXPAND_START_MS - READER_SESSION_LAUNCH_SOURCE_CONTENT_FADE_START_MS, curves.easeOut);
  const capsuleContentReveal = motionSegment(time, READER_SESSION_LAUNCH_SOURCE_RELEASE_MS,
    READER_SESSION_LAUNCH_CAPSULE_CONTENT_REVEAL_MS, curves.easeOut);
  const outgoing = motionSegment(time, 0, READER_SESSION_LAUNCH_CONTROL_RELEASE_MS, curves.flight);
  const expandedWidth = geometry.capsuleWidth - READER_SESSION_LAUNCH_DOT_SIZE_VP;
  const expandedHeight = geometry.capsuleHeight - READER_SESSION_LAUNCH_DOT_SIZE_VP;
  const proxyLeft = geometry.sourceLeft + (geometry.dotLeft - geometry.sourceLeft) * flight - expandedWidth * expansion;
  const authoredFooter = geometry.footerStart + (geometry.footerDot - geometry.footerStart) * flight +
    (geometry.footerEnd - geometry.footerDot) * expansion;
  // Keep the footer to the left of the shell once they share the same lane.
  const footerOffset = time >= READER_SESSION_LAUNCH_SOURCE_RELEASE_MS ?
    Math.min(authoredFooter, proxyLeft - geometry.targetLeft) : authoredFooter;
  const finished = time >= READER_SESSION_LAUNCH_DURATION_MS;
  return {
    timeMs: time, phase: finished ? 'settled' : time < READER_SESSION_LAUNCH_EXPAND_START_MS ? 'flight' :
      time < READER_SESSION_LAUNCH_FLIGHT_MS ? 'overlap' : 'expand',
    type: geometry.type, finished, settled: finished,
    sourceNeeded: time < READER_SESSION_LAUNCH_SOURCE_RELEASE_MS,
    controlsPresented: time < READER_SESSION_LAUNCH_CONTROL_RELEASE_MS,
    flight, expansion,
    proxyLeft,
    proxyTop: geometry.sourceTop + (geometry.targetTop + expandedHeight / 2 - geometry.sourceTop) * flight -
      expandedHeight / 2 * expansion,
    proxyWidth: geometry.sourceWidth +
      (READER_SESSION_LAUNCH_DOT_SIZE_VP - geometry.sourceWidth) * flight + expandedWidth * expansion,
    proxyHeight: geometry.sourceHeight + (READER_SESSION_LAUNCH_DOT_SIZE_VP - geometry.sourceHeight) * flight + expandedHeight * expansion,
    sourceWidth: geometry.sourceWidth, sourceHeight: geometry.sourceHeight, sourceRadius: geometry.sourceRadius,
    // Actual Scroll viewport clipping is retained on the first frame and
    // releases continuously as the existing flight leaves the source region.
    sourceClipLeft: geometry.sourceClipLeft * (1 - flight),
    sourceClipTop: geometry.sourceClipTop * (1 - flight),
    sourceClipRightInset: geometry.sourceClipRightInset * (1 - flight),
    sourceClipBottomInset: geometry.sourceClipBottomInset * (1 - flight),
    sourceContentBaseOffset: geometry.contentBaseOffset,
    sourceSurfaceOpacity: 1 - handoff, canonicalSurfaceOpacity: handoff,
    sharpOpacity: 1 - sourceContentFade,
    sourceContentScale: 1 + (geometry.contentFinalScale - 1) * flight,
    sourceContentTranslateX: geometry.contentFinalTranslateX * flight,
    sourceContentTranslateY: geometry.contentFinalTranslateY * flight,
    leadingOffsetX: -expandedWidth * (1 - expansion),
    leadingOpacity: capsuleContentReveal,
    pauseX: READER_SESSION_LAUNCH_PAUSE_GAP_VP + expandedWidth * expansion, pauseOpacity: capsuleContentReveal,
    capsuleWidth: geometry.capsuleWidth, capsuleHeight: geometry.capsuleHeight,
    footerTranslateX: footerOffset,
    footerOpacity: expansion, immersiveOpacity: outgoing,
    topBarOffsetY: -geometry.topBarExitDistance * outgoing,
    dockOffsetY: geometry.dockExitDistance * outgoing,
  };
}
