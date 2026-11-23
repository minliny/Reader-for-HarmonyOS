import { assertAppVersion } from '../../../../scripts/lib/app-build-identity.mjs';
import { EvidenceError, captureRecord, normalReaderWindowRoots, pngSize, sha256 } from '../../../lib/native-ui-evidence.mjs';
import { requireEvidence, validate } from '../../lib/evidence.mjs';
import { equalJson, grabberReversalUnavailable, searchSubmissionSource } from '../../lib/cases.mjs';
import { evaluateSearch, searchSourceRetryVisibility } from '../../lib/search.mjs';
import { assertCombinedFilterResetAction, assertSourceToolsReturnAction } from '../../lib/source.mjs';
import { searchHistoryLoadingCase, searchHistoryLoadingFixture, searchHistoryLoadingSample } from '../../lib/search-entry-history-loading.mjs';
import { assertSearchSourceRetryOpening, canOmitSearchSourceRetry, searchEntrySourceSample,
  searchEntrySourceSampleMatches, searchEntrySourceSampleRead, usesSearchEntrySourceRead } from '../../lib/search-entry-source-read.mjs';
import { emptyBookshelfEntry, readEmptyBookshelfEntry, searchEmptyBookshelfFixture } from '../../lib/search-empty-bookshelf-entry.mjs';
import { capsuleCenterDispatch, clickThenBackArgs, clickThenReaderCenterArgs, crossoverTouchArgs, crossoverTouchTiming,
  searchMorphDispatchWindowMs, uiInputKeyArgument } from '../../lib/control-input.mjs';
import { popupRenderAcknowledged, popupRenderArgs, popupRenderBaselineArgs, popupRenderOperation, preparePopupRender,
  readPopupRender } from '../../lib/popup-render.mjs';
import { ancestorsOf, layoutTapPoint, normalizeHarmonyLayout, selectLayoutNode, sourceGroupOptionsScroll,
  sourceGroupOptionsTail } from '../../lib/layout.mjs';
import {
  prepareReversalDispatch, readReversalReplayArtifact, readSearchGrabberGeometry, reversalCommandArgs,
  reversalReplayTiming, verifyReversalRunnerOutput,
} from './reversal-dispatch.mjs';
import { sourceCategoryCenterTap, sourceCategoryCenterTarget, sourceFilterEdgeTap,
  sourceFilterNativeDispatch, sourceGroupOptionEdgeFixture, sourceGroupSelectedCenterTap } from '../../lib/source-filter-edge.mjs';
import { matchingSourceTransientRetirement, sameSourceTransientStatus, sourceTransientStatusStep } from '../../lib/source-transient-status-text.mjs';
import { sourceFilterSwipeDispatch } from '../../lib/source-filter-scroll.mjs';
import { sourceFilterTextDragDispatch } from '../../lib/source-filter-tail-text.mjs';
import { measureSourceGroupOutside, sourceGroupBackdrop } from '../../lib/source-group-outside.mjs';
import { requestSourceGroupOptionsSwipe, requestSourceGroupOptionsTailTap, requireSourceGroupOptionsCurrent,
  sourceGroupOptionsScrollFixture } from '../../lib/source-group-options-scroll.mjs';
import { sourceQueryEdgeAllowed, sourceQueryEdgeTap, sourceQueryTouchPosition, sourceQueryTouchTap } from '../../lib/source-query-edge.mjs';
import { sourceNativeCenterStep } from '../../lib/source-native-center.mjs';
import { sourceReadRetryTouchPoint, sourceReadRetryTouchStep } from '../../lib/source-read-retry-touch.mjs';
import { sourceControlTouchPoint, sourceControlTouchStep, sourceControlTouchWitness } from '../../lib/source-control-touch.mjs';
import { sourceStatusActionEdgePoint, sourceStatusActionEdgeStep, sourceStatusActionEdgePostToastSample,
  sourceStatusActionEdgeToastRetired } from '../../lib/source-status-action.mjs';
import { sourceUnknownExpandFixture, sourceUnknownToggle, sourceUnknownWriteAction,
  usesSourceUnknownExpand } from '../../lib/source-unknown-expand.mjs';
import { assertSourceRecoveryExpandEdgeState, sourceRecoveryExpandEdgePoint,
  sourceRecoveryExpandEdgeStep } from '../../lib/source-recovery-body.mjs';
import { sourceNativeFocusFixture, sourceNativeFocusKeyReady } from '../../lib/source-native-focus.mjs';
import { publicReservedSourceHost, sourceReservedTypographySample } from '../../lib/source-reserved-typography.mjs';
import { readSourceInlineImportDialog, sourceInlineImportButton, sourceInlineImportCenterStep, sourceInlineImportDialog,
  sourceInlineImportEdgeAllowed, sourceInlineImportEdgeFixture, sourceInlineImportEdgeTap } from '../../lib/source-inline-import-edge.mjs';
import { sourceChromeFixture, sourceChromeStep, sourceChromeTapPoint } from '../../lib/source-chrome-dispatch.mjs';
import { sourceFilterClearAction, sourceFilterClearPoint, sourceFilterClearStep } from '../../lib/source-filter-clear-edge.mjs';
import { requireSourceOfflineDetectState, sourceOfflineDetectButton, sourceOfflineDetectEdgePoint,
  sourceOfflineDetectFixture } from '../../lib/source-offline-detect.mjs';
import { sourceFooterAddButton, sourceLocalImportButton, sourcePickerFixture, sourcePickerGuard, sourcePickerRole,
  sourcePickerTarget } from '../../lib/source-document-picker.mjs';
import { assertSourceToggleEdgeState, sourceToggleEdgeAllowed, sourceToggleEdgeTap, sourceToggleEdgeTarget,
  sourceToggleEdgeCase, sourceToggleTouchFixture, sourceToggleTouchStep, sourceToggleTouchTap } from '../../lib/source-toggle-edge.mjs';
import { directoryImeDispatchWindowMs, directoryImeHideProfile, directoryImeHideTap, observeDirectoryImeHideKey } from '../../lib/directory-ime-key.mjs';
import { imeSearchDispatchWindowMs, imeSearchProfile, imeSearchTap, observeImeSearchKey } from '../../lib/search-ime-key.mjs';
import { assertScreenshotHasContent } from '../../lib/screenshot-evidence.mjs';
import { assertUnlockedFocus, assertVmLockDismissed, classifyFocusWindow, focusWindowCommand,
  vmLockDismissalOperation } from './focus-window.mjs';

export const logCommand = ['shell', 'hilog', '-x', '-T', 'ReaderUIContract'];
export const installedCommand = ['shell', 'bm', 'dump', '-n', 'io.reader.minliny'];
export const startCommand = ['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', 'io.reader.minliny', '-m', 'entry'];
const remoteEmptyShelfStartCommand = [...startCommand, '--ps', 'readerPublicFixture', 'empty-shelf'];
const fragmentLine = /\/ReaderUIContract:\s+RUI1 ([0-9a-f-]{36})\/(\d+)\/(\d+)\/(\d+) (.*)$/u;
const submitId = 'reader-bookshelf-search-submit';
const searchBarId = 'reader-bookshelf-search-bar';
const stopLocatorKind = 'search-active-stop';
const stopLocatorDispatchBudgetMs = 2500;
const sourcePickerDispatchBudgetMs = 2500;
const runnerClockCommand = ['shell', 'date', '+%s'];

export function readProbeEvents(record, selectedInstance) {
  requireEvidence(record?.event === 'command' && record.ok === true && equalJson(record.args, logCommand),
    'App records require the successful UI contract Hilog command');
  const events = new Map();
  for (const line of record.stdout.split(/\r?\n/u)) {
    const match = fragmentLine.exec(line);
    if (!match || (selectedInstance && match[1] !== selectedInstance)) continue;
    const [, instanceId, seq, index, count, value] = match;
    const key = `${instanceId}:${seq}`;
    const fragment = events.get(key) ?? { instanceId, seq: Number(seq), total: Number(count), parts: [], invalid: false };
    if (fragment.total !== Number(count) || Number(index) !== fragment.parts.length || fragment.total < 1 || fragment.total > 512) {
      fragment.invalid = true;
    }
    fragment.parts.push(value);
    events.set(key, fragment);
  }
  const parsed = [];
  for (const { instanceId, seq, total, parts, invalid } of events.values()) {
    if (invalid || parts.length !== total) continue;
    try {
      const event = validate('event', JSON.parse(parts.join('')));
      if (event.instanceId === instanceId && event.eventSeq === seq &&
        event.semanticSeq <= seq && (event.kind === 'window-stable' || event.semanticSeq === seq)) parsed.push(event);
    } catch {
      // A missing piece is detected as a gap when its action window is decoded.
    }
  }
  return parsed;
}

export function latestProbeEvent(record, instanceId) {
  const events = readProbeEvents(record);
  if (!events.length) return null;
  const last = events.at(-1);
  if (instanceId && last.instanceId !== instanceId) throw new EvidenceError('Application instance changed during collection');
  return last;
}

export function checkpoint(record, instanceId) {
  const event = latestProbeEvent(record, instanceId);
  return event?.kind === 'window-stable' ? event : null;
}

export function requirePublicFixtureCheckpoint(event, scope) {
  if (event.kind === 'window-stable') {
    requireEvidence(event.channel === 'probe' && event.payload.publicFixtureScope === scope,
      'The active app checkpoint does not match the admitted public fixture scope');
  }
}

export function probeEventsInRange(records, instanceId, afterSeq, throughSeq, sameEvent = equalJson) {
  const bySequence = new Map();
  for (const record of records) {
    if (record.event !== 'command' || !record.ok || !equalJson(record.args, logCommand)) continue;
    for (const event of readProbeEvents(record, instanceId)) {
      if (event.eventSeq <= afterSeq || event.eventSeq > throughSeq) continue;
      const previous = bySequence.get(event.eventSeq);
      requireEvidence(!previous || sameEvent(previous, event), 'Conflicting app event across probe log polls');
      if (!previous) bySequence.set(event.eventSeq, event);
    }
  }
  return [...bySequence.values()].sort((left, right) => left.eventSeq - right.eventSeq);
}

function sameWindow(start, end) {
  return start.kind === 'window-stable' && end.kind === 'window-stable' &&
    start.instanceId === end.instanceId && start.eventSeq <= end.eventSeq && start.deviceMonoMs <= end.deviceMonoMs &&
    start.windowRevision === end.windowRevision &&
    start.windowRevision === start.payload.report?.metrics?.revision &&
    end.windowRevision === end.payload.report?.metrics?.revision &&
    start.payload.publicFixtureScope === end.payload.publicFixtureScope &&
    start.payload.windowId === end.payload.windowId &&
    start.payload.orientation === end.payload.orientation &&
    equalJson(start.payload.report?.metrics, end.payload.report?.metrics);
}

export function windowStable(start, end) {
  return sameWindow(start, end) && start.eventSeq < end.eventSeq && start.deviceMonoMs < end.deviceMonoMs &&
    start.semanticSeq === end.semanticSeq;
}

export function sourceTransientWindowStable(start,end,events,scope,canRetire) {
  const transient = events.find(event=>event.kind !== 'window-stable');
  return sameWindow(start,end) && start.eventSeq < end.eventSeq && start.deviceMonoMs < end.deviceMonoMs &&
    events.length === end.eventSeq - start.eventSeq &&
    events.every((event,index)=>event.eventSeq === start.eventSeq+index+1 && event.instanceId === start.instanceId &&
      event.windowRevision === start.windowRevision && (event.kind === 'window-stable' ?
        event.channel === 'probe' && sameWindow(start,event) :
        canRetire ? canRetire(event) : sameSourceTransientStatus(transient,event,scope))) &&
    followsSemanticSequence(start,events) && events.at(-1)?.semanticSeq === end.semanticSeq;
}

