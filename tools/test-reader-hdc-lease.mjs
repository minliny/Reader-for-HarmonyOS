#!/usr/bin/env node
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected = selectContractCases({
  'command-policy': { description: 'Bind command/server/target and preserve current HAP install argv without a device.', resources: [] },
  'foreground-policy': { description: 'Owned foreground startup, competing listener, failure and unreconciled process paths with finite ports.', resources: [] },
  timeout: { description: 'Kill a hung owned Node client before releasing the shared lease.', resources: [] },
  'orphan-child': { description: 'Keep a dead wrapper lease while its actual child is still alive.', resources: [] },
  serialization: { description: 'Actual CLI server lease serializes two exact targets.', resources: [] },
  'wait-barrier': { description: 'Actual acquire promise reaches contention before the first owner releases.', resources: [] },
  'stale-token': { description: 'Actual stale reclaim and token-safe release.', resources: [] },
  signal: { description: 'Actual CLI signal forwards to the owned Node client and releases after exit.', resources: [] },
  'direct-environment': { description: 'Actual client and default foreground Node spawn remove proxy variables and preserve other input.', resources: [] },
});
async function run(id){
 const {default:assert}=await import('node:assert/strict');
 const {spawn}=await import('node:child_process');
 const {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync,chmodSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {basename,resolve}=await import('node:path');const {fileURLToPath}=await import('node:url');
 const {admitCommand,canonicalServerKey,hdcDirectEnvironment,acquireLease,releaseLease,targetRef}=await import('./reader-hdc-lease.mjs');
 const root=mkdtempSync(resolve(tmpdir(),'reader-hdc-lease-test-'));
 const fake=resolve(root,'hdc');
 writeFileSync(fake,`#!${process.execPath}\nconst args=process.argv.slice(2);eval(args.at(-1));\n`);chmodSync(fake,0o700);
 const events=()=>existsSync(resolve(root,'events.jsonl'))?readFileSync(resolve(root,'events.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 const wait=async predicate=>{const deadline=Date.now()+5000;while(!predicate()){assert.ok(Date.now()<deadline,'owned worker handshake timeout');await new Promise(r=>setTimeout(r,5));}};
 const cli=(agent,target,code,waitMs='2000',timeoutMs='30000',environment=process.env)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('./reader-hdc-lease.mjs',import.meta.url)),'--target',target,'--hdc',fake,'--lock-root',root,'--agent-id',agent,'--wait-ms',waitMs,'--timeout-ms',timeoutMs,'--','shell',code],{env:environment,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  return{child,done:new Promise((yes,no)=>{child.on('error',no);child.on('close',exit=>yes({exit,stdout,stderr}));})};
 };
 const heldCode=()=>`const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(resolve(root,'ready'))},'ready');const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(resolve(root,'release'))})){clearInterval(timer);}},5);`;
 const options=(agent,target='device-a')=>({root,target,targetRefValue:targetRef(target),lockRefValue:targetRef('127.0.0.1:8710'),waitMs:2000,owner:{pid:process.pid,token:agent,agentId:agent,target}});
 try{
  assert.equal(canonicalServerKey('::ffff:127.0.0.1:8710'),'127.0.0.1:8710');
  if(id==='command-policy'){
   for(const args of [['start'],['start','-r'],['kill'],['-s','127.0.0.1:9999','list','targets'],['-t','other','shell','echo'],['tconn','other'],['reconnect','other'],['reconnect'],['-m']]) {
    assert.throws(()=>admitCommand(args,'127.0.0.1:8710','device-a'));
   }
   for(const server of ['127.0.0.1:8710','192.168.1.10:8710']) {
    assert.deepEqual(admitCommand(['start'],server,'maintenance').command,['-s',server,'start']);
    assert.deepEqual(admitCommand(['start','-r'],server,'maintenance','needed after inspection').command,['-s',server,'start','-r']);
    assert.deepEqual(admitCommand(['kill'],server,'maintenance').command,['-p','-s',server,'kill']);
    assert.deepEqual(admitCommand(['kill','-r'],server,'maintenance').command,['-p','-s',server,'kill','-r']);
    assert.deepEqual(admitCommand(['reconnect','device-a'],server,'device-a').command,['-p','-s',server,'reconnect','device-a']);
   }
   assert.deepEqual(admitCommand(['-m'],'127.0.0.1:8710','maintenance').command,['-m','-s','127.0.0.1:8710']);
   assert.throws(()=>admitCommand(['-m'],'192.168.1.10:8710','maintenance'));
   assert.throws(()=>admitCommand(['start'],'127.0.0.1:8710','device-a','needed after inspection'));
   assert.throws(()=>admitCommand(['start'],'127.0.0.1:8710','maintenance',' '));
   assert.throws(()=>admitCommand(['start','-r','extra'],'127.0.0.1:8710','maintenance','needed after inspection'));
   assert.throws(()=>admitCommand(['reconnect','device-a','extra'],'127.0.0.1:8710','device-a'));
   assert.throws(()=>admitCommand(['-t','device-a','reconnect','device-a'],'127.0.0.1:8710','device-a'));
   assert.deepEqual(admitCommand(['-s','::ffff:127.0.0.1:8710','-t','device-a','shell','echo'],'127.0.0.1:8710','device-a').command,['-p','-s','127.0.0.1:8710','-t','device-a','shell','echo']);
   assert.equal(canonicalServerKey('[::ffff:127.0.0.1]:8710'),'127.0.0.1:8710');
   const hap = '/private/fixture candidate/reader.hap';
   assert.deepEqual(admitCommand(['-s', '::ffff:127.0.0.1:8710', '-t', 'device-a', 'install', '-r', hap], '127.0.0.1:8710', 'device-a'), {
     command: ['-p', '-s', '127.0.0.1:8710', '-t', 'device-a', 'install', '-r', hap], timeoutMs: 180000,
   });
   assert.equal(admitCommand(['file', 'recv', '/device/file', '/host/file'], '127.0.0.1:8710', 'device-a').timeoutMs, 120000);
   assert.equal(admitCommand(['shell', 'bm dump -n io.reader.minliny'], '127.0.0.1:8710', 'device-a').timeoutMs, 30000);

   const bad=spawn(process.execPath,[fileURLToPath(new URL('./reader-hdc-lease.mjs',import.meta.url)),'--target','device-a','--hdc',fake,'--lock-root',root,'--','start','-r'],{stdio:'ignore'});
   assert.equal(await new Promise(r=>bad.on('close',r)),2);assert.equal(events().length,0);
  }else if(id==='direct-environment'){
   const { startForegroundServer } = await import('./reader-hdc-foreground.mjs');
   const proxyNames = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'SOCKS_PROXY'].flatMap(name => [name, name.toLowerCase()]);
   const keys = [...proxyNames, 'NO_PROXY', 'no_proxy', 'READER_HDC_TEST_SENTINEL'];
   const environment = { ...process.env, NO_PROXY: 'old', no_proxy: 'old', READER_HDC_TEST_SENTINEL: 'retained' };
   for (const name of proxyNames) environment[name] = 'http://fixture.invalid:1';
   const expected = Object.fromEntries(keys.map(name => [name, name === 'NO_PROXY' || name === 'no_proxy' ? '*' : name === 'READER_HDC_TEST_SENTINEL' ? 'retained' : null]));
   const observationCode = `Object.fromEntries(${JSON.stringify(keys)}.map(name => [name, process.env[name] ?? null]))`;
   const direct = hdcDirectEnvironment(environment);
   assert.deepEqual(Object.fromEntries(keys.map(name => [name, direct[name] ?? null])), expected);
   assert.equal(environment.HTTP_PROXY, 'http://fixture.invalid:1', 'input environment is copied');
   const result = await cli('direct', 'device-a', `console.log(JSON.stringify(${observationCode}))`, '2000', '30000', environment).done;
   assert.equal(result.exit, 0, result.stderr);
   assert.deepEqual(JSON.parse(result.stdout), expected, 'actual CLI child receives the direct environment');

   const script = resolve(root, 'foreground-environment.cjs');
   const receipt = resolve(root, 'foreground-environment.json');
   writeFileSync(script, `require('node:fs').writeFileSync(process.argv[2], JSON.stringify(${observationCode}));setInterval(()=>{},100);`);
   const saved = Object.fromEntries(keys.map(name => [name, process.env[name]]));
   let childPid;
   try {
    for (const name of keys) process.env[name] = environment[name];
    // Listener/TCP observations are explicitly finite here. The default production
    // spawn and actual process-name check execute against an owned Node child.
    const started = await startForegroundServer({
     hdc: process.execPath, command: [script, receipt], root, serverRef: 'offline-environment', timeoutMs: 1500,
     owner: { serverKey: '127.0.0.1:8710', agentId: 'test' }, onSpawn: pid => { childPid = pid; },
     deps: {
      observe: () => ({ listeners: childPid === undefined ? [] : [{ pid: childPid, command: basename(process.execPath), address: '127.0.0.1:8710' }] }),
      connect: async () => childPid !== undefined,
     },
    });
    assert.deepEqual(started, { exitCode: 0, safeToRelease: true });
    await wait(() => existsSync(receipt));
    assert.deepEqual(JSON.parse(readFileSync(receipt, 'utf8')), expected, 'default foreground spawn receives the direct environment');
   } finally {
    for (const name of keys) {
     if (saved[name] === undefined) delete process.env[name];
     else process.env[name] = saved[name];
    }
    if (childPid !== undefined) {
     try { process.kill(childPid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
     await wait(() => { try { process.kill(childPid, 0); return false; } catch (error) { return error.code === 'ESRCH'; } });
    }
   }
  }else if(id==='foreground-policy'){
   const {EventEmitter}=await import('node:events');
   const {startForegroundServer}=await import('./reader-hdc-foreground.mjs');
   const base={hdc:'/fake/hdc',command:['-m','-s','127.0.0.1:8710'],root,serverRef:'test',timeoutMs:200,
    owner:{serverKey:'127.0.0.1:8710',agentId:'test'},onSpawn:()=>{}};
   let spawns=0,persisted=0,stops=0,unrefs=0;
   const create=()=>{spawns++;const child=new EventEmitter();Object.assign(child,{pid:7123,exitCode:null,signalCode:null,unref:()=>unrefs++});setImmediate(()=>child.emit('spawn'));return child;};
   let n=0;const deps={observe:()=>++n===1?{listeners:[]}:{listeners:[{pid:7123,command:'hdc',address:'127.0.0.1:8710'}]},
    connect:async()=>n>1,processMatches:()=>true,spawnServer:create,persist:()=>persisted++,stop:async()=>{stops++;return true;}};
   assert.deepEqual(await startForegroundServer({...base,deps}),{exitCode:0,safeToRelease:true});
   assert.equal(spawns,1);assert.equal(persisted,1);assert.equal(unrefs,1);assert.equal(stops,0);
   assert.deepEqual(await startForegroundServer({...base,deps:{...deps,observe:()=>({listeners:[{pid:9999,command:'other',address:'127.0.0.1:8710'}]})}}),{exitCode:1,safeToRelease:true});
   assert.equal(spawns,1,'a competing listener must not be replaced');
   n=0;assert.deepEqual(await startForegroundServer({...base,deps:{...deps,observe:()=>++n===1?{listeners:[]}:{listeners:[{pid:9999,command:'other',address:'127.0.0.1:8710'}]},connect:async()=>false,stop:async()=>{stops++;return false;}}}),{exitCode:1,safeToRelease:false});
   assert.equal(stops,1,'unreaped owned process must retain its lease');
   const a=options('uncertain');const held=await acquireLease(a);const ownerPath=resolve(held.lockDir,'owner.json');
   writeFileSync(ownerPath,JSON.stringify({...a.owner,pid:2147483647,foregroundStartPending:true}));
   await assert.rejects(acquireLease({...options('next'),waitMs:0}),/lease wait timed out/);
   writeFileSync(ownerPath,JSON.stringify(a.owner));releaseLease(root,held.lockDir,a.owner);
  }else if(id==='timeout'){
   const a=cli('timeout','device-a',`process.on('SIGTERM',()=>{});${heldCode()}`,'2000','1500');
   await Promise.race([
    wait(() => existsSync(resolve(root, 'ready'))),
    a.done.then(result => { throw new Error(`owned worker ended before readiness: ${JSON.stringify(result)}`); }),
   ]);
   const result=await a.done;
   assert.equal(result.exit,124);const e=events();
   assert.equal(e.find(x=>x.type==='command-exit').signal,'SIGKILL');
   assert.deepEqual(e.map(x=>x.type),['acquire','command-timeout','command-exit','release']);
   assert.equal((await cli('next','device-b','process.exit(0)').done).exit,0);
  }else if(id==='orphan-child'){
   const a=options('a'),lease=await acquireLease(a);
   writeFileSync(resolve(lease.lockDir,'owner.json'),JSON.stringify({...a.owner,pid:2147483647,childPid:process.pid}));
   await assert.rejects(acquireLease({...options('b'),waitMs:0}),/wait timed out/);
   writeFileSync(resolve(lease.lockDir,'owner.json'),JSON.stringify({...a.owner,pid:2147483647,commandStartPending:true}));
   await assert.rejects(acquireLease({...options('b'),waitMs:0}),/wait timed out/);
   releaseLease(root,lease.lockDir,a.owner);
  }else if(id==='serialization'){
   const a=cli('a','device-a:5555',heldCode());
   try{
    await wait(()=>existsSync(resolve(root,'ready')));
    const rejected=await cli('b','device-b:5555','process.exit(0)','0').done;
    assert.equal(rejected.exit,2,'different target still waits on same live HDC server');
    assert.match(rejected.stderr,/lease wait timed out/);assert.deepEqual(events().filter(e=>e.type==='acquire').map(e=>e.agentId),['a']);
   }finally{writeFileSync(resolve(root,'release'),'release');}
   assert.equal((await a.done).exit,0);
   const b=await cli('b','device-b:5555','process.exit(0)').done;assert.equal(b.exit,0,b.stderr);
   assert.deepEqual(events().filter(e=>['acquire','release'].includes(e.type)).map(e=>[e.type,e.agentId]),[['acquire','a'],['release','a'],['acquire','b'],['release','b']]);
  }else if(id==='wait-barrier'){
   const a=options('a'),b=options('b','device-b');const leaseA=await acquireLease(a);
   // Async acquire executes its first contended attempt synchronously before yielding at sleep.
   let bAcquired=false;const pending=acquireLease(b).then(value=>{bAcquired=true;return value;});
   assert.equal(bAcquired,false);assert.deepEqual(events().map(e=>[e.type,e.agentId]),[['acquire','a']]);
   releaseLease(root,leaseA.lockDir,a.owner);const leaseB=await pending;releaseLease(root,leaseB.lockDir,b.owner);
   assert.deepEqual(events().map(e=>[e.type,e.agentId]),[['acquire','a'],['release','a'],['acquire','b'],['release','b']]);
  }else if(id==='stale-token'){
   const a=options('a'),old=await acquireLease(a);
   const ownerPath=resolve(old.lockDir,'owner.json');writeFileSync(ownerPath,JSON.stringify({...a.owner,pid:2147483647}));
   const b=options('b'),current=await acquireLease(b);
   assert.equal(events().filter(e=>e.type==='reclaim-stale').length,1);
   releaseLease(root,current.lockDir,a.owner);assert.equal(existsSync(current.lockDir),true,'stale token cannot release successor');
   assert.equal(events().at(-1).type,'release-skipped');releaseLease(root,current.lockDir,b.owner);assert.equal(existsSync(current.lockDir),false);
  }else{
   const a=cli('signal','device-a:5555',heldCode());await wait(()=>existsSync(resolve(root,'ready')));
   a.child.kill('SIGTERM');const result=await a.done;assert.equal(result.exit,1,'forwarded signal yields unsuccessful child, never a PASS child exit');
   assert.deepEqual(events().filter(e=>['acquire','release'].includes(e.type)).map(e=>[e.type,e.agentId]),[['acquire','signal'],['release','signal']]);
  }
 }finally{rmSync(root,{recursive:true,force:true});}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
