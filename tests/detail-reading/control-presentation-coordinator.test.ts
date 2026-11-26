import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  ReaderControlFontOrder, ReaderControlNavigation, type ReaderControlFontOrderFacts, type ReaderControlNavigationIntent,
} from '../../entry/src/main/ets/features/reading/ui/ReaderControlPresentationCoordinator.ts';
import {
  createReaderControlSessionState, openReaderControlSession, enterReaderControlModule, readerControlContentLocation,
} from '../../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts';
import { createDefaultReaderAppearanceSnapshot, setReaderAppearanceFontOrder,
  type ReaderAppearanceFontSlot, type ReaderAppearanceSnapshot } from
  '../../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import type { ReaderControlModuleFacts, ReaderControlPresentationReceipt } from
  '../../entry/src/main/ets/features/reading/ui/ReaderControlMinimumMeasurement.ets';
import { createDefaultReaderWindowMetrics } from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerControlCandidateWidths, resolveReaderControlLayout } from
  '../../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';

function navigationFixture() {
  const session = openReaderControlSession(createReaderControlSessionState(), 0);
  const state = { session, visual: { ...session }, ready: true,
    scope: { sourceId: 'source', bookId: 'book', lifecycleToken: 3, openRevision: 2, visitRevision: 5 },
    intent: undefined as ReaderControlNavigationIntent | undefined };
  const calls: string[] = [];
  const owner = new ReaderControlNavigation({
    scope: () => state.scope, session: () => state.session, visualSession: () => state.visual,
    readIntent: () => state.intent,
    publishIntent: intent => { state.intent = intent; calls.push(intent === undefined ? 'clear' : 'stage'); },
    publishSession: next => { state.session = next; calls.push('publish'); },
    hasCommittedReceipt: () => state.ready,
    invalidateMinimumRequest: () => { calls.push('invalidate'); },
    accept: origin => { calls.push(`accept:${origin}`); },
  });
  const next = enterReaderControlModule(session, 'appearance', 150);
  return { owner, state, calls, next, session };
}

test('a module change with an active receipt stages a target and selects only a matching visual owner', () => {
  const { owner, state, calls, next, session } = navigationFixture();
  assert.equal(owner.request(next, 'module-button'), true);
  assert.deepEqual(calls, ['stage']);
  assert.equal(state.session, session);
  assert.deepEqual(JSON.parse(owner.ownerKey()), ['source', 'book', 3, 2]);
  assert.equal(owner.active()?.moduleVisitRevision, 6);
  const accepted = owner.prepareCommit();
  assert.equal(accepted?.source, state.visual);
  assert.equal(readerControlContentLocation(accepted!.session).module, 'appearance');
  state.visual = { ...state.visual, closeRevision: state.visual.closeRevision + 1 };
  assert.equal(owner.prepareCommit()?.source, session);
});

test('a direct control request accepts before publishing and retired staged targets cannot commit', () => {
  const { owner, state, calls, next } = navigationFixture();
  assert.equal(owner.request(next, 'module-button'), true);
  state.scope.openRevision += 1;
  assert.equal(owner.prepareCommit(), undefined);
  assert.equal(owner.cancel(), false);
  assert.deepEqual(calls, ['stage', 'invalidate', 'clear']);
  state.ready = false;
  assert.equal(owner.request(next, 'module-button'), false);
  assert.deepEqual(calls.slice(-2), ['accept:module-button', 'publish']);
  assert.equal(state.session, next);
});

test('cancelling a current navigation invalidates the minimum before clearing its intent', () => {
  const { owner, calls, next } = navigationFixture();
  owner.request(next, 'module-button');
  assert.equal(owner.cancel(), true);
  assert.equal(owner.cancel(), false);
  assert.deepEqual(calls, ['stage', 'invalidate', 'clear']);
  owner.retire();
  assert.deepEqual(calls, ['stage', 'invalidate', 'clear', 'clear']);
});

const appearance = createDefaultReaderAppearanceSnapshot();
const order: ReaderAppearanceFontSlot[] = ['serif', 'system'];
const committedAppearance = setReaderAppearanceFontOrder(appearance, order);
const metrics = createDefaultReaderWindowMetrics();
const appearanceLocation = { level: 'secondary' as const, module: 'appearance' as const,
  directoryTab: 'directory' as const, form: 'full' as const };

function fontFacts(snapshot: ReaderAppearanceSnapshot, shownOrder: ReaderAppearanceFontSlot[]): ReaderControlModuleFacts {
  return { module: 'appearance', appearance: { readViewSnapshot: () => snapshot, readViewFontOrder: () => shownOrder,
    themes: [], themeActions: [], themeSummary: '', fonts: [], indentValue: '', languageValue: '', indentOptions: [],
    languageOptions: [], metricLabels: [], metricValues: [] } };
}

