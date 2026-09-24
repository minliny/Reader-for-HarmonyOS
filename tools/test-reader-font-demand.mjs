import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as families from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
const source=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderFonts.ets',import.meta.url),'utf8')
 .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'').replace(/^export /gm,'');
const calls=[], pending=[]; let synchronousFailure=false;
const text={FontCollection:{getGlobalInstance:()=>({loadFontWithCheck(family,src){
 if(synchronousFailure)throw Error('sync font error');
 calls.push({family,src});return new Promise((resolve,reject)=>pending.push({resolve,reject}));
}})}};
const loaderSource=readFileSync(new URL('../entry/src/main/ets/app/ReaderFontLoadHost.ts',import.meta.url),'utf8')
 .replace(/^import.*$/gm,'').replace(/^export /gm,'');
const {loadReaderFontChecked,readerFontLoadReady}=new Function('text',stripTypeScriptTypes(loaderSource)+
 ';return {loadReaderFontChecked,readerFontLoadReady};')(text);
const registrar=new Function(...Object.keys(families),'$rawfile','loadReaderFontChecked','readerFontLoadReady','hilog',stripTypeScriptTypes(source)+
 ';return {registerReaderFonts,registerReaderShelfFonts,readerRegisteredFontFamily,prepareReaderFonts,prepareReaderShelfFonts,prepareReaderFontFamily,readerFontFamilyReady,loadReaderFontChecked};')
 (...Object.values(families),value=>value,loadReaderFontChecked,readerFontLoadReady,{warn(){}});
const platform={registerFont(){throw Error('unchecked registration must not run');}};
assert.equal(registrar.readerFontFamilyReady('HarmonyOS Sans'),true);
assert.equal(registrar.readerFontFamilyReady('unknown platform family'),false);
assert.equal(registrar.readerFontFamilyReady('ReaderCustom_owned'),false);
registrar.registerReaderShelfFonts(platform);registrar.registerReaderShelfFonts(platform);
assert.deepEqual(calls.map(call=>call.family),[families.READER_FONT_INTER,
 families.READER_FONT_NOTO_SERIF_SC_BOLD,families.READER_FONT_NOTO_SANS_SC],
 'the first bookshelf frame loads only faces it uses');
let shelfReady=false;const shelf=registrar.prepareReaderShelfFonts().then(()=>{shelfReady=true;});
await Promise.resolve();assert.equal(shelfReady,false,'shelf submission is not readiness');
pending.splice(0).forEach(p=>p.resolve());await shelf;assert.equal(shelfReady,true);
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
