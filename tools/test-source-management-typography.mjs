import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function metadata() {
 const {loadReaderTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
 const {readerSourceCategoryLabel}=await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
 const read=name=>readFileSync(new URL('../entry/src/main/ets/'+name,import.meta.url),'utf8');
 const roles=loadReaderTypographyRoles(read('features/common/ReaderTypography.ets')),source=read('features/source/SourceManagementPage.ets');
 const original=roles.TYPE_SOURCE_MANAGEMENT_META;
 for(const scheme of ['day','night'])for(const role of [original,{...original,fontFamily:'ReaderTestRole',fontWeight:500,fontSizeFp:original.fontSizeFp+2,lineHeightFp:original.lineHeightFp+3}]) {
  const {owner}=createReaderBuilderProbe(source,['sourceRow'],{...readerFoundationTokens,...roles,TYPE_SOURCE_MANAGEMENT_META:role,readerAppColor,readerSourceCategoryLabel,Alignment:{Center:'center'},VerticalAlign:{Center:'center'},HorizontalAlign:{Start:'start'},TextOverflow:{Ellipsis:'ellipsis'}});
  Object.assign(owner,{appThemeScheme:scheme,contentFrame:()=>({width:320}),detectButton(){},statusBadge(){},statusBadgeBackground(){return '';},statusBadgeDot(){return '';},sourceSwitch(){}});
  const bookSource={sourceId:'s',name:'书源',category:'novel',baseUrl:'https://metadata.test',enabled:true,checkMessage:'检测摘要',checkState:'passed'};owner.sourceRow(bookSource);
  for(const text of [readerSourceCategoryLabel('novel'),bookSource.baseUrl,bookSource.checkMessage]) {
   const node=[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create===text);assert.ok(node,text);
   assert.deepEqual([node.fontFamily,node.fontWeight,node.fontSize,node.lineHeight],[role.fontFamily,role.fontWeight,role.fontSizeFp,role.lineHeightFp]);assert.equal(node.fontColor,readerAppColor('TOK_MUTED',scheme));
  }
 }
}
for(const id of selectContractCases({'metadata-carriers':'Actual category/URL/check-summary SDK Text with role mutation and live day/night'})){await metadata();recordContractCasePass(id);}
