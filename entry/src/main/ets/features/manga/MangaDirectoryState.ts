import type { LocalReadingDownloadState, LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import type { MangaDirectoryRowPresentation } from './MangaDirectoryPresentation';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryScale } from './MangaDirectoryVisual.ts';

/** Only admitted download facts receive text. Cached manga is not proven complete. */
export function mangaDirectoryDownloadStatusText(state: LocalReadingDownloadState | undefined,
  completedGlyph: boolean = false): string {
  if (state === 'completed') return completedGlyph ? '' : '已下载';
  if (state === 'queued') return '等待下载';
  if (state === 'paused') return '已暂停';
  if (state === 'inProgress') return '下载中';
  if (state === 'cached') return '已保存';
  if (state === 'failed') return '下载失败';
  if (state === 'cancelled') return '已取消';
  return '';
}

/** Finite meta strings use the existing font and the same budget as their paint. */
export function mangaDirectoryDownloadStatusWidth(state: LocalReadingDownloadState | undefined,
  completedGlyph: boolean, fontScale: number): number {
  const text = mangaDirectoryDownloadStatusText(state, completedGlyph);
  return text.length === 0 ? 0 : Array.from(text).length * MANGA_DIRECTORY_VISUAL.metaFontSize *
    mangaDirectoryScale(fontScale) + MANGA_DIRECTORY_VISUAL.contentGap * 2;
}

/** Existing explicit full-catalog paths may enrich a flat query; no tree is inferred. */
export function mangaDirectoryContextEntries(entries: LocalReadingTocEntry[],
  presentation: Map<number, MangaDirectoryRowPresentation>): LocalReadingTocEntry[] {
  return entries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({ ...entry,
    contextTitle: entry.contextTitle?.trim().length ? entry.contextTitle : presentation.get(entry.index)?.contextTitle }));
}
