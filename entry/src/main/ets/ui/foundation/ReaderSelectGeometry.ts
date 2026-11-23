/** Geometry for the existing compact select family. Native ArkUI still owns
 * text measurement, wrapping, popup placement and input. Values are in vp. */
export type ReaderSelectMenuKind = 'standard' | 'source';

export const READER_SELECT_TRIGGER_CHROME: number = 42;
export const SOURCE_GROUP_SELECT_RADIUS: number = 8;
export const SOURCE_GROUP_SELECT_TEXT_INSET: number = 14;
export const SOURCE_GROUP_SELECT_ARROW_SIZE: number = 12;
export const SOURCE_GROUP_SELECT_ARROW_END: number = 9;
export const SOURCE_GROUP_SELECT_ARROW_TARGET: number = 44;
export const SOURCE_GROUP_SELECT_PAINT_INSET: number = 2;

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function readerSelectAvailableWidth(width: number, safeLeft: number, safeRight: number): number {
  return Math.max(0, nonNegative(width) - Math.max(16, nonNegative(safeLeft)) - Math.max(16, nonNegative(safeRight)));
}

export function readerSelectTriggerWidth(textWidth: number, availableWidth: number, controlWidth: number = 0): number {
  const cap = controlWidth > 0 ? Math.min(nonNegative(controlWidth), nonNegative(availableWidth)) : nonNegative(availableWidth);
  return Math.min(cap, Math.ceil(nonNegative(textWidth)) + READER_SELECT_TRIGGER_CHROME);
}

export function readerSelectMenuWidth(contentWidth: number, viewportWidth: number, availableWidth: number,
  kind: ReaderSelectMenuKind = 'standard'): number {
  const cap = kind === 'source' ? Math.min(264, Math.floor(nonNegative(viewportWidth) * .74), nonNegative(availableWidth)) : nonNegative(availableWidth);
  return Math.min(cap, Math.ceil(nonNegative(contentWidth)));
}
