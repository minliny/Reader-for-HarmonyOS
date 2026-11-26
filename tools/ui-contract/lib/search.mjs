import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { ancestorsOf, evaluateLayout, isReaderSearchBottomSheet, publicSearchResultContinuity, searchMismatchedEmptyHeading,
  searchUnconfirmedEmptyHeading, selectLayoutNode } from './layout.mjs';
import { effectiveAppearance } from './structure.mjs';
import { imeSearchTap } from './search-ime-key.mjs';
import { evaluateSearchFilterEmptyReset } from './search-filter-empty-reset.mjs';
import { evaluateSearchHistoryLoading } from './search-entry-history-loading.mjs';
import { emptyBookshelfEntry } from './search-empty-bookshelf-entry.mjs';

const ENTRY = 'reader-bookshelf-search-entry';
const EDITOR = 'reader-book-search-input';
const SUBMIT = 'reader-bookshelf-search-submit';
const FIELD = 'reader-bookshelf-search-field';
const BAR = 'reader-bookshelf-search-bar';
const SEARCH_BACK = 'reader-library-search-back';
const SOURCE_RETRY = 'reader-search-source-recovery-primary';
const EMPTY_RERUN = 'reader-search-retry';
const SOURCE_LOAD_ERROR = 'reader-bookshelf-search-sourceLoadError';
const SOURCE_REQUIRED = 'reader-bookshelf-search-sourceRequired';
const DONE = { empty: 'reader-bookshelf-search-empty', results: 'reader-bookshelf-search-results' };

const EDITOR_FOCUS = 'search-editor-focus';
const EDITOR_RETIRED = 'search-editor-unmounted';
const EDITOR_EDIT = 'search-editor-edit';
const EDITOR_SELECTION = 'search-editor-selection';

const LAST = values => values.at(-1);
const sequence = value => Number.isSafeInteger(value) && value >= 0;
const placed = rect => Number.isFinite(rect?.width) && Number.isFinite(rect?.height) && rect.width > 0 && rect.height > 0;

class MissingSearchEvidence extends Error {}

function requireEvidence(condition, reason) {
  if (!condition) throw new MissingSearchEvidence(reason);
}

function matchesFields(a, b, keys) {
  return keys.every(key => a[key] === b[key]);
}

function compare(actual, expected, ok, reason) {
  return { actual, expected, verdict: ok ? 'PASS' : 'FAIL', reason: ok ? null : reason };
}

function candidateIdentity(payload) {
  return sequence(payload?.identity) && sequence(payload?.navigation) && sequence(payload?.mounting);
}

function editorIdentity(payload) {
  return candidateIdentity(payload) && sequence(payload.owner) && payload.owner > 0 &&
    payload.editorId === JSON.stringify([payload.identity, payload.navigation, payload.mounting, payload.owner]);
}

class SearchEvidence {
  constructor(context, assertion) {
    this.actions = context.actions;
    this.samples = context.samples;
    this.events = context.events;
    this.allowedSources = assertion.acceptedSources;
    this.refs = new Set();
  }

  use(record) {
    for (const ref of record?.evidenceRefs ?? []) this.refs.add(ref);
    return record;
  }

  source(source, reason) {
    requireEvidence(this.allowedSources === undefined || this.allowedSources.includes(source), reason);
  }

  sample(state) {
    const sample = this.use(this.samples[state]);
    requireEvidence(sample && sequence(sample.beforeSeq) && sequence(sample.afterSeq) &&
      sample.beforeSeq <= sample.afterSeq && Number.isFinite(sample.hostBeginMs) &&
      Number.isFinite(sample.hostEndMs) && sample.hostBeginMs <= sample.hostEndMs,
    `The ${state} sample has no valid capture interval`);
    return sample;
  }

  node(sample, selector, ancestor) {
    const query = typeof selector === 'string' ? { id:selector, ancestors:ancestor } : selector;
    const label = query.id ?? 'the public fixture book';
    let node;
    try {
      node = selectLayoutNode(sample, query);
    } catch (error) {
      if (!(error instanceof EvidenceError)) throw error;
      throw new MissingSearchEvidence(error.message);
    }
    this.source(node.source, `The evidence source for ${label} is outside this assertion's contract`);
    requireEvidence(placed(node.visibleRectPx), `${label} has no visible native bounds`);
    return node;
  }

  keyboard(sample) {
    const keyboard = sample.window?.keyboard;
    requireEvidence(keyboard && keyboard.revision === sample.window.revision && typeof keyboard.visible === 'boolean' &&
      Array.isArray(keyboard.rectsVp) && keyboard.rectsVp.every(placed) && keyboard.visible === (keyboard.rectsVp.length > 0),
    `The ${sample.state} keyboard metrics have no complete matching window revision`);
    this.source(keyboard.source, 'Keyboard metrics have an unapproved evidence source');
    return keyboard;
  }

  action(id, op, targetId) {
    const action = this.use(this.actions[id]);
    requireEvidence(action && action.op === op && action.targetId === targetId &&
      sequence(action.beforeSeq) && sequence(action.afterSeq) && action.beforeSeq <= action.afterSeq &&
      Number.isFinite(action.hostBeginMs) && Number.isFinite(action.hostEndMs) && action.hostBeginMs <= action.hostEndMs,
    `The ${id} action has no matching target, operation or time bracket`);
    return action;
  }

  bounded(instanceId, after, through, kinds, channel) {
    const source = channel === 'business' ? 'app-owner' : 'app-input';
    this.source(source, `The assertion does not accept ${source} evidence`);
    return this.events.filter(event => event.instanceId === instanceId && kinds.includes(event.kind) &&
      event.channel === channel && event.eventSeq > after && event.eventSeq <= through).map(event => this.use(event));
  }

  open(actionId = 'open-search', target = ENTRY) {
    const action = this.action(actionId, 'click', target);
    const matches = this.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-open-accepted'], 'business');
    const entry = target === emptyBookshelfEntry ? 'empty-shelf' : undefined;
    requireEvidence(matches.length === 1 && candidateIdentity(matches[0].payload) &&
      sequence(matches[0].payload.queryRevision) && matches[0].payload.entry === entry,
      'The bookshelf tap has no unique accepted search route and query revision');
    return { action, accepted: matches[0] };
  }

  editorLifecycle(ready, through) {
    const { action, accepted } = this.open();
    requireEvidence(ready.instanceId === action.instanceId && ready.hostBeginMs >= action.hostEndMs &&
      ready.beforeSeq >= accepted.eventSeq, 'The IME sample is outside the accepted bookshelf search session');
    const byEditor = new Map();
    for (const event of this.bounded(ready.instanceId, accepted.eventSeq, through, [EDITOR_FOCUS, EDITOR_RETIRED], 'input')) {
      const p = event.payload;
      if (!editorIdentity(p) || !matchesFields(p, accepted.payload, ['identity', 'navigation', 'mounting'])) continue;
      byEditor.set(p.editorId, event);
    }
    return byEditor;
  }

  focus(ready, through = ready.beforeSeq) {
    const focused = [...this.editorLifecycle(ready, through).values()]
      .filter(event => event.kind === EDITOR_FOCUS && event.payload.focused === true);
    requireEvidence(focused.length === 1, 'The current search scope has no unique focused native editor');
    return focused[0];
  }

  input() {
    const ready = this.sample('ime-ready');
    const action = this.action('input-search', 'inputText', EDITOR);
    requireEvidence(ready.instanceId === action.instanceId, 'Input action and IME sample belong to different app instances');
    return { ready, action };
  }

  submit() {
    const action = this.action('submit-search', 'click', SUBMIT);
    const intentMatches = this.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-button-intent'], 'input');
    const commits = this.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-submit-accepted'], 'business');
    requireEvidence(intentMatches.length === 1 && commits.length === 1,
      'The submit tap has no unique button intent and accepted submit');
    const [intent] = intentMatches, [commit] = commits;
    const a = intent.payload, b = commit.payload;
    requireEvidence(editorIdentity(a) && candidateIdentity(b) && sequence(b.queryRevision) &&
      sequence(b.previousQueryRevision) && sequence(b.previousOwner) && sequence(b.previousNavigation) &&
      intent.eventSeq < commit.eventSeq && matchesFields(a, b, ['identity', 'mounting']) &&
      a.owner === b.previousOwner && a.navigation === b.previousNavigation,
    'The button intent and commit do not belong to the same current editor and navigation generation');
    return { action, intent, commit };
  }
}

function entry(evidence) {
  const before = evidence.sample('before');
  const { action, accepted } = evidence.open();
  requireEvidence(before.instanceId === action.instanceId && before.hostEndMs <= action.hostBeginMs &&
    before.afterSeq <= action.beforeSeq, 'The bookshelf sample does not precede the accepted tap');
  const node = evidence.node(before, ENTRY, [BAR]);
  const keyboard = evidence.keyboard(before);
  const expected = { enabled: true, clickable: true, keyboardVisible: false };
  requireEvidence(typeof node.enabled === 'boolean' && typeof node.clickable === 'boolean',
    'The bookshelf search entry has no native enabled or clickable state');
  return compare({ enabled: node.enabled, clickable: node.clickable, keyboardVisible: keyboard.visible,
    path: node.path, actionId: action.actionId, identity: accepted.payload.identity, acceptedSeq: accepted.eventSeq },
  expected, node.enabled && node.clickable && !keyboard.visible,
  'The bookshelf search entry was disabled, could not be clicked or began with the keyboard visible');
}

function focus(evidence) {
  const ready = evidence.sample('ime-ready');
  const native = evidence.node(ready, EDITOR, [BAR, FIELD]);
  const current = evidence.focus(ready);
  requireEvidence(typeof native.focused === 'boolean' && sequence(current.payload.length),
    'Native focus or initial UTF-16 length is absent');
  return compare({ focused: native.focused, initialLength: current.payload.length, editorId: current.payload.editorId,
    eventSeq: current.eventSeq, path: native.path }, { focused: true, initialLength: 0 },
  native.focused && current.payload.length === 0, 'The current editor is unfocused or already contains text');
}

function imeBeforeInput(evidence) {
  const { ready, action } = evidence.input();
  const current = evidence.focus(ready);
  const native = evidence.node(ready, EDITOR, [BAR, FIELD]);
  const keyboard = evidence.keyboard(ready);
  requireEvidence(typeof native.focused === 'boolean', 'The native editor has no focus field');
  const beforeInput = ready.hostEndMs <= action.hostBeginMs && ready.afterSeq <= action.beforeSeq;
  const lifecycle = beforeInput ? evidence.editorLifecycle(ready, action.beforeSeq).get(current.payload.editorId) : current;
  const stillFocused = lifecycle.kind === EDITOR_FOCUS && lifecycle.payload.focused === true;
  return compare({ visible: keyboard.visible, rectsVp: keyboard.rectsVp, revision: keyboard.revision,
    editorId: current.payload.editorId, focused: native.focused && stillFocused,
    imeCaptureEndMs: ready.hostEndMs, inputBeginMs: action.hostBeginMs, beforeInput },
  { visible: true, focused: true, beforeInput: true }, keyboard.visible && beforeInput && native.focused && stillFocused,
  'The current editor has no observed focused IME before the input action');
}

function editSelection(evidence, expectedLength) {
  const { ready, action } = evidence.input();
  requireEvidence(ready.hostEndMs <= action.hostBeginMs && ready.afterSeq <= action.beforeSeq,
    'The edit interval cannot be tied to the earlier IME observation');
  const current = evidence.focus(ready, action.beforeSeq);
  const events = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq,
    [EDITOR_EDIT, EDITOR_SELECTION, EDITOR_FOCUS, EDITOR_RETIRED], 'input').filter(event =>
    event.payload.editorId === current.payload.editorId && editorIdentity(event.payload));
  const edits = events.filter(event => event.kind === EDITOR_EDIT);
  const selection = LAST(events.filter(event => event.kind === EDITOR_SELECTION));
  requireEvidence(edits.length > 0 && selection && sequence(current.payload.length) &&
    sequence(selection.payload.start) && sequence(selection.payload.end) && typeof selection.payload.focused === 'boolean',
  'The current editor did not produce both edit and native selection events in this input action');
  let length = current.payload.length;
  for (const { payload } of edits) {
    requireEvidence(sequence(payload.length) && payload.beforeLength === length && typeof payload.focused === 'boolean',
      'The native edit sequence has a length discontinuity or an unreadable focus value');
    length = payload.length;
  }
  const stillFocused = events.every(event => event.kind !== EDITOR_RETIRED && event.payload.focused === true);
  const actual = { editorId: current.payload.editorId, initialLength: current.payload.length, length,
    start: selection.payload.start, end: selection.payload.end, focused: stillFocused,
    editSeqs: edits.map(event => event.eventSeq), selectionSeq: selection.eventSeq };
  const expected = { initialLength: 0, length: expectedLength, start: expectedLength, end: expectedLength, focused: true };
  return compare(actual, expected, matchesFields(actual, expected, Object.keys(expected)),
    'The current editor did not keep focus and finish with the expected UTF-16 length and folded selection');
}

function submit(evidence, expectedLength) {
  const { ready, action: input } = evidence.input();
  const { action, intent, commit } = evidence.submit();
  requireEvidence(action.instanceId === input.instanceId && input.hostEndMs <= action.hostBeginMs &&
    input.afterSeq <= action.beforeSeq, 'The submit click has no preceding current input action');
  const focused = evidence.focus(ready);
  const current = focused.payload.editorId === intent.payload.editorId;
  const lifecycle = evidence.editorLifecycle(ready, action.beforeSeq).get(intent.payload.editorId);
  const typed = evidence.open().accepted.payload;
  const readyOwner = commit.payload.previousQueryRevision === typed.queryRevision;
  const nextQuery = commit.payload.queryRevision === commit.payload.previousQueryRevision + 1;
  const nextNavigation = commit.payload.navigation > commit.payload.previousNavigation;
  requireEvidence(current && readyOwner && nextQuery && nextNavigation &&
    typeof intent.payload.enabled === 'boolean' && typeof intent.payload.semantic === 'string' && sequence(commit.payload.length),
  'The accepted submit has an invalid editor, navigation or query origin');
  const actual = { enabled: intent.payload.enabled, semantic: intent.payload.semantic, length: commit.payload.length,
    focusedAtTapStart: lifecycle?.kind === EDITOR_FOCUS && lifecycle.payload.focused === true,
    actionId: action.actionId, intentSeq: intent.eventSeq, commitSeq: commit.eventSeq,
    previousQueryRevision: commit.payload.previousQueryRevision, queryRevision: commit.payload.queryRevision };
  const expected = { enabled: true, semantic: 'search', length: expectedLength, focusedAtTapStart: true };
  return compare(actual, expected, matchesFields(actual, expected, Object.keys(expected)),
    'The current editor lost focus before the tap or the button did not submit an enabled search with the expected length');
}

function resultFacts(events, commit) {
  const current = events.filter(event => event.channel === 'business' && event.instanceId === commit.instanceId &&
    event.eventSeq > commit.eventSeq);
  const endpoints = current.filter(event => event.kind === 'search-surface-settled' && event.payload.mode === 'results' &&
    matchesFields(event.payload, commit.payload, ['identity', 'mounting', 'navigation', 'queryRevision']) &&
    sequence(event.payload.owner) && event.payload.owner > 0);
  if (endpoints.length !== 1) return { reason: 'The current submission has no unique guarded results onSettled endpoint' };
  const [settled] = endpoints;
  const projected = LAST(current.filter(event => event.kind === 'search-result-projection' &&
    matchesFields(event.payload, settled.payload, ['owner', 'queryRevision'])));
  if (!projected || !sequence(projected.payload.page) || !Object.hasOwn(DONE, projected.payload.state)) {
    return { reason: 'The current results owner has no terminal empty or results projection' };
  }
  const viewportId = `reader-search-result-list:${projected.payload.page}:${commit.payload.queryRevision}`;
  if (projected.payload.viewportId !== viewportId) return { reason: 'The projection belongs to another native result viewport' };
  return { settled, projected, viewportId };
}

/** The accepted submit must be in the action bracket. Subsequent events can
 * settle that generation through the caller's last observed checkpoint. */
export function searchResultEndpoint(events, submitBeforeSeq, submitAfterSeq = Infinity) {
  const commits = events.filter(event => event.channel === 'business' && event.kind === 'search-submit-accepted' &&
    event.eventSeq > submitBeforeSeq && event.eventSeq <= submitAfterSeq);
  if (commits.length !== 1 || !candidateIdentity(commits[0].payload) || !sequence(commits[0].payload.queryRevision)) return undefined;
  const [accepted] = commits;
  const facts = resultFacts(events, accepted);
  return facts.reason === undefined ? { accepted, ...facts } : undefined;
}

function resultsSettled(evidence) {
  const { action, commit } = evidence.submit();
  const result = evidence.sample('results-settled');
  requireEvidence(result.instanceId === action.instanceId && result.hostBeginMs >= action.hostEndMs &&
    result.beforeSeq >= action.afterSeq, 'The results sample does not follow the current submit action');
  const events = evidence.bounded(result.instanceId, commit.eventSeq, result.beforeSeq,
    ['search-surface-settled', 'search-result-projection'], 'business');
  const facts = resultFacts(events, commit);
  requireEvidence(!facts.reason, facts.reason);
  const { settled: endpoint, projected: projection, viewportId: expectedViewport } = facts;
  const marker = DONE[projection.payload.state];
  const node = evidence.node(result, marker);
  const viewport = evidence.node(result, expectedViewport, [marker]);
  return compare({ state: projection.payload.state, queryRevision: commit.payload.queryRevision,
    searchActive: typeof projection.payload.searchActive === 'boolean' ? projection.payload.searchActive : null,
    publicationRevision: sequence(projection.payload.publicationRevision) ? projection.payload.publicationRevision : null,
    owner: endpoint.payload.owner, marker, markerPath: node.path, viewportId: expectedViewport,
    viewportPath: viewport.path, settledSeq: endpoint.eventSeq, projectionSeq: projection.eventSeq },
  { states: ['empty', 'results'], queryRevision: commit.payload.queryRevision, matchingNativeViewport: true }, true);
}

