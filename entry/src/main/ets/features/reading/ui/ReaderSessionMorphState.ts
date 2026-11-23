export type ReaderSessionMorphSourceKind =
  'quickAutoPage' | 'quickTts' | 'fullAutoPagePlayback' | 'fullTtsPlayback';

export class ReaderSessionMorphSourceMeasurement {
  readonly kind: ReaderSessionMorphSourceKind;
  readonly actorId: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly visibleLeft: number;
  readonly visibleTop: number;
  readonly visibleRight: number;
  readonly visibleBottom: number;
  readonly cornerRadius: number | undefined;

  constructor(
    kind: ReaderSessionMorphSourceKind,
    actorId: string,
    left: number,
    top: number,
    width: number,
    height: number,
    revision: number,
    visibleLeft: number = 0, visibleTop: number = 0,
    visibleRight: number = width, visibleBottom: number = height,
    cornerRadius?: number,
  ) {
    this.kind = kind;
    this.actorId = actorId;
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
    this.revision = revision;
    this.visibleLeft = visibleLeft; this.visibleTop = visibleTop;
    this.visibleRight = visibleRight; this.visibleBottom = visibleBottom;
    this.cornerRadius = cornerRadius;
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
