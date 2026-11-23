import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { rssOriginalMatchesScope } from '../entry/src/main/ets/features/rss/application/RssMutationRecoveryContract.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const view = (generation, message) => ({ visible: true, canRetry: true, generation, message });
const hidden = { visible: false, canRetry: false, generation: 0, message: '' };
const components = (sdk, owner, type) => sdk.walk(owner).filter(child => child instanceof sdk.deps[type]);

function directorySdk() {
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  const definition = read('features/reading/ui/ReaderDirectoryRecoverySurface.ets');
  class Feedback { show() { return false; } reset() {} }
  sdk.deps.ReaderTransientFeedback = Feedback;
  sdk.deps.EMPTY_READING_DIRECTORY_RECOVERY = { presentationId: '', bookmarks: hidden, offline: hidden,
    bookmarkWriteEnabled: false, canContinueBookmarks: false, canContinueOffline: false };
  sdk.hooks.childSources.ReaderDirectoryRecoverySurface = definition;
  sdk.deps.ReaderDirectoryRecoverySurface = createReaderBuilderProbe(definition, boundedMembers(definition), sdk.deps, sdk.hooks).Component;
  return sdk;
}

function journeyRoot() {
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  const { root, require } = installedEtsCompiler();
  const syntax = require(root + '/lib/validate_ui_syntax.js');
  for (const name of ['BookshelfDetailPresentation', 'ReadingEntryPresentation']) syntax.observedClassCollection.add(name);
  // The installed compiler emits the historical alias while its installed
  // property runtime exports the correctly spelled class. Use that same class.
  sdk.deps.SynchedPropertyNesedObjectPU = sdk.properties.sdk.SynchedPropertyNestedObjectPU;
  const detailSource = read('features/bookshelf/ui/BookshelfDetailNotice.ets');
  sdk.hooks.childSources.BookshelfDetailNotice = detailSource;
  sdk.deps.BookshelfDetailNotice = createReaderBuilderProbe(detailSource, boundedMembers(detailSource), sdk.deps, sdk.hooks).Component;
  const calls = [];
  const observe = value => sdk.properties.sdk.ObservedObject.createNew(value, undefined);
  const source = read('app/composition/ReaderJourneyRecoveryNotices.ets');
  const owner = sdk.consumer(source, boundedMembers(source), {}, {
    interactive: true, startupRecoveryVisible: true, startupRecovery: view(1, '旧版数据'),
    reading: observe({ recoveryNoticeVisible: () => true, recoveryNotice: view(2, '阅读事务'),
      recoveryActionLabel: '核对阅读', retryRecoveryNotice: generation => calls.push(['reading', generation]) }),
    detail: observe({ addRecovery: () => view(3, '加入书架'), removalRecovery: () => undefined }),
    mangaRecoveryVisible: true, mangaRecovery: view(4, '漫画换源'), mangaRecoveryActionLabel: '核对漫画',
    onMangaRecovery: generation => calls.push(['manga', generation]),
  });
  Object.assign(owner, { canInteract: () => true, noticeWidth: () => 300, availableHeight: () => 400 });
  owner.initialRender();
  const groups = components(sdk, owner, 'ReaderRecoveryGroup');
  const notices = components(sdk, owner, 'ReaderRecoveryNotice');
  assert.equal(groups.length, 1);
  assert.equal(notices.length, 4);
  assert.deepEqual(notices.map(item => item.view.generation), [1, 3, 2, 4]);
  assert.deepEqual(notices.map(item => item.follows), [false, true, true, true]);
  assert.ok(notices.every(item => item.grouped));
  notices[2].onReconcile(2); notices[3].onReconcile(4);
  assert.deepEqual(calls, [['reading', 2], ['manga', 4]]);
  owner.interactive = false;
  notices[2].onReconcile(2); notices[3].onReconcile(4);
  assert.equal(calls.length, 2, 'retained root callback checks current foreground');
}

function directoryGroup() {
  for (const grouped of [false, true]) {
    const sdk = directorySdk();
    const source = read('features/reading/ui/ReaderDirectoryRecoverySurface.ets');
    const recovery = { presentationId: 'directory-a', bookmarks: view(7, '书签待核对'), offline: view(8, '离线待核对'),
      bookmarksKind: 'pending', offlineKind: 'pending', canContinueBookmarks: true, canContinueOffline: false };
    const owner = sdk.consumer(source, boundedMembers(source), {}, { recovery, grouped });
    owner.aboutToAppear(); owner.initialRender();
    assert.equal(components(sdk, owner, 'ReaderRecoveryGroup').length, grouped ? 0 : 1);
    const notices = components(sdk, owner, 'ReaderRecoveryNotice');
    assert.equal(notices.length, 2);
    assert.deepEqual(notices.map(item => item.follows), [false, true]);
    assert.ok(notices.every(item => item.grouped));
  }
  const sdk = directorySdk();
  const source = read('features/reading/ui/ReaderDirectoryRecoverySurface.ets');
  const owner = sdk.consumer(source, boundedMembers(source), {}, { recovery: {
    presentationId: 'known', bookmarks: view(9, '书签已确认'), offline: hidden,
    bookmarksKind: 'readback', bookmarksReadbackFailed: true, canContinueBookmarks: false,
  } });
  owner.aboutToAppear(); owner.initialRender();
  assert.equal(components(sdk, owner, 'ReaderRecoveryGroup').length, 0);
  assert.equal(components(sdk, owner, 'ReaderRecoveryNotice').length, 0);
  assert.ok(components(sdk, owner, 'ReaderRecoveryAction').some(item => item.label === '重新读取书签'));
}

