import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "pure-classification": {
    "description": "Pure category metadata/provider boundary and readable/text policy; no mutable corpus presence",
    "resources": []
  },
  "search-consumer-admission": {
    "description": "Actual SearchGateway category controls RPC admission; fake RPC, decoding intentionally out of scope",
    "resources": []
  },
  "discover-consumer-admission": {
    "description": "Actual Discover owner admits only enabled/explore text sources; fake source and navigation ports",
    "resources": []
  },
  "management-filters": {
    "description": "Actual SourceManagement query/group/category/status intersection",
    "resources": []
  },
  "bundled-supply-snapshot": {
    "description": "Explicit maintenance-only classification of current bundled definitions; legitimate removals allowed, no fixed 12-ID presence",
    "resources": []
  }
};

async function case_pure_classification() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');
const categorySource = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
);
const categoryUrl = `data:text/javascript;base64,${Buffer.from(categorySource).toString('base64')}`;
const {
  classifyReaderSource,
  readerSourceCategoryIsText,
  readerSourceCategoryIsReadable,
  readerSourceCategoryLabel,
} = await import(categoryUrl);
assert.equal(classifyReaderSource({ bookSourceType: 0, name: '有声书' }), 'music');
assert.equal(classifyReaderSource({ bookSourceType: 0, name: '爱奇艺漫画' }), 'comic');
assert.equal(classifyReaderSource({ bookSourceType: 'TEXT', name: '漫画屋' }), 'comic');
assert.equal(classifyReaderSource({ bookSourceType: 0, group: '小说/漫画' }), 'other');
assert.equal(classifyReaderSource({ name: '漫画音乐' }), 'other');
assert.equal(classifyReaderSource({ bookSourceType: 0.5 }), 'other');
assert.equal(classifyReaderSource({ sourceId: 'https://profile.example.test/' }), 'novel');
assert.equal(classifyReaderSource({ bookSourceType: 1 }), 'music');
assert.equal(classifyReaderSource({ bookSourceType: '2' }), 'comic');
assert.equal(classifyReaderSource({ bookSourceType: 3 }), 'download');
assert.equal(classifyReaderSource({ bookSourceType: 4 }), 'external');
assert.equal(classifyReaderSource({ bookSourceType: 99, name: '小说' }), 'other');
assert.equal(classifyReaderSource({ group: '漫画' }), 'comic');
assert.equal(classifyReaderSource({ name: '有声听书' }), 'music');
assert.equal(classifyReaderSource({ sourceId: 'https://download.example.test/source' }), 'download');
assert.equal(classifyReaderSource({ name: '普通文本书源' }), 'novel');

for (const name of ['百度图片（优）', '壁纸图库', '每日图集']) {
  assert.equal(classifyReaderSource({ bookSourceType: 0, name }), 'other', 'explicit picture metadata is not a novel');
}
assert.equal(classifyReaderSource({ bookSourceType: 0, name: '普通小说', baseUrl: 'https://images.example.test' }), 'novel', 'image URL alone is not an image source');
for (const url of ['https://pre-api.tuishujun.com/', 'https://pre-api.tuishujun.com#md冷魅',
  'https://www.tuishujun.com/', 'https://search.douban.com/', 'https://book.douban.com',
  'https://www.lkong.com', 'https://api.coolapk.com', 'https://www.yuque.com/yuqueyonghun8txcr/psb8yc#目录']) {
  assert.equal(classifyReaderSource({ bookSourceType: 0, name: '用户重新命名', sourceId: 'opaque-source-id', baseUrl: url }), 'other',
    'renaming reviewed book-information providers must not admit their reviews as novel bodies');
}
for (const url of ['https://tuishujun.com.example.test', 'https://not-tuishujun.com', 'https://notlkong.com',
  'https://search.douban.com.example.test', 'https://read.douban.com',
  'https://www.yuque.com/someone/novel', 'https://www.yuque.com/yuqueyonghun8txcr/psb8yc-novel']) {
  assert.equal(classifyReaderSource({ bookSourceType: 0, name: '普通小说', baseUrl: url }), 'novel',
    'provider matching must respect host and reviewed notebook boundaries');
}
assert.equal(classifyReaderSource({ bookSourceType: 0, name: '普通小说', group: '书评爱好者推荐，来自论坛' }), 'novel',
  'user group and source provenance are not a review-content declaration');
