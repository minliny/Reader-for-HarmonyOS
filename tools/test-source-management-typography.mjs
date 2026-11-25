import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function metadata() {
 const {loadReaderTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
 const {readerSourceCategoryLabel}=await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
 const {sourceV9DisplayUrl}=await import('../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
 const read=name=>readFileSync(new URL('../entry/src/main/ets/'+name,import.meta.url),'utf8');
 const roles=loadReaderTypographyRoles(read('ui/foundation/ReaderTypography.ets')),source=read('features/source/ui/SourceManagementPage.ets');
 const original=roles.TYPE_SOURCE_MANAGEMENT_ROW_URL;
 assert.equal(roles.TYPE_SOURCE_MANAGEMENT_ROW_TITLE.fontSizeFp,14);
 assert.equal(original.fontSizeFp,11);
 for(const scheme of ['day','night'])for(const role of [original,{...original,fontFamily:'ReaderTestRole',fontWeight:500,fontSizeFp:original.fontSizeFp+2,lineHeightFp:original.lineHeightFp+3}])for(const api24 of [false,true]) {
  const {owner}=createReaderBuilderProbe(source,['sourceInfo','sourceDomain'],{...readerFoundationTokens,...roles,
   TYPE_SOURCE_MANAGEMENT_ROW_URL:role,readerAppColor,readerSourceCategoryLabel,sourceV9DisplayUrl,
   Alignment:{Center:'center'},VerticalAlign:{Center:'center'},HorizontalAlign:{Start:'start'},
   TextOverflow:{Ellipsis:'ellipsis'},EllipsisMode:{CENTER:'center',END:'end'},WordBreak:{BREAK_ALL:'break-all'}});
  Object.assign(owner,{appThemeScheme:scheme,fontScale:()=>2,layoutBudget:()=>({rowForm:'inline'})});
  owner.metadataEllipsisMode=api24?'center':'end';
  owner.verificationRowTextId=()=>undefined;
  const bookSource={sourceId:'s',name:'中英文超长书源 Copyright Free Books 长尾',category:'novel',
    baseUrl:'https://very-long-books.metadata.test/nested/edition.json?sort=title#contents',enabled:true,
    checkMessage:'完整检测失败原因'};
  owner.sourceInfo(bookSource);
  const title=[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create===bookSource.name);
  const domain=[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create==='https://very-long-books.metadata.test');
  assert.ok(title&&domain,'the real source row retains the entire title and domain strings for measurement');
  assert.deepEqual([...owner.nodes.values()].filter(n=>n.type==='Text').map(n=>n.create), [title.create,domain.create],
   'the row exposes only title and host as visible text');
  assert.equal(title.fontSize,14);
  assert.deepEqual([domain.fontFamily,domain.fontWeight,domain.fontSize,domain.lineHeight],
    [role.fontFamily,role.fontWeight,role.fontSizeFp,role.lineHeightFp]);
  assert.equal(domain.fontColor,readerAppColor('TOK_CONTROL_INK',scheme));
  assert.equal(domain.wordBreak,'break-all');
  for (const node of [title,domain]) {
   assert.equal(node.maxFontScale,2);
   assert.equal(node.maxLines,1);
   assert.equal(node.textOverflow.overflow,'ellipsis');
   assert.equal(node.ellipsisMode,api24?'center':'end');
  }
  assert.ok([...owner.nodes.values()].some(n=>n.accessibilityText?.includes(bookSource.baseUrl)),
   'accessibility keeps the full source name and configured URL');
 }
}
for(const id of selectContractCases({'metadata-carriers':'Actual v9 title and scheme/host SDK Text with role mutation, overflow mode and day/night'})){await metadata();recordContractCasePass(id);}
