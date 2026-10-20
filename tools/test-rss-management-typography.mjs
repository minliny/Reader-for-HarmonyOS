import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function feedbackStats(){
 const {rssRecoverySurfaceSdk}=await import('./lib/rss-recovery-surface-sdk-probe.mjs');
 const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const source=readFileSync(new URL('../entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets',import.meta.url),'utf8');
const names = ['operationFeedback', 'feedbackMessage', 'hasOperationFeedback', 'canRetryFeedback', 'retryFeedback', 'stats', 'enabledCount', 'disabledCount', 'sourceDocumentAction'];
const shared=rssRecoverySurfaceSdk();
const owner=shared.consumer(source,names);
const renderRecovery=parent=>{const actor=shared.walk(parent).filter(c=>c instanceof shared.deps.ReaderRecoveryAction).at(-1);assert.ok(actor,'actual SDK recovery child');return{label:shared.nodes(actor).find(n=>n.type==='Text'),hit:shared.nodes(actor).find(n=>n.type==='Stack'&&n.onClick)};};
let reads = 0, operations = 0, documents = 0;
Object.assign(owner, { appThemeScheme: 'day', items: [], readFacts: { fact: 'failed', message: '网络错误', canRetry: true },
  onRetryRead: () => reads++, onReconcile: () => operations++ });
owner.operationFeedback(); owner.stats(); owner.sourceDocumentAction('导入', () => documents++);
const text = shared.nodes(owner).filter(node => node.type === 'Text');
const recovery = renderRecovery(owner), message = text.find(node => String(node.create).startsWith('订阅源加载失败'));
const meta=readerTypographyRoles.TYPE_SOURCE_MANAGEMENT_META;assert.deepEqual([message.fontFamily,message.fontWeight,message.fontSize,message.lineHeight],[meta.fontFamily,meta.fontWeight,meta.fontSizeFp,meta.lineHeightFp]);
const action=readerTypographyRoles.MESSAGE_ACTION;assert.deepEqual([recovery.label.fontFamily,recovery.label.fontWeight,recovery.label.fontSize,recovery.label.lineHeight],[action.fontFamily,action.fontWeight,action.fontSizeFp,action.lineHeightFp]);
assert.equal(recovery.hit.constraintSize.minHeight,44,'approved shared recovery action keeps its real touch host');
recovery.hit.onClick(); assert.equal(reads, 1);
owner.operation = { projection: { receipt: { fact: 'confirmedRefreshFailed', message: '已保存，刷新失败' }, refreshError: '网络错误', facts: { canRetry: true } } };
owner.replay(); renderRecovery(owner).hit.onClick(); assert.equal(operations, 1); assert.equal(reads, 1, 'late callback routes to current authoritative owner');
text.find(node => node.create === '导入').onClick(); assert.equal(documents, 1);
const changed=rssRecoverySurfaceSdk({typographyRoles:{TYPE_SOURCE_MANAGEMENT_META: { ...readerTypographyRoles.TYPE_SOURCE_MANAGEMENT_META, fontSizeFp: 12 }}});
const propagated=changed.consumer(source,names);
Object.assign(propagated, { appThemeScheme: 'day', items: [], readFacts: owner.readFacts });
propagated.operationFeedback(); propagated.stats();
for(const label of ['订阅源加载失败','0 个订阅源']){const node=changed.nodes(propagated).find(node=>node.type==='Text'&&String(node.create).startsWith(label));assert.ok(node,label);assert.equal(node.fontSize,12,'metadata-role mutation reaches each actual semantic carrier');}
}
for(const id of selectContractCases({'feedback-stats':'Actual feedback/statistics roles, native recovery callbacks and shared role propagation'})){await feedbackStats();recordContractCasePass(id);}
