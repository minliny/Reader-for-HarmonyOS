export const READER_ISLAND_TARGET_VP = 44;
export const READER_ISLAND_TRANSPORT_ICON_VP = 18;
export const READER_ISLAND_TRANSPORT_LABEL_GAP = 3;
export const READER_ISLAND_ACTION_INSET = 3;
export const READER_ISLAND_PLAYBACK_INSET_X = 10;
export const READER_ISLAND_PLAYBACK_INSET_Y = 6;
export const READER_ISLAND_PLAYBACK_STATUS_GAP = 2;
export const READER_ISLAND_PLAYBACK_ACTION_GAP = 6;

const PLAYBACK_MIN_HEIGHT_VP = 84;
const STATUS_MIN_HEIGHT_VP = 22;

export interface ReaderIslandPlaybackFonts {
  actionSize: number;
  actionLineHeight: number;
  statusLineHeight: number;
}

export interface ReaderIslandPlaybackLayout {
  columns: number;
  rowHeight: number;
  statusHeight: number;
  height: number;
}

export function readerIslandPlaybackLayout(cardWidth: number, fontScale: number, labelLength: number,
  fonts: ReaderIslandPlaybackFonts): ReaderIslandPlaybackLayout {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const minActionWidth = Math.max(READER_ISLAND_TARGET_VP, Math.ceil(labelLength * fonts.actionSize * scale) +
    READER_ISLAND_TRANSPORT_ICON_VP + READER_ISLAND_TRANSPORT_LABEL_GAP + 2 * READER_ISLAND_ACTION_INSET);
  const innerWidth = Math.floor(Math.max(0, cardWidth - 2 * READER_ISLAND_PLAYBACK_INSET_X));
  const gap = READER_ISLAND_PLAYBACK_ACTION_GAP;
  const compactWidth = Math.floor((innerWidth - 3 * gap) / 4.25);
  const pairWidth = Math.floor((innerWidth - gap) / 2);
  const columns = compactWidth >= minActionWidth ? 4 : pairWidth >= minActionWidth ? 2 : 1;
  const rowHeight = Math.max(READER_ISLAND_TARGET_VP, Math.ceil(fonts.actionLineHeight * scale));
  const statusHeight = Math.max(STATUS_MIN_HEIGHT_VP, Math.ceil(fonts.statusLineHeight * scale));
  const rows = 4 / columns;
  return {
    columns,
    rowHeight,
    statusHeight,
    height: Math.max(PLAYBACK_MIN_HEIGHT_VP, rows * rowHeight + (rows - 1) * gap +
      statusHeight + READER_ISLAND_PLAYBACK_STATUS_GAP + 2 * READER_ISLAND_PLAYBACK_INSET_Y),
  };
}