const LIVE = ['identity', 'navigation', 'mounting'];
const SCOPE = ['identity', 'mounting'];
const PROJECTION = 'search-page-projection';
const ACCEPTED = 'search-submit-accepted';
const SOURCE_INTENTS = { button: 'search-button-intent', ime: 'search-ime-intent', history: 'search-history-intent' };
const PUBLIC_RESULT = 'reader-search-public-local-result';
const SEARCH_RESULT_VIEWPORT = 'reader-search-result-viewport';

function output(actual, expected, valid, invalid, observationsComplete = true) {
  return { ...compare(actual, expected, valid, invalid), observationsComplete };
}

function validLease(value) {
  return sequence(value?.generation) && sequence(value?.session) && typeof value?.active === 'boolean';
}

function follows(sample, action) {
  return sample.instanceId === action.instanceId && sample.hostBeginMs >= action.hostEndMs &&
    sample.beforeSeq >= action.afterSeq;
}

function association(evidence, actionId, source, target) {
  const softIme = source === 'ime' && evidence.actions[actionId]?.op === imeSearchTap;
  const op = source === 'ime' ? 'keyEvent' : 'click';
  const action = evidence.action(actionId, softIme ? imeSearchTap : op, source === 'button' ? SUBMIT : softIme ? EDITOR : target);
  if (source === 'ime' && !softIme) requireEvidence(action.key === 'Enter', 'Submit has no admitted editor key action');
  const sampledKey = softIme ? evidence.sample(action.from) : null;
  if (softIme) requireEvidence(sampledKey.imeSearchKey && sampledKey.instanceId === action.instanceId &&
    sampledKey.afterSeq <= action.beforeSeq && sampledKey.hostEndMs <= action.hostBeginMs &&
    evidence.node(sampledKey, EDITOR, [BAR, FIELD]).focused === true && evidence.keyboard(sampledKey).visible === true,
  'Submit has no current verified soft Search key, native editor, and IME geometry');
  const intents = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq,
    [SOURCE_INTENTS[source]], 'input');
  const commits = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq, [ACCEPTED], 'business');
  return { action, intents, commits, intent: intents[0], commit: commits[0], imeSearchKey:sampledKey?.imeSearchKey };
}

function phaseSubmit(evidence, assertion) {
  const expected = assertion.expected;
  const current = association(evidence, assertion.action, expected.source, assertion.target);
  const { action, intents, commits, intent, commit } = current;
  if (commits.length > 1) return output({ accepted: commits.length, sequences: commits.map(event => event.eventSeq) },
    expected, false, 'One native action submitted more than one query revision', intents.length === 1);
  requireEvidence(intents.length === 1 && commits.length === 1, 'Missing a unique current input intent or business acceptance');
  const a = intent.payload, b = commit.payload;
  requireEvidence(editorIdentity(a) && candidateIdentity(b) && sequence(b.queryRevision) && sequence(b.previousQueryRevision) &&
    sequence(b.previousOwner) && sequence(b.previousNavigation) && sequence(b.length) &&
    typeof a.enabled === 'boolean' && typeof a.semantic === 'string' && validLease(b.writeLease),
  'The input and submit records lack the required owner, operation or revision facts');
  const origin = assertion.priorAction ?
    association(evidence, assertion.priorAction, 'button').commit : evidence.open().accepted;
  requireEvidence(origin && origin.instanceId === action.instanceId && sequence(origin.payload.queryRevision) &&
    origin.eventSeq <= action.beforeSeq, 'Missing the earlier owner revision in this app session');
  const sameOrigin = matchesFields(origin.payload, b, SCOPE);
  const history = expected.source === 'history' && assertion.target === 'reader-search-history-public-item-0' ?
    evidence.sample(action.from) : null;
  requireEvidence(!history || (history.instanceId === action.instanceId && history.afterSeq <= action.beforeSeq &&
    history.hostEndMs <= action.hostBeginMs), 'The native history chip is from outside the accepted submit');
  const historyChipPath = history ? evidence.node(history, assertion.target).path : undefined;
  const valid = sameOrigin && matchesFields(a, b, SCOPE) && intent.eventSeq < commit.eventSeq &&
    a.owner === b.previousOwner && a.navigation === b.previousNavigation && b.navigation > b.previousNavigation &&
    b.previousQueryRevision === origin.payload.queryRevision && b.queryRevision === b.previousQueryRevision + 1 &&
    a.enabled && a.semantic === 'search' && b.length === expected.length &&
    (expected.source !== 'history' || a.length === expected.length) &&
    (!assertion.priorAction || (validLease(origin.payload.writeLease) &&
      b.writeLease.session === origin.payload.writeLease.session && b.writeLease.generation > origin.payload.writeLease.generation));
  return output({ accepted: commits.length, length: b.length, source: expected.source, queryRevision: b.queryRevision,
    previousQueryRevision: b.previousQueryRevision, earlierQueryRevision: origin.payload.queryRevision,
    navigation: b.navigation, previousNavigation: b.previousNavigation, lease: b.writeLease, intentSeq: intent.eventSeq,
    acceptedSeq: commit.eventSeq, actionId: action.actionId, ...(historyChipPath ? {historyChipPath} : {}),
    ...(current.imeSearchKey ? {imeSearchKey:current.imeSearchKey} : {}) },
  expected, valid, 'The accepted query does not follow the current intent and previous query owner');
}

function phaseEdit(evidence, assertion) {
  const expected = assertion.expected;
  const sample = evidence.sample(assertion.sample);
  const ownerEvent = assertion.priorAction ? association(evidence, assertion.priorAction, 'button').commit
    : evidence.open(assertion.entryAction).accepted;
  requireEvidence(ownerEvent && candidateIdentity(ownerEvent.payload), 'Missing query owner before typing');
  const action = evidence.action(assertion.action, 'inputText', EDITOR);
  requireEvidence(action.instanceId === ownerEvent.instanceId && action.instanceId === sample.instanceId &&
    sample.afterSeq <= action.beforeSeq && sample.hostEndMs <= action.hostBeginMs && action.inputLength === expected.length,
  'The allowlisted input and sampled editor do not share the earlier query owner');
  const owner = ownerEvent.payload;
  const focused = LAST(evidence.bounded(action.instanceId, ownerEvent.eventSeq, action.beforeSeq,
    [EDITOR_FOCUS, EDITOR_RETIRED], 'input').filter(event => editorIdentity(event.payload) && matchesFields(event.payload, owner, LIVE)));
  requireEvidence(focused && focused.kind === EDITOR_FOCUS && sequence(focused.payload.length), 'No native editor focus on the accepted owner');
  const native = evidence.node(sample, EDITOR, [BAR, FIELD]), keyboard = evidence.keyboard(sample);
  requireEvidence(typeof native.focused === 'boolean' && typeof focused.payload.focused === 'boolean', 'Missing native focus state');
  const emitted = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq,
    [EDITOR_EDIT, EDITOR_SELECTION], 'input').filter(event =>
    editorIdentity(event.payload) && event.payload.editorId === focused.payload.editorId);
  const edits = emitted.filter(event => event.kind === EDITOR_EDIT);
  const lastSelection = LAST(emitted.filter(event => event.kind === EDITOR_SELECTION));
  const draft = LAST(evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-draft-accepted'], 'business')
    .filter(event => event.payload.owner === focused.payload.owner));
  requireEvidence(edits.length && lastSelection && sequence(lastSelection.payload.start) && sequence(lastSelection.payload.end) &&
    draft && sequence(draft.payload.queryRevision) && sequence(draft.payload.length), 'No native edit, caret and accepted draft in the input bracket');
  let length = expected.initialLength;
  const coherentEdits = edits.every(({payload}) => {
    const coherent = payload.beforeLength === length && sequence(payload.length) && payload.focused === true;
    length = payload.length;
    return coherent;
  });
  const actual = { length, start: lastSelection.payload.start, end: lastSelection.payload.end, draftLength: draft.payload.length,
    queryRevision: draft.payload.queryRevision, focused: focused.payload.focused && native.focused, keyboardVisible: keyboard.visible,
    initialLength: edits[0].payload.beforeLength, coherentEdits, caretSeq: lastSelection.eventSeq, draftSeq: draft.eventSeq };
  return output(actual, expected, coherentEdits && actual.focused && actual.keyboardVisible &&
    owner.queryRevision === actual.queryRevision && actual.draftLength === expected.length &&
    matchesFields(actual, expected, ['initialLength', 'length', 'start', 'end']), 'The draft or selection disagrees with the native input on this query revision');
}

function phaseReedit(evidence, assertion) {
  const {action: prior, commit} = association(evidence, assertion.priorAction, 'button');
  const action = evidence.action(assertion.action, 'click', EDITOR);
  const sample = evidence.sample(assertion.sample);
  requireEvidence(commit && action.instanceId === prior.instanceId && action.beforeSeq >= prior.afterSeq && follows(sample, action),
    'The re-edit sample does not follow the first accepted submit and editor tap');
  const edits = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-edit-accepted'], 'business');
  const endpoint = LAST(evidence.bounded(action.instanceId, action.beforeSeq, sample.beforeSeq, ['search-surface-settled'], 'business')
    .filter(event => event.payload.mode === 'input'));
  requireEvidence(edits.length === 1 && endpoint && candidateIdentity(edits[0].payload) && candidateIdentity(endpoint.payload),
    'Missing guarded re-edit acceptance or the input surface endpoint');
  const edit = edits[0].payload;
  requireEvidence(validLease(edit.beforeLease) && validLease(edit.writeLease), 'The old query worker lease was not observed across re-edit');
  const source = commit.payload;
  const retired = edit.writeLease.active === false && matchesFields(edit.beforeLease, edit.writeLease, ['session']) &&
    (!edit.beforeLease.active || edit.writeLease.generation > edit.beforeLease.generation);
  const keyboard = evidence.keyboard(sample), native = evidence.node(sample, EDITOR, [BAR, FIELD]);
  requireEvidence(typeof native.focused === 'boolean', 'The reopened native editor has no focus value');
  const actual = { firstRevision: source.queryRevision, editRevision: edit.queryRevision, before: edit.beforeLease, after: edit.writeLease,
    mode: edit.mode, focused: native.focused, keyboardVisible: keyboard.visible, retired, owner: edit.owner, settleSeq: endpoint.eventSeq };
  return output(actual, assertion.expected, matchesFields(edit, source, LIVE) && matchesFields(edit, endpoint.payload, LIVE) &&
    edit.queryRevision === source.queryRevision && edit.queryRevision === endpoint.payload.queryRevision && endpoint.payload.owner === edit.owner &&
    edit.mode === 'input' && native.focused && keyboard.visible && retired, 'Re-edit did not retain the first query identity and retire its active work before the new edit');
}

