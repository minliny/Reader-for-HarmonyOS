import type { ReaderAppearanceTheme } from '../application/ReaderAppearanceState';
import type { ReaderPageBookmarkMode } from '../presentation/ReaderPageBookmarkModel';
import type { ReaderPageChromeSnapshot } from '../presentation/ReaderPageChromeModel';
import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

export function readerPageSurfaceIdentity(
  sourceId: string, bookId: string, theme: ReaderAppearanceTheme,
  role: 'current' | ReaderPageTurnDirection,
  chapterIndex: number,
  pageStart: number,
  contentVersion: string,
  layoutSignature: string,
): string {
  // Role changes only when a physical page becomes current/adjacent. Normal
  // preparation epochs update props without forcing all mounted page trees
  // to acquire new ComponentSnapshot IDs.
  return [
    'reader-page',
    sourceId,
    bookId,
    chapterIndex.toString(),
    pageStart.toString(),
    contentVersion,
    layoutSignature,
    theme,
    role,
  ].join(':');
}

export function readerPageTextureIdentity(
  sourceId: string, bookId: string, theme: ReaderAppearanceTheme, hideStatusBar: boolean, sessionOverlay: boolean,
  chapterIndex: number,
  pageStart: number,
  contentVersion: string,
  layoutSignature: string,
  bottomJustifyGap: number,
  chrome: ReaderPageChromeSnapshot,
  bookmarkMode: ReaderPageBookmarkMode = 'hidden',
  facingChapterIdentity: string = '',
): string {
  const identity = [
    'reader-bookturn-texture-v2',
    sourceId,
    bookId,
    chapterIndex.toString(),
    pageStart.toString(),
    contentVersion,
    layoutSignature,
    theme,
    bottomJustifyGap.toFixed(3),
    hideStatusBar ? 'status-hidden' : 'status-visible',
    chrome.topStartText,
    chrome.topEndText,
    chrome.bottomStartText,
    chrome.bottomEndText,
    chrome.sessionVisible.toString(),
    chrome.sessionWidth.toString(),
    chrome.sessionHeight.toString(),
    bookmarkMode,
    sessionOverlay ? 'session-overlay' : 'page-chrome',
  ].join('|');
  return facingChapterIdentity.length > 0 ? `${identity}|${facingChapterIdentity}` : identity;
}
