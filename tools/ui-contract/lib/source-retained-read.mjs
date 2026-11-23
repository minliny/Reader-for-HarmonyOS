import { sourceReadObservation } from './source-read.mjs';
import { measureSourceNativeControl } from './source-native-control.mjs';

const positiveCount = value => Number.isSafeInteger(value) && value > 0;
const readFailures = new Set(['failed', 'refreshFailed']);
const settledStates = new Set(['rows', 'filteredEmpty', 'empty', 'readFailure']);

function fullSample(sample) {
  return sample?.captureComplete === true && sample.window?.keyboard?.visible === false &&
    Array.isArray(sample.nodes) &&
    sample.evidenceRefs?.some(ref => ref.path.endsWith('.png')) &&
    sample.evidenceRefs?.some(ref => ref.path.endsWith('.json'));
}

function unfiltered(projection) {
  return projection.queryLength === 0 && projection.status === 'all' && projection.category === 'all' &&
    projection.allGroups === true && projection.groupIndex === 0;
}

function firstRowVisibility(sample, anchor) {
  const rows = sample.nodes.filter(node => node.id === `reader-source-row-${anchor}`);
  if (!rows.length) return false;
  if (rows.length !== 1) return null;
  const [row] = rows;
  if (row.visible === false || row.opacity === 0) return false;
  if (row.visible !== true || !Number.isFinite(row.opacity) || !row.visibleRectPx) return null;
  return row.visibleRectPx.width > 0 && row.visibleRectPx.height > 0;
}

function sourceRetainedReadObservation(assertion, context) {
  const initial = sourceReadObservation({...assertion, action:assertion.entryAction, sample:assertion.baseline}, context);
  const reopened = sourceReadObservation(assertion, context);
  const prior = initial?.current.payload;
  if (!prior || prior.readFact !== 'current' || prior.state !== 'rows' ||
      !positiveCount(prior.readGeneration) || !positiveCount(prior.count) ||
      prior.projected !== prior.count || !positiveCount(prior.firstAnchor) ||
      !unfiltered(prior) || !fullSample(initial.sample) || !reopened) return null;

  const exit = context.actions?.[assertion.returnAction];
  const open = context.actions?.[assertion.action];
  if (exit?.op !== 'keyEvent' || exit.key !== 'Back' || exit.from !== assertion.baseline ||
      exit.outcomeSettled === false || exit.instanceId !== initial.sample.instanceId ||
      open.instanceId !== exit.instanceId ||
      ![initial.sample.afterSeq, exit.beforeSeq, exit.afterSeq].every(Number.isSafeInteger) ||
      initial.sample.afterSeq > exit.beforeSeq || exit.beforeSeq >= exit.afterSeq ||
      exit.afterSeq > open.beforeSeq) return null;

  const accepted = context.events.filter(event => event.kind === 'source.route' && event.channel === 'business' &&
    event.instanceId === open.instanceId && event.eventSeq > initial.sample.beforeSeq && event.eventSeq <= open.beforeSeq);
  const [closed] = accepted;
  const route = closed?.payload;
  if (accepted.length !== 1 || closed.eventSeq <= exit.beforeSeq || closed.eventSeq > exit.afterSeq ||
      route.action !== 'close' || route.from !== 'source' || route.to !== 'settings' ||
      route.mounting !== prior.owner.mounting || route.previousGeneration !== prior.owner.generation ||
      !Number.isSafeInteger(route.generation) || route.generation <= route.previousGeneration ||
      reopened.entry.payload.previousGeneration !== route.generation ||
      reopened.entry.payload.mounting !== route.mounting) return null;

  const current = reopened.current.payload;
  const afterReopen = projection => positiveCount(projection.readGeneration) && projection.readGeneration > prior.readGeneration &&
    settledStates.has(projection.state);
  const failed = projection => afterReopen(projection) && readFailures.has(projection.readFact);
  const trigger = context.events.find(event => event.kind === 'source.projection' && event.channel === 'business' &&
    event.instanceId === open.instanceId && event.eventSeq > reopened.entry.eventSeq &&
    event.eventSeq <= reopened.current.eventSeq && event.payload.owner?.mounting === current.owner.mounting &&
    event.payload.owner.generation === current.owner.generation && failed(event.payload));
  const sampleApplies = Boolean(trigger && fullSample(reopened.sample) && failed(current) &&
    current.readGeneration >= trigger.payload.readGeneration);
  const coherentCatalog = current.state === 'rows' && positiveCount(current.count) &&
    current.projected === current.count && positiveCount(current.firstAnchor) ||
    current.state === 'empty' && current.count === 0 && current.projected === 0 && current.firstAnchor === 0;
  const settledSuccess = fullSample(reopened.sample) && afterReopen(current) && current.readFact === 'current' &&
    unfiltered(current) && coherentCatalog;
  return {initial, reopened, closed, exit, trigger, sampleApplies, settledSuccess};
}

