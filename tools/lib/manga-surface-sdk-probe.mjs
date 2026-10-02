import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mangaUsesPersistentDirectory, mangaDirectoryColumnWidth } from '../../entry/src/main/ets/features/manga/MangaLayoutPolicy.ts';
import { MangaBookPresentation } from '../../entry/src/main/ets/features/manga/MangaBookPresentation.ts';

/** Register the same imported child names/Props as the SDK frontend. Child
 * native paint is outside the surface ownership/geometry probes. */
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
class ImportedChildBoundary {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
for (const [name, relative] of [
  ['ReaderIconButton', '../../entry/src/main/ets/features/common/ReaderIconButton.ets'],
  ['ReaderDirectoryNavigationSurface', '../../entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets'],
]) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match => match[1])));
}
export const mangaSurfaceSdkDependencies = {
  ReaderIconButton: ImportedChildBoundary,
  ReaderDirectoryNavigationSurface: ImportedChildBoundary,
  MangaBookPresentation,
  mangaUsesPersistentDirectory, mangaDirectoryColumnWidth, deviceInfo:{deviceType:'phone'},
  Toggle: new Proxy({}, {get:()=>()=>{}}), ToggleType:{Switch:'switch'},
  AppStorage: { setOrCreate() {} },
};
