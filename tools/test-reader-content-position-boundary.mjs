import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
    throw error;
  }
} });
const { LocalReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const chapterData = { sourceId: 'local', bookId: 'book', chapterIndex: 3, chapterTitle: '章', content: '正确正文',
  bodyVersion: 'body', processingVersion: 'rules' };
for (const scope of ['valid', 'legacy', 'half', 'empty', 'stale']) {
  const data = { ...chapterData };
  if (scope === 'legacy') { delete data.bodyVersion; delete data.processingVersion; }
  if (scope === 'half') delete data.processingVersion;
  if (scope === 'empty') data.bodyVersion = '';
  const runtime = { request: async () => ({data}) };
  const local = new LocalReadingFlowGateway(runtime);
  if (scope === 'half' || scope === 'empty') {
    await assert.rejects(local.loadChapter('book', 3)); continue;
  }
  const gateway = new ReadingSessionFlowGateway('local', 'book', { kind: 'local' }, runtime);
  const context = scope === 'stale' ? {bodyVersion: 'old', processingVersion: 'rules', anchors: [{id: 'requested', offset: 1}]} : undefined;
  if (context) { await assert.rejects(gateway.loadChapter('book', 3, () => true, false, context), /without a migration receipt/); continue; }
  const actual = await gateway.loadChapter('book', 3);
  assert.equal(actual.bodyVersion, data.bodyVersion);
  assert.equal(actual.processingVersion, data.processingVersion);
  assert.equal(actual.content, data.content);
}

const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const Host = productionMotionMethods(file, ['persistBeforeContentMutation', 'reloadMigratedContentPosition',
  'showReaderRecovery', 'reconcileReaderRecovery'], {
  hilog: { error() {} },
});
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject}; }
function fixture() {
  const events=[], selections=[], dialogs=[];
  const host = Object.assign(new Host(), { lifecycleToken: 1, sourceId: 'local', bookId: 'book',
    mounted: true, phase: 'ready', chapterSelectionToken: 4, chapter: {chapterIndex: 3}, visiblePage: {startScalar: 100},
    readerSettingsSnapshot: {navigationMode: 'paged'}, pageTurnSettlementActive: false,
    isSessionActive(token) { return this.mounted && token === this.lifecycleToken; },
    isSelectionActive(token, selection) { return this.isSessionActive(token) && selection === this.chapterSelectionToken; },
    awaitOrdinaryFirstPagePersistence: async () => {events.push('ordinary-confirmed');},
    commitVisiblePage: async () => {events.push('visible-confirmed'); host.lastCommittedProgress = {
      sourceId: 'local', bookId: 'book', chapterIndex: 3, chapterOffset: 100 };},
    errorMessage: e => e.message, selectChapterAnchor: (...args) => selections.push(args),
    getUIContext: () => ({showAlertDialog: dialog => dialogs.push(dialog)}),
  });
  const gateway = { runProgressCommitSerial: async action => {events.push('drain'); await action();},
    hasPendingSourceSwitch: () => false,
    loadProgress: async () => ({kind:'restored',progress:{chapterIndex:3,chapterOffset:125,bodyVersion:'body',processingVersion:'new-rules'}}) };
  host.activeGateway = () => gateway;
  return {host, gateway, events, selections, dialogs};
}
{
  const {host,events}=fixture();
  const isCurrent=await host.persistBeforeContentMutation();
  assert.deepEqual(events,['ordinary-confirmed','drain','visible-confirmed']);
  assert.equal(isCurrent(),true);
  host.visiblePage={startScalar:150}; assert.equal(isCurrent(),false,'a newer page revokes the mutation dispatch anchor');
}
for (const change of ['leave','selection','turn','transaction','unconfirmed']) {
  const f=fixture(), pending=deferred(); f.host.awaitOrdinaryFirstPagePersistence=()=>pending.promise;
  const result=f.host.persistBeforeContentMutation();
  if(change==='leave') f.host.mounted=false;
  if(change==='selection') f.host.phase='measuring';
  if(change==='turn') f.host.pageTurnSettlementActive=true;
  if(change==='transaction') f.gateway.hasPendingSourceSwitch=()=>true;
  if(change==='unconfirmed') f.host.commitVisiblePage=async()=>{};
  pending.resolve(); await assert.rejects(result,/NOT_CONFIRMED/);
}
{
  const f=fixture(); await f.host.reloadMigratedContentPosition(1,'book');
  assert.deepEqual(f.selections[0].slice(0,3),[3,125,false]);
  assert.equal(f.selections[0][5],-1,'internal reload cannot capture a control selection');
  assert.equal(f.selections[0][8].processingVersion,'new-rules');
  assert.equal(f.selections[0][8].anchors[0].offset,125,'new version always carries migrated scalar');
}
for(const change of ['book','selection','leave','missing','failure']) {
  const f=fixture(),pending=deferred(); f.gateway.loadProgress=()=>pending.promise;
  const originalChapter=f.host.chapter, originalPage=f.host.visiblePage;
  const result=f.host.reloadMigratedContentPosition(1,'book');
  if(change==='book') f.host.bookId='other';
  if(change==='selection') f.host.chapterSelectionToken++;
  if(change==='leave') f.host.mounted=false;
  if(change==='failure') pending.reject(Error('storage unavailable'));
  else pending.resolve(change==='missing'?{kind:'missing'}:{kind:'restored',progress:{chapterIndex:3,chapterOffset:125}});
  await result; assert.equal(f.selections.length,0);
  assert.equal(f.dialogs.length,0,'automatic content-position recovery cannot claim a modal dialog');
  assert.equal(f.host.chapter,originalChapter,'a missing/foreign position never replaces the materialized chapter');
  assert.equal(f.host.visiblePage,originalPage,'the last visible page is preserved instead of applying an unconfirmed scalar');
  if(change==='missing'||change==='failure') {
    assert.equal(f.host.readerRecoveryView.visible,true);
    assert.equal(f.host.readerRecoveryView.canRetry,true);
    assert.equal(f.host.readerRecoveryActionLabel,'重试恢复');
    f.gateway.loadProgress=async()=>({kind:'restored',progress:{chapterIndex:3,chapterOffset:130,
      bodyVersion:'current-body',processingVersion:'current-rules'}});
    f.host.reconcileReaderRecovery(f.host.readerRecoveryView.generation);
    for(let n=0;n<8;n++) await Promise.resolve();
    assert.equal(f.host.readerRecoveryView.visible,false);
    assert.equal(f.selections.length,1,'the optional inline retry executes the actual reload method');
    assert.deepEqual(f.selections[0].slice(0,3),[3,130,false]);
    assert.equal(f.selections[0][8].bodyVersion,'current-body');
    assert.equal(f.selections[0][8].processingVersion,'current-rules');
    assert.equal(f.selections[0][8].anchors[0].offset,130,'retry consumes Core migrated scalar with its exact body versions');
  } else assert.equal(f.host.readerRecoveryView?.visible??false,false,'retired presentation cannot publish an inline recovery');
}
{
  const f=fixture(); f.gateway.loadProgress=async()=>({kind:'missing'});
  await f.host.reloadMigratedContentPosition(1,'book');
  const oldAction=f.host.readerRecoveryAction;
  f.host.bookId='new-book';
  oldAction();
  for(let n=0;n<8;n++) await Promise.resolve();
  assert.equal(f.selections.length,0,'an old recovery action cannot restore a position into another book');
}
console.log('local Core versions + content-mutation visible-position confirmation and migrated-anchor reload: PASS');
