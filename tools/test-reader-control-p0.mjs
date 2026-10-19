import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'shell-motion-owners':{description:'Actual Shell AST per-owner live reduceMotion with one-disconnected-owner negatives',resources:[]},
 'reading-visibility':{description:'Actual Shell shared Scaffold pageVisible owner and minimal root opacity rule',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const { resolveEtsLoaderRoot, virtualFilePath }=await import('./lib/tool-environment.mjs');
const {default:assert}=await import('node:assert/strict');
const { readFileSync }=await import('node:fs');
const { fileURLToPath }=await import('node:url');
const { dirname, resolve }=await import('node:path');
const { createRequire }=await import('node:module');

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

// Parse the installed SDK's actual ETS call/object syntax. A file-wide count
// cannot prove that each existing reading owner receives the setting.
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const etsOptions = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const shellMotionOwners = ['ReadingExperience', 'ReaderFullDirectory', 'SourceSwitchPanel', 'MangaReadingSurface'];
function assertShellReduceMotionWiring(source) {
  const tree = ts.createSourceFile(virtualFilePath('ReaderShellMotionWiring.ets'), source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, etsOptions);
  assert.equal(tree.parseDiagnostics.length, 0, 'ReaderShell production ETS parses');
  const owners = new Map(shellMotionOwners.map(name => [name, []]));
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && owners.has(node.expression.text)) {
      owners.get(node.expression.text).push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const wiring = [];
  for (const [name, calls] of owners) {
    assert.equal(calls.length, 1, `${name} retains its explicit ReaderShell entry`);
    const params = calls[0].arguments[0];
    assert.ok(params && ts.isObjectLiteralExpression(params), `${name} has explicit component parameters`);
    const motion = params.properties.filter(property => ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) && property.name.text === 'reduceMotion');
    assert.equal(motion.length, 1, `${name} owns exactly one reduceMotion parameter`);
    const value = motion[0].initializer;
    assert.ok(ts.isPropertyAccessExpression(value) && value.expression.kind === ts.SyntaxKind.ThisKeyword &&
      ts.isIdentifier(value.name) && value.name.text === 'reduceMotion',
    `${name} receives the live ReaderShell reduceMotion setting`);
    wiring.push({ name, start: value.getStart(tree), end: value.getEnd() });
  }
  return wiring;
}

const shell=read('entry/src/main/ets/features/shell/ReaderShell.ets');
if(selectedCase==='shell-motion-owners'){
for (const owner of assertShellReduceMotionWiring(shell)) {
  // Keep the old global count unchanged while breaking one real owner. The
  // owner-scoped AST contract must still reject each of the four regressions.
  const disconnected = shell.slice(0, owner.start) + 'false' + shell.slice(owner.end) +
    '\nconst compensatedMotionCount = { reduceMotion: this.reduceMotion };\n';
  assert.equal((disconnected.match(/reduceMotion: this\.reduceMotion/g) ?? []).length,
    (shell.match(/reduceMotion: this\.reduceMotion/g) ?? []).length, 'negative control preserves the global count');
  assert.throws(() => assertShellReduceMotionWiring(disconnected),
    new RegExp(`${owner.name} receives the live ReaderShell reduceMotion setting`));
}

}else{
function assertReadingVisibilityDelegation(candidate, scaffold) {
  const tree = ts.createSourceFile(virtualFilePath('ReaderShellVisibility.ets'), candidate,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, etsOptions);
  assert.deepEqual(tree.parseDiagnostics, []);
  const calls=[];
  const visit=node=>{
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) &&
      ts.isIdentifier(node.expression) && node.expression.text==='ReaderPageScaffold') calls.push(node);
    ts.forEachChild(node,visit);
  };
  visit(tree); assert.equal(calls.length,1,'reading has exactly one actual shared page frame');
  const properties=calls[0].arguments[0].properties;
  const visible=properties.filter(property=>ts.isPropertyAssignment(property)&&property.name.text==='pageVisible');
  assert.equal(visible.length,1,'the page frame receives one visibility fact');
  assert.equal(visible[0].initializer.getText(tree),'this.visible','the actual reading owner supplies its current visible fact');
  assert.match(scaffold,/\.opacity\(this\.pageVisible \? 1 : 0\)/,'native shared root applies original visible/hidden opacity');
}
const scaffold=read('entry/src/main/ets/features/common/ReaderPageScaffold.ets');
assertReadingVisibilityDelegation(shell,scaffold);
const disconnectedVisibility=shell.replace('pageVisible: this.visible','pageVisible: false');
assert.notEqual(disconnectedVisibility,shell);
assert.throws(()=>assertReadingVisibilityDelegation(disconnectedVisibility,scaffold),assert.AssertionError,
  'a disconnected shared-frame fact cannot pass the old hidden-reading contract');
assert.throws(()=>assertReadingVisibilityDelegation(shell,scaffold.replace('.opacity(this.pageVisible ? 1 : 0)','.opacity(1)')),
  assert.AssertionError,'shared root cannot lose the hidden-reading opacity');


}
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
