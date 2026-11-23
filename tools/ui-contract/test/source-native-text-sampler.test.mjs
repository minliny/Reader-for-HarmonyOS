import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks, stripTypeScriptTypes} from 'node:module';
import test from 'node:test';
import {selectedProductionMethods, selectedProductionValues} from '../../lib/selected-production-methods.mjs';

test('source native text sampler retains complete UTF-16 ranges and distinguishes unavailable reads', async () => {
  const sampler = new URL('../../../entry/src/main/ets/pages/ReaderSourceTextMetrics.ets', import.meta.url);
  const graphics = 'data:text/javascript,export const text = {RectWidthStyle:{TIGHT:1},RectHeightStyle:{TIGHT:2}}';
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === sampler.href && specifier === '@kit.ArkGraphics2D') {
        return {url:graphics, shortCircuit:true};
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url !== sampler.href) return next(url, context);
      return {format:'module', source:stripTypeScriptTypes(readFileSync(sampler,'utf8')), shortCircuit:true};
    },
  });
  const original = Object.getOwnPropertyDescriptor(globalThis,'TextController');
  let layout;
  Object.defineProperty(globalThis,'TextController',{configurable:true, value:class {
    getLayoutManager() { return layout; }
  }});
  try {
    const {ReaderSourceTextMetrics} = await import(sampler.href);
    const model = new ReaderSourceTextMetrics('');
    const text = '公😀';
    assert.ok(model.track('stats',text));
    assert.deepEqual(model.readTracked(), [{
      role:'stats',utf16Length:3,startUtf16:0,endUtf16:0,complete:false,lines:[],rangeRects:[],tailRects:[],
    }]);

    let endIndex = 3;
    const selections = [];
    layout = {
      getLineCount:() => 1,
      getLineMetrics:() => ({startIndex:0,endIndex,left:1,topHeight:2,width:31,height:17,baseline:12}),
      getRectsForRange(range, widthStyle, heightStyle) {
        selections.push([range,widthStyle,heightStyle]);
        return [{rect:{left:1,top:2,right:32,bottom:19}}];
      },
    };
    const [complete] = model.readTracked();
    assert.equal(complete.complete,true);
    assert.equal(complete.endUtf16,3);
    assert.deepEqual(selections,[[{start:0,end:3},1,2],[{start:1,end:3},1,2]]);
    assert.equal(JSON.stringify(complete).includes(text),false);
    endIndex = 2;
    const [truncated] = model.readTracked();
    assert.equal(truncated.complete,false);
    assert.equal(truncated.endUtf16,2);
    assert.equal(truncated.lines.length,1);
    assert.deepEqual(model.read(),[{role:'stats',lines:truncated.lines}]);

    const business = ' 待处理   当前来源需要核对😀';
    const older = model.track('recovery/original/message',business,true);
    assert.ok(older);
    const split = [0,3,6,9,12,business.length+3,business.length+5];
    layout.getLineCount = () => split.length-1;
    layout.getLineMetrics = index => ({startIndex:split[index],endIndex:split[index+1],left:1,
      topHeight:20*index,width:31,height:17,baseline:20*index+12});
    selections.length = 0;
    const [rich] = model.readTracked(['recovery/original/message']);
    assert.equal(rich.complete,true,'the measured business prefix is complete independently of action reservation');
    assert.equal(rich.endUtf16,business.length);
    assert.equal(rich.lines.length,5,'a separate decorative line is not part of the body');
    assert.deepEqual(selections,[[{start:0,end:business.length},1,2],[{start:business.length-2,end:business.length},1,2]]);

    const ordinaryRoles = ['footer/manage','footer/add','stats','status/all','group/label','category/all',
      'row/title','row/category','row/detect'];
    for (const roles of [ordinaryRoles, ['row/login',...ordinaryRoles], [...ordinaryRoles,'row/login']]) {
      const row = new ReaderSourceTextMetrics('');
      for (const role of roles) assert.ok(row.track(role,'公示'),role);
      assert.equal(row.track('another-label','公示'),undefined,'ordinary sources are still bounded to nine labels');
      layout.getLineCount = () => 1;
      layout.getLineMetrics = () => ({startIndex:0,endIndex:2,left:1,topHeight:2,width:31,height:17,baseline:12});
      assert.deepEqual(row.readTracked().map(({role,complete})=>[role,complete]),roles.map(role=>[role,true]));
    }
  } finally {
    hooks.deregister();
    if (original) Object.defineProperty(globalThis,'TextController',original);
    else delete globalThis.TextController;
  }
});

