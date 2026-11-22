import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { canonicalAppJson } from '../../../scripts/lib/app-build-identity.mjs';
import { readCapsuleModelInputs } from './capsule-model-inputs.mjs';
import { grabberReversalRunnerInputs } from './control-input.mjs';
import { jsonDigest, requireEvidence, sha256, validate } from './evidence.mjs';
import { directoryEditor, directoryImeHideProfile, directoryImeHideTap } from './directory-ime-key.mjs';
import { imeSearchEditor, imeSearchProfile, imeSearchTap } from './search-ime-key.mjs';
import { searchHistoryEntryTarget, searchHistoryLoadingCase, searchHistoryLoadingFixture,
  searchHistoryLoadingSample, searchHistoryStateEvent } from './search-entry-history-loading.mjs';
import { publicAssertionDefinition } from './assertion-contract.mjs';
import { sourceReadLoadingCase, sourceReadLoadingFrame } from './source-read.mjs';
import { loadStructureDefinition, resolveStructureBindings, structureRuleOrder } from './structure-contract.mjs';
import { planCapture } from './capture-plan.mjs';
import {
  sourceCategoryNativeChecksValid, sourceCategoryTouchEdgeCase, sourceCategoryTouchFixture,
  sourceFilterEdgeAllowed, sourceFilterEdgeCase, sourceFilterEdgeTarget, sourceGroupOptionEdgeCase, sourceGroupOptionEdgeFixture,
  sourceGroupOptionEdgeTarget, sourceStatusNativeChecksValid, sourceStatusTouchFixture,
} from './source-filter-edge.mjs';
import { sourceFilterScrollCase, sourceFilterScrollLanes } from './source-filter-scroll.mjs';
import { sourceFilterTextCases, sourceFilterTextDragPath, sourceFilterTextLanes } from './source-filter-tail-text.mjs';
import { sourceToggleEdgeAllowed, sourceToggleEdgeCase, sourceToggleEdgeFixture,
  sourceToggleTouchCaseValid, sourceToggleTouchFixture, sourceToggleTouchStep } from './source-toggle-edge.mjs';
import { sourceUnknownExpandFixture, sourceUnknownExpandSteps, sourceUnknownToggle,
  usesSourceUnknownExpand } from './source-unknown-expand.mjs';
import { sourceRecoveryExpandEdgeAssertion, sourceRecoveryExpandEdgeStep } from './source-recovery-body.mjs';
import { sourceReadRetryTouchAssertion, sourceReadRetryTouchCase, sourceReadRetryTouchStep } from './source-read-retry-touch.mjs';
import { sourceControlTouchAssertion, sourceControlTouchCase, sourceControlTouchStep } from './source-control-touch.mjs';
import { sourceStatusActionEdgeCase, sourceStatusActionEdgeStep,
  sourceStatusActionEdgeWaitForRetirement } from './source-status-action.mjs';
import { sourceGroupBackdrop, sourceGroupOutsideCase, sourceGroupOutsideFixture, sourceGroupPanel,
  sourceGroupSelected, sourceGroupTrigger } from './source-group-outside.mjs';
import { sourceGroupOptionsScroll, sourceGroupOptionsTail, sourceGroupOptionsTextHead } from './layout.mjs';
import { sourceGroupOptionsScrollCase, sourceGroupOptionsScrollFixture, sourceGroupOptionsScrollFixturePath,
  sourceGroupOptionsSwipePath } from './source-group-options-scroll.mjs';
import { sourceGroupTextEvent, sourceGroupTextScope } from './source-group-options-text.mjs';
import { sourceTransientStatusCases, sourceTransientStatusGuard, sourceTransientStatusStep } from './source-transient-status-text.mjs';
import { sourceQueryEdgeAllowed, sourceQueryEdgeCase, sourceQueryEdgeFixture, sourceQueryEditor,
  sourceQueryPositions, sourceQueryTouchFixture, sourceQueryTouchPosition } from './source-query-edge.mjs';
import { sourceNativeFocusCase, sourceNativeFocusFixture, sourceNativeFocusSteps } from './source-native-focus.mjs';
import { emptyBookshelfEntry, searchEmptyBookshelfCase, searchEmptyBookshelfFixture,
  searchEmptyBookshelfSteps } from './search-empty-bookshelf-entry.mjs';
import { sourceInlineImportAreaKind, sourceInlineImportButton, sourceInlineImportCenterKind, sourceInlineImportCenterStep,
  sourceInlineImportDialog, sourceInlineImportEdgeCase, sourceInlineImportEdgeFixture,
  sourceInlineImportEdges } from './source-inline-import-edge.mjs';
import { sourceChromeActions, sourceChromeCase, sourceChromeDispatch, sourceChromeFixture,
  sourceChromeGeometry, sourceChromeStep, sourceChromeTopActions, sourceChromeTopEntry } from './source-chrome-dispatch.mjs';
import { sourceFilterClearAction, sourceFilterClearCase, sourceFilterClearFixture, sourceFilterClearKind,
  sourceFilterClearQuery, sourceFilterClearStep } from './source-filter-clear-edge.mjs';
import { sourceOfflineDetectButton, sourceOfflineDetectCase, sourceOfflineDetectEdgeCase, sourceOfflineDetectFailed, sourceOfflineDetectFixture,
  sourceOfflineDetectFixturePath, sourceOfflineDetectObservation, sourceOfflineDetectReady } from './source-offline-detect.mjs';
import { sourceFooterAddButton, sourceLocalImportButton, sourcePickerAnchor, sourcePickerCase, sourcePickerFile,
  sourcePickerFixture, sourcePickerFixturePath, sourcePickerGuard, sourcePickerRole, sourcePickerRoles } from './source-document-picker.mjs';
import { applyReservedTypographyNarrowWindow, isReservedTypographyCase, publicReservedSourceHost, reservedSourceSample,
  sourceReservedTypographyFixture, sourceReservedTypographyFixtureV2, sourceReservedTypographyInput,
  sourceReservedTypographyNarrowCase, sourceReservedTypographyNarrowFixture, usesReservedNativeToggle } from './source-reserved-typography.mjs';

export const toolRoot = new URL('../', import.meta.url);
export const phase0CaseIds = Object.freeze(['bookshelf.search-input-ime', 'reading.control-open-motion']);
export const phase1CaseIds = Object.freeze(JSON.parse(readFileSync(new URL('cases/phase-1.registry.json', toolRoot), 'utf8')));
export const phase2CaseIds = Object.freeze(JSON.parse(readFileSync(new URL('cases/phase-2.registry.json', toolRoot), 'utf8')));
export const caseIds = Object.freeze([...phase0CaseIds, ...phase1CaseIds, ...phase2CaseIds]);
export const grabberReversalUnavailable = 'Grabber reversal requires a verified UiTest PointerMatrix runner in a separate test bundle, a pinned installation, and dry qualification before dispatch';
requireEvidence(caseIds.every(id => typeof id === 'string' && /^[a-z][a-z0-9.-]+$/u.test(id)) &&
  new Set(caseIds).size === caseIds.length, 'Invalid or duplicated registered case ID');

const ownerPath = /^entry\/src\/main\/ets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:ets|ts)$/u;
const sourceRef = /^(?:entry\/src\/main\/ets\/|tools\/page-structure\/)[A-Za-z0-9._/-]+#[A-Za-z0-9_.:-]+$/u;

export function searchSubmissionSource(action) {
  const target = action?.targetId ?? action?.target;
  if (action?.op === 'keyEvent' && action.key === 'Enter' && target === undefined) return 'ime';
  if (action?.op === imeSearchTap && target === imeSearchEditor) return 'ime';
  if (action?.op === 'click' && target === 'reader-search-history-public-item-0') return 'history';
  if (action?.op === 'click' && target === 'reader-bookshelf-search-submit') return 'button';
  return null;
}

