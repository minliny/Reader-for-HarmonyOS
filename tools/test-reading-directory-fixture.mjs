import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

try{
if(id==='core-projection'){
const {coreCliPath}=await import('./lib/tool-environment.mjs');const {readFileSync,mkdtempSync,rmSync,existsSync}=await import('node:fs');const {spawnSync}=await import('node:child_process');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createHash}=await import('node:crypto');
const cli=coreCliPath();assert.ok(existsSync(cli),'existing Core CLI is required; no build');console.log(JSON.stringify({kind:'reader-contract-tool-evidence',path:cli,sha256:createHash('sha256').update(readFileSync(cli)).digest('hex'),autoBuild:false,sourceProvenance:'UNPROVEN'}));
const input=JSON.parse(readFileSync(new URL('./fixtures/reading-directory-volume.json',import.meta.url),'utf8'));const base='https://directory-fixture.invalid';
const source={bookSourceUrl:base,bookSourceName:input.title,bookSourceType:0,enabled:true,ruleToc:{chapterList:'ol.toc li',chapterName:'a@text',chapterUrl:'a@href',isVolume:'span.volume@text'}};
const scratch=mkdtempSync(join(tmpdir(),'reader-directory-core-'));try{
const commands=[{method:'source.import',params:{sourceId:'fixture-directory',name:source.bookSourceName,baseUrl:base,rules:{},bookSource:source}},{method:'book.toc',params:{sourceId:'fixture-directory',bookId:base+'/directory/book',tocUrl:base+'/directory/toc',tocResponse:input.tocHtml}},{method:'reading.directory.view.open.v2',params:{sourceId:'fixture-directory',bookId:base+'/directory/book',limit:256}}];const results=[];
for(const [index,command]of commands.entries()){const response=spawnSync(cli,['--stdin','--config-json',JSON.stringify({dataDirectory:scratch,cacheDirectory:join(scratch,'cache')})],{input:JSON.stringify({protocolVersion:1,requestId:index+1,...command}),encoding:'utf8',timeout:30000});assert.equal(response.status,0,response.stderr);const event=response.stdout.split('\n').filter(Boolean).map(JSON.parse).find(e=>e.requestId===index+1&&['result','error'].includes(e.type));assert.equal(event?.type,'result',JSON.stringify(event));results.push(event.data);}
assert.deepEqual(results[1].readableChapterIndexes,input.expectedReadableIndexes);assert.equal(results[2].status,'ready');assert.deepEqual(results[2].nodes.map(n=>n.kind),input.expectedKinds);
}finally{rmSync(scratch,{recursive:true,force:true});}

}
if(id==='server-contract'){
const { coreCliPath }=await import('./lib/tool-environment.mjs');

const { spawn, spawnSync }=await import('node:child_process');
const { existsSync, mkdtempSync, rmSync }=await import('node:fs');
const { tmpdir }=await import('node:os');
const { join }=await import('node:path');
const { fileURLToPath }=await import('node:url');
const { once }=await import('node:events');
const cli = coreCliPath();
assert.ok(existsSync(cli), 'READER_CORE_CLI must select the current Core CLI');
const server = spawn(process.execPath, [fileURLToPath(new URL('./test-reading-text-source-server.mjs', import.meta.url)), '0'], { stdio:['ignore','pipe','pipe'] });
const scratch=mkdtempSync(join(tmpdir(),'reader-directory-fixture-'));
let output=''; let errors='';
server.stderr.on('data', chunk => { errors+=chunk; });
try {
  const base = await new Promise((resolve,reject) => {
    const timeout=setTimeout(()=>reject(new Error(`fixture ready timeout: ${errors}`)),10000);
    server.once('exit', code=>{clearTimeout(timeout);reject(new Error(`fixture exited ${code}: ${errors}`));});
    server.stdout.on('data',chunk=>{output+=chunk;const found=output.match(/ready (http:\/\/[^ ]+) listen=127\.0\.0\.1/);if(found){clearTimeout(timeout);resolve(found[1]);}});
  });
  const get = async path => {const result=await fetch(base+path);return result;};
  const [source] = await (await get('/reading-directory-sources.json')).json();
  assert.equal(source.ruleToc.isVolume,'span.volume@text');
  const toc = await (await get('/directory/toc')).text();
  const commands = [
    {method:'source.import',params:{sourceId:'fixture-directory',name:source.bookSourceName,baseUrl:base,rules:{},bookSource:source}},
    {method:'book.toc',params:{sourceId:'fixture-directory',bookId:base+'/directory/book',tocUrl:base+'/directory/toc',tocResponse:toc}},
    {method:'reading.directory.view.open.v2',params:{sourceId:'fixture-directory',bookId:base+'/directory/book',limit:256}},
  ].map((command,index)=>({protocolVersion:1,requestId:index+1,...command}));
  const events=[];
  for (const command of commands) {
    const result=spawnSync(cli,['--stdin','--config-json',JSON.stringify({dataDirectory:scratch,cacheDirectory:join(scratch,'cache')})],{input:JSON.stringify(command),encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,result.stderr + result.stdout);
    events.push(...result.stdout.trim().split('\n').map(line=>JSON.parse(line)));
  }
  const resultFor = id => {const event=events.find(event=>event.requestId===id && (event.type==='result'||event.type==='error'));assert.ok(event,JSON.stringify(events));assert.equal(event.type,'result',JSON.stringify(event));return event.data;};
  resultFor(1);
  assert.deepEqual(resultFor(2).readableChapterIndexes,[1,3]);
  const view=resultFor(3);assert.equal(view.status,'ready');assert.deepEqual(view.nodes.map(node=>node.kind),['group','target','group','target']);
  const before=await (await get('/status')).json();assert.equal(before.directoryVolumeRequests,0);
  assert.equal((await get('/directory/chapter/1')).status,200);
  const bad=await get('/directory/volume/1');assert.equal(bad.status,409);assert.equal(await bad.text(),'DIRECTORY_GROUP_MUST_NOT_FETCH_BODY');
  const evidence=await (await get('/export-evidence.json')).json();
  assert.equal(evidence.pathCounts['GET /directory/volume/1'],1);assert.equal(evidence.pathCounts['GET /directory/chapter/1'],1);
  assert.equal(evidence.directoryVolumeRequests,1);assert.equal(evidence.directoryChapterRequests,1);assert.equal(evidence.omittedPathCount,0);
  await get('/reset');assert.deepEqual((await (await get('/status')).json()).pathCounts,{});
  console.log('PASS external directory fixture: real Core source import/isVolume projection, loopback default, per-URL counters, group-body 409 negative control and evidence export. No VM claim.');
} finally {if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}rmSync(scratch,{recursive:true,force:true});}

}
}finally{}
}
const definitions={"core-projection": {"description": "existing Core CLI import/isVolume/directory projection; supplied checked-in HTML, no network", "resources": []}, "server-contract": {"description": "explicit loopback HTTP server counters/409/evidence contract; requires separate network-fixture authorization", "resources": ["network-fixture"]}};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
