/** Scoped successor capture for the 2026-10-06 directory implementation.
 * This records current code/SDK facts; it is not native or user acceptance.
 * No historical private budget, unrelated producer or public role is rewritten. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { sharedProducerShape, producerConsumerEdges } from './lib/architecture-shared-producer-contract.mjs';
import { auditTypographyConsumers } from './lib/reader-typography-consumer-audit.mjs';
import { countPrivateTypographyCalls } from './lib/architecture-private-typography-count.mjs';
import { typographyCarrierShape, approvedNativeCarrierFacts } from './lib/approved-manga-typography-carriers.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const write = process.argv.length === 3 && process.argv[2] === '--write';
assert.ok(write || process.argv.length === 2, 'Usage: node tools/capture-manga-directory-registries.mjs [--write]');
const prefix = 'entry/src/main/ets/';
const paths = [
  'features/bookshelf/BookDirectoryPage.ets', 'features/bookshelf/LocalBookDetail.ets',
  'features/manga/MangaReadingDirectoryFallback.ets', 'features/manga/MangaReadingSurface.ets',
  'features/reading/ReaderDirectoryNavigationList.ets', 'features/reading/ReaderDirectoryNavigationSurface.ets',
  'features/common/PageBackBar.ets',
].map(path => prefix + path);
const producerComponents = ['MangaDirectoryEntryRow', 'MangaDirectoryCurrentFooter'];
const producerFiles = producerComponents.map(component => prefix + 'features/manga/' + component + '.ets');
const docs = 'docs/MANGA_DIRECTORY_DEMO_DELIVERY_20261006.md';
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const baselineFile = 'tools/architecture-consumer-baseline.json';
const contractFile = 'tools/fixtures/architecture-shared-producers.json';
// Historical approval bytes are immutable; only this exact selected successor is recaptured.
const typographyFile = 'tools/fixtures/design/manga-directory-typography-successor-20261006.json';
const baseline = readJson(baselineFile), contract = readJson(contractFile), typography = readJson(typographyFile);
const originalBaseline = structuredClone(baseline), originalContract = structuredClone(contract), originalTypography = structuredClone(typography);
const inventory = JSON.parse(execFileSync(process.execPath, ['tools/audit-architecture-consumers.mjs', '--stdout=json'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }));
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const facts = { evidence: docs, sourceHead, status: 'CODE_AND_SDK_FACTS_NATIVE_AND_USER_ACCEPTANCE_OPEN' };
const counts = source => {
  const result = {};
  const fontSize = countPrivateTypographyCalls(source, 'entry/src/main/ets/features/manga/DirectoryCapture.ets');
  if (fontSize > 0) result.fontSize = fontSize;
  for (const [name, expression] of Object.entries({ backgroundColor: /\.backgroundColor\s*\(/g,
    CustomDialogController: /new\s+CustomDialogController\s*\(/g, showAlertDialog: /showAlertDialog/g,
    bindSheet: /\.bindSheet\s*\(/g, bindPopup: /\.bindPopup/g, bindContentCover: /\.bindContentCover/g, bindMenu: /\.bindMenu/g })) {
    const count = (source.match(expression) ?? []).length;
    if (count > 0) result[name] = count;
  }
  return result;
};
const summary = [];
for (const file of paths) {
  const source = readFileSync(file, 'utf8');
  const entry = typography.files.find(entry => entry.path === file);
  const policy = baseline.uiPolicies.find(entry => entry.file === file);
  assert.ok(entry && policy, 'Only an existing concrete manga successor entry may be captured: ' + file);
  const carriers = auditTypographyConsumers(source, file).map(typographyCarrierShape);
  const nativeDefaults = approvedNativeCarrierFacts(source, file);
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  const carriersChanged = !isDeepStrictEqual(carriers, entry.carriers) || !isDeepStrictEqual(nativeDefaults, entry.nativeDefaults);
  const sourceChanged = entry.sourceSha256 !== sourceSha256;
  const changed = carriersChanged || sourceChanged;
  if (changed) {
    entry.sourceSha256 = sourceSha256;
    entry.carriers = carriers; entry.nativeDefaults = nativeDefaults; entry.successorFacts = facts;
    // Keep all original roles/families and pin only new concrete references.
    for (const name of new Set(carriers.flatMap(carrier => Object.values(carrier.modifiers)
      .flatMap(value => [...value.expression.matchAll(/\bTYPE_\w+/g)].map(match => match[0]))))) {
      assert.ok(readerTypographyRoles[name], 'actual public role exists: ' + name);
      const value = JSON.parse(JSON.stringify(readerTypographyRoles[name]));
      if (entry.roles[name] !== undefined) assert.deepEqual(entry.roles[name], value, 'an existing public role tuple is never recaptured: ' + name);
      else entry.roles[name] = value;
    }
    for (const name of new Set(carriers.flatMap(carrier => Object.values(carrier.modifiers)
      .flatMap(value => [...value.expression.matchAll(/\bREADER_FONT_\w+/g)].map(match => match[0]))))) {
      assert.ok(fontFamilies[name], 'actual physical family exists: ' + name);
      if (entry.fontFamilies[name] !== undefined) assert.equal(entry.fontFamilies[name], fontFamilies[name], 'an existing physical family is never recaptured: ' + name);
      else entry.fontFamilies[name] = fontFamilies[name];
    }
  }
  const actualCounts = counts(source);
  const budgetChanged = !isDeepStrictEqual(policy.counts, actualCounts);
  if (budgetChanged) {
    policy.counts = actualCounts; policy.successorFacts = facts;
  }
  summary.push({ file, sourceChanged, carriersChanged, carriers: carriers.length, budgetChanged, counts: actualCounts });
}
const shared = [];
for (const component of producerComponents) {
const producerFile = prefix + 'features/manga/' + component + '.ets';
const source = readFileSync(producerFile, 'utf8');
const shape = sharedProducerShape(source, producerFile);
const producer = {
  id: 'shared-' + component, file: producerFile, component,
  specPolicy: component === 'MangaDirectoryEntryRow' ?
    'Finite generated manga directory row/numeric/parts variants. Only canonical entries, exact hierarchy/presentation facts, current state and business callbacks are inputs; no physical typography/geometry overrides. The generated visual contract and shared layout adapter own minimum heights, line boxes, safe scale and columns.' :
    'Finite generated current-position footer shared by full and quick manga directories. Only canonical title, page position, theme scheme, actual measured available width and height observation are inputs. The generated visual contract owns typography, minimum height and narrow or large-font stacked presentation; callers cannot override its paint or spacing.',
  successorFacts: facts, shape,
  specSources: (component === 'MangaDirectoryEntryRow' ?
    ['MangaDirectoryLayout.ts', 'MangaDirectoryPresentation.ts', 'MangaDirectoryDisplay.ts', 'MangaDirectoryState.ts', 'MangaDirectoryVisual.ts', 'MangaDirectoryPressFeedback.ets'] : ['MangaDirectoryVisual.ts']).map(name => {
    const file = prefix + 'features/manga/' + name;
    return { file, shape: sharedProducerShape(readFileSync(file, 'utf8'), file) };
  }),
  consumers: producerConsumerEdges(inventory, component),
  removalProofs: [docs, prefix + 'features/bookshelf/BookDirectoryPage.ets', prefix + 'features/manga/MangaReadingDirectoryFallback.ets'],
  sdkProofs: component === 'MangaDirectoryEntryRow' ?
    ['tools/test-manga-directory-entry-row.mjs', 'tools/test-manga-reading-directory-fallback.mjs', 'tools/test-manga-book-directory-chrome.mjs', 'tools/test-manga-directory-press-feedback.mjs'] :
    ['tools/test-manga-directory-quick-panel-sdk.mjs', 'tools/test-manga-book-directory-chrome.mjs'],
};
assert.deepEqual(producer.consumers.map(edge => edge.file).sort(), (component === 'MangaDirectoryEntryRow' ? [
  'features/bookshelf/BookDirectoryPage.ets', 'features/bookshelf/LocalBookDetail.ets', 'features/manga/MangaReadingDirectoryFallback.ets',
] : ['features/bookshelf/BookDirectoryPage.ets', 'features/manga/MangaReadingSurface.ets']).sort(),
  'the finite producer is consumed by exactly its implemented manga directory owners');
const oldProducer = contract.producers.findIndex(entry => entry.file === producerFile);
if (oldProducer < 0) contract.producers.push(producer); else contract.producers[oldProducer] = producer;
const registration = { file: producerFile, kind: 'finite-spec-actual-shared-producer', owner: component,
  reason: component === 'MangaDirectoryEntryRow' ?
    'One concrete manga directory content renderer replaces duplicated fallback/full/detail bodies, with finite generated demo variants and original owner admission/callbacks. Code and SDK facts are recorded; native layout and user acceptance remain open.' :
    'One concrete generated current-position footer replaces the duplicated full and quick bodies. Only measured space and canonical reading facts are supplied; native layout and user acceptance remain open.',
  counts: counts(source), contractId: producer.id, proof: producer.sdkProofs[0], successorFacts: facts };
const oldOwner = baseline.sharedOwners.findIndex(entry => entry.file === producerFile);
if (oldOwner < 0) baseline.sharedOwners.push(registration); else baseline.sharedOwners[oldOwner] = registration;
shared.push({ file: producerFile, consumers: producer.consumers.length, counts: registration.counts });
}
assert.deepEqual(baseline.rows, originalBaseline.rows, 'all93 historical business rows are immutable');
assert.deepEqual(baseline.uiPolicies.filter(entry => !paths.includes(entry.file)),
  originalBaseline.uiPolicies.filter(entry => !paths.includes(entry.file)), 'unrelated UI policies remain immutable');
assert.deepEqual(baseline.sharedOwners.filter(entry => !producerFiles.includes(entry.file)),
  originalBaseline.sharedOwners.filter(entry => !producerFiles.includes(entry.file)), 'unrelated shared registrations remain immutable');
assert.deepEqual(contract.producers.filter(entry => !producerFiles.includes(entry.file)),
  originalContract.producers.filter(entry => !producerFiles.includes(entry.file)), 'unrelated producer shapes/edges remain immutable');
assert.deepEqual(typography.files.filter(entry => !paths.includes(entry.path)),
  originalTypography.files.filter(entry => !paths.includes(entry.path)), 'unrelated typography carriers remain immutable');
assert.deepEqual(contract.legacyBusinessBudgetOrigins, originalContract.legacyBusinessBudgetOrigins, 'historical transfer witnesses remain immutable');
for (const file of paths) assert.deepEqual(baseline.uiPolicies.find(entry => entry.file === file).supersededLegacyCounts,
  originalBaseline.uiPolicies.find(entry => entry.file === file).supersededLegacyCounts, 'the original counts are never recaptured: ' + file);
if (write) {
  for (const [file, value] of [[baselineFile, baseline], [contractFile, contract], [typographyFile, typography]])
    writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
} else {
  assert.deepEqual(baseline, originalBaseline, 'scoped architecture capture is stale; review then run --write');
  assert.deepEqual(contract, originalContract, 'scoped shared producer capture is stale; review then run --write');
  assert.deepEqual(typography, originalTypography, 'scoped typography successor capture is stale; review then run --write');
}
console.log(JSON.stringify({ mode: write ? 'write' : 'check', boundary: facts.status, summary,
  shared }, null, 2));