export function stableNativeFontReadback(before, after) {
  const measured = report => {
    const {vpPixels, fpPixels, followsSystemFontScale, maxFontScale} = report ?? {};
    if (![vpPixels, fpPixels].every(value => Number.isFinite(value) && value > 0) ||
        typeof followsSystemFontScale !== 'boolean') return undefined;
    return {vpPixels, fpPixels, followsSystemFontScale,
      maxFontScale:Number.isFinite(maxFontScale) && maxFontScale > 0 ? maxFontScale : null};
  };
  const start = measured(before);
  const end = measured(after);
  if (!start || !end || !equalJson(start, end)) return undefined;
  return {...end,effectiveScale:end.fpPixels / end.vpPixels};
}

export function followsSemanticSequence(previous, events) {
  let sequence = previous.semanticSeq;
  let uptime = previous.deviceMonoMs;
  for (const event of events) {
    if (event.deviceMonoMs < uptime) return false;
    if (event.kind !== 'window-stable') sequence = event.eventSeq;
    if (event.semanticSeq !== sequence) return false;
    uptime = event.deviceMonoMs;
  }
  return true;
}

export function requireCommand(records, seq, args) {
  const command = records[seq - 1];
  requireEvidence(command?.event === 'command' && command.ok === true && equalJson(command.args, args),
    `Unexpected command at probe sequence ${seq}`);
  return command;
}

export function requirePopupRenderPreflight(records, seq, input) {
  const command = requireCommand(records,seq,popupRenderBaselineArgs);
  requireEvidence(command.status === 0 && command.signal === null && command.error === null && command.stderr === '',
    'More Popup pre-action RenderService baseline did not finish cleanly');
  const baseline = preparePopupRender(command.stdout,input);
  requireEvidence(baseline.operation,baseline.reason);
  return baseline;
}

export function requireActionDispatch(records, seq, operation) {
  if (operation.op === 'popupRenderOpen' || operation.op === 'popupRenderClose') {
    const command = requireCommand(records,seq,popupRenderArgs(operation));
    requireEvidence(command.status === 0 && command.signal === null && command.error === null &&
      command.stderr === '' && popupRenderAcknowledged(command.stdout), 'More Popup input lacks the native dispatch receipt');
    return command;
  }
  if (operation.op === 'grabberReversal') {
    const command = requireCommand(records,seq,reversalCommandArgs(operation));
    return verifyReversalRunnerOutput(command,seq,operation);
  }
  if (operation.op === 'timedCrossover') {
    const command = requireCommand(records,seq,actionArgs(operation));
    requireEvidence(command.status === 0 && command.signal === null && command.error === null &&
      typeof command.stderr === 'string' && command.stderr.trim() === '', 'Timed grabber crossover did not finish cleanly');
    return command;
  }
  const readerCenter = operation.op === 'clickThenReaderCenter';
  if (operation.op !== 'clickThenBack' && !readerCenter) return requireCommand(records, seq, actionArgs(operation));
  const pair = records[seq - 1];
  const expected = readerCenter ? clickThenReaderCenterArgs(operation) : clickThenBackArgs(operation);
  const commands = [pair?.click, readerCenter ? pair?.center : pair?.back];
  requireEvidence(pair?.event === (readerCenter ? 'click-then-reader-center' : 'click-then-back') && pair.seq === seq && pair.ok === true &&
    pair.reason === null && commands.every((command, index) => command?.status === 0 &&
      command.signal === null && command.error === null && equalJson(command.args, expected[index]) &&
      Number.isFinite(command.hostStartMs) && command.hostStartMs >= 0 &&
      Number.isFinite(command.elapsedMs) && command.elapsedMs >= 0 && Number.isFinite(Date.parse(command.startedAt))),
  `Invalid click and normal ${readerCenter ? 'reader center' : 'Back'} receipts at probe sequence ${seq}`);
  const [click, followup] = commands;
  const dispatchGapMs = followup.hostStartMs - click.hostStartMs;
  const [earliest,latest] = readerCenter ? [capsuleCenterDispatch.earliestMs,capsuleCenterDispatch.latestMs] : [0,searchMorphDispatchWindowMs];
  requireEvidence(dispatchGapMs >= click.elapsedMs && dispatchGapMs >= earliest && dispatchGapMs < latest &&
    Date.parse(click.startedAt) <= Date.parse(followup.startedAt) && Date.parse(followup.startedAt) <= Date.parse(pair.recordedAt),
  readerCenter ? 'Reader center dispatch was out of sequence or outside the launch host window' :
    'Normal Back dispatch was out of sequence or outside the Search morph host window');
  return { dispatchGapMs, probeSeq: seq };
}

export function validateInstalledMetadata(installed, subject) {
  const digestFields = ['appIdSha256', 'appIdentifierSha256'];
  requireEvidence(installed?.bundlePresent === true && installed.bundleName === 'io.reader.minliny' &&
    digestFields.every(key => typeof installed[key] === 'string' && /^[0-9a-f]{64}$/u.test(installed[key])) &&
    Number.isSafeInteger(installed.updateTime) && installed.updateTime > 0 &&
    ['arm64-v8a', 'x86_64'].includes(installed.cpuAbi) && ['debug', 'release'].includes(installed.appProvisionType),
  `${subject} is missing complete bundle, signing, ABI, or update identity`);
}

export function assertInstalled(identityRecord, candidate) {
  const installed = identityRecord.installed;
  validateInstalledMetadata(candidate.postInstall, 'Deployment');
  validateInstalledMetadata(installed, 'Current installed candidate');
  assertAppVersion(candidate.expectedVersion, installed.appVersion, 'Live candidate');
  for (const field of ['appIdSha256','appIdentifierSha256','updateTime','cpuAbi','appProvisionType']) {
    requireEvidence(installed[field] === candidate.postInstall[field], `Installed candidate ${field} changed after deployment`);
  }
}

export const remoteUiCaseIds = Object.freeze([
  'reading.control-tts-launch-quick',
  'reading.control-tts-launch-full',
  'reading.control-tts-capsule-handoff',
  'reading.control-tts-capsule-handoff-full',
  'reading.control-more-popup',
]);

export function remoteUiCollectionCase(contract) {
  return contract?.phase === 1 && remoteUiCaseIds.includes(contract.id);
}

export function remoteEmptyShelfFixture(candidate, contract, scope) {
  return scope === 'empty-shelf' && candidate.targetKind === 'vm' && candidate.vmLocation === 'remote' &&
    candidate.hdcServer === '192.168.1.10:8710' && remoteUiCollectionCase(contract);
}

