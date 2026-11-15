import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { selectedProductionMethods, selectedProductionValues } from './lib/selected-production-methods.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { actualModeHost } from './lib/bookshelf-view-mode-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceStore.ts';
import { createDefaultReaderAppearanceSnapshot, changeAppearanceThemeSelection } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';

const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const cases = selectContractCases({
  'shelf-filter-admission': 'Actual retained header/chip/clear/collapse callbacks reject retired input and navigation.',
  'mode-async-admission': 'Both actual mode consumers recheck admission after prepare/load and retain dispatched ACKs.',
  'theme-async-admission': 'Actual Settings theme callback rechecks its captured input after barrier/load and preserves an accepted save.',
});
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function componentCallback(path, component, property, owner, bindings) {
  const { ts, options } = installedEtsCompiler();
  const source = read(path);
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const expressions = [];
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === component) {
      const value = node.arguments[0].properties.find(item => item.name?.getText(tree) === property);
      if (value) expressions.push(value.initializer.getText(tree));
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(expressions.length, 1);
  return new Function(...Object.keys(bindings),
    stripTypeScriptTypes(`const action = ${expressions[0]};`) + '\nreturn action;')
    .call(owner, ...Object.values(bindings));
}

function shelfFilters() {
  const path = 'features/bookshelf/ui/BookshelfPage.ets';
  const methods = ['setFilterExpanded', 'settleFilterPanel', 'selectFilter', 'clearFilters', 'isShelfPresentationCurrent'];
  const Page = selectedProductionMethods(new URL(path, root), 'BookshelfPage', methods);
  let allowed = false;
  const page = Object.assign(new Page(), { mounted: true, navigationGeneration: 7, feedbackEnabled: false,
    isCurrentShelfInput: navigation => allowed && navigation === page.navigationGeneration,
    filterRowVisible: false, viewState: { filterExpanded: false }, reduceMotion: true,
    filterMotionGeneration: 0, filterNaturalHeight: 80, contentFilter: 'all', sourceFilter: 'all', queueShelfProjection() {} });
  const callback = componentCallback(path, 'BookshelfSectionHeader', 'onFilter', page, { navigation: 7 });
  const icons = iconButtonControls();
  const headerFile = new URL('features/bookshelf/ui/BookshelfSectionHeader.ets', root);
  const headerSource = readFileSync(headerFile, 'utf8');
  const header = icons.consumer(headerSource, boundedMembers(headerSource), {
    ...selectedProductionValues(headerFile, ['SHELF_SECTION_ACTION_SIZE']), readerScaledControlHeight: () => 44,
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
    TYPE_APP_SECTION_LABEL: { fontSizeFp: 16, lineHeightFp: 24 }, TOK_SPACE_XS: 8, readerAppColor: () => '#000000',
  });
  Object.assign(header, { contentWidth: 280, onCover() {}, onList() {}, onFilter: callback });
  header.initialRender();
  const filter = icons.nodes(header).find(node => node.type === 'Button' && node.accessibilityText === '展开筛选');
  filter.onClick();
  assert.equal(page.filterRowVisible, false);
  allowed = true; page.feedbackEnabled = true;
  filter.onClick();
  assert.equal(page.viewState.filterExpanded, true);
  page.navigationGeneration = 8;
  filter.onClick();
  assert.equal(page.viewState.filterExpanded, true, 'old navigation header cannot alter its successor');

  const controls = foundationControls();
  const chips = createReaderBuilderProbe(read(path), ['filterRow', 'filterChip', 'isFilterSelected', 'hasActiveFilters', ...methods],
    controls.dependencies, controls.hooks).owner;
  let projections = 0;
  Object.assign(chips, { appThemeScheme: 'day', mounted: true, navigationGeneration: 8, feedbackEnabled: true,
    isCurrentShelfInput: navigation => allowed && navigation === chips.navigationGeneration,
    contentFilter: 'all', sourceFilter: 'all', filterRowVisible: true, reduceMotion: true,
    viewState: { filterExpanded: true }, filterNaturalHeight: 80, filterMotionGeneration: 0,
    queueShelfProjection: () => projections++ });
  chips.filterRow(8);
  const button = label => controls.nodes(chips).find(node => node.type === 'Button' && node.accessibilityText === label);
  const manga = button('内容类型：漫画');
  manga.onClick(); controls.properties.flush(); chips.replay(); controls.properties.flush();
  assert.equal(chips.contentFilter, 'manga');
  allowed = false;
  button('清除内容类型和来源筛选').onClick();
  button('收起筛选').onClick();
  assert.equal(chips.contentFilter, 'manga', 'retired clear callback preserves current filters');
  assert.equal(chips.viewState.filterExpanded, true, 'retired collapse callback preserves route state');
  allowed = true; chips.navigationGeneration = 9;
  button('内容类型：小说').onClick();
  button('清除内容类型和来源筛选').onClick();
  assert.equal(chips.contentFilter, 'manga');
  assert.equal(projections, 1, 'retired callbacks issue no successor projection');
  chips.clearFilters(9);
  assert.equal(chips.contentFilter, 'all');
  assert.equal(projections, 2);
  return { admittedProjections: projections, retiredHeaderAndFilterCallbacksRejected: true };
}

