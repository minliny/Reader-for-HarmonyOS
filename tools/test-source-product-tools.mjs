import assert from 'node:assert/strict';
import fs from 'node:fs';

const gateway = fs.readFileSync('entry/src/main/ets/features/source/SourceGateway.ts', 'utf8');
const orchestrator = fs.readFileSync('entry/src/main/ets/features/source/SourceToolsOrchestrator.ets', 'utf8');
const page = fs.readFileSync('entry/src/main/ets/features/source/SourceToolsPage.ets', 'utf8');
const sourcePage = fs.readFileSync('entry/src/main/ets/features/source/SourceManagementPage.ets', 'utf8');
const host = fs.readFileSync('entry/src/main/ets/app/ReaderHostRegistry.ts', 'utf8');
const owner = fs.readFileSync('entry/src/main/ets/app/ReaderRuntimeOwner.ts', 'utf8');
const index = fs.readFileSync('entry/src/main/ets/pages/Index.ets', 'utf8');

assert.match(gateway, /request\('source\.export', params\)/);
assert.match(gateway, /request\('source\.debug',[\s\S]*responses: \{\}/);
assert.match(gateway, /checkSource\([\s\S]*source\.check\.run/);
assert.match(gateway, /request\('rule-sub\.list', \{\}\)/);
assert.match(gateway, /request\('rule-sub\.put'/);
assert.match(gateway, /request\('rule-sub\.delete'/);
assert.match(gateway, /editedId !== sourceId[\s\S]*不允许隐式迁移 bookSourceUrl/);
assert.match(gateway, /source\.export count does not match its JSON array/);

assert.match(host, /new picker\.DocumentViewPicker\(this\.context\)\.save\(options\)/);
assert.match(host, /BookSourceDocumentLimitBytes/);
assert.match(host, /fileIo\.OpenMode\.TRUNC/);
assert.match(host, /while \(writtenBytes < bytes\.byteLength\)/);
assert.match(host, /await fileIo\.fsync\(file\.fd\)/);
assert.match(owner, /return this\.host\.saveBookSourceJson\(text, suggestedFileName\)/);

assert.match(orchestrator, /gateway\.exportBookSources\(\)/);
assert.match(orchestrator, /owner\.saveBookSourceJson/);
assert.match(orchestrator, /gateway\.saveEditableSource/);
assert.match(orchestrator, /gateway\.checkSource[\s\S]*gateway\.debugSource/);
assert.match(orchestrator, /gateway\.putRuleSubscription/);
assert.match(orchestrator, /gateway\.deleteRuleSubscription/);

assert.match(sourcePage, /onOpenTools/);
assert.match(page, /Core 生成 Legado 兼容 JSON/);
assert.match(page, /本批只接入 Core 规则订阅实体 CRUD/);
assert.match(index, /'sourceTools'/);
assert.match(index, /SourceToolsPage\(/);
assert.match(index, /getSourceToolsOrchestrator\(\)\.exportAll\(\)/);

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