function phaseClear(evidence, assertion) {
  const action = evidence.action(assertion.action, 'click', 'reader-book-search-clear');
  const clear = LAST(evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-editor-clear'], 'input'));
  const accepted = LAST(evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-draft-accepted'], 'business'));
  requireEvidence(clear && accepted && editorIdentity(clear.payload) && sequence(accepted.payload.length), 'Missing clear action and current draft receipts');
  return output({ beforeLength: clear.payload.beforeLength, afterLength: accepted.payload.length, owner: accepted.payload.owner,
    queryRevision: accepted.payload.queryRevision, acceptedSeq: accepted.eventSeq }, assertion.expected,
  clear.eventSeq < accepted.eventSeq && clear.payload.owner === accepted.payload.owner &&
    clear.payload.beforeLength === assertion.expected.beforeLength && accepted.payload.length === 0,
  'Native clear did not empty the same search editor draft');
}

function verifiedSearchAttempt(evidence, {instanceId,start,end,generation,session,queryRevision,trigger}, status) {
  const attempts = evidence.bounded(instanceId,start,end,[ONLINE_ATTEMPT],'business')
    .filter(({payload}) => matchesFields(payload,{generation,session,queryRevision},['generation','session','queryRevision']));
  const started = attempts.filter(event => event.payload.stage === 'started');
  const settled = attempts.filter(event => event.payload.stage === 'settled');
  const response = settled[0]?.payload;
  const facts = {trigger,generation,startedSeq:started[0]?.eventSeq ?? null,settledSeq:settled[0]?.eventSeq ?? null,
    httpStatus:response?.httpStatus ?? null,sameFailedSource:response?.sameFailedSource ?? null};
  const expected = {trigger,sourceCount:1,sourceOrdinal:0,requestedPage:1,
    ...(trigger === 'retry' ? {sameFailedSource:true} : {})};
  const keys = Object.keys(expected);
  const observedStatus = Number.isInteger(response?.httpStatus) && response.httpStatus >= 400 && response.httpStatus <= 599;
  if (attempts.length !== started.length + settled.length || started.length > 1 || settled.length > 1 ||
      attempts.some(({payload}) => keys.some(key => payload[key] != null && payload[key] !== expected[key])) ||
      response?.outcome === 'completed' || observedStatus && response.httpStatus !== status) {
    return {facts,valid:false,reason:'The fixed source attempt changed source, page, or HTTP outcome, or was observed more than once'};
  }
  requireEvidence(started.length === 1 && settled.length === 1 && response.outcome === 'failed' &&
    response.httpStatus === status && attempts.every(({payload}) => matchesFields(payload,expected,keys)),
  'The current single-source attempt has no matching start and actual HTTP rejection for this work lease');
  return {facts,valid:started[0].eventSeq < settled[0].eventSeq,
    reason:'The fixed source response preceded its worker start'};
}

function phaseProjection(evidence, assertion) {
  const expected = assertion.expected;
  const submitted = expected.mode === 'results';
  const origin = submitted ? association(evidence, assertion.action, expected.source ?? 'button', assertion.target) :
    assertion.target === emptyBookshelfEntry ? evidence.open(assertion.action, emptyBookshelfEntry) : evidence.open();
  const { action } = origin, commit = origin.commit ?? origin.accepted;
  requireEvidence(commit && candidateIdentity(commit.payload) && sequence(commit.payload.queryRevision), 'Missing a current query or route acceptance');
  const sample = evidence.sample(assertion.sample);
  requireEvidence(follows(sample, action), 'The projection sample is outside the accepted action session');
  const active = commit.payload;
  if (submitted && expected.node) requireEvidence(validLease(active.writeLease),
    'Missing the accepted work lease for this native projection');
  const settled = LAST(evidence.bounded(action.instanceId, action.beforeSeq, sample.beforeSeq, ['search-surface-settled'], 'business')
    .filter(event => event.payload.mode === expected.mode && matchesFields(event.payload, active, LIVE)));
  requireEvidence(settled && sequence(settled.payload.owner), 'No settled search surface for this navigation generation');
  const projection = LAST(evidence.bounded(action.instanceId, action.beforeSeq, sample.beforeSeq, [PROJECTION], 'business')
    .filter(event => event.payload.owner === settled.payload.owner));
  requireEvidence(projection && sequence(projection.payload.page) && sequence(projection.payload.queryRevision) &&
    sequence(projection.payload.publicationRevision) && sequence(projection.payload.resultCount) &&
    typeof projection.payload.projection === 'string' && typeof projection.payload.searchActive === 'boolean',
  'The settled native surface is missing an identified query projection');
  const p = projection.payload;
  const actual = { projection: p.projection, operation: p.operation ?? null, resultCount: p.resultCount,
    incompleteCount: p.incompleteCount ?? null, failedCount: p.failedCount ?? null, skippedCount: p.skippedCount ?? null,
    localFailed: p.localFailed ?? null, sourceListFailed: p.sourceListFailed ?? null, stopped: p.stopped ?? null,
    searchActive: p.searchActive, queryRevision: p.queryRevision, acceptedQueryRevision: active.queryRevision,
    operationGeneration: p.operationGeneration ?? null, owner: p.owner, page: p.page,
    sourceRequiredReason: p.sourceRequiredReason ?? null, projectionSeq: projection.eventSeq };
  if (settled.payload.queryRevision !== active.queryRevision || p.queryRevision !== active.queryRevision ||
    (validLease(active.writeLease) && sequence(p.operationGeneration) && p.operationGeneration !== active.writeLease.generation)) {
    return output(actual, expected, false, 'The displayed result is assigned to a different query revision or operation generation', false);
  }
  if (submitted) {
    const viewportId = `reader-search-result-list:${p.page}:${active.queryRevision}`;
    requireEvidence(sequence(p.operationGeneration) && typeof p.viewportId === 'string', 'Missing the current operation or viewport identity');
    const visible = sample.nodes.filter(node => node.visible && node.id?.startsWith('reader-search-result-list:'));
    if (p.viewportId !== viewportId || (visible.length === 1 && visible[0].id !== viewportId)) {
      return output({ ...actual, viewportId: p.viewportId, nativeViewport: visible[0]?.id ?? null }, expected, false,
        'The native results viewport displays a different query generation', visible.length === 1);
    }
    const markerAncestors = expected.node ? [expected.node] : undefined;
    actual.viewportPath = evidence.node(sample, viewportId, markerAncestors).path;
  }
  if (expected.node) actual.marker = evidence.node(sample, expected.node).path;
  if (expected.publicResult && p.projection === 'results') {
    const alias = expected.publicResult === true ? PUBLIC_RESULT : `${PUBLIC_RESULT}-${expected.publicResult}`;
    actual.publicResultPath = evidence.node(sample, alias, submitted && expected.node ? [p.viewportId] : undefined).path;
  }
  if (expected.forbidEarlierPublicResult && sample.nodes.some(node => node.visible && node.alias === PUBLIC_RESULT)) {
    return output({ ...actual, earlierPublicResultVisible: true }, expected, false,
      'This later query still exposes the public row that belonged to the previous query');
  }
  if (expected.confirmedEmpty) {
    requireEvidence(['incompleteCount','failedCount','skippedCount'].every(key => sequence(actual[key])) &&
      ['localFailed','sourceListFailed','stopped'].every(key => typeof actual[key] === 'boolean'),
    'Confirmed empty requires complete failure, skip, continuation and scope facts');
  }
  const valid = expected.projections.includes(p.projection) && matchesFields(actual, expected,
    Object.keys(expected).filter(key => Object.hasOwn(actual, key) && key !== 'resultCount')) &&
    (!expected.publicResult || actual.publicResultPath !== undefined && p.resultCount > 0) &&
    (expected.resultCount === undefined || actual.resultCount === expected.resultCount) &&
    (expected.positiveFact === undefined || sequence(actual[expected.positiveFact]) && actual[expected.positiveFact] > 0) &&
    (!expected.confirmedEmpty || p.operation === 'empty' && p.resultCount === 0 && p.stopped === false &&
      p.incompleteCount === 0 && p.failedCount === 0 && p.skippedCount === 0 && p.localFailed === false && p.sourceListFailed === false);
  if (valid && expected.nativeConfirmedEmpty === true) return phaseEmptyNative(evidence,sample,p.viewportId,actual,expected);
  if (valid && expected.nativeUnconfirmedEmpty === true) {
    return phaseUnconfirmedEmpty(evidence,action,commit,projection,sample,p.viewportId,actual,expected);
  }
  if (valid && expected.requirePendingFirstAttempt === true) {
    return phasePendingFirstAttempt(evidence,action,commit,sample,actual,expected);
  }
  if (valid && expected.httpResponseStatus !== undefined) {
    const {generation,session} = active.writeLease;
    const attempt = verifiedSearchAttempt(evidence,{instanceId:action.instanceId,start:commit.eventSeq,end:projection.eventSeq - 1,
      generation,session,queryRevision:active.queryRevision,trigger:'initial'},expected.httpResponseStatus);
    return output({...actual,onlineAttempt:attempt.facts},expected,attempt.valid,attempt.reason);
  }
  return output(actual, expected, valid, 'The current projection or business terminal facts disagree with the public fixture');
}

function phasePendingFirstAttempt(evidence, action, commit, sample, actual, expected) {
  const {generation,session} = commit.payload.writeLease;
  const lease = {generation,session,queryRevision:commit.payload.queryRevision};
  const attempts = evidence.bounded(action.instanceId,commit.eventSeq,sample.afterSeq,[ONLINE_ATTEMPT],'business')
    .filter(({payload}) => matchesFields(payload,lease,Object.keys(lease)));
  const first = {stage:'started',trigger:'initial',sourceCount:1,sourceOrdinal:0,requestedPage:1};
  const starts = attempts.filter(({payload}) => matchesFields(payload,first,Object.keys(first)));
  if (starts.length > 1) {
    return output({...actual,onlineStartSequences:starts.map(({eventSeq}) => eventSeq)},expected,false,
      'The current work lease started the initial single-source page more than once');
  }
  if (sample.captureComplete !== true || starts.length !== 1 || starts[0].eventSeq > sample.beforeSeq || attempts.length !== 1) {
    return appendUnobserved(actual,expected,'No single initial online worker spans the complete native loading sample');
  }
  return output({...actual,onlineAttempt:{startedSeq:starts[0].eventSeq,observedThroughSeq:sample.afterSeq,
    requestedPage:first.requestedPage}},expected,true,null);
}

function phaseUnconfirmedEmpty(evidence, action, commit, projection, sample, viewportId, actual, expected) {
  const {generation,session} = commit.payload.writeLease;
  const {queryRevision} = commit.payload;
  const lease = {generation,session,queryRevision};
  const attempts = evidence.bounded(action.instanceId,commit.eventSeq,projection.eventSeq - 1,[ONLINE_ATTEMPT],'business')
    .filter(({payload}) => matchesFields(payload,lease,Object.keys(lease)));
  const starts = attempts.filter(({payload}) => payload.stage === 'started');
  const settlements = attempts.filter(({payload}) => payload.stage === 'settled');
  const scope = {trigger:'initial',sourceCount:1,sourceOrdinal:0,requestedPage:1};
  const core = {outcome:'completed',capability:PAGE_RECEIPT,receiptState:'unknown',
    receiptReason:'unverifiedEmpty',progressState:'unknown',addedResultCount:0};
  const response = settlements[0]?.payload;
  const disagrees = (facts, target) => Object.keys(target)
    .some(key => facts?.[key] != null && facts[key] !== target[key]);
  if (attempts.length !== starts.length + settlements.length || starts.length > 1 || settlements.length > 1 ||
      attempts.some(({payload}) => disagrees(payload,scope)) || disagrees(response,core) || response?.nextPage !== undefined ||
      starts[0] && settlements[0] && starts[0].eventSeq >= settlements[0].eventSeq) {
    return output(actual,expected,false,'The current unconfirmed empty receipt disagrees with the negotiated single-source first page');
  }
  const native = phaseEmptyNative(evidence,sample,viewportId,actual,expected,'unconfirmed');
  if (native.verdict !== 'PASS') return native;
  const prefix = `${actual.viewportPath}/`;
  const headings = sample.nodes.filter(node => node.path.startsWith(prefix) &&
    [searchUnconfirmedEmptyHeading,searchMismatchedEmptyHeading].includes(node.alias))
    .map(node => ({node,visible:effectiveAppearance(sample,node).visible}))
    .filter(item => item.visible !== false);
  for (const {node} of headings) evidence.source(node.source,'The search status title uses unapproved evidence');
  if (headings.some(({node,visible}) => node.alias === searchMismatchedEmptyHeading && visible === true)) {
    return output(native.actual,expected,false,'The current native List shows an incompatible search status');
  }
  requireEvidence(headings.length === 1 && headings[0].node.alias === searchUnconfirmedEmptyHeading &&
    headings[0].visible === true,'No unique visible unconfirmed empty status in the current native List');
  const observed = {...native.actual,nativeStatusPath:headings[0].node.path};
  if (starts.length !== 1 || settlements.length !== 1 ||
      !attempts.every(({payload}) => matchesFields(payload,scope,Object.keys(scope))) ||
      !matchesFields(response,core,Object.keys(core))) {
    return appendUnobserved(observed,expected,'No attempt and accepted negotiated unverified empty receipt bound to the current work lease');
  }
  return output({...observed,onlineAttempt:{startedSeq:starts[0].eventSeq,settledSeq:settlements[0].eventSeq,
    requestedPage:scope.requestedPage,receiptState:core.receiptState,receiptReason:core.receiptReason}},expected,true,null);
}

function phaseEmptyNative(evidence, sample, viewportId, actual, expected, kind = 'confirmed') {
  const observed = kind === 'confirmed' ? sample.searchConfirmedEmptyObserved : sample.searchUnconfirmedEmptyObserved;
  requireEvidence(sample.captureComplete === true && observed === true, `No complete native scan of the ${kind} empty results`);
  const surface = evidence.node(sample, 'reader-library-search-surface');
  const inSurface = node => node.path.startsWith(`${surface.path}/`);
  const lists = sample.nodes.filter(node => node.type === 'List' &&
    node.id?.startsWith('reader-search-result-list:') && inSurface(node))
    .map(node => ({node,visible:effectiveAppearance(sample,node).visible}))
    .filter(item => item.visible !== false);
  for (const {node} of lists) evidence.source(node.source, `A ${kind} empty List uses unapproved evidence`);
  if (lists.some(({node,visible}) => node.id !== viewportId && visible === true)) {
    return output({...actual,nativeViewportIds:lists.map(({node}) => node.id)},expected,false,
      `A different native result list is still visible in the ${kind} empty Search surface`);
  }
  const candidates = sample.nodes.filter(node => inSurface(node) && (node.searchResultMount || node.unresolvedSearchResult))
    .map(node => ({node,visible:effectiveAppearance(sample,node).visible}))
    .filter(item => item.visible !== false);
  for (const {node} of candidates) evidence.source(node.source, 'The search result row uses unapproved evidence');
  const visibleRows = candidates.filter(({node,visible}) => node.searchResultMount && visible === true);
  if (visibleRows.length) {
    return output({...actual,nativeRows:visibleRows.map(({node}) => ({path:node.path,...node.searchResultMount}))},
      expected,false,`The ${kind} empty native surface still shows search result cards`);
  }
  requireEvidence(lists.length === 1 && lists[0].node.id === viewportId && lists[0].visible === true,
    `No unique current native List for ${kind} empty`);
  requireEvidence(!candidates.length, 'A possible native result card has unavailable scope or visibility facts');
  return output({...actual,nativeResultCount:0},expected,true,null);
}

function phaseEmptyRerun(evidence, assertion) {
  const {expected} = assertion;
  const action = evidence.action(assertion.action, 'click', EMPTY_RERUN);
  const before = evidence.sample(assertion.baseline);
  requireEvidence(action.from === assertion.baseline && before.instanceId === action.instanceId &&
    before.afterSeq <= action.beforeSeq && before.hostEndMs <= action.hostBeginMs,
  'The rerun action has no current native confirmed-empty baseline');
  const original = phaseProjection(evidence, {action:assertion.priorAction,sample:assertion.baseline,
    expected:{mode:'results',projections:['empty'],searchActive:false,node:DONE.empty,confirmedEmpty:true,nativeConfirmedEmpty:true}});
  if (original.verdict !== 'PASS') return {...original,expected};
  const initial = original.actual;
  const viewport = `reader-search-result-list:${initial.page}:${initial.queryRevision}`;
  const button = evidence.node(before, EMPTY_RERUN, [DONE.empty, viewport]);
  requireEvidence(button.type === 'Button' && button.enabled === true && button.clickable === true &&
    effectiveAppearance(before,button).visible === true, 'The current empty list has no enabled rerun button');

  const after = evidence.samples[assertion.sample];
  const comparable = after && follows(after,action) && after.captureComplete === true &&
    typeof before.window?.id === 'string' && after.window?.id === before.window.id;
  const events = evidence.bounded(action.instanceId,action.beforeSeq,
    comparable ? after.beforeSeq : action.afterSeq, ['search-page-action', ACCEPTED, PROJECTION], 'business');
  const admissions = events.filter(event => event.kind === 'search-page-action' && event.payload.action === 'retry');
  const generation = initial.operationGeneration + 1;
  const actual = {accepted:admissions.length,owner:initial.owner,page:initial.page,queryRevision:initial.queryRevision,
    beforeGeneration:initial.operationGeneration,viewportId:viewport};
  if (admissions.length > 1 || events.some(event => event.kind === ACCEPTED)) {
    return output(actual,expected,false,'The rerun click dispatched more than once or became a different explicit submit',false);
  }

  requireEvidence(admissions.length === 1,'The native rerun has no current page acceptance');
  requireEvidence(comparable,'The current rerun lacks a complete same-window endpoint');
  const sample = evidence.sample(assertion.sample);
  requireEvidence(!evidence.keyboard(before).visible && !evidence.keyboard(sample).visible,
    'Confirmed-empty rerun requires its normal results surface without an active editor');

  const [admitted] = admissions;
  const scope = ['owner','page','queryRevision'];
  const publications = events.filter(event => event.kind === PROJECTION && event.eventSeq > admitted.eventSeq);
  const provable = [...scope,'operationGeneration','resultCount'];
  requireEvidence(provable.every(key => sequence(admitted.payload[key])),
    'The accepted rerun has no comparable owner or original work generation');
  if (admitted.eventSeq > action.afterSeq || !matchesFields(admitted.payload,initial,provable)) {
    return output(actual,expected,false,'The rerun action belonged to a different owner, query or prior work generation');
  }
  const loading = publications.filter(({payload}) => payload.projection === 'loading' || payload.operation === 'loading');
  const endpoint = LAST(publications)?.payload;
  requireEvidence(endpoint && provable.every(key => sequence(endpoint[key])) &&
    typeof endpoint.viewportId === 'string' && typeof endpoint.searchActive === 'boolean',
  'The rerun has no identified terminal publication');
  const wrongScope = publications.some(({payload}) => scope.some(key => sequence(payload[key]) && payload[key] !== initial[key]));
  const firstLoading = loading[0]?.eventSeq;
  const wrongGeneration = publications.some(({eventSeq,payload}) => sequence(payload.operationGeneration) &&
    (payload.operationGeneration > generation ||
      (firstLoading !== undefined && eventSeq >= firstLoading && payload.operationGeneration !== generation)));
  if (wrongScope || wrongGeneration || endpoint.operationGeneration !== generation || endpoint.viewportId !== viewport) {
    return output({...actual,afterGeneration:endpoint.operationGeneration},expected,false,
      'The rerun changed owner, query or viewport, or did not settle exactly one new work generation');
  }
  requireEvidence(loading.every(({payload}) => [...scope, 'operationGeneration'].every(key => sequence(payload[key])) &&
    typeof payload.projection === 'string' && typeof payload.operation === 'string' && typeof payload.searchActive === 'boolean'),
  'The rerun loading observation has incomplete work or page facts');
  const prematureTerminal = firstLoading !== undefined && publications.some(({eventSeq,payload}) =>
    eventSeq < firstLoading && payload.operationGeneration === generation && payload.searchActive === false);
  if (prematureTerminal || loading.some(({payload}) =>
    payload.projection !== 'loading' || payload.operation !== 'loading' || payload.searchActive !== true)) {
    return output(actual,expected,false,'The new work published inconsistent loading or terminal facts');
  }
  requireEvidence(endpoint.searchActive === false,'The new work has no settled terminal publication');
  const counts = ['resultCount','failedCount','skippedCount','incompleteCount'];
  const flags = ['searchActive','stopped','localFailed','sourceListFailed'];
  requireEvidence(counts.every(key => sequence(endpoint[key])) && flags.every(key => typeof endpoint[key] === 'boolean'),
    'The rerun terminal is missing its failure, skip or stop facts');
  const terminal = {...actual,afterGeneration:generation,loadingSeq:firstLoading ?? null,projection:endpoint.projection,
    operation:endpoint.operation,resultCount:endpoint.resultCount};
  if (endpoint.projection !== 'empty' || endpoint.operation !== 'empty' ||
      counts.some(key => endpoint[key] !== 0) || flags.some(key => endpoint[key] !== false)) {
    return output(terminal,expected,false,'The new work did not settle to the confirmed-empty result');
  }
  return phaseEmptyNative(evidence,sample,viewport,terminal,expected);
}

export function searchSourceRetryVisibility(sample) {
  return evaluateLayout({kind:'visibleFraction',sample:'retry-button',a:SOURCE_RETRY,
    basis:'rectangular',includeKeyboard:true,expected:{minFraction:1,enabled:true},
    acceptedSources:['native-tree','window-metrics']}, {'retry-button':sample});
}

function sourceRecoveryNodes(sample) {
  return sample.nodes.filter(node => node.visible === true &&
    [SOURCE_LOAD_ERROR,SOURCE_REQUIRED,SOURCE_RETRY].includes(node.id));
}

function sourceRecoveryMatches(nodes, marker) {
  const surface = nodes.find(node => node.id === marker);
  const button = nodes.find(node => node.id === SOURCE_RETRY);
  return nodes.length === 2 && surface && button && button.path.startsWith(`${surface.path}/`);
}

function phaseSourceLoadRetry(evidence, assertion) {
  const expected = assertion.expected;
  const baseline = evidence.sample(assertion.baseline);
  const prior = phaseProjection(evidence, {sample:assertion.baseline,
    expected:{mode:'input',projections:['sourceLoadError'],searchActive:false}});
  if (prior.verdict !== 'PASS') return output(prior.actual, expected, false, prior.reason, prior.observationsComplete);
  requireEvidence(baseline.captureComplete === true, 'No complete native sample of the failed source-list opening');
  evidence.node(baseline, EDITOR, [BAR, FIELD]);
  evidence.node(baseline, SEARCH_BACK, [BAR]);
  const baselineRecovery = sourceRecoveryNodes(baseline);
  if (!sourceRecoveryMatches(baselineRecovery,SOURCE_LOAD_ERROR)) {
    return output({nativeRecovery:baselineRecovery.map(node => node.id)}, expected, false,
      'The failed source-list opening has no unique native recovery button under its actual error surface', false);
  }
  const button = evidence.node(baseline, SOURCE_RETRY, [SOURCE_LOAD_ERROR]);
  const visibility = searchSourceRetryVisibility(baseline);
  requireEvidence(visibility.verdict !== 'NOT_RUN' && typeof button.clickable === 'boolean',
    'The source-list recovery button has no verified native hit area');
  if (visibility.verdict === 'FAIL' || button.clickable !== true) {
    return output({visibility:visibility.actual,clickable:button.clickable}, expected, false,
      'The source-list recovery button could not be tapped clear of the IME', false);
  }
  const action = evidence.action(assertion.action, 'click', SOURCE_RETRY);
  requireEvidence(action.from === assertion.baseline && baseline.instanceId === action.instanceId &&
    baseline.afterSeq <= action.beforeSeq && baseline.hostEndMs <= action.hostBeginMs,
  'The recovery tap has no current failed source-list sample');
  const scoped = ['owner','page','queryRevision'];
  const events = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq,
    ['search-page-action','search-source-list-retry','search-submit-accepted'], 'business');
  const intents = events.filter(event => event.kind === 'search-page-action' && event.payload.action === 'retry-source-load');
  const starts = events.filter(event => event.kind === 'search-source-list-retry' && event.payload.phase === 'started');
  const wrongAction = events.some(event => event.kind === 'search-submit-accepted' ||
    event.kind === 'search-page-action' && event.payload.action === 'retry');
  if (wrongAction || intents.length > 1 || starts.length > 1) {
    return output({intents:intents.length,starts:starts.length,wrongAction}, expected, false,
      'The native tap dispatched another search action or more than one source read', false);
  }
  const [intent] = intents, [start] = starts;
  requireEvidence(intent && start && sequence(start.payload.session) && start.payload.session > 0 &&
    sequence(start.payload.attempt) && start.payload.attempt > 0 && sequence(start.payload.publicationRevision),
  'The recovery tap has no unique intent and started source.list transaction');
  const p = start.payload, owner = prior.actual;
  if (intent.eventSeq >= start.eventSeq || !matchesFields(p, owner, scoped) ||
      !matchesFields(intent.payload, owner, scoped)) {
    return output({owner:p.owner,page:p.page,queryRevision:p.queryRevision}, expected, false,
      'The source-list retry started on another owner or outside the native recovery intent', false);
  }
  const sample = evidence.sample(assertion.sample);
  requireEvidence(sample.captureComplete === true && follows(sample, action),
    'The retry has no complete native result in the same app session');
  const timeline = evidence.bounded(action.instanceId, start.eventSeq, sample.beforeSeq,
    ['search-source-list-retry',PROJECTION,'search-route-released','search-page-owner-released','search-submit-accepted'], 'business');
  if (expected.exclusiveRead === true) {
    const repeated = timeline.filter(event => event.kind === 'search-source-list-retry' && event.payload.phase === 'started');
    if (repeated.length) return output({startedSeq:start.eventSeq,additionalStarts:repeated.map(event => event.eventSeq)},
      expected,false,'The same recovery interval started another source.list read',false);
  }
  const retired = timeline.some(event => event.kind === 'search-route-released' ||
    event.kind === 'search-submit-accepted' ||
    event.kind === 'search-page-owner-released' && event.payload.owner === p.owner);
  const settled = timeline.filter(event => event.kind === 'search-source-list-retry' && event.payload.phase === 'settled');
  const match = settled.filter(event => matchesFields(event.payload, p, [...scoped,'session','attempt']));
  if (retired || settled.length > 1 || settled.length === 1 && match.length === 0) {
    return output({retired,settled:settled.length,matched:match.length}, expected, false,
      'The retry did not complete uniquely on the original Search entry and transaction', false);
  }
  const [finish] = match;
  requireEvidence(finish && sequence(finish.payload.publicationRevision) &&
    finish.payload.publicationRevision > p.publicationRevision, 'Missing a newly published source-list retry outcome');
  const projection = LAST(timeline.filter(event => event.kind === PROJECTION && event.payload.owner === p.owner));
  requireEvidence(projection && sequence(projection.payload.publicationRevision) &&
    projection.payload.publicationRevision >= finish.payload.publicationRevision &&
    typeof projection.payload.searchActive === 'boolean', 'No native Search projection for the fresh result');
  const { outcome, sourceCount } = finish.payload;
  const next = projection.payload;
  const keyboardBefore = evidence.keyboard(baseline).visible, keyboardAfter = evidence.keyboard(sample).visible;
  const present = sourceRecoveryNodes(sample);
  const actual = {outcome,sourceCount:sourceCount ?? null,owner:p.owner,page:p.page,queryRevision:p.queryRevision,
    session:p.session,attempt:p.attempt,startedSeq:start.eventSeq,settledSeq:finish.eventSeq,
    projection:next.projection,sourceRequiredReason:next.sourceRequiredReason ?? null,
    publicationRevision:next.publicationRevision,keyboardBefore,keyboardAfter,
    nativeRecovery:present.map(node => node.id),
  };
  const bound = matchesFields(next, p, scoped) && next.searchActive === false;
  const editor = evidence.node(sample, EDITOR, [BAR, FIELD]);
  const back = evidence.node(sample, SEARCH_BACK, [BAR]);
  requireEvidence(typeof editor.enabled === 'boolean' && typeof back.enabled === 'boolean',
    'The retained Search input and Back control have no native enabled state');
  const ready = outcome === 'ready' && sequence(sourceCount) && sourceCount > 0 && next.projection === 'initial' && !present.length;
  const failed = outcome === 'failed' && sourceCount === undefined && next.projection === 'sourceLoadError';
  const unavailable = next.projection === 'sourceRequired' && next.sourceRequiredReason === outcome &&
    (outcome === 'noSources' && sourceCount === 0 || outcome === 'allDisabled' && sequence(sourceCount) && sourceCount > 0);
  const recovery = (failed || unavailable) && sourceRecoveryMatches(present,failed ? SOURCE_LOAD_ERROR : SOURCE_REQUIRED) &&
    present.some(node => node.id === SOURCE_RETRY && node.enabled === true && node.clickable === true);
  if (expected.exclusiveRead === true && recovery) {
    const visibility = searchSourceRetryVisibility(sample);
    requireEvidence(visibility.verdict !== 'NOT_RUN', 'The new recovery action has no verified native hit area');
    actual.recoveryVisibility = visibility.actual;
    if (visibility.verdict === 'FAIL') {
      return output(actual,expected,false,'The settled native recovery action could not be tapped clear of the IME');
    }
  }
  return output(actual, expected, bound && editor.enabled && back.enabled && (ready || recovery),
    'The same Search input, Back or native recovery surface does not match the actual fresh source-list result');
}

function phaseRelative(evidence, assertion) {
  const { action, commit } = association(evidence, assertion.action, 'button');
  const entry = evidence.open();
  const pre = evidence.sample(assertion.baseline), post = evidence.sample(assertion.sample);
  requireEvidence(commit && commit.instanceId === entry.accepted.instanceId && matchesFields(commit.payload, entry.accepted.payload, SCOPE) &&
    follows(pre, entry.action) && follows(post, action), 'The native windows do not follow the same accepted bookshelf search');
  const continuityId = entry.action.actionId;
  const pair = { [assertion.baseline]: {...pre, continuityId}, [assertion.sample]: {...post, continuityId} };
  return evaluateLayout({ ...assertion, kind: 'relativeDelta', sameContinuity: true, acceptedSources: ['native-tree', 'window-metrics'] }, pair);
}

function detailVisibleNodes(sample, nodes, requireVisibleContent) {
  if (!requireVisibleContent) return {visible:nodes.filter(node => node.visible === true),uncertain:false};
  const visible = [];
  let uncertain = false;
  for (const node of nodes) {
    const appearance = effectiveAppearance(sample,node);
    if (appearance.visible === true) visible.push(node);
    if (appearance.visible === null) uncertain = true;
  }
  return {visible,uncertain};
}

function detailNativeList(sample, anchor, requireVisibleContent) {
  const viewportId = `reader-search-result-list:${anchor.page}:${anchor.queryRevision}`;
  const viewports = detailVisibleNodes(sample,
    sample.nodes.filter(node => node.id?.startsWith('reader-search-result-list:')),requireVisibleContent);
  const rows = detailVisibleNodes(sample,sample.nodes.filter(node => node.alias === PUBLIC_RESULT),requireVisibleContent);
  const [list] = viewports.visible;
  const viewport = viewports.visible.length === 1 && list.id === viewportId ? list : undefined;
  const [publicRow] = rows.visible;
  const row = viewport && rows.visible.length === 1 && ancestorsOf(sample,publicRow).includes(viewport) ? publicRow : undefined;
  const visibleConflict = viewports.visible.some(node => node.id !== viewportId) ||
    viewports.visible.length > 1 || rows.visible.length > 1 || Boolean(viewport && publicRow && !row);
  return {viewportId,observedViewportIds:viewports.visible.map(node => node.id),viewport,row,
    uncertain:viewports.uncertain || rows.uncertain,visibleConflict};
}

function phaseDetailNative(evidence, expected, actual, capture, route, anchors, commit) {
  const { selected, returned, detail, restored, detailBox, scrollAction } = capture;
  const { opened, closed } = route;
  const [a,b] = anchors.map(event => event.payload);
  const original = evidence.sample(selected.from);
  requireEvidence([original,detail,restored].every(sample => sample.captureComplete === true) &&
    original.instanceId === selected.instanceId && original.afterSeq <= selected.beforeSeq &&
    original.hostEndMs <= selected.hostBeginMs && detail.hostEndMs <= returned.hostBeginMs &&
    commit.instanceId === selected.instanceId && commit.eventSeq <= original.beforeSeq && sequence(a.page) && sequence(b.page),
  'Detail return needs the complete original list, detail and restored list samples on the same query');
  const inbound = opened.payload, outbound = closed.payload;
  const release = evidence.bounded(selected.instanceId, opened.eventSeq, detail.beforeSeq,
    ['search-page-owner-released'], 'business').filter(event => event.payload.owner === a.owner);
  if (release.length > 1 || release.some(event => event.payload.released === false ||
      !matchesFields(event.payload,a,['page','queryRevision']))) {
    return output(actual,expected,false,'Detail did not uniquely retire the selected result owner');
  }
  requireEvidence(release.length === 1 && release[0].payload.released === true, 'No retirement proof for the selected result owner');
  const prior = LAST(evidence.bounded(selected.instanceId, commit.eventSeq, original.beforeSeq, [PROJECTION], 'business'));
  const next = LAST(evidence.bounded(returned.instanceId, closed.eventSeq, restored.beforeSeq, [PROJECTION], 'business'));
  requireEvidence(prior && next && validLease(commit.payload.writeLease), 'No original and restored boundary of the submitted result list');
  const requireVisibleContent = expected.requireVisibleContent === true;
  const before = detailNativeList(original,a,requireVisibleContent), after = detailNativeList(restored,b,requireVisibleContent);
  const operation = expected.terminalOperation ?? 'cancelled';
  const ownsList = (event, anchor, list) => matchesFields(event.payload,anchor,['owner','page','queryRevision']) &&
    event.payload.viewportId === list.viewportId && event.payload.projection === 'results' &&
    event.payload.searchActive === false && event.payload.stopped === (operation === 'cancelled') && event.payload.operation === operation &&
    event.payload.operationGeneration === commit.payload.writeLease.generation;
  const details = detailVisibleNodes(detail,detail.nodes.filter(node => node.fixtureTitle === true &&
    node.source === 'native-tree' && ancestorsOf(detail,node).includes(detailBox)),requireVisibleContent);
  const current = { ...actual, releasedSeq:release[0].eventSeq, publicationSeqs:[prior.eventSeq,next.eventSeq],
    viewportIds:[before.observedViewportIds,after.observedViewportIds] };
  if (!matchesFields(inbound,commit.payload,SCOPE) || inbound.previousNavigation !== commit.payload.navigation ||
      inbound.navigation <= inbound.previousNavigation || outbound.navigation <= inbound.navigation || b.page === a.page ||
      anchors[0].eventSeq >= opened.eventSeq || closed.eventSeq >= anchors[1].eventSeq ||
      !ownsList(prior,a,before) || !ownsList(next,b,after) || before.visibleConflict || after.visibleConflict ||
      (!before.uncertain && !before.row) || (!after.uncertain && !after.row) ||
      details.visible.length > 1 || (!details.uncertain && details.visible.length !== 1)) {
    return output(current,expected,false,'Detail or return did not show the public book in its exact current native owner');
  }
  requireEvidence(!before.uncertain && !after.uncertain && !details.uncertain,
    'The native list, result or detail title has unavailable effective visibility');
  const row = publicSearchResultContinuity(before.row,after.row);
  requireEvidence(row, 'The visible public rows do not carry native item ownership');
  requireEvidence(original.window?.source === 'window-metrics' && restored.window?.source === 'window-metrics' &&
    Number.isFinite(original.window.density) && original.window.density > 0 &&
    matchesFields(original.window,restored.window,['id','density','orientation']) &&
    original.window.rectPx && restored.window.rectPx &&
    matchesFields(original.window.rectPx,restored.window.rectPx,['width','height']) &&
    [before.row,after.row,before.viewport,after.viewport].every(node =>
      node.source === 'native-tree' && placed(node.visibleRectPx) && Number.isFinite(node.rectPx?.top)),
  'The original and restored public rows lack comparable native geometry');
  const rowY = (list,window) => (list.row.rectPx.top - list.viewport.rectPx.top) / window.density;
  const nativeItemY = [rowY(before,original.window),rowY(after,restored.window)];
  const nativeDeltaY = Math.abs(nativeItemY[1] - nativeItemY[0]);
  const sameRow = row.sameBook && row.beforePage === a.page && row.afterPage === b.page &&
    row.beforeQuery === a.queryRevision && row.afterQuery === b.queryRevision;
  let offStart;
  if (expected.minimumAnchorIndex !== undefined) {
    const swipe = evidence.action(scrollAction,'swipe',SEARCH_RESULT_VIEWPORT);
    const unscrolled = evidence.sample(swipe.from);
    requireEvidence(unscrolled.captureComplete === true && unscrolled.instanceId === swipe.instanceId &&
      unscrolled.afterSeq <= swipe.beforeSeq && unscrolled.hostEndMs <= swipe.hostBeginMs && follows(original,swipe),
    'No complete source and settled sample for the native list swipe');
    const viewport = evidence.node(unscrolled,SEARCH_RESULT_VIEWPORT);
    const settled = LAST(evidence.bounded(swipe.instanceId,swipe.beforeSeq,original.beforeSeq,['search-page-anchor'],'business')
      .filter(event => event.payload.action === 'user-scroll-settled'));
    requireEvidence(settled && sequence(settled.payload.anchorIndex) &&
      Number.isFinite(settled.payload.anchorOffset) && typeof settled.payload.anchorAtStart === 'boolean',
    'No live scroll settlement before opening the selected row');
    const position = settled.payload;
    const initialRows = detailVisibleNodes(unscrolled,unscrolled.nodes.filter(node => node.alias === PUBLIC_RESULT),
      requireVisibleContent);
    offStart = {settledSeq:settled.eventSeq,index:position.anchorIndex,offsetVp:position.anchorOffset,
      initialViewport:viewport.id,tailVisibleInitially:initialRows.visible.length > 0};
    if (viewport.id !== before.viewportId || offStart.tailVisibleInitially ||
        !matchesFields(position,a,['owner','page','queryRevision']) ||
        position.anchorAtStart || position.anchorIndex < expected.minimumAnchorIndex || position.anchorOffset <= 0 ||
        a.anchorAtStart || b.anchorAtStart || a.anchorIndex < expected.minimumAnchorIndex || b.anchorIndex < expected.minimumAnchorIndex) {
      return output({...current,offStart},expected,false,'The selected row was not opened and restored from a measured off-start list anchor');
    }
    requireEvidence(!initialRows.uncertain, 'The pre-scroll tail row has unavailable effective visibility');
  }
  return output({...current,row,nativeItemY,nativeDeltaY,
    ...(offStart ? {offStart} : {}),
    originalResultPath:before.row.path,publicResultPath:after.row.path},expected,
    sameRow && nativeDeltaY <= expected.anchorToleranceVp,
    'The restored native row changed identity or position relative to the retained result viewport');
}

function phaseDetail(evidence, assertion) {
  const selected = evidence.action(assertion.action, 'click', PUBLIC_RESULT);
  const returned = evidence.action(assertion.returnAction, 'keyEvent', undefined);
  const detail = evidence.sample(assertion.baseline), restored = evidence.sample(assertion.sample);
  const { commit } = association(evidence, assertion.priorAction, 'button');
  requireEvidence(commit && returned.key === 'Back' && selected.instanceId === returned.instanceId &&
    follows(detail, selected) && follows(restored, returned) && returned.beforeSeq >= detail.afterSeq, 'Detail action and return do not bracket native endpoints');
  const openings = evidence.bounded(selected.instanceId, selected.beforeSeq, selected.afterSeq, ['search-detail-accepted'], 'business');
  const closings = evidence.bounded(returned.instanceId, returned.beforeSeq, returned.afterSeq, ['search-detail-returned'], 'business');
  const selections = evidence.bounded(selected.instanceId, selected.beforeSeq, selected.afterSeq, ['search-page-anchor'], 'business')
    .filter(event => event.payload.action === 'detail-selection');
  const restorations = evidence.bounded(returned.instanceId, returned.beforeSeq, restored.beforeSeq, ['search-page-anchor'], 'business')
    .filter(event => event.payload.action === 'anchor-restored');
  const expected = assertion.expected;
  if (expected.verifyNativeList === true && [openings,closings,selections].some(events => events.length > 1)) {
    return output({openingCount:openings.length,closingCount:closings.length,
      selectionCount:selections.length,restorationCount:restorations.length},expected,false,
    'A native action produced multiple detail opens, closes or anchor commits');
  }
  const open = LAST(openings), close = LAST(closings), anchor = LAST(selections), rest = LAST(restorations);
  requireEvidence(open && close && anchor && rest && candidateIdentity(open.payload) && candidateIdentity(close.payload) &&
    [anchor, rest].every(event => sequence(event.payload.owner) && sequence(event.payload.anchorIndex) &&
      Number.isFinite(event.payload.anchorOffset) && Number.isFinite(event.payload.anchorItemY) && typeof event.payload.anchorAtStart === 'boolean'),
  'The owning search journey has no detail/return and scroll restoration facts');
  const a = anchor.payload, b = rest.payload, inbound = open.payload, outbound = close.payload;
  const detailBox = evidence.node(detail, 'reader-book-detail-verification');
  const retained = a.queryRevision === commit.payload.queryRevision && [b, inbound, outbound].every(p => p.queryRevision === a.queryRevision);
  const anchorKept = a.anchorAtStart ? b.anchorAtStart : b.anchorMatchesRestore && b.anchorIndex === a.anchorIndex &&
    Math.abs(b.anchorItemY - a.anchorItemY) <= expected.anchorToleranceVp;
  const valid = retained && matchesFields(inbound, outbound, SCOPE) &&
    inbound.route === 'detail' && outbound.route === 'search' && outbound.navigation > inbound.navigation &&
    inbound.previousOwner === a.owner && b.owner !== a.owner && anchorKept;
  const actual = { queryRevision: a.queryRevision, returnedQueryRevision: b.queryRevision, navigation: [inbound.navigation, outbound.navigation],
    owner: [a.owner, b.owner], anchorKept, anchorIndex: [a.anchorIndex, b.anchorIndex], anchorItemY: [a.anchorItemY, b.anchorItemY],
    detailPath: detailBox.path };
  if (expected.verifyNativeList === true && valid) {
    return phaseDetailNative(evidence,expected,actual,{selected,returned,detail,restored,detailBox,scrollAction:assertion.scrollAction},
      {opened:open,closed:close},[anchor,rest],commit);
  }
  const publicResultPath = expected.verifyNativeList === true ? undefined : evidence.node(restored,PUBLIC_RESULT).path;
  return output({...actual,...(publicResultPath === undefined ? {} : {publicResultPath})},expected,valid,
    'Detail return did not restore the same query, native result and scroll anchor');
}

function phasePanel(evidence, assertion) {
  if (assertion.expected.nativeReturn === true) return phasePanelNativeReturn(evidence, assertion);
  const expected = assertion.expected;
  const open = evidence.action(assertion.action, 'click', `reader-search-${expected.panel}-trigger`);
  const back = evidence.action(assertion.returnAction, 'keyEvent', undefined);
  const restored = evidence.sample(assertion.sample);
  requireEvidence(open.instanceId === back.instanceId && open.afterSeq <= back.beforeSeq && back.key === 'Back' && follows(restored, back),
    'The temporary panel and Back do not belong to the restored search instance');
  const panels = evidence.bounded(back.instanceId, open.beforeSeq, restored.beforeSeq, ['search-page-action'], 'business');
  const acquired = panels.find(event => event.eventSeq <= back.beforeSeq && event.payload.action === 'panel-open');
  const dismissed = panels.find(event => event.eventSeq > back.beforeSeq && event.payload.action === 'panel-dismiss');
  const consumed = evidence.bounded(back.instanceId, back.beforeSeq, restored.beforeSeq,
    ['search-back-consumed', 'search-route-released'], 'business');
  requireEvidence(acquired && dismissed, 'The native panel acquisition and release are missing');
  const trigger = evidence.node(restored, `reader-search-${expected.panel}-trigger`);
  const actual = { panel: acquired.payload.panel, releasedPanel: dismissed.payload.panel, owner: acquired.payload.owner,
    queryRevision: acquired.payload.queryRevision, returnedQueryRevision: dismissed.payload.queryRevision,
    consumers: consumed.map(event => event.payload.consumer ?? event.payload.route), triggerPath: trigger.path };
  return output(actual, expected, actual.panel === expected.panel && actual.releasedPanel === expected.panel &&
    matchesFields(acquired.payload, dismissed.payload, ['owner', 'queryRevision', 'page']) &&
    consumed.every(event => event.kind === 'search-back-consumed' && event.payload.consumer === 'temporary'),
  'Back consumed search navigation instead of releasing the current temporary panel');
}

function phasePanelNativeReturn(evidence, assertion) {
  const expected = assertion.expected;
  const triggerId = `reader-search-${expected.panel}-trigger`;
  const open = evidence.action(assertion.action, 'click', triggerId);
  const back = evidence.action(assertion.returnAction, 'keyEvent', undefined);
  const baseline = evidence.sample(assertion.baseline);
  const opened = evidence.sample(back.from);
  requireEvidence(back.key === 'Back' && open.from === assertion.baseline &&
    baseline.instanceId === open.instanceId && baseline.afterSeq <= open.beforeSeq && baseline.hostEndMs <= open.hostBeginMs &&
    follows(opened, open) && opened.instanceId === back.instanceId && opened.afterSeq <= back.beforeSeq &&
    opened.hostEndMs <= back.hostBeginMs,
  'No ordered same-session results opening and native sheet Back actions');
  const restored = evidence.samples[assertion.sample] ? evidence.sample(assertion.sample) : null;
  const returnFollows = restored !== null && follows(restored, back);
  const nativeComplete = returnFollows && [baseline, opened, restored].every(sample =>
    sample.captureComplete === true && sample.window?.id === baseline.window?.id);
  const events = evidence.bounded(open.instanceId, 0, returnFollows ? restored.beforeSeq : back.afterSeq,
    [PROJECTION,'search-page-action','search-back-consumed','search-route-released','search-page-owner-released',ACCEPTED], 'business');
  const during = events.filter(event => event.eventSeq > baseline.beforeSeq);
  const actions = during.filter(event => event.kind === 'search-page-action');
  const openings = actions.filter(event => event.payload.action === 'panel-open');
  const closings = actions.filter(event => event.payload.action === 'panel-dismiss');
  const retries = actions.filter(event => event.payload.action === 'retry');
  const consumers = during.filter(event => event.kind === 'search-back-consumed');
  const actual = {
    panel: expected.panel, openSeqs: openings.map(event => event.eventSeq), closeSeqs: closings.map(event => event.eventSeq),
    retrySeqs: retries.map(event => event.eventSeq), consumers: consumers.map(event => event.payload.consumer),
  };
  const inside = (event, action) => event.eventSeq > action.beforeSeq && event.eventSeq <= action.afterSeq;
  const crossed = during.some(event => ['search-route-released','search-page-owner-released',ACCEPTED].includes(event.kind));
  if (crossed || openings.length > 1 || closings.length > 1 ||
      openings.some(event => !inside(event, open) || event.payload.panel !== expected.panel) ||
      closings.some(event => !inside(event, back) || event.payload.panel !== expected.panel) ||
      consumers.length > 1 || consumers.some(event => !inside(event, back) || event.payload.consumer !== 'temporary')) {
    return output(actual, expected, false, 'The requested sheet was replaced, or its opening or close crossed the native action interval',
      nativeComplete);
  }
  requireEvidence(nativeComplete, 'No complete same-window baseline, native sheet Back source, or restored results sample');
  requireEvidence(openings.length === 1 && closings.length === 1, 'No unique native sheet acquire and dismiss receipts');
  const [acquired] = openings, [dismissed] = closings;
  const projections = events.filter(event => event.kind === PROJECTION);
  const projectionAt = sample => LAST(projections.filter(event => event.eventSeq <= sample.beforeSeq));
  const points = [baseline, opened, restored].map(projectionAt);
  const [before, backSource, after] = points.map(event => event?.payload);
  const resultScope = ['owner','page','queryRevision','operationGeneration','resultCount'];
  requireEvidence([before, backSource, after, acquired.payload, dismissed.payload].every(fact =>
    fact && resultScope.every(key => sequence(fact[key]))) &&
    [before, backSource, after].every(fact => typeof fact.viewportId === 'string' && typeof fact.operation === 'string' &&
      typeof fact.projection === 'string' && typeof fact.searchActive === 'boolean' && sequence(fact.publicationRevision)),
  'Current result projections or native panel edges lack scoped owner, list or work facts');
  const viewport = `reader-search-result-list:${before.page}:${before.queryRevision}`;
  const samePage = ['owner','page','queryRevision'];
  const workStable = [...resultScope,'publicationRevision','operation','projection','searchActive','viewportId'];
  const interveningProjections = during.filter(event => event.kind === PROJECTION);
  const owned = matchesFields(before, acquired.payload, resultScope) &&
    matchesFields(backSource, dismissed.payload, resultScope) &&
    matchesFields(before, backSource, samePage) && matchesFields(backSource, after, workStable) &&
    interveningProjections.every(event => matchesFields(before,event.payload,samePage)) &&
    consumers.every(event => matchesFields(backSource, event.payload, ['owner','queryRevision']));
  const settled = [before, backSource, after].every(fact =>
    fact.projection === 'results' && fact.searchActive === false && fact.resultCount > 0 && fact.viewportId === viewport);
  if (!owned || !settled) {
    return output(actual, expected, false, 'The current result owner, list, or settled state changed across the sheet interaction');
  }
  if (assertion.retryAction) {
    const retry = evidence.action(assertion.retryAction, 'click', 'reader-search-task-retry');
    requireEvidence(retry.instanceId === open.instanceId && open.afterSeq <= retry.beforeSeq && open.hostEndMs <= retry.hostBeginMs &&
      follows(opened, retry) && retries.length > 0, 'The reopened work has no matching native retry and Back source');
    if (retries.length !== 1 || !inside(retries[0], retry) || !matchesFields(before,retries[0].payload,resultScope) ||
        backSource.operationGeneration !== before.operationGeneration + 1 || backSource.resultCount < before.resultCount) {
      return output(actual, expected, false, 'Task retry crossed the retained sheet, work generation or public result');
    }
  } else if (retries.length || interveningProjections.some(event => !matchesFields(before,event.payload,workStable))) {
    return output(actual, expected, false, 'Unrelated work changed the results during the sheet interaction');
  }
  const sheetTitle = expected.panel === 'filter' ? '筛选' : '搜索进度';
  const sheets = sample => sample.nodes.filter(node => (node.type === 'SheetPage' || isReaderSearchBottomSheet(node)) &&
    node.visible === true && placed(node.visibleRectPx));
  const mountedSheets = sheets(opened);
  const endpointSheets = [...sheets(baseline),...sheets(restored)];
  if (endpointSheets.length || mountedSheets.length > 1 ||
      mountedSheets.some(node => (node.sheetTitle !== undefined && node.sheetTitle !== sheetTitle) ||
        (expected.sheetHost === undefined ? node.type !== 'SheetPage' : !isReaderSearchBottomSheet(node, expected.panel))) ||
      [baseline, opened, restored].some(sample => evidence.keyboard(sample).visible)) {
    return output(actual, expected, false, 'The native Back source shows a wrong sheet, or the results endpoint is still covered');
  }
  const sheet = mountedSheets[0];
  requireEvidence(sheet?.sheetTitle === sheetTitle, 'No identified visible native sheet at the Back source');
  evidence.source(sheet.source, 'The mounted sheet uses unapproved evidence');
  const endpoints = [baseline, restored].map(sample => detailNativeList(sample,before));
  if (endpoints.some(endpoint => endpoint.observedViewportIds.length && !endpoint.viewport)) {
    return output({...actual,viewportIds:endpoints.map(endpoint => endpoint.observedViewportIds)},expected,false,
      'A native endpoint displays a different or ambiguous result list');
  }
  const rows = [baseline, restored].map(sample => evidence.node(sample, PUBLIC_RESULT, [viewport]));
  const trigger = [baseline, restored].map(sample => evidence.node(sample, triggerId));
  const row = publicSearchResultContinuity(...rows);
  requireEvidence(row && endpoints.every(endpoint => endpoint.viewport?.type === 'List'),
    'The native result list or opaque public book identity is unobserved');
  const scopedTriggerId = `reader-search-${expected.panel}:${before.page}:${before.queryRevision}`;
  const valid = row.sameBook && row.beforePage === before.page && row.afterPage === before.page &&
    row.beforeQuery === before.queryRevision && row.afterQuery === before.queryRevision &&
    trigger.every(node => node.id === scopedTriggerId && node.enabled === true && node.clickable === true);
  return output({...actual,owner:before.owner,page:before.page,queryRevision:before.queryRevision,
    workGenerations:[before.operationGeneration,after.operationGeneration],counts:[before.resultCount,after.resultCount],
    projectionSeqs:points.map(event => event.eventSeq),sheetPath:sheet.path,
    viewportPaths:endpoints.map(endpoint => endpoint.viewport.path),publicResultPaths:rows.map(node => node.path),row},
  expected,valid,'The prior public result or the scoped trigger was not kept after returning from the native sheet');
}

function phaseTaskRetry(evidence, assertion) {
  const expected = assertion.expected;
  const recoveredRole = expected.recoveredResult;
  const retry = evidence.action(assertion.action, 'click', 'reader-search-task-retry');
  const open = evidence.action(assertion.openAction, 'click', 'reader-search-task-trigger');
  const { action: submit, commits, intents, commit } = association(evidence, assertion.priorAction, 'button');
  const before = evidence.sample(assertion.baseline);
  const sheet = evidence.sample(retry.from);
  const checkRetention = expected.requireRetainedWhileRefreshing === true;
  const after = checkRetention && !evidence.samples[assertion.sample] ? null : evidence.sample(assertion.sample);
  requireEvidence(commits.length === 1 && intents.length === 1 && validLease(commit.payload.writeLease) && follows(before, submit) &&
    before.instanceId === open.instanceId && before.afterSeq <= open.beforeSeq && before.hostEndMs <= open.hostBeginMs &&
    follows(sheet, open) && sheet.instanceId === retry.instanceId && sheet.afterSeq <= retry.beforeSeq &&
    sheet.hostEndMs <= retry.hostBeginMs && (after ? follows(after, retry) : checkRetention),
  'Task retry has no same-session original result, opened sheet, action and result endpoint');
  const retryNode = evidence.node(sheet, 'reader-search-task-retry');
  requireEvidence(retryNode.enabled === true && retryNode.clickable === true, 'The Task sheet has no enabled native retry action');
  const pageEvents = evidence.bounded(retry.instanceId, open.beforeSeq, retry.afterSeq, ['search-page-action'], 'business');
  const openings = pageEvents.filter(event => event.eventSeq <= open.afterSeq &&
    event.payload.action === 'panel-open' && event.payload.panel === 'task');
  const admissions = pageEvents.filter(event => event.eventSeq > retry.beforeSeq && event.payload.action === 'retry');
  if (admissions.length > 1) return output({accepted:admissions.length}, expected, false, 'Task retry was admitted more than once');
  requireEvidence(openings.length === 1 && admissions.length === 1, 'No unique Task acquisition and retry admission');

  const priorPublication = LAST(evidence.bounded(retry.instanceId, commit.eventSeq, before.beforeSeq, [PROJECTION], 'business'));
  const prior = priorPublication?.payload;
  const actionFact = admissions[0].payload;
  const events = evidence.bounded(retry.instanceId, admissions[0].eventSeq, after?.beforeSeq ?? retry.afterSeq,
    [PROJECTION, ACCEPTED], 'business');
  const publications = events.filter(event => event.kind === PROJECTION);
  const projections = publications.map(event => event.payload);
  const refreshing = projections.find(item => item.operation === 'refreshing' && item.searchActive === true);
  const endpoint = LAST(projections);
  const scope = ['owner', 'page', 'queryRevision'];
  const generation = commit.payload.writeLease.generation;
  if (checkRetention && prior?.projection === 'results' && sequence(prior.resultCount) && prior.resultCount > 0 &&
      scope.every(key => sequence(prior[key])) && prior.queryRevision === commit.payload.queryRevision &&
      prior.operationGeneration === generation &&
      matchesFields(actionFact,prior,[...scope,'operationGeneration','resultCount'])) {
    const lost = publications.find(({payload}) => matchesFields(payload,prior,scope) &&
      payload.operationGeneration === generation + 1 &&
      ((typeof payload.projection === 'string' && payload.projection !== 'results') ||
       (sequence(payload.resultCount) && payload.resultCount < prior.resultCount)));
    if (lost) return output({queryRevision:prior.queryRevision,operationGeneration:lost.payload.operationGeneration,
      projectionSeq:lost.eventSeq,beforeResults:prior.resultCount,publishedResults:lost.payload.resultCount ?? null,
      projection:lost.payload.projection ?? null},expected,false,
    'The accepted retry dropped retained results before it settled',after?.captureComplete === true);
    if (!after && recoveredRole !== undefined) {
      const observed = verifiedTaskRecovery(evidence,{instanceId:retry.instanceId,session:commit.payload.writeLease.session,
        generation:generation+1,queryRevision:prior.queryRevision,owner:prior.owner,page:prior.page,
        start:admissions[0].eventSeq,end:retry.afterSeq});
      if (!observed.valid && observed.observationsComplete !== false) {
        return output({queryRevision:prior.queryRevision,retriedOnlineAttempt:observed.facts},expected,false,observed.reason,false);
      }
    }
  }
  requireEvidence(after && (!checkRetention || after.captureComplete === true),
    'The Task retry has no full final native endpoint');
  const counts = ['resultCount', 'failedCount', 'skippedCount', 'incompleteCount'];
  const flags = ['searchActive', 'stopped', 'localFailed', 'sourceListFailed'];
  requireEvidence(prior && endpoint && refreshing &&
    [prior, endpoint].every(fact => counts.every(key => sequence(fact[key])) &&
      flags.every(key => typeof fact[key] === 'boolean')) &&
    [prior, actionFact, refreshing, endpoint, openings[0].payload].every(fact =>
      [...scope, 'operationGeneration'].every(key => sequence(fact[key]))) &&
    typeof prior.viewportId === 'string' && typeof endpoint.viewportId === 'string',
  'The original terminal, active refresh, or second terminal is missing scoped operation facts');

  const queryRevision = commit.payload.queryRevision;
  const viewport = `reader-search-result-list:${prior.page}:${queryRevision}`;
  const terminalMatches = (fact, terminal) => fact.projection === 'results' && fact.operation === terminal.operation &&
    fact.resultCount === terminal.resultCount && fact.failedCount === terminal.failedCount &&
    fact.skippedCount === 0 && fact.incompleteCount === 0 && flags.every(key => fact[key] === false);
  const sameScope = prior.queryRevision === queryRevision &&
    [openings[0].payload, actionFact, ...projections].every(fact => matchesFields(fact, prior, scope)) &&
    projections.every(fact => fact.viewportId === viewport) &&
    events.every(event => event.kind !== ACCEPTED);
  const sameGeneration = prior.operationGeneration === generation && actionFact.operationGeneration === generation &&
    openings[0].payload.operationGeneration === generation &&
    projections.every(fact => fact.operationGeneration === generation + 1);
  const actual = { queryRevision, retryRevision:actionFact.queryRevision, returnedQueryRevision:endpoint.queryRevision,
    owner:prior.owner, page:prior.page, accepted:admissions.length, generation, refreshingGeneration:refreshing.operationGeneration,
    terminalGeneration:endpoint.operationGeneration, beforeResults:prior.resultCount, afterResults:endpoint.resultCount,
    failedCount:endpoint.failedCount, skippedCount:endpoint.skippedCount, incompleteCount:endpoint.incompleteCount,
    operation:endpoint.operation, searchActive:endpoint.searchActive, nativeRetryPath:retryNode.path };
  if (!sameScope || !sameGeneration || prior.viewportId !== viewport || endpoint.viewportId !== viewport) {
    return output(actual, expected, false, 'Task retry crossed the current query, page, or work generation');
  }
  if (checkRetention) requireEvidence(projections.every(fact =>
    typeof fact.projection === 'string' && sequence(fact.resultCount)),
  'A current retry projection is missing its retained result facts');
  const beforeRow = evidence.node(before, PUBLIC_RESULT, [viewport]);
  const afterRow = evidence.node(after, PUBLIC_RESULT, [viewport]);
  let results = {...actual,publicResultPaths:[beforeRow.path,afterRow.path]};
  const checkBook = expected.requireSamePublicBook === true;
  const book = checkBook && before.captureComplete === true && after.captureComplete === true ?
    publicSearchResultContinuity(beforeRow,afterRow) : null;
  if (book) {
    results = {...results,publicResultContinuity:book};
    if (!book.sameBook || book.beforePage !== prior.page || book.afterPage !== prior.page ||
        book.beforeQuery !== queryRevision || book.afterQuery !== queryRevision) {
      return output(results,expected,false,'Task retry retained a different book or native result owner under the same public title');
    }
  }
  const initialTerminal = recoveredRole === undefined ? expected : {operation:'partial',resultCount:1,failedCount:1};
  let valid = terminalMatches(prior,initialTerminal) && terminalMatches(endpoint,expected) &&
    actionFact.resultCount === prior.resultCount && (recoveredRole === undefined || endpoint.moreSources !== true);
  let onlineRow;
  if (recoveredRole !== undefined) {
    const alias = `reader-search-public-online-result-${recoveredRole}`;
    const shown = (sample,node) =>
      node.visible === true && placed(node.visibleRectPx) && effectiveAppearance(sample,node).visible === true;
    const recognized = sample => sample.nodes.filter(node => (node.alias === alias || node.publicOnlineRoles?.includes(recoveredRole)) &&
      shown(sample,node));
    const earlier = before.captureComplete === true ? recognized(before) : [];
    const later = recognized(after);
    const inCurrentList = node => ancestorsOf(after,node).some(parent => parent.id === viewport && parent.type === 'List');
    const wrongTitle = after.nodes.find(node => node.searchResultMount?.kind === 'online' &&
      node.searchTitleObserved === true && !node.publicOnlineRoles?.includes(recoveredRole) &&
      shown(after,node) && inCurrentList(node));
    for (const row of [...earlier,...later,...(wrongTitle ? [wrongTitle] : [])]) {
      evidence.source(row.source,'The recovered online row has unapproved evidence');
    }
    results = {...results,recoveryResultPaths:later.map(node => node.path),moreSources:endpoint.moreSources ?? null};
    const contradictsCurrentRow = node => node.searchResultMount &&
      (node.searchResultMount.kind !== 'online' || node.searchResultMount.page !== prior.page ||
       node.searchResultMount.queryRevision !== queryRevision ||
       !inCurrentList(node));
    if (earlier.length || later.length > 1 || later.some(contradictsCurrentRow)) {
      return output(results,expected,false,'The native recovered online result is pre-existing, duplicated, or belongs to another query or List');
    }
    if (wrongTitle) {
      return output({...results,wrongOnlineResultPath:wrongTitle.path},expected,false,
        'The current native List shows an online book with a different title from the recovery fixture');
    }
    onlineRow = later.find(node => node.alias === alias && node.searchResultMount);
  }
  let reason = 'Task retry did not retain the public result and settle the repeated source failure';
  if (valid && expected.httpResponseStatus !== undefined) {
    const {session} = commit.payload.writeLease;
    const scope = {instanceId:retry.instanceId,session,queryRevision};
    let initial, initialGap;
    try {
      initial = verifiedSearchAttempt(evidence,{...scope,generation,trigger:'initial',
        start:commit.eventSeq,end:priorPublication.eventSeq - 1},expected.httpResponseStatus);
    } catch (error) {
      if (recoveredRole === undefined || !(error instanceof MissingSearchEvidence)) throw error;
      initialGap = error.message;
    }
    if (initial && !initial.valid) {
      return output({...results,originalOnlineAttempt:initial.facts},expected,false,initial.reason);
    }
    const retryWindow = {...scope,generation:generation + 1,trigger:'retry',
      start:admissions[0].eventSeq,end:LAST(publications).eventSeq - 1};
    const repeated = recoveredRole === undefined ? verifiedSearchAttempt(evidence,retryWindow,expected.httpResponseStatus) :
      verifiedTaskRecovery(evidence,{...retryWindow,owner:prior.owner,page:prior.page});
    results = {...results,originalOnlineAttempt:initial?.facts ?? null,retriedOnlineAttempt:repeated.facts};
    if (repeated.observationsComplete === false || repeated.valid && initialGap) {
      return appendUnobserved(results,expected,initialGap ?? repeated.reason);
    }
    valid = repeated.valid;
    reason = repeated.reason;
  }
  if (valid && checkBook && !book) {
    return appendUnobserved(results,expected,'The original and retained Task retry rows have no complete comparable native book identity');
  }
  if (valid && recoveredRole !== undefined && (!onlineRow || endpoint.moreSources !== false)) {
    return appendUnobserved(results,expected,'The current native online recovery row or exhausted results endpoint is unobserved');
  }
  return output(results,expected,valid,reason);
}

function verifiedTaskRecovery(evidence, {instanceId,start,end,generation,session,queryRevision,owner,page}) {
  const lease = {generation,session,queryRevision};
  const inLease = ({payload}) => matchesFields(payload,lease,Object.keys(lease));
  const attempts = evidence.bounded(instanceId,start,end,[ONLINE_ATTEMPT],'business').filter(inLease);
  const pages = evidence.bounded(instanceId,start,end,[CONTINUATION],'business').filter(inLease);
  const begins = attempts.filter(({payload}) => payload.stage === 'started');
  const finishes = attempts.filter(({payload}) => payload.stage === 'settled');
  const admissions = pages.filter(({payload}) => payload.stage === 'admitted');
  const settlements = pages.filter(({payload}) => payload.stage === 'settled');
  const begun = begins[0], recovered = finishes[0], admitted = admissions[0], exhausted = settlements[0];
  const facts = {startedSeq:begun?.eventSeq ?? null,settledSeq:recovered?.eventSeq ?? null,
    continuationAdmittedSeq:admitted?.eventSeq ?? null,continuationSettledSeq:exhausted?.eventSeq ?? null};
  const attempt = {trigger:'retry',sourceCount:1,sourceOrdinal:0,requestedPage:1,sameFailedSource:true};
  const next = {outcome:'completed',capability:PAGE_RECEIPT,receiptState:'next',progressState:'ready',nextPage:2,addedResultCount:1};
  const continuation = {owner,page,trigger:'viewport',capability:PAGE_RECEIPT,sourceOrdinal:0,requestedPage:2,previousPage:1};
  const terminal = {outcome:'receipt',receiptState:'end',progressState:'end',addedResultCount:0};
  const mismatch = (payload,wanted) => Object.keys(wanted).some(key => payload?.[key] != null && payload[key] !== wanted[key]);
  const order = [begun,recovered,admitted,exhausted].filter(Boolean);
  const contradictoryStatus = Number.isInteger(recovered?.payload.httpStatus) && recovered.payload.httpStatus >= 400;
  if ([begins,finishes,admissions,settlements].some(events => events.length > 1) ||
      attempts.length !== begins.length + finishes.length || pages.length !== admissions.length + settlements.length ||
      attempts.some(({payload}) => mismatch(payload,attempt)) || mismatch(recovered?.payload,next) || contradictoryStatus ||
      pages.some(({payload}) => mismatch(payload,continuation)) || mismatch(exhausted?.payload,terminal) ||
      exhausted?.payload.nextPage !== undefined || order.some((event,index) => index > 0 && event.eventSeq <= order[index-1].eventSeq)) {
    return {facts,valid:false,reason:'Task recovery contradicted the retried source, its first page, or the ordered continuation end'};
  }
  const complete = order.length === 4 && attempts.every(({payload}) => matchesFields(payload,attempt,Object.keys(attempt))) &&
    matchesFields(recovered.payload,next,Object.keys(next)) &&
    pages.every(({payload}) => matchesFields(payload,continuation,Object.keys(continuation))) &&
    matchesFields(exhausted.payload,terminal,Object.keys(terminal));
  return {facts,valid:complete,observationsComplete:complete,
    reason:complete ? '' : 'The same failed source has no complete negotiated recovery and page-two end on the retry work lease'};
}

const CONTINUATION = 'search-continuation-page';
const PAGE_RECEIPT = 'book.search.page-receipt.v1';
const ONLINE_ATTEMPT = 'search-online-attempt';

function appendUnobserved(actual, expected, reason) {
  return {...output(actual,expected,false,reason,false),verdict:'NOT_RUN'};
}

function firstPageWitness(events, accepted) {
  const {generation,session} = accepted.writeLease;
  const settlements = events.filter(({kind,payload}) => kind === ONLINE_ATTEMPT && payload.stage === 'settled' &&
    payload.trigger === 'initial' && matchesFields(payload,{generation,session,queryRevision:accepted.queryRevision},
      ['generation','session','queryRevision']));
  const first = settlements.find(({payload}) => payload.outcome === 'completed' && payload.capability === PAGE_RECEIPT &&
    payload.requestedPage === 1 && payload.receiptState === 'next' && payload.progressState === 'ready' &&
    payload.nextPage === 2 && payload.addedResultCount === 1 && payload.sourceCount === 1 && payload.sourceOrdinal === 0);
  return first && {settledSeq:first.eventSeq,requestedPage:1,nextPage:2,sourceOrdinal:0,addedResultCount:1,
    unique:settlements.length === 1};
}

function validContinuationPage(payload) {
  return sequence(payload.sourceOrdinal) && sequence(payload.requestedPage) && payload.requestedPage > 1 &&
    payload.previousPage === payload.requestedPage - 1;
}

function settleContinuationPages(events) {
  const pages = new Map();
  const lastBySource = new Map();
  let invalid = null;
  for (const {payload,eventSeq} of events) {
    const {sourceOrdinal,requestedPage,previousPage,stage,outcome,receiptState,progressState,nextPage,addedResultCount} = payload;
    const key = `${sourceOrdinal}:${requestedPage}`;
    const page = pages.get(key);
    if (!validContinuationPage(payload) || !['admitted','settled'].includes(stage) ||
      (stage === 'admitted' ? page !== undefined : !page || page.settledSeq !== undefined)) {
      invalid ??= 'The continuation page admission and settlement do not form unique adjacent pairs';
      continue;
    }
    if (stage === 'admitted') {
      const previous = lastBySource.get(sourceOrdinal);
      if (previous && (previous.receiptState !== 'next' || previous.nextPage !== requestedPage)) {
        invalid ??= 'A subsequent source page did not follow its prior accepted next receipt';
      }
      const admitted = {sourceOrdinal,previousPage,requestedPage,admittedSeq:eventSeq};
      pages.set(key,admitted);
      lastBySource.set(sourceOrdinal,admitted);
      continue;
    }
    Object.assign(page,{
      settledSeq:eventSeq,
      outcome:['receipt','failed','missing-receipt'].includes(outcome) ? outcome : null,
      receiptState:['next','end','unknown'].includes(receiptState) ? receiptState : null,
      progressState:['ready','end','unknown','satisfied'].includes(progressState) ? progressState : null,
      nextPage:sequence(nextPage) ? nextPage : null,
      addedResultCount:sequence(addedResultCount) ? addedResultCount : null,
    });
    const progressed = receiptState === 'next' && progressState === 'ready' && nextPage === requestedPage + 1;
    const ended = receiptState === 'end' && progressState === 'end' && nextPage === undefined;
    if (outcome !== 'receipt' || !sequence(addedResultCount) || (!progressed && !ended)) {
      invalid ??= 'A dispatched continuation failed or its Core page receipt did not establish progress or exhaustion';
    }
  }
  return {pages:[...pages.values()],invalid};
}

function phaseAppend(evidence, assertion) {
  const expected = assertion.expected;
  const {action,intents,commits,intent} = association(evidence, assertion.action, 'button');
  if (commits.length > 1) return output({applicability:'UNKNOWN', accepted:commits.length,
    sequences:commits.map(event => event.eventSeq)}, expected, false,
  'One native action submitted more than one query revision', intents.length === 1);
  requireEvidence(intents.length === 1 && commits.length === 1, 'Missing the unique input intent and accepted submit for continuation');
  const endpoint = evidence.use(evidence.samples[assertion.sample]);
  const currentEndpoint = endpoint && sequence(endpoint.beforeSeq) && follows(endpoint,action);
  // An incomplete native sample can still leave verified business records in
  // the journal. Keep them scoped before the next leave action if present.
  const finalEvent = evidence.events.findLast(event => event.instanceId === action.instanceId)?.eventSeq;
  const back = evidence.actions['back-to-shelf'];
  const end = currentEndpoint ? endpoint.beforeSeq :
    back?.instanceId === action.instanceId && sequence(back.beforeSeq) ? back.beforeSeq : finalEvent ?? action.afterSeq;
  const {payload: accepted, eventSeq: acceptedSeq} = commits[0];
  const kinds = [ACCEPTED,'search-surface-settled','search-page-action',PROJECTION,CONTINUATION];
  if (expected.requireFirstPageReceipt === true) kinds.push(ONLINE_ATTEMPT);
  const events = evidence.bounded(action.instanceId, acceptedSeq, end, kinds, 'business');
  requireEvidence(candidateIdentity(accepted) && sequence(accepted.queryRevision) && validLease(accepted.writeLease) &&
    accepted.writeLease.active && editorIdentity(intent.payload), 'The accepted query lacks its active work or input identity');
  if (!matchesFields(intent.payload,accepted,SCOPE) || intent.eventSeq >= acceptedSeq ||
    intent.payload.owner !== accepted.previousOwner || intent.payload.navigation !== accepted.previousNavigation ||
    accepted.navigation <= accepted.previousNavigation || accepted.queryRevision !== accepted.previousQueryRevision + 1 ||
    intent.payload.enabled !== true || intent.payload.semantic !== 'search') {
    return output({applicability:'UNKNOWN',queryRevision:accepted.queryRevision},expected,false,
      'The accepted continuation query does not follow the current native submit intent',false);
  }
  const {generation,session} = accepted.writeLease;
  const firstPage = expected.requireFirstPageReceipt === true ? firstPageWitness(events,accepted) : undefined;
  const observed = {applicability:firstPage ? 'APPLIES' : 'UNKNOWN',queryRevision:accepted.queryRevision,
    generation,session,...(firstPage ? {firstPage} : {})};
  if (expected.requireFirstPageReceipt === true && !firstPage) {
    return appendUnobserved(observed,expected,'The current single-source first page has no verified Core next receipt and ready page two');
  }
  if (firstPage && !firstPage.unique) {
    return output(observed,expected,false,'The current fixed single-source query observed more than one initial settlement',false);
  }
  const resultScope = events.find(event => event.kind === 'search-surface-settled' && event.payload.mode === 'results' &&
    candidateIdentity(event.payload) && matchesFields(event.payload,accepted,LIVE) &&
    event.payload.queryRevision === accepted.queryRevision && sequence(event.payload.owner) && event.payload.owner > 0);
  if (!resultScope && firstPage) return appendUnobserved(observed,expected,
    'The admitted first page has no settled results surface for the current query');
  requireEvidence(resultScope, 'No settled result surface for the accepted continuation query');
  const {queryRevision,owner} = resultScope.payload;
  const matchingQuery = event => event.payload.queryRevision === queryRevision && event.payload.owner === owner;
  const currentPage = event => event.kind === CONTINUATION && matchingQuery(event) &&
    event.payload.capability === PAGE_RECEIPT && event.payload.generation === generation && event.payload.session === session;
  const pageEvents = events.filter(event => currentPage(event) && event.payload.trigger === 'viewport');
  if (firstPage && events.some(event => currentPage(event) && event.payload.stage === 'admitted' &&
      event.payload.trigger === 'empty' && validContinuationPage(event.payload))) {
    return output({...observed,owner},expected,false,
      'A nonempty fixed first page used the empty-result continuation instead of the normal viewport demand',false);
  }
  const start = pageEvents.find(event => event.payload.stage === 'admitted' && validContinuationPage(event.payload) &&
    sequence(event.payload.page) && event.payload.page > 0);
  if (!start && events.some(event => event.kind === ACCEPTED)) {
    return output(observed,expected,false,
      'A new submit replaced the accepted continuation query',false);
  }
  if (!start && firstPage) {
    const projection = events.findLast(event => event.kind === PROJECTION && matchingQuery(event) &&
      event.eventSeq > firstPage.settledSeq && event.payload.operationGeneration === generation);
    const p = projection?.payload;
    if (currentEndpoint && endpoint.captureComplete === true && p?.projection === 'results' &&
        p.searchActive === false && p.resultCount === 2 && (p.moreSources === false || p.stopped === true)) {
      return output({...observed,owner,terminalSeq:projection.eventSeq,moreSources:p.moreSources,stopped:p.stopped},expected,false,
        'The current two-result projection discarded the verified first-page continuation',false);
    }
    return appendUnobserved({...observed,owner},expected,
      'The first page proved a ready continuation, but no matching second-page admission was observed');
  }
  requireEvidence(start, 'No admitted versioned next-page work for the current query and work lease');
  const {page} = start.payload;
  const viewportId = `reader-search-result-list:${page}:${queryRevision}`;
  const requests = events.filter(event => event.kind === 'search-page-action' && event.payload.action === 'need-more' &&
    event.eventSeq < start.eventSeq && matchingQuery(event));
  const pageProjections = events.filter(event => event.kind === PROJECTION && matchingQuery(event));
  const beforeRequest = request => pageProjections.findLast(event => event.eventSeq < request.eventSeq);
  const coherentBaseline = request => {
    const {payload:a} = request;
    const baseline = beforeRequest(request)?.payload;
    return a.page === page && a.operationGeneration === generation && sequence(a.resultCount) && a.resultCount > 0 &&
      baseline?.projection === 'results' && baseline.operationGeneration === generation && baseline.page === page &&
      baseline.viewportId === viewportId && baseline.searchActive === false && baseline.moreSources === true &&
      baseline.stopped === false && baseline.resultCount === a.resultCount && sequence(baseline.publicationRevision) &&
      (!expected.publicResult || baseline.localFailed === false);
  };
  const request = requests.findLast(coherentBaseline) ?? requests.at(-1);
  const baselineEvent = request && beforeRequest(request);
  const baseline = baselineEvent?.payload;
  const projections = pageProjections.filter(event => event.eventSeq > (request?.eventSeq ?? start.eventSeq));
  const projected = projections.at(-1);
  const terminal = projected?.payload;
  const chain = pageEvents.filter(event => event.eventSeq >= (request?.eventSeq ?? start.eventSeq) &&
    event.payload.page === page);
  const {pages,invalid} = settleContinuationPages(chain);
  const actual = {
    ...observed, applicability:'APPLIES', owner, page, viewportId,
    requestSeq:request?.eventSeq ?? null, terminalSeq:projected?.eventSeq ?? null,
    beforeResults:sequence(baseline?.resultCount) ? baseline.resultCount : null,
    afterResults:sequence(terminal?.resultCount) ? terminal.resultCount : null, pages,
  };
  const incomplete = reason => appendUnobserved(actual,expected,reason);
  if (events.some(event => event.kind === ACCEPTED) ||
    pageEvents.some(event => event.eventSeq >= start.eventSeq && event.payload.page !== page) ||
    projections.some(event => sequence(event.payload.page) && event.payload.page !== page ||
      sequence(event.payload.operationGeneration) && event.payload.operationGeneration !== generation ||
      typeof event.payload.viewportId === 'string' && event.payload.viewportId !== viewportId)) {
    return output(actual,expected,false,'The next-page request crossed the accepted query, page, or work generation',false);
  }
  const lastSettlement = Math.max(0,...pages.map(value => value.settledSeq ?? 0));
  const complete = currentEndpoint && endpoint.captureComplete === true &&
    projected?.eventSeq > lastSettlement && pages.every(value => value.settledSeq !== undefined) &&
    terminal.searchActive === false;
  if (invalid) return output(actual,expected,false,invalid,complete === true);
  if (firstPage && (firstPage.settledSeq >= start.eventSeq || baselineEvent?.eventSeq <= firstPage.settledSeq)) {
    return output(actual,expected,false,
      'The first-page receipt did not precede the initial merged projection and next-page admission',complete === true);
  }
  if (!request || !baseline) return incomplete('The admitted continuation lacks a matching viewport request or prior result publication');
  if (!coherentBaseline(request)) {
    return output(actual,expected,false,'The admitted continuation does not follow settled first-page results for this viewport',false);
  }
  if (expected.requirePageThreeEnd === true) {
    // This fixture has one source, one local result and one first-page
    // result. Its second page adds one result, and its third page is empty.
    const [second,third] = pages;
    const wrongPages = pages.length > 2 || pages.some((item,index) =>
      item.sourceOrdinal !== 0 || item.requestedPage !== index + 2 ||
      item.settledSeq !== undefined && (item.receiptState !== (index === 0 ? 'next' : 'end') ||
        item.addedResultCount !== (index === 0 ? 1 : 0)));
    if (baseline.resultCount !== 2 || wrongPages) {
      return output(actual,expected,false,'The public fixture did not follow the single-source second page and empty third page',complete === true);
    }
    if (!second?.settledSeq || !third?.settledSeq) {
      return incomplete('The public fixture has not proved both its added second page and terminating empty third page');
    }
    if (expected.requirePageThreeDemand === true) {
      const prematureGrowth = projections.find(event => event.eventSeq < second.settledSeq &&
        sequence(event.payload.resultCount) && event.payload.resultCount > baseline.resultCount);
      if (prematureGrowth) {
        return output({...actual,prematureProjectionSeq:prematureGrowth.eventSeq},expected,false,
          'The query published added results before the contributing second page settled',complete === true);
      }
      const countAfterSecond = baseline.resultCount + second.addedResultCount;
      const demands = events.filter(event => event.kind === 'search-page-action' && event.payload.action === 'need-more' &&
        matchingQuery(event) && event.eventSeq > second.settledSeq && event.eventSeq < third.admittedSeq)
        .map(action => ({action,projection:beforeRequest(action)}))
        .filter(({projection}) => projection && projection.eventSeq > second.settledSeq);
      const demand = demands.findLast(({action,projection}) => coherentBaseline(action) &&
        projection.payload.resultCount === countAfterSecond &&
        projection.payload.publicationRevision > baseline.publicationRevision);
      if (!demand) {
        const knownMismatch = demands.some(({action,projection}) => {
          const a = action.payload, p = projection.payload;
          return [a.resultCount,p.resultCount].some(count => sequence(count) && count !== countAfterSecond) ||
            [a.operationGeneration,p.operationGeneration].some(work => sequence(work) && work !== generation) ||
            [a.page,p.page].some(candidatePage => sequence(candidatePage) && candidatePage !== page);
        });
        if (knownMismatch) return output(actual,expected,false,
          'The third-page viewport demand did not belong to the merged second-page projection',complete === true);
        return incomplete('No fresh viewport demand on the settled second-page projection before the third page');
      }
      actual.thirdViewportDemand = {demandSeq:demand.action.eventSeq,priorProjectionSeq:demand.projection.eventSeq};
    }
    if (projected?.eventSeq > lastSettlement && terminal.searchActive === false) {
      const known = ['failedCount','skippedCount','incompleteCount'].every(key => sequence(terminal[key])) &&
        ['moreSources','localFailed','sourceListFailed'].every(key => typeof terminal[key] === 'boolean') &&
        sequence(terminal.resultCount) && typeof terminal.operation === 'string';
      if (!known) return incomplete('The third page has no complete final result and exhaustion facts');
      actual.terminal = {operation:terminal.operation,moreSources:terminal.moreSources,
        failedCount:terminal.failedCount,skippedCount:terminal.skippedCount,incompleteCount:terminal.incompleteCount,
        localFailed:terminal.localFailed,sourceListFailed:terminal.sourceListFailed};
      if (terminal.operation !== 'current' || terminal.moreSources || terminal.resultCount !== 3 ||
          terminal.failedCount !== 0 || terminal.skippedCount !== 0 || terminal.incompleteCount !== 0 ||
          terminal.localFailed || terminal.sourceListFailed) {
        return output(actual,expected,false,
        'The native query did not finish with exactly three results and the public source fully exhausted',complete === true);
      }
    }
  }
  if (!complete || !projections.every(event => sequence(event.payload.resultCount)) ||
    !sequence(terminal.publicationRevision) || typeof terminal.stopped !== 'boolean') {
    return incomplete('The admitted next-page work or its stable native endpoint is unobserved');
  }
  const terminalOwner = events.findLast(event => event.kind === 'search-surface-settled' && event.payload.mode === 'results');
  if (terminalOwner !== resultScope && (!matchingQuery(terminalOwner) || !matchesFields(terminalOwner.payload,accepted,LIVE))) {
    return output(actual,expected,false,'The final results surface was reassigned during continuation');
  }
  const visible = endpoint.nodes.filter(node => node.visible && node.id?.startsWith('reader-search-result-list:') &&
    placed(node.visibleRectPx));
  if (terminal.projection !== 'results' || visible.length !== 1 || visible[0].id !== viewportId) {
    return output({...actual,nativeViewports:visible.map(node => node.id)},expected,false,
      'The native results viewport does not belong to the continuation query');
  }
  let viewport;
  let keyboard;
  try {
    viewport = evidence.node(endpoint,viewportId,[DONE.results]);
    keyboard = evidence.keyboard(endpoint);
  } catch (error) {
    if (!(error instanceof MissingSearchEvidence)) throw error;
    return incomplete(error.message);
  }
  const added = pages.reduce((count,value) => count + value.addedResultCount,0);
  const counts = [baseline.resultCount,...projections.map(event => event.payload.resultCount)];
  const publicResult = expected.publicResult === 'b' ? `${PUBLIC_RESULT}-b` : PUBLIC_RESULT;
  const retainedRows = expected.publicResult ? endpoint.nodes.filter(node => node.visible && placed(node.visibleRectPx) &&
    (node.id === publicResult || node.alias === publicResult) && node.path.startsWith(viewport.path + '/')) : [];
  if (expected.publicResult && retainedRows.length !== 1) {
    return output({...actual,viewportPath:viewport.path,added,retainedPublicRows:retainedRows.length},expected,false,
      'The established public local result was not visible in the verified continuation viewport');
  }
  if (expected.requirePageThreeEnd === true) {
    const mounts = endpoint.nodes.filter(node => node.source === 'native-tree' && node.visible === true &&
      placed(node.visibleRectPx) && node.searchResultMount);
    const belongs = node => node.searchResultMount.page === page && node.searchResultMount.queryRevision === queryRevision &&
      ancestorsOf(endpoint,node).includes(viewport);
    const rows = mounts.filter(belongs);
    const visibleOnline = rows.filter(node => node.searchResultMount.kind === 'online');
    const knownTitles = visibleOnline.filter(node => node.searchTitleObserved === true).length;
    const onlineRows = ['cedar','maple'].map(role => {
      const observed = mounts.filter(node => node.publicOnlineRoles?.includes(role));
      const matched = observed.filter(node => belongs(node) && node.searchResultMount.kind === 'online' &&
        node.alias === `reader-search-public-online-result-${role}`);
      return {role,observed:observed.map(node => node.path),matched:matched.map(node => node.path)};
    });
    actual.nativeResults = {visibleCount:rows.length,visibleOnlineTitleCount:knownTitles,onlineRows};
    const missingRole = onlineRows.some(item => !item.matched.length);
    if (onlineRows.some(item => item.observed.length > 1 || item.observed.length !== item.matched.length) ||
        rows.length > terminal.resultCount || rows.length === terminal.resultCount &&
          (visibleOnline.length !== onlineRows.length || knownTitles === visibleOnline.length && missingRole)) {
      return output(actual,expected,false,'The visible native result rows do not match the fixed online additions and retained query');
    }
    if (missingRole) {
      return incomplete('The stable viewport does not expose both public online result rows');
    }
  }
  return output({...actual,viewportPath:viewport.path,added,
    ...(expected.publicResult ? {retainedPublicResultPath:retainedRows[0].path} : {})},expected,
    counts.every((count,index) => index === 0 || count >= counts[index - 1]) &&
    added > 0 && terminal.resultCount === baseline.resultCount + added &&
    terminal.page === page && terminal.operationGeneration === generation && terminal.viewportId === viewportId &&
    terminal.publicationRevision > baseline.publicationRevision && !terminal.stopped && !keyboard.visible,
  'The same viewport did not retain its earlier results and grow by the verified page contributions');
}

function phaseOperation(evidence, assertion) {
  const expected = assertion.expected;
  if (expected.action === 'stop') return phaseStop(evidence, assertion);
  if (expected.action === 'need-more') return phaseAppend(evidence, assertion);
  const action = evidence.action(assertion.action, 'click', assertion.target);
  const post = evidence.sample(assertion.sample);
  requireEvidence(follows(post, action), 'The operation did not precede the native endpoint');
  const admitted = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq,
    ['search-page-action'], 'business').find(event => event.payload.action === expected.action);
  requireEvidence(admitted && sequence(admitted.payload.queryRevision) && sequence(admitted.payload.owner) &&
    sequence(admitted.payload.operationGeneration) && sequence(admitted.payload.resultCount), 'The real page did not dispatch this search operation');
  const events = evidence.bounded(action.instanceId, admitted.eventSeq, post.beforeSeq, [PROJECTION], 'business');
  const projected = LAST(events.filter(event => event.payload.owner === admitted.payload.owner));
  requireEvidence(projected && sequence(projected.payload.operationGeneration) && sequence(projected.payload.resultCount) &&
    typeof projected.payload.searchActive === 'boolean', 'Missing operation result in the active page');
  const a = admitted.payload, p = projected.payload;
  const actual = { action: a.action, revision: a.queryRevision, afterRevision: p.queryRevision,
    generation: a.operationGeneration, afterGeneration: p.operationGeneration, beforeResults: a.resultCount,
    afterResults: p.resultCount, operation: p.operation, searchActive: p.searchActive, stopped: p.stopped ?? null };
  const sameRevision = p.queryRevision === a.queryRevision;
  const preserves = p.resultCount >= a.resultCount;
  const operationChanged = expected.action === 'retry' ? events.some(event => event.payload.owner === a.owner &&
      ['loading','refreshing'].includes(event.payload.operation)) && p.operationGeneration >= a.operationGeneration :
    events.some(event => event.payload.owner === a.owner && event.payload.searchActive === true) && p.resultCount > a.resultCount;
  return output(actual, expected, sameRevision && preserves && operationChanged && p.searchActive === false,
    'The operation lost its owner, dropped retained results, or ended with a different business fact');
}

