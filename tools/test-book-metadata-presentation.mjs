import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const executable = async source => import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const withoutImports = source => source.replace(/^import[\s\S]*?;\n/gm, '');
const dependencies = `${read('features/common/BookAuthorMetadata.ts')}\n${read('app/ErrorMessage.ts')}\n${read('features/source/ReaderSourceCategory.ts')}\n${withoutImports(read('features/common/CachedBookIdentity.ts'))}\n${withoutImports(read('features/common/BookAcquisitionPresentation.ts'))}`;
const { SearchGateway } = await executable(dependencies + withoutImports(read('features/search/SearchBookProjection.ts')) + withoutImports(read('features/search/SearchGateway.ts')));
const switchSource = read('features/source/SourceSwitchGateway.ts');
const { SourceSwitchGateway, sourceSwitchCandidateKey, sourceSwitchSourceCount } = await executable(dependencies + withoutImports(read('app/BookRequestScheduler.ts')) + withoutImports(switchSource));
const page = read('features/search/SearchPage.ets');
const groupSource = page.slice(page.indexOf('class SearchBookGroup'), page.indexOf('class SearchResultDataSource'));
const window = read('features/source/SourceSwitchWindow.ets');
const footer = window.slice(window.indexOf('  private footerText()'), window.indexOf('  private horizontalFrame()'));
const { SearchBookGroup, FooterProbe } = await executable(`${groupSource}
  ${switchSource.slice(switchSource.indexOf('export function sourceSwitchSourceCount'), switchSource.indexOf('function deduplicateSourceSwitchCandidates'))}
  class FooterProbe { ${footer} } export { SearchBookGroup, FooterProbe };`);

// Both production gateways receive the exact same immutable Core snapshot.
// 55 sources, 56 URLs, renamed detail, stale/failure facts and excluded records.
const now = Date.now();
const sources = Array.from({ length: 55 }, (_, i) => ({ sourceId: `source-${i}`, name: `书源 ${i}`, enabled: true, sourceVersion: 'v1' }));
sources.push({ sourceId: 'disabled', name: '停用书源', enabled: false, sourceVersion: 'v1' });
const rows = sources.map((source, i) => ({ origin: source.sourceId, bookUrl: `book-${i}`, name: '详情新名', author: '作者',
  intro: '&nbsp;&nbsp;第一段<br>第二段', time: now,
  relationKey: 'book-relation', relationRevision: '1',
  acquisition: { schemaVersion: 2, sourceVersion: i === 2 ? 'old' : 'v1', aliases: i === 0 ? [{ name: '搜索旧名', author: '作者' }] : [],
    ...([1,3,4].includes(i) ? { failureCurrent: true, failureConfirmed: i === 1,
      failure: { schemaVersion: 2, sourceVersion: 'v1', stage: 'failed', failureStage: 'catalog', checkedAt: now, at: now,
        ...(i === 1 ? {failureCategory:'SOURCE_RULE_FAILED'} : i === 4 ? {failureCategory:'SOURCE_HTTP_FAILED'} : {}),
        message: i === 1 ? '暂不可读' : 'Internal error' } } : {}) } }));
