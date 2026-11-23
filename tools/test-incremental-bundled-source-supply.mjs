import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
const sha256Hex=async text=>createHash('sha256').update(text).digest('hex');
const base=new URL('../entry/src/main/resources/rawfile/',import.meta.url);
const indexText=readFileSync(new URL('bundled-sources/index.json',base),'utf8');
const index=JSON.parse(indexText);
let source=readFileSync(new URL('../entry/src/main/ets/app/IncrementalBundledSourceSupply.ts',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace(/export /g,'');
const supply=new Function('sha256Hex','BUNDLED_SOURCE_INDEX_SHA256','BUNDLED_SOURCE_BUNDLE_ID',
 stripTypeScriptTypes(source)+';return supplyBundledSources;')(sha256Hex,await sha256Hex(indexText),index.bundleId);
function fixture({complete=false,dirty=[],fail=false,stop=false,legacy=[],removed=[],previous=[],unregistered=[]}={}){
 const reads=[],calls=[];let current=true;
 const receipts=[...index.items.filter(i=>!unregistered.includes(i.sourceId))
   .map(i=>({...i,dirty:dirty.includes(i.sourceId)})),...removed];
 return {reads,calls,resources:{digest:index.digest,current:()=>current,
  legacyIds:async()=>legacy,read:async file=>{reads.push(file);if(stop&&file!=='bundled-sources/index.json')current=false;return readFileSync(new URL(file,base),'utf8');},
  request:async p=>{calls.push(p);if(p.operation==='status')return{data:p.bundleId===index.bundleId
   ? {complete,items:receipts}:{complete:false,items:previous}};
   if(p.operation==='apply'&&fail)throw Error('item failed');
   return{data:{accepted:true,changed:true,complete:true}};
  }}};
}
{
 const f=fixture({complete:true});await supply(f.resources);assert.deepEqual(f.reads,[]);assert.equal(f.calls.length,1);
}
{
 const f=fixture();await supply(f.resources);assert.deepEqual(f.reads,['bundled-sources/index.json']);assert.equal(f.calls.at(-1).operation,'finish');
}
{
 const f=fixture({dirty:[index.items[7].sourceId]});const s=await supply(f.resources);
 assert.deepEqual(f.reads,['bundled-sources/index.json',index.items[7].file]);assert.equal(s.installedOrUpgraded,1);
 assert.equal(f.calls.filter(c=>c.operation==='apply').length,1);assert.equal(f.calls.at(-1).operation,'finish');
}
{
 const f=fixture({dirty:[index.items[7].sourceId],fail:true});const s=await supply(f.resources);
 assert.equal(s.failed,1);assert.ok(!f.calls.some(c=>c.operation==='finish'),'failed work cannot seal bundle');
}
{
 const f=fixture({dirty:[index.items[0].sourceId],stop:true});const s=await supply(f.resources);
 assert.equal(s.interrupted,true);assert.ok(!f.calls.some(c=>c.operation==='apply'||c.operation==='finish'));
}
{
 const f=fixture();f.resources.read=async()=>indexText+' ';await assert.rejects(supply(f.resources),/integrity/);
}
{
 const current=index.items[0].sourceId;
 const otherLegacy='https://older-collection.example.invalid/';
 const removedCurrent='https://previous-member.example.invalid/';
 const f=fixture({dirty:[current],legacy:[current,otherLegacy],
  removed:[{sourceId:removedCurrent,itemDigest:'a'.repeat(64),dirty:true}]});
 const result=await supply(f.resources);
 assert.equal(index.bundleId,'reader-tested-book-sources-v2');
 assert.ok(f.calls.filter(call=>call.operation!=='status').every(call=>call.bundleId===index.bundleId));
 assert.deepEqual(f.calls.filter(call=>call.operation==='withdraw').map(call=>call.sourceId),[removedCurrent]);
 assert.equal(f.calls.find(call=>call.operation==='apply').legacyManaged,true);
 assert.ok(f.calls.at(-1).expected.some(item=>item.sourceId===removedCurrent&&item.itemDigest==='withdrawn'));
 assert.ok(!f.calls.at(-1).expected.some(item=>item.sourceId===otherLegacy));
 assert.equal(result.failed,0);
}
{
 const [withdrawn, absent] = index.items;
 const f=fixture({unregistered:[withdrawn.sourceId,absent.sourceId],previous:[
  {sourceId:withdrawn.sourceId,itemDigest:'withdrawn',dirty:false},
  {sourceId:absent.sourceId,itemDigest:absent.itemDigest,dirty:false},
 ]});
 const result=await supply(f.resources);
 assert.deepEqual(f.reads,['bundled-sources/index.json',absent.file]);
 assert.ok(!f.calls.some(call=>call.sourceId===withdrawn.sourceId));
 assert.equal(f.calls.find(call=>call.operation==='apply').legacyManaged,true);
 assert.ok(!f.calls.at(-1).expected.some(item=>item.sourceId===withdrawn.sourceId));
 assert.equal(result.failed,0);
}
console.log('incremental source supply: no-resource unchanged path, selective reads, failure/no seal, cancellation, index integrity, scoped withdrawals, predecessor decisions PASS');
