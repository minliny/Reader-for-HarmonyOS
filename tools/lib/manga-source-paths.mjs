const sourcePaths = Object.freeze({
  'MangaSessionGateway.ts': 'features/manga/application/MangaSessionGateway.ts',
  'MangaResourceGateway.ts': 'features/manga/application/MangaResourceGateway.ts',
  'MangaSessionController.ts': 'features/manga/application/MangaSessionController.ts',
  'MangaChapterPreparationCoordinator.ts': 'features/manga/application/MangaChapterPreparationCoordinator.ts',
  'MangaChapterTransitionCoordinator.ts': 'features/manga/application/MangaChapterTransitionCoordinator.ts',
  'MangaSourceSwitchGateway.ts': 'features/manga/application/MangaSourceSwitchGateway.ts',
  'MangaStripProjection.ts': 'features/manga/ui/MangaStripProjection.ts',
  'MangaReadingSurface.ets': 'features/manga/ui/MangaReadingSurface.ets',
  'MangaDirectoryEntryRow.ets': 'features/manga/ui/MangaDirectoryEntryRow.ets',
  'MangaDirectoryCurrentFooter.ets': 'features/manga/ui/MangaDirectoryCurrentFooter.ets',
  'MangaDirectoryLayout.ts': 'features/manga/ui/MangaDirectoryLayout.ts',
  'MangaDirectoryPresentation.ts': 'features/manga/presentation/MangaDirectoryPresentation.ts',
  'MangaDirectoryVisual.ts': 'features/manga/ui/MangaDirectoryVisual.ts',
  'vendor/photoview/PhotoViewScaleModel.ts': 'features/manga/vendor/photoview/PhotoViewScaleModel.ts',
});

/** Finite shipping owners used by the existing manga source probes. */
export function mangaSourcePath(name) {
  if (!Object.hasOwn(sourcePaths, name)) throw new Error(`Unregistered manga source: ${name}`);
  return sourcePaths[name];
}

export function mangaSourceUrl(name) {
  return new URL('../../entry/src/main/ets/' + mangaSourcePath(name), import.meta.url);
}
