import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"author-metadata-retention": {"description": "实际shelf details空作者/来回复用及二类tag", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {

const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {ShelfBookPresentation}=await import('../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts');
const list=readFileSync(new URL('../entry/src/main/ets/features/bookshelf/ShelfBookListDetails.ets',import.meta.url),'utf8');
// Inspect the real SDK-emitted details: two metadata tags, independent manga
// position, compact same-colour facts and the thin whole-book progress track.
const probeSource=list.replace('  build() {', '  build() { Column() {} }\n  @Builder\n  shelfDetails() {');
const Blank=new Proxy({name:'Blank'},{get:(target,key)=>key==='name'?target.name:()=>{}});
const {owner:details}=createReaderBuilderProbe(probeSource,['shelfDetails','metadataTag','positionLabel'],{ShelfBookPresentation,Blank});
details.appThemeScheme='day'; details.mangaRevision=0;
details.book={sourceId:'local',bookId:'empty-author',title:'书名',author:'',lastChapter:'最新章节',readProgress:0};
details.shelfDetails();
const textNodes=()=>[...details.nodes.values()].filter(n=>n.type==='Text');
const verifyAuthor=expected=>{
 const texts=textNodes();
 const author=texts.find(n=>n.create===expected);
 assert.ok(author,'the actual author field stays empty without invented metadata');
 
 
 const latest=texts.find(n=>n.create==='最新：最新章节');
 
 const position=texts.find(n=>n.create==='尚未阅读');
 assert.equal(position.fontColor,latest.fontColor,'secondary facts share one muted colour');
 const title=texts.find(n=>n.create==='书名');
 
 const tags=texts.filter(n=>['小说','本地'].includes(n.create));
 assert.deepEqual(tags.map(n=>n.create),['小说','本地'],'only content type and origin are metadata tags');
 
 const track=[...details.nodes.values()].find(n=>n.type==='Progress');
 
};
verifyAuthor('');
details.book={...details.book,author:'Reader test'};details.replay();verifyAuthor('Reader test');
details.book={...details.book,author:''};details.replay();verifyAuthor('');




}
