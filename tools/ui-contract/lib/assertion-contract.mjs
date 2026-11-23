import { conditionBoundSourceKinds, sourceReadLoadingFrame, sourceReadStates } from './source-read.mjs';
import { sourceFilterCarrierAllowed, sourceFilterEdgeAllowed, sourceFilterEdgeTarget, sourceGroupOptionEdgeTarget } from './source-filter-edge.mjs';
import { sourceNativeControlAllowed } from './source-native-control.mjs';
import { sourceFilterScrollLanes } from './source-filter-scroll.mjs';
import { sourceFilterTextLanes } from './source-filter-tail-text.mjs';
import { sourceGroupBackdrop } from './source-group-outside.mjs';
import { sourceQueryEdgeAllowed, sourceQueryEditor, sourceQueryPositions } from './source-query-edge.mjs';
import { isSourceNativeFocusAssertion } from './source-native-focus.mjs';
import { sourceInlineImportAreaKind, sourceInlineImportButton, sourceInlineImportCenterAction, sourceInlineImportCenterKind,
  sourceInlineImportEdgeAllowed } from './source-inline-import-edge.mjs';
import { sourceChromePolicy } from './source-chrome-dispatch.mjs';
import { sourceFilterClearAction, sourceFilterClearAssertion, sourceFilterClearKind, sourceFilterClearTarget } from './source-filter-clear-edge.mjs';
import { sourceOfflineDetectButton } from './source-offline-detect.mjs';
import { sourceRecoveryControl } from './source-recovery-control.mjs';
import { sourceToggleEdgeTarget } from './source-toggle-edge.mjs';
import { sourceControlTouchPolicy } from './source-control-touch.mjs';