function readingItems() {
  for (const kind of ['pending', 'readback', 'result']) for (const settingsPending of [false, true]) {
    const sdk = directorySdk();
    const source = read('features/reading/ui/LocalReadingExperience.ets');
    // boundedMembers parses the entire actual source before these exact
    // Builders are lowered. Omitted Reader lifecycle/IO is outside this test.
    boundedMembers(source, 'ReadingExperience');
    const owner = sdk.consumer(source, ['readerRecoveryContent', 'readerRecoveryItems', 'readerBookmarkRecoveryContent',
      'readerBookmarkPending', 'hasReaderPendingGroup', 'hasReaderRecoveryContent',
      'readerOfflineRecoveryVisible', 'readerOfflinePending'], {}, {});
    Object.assign(owner, { bookmarkRecovery: { presentationId: 'reading-a', bookmarks: view(7, '书签事项'), offline: hidden,
      bookmarksKind: kind, bookmarksReadbackFailed: kind === 'readback', canContinueBookmarks: kind === 'pending' },
      readerRecoveryView: hidden, readerSettingsRecovery: settingsPending ? view(8, '设置待确认') : hidden,
      ttsPreferencesRecovery: hidden, ttsConfigurationRecovery: hidden, replaceRecovery: hidden,
      sourceSwitchPresentationVisible: false, readerPreferenceModule: () => '', viewportWidth: 366,
      readerRecoveryInputCurrent: () => true, controlLayout: () => ({ topBarWidth: 320 }),
      readerRecoveryViewportHeight: () => 260, readerRecoveryTop: () => 40, readerRecoveryOverlayId: () => 'overlay-a',
      bookmarkRecoveryIdentity: () => 'bookmark-a', reconcileBookmarkRecovery() {}, retryReaderPreferenceNotice() {},
    });
    owner.readerRecoveryContent();
    const groups = components(sdk, owner, 'ReaderRecoveryGroup');
    const notices = components(sdk, owner, 'ReaderRecoveryNotice');
    assert.equal(groups.length, kind === 'pending' || settingsPending ? 1 : 0);
    assert.equal(notices.length, Number(kind === 'pending') + Number(settingsPending));
    if (kind !== 'pending' && settingsPending) assert.equal(notices[0].follows, false,
      'known result outside the group does not create a divider above its first pending item');
    const directory = components(sdk, owner, 'ReaderDirectoryRecoverySurface');
    assert.equal(directory.length, 1);
    assert.equal(directory[0].grouped, kind === 'pending');
  }
}

function measurementFallback() {
  const sdk = boundedSurfaceSdk();
  const owner = sdk.consumer(read('ui/feedback/ReaderRecoveryNotice.ets'), undefined, {}, {
    view: view(7, '无法取得测量时保留完整消息'), layoutWidthVp: 300, actionLabel: '核对原操作',
  });
  owner.getUIContext = () => { throw new Error('finite unavailable native measure port'); };
  owner.aboutToAppear(); owner.initialRender();
  assert.equal(owner.expanded, true);
  assert.equal(owner.clipped, false);
  assert.equal(owner.reservedSpace, '');
  assert.ok(components(sdk, owner, 'ReaderRecoveryAction').every(item => item.label !== '展开' && item.label !== '收起'));
}

function noActionDensity() {
  for (const grouped of [false, true]) {
    const sdk = boundedSurfaceSdk();
    const owner = sdk.consumer(read('ui/feedback/ReaderRecoveryNotice.ets'), undefined, {}, {
      view: { ...view(7, '只读事项'), canRetry: false }, actionLabel: '', grouped,
    });
    owner.aboutToAppear(); owner.initialRender();
    assert.equal(owner.hasNoticeActions(), false);
    const nodes = [...owner.nodes.values()];
    assert.equal(nodes.some(node => node.type === 'Blank'), false,
      'an empty action group never reserves the historical extra22 height');
    assert.ok(nodes.some(node => node.type === 'Column' && node.constraintSize?.minHeight === 36));
    assert.equal(components(sdk, owner, 'ReaderRecoveryAction').length, 0);
  }
}

