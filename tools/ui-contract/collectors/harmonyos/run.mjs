import { randomUUID } from 'node:crypto';
import { dirname, join, basename } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { canonicalAppJson } from '../../../../scripts/lib/app-build-identity.mjs';
import { EvidenceError, candidateIdentity, sha256 } from '../../../lib/native-ui-evidence.mjs';
import { evidenceStore, requireEvidence, sealChain, validate } from '../../lib/evidence.mjs';
import { equalJson, grabberReversalUnavailable } from '../../lib/cases.mjs';
import { evaluateSearch, searchResultEndpoint } from '../../lib/search.mjs';
import { assertCombinedFilterResetAction, assertSourceToolsReturnAction } from '../../lib/source.mjs';
import { searchHistoryLoadingSample, searchHistoryLoadingWatchEnded } from '../../lib/search-entry-history-loading.mjs';
import { assertSearchSourceRetryOpening, canOmitSearchSourceRetry, searchEntrySourceRead, searchEntrySourceSample,
  usesSearchEntrySourceRead } from '../../lib/search-entry-source-read.mjs';
import { sourceUnknownExpandScope, sourceUnknownExpandTrigger,
  usesSourceUnknownExpand } from '../../lib/source-unknown-expand.mjs';
import { assertCurrentActionState, assertInstalled, assertOwnerActionState, checkpoint, latestProbeEvent, matchesPredicates, normalizeSample, probeEventsInRange, sampleReadiness, requestedOperation, requireActionDispatch, requireCommand, requirePopupRenderPreflight, requirePublicFixtureCheckpoint, validateInstalledMetadata, windowStable } from './records.mjs';
import { matchingSourceTransientRetirement, sameSourceTransientStatus, sourceTransientStatusEvent,
  sourceTransientStatusLayout, sourceTransientStatusLifecycle, sourceTransientStatusStep } from '../../lib/source-transient-status-text.mjs';
import { sourceStatusActionEdgePostToastSample, sourceStatusActionEdgeToastRetired } from '../../lib/source-status-action.mjs';
import { prepareReversalDispatch, reversalReadbackTiming, reversalReplayTiming } from './reversal-dispatch.mjs';
import { popupRenderOperation } from '../../lib/popup-render.mjs';
import { openProbe } from './transport.mjs';
import { guestSchedulingActionWindow, guestSchedulingCase, guestSchedulingClick, guestSchedulingCoverage, guestSchedulingReceipt,
  guestSchedulingLocalTarget, guestSchedulingTraceFile, guestSchedulingVmLog } from './guest-scheduling.mjs';
import { assertUnlockedFocus, assertVmLockDismissed, classifyFocusWindow, vmLockDismissalOperation } from './focus-window.mjs';

export { classifyFocusWindow } from './focus-window.mjs';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const phase1SigningCertificate = '3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4';
const publicFixtureKeys = new Set(['schema', 'caseId', 'fixtureId', 'targetRef', 'hdcServer', 'vmName', 'physicalTestDevice',
  'developerMode', 'checkedAt', 'noPersonalData', 'publicBooks', 'publicHistory', 'publicImeCandidates', 'publicInputs',
  'publicSources', 'publicBookTitleConfirmed', 'publicBookTitlesConfirmed', 'publicDocument', 'directRoute', 'publicFixtureScope']);
