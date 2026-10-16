import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const sdk=resolveEtsLoaderRoot();
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
import { registeredProducerTypographySlots } from './lib/architecture-shared-producer-contract.mjs';
import { auditTypographyConsumers } from './lib/reader-typography-consumer-audit.mjs';
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
const producerContract=JSON.parse(readFileSync(new URL('./fixtures/architecture-shared-producers.json',import.meta.url),'utf8'));
// The genuine Choice Modifier is governed by the same exact producer contract
// used by the full gate, not by helper-name or raw call-count exceptions.
function currentPrivateCount(source,file){
 if(!file.endsWith('/ReaderChoiceRow.ets'))return countPrivateTypographyCalls(source,file);
 const slots=registeredProducerTypographySlots(source,file,producerContract),context=typographyExpressionContext(source,file);
 return auditTypographyConsumers(source,file).filter(n=>n.modifiers.fontSize&&
   !isSharedTypographyExpression(n.modifiers.fontSize.expression,context,n.owner)&&
   !slots.has(n.method,'fontSize',n.modifiers.fontSize.expression)).length;
}
function rejectsPrivate(source,file){try{return currentPrivateCount(source,file)>0;}catch(error){assert.match(error.message,/finite shared physical inputs\/role bindings changed/);return true;}}
const common='entry/src/main/ets/features/common/';
for(const name of ['ReaderActionMenuSurface','ReaderChoiceRow','ReaderDialogSurface','ReaderSearchField']){
  const actualFile=common+name+'.ets',source=readFileSync(new URL('../'+actualFile,import.meta.url),'utf8');
  assert.equal(currentPrivateCount(source,actualFile),0,name+': current genuine finite getter remains admitted');
  const getter=name==='ReaderSearchField'?'textStyle':'spec';
  const expression=name==='ReaderSearchField'?'this.textStyle().fontSizeFp':name==='ReaderChoiceRow'?'this.textStyle().fontSizeFp':name==='ReaderDialogSurface'?'this.spec().headerFontSize':name==='ReaderActionSheetContent'?'this.spec().labelFontSize':'this.spec().actionFontSize';
  const context=typographyExpressionContext(source,actualFile);
  assert.equal(isSharedTypographyExpression(expression,context,name),true,name+': genuine imported producer binding');
  const tree=ts.createSourceFile(actualFile,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const method=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text===name).members.find(n=>ts.isMethodDeclaration(n)&&n.name.text===getter);
  const changed=source.slice(0,method.body.getStart(tree))+"{ return { fontSizeFp: 99 }; }"+source.slice(method.body.end);
  assert.notEqual(changed,source,name+': producer getter mutation actually applied');
  assert.ok(rejectsPrivate(changed,actualFile),name+': same owner/helper returning private99 rejected');
  const wrongImport=source.replace("'./ReaderSurfaceSpecs'","'./PrivateSurfaceSpecs'").replace("'./ReaderChoiceSpecs'","'./PrivateChoiceSpecs'").replace("'./ReaderTypography'","'./PrivateTypography'");
  assert.ok(rejectsPrivate(wrongImport,actualFile),name+': imported name from private module is not shared');
}
const compatibilityFile=common+'ReaderActionSheetContent.ets',compatibilitySource=readFileSync(new URL('../'+compatibilityFile,import.meta.url),'utf8');
assert.equal(auditTypographyConsumers(compatibilitySource,compatibilityFile).length,0,'compatibility action-sheet facade owns zero text tuples');
const privateFacade=compatibilitySource.replace('build() {',"build() { Text('private').fontSize(this.spec().labelFontSize);");
assert.notEqual(privateFacade,compatibilitySource);assert.ok(rejectsPrivate(privateFacade,compatibilityFile),'retired content getter cannot regain admission through the facade');
const menuFile=common+'ReaderActionMenuSurface.ets',menuSource=readFileSync(new URL('../'+menuFile,import.meta.url),'utf8');
assert.equal(isSharedTypographyExpression('this.actionSheetSpec().labelFontSize',typographyExpressionContext(menuSource,menuFile),'ReaderActionMenuSurface'),true,'existing menu family binds its second finite sheet resolver');
assert.ok(rejectsPrivate(menuSource.replace("resolveActionSheetSpec(this.variant === 'quick' ? 'quick' : 'grouped')",'{ labelFontSize: 99 }'),menuFile),'same secondary getter cannot return a private typography bag');
const actionOwnerFile=common+'ReaderSheetActionList.ets',actionOwnerSource=readFileSync(new URL('../'+actionOwnerFile,import.meta.url),'utf8');
assert.equal(auditTypographyConsumers(actionOwnerSource,actionOwnerFile).length,0,'bookshelf presentation owner delegates all text to the shared content producer');
const retiredOwnerText=actionOwnerSource.replace('Stack({ alignContent: Alignment.TopStart }) {',"Stack({ alignContent: Alignment.TopStart }) { Text('private').fontSize(this.surfaceSpec().actionLabelFontSize);");
assert.notEqual(retiredOwnerText,actionOwnerSource);
assert.ok(rejectsPrivate(retiredOwnerText,actionOwnerFile),'retired bookshelf typography getter cannot regain admission after delegation');
// Direct modifier injection must be rejected even though the struct's old getter is untouched.
const choiceFile=common+'ReaderChoiceRow.ets',choiceSource=readFileSync(new URL('../'+choiceFile,import.meta.url),'utf8');
assert.ok(rejectsPrivate(choiceSource.replace('instance.fontSize(text.fontSizeFp);','instance.fontSize(99);'),choiceFile),'same call count cannot hide a private Modifier literal');
console.log('PASS private Typography budget: real public variants admitted; literals/mixed branches/string tricks/numeric overrides rejected; geometry/comments precise');
