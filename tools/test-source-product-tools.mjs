import assert from 'node:assert/strict';
import fs from 'node:fs';

const gateway = fs.readFileSync('entry/src/main/ets/features/source/SourceGateway.ts', 'utf8');
const orchestrator = fs.readFileSync('entry/src/main/ets/features/source/SourceToolsOrchestrator.ets', 'utf8');
const page = fs.readFileSync('entry/src/main/ets/features/source/SourceToolsPage.ets', 'utf8');
const sourcePage = fs.readFileSync('entry/src/main/ets/features/source/SourceManagementPage.ets', 'utf8');
const host = fs.readFileSync('entry/src/main/ets/app/ReaderHostRegistry.ts', 'utf8');
const httpHost = fs.readFileSync('entry/src/main/ets/app/HttpExecuteHost.ts', 'utf8');
const owner = fs.readFileSync('entry/src/main/ets/app/ReaderRuntimeOwner.ts', 'utf8');
const index = fs.readFileSync('entry/src/main/ets/pages/Index.ets', 'utf8');
const rulesGateway = fs.readFileSync('entry/src/main/ets/features/settings/RulesManagementGateway.ts', 'utf8');
const rulesPage = fs.readFileSync('entry/src/main/ets/features/settings/RulesManagementPage.ets', 'utf8');

