import {READER_FEEDBACK_BRIEF_MS} from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import {bookCoverDisplayUrl} from '../../entry/src/main/ets/app/library/BookCoverDisplay.ts';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
import {actualReaderPageLayout} from './reader-page-shell-runtime-probe.mjs';
import * as headerMetrics from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import * as directoryChrome from '../../entry/src/main/ets/ui/foundation/ReaderDirectoryChromeVisual.ts';
import * as mangaVisual from '../../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {readerFoundationTokens} from './reader-foundation-control-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './arkui-property-runtime-probe.mjs';
import * as geometry from '../../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import * as metrics from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import * as fonts from '../../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';
import * as author from '../../entry/src/main/ets/app/library/BookAuthorMetadata.ts';
import * as intro from '../../entry/src/main/ets/app/library/BookIntroText.ts';
import * as mangaDirectory from '../../entry/src/main/ets/features/manga/presentation/MangaDirectoryPresentation.ts';
import * as mangaLayout from '../../entry/src/main/ets/features/manga/ui/MangaDirectoryLayout.ts';
import {readerDirectoryAccessibilityText,readerDirectoryIndentVp} from '../../entry/src/main/ets/features/reading/ui/ReaderDirectoryHierarchy.ts';
import {readerDirectoryBookmarkMarkerState} from '../../entry/src/main/ets/features/reading/presentation/ReaderDirectoryMarkerState.ts';
import {mangaDirectoryEntryRowSdk} from './manga-directory-entry-row-probe.mjs';

const read = path => readFileSync(new URL('../../entry/src/main/ets/' + path, import.meta.url), 'utf8');
export const localBookDetailSource = read('features/reading/ui/LocalBookDetail.ets');
const headerSource = read('ui/chrome/PageBackBar.ets');
const coverSource = read('ui/patterns/NoCoverCover.ets');
const raisedSource = read('ui/surfaces/ReaderRaisedSurface.ets');
const directoryRowSource = read('features/reading/ui/ReaderDirectoryChapterRow.ets');
const declarations = [...localBookDetailSource.matchAll(/^const (\w+) = ([^;]+);/gm)];
const constants = new Function(stripTypeScriptTypes(declarations.map(m => m[0]).join('\n')) +
  `;return {${declarations.map(m => m[1]).join(',')}};`)();
class Cover {constructor(owner, params, _storage, id) {Object.assign(this, {owner, params, id});}}

/** Actual approved detail/header Builders and geometry, with a window-facts
 * seam. Does not render native pixels, simulate layout or replace callbacks. */
export function localBookDetailSdk(dependencies = {}, hooks = {}, properties = createArkUIPropertyRuntimeProbe()) {
  const source = hooks.source ?? localBookDetailSource;
  const manga = mangaDirectoryEntryRowSdk({properties});
  const layout = actualReaderPageLayout();
  const headers = bookshelfOperationClass('ui/foundation/ReaderHeaderSpecs.ets', '({DetailHeaderSpec,detailHeaderSpec})', {...readerFoundationTokens,...headerMetrics});
  const resolvers = bookshelfOperationClass('ui/foundation/ReaderSurfaceResolvers.ts', '({readerScaledBarHeight,readerScaledControlHeight,readerReadableFontScale})', metrics);
  const deps = {bookCoverDisplayUrl,...properties.sdk, ...readerFoundationTokens, ...geometry, ...metrics, ...fonts,
    ...author, ...intro, ...mangaDirectory, ...mangaLayout, ...manga.deps, ...constants,
    ...layout,...headers,...headerMetrics,...resolvers,...mangaVisual,visual:mangaVisual.MANGA_DIRECTORY_VISUAL,READER_FEEDBACK_BRIEF_MS,
    readerDirectoryAccessibilityText, readerDirectoryIndentVp, readerDirectoryBookmarkMarkerState,
    ReaderWindowCoordinator: {metrics: metrics.createDefaultReaderWindowMetrics},
    ImageFit: {Cover: 'cover'}, NoCoverCover: Cover, registerReaderFonts() {},
    prepareReaderFontFamily: async () => {}, prepareMangaSheetFonts: async () => true, ...dependencies};
  const carrier = {...properties.hooks, ...hooks, childSources: {...manga.hooks.childSources, ...hooks.childSources,
    PageBackBar: headerSource, NoCoverCover: coverSource, ReaderDirectoryChapterRow: directoryRowSource, ReaderRaisedSurface:raisedSource}, mountChildren: true};
  // Shadow rasterization is a native visual port. Keep the actual child Prop
  // declaration and identity/update contract; do not claim Canvas/pixel proof.
  deps.ReaderRaisedSurface ??= class {
    constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
    initialRender(){}
    updateStateVars(next){Object.assign(this.params,next);}
  };
  const headerDeps={...deps,...directoryChrome,visual:directoryChrome.DIRECTORY_CHROME_VISUAL};
  deps.PageBackBar = createReaderBuilderProbe(headerSource, boundedMembers(headerSource), headerDeps, carrier).Component;
  deps.ReaderDirectoryChapterRow ??= createReaderBuilderProbe(directoryRowSource, boundedMembers(directoryRowSource), deps, carrier).Component;
  return {...createReaderBuilderProbe(source, boundedMembers(source), deps, carrier),
    Header: deps.PageBackBar, properties};
}
