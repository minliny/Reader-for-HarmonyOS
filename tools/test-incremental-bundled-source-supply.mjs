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
const supply=new Function('sha256Hex','BUNDLED_SOURCE_INDEX_SHA256',stripTypeScriptTypes(source)+';return supplyBundledSources;')(sha256Hex,await sha256Hex(indexText));
function fixture({complete=false,dirty=[],fail=false,stop=false}={}){
 const reads=[],calls=[];let current=true;
 const receipts=index.items.map(i=>({...i,dirty:dirty.includes(i.sourceId)}));
 return {reads,calls,resources:{digest:index.digest,current:()=>current,
  legacyIds:async()=>[],read:async file=>{reads.push(file);if(stop&&file!=='bundled-sources/index.json')current=false;return readFileSync(new URL(file,base),'utf8');},
  request:async p=>{calls.push(p);if(p.operation==='status')return{data:{complete,items:receipts}};
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
console.log('incremental source supply: no-resource unchanged path, selective reads, failure/no seal, cancellation, index integrity PASS');
