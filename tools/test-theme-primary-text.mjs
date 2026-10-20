import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"detail": {"description": "实际detail目录动作Night强调色/retained icon", "resources": []}, "message-action": {"description": "实际RecoveryAction各variant当前role颜色", "resources": []}, "empty-shelf": {"description": "实际empty Shelf shared message前景role（导航归专项）", "resources": []}, "buttons-settings": {"description": "实际settings主/次按钮day-night传播", "resources": []}, "buttons-source": {"description": "实际source主/次按钮day-night传播", "resources": []}, "buttons-bookshelf": {"description": "实际bookshelf主/次按钮day-night传播", "resources": []}, "direct-rss": {"description": "显式rss当前fontColor AST role表达式policy", "resources": []}, "direct-sync": {"description": "显式sync当前fontColor AST role表达式policy", "resources": []}, "direct-settings": {"description": "显式settings当前fontColor AST role表达式policy", "resources": []}, "direct-source": {"description": "显式source当前fontColor AST role表达式policy", "resources": []}, "direct-bookshelf": {"description": "显式bookshelf当前fontColor AST role表达式policy", "resources": []}, "direct-common": {"description": "显式common当前fontColor AST role表达式policy", "resources": []}, "status-source": {"description": "实际sourcebusy status message前景role", "resources": []}, "status-bookshelf": {"description": "实际bookshelfbusy status message前景role", "resources": []}, "shared-bookshelf": {"description": "实际bookshelf有限spec→native强调色传播", "resources": []}, "shared-rss": {"description": "实际rss有限spec→native强调色传播", "resources": []}, "shared-source": {"description": "实际source有限spec→native强调色传播", "resources": []}, "shared-sync": {"description": "实际sync有限spec→native强调色传播", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {localBookDetailSdk} = await import('./lib/local-book-detail-sdk-probe.mjs');
const {foundationControls} = await import('./lib/reader-foundation-control-probe.mjs');
const {readerRecoveryView} = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {labeledIconControls} = await import('./lib/reader-labeled-icon-action-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync,readdirSync,writeFileSync} = await import('node:fs');
const {default: path} = await import('node:path');
const {createRequire} = await import('node:module');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {readerAppColor} = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');


const root=path.resolve(import.meta.dirname,'..'), ets=path.join(root,'entry/src/main/ets');
const source=file=>readFileSync(path.join(ets,'features',file),'utf8');
const output={layer:'Actual SDK Builder retained observer calls plus all production fontColor AST consumers; no new VM pixels',builder:[],consumers:[],sharedConsumers:[]};
if(selectedCase==='detail'){
const {owner:detail}=localBookDetailSdk();
Object.assign(detail,{appThemeScheme:'day',book:{sourceId:'source',bookId:'book',contentKind:'novel',title:'标准小说'},toc:[],removing:false,collapsedGroups:[],loadingMessage:'',readingEnabled:true,visibleToc:()=>[],onOpenDirectory:()=>{}});
detail.catalog();
for(const scheme of ['day','night','day']){
  detail.appThemeScheme=scheme;detail.replay();
  const text=[...detail.nodes.values()].find(n=>n.type==='Text'&&n.create==='完整目录');
  const expected=readerAppColor(scheme==='night'?'TOK_GREEN':'TOK_PRIMARY_DARK',scheme);
  output.builder.push({method:'LocalBookDetail.catalog',scheme,actual:text.fontColor,expected});
  assert.equal(text.fontColor,expected,'outlined directory action text uses Night emphasis, not solid-fill foreground');
  const icon=[...detail.nodes.values()].find(n=>n.type==='Image');
  assert.equal(icon.create,`app.media.book_detail_directory${scheme==='night'?'_theme_night':''}`);
}
}
for(const file of ['settings/RulesManagementPage.ets','source/SourceToolsPage.ets','bookshelf/BookshelfManagementPage.ets'].filter(file=>'buttons-'+file.split('/')[0]===selectedCase)){
  const shared=foundationControls();const {owner}=createReaderBuilderProbe(source(file),['actionButton'],shared.dependencies,shared.hooks);
  Object.assign(owner,{operation:{receipt:undefined,readFacts:undefined,confirmedParts:0},statusKind:'error',statusMessage:'加载失败',readFacts:{fact:'failed',message:'离线',canRetry:true,generation:1},onRetryLoad:()=>{},onReconcile:()=>{},onLoginSource:()=>{},appThemeScheme:'day',snapshot:{busy:false}});
  if(file.startsWith('source/')){owner.actionButton('主操作',true,true,()=>{});owner.actionButton('次操作',false,true,()=>{});}else{owner.actionButton('主操作',true,()=>{});owner.actionButton('次操作',false,()=>{});}
  for(const scheme of ['day','night','day'])for(const busy of [false,true]){
    owner.appThemeScheme=scheme;owner.snapshot.busy=busy;shared.flush(owner);
    const text=shared.nodes(owner).filter(n=>n.type==='Text');
    assert.equal(text[0].fontColor,readerAppColor('TOK_ON_PRIMARY',scheme),'solid action keeps its independent onPrimary');
    assert.equal(text[0].backgroundColor,readerAppColor('TOK_PRIMARY_DARK',scheme),'solid primaryDark fill is unchanged');
    assert.equal(text[1].fontColor,readerAppColor(scheme==='night'?'TOK_GREEN':'TOK_PRIMARY_DARK',scheme));
    assert.equal(text[1].backgroundColor,readerAppColor('TOK_SURFACE_PANEL_SOFT',scheme));
    output.builder.push({method:file+'.actionButton',scheme,busy,primary:{font:text[0].fontColor,fill:text[0].backgroundColor},secondary:{font:text[1].fontColor,fill:text[1].backgroundColor}});
  }
}
// Inspect the actual SDK AST for every foreground consumer. Restrict this gate
// to foregrounds: primaryDark remains valid for filled surfaces and borders.
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
function scanFile(file){
  const tree=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  function visit(node){
    if(ts.isCallExpression(node)&&node.expression?.name?.text==='fontColor'&&node.arguments?.[0]?.getText(tree).match(/TOK_PRIMARY_(DARK|TEXT)/)){
      const calls=[];function collect(n){if(ts.isCallExpression(n)&&n.expression.getText(tree)==='readerAppColor'&&n.arguments[0]?.getText(tree).match(/TOK_PRIMARY_(DARK|TEXT)/))calls.push(n);ts.forEachChild(n,collect);}collect(node.arguments[0]);
      assert.ok(calls.length,`${file}: no unchecked indirect primaryDark foreground`);
      for(const call of calls){const evaluate=new Function('readerAppColor',`return ${call.getText(tree)}`),record={file:path.relative(ets,file),line:tree.getLineAndCharacterOfPosition(call.getStart(tree)).line+1,colors:[]};
        for(const scheme of ['day','night','day']){
          const actual=evaluate.call({appThemeScheme:scheme,scheme,primary:false},readerAppColor),expected=readerAppColor(scheme==='night'?'TOK_GREEN':'TOK_PRIMARY_DARK',scheme);
          assert.equal(actual,expected,`${record.file}:${record.line}: Day retained, Night emphasis follows primary`);record.colors.push(actual);
        }output.consumers.push(record);
      }
    }ts.forEachChild(node,visit);
  }visit(tree);
}
const directFiles={rss:['rss/RssSubscriptionEditorPage.ets','rss/RssPage.ets','rss/RssSubscriptionManagementPage.ets','rss/RssEntryDetailPage.ets'],sync:['sync/SyncPage.ets'],settings:['settings/RulesManagementPage.ets'],source:['source/SourceToolsPage.ets'],bookshelf:['bookshelf/LocalBookDetail.ets'],common:['common/ReaderSelect.ets']};
if(selectedCase.startsWith('direct-'))for(const file of directFiles[selectedCase.slice(7)])scanFile(path.join(ets,'features',file));
// Four former foreground sites now belong to reviewed message consumers.
// Bind each original owner to its actual emitted current native foreground.
const recoverySource=source('common/ReaderRecoveryAction.ets');

output.messageConsumers=[];const messageColors=[];
if(selectedCase==='message-action') for(const variant of ['compact','rssManagement','notice','text']){
 const sdk=boundedSurfaceSdk();const actor=sdk.consumer(recoverySource,undefined,{}, {label:'核对',variant});actor.initialRender();
 for(const scheme of ['day','night','day']){
  actor.appThemeScheme=scheme;sdk.properties.flush();const native=sdk.nodes(actor).find(node=>node.type==='Text'&&node.create==='核对');
  const expected=readerAppColor(variant==='notice'?'TOK_MESSAGE_NOTICE_INK':'TOK_MESSAGE_SOFT_INK',scheme);
  assert.equal(native.fontColor,expected,'actual approved message foreground and current scheme');messageColors.push({variant,scheme,color:native.fontColor});
 }
}
output.messageConsumers.push({file:'features/common/ReaderRecoveryAction.ets',colors:messageColors});
if(selectedCase==='empty-shelf'){
 const file='bookshelf/BookshelfEmptyCard.ets',sdk=boundedSurfaceSdk();let imported=0,searched=0;
 const owner=sdk.consumer(source(file),undefined,{}, {onImportRequested:()=>imported++,onSearchRequested:()=>searched++});owner.initialRender();
 const actions=sdk.walk(owner).filter(actor=>actor instanceof sdk.deps.ReaderRecoveryAction);
 assert.deepEqual(actions.map(actor=>actor.label),['导入本地书籍','搜索书籍']);
 const colors=[];
 for(const scheme of ['day','night','day']){
  for(const actor of sdk.walk(owner))if('appThemeScheme' in actor)actor.appThemeScheme=scheme;
  sdk.properties.flush();
  for(const action of actions){const native=sdk.nodes(action).find(node=>node.type==='Text'&&node.create===action.label);
   assert.equal(native.fontColor,readerAppColor('TOK_MESSAGE_SOFT_INK',scheme));colors.push({scheme,label:action.label,color:native.fontColor});}
 }
 for(const action of actions)sdk.nodes(action).find(node=>node.onClick).onClick();
 assert.deepEqual([imported,searched],[1,1],'both original empty-shelf navigation entries remain usable');
 output.messageConsumers.push({file:'features/'+file,method:'build',colors});
}
for(const file of ['bookshelf/BookshelfManagementPage.ets','source/SourceToolsPage.ets'].filter(file=>'status-'+file.split('/')[0]===selectedCase)){
 const definition=source(file);
 const sdk=boundedSurfaceSdk();const owner=sdk.consumer(definition,['statusCard']);
 Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:true,statusMessage:'正在读取现有数据',sources:[{sourceId:'source1'}],batchCheck:{phase:'idle'}}});
 owner.statusCard();const colors=[];
 for(const scheme of ['day','night','day']){
  owner.appThemeScheme=scheme;owner.replay();sdk.properties.flush();
  const native=sdk.nodes(owner).find(node=>node.type==='Text'&&node.create==='正在读取现有数据');
  assert.ok(native,'actual finite busy status remains rendered: '+file);
  assert.equal(native.fontColor,readerAppColor('TOK_MESSAGE_MUTED',scheme));

  const loading=sdk.nodes(owner).find(node=>node.type==='LoadingProgress');
  assert.ok(loading,'actual busy marker remains');
  colors.push({scheme,color:native.fontColor});
 }
 output.messageConsumers.push({file:'features/'+file,method:'statusCard',colors});
}
// Eleven former foreground sites moved into finite public Button/Icon specs in
// the fourth, fifth and Source action migrations. Bind exact actual owner/spec/native edges; a raw AST total
// alone cannot prove their semantic color or retained theme propagation.
const moved=[
 {file:'bookshelf/BookshelfManagementPage.ets',method:'actionButton',specId:'shelf-action',label:'次操作',arguments:['次操作',false,()=>{}],methods:['actionButton']},
 {file:'bookshelf/BookshelfManagementPage.ets',method:'smallAction',specId:'shelf-small',label:'小操作',arguments:['小操作',()=>{}],methods:['smallAction']},
 {file:'bookshelf/BookshelfManagementPage.ets',method:'groupRow',specId:'shelf-row-edit',label:'编辑',arguments:[{groupId:3,groupName:'实际分组',bookCount:1,show:true}],methods:['groupRow','smallAction']},
 {file:'bookshelf/BookshelfManagementPage.ets',method:'assignmentBookRow',specId:'shelf-row-select',label:'选择',arguments:[{sourceId:2,bookId:7,title:'真实书',author:'作者',group:'组'}],methods:['assignmentBookRow','isSelectedBook']},
 {file:'rss/RssEntryDetailPage.ets',method:'bottomActions',specId:'rss-detail-bottom',label:'打开原文',arguments:[],methods:['bottomActions','hasOriginalLink']},
 {file:'rss/RssPage.ets',method:'managePill',specId:'rss-manage',label:'管理',arguments:[],methods:['managePill'],icon:true},
 {file:'rss/RssPage.ets',method:'recentUnreadHeader',specId:'rss-view-all',label:'查看全部',arguments:[],methods:['recentUnreadHeader'],icon:true},
 {file:'rss/RssSourceFeedPage.ets',method:'entrySectionHeader',specId:'rss-source-operations',label:'源操作',arguments:[],methods:['entrySectionHeader'],icon:true},
 {file:'source/SourceManagementPage.ets',method:'statusBanner',specId:'source-management-retry',label:'重试',arguments:[],methods:['statusBanner','recovery']},
 {file:'source/SourceManagementPage.ets',method:'loginButton',specId:'source-management-login',label:'登录',arguments:[{sourceId:'source1'}],methods:['loginButton']},
 {file:'sync/SyncPage.ets',method:'configActions',specId:'sync-config-test',label:'测试网络连通性',arguments:[],methods:['configActions','canMutate','effectiveWebdavUrl','effectiveWebdavUser','effectiveWebdavPath']},
];
for(const edge of moved.filter(edge=>'shared-'+edge.file.split('/')[0]===selectedCase)){
 const shared=edge.icon?labeledIconControls():foundationControls(),{owner}=createReaderBuilderProbe(source(edge.file),edge.methods,{...shared.dependencies,RSS_DETAIL_ACTION_AREA_HEIGHT:62,readerRecoveryView},shared.hooks);
 Object.assign(owner,{operation:{receipt:undefined,readFacts:undefined,confirmedParts:0},statusKind:'error',statusMessage:'加载失败',readFacts:{fact:'failed',message:'离线',canRetry:true,generation:1},onRetryLoad:()=>{},onReconcile:()=>{},onLoginSource:()=>{},appThemeScheme:'day',snapshot:{busy:false,mutationBlocked:false,selectedGroupId:0,selectedBookId:0,selectedSourceId:0,facts:{canMutate:true}},onManage:()=>{},onModeRequested:()=>{},onSourceOperations:()=>{},onSaveConfig:()=>{},onTestConnection:()=>{},item:{link:'https://original.test'},onBack:()=>{},onOpenOriginal:()=>{},contentFrame:()=>({width:354,left:18,right:18}),onSelectGroup:()=>{},onToggleGroupShown:()=>{},onDeleteGroup:()=>{},onSelectBook:()=>{}});
 owner[edge.method](...edge.arguments);const actors=[...owner.children.values()].filter(c=>c instanceof (edge.icon?shared.component:shared.button.Component)&&c.specId===edge.specId&&c.label===edge.label);assert.equal(actors.length,1,'exact current owner -> finite shared class: '+edge.file+'/'+edge.method);
 const actor=actors[0];if(!edge.icon)assert.equal(actor.primary,false,'the original emphasis branch remains secondary');const native=shared.nodes(actor).find(n=>n.type==='Text');assert.ok(native);
 const colors=[];for(const scheme of ['day','night','day']){owner.appThemeScheme=scheme;shared.flush(owner);const expected=readerAppColor(scheme==='night'?'TOK_GREEN':'TOK_PRIMARY_DARK',scheme);assert.equal(native.fontColor,expected,'real shared theme propagation: '+edge.file+'/'+edge.method);colors.push(native.fontColor);}
 output.sharedConsumers.push({file:'features/'+edge.file,method:edge.method,specId:edge.specId,label:edge.label,colors});
}
console.log('selected primary foreground actual SDK/AST case PASS: '+selectedCase);

}
