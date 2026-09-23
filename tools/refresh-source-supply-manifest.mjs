// Rebuilds the app-importable bundled collection from the latest completed
// historical full-corpus run. This consumes recorded evidence only: it never
// probes a source or performs network I/O.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyReadingAssistantMetadataCorrection } from './reading-assistant-source-correction.mjs';
import { applyPopofreeQuoteCorrection } from './popofree-source-correction.mjs';
import {
  BUILTIN_VERSION,
  SUITE_VERSION,
  collectInsecureUrlFindings,
  collectPaywallFindings,
  collectSecretFindings,
  ruleFingerprint,
  sha256Hex,
} from './source-supply-lib.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreRepo = resolve(repo, '../Reader-Core-Native');
const workspaceRoot = resolve(repo, '..');
const evidenceRelative = 'reports/tooling/corpus-batch-live-full-1945-v5-2026-07-09.json';
const evidenceFile = resolve(coreRepo, evidenceRelative);
const admittedEvidenceRelative = 'evidence/2026-08-31-five-line/supply-admission-results.json';
const admittedEvidenceFile = resolve(workspaceRoot, admittedEvidenceRelative);
const legacyBundledRelative = 'entry/src/main/resources/rawfile/reader-test-book-sources.json';
const rawFile = resolve(repo,
  'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json');
const ownerFile = resolve(repo, 'entry/src/main/ets/app/ReaderRuntimeOwner.ts');

const EXPECTED_EVIDENCE_SHA256 = '3041b3833629a2510f75cd563a9ee4e70dafbcf80a5d979a131ec593e172585b';
// The six-source handoff was later consolidated into a 1,951-row admission
// result. Pin that immutable document and select only its six explicit
// `verdict: admitted` rows; rejected/excluded rows never authorize bundling.
const EXPECTED_ADMITTED_EVIDENCE_SHA256 = 'bec0e4368e9c817acc1163515d0077dec4f242b21ce1af774c0da6e68b0f24f9';
const EXPECTED_TESTED_RECORDS = 1945;
const EXPECTED_ADMITTED_RECORDS = 6;
const EXPECTED_COLLECTION_RECORDS = 1951;
const EXPECTED_UNIQUE_SOURCE_IDS = 1736;
const EXPECTED_COLLECTION_SOURCE_IDS = 1737;
const EXPECTED_FULLY_PASSED = 265;
const EXPECTED_SECURE_COLLECTION_RECORDS = 1046;
const EXPECTED_SECURE_SOURCE_IDS = 919;
const ADMITTED_SUITE_VERSION = 'reader-source-admission/1';
const LEVEL_CAPABILITIES = new Map([
  ['L1-import', 'import'],
  ['L2-search', 'search'],
  ['L3-detail', 'detail'],
  ['L4-toc', 'toc'],
  ['L5-content', 'content'],
]);

function runGit(repository, args, allowFailure = false) {
  const result = spawnSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result;
}

function readTestedSource(sourceFile) {
  const relative = `tests/fixtures/corpus/sources/${sourceFile}`;
  const current = resolve(coreRepo, relative);
  if (existsSync(current)) {
    return JSON.parse(readFileSync(current, 'utf8'));
  }

  // Seven entries in the final 1,945-record run were subsequently archived as
  // dead sites. Recover their exact tested rule objects from the parent of the
  // commit that deleted them instead of inventing or re-fetching rules.
  const history = runGit(coreRepo, [
    'log', '--all', '--diff-filter=D', '--format=%H', '--', relative,
  ]).stdout.trim().split('\n').filter(Boolean);
  for (const deletionCommit of history) {
    const recovered = runGit(coreRepo, ['show', `${deletionCommit}^:${relative}`], true);
    if (recovered.status === 0) {
      return JSON.parse(recovered.stdout);
    }
  }
  throw new Error(`tested source object is unavailable in the Core worktree and Git history: ${sourceFile}`);
}

function readLatestTrackedFile(repository, relative) {
  const history = runGit(repository, ['log', '--all', '--format=%H', '--', relative])
    .stdout.trim().split('\n').filter(Boolean);
  for (const commit of history) {
    const recovered = runGit(repository, ['show', `${commit}:${relative}`], true);
    if (recovered.status === 0) {
      return recovered.stdout;
    }
  }
  throw new Error(`tracked source file is unavailable in Git history: ${relative}`);
}

function passedDepth(result) {
  let depth = 0;
  for (const level of LEVEL_CAPABILITIES.keys()) {
    if (result.levels?.[level]?.status !== 'pass') {
      break;
    }
    depth += 1;
  }
  return depth;
}

function isFullyPassed(result) {
  return passedDepth(result) === LEVEL_CAPABILITIES.size;
}

const evidenceText = readFileSync(evidenceFile, 'utf8');
assert.equal(sha256Hex(evidenceText), EXPECTED_EVIDENCE_SHA256,
  'historical full-corpus evidence changed; select and review a new completed run explicitly');
