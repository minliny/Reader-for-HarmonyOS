import { requireEvidence } from './evidence.mjs';

export const searchEntrySourceSample = 'entry-projection';
export const searchEntrySourceRetry = 'bookshelf.search-source-load-retry';

export function usesSearchEntrySourceRead(contract) {
  return contract.version === 3 &&
    ['bookshelf.search-source-load-error', searchEntrySourceRetry].includes(contract.id);
}

const scopeFields = ['identity', 'navigation', 'mounting', 'queryRevision'];
const positive = value => Number.isSafeInteger(value) && value > 0;
const natural = value => Number.isSafeInteger(value) && value >= 0;
const retired = new Set(['search-route-released', 'search-page-owner-released', 'search-edit-accepted',
  'search-draft-accepted', 'search-submit-accepted', 'search-page-action', 'search-source-list-retry']);

function validRead(read, projection) {
  if (!read || !positive(read.session) || projection.searchActive !== false ||
      Object.keys(read).some(key => !['session', 'outcome', 'sourceCount'].includes(key))) return false;
  const {outcome, sourceCount} = read;
  if (outcome === 'ready') {
    return projection.projection === 'initial' && projection.sourceRequiredReason === undefined && positive(sourceCount);
  }
  if (outcome === 'failed') {
    return projection.projection === 'sourceLoadError' && projection.sourceRequiredReason === undefined &&
      !Object.hasOwn(read, 'sourceCount');
  }
  return projection.projection === 'sourceRequired' && projection.sourceRequiredReason === outcome &&
    (outcome === 'noSources' && sourceCount === 0 || outcome === 'allDisabled' && positive(sourceCount));
}

/** Read the current natural source.list result inside the actual public Search opening. */
export function searchEntrySourceRead(events, action, throughSeq) {
  if (!action || action.outcomeSettled === false || throughSeq < action.afterSeq) return undefined;
  const current = events.filter(event => event.instanceId === action.instanceId && event.channel === 'business' &&
    event.eventSeq > action.beforeSeq && event.eventSeq <= throughSeq);
  const openings = current.filter(event => event.kind === 'search-open-accepted');
  const [opening] = openings;
  if (openings.length !== 1 || opening.eventSeq > action.afterSeq ||
      !scopeFields.every(key => natural(opening.payload[key]))) return undefined;
  const timeline = current.filter(event => event.eventSeq > opening.eventSeq);
  if (current.some(event => retired.has(event.kind))) return undefined;
  const settled = timeline.filter(event => event.kind === 'search-surface-settled').map(event => event.payload);
  const owner = settled[0]?.owner;
  if (!positive(owner) || settled.some(endpoint => endpoint.owner !== owner || endpoint.mode !== 'input' ||
      !scopeFields.every(key => endpoint[key] === opening.payload[key]))) return undefined;

  let witness;
  let page;
  for (const {payload} of timeline.filter(event => event.kind === 'search-page-projection')) {
    if (payload.owner !== owner || payload.queryRevision !== opening.payload.queryRevision || !positive(payload.page) ||
        page !== undefined && page !== payload.page) return undefined;
    page = payload.page;
    const read = payload.entrySourceRead;
    if (!Object.hasOwn(payload, 'entrySourceRead') && !witness && payload.projection === 'initial') continue;
    if (!validRead(read, payload) || witness && !['session', 'outcome', 'sourceCount'].every(key =>
      read[key] === witness[key])) return undefined;
    witness = read;
  }
  return witness;
}

const input = 'reader-book-search-input';
const back = 'reader-library-search-back';
const error = 'reader-bookshelf-search-sourceLoadError';
const required = 'reader-bookshelf-search-sourceRequired';
const recovery = 'reader-search-source-recovery-primary';

export function searchEntrySourceSampleMatches(sample, outcome) {
  if (sample?.captureComplete !== true) return false;
  const visible = new Set(sample.nodes.filter(node => node.source === 'native-tree' && node.visible === true &&
    node.opacity > 0).map(node => node.id));
  if (!visible.has(input) || !visible.has(back)) return false;
  return outcome === 'ready' ? ![error, required, recovery].some(id => visible.has(id)) :
    (outcome === 'noSources' || outcome === 'allDisabled') && visible.has(required) && !visible.has(error);
}

export function searchEntrySourceSampleRead(events, action, sample) {
  if (!action || !sample || sample.instanceId !== action.instanceId || sample.beforeSeq < action.afterSeq) return undefined;
  return searchEntrySourceRead(events, action, sample.beforeSeq);
}

export function canOmitSearchSourceRetry(contract, events, action, sample) {
  return usesSearchEntrySourceRead(contract) && contract.id === searchEntrySourceRetry &&
    searchEntrySourceSampleRead(events, action, sample)?.outcome === 'ready' &&
    searchEntrySourceSampleMatches(sample, 'ready');
}

export function assertSearchSourceRetryOpening(contract, step, events, action, throughSeq) {
  if (contract.id === searchEntrySourceRetry && usesSearchEntrySourceRead(contract) && step.id === 'retry-source-list') {
    requireEvidence(searchEntrySourceRead(events, action, throughSeq)?.outcome === 'failed',
      'The current Search opening did not prove the source.list failure required for Retry');
  }
}