function phaseStop(evidence, assertion) {
  const expected = assertion.expected;
  const action = evidence.action(assertion.action, 'click', SUBMIT);
  const intents = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-stop-intent'], 'input');
  const admitted = evidence.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-page-action'], 'business')
    .filter(event => event.payload.action === 'stop');
  if (admitted.length > 1) return output({ accepted: admitted.length }, expected, false, 'The Stop tap reached the owner more than once', false);
  requireEvidence(intents.length === 1 && admitted.length === 1 && editorIdentity(intents[0].payload),
    'Missing unique Stop intent or accepted page action');
  const [intent] = intents, [commit] = admitted;
  const prior = association(evidence, assertion.priorAction, assertion.priorSource ?? 'button', assertion.priorTarget).commit;
  requireEvidence(prior && candidateIdentity(prior.payload) && validLease(prior.payload.writeLease) &&
    prior.instanceId === action.instanceId && prior.eventSeq <= action.beforeSeq, 'The Stop action has no accepted submit in its search session');
  const post = evidence.sample(assertion.sample);
  requireEvidence(follows(post, action), 'The Stop action has no full stable native endpoint');
  const b = commit.payload, p = prior.payload;
  const viewportId = `reader-search-result-list:${b.page}:${p.queryRevision}`;
  const alias = expected.publicResult === 'b' ? `${PUBLIC_RESULT}-b` : PUBLIC_RESULT;
  let before, preRow, preRowPath, preViewportPath, nativeStop;
  const locator = action.stopLocator;
  if (locator) {
    evidence.source('native-tree', 'The scoped native Stop target is outside the evidence contract');
    requireEvidence(locator.acceptedSeq === prior.eventSeq && locator.checkpoint.eventSeq === action.beforeSeq &&
      locator.checkpoint.instanceId === action.instanceId && locator.publicResultId === alias && locator.pillPath &&
      locator.publicResultPath && locator.viewportPath, 'The accepted Stop has no matching action-only native locator');
    before = locator.projection;
    preRow = locator.publicResultNode;
    preRowPath = locator.publicResultPath;
    preViewportPath = locator.viewportPath;
    nativeStop = true;
  } else {
    const pre = evidence.sample(action.from);
    requireEvidence(pre.instanceId === action.instanceId && pre.hostEndMs <= action.hostBeginMs && pre.afterSeq <= action.beforeSeq &&
      (expected.requireSamePublicBook !== true || pre.captureComplete === true),
    'The Stop action has no ordered native before state');
    const pill = evidence.node(pre, SUBMIT);
    requireEvidence(typeof pill.enabled === 'boolean' && typeof pill.searchSemantic === 'string', 'The native pill state cannot be identified');
    before = LAST(evidence.bounded(action.instanceId, prior.eventSeq, pre.beforeSeq, [PROJECTION], 'business'))?.payload;
    preRow = evidence.node(pre, alias, expected.requireSamePublicBook ? [viewportId] : undefined);
    preRowPath = preRow.path;
    preViewportPath = evidence.node(pre,viewportId).path;
    nativeStop = pill.enabled === true && pill.searchSemantic === 'stop';
  }
  const after = LAST(evidence.bounded(action.instanceId, commit.eventSeq, post.beforeSeq, [PROJECTION], 'business'));
  requireEvidence(before && after && [before, b, after.payload].every(p =>
    ['owner','page','queryRevision','operationGeneration','resultCount'].every(key => sequence(p[key]))),
  'The active and cancelled result publications have incomplete owner, revision or result counts');
  const a = before, c = after.payload;
  requireEvidence(typeof a.viewportId === 'string' && typeof c.viewportId === 'string', 'The Stop observation lacks the native viewport contract');
  const toRow = evidence.node(post, alias, [viewportId]), postViewport = evidence.node(post, viewportId);
  const accepted = intent.eventSeq < commit.eventSeq && intent.payload.semantic === 'stop' && intent.payload.enabled === true &&
    matchesFields(intent.payload, p, LIVE) && intent.payload.owner === b.owner;
  const continuity = b.queryRevision === p.queryRevision && b.operationGeneration === p.writeLease.generation &&
    matchesFields(a, b, ['owner','page','queryRevision','operationGeneration']) &&
    matchesFields(b, c, ['owner','page','queryRevision','operationGeneration']) && a.viewportId === viewportId && c.viewportId === viewportId;
  const preserves = c.resultCount >= Math.max(a.resultCount, b.resultCount);
  const valid = accepted && continuity && preserves && a.projection === 'results' && a.searchActive === true &&
    c.projection === 'results' && c.searchActive === false && c.stopped === true && c.operation === 'cancelled' &&
    nativeStop;
  const actual = {accepted, continuity, preserves, intentSeq:intent.eventSeq, acceptedSeq:commit.eventSeq,
    stoppedSeq:after.eventSeq, owner:b.owner, queryRevision:b.queryRevision, operationGeneration:b.operationGeneration,
    activeBefore:a.searchActive, activeAfter:c.searchActive, operation:c.operation, stopped:c.stopped,
    resultCounts:[a.resultCount,b.resultCount,c.resultCount], publicResultPaths:[preRowPath,toRow.path],
    viewportPaths:[preViewportPath,postViewport.path]};
  if (!valid || expected.requireSamePublicBook !== true) {
    return output(actual,expected,valid,'Stop did not cancel the current accepted sweep while retaining its public native result');
  }
  const book = publicSearchResultContinuity(preRow,toRow);
  requireEvidence(post.captureComplete === true && book,
    'The original and retained public result rows have no complete comparable native book identity');
  const sameBook = book.sameBook && book.beforePage === b.page && book.afterPage === b.page &&
    book.beforeQuery === p.queryRevision && book.afterQuery === p.queryRevision;
  return output({...actual,publicResultContinuity:book},expected,sameBook,
    'Stop retained a different book or native result owner under the same public title');
}

