import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'semantic-paragraph':{description:'Actual continuous projection preserves whole Unicode paragraphs and measured native owner',resources:[]},
 'projection-commit':{description:'Actual projection title/interior/prepend semantics and fragment index',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
 const {default:assert}=await import('node:assert/strict');
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const {ReadingSurfaceLayoutMap}=await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
 const readingDir=new URL('../entry/src/main/ets/features/reading/',import.meta.url);
if(selectedCase==='semantic-paragraph'){
{
  class Fragment { constructor(id,text,isParagraphStart,startScalar,endScalar) {
    Object.assign(this,{id,text,isParagraphStart,startScalar,endScalar});
  }}
  let serial=0;
  const Projection=productionMotionMethods(new URL('LocalReadingExperience.ets',readingDir),['rebuildContinuousFragments'],{
    ReadingSurfacePageFragment:Fragment,readerNativeParagraphKey:()=>`p${++serial}`,
    readerAppearanceLineHeight:()=>30,readerAppearanceSnapshotFontFamily:()=> 'font',
    readerAppearanceThemeStyle:()=>({ink:'#111111'}),readerAppearanceUsesJustify:()=>false,
    readerAppearanceParagraphIndent:()=>36,FontWeight:{Regular:400},TextAlign:{Start:0,JUSTIFY:1},
    TYPE_READER_CHAPTER_TITLE:{fontFamily:'font',fontWeight:500,fontSizeFp:22},
  });
  const text='中文😀 é العربية אבג '.repeat(300),map=new ReadingSurfaceLayoutMap(text);
  let fragments;
  const owner=Object.assign(new Projection(),{chapter:{chapterIndex:2,chapterTitle:'章',content:text},chapterLayoutMap:map,
    visibleFragments:[],visiblePageSelectionToken:0,chapterSelectionToken:1,
    paragraphRanges:[{id:'p',startUtf16:0,endUtf16:text.length,startScalar:0,endScalar:map.scalarCount()}],
    visibleReadingAppearance:()=>({fontSize:18,letterSpacing:0}),continuousImageForRange:()=>undefined,
    measurementTextWidth:()=>320,getUIContext:()=>({px2vp:v=>v,fp2px:v=>v}),
    readingLayout:()=>({titleLineHeightFp:30}),
    commitContinuousRenderProjection:(_chapter,value)=>{fragments=value;}});
  owner.rebuildContinuousFragments();
  assert.equal(fragments.length,1,'a long semantic paragraph must not be split at 512 UTF16 units');
  assert.equal(fragments[0].nativeParagraph.text,text);
  assert.equal(fragments[0].nativeParagraph.wholeParagraph,true);
  assert.equal(fragments[0].endScalar,map.scalarCount());
  assert.equal(owner.continuousTitleRecipe.text,'章');
  assert.equal(owner.continuousTitleRecipe.style.breakAll,true);
  owner.visiblePageSelectionToken=1;
  owner.visibleFragments=[{nativeParagraph:{key:'already-shaped',startScalar:0,text}}];
  owner.rebuildContinuousFragments();
  assert.equal(fragments[0].nativeParagraph.key,'already-shaped',
    'the first continuous viewport adopts the same measured native paragraph owner');
  const original = fragments[0];
  owner.continuousFragments=fragments;
  owner.paragraphRanges[0].id='new-local-index';
  owner.rebuildContinuousFragments(true);
  assert.equal(fragments[0],original,'same-version expansion retains the exact visible object and native owner');

}


}
if(selectedCase==='projection-commit'){
const Commit=productionMotionMethods(new URL('LocalReadingExperience.ets',readingDir),
 ['commitContinuousRenderProjection','rebuildContinuousFragmentIndex','continuousFragmentIndexForScalar']);
{
 const owner=Object.assign(new Commit(),{continuousFragmentIndexByStartScalar:new Map(),continuousVisibleScalar:45,continuousRenderRevision:0,
  paginationLayoutSignature:()=> 'layout-v1'});
 const fragment={startScalar:40,endScalar:60};
 owner.commitContinuousRenderProjection({chapterIndex:2,chapterTitle:'标题',contentVersion:'v',documentRange:{startScalar:40}},[fragment]);
 assert.equal(owner.continuousRenderChapterTitle,'','a window cannot invent a chapter title at its interior edge');
 assert.equal(fragment.continuousSpaceBefore,true);
 owner.commitContinuousRenderProjection({chapterIndex:2,chapterTitle:'标题',contentVersion:'v'},[{startScalar:0,endScalar:30},fragment]);
 assert.equal(owner.continuousRenderChapterTitle,'标题');assert.equal(owner.continuousVisibleFragmentIndex,1);
 assert.equal(fragment.continuousSpaceBefore,true,'prepending leaves the original paragraph geometry unchanged');
}

}
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
