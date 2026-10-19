import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { coreCliPath }=await import('./lib/tool-environment.mjs');

const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync }=await import('node:fs');
const { tmpdir }=await import('node:os');
const { resolve, join }=await import('node:path');
const { fileURLToPath }=await import('node:url');
const { stripTypeScriptTypes }=await import('node:module');
const { spawnSync }=await import('node:child_process');

const { RULE_PAYLOAD_FIELDS, ruleFingerprint, sha256Hex, validateBundledMetadata }=await import('./source-supply-lib.mjs');
const { applyReadingAssistantMetadataCorrection, READING_ASSISTANT_BUILTIN_ID,
  READING_ASSISTANT_PREVIOUS_FINGERPRINT }=await import('./reading-assistant-source-correction.mjs');

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(repo, path), 'utf8');
const sources = JSON.parse(read('entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'));
const source = sources.find(row => row.builtinId === READING_ASSISTANT_BUILTIN_ID);
const fixture = JSON.parse(read('tools/fixtures/reading-assistant-metadata.json'));
assert.ok(source);
assert.equal(source.builtinVersion, 7, 'pinned metadata-correction revision; not a live verification');
assert.equal(source.ruleFingerprint, ruleFingerprint(source));
assert.deepEqual(validateBundledMetadata(source), []);
const previous = structuredClone(source);
previous.ruleSearch.intro = fixture.previousRules.searchIntro;
if (fixture.previousRules.searchKind === null) delete previous.ruleSearch.kind;
else previous.ruleSearch.kind = fixture.previousRules.searchKind;
previous.ruleBookInfo.intro = fixture.previousRules.detailIntro;
previous.ruleBookInfo.kind = fixture.previousRules.detailKind;
previous.builtinVersion = 6;
previous.ruleFingerprint = READING_ASSISTANT_PREVIOUS_FINGERPRINT;
delete previous.provenance.metadataCorrection;
assert.equal(ruleFingerprint(previous), READING_ASSISTANT_PREVIOUS_FINGERPRINT,
  'the fixture reconstructs the exact fingerprint of the installed v6 source');