function validateScopedCase(contract, samples, actions) {
  const { fixture } = contract;
  requireEvidence(!fixture.inputWord && (fixture.bookTitle || fixture.inputs || fixture.publicSources),
    'A scoped case requires explicitly public fixture roles, book, or source set');
  const platformCancel = contract.assertions.find(assertion => assertion.expected?.requirePlatformCancelDispatch === true);
  const grabberCancelFixture = fixture.id === 'public-local-reading-grabber-cancel-v2';
  if (platformCancel || grabberCancelFixture || contract.id === 'reading.control-grabber-cancel' && contract.version === 2) {
    const drag = contract.steps.find(step=>step.id === 'observe-grabber-drag');
    const end = contract.steps.find(step=>step.id === 'grabber-drag-ended');
    const dispatch = step=>step?.waitFor?.some(event=>event.kind === 'reading.control-grabber-platform-cancel' &&
      event.channel === 'probe' && event.fields?.['payload.accepted'] === true &&
      event.fields?.['payload.transport'] === 'arkui-send-touch-event');
    requireEvidence(contract.id === 'reading.control-grabber-cancel' && contract.version === 2 && contract.phase === 1 &&
      contract.pageId === 'reading' && grabberCancelFixture && fixture.bookTitle === 'Reader Phase 0 公共测试书' &&
      platformCancel?.action === drag?.id && platformCancel?.baseline === 'enter-search-state' &&
      platformCancel?.sample === end?.id && end?.afterAction === drag?.id && drag?.op === 'drag' &&
      drag.target === 'reader-control-motion-grabber' && drag.from === 'enter-search-state' &&
      dispatch(drag) && dispatch(end),
    'The ArkUI Cancel witness needs the exact isolated public drag and retained native terminal');
  }
  const loadingFrame = contract.assertions.find(assertion => assertion.expected?.nativeFrame === sourceReadLoadingFrame);
  const loadingFrameCase = contract.id === sourceReadLoadingCase && contract.version === 2;
  if (loadingFrameCase || loadingFrame) {
    const endpoint = contract.steps.at(-1);
    requireEvidence(loadingFrameCase && fixture.id === 'public-source-read-v1' && fixture.publicSources === true &&
      loadingFrame?.action === 'open-sources' && loadingFrame.sample === 'source-read' && !endpoint.waitFor &&
      endpoint.id === loadingFrame.sample && endpoint.kind === 'sample' && endpoint.afterAction === loadingFrame.action &&
      endpoint.keyboard === false && equalJson(endpoint.anchors,[
        'reader-source-content','reader-source-back','reader-source-footer','reader-source-list',
      ]), 'The ArkUI loading frame needs the normal public Source opening and later stable window binding');
  }
  const combinedCatalogue = contract.assertions.filter(item=>item.expected?.capturedCatalogue === true);
  const combinedReset = contract.id === 'source-management.combined-filter-reset' && contract.version === 3;
  if (combinedReset || combinedCatalogue.length || fixture.id === 'public-source-combined-filter-reset-v3') {
    requireEvidence(combinedReset && contract.pageId === 'source-management' &&
      fixture.id === 'public-source-combined-filter-reset-v3' && fixture.publicSources === true &&
      equalJson(fixture.inputs,{'zero-match':'Phase1NoMatch98417'}) &&
      combinedCatalogue.length === 1 && combinedCatalogue[0].kind === 'combined-filter-reset' &&
      combinedCatalogue[0].required === true && equalJson(combinedCatalogue[0].expected,{
        status:'unchecked',category:'novel',groupIndex:1,queryLength:18,capturedCatalogue:true,
      }), 'Combined Source reset v3 requires a captured public catalogue and its fixed no-match query');
  }
  const toolsReturn = contract.id === 'source-management.tool-return-filters' && contract.version === 2;
  const liveToolsProjection = contract.assertions.filter(item=>item.expected?.minimumProjected !== undefined);
  if (toolsReturn || liveToolsProjection.length || fixture.id === 'public-source-tools-return-v2') {
    const toolsCheck = liveToolsProjection[0];
    const focus = contract.assertions.find(item=>item.kind === 'tools-return-focus');
    const departure = contract.steps.find(step=>step.id === 'open-tools');
    requireEvidence(toolsReturn && fixture.id === 'public-source-tools-return-v2' && fixture.publicSources === true &&
      equalJson(fixture.inputs,{'public-source-prefix':'com'}) && liveToolsProjection.length === 1 &&
      toolsCheck.id === 'source.scroll.tool-return-filters' && toolsCheck.kind === 'tool-return-filters' &&
      toolsCheck.required === true && equalJson(toolsCheck.expected,{
        tolerancePx:1,status:'unchecked',category:'novel',groupIndex:1,queryLength:3,minimumProjected:15,entry:'header',
      }) && focus?.required === true && focus.expected.entry === 'header' && departure?.op === 'click' &&
      departure.gesture !== true && departure.from === 'scrolled' && equalJson(departure.target,{
        id:'reader-source-header-tools-button',ancestors:['reader-source-header-tools'],
      }), 'The public Source Tools round trip requires the fixed query, four filters and actual header Button');
  }
  if (contract.id === searchEmptyBookshelfCase || fixture.id === searchEmptyBookshelfFixture ||
      contract.steps.some(step=>step.target === emptyBookshelfEntry || step.target?.id === emptyBookshelfEntry) ||
      contract.assertions.some(item=>item.target === emptyBookshelfEntry)) {
    requireEvidence(contract.id === searchEmptyBookshelfCase && contract.version === 1 && contract.pageId === 'bookshelf' &&
      fixture.id === searchEmptyBookshelfFixture && fixture.publicSources === true && !fixture.bookTitle && !fixture.inputs &&
      searchEmptyBookshelfSteps(contract.steps,contract.assertions),
    'Empty bookshelf Search requires the exact empty card, native entry and two normal Back actions');
  }
  if (contract.id === sourceNativeFocusCase || fixture.id === sourceNativeFocusFixture ||
      contract.assertions.some(item => ['source-native-focus','source-native-semantics'].includes(item.kind))) {
    requireEvidence(contract.id === sourceNativeFocusCase && contract.version === 1 && contract.pageId === 'source-management' &&
      fixture.id === sourceNativeFocusFixture && fixture.publicSources === true &&
      sourceNativeFocusSteps(contract.steps,contract.assertions),
    'The Source native focus case needs its exact public opening, observations and guarded native keys');
  }
  if (fixture.bookTitles) {
    const titles = Object.entries(fixture.bookTitles);
    requireEvidence(fixture.bookTitle && titles.every(([role]) => Object.hasOwn(fixture.inputs ?? {}, role)) &&
      new Set([fixture.bookTitle, ...titles.map(([, title]) => title)]).size === titles.length + 1,
    'Each additional public result requires a distinct title and a registered input role');
  }
  const append = contract.id === 'bookshelf.search-append' && [3,4,5].includes(contract.version);
  const recovery = contract.id === 'bookshelf.search-retry-success' && contract.version === 1;
  const onlineRoles = append ? ['cedar','maple'] : recovery ? ['recovery'] : [];
  requireEvidence(equalJson(Object.keys(fixture.onlineResultTitles ?? {}).sort(),onlineRoles) &&
    Object.values(fixture.onlineResultTitles ?? {}).every(title => title !== fixture.bookTitle),
  'Only the scoped public pagination and retry recovery examples can declare their distinct online result titles');
  requireEvidence(contract.ownerSources.length && contract.ownerSources.every(path => ownerPath.test(path)),
    'A scoped case requires exact deployed owner source paths');
  const sharedUnknownExpand = usesSourceUnknownExpand(contract);
  if (sharedUnknownExpand || fixture.id === sourceUnknownExpandFixture || contract.steps.some(step=>step.target === sourceUnknownToggle)) {
    requireEvidence(sharedUnknownExpand && equalJson(contract.steps,sourceUnknownExpandSteps),
      'The first-opening unknown recovery requires exactly one scoped write, native center, local collapse and top-edge tap');
  }
  const body = contract.assertions.find(assertion => assertion.kind === 'recovery-body-text');
  if (sharedUnknownExpand && body) {
    requireEvidence(contract.id === 'source-management.unknown-recovery-body' &&
      body.entryAction === 'open-sources' && body.baseline === 'recovery-collapsed' &&
      body.action === 'expand-recovery' && body.sample === 'recovery-expanded' && body.expected.branch === 'unknown',
    'The first-opening recovery body requires the original center tap and complete expanded text');
  } else if (body || !sharedUnknownExpand && /^source-management\.(original|unknown)-recovery-body(-fits)?$/u.test(contract.id)) {
    const {branch,presentation} = body?.expected ?? {};
    const fits = presentation === 'fits';
    const entry = contract.steps.find(step => step.id === 'open-sources');
    const sample = contract.steps.find(step => step.id === body?.sample && step.kind === 'sample');
    const expansion = contract.steps.find(step => step.id === 'expand-recovery');
    const ordinary = contract.steps.filter(step => step.kind === 'action');
    requireEvidence(body?.evaluator === 'source' && contract.version === 1 && contract.pageId === 'source-management' &&
      contract.id === `source-management.${branch}-recovery-body${fits ? '-fits' : ''}` &&
      fixture.id === 'public-source-read-v1' && fixture.publicSources === true &&
      ordinary.length === (fits ? 2 : 3) && ordinary[0].op === 'click' &&
      ordinary[0].target === 'reader-main-tab-settings' &&
      entry === ordinary[1] && entry?.op === 'click' && entry.target === 'reader-settings-source-management' &&
      sample?.afterAction === body.action && sample.keyboard === false &&
      (fits ? expansion === undefined : expansion === ordinary[2] && expansion?.op === 'click' &&
        expansion.from === body.baseline && expansion.target === `reader-source-${branch}-expand` &&
        expansion.beforeEvent?.some(event => event.kind === 'source.recovery-title' && event.match === 'latest' &&
          event.fields?.['payload.branch'] === branch && event.fields['payload.title'] === 'clipped')),
    'Recovery notice text requires the exact public Source opening and, when folded, its ordinary Expand control');
  }
  const recoveryEdge = contract.assertions.find(assertion=>assertion.kind === 'recovery-expand-edge');
  if (sharedUnknownExpand) {
    requireEvidence(contract.id.endsWith('-touch-edge') ? sourceRecoveryExpandEdgeAssertion(contract,recoveryEdge) : !recoveryEdge,
      'Only the shared capture producer may assert a top-edge tap on the refolded notice');
  } else if (recoveryEdge || /^source-management\.(original|unknown)-recovery-expand-touch-edge$/u.test(contract.id) ||
      contract.steps.some(step=>step.id === 'expand-recovery-edge')) {
    const {branch,target} = recoveryEdge?.expected ?? {};
    const [shelf,settingsTap,settings,opening,folded,tap,expanded] = contract.steps;
    const [area] = contract.assertions.filter(assertion=>assertion.kind === 'recovery-native-control');
    requireEvidence(sourceRecoveryExpandEdgeAssertion(contract,recoveryEdge) && contract.steps.length === 7 &&
      contract.assertions.length === 2 && shelf.id === 'bookshelf' && shelf.kind === 'locate' &&
      settingsTap.id === 'open-settings' && settingsTap.from === shelf.id && settingsTap.op === 'click' &&
      settingsTap.target === 'reader-main-tab-settings' && settings.kind === 'locate' && settings.afterAction === settingsTap.id &&
      opening.id === 'open-sources' && opening.from === settings.id && opening.op === 'click' &&
      opening.target === 'reader-settings-source-management' &&
      folded.id === recoveryEdge.baseline && folded.kind === 'sample' && folded.afterAction === opening.id && folded.keyboard === false &&
      sourceRecoveryExpandEdgeStep(tap) === branch && tap.beforeEvent?.some(event=>event.kind === 'source.recovery-title' &&
        event.match === 'latest' && event.fields?.['payload.branch'] === branch && event.fields['payload.title'] === 'clipped') &&
      expanded.id === recoveryEdge.sample && expanded.kind === 'sample' && expanded.afterAction === tap.id && expanded.keyboard === false &&
      area?.id === `source.recovery.${branch}.expand-edge-target` && area.required === false && area.condition &&
      area.action === opening.id && area.sample === folded.id && area.expected?.target === target &&
      area.expected.requireNativeTouchTarget === true,
    'The public recovery edge requires exactly one local Expand action after the genuine folded condition');
  }
  const readTouch = contract.assertions.find(assertion => assertion.kind === 'retained-read-retry' ||
    assertion.kind === 'read-retry' && assertion.expected.position !== undefined);
  if (readTouch || sourceReadRetryTouchCase(contract.id) || contract.steps.some(step=>sourceReadRetryTouchStep(step,fixture))) {
    const [shelf,settingsTap,settings,open,first,back,returned,reopen] = contract.steps;
    const retained = readTouch?.kind === 'retained-read-retry';
    const base = contract.assertions[0];
    const fallback = retained ? base?.kind === 'retained-read-failure' && base?.id === readTouch.expected.conditionAssertion &&
      base.entryAction === open?.id && base.returnAction === back?.id && base.action === reopen?.id &&
      base.sample === readTouch.baseline && base.baseline === first?.id && base.expected.readFact === 'refreshFailed' &&
      base.expected.requireNativeTouchTarget === true : base?.kind === 'read-surface' &&
      base.id === 'source.load.readFailure' && base.sample === readTouch?.baseline && base.action === open?.id &&
      base.expected.state === 'readFailure';
    requireEvidence(sourceReadRetryTouchAssertion(contract,readTouch) && contract.steps.length === (retained ? 11 : 7) &&
      contract.assertions.length === 2 && contract.assertions[1] === readTouch && fallback && base.required === false &&
      base.condition && (!retained || base.condition === readTouch.condition) &&
      shelf?.id === 'bookshelf' && shelf.kind === 'locate' &&
      settingsTap?.id === 'open-settings' && settingsTap.from === shelf.id && settingsTap.op === 'click' &&
      settingsTap.target === 'reader-main-tab-settings' && settings?.id === 'settings' &&
      settings.kind === 'locate' && settings.afterAction === settingsTap.id &&
      open?.id === 'open-sources' && open.from === settings.id && open.op === 'click' &&
      open.target === 'reader-settings-source-management' && first?.kind === 'sample' && first.afterAction === open.id &&
      (!retained || first.id === 'retained-before' && back?.id === 'return-settings' && back.op === 'keyEvent' &&
        back.key === 'Back' && back.from === first.id && returned?.id === 'settings-return' &&
        returned.kind === 'locate' && returned.afterAction === back.id && reopen?.id === 'reopen-sources' &&
        reopen.op === 'click' && reopen.target === open.target && reopen.from === returned.id),
    'The public read retry requires its exact normal opening, current conditional failure and one measured subsequent click');
  }
  const controlTouch = contract.assertions.find(assertion=>assertion.kind === 'source-control-action');
  if (controlTouch || sourceControlTouchCase(contract.id) ||
      contract.steps.some(step=>sourceControlTouchStep(step,fixture))) {
    requireEvidence(sourceControlTouchAssertion(contract,controlTouch) && contract.steps.at(-1)?.id === controlTouch.action &&
      contract.assertions.length === 2 && contract.assertions[1] === controlTouch,
    'The public Source control requires one current conditional target and one separate exact center or top dispatch');
  }
  const transient = Object.hasOwn(sourceTransientStatusCases,contract.id) && sourceTransientStatusCases[contract.id];
  const transientSamples = contract.steps.filter(step=>step.captureGuard === sourceTransientStatusGuard);
  const transientChecks = contract.assertions.filter(check=>check.expected?.requireTransientStatus !== undefined);
  if (transient?.version === contract.version || transientSamples.length || transientChecks.length) {
    const [sample] = transientSamples;
    const [check] = transientChecks;
    requireEvidence(transient?.version === contract.version && contract.pageId === 'source-management' &&
      transientSamples.length === 1 && transientChecks.length === 1 && sourceTransientStatusStep(fixture,sample) === transient &&
      sample.keyboard === false && sample.quietMs === undefined &&
      sample.waitFor?.some(predicate=>predicate.kind === 'source.surface-text-layout' &&
        predicate.fields?.['payload.scope'] === transient.scope && predicate.channel === 'business') &&
      sample.waitFor.every(predicate=>!predicate.kind.startsWith('source.transient-')) &&
      check.id === transient.assertion && check.evaluator === 'source' && check.kind === 'surface-text' &&
      check.sample === sample.id && check.action === sample.afterAction && check.expected.scope === transient.scope &&
      check.expected.requireTransientStatus === true,
    'Source transient status requires the real confirmed import or retained failure with a bounded native capture');
  }
  const textConditionKinds = {
    'read-failed':'read-surface','retained-read-failed':'retained-read-failure','operation-recovery':'recovery-native-control',
  };
  for (const [index,assertion] of contract.assertions.entries()) {
    if (assertion.evaluator !== 'source' || assertion.kind !== 'surface-text') continue;
    const {scope,conditionAssertion,target} = assertion.expected;
    const sample = contract.steps.find(step => step.kind === 'sample' && step.id === assertion.sample);
    requireEvidence(sample?.afterAction === assertion.action,
      `Source text must describe the exact full sample taken after ${assertion.action}`);
    if (conditionAssertion) {
      const base = contract.assertions.slice(0,index).find(item => item.id === conditionAssertion);
      requireEvidence(base?.evaluator === 'source' && base.kind === textConditionKinds[scope] &&
        base.required === false && base.condition === assertion.condition &&
        base.sample === assertion.sample && base.action === assertion.action &&
        (scope !== 'read-failed' || base.expected.state === 'readFailure') &&
        (scope !== 'operation-recovery' || base.expected.target === target),
      `Source text condition ${conditionAssertion} must precede ${assertion.id} and govern the same native sample`);
    }
  }
  const rowActionChecks = contract.assertions.filter(assertion=>assertion.kind === 'row-status-badge' ||
    assertion.kind === 'adaptation-text' && assertion.expected.textScope === 'row-actions');
  if (rowActionChecks.length || contract.id === 'source-management.row-action-targets' && contract.version === 2) {
    const capture = contract.steps.at(-1);
    const actions = contract.steps.filter(step=>step.kind === 'action');
    const projected = capture?.waitFor?.find(predicate=>predicate.kind === 'source.projection');
    requireEvidence(contract.id === 'source-management.row-action-targets' && contract.version === 2 &&
      fixture.id === 'public-source-row-action-targets-v1' && fixture.publicSources && rowActionChecks.length === 2 &&
      rowActionChecks.some(assertion=>assertion.kind === 'row-status-badge') &&
      rowActionChecks.some(assertion=>assertion.expected.textScope === 'row-actions') &&
      actions.length === 2 && actions.every(step=>step.op === 'click') &&
      actions[0].target === 'reader-main-tab-settings' && actions[1].target === 'reader-settings-source-management' &&
      actions[1].id === 'open-sources' && capture?.kind === 'sample' && capture.id === 'source-ready' &&
      capture.afterAction === actions[1].id && capture.keyboard === false &&
      ['reader-source-row-detect-control','reader-source-row-login-control','reader-source-text-row-category',
        'reader-source-text-row-login','reader-source-row-status-unchecked'].every(id=>capture.anchors.includes(id)) &&
      projected?.match === 'latest' && projected.fields?.['payload.count'] === 1 &&
      projected.fields?.['payload.projected'] === 1 && projected.fields?.['payload.rowActions.checkState'] === 'unchecked' &&
      capture.waitFor.some(predicate=>predicate.kind === 'source.text-layout' && predicate.channel === 'business'),
    'Row actions require a normal read-only public Source opening and its fresh native Text and status carrier');
  }
  const filterTextCase = Object.hasOwn(sourceFilterTextCases,contract.id) && sourceFilterTextCases[contract.id];
  const filterTextChecks = contract.assertions.filter(assertion=>assertion.kind === 'filter-tail-text');
  if (filterTextCase || filterTextChecks.length) {
    const [check] = filterTextChecks;
    const step = id => contract.steps.find(item=>item.id === id);
    const lane = filterTextCase?.lane;
    const policy = sourceFilterTextLanes[lane];
    const viewport = sourceFilterScrollLanes[lane]?.viewport;
    const textEvent = (sample,phase)=>sample.waitFor?.some(item=>item.kind === 'source.filter-text-layout' &&
      item.channel === 'business' && item.fields?.['payload.lane'] === lane && item.fields['payload.phase'] === phase);
    requireEvidence(filterTextCase && contract.version === 1 && contract.pageId === 'source-management' &&
      fixture.publicSources === true && filterTextChecks.length === 1 && check.evaluator === 'source' &&
      check.expected.lane === lane && check.expected.widthVp === filterTextCase.widthVp &&
      policy.slices.every((slice,index)=>{
        const sample = step(slice.sample);
        const action = step(slice.action);
        return sample?.kind === 'sample' && sample.afterAction === slice.action && sample.quietMs >= 500 &&
          sample.keyboard === false && sample.anchors.includes(viewport) && action?.kind === 'action' &&
          textEvent(sample,index === 0 ? 'initial' : 'settled') &&
          (index === 0 ? action.op === 'click' && action.target === 'reader-settings-source-management' &&
            sample.waitFor.some(item=>item.kind === 'source.text-layout' && item.channel === 'business') :
            action.op === 'drag' && action.target === viewport &&
            action.from === policy.slices[index-1].sample && equalJson(action.path,sourceFilterTextDragPath(filterTextCase)));
      }), 'Source filter Text requires the normal opening and exact drag captures in the selected 2.0× window');
  }
  const historyLoading = contract.assertions.filter(assertion=>assertion.kind === 'phase-history-loading');
  if (contract.id === searchHistoryLoadingCase || historyLoading.length) {
    const [before,open,loading] = contract.steps;
    const [check] = historyLoading;
    requireEvidence(contract.id === searchHistoryLoadingCase && contract.version === 1 && contract.pageId === 'bookshelf' &&
      fixture.id === searchHistoryLoadingFixture && fixture.publicSources === true &&
      fixture.bookTitle === 'Reader Phase 1 公共长目录' && !fixture.inputs &&
      contract.steps.length === 3 && contract.assertions.length === 1 && check?.evaluator === 'search' &&
      before?.kind === 'sample' && before.id === check.baseline && before.book === true &&
      before.anchors.includes(searchHistoryEntryTarget) && open?.kind === 'action' && open.id === check.action &&
      open.from === before.id && open.op === 'click' && open.target === searchHistoryEntryTarget && !open.gesture &&
      loading?.kind === 'sample' && loading.id === searchHistoryLoadingSample && loading.id === check.sample &&
      loading.afterAction === open.id && loading.quietMs === undefined &&
      loading.waitFor?.some(item=>item.kind === searchHistoryStateEvent && item.channel === 'business' &&
        item.match === 'latest' && item.fields?.['payload.feedbackEligible'] === true),
    'History loading requires an ordinary public bookshelf opening and a condition-bound native sample');
  }
  const filterScrollChecks = contract.assertions.filter(assertion=>assertion.evaluator === 'source' && assertion.kind === 'filter-scroll');
  if (contract.id === sourceFilterScrollCase || filterScrollChecks.length) {
    const step = id => contract.steps.find(item=>item.id === id);
    requireEvidence(contract.id === sourceFilterScrollCase && contract.fixture.publicSources === true &&
      filterScrollChecks.length === Object.keys(sourceFilterScrollLanes).length &&
      Object.entries(sourceFilterScrollLanes).every(([kind,lane])=>{
        const [check] = filterScrollChecks.filter(item=>item.expected.lane === kind);
        const before = step(lane.baseline);
        const swipe = step(lane.action);
        const after = step(lane.sample);
        return check && swipe?.kind === 'action' && swipe.op === 'swipe' && swipe.target === lane.viewport &&
          swipe.from === lane.baseline && !swipe.path?.endTarget && swipe.path?.from[0] > swipe.path?.to[0] &&
          swipe.path?.from[1] === swipe.path?.to[1] && before?.kind === 'sample' && after?.kind === 'sample' &&
          before.keyboard === false && after.keyboard === false && after.afterAction === swipe.id &&
          before.anchors.includes(lane.viewport) && after.anchors.includes(lane.viewport);
      }), 'Source filter selections must prove independent horizontal scroll against both current native lanes');
  }
  const scrollTargets = contract.steps.filter(step=>step.target === sourceGroupOptionsScroll || step.target === sourceGroupOptionsTail);
  const scrollChecks = contract.assertions.filter(assertion=>assertion.evaluator === 'source' && assertion.kind === 'group-options-scroll');
  const groupTextChecks = contract.assertions.filter(assertion=>assertion.evaluator === 'source' && assertion.kind === 'group-options-text');
  if (contract.id === sourceGroupOptionsScrollCase || scrollTargets.length || scrollChecks.length || groupTextChecks.length) {
    const step = id => contract.steps.find(item=>item.id === id);
    const [gesture,pick] = scrollTargets;
    requireEvidence(contract.id === sourceGroupOptionsScrollCase && [1,2,3].includes(contract.version) &&
      contract.pageId === 'source-management' && fixture.id === sourceGroupOptionsScrollFixture &&
      fixture.publicSources === true && scrollTargets.length === 2 && scrollChecks.length === 1 &&
      step('source-ready')?.afterAction === 'open-sources' &&
      step('open-group')?.target === sourceGroupTrigger && step('open-group').from === 'source-ready' &&
      step('panel-before')?.afterAction === 'open-group' &&
      gesture.id === 'scroll-group-options' && gesture.op === 'swipe' && gesture.from === 'panel-before' &&
      gesture.target === sourceGroupOptionsScroll && equalJson(gesture.path,sourceGroupOptionsSwipePath) &&
      step('panel-tail')?.afterAction === gesture.id && pick.id === 'select-tail-option' && pick.op === 'click' &&
      pick.from === 'panel-tail' && pick.target === sourceGroupOptionsTail && step('selected-tail')?.afterAction === pick.id,
    'Native group Scroll requires its exact public panel, bounded upward swipe, and tail selection');
    const expects = (id,phase)=>step(id)?.waitFor?.some(item=>item.kind === sourceGroupTextEvent &&
      item.channel === 'business' && item.fields?.['payload.scope'] === sourceGroupTextScope && item.fields['payload.phase'] === phase);
    requireEvidence(contract.version === 1 ? groupTextChecks.length === 0 :
      groupTextChecks.length === 1 && step('panel-before').anchors.includes(sourceGroupOptionsTextHead) &&
      expects('panel-before','initial') && expects('panel-tail','settled'),
    'Native group Text requires its exact public head and tail in the initial and settled Scroll samples');
    const data = JSON.parse(readFileSync(new URL(sourceGroupOptionsScrollFixturePath,toolRoot),'utf8'));
    requireEvidence(Array.isArray(data) && data.length === 12 && data.every((record,index)=>{
      const order = String(index+1).padStart(2,'0');
      return record.bookSourceGroup === `Phase1 Scroll ${order}` && record.bookSourceName === `Phase1 Scroll Source ${order}` &&
        record.bookSourceUrl === `https://group-scroll-${order}.reader-phase1.invalid/` &&
        record.bookSourceType === 0 && record.enabled === false && record.enabledExplore === false;
    }), 'Group Scroll fixture must contain exactly twelve uniquely ordered safe disabled sources');
  }
  const detects = contract.steps.filter(step=>step.target === sourceOfflineDetectButton);
  const detectChecks = contract.assertions.filter(assertion=>assertion.kind === 'source-offline-detect');
  if ([sourceOfflineDetectCase,sourceOfflineDetectEdgeCase].includes(contract.id) || detects.length || detectChecks.length) {
    const [tap] = detects;
    const [check] = detectChecks;
    const entry = contract.steps.find(step=>step.id === check?.entryAction);
    const start = contract.steps.find(step=>step.id === check?.baseline);
    const end = contract.steps.find(step=>step.id === check?.sample);
    const waitsFor = (predicates,phase) => predicates?.some(item => item.kind === sourceOfflineDetectObservation &&
      item.channel === 'business' && item.match === 'latest' && item.fields['payload.phase'] === phase &&
      (phase !== 'ready' || item.fields['payload.definition'] === 'missing-search-url'));
    const scopedClick = (contract.id === sourceOfflineDetectCase && check?.expected?.position === undefined &&
      tap?.id === 'detect-source') || (contract.id === sourceOfflineDetectEdgeCase &&
      check?.expected?.position === 'top' && tap?.id === 'detect-source-top');
    requireEvidence(scopedClick && contract.pageId === 'source-management' && contract.version === 1 &&
      fixture.id === sourceOfflineDetectFixture && fixture.publicSources === true && detects.length === 1 && detectChecks.length === 1 &&
      check.evaluator === 'source' && check.action === tap.id &&
      entry?.op === 'click' && entry.target === 'reader-settings-source-management' &&
      start?.kind === 'sample' && start.afterAction === entry.id && start.keyboard === false &&
      start.anchors.includes(sourceOfflineDetectButton) && start.anchors.includes(sourceOfflineDetectReady) &&
      waitsFor(start.waitFor,'ready') && waitsFor(tap.beforeEvent,'ready') &&
      tap.op === 'click' && tap.from === start.id && !tap.gesture && !tap.tapEdge && !tap.wait && !tap.waitFor &&
      end?.kind === 'sample' && end.afterAction === tap.id && end.keyboard === false &&
      end.anchors.includes(sourceOfflineDetectFailed) && waitsFor(end.waitFor,'settled') &&
      contract.steps.at(-1) === end && contract.steps.at(-2) === tap && contract.steps.at(-3) === start,
    'Offline Detect requires one scoped click after the exact provider-free native ready row and its real local outcome');
  }
  const pickerLocators = contract.steps.filter(step => step.captureGuard === sourcePickerGuard);
  const pickerActions = contract.steps.filter(step => sourcePickerRole(step.target));
  const localImport = contract.steps.filter(step => step.target === sourceLocalImportButton);
  const statusEdge = contract.id === sourceStatusActionEdgeCase;
  const statusEdges = contract.steps.filter(step => step.id === 'press-research-top');
  const statusChecks = contract.assertions.filter(assertion => assertion.kind === 'import-research-status-action' &&
    assertion.expected?.position === 'top');
  if (statusEdge || statusEdges.length || statusChecks.length) {
    const [press] = statusEdges;
    const [check] = statusChecks;
    const baseline = contract.steps.find(step=>step.id === check?.baseline);
    const endpoint = contract.steps.find(step=>step.id === check?.sample);
    const waitsForRetirement = baseline?.waitFor?.some(predicate=>equalJson(predicate,sourceStatusActionEdgeWaitForRetirement));
    requireEvidence(statusEdge && [1,2].includes(contract.version) &&
      (contract.version === 1 || waitsForRetirement && baseline.quietMs >= 500) &&
      statusEdges.length === 1 && sourceStatusActionEdgeStep(press) &&
      statusChecks.length === 1 && check.id === 'source.import-research-status-action.top' &&
      check.action === press.id && check.baseline === press.from &&
      baseline?.kind === 'sample' && baseline.afterAction === 'select-source-file' &&
      endpoint?.kind === 'sample' && endpoint.id === 'search-returned' && endpoint.afterAction === press.id,
    'The Re-search upper edge requires the current public picker receipt and the bound search return');
  }
  if (statusEdge || contract.id === sourcePickerCase || fixture.publicDocument || pickerLocators.length || pickerActions.length || localImport.length) {
    requireEvidence((statusEdge || contract.id === sourcePickerCase && [1,2,3].includes(contract.version)) &&
      contract.pageId === 'source-management' &&
      fixture.id === sourcePickerFixture && fixture.publicSources && fixture.publicDocument?.basename === sourcePickerFile &&
      fixture.publicDocument.sha256 === sha256(readFileSync(new URL(sourcePickerFixturePath,toolRoot))) &&
      pickerLocators.length === sourcePickerRoles.length && pickerActions.length === sourcePickerRoles.length &&
      localImport.length === 1, 'System picker actions require the exact public Source Management case and pinned document');
    const dialog = contract.steps.find(step => step.id === 'import-dialog');
    const openDialog = contract.steps.find(step => step.id === dialog?.afterAction);
    const [openPicker] = localImport;
    requireEvidence(dialog?.kind === 'locate' && dialog.keyboard === false && dialog.quietMs >= 750 &&
      dialog.anchors.includes(sourceLocalImportButton) &&
      openDialog?.op === 'click' && openDialog.target === sourceFooterAddButton && openDialog.from === 'source-before-import' &&
      openPicker.id === 'open-picker' && openPicker.op === 'click' && openPicker.from === dialog.id && !openPicker.gesture &&
      contract.steps.indexOf(openPicker) === contract.steps.indexOf(dialog)+1,
    'Source picker must start at the current normal Add and local-file dialog');
    const actionIds = ['browse-files','open-phone-storage','open-downloads','select-source-file'];
    let previous = openPicker;
    for (const [index, role] of sourcePickerRoles.entries()) {
      const locator = pickerLocators[index];
      const action = pickerActions[index];
      const target = sourcePickerAnchor(role);
      requireEvidence(locator.kind === 'locate' && locator.keyboard === false && locator.quietMs >= 750 &&
        locator.id === `picker-${role}` &&
        equalJson(locator.anchors,[target]) && locator.afterAction === previous.id &&
        contract.steps.indexOf(locator) === contract.steps.indexOf(previous)+1 &&
        action.id === actionIds[index] && action.op === 'click' && action.from === locator.id &&
        action.target === target && !action.gesture && !action.tapEdge &&
        contract.steps.indexOf(action) === contract.steps.indexOf(locator)+1 &&
        contract.steps.filter(step => step.from === locator.id).length === 1,
      'System picker clicks must follow each exact current native carrier in order');
      previous = action;
    }
  }
  const outsideActions = contract.steps.filter(step => step.target === sourceGroupBackdrop);
  const outsideChecks = contract.assertions.filter(assertion => assertion.kind === 'group-outside-dismiss');
  if (contract.id === sourceGroupOutsideCase || outsideActions.length || outsideChecks.length) {
    const [tap] = outsideActions;
    const [check] = outsideChecks;
    const step = id => contract.steps.find(item => item.id === id);
    const baseline = step(tap?.from);
    const opening = step(check?.openAction);
    const origin = step(opening?.from);
    const endpoint = step(check?.sample);
    requireEvidence(contract.id === sourceGroupOutsideCase && contract.pageId === 'source-management' &&
      contract.fixture.id === sourceGroupOutsideFixture && contract.version === 1 &&
      outsideActions.length === 1 && outsideChecks.length === 1 &&
      tap.op === 'click' && !tap.gesture && !tap.tapEdge && !tap.waitFor && !tap.wait &&
      check.evaluator === 'source' && check.action === tap.id && check.baseline === tap.from &&
      opening?.op === 'click' && opening.target === sourceGroupTrigger &&
      [origin,baseline,endpoint].every(point => point?.kind === 'sample' && point.keyboard === false) &&
      origin.anchors.includes(sourceGroupTrigger) && baseline.afterAction === opening.id &&
      [sourceGroupBackdrop,sourceGroupPanel,sourceGroupSelected].every(id => baseline.anchors.includes(id)) &&
      endpoint.afterAction === tap.id && endpoint.quietMs >= 500 &&
      contract.steps.filter(item => item.from === baseline.id).length === 1,
    'The group outside click requires a single measured backdrop and a same-opening Source endpoint');
  }
  const scoped = new Set(pickerLocators.map(step => step.id));
  for (const [index,step] of contract.steps.entries()) {
    if (step.nativeImeKey === imeSearchProfile || step.op === imeSearchTap) {
      const sample = step.nativeImeKey ? step : contract.steps[index - 1];
      const tap = step.nativeImeKey ? contract.steps[index + 1] : step;
      const prior = contract.steps.find(action => action.id === sample?.afterAction);
      requireEvidence(contract.id === 'bookshelf.search-ime-submit' && [3,4].includes(contract.version) &&
        contract.pageId === 'bookshelf' && sample?.id === 'submit-a-ready' &&
        sample.kind === 'sample' && sample.nativeImeKey === imeSearchProfile && sample.keyboard === true &&
        sample.focus === imeSearchEditor && sample.anchors.includes(imeSearchEditor) &&
        prior?.op === 'inputText' && prior.id === 'type-a' && prior.target === imeSearchEditor &&
        tap?.op === imeSearchTap && tap.id === 'submit-a' && tap.target === imeSearchEditor &&
        tap.from === sample.id && !tap.gesture && contract.steps.filter(action => action.from === sample.id).length === 1,
      'Soft IME Search tap is limited to the immediate full sample of the typed bookshelf fixture');
    }
    if (step.nativeImeKey === directoryImeHideProfile || step.op === directoryImeHideTap) {
      const sample = step.nativeImeKey ? step : contract.steps[index - 1];
      const tap = step.nativeImeKey ? contract.steps[index + 1] : step;
      requireEvidence(['reading.control-directory-soft-ime-hide','reading.control-directory-chapter-select'].includes(contract.id) &&
        contract.pageId === 'reading' &&
        sample?.kind === 'sample' && sample.id === 'directory-editor-ime' && sample.nativeImeKey === directoryImeHideProfile &&
        sample.keyboard === true && sample.focus === directoryEditor && sample.anchors.includes(directoryEditor) &&
        sample.afterAction === 'focus-directory-editor' && tap?.op === directoryImeHideTap &&
        tap.id === 'directory-soft-ime-hide' && tap.target === directoryEditor && tap.from === sample.id &&
        !tap.gesture && contract.steps.filter(action => action.from === sample.id).length === 1,
      'The soft IME hide key is limited to the focused public Directory editor sample');
    }
    if (step.captureGuard === 'search-active-stop') {
      const submit = contract.steps.find(action => action.id === step.afterAction);
      const stop = contract.steps[index + 1];
      const source = searchSubmissionSource(submit);
      requireEvidence(contract.pageId === 'bookshelf' && step.kind === 'locate' && step.keyboard === false &&
        step.anchors.includes('reader-bookshelf-search-bar') && step.anchors.includes('reader-bookshelf-search-submit') &&
        step.anchors.filter(id => ['reader-search-public-local-result','reader-search-public-local-result-b'].includes(id)).length === 1 &&
        source && (source !== 'button' || submit.buttonSemantic === 'search') && stop?.from === step.id && stop.buttonSemantic === 'stop' &&
        contract.steps.filter(action => action.from === step.id).length === 1,
      `Guarded locator ${step.id} must only locate the immediate native Stop action`);
      scoped.add(step.id);
    }
    if (step.stateWaitMs === undefined && step.stateWaitSource === undefined) continue;
    const source = step.stateWaitSource;
    requireEvidence(Number.isInteger(step.stateWaitMs) && typeof source === 'string' && sourceRef.test(source) &&
      contract.ownerSources.includes(source.split('#')[0]) && step.kind !== 'action' && step.afterAction &&
      step.waitFor?.length > 0 && step.quietMs >= (step.kind === 'sample' ? 1500 : 125),
    `Extended wait for ${step.id} requires a deployed source, causal owner predicate and stable sample`);
  }
  for (const assertion of contract.assertions) {
    requireEvidence(typeof assertion.required === 'boolean' &&
      (assertion.required || assertion.condition) && sourceRef.test(assertion.source) &&
      !assertion.source.split('/').includes('..'),
    `Assertion ${assertion.id} needs an explicit requirement and a source-backed expectation`);
    const file = assertion.source.split('#')[0];
    requireEvidence(!ownerPath.test(file) || contract.ownerSources.includes(file),
      `Assertion ${assertion.id} expectation is not bound to the deployed owner`);
    for (const field of ['sample', 'baseline']) {
      if (typeof assertion[field] === 'string') requireEvidence(samples.has(assertion[field]) && !scoped.has(assertion[field]),
        `Assertion ${assertion.id} refers to an unknown or action-only sample`);
    }
    if (typeof assertion.action === 'string') requireEvidence(actions.has(assertion.action),
      `Assertion ${assertion.id} refers to an unknown action`);
    for (const field of ['priorAction','entryAction','returnAction','openAction','departAction','scrollAction']) {
      if (assertion[field] !== undefined && !actions.has(assertion[field])) {
        throw new Error(`Assertion ${assertion.id} refers to an unknown action in ${field}`);
      }
    }
    if (assertion.evaluator === 'search' && assertion.kind === 'phase-detail' && assertion.expected.minimumAnchorIndex !== undefined) {
      const scroll = contract.steps.find(step => step.id === assertion.scrollAction);
      const select = contract.steps.find(step => step.id === assertion.action);
      const scrolled = contract.steps.find(step => step.id === select?.from);
      requireEvidence(contract.id === 'bookshelf.search-detail-scrolled-return' &&
        scroll?.op === 'swipe' && scroll.target === 'reader-search-result-viewport' &&
        select?.op === 'click' && select.target === 'reader-search-public-local-result' &&
        scrolled?.kind === 'sample' && scrolled.afterAction === scroll.id,
      'Scrolled detail return needs an exact ordinary swipe and current native public row');
    }
    if (assertion.evaluator === 'search' && assertion.kind === 'phase-panel' && assertion.expected.nativeReturn === true) {
      const open = contract.steps.find(step => step.id === assertion.action);
      const back = contract.steps.find(step => step.id === assertion.returnAction);
      const sheet = contract.steps.find(step => step.id === back?.from);
      const after = contract.steps.find(step => step.id === assertion.sample);
      const retry = contract.steps.find(step => step.id === assertion.retryAction);
      const beforeRetry = contract.steps.find(step => step.id === retry?.from);
      requireEvidence(open?.op === 'click' && open.target === `reader-search-${assertion.expected.panel}-trigger` &&
        open.from === assertion.baseline && back?.op === 'keyEvent' && back.key === 'Back' &&
        sheet?.kind === 'sample' && sheet.afterAction === (assertion.retryAction ?? open.id) &&
        after?.kind === 'sample' && after.afterAction === back.id &&
        (assertion.retryAction === undefined || (retry?.op === 'click' && retry.target === 'reader-search-task-retry' &&
          beforeRetry?.kind === 'sample' && beforeRetry.afterAction === open.id)),
      `Assertion ${assertion.id} requires the native open, sheet Back source and restored result in order`);
    }
    if (assertion.evaluator === 'search' && assertion.kind === 'phase-filter-empty-reset') {
      const step = id => contract.steps.find(item => item.id === id);
      const click = (id, from, target) => step(id)?.op === 'click' && step(id).from === from && step(id).target === target;
      const back = (id, from) => step(id)?.op === 'keyEvent' && step(id).from === from && step(id).key === 'Back';
      const follows = (id, action) => step(id)?.afterAction === action;
      requireEvidence(contract.id === 'bookshelf.search-filter-empty-reset' && contract.fixture.publicSources === true &&
        contract.fixture.bookTitle === 'Reader Phase 1 公共长目录' && contract.fixture.inputs?.a === 'Reader' &&
        follows('unfiltered-results','submit-a') &&
        click('open-filter','unfiltered-results','reader-search-filter-trigger') && follows('filter-open','open-filter') &&
        click('select-online','filter-open','reader-search-filter-online') && follows('selected-online','select-online') &&
        back('hide-filter','selected-online') && follows('filtered-empty','hide-filter') &&
        click('reopen-filter','filtered-empty','reader-search-filter-trigger') && follows('reset-open','reopen-filter') &&
        click('reset-filter','reset-open','reader-search-filter-reset') && follows('reset-applied','reset-filter') &&
        back('close-reset','reset-applied') && follows('restored-results','close-reset'),
      'Filtered local Search results require the scoped native Online selection, empty endpoint and Reset path');
    }
    if (assertion.evaluator === 'motion' && assertion.kind === 'control-effect' && assertion.expected.effect === 'search-results') {
      const step = id => contract.steps.find(item => item.id === id);
      const includesPhase = (item, phase) => item?.waitFor?.some(wait => wait.kind === 'reading.control-effect' &&
        wait.channel === 'business' && wait.fields?.['payload.kind'] === 'search-results' && wait.fields?.['payload.phase'] === phase);
      const submit = step(assertion.expected.submitAction);
      const queryReady = step(submit?.from);
      const closeQueryIme = step(queryReady?.afterAction);
      const typed = step(step(closeQueryIme?.from)?.afterAction);
      const ready = step('results-ready');
      const refocus = step('refocus-with-results');
      const back = step(assertion.expected.backAction);
      const beforeBack = step(back?.from);
      const kept = step(assertion.baseline);
      const choose = step(assertion.action);
      const terminal = step(assertion.sample);
      requireEvidence(contract.pageId === 'reading' && contract.fixture.id === 'public-local-reading-search-result-v1' &&
        submit?.op === 'click' && submit.target === 'reader-control-search-submit' && includesPhase(submit,'published') &&
        queryReady?.keyboard === false && closeQueryIme?.op === 'keyEvent' && closeQueryIme.key === 'Back' &&
        typed?.op === 'inputText' && typed.target === 'reader-control-search-editor' && Object.hasOwn(fixture.inputs ?? {},typed.inputRole) &&
        ready?.afterAction === submit.id && ready.keyboard === false &&
        refocus?.op === 'click' && refocus.target === 'reader-control-search-field' && refocus.from === ready.id &&
        back?.op === 'keyEvent' && back.key === 'Back' && beforeBack?.afterAction === refocus.id &&
        beforeBack.keyboard === true && beforeBack.focus === 'reader-control-search-editor' &&
        kept?.afterAction === back.id && kept.keyboard === false &&
        choose?.op === 'click' && choose.target === 'reader-control-search-first-result' && choose.from === kept.id &&
        includesPhase(choose,'selection-admitted') && terminal?.afterAction === choose.id && includesPhase(terminal,'selection-committed'),
      `Assertion ${assertion.id} requires the public Quick Search submission, refocus, keyboard Back and committed row selection`);
    }
    if (assertion.evaluator === 'motion' && assertion.kind === 'control-effect' && assertion.expected.effect === 'directory-selection') {
      const step = id => contract.steps.find(item => item.id === id);
      const includesPhase = (item, phase) => item?.waitFor?.some(wait => wait.kind === 'reading.control-effect' &&
        wait.channel === 'business' && wait.fields?.['payload.kind'] === 'directory-selection' && wait.fields?.['payload.phase'] === phase);
      const hide = step('directory-soft-ime-hide');
      const kept = step(assertion.baseline);
      const choose = step(assertion.action);
      const terminal = step(assertion.sample);
      const chapterOne = wait => wait.kind === 'reading.ready' && wait.fields?.['payload.localBook'] === true &&
        wait.fields?.['payload.chapterIndex'] === 0;
      requireEvidence(contract.id === 'reading.control-directory-chapter-select' && contract.pageId === 'reading' &&
        fixture.id === 'public-local-reading-directory-chapter-v1' && fixture.bookTitle === 'Reader Phase 1 公共长目录' &&
        step('enter-reading')?.waitFor?.some(chapterOne) && choose?.beforeEvent?.some(chapterOne) &&
        hide?.op === directoryImeHideTap && kept?.kind === 'sample' && kept.keyboard === false &&
        kept.afterAction === hide.id && kept.anchors.includes(assertion.expected.nativeId) &&
        choose?.op === 'click' && choose.target === assertion.expected.nativeId && choose.from === kept.id && !choose.gesture &&
        includesPhase(choose,'selection-admitted') && terminal?.kind === 'sample' && terminal.keyboard === false &&
        terminal.afterAction === choose.id && includesPhase(terminal,'selection-committed') &&
        terminal.waitFor?.some(wait => wait.kind === 'reading.control-transition-committed' && wait.channel === 'business' &&
          wait.fields?.['payload.direction'] === 'dismiss' && wait.fields?.['payload.target.level'] === 'hidden'),
      `Assertion ${assertion.id} requires the public measured IME hide, native noncurrent chapter click and committed hidden endpoint`);
    }
    for (const field of ['editSample','movingSample','toolsSample','restoreSample','filteredSample','parentSample','entrySample','dialogSample']) {
      if (assertion[field] !== undefined && (!samples.has(assertion[field]) || scoped.has(assertion[field]))) {
        throw new Error(`Assertion ${assertion.id} refers to an unknown or action-only sample in ${field}`);
      }
    }
    if (assertion.expected?.pauseAction !== undefined) {
      const {pauseAction,openAction} = assertion.expected;
      const pause = contract.steps.find(step => step.id === pauseAction);
      const baseline = contract.steps.find(step => step.id === assertion.baseline);
      const returned = contract.steps.find(step => step.id === assertion.action);
      requireEvidence(assertion.evaluator === 'motion' && assertion.kind === 'control-effect' &&
        assertion.expected.effect === 'capsule-launch' && actions.has(openAction) &&
        pause?.kind === 'action' && pause.op === 'click' && pause.target === 'reader-session-launch-toggle' &&
        baseline?.kind === 'sample' && baseline.afterAction === pauseAction &&
        returned?.op === 'click' && returned.gesture === true && returned.from === assertion.baseline,
      `Assertion ${assertion.id} needs a paused capsule, its launch action, and a causal native center tap`);
    }
  }
  const categoryV2 = contract.id === sourceCategoryTouchEdgeCase && contract.version === 2;
  const statusV3 = contract.id === sourceFilterEdgeCase && contract.version === 3;
  if (categoryV2 || statusV3 || [sourceCategoryTouchFixture,sourceStatusTouchFixture].includes(fixture.id) ||
      contract.assertions.some(item=>item.expected?.requireNativeTouch !== undefined)) {
    requireEvidence(categoryV2 ? sourceCategoryNativeChecksValid(contract) : sourceStatusNativeChecksValid(contract),
      'The public Source filter touch case must include its required real native taps and measured endpoints');
  }
  const requireFullContainment = contract.id === sourceCategoryTouchEdgeCase && [1,2].includes(contract.version) ||
    contract.version >= 2 && [sourceFilterEdgeCase,sourceGroupOptionEdgeCase].includes(contract.id);
  const importEdges = contract.steps.filter(step => step.target === sourceInlineImportButton);
  const importChecks = contract.assertions.filter(assertion => ['source-inline-import-edge',sourceInlineImportCenterKind].includes(assertion.kind));
  const importAreas = contract.assertions.filter(assertion => assertion.kind === sourceInlineImportAreaKind);
  if (contract.id === sourceInlineImportEdgeCase || importEdges.length || importChecks.length || importAreas.length) {
    const center = contract.version === 2;
    const positions = center ? [...sourceInlineImportEdges,'center'] : sourceInlineImportEdges;
    const entry = contract.steps.find(step => step.id === 'open-sources');
    const start = contract.steps.findIndex(step => step.id === 'source-ready');
    requireEvidence(contract.id === sourceInlineImportEdgeCase && [1,2].includes(contract.version) &&
      contract.pageId === 'source-management' && fixture.id === sourceInlineImportEdgeFixture && fixture.publicSources === true &&
      entry?.op === 'click' && entry.target === 'reader-settings-source-management' && start >= 0 &&
      importEdges.length === positions.length && importChecks.length === importEdges.length &&
      importAreas.length === (center ? 1 : 0) &&
      contract.steps.length === start + 1 + importEdges.length*4,
    'Inline import declares the exact public dialog touches and their Back endpoints');
    let prior = entry;
    let baseline = contract.steps[start];
    for (const [index,tap] of importEdges.entries()) {
      const first = start + 1 + index*4;
      const [exactTap,dialog,back,returned] = contract.steps.slice(first,first+4);
      const check = importChecks.find(assertion => assertion.action === tap.id);
      const position = positions[index];
      const expectedKind = position === 'center' ? sourceInlineImportCenterKind : 'source-inline-import-edge';
      requireEvidence(exactTap === tap && tap.op === 'click' &&
        (position === 'center' ? sourceInlineImportCenterStep(tap,fixture) : tap.tapEdge === position) &&
        !tap.gesture && !tap.requireFullContainment && !tap.wait && !tap.waitFor &&
        baseline.kind === 'sample' && baseline.afterAction === prior.id && baseline.keyboard === false &&
        baseline.anchors.includes('reader-source-search') && tap.from === baseline.id &&
        dialog.kind === 'sample' && dialog.afterAction === tap.id && dialog.keyboard === false &&
        equalJson(dialog.anchors,[sourceInlineImportDialog]) && dialog.quietMs >= 500 &&
        back.op === 'keyEvent' && back.key === 'Back' && back.from === dialog.id && !back.wait && !back.waitFor &&
        returned.kind === 'sample' && returned.afterAction === back.id && returned.keyboard === false && returned.quietMs >= 500 &&
        ['reader-source-back','reader-source-list','reader-source-search'].every(id=>returned.anchors.includes(id)) &&
        check?.evaluator === 'source' && check.kind === expectedKind &&
        check.expected.target === sourceInlineImportButton && check.expected.tapEdge === tap.tapEdge &&
        check.entryAction === entry.id && check.baseline === baseline.id && check.dialogSample === dialog.id &&
        check.returnAction === back.id && check.sample === returned.id,
      'Each inline import touch must open its measured native dialog and use its first ordinary system Back');
      prior = back;
      baseline = returned;
    }
  }
  const chromeChecks = contract.assertions.filter(assertion => [sourceChromeGeometry,sourceChromeDispatch].includes(assertion.kind));
  if (contract.id === sourceChromeCase || fixture.id === sourceChromeFixture || chromeChecks.length) {
    const hasTop = contract.version === 2;
    const policies = hasTop ? [...sourceChromeActions,...sourceChromeTopActions] : sourceChromeActions;
    const numChecks = hasTop ? 12 : 8;
    const [bookshelf,settingsOpen,settings,sourceOpen,ready] = contract.steps;
    const sample = (step,id,action,anchor) => step?.id === id && step.kind === 'sample' &&
      step.keyboard === false && step.afterAction === action && step.anchors.includes(anchor);
    requireEvidence(contract.id === sourceChromeCase && [1,2].includes(contract.version) &&
      contract.pageId === 'source-management' && fixture.id === sourceChromeFixture && fixture.publicSources === true &&
      chromeChecks.length === numChecks && contract.assertions.length === numChecks && contract.steps.length === (hasTop ? 35 : 19) &&
      bookshelf.id === 'bookshelf' && bookshelf.kind === 'locate' && bookshelf.anchors.includes('reader-main-tab-settings') &&
      settingsOpen.id === 'open-settings' && settingsOpen.op === 'click' && settingsOpen.from === bookshelf.id &&
      settingsOpen.target === 'reader-main-tab-settings' &&
      sample(settings,'settings','open-settings','reader-settings-source-management') &&
      sourceOpen.id === 'open-sources' && sourceOpen.op === 'click' && sourceOpen.from === settings.id &&
      sourceOpen.target === 'reader-settings-source-management' &&
      sample(ready,'source-ready','open-sources','reader-source-list'),
    'Source chrome requires the normal public Settings entry and each exact geometry and touch proof');
    let cursor = 5;
    for (const policy of policies) {
      if (policy.baseline === sourceChromeTopEntry.sample) {
        const {parent,action,sample:initialSample} = sourceChromeTopEntry;
        const [reopen,opened] = contract.steps.slice(cursor,cursor+2);
        requireEvidence(equalJson(reopen,{...sourceOpen,id:action,from:parent}) &&
          equalJson(opened,{...ready,id:initialSample,afterAction:action}),
        'Source chrome top touches require a fresh Settings opening after the center touches');
        cursor += 2;
      }
      const [tap,opened,back,returned] = contract.steps.slice(cursor);
      const anchor = policy.kind === 'tools' ? 'reader-source-tools-back' :
        policy.kind === 'dialog' ? sourceInlineImportDialog : 'reader-settings-source-management';
      const exactTap = {id:policy.action,kind:'action',op:'click',from:policy.baseline,target:policy.target,
        ...(policy.position ? {tapEdge:policy.position} : {})};
      const exactBack = {id:policy.returnAction,kind:'action',op:'keyEvent',from:policy.opened,key:'Back'};
      requireEvidence(equalJson(tap,exactTap) && sample(opened,policy.opened ?? policy.sample,policy.action,anchor) &&
        (!policy.returnAction || equalJson(back,exactBack) && sample(returned,policy.sample,policy.returnAction,'reader-source-list')) &&
        chromeChecks.some(check=>check.evaluator === 'source' && check.kind === sourceChromeDispatch &&
          check.expected.target === policy.target && check.expected.position === policy.position) &&
        (policy.position || chromeChecks.some(check=>check.evaluator === 'source' &&
          check.kind === sourceChromeGeometry && check.expected.target === policy.target)),
      'Each Source chrome touch must use its own actual Button, measured opening, and safe normal endpoint');
      cursor += policy.returnAction ? 4 : 2;
    }
  }
  const clearTouches = contract.steps.filter(step=>step.id === sourceFilterClearAction);
  const clearTouchChecks = contract.assertions.filter(check=>check.kind === sourceFilterClearKind);
  if (contract.id === sourceFilterClearCase || fixture.id === sourceFilterClearFixture || clearTouches.length || clearTouchChecks.length) {
    const [bookshelf,openSettings,settings,open,ready,focus,ime,edit,filtered,back,empty,tap,cleared] = contract.steps;
    const editor = 'reader-source-editor';
    const click = (step,id,from,target) => step?.id === id && step.kind === 'action' && step.op === 'click' &&
      step.from === from && step.target === target;
    const measured = (step,id,afterAction,anchor,keyboard) => step?.id === id && step.kind === 'sample' &&
      step.afterAction === afterAction && step.anchors.includes(anchor) && step.keyboard === keyboard;
    requireEvidence(contract.id === sourceFilterClearCase && contract.version === 1 && contract.pageId === 'source-management' &&
      fixture.id === sourceFilterClearFixture && fixture.publicSources === true &&
      equalJson(fixture.inputs,{'zero-match':sourceFilterClearQuery}) && contract.steps.length === 13 &&
      contract.assertions.length === 4 && clearTouchChecks.length === 1 && clearTouches.length === 1 &&
      bookshelf?.id === 'bookshelf' && bookshelf.kind === 'locate' && bookshelf.anchors.includes('reader-main-tab-settings') &&
      click(openSettings,'open-settings','bookshelf','reader-main-tab-settings') &&
      settings?.id === 'settings' && settings.kind === 'locate' && settings.afterAction === openSettings.id &&
      settings.anchors.includes('reader-settings-source-management') &&
      click(open,'open-sources','settings','reader-settings-source-management') &&
      measured(ready,'source-ready','open-sources','reader-source-list',false) &&
      click(focus,'focus-editor','source-ready',editor) && measured(ime,'source-ime','focus-editor',editor,true) &&
      edit?.id === 'edit-zero-match' && edit.kind === 'action' && edit.op === 'inputText' && edit.from === 'source-ime' &&
      edit.target === editor && edit.inputRole === 'zero-match' &&
      measured(filtered,'filtered-ime','edit-zero-match',editor,true) &&
      back?.id === 'ime-back' && back.kind === 'action' && back.op === 'keyEvent' && back.key === 'Back' && back.from === 'filtered-ime' &&
      measured(empty,'zero-match','ime-back','reader-source-filtered-empty',false) && sourceFilterClearStep(tap,fixture) &&
      measured(cleared,'cleared',sourceFilterClearAction,'reader-source-list',false),
    'Clear Filters upper edge requires the exact ordinary Settings, public query, IME Back and clear sequence');
  }
  const queryV2 = contract.version === 2;
  const queryEdges = contract.steps.filter(step => sourceQueryEdgeAllowed(step.target,step.tapEdge) ||
    sourceQueryTouchPosition(step,contract.fixture) !== undefined);
  const queryChecks = contract.assertions.filter(assertion => ['source-query-edge','source-query-touch'].includes(assertion.kind));
  if (contract.id === sourceQueryEdgeCase || queryEdges.length || queryChecks.length) {
    const queryBackChecks = contract.assertions.filter(assertion => assertion.evaluator === 'source' &&
      assertion.kind === 'ime-back' && assertion.required === true && !assertion.condition);
    const step = id => contract.steps.find(item => item.id === id);
    const positions = queryV2 ? sourceQueryPositions : ['top','bottom'];
    const position = tap => queryV2 ? sourceQueryTouchPosition(tap,contract.fixture) : tap.tapEdge;
    requireEvidence(contract.id === sourceQueryEdgeCase && [1,2].includes(contract.version) && contract.pageId === 'source-management' &&
      contract.fixture.id === (queryV2 ? sourceQueryTouchFixture : sourceQueryEdgeFixture) && contract.fixture.publicSources === true &&
      queryEdges.length === positions.length && queryChecks.length === positions.length && queryBackChecks.length === positions.length &&
      queryEdges.every((tap,index)=>position(tap) === positions[index]),
    'Source query requires the scoped normal opening and its exact native tap positions');
    let previousAction = 'open-sources';
    for (const tap of queryEdges) {
      const baseline = step(tap.from);
      const check = queryChecks.find(assertion => assertion.action === tap.id);
      const endpoint = step(check?.sample);
      const backCheck = queryBackChecks.find(assertion => assertion.baseline === endpoint?.id);
      const back = step(backCheck?.action);
      const restored = step(backCheck?.sample);
      requireEvidence(tap.op === 'click' && !tap.gesture && !tap.requireFullContainment && !tap.wait && !tap.waitFor &&
        check?.evaluator === 'source' && check.kind === (queryV2 ? 'source-query-touch' : 'source-query-edge') &&
        check.expected.target === sourceQueryEditor && (queryV2 ? check.expected.position : check.expected.tapEdge) === position(tap) &&
        check.entryAction === 'open-sources' && check.baseline === baseline?.id &&
        baseline?.kind === 'sample' && baseline.afterAction === previousAction && baseline.keyboard === false &&
        baseline.anchors.includes(sourceQueryEditor) &&
        endpoint?.kind === 'sample' && endpoint.afterAction === tap.id && endpoint.keyboard === true &&
        endpoint.focus === sourceQueryEditor && endpoint.quietMs >= 500 &&
        back?.op === 'keyEvent' && back.key === 'Back' && back.from === endpoint.id &&
        restored?.kind === 'sample' && restored.afterAction === back.id && restored.keyboard === false &&
        restored.quietMs >= 500,
      'Each Source query edge requires a full normal tap, focus sample and same-page system Back');
      previousAction = back.id;
    }
  }
  const toggleV3 = contract.id === sourceToggleEdgeCase && contract.version === 3;
  if (toggleV3 || fixture.id === sourceToggleTouchFixture ||
      contract.assertions.some(assertion=>assertion.kind === 'toggle-touch')) {
    requireEvidence(sourceToggleTouchCaseValid(contract),
      'The canonical public Toggle case requires exactly four sampled state changes and a confirmed disabled restoration');
  }
  const groupV3 = contract.id === sourceGroupOptionEdgeCase && contract.version === 3;
  const groupEdge = contract.steps.find(step=>step.target === sourceGroupTrigger && step.tapEdge !== undefined);
  const groupCenter = contract.steps.find(step=>step.id === 'tap-selected-center' && step.target === sourceGroupSelected);
  const groupCenterChecks = contract.assertions.filter(item=>item.kind === 'group-option-touch-center');
  if (groupV3 || groupEdge || groupCenter || groupCenterChecks.length) {
    const step = id => contract.steps.find(item=>item.id === id);
    const edgeEndpoint = step('selected-center-open');
    const centerEndpoint = step('selected-center-dismissed');
    const nextOpen = step('open-selected');
    const [center] = groupCenterChecks;
    requireEvidence(groupV3 && fixture.id === sourceGroupOptionEdgeFixture && fixture.publicSources === true &&
      groupEdge?.id === 'open-selected-center' && groupEdge.from === 'source-ready' && groupEdge.tapEdge === 'top' &&
      edgeEndpoint?.kind === 'sample' && edgeEndpoint.afterAction === groupEdge.id && edgeEndpoint.keyboard === false &&
      [sourceGroupPanel,sourceGroupSelected].every(anchor=>edgeEndpoint.anchors.includes(anchor)) &&
      groupCenter?.op === 'click' && groupCenter.from === edgeEndpoint.id && !groupCenter.gesture &&
      !groupCenter.tapEdge && !groupCenter.requireFullContainment &&
      groupCenterChecks.length === 1 && center.action === groupCenter.id && center.openAction === groupEdge.id &&
      center.baseline === edgeEndpoint.id && center.sample === centerEndpoint?.id &&
      centerEndpoint?.kind === 'sample' && centerEndpoint.afterAction === groupCenter.id && centerEndpoint.keyboard === false &&
      nextOpen?.op === 'click' && nextOpen.target === sourceGroupTrigger && nextOpen.from === centerEndpoint.id,
    'The public group center requires a measured trigger edge, the exact selected row and a stable dismissal before reopening');
  }
  for (const step of contract.steps.filter(item => item.tapEdge !== undefined || item.requireFullContainment)) {
    if (queryEdges.includes(step) || importEdges.includes(step) || toggleV3 && sourceToggleTouchStep(step) ||
        (recoveryEdge || sharedUnknownExpand) && sourceRecoveryExpandEdgeStep(step) || readTouch && sourceReadRetryTouchStep(step,fixture) ||
        sourceControlTouchStep(step,fixture) ||
        contract.id === sourceChromeCase && sourceChromeStep(step) ||
        contract.id === sourceFilterClearCase && sourceFilterClearStep(step,fixture)) continue;
    const baseline = contract.steps.find(item => item.id === step.from);
    const toggle = sourceToggleEdgeAllowed(step.target, step.tapEdge);
    const group = sourceGroupOptionEdgeTarget(step.target);
    const bound = contract.assertions.filter(assertion => assertion.action === step.id &&
      assertion.evaluator === 'source' &&
      assertion.baseline === step.from && assertion.expected?.tapEdge === step.tapEdge &&
      ((toggle && assertion.kind === 'toggle-touch-edge' && assertion.expected.requestedEnabled === (step.tapEdge === 'top')) ||
        (group && assertion.kind === 'group-option-touch-edge' && assertion.expected.target === step.target) ||
        (groupV3 && step === groupEdge && assertion.kind === 'group-geometry' && assertion.expected.target === step.target) ||
        assertion.kind === 'filter-selection' && assertion.expected.field === assertion.expected.trigger &&
        sourceFilterEdgeTarget(assertion.expected.trigger,assertion.expected.value) === step.target) &&
      contract.steps.some(item => item.id === assertion.sample && item.kind === 'sample' && item.afterAction === step.id));
    const admittedGroup = !group || (contract.id === sourceGroupOptionEdgeCase && contract.fixture.id === sourceGroupOptionEdgeFixture);
    requireEvidence(contract.pageId === 'source-management' && contract.fixture.publicSources === true &&
      step.op === 'click' && !step.gesture && admittedGroup && (toggle ? contract.id === sourceToggleEdgeCase &&
        contract.fixture.id === sourceToggleEdgeFixture : sourceFilterEdgeAllowed(step.target,step.tapEdge)) &&
      baseline?.kind === 'sample' && baseline.anchors.includes(step.target) && baseline.keyboard === false &&
      bound.length === 1, `Action ${step.id} requires one source edge check with an exact full sample and owner outcome`);
    requireEvidence(Boolean(step.requireFullContainment) === requireFullContainment && (!requireFullContainment ||
      contract.assertions.filter(assertion => assertion.evaluator === 'source' && assertion.kind === 'filter-touch-target' &&
        assertion.sample === step.from && assertion.expected.target === step.target &&
        assertion.expected.requireFullContainment === true && assertion.required === true && !assertion.condition).length === 1),
    `Action ${step.id} must use its case's native containment policy and bind any full containment to one required baseline check`);
  }
  for (const assertion of contract.assertions.filter(item => item.expected?.tapEdge !== undefined)) {
    requireEvidence(contract.steps.some(step => step.id === assertion.action && step.tapEdge === assertion.expected.tapEdge),
      `Assertion ${assertion.id} requires an actual edge dispatch`);
  }
  if (contract.id === sourceToggleEdgeCase && !toggleV3) {
    const actions = contract.steps.filter(step => sourceToggleEdgeAllowed(step.target, step.tapEdge));
    const checks = contract.assertions.filter(assertion => assertion.kind === 'toggle-touch-edge');
    const [enable, restore] = actions;
    const enabled = checks.find(assertion => assertion.action === enable?.id);
    requireEvidence(actions.length === 2 && checks.length === 2 && enable.tapEdge === 'top' && restore.tapEdge === 'bottom' &&
      enabled?.sample === restore.from && checks.every(assertion => assertion.required === true && !assertion.condition),
    'The public source Toggle case requires a fully sampled enable and restore pair');
  }
}

