import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'semantic-paragraph':{description:'Actual continuous projection preserves whole Unicode paragraphs and measured native owner',resources:[]},
 'projection-commit':{description:'Actual projection title/interior/prepend semantics and fragment index',resources:[]},
 'viewport-actions':{description:'Continuous session chrome, chapter refresh and bookmark mutation share the current scalar anchor',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
 const {default:assert}=await import('node:assert/strict');
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const {ReadingSurfaceLayoutMap}=await import('../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts');
 const readingDir=new URL('../entry/src/main/ets/features/reading/',import.meta.url);
if(selectedCase==='semantic-paragraph'){
{
  class Fragment { constructor(id,text,isParagraphStart,startScalar,endScalar) {
    Object.assign(this,{id,text,isParagraphStart,startScalar,endScalar});
  }}
  let serial=0;
  const Projection=productionMotionMethods(new URL('ui/LocalReadingExperience.ets',readingDir),['rebuildContinuousFragments'],{
    ReadingSurfacePageFragment:Fragment,readerNativeParagraphKey:()=>`p${++serial}`,
    readerAppearanceLineHeight:()=>30,readerAppearanceSnapshotFontFamily:()=> 'font',
    readerAppearanceThemeStyle:()=>({ink:'#111111'}),readerAppearanceUsesJustify:()=>false,
    readerAppearanceParagraphIndent:()=>36,FontWeight:{Regular:400,Bold:700},TextAlign:{Start:0,JUSTIFY:1,Center:2},
  });
  const text='中文😀 é العربية אבג '.repeat(300),map=new ReadingSurfaceLayoutMap(text);
  let fragments;
  const owner=Object.assign(new Projection(),{chapter:{chapterIndex:2,chapterTitle:'章',content:text},chapterLayoutMap:map,
    visibleFragments:[],visiblePageSelectionToken:0,chapterSelectionToken:1,
    paragraphRanges:[{id:'p',startUtf16:0,endUtf16:text.length,startScalar:0,endScalar:map.scalarCount()}],
    visibleReadingAppearance:()=>({fontSize:18,letterSpacing:0}),continuousImageForRange:()=>undefined,
    measurementTextWidth:()=>320,getUIContext:()=>({px2vp:v=>v,fp2px:v=>v,getFont:()=>({})}),
    readingLayout:()=>({titleLineHeightFp:30}),
    commitContinuousRenderProjection:(_chapter,value)=>{fragments=value;}});
  owner.rebuildContinuousFragments();
  assert.equal(fragments.length,1,'a long semantic paragraph must not be split at 512 UTF16 units');
  assert.equal(fragments[0].nativeParagraph.text,text);
  assert.equal(fragments[0].nativeParagraph.wholeParagraph,true);
  assert.equal(fragments[0].endScalar,map.scalarCount());
  assert.equal(owner.continuousTitleRecipe.text,'章');
  assert.equal(owner.continuousTitleRecipe.style.breakAll,true);
  assert.equal(owner.continuousTitleRecipe.style.fontFamily,fragments[0].nativeParagraph.style.fontFamily);
  assert.equal(owner.continuousTitleRecipe.style.fontWeight,700);
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
const Commit=productionMotionMethods(new URL('ui/LocalReadingExperience.ets',readingDir),
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
if (selectedCase === 'viewport-actions') {
  const Host = productionMotionMethods(new URL('ui/LocalReadingExperience.ets', readingDir), [
    'currentChapterIndex', 'currentReadingViewportStart', 'currentBookmarkViewport',
    'onContinuousVisibleRangeChanged', 'continuousPageChromeSnapshot', 'sessionChromeForPresentation',
    'canRefreshCurrentChapter', 'refreshCurrentChapter', 'currentPageBookmarkStatus',
    'pageBookmarkFeedbackAnchor', 'currentPageBookmarkText', 'toggleCurrentPageBookmark',
  ]);
  const content = '开头😀正文新的位置仍在页内。';
  const actions = [];
  const host = Object.assign(new Host(), {
    sourceId: 'src', bookId: 'book', lifecycleToken: 1, chapterSelectionToken: 1, mounted: true, phase: 'ready',
    chapter: { chapterIndex: 9, content, contentVersion: 'v1', bodyVersion: 'body', processingVersion: 'processed' },
    chapterLayoutMap: new ReadingSurfaceLayoutMap(content),
    readerSettingsSnapshot: { navigationMode: 'continuous' },
    visiblePage: { startScalar: 0, endScalar: 4 },
    continuousFragments: [{ startScalar: 0, endScalar: 4 }, { startScalar: 4, endScalar: 8 },
      { startScalar: 8, endScalar: 12 }, { startScalar: 12, endScalar: 15 }],
    continuousRenderRevision: 1, continuousProgressRevision: 0, continuousChromeProgressText: '',
    bookmarkPendingTarget: '', bookmarkMutationGeneration: 0, bookmarkPresentationRevision: 0,
    hasCurrentMaterializedChapter: () => true, isControlInputEnabled: () => true, bookmarkWriteEnabled: () => true,
    pageChromeStateFrozen: () => false, bookmarkMatchesCurrentChapter: () => true,
    bookmarkFeedbackOwnerKey: () => 'owner',
    resolveVisibleContinuousImages() {}, hasPartialEntryWindow: () => false,
    pauseAutoPage: reason => actions.push(reason),
    selectChapterAnchor: (...args) => actions.push(args),
    pageChromeSnapshot: (chapter, offset, count) => ({ bottomEndText: chapter + ':' + offset + '/' + count }),
    onTogglePageBookmark: value => actions.push(value),
  });
  const entry = { index: 9, title: '正文', bookmarks: [{ time: 1, chapterOffset: 0 }] };
  host.controlDirectoryEntries = () => [entry];
  host.onContinuousVisibleRangeChanged(1, 2, 0.5);
  assert.equal(host.sessionChromeForPresentation(host.continuousChromeProgressText).bottomEndText, `9:6/${[...content].length}`);
  assert.equal(host.currentPageBookmarkStatus(), 'empty', 'the stale first-page bookmark is outside the visible range');
  host.visiblePage = undefined;
  assert.equal(host.canRefreshCurrentChapter(), true, 'continuous mode does not require an admitted paged viewport');
  host.refreshCurrentChapter();
  assert.deepEqual(actions.splice(0), ['touch', [9, 6, false, true, undefined, -2, false, true]]);
  host.toggleCurrentPageBookmark();
  const added = actions.shift();
  assert.deepEqual([added.chapterOffset, added.bookText, added.bookmarkTimes],
    [6, [...content].slice(6, 12).join(''), []]);
  assert.deepEqual(added.positionScope, { sourceId: 'src', bookId: 'book', chapterIndex: 9,
    bodyVersion: 'body', processingVersion: 'processed' });
  host.bookmarkPendingTarget = '';
  entry.bookmarks.push({ time: 2, chapterOffset: 9 }, { time: 3, chapterOffset: 12 });
  assert.equal(host.currentPageBookmarkStatus(), 'bookmarked');
  host.toggleCurrentPageBookmark();
  assert.deepEqual(actions[0].bookmarkTimes, [2], 'the last visible paragraph end is exclusive');
  host.readerSettingsSnapshot.navigationMode = 'paged';
  host.visiblePage = { startScalar: 0, endScalar: 4 };
  assert.equal(host.currentPageBookmarkStatus(), 'bookmarked', 'paged mode retains its physical page range');
  assert.equal(host.currentPageBookmarkText(), [...content].slice(0, 4).join(''));
  host.refreshCurrentChapter();
  assert.deepEqual(actions.at(-1), [9, 0, false, true, undefined, -2, false, true]);
}
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
