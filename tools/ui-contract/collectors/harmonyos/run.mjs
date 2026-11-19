import { randomUUID } from 'node:crypto';
import { dirname, join, basename } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { candidateIdentity, sha256 } from '../../../lib/native-ui-evidence.mjs';
import { evidenceStore, requireEvidence, sealChain, validate } from '../../lib/evidence.mjs';
import { equalJson } from '../../lib/cases.mjs';
import { evaluateSearch, searchResultEndpoint } from '../../lib/search.mjs';
import { assertCurrentActionState, assertInstalled, assertOwnerActionState, checkpoint, latestProbeEvent, normalizeSample, probeEventsInRange, readyForStep, requestedOperation, windowStable } from './records.mjs';
import { openProbe } from './transport.mjs';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));

export function loadCandidate(store, refs, contract) {
  const manifest = store.json(refs.manifest);
  const deployment = store.json(refs.deployment);
  const snapshot = store.json(refs.snapshot);
  const { sources, ...identity } = candidateIdentity(manifest, deployment, snapshot);
  requireEvidence(deployment.dataPolicy === 'preserve' && ['vm','physical'].includes(deployment.targetKind) &&
    (deployment.targetKind !== 'physical' || deployment.hdcServer === '127.0.0.1:8710') &&
    ['127.0.0.1:8710','192.168.1.10:8710'].includes(deployment.hdcServer) &&
    Number.isFinite(Date.parse(deployment.completedAt)), 'Invalid preserve-data deployment binding');
  requireEvidence(equalJson(Object.keys(refs.ownerSources).sort(), [...contract.ownerSources].sort()), 'Owner source set differs from case');
  const ownerSources = {};
  for (const [path, ref] of Object.entries(refs.ownerSources)) {
    const digest = sha256(store.bytes(ref));
    requireEvidence(digest === sources.get(path), `Evidence owner not included in deployed source snapshot: ${path}`);
    ownerSources[path] = ref;
  }
  return { ...identity, ownerSources, expectedVersion: manifest.expectedVersion, postInstall: deployment.postInstall,
    completedAt: deployment.completedAt, hdcServer: deployment.hdcServer, targetKind:deployment.targetKind };
}

export function fixtureAdmission(fixture, contract, candidate) {
  requireEvidence(fixture?.schema === 'reader-ui-public-fixture-v1' && fixture.caseId === contract.id &&
    fixture.fixtureId === contract.fixture.id && fixture.targetRef === candidate.targetRef &&
    fixture.hdcServer === candidate.hdcServer &&
    (candidate.targetKind === 'vm' ? typeof fixture.vmName === 'string' && fixture.vmName.trim().length > 0 :
      fixture.physicalTestDevice === true) &&
    fixture.publicBooks === true && fixture.publicHistory === true && fixture.publicImeCandidates === true &&
    fixture.developerMode === true && fixture.noPersonalData === true &&
    (fixture.captureAfterOnlineSweep === undefined ||
      Boolean(contract.fixture.inputWord) && typeof fixture.captureAfterOnlineSweep === 'boolean'),
  'No scope-matched isolated public fixture and Developer Mode record');
  for (const leg of ['clientToServer','serverToTarget']) {
    const link = fixture.directRoute?.[leg];
    requireEvidence(link?.direct === true && typeof link.socketObservation === 'string' && link.socketObservation.length > 0 &&
      typeof link.routeObservation === 'string' && link.routeObservation.length > 0, `Missing observed direct HDC route for ${leg}`);
  }
  const checkedAt = Date.parse(fixture.checkedAt);
  requireEvidence(Number.isFinite(checkedAt), 'Missing fixture check time');
  return checkedAt;
}

