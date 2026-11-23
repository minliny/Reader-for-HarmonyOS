import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { actualReaderFloatingBarMetrics, actualReaderPageShell } from './lib/reader-page-shell-runtime-probe.mjs';
import { actualReaderMainTabs } from './lib/reader-phone-navigation-source.mjs';
import { selectedProductionMethods, selectedProductionValues } from './lib/selected-production-methods.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { resolveReaderRaisedShape } from '../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts';

const cases = selectContractCases({
  'tab-current-items': 'Actual native tab actors consume current same-key icons and labels after route/theme projections. Frozen icon capture is rejected. No native layout.',
  'rule-current-drafts': 'Actual stable-id directory rule fields and Select props follow production draft edits. Original callback identity and field actors remain stable.',
  'shelf-mode-admission': 'Actual shelf section native callback reaches production mode admission, rejecting background/old navigation inputs and retaining pre-dispatch qualification.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

function checkTabItems(source) {
  const controls = foundationControls();
  const { readerPageAreaLength } = actualReaderPageShell();
  const { readerMainTabIconResource, MAIN_TABS } = actualReaderMainTabs();
  const Navigation = selectedProductionMethods(new URL('app/navigation/ReaderBottomNavigation.ets', root),
    'ReaderBottomNavigation', ['items'], { MAIN_TABS, readerMainTabIconResource, $r: value => value });
  const navigation = new Navigation();
  const items = (current, scheme) => {
    navigation.current = current;
    navigation.appThemeScheme = scheme;
    return navigation.items();
  };
  const owner = createReaderBuilderProbe(source, boundedMembers(source), {
    ...controls.dependencies, ...actualReaderFloatingBarMetrics(), resolveReaderRaisedShape,
    readerPageAreaLength, readerSurfaceElevation: () => ({ radius: 0 }),
  }, controls.hooks).owner;
  Object.assign(owner, {
    mounted: true, appearanceEpoch: 1, current: 'bookshelf', scheme: 'day',
    items: items('bookshelf', 'day'), surfaceWidth: 196, fontScale: 1,
    inputEnabled: true, bottomInset: 15, translateX: 0, metricsRevision: 1,
  });
  owner.initialRender();
  const images = controls.nodes(owner).filter(node => node.type === 'Image');
  const labels = controls.nodes(owner).filter(node => node.type === 'Text');
  for (const [current, scheme] of [['bookshelf', 'night'], ['settings', 'night'], ['settings', 'day']]) {
    const projection = items(current, scheme);
    owner.updateStateVars({ current, scheme, items: projection });
    controls.properties.flush();
    assert.deepEqual(images.map(node => node.create), projection.map(tab => tab.icon),
      'retained tab images consume current item icons');
    assert.deepEqual(controls.nodes(owner).filter(node => node.type === 'Image'), images,
      'projection changes preserve the native icon actors');
  }
  const renamed = items('settings', 'day').map(tab => ({ ...tab, label: `${tab.label}已更新` }));
  owner.updateStateVars({ items: renamed });
  controls.properties.flush();
  assert.deepEqual(labels.map(node => node.create), renamed.map(tab => tab.label));
  return { images: images.length, projections: 4 };
}

function checkRuleDrafts(source) {
  const { DirectoryRuleDraft } = pureModuleProbe(source.slice(source.indexOf('class DirectoryRuleDraft'),
    source.indexOf('/** A view')), 'DirectoryRuleDraft.ts', {}, ['DirectoryRuleDraft']);
  const controls = foundationControls();
  class CapturedSelect {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    updateStateVars(params) { Object.assign(this.params, params); }
  }
  const dependencies = {
    ...controls.dependencies, ...readerTypographyRoles, DirectoryRuleDraft,
    ReaderInlineSelect: CapturedSelect, LengthMetrics: { vp: value => value }, readerAppColor: () => '#000',
  };
  const hooks = { ...controls.hooks, childSources: { ...controls.hooks.childSources,
    ReaderInlineSelect: read('ui/controls/ReaderInlineSelect.ets') } };
  const members = ['rules', 'presentationGeneration', 'busy', 'loaded', 'previewReady', 'preview', 'message',
    'operation', 'availableWidthVp', 'availableHeightVp', 'scheme', 'focusTargetId', 'build', 'edit', 'changed',
    'currentRule', 'actorIdentity', 'recoveryIdentity', 'recoveryView'];
  const { owner } = createReaderBuilderProbe(source, members, dependencies, hooks);
  Object.assign(owner, {
    rules: [new DirectoryRuleDraft(1, 'old-pattern', '0', 'title')], bookId: 'book',
    presentationGeneration: 1, busy: false, loaded: true, preview: [], previewReady: false, message: 'loaded',
    operation: { generation: 0, confirmation: 'undispatched' },
    canEdit: () => true, ownsActor: () => true, recoveryView: () => ({ visible: false }),
    gateway: { supportsApply: () => true }, mounted: true, interactionEnabled: true,
  });
  owner.initialRender();
  const fields = [...owner.children.values()].filter(actor => actor instanceof controls.dependencies.ReaderFormField);
  const select = [...owner.children.values()].find(actor => actor instanceof CapturedSelect);
  assert.equal(fields.length, 2);
  assert.ok(select);
  const actors = [...owner.children.values()];
  const flush = () => { controls.properties.flush(); owner.replay(); controls.properties.flush(); };
  select.params.onSelect(1, '章首独立行');
  flush();
  assert.equal(owner.rules[0].boundary, 'head');
  assert.equal(select.params.value, '章首独立行', 'retained Select consumes current boundary');
  assert.equal(select.params.selectedIndex, 1);
  fields[0].onTextChange('new-pattern');
  flush();
  assert.equal(fields[0].text, 'new-pattern', 'retained pattern field consumes current draft');
  fields[1].onTextChange('3');
  flush();
  assert.equal(fields[1].text, '3');
  assert.equal(owner.rules[0].pattern, 'new-pattern');
  assert.equal(owner.rules[0].boundary, 'head');
  assert.deepEqual([...owner.children.values()], actors, 'same-id edits preserve field actors');
  owner.rules = [];
  fields[0].onTextChange('retired');
  assert.equal(owner.rules.length, 0, 'a removed rule cannot be recreated by its old field callback');
  return { fields: 2, edits: 3, retiredCallbackRejected: true };
}

async function checkShelfModeAdmission() {
  const Page = selectedProductionMethods(new URL('features/bookshelf/ui/BookshelfPage.ets', root), 'BookshelfPage',
    ['setViewMode', 'persistRequestedViewMode', 'viewModeAction', 'isShelfPresentationCurrent']);
  const saved = [];
  const page = Object.assign(new Page(), {
    mounted: true, feedbackEnabled: false, navigationGeneration: 2,
    isCurrentShelfInput: () => false,
    viewModeHost: {
      canSave: () => true,
      save(mode, current) { saved.push({ mode, current }); return new Promise(() => {}); },
    },
    viewModeRevision: 0, reduceMotion: true, modeReconcileBusy: false, viewModeReadFailed: false,
    resetViewSwitchMotion() {}, setRestingProjectionOpacity() {},
  });
  const icons = iconButtonControls();
  const headerFile = new URL('features/bookshelf/ui/BookshelfSectionHeader.ets', root);
  const headerSource = readFileSync(headerFile, 'utf8');
  const header = icons.consumer(headerSource, boundedMembers(headerSource), {
    ...selectedProductionValues(headerFile, ['SHELF_SECTION_ACTION_SIZE']),
    readerScaledControlHeight: () => 44,
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
    TYPE_APP_SECTION_LABEL: { fontSizeFp: 16, lineHeightFp: 24 }, TOK_SPACE_XS: 8, readerAppColor: () => '#000',
  });
  Object.assign(header, { contentWidth: 280, onList: page.viewModeAction('list'), onCover() {}, onFilter() {} });
  header.initialRender();
  const button = icons.nodes(header).find(node => node.type === 'Button' && node.accessibilityText === '列表模式');
  assert.ok(button);
  button.onClick();
  assert.equal(saved.length, 0, 'retired shelf input cannot queue a mode save');
  page.feedbackEnabled = true;
  page.isCurrentShelfInput = navigation => navigation === page.navigationGeneration;
  button.onClick();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].current(), true);
  page.navigationGeneration = 3;
  assert.equal(saved[0].current(), false, 'pre-dispatch qualification retires with the captured navigation');
  button.onClick();
  assert.equal(saved.length, 1, 'old header callback cannot act on a successor navigation');
  page.viewModeAction('cover')();
  assert.equal(saved.length, 2);
  assert.equal(saved[1].current(), true);
  page.feedbackEnabled = false;
  assert.equal(saved[1].current(), false);
  await Promise.resolve();
  return { admitted: 2, rejected: 2, scope: 'Host save admission port only; actual dispatched ACK ownership is unchanged' };
}

