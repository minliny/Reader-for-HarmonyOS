import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {createRequire} from 'node:module';
import { auditTypographyConsumers, auditNativeTextElements, typographyRoleImports } from './reader-typography-consumer-audit.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import * as families from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import {SOURCE_SWITCH_VISUAL_SHA256} from '../../entry/src/main/ets/features/source/SourceSwitchVisual.ts';

export const approvedMangaTypography = JSON.parse(readFileSync(new URL('../fixtures/design/approved-manga-typography-carriers-20261005.json', import.meta.url), 'utf8'));
export const novelSourceSwitchSuccessorPath = 'tools/fixtures/design/novel-source-switch-successor-20261006.json';
export const novelSourceSwitchSuccessor = JSON.parse(readFileSync(new URL('../fixtures/design/novel-source-switch-successor-20261006.json', import.meta.url), 'utf8'));
const novelPaths = ['entry/src/main/ets/features/source/SourceSwitchWindow.ets', 'entry/src/main/ets/features/source/SourceSwitchProgress.ets'];
const completionPath = 'entry/src/main/ets/features/source/SourceSwitchCompletionOverlay.ets';
assert.equal(novelSourceSwitchSuccessor.schema, 1);
assert.equal(novelSourceSwitchSuccessor.visualSpecSource, '../Reader-UI/design/source-switch/source-switch.visual.json', 'one finite independent selected source visual spec');
assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+novelSourceSwitchSuccessor.visualSpecSource,import.meta.url))).digest('hex'),
  novelSourceSwitchSuccessor.visualSpecSha256, 'selected typography witness binds current independent visual source');
assert.equal(SOURCE_SWITCH_VISUAL_SHA256,novelSourceSwitchSuccessor.visualSpecSha256,'generated native spec and exact selected witness bind the same design source');
assert.deepEqual(novelSourceSwitchSuccessor.files.map(entry => entry.path), novelPaths, 'only the two exact selected novel source actors');
assert.equal(novelSourceSwitchSuccessor.completion?.path,completionPath,'one exact selected completion view, separate from historical source actors');
assert.equal(novelSourceSwitchSuccessor.completion.carriers.length,1,'completion view has one finite toast text actor');
assert.deepEqual(Object.keys(novelSourceSwitchSuccessor.completion.roles),['TYPE_SOURCE_SWITCH_NOVEL_TOAST'],'completion view cannot admit another public role');
assert.deepEqual(novelSourceSwitchSuccessor.completion.architectureCounts,{fontSize:0,backgroundColor:1},'one exact completion background and zero private text budget');
assert.equal(novelSourceSwitchSuccessor.historicalFixture, 'tools/fixtures/design/approved-manga-typography-carriers-20261005.json');
assert.equal(createHash('sha256').update(readFileSync(new URL('../fixtures/design/approved-manga-typography-carriers-20261005.json', import.meta.url))).digest('hex'),
  novelSourceSwitchSuccessor.historicalFixtureSha256, 'historical manga typography fixture stays immutable');
/** A new selected novel actor cannot erase, edit or copy a retained manga
 * carrier. Check multiplicity as well as owner/method/tuple/AUTO identity. */
function retainsHistoricalCarriers(entry) {
  if (entry.path !== novelPaths[0]) {
    assert.equal(entry.historicalPath, undefined, 'progress actor has no historical manga exemption');
    return;
  }
  assert.equal(entry.historicalPath, novelPaths[0], 'exact historical Window successor');
  const original = approvedMangaTypography.files.find(file => file.path === entry.historicalPath);
  assert.ok(original);
  for (const field of ['carriers', 'nativeDefaults']) {
    const remaining = entry[field].map(carrier => JSON.stringify(carrier));
    for (const carrier of original[field]) {
      const index = remaining.indexOf(JSON.stringify(carrier));
      assert.ok(index >= 0, `retained historical manga ${field} missing or changed: ${entry.path}`);
      remaining.splice(index, 1);
    }
  }
}
for (const entry of novelSourceSwitchSuccessor.files) retainsHistoricalCarriers(entry);
export const typographyCarrierShape = node => JSON.parse(JSON.stringify({ owner: node.owner, method: node.method, kind: node.kind, text: node.text,
  modifiers: Object.fromEntries(Object.entries(node.modifiers).map(([property, value]) => [property, { expression: value.expression, extra: value.extra }])) }));
