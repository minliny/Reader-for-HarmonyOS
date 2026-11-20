import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import {coreCliPath} from './lib/tool-environment.mjs';

const SOURCE_ID='fixture-directory';
const BASE='https://directory-fixture.invalid';
const BOOK_ID=BASE+'/directory/book';
const PAGE_LIMIT=256;
const VOLUMES=2;
const CHAPTERS_PER_VOLUME=140;

function tocHtml(){
  let html='<ol class="toc">';
  for(let volume=1;volume<=VOLUMES;volume++){
    html+=`<li><a href="/directory/volume/${volume}">卷${volume}</a><span class="volume">true</span></li>`;
    for(let chapter=1;chapter<=CHAPTERS_PER_VOLUME;chapter++){
      const index=(volume-1)*CHAPTERS_PER_VOLUME+chapter;
      html+=`<li><a href="/directory/chapter/${index}">第${index}章</a><span class="volume">false</span></li>`;
    }
  }
  return html+'</ol>';
}

function cliEvents(cli,scratch,commands){
  const result=spawnSync(cli,['--stdin','--config-json',JSON.stringify({
    dataDirectory:scratch,cacheDirectory:join(scratch,'cache')})],
  {input:JSON.stringify(commands),encoding:'utf8',timeout:60000});
  assert.equal(result.status,0,result.stderr);
  return result.stdout.split('\n').filter(Boolean).map(line=>JSON.parse(line));
}

function event(events,requestId){
  const found=events.find(item=>item.requestId===requestId);
  assert.ok(found,`missing requestId ${requestId}`);
  return found;
}

function result(events,requestId,label){
  const found=event(events,requestId);
  assert.equal(found.type,'result',`${label}: ${JSON.stringify(found)}`);
  return found.data;
}

function normalized(node,depthDelta){
  const copy={};
  for(const [key,value] of Object.entries(node)){
    if(value===undefined||value===null)continue;
    copy[key]=key==='depth'?value+depthDelta:value;
  }
  return copy;
}

function assertNodes(actual,expected,label){
  assert.equal(actual.length,expected.length,`${label} node count`);
  for(let index=0;index<actual.length;index++){
    // Core v2 omits the presentation root; the Host owns the +1 depth offset.
    assert.deepEqual(normalized(actual[index],-1),normalized(expected[index],0),
      `${label} node ${index}`);
  }
}

