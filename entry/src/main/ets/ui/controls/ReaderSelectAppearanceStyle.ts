/** Figma Make LOYUJr93KwespD5j7N6icw, Version 9, measured live 2026-09-11. */
import { ReaderRectVp } from '../foundation/ReaderWindowMetrics';
import { readerOverlayListHeight, readerOverlayPanel } from '../layout/ReaderOverlayGeometry';

export const APPEARANCE_SELECT_MENU_WIDTH = 104;
export const APPEARANCE_SELECT_OPTION_HEIGHT = 44;

export function appearanceSelectMenuHeight(optionCount: number): number {
  return readerOverlayListHeight(0, APPEARANCE_SELECT_OPTION_HEIGHT, Math.max(1, optionCount), 0, 3, 3, 1, 0);
}

export interface AppearanceSelectMenuPosition { x: number; y: number; height: number; }

/** Put the menu below the pill, or above when the viewport cannot contain it. */
export function appearanceSelectMenuPosition(right: number, top: number, optionCount: number,
  viewportWidth: number, viewportHeight: number, triggerHeight: number = 30,
  menuHeight?: number): AppearanceSelectMenuPosition {
  const height = menuHeight !== undefined && Number.isFinite(menuHeight) && menuHeight > 0 ?
    menuHeight : appearanceSelectMenuHeight(optionCount);
  const trigger = Number.isFinite(triggerHeight) && triggerHeight > 0 ? triggerHeight : 30;
  const panel = readerOverlayPanel(new ReaderRectVp(0, 0, viewportWidth, viewportHeight), APPEARANCE_SELECT_MENU_WIDTH,
    height, 'anchor-end', new ReaderRectVp(right, top, 0, trigger), 5);
  return { x: panel.left, y: panel.top, height: panel.height };
}
