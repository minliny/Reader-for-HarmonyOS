import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { foundationControls, foundationSpecs } from './lib/reader-foundation-control-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { labeledIconControls } from './lib/reader-labeled-icon-action-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';

// Snapshot of the actual replaced local constants, captured before migration.
// Verify authored Day/alpha and the live consumers, not just registry presence.
const rows = JSON.parse(readFileSync(new URL('./fixtures/design/theme-consumers.json', import.meta.url)))
  .filter(row => row.originalConstant !== undefined);
assert.equal(new Set(rows.map(row => row.role)).size, 46);
assert.equal(new Set(rows.map(row => row.file)).size, 11);
// Migrated Sync actions consume these same roles through the actual shared
// Button. Execute the SDK-emitted parent and child, then retain the authored
// palette checks below; registry presence or a new whitelist is insufficient.
const syncFile = 'features/sync/SyncPage.ets';
const syncSource = readFileSync(new URL(`../entry/src/main/ets/${syncFile}`, import.meta.url), 'utf8');
const sharedRoles = new Set();
function syncActions(specs = foundationSpecs()) {
  const shared = foundationControls({ specs });
  const { owner } = createReaderBuilderProbe(syncSource,
    ['configActions', 'manualActionButton', 'canMutate', 'effectiveWebdavUrl', 'effectiveWebdavUser', 'effectiveWebdavPath'],
    shared.dependencies, shared.hooks);
  Object.assign(owner, { appThemeScheme: 'day', snapshot: { busy: false },
    webdavUrlEdited: true, webdavUserEdited: true, webdavPathEdited: true,
    webdavUrl: '', webdavUser: '', webdavPath: '', webdavPass: '', backupPass: '',
    onTestConnection: () => {}, onSaveConfig: () => {} });
  owner.configActions();
  owner.manualActionButton('立即备份', true, () => {});
  owner.manualActionButton('恢复最新备份', false, () => {});
  return { owner, shared };
}
function checkSyncActions(probe, scheme) {
  probe.owner.appThemeScheme = scheme;
  probe.shared.flush(probe.owner);
  for (const child of probe.owner.children.values()) {
    assert.equal(child.constructor, probe.shared.button.Component, 'actual shared Button consumer');
    const spec = probe.shared.dependencies.resolveReaderButtonSpec(child.specId);
    const node = probe.shared.nodes(child).find(n => n.onClick);
    const surface = child.primary ? spec.primarySurface : spec.secondarySurface;
    const border = child.primary ? spec.primaryBorder : spec.secondaryBorder;
    const authoredSurface = child.primary ? 'app.SyncPage.SOLID_BG' : 'app.SyncPage.GHOST_BG';
    assert.equal(surface, authoredSurface, 'authored Sync surface role retained through finite spec');
    assert.equal(node.backgroundColor, readerAppColor(authoredSurface, scheme), 'live shared surface follows current scheme');
    sharedRoles.add(surface);
    if (spec.hasBorder && (!child.primary || spec.primaryHasBorder)) {
      assert.equal(border, child.primary ? 'app.SyncPage.SOLID_BG' : 'app.SyncPage.GHOST_BORDER', 'authored Sync border role retained');
      assert.equal(node.border.color, readerAppColor(border, scheme), 'live shared border follows current scheme');
      sharedRoles.add(border);
    }
  }
}
const sync = syncActions();
checkSyncActions(sync, 'day');
checkSyncActions(sync, 'night');
checkSyncActions(sync, 'day');
const sharedBindings = new Map([[syncFile, sharedRoles]]);
function captureSharedConsumer(file, methods, render) {
  const shared = labeledIconControls();
  const source = readFileSync(new URL(`../entry/src/main/ets/${file}`, import.meta.url), 'utf8');
  const { owner } = createReaderBuilderProbe(source, methods,
    { ...shared.dependencies, ...readerTypographyRoles,ScrollDirection:{Horizontal:'ScrollDirection.Horizontal'},BarState:{Off:'BarState.Off'} }, shared.hooks);
  Object.assign(owner, { appThemeScheme: 'day', activeMode: 'all', filterValue: 'all',
    filterControlWidth: () => 280, contentFrame: () => ({ width: 350 }), actionBottomInset: () => 0,
    onOpenTools: () => {}, onAddSource: () => {}, onModeRequested: () => {},
    presentation:{activeKindIndex:0,kinds:[{title:'默认'},{title:'其他'}],filterKey:'all',loading:false},
    onSelectKind:()=>{},onCycleFilter:()=>{},onRefresh:()=>{} });
  render(owner);
  const roles = new Set(rows.filter(row => row.file === file).map(row => row.role));
  const witnesses = new Map();
  for (const scheme of ['day', 'night', 'day']) {
    owner.appThemeScheme = scheme;
    shared.flush(owner);
    for (const child of owner.children.values()) {
      const button = child.constructor === shared.button.Component;
      assert.ok(button || child.constructor === shared.component, 'actual shared Button or labeled Icon');
      const spec = button ? shared.dependencies.resolveReaderButtonSpec(child.specId) :
        shared.dependencies.resolveReaderLabeledIconActionSpec(child.specId);
      const nativeColors = shared.nodes(child).flatMap(node => [node.backgroundColor, node.fontColor, node.border?.color,...(node.linearGradient?.colors??[]).map(stop=>stop[0])] );
      for (const role of Object.values(spec).filter(value => roles.has(value))) {
        if (!nativeColors.includes(readerAppColor(role, scheme))) continue;
        if (!witnesses.has(role)) witnesses.set(role, new Set());
        witnesses.get(role).add(scheme);
      }
    }
  }
  sharedBindings.set(file, new Set([...witnesses].filter(([, schemes]) => schemes.size === 2).map(([role]) => role)));
}
captureSharedConsumer('features/source/SourceManagementPage.ets', ['chip', 'bottomActionBar'], owner => {
  owner.chip('未检测', 58, false, true); owner.bottomActionBar();
});
captureSharedConsumer('features/rss/RssSourceFeedPage.ets', ['actionTarget'], owner => owner.actionTarget('刷新', 'icon', () => {}));
captureSharedConsumer('features/rss/RssPage.ets', ['statusTab', 'filterPill', 'recentUnreadHeader'], owner => {
  owner.statusTab('未读', 'unread'); owner.filterPill('未读'); owner.recentUnreadHeader();
});
captureSharedConsumer('features/discover/DiscoverPage.ets', ['categoryChips','kindTitles','filterRow','currentFilterText'], owner => {
  owner.categoryChips();owner.filterRow();
});
for (const row of rows) {
  assert.equal(readerAppColor(row.role, 'day'), row.day, `${row.role}: Day retained`);
  assert.equal(readerAppColor(row.role, 'night'), row.night, `${row.role}: Night mapped`);
  assert.equal(row.day.slice(1, 3), row.night.slice(1, 3), `${row.role}: authored alpha retained`);
  const source = readFileSync(new URL(`../entry/src/main/ets/${row.file}`, import.meta.url), 'utf8');
  assert.ok(source.includes(`readerAppColor('${row.role}', this.appThemeScheme)`) ||
    sharedBindings.get(row.file)?.has(row.role), `${row.file}: direct or actual shared registry consumption (${row.role})`);
  assert.ok(source.includes("@StorageLink('readerAppScheme')"), `${row.file}: reactive App scope`);
  assert.ok(!source.includes(`const ${row.originalConstant} =`), `${row.file}: no duplicate local palette`);
}
// Negative controls prove that a hard-coded Day scheme or wrong finite role
// cannot be admitted as a successfully migrated consumer.
const frozenScheme = syncActions();
frozenScheme.owner.replay = () => {};
assert.throws(() => checkSyncActions(frozenScheme, 'night'), /live shared surface/);
const actualSpecs = foundationSpecs();
const wrongRole = syncActions({ ...actualSpecs, resolveReaderButtonSpec: id => ({
  ...actualSpecs.resolveReaderButtonSpec(id), primarySurface: 'TOK_PAPER',
}) });
assert.throws(() => checkSyncActions(wrongRole, 'day'), /authored Sync surface role/,
  'wrong spec role is rejected by the same authored consumer checks');

