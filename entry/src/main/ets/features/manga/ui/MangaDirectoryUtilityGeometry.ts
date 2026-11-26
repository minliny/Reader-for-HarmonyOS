import { readerCompactSearchHeight, SEARCH_CONTROL_MIN_TARGET } from '../../../ui/foundation/ReaderSearchControlGeometry';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryScale } from './MangaDirectoryVisual';

export const MANGA_DIRECTORY_UTILITY_ACTION_LINE = 18;

export interface MangaDirectoryUtilityGeometry {
  searchHeight: number;
  gap: number;
  actionHeight: number;
  actionResponseY: number;
  actionResponseHeight: number;
  bottomInset: number;
  height: number;
}

export function mangaDirectoryUtilityGeometry(fontScale: number): MangaDirectoryUtilityGeometry {
  const scale = Math.max(1, mangaDirectoryScale(fontScale));
  const searchHeight = readerCompactSearchHeight(36, MANGA_DIRECTORY_VISUAL.searchLineHeight, scale);
  const gap = 6;
  const actionHeight = Math.ceil(MANGA_DIRECTORY_UTILITY_ACTION_LINE * scale + 12);
  const searchOutset = Math.max(0, SEARCH_CONTROL_MIN_TARGET - searchHeight) / 2;
  const actionResponseHeight = Math.max(actionHeight, SEARCH_CONTROL_MIN_TARGET);
  const actionOutset = (actionResponseHeight - actionHeight) / 2;
  const actionResponseY = -Math.min(actionOutset, gap - searchOutset);
  const bottomInset = actionResponseHeight - actionHeight + actionResponseY;
  return { searchHeight, gap, actionHeight, actionResponseY, actionResponseHeight, bottomInset,
    height: searchHeight + gap + actionHeight + bottomInset };
}
