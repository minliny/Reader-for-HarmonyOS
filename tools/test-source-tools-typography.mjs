import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={smallButton:'Actual compact action role',actionButton:'Actual action role',fullWidthActionButton:'Actual full-width action role',debugCard:'Actual debug input role',editorCard:'Actual code area role'};
definitions['card-frame']='Actual tools card frame preserves distinct solid and list materials';
const actors=owner=>[owner,...[...owner.children.values()].flatMap(actors)];
async function carrier(method){
 const {foundationControls,foundationSpecs,withReaderSectionHeading}=await import('./lib/reader-foundation-control-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const source=readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceToolsPage.ets',import.meta.url),'utf8');
 const roleName=({smallButton:'TYPE_SOURCE_TOOLS_COMPACT_ACTION',actionButton:'TYPE_SOURCE_TOOLS_ACTION',fullWidthActionButton:'TYPE_SOURCE_TOOLS_ACTION',debugCard:'TYPE_SOURCE_TOOLS_BODY',editorCard:'TYPE_SOURCE_TOOLS_CODE_INPUT'})[method];
 for(const mutate of [false,true]){
  const role={...readerTypographyRoles[roleName]};if(mutate){role.fontFamily='RolePropagationProbe';role.fontSizeFp+=2;if(role.fontWeight!==undefined)role.fontWeight+=100;if(role.lineHeightFp!==undefined)role.lineHeightFp+=3;}
  const roles={...readerTypographyRoles,[roleName]:role},shared=withReaderSectionHeading(foundationControls({specs:foundationSpecs(roles)}),roles);
  const {owner}=createReaderBuilderProbe(source,[...new Set([method,'debugLogRow','actionButton','canWriteSources'])],{...shared.dependencies,LazyForEach:{create(){},pop(){}}},shared.hooks);
  Object.assign(owner,{appThemeScheme:'day',snapshot:{debugSourceId:'',checkMode:'search',checkDepth:2,debugKey:'draft',debugLogs:[],editorSourceId:'source',editorText:'{}'},debugLogDataSource:{},onDebugKeyChanged(){},onCheckSelectionChanged(){}});
  const args=method==='actionButton'?['action',true,true,()=>{}]:['action',true,()=>{}];owner[method](...args);
  const type=method==='editorCard'?'TextArea':method==='debugCard'?'TextInput':'Text';
  const child=actors(owner).find(c=>c.constructor===shared.dependencies[method==='debugCard'||method==='editorCard'?'ReaderFormField':'ReaderButton']&&(method!=='editorCard'||c.specId==='source-code'));assert.ok(child,method+' genuine child');
  const nodes=shared.nodes(child).filter(n=>n.type===type);assert.equal(nodes.length,1);
  for(const [native,key] of Object.entries({fontFamily:'fontFamily',fontWeight:'fontWeight',fontSize:'fontSizeFp',lineHeight:'lineHeightFp',letterSpacing:'letterSpacingFp'}))assert.equal(nodes[0][native],role[key],method+'/'+native);
 }
}
async function cardFrame(){
 const {foundationControls,readerFoundationTokens,withReaderSectionHeading}=await import('./lib/reader-foundation-control-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {bookshelfOperationClass}=await import('./lib/bookshelf-operation-owner-probe.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
 const source=readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceToolsPage.ets',import.meta.url),'utf8');
 const shared=withReaderSectionHeading(foundationControls());
 const cardMethods=['batchCard','exportCard','sourceCard','editorCard'];
 const sourceEditorReadbackPending=bookshelfOperationClass('features/source/application/SourceToolsOrchestrator.ets','sourceEditorReadbackPending');
 const {owner}=createReaderBuilderProbe(source,[...cardMethods,'actionButton','fullWidthActionButton','canWriteSources',
  'batchControlsRenderKey','batchSelectionAction','toolsOpeningIsCurrent','editorDraftIsEditable'],
  {...shared.dependencies,sourceEditorReadbackPending,LazyForEach:{create(){},pop(){}}},shared.hooks);
 Object.assign(owner,{appThemeScheme:'day',sourceDataSource:{},snapshot:{busy:false,sources:[],selectedSourceCount:0,
  selectedSourceIds:[],batchCheck:{phase:'idle'},editorSourceId:'source',editorText:'{}'}});
 owner.batchCard(owner.batchControlsRenderKey());
 for(const method of cardMethods.slice(1))owner[method]();
 const cards=[...owner.children.values()].filter(child=>child instanceof shared.dependencies.ReaderCard);
 assert.deepEqual(cards.map(card=>card.specId),['editor-section','editor-section','bordered-list-section','editor-section']);
 for(const card of cards){
  const frame=[...card.nodes.values()].find(node=>node.type==='Column');
  const catalog=card.specId==='bordered-list-section';
  assert.equal(frame.borderRadius,10);
  assert.equal(frame.padding,readerFoundationTokens.TOK_SPACE_SM);
  assert.equal(frame.backgroundColor,readerAppColor(catalog?'TOK_CARD_BG':'TOK_SURFACE_SOLID','day'));
  assert.deepEqual(frame.border,{width:readerFoundationTokens.TOK_BORDER_W,color:readerAppColor('TOK_BORDER','day')});
 }
}
for(const id of selectContractCases(definitions)){await (id==='card-frame'?cardFrame():carrier(id));recordContractCasePass(id);}