test('source text sampler retires a queued sweep when the same opening publishes newer labels', () => {
  const source = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);
  const {SOURCE_TEXT_ROLES} = selectedProductionValues(source,['SOURCE_TEXT_ROLES']);
  const events = [];
  const frames = [];
  const owner = {mounting:2,generation:8};
  const ReaderUIVerificationProbe = {enabled:() => true,emit:(kind,_channel,payload) => events.push({kind,payload})};
  const ReaderWindowCoordinator = {metrics:() => ({ready:true,revision:7,keyboardArea:{available:true,visible:false},
    windowRect:{width:320,height:708},densityPixels:3.5,systemFontScale:1})};
  class SourceListLayoutFrame {
    constructor(_context,read) { this.read = read; }
  }
  const Page = selectedProductionMethods(source,'SourceManagementPage',[
    'observeVerificationProjection','verificationTextLayoutScope','scheduleVerificationTextLayout',
    'scheduleVerificationReadText','verificationReadTextScope','scheduleVerificationOperationText',
    'verificationOperationTextFact','hasPendingSourceRecovery',
  ],{SOURCE_TEXT_ROLES,ReaderUIVerificationProbe,ReaderWindowCoordinator,SourceListLayoutFrame,
    sourceVerificationOpening:() => owner,SourceVerificationAnchors:{identify:() => 12}});
  let statsLength = 14;
  const rows = [{sourceId:'public-first'},{sourceId:'public-second'}];
  const page = Object.assign(new Page(),{mounted:true,verificationOpening:'public-opening',verificationTextFrameKey:'',
    verificationTextProjectionRevision:0,verificationTextRowId:rows[0].sourceId,verificationFilterRevision:7,
    viewportWidth:320,viewportHeight:708,groupOpen:false,groupClosing:false,
    verificationOperationTextKey:'',verificationOperationTextRoles:new Set(),
    operation:{readFacts:{fact:'current',generation:4}},sources:rows,projectedSources:rows,
    searchQuery:'',statusValue:'全部',categoryValue:'all',groupValue:'全部分组',groupOptions:() => ['全部分组'],
    managementOpeningIsCurrent:() => true,verificationProjectionState:() => 'rows',verificationRecoveryFacts:() => undefined,fontScale:() => 1,
    getUIContext:() => ({postFrameCallback:frame => frames.push(frame)}),
    verificationTextMetrics:{readTracked:() => SOURCE_TEXT_ROLES.map(role => ({role,utf16Length:statsLength,lines:[{}]}))}});

  page.observeVerificationProjection('owner-update');
  frames.shift().read();
  assert.equal(events.at(-1).payload.labels[0].utf16Length,14);
  statsLength = 15;
  page.observeVerificationProjection('owner-update');
  assert.equal(frames.length,1,'Changing the same opening must enqueue a fresh native read');
  statsLength = 16;
  page.observeVerificationProjection('owner-update');
  assert.equal(frames.length,2);
  frames.shift().read();
  assert.equal(events.at(-1).kind,'source.projection','The queued old frame cannot publish for a newer projection');
  frames.shift().read();
  const last = events.at(-1);
  assert.equal(last.kind,'source.text-layout');
  assert.equal(last.payload.labels[0].utf16Length,16);
  assert.equal(last.payload.textProjectionRevision,3);
  assert.equal(last.payload.textProjectionRevision,events.at(-2).payload.textProjectionRevision);
  assert.equal(last.payload.readGeneration,4);
  assert.equal(last.payload.filterRevision,7);
  assert.equal(last.payload.rowAnchor,12);
  page.scheduleVerificationTextLayout();
  assert.equal(frames.length,0,'A repeated geometry callback for the same projection must not restart text sampling');
});

