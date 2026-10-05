import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

import {
  READER_PRODUCT_PROFILE,
  isReaderMainTabEnabled,
  isReaderProductSurfaceEnabled,
} from '../entry/src/main/ets/app/ReaderProductScope.ts';

assert.equal(READER_PRODUCT_PROFILE, 'l0');
assert.equal(isReaderMainTabEnabled('bookshelf'), true);
assert.equal(isReaderMainTabEnabled('settings'), true);
assert.equal(isReaderMainTabEnabled('discover'), false);
assert.equal(isReaderMainTabEnabled('rss'), false);
assert.equal(isReaderMainTabEnabled('unknown'), false);

for (const surface of ['discover', 'rss', 'sync', 'unimplementedSettings']) {
  assert.equal(isReaderProductSurfaceEnabled(surface), false,
    `${surface} must remain outside the default L0 product surface`);
}

const root = new URL('../entry/src/main/ets/', import.meta.url);
const mainTabs = await readFile(new URL('features/shell/MainTabBar.ets', root), 'utf8');
const bookshelf = await readFile(new URL('features/bookshelf/BookshelfPage.ets', root), 'utf8');
const settings = await readFile(new URL('features/settings/SettingsPage.ets', root), 'utf8');
const index = await readFile(new URL('pages/Index.ets', root), 'utf8');

