import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { auditTypographyConsumers } from './lib/reader-typography-consumer-audit.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/design/rss-management-typography-baseline.json', import.meta.url)));
const source = readFileSync(new URL(`../${fixture.path}`, import.meta.url), 'utf8');
const verifyMigrationSource = process.argv.includes('--verify-migration-source');
const consumers = auditTypographyConsumers(source, fixture.path), used = new Set(), edits = [];
for (const baseline of fixture.nodes) {
  const matches = node => node.kind === baseline.kind && node.modifiers.fontSize?.expression === baseline.changes.fontSize;
  const node = consumers.find(node => !used.has(node) && node.method === baseline.method && matches(node) &&
    (!verifyMigrationSource || node.text === baseline.text)) ??
    (!verifyMigrationSource ? consumers.find(matches) : undefined);
  assert.ok(node); used.add(node);
  assert.deepEqual(Object.keys(node.modifiers).sort(), Object.keys(baseline.original).sort(), 'current AUTO omissions retained');
  for (const [property, expected] of Object.entries(baseline.original)) {
    const modifier = node.modifiers[property]; assert.equal(modifier.expression, baseline.changes[property]);
    assert.deepEqual(modifier.extra, baseline.extra[property]);
    edits.push({ start: modifier.start, end: modifier.end, value: expected });
  }
}
assert.equal(fixture.nodes.length, 8, 'eight original semantic consumers; shared Builders may later remove duplicate authored actors');
let restored = source;
for (const edit of edits.sort((a,b) => b.start-a.start)) restored = restored.slice(0,edit.start)+edit.value+restored.slice(edit.end);
if (verifyMigrationSource) { assert.ok(restored.startsWith(fixture.roleImport)); restored = restored.slice(fixture.roleImport.length); }
if (verifyMigrationSource) assert.equal(createHash('sha256').update(restored).digest('hex'), fixture.sha256, 'all owner facts, guards, callbacks, layout, background and lifecycle bytes retained');
assert.ok(consumers.filter(node => node.modifiers.fontSize).every(node => /TYPE_/.test(node.modifiers.fontSize.expression)));
const recoverySource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderRecoveryAction.ets',import.meta.url),'utf8');
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(sdk+'/lib/validate_ui_syntax.js');
syntax.componentCollection.customComponents.add('ReaderRecoveryAction');syntax.propCollection.set('ReaderRecoveryAction',new Set([...recoverySource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
class RecoveryChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
const renderRecovery=parent=>{const child=[...parent.children.values()][0];const owner=createReaderBuilderProbe(recoverySource,['build']).owner;Object.assign(owner,{enabled:true},child.params,{appThemeScheme:'day'});owner.initialRender();return [...owner.nodes.values()].find(n=>n.type==='Text');};
const names = ['operationFeedback', 'feedbackMessage', 'hasOperationFeedback', 'canRetryFeedback', 'retryFeedback', 'stats', 'enabledCount', 'disabledCount', 'sourceDocumentAction'];
const { owner } = createReaderBuilderProbe(source, names,{ReaderRecoveryAction:RecoveryChild});
let reads = 0, operations = 0, documents = 0;
Object.assign(owner, { appThemeScheme: 'day', items: [], readFacts: { fact: 'failed', message: '网络错误', canRetry: true },
  onRetryRead: () => reads++, onReconcile: () => operations++ });
owner.operationFeedback(); owner.stats(); owner.sourceDocumentAction('导入', () => documents++);
const text = [...owner.nodes.values()].filter(node => node.type === 'Text');
const recovery = renderRecovery(owner), message = text.find(node => String(node.create).startsWith('订阅源加载失败'));
assert.equal(message.fontSize, 10); assert.equal(message.lineHeight, 12.5); assert.equal(message.fontWeight, 400);
assert.equal(recovery.fontSize, 11); assert.equal(recovery.fontWeight, 700); assert.equal(recovery.height, 36);
assert.ok(!Object.hasOwn(recovery, 'lineHeight'), 'recovery action preserves natural AUTO line box');
recovery.onClick(); assert.equal(reads, 1);
owner.operation = { projection: { receipt: { fact: 'confirmedRefreshFailed', message: '已保存，刷新失败' }, refreshError: '网络错误', facts: { canRetry: true } } };
owner.replay(); renderRecovery(owner).onClick(); assert.equal(operations, 1); assert.equal(reads, 1, 'late callback routes to current authoritative owner');
text.find(node => node.create === '导入').onClick(); assert.equal(documents, 1);
const { owner: propagated } = createReaderBuilderProbe(source, names, {
  ReaderRecoveryAction:RecoveryChild,
  TYPE_SOURCE_MANAGEMENT_META: { ...readerTypographyRoles.TYPE_SOURCE_MANAGEMENT_META, fontSizeFp: 12 },
});
Object.assign(propagated, { appThemeScheme: 'day', items: [], readFacts: owner.readFacts });
propagated.operationFeedback(); propagated.stats();
assert.ok([...propagated.nodes.values()].filter(node=>node.fontWeight===400).every(node=>node.fontSize===12), 'one metadata-role change reaches feedback and stats');
console.log('PASS RSS management Typography: eight real consumers, exact owner/source preservation, SDK feedback/AUTO/callback replay/shared propagation');