export const approvedTypographyFile = file => {
  const fullPath = file.startsWith('entry/') ? file : 'entry/src/main/ets/' + (file.startsWith('features/') || file.startsWith('pages/') ? file : 'features/' + file);
  return novelSourceSwitchSuccessor.files.find(entry => entry.path === fullPath) ?? (fullPath===completionPath?novelSourceSwitchSuccessor.completion:undefined) ?? approvedMangaTypography.files.find(entry => entry.path === fullPath);
};
/** A finite approved reference or selected demo contract, separate from shared roles.
 * Every concrete file/struct/method/native text carrier and all five authored
 * modifier tuples (including AUTO omissions and occurrence counts) must match.
 * This grants no directory exemption and cannot admit a new 99/anonymous slot.
 * Owner logic may evolve without silently rewriting the selected physical UI.
 * These source contracts do not establish native layout or visual acceptance. */
export function approvedTypographyContract(source, file) {
  const entry = approvedTypographyFile(file);
  if (!entry) return { registered: false, has: () => false, count: 0 };
  if (novelPaths.includes(entry.path)) retainsHistoricalCarriers(entry);
  const actual = auditTypographyConsumers(source, entry.path).map(typographyCarrierShape);
  assert.deepEqual(actual, entry.carriers, 'exact approved typography carrier/tuple changed: ' + entry.path);
  const imports = typographyRoleImports(source, entry.path);
  for (const [name, tuple] of Object.entries(entry.roles)) {
    if (novelPaths.includes(entry.path)||entry.path===completionPath) assert.ok(imports.has(name), 'actual selected novel public role import: ' + name);
    assert.deepEqual(JSON.parse(JSON.stringify(readerTypographyRoles[name])), tuple, 'approved public role tuple changed: ' + name);
  }
  for (const [name, value] of Object.entries(entry.fontFamilies)) assert.equal(families[name], value, 'approved physical font binding changed: ' + name);
  const native = approvedNativeCarrierFacts(source,entry.path);
  assert.deepEqual(native,entry.nativeDefaults,'exact approved native AUTO carrier changed: '+entry.path);
  if(entry.path===completionPath)assert.deepEqual(approvedNativeAllCarrierFacts(source,entry.path),entry.nativeActors,'exact completion text actor native attributes changed');
  const nativeKeys=new Set(entry.nativeDefaults.map(carrier=>JSON.stringify(carrier)));
  const keys = new Set(entry.carriers.map(carrier => JSON.stringify(carrier)));
  return { registered: true, entry, count: actual.length, hasNative: node=>nativeKeys.has(JSON.stringify(approvedNativeCarrierShape(node,approvedNativeOwner(source,entry.path,node.line)))), has: node => keys.has(JSON.stringify(typographyCarrierShape(node))) };
}

export const approvedNativeCarrierShape=(node,owner)=>JSON.parse(JSON.stringify({owner:owner??node.owner??'@module',method:node.method,kind:node.kind,text:node.text,inheritsTextStyle:node.inheritsTextStyle,attributes:node.attributes}));

const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
function approvedNativeOwner(source,file,line){
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const owner=tree.statements.filter(node=>ts.isStructDeclaration(node)||ts.isClassDeclaration(node)).find(node=>line>=tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1&&line<=tree.getLineAndCharacterOfPosition(node.end).line+1);
 return owner?.name?.getText(tree)??'@module';
}
export function approvedNativeCarrierFacts(source,file){return auditNativeTextElements(source,file).filter(node=>Object.keys(node.modifiers).length===0).map(node=>approvedNativeCarrierShape(node,approvedNativeOwner(source,file,node.line)));}
export function approvedNativeAllCarrierFacts(source,file){return auditNativeTextElements(source,file).map(node=>approvedNativeCarrierShape(node,approvedNativeOwner(source,file,node.line)));}
