import{selectContractCases,recordContractCasePass}from'./lib/contract-case-selection.mjs';
const selected=selectContractCases({projection:{description:'Actual scalar/version/chapter/native payload relative-width propagation and sizing',resources:[]},'sdk-image-width':{description:'Actual paged/continuous file and PixelMap Image width modifiers plus negative',resources:[]}});
async function run(id){
if(id==='projection'){
const {default:assert}=await import('node:assert/strict');
const { readFileSync }=await import('node:fs');
const { registerHooks, stripTypeScriptTypes }=await import('node:module');
const { selectedProductionMethods }=await import('./lib/selected-production-methods.mjs');
const { ReadingChapterWindow, hasKnownReadingImageGeometry }=await import('../entry/src/main/ets/features/reading/ReadingChapterWindow.ts');

const hooks=registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return next(`${specifier}.ts`, context);
    throw error;
  }
} });
try{
const { materializeReadingDocument } = await import('../entry/src/main/ets/features/reading/ReadingDocumentProjection.ts');
const base = '../entry/src/main/ets/features/reading/';
const file = name => new URL(`${base}${name}`, import.meta.url);
const document = width => ({ content: '甲😀\n\uFFFC\n乙', blocks: [
  { kind: 'text', text: '甲😀\n', startScalar: 0, endScalar: 3 },
  { kind: 'image', source: 'reader-local-epub://book/logo', startScalar: 3, endScalar: 4,
    ...(width === undefined ? {} : { imageWidthBasisPoints: width }) },
  { kind: 'text', text: '\n乙', startScalar: 4, endScalar: 6 },
] });
const project = width => materializeReadingDocument(document(width), 'local', undefined, {});
const full = await project(undefined), logo = await project(3000), explicitFull = await project(10000);
assert.equal(full.content, logo.content, 'relative layout must not alter canonical Unicode or image anchors');
assert.deepEqual(logo.images.map(i => [i.startScalar, i.endScalar]), [[3, 4]]);
assert.equal(logo.images[0].imageWidthBasisPoints, 3000);
assert.notEqual(full.contentVersion, logo.contentVersion, 'changed image geometry invalidates pagination');
assert.equal(full.contentVersion, explicitFull.contentVersion, 'legacy full-width identity stays stable');
for (const invalid of [0, -1, 10001, 1.5, NaN, '3000'])
  await assert.rejects(project(invalid), /relative layout contract/);

const chapter = { sourceId: 'local', bookId: 'book', chapterIndex: 0, chapterTitle: 'chapter',
  content: logo.content, contentVersion: logo.contentVersion, images: logo.images, extractionVia: 'local' };
const window = new ReadingChapterWindow();
window.configure('local', 'book', [0]); window.setCurrent(chapter);
assert.equal(window.get(0).images[0].imageWidthBasisPoints, 3000, 'chapter defensive copies preserve layout');

const Resolver = selectedProductionMethods(file('ReadingSessionFlowGateway.ts'), 'ReadingSessionFlowGateway', ['resolveReadingImage', 'failedReadingImage'],
  { errorMessageOf: String, diagnosticCodeOf: String, hasKnownReadingImageGeometry });
const resolver = Object.assign(new Resolver(), { sourceId: 'local', bookId: 'book', source: { kind: 'local' },
  runtimeOwner: { async loadReadingImage() { return { width: 357, height: 359, fileUri: 'file:///logo', revision: 'r1' }; } } });
const ready = await resolver.resolveReadingImage(chapter, logo.images[0]);
assert.equal(ready.imageWidthBasisPoints, 3000, 'native decode cannot discard Core CSS width');
const Owner = selectedProductionMethods(file('LocalReadingExperience.ets'), 'ReadingExperience', ['scaledReadingImageHeight'], {hasKnownReadingImageGeometry});
const owner = Object.assign(new Owner(), { measurementTextWidth: () => 100 });
assert.ok(Math.abs(owner.scaledReadingImageHeight(ready, 500) - 30 * 359 / 357) < 1e-9);
assert.ok(Math.abs(owner.scaledReadingImageHeight({ ...ready, imageWidthBasisPoints: undefined }, 500) - 100 * 359 / 357) < 1e-9);
assert.equal(owner.scaledReadingImageHeight(ready, 20), 20, 'page image height bound remains enforced');

const surface = readFileSync(file('ReadingSurface.ets'), 'utf8');
const fragmentSource = surface.slice(surface.indexOf('export class ReadingSurfacePageFragment'), surface.indexOf('/** Shared scalar-aware'));
const Fragment = new Function(`${stripTypeScriptTypes(fragmentSource).replace('export ', '')}; return ReadingSurfacePageFragment;`)();
assert.equal(new Fragment('legacy', '', true).imageWidthBasisPoints, 10000);
assert.equal(new Fragment('logo', '', true, 3, 4, undefined, 30, 'file:///logo', 30, 3000).imageWidthBasisPoints, 3000);
}finally{hooks.deregister();}
}else{

 const {default:assert}=await import('node:assert/strict');const{readFileSync}=await import('node:fs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const dir=new URL('../entry/src/main/ets/features/reading/',import.meta.url);
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
 function render(name,source,width,kind){
  const fragment={id:'image',text:'',imageWidthBasisPoints:width,imageHeight:30,isParagraphStart:false,...(kind==='file'?{fileUri:'file:///logo'}:{imageSource:{pixel:'owned'}})};
  const childNames=name==='ReadingSurface'?['ReaderPaperBackground','ReaderPageChrome','ReaderNativeParagraphView','ReaderReadingTextFragment']:['ReadingSurface','ReaderNativeParagraphView','ReaderReadingTextFragment'];
  const childSources=Object.fromEntries(childNames.map(n=>[n,readFileSync(new URL((n==='ReaderReadingTextFragment'?'ReadingSurface':n)+'.ets',dir),'utf8')]));
  const deps={...Object.fromEntries(childNames.map(n=>[n,Child])),CONTINUOUS_TITLE_ID:'title',ImageInterpolation:{High:'high'},GesturePriority:{Parallel:'parallel'},
   LazyForEach:{create(_id,_owner,data,generate){assert.equal(data.totalCount(),1);generate(data.getData(0),0);},pop(){}}};
  const owner=createReaderBuilderProbe(source,['build'],deps,{childSources,componentName:name}).owner;
  Object.assign(owner,{appearance:{activeTheme:'day',paragraphSpacing:0},layout:{widthClass:'compact',titleToBodySpacingVp:18,contentTop:0,contentBottom:0,contentLeft:0,contentRight:0},
   showChapterTitle:false,renderFragments:()=>[fragment],bottomJustifyGap:0,contentInsets:()=>({}),themeStyle:()=>({paperStart:'#fff'}),staticSnapshotId:'',usesHighlightCanvas:()=>false,
   listMountIdentity:'mount',initialListIndex:()=>0,fragmentDataSource:{totalCount:()=>1,getData:()=>fragment},hasTitleItem:()=>false,fragmentRenderKey:()=>fragment.id,interactionEnabled:true});
  const previousGesture=globalThis.Gesture,previousTap=globalThis.TapGesture;
  globalThis.Gesture={create(){},pop(){}};globalThis.TapGesture={create(){},onAction(){},pop(){}};
  try{owner.initialRender();}finally{if(previousGesture===undefined)delete globalThis.Gesture;else globalThis.Gesture=previousGesture;if(previousTap===undefined)delete globalThis.TapGesture;else globalThis.TapGesture=previousTap;}
  const images=[...owner.nodes.values()].filter(n=>n.type==='Image');assert.equal(images.length,1,'actual chosen image branch paints exactly one image');
  assert.equal(images[0].width,`${width/100}%`,'actual SDK Image consumes relative Core width');assert.equal(images[0].height,30);
 }
 for(const name of ['ReadingSurface','ReaderContinuousReadingStage']){
  const source=readFileSync(new URL(name+'.ets',dir),'utf8');
  for(const kind of ['file','pixel'])for(const width of [3000,5500,10000])render(name,source,width,kind);
  const mutant=source.replaceAll('.width(`${fragment.imageWidthBasisPoints / 100}%`)',".width('100%')");assert.notEqual(mutant,source);
  assert.throws(()=>render(name,mutant,3000,'file'),/actual SDK Image consumes relative Core width/,'dead width text cannot rescue a disconnected actual Image modifier');
 }

}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
