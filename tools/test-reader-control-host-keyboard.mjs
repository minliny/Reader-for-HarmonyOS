import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes, registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import * as layoutPolicy from '../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';
import { createDefaultReaderAppearanceSnapshot } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import { READER_BOOKMARK_RIBBON_HEIGHT } from '../entry/src/main/ets/features/reading/presentation/ReaderPageBookmarkModel.ts';
import { SEARCH_CONTROL_CLEAR_END_INSET, SEARCH_CONTROL_CLEAR_SLOT } from '../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';
import {
  ReaderInsetsVp, ReaderRectVp, ReaderKeyboardAreaVp, ReaderWindowMetricsSnapshot,
} from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import {
  readerControlMotionBounds, sampleReaderControlMotionComposition,
} from '../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts';
import {
  createReaderControlSessionState, enterReaderControlModule, holdReaderControlSession,
  openReaderControlSession,
} from '../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts';
import {
  consumeReaderControlKeyboardBack, hideReaderControlKeyboard, readerControlKeyboardVisible,
} from '../entry/src/main/ets/ui/foundation/ReaderKeyboardBack.ts';


const selected = selectContractCases({
  'back-owner': 'Actual production keyboard visibility/hide/Back failure handling; normal Host exit order is structural only.',
  'outer-frame': 'Actual LRE binding/methods and pure outer/motion geometry: IME cannot resize shell, repaginate text or reset held/session/query state.',
  'editing-viewport': 'Actual Panel contentEditingHeight against actual full/quick frame and native keyboard rectangles; no native layout claim.',
  'quick-reveal': 'Actual Search minimum/context and Panel reveal keep query plus current results/status/paging usable, without changing Quick/Full; final observation required.',
  'resized-consumers': 'Actual library search and transient-feedback capacity methods consume the measured resized host; native resize is not charged twice.',
});
if(selected.length) {
 registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(u)))return n(u.href,c);}return n(s,c);}});
 const {readerControlStructureKey,readerKeyboardViewport,readerKeyboardHostBottom}=await import('../entry/src/main/ets/ui/layout/ReaderKeyboardGeometry.ts');
 const {ReaderEditingVisibility}=await import('../entry/src/main/ets/ui/layout/ReaderEditingVisibility.ts');
 const {sampleReaderControlSearch}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlSearchGeometry.ts');
 const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url), 'utf8');
