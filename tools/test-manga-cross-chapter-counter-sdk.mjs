import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {createDefaultReaderWindowMetrics,readerInteractiveSafeInsets} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`);
const tree=ts.createSourceFile('/tmp/MangaCrossChapterCounterProbe.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length,0);
const component=tree.statements.find(node=>node.name?.getText(tree)==='MangaReadingSurface');
const names=component.members.map(node=>node.name?.getText(tree)).filter(Boolean);
const projectionSource=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const Projection=new Function(`${stripTypeScriptTypes(projectionSource)};return MangaStripProjection`)();
const dataSourceText=tree.statements.find(node=>node.name?.getText(tree)==='MangaStripDataSource').getText(tree);
const DataSource=new Function('MangaStripProjection',`${stripTypeScriptTypes(dataSourceText)};return MangaStripDataSource`)(Projection);
const properties=createArkUIPropertyRuntimeProbe();
const boundary=new Proxy({}, {get:()=>()=>{}});
class ListScroller {getItemRect(){return {x:0,y:0};}scrollToIndex(){}scrollBy(){}}
class Scroller {currentOffset(){return {xOffset:0};}scrollTo(){}}
const {owner}=createReaderBuilderProbe(source,names,{
  ...properties.sdk,MangaStripDataSource:DataSource,ListScroller,Scroller,PhotoViewScaleModel:class {},
  ReaderWindowCoordinator:{metrics:()=>createDefaultReaderWindowMetrics()},readerInteractiveSafeInsets,
  ScrollAlign:{START:0},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},TouchType:{Down:0},
  LazyForEach:boundary,Gesture:boundary,GestureGroup:boundary,PinchGesture:boundary,SwipeGesture:boundary,
  globalThis:{Gesture:boundary,GestureGroup:boundary,PinchGesture:boundary,SwipeGesture:boundary},
  GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
},properties.hooks);
owner.horizontal=true;
owner.mounted=true;
owner.controller={chapter:undefined,totalPages:0};
owner.initialRender();
const pager=()=>[...owner.nodes.values()].find(node=>node.type==='Text'&&/^1 \/ /.test(node.create))?.create;
const button=label=>[...owner.nodes.values()].find(node=>node.type==='Button'&&node.createWithLabel===label);
assert.equal(pager(),'1 / 0','the initial pending view has no admitted page count');
assert.equal(button('下一图')?.enabled,false);
const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/second'},manifestVersion:'second-v',
  pages:[{ordinal:0,pageId:'second-p0',resourceRef:'manga:second-p0'}]};
owner.controller={chapter:{manifest,chapterTitle:'2.姐姐2'},totalPages:23,displayedOrdinal:0,
  savedLocation:null,recoveryRequired:false,pageAt:ordinal=>manifest.pages[ordinal],
  pageGeometry:()=>undefined};
owner.publish();
properties.flush();
assert.equal(pager(),'1 / 23','admitted second-chapter page count must update without turning page zero');
assert.equal(button('下一图')?.enabled,true,'the next-image control follows the admitted count');
console.log('PASS actual SDK lowered manga counter and button react to chapter admission at unchanged ordinal zero');
