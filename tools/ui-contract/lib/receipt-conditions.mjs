import { sourceReadLoadingFrame, sourceReadLoadingNativeFrame, sourceReadObservation } from './source-read.mjs';
import { sourceRetainedReadCondition } from './source-retained-read.mjs';
import { searchEntrySourceRead, searchEntrySourceSampleMatches, searchEntrySourceSampleRead,
  usesSearchEntrySourceRead } from './search-entry-source-read.mjs';

const status = (value, reason) => ({status:value, required:value !== 'DOES_NOT_APPLY', reason});
const applies = reason => status('APPLIES', reason);
const absent = reason => status('DOES_NOT_APPLY', reason);
const unknown = reason => status('UNKNOWN', reason);

function actionEvents(context, actionId, sampleId) {
  const action = context.actions?.[actionId];
  const sample = context.samples?.[sampleId];
  if (!action || sample && (action.instanceId !== sample.instanceId || action.afterSeq > sample.beforeSeq)) return [];
  const end = sample?.beforeSeq ?? action.afterSeq;
  return (context.events ?? []).filter(event => event.instanceId === action.instanceId && event.channel === 'business' &&
    event.eventSeq > action.beforeSeq && event.eventSeq <= end);
}

function sourceLoadCondition(assertion, context) {
  const {state, readFacts} = assertion.expected;
  const projection = actionEvents(context, assertion.action, assertion.sample)
    .findLast(event => event.kind === 'source.projection');
  const actual = projection?.payload;
  if (actual?.state === state || readFacts.includes(actual?.readFact)) return applies(`Observed source condition ${state}`);
  if (!context.samples?.[assertion.sample] || !actual?.state || !actual?.readFact) {
    return unknown(`No verified source projection for condition ${state}`);
  }
  return absent(`Current source projection is ${actual.state} (${actual.readFact})`);
}

function sourceReadCondition(assertion, context) {
  const observation = sourceReadObservation(assertion, context);
  if (observation?.triggered) {
    const sampleApplies = assertion.expected.nativeFrame === sourceReadLoadingFrame ?
      Boolean(sourceReadLoadingNativeFrame(assertion,context,observation)) : observation.sample?.captureComplete === true &&
      observation.sample.window?.keyboard?.visible === false &&
      observation.current.payload.state === assertion.expected.state;
    const outcome = sampleApplies ? 'has a matching native sample' : 'lacks a matching native sample';
    return {...applies(`Observed ${assertion.expected.state} in the current source opening, which ${outcome}`),sampleApplies};
  }
  if (!observation?.sample?.captureComplete || observation.sample.window?.keyboard?.visible !== false ||
      context.problems?.length || typeof observation.current.payload.readFact !== 'string' ||
      !observation.current.payload.readFact) {
    return unknown(`No verified current source opening for ${assertion.expected.state}`);
  }
  return absent(`The verified source opening did not report ${assertion.expected.state}`);
}

function searchEntryCondition(assertion, context, version) {
  const events = actionEvents(context, assertion.action, assertion.sample);
  const openings = events.filter(event => event.kind === 'search-open-accepted');
  const opened = openings[0]?.payload;
  if (version >= 2 && (openings.length !== 1 || !Number.isSafeInteger(opened?.queryRevision))) {
    return unknown('No unique accepted search opening with a query revision');
  }
  const settled = opened && events.findLast(event => event.kind === 'search-surface-settled' &&
    ['identity','mounting','navigation'].every(key => opened[key] === event.payload[key]) &&
    (version < 2 || event.payload.mode === 'input' && event.payload.queryRevision === opened.queryRevision &&
      Number.isSafeInteger(event.payload.owner)))?.payload;
  const projected = settled && events.findLast(event => event.kind === 'search-page-projection' &&
    event.payload.owner === settled.owner && event.payload.queryRevision === opened.queryRevision)?.payload;
  if (!projected?.projection) return unknown('No verified entry source status for this opened search owner');
  if (projected.projection === 'sourceLoadError') return applies('The current search owner reported sourceLoadError');
  if (version >= 2 && (projected.projection !== 'sourceRequired' ||
      !['noSources','allDisabled'].includes(projected.sourceRequiredReason) ||
      context.samples?.[assertion.sample]?.captureComplete !== true || context.problems?.length)) {
    return unknown('No verified terminal source-list outcome for this opened search owner');
  }
  return absent(`The current search owner reported ${projected.projection}`);
}

