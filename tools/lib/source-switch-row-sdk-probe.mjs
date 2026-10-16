import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';

const sourceUrl = new URL('../../entry/src/main/ets/features/source/SourceSwitchWindow.ets', import.meta.url);
const sdkRoot = resolveEtsLoaderRoot();
const require = createRequire(import.meta.url);

/** Execute the production retained-row classes and the installed SDK's exact
 * V1 @Observed decorator. Configuration logging and V2 admission are controlled
 * boundaries; actual object proxies and property delivery use the shared probe.
 * Ace's native lazy range selection/reordering and pixels remain device evidence. */
export function sourceSwitchRowSdk(properties, source = readFileSync(sourceUrl, 'utf8')) {
  const ts = require(`${sdkRoot}/node_modules/typescript`);
  const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
  const parse = (text, kind) => ts.createSourceFile(virtualFilePath('SourceSwitchRowSdk.ets'), text,
    ts.ScriptTarget.Latest, true, kind, options);
  const tree = parse(source, ts.ScriptKind.ETS);
  assert.deepEqual(tree.parseDiagnostics, [], 'production source-switch rows parse');
  const declaration = name => {
    const node = tree.statements.find(value => value.name?.getText(tree) === name);
    assert.ok(node, `actual production ${name}`);
    return node.getText(tree);
  };
  const gatewayText = readFileSync(new URL('../../entry/src/main/ets/features/source/SourceSwitchGateway.ts', import.meta.url), 'utf8');
  const gateway = parse(gatewayText, ts.ScriptKind.TS);
  const keyText = gateway.statements.find(value => value.name?.getText(gateway) === 'sourceSwitchCandidateKey').getText(gateway);
  const sourceSwitchCandidateKey = new Function(stripTypeScriptTypes(keyText).replace(/^export /, '') +
    ';return sourceSwitchCandidateKey;')();

  const binary = readFileSync(properties.source.path);
  const marker = binary.indexOf(Buffer.from('class SynchedPropertyOneWayPU'));
  assert.ok(marker > 0, 'the installed property runtime contains its V1 decorator');
  const runtime = binary.subarray(binary.lastIndexOf(0, marker) + 1, binary.indexOf(0, marker)).toString('utf8');
  const decoratorStart = runtime.indexOf('function Observed(BaseClass) {');
  const decoratorEnd = runtime.indexOf('\nclass SubscribableHandler {', decoratorStart);
  assert.ok(decoratorStart > 0 && decoratorEnd > decoratorStart, 'installed SDK Observed function');
  const Observed = new Function('ObservedObject', 'ObserveV2', 'ConfigureStateMgmt', '__IS_OBSERVED_PROXIED',
    'stateMgmtConsole', runtime.slice(decoratorStart, decoratorEnd) + ';return Observed;')(
    properties.sdk.ObservedObject, { SYMBOL_REFS: Symbol('row-probe-v2-refs') },
    { instance: { usingPUObservedTrack() {} } }, Symbol('row-probe-observed'),
    { error(message) { throw new Error(message); } });
  const rowText = declaration('SourceSwitchCandidateRow');
  assert.match(rowText, /^@Observed\s+class SourceSwitchCandidateRow\b/,
    'production retained rows are V1 observed classes');
  const RawRow = new Function('sourceSwitchCandidateKey',
    stripTypeScriptTypes(rowText.replace(/^@Observed\s+/, '')) + ';return SourceSwitchCandidateRow;')(sourceSwitchCandidateKey);
  const SourceSwitchCandidateRow = Observed(RawRow);
  require(`${sdkRoot}/lib/validate_ui_syntax.js`).observedClassCollection.add('SourceSwitchCandidateRow');
  const SourceSwitchCandidateDataSource = new Function('sourceSwitchCandidateKey', 'SourceSwitchCandidateRow',
    stripTypeScriptTypes(declaration('SourceSwitchCandidateDataSource')) + ';return SourceSwitchCandidateDataSource;')(
    sourceSwitchCandidateKey, SourceSwitchCandidateRow);
  return { SourceSwitchCandidateRow, SourceSwitchCandidateDataSource, sourceSwitchCandidateKey };
}
