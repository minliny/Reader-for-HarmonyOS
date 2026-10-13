import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const host=path.resolve(here,'../../..');
const workspace=path.dirname(host);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const {readNativeCaptureRegistry}=await import(pathToFileURL(path.join(host,'evidence/2026-10-06-native-ui-redo/registry.mjs')).href);
const nativeRegistry=readNativeCaptureRegistry();
const captures={};
for(const session of ['2026-10-05-native-ui-reset','2026-10-06-native-ui-redo']){
  const dir=path.join(host,'evidence',session,'captures');
  let names=[];try{names=await readdir(dir);}catch{continue;}
  for(const name of names.filter(n=>n.endsWith('.png')).sort()){
    const id=name.slice(0,-4),pngPath=path.join(dir,name),bytes=await readFile(pngPath);
    let tree=null;try{tree=JSON.parse(await readFile(path.join(dir,`${id}.json`),'utf8'));}catch{}
    const bundles=new Set(),texts=new Set();
    function visit(node){const a=node?.attributes;if(a){if(a.bundleName)bundles.add(a.bundleName);if(a.text&&a.visible!=='false'&&a.opacity!=='0.000000')texts.add(a.text);}for(const child of node?.children||[])visit(child);}
    if(tree)visit(tree);
    const admission=nativeRegistry.byId[id];
    captures[id]={id,png:path.relative(here,pngPath).split(path.sep).join('/'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:sha(bytes),bundle:[...bundles].find(b=>b.startsWith('io.reader.'))||null,visibleText:[...texts].slice(0,60),captureSession:session,uiTreeAvailable:!!tree,baselineAdmission:admission?.baselineAdmission===true,review:admission?.review||null,allowedState:admission?.allowedState||null,classification:admission?.classification||null,classificationStatus:admission?.classificationStatus||'pending',installedMetadata:admission?.installedMetadata||null,target:admission?.target||null,installedSourceBinding:admission?.installedSourceBinding||'OPEN',manifestBinding:admission?.manifestBinding||'OPEN'};
  }
}
const specs=[];
for(const name of ['library-spec.json','reading-spec.json','reading-preferences-spec.json','settings-spec.json']){
  try{specs.push({file:name,...JSON.parse(await readFile(path.join(here,name),'utf8'))});}catch(error){throw new Error(`${name}: ${error.message}`);}
}
let esbuild;
try{esbuild=await import('esbuild');}catch{esbuild=await import(pathToFileURL(path.join(workspace,'evidence/opensource-completion/renderer-pilot/node_modules/esbuild/lib/main.js')).href);}
const payload={schemaVersion:2,generatedAt:new Date().toISOString(),captures,specs,registry:{captureCount:nativeRegistry.captureCount,observedStateCount:nativeRegistry.observedStateCount,admittedCaptureCount:nativeRegistry.captures.filter(c=>c.baselineAdmission).length,manifestBinding:nativeRegistry.manifestBinding},scope:'native-observed-visual-redraw-with-custom-control-adjustments',finalVisualApproval:false};
await esbuild.build({entryPoints:[path.join(here,'app.mjs')],outfile:path.join(here,'app.bundle.js'),bundle:true,format:'iife',target:'es2020',minify:false,legalComments:'none',banner:{js:`window.__READER_DEMO_BUILD__=${JSON.stringify(payload)};`}});
console.log(JSON.stringify({bundler:esbuild.version,nativeCaptures:Object.keys(captures).length,admittedNativeCaptures:payload.registry.admittedCaptureCount,observedNativeStates:payload.registry.observedStateCount,bundleBytes:(await stat(path.join(here,'app.bundle.js'))).size,generatedAt:payload.generatedAt}));