function searchEntryReadCondition(context, sampleId, retry = false) {
  const sample = context.samples?.[sampleId];
  const events = context.events ?? [];
  const action = context.actions?.['open-search'];
  const read = sample ? searchEntrySourceSampleRead(events, action, sample) :
    searchEntrySourceRead(events, action, action?.afterSeq);
  if (read?.outcome === 'failed') return applies('The current Search opening reported an actual failed source.list read');
  if (!read || context.problems?.length || !searchEntrySourceSampleMatches(sample, read.outcome)) {
    return unknown('No verified settled source.list result and matching native Search opening');
  }
  if (retry && context.actions?.['retry-source-list']) return unknown('The opening has a contradictory Retry action');
  return absent(`The current native Search opening reported source.list outcome ${read.outcome}`);
}

function obsoleteCondition(assessed, requireResultBatch) {
  if (requireResultBatch) {
    if (assessed?.applicability === 'APPLIES') return applies('Observed a result batch or stale publication from A after B was accepted');
    if (assessed?.applicability === 'DOES_NOT_APPLY') return absent('No result batch arrived from A in the verified B interval');
    return unknown('The late result classification or verified B interval is incomplete');
  }
  if (assessed?.applicability === 'APPLIES') return applies('Observed work from the prior lease after the newer submit was accepted');
  if (assessed?.applicability === 'DOES_NOT_APPLY') return absent('No obsolete completion after the verified newer submit');
  return unknown('The verified two-submission interval for an obsolete completion is missing');
}

