import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSearch } from '../lib/search.mjs';

const INSTANCE = 'instance-1';
const BAR = 'reader-bookshelf-search-bar';
const FIELD = 'reader-bookshelf-search-field';
const ENTRY = 'reader-bookshelf-search-entry';
const EDITOR = 'reader-book-search-input';
const SUBMIT = 'reader-bookshelf-search-submit';
const SEARCH = Object.freeze({ identity: 1, navigation: 2, mounting: 1 });
const ACTIVE_EDITOR = Object.freeze({ ...SEARCH, owner: 3, editorId: '[1,2,1,3]' });
const CASE_SOURCES = ['native-tree', 'window-metrics', 'app-input', 'app-owner'];

function action(op, targetId, beforeSeq, afterSeq, hostBeginMs, hostEndMs) {
  return { instanceId: INSTANCE, actionId: targetId, op, targetId, beforeSeq, afterSeq, hostBeginMs, hostEndMs,
    evidenceRefs: ['actions'] };
}

function event(eventSeq, channel, kind, payload) {
  return { instanceId: INSTANCE, eventSeq, channel, kind, payload, evidenceRefs: [`event-${eventSeq}`] };
}

function node(id, path, parentPath) {
  return { id, path, parentPath, source: 'native-tree', visible: true, visibleRectPx: { width: 20, height: 20 },
    enabled: true, clickable: true, focused: true };
}

function sample(state, beforeSeq, afterSeq, hostBeginMs, hostEndMs, visible, nodes) {
  const rectsVp = visible ? [{ left: 0, top: 490, width: 300, height: 100 }] : [];
  return { sampleId: state, state, instanceId: INSTANCE, beforeSeq, afterSeq, hostBeginMs, hostEndMs, nodes,
    evidenceRefs: [state], window: { revision: 1, keyboard: { visible, rectsVp, revision: 1, source: 'window-metrics' } } };
}

function capture(state = 'empty') {
  const marker = `reader-bookshelf-search-${state}`;
  const viewportId = 'reader-search-result-list:2:7';
  return {
    actions: {
      'open-search': action('click', ENTRY, 2, 4, 3, 6),
      'input-search': action('inputText', EDITOR, 8, 11, 10, 12),
      'submit-search': action('click', SUBMIT, 12, 16, 14, 16),
    },
    samples: {
      before: sample('before', 1, 2, 1, 2, false, [node(BAR, '0/0', '0'), node(ENTRY, '0/0/0', '0/0')]),
      'ime-ready': sample('ime-ready', 6, 8, 7, 9, true, [
        node(BAR, '0/0', '0'), node(FIELD, '0/0/0', '0/0'), node(EDITOR, '0/0/0/0', '0/0/0'),
      ]),
      'results-settled': sample('results-settled', 22, 24, 21, 22, false, [
        node(marker, '0/0', '0'), node(viewportId, '0/0/0', '0/0'),
      ]),
    },
    events: [
      event(3, 'business', 'search-open-accepted', { ...SEARCH, queryRevision: 6 }),
      event(5, 'input', 'search-editor-focus', { ...ACTIVE_EDITOR, focused: true, length: 0 }),
      event(9, 'input', 'search-editor-edit', { ...ACTIVE_EDITOR, focused: true, beforeLength: 0, length: 6 }),
      event(10, 'input', 'search-editor-selection', { ...ACTIVE_EDITOR, focused: true, length: 6, start: 6, end: 6 }),
      event(13, 'input', 'search-button-intent', { ...ACTIVE_EDITOR, enabled: true, semantic: 'search' }),
      event(14, 'business', 'search-submit-accepted', { ...SEARCH, navigation: 3, previousNavigation: 2,
        previousOwner: 3, previousQueryRevision: 6, queryRevision: 7, length: 6 }),
      event(17, 'business', 'search-surface-settled', { ...SEARCH, navigation: 3, queryRevision: 7, mode: 'results', owner: 4 }),
      event(19, 'business', 'search-result-projection', { queryRevision: 7, owner: 4, page: 2, state, viewportId }),
    ],
  };
}

function change(context, seq, update) {
  const record = context.events.find(event => event.eventSeq === seq);
  Object.assign(record.payload, update);
}

const evaluate = (kind, context, allowedSources = CASE_SOURCES) =>
  evaluateSearch({ kind, expected: { length: 6 }, acceptedSources: allowedSources }, context);

test('same-session search with current IME, selection, submit and either resolved native results shape', () => {
  for (const state of ['empty', 'results']) {
    const context = capture(state);
    for (const kind of ['entry', 'focus', 'ime-before-input', 'edit-selection', 'submit', 'results-settled']) {
      const result = evaluate(kind, context);
      assert.equal(result.verdict, 'PASS', kind + ': ' + result.reason);
      assert.ok(result.evidenceRefs.length >= 2);
    }
    assert.equal(evaluate('results-settled', context).actual.state, state);
  }
});

test('a real IME sample taken after input cannot prove that the IME was observed beforehand', () => {
  const context = capture();
  context.samples['ime-ready'].hostEndMs = 11;
  const result = evaluate('ime-before-input', context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.beforeInput, false);
});

test('IME metrics from an old window revision are rejected', () => {
  const context = capture();
  context.samples['ime-ready'].window.revision += 1;
  const result = evaluate('ime-before-input', context);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.match(result.reason, /revision/u);
});

test('an edit from the previous search mounting cannot settle the current native editor', () => {
  const context = capture();
  change(context, 9, { ...ACTIVE_EDITOR, mounting: 0, editorId: '[1,2,0,3]' });
  assert.equal(evaluate('edit-selection', context).verdict, 'NOT_RUN');
});

test('a credible native selection that remains expanded is a product failure', () => {
  const context = capture();
  change(context, 10, { start: 3 });
  const result = evaluate('edit-selection', context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.start, 3);
});

test('the accepted submit fails the focus expectation when the current editor blurred before the tap', () => {
  const context = capture();
  context.events.splice(4, 0, event(12, 'input', 'search-editor-focus', { ...ACTIVE_EDITOR, focused: false, length: 6 }));
  const result = evaluate('submit', context);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.actual.focusedAtTapStart, false);
});

test('an old onSettled endpoint cannot occupy the current accepted submit interval', () => {
  const context = capture();
  change(context, 17, { navigation: 2, queryRevision: 6 });
  const result = evaluate('results-settled', context);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.match(result.reason, /onSettled/u);
});

test('a delayed projection for the old query is ignored and a missing current viewport blocks the result', () => {
  const context = capture('results');
  context.events.push(event(20, 'business', 'search-result-projection',
    { queryRevision: 6, owner: 3, page: 1, state: 'empty', viewportId: 'reader-search-result-list:1:6' }));
  assert.equal(evaluate('results-settled', context).verdict, 'PASS');
  context.samples['results-settled'].nodes[1].id = 'reader-search-result-list:1:6';
  assert.equal(evaluate('results-settled', context).verdict, 'NOT_RUN');
});

test('native-only assertions do not silently accept a business or input event source', () => {
  const result = evaluate('focus', capture(), ['native-tree']);
  assert.equal(result.verdict, 'NOT_RUN');
  assert.match(result.reason, /app-owner/u);
});
