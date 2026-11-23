import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256 } from '../../lib/native-ui-evidence.mjs';
import { assertLiveCollectionTarget, fixtureAdmission } from '../collectors/harmonyos/run.mjs';
import { assertRemoteCollectionReadiness, requirePublicFixtureCheckpoint } from '../collectors/harmonyos/records.mjs';
import { loadCase } from '../lib/cases.mjs';

const server = '192.168.1.10:8710';
const target = '127.0.0.1:45678';
const targetRef = sha256(target).slice(0, 12);
const milestones = [1, 2, 3, 4, 5, 6];
const bootStart = 1795368000000;

function guestReadiness(start = bootStart) {
  return {
    status:'PASS', bootCompleted:true, sceneBoardStable:true, evidenceScope:'guest-only',
    bootIdentitySource:'vm-guest-boot-milestones-v1', uptimeSource:'toybox-sysinfo', observationMs:2004,
    emulatorLog:{status:'NOT_PROVIDED'}, bootIdSha256:sha256(JSON.stringify([start, milestones])),
    sceneBoardPidSha256:sha256('sceneboard'),
    vmGuestBootWitness:{version:1, milestonesSha256:sha256(JSON.stringify(milestones)),
      samples:[{bootStart:start, milestones}, {bootStart:start, milestones}]},
  };
}

const deployment = { hdcServer:server, targetRef, targetKind:'vm', vmLocation:'remote', dataPolicy:'preserve',
  postInstall:{cpuAbi:'x86_64'}, readiness:guestReadiness() };
const contract = loadCase('reading.control-tts-capsule-handoff-full');

test('Remote VM admission requires one of the five cases and the exact guest-only x86_64 preserve deployment', () => {
  const options = {server, target, deployment, contract, manifest:{abi:'x86_64'}};
  for (const id of ['reading.control-tts-launch-quick', 'reading.control-tts-launch-full',
    'reading.control-tts-capsule-handoff', 'reading.control-tts-capsule-handoff-full', 'reading.control-more-popup']) {
    assert.doesNotThrow(() => assertLiveCollectionTarget({...options, contract:loadCase(id)}));
  }
  for (const [changed, diagnostic] of [
    [{server:'192.168.1.11:8710'}, /HDC server differs from the verified deployment/u],
    [{target:'127.0.0.1:45679'}, /target differs from the verified deployment/u],
    [{target:'192.168.1.10:45678'}, /exact loopback target discovered on that server/u],
    [{contract:loadCase('reading.control-tts-launch-interrupted')}, /no remote VM admission for this case/u],
    [{manifest:{abi:'arm64-v8a'}}, /requires an x86_64 preserve-data deployment receipt/u],
    [{deployment:{...deployment, targetKind:'physical'}}, /--target-kind vm --vm-location remote/u],
    [{vmLog:'/test/Emulator.log'}, /Omit --vm-log for the remote install and collection/u],
    [
      {deployment:{...deployment, readiness:{...deployment.readiness, evidenceScope:'guest-and-emulator-log'}}},
      /requires guest-only readiness/u,
    ],
  ]) {
    assert.throws(() => assertLiveCollectionTarget({...options, ...changed}), diagnostic);
  }
});

test('Remote live and replay readiness bind the deployed guest boot and SceneBoard', () => {
  const candidate = {...deployment, remoteGuestReadiness:deployment.readiness};
  const record = {...guestReadiness(bootStart + 1000), event:'readiness', vmLocation:'remote',
    exactConnected:true, targetKind:'vm', targetRef, hdcServer:server};
  assert.doesNotThrow(() => assertRemoteCollectionReadiness(record, candidate, contract));
  for (const changed of [
    guestReadiness(bootStart + 2000), {sceneBoardPidSha256:sha256('restarted')},
    {vmLocation:undefined}, {targetRef:sha256('other target').slice(0, 12)}, {exactConnected:false},
  ]) {
    assert.throws(() => assertRemoteCollectionReadiness({...record, ...changed}, candidate, contract),
      /Unverified exact remote VM|boot or SceneBoard changed/u);
  }
});

test('Remote empty-shelf fixture keeps public-data requirements and pins the isolated runtime checkpoint', () => {
  const observation = {direct:true, routeObservation:'synthetic direct route', socketObservation:'synthetic socket'};
  const fixture = {schema:'reader-ui-public-fixture-v1', caseId:contract.id, fixtureId:contract.fixture.id,
    targetRef, hdcServer:server, vmName:'remote-test-vm', checkedAt:'2026-11-23T09:00:00.000Z',
    publicBooks:true, publicHistory:true, publicImeCandidates:true, developerMode:true, noPersonalData:true,
    publicBookTitleConfirmed:true, publicFixtureScope:'empty-shelf',
    directRoute:{clientToServer:observation, serverToTarget:observation}};
  assert.equal(fixtureAdmission(fixture, contract, deployment), Date.parse(fixture.checkedAt));
  assert.throws(() => fixtureAdmission(fixture, contract, {...deployment, vmLocation:undefined}), /scope is unavailable/u);
  assert.throws(() => fixtureAdmission({...fixture, publicImeCandidates:undefined}, contract, deployment), /public fixture/u);
  const localServer = '127.0.0.1:8710';
  assert.throws(() => fixtureAdmission({...fixture, hdcServer:localServer}, contract,
    {...deployment, hdcServer:localServer, vmLocation:'local'}), /scope is unavailable/u);
  const unrelated = loadCase('reading.control-tts-launch-interrupted');
  assert.throws(() => fixtureAdmission({...fixture, caseId:unrelated.id, fixtureId:unrelated.fixture.id}, unrelated, deployment),
    /scope is unavailable/u);
  const checkpoint = {kind:'window-stable', channel:'probe', payload:{publicFixtureScope:'empty-shelf'}};
  assert.doesNotThrow(() => requirePublicFixtureCheckpoint(checkpoint, fixture.publicFixtureScope));
  assert.throws(() => requirePublicFixtureCheckpoint({...checkpoint, payload:{}}, fixture.publicFixtureScope), /scope/u);
});