function candidateInputs(options, contract) {
  const files = [options.manifest, options.deployment, join(dirname(options.manifest), 'source-snapshot.json')];
  const input = files.map(path => readFileSync(path));
  const [manifest, deployment, snapshot] = input.map(value => JSON.parse(value));
  const identity = candidateIdentity(manifest, deployment, snapshot);
  requireEvidence(identity.targetRef === sha256(options.target).slice(0, 12) && deployment.hdcServer === options.server &&
    (deployment.targetKind === 'vm') === Boolean(options.vmLog),
    'Selected target or server differs from the verified deployment');
  const fixtureBytes = readFileSync(options.fixture);
  const checkedAt = fixtureAdmission(JSON.parse(fixtureBytes), contract,
    {...identity, hdcServer: options.server, targetKind:deployment.targetKind});
  requireEvidence(Date.now() >= checkedAt && Date.now() - checkedAt <= 10 * 60 * 1000,
    'Isolated public fixture and route observation must be current');
  const owners = contract.ownerSources.map(path => {
    const bytes = readFileSync(join(repo, path));
    requireEvidence(sha256(bytes) === identity.sources.get(path), `Live owner source differs from deployed candidate: ${path}`);
    return [path, bytes];
  });
  return {input, owners, fixtureBytes};
}

function copyCandidate(store, {input, owners, fixtureBytes}) {
  const [manifest, deployment, snapshot] = input.map((bytes, index) =>
    store.write(['candidate/manifest.json','candidate/deployment.json','candidate/source-snapshot.json'][index], bytes));
  const ownerSources = Object.fromEntries(owners.map(([path, bytes]) => [path, store.write(`candidate/owner/${path}`, bytes)]));
  const fixture = store.write('session/public-fixture.json', fixtureBytes);
  return {refs: {manifest, deployment, snapshot, ownerSources}, fixture};
}

function logRead(probe) {
  return probe.command({ op: 'uiContractLog' });
}

async function freshCheckpoint(probe, {
  instanceId, laterThan = 0, since = laterThan, firstPoll, baseline, wait = [], predicate, deadline, allowMissing = false,
}) {
  let current;
  do {
    const record = await logRead(probe);
    const mark = checkpoint(record, instanceId);
    if (mark && (baseline?.instanceId !== mark.instanceId || mark.eventSeq > baseline.eventSeq) && mark.eventSeq > laterThan) {
      current = { record, mark };
      if (!wait.length && !predicate) return current;
      const polls = probe.records.slice(firstPoll - 1, record.seq);
      const events = probeEventsInRange(polls, mark.instanceId, since, mark.eventSeq);
      if (wait.every(kind => events.some(event => event.kind === kind)) && (!predicate || predicate(events))) return current;
    }
    await delay(125);
  } while (performance.now() < deadline);
  requireEvidence(current && allowMissing, 'Timed out waiting for the current app instance, Developer Mode, or owner event');
  return current;
}

async function waitForWindowState(probe, step, instanceId, submit, captureAfterOnlineSweep) {
  // SearchGateway allows a source request to take 15s before window projection.
  const waitMs = captureAfterOnlineSweep ? 300000 : submit ? 20000 : 8000;
  const deadline = performance.now() + waitMs;
  let firstStableResult;
  let nextPoll = submit?.beforeLog;
  const observed = new Map();
  do {
    const checkpoint = await freshCheckpoint(probe, {instanceId, deadline});
    const mark = checkpoint.mark;
    const area = mark.payload.report?.metrics?.keyboardArea;
    if (submit) {
      for (const event of probeEventsInRange(probe.records.slice(nextPoll, checkpoint.record.seq),
        instanceId, submit.beforeSeq, mark.eventSeq)) {
        const prior = observed.get(event.eventSeq);
        requireEvidence(!prior || equalJson(prior, event), 'Conflicting result event across probe log polls');
        observed.set(event.eventSeq, event);
      }
      nextPoll = checkpoint.record.seq;
    }
    if (step.keyboard === undefined || area?.available === true && area.visible === step.keyboard) {
      if (!submit) return checkpoint;
      const events = [...observed.values()].sort((left, right) => left.eventSeq - right.eventSeq);
      const result = searchResultEndpoint(events, submit.beforeSeq, submit.afterSeq);
      if (!result || captureAfterOnlineSweep && result.projected.payload.searchActive !== false) firstStableResult = undefined;
      else if (!firstStableResult) firstStableResult = mark;
      else if (firstStableResult.eventSeq !== mark.eventSeq) {
        // A result publication during screen/tree transfer invalidates the sample.
        // Wait for the live projection to stay quiet before either capture.
        if (!windowStable(firstStableResult, mark)) firstStableResult = mark;
        else if (mark.deviceMonoMs - firstStableResult.deviceMonoMs >= 1500) return checkpoint;
      }
    } else firstStableResult = undefined;
    await delay(captureAfterOnlineSweep ? 1750 : 125);
  } while (performance.now() < deadline);
  throw Error(`Required keyboard or owner state did not settle before ${step.id}`);
}

