import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { mangaUsesPersistentDirectory, mangaDirectoryColumnWidth } from '../../entry/src/main/ets/features/manga/MangaLayoutPolicy.ts';
import { MangaBookPresentation } from '../../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
import * as readerWindowMetrics from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { isReaderProductSurfaceEnabled, isReaderMainTabEnabled } from '../../entry/src/main/ets/app/ReaderProductScope.ts';
import { readerWidthClass } from '../../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import { READER_FONT_NOTO_SERIF_SC_BOLD, READER_FONT_NOTO_SANS_SC, READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_550,
  READER_FONT_NOTO_SANS_SC_UI_600, READER_FONT_NOTO_SANS_SC_UI_900 } from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

/** Register the same imported child names/Props as the SDK frontend. Child
 * native paint is outside the surface ownership/geometry probes. */
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const ts = require(`${sdk}/node_modules/typescript`);
const surfaceSource = readFileSync(new URL('../../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
const surfaceTree = ts.createSourceFile('/tmp/MangaFrameSdkBoundary.ets', surfaceSource, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const sheetFrame = surfaceTree.statements.find(node => node.name?.getText(surfaceTree) === 'MangaSheetFrame');
// Only scheduling is native: execute the unchanged production callback class.
const MangaSheetFrame = new Function('FrameCallback', `${stripTypeScriptTypes(sheetFrame.getText(surfaceTree))};return MangaSheetFrame`)(class {});
const nativeGesture = new Proxy({}, { get: () => () => {} });
class ImportedChildBoundary {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
for (const [name, relative] of [
  ['ReaderIconButton', '../../entry/src/main/ets/features/common/ReaderIconButton.ets'],
  ['ReaderDirectoryNavigationSurface', '../../entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets'],
  ['MangaReadingDirectoryFallback', '../../entry/src/main/ets/features/manga/MangaReadingDirectoryFallback.ets'],
  ['MangaDownloadOperationsPanel', '../../entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets'],
]) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match => match[1])));
}
export const mangaSurfaceSdkDependencies = {
  ...Object.fromEntries(['SafeAreaType', 'SafeAreaEdge', 'LayoutSafeAreaType', 'LayoutSafeAreaEdge', 'BarState']
    .map(name => [name, new Proxy({}, { get: (_target, key) => `${name}.${String(key)}` })])),
  READER_FONT_NOTO_SERIF_SC_BOLD, READER_FONT_NOTO_SANS_SC, READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_550,
  READER_FONT_NOTO_SANS_SC_UI_600, READER_FONT_NOTO_SANS_SC_UI_900, MangaSheetFrame,
  PanGesture: nativeGesture, PanDirection: { Vertical: 'vertical' },
  GesturePriority: { Low: 'low' },
  globalThis: { Gesture: nativeGesture, PanGesture: nativeGesture },
  ReaderIconButton: ImportedChildBoundary,
  ReaderDirectoryNavigationSurface: ImportedChildBoundary,
  MangaReadingDirectoryFallback: ImportedChildBoundary,
  MangaDownloadOperationsPanel: ImportedChildBoundary,
  MangaBookPresentation,
  ...readerWindowMetrics, isReaderProductSurfaceEnabled, isReaderMainTabEnabled, readerWidthClass,
  // Native window observation is the controlled port; geometry functions are the unchanged production imports.
  ReaderWindowCoordinator: { metrics: () => readerWindowMetrics.createDefaultReaderWindowMetrics() },
  mangaUsesPersistentDirectory, mangaDirectoryColumnWidth, deviceInfo:{deviceType:'phone'},
  ToggleType:{Switch:'switch'},
  AppStorage: { setOrCreate() {} },
};
