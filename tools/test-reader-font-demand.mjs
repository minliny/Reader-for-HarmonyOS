import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import * as families from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
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
 families.READER_FONT_NOTO_SANS_SC_UI_REGULAR, families.READER_FONT_NOTO_SANS_SC_UI_BOLD],
 'the first bookshelf frame loads only faces it uses, including the static UI bold tab/header face');
let shelfReady=false;const shelf=registrar.prepareReaderShelfFonts().then(()=>{shelfReady=true;});
await Promise.resolve();assert.equal(shelfReady,false,'shelf submission is not readiness');
pending.filter(p=>p.family!=='ReaderNotoSansSCUIRegular').forEach(p=>p.resolve());
await new Promise(resolve=>setImmediate(resolve));
assert.equal(shelfReady,false,'the bookshelf must wait for its fixed-weight list face, not render a fallback first');
assert.equal(registrar.readerFontFamilyReady('ReaderNotoSansSCUIRegular'),false);
pending.find(p=>p.family==='ReaderNotoSansSCUIRegular').resolve();
await shelf;pending.splice(0);assert.equal(shelfReady,true);
assert.equal(registrar.readerFontFamilyReady('ReaderNotoSansSCUIRegular'),true);
registrar.registerReaderFonts(platform);registrar.registerReaderFonts(platform);
assert.equal(calls.length,7);
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
 families.READER_FONT_NOTO_SANS_SC_UI_600,families.READER_FONT_NOTO_SANS_SC_UI_650,
 families.READER_FONT_NOTO_SANS_SC_UI_900];
assert.ok(!calls.some(c=>mangaFamilies.includes(c.family)),
 'shelf/startup must not load manga-only static faces');
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
const beforeManga=calls.length;
let mangaReady=false;const manga=registrar.prepareMangaSheetFonts().then(value=>{mangaReady=value;});
assert.deepEqual(calls.slice(beforeManga).map(c=>c.family),mangaFamilies);
assert.deepEqual(calls.slice(beforeManga).map(c=>c.src),provenance.outputs.map(f=>f.output.split('/').at(-1)));
const mangaPending=pending.splice(0);
mangaPending[0].resolve();mangaPending[1].resolve();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(mangaReady,false,'chapter and group faces cannot authorize a panel while its header face is pending');
assert.equal(registrar.readerFontFamilyReady(families.READER_FONT_NOTO_SANS_SC_UI_650),false);
mangaPending[2].resolve();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(registrar.readerFontFamilyReady(families.READER_FONT_NOTO_SANS_SC_UI_650),true);
assert.equal(mangaReady,false,'the registered header does not authorize a still-pending fixed panel title');
mangaPending[3].reject(Error('900 failed'));await assert.rejects(manga,/900 failed/);
assert.equal(registrar.readerFontFamilyReady(mangaFamilies[3]),false);
const mangaRetry=registrar.prepareMangaSheetFonts();
assert.equal(calls.length,beforeManga+5,'only failed face is reloaded');
pending.shift().resolve();assert.equal(await mangaRetry,true);
await registrar.prepareMangaSheetFonts();assert.equal(calls.length,beforeManga+5);

const previewLoads=[];const previewPending=[];const previewReady=new Set(['HarmonyOS Sans']);
const Preview=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets',import.meta.url),
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