function nativeBackEditor(evidence, sample) {
  requireEvidence(sample.captureComplete === true, 'Back needs a complete native editor sample');
  const candidates = sample.nodes.filter(item => item.id === EDITOR).filter(item => {
    const ancestors = ancestorsOf(sample, item).map(parent => parent.id);
    const field = ancestors.indexOf(FIELD);
    return field !== -1 && ancestors.indexOf(BAR, field + 1) !== -1;
  }).map(item => {
    evidence.source(item.source, 'The native search editor uses unapproved evidence');
    return { item, visible: effectiveAppearance(sample, item).visible };
  });
  const visible = candidates.filter(entry => entry.visible === true);
  requireEvidence(!candidates.some(entry => entry.visible === null) || visible.length > 1,
    'The visible native search editor cannot be established');
  return visible.length === 1 ? visible[0].item : null;
}

function phaseBack(evidence, assertion) {
  const pre = evidence.sample(assertion.baseline);
  const isKey = assertion.target === undefined;
  const action = evidence.action(assertion.action, isKey ? 'keyEvent' : 'click', assertion.target);
  requireEvidence((!isKey || action.key === 'Back') && pre.instanceId === action.instanceId &&
    pre.afterSeq <= action.beforeSeq && pre.hostEndMs <= action.hostBeginMs, 'Missing matching Back action and earlier native state');
  const observed = evidence.samples[assertion.sample];
  const end = observed?.instanceId === action.instanceId && sequence(observed.beforeSeq) && follows(observed, action) ?
    observed.beforeSeq : action.afterSeq;
  const events = evidence.bounded(action.instanceId, action.beforeSeq, end,
    ['search-back-consumed', 'search-route-released', 'search-page-owner-released'], 'business');
  const consumers = events.filter(event => event.kind === 'search-back-consumed');
  const released = events.find(event => event.kind === 'search-route-released');
  const beforeKeyboard = evidence.keyboard(pre);
  const expected = assertion.expected;
  const actual = { consumer: consumers[0]?.payload.consumer ?? null, route: released?.payload.route ?? null,
    previousMode: consumers[0]?.payload.mode ?? null, keyboardBefore: beforeKeyboard.visible,
    consumers: consumers.length };
  if (expected.consumer === 'keyboard' && beforeKeyboard.visible && (released || consumers.some(event => event.payload.consumer !== 'keyboard'))) {
    return output(actual, expected, false, 'Back left the search owner or another consumer acted while the keyboard was visible', false);
  }
  if (expected.consumer === 'route' && beforeKeyboard.visible === false && consumers.length &&
      consumers.some(event => event.payload.consumer !== 'route')) {
    return output(actual, expected, false, 'Back was consumed by the wrong owner from a stable search route', false);
  }
  const strictEditor = expected.consumer === 'keyboard' && expected.requireSameNativeEditor === true;
  const retainedOwner = focus => !events
    .some(event => event.kind === 'search-page-owner-released' && event.payload.owner === focus.payload.owner) &&
    !evidence.bounded(action.instanceId, action.beforeSeq, end, [EDITOR_RETIRED], 'input')
      .some(event => event.payload.editorId === focus.payload.editorId);
  if (strictEditor && beforeKeyboard.visible) {
    const focus = LAST(evidence.bounded(action.instanceId, 0, action.beforeSeq, [EDITOR_FOCUS], 'input'));
    requireEvidence(focus && editorIdentity(focus.payload) && focus.payload.focused === true &&
      !evidence.bounded(action.instanceId, focus.eventSeq, action.beforeSeq, [EDITOR_RETIRED], 'input')
        .some(event => event.payload.editorId === focus.payload.editorId),
      'No current editor owner before Back');
    const expectedConsumer = { ...focus.payload, mode:'input', route:'search' };
    const fields = [...LIVE, 'owner', 'mode', 'route'];
    const wrongOwner = consumers.some(({payload}) =>
      fields.some(field => payload[field] != null && payload[field] !== expectedConsumer[field]));
    const sameOwner = retainedOwner(focus);
    if (!sameOwner || wrongOwner || consumers.length > 1) {
      return output({...actual,sameOwner:sameOwner && !wrongOwner}, expected, false,
        'Back retired the Search editor or was consumed by the wrong Search owner', false);
    }
    requireEvidence(consumers.every(({payload}) => matchesFields(payload, expectedConsumer, fields)),
      'The reported keyboard consumer has no comparable current Search owner');
  }
  const after = evidence.sample(assertion.sample);
  requireEvidence(follows(after, action), 'Missing the native endpoint after Back');
  const afterKeyboard = evidence.keyboard(after);
  actual.keyboardAfter = afterKeyboard.visible;
  if (expected.consumer === 'keyboard') {
    actual.consumer = consumers.length ? actual.consumer : 'native-ime';
    if (strictEditor) {
      const editor = nativeBackEditor(evidence, pre);
      const kept = nativeBackEditor(evidence, after);
      const validId = id => typeof id === 'string' && /^\d+$/u.test(id);
      requireEvidence(editor?.type === 'TextInput' && validId(editor.key) && editor.enabled === true &&
        validId(pre.window?.id) && validId(after.window?.id), 'Back has no comparable original native TextInput and window');
      const details = {...actual,sameOwner:beforeKeyboard.visible ? true : null,beforePath:editor.path,afterPath:kept?.path ?? null};
      if (pre.window.id !== after.window.id || !kept || kept.type != null && kept.type !== 'TextInput' ||
          kept.enabled === false || validId(kept.key) && editor.key !== kept.key) {
        return output({...details,sameNativeEditor:false}, expected, false,
          'Back changed the native window or did not retain its enabled Search TextInput');
      }
      requireEvidence(kept.type === 'TextInput' && validId(kept.key) && kept.enabled === true,
        'The retained native Search TextInput identity or enabled state is unavailable');
      evidence.node(after, SEARCH_BACK, [BAR]);
      return output({...details,sameNativeEditor:true}, expected, beforeKeyboard.visible && !afterKeyboard.visible,
        'The first Back did not hide the keyboard while preserving the current Search TextInput');
    }
    const editor = evidence.node(pre, EDITOR, [BAR, FIELD]), kept = evidence.node(after, EDITOR, [BAR, FIELD]);
    evidence.node(after, SEARCH_BACK, [BAR]);
    const focus = LAST(evidence.bounded(action.instanceId, 0, action.beforeSeq, [EDITOR_FOCUS], 'input'));
    requireEvidence(focus && editorIdentity(focus.payload) && focus.payload.focused === true, 'No current editor owner before Back');
    const sameOwner = retainedOwner(focus);
    return output({ ...actual, sameOwner, beforePath: editor.path, afterPath: kept.path }, expected,
      consumers.length <= 1 && beforeKeyboard.visible && !afterKeyboard.visible && sameOwner,
      'The first Back did not hide the keyboard while preserving the current search owner');
  }
  requireEvidence(consumers.length && released && candidateIdentity(released.payload) && validLease(released.payload.writeLease),
    'Missing Back dispatch or route release at the bookshelf endpoint');
  const consumer = consumers[0].payload;
  const retirement = events.find(event => event.kind === 'search-page-owner-released' && event.payload.owner === consumer.owner);
  requireEvidence(retirement && typeof retirement.payload.released === 'boolean', 'The prior search page owner release is not observed');
  const entry = evidence.node(after, ENTRY, [BAR]);
  actual.bookshelfEntryPath = entry.path;
  if (expected.publicBook) {
    requireEvidence(typeof after.publicBookTitle === 'string' && after.publicBookTitle.length,
      'The returned bookshelf sample has no approved public title');
    actual.bookshelfAnchorPath = evidence.node(after, { publicBookTitle: after.publicBookTitle }).path;
  }
  const valid = consumers.length === 1 && consumer.consumer === 'route' && consumer.mode === expected.previousMode &&
    !beforeKeyboard.visible && !afterKeyboard.visible && released.payload.route === 'bookshelf' &&
    matchesFields(consumer, released.payload, SCOPE) && consumer.navigation === released.payload.previousNavigation &&
    released.payload.navigation > consumer.navigation && retirement.payload.released && !released.payload.writeLease.active;
  return output({ ...actual, previousOwner: consumer.owner, releaseSeq: retirement.eventSeq }, expected, valid,
    'The wrong consumer, owner, or terminal route consumed search Back');
}

