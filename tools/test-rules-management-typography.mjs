import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function carriers() {
 const {loadReaderTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const {foundationControls,foundationSpecs}=await import('./lib/reader-foundation-control-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
 const read=name=>readFileSync(new URL('../entry/src/main/ets/'+name,import.meta.url),'utf8');
 const roles=loadReaderTypographyRoles(read('features/common/ReaderTypography.ets')),page=read('features/settings/RulesManagementPage.ets');
 const keys=['TYPE_RULES_MANAGEMENT_HEADING','TYPE_RULES_MANAGEMENT_INPUT','TYPE_RULES_MANAGEMENT_ACTION'];
 for(const scheme of ['day','night'])for(const mutated of [false,true]) {
  const active={...roles};if(mutated)for(const key of keys)active[key]={...roles[key],fontFamily:'ReaderTestRole',fontWeight:500,fontSizeFp:roles[key].fontSizeFp+3};
  const shared=foundationControls({specs:foundationSpecs(active)}),{owner}=createReaderBuilderProbe(page,['heading','input','actionButton'],{...shared.dependencies,...active,readerAppColor},shared.hooks);
  Object.assign(owner,{appThemeScheme:scheme,snapshot:{busy:false}});let changed,actions=0;
  owner.heading('标题');owner.input('原草稿','占位',value=>changed=value);owner.actionButton('动作',true,()=>actions++);
  const nodes=shared.nodes(owner),heading=nodes.find(n=>n.type==='Text'&&n.create==='标题'),field=nodes.find(n=>n.type==='TextInput'),action=nodes.find(n=>n.type==='Text'&&n.create==='动作');
  for(const[node,key]of [[heading,keys[0]],[field,keys[1]],[action,keys[2]]]) {assert.ok(node,key);const role=active[key];assert.deepEqual([node.fontFamily,node.fontWeight,node.fontSize],[role.fontFamily,role.fontWeight,role.fontSizeFp]);assert.equal(Object.hasOwn(node,'lineHeight'),false,'actual native AUTO remains omitted');}
  field.onChange('新草稿');assert.equal(changed,'新草稿');const button=[...owner.children.values()].find(c=>c instanceof shared.button.Component);assert.ok(button);shared.nodes(button).find(n=>n.onClick).onClick();assert.equal(actions,1);
 }
}
for(const id of selectContractCases({'role-carriers':'Actual heading/shared input/shared action, AUTO, callbacks and role mutation'})){await carriers();recordContractCasePass(id);}