for (const id of cases) {
  let result;
  if (id === 'tab-current-items') {
    const source = read('ui/patterns/ReaderBottomTabBar.ets');
    result = checkTabItems(source);
    const oldCapture = source.replace('Image(this.currentTab(tab).icon)', 'Image(tab.icon)');
    assert.notEqual(oldCapture, source);
    assert.throws(() => checkTabItems(oldCapture), /retained tab images consume current item icons/);
  } else if (id === 'rule-current-drafts') {
    const source = read('features/reading/ui/ReaderDirectoryRules.ets');
    result = checkRuleDrafts(source);
    const oldCapture = source.replaceAll("this.currentRule(rule.id)?.pattern ?? ''", 'rule.pattern')
      .replaceAll("this.currentRule(rule.id)?.level ?? ''", 'rule.level')
      .replaceAll("this.currentRule(rule.id)?.boundary ?? 'title'", 'rule.boundary');
    assert.notEqual(oldCapture, source);
    assert.throws(() => checkRuleDrafts(oldCapture), /retained Select consumes current boundary/);
  } else {
    result = await checkShelfModeAdmission();
  }
  console.log(JSON.stringify({ case: id, scope: 'Actual source methods and SDK actors with finite platform/Host ports', result }));
  recordContractCasePass(id);
}
