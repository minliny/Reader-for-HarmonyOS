import {foundationControls} from './lib/reader-foundation-control-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const root=path.resolve(import.meta.dirname,'..'), ets=path.join(root,'entry/src/main/ets');
const source=file=>readFileSync(path.join(ets,'features',file),'utf8');
const output={layer:'Actual SDK Builder retained observer calls plus all production fontColor AST consumers; no new VM pixels',builder:[],consumers:[],sharedConsumers:[]};
const {owner:detail}=createReaderBuilderProbe(source('bookshelf/LocalBookDetail.ets'),['chapterSection','chapterRow','chapterEmptyMessage','chapterSectionHeight'],{
  CHAPTER_SECTION_HEIGHT:282,ButtonType:{Normal:'Normal'}});
Object.assign(detail,{appThemeScheme:'day',toc:[],loadingMessage:'',readingEnabled:true,visibleToc:()=>[],contentWidth:()=>338});
detail.chapterSection();
for(const scheme of ['day','night','day']){
  detail.appThemeScheme=scheme;detail.replay();
  const text=[...detail.nodes.values()].find(n=>n.type==='Text'&&n.create==='完整目录');
  const expected=readerAppColor(scheme==='night'?'TOK_GREEN':'TOK_PRIMARY_DARK',scheme);
  output.builder.push({method:'LocalBookDetail.chapterSection',scheme,actual:text.fontColor,expected});
  if(process.argv.includes('--record'))writeFileSync(process.argv[process.argv.indexOf('--record')+1],JSON.stringify(output,null,2)+'\n');
  assert.equal(text.fontColor,expected,'outlined directory action text uses Night emphasis, not solid-fill foreground');
  assert.deepEqual([text.fontSize,text.fontWeight,text.fontFamily],[12,900,'ReaderInter']);
  const capsule=[...detail.nodes.values()].find(n=>n.type==='Row'&&n.width===94);
  assert.deepEqual([capsule.width,capsule.height,capsule.borderRadius],[94,30,999]);
  assert.equal(capsule.backgroundColor,readerAppColor('app.LocalBookDetail.chapterSection.backgroundColor.A3FFFCF8',scheme));
  assert.equal(capsule.border.color,readerAppColor('TOK_BORDER',scheme));
  const target=[...detail.nodes.values()].find(n=>n.width===94&&n.height===44);
  assert.deepEqual([target.width,target.height,target.position.x,target.position.y],[94,44,229,3]);
  const icon=[...detail.nodes.values()].find(n=>n.type==='Image');
  assert.equal(icon.create,`app.media.book_detail_directory${scheme==='night'?'_theme_night':''}`);
}
for(const file of ['settings/RulesManagementPage.ets','source/SourceToolsPage.ets','bookshelf/BookshelfManagementPage.ets']){
  const shared=foundationControls();const {owner}=createReaderBuilderProbe(source(file),['actionButton'],shared.dependencies,shared.hooks);
  Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false}});
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
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
function scan(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);if(entry.isDirectory()){scan(file);continue;}if(!file.endsWith('.ets'))continue;
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
}}
scan(ets);
assert.ok(output.consumers.some(row => row.file.endsWith('common/ReaderRecoveryAction.ets')), 'the extracted editor recovery control retains the shared primary foreground');
// Five former foreground sites moved into finite public button specs in the
// fourth migration. Bind exact actual owner/spec/native edges; a raw AST total
// alone cannot prove their semantic color or retained theme propagation.
const moved=[
 {file:'bookshelf/BookshelfManagementPage.ets',method:'actionButton',specId:'shelf-action',label:'次操作',arguments:['次操作',false,()=>{}],methods:['actionButton']},
 {file:'bookshelf/BookshelfManagementPage.ets',method:'smallAction',specId:'shelf-small',label:'小操作',arguments:['小操作',()=>{}],methods:['smallAction']},
 {file:'bookshelf/BookshelfManagementPage.ets',method:'groupRow',specId:'shelf-row-edit',label:'编辑',arguments:[{groupId:3,groupName:'实际分组',bookCount:1,show:true}],methods:['groupRow','smallAction']},
 {file:'bookshelf/BookshelfManagementPage.ets',method:'assignmentBookRow',specId:'shelf-row-select',label:'选择',arguments:[{sourceId:2,bookId:7,title:'真实书',author:'作者',group:'组'}],methods:['assignmentBookRow','isSelectedBook']},
 {file:'rss/RssEntryDetailPage.ets',method:'bottomActions',specId:'rss-detail-bottom',label:'打开原文',arguments:[],methods:['bottomActions','hasOriginalLink']},
];
for(const edge of moved){
 const shared=foundationControls(),{owner}=createReaderBuilderProbe(source(edge.file),edge.methods,{...shared.dependencies,RSS_DETAIL_ACTION_AREA_HEIGHT:62},shared.hooks);
 Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false,mutationBlocked:false,selectedGroupId:0,selectedBookId:0,selectedSourceId:0},item:{link:'https://original.test'},onBack:()=>{},onOpenOriginal:()=>{},contentFrame:()=>({width:354,left:18,right:18}),onSelectGroup:()=>{},onToggleGroupShown:()=>{},onDeleteGroup:()=>{},onSelectBook:()=>{}});
 owner[edge.method](...edge.arguments);const actors=[...owner.children.values()].filter(c=>c instanceof shared.button.Component&&c.specId===edge.specId&&c.label===edge.label);assert.equal(actors.length,1,'exact current owner -> finite shared class: '+edge.file+'/'+edge.method);
 const actor=actors[0];assert.equal(actor.primary,false,'the original emphasis branch remains secondary');const native=shared.nodes(actor).find(n=>n.type==='Text');assert.ok(native);
 const colors=[];for(const scheme of ['day','night','day']){owner.appThemeScheme=scheme;shared.flush(owner);const expected=readerAppColor(scheme==='night'?'TOK_GREEN':'TOK_PRIMARY_DARK',scheme);assert.equal(native.fontColor,expected,'real shared theme propagation: '+edge.file+'/'+edge.method);colors.push(native.fontColor);}
 output.sharedConsumers.push({file:'features/'+edge.file,method:edge.method,specId:edge.specId,label:edge.label,colors});
}
assert.equal(output.consumers.length,26,'all remaining direct primary foreground AST sites are still accounted exactly');assert.equal(output.sharedConsumers.length,5,'all five migrated physical foreground sites have exact current owner/native proof');
assert.equal(output.consumers.length+output.sharedConsumers.length,31,'the original 31 foreground sites remain covered across direct and finite shared implementations');
if(process.argv.includes('--record'))writeFileSync(process.argv[process.argv.indexOf('--record')+1],JSON.stringify(output,null,2)+'\n');
console.log(`PASS Night primary text: ${output.consumers.length} direct AST + ${output.sharedConsumers.length} exact common native foregrounds, ${output.builder.length} retained Builder states; Day/solid fill/alpha/layout retained.`);
