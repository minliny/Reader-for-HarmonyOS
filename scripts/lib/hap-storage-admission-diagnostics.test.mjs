import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseStorageAdmission, summarizeProbeResult, parseSyntheticSqliteHeader } from './hap-storage-admission-diagnostics.mjs';
import { decodeRemoteResult } from './hap-diagnostic-transport.mjs';
const nonce = 'a'.repeat(32), pid = '71329', bundleName = 'io.reader.minliny', uid = 20020064;
const candidateStorage = { sqliteMaxUserVersion: 47, sqliteStorageSourceSha256: 'a'.repeat(64) };
const prefix = `11-11 12:00:00.000 ${pid} ${pid} I A05244/Reader: `;
const identity = prefix + 'Core build identity: ' + JSON.stringify({ schemaVersion:1, buildId:'b'.repeat(64),sqliteUserVersion:47,storageCompatibility:candidateStorage,privateField:'PRIVATE_IDENTITY' });
const event = (stage, status='ready') => prefix + 'READER_STARTUP ' + JSON.stringify({stage,status});
const ready = identity + '\n' + event('startup.runtime-published');
function framed(payload='', code=0, override={}) {
  return decodeRemoteResult({ status:0, stdout:Buffer.concat([Buffer.from(payload),Buffer.from(`\nRSD_REMOTE_V2:${nonce}:${code}\n`)]), stderr:Buffer.from('PRIVATE_STDERR'), ...override }, nonce);
}
function flags(overrides={}) {
  const values = {'directory-present':1,'directory-readable':1,'directory-searchable':1,'db-symlink':0,'db-present':1,'wal-symlink':0,'journal-symlink':0,'wal-nonempty':1,'journal-nonempty':0,...overrides};
  return ['RSD_HEADER_FLAGS_V2',...Object.entries(values).map(([key,value])=>`${key}=${value}`),'END'].join('\n');
}
async function fixture(overrides={}, options={}) {
  const calls=[], outputs={'header-cwd':framed(`/mnt/debug/100/debug_hap/${bundleName}\n`),'header-markers':framed(flags()),
    'lineage-pid-before':framed(pid),'lineage-log':framed(ready),'lineage-pid-after':framed(pid),
    'fallback-ps':framed(`UID PID\n${uid} ${pid}`),'fallback-log':framed(ready),...overrides};
  const report=await diagnoseStorageAdmission({bundleName,uid,candidateStorage,...options,probeQuery:async query=>{
    calls.push(query);assert.ok(calls.length<=8);assert.doesNotMatch(query.command,/(?:^|[;(\n])\s*(?:od|dd|cat|sqlite3|PRAGMA)\b/);
    return outputs[query.category];
  }});
  const json=JSON.stringify(report);
  for(const secret of [pid,'PRIVATE_IDENTITY','PRIVATE_STDERR','/data/app/','/mnt/debug/'])assert.ok(!json.includes(secret));
  assert.equal(report.installAuthority,false);assert.equal(report.routePrediction.allowed,false);
  assert.equal(report.canonical.status,'NOT_RUN');return {report,calls};
}
test('default selected header fails honestly without any first header or marker byte read',async()=>{
  const {report,calls}=await fixture();assert.equal(report.selectedHeader.status,'FAIL');assert.equal(report.header.action,'NOT_RUN_SAFETY_BOUNDARY');
  assert.equal(report.header.version,null);assert.equal(report.query.header.read,null);assert.equal(report.header.markers.walPresent,true);
  assert.ok(calls.every(c=>c.category!=='header-read'));assert.equal(report.lineage.observedVersion,47);
});
test('explicit lineage-only scope excludes every header query and remains nonauthority',async()=>{
  const {report,calls}=await fixture({}, {lineageOnly:true});assert.equal(report.selectedHeader.status,'NOT_SELECTED');
  assert.deepEqual(calls.map(c=>c.category),['lineage-pid-before','lineage-log','lineage-pid-after']);
  assert.equal(report.lineage.reason,'lineage-valid');
  const padded=await fixture({'lineage-pid-before':framed(' \r\n'+pid+'\t '),'lineage-pid-after':framed(pid+' \n'),
    'lineage-log':framed(Buffer.concat([Buffer.from([0xc3,0x28,0xff]),Buffer.from('\n \r\n'+ready+'\n ')]))},{lineageOnly:true});
  assert.equal(padded.report.lineage.reason,'lineage-valid');assert.equal(padded.report.lineage.observedVersion,47);
});
test('raw client bytes, remote failure and invalid protocol remain separate and redacted',()=>{
  const fail=summarizeProbeResult(framed('PRIVATE_PAYLOAD',7));assert.equal(fail.clientExitCode,0);assert.equal(fail.remoteExitCode,7);
  assert.equal(fail.outcome,'remote-nonzero');assert.ok(fail.stdoutBytes>fail.payloadStdoutBytes);
  const invalid=summarizeProbeResult(decodeRemoteResult({status:0,stdout:Buffer.from([0xff]),stderr:Buffer.alloc(0)},nonce));
  assert.equal(invalid.remoteExitCode,null);assert.equal(invalid.outcome,'remote-unknown');assert.equal(invalid.stdoutBytes,1);
  assert.equal(summarizeProbeResult({status:0,stdout:Buffer.from('x')}).remoteState,'not-observed');
  for(const raw of [Buffer.from([0x20,0xc3,0x28,0xff,0x20]),' \n密é💡\t',new Uint8Array([0xff,0,0x61]),' \r\n\t']) {
    const summary=summarizeProbeResult({status:0,stdout:raw,stderr:Buffer.from([0xff,0,0x61])});
    assert.equal(summary.stdoutBytes,typeof raw==='string'?Buffer.byteLength(raw):raw.length);
    assert.equal(summary.stderrBytes,3);assert.equal(summary.remoteState,'not-observed');
  }
  const privateMessage='PRIVATE_TRANSPORT_ERROR https://private.invalid/token /data/app/private';
  for(const [extra,outcome,timedOut] of [
    [{status:3,error:{code:'ETIMEDOUT',message:privateMessage}},'timeout',true],
    [{status:3,error:{code:'ENOBUFS',message:privateMessage}},'output-limit',false],
    [{status:null,error:{code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',message:privateMessage}},'output-limit',false],
    [{status:0,error:{code:'EPERM',message:privateMessage}},'spawn-error',false],
    [{status:null,error:{code:'ENOENT',message:privateMessage}},'spawn-error',false],
    [{status:0,signal:'SIGTERM'},'spawn-error',false],[{status:undefined},'spawn-error',false],
    [{status:7},'exit-nonzero',false],[{status:0,stdout:' \n'},'empty',false],
    [{status:0,stderr:privateMessage},'ok',false]
  ]) {
    const summary=summarizeProbeResult({status:0,stdout:'out',stderr:'',...extra});
    assert.equal(summary.outcome,outcome);assert.equal(summary.timedOut,timedOut);
    assert.ok(!JSON.stringify(summary).includes(privateMessage));
  }
});
test('header flags cannot turn inaccessible or symlink paths into absence or a version',async()=>{
  for(const override of [{'directory-readable':0},{'directory-searchable':0},{'db-symlink':1},{'wal-symlink':1}]){
    const {report}=await fixture({'header-markers':framed(flags(override))});
    assert.equal(report.header.markers.walPresent,null);assert.equal(report.header.markers.journalPresent,null);assert.equal(report.header.version,null);
  }
});
test('synthetic header parser is Buffer-only and cannot be a query authority',()=>{
  const b=Buffer.alloc(100);b.write('SQLite format 3\0','latin1');b.writeUInt32BE(47,60);assert.equal(parseSyntheticSqliteHeader(b),47);
  assert.equal(parseSyntheticSqliteHeader('PRIVATE'),null);assert.equal(parseSyntheticSqliteHeader(b.subarray(0,99)),null);
});
test('remote nonzero, unknown and timeout are query failures, never successful empty lineage',async()=>{
  for(const sample of [framed('',8),framed('partial',0,{status:7}),decodeRemoteResult({status:0,stdout:Buffer.from('bad'),stderr:Buffer.alloc(0)},nonce),framed('',0,{status:null,error:{code:'ETIMEDOUT'}})]){
    const {report,calls}=await fixture({'lineage-log':sample},{lineageOnly:true,includeFallbacks:true});
    assert.equal(report.lineage.reason,sample.error?.code==='ETIMEDOUT'?'lineage-log-query-failed':'lineage-log-query-failed');
    assert.equal(report.extra.fallbackLog,null);assert.equal(calls.length,3);
  }
  const limited=await fixture({'lineage-log':framed(ready,0,{status:null,error:{code:'ENOBUFS'}})},{lineageOnly:true,includeFallbacks:true});
  assert.equal(limited.report.lineage.reason,'lineage-log-over-limit');assert.equal(limited.report.extra.fallbackLog,null);
  const unrelated=await fixture({'lineage-log':framed(prefix+'ordinary message')},{lineageOnly:true,includeFallbacks:true});
  assert.equal(unrelated.report.lineage.reason,'lineage-identity-missing');assert.equal(unrelated.report.lineage.canonicalRejected,true);
  assert.equal(unrelated.report.extra.fallbackLog,null);
});
test('stable successful empty lineage may explain via wide log without granting authority',async()=>{
  const {report,calls}=await fixture({'lineage-log':framed('')},{lineageOnly:true,includeFallbacks:true});
  assert.equal(report.lineage.reason,'lineage-log-empty');assert.equal(report.extra.fallbackLog.requestedPidIdentityCount,1);
  assert.equal(report.lineage.logBytes,0);assert.ok(report.query.lineage.log.stdoutBytes>0,'only the raw client count includes the nonce trailer');
  assert.equal(report.extra.fallbackLog.pidBound,false);assert.equal(calls.length,4);
});
test('unavailable, ambiguous and changed PID keep their original observation boundaries',async()=>{
  for(const [override,reason] of [[{'lineage-pid-before':framed('')},'lineage-pid-unavailable'],[{'lineage-pid-before':framed(pid+' 42')},'lineage-pid-ambiguous'],[{'lineage-pid-after':framed('42')},'lineage-pid-changed']]){
    const {report,calls}=await fixture(override,{lineageOnly:true,includeFallbacks:true});assert.equal(report.lineage.reason,reason);
    if(reason==='lineage-pid-changed')assert.ok(calls.every(call=>!call.category.startsWith('fallback-')));
  }
  const truncated=await fixture({'lineage-pid-before':framed(''),'fallback-ps':framed('UID PID')},{lineageOnly:true,includeFallbacks:true});
  assert.equal(truncated.report.extra.fallbackPs.reason,'fallback-output-malformed');assert.equal(truncated.report.extra.fallbackPs.matchingUidCount,null);
  for(const category of ['lineage-pid-before','lineage-pid-after']) {
    const failed=await fixture({[category]:framed('',0,{status:null,error:{code:'ENOENT',message:'PRIVATE_PID_ERROR'}})},
      {lineageOnly:true,includeFallbacks:true});
    assert.equal(failed.report.lineage.reason,'lineage-pid-query-failed');
    assert.equal(failed.report.lineage.pidState,'unavailable');
    assert.equal(failed.report.extra.fallbackPs,null,'a failed PID query is not a successful absent-PID observation');
    assert.equal(failed.calls.length,category==='lineage-pid-before'?1:3);
    assert.ok(!JSON.stringify(failed.report).includes('PRIVATE_PID_ERROR'));
  }
});
test('matching historical bad JSON remains fatal and copied wide text is not attributed',async()=>{
  const malformed=prefix+'Core build identity: {bad}';
  const {report}=await fixture({'lineage-log':framed(malformed+'\n'+event('startup.native-open')+'\n'+ready)},{lineageOnly:true});
  assert.equal(report.lineage.reason,'lineage-identity-invalid-json');assert.equal(report.lineage.historicalMalformedBeforeLatestOpen,true);
  const historicalStartup=await fixture({'lineage-log':framed(prefix+'READER_STARTUP {PRIVATE_BAD_STARTUP}\n'+event('startup.native-open','start')+'\n'+ready)},
    {lineageOnly:true,includeFallbacks:true});
  assert.equal(historicalStartup.report.lineage.reason,'lineage-malformed-line');assert.equal(historicalStartup.report.lineage.historicalMalformedBeforeLatestOpen,true);
  assert.equal(historicalStartup.report.extra.fallbackLog,null);assert.ok(!JSON.stringify(historicalStartup.report).includes('PRIVATE_BAD_STARTUP'));
  const wide=await fixture({'lineage-log':framed(''),'fallback-log':framed(prefix+'copied /Reader: Core build identity: '+JSON.stringify({schemaVersion:1}))},{lineageOnly:true,includeFallbacks:true});
  assert.equal(wide.report.extra.fallbackLog.requestedPidIdentityCount,0);
  const embedded=await fixture({'lineage-log':framed(prefix+'copied /Reader: '+identity.split('/Reader: ')[1]+'\n'+event('startup.runtime-published'))},{lineageOnly:true});
  assert.equal(embedded.report.lineage.identityCount,0);assert.equal(embedded.report.lineage.canonicalRejected,true);
  const foreignPid='81243', foreign=ready.replaceAll(pid,foreignPid);
  const unknown='/Reader: Core build identity: '+JSON.stringify({schemaVersion:1,processId:pid,secret:'PRIVATE_UNPREFIXED'})+
    '\n/Reader: READER_STARTUP '+JSON.stringify({stage:'startup.runtime-published',status:'ready',processId:pid});
  for(const [log,attribution,count,unattributed] of [
    [foreign,'complete',0,0],[unknown,'unavailable',null,2],
    [foreign+'\n'+unknown,'partial',null,2],[ready+'\n'+foreign+'\n'+unknown,'partial',1,2]
  ]) {
    const observed=await fixture({'lineage-log':framed(''),'fallback-log':framed(log)},{lineageOnly:true,includeFallbacks:true});
    const extra=observed.report.extra.fallbackLog;
    assert.equal(extra.attribution,attribution);assert.equal(extra.requestedPidIdentityCount,count);
    assert.equal(extra.requestedPidReadyCount,count);assert.equal(extra.unattributedRecordCount,unattributed);
    assert.equal(extra.pidBound,false);assert.equal(extra.pidReuseExcluded,false);assert.equal(extra.timeSeparated,true);
    for(const secret of [foreignPid,'PRIVATE_UNPREFIXED',log])assert.ok(!JSON.stringify(observed.report).includes(secret));
  }
  const incomplete=prefix+'Core build identity: '+JSON.stringify({schemaVersion:1,secret:'PRIVATE_INCOMPLETE'})+'\n'+
    prefix+'READER_STARTUP '+JSON.stringify({stage:'startup.runtime-published'})+'\n'+
    prefix+'READER_STARTUP '+JSON.stringify({status:'ready'});
  const missing=await fixture({'lineage-log':framed(''),'fallback-log':framed(incomplete)},{lineageOnly:true,includeFallbacks:true});
  assert.equal(missing.report.extra.fallbackLog.identityCount,1,'record count does not imply a complete admitted identity');
  assert.equal(missing.report.extra.fallbackLog.requestedPidIdentityCount,1);
  assert.equal(missing.report.extra.fallbackLog.readyCount,0);assert.equal(missing.report.extra.fallbackLog.requestedPidReadyCount,0);
  assert.equal(missing.report.extra.fallbackLog.pidBound,false);assert.equal(missing.report.routePrediction.allowed,false);
  assert.ok(!JSON.stringify(missing.report).includes('PRIVATE_INCOMPLETE'));
});
test('stage, status, schema reset and exceptions never expose input or confer proof',async()=>{
  for(const log of [identity,ready+'\n'+event('startup.native-open'),identity+'\n'+event('startup.runtime-published','failed')]){
    const {report,calls}=await fixture({'lineage-log':framed(log)},{lineageOnly:true,includeFallbacks:true});assert.equal(report.lineage.canonicalRejected,true);
    assert.ok(calls.every(call=>!call.category.startsWith('fallback-')),'nonempty rejected history is not permission for broader queries');
  }
  for(const [log,reason] of [
    [ready.replace('"schemaVersion":1','"schemaVersion":2'),'lineage-identity-invalid-schema'],
    [ready.replace('b'.repeat(64),'NOT_A_BUILD_HASH'),'lineage-identity-invalid-schema'],
    [ready.replace('"sqliteMaxUserVersion":47','"sqliteMaxUserVersion":0'),'lineage-identity-invalid-schema'],
    [event('startup.runtime-published')+'\n'+identity,'lineage-ready-missing'],
    [ready+'\n'+event('startup.native-open','start'),'lineage-session-reset'],
    [ready+'\n'+prefix+'READER_STARTUP {PRIVATE_BAD_STARTUP}','lineage-malformed-line']
  ]) {
    const observed=await fixture({'lineage-log':framed(log)},{lineageOnly:true,includeFallbacks:true});
    assert.equal(observed.report.lineage.reason,reason);assert.equal(observed.report.lineage.canonicalRejected,true);
    assert.equal(observed.report.extra.fallbackLog,null);assert.equal(observed.report.routePrediction.allowed,false);
    for(const secret of ['NOT_A_BUILD_HASH','PRIVATE_BAD_STARTUP'])assert.ok(!JSON.stringify(observed.report).includes(secret));
  }
  const {report}=await fixture({'lineage-log':framed(ready+'\n'+event('PRIVATE_STAGE','PRIVATE_STATUS'))},{lineageOnly:true});
  assert.equal(report.lineage.lastStage,'other');assert.equal(report.lineage.lastStatus,'other');assert.ok(!JSON.stringify(report).includes('PRIVATE_STAGE'));
  const sensitiveIdentity=identity.replace('PRIVATE_IDENTITY','PRIVATE_IDENTITY_EXTRA');
  const privacy=await fixture({'lineage-log':framed(sensitiveIdentity+'\n'+event('startup.runtime-published')+'\n'+event('PRIVATE_STAGE https://private.invalid/key','PRIVATE_STATUS'))},
    {lineageOnly:true});
  for(const secret of ['PRIVATE_IDENTITY_EXTRA','PRIVATE_STATUS','https://private.invalid/key','b'.repeat(64)])assert.ok(!JSON.stringify(privacy.report).includes(secret));
  const privateError=new Error('PRIVATE_THROWN_MESSAGE https://private.invalid/key /data/app/private');privateError.code='ENOENT';
  let throws=0;
  const thrown=await diagnoseStorageAdmission({bundleName,uid,candidateStorage,lineageOnly:true,includeFallbacks:true,
    probeQuery:async()=>{throws++;throw privateError;}});
  assert.equal(throws,1);assert.equal(thrown.lineage.reason,'lineage-pid-query-failed');
  assert.equal(thrown.query.lineage.pidBefore.outcome,'spawn-error');assert.equal(thrown.routePrediction.allowed,false);
  for(const secret of [privateError.message,privateError.stack,'PRIVATE_THROWN_MESSAGE','ENOENT'])assert.ok(!JSON.stringify(thrown).includes(secret));
  const missingVersion=await fixture({'lineage-log':framed(ready.replace('"sqliteUserVersion":47,',''))},{lineageOnly:true});
  assert.equal(missingVersion.report.lineage.reason,'lineage-version-unresolved');
  assert.equal(missingVersion.report.lineage.observedVersion,null);assert.equal(missingVersion.report.lineage.canonicalRejected,false);
  const suspicious=await fixture({'lineage-log':framed(ready+'\n'+prefix+'Core build identity: PRIVATE_NONMATCHING')},{lineageOnly:true});
  assert.equal(suspicious.report.lineage.reason,'lineage-valid');assert.equal(suspicious.report.lineage.canonicalRejected,false);
  assert.equal(suspicious.report.lineage.malformedCount,1);assert.deepEqual(suspicious.report.lineage.warningReasons,['lineage-malformed-line']);
  assert.ok(!JSON.stringify(suspicious.report).includes('PRIVATE_NONMATCHING'));
});
