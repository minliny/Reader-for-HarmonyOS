import assert from 'node:assert/strict';
import { ReaderParagraphLayoutOwner } from '../entry/src/main/ets/features/reading/ReaderParagraphLayoutOwner.ts';
import { ReaderPhysicalPaginationOwner } from '../entry/src/main/ets/features/reading/ReaderPhysicalPaginationOwner.ts';
import { ReadingPaginationPrefix } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReadingSurfaceLayoutMap } from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';

// Whole native paragraph context survives restored anchors, bounds and a giant
// paragraph. Cursor belongs to the production owner, not a UI-side shadow copy.
{
  const text='甲😀 العربية e\u0301 אבג\n'+'整段'.repeat(10000);
  const split=text.indexOf('\n')+1;
  const ranges=[{id:'a',startUtf16:0,endUtf16:split,startScalar:0,endScalar:split-1},
    {id:'b',startUtf16:split,endUtf16:text.length,startScalar:split-1,endScalar:text.length-1}];
  const owner=new ReaderParagraphLayoutOwner();owner.firstRangeStartScalar=2;let clears=0;
  const factory=(range,index,original,request)=>({index,original,request,paragraphStart:range.startScalar});
  assert.equal(owner.prepareBatch(text,ranges,8,100,()=>clears++,factory),true);
  assert.equal(owner.batch.length,1);assert.equal(owner.batch[0].original,text.substring(0,split));
  assert.equal(owner.batch[0].request,2);assert.equal(owner.batch[0].paragraphStart,0);
  assert.equal(owner.nextRangeIndex,1);
  assert.equal(owner.prepareBatch(text,ranges,8,100,()=>clears++,factory),true);
  assert.equal(owner.batch[0].original,text.substring(split),'giant semantic paragraph is never byte-sliced');
  assert.equal(owner.prepareBatch(text,ranges,8,100,()=>clears++,factory),false);
  assert.equal(clears,3,'every batch retires the previous temporary native measurement');
  assert.equal(owner.previousRangeIndex(ranges,ranges[1].startScalar),0,
    'an exact reverse boundary excludes the later paragraph');
  const previous=owner.preparePrevious(text,ranges,1,()=>clears++,factory);
  assert.equal(previous,0);assert.equal(owner.batch.length,1);
  assert.equal(owner.batch[0].original,text.substring(split),'reverse giant paragraph retains whole shaping context');
  assert.equal(owner.batch[0].request,ranges[1].startScalar);
  assert.equal(owner.preparePrevious(text,ranges,-1,()=>clears++,factory),undefined);
  assert.equal(clears,4,'an exhausted reverse range cannot dispose an active batch');
}

