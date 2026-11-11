import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { runDiagnosticCli, parseDiagnosticArgs, validateDiagnosticAuthorization } from './diagnose-storage-admission.mjs';
import { diagnosticNamespaceRef, createDiagnosticSignalScope } from '../scripts/lib/hap-diagnostic-transport.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const target='127.0.0.1:5555',server='127.0.0.1:8710',uid=20020064,now=Date.parse('2026-11-11T06:00:00Z');
const argv=opts=>Object.entries(opts).flatMap(([key,value])=>value===true?[key]:[key,value]);
function setup(dir,{lineageOnly=true,remoteFailure=false,signalAtReadiness=false}={}) {
  const opts={'--run':true,'--target':target,'--server-key':server,'--hdc':join(dir,'native-fixture'),
    '--vm-log':join(dir,'vm.log'),'--manifest':join(dir,'manifest.json'),'--authorization':join(dir,'auth.json'),'--output-dir':join(dir,'report')};
  if(lineageOnly)opts['--lineage-only']=true;
  const native=Buffer.from([127,69,76,70,1]),hap=Buffer.from('private synthetic candidate');
  writeFileSync(opts['--hdc'],native);writeFileSync(opts['--vm-log'],'synthetic VM metadata, never a real instance');writeFileSync(join(dir,'candidate.hap'),hap);
  const compatibility={sqliteMaxUserVersion:47,sqliteStorageSourceSha256:'a'.repeat(64)};
  const manifest={schemaVersion:2,abi:'x86_64',artifacts:[{kind:'signed',path:'candidate.hap',sha256:hash(hap),
    signature:{verified:true,certificateSha256:'3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4'},embeddedCoreNapi:{storageCompatibility:compatibility}}]};
  const manifestBytes=JSON.stringify(manifest);writeFileSync(opts['--manifest'],manifestBytes);
  const ledger=join(dir,'claims'),binding={manifestSha256:hash(manifestBytes),hapSha256:hash(hap),hdcSha256:hash(native),ledgerNamespaceRef:diagnosticNamespaceRef(ledger)};
  const incumbent={uid,appBuildId:'0.2.0.DEV.0123456789ab',appIdSha256:'d'.repeat(64),updateTime:1794380000000};
  const auth={schema:'reader.storage-admission-diagnostic-authorization.v2',status:'AUTHORIZED',action:'READ_ONLY_STORAGE_ADMISSION_DIAGNOSTIC_ONCE',
    approvalReference:'synthetic-distinct-approval',scopeClosed:false,bundleName:'io.reader.minliny',targetRef:hash(target).slice(0,12),serverRef:hash(server).slice(0,12),
    ...binding,incumbent,observation:{lineageOnly,includeFallbacks:false,headerBytes:false},
    limits:{businessQueries:9,preflightQueries:10,appStarts:0,appStops:0,installs:0,databaseCopies:0,sql:0,intentReads:0},
    vmConfirmation:{vmName:'Synthetic VM',confirmedAt:new Date(now-1000).toISOString(),instanceRef:'c'.repeat(64),targetRef:hash(target).slice(0,12),vmLog:opts['--vm-log']}};
  writeFileSync(opts['--authorization'],JSON.stringify(auth),{mode:0o600});
  const calls=[],messages=[],emitter=new EventEmitter(),scope=createDiagnosticSignalScope(emitter);let releases=0;
  const encode=(payload,nonce,code=0)=>({status:0,stdout:Buffer.concat([Buffer.from(payload),Buffer.from(`\nRSD_REMOTE_V2:${nonce}:${code}\n`)]),stderr:Buffer.from('PRIVATE_STDERR')});
  const fake=(tool,args,config)=>{
    tool.check();calls.push(args);assert.doesNotMatch(args.join(' '),/(?:^|[;(\n])\s*(?:od|dd|cat|sqlite3|PRAGMA|install|force-stop)\b/);
    if(args.includes('list'))return{status:0,stdout:Buffer.from(`${target}\tTCP\tConnected\n`),stderr:Buffer.alloc(0)};
    const frame=args.at(-1),nonce=/RSD_REMOTE_V2:([a-f0-9]{32}):/.exec(frame)?.[1];assert.ok(nonce,'all shell queries use the actual framed command');
    const command=frame.slice(2,frame.indexOf('\n)\nreader_diag_remote_status='));
    if(command==='param get bootevent.boot.completed')return encode('true\n',nonce);
    if(command==='bm dump -n io.reader.minliny')return encode('synthetic BMS',nonce);
    if(command==='pwd')return encode('/mnt/debug/100/debug_hap/io.reader.minliny',nonce);
    if(command.startsWith('echo RSD_HEADER_FLAGS_V2'))return encode('RSD_HEADER_FLAGS_V2\ndirectory-present=1\ndirectory-readable=1\ndirectory-searchable=1\ndb-symlink=0\ndb-present=1\nwal-symlink=0\njournal-symlink=0\nwal-nonempty=1\njournal-nonempty=0\nEND',nonce);
    if(command==='pidof io.reader.minliny')return encode('7654\n',nonce);
    if(command==='hilog -x -P 7654 -T Reader')return encode('11-11 14:00:00.000 7654 7654 I A05244/Reader: Core build identity: '+JSON.stringify({schemaVersion:1,buildId:'f'.repeat(64),sqliteUserVersion:47,storageCompatibility:compatibility,private:'PRIVATE_IDENTITY'})+'\n11-11 14:00:00.001 7654 7654 I A05244/Reader: READER_STARTUP {"stage":"startup.runtime-published","status":"ready"}',nonce,remoteFailure?9:0);
    assert.fail('unexpected synthetic query');
  };
  const ports={claimLedgerRoot:ledger,signalScope:scope,now:()=>now,stdout:line=>messages.push(JSON.parse(line)),
    acquireLease:async()=>({lockDir:'/synthetic-private-lease'}),releaseLease:()=>{releases++;assert.equal(scope.signal.aborted,signalAtReadiness);},
    spawnCheckedSync:fake,spawnChecked:async(...args)=>fake(...args),
    targetReadiness:({query})=>{assert.equal(query('param get bootevent.boot.completed'),'true');if(signalAtReadiness)emitter.emit('SIGTERM');return{status:'PASS',bootIdSha256:'a'.repeat(64),sceneBoardPidSha256:'b'.repeat(64)};},
    parseBundleMetadata:()=>({bundlePresent:true,cpuAbi:'x86_64',...incumbent,appVersion:{appBuildId:incumbent.appBuildId}})};
  return{opts,auth,binding,ports,calls,messages,releases:()=>releases,scope};
}
async function withFixture(options,run){const dir=mkdtempSync(join(tmpdir(),'reader-diagnostic-cli-v2-'));try{await run(setup(dir,options),dir);}finally{rmSync(dir,{recursive:true,force:true});}}

test('default/list and invalid selections never import or call runtime ports',async()=>{
  for(const args of [[],['--list']]){const out=[];assert.equal(await runDiagnosticCli(args,{stdout:v=>out.push(JSON.parse(v)),spawnChecked(){assert.fail();}}),0);assert.equal(out[0].status,'NOT_RUN');assert.equal(out[0].formalAuthority,'RETIRED');}
  for(const args of [['--run'],['--full'],['--list','--run']])assert.equal(await runDiagnosticCli(args,{stdout:()=>{}}),2);
});
test('v2 binds exact observation, native tool, fixed namespace, target, candidate and freshness',async()=>withFixture({},async f=>{
  validateDiagnosticAuthorization(f.auth,f.opts,f.binding,now);
  const changes=[a=>a.schema='reader.storage-admission-diagnostic-authorization.v1',a=>a.scopeClosed=true,a=>a.hdcSha256='e'.repeat(64),a=>a.ledgerNamespaceRef='e'.repeat(64),
    a=>a.observation.lineageOnly=false,a=>a.observation.headerBytes=true,a=>a.observation.includeFallbacks=true,a=>a.targetRef='e'.repeat(12),a=>a.limits.installs=1,
    a=>a.vmConfirmation.confirmedAt=new Date(now-120001).toISOString(),a=>a.incumbent.uid=0];
  for(const change of changes){const a=structuredClone(f.auth);change(a);assert.throws(()=>validateDiagnosticAuthorization(a,f.opts,f.binding,now));}
  assert.throws(()=>parseDiagnosticArgs(argv({...f.opts,'--hdc':'/synthetic/launcher.mjs'})));
}));
test('explicit lineage-only completes metadata while formal upgrade authority stays retired',async()=>withFixture({},async(f,dir)=>{
  assert.equal(await runDiagnosticCli(argv(f.opts),f.ports),0);assert.equal(f.releases(),1);
  const report=JSON.parse(readFileSync(join(dir,'report/report.json'),'utf8'));
  assert.equal(report.selectedHeader.status,'NOT_SELECTED');assert.equal(report.routePrediction.allowed,false);assert.equal(report.authority,'RETIRED_DIAGNOSTIC_ONLY');
  assert.equal(report.businessQueries,4);assert.equal(report.preflightQueries,2);assert.equal(report.installAuthority,false);
  assert.ok(!JSON.stringify(report).includes('7654'));assert.ok(!JSON.stringify(report).includes('PRIVATE_'));
}));
test('unsupported selected header fails before any tool, grant, lease or device action',async()=>withFixture({lineageOnly:false},async(f,dir)=>{
  assert.equal(await runDiagnosticCli(argv(f.opts),f.ports),1);
  const report=f.messages.at(-1);
  assert.equal(report.status,'FAIL_INCOMPLETE_HEADER');assert.equal(report.headerAction,'NOT_RUN_SAFETY_BOUNDARY');
  assert.equal(report.authorizationConsumed,false);assert.equal(report.preflightQueries,0);assert.equal(report.businessQueries,0);
  assert.equal(f.calls.length,0);assert.equal(f.releases(),0);assert.equal(existsSync(join(dir,'report')),false);
  assert.equal(existsSync(join(dir,'claims')),false);
}));
test('same approval cannot be replayed by copying, reformatting or refreshing its receipt',async()=>withFixture({},async(f,dir)=>{
  assert.equal(await runDiagnosticCli(argv(f.opts),f.ports),0);const count=f.calls.length;
  const copy=join(dir,'copy.json'),a=structuredClone(f.auth);a.vmConfirmation.confirmedAt=new Date(now).toISOString();writeFileSync(copy,JSON.stringify(a,null,2),{mode:0o600});
  assert.equal(await runDiagnosticCli(argv({...f.opts,'--authorization':copy,'--output-dir':join(dir,'again')}),f.ports),1);assert.equal(f.calls.length,count);
  assert.equal(f.releases(),1);
}));
test('remote nonzero is failed collection rather than empty successful metadata',async()=>withFixture({remoteFailure:true},async(f,dir)=>{
  assert.equal(await runDiagnosticCli(argv(f.opts),f.ports),1);const report=JSON.parse(readFileSync(join(dir,'report/report.json'),'utf8'));
  assert.equal(report.executionStatus,'FAIL_QUERY');assert.equal(report.query.lineage.log.clientExitCode,0);assert.equal(report.query.lineage.log.remoteExitCode,9);
  assert.equal(report.query.lineage.log.outcome,'remote-nonzero');assert.equal(f.releases(),1);
}));
test('processed readiness cancellation cannot dispatch BMS and still releases its one lease',async()=>withFixture({signalAtReadiness:true},async f=>{
  assert.equal(await runDiagnosticCli(argv(f.opts),f.ports),1);assert.equal(f.calls.length,2);assert.equal(f.releases(),1);
  assert.equal(f.messages.at(-1).reason,'diagnostic-cancelled');assert.equal(f.messages.at(-1).businessQueries,0);
}));
test('private input failures expose no path and symlink native input cannot dispatch',async()=>withFixture({},async(f,dir)=>{
  const link=join(dir,'native-link');symlinkSync(f.opts['--hdc'],link);
  assert.equal(await runDiagnosticCli(argv({...f.opts,'--hdc':link}),f.ports),1);assert.equal(f.calls.length,0);
  assert.ok(!JSON.stringify(f.messages).includes(dir));
}));
