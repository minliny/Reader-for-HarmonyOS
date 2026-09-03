export type ReaderSessionMorphSourceKind =
  'quickAutoPage' | 'quickTts' | 'fullAutoPagePlayback' | 'fullTtsPlayback';

export type ReaderSessionMorphPhase =
  'none' | 'capture' | 'flight' | 'handoff' | 'dotHold' | 'expand' | 'reveal';

export class ReaderSessionMorphSourceMeasurement {
  readonly kind: ReaderSessionMorphSourceKind;
  readonly actorId: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly revision: number;

  constructor(
    kind: ReaderSessionMorphSourceKind,
    actorId: string,
    left: number,
    top: number,
    width: number,
    height: number,
    revision: number,
  ) {
    this.kind = kind;
    this.actorId = actorId;
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
    this.revision = revision;
  }
}

export class ReaderSessionMorphGeometry {
  readonly sourceLeft: number;
  readonly sourceTop: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly sourceCenterX: number;
  readonly sourceCenterY: number;
  readonly dotCenterX: number;
  readonly dotCenterY: number;
  readonly dotScaleX: number;
  readonly dotScaleY: number;
  readonly capsuleWidth: number;

  constructor(
    sourceLeft: number,
    sourceTop: number,
    sourceWidth: number,
    sourceHeight: number,
    sourceCenterX: number,
    sourceCenterY: number,
    dotCenterX: number,
    dotCenterY: number,
    dotScaleX: number,
    dotScaleY: number,
    capsuleWidth: number,
  ) {
    this.sourceLeft = sourceLeft;
    this.sourceTop = sourceTop;
    this.sourceWidth = sourceWidth;
    this.sourceHeight = sourceHeight;
    this.sourceCenterX = sourceCenterX;
    this.sourceCenterY = sourceCenterY;
    this.dotCenterX = dotCenterX;
    this.dotCenterY = dotCenterY;
    this.dotScaleX = dotScaleX;
    this.dotScaleY = dotScaleY;
    this.capsuleWidth = capsuleWidth;
  }
}

export function readerSessionMorphActorId(kind: ReaderSessionMorphSourceKind): string {
  return `reader-session-morph-${kind}`;
}

export function readerSessionMorphSourceKindForPage(
  page: string,
): ReaderSessionMorphSourceKind | undefined {
  if (page === 'quickAutoPage') return 'quickAutoPage';
  if (page === 'moduleTts') return 'quickTts';
  if (page === 'fullAutoPage') return 'fullAutoPagePlayback';
  if (page === 'fullTts') return 'fullTtsPlayback';
  return undefined;
}

export function createReaderSessionMorphGeometry(
  source: ReaderSessionMorphSourceMeasurement,
  dotCenterX: number,
  dotCenterY: number,
  capsuleWidth: number,
): ReaderSessionMorphGeometry | undefined {
  if (!Number.isFinite(source.left) || !Number.isFinite(source.top) ||
    !Number.isFinite(source.width) || !Number.isFinite(source.height) ||
    source.width <= 0 || source.height <= 0 || !Number.isFinite(dotCenterX) ||
    !Number.isFinite(dotCenterY) || !Number.isFinite(capsuleWidth) || capsuleWidth < 24) {
    return undefined;
  }
  return new ReaderSessionMorphGeometry(
    source.left,
    source.top,
    source.width,
    source.height,
    source.left + source.width / 2,
    source.top + source.height / 2,
    dotCenterX,
    dotCenterY,
    Math.max(24 / source.width, 0.05),
    Math.max(24 / source.height, 0.05),
    capsuleWidth,
  );
}
