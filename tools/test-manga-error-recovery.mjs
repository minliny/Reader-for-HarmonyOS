import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"exit-once": {"description": "实际注册退出owner save/back仅一次与retired guard", "resources": []}, "brief-current-error": {"description": "实际admitted preparation brief/opened Watch保error和pixels", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { mangaUserError } = await import('../entry/src/main/ets/features/manga/MangaUserError.ts');


const file = new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const Surface = productionMotionMethods(file,
  ['requestedLast', 'imageError', 'rowHasError', 'nativeFailureKey', 'wholeImageUnavailable', 'unavailableMarkerTile', 'unavailableMarkerTop', 'rowDisplayWidth', 'rowDisplayHeight', 'unavailableImageWidth', 'unavailableImageHeight', 'rowRenderKey', 'retry', 'retryLabel', 'retryOpen', 'confirmRecovery', 'notifyPreparationFailure']);
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const rows = [0, 1, 2].map(ordinal => ({ key: `page-${ordinal}:0`, ordinal, tileIndex: 0,
  known: true, width: 600, height: 800, sourceY: 0, sourceHeight: 800 }));
function fixture() {
  const tiles = new Map(rows.map(row => [row.ordinal, { error: 'READING_IMAGE_HTTP_FAILED' }]));
  const controller = { chapter: { manifest: { manifestVersion: 'v1' } },
    tile: ordinal => tiles.get(ordinal), pageGeometry: () => undefined, visiblePages: () => [] };
  const surface = Object.assign(new Surface(), { controller, mounted: true, opened: true,
    first: 0, last: 2, presentationGeneration: 0, error: '', nativeImageFailures: new Set(),
    viewportWidth: 390, viewportHeight: 844, zoom: 1, effectiveFit: () => 'width',
    data: { totalCount: () => rows.length, getData: index => rows[index] }, updateViewport: async () => {} });
  return { surface, controller, tiles };
}

if(selectedCase==='exit-once') {
// Index registers one exit owner and sends a navigation intent for book-info,
// shelf mutation and external file opening. The actual registered callback
// must carry that intent past ordinary panel/end/zoom back handling.
{
  const ExitSurface = productionMotionMethods(file, ['aboutToAppear', 'handleBack'], {
    MangaBookPresentation: { revision: 0, useOwner() {} },
    MangaSessionController: class { async close() {} },
    prepareReaderFontFamily: async () => {},
    inputMethod: { getController: () => ({ hideTextInput: async () => {} }) },
  });
  function exitFixture() {
    let exit, saves = 0, exits = 0, resets = 0;
    const pending = deferred();
    const surface = Object.assign(new ExitSurface(), { runtime: {}, appThemeScheme: 'day',
      panel: '', panelPhase: 'closed', panelGeneration: 0, panelActionGeneration: 0,
      reduceMotion: true, chapterEnd: false, zoom: 1, exiting: false,
      getUIContext: () => ({ getFocusController: () => ({ clearFocus() {} }) }),
      loadBrightness() {}, open() {}, onExitRequestHandler: callback => { exit = callback; },
      saveVisible: async () => { saves++; await pending.promise; },
      changeZoom: () => { resets++; }, onBack: () => { exits++; } });
    surface.aboutToAppear();
    return { surface, pending, exit: (...args) => exit(...args), counts: () => ({ saves, exits, resets }) };
  }
  const navigation = exitFixture();
  Object.assign(navigation.surface, { panel: 'more', chapterEnd: true, zoom: 2 });
  navigation.exit('navigation'); await tick();
  assert.deepEqual(navigation.counts(), { saves: 1, exits: 0, resets: 0 }, 'navigation waits for the displayed-page save and bypasses overlay/zoom back tiers');
  navigation.exit('navigation'); await tick();
  assert.equal(navigation.counts().saves, 1, 'one exit transaction owns repeated navigation requests');
  navigation.pending.resolve(); await tick();
  assert.deepEqual(navigation.counts(), { saves: 1, exits: 1, resets: 0 });
  for (const mode of ['panel', 'chapterEnd', 'zoom']) {
    const normal = exitFixture();
    if (mode === 'panel') normal.surface.panel = 'directory';
    if (mode === 'chapterEnd') normal.surface.chapterEnd = true;
    if (mode === 'zoom') normal.surface.zoom = 2;
    normal.exit(); await tick();
    assert.equal(normal.counts().saves, 0); assert.equal(normal.counts().exits, 0);
    if (mode === 'panel') assert.equal(normal.surface.panel, '');
    if (mode === 'chapterEnd') assert.equal(normal.surface.chapterEnd, false);
    if (mode === 'zoom') assert.equal(normal.counts().resets, 1);
  }
  const disposed = exitFixture(); disposed.exit('navigation'); await tick();
  disposed.surface.mounted = false; disposed.pending.resolve(); await tick();
  assert.equal(disposed.counts().exits, 0, 'disposed completion cannot navigate a replacement reader');
}
console.log('PASS actual registered navigation exit bypasses back tiers, waits for one save, fences disposal and retains ordinary panel/end/zoom back behavior');
console.log('Boundary: production methods and SDK control lowering; VM pixels and native list scheduling require separate delivery evidence.');


}
if(selectedCase==='brief-current-error') {
// Background preparation failure is brief feedback after readable pixels have
// been admitted. It cannot become a persistent global error or repeat per publish.
{
  const {surface,controller}=fixture(),messages=[];
  controller.preparationError='MANGA_CHAPTER_PREPARATION_FAILED';
  Object.assign(surface,{preparationFailureNoticeKey:'',error:'settings error',
    displayError:()=> '整章加载暂未完成，已加载的内容仍可阅读。',
    getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>messages.push(message)})})});
  surface.notifyPreparationFailure();surface.notifyPreparationFailure();
  assert.equal(messages.length,1);assert.equal(surface.error,'settings error');
  assert.equal(surface.opened,true);assert.equal(surface.controller,controller);
  controller.preparationError=undefined;surface.notifyPreparationFailure();
  controller.preparationError='MANGA_CHAPTER_CACHE_CAPACITY';surface.notifyPreparationFailure();
  assert.equal(messages.length,2);
  surface.opened=false;surface.preparationFailureNoticeKey='';surface.notifyPreparationFailure();
  assert.equal(messages.length,2,'the initial opening retains its existing failure owner');
}
console.log('PASS admitted manga preparation failures are brief, deduplicated and preserve current pixels and unrelated error facts');

