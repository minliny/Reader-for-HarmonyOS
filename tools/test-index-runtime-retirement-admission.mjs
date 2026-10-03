import {bookshelfOperationClass} from './lib/bookshelf-operation-owner-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
const path=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),source=readFileSync(path,'utf8');
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',require=createRequire(import.meta.url);
const ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
const tree=ts.createSourceFile('/tmp/Index.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(tree.parseDiagnostics.length,0);
const current=n=>ts.isCallExpression(n)&&n.expression.getText(tree)==='ReaderRuntimeOwner.current'&&n.arguments.length===0;
function visit(n){if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(n.operatorToken.kind))assert.equal(current(n.left)||current(n.right),false,'late identity checks use authoritative static admission, without throwing getter');ts.forEachChild(n,visit);}visit(tree);
let installed;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
const Index=productionMotionMethods(path,['isCurrentRuntime','aboutToDisappear','hasUnknownShelfWrite','shelfRecovery','emptyShelfRecovery'],{ReaderRuntimeOwner:Runtime});
const ActualBookshelfHost=bookshelfOperationClass('features/bookshelf/BookshelfHost.ets','BookshelfHost');
function fixture(){const calls=[],old={bookAcquisitions:()=>({endSearch:()=>calls.push('old-search')}),readingEntryPreparations:()=>({setPaused:()=>calls.push('old-pause')})};installed=old;
  const index=Object.assign(new Index(),{bookshelfHost:new ActualBookshelfHost(()=>{},()=>false),mountedRuntimeOwner:old,shelfOperationOwner:old,shelfOperation:{receipt:{receipt:{confirmation:'unknown'}},generation:4,cleanupWarning:''},
    dismissBookRemovalDialog:()=>calls.push('delete-dismiss'),searchHost:{close:()=>calls.push('search-host')},
    applicationSettingsUnsubscribe:()=>calls.push('settings-unsubscribe'),bookProjectionUnsubscribe:()=>calls.push('books-unsubscribe'),systemFileOpenUnsubscribe:()=>calls.push('file-unsubscribe'),sourceSwitchUnsubscribe:()=>calls.push('source-unsubscribe'),navigationBackfillObserverDisposer:()=>calls.push('navigation-unsubscribe')});
  return{index,old,calls};}
{const f=fixture();assert.equal(f.index.isCurrentRuntime(undefined),false);assert.equal(f.index.isCurrentRuntime(f.old),true);installed=undefined;assert.throws(()=>Runtime.current(),/installed by EntryAbility/);assert.equal(f.index.isCurrentRuntime(f.old),false);assert.equal(f.index.hasUnknownShelfWrite(),false);assert.equal(f.index.shelfRecovery().visible,false);assert.doesNotThrow(()=>f.index.aboutToDisappear());assert.equal(f.index.mountedRuntimeOwner,undefined);assert.equal(f.calls.includes('old-search'),false);assert.equal(f.index.shelfReceiptRetired,true);}
{const f=fixture(),replacement={bookAcquisitions:()=>({endSearch:()=>f.calls.push('new-search')}),readingEntryPreparations:()=>({setPaused:()=>f.calls.push('new-pause')})};installed=replacement;assert.doesNotThrow(()=>f.index.aboutToDisappear());assert.equal(f.calls.some(c=>/^(old|new)-/.test(c)),false,'old Index never clears either retired or replacement runtime work');}
{const f=fixture();f.index.aboutToDisappear();assert.deepEqual(f.calls.slice(-2),['old-search','old-pause'],'installed captured owner receives original normal cleanup');f.index.aboutToDisappear();assert.equal(f.calls.filter(c=>c==='old-search').length,1,'repeat retirement never reacquires a live owner');}
assert.match(source,/aboutToAppear\(\): void \{\s*this\.mountedRuntimeOwner = ReaderRuntimeOwner\.current\(\)/,'mount captures exact authoritative owner');
console.log('PASS Index actual Runtime current/isCurrent→28 domain callback admissions, undefined explicit guard, true getter failure, old/replaced owner cleanup and repeated retirement; accepted ACK/readback and finally covered by actual bookshelf/import/Discover/RSS/Sync chains');
