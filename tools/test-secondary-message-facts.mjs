import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context); throw error;
} } });
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const { rssOriginalMatchesScope } = await import('../entry/src/main/ets/features/rss/application/RssMutationRecoveryContract.ts');
const { DOWNLOAD_VISUAL } = await import('../entry/src/main/ets/features/downloads/ui/SharedDownloadVisualSpec.ts');
const selected = selectContractCases({
  'rss-facts': { description: 'Actual RSS SDK surfaces distinguish current original pending, pure read failure and known result, rejecting foreign entity and retained retry actors', resources: [] },
  'range-draft': { description: 'Actual download range draft invalidation uses local content-state, preserves draft until explicit action and rejects old revision', resources: [] },
});
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const originalSource = read('features/rss/ui/RssOriginalRecoverySurface.ets');
function sdkWithOriginal() {
  const sdk = boundedSurfaceSdk();
  const original = sdk.consumer(originalSource, undefined, { rssOriginalMatchesScope });
  sdk.hooks.childSources.RssOriginalRecoverySurface = originalSource;
  sdk.deps.RssOriginalRecoverySurface = original.constructor;
  return sdk;
}
const original = { generation: 8, operationId: 'op-a', sequence: 4, method: 'rss.favorite.add', scope: 'entry',
  subscriptionId: 'sub-a', guid: 'entry-a', confirmation: 'unknown', writeStage: 'core', busy: false,
  blocked: true, canRetryOriginal: true, message: '原收藏操作回执尚未确认' };
