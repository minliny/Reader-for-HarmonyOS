import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "current-sdk-actions": {
    "description": "Actual SDK live/removed/disabled/retired actions on current finite variants; no prescribed registry AST shape",
    "resources": []
  },
  "arkts-registry-compatibility": {
    "description": "Installed official SDK formal semantic/lint check for selected current production action spec and legal branch/order variants",
    "resources": []
  }
};

async function case_current_sdk_actions() {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { createHash } = await import('node:crypto');
const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const source = read('features/common/ReaderActionSheetContent.ets');
class NativeColorFilter {
  constructor(matrix) { assert.equal(matrix.length,20);this.matrix=[...matrix]; }
}
const nativeColorMetrics={resourceColor(value){
  assert.match(value,/^#[\dA-F]{8}$/i);
  return {alpha:parseInt(value.slice(1,3),16),red:parseInt(value.slice(3,5),16),
    green:parseInt(value.slice(5,7),16),blue:parseInt(value.slice(7,9),16)};
}};
const iconPlatform={ColorMetrics:nativeColorMetrics,ColorFilter:NativeColorFilter};
const applyMatrix=(matrix,rgba)=>Array.from({length:4},(_,row)=>
  rgba.reduce((value,channel,index)=>value+matrix[row*5+index]*channel,matrix[row*5+4]));
const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
const actions = [
  new sdk.deps.ReaderActionSheetAction('source', '更换书源', '阅读', '', '', true, undefined, 'default', true),
  new sdk.deps.ReaderActionSheetAction('refresh', '重新打开本话', '阅读'),
  new sdk.deps.ReaderActionSheetAction('detail', '漫画详情', '阅读', '', '', true, undefined, 'default', true),
  new sdk.deps.ReaderActionSheetAction('download', '下载本话', '下载'),
  new sdk.deps.ReaderActionSheetAction('manager', '下载管理', '下载', '', '', true, undefined, 'default', true),
  new sdk.deps.ReaderActionSheetAction('remove', '移出书架', '书架', '退出阅读，前往详情确认', '', true, undefined, 'danger'),
];

for (const variant of ['grouped', 'quick']) {
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  const calls = [];
  const owner = sdk.consumer(source, boundedMembers(source), {}, { variant, actions,
    onAction: id => calls.push(id) });
  owner.initialRender();
  const renderer = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderActionMenuSurface);
  assert.ok(renderer, `${variant}: compatibility facade constructs the existing action renderer`);
  const nodes = sdk.walk(owner).flatMap(child => [...child.nodes.values()]);
  const text = nodes.filter(node => node.type === 'Text').map(node => node.create);
  for (const label of ['更换书源', '重新打开本话', '漫画详情', '下载本话', '下载管理', '移出书架']) {
    assert.ok(text.includes(label), `${variant}: renders ${label}`);
  }
  assert.equal(nodes.filter(node => node.onClick).length, actions.length, `${variant}: one touch target per action`);
  assert.ok(nodes.some(node => node.type === 'Text' && node.create === '移出书架' &&
    node.fontColor === sdk.deps.readerAppColor('TOK_DOWNLOAD_DANGER', 'day')), `${variant}: actual danger label uses the theme role`);
  assert.equal(nodes.filter(node => node.type === 'Image' && String(node.create).includes('reader_chevron_right')).length,
    actions.filter(action=>action.showChevron).length, `${variant}: current action navigation flags determine arrows`);
  const spec=sdk.deps.resolveActionSheetSpec(variant);
  assert.ok(nodes.filter(node=>node.type==='Text').every(node=>[spec.regularFontFamily,spec.labelFontFamily].includes(node.fontFamily)),`${variant}: actual text consumes current finite production typography roles`);
  const buttons = nodes.filter(node => node.onClick);
  buttons[variant === 'quick' ? buttons.length - 1 : 0].onClick();
  assert.equal(calls.length, 1);
  const oldRefresh = buttons.find(node => node.accessibilityText === '重新打开本话');
  assert.ok(oldRefresh);
  const oldClick = oldRefresh.onClick;
  owner.updateStateVars({ variant, scheme: 'auto', actions: actions.map(item => item.id === 'refresh' ?
    new sdk.deps.ReaderActionSheetAction('refresh', '重新打开本卷', '阅读', '离线时不可用', '', false) : item) });
  sdk.properties.flush();
  assert.ok(sdk.nodes(owner).some(node => node.type === 'Text' && node.create === '重新打开本卷'),
    `${variant}: retained ID renders the live label`);
  assert.ok(sdk.nodes(owner).some(node => node.type === 'Text' && node.create === '离线时不可用'),
    `${variant}: a new state explanation renders on a retained ID`);
  assert.equal(oldRefresh.enabled, false, `${variant}: retained touch target consumes live admission`);
  oldClick(); assert.equal(calls.length, 1, `${variant}: old enabled callback cannot bypass current admission`);
  owner.updateStateVars({ variant, scheme: 'auto', actions: actions.filter(item => item.id !== 'refresh') });
  // The SDK closure probe deliberately does not model native subtree removal.
  // Check dispatch against current data without claiming removed-node layout.
  oldClick();
  assert.equal(calls.length, 1, `${variant}: removed action cannot dispatch through its retained callback`);
  renderer.aboutToDisappear(); buttons[0].onClick();
  assert.equal(calls.length, 1, `${variant}: retired component refuses action dispatch`);
}


}

