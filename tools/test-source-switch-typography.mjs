import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function designRoles(){
 const {loadReaderTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const fontFamilies=await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
 const typographySource=readFileSync(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets',import.meta.url),'utf8');
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
  const nativeFamily = weight === 400 ? fontFamilies.READER_FONT_NOTO_SANS_SC_UI_REGULAR :
    weight === 500 ? fontFamilies.READER_FONT_NOTO_SANS_SC_UI_MEDIUM :
      weight === 700 ? fontFamilies.READER_FONT_NOTO_SANS_SC_UI_BOLD : undefined;
  assert.ok(nativeFamily, 'HarmonyOS UI face for ' + name);
  return [name, nativeFamily, weight,
    name==='ACTION_COMPACT'?design.numbers.compactDiscoveryActionFontSize:design.numbers[key + 'FontSize'], design.numbers[key + 'LineHeight']];
});

 const roles=loadReaderTypographyRoles(typographySource);
 for(const [name,fontFamily,fontWeight,fontSizeFp,lineHeightFp] of novelTuples)assert.deepEqual({...roles['TYPE_SOURCE_SWITCH_NOVEL_'+name]},{fontFamily,fontWeight,fontSizeFp,lineHeightFp,letterSpacingFp:undefined,scalePolicy:'system',source:'appBaseline'},name+' selected design record');
}
async function candidateRoles(){
 const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {sourceSwitchLiveSdk}=await import('./lib/source-switch-sdk-consumer.mjs');
 const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const carriers=[['source','NAME'],['38','LATENCY'],[' ms','LATENCY_UNIT'],['chapter','CHAPTER']];
 for(const mutate of [false,true]){
  const roles={};
  for(const [,suffix] of carriers){
   const key='TYPE_SOURCE_SWITCH_NOVEL_'+suffix,role=readerTypographyRoles[key];
   roles[key]=mutate?{...role,fontFamily:'Probe-'+key,fontSizeFp:17,fontWeight:600,lineHeightFp:26}:role;
  }
  const p=boundedSurfaceSdk(),deps=sourceSwitchLiveSdk(p,roles);
  const row=new deps.SourceSwitchCandidateRow({sourceId:'fixture-source',bookUrl:'/book',sourceName:'source',
   latestChapterTitle:'chapter',latencyKind:'search',latencyMs:38});
  const owner=new deps.SourceSwitchNovelRow(undefined,{row,reduceMotion:true});owner.initialRender();
  for(const [label,suffix] of carriers){
   const node=p.nodes(owner).find(n=>n.type==='Text'&&n.create===label);assert.ok(node,label);
   const role=roles['TYPE_SOURCE_SWITCH_NOVEL_'+suffix];
   assert.deepEqual([node.fontFamily,node.fontWeight,node.fontSize,node.lineHeight],[role.fontFamily,role.fontWeight,role.fontSizeFp,role.lineHeightFp]);
  }
 }
}
for(const id of selectContractCases({'design-roles':'Independent selected source-switch design record → semantic roles','candidate-roles':'Live source-switch drawer row role propagation with mutation'})){await ({'design-roles':designRoles,'candidate-roles':candidateRoles})[id]();recordContractCasePass(id);}
