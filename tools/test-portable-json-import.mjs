import assert from 'node:assert/strict';
import fs from 'node:fs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

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
assert.match(host, /HttpExecuteHost\.instance\.executeBounded\(\{[\s\S]*?ReaderHostRegistry\.JsonDocumentLimitBytes\)/,
  'online JSON must pass its document budget into native transport');
assert.match(host, /HttpExecuteHost\.instance\.executeBounded\(\{[\s\S]*method: 'GET'/);
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

assert.match(rssOrchestrator, /gateway\.importSources\(replaceExisting, onlineUrl,/);
assert.match(dialog, /选择本地 JSON 文件/);
assert.match(dialog, /从在线链接导入/);
assert.match(dialog, /ReaderFormField\(\{[\s\S]*?specId: 'form-url'[\s\S]*?onSubmit: \(\): void => this\.submitOnlineImport\(\)/);
// The native keyboard action is now owned by the actual public field, while
// the original dialog still validates/reads its current controlled URL draft.
{
 const controls=foundationControls(),{owner:surface}=createReaderBuilderProbe(dialog,
  ['urlDraft','validationMessage','formBody','localButton','submitOnlineImport'],controls.dependencies,controls.hooks),online=[];
 Object.assign(surface,{appThemeScheme:'day',description:'说明',onImportOnline:url=>online.push(url),onSelectLocal(){}});surface.formBody();
 const field=[...surface.children.values()].find(c=>c instanceof controls.field.Component&&c.specId==='form-url');assert.ok(field,'actual public URL field, not an empty replacement');
 const input=controls.nodes(field).find(n=>n.type==='TextInput');assert.equal(typeof input.onSubmit,'function');
 input.onChange('  https://example.test/current.json  ');input.onSubmit('EnterKeyType.Done');assert.deepEqual(online,['https://example.test/current.json']);
 input.onChange('   ');input.onSubmit('EnterKeyType.Done');assert.equal(online.length,1);assert.equal(surface.validationMessage,'请输入在线 JSON 的 HTTP/HTTPS 地址');
 input.onChange('https://example.test/next.json');assert.equal(surface.validationMessage,'');input.onSubmit('EnterKeyType.Done');assert.deepEqual(online,['https://example.test/current.json','https://example.test/next.json']);
 field.aboutToDisappear();input.onSubmit('EnterKeyType.Done');assert.equal(online.length,2,'removed actual field rejects late keyboard submission');
}
assert.match(dialog, /GitHub 仓库文件请使用 Raw 链接/);
assert.match(dialog, /请输入在线 JSON 的 HTTP\/HTTPS 地址/);
assert.match(dialog, /validationMessage/);
assert.match(index, /openJsonImport\('bookSource'\)/);
assert.match(index, /openJsonImport\('ruleBundle'\)/);
assert.match(index, /openJsonImport\('rssMerge'\)/);
assert.match(index, /openJsonImport\('rssReplace'\)/);
assert.match(index, /private executeJsonImport\(context: JsonImportContext, onlineUrl\?: string,\s*rules: RulesManagementOrchestrator \| undefined = this\.rulesManagementOrchestrator, identity: string = this\.rulesPresentationIdentity,\s*source: SourceHost = this\.sourceHost, sourceIdentity: string = this\.sourcePresentationIdentity\)/);
assert.match(index, /rules\.isPresentationCurrent\(identity\)\)\s*rules\.importBundle\(onlineUrl, identity\)/,
  'portable rules import retains its captured original presentation at actual owner admission');

console.log('portable JSON local/online import boundary: PASS');