rows.push({ ...rows[0], bookUrl: 'alternate-url' });
rows.push({ ...rows[0], bookUrl: 'wrong-author', author: '其他作者', acquisition: { sourceVersion: 'v1' } });
rows.push({ ...rows[0], bookUrl: 'unrelated', name: '别的书', acquisition: { sourceVersion: 'v1' } });
const snapshot = JSON.stringify({ sources, rows });
// The Core fixture owns the already-indexed relation. Host is not given an
// unscoped library, nor expected to rediscover a transitive alias graph.
const calls = [];
function cacheRuntime(registry, cache, relatedRows) {
  const index = new Map(cache.map(row => [`${row.origin}\u0000${row.bookUrl}`, row]));
  const versions = ids => [...new Set(ids)].map(sourceId => {
    const source = registry.find(source => source.sourceId === sourceId);
    assert.ok(source, 'fixture identity must have an explicit source version');
    return { sourceId, sourceVersion: source.sourceVersion, enabled: source.enabled };
  });
  return { async request(method, params) {
    calls.push(method);
    if (method === 'source.list') return { data: { sources: structuredClone(registry) } };
    if (method === 'search-book.batch.get') {
      assert.ok(params.identities.length > 0 && params.identities.length <= 128);
      const books = []; const missing = [];
      for (const identity of params.identities) {
        const row = index.get(`${identity.sourceId}\u0000${identity.bookId}`);
        if (row === undefined) missing.push(identity); else books.push(row);
      }
      return { data: structuredClone({ books, missing, sourceVersions: versions(params.identities.map(row => row.sourceId)),
        snapshotRevision: 'fixture-snapshot', complete: true }) };
    }
    if (method === 'search-book.related') {
      assert.ok(params.identity && index.has(`${params.identity.sourceId}\u0000${params.identity.bookId}`));
      assert.equal(params.limit, 128); assert.equal(params.cursor, undefined);
      return { data: structuredClone({ books: relatedRows, sourceVersions: versions(relatedRows.map(row => row.origin)),
        snapshotRevision: 'fixture-snapshot', complete: true }) };
    }
    assert.fail(`cache projection must not dispatch network or unbounded library work: ${method}`);
  } };
}
const admittedRows = rows.filter(row => row.origin !== 'disabled' && row.author === '作者' && row.name === '详情新名');
const runtime = cacheRuntime(sources, rows, admittedRows);
const seed = { sourceId: 'source-0', bookId: 'book-0', detailUrl: 'book-0', title: '搜索旧名', author: '作者',
  groupKey: '搜索旧名\u0000作者', sourceRuleVersion: 'v1', sourceName: '书源 0', category: 'novel', variables: [] };
const search = new SearchGateway(runtime);
const picker = new SourceSwitchGateway(runtime);
const query = { sourceId: seed.sourceId, bookId: seed.bookId, bookName: seed.title, author: seed.author,
  currentChapterIndex: 0, currentChapterTitle: '' };
const liveSeed = row => ({ ...seed, sourceId: row.origin, sourceName: `书源 ${row.origin}`, bookId: row.bookUrl, detailUrl: row.bookUrl });
const querySeeds = admittedRows.map(liveSeed);
assert.equal(querySeeds.length, 56, 'the actual search query admits all 56 candidates before cache enrichment');
const refreshed = await search.refreshBooks(querySeeds);
const candidates = await picker.loadCachedCandidates(query);
assert.equal(candidates.length, 56, 'alternative URLs remain independently selectable');
const identity = row => sourceSwitchCandidateKey(row.sourceId, row.bookUrl ?? row.bookId);
assert.deepEqual(refreshed.map(identity).sort(), candidates.map(identity).sort(), 'search and picker must expose identical identities for one snapshot');
assert.equal(new Set(refreshed.map(book => book.groupKey)).size, 1, 'detail rename must retain the original search group');
const group = new SearchBookGroup(refreshed[0], 1, false);
for (const book of refreshed.slice(1)) group.admit(book, false);
assert.equal(group.sourceCount, 55);
assert.equal(sourceSwitchSourceCount(candidates), group.sourceCount);
const panel = new FooterProbe();
panel.state = { kind: 'candidates', candidates };
assert.equal(panel.footerText(), `共 ${group.sourceCount} 个书源`);
panel.state.refreshing = true;
assert.equal(panel.footerText(), `正在刷新 · 已有 ${group.sourceCount} 个书源`);
panel.state.refreshError = '网络不可用';
assert.equal(panel.footerText(), '刷新失败 · 已保留 56 个本地记录', 'record count is explicitly labelled as records');
assert.equal(candidates.find(row => row.sourceId === 'source-1').acquisitionState, 'failed');
for(const sourceId of ['source-3','source-4']) {
  assert.equal(candidates.find(row => row.sourceId === sourceId).acquisitionState,'attemptFailed');
  assert.equal(candidates.find(row => row.sourceId === sourceId).acquisitionMessage,'上次读取失败');
}
assert.equal(candidates.find(row => row.sourceId === 'source-2').acquisitionState, 'stale');
assert.deepEqual((await search.refreshBooks(refreshed)).map(identity).sort(), candidates.map(identity).sort(), 'remount/refresh cannot grow or lose identities');
// Detail acquisition and live source responses can interleave: a late result
// under the new name must join the original card, not split its source count.
const lateSeed = { ...seed, sourceId: 'source-10', bookId: 'book-10', detailUrl: 'book-10',
  title: '详情新名', groupKey: '详情新名\u0000作者' };
