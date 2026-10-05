import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { mangaSurfaceSdkDependencies } from './lib/manga-surface-sdk-probe.mjs';
import { createDefaultReaderWindowMetrics, readerInteractiveSafeInsets } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const require = createRequire(import.meta.url);
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdkRoot}/node_modules/typescript`);
const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
const componentMap = require(`${sdkRoot}/lib/component_map.js`);
const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const boundary = new Proxy({}, { get: () => () => {} });
const coordinatorSource = readFileSync(new URL('../entry/src/main/ets/app/ReaderWindowCoordinator.ts', import.meta.url), 'utf8');
const coordinatorTree = ts.createSourceFile('/tmp/MangaGeometryWindowClasses.ts', coordinatorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const windowClasses = new Function('findReaderTheme', `${['ReaderWindowPolicy', 'ReaderWindowChromeStyle'].map(name =>
  stripTypeScriptTypes(coordinatorTree.statements.find(n => n.name?.getText(coordinatorTree) === name).getText(coordinatorTree).replace(/^export /, ''))).join('\n')};return {ReaderWindowPolicy,ReaderWindowChromeStyle}`)(() => undefined);

// Native callback delivery/Area/scroll values are controlled inputs. Run the
// installed SDK's lowering, actual Image registrations and production methods;
// this does not synthesize native layout, rendering or source-image pixels.
async function fixture(text = source, params = {}) {
  componentMap.resetComponentMap();
  const tree = ts.createSourceFile('/tmp/MangaNativeGeometrySdk.ets', text,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  const surface = tree.statements.find(node => node.name?.getText(tree) === 'MangaReadingSurface');
  assert.ok(surface);
  const names = surface.members.map(node => node.name?.getText(tree)).filter(Boolean);
  const projectionText = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts', import.meta.url), 'utf8')
    .replace(/^import[^;]+;\n/gm, '').replace(/^export /gm, '');
  const Projection = new Function(`${stripTypeScriptTypes(projectionText)};return MangaStripProjection`)();
  const dataText = tree.statements.find(node => node.name?.getText(tree) === 'MangaStripDataSource').getText(tree);
  const DataSource = new Function('MangaStripProjection',
    `${stripTypeScriptTypes(dataText)};return MangaStripDataSource`)(Projection);
  const geometryModule = await import('../entry/src/main/ets/features/manga/MangaImageOriginGeometry.ts');
  const properties = createArkUIPropertyRuntimeProbe();
  const logCalls = [], frames = [], scrollCalls = [], rows = [], windowCalls = [];
  let owner, admitted = false, identityCurrent = true;
  let nativeOffset = { x: 0, y: 0, width: 390, height: 780 };
  let horizontalOffset = { xOffset: 0, yOffset: 0 };
  const metrics = createDefaultReaderWindowMetrics();
  class ListScroller {
    getItemRect() { return { ...nativeOffset }; }
    getItemIndex() { return 0; }
    scrollToIndex(...args) { scrollCalls.push(['index', ...args]); }
    scrollBy(...args) { scrollCalls.push(['offset', ...args]); }
  }
  class Scroller {
    currentOffset() { return { ...horizontalOffset }; }
    scrollTo(...args) { scrollCalls.push(['horizontal', ...args]); }
  }
  const uiContext = { postFrameCallback: frame => frames.push(frame) };
  const built = createReaderBuilderProbe(text, names, {
    ...properties.sdk, ...mangaSurfaceSdkDependencies, ...geometryModule,
    MangaStripDataSource: DataSource, ListScroller, Scroller, PhotoViewScaleModel: class {},
    ...windowClasses, uiContext, ReaderWindowCoordinator: {
      metrics: () => metrics,
      requestReaderChrome: style => windowCalls.push(['reader-chrome', style]),
      requestOverlayChrome: style => windowCalls.push(['overlay-chrome', style]),
      requestReaderWindowPolicy: policy => { windowCalls.push(['reader-policy', policy]); return Promise.resolve(); },
      requestAppChrome: () => windowCalls.push(['app-chrome']),
      requestAppWindowPolicy: () => { windowCalls.push(['app-policy']); return Promise.resolve(); },
    }, readerInteractiveSafeInsets,
    hilog: { info: (...args) => logCalls.push(args), warn() {}, error() {} },
    ScrollAlign: { START: 'start' }, ImageFit: { Fill: 'fill' },
    ScrollDirection: { Horizontal: 'horizontal' }, TouchType: { Down: 0 },
    LazyForEach: {
      create(_id, generatedOwner, data, item, key) {
        assert.equal(generatedOwner, owner); if (admitted) return; admitted = true;
        const row = data.getData(0), before = owner.observers.length; item(row, 0);
        rows.push({ row, key: key(row, 0), nodes: [...owner.nodes.values()].filter(n => n.id >= before) });
      }, pop() {},
    },
    Gesture: boundary, GestureGroup: boundary, PinchGesture: boundary, SwipeGesture: boundary, TapGesture: boundary,
    globalThis: { Gesture: boundary, PanGesture: boundary, GestureGroup: boundary, PinchGesture: boundary,
      SwipeGesture: boundary, TapGesture: boundary },
    GesturePriority: { Parallel: 0 }, GestureMode: { Exclusive: 0 }, SwipeDirection: { Horizontal: 0 },
  }, properties.hooks);
  owner = built.owner;
  const manifest = { chapter: { sourceId: 'geometry-source', bookId: 'geometry-book', chapterId: 'geometry-chapter' },
    manifestVersion: 'r8-geometry', pages: [{ ordinal: 0, pageId: 'geometry-page' }] };
  let tile = { image: { fileUri: 'file://geometry-private-lease.png', revision: 'geometry-revision' } };
  const controller = {
    chapter: { manifest, chapterIndex: 2 }, totalPages: 1,
    tile: () => tile, visiblePages: () => [], pageAt: ordinal => manifest.pages[ordinal],
    pageGeometry: () => ({ width: 1000, height: 2000, tileHeight: 2000 }),
    close() {},
  };
  const fixtureParams={...params}; const optIn=fixtureParams.omitDiagnosticOptIn!==true;
  delete fixtureParams.omitDiagnosticOptIn;
  Object.assign(owner, {
    controller, mounted: true, isReaderIdentityCurrent: () => identityCurrent,
    sourceId: manifest.chapter.sourceId, bookId: manifest.chapter.bookId, chapterIndex: 2,
    viewportWidth: 390, viewportHeight: 844, stageWidth: 390, stageHeight: 844,
    zoom: 1, fitPreference: 'width', opened: true, controlsVisible: false,
    showPageNumbers: false, ...(optIn?{geometryProbeEnabled:true}:{}), ...fixtureParams,
  });
  owner.data.projection.publish(manifest, ordinal => controller.pageGeometry(ordinal));
  owner.visibleAnchor = { ordinal: 0, y: 0.125, x: 0 };
  owner.initialRender();
  const image = rows[0].nodes.find(n => n.type === 'Image');
  const row = rows[0].nodes.find(n => n.type === 'ListItem');
  const scroll = [...owner.nodes.values()].find(n => n.type === 'Scroll');
  const list = [...owner.nodes.values()].find(n => n.type === 'List');
  assert.ok(image && row && scroll && list);
  const reports = () => logCalls.filter(args => args[1] === 'MangaGeometry')
    .map(args => {
      assert.equal(args[0], 0x5244); assert.equal(args[2], 'READER_MANGA_GEOMETRY %{public}s');
      return JSON.parse(args[3]);
    });
  return {
    owner, image, row, list, scroll, rows, controller, metrics, properties, logCalls, frames,
    scrollCalls, windowCalls, reports, output: built.output, geometryModule,
    get tile() { return tile; }, set tile(value) { tile = value; },
    get identityCurrent() { return identityCurrent; }, set identityCurrent(value) { identityCurrent = value; },
    frame() { const frame = frames.shift(); assert.ok(frame, 'production requests native frame delivery'); frame.onFrame(16); },
    drain() { let delivered = 0; while (frames.length) { assert.ok(++delivered <= 8, 'bounded frame delivery'); this.frame(); } },
    snapshot() {
      return {
        actorIDs: [...owner.nodes.keys()], imageID: image.id, imageURI: image.create,
        imageWidth: image.width, imageHeight: image.height, imageFit: image.objectFit,
        rowID: row.id, rowWidth: row.width, rowHeight: row.height,
        key: owner.rowRenderKey(rows[0].row), logicalKey: rows[0].row.key,
        projectedRow: { ...rows[0].row }, viewport: [owner.viewportWidth, owner.viewportHeight],
        anchor: { ...owner.visibleAnchor }, nativeOffset: { ...nativeOffset },
        horizontalOffset: { ...horizontalOffset }, layoutGeneration: owner.layoutGeneration,
        presentationGeneration: owner.presentationGeneration, viewportGeneration: owner.viewportGeneration,
        scrollCalls: [...scrollCalls],
      };
    },
  };
}

const nativeEvent = () => ({ width: 1000, height: 2000, componentWidth: 390, componentHeight: 780,
  loadingStatus: 1, contentWidth: 390, contentHeight: 780, contentOffsetX: 0, contentOffsetY: 0 });
const nativeArea = (width = 390, height = 780, x = 0, y = 0) =>
  ({ width, height, position: { x: 0, y: 0 }, globalPosition: { x, y } });
const allowedKeys = new Set(['sequence','observedAtMs','stateGeneration','receiptGeneration','receiptStateGeneration',
  'retainedReceipt','submittedPaintEvidence','destinationStatus','destinationReason','ordinal','tileIndex','fit','zoom','controls',
  'panelPhase','windowMetricsRevision','densityPixels','nativeWidth','nativeHeight','loadingStatus','componentWidth','componentHeight',
  'contentWidth','contentHeight','contentOffsetX','contentOffsetY','imageAreaWidthVp','imageAreaHeightVp','imageGlobalXVp','imageGlobalYVp',
  'imageAreaGeneration','imageAreaStateGeneration','viewportWidthVp','viewportHeightVp','viewportGlobalXVp','viewportGlobalYVp',
  'viewportAreaGeneration','viewportAreaStateGeneration']);
let caseCount = 0;
const entrySource=readFileSync(new URL('../entry/src/main/ets/entryability/EntryAbility.ets',import.meta.url),'utf8');
const entryTree=ts.createSourceFile('/tmp/MangaGeometryEntryGuard.ets',entrySource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
assert.deepEqual(entryTree.parseDiagnostics,[]);
const entryClass=entryTree.statements.find(n=>n.name?.getText(entryTree)==='EntryAbility');
const entryMethod=name=>entryClass.members.find(n=>n.name?.getText(entryTree)===name);
function geometryFlagStatement(method) {
  const statements=entryMethod(method).body.statements.filter(statement=>ts.isExpressionStatement(statement)&&
    ts.isCallExpression(statement.expression)&&statement.expression.expression.getText(entryTree)==='AppStorage.setOrCreate'&&
    ts.isStringLiteral(statement.expression.arguments[0])&&statement.expression.arguments[0].text==='readerMangaImageOriginProbe');
  assert.equal(statements.length,1,`${method} has a single actual production geometry flag owner`);
  return statements[0].getText(entryTree);
}
// Execute the exact production launch/reset statements parsed by the installed
// SDK. Other EntryAbility startup services are outside this diagnostics gate.
const launchGeometryFlag=new Function('AppStorage','DEBUG','BUILD_MODE_NAME','want',stripTypeScriptTypes(geometryFlagStatement('onCreate')));
const resetGeometryFlag=new Function('AppStorage',stripTypeScriptTypes(geometryFlagStatement('onDestroy')));
const wantBody=entryMethod('onNewWant').body.getText(entryTree);
const warmWant=new Function('ReaderSystemFileOpenHost','want','_launchParam',stripTypeScriptTypes(wantBody));
const launchCases=[
  [true,'debug',true,true], [false,'debug',true,false], [true,'release',true,false],
  [true,'profile',true,false], ['true','debug',true,false], [1,'debug',true,false],
  [true,'debug','true',false], [true,'debug','false',false], [true,'debug',1,false],
  [true,'debug',0,false], [true,'debug',new Boolean(true),false], [true,'debug',undefined,false],
  [true,'debug',null,false], [true,'debug',false,false],
];
for(const [debug,mode,value,expected] of launchCases){
  const stored=new Map([['readerMangaImageOriginProbe',true]]),calls=[];
  const AppStorage={setOrCreate:(key,value)=>{stored.set(key,value);calls.push([key,value]);}};
  launchGeometryFlag(AppStorage,debug,mode,{parameters:{readerMangaImageOriginProbe:value}});
  assert.deepEqual(calls,[['readerMangaImageOriginProbe',expected]],'exact production Entry guard resets previous flags with a primitive boolean');
  assert.equal(stored.get('readerMangaImageOriginProbe'),expected);
  resetGeometryFlag(AppStorage);assert.equal(stored.get('readerMangaImageOriginProbe'),false,'production destroy resets opt-in');
  caseCount++;
}
{
  let flag=true; const calls=[];
  const AppStorage={setOrCreate:(key,value)=>{calls.push([key,value]);flag=value;}};
  launchGeometryFlag(AppStorage,true,'debug',{});assert.equal(flag,false,'missing Want.parameters is default false');
  const receive=[];warmWant({receive:want=>receive.push(want)},{parameters:{readerMangaImageOriginProbe:true}},{});
  assert.equal(receive.length,1);assert.equal(flag,false);assert.equal(calls.length,1,'production warm Want has no diagnostic arm path');caseCount++;
}
function latest(f) {
  const records = f.reports(); assert.ok(records.length, 'the actual native event reaches the real hilog recorder');
  for (const report of records) {
    assert.ok(Object.keys(report).every(key => allowedKeys.has(key)), 'diagnostic output is an explicit numeric/presentation whitelist');
    assert.equal(report.submittedPaintEvidence, 0, 'callback data must not self-assert a submitted paint');
    const encoded = JSON.stringify(report);
    for (const secret of ['file://', 'geometry-private', 'geometry-source', 'geometry-book', 'geometry-chapter', 'secret-extra'])
      assert.ok(!encoded.includes(secret), 'no URI, source identity or arbitrary native fields may be logged');
  }
  return records.at(-1);
}
async function verifyEventCase(label, event, status, reason, text = source) {
  const f = await fixture(text), before = f.snapshot();
  assert.equal(typeof f.image.onComplete, 'function', 'actual emitted Image registers native completion');
  assert.equal(typeof f.image.onAreaChange, 'function', 'actual emitted Image registers its native Area');
  assert.equal(f.image.objectFit, 'fill'); assert.equal(f.image.draggable, false);
  assert.deepEqual([f.image.width,f.image.height,f.row.height],[390,780,780]);
  f.image.onComplete(event);
  assert.equal(f.logCalls.length, 0, 'native receipt waits for the bounded diagnostic frame');
  f.image.onAreaChange({}, nativeArea());
  f.scroll.onAreaChange({}, nativeArea(390,844));
  assert.equal(f.frames.length, 1, 'native completion, image area and unchanged viewport coalesce into one diagnostic request');
  f.drain(); const report = latest(f);
  assert.equal(report.destinationStatus, status, `${label}: destination status comes from delivered data`);
  assert.equal(report.destinationReason, reason, `${label}: rejection reason is observable`);
  assert.equal(report.imageAreaWidthVp,390); assert.equal(report.imageAreaHeightVp,780);
  assert.equal(report.imageGlobalXVp,0); assert.equal(report.imageGlobalYVp,0);
  assert.equal(report.viewportWidthVp,390); assert.equal(report.viewportHeightVp,844);
  assert.equal(report.viewportGlobalXVp,0); assert.equal(report.viewportGlobalYVp,0);
  assert.equal(report.retainedReceipt,0); assert.equal(report.ordinal,0); assert.equal(report.tileIndex,0);
  assert.deepEqual(f.snapshot(), before, `${label}: diagnostic callbacks cannot mutate admitted Image/ListItem/key/projection/viewport/scroller/anchor`);
  assert.deepEqual(f.scrollCalls, []); caseCount++;
  return { f, report };
}
const cases = [
  ['decoded', nativeEvent(), 'PASS', 'native-destination'],
  ['loaded-not-decoded', {...nativeEvent(),loadingStatus:0}, 'OPEN','not-decoded'],
  ['unknown-loading-status', {...nativeEvent(),loadingStatus:2}, 'OPEN','not-decoded'],
  ['missing-event', undefined, 'OPEN','missing'],
  ['missing-offset', Object.fromEntries(Object.entries(nativeEvent()).filter(([key])=>key!=='contentOffsetY')), 'OPEN','invalid-numeric-geometry'],
  ['NaN', {...nativeEvent(),componentWidth:NaN}, 'OPEN','invalid-numeric-geometry'],
  ['Infinity', {...nativeEvent(),contentHeight:Infinity}, 'OPEN','invalid-numeric-geometry'],
  ['zero-source', {...nativeEvent(),width:0}, 'OPEN','invalid-numeric-geometry'],
  ['negative-component', {...nativeEvent(),componentHeight:-1}, 'OPEN','invalid-numeric-geometry'],
  ['numeric-string', {...nativeEvent(),contentOffsetY:'0'}, 'OPEN','invalid-numeric-geometry'],
  ['offset-y', {...nativeEvent(),contentOffsetY:80}, 'FAIL','destination-offset'],
  ['offset-x-negative', {...nativeEvent(),contentOffsetX:-3}, 'FAIL','destination-offset'],
  ['width-mismatch', {...nativeEvent(),contentWidth:389}, 'FAIL','destination-size'],
  ['height-mismatch', {...nativeEvent(),contentHeight:778}, 'FAIL','destination-size'],
  ['half-unit-rounding', {...nativeEvent(),contentWidth:389.5,contentHeight:780.5,contentOffsetX:.5,contentOffsetY:-.5}, 'PASS','native-destination'],
  ['over-rounding-offset', {...nativeEvent(),contentOffsetY:.5001}, 'FAIL','destination-offset'],
  ['over-rounding-size', {...nativeEvent(),contentWidth:389.4999}, 'FAIL','destination-size'],
  ['extra-private-native-fields', {...nativeEvent(),uri:'file://secret-extra',password:'secret-extra'}, 'PASS','native-destination'],
];
for (const [label,event,status,reason] of cases) await verifyEventCase(label,event,status,reason);

// Actual SDK State/StorageLink value changes deliver production @Watch.
// Retained decode receipts are explicitly OPEN after a presentation/metrics
// change; only a new onComplete receipt can make this narrow scope PASS again.
{
  const {f} = await verifyEventCase('state-watch-baseline',nativeEvent(),'PASS','native-destination');
  f.owner.windowChromeActive=true; f.drain(); f.windowCalls.length=0;
  const geometry=f.snapshot();
  f.owner.windowMetricsRevision++;
  f.properties.flush();
  assert.deepEqual(f.windowCalls,[], 'the new actual StorageLink Watch must not re-enqueue window chrome/policy');
  f.drain(); let report=latest(f);
  assert.equal(report.destinationStatus,'OPEN'); assert.equal(report.destinationReason,'retained-native-receipt');
  assert.equal(report.retainedReceipt,1); assert.ok(report.receiptStateGeneration < report.stateGeneration);
  assert.deepEqual(f.snapshot(),geometry,'metrics diagnosis does not change image/list/viewport/scroller/anchor');
  f.owner.controlsVisible=true; f.properties.flush(); f.drain(); report=latest(f);
  assert.equal(report.controls,1); assert.equal(report.destinationStatus,'OPEN');
  assert.ok(f.windowCalls.some(call=>call[0]==='reader-policy'), 'ordinary control Watch retains production system-window requests');
  f.owner.panel='directory'; f.properties.flush(); f.drain(); assert.equal(latest(f).destinationStatus,'OPEN');
  f.image.onComplete(nativeEvent()); f.drain(); report=latest(f);
  assert.equal(report.destinationStatus,'PASS'); assert.equal(report.retainedReceipt,0);
  assert.equal(report.receiptStateGeneration,report.stateGeneration);
  assert.deepEqual(f.snapshot(),geometry,'control/panel diagnostic state also cannot mutate the retained manga geometry'); caseCount++;
}
for (const [label,area] of [
  ['missing-area', undefined],['missing-position',{width:390,height:780}],
  ['NaN-area',nativeArea(NaN)],['zero-area',nativeArea(0)],['invalid-global',nativeArea(390,780,0,Infinity)],
]) {
  const f=await fixture(), before=f.snapshot(); f.image.onAreaChange({},area); f.drain();
  const report=latest(f); assert.equal(report.destinationStatus,'OPEN'); assert.equal(report.destinationReason,'missing');
  assert.equal(report.imageAreaWidthVp,undefined,`${label}: invalid Area is not a fabricated geometry receipt`);
  assert.deepEqual(f.snapshot(),before); caseCount++;
}
{
  const f=await fixture(),before=f.snapshot();
  f.image.onComplete(nativeEvent()); f.image.onAreaChange({},nativeArea(390,780,13,27));
  f.scroll.onAreaChange({},nativeArea(390,844,5,11)); f.drain(); const report=latest(f);
  assert.deepEqual([report.imageGlobalXVp,report.imageGlobalYVp,report.viewportGlobalXVp,report.viewportGlobalYVp],[13,27,5,11],
    'native Area positions are reported verbatim rather than subtracted into self-asserted zero');
  assert.equal(report.destinationStatus,'PASS','destination-only PASS cannot claim ancestor global origin');
  assert.deepEqual(f.snapshot(),before); caseCount++;
}
for (const flag of [false,undefined,0,1,'false','true']) {
  const f=await fixture(source,{geometryProbeEnabled:flag}),before=f.snapshot();
  f.image.onComplete(nativeEvent()); f.image.onAreaChange({},nativeArea()); f.scroll.onAreaChange({},nativeArea(390,844));
  f.owner.windowMetricsRevision++; f.owner.controlsVisible=true; f.drain();
  assert.deepEqual(f.logCalls,[],'only the exact boolean true may emit diagnostic records');
  assert.deepEqual(f.frames,[],'default/release and nonboolean flags request no diagnostic frame');
  assert.deepEqual(f.snapshot(),before); caseCount++;
}
{
  const f=await fixture(source,{omitDiagnosticOptIn:true}),before=f.snapshot();
  assert.equal(f.owner.geometryProbeEnabled,false,'actual SDK compiled StorageLink default is false without a launch opt-in');
  f.image.onComplete(nativeEvent());f.image.onAreaChange({},nativeArea());f.scroll.onAreaChange({},nativeArea(390,844));
  f.drain();assert.deepEqual(f.logCalls,[]);assert.deepEqual(f.frames,[]);assert.deepEqual(f.snapshot(),before);caseCount++;
}
for(const flag of [false,undefined,0,1,'true','false']){
  const f=await fixture(),before=f.snapshot();f.image.onComplete(nativeEvent());assert.equal(f.frames.length,1);
  f.owner.geometryProbeEnabled=flag;f.drain();
  assert.deepEqual(f.logCalls,[],'queued diagnostic frame rechecks exact boolean flag after reset');
  assert.equal(f.owner.geometrySamples.size,0,'a reset frame invalidates prior retained receipts');
  f.image.onComplete(nativeEvent());f.image.onAreaChange({},nativeArea());f.drain();
  assert.deepEqual(f.logCalls,[]);assert.deepEqual(f.snapshot(),before);caseCount++;
}
async function verifyLateOwner(text=source) {
  for (const label of ['tile','image','controller','chapter','identity','unmounted','exiting','row-shape','published-presentation']) {
    const f=await fixture(text),beforeCount=f.reports().length;
    if(label==='tile') f.tile={image:{...f.tile.image}};
    if(label==='image') f.tile.image={...f.tile.image,fileUri:'file://replaced-private-lease.png',revision:'new-private-revision'};
    if(label==='controller') f.owner.controller={...f.controller};
    if(label==='chapter') f.controller.chapter={...f.controller.chapter};
    if(label==='identity') f.identityCurrent=false;
    if(label==='unmounted') f.owner.mounted=false;
    if(label==='exiting') f.owner.exiting=true;
    if(label==='row-shape') f.owner.data.projection.publish(f.controller.chapter.manifest,()=>({width:1000,height:2100,tileHeight:2100}));
    if(label==='published-presentation') f.owner.publishedRowKeys.set(0,'new-opaque-presentation');
    f.image.onComplete(nativeEvent()); f.image.onAreaChange({},nativeArea()); f.drain();
    assert.equal(f.reports().length,beforeCount,`${label}: late captured Image callbacks cannot produce PASS or overwrite a newer owner sample`);
    caseCount++;
  }
}
await verifyLateOwner();
{
  const f=await fixture(); f.image.onComplete(nativeEvent()); assert.equal(f.frames.length,1);
  f.owner.aboutToDisappear(); f.drain();
  assert.equal(f.reports().length,0,'production dispose invalidates the pending diagnostic frame');
  f.image.onComplete(nativeEvent()); f.image.onAreaChange({},nativeArea()); f.drain();
  assert.equal(f.reports().length,0,'disposed native callbacks remain inert'); caseCount++;
}
{
  const f=await fixture(); f.image.onComplete(nativeEvent()); f.identityCurrent=false; f.drain();
  assert.equal(f.reports().length,0,'owner identity lost between receipt and native frame cannot be PASS'); caseCount++;
}

// Narrow in-memory mutations of the real production callback implementation.
// Neither negative fixture is written to product files or replaces the positive
// implementation with test functions. Each must fail the same actual SDK gate.
const selfAssertNeedle='sample.check = checkMangaImageOriginGeometry(event);';
assert.equal(source.split(selfAssertNeedle).length-1,1);
const selfAssertSource=source.replace(selfAssertNeedle,"sample.check = { status: 'PASS', reason: 'native-destination' };");
await assert.rejects(()=>verifyEventCase('offset-self-assert-negative',{...nativeEvent(),contentOffsetY:80},'FAIL','destination-offset',selfAssertSource),
  /offset-self-assert-negative: destination status/, 'a recorder that labels its own declaration PASS must fail real event-driven assertions');
assert.equal(source.split('if (current()) this.onImageGeometry').length-1,2);
const lateSource=source.replaceAll('if (current()) this.onImageGeometry','if (true) this.onImageGeometry');
await assert.rejects(()=>verifyLateOwner(lateSource),/tile: late captured Image callbacks/,
  'a recorder without captured native Image ownership fences must fail the same late-event regression');

const admitted=await fixture();
console.log(JSON.stringify({sourceSHA:sha(source),entryAbilitySHA:sha(entrySource),validatorSHA:sha(readFileSync(new URL('../entry/src/main/ets/features/manga/MangaImageOriginGeometry.ts',import.meta.url),'utf8')),
  sdkEmittedSHA:sha(admitted.output),propertyRuntime:admitted.properties.source,caseCount,
  sdkImageDeclaration: `${sdkRoot}/../../component/image.d.ts:1682-1945`,nativeCallerSample:'OPEN',sourcePixels:'not-read',
  scope:'actual SDK emitted Image callbacks + actual production validator/log calls; native delivery/layout/paint not simulated'}));
console.log('PASS actual SDK Image.onComplete/onAreaChange and unchanged viewport callback: decoded/native-invalid/status0/offset/size/tolerance/missing, numeric whitelist, actual EntryAbility AST statement execution for primitive DEBUG/debug cold-start opt-in/destroy/warm Want, compiled default false and queued flag reset, real State/StorageLink Watch retained receipts and no metric-induced policy queue, stale owner/dispose fences, same Image/ListItem/projection/key/viewport/scroller/anchor, two real-source negative mutations. Native caller numeric delivery remains OPEN until separately bound runtime samples; no source pixels/cache/userdata or native paint were read.');