function phaseObsolete(evidence, assertion, context) {
  const first = association(evidence, assertion.priorAction, 'button');
  const second = association(evidence, assertion.action, 'button');
  const a = first.commit?.payload, b = second.commit?.payload;
  requireEvidence(first.commits.length === 1 && second.commits.length === 1 &&
    first.action.instanceId === second.action.instanceId && first.action.afterSeq <= second.action.beforeSeq &&
    first.action.hostEndMs <= second.action.hostBeginMs &&
    candidateIdentity(a) && candidateIdentity(b) && matchesFields(a,b,SCOPE) &&
    sequence(a.queryRevision) && b.previousQueryRevision === a.queryRevision && b.queryRevision === a.queryRevision + 1 &&
    validLease(a.writeLease) && a.writeLease.active && validLease(b.writeLease) && b.writeLease.active &&
    b.writeLease.session === a.writeLease.session && b.writeLease.generation > a.writeLease.generation,
  'Two uniquely accepted submits with distinct, ordered work leases are unavailable');
  const sample = evidence.use(evidence.samples[assertion.sample]);
  const currentSample = sample && sequence(sample.beforeSeq) && follows(sample,second.action);
  // A failed native capture can still leave business events verified by the
  // original action or capture checkpoints. Limit these to B's route interval.
  const observed = evidence.bounded(second.action.instanceId, second.commit.eventSeq,
    currentSample ? sample.beforeSeq : Infinity,
    ['search-obsolete-work-discarded','search-page-action',PROJECTION,ACCEPTED,'search-route-released','search-back-consumed'], 'business');
  const departure = observed.find(event => event.kind === ACCEPTED || event.kind === 'search-route-released' ||
    event.kind === 'search-back-consumed' && event.payload.consumer === 'route');
  const interval = departure ? observed.filter(event => event.eventSeq < departure.eventSeq) : observed;
  const completions = interval.filter(event => event.kind === 'search-obsolete-work-discarded' &&
    event.payload.generation === a.writeLease.generation && event.payload.session === a.writeLease.session);
  const requireResultBatch = assertion.expected.requireResultBatch === true;
  const late = requireResultBatch ? completions.filter(({payload}) =>
    ['received-results','decoded-results'].includes(payload.completion)) : completions;
  const unverified = requireResultBatch && completions.some(({payload}) =>
    !['received-results','decoded-results','other'].includes(payload.completion));
  const projections = interval.filter(event => event.kind === PROJECTION);
  const corrupted = projections.find(event => event.payload.queryRevision === a.queryRevision ||
    event.payload.operationGeneration === a.writeLease.generation);
  const latest = LAST(projections);
  const endpoint = latest?.payload;
  const currentGeneration = b.writeLease.generation;
  const stop = endpoint?.operation === 'cancelled' && endpoint.stopped === true && endpoint.searchActive === false &&
    endpoint.queryRevision === b.queryRevision && interval.find(event => event.kind === 'search-page-action' &&
      event.eventSeq < latest.eventSeq && event.payload.action === 'stop' &&
      event.payload.operationGeneration === currentGeneration &&
      matchesFields(event.payload,endpoint,['owner','page','queryRevision']));
  const capturedEndpoint = currentSample && sample.captureComplete === true && !departure &&
    !context.sampleReadiness?.[assertion.sample] && !context.problems?.length;
  const verifiedEndpoint = capturedEndpoint && endpoint?.queryRevision === b.queryRevision &&
    (endpoint.operationGeneration === currentGeneration || stop && endpoint.operationGeneration === currentGeneration + 1);
  const discarded = late.length > 0 && late.every(event => event.payload.currentSession === b.writeLease.session &&
    event.payload.queryRevision === b.queryRevision && (event.payload.currentGeneration === currentGeneration ||
      stop && event.eventSeq > stop.eventSeq && event.payload.currentGeneration === currentGeneration + 1));
  const applies = late.length > 0 || corrupted !== undefined;
  const actual = { applicability:applies ? 'APPLIES' : verifiedEndpoint && !unverified ? 'DOES_NOT_APPLY' : 'UNKNOWN',
    discarded, observedDiscardSeqs:late.map(event => event.eventSeq), queryRevision:b.queryRevision,
    overwrittenBySeq:corrupted?.eventSeq ?? null };
  if (corrupted) return output(actual,assertion.expected,false,
    'An obsolete worker still wrote to the visible query after the newer submit',capturedEndpoint === true);
  if (late.length > 0 && !discarded) return output(actual,assertion.expected,false,
    'The obsolete completion was not discarded against the accepted newer work lease',capturedEndpoint === true);
  if (!applies || !verifiedEndpoint) {
    let reason = 'The newer query has no verified post-submission observation interval';
    if (verifiedEndpoint) {
      if (!requireResultBatch) reason = 'No obsolete completion of query A arrived after B was accepted';
      else reason = unverified ? 'The prior worker completion has no verified result classification' :
        'No obsolete result batch from query A arrived after B was accepted';
    }
    return {actual,expected:assertion.expected,verdict:'NOT_RUN',reason};
  }
  return output(actual,assertion.expected,true);
}