for (const id of selected) {
  if (id === 'rss-facts') {
    for (const [scope, subscriptionId, guid, visible] of [
      ['entry','sub-a','entry-a',true], ['entry','sub-a','entry-b',false], ['entry','sub-b','entry-a',false],
      ['editor','sub-a','',false], ['management','','',false], ['feed','sub-a','',false],
    ]) {
      const sdk = sdkWithOriginal(), calls = [];
      const owner = sdk.consumer(originalSource, undefined, { rssOriginalMatchesScope },
        { original, scope, subscriptionId, guid, presentationIdentity: 'opening-a' });
      Object.assign(owner, { mounted: true, onReconcileOriginal: value => calls.push(value) });
      owner.initialRender(); sdk.properties.flush();
      assert.equal(owner.view().visible, visible); assert.equal(owner.identities().length, visible ? 1 : 0);
      if (visible) {
        const child = sdk.walk(owner).find(node => node instanceof sdk.deps.ReaderRecoveryAction && node.label === '核对原操作回执');
        const physical = [...child.nodes.values()].find(node => node.type === 'Button' && node.onClick);
        physical.onClick(); assert.equal(calls.length, 1);
        owner.guid = 'entry-b'; physical.onClick(); assert.equal(calls.length, 1, 'old original actor cannot borrow another entity');
      }
    }
    for (const [page, methods, props] of [
      ['RssPage',['readFeedback'],{}],
      ['RssSourceFeedPage',['operationFeedback','feedbackView','retryFeedback'],{ subscription: { subscriptionId: 'sub-b' } }],
      ['RssEntryDetailPage',['operationFeedback','feedbackView','retryFeedback'],{ item: { subscriptionId: 'sub-b', guid: 'entry-b' } }],
    ]) {
      const sdk = sdkWithOriginal(), retries = [];
      const facts = { fact: 'failed', canRetry: true, generation: 12, message: '当前实体读取失败' };
      const owner = sdk.consumer(read('features/rss/ui/' + page + '.ets'), methods,
        { readerRecoveryView, rssOriginalMatchesScope }, { ...props, original, readFacts: facts });
      Object.assign(owner, props, { original, readFacts: facts, presentationIdentity: 'opening-b',
        onRetryRead: value => retries.push(value.generation) });
      owner[methods[0]](); sdk.properties.flush();
      const state = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderPageState);
      assert.ok(state, page + ' pure read fact uses content state');
      assert.equal(state.message, facts.message);
      assert.equal(sdk.walk(owner).filter(child => child instanceof sdk.deps.ReaderRecoveryNotice).length, 0,
        'foreign pending cannot suppress a current read failure or create its own notice');
      const retry = sdk.walk(state).find(child => child instanceof sdk.deps.ReaderRecoveryAction);
      const physical = [...retry.nodes.values()].find(node => node.type === 'Button' && node.onClick);
      physical.onClick(); assert.deepEqual(retries, [12]);
      owner.readFacts = { ...facts, generation: 13 }; physical.onClick(); assert.deepEqual(retries, [12]);
    }
    const management = read('features/rss/ui/RssSubscriptionManagementPage.ets'), sdk = sdkWithOriginal(), messages = [];
    const owner = sdk.consumer(management, ['notifyResult']);
    Object.assign(owner, { mounted: false,
      resultFeedback: { show(context, options, current) { messages.push({ options, current }); } },
      resultMessage: '已导入 2 个订阅源', presentationIdentity: 'management-a' });
    owner.mounted = true;
    owner.notifyResult(); assert.equal(messages.length, 1); assert.equal(messages[0].current(), true);
    owner.presentationIdentity = 'management-b'; assert.equal(messages[0].current(), false, 'known result expires with original presentation');
    assert.doesNotMatch(management, /ReaderRecoveryNotice\s*\(/, 'known management result has no unknown-operation frame');
    const retryOwner = sdk.consumer(management, ['retryFeedback','hasOperationFeedback']);
    const retryCalls = [];
    Object.assign(retryOwner, { readFacts: { generation: 20, canRetry: true },
      onRetryRead: facts => retryCalls.push(facts.generation) });
    retryOwner.retryFeedback(20); assert.deepEqual(retryCalls, [20]);
    retryOwner.readFacts = { generation: 21, canRetry: true };
    retryOwner.retryFeedback(20); assert.deepEqual(retryCalls, [20], 'management retained read actor cannot borrow successor facts');
  } else {
    const sdk = boundedSurfaceSdk(), calls = [];
    const owner = sdk.consumer(read('features/downloads/ui/SharedDownloadPage.ets'), ['rangeSheet'], { DOWNLOAD_VISUAL });
    Object.assign(owner, { actionBookKeys: [], rangeChoice: 'custom', rangeDraftRevision: 4, rangeCatalogChanged: true,
      rangeStart: '12', rangeEnd: '20', rangeBookKey: 'book-a',
      rangeBook: () => ({ projectionStatus: 'ready' }), sheet: 'range',
      sheetOpeningIsCurrent: opening => opening === 7,
      choiceRow() {}, rangeInputs() {}, resetRangeDraft: key => calls.push(key) });
    owner.rangeSheet(7); sdk.properties.flush();
    const state = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderPageState);
    assert.ok(state); assert.equal(state.title, '目录已更新');
    assert.equal(sdk.walk(owner).filter(child => child instanceof sdk.deps.ReaderRecoveryNotice).length, 0);
    assert.deepEqual([owner.rangeStart, owner.rangeEnd, owner.rangeChoice], ['12','20','custom'], 'invalidation itself preserves user draft and selected mode');
    const retry = sdk.walk(state).find(child => child instanceof sdk.deps.ReaderRecoveryAction);
    const physical = [...retry.nodes.values()].find(node => node.type === 'Button' && node.onClick);
    physical.onClick(); assert.deepEqual(calls, ['book-a']);
    owner.rangeDraftRevision = 5; physical.onClick(); assert.equal(calls.length, 1);
    owner.rangeDraftRevision = 4; owner.sheet = ''; physical.onClick(); assert.equal(calls.length, 1);
  }
  console.log('PASS secondary message facts ' + id + ' with actual SDK business surfaces; no Core/native execution');
  recordContractCasePass(id);
}