for (const name of ['小说推书', '我的书单小说', '小说正文【含书评】', '我的推书/书单小说']) {
  assert.equal(classifyReaderSource({ bookSourceType: 0, name, group: '小说推荐/论坛来源', baseUrl: 'https://novel.example.test' }), 'novel',
    'a user collection name or supplementary reviews do not redefine a novel provider');
}
assert.equal(readerSourceCategoryIsText('novel'), true);
for (const category of ['comic', 'music', 'download', 'external', 'other']) {
  assert.equal(readerSourceCategoryIsText(category), false);
  assert.notEqual(readerSourceCategoryLabel(category), '小说');
}

const searchGateway = read('entry/src/main/ets/features/search/SearchGateway.ts');

}

async function case_search_consumer_admission() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');
const categorySource = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
);
const categoryUrl = `data:text/javascript;base64,${Buffer.from(categorySource).toString('base64')}`;
const {
  classifyReaderSource,
  readerSourceCategoryIsText,
  readerSourceCategoryIsReadable,
  readerSourceCategoryLabel,
} = await import(categoryUrl);
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const Gateway=productionMotionMethods(new URL('../entry/src/main/ets/features/search/SearchGateway.ts',import.meta.url),['searchBySource'],{readerSourceCategoryIsReadable,SEARCH_SOURCE_REQUEST_TIMEOUT_MS:1000,httpTransportFailureSummary:error=>{throw error;},errorMessageOf:error=>error.message});
for(const category of ['novel','comic','music','download','external','other']){
 let active=true,calls=0;
 const owner=Object.assign(new Gateway(),{generateSearchRequestId:()=> 'case',sourceBookUrl:s=>s.sourceId,requestOptions:()=>({}),runtimeOwner:{async request(method,params){assert.equal(method,'book.search');assert.equal(params.sourceId,'s');calls++;active=false;return {data:{}};}}});
 const outcome=await owner.searchBySource({sourceId:'s',category},'sample',()=>active);
 assert.equal(calls,['novel','comic'].includes(category)?1:0,'actual search consumer dispatch matches category admission');
 assert.equal(outcome.ok,false);
}

}

async function case_discover_consumer_admission() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');
const categorySource = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
);
const categoryUrl = `data:text/javascript;base64,${Buffer.from(categorySource).toString('base64')}`;
const {
  classifyReaderSource,
  readerSourceCategoryIsText,
  readerSourceCategoryIsReadable,
  readerSourceCategoryLabel,
} = await import(categoryUrl);
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const Discover=productionMotionMethods(new URL('../entry/src/main/ets/features/discover/DiscoverOrchestrator.ets',import.meta.url),['loadSources'],{readerSourceCategoryIsText});
const categories=['novel','comic','music','download','external','other'];const sources=categories.map(category=>({sourceId:category,name:category,category,enabled:true,enabledExplore:true}));
sources.push({sourceId:'disabled',category:'novel',enabled:false,enabledExplore:true},{sourceId:'no-explore',category:'novel',enabled:true,enabledExplore:false});
const received=[];const owner=Object.assign(new Discover(),{isCurrentSession:()=>true,isCurrentRead:()=>true,beginRead:()=>1,sourceGateway:{loadSources:async()=>sources},currentSource:()=>undefined,loadSource:async(_session,index,rows)=>received.push({index,rows}),fail:(_session,_generation,_message,error)=>{throw error;}});
await owner.loadSources(1);assert.equal(received.length,1);assert.deepEqual(received[0].rows.map(row=>row.sourceId),['novel']);

}