const directionKeys = ['clientToServer', 'serverToTarget'];
const linkKeys = ['direct', 'routeObservation', 'socketObservation'];
const optionalPublicClaims = ['publicInputs', 'publicSources', 'publicBookTitleConfirmed', 'publicBookTitlesConfirmed'];
const publicFixtureScopes = new Map([
  ['empty-shelf', new Set(['bookshelf.search-empty-bookshelf-entry'])],
  ['reading-grabber-cancel', new Set(['reading.control-grabber-cancel'])],
  ['empty-sources', new Set([
    'source-management.empty-library', 'bookshelf.search-no-sources', 'bookshelf.search-no-sources-management-return',
    'source-management.captured-parent-roundtrip', 'bookshelf.search-confirmed-empty', 'bookshelf.search-filter-empty-reset',
    'bookshelf.search-all-disabled', 'bookshelf.search-detail-scrolled-return',
    'source-management.group-options-scroll',
    'source-management.import-research-status-action', 'source-management.import-research-status-action-edge',
    'source-management.row-action-targets',
    'source-management.row-detect-offline', 'source-management.row-detect-offline-edge',
    'source-management.row-login-touch-center', 'source-management.row-login-touch-edge',
  ])],
  ['single-reserved', new Set([
    'source-management.layout-expanded',
    'source-management.read-loading',
    'source-management.layout-font-intermediate', 'source-management.layout-font-maximum',
    'source-management.layout-font-160', 'source-management.layout-font-200',
    'source-management.layout-width-320-font-intermediate', 'source-management.layout-width-320-font-maximum',
    'source-management.layout-width-320-font-160', 'source-management.layout-width-320-font-200',
    'source-management.row-toggle-touch-edge',
  ])],
  ['group-options-12', new Set(['source-management.group-options-scroll'])],
  ['row-actions', new Set([
    'source-management.row-action-targets',
    'source-management.row-login-touch-center', 'source-management.row-login-touch-edge',
  ])],
  ['row-detect-center', new Set(['source-management.row-detect-offline'])],
  ['row-detect-edge', new Set(['source-management.row-detect-offline-edge'])],
  ['row-detect-center-v2', new Set(['source-management.row-detect-offline'])],
  ['row-detect-edge-v2', new Set(['source-management.row-detect-offline-edge'])],
  ['search-delayed', new Set(['bookshelf.search-running-initial', 'bookshelf.search-entry-history-loading'])],
  ['search-http-503', new Set(['bookshelf.search-all-failed', 'bookshelf.search-partial', 'bookshelf.search-retry'])],
  ['search-http-503-body', new Set(['bookshelf.search-all-failed', 'bookshelf.search-partial', 'bookshelf.search-retry'])],
  ['search-retry-recovery', new Set(['bookshelf.search-retry-success'])],
  ['import-research-center', new Set(['source-management.import-research-status-action'])],
  ['import-research-edge', new Set(['source-management.import-research-status-action-edge'])],
  ['import-research-center-v2', new Set(['source-management.import-research-status-action'])],
  ['import-research-edge-v2', new Set(['source-management.import-research-status-action-edge'])],
  ['import-research-center-v3', new Set(['source-management.import-research-status-action'])],
  ['import-research-edge-v3', new Set(['source-management.import-research-status-action-edge'])],
  ['all-disabled-layout', new Set(['bookshelf.search-all-disabled'])],
  ['source-original-interrupted', new Set([
    'source-management.pending-recovery',
    'source-management.original-recovery-body', 'source-management.original-recovery-body-fits',
    'source-management.original-recovery-expand-touch-edge', 'source-management.original-expand-target',
    'source-management.original-reconcile-target', 'source-management.original-reconcile-touch-center',
    'source-management.original-reconcile-touch-edge', 'source-management.original-continue-target',
    'source-management.original-continue-touch-center', 'source-management.original-continue-touch-edge',
  ])],
  ['source-original-interrupted-edge', new Set(['source-management.original-continue-touch-edge'])],
  ['source-write-unknown', new Set([
    'source-management.unknown-expand-target',
    'source-management.unknown-reconcile-target',
    'source-management.unknown-reconcile-touch-center',
    'source-management.unknown-reconcile-touch-edge',
    'source-management.unknown-recovery-body',
    'source-management.unknown-recovery-body-fits',
    'source-management.unknown-recovery-expand-touch-edge',
  ])],
  ['source-read-fault-cold', new Set([
    'source-management.read-failure', 'source-management.read-retry', 'source-management.read-retry-edge',
  ])],
  ['source-read-fault-retained', new Set([
    'source-management.retained-read-failure', 'source-management.retained-read-retry-center',
    'source-management.retained-read-retry-edge',
  ])],
  ['source-read-fault-search', new Set([
    'bookshelf.search-source-load-error', 'bookshelf.search-source-load-retry',
  ])],
  ['search-detail-scroll-corpus', new Set(['bookshelf.search-detail-scrolled-return'])],
]);

function sameKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) && equalJson(Object.keys(value).sort(), keys);
}

