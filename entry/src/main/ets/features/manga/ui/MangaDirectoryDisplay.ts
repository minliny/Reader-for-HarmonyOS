import { MANGA_DIRECTORY_VISUAL, mangaDirectoryScale } from './MangaDirectoryVisual.ts';

export interface MangaDirectoryLabel {
  kind: 'numeric' | 'parts' | 'named';
  numberText: string;
  part: '' | '上' | '中' | '下';
}

export interface MangaDirectoryDisplaySource {
  title: string;
  /** Only Core/source-confirmed display metadata may separate decorations. */
  displayTitle?: string;
  isVip?: boolean;
  /** Official Legado fact: whether this chapter has already been purchased. */
  isPay?: boolean;
  contextTitle?: string;
}

export interface MangaDirectoryDisplayProjection {
  title: string;
  label: MangaDirectoryLabel;
  statusText: string;
  contextTitle: string;
}

/** A finite Reader display grammar. It cannot assign chapter identity,
 * hierarchy, readability or order, and never rewrites the source title. */
export function mangaDirectoryLabel(title: string): MangaDirectoryLabel {
  // Normalize only digit codepoints for recognition. Preserve zero padding;
  // no title-wide NFKC, decorative-prefix stripping or inferred chapter count.
  const recognized = title.replace(/[０-９]/g, (digit: string): string =>
    String.fromCharCode(digit.charCodeAt(0) - 0xFEE0)).trim();
  const base = '(?:([0-9]+)|第\\s*([0-9]+)\\s*[话回章集]|([0-9]+)\\s*[话回章集])';
  const numeric = recognized.match(new RegExp('^' + base + '$'));
  if (numeric !== null) return { kind: 'numeric', numberText: numeric[1] ?? numeric[2] ?? numeric[3], part: '' };
  // Both ends must exist. Mixed full-/half-width parentheses are accepted;
  // partial parentheses, subtitles and unknown suffixes remain full titles.
  const parts = recognized.match(new RegExp('^' + base + '\\s*(?:[（(]\\s*([上中下])\\s*[）)]|[·・]\\s*([上中下])|([上中下]))$'));
  if (parts !== null) return { kind: 'parts', numberText: parts[1] ?? parts[2] ?? parts[3],
    part: (parts[4] ?? parts[5] ?? parts[6]) as '上' | '中' | '下' };
  return { kind: 'named', numberText: '', part: '' };
}

export function mangaDirectoryDisplay(source: MangaDirectoryDisplaySource): MangaDirectoryDisplayProjection {
  const selected = source.displayTitle !== undefined && source.displayTitle.trim().length > 0 ? source.displayTitle : source.title;
  const title = selected.trim().length === 0 || /^第\s*话$/.test(selected.trim()) ? '未命名章节' : selected;
  const statusText = source.isVip === true ? (source.isPay === true ? 'VIP · 已购' : 'VIP') : source.isPay === true ? '已购' : '';
  return { title, label: mangaDirectoryLabel(title), statusText,
    contextTitle: source.contextTitle ?? '' };
}

/** Same finite meta text budget for all renderers. Only explicit source facts
 * add a status; a VIP decoration does not imply that it has been purchased. */
export function mangaDirectoryStatusWidth(statusText: string, fontScale: number = 1): number {
  if (statusText.length === 0) return 0;
  const em = Array.from(statusText).reduce((sum: number, character: string): number =>
    sum + (character.charCodeAt(0) < 128 ? MANGA_DIRECTORY_VISUAL.numericDigitWidthEm : 1), 0);
  return em * MANGA_DIRECTORY_VISUAL.metaFontSize * mangaDirectoryScale(fontScale) + MANGA_DIRECTORY_VISUAL.contentGap;
}