async function case_management_filters() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');
const categorySource = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
);
const categoryUrl = `data:text/javascript;base64,${Buffer.from(categorySource).toString('base64')}`;
const {
  classifyReaderSource,
  readerSourceCategoryIsText,
  readerSourceCategoryIsReadable,
  readerSourceCategoryLabel,
} = await import(categoryUrl);
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const Page=productionMotionMethods(new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets',import.meta.url),['filteredSources']);
const rows=[{name:'Alpha',baseUrl:'https://one',group:'g1',category:'novel',enabled:true},{name:'Beta',baseUrl:'https://two',group:'g1',category:'comic',enabled:true},{name:'Gamma',baseUrl:'https://three',group:'g2',category:'comic',enabled:false}];
const owner=Object.assign(new Page(),{sources:rows,searchQuery:'',groupValue:'全部分组',categoryValue:'all',matchesStatus:s=>s.enabled});
assert.deepEqual(owner.filteredSources(),rows.slice(0,2));owner.categoryValue='comic';assert.deepEqual(owner.filteredSources(),[rows[1]]);owner.searchQuery='alpha';assert.deepEqual(owner.filteredSources(),[]);owner.searchQuery='two';owner.groupValue='g1';assert.deepEqual(owner.filteredSources(),[rows[1]]);owner.groupValue='g2';assert.deepEqual(owner.filteredSources(),[]);

}

async function case_bundled_supply_snapshot() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');
const categorySource = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
);
const categoryUrl = `data:text/javascript;base64,${Buffer.from(categorySource).toString('base64')}`;
const {
  classifyReaderSource,
  readerSourceCategoryIsText,
  readerSourceCategoryIsReadable,
  readerSourceCategoryLabel,
} = await import(categoryUrl);
const collection = JSON.parse(read('entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'));
const rows = Array.isArray(collection) ? collection : collection.sources;
const informationSourceIds = new Set(['corpus-0a6f4d44c21e', 'corpus-b4ac220076f9', 'corpus-e48578e73828',
  'corpus-b2e0cc78abe1', 'corpus-2bc4d79e35ee', 'corpus-657f2375eb28', 'corpus-bdeaa8132c97',
  'corpus-510d385bfa39', 'corpus-ed739b845f1e', 'corpus-424dac3e7197', 'corpus-97f48b779f35', 'corpus-c9e9adfbdfab']);
let informationSources = 0;
const counts = {};
for (const source of rows) {
  const category = classifyReaderSource({ bookSourceType: source.bookSourceType,
    name: source.bookSourceName, group: source.bookSourceGroup, sourceId: source.bookSourceUrl });
  counts[category] = (counts[category] ?? 0) + 1;
  if (source.bookSourceName === '百度图片（优）') assert.equal(category, 'other');
  if (/漫画屋|爱奇艺漫画/.test(source.bookSourceName ?? '')) assert.notEqual(category, 'novel');
  if (informationSourceIds.has(source.sourceId)) {
    informationSources += 1;
    assert.equal(category, 'other', `${source.bookSourceName} contains information/reviews, not novel chapters`);
    assert.equal(readerSourceCategoryIsReadable(category), false);

  }
  if (['百合论坛', '百合会论坛', '酷18论坛', '轻说百科（优++）', '🎃轻小说百科🎃'].includes(source.bookSourceName)) {
    assert.equal(category, 'novel', 'actual fiction providers must survive forum/encyclopedia labels');
  }
}

assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), rows.length);
console.log('bundled category coverage:', counts);

}

const implementations = {'pure-classification':case_pure_classification,'search-consumer-admission':case_search_consumer_admission,'discover-consumer-admission':case_discover_consumer_admission,'management-filters':case_management_filters,'bundled-supply-snapshot':case_bundled_supply_snapshot};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
