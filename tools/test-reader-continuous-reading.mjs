import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReadingSurfaceLayoutMap } from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const stage = await readFile(new URL('ReaderContinuousReadingStage.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');
const surface = await readFile(new URL('ReadingSurface.ets', readingDir), 'utf8');
const settings = await readFile(new URL('ReaderSettingsState.ts', readingDir), 'utf8');

assert.match(settings, /export type ReaderNavigationMode = 'paged' \| 'continuous'/);
assert.match(stage, /List\(\{[^}]*scroller: this\.listScroller[^}]*\}\)/);
assert.match(stage, /initialIndex: this\.initialListIndex\(\)/,
  'List must initially select the prepared target row');
assert.match(stage, /fragmentsProvider: \(\) => ReadingSurfacePageFragment\[\]/,
  'chapter arrays must cross the ArkUI V1 component boundary by live callback');
assert.match(stage, /@Prop @Watch\('onContentRevisionChanged'\) contentRevision: number/,
  'a scalar revision must invalidate the stage after the live array is atomically replaced');
assert.match(stage, /LazyForEach\(this\.fragmentDataSource/);
assert.match(stage, /fragmentDataSource\.update\(changed/,
  'an image-only refresh must notify exactly one lazy row');
const rowKey = stage.match(/private fragmentRenderKey\([\s\S]*?\n  \}/)?.[0];
assert.ok(rowKey);
assert.match(rowKey, /this\.geometryKey/,
  'a changed text layout must replace the native row instead of reusing old line geometry');
assert.match(rowKey, /fragment\.id[\s\S]*imageRevision/,
  'same-layout refreshes preserve unaffected rows and invalidate decoded image placeholders');
assert.doesNotMatch(rowKey, /activeTheme|ink|contentRevision/,
  'color-only changes and unrelated content revisions must not recreate text layout');
assert.doesNotMatch(stage, /\.id\(`\$\{this\.chapterIdentity\}:\$\{this\.contentRevision\}`\)/,
  'same-chapter refreshes must not remount the List and flash at rest');
assert.match(stage, /private onContentRevisionChanged\(\): void \{[\s\S]*changedFragmentIndex[\s\S]*fragmentDataSource\.replace/,
  'content refreshes must update one row when possible and retain full replacement for structural changes');
assert.doesNotMatch(stage, /Repeat\(/,
  'Repeat may retain a stale one-row complex item across chapter replacement');
assert.match(stage, /ReaderNativeParagraphView\(\{/,
  'paged and continuous modes must share the same text, indent, selection, and highlight primitive');
assert.match(stage, /\.onScrollIndex\(/);
assert.match(stage, /\.onScrollStop\(/);
assert.match(stage, /\.onReachStart\(/);
assert.match(stage, /\.onReachEnd\(/);
assert.match(stage, /private handleTouch\(event: TouchEvent\)/,
  'continuous controls must classify the raw pointer sequence');
assert.match(stage, /Math\.abs\(touch\.y - this\.touchStartY\) > CONTINUOUS_TAP_SLOP/,
  'vertical movement must cancel the centre-tap action even at a short chapter boundary');
assert.match(stage, /boundaryDirection === 'next' && this\.isScrollerAtEnd\(\)/,
  'an upward drag may cross chapters only at the actual pixel end, not merely when a long final row is visible');
assert.match(stage, /boundaryDirection === 'previous' && this\.isScrollerAtStart\(\)/,
  'a downward drag may cross chapters only at the actual pixel start');
assert.match(stage, /this\.onBoundaryDrag\('next'\)/,
  'a chapter shorter than the viewport must still expose a next-chapter drag intent');
assert.doesNotMatch(stage, /\.onClick\(/,
  'List click events can be synthesized after an edge drag and must not open reader controls');
assert.match(stage, /\.parallelGesture\(\s*TapGesture\(\{ fingers: 1, count: 1 \}\)/,
  'tap observation must run in parallel with the List native vertical pan recognizer');
assert.doesNotMatch(stage, /\n\s*\.gesture\(/,
  'an exclusive tap recognizer blocks continuous vertical scrolling and long-press selection');
assert.match(stage, /!this\.completedStationaryTouch/,
  'ArkUI tap recognition must be gated by the raw no-movement decision');
assert.match(stage,
  /localX >= this\.layout\.viewportWidth \/ 3[\s\S]*this\.onOpenControl\(\);[\s\S]*return;[\s\S]*this\.onTurn\(localX < this\.layout\.viewportWidth \/ 3 \? 'previous' : 'next'\)/,
  'stationary taps must share the paged left/control/right contract');
assert.match(surface, /export struct ReaderReadingTextFragment/);

assert.match(experience,
  /this\.readerSettingsSnapshot\.navigationMode === 'continuous'[\s\S]*?ReaderContinuousReadingStage\(\{/);
assert.match(experience,
  /fragmentsProvider: \(\): ReadingSurfacePageFragment\[\] => this\.continuousFragments/);
assert.match(experience,
  /ReaderContinuousReadingStage\(\{[\s\S]*onTurn: \(direction: ReaderPageTurnDirection\): ReaderPageTurnOutcome =>[\s\S]*this\.requestPageTurn\(direction\)/,
  'continuous edge taps must enter the same dynamic rapid target as paged modes');
assert.match(experience,
  /if \(this\.readerSettingsSnapshot\.navigationMode !== 'continuous' &&\s*readerPageTransitionUsesPreparedPages\(this\.readerSettingsSnapshot\)/,
  'continuous rapid turns must bypass paged snapshot preparation and reach the live Scroller');
assert.match(experience, /@State private continuousRenderRevision: number = 0/);
assert.match(experience, /continuousImageResolutions: Set<number>/);
assert.match(experience, /chapterImageByStartScalar: Map<number, ReadingSessionImage>/);
assert.match(experience, /continuousFragmentIndexByStartScalar: Map<number, number>/);
assert.doesNotMatch(experience, /@State private continuousVisibleFragmentIndex/,
  'visible range progress must not rebuild the entire continuous reading surface');
assert.doesNotMatch(experience, /@State private continuousVisibleEndFragmentIndex/,
  'visible range end must remain a non-reactive progress cursor');
assert.match(experience,
  /this\.continuousFragments = fragments;[\s\S]*?this\.continuousRenderChapterIdentity =[\s\S]*?this\.continuousRenderChapterTitle = [^;]+;[\s\S]*?this\.continuousRenderRevision \+= 1/,
  'title, identity, and fragment array must be committed before the only reactive revision');
assert.match(experience,
  /interactionEnabled: this\.phase !== 'failed' && this\.sourceSwitchFailureMessage\.length === 0 &&\s*\(this\.readerSettingsSnapshot\.navigationMode === 'paged' \|\|\s*!this\.hasContinuousRenderContent\(\)\) && this\.isReaderPageInteractionEnabled\(\)/,
  'the paged pointer layer must leave recovery buttons and a live List exposed, while preserving centre-control access for a nonfailed empty projection');
assert.match(experience, /navigationMode === 'continuous' &&\s*this\.hasContinuousRenderContent\(\)/,
  'the initial empty-to-ready mode branch must observe the same projection revision as the pointer layer');
assert.match(experience, /if \(navigationChanged && this\.hasCurrentMaterializedChapter\(\)\)/,
  'mode switching during a background measurement must still build the current continuous projection');
assert.match(experience, /this\.continuousScroller\.scrollPage\(\{ next: direction === 'next', animation: !this\.reduceMotion \}\)/);
assert.match(experience, /private onContinuousBoundaryDrag\(direction: 'previous' \| 'next'\)/);
assert.match(experience,
  /direction === 'next' && !this\.isContinuousScrollerAtEnd\(\)[\s\S]*direction === 'previous' && !this\.isContinuousScrollerAtStart\(\)/,
  'the owner must independently reject stale or synthesized boundary intents');
assert.doesNotMatch(experience, /CONTINUOUS_FRAGMENT_MAX_UTF16/,
  'continuous native shaping must preserve original semantic paragraphs');
assert.match(experience, /wholeParagraph: true/);
assert.match(stage, /initialFragmentProgress: number = 0/);
assert.match(stage, /initialAnchorRevision: number = 0/);
assert.match(stage, /\.onAttach\(/);
assert.match(stage, /initialSemanticAnchorProtected = clamped/);
assert.doesNotMatch(stage, /onListAppeared/);
const initialScroll = stage.match(/private tryApplyInitialScroll\([\s\S]*?\n  \}/)?.[0];
assert.ok(initialScroll, 'single-pass initial position application must exist');
assert.match(initialScroll, /scrollToIndex\([\s\S]*extraOffset: LengthMetrics\.vp\(this\.initialScrollOffsetVp\)/,
  'the requested row and its measured native offset must be applied in the same scroll call');
assert.doesNotMatch(initialScroll, /scrollBy|getItemRect/,
  'initial text restoration must not estimate a row fraction or correct a START scroll in a later frame');
const initialConfirmation = stage.match(/private confirmInitialScroll\([\s\S]*?\n  \}/)?.[0];
assert.ok(initialConfirmation);
assert.match(initialConfirmation, /getItemRect\(this\.initialScrollListIndex\)/,
  'save admission requires a real target-row geometry receipt');
assert.match(initialConfirmation, /targetY = rect\.y \+ this\.initialScrollOffsetVp[\s\S]*targetY - this\.layout\.contentTop/,
  'submitting a scroll alone cannot save an unconfirmed position');
assert.doesNotMatch(initialConfirmation, /scrollToIndex|scrollBy/,
  'position confirmation must never become another scroll command');
assert.match(stage, /position\.yForScalar\(scalar\)/,
  'text restoration uses the actual native line instead of a pixel fraction');
assert.match(experience, /private setContinuousInitialAnchor\(scalar: number\)/);
assert.match(experience, /initialFragmentProgress: this\.continuousInitialFragmentProgress/);
assert.match(experience, /private async commitContinuousProgress\(lifecycleToken: number\)/);
assert.match(stage, /class ContinuousFragmentDataSource implements IDataSource/);
assert.match(stage, /LazyForEach\(this\.fragmentDataSource/);
assert.doesNotMatch(stage, /ForEach\(this\.renderFragments\(\)/,
  'long continuous chapters must not eagerly mount every fragment');
assert.match(experience, /this\.activeGateway\(\)\.resolveAndUpdateProgress\(/);
assert.match(experience, /if \(snapshot\.navigationMode === 'continuous'\)/,
  'mode switching must project the current canonical scalar instead of resetting the chapter');
assert.match(experience, /if \(this\.readerSettingsSnapshot\.navigationMode === 'continuous'\) \{\s*return this\.performContinuousPageTurn\(direction\)/,
  'auto-page and volume-key requests must reuse the same continuous page-turn entry');

console.log('reader continuous reading and canonical progress pipeline: PASS');

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

const continuousBranch = experience.slice(experience.indexOf('ReaderContinuousReadingStage({'), experience.indexOf('ReaderPageTurnStage({'));
assert.match(continuousBranch, /onPointerStart:.*this\.acquirePagePointer\(pointerId\)/);
assert.match(continuousBranch, /onPointerEnd:.*this\.releasePagePointer\(pointerId\)/);
assert.match(stage, /@Prop @Watch\('onInteractionEnabledChanged'\) interactionEnabled/);

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
