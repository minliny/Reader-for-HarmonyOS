import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Legacy source-shape regressions only. These tests do not read a current
// Figma revision, inspect canonical nodes, compare same-size screenshots or
// validate icon exports; passing them is never evidence of Figma parity.
// Use scripts/verify_figma_first_reading_chain.mjs for the Figma-first gate.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

function sourceRange(value, startMarker, endMarker) {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return value.slice(start, end);
}

test('bound source guard: Bookshelf keeps elevation on Figma book covers, not Continue card', async () => {
  const [bookshelf, manifest] = await Promise.all([
    source('entry/src/main/ets/ui/components/BookshelfComponents.ets'),
    source('entry/src/main/ets/ui/tokens/FigmaVisualConstraintManifest.ets'),
  ]);
  const continueCard = sourceRange(bookshelf, 'export struct ContinueReadingCard', 'export struct ShelfSectionHeader');
  const cover = sourceRange(bookshelf, 'export struct BookCover', 'export struct BookCard');
  const grid = sourceRange(bookshelf, 'export struct BookGrid', '// This generated contract type');
  assert.ok(manifest.includes('bookshelfContinueCardHeight: number = 100.00000762939453'));
  assert.ok(manifest.includes('bookshelfContinueCardCoverWidth: number = 61.99653244018555'));
  assert.ok(manifest.includes('bookshelfContinueCardCoverHeight: number = 92.99479675292969'));
  assert.ok(continueCard.includes('.height(FigmaVisualConstraintManifest.bookshelfContinueCardHeight)'));
  assert.ok(continueCard.includes('.width(FigmaVisualConstraintManifest.bookshelfContinueCardCoverWidth)'));
  assert.ok(continueCard.includes('.height(FigmaVisualConstraintManifest.bookshelfContinueCardCoverHeight)'));
  assert.equal(continueCard.includes('.shadow('), false);
  // Current Figma Library/BookCard 493:196 uses a cover-only
  // 0 8 26 rgba(89,70,50,.10) shadow.  This remains a source guard, not
  // screenshot or revision-backed visual parity evidence.
  assert.ok(cover.includes('.shadow({ radius: 26'));
  assert.ok(manifest.includes("bookshelfCoverColumnsTemplate: string = '1fr 1fr 1fr'"));
  assert.ok(manifest.includes('bookshelfCoverGridRowGap: number = 16'));
  assert.ok(manifest.includes('bookshelfCoverGridColumnGap: number = 30'));
  assert.ok(grid.includes('.columnsTemplate(FigmaVisualConstraintManifest.bookshelfCoverColumnsTemplate)'));
  assert.ok(grid.includes('.rowsGap(FigmaVisualConstraintManifest.bookshelfCoverGridRowGap)'));
  assert.ok(grid.includes('.columnsGap(FigmaVisualConstraintManifest.bookshelfCoverGridColumnGap)'));
  const card = sourceRange(bookshelf, 'export struct BookCard', 'export struct BookGrid');
  assert.ok(card.includes(".width('100%')"),
    'BookCard must occupy the Figma-owned grid column rather than its intrinsic text width');
  assert.ok(card.includes('.margin({ top: 6 })'),
    'BookCard must retain Figma\'s 6px title-to-author auto-layout gap');
  assert.equal(grid.includes('coverColumns'), false,
    'Figma exposes one three-column grid, not a local 1–5 column visual matrix');
  assert.ok(bookshelf.includes('ReaderUiStore.dispatchBookshelfActionToReader'));
});

test('bound source guard: Book Detail uses current Figma geometry and keeps the Continue owner', async () => {
  const [detail, library, manifest] = await Promise.all([
    source('entry/src/main/ets/ui/components/BookDetailComponents.ets'),
    source('entry/src/main/ets/ui/shells/LibraryShell.ets'),
    source('entry/src/main/ets/ui/tokens/FigmaVisualConstraintManifest.ets'),
  ]);
  const actionButton = sourceRange(library, 'struct BookDetailActionBarButton', '@Component\nexport struct LibraryShell');
  const chapterList = detail.slice(detail.indexOf('export struct BookChapterList'));
  assert.ok(manifest.includes('bookDetailHeroHeight: number = 152'));
  assert.ok(manifest.includes('bookDetailSummaryPhoneHeight: number = 120.3125'));
  assert.ok(manifest.includes('bookDetailSummaryTabletHeight: number = 98.875'));
  assert.ok(manifest.includes('bookDetailChapterPreviewRows: number = 4'));
  assert.ok(manifest.includes('bookDetailChapterRowHeight: number = 58'));
  assert.ok(manifest.includes('bookDetailChapterSectionHeight: number = 282'));
  assert.ok(detail.includes('.height(FigmaVisualConstraintManifest.bookDetailHeroHeight)'));
  assert.ok(detail.includes('FigmaVisualConstraintManifest.bookDetailSummaryTabletHeight'));
  assert.ok(detail.includes('Math.min(FigmaVisualConstraintManifest.bookDetailChapterPreviewRows, this.chapterToc.length)'));
  assert.ok(detail.includes('.height(FigmaVisualConstraintManifest.bookDetailChapterRowHeight)'));
  assert.ok(detail.includes('.height(FigmaVisualConstraintManifest.bookDetailChapterSectionHeight)'));
  assert.equal(detail.includes('.shadow('), false);
  assert.ok(library.includes('private bookDetailActionBarHeight(): number'));
  assert.ok(library.includes('return FigmaVisualConstraintManifest.bookDetailActionBarContainerHeight + this.safeAreaBottom;'));
  assert.ok(library.includes('FigmaVisualConstraintManifest.bookDetailPageHorizontalInset'));
  assert.ok(library.includes('FigmaVisualConstraintManifest.bookDetailActionBarContainerTopInset +'));
  assert.ok(library.includes('FigmaVisualConstraintManifest.bookDetailActionBarButtonTopInset'));
  assert.ok(actionButton.includes('FigmaReadingVisualTokens.detailActionPrimarySurface'));
  assert.ok(actionButton.includes('FigmaReadingVisualTokens.detailActionDangerSurface'));
  assert.ok(actionButton.includes('FigmaReadingVisualTokens.inter'));
  assert.equal(actionButton.includes('DemoAliasTokens'), false);
  assert.equal(actionButton.includes('ColorTokens'), false);
  assert.ok(library.includes('ReaderUiStore.dispatchContinueReading'));

  // ChapterRow `2266:66`: 348/718vp row, exact title/status grid and only
  // states backed by actual ArkUI/Core identity. This remains a source guard,
  // not a substitute for same-size screenshot or device proof.
  assert.ok(chapterList.includes("@StorageProp('reader.canonicalReaderLocation')"));
  assert.ok(chapterList.includes("@StorageProp('reader.activeReaderContentIdentity')"));
  assert.ok(chapterList.includes('FigmaVisualConstraintManifest.bookDetailChapterTitleWidthTablet'));
  assert.ok(chapterList.includes('FigmaVisualConstraintManifest.bookDetailChapterTitleWidthPhone'));
  assert.ok(chapterList.includes('Row({ space: FigmaVisualConstraintManifest.bookDetailChapterRowContentGap })'));
  assert.ok(chapterList.includes('.width(FigmaVisualConstraintManifest.bookDetailChapterStatusWidth)'));
  assert.ok(chapterList.includes('left: FigmaVisualConstraintManifest.bookDetailChapterRowInset'));
  assert.ok(chapterList.includes('FigmaReadingVisualTokens.detailRowOverlay'));
  assert.ok(chapterList.includes('FigmaReadingVisualTokens.detailCurrentIndicator'));
  assert.ok(chapterList.includes('.border({ width: 1, color: FigmaReadingVisualTokens.detailRowDivider })'),
    'ChapterRow must preserve the full Figma Button outline rather than a local top divider');
  assert.equal(chapterList.includes('width: { top: 1 }'), false,
    'ChapterRow must not collapse the Figma Button outline into a top-only divider');
  assert.ok(chapterList.includes('.focusable(!this.isDisabled(chapter))'));
  assert.ok(chapterList.includes('.onFocus(() =>'));
  assert.ok(chapterList.includes('.onBlur(() =>'));
  assert.ok(chapterList.includes('.opacity(0.85)'));
  assert.equal(chapterList.includes("@StorageProp('reader.loading')"), false,
    'route-wide loading must not masquerade as a per-row Figma Loading state');
});

