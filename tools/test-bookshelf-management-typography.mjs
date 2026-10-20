import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"control-role-propagation": {"description": "实际管理控件parent→共享spec→native角色传播", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const { foundationControls, foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readFileSync } = await import('node:fs');
const { readerMessageStyles, loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');


const read = relative => readFileSync(new URL(`../entry/src/main/ets/${relative}`, import.meta.url), 'utf8');
const typographySource = read('features/common/ReaderTypography.ets');
const roles = [
  'TYPE_SHELF_MANAGEMENT_NOTE',
  'TYPE_SHELF_MANAGEMENT_STATUS',
  'TYPE_SHELF_MANAGEMENT_BODY',
  'TYPE_SHELF_MANAGEMENT_BODY_MUTED',
  'TYPE_SHELF_MANAGEMENT_META',
  'TYPE_SHELF_MANAGEMENT_GROUP_TITLE',
  'TYPE_SHELF_MANAGEMENT_ROW_ACTION',
  'TYPE_SHELF_MANAGEMENT_BOOK_TITLE',
  'TYPE_SHELF_MANAGEMENT_HEADING',
  'TYPE_SHELF_MANAGEMENT_BUTTON',
  'TYPE_SHELF_MANAGEMENT_SMALL_ACTION',
];
const allTypography = loadReaderTypographyRoles(typographySource);
const typography = Object.fromEntries(roles.map(role => [role, allTypography[role]]));
const page = read('features/bookshelf/BookshelfManagementPage.ets');

// Actual Parent→SDK common component→native tuple, rather than allowing a
// source-name registration to replace the former three control consumers.
for(const [method,args,role,spec]of [['actionButton',['操作',false,()=>{}],'TYPE_SHELF_MANAGEMENT_BUTTON','shelf-action'],['smallAction',['操作',()=>{}],'TYPE_SHELF_MANAGEMENT_SMALL_ACTION','shelf-small'],['groupRow',[{groupId:1,groupName:'组',groupOrder:1,show:true,bookCount:1}],'TYPE_SHELF_MANAGEMENT_ROW_ACTION','shelf-row-edit']]){
 const shared=foundationControls(),{owner}=createReaderBuilderProbe(page,[method,'smallAction'],shared.dependencies,shared.hooks);Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false}});owner[method](...args);
 const child=[...owner.children.values()].find(c=>c instanceof shared.button.Component&&c.specId===spec);assert.ok(child);const n=shared.nodes(child).find(n=>n.type==='Text');for(const[p,key]of Object.entries({fontFamily:'fontFamily',fontWeight:'fontWeight',fontSize:'fontSizeFp',lineHeight:'lineHeightFp',letterSpacing:'letterSpacingFp'})){if(typography[role][key]===undefined)assert.equal(Object.hasOwn(n,p),false,'AUTO');else assert.equal(n[p],typography[role][key]);}
}

}
