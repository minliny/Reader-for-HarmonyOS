import { localFilePath, resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync,readdirSync } from 'node:fs';
const require=createRequire(import.meta.url);
const sdk=resolveEtsLoaderRoot();
const ts=require(`${sdk}/node_modules/typescript`),root=`${sdk}/../..`;
const diskPath=localFilePath(new URL('../entry/src/main/ets/app/ReadingImageDiskCache.ts',import.meta.url));
const displayPath=localFilePath(new URL('../entry/src/main/ets/app/MangaDisplayRetention.ts',import.meta.url));
const disk=readFileSync(diskPath,'utf8').replace(/import \{\s*assertReadingOfflineWriteCapacity,[^]*?from '\.\.\/features\/reading\/ReadingOfflineContract';/,
  `declare function assertReadingOfflineWriteCapacity(free:number,bytes:number,reserve:number):void;
declare class ReadingOfflineMaterializationError extends Error { constructor(kind:string,message:string); }
`);
const display=readFileSync(displayPath,'utf8').replace("import type { ReadingBodyImagePayload } from './ReadingBodyImageHost';",
  `interface ReadingBodyImagePayload { fileUri:string; pixelMap:object|undefined; width:number; height:number;
    intrinsicWidth:number; intrinsicHeight:number; regionY?:number; revision:string; }`);
const options={noEmit:true,skipLibCheck:true,moduleResolution:ts.ModuleResolutionKind.NodeJs,target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.ESNext,types:[],baseUrl:'/',paths:{'@ohos.*': [`${root}/api/@ohos.*.d.ts`]}};
const declarations=readdirSync(`${sdk}/declarations`).filter(name=>name.endsWith('.d.ts')).map(name=>`${sdk}/declarations/${name}`);
function errors(mutate=false) {
  const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host);
  host.getSourceFile=(path,...args)=>path===diskPath?ts.createSourceFile(path,mutate?disk.replace('await fileIo.stat(path)','await fileIo.stat(true)'):disk,ts.ScriptTarget.Latest,true):
    path===displayPath?ts.createSourceFile(path,display,ts.ScriptTarget.Latest,true):get(path,...args);
  return ts.getPreEmitDiagnostics(ts.createProgram([diskPath,displayPath,...declarations],options,host))
    .filter(value=>value.category===ts.DiagnosticCategory.Error).map(value=>ts.flattenDiagnosticMessageText(value.messageText,'\n'));
}
assert.deepEqual(errors(),[],'complete production disk/display classes type-check against actual SDK file/stat/LRU/hash declarations');
assert.ok(errors(true).some(value=>value.includes('not assignable')),'official SDK rejects an invalid file stat descriptor');
console.log('PASS complete production storage/display classes and actual TS worker port against installed SDK; invalid fs.stat argument is rejected. Reader-only error/body seams declared; no HAP/native execution claim.');