const evidence = JSON.parse(evidenceText);
assert.equal(evidence.total, EXPECTED_TESTED_RECORDS);
assert.equal(evidence.sources?.length, EXPECTED_TESTED_RECORDS);
assert.equal(evidence.summary?.fully_passed, EXPECTED_FULLY_PASSED);
assert.equal(evidence.mode, 'live');
assert.equal(typeof evidence.generated_at, 'string');
assert.equal(typeof evidence.keyword, 'string');

const records = evidence.sources.map((result, evidenceIndex) => {
  assert.equal(typeof result.source_id, 'string', `result ${evidenceIndex + 1} has no source_id`);
  assert.equal(typeof result.source_file, 'string', `result ${evidenceIndex + 1} has no source_file`);
  const source = readTestedSource(result.source_file);
  assert.equal(source.bookSourceName, result.source_name,
    `${result.source_file} name differs from its recorded test result`);
  assert.equal(source.bookSourceUrl, result.source_url,
    `${result.source_file} identity differs from its recorded test result`);
  assert.equal(typeof source.bookSourceUrl, 'string');
  assert.ok(source.bookSourceUrl.trim().length > 0, `${result.source_file} has a blank bookSourceUrl`);

  const capabilities = [];
  for (const [level, capability] of LEVEL_CAPABILITIES) {
    if (result.levels?.[level]?.status === 'pass') {
      capabilities.push(capability);
    }
  }
  assert.ok(capabilities.includes('import'), `${result.source_file} did not pass the import level`);
  const fullyPassed = isFullyPassed(result);
  const defaultEnabled = fullyPassed && source.enabled !== false;

  // Preserve the tested Legado rule object and its original name/group/order.
  // Only distribution state and auditable evidence metadata are added.
  source.enabled = defaultEnabled;
  if (Object.hasOwn(source, 'enabledExplore')) {
    source.enabledExplore = defaultEnabled && source.enabledExplore !== false;
  }
  source.builtinId = `reader-builtin-${result.source_id}`;
  source.builtinVersion = BUILTIN_VERSION;
  delete source.readerTestBuiltinVersion;
  delete source.readerBuiltinWithdrawn;
  delete source.readerTestBuiltinWithdrawn;
  source.ruleFingerprint = ruleFingerprint(source);
  source.verifiedAt = evidence.generated_at;
  source.verificationSuiteVersion = SUITE_VERSION;
  source.capabilities = capabilities;
  source.provenance = {
    origin: 'reader-core-native-recorded-full-corpus',
    evidence: `Reader-Core-Native/${evidenceRelative}`,
    evidenceSha256: EXPECTED_EVIDENCE_SHA256,
    sourceFile: result.source_file,
  };
  source.defaultEnabled = defaultEnabled;
  source.readerHistoricalTest = {
    schemaVersion: 1,
    mode: evidence.mode,
    keyword: evidence.keyword,
    generatedAt: evidence.generated_at,
    verdict: fullyPassed ? 'fully_passed' : 'partially_passed',
    levels: Object.fromEntries(Object.entries(result.levels).map(([level, outcome]) => [
      level,
      {
        status: outcome.status,
        ...(typeof outcome.reason === 'string' ? { reason: outcome.reason } : {}),
      },
    ])),
    failureReason: result.failure_reason ?? null,
  };

  return {
    source,
    evidenceIndex,
    sourceId: source.bookSourceUrl,
    passDepth: passedDepth(result),
    fullyPassed,
  };
});

const admittedEvidenceText = readFileSync(admittedEvidenceFile, 'utf8');
assert.equal(sha256Hex(admittedEvidenceText), EXPECTED_ADMITTED_EVIDENCE_SHA256,
  'the later six-source admission evidence changed');
const admittedEvidence = JSON.parse(admittedEvidenceText);
assert.equal(admittedEvidence.sources?.length, EXPECTED_COLLECTION_RECORDS);
assert.equal(admittedEvidence.suiteVersion, SUITE_VERSION);
const admittedResults = admittedEvidence.sources.filter(result => result.verdict === 'admitted');
assert.equal(admittedResults.length, EXPECTED_ADMITTED_RECORDS,
  'the consolidated evidence must contain exactly six explicitly admitted sources');