function digestPresent(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

// The delivery and probe gates validate each observation's time series.
// Compare their boot witnesses without assuming a shared host clock origin.
function guestBootStart(readiness) {
  const witness = readiness.vmGuestBootWitness;
  const first = witness?.samples?.[0];
  if (witness?.version !== 1 || !Array.isArray(witness.samples) || witness.samples.length !== 2 ||
    !Number.isSafeInteger(first?.bootStart) || first.bootStart <= 0 || !digestPresent(witness.milestonesSha256) ||
    !witness.samples.every(sample => Number.isSafeInteger(sample?.bootStart) &&
      Math.abs(sample.bootStart - first.bootStart) <= 1000 && Array.isArray(sample.milestones) &&
      sample.milestones.length > 0 && sha256(JSON.stringify(sample.milestones)) === witness.milestonesSha256) ||
    sha256(JSON.stringify([first.bootStart, first.milestones])) !== readiness.bootIdSha256) return undefined;
  return first.bootStart;
}

export function remoteGuestReady(readiness) {
  return readiness?.status === 'PASS' && readiness.bootCompleted === true && readiness.sceneBoardStable === true &&
    readiness.evidenceScope === 'guest-only' && readiness.emulatorLog?.status === 'NOT_PROVIDED' &&
    digestPresent(readiness.bootIdSha256) && digestPresent(readiness.sceneBoardPidSha256) &&
    Number.isFinite(readiness.observationMs) && readiness.observationMs >= 2000 && readiness.observationMs <= 10_000 &&
    (readiness.bootIdentitySource === 'kernel-boot-id' && readiness.uptimeSource === 'procfs' ||
      readiness.bootIdentitySource === 'vm-guest-boot-milestones-v1' && readiness.uptimeSource === 'toybox-sysinfo' &&
      guestBootStart(readiness) !== undefined);
}

export function assertRemoteCollectionReadiness(readiness, candidate, contract) {
  const deployed = candidate.remoteGuestReadiness;
  requireEvidence(remoteUiCollectionCase(contract) && candidate.targetKind === 'vm' &&
    candidate.hdcServer === '192.168.1.10:8710' && candidate.postInstall?.cpuAbi === 'x86_64' &&
    readiness?.event === 'readiness' && readiness.vmLocation === 'remote' && readiness.exactConnected === true &&
    readiness.targetRef === candidate.targetRef && readiness.hdcServer === candidate.hdcServer && readiness.targetKind === 'vm' &&
    remoteGuestReady(deployed) && remoteGuestReady(readiness), 'Unverified exact remote VM or guest-only readiness');
  const sameBoot = readiness.bootIdentitySource === 'kernel-boot-id' ?
    readiness.bootIdSha256 === deployed.bootIdSha256 :
    readiness.vmGuestBootWitness.milestonesSha256 === deployed.vmGuestBootWitness?.milestonesSha256 &&
      Math.abs(guestBootStart(readiness) - guestBootStart(deployed)) <= 1000;
  requireEvidence(sameBoot && readiness.bootIdentitySource === deployed.bootIdentitySource &&
    readiness.sceneBoardPidSha256 === deployed.sceneBoardPidSha256,
  'Remote VM boot or SceneBoard changed since the preserve-data deployment');
}

function onlyLogPolls(records, start, end) {
  return records.slice(start, end - 1).every(record => record.ok === true && equalJson(record.args, logCommand));
}

export function verifyStartupFocus(records, entry, candidate) {
  const legacy = entry.baselineLog === 4;
  const commandOrder = entry.kind === 'preflight' && entry.readiness === 2 && entry.installed === 3 &&
    entry.start === entry.baselineLog + 1 && entry.startFloor === entry.start + (legacy ? 1 : 2) &&
    entry.startFloor < entry.initialLog && onlyLogPolls(records, entry.startFloor, entry.initialLog);
  requireEvidence(commandOrder, 'Missing ordered boot, identity and normal startup');
  if (legacy) return false;

  const before = requireCommand(records, entry.installed + 1, focusWindowCommand);
  if (classifyFocusWindow(before.stdout) === 'LOCKED') {
    requireEvidence(candidate.targetKind === 'vm' && candidate.hdcServer === '127.0.0.1:8710' &&
      candidate.targetRef === sha256('127.0.0.1:5555').slice(0, 12) && entry.baselineLog === 7,
    'The recorded lock-screen dismissal must belong to the admitted local VM before startup');
    requireActionDispatch(records, entry.installed + 2, vmLockDismissalOperation(before.stdout));
    assertVmLockDismissed(requireCommand(records, entry.installed + 3, focusWindowCommand).stdout);
  } else {
    requireEvidence(entry.baselineLog === 5, 'Unexpected commands between installed identity and startup');
    assertUnlockedFocus(before.stdout, 'before-launch');
  }
  assertUnlockedFocus(requireCommand(records, entry.start + 1, focusWindowCommand).stdout, 'after-launch');
  return true;
}

export function requireActionFocus(records, prior, guarded, stage) {
  if (!guarded) return prior;
  const focusSeq = prior + 1;
  assertUnlockedFocus(requireCommand(records, focusSeq, focusWindowCommand).stdout, stage);
  return focusSeq;
}

function partialMotionHeader(polls, instanceId, seq) {
  const parts = new Map();
  let count;
  for (const poll of polls) {
    let previousIndex = -1;
    for (const line of poll.stdout.split(/\r?\n/u)) {
      const match = fragmentLine.exec(line);
      if (!match || match[1] !== instanceId || Number(match[2]) !== seq) continue;
      const index = Number(match[3]);
      const total = Number(match[4]);
      const value = match[5];
      count ??= total;
      if (total !== count || count < 2 || count > 512 || index >= count || index <= previousIndex ||
          (parts.has(index) && parts.get(index) !== value)) return null;
      parts.set(index, value);
      previousIndex = index;
    }
  }
  let prefix = '';
  for (let index = 0; parts.has(index) && !prefix.includes(',"frames":['); index += 1) prefix += parts.get(index);
  const frames = prefix.indexOf(',"frames":[');
  if (frames < 0 || parts.size >= count) return null;
  try {
    // Decode only the complete header. Retained frame fragments are never
    // turned into a motion event or passed to a behavior evaluator.
    const header = validate('event', JSON.parse(prefix.slice(0, frames) + '}}'));
    if (header.instanceId === instanceId && header.eventSeq === seq && header.semanticSeq === seq &&
        header.kind === 'reading.control-motion' && header.channel === 'motion') {
      return { header, count, available: parts.size };
    }
  } catch {
    return null;
  }
  return null;
}

function bindsPartialMotionBlock(header, events, direction) {
  const requests = events.filter(event => event.kind === 'reading.control-requested' && event.channel === 'business');
  const commits = events.filter(event => event.kind === 'reading.control-committed' && event.channel === 'business');
  if (requests.length !== 1 || commits.length !== 1) return false;
  const [request] = requests;
  const [commit] = commits;
  const { readingId, transitionId, accepted } = request.payload;
  const epoch = accepted?.epoch;
  if (typeof readingId !== 'string' || !readingId || typeof transitionId !== 'string' || !transitionId ||
      !Number.isSafeInteger(epoch) || request.payload.direction !== direction ||
      commit.eventSeq <= request.eventSeq || commit.payload.direction !== direction ||
      commit.payload.readingId !== readingId || commit.payload.transitionId !== transitionId || commit.payload.state?.epoch !== epoch) return false;
  const blocks = events.filter(event => event.kind === 'reading.control-motion' && event.channel === 'motion');
  blocks.push(header);
  blocks.sort((a, b) => a.eventSeq - b.eventSeq);
  return blocks.length >= 2 && blocks.length <= 72 && blocks[0].eventSeq > commit.eventSeq &&
    blocks.every(({payload}, index) => payload.readingId === readingId && payload.transitionId === transitionId &&
      payload.epoch === epoch && payload.direction === direction &&
      payload.blockIndex === index && payload.blockCount === blocks.length &&
      payload.frameStart === index && payload.frameEnd === index && payload.endReason === 'completed' &&
      payload.droppedSamples === 0);
}

function bindsPhase1PartialMotion(header, events) {
  const payload = header.payload;
  const { transitionId, epoch, direction, blockIndex, blockCount } = payload;
  if (typeof transitionId !== 'string' || !Number.isSafeInteger(epoch) ||
      !['open','navigate','morph','dismiss'].includes(direction) || !Number.isInteger(blockIndex) ||
      !Number.isInteger(blockCount) || blockCount < 1 || blockIndex < 0 || blockIndex >= blockCount) return false;
  return events.some(event => event.channel === 'business' && event.eventSeq < header.eventSeq &&
    event.kind === 'reading.control-transition-requested' && event.payload.transitionId === transitionId &&
    (event.payload.epoch ?? event.payload.accepted?.epoch) === epoch && event.payload.direction === direction);
}

function eventSlice(records, entry, session, from, direction, scopedCase, phase1Motion, beforePollEnd = entry.beforeLog) {
  const before = checkpoint(requireCommand(records, entry.beforeLog, logCommand), session.instanceId);
  const floor = latestProbeEvent(requireCommand(records, entry.floorLog, logCommand), session.instanceId);
  const endLog = requireCommand(records, entry.afterLog, logCommand);
  const after = checkpoint(endLog, session.instanceId);
  requireEvidence(before && after && before.eventSeq === entry.beforeSeq && after.eventSeq === entry.afterSeq &&
    before.eventSeq < after.eventSeq && after.deviceMonoMs >= before.deviceMonoMs &&
    entry.beforeLog > from && entry.beforeLog < entry.floorLog && entry.floorLog < entry.afterLog &&
    floor && floor.eventSeq >= before.eventSeq && floor.eventSeq < after.eventSeq &&
    onlyLogPolls(records, from, beforePollEnd) && onlyLogPolls(records, entry.floorLog, entry.afterLog),
  'Broken action or sample observation interval');
  const polls = records.slice(entry.floorLog - 1, entry.afterLog);
  const events = probeEventsInRange(polls, session.instanceId, before.eventSeq, after.eventSeq);
  const length = after.eventSeq - before.eventSeq;
  const chronologyError = 'Missing or out-of-order app event in the selected action or sample interval';
  let partial;
  let chronology = events;
  if (events.length !== length) {
    requireEvidence((direction || phase1Motion) && events.length === length - 1, chronologyError);
    const offset = events.findIndex((event, index) => event.eventSeq !== before.eventSeq + index + 1);
    requireEvidence(offset >= 0, chronologyError);
    partial = partialMotionHeader(polls, session.instanceId, before.eventSeq + offset + 1);
    requireEvidence(partial && (phase1Motion ? bindsPhase1PartialMotion(partial.header, events) :
      bindsPartialMotionBlock(partial.header, events, direction)), chronologyError);
    chronology = [...events.slice(0, offset), partial.header, ...events.slice(offset)];
  }
  requireEvidence(chronology.every((event, i) => event.eventSeq === before.eventSeq + i + 1 &&
      event.deviceMonoMs >= (chronology[i - 1]?.deviceMonoMs ?? before.deviceMonoMs)), chronologyError);
  if (scopedCase) requireEvidence(followsSemanticSequence(before, chronology), 'Window heartbeat omits an intervening semantic event');
  return { before, after, events, partial };
}

const nodeVisible = (layout, id) => layout.nodes.some(node => (node.id === id || node.alias === id) &&
  node.visible === true && node.opacity > 0);

const nonnegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
const sameFields = (left, right, keys) => keys.every(key => left[key] === right[key]);
const searchOwnerFields = ['owner','page','queryRevision'];
const searchRouteFields = ['identity','navigation','mounting','queryRevision'];
const anchorFields = ['anchorIndex','anchorOffset','anchorItemY','anchorAtStart','anchorMatchesRestore'];

function stopProjection(event) {
  const p = event?.payload;
  return event?.kind === 'search-page-projection' && event.channel === 'business' &&
    [...searchOwnerFields,'operationGeneration','publicationRevision','resultCount','visibleCount',
      'incompleteCount','failedCount','skippedCount','historyCount'].every(key => nonnegativeInteger(p[key])) &&
    p.owner > 0 && p.page > 0 && p.resultCount > 0 && p.visibleCount <= p.resultCount &&
    p.viewportId === `reader-search-result-list:${p.page}:${p.queryRevision}` &&
    p.projection === 'results' && p.operation === 'partial' && p.searchActive === true && p.stopped === false &&
    ['localFailed','sourceListFailed','moreSources'].every(key => typeof p[key] === 'boolean') ? p : null;
}

function originalAnchor(event, projection) {
  const p = event?.payload;
  return event?.kind === 'search-page-anchor' && event.channel === 'business' && p.action === 'anchor-restored' &&
    sameFields(p, projection, searchOwnerFields) && nonnegativeInteger(p.anchorIndex) &&
    Number.isFinite(p.anchorOffset) && Number.isFinite(p.anchorItemY) &&
    typeof p.anchorAtStart === 'boolean' && typeof p.anchorMatchesRestore === 'boolean' ? p : null;
}

function activeSearchAttempt(event, projection, session) {
  const p = event?.payload;
  return event?.kind === 'search-online-attempt' && event.channel === 'business' &&
    p.trigger === 'initial' && ['started','settled'].includes(p.stage) &&
    p.generation === projection.operationGeneration && p.session === session &&
    p.queryRevision === projection.queryRevision && p.requestedPage === 1 &&
    nonnegativeInteger(p.sourceCount) && p.sourceCount > 0 && nonnegativeInteger(p.sourceOrdinal) &&
    p.sourceOrdinal < p.sourceCount &&
    (p.stage === 'started' || ['completed','failed'].includes(p.outcome));
}

function advanceStopLocator(state, end, events) {
  const { checkpoint: start, anchor } = state;
  const keyboard = end.payload.report?.metrics?.keyboardArea;
  requireEvidence(sameWindow(start, end) && keyboard?.available === true && keyboard.visible === false &&
    events.length === end.eventSeq - start.eventSeq && events.every((event, index) =>
      event.eventSeq === start.eventSeq + index + 1 && event.instanceId === start.instanceId && event.windowRevision === start.windowRevision) &&
    followsSemanticSequence(start, events), 'Active Stop locator lost its current window, keyboard, or ordered owner evidence');
  let projected = state.projection;
  for (const event of events) {
    const p = event.payload;
    if (event.kind === 'window-stable') {
      requireEvidence(event.channel === 'probe' && sameWindow(start,event), 'Window changed during the active Stop locator');
    } else if (event.kind === 'search-page-projection') {
      const current = stopProjection(event);
      requireEvidence(current && sameFields(current, projected, [...searchOwnerFields,'operationGeneration','viewportId']) &&
        current.publicationRevision >= projected.publicationRevision,
      'The active Stop locator saw a different search owner, operation, or viewport');
      projected = current;
    } else if (event.kind === 'search-result-projection') {
      requireEvidence(event.channel === 'business' && sameFields(p, projected, [...searchOwnerFields,'viewportId','publicationRevision']) &&
        p.state === 'results' && p.searchActive === true, 'The active Stop locator saw a stale or mismatched result projection');
    } else if (event.kind === 'search-page-anchor') {
      const current = originalAnchor(event, projected);
      requireEvidence(current && sameFields(current, anchor, anchorFields), 'The native search viewport anchor moved during the Stop locator');
    } else if (event.kind === 'search-online-attempt') {
      requireEvidence(activeSearchAttempt(event, projected, state.onlineSession),
        'The active Stop locator saw a search attempt outside the current operation scope');
    } else {
      throw new EvidenceError(`Unexpected ${event.kind} during the active Stop locator`);
    }
  }
  return { ...state, checkpoint:end, projection:projected };
}

export function activeStopLocatorState(events, submit, before, after) {
  const source = searchSubmissionSource(submit);
  const inAction = events.filter(event => event.eventSeq > submit?.beforeSeq && event.eventSeq <= submit.afterSeq &&
    event.instanceId === before.instanceId);
  const submitted = inAction.filter(event => event.kind === 'search-submit-accepted' && event.channel === 'business');
  const intents = inAction.filter(event => event.kind === `search-${source}-intent` && event.channel === 'input');
  const receipt = submitted[0]?.payload;
  const intent = intents[0]?.payload;
  requireEvidence(source && submitted.length === 1 && intents.length === 1 && intents[0].eventSeq < submitted[0].eventSeq &&
    intent.semantic === 'search' && intent.enabled === true && intent.owner === receipt.previousOwner &&
    intent.navigation === receipt.previousNavigation && sameFields(intent, receipt, ['identity','mounting']) &&
    before.eventSeq >= submit.afterSeq && searchRouteFields.every(key => nonnegativeInteger(receipt[key])) &&
    nonnegativeInteger(receipt.writeLease?.generation) && nonnegativeInteger(receipt.writeLease.session) &&
    receipt.writeLease.active === true,
  'Active Stop locator has no uniquely accepted active submit');
  const prior = events.filter(event => event.eventSeq > submitted[0].eventSeq && event.eventSeq <= before.eventSeq);
  const surface = prior.findLast(event => event.kind === 'search-surface-settled' && event.channel === 'business');
  const businessProjection = prior.findLast(event => event.kind === 'search-page-projection');
  const projection = stopProjection(businessProjection);
  const anchor = projection && originalAnchor(prior.findLast(event => event.kind === 'search-page-anchor'), projection);
  requireEvidence(surface?.payload.mode === 'results' && sameFields(surface.payload, receipt, searchRouteFields) &&
    projection && projection.owner === surface.payload.owner && projection.queryRevision === receipt.queryRevision &&
    projection.operationGeneration === receipt.writeLease.generation && anchor,
  'Active Stop locator has no matching settled surface, active viewport, and measured anchor');
  return advanceStopLocator({checkpoint:before,projection,anchor,acceptedSeq:submitted[0].eventSeq,
    onlineSession:receipt.writeLease.session}, after,
    events.filter(event => event.eventSeq > before.eventSeq && event.eventSeq <= after.eventSeq));
}

export function sourceRowActionsSample(caseId, fixture, step) {
  if (fixture?.id !== 'public-source-row-action-targets-v1' || step?.kind !== 'sample' ||
    !step.anchors?.includes('reader-source-row-login-control')) return false;
  return (caseId === 'source-management.row-action-targets' && step.id === 'source-ready') ||
    (['source-management.row-login-touch-center','source-management.row-login-touch-edge'].includes(caseId) &&
      step.id === 'row-baseline');
}

export function normalizeSample({ store, records, entry, before, after, refs, caseId, fixture, step, causalAction }) {
  let stopLocator;
  const transient = sourceTransientStatusStep(fixture,step);
  if (step?.captureGuard === stopLocatorKind) {
    requireEvidence(entry.kind === 'locate' && !entry.screenshot && causalAction?.beforeLog,
      'Active Stop locator must be a targeted tree-only capture');
    const events = probeEventsInRange(records.slice(causalAction.beforeLog - 1, entry.afterLog), before.instanceId,
      causalAction.beforeSeq, after.eventSeq);
    stopLocator = activeStopLocatorState(events, causalAction, before, after);
  } else if (transient) {
    const changes = probeEventsInRange(records.slice(entry.floorLog-1,entry.afterLog),
      before.instanceId,before.eventSeq,after.eventSeq);
    requireEvidence(sourceTransientWindowStable(before,after,changes,transient.scope),
      `Source transient capture changed its window or another Source state: ${entry.id}`);
  } else {
    requireEvidence(windowStable(before, after), `Capture changed window, instance, semantic state or revision: ${entry.id}`);
  }
  const bounds = { first: entry.beforeLog, last: entry.floorLog - 1 };
  const screenshot = entry.screenshot ? captureRecord(records, entry.screenshot, store.bytes(entry.screenshot), 'screenCap', bounds) : null;
  const layout = captureRecord(records, entry.layout, store.bytes(entry.layout), 'dumpLayout', bounds);
  if (transient)
    requireEvidence(screenshot && layout.capture < screenshot.capture && screenshot.capture < layout.entry-1,
      'Source transient capture requires native tree and screenshot before transfers');
  const captureInterval = records.slice(entry.beforeLog, entry.floorLog - 1);
  requireEvidence(captureInterval.length === (screenshot ? 6 : 3) && captureInterval.every(record => record.event === 'capture-integrity' ||
    (record.event === 'command' && record.ok && (
      /^(screenCap|dumpLayout)$/.test(record.args?.[2] ?? '') && record.args?.slice(0, 2).join(' ') === 'shell uitest' ||
      record.args?.slice(0, 2).join(' ') === 'file recv'
    ))), 'A noncapture operation split one stable sample');
  const tree = JSON.parse(layout.bytes);
  const content = normalizeHarmonyLayout({
    tree, report: after.payload.report, sampleId: entry.id, state: entry.id,
    instanceId: after.instanceId, windowId: after.payload.windowId,
    publicBookTitle: fixture?.bookTitle,
    publicBookTitles: fixture?.bookTitles,
    publicOnlineResultTitles: step?.id === 'results-a' || (step?.id === 'retried' && fixture?.onlineResultTitles?.recovery) ?
      fixture?.onlineResultTitles : undefined,
    publicHistoryWord: step?.anchors.includes('reader-search-history-public-item-0') ? fixture?.inputs?.a : undefined,
    observeSearchTaskSheet: step?.anchors.includes('reader-search-task-sheet'),
    observeSearchTaskRetry: step?.anchors.some(id => ['reader-search-task-retry','reader-search-task-sheet'].includes(id)),
    observeSearchConfirmedEmpty: fixture?.id === 'public-search-locally-confirmed-empty-v3' &&
      (step?.id === 'results-b' || step?.id === 'rerun-settled'),
    observeSearchUnconfirmedEmpty: fixture?.id === 'public-search-unconfirmed-empty-v3' && step?.id === 'results-b',
    observeSearchHistoryLoading: fixture?.id === searchHistoryLoadingFixture && step?.id === searchHistoryLoadingSample,
    observeReadingSearchResults: fixture?.id === 'public-local-reading-search-result-v1',
    observeQuickAutoPageSpeed: fixture?.id === 'public-local-reading-v1' && step?.anchors.some(
      id => /^reader-auto-speed-current-(?:[89]|1[012])$/u.test(id)),
    observeSourceRowActions: sourceRowActionsSample(caseId,fixture,step),
    observeSourceUnknownWriteToggle: fixture?.id === sourceUnknownExpandFixture && step?.id === 'source-ready',
    sourceToggleCheckedWrapper: caseId === sourceToggleEdgeCase && fixture?.id === sourceToggleTouchFixture &&
      step?.kind === 'sample' && step.anchors.includes(sourceToggleEdgeTarget) ? sourceToggleEdgeTarget : undefined,
    observeSourceDefaultFontToggle: fixture?.id === 'public-source-default-font-v3' && step?.id === 'source-ready' ||
      sourceReservedTypographySample(fixture,step),
    publicReservedSourceQuery: sourceReservedTypographySample(fixture,step) ? publicReservedSourceHost : undefined,
    observeSourceGroupOptionsScroll: fixture?.id === sourceGroupOptionsScrollFixture && step?.kind === 'sample',
    observeSourceTransientStatus: transient?.scope,
    observeSourceGroupOptionsText: fixture?.id === sourceGroupOptionsScrollFixture && step?.waitFor?.some(item=>
      item.kind === 'source.surface-text-layout' && item.fields?.['payload.scope'] === 'group-menu'),
    observeSourceOfflineDetect: fixture?.id === sourceOfflineDetectFixture && step?.kind === 'sample',
    observeSourceInlineImportDialog: [sourceInlineImportEdgeFixture,sourceChromeFixture].includes(fixture?.id) && step?.kind === 'sample',
    observeSourceNativeFocus: fixture?.id === sourceNativeFocusFixture && step?.kind === 'sample',
    publicSourceToolsQuery: fixture?.id === 'public-source-tools-return-v2' ? fixture.inputs?.['public-source-prefix'] : undefined,
    observeSourceRead: step?.anchors.some(id => id === 'reader-source-loading-progress' ||
      id === 'reader-source-read-failure-title' || id === 'reader-source-recovery-message') ||
      step?.waitFor?.some(predicate => predicate.kind === 'source.read-retry'),
    evidenceRefs: [entry.screenshot, entry.layout, ...refs].filter(Boolean),
  });
  if (step?.captureGuard === sourcePickerGuard) {
    const role = step.anchors.length === 1 ? sourcePickerRole(step.anchors[0]) : undefined;
    requireEvidence(entry.kind === 'locate' && !screenshot && role && fixture?.publicDocument &&
      content.window.keyboard?.visible === false, 'System picker requires a target-scoped tree locator with IME hidden');
    const root = normalReaderWindowRoots(tree).find(node => String(node.attributes.hostWindowId) === content.window.id);
    const sourcePicker = sourcePickerTarget(tree, {
      windowId:content.window.id, displayId:root?.attributes.displayId, fileName:fixture.publicDocument.basename,
    }, role);
    return {instanceId:content.instanceId,window:content.window,evidenceRefs:content.evidenceRefs,
      captureComplete:false,beforeSeq:before.eventSeq,afterSeq:after.eventSeq,semanticSeq:after.semanticSeq,
      hostBeginMs:entry.hostBeginMs,hostEndMs:entry.hostEndMs,pickerCheckpoint:after,sourcePicker};
  }
  if (fixture?.id === sourcePickerFixture && step?.id === 'source-before-import') {
    const buttons = content.nodes.filter(node => node.type === 'Button' &&
      /^source-back:[1-9]\d*:import:footer$/u.test(node.id ?? '') &&
      ancestorsOf(content,node).some(parent => parent.id === 'reader-source-footer'));
    if (buttons.length === 1) buttons[0].alias = sourceFooterAddButton;
  }
  if (fixture?.id === sourcePickerFixture && step?.id === 'import-dialog') {
    const buttons = content.nodes.filter(node => {
      const scope = /^(reader-json-import:[1-9]\d*):local$/u.exec(node.id ?? '')?.[1];
      return node.type === 'Button' && scope && ancestorsOf(content,node).some(parent => parent.id === scope);
    });
    if (buttons.length === 1) buttons[0].alias = sourceLocalImportButton;
  }
  if (content.sourceInlineImportDialogObserved === true) {
    const dialog = readSourceInlineImportDialog({...content,captureComplete:Boolean(screenshot)});
    if (dialog.verdict === 'PASS' && dialog.actual.state === 'present')
      content.nodes.find(node=>node.path === dialog.actual.dialogPath).alias = sourceInlineImportDialog;
  }
  const image = screenshot && pngSize(screenshot.bytes);
  requireEvidence((!image || content.window.displayRectPx?.width === image.width && content.window.displayRectPx?.height === image.height) &&
    content.window.orientation === after.payload.orientation,
  'Native screenshot, tree and window metrics do not describe the same display');
  if (screenshot) assertScreenshotHasContent(screenshot.bytes, entry.id);
  const fontScale = after.payload.report?.metrics?.systemFontScale;
  if (Number.isFinite(fontScale) && fontScale > 0) content.window.fontScale = fontScale;
  const nativeFont = stableNativeFontReadback(before.payload.report, after.payload.report);
  if (nativeFont) content.window.nativeFont = nativeFont;
  const imeSearchKey = step?.nativeImeKey === imeSearchProfile ?
    observeImeSearchKey({sample:content, tree, screenshot:screenshot?.bytes}) : undefined;
  const imeHideKey = step?.nativeImeKey === directoryImeHideProfile ?
    observeDirectoryImeHideKey({sample:content, tree}) : undefined;
  if (stopLocator) {
    const pill = selectLayoutNode(content, {id:submitId, ancestors:[searchBarId]});
    const publicResultId = step.anchors.find(id => id === 'reader-search-public-local-result' || id === 'reader-search-public-local-result-b');
    const publicResult = selectLayoutNode(content, {id:publicResultId, ancestors:[stopLocator.projection.viewportId]});
    requireEvidence(pill.searchSemantic === 'stop' && pill.enabled === true && pill.clickable === true &&
      nodeVisible(content, submitId) && nodeVisible(content, publicResultId), 'Current native results do not expose the scoped Stop pill and public local row');
    layoutTapPoint(pill);
    stopLocator.pillPath = pill.path;
    stopLocator.publicResultId = publicResultId;
    stopLocator.publicResultPath = publicResult.path;
    stopLocator.publicResultNode = publicResult;
    stopLocator.viewportPath = selectLayoutNode(content, stopLocator.projection.viewportId).path;
  }
  return { ...content, captureComplete:Boolean(screenshot),
    beforeSeq: before.eventSeq, afterSeq: after.eventSeq, semanticSeq: after.semanticSeq,
    ...(transient ? {sourceTransientStatusCapture:{scope:transient.scope,before,after}} : {}),
    hostBeginMs: entry.hostBeginMs, hostEndMs: entry.hostEndMs, ...(stopLocator ? {stopLocator} : {}),
    ...(imeSearchKey ? {imeSearchKey, imeSearchCheckpoint:after} : {}),
    ...(imeHideKey ? {imeHideKey, imeHideCheckpoint:after} : {}) };
}

export function assertCurrentActionState(step, sample, mark, events = []) {
  if (sample?.stopLocator) {
    const start = sample.stopLocator.checkpoint;
    requireEvidence(step.op === 'click' && step.target === submitId && step.buttonSemantic === 'stop' &&
      mark.deviceMonoMs - start.deviceMonoMs <= stopLocatorDispatchBudgetMs, `Expired or incompatible Stop locator before ${step.id}`);
    return advanceStopLocator(sample.stopLocator, mark,
      events.filter(event => event.eventSeq > start.eventSeq && event.eventSeq <= mark.eventSeq));
  }
  const transient = sample?.sourceTransientStatusCapture;
  const retiredToast = transient?.scope === 'operation-status' && step.op === 'click' &&
    step.id === 'press-research' && step.from === 'source-imported' && step.target === 'reader-source-status-action' &&
    sample.semanticSeq !== mark.semanticSeq && sourceTransientWindowStable(transient.after,mark,
      events.filter(event=>event.eventSeq > transient.after.eventSeq && event.eventSeq <= mark.eventSeq),
      transient.scope,event=>matchingSourceTransientRetirement(event,
        events.filter(fact=>fact.eventSeq <= transient.after.eventSeq),transient.scope));
  requireEvidence(sample && sample.instanceId === mark.instanceId &&
    sample.window.id === mark.payload.windowId && sample.window.revision === mark.windowRevision &&
    (sample.semanticSeq === mark.semanticSeq || retiredToast) && sample.afterSeq <= mark.eventSeq,
  `The native target is stale before ${step.id}`);
  if (sample.pickerCheckpoint) {
    requireEvidence(step.op === 'click' && sample.sourcePicker?.operation === sourcePickerRole(step.target) &&
      sample.sourcePicker && sameWindow(sample.pickerCheckpoint,mark) &&
      mark.deviceMonoMs - sample.pickerCheckpoint.deviceMonoMs <= sourcePickerDispatchBudgetMs,
    'The observed native document picker target is stale or does not match the requested step');
  }
  if (step.id === 'open-detail' && step.from === 'results-scrolled' && step.target === 'reader-search-public-local-result') {
    const anchor = events.findLast(event => event.kind === 'search-page-anchor' && event.channel === 'business' &&
      event.instanceId === sample.instanceId && event.eventSeq <= sample.beforeSeq)?.payload;
    const viewport = selectLayoutNode(sample,'reader-search-result-viewport');
    requireEvidence(anchor?.action === 'user-scroll-settled' && anchor.anchorAtStart === false &&
      Number.isSafeInteger(anchor.anchorIndex) && anchor.anchorIndex > 0 && Number.isFinite(anchor.anchorOffset) &&
      anchor.anchorOffset > 0 && viewport.id === `reader-search-result-list:${anchor.page}:${anchor.queryRevision}`,
    'The public result is not in the current settled off-start native result list');
    selectLayoutNode(sample,{id:step.target,ancestors:[viewport.id]});
  }
  assertSourceToggleEdgeState(step, sample, mark, events);
  assertSourceRecoveryExpandEdgeState(step,sample,mark,events);
  if (step.target === sourceGroupOptionsScroll || step.target === sourceGroupOptionsTail)
    requireSourceGroupOptionsCurrent(sample,events);
  requireSourceOfflineDetectState(step, sample, mark, events);
  if (step.target === sourceGroupBackdrop) {
    const measured = measureSourceGroupOutside(sample);
    const open = events.findLast(event => event.kind === 'source.overlay' && event.channel === 'business' &&
      event.instanceId === mark.instanceId && event.eventSeq <= mark.eventSeq && event.payload.overlay === 'group');
    requireEvidence(measured && open?.eventSeq <= sample.beforeSeq && open.payload.phase === 'open' &&
      open.payload.selectionId === measured.selectionId, 'The measured backdrop is not the current Source group opening');
  }
  if (step.op === imeSearchTap) {
    const captured = sample.imeSearchCheckpoint;
    requireEvidence(captured && sample.imeSearchKey && sameWindow(captured, mark) &&
      mark.deviceMonoMs - captured.deviceMonoMs <= imeSearchDispatchWindowMs,
    'The verified soft Search key screenshot is stale before its tap');
  }
  if (step.op === directoryImeHideTap) {
    const captured = sample.imeHideCheckpoint;
    requireEvidence(captured && sample.imeHideKey && sameWindow(captured, mark) &&
      mark.deviceMonoMs - captured.deviceMonoMs <= directoryImeDispatchWindowMs,
    'The measured Directory IME hide key is stale before its tap');
  }
}

export function assertOwnerActionState(step, context, contract, mark) {
  if (step.id === 'input-search' || step.id === 'submit-search') {
    const requirement = step.id === 'input-search' ? 'focus' : 'edit-selection';
    const assertion = contract.assertions.find(item => item.evaluator === 'search' && item.kind === requirement);
    const result = evaluateSearch(assertion, context);
    requireEvidence(result.verdict === 'PASS', `Search precondition before ${step.id}: ${result.reason ?? result.verdict}`);
  } else if (step.id === 'open' || step.id === 'dismiss') {
    const preceding = context.actions[step.id === 'open' ? 'enter-reading' : 'open'];
    const kind = step.id === 'open' ? 'reading.ready' : 'reading.control-committed';
    const ready = context.events.filter(event => preceding && event.channel === 'business' && event.kind === kind &&
      event.instanceId === mark.instanceId && event.eventSeq > preceding.beforeSeq && event.eventSeq <= mark.eventSeq &&
      (step.id === 'open' || event.payload.direction === 'open'));
    const payload = ready[0]?.payload;
    const state = payload?.state;
    requireEvidence(ready.length === 1 && state?.heldPointerId === -1 &&
      state?.transition === '' && state?.targetLevel === (step.id === 'open' ? 'hidden' : 'home') &&
      state?.level === state?.targetLevel && (step.id === 'dismiss' || payload.localBook === true && payload.reduceMotion === false),
    `Reader owner or motion mode is not ready before ${step.id}`);
  }
}

export function matchesPredicates(events, predicates = []) {
  return predicates.every(predicate => {
    const sameKind = event => event.kind === predicate.kind &&
      (predicate.channel === undefined || event.channel === predicate.channel);
    const matchesFields = event => Object.entries(predicate.fields ?? {}).every(([path, expected]) =>
      path.split('.').reduce((value, key) => value && Object.hasOwn(value, key) ? value[key] : undefined, event) === expected);
    if (predicate.match === 'latest') {
      const current = events.findLast(sameKind);
      return Boolean(current && matchesFields(current));
    }
    return events.some(event => sameKind(event) && matchesFields(event));
  });
}

function requestCrossoverDrag(step, samples, fixture) {
  const {calibrationSample,speed,transport,keepMs,moveMs} = step.path;
  const timed = transport === 'uinput' && keepMs === crossoverTouchTiming.keepMs && moveMs === crossoverTouchTiming.moveMs &&
    speed === undefined && fixture?.id === 'public-local-reading-v1';
  const ordinary = transport === undefined && speed === 1200 && keepMs === undefined && moveMs === undefined;
  requireEvidence(step.id === 'crossover-grabber' && step.op === 'drag' && !step.gesture &&
    step.target === 'reader-control-motion-grabber' && step.from === 'calibrate-full-state' &&
    calibrationSample === 'calibrate-quick-state' && (timed || ordinary),
  'The measured input requires the exact ordinary crossover drag or timed crossover');
  const full = samples[step.from];
  const quick = samples[calibrationSample];
  const orderedCapture = sample => sample?.captureComplete === true &&
    [sample.beforeSeq,sample.afterSeq,sample.semanticSeq].every(nonnegativeInteger) &&
    sample.semanticSeq <= sample.beforeSeq && sample.beforeSeq < sample.afterSeq;
  requireEvidence(orderedCapture(full) && orderedCapture(quick) && quick.afterSeq < full.beforeSeq &&
    quick.semanticSeq < full.semanticSeq, 'Crossover calibration needs two complete ordered native samples');

  const current = full.window;
  const earlier = quick.window;
  requireEvidence(typeof full.instanceId === 'string' && full.instanceId.length > 0 && full.instanceId === quick.instanceId &&
    typeof current?.id === 'string' && current.id.length > 0 && current.id === earlier?.id &&
    nonnegativeInteger(current.revision) && current.revision === earlier.revision &&
    Number.isFinite(current.density) && current.density > 0 && current.density === earlier.density &&
    current.orientation === earlier.orientation && current.keyboard?.visible === false && earlier.keyboard?.visible === false &&
    equalJson(current.rectPx,earlier.rectPx) && equalJson(current.displayRectPx,earlier.displayRectPx),
  'Crossover calibration requires the same unchanged native window with IME hidden');
  const fullGeometry = readSearchGrabberGeometry(full,true,'crossover');
  const quickGeometry = readSearchGrabberGeometry(quick,false,'crossover');
  const {stageBox} = fullGeometry;
  requireEvidence(equalJson(stageBox,quickGeometry.stageBox) &&
    equalJson(fullGeometry.originalStageBox,quickGeometry.originalStageBox),
  'The reading stage moved during crossover calibration');

  // Use the 18vp closing travel specified by ReaderControlMotionGeometry.
  const closeTravelPx = 18 * current.density;
  const interiorPx = Math.round(closeTravelPx / 2);
  const {x:fromX,y:fromY} = fullGeometry.center;
  const {left,right} = quickGeometry.grabberBox;
  const quickY = quickGeometry.center.y;
  const toY = quickY + interiorPx;
  requireEvidence(quickY > fromY && interiorPx > 0 && interiorPx < closeTravelPx &&
    fromX >= left && fromX < right && toY < stageBox.bottom &&
    [fromX,fromY,toY].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 16384),
  'Crossover drag is outside the measured native path');
  const windowYVp = y => (y - current.rectPx.top) / current.density;
  return {
    operation:timed ? {op:'timedCrossover',x:fromX,fromY,toY} : {op:'drag',fromX,fromY,toX:fromX,toY,velocity:speed},
    crossoverDrag:{calibrationSample,fromWindowYVp:windowYVp(fromY),quickWindowYVp:windowYVp(quickY),toWindowYVp:windowYVp(toY)},
  };
}

