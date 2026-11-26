import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { actualReaderPostLayoutFrame } from './lib/reader-post-layout-frame-probe.mjs';
import { choiceRowProbe } from './lib/reader-choice-row-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';

const cases = selectContractCases({
  'embedded-tab-targets': 'Both embedded directory tabs extend a 36vp visual height to a 44vp response region.',
  'whitespace-locate': 'Clearing a whitespace query preserves the current-chapter locate regardless of Watch ordering.',
  'indexed-select-focus': 'Duplicate labels retain distinct native focus targets and the selected alias follows the selected index.',
  'recovery-scrim': 'Recovery blurs its own scrim above the results and preserves backdrop input and reduced transparency.',
  'chapter-end-feedback': 'The chapter-end action paints and darkens its own surface with the original chapter guard.',
  'web-geometry-animation': 'The native Web width, height and position are committed with a zero-duration animation.',
});
const path = relative => new URL(`../entry/src/main/ets/${relative}.ets`, import.meta.url);
const read = relative => readFileSync(path(relative), 'utf8');

for (const id of cases) {
  if (id === 'embedded-tab-targets') {
    const { owner } = createReaderBuilderProbe(read('features/reading/ui/FullDirectoryPanel'), [
      'directoryTab', 'directoryTabContent', 'bookmarkTab', 'bookmarkTabContent', 'tabHeight',
    ], readerTypographyRoles);
    const choices = [];
    Object.assign(owner, { embeddedInControl: true, appThemeScheme: 'day', activeTab: 'directory',
      panelInputCurrent: () => true, fontScale: () => 1, activeTabLineWidth: () => 83,
      choosePanelTab: tab => choices.push(tab) });
    owner.directoryTab();
    owner.bookmarkTab();
    const tabs = [...owner.nodes.values()].filter(node => node.type === 'Button');
    assert.equal(tabs.length, 2);
    for (const tab of tabs) {
      assert.equal(tab.height, 36);
      assert.deepEqual(tab.responseRegion, { x: 0, y: -4, width: '100%', height: 44 });
      tab.onClick();
    }
    assert.deepEqual(choices, ['directory', 'bookmarks']);
  } else if (id === 'whitespace-locate') {
    const Directory = selectedProductionMethods(path('features/manga/ui/MangaReadingDirectoryFallback'),
      'MangaReadingDirectoryFallback', ['onLocateCurrent', 'onViewInputsChanged', 'requestScroll', 'activeScroller'], {
        ReaderPostLayoutFrame: actualReaderPostLayoutFrame(), ScrollAlign: { START: 'start' }, LengthMetrics: { vp: vp => vp },
      });
    for (const clearFirst of [true, false]) {
      const frames = [];
      const scrolls = [];
      const current = { index: 10 };
      const owner = Object.assign(new Directory(), { mounted: true, listReady: true, currentChapterIndex: 10,
        admittedEntries: [{ index: 3 }, current], collapsedGroups: [], query: '   ', scrollGeneration: 0,
        publishProjection() { this.layoutRows = this.admittedEntries.map(entry => ({ entries: [entry] })); },
        getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
        listScroller: { scrollToIndex: (...args) => scrolls.push(args) }, rowPresentation: () => undefined });
      if (!clearFirst) owner.onLocateCurrent();
      owner.query = '';
      owner.onViewInputsChanged();
      if (clearFirst) owner.onLocateCurrent();
      while (frames.length > 0) {
        const frame = frames.shift();
        frame.onFrame(0);
        frame.onIdle(0);
      }
      assert.deepEqual(scrolls, [[1, true, 'start', { extraOffset: -12 }]]);
    }
  } else if (id === 'indexed-select-focus') {
    const shared = choiceRowProbe();
    const { owner } = createReaderBuilderProbe(read('ui/controls/ReaderSelectPanel'), [
      'appearanceLibraryOption', 'appearanceOptionSelected', 'optionRow', 'renderedValue', 'renderedSelectedIndex', 'optionFocusId',
    ], shared.dependencies, shared.hooks);
    Object.assign(owner, { value: '重复', options: ['重复', '重复', '重复'], selectedIndex: 1,
      variant: 'appearanceLibrary', focusIdPrefix: 'menu', appThemeScheme: 'day', closeInFlight: false,
      optionHeightHandler: () => () => {}, wrapsOptions: () => true, selectAndCollapse() {} });
    owner.appearanceLibraryOption('重复', 0);
    owner.appearanceLibraryOption('重复', 1);
    owner.appearanceLibraryOption('重复', 2);
    owner.optionRow('重复', 0);
    owner.optionRow('重复', 2);
    const rows = [...owner.children.values()];
    assert.deepEqual(rows.slice(0, 3).map(row => [row.selected, row.focusId]), [
      [false, 'menu:option:0'], [true, 'menu:selected'], [false, 'menu:option:2'],
    ]);
    assert.deepEqual(rows.slice(3).map(row => row.focusId), ['menu:option:0', 'menu:option:2']);
  } else if (id === 'recovery-scrim') {
    const source = read('features/search/ui/ReaderLibrarySearchSurface');
    for (const [visible, reduced, expected] of [[false, false, [6]], [true, false, [0, 6]], [true, true, [0, 0]]]) {
      const { owner } = createReaderBuilderProbe(source, ['build', 'results', 'emptySlot'], {
        ReaderFixedHeaderHost: class { constructor(owner, _params, _storage, id) { Object.assign(this, { owner, id }); } },
        ReaderHeaderFrameStyle: class {}, bookshelfHeaderSpec: () => ({ topInset: 0 }),
      });
      Object.assign(owner, { model: { sourceRecoveryVisible: visible }, mode: 'input', scheme: 'day', reducedSearchOpacity: 1,
        appearancePreferences: { reduceTransparency: reduced }, editingScroll: { id: 'editing-scroll' },
        results() {}, surfaceHeight: () => 600, resultsProgress: () => 0, resultClip: () => ({}), inputInteractive: () => true,
        scrimProgress: () => 1, backAction: () => () => {}, horizontalInset: () => 0 });
      owner.initialRender();
      const scrims = [...owner.nodes.values()].filter(node => node.type === 'Column' && [1, 3].includes(node.zIndex));
      assert.deepEqual(scrims.map(node => node.backdropBlur), expected);
      assert.equal(scrims[0].hitTestBehavior, 'HitTestMode.Default');
      if (visible) assert.equal(scrims[1].hitTestBehavior, 'HitTestMode.None');
    }
  } else if (id === 'chapter-end-feedback') {
    const { owner } = createReaderBuilderProbe(read('features/manga/ui/MangaReadingSurface'), ['chapterEndContent'], {
      READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
      ColorMetrics: { resourceColor: color => ({ color, blendColor: overlay => ({ color: [color, overlay.color] }) }) },
    });
    const turns = [];
    Object.assign(owner, { chapterEnd: true, panel: '', viewportHeight: 800, chromeScheme: () => 'day', greenColor: () => 'green',
      chapterEndActionLabel: () => '进入下一话', adjacentChapter: () => ({}), windowInteractiveInsets: () => ({ top: 0 }),
      interactiveInsets: () => ({}), readerPanelForeground: () => true, selectAdjacentChapter: direction => turns.push(direction) });
    owner.chapterEndContent();
    const button = [...owner.nodes.values()].find(node => node.type === 'Button');
    const restingColor = readerAppColor('TOK_SURFACE_ELEVATED', 'day');
    assert.equal(button.backgroundColor, restingColor);
    const modifier = owner.attributeCalls.find(call => call.id === button.id && call.property === 'attributeModifier').args[0];
    assert.deepEqual(modifier.pressedSurface(), [restingColor, readerAppColor('app.interaction.press', 'day')]);
    button.onClick();
    owner.panel = 'more';
    button.onClick();
    assert.deepEqual(turns, [1]);
  } else if (id === 'web-geometry-animation') {
    const { owner } = createReaderBuilderProbe(read('ui/platform/ArkWebExecutionHost'), ['build', 'surfacesForRender']);
    Object.assign(owner, { interactive: false, surfaceId: 1, currentSurface: { id: 1, controller: {} } });
    owner.initialRender();
    const web = [...owner.nodes.values()].find(node => node.type === 'Web');
    assert.deepEqual([web.width, web.height, web.position, web.focusable], [1, 1, { x: 0, y: 0 }, false]);
    const attributes = owner.attributeCalls.filter(call => call.id === web.id);
    const start = attributes.findIndex(call => call.property === 'contextAnimation' && call.args[0]?.duration === 0);
    const position = attributes.findIndex(call => call.property === 'position');
    const reset = attributes.findIndex(call => call.property === 'contextAnimation' && call.args[0] === null);
    assert.ok(start >= 0 && start < position - 2 && reset > position);
    assert.deepEqual(attributes.slice(position - 2, position + 1).map(call => call.property), ['width', 'height', 'position']);
  }
  recordContractCasePass(id);
}
