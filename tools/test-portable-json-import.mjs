import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const httpHost = read('entry/src/main/ets/app/HttpExecuteHost.ts');
const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const dialog = read('entry/src/main/ets/features/common/JsonImportDialog.ets');
const source = read('entry/src/main/ets/features/source/SourceOrchestrator.ets');
const rules = read('entry/src/main/ets/features/settings/RulesManagementOrchestrator.ets');
const rssGateway = read('entry/src/main/ets/features/rss/RssGateway.ts');
const rssOrchestrator = read('entry/src/main/ets/features/rss/RssOrchestrator.ets');
const index = read('entry/src/main/ets/pages/Index.ets');

// One Host transport for every portable JSON feature; no feature-local HTTP stack.
assert.match(host, /async loadOnlineJsonDocument\(onlineUrl: string\)/);
assert.match(host, /HttpExecuteHost\.instance\.execute\(\{[\s\S]*method: 'GET'/);
assert.match(host, /followRedirects: true/);
assert.match(host, /maxRedirects: 10/);
assert.match(host, /JsonDocumentLimitBytes = 16 \* 1024 \* 1024/);
assert.match(host, /在线地址返回网页而不是 JSON；GitHub 仓库文件请使用 Raw 链接/);
assert.match(httpHost, /url must use http or https/);
assert.match(owner, /return this\.host\.loadOnlineJsonDocument\(onlineUrl\)/);

for (const feature of [source, rules, rssGateway]) {
  assert.match(feature, /select[A-Za-z]+Json\(\)[\s\S]*loadOnlineJsonDocument\(onlineUrl\)/);
  assert.doesNotMatch(feature, /@ohos\.net\.http|HttpExecuteHost/,
    'feature import logic must not duplicate Host HTTP transport');
}

assert.match(rssOrchestrator, /gateway\.importSources\(replaceExisting, onlineUrl\)/);
assert.match(dialog, /选择本地 JSON 文件/);
assert.match(dialog, /从在线链接导入/);
assert.match(dialog, /onSubmit\([\s\S]*submitOnlineImport\(\)/);
assert.match(dialog, /GitHub 仓库文件请使用 Raw 链接/);
assert.match(dialog, /请输入在线 JSON 的 HTTP\/HTTPS 地址/);
assert.match(dialog, /validationMessage/);
assert.match(index, /openJsonImport\('bookSource'\)/);
assert.match(index, /openJsonImport\('ruleBundle'\)/);
assert.match(index, /openJsonImport\('rssMerge'\)/);
assert.match(index, /openJsonImport\('rssReplace'\)/);
assert.match(index, /private executeJsonImport\(context: JsonImportContext, onlineUrl\?: string\)/);

console.log('portable JSON local/online import boundary: PASS');