export function loadCase(id) {
  const supplemental = isReservedTypographyCase(id);
  const narrow = id === sourceReservedTypographyNarrowCase;
  requireEvidence(supplemental || caseIds.includes(id), 'Select one exact registered --case');
  const path = supplemental ? 'lib/source-reserved-typography-366-font-130.json' : `cases/${id}.json`;
  const inputContract = JSON.parse(readFileSync(new URL(path, toolRoot), 'utf8'));
  const contract = validate('case', narrow ? applyReservedTypographyNarrowWindow(inputContract) : inputContract);
  const registeredPhase = supplemental || phase1CaseIds.includes(id) ? 1 : phase2CaseIds.includes(id) ? 2 : undefined;
  requireEvidence(contract.id === id && contract.phase === registeredPhase, 'Case file identity differs from its registration');
  if (supplemental || contract.fixture.id === sourceReservedTypographyFixture || usesReservedNativeToggle(contract.fixture.id) ||
      Object.hasOwn(contract.fixture.inputs ?? {}, sourceReservedTypographyInput) ||
      contract.assertions.some(assertion => assertion.kind === 'reserved-row-typography')) {
    const text = contract.assertions.filter(assertion => assertion.kind === 'reserved-row-typography');
    const input = contract.steps.filter(step => step.op === 'inputText');
    const endpoint = contract.steps.find(step => step.id === reservedSourceSample);
    const glyphWait = {kind:'source.text-layout',channel:'business',match:'latest'};
    requireEvidence(supplemental && contract.version === (narrow ? 1 : 2) && contract.pageId === 'source-management' &&
      contract.fixture.id === (narrow ? sourceReservedTypographyNarrowFixture : sourceReservedTypographyFixtureV2) &&
      contract.fixture.publicSources === true &&
      equalJson(contract.fixture.inputs, {[sourceReservedTypographyInput]:publicReservedSourceHost}) &&
      input.length === 1 && input[0].id === 'input-reserved-host' && input[0].target === 'reader-source-editor' &&
      input[0].inputRole === sourceReservedTypographyInput && text.length === 1 &&
      text[0].sample === reservedSourceSample && contract.steps.filter(step => step.kind === 'sample').length === 2 &&
      endpoint?.kind === 'sample' && endpoint.afterAction === 'hide-reserved-ime' && endpoint.keyboard === false &&
      equalJson(endpoint.waitFor,[glyphWait]),
    'Supplemental Source typography requires two real samples and the exact public reserved-row query');
  }
  const scopedCase = registeredPhase !== undefined;
  const samples = new Set();
  const actions = new Set();
  const crossoverAssertions = contract.assertions.filter(assertion => assertion.expected?.gestureCrossover === true);
  const crossoverActions = contract.steps.filter(step => step.path?.calibrationSample !== undefined);
  requireEvidence(crossoverActions.length === crossoverAssertions.length && crossoverActions.length <= 1,
    'A measured grabber crossover requires one matching release assertion');
  for (const step of contract.steps) {
    if (step.kind === 'action') {
      requireEvidence(samples.has(step.from) && (step.op === 'keyEvent') === (step.target === undefined),
        `Action ${step.id} must follow one previously measured target state`);
      requireEvidence((step.reversalReference !== undefined) === (step.op === 'grabberReversal'),
        `Action ${step.id} has an incompatible grabber reversal reference`);
      if (step.op === 'grabberReversal') {
        const full = contract.steps.find(candidate => candidate.id === step.reversalReference);
        const quick = contract.steps.find(candidate => candidate.id === step.from);
        const restore = contract.steps.find(candidate => candidate.id === quick?.afterAction);
        const reversal = contract.assertions.filter(assertion => assertion.expected?.requireReversalObservation === true);
        requireEvidence(registeredPhase === 1 && id === 'reading.control-grabber-reversal' && step.id === 'reverse-grabber' &&
          step.target === 'reader-control-motion-grabber' && !step.gesture && samples.has(step.reversalReference) &&
          full?.kind === 'sample' && full.afterAction === 'calibrate-full' && full.id === 'calibrate-full-state' &&
          quick?.kind === 'sample' && quick.afterAction === 'restore-quick' && quick.id === 'restore-quick-state' &&
          restore?.from === full.id && restore.op === 'click' && restore.target === 'reader-control-collapse' &&
          reversal.length === 1 && reversal[0].action === step.id && reversal[0].baseline === quick.id &&
          reversal[0].expected.op === step.op &&
          contract.steps.some(candidate => candidate.id === reversal[0].sample && candidate.afterAction === step.id),
        'Grabber reversal requires the preceding measured Search Full and restored Quick samples and its exact verdict');
      }
      if (step.path?.calibrationSample !== undefined) {
        const grabber = 'reader-control-motion-grabber';
        const quick = contract.steps.find(candidate => candidate.id === step.path.calibrationSample);
        const full = contract.steps.find(candidate => candidate.id === step.from);
        const expand = contract.steps.find(candidate => candidate.id === full?.afterAction);
        const [release] = crossoverAssertions;
        const endpoint = contract.steps.find(candidate => candidate.id === release.sample);
        requireEvidence(registeredPhase === 1 && id === 'reading.control-grabber-crossover' && step.id === 'crossover-grabber' &&
          step.op === 'drag' && step.target === grabber && !step.gesture && samples.has(step.path.calibrationSample) &&
          (contract.version === 1 && step.path.speed === 1200 || contract.version === 2 && step.path.transport === 'uinput') &&
          quick?.id === 'calibrate-quick-state' && quick.afterAction === 'enter-search' &&
          full?.id === 'calibrate-full-state' && full.afterAction === 'calibrate-full' &&
          [quick,full].every(state => state.kind === 'sample' && state.keyboard === false &&
            state.anchors.includes(grabber) && state.anchors.includes('reader-reading-stage')) &&
          expand?.kind === 'action' && expand.op === 'click' && expand.target === grabber && expand.from === quick.id &&
          release.action === step.id && release.baseline === full.id &&
          endpoint?.kind === 'sample' && endpoint.afterAction === step.id,
        'Grabber crossover requires exact ordered Search Quick and Full calibration samples and a release endpoint');
      }
      requireEvidence(step.op !== 'clickThenBack' || registeredPhase === 1 && id === 'reading.control-search-interrupted-back' &&
        step.id === 'interrupt-search-morph' && step.target === 'reader-control-motion-grabber' && step.gesture === true,
        'Paired input is restricted to the measured Search morph interruption');
      requireEvidence(step.op !== 'clickThenReaderCenter' || registeredPhase === 1 && step.id === 'interrupt-launch' && !step.gesture &&
        (id === 'reading.control-autopage-launch-interrupted' && step.from === 'enter-autoPage-state' &&
          step.target === 'reader-control-autopage-transport-toggle' ||
         id === 'reading.control-tts-launch-interrupted' && step.from === 'enter-tts-state' &&
          step.target === 'reader-control-tts-transport-toggle' && contract.assertions.some(assertion =>
            assertion.evaluator === 'motion' && assertion.kind === 'control-effect' && assertion.action === step.id &&
            assertion.expected.effect === 'capsule-launch' && assertion.expected.type === 'tts' &&
            assertion.expected.op === step.op && assertion.baseline === step.from && assertion.sample === 'launch-interrupted')),
        'Paired Play and reader center input requires the exact measured Quick playback interruption');
      if (scopedCase) {
        requireEvidence(step.buttonSemantic === undefined || step.op === 'click' && step.target === 'reader-bookshelf-search-submit',
          `Action ${step.id} requires the real bookshelf search button for its native semantic`);
        requireEvidence((step.op === 'inputText') === Boolean(step.inputRole && Object.hasOwn(contract.fixture.inputs ?? {}, step.inputRole)) &&
          (step.inputRole === undefined || step.op === 'inputText') &&
          (step.key === undefined || step.op === 'keyEvent') &&
          (['swipe','drag'].includes(step.op) === Boolean(step.path)) &&
          (!step.path || step.path.calibrationSample || step.path.endTarget || !equalJson(step.path.from, step.path.to)),
        `Action ${step.id} has incompatible public input, key, or gesture bindings`);
        requireEvidence(!step.target?.publicBookTitle || step.target.publicBookTitle === contract.fixture.bookTitle,
          `Action ${step.id} does not select the registered public book`);
      }
      requireEvidence(registeredPhase === 1 || step.tapEdge === undefined, 'Source filter edge actions require a Phase 1 case');
      actions.add(step.id);
    } else {
      requireEvidence(!step.afterAction || actions.has(step.afterAction),
        `Step ${step.id} must observe a previous action`);
      requireEvidence(!step.waitFor || step.afterAction, `Step ${step.id} needs a causal action for its predicates`);
      samples.add(step.id);
    }
  }
  if (scopedCase) validateScopedCase(contract, samples, actions);
  else requireEvidence(Boolean(contract.fixture.inputWord) !== Boolean(contract.fixture.bookTitle),
    'Phase 0 case requires exactly one public fixture kind');
  for (const list of [contract.steps, contract.assertions]) {
    requireEvidence(list.every(item => typeof item.id === 'string' && item.id) &&
      new Set(list.map(item => item.id)).size === list.length, 'Case contains missing or duplicated IDs');
  }
  for (const assertion of contract.assertions) publicAssertionDefinition(assertion);
  if (scopedCase) resolveStructureBindings(contract);
  return contract;
}

