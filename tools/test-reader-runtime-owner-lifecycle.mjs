import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { MangaOfflineNetworkProbe } from '../entry/src/main/ets/app/MangaOfflineNetworkProbe.ts';

const owner = readFileSync('entry/src/main/ets/app/ReaderRuntimeOwner.ts', 'utf8');
const ability = readFileSync('entry/src/main/ets/entryability/EntryAbility.ets', 'utf8');

// Execute actual lifecycle methods; adding an optional constructor parameter
// must not invalidate proof of the owner/lease/teardown invariants.
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`);
const tree=ts.createSourceFile('ReaderRuntimeOwner.ts',owner,ts.ScriptTarget.Latest,true);
const type=tree.statements.find(n=>n.name?.getText(tree)==='ReaderRuntimeOwner');
const names=new Set(['install','current','start','release','close','closeRuntime','startAfterPredecessor']);
const members=type.members.filter(n=>ts.isPropertyDeclaration(n)||ts.isConstructorDeclaration(n)||names.has(n.name?.getText(tree)))
  .map(n=>n.getText(tree)).join('\n');
let releasePlatform;const teardown=new Promise(resolve=>releasePlatform=resolve);const events=[];
class PlatformHost {async close(){events.push('host-close');await teardown;}setResponseAssetBridge(){}}
const dependencies={MangaOfflineNetworkProbe,LOG_DOMAIN:0x5244,hilog:{info(){},warn(){}},errorMessageOf:String,
  ReaderStartupTrace:{current:()=>undefined},ReaderHostRegistry:PlatformHost,HarmonyTtsHostRouter:PlatformHost,
  HarmonySystemTtsHost:PlatformHost,HarmonyHttpTtsHost:PlatformHost,HarmonyTtsMediaSession:PlatformHost,
  HarmonyTtsBackgroundSession:PlatformHost,LocalEpubResourceHost:PlatformHost,ReadingImageDiskCache:class{close(){}},
  ReadingBodyImageHost:{setDisplayCacheDir(){},instance:{setMangaMetadataInspector(){},releaseAllDisplayFiles(){events.push('display-release');}}}};
const Runtime=new Function(...Object.keys(dependencies),stripTypeScriptTypes(`class ReaderRuntimeOwner {${members}}`)+
  ';return ReaderRuntimeOwner;')(...Object.values(dependencies));
Runtime.prototype.startRuntime=async function(){events.push(this===first?'first-start':'successor-start');this.state='ready';
  this.runtime={async request(){events.push('flush');return{};},close(){events.push('core-close');}};};
const context={cacheDir:'/unused-context'},first=Runtime.install(context);
assert.equal(Runtime.install(context),first,'overlapping abilities share a live owner');
await first.start();await first.release();assert.equal(first.state,'ready');assert.equal(events.includes('host-close'),false,
  'releasing one of two leases must not close the runtime');
const closing=first.release();assert.equal(first.state,'closing');
const scope={sourceId:'fixture-source',bookId:'fixture-book'},successor=Runtime.install(context,false,scope);
assert.notEqual(successor,first,'a closing owner is replaced even with a diagnostic scope');
assert.equal(successor.mangaOfflineProbe.ownsCommand('book.toc',scope),true,'the optional fourth constructor argument is preserved');
let started=false;const starting=successor.start().then(()=>{started=true;});
await new Promise(resolve=>setImmediate(resolve));assert.equal(started,false);assert.equal(events.includes('successor-start'),false,
  'successor platform startup waits for real predecessor teardown');
releasePlatform();await closing;assert.equal(Runtime.current(),successor,'old close completion cannot erase the new singleton');
await starting;assert.equal(started,true);assert.ok(events.indexOf('core-close')<events.indexOf('successor-start'));
await successor.release();assert.equal(successor.state,'closed');assert.throws(()=>Runtime.current(),/must be installed/);
const third=Runtime.install(context);assert.notEqual(third,successor);assert.equal(third.mangaOfflineProbe,undefined,
  'normal fresh install never retains the previous diagnostic scope');
await third.release();
console.log('PASS actual owner lifecycle: shared leases, deferred predecessor teardown, fresh successor scope, old-close singleton fencing and normal scope reset');
assert.match(owner, /abilityLeases \+= 1/);
assert.match(owner, /async release\(\): Promise<void>[\s\S]*abilityLeases -= 1[\s\S]*await this\.close\(\)/,
  'overlapping Ability instances must release a shared runtime only after the final lease');
assert.match(owner, /await this\.predecessorClose[\s\S]*await this\.startRuntime\(\)/,
  'a successor must wait for predecessor Host teardown before starting');
assert.match(owner, /ReaderRuntimeOwner\.instance === this[\s\S]*ReaderRuntimeOwner\.instance = undefined/,
  'an old close completion must not erase a newer singleton');
assert.match(ability, /private runtimeOwner: ReaderRuntimeOwner \| undefined/);
assert.match(ability, /this\.runtimeOwner = owner/);
assert.match(ability, /const owner = this\.runtimeOwner;[\s\S]*owner\?\.release\(\)/,
  'each Ability must release the exact owner it acquired');
assert.doesNotMatch(ability, /ReaderRuntimeOwner\.current\(\)\.close\(\)/,
  'an old Ability must never close whichever singleton happens to be current');

console.log('ReaderRuntimeOwner Ability lease lifecycle: PASS');
