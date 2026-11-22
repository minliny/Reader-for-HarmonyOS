#!/usr/bin/env node

/*
 * Materialize the latest completed routine source audit as the fixed bundled
 * source import file. This is evidence-only: it never opens a socket.
 *
 * The runner's fingerprint is used only to join audit rows back to the exact
 * rule object. The bundled metadata fingerprint is then recalculated with the
 * canonical supply-chain fingerprint shared by Node and ArkTS.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectInsecureUrlFindings,
  collectPaywallFindings,
  collectSecretFindings,
  ruleFingerprint,
  sha256Hex,
  SUITE_VERSION,
  BUILTIN_VERSION,
} from './source-supply-lib.mjs';
import { assertSourceLoginDefault } from './source-login-default-policy.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const diagnostics = resolve(repo, '.reader-local/diagnostics/merged-rule-audit-20261024T151907');
const rulesPath = resolve(diagnostics, 'merged-rules.json');
const routesPath = resolve(diagnostics, 'routine-source-check-v3-20261025-rerun/routine-routes.csv');
const summaryPath = resolve(diagnostics, 'routine-source-check-v3-20261025-rerun/final-summary.json');
const networkPath = resolve(diagnostics, 'network-preflight/results.json');
const outputPath = resolve(repo, 'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json');
const auditPath = resolve(diagnostics, 'routine-source-check-v3-20261025-rerun/passed-bundle-manifest.json');

function sha256Bytes(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function runnerFingerprint(source) {
  return source.ruleFingerprint || sha256Bytes(Buffer.from(JSON.stringify(source)));
}
function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(value); value = '';
    } else value += char;
  }
  cells.push(value);
  return cells;
}
function readCsv(path) {
  const lines = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').trim().split('\n');
  const header = parseCsvLine(lines.shift());
  return lines.filter(Boolean).map(line => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? '']));
  });
}
function cleanForBundle(source, audit, index) {
  const output = structuredClone(source);
  delete output.readerBuiltinWithdrawn;
  delete output.readerTestBuiltinWithdrawn;
  delete output.readerTestBuiltinVersion;
  output.enabled = true;
  output.defaultEnabled = true;
  // Keep the production admission prefix; the audit origin is carried in
  // provenance and readerHistoricalTest rather than inventing a second ID
  // namespace that the startup contract does not accept.
  output.builtinId = `reader-builtin-${sha256Bytes(Buffer.from(output.bookSourceUrl)).slice(0, 24)}`;
  output.builtinVersion = BUILTIN_VERSION;
  output.verificationSuiteVersion = `${SUITE_VERSION}+routine-gate/v2`;
  output.capabilities = ['import', 'search', 'detail', 'toc', 'content'];
  output.verifiedAt = audit.generatedAt;
  output.provenance = {
    origin: 'reader-routine-source-audit',
    evidence: 'Reader-for-HarmonyOS/.reader-local/diagnostics/merged-rule-audit-20261024T151907/routine-source-check-v3-20261025-rerun/routine-routes.csv',
    evidenceSha256: audit.routesSha256,
    rulesSha256: audit.rulesSha256,
    networkResultsSha256: audit.networkResultsSha256,
    executionPolicy: audit.executionPolicy,
    runnerFingerprint: audit.runnerFingerprint,
    selectedRoute: audit.passingRoutes,
  };
  output.readerHistoricalTest = {
    schemaVersion: 2,
    mode: 'live',
    verdict: 'passed',
    generatedAt: audit.generatedAt,
    lanes: ['direct', 'proxy'],
    requestedLevels: ['L1', 'L2', 'L3', 'L4', 'L5'],
    passingRoutes: audit.passingRoutes,
    targetBookOr80ChaptersTested: false,
    routeOrdinal: index,
  };
  output.ruleFingerprint = ruleFingerprint(output);
  assertSourceLoginDefault(output);
  return output;
}

const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
const rows = readCsv(routesPath);
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const rulesSha256 = sha256Bytes(readFileSync(rulesPath));
const networkResultsSha256 = sha256Bytes(readFileSync(networkPath));
const routesSha256 = sha256Bytes(readFileSync(routesPath));
const direct = new Set(rows.filter(row => row.lane === 'direct' && row.verdict === 'TEXT_CHAIN_PASS').map(row => row.ruleFingerprint));
const proxy = new Set(rows.filter(row => row.lane === 'proxy' && row.verdict === 'TEXT_CHAIN_PASS').map(row => row.ruleFingerprint));
const both = new Set([...direct].filter(fingerprint => proxy.has(fingerprint)));

// Core keys sources by bookSourceUrl. Preserve the final rule variant in the
// merged input when multiple verified rule fingerprints share one origin.
const selectedByUrl = new Map();
const excluded = [];
for (let index = 0; index < rules.length; index += 1) {
  const source = rules[index];
  const fingerprint = runnerFingerprint(source);
  if (!both.has(fingerprint)) continue;
  const findings = [
    ...collectInsecureUrlFindings(source).map(item => ({ kind: 'insecure-url', ...item })),
    ...collectSecretFindings(source).map(item => ({ kind: 'fixed-secret', ...item })),
    ...collectPaywallFindings(source).map(item => ({ kind: 'paywall-placeholder', ...item })),
  ];
  try { assertSourceLoginDefault(source); }
  catch (error) { findings.push({ kind: 'login-default', message: error.message }); }
  if (findings.length > 0) {
    excluded.push({ index, sourceId: source.sourceId || source.bookSourceUrl, bookSourceUrl: source.bookSourceUrl, bookSourceName: source.bookSourceName, runnerFingerprint: fingerprint, findings });
    continue;
  }
  selectedByUrl.set(source.bookSourceUrl, { source, index, runnerFingerprint: fingerprint });
}

const auditBase = {
  generatedAt: summary.generatedAt,
  executionPolicy: 'probe-then-chain/v1',
  rulesSha256,
  networkResultsSha256,
  routesSha256,
  selectedRunnerFingerprints: both.size,
  selectedSourceUrlsBeforeStaticAdmission: new Set([...both].map(fingerprint => {
    const match = rules.find(source => runnerFingerprint(source) === fingerprint);
    return match?.bookSourceUrl;
  })).size,
};
const bundled = [...selectedByUrl.values()]
  .sort((left, right) => left.source.bookSourceUrl.localeCompare(right.source.bookSourceUrl))
  .map((item, index) => cleanForBundle(item.source, {
    ...auditBase,
    runnerFingerprint: item.runnerFingerprint,
    passingRoutes: [...new Set(rows.filter(row => row.ruleFingerprint === item.runnerFingerprint && row.verdict === 'TEXT_CHAIN_PASS').map(row => row.route))].sort(),
  }, index));

if (bundled.length === 0) throw new Error('No statically admissible dual-lane text sources were selected');
writeFileSync(outputPath, `${JSON.stringify(bundled, null, 2)}\n`);
const manifest = {
  schema: 'reader-routine-passed-source-bundle/v1',
  generatedAt: summary.generatedAt,
  sourceFile: 'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json',
  sourceFileSha256: sha256Bytes(readFileSync(outputPath)),
  sourceCount: bundled.length,
  selectedRunnerFingerprints: both.size,
  selectedSourceUrlsBeforeStaticAdmission: auditBase.selectedSourceUrlsBeforeStaticAdmission,
  staticallyExcluded: excluded.length,
  excluded,
  directTextChainPassSourceIds: summary.textChainPassSourceIdsDirect,
  proxyTextChainPassSourceIds: summary.textChainPassSourceIdsProxy,
  bothLaneTextChainPassSourceIds: summary.textChainPassSourceIdsBothLanes,
  rulesSha256,
  networkResultsSha256,
  routesSha256,
  executionPolicy: auditBase.executionPolicy,
};
writeFileSync(auditPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
