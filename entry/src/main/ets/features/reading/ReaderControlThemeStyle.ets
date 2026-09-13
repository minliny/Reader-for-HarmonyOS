import { readerAppColor } from '../common/ReaderThemeRegistry';
/**
 * Control chrome palette contract. Values intentionally reference the
 * existing Figma-backed Reader tokens; theme-specific replacements must be
 * supplied by the design mapping before they are enabled at runtime.
 */
export interface ReaderControlThemeStyle {
  ink: string;
  muted: string;
  primary: string;
  panel: string;
  panelSoft: string;
  line: string;
  lineStrong: string;
}

export function readerControlThemeStyle(appScheme: string): ReaderControlThemeStyle {
  return {
    ink: readerAppColor('TOK_READ_INK', appScheme),
    muted: readerAppColor('TOK_READ_MUTED', appScheme),
    primary: readerAppColor('TOK_READ_PRIMARY', appScheme),
    panel: readerAppColor('TOK_SURFACE_PANEL', appScheme),
    panelSoft: readerAppColor('TOK_SURFACE_PANEL_SOFT', appScheme),
    line: readerAppColor('TOK_LINE', appScheme),
    lineStrong: readerAppColor('TOK_LINE_STRONG', appScheme),
  };
}
