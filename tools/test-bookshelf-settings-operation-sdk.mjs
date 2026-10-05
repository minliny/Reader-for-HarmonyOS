import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,defaults,settle} from './lib/general-settings-persistence-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {readerRecoveryView} from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
const read=path=>readFileSync(new URL('../entry/src/main/ets/'+path,import.meta.url),'utf8');
const pageSource=read('features/bookshelf/BookshelfSettingsPage.ets');
const leafNames=['autoCheckUpdate','onAutoCheckUpdate','operation','navigationGeneration','presentationRevision','mounted','onRetryAccepted','onReconcile',
 'settingsRecovery','settingsRecoveryIdentity','settingsRecoveryCurrent','retrySettingsRecovery'];
function build(f) {
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});sdk.childSources.BookshelfSettingsPage=pageSource;
 const Leaf=sdk.consumer(pageSource,leafNames,{readerRecoveryView}).constructor;
 const idx=sdk.consumer(read('pages/Index.ets'),['settingsSnapshot','settingsOperation','navigationGeneration','bookshelfSettingsContent','bookshelfSettingsSurface','bindSettingsPresentation','retireSettingsPresentation','isCurrentSettingsPresentation','isCurrentRuntime'],
   {BookshelfSettingsPage:Leaf,ReaderRuntimeOwner:f.Runtime});
 Object.assign(idx,{route:'bookshelfSettings',navigationGeneration:1,mountedRuntimeOwner:f.runtime,detailShelfAdmissionMount:1,shelfReceiptRetired:false,
  rssInstanceIdentity:1,settingsPresentationIdentity:'',settingsSnapshot:{...defaults},settingsOperation:{action:'load'}});
 const host=new f.Host(snapshot=>idx.settingsSnapshot=snapshot,()=>idx.settingsSnapshot,()=>idx.route==='bookshelfSettings'&&!idx.shelfReceiptRetired,
   ()=>f.runtime.getUIAbilityContext(),operation=>idx.settingsOperation=operation);idx.settingsHost=host;
 assert.equal(idx.bindSettingsPresentation(),true);idx.bookshelfSettingsContent();const page=[...idx.children.values()].find(child=>child instanceof Leaf);
 Object.assign(page,{mounted:true,presentationRevision:1,appThemeScheme:'day'});page.settingsRecovery();
 const result={idx,page,sdk,host};
 const native=label=>{const actor=sdk.walk(result.page).filter(child=>child instanceof sdk.deps.ReaderRecoveryAction&&child.label===label).at(-1);assert.ok(actor,label);return [...actor.nodes.values()].find(node=>node.onClick).onClick;};
 return {...result,get page(){return result.page;},set page(value){result.page=value;},native};
}
let cases=0;
for(const failure of ['before','after']) {
 const f=fixture(),x=build(f);x.host.open(x.idx.settingsPresentationIdentity);await settle();x.sdk.properties.flush();
 f.fail(failure);x.page.onAutoCheckUpdate(false);await settle();x.sdk.properties.flush();
 assert.equal(x.idx.settingsSnapshot.autoCheckUpdate,false,'accepted current UI choice survives lost ACK');
 assert.equal(x.idx.settingsOperation.receipt.receipt.confirmation,'unknown');
 assert.equal(x.page.operation.receipt.receipt.confirmation,'unknown','actual Index @State -> SDK @Prop carries original receipt');
 const originalGeneration=x.page.operation.receipt.facts.generation;
 const oldGesture=x.native('重试保存当前设置');const puts=f.events.filter(event=>event[0]==='put').length;
 x.page.onReconcile(originalGeneration,1);await settle();x.sdk.properties.flush();
 assert.equal(f.events.filter(event=>event[0]==='put').length,puts,'ordinary retry is pure read');
 assert.equal(x.page.operation.receipt.receipt.confirmation,'unknown');
 x.idx.retireSettingsPresentation();x.idx.navigationGeneration++;assert.equal(x.idx.bindSettingsPresentation(),true);x.sdk.properties.flush();
 assert.equal([...x.idx.children.values()].filter(child=>child===x.page).length,1,'actual V1 Page identity is retained');
 const priorPage=x.page;x.page=[...x.idx.children.values()].filter(c=>c instanceof priorPage.constructor).at(-1);
 Object.assign(x.page,{mounted:true,presentationRevision:1,appThemeScheme:'day'});x.page.settingsRecovery();
 assert.notEqual(x.page,priorPage,'new navigation gets a newly captured temporary settings consumer');
 assert.equal(priorPage.navigationGeneration,1,'old physical page identity is not promoted');
 assert.equal(x.page.navigationGeneration,2);oldGesture();await settle();
 assert.equal(f.events.filter(event=>event[0]==='put').length,puts,'old physical token cannot borrow new navigation');
 const current=x.native('重试保存当前设置');current();current();await settle();
 // The probe executes real V1 props, but does not model native branch removal.
 // Replay only the real parent observer so the existing Page receives terminal Props.
 x.idx.replayOnly([x.page.id]);
 assert.equal(f.events.filter(event=>event[0]==='put').length,puts+4,'current explicit retry uses exactly one complete accepted snapshot setter');
 assert.equal(x.page.operation.receipt.receipt.confirmation,'confirmed');
 assert.equal(x.page.operation.canRetryAccepted,false);assert.equal(Object.fromEntries(f.disk).autoCheckUpdate,false);cases++;
}
{
 const f=fixture(),x=build(f);x.host.open(x.idx.settingsPresentationIdentity);await settle();f.fail('after');x.page.onAutoCheckUpdate(false);await settle();x.sdk.properties.flush();
 const old=x.native('重试保存当前设置'),puts=f.events.filter(e=>e[0]==='put').length;
 x.page.mounted=false;old();await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts);
 x.page.mounted=true;x.page.presentationRevision++;x.sdk.properties.flush();old();await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts,'same instance remount has a new physical generation');
 f.retire();x.native('重试保存当前设置')();await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts,'Runtime teardown cannot upgrade a page action');cases++;
}
console.log(`Bookshelf settings actual Preferences -> Host -> Index -> SDK Page/Notice/Action: PASS (${cases} groups; unknown, pure read, finite accepted retry, retained Props/nav, physical retirement, exact Runtime).`);
