import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"reader": {"description": "实际replaceHeader Image→两个Reader资源→canonical SVG", "resources": []}, "discover": {"description": "实际currentSourceCard Image→两个Discover资源→canonical SVG", "resources": []}, "sync": {"description": "实际scopeRow Image→两个Sync资源→canonical SVG", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {

const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {svgAssetRecipes}=await import('./svg-provenance.config.mjs');
const {renderRecipe}=await import('./sync-svg-assets.mjs');
const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');const {ts,options}=installedEtsCompiler();
const scopes={reader:{file:'reading/ReaderControlPanel.ets',method:'replaceHeader',asset:'reader_control_replace_header'},discover:{file:'discover/DiscoverPage.ets',method:'currentSourceCard',asset:'discover_source_stack'},sync:{file:'sync/SyncPage.ets',method:'scopeRow',asset:'sync_scope_chevron'}};
const scope=scopes[selectedCase];const path=new URL('../entry/src/main/ets/features/'+scope.file,import.meta.url);const source=readFileSync(path,'utf8');
function boundAssets(text) {
 const ast=ts.createSourceFile(String(path),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(ast.parseDiagnostics.length,0);
 const owner=ast.statements.find(node=>node.members?.some(member=>member.name?.getText(ast)===scope.method));assert.ok(owner,'actual owner of selected member');const member=owner.members.find(node=>node.name?.getText(ast)===scope.method);assert.ok(member,'actual selected consumer member');const names=new Set();
 const visit=node=>{if((ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&node.expression.getText(ast)==='Image') {const resources=n=>{if(ts.isStringLiteral(n)&&n.text.startsWith('app.media.'))names.add(n.text.slice('app.media.'.length));ts.forEachChild(n,resources);};node.arguments.forEach(resources);}ts.forEachChild(node,visit);};visit(member);return names;
}
const actual=boundAssets(source);for(const asset of [scope.asset,scope.asset+'_theme_night'])assert.ok(actual.has(asset),'actual Image expression binds '+asset);
const mutant=source.replaceAll('app.media.'+scope.asset,'app.media.audit_wrong_asset')+'\n// app.media.'+scope.asset;
assert.equal(boundAssets(mutant).has(scope.asset),false,'a historical asset comment cannot hide a wrong actual Image');
for(const asset of [scope.asset,scope.asset+'_theme_night']) {
 const recipe=svgAssetRecipes.find(recipe=>recipe.file===asset);assert.ok(recipe,'selected actual slot has a registered recipe');
 const expected=await renderRecipe(recipe);const packaged=readFileSync(new URL('../entry/src/main/resources/base/media/'+asset+'.svg',import.meta.url),'utf8');assert.equal(packaged,expected.content,'selected generated SVG preserves canonical source and finite adapter');
 const damaged=packaged.replace(/viewBox="[^"]+"/,'viewBox="0 0 1 1"');assert.notEqual(damaged,expected.content,'packaged geometry mutation is rejected by byte equality');
}
console.log('selected slot AST/canonical SVG binding PASS; current visual acceptance NOT_RUN');

}
