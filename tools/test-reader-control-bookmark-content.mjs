import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'list-extent':{description:'Actual standalone BookmarkList deferred extent mutation and stale lifecycle guard',resources:[]},
 'row-geometry':{description:'Current SDK bookmark row actors against archived independent source track; required SDK',resources:[]},
 'row-scope':{description:'Current retained bookmark row exact anchor/scope and separate ownership/location labels',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
 const {default:assert}=await import('node:assert/strict');const {readFileSync}=await import('node:fs');
 const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ReaderControlBookmarkGeometry.ts');
 const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const row=read('entry/src/main/ets/features/reading/ReaderBookmarkRow.ets');
 const constants=selectedProductionValues(new URL('../entry/src/main/ets/features/reading/ReaderBookmarkRow.ets',import.meta.url),['BOOKMARK_ROW_HEIGHT','BOOKMARK_PENDING_LABEL']);
 const near=(a,b,why='')=>assert.ok(Math.abs(a-b)<1e-8,`${why}: ${a} != ${b}`);
 if(selectedCase==='list-extent'){
  const pending=[];
  const List=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ReaderBookmarkList.ets',import.meta.url),'ReaderBookmarkList',
   ['rowHeight','stableLayoutEnabled','layoutRowHeightValue','layoutPaddingXValue','onRowGeometryChanged','scheduleRowGeometryFlush','aboutToAppear','aboutToDisappear'],
   {...constants,sampleReaderControlBookmark,setTimeout:callback=>pending.push(callback)});
  const owner=Object.assign(new List(),{embeddedInControl:false,motionProgress:0,rowWidth:254,layoutRowHeight:0,listPaddingX:10,layoutPaddingX:-1,
   itemSizes:{childDefaultSize:0},mounted:false,rowGeometryGeneration:0,rowGeometryLifecycleGeneration:0,
   rowGeometryFlushScheduled:false,rowGeometryFlushLifecycleGeneration:-1,pendingRowGeometryHeight:undefined});
  owner.aboutToAppear();assert.equal(owner.itemSizes.childDefaultSize,constants.BOOKMARK_ROW_HEIGHT);
  const original=owner.itemSizes;owner.onRowGeometryChanged();owner.onRowGeometryChanged();assert.equal(pending.length,1,'coalesced next-turn extent write');
  assert.equal(owner.layoutPaddingXValue(),10);owner.layoutPaddingX=23;assert.equal(owner.layoutPaddingXValue(),23);
  owner.itemSizes.childDefaultSize=0;const stale=pending.shift();owner.aboutToDisappear();stale();assert.equal(owner.itemSizes.childDefaultSize,0,'stale native extent callback cannot write after teardown');
  owner.aboutToAppear();pending.shift()();assert.equal(owner.itemSizes,original);assert.equal(owner.itemSizes.childDefaultSize,constants.BOOKMARK_ROW_HEIGHT);
  owner.aboutToDisappear();return;
 }
 if(selectedCase==='row-geometry'){
const fixture = JSON.parse(read('tools/fixtures/reader-control-bookmark-live-20260906.json'));
const design = fixture.sources[0].result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
const motion = JSON.parse(fixture.sources[1].result.content.find(c => c.type === 'text').text).nodes;
assert.equal(fixture.fileKey, 'klhs2jMM4MncaJFqZMfqEK');
assert.match(design, /left-\[11px\] overflow-clip top-0 w-\[316px\][^\n]*1841:3781/);
assert.match(design, /top-\[99px\][^\n]*1974:431/);
const near = (a, b, why = '') => assert.ok(Math.abs(a - b) < 1e-8, `${why}: ${a} != ${b}`);
function track(id, property, p) {
  const css = motion.find(n => n.nodeId === id).codeSnippets.css;
  const body = css.slice(css.indexOf('@keyframes kf_' + id.replace(':', '_') + '_' + property + '_0'));
  const value = percent => body.match(new RegExp('(?:^|\\s)' + percent + '% \\{ ' + property + ': ([^;]+);'))[1]
    .split(' ').map(Number.parseFloat);
  const a = value(0), b = value(100);
  return a.map((v, i) => v + (b[i] - v) * p);
}
for(const p of [0,.25,.5,.75,1,.75,0]){
 const width=track('1841:3781','width',p)[0],frame=sampleReaderControlBookmark(p,width);
 near(frame.card.width,width);near(frame.card.height,track('1841:3781','height',p)[0]);
 for(const [key,id,x,y] of [['title','1841:3782',10,9],['accent','1841:3783',10,33],['excerpt','1841:3784',28,32],['divider','1841:3785',10,73]]){
  const delta=track(id,'translate',p);near(frame[key].x,x+delta[0]);near(frame[key].y,y+delta[1]);
  if(key==='accent'||key==='excerpt')near(frame[key].height,track(id,'height',p)[0]);
  if(key==='excerpt'||key==='divider')near(frame[key].width,track(id,'width',p)[0]);
 }
 const first=99+track('1841:3781','translate',p)[1],second=173+track('1841:3786','translate',p)[1];near(second-first,frame.card.height);
}
  function mounted(source) {
    const { owner } = createReaderBuilderProbe(source, ['frame', 'motionBody'], {
      sampleReaderControlBookmark, BOOKMARK_ROW_HEIGHT: 74,
      BOOKMARK_EXCERPT_ACCENT: '#8C9B8466', BOOKMARK_PENDING_LABEL: '待确认' });
    Object.assign(owner, { motionProgress: 0, availableWidth: 254,
      row: { bookmarkId: 'a', chapterIndex: 2, chapterOffset: 3, chapterTitle: '旧章节', excerpt: '旧片段',
        positionLabel: '20%', timeLabel: '今天', identityStatus: 'pendingConfirmation' } });
    const calls = []; owner.onSelectBookmark = (...args) => calls.push(args);
    owner.motionBody();
    const card = owner.nodes.get(0), click = card.onClick;
    const title = [...owner.nodes.values()].find(n => n.type === 'Row');
    const excerpt = [...owner.nodes.values()].find(n => n.create === '旧片段');
    owner.row = { ...owner.row, chapterTitle: '新章节', excerpt: '新片段', bookmarkId: 'b', chapterOffset: 8 };
    for (const p of [1, .5, 0, .25, 1]) {
      Object.assign(owner, { motionProgress: p, availableWidth: 254 + 62 * p }); owner.replay();
      const f = sampleReaderControlBookmark(p, owner.availableWidth);
      assert.equal(card.clip, true, 'same real card clips its own child actors');
      near(card.height, f.card.height); near(card.width, f.card.width);
      assert.deepEqual(title.position, { x: f.title.x, y: f.title.y });
      assert.deepEqual(excerpt.position, { x: f.excerpt.x, y: f.excerpt.y });
      near(excerpt.width, f.excerpt.width); near(excerpt.height, f.excerpt.height);
      assert.equal(excerpt.create, '新片段'); assert.equal(excerpt.fontSize, 9); assert.equal(excerpt.lineHeight, 14);
      const text = [...owner.nodes.values()].find(n => n.create === '新章节');
      assert.ok(text, 'mounted title follows current business payload'); assert.equal(text.fontSize, 11); assert.equal(text.lineHeight, 14);
      for (const value of ['20%', '今天', '待确认']) assert.ok([...owner.nodes.values()].some(n => n.create === value));
    }
    click(); assert.deepEqual(calls, [['b', 2, 8, undefined]], 'retained click selects the latest exact bookmark identity/offset');
  }
  mounted(row);
  assert.throws(() => mounted(row.replace('.height(this.frame().card.height).clip(true)',
    '.height(BOOKMARK_ROW_HEIGHT).clip(true)')), /!=/,
  'reject a fixed height returned to the mounted card');
  assert.throws(() => mounted(row.replace('.height(this.frame().card.height).clip(true)',
    '.height(this.frame().card.height).clip(false)')), /real card clips/);
  console.log('Actual SDK nonempty bookmark row: mounted reversible actors, live metadata/identity and clip mutations PASS');
return;
}
// The production row consumes the independent position label and keeps the
// saved quote/callback proof through scope-only updates of a retained card.
{
 const {projectReaderBookmarkRows}=await import('../entry/src/main/ets/features/reading/ReaderBookmarkProjection.ts');
 const identity={libraryBookId:'lib',sourceId:'remote',bookId:'b',bookName:'书',bookAuthor:'作者'};
 const mark={time:92,chapterIndex:0,chapterOffset:12,chapterTitle:'章节',content:'备注',bookText:'刷新前保留的原文'};
 const entries=[{index:0,title:'章节',bookmarks:[mark]}];
 const model=projectReaderBookmarkRows(entries,'',identity,new Map([[0,24]]))[0];
 for(const builder of ['motionBody','legacyBody']) {
  const {owner}=createReaderBuilderProbe(row,['frame',builder],{sampleReaderControlBookmark,BOOKMARK_ROW_HEIGHT:74,BOOKMARK_PENDING_LABEL:'待确认'});
  const calls=[];Object.assign(owner,{row:model,motionProgress:1,availableWidth:316,onSelectBookmark:(...args)=>calls.push(args)});
  owner[builder]();
  assert.ok([...owner.nodes.values()].some(n=>n.type==='Text'&&n.create==='位置待恢复'));
  assert.ok([...owner.nodes.values()].some(n=>n.type==='Text'&&n.create==='刷新前保留的原文'));
  assert.equal([...owner.nodes.values()].filter(n=>n.type==='Text'&&n.create==='待确认').length,0,'position uncertainty does not change book ownership badge');
  const card=[...owner.nodes.values()].find(n=>typeof n.onClick==='function');card.onClick();
  assert.equal(calls.at(-1)[2],12);assert.equal(calls.at(-1)[3],undefined,'UI does not synthesize a new scope or chapter-start bookmark');
  const scoped={...mark,positionScope:{sourceId:'remote',bookId:'b',chapterIndex:0,bodyVersion:'new',processingVersion:'p'}};
  owner.row=projectReaderBookmarkRows([{...entries[0],bookmarks:[scoped]}],'',identity,new Map([[0,24]]))[0];owner.replay();
  card.onClick();assert.deepEqual(calls.at(-1)[3],scoped.positionScope,'retained callback uses latest admitted proof');
  assert.ok([...owner.nodes.values()].some(n=>n.type==='Text'&&n.create==='50%'));
 }
}
console.log('PASS actual quick/full bookmark row Builders preserve historical excerpt, separate location/owner labels and retain latest admitted click proof');

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
