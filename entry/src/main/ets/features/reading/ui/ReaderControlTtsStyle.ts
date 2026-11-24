import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
/** TTS palette compatibility exports. Rendering reads the active app scheme. */
export const TOK_TTS_INK = readerAppColor('TOK_TTS_INK', 'day');
export const TOK_TTS_MUTED = readerAppColor('TOK_TTS_MUTED', 'day');
export const TOK_TTS_TEAL = readerAppColor('TOK_TTS_TEAL', 'day');
export const TOK_TTS_TEAL_SOFT = readerAppColor('TOK_TTS_TEAL_SOFT', 'day');
export const TOK_TTS_TEAL_LINE = readerAppColor('TOK_TTS_TEAL_LINE', 'day');
export const TOK_TTS_PLAY_START = readerAppColor('TOK_TTS_PLAY_START', 'day');
export const TOK_TTS_PLAY_END = readerAppColor('TOK_TTS_PLAY_END', 'day');
export const TOK_TTS_CLAY = readerAppColor('TOK_TTS_CLAY', 'day');
export const TOK_TTS_CLAY_SOFT = readerAppColor('TOK_TTS_CLAY_SOFT', 'day');
export const TOK_TTS_CLAY_LINE = readerAppColor('TOK_TTS_CLAY_LINE', 'day');
export const TOK_TTS_PAPER = readerAppColor('TOK_TTS_PAPER', 'day');
export const TOK_TTS_PAPER_START = readerAppColor('TOK_TTS_PAPER_START', 'day');
export const TOK_TTS_PAPER_END = readerAppColor('TOK_TTS_PAPER_END', 'day');
export const TOK_TTS_CARD = readerAppColor('TOK_TTS_CARD', 'day');
export const TOK_TTS_QUICK_CARD = readerAppColor('TOK_TTS_QUICK_CARD', 'day');
export const TOK_TTS_LINE = readerAppColor('TOK_TTS_LINE', 'day');
export const TOK_TTS_FIELD = readerAppColor('TOK_TTS_FIELD', 'day');
export const TOK_TTS_TRACK = readerAppColor('TOK_TTS_TRACK', 'day');

/** Keep the Quick-to-Full highlight tied to the shared panel progress. */
export function readerTtsPlayGradientStart(progress: number, appScheme: string = 'day'): string {
  const p = Math.max(0, Math.min(1, progress));
  const start = readerAppColor('TOK_TTS_PLAY_START', appScheme);
  const end = readerAppColor('TOK_TTS_TEAL', appScheme);
  return '#' + [3, 5, 7].map((offset: number): string => {
    const a = Number.parseInt(start.slice(offset, offset + 2), 16);
    const b = Number.parseInt(end.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * p).toString(16).padStart(2, '0');
  }).join('');
}