// The shape of a check's definition belongs to its evaluator, not the
// evidence it happens to receive. Trajectory details remain evaluator-owned.
const shapes = {
  layout: {
    gap: 'number',
    align: 'number',
    nonOverlap: {maxOverlapAreaVp2:'number'},
    contain: {maxOverflowVp:'number'},
    clip: {enabled:'boolean?',shape:'string?',minClippedAreaVp2:'number?'},
    visibleFraction: {minFraction:'number',enabled:'boolean?'},
    keyboardAvoidance: {maxOverlapAreaVp2:'number'},
    relativeDelta: {dx:'number',dy:'number'},
  },
  search: {
    entry: {route:'string'},
    focus: {focused:'boolean',length:'number'},
    'ime-before-input': {visible:'boolean',beforeInput:'boolean'},
    'edit-selection': {length:'number',start:'number',end:'number'},
    submit: {length:'number',semantic:'string'},
    'results-settled': {mode:'string',nativeProjection:'strings'},
    'phase-projection': {
      mode:'string',projections:'strings',searchActive:'boolean',node:'string?',sourceRequiredReason:'string?',
      source:'string?',operation:'string?',resultCount:'number?',failedCount:'number?',skippedCount:'number?',
      incompleteCount:'number?',stopped:'boolean?',localFailed:'boolean?',sourceListFailed:'boolean?',
      confirmedEmpty:'boolean?',nativeConfirmedEmpty:'boolean?',nativeUnconfirmedEmpty:'boolean?',publicResult:'string|boolean?',
      forbidEarlierPublicResult:'boolean?',positiveFact:'string?',
      httpResponseStatus:'number?',requirePendingFirstAttempt:'boolean?',
    },
    'phase-back': {consumer:'string',previousMode:'string?',publicBook:'boolean?',requireSameNativeEditor:'boolean?'},
    'phase-source-load-retry': {state:'string',exclusiveRead:'boolean?'},
    'phase-history-loading': {length:'number'},
    'phase-empty-rerun': {confirmedEmpty:'boolean'},
    'phase-edit': {initialLength:'number',length:'number',start:'number',end:'number'},
    'phase-submit': {source:'string',length:'number'},
    'phase-operation': {action:'string',publicResult:'string?',requireSamePublicBook:'boolean?',
      requirePageThreeEnd:'boolean?',requirePageThreeDemand:'boolean?',requireFirstPageReceipt:'boolean?'},
    'phase-detail': {sameQuery:'boolean',anchorToleranceVp:'number',verifyNativeList:'boolean?',
      requireVisibleContent:'boolean?',terminalOperation:'string?',minimumAnchorIndex:'number?'},
    'phase-reedit': {mode:'string',focused:'boolean',keyboardVisible:'boolean',retired:'boolean'},
    'phase-clear': {beforeLength:'number',afterLength:'number'},
    'phase-obsolete': {discarded:'boolean',requireResultBatch:'boolean'},
    'phase-relative': {dx:'number',dy:'number'},
    'phase-panel': {panel:'string',nativeReturn:'boolean?'},
    'phase-filter-empty-reset': {resultCount:'number'},
    'phase-task-retry': {operation:'string',resultCount:'number',failedCount:'number',
      requireRetainedWhileRefreshing:'boolean?',requireSamePublicBook:'boolean?',httpResponseStatus:'number?',recoveredResult:'string?'},
  },
  source: {
    route: {action:'string',from:'string',to:'string',anchor:'string'},
    'route-parent-after-tools': {parent:'string'},
    'load-state': {state:'string',readFact:'string',anchor:'string'},
    'read-surface': {state:'string',nativeFrame:'string?'},
    'read-retry': {state:'string',requireNativeTouchTarget:'boolean?',position:'string?'},
    'retained-read-failure': {readFact:'string',requireNativeTouchTarget:'boolean?'},
    'retained-read-retry': {target:'string',position:'string',conditionAssertion:'string'},
    'recovery-native-control': {target:'string',requireNativeTouchTarget:'boolean'},
    'source-control-action': {
      target:'string',position:'string',branch:'string',control:'string',conditionAssertion:'string',
    },
    'recovery-body-text': {branch:'string',presentation:'string?'},
    'recovery-expand-edge': {branch:'string',target:'string',tapEdge:'string'},
    'import-research-status-action': {target:'string',keywordLength:'number',position:'string?'},
    'group-options-scroll': {groupIndex:'number',sourceCount:'number'},
    'group-options-text': {groupIndex:'number',sourceCount:'number'},
    'surface-text': {scope:'string',conditionAssertion:'string?',target:'string?',requireTransientStatus:'boolean?'},
    'observed-load-branch': {state:'string',readFacts:'strings',anchors:'strings'},
    compensation: {tolerancePx:'number'},
    'filter-layout': {expanded:'boolean',compactGapVp:'number',expandedGapVp:'number',tolerancePx:'number',minWidthVp:'number?'},
    'filter-selection': {trigger:'string',field:'string',value:'string|number',tapEdge:'string?',nativeSelection:'boolean?',
      requireNativeTouch:'boolean?'},
    'filter-scroll': {lane:'string'},
    'filter-tail-text': {lane:'string',widthVp:'number'},
    'native-control-target': {target:'string'},
    'filter-touch-target': {target:'string',requireFullContainment:'boolean?',requireLocatorCenter:'boolean?'},
    'group-option-touch-edge': {target:'string',tapEdge:'string',groupIndex:'number'},
    'group-option-touch-center': {target:'string',position:'string',groupIndex:'number'},
    'source-query-edge': {target:'string',tapEdge:'string'},
    'source-query-touch': {target:'string',position:'string'},
    'source-native-focus': {stage:'string'},
    'source-native-semantics': {stage:'string'},
    'source-inline-import-edge': {target:'string',tapEdge:'string'},
    'source-inline-import-center': {target:'string'},
    'source-inline-import-area': {target:'string'},
    'source-chrome-geometry': {target:'string'},
    'source-chrome-dispatch': {target:'string',position:'string?'},
    'source-offline-detect': {target:'string',l1:'string',l2:'string',position:'string?'},
    'toggle-touch-target': {},
    'toggle-touch-edge': {tapEdge:'string',requestedEnabled:'boolean'},
    'toggle-touch': {target:'string',position:'string',requestedEnabled:'boolean'},
    'group-geometry': {withinHost:'boolean',anchored:'boolean',target:'string?',tapEdge:'string?'},
    'group-outside-dismiss': {target:'string'},
    'group-back': {consumer:'string',staysOnPage:'boolean'},
    adaptation: {
      minWidthVp:'number',maxWidthVp:'number',minFontScale:'number',maxFontScale:'number',rowActions:'number',
      footerActions:'number',tolerancePx:'number',minimumFooterHeightVp:'number?',
    },
    'adaptation-surface': {
      expanded:'boolean',minWidthVp:'number',maxWidthVp:'number',minFontScale:'number',maxFontScale:'number',
      statsLineHeightFp:'number',tolerancePx:'number',
    },
    'adaptation-text': {
      expanded:'boolean',minWidthVp:'number',maxWidthVp:'number',minFontScale:'number',maxFontScale:'number',
      statsLineHeightFp:'number',tolerancePx:'number',rowLabels:'boolean?',requireNativeFontReadback:'boolean?',
      requireCurrentTextProjection:'boolean?',textScope:'string?',requireFirstRowToggleOff:'boolean?',
    },
    'reserved-row-typography': {
      expanded:'boolean',minWidthVp:'number',maxWidthVp:'number',minFontScale:'number',maxFontScale:'number',
      statsLineHeightFp:'number',tolerancePx:'number',requireNativeFontReadback:'boolean',
      requireCurrentTextProjection:'boolean',
    },
    'row-status-badge': {state:'string'},
    'ime-back': {staysOnPage:'boolean'},
    'filtered-empty': {state:'string',countPositive:'boolean',projected:'number'},
    'clear-filters': {state:'string',queryLength:'number',allFiltersDefault:'boolean'},
    'source-filter-clear-touch': {target:'string',position:'string'},
    'combined-filter-reset': {
      status:'string',category:'string',groupIndex:'number',queryLength:'number',count:'number?',projectedBeforeEdit:'number?',
      capturedCatalogue:'boolean?',
    },
    'fixed-scroll': {tolerancePx:'number',requireNativeSwipe:'boolean?'},
    'reset-scroll': {trigger:'string',tolerancePx:'number'},
    'tool-return': {tolerancePx:'number'},
    'tool-return-filters': {
      tolerancePx:'number',status:'string',category:'string',groupIndex:'number',queryLength:'number',
      projected:'number?',minimumProjected:'number?',entry:'string?',
    },
    'tools-return-focus': {focused:'boolean',entry:'string?'},
    'footer-end': {maxOverlapAreaVp2:'number',minFraction:'number',requireFreshEnd:'boolean?'},
    'fixed-insets': {tolerancePx:'number'},
  },
  motion: {
    'control-open': {open:'boolean'},
    'control-dismiss': {hidden:'boolean'},
    'motion-open': {
      durationMs:'number',dockTravelVp:'number',layoutToleranceVp:'number',opacityTolerance:'number',
      transformTolerance:'number',cadenceGapFactor:'number',actors:'strings',
    },
    'motion-dismiss': {
      durationMs:'number',dockTravelVp:'number',layoutToleranceVp:'number',opacityTolerance:'number',
      transformTolerance:'number',cadenceGapFactor:'number',actors:'strings',
    },
    'control-transition': {
      op:'string',direction:'string',origins:'strings',source:'object',target:'object',
      commandDurationMs:'number|null',endpointOpacityTolerance:'number',ownerSources:'strings',trajectory:'object?',
      requirePanelBack:'boolean?',outcome:'string?',nativeSource:'object?',releaseMotion:'boolean?',
      requireReleaseObservation:'boolean?',requireCancelObservation:'boolean?',requireReversalObservation:'boolean?',gestureCrossover:'boolean?',
      requirePlatformCancelDispatch:'boolean?',
      maximumFrameGapMs:'number?',minimumInteriorFrames:'number?',
    },
    'control-interruption': {
      op:'string',predecessor:'object',successor:'object',nominalCollapseMs:'number',
      ownerSources:'strings',endpointOpacityTolerance:'number',
    },
    'control-effect': {
      effect:'string',op:'string',ownerSources:'strings',nativeId:'string?',module:'string?',visible:'boolean?',
      opacityTolerance:'number?',layoutToleranceVp:'number?',nativeZ:'number?',requiresFramePath:'boolean?',
      openAction:'string?',type:'string?',kind:'string?',form:'string?',requiresSystemSpeech:'boolean?',
      transformTolerance:'number?',cadenceGapFactor:'number?',editorId:'string?',tab:'string?',consumer:'string?',
      requireNativeRowDisplacement:'boolean?',requireStablePopupProjection:'boolean?',
      restoreAction:'string?',editorLayerRelease:'boolean?',minimumIncreaseVp:'number?',softImeHide:'boolean?',
      font:'string?',fontSwap:'object?',shiftDurationMs:'number?',settleDurationMs:'number?',nativeOwnerType:'string?',triggers:'array?',
      pauseAction:'string?',submitAction:'string?',backAction:'string?',
      actions:'array?',modalEditor:'object?',requireNoPanelRequest:'boolean?',inlineSearchEditor:'boolean?',
      requireAutoPagePauseRetention:'boolean?',requireSelectableDirectoryRow:'boolean?',requireQuickTtsNativeTransport:'boolean?',
      chapterIndex:'number?',
    },
  },
};