assert.match(mainTabs, /ALL_MAIN_TABS\.filter\([\s\S]*isReaderMainTabEnabled\(tab\.key\)/,
  'shared Phone/Tablet navigation must derive from the admitted product scope');
assert.match(bookshelf,
  /if \(isReaderProductSurfaceEnabled\('discover'\)\)[\s\S]*tabletNavigationItem\('bookshelf_compass'/,
  'the private bookshelf Tablet rail must gate Discover');
assert.match(bookshelf,
  /if \(isReaderProductSurfaceEnabled\('rss'\)\)[\s\S]*tabletNavigationItem\('bookshelf_rss'/,
  'the private bookshelf Tablet rail must gate RSS');

for (const [method, surface] of [['openRss', 'rss'], ['openDiscover', 'discover'], ['openSync', 'sync']]) {
  const guard = new RegExp(`private ${method}\\(\\): void \\{\\s*if \\(\\!isReaderProductSurfaceEnabled\\('${surface}'\\)\\) \\{\\s*return;`);
  assert.match(index, guard, `${method} must reject an unadmitted route before mutating navigation state`);
}

assert.match(settings,
  /if \(isReaderProductSurfaceEnabled\('sync'\)\) \{[\s\S]*this\.navRow\('同步与备份'/,
  'Settings must not expose Sync outside its admitted product profile');
assert.match(settings,
  /if \(isReaderProductSurfaceEnabled\('unimplementedSettings'\)\) \{[\s\S]*this\.navRow\('关于与反馈'/,
  'empty Settings destinations must remain outside L0');
assert.match(settings, /this\.navRow\('书架设置'[\s\S]*?this\.onOpenBookshelfSettings\)/, 'implemented shelf settings has a real destination');

const generalBuilder = settings.match(/private buildGeneral\(\) \{([\s\S]*?)\n  \}\n\n  @Builder/);
assert.ok(generalBuilder);
assert.match(generalBuilder[1], /isReaderProductSurfaceEnabled\('unimplementedSettings'\)/,
  'local-only preference, permission, and reset surfaces must be gated');

console.log('reader product scope contract: PASS');

// Execute direct/recovery entry points with the real shipping profile. An empty
// receiver makes any state access or I/O before admission fail deterministically.
const loader=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(loader+'/node_modules/typescript');
const ast=ts.createSourceFile('Index.ets',index,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(loader+'/lib/ets_checker.js').compilerOptions);
assert.deepEqual(ast.parseDiagnostics,[]);
const indexClass=ast.statements.find(node=>node.name?.text==='Index');assert.ok(indexClass);
const guarded=indexClass.members.filter(member=>{
  const first=member.body?.statements[0],condition=first?.expression;
  return first&&ts.isIfStatement(first)&&condition&&ts.isPrefixUnaryExpression(condition)&&
    condition.operator===ts.SyntaxKind.ExclamationToken&&ts.isCallExpression(condition.operand)&&
    condition.operand.expression.getText(ast)==='isReaderProductSurfaceEnabled';
}).map(member=>member.name.getText(ast));
// Preserve each of the original 38 direct/recovery entry contracts. Two now
// consume the real captured host guard rather than a duplicated first-line
// product check; they are executed below in both closed and admitted profiles.
const originalEntries=['openRss','openDiscover','onSyncSaveConfig','onSyncTestConnection','onSyncTriggerBackup',
  'onSyncRestoreLatest','onSyncResolveRestore','openSync','refreshRss','onRssManage','onRssManagementViewArticles',
  'onRssSubscriptionSelected','onRssSubscriptionAddRequested','onRssSubscriptionEditRequested','finishRssSubscriptionEdit',
  'returnToRssSubscriptionManagement','requestRssSubscriptionDelete','requestRssSourceImport','importRssSources',
  'exportRssSources','showRssOperationResult','confirmRssSubscriptionDelete','loadRssSourceItems','refreshRssSourceFeed',
  'applyRssSourceSnapshot','onRssItemSelected','onRssSourceItemSelected','openRssEntryDetail','onRssEntryFavoriteRequested',
  'applyRssEntrySnapshot','failRssEntryOperation','returnFromRssEntryDetail','returnToRssSourceFeed','returnFromRssSourceFeed',
  'returnToRss','openRssManagementForSubscription','onRssOpenOriginalRequested','onRssModeRequested'];
const delegated=['importRssSources','confirmRssSubscriptionDelete'];
assert.equal(new Set(originalEntries).size,38);
for(const name of originalEntries){
  assert.ok(indexClass.members.some(member=>member.name?.getText(ast)===name),'original entry remains represented: '+name);
  assert.ok(guarded.includes(name)||delegated.includes(name),'original entry must have an executed admission proof: '+name);
}
const Closed = productionMotionMethods(new URL('pages/Index.ets', root), guarded, {
  isReaderProductSurfaceEnabled,
});
for (const method of guarded) {
  const receiver = Object.create(null);
  await Closed.prototype[method].call(receiver);
  assert.deepEqual(Object.keys(receiver), [], `${method} cannot mutate a closed surface`);
}
{
  const runtime={},calls=[];
  const host={owns:owner=>owner===runtime,isPresentationCurrent:id=>id==='rss:1',
    importSources:(...args)=>calls.push(['import',...args]),removeSubscription:id=>calls.push(['delete',id])};
  const names=[...delegated,'isCurrentRssHostPresentation','isCurrentRssPresentation','isCurrentRoute','rssSubscriptions'];
  const dependencies={ReaderRuntimeOwner:{isCurrent:owner=>owner===runtime}};
  const create=profile=>Object.assign(new (productionMotionMethods(new URL('pages/Index.ets',root),names,
    {...dependencies,isReaderProductSurfaceEnabled:profile}))(),{
      rssOrchestrator:host,mountedRuntimeOwner:runtime,detailShelfAdmissionMount:1,navigationGeneration:3,
      rssPresentationIdentity:'rss:1',shelfReceiptRetired:false,route:'rssSubscriptionManagement',
      rssPresentation:{kind:'feed',subscriptions:[{subscriptionId:'subscription'}],recentUnread:[]}});
  const closed=create(isReaderProductSurfaceEnabled),before=structuredClone(closed.rssPresentation);
  closed.importRssSources(false,'https://original.invalid/rss.json');closed.confirmRssSubscriptionDelete('subscription');
  assert.deepEqual(calls,[],'captured real host guard rejects both original entries in the shipping profile');
  assert.deepEqual(closed.rssPresentation,before,'closed delegated entry cannot publish a new state');
  const admitted=create(surface=>surface==='rss');
  admitted.importRssSources(false,'https://original.invalid/rss.json');admitted.confirmRssSubscriptionDelete('subscription');
  assert.deepEqual(calls.map(call=>call[0]),['import','delete'],'the same actual methods remain callable when the explicit profile is admitted');
  calls.length=0;admitted.rssPresentationIdentity='successor';
  admitted.importRssSources(false,undefined,host,'rss:1');admitted.confirmRssSubscriptionDelete('subscription',3,runtime,1,host,'rss:1');
  assert.deepEqual(calls,[],'old captured identity cannot borrow an admitted successor visit');
}
for (const route of ['rss', 'rssSubscriptionManagement', 'rssSubscriptionEditor', 'rssSourceFeed',
  'rssEntryDetail', 'discover', 'sync']) {
  const surface = route.startsWith('rss') ? 'rss' : route;
  assert.ok(index.includes(`isReaderProductSurfaceEnabled('${surface}') && this.route === '${route}'`),
    `${route} must reject restored/direct route rendering`);
}
// Development flow remains callable when its explicit scope is admitted.
const Open = productionMotionMethods(new URL('pages/Index.ets', root), ['onSyncTriggerBackup'], {
  isReaderProductSurfaceEnabled: surface => surface === 'sync',
});
let backups = 0;
Open.prototype.onSyncTriggerBackup.call({ getSyncOrchestrator: () => ({ triggerBackup: () => backups++ }) });
assert.equal(backups, 1);
console.log(`reader product scope direct/recovery boundary: all 38 original entries plus ${guarded.filter(name=>!originalEntries.includes(name)).length} new direct entries PASS; real delegated host/profile/identity guards executed`);