async function case_arkts_registry_compatibility() {
const { default: assert } = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const {resolveEtsLoaderRoot,virtualFilePath} = await import('./lib/tool-environment.mjs');
const root=resolveEtsLoaderRoot(),req=createRequire(import.meta.url),ts=req(root+'/node_modules/typescript'),checker=req(root+'/lib/ets_checker.js');
const path=virtualFilePath('ActionSheetRegistryCompatibility.ets');
const options={...checker.compilerOptions,target:ts.ScriptTarget.ES2021,lib:['lib.es2021.d.ts'],module:ts.ModuleKind.CommonJS,strict:true,noEmit:true,skipLibCheck:true,allowNonTsExtensions:true,needDoArkTsLinter:true,isCompatibleVersion:false,etsLoaderPath:root};
function check(text){const host=ts.createCompilerHost(options),original=host.getSourceFile,exists=host.fileExists;
 host.fileExists=p=>p===path||exists(p);host.getSourceFile=(p,v,...r)=>{const f=p===path?ts.createSourceFile(p,text,v,true,ts.ScriptKind.ETS,options):original(p,v,...r);if(f)f.version='1';return f;};
 const builder=ts.createSemanticDiagnosticsBuilderProgram([path],options,host);
 const diagnostics=[...builder.getSyntacticDiagnostics(),...builder.getSemanticDiagnostics(),...ts.ArkTSLinter_1_1.runArkTSLinter(builder,undefined,()=>{},'1.1')].filter(d=>d.file?.fileName===path);
 return diagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
}
const raw=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets',import.meta.url),'utf8');
const tree=ts.createSourceFile(path,raw,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const names=new Set(['ActionSheetSpecId','ActionSheetSurfaceSpec','ActionSheetSpecs','ACTION_SHEET_SPECS','ACTION_SHEET_SPEC','resolveActionSheetSpec']);
const selected=tree.statements.filter(node=>names.has(node.name?.getText(tree))||(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>names.has(d.name.getText(tree))))).map(n=>n.getText(tree).replace(/^export /,''));
assert.ok(selected.some(text=>text.includes('function resolveActionSheetSpec')),'actual production resolver selected');
const visualRaw=readFileSync(new URL('../entry/src/main/ets/features/source/SourceSwitchVisual.ts',import.meta.url),'utf8');
const visualTree=ts.createSourceFile(path,visualRaw,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,options);
const visual=visualTree.statements.filter(node=>node.name?.getText(visualTree)==='SourceSwitchVisualSpec'||(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(visualTree)==='SOURCE_SWITCH_VISUAL'))).map(n=>n.getText(visualTree).replace(/^export /,'')).join('\n');
const source="type ReaderAppColorRole = string;\n"+visual+'\n'+selected.join('\n');
assert.deepEqual(check(source),[],'current production action spec/resolver passes installed formal SDK compiler and ArkTS lint without a prescribed branch shape');
const positive='class Entry { value: number = 1; } interface Entries { quick: Entry; grouped: Entry; } const entries: Entries = {grouped:new Entry(),quick:new Entry()}; function select(id:string):Entry { if(id === "quick") return entries.quick; return entries.grouped; }';
assert.deepEqual(check(positive),[],'equivalent if-selector and member order remain legal');
assert.ok(check(positive.replace('value: number = 1','value: number = "wrong"')).length>0,'official compiler rejects a real incompatible typed field');

}

const implementations = {'current-sdk-actions':case_current_sdk_actions,'arkts-registry-compatibility':case_arkts_registry_compatibility};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
