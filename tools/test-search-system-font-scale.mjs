import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"field": {"description": "实际SearchField实时字体缩放、vp frame增长与IME/无效scale回落", "resources": []}, "action": {"description": "实际有限search action随scale增高、原生事件与卸载拒绝", "resources": []}, "header": {"description": "实际SearchPage状态/宽度/字体变化使测量key失效并接纳当前测量", "resources": []}, "card": {"description": "实际result card封面几何、字体缩放读取及长元数据有界省略", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { resolve } = await import('node:path');
const {createHash} = await import('node:crypto');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { tailControls, compileTailConsumer } = await import('./lib/foundation-tail-consumer-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { bookIntroText } = await import('../entry/src/main/ets/features/common/BookIntroText.ts');
const { bookAuthorLabel } = await import('../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const { SEARCH_RESULT_GEOMETRY } = await import('../entry/src/main/ets/features/search/SearchResultGeometry.ts');
const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');

const read=path=>readFileSync(new URL('../entry/src/main/ets/features/'+path,import.meta.url),'utf8');
const pageSource=read('search/SearchPage.ets'), fieldSource=read('common/ReaderSearchField.ets'),buttonSource=read('common/ReaderButton.ets');
let scale=1;
const windowMetrics=()=>({systemFontScale:scale});
const shared=foundationControls({windowMetrics,buttonSource});
const controls=tailControls({foundation:shared});
const dependencies={...controls.dependencies,ReaderWindowCoordinator:{metrics:windowMetrics}};
let count=0;
// Run the actual native input Builder and its production field/input geometry.
// fp tuples remain base units: ArkUI scales glyphs, while vp boxes grow once.
if(selectedCase==='field'){
const field=compileTailConsumer(fieldSource,boundedMembers(fieldSource),dependencies,shared.hooks).owner;
Object.assign(field,{variant:'bookPage',mode:'submit',text:'大明望族',placeholder:'搜索书名、作者...',clearable:true,
 readerWindowMetricsRevision:0,isTablet:false,appThemeScheme:'day',onTextChange:v=>{field.text=v;},onSubmit:()=>count++});
field.aboutToAppear();field.initialRender();
for(const tablet of [false,true])for(const fontScale of [2,1,1.3,1.75,3.2]){
 scale=fontScale;field.isTablet=tablet;field.readerWindowMetricsRevision++;
 field.replay();
 const height=field.fieldHeight();assert.ok(Number.isFinite(height)&&height>0);if(fontScale>1){scale=1;const base=field.fieldHeight();scale=fontScale;assert.ok(height>base,'large native glyphs require a larger vp box');}
 assert.equal(field.fieldHeight(),height,'book input vp frame must grow with the native fp line');
 const row=[...field.nodes.values()].find(n=>n.type==='Row'),input=[...field.nodes.values()].find(n=>n.type==='TextInput');
 assert.equal(row.height,height);assert.equal(input.height,height-field.fieldBorderWidth()*2,'native input stays inside the authored field border');assert.equal(input.fontSize,readerTypographyRoles.TYPE_SEARCH_BOOK_INPUT.fontSizeFp);assert.equal(input.lineHeight,readerTypographyRoles.TYPE_SEARCH_BOOK_INPUT.lineHeightFp);
 assert.equal(input.minFontScale,1);assert.equal(input.maxFontScale,fontScale);
 
 input.onSubmit('Enter');
}
assert.equal(count,10,'IME submit survives each scale/device change');for(const invalid of [NaN,Infinity,0,-1]){scale=invalid;assert.equal(field.bookFontScale(),1);}
}
// The finite search Button family shares the existing native action and
// half-leading alignment. Other common Button variants retain their tuples.
if(selectedCase==='action')for(const tablet of [false,true])for(const fontScale of [1,1.3,1.75,2,3.2])for(const busy of [false,true]){
 scale=fontScale;const component=shared.button.Component;
 const button=new component(undefined,{scheme:'day',specId:tablet?'search-field-wide':'search-field-phone',label:busy?'停止':'搜索',
  actionEnabled:true,isBusy:busy,leading(){},onAction:()=>count++},undefined,100+count);
 button.aboutToAppear();button.initialRender();
 const native=shared.nodes(button).find(n=>n.onClick),label=shared.nodes(button).find(n=>n.type==='Text');
 const measured=native.height;assert.ok(Number.isFinite(measured)&&measured>0);if(fontScale>1){scale=1;button.replay();const base=shared.nodes(button).find(n=>n.onClick).height;scale=fontScale;button.replay();assert.ok(measured>base,'large font action frame grows');}
 assert.ok(label.lineHeight>0);assert.equal(label.maxFontScale,fontScale);
 const labelCalls={};new shared.dependencies.ReaderButtonLabelModifier(button.specId,true,'day',fontScale)
  .applyNormalAttribute(new Proxy({}, {get:(_target,property)=>(...args)=>{labelCalls[property]=args[0];}}));
 assert.equal(shared.dependencies.resolveReaderButtonSpec(button.specId).leadingSlot,false,'search action has no leading indicator');
 assert.equal(labelCalls.halfLeading,undefined,'half-leading stays reserved for specs with a leading slot');
 assert.equal(native.enabled,true);native.onClick();assert.ok(count>0);button.aboutToDisappear();const before=count;native.onClick();assert.equal(count,before);
}
// Actual production Surface geometry and measurement admission are extracted,
// rather than a reconstructed formula or the retired SearchPage-owned header.
if(selectedCase==='header'){
const surfaceSource=readFileSync(new URL('../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets',import.meta.url),'utf8');
const headerSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderHeaderSpecs.ets',import.meta.url),'utf8');
const {readerPresentedHeaderBottom,readerPageAreaLength}=
 (await import('./lib/reader-page-shell-runtime-probe.mjs')).actualReaderPageShell();
const metricsApi=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const headerMetrics=await import('../entry/src/main/ets/features/common/ReaderHeaderMetrics.ts');
const {readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
const headerSpecs=pureModuleProbe(headerSource,'ReaderHeaderSpecs.ets',{...readerFoundationTokens,...headerMetrics},
 ['bookshelfHeaderSpec','searchHeaderSpec']);
const metrics={systemFontScale:1,windowRect:{width:390,height:844},densityPixels:3.5,
 systemInsets:{left:0,top:0,right:0,bottom:0},cutoutInsets:{left:0,top:0,right:0,bottom:0},
 gestureInsets:{left:0,top:0,right:0,bottom:0},navigationInsets:{left:0,top:0,right:0,bottom:0},
 keyboardInsets:{left:0,top:0,right:0,bottom:0}};
const methods=['controlHeight','fontScale','barHeight','horizontalInset','cardContentWidth','actionWidth',
 'searchLaneLeft','searchLaneWidth','fieldWidth','laneTop','captureHeader','headerSurfaceGeometryKey',
 'headerSurfaceCollapsed','hasHeaderSurfaceMeasurement','headerSurfaceAreaChange'];
const surface=compileTailConsumer(surfaceSource,methods,{...dependencies,...metricsApi,
 bookshelfHeaderSpec:headerSpecs.bookshelfHeaderSpec,readerPresentedHeaderBottom,readerPageAreaLength,
 ReaderWindowCoordinator:{metrics:()=>metrics}},controls.hooks).owner;
const spec=headerSpecs.searchHeaderSpec(),receipts=[];
Object.assign(surface,{mounted:true,measurementKey:41,identity:7,navigationGeneration:3,mounting:2,
 metricsRevision:0,spec,expandedLayout:false,surfaceWindowY:0,headerBottom:0,headerSurfaceWidth:0,
 headerSurfaceHeight:0,headerSurfaceInputKey:'',searchMounted:false,
 historyViewportHeight:()=>0,historyProgress:()=>0,onHeaderBottom:(...args)=>receipts.push(args)});
for(const width of [320,390,736]){
 metrics.windowRect.width=width;surface.expandedLayout=width===736;surface.metricsRevision++;
 let base;
 for(const fontScale of [1,1.3,1.75,2,3.2]){
  metrics.systemFontScale=fontScale;
  const control=surface.controlHeight(),bar=surface.barHeight();
  assert.equal(control,shared.dependencies.readerSearchControlHeight(fontScale));
  assert.equal(bar,spec.barHeight(control));
  assert.ok(control>0&&bar>=spec.minBarHeight);
  assert.equal(surface.actionWidth(),shared.dependencies.readerSearchActionWidth(surface.expandedLayout,fontScale));
  const left=metricsApi.readerInteractiveSafeLeft(metrics),right=metricsApi.readerInteractiveSafeRight(metrics);
  const presentedLeft=Math.max(spec.outerInset(surface.expandedLayout),left);
  const presentedRight=Math.max(spec.outerInset(surface.expandedLayout),right);
  const cardWidth=width-presentedLeft-presentedRight-2*spec.borderWidth;
  assert.equal(surface.cardContentWidth(),cardWidth);
  assert.equal(surface.searchLaneWidth(),Math.max(0,cardWidth-surface.searchLaneLeft()-spec.barPaddingRight));
  assert.deepEqual([surface.horizontalInset(true),surface.horizontalInset(false)],
   [presentedLeft,presentedRight]);
  assert.equal(surface.fieldWidth(),Math.max(0,surface.searchLaneWidth()-surface.actionWidth()-5));
  assert.equal(surface.laneTop(),(bar-control)/2);
  const snapshot={control,bar,card:surface.cardContentWidth(),lane:surface.searchLaneWidth(),
   action:surface.actionWidth(),field:surface.fieldWidth()};
  if(fontScale===1)base=snapshot;
  else{
   assert.ok(control>base.control,'large glyphs grow the actual search control box');
   assert.ok(bar>=base.bar,'the search bar covers the grown control and its authored padding');
   assert.ok(snapshot.action>base.action,'the finite search action grows with its native text');
   assert.equal(snapshot.card,base.card,'system font scale does not invent horizontal page width');
   assert.equal(snapshot.lane,base.lane,'the lane width remains the actual content width contract');
   assert.ok(Math.abs(snapshot.field-Math.max(0,base.field-(snapshot.action-base.action)))<1e-9,
    'field width gives the grown action exactly the width it consumed');
  }
 }
}
assert.ok(surface.fieldWidth()>0,'reviewed phone/tablet widths retain a usable field at maximum scale');
metrics.systemFontScale=1;metrics.windowRect.width=390;metrics.densityPixels=3.5;
metrics.systemInsets.left=0;metrics.systemInsets.right=0;surface.expandedLayout=false;surface.metricsRevision=0;
const geometryKey=surface.headerSurfaceGeometryKey();
assert.equal(surface.controlHeight(),36);assert.equal(surface.fieldWidth(),Math.max(0,surface.searchLaneWidth()-58-5));
metrics.systemFontScale=1.75;assert.notEqual(surface.headerSurfaceGeometryKey(),geometryKey,'font scale invalidates the measured header box');
metrics.systemFontScale=1;assert.equal(surface.headerSurfaceGeometryKey(),geometryKey);
metrics.windowRect.width=391;assert.notEqual(surface.headerSurfaceGeometryKey(),geometryKey,'window width invalidates the measured header box');
metrics.windowRect.width=390;assert.equal(surface.headerSurfaceGeometryKey(),geometryKey);
metrics.densityPixels=2;assert.notEqual(surface.headerSurfaceGeometryKey(),geometryKey,'native density invalidates snapped border extents');
metrics.densityPixels=3.5;assert.equal(surface.headerSurfaceGeometryKey(),geometryKey);
metrics.systemInsets.left=24;assert.notEqual(surface.headerSurfaceGeometryKey(),geometryKey,'interactive safe inset invalidates the available lane');
metrics.systemInsets.left=0;assert.equal(surface.headerSurfaceGeometryKey(),geometryKey);
for(const invalid of [NaN,Infinity,0,-1]){
 metrics.systemFontScale=invalid;assert.equal(surface.fontScale(),1);assert.equal(surface.controlHeight(),36);
}
metrics.systemFontScale=3.2;surface.metricsRevision=-1;assert.equal(surface.controlHeight(),36,'negative revision falls back before metrics settle');
surface.metricsRevision=1;metrics.systemFontScale=1;
const currentKey=surface.headerSurfaceGeometryKey();
surface.searchMounted=false;assert.equal(surface.headerSurfaceCollapsed(),true);
assert.equal(surface.hasHeaderSurfaceMeasurement(),false,'mount cannot reuse an unbound geometry sample');
const accepted=surface.headerSurfaceAreaChange();accepted({},{width:'568vp',height:'71vp'});
assert.deepEqual([surface.headerSurfaceWidth,surface.headerSurfaceHeight],[568,71],'current collapsed panel measurement is accepted');
assert.equal(surface.headerSurfaceInputKey,currentKey);assert.equal(surface.hasHeaderSurfaceMeasurement(),true);
surface.searchMounted=true;surface.historyViewportHeight=()=>100;surface.historyProgress=()=>.5;
const expanded=surface.headerSurfaceAreaChange();surface.searchMounted=false;surface.historyProgress=()=>0;
expanded({},{width:568,height:300});
assert.deepEqual([surface.headerSurfaceWidth,surface.headerSurfaceHeight],[568,71],
 'an expanded-history receipt cannot replace the confirmed collapsed border box');
const staleGeometry=surface.headerSurfaceAreaChange();metrics.systemFontScale=1.75;
staleGeometry({},{width:568,height:94});
assert.deepEqual([surface.headerSurfaceWidth,surface.headerSurfaceHeight],[568,71],
 'an old font/geometry callback cannot overwrite the current panel');
const freshGeometry=surface.headerSurfaceAreaChange();freshGeometry({},{width:568,height:94});
assert.deepEqual([surface.headerSurfaceWidth,surface.headerSurfaceHeight],[568,94],
 'the current scaled panel measurement is authoritative');
const staleLayout=surface.headerSurfaceAreaChange();surface.measurementKey++;
staleLayout({},{width:568,height:120});
assert.deepEqual([surface.headerSurfaceWidth,surface.headerSurfaceHeight],[568,94],
 'a callback from the previous layout generation is rejected');
const invalidMeasure=surface.headerSurfaceAreaChange();invalidMeasure({},{width:NaN,height:120});
assert.deepEqual([surface.headerSurfaceWidth,surface.headerSurfaceHeight],[0,0],'invalid native lengths clear the sample');
assert.equal(surface.headerSurfaceInputKey,'');assert.equal(surface.hasHeaderSurfaceMeasurement(),false);
const restored=surface.headerSurfaceAreaChange();restored({},{width:568,height:94});
assert.deepEqual([surface.headerSurfaceWidth,surface.headerSurfaceHeight],[568,94]);
surface.mounted=false;const unmounted=surface.headerSurfaceAreaChange();unmounted({},{width:600,height:300});
assert.deepEqual([surface.headerSurfaceWidth,surface.headerSurfaceHeight],[568,94],'unmounted callbacks cannot mutate geometry');
surface.mounted=true;surface.measurementKey=52;receipts.length=0;
const top=headerSpecs.bookshelfHeaderSpec().topInset;
surface.captureHeader(71,52);
assert.equal(surface.headerBottom,readerPresentedHeaderBottom(top,71),'current layout receipt publishes the presented header bottom');
assert.deepEqual(receipts.at(-1),[surface.headerBottom,7,52,3,2]);
const before=receipts.length;surface.captureHeader(99,51);
assert.equal(receipts.length,before,'old layout generation cannot publish a header height');
}
if(selectedCase==='card'){
// The current result card keeps the approved cover geometry independent of
// system-font growth, while its live information column grows naturally and
// bounds long source/title metadata with the authored ellipsis.
const cardSource=pageSource.slice(pageSource.lastIndexOf('@Component',pageSource.indexOf('struct SearchResultCard')));
const card=compileTailConsumer(cardSource,['build','displayIntro','coverWidth','coverHeight','coverErrorHandler','searchFontScale'],{...dependencies,SEARCH_RESULT_GEOMETRY,bookIntroText,bookAuthorLabel,ImageFit:{Cover:'Cover'}},controls.hooks).owner;
const longSourceName='非常长的实际书源名称'.repeat(8);
const book={sourceId:'online',bookId:'b',sourceName:longSourceName,title:'书籍',author:'作者',category:'comic'};
Object.assign(card,{group:{book,coverUrl:'',variants:[book],sourceCount:10000,inBookshelf:true},appThemeScheme:'day',readerWindowMetricsRevision:0,isTablet:false,cardWidth:320});
card.initialRender();
for(const fontScale of [1,1.75,2,3.2]){scale=fontScale;card.readerWindowMetricsRevision++;card.replay();
 const nodes=controls.nodes(card);
 const width=SEARCH_RESULT_GEOMETRY.coverWidth(320,false),height=width*SEARCH_RESULT_GEOMETRY.coverAspect;
 assert.equal(card.searchFontScale(),fontScale);
 assert.equal(card.coverWidth(),width);assert.equal(card.coverHeight(),height);
 const covers=nodes.filter(n=>n.type==='Stack'&&n.width===width&&n.height===height);
 assert.equal(covers.length,2,'cover stack and placeholder retain the finite content-based tuple');
 const row=nodes.find(n=>n.type==='Row');assert.equal(row.width,320);assert.equal(row.create.space,SEARCH_RESULT_GEOMETRY.columnGap);
 const info=nodes.find(n=>n.type==='Column'&&n.layoutWeight===1);
 assert.equal(info.constraintSize.minHeight,height,'short metadata shares the cover minimum without clipping');
 assert.equal(info.height,undefined,'large text does not force a fixed information-column height');
 const title=nodes.find(n=>n.type==='Text'&&n.create==='书籍'&&n.maxLines===2);
 const author=nodes.find(n=>n.type==='Text'&&n.create==='作者 · 漫画');
 assert.ok(title&&author);
 for(const text of [title,author]){assert.equal(text.width,'100%');assert.equal(text.textOverflow.overflow,'TextOverflow.Ellipsis');}
 const source=nodes.find(n=>n.type==='Text'&&n.create===longSourceName);
 const discovered=nodes.find(n=>n.type==='Text'&&n.create==='发现 10000 个来源');
 assert.ok(source&&discovered);
 for(const text of [source,discovered]){assert.equal(text.constraintSize.maxWidth,'100%');assert.equal(text.maxLines,1);assert.equal(text.textOverflow.overflow,'TextOverflow.Ellipsis');}
}
for(const invalid of [NaN,Infinity,0,-1]){scale=invalid;assert.equal(card.searchFontScale(),1);}


}

}
