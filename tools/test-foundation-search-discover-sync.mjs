import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tailControls,compileTailConsumer,seedTailOwner,searchActionMethods} from './lib/foundation-tail-consumer-probe.mjs';
import {foundationSpecs} from './lib/reader-foundation-control-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {createRequire}from'node:module';
const req=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',ts=req(sdk+'/node_modules/typescript'),opts=req(sdk+'/lib/ets_checker.js').compilerOptions;
const baseline=JSON.parse(readFileSync(new URL('./fixtures/design/foundation-search-discover-sync-baseline.json',import.meta.url)));
const props=['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','textAlign','maxLines','textOverflow','padding','margin','constraintSize','width','height','layoutWeight','backgroundColor','borderRadius','border','responseRegion'];
const tuple=n=>Object.fromEntries(props.filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]));
function members(source,names){const tree=ts.createSourceFile('Page.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,opts);const component=tree.statements.find(n=>n.members&&n.members.some(m=>m.name?.text==='build'));return names.map(name=>{const member=component.members.find(m=>m.name?.text===name);assert.ok(member,name);return member.getText(tree);});}
function searchScopeDependencies(source){
 const tree=ts.createSourceFile('SearchPage.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,opts);
 const declarations=tree.statements.filter(ts.isVariableStatement).flatMap(statement=>[...statement.declarationList.declarations]);
 return Object.fromEntries(['SEARCH_LOCAL_SCOPE','SEARCH_ONLINE_SCOPE'].map(name=>{
  const declaration=declarations.find(value=>value.name.getText(tree)===name);
  assert.ok(declaration&&ts.isStringLiteral(declaration.initializer),name+' must bind the actual production scope label');
  return[name,declaration.initializer.text];
 }));
}
function resultsHeaderProducer(source){
 const tree=ts.createSourceFile('SearchPage.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,opts),component=tree.statements.find(n=>n.members&&n.members.some(m=>m.name?.text==='build'));
 const build=component.members.find(m=>m.name?.text==='build'),header=component.members.find(m=>m.name?.text==='searchHeader');
 let scaffoldHeader,statsCall;
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(tree)==='ReaderPageScaffold')scaffoldHeader=node.arguments[0]?.properties?.find(p=>p.name?.getText(tree)==='header');
  ts.forEachChild(node,visit);
 }
 visit(build);
 assert.ok(scaffoldHeader,'search result typography must remain connected to the actual public header slot');
 assert.equal(scaffoldHeader.initializer.body.statements.length,1);
 assert.equal(scaffoldHeader.initializer.body.statements[0].expression.getText(tree),'this.searchHeader()','actual public header invokes the production search header builder');
 function findStats(node){
  if(ts.isIfStatement(node)&&node.expression.getText(tree)==="this.presentation.kind === 'results'"){
   const statements=node.thenStatement.statements;
   if(statements?.length===1&&statements[0].expression?.getText(tree)==='this.resultStats()')statsCall=statements[0].expression;
  }
  ts.forEachChild(node,findStats);
 }
 findStats(header);
 assert.ok(statsCall,'the actual results header owns the unchanged statistics builder');
 return statsCall.expression.name.text;
}
function setup(file,method,{scheme='day',tablet=false,busy=false,selected=true,canRetry=true}={}){
 const old=tailControls(),current=tailControls(),source=readFileSync(new URL('../'+file.path,import.meta.url),'utf8');
 const scope=file.path.includes('/search/')?searchScopeDependencies(source):{};
 const required=file.path.includes('/search/')?searchActionMethods:file.path.includes('/sync/')?['canMutate']:['currentFilterText','kindTitles'];
 const frozen='@Component struct OriginalActionFamily{\n'+file.methods.join('\n')+'\n'+members(source,required.filter(n=>!file.names.includes(n))).join('\n')+'\nbuild(){Column(){}}\n}';
 const names=[...new Set([method,...required])],headerProducer=method==='resultsContent'?resultsHeaderProducer(source):undefined;
 const owners={old:compileTailConsumer(frozen,names,{...old.dependencies,...scope},old.hooks).owner,current:compileTailConsumer(source,[...names,...(headerProducer?[headerProducer]:[])],{...current.dependencies,...scope},current.hooks).owner},calls={old:[],current:[]};
 for(const[side,owner]of Object.entries(owners)){
  seedTailOwner(owner,{scheme,tablet,busy,kind:method==='searchBar'&&busy?'loading':method==='resultsContent'?'results':method==='emptyContent'?'empty':method==='errorContent'?'error':'initial',operation:{canRetry,canCancel:busy}});
  if(method==='groupScopeChip'){owner.presentation={kind:'initial',history:[]};owner.selectedGroupName=selected?'在线':'本地';}
  if(file.path.includes('/discover/'))owner.presentation={kind:'ready',kinds:[{title:'分类一'},{title:'分类二'}],activeKindIndex:selected?0:1,filter:'最新'};
  for(const name of['onSearch','onStop','onBack','onRetry','onManageSources','onClearHistory','onRetryHistory','onTriggerBackup','onRefresh','onSelectKind'])owner[name]=(...args)=>calls[side].push([name,...args]);
 }
 return{file,source,old,current,owners,calls,method,headerProducer};
}
function clickByLabel(shared,owner,label){
 const own=[...owner.nodes.values()],text=own.find(n=>n.type==='Text'&&n.create===label);
 if(text?.onClick)return text;
 for(const child of owner.children.values()){const candidate=clickByLabel(shared,child,label);if(candidate)return candidate;}
 if(text){const ordered=shared.orderedNodes(owner),index=ordered.indexOf(text);return ordered.slice(0,index).reverse().find(n=>typeof n.onClick==='function');}
}
function render(p,args=[]){
 p.owners.old[p.method](...args);
 // The same production statistics producer now lives in the fixed header.
 // Render its registered SDK builder before the body, preserving the original
 // five text actors and owner callbacks rather than deleting their comparisons.
 if(p.headerProducer)p.owners.current[p.headerProducer]();
 p.owners.current[p.method](...args);
}
const files=Object.fromEntries(baseline.files.map(f=>[f.path.includes('/search/')?'search':f.path.includes('/discover/')?'discover':'sync',f]));
{
 const source=readFileSync(new URL('../'+files.search.path,import.meta.url),'utf8');
 assert.throws(()=>resultsHeaderProducer(source.replace('header: (): void => { this.searchHeader(); }','header: (): void => { this.stateContent(); }')),/actual public header invokes/,'a body builder cannot silently replace the retained statistics header producer');
 assert.throws(()=>resultsHeaderProducer(source.replace("if (this.presentation.kind === 'results') { this.resultStats(); }","if (this.presentation.kind === 'empty') { this.resultStats(); }")),/actual results header owns/,'statistics must remain admitted by the actual results state');
}
let cases=0;
for(const scheme of['day','night'])for(const fileKey of['search','discover','sync'])for(const method of files[fileKey].names){
 const variants=method==='searchBar'?[{tablet:false,busy:false},{tablet:false,busy:true},{tablet:true,busy:false},{tablet:true,busy:true}]:method==='groupScopeChip'?[{selected:false},{selected:true}]:method==='resultsContent'?[{canRetry:false},{canRetry:true}]:method==='emptyState'?[{busy:false},{busy:true}]:[{}];
 for(const variation of variants){const p=setup(files[fileKey],method,{scheme,...variation});const args=method==='groupScopeChip'?['在线']:method==='emptyContent'?['原关键词',7]:method==='errorContent'?[7]:[];render(p,args);
  const oldTexts=p.old.orderedNodes(p.owners.old).filter(n=>n.type==='Text'),allCurrentTexts=p.current.orderedNodes(p.owners.current).filter(n=>n.type==='Text');
  // Manga/text filtering adds one finite empty-result notice. Keep every
  // original action/font/geometry comparison, and qualify only this new actor.
  const addedNotice=method==='resultsContent'?allCurrentTexts.filter(n=>n.create==='已返回的结果中没有符合当前筛选（在线 · 全部类型）的书籍，可切换范围或内容类型。'):[];
  if(method==='resultsContent'){
   assert.equal(addedNotice.length,1,'one current content-filter empty notice is added');
   assert.deepEqual([addedNotice[0].fontFamily,addedNotice[0].fontSize,addedNotice[0].lineHeight,addedNotice[0].padding,addedNotice[0].width],['ReaderInter',13,20,24,'100%']);
   assert.equal(addedNotice[0].fontColor,readerAppColor('TOK_MUTED',scheme));assert.equal(addedNotice[0].textAlign,'TextAlign.Center');
  }
  const currentTexts=allCurrentTexts.filter(n=>!addedNotice.includes(n));assert.equal(currentTexts.length,oldTexts.length,method+': all original text nodes remain');
  for(let i=0;i<oldTexts.length;i++){assert.equal(currentTexts[i].create,oldTexts[i].create,method+': original label/order');assert.deepEqual(tuple(currentTexts[i]),tuple(oldTexts[i]),method+': exact five fonts/AUTO and geometry/colors');}
  if(method!=='searchBar'&&method!=='filterRow'&&method!=='emptyState'){
   for(const text of oldTexts.filter(n=>typeof n.onClick==='function')){const next=clickByLabel(p.current,p.owners.current,text.create);assert.ok(next,method+': real shared native action '+text.create);if(text.enabled!==false)text.onClick();next.onClick();}
   assert.deepEqual(p.calls.current,p.calls.old,method+': every actual original action and admission preserved');
   if(method==='categoryChips')for(const text of oldTexts){const oldAction=clickByLabel(p.old,p.owners.old,text.create),currentAction=clickByLabel(p.current,p.owners.current,text.create);assert.deepEqual(tuple(currentAction),tuple(oldAction),'actual category Stack geometry/fill/radius');oldAction.onClick();currentAction.onClick();}assert.deepEqual(p.calls.current,p.calls.old);
  }
  if(method==='searchBar'){
   const oldInput=p.old.orderedNodes(p.owners.old).find(n=>n.type==='TextInput'),newInput=p.current.orderedNodes(p.owners.current).find(n=>n.type==='TextInput');assert.deepEqual(tuple(newInput),tuple(oldInput));oldInput.onChange('草稿');newInput.onChange('草稿');oldInput.onSubmit('EnterKeyType.Search');newInput.onSubmit('EnterKeyType.Search');assert.deepEqual(p.calls.current,p.calls.old,'original native IME and actual submit policy');
   const spinner=p.current.orderedNodes(p.owners.current).find(n=>n.type==='LoadingProgress');assert.equal(spinner!==undefined,variation.busy);if(spinner)assert.equal(spinner.enableLoading,true,'actual native existing spinner remains in retained leading slot');
   const originalStacks=p.old.orderedNodes(p.owners.old).filter(n=>n.type==='Stack'&&typeof n.onClick==='function'),newActors=[...p.owners.current.children.values()];assert.equal(originalStacks.length,2);const searchActor=newActors.find(c=>c.specId?.startsWith('search-field-'));assert.ok(searchActor);
   const action=p.current.nodes(searchActor).find(n=>typeof n.onClick==='function');assert.deepEqual(tuple(action),tuple(originalStacks[1]),'search/stop exact Stack geometry, fill and disabled opacity');originalStacks[1].onClick();action.onClick();assert.deepEqual(p.calls.current,p.calls.old,'original search/stop owner dispatch');
   const oldID=action.id;searchActor.updateStateVars({scheme,specId:searchActor.specId,label:'父状态修改',primary:false,actionEnabled:false,layout:'intrinsic',isBusy:variation.busy,availableWidth:0,actionAccessibilityLabel:''});p.current.properties.flush();assert.equal(p.current.nodes(searchActor).find(n=>typeof n.onClick==='function').id,oldID);const before=p.calls.current.length;action.onClick();assert.equal(p.calls.current.length,before,'real retained @Prop disabled blocks old physical');searchActor.aboutToDisappear();action.onClick();assert.equal(p.calls.current.length,before,'unmounted old physical reject');
  }
  if(method==='filterRow'){
   const oldAction=p.old.orderedNodes(p.owners.old).find(n=>n.type==='Row'&&typeof n.onClick==='function'),actor=[...p.owners.current.children.values()].find(c=>c.specId==='discover-apply'),newAction=p.current.nodes(actor).find(n=>n.type==='Row'&&typeof n.onClick==='function');assert.deepEqual(tuple(newAction),tuple(oldAction),'Discover exact outer geometry and border');assert.deepEqual(newAction.linearGradient,oldAction.linearGradient,'original gradient stops/direction');oldAction.onClick();newAction.onClick();assert.deepEqual(p.calls.current,p.calls.old,'actual original refresh action');const modifier=p.current.modifiers;
   const calls=[];const attrs=new Proxy({},{get:(_,k)=>(...args)=>calls.push([k,...args])});const m=new p.current.dependencies.ReaderLabeledIconRowModifier('discover-apply',false,scheme,true);m.applyPressedAttribute(attrs);m.applyNormalAttribute(attrs);assert.deepEqual(calls.filter(c=>c[0]==='linearGradient').at(-1)[1],oldAction.linearGradient,'cancel restores exact original gradient');const before=p.calls.current.length;actor.updateStateVars({scheme,specId:'discover-apply',label:'应用',actionEnabled:false,isDanger:false,showDivider:false,icon:actor.icon});p.current.properties.flush();newAction.onClick();actor.aboutToDisappear();newAction.onClick();assert.equal(p.calls.current.length,before,'actual retained gradient actor disabled/removed physical rejects');
  }
  if(method==='emptyState'){
   const card=[...p.owners.current.children.values()].find(c=>c.specId==='sync-status');assert.ok(card,'actual Sync consumer mounts the real finite Card');
   const outer=[...card.nodes.values()].find(n=>n.type==='Column'&&Object.hasOwn(n,'borderRadius')),spec=p.current.dependencies.resolveReaderCardSpec(card.specId);assert.ok(outer);
   assert.equal(outer.borderRadius,spec.radius);assert.deepEqual(outer.constraintSize,{maxWidth:spec.maxWidth});assert.deepEqual(outer.border,{width:spec.borderWidth,color:readerAppColor(spec.borderRole,card.appThemeScheme)});assert.equal(outer.backgroundColor,readerAppColor(spec.backgroundRole,card.appThemeScheme));
   const old=p.old.orderedNodes(p.owners.old).find(n=>n.type==='Text'&&n.create==='立即备份'),actor=[...p.owners.current.children.values()].flatMap(c=>[c,...c.children.values()]).find(c=>c.specId==='sync-empty-backup');assert.ok(actor);const next=p.current.nodes(actor).find(n=>n.type==='Text');if(!variation.busy)old.onClick();next.onClick();assert.deepEqual(p.calls.current,p.calls.old,'actual empty backup callback and busy admission');
  }
  cases++;
 }
}
for(const [searching,stopped,expected]of[
 [true,false,'当前筛选（在线 · 全部类型）下暂无结果，搜索仍在继续。'],
 [false,true,'搜索已停止，已返回的结果中没有符合当前筛选（在线 · 全部类型）的书籍。可切换范围或内容类型。'],
 [false,false,'已返回的结果中没有符合当前筛选（在线 · 全部类型）的书籍，可切换范围或内容类型。'],
]){
 const p=setup(files.search,'resultsContent');p.owners.current.presentation={...p.owners.current.presentation,searching,stopped};
 p.owners.current.resultsContent();
 const notice=p.current.orderedNodes(p.owners.current).filter(n=>n.type==='Text'&&n.create===expected);
 assert.equal(notice.length,1,'actual filtered empty notice distinguishes running, stopped and completed searches');
}
function checkSearchArea(candidate=readFileSync(new URL('../'+files.search.path,import.meta.url),'utf8')){
 const controls=tailControls(),names=['initialContent','resultsContent','resultStats',...searchActionMethods];
 const Component=compileTailConsumer(candidate,names,{...controls.dependencies,...searchScopeDependencies(candidate)},controls.hooks).Component;
 for(const unit of[false,true]){
  const history=seedTailOwner(new Component(undefined,{}));history.initialContent();
  const host=controls.orderedNodes(history).find(node=>node.type==='Column'&&typeof node.onAreaChange==='function');assert.ok(host);
  const keyword=[...history.children.values()].find(child=>child.specId==='search-history-keyword');assert.ok(keyword);
  host.onAreaChange({}, {width:unit?'226vp':226});
  assert.equal(history.historyWidth,190,'actual narrow search history Area receipt deducts only the authored 36vp sides');
  history.replay();controls.properties.flush();
  assert.equal(history.children.get(keyword.id),keyword,'history width measurement retains its actual shared chip actor');
  assert.equal(keyword.availableWidth,190);
  const results=seedTailOwner(new Component(undefined,{}),{kind:'results'});results.resultStats();results.resultsContent();
  const stats=controls.orderedNodes(results).find(node=>node.type==='Flex'&&typeof node.onAreaChange==='function');assert.ok(stats);
  const list=controls.orderedNodes(results).find(node=>node.type==='List'),scroller=results.resultScroller;assert.ok(list);
  stats.onAreaChange({}, {height:unit?'65vp':65});
  assert.equal(results.resultStatsHeight,65,'actual search statistics Area receipt updates measured fixed-header clearance');
  results.replay();controls.properties.flush();
  assert.equal(results.nodes.get(list.id),list,'statistics measurement retains the native results List');
  assert.equal(list.create.scroller,scroller);assert.equal(results.resultScroller,scroller);
  assert.equal(list.contentStartOffset,results.searchHeaderHeight()+65,'retained result list clears the actual measured statistics height');
 }
}
checkSearchArea();
for(const expression of['readerPageAreaLength(next.width)','readerPageAreaLength(next.height)']){
 const original=readFileSync(new URL('../'+files.search.path,import.meta.url),'utf8'),candidate=original.replace(expression,expression.replace('readerPageAreaLength','Number'));
 assert.notEqual(candidate,original);
 assert.throws(()=>checkSearchArea(candidate),/narrow search history Area receipt|search statistics Area receipt/,'restoring Number(Area) rejects vp history/statistics receipts');
}
// True common/finite propagation: a single finite height change reaches both
// phone and wide production consumers without affecting the other variant.
{
 const normal=foundationSpecs(),changed={...normal,resolveReaderButtonSpec:id=>({...normal.resolveReaderButtonSpec(id),height:id==='search-field-phone'?38:normal.resolveReaderButtonSpec(id).height})};
 const controls=tailControls({foundation:(await import('./lib/reader-foundation-control-probe.mjs')).foundationControls({specs:changed})});
 for(const[tablet,height]of[[false,38],[true,40]]){const source=readFileSync(new URL('../'+files.search.path,import.meta.url),'utf8'),owner=compileTailConsumer(source,['searchBar',...searchActionMethods],{...controls.dependencies,...searchScopeDependencies(source)},controls.hooks).owner;seedTailOwner(owner,{tablet});owner.searchBar();const child=[...owner.children.values()].find(c=>c.specId?.startsWith('search-field-'));assert.equal(controls.nodes(child).find(n=>n.type==='Stack').height,height);}
}
// A thin official ColorMetrics API seam observes both original gradient stops
// delegating to the existing modifier. It does not implement alpha blending.
{
 const blends=[];const ColorMetrics={resourceColor(color){return{red:1,green:2,blue:3,blendColor(overlay){blends.push({color,overlay});return{color:'native-blend:'+color};}};},rgba(red,green,blue,alpha){assert.equal(alpha,.12);return{red,green,blue,alpha};}};
 const shared=tailControls({ColorMetrics}),calls=[],attrs=new Proxy({},{get:(_,key)=>(value)=>calls.push([key,value])});
 const Modifier=shared.dependencies.ReaderLabeledIconRowModifier,normal=new Modifier('discover-apply',false,'day',true);normal.applyNormalAttribute(attrs);const original=calls.find(c=>c[0]==='linearGradient')[1];normal.applyPressedAttribute(attrs);const pressed=calls.filter(c=>c[0]==='linearGradient').at(-1)[1];assert.equal(blends.length,2);assert.deepEqual(pressed.colors.map(stop=>stop[0]),original.colors.map(stop=>'native-blend:'+stop[0]));normal.applyNormalAttribute(attrs);assert.deepEqual(calls.filter(c=>c[0]==='linearGradient').at(-1)[1],original,'pointer cancel retains original stops');const disabled=new Modifier('discover-apply',false,'day',false);disabled.applyPressedAttribute(attrs);assert.equal(blends.length,2,'disabled never requests color blend');assert.deepEqual(calls.filter(c=>c[0]==='linearGradient').at(-1)[1],original);
}
console.log(`PASS foundation action tail: ${cases} actual frozen/current full parent SDK comparisons, 10 Search/2 Discover/1 Sync declarations; fonts/AUTO/layout/gradient, owner actions/native IME, retained Prop/disabled/removed physical, original spinner and finite propagation`);