export function requestedOperation(step, samples, fixture) {
  const quickSeconds = typeof step.target === 'string' &&
    /^reader-auto-speed-increase-exposed-from-([89]|1[01])$/u.exec(step.target)?.[1];
  if (quickSeconds) {
    const from = quickSeconds === '8' ? 'enter-autoPage-state' : 'autopage-interval-' + quickSeconds;
    requireEvidence(fixture?.id === 'public-local-reading-v1' && step.kind === 'action' && step.op === 'click' &&
      step.id === 'increase-autoPage-interval-' + (Number(quickSeconds) + 1) && step.from === from &&
      !step.gesture && step.tapEdge === undefined && step.path === undefined,
    'The exposed AutoPage interval click requires the exact public Quick action and its current baseline');
    const sample = samples[from];
    requireEvidence(sample, `Action ${step.id} has no measured target sample`);
    const button = selectLayoutNode(sample,'reader-auto-speed-increase-from-' + quickSeconds);
    requireEvidence(button.quickAutoPageExposedPoint, 'The current AutoPage plus has no verified exposed native top interval');
    return {op:'click',...button.quickAutoPageExposedPoint};
  }
  requireEvidence(step.op !== 'grabberReversal', grabberReversalUnavailable);
  if (step.path?.calibrationSample !== undefined) return requestCrossoverDrag(step,samples,fixture).operation;
  if (step.op === 'keyEvent') {
    if (fixture?.id === sourceNativeFocusFixture && ['reopen-group-key','close-key-group'].includes(step.id)) {
      requireEvidence(sourceNativeFocusKeyReady(step,samples[step.from]),
        'The Source group key requires its verified native control or current open panel');
    }
    return { op: 'keyEvent', key: step.key ?? 'Back' };
  }
  const sample = samples[step.from];
  requireEvidence(sample, `Action ${step.id} has no measured target sample`);
  const sourceControlTouch = sourceControlTouchStep(step,fixture);
  if (sourceControlTouch) {
    return {op:'click',...sourceControlTouchPoint(sample,sourceControlTouch)};
  }
  if (step.id === sourceFilterClearAction) {
    requireEvidence(sourceFilterClearStep(step,fixture),'Filter Clear upper edge requires the exact public case and native Button');
    return {op:'click',...sourceFilterClearPoint(sample).point};
  }
  if (step.target === sourceInlineImportButton && step.tapEdge === undefined) {
    requireEvidence(sourceInlineImportCenterStep(step,fixture),'Inline import center requires the exact public dialog fixture and action');
    return {op:'click',...sourceInlineImportEdgeTap(sample,step.target,'center').point};
  }
  if (step.target === emptyBookshelfEntry || step.target?.id === emptyBookshelfEntry) {
    const entry = readEmptyBookshelfEntry(sample);
    requireEvidence(fixture?.id === searchEmptyBookshelfFixture && step.id === 'open-search' && step.op === 'click' && entry,
      'The Search action has no verified native button in the genuinely empty bookshelf');
    return {op:'click',...layoutTapPoint(entry)};
  }
  const chrome = sourceChromeStep(step);
  if (chrome) {
    requireEvidence(fixture?.id === sourceChromeFixture && step.op === 'click' &&
      step.target === chrome.target && step.from === chrome.baseline && !step.gesture && step.tapEdge === chrome.position,
    'The Source chrome touch must use its exact native Button, fixture and position');
    return {op:'click',...sourceChromeTapPoint(sample,chrome.target,chrome.position).point};
  }
  if (step.target === sourceOfflineDetectButton) {
    requireEvidence(fixture?.id === sourceOfflineDetectFixture,
      'The native Detect button is scoped to its exact public provider-free fixture');
    if (step.id === 'detect-source-top') return {op:'click',...sourceOfflineDetectEdgePoint(sample)};
  }
  if (sourceStatusActionEdgeStep(step)) {
    requireEvidence(fixture?.id === sourcePickerFixture,'The Re-search upper edge needs its exact public import fixture');
    return {op:'click',...sourceStatusActionEdgePoint(sample)};
  }
  const pickerRole = sourcePickerRole(step.target);
  if (pickerRole || sample.pickerCheckpoint) {
    requireEvidence(pickerRole && step.op === 'click' && sample.sourcePicker?.operation === pickerRole,
      'The action does not have a matching current system picker target');
    const {x,y} = sample.sourcePicker;
    return {op:'click',x,y};
  }
  if (step.target === sourceGroupOptionsScroll || step.target === sourceGroupOptionsTail) {
    const scrolling = step.target === sourceGroupOptionsScroll;
    requireEvidence(fixture?.id === sourceGroupOptionsScrollFixture && step.op === (scrolling ? 'swipe' : 'click'),
      'Only the exact public group options case may drive the measured Scroll and tail');
    return scrolling ? requestSourceGroupOptionsSwipe(sample) : requestSourceGroupOptionsTailTap(sample);
  }
  if (step.target === sourceGroupBackdrop) {
    const measured = measureSourceGroupOutside(sample);
    requireEvidence(step.op === 'click' && !step.gesture && !step.tapEdge && measured,
      'No verified native click point inside the current backdrop and outside the painted group panel');
    return {op:'click',...measured.point};
  }
  const query = sourceQueryTouchPosition(step,fixture);
  if (query !== undefined) {
    return {op:'click',...sourceQueryTouchTap(sample,query).point};
  }
  const categoryCenter = sourceCategoryCenterTarget(step,fixture);
  if (categoryCenter) return {op:'click',...sourceCategoryCenterTap(sample,categoryCenter)};
  const readTouch = sourceReadRetryTouchStep(step,fixture);
  if (readTouch) return {op:'click',...sourceReadRetryTouchPoint(sample,readTouch)};
  if (step.id === 'tap-selected-center' && step.target === 'reader-source-group-selected') {
    requireEvidence(fixture?.id === sourceGroupOptionEdgeFixture && fixture.publicSources === true &&
      step.op === 'click' && step.from === 'selected-center-open' && !step.gesture && step.tapEdge === undefined,
      'The native group center requires the exact selected option in the public fixture');
    return {op:'click',...sourceGroupSelectedCenterTap(sample)};
  }
  if (step.target === sourceToggleEdgeTarget && (fixture?.id === sourceToggleTouchFixture || step.tapEdge === undefined)) {
    const toggle = sourceToggleTouchStep(step);
    requireEvidence(fixture?.id === sourceToggleTouchFixture && toggle,
      'The measured native Toggle action requires its exact public state-change case');
    const witness = sourceToggleTouchTap(sample,toggle.position);
    requireEvidence(witness.nativeChecked === !toggle.requestedEnabled,
      'The native public Toggle checked state is unavailable or differs from the ready source state');
    return {op:'click',...witness.point};
  }
  if (step.target === sourceUnknownToggle) {
    const toggle = selectLayoutNode(sample,{id:sourceUnknownToggle,ancestors:['reader-source-list','reader-source-row-1']});
    requireEvidence(fixture?.id === sourceUnknownExpandFixture && fixture.publicSources === true &&
      step.id === sourceUnknownWriteAction && step.op === 'click' && step.from === 'source-ready' &&
      toggle.source === 'native-tree' && toggle.type === 'Toggle' && toggle.sourcePublicToggleChecked === false,
    'The one-shot public write requires its exact checked-false native Source Toggle');
    return {op:'click',...layoutTapPoint(toggle)};
  }
  if (step.tapEdge !== undefined) {
    requireEvidence(step.op === 'click' && step.gesture !== true, 'Source edge requires a normal native click');
    const {target,tapEdge} = step;
    if (sourceRecoveryExpandEdgeStep(step)) {
      const requiredFixture = step.from === 'recovery-refolded' ? sourceUnknownExpandFixture : 'public-source-read-v1';
      requireEvidence(fixture?.id === requiredFixture && fixture.publicSources === true,
        'A recovery Expand edge requires its exact public Source notice fixture');
      return {op:'click',...sourceRecoveryExpandEdgePoint(sample,target)};
    }
    if (target === 'reader-source-group-trigger') {
      requireEvidence(fixture?.id === sourceGroupOptionEdgeFixture && fixture.publicSources === true &&
        step.id === 'open-selected-center' && step.from === 'source-ready' && tapEdge === 'top' &&
        step.requireFullContainment === true, 'The native group trigger edge requires the exact public case');
    }
    if (sourceQueryEdgeAllowed(target,tapEdge)) return {op:'click',...sourceQueryEdgeTap(sample,target,tapEdge).point};
    if (sourceInlineImportEdgeAllowed(target,tapEdge)) {
      requireEvidence(fixture?.id === sourceInlineImportEdgeFixture,'Inline import edges require the exact public dialog fixture');
      return {op:'click',...sourceInlineImportEdgeTap(sample,target,tapEdge).point};
    }
    const measure = sourceToggleEdgeAllowed(target,tapEdge) ? sourceToggleEdgeTap : sourceFilterEdgeTap;
    const {point} = measure(sample,step.target,step.tapEdge,step);
    return {op:'click',...point};
  }
  if (step.op === imeSearchTap) {
    requireEvidence(sample.imeSearchKey, 'The soft Search tap has no verified same-sample key');
    const { x, y } = sample.imeSearchKey;
    return { op:'click', x, y };
  }
  if (step.op === directoryImeHideTap) {
    requireEvidence(sample.imeHideKey, 'The soft IME hide operation has no measured keyboard key');
    const { x, y } = sample.imeHideKey;
    return { op:'click', x, y };
  }
  let target = step.target;
  if (Array.isArray(target)) {
    const present = target.filter(id => nodeVisible(sample, id));
    requireEvidence(present.length === 1, 'Reading interaction host is missing or ambiguous');
    [target] = present;
  }
  if (step.id === 'retry-source-list' && target === 'reader-search-source-recovery-primary') {
    selectLayoutNode(sample, {id:target,ancestors:['reader-bookshelf-search-sourceLoadError']});
    requireEvidence(sample.captureComplete === true && searchSourceRetryVisibility(sample).verdict === 'PASS',
      'The current source-list recovery button has no complete native hit area clear of the IME');
  }
  const node = selectLayoutNode(sample, target);
  if (step.id === 'rerun-empty' && target === 'reader-search-retry') {
    const viewport = ancestorsOf(sample,node).find(parent => parent.type === 'List' &&
      /^reader-search-result-list:\d+:\d+$/u.test(parent.id ?? ''));
    requireEvidence(sample.captureComplete === true && viewport && node.type === 'Button',
      'The rerun target has no complete, current native result list');
    selectLayoutNode(sample, {id:target,ancestors:['reader-library-search-surface','reader-bookshelf-search-empty',viewport.id]});
  }
  const drag = step.op === 'drag' || step.op === 'swipe';
  const point = layoutTapPoint(node, { requireClickable: step.gesture !== true && step.op !== 'inputText' && !drag });
  const buttonSemantic = step.buttonSemantic ?? (step.id === 'submit-search' ? 'search' : undefined);
  requireEvidence(buttonSemantic === undefined || node.searchSemantic === buttonSemantic,
    `The current native button has no enabled ${buttonSemantic} semantics`);
  if (drag) {
    const end = step.path.endTarget ? selectLayoutNode(sample, step.path.endTarget) : node;
    layoutTapPoint(end, {requireClickable:false});
    const toPoint = (rect, [x,y]) => [Math.floor(rect.left + x * rect.width), Math.floor(rect.top + y * rect.height)];
    const [fromX, fromY] = toPoint(node.visibleRectPx, step.path.from);
    const [toX, toY] = toPoint(end.visibleRectPx, step.path.to);
    requireEvidence(fromX !== toX || fromY !== toY, 'Gesture collapses onto one native pixel');
    return { op: step.op, fromX, fromY, toX, toY, velocity: step.path.speed };
  }
  if (step.gesture) {
    const ratio = (point.x - node.rectPx.left) / node.rectPx.width;
    requireEvidence(ratio >= 1/3 && ratio <= 2/3, 'The clipped native tap point is outside the reader control gesture region');
  }
  if (step.op === 'inputText') {
    requireEvidence(node.focused === true && sample.window.keyboard?.visible === true, 'Input requires the focused editor and visible IME');
    return { op: 'inputText', ...point, text: step.inputRole ? fixture.inputs[step.inputRole] : fixture.inputWord };
  }
  if (step.op === 'clickThenReaderCenter') {
    const reading = samples['reading-before'];
    const hosts = ['reader-reading-interaction-host-paged','reader-reading-interaction-host-continuous'];
    const available = hosts.filter(id => reading && nodeVisible(reading,id));
    requireEvidence(available.length === 1 && reading.captureComplete === true && sample.captureComplete === true &&
      reading.instanceId === sample.instanceId && reading.window.id === sample.window.id &&
      reading.window.density === sample.window.density,
    'The paired launch has no uniquely measured reading interaction host in the same native window');
    const host = selectLayoutNode(reading,available[0]);
    const stage = selectLayoutNode(sample,'reader-reading-stage');
    const center = layoutTapPoint(stage,{requireClickable:false});
    const rect = host.visibleRectPx;
    requireEvidence(rect && rect.width > 0 && rect.height > 0 &&
      ['x','y'].every((key,index) => {
        const axis = index === 0 ? ['left','width'] : ['top','height'];
        const fraction = (center[key] - rect[axis[0]]) / rect[axis[1]];
        return fraction >= 1/3 && fraction <= 2/3;
      }) && (center.x !== point.x || center.y !== point.y),
    'The current native stage center is outside the previously measured reading interaction host center');
    return {op:step.op,...point,centerX:center.x,centerY:center.y};
  }
  requireEvidence(['click', 'clickThenBack'].includes(step.op), 'Unknown input operation');
  return { op: step.op, ...point };
}

