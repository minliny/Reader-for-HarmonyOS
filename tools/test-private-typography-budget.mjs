import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
import { countPrivateTypographyCalls } from './lib/architecture-private-typography-count.mjs';
import { isSharedTypographyExpression, typographyExpressionContext } from './lib/reader-typography-consumer-audit.mjs';
// The full CLI now requires the immutable whole-app registry and producer
// contracts. Exercise its exact carrier counter here; whole-app registration,
// imports and producer mutation negatives have their actual-source gates.
const file = 'entry/src/main/ets/features/probe/Probe.ets';
const run = expression => ({ status: countPrivateTypographyCalls(
  `@Component struct Probe { build() { Column() { Text('probe').fontSize(${expression}); } } }`, file) > 0 ? 1 : 0 });
  assert.equal(run('TYPE_FORM_ACTION.fontSizeFp').status, 0, 'real public consumer does not raise the old private budget');
  assert.notEqual(run('13').status, 0, 'direct private size rejected at unchanged zero budget');
  assert.notEqual(run('this.selected ? TYPE_FORM_ACTION.fontSizeFp : 13').status, 0, 'a TYPE substring cannot hide a private branch');
  assert.notEqual(run('TYPE_FORM_ACTION.fontSizeFp + 2').status, 0, 'private numeric role override rejected');
  assert.notEqual(run("'TYPE_FORM_ACTION.fontSizeFp'").status, 0, 'a string/comment is not a public role expression');
  assert.equal(run('this.selected ? TYPE_FORM_ACTION.fontSizeFp : TYPE_FORM_LABEL_ACTION.fontSizeFp').status, 0, 'bounded public variants accepted');
  assert.equal(isSharedTypographyExpression('TYPE_SHELF_COVER_PLACEHOLDER.fontSizeFp * this.coverWidth / 96.96'), true);
assert.equal(countPrivateTypographyCalls("// Text('comment').fontSize(13);\n@Component struct Probe { build() { Column() {} } }",file),0,'ETS comments do not become production consumers');
const fake = "@Component struct Probe { private spec() { return { fontSizeFp: 99 }; } build() { Text('bad').fontSize(this.spec().fontSizeFp); } }";
assert.equal(isSharedTypographyExpression('this.spec().fontSizeFp'),false,'a helper name alone carries no shared proof');
assert.equal(countPrivateTypographyCalls(fake,file),1,'synthetic private spec 99 remains debt');
assert.equal(countPrivateTypographyCalls(fake,'entry/src/main/ets/features/common/ReaderDialogSurface.ets'),1,'producer filename cannot admit another owner');
const common='entry/src/main/ets/features/common/';
for(const name of ['ReaderActionMenuSurface','ReaderChoiceRow','ReaderDialogSurface','ReaderSearchField','ReaderSheetActionList']){
  const actualFile=common+name+'.ets',source=readFileSync(new URL('../'+actualFile,import.meta.url),'utf8');
  assert.equal(countPrivateTypographyCalls(source,actualFile),0,name+': current genuine finite getter remains admitted');
  const getter=name==='ReaderChoiceRow'?'spec':name==='ReaderSearchField'?'textStyle':name==='ReaderSheetActionList'?'surfaceSpec':'spec';
  const expression=name==='ReaderSearchField'?'this.textStyle().fontSizeFp':name==='ReaderChoiceRow'?'this.textStyle().fontSizeFp':name==='ReaderDialogSurface'?'this.spec().headerFontSize':name==='ReaderSheetActionList'?'this.surfaceSpec().actionLabelFontSize':'this.spec().actionFontSize';
  const context=typographyExpressionContext(source,actualFile);
  assert.equal(isSharedTypographyExpression(expression,context,name),true,name+': genuine imported producer binding');
  const tree=ts.createSourceFile(actualFile,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const method=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text===name).members.find(n=>ts.isMethodDeclaration(n)&&n.name.text===getter);
  const changed=source.slice(0,method.body.getStart(tree))+"{ return { fontSizeFp: 99 }; }"+source.slice(method.body.end);
  assert.notEqual(changed,source,name+': producer getter mutation actually applied');
  assert.ok(countPrivateTypographyCalls(changed,actualFile)>0,name+': same owner/helper returning private99 rejected');
  const wrongImport=source.replace("'./ReaderSurfaceSpecs'","'./PrivateSurfaceSpecs'").replace("'./ReaderChoiceSpecs'","'./PrivateChoiceSpecs'").replace("'./ReaderTypography'","'./PrivateTypography'");
  assert.ok(countPrivateTypographyCalls(wrongImport,actualFile)>0,name+': imported name from private module is not shared');
}
console.log('PASS private Typography budget: real public variants admitted; literals/mixed branches/string tricks/numeric overrides rejected; geometry/comments precise');