if(id==='correction'){
const corrected = structuredClone(previous);
applyReadingAssistantMetadataCorrection([corrected]);
assert.deepEqual(corrected, source, 'full supply rebuild reproduces the exact packaged source');
applyReadingAssistantMetadataCorrection([corrected]);
assert.deepEqual(corrected, source, 'correction is idempotent');
assert.deepEqual(source.ruleExplore, previous.ruleExplore);
assert.equal(source.exploreUrl, previous.exploreUrl);
assert.deepEqual(source.readerHistoricalTest, previous.readerHistoricalTest);
assert.equal(source.verifiedAt, previous.verifiedAt, 'fixture repair does not claim a new live verification');
const unrelated = { builtinId: 'unrelated', rules: 'untouched' };
const unrelatedBefore = JSON.stringify(unrelated);
applyReadingAssistantMetadataCorrection([unrelated, structuredClone(previous)]);
assert.equal(JSON.stringify(unrelated), unrelatedBefore, 'only the pinned source revision is corrected');
assert.throws(() => applyReadingAssistantMetadataCorrection([{ ...previous, searchUrl: 'https://other.example' }]),
  /different source revision/, 'a changed upstream payload requires a new review');

}
if(id==='owner-upgrade'){
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const supply = read('entry/src/main/ets/app/BundledBookSourceSupply.ts');
const methods = stripTypeScriptTypes(supply.slice(supply.indexOf('function canonicalJson'), supply.indexOf('type StoredLedger')))
  .replace(/^export /gm, '');
const guards = new Function('RULE_PAYLOAD_FIELDS', `${methods}; return { canonicalRulePayloadJson,
  hasBuiltinMarker, isUserModifiedBuiltinCopy, decideBundledUpgrade, mergeBundledDefaultStateCorrection };`)(RULE_PAYLOAD_FIELDS);
const oneDocument = JSON.stringify([source]);
let ledger;
const Owner = productionMotionMethods(resolve(repo, 'entry/src/main/ets/app/ReaderRuntimeOwner.ts'),
  ['installBundledBookSourceCollection'], { ...guards, sha256Hex,
    BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE: 'reader-tested-book-source-collection.json',
    BUNDLED_RAW_FILE_SHA256: sha256Hex(oneDocument),
    BundledSourceLedger: { load: async () => ledger }, LOG_DOMAIN: 0,
    errorMessageOf: error => error.message, hilog: { error() {}, warn() {} } });
async function upgrade(stored) {
  const owner = new Owner();
  const imports = []; const removed = [];
  ledger = { all: () => [], remove: id => removed.push(id), syncCurrentBundle() {}, save: async () => {} };
  Object.assign(owner, { supportsCoreCapability: () => false, state: 'ready', host: { readBundledRawFileText: async () => oneDocument, getContext: () => ({}) },
    requireBundledBookSourceCollection: JSON.parse,
    loadExistingBundledSources: async () => new Map(stored === undefined ? [] : [[source.bookSourceUrl, stored]]),
    importBundledSource: async (id, value) => imports.push({ id, source: structuredClone(value) }) });
  const summary = await owner.installBundledBookSourceCollection({});
  assert.equal(summary.failed, 0);
  return { imports, removed };
}
assert.equal((await upgrade()).imports[0].source.builtinVersion, 7);
const clean = { ...structuredClone(previous), enabled: false, enabledExplore: false };
const installed = (await upgrade(clean)).imports[0].source;
assert.equal(installed.builtinVersion, 7);
assert.equal(installed.enabled, false);
assert.equal(installed.enabledExplore, false);
assert.equal(installed.ruleFingerprint, source.ruleFingerprint);
assert.equal((await upgrade(source)).imports.length, 0, 'an installed current revision is not imported repeatedly');
const userCopy = structuredClone(previous); delete userCopy.builtinId; delete userCopy.builtinVersion;
assert.equal((await upgrade(userCopy)).imports.length, 0, 'an imported user-owned copy remains untouched');
const editedRules = { ...structuredClone(previous), ruleSearch: { ...previous.ruleSearch, intro: '$.userIntro' } };
assert.equal((await upgrade(editedRules)).imports.length, 0, 'a modified fingerprinted rule remains untouched');
for (const withdrawn of [false, true]) {
  const discovery = { ...structuredClone(previous), readerBuiltinWithdrawn: withdrawn,
    exploreUrl: 'https://user.example/discover', ruleExplore: { bookList: '$.userBooks', intro: '$.userIntro' } };
  assert.equal(ruleFingerprint(discovery), previous.ruleFingerprint, 'the legacy fingerprint excludes discovery');
  const retained = (await upgrade(discovery)).imports[0].source;
  assert.equal(retained.exploreUrl, discovery.exploreUrl);
  assert.deepEqual(retained.ruleExplore, discovery.ruleExplore);
  delete discovery.ruleExplore; delete discovery.exploreUrl;
  const absent = (await upgrade(discovery)).imports[0].source;
  assert.equal(Object.hasOwn(absent, 'ruleExplore'), false, 'an explicit discovery deletion remains deleted');
  assert.equal(Object.hasOwn(absent, 'exploreUrl'), false);
}


}
if(id==='core-metadata'){
const cli = coreCliPath(resolve(repo, '../Reader-Core'));
assert.ok(existsSync(cli), `an existing Core CLI is required for the offline metadata fixture: ${cli}`);
const {createHash}=await import('node:crypto');console.log(JSON.stringify({kind:'reader-contract-tool-evidence',cli,cliSha256:createHash('sha256').update(readFileSync(cli)).digest('hex'),autoBuild:false,sourceProvenance:'UNPROVEN',fixture:'tools/fixtures/reading-assistant-metadata.json',fixtureBoundary:'public search payload plus synthetic detail; no live re-verification'}));
const scratch = mkdtempSync(join(tmpdir(), 'reader-source-metadata-'));
function parseMetadata(bookSource, label) {
  const metadataSource = structuredClone(bookSource);
  for (const field of ['ruleExplore', 'exploreUrl', 'ruleToc', 'ruleContent']) delete metadataSource[field];
  const input = { sourceId: 'corpus-752f07e02faf', bookSource: metadataSource, variables: { headers: '{}' },
    searchResponse: JSON.stringify({ data: { books: [fixture.searchItem] } }),
    detailResponse: JSON.stringify({ data: { book: fixture.detailBook } }) };
  const path = join(scratch, `${label}.json`); writeFileSync(path, JSON.stringify(input));
  const result = spawnSync(cli, ['--booksource-fixture', path], { encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, `Core offline metadata fixture ${label}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}
try {
  const baseline = parseMetadata(previous, 'before');
  const actual = parseMetadata(source, 'after');
  assert.notEqual(baseline.search.books[0].intro, fixture.searchItem.intro, 'the original source manufactured synopsis labels');
  assert.equal(actual.search.books[0].intro, fixture.searchItem.intro);
  assert.equal(actual.search.books[0].kind, fixture.searchItem.ptags);
  assert.equal(actual.detail.book.intro, fixture.detailBook.intro);
  assert.equal(actual.detail.book.kind, `${baseline.detail.book.kind},${fixture.detailBook.book_tag_list.map(tag => tag.title).join(',')}`,
    'detail retains its original date role and every book tag');
  assert.equal(actual.detail.book.lastChapter, fixture.detailBook.latest_chapter_title);
  assert.equal(actual.search.books[0].author, fixture.searchItem.original_author);
  assert.equal(actual.detail.book.author, fixture.detailBook.author);
} finally { rmSync(scratch, { recursive: true, force: true }); }

}
}
const definitions={"correction": "Pinned v6\u2192v7 metadata supply correction/idempotence", "owner-upgrade": "Actual RuntimeOwner retains user rule/discovery edits and deleted explore fields", "core-metadata": "Existing Core CLI offline search/detail metadata; synthetic detail; no network"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