export function actionArgs(operation) {
  if (operation.op === 'timedCrossover') return crossoverTouchArgs(operation);
  const args = ['shell','uitest','uiInput',operation.op];
  if (operation.op === 'keyEvent') {
    const key = uiInputKeyArgument(operation.key);
    if (key === null) throw new EvidenceError('Unknown native keyEvent input');
    return [...args, key];
  }
  if (['swipe','drag'].includes(operation.op)) {
    return [...args, ...[operation.fromX,operation.fromY,operation.toX,operation.toY,operation.velocity].map(String)];
  }
  args.push(String(operation.x), String(operation.y));
  if (operation.op === 'inputText') args.push(`[length:${operation.text.length}]`);
  return args;
}

export function readyForStep(step, sample) {
  if (step.captureGuard === sourcePickerGuard) return Boolean(sample.sourcePicker);
  if (step.book) selectLayoutNode(sample, {publicBookTitle: step.publicBookTitle});
  return step.anchors.every(id => nodeVisible(sample, id)) &&
    (!step.anyAnchor || step.anyAnchor.some(id => nodeVisible(sample, id))) &&
    (step.keyboard === undefined || sample.window.keyboard?.visible === step.keyboard) &&
    (!step.focus || selectLayoutNode(sample, step.focus).focused === true);
}

