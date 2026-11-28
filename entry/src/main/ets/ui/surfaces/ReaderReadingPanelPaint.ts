import { readerAppColor } from '../foundation/ReaderAppColors';

export interface ReaderReadingPanelPaint {
  readonly surface: string | undefined;
  readonly outline: string;
  readonly outlineWidth: number;
  readonly nativeShadow: boolean;
}

export interface ReaderSurfaceOutlinePaint {
  readonly color: string;
  readonly width: number;
}

export function readerSurfaceOutlinePaint(scheme: string): ReaderSurfaceOutlinePaint {
  return { color: readerAppColor('TOK_LINE_STRONG', scheme), width: 1 };
}

export function readerReadingPanelPaint(scheme: string, nativeMaterial: boolean): ReaderReadingPanelPaint {
  const edge = readerSurfaceOutlinePaint(scheme);
  return {
    surface: nativeMaterial ? undefined : readerAppColor('TOK_READ_SURFACE', scheme),
    outline: edge.color,
    outlineWidth: edge.width,
    nativeShadow: nativeMaterial,
  };
}

export interface ReaderIslandCardPaint {
  readonly surface: string;
  readonly border: string;
}

export function readerIslandCardPaint(scheme: string, emphasis: boolean): ReaderIslandCardPaint {
  return {
    surface: readerAppColor(emphasis ? 'TOK_READ_CARD_EMPHASIS' : 'TOK_READ_ELEVATED', scheme),
    border: readerAppColor(emphasis ? 'TOK_LINE_STRONG' : 'TOK_LINE', scheme),
  };
}
