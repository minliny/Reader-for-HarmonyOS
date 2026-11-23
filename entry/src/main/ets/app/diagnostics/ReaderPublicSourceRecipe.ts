import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { canonicalRulePayloadJson, sha256Hex } from '../BundledBookSourceSupply';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import { SourceGateway } from '../../features/source/application/SourceGateway';
import { classifyReaderSource } from '../../features/source/application/ReaderSourceCategory';
import { buildReaderPublicFixtureDirectory, type ReaderPublicFixtureScope } from './ReaderPublicFixtureScope';
import { READER_PUBLIC_SEARCH_DELAYED_URL, READER_PUBLIC_SEARCH_HTTP_503_URL,
  READER_PUBLIC_SEARCH_HTTP_503_BODY_URL } from './ReaderPublicSearchHttpFixture';

interface PublicSourceRecipe {
  rawFile: string;
  bytes: number;
  sha256: string;
  sourceIds: string[];
  requireUnchecked: boolean;
  enabled?: boolean;
  requirePickerImport?: boolean;
  mixedCategories?: boolean;
}

function readRecipe(id: string): PublicSourceRecipe | undefined {
  if (id === 'group-options-12') {
    const sourceIds: string[] = [];
    for (let number = 1; number <= 12; number += 1) {
      sourceIds.push(`https://group-scroll-${String(number).padStart(2, '0')}.reader-phase1.invalid/`);
    }
    return {
      rawFile: 'reader-public-fixture-group-options-12-v1.json', bytes: 2967,
      sha256: '2b5bfcd44f38abffbf81990b09ad83de903434b4b714356a8b59756ffe945be9',
      sourceIds, requireUnchecked: false,
    };
  }
  if (id === 'row-actions') {
    return {
      rawFile: 'reader-public-fixture-row-actions-v1.json', bytes: 587,
      sha256: '00babc246c2424dea9f40f7630fbff09ecd256b7b4e5c4efe2c92fce8511f730',
      sourceIds: ['https://row-actions.reader-phase1.invalid/'], requireUnchecked: true,
    };
  }
  if (id === 'row-detect-center' || id === 'row-detect-edge' ||
    id === 'row-detect-center-v2' || id === 'row-detect-edge-v2') {
    // Each scope owns its own history. A later launch may read a completed
    // detection, while the case still requires an unchecked row.
    return {
      rawFile: 'reader-public-fixture-row-detect-v1.json', bytes: 260,
      sha256: '00feb7d1f82a95b137e72bd2a0f67a9723fe80b7c6eff9bf36dceca34ffd063c',
      sourceIds: ['https://offline-detect.reader-phase1.invalid/'], requireUnchecked: false,
    };
  }
  if (id === 'search-delayed') {
    return {
      rawFile: 'reader-public-fixture-search-delayed-v1.json', bytes: 438,
      sha256: '54888a3939e3577d20788e46bf586f1df3060edb35dfd9fee76191fe78a016bb',
      sourceIds: [READER_PUBLIC_SEARCH_DELAYED_URL], requireUnchecked: false, enabled: true,
    };
  }
  if (id === 'search-http-503') {
    return {
      rawFile: 'reader-public-fixture-search-http-503-v1.json', bytes: 450,
      sha256: 'ab3b9fc4fe7b60f7d87f44fc13a739d3900a4352e1f3d6d4bdc044a59fa2a728',
      sourceIds: [READER_PUBLIC_SEARCH_HTTP_503_URL], requireUnchecked: false, enabled: true,
    };
  }
  if (id === 'search-http-503-body') {
    return {
      rawFile: 'reader-public-fixture-search-http-503-body-v1.json', bytes: 520,
      sha256: '8c1aea70198d0dccf1530878f3bf02e4247651bf270a64af08b754d2491dfc33',
      sourceIds: [READER_PUBLIC_SEARCH_HTTP_503_BODY_URL], requireUnchecked: false, enabled: true,
    };
  }
  if (id === 'import-research-center' || id === 'import-research-edge' ||
    id === 'import-research-center-v2' || id === 'import-research-edge-v2' ||
    id === 'import-research-center-v3' || id === 'import-research-edge-v3') {
    return {
      rawFile: 'reader-public-fixture-status-research-v1.json', bytes: 375,
      sha256: 'f2ac6faea38611051d76b22e5f5bcf2553bd52450290ca39ee7a6d8f072dd674',
      sourceIds: ['https://status-research.reader-phase1.invalid/'], requireUnchecked: true, requirePickerImport: true,
    };
  }
  if (id === 'all-disabled-layout') {
    const sourceIds: string[] = [];
    for (let number = 1; number <= 18; number += 1) {
      sourceIds.push(`https://source-${String(number).padStart(2, '0')}.reader-phase1.invalid/`);
    }
    return {
      rawFile: 'reader-public-fixture-disabled-layout-v1.json', bytes: 8564,
      sha256: '8cfc41f1707a9a4b63f61c5d00082e160dacec169cb05599692ce39ca8d1dae5',
      sourceIds, requireUnchecked: true, requirePickerImport: true, mixedCategories: true,
    };
  }
  return undefined;
}

