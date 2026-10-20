import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const baseline='d6adb8833d530e19141dc3ff506dc055dc8feec7';
const paths=['features/bookshelf/LocalImportDialog.ets','features/source/SourceSwitchWindow.ets','features/reading/SourceSwitchPanel.ets','features/reading/ReaderControlReplaceContent.ets','features/reading/ReaderTtsConfigOverlay.ets'];
const native=new Set(['Stack','Row','Column','Scroll','Text','Image','Blank','TextInput','TextArea','Button']);
const facts=paths.map(relative=>{
  const path=`entry/src/main/ets/${relative}`,source=execFileSync('git',['show',`${baseline}:${path}`],{encoding:'utf8'});
  const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(file.parseDiagnostics.length,0,path);
  const structs=file.statements.filter(node=>node.members&&node.name),nodes=[];
  const visit=node=>{if(node.expression&&ts.isIdentifier(node.expression)&&native.has(node.expression.text)){
    const text=node.getText(file);nodes.push({kind:node.expression.text,line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1,text});}
    ts.forEachChild(node,visit);};visit(file);
  return{path,sha256:createHash('sha256').update(source).digest('hex'),structs:structs.map(node=>({name:node.name.getText(file),
    members:node.members.map(member=>({name:member.name?.getText(file)??'',decorators:ts.getAllDecorators(member).map(d=>d.getText(file)),kind:ts.SyntaxKind[member.kind]}))})),nativeNodes:nodes};
});
const report={schemaVersion:1,baseline,layer:'actual installed SDK ETS AST of immutable baseline; physical rendering/target not run',facts};
if(process.argv[2]==='--write'){const dir='docs/architecture/bounded-form-baseline';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/AST_BASELINE.json`,JSON.stringify(report,null,2)+'\n');}
else if(process.argv[2]!==undefined)throw Error('usage: node tools/audit-bounded-form-families.mjs [--write]');
console.log(`PASS bounded form baseline: ${facts.length} real SDK AST files, ${facts.reduce((n,f)=>n+f.nativeNodes.length,0)} native node records at ${baseline}`);