const SourcePage = productionMotionMethods(new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets', import.meta.url),
  ['statusBadgeBackground', 'statusBadgeDot']);
const page = new SourcePage();
for (const scheme of ['day', 'night']) {
  page.appThemeScheme = scheme;
  const good = page.statusBadgeDot({ checkState: 'passed' });
  const error = page.statusBadgeDot({ checkState: 'failed' });
  const muted = page.statusBadgeDot({ checkState: 'unchecked' });
  assert.equal(new Set([good, error, muted]).size, 3, 'status meanings remain distinct');
  const channels = color => [color.slice(3, 5), color.slice(5, 7), color.slice(7, 9)].map(v => parseInt(v, 16));
  const [gr, gg, gb] = channels(good), [er, eg, eb] = channels(error);
  assert.ok(gg > gr && gg > gb, 'success remains green');
  assert.ok(er > eg && er > eb, 'failure remains red');
  for (const state of ['passed', 'failed', 'unchecked']) {
    const background = page.statusBadgeBackground({ checkState: state });
    assert.ok(background.startsWith(state === 'unchecked' ? '#1F' : '#21'), 'native alpha retained');
  }
}
assert.equal(readerAppColor('app.ReaderBookmarkEmptyState.EMPTY_STATE_BUTTON_COLOR', 'night'), '#FF1C1A18',
  'bookmark action text contrasts with the light control primary');
assert.equal(readerAppColor('app.BookshelfSettingsPage.modeOption.onSelected', 'night'), '#FFFFFAF4',
  'shelf selected text stays light on its dark action fill');
console.log(`PASS ${rows.length} local-color bindings / 46 roles: authored Day and alpha, reactive App scope, distinct production status states and action foregrounds.`);
