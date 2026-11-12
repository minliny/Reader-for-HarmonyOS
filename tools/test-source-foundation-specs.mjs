import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"action-admission": {"description": "实际Source consumer/native action/busy/captured source/retired", "resources": []}, "responsive-chip": {"description": "实际chip finite width消费在输入边界内", "resources": []}, "trailing-tools": {"description": "实际backBar trailing→shared Icon native callback", "resources": []}};
definitions['status-badge-semantics']={description:'Actual native badge paths/labels, Source check facts and closed RSS/Settings compatibility, retired appearance API; no wide/device',resources:[]};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
if(selectedCase==='status-badge-semantics'){await runStatusBadgeSemantics();return;}
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const {createRequire,stripTypeScriptTypes} = await import('node:module');
const {readFileSync} = await import('node:fs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {labeledIconControls} = await import('./lib/reader-labeled-icon-action-probe.mjs');
const {iconButtonControls} = await import('./lib/reader-icon-button-probe.mjs');
const {readerAppColor} = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const {readerSourceCategoryLabel} = await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
const {sourceManagementRecoveryClosure}=await import('./lib/source-management-recovery-probe.mjs');
const {actualSourceManagementGeometry}=await import('./lib/source-management-owner-probe.mjs');

const source=readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url),'utf8');
const golden=JSON.parse(readFileSync(new URL('./fixtures/design/source-management-action-baseline.json',import.meta.url),'utf8'));
const keys=['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','textAlign','maxLines','width','height','layoutWeight','padding','backgroundColor','border','borderRadius','opacity'];
const physical=n=>Object.fromEntries(keys.filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]));
let count=0;
if(selectedCase==='action-admission') {
 // The historical hand-painted banner is not a production consumer. Preserve
 // its artifact as history; replace only its obsolete samples with the real
 // retained-list action, empty failure page and post-import status action.
 assert.doesNotMatch(source,/\bstatusBanner\b/,'retired private banner has no production definition or reference');
 const {sourceManagementRecoveryProbe,sourceRecoveryNativeAction}=await import('./lib/source-management-recovery-probe.mjs');
 for(const scheme of ['day','night']) for(const kind of ['retained-read','empty-read','import-action']) {
  const calls=[],operation={action:'load',sourceId:'',readFacts:kind==='import-action'?undefined:
   {fact:'failed',generation:9,canRetry:true,message:'read unavailable'}};
  const projection=sourceManagementRecoveryProbe(source,{operation,statusKind:'error',statusMessage:'read unavailable',
   sources:kind==='retained-read'?[{sourceId:'recovery-source'}]:[],
   statusActionLabel:kind==='import-action'?'重新搜索':'',statusActionGeneration:9,
   onReconcile:g=>calls.push(['reconcile',g]),onRetryLoad:()=>calls.push(['read']),
   onStatusAction:g=>calls.push(['status',g])},{scheme});
  const action=sourceRecoveryNativeAction(projection,kind==='import-action'?'重新搜索':kind==='empty-read'?'重试':'刷新列表');
  action.onClick();assert.deepEqual(calls,[[kind==='import-action'?'status':'reconcile',9]],'actual '+kind+' callback/generation');
  const generation=action.actor.generation;action.actor.generation=generation+1;
  action.onClick();assert.equal(calls.length,1,'retained native callback cannot adopt a replacement generation');
  count++;
 }
}
if(selectedCase==='action-admission') for(const g of golden.cases.filter(item=>item.method!=='statusBanner')){
 const {id,method,label,scheme,active}=g,p=labeledIconControls();
 const commands=['detectButton','loginButton'].includes(method)?['sourceRowCommand','sourceRowIsCurrent','sourceRenderKey','managementBackIsCurrent','managementOpeningIsCurrent']:[];
 const closure=sourceManagementRecoveryClosure(source,[],[method,...commands]);
 const support=new Function('FrameCallback',stripTypeScriptTypes(closure.support)+';return {SourceListDataSource,SourceListLayoutFrame};')(class {});
 const owner=createReaderBuilderProbe(source,closure.members,{...p.dependencies,...support,...actualSourceManagementGeometry(),readerSourceCategoryLabel,hilog:{info(){},warn(){},error(){}},ScrollDirection:{Horizontal:'ScrollDirection.Horizontal'}},p.hooks).owner,calls=[];
 const book={sourceId:'exact-source',loginUrl:'https://source.test/login',checkState:active?'checking':'idle'},width=id.endsWith('wide')?72:58;
 owner.sources=[book]; // Real Source @Prop arrives before mounting and watched status updates.
 Object.assign(owner,{mounted:true,appForeground:true,temporaryBackIdentity:'source-action-probe',groupOpen:false,projectedSources:[book],
  appThemeScheme:scheme,statusKind:'error',statusMessage:'真实消息',categoryValue:active?'all':'novel',filterControlWidth:()=>280,contentFrame:()=>({width:350}),actionBottomInset:()=>0,recovery:()=>({visible:false,canRetry:true,generation:9}),onReconcile:g=>calls.push(['reconcile',g]),onRetryLoad:()=>calls.push('read'),rebuildSourceProjection:()=>calls.push('filter'),onDetectSource:v=>calls.push(['detect',v]),onLoginSource:(v,url)=>calls.push(['login',v,url]),onOpenTools:()=>calls.push('manage'),onAddSource:()=>calls.push('add')});
 if(method==='chip')owner.chip(label,width,active,!active);else if(method==='detectButton'||method==='loginButton')owner[method](book);else owner[method]();
 const actor=[...owner.children.values()].find(c=>c.specId===id&&(c.label===label||id==='source-management-detect'&&c.label==='检测中'));
 assert.ok(actor,id+' actual Page constructs the finite shared component');
 const nativeNodes=p.orderedNodes(actor),actual=nativeNodes.filter(n=>['Text','Image','Row','Stack'].includes(n.type));
 assert.ok(actual.some(node=>node.type==='Text'&&node.create===actor.label),id+' actual finite label reaches native child');
 const hit=nativeNodes.find(n=>n.type==='Button'&&typeof n.onClick==='function');assert.ok(hit,id+' actual native Button handler');hit.onClick();
 const enabled=method!=='chip'||!active,dispatch=enabled&&!(method==='detectButton'&&active);
 assert.equal(calls.length,dispatch?1:0,id+' actual page admission/callback');
 if(method==='detectButton'&&dispatch)assert.deepEqual(calls[0],['detect','exact-source']);
 if(method==='loginButton')assert.deepEqual(calls[0],['login','exact-source',book.loginUrl]);
 if(commands.length>0){
  owner.groupOpen=true;hit.onClick();owner.groupOpen=false;
  owner.projectedSources=[{...book,loginUrl:'https://source.test/changed'}];hit.onClick();
  assert.equal(calls.length,dispatch?1:0,'the group overlay and a replacement row reject the retained physical action');
 }
 actor.aboutToDisappear();hit.onClick();assert.equal(calls.length,dispatch?1:0,id+' retired common physical actor rejects late click');count++;
}