async function receive(probe, state, extension) {
  const remote = `/data/local/tmp/reader-control-${randomUUID()}.${extension}`;
  await probe.command({op: extension === 'png' ? 'screenCap' : 'dumpLayout', path: remote});
  await probe.command({op: 'recv', path: remote});
  return state.reference(`raw/${basename(remote)}`);
}

function requireLiveStep(step, sample, fixture) {
  requireEvidence(readyForStep({...step, publicBookTitle:fixture.bookTitle}, sample), `Required route, node or focus did not settle at ${step.id}`);
}

export async function collectHarmony(options, contract) {
  // Verify the published bytes through the packaging owner before reserving a target.
  const { verifyManifest } = await import('../../../../scripts/hap-pipeline.mjs');
  verifyManifest(options.manifest);
  const inputs = candidateInputs(options, contract);
  const runId = randomUUID();
  mkdirSync(options.outputDir, { mode: 0o700 });
  const store = evidenceStore(options.outputDir);
  const {refs, fixture} = copyCandidate(store, inputs);
  const captureAfterOnlineSweep = store.json(fixture).captureAfterOnlineSweep === true;
  const candidate = loadCandidate(store, refs, contract);
  const rawDir = join(store.root, 'raw');
  mkdirSync(rawDir, { mode: 0o700 });
  const probe = openProbe({...options, outputDir: rawDir});
  const entries = [];
  const samples = {};
  const actions = {};
  const started = performance.now();
  let instanceId = null;
  let result = 'INCOMPLETE';
  let reason = null;
  try {
    const ready = await probe.ready();
    requireEvidence(ready.targetRef === candidate.targetRef, 'Probe holds a different target lease');
    const readiness = await probe.command({op:'uiContractReadiness', vmLog:options.vmLog, targetKind:candidate.targetKind});
    const installed = await probe.command({op:'uiContractInstalledIdentity'});
    assertInstalled(installed, candidate);
    const baselineLog = await logRead(probe);
    const baseline = checkpoint(baselineLog);
    const start = await probe.command({op:'startNormal'});
    const startFloor = await logRead(probe);
    const floorEvent = latestProbeEvent(startFloor);
    const initial = await freshCheckpoint(probe, {baseline:floorEvent ?? baseline, deadline:performance.now() + 12000});
    instanceId = initial.mark.instanceId;
    entries.push({kind:'preflight', readiness:readiness.seq, installed:installed.seq, baselineLog:baselineLog.seq,
      start:start.seq, startFloor:startFloor.seq, initialLog:initial.record.seq});
    for (const step of contract.steps) {
      const hostBeginMs = performance.now() - started;
      const isAction = step.kind === 'action';
      const { record, mark: before } = isAction ?
        await freshCheckpoint(probe, {instanceId, deadline:performance.now()+2500}) :
        await waitForWindowState(probe, step, instanceId,
          step.id === 'results-settled' ? actions['submit-search'] : undefined,
          step.id === 'results-settled' && captureAfterOnlineSweep);
      const entry = {kind:step.kind, id:step.id, beforeLog:record.seq, beforeSeq:before.eventSeq, hostBeginMs};
      const priorEvents = isAction ? probeEventsInRange(probe.records.slice(initial.record.seq, record.seq),
        instanceId, initial.mark.eventSeq, before.eventSeq) : [];
      if (isAction) {
        assertCurrentActionState(step, samples[step.from], before);
        assertOwnerActionState(step, {actions, samples, events:priorEvents}, contract, before);
        const op = requestedOperation(step, samples, contract.fixture.inputWord);
        const command = await probe.command(op);
        entry.command = command.seq;
      } else {
        if (step.kind === 'sample') entry.screenshot = await receive(probe, store, 'png');
        entry.layout = await receive(probe, store, 'json');
      }
      const floor = await logRead(probe);
      const postCommandFloor = latestProbeEvent(floor, instanceId);
      requireEvidence(postCommandFloor, 'No current post-command event floor');
      entry.floorLog = floor.seq;
      const inputAssertion = contract.assertions.find(item => item.id === 'search.edit-selection');
      function inputCompleted(events) {
        const latest = events.at(-1);
        return latest && evaluateSearch(inputAssertion, {samples, events:[...priorEvents, ...events], actions:{
          ...actions, [step.id]:{instanceId, op:step.op, targetId:step.target, beforeSeq:before.eventSeq,
            afterSeq:latest.eventSeq, hostBeginMs, hostEndMs:performance.now()-started},
        }}).verdict === 'PASS';
      }
      let after = await freshCheckpoint(probe, {instanceId, laterThan:postCommandFloor.eventSeq, since:before.eventSeq,
        firstPoll:floor.seq,
        wait:isAction ? step.wait ?? [] : [], deadline:performance.now()+(isAction ? 10000 : 2500),
        allowMissing:step.id === 'input-search',
        predicate:step.id === 'input-search' ? inputCompleted : undefined});
      if (step.id === 'open' || step.id === 'dismiss') {
        after = await freshCheckpoint(probe, {instanceId, laterThan:postCommandFloor.eventSeq, since:before.eventSeq,
          firstPoll:floor.seq, deadline:performance.now() + 9000,
          allowMissing:true, predicate:events => events.some(event => event.kind === 'reading.control-motion' &&
            event.payload.direction === step.id && event.payload.blockIndex === event.payload.blockCount - 1)});
      }
      entry.afterLog = after.record.seq;
      entry.afterSeq = after.mark.eventSeq;
      entry.hostEndMs = performance.now() - started;
      entries.push(entry);
      if (isAction) {
        actions[step.id] = {...entry, actionId:`${runId}:${step.id}`, instanceId, op:step.op,
          targetId:typeof step.target === 'string' ? step.target : undefined};
      } else {
        const sample = normalizeSample({store, records:probe.records, entry, before, after:after.mark, refs:[], fixture:contract.fixture});
        requireLiveStep(step, sample, contract.fixture);
        samples[step.id] = sample;
      }
    }
    const ending = await probe.command({op:'uiContractInstalledIdentity'});
    assertInstalled(ending, candidate);
    entries.push({kind:'postflight', installed:ending.seq});
    result = 'COMPLETED';
  } catch (error) {
    reason = error.message;
  } finally {
    const endpoint = await probe.close();
    if (!endpoint.clean) {
      result = 'INCOMPLETE';
      reason ??= 'Probe did not finish with a clean close';
    }
  }
  const logPath = probe.logPath();
  const observed = logPath ? store.reference(`raw/${basename(logPath)}`) :
    store.write('session/unavailable-probe.jsonl', '\n');
  const session = validate('session', {runId, platform:'harmonyos', instanceId, result, reason,
    commands:observed, fixture, chain:sealChain(entries)});
  const sessionRef = store.writeJson('session/session.json', session);
  return {store, refs, candidate, session, sessionRef};
}
