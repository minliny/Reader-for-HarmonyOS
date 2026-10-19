import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({load:{description:'Actual checked font-load readiness, lazy faces and failed receipt retry',resources:[]},preview:{description:'Actual visible preview serialized loading and fallback admission',resources:[]},assets:{description:'Manifest hashes and actual upstream fontTools tables/cmap/static weights',resources:[]}});
async function run(id){
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
if(id==='load'){
const {stripTypeScriptTypes}=await import('node:module');
const families=await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const source=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderFonts.ets',import.meta.url),'utf8')
 .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'').replace(/^export /gm,'');
const calls=[], pending=[]; let synchronousFailure=false;
const text={FontCollection:{getGlobalInstance:()=>({loadFontWithCheck(family,src){
 if(synchronousFailure)throw Error('sync font error');
 calls.push({family,src});return new Promise((resolve,reject)=>pending.push({family,resolve,reject}));
}})}};
const loaderSource=readFileSync(new URL('../entry/src/main/ets/app/ReaderFontLoadHost.ts',import.meta.url),'utf8')
 .replace(/^import.*$/gm,'').replace(/^export /gm,'');
const {loadReaderFontChecked,readerFontLoadReady}=new Function('text',stripTypeScriptTypes(loaderSource)+
 ';return {loadReaderFontChecked,readerFontLoadReady};')(text);
const registrar=new Function(...Object.keys(families),'$rawfile','loadReaderFontChecked','readerFontLoadReady','hilog',stripTypeScriptTypes(source)+
 ';return {registerReaderFonts,registerReaderShelfFonts,readerRegisteredFontFamily,prepareReaderFonts,prepareReaderShelfFonts,prepareReaderFontFamily,readerFontFamilyReady,loadReaderFontChecked,prepareMangaSheetFonts};')
 (...Object.values(families),value=>value,loadReaderFontChecked,readerFontLoadReady,{warn(){}});
const platform={registerFont(){throw Error('unchecked registration must not run');}};
assert.equal(registrar.readerFontFamilyReady('HarmonyOS Sans'),true);
assert.equal(registrar.readerFontFamilyReady('unknown platform family'),false);
assert.equal(registrar.readerFontFamilyReady('ReaderCustom_owned'),false);
registrar.registerReaderShelfFonts(platform);registrar.registerReaderShelfFonts(platform);
assert.deepEqual(calls.map(call=>call.family),[families.READER_FONT_INTER,
 families.READER_FONT_NOTO_SERIF_SC_BOLD,families.READER_FONT_NOTO_SANS_SC,
 families.READER_FONT_NOTO_SANS_SC_UI_REGULAR, families.READER_FONT_NOTO_SANS_SC_UI_BOLD,
 families.READER_FONT_NOTO_SANS_SC_UI_MEDIUM, families.READER_FONT_NOTO_SANS_SC_UI_600],
 'first-frame shelf messages have checked static 400/500/600 faces as well as ordinary shelf fonts');
let shelfReady=false;const shelf=registrar.prepareReaderShelfFonts().then(()=>{shelfReady=true;});
await Promise.resolve();assert.equal(shelfReady,false,'shelf submission is not readiness');
const messageFaces=['ReaderNotoSansSCUIRegular','ReaderNotoSansSCUIMedium','ReaderMangaSans600'];
pending.filter(p=>!messageFaces.includes(p.family)).forEach(p=>p.resolve());
await new Promise(resolve=>setImmediate(resolve));
assert.equal(shelfReady,false,'the bookshelf must wait for its fixed-weight list face, not render a fallback first');
assert.equal(registrar.readerFontFamilyReady('ReaderNotoSansSCUIRegular'),false);
pending.find(p=>p.family==='ReaderNotoSansSCUIRegular').resolve();
await new Promise(resolve=>setImmediate(resolve));assert.equal(shelfReady,false,'message action and title must not paint using an unready fallback');
pending.find(p=>p.family==='ReaderNotoSansSCUIMedium').resolve();
await new Promise(resolve=>setImmediate(resolve));assert.equal(shelfReady,false,'message title 600 still requires its own checked receipt');
pending.find(p=>p.family==='ReaderMangaSans600').resolve();
await shelf;pending.splice(0);assert.equal(shelfReady,true);
assert.equal(registrar.readerFontFamilyReady('ReaderNotoSansSCUIRegular'),true);
assert.ok(messageFaces.every(family=>registrar.readerFontFamilyReady(family)));
registrar.registerReaderFonts(platform);registrar.registerReaderFonts(platform);
assert.equal(calls.length,8);
assert.ok(!calls.some(c=>/WenKai|Fangsong|Sarasa/.test(c.src)),'startup does not load unused optional faces');
let ready=false;const base=registrar.prepareReaderFonts().then(()=>{ready=true;});
await Promise.resolve();assert.equal(ready,false,'submission is not readiness');
assert.equal(registrar.readerFontFamilyReady(families.READER_FONT_NOTO_SERIF_SC_REGULAR),false);
pending.splice(0).forEach(p=>p.resolve());await base;assert.equal(ready,true);
assert.equal(registrar.readerFontFamilyReady(families.READER_FONT_NOTO_SERIF_SC_REGULAR),true);
for(const family of [families.READER_FONT_LXGW_WENKAI_LITE,families.READER_FONT_LXGW_WENKAI_GB_LITE,
 families.READER_FONT_ZHUQUE_FANGSONG,families.READER_FONT_SARASA_MONO_SC]){
 const before=calls.length, first=registrar.prepareReaderFontFamily(family);
 assert.equal(registrar.prepareReaderFontFamily(family),first,'share actual receipt');
 assert.equal(registrar.readerRegisteredFontFamily(platform,family),family);
 assert.equal(registrar.readerFontFamilyReady(family),false);
 assert.equal(calls.length,before+1);pending.shift().resolve();await first;
 assert.equal(registrar.readerFontFamilyReady(family),true);
}
const before=calls.length;
await registrar.prepareReaderFontFamily('HarmonyOS Sans');
await registrar.prepareReaderFontFamily('ReaderCustom_owned');
assert.equal(calls.length,before,'system/custom file ownership preserved');
const failure=registrar.loadReaderFontChecked('ReaderCustom_hash','file:///owned/hash.ttf');
assert.equal(registrar.readerFontFamilyReady('ReaderCustom_hash'),false);
pending.shift().reject(Error('invalid font'));await assert.rejects(failure,/invalid font/);
assert.equal(registrar.readerFontFamilyReady('ReaderCustom_hash'),false);
const retry=registrar.loadReaderFontChecked('ReaderCustom_hash','file:///owned/hash.ttf');
assert.equal(calls.length,before+2);pending.shift().resolve();await retry;
assert.equal(registrar.readerFontFamilyReady('ReaderCustom_hash'),true);
assert.equal(registrar.loadReaderFontChecked('ReaderCustom_hash','file:///owned/hash.ttf'),retry);
synchronousFailure=true;await assert.rejects(registrar.loadReaderFontChecked('new-face','file:///new.ttf'),/sync font error/);synchronousFailure=false;
assert.equal(registrar.readerFontFamilyReady('new-face'),false);

// Native custom VF weight failed physically on the VM. Bind on-demand panel
// admission to immutable, pre-instantiated assets, not a weight setter alone.
const mangaFamilies=[families.READER_FONT_NOTO_SANS_SC_UI_550,
 families.READER_FONT_NOTO_SANS_SC_UI_650,
 families.READER_FONT_NOTO_SANS_SC_UI_900];
assert.ok(!calls.some(c=>mangaFamilies.includes(c.family)),
 'shelf/startup must not load manga-only static faces');
const provenance=JSON.parse(readFileSync(new URL('../docs/ui-design/MANGA_SHEET_FONTS_PROVENANCE.json',import.meta.url),'utf8'));
const beforeManga=calls.length;
let mangaReady=false;const manga=registrar.prepareMangaSheetFonts().then(value=>{mangaReady=value;});
assert.deepEqual(calls.slice(beforeManga).map(c=>c.family),mangaFamilies);
assert.deepEqual(calls.slice(beforeManga).map(c=>c.src),provenance.outputs.filter(f=>f.axis.wght!==600).map(f=>f.output.split('/').at(-1)),
 'message title 600 reuses its completed startup receipt instead of loading again for manga');
const mangaPending=pending.splice(0);
mangaPending[0].resolve();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(mangaReady,false,'chapter and group faces cannot authorize a panel while its header face is pending');
assert.equal(registrar.readerFontFamilyReady(families.READER_FONT_NOTO_SANS_SC_UI_650),false);
mangaPending[1].resolve();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(registrar.readerFontFamilyReady(families.READER_FONT_NOTO_SANS_SC_UI_650),true);
assert.equal(mangaReady,false,'the registered header does not authorize a still-pending fixed panel title');
mangaPending[2].reject(Error('900 failed'));await assert.rejects(manga,/900 failed/);
assert.equal(registrar.readerFontFamilyReady(mangaFamilies[2]),false);
const mangaRetry=registrar.prepareMangaSheetFonts();
assert.equal(calls.length,beforeManga+4,'only failed face is reloaded');
pending.shift().resolve();assert.equal(await mangaRetry,true);
await registrar.prepareMangaSheetFonts();assert.equal(calls.length,beforeManga+4);


}else if(id==='preview'){
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const previewLoads=[];const previewPending=[];const previewReady=new Set(['HarmonyOS Sans']);
const Preview=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets',import.meta.url), 'ReaderControlAppearanceContent',
 ['previewFamily','fontPreviewReady','visiblePreviewFamily','requestVisibleFontPreview','loadNextFontPreview'],{
  readerAppearanceFontSlotFamily:(_snapshot,font)=>({kai:'HeavyKai',mono:'HeavyMono',import:'ReaderNotoSansSC',custom:'ReaderCustom_hash'}[font]??font),
  readerFontFamilyReady:family=>previewReady.has(family),
  prepareReaderFontFamily:family=>{previewLoads.push(family);return new Promise(resolve=>previewPending.push(()=>{previewReady.add(family);resolve();}));},
  hilog:{warn(){}},
 });