export function sourceRetainedReadCondition(assertion, context) {
  const observed = sourceRetainedReadObservation(assertion, context);
  if (observed?.trigger) {
    return {status:'APPLIES', required:true, sampleApplies:observed.sampleApplies,
      reason:observed.sampleApplies ? 'The new source opening completed a failed read after a populated read' :
        'The new source opening reported a failed read without a matching native sample'};
  }
  if (observed?.settledSuccess && !context.problems?.length &&
      firstRowVisibility(observed.initial.sample, observed.initial.current.payload.firstAnchor) === true) {
    return {status:'DOES_NOT_APPLY', required:false, reason:'The new source opening completed a newer successful read'};
  }
  return {status:'UNKNOWN', required:true, reason:'No verified populated read and settled read outcome after reopening Source'};
}

export function evaluateSourceRetainedReadFailure(assertion, context) {
  const observed = sourceRetainedReadObservation(assertion, context);
  const evidenceRefs = observed ? [
    ...observed.initial.sample.evidenceRefs, ...(observed.reopened.sample?.evidenceRefs ?? []),
    ...[observed.initial.entry, observed.initial.current, observed.exit, observed.closed, observed.reopened.entry,
      observed.trigger, observed.reopened.current].flatMap(item => item?.evidenceRefs ?? []),
  ] : [];
  const report = (verdict, reason, actual = null, observationsComplete = true) =>
    ({verdict, reason, actual, expected:assertion.expected, evidenceRefs,
      ...(observationsComplete ? {} : {observationsComplete:false})});
  if (!observed?.sampleApplies) return report('NOT_RUN', 'No complete retained-row failure sample after a proven populated read');

  const before = observed.initial.current.payload;
  const after = observed.reopened.current.payload;
  const describe = (projection, sample) => ({
    owner:projection.owner, state:projection.state, generation:projection.readGeneration, readFact:projection.readFact,
    count:projection.count, projected:projection.projected, firstAnchor:projection.firstAnchor,
    previousFirstRowVisible:firstRowVisibility(sample, before.firstAnchor),
  });
  const prior = describe(before, observed.initial.sample);
  const current = describe(after, observed.reopened.sample);
  const hasCounts = [after.count, after.projected, after.firstAnchor].every(value => Number.isSafeInteger(value) && value >= 0);
  const touchTarget = assertion.expected.requireNativeTouchTarget === true && after.state === 'rows' &&
      after.readFact === assertion.expected.readFact && positiveCount(after.count) ?
    measureSourceNativeControl(observed.reopened.sample,'reader-source-retained-read-retry') : undefined;
  const actual = {prior,current,...(touchTarget ? {nativeTouchTarget:touchTarget.actual} : {})};
  if (touchTarget?.verdict === 'FAIL') {
    return report('FAIL',touchTarget.reason,actual,hasCounts &&
      prior.previousFirstRowVisible !== null && current.previousFirstRowVisible !== null);
  }
  if (!hasCounts) {
    return report('NOT_RUN','The failed read lacks the retained row counts or identity',actual);
  }
  const preserved = after.state === 'rows' && after.readFact === assertion.expected.readFact && unfiltered(after) &&
    before.count === after.count && before.projected === after.projected && before.firstAnchor === after.firstAnchor;
  if (!preserved || prior.previousFirstRowVisible === false || current.previousFirstRowVisible === false) {
    return report('FAIL','The failed read did not retain the previously visible source catalog and first row',actual);
  }
  if (prior.previousFirstRowVisible !== true || current.previousFirstRowVisible !== true) {
    return report('NOT_RUN','The native captures do not identify one visible first row before and after the read',actual);
  }
  if (touchTarget?.verdict === 'NOT_RUN') return report('NOT_RUN',touchTarget.reason,actual);
  return report('PASS','The failed read retained the prior row counts and the same visible first source row',actual);
}