export function replayToolFiles(root = toolRoot) {
  const tracked = [];
  function walk(path, dependency = false) {
    for (const item of readdirSync(new URL(path, root), { withFileTypes: true })) {
      const name = path === './' ? item.name : `${path}${item.name}`;
      if (item.isDirectory() && (dependency || ['cases','lib','collectors','schema'].includes(item.name) ||
        path.startsWith('collectors/'))) {
        walk(`${name}/`, dependency);
      } else if (item.isFile() && (dependency || /\.(mjs|json)$/.test(item.name))) {
        tracked.push(name);
      } else if (dependency && !item.isDirectory()) {
        throw new Error(`Unsupported installed dependency file type: ${name}`);
      }
    }
  }
  walk('./');
  tracked.push('fixtures/search-unconfirmed-empty/public-unconfirmed-empty-source.json',
    'fixtures/search-unconfirmed-empty/public/search/unconfirmed-1.json');
  tracked.push('fixtures/source-row-actions/public-source.json');
  tracked.push(sourceOfflineDetectFixturePath);
  tracked.push(sourceGroupOptionsScrollFixturePath);
  tracked.push(sourcePickerFixturePath);
  tracked.push(...['source.json','fixture-plan.json','fixture.mjs','README.md','responses/initial-page-1.json',
    'responses/recovered-page-1.json','responses/recovered-page-2.json'].map(path=>`fixtures/search-retry-recovery/${path}`));
  tracked.push(...grabberReversalRunnerInputs);
  tracked.push(...readCapsuleModelInputs(root).map(path => `../../${path}`));
  tracked.push('README.md', '../lib/native-ui-evidence.mjs', '../reader-control-device-probe.mjs',
    '../reader-hdc-lease.mjs', '../reader-hdc-foreground.mjs', '../page-structure/register.json',
    '../page-structure/model.json',
    '../../scripts/hap-pipeline.mjs', '../../scripts/lib/hap-delivery-evidence.mjs',
    '../../scripts/lib/app-build-identity.mjs', '../../scripts/lib/runner-installed-metadata.mjs');
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
  for (const [path, metadata] of Object.entries(lock.packages)) {
    if (path === '') continue;
    requireEvidence(path.startsWith('node_modules/') && path === posix.normalize(path) && !path.includes('\\') &&
      typeof metadata.version === 'string' && lstatSync(new URL(path, root)).isDirectory(),
    `Invalid locked dependency location: ${path}`);
    const installed = JSON.parse(readFileSync(new URL(`${path}/package.json`, root), 'utf8'));
    requireEvidence(installed.version === metadata.version, `Installed version differs from package lock: ${path}`);
    walk(`${path}/`, true);
  }
  return [...new Set(tracked)].sort();
}