async function modeAdmission() {
  const results = [];
  for (const settings of [false, true]) {
    for (const phase of ['prepare', 'load', 'navigation', 'dispatched']) {
      let allowed = true;
      let canonical = 'cover';
      let writes = 0;
      const entered = deferred(), release = deferred();
      const host = actualModeHost({
        currentBookshelfViewMode: () => canonical,
        loadBookshelfViewMode: async () => {
          if (phase === 'load') { entered.resolve(); await release.promise; }
          return canonical;
        },
        saveBookshelfViewMode: async mode => {
          writes += 1;
          if (phase === 'dispatched') { entered.resolve(); await release.promise; }
          canonical = mode;
        },
      }, async () => {
        if (phase === 'prepare' || phase === 'navigation') { entered.resolve(); await release.promise; }
      });
      const path = settings ? 'features/bookshelf/ui/BookshelfSettingsPage.ets' : 'features/bookshelf/ui/BookshelfPage.ets';
      const names = settings ? ['selectMode', 'persistRequestedMode', 'userInputIsCurrent', 'preferenceControlIdentity'] :
        ['setViewMode', 'persistRequestedViewMode', 'isShelfPresentationCurrent'];
      const Page = selectedProductionMethods(new URL(path, root), settings ? 'BookshelfSettingsPage' : 'BookshelfPage', names);
      const page = Object.assign(new Page(), { mounted: true, revision: 0, viewModeRevision: 0,
        navigationGeneration: 7, presentationRevision: 1, mode: 'cover', viewMode: 'cover', storedViewMode: 'cover',
        confirmed: 'cover', confirmedViewMode: 'cover', reduceMotion: true, feedbackEnabled: true,
        isInputAllowed: () => allowed, isCurrentShelfInput: navigation => allowed && navigation === page.navigationGeneration,
        viewModeHost: host, applyModeSnapshot() {}, applyViewModeSnapshot() {}, modeFeedback() {},
        resetViewSwitchMotion() {}, setRestingProjectionOpacity() {} });
      page[settings ? 'selectMode' : 'setViewMode']('list');
      await entered.promise;
      if (phase === 'navigation') page.navigationGeneration += 1;
      else allowed = false;
      const work = host.pendingWrite;
      release.resolve();
      await work;
      await Promise.resolve();
      const accepted = phase === 'dispatched';
      assert.equal(writes, accepted ? 1 : 0, 'only an already-dispatched mode request writes');
      assert.equal(canonical, accepted ? 'list' : 'cover');
      if (accepted) assert.equal(host.current().receipt.receipt.confirmation, 'confirmed', 'actual ACK survives input retirement');
      else if (phase !== 'navigation') assert.equal(settings ? page.mode : page.viewMode, 'cover', 'undispatched optimistic mode returns to confirmed state');
      results.push({ settings, phase, writes });
    }
  }
  return { scenarios: results.length, admittedDispatches: results.filter(item => item.writes).length };
}

async function themeAdmission() {
  const path = 'app/composition/SettingsScenes.ets';
  for (const phase of ['foreground', 'section', 'identity', 'load', 'dispatched']) {
    const Theme = selectedProductionMethods(new URL('app/ReaderThemeHost.ts', root), 'ReaderThemeHost',
      ['selectApp', 'prepareUserChange'], { changeAppearanceThemeSelection });
    let allowed = true, identity = 'opening-7';
    const entered = deferred(), release = deferred(), writes = [];
    const store = new ReaderAppearanceStore({
      load: async () => {
        if (phase === 'load') { entered.resolve(); await release.promise; }
        return createDefaultReaderAppearanceSnapshot();
      },
      save: async snapshot => {
        writes.push(snapshot.appThemeMode);
        if (phase === 'dispatched') { entered.resolve(); await release.promise; }
      },
    });
    if (phase !== 'load') await store.load();
    Object.assign(Theme, { generation: 1, systemScheme: 'day', store,
      recoveryBarrier: async () => {
        if (!['load', 'dispatched'].includes(phase)) { entered.resolve(); await release.promise; }
      } });
    const Scene = selectedProductionMethods(new URL(path, root), 'SettingsScenes', ['inputIsCurrent']);
    const scene = Object.assign(new Scene(), { route: 'settings', section: 'general', isInputAllowed: () => allowed,
      presentation: { isCurrent: value => value === identity } });
    const select = componentCallback(path, 'SettingsPage', 'onSelectAppTheme', scene,
      { identity: 'opening-7', ReaderThemeHost: Theme });
    const work = select('night').then(() => true, error => {
      assert.equal(error.message, 'THEME_OWNER_CHANGED');
      return false;
    });
    await entered.promise;
    if (phase === 'section') scene.section = 'home';
    else if (phase === 'identity') identity = 'opening-8';
    else allowed = false;
    release.resolve();
    const accepted = await work;
    assert.equal(accepted, phase === 'dispatched');
    assert.deepEqual(writes, accepted ? ['night'] : [], 'retired theme choice cannot create its first write');
    assert.equal(store.current().appThemeMode, accepted ? 'night' : 'system');
  }
  return { scenarios: 5, acceptedSaveRetained: true };
}

for (const id of cases) {
  const result = await ({ 'shelf-filter-admission': shelfFilters, 'mode-async-admission': modeAdmission,
    'theme-async-admission': themeAdmission }[id])();
  console.log(JSON.stringify({ case: id, result,
    scope: 'Actual production callback/method/Host/Store contracts with explicit finite persistence and native SDK ports. No device action.' }));
  recordContractCasePass(id);
}