for (const leading of [[seed, lateSeed], [lateSeed, seed]]) {
  const seen = new Set(leading.map(identity));
  const seeds = [...leading, ...querySeeds.filter(row => !seen.has(identity(row)))];
  const originalSeeds = JSON.stringify(seeds);
  const joined = await new SearchGateway(runtime).refreshBooks(seeds);
  assert.deepEqual(joined.map(identity).sort(), candidates.map(identity).sort());
  assert.deepEqual([...new Set(joined.map(book => book.groupKey))], [seeds[0].groupKey], 'the earliest admitted card wins in either arrival order');
  assert.equal(JSON.stringify(seeds), originalSeeds, 'group reconciliation must not mutate the input presentation');
}
assert.equal(JSON.stringify({ sources, rows }), snapshot, 'UI projection must leave the canonical facts unchanged');
assert.ok(calls.every(method => ['source.list', 'search-book.batch.get', 'search-book.related'].includes(method)));

// An empty detail/search-cache field is missing metadata, not an instruction
// to erase a nonblank field already admitted for this exact source and URL.
// Exercise the public gateway and its production projection against Core-shaped
// rows, retaining each candidate's original continuation and source binding.
{
  const fields = ['coverUrl', 'intro', 'kind', 'latestChapterTitle'];
  const registry = [{ sourceId: 'metadata-source', name: 'Metadata source', enabled: true, sourceVersion: 'v1' }];
  const original = Object.freeze({ ...seed, sourceId: 'metadata-source', bookId: 'metadata-book', detailUrl: 'metadata-book',
    bookSourceUrl: 'https://metadata.example', searchRequestId: 'metadata-query',
    variables: Object.freeze([{ name: 'continuation', value: 'search-owned' }]),
    coverUrl: 'https://metadata.example/cover.png', intro: 'The admitted book synopsis.', kind: 'Fantasy',
    latestChapterTitle: 'Chapter 123' });
  const row = { origin: original.sourceId, bookUrl: original.bookId, name: original.title, author: original.author,
    relationKey: 'metadata-relation', relationRevision: '1', acquisition: { sourceVersion: 'v1' },
    variable: JSON.stringify({ continuation: 'cached-other-value' }) };
  for (const blank of ['', ' \t\r\n\u3000', undefined, null]) {
    const cache = [{ ...row, ...Object.fromEntries(fields.map(field => [field, blank])) }];
    const projected = await new SearchGateway(cacheRuntime(registry, cache, cache)).refreshBooks([original]);
    assert.equal(projected.length, 1);
    for (const field of fields) assert.equal(projected[0][field], original[field],
      `same-source blank ${field} must preserve admitted nonblank metadata`);
    assert.equal(projected[0].variables, original.variables, 'metadata enrichment must not replace continuation variables');
    assert.equal(projected[0].bookId, original.bookId);
    assert.equal(projected[0].detailUrl, original.detailUrl);
    assert.equal(projected[0].sourceRuleVersion, original.sourceRuleVersion);
    assert.equal(projected[0].searchRequestId, original.searchRequestId);
  }
  const richer = Object.fromEntries(fields.map(field => [field, `  new ${field}  `]));
  const enrichedRows = [{ ...row, ...richer }];
  const enriched = await new SearchGateway(cacheRuntime(registry, enrichedRows, enrichedRows)).refreshBooks([original]);
  for (const field of fields) assert.equal(enriched[0][field], richer[field],
    `nonblank ${field} updates unchanged, including its original whitespace`);
  const staleRows = [{ ...row, ...richer, acquisition: { sourceVersion: 'old-version' } }];
  const protectedRows = await new SearchGateway(cacheRuntime(registry, staleRows, staleRows)).refreshBooks([original]);
  for (const field of fields) assert.equal(protectedRows[0][field], original[field],
    `stale source facts cannot replace ${field}`);
  assert.equal(protectedRows[0].variables, original.variables);
  assert.equal(protectedRows[0].sourceRuleVersion, original.sourceRuleVersion);

  // A newly discovered URL can share a Core relation but is not the same
  // candidate. Its empty fields must not inherit the relation seed's metadata.
  const relationRows = [{ ...row, ...Object.fromEntries(fields.map(field => [field, original[field]])) }];
  const owner = cacheRuntime(registry, relationRows, relationRows);
  // Use a mutable Core fixture to announce the complete changed relation.
  let changed = false;
  const related = { ...row, bookUrl: 'another-book-url', relationRevision: '2',
    ...Object.fromEntries(fields.map(field => [field, ' \t '])) };
  const gateway = new SearchGateway({ async request(method, params) {
    if (!changed || method === 'source.list') return owner.request(method, params);
    const cache = [{ ...relationRows[0], relationRevision: '2' }, related];
    return cacheRuntime(registry, cache, cache).request(method, params);
  } });
  const initial = await gateway.refreshBooks([original]);
  changed = true;
  const complete = await gateway.refreshBooks(initial, { reset: false,
    identities: [{ sourceId: original.sourceId, bookId: original.bookId }] });
  const separate = complete.find(book => book.bookId === related.bookUrl);
  assert.ok(separate, 'the Core-proven relation admits the distinct URL');
  for (const field of fields) assert.equal(separate[field], undefined,
    `a different URL must not inherit the relation seed's ${field}`);
  assert.equal(separate.detailUrl, related.bookUrl);
  assert.deepEqual(separate.variables, [{ name: 'continuation', value: 'cached-other-value' }]);
  assert.equal(original.intro, 'The admitted book synopsis.', 'projection never mutates the admitted object');
}

