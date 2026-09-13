import {
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
  TOK_LINE,
  TOK_LINE_STRONG,
} from '../common/ReaderTokens';

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

export function readerControlThemeStyle(_themeId: string): ReaderControlThemeStyle {
  return {
    ink: TOK_READ_INK,
    muted: TOK_READ_MUTED,
    primary: TOK_READ_PRIMARY,
    panel: TOK_SURFACE_PANEL,
    panelSoft: TOK_SURFACE_PANEL_SOFT,
    line: TOK_LINE,
    lineStrong: TOK_LINE_STRONG,
  };
}
