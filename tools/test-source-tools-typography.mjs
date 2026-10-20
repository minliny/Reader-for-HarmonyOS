import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={smallButton:'Actual compact action role',actionButton:'Actual action role',fullWidthActionButton:'Actual full-width action role',debugCard:'Actual debug input role',editorCard:'Actual code area role'};
async function carrier(method){
 const {foundationControls,foundationSpecs}=await import('./lib/reader-foundation-control-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const source=readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsPage.ets',import.meta.url),'utf8');
 const roleName=({smallButton:'TYPE_SOURCE_TOOLS_COMPACT_ACTION',actionButton:'TYPE_SOURCE_TOOLS_ACTION',fullWidthActionButton:'TYPE_SOURCE_TOOLS_ACTION',debugCard:'TYPE_SOURCE_TOOLS_BODY',editorCard:'TYPE_SOURCE_TOOLS_CODE_INPUT'})[method];
 for(const mutate of [false,true]){
  const role={...readerTypographyRoles[roleName]};if(mutate){role.fontFamily='RolePropagationProbe';role.fontSizeFp+=2;if(role.fontWeight!==undefined)role.fontWeight+=100;if(role.lineHeightFp!==undefined)role.lineHeightFp+=3;}
  const roles={...readerTypographyRoles,[roleName]:role},shared=foundationControls({specs:foundationSpecs(roles)});
  const {owner}=createReaderBuilderProbe(source,[method,'heading','debugLogRow','actionButton','canWriteSources'],{...shared.dependencies,LazyForEach:{create(){},pop(){}}},shared.hooks);
  Object.assign(owner,{appThemeScheme:'day',snapshot:{debugSourceId:'',checkMode:'search',checkDepth:2,debugKey:'draft',debugLogs:[],editorSourceId:'source',editorText:'{}'},debugLogDataSource:{},onDebugKeyChanged(){},onCheckSelectionChanged(){}});
  const args=method==='actionButton'?['action',true,true,()=>{}]:['action',true,()=>{}];owner[method](...args);
  const type=method==='editorCard'?'TextArea':method==='debugCard'?'TextInput':'Text';
  const child=[...owner.children.values()].find(c=>c.constructor===shared.dependencies[method==='debugCard'||method==='editorCard'?'ReaderFormField':'ReaderButton']&&(method!=='editorCard'||c.specId==='source-code'));assert.ok(child,method+' genuine child');
  const nodes=shared.nodes(child).filter(n=>n.type===type);assert.equal(nodes.length,1);
  for(const [native,key] of Object.entries({fontFamily:'fontFamily',fontWeight:'fontWeight',fontSize:'fontSizeFp',lineHeight:'lineHeightFp',letterSpacing:'letterSpacingFp'}))assert.equal(nodes[0][native],role[key],method+'/'+native);
 }
}
for(const id of selectContractCases(definitions)){await carrier(id);recordContractCasePass(id);}