test('Figma-bound Book Detail and Reader states cannot leak generic local status cards', async () => {
  const [renderer, stateHost, statePolicy, detail] = await Promise.all([
    source('entry/src/main/ets/ui/components/ViewStateRenderer.ets'),
    source('entry/src/main/ets/ui/slots/StateHost.ets'),
    source('entry/src/main/ets/ui/router/FigmaVisualStateAdmissionPolicy.ets'),
    source('entry/src/main/ets/ui/components/BookDetailComponents.ets'),
  ]);
  const suppression = sourceRange(
    renderer,
    'private suppressUnboundStatePrimitive(component: ViewStateComponent): boolean',
    '// RouteRenderer is the normal presentation boundary.',
  );
  assert.ok(suppression.includes("this.routeId === 'book-detail'"));
  assert.ok(suppression.includes("this.routeId === 'reader'"));
  assert.ok(renderer.includes('} else if (this.suppressUnboundStatePrimitive(component)) {'));
  assert.ok(renderer.includes('Column().width(0).height(0)'));
  assert.equal(stateHost.includes("from '../components/SharedComponents'"), false);
  for (const forbidden of ['Loading()', 'Empty()', 'ErrorState()', 'Offline()']) {
    assert.equal(stateHost.includes(forbidden), false,
      `StateHost must not revive a generic local ${forbidden} card`);
  }
  assert.ok(statePolicy.includes("if (routeId !== 'book-detail') return false;"));
  assert.ok(statePolicy.includes("pageState === 'offline'"));
  assert.ok(stateHost.includes("FigmaBookDetailRetryStatus({ state: 'loading' })"));
  assert.ok(stateHost.includes("FigmaBookDetailRetryStatus({ state: 'error' })"));
  assert.ok(stateHost.includes("FigmaBookDetailRetryStatus({ state: 'offline' })"));
  assert.ok(detail.includes('export struct FigmaBookDetailRetryStatus'));
});

test('Reader control icons fail closed instead of substituting an unrelated local glyph', async () => {
  const icon = await source('entry/src/main/ets/ui/components/ReaderControlIcon.ets');
  assert.ok(icon.includes('function hasControlIconResource(semantic: string): boolean'));
  assert.match(icon, /default:\s+return false;/);
  assert.ok(icon.includes('if (hasControlIconResource(this.semantic))'));
  assert.ok(icon.includes('.width(hasControlIconResource(this.semantic) ? this.iconSize : 0)'));
  assert.equal(icon.includes("default: return $r('app.media.reader_control_quick_search');"), false,
    'unknown icon semantics must remain absent until their Figma asset binding exists');
});

test('Quick TTS consumes its own Figma icon contexts instead of ModuleNav lookalikes', async () => {
  const [icon, quick, crosswalkSource] = await Promise.all([
    source('entry/src/main/ets/ui/components/ReaderControlIcon.ets'),
    source('entry/src/main/ets/ui/components/FigmaReaderQuickPanels.ets'),
    source('docs/FIGMA_READER_CONTROL_ICON_CROSSWALK.json'),
  ]);
  const crosswalk = JSON.parse(crosswalkSource);
  const playback = crosswalk.bindings.find((entry) => entry.semantic === 'tts-playback');
  const caret = crosswalk.bindings.find((entry) => entry.semantic === 'tts-caret-down');
  assert.equal(playback.figmaIconNode, '271:597');
  assert.deepEqual(playback.contexts, ['1023:17792']);
  assert.equal(playback.assetStatus, 'exact-raw-figma-svg-exported');
  assert.equal(caret.figmaIconNode, '750:1055');
  assert.deepEqual(caret.figmaBoundingBox, { width: 7, height: 4 });
  assert.ok(icon.includes("case 'tts-playback': return $r('app.media.reader_control_tts_playback');"));
  assert.ok(icon.includes("case 'tts-prev': return $r('app.media.reader_control_compact_prev');"));
  assert.ok(icon.includes("case 'tts-next': return $r('app.media.reader_control_compact_next');"));
  const tts = quick.slice(quick.indexOf('export struct FigmaReaderQuickTtsPanel'));
  assert.ok(tts.includes("ReaderControlIcon({ semantic: 'tts-playback', iconSize: 20 })"));
  assert.ok(tts.includes("semantic: 'tts-prev', eventName: 'tts-prev'"));
  assert.ok(tts.includes("semantic: 'tts-next', eventName: 'tts-next'"));
  assert.ok(tts.includes("ReaderControlIcon({ semantic: 'tts-caret-down', iconSize: 7 })\n                .width(7)\n                .height(4)"));
  assert.equal(tts.includes("ReaderControlIcon({ semantic: 'tts', iconSize: 20 })"), false);
});

test('legacy source shape: responsive policy exposes only Phone and Tablet', async () => {
  const viewport = await source('entry/src/main/ets/ui/adapters/ViewportAdapter.ets');
  const shell = await source('entry/src/main/ets/ui/shells/MainTabShell.ets');
  assert.ok(viewport.includes("export type ViewportClass = 'phone' | 'tablet'"));
  assert.equal(viewport.includes('compact-landscape'), false);
  assert.ok(shell.includes('TABLET_NAV_WIDTH: number = 82'));
  assert.ok(shell.includes('TABLET_NAV_FOOTPRINT: number = 100'));
  assert.ok(shell.includes('if (!this.usesTabletShell())'));
  assert.ok(shell.includes("bottom: this.usesTabletShell()"));
  assert.equal(shell.includes('.position('), false);
});

test('Figma ReadingSurface geometry owns the bilateral Tablet reading frame', async () => {
  const reader = await source('entry/src/main/ets/ui/components/ReaderComponents.ets');
  const textFlow = sourceRange(reader, 'export struct ReadingTextFlow', '@Builder NativeSelectionMenu()');
  const textRightInset = sourceRange(textFlow, 'private textRightInset(): number', 'private textBottomInset(): number');
  const textTopInset = sourceRange(textFlow, 'private textTopInset(): number', 'private textLeftInset(): number');
  const textLeftInset = sourceRange(textFlow, 'private textLeftInset(): number', 'private textRightInset(): number');
  assert.ok(textTopInset.includes('return this.figmaContentTopInset();'));
  assert.ok(textLeftInset.includes('return this.figmaContentLeftInset();'));
  assert.ok(textRightInset.includes('return this.figmaContentRightInset();'));
  assert.ok(textFlow.includes('FigmaReadingVisualTokens.readingSurfaceTabletContentWidth'));
  assert.ok(textFlow.includes('FigmaReadingVisualTokens.readingSurfaceTabletContentHeight'));
  assert.equal(textFlow.includes('safeAreaTop'), false);
  assert.equal(textFlow.includes('safeAreaStart'), false);
  assert.equal(textFlow.includes('safeAreaEnd'), false);
  assert.equal(textFlow.includes('safeAreaBottom'), false);
  assert.equal(textRightInset.includes('wideControlDock()'), false);
  assert.equal(textRightInset.includes('Math.max(400,'), false);
  assert.equal(760 - 44.4443359375 - 45.5556640625, 670);
});

