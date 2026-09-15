import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { motionSegment } from '../entry/src/main/ets/features/common/MotionTimeline.ts';

const file = path => fileURLToPath(new URL(`../entry/src/main/ets/${path}`, import.meta.url));
const shelfFile = file('features/bookshelf/BookshelfPage.ets');
const shelfSource = readFileSync(shelfFile, 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const builderMethods = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for (const name of ['continueReadingCard', 'filterRow', 'projectionRow']) builderMethods.add(name);
require(`${sdk}/lib/validate_ui_syntax.js`).componentCollection.customComponents.add('BookshelfGroupSelector');
const specSource = readFileSync(file('features/common/MotionSpec.ets'), 'utf8');
const declaration = specSource.slice(specSource.indexOf('const BOOKSHELF_VIEW_MOTION:'), specSource.indexOf('\nconst ENTRIES:'));
const curve = { interpolate: value => value };
const viewMotion = new Function('curves', 'Curve',
  `${stripTypeScriptTypes(declaration)}; return BOOKSHELF_VIEW_MOTION;`)(
  { cubicBezierCurve: () => curve }, { Linear: 'linear', EaseOut: 'easeOut' });
const Motion = productionMotionMethods(shelfFile, ['sampleViewSwitch'], { motionSegment });
const sampler = Object.assign(new Motion(), { viewMotion, viewFadeCurve: curve,
  viewContentCurve: curve, viewSwitchSourceMode: 'cover', viewSwitchDestinationMode: 'list' });
let shelfSamples = 0;
for (const theme of ['day', 'night']) {
  const mountedItems = new Set();
  const { owner } = createReaderBuilderProbe(shelfSource, ['bookshelfList', 'sectionAction',
    'sectionActionAsset', 'canonicalFilterActiveAsset', 'isSectionActionActive', 'sectionActionLabel'], {
    LazyForEach: { create() {}, pop() {} },
    ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  }, {
    onObserverExit(owner, id) {
      const node = owner.nodes.get(id);
      if (node.type === 'ListItem' && Array.isArray(node.create) &&
        typeof node.create[0] === 'function' && !mountedItems.has(id)) {
        mountedItems.add(id); node.create[0]();
      }
    },
  });
  Object.assign(owner, { appThemeScheme: theme, viewMode: 'cover', viewSwitchHeaderOpacity: 1,
    continueReading: undefined, filterRowVisible: false, groupSelectorVisible: false,
    selectedGroup: '', viewModeError: '', visibleBookCount: 0, rowDataSource: {},
    shelfContentWidth: () => 352, hasActiveFilters: () => false });
  owner.bookshelfList(false);
  const icons = [...owner.nodes.values()].filter(node => node.type === 'Image');
  assert.equal(icons.length, 4);
  const ids = icons.map(node => node.id);
  const header = [...owner.nodes.values()].find(node => node.type === 'Row' && node.height === 38);
  const title = [...owner.nodes.values()].find(node => node.type === 'Text' && node.create === '我的书架');
  for (const [source, target] of [['cover', 'list'], ['list', 'cover']]) {
    Object.assign(sampler, { viewSwitchSourceMode: source, viewSwitchDestinationMode: target });
    for (const time of [0, 150, 210, 270, 350, 499, 500, 600, 700, 1000, 350, 150, 0]) {
      sampler.viewSwitchTimeMs = time; sampler.sampleViewSwitch();
      owner.viewMode = sampler.viewMode;
      owner.viewSwitchHeaderOpacity = sampler.viewSwitchHeaderOpacity;
      owner.replay();
      assert.equal(header.opacity ?? 1, 1, `toolbar ancestor hidden at ${time} ms`);
      assert.equal(title.opacity ?? 1, sampler.viewSwitchHeaderOpacity, 'title keeps its existing motion track');
      assert.deepEqual([...owner.nodes.values()].filter(node => node.type === 'Image').map(node => node.id), ids);
      for (const icon of icons) {
        assert.equal(icon.opacity ?? 1, 1);
        assert.equal(icon.width, 20); assert.equal(icon.height, 20);
        assert.equal(typeof icon.create, 'string');
      }
      shelfSamples += 1;
    }
  }
}

// Detail is a presentation component. Metadata/progress refreshes must keep
// its two existing actors; real admission/removal changes still gate actions.
const detailSource = readFileSync(file('features/bookshelf/LocalBookDetail.ets'), 'utf8');
const { owner: detail } = createReaderBuilderProbe(detailSource, ['actionArea', 'readingActionsReady',
  'readingActionLabel', 'pendingReadingLabel', 'shelfActionLabel'], {
  GradientDirection: { Bottom: 'bottom' },
});
Object.assign(detail, { appThemeScheme: 'day', toc: [{ index: 0, title: '第一章' }],
  book: { title: '书', author: '作者' }, readingEnabled: true, readingBlockedReason: '',
  inBookshelf: true, removalEnabled: true, removing: false, loadingMessage: '',
  contentWidth: () => 352, actionButtonWidth: () => 171 });
detail.actionArea();
const buttons = [...detail.nodes.values()].filter(node => node.type === 'Stack');
assert.equal(buttons.length, 2);
const buttonIds = buttons.map(node => node.id);
for (let progress = 1; progress <= 4; progress += 1) {
  detail.book = { ...detail.book, currentChapterIndex: progress, readProgress: progress * 100 };
  detail.toc = detail.toc.map(entry => ({ ...entry }));
  detail.replay();
  assert.deepEqual([...detail.nodes.values()].filter(node => node.type === 'Stack').map(node => node.id), buttonIds);
  assert.deepEqual(buttons.map(node => [node.opacity, node.enabled, node.width, node.height]),
    [[1, true, 171, 46], [1, true, 171, 46]]);
}
detail.readingEnabled = false; detail.readingBlockedReason = '内容不可读'; detail.replay();
assert.equal(buttons[0].enabled, false);
assert.ok([...detail.nodes.values()].some(node => node.type === 'Text' && node.create === '内容不可读'));
detail.removing = true; detail.replay(); assert.equal(buttons[1].enabled, false);
console.log(`PASS ${shelfSamples} production bookshelf timeline/Builder samples; retained detail action actors and real safety gates. Native pixels remain unverified.`);
