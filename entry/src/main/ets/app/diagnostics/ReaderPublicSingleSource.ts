import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { canonicalRulePayloadJson, sha256Hex } from '../BundledBookSourceSupply';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import { SourceGateway } from '../../features/source/application/SourceGateway';
import { buildReaderPublicFixtureDirectory, type ReaderPublicFixtureScope } from './ReaderPublicFixtureScope';

const RAW_FILE = 'reader-public-fixture-single-source-v1.json';
const SOURCE_BYTES = 475;
const SOURCE_SHA256 = '57fb68cab0953548aed7c432e02f87d84e795329080fcc701a49fa643d8d9160';
const SOURCE_ID = 'https://source-01.reader-phase1.invalid/';

/** Run only while the debug fixture owner holds startup and the UI is gated. */
export async function prepareReaderPublicSingleSource(owner: ReaderRuntimeOwner,
  fixture: ReaderPublicFixtureScope): Promise<void> {
  const current = (): boolean => fixture.kind === 'fixture' && fixture.id === 'single-reserved' &&
    owner.isCurrentPublicFixture(fixture);
  if (!current()) throw new Error('PUBLIC_SINGLE_SOURCE_SCOPE_NOT_CURRENT');
  const context = owner.getUIAbilityContext();
  const root = buildReaderPublicFixtureDirectory(context.filesDir, fixture.id);
  if (root === undefined || !(await fileIo.lstat(root.slice(0, root.lastIndexOf('/')))).isDirectory() ||
    !(await fileIo.lstat(root)).isDirectory()) throw new Error('PUBLIC_SINGLE_SOURCE_DIRECTORY_NOT_ISOLATED');

  const bytes = await context.resourceManager.getRawFileContent(RAW_FILE);
  const document = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
  if (bytes.byteLength !== SOURCE_BYTES || await sha256Hex(document) !== SOURCE_SHA256) {
    throw new Error('PUBLIC_SINGLE_SOURCE_RESOURCE_MISMATCH');
  }
  const expected = (JSON.parse(document) as JsonObject[])[0];
  const gateway = new SourceGateway(owner);
  let rows = await gateway.loadSources(undefined, true, current);
  if (!current()) throw new Error('PUBLIC_SINGLE_SOURCE_SCOPE_NOT_CURRENT');
  if (rows.length === 0) {
    const result = await gateway.importBookSourceDocument(document, current);
    if (result.importedCount !== 1 || result.failedCount !== 0 || result.failures.length !== 0 ||
      result.sourceIds.length !== 1 || result.sourceIds[0] !== SOURCE_ID) {
      throw new Error('PUBLIC_SINGLE_SOURCE_IMPORT_NOT_CONFIRMED');
    }
    rows = await gateway.loadSources(undefined, true, current);
  }
  if (!current()) throw new Error('PUBLIC_SINGLE_SOURCE_SCOPE_NOT_CURRENT');
  const row = rows[0];
  if (rows.length !== 1 || row.sourceId !== SOURCE_ID || row.baseUrl !== SOURCE_ID ||
    row.name !== expected['bookSourceName'] || row.group !== expected['bookSourceGroup'] ||
    row.enabled || row.enabledExplore || row.loginUrl !== undefined || row.category !== 'novel' ||
    (row.checkState !== undefined && row.checkState !== 'unchecked')) {
    throw new Error('PUBLIC_SINGLE_SOURCE_UNEXPECTED_CATALOG');
  }

  const definition = await gateway.readSourceDefinition(SOURCE_ID, current);
  if (!current() || definition?.hasRawBookSource !== true || definition.sourceVersion !== row.sourceVersion) {
    throw new Error('PUBLIC_SINGLE_SOURCE_DEFINITION_NOT_CURRENT');
  }
  const stored = JSON.parse(definition.text) as JsonObject;
  const keys = Object.keys(expected);
  if (Object.keys(stored).length !== keys.length ||
    !keys.every((key: string): boolean => key === 'ruleSearch' || stored[key] === expected[key]) ||
    canonicalRulePayloadJson(stored) !== canonicalRulePayloadJson(expected)) {
    throw new Error('PUBLIC_SINGLE_SOURCE_DEFINITION_MISMATCH');
  }
}
