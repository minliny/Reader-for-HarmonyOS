import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
const require=createRequire(import.meta.url);
const sdk='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`);
const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),'utf8');
const tree=ts.createSourceFile('/tmp/MangaReadingSurface.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const component=tree.statements.find(node=>node.name?.getText(tree)==='MangaReadingSurface');
const names=component.members.map(node=>node.name?.getText(tree)).filter(Boolean);
const projectionSource=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const MangaStripProjection=new Function(`${stripTypeScriptTypes(projectionSource)};return MangaStripProjection`)();
const dataSource=tree.statements.find(node=>node.name?.getText(tree)==='MangaStripDataSource').getText(tree);
const MangaStripDataSource=new Function('MangaStripProjection',`${stripTypeScriptTypes(dataSource)};return MangaStripDataSource`)(MangaStripProjection);
const runtime=createArkUIPropertyRuntimeProbe();
const scrolls=[];
class ListScroller {getItemRect(){return {x:0,y:-100,width:500,height:500};}scrollToIndex(...args){scrolls.push(args);}scrollBy(...args){scrolls.push(args);}}
class Scroller {currentOffset(){return {xOffset:0};}scrollTo(){}}
class PhotoViewScaleModel {}
const {owner,output}=createReaderBuilderProbe(source,names,{...runtime.sdk,MangaStripDataSource,ListScroller,Scroller,PhotoViewScaleModel,ScrollAlign:{START:0},ImageFit:{Fill:0}});
assert.match(output,/LazyForEach/);
assert.match(output,/onScrollStop/);
owner.mounted=true;owner.opened=true;owner.viewportWidth=500;
const manifest={pages:[{ordinal:0,pageId:'a'}]};
owner.data.projection.publish(manifest,()=>({width:1000,height:4000,tileHeight:1000}));
let resolve;let saved;
owner.controller={savePosition:async(...args)=>{saved=args;await new Promise(r=>resolve=r);}};
let completed=false;const saving=owner.saveVisible().then(()=>{completed=true;});
await new Promise(r=>setImmediate(r));assert.equal(completed,false);assert.deepEqual(saved,[0,0,0.05]);
resolve();await saving;assert.equal(completed,true);
owner.restore(0,0.75);owner.aboutToDisappear=()=>{owner.mounted=false;owner.layoutGeneration++;};owner.aboutToDisappear();
await new Promise(r=>setTimeout(r,5));assert.equal(scrolls.length,0);
console.log('PASS actual ArkUI SDK surface lowering; save waits for CAS; disposed layout cannot scroll (native paint not tested)');
