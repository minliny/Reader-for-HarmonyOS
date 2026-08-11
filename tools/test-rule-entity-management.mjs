import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const gateway = read('entry/src/main/ets/features/settings/RulesManagementGateway.ts');
const orchestrator = read('entry/src/main/ets/features/settings/RulesManagementOrchestrator.ets');
const page = read('entry/src/main/ets/features/settings/RulesManagementPage.ets');
const settings = read('entry/src/main/ets/features/settings/SettingsPage.ets');
const index = read('entry/src/main/ets/pages/Index.ets');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');

for (const method of [
  'replace-rule.list', 'replace.validate', 'replace.persist',
  'txt-toc-rule.list', 'txt-toc-rule.create', 'txt-toc-rule.update', 'txt-toc-rule.delete',
  'dict-rule.list', 'dict-rule.put', 'dict-rule.delete',
  'rule-sub.list', 'rule-sub.put', 'rule-sub.delete',
  'rule-bundle.export', 'rule-bundle.import',
]) {
  assert.ok(gateway.includes(`request('${method}'`), `rules gateway must use ${method}`);
}

assert.match(orchestrator, /private operationTail: Promise<void>/,
  'mutating Core commands must remain serialized at the page coordinator');
assert.match(orchestrator, /selectRuleBundleJson\(\)/);
assert.match(orchestrator, /saveRuleBundleJson\(/);
assert.match(page, /TXT 目录规则/);
assert.match(page, /字典规则/);
assert.match(page, /可携带规则包/);
assert.match(settings, /规则实体管理/);
assert.match(index, /route === 'rulesManagement'/);
assert.match(index, /RulesManagementPage\(/);
assert.match(host, /selectBoundedJsonDocument\('Reader 规则包 JSON'\)/);
assert.match(host, /saveBoundedJsonDocument\(text, suggestedFileName, 'Reader 规则包 JSON'/);

assert.doesNotMatch(gateway, /JSON\.parse|JSON\.stringify/,
  'portable bundle schema and serialization must stay in Rust Core');

console.log('rule entity management Core ownership contract: PASS');
