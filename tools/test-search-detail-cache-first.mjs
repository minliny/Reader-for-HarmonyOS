import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function admission(mode){
const {fixture,seed,book,until}=await import('./lib/reading-entry-index-fixture.mjs');
  const f = fixture(); try { for (const i of [0, 1, 2]) f.bodies.set(f.key('s1', 'book') + ':' + i, '章节内容正在加载，请稍候...');
  if (mode === 'shelved-search') f.shelves.set(f.key('s1', 'book'), book());
  if (mode === 'membership-unknown') f.control.blocked = true;
  await f.host.openRemote({ seed: seed(), sourceName: 'Source', fromSearch: mode !== 'manual',
    sourceSwitchPending: mode === 'pending-switch', resumeImmediately: mode === 'resume',
    fallbackSeeds: [seed('fallback', 's2')], fallbackSourceNames: ['Fallback'] }, f.lease);
  if (mode === 'unshelved-search') { await until(() => f.host.snapshot().verdict === 'readable'); assert.equal(f.host.snapshot().book.sourceId, 's2'); }
  else { assert.equal(f.host.snapshot().book.sourceId, 's1'); assert.equal(f.calls.some(c => c.p?.sourceId === 's2'), false); }
  if (mode === 'resume') assert.equal(f.calls.length, 0);
  else if (mode !== 'manual') assert.equal(f.calls.find(c => c.method === 'bookshelf.get').p.bookId, 'book');
  }finally{f.close();}

}
const modes=['unshelved-search','shelved-search','manual','pending-switch','membership-unknown','resume'];
const definitions=Object.fromEntries(modes.map(mode=>[mode,{description:'Actual Entry preview admission '+mode,resources:[]} ]));
for(const id of selectContractCases(definitions)){await admission(id);recordContractCasePass(id);}