function receipt(provider: ReaderControlModuleFacts): ReaderControlPresentationReceipt {
  return { identity: 'appearance', ownerKey: 'owner', key: 'receipt', environmentKey: 'window',
    location: appearanceLocation, layout: resolveReaderControlLayout(390, 844, false, metrics),
    profile: { module: 'appearance', identity: 'appearance', metricsRevision: metrics.revision, widths: readerControlCandidateWidths(390, 844, false, metrics)[0],
      playbackData: undefined, quick: undefined, full: undefined, topBarVisible: false, navigationLabelHeight: 0,
      navigationHeight: 0, titleHeight: 0, collapseLabelHeight: 0, collapseWidth: 0, headerHeight: 0,
      headerPaint: { role: 'plainUi', titleWidthVp: 0, titleHeightVp: 0, actionLabelWidthVp: 0, actionLabelHeightVp: 0,
        actionPaintWidthVp: 0, actionPaintHeightVp: 0, heightVp: 0 } },
    prepared: { facts: provider, identity: 'appearance', key: 'receipt', moduleData: { module: 'appearance' } } };
}

function fontFixture() {
  const state = { ready: true, order: appearance.fontOrder, generation: 5, environment: 'window', receiptCurrent: true,
    receipt: undefined as ReaderControlPresentationReceipt | undefined, facts: undefined as ReaderControlModuleFacts | undefined };
  const commits: Array<{ order: ReaderAppearanceFontSlot[]; result: ReturnType<typeof Promise.withResolvers<ReaderAppearanceSnapshot | undefined>> }> = [];
  const displayed: ReaderControlFontOrderFacts[] = [];
  const owner = new ReaderControlFontOrder({
    committedIdentity: () => 'appearance', openRevision: () => 8,
    current: identity => identity === 'appearance' && state.ready,
    order: () => state.order,
    providerReadback: () => state.facts?.appearance,
    preparedReadback: identity => {
      const receipt = state.receipt;
      const prepared = receipt?.prepared;
      if (receipt?.ownerKey !== 'owner' || receipt.profile.module !== 'appearance' ||
        receipt.key !== 'receipt' || !state.receiptCurrent || prepared?.identity !== identity ||
        prepared.key !== receipt.key) return undefined;
      return prepared.facts?.appearance;
    },
    generation: () => state.generation, environment: () => state.environment,
    commit: order => { const result = Promise.withResolvers<ReaderAppearanceSnapshot | undefined>(); commits.push({ order, result }); return result.promise; },
    displayed: facts => { displayed.push(facts); },
  });
  return { owner, state, commits, displayed };
}

test('font order requires the accepted snapshot and both prepared appearance readbacks before display', async () => {
  const { owner, state, commits, displayed } = fontFixture();
  const presentation = owner.request(order);
  assert.equal(presentation.current(), false);
  state.order = committedAppearance.fontOrder;
  state.receipt = receipt(fontFacts(committedAppearance, appearance.fontOrder));
  commits[0].result.resolve(committedAppearance);
  await setImmediate();
  assert.deepEqual(displayed, []);
  state.receipt = receipt(fontFacts(committedAppearance, committedAppearance.fontOrder));
  owner.reconcile();
  assert.equal(await presentation.displayed, true);
  assert.equal(presentation.current(), true);
  assert.deepEqual(displayed, [{ requested: committedAppearance.fontOrder, order: committedAppearance.fontOrder, openRevision: 8 }]);
  state.receiptCurrent = false;
  assert.equal(presentation.current(), false);
});

test('unavailable font layout only resolves the matching generation and environment after commit', async () => {
  const { owner, state, commits, displayed } = fontFixture();
  state.order = committedAppearance.fontOrder;
  state.facts = fontFacts(committedAppearance, committedAppearance.fontOrder);
  const first = owner.request(order);
  owner.unavailable('appearance');
  state.environment = 'new window';
  commits[0].result.resolve(committedAppearance);
  await setImmediate();
  assert.deepEqual(displayed, []);
  state.receipt = receipt(state.facts);
  owner.reconcile();
  assert.equal(await first.displayed, true);
  state.receipt = undefined;
  const current = owner.request(order);
  owner.unavailable('appearance');
  commits[1].result.resolve(committedAppearance);
  assert.equal(await current.displayed, false);
});

test('an old font request, rejected commit and retired control cannot acknowledge a newer display', async () => {
  const { owner, state, commits, displayed } = fontFixture();
  const previous = owner.request(order);
  const next = owner.request(order);
  assert.equal(await previous.displayed, false);
  commits[0].result.resolve(committedAppearance);
  commits[1].result.resolve(undefined);
  assert.equal(await next.displayed, false);
  state.ready = false;
  const ignored = owner.request(order);
  assert.equal(await ignored.displayed, false);
  assert.equal(commits.length, 2);
  assert.deepEqual(displayed, []);
});