const admittedBySourceId = new Map(admittedResults.map(result => [result.sourceId, result]));
const currentAdmittedSources = JSON.parse(readLatestTrackedFile(repo, legacyBundledRelative));
assert.equal(currentAdmittedSources.length, EXPECTED_ADMITTED_RECORDS);
for (const source of currentAdmittedSources) {
  const result = admittedBySourceId.get(source.bookSourceUrl);
  assert.ok(result, `no recorded admission result for ${source.bookSourceUrl}`);
  source.bookSourceName = source.bookSourceName.replace('（测试内置）', '');
  source.bookSourceGroup = 'Reader 内置 · 已验证书源';
  source.enabled = result.defaultEnabled;
  if (Object.hasOwn(source, 'enabledExplore')) {
    source.enabledExplore = result.defaultEnabled && source.enabledExplore !== false;
  }
  source.builtinId = result.builtinId;
  source.builtinVersion = BUILTIN_VERSION;
  delete source.readerTestBuiltinVersion;
  delete source.readerBuiltinWithdrawn;
  delete source.readerTestBuiltinWithdrawn;
  source.ruleFingerprint = ruleFingerprint(source);
  source.verifiedAt = admittedEvidence.generatedAt;
  source.verificationSuiteVersion = ADMITTED_SUITE_VERSION;
  source.capabilities = ['import', ...source.capabilities.filter(capability => capability !== 'import')];
  source.provenance = {
    ...source.provenance,
    evidence: admittedEvidenceRelative,
    evidenceSha256: EXPECTED_ADMITTED_EVIDENCE_SHA256,
  };
  source.defaultEnabled = result.defaultEnabled;
  source.readerHistoricalTest = {
    schemaVersion: 1,
    mode: 'live',
    generatedAt: admittedEvidence.generatedAt,
    verdict: result.verdict,
    booksVerified: result.booksVerified,
    warnings: result.warnings,
  };
  records.push({
    source,
    evidenceIndex: records.length,
    sourceId: source.bookSourceUrl,
    passDepth: source.capabilities.length,
    fullyPassed: source.capabilities.includes('content'),
    preferAsCurrent: true,
  });
}

assert.equal(records.length, EXPECTED_COLLECTION_RECORDS);
assert.equal(new Set(records.map(record => record.source.builtinId)).size, EXPECTED_COLLECTION_RECORDS,
  'historical source result identities must be unique');
assert.equal(records.slice(0, EXPECTED_TESTED_RECORDS)
  .filter(record => record.fullyPassed).length, EXPECTED_FULLY_PASSED);
assert.equal(new Set(records.slice(0, EXPECTED_TESTED_RECORDS).map(record => record.sourceId)).size,
  EXPECTED_UNIQUE_SOURCE_IDS);
assert.equal(new Set(records.map(record => record.sourceId)).size, EXPECTED_COLLECTION_SOURCE_IDS);

// Recorded live success is not distribution admission. Never ship a rule that
// contains plaintext HTTP, embedded credentials, or synthesized paywall text,
// even if the historical runner reached content. Removed builtin identities are
// retired by BundledSourceLedger on upgrade; no unsafe rule is silently edited
// and represented as the historically verified payload.
const secureRecords = records.filter(record =>
  collectInsecureUrlFindings(record.source).length === 0 &&
  collectSecretFindings(record.source).length === 0 &&
  collectPaywallFindings(record.source).length === 0);
assert.equal(secureRecords.length, EXPECTED_SECURE_COLLECTION_RECORDS,
  'secure distribution admission count changed; review the source corpus explicitly');
assert.equal(new Set(secureRecords.map(record => record.sourceId)).size, EXPECTED_SECURE_SOURCE_IDS,
  'secure distribution source identity count changed; review the source corpus explicitly');

// A Legado collection may contain rule variants with the same bookSourceUrl,
// while Reader correctly treats that URL as the storage identity. Put the
// strongest tested variant last so a normal sequential app import leaves the
// best recorded variant installed for each duplicated identity.
const bestBySourceId = new Map();
for (const record of secureRecords) {
  const current = bestBySourceId.get(record.sourceId);
  if (current === undefined || record.preferAsCurrent === true ||
    (current.preferAsCurrent !== true && (record.passDepth > current.passDepth ||
      record.passDepth === current.passDepth && record.evidenceIndex > current.evidenceIndex))) {
    bestBySourceId.set(record.sourceId, record);
  }
}
const bestRecords = new Set(bestBySourceId.values());
const ordered = [
  ...secureRecords.filter(record => !bestRecords.has(record)),
  ...secureRecords.filter(record => bestRecords.has(record)),
];
const sources = ordered.map(record => record.source);
applyReadingAssistantMetadataCorrection(sources);
applyPopofreeQuoteCorrection(sources);

// Keep the portable collection comfortably below the product's bounded JSON
// import limit. The payload remains ordinary JSON and can be pretty-printed by
// any editor; compact storage avoids wasting several MiB on indentation.
const updated = `${JSON.stringify(sources)}\n`;
writeFileSync(rawFile, updated, 'utf8');
const fileSha256 = sha256Hex(updated);

const owner = readFileSync(ownerFile, 'utf8');
const marker = /const BUNDLED_RAW_FILE_SHA256 = '[0-9a-f]{64}';/;
assert.ok(marker.test(owner), 'pinned bundled-source digest constant missing from ReaderRuntimeOwner.ts');
writeFileSync(ownerFile, owner.replace(marker,
  `const BUNDLED_RAW_FILE_SHA256 = '${fileSha256}';`), 'utf8');

const sourceBytes = createHash('sha256').update(updated).digest('hex');
assert.equal(sourceBytes, fileSha256);
console.log(`refreshed ${sources.length} historically tested records ` +
  `(${bestBySourceId.size} secure unique source identities; ` +
  `${records.length - secureRecords.length} unsafe records excluded); ` +
  `file sha256 ${fileSha256}`);

await import('./generate-bundled-source-index.mjs');
