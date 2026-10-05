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
declare class ReadingBodyImageHost {static instance:ReadingBodyImageHost;diagnosticState(debug?:boolean,buildMode?:string):MangaBodyDiagnosticState;attachDiagnosticObserver(observer:(value:MangaPlatformObservation)=>void,debug?:boolean,buildMode?:string):()=>void;loadBytes(bytes:Uint8Array,current:()=>boolean,position:number,preview?:boolean):Promise<ReadingBodyImagePayload>;validateBytes(bytes:Uint8Array,current:()=>boolean,position:number):Promise<void>;release(uri:string,map?:image.PixelMap):void}
declare class MangaImageGraphicsHost {static instance:MangaImageGraphicsHost;attachDiagnosticObserver(observer:(value:MangaPlatformObservation)=>void,debug?:boolean,buildMode?:string):()=>void;transform(bytes:Uint8Array,plan:JsonObject,current:()=>boolean):Promise<Uint8Array>;diagnosticPending(debug?:boolean,buildMode?:string):number}
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
const {owner,output}=createReaderBuilderProbe(page,names,{...runtime.sdk,MangaPlatformProbeRunner:class{},hilog:{info(){}},ImageFit:{Contain:0},DEBUG:true,BUILD_MODE_NAME:'debug'});
assert.match(output,/onComplete/);assert.match(output,/loadingStatus === 1/);assert.match(output,/reader-manga-probe-run/);
owner.mounted=true;owner.generation=2;
let settled=false;const first=owner.present({id:'frame',fileUri:'file:///fixture',width:2,height:3}).then(value=>{settled=true;return value});
owner.acknowledge('1:frame',true);await Promise.resolve();assert.equal(settled,false,'stale frame cannot acknowledge current pixels');
owner.acknowledge('2:frame',true);assert.equal(await first,true);
owner.generation=3;const pending=owner.present({id:'frame',fileUri:'file:///fixture',width:2,height:3});
let disposed=false;owner.runner={cancel(){},async dispose(){disposed=true}};await owner.release();assert.equal(await pending,false);assert.equal(disposed,true);assert.equal(owner.frames.length,0);
console.log('PASS real installed SDK ImageKit readback/native hash/file APIs and counterfactual invalid buffer, actual ArkUI lowering, unique frame acknowledgement and dispose cancellation. No native pixel result asserted by this host test.');

owner.passed=0;owner.failed=0;owner.receipt({caseId:'stage',phase:'large-region-start',pass:true,checkResult:false,presentationEvidence:false});assert.equal(owner.passed,0,'measurement stage marker never counts as a semantic PASS');owner.receipt({caseId:'large',phase:'large-region-end',pass:true,presentationEvidence:false});assert.equal(owner.passed,1);

const bodyFile=readFileSync(new URL('../entry/src/main/ets/app/ReadingBodyImageHost.ts',import.meta.url),'utf8');
const bodyTree=ts.createSourceFile('ReadingBodyImageHost.ts',bodyFile,ts.ScriptTarget.Latest,true);
const bodyClass=bodyTree.statements.find(n=>n.name?.getText(bodyTree)==='ReadingBodyImageHost');
const bodyMethods=['withDecodedPixelMap','assertMangaPixelBudget'].map(name=>bodyClass.members.find(n=>n.name?.getText(bodyTree)===name).getText(bodyTree)).join('\n');
const metadataTypes=['MangaImageDecodeProfile','MangaImageMetadataProof'].map(name=>bodyTree.statements.find(n=>n.name?.getText(bodyTree)===name).getText(bodyTree)).join('\n');
const bodyBudgetCheck=`${metadataTypes}
const MAX_READING_IMAGE_DIMENSION=4096,MAX_READING_IMAGE_PIXELS=4194304,MAX_MANGA_DECODE_WORKING_BYTES=4194304,MAX_MANGA_OUTPUT_BYTES=4194304;
class NativeBudgetSdk {
 private diagnosticObserver:((event:MangaPlatformObservation)=>void)|undefined;
 private async assertMangaImageMetadata(source:image.ImageSource,mime:string,bytes:Uint8Array,sha:string,current?:()=>boolean):Promise<MangaImageMetadataProof>{throw Error();}
 private async sha256(bytes:Uint8Array):Promise<string>{throw Error();}
 private boundedDecodeSize(width:number,height:number,pixels?:number,dimension?:number):image.Size{return {width,height};}
 private assertCurrent(current?:()=>boolean):void{}
 private observeDiagnostic(event:MangaPlatformObservation):void{}
 ${bodyMethods}
}`;
assert.deepEqual(semantic(semanticSource+'\n'+bodyBudgetCheck),[],'actual production crop, SDR, RGBA, metadata and row-byte API must match installed SDK');
assert.ok(semantic(semanticSource+'\n'+bodyBudgetCheck.replace('image.CropAndScaleStrategy.CROP_FIRST',"'cropFirst'" )).length>0,'invalid crop strategy is not silently accepted by SDK');
console.log('PASS actual BodyHost production region/preview allocation and PixelMap stride methods against installed SDK (including invalid enum counterfactual).');
const graphicsFile=readFileSync(new URL('../entry/src/main/ets/app/MangaImageGraphicsHost.ts',import.meta.url),'utf8')
 .replace(/^import .*?;\n/gm,'').replaceAll('MangaImageGraphicsHost','NativeGraphicsSdk');
const graphicsBridge=`type MangaPlatformObserver = (event:MangaPlatformObservation)=>void;
interface MangaGraphicsDimensions {width:number;height:number}
interface MangaImageGraphicsAdapter {inspect(bytes:Uint8Array,current:()=>boolean):Promise<MangaGraphicsDimensions>;transform(bytes:Uint8Array,value:JsonObject,current:()=>boolean):Promise<Uint8Array>}
declare function validateMangaGraphicsDimensions(width:number,height:number):MangaGraphicsDimensions;
declare function validateMangaGraphicsPlan(value:JsonObject):MangaGraphicsDimensions & {strips:{sourceY:number;targetY:number;height:number}[]};`;
assert.deepEqual(semantic(semanticSource+'\n'+graphicsBridge+'\n'+graphicsFile),[], 'actual graphics BGRA regional-read/output conversion and Native lifecycle match installed SDK');
assert.ok(semantic(semanticSource+'\n'+graphicsBridge+'\n'+graphicsFile.replace('srcPixelFormat: image.PixelMapFormat.BGRA_8888', "srcPixelFormat: 'bgra8888'")).length>0, 'SDK rejects invented source format strings');
console.log('PASS actual GraphicsHost BGRA source format and regional read API against installed SDK; Native pixels remain a separate target gate.');
