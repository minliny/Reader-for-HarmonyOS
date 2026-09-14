import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { ReaderContentSearchPublication } from '../entry/src/main/ets/features/reading/ReaderContentSearchPublication.ts';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts';
import * as scroll from '../entry/src/main/ets/features/reading/ReaderControlSearchScroll.ts';
import { searchListDependencies, searchListMethods } from './lib/reader-content-search-list-probe.mjs';

const require=createRequire(import.meta.url);
const sdkRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdkRoot}/node_modules/typescript`),syntax=require(`${sdkRoot}/lib/validate_ui_syntax.js`);
const options=require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
const read=name=>readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`,import.meta.url),'utf8');
const parse=source=>ts.createSourceFile('/tmp/ReaderSearchPublication.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const member=(source,name)=>{const tree=parse(source);const type=tree.statements.find(node=>node.members?.some(item=>item.name?.getText(tree)===name));
  const node=type.members.find(node=>node.name?.getText(tree)===name);assert.ok(node,name);return node.getText(tree);};
function register(name,source){const tree=parse(source),type=tree.statements.find(node=>node.members?.some(item=>item.name?.getText(tree)==='build'));
  syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set(type.members.filter(node=>node.getText(tree).includes('@Prop'))
    .map(node=>node.name?.getText(tree)).filter(Boolean)));}
const runtime=createArkUIPropertyRuntimeProbe(),contentSource=read('ReaderControlSearchContent'),panelSource=read('ReaderControlPanel'),lreSource=read('LocalReadingExperience');
const methods=['searchPublication','searchRevision','state','acceptedSearchState','acceptSearchPublication',
  'resultDataSource','resultNativeFollowTimer','resultNativeFollowLifecycle','resultNativeRawBase',
  ...searchListMethods,'currentResultIndex','currentResult','indexedResultRows','resultRowIndexes'];
const child=createReaderBuilderProbe(contentSource,methods,{...searchListDependencies,...runtime.sdk,ReaderContentSearchPublication},runtime.hooks);
register('ReaderControlSearchContent',contentSource);
const panel=createReaderBuilderProbe(panelSource,['searchPublication','searchRevision','searchModuleContent'],{
  ...runtime.sdk,ReaderContentSearchPublication,ReaderControlSearchContent:child.Component,
},runtime.hooks);
register('ReaderControlPanel',panelSource);
const lreTree=parse(lreSource);let argumentsFromLre;
function visit(node){if(node.expression?.getText?.(lreTree)==='ReaderControlPanel'&&node.arguments?.length)
  argumentsFromLre=node.arguments[0].properties.filter(prop=>['searchPublication','searchRevision'].includes(prop.name?.getText(lreTree)))
    .map(prop=>prop.getText(lreTree)).join(',\n');ts.forEachChild(node,visit);}
visit(lreTree);assert.ok(argumentsFromLre);
const fields=['quickSearchState','quickSearchPublication','quickSearchRevision','publishQuickSearchState'];
const parent=createReaderBuilderProbe(`@Component struct SearchOwner {
 ${fields.map(name=>member(lreSource,name)).join('\n')}
 build(){ ReaderControlPanel({${argumentsFromLre}}); }
}`,fields.concat('build'),{...runtime.sdk,ReaderContentSearchPublication,ReaderControlPanel:panel.Component},runtime.hooks);
parent.owner.initialRender();const stage=[...parent.owner.children.values()][0];
Object.assign(stage,{contentEndpointHeight:full=>full?666:190,contentMotionProgress:0,contentMotionWidth:286,contentMotionHeight:190,
  secondaryModuleInputEnabled:()=>true});
stage.searchModuleContent();const page=[...stage.children.values()][0];
Object.assign(page,{motionProgress:0,availableWidth:286,availableHeight:190,resultScrollMounted:false,
  resultScrollPosition:scroll.createReaderControlSearchScroll()});
page.acceptSearchPublication();
const notices=[];
page.resultDataSource.registerDataChangeListener({onDataReloaded(){notices.push(['reload']);},
  onDataChange(index){notices.push(['change',index]);},onDataAdd(index){notices.push(['add',index]);}});
const rows=Array.from({length:2000},(_,chapterIndex)=>({sourceId:'s',bookId:'b',chapterIndex,chapterOffset:2,chapterTitle:`章 ${chapterIndex}`,
  snippet:'保留原文',snippetStart:0,matchLength:1}));
