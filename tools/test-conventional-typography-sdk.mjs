import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"actual-role-propagation": {"description": "当前实际管理按钮的role变更传播", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {foundationControls} = await import('./lib/reader-foundation-control-probe.mjs');
const {readerTypographyRoles} = await import('./lib/reader-typography-probe.mjs');

const source=readFileSync(new URL('../entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets',import.meta.url),'utf8');
const render=roles=>{const shared=foundationControls({roles});const {owner}=createReaderBuilderProbe(source,['actionButton'],shared.dependencies,shared.hooks);Object.assign(owner,{appThemeScheme:'day'});owner.actionButton('实际操作',true,()=>{});return shared.nodes(owner).find(n=>n.type==='Text');};
// foundationControls consumes role data through foundationSpecs; inject that finite resolver explicitly.
const {foundationSpecs}=await import('./lib/reader-foundation-control-probe.mjs');
function actual(roles){const shared=foundationControls({specs:foundationSpecs(roles)}),{owner}=createReaderBuilderProbe(source,['actionButton'],shared.dependencies,shared.hooks);owner.appThemeScheme='day';owner.actionButton('实际操作',true,()=>{});return shared.nodes(owner).find(n=>n.type==='Text');}
const base=actual(readerTypographyRoles),name='TYPE_SHELF_MANAGEMENT_BUTTON',changed=actual({...readerTypographyRoles,[name]:{...readerTypographyRoles[name],fontSizeFp:readerTypographyRoles[name].fontSizeFp+2}});
assert.equal(changed.fontSize,base.fontSize+2,'current real parent→finite spec→native role propagation');
assert.equal(changed.create,base.create,'role mutation does not rewrite action data');

}
