/**
 * Product-surface admission for the shipping HarmonyOS application.
 *
 * L0 is intentionally narrow: bookshelf/lifecycle, local TXT/EPUB reading,
 * remote text reading, source management, and settings that have a real
 * persisted effect. Extended pages stay in source for follow-up milestones,
 * but cannot become reachable merely because a route or Core command exists.
 */
export type ReaderProductProfile = 'l0' | 'extended';

export type ReaderProductSurface =
  'discover' |
  'rss' |
  'sync' |
  'unimplementedSettings';

function configuredReaderProductProfile(): ReaderProductProfile {
  return 'l0';
}

export const READER_PRODUCT_PROFILE: ReaderProductProfile = configuredReaderProductProfile();

export function isReaderProductSurfaceEnabled(surface: ReaderProductSurface): boolean {
  if (READER_PRODUCT_PROFILE !== 'extended') {
    return false;
  }
  return surface === 'discover' || surface === 'rss' || surface === 'sync' ||
    surface === 'unimplementedSettings';
}

export function isReaderMainTabEnabled(key: string): boolean {
  if (key === 'bookshelf' || key === 'settings') {
    return true;
  }
  if (key === 'discover') {
    return isReaderProductSurfaceEnabled('discover');
  }
  if (key === 'rss') {
    return isReaderProductSurfaceEnabled('rss');
  }
  return false;
}
