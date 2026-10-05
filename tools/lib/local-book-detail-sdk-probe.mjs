import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {readerFoundationTokens} from './reader-foundation-control-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './arkui-property-runtime-probe.mjs';
import * as geometry from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metrics from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as fonts from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import * as author from '../../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
import * as intro from '../../entry/src/main/ets/features/common/BookIntroText.ts';
import * as mangaDirectory from '../../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';

const read = path => readFileSync(new URL('../../entry/src/main/ets/' + path, import.meta.url), 'utf8');
export const localBookDetailSource = read('features/bookshelf/LocalBookDetail.ets');
const headerSource = read('features/common/PageBackBar.ets');
const coverSource = read('features/bookshelf/NoCoverCover.ets');
const declarations = [...localBookDetailSource.matchAll(/^const (\w+) = ([^;]+);/gm)];
const constants = new Function(stripTypeScriptTypes(declarations.map(m => m[0]).join('\n')) +
  `;return {${declarations.map(m => m[1]).join(',')}};`)();
class Cover {constructor(owner, params, _storage, id) {Object.assign(this, {owner, params, id});}}

/** Actual approved detail/header Builders and geometry, with a window-facts
 * seam. Does not render native pixels, simulate layout or replace callbacks. */
export function localBookDetailSdk(dependencies = {}, hooks = {}, properties = createArkUIPropertyRuntimeProbe()) {
  const deps = {...properties.sdk, ...readerFoundationTokens, ...geometry, ...metrics, ...fonts,
    ...author, ...intro, ...mangaDirectory, ...constants,
    ReaderWindowCoordinator: {metrics: metrics.createDefaultReaderWindowMetrics},
    ImageFit: {Cover: 'cover'}, NoCoverCover: Cover, ...dependencies};
  const carrier = {...properties.hooks, ...hooks, childSources: {...hooks.childSources,
    PageBackBar: headerSource, NoCoverCover: coverSource}, mountChildren: true};
  deps.PageBackBar = createReaderBuilderProbe(headerSource, boundedMembers(headerSource), deps, carrier).Component;
  return {...createReaderBuilderProbe(localBookDetailSource, boundedMembers(localBookDetailSource), deps, carrier),
    Header: deps.PageBackBar, properties};
}