export function toolIdentity(root = toolRoot) {
  const inputs = replayToolFiles(root).map(path => ({ path, sha256: sha256(readFileSync(new URL(path, root))) }));
  return { version: 'phase1.0', sha256: jsonDigest(inputs) };
}

export function pageStatus(pageId) {
  const register = JSON.parse(readFileSync(new URL('../page-structure/register.json', toolRoot), 'utf8'));
  const registered = register.pages.find(page => page.pageId === pageId);
  return { id: pageId, registration: registered ? 'REGISTERED_PAGE' : 'UNREGISTERED_PAGE' };
}

export const sources = Object.freeze({
  'native-tree': ['normal Reader window', 'accessibility ID', 'native bounds px', 'exposed node states'],
  'window-metrics': ['window revision', 'window rect and density', 'native keyboard rectangles and insets'],
  'app-input': ['editor mount and focus', 'length and selection', 'search button intent'],
  'app-owner': ['accepted query revision', 'result settlement', 'reader control session and commits'],
  'debug-frame': ['runtime frame callback', 'native fields as read', 'field availability', 'read overhead'],
});

export function platformCapabilities(platform) {
  requireEvidence(['harmonyos','android','ios'].includes(platform), 'Unknown collector platform');
  return Object.fromEntries(Object.entries(sources).map(([source, fields]) => [source, {
    status: platform === 'harmonyos' ? 'AVAILABLE_BY_FIELD' : 'UNSUPPORTED',
    fields: platform === 'harmonyos' ? fields : [],
  }]));
}

