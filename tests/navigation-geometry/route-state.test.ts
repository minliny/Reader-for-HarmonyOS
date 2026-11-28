import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderNavigation, retainedReaderRoute, type ReaderBackTarget } from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { isReaderProductSurfaceEnabled } from '../../entry/src/main/ets/app/ReaderProductScope.ts';
import { settingsNavigationGroups, settingsNavigationItems } from '../../entry/src/main/ets/features/settings/presentation/SettingsNavigationItems.ts';

test('only the admitted detail route can open and return from its directory', () => {
  const navigation = new ReaderNavigation();
  assert.equal(navigation.openDirectory('detail', () => true), undefined);
  navigation.show('detail');
  assert.equal(navigation.openDirectory('detail', () => false), undefined);
  const opened = navigation.openDirectory('detail', () => true);
  assert.equal(opened?.route, 'directory');
  assert.equal(retainedReaderRoute('directory', 'detail'), undefined);
  const destination = navigation.closeDirectory(false, assert.fail);
  assert.equal(destination?.route, 'detail');
  assert.equal(navigation.routeMotion(), 'pop');
});

test('late preparation cannot open a directory after its navigation owner moves', () => {
  const navigation = new ReaderNavigation();
  navigation.show('reading');
  assert.equal(navigation.openDirectory('readerControl', () => { navigation.advance(); return true; }), undefined);
  assert.equal(navigation.snapshot().route, 'reading');
  assert.equal(navigation.openDirectory('readerControl', () => true)?.route, 'directory');
  assert.equal(retainedReaderRoute('directory', 'readerControl'), 'directory');
});

test('Settings groups preserve their order and show a single backup entry for each profile', () => {
  const expectedL0 = [
    ['通用与界面', ['general', 'bookshelfSettings']],
    ['内容与阅读', ['source', 'rulesManagement']],
    ['数据与存储', ['downloads', 'backup']],
    ['其他', ['about']],
  ];
  const groups = settingsNavigationGroups();
  assert.equal(isReaderProductSurfaceEnabled('sync'), false);
  assert.deepEqual(groups.map(group => [group.label, group.items.map(item => item.id)]), expectedL0);
  assert.deepEqual(settingsNavigationItems(), groups.flatMap(group => group.items));
  assert.equal(groups[1].items[1].label, '规则与订阅');
  assert.equal(groups[2].items[1].label, '备份与恢复');

  const extendedGroups = settingsNavigationGroups(true);
  assert.deepEqual(extendedGroups.map(group => [group.label, group.items.map(item => item.id)]), [
    expectedL0[0], expectedL0[1], ['数据与存储', ['downloads', 'sync']], expectedL0[3],
  ]);
  assert.equal(extendedGroups[2].items[1].label, '备份与同步');
});

test('the local backup section opens and returns to Settings home on narrow layouts', () => {
  const navigation = new ReaderNavigation();
  assert.equal(navigation.selectSettingsSection('backup', assert.fail), undefined);
  navigation.openSettingsHome();
  assert.equal(navigation.selectSettingsSection('backup', assert.fail)?.settingsSection, 'backup');
  assert.equal(navigation.settingsPane(), 'backup');
  assert.equal(navigation.backTarget(), 'generalSettingsHome');
  let backCalled = false;
  navigation.selectSettingsSection('home', () => {
    backCalled = true;
    navigation.setSettingsSection('home');
  });
  assert.equal(backCalled, true);
  assert.equal(navigation.settingsPane(), 'general');
});

test('the Settings wide pane switches between backup, rules and the default pane', () => {
  const navigation = new ReaderNavigation();
  const advance = () => { navigation.advance(); };
  const backDestinations: ReaderBackTarget[] = [];
  const dispatchWideBack = () => navigation.dispatchBack({
    wideSettings: true, bookshelfGroup: () => false, temporaryOwner: () => undefined,
    onTemporaryFailure: assert.fail, destination: target => { backDestinations.push(target); },
  });
  navigation.openSettingsHome();
  assert.equal(navigation.settingsPane(), 'general');
  navigation.setSettingsSection('backup');
  assert.equal(navigation.settingsPane(), 'backup');
  assert.equal(dispatchWideBack(), true);

  navigation.setSettingsSection('home');
  advance();
  navigation.setRulesManagementOrigin('settings');
  navigation.show('rulesManagement');
  assert.equal(navigation.settingsPane(), 'rulesManagement');
  assert.equal(dispatchWideBack(), true);
  assert.deepEqual(backDestinations, ['bookshelf', 'bookshelf']);
  assert.equal(navigation.takeRulesManagementOrigin(), 'settings');
  navigation.show('settings');
  assert.equal(navigation.settingsPane(), 'general');
});

test('reader-origin rules keep their route-level return and L0 sync has no wide pane', () => {
  const navigation = new ReaderNavigation();
  navigation.show('reading');
  navigation.setRulesManagementOrigin('reader');
  navigation.show('rulesManagement');
  assert.equal(navigation.settingsPane(), undefined);
  assert.equal(navigation.backTarget(), 'rulesOrigin');
  assert.equal(navigation.takeRulesManagementOrigin(), 'reader');
  navigation.show('sync');
  assert.equal(navigation.settingsPane(), undefined);
});

test('downloads opened from General return to that same Settings section', () => {
  const navigation = new ReaderNavigation();
  navigation.openSettingsHome();
  navigation.setSettingsSection('general');
  const opened = navigation.openDownloads({ kind: 'fresh', detailKey: '' }, assert.fail, () => { navigation.advance(); });
  assert.equal(opened?.route, 'downloads');
  assert.equal(navigation.settingsPane(), 'downloads');
  navigation.returnFromDownloads({
    showBookshelf: assert.fail, showSettings: () => { navigation.show('settings'); },
    restoreReader: assert.fail, resumeReader: assert.fail, showBook: assert.fail,
  });
  assert.equal(navigation.snapshot().settingsSection, 'general');
  assert.equal(navigation.settingsPane(), 'general');
});
