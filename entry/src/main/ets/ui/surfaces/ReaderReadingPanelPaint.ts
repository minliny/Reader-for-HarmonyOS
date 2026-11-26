import { readerAppColor } from '../foundation/ReaderThemeRegistry';

export interface ReaderReadingPanelPaint {
  readonly surface: string | undefined;
  readonly outline: string;
  readonly outlineWidth: number;
  readonly nativeShadow: boolean;
}

export function readerReadingPanelPaint(scheme: string, nativeMaterial: boolean): ReaderReadingPanelPaint {
  return {
    surface: nativeMaterial ? undefined : readerAppColor('TOK_READ_SURFACE', scheme),
    outline: readerAppColor('TOK_LINE_STRONG', scheme),
    outlineWidth: 1.5,
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
