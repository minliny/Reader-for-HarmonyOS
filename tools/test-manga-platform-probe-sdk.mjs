import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
const require=createRequire(import.meta.url);
const sdk='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`),sdkRoot=`${sdk}/../..`;
const runnerPath=new URL('../entry/src/main/ets/app/MangaPlatformProbeRunner.ts',import.meta.url).pathname;
const pagePath=new URL('../entry/src/main/ets/pages/ReaderMangaPlatformDiagnostic.ets',import.meta.url).pathname;
const runner=readFileSync(runnerPath,'utf8');
// Reader application seams are declared narrowly; ImageKit, file I/O, hash,
// ResourceManager and UIContext all resolve from the installed official SDK.
const bridge=`
type JsonObject = Record<string, Object>;
declare const DEBUG:boolean, BUILD_MODE_NAME:string;
declare const ReaderRuntimeOwner:{current():{start():Promise<void>}};
interface ReadingBodyImagePayload {fileUri:string;pixelMap:image.PixelMap|undefined;width:number;height:number;intrinsicWidth:number;intrinsicHeight:number;regionY?:number;revision:string}
declare class ReadingBodyImageHost {static instance:ReadingBodyImageHost;diagnosticState():MangaBodyDiagnosticState;attachDiagnosticObserver(observer:(value:MangaPlatformObservation)=>void):()=>void;loadBytes(bytes:Uint8Array,current:()=>boolean,position:number,preview?:boolean):Promise<ReadingBodyImagePayload>;release(uri:string,map?:image.PixelMap):void}
declare class MangaImageGraphicsHost {static instance:MangaImageGraphicsHost;attachDiagnosticObserver(observer:(value:MangaPlatformObservation)=>void):()=>void;transform(bytes:Uint8Array,plan:JsonObject,current:()=>boolean):Promise<Uint8Array>;diagnosticPending():number}
`;
const stripped=runner.replace(/^import .*?(?:@reader\/core-harmony|BuildProfile|ReaderRuntimeOwner|ReadingBodyImageHost|MangaImageGraphicsHost).*?;\n/gm,'');
const page=readFileSync(pagePath,'utf8');
const pageClass=page.slice(page.indexOf('@Component'),page.indexOf('  build() {'))
 .replace('@Component\nexport struct ReaderMangaPlatformDiagnostic {','class ReaderMangaPlatformDiagnostic { getUIContext():UIContext { throw Error(); }')
 .replaceAll('@State ','')+'\n}';
const virtualPath=runnerPath.replace('.ts','SdkDiagnosticCheck.ts');
const options={noEmit:true,skipLibCheck:true,moduleResolution:ts.ModuleResolutionKind.NodeJs,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,types:[],baseUrl:'/',paths:{'@ohos.*': [`${sdkRoot}/api/@ohos.*.d.ts`],'@kit.*': [`${sdkRoot}/kits/@kit.*.d.ts`]}};
const roots=readdirSync(`${sdk}/declarations`).filter(n=>n.endsWith('.d.ts')).map(n=>`${sdk}/declarations/${n}`);
function semantic(text){const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host);host.getSourceFile=(path,...args)=>path===virtualPath?ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true):get(path,...args);const program=ts.createProgram([virtualPath,...roots],options,host);return ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));}
const semanticSource=`import {UIContext} from '@ohos.arkui.UIContext';\nimport {hilog} from '@kit.PerformanceAnalysisKit';\n${stripped}\n${bridge}\n${pageClass}`;
assert.deepEqual(semantic(semanticSource),[],'all native pixel/readback/SDK calls must type-check');
assert.ok(semantic(semanticSource.replace('await map.readPixelsToBuffer(pixels)','await map.readPixelsToBuffer(123)')).some(x=>x.includes("not assignable")),'SDK must reject an invalid native pixel buffer');
const tree=ts.createSourceFile(pagePath,page,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const component=tree.statements.find(n=>n.name?.getText(tree)==='ReaderMangaPlatformDiagnostic');
const names=component.members.map(n=>n.name?.getText(tree)).filter(Boolean);
const runtime=createArkUIPropertyRuntimeProbe();
const {owner,output}=createReaderBuilderProbe(page,names,{...runtime.sdk,MangaPlatformProbeRunner:class{},hilog:{info(){}},ImageFit:{Contain:0}});
assert.match(output,/onComplete/);assert.match(output,/loadingStatus === 1/);assert.match(output,/reader-manga-probe-run/);
owner.mounted=true;owner.generation=2;
let settled=false;const first=owner.present({id:'frame',fileUri:'file:///fixture',width:2,height:3}).then(value=>{settled=true;return value});
owner.acknowledge('1:frame',true);await Promise.resolve();assert.equal(settled,false,'stale frame cannot acknowledge current pixels');
owner.acknowledge('2:frame',true);assert.equal(await first,true);
owner.generation=3;const pending=owner.present({id:'frame',fileUri:'file:///fixture',width:2,height:3});
let disposed=false;owner.runner={cancel(){},async dispose(){disposed=true}};await owner.release();assert.equal(await pending,false);assert.equal(disposed,true);assert.equal(owner.frames.length,0);
console.log('PASS real installed SDK ImageKit readback/native hash/file APIs and counterfactual invalid buffer, actual ArkUI lowering, unique frame acknowledgement and dispose cancellation. No native pixel result asserted by this host test.');