/** The debug entry must keep the normal UI gated until this function settles. */
export async function prepareReaderPublicSourceRecipe(owner: ReaderRuntimeOwner,
  fixture: ReaderPublicFixtureScope): Promise<void> {
  const recipe = readRecipe(fixture.id);
  const current = (): boolean => recipe !== undefined && fixture.kind === 'fixture' && owner.isCurrentPublicFixture(fixture);
  if (!recipe || !current()) throw new Error('PUBLIC_SOURCE_RECIPE_SCOPE_NOT_CURRENT');
  const context = owner.getUIAbilityContext();
  const root = buildReaderPublicFixtureDirectory(context.filesDir, fixture.id);
  if (root === undefined || !(await fileIo.lstat(root.slice(0, root.lastIndexOf('/')))).isDirectory() ||
    !(await fileIo.lstat(root)).isDirectory()) throw new Error('PUBLIC_SOURCE_RECIPE_DIRECTORY_NOT_ISOLATED');

  const bytes = await context.resourceManager.getRawFileContent(recipe.rawFile);
  const document = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
  if (bytes.byteLength !== recipe.bytes || await sha256Hex(document) !== recipe.sha256) {
    throw new Error('PUBLIC_SOURCE_RECIPE_RESOURCE_MISMATCH');
  }
  const decoded = JSON.parse(document) as JsonObject[];
  const expected = new Map<string, JsonObject>();
  const enabled = recipe.enabled === true;
  if (decoded.length !== recipe.sourceIds.length) throw new Error('PUBLIC_SOURCE_RECIPE_DEFINITION_MISMATCH');
  for (const [index, item] of decoded.entries()) {
    const sourceId = recipe.sourceIds[index];
    if (item['bookSourceUrl'] !== sourceId || item['enabled'] !== enabled || item['enabledExplore'] !== false ||
      (!recipe.mixedCategories && item['bookSourceType'] !== 0) || (enabled && (item['searchUrl'] !== sourceId ||
        item['enabledCookieJar'] !== false || item['header'] !== undefined || item['loginUrl'] !== undefined))) {
      throw new Error('PUBLIC_SOURCE_RECIPE_DEFINITION_MISMATCH');
    }
    expected.set(sourceId, item);
  }

  const gateway = new SourceGateway(owner);
  let rows = await gateway.loadSources(undefined, true, current);
  if (!current()) throw new Error('PUBLIC_SOURCE_RECIPE_SCOPE_NOT_CURRENT');
  if (rows.length === 0) {
    // Only a real Picker can populate these scopes. A cold reopen verifies
    // the existing import below and leaves its state available for diagnosis.
    if (recipe.requirePickerImport === true) return;
    const result = await gateway.importBookSourceDocument(document, current);
    if (result.importedCount !== expected.size || result.failedCount !== 0 || result.failures.length !== 0 ||
      result.sourceIds.length !== expected.size || new Set(result.sourceIds).size !== expected.size ||
      !result.sourceIds.every((sourceId: string): boolean => expected.has(sourceId))) {
      throw new Error('PUBLIC_SOURCE_RECIPE_IMPORT_NOT_CONFIRMED');
    }
    rows = await gateway.loadSources(undefined, true, current);
  }
  if (!current()) throw new Error('PUBLIC_SOURCE_RECIPE_SCOPE_NOT_CURRENT');
  if (rows.length !== expected.size || new Set(rows.map(row => row.sourceId)).size !== expected.size) {
    throw new Error('PUBLIC_SOURCE_RECIPE_UNEXPECTED_CATALOG');
  }
  for (const row of rows) {
    const authored = expected.get(row.sourceId);
    if (authored === undefined) throw new Error('PUBLIC_SOURCE_RECIPE_UNEXPECTED_CATALOG');
    const category = recipe.mixedCategories ? classifyReaderSource({ bookSourceType: authored['bookSourceType'],
      name: row.name, group: row.group, sourceId: row.sourceId, baseUrl: row.baseUrl }) : 'novel';
    if (row.baseUrl !== row.sourceId || row.name !== authored['bookSourceName'] ||
      row.group !== authored['bookSourceGroup'] || row.enabled !== enabled || row.enabledExplore ||
      row.loginUrl !== authored['loginUrl'] || row.category !== category ||
      (recipe.requireUnchecked && row.checkState !== undefined && row.checkState !== 'unchecked')) {
      throw new Error('PUBLIC_SOURCE_RECIPE_UNEXPECTED_CATALOG');
    }
    const definition = await gateway.readSourceDefinition(row.sourceId, current);
    if (!current() || definition?.hasRawBookSource !== true || definition.sourceVersion !== row.sourceVersion) {
      throw new Error('PUBLIC_SOURCE_RECIPE_DEFINITION_NOT_CURRENT');
    }
    const stored = JSON.parse(definition.text) as JsonObject;
    const keys = Object.keys(authored);
    if (Object.keys(stored).length !== keys.length ||
      !keys.every((key: string): boolean => key === 'ruleSearch' || stored[key] === authored[key]) ||
      canonicalRulePayloadJson(stored) !== canonicalRulePayloadJson(authored)) {
      throw new Error('PUBLIC_SOURCE_RECIPE_DEFINITION_MISMATCH');
    }
  }
}
