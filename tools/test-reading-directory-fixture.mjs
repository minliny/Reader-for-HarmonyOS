import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
const cli = process.env.READER_CORE_CLI ?? fileURLToPath(new URL('../../Reader-Core-Native/target/debug/reader-cli', import.meta.url));
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