export function planCase(contract, platform) {
  const capabilities = platformCapabilities(platform);
  let structure;
  if (contract.phase === 1 || contract.structure !== undefined) {
    const definition = loadStructureDefinition();
    const rules = new Map(definition.structureRules.map(rule => [rule.id, rule]));
    structure = {
      selectors: definition.structureSelectors,
      bindings: resolveStructureBindings(contract, definition).map(({rule, ...binding}) =>
        ({...binding, rules:structureRuleOrder(rule.id, rules)})),
    };
  }
  return { caseId: contract.id, caseVersion: contract.version, caseSha256: jsonDigest(contract),
    mode: 'DRY_RUN', execution: 'NOT_RUN', platform, fixture: contract.fixture, page: pageStatus(contract.pageId),
    capabilities, capturePlan: planCapture(contract, capabilities, structure), steps: contract.steps,
    ...(contract.steps.some(step => step.op === 'grabberReversal') ?
      {nativeInput:{op:'grabberReversal', execution:'NOT_RUN', reason:grabberReversalUnavailable,
        runnerSources:grabberReversalRunnerInputs}} : {}),
    assertions: contract.assertions.map(assertion => ({ ...assertion, verdict: 'NOT_RUN' })) };
}

export const equalJson = (left, right) => canonicalAppJson(left) === canonicalAppJson(right);
