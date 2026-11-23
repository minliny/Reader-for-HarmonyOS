import { posix as path } from 'node:path';

const prefix = 'entry/src/main/ets/';
const relocations = new Map(Object.entries({
  surfaces: ['ReaderSurfaceSpecs.ets', 'ReaderActionMenuSurface.ets', 'ReaderActionSheetContent.ets',
    'ReaderBoundedSurface.ets', 'ReaderBoundedSurfaceHeader.ets', 'ReaderBoundedSurfaceActions.ets',
    'ReaderDialogSurface.ets', 'ReaderRaisedSurface.ets', 'ReaderCard.ets', 'ReaderCardSpecs.ets', 'ReaderScrimColor.ets'],
  chrome: ['AppTopBar.ets', 'PageBackBar.ets'],
  foundation: ['ReaderSourceChromeVisual.ts', 'MangaDirectoryPressFeedback.ets', 'ReaderHeaderSpecs.ets',
    'ReaderFonts.ets', 'ReaderSelectGeometry.ts', 'MotionSpec.ets', 'ReaderMotionPolicy.ets',
    'ReaderMotionDurationPolicy.ts', 'ProductMotionTiming.ts', 'ReaderMotionClock.ets', 'MotionTimeline.ts', 'MotionPointTrack.ts'],
  controls: ['ReaderSelect.ets', 'ReaderInlineSelect.ets', 'ReaderSelectPanel.ets', 'ReaderSelectAppearanceStyle.ts',
    'ReaderSearchField.ets', 'ReaderSectionHeading.ets', 'StatusBadge.ets'],
  feedback: ['ReaderPageState.ets', 'ReaderRecoveryAction.ets', 'ReaderRecoveryNotice.ets',
    'ReaderTransientFeedback.ts', 'ReaderTransientToast.ets'],
  layout: ['ReaderLayoutCapability.ts', 'ReaderSurfaceRect.ts', 'ReaderSurfaceRectMeasurement.ets'],
}).flatMap(([family, names]) => names.map(name => [prefix + 'features/common/' + name, prefix + 'ui/' + family + '/' + name])));
for (const [directory, names] of Object.entries({
  'app/composition': ['JsonImportDialog.ets', 'ReaderLayoutDebugOverlay.ets'],
  'features/bookshelf/ui': ['ReaderSheetActionList.ets'],
  'app/library': ['BookAcquisitionPresentation.ts', 'BookAuthorMetadata.ts', 'BookCoverDisplay.ts',
    'BookIntroText.ts', 'BookSearchTiming.ts', 'CachedBookIdentity.ts'],
  app: ['ReaderThemeSelection.ts'],
})) for (const name of names) relocations.set(prefix + 'features/common/' + name, prefix + directory + '/' + name);
const originals = new Map([...relocations].map(([before, after]) => [after, before]));
relocations.set(prefix + 'features/manga/MangaDirectoryPressFeedback.ets', prefix + 'ui/foundation/MangaDirectoryPressFeedback.ets');
// These two existing controls have their own current shape digests. Only the
// forward path is needed by the reviewed JsonImportDialog typography binding.
for (const name of ['ReaderButton.ets', 'ReaderFormField.ets'])
  relocations.set(prefix + 'features/common/' + name, prefix + 'ui/controls/' + name);

const withoutExtension = file => file.replace(/\.(ets|ts)$/, '');
const originalModules = new Map([...originals].flatMap(([after, before]) => [[after, before], [withoutExtension(after), withoutExtension(before)]]));
const retiredModules = new Set([...relocations.keys()].flatMap(file => [file, withoutExtension(file)]));

export const currentSharedUiFile = file => relocations.get(file) ?? file;
export const originalSharedUiFile = file => originals.get(file) ?? file;

function relativeModule(consumer, target) {
  const relative = path.relative(path.dirname(consumer), target);
  return relative.startsWith('.') ? relative : './' + relative;
}

/** Return the current import for an unchanged reviewed component binding. */
export function currentSharedUiImport(consumer, previousConsumer, previousSpecifier, previousTarget) {
  const target = currentSharedUiFile(previousTarget);
  if (target === previousTarget && consumer === previousConsumer) return previousSpecifier;
  return relativeModule(consumer, withoutExtension(target));
}

/** Compare moved source at its prior location without accepting an import
 * that still targets a retired production module. */
export function originalSharedUiImport(file, specifier) {
  const original = originals.get(file);
  if (original === undefined) return specifier;
  const target = path.normalize(path.join(path.dirname(file), specifier));
  if (retiredModules.has(target)) return specifier;
  return relativeModule(original, originalModules.get(target) ?? target);
}