async function runStatusBadgeSemantics(){
 const {default:assert}=await import('node:assert/strict');
 const {readFileSync}=await import('node:fs');
 const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
 const {boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
 const {verifySharedProducerInputCalls}=await import('./lib/shared-producer-inputs.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
 const root=new URL('../entry/src/main/ets/',import.meta.url),file=path=>new URL(path,root),read=path=>readFileSync(file(path),'utf8');
 const badgePath='ui/controls/StatusBadge.ets',badgeSource=read(badgePath),{ts,options}=installedEtsCompiler();
 function open(status,label,scheme='day',density=1,source=badgeSource){
  const properties=createArkUIPropertyRuntimeProbe();
  const probe=createReaderBuilderProbe(source,boundedMembers(source),{...properties.sdk,readerAppColor,LineJoinStyle:{Round:'LineJoinStyle.Round'}},properties.hooks);
  const owner=new probe.Component(undefined,{status,label});
  Object.assign(owner,{appThemeScheme:scheme,getUIContext:()=>({vp2px:value=>value*density})});owner.initialRender();
  return {owner,properties,nodes:()=>[...owner.nodes.values()]};
 }
 function readable(f,label){
  const path=f.nodes().find(node=>node.type==='Path');assert.ok(path&&typeof path.commands==='string'&&path.commands.length>0,'status must have a visible non-color native path');
  const frame=f.nodes().find(node=>node.type==='Stack');assert.ok(frame);assert.equal(frame.width,24);assert.equal(frame.height,18);assert.equal(frame.borderRadius,999);
  assert.equal(frame.accessibilityText,label);assert.equal(frame.accessibilityGroup,true);
  assert.equal(path.width,12);assert.equal(path.height,12);assert.equal(path.accessibilityLevel,'no');
  assert.equal(f.nodes().some(node=>node.type==='Text'),false,'decorative mark is a graphic rather than font-scaled body text');
  assert.equal(f.nodes().some(node=>typeof node.onClick==='function'),false,'status stays read-only');return path;
 }
 const roles={success:['app.status.goodSoft','app.status.good'],error:['app.status.checkErrorSoft','app.status.checkError'],
  pending:['app.status.mutedSoft','app.status.mutedDot'],neutral:['app.status.mutedSoft','app.status.mutedDot'],
  enabled:['app.feed.enabledSurface','app.status.availableDot'],paused:['app.feed.disabledSurface','TOK_MUTED'],unknown:['app.status.mutedSoft','app.status.mutedDot']};
 const paths=new Set();
 for(const [status,[background,stroke]]of Object.entries(roles))for(const scheme of ['day','night']){
  const f=open(status,`当前${status}`,scheme),path=readable(f,`当前${status}`);paths.add(path.commands);
  assert.equal(f.nodes().find(node=>node.type==='Stack').backgroundColor,readerAppColor(background,scheme));assert.equal(path.stroke,readerAppColor(stroke,scheme));
  const dense=open(status,`当前${status}`,scheme,3),densePath=readable(dense,`当前${status}`);
  const numbers=text=>[...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(match=>Number(match[0]));
  assert.deepEqual(numbers(densePath.commands),numbers(path.commands).map(value=>value*3),'native px commands scale from vp at actual density');
  assert.equal(path.strokeWidth,1.6);
  assert.ok(numbers(path.commands).every(value=>value-path.strokeWidth/2>=0&&value+path.strokeWidth/2<=12),'control points and complete stroke fit the existing graphic slot without a font clamp');
 }
 assert.equal(paths.size,7,'all admitted statuses have distinct non-color marks');
 const reactive=open('success','检查通过'),old=readable(reactive,'检查通过').commands;
 reactive.owner.updateStateVars({status:'error',label:'检查失败'});reactive.properties.flush();assert.notEqual(readable(reactive,'检查失败').commands,old);
 const densityRevision=open('pending','检查中'),densityBefore=readable(densityRevision,'检查中').commands;
 densityRevision.owner.getUIContext=()=>({vp2px:value=>value*3});densityRevision.owner.configurationRevision+=1;densityRevision.properties.flush();
 assert.notEqual(readable(densityRevision,'检查中').commands,densityBefore,'actual configuration revision refreshes the native density conversion');
 const colorOnly=badgeSource.replace('.commands(this.symbolPath())',".commands('')");assert.notEqual(colorOnly,badgeSource);
 assert.throws(()=>readable(open('success','检查通过','day',1,colorOnly),'检查通过'),/non-color native path/,'restoring color-only rendering must fail');
 function argument(path,ownerName,method,receiver,bindings){
  const source=read(path),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);
  const owner=tree.statements.find(node=>node.name?.text===ownerName),member=owner.members.find(node=>node.name?.text===method);assert.ok(member);
  const calls=[];const visit=node=>{if((ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&node.expression.getText(tree)==='StatusBadge')calls.push(node.arguments[0]);ts.forEachChild(node,visit);};visit(member);assert.equal(calls.length,1);
  const js=ts.transpileModule('const value=('+calls[0].getText(tree)+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(bindings),js+';return value;').call(receiver,...Object.values(bindings));
 }
 const sourcePage='features/source/ui/SourceManagementPage.ets',rssPage='features/rss/ui/RssPage.ets',settingsPage='features/settings/ui/SettingsPage.ets';
 const Source=selectedProductionMethods(file(sourcePage),'SourceManagementPage',['sourceBadgeStatus','sourceBadgeLabel']),source=new Source();
 for(const [checkState,status,label]of [[undefined,'neutral','未检查'],['unchecked','neutral','未检查'],['checking','pending','检查中'],['passed','success','检查通过'],['failed','error','检查失败']]){
  const params=argument(sourcePage,'SourceManagementPage','statusBadge',source,{source:{sourceId:'source',name:'书源',enabled:true,checkState}});
  assert.deepEqual(params,{status,label});readable(open(params.status,params.label),label);
 }
 const Rss=selectedProductionMethods(file(rssPage),'RssPage',['sourceBadgeStatus','sourceBadgeLabel']),rss=new Rss();
 for(const enabled of [true,false]){const params=argument(rssPage,'RssPage','sourceItem',rss,{sub:{enabled}});assert.deepEqual(params,{status:enabled?'enabled':'paused',label:enabled?'订阅已启用':'订阅已暂停'});readable(open(params.status,params.label),params.label);}
 for(const label of ['文件访问','通知权限','电池优化']){const params=argument(settingsPage,'SettingsPage','permissionRow',{}, {label});assert.deepEqual(params,{status:'unknown',label:`${label}状态未查询`});readable(open(params.status,params.label),params.label);}
 for(const consumerFile of [sourcePage,rssPage,settingsPage]){
  const consumer=read(consumerFile),calls=verifySharedProducerInputCalls(badgeSource,consumer,{component:'StatusBadge',producerFile:badgePath,consumerFile});assert.equal(calls.length,1);assert.deepEqual(calls[0].keys.sort(),['label','status']);
  const wrong=consumer.replace('StatusBadge({','StatusBadge({ bg: "#fff",');assert.notEqual(wrong,consumer);assert.throws(()=>verifySharedProducerInputCalls(badgeSource,wrong,{component:'StatusBadge',producerFile:badgePath,consumerFile}),/illegal shared input bg/);
 }
 console.log('PASS actual native badge seven graphics/labels, density, reactive Props, Source facts, closed RSS/Settings compatibility and retired appearance negative controls; no device claim');
}

// Frozen old UI producer outputs, now consumed through the actual new Page.
if(selectedCase==='responsive-chip') for(const g of golden.widths){const p=labeledIconControls(),owner=createReaderBuilderProbe(source,['chip'],p.dependencies,p.hooks).owner;
 Object.assign(owner,{appThemeScheme:'day',filterControlWidth:()=>g.availableWidth,rebuildSourceProjection(){}});owner.chip('有限状态',g.width,false,true);
 const actor=[...owner.children.values()].at(-1);const width=p.nodes(actor).find(n=>n.type==='Text').width;assert.ok(Number.isFinite(width)&&width>=0);if(g.availableWidth>0)assert.ok(width<=g.availableWidth,'current finite chip stays inside admitted width');}
const syntax=createRequire(import.meta.url)((resolveEtsLoaderRoot())+'/lib/validate_ui_syntax.js');
syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
// Actual shared native icon hit target consumes the Page's real trailing slot.
if(selectedCase==='trailing-tools') for(const scheme of ['day','night']){
 const p=labeledIconControls(),iconSource=readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderIconButton.ets',import.meta.url),'utf8');
 const Icon=iconButtonControls({properties:p.properties}).icon.Component;
 class Back{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id},params);}initialRender(){}}
 const owner=createReaderBuilderProbe(source,['backBar'],{...p.dependencies,ReaderIconButton:Icon,PageBackBar:Back},{...p.hooks,childSources:{...p.hooks.childSources,ReaderIconButton:iconSource,PageBackBar:readFileSync(new URL('../entry/src/main/ets/ui/chrome/PageBackBar.ets',import.meta.url),'utf8')}}).owner;
 let clicks=0;Object.assign(owner,{appThemeScheme:scheme,onOpenTools:()=>clicks++,onBack(){}});owner.backBar();
 const bar=[...owner.children.values()].find(c=>c instanceof Back);bar.trailing();
 const icon=[...owner.children.values()].find(c=>c instanceof Icon),nodes=p.nodes(icon),hit=nodes.find(n=>n.type==='Stack');
 assert.ok(hit&&nodes.some(n=>n.type==='Image'));hit.onClick();assert.equal(clicks,1);
}

console.log(`PASS Source actual Page→shared controls: ${count} frozen original SDK tuples/callbacks/retired physical actors + 12 actual responsive-width consumers`);

}
