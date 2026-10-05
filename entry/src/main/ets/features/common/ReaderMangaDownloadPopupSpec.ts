/** Existing catalog download popup geometry, moved without visual changes.
 * ArkUI owns anchoring, dismissal and native popup lifecycle. */
export class ReaderMangaDownloadPopupRecipe {
  readonly anchorSize: number = 44;
  readonly iconSize: number = 20;
  readonly maxWidth: number = 240;
  readonly maxHeight: number = 340;
  readonly padding: number = 8;
}
export const READER_MANGA_DOWNLOAD_POPUP = new ReaderMangaDownloadPopupRecipe();