function requestIdentity() {
  const source = read('features/reading/ui/LocalReadingExperience.ets');
  const methods = ['openReaderRecovery', 'readerRecoveryOverlayId', 'readerRecoveryRequestCurrent',
    'readerRecoveryInputCurrent', 'retireReaderRecovery'];
  for (const field of ['sourceId', 'bookId', 'lifecycleToken']) {
    const owner = createReaderBuilderProbe(source, methods).owner;
    Object.assign(owner, { mounted: true, exitRequested: false, readerRecoveryRequested: false,
      sourceId: 'source-a', bookId: 'book-a', lifecycleToken: 7, sourceSwitchPresentationVisible: false,
      hasReaderRecoveryContent: () => true, isControlInputEnabled: () => true, hideControl() {},
      controlVisible: () => false, controlMotionVisible: () => false });
    const originalIdentity = owner.readerRecoveryOverlayId();
    owner.openReaderRecovery(originalIdentity);
    assert.equal(owner.readerRecoveryInputCurrent(), true);
    owner[field] = field === 'lifecycleToken' ? 8 : 'successor';
    assert.equal(owner.readerRecoveryInputCurrent(), false, 'requested recovery does not leak through ' + field);
    owner.openReaderRecovery(originalIdentity);
    assert.equal(owner.readerRecoveryInputCurrent(), false, 'old menu callback cannot borrow the successor');
    owner.retireReaderRecovery();
    owner.openReaderRecovery(owner.readerRecoveryOverlayId());
    assert.equal(owner.readerRecoveryInputCurrent(), true);
  }
  const panel = createReaderBuilderProbe(read('features/reading/ui/ReaderControlPanel.ets'),
    ['performMoreAction', 'setMoreMenuVisible', 'dismissMoreMenu', 'onRecoveryIdentityChanged']).owner;
  const calls = [];
  Object.assign(panel, { moreMenuVisible: false, inputEnabled: true, controlObscured: false,
    temporaryLayerActive: false, frame: () => ({ visibility: 1 }), moreMenuGeneration: 0,
    recoveryIdentity: 'reading-a', recoveryAvailable: true, syncProgressInput() {}, onTemporaryLayerChange() {},
    onOpenRecovery: identity => calls.push(identity) });
  panel.setMoreMenuVisible(true);
  const originalMenuGeneration = panel.moreMenuGeneration;
  panel.recoveryIdentity = 'reading-b';
  panel.performMoreAction('recovery', originalMenuGeneration);
  assert.deepEqual(calls, [], 'a retained opening cannot request a different reading owner');
  panel.onRecoveryIdentityChanged();
  assert.equal(panel.moreMenuVisible, false);
  panel.setMoreMenuVisible(true);
  panel.performMoreAction('recovery', panel.moreMenuGeneration);
  assert.deepEqual(calls, ['reading-b']);
}