export function sampleReadiness(step, sample, bookTitle, ownerReady = true) {
  if (!ownerReady) return 'The expected causal owner state did not settle';
  try {
    return readyForStep({...step, publicBookTitle:bookTitle}, sample) ? null :
      'The expected route anchors, keyboard state or focus were not observed';
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return error.message;
  }
}

function completedLogPrefix(records, last, previous, instanceId) {
  const end = records.findIndex((record,index) => index >= last &&
    !(record.event === 'command' && record.ok === true && equalJson(record.args,logCommand)));
  const polls = records.slice(last,end < 0 ? records.length : end);
  const checkpoints = new Set(polls.map(record => checkpoint(record,instanceId)?.eventSeq)
    .filter(seq => seq > previous.eventSeq));
  if (!checkpoints.size) return [];
  const observed = probeEventsInRange(polls,instanceId,previous.eventSeq,Math.max(...checkpoints));
  let current = previous;
  let verified = 0;
  for (const [index,item] of observed.entries()) {
    if (item.eventSeq !== current.eventSeq + 1 || !followsSemanticSequence(current,[item])) break;
    current = item;
    if (checkpoints.has(item.eventSeq)) verified = index + 1;
  }
  return observed.slice(0,verified);
}

export function sessionContext({store, session, sessionRef, candidate, contract, publicFixtureScope}) {
  const context = { runId:session.runId, actions: {}, samples: {}, sampleReadiness: {}, events: [], candidate,
    ...(usesSourceUnknownExpand(contract) ? {sourceUnknownExpand:true} : {}) };
  const targetSamples = {};
  const targetCaptures = {};
  const reversal = contract.steps.find(step => step.op === 'grabberReversal');
  const reversalEntries = session.chain.filter(({entry}) => reversal && entry.kind === 'action' && entry.id === reversal.id);
  requireEvidence(reversalEntries.length <= 1 && (!session.runner || reversalEntries.length === 1) &&
    session.chain.every(link => reversalEntries.includes(link) ||
      !['runnerInstallLog','runnerClockLog','runnerMode','readerInstalledAfterLog','runnerProbeExit','runnerQualificationSha256']
        .some(key => Object.hasOwn(link.entry,key))),
  'The session contains orphaned or duplicate Runner evidence');
  const raw = store.bytes(session.commands).toString('utf8').trim();
  const records = raw ? raw.split(/\r?\n/u).map(line => JSON.parse(line)) : [];
  const problems = [];
  if (!records.length) return { ...context, problems: ['Probe did not produce a session'], records };
  requireEvidence(records[0]?.event === 'ready' && records.every((record, index) =>
    record.seq === index + 1 && record.targetRef === candidate.targetRef), 'Probe journal sequence or exact target mismatch');
  requireEvidence(Date.parse(records[0].recordedAt) >= Date.parse(candidate.completedAt),
    'Probe session predates the supplied deployment');
  if (session.result === 'COMPLETED') {
    requireEvidence(records.at(-1)?.event === 'closed' && records.at(-1)?.reason === 'quit-or-eof' &&
      !records.some(record => record.ok === false), 'Completed run has no successful probe teardown');
  }
  let last = 0;
  let hostEndMs = 0;
  const allEvents = new Map();
  let previousCheckpoint;
  let unsettledAction;
  let guardedFocus = false;
  let omittedSearchSourceRetry = false;
  for (const [index, link] of session.chain.entries()) {
    const entry = link.entry;
    if (index === 0) {
      guardedFocus = verifyStartupFocus(records, entry, candidate);
      const readiness = records[entry.readiness - 1];
      if (candidate.remoteGuestReadiness || readiness?.vmLocation === 'remote') {
        requireEvidence(guardedFocus, 'Remote VM collection lacks the normal startup and action focus guards');
        assertRemoteCollectionReadiness(readiness, candidate, contract);
      } else {
        requireEvidence(readiness?.event === 'readiness' && readiness.status === 'PASS' && readiness.exactConnected === true &&
          readiness.bootCompleted === true && readiness.sceneBoardStable === true &&
          readiness.targetKind === candidate.targetKind &&
          (candidate.targetKind !== 'vm' || readiness.emulatorLog?.bootMarker === true &&
            readiness.emulatorLog.instabilityAfterMarker === false) &&
          readiness.hdcServer === candidate.hdcServer, 'Unverified target, emulator boot, or SceneBoard');
      }
      assertInstalled(requireCommand(records, entry.installed, installedCommand), candidate);
      const startupCommand = remoteEmptyShelfFixture(candidate, contract, publicFixtureScope) ?
        remoteEmptyShelfStartCommand : startCommand;
      requireCommand(records, entry.start, startupCommand);
      const baseline = checkpoint(requireCommand(records, entry.baselineLog, logCommand));
      const floor = latestProbeEvent(requireCommand(records, entry.startFloor, logCommand));
      const initial = checkpoint(requireCommand(records, entry.initialLog, logCommand), session.instanceId);
      requireEvidence(initial && (baseline?.instanceId !== initial.instanceId || initial.eventSeq > baseline.eventSeq) &&
        (floor?.instanceId !== initial.instanceId || initial.eventSeq > floor.eventSeq),
        'No fresh normal-launch probe instance or Developer Mode heartbeat');
      requirePublicFixtureCheckpoint(initial, publicFixtureScope);
      previousCheckpoint = initial;
      last = entry.initialLog;
      continue;
    }
    if (entry.kind === 'postflight') {
      omittedSearchSourceRetry = !problems.length && contract.steps.length === index + 1 &&
        contract.steps[index - 1]?.id === 'retry-source-list' && contract.steps[index]?.id === 'retry-settled' &&
        canOmitSearchSourceRetry(contract, [...allEvents.values()], context.actions['open-search'],
          context.samples[searchEntrySourceSample]);
      requireEvidence(index === session.chain.length - 1 && (index === contract.steps.length + 1 || omittedSearchSourceRetry) &&
        entry.installed === last + 1 && records.length === entry.installed + 1,
        'Unexpected final installed-candidate check');
      assertInstalled(requireCommand(records, entry.installed, installedCommand), candidate);
      last = entry.installed;
      continue;
    }
    const step = contract.steps[index - 1];
    requireEvidence(step?.id === entry.id && step.kind === entry.kind && Number.isFinite(entry.hostBeginMs) &&
      Number.isFinite(entry.hostEndMs) && entry.hostBeginMs >= hostEndMs && entry.hostEndMs >= entry.hostBeginMs,
    'Missing or out-of-order case steps');
    requireEvidence(entry.popupRender === undefined && entry.popupRenderBaselineLog === undefined ||
      entry.popupRender === true && contract.id === 'reading.control-more-popup' && step.kind === 'action' &&
      ['open-more','close-more'].includes(step.id) && Number.isSafeInteger(entry.popupRenderBaselineLog) &&
      entry.popupRenderBaselineLog === entry.beforeLog + 1, 'Unexpected RenderService Popup action or baseline evidence');
    const refs = [sessionRef, session.commands];
    const prior = last;
    last = entry.afterLog;
    hostEndMs = entry.hostEndMs;
    try {
      const reversing = step.op === 'grabberReversal';
      const runnerDry = entry.runnerMode === 'dry';
      if (reversing) {
        requireEvidence(session.runner, 'The reversal action is missing sealed Runner evidence');
        requireEvidence(entry.runnerMode === undefined || (runnerDry &&
          session.result === 'INCOMPLETE' && index === session.chain.length - 1),
        'A Runner dry qualification must end its own incomplete session');
        requireEvidence(runnerDry === Object.hasOwn(entry,'readerInstalledAfterLog') &&
          runnerDry === Object.hasOwn(entry,'runnerProbeExit'),
          'A Runner dry qualification needs its own final Reader install readback');
        requireEvidence(entry.runnerQualificationSha256 === undefined ||
          (!runnerDry && /^[a-f0-9]{64}$/u.test(entry.runnerQualificationSha256)),
        'Invalid independently pinned Runner qualification reference');
        requireEvidence(Number.isSafeInteger(entry.beforeLog) && Number.isSafeInteger(entry.runnerInstallLog) &&
          entry.runnerInstallLog > prior &&
          entry.runnerInstallLog === entry.beforeLog - 2 && entry.runnerClockLog === entry.beforeLog - 1,
        'Runner install and clock readbacks must immediately precede the reversal checkpoint');
      }
      const direction = contract.id === 'reading.control-open-motion' && step.kind === 'action' &&
        (step.id === 'open' || step.id === 'dismiss') ? step.id : undefined;
      const scopedCase = contract.phase !== undefined;
      const pollStart = step.kind === 'action' ? requireActionFocus(records, prior, guardedFocus, step.id) : prior;
      const { before, after, events, partial } = eventSlice(records, entry, session, pollStart, direction, scopedCase,
        contract.phase === 1 && contract.pageId === 'reading' && step.kind === 'action', reversing ? entry.runnerInstallLog : entry.beforeLog);
      for (const event of [before, ...events]) requirePublicFixtureCheckpoint(event, publicFixtureScope);
      if (previousCheckpoint) {
        const previousAppSeq = previousCheckpoint.eventSeq;
        const intervening = probeEventsInRange(records.slice(prior, entry.beforeLog),
          session.instanceId, previousAppSeq, before.eventSeq);
        requireEvidence(intervening.length === before.eventSeq - previousAppSeq &&
          intervening.every((event, i) => event.eventSeq === previousAppSeq + i + 1), 'Lost app events between steps');
        if (scopedCase) requireEvidence(followsSemanticSequence(previousCheckpoint, intervening),
          'Window heartbeat omits an intervening semantic event between steps');
        for (const event of intervening) {
          requirePublicFixtureCheckpoint(event, publicFixtureScope);
          allEvents.set(event.eventSeq, { ...event, evidenceRefs: refs });
        }
      }
      previousCheckpoint = after;
      for (const event of events) allEvents.set(event.eventSeq, { ...event, evidenceRefs: refs });
      // The checkpoint's sequence is useful to assert readiness as it stood
      // before a command even if there are no intervening semantic callbacks.
      allEvents.set(before.eventSeq, { ...before, evidenceRefs: refs });
      if (step.kind === 'sample' || step.kind === 'locate') {
        requireEvidence(Boolean(entry.screenshot) === (step.kind === 'sample'), 'Sample has incorrect capture class');
        let ownerReady = true;
        if (scopedCase) {
          const action = context.actions[step.afterAction];
          requireEvidence(!step.afterAction || action, 'Sample does not follow a verified causal action');
          const afterAction = [...allEvents.values()].filter(event => event.eventSeq > action?.beforeSeq &&
            event.eventSeq <= before.eventSeq);
          ownerReady = matchesPredicates(afterAction, step.waitFor) && action?.outcomeSettled !== false &&
            (!sourceStatusActionEdgePostToastSample(contract,step) || sourceStatusActionEdgeToastRetired(afterAction));
          if (step.quietMs) {
            const quiet = checkpoint(requireCommand(records, entry.quietLog, logCommand), session.instanceId);
            requireEvidence(entry.quietLog > prior && entry.quietLog < entry.beforeLog && quiet &&
              windowStable(quiet, before) && before.deviceMonoMs - quiet.deviceMonoMs >= step.quietMs,
            'Required native endpoint did not stay quiet before capture');
          }
        }
        const sample = normalizeSample({store, records, entry, before, after, refs, caseId:contract.id, fixture: contract.fixture, step,
          causalAction:context.actions[step.afterAction]});
        const healthyEntry = step.id === searchEntrySourceSample && usesSearchEntrySourceRead(contract) &&
          searchEntrySourceSampleRead([...allEvents.values()], context.actions[step.afterAction], sample)?.outcome === 'ready' &&
          searchEntrySourceSampleMatches(sample, 'ready');
        const admissionIssue = healthyEntry ? null : sampleReadiness(step, sample, contract.fixture.bookTitle, ownerReady);
        if (scopedCase && step.kind === 'sample' && admissionIssue) {
          context.sampleReadiness[step.id] = admissionIssue;
        } else {
          requireEvidence(!admissionIssue, `Normal route or state not established at ${step.id}: ${admissionIssue}`);
        }
        if (!admissionIssue) {
          targetSamples[step.id] = sample;
          if (reversal && (step.id === reversal.from || step.id === reversal.reversalReference)) {
            targetCaptures[step.id] = {layout:entry.layout,screenshot:entry.screenshot};
          }
        }
        if (!sample.stopLocator && !sample.pickerCheckpoint) context.samples[step.id] = sample;
      } else {
        requireEvidence(!unsettledAction, `The expected outcome of ${unsettledAction} was not observed before ${step.id}`);
        const priorEvents = [...allEvents.values()].filter(event => event.eventSeq <= before.eventSeq);
        const target = targetSamples[step.from];
        const stopLocator = assertCurrentActionState(step, target, before, priorEvents);
        assertCombinedFilterResetAction(contract,step,{...context,samples:targetSamples,events:priorEvents},before);
        assertSourceToolsReturnAction(contract,step,{...context,samples:targetSamples,events:priorEvents},before);
        assertSearchSourceRetryOpening(contract, step, priorEvents, context.actions['open-search'], before.eventSeq);
        if (scopedCase) requireEvidence(matchesPredicates(priorEvents, step.beforeEvent), 'Action is missing its owner precondition');
        else assertOwnerActionState(step, {...context, events:priorEvents}, contract, before);
        requireEvidence(entry.command === (entry.popupRenderBaselineLog ?? entry.beforeLog) + 1 && entry.floorLog === entry.command + 1,
          'Action command is outside its causal interval');
        let operation, crossoverDrag, popupBaseline;
        if (reversing) {
          const enter = context.actions['enter-reading'];
          const ready = priorEvents.filter(event => enter?.instanceId === before.instanceId &&
            event.instanceId === before.instanceId && event.eventSeq > enter.beforeSeq && event.eventSeq <= enter.afterSeq &&
            event.kind === 'reading.ready' && event.channel === 'business' && event.payload.localBook === true &&
            event.payload.reduceMotion === false && ['continuous','paged'].includes(event.payload.mode));
          requireEvidence(ready.length === 1, 'The reversal is missing its verified public local reading owner');
          const runner = readReversalReplayArtifact(store, session.runner, candidate, Date.parse(records[0].recordedAt));
          const installed = requireCommand(records, entry.runnerInstallLog, ['shell','bm','dump','-n',runner.bundleName]);
          const clock = requireCommand(records, entry.runnerClockLog, runnerClockCommand);
          const timing = reversalReplayTiming(installed, clock, records[entry.beforeLog-1],
            records[entry.command-1], records[entry.floorLog-1], runner.postInstall);
          operation = prepareReversalDispatch({step,runId:session.runId,candidate,runner,
            readingId:ready[0].payload.readingId,before,samples:targetSamples,captures:targetCaptures,...timing,
            mode:runnerDry ? 'dry' : 'dispatch'});
          refs.push(session.runner.manifest,session.runner.verification,session.runner.deployment);
        } else if (step.path?.calibrationSample !== undefined) {
          ({operation,crossoverDrag} = requestCrossoverDrag(step,targetSamples,contract.fixture));
        } else {
          const input = requestedOperation(step, targetSamples, contract.fixture);
          operation = entry.popupRender ? popupRenderOperation(contract,step,input) : input;
          requireEvidence(!entry.popupRender || operation !== input, 'Unrecognized native Popup input');
          if (entry.popupRender) {
            const verified = requirePopupRenderPreflight(records,entry.popupRenderBaselineLog,operation);
            popupBaseline = verified.sample;
            operation = verified.operation;
          }
        }
        const dispatch = requireActionDispatch(records, entry.command, operation);
        if (runnerDry) {
          requireEvidence(dispatch.state === 'DRY_READY' && windowStable(before,after) &&
            equalJson(entry.runnerProbeExit,{code:0,signal:null}) &&
            entry.readerInstalledAfterLog === entry.afterLog + 1 && records.length === entry.readerInstalledAfterLog + 1 &&
            records.at(-1)?.event === 'closed' && records.at(-1)?.reason === 'quit-or-eof',
          'Runner dry did not preserve the Reader instance, window and action state through clean close');
          const installedAfter = requireCommand(records,entry.readerInstalledAfterLog,installedCommand);
          assertInstalled(installedAfter,candidate);
          context.runnerQualification = {runId:session.runId,instanceId:before.instanceId,dispatch,
            latestReaderReadback:installedAfter.recordedAt};
          continue;
        }
        const filterLaneSwipe = sourceFilterSwipeDispatch(step,operation,dispatch.seq);
        const filterTextDrag = sourceFilterTextDragDispatch(step,operation,dispatch.seq);
        const chrome = contract.fixture.id === sourceChromeFixture && sourceChromeStep(step);
        const sourceControl = sourceControlTouchStep(step,contract.fixture);
        const filterTouch = sourceFilterNativeDispatch(contract,step,operation,dispatch.seq);
        const queryPosition = sourceQueryTouchPosition(step,contract.fixture);
        const toggle = contract.fixture.id === sourceToggleTouchFixture ? sourceToggleTouchStep(step) : undefined;
        context.actions[step.id] = { actionId: `${session.runId}:${step.id}`, instanceId: before.instanceId,
          op: step.op,
          targetId: typeof step.target === 'string' ? step.target : Array.isArray(step.target) ?
            step.target.find(id => nodeVisible(target, id)) : step.target?.id,
          beforeSeq: before.eventSeq, afterSeq: after.eventSeq,
          ...(scopedCase ? { from:step.from, key:step.key, inputRole:step.inputRole,beforeLog:entry.beforeLog,
            inputLength:operation.op === 'inputText' ? operation.text.length : undefined } : {}),
          ...(stopLocator ? {stopLocator} : {}),
          ...(crossoverDrag ? {crossoverDrag} : {}),
          ...(entry.popupRender ? {popupRender:readPopupRender(dispatch.stdout,operation,popupBaseline)} : {}),
          ...(filterLaneSwipe ? {filterLaneSwipe} : {}),
          ...(filterTextDrag ? {filterTextDrag} : {}),
          ...(sourceNativeCenterStep(contract.id,step) && step.target !== sourceOfflineDetectButton ?
            {sourceCenterTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(sourceStatusActionEdgeStep(step) ? {statusTopTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(sourceRecoveryExpandEdgeStep(step) ?
            {recoveryExpandEdgeTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(filterTouch ? {filterTouch} : {}),
          ...(sourceReadRetryTouchStep(step,contract.fixture) ?
            {sourceReadRetryTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(sourceControlTouchWitness(step,target,contract.fixture,operation,dispatch.seq) ?? {}),
          ...(step.id === 'scroll-shallow' && step.target === 'reader-source-list' && operation.op === 'swipe'
            ? {sourceListSwipe:{fromX:operation.fromX,fromY:operation.fromY,toX:operation.toX,toY:operation.toY,
              velocity:operation.velocity,probeSeq:dispatch.seq}} : {}),
          ...(chrome ?
            {chromeTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(sourceInlineImportCenterStep(step,contract.fixture) ?
            {inlineImportTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(['clickThenBack','clickThenReaderCenter','grabberReversal'].includes(operation.op) ? {dispatch} : {}),
          ...(step.target === sourceGroupBackdrop ? {outsideTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(step.target === sourceGroupOptionsScroll ? {groupOptionsSwipe:{fromX:operation.fromX,fromY:operation.fromY,
            toX:operation.toX,toY:operation.toY,velocity:operation.velocity,probeSeq:dispatch.seq}} : {}),
          ...(step.target === sourceGroupOptionsTail ? {groupOptionsTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(step.target === sourceOfflineDetectButton ? {detectTap:{x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(target.pickerCheckpoint ? {pickerTap:{...target.sourcePicker,probeSeq:dispatch.seq}} : {}),
          ...(queryPosition === undefined ? {} : {
            queryTouch:{position:queryPosition,x:operation.x,y:operation.y,probeSeq:dispatch.seq}
          }),
          ...(toggle ? {toggleTap:{position:toggle.position,x:operation.x,y:operation.y,probeSeq:dispatch.seq}} : {}),
          ...(step.tapEdge === undefined || chrome || sourceControl ? {} :
            {edgeTap:{edge:step.tapEdge,x:operation.x,y:operation.y,probeSeq:dispatch.seq,
              ...(step.requireFullContainment ? {requireFullContainment:true} : {})}}),
          hostBeginMs: entry.hostBeginMs, hostEndMs: entry.hostEndMs,
          evidenceRefs: stopLocator || target.pickerCheckpoint ? target.evidenceRefs : refs };
        if (scopedCase) {
          const settled = matchesPredicates(events, step.waitFor) &&
            (step.wait ?? []).every(kind => events.some(event => event.kind === kind));
          context.actions[step.id].outcomeSettled = settled;
          if (!settled) {
            unsettledAction = step.id;
            problems.push(`${entry.id}: Required owner events did not settle`);
          }
        }
        if (partial) {
          const { eventSeq, payload } = partial.header;
          problems.push(`${entry.id}: Incomplete motion block ${payload.blockIndex + 1}/${payload.blockCount} (app event ${eventSeq}, ${partial.available}/${partial.count} Hilog fragments)`);
        }
      }
    } catch (error) {
      if (!(error instanceof EvidenceError)) throw error;
      problems.push(`${entry.id}: ${error.message}`);
    }
  }
  requireEvidence(session.result !== 'COMPLETED' ||
    ((session.chain.length === contract.steps.length + 2 || omittedSearchSourceRetry) &&
      session.chain.at(-1).entry.kind === 'postflight'),
  'Completed session omitted a required case step');
  const next = contract.steps[session.chain.length - 1];
  const pendingAppend = contract.id === 'bookshelf.search-append' && contract.version === 5 &&
    next?.id === 'results-a' && next.afterAction === 'submit-a' && Number.isSafeInteger(next.stateWaitMs) && next.stateWaitMs > 0;
  const pendingHistory = contract.id === searchHistoryLoadingCase && contract.version === 1 &&
    next?.id === searchHistoryLoadingSample && next.afterAction === 'open-search';
  const causalAction = (pendingAppend || pendingHistory) && context.actions[next.afterAction];
  if (session.result === 'INCOMPLETE' && !problems.length && causalAction?.outcomeSettled === true &&
      causalAction.afterSeq === previousCheckpoint?.eventSeq && session.chain.at(-1)?.entry.id === next.afterAction &&
      next.kind === 'sample') {
    // A lost results capture leaves no sample or action boundary. The sealed
    // successful log-only prefix still proves the observed current app events.
    try {
      const refs = [sessionRef,session.commands];
      for (const item of completedLogPrefix(records,last,previousCheckpoint,session.instanceId)) {
        allEvents.set(item.eventSeq,{...item,evidenceRefs:refs});
      }
    } catch (error) {
      if (!(error instanceof EvidenceError)) throw error;
      problems.push(`${next.id}: ${error.message}`);
    }
  }
  context.events = [...allEvents.values()].sort((a, b) => a.eventSeq - b.eventSeq);
  return { ...context, problems, records, fixture:contract.fixture };
}
