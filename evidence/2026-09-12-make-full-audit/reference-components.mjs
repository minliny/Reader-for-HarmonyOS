import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript/lib/typescript.js');
const base=path.resolve('evidence/2026-09-11-make-style-parity');
const modules=new Map();
function moduleInfo(file){
 if(modules.has(file))return modules.get(file);
 const code=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const info={file,sf,functions:new Map(),imports:new Map(),defaultName:null};modules.set(file,info);
 for(const node of sf.statements){
  if(ts.isFunctionDeclaration(node)&&node.name){info.functions.set(node.name.text,node);if(node.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword))info.defaultName=node.name.text;}
  if(ts.isImportDeclaration(node)&&node.importClause&&node.moduleSpecifier.text.startsWith('.')){
   const requested=path.resolve(path.dirname(file),node.moduleSpecifier.text);
   const resolved=[requested,requested+'.tsx',requested+'.ts',path.join(requested,'index.tsx')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
   if(resolved&&node.importClause.name)info.imports.set(node.importClause.name.text,resolved);
  }
  if(ts.isExportAssignment(node)&&ts.isIdentifier(node.expression))info.defaultName=node.expression.text;
 }
 return info;
}
function inventory(entry){
 const seen=new Map();
 function visit(file,name){
  const mod=moduleInfo(file); name=name??mod.defaultName;
  const key=file+'#'+name;if(seen.has(key))return;
  const n=mod.functions.get(name);if(!n)return;
  const row={file:path.relative(base,file),component:name,line:mod.sf.getLineAndCharacterOfPosition(n.getStart()).line+1,childComponents:[],nativeElements:{}};seen.set(key,row);
  function walk(x){
   if(ts.isJsxOpeningElement(x)||ts.isJsxSelfClosingElement(x)){
    const tag=x.tagName.getText(mod.sf);
    if(/^[A-Z]/.test(tag))row.childComponents.push(tag);else row.nativeElements[tag]=(row.nativeElements[tag]??0)+1;
   }
   ts.forEachChild(x,walk);
  }walk(n);row.childComponents=[...new Set(row.childComponents)];
  for(const child of row.childComponents){if(mod.functions.has(child))visit(file,child);else if(mod.imports.has(child)){const target=mod.imports.get(child);if(target.endsWith('.tsx'))visit(target);}}
 }visit(entry);return [...seen.values()];
}
const report={method:'TypeScript JSX component reachability from the two actual App entry points; both conditional branches included. SVG path data, CSS and helper state logic audited separately. Unreferenced imported designs are not promoted to current Make pages.',tts:inventory(path.join(base,'tts-reference/src/App.tsx')),appearance:inventory(path.join(base,'appearance-reference/src/App.tsx'))};
fs.writeFileSync('evidence/2026-09-12-make-full-audit/reference-components.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ttsReachableComponents:report.tts.length,appearanceReachableComponents:report.appearance.length,ttsFiles:[...new Set(report.tts.map(r=>r.file))],appearanceFiles:[...new Set(report.appearance.map(r=>r.file))]}));