// Anonymized shape of the VM's 73/61 mismatch: the selected row knows the
// current title, another source connects an old title, and 12 sources still
// publish that old title. One-hop matching loses those 12 source identities.
{
  const registry = Array.from({ length: 73 }, (_, i) => ({ sourceId: `chain-${i}`, name: `源${i}`, enabled: true, sourceVersion: 'v1' }));
  registry.push({ sourceId: 'disabled-bridge', name: '停用桥', enabled: false, sourceVersion: 'v1' });
  const cache = registry.slice(0, 73).map((source, i) => ({ origin: source.sourceId, bookUrl: `url-${i}`,
    name: i >= 61 ? 'Old title' : 'Current title', author: 'Writer', time: now, relationKey: 'chain-relation', relationRevision: '1',
    acquisition: { sourceVersion: 'v1', aliases: i === 1 ? [{ name: '  OLD   TITLE ', author: ' writer ' }] : [] } }));
  cache.push({ ...cache[0], bookUrl: 'alternate' });
  cache.push({ ...cache[0], bookUrl: 'same-title-other-author', author: 'Different writer' });
  cache.push({ ...cache[0], bookUrl: 'unknown-author', author: '' });
  cache.push({ ...cache[0], origin: 'disabled-bridge', bookUrl: 'disabled',
    acquisition: { sourceVersion: 'v1', aliases: [{ name: 'Unrelated', author: 'Writer' }] } });
  cache.push({ ...cache[0], bookUrl: 'unrelated', name: 'Unrelated' });
  const related = cache.filter(row => row.origin !== 'disabled-bridge' && row.author === 'Writer' && row.name !== 'Unrelated');
  const owner = cacheRuntime(registry, cache, related);
  const first = { ...seed, sourceId: 'chain-0', bookId: 'url-0', title: 'Current title', author: 'Writer', groupKey: 'current-card' };
  const bridge = { ...first, sourceId: 'chain-1', bookId: 'url-1', groupKey: 'later-card' };
  const switcher = new SourceSwitchGateway(owner);
  const expected = Array.from({ length: 73 }, (_, i) => sourceSwitchCandidateKey(`chain-${i}`, `url-${i}`));
  expected.push(sourceSwitchCandidateKey('chain-0', 'alternate')); expected.sort();
  for (const leading of [[first], [first, bridge], [bridge, first]]) {
    const seen = new Set(leading.map(identity));
    const admitted = [...leading, ...related.map(row => ({ ...first, sourceId: row.origin, bookId: row.bookUrl,
      detailUrl: row.bookUrl, title: row.name, groupKey: `${row.name}\u0000${row.author}` })).filter(row => !seen.has(identity(row)))];
    assert.equal(admitted.length, 74);
    const gateway = new SearchGateway(owner);
    const projection = await gateway.refreshBooks(admitted);
    assert.deepEqual(projection.map(identity).sort(), expected, 'all 74 admitted query identities share the Core-indexed relation without a global library scan');
    assert.deepEqual([...new Set(projection.map(row => row.groupKey))], [admitted[0].groupKey]);
    assert.deepEqual((await gateway.refreshBooks(projection)).map(identity).sort(), expected);
  }
  for (const selected of [first, bridge, { ...first, sourceId: 'chain-72', bookId: 'url-72', title: 'Old title' }]) {
    const projection = await switcher.loadCachedCandidates({ ...query, sourceId: selected.sourceId, bookId: selected.bookId,
      bookName: selected.title, author: selected.author });
    assert.deepEqual(projection.map(identity).sort(), expected, 'opening any candidate must resolve the same cache component');
    assert.equal(sourceSwitchSourceCount(projection), 73);
  }
}