const common = ['id','evaluator','kind','expected','source','sources','required','condition','sample','baseline','action'];
const parameters = {
  layout: {
    gap:['a','b','axis','branch','tolerancePx'],
    align:['a','b','axis','branch','tolerancePx'],
    contain:['a','b','tolerancePx'],
    nonOverlap:['a','b'],
    clip:['a','b','mode'],
    visibleFraction:['a','basis','includeKeyboard'],
    keyboardAvoidance:['a'],
    relativeDelta:['a','anchor','branch','tolerancePx','sameContinuity'],
  },
  search: {
    'phase-projection':['target'],
    'phase-edit':['priorAction','entryAction'],
    'phase-submit':['priorAction','target'],
    'phase-empty-rerun':['priorAction'],
    'phase-operation':['target','priorAction','priorSource','priorTarget'],
    'phase-detail':['priorAction','returnAction','scrollAction'],
    'phase-reedit':['priorAction'],
    'phase-obsolete':['priorAction'],
    'phase-relative':['a','anchor','branch','tolerancePx','sameContinuity'],
    'phase-panel':['returnAction','retryAction'],
    'phase-filter-empty-reset':['priorAction'],
    'phase-task-retry':['openAction','priorAction'],
  },
  source: {
    route:['entryAction'],
    'route-parent-after-tools':['entryAction','parentSample','entrySample','departAction','toolsSample','returnAction'],
    'read-retry':['entryAction'],
    'retained-read-failure':['entryAction','returnAction'],
    'recovery-body-text':['entryAction'],
    'recovery-expand-edge':['entryAction'],
    'import-research-status-action':['entryAction'],
    'group-options-text':['entryAction','openAction'],
    'group-options-scroll':['entryAction','openAction','scrollAction'],
    'filtered-empty':['editSample'],
    'combined-filter-reset':['entrySample','filteredSample'],
    'group-option-touch-edge':['openAction'],
    'group-option-touch-center':['openAction'],
    'source-query-edge':['entryAction'],
    'source-query-touch':['entryAction'],
    'source-native-focus':['entryAction'],
    'source-native-semantics':['entryAction'],
    'source-inline-import-edge':['entryAction','dialogSample','returnAction'],
    'source-inline-import-center':['entryAction','dialogSample','returnAction'],
    'source-offline-detect':['entryAction'],
    'group-outside-dismiss':['openAction'],
    'tool-return':['departAction','toolsSample'],
    'tool-return-filters':['departAction','toolsSample','priorAction','filteredSample'],
    'tools-return-focus':['departAction','toolsSample'],
    'fixed-insets':['movingSample','toolsSample','restoreSample','departAction','returnAction'],
  },
};

const conditionalKinds = {
  search: ['phase-projection','phase-back','phase-operation','phase-obsolete','phase-source-load-retry','phase-history-loading'],
  source: ['observed-load-branch', 'surface-text', 'source-control-action', ...conditionBoundSourceKinds],
  motion: ['control-effect','control-transition'],
};
const object = value => value && typeof value === 'object' && !Array.isArray(value);

function hasType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'number') return Number.isFinite(value);
  if (type === 'object') return Boolean(object(value));
  if (type === 'array') return Array.isArray(value);
  if (type === 'strings') return Array.isArray(value) && value.every(item => typeof item === 'string' && item.length);
  if (type === 'string') return typeof value === 'string' && value.length > 0;
  return typeof value === type;
}

