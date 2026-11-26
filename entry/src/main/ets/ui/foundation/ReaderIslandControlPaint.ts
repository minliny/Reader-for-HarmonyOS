import type { ReaderAppColorRole } from './ReaderThemeRegistry.ts';

export type ReaderIslandControlTone = 'normal' | 'selected' | 'stop' | 'marked';

export interface ReaderIslandControlPaint {
  readonly surface: ReaderAppColorRole;
  readonly border: ReaderAppColorRole;
  readonly ink: ReaderAppColorRole;
}

const NORMAL: ReaderIslandControlPaint = {
  surface: 'app.readerIsland.controlSurface', border: 'app.readerIsland.controlBorder', ink: 'app.readerIsland.controlInk',
};
const UNAVAILABLE: ReaderIslandControlPaint = {
  surface: 'app.readerIsland.controlDisabledSurface', border: 'app.readerIsland.controlDisabledBorder',
  ink: 'app.readerIsland.controlDisabledInk',
};
const SELECTED: ReaderIslandControlPaint = {
  surface: 'TOK_READ_PRIMARY', border: 'TOK_READ_PRIMARY', ink: 'app.control.onPrimary',
};
const STOP: ReaderIslandControlPaint = {
  surface: 'app.readerIsland.controlStopSurface', border: 'app.readerIsland.controlStopBorder',
  ink: 'app.readerIsland.controlInk',
};
const MARKED: ReaderIslandControlPaint = {
  surface: 'TOK_READ_ACTIVE_SOFT', border: 'TOK_READ_PRIMARY', ink: 'app.readerIsland.controlInk',
};

export function readerIslandControlPaint(available: boolean, tone: ReaderIslandControlTone = 'normal'):
  ReaderIslandControlPaint {
  if (!available) return UNAVAILABLE;
  if (tone === 'selected') return SELECTED;
  if (tone === 'stop') return STOP;
  if (tone === 'marked') return MARKED;
  return NORMAL;
}