export function conditionApplicability(assertion, context, assessed, contract, tts, previous = {}) {
  if (!assertion.condition && assertion.evaluator === 'source' && assertion.kind === 'native-control-target' &&
      contract?.assertions?.some(item => item.expected?.conditionAssertion === assertion.id)) {
    if (assessed?.verdict === 'PASS' || assessed?.verdict === 'FAIL') {
      return applies(`The current native row exposes the exact ${assertion.expected.target} target`);
    }
    return unknown(`No independent current native ${assertion.expected.target} target measurement`);
  }
  if (!assertion.condition) return null;
  if (assertion.evaluator === 'source' && assertion.kind === 'surface-text') {
    return previous[assertion.expected.conditionAssertion] ??
      unknown('The required Source text condition has no independently evaluated native state');
  }
  if (tts) {
    if (tts.status === 'SYSTEM_PLAYING') return applies('The current system speech engine started the bound launch');
    if (tts.status === 'SYSTEM_UNAVAILABLE') return absent('The current launch was rejected by the verified system speech engine');
    return unknown('This launch has no verified system speech availability and outcome');
  }
  if (assertion.kind === 'observed-load-branch') return sourceLoadCondition(assertion, context);
  if (assertion.kind === 'read-surface') return sourceReadCondition(assertion, context);
  if (assertion.kind === 'read-retry') {
    const baseline = sourceReadCondition({...assertion,action:assertion.entryAction,sample:assertion.baseline}, context);
    if (baseline.status !== 'APPLIES') return baseline;
    return {...baseline,sampleApplies:assessed?.actual?.terminalObserved === true};
  }
  if (assertion.kind === 'retained-read-failure') return sourceRetainedReadCondition(assertion, context);
  if (assertion.kind === 'retained-read-retry') {
    const baseline = previous[assertion.expected.conditionAssertion];
    if (!baseline) return unknown('The retained Refresh condition has no independently evaluated reopening');
    return baseline.status === 'APPLIES' ? {...baseline,
      sampleApplies:baseline.sampleApplies === true && assessed?.actual?.terminalObserved === true} : baseline;
  }
  if (assertion.kind === 'recovery-native-control') {
    const applicability = assessed?.actual?.applicability;
    if (applicability === 'APPLIES') return {...applies('The current opening has an applicable control or a native contradiction'),
      sampleApplies:true};
    return applicability === 'DOES_NOT_APPLY' ? absent(assessed.reason) :
      unknown(assessed?.reason || 'No verified current native recovery control condition');
  }
  if (assertion.kind === 'source-control-action') {
    const baseline = previous[assertion.expected.conditionAssertion];
    if (!baseline) return unknown('The exact Source control condition has no independently evaluated native basis');
    return baseline.status === 'APPLIES' ? {...baseline,
      sampleApplies:baseline.sampleApplies === true && assessed?.verdict === 'PASS' &&
        assessed?.actual?.applicability === 'APPLIES'} : baseline;
  }
  if (['recovery-body-text','recovery-expand-edge'].includes(assertion.kind)) {
    const body = assessed?.actual;
    if (body?.applicability === 'APPLIES') return {...applies(assertion.kind === 'recovery-expand-edge' ?
      'The current native recovery notice exposes its applicable folded presentation' : 'The current recovery notice has the selected text presentation'),
      sampleApplies:body.sampleApplies === true};
    return body?.applicability === 'DOES_NOT_APPLY' ? absent(assessed.reason)
      : unknown(assessed?.reason || 'No verified current recovery notice text presentation');
  }
  if (assertion.kind === 'phase-obsolete') return obsoleteCondition(assessed?.actual,assertion.expected.requireResultBatch === true);
  if (assertion.kind === 'phase-history-loading') {
    const observed = assessed?.actual?.applicability;
    if (observed === 'APPLIES') return {...applies('The current interactive Search viewport admitted pending history feedback'),
      sampleApplies:assessed.actual.currentNativeSample === true};
    if (observed === 'DOES_NOT_APPLY') return absent(assessed.reason);
    return unknown(assessed?.reason ?? 'The opening and history availability have no verified condition');
  }
  if (assertion.kind === 'control-transition' && assertion.expected.requireCancelObservation === true) {
    const observation = assessed?.actual?.cancelApplicability;
    if (observation?.status === 'APPLIES') return applies(observation.reason);
    if (observation?.status === 'DOES_NOT_APPLY') return absent(observation.reason);
    return unknown(observation?.reason ?? 'No verified platform terminal for the current grabber drag');
  }
  if (assertion.kind === 'control-transition' && assertion.expected.requireReversalObservation === true) {
    return assessed?.actual?.reversalInputWitnessed === true ? applies('The same held grabber pointer retreated before UP') :
      unknown('The required one-finger grabber reversal has no verified input witness');
  }
  if ((contract.id === 'bookshelf.search-source-load-error' || contract.id === 'bookshelf.search-source-load-retry') &&
      assertion.kind === 'phase-projection') {
    if (usesSearchEntrySourceRead(contract)) return searchEntryReadCondition(context, assertion.sample);
    return searchEntryCondition(assertion, context, contract.id === 'bookshelf.search-source-load-retry' ? 2 : contract.version);
  }
  if (contract.id === 'bookshelf.search-source-load-retry' && assertion.kind === 'phase-source-load-retry') {
    if (usesSearchEntrySourceRead(contract)) return searchEntryReadCondition(context, assertion.baseline, true);
    return searchEntryCondition({...assertion,action:'open-search',sample:assertion.baseline}, context, 2);
  }
  if (contract.id === 'bookshelf.search-append') {
    if (contract.version >= 5) {
      return assessed?.actual?.applicability === 'APPLIES' && assessed.actual.firstPage ?
        applies('The accepted fixed first-page Core receipt put the current source at ready page two') :
        unknown('The accepted query has no verified fixed first-page next receipt and ready page two');
    }
    return assessed?.actual?.applicability === 'APPLIES' ?
      applies('The current query and work generation started an observed next-page operation') :
      unknown('No observed next-page operation for the accepted query and work generation');
  }
  throw new Error(`Unknown assertion condition ${contract.id}/${assertion.id}`);
}
