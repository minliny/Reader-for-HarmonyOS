import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createRequire} from 'node:module';
import { auditTypographyConsumers, auditNativeTextElements } from './reader-typography-consumer-audit.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import * as families from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

export const approvedMangaTypography = JSON.parse(readFileSync(new URL('../fixtures/design/approved-manga-typography-carriers-20261005.json', import.meta.url), 'utf8'));
export const typographyCarrierShape = node => JSON.parse(JSON.stringify({ owner: node.owner, method: node.method, kind: node.kind, text: node.text,
  modifiers: Object.fromEntries(Object.entries(node.modifiers).map(([property, value]) => [property, { expression: value.expression, extra: value.extra }])) }));
export const approvedTypographyFile = file => approvedMangaTypography.files.find(entry =>
  entry.path === (file.startsWith('entry/') ? file : 'entry/src/main/ets/' + (file.startsWith('features/') || file.startsWith('pages/') ? file : 'features/' + file)));
/** A finite user-approved existing visual contract, separate from shared roles.
 * Every concrete file/struct/method/native text carrier and all five authored
 * modifier tuples (including AUTO omissions and occurrence counts) must match.
 * This grants no directory exemption and cannot admit a new 99/anonymous slot.
 * Owner logic may evolve without silently rewriting the approved physical UI. */
export function approvedTypographyContract(source, file) {
  const entry = approvedTypographyFile(file);
  if (!entry) return { registered: false, has: () => false, count: 0 };
  const actual = auditTypographyConsumers(source, entry.path).map(typographyCarrierShape);
  assert.deepEqual(actual, entry.carriers, 'exact approved typography carrier/tuple changed: ' + entry.path);
  for (const [name, tuple] of Object.entries(entry.roles)) assert.deepEqual(JSON.parse(JSON.stringify(readerTypographyRoles[name])), tuple, 'approved public role tuple changed: ' + name);
  for (const [name, value] of Object.entries(entry.fontFamilies)) assert.equal(families[name], value, 'approved physical font binding changed: ' + name);
  const native = approvedNativeCarrierFacts(source,entry.path);
  assert.deepEqual(native,entry.nativeDefaults,'exact approved native AUTO carrier changed: '+entry.path);
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
