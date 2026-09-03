import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const gateway = read('entry/src/main/ets/features/settings/RulesManagementGateway.ts');
const orchestrator = read('entry/src/main/ets/features/settings/RulesManagementOrchestrator.ets');
const page = read('entry/src/main/ets/features/settings/RulesManagementPage.ets');
const rssGateway = read('entry/src/main/ets/features/rss/RssGateway.ts');
const settings = read('entry/src/main/ets/features/settings/SettingsPage.ets');
const index = read('entry/src/main/ets/pages/Index.ets');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');

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
assert.match(orchestrator, /new SourceGateway\(owner\)/,
  'book-source subscriptions must reuse the source gateway');
assert.match(orchestrator, /new RssGateway\(owner\)/,
  'RSS subscriptions must reuse the RSS gateway');
assert.match(orchestrator, /loadOnlineJsonDocument\(subscription\.url\)/,
  'manual subscription refresh must use the shared Host JSON transport');
assert.match(orchestrator, /subscription\.type === 0[\s\S]*importBookSourceDocument/);
assert.match(orchestrator, /subscription\.type === 1[\s\S]*importSourcesDocument/);
assert.match(orchestrator, /importReplaceRuleDocument\(document\.text\)/);
assert.match(orchestrator, /update: Date\.now\(\)/,
  'successful manual refresh must persist the last-update timestamp');
assert.match(rssGateway, /async importSourcesDocument\([\s\S]*request\('rss-source\.import'/,
  'already-acquired RSS JSON must reuse the existing Core import command');
assert.match(gateway, /type: draft\.type/,
  'rule-sub.put must preserve the selected Legado subscription type');
assert.match(gateway, /update,/,
  'rule-sub.put must preserve the stored update timestamp');
assert.match(gateway, /async importReplaceRuleDocument\(json: string\)/);
assert.match(gateway, /"schemaVersion":1,"replaceRules":\$\{rulesJson\}/,
  'replace subscriptions must only adapt the outer envelope for Core validation');
assert.match(page, /TXT 目录规则/);
assert.match(page, /字典规则/);
assert.match(page, /可携带规则包/);
assert.match(page, /onRefreshSubscription/);
assert.match(page, /自动更新仅保存标记，不启动后台调度/);
assert.match(page, /this\.actionButton\('书源', this\.subType === 0/);
assert.match(page, /this\.actionButton\('RSS 源', this\.subType === 1/);
assert.match(page, /this\.actionButton\('替换规则', this\.subType === 2/);
assert.doesNotMatch(settings, /this\.navRow\('规则实体管理'/,
  'the final five-row Settings Home must not grow an undesigned rules entry');
assert.match(experience, /this\.onOpenRulesManagement\(\)/,
  'rules management remains reachable from the designed reader replacement flow');
assert.match(index, /route === 'rulesManagement'/);
assert.match(index, /RulesManagementPage\(/);
assert.match(index, /refreshRuleSubscription\(subscription\)/);
assert.match(host, /selectBoundedJsonDocument\('Reader 规则包 JSON'\)/);
assert.match(host, /saveBoundedJsonDocument\(text, suggestedFileName, 'Reader 规则包 JSON'/);

assert.doesNotMatch(gateway, /JSON\.parse|JSON\.stringify/,
  'portable bundle schema and serialization must stay in Rust Core');

console.log('rule entity management Core ownership contract: PASS');