function retainedBusyAdmission() {
  const rssSource = read('features/rss/ui/RssOriginalRecoverySurface.ets');
  const syncSource = read('features/sync/ui/SyncPage.ets');
  for (const family of ['rss', 'sync']) {
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    const calls = [];
    let owner;
    let original;
    if (family === 'rss') {
      original = { generation: 7, sequence: 7, operationId: 'rss-original', method: 'rss-source.put',
        scope: 'management', subscriptionId: 's', guid: '', confirmation: 'unknown', writeStage: 'core',
        busy: false, blocked: true, canRetryOriginal: true, message: '原操作待核对' };
      owner = sdk.consumer(rssSource, boundedMembers(rssSource), { rssOriginalMatchesScope }, {
        original, presentationIdentity: 'rss-current', scope: 'management',
        onReconcileOriginal: () => calls.push('query'), onContinueOriginal: () => calls.push('continue'),
      });
      owner.aboutToAppear(); owner.initialRender();
    } else {
      original = { operationId: 'sync-original', action: 'saveConfig', completed: false,
        canContinueOriginal: true, projection: { receipt: { confirmation: 'unknown' }, facts: { generation: 7 } } };
      const methods = ['snapshot', 'syncSnapshotInputs', 'originalRecovery', 'originalRecoveryNotice', 'hasOriginalRecovery', 'recoveryIdentity',
        'recoveryCurrent', 'canContinueConfigSave', 'configSaveContinuationIdentities', 'configSaveGeneration',
        'canSkipBackupRetention', 'backupRetentionActionIdentities', 'backupGeneration', 'recoveryLabel'];
      owner = sdk.consumer(syncSource, methods, { DEFAULT_SYNC_SNAPSHOT: {} }, {
        snapshot: { facts: { operation: original, busy: false } },
      });
      Object.assign(owner, { feedbackView: () => ({ ...view(7, '配置待核对'), canRetry: !owner.snapshot.facts.busy && owner.snapshot.facts.queryAvailable !== false }),
        effectiveWebdavUrl: () => '', effectiveWebdavUser: () => '', effectiveWebdavPath: () => '',
        onReconcile: () => calls.push('query'), onContinueConfigSave: () => calls.push('continue') });
      owner.originalRecovery(owner.recoveryIdentity());
    }
    const actions = components(sdk, owner, 'ReaderRecoveryAction');
    assert.equal(actions.length, 2);
    const buttons = actions.map(action => [...action.nodes.values()].find(node => node.type === 'Button'));
    buttons.forEach(button => button.onClick());
    assert.equal(calls.length, 2);
    if (family === 'rss') owner.original = { ...original, busy: true };
    else owner.snapshot = { facts: { operation: original, busy: true } };
    sdk.properties.flush();
    assert.deepEqual(components(sdk, owner, 'ReaderRecoveryAction'), actions, 'only busy changes in the same original generation');
    for (let index = 0; index < actions.length; index++) {
      const button = [...actions[index].nodes.values()].find(node => node.type === 'Button');
      assert.equal(button, buttons[index]);
      assert.equal(button.enabled, false);
      assert.equal(actions[index].isBusy, false, 'an unknown global busy owner cannot select a particular spinner');
      button.onClick();
    }
    assert.equal(calls.length, 2);
    if (family === 'rss') owner.original = original;
    else owner.snapshot = { facts: { operation: original, busy: false } };
    sdk.properties.flush();
    for (let index = 0; index < actions.length; index++) {
      assert.equal([...actions[index].nodes.values()].find(node => node.type === 'Button'), buttons[index]);
      assert.equal(buttons[index].enabled, true);
    }
    buttons[0].onClick();
    assert.equal(calls.length, 3);
    if (family === 'sync') {
      owner.snapshot = { facts: { operation: original, busy: false, queryAvailable: false } };
      buttons[0].onClick();
      assert.equal(calls.length, 3, 'current query permission retires before queued SDK repaint');
    }
  }
}

function readerRecoveryOwner() {
  const source = read('features/reading/ui/LocalReadingExperience.ets');
  const methods = ['readerRecoveryOwnerKey', 'showReaderRecovery', 'reconcileReaderRecovery'];
  for (const field of ['sourceId', 'bookId', 'lifecycleToken', 'chapterSelectionToken']) {
    const owner = createReaderBuilderProbe(source, methods).owner;
    const calls = [];
    Object.assign(owner, { mounted: true, exitRequested: false, sourceId: 'source-a', bookId: 'book-a',
      lifecycleToken: 7, chapterSelectionToken: 9, readerRecoveryView: hidden });
    owner.showReaderRecovery('原阅读事项', '重试', () => calls.push('original'));
    const generation = owner.readerRecoveryView.generation;
    owner[field] = typeof owner[field] === 'number' ? owner[field] + 1 : 'successor';
    owner.reconcileReaderRecovery(generation);
    assert.deepEqual(calls, [], 'old action must not borrow ' + field);
    owner.showReaderRecovery('当前阅读事项', '重试', () => calls.push('current'));
    owner.reconcileReaderRecovery(owner.readerRecoveryView.generation);
    assert.deepEqual(calls, ['current']);
    assert.equal(owner.readerRecoveryView.visible, false);
    owner.reconcileReaderRecovery(owner.readerRecoveryView.generation);
    assert.deepEqual(calls, ['current']);
  }
}

const cases = { 'journey-root': journeyRoot, 'reading-items': readingItems,
  'directory-group': directoryGroup, 'measurement-fallback': measurementFallback, 'no-action-density': noActionDensity, 'request-identity': requestIdentity, 'retained-busy-admission': retainedBusyAdmission, 'reader-recovery-owner': readerRecoveryOwner };
for (const id of selectContractCases({
  'journey-root': 'Actual complete root Journey Builder parses and mounts four current owners into one painted group.',
  'reading-items': 'Actual LRE Builders group only pending notices and preserve confirmed result/readback outside green surfaces.',
  'directory-group': 'Actual standalone/embedded directory recovery groups two pending owners and keeps known readback separate.',
  'measurement-fallback': 'Unavailable native measure preserves full text and offers no unproven fold action.',
  'no-action-density': 'A readonly notice owns the approved minimum36 item and no empty44 action reservation.',
  'request-identity': 'Explicit reading requests and More menu openings retain the source/book/lifecycle identity across successors.',
  'retained-busy-admission': 'RSS/Sync same-generation busy disables retained actions without guessing spinner ownership or changing canRetry.',
  'reader-recovery-owner': 'Actual reading recovery action validates original source/book/lifecycle/chapter owner and current visible retry qualification.',
})) {
  cases[id]();
  recordContractCasePass(id);
}