test('Reader PaperLayer is rebuilt from Figma paint data, not a local texture approximation', async () => {
  const reader = await source('entry/src/main/ets/ui/components/ReaderComponents.ets');
  const paper = await source('entry/src/main/ets/ui/components/FigmaReadingPaperLayer.ets');
  assert.ok(reader.includes('FigmaReadingPaperLayer()'));
  for (const marker of [
    "import drawing from '@ohos.graphics.drawing';",
    'drawing.ShaderEffect.createLinearGradient',
    'drawing.ShaderEffect.createRadialGradient',
    'readingSurfacePaperLinearTransform',
    'readingSurfacePaperHighlightTransform',
    'readingSurfacePaperVignetteTransform',
    "app.media.figma_reader_paper_tile",
    'ImageRepeat.XY',
  ]) {
    assert.ok(paper.includes(marker), `PaperLayer must preserve Figma source: ${marker}`);
  }
  for (const retiredMarker of [
    'textureLines()',
    'starPoints()',
    'TokenAdapter.colorWithAlpha',
    "radius: '75%'",
  ]) {
    assert.equal(reader.includes(retiredMarker), false,
      `retired local PaperLayer visual must not remain: ${retiredMarker}`);
  }
});

test('Phone Settings quick panel is rebuilt from its direct Figma state, not the retired overlay shell', async () => {
  const [quick, manifest, tokens] = await Promise.all([
    source('entry/src/main/ets/ui/components/FigmaReaderQuickPanels.ets'),
    source('entry/src/main/ets/ui/tokens/FigmaVisualConstraintManifest.ets'),
    source('entry/src/main/ets/ui/tokens/FigmaReadingVisualTokens.ets'),
  ]);
  const settings = sourceRange(quick, 'export struct FigmaReaderQuickSettingsPanel', 'export struct FigmaReaderQuickDirectoryPanel');
  assert.ok(settings.includes("values: ['覆盖', '滑动', '仿真', '滚动', '无动画']"));
  assert.ok(settings.includes("title: '屏幕方向'"));
  assert.ok(settings.includes("title: '翻页样式'"));
  assert.ok(settings.includes("title: '屏幕超时'"));
  assert.ok(settings.includes('FigmaPhoneQuickDock({'));
  for (const marker of [
    'FigmaVisualConstraintManifest.readerQuickSettingsScrollContentWidth',
    'FigmaVisualConstraintManifest.readerQuickSettingsContentX',
    'FigmaVisualConstraintManifest.readerQuickSettingsDirectionGroupY',
    'FigmaVisualConstraintManifest.readerQuickSettingsPageAnimationGroupY',
    'FigmaVisualConstraintManifest.readerQuickSettingsTimeoutGroupY',
    'FigmaVisualConstraintManifest.readerQuickSettingsDirectionSecondX',
    'FigmaVisualConstraintManifest.readerQuickSettingsFiveOptionFifthX',
    'FigmaVisualConstraintManifest.readerQuickSettingsSegmentHitWidth',
    'FigmaVisualConstraintManifest.readerQuickSettingsSheetBorderWidth',
    'FigmaReadingVisualTokens.quickSettingsScrollContentInnerHighlight',
    'FigmaReadingVisualTokens.quickSettingsTrackSurface',
    'FigmaReadingVisualTokens.quickSettingsSheetSurface',
  ]) {
    assert.ok(settings.includes(marker) || quick.includes(marker),
      `Settings must consume its direct Figma constraint: ${marker}`);
  }
  for (const marker of [
    'readerQuickSettingsScrollContentWidth: number = 286',
    'readerQuickSettingsContentX: number = 11',
    'readerQuickSettingsContentY: number = 13',
    'readerQuickSettingsGroupWidth: number = 248',
    'readerQuickSettingsTrackHeight: number = 30',
    'readerQuickSettingsSegmentHitWidth: number = 48',
    'readerQuickSettingsSegmentHitHeight: number = 44',
    'readerQuickSettingsSheetBorderWidth: number = 0.555556',
  ]) {
    assert.ok(manifest.includes(marker), `missing Quick Settings Figma geometry: ${marker}`);
  }
  for (const marker of [
    "quickSettingsSheetSurface: string = '#FAFFFAF4'",
    "quickSettingsSheetBorder: string = '#57B4A697'",
    "quickSettingsScrollContentSurface: string = '#9EFFFCF8'",
    "quickSettingsTrackSurface: string = '#8FEEE6DB'",
    "quickSettingsSegmentSelectedSurface: string = '#BDFFFCF8'",
    "quickSettingsSegmentUnselectedInk: string = '#FF5B5046'",
  ]) {
    assert.ok(tokens.includes(marker), `missing Quick Settings Figma paint: ${marker}`);
  }
  assert.ok(quick.includes('ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight)'));
  assert.equal(settings.includes('ReaderLiveOptionRow'), false);
  assert.equal(settings.includes('ReaderQuickPanelShell('), false);
  assert.equal(settings.includes('ReaderModulePanelShell('), false);
});

test('Search Quick uses only its directly read Figma entrance track', async () => {
  const quick = await source('entry/src/main/ets/ui/components/FigmaReaderQuickPanels.ets');
  const search = sourceRange(quick, 'export struct FigmaReaderQuickSearchPanel', 'struct FigmaQuickAutoRoundAction');
  assert.ok(quick.includes("import { MotionAdapter } from '../adapters/MotionAdapter';"));
  assert.ok(search.includes('Figma Motion Reference `1247:627` → SearchQuick actor `1247:892`'));
  assert.ok(search.includes("this.routeId !== 'reader-search-overlay-v2'"));
  assert.ok(search.includes('this.entranceOpacity = 0;'));
  assert.ok(search.includes('this.entranceOffsetY = 12;'));
  assert.ok(search.includes("MotionAdapter.apply('reader.quick.promote', false"));
  assert.ok(search.includes('entranceOpacity: this.entranceOpacity'));
  assert.ok(search.includes('entranceOffsetY: this.entranceOffsetY'));
  assert.ok(quick.includes('.opacity(this.entranceOpacity)'));
  assert.ok(quick.includes('.translate({ y: this.entranceOffsetY })'));
  assert.ok(search.includes('aboutToDisappear(): void'));
  assert.equal(search.includes("MotionAdapter.apply('reader.module.switch'"), false,
    'Figma supplies no Search Quick module-pair track');
});