test('source read surface sampler keeps native controllers attached from loading through empty and failed reads', () => {
  const source = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
  const frames = [], events = [];
  const owner = {mounting:2,generation:6};
  let projection = 'loading', enabled = true;
  const ReaderUIVerificationProbe = {enabled:()=>enabled,emit:(kind,_channel,payload)=>events.push({kind,payload})};
  const ReaderWindowCoordinator = {metrics:()=>({ready:true,revision:9,keyboardArea:{available:true,visible:false},
    windowRect:{width:366,height:809},densityPixels:3.5,systemFontScale:1.3})};
  class SourceListLayoutFrame { constructor(_context,read) { this.read = read; } }
  class ReaderSourceTextMetrics {
    controllers = new Map();
    labels = new Map();
    options(role) {
      if (!this.controllers.has(role)) this.controllers.set(role,{role});
      return this.controllers.get(role);
    }
    track(role,text) { this.labels.set(role,text.length); return this.options(role); }
    readTracked(roles) {
      return [...this.labels].filter(([role])=>!roles || roles.includes(role)).map(([role,utf16Length])=>({
        role,utf16Length,lines:this.controllers.get(role).nativeLength === utf16Length ? [{}] : [],
      }));
    }
  }
  const Page = selectedProductionMethods(source,'SourceManagementPage',[
    'readPageStateTitle','readPageStateMessage','verificationReadTextScope','readPageStateTextOptions','readVerificationPageText',
    'verificationSurfaceTextKey','verificationSurfaceTextOptions','scheduleVerificationReadText',
    'scheduleVerificationSurfaceText','verificationTextLayoutScope',
  ],{ReaderUIVerificationProbe,ReaderWindowCoordinator,SourceListLayoutFrame,ReaderSourceTextMetrics,
    sourceVerificationOpening:()=>owner,SourceVerificationAnchors:{identify:()=>0}});
  const footerMetrics = new ReaderSourceTextMetrics();
  const footerAdd = footerMetrics.track('footer/add','新增书源');
  footerAdd.nativeLength = '新增书源'.length;
  footerMetrics.track('footer/manage','批量管理').nativeLength = '批量管理'.length;
  const page = Object.assign(new Page(),{mounted:true,verificationOpening:'source',verificationTextMetrics:footerMetrics,
    verificationReadTextMetrics:new ReaderSourceTextMetrics(),
    verificationSurfaceTextMetrics:new Map(),verificationSurfaceTextFrameKeys:new Map(),verificationTextProjectionRevision:1,
    verificationTextRowId:'',verificationFilterRevision:1,viewportWidth:366,viewportHeight:809,
    groupOpen:false,groupClosing:false,operation:{readFacts:{fact:'loading',generation:3}},
    searchQuery:'',statusValue:'全部',categoryValue:'all',groupValue:'全部分组',managementOpeningIsCurrent:()=>true,
    verificationProjectionState:()=>projection,fontScale:()=>1.3,
    sourceListLoading:()=>projection === 'loading',hasEmptyListReadFailure:()=>projection === 'readFailure',
    recovery:()=>({canRetry:true}),
    getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)})});

  const title = page.readPageStateTextOptions('title');
  const message = page.readPageStateTextOptions('message');
  const retry = page.readPageStateTextOptions('retry');
  title.nativeLength = page.readPageStateTitle().length;
  message.nativeLength = page.readPageStateMessage().length;
  page.scheduleVerificationReadText();
  assert.equal(frames.length,0,'Loading must not publish measurements for a settled read');

  projection = 'empty';
  page.operation.readFacts = {fact:'current',generation:4};
  page.verificationTextProjectionRevision += 1;
  page.scheduleVerificationReadText();
  frames.shift().read();
  assert.equal(events.length,0,'The loading layout must not publish on the first empty callback');
  title.nativeLength = page.readPageStateTitle().length;
  message.nativeLength = page.readPageStateMessage().length;
  frames.shift().read();
  assert.deepEqual(events[0].payload.labels.map(label=>label.role),['read/empty-title','read/empty-message','footer/add']);
  assert.equal(events[0].payload.readGeneration,4);
  assert.equal(events[0].payload.textProjectionRevision,2);
  assert(events[0].payload.labels.every(label=>label.lines.length === 1));

  page.verificationTextProjectionRevision += 1;
  page.scheduleVerificationReadText();
  projection = 'readFailure';
  page.operation.readFacts = {fact:'failed',generation:5};
  page.verificationTextProjectionRevision += 1;
  frames.shift().read();
  assert.equal(events.length,1,'The prior empty frame cannot publish in the failed read');
  assert.equal(page.readPageStateTextOptions('title'),title);
  assert.equal(page.readPageStateTextOptions('message'),message);
  assert.equal(page.readPageStateTextOptions('retry'),retry);
  title.nativeLength = page.readPageStateTitle().length;
  message.nativeLength = page.readPageStateMessage().length;
  retry.nativeLength = '重试'.length;
  page.scheduleVerificationReadText();
  frames.shift().read();
  assert.deepEqual(events.map(event=>event.kind),['source.surface-text-layout','source.surface-text-layout']);
  const failure = events[1].payload;
  assert.equal(failure.scope,'read-failed');
  assert.equal(failure.readGeneration,5);
  assert.equal(failure.textProjectionRevision,4);
  assert.deepEqual(failure.labels.map(label=>label.role),['read/failure-title','read/failure-message','read/retry']);
  assert(failure.labels.every(label=>label.lines.length === 1));
  assert(!JSON.stringify(events).includes('书源读取失败'));
  page.scheduleVerificationReadText();
  assert.equal(frames.length,0);

  projection = 'rows';
  page.operation.readFacts = {fact:'refreshFailed',generation:6};
  page.verificationTextProjectionRevision += 1;
  page.verificationSurfaceTextOptions('retained-read-failed','read/retained-retry','刷新列表').nativeLength = '刷新列表'.length;
  page.scheduleVerificationReadText();
  frames.shift().read();
  assert.deepEqual(events[2].payload.labels.map(label=>label.role),['read/retained-retry']);
  assert.equal(events[2].payload.readGeneration,6);
  enabled = false;
  assert.equal(page.readPageStateTextOptions('title'),undefined);
});
