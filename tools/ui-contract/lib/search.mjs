import { selectLayoutNode } from './layout.mjs';

const ENTRY = 'reader-bookshelf-search-entry';
const EDITOR = 'reader-book-search-input';
const SUBMIT = 'reader-bookshelf-search-submit';
const FIELD = 'reader-bookshelf-search-field';
const BAR = 'reader-bookshelf-search-bar';
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

  node(sample, id, ancestor) {
    let node;
    try {
      node = selectLayoutNode(sample, { id, ancestors: ancestor });
    } catch (error) {
      throw new MissingSearchEvidence(error.message);
    }
    this.source(node.source, `The evidence source for ${id} is outside this assertion's contract`);
    requireEvidence(placed(node.visibleRectPx), `${id} has no visible native bounds`);
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

  open() {
    const action = this.action('open-search', 'click', ENTRY);
    const matches = this.bounded(action.instanceId, action.beforeSeq, action.afterSeq, ['search-open-accepted'], 'business');
    requireEvidence(matches.length === 1 && candidateIdentity(matches[0].payload) && sequence(matches[0].payload.queryRevision),
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
    owner: endpoint.payload.owner, marker, markerPath: node.path, viewportId: expectedViewport,
    viewportPath: viewport.path, settledSeq: endpoint.eventSeq, projectionSeq: projection.eventSeq },
  { states: ['empty', 'results'], queryRevision: commit.payload.queryRevision, matchingNativeViewport: true }, true);
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
      default: throw new Error(`Unknown search assertion kind ${assertion.kind}`);
    }
  } catch (error) {
    if (!(error instanceof MissingSearchEvidence)) throw error;
    result = { actual: null, expected: assertion.expected ?? null, verdict: 'NOT_RUN', reason: error.message };
  }
  return { ...result, evidenceRefs: [...evidence.refs] };
}