export function publicAssertionDefinition(assertion) {
  const {evaluator, kind, expected, id} = assertion;
  const definitions = shapes[evaluator];
  if (!definitions || !Object.hasOwn(definitions, kind)) throw new Error(`Assertion ${id}: unknown ${evaluator} relationship ${kind}`);
  const shape = definitions[kind];
  const fields = parameters[evaluator]?.[kind] ?? [];
  if (Object.keys(assertion).some(key => !common.includes(key) && !fields.includes(key))) {
    throw new Error(`Assertion ${id}: unsupported ${evaluator}/${kind} parameter`);
  }
  if (assertion.condition && (assertion.required !== false || !conditionalKinds[evaluator]?.includes(kind))) {
    throw new Error(`Assertion ${id}: condition cannot guard ${evaluator}/${kind}`);
  }
  if (typeof shape === 'string') {
    if (!hasType(expected, shape)) throw new Error(`Assertion ${id}: expected a ${shape}`);
  } else {
    if (!object(expected) || Object.keys(expected).some(key => !Object.hasOwn(shape, key))) {
      throw new Error(`Assertion ${id}: unsupported expected field for ${evaluator}/${kind}`);
    }
    for (const [key, type] of Object.entries(shape)) {
      if (type.endsWith('?') && !Object.hasOwn(expected, key)) continue;
      if (!type.replace(/\?$/u, '').split('|').some(choice => hasType(expected[key], choice))) {
        throw new Error(`Assertion ${id}: invalid or missing expected.${key}`);
      }
    }
  }
  if (evaluator === 'search' && kind === 'phase-history-loading' &&
      (assertion.required !== false || !assertion.condition || !assertion.action || !assertion.baseline || !assertion.sample ||
        expected.length !== 0 || !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: history loading needs the current native input window, owner and empty opening draft`);
  }
  if (evaluator === 'motion' && kind === 'control-transition') {
    const {requireReleaseObservation, requireCancelObservation, releaseMotion, maximumFrameGapMs, minimumInteriorFrames, trajectory} = expected;
    if (Object.hasOwn(expected,'gestureCrossover') && (expected.gestureCrossover !== true ||
        assertion.required !== true || assertion.condition || !assertion.action || !assertion.baseline || !assertion.sample ||
        expected.op !== 'drag' || expected.direction !== 'dismiss' || expected.origins.length !== 1 ||
        expected.origins[0] !== 'grabber-release' || expected.source.level !== 'secondary' ||
        expected.source.module !== 'search' || expected.source.form !== 'quick' || expected.nativeSource?.level !== 'secondary' ||
        expected.nativeSource.module !== 'search' || expected.nativeSource.form !== 'full' ||
        expected.target.level !== 'hidden' || !requireReleaseObservation || requireCancelObservation ||
        expected.requireReversalObservation || expected.outcome === 'interrupted')) {
      throw new Error('A grabber crossover requires the normal measured Full to Quick to Hidden release');
    }
    if (expected.requireReversalObservation === true && (assertion.required !== false || !assertion.condition ||
        !assertion.action || !assertion.baseline || !assertion.sample || !requireReleaseObservation || requireCancelObservation ||
        expected.op !== 'grabberReversal' || expected.direction !== 'morph' || expected.origins.length !== 1 ||
        expected.origins[0] !== 'grabber-release' ||
        expected.source.form !== 'full' || expected.target.form !== 'quick' || expected.nativeSource?.form !== 'quick' ||
        expected.outcome === 'interrupted')) {
      throw new Error(`Assertion ${id}: native reversal requires a held Full morph and an observed UP back to Quick`);
    }
    if (requireCancelObservation === true && (!assertion.condition || !assertion.action || !assertion.baseline || !assertion.sample ||
        expected.op !== 'drag' || expected.direction !== 'morph' || expected.origins.length !== 1 ||
        expected.origins[0] !== 'grabber-cancel' || !expected.nativeSource || !trajectory || !maximumFrameGapMs ||
        !minimumInteriorFrames ||
        releaseMotion || requireReleaseObservation || expected.outcome === 'interrupted')) {
      throw new Error(`Assertion ${id}: native Cancel requires a conditional grabbed drag and its successor motion`);
    }
    if (Object.hasOwn(expected,'requirePlatformCancelDispatch') && (expected.requirePlatformCancelDispatch !== true ||
        requireCancelObservation !== true || id !== 'reading.control-grabber-cancel.restore-quick')) {
      throw new Error(`Assertion ${id}: an ArkUI Cancel dispatch witness is scoped to the exact conditional grabber case`);
    }
    if (assertion.condition && requireCancelObservation !== true && expected.requireReversalObservation !== true) {
      throw new Error(`Assertion ${id}: only native Cancel or reversal can guard a control transition`);
    }
    if ((requireReleaseObservation && (!releaseMotion || !maximumFrameGapMs || !minimumInteriorFrames)) ||
        (maximumFrameGapMs !== undefined && (!trajectory || maximumFrameGapMs <= 0)) ||
        (minimumInteriorFrames !== undefined && (!trajectory || !Number.isSafeInteger(minimumInteriorFrames) ||
          minimumInteriorFrames <= 0))) {
      throw new Error(`Assertion ${id}: invalid control motion observation or cadence limits`);
    }
  }
  if (evaluator === 'motion' && kind === 'control-effect' && expected.fontSwap) {
    const {gridId,targetFont,targetId} = expected.fontSwap;
    if (expected.effect !== 'font-reorder' || expected.op !== 'drag' || !assertion.action || !assertion.baseline || !assertion.sample ||
        Object.keys(expected.fontSwap).length !== 3 || gridId !== 'reader-control-font-grid' ||
        !hasType(expected.font,'string') || !hasType(targetFont,'string') || expected.font === targetFont ||
        expected.nativeId !== `reader-control-font-${expected.font}` || targetId !== `reader-control-font-${targetFont}` ||
        !(expected.layoutToleranceVp > 0 && expected.layoutToleranceVp <= 1)) {
      throw new Error(`Assertion ${id}: native font exchange requires two distinct font slots under the real grid`);
    }
  }
  if (evaluator === 'motion' && kind === 'control-effect' && expected.requireSelectableDirectoryRow === true &&
      (expected.effect !== 'keyboard-back' || expected.module !== 'directory' || expected.tab !== 'directory' ||
       expected.nativeId !== 'reader-control-module-directory' || expected.editorId !== 'reader-control-directory-query-directory' ||
       expected.restoreAction !== 'focus-directory-editor' ||
       !(expected.op === 'tapImeHide' && expected.softImeHide === true ||
         expected.op === 'keyEvent' && expected.editorLayerRelease === true) ||
       !assertion.action || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: a selectable chapter row must follow the retained Full Directory editor and keyboard hide`);
  }
  if (evaluator === 'motion' && kind === 'control-effect' && expected.requireQuickTtsNativeTransport === true &&
      (expected.effect !== 'capsule-launch' || expected.op !== 'click' || expected.type !== 'tts' ||
       expected.kind !== 'quickTts' || expected.form !== 'quick' || expected.requiresSystemSpeech !== true ||
       expected.openAction !== 'playback-launch' || expected.pauseAction !== 'pause-playback' ||
       assertion.action !== 'return-from-capsule' || assertion.baseline !== 'capsule-paused' || assertion.sample !== 'capsule-returned')) {
    throw new Error(`Assertion ${id}: the native Quick TTS transport requires the system speech launch, pause and return`);
  }
  if (evaluator === 'motion' && kind === 'control-effect' && expected.op === 'clickThenReaderCenter' && expected.type === 'tts' &&
      (expected.effect !== 'capsule-launch' || expected.kind !== 'quickTts' || expected.form !== 'quick' ||
       expected.requiresSystemSpeech !== true || assertion.required !== false || !assertion.condition ||
       assertion.action !== 'interrupt-launch' || assertion.baseline !== 'enter-tts-state' || assertion.sample !== 'launch-interrupted')) {
    throw new Error(`Assertion ${id}: Quick TTS interruption requires an exact paired input, the same system speech owner and its return endpoint`);
  }
  if (evaluator === 'motion' && kind === 'control-effect' && expected.requireAutoPagePauseRetention === true &&
      (expected.effect !== 'capsule-launch' || expected.op !== 'click' || expected.type !== 'autoPage' ||
       expected.kind !== 'quickAutoPage' || expected.form !== 'quick' || expected.openAction !== 'playback-launch' ||
       expected.pauseAction !== 'pause-playback' || !assertion.action || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: retained AutoPage pause requires the Quick launch, manual pause and native return`);
  }
  if (evaluator === 'motion' && kind === 'control-effect' && expected.inlineSearchEditor === true &&
      (expected.effect !== 'keyboard-back' || expected.op !== 'keyEvent' || expected.consumer !== 'keyboard' ||
       expected.nativeId !== 'reader-control-module-search' || !expected.openAction || !assertion.action ||
       !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: native Search editor retention requires the focus action, keyboard Back and both samples`);
  }
  if (evaluator === 'motion' && kind === 'control-effect' &&
      (expected.effect === 'search-results' || expected.submitAction !== undefined || expected.backAction !== undefined) &&
      (expected.effect !== 'search-results' || expected.op !== 'click' || expected.nativeId !== 'reader-control-module-search' ||
       !expected.submitAction || !expected.backAction || !assertion.action || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: choosing a Quick Search result requires its submit, keyboard Back, and native selection endpoint`);
  }
  if (evaluator === 'motion' && kind === 'control-effect' &&
      (expected.effect === 'directory-selection' || expected.chapterIndex !== undefined) &&
      (expected.effect !== 'directory-selection' || expected.op !== 'click' || expected.chapterIndex !== 1 ||
       expected.nativeId !== 'reader-control-directory-chapter:1' || !assertion.action || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: selecting the public chapter requires the exact native Directory target and both endpoints`);
  }
  if (evaluator === 'search' && kind === 'phase-back' && expected.requireSameNativeEditor === true &&
      (expected.consumer !== 'keyboard' || assertion.target !== undefined ||
       !assertion.action || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: retaining the native bookshelf editor requires system keyboard Back and both samples`);
  }
  if (evaluator === 'motion' && kind === 'control-effect' && expected.requireStablePopupProjection &&
      (expected.effect !== 'more-popup' || expected.nativeOwnerType !== 'Popup' || expected.module !== 'home' ||
       expected.nativeId !== 'reader-control-more-menu' || !hasType(expected.triggers,'strings') || expected.triggers.length === 0 ||
       !hasType(expected.actions,'array') || expected.actions.length === 0 || !expected.actions.every(action => hasType(action,'string')) ||
       !(expected.layoutToleranceVp > 0 && expected.layoutToleranceVp <= 1) || !assertion.baseline || !assertion.sample || !assertion.action ||
       (expected.visible === true ? expected.op !== 'click' : expected.visible !== false || expected.op !== 'keyEvent' || !expected.openAction))) {
    throw new Error(`Assertion ${id}: native Popup projection requires the normal Home opening or its bound Back`);
  }
  if (evaluator === 'source' && kind === 'route' && (assertion.baseline || assertion.entryAction) &&
      (!assertion.baseline || !assertion.entryAction || expected.action !== 'close' || expected.from !== 'source')) {
    throw new Error(`Assertion ${id}: a direct source route Back requires the entry action and closing baseline`);
  }
  if (evaluator === 'source' && kind === 'route-parent-after-tools' &&
      (!['settings','search'].includes(expected.parent) || !assertion.action || !assertion.baseline || !assertion.sample ||
       fields.some(field => !assertion[field]))) {
    throw new Error(`Assertion ${id}: a captured source parent needs both native Back actions and the original entry`);
  }
  if (evaluator === 'source' && kind === 'group-options-scroll' &&
      (assertion.required !== true || assertion.baseline !== 'panel-before' || assertion.sample !== 'selected-tail' ||
       assertion.entryAction !== 'open-sources' || assertion.openAction !== 'open-group' ||
       assertion.scrollAction !== 'scroll-group-options' || assertion.action !== 'select-tail-option' ||
       expected.groupIndex !== 12 || expected.sourceCount !== 12)) {
    throw new Error(`Assertion ${id}: group options scroll needs the exact public tail and retained catalogue`);
  }
  if (evaluator === 'search' && kind === 'phase-source-load-retry' &&
      (expected.state !== 'sourceLoadError' || (expected.exclusiveRead !== undefined && expected.exclusiveRead !== true) ||
       !assertion.condition || !assertion.action || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: source-list retry requires the actual failed entry, action and terminal sample`);
  }
  if (evaluator === 'search' && kind === 'phase-empty-rerun' &&
      (expected.confirmedEmpty !== true || assertion.required !== true ||
       !assertion.action || !assertion.priorAction || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: a confirmed-empty rerun requires the original submit, rerun action and both native result samples`);
  }
  if (evaluator === 'search' && kind === 'phase-filter-empty-reset' &&
      (assertion.required !== true || assertion.baseline !== 'unfiltered-results' ||
       assertion.sample !== 'restored-results' || assertion.action !== 'select-online' ||
       assertion.priorAction !== 'submit-a' || expected.resultCount !== 1)) {
    throw new Error(`Assertion ${id}: filtered empty and reset require one originally visible local result in the same query`);
  }
  if (evaluator === 'search' && kind === 'phase-projection' && expected.nativeConfirmedEmpty !== undefined &&
      (expected.nativeConfirmedEmpty !== true || expected.confirmedEmpty !== true || expected.mode !== 'results' ||
       expected.projections.length !== 1 || expected.projections[0] !== 'empty' ||
       expected.node !== 'reader-bookshelf-search-empty' || !assertion.action || !assertion.sample)) {
    throw new Error(`Assertion ${id}: native confirmed empty needs the scoped terminal search results`);
  }
  if (evaluator === 'search' && kind === 'phase-projection' && expected.nativeUnconfirmedEmpty !== undefined &&
      (expected.nativeUnconfirmedEmpty !== true || expected.nativeConfirmedEmpty !== undefined ||
       expected.mode !== 'results' || expected.searchActive !== false || expected.operation !== 'partial' ||
       expected.projections.length !== 1 || expected.projections[0] !== 'error' ||
       expected.node !== 'reader-bookshelf-search-pending' || expected.incompleteCount !== 1 || expected.resultCount !== 0 ||
       expected.failedCount !== 0 || expected.skippedCount !== 0 || expected.stopped !== false ||
       expected.localFailed !== false || expected.sourceListFailed !== false || !assertion.action || !assertion.sample)) {
    throw new Error(`Assertion ${id}: native unconfirmed empty needs the single-source terminal search results`);
  }
  if (evaluator === 'search' && kind === 'phase-projection' && expected.requirePendingFirstAttempt !== undefined &&
      (expected.requirePendingFirstAttempt !== true || expected.httpResponseStatus !== undefined ||
       expected.mode !== 'results' || expected.searchActive !== true || expected.operation !== 'loading' ||
       expected.projections.length !== 1 || expected.projections[0] !== 'loading' || expected.resultCount !== 0 ||
       expected.node !== 'reader-bookshelf-search-pending' || !assertion.action || !assertion.sample)) {
    throw new Error(`Assertion ${id}: an initial online worker needs a full scoped loading sample`);
  }
  const taskRecovery = evaluator === 'search' && kind === 'phase-task-retry' && expected.recoveredResult === 'recovery';
  if (evaluator === 'search' && expected.httpResponseStatus !== undefined &&
      (!Number.isInteger(expected.httpResponseStatus) || expected.httpResponseStatus < 400 || expected.httpResponseStatus > 599 ||
       expected.failedCount !== (taskRecovery ? 0 : 1) || !assertion.action || !assertion.sample ||
       (kind === 'phase-projection' && (expected.mode !== 'results' || expected.searchActive !== false ||
         !expected.node || !['failed','partial'].includes(expected.operation))) ||
       (kind === 'phase-task-retry' && (expected.operation !== (taskRecovery ? 'current' : 'partial') || !assertion.baseline ||
         !assertion.priorAction || !assertion.openAction || expected.requireRetainedWhileRefreshing !== true)))) {
    throw new Error(`Assertion ${id}: a fixed HTTP failure requires an exact single-source terminal or retained Task retry`);
  }
  if (evaluator === 'search' && kind === 'phase-task-retry' && expected.recoveredResult !== undefined &&
      (!taskRecovery || expected.httpResponseStatus !== 503 || expected.resultCount !== 2 ||
       expected.requireSamePublicBook !== true)) {
    throw new Error(`Assertion ${id}: Task recovery needs one distinct public online result alongside the retained book after initial 503`);
  }
  if (evaluator === 'search' && kind === 'phase-panel' &&
      ((expected.nativeReturn !== undefined && (expected.nativeReturn !== true ||
        !['filter','task'].includes(expected.panel) || !assertion.action || !assertion.returnAction ||
        !assertion.baseline || !assertion.sample)) ||
       (assertion.retryAction !== undefined && (expected.nativeReturn !== true || expected.panel !== 'task')))) {
    throw new Error(`Assertion ${id}: native sheet return needs both actions, current result endpoints and a known Search sheet`);
  }
  if (evaluator === 'search' && kind === 'phase-operation' && expected.requireSamePublicBook === true &&
      (expected.action !== 'stop' || !['a','b'].includes(expected.publicResult) ||
       !assertion.action || !assertion.priorAction || !assertion.sample)) {
    throw new Error(`Assertion ${id}: retained native book identity requires a Stop and its submitted public fixture`);
  }
  if (evaluator === 'search' && kind === 'phase-task-retry' && expected.requireSamePublicBook !== undefined &&
      (expected.requireSamePublicBook !== true || expected.requireRetainedWhileRefreshing !== true ||
       !assertion.action || !assertion.priorAction || !assertion.openAction || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: Task retry native book identity needs both result samples and their retained retry scope`);
  }
  if (evaluator === 'search' && kind === 'phase-operation' &&
      expected.requirePageThreeDemand === true && expected.requirePageThreeEnd !== true) {
    throw new Error(`Assertion ${id}: a third-page viewport demand requires the fixed three-page fixture`);
  }
  if (evaluator === 'search' && kind === 'phase-operation' && expected.requireFirstPageReceipt !== undefined &&
      (expected.requireFirstPageReceipt !== true || expected.requirePageThreeEnd !== true ||
       expected.requirePageThreeDemand !== true || !assertion.condition)) {
    throw new Error(`Assertion ${id}: first-page eligibility must bind the conditioned fixed public pagination sequence`);
  }
  if (evaluator === 'search' && kind === 'phase-operation' && expected.requirePageThreeEnd === true &&
      (expected.action !== 'need-more' || expected.publicResult !== 'a' || !assertion.action || !assertion.sample)) {
    throw new Error(`Assertion ${id}: the fixed three-page fixture needs the native append and public local result`);
  }
  if (evaluator === 'search' && kind === 'phase-detail' &&
      expected.requireVisibleContent === true && expected.verifyNativeList !== true) {
    throw new Error(`Assertion ${id}: visible detail content requires the scoped native Search list`);
  }
  if (evaluator === 'search' && kind === 'phase-detail' && expected.verifyNativeList === true &&
      (!assertion.action || !assertion.returnAction || !assertion.priorAction || !assertion.baseline || !assertion.sample ||
       !expected.sameQuery || !(expected.anchorToleranceVp > 0 && expected.anchorToleranceVp <= .5) ||
       (expected.terminalOperation !== undefined && expected.terminalOperation !== 'current') ||
       (expected.minimumAnchorIndex !== undefined && (!Number.isSafeInteger(expected.minimumAnchorIndex) ||
         expected.minimumAnchorIndex < 1 || expected.terminalOperation !== 'current' || !assertion.scrollAction)))) {
    throw new Error(`Assertion ${id}: native detail return requires the original action, return, query and bounded anchor`);
  }
  if (evaluator === 'source' && kind === 'footer-end' && expected.requireFreshEnd === true &&
      (!assertion.action || !assertion.sample)) {
    throw new Error(`Assertion ${id}: a fresh list end requires its native swipe and settled sample`);
  }
  if (evaluator === 'source' && kind === 'fixed-scroll' && expected.requireNativeSwipe === true &&
      (assertion.action !== 'scroll-shallow' || assertion.baseline !== 'fixture-sources-ready' ||
       assertion.sample !== 'shallow' || assertion.required !== true ||
       !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: native List swipe needs the bound shallow action and paired full captures`);
  }
  if (evaluator === 'source' && kind === 'read-surface' &&
      (!sourceReadStates.includes(expected.state) || !assertion.condition || !assertion.action || !assertion.sample ||
       (expected.nativeFrame !== undefined && (expected.nativeFrame !== sourceReadLoadingFrame || expected.state !== 'loading' ||
        assertion.id !== 'source.load.loading' || assertion.required !== false ||
        !['native-tree','window-metrics','app-owner','debug-frame'].every(source => assertion.sources?.includes(source)))))) {
    throw new Error(`Assertion ${id}: a source read surface needs a recognized conditional state, action and sample`);
  }
  if (evaluator === 'source' && kind === 'surface-text') {
    const conditional = ['read-failed','retained-read-failed','operation-recovery'].includes(expected.scope);
    const exactRecovery = expected.scope === 'operation-recovery' ? Boolean(sourceRecoveryControl(expected.target)) : expected.target === undefined;
    if (!assertion.action || !assertion.sample || !exactRecovery ||
        (expected.requireTransientStatus !== undefined &&
          (expected.requireTransientStatus !== true || !['operation-status','retained-read-failed'].includes(expected.scope))) ||
        !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)) ||
        (conditional ? assertion.required !== false || !assertion.condition || !expected.conditionAssertion
          : !['read-empty','operation-status'].includes(expected.scope) || assertion.required !== true ||
            assertion.condition || expected.conditionAssertion !== undefined)) {
      throw new Error(`Assertion ${id}: Source glyphs must bind the exact native surface and its existing condition`);
    }
  }
  if (evaluator === 'source' && kind === 'group-options-text' &&
      (!assertion.action || !assertion.sample || assertion.required !== true || assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)) ||
       assertion.baseline !== 'panel-before' || assertion.sample !== 'panel-tail' ||
       assertion.entryAction !== 'open-sources' || assertion.openAction !== 'open-group' ||
       assertion.action !== 'scroll-group-options' || expected.groupIndex !== 12 || expected.sourceCount !== 12)) {
    throw new Error(`Assertion ${id}: Source scoped glyphs require exact normal native inputs`);
  }
  if (evaluator === 'source' && ['read-retry','retained-read-failure'].includes(kind) &&
      (!assertion.condition || !assertion.entryAction || !assertion.action || !assertion.baseline || !assertion.sample ||
       (Object.hasOwn(expected,'requireNativeTouchTarget') && expected.requireNativeTouchTarget !== true) ||
       (kind === 'read-retry' ? expected.state !== 'readFailure' ||
          expected.position !== undefined && (expected.position !== 'top' || expected.requireNativeTouchTarget !== true) :
         expected.readFact !== 'refreshFailed' || !assertion.returnAction))) {
    throw new Error(`Assertion ${id}: invalid source read lifecycle bindings`);
  }
  if (evaluator === 'source' && kind === 'retained-read-retry' &&
      (!assertion.condition || assertion.required !== false || !assertion.action || !assertion.baseline || !assertion.sample ||
        !['center','top'].includes(expected.position) || expected.target !== 'reader-source-retained-read-retry' ||
        expected.conditionAssertion !== 'source.load.retainedReadFailure')) {
    throw new Error(`Assertion ${id}: invalid retained Source refresh lifecycle binding`);
  }
  if (evaluator === 'source' && kind === 'recovery-native-control' &&
      (!assertion.condition || !assertion.action || !assertion.sample ||
       expected.requireNativeTouchTarget !== true || !sourceRecoveryControl(expected.target) ||
       !sourceNativeControlAllowed(expected.target))) {
    throw new Error(`Assertion ${id}: invalid condition or exact native Source recovery control`);
  }
  if (evaluator === 'source' && kind === 'source-control-action') {
    const policy = sourceControlTouchPolicy(expected);
    if (!policy || assertion.required !== false || !assertion.condition || !assertion.action ||
        !assertion.baseline || assertion.sample !== assertion.baseline ||
        expected.conditionAssertion !== `source.control.${expected.branch}.${expected.control}.target` ||
        !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source))) {
      throw new Error(`Assertion ${id}: invalid exact Source control owner admission`);
    }
  }
  if (evaluator === 'source' && kind === 'combined-filter-reset') {
    const fixed = Number.isSafeInteger(expected.count) && expected.count > 0 &&
      Number.isSafeInteger(expected.projectedBeforeEdit) && expected.projectedBeforeEdit > 0 &&
      expected.projectedBeforeEdit <= expected.count;
    const captured = expected.capturedCatalogue === true && expected.count === undefined &&
      expected.projectedBeforeEdit === undefined;
    if (!(expected.capturedCatalogue === undefined && fixed || captured))
      throw new Error(`Assertion ${id}: combined filter reset requires a fixed or captured catalogue`);
  }
  if (evaluator === 'source' && kind === 'recovery-body-text' &&
      (!['original','unknown'].includes(expected.branch) || assertion.required !== false || !assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)) ||
       (expected.presentation === 'fits' ?
         assertion.action !== 'open-sources' || assertion.sample !== 'recovery-fitting' || assertion.baseline || assertion.entryAction :
         expected.presentation !== undefined || assertion.action !== 'expand-recovery' || assertion.sample !== 'recovery-expanded' ||
           assertion.baseline !== 'recovery-collapsed' || assertion.entryAction !== 'open-sources'))) {
    throw new Error(`Assertion ${id}: Source recovery body requires the measured fit or a normal expansion`);
  }
  if (evaluator === 'source' && kind === 'recovery-expand-edge' &&
      (!['original','unknown'].includes(expected.branch) || expected.target !== `reader-source-${expected.branch}-expand` ||
       expected.tapEdge !== 'top' || assertion.required !== false || !assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source)) ||
       assertion.action !== 'expand-recovery-edge' || assertion.entryAction !== 'open-sources' ||
       !(assertion.sample === 'recovery-expanded' && assertion.baseline === 'recovery-collapsed' ||
         expected.branch === 'unknown' && assertion.sample === 'recovery-expanded-edge' && assertion.baseline === 'recovery-refolded'))) {
    throw new Error(`Assertion ${id}: Source recovery edge requires the measured folded notice and exact local expansion`);
  }
  if (evaluator === 'source' && kind === 'import-research-status-action' &&
      (expected.target !== 'reader-source-status-action' || !Number.isSafeInteger(expected.keywordLength) ||
       (expected.position !== undefined && expected.position !== 'top') ||
       expected.keywordLength < 1 || !assertion.entryAction || !assertion.action || !assertion.baseline ||
       !assertion.sample || assertion.required !== true || assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: import return requires the actual status control and captured search owner`);
  }
  if (evaluator === 'source' && ['adaptation-surface','adaptation-text','reserved-row-typography'].includes(kind) &&
      (!(expected.minWidthVp > 0 && expected.minWidthVp <= expected.maxWidthVp &&
        expected.minFontScale > 0 && expected.minFontScale <= expected.maxFontScale &&
        expected.statsLineHeightFp > 0 && expected.tolerancePx >= 0 && expected.tolerancePx <= 1) ||
        !assertion.action || !assertion.sample)) {
    throw new Error(`Assertion ${id}: invalid native source adaptation range or sample`);
  }
  if (evaluator === 'source' && kind === 'reserved-row-typography' &&
      (assertion.action !== 'open-sources' || assertion.baseline !== 'source-ready' ||
       assertion.sample !== 'reserved-row' || assertion.required !== true || assertion.condition ||
       expected.expanded !== false || expected.requireNativeFontReadback !== true ||
       expected.requireCurrentTextProjection !== true ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: reserved Source text requires the exact default and filtered samples`);
  }
  if (evaluator === 'source' && kind === 'filter-layout' &&
      expected.minWidthVp !== undefined && !(expected.minWidthVp > 0)) {
    throw new Error(`Assertion ${id}: invalid minimum native width for Source filters`);
  }
  if (evaluator === 'source' && kind === 'adaptation-text' && expected.requireFirstRowToggleOff !== undefined &&
      (expected.requireFirstRowToggleOff !== true || expected.rowLabels !== true ||
       expected.requireNativeFontReadback !== true || expected.requireCurrentTextProjection !== true ||
       assertion.action !== 'open-sources' || assertion.sample !== 'source-ready' || assertion.required !== true)) {
    throw new Error(`Assertion ${id}: the first-row switch boundary requires complete current native Source text evidence`);
  }
  if (evaluator === 'source' && kind === 'filter-touch-target' &&
      (!sourceFilterCarrierAllowed(expected.target,expected.requireLocatorCenter) ||
       (expected.requireLocatorCenter === true && expected.requireFullContainment !== true) ||
       !assertion.action || !assertion.sample)) {
    throw new Error(`Assertion ${id}: invalid native source filter carrier selection`);
  }
  if (evaluator === 'source' && kind === 'filter-scroll') {
    const lane = Object.hasOwn(sourceFilterScrollLanes,expected.lane) && sourceFilterScrollLanes[expected.lane];
    if (!lane || assertion.action !== lane.action || assertion.baseline !== lane.baseline || assertion.sample !== lane.sample ||
        assertion.required !== true ||
        !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source))) {
      throw new Error(`Assertion ${id}: Source lane scroll needs the exact native swipe and two current Source samples`);
    }
  }
  if (evaluator === 'source' && kind === 'filter-tail-text') {
    const lane = Object.hasOwn(sourceFilterTextLanes,expected.lane) && sourceFilterTextLanes[expected.lane];
    if (!lane || ![320,366].includes(expected.widthVp) || assertion.baseline !== lane.slices[0].sample ||
        assertion.sample !== lane.slices.at(-1).sample || assertion.action !== lane.slices.at(-1).action ||
        assertion.required !== true || !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source))) {
      throw new Error(`Assertion ${id}: native filter Text needs all normal 2.0× Source Scroll samples`);
    }
  }
  if (evaluator === 'source' && (kind === 'row-status-badge' || kind === 'adaptation-text' && expected.textScope !== undefined) &&
      (assertion.action !== 'open-sources' || assertion.sample !== 'source-ready' || assertion.required !== true ||
        !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source)) ||
        (kind === 'row-status-badge' ? expected.state !== 'unchecked' :
          expected.textScope !== 'row-actions' || expected.rowLabels !== undefined ||
          expected.requireNativeFontReadback !== true || expected.requireCurrentTextProjection !== true))) {
    throw new Error(`Assertion ${id}: native row actions and badge need the current public Source opening`);
  }
  if (evaluator === 'source' && kind === 'native-control-target' &&
      (!sourceNativeControlAllowed(expected.target) || !assertion.action || !assertion.sample ||
       assertion.required !== true || !assertion.sources?.includes('window-metrics'))) {
    throw new Error(`Assertion ${id}: a Source control target needs one exact carrier and native window sample`);
  }
  if (evaluator === 'source' && kind === 'filter-selection' && expected.nativeSelection !== undefined &&
      (expected.nativeSelection !== true || expected.field !== expected.trigger ||
       !sourceFilterEdgeTarget(expected.trigger,expected.value) || !assertion.action || !assertion.baseline || !assertion.sample)) {
    throw new Error(`Assertion ${id}: invalid native source radio selection binding`);
  }
  if (evaluator === 'source' && kind === 'filter-selection' && expected.requireNativeTouch !== undefined &&
      (expected.requireNativeTouch !== true || expected.nativeSelection !== true || !['status','category'].includes(expected.trigger))) {
    throw new Error(`Assertion ${id}: the Source filter touch must require the native radio and physical input`);
  }
  if (evaluator === 'source' && kind === 'group-option-touch-edge' &&
      (!assertion.action || !assertion.baseline || !assertion.sample || !assertion.openAction ||
       !sourceGroupOptionEdgeTarget(expected.target) || !sourceFilterEdgeAllowed(expected.target,expected.tapEdge) ||
       expected.groupIndex !== (expected.target === 'reader-source-group-selected' ? 0 : 1))) {
    throw new Error(`Assertion ${id}: invalid native source group option or opening`);
  }
  if (evaluator === 'source' && (kind === 'group-option-touch-center' ||
      kind === 'group-geometry' && (expected.target !== undefined || expected.tapEdge !== undefined)) &&
      (!assertion.action || !assertion.baseline || !assertion.sample || assertion.required !== true || assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source)) ||
       (kind === 'group-option-touch-center' ?
         !assertion.openAction || expected.target !== 'reader-source-group-selected' ||
         expected.position !== 'center' || expected.groupIndex !== 0 :
         expected.target !== 'reader-source-group-trigger' || expected.tapEdge !== 'top' ||
         expected.withinHost !== true || expected.anchored !== true))) {
    throw new Error(`Assertion ${id}: native Source group touch requires the exact carrier and selected or opened endpoint`);
  }
  if (evaluator === 'source' && ['source-query-edge','source-query-touch'].includes(kind) &&
      (!(kind === 'source-query-edge' ? sourceQueryEdgeAllowed(expected.target,expected.tapEdge) :
        expected.target === sourceQueryEditor && sourceQueryPositions.includes(expected.position)) ||
       !assertion.entryAction || !assertion.action ||
       !assertion.baseline || !assertion.sample || assertion.required !== true || assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: Source query edge requires native dispatch, focus and owner evidence`);
  }
  if (evaluator === 'source' && ['source-native-focus','source-native-semantics'].includes(kind) &&
      (!isSourceNativeFocusAssertion(assertion) ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: Source focus and declared semantics require the exact normal action and native owner`);
  }
  if (evaluator === 'source' && kind === 'source-inline-import-edge' &&
      (!sourceInlineImportEdgeAllowed(expected.target,expected.tapEdge) || !assertion.entryAction || !assertion.action ||
       !assertion.baseline || !assertion.dialogSample || !assertion.returnAction || !assertion.sample ||
       assertion.required !== true || assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: inline import edge requires the native touch, its dialog and same-opening Back`);
  }
  if (evaluator === 'source' && [sourceInlineImportCenterKind,sourceInlineImportAreaKind].includes(kind)) {
    const center = kind === sourceInlineImportCenterKind;
    const exact = center ? id === 'source.import.center-touch' && assertion.action === sourceInlineImportCenterAction &&
      assertion.entryAction === 'open-sources' && assertion.baseline === 'inline-import-returned-right' &&
      assertion.dialogSample === 'inline-import-dialog-center' && assertion.returnAction === 'back-inline-import-center' &&
      assertion.sample === 'inline-import-returned-center' :
      id === 'source.import.target-area' && assertion.action === 'open-sources' && assertion.sample === 'source-ready' &&
      assertion.baseline === undefined;
    if (!exact || expected.target !== sourceInlineImportButton || assertion.required !== true || assertion.condition ||
        !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source))) {
      throw new Error(`Assertion ${id}: inline import needs the exact native response area or center dialog round trip`);
    }
  }
  if (evaluator === 'source' && ['source-chrome-geometry','source-chrome-dispatch'].includes(kind)) {
    const policy = sourceChromePolicy(expected.target,expected.position);
    const geometry = kind === 'source-chrome-geometry';
    if (!policy || expected.position !== policy.position ||
        id !== `source.chrome.${policy.name}.${geometry ? 'geometry' : policy.position ?? 'dispatch'}` ||
        assertion.action !== (geometry ? policy.beforeAction : policy.action) ||
        assertion.sample !== (geometry ? policy.baseline : policy.sample) ||
        assertion.baseline !== (geometry ? undefined : policy.baseline) ||
        assertion.required !== true || assertion.condition ||
        !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source))) {
      throw new Error(`Assertion ${id}: Source chrome requires its exact native Button, action and sample`);
    }
  }
  if (evaluator === 'source' && kind === sourceFilterClearKind &&
      (id !== sourceFilterClearAssertion || expected.target !== sourceFilterClearTarget || expected.position !== 'top' ||
       assertion.action !== sourceFilterClearAction || assertion.baseline !== 'zero-match' || assertion.sample !== 'cleared' ||
       assertion.required !== true || assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: Clear Filters upper edge requires the exact public zero-match touch and native outcome`);
  }
  if (evaluator === 'source' && kind === 'source-offline-detect' &&
      (expected.target !== sourceOfflineDetectButton || expected.l1 !== 'pass' || expected.l2 !== 'pre-request-fail' ||
       (expected.position !== undefined && expected.position !== 'top') ||
       !assertion.entryAction || !assertion.action || !assertion.baseline || !assertion.sample ||
       assertion.required !== true || assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: offline Detect requires its exact public row and pre-request Core result`);
  }
  if (evaluator === 'source' && kind === 'toggle-touch-target' && (!assertion.action || !assertion.sample)) {
    throw new Error(`Assertion ${id}: source toggle geometry requires its causal action and current sample`);
  }
  if (evaluator === 'source' && kind === 'group-outside-dismiss' &&
      (expected.target !== sourceGroupBackdrop || !assertion.action || !assertion.baseline ||
       !assertion.sample || !assertion.openAction || assertion.required !== true || assertion.condition ||
       !['native-tree','window-metrics','app-owner'].every(source => assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: outside dismissal needs measured native endpoints and the exact group owner`);
  }
  if (evaluator === 'source' && kind === 'toggle-touch-edge' &&
      (!assertion.action || !assertion.baseline || !assertion.sample ||
       expected.tapEdge !== (expected.requestedEnabled ? 'top' : 'bottom'))) {
    throw new Error(`Assertion ${id}: invalid native source Toggle edge and endpoint`);
  }
  if (evaluator === 'source' && kind === 'toggle-touch' &&
      (!assertion.action || !assertion.baseline || !assertion.sample || assertion.required !== true || assertion.condition ||
       expected.target !== sourceToggleEdgeTarget || !['center','top','bottom'].includes(expected.position) ||
       !['native-tree','window-metrics','app-owner'].every(source=>assertion.sources?.includes(source)))) {
    throw new Error(`Assertion ${id}: native Toggle touch requires the exact public carrier, owner and endpoint`);
  }
  if (evaluator === 'source' && ['tool-return-filters','tools-return-focus'].includes(kind) &&
      (!assertion.action || !assertion.baseline || !assertion.sample || !assertion.departAction || !assertion.toolsSample ||
       (kind === 'tools-return-focus' ? expected.focused !== true || ![undefined,'header','footer'].includes(expected.entry) :
         !(assertion.priorAction && assertion.filteredSample &&
           expected.tolerancePx >= 0 && expected.tolerancePx <= 1 && expected.status !== 'all' && expected.category !== 'all' &&
           [expected.groupIndex,expected.queryLength,expected.projected ?? expected.minimumProjected]
             .every(value => Number.isSafeInteger(value) && value > 0) &&
           (expected.minimumProjected === undefined ? expected.entry === undefined :
             expected.projected === undefined && expected.entry === 'header'))))) {
    throw new Error(`Assertion ${id}: invalid source Tools retention or focus relationship`);
  }
  if (evaluator !== 'layout' && kind !== 'phase-relative') return;
  const selector = value => typeof value === 'string' && value.length > 0 ||
    object(value) && typeof value.id === 'string' &&
    Object.keys(value).every(key => ['id','key','ancestors'].includes(key)) &&
    (!Object.hasOwn(value, 'ancestors') || hasType(value.ancestors, 'strings'));
  if (!selector(assertion.a) ||
      fields.includes('b') && !selector(assertion.b) ||
      Object.hasOwn(assertion, 'anchor') && !selector(assertion.anchor) ||
      Object.hasOwn(assertion, 'axis') && !['x','y'].includes(assertion.axis) ||
      Object.hasOwn(assertion, 'tolerancePx') && (!Number.isFinite(assertion.tolerancePx) || assertion.tolerancePx < 0)) {
    throw new Error(`Assertion ${id}: invalid layout parameters`);
  }
}
