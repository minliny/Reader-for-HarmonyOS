import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const loaderRoot = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${loaderRoot}/node_modules/typescript`);
const sdkEtsRoot = fileURLToPath(new URL('../../', `file://${loaderRoot}/`));
const officialIndex = `${sdkEtsRoot}component/index-full.d.ts`;
const officialUiContext = `${sdkEtsRoot}api/@ohos.arkui.UIContext.d.ts`;
const ownerPath = fileURLToPath(new URL('../entry/src/main/ets/app/ReaderNativeAlertOwner.ts', import.meta.url));
const contractPath = fileURLToPath(new URL('../entry/src/main/ets/app/ReaderNativeAlertContract.d.ts', import.meta.url));
const ownerSource = readFileSync(ownerPath, 'utf8');
const contractSource = readFileSync(contractPath, 'utf8');
const declaration = ts.createSourceFile(contractPath, contractSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const actualOptions = declaration.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'ReaderNativeAlertOptions');
assert.ok(actualOptions, 'production options are declared at the type-only SDK boundary');
assert.deepEqual(actualOptions.heritageClauses.flatMap(clause => clause.types.map(type => type.getText(declaration))),
  ['AlertDialogParamWithConfirm'], 'reuse the entire official native dialog declaration');
assert.deepEqual(actualOptions.members.map(member => [member.name.getText(declaration), member.type.getText(declaration), Boolean(member.questionToken)]),
  [['primaryButton', 'AlertDialogButtonBaseOptions', true], ['secondaryButton', 'AlertDialogButtonBaseOptions', true]],
  'only the two original finite slots supplement the official declaration; no copied native schema');
assert.ok(!ownerSource.includes('export interface ReaderNativeAlertOptions'), 'runtime module does not define a second native contract');

const options = {
  target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs, strict: true,
  noEmit: true, skipLibCheck: true, allowNonTsExtensions: true,
  needDoArkTsLinter: true, isCompatibleVersion: false,
};
const validInput = "{ title: '原标题', message: '原内容', primaryButton: { value: '确认', action: (): void => {} } }";
function check(input) {
  const consumerPath = '/tmp/ReaderNativeAlertTypeContract.ets';
  // The .ets consumer uses the actual production import and the SDK's actual
  // UIContext method signature. There is no declared substitute for that API.
  const source = `import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderNativeAlertOwner, type ReaderNativeAlertOptions } from '${ownerPath.replace(/\.ts$/, '')}';
declare let context: UIContext;
const owner = new ReaderNativeAlertOwner();
owner.present((native: ReaderNativeAlertOptions): void => context.showAlertDialog(native),
  'notice', ${input}, (): boolean => true);`;
  const host = ts.createCompilerHost(options), getSourceFile = host.getSourceFile;
  host.getSourceFile = (name, languageVersion, ...rest) => name === consumerPath
    ? ts.createSourceFile(name, source, languageVersion, true, ts.ScriptKind.ETS)
    : getSourceFile(name, languageVersion, ...rest);
  // Only the official SDK module name needs a filesystem resolution seam.
  // Reader imports and the new .d.ts declaration use normal Node resolution.
  host.resolveModuleNames = (names, from) => names.map(name => name === '@ohos.arkui.UIContext'
    ? { resolvedFileName: officialUiContext, extension: ts.Extension.Dts, isExternalLibraryImport: true }
    : ts.resolveModuleName(name, from, options, host).resolvedModule);
  const program = ts.createProgram([consumerPath, ownerPath, contractPath, officialIndex], options, host);
  const productionInputs = new Set([consumerPath, ownerPath, contractPath]);
  const diagnostics = program.getSyntacticDiagnostics().concat(program.getSemanticDiagnostics())
    .filter(item => productionInputs.has(item.file?.fileName));
  const checker = program.getTypeChecker(), consumer = program.getSourceFile(consumerPath);
  let nativeParameter;
  const visit = node => {
    if (ts.isParameter(node) && node.name.getText(consumer) === 'native') nativeParameter = node;
    ts.forEachChild(node, visit);
  };
  visit(consumer);
  const nativeType = checker.getTypeAtLocation(nativeParameter.name);
  assert.equal(Boolean(nativeType.flags & ts.TypeFlags.Any), false, 'native options are not an unresolved any');
  const primary = nativeType.getProperty('primaryButton');
  const primaryType = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(primary, nativeParameter));
  assert.equal(Boolean(primaryType.flags & ts.TypeFlags.Any), false, 'official button schema remains typed');
  const action = primaryType.getProperty('action');
  const actionType = checker.getTypeOfSymbolAtLocation(action, nativeParameter);
  assert.equal(checker.getSignaturesOfType(actionType, ts.SignatureKind.Call).length, 1,
    'official VoidCallback is resolved through the actual production declaration');
  return diagnostics.map(item => ({ code: item.code, file: item.file.fileName,
    message: ts.flattenDiagnosticMessageText(item.messageText, ' ') }));
}

assert.deepEqual(check(validInput), [], 'actual production/native dialog boundary accepts its original fields');
const negatives = [
  ['invalid action', validInput.replace('action: (): void => {}', 'action: 17'), 2322],
  ['unknown native field', validInput.replace("{ title:", "{ inventedNativeField: true, title:"), 2345],
  ['unknown button field', validInput.replace("{ value:", "{ inventedNativeButtonField: true, value:"), 2322],
  ['missing button name', validInput.replace("value: '确认', ", ''), 2741],
];
for (const [label, input, code] of negatives) {
  const diagnostics = check(input);
  assert.equal(diagnostics.length, 1, `${label}: exact negative diagnostic, no unrelated production error`);
  assert.equal(diagnostics[0].code, code, label);
}
console.log('PASS real SDK native Alert type contract: production .d.ts import, original official UIContext schema, typed slots/handler, valid input and four illegal field/action/name controls');
