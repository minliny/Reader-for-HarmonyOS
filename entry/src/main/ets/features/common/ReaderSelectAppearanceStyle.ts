/** Figma Make LOYUJr93KwespD5j7N6icw, Version 9, measured live 2026-09-11. */
export const APPEARANCE_SELECT_FILL = '#1FB4A697';
export const APPEARANCE_SELECT_OPEN_FILL = '#1C2F6373';
export const APPEARANCE_SELECT_SURFACE = '#FFFDF8';
export const APPEARANCE_SELECT_BORDER = '#479B8466';
export const APPEARANCE_SELECT_SELECTED = '#B8EEE6DB';
export const APPEARANCE_SELECT_MENU_WIDTH = 104;
export const APPEARANCE_SELECT_OPTION_HEIGHT = 25;

export function appearanceSelectMenuHeight(optionCount: number): number {
  return Math.max(1, optionCount) * APPEARANCE_SELECT_OPTION_HEIGHT + 8;
}

export interface AppearanceSelectMenuPosition { x: number; y: number; }

/** Put the menu below the pill, or above when the viewport cannot contain it. */
export function appearanceSelectMenuPosition(right: number, top: number, optionCount: number,
  viewportWidth: number, viewportHeight: number): AppearanceSelectMenuPosition {
  const height = appearanceSelectMenuHeight(optionCount);
  const below = top + 30 + 5;
  const requestedY = below + height <= viewportHeight ? below : top - 5 - height;
  return {
    x: Math.max(0, Math.min(right - APPEARANCE_SELECT_MENU_WIDTH, viewportWidth - APPEARANCE_SELECT_MENU_WIDTH)),
    y: Math.max(0, Math.min(requestedY, viewportHeight - height)),
  };
}
