import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "optional-position-decoder": {
    "description": "Actual CoreGateway optional position decoder valid/legacy/malformed matrix",
    "resources": []
  },
  "preparation-progress-authority": {
    "description": "Actual Preparation chooses loaded Core progress over conflicting stale seed; fake Gateway/read-size port",
    "resources": []
  }
};

async function case_optional_position_decoder() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const Decoder = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderCoreGateway.ts', import.meta.url),
  ['decodeShelfReadingPosition','requiredNonNegativeInteger','optionalString']);
const decoder = new Decoder();
const valid = {chapterIndex:4,chapterOffset:123,updatedAt:91,bodyVersion:'body',processingVersion:'rules'};
assert.deepEqual(decoder.decodeShelfReadingPosition(valid), {...valid,locationRevision:undefined});
const legacy = {chapterIndex:4,chapterOffset:123,updatedAt:91};
assert.equal(decoder.decodeShelfReadingPosition(legacy).bodyVersion,undefined,'legacy projection has no fabricated body proof');
for(const malformed of [undefined,null,[],{}, {...valid,chapterOffset:-1}, {...valid,chapterIndex:1.5},
  {...valid,updatedAt:-1}, {...valid,updatedAt:Infinity}, {...valid,bodyVersion:''}, {...valid,processingVersion:' '},
  {...valid,bodyVersion:undefined}, {...valid,bodyVersion:123}]) {
  assert.equal(decoder.decodeShelfReadingPosition(malformed),undefined,'invalid optional position is dropped without failing the shelf');
}

}

async function case_preparation_progress_authority() {
const { default: assert } = await import('node:assert/strict');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const core={kind:'restored',progress:{chapterIndex:7,chapterOffset:123,bodyVersion:'core-body',processingVersion:'rules'}};const calls=[];
class Gateway {static async open(){return new Gateway();} async loadToc(){return {bookId:'b',entries:[{index:1,navigable:true},{index:7,navigable:true}]};}async loadProgress(){calls.push('Core progress');return core;}async loadChapter(_book,index,_guard,_refresh,context){calls.push({index,context});return {chapterIndex:index,content:'actual cached body'};}}
const Preparation=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts',import.meta.url),['prepare'],{ReadingSessionFlowGateway:Gateway,preparationMetadataBytes:()=>0,PREPARATION_ITEM_BYTES:1024});
const prep=Object.assign(new Preparation(),{runtime:{supportsCoreCapability:()=>false},textSeed:()=>true,captureValidity:()=>()=>true});
const seed={sourceId:'local',bookId:'b',readingPosition:{chapterIndex:1,chapterOffset:9}};
const actual=await prep.prepare(seed,()=>true,()=>{});assert.equal(actual.progress,core);assert.equal(actual.chapter.chapterIndex,7);assert.deepEqual(calls,['Core progress',{index:7,context:{bodyVersion:'core-body',processingVersion:'rules',anchors:[{id:'restored',offset:123}]}}]);assert.equal(seed.readingPosition.chapterIndex,1,'authority read does not rewrite stale shelf input');

}

const implementations = {'optional-position-decoder':case_optional_position_decoder,'preparation-progress-authority':case_preparation_progress_authority};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