test('Directory to TTS uses only its directly reviewed Phone actor pair', async () => {
  const quick = await source('entry/src/main/ets/ui/components/FigmaReaderQuickPanels.ets');
  const bottomBar = await source('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
  const routeRenderer = await source('entry/src/main/ets/ui/router/RouteRenderer.ets');
  const coordinator = await source('entry/src/main/ets/ui/motion/ReaderDirectoryToTtsMotionCoordinator.ets');
  const outgoing = sourceRange(
    quick,
    '// Figma Motion Reference `1247:1275`',
    '@Component\nstruct FigmaQuickThemeSwatch',
  );

  for (const marker of [
    'Figma Motion Reference `1247:1275`',
    'Directory outgoing `1247:1276`',
    'TTS incoming `1247:1870`',
    "this.routeId === ReaderDirectoryToTtsMotionCoordinator.TTS_ROUTE",
    'ReaderMotionResolver.resolveSpec',
    "operation: 'tabSwitch'",
    "containerRole: 'readerShell'",
    "sourceRole: 'moduleNav'",
    "targetRole: 'quickPanel'",
    "spec.id !== 'reader.module.switch'",
    'MotionAdapter.applySpec(spec, false',
    'transitionInputBlocked: true',
    'ReaderDirectoryToTtsMotionCoordinator.finish(sequence)',
  ]) {
    assert.ok(outgoing.includes(marker), `missing direct Directory → TTS motion binding: ${marker}`);
  }
  for (const forbidden of ['reader.quick.promote', '.translate({', '.scale(']) {
    assert.equal(outgoing.includes(forbidden), false,
      `Directory → TTS must not substitute an unreviewed ${forbidden} track`);
  }
  assert.ok(quick.includes('@Prop transitionInputBlocked: boolean = false;'));
  assert.ok(quick.includes('.hitTestBehavior(HitTestMode.Block)'));
  assert.ok(coordinator.includes("DIRECTORY_ROUTE: string = 'reader-directory-overlay-v2'"));
  assert.ok(coordinator.includes("TTS_ROUTE: string = 'reader-tts-overlay-v2'"));
  assert.ok(coordinator.includes("TTS_MODULE: string = 'tts'"));
  assert.ok(coordinator.includes('isWide || reducedMotion'));
  assert.ok(bottomBar.includes('ReaderDirectoryToTtsMotionCoordinator.arm('));
  assert.ok(renderer.includes('FigmaReaderDirectoryToTtsOutgoingLayer()'));
  assert.ok(routeRenderer.includes('ReaderDirectoryToTtsMotionCoordinator.cancelIfTargetRouteDiffers(this.routeId);'));
  assert.ok(routeRenderer.includes('ReaderDirectoryToTtsMotionCoordinator.cancel();'));
});

test('reader scroll mode renders the whole chapter inside the native Scroll surface', async () => {
  const reader = await source('entry/src/main/ets/ui/components/ReaderComponents.ets');
  const pagination = sourceRange(reader, 'private refreshPagination(): void', 'private onReaderPageIndexChange(): void');
  const surface = sourceRange(reader, '@Builder MeasuredReadingSurface', 'private measurementKey(): string');
  assert.ok(pagination.includes('for (let index = 0; index < paragraphs.length; index += 1)'));
  assert.ok(pagination.includes('fragments.push({ text: paragraphs[index], sourceOffset: offset, contentIdentity: identity })'));
  assert.ok(surface.includes('Scroll(this.verticalScroller)'));
  assert.ok(surface.includes('.scrollable(ScrollDirection.Vertical)'));
  assert.ok(surface.includes('this.ReaderParagraphs(this.horizontalPageData[0]?.fragments ?? [], 0)'));
  assert.ok(surface.includes('.onScroll((xOffset: number, yOffset: number) => this.handleVerticalScroll(xOffset, yOffset))'));
});

test('Figma Quick Directory keeps its four-row viewport but never truncates Core content', async () => {
  const quick = await source('entry/src/main/ets/ui/components/FigmaReaderQuickPanels.ets');
  const directory = sourceRange(quick, 'export struct FigmaReaderQuickDirectoryPanel', 'struct FigmaQuickThemeSwatch');

  assert.ok(directory.includes('Scroll()'));
  assert.ok(directory.includes('.height(122)'));
  assert.ok(directory.includes('ForEach(this.chapterToc,'));
  assert.ok(directory.includes('ForEach(this.bookmarks,'));
  assert.equal(directory.includes('.slice(0, 4)'), false,
    'the visible four-row Figma viewport must scroll rather than discard chapters or bookmarks');
});

test('simulation page style never silently substitutes the slide transition', async () => {
  const reader = await source('entry/src/main/ets/ui/components/ReaderComponents.ets');
  const normalizer = sourceRange(reader, 'private normalizedPageAnimation(): string', 'private resetPageTurnVisualState(): void');
  const turn = sourceRange(reader, 'private animatePageTurn(previousIndex: number): void', 'private onCanonicalReaderLocationChange(): void');

  assert.ok(normalizer.includes("case 'simulation':"));
  assert.ok(normalizer.includes("case '仿真':"));
  assert.ok(normalizer.includes("return 'simulation';"));
  assert.ok(turn.includes("animation === 'simulation'"));
  assert.equal(turn.includes("animation === 'simulation' ?"), false,
    'simulation must not be locally restyled into an invented slide/cover animation');
});

test('the five Figma page styles own the only permitted reader layout mapping', async () => {
  const [quick, reducer, reader, entry, preferences] = await Promise.all([
    source('entry/src/main/ets/ui/components/FigmaReaderQuickPanels.ets'),
    source('entry/src/main/ets/ui/store/ReaderReducer.ets'),
    source('entry/src/main/ets/ui/components/ReaderComponents.ets'),
    source('entry/src/main/ets/entryability/EntryAbility.ets'),
    source('entry/src/main/ets/host/adapters/ReaderUiPreferenceHostAdapter.ets'),
  ]);
  const quickSettings = sourceRange(quick, 'export struct FigmaReaderQuickSettingsPanel', 'export struct FigmaReaderQuickDirectoryPanel');
  const reducerOption = sourceRange(reducer, 'static setReaderSettingOption', '// ── F3:');
  const pageTurn = sourceRange(reader, 'private animatePageTurn(previousIndex: number): void', 'private onCanonicalReaderLocationChange(): void');
  const readerBase = sourceRange(reader, 'export struct ReaderBase', '\n}');

  assert.ok(quickSettings.includes("values: ['覆盖', '滑动', '仿真', '滚动', '无动画']"));
  for (const mapping of [
    "if (value === '覆盖') return 'cover';",
    "if (value === '仿真') return 'simulation';",
    "if (value === '滚动') return 'scroll';",
    "if (value === '无动画') return 'none';",
  ]) {
    assert.ok(quick.includes(mapping), `Quick Settings must preserve Figma label mapping: ${mapping}`);
  }
  assert.ok(reducerOption.includes("case 'pageAnimation':"));
  assert.ok(reducerOption.includes('const paginationMode = paginationModeForPageAnimation(animation);'));
  assert.ok(reducerOption.includes('options.pageMode = paginationMode;'));
  assert.ok(reducerOption.includes('next.paginationMode = paginationMode;'));
  assert.ok(reducer.includes("return normalizePageAnimation(animation) === 'scroll' ? 'vertical' : 'horizontal';"));
  assert.ok(preferences.includes("return pageAnimation === 'scroll' ? 'vertical' : 'horizontal';"));
  assert.ok(preferences.includes('pageMode must match the selected pageAnimation'));

  // A selected simulation must settle before the cover-only opacity/offset
  // branch. A locally invented curl is equally forbidden until Figma supplies
  // a PageTurn timeline, but it must never borrow the cover treatment.
  assert.ok(pageTurn.includes("animation === 'none' || animation === 'simulation'"));
  assert.ok(pageTurn.includes("this.pageTurnOffset = animation === 'cover' ? 0"));
  assert.equal(pageTurn.includes("animation === 'simulation' ?"), false);

  // The old deep-link override made the visible choice and the native reading
  // surface diverge. Scroll is now reached only through the atomic selection;
  // vertical mode owns no full-screen tap/dismiss actor above its Scroll.
  assert.equal(entry.includes("params['readerPaginationMode']"), false);
  assert.ok(readerBase.includes("this.controlLayer() && this.paginationMode !== 'vertical'"));
});

test('bound source guard: bookshelf card visuals do not invent an unbound press animation', async () => {
  const bookshelf = await source('entry/src/main/ets/ui/components/BookshelfComponents.ets');
  const card = sourceRange(bookshelf, 'export struct BookCard', '// Figma BookCard `493:196` only contains');
  const row = sourceRange(bookshelf, 'export struct BookListRow', '// The Phone List master is distinct');

  for (const surface of [card, row]) {
    assert.ok(surface.includes('@State private longPressConsumed: boolean = false;'));
    assert.ok(surface.includes('TouchType.Down'));
    assert.ok(surface.includes('this.longPressConsumed = true;'));
    assert.ok(surface.includes('if (!this.canOpen() || this.longPressConsumed) return;'));
    assert.equal(surface.includes('pressFeedbackActive'), false);
    assert.equal(surface.includes('MotionAdapter.apply('), false);
  }
  assert.ok(card.includes('ReaderUiStore.dispatchBookshelfCoverToReader(this.bookId, this.sourceId)'));
  const gridCoverTap = card.indexOf('.onClick(() => this.openReader())');
  assert.ok(gridCoverTap > card.indexOf('FigmaVisualConstraintManifest.bookshelfCoverAspectWidth'),
    'Grid reader entry must be attached to the cover target');
  assert.ok(gridCoverTap < card.indexOf('.alignItems(HorizontalAlign.Start)'),
    'Grid title/author must not act as a second reader-entry target');
  assert.equal(card.indexOf('.onClick(() => this.openReader())', gridCoverTap + 1), -1,
    'Grid BookCard has one short-tap reader entry: its cover');
  assert.ok(row.includes('ReaderUiStore.dispatchBookshelfActionToReader(this.bookId, this.sourceId)'));
  assert.ok(row.includes("Image($r('app.media.bookshelf_bookcard_more'))"));
  assert.ok(row.includes('.width(FigmaVisualConstraintManifest.bookshelfPhoneListCoverWidth)'));
  assert.ok(row.includes('.height(FigmaVisualConstraintManifest.bookshelfPhoneListCoverHeight)'));
  assert.ok(row.includes('.width(FigmaVisualConstraintManifest.bookshelfPhoneListActionTarget)'));
  const listMore = row.indexOf("Image($r('app.media.bookshelf_bookcard_more'))");
  assert.ok(row.indexOf('.onClick(() => this.openActions())', listMore) > listMore,
    'the visible List More affordance must open the same exact-book long-press menu');
  assert.equal(row.includes('操作尚未绑定'), false);
});

test('Figma Library BookActionSheet keeps the approved three Phone and Tablet actions', async () => {
  const overlay = await source('entry/src/main/ets/ui/slots/OverlayHost.ets');
  const tokens = await source('entry/src/main/ets/ui/tokens/FigmaLibraryVisualTokens.ets');
  const sheet = sourceRange(overlay, '@Builder renderBookActionSheet()', 'private openBookDetailFromActionSheet()');

  assert.ok(sheet.includes('Library/BookActionSheet (`2903:1737`)'));
  assert.ok(sheet.includes('Phone (`2903:1719`) = 366×224'));
  assert.ok(sheet.includes('Tablet (`2903:1728`) = 720×224'));
  assert.ok(sheet.includes("Text('书籍操作')"));
  assert.ok(sheet.includes("Text('多选')"));
  assert.ok(sheet.includes("Text('书籍信息')"));
  assert.ok(sheet.includes("Text('移出书架')"));
  assert.ok(sheet.includes('openBookshelfMultiSelectFromActionSheet'));
  assert.ok(sheet.includes('openBookDetailFromActionSheet'));
  assert.ok(sheet.includes('openBookshelfRemovalFromActionSheet'));
  assert.ok(sheet.includes('y: 9'));
  assert.ok(sheet.includes('position({ x: 14, y: 34 })'));
  assert.ok(sheet.includes('position({ x: 14, y: 70 })'));
  assert.ok(sheet.includes('position({ x: 14, y: 116 })'));
  assert.ok(sheet.includes('position({ x: 14, y: 162 })'));
  assert.ok(sheet.includes('return this.bookActionSheetWidth() - 28;'));
  assert.equal(sheet.includes('bookshelf-multiselect-remove-request'), false);
  assert.equal(sheet.includes('分组'), false);
  assert.equal(sheet.includes('缓存'), false);

  for (const value of [
    'bookActionSheetPhoneWidth: number = 366',
    'bookActionSheetTabletWidth: number = 720',
    'bookActionSheetHeight: number = 224',
    'bookActionSheetRadius: number = 24',
    "bookActionSheetShadow: string = '#29594632'",
    "bookActionSheetDetailSurface: string = '#172D4A3E'",
    "bookActionSheetRemoveSurface: string = '#1AD6473D'",
  ]) {
    assert.ok(tokens.includes(value), `missing Figma BookActionSheet token: ${value}`);
  }
});

test('retired empty shelf and local-import pages cannot revive a generic visual', async () => {
  const policy = await source('entry/src/main/ets/ui/router/RetiredLocalImportRouteDisplayPolicy.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
  const structural = await source('entry/src/main/ets/ui/components/StructuralPageComponents.ets');

  for (const route of ['local-import', 'local-format-support', 'bookshelf-empty']) {
    assert.ok(policy.includes(`'${route}'`), `retired route must resolve to the Figma bookshelf: ${route}`);
  }
  const emptyFixture = sourceRange(renderer, "component.type === 'BookshelfEmptyPage'", "component.type === 'BookMoreMenuPage'");
  assert.ok(emptyFixture.includes('BookshelfEmptyState()'));
  assert.equal(emptyFixture.includes('StatePanel('), false,
    'the stale empty fixture must never instantiate the generic StatePanel');
  assert.equal(structural.includes('export struct BookshelfEmptyPage'), false,
    'the obsolete generic bookshelf-empty visual must be removed, not merely hidden');
});

test('bound source guard: Reader TopBar is reconstructed from its current Figma master, not demo aliases', async () => {
  const reader = await source('entry/src/main/ets/ui/components/ReaderComponents.ets');
  const topBar = sourceRange(reader, 'export struct ReaderTopArea', '// .fd-immersive-hotzone');

  for (const marker of [
    "semantic: 'back'",
    "semantic: 'source-switch'",
    "semantic: 'more'",
    'FigmaVisualConstraintManifest.readerTopBarBackWidth',
    'FigmaVisualConstraintManifest.readerTopBarTextRightReservation',
    'FigmaVisualConstraintManifest.readerTopBarSourceRightReservation',
    'FigmaVisualConstraintManifest.readerTopBarMoreRightReservation',
    'FigmaVisualConstraintManifest.readerTopBarIconSize',
    'FigmaReadingVisualTokens.topBarSurface',
    'FigmaReadingVisualTokens.topBarBorder',
    '.borderRadius(FigmaReadingVisualTokens.topBarRadius)',
    '.margin({ top: FigmaReadingVisualTokens.topBarY })',
    'ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight)',
    'FigmaReadingVisualTokens.topBarPhoneInset',
    'FigmaReadingVisualTokens.topBarTabletInset',
    'fontFamily(FigmaReadingVisualTokens.songtiSc)',
    'fontFamily(FigmaReadingVisualTokens.inter)',
    '.lineHeight(19)',
    '.lineHeight(14)',
  ]) {
    assert.ok(topBar.includes(marker), `Reader TopBar is missing current Figma 1023:18380 binding: ${marker}`);
  }
  assert.equal(topBar.includes('DemoAliasTokens'), false,
    'Reader TopBar must not fall back to a demo card radius, surface, or shadow');
  assert.equal(topBar.includes('ReaderControlFigmaTokens'), false,
    'Reader TopBar must use the dedicated current-Figma visual boundary, not generated demo tokens');
  assert.equal(topBar.includes('ReaderMorePanel'), false,
    'Figma does not provide a Reader More menu visual; hand-drawn dropdowns stay fail-closed');
});

test('bound source guard: Reader ControlSheet, brightness rail, and ModuleNav use only current Figma visual tokens', async () => {
  const overlay = await source('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
  const sheet = sourceRange(overlay, 'export struct ReaderControlSheet', '// ── Control bottom bar');
  const bottom = sourceRange(overlay, 'export struct ReaderBottomBar', '// ── Panel shell');
  const rail = sourceRange(overlay, 'struct ReaderBrightnessRail', '// ── Figma Reader ControlSheet');

  for (const marker of [
    'FigmaReadingVisualTokens.controlSurface',
    'FigmaReadingVisualTokens.controlPanelSurface',
    'FigmaReadingVisualTokens.quickActionSurface',
    'FigmaReadingVisualTokens.controlGrabber',
    'FigmaReadingVisualTokens.chapterStepSurface',
    'FigmaReadingVisualTokens.progressFill',
    'FigmaReadingVisualTokens.moduleNavRadius',
    'FigmaVisualConstraintManifest.readerControlSheetPhoneWidth',
    'FigmaVisualConstraintManifest.readerControlBrightnessRightReservation',
    'FigmaVisualConstraintManifest.readerControlChapterProgressY',
    'FigmaVisualConstraintManifest.readerControlModuleNavTabletHeight',
    "type: 'set-brightness'",
    "type: 'toggle-brightness-auto'",
    "type: 'chapter-progress-seek'",
  ]) {
    assert.ok(`${sheet}\n${bottom}\n${rail}`.includes(marker), `missing current-Figma Reader control binding: ${marker}`);
  }
  for (const surface of [sheet, bottom, rail]) {
    assert.equal(surface.includes('ReaderControlFigmaTokens'), false,
      'Reader control shell must not mix generated demo tokens into current-Figma visuals');
    assert.equal(surface.includes('DemoAliasTokens'), false,
      'Reader control shell must not mix demo aliases into current-Figma visuals');
  }
  assert.equal(rail.includes('brightnessAuto ?'), false,
    'Figma has no AutoBrightness active variant, so the rail must not invent one');
  assert.equal(sheet.includes("'目录未加载'"), false,
    'Figma has no unloaded ChapterProgress visual, so the sheet must remain visually terminal');
  assert.equal(sheet.includes("'未选择书籍'"), false,
    'Figma has no no-book ControlSheet visual, so the sheet must remain visually terminal');
  assert.equal(sheet.includes('private readonly dockWidth'), false,
    'ControlSheet root width must come from the reviewed Figma constraint manifest');
  assert.equal(sheet.includes('private readonly mainX'), false,
    'ControlSheet main-panel x must come from the reviewed Figma constraint manifest');
  assert.equal(bottom.includes('private readonly dockWidth'), false,
    'ModuleNav root width must come from the reviewed Figma constraint manifest');
  assert.ok(sheet.includes('if (this.wideControlDock()) return;'),
    'Tablet ControlDock actions must not route into Phone-only Quick panels');
  assert.ok(sheet.includes('.opacity(this.wideControlDock() ? 0.38 : 1)'),
    'Tablet QuickAction cells must use their explicit Figma Disabled opacity');
  assert.ok(sheet.includes('HitTestMode.None : HitTestMode.Default'),
    'Tablet QuickAction cells must not remain pointer-active without a Figma target');
  assert.ok(bottom.includes('if (this.wideControlDock()) return;'),
    'Tablet ModuleNav actions must not route into Phone-only module panels');
  assert.ok(bottom.includes('HitTestMode.None : HitTestMode.Default'),
    'Tablet ModuleNav must retain its Figma base paint without routing to a blank module');
  assert.ok(bottom.includes("return kind === 'tts' ? 'tts-module' : kind;"),
    'ModuleNav must translate its tts route key to the bound Figma tts-module icon semantic');
  assert.ok(bottom.includes('semantic: this.moduleIconSemantic(it[0])'),
    'ModuleNav must send its normalized semantic to ReaderControlIcon rather than fail closed');
});

test('bound source guard: rebuilt Bookshelf and Book Detail consume the Figma token boundary', async () => {
  const tokens = await source('entry/src/main/ets/ui/tokens/FigmaReadingVisualTokens.ets');
  const bookshelf = await source('entry/src/main/ets/ui/components/BookshelfComponents.ets');
  const detail = await source('entry/src/main/ets/ui/components/BookDetailComponents.ets');

  assert.ok(tokens.includes('current Figma masters'));
  for (const marker of [
    'FigmaReadingVisualTokens.contentInk',
    'FigmaReadingVisualTokens.contentSectionSurface',
    'FigmaReadingVisualTokens.shelfCoverShadow',
    'FigmaReadingVisualTokens.shelfListCoverShadow',
    'FigmaReadingVisualTokens.songtiSc',
    'FigmaReadingVisualTokens.detailCurrentIndicator',
  ]) {
    assert.ok(`${bookshelf}\n${detail}`.includes(marker), `missing Figma visual token consumption: ${marker}`);
  }
  for (const surface of [bookshelf, detail]) {
    assert.equal(surface.includes('DemoAliasTokens'), false);
    assert.equal(surface.includes('ColorTokens'), false);
    assert.equal(surface.includes(".fontColor('#"), false);
    assert.equal(surface.includes(".backgroundColor('#"), false);
    assert.equal(surface.includes("color: '#"), false);
  }
});

test('bound source guard: SourceSwitch/Window uses its current Figma geometry and keeps unmeasured data neutral', async () => {
  const flow = await source('entry/src/main/ets/ui/components/SourceSwitchFlowComponents.ets');
  const candidate = sourceRange(flow, 'struct SourceSwitchCandidateRow', '@Component\nstruct SourceSwitchWindowHeader');
  const window = sourceRange(flow, 'struct SourceSwitchCandidateRow', '@Component\nexport struct SourceSwitchFlowPage');
  for (const marker of [
    'SourceSwitch/Window `568:134`',
    'FigmaReadingVisualTokens.sourceSwitchWindowWidth',
    'FigmaReadingVisualTokens.sourceSwitchSelectedSurface',
    'FigmaReadingVisualTokens.sourceSwitchLatencyTrack',
    'FigmaReadingVisualTokens.notoSansSc',
    ".height(28)",
    ".height(308)",
    "Text('按延迟排序')",
    '.enabled(false)',
    '.hitTestBehavior(HitTestMode.None)',
    "return this.isUnavailable() ? '已禁用' : '—';",
  ]) {
    assert.ok(window.includes(marker), `SourceSwitch/Window is missing Figma source: ${marker}`);
  }
  assert.equal(window.includes(".fontColor('#"), false);
  assert.equal(window.includes(".backgroundColor('#"), false);
  assert.equal(window.includes('QuickSourceSheet'), false);
  assert.equal(window.includes("Text('关闭')"), false);
  assert.equal(window.includes('MotionAdapter.apply('), false,
    'SourceSwitch/Window has no separate F3 timeline to fabricate locally');
  assert.ok(candidate.includes('return !this.candidate.current && this.candidate.enabled && !this.loading;'),
    'Core loading remains a click guard for the direct candidate transaction');
  assert.ok(candidate.includes('ReaderUiStore.requestSourceSwitch(this.candidate.id);'),
    'an enabled candidate must keep the Figma-defined direct switch action');
  assert.ok(candidate.includes('.opacity(this.isUnavailable() ? 0.48 : 1)'),
    'only Figma-defined unavailable opacity may affect candidate paint');
  assert.equal(candidate.includes('LoadingProgress()'), false,
    'CandidateList has no Figma Loading state or spinner');
  assert.equal(candidate.includes('isLoadingCandidate'), false,
    'per-candidate local loading visual state must not be reintroduced');
  assert.equal(candidate.includes("reader.sourceSelection"), false,
    'selection state must not drive an invented candidate visual state');
});

test('Figma Restore Backup overlay replaces the retired full-page confirmation matrix', async () => {
  const overlay = await source('entry/src/main/ets/ui/components/FigmaRestoreBackupOverlay.ets');
  const coordinator = await source('entry/src/main/ets/ui/motion/RestoreBackupOverlayMotionCoordinator.ets');
  const tokens = await source('entry/src/main/ets/ui/tokens/FigmaSyncBackupVisualTokens.ets');
  const policy = await source('entry/src/main/ets/ui/router/RestoreBackupOverlayDisplayPolicy.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
  const structural = await source('entry/src/main/ets/ui/components/StructuralPageComponents.ets');

  for (const marker of ['2834:32130', '2834:32131', '2834:32132']) {
    assert.ok(`${overlay}\n${tokens}`.includes(marker),
      `Restore Backup must retain direct Figma node evidence: ${marker}`);
  }
  assert.ok(overlay.includes("type: 'core-restore-apply-request'"));
  assert.equal(overlay.includes("type: 'core-restore-apply-confirm'"), false,
    'Figma has one visible confirmation, not an invented second step');
  assert.equal(overlay.includes('LoadingProgress()'), false,
    'Figma has no F3 spinner rotation contract to fabricate locally');
  assert.ok(overlay.includes('RESTORE_CONFIRM_TO_LOADING_DISSOLVE'),
    'the reviewed Confirm -> Loading dissolve must stay local to this Figma overlay');
  assert.ok(overlay.includes('MotionAdapter.applySpec(RESTORE_CONFIRM_TO_LOADING_DISSOLVE'),
    'the dissolve must run through MotionAdapter rather than a direct animateTo call');
  assert.ok(overlay.includes('hasPresentedConfirm') && overlay.includes('enterLoadingTerminal()'),
    'a recreated/deep-linked restoring flow must land on Loading, not replay Confirm');
  assert.ok(coordinator.includes('CONFIRM_TO_LOADING_DURATION_MS: number = 150'),
    'Confirm -> Loading must preserve the reviewed 0.15s dissolve duration');
  assert.ok(coordinator.includes('COMPLETE_AUTO_CLOSE_DURATION_MS: number = 1500'),
    'Complete must auto-close after its reviewed 1.5s presentation duration');
  assert.ok(coordinator.includes("'reader.routeId'") && coordinator.includes("'reader.coreBackupStatus'"),
    'the auto-close must re-check the live Core terminal before closing');
  assert.ok(coordinator.includes("=== 'restore-result'") && coordinator.includes("=== 'success'"),
    'a timer must never create or infer a Core restore success');
  assert.ok(coordinator.includes('clearCompleteCloseTimer()'),
    'cancel/new flow must clear a prior Complete auto-close timer');
  assert.ok(coordinator.includes('nextSequence()') && coordinator.includes('isCurrentCompleteTerminal(sequence)'),
    'an old Complete timer must be sequence-gated before it can close the overlay');
  for (const retired of ['restore-scopes', 'restore-preview', 'restore-running', 'restore-progress', 'restore-conflict']) {
    assert.ok(policy.includes(`'${retired}'`), `missing retired restore route ${retired}`);
  }
  assert.ok(policy.includes("'restore-confirm'"));
  assert.ok(policy.includes("'restore-result'"));
  assert.ok(renderer.includes("component.type === 'RestoreConfirmPage' ||"));
  assert.ok(renderer.includes('Column().width(0).height(0)'));
  for (const oldPage of ['RestoreConfirmPage', 'RestoreProgressPage', 'RestoreConflictPage', 'RestoreResultPage']) {
    assert.equal(structural.includes(`export struct ${oldPage}`), false,
      `retired ${oldPage} must not remain an actual visual renderer`);
  }
});

test('Figma-absent Reader Cache, Debug, and NightToast never regain a hand-drawn visual route', async () => {
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
  assert.ok(renderer.includes("this.routeId === 'reader-book-cache'"));
  assert.ok(renderer.includes("this.routeId === 'reader-debug-info'"));
  assert.ok(renderer.includes('private isFigmaAbsentReaderVisualRoute(): boolean'));
  assert.ok(renderer.includes('if (this.isFigmaAbsentReaderVisualRoute())'));
  const toastBranch = sourceRange(renderer, "} else if (component.type === 'NightToast') {", "} else if (component.type === 'SourceSwitchResultsPanel') {");
  assert.equal(toastBranch.includes('NightToast()'), false);
  assert.ok(toastBranch.includes('Column().width(0).height(0)'));
});

test('Figma-absent Reader info and session overlays are behavior-only, and vertical reading has no full-screen dismiss actor', async () => {
  const reader = await source('entry/src/main/ets/ui/components/ReaderComponents.ets');
  const base = sourceRange(reader, 'export struct ReaderBase', '\n}');
  assert.ok(base.includes("@StorageProp('reader.paginationMode') paginationMode: string = 'horizontal'"));
  assert.ok(base.includes("this.controlLayer() && this.paginationMode !== 'vertical'"));
  assert.ok(base.includes('ControlDismissZone()'));
  assert.ok(base.includes('TapZones({'));
  assert.equal(base.includes('ReadingInfoLayer()'), false);
  assert.equal(base.includes('SessionCapsule()'), false);
});

test('all eight Phone quick states are direct Figma components and no ReaderOverlay panel is on their runtime path', async () => {
  const quick = await source('entry/src/main/ets/ui/components/FigmaReaderQuickPanels.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');

  for (const marker of [
    'Reader/PhoneModuleState 1023:18314',
    'State=Directory 1023:17963',
    'State=Appearance 1023:17973',
    'State=Settings 1023:17978',
    'State=TTS 1023:17968',
    'State=Search 1023:17983',
    'State=AutoPage 1023:17988',
    'State=Replace 1023:17993',
    'State=Bookmark 1831:10897',
    'export struct FigmaReaderQuickDirectoryPanel',
    'export struct FigmaReaderQuickAppearancePanel',
    'export struct FigmaReaderQuickSettingsPanel',
    'export struct FigmaReaderQuickTtsPanel',
    'export struct FigmaReaderQuickSearchPanel',
    'export struct FigmaReaderQuickAutoPagePanel',
    'export struct FigmaReaderQuickReplacePanel',
    'export struct FigmaReaderQuickBookmarkPanel',
    'ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight)',
    'FigmaReadingVisualTokens.quickModuleSheetSurface',
    'FigmaReadingVisualTokens.quickModuleContentSurface',
  ]) {
    assert.ok(quick.includes(marker), `missing direct Phone quick Figma binding: ${marker}`);
  }
  assert.equal(quick.includes('ReaderQuickPanelShell('), false);
  assert.equal(quick.includes('ReaderModulePanelShell('), false);
  assert.equal(quick.includes('DemoAliasTokens'), false);
  assert.equal(quick.includes('ColorTokens'), false);
  assert.ok(renderer.includes('FigmaReaderQuickDirectoryPanel()'));
  assert.ok(renderer.includes('FigmaReaderQuickAppearancePanel()'));
  assert.ok(renderer.includes('FigmaReaderQuickSettingsPanel()'));
  assert.ok(renderer.includes('FigmaReaderQuickTtsPanel()'));
  assert.ok(renderer.includes('FigmaReaderQuickSearchPanel()'));
  assert.ok(renderer.includes('FigmaReaderQuickAutoPagePanel()'));
  assert.ok(renderer.includes('FigmaReaderQuickReplacePanel()'));
  assert.ok(renderer.includes('FigmaReaderQuickBookmarkPanel()'));
  assert.equal(renderer.includes('ReaderDirectoryPanel()'), false);
  assert.equal(renderer.includes('ReaderAppearancePanel()'), false);
  assert.equal(renderer.includes('ReaderSettingsPanel()'), false);
  assert.equal(renderer.includes('ReaderTtsPanel()'), false);
  assert.equal(renderer.includes('ReaderSearchPanel()'), false);
  assert.equal(renderer.includes('ReaderReplacePanel()'), false);
  assert.equal(renderer.includes('ReaderAutoScrollPanel()'), false);
});

test('Phone Quick and Full shared shells consume the reviewed Figma frame constraints', async () => {
  const quick = await source('entry/src/main/ets/ui/components/FigmaReaderQuickPanels.ets');
  const full = await source('entry/src/main/ets/ui/components/FigmaReaderFullCorePanels.ets');
  const quickDock = sourceRange(quick, 'struct FigmaPhoneQuickDock', '// Reader/Responsive/BrightnessRail');
  const quickRail = sourceRange(quick, 'struct FigmaQuickBrightnessRail', 'struct FigmaQuickSegment');
  const fullShell = sourceRange(full, 'struct FigmaCoreFullPhoneShell', 'struct FigmaCoreFullTab');

  for (const marker of [
    'FigmaVisualConstraintManifest.readerQuickPhoneDockWidth',
    'FigmaVisualConstraintManifest.readerQuickContentViewportX',
    'FigmaVisualConstraintManifest.readerQuickContentViewportHeight',
    'FigmaVisualConstraintManifest.readerQuickRailX',
    'FigmaVisualConstraintManifest.readerQuickRailHeight',
  ]) {
    assert.ok(quickDock.includes(marker), `Quick dock must consume reviewed Figma constraint: ${marker}`);
  }
  for (const marker of [
    'FigmaVisualConstraintManifest.readerQuickRailTrackHitX',
    'FigmaVisualConstraintManifest.readerQuickRailAutoHitWidth',
    'FigmaVisualConstraintManifest.readerQuickRailAutoY',
  ]) {
    assert.ok(quickRail.includes(marker), `Quick brightness rail must consume reviewed Figma constraint: ${marker}`);
  }
  for (const marker of [
    'FigmaVisualConstraintManifest.readerFullCorePhoneWidth',
    'FigmaVisualConstraintManifest.readerFullCoreGrabberY',
    'FigmaVisualConstraintManifest.readerFullCoreHeaderLeadingWidth',
    'FigmaVisualConstraintManifest.readerFullCoreCollapseX',
    'FigmaVisualConstraintManifest.readerFullCoreContentHeight',
  ]) {
    assert.ok(fullShell.includes(marker), `Full shell must consume reviewed Figma constraint: ${marker}`);
  }
  assert.equal(quickDock.includes('.width(364.896)'), false,
    'Quick dock root may not retain an untracked local root width');
  assert.equal(fullShell.includes('.width(364)'), false,
    'Full shell root may not retain an untracked local root width');
});

test('Phone full core states use only their canonical Figma masters and fail closed on lower-level local routes', async () => {
  const full = await source('entry/src/main/ets/ui/components/FigmaReaderFullCorePanels.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');

  for (const marker of [
    'Directory 1023:18274',
    'TTS 1023:18279',
    'Appearance 1023:18284',
    'Settings 1023:18289',
    'export struct FigmaReaderFullDirectoryPanel',
    'export struct FigmaReaderFullTtsPanel',
    'export struct FigmaReaderFullAppearancePanel',
    'export struct FigmaReaderFullSettingsPanel',
    'ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight)',
    'FigmaReadingVisualTokens.controlPanelSurface',
  ]) {
    assert.ok(full.includes(marker), `missing direct Phone full Figma binding: ${marker}`);
  }
  assert.equal(full.includes('DemoAliasTokens'), false);
  assert.equal(full.includes('ColorTokens'), false);
  assert.equal(full.includes('ReaderFullPanelShell('), false);
  assert.equal(full.includes('ReaderModulePanelShell('), false);

  for (const marker of [
    'FigmaReaderFullDirectoryPanel()',
    'FigmaReaderFullTtsPanel()',
    'FigmaReaderFullAppearancePanel()',
    'FigmaReaderFullSettingsPanel()',
    "this.routeId === 'reader-full-directory'",
    "this.routeId === 'reader-full-tts'",
    "this.routeId === 'reader-full-appearance'",
    "this.routeId === 'reader-full-settings'",
  ]) {
    assert.ok(renderer.includes(marker), `missing canonical full route guard: ${marker}`);
  }
  for (const oldCall of [
    'ReaderFullDirectoryPage()',
    'ReaderFullTtsPage()',
    'ReaderFullAppearancePage()',
    'ReaderFullSettingsPage()',
  ]) {
    assert.equal(renderer.includes(oldCall), false, `old full visual must not remain on a runtime route: ${oldCall}`);
  }
  assert.ok(renderer.includes('Font/theme/layout management pages are not equivalent'));
  assert.ok(renderer.includes('PageTurn management route has no separate Figma full master'));
});

test('Reader Full Settings consumes its directly read Figma inner geometry and paint', async () => {
  const [full, manifest, tokens] = await Promise.all([
    source('entry/src/main/ets/ui/components/FigmaReaderFullCorePanels.ets'),
    source('entry/src/main/ets/ui/tokens/FigmaVisualConstraintManifest.ets'),
    source('entry/src/main/ets/ui/tokens/FigmaReadingVisualTokens.ets'),
  ]);
  const segment = sourceRange(full, 'struct FigmaCoreSettingSegment', '@Component\nstruct FigmaCoreSettingToggleRow');
  const settings = full.slice(full.indexOf('export struct FigmaReaderFullSettingsPanel'));

  for (const marker of [
    'readerFullSettingsScrollContentHeight: number = 732',
    'readerFullSettingsScreenGroupX: number = 15',
    'readerFullSettingsOrientationBarY: number = 61',
    'readerFullSettingsPageAnimationBarY: number = 133',
    'readerFullSettingsTimeoutBarY: number = 205',
    'readerFullSettingsSegmentBarHeight: number = 33',
    'readerFullSettingsOrientationSegmentWidth: number = 98.66000366210938',
    'readerFullSettingsOptionSegmentWidth: number = 58',
    'readerFullSettingsStatusGroupY: number = 263',
    'readerFullSettingsTypographyGroupY: number = 432',
    'readerFullSettingsControlGroupY: number = 563',
  ]) {
    assert.ok(manifest.includes(marker), `missing direct Settings constraint: ${marker}`);
  }
  for (const marker of [
    'fullSettingsSegmentBarSurface: string = \'#A3EDE6DB\'',
    'fullSettingsSegmentSelectedSurface: string = \'#BDFFFCF8\'',
    'fullSettingsGroupDivider: string = \'#2E9B8466\'',
  ]) {
    assert.ok(tokens.includes(marker), `missing direct Settings paint: ${marker}`);
  }
  for (const marker of [
    'FigmaVisualConstraintManifest.readerFullSettingsScreenGroupX',
    'FigmaVisualConstraintManifest.readerFullSettingsOrientationBarY',
    'FigmaVisualConstraintManifest.readerFullSettingsPageAnimationBarY',
    'FigmaVisualConstraintManifest.readerFullSettingsTimeoutBarY',
    'FigmaVisualConstraintManifest.readerFullSettingsToggleFirstY',
    'FigmaReadingVisualTokens.fullSettingsSegmentBarSurface',
    'FigmaReadingVisualTokens.fullSettingsGroupDivider',
  ]) {
    assert.ok(settings.includes(marker), `Settings must consume source constraint: ${marker}`);
  }
  assert.ok(segment.includes('FigmaVisualConstraintManifest.readerFullSettingsSegmentHeight'));
  assert.ok(segment.includes('FigmaReadingVisualTokens.fullSettingsSegmentSelectedSurface'));
  assert.equal(settings.includes('.width(302)'), false);
  assert.equal(settings.includes('.height(27)'), false);
  assert.equal(settings.includes('.height(43)'), false);
  assert.equal(settings.includes("FigmaReadingVisualTokens.quickModuleSoftSurface"), false);
});

test('Figma full Search, Auto Page, and Replace remain un-routed until Figma supplies a trigger contract', async () => {
  const full = await source('entry/src/main/ets/ui/components/FigmaReaderFullPanels.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');

  assert.ok(full.includes('Search 1770:10208 · Auto Page 1771:10277 · Replace 1771:10452'));
  assert.ok(full.includes('are empty in the current master'));
  assert.equal(full.includes("type: 'content-search-submit'"), false);
  assert.equal(renderer.includes("from './FigmaReaderFullPanels'"), false);
  assert.equal(renderer.includes('FigmaReaderFullSearchPanel()'), false);
  assert.equal(renderer.includes('FigmaReaderFullAutoPagePanel()'), false);
  assert.equal(renderer.includes('FigmaReaderFullReplacePanel()'), false);
});