export function evaluateSearch(assertion, context) {
  const evidence = new SearchEvidence(context, assertion);
  const expectedLength = assertion.expected?.length ?? 6;
  let result;
  try {
    switch (assertion.kind) {
      case 'entry': result = entry(evidence); break;
      case 'focus': result = focus(evidence); break;
      case 'ime-before-input': result = imeBeforeInput(evidence); break;
      case 'edit-selection': result = editSelection(evidence, expectedLength); break;
      case 'submit': result = submit(evidence, expectedLength); break;
      case 'results-settled': result = resultsSettled(evidence); break;
      case 'phase-submit': result = phaseSubmit(evidence, assertion); break;
      case 'phase-edit': result = phaseEdit(evidence, assertion); break;
      case 'phase-reedit': result = phaseReedit(evidence, assertion); break;
      case 'phase-clear': result = phaseClear(evidence, assertion); break;
      case 'phase-projection': result = phaseProjection(evidence, assertion); break;
      case 'phase-empty-rerun': result = phaseEmptyRerun(evidence, assertion); break;
      case 'phase-source-load-retry': result = phaseSourceLoadRetry(evidence, assertion); break;
      case 'phase-history-loading': result = evaluateSearchHistoryLoading(assertion, context); break;
      case 'phase-back': result = phaseBack(evidence, assertion); break;
      case 'phase-relative': result = phaseRelative(evidence, assertion); break;
      case 'phase-detail': result = phaseDetail(evidence, assertion); break;
      case 'phase-panel': result = phasePanel(evidence, assertion); break;
      case 'phase-filter-empty-reset': result = evaluateSearchFilterEmptyReset(assertion, context); break;
      case 'phase-task-retry': result = phaseTaskRetry(evidence, assertion); break;
      case 'phase-operation': result = phaseOperation(evidence, assertion); break;
      case 'phase-obsolete': result = phaseObsolete(evidence, assertion, context); break;
      default: throw new Error(`Unknown search assertion kind ${assertion.kind}`);
    }
  } catch (error) {
    if (!(error instanceof MissingSearchEvidence)) throw error;
    result = { actual: null, expected: assertion.expected ?? null, verdict: 'NOT_RUN', reason: error.message };
  }
  return { ...result, evidenceRefs: [...new Set([...evidence.refs, ...(result.evidenceRefs ?? [])])] };
}
