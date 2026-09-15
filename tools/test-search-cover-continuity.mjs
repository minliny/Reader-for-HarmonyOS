import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { bookIntroText } from '../entry/src/main/ets/features/common/BookIntroText.ts';
import { bookAuthorLabel } from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const source = read('features/search/SearchPage.ets');
const classes = source.slice(source.indexOf('@Observed\nclass SearchBookGroup'), source.indexOf('/**\n * Figma-backed Book Search')).replace('@Observed\n', '');
const { SearchBookGroup, SearchResultDataSource } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(`
const DataOperationType = { ADD:'add', DELETE:'delete', CHANGE:'change', RELOAD:'reload', MOVE:'move' };
${read('features/common/BookAuthorMetadata.ts')}\n${classes}\nexport {SearchBookGroup,SearchResultDataSource};`)).toString('base64')}`);
const book = (id, coverUrl, extra = {}) => ({ sourceId: id, bookId: id, groupKey:'same-book',
  searchRequestId:'query-1', sourceName:id, title:'测试书', author:'作者', coverUrl, intro:'简介', ...extra });
const a = book('a','https://example.test/a.jpg');
const b = book('b','https://example.test/b.jpg');
const makeGroup = (variants, representative = variants[0]) => {
  const group = new SearchBookGroup(variants[0], 1, false);
  for (const variant of variants.slice(1)) group.admit(variant, false);
  group.book = representative;
  return group;
};
const data = new SearchResultDataSource();
const notifications = [];
data.registerDataChangeListener({ onDatasetChange: ops => notifications.push(ops) });
data.replace([makeGroup([a])]);
const first = data.getData(0); notifications.length = 0;
data.replace([makeGroup([a,b])],new Set(['online:same-book']));
assert.equal(data.getData(0),first);
assert.equal(first.sourceCount,2);
assert.deepEqual(notifications,[], 'metadata enrichment must not issue native row-replacement CHANGE');
console.log('PASS same-key metadata/source-count enrichment emits no structural replacement');

// Real installed SDK ObservedObject + @ObjectLink + emitted card observers.
// Native image loading is not simulated; its URI/node inputs are inspected.
const runtime = createArkUIPropertyRuntimeProbe();
const observed = runtime.sdk.ObservedObject.createNew(makeGroup([a,b]), undefined);
const linked = new SearchResultDataSource(); linked.replace([observed]);
let nativeChanges=0;linked.registerDataChangeListener({onDatasetChange:ops=>nativeChanges+=ops.length});
const require = createRequire(import.meta.url);
require((process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader') + '/lib/validate_ui_syntax.js').observedClassCollection.add('SearchBookGroup');
const card = source.slice(source.indexOf('@Component\nstruct SearchResultCard'));
const members=['group','build','displayIntro','coverWidth','coverHeight'];
if (card.includes('private coverErrorHandler')) members.push('coverErrorHandler');
const { owner } = createReaderBuilderProbe(card,members,{
  ...runtime.sdk, SynchedPropertyNesedObjectPU: runtime.sdk.SynchedPropertyNestedObjectPU, bookIntroText, bookAuthorLabel, ImageFit:{Cover:'Cover'}, LengthMetrics:{vp:v=>v},
},runtime.hooks);
owner.updateStateVars({group:observed}); owner.appThemeScheme='day'; owner.isTablet=false; owner.cardWidth=390;
owner.initialRender();
const image = [...owner.nodes.values()].find(n=>n.type==='Image');
const imageId=image.id;
const oldError=image.onError;
const count=owner.nodes.size;
let selected;
owner.onSelectResult=(chosen,variants)=>{selected={chosen,variants};};
const hit=[...owner.nodes.values()].find(n=>n.type==='Row'&&n.onClick);
for (let i=0;i<60;i++) {
  const representative=i%2===0?{...b,intro:`补充${i}`}:{...a,intro:`补充${i}`};
  const variants=representative.sourceId==='a'?[representative,b]:[a,representative];
  linked.replace([makeGroup(variants,representative)],new Set(['online:same-book']));runtime.flush();
  assert.equal(owner.nodes.get(imageId),image);assert.equal(owner.nodes.size,count);
  assert.equal(image.create,a.coverUrl,'better text/catalog candidate does not replace the admitted cover');
  assert.ok([...owner.nodes.values()].some(n=>n.type==='Text'&&n.create===`补充${i}`),'metadata still updates through ObjectLink');
  hit.onClick();assert.equal(selected.chosen,representative);assert.deepEqual(selected.variants,variants);
}
assert.equal(nativeChanges,0);
console.log('PASS 60 real SDK ObjectLink enrichments: image actor/URI retained, text and selected candidate current');

assert.equal(typeof image.onError,'function');
image.onError({}); runtime.flush();
assert.equal(image.create,b.coverUrl,'failed cover advances to another exact same-group source');
oldError({});runtime.flush();assert.equal(image.create,b.coverUrl,'late old image failure cannot reject current cover');
linked.replace([makeGroup([a,b],a)],new Set(['online:same-book']));runtime.flush();
assert.equal(image.create,b.coverUrl,'metadata does not retry a rejected image URL');
image.onError({});runtime.flush();assert.equal(observed.coverUrl,'','all failures fall back to existing placeholder');
const c=book('c','https://example.test/c.jpg');
linked.replace([makeGroup([a,b,c],c)],new Set(['online:same-book']));runtime.flush();
assert.equal(observed.coverUrl,c.coverUrl,'later same-group candidate can recover after all initial URLs failed');
const separate=makeGroup([book('new','https://example.test/new.jpg',{groupKey:'other'})]);
assert.equal(separate.coverUrl,'https://example.test/new.jpg','another book cannot inherit the previous cover');
const blank=makeGroup([book('empty','  '),b]);assert.equal(blank.coverUrl,b.coverUrl);
const fresh=makeGroup([a]);assert.equal(fresh.coverUrl,a.coverUrl,'new query/group can retry independently');
const latePriorQuery=image.onError;
linked.replace([makeGroup([{...a,searchRequestId:'query-2'}])],new Set(['online:same-book']));runtime.flush();
assert.equal(observed.coverUrl,a.coverUrl,'new search request clears prior image failures');
latePriorQuery({});runtime.flush();assert.equal(observed.coverUrl,a.coverUrl,'prior-query callback cannot poison current image');
console.log('PASS cover failure fallback/late callback/no repeated failed URL/missing cover/new book isolation');