const key={sourceId:'local',bookId:'layout-owner',chapterIndex:0,layoutSignature:'existing-native',contentVersion:'v1'};
const page=(start,end)=>({startScalar:start,endScalar:end,paginationKey:undefined,paginationObservation:undefined});
const input=(request,draft,extra={})=>({key,requestedAnchor:request,chapterStartRequest:0,draft,
  previousChapterMeasurement:false,lastVisibleScalar:9,contentScalarLength:10,partialDocument:false,...extra});
{
  const owner=new ReaderPhysicalPaginationOwner(),first=page(0,4),last=page(4,10);
  let result=owner.observe(first,input(0,undefined));
  assert.equal(result.completed,false);assert.equal(owner.index.has(key),false);
  result=owner.observe(last,input(4,result.draft));assert.equal(result.completed,true);
  assert.equal(result.draft,undefined);assert.equal(owner.index.findLastPage(key).startScalar,4);
  assert.equal(first.paginationObservation.requestScalar,0);
  assert.throws(()=>owner.observe(first,input(1,undefined)),/PAGINATION_PAGE_OBSERVATION_CHANGED/,
    'a retained page cannot silently change its original scalar intent');
  const suffix=new ReaderPhysicalPaginationOwner();suffix.observe(page(4,10),input(4,undefined));
  assert.equal(suffix.index.has(key),false,'EOF of a suffix cannot claim an unmeasured chapter head');
  const partial=new ReaderPhysicalPaginationOwner();partial.observe(page(0,10),input(0,undefined,{partialDocument:true}));
  assert.equal(partial.index.has(key),false,'a resident slice is never a complete canonical manifest');
  const draft=new ReadingPaginationPrefix(key,{requestScalar:0,startScalar:0,endScalarExclusive:4});
  assert.throws(()=>owner.observe(page(6,10),input(6,draft,{previousChapterMeasurement:true})),
    /PAGINATION_PREVIOUS_PAGE_NOT_ADJACENT/,'reverse discovery must preserve exact adjacency');
  owner.fragments=[{}];owner.height=8;assert.equal(owner.canFit(2,0,10),true);assert.equal(owner.canFit(2,1,10),false);
  owner.resetPage();assert.equal(owner.canFit(20,0,10),true,'first admitted native line retains existing overflow behavior');
}
{
  const owner=new ReaderPhysicalPaginationOwner();
  assert.equal(owner.canAppend(20,true,3,10),true,'a first line larger than the viewport is still admitted');
  owner.appendFragment('a',0,4,7,true,3);
  owner.appendFragment('continued',4,8,2,false,3);
  assert.equal(owner.height,9,'continued native lines do not add paragraph spacing');
  assert.equal(owner.canAppend(1,true,3,12),false,'a new paragraph includes its spacing before fit');
  owner.appendFragment('next',8,10,1,true,3);
  assert.deepEqual([owner.startScalar,owner.endScalar,owner.height],[0,10,13]);
  owner.resetPage();owner.endScalar=20;
  assert.equal(owner.canPrepend(20,3,10),true,'a first reverse line retains overflow admission');
  assert.equal(owner.canPrepend(20,3,10,true),false,'selected provisional native lines count before resource transfer');
  owner.prependFragments(['tail'],15,5,3);owner.prependFragments(['head','continued'],10,4,3);
  assert.deepEqual(owner.fragments,['head','continued','tail']);
  assert.deepEqual([owner.startScalar,owner.endScalar,owner.height],[10,20,12],
    'reverse packing changes the start and height while preserving its observed end');
}

// Actual SDK-parsed LRE delegates both producers to the real owner classes.
class Paragraph {constructor(...values){this.values=values;}}
const file=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const Owner=productionMotionMethods(file,['prepareNextMeasurementBatch','observeMeasuredPhysicalPage'],{
  MeasurementParagraph:Paragraph,ReadingSurfaceLayoutMap,TextController:class {},
  MAX_MEASUREMENT_BATCH_PARAGRAPHS:8,MAX_MEASUREMENT_BATCH_UTF16:12288});
{
  const owner=new Owner(),content='原文😀',ranges=[{id:'p',startUtf16:0,endUtf16:content.length,startScalar:0,endScalar:4}];
  Object.assign(owner,{requireMeasurementChapter:()=>({content}),requireMeasurementLayoutMap:()=>new ReadingSurfaceLayoutMap(content),
    measuringRanges:()=>ranges,measuringRequestedAnchor:()=>0,measuringDraft(){return this.physicalPagination.draft;},
    setMeasuringDraft(v){this.physicalPagination.draft=v;},setMeasuringRequestedAnchor(v){this.physicalPagination.requestedAnchor=v;},
    measurementPaginationKey:()=>key,lastVisibleScalar:()=>3});
  assert.equal(owner.prepareNextMeasurementBatch(),true);assert.equal(owner.paragraphLayout.batch[0].values[2],content);
  owner.observeMeasuredPhysicalPage(page(0,4));assert.equal(owner.physicalPagination.index.has(key),true);
  // Omission control removes the actual owner admission; the consumer contract
  // detects the missing canonical manifest instead of passing on source text.
  const mutant=new Owner();Object.assign(mutant,owner);mutant.physicalPagination=new ReaderPhysicalPaginationOwner();
  mutant.physicalPagination.observe=()=>({draft:undefined,completed:true});
  mutant.observeMeasuredPhysicalPage(page(0,4));
  assert.throws(()=>assert.equal(mutant.physicalPagination.index.has(key),true));
}
console.log('Reader layout/pagination owners PASS: whole paragraph bounds, exact retained page receipts, canonical/partial/suffix admission, native packing, SDK consumer delegation and omission control');
