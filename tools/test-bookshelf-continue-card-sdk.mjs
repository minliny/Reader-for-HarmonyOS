import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';

const source=readFileSync(new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const builders=require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for(const name of ['sectionAction','filterRow','projectionRow'])builders.add(name);
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('NoCoverCover');
syntax.propCollection.set('NoCoverCover',new Set(['coverWidth','coverHeight']));

function mount(book) {
  const mounted=new Set(),dependencies=new Map(),selected=[];
  let activeId=-1;
  class ObservedPropertySimplePU {
    constructor(value,_owner,name){this.value=value;this.name=name;}
    get(){if(activeId>=0){const names=dependencies.get(activeId)??new Set();names.add(this.name);dependencies.set(activeId,names);}return this.value;}
    set(value){this.value=value;}
  }
  class NoCover {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const {owner,output}=createReaderBuilderProbe(source,['mangaRevision','bookshelfList','continueReadingCard',
    'continueReadingPosition','mangaReadingPosition'],{
      ShelfBookPresentation,MangaBookPresentation,ObservedPropertySimplePU,NoCoverCover:NoCover,ImageFit:{Cover:'cover'},
      ViewStackProcessor:{StartGetAccessRecordingFor(){},StopGetAccessRecording(){}},
      LazyForEach:{create(){},pop(){}},readerFloatingTabContentInset:()=>108,
      ReaderWindowCoordinator:{metrics:()=>({})},
    },{
      onObserverEnter(_owner,id){activeId=id;dependencies.delete(id);},
      onObserverExit(owner,id){
        activeId=-1;
        const node=owner.nodes.get(id);
        if(node.type==='ListItem'&&Array.isArray(node.create)&&typeof node.create[0]==='function'&&!mounted.has(id)){
          mounted.add(id);node.create[0]();
        }
      },
    });
  Object.assign(owner,{appThemeScheme:'day',continueReading:book,filterRowVisible:false,viewModeError:'',
    visibleBookCount:1,rowDataSource:{},shelfContentWidth:()=>352,isWideViewport:()=>false,
    hasCover:book=>book.coverUrl!==undefined,sectionAction(){},onBookSelected:book=>selected.push(book)});
  owner.bookshelfList(false);
  const textNodes=()=>[...owner.nodes.values()].filter(node=>node.type==='Text');
  const cardClick=[...owner.nodes.values()].find(node=>node.type==='Row'&&typeof node.onClick==='function').onClick;
  assert.equal([...owner.nodes.values()].filter(node=>typeof node.onClick==='function').length,1,
    'the card and its Reading button keep their existing shared row click action');
  assert.ok(textNodes().some(node=>node.create==='阅读'));
  assert.match(output,/this\.createStorageLink\('readerMangaPresentationRevision'/,
    'the installed SDK emits the actual shared manga revision subscription');
  return {owner,dependencies,selected,textNodes,cardClick,texts:()=>textNodes().map(node=>node.create),
    images:()=>[...owner.nodes.values()].filter(node=>node.type==='Image').map(node=>node.create)};
}
function admit(book,title='04',ordinal=2,total=24,revision=1) {
  const chapter={sourceId:book.sourceId,bookId:book.bookId,chapterId:`chapter-${title}`};
  const location={kind:'manga',chapter,manifestVersion:'manifest',pageId:`page-${ordinal}`,
    pageOrdinalFallback:ordinal,x:0,y:0,progressRevision:revision};
  assert.equal(MangaBookPresentation.admitEntry(book.sourceId,book.bookId,{
    chapter:{chapterIndex:3,chapterTitle:title,totalPages:total,
      manifest:{chapter,manifestVersion:'manifest',pages:[{pageId:location.pageId,ordinal}]}},
    progress:{location,token:{epoch:1,revision}},targetOrdinal:ordinal,
  }),true);
}
const novel={sourceId:'novel-source',bookId:'same-book',title:'小说名',author:'小说作者',
  currentChapterTitle:'第四章 云岚宗',coverUrl:'novel-cover'};
const comic={sourceId:'comic-source',bookId:'same-book',contentKind:'manga',title:'漫画名',author:'知音漫客 x 任翔',coverUrl:'comic-cover'};

{
  MangaBookPresentation.useOwner({});
  const f=mount(novel),ids=f.textNodes().map(node=>node.id),before=f.owner.observers.length;
  assert.ok(f.texts().includes('第四章 云岚宗'));f.cardClick();assert.equal(f.selected[0],novel);
  f.owner.continueReading=comic;f.owner.replay();
  assert.ok(f.texts().includes(comic.title));assert.ok(f.texts().includes(comic.author));
  assert.ok(!f.texts().includes(novel.author));assert.ok(!f.texts().includes('第四章 云岚宗'));
  assert.deepEqual(f.images(),['comic-cover']);assert.ok(f.texts().includes(''));
  assert.ok(!f.texts().includes('尚未阅读'),'missing cold position stays blank in the progressed continue card');
  f.cardClick();f.cardClick();assert.deepEqual(f.selected.slice(1),[comic,comic],
    'both card/background and its Reading button shared callback select the current comic source identity');
  const position=f.textNodes().find(node=>node.create==='');
  assert.equal(position.constraintSize.minHeight,15,'the blank position keeps its accepted row height');
  assert.ok(f.dependencies.get(position.id)?.has('mangaRevision'),
    'the real position observer reads the revision even while the initial cold position is absent');
  // Only the shared hydration revision changes. Neither the book Prop nor any
  // unrelated row is replayed; this is the cold-start display dependency.
  const currentProp=f.owner.continueReading;
  admit(comic);f.owner.mangaRevision=MangaBookPresentation.revision;
  const dependent=[...f.dependencies].filter(([_id,names])=>names.has('mangaRevision')).map(([id])=>id);
  assert.deepEqual(dependent,[position.id]);f.owner.replayOnly(dependent);
  assert.equal(position.create,'04 · 3 页 / 24 页');assert.equal(f.owner.continueReading,currentProp);
  assert.equal(f.owner.observers.length,before);assert.deepEqual(f.textNodes().map(node=>node.id),ids,
    'the same native card actors update without remounting the shelf ListItem');
  const updatedNovel={...novel,title:'新小说名',author:'新小说作者',currentChapterTitle:'第五章',coverUrl:'new-novel-cover'};
  f.owner.continueReading=updatedNovel;f.owner.replay();
  assert.ok(f.texts().includes('新小说名'));assert.ok(f.texts().includes('新小说作者'));assert.ok(f.texts().includes('第五章'));
  assert.deepEqual(f.images(),['new-novel-cover']);f.cardClick();assert.equal(f.selected.at(-1),updatedNovel);
  f.owner.continueReading=undefined;f.owner.replay();const count=f.selected.length;f.cardClick();
  assert.equal(f.selected.length,count,'a late click after removal cannot select the initial novel or comic');
  assert.ok(!f.texts().includes('新小说名'));assert.ok(!f.texts().includes('第五章'));
}
{
  MangaBookPresentation.useOwner({});
  const other={...comic,sourceId:'other-comic-source'};admit(other,'其他来源',6,12);
  const f=mount(comic);assert.ok(f.texts().includes(''),'same bookId under another source cannot supply the cold card position');
  assert.ok(!f.texts().includes('尚未阅读'));
  admit(comic);f.owner.mangaRevision=MangaBookPresentation.revision;
  const ids=[...f.dependencies].filter(([_id,names])=>names.has('mangaRevision')).map(([id])=>id);
  f.owner.replayOnly(ids);assert.ok(f.texts().includes('04 · 3 页 / 24 页'));
  assert.ok(!f.texts().includes('其他来源 · 7 页 / 12 页'));f.cardClick();assert.equal(f.selected[0],comic);
  admit(comic,'04',3,24,2);f.owner.mangaRevision=MangaBookPresentation.revision;f.owner.replayOnly(ids);
  assert.ok(f.texts().includes('04 · 4 页 / 24 页'),'same card and book receive subsequent admitted page movement');
}
console.log('PASS actual SDK retained continue card: novel/comic metadata and cover, current click identity, hydration-only StorageLink delivery, source isolation, late removal and stable actors');
