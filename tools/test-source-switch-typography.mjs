import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function designRoles(){
 const {loadReaderTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const fontFamilies=await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
 const typographySource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets',import.meta.url),'utf8');
 const design=JSON.parse(readFileSync(new URL('../../Reader-UI/design/source-switch/source-switch.visual.json',import.meta.url))); 
const roleKeys = {
  HEADING: 'title', BOOK_TITLE: 'bookTitle', METADATA: 'author', CAPTION: 'metadata',
  COLUMN: 'column', ACTION: 'discoveryAction', ACTION_COMPACT: 'discoveryAction',
  CURRENT_SOURCE: 'currentSource', DISCOVERY_COUNT: 'discoveryCount', DISCOVERY_PHASE: 'discoveryPhase', DISCOVERY_STATUS: 'discoveryStatus',
  DISCOVERY_STATUS_NARROW: 'narrowDiscoveryStatus', NAME: 'sourceName', CHAPTER: 'latestChapter',
  LATENCY: 'timing', LATENCY_UNIT: 'timingUnit', FOOTER: 'footer', EMPTY: 'empty',
  SWITCH_TITLE: 'switchTitle', SWITCH_SOURCE: 'switchSource', SWITCH_STATUS: 'switchStep', SWITCH_CAPTION: 'switchCaption', TOAST: 'toast',
};
const novelTuples = Object.entries(roleKeys).map(([name, key]) => {
  const weight = design.numbers[key + 'FontWeight'] ?? design.numbers.discoveryStatusFontWeight;
  const cssFamily = name === 'HEADING' || name === 'BOOK_TITLE' || name === 'SWITCH_TITLE' ? design.strings.titleFontFamilyCss :
    name.startsWith('LATENCY') || name === 'DISCOVERY_COUNT' ? design.strings.timingFontFamilyCss : design.strings.bodyFontFamilyCss;
  const asset = design.fontAssets.find(font => font.cssFamily === cssFamily &&
    (font.weight === weight || (name === 'DISCOVERY_COUNT' && font.supportedWeights?.includes(weight))));
  assert.ok(asset, 'selected physical face for ' + name);
  if(name==='DISCOVERY_COUNT')assert.deepEqual(asset.supportedWeights,[400,500],'only the approved Inter axes share this physical font');
  return [name, fontFamilies[asset.nativeFamilyConstant], weight,
    name==='ACTION_COMPACT'?design.numbers.compactDiscoveryActionFontSize:design.numbers[key + 'FontSize'], design.numbers[key + 'LineHeight']];
});

 const roles=loadReaderTypographyRoles(typographySource);
 for(const [name,fontFamily,fontWeight,fontSizeFp,lineHeightFp] of novelTuples)assert.deepEqual({...roles['TYPE_SOURCE_SWITCH_NOVEL_'+name]},{fontFamily,fontWeight,fontSizeFp,lineHeightFp,letterSpacingFp:undefined,scalePolicy:'system',source:'appBaseline'},name+' selected design record');
}
async function candidateRoles(){
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {boundedMembers,boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const {readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
 const source=readFileSync(new URL('../entry/src/main/ets/features/source/CandidateRow.ets',import.meta.url),'utf8');
 for(const mutate of [false,true]){
  const roles={...readerTypographyRoles};for(const key of ['TYPE_SOURCE_SWITCH_NAME','TYPE_SOURCE_SWITCH_LATENCY','TYPE_SOURCE_SWITCH_CHAPTER'])if(mutate)roles[key]={...roles[key],fontFamily:'Probe-'+key,fontSizeFp:17,fontWeight:600,lineHeightFp:26};
  const latency=readFileSync(new URL('../entry/src/main/ets/features/source/LatencyBar.ets',import.meta.url),'utf8');
  const p=boundedSurfaceSdk();const latencyDeps={...p.deps,...readerFoundationTokens,readerAppColor,Alignment:{TopStart:'start'}};
  const LatencyBar=createReaderBuilderProbe(latency,boundedMembers(latency),latencyDeps,p.hooks).Component;
  const {owner}=createReaderBuilderProbe(source,boundedMembers(source),{...p.deps,...readerFoundationTokens,...roles,readerAppColor,LatencyBar,LATENCY_TEXT_W:28,CHAPTER_TEXT_W:100,VerticalAlign:{Center:'center'},TextAlign:{End:'end'},TextOverflow:{Ellipsis:'ellipsis'}},{...p.hooks,mountChildren:true,childSources:{...p.hooks.childSources,LatencyBar:latency}});
  Object.assign(owner,{appThemeScheme:'day',sourceName:'source',bookName:'book',currentChapterTitle:'chapter',latencyMs:38,isCurrent:false,offline:false,timeout:false});owner.initialRender();
  for(const [text,key] of [['source','NAME'],['38ms','LATENCY'],['chapter','CHAPTER']]){const node=[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create===text);assert.ok(node,text);const r=roles['TYPE_SOURCE_SWITCH_'+key];assert.deepEqual([node.fontFamily,node.fontWeight,node.fontSize,node.lineHeight],[r.fontFamily,r.fontWeight,r.fontSizeFp,r.lineHeightFp]);}
 }
}
for(const id of selectContractCases({'design-roles':'Independent selected source-switch design record → semantic roles','candidate-roles':'Actual compact CandidateRow role propagation with mutation'})){await ({'design-roles':designRoles,'candidate-roles':candidateRoles})[id]();recordContractCasePass(id);}
