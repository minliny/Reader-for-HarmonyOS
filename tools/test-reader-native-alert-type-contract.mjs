import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "official-current-alert-types": {
    "description": "Current producer + official UIContext strict semantic/ArkTS lint, notAny slots and four illegal inputs; old TS hash/red retired",
    "resources": []
  }
};

async function case_official_current_alert_types() {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { fileURLToPath } = await import('node:url');
const { createHash } = await import('node:crypto');
const require = createRequire(import.meta.url);
const loaderRoot = resolveEtsLoaderRoot();
const ts = require(`${loaderRoot}/node_modules/typescript`);
const officialChecker = require(`${loaderRoot}/lib/ets_checker.js`);
const officialDeclarations = officialChecker.readDeaclareFiles();
const officialIndex = `${loaderRoot}/declarations/index-full.d.ts`;
const officialUiContext = `${loaderRoot}/../../api/@ohos.arkui.UIContext.d.ts`;
const ownerPath = fileURLToPath(new URL('../entry/src/main/ets/app/ReaderNativeAlertOwner.ets', import.meta.url));
const copyPath = fileURLToPath(new URL('../entry/src/main/ets/app/ReaderNativeAlertButtonCopy.ts', import.meta.url));
const ownerSource = readFileSync(ownerPath, 'utf8');
const declaration = ts.createSourceFile(ownerPath, ownerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS);
const actualOptions = declaration.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'ReaderNativeAlertOptions');
assert.ok(actualOptions, 'production ETS boundary declares the native options');
assert.deepEqual(actualOptions.heritageClauses.flatMap(clause => clause.types.map(type => type.getText(declaration))), ['AlertDialogParamWithConfirm'], 'reuse the entire official native dialog declaration');
assert.deepEqual(actualOptions.members.map(member => [member.name.getText(declaration), member.type.getText(declaration), Boolean(member.questionToken)]),
  [['primaryButton', 'AlertDialogButtonBaseOptions', true], ['secondaryButton', 'AlertDialogButtonBaseOptions', true]], 'only the two original finite slots supplement the official schema');
const options = { ...officialChecker.compilerOptions, ets: { ...officialChecker.compilerOptions.ets, libs: [officialIndex] },
  target: ts.ScriptTarget.ES2021, lib: ['lib.es2021.d.ts'], module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs, strict: true, noEmit: true, skipLibCheck: true,
  allowNonTsExtensions: true, needDoArkTsLinter: true, isCompatibleVersion: false, etsLoaderPath: loaderRoot };
const validInput = "{ title: '原标题', message: '原内容', primaryButton: { value: '确认', action: (): void => {} } }";
function check(input) {
  const consumerPath = virtualFilePath('ReaderNativeAlertTypeContract.ets');
  const sourceOwner = ownerPath;
  const consumerSource = `import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderNativeAlertOwner, type ReaderNativeAlertOptions } from ${JSON.stringify(sourceOwner.replace(/\.(?:ts|ets)$/, '').replaceAll('\\', '/'))};
declare let context: UIContext;
const owner = new ReaderNativeAlertOwner();
owner.present((native: ReaderNativeAlertOptions): void => context.showAlertDialog(native), 'notice', ${input}, (): boolean => true);`;
  const virtual = new Map([[consumerPath, consumerSource], ...[]]);
  const host = ts.createCompilerHost(options), original = host.getSourceFile, exists = host.fileExists;
  host.fileExists = name => virtual.has(name) || exists(name);
  host.getSourceFile = (name, version, ...rest) => {
    const file = virtual.has(name) ? ts.createSourceFile(name, virtual.get(name), version, true, name.endsWith('.ets') ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options) : original(name, version, ...rest);
    if (file) file.version = '1';
    return file;
  };
  host.resolveModuleNames = (names, from) => names.map(name => name === '@ohos.arkui.UIContext'
    ? { resolvedFileName: officialUiContext, extension: ts.Extension.Dts, isExternalLibraryImport: true }
    : name === sourceOwner.replace(/\.(?:ts|ets)$/, '') ? { resolvedFileName: sourceOwner, extension: ts.Extension.Ets }

    : ts.resolveModuleName(name, from, options, host).resolvedModule);
  const inputs = new Set([consumerPath, sourceOwner, copyPath, ...[]]);
  const builder = ts.createSemanticDiagnosticsBuilderProgram([consumerPath, sourceOwner, copyPath, ...officialDeclarations], options, host);
  const program = builder.getProgram();
  const diagnostics = builder.getSyntacticDiagnostics().concat(builder.getSemanticDiagnostics()).filter(item => inputs.has(item.file?.fileName));
  const lint = ts.ArkTSLinter_1_1.runArkTSLinter(builder, undefined, () => {}, '1.1').filter(item => inputs.has(item.file?.fileName));
  {
    const checker = program.getTypeChecker(), consumer = program.getSourceFile(consumerPath);
    let nativeParameter; const visit = node => { if (ts.isParameter(node) && node.name.getText(consumer) === 'native') nativeParameter = node; ts.forEachChild(node, visit); }; visit(consumer);
    const nativeType = checker.getTypeAtLocation(nativeParameter.name);
    assert.equal(Boolean(nativeType.flags & ts.TypeFlags.Any), false, 'production native options resolve to official typed schema');
    const primary = nativeType.getProperty('primaryButton');
    const primaryType = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(primary, nativeParameter));
    assert.equal(Boolean(primaryType.flags & ts.TypeFlags.Any), false, 'official button schema remains typed');
    const action = primaryType.getProperty('action'), actionType = checker.getTypeOfSymbolAtLocation(action, nativeParameter);
    assert.equal(checker.getSignaturesOfType(actionType, ts.SignatureKind.Call).length, 1, 'official VoidCallback resolves');
  }
  const convert = item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, ' ') });
  return { semantic: diagnostics.map(convert), lint: lint.map(convert) };
}
assert.deepEqual(check(validInput), { semantic: [], lint: [] }, 'complete current ETS producer plus official UIContext passes strict type checker and ArkTS1.1 linter');
for (const [label, input, code] of [
  ['invalid action', validInput.replace('action: (): void => {}', 'action: 17'), 2322],
  ['unknown native field', validInput.replace('{ title:', '{ inventedNativeField: true, title:'), 2345],
  ['unknown button field', validInput.replace('{ value:', '{ inventedNativeButtonField: true, value:'), 2322],
  ['missing button name', validInput.replace("value: '确认', ", ''), 2741],
]) {
  const result = check(input);
  assert.ok(result.semantic.some(item=>item.code===code), `${label}: official schema rejects this incompatible field/callback`);
}

}

const implementations = {'official-current-alert-types':case_official_current_alert_types};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