async function run(){
  const cli=coreCliPath();
  assert.ok(existsSync(cli),'existing Core CLI is required; build reader-cli, no auto-build');
  console.log(JSON.stringify({kind:'reader-contract-tool-evidence',path:cli,
    sha256:createHash('sha256').update(readFileSync(cli)).digest('hex'),autoBuild:false,
    sourceProvenance:'UNPROVEN'}));

  const source={bookSourceUrl:BASE,bookSourceName:'pagination replay',bookSourceType:0,enabled:true,
    ruleToc:{chapterList:'ol.toc li',chapterName:'a@text',chapterUrl:'a@href',isVolume:'span.volume@text'}};
  const openParams={sourceId:SOURCE_ID,bookId:BOOK_ID,limit:PAGE_LIMIT};
  const pageParams={sourceId:SOURCE_ID,bookId:BOOK_ID,viewId:{$ref:'3.data.viewId'},
    catalogRevision:{$ref:'3.data.catalogRevision'},
    structureRevision:{$ref:'3.data.structureRevision'},offset:PAGE_LIMIT,limit:PAGE_LIMIT};
  const commands=[
    {protocolVersion:1,requestId:1,method:'source.import',params:{sourceId:SOURCE_ID,
      name:source.bookSourceName,baseUrl:BASE,rules:{},bookSource:source}},
    {protocolVersion:1,requestId:2,method:'book.toc',params:{sourceId:SOURCE_ID,bookId:BOOK_ID,
      tocUrl:BASE+'/directory/toc',tocResponse:tocHtml()}},
    {protocolVersion:1,requestId:3,method:'reading.directory.view.open.v2',params:openParams},
    {protocolVersion:1,requestId:4,method:'reading.directory.view.page.v2',params:pageParams},
    {protocolVersion:1,requestId:5,method:'reading.directory.view.page.v2',params:{
      ...pageParams,structureRevision:{$ref:'3.data.structureRevision',suffix:'-stale'},offset:0}},
  ];

  const scratch=mkdtempSync(join(tmpdir(),'reader-directory-pagination-replay-'));
  let openedPage;
  try{
    const events=cliEvents(cli,scratch,commands);
    const openData=result(events,3,'open');
    const pageData=result(events,4,'page');
    const staleEvent=event(events,5);
    assert.equal(staleEvent.type,'error','stale revision must reject');
    assert.equal(staleEvent.error.code,'INVALID_PARAMS');
    assert.equal(staleEvent.error.message,'directory view or target is stale');
    assert.equal(openData.status,'ready');
    assert.equal(openData.visibleTotal,VOLUMES*(CHAPTERS_PER_VOLUME+1));
    assert.equal(pageData.nodes.length,openData.visibleTotal-PAGE_LIMIT);
    assert.equal(pageData.nextOffset,null);

    const {ReaderDirectoryNavigationGateway}=await import(
      '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts');
    const calls=[];
    let pageReply=pageData;
    let coreError;
    const runtime={
      supportsCoreCapability:capability=>capability==='reading.directory.view.v2',
      request:async(method,params)=>{
        calls.push({method,params});
        if(method==='reading.directory.view.open.v2')return {data:openData};
        if(method==='reading.directory.view.page.v2'){
          if(coreError!==undefined){
            const error=new Error(coreError.message);
            error.code=coreError.code;
            throw error;
          }
          return {data:pageReply};
        }
        throw new Error(`unexpected command ${method}`);
      },
    };
    const gateway=new ReaderDirectoryNavigationGateway(runtime);
    const opened=await gateway.open({sourceId:SOURCE_ID,bookId:BOOK_ID,limit:PAGE_LIMIT});
    assert.equal(calls.at(-1).method,'reading.directory.view.open.v2');
    assert.equal(opened.viewId,openData.viewId);
    assert.equal(opened.navigationRevision,openData.structureRevision);
    assert.equal(opened.visibleTotal,openData.visibleTotal);
    assert.equal(opened.nextOffset,openData.nextOffset);
    assert.equal(opened.currentVisibleIndex,openData.currentVisibleIndex??undefined);
    assert.equal(opened.anchorVisibleIndex,openData.anchorVisibleIndex??undefined);
    assert.deepEqual(opened.identity,{sourceId:SOURCE_ID,bookId:BOOK_ID,
      catalogRevision:openData.catalogRevision,structureRevision:openData.structureRevision});
    assertNodes(opened.nodes,openData.nodes,'open');

    const paged=await gateway.page(BOOK_ID,openData.viewId,PAGE_LIMIT);
    assert.equal(calls.at(-1).method,'reading.directory.view.page.v2');
    assert.deepEqual(calls.at(-1).params,{sourceId:SOURCE_ID,bookId:BOOK_ID,
      viewId:openData.viewId,catalogRevision:openData.catalogRevision,
      structureRevision:openData.structureRevision,offset:PAGE_LIMIT,limit:PAGE_LIMIT});
    assert.equal(paged.viewId,pageData.viewId);
    assert.equal(paged.visibleTotal,pageData.visibleTotal);
    assert.equal(paged.nextOffset,pageData.nextOffset??undefined);
    assertNodes(paged.nodes,pageData.nodes,'page');

    pageReply={...pageData,structureRevision:pageData.structureRevision+'-stale'};
    await assert.rejects(()=>gateway.page(BOOK_ID,openData.viewId,PAGE_LIMIT),
      /directory identity changed/);
    pageReply=pageData;
    const recovered=await gateway.page(BOOK_ID,openData.viewId,PAGE_LIMIT);
    assertNodes(recovered.nodes,pageData.nodes,'recovered page');

    coreError=staleEvent.error;
    await assert.rejects(()=>gateway.page(BOOK_ID,openData.viewId,0),error=>{
      assert.equal(error.code,'INVALID_PARAMS');
      assert.equal(error.message,'directory view or target is stale');
      return true;
    });
    coreError=undefined;
    assert.equal(calls.filter(call=>call.method==='reading.directory.view.open.v2').length,1,
      'rejected pages must not reopen or replace the view');
    assert.equal(calls.filter(call=>call.method==='reading.directory.view.page.v2').length,4,
      'one normal page, one stale reply, one Core error and one recovery');
    openedPage={viewId:openData.viewId,visibleTotal:openData.visibleTotal,
      openNodes:openData.nodes.length,pageNodes:pageData.nodes.length,nextOffset:openData.nextOffset};
  }finally{
    rmSync(scratch,{recursive:true,force:true});
  }

  console.log(JSON.stringify({kind:'reader-directory-pagination-replay',status:'PASS',
    fixture:{volumes:VOLUMES,chaptersPerVolume:CHAPTERS_PER_VOLUME,
      total:VOLUMES*(CHAPTERS_PER_VOLUME+1)},open:openedPage,
    page:{offset:PAGE_LIMIT,nodes:openedPage.pageNodes,nextOffset:null},
    stale:{coreCode:'INVALID_PARAMS',coreMessage:'directory view or target is stale',
      host:'REJECTED',sideEffects:'NONE'}}));
  console.log('PASS directory pagination Host<->Core replay: real CLI open/page, stale identity and stale Core error rejected without a next page.');
}

const definitions={'pagination-replay':{description:'real Core CLI open.v2/page.v2 replay through the actual Host decoder; normal page, stale identity and stale Core error',resources:[]}};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
