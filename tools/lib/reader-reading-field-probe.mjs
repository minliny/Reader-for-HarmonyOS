import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {createRequire}from'node:module';
import {readerControlUnit}from'../../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
const { ts, options } = installedEtsCompiler();
function declaration(file,name){const source=readFileSync(new URL('../../entry/src/main/ets/features/reading/'+file,import.meta.url),'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(tree.parseDiagnostics.length,0);const node=tree.statements.find(n=>n.name?.text===name);assert.ok(node,name+': actual production declaration');return ts.transpileModule(node.getText(tree).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;}
// Thin compilation adapter for actual finite endpoint/model code. It does
// not implement state, admission or draft algorithms in the test fixture.
export const readerControlReplaceEndpoint=new Function('readerControlUnit',declaration('ReaderControlReplaceGeometry.ts','readerControlReplaceEndpoint')+';return readerControlReplaceEndpoint;')(readerControlUnit);
export const DirectoryRuleDraft=new Function(declaration('ReaderDirectoryRules.ets','DirectoryRuleDraft')+';return DirectoryRuleDraft;')();
