import assert from 'node:assert/strict';
import { foundationControls, foundationSpecs } from './lib/reader-foundation-control-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readFileSync } from 'node:fs';
import { loadReaderTypographyRoles } from './lib/reader-typography-probe.mjs';

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

const expected = {
  TYPE_SHELF_MANAGEMENT_NOTE: ['ReaderNotoSansSC', 400, 10, 16],
  TYPE_SHELF_MANAGEMENT_STATUS: ['ReaderNotoSansSC', 400, 12, 18],
  TYPE_SHELF_MANAGEMENT_BODY: ['ReaderNotoSansSC', 400, 12, undefined],
  TYPE_SHELF_MANAGEMENT_BODY_MUTED: ['ReaderNotoSansSC', 400, 11, undefined],
  TYPE_SHELF_MANAGEMENT_META: ['ReaderNotoSansSC', 400, 10, undefined],
  TYPE_SHELF_MANAGEMENT_GROUP_TITLE: ['ReaderNotoSansSC', 700, 13, undefined],
  TYPE_SHELF_MANAGEMENT_ROW_ACTION: ['ReaderNotoSansSC', 400, 11, undefined],
  TYPE_SHELF_MANAGEMENT_BOOK_TITLE: ['ReaderNotoSansSC', 700, 12, undefined],
  TYPE_SHELF_MANAGEMENT_HEADING: ['ReaderNotoSerifSCBold', 700, 16, undefined],
  TYPE_SHELF_MANAGEMENT_BUTTON: ['ReaderNotoSansSC', 700, 12, undefined],
  TYPE_SHELF_MANAGEMENT_SMALL_ACTION: ['ReaderNotoSansSC', 400, 10, undefined],
};

for (const role of roles) {
  const style = typography[role];
  assert.ok(style, `${role} exists`);
  assert.deepEqual([
    style.fontFamily,
    style.fontWeight,
    style.fontSizeFp,
    style.lineHeightFp,
  ], expected[role], `${role} preserves the existing bookshelf-management tuple`);
  const specRoles={ TYPE_SHELF_MANAGEMENT_BUTTON:'shelf-action', TYPE_SHELF_MANAGEMENT_SMALL_ACTION:'shelf-small', TYPE_SHELF_MANAGEMENT_ROW_ACTION:'shelf-row-edit' };
  if(specRoles[role]) assert.equal(foundationSpecs().resolveReaderButtonSpec(specRoles[role]).text.fontFamily,style.fontFamily,'actual finite spec retains the original role');
  else assert.match(page, new RegExp(`${role}\\.fontFamily`), `${role} is consumed by the page`);
}

assert.doesNotMatch(page, /fontFamily\('Reader(?:NotoSansSC|NotoSerifSCBold)'\)/,
  'bookshelf-management page no longer owns a physical font-family literal');
assert.doesNotMatch(page, /\.fontSize\((?:10|11|12|13|16)\)/,
  'bookshelf-management page no longer owns a direct font-size tuple');

console.log('PASS bookshelf-management typography uses named ReaderTypography roles without changing tuples');

// Actual Parent→SDK common component→native tuple, rather than allowing a
// source-name registration to replace the former three control consumers.
for(const [method,args,role,spec]of [['actionButton',['操作',false,()=>{}],'TYPE_SHELF_MANAGEMENT_BUTTON','shelf-action'],['smallAction',['操作',()=>{}],'TYPE_SHELF_MANAGEMENT_SMALL_ACTION','shelf-small'],['groupRow',[{groupId:1,groupName:'组',groupOrder:1,show:true,bookCount:1}],'TYPE_SHELF_MANAGEMENT_ROW_ACTION','shelf-row-edit']]){
 const shared=foundationControls(),{owner}=createReaderBuilderProbe(page,[method,'smallAction'],shared.dependencies,shared.hooks);Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false}});owner[method](...args);
 const child=[...owner.children.values()].find(c=>c instanceof shared.button.Component&&c.specId===spec);assert.ok(child);const n=shared.nodes(child).find(n=>n.type==='Text');for(const[p,key]of Object.entries({fontFamily:'fontFamily',fontWeight:'fontWeight',fontSize:'fontSizeFp',lineHeight:'lineHeightFp',letterSpacing:'letterSpacingFp'})){if(typography[role][key]===undefined)assert.equal(Object.hasOwn(n,p),false,'AUTO');else assert.equal(n[p],typography[role][key]);}
}
