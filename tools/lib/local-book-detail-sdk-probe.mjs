import {READER_FEEDBACK_BRIEF_MS} from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import {bookContentKindLabel, bookCoverDisplayUrl} from '../../entry/src/main/ets/app/library/BookCoverDisplay.ts';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
import {actualReaderPageLayout} from './reader-page-shell-runtime-probe.mjs';
import * as headerMetrics from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import * as directoryChrome from '../../entry/src/main/ets/ui/foundation/ReaderDirectoryChromeVisual.ts';
import * as mangaVisual from '../../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts';
import {createReaderBuilderProbe, productionReaderMotionSdk} from './reader-control-builder-probe.mjs';
import {boundedMembers, readerSurfaceSpecsForProbe} from './bounded-surface-sdk-probe.mjs';
import {actionMenuProbe} from './reader-action-menu-probe.mjs';
import {iconButtonControls} from './reader-icon-button-probe.mjs';
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
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import {actualReaderPostLayoutFrame} from './reader-post-layout-frame-probe.mjs';
import {sourceSwitchTriggerFocusId} from '../../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts';
import {readerCanShareOriginal} from '../../entry/src/main/ets/features/reading/application/ReaderShareActions.ts';
import {resolveReaderRaisedShape} from '../../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts';
import {readerIsExpandedWidth} from '../../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts';
import {detailChapterPreview} from '../../entry/src/main/ets/features/reading/presentation/DetailChapterPreview.ts';
import {resolveReadingDetailShelfAction} from '../../entry/src/main/ets/features/reading/presentation/ReadingDetailShelfActionPolicy.ts';

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
const transition = value => ({
  combine: next => transition({...value, next}),
  animation: params => ({...value, ...params}),
});

/** Actual approved detail/header Builders and geometry, with a window-facts
 * seam. Does not render native pixels, simulate layout or replace callbacks. */
export function localBookDetailSdk(dependencies = {}, hooks = {}, properties = createArkUIPropertyRuntimeProbe()) {
  const source = hooks.source ?? localBookDetailSource;
  const manga = mangaDirectoryEntryRowSdk({properties});
  const menu = actionMenuProbe();
  const icons = iconButtonControls({properties});
  const motion = productionReaderMotionSdk();
  const layout = actualReaderPageLayout();
  const actionTargets = bookshelfOperationClass('ui/controls/ReaderActionAccessibility.ets', '({READER_ACTION_MIN_TARGET})');
  const headers = bookshelfOperationClass('ui/foundation/ReaderHeaderSpecs.ets', '({DetailHeaderSpec,detailHeaderSpec})', {...readerFoundationTokens,...headerMetrics});
  const resolvers = bookshelfOperationClass('ui/foundation/ReaderSurfaceResolvers.ts', '({readerScaledBarHeight,readerScaledControlHeight,readerReadableFontScale})', metrics);
  const deps = {bookContentKindLabel,bookCoverDisplayUrl,...properties.sdk, ...readerFoundationTokens, ...geometry, ...metrics, ...fonts,
    ...author, ...intro, ...mangaDirectory, ...mangaLayout, ...manga.deps, ...constants,
    ...layout,...actionTargets,...headers,...headerMetrics,...resolvers,...mangaVisual,visual:mangaVisual.MANGA_DIRECTORY_VISUAL,READER_FEEDBACK_BRIEF_MS,
    readerDirectoryAccessibilityText, readerDirectoryIndentVp, readerDirectoryBookmarkMarkerState, sourceSwitchTriggerFocusId,
    readerCanShareOriginal, resolveReaderRaisedShape, readerIsExpandedWidth, detailChapterPreview, resolveReadingDetailShelfAction,
    ...readerSurfaceSpecsForProbe(), ...motion, ...menu.dependencies, ...icons.dependencies,
    readerMotionStandardCurve: () => motion.motionSpecGet('app.control.press').curve,
    GradientDirection: {Top: 'top'},
    TransitionEffect: {OPACITY: transition({opacity:0}), opacity: opacity => transition({opacity}),
      scale: scale => transition({scale}), asymmetric: (enter, exit) => ({enter, exit})},
    readerActionIcon: (action, scheme) => `reader-action-${action}-${scheme}`,
    ReaderWindowCoordinator: {metrics: metrics.createDefaultReaderWindowMetrics},
    ImageFit: {Cover: 'cover'}, NoCoverCover: Cover, registerReaderFonts() {},
    ReaderUIVerificationProbe: {enabled: () => false},
    TextHeightAdaptivePolicy: {LAYOUT_CONSTRAINT_FIRST: 'layout-constraint-first'},
    prepareReaderFontFamily: async () => {}, prepareMangaSheetFonts: async () => true, ...dependencies,
    globalThis: {...properties.sdk.globalThis, ...dependencies.globalThis, get Context() { return globalThis.Context; }}};
  deps.ReaderNativeSlotMeasurement ??= pureModuleProbe(read('ui/layout/ReaderNativeSlotMeasurement.ets'),
    'ReaderNativeSlotMeasurement.ets', {ReaderPostLayoutFrame: actualReaderPostLayoutFrame(),
      readerMeasureSurfaceRect: () => undefined}, ['ReaderNativeSlotMeasurement']).ReaderNativeSlotMeasurement;
  const carrier = {...properties.hooks, ...hooks, childSources: {...manga.hooks.childSources, ...menu.hooks.childSources,
    ...icons.hooks.childSources, ...hooks.childSources,
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
