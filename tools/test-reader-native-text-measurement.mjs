import { localFilePath, resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const file=localFilePath(new URL('../entry/src/main/ets/features/reading/ui/ReaderNativeTextMeasurement.ets',import.meta.url));
const source=readFileSync(file,'utf8');
const sdk=resolveEtsLoaderRoot();
const ts=createRequire(import.meta.url)(`${sdk}/node_modules/typescript`);
const virtual=file.replace('.ets','SdkProbe.ts');
const options={noEmit:true,skipLibCheck:true,moduleResolution:ts.ModuleResolutionKind.NodeJs,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,types:[],baseUrl:'/',paths:{'@ohos.*':[`${sdk}/../../api/@ohos.*.d.ts`]}};
const host=ts.createCompilerHost(options),read=host.getSourceFile.bind(host);
host.getSourceFile=(path,...args)=>path===virtual?ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true):read(path,...args);
const program=ts.createProgram([virtual,...readdirSync(`${sdk}/declarations`).filter(n=>n.endsWith('.d.ts')).map(n=>`${sdk}/declarations/${n}`)],options,host);
assert.deepEqual(ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
const nodes=[],events=[];let lines=2,bodyAttributesAvailable=true;
let distributionVersion = 60100, platformApi26 = true;
const apiAvailabilityCalls = [];
const deviceInfo = {
  get distributionOSApiVersion() { return distributionVersion; },
  apiAvailable(version) { apiAvailabilityCalls.push(version); return platformApi26; },
};
const typeNode={createNode(_context,type){assert.equal(type,'Text');const node={disposed:0,props:{},initialize(content,options){events.push('initialize');this.content=content;this.controller=options.controller;},
 measure(constraint){events.push('measure');this.constraint=constraint;},layout(position){events.push('layout');this.position=position;},dispose(){this.disposed++;}};
 node.attribute={};for(const key of ['width','fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','textAlign','wordBreak','textIndent','direction'])node.attribute[key]=v=>{node.props[key]=v;return node.attribute;};
 if(bodyAttributesAvailable) for(const key of ['enableAutoSpacing','fallbackLineSpacing','compressLeadingPunctuation'])
   node.attribute[key]=v=>{node.props[key]=v;};
 Object.defineProperty(node.attribute, 'punctuationOverflow', { get() {
   assert.ok(distributionVersion >= 260000, 'lower systems must not evaluate the API 26 symbol');
   if (bodyAttributesAvailable) return value => { node.props.punctuationOverflow = value; };
   return undefined;
 } });
 nodes.push(node);return node;}};
const js=ts.transpileModule(source.replace(/^import.*$/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {Owner, geometryKey}=new Function('typeNode','WordBreak','deviceInfo',js+';return {Owner:ReaderNativeTextMeasurement,geometryKey:readerNativeTextGeometryKey};')(typeNode,{BREAK_ALL:'all'},deviceInfo);
const owner=new Owner(),controller={getLayoutManager:()=>({getLineCount:()=>{events.push('read');return lines;}})};
const style={widthVp:300,fontFamily:'selected',fontSize:20,fontWeight:400,lineHeight:30,letterSpacing:1,color:'#000',alignment:'justify',breakAll:false};
const body={...style,bookBody:true};
const mixed='「甲ABC😀e\u0301乙」';
owner.measure({vp2px:v=>v*3},mixed,controller,body);
assert.deepEqual(events,['initialize','measure','layout','read']);assert.equal(nodes[0].content,mixed);assert.equal(nodes[0].controller,controller);
assert.equal(nodes[0].constraint.maxSize.width,900);assert.equal(nodes[0].props.fontSize,20);assert.equal(nodes[0].props.lineHeight,30);
for(const property of ['enableAutoSpacing','fallbackLineSpacing','compressLeadingPunctuation'])assert.equal(nodes[0].props[property],true,property);
assert.notEqual(geometryKey(body),geometryKey(style),'an old native window cannot be retained for differently shaped prose');
owner.measure({vp2px:v=>v*3},'title',controller,{...style,breakAll:true});assert.equal(nodes[1].props.wordBreak,'all');
assert.equal(nodes[1].props.enableAutoSpacing,undefined,'chapter titles keep their existing native measurement recipe');
owner.clear();owner.clear();assert.ok(nodes.every(n=>n.disposed===1));
const transferredController={getLayoutManager:()=>({getLineCount:()=>2})};
owner.measure({vp2px:v=>v},'whole paragraph',transferredController,{...style,indentVp:12,direction:'rtl'});
const transferred=owner.take(transferredController);owner.clear();assert.equal(transferred.disposed,0);
assert.equal(transferred.props.textIndent,12);assert.equal(transferred.props.direction,'rtl');
assert.throws(()=>owner.take(transferredController),/OWNERSHIP_MISSING/);
transferred.dispose();assert.equal(transferred.disposed,1);
bodyAttributesAvailable=false;
owner.measure({vp2px:v=>v},mixed,controller,body);
assert.equal(nodes.at(-1).content,mixed,'shaping attributes absent on a native node must not block measuring the original text');
assert.equal(nodes.at(-1).props.enableAutoSpacing,undefined);
owner.clear();
bodyAttributesAvailable=true;
const hangingBody = { ...body, punctuationOverflow: true };
assert.notEqual(geometryKey(hangingBody), geometryKey(body), 'hanging changes the measured/visible geometry identity');
assert.equal(geometryKey({ ...style, punctuationOverflow: true }), geometryKey(style), 'title geometry ignores body-only shaping');
const context = { vp2px: value => value };
for (const version of [60100, 60101]) {
  distributionVersion = version;
  owner.measure(context, mixed, controller, hangingBody);
  assert.equal(nodes.at(-1).props.punctuationOverflow, undefined);
}
assert.deepEqual(apiAvailabilityCalls, []);
distributionVersion = 260000;
platformApi26 = false;
owner.measure(context, mixed, controller, hangingBody);
assert.equal(nodes.at(-1).props.punctuationOverflow, undefined);
platformApi26 = true;
owner.clear();
owner.measure(context, mixed, controller, hangingBody);
const visibleBody = owner.take(controller);
assert.equal(visibleBody.props.punctuationOverflow, true, 'the displayed paragraph retains native shaped attributes');
visibleBody.dispose();
owner.measure(context, 'title', controller, { ...style, punctuationOverflow: true });
assert.equal(nodes.at(-1).props.punctuationOverflow, undefined);
assert.equal(nodes.at(-1).props.orphanCharOptimization, undefined);
assert.deepEqual(apiAvailabilityCalls, ['26.0.0', '26.0.0']);
owner.clear();
lines=0;assert.throws(()=>owner.measure({vp2px:v=>v},'text',controller,style),/LAYOUT_UNAVAILABLE/);assert.equal(nodes.at(-1).disposed,1);
assert.throws(()=>owner.measure({vp2px:v=>v},'text',controller,{...style,widthVp:0}),/WIDTH_INVALID/);
console.log('native Text measurement: installed SDK types, synchronous native measure/layout/read, unchanged source/style/controller and exact disposal PASS; native raster qualification remains separate');