const preview=Object.assign(new Preview(),{snapshot:{},readyPreviewFamilies:[],previewQueue:[],
 requestedPreviewFamilies:new Set(),previewLoadActive:false,previewLifecycle:0});
assert.equal(preview.visiblePreviewFamily('kai'),'HarmonyOS Sans','unready preview does not render a substituted face as ready');
preview.requestVisibleFontPreview('kai');preview.requestVisibleFontPreview('mono');
preview.requestVisibleFontPreview('kai');preview.requestVisibleFontPreview('custom');
assert.deepEqual(previewLoads,['HeavyKai'],'visible optional font loading is serialized and deduplicated');
previewPending.shift()();await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(previewLoads,['HeavyKai','HeavyMono']);
assert.equal(preview.visiblePreviewFamily('kai'),'HeavyKai','first preview repaints only after checked load');
assert.equal(preview.visiblePreviewFamily('mono'),'HarmonyOS Sans');
previewPending.shift()();await new Promise(resolve=>setImmediate(resolve));
assert.equal(preview.visiblePreviewFamily('mono'),'HeavyMono');
console.log('font demand: checked readiness, lazy serial visible previews, shared loads and retry PASS');

}else{
const {createHash}=await import('node:crypto');
const provenance=JSON.parse(readFileSync(new URL('../docs/ui-design/MANGA_SHEET_FONTS_PROVENANCE.json',import.meta.url),'utf8'));
const hash=relative=>createHash('sha256').update(readFileSync(new URL(`../${relative}`,import.meta.url))).digest('hex');
assert.equal(hash(provenance.source),provenance.sourceSha256);
assert.equal(hash(provenance.reused400.output),provenance.reused400.sha256);
assert.equal(provenance.tool,'fonttools 4.60.2 instantiateVariableFont');
assert.deepEqual(provenance.outputs.map(f=>f.axis.wght),[550,600,650,900]);
for(const output of provenance.outputs){
 assert.equal(output.variable,false);assert.equal(hash(output.output),output.sha256);
 if(output.axis.wght!==900){
  assert.equal(output.coverage,'fullCJK');
  assert.ok(output.glyphCount>30000&&output.unicodeCount>30000,'keep full CJK chapter coverage');
 }else{
  assert.equal(output.coverage,'fixedPanelTitles');assert.ok(output.bytes<100000);
  assert.deepEqual(output.requiredTitles,['章节目录','阅读方式','漫画阅读设置','更多','本书下载','本话下载']);
 }
}

const {execFileSync}=await import('node:child_process');
const {fileURLToPath}=await import('node:url');
const parsed=JSON.parse(execFileSync(process.env.READER_FONTTOOLS_PYTHON || 'python3',['-c',String.raw`
import json,sys,fontTools
from fontTools.ttLib import TTFont
manifest=json.load(open(sys.argv[1]))
root=sys.argv[2]
result=[]
for output in manifest['outputs']:
    with TTFont(root+'/'+output['output'],lazy=False) as font:
        cmap=font.getBestCmap()
        titles=''.join(output['requiredTitles'])
        assert 'fvar' not in font, 'static face must have no variable axes'
        assert font['OS/2'].usWeightClass==output['axis']['wght'], 'actual static weight'
        assert all(ord(c) in cmap for c in titles), 'fixed titles have actual cmap entries'
        if output['coverage']=='fullCJK':
            assert len(cmap)>30000 and len(font.getGlyphOrder())>30000, 'actual full CJK font tables'
        assert output['outlineTable'] in font, 'actual outline table'
        assert any(n.toUnicode()==output['family'] for n in font['name'].names if n.nameID in [1,4,6,16]), 'actual family identity'
        result.append({'file':output['output'],'glyphCount':len(font.getGlyphOrder()),'unicodeCount':len(cmap),'weight':font['OS/2'].usWeightClass})
print(json.dumps({'python':sys.version,'fontTools':fontTools.__version__,'faces':result}))
`,fileURLToPath(new URL('../docs/ui-design/MANGA_SHEET_FONTS_PROVENANCE.json',import.meta.url)),fileURLToPath(new URL('../',import.meta.url))],{encoding:'utf8',timeout:20000}));
assert.equal(parsed.faces.length,provenance.outputs.length);
console.log(JSON.stringify({kind:'parsed-font-table-evidence',python:parsed.python,fontTools:parsed.fontTools,faces:parsed.faces}));

}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