assert.match(gateway, /request\('source\.export', params\)/);
assert.match(gateway, /request\('source\.debug',[\s\S]*responses: \{\}/);
assert.match(gateway, /checkSource\([\s\S]*source\.check\.run/);
assert.doesNotMatch(gateway, /request\('rule-sub\./,
  'SourceGateway must not duplicate Rules Management subscription ownership');
assert.match(gateway, /editedId !== sourceId[\s\S]*不允许隐式迁移 bookSourceUrl/);
assert.match(gateway, /source\.export count does not match its JSON array/);
assert.match(gateway, /bookSourceGroup/);
assert.match(gateway, /takeSourceHttpDiagnostics\(result\.requestId\)/);
assert.match(gateway, /source\.check\.run Host evidence correlation mismatch/);
assert.match(gateway, /\[Core\]/);
assert.match(gateway, /\[Host\]/);
assert.match(gateway, /record\.stage[\s\S]*record\.method[\s\S]*record\.url/);

assert.match(host, /new picker\.DocumentViewPicker\(this\.context\)\.save\(options\)/);
assert.match(host, /JsonDocumentLimitBytes/);
assert.match(host, /fileIo\.OpenMode\.TRUNC/);
assert.match(host, /while \(writtenBytes < bytes\.byteLength\)/);
assert.match(host, /await fileIo\.fsync\(file\.fd\)/);
assert.match(owner, /return this\.host\.saveBookSourceJson\(text, suggestedFileName\)/);
assert.match(httpHost, /parseSourceDiagnostic/);
assert.match(httpHost, /sourceDiagnosticsByRequestId/);
assert.match(httpHost, /sanitizeDiagnosticUrl/);
assert.match(httpHost, /takeSourceDiagnostics/);
assert.match(owner, /takeSourceHttpDiagnostics\(requestId: number\)/);

assert.match(orchestrator, /gateway\.exportBookSources\(sourceIds\)/);
assert.match(orchestrator, /owner\.saveBookSourceJson/);
assert.match(orchestrator, /gateway\.saveEditableSource/);
assert.match(orchestrator, /gateway\.checkSource[\s\S]*debugLogs: health\.logs/);
assert.doesNotMatch(orchestrator, /gateway\.debugSource/,
  'product debug must not replay an empty response map after the real check');
assert.match(orchestrator, /setSelectedEnabled/);
assert.match(orchestrator, /checkSelected/);
assert.match(orchestrator, /deleteSelected/);
assert.match(orchestrator, /open\(seedSources: BookSource\[\] = \[\]\)/);
assert.match(orchestrator, /this\.snapshot\.sources = seedSources\.slice\(\)/);
assert.match(orchestrator, /setSelection\(sourceIds: string\[\]\)/);
assert.match(orchestrator, /selectedSourceIds: source\.selectedSourceIds\.slice\(\)/);
assert.match(orchestrator, /已选择 \$\{selection\.length\} 个书源/);
assert.doesNotMatch(orchestrator, /RuleSubscription|rule-sub|putSubscription|deleteSubscription/);
assert.match(orchestrator, /pendingOperations/);
assert.match(orchestrator, /if \(!allowQueued && \(this\.snapshot\.busy \|\| this\.pendingOperations > 0\)\)/);

assert.match(sourcePage, /onOpenTools/);
assert.match(sourcePage, /TextInput\(\{ text: this\.searchQuery/);
assert.match(sourcePage, /filteredSources\(\)/);
assert.match(sourcePage, /source\.group === this\.groupValue/);
assert.match(sourcePage, /Text\('批量管理'\)/);
assert.match(page, /Core 生成 Legado 兼容 JSON/);
assert.match(page, /fullWidthActionButton\('导出全部书源'/,
  'standalone export action must not reuse the row-only layoutWeight button');
assert.match(page, /private fullWidthActionButton[\s\S]*?\.width\('100%'\)[\s\S]*?\.height\(42\)/);
assert.match(page, /onCheckSelected/);
assert.match(page, /onDeleteSelected/);
assert.match(page, /onSelectAll/);
assert.match(page, /onClearSelection/);
assert.match(page, /onToggleSelection/);
assert.match(page, /batchCard\(this\.snapshot\)/);
assert.match(page, /ForEach\(\[this\.snapshot\.statusMessage\]/);
assert.match(page, /source-tools-cards-\$\{renderKey\}/);
assert.match(page, /private batchCard\(snapshot: SourceToolsSnapshot\)/);
assert.match(page, /批量管理（已选 \$\{snapshot\.selectedSourceCount\}\/\$\{snapshot\.sources\.length\}）/);
assert.match(page, /private sourceCard\(snapshot: SourceToolsSnapshot\)/);
assert.match(page, /private smallButton\(label: string, enabled: boolean/);
assert.match(page, /if \(enabled\)[\s\S]*action\(\)/);
assert.doesNotMatch(page, /private takeSelection/);
assert.doesNotMatch(page, /RuleSubscription|规则订阅|subscriptionCard/);
assert.match(sourcePage, /statusKind/);
assert.match(sourcePage, /onRetryLoad/);
assert.match(rulesGateway, /request\('rule-sub\.list', \{\}\)/);
assert.match(rulesGateway, /request\('rule-sub\.put'/);
assert.match(rulesGateway, /request\('rule-sub\.delete'/);
assert.match(rulesPage, /subscriptions/);
assert.match(index, /'sourceTools'/);
assert.match(index, /SourceToolsPage\(/);
assert.match(index, /onSelectAll: \(\): void => this\.selectAllSourceTools\(\)/);
assert.match(index, /onToggleSelection: \(sourceId: string\): void => this\.toggleSourceToolsSelection\(sourceId\)/);
assert.match(index, /private consumeSourceToolsSelection/);
assert.match(index, /getSourceToolsOrchestrator\(\)\.exportAll\(\)/);
assert.match(index, /requestSourceDelete\(sourceIds\)/);
assert.match(index, /getSourceToolsOrchestrator\(\)\.open\(this\.sourceSources\)/);
assert.match(index, /showAlertDialog\([\s\S]*确定删除所选/);

for (const forbidden of [
  'aes-128',
  'retention',
  'jsonPath',
  'css selector',
]) {
  assert.equal(orchestrator.toLowerCase().includes(forbidden), false,
    `SourceToolsOrchestrator must not own Core rule/serialization algorithms: ${forbidden}`);
}

console.log('Source product tools static boundary: PASS');