const state={kind:'results',keyword:'保留',results:rows};
parent.owner.publishQuickSearchState(state);runtime.flush();
assert.equal(stage.searchPublication,parent.owner.quickSearchPublication);
assert.equal(page.searchPublication,parent.owner.quickSearchPublication);
assert.equal(page.acceptedSearchState,state,'raw owner comparison cannot compare a V1 @State proxy to the raw object');
assert.equal(page.state.results,rows,'no nested result-array clone in the State owner');
assert.equal(page.currentResult(1999,2),rows[1999]);
const dataSource=page.resultDataSource;
assert.equal(dataSource.totalCount(),2000);assert.equal(dataSource.getData(1999),rows[1999]);
assert.deepEqual(notices,[['reload']]);notices.length=0;
const index=page.resultRowIndexes,copies=runtime.copies.filter(copy=>copy.object).length;
for(let step=0;step<=20;step++){
  stage.contentMotionProgress=step/20;stage.replay();runtime.flush();
  assert.equal(page.state.results,rows);assert.equal(page.currentResult(1999,2),rows[1999]);
  assert.equal(page.resultRowIndexes,index,'morph does not rebuild the result index');
  assert.equal(page.resultDataSource,dataSource,'morph retains the native source');
  assert.equal(dataSource.getData(1999),rows[1999]);
}
assert.equal(runtime.copies.filter(copy=>copy.object).length,copies,'morph performs no payload Prop copy');
assert.equal(copies,0,'both actual LRE→Panel→Content Prop boundaries carry scalars only');
assert.deepEqual(notices,[],'morph does not republish native data');
// Metadata-only pagination retains the array; changed results reindex and no
// retained closure may point at a replaced row with the same stable key.
parent.owner.publishQuickSearchState({...state,loadingMore:true});runtime.flush();
assert.equal(page.currentResult(1999,2),rows[1999]);assert.equal(page.resultRowIndexes,index);
assert.deepEqual(notices,[],'loadingMore metadata must not reload or replace native items');
const appended=rows.concat(Array.from({length:50},(_,i)=>({...rows[0],chapterIndex:2000+i,chapterTitle:`追加 ${i}`})));
parent.owner.publishQuickSearchState({...state,results:appended,loadingMore:false,hasMore:true});runtime.flush();
assert.equal(page.resultDataSource,dataSource);assert.equal(dataSource.totalCount(),2050);
assert.equal(dataSource.getData(2049),appended[2049]);assert.equal(page.currentResult(2049,2),appended[2049]);
assert.deepEqual(notices,Array.from({length:50},(_,i)=>['add',2000+i]),'append must notify only the 50 new native indices');
notices.length=0;
const changed=appended.slice();changed[1999]={...changed[1999],chapterTitle:'新标题'};
parent.owner.publishQuickSearchState({...state,results:changed});runtime.flush();
assert.equal(stage.searchRevision,parent.owner.quickSearchRevision,'parent revision reaches Panel');
assert.equal(page.searchRevision,parent.owner.quickSearchRevision,'Panel revision reaches Content');
assert.equal(page.acceptedSearchState,parent.owner.quickSearchPublication.stateAt(parent.owner.quickSearchRevision),'revision admits current raw payload');
assert.equal(page.currentResult(1999,2),changed[1999]);assert.notEqual(page.resultRowIndexes,index);
assert.equal(dataSource.getData(1999),changed[1999]);
assert.deepEqual(notices,[['change',1999]],'same-key metadata replacement refreshes the item without reloading the list');
notices.length=0;
parent.owner.publishQuickSearchState({kind:'idle'});runtime.flush();assert.equal(page.currentResult(1999,2),undefined);
assert.equal(page.resultDataSource,dataSource);assert.equal(dataSource.totalCount(),0);
assert.deepEqual(notices,[['reload']]);
assert.equal(page.resultNativeFollowTimer,-1,'unmounted state changes do not schedule native work');
assert.equal(runtime.copies.filter(copy=>copy.object).length,0,'metadata, append, replacement and idle also avoid payload Prop copies');
console.log(JSON.stringify({passed:true,sdk:runtime.source,componentSha256:createHash('sha256').update(contentSource).digest('hex'),rows:rows.length,morphSamples:21,payloadPropCopies:copies,appended:50,finalDataSourceCount:dataSource.totalCount(),
  dataNotifications:{initialReloads:1,morph:0,metadata:0,added:50,changed:[1999],idleReloads:1},
  boundary:'actual SDK compiler + property/proxy dispatch; no native List/IME/renderer timing'}));