const detail = read('features/bookshelf/LocalBookDetail.ets');
const detailIntro = detail.slice(detail.indexOf('  private displayIntro()'), detail.indexOf('  private contentWidth()'));
const cardStart = page.indexOf('struct SearchResultCard');
const cardIntro = page.slice(page.indexOf('  private displayIntro()', cardStart), page.indexOf('  build()', cardStart));
const { bookIntroText, DetailIntro, SearchIntro } = await executable(`${read('features/common/BookIntroText.ts')}
  class DetailIntro { ${detailIntro} } class SearchIntro { ${cardIntro} } export { DetailIntro, SearchIntro };`);
const detailProbe = new DetailIntro();
const cardProbe = new SearchIntro();
// HTML/entity semantics are tested at Core's standard display boundary. Host
// consumes plain text and must not reinterpret legitimate <, &, or bidi text.
const fixtures = [
  [undefined, ''], ['', ''], ['   ', ''],
  ['甲\r\n\r\n\r乙\n丙', '甲\n\n乙\n丙'],
  ['  第一段\n 第二段  ', '第一段\n第二段'],
  ['1 < 2 & 3 > 2 &unknown;', '1 < 2 & 3 > 2 &unknown;'],
  ['你好 📖 “阅读”', '你好 📖 “阅读”'],
  ['\u2067العربية\u2069', '\u2067العربية\u2069'],
];
for (const [raw, expected] of fixtures) {
  const book = Object.freeze({ intro: raw });
  detailProbe.book = book; cardProbe.group = { book };
  assert.equal(bookIntroText(raw), expected);
  assert.equal(detailProbe.displayIntro(), expected);
  assert.equal(cardProbe.displayIntro(), expected);
  assert.equal(book.intro, raw);
}
const longIntro = '正文 & '.repeat(10000);
assert.equal(bookIntroText(longIntro), '正文 & '.repeat(10000).trim(), 'large synopses remain complete');
assert.equal(bookIntroText(`<span ${' '.repeat(100000)}`), '<span', 'an unfinished tag remains text without nested whitespace backtracking');
assert.match(page.slice(cardStart), /if \(this\.displayIntro\(\)\.length > 0\)/, 'markup-only search summaries must not reserve a blank row');
assert.match(page.slice(cardStart), /Text\(this\.displayIntro\(\)\)/);
assert.match(detail, /Text\(this\.displayIntro\(\)\.length > 0 \? this\.displayIntro\(\) : '暂无简介'\)/);
console.log('shared metadata: identical 56/55 and transitive 74/73 URL/source sets, rename/remount, no network, synopsis presentation: PASS');