// Actual SDK @State watch delivery: an admitted reader keeps its error fact
// and pixels while feedback is transient; image errors remain local. A
// regression to the old opened/error Text block must fail this proof.
async function openedErrorSdkProof(surfaceSource=source) {
  const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
  const sdk=boundedSurfaceSdk(),messages=[];
  const members=['error','opened','mounted','openedErrorNoticeKey','presentationGeneration',
    'onErrorPresentationChanged','onWindowChromeChanged','notifyOpenedError','controlsPresentedForWindow','loginRequired',
    'requestedLast','rowHasError','imageError','nativeFailureKey','nativeImageFailures','topControls'];
  const owner=sdk.consumer(surfaceSource,members,{TOK_BORDER_W:1});
  let live=true;
  const tile={image:{fileUri:'file://retained',revision:'v1'}},row={key:'page:0',ordinal:0,tileIndex:0};
  Object.assign(owner,{getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>messages.push(message)})}),
    onWindowChromeChanged(){},displayError:code=>'public '+code,isReaderIdentityCurrent:()=>live,
    controller:{chapter:{manifest:{manifestVersion:'v1'}},tile:()=>tile,visiblePages:()=>[]},
    data:{totalCount:()=>1,getData:()=>row},first:0,last:0,iconAction(){},
    inkColor:()=> '#111111',mutedColor:()=> '#666666',surfaceColor:()=> '#F8F4EC',lineColor:()=> '#DDD8D0',
    appThemeScheme:'day',backgroundPreference:'paper',bookTitle:'漫画',title:'本话',offlineProbeStatus:'',
    mounted:true,windowChromeActive:true,controlsVisible:false,chapterEnd:false,presentationGeneration:1,
    recovering:false,openingRetry:false,loginRequiredForControls:false,panel:'',offline:false});
  owner.opened=true;owner.topControls();sdk.properties.flush();
  const code='MANGA_PREFERENCE_SAVE_FAILED';owner.error=code;sdk.properties.flush();
  assert.deepEqual(messages,['public '+code]);assert.equal(owner.error,code);
  assert.equal(owner.controller.tile(0,0),tile,'message presentation never replaces a retained image');
  assert.equal(owner.controlsPresentedForWindow(),false,'an old ordinary error cannot pin the reading controls open');
  owner.topControls();sdk.properties.flush();
  assert.ok(!sdk.nodes(owner).some(node=>node.type==='Text'&&String(node.create).includes('public ')),
    'ordinary opened errors must not reappear as the old embedded message block');
  owner.notifyOpenedError();assert.equal(messages.length,1);
  owner.presentationGeneration++;owner.notifyOpenedError();assert.equal(messages.length,2);
  live=false;owner.error='MANGA_EXIT_FAILED';sdk.properties.flush();assert.equal(messages.length,2);
  live=true;owner.mounted=false;owner.error='MANGA_SEEK_FAILED';sdk.properties.flush();assert.equal(messages.length,2);
  owner.mounted=true;owner.opened=false;owner.error='MANGA_CATALOG_REQUIRED';sdk.properties.flush();
  assert.equal(messages.length,2,'an initial source/chapter failure remains a page state');
  owner.error='';owner.opened=true;tile.image=undefined;tile.error='READING_IMAGE_AUTH_REQUIRED';
  owner.error='READING_IMAGE_AUTH_REQUIRED';sdk.properties.flush();assert.equal(messages.length,2);
  assert.equal(owner.loginRequired(),true,'local image suppression retains the original login admission');
}
await openedErrorSdkProof();
// The two temporary SDK files need distinct inactive diagnostic ids in the
// compiler's process-wide id registry; that node is not rendered in this case.
const oldEmbeddedBlock=source.replace('reader-manga-offline-probe-status','reader-manga-offline-probe-status-negative-control').replace('      if (this.loginRequiredForControls) {',
 "      if (this.error.length > 0 && this.opened) { Text(this.displayError(this.error)).padding(8).backgroundColor(this.surfaceColor()).borderRadius(12); }\n      if (this.loginRequiredForControls) {");
assert.notEqual(oldEmbeddedBlock,source,'negative control restores the actual former opened/error block');
await assert.rejects(openedErrorSdkProof(oldEmbeddedBlock),/ordinary opened errors must not reappear/,
 'actual SDK lowering must expose the reverted embedded error block');
console.log('PASS actual SDK error/opened watches: one brief feedback per presentation, no retained error block, preserved error/pixels, page-state ownership, local-image auth and retired-owner silence; restoring the former block is rejected');

}

}