function productionMethod(name) {
  const start = source.indexOf(`  private ${name}(`);
  assert.ok(start >= 0, `production ${name} method exists`);
  let end = source.indexOf('{', start) + 1;
  let depth = 1;
  while (depth > 0 && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return source.slice(start, end);
}

 for(const id of selected) {
  if(id==='back-owner') {
const hidden = { ready: true, keyboardInsets: { left: 0, top: 0, right: 0, bottom: 0 } };
const visible = { ready: true, keyboardInsets: { left: 0, top: 0, right: 0, bottom: 280 } };
assert.equal(readerControlKeyboardVisible(hidden), false);
assert.equal(readerControlKeyboardVisible(visible), true);
assert.equal(readerControlKeyboardVisible({ ...visible, ready: false }), false);
for (const side of ['left', 'top', 'right', 'bottom']) {
  assert.equal(readerControlKeyboardVisible({ ready: true, keyboardInsets: {
    ...hidden.keyboardInsets, [side]: 1,
  } }), true);
}
for (const value of [-1, NaN, Infinity, -Infinity]) {
  assert.equal(readerControlKeyboardVisible({ ready: true, keyboardInsets: {
    left: value, top: value, right: value, bottom: value,
  } }), false);
}

let requests = 0;
const failures = [];
const host = { hideTextInput: async () => { requests++; }, onFailure: error => failures.push(error) };
const session = Object.freeze({ page: 'fullSearch', query: 'retained', closeRevision: 7 });
assert.equal(consumeReaderControlKeyboardBack(visible, host), true);
assert.equal(requests, 1);
// Input focus can remain; the next actual zero-inset snapshot admits route Back.
assert.equal(consumeReaderControlKeyboardBack(hidden, host), false);
assert.equal(requests, 1);
assert.deepEqual(session, { page: 'fullSearch', query: 'retained', closeRevision: 7 });
hideReaderControlKeyboard(host);
assert.equal(requests, 2, 'complete close requests IME hide even without a visible-inset snapshot');

const synchronous = new Error('controller unavailable');
assert.equal(consumeReaderControlKeyboardBack(visible, {
  hideTextInput: () => { throw synchronous; }, onFailure: error => failures.push(error),
}), true);
assert.strictEqual(failures[0], synchronous);
const asynchronous = new Error('client detached');
assert.equal(consumeReaderControlKeyboardBack(visible, {
  hideTextInput: async () => { throw asynchronous; }, onFailure: error => failures.push(error),
}), true);
await Promise.resolve();
await Promise.resolve();
assert.strictEqual(failures[1], asynchronous);
assert.equal(consumeReaderControlKeyboardBack(hidden, host), false,
  'a failed request cannot latch a permanent focus-based Back lock');

// Structural wiring only; platform IME interaction remains a device gate.

const back = productionMethod('requestExit');
const consume = back.indexOf('consumeReaderControlKeyboardBack');
for (const lowerOwner of ['this.controlTemporaryLayer', 'backReaderControlHostSession', 'this.beginExit()']) {
  assert.ok(consume >= 0 && back.indexOf(lowerOwner) > consume, `visible IME handles Back before ${lowerOwner}`);
}
assert.match(back, /ReaderWindowCoordinator\.metrics\(\), this\.controlKeyboardHost\(\)/);
const hideVisibleKeyboard = /if \(readerControlKeyboardVisible\(ReaderWindowCoordinator\.metrics\(\)\)\)\s*\{\s*hideReaderControlKeyboard\(this\.controlKeyboardHost\(\)\);\s*\}/;
const close = productionMethod('hideControl');
assert.match(close, hideVisibleKeyboard);
assert.ok(close.search(hideVisibleKeyboard) < close.indexOf('dismissReaderControlSession'));
const commit = productionMethod('onControlSessionChanged');
const committed = commit.indexOf('if (!readerControlHostCloseCommitted(');
assert.ok(committed >= 0 && commit.search(hideVisibleKeyboard) > committed);
assert.match(productionMethod('controlKeyboardHost'), /inputMethod\.getController\(\)\.hideTextInput\(\)/);
assert.doesNotMatch(source, /\.hideSoftKeyboard\(/);


  }
  if(id==='outer-frame') {
const layoutMethods = ['effectiveViewportWidth', 'effectiveViewportHeight', 'readingLayout',
  'controlLayout', 'windowMetricsLayoutKey', 'onWindowMetricsRevisionChanged',
  'reflowAfterWindowGeometryChange', 'bookmarkFeedbackTopBoundary', 'bookmarkRibbonPaperTop',
  'currentControlStructureKey', 'refreshControlEditingEnvironment', 'reconcileSessionLaunchLayout'].map(productionMethod).join('\n');
const makeMetrics = keyboardBottom => new ReaderWindowMetricsSnapshot(
  new ReaderRectVp(0, 0, 1320 / 3.5, 816), new ReaderRectVp(0, 0, 1320 / 3.5, 816),
  new ReaderInsetsVp(), new ReaderInsetsVp(), new ReaderInsetsVp(),
  new ReaderInsetsVp(0, 0, 0, 28), new ReaderInsetsVp(0, 0, 0, keyboardBottom),
  3.5, 1, keyboardBottom > 0 ? 1 : 2, true);
let currentMetrics = makeMetrics(314);
const deps = { ...layoutPolicy, readerControlStructureKey, READER_BOOKMARK_RIBBON_HEIGHT,
  readerPageChromeTopTextStyle:()=>({}), measureReaderPageChromeText:()=>({height:0}),
  ReaderWindowCoordinator: { metrics: () => currentMetrics } };
const LayoutHost = new Function(...Object.keys(deps),
  `${stripTypeScriptTypes(`class LayoutHost { ${layoutMethods} }`)}; return LayoutHost;`)(...Object.values(deps));
const panelStart = source.indexOf('      ReaderControlPanel({');
assert.ok(panelStart >= 0);
const binding = source.slice(panelStart).match(/\blayout: ([^\n]+),/);
assert.ok(binding, 'actual Panel layout binding exists');
const readBinding = new Function(`return function() { return ${binding[1]}; };`)();
const layoutHost = new LayoutHost();
Object.assign(layoutHost, {
  controlMinimumGeneration:0, scheduleControlMinimum() {}, mounted: true, viewportWidth: 1320 / 3.5, viewportHeight: 816, expandedLayout: false,
  readerSettingsSnapshot: { extendIntoCutout: false, navigationMode: 'paged', hideStatusBar: false }, pageTurnSettlementLayout: undefined,
  appearanceSnapshot: createDefaultReaderAppearanceSnapshot(),
  pageTurnInputPhase: () => 'idle', sessionCapsuleMetrics:()=>({paintHeight:24}), getUIContext:()=>({}), chromeCalls: 0,
  applyWindowChrome() { this.chromeCalls++; },
  invalidatePageTurnRuntime() { assert.fail('keyboard-only change must not repaginate reading text'); },
  controlSession: holdReaderControlSession(enterReaderControlModule(
    openReaderControlSession(createReaderControlSessionState(), 0), 'search', 0), 9),
  quickSearchQuery: '他', quickSearchState: { kind: 'ready', results: ['retained'] },
});
let revisionWasRead = false;
Object.defineProperty(layoutHost, 'readerWindowMetricsRevision', {
  get() { revisionWasRead = true; return currentMetrics.revision; },
});
const keyboardLayout = readBinding.call(layoutHost);
assert.equal(keyboardLayout.fullPanelHeight, layoutPolicy.resolveReaderControlLayout(1320 / 3.5, 816, false, makeMetrics(0)).fullPanelHeight, 'IME cannot shrink the same normal outer frame');
assert.equal(revisionWasRead, true,
  'Panel binding must subscribe to metrics revision even when reading viewport/key stays unchanged');
layoutHost.lastWindowMetricsLayoutKey = layoutHost.windowMetricsLayoutKey();
const previousReadingKey = layoutHost.lastWindowMetricsLayoutKey;
const heldIdentity = layoutHost.controlSession;
currentMetrics = makeMetrics(0);
layoutHost.onWindowMetricsRevisionChanged();
assert.equal(layoutHost.windowMetricsLayoutKey(), previousReadingKey,
  'IME is an interactive inset, not a reading-pagination change');
assert.equal(layoutHost.chromeCalls, 1);
const restoredLayout = readBinding.call(layoutHost);
assert.equal(restoredLayout.fullPanelHeight, keyboardLayout.fullPanelHeight,
  'the same binding restores the phone-ratio full endpoint within the 700vp budget');
assert.strictEqual(layoutHost.controlSession, heldIdentity, 'layout refresh cannot reset session/held ownership');
assert.equal(layoutHost.controlSession.heldPointerId, 9);
assert.equal(layoutHost.quickSearchQuery, '他');
assert.deepEqual(layoutHost.quickSearchState.results, ['retained']);
function quickContentScreenPx(layout) {
  const frame = sampleReaderControlMotionComposition({ expansionProgress: 0, visibilityProgress: 1 },
    readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight, layout.dockBottomGap,
      layout.quickPanelHeight));
  return (layout.viewportHeight - layout.dockBottomGap - layout.fullPanelHeight + frame.content.y) * 3.5;
}
const originalQuickY = quickContentScreenPx(keyboardLayout);
const restoredQuickY = quickContentScreenPx(restoredLayout);
assert.ok(Math.abs(restoredQuickY - originalQuickY) < 1e-6,
  'production geometry restores Quick to the bottom at ' + restoredQuickY);

  }
  if(id==='editing-viewport'||id==='quick-reveal') {
    const panelSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets',import.meta.url),'utf8');
    function panelMethod(name) {
      const start=panelSource.indexOf('  private '+name+'(');assert(start>=0,name);
      let end=panelSource.indexOf('{',start)+1,depth=1;
      while(depth){if(panelSource[end]==='{')depth++;if(panelSource[end]==='}')depth--;end++;}
      return panelSource.slice(start,end);
    }
    const metrics=new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,1320/3.5,816),undefined,
      new ReaderInsetsVp(),new ReaderInsetsVp(),new ReaderInsetsVp(),new ReaderInsetsVp(0,0,0,28),
      new ReaderInsetsVp(0,0,0,314),3.5,1,1,true);
    metrics.keyboardArea=new ReaderKeyboardAreaVp(true,true,[new ReaderRectVp(0,502,1320/3.5,314)]);
    const layout=layoutPolicy.resolveReaderControlLayout(1320/3.5,816,false,metrics);
    const readerWindowMetrics=()=>metrics;
    const deps={readerWindowMetrics,readerKeyboardViewport,readerControlKeyboardVisible,ReaderRectVp};
    const Host=new Function(...Object.keys(deps),stripTypeScriptTypes('class Host {'+
      ['presentedDockTop','contentEditingHeight','editingRevealRegion','mountEditingHost'].map(panelMethod).join('\n')+'}')+';return Host;')(...Object.values(deps));
    const owner=Object.assign(new Host(),{runtimeMounted:true,inputEnabled:true,controlObscured:false,
      rootScreenX:0,rootScreenY:0,editingOffsetY:0,editingHost:new ReaderEditingVisibility(),
      currentLayout:()=>layout,dockLeft:()=>0,dockTop:()=>layout.viewportHeight-layout.dockBottomGap-layout.fullPanelHeight,
      reportBackdropRegions(){},});
    let p=id==='quick-reveal'?0:1;
    owner.frame=()=>sampleReaderControlMotionComposition({expansionProgress:p,visibilityProgress:1},
      readerControlMotionBounds(layout.fullPanelWidth,layout.fullPanelHeight,layout.dockBottomGap,layout.quickPanelHeight));
    if(id==='editing-viewport') {
      const f=owner.frame(),top=owner.dockTop()+f.content.y;
      assert(Math.abs(owner.contentEditingHeight()-Math.max(0,Math.min(top+f.content.height,502)-top))<1e-6);
      assert.equal(owner.editingOffsetY,0,'visible Full input does not shift the shell');
      const task=new ReaderRectVp(30,top+20,200,100);
      assert.strictEqual(owner.editingRevealRegion(task),task,'Full cannot fit above the keyboard; its module task remains authoritative');
    } else {
      const {selectedProductionMethods,selectedProductionComponentCallback,selectedProductionClasses}=await import('./lib/selected-production-methods.mjs');
      const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
      const {readerTypographyRoles,readerMessageStyles}=await import('./lib/reader-typography-probe.mjs');
      const typography=selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets',import.meta.url),['ReaderTextStyle','ReaderInheritedTextStyle']);
      const measure=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlTextMeasurement.ets',import.meta.url),'utf8'),
        'ReaderControlTextMeasurement.ets',{WordBreak:{BREAK_WORD:'break'}},['measureReaderControlText']);
      const searchMinimum=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlSearchMinimum.ets',import.meta.url),'utf8'),
        'ReaderControlSearchMinimum.ets',{...readerTypographyRoles,...readerMessageStyles,...typography,...measure,
          SEARCH_CONTROL_CLEAR_END_INSET, SEARCH_CONTROL_CLEAR_SLOT, sampleReaderControlSearch},
        ['measureReaderSearchMinimum','readerControlSearchMinimumFacts']);
      const advance=o=>Math.max(1,[...o.textContent].length*Number.parseFloat(o.fontSize));
      const measureContext={px2vp:v=>v,getMeasureUtils:()=>({measureText:advance,
        measureTextSize:o=>({width:Math.min(advance(o),o.constraintWidth),height:Number.parseFloat(o.lineHeight??o.fontSize)*
          (o.maxLines===1?1:Math.ceil(advance(o)/o.constraintWidth))})})};
      const Search=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlSearchContent.ets',import.meta.url),
        'ReaderControlSearchContent',['queryEditingContext'],{ReaderRectVp});
      const search=new Search();
      const result={chapterTitle:'当前章节',snippet:'这是搜索结果正文',chapterIndex:0,chapterOffset:0};
      const states=[{kind:'idle'},{kind:'loading',keyword:'阅读'},{kind:'empty',keyword:'阅读'},
        {kind:'error',message:'搜索失败，请重试'},
        {kind:'results',keyword:'阅读',results:[result],hasMore:false},
        {kind:'results',keyword:'阅读',results:[result],hasMore:true,loadMoreError:'加载失败'}];
      for(const state of states) {
      owner.editingOffsetY=0;
      const f=owner.frame(),width=f.content.width;
      const facts=searchMinimum.readerControlSearchMinimumFacts({query:'阅读',state,retainedLoadMoreFailure:true});
      const profile=searchMinimum.measureReaderSearchMinimum(measureContext,
        {panelWidthVp:width+26,quickContentWidthVp:width,fullContentWidthVp:width},facts);
      assert(profile?.quick.minimum.fits,'actual current-state minimum is available');
      search.currentMinimumProfile=()=>profile;search.motionProgress=0;search.availableWidth=width;
      search.frame=()=>sampleReaderControlSearch(0,width,owner.contentEditingHeight(),profile.quick.natural);
      const contextPort=selectedProductionComponentCallback(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlSearchContent.ets',import.meta.url),
        'ReaderFormField','editingContext',search);
      const frames=[];
      const field=()=>{const f=owner.frame(),q=search.frame().field,h=profile.quick.natural.inputHeightVp;
        return new ReaderRectVp(q.x+9,owner.presentedDockTop()+f.content.y+q.y+(q.height-h)/2,q.width-18,h);};
      const before=field();assert(before.top+before.height>502,'actual Quick query is covered before reveal');
      owner.mountEditingHost();owner.editingHost.focus({id:'quick-native-port',current:()=>true,
        measure:()=>({field:field(),context:contextPort(field())}),revealText(){},afterLayout(action){frames.push(action);return true;}});
      let count=0;while(frames.length){assert(++count<8,'bounded reveal');frames.shift()();}
      assert(owner.editingOffsetY<0);assert(field().top+field().height<=494.01);
      const context=contextPort(field());
      assert(context.top+context.height<=494.01,'current result/status/paging minimum is also above IME: '+state.kind);
      assert(owner.contentEditingHeight()+.01>=profile.quick.minimum.heightVp,'actual result viewport receives its semantic capacity');
      assert.equal(owner.editingHost.capacity,'visible');
      const shell=owner.frame().shell;
      assert(owner.presentedDockTop()+shell.y+shell.height<=494.01,'when it fits, the entire Quick surface clears the keyboard');
      assert.equal(search.motionProgress,0,'IME never silently changes the selected form');
      }
      assert.equal(layout.fullPanelHeight,layoutPolicy.resolveReaderControlLayout(1320/3.5,816,false,metrics).fullPanelHeight);
    }
  }
  if(id==='resized-consumers') {
    const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,390,800),undefined,
      new ReaderInsetsVp(),new ReaderInsetsVp(),new ReaderInsetsVp(),new ReaderInsetsVp(),
      new ReaderInsetsVp(0,0,0,300),3.5,1,1,true);
    metrics.keyboardArea = new ReaderKeyboardAreaVp(true,true,[new ReaderRectVp(0,500,390,300)]);
    const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
    const Toast=selectedProductionMethods(new URL('../entry/src/main/ets/ui/feedback/ReaderTransientToast.ets',import.meta.url),
      'ReaderTransientToast',['toastBottomInset'],{readerWindowMetrics:()=>metrics,readerKeyboardHostBottom});
    const toast=Object.assign(new Toast(),{metricsRevision:1,bounded:false,editingHostHeight:500,editingHostY:0});
    assert.equal(toast.toastBottomInset(),52,'resized host already ends above IME');
    toast.editingHostHeight=800;assert.equal(toast.toastBottomInset(),316,'unresized host reserves actual remaining occlusion');
    const Library=selectedProductionMethods(new URL('../entry/src/main/ets/features/search/ui/ReaderLibrarySearchSurface.ets',import.meta.url),
      'ReaderLibrarySearchSurface',['surfaceHeight','availableBottom'],{ReaderWindowCoordinator:{metrics:()=>metrics},readerKeyboardHostBottom});
    const library=Object.assign(new Library(),{metricsRevision:1,surfaceWindowY:100,surfaceViewportHeight:300});
    assert.equal(library.surfaceHeight(),300);assert.equal(library.availableBottom(),300,'a smaller actual nested host is not replaced by window height');
    library.surfaceViewportHeight=700;assert.equal(library.availableBottom(),400,'window-space keyboard top is normalized to the offset host');
  }
  recordContractCasePass(id);
 }
 console.log('Boundary: actual Host/Panel methods with finite frame/native-rectangle/scroll ports; no native focus/IME/VM.');
}