export function loadCandidate(store, refs, contract) {
  const manifest = store.json(refs.manifest);
  const deployment = store.json(refs.deployment);
  const snapshot = store.json(refs.snapshot);
  const { sources, ...identity } = candidateIdentity(manifest, deployment, snapshot);
  requireEvidence(deployment.dataPolicy === 'preserve' && ['vm','physical'].includes(deployment.targetKind) &&
    (deployment.targetKind !== 'physical' || deployment.hdcServer === '127.0.0.1:8710') &&
    ['127.0.0.1:8710','192.168.1.10:8710'].includes(deployment.hdcServer) &&
    Number.isFinite(Date.parse(deployment.completedAt)), 'Invalid preserve-data deployment binding');
  if (contract.phase !== undefined) {
    validateInstalledMetadata(deployment.postInstall, 'Deployment');
    const { signature } = manifest.artifacts.find(artifact => artifact.kind === 'signed');
    requireEvidence(signature.status === 'signed' && signature.certificateSha256 === phase1SigningCertificate &&
      signature.profileType === 'debug' && signature.profileType === deployment.postInstall.appProvisionType &&
      manifest.abi === deployment.postInstall.cpuAbi &&
      ['appIdSha256','appIdentifierSha256'].every(key => signature[key] === deployment.postInstall[key]),
    'The signed candidate and installed bundle have different certificate, profile, ABI, or application identity');
  }
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
  if (usesSourceUnknownExpand(contract)) requireEvidence(fixture.publicFixtureScope === sourceUnknownExpandScope,
    'The first-opening recovery needs the isolated Source write fixture scope');
  if (contract.fixture.id === 'public-local-reading-grabber-cancel-v2') requireEvidence(
    fixture.publicFixtureScope === 'reading-grabber-cancel' && candidate.targetKind === 'vm',
    'The scoped platform Cancel requires its isolated book on the admitted VM');
  if (fixture.publicFixtureScope === 'reading-grabber-cancel') requireEvidence(
    contract.fixture.id === 'public-local-reading-grabber-cancel-v2',
    'The public platform Cancel fixture cannot service another case version');
  if (Object.hasOwn(fixture, 'publicFixtureScope')) {
    requireEvidence(contract.phase === 1 && candidate.targetKind === 'vm' &&
      publicFixtureScopes.get(fixture.publicFixtureScope)?.has(contract.id),
    'The public fixture scope is unavailable for the selected case or target');
  }
  if (contract.phase !== undefined) {
    requireEvidence(Object.keys(fixture).every(key => publicFixtureKeys.has(key)) &&
      optionalPublicClaims.every(key => fixture[key] === undefined || fixture[key] === true) &&
      (candidate.targetKind === 'vm' ? fixture.physicalTestDevice === undefined : fixture.vmName === undefined) &&
      sameKeys(fixture.directRoute, directionKeys) && directionKeys.every(leg => sameKeys(fixture.directRoute[leg], linkKeys)),
    'The public fixture contains fields outside the documented collection record');
    requireEvidence((!contract.fixture.publicSources || fixture.publicSources === true) &&
      (!contract.fixture.inputs || fixture.publicInputs === true) &&
      (!contract.fixture.bookTitle || fixture.publicBookTitleConfirmed === true) &&
      (!contract.fixture.bookTitles || fixture.publicBookTitlesConfirmed === true) &&
      (contract.fixture.publicDocument ?
        equalJson(fixture.publicDocument ?? null, {...contract.fixture.publicDocument,pickerPublic:true}) :
        fixture.publicDocument === undefined),
    'Public fixture scope does not attest the selected data roles');
  }
  for (const leg of ['clientToServer','serverToTarget']) {
    const link = fixture.directRoute?.[leg];
    requireEvidence(link?.direct === true && typeof link.socketObservation === 'string' && link.socketObservation.length > 0 &&
      typeof link.routeObservation === 'string' && link.routeObservation.length > 0, `Missing observed direct HDC route for ${leg}`);
  }
  const checkedAt = Date.parse(fixture.checkedAt);
  requireEvidence(Number.isFinite(checkedAt), 'Missing fixture check time');
  return checkedAt;
}

export function assertLiveCollectionTarget({ server, deployment }) {
  requireEvidence(server === '127.0.0.1:8710' && deployment.hdcServer === server,
    'Live UI collection is restricted to the local HDC server 127.0.0.1:8710; remote VM collection is not permitted');
}

function candidateInputs(options, contract) {
  const files = [options.manifest, options.deployment, join(dirname(options.manifest), 'source-snapshot.json')];
  const input = files.map(path => readFileSync(path));
  const [manifest, deployment, snapshot] = input.map(value => JSON.parse(value));
  assertLiveCollectionTarget({ server: options.server, deployment });
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

export function readLivePriorEvents(records, instanceId, afterSeq, throughSeq) {
  const canonicalKeys = new WeakMap();
  return probeEventsInRange(records, instanceId, afterSeq, throughSeq, (previous, event) => {
    let key = canonicalKeys.get(previous);
    if (key === undefined) {
      // Validate the first duplicate even when structural equality is enough.
      key = canonicalAppJson(previous);
      canonicalKeys.set(previous, key);
    }
    return isDeepStrictEqual(previous, event) || key === canonicalAppJson(event);
  });
}

async function freshCheckpoint(probe, {
  instanceId, laterThan = 0, since = laterThan, firstPoll, baseline, wait = [], predicate, deadline, allowMissing = false,
}) {
  let current;
  do {
    const record = await logRead(probe);
    const mark = checkpoint(record, instanceId);
    if (mark && (baseline?.instanceId !== mark.instanceId || mark.eventSeq > baseline.eventSeq) && mark.eventSeq > laterThan) {
      requirePublicFixtureCheckpoint(mark, probe.publicFixtureScope);
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
  throw new EvidenceError(`Required keyboard or owner state did not settle before ${step.id}`);
}

async function waitForScopedSample(probe, step, instanceId, action, contract) {
  const deadline = performance.now() + (step.stateWaitMs ?? (step.waitFor ? 20000 : 8000));
  // A prolonged state watch still needs several checkpoints across a quiet
  // window. Reduce repeated whole-buffer Hilog reads during that watch.
  const pollMs = step.stateWaitMs === undefined ? 125 : 500;
  let quietStart;
  let fallback;
  let lastPoll = action?.beforeLog;
  const relevantEvents = [];
  const retainedFailure = step.id === 'retained-failure' &&
    ['source-management.retained-read-failure', 'source-management.retained-read-retry-center',
      'source-management.retained-read-retry-edge'].includes(contract.id);
  const captureRetainedToast = retainedFailure && sourceTransientStatusStep(contract.fixture, step);
  const toastScope = 'retained-read-failed';
  do {
    const checkpoint = await freshCheckpoint(probe, {instanceId, deadline});
    const { mark, record } = checkpoint;
    if (action) {
      const through = relevantEvents.at(-1)?.eventSeq ?? action.beforeSeq;
      relevantEvents.push(...probeEventsInRange(probe.records.slice(lastPoll - 1, record.seq), instanceId, through, mark.eventSeq));
      lastPoll = record.seq;
    }
    if (!quietStart || !windowStable(quietStart.mark, mark)) quietStart = checkpoint;
    const settled = !step.quietMs || mark.deviceMonoMs - quietStart.mark.deviceMonoMs >= step.quietMs;
    const current = settled && step.quietMs ? {...checkpoint, quietLog:quietStart.record.seq} : checkpoint;
    const publication = retainedFailure ? relevantEvents.findLast(event => event.windowRevision === mark.windowRevision &&
      event.kind === sourceTransientStatusLifecycle && event.payload.phase === 'published' &&
      sourceTransientStatusEvent(event, toastScope)) : undefined;
    const retired = publication && relevantEvents.some(event =>
      matchingSourceTransientRetirement(event, [publication], toastScope));
    const retainedToastReady = captureRetainedToast ? publication && !retired && relevantEvents.some(event =>
      event.eventSeq > publication.eventSeq && event.windowRevision === mark.windowRevision &&
      event.kind === sourceTransientStatusLayout && sameSourceTransientStatus(publication, event, toastScope)) :
      !publication || retired;
    const ownerReady = action?.outcomeSettled !== false && retainedToastReady && matchesPredicates(relevantEvents, step.waitFor) &&
      (!sourceStatusActionEdgePostToastSample(contract,step) || sourceStatusActionEdgeToastRetired(relevantEvents));
    const keyboard = mark.payload.report?.metrics?.keyboardArea;
    const keyboardReady = step.keyboard === undefined || keyboard?.available === true && keyboard.visible === step.keyboard;
    // A sealed action timeout cannot acquire the missing outcome in a later
    // sample. Preserve the first quiet diagnostic instead of waiting again.
    if (settled && keyboardReady && step.kind === 'sample' && action?.outcomeSettled === false) {
      return {...current, ownerReady:false};
    }
    if (settled && ownerReady && keyboardReady) return {...current, ownerReady};
    if (captureRetainedToast && retired && keyboardReady) return {...current, ownerReady:false};
    if (settled && keyboardReady && step.id === searchEntrySourceSample && usesSearchEntrySourceRead(contract) &&
        searchEntrySourceRead(relevantEvents, action, mark.eventSeq)?.outcome === 'ready') {
      return {...current, ownerReady};
    }
    if (step.id === searchHistoryLoadingSample && searchHistoryLoadingWatchEnded(relevantEvents,action))
      return {...current, ownerReady:false};
    fallback = settled && step.kind === 'sample' ? {...current, ownerReady} : undefined;
    const remaining = deadline - performance.now();
    if (remaining > 0) await delay(Math.min(pollMs, remaining));
  } while (performance.now() < deadline);
  // A settled capture also describes a wrong product state. Keep it exactly
  // once, without using it to authorize a subsequent input target.
  if (fallback) return fallback;
  throw new EvidenceError(`No stable capture available at ${step.id}`);
}

async function capture(probe,extension) {
  const remote = `/data/local/tmp/reader-control-${randomUUID()}.${extension}`;
  await probe.command({op: extension === 'png' ? 'screenCap' : 'dumpLayout', path: remote});
  return remote;
}

async function readCapture(probe,state,remote) {
  await probe.command({op: 'recv', path: remote});
  return state.reference(`raw/${basename(remote)}`);
}

async function receive(probe,state,extension) {
  return readCapture(probe,state,await capture(probe,extension));
}

/** Collect only the selected Runner action using the already-owned target probe. */
export async function collectReversalAction({probe, step, runId, candidate, runner, mode, instanceId, initial,
  actions, samples, captures, started}) {
  const hostBeginMs = performance.now() - started;
  const quick = samples[step.from];
  requireEvidence(quick?.captureComplete === true && samples[step.reversalReference]?.captureComplete === true,
    'Missing verified native Full and Quick reversal calibration');
  const prePoll = await freshCheckpoint(probe,{instanceId,laterThan:quick.afterSeq,deadline:performance.now()+2500});
  assertCurrentActionState(step,quick,prePoll.mark);
  const installed = await probe.command({op:'uiContractRunnerInstalledIdentity',bundleName:runner.bundleName});
  requireCommand(probe.records,installed.seq,['shell','bm','dump','-n',runner.bundleName]);
  const clock = await probe.command({op:'uiContractRunnerClock'});
  requireCommand(probe.records,clock.seq,['shell','date','+%s']);
  const timing = reversalReadbackTiming(installed,clock,runner.postInstall);
  const beforeLog = await logRead(probe);
  const before = checkpoint(beforeLog,instanceId);
  requireEvidence(before && before.eventSeq >= prePoll.mark.eventSeq &&
    installed.seq === beforeLog.seq - 2 && clock.seq === beforeLog.seq - 1,
  'Runner install, clock and fresh Reader checkpoint must immediately precede dispatch');
  const priorEvents = probeEventsInRange(probe.records.slice(initial.record.seq,beforeLog.seq),
    instanceId,initial.mark.eventSeq,before.eventSeq);
  assertCurrentActionState(step,quick,before,priorEvents);
  requireEvidence(matchesPredicates(priorEvents,step.beforeEvent),'The Runner action is missing its owner precondition');
  const enter = actions['enter-reading'];
  const ready = priorEvents.filter(event => enter?.instanceId === instanceId && event.instanceId === instanceId &&
    event.eventSeq > enter.beforeSeq && event.eventSeq <= enter.afterSeq && event.kind === 'reading.ready' &&
    event.channel === 'business' && event.payload.localBook === true && event.payload.reduceMotion === false &&
    ['continuous','paged'].includes(event.payload.mode));
  requireEvidence(ready.length === 1,'The Runner action is missing its verified public local reading owner');
  const operation = prepareReversalDispatch({step,runId,candidate,runner,readingId:ready[0].payload.readingId,
    before,samples,captures,...timing,mode});
  const command = await probe.command({op:'uiContractRunnerInvoke',argument:operation.argument});
  requireEvidence(command.seq === beforeLog.seq + 1,'The Runner command is outside its causal interval');
  const dispatch = requireActionDispatch(probe.records,command.seq,operation);
  const floor = await logRead(probe);
  const postCommandFloor = latestProbeEvent(floor,instanceId);
  requireEvidence(postCommandFloor && postCommandFloor.eventSeq >= before.eventSeq && floor.seq === command.seq + 1,
    'No immediate post-command Reader event floor');
  reversalReplayTiming(installed,clock,beforeLog,command,floor,runner.postInstall);
  const dry = mode === 'dry';
  const after = await freshCheckpoint(probe,{instanceId,laterThan:postCommandFloor.eventSeq,since:before.eventSeq,
    firstPoll:floor.seq,wait:dry ? [] : step.wait ?? [],deadline:performance.now()+(dry ? 2500 : 10000),
    allowMissing:!dry,predicate:dry ? undefined : events => matchesPredicates(events,step.waitFor)});
  const entry = {kind:'action',id:step.id,runnerInstallLog:installed.seq,runnerClockLog:clock.seq,
    beforeLog:beforeLog.seq,beforeSeq:before.eventSeq,command:command.seq,floorLog:floor.seq,
    afterLog:after.record.seq,afterSeq:after.mark.eventSeq,hostBeginMs};
  let outcomeSettled;
  if (dry) {
    requireEvidence(windowStable(before,after.mark),'Reader window or semantic state changed during Runner dry qualification');
    const readerInstalled = await probe.command({op:'uiContractInstalledIdentity'});
    assertInstalled(readerInstalled,candidate);
    requireEvidence(readerInstalled.seq === after.record.seq + 1,'Missing immediate Reader identity after Runner dry qualification');
    entry.runnerMode = 'dry';
    entry.readerInstalledAfterLog = readerInstalled.seq;
  } else {
    const events = probeEventsInRange(probe.records.slice(floor.seq-1,after.record.seq),
      instanceId,before.eventSeq,after.mark.eventSeq);
    outcomeSettled = matchesPredicates(events,step.waitFor) &&
      (step.wait ?? []).every(kind => events.some(event => event.kind === kind));
  }
  entry.hostEndMs = performance.now() - started;
  return {entry,dispatch,outcomeSettled};
}

export async function requireUnlockedFocus(probe, stage) {
  const record = await probe.command({op:'uiContractFocusWindow'});
  assertUnlockedFocus(record.stdout, stage);
}

// Ordinary lock-screen dismissal only. Never submit a credential, change the
// lock policy, or retry the gesture. Recovery is outside the case action chain.
export async function prepareUnlockedFocus(probe, {targetKind, server, target}, settle = delay) {
  if (targetKind !== 'vm' || server !== '127.0.0.1:8710' || target !== '127.0.0.1:5555') {
    await requireUnlockedFocus(probe, 'before-launch');
    return 'ALREADY_UNLOCKED';
  }
  const {stdout} = await probe.command({op:'uiContractFocusWindow'});
  const state = classifyFocusWindow(stdout);
  if (state === 'NOT_LOCKED') return 'ALREADY_UNLOCKED';
  await probe.command(vmLockDismissalOperation(stdout));
  await settle(1000);
  const observed = (await probe.command({op:'uiContractFocusWindow'})).stdout;
  assertVmLockDismissed(observed);
  return 'DISMISSED';
}

export async function collectHarmony(options, contract) {
  requireEvidence(!options.guestSchedulingTrace || contract.id === guestSchedulingCase &&
    guestSchedulingVmLog(options.vmLog) && guestSchedulingLocalTarget(options.server, options.target),
  'Guest scheduling trace requires the Full capsule handoff on the original local VM');
  const {runnerCollectionMode,authorizeRunnerCollection} = await import('./runner-collection-admission.mjs');
  const collectionMode = runnerCollectionMode(options,contract);
  const reversal = contract.steps.find(step => step.op === 'grabberReversal');
  // Verify the published bytes through the packaging owner before reserving a target.
  const { verifyManifest } = await import('../../../../scripts/hap-pipeline.mjs');
  verifyManifest(options.manifest);
  const inputs = candidateInputs(options, contract);
  if (options.guestSchedulingTrace) {
    requireEvidence(guestSchedulingVmLog(options.vmLog, JSON.parse(inputs.fixtureBytes).vmName),
      'Guest scheduling trace fixture does not identify the original VM');
  }
  const runId = randomUUID();
  mkdirSync(options.outputDir, { mode: 0o700 });
  const store = evidenceStore(options.outputDir);
  const {refs, fixture} = copyCandidate(store, inputs);
  const fixtureRecord = store.json(fixture);
  const captureAfterOnlineSweep = fixtureRecord.captureAfterOnlineSweep === true;
  const candidate = loadCandidate(store, refs, contract);
  const authorizedRunner = collectionMode ? await authorizeRunnerCollection(options,contract,candidate) : undefined;
  if (collectionMode) {
    requireEvidence(authorizedRunner?.runner,grabberReversalUnavailable);
  }
  const rawDir = join(store.root, 'raw');
  mkdirSync(rawDir, { mode: 0o700 });
  const runnerMode = authorizedRunner && (collectionMode === 'qualify' ? 'dry' : 'dispatch');
  const probe = {...openProbe({...options, outputDir:rawDir, runnerMode}), publicFixtureScope:fixtureRecord.publicFixtureScope};
  const entries = [];
  const samples = {};
  const captures = {};
  const actions = {};
  const scopedCase = contract.phase !== undefined;
  const started = performance.now();
  let instanceId = null;
  let result = 'INCOMPLETE';
  let reason = null;
  let toolError;
  let unsettledAction;
  let runnerEvidence;
  try {
    const ready = await probe.ready();
    requireEvidence(ready.targetRef === candidate.targetRef, 'Probe holds a different target lease');
    const readiness = await probe.command({op:'uiContractReadiness', vmLog:options.vmLog, targetKind:candidate.targetKind});
    const installed = await probe.command({op:'uiContractInstalledIdentity'});
    assertInstalled(installed, candidate);
    await prepareUnlockedFocus(probe, {...options, targetKind:candidate.targetKind});
    const baselineLog = await logRead(probe);
    const baseline = checkpoint(baselineLog);
    const start = await probe.command({op:'startNormal'});
    await requireUnlockedFocus(probe, 'after-launch');
    const startFloor = await logRead(probe);
    const floorEvent = latestProbeEvent(startFloor);
    const initial = await freshCheckpoint(probe, {baseline:floorEvent ?? baseline, deadline:performance.now() + 12000});
    instanceId = initial.mark.instanceId;
    entries.push({kind:'preflight', readiness:readiness.seq, installed:installed.seq, baselineLog:baselineLog.seq,
      start:start.seq, startFloor:startFloor.seq, initialLog:initial.record.seq});
    for (const step of contract.steps) {
      const hostBeginMs = performance.now() - started;
      const isAction = step.kind === 'action';
      requireEvidence(!isAction || !unsettledAction, `The expected outcome of ${unsettledAction} was not observed before ${step.id}`);
      if (isAction) await requireUnlockedFocus(probe, step.id);
      if (step === reversal) {
        const dry = collectionMode === 'qualify';
        const {entry,dispatch,outcomeSettled} = await collectReversalAction({probe,step,runId,candidate,runner:authorizedRunner.runner,
          mode:dry ? 'dry' : 'dispatch',instanceId,initial,actions,samples,captures,started});
        runnerEvidence = {
          manifest:store.write('candidate/runner-manifest.json',authorizedRunner.manifestBytes),
          verification:store.write('candidate/runner-verification.json',authorizedRunner.verificationBytes),
          deployment:store.write('candidate/runner-deployment.json',authorizedRunner.deploymentBytes),
        };
        if (!dry) entry.runnerQualificationSha256 = options.runnerQualificationSha;
        entries.push(entry);
        if (dry) {
          reason = 'Runner dry qualification captured; native reversal remains unobserved';
          break;
        }
        actions[step.id] = {...entry,actionId:`${runId}:${step.id}`,instanceId,op:step.op,targetId:step.target,dispatch,outcomeSettled};
        if (!outcomeSettled) unsettledAction = step.id;
        continue;
      }
      const { record, mark: before, quietLog, ownerReady } = isAction ?
        await freshCheckpoint(probe, {instanceId, deadline:performance.now()+2500}) :
        scopedCase ? await waitForScopedSample(probe, step, instanceId, actions[step.afterAction], contract) :
        await waitForWindowState(probe, step, instanceId,
          step.id === 'results-settled' ? actions['submit-search'] : undefined,
          step.id === 'results-settled' && captureAfterOnlineSweep);
      const entry = {kind:step.kind, id:step.id, beforeLog:record.seq, beforeSeq:before.eventSeq, hostBeginMs};
      if (quietLog !== undefined) entry.quietLog = quietLog;
      const priorEvents = isAction ? readLivePriorEvents(probe.records.slice(initial.record.seq, record.seq),
        instanceId, initial.mark.eventSeq, before.eventSeq) : [];
      let inputLength;
      if (isAction) {
        assertCurrentActionState(step, samples[step.from], before, priorEvents);
        if (usesSourceUnknownExpand(contract) && step.id === 'expand-recovery') {
          requireEvidence(sourceUnknownExpandTrigger({actions,samples,events:priorEvents}),
            'The first opening has no uniquely verified public write receipt withheld in this native window');
        }
        assertCombinedFilterResetAction(contract,step,{actions,samples,events:priorEvents},before);
        assertSourceToolsReturnAction(contract,step,{actions,samples,events:priorEvents},before);
        assertSearchSourceRetryOpening(contract, step, priorEvents, actions['open-search'], before.eventSeq);
        if (scopedCase) {
          requireEvidence(matchesPredicates(priorEvents, step.beforeEvent), `Owner precondition missing before ${step.id}`);
        } else assertOwnerActionState(step, {actions, samples, events:priorEvents}, contract, before);
        const input = requestedOperation(step, samples, contract.fixture);
        let op = popupRenderOperation(contract, step, input);
        if (op !== input) {
          const baseline = await probe.command({op:'popupRenderBaseline'});
          ({operation:op} = requirePopupRenderPreflight(probe.records,baseline.seq,op));
          entry.popupRender = true;
          entry.popupRenderBaselineLog = baseline.seq;
        }
        if (op.op === 'inputText') inputLength = op.text.length;
        const observeGuestSchedule = options.guestSchedulingTrace && guestSchedulingClick(contract, step, op);
        const command = await probe.command(observeGuestSchedule ? { ...op, observeGuestSchedule:true } : op);
        entry.command = command.seq;
        requireActionDispatch(probe.records, command.seq, op);
      } else if (sourceTransientStatusStep(contract.fixture,step)) {
        const treePath = await capture(probe,'json');
        const imagePath = await capture(probe,'png');
        entry.layout = await readCapture(probe,store,treePath);
        entry.screenshot = await readCapture(probe,store,imagePath);
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
      // The native capsule observer queues its frame blocks after the visible
      // 2300ms design interval (1150ms actual). Avoid repeated full Hilog
      // scans during that interval after preserving the post-dispatch floor.
      const waitsForCapsuleFlight = step.waitFor?.some(predicate =>
        predicate.kind === 'reading.control-effect' && predicate.fields?.['payload.kind'] === 'capsule-launch' &&
        predicate.fields?.['payload.phase'] === 'frame-block' && predicate.fields?.['payload.facts.finalBlock'] === true);
      if (isAction && step.id === 'playback-launch' && step.op === 'click' && waitsForCapsuleFlight) {
        await delay(1250);
      }
      let after = await freshCheckpoint(probe, {instanceId, laterThan:postCommandFloor.eventSeq, since:before.eventSeq,
        firstPoll:floor.seq,
        wait:isAction ? step.wait ?? [] : [], deadline:performance.now()+(isAction ? 10000 : 2500),
        allowMissing:scopedCase && isAction || step.id === 'input-search',
        predicate:scopedCase && isAction ? events => matchesPredicates(events, step.waitFor) :
          step.id === 'input-search' ? inputCompleted : undefined});
      if (!scopedCase && (step.id === 'open' || step.id === 'dismiss')) {
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
        actions[step.id] = {...entry, actionId:`${runId}:${step.id}`, instanceId, op:step.op, key:step.key,
          from:step.from, inputRole:step.inputRole,inputLength,
          targetId:typeof step.target === 'string' ? step.target : step.target?.id};
        if (scopedCase) {
          const events = probeEventsInRange(probe.records.slice(floor.seq - 1, after.record.seq),
            instanceId, before.eventSeq, after.mark.eventSeq);
          actions[step.id].outcomeSettled = matchesPredicates(events, step.waitFor) &&
            (step.wait ?? []).every(kind => events.some(event => event.kind === kind));
          if (!actions[step.id].outcomeSettled) unsettledAction = step.id;
        }
      } else {
        const sample = normalizeSample({store, records:probe.records, entry, before, after:after.mark, refs:[], caseId:contract.id,
          fixture:contract.fixture, step, causalAction:actions[step.afterAction]});
        if (step.id === searchEntrySourceSample && usesSearchEntrySourceRead(contract)) {
          const action = actions[step.afterAction];
          const events = probeEventsInRange(probe.records.slice(action.beforeLog - 1, after.record.seq), instanceId,
            action.beforeSeq, after.mark.eventSeq);
          if (canOmitSearchSourceRetry(contract, events, action, sample)) break;
        }
        const issue = sampleReadiness(step, sample, contract.fixture.bookTitle, ownerReady);
        if (!scopedCase || step.kind === 'locate') requireEvidence(!issue, `Required route or focus did not settle at ${step.id}: ${issue}`);
        if (!issue) {
          samples[step.id] = sample;
          if (reversal && (step.id === reversal.from || step.id === reversal.reversalReference)) {
            captures[step.id] = {layout:entry.layout,screenshot:entry.screenshot};
          }
        }
      }
    }
    if (collectionMode !== 'qualify') {
      const ending = await probe.command({op:'uiContractInstalledIdentity'});
      assertInstalled(ending, candidate);
      entries.push({kind:'postflight', installed:ending.seq});
      result = 'COMPLETED';
    }
  } catch (error) {
    reason = error.message;
    if (!(error instanceof EvidenceError)) toolError = error;
  } finally {
    const endpoint = await probe.close();
    if (!endpoint.clean) {
      result = 'INCOMPLETE';
      if (collectionMode === 'qualify' && runnerEvidence) {
        entries.pop();
        runnerEvidence = undefined;
        reason = 'Runner dry qualification did not finish with a clean close';
      } else reason ??= 'Probe did not finish with a clean close';
    } else if (collectionMode === 'qualify' && runnerEvidence) {
      entries.at(-1).runnerProbeExit = {code:endpoint.code,signal:endpoint.signal};
    }
  }
  const logPath = probe.logPath();
  const observed = logPath ? store.reference(`raw/${basename(logPath)}`) :
    store.write('session/unavailable-probe.jsonl', '\n');
  const session = validate('session', {runId, platform:'harmonyos', instanceId, result, reason,
    commands:observed, fixture, chain:sealChain(entries),...(runnerEvidence ? {runner:runnerEvidence} : {})});
  const sessionRef = store.writeJson('session/session.json', session);
  let guestSchedulingTrace;
  if (options.guestSchedulingTrace) {
    const path = 'raw/' + guestSchedulingReceipt;
    const action = entries.find(entry => entry.kind === 'action' && entry.id === 'playback-launch');
    let status = 'NOT_RUN';
    let observation;
    let trace;
    let coverage;
    let cleanup = 'NOT_RUN';
    if (existsSync(join(store.root, path))) {
      try {
        observation = store.reference(path);
        const data = store.json(observation);
        status = data.status;
        cleanup = data.cleanup;
        if (status === 'TRACE_BYTES_SAVED') {
          const artifact = store.reference('raw/' + guestSchedulingTraceFile);
          if (data.targetRef === candidate.targetRef && action &&
            data.dispatch?.commandSeq === action.command && artifact.bytes === data.trace?.bytes &&
            artifact.sha256 === data.trace?.sha256) {
            trace = artifact;
            const events = probeEventsInRange(probe.records.slice(action.floorLog - 1, action.afterLog),
              instanceId, action.beforeSeq, action.afterSeq);
            const {startTimeMs, frames} = guestSchedulingActionWindow(events);
            coverage = guestSchedulingCoverage(store.bytes(trace).toString('utf8'), data.readerPid, startTimeMs, frames);
            status = coverage.status === 'COVERED' ? 'COVERED' : 'TRACE_BYTES_ONLY';
          } else status = 'UNBOUND';
        }
      } catch (_) {
        status = 'UNBOUND';
      }
    }
    const evidence = store.writeJson('session/guest-scheduling.json', {
      status, observation, trace, coverage, cleanup, session:sessionRef, runId, instanceId, caseId:contract.id,
      appBuildId:candidate.appBuildId, buildRunId:candidate.buildRunId, targetRef:candidate.targetRef,
      playbackCommandSeq:action?.command, dispatchLogFloorSeq:action?.floorLog,
    });
    guestSchedulingTrace = { status, cleanup, evidence };
  }
  if (toolError) throw toolError;
  return {store, refs, candidate, session, sessionRef, guestSchedulingTrace};
}
