import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { errorMessageOf } from '../entry/src/main/ets/app/ErrorMessage.ts';
import * as transferState from '../entry/src/main/ets/features/source/application/SourceV9TransferState.ts';
import { ReaderInsetsVp, ReaderKeyboardAreaVp, ReaderRectVp, ReaderWindowMetricsSnapshot }
  from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { isPrivateNetworkTarget } from '../entry/src/main/ets/platform/network/HttpTransportPolicy.ts';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(url)) return next(url.href, context);
  }
  return next(specifier, context);
} });
const [
  { readerReadableFontScale }, { readerKeyboardHostBottom }, { bookshelfOperationClass },
  { selectedProductionMethods }, { actualSourceManagementGeometry },
] = await Promise.all([
  import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts'),
  import('../entry/src/main/ets/ui/layout/ReaderKeyboardGeometry.ts'),
  import('./lib/bookshelf-operation-owner-probe.mjs'),
  import('./lib/selected-production-methods.mjs'),
  import('./lib/source-management-owner-probe.mjs'),
]);

const transferPage = new URL('../entry/src/main/ets/features/source/ui/SourceV9TransferPage.ets', import.meta.url);
const reviewCandidate = {
  index: 0, sourceId: 'https://sources.example', name: '书源', category: 'novel', supported: true,
  bookSource: { bookSourceUrl: 'https://sources.example', bookSourceName: '书源' },
};

test('manual subscription checking reaches the original provider with automatic updates off', async () => {
  const subscriptions = [
    { id: 1, name: '自动更新订阅', type: 0, url: 'https://packages.example/automatic', autoUpdate: true },
    { id: 2, name: '手动更新订阅', type: 0, url: 'https://packages.example/manual', autoUpdate: false },
  ];
  const downloads = [];
  const previews = [];
  const runtime = {
    supportsCoreCapability: () => false,
    async loadOnlineJsonDocument(url) {
      downloads.push(url);
      return { text: JSON.stringify([reviewCandidate.bookSource]) };
    },
  };
  class SourceGateway {
    supportsEphemeralSourceCheck() { return false; }
    prepareGroupedSourceDocument() { return { items: [reviewCandidate], failures: [], filteredUnsupportedCount: 0 }; }
  }
  class RulesManagementGateway {
    observeWrites() {}
    mutationSnapshot() { return { blocked: false, generation: 0, canRetryOriginal: false }; }
    async listRuleSubscriptions() { return subscriptions; }
    async captureSourceSubscription(subscription) { return { subscription }; }
    async previewSourceSubscription(id, document, expected) {
      previews.push({ id, document, expected });
      return { changes: [{ sourceId: reviewCandidate.sourceId, name: reviewCandidate.name, kind: 'added' }] };
    }
  }
  const SourceV9TransferOwner = bookshelfOperationClass('features/source/application/SourceV9TransferOwner.ts',
    'SourceV9TransferOwner', { ...transferState, SourceGateway, RulesManagementGateway, isPrivateNetworkTarget,
      errorMessageOf, ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
      url: { URL: { parseURL: value => new URL(value) } } });
  let snapshot;
  const flow = new SourceV9TransferOwner(runtime, state => { snapshot = state; }, () => true, () => {});
  await flow.loadSubscriptions();

  const Page = selectedProductionMethods(transferPage, 'SourceV9TransferPage', ['activeSubscriptions', 'checkSubscriptions']);
  const page = Object.assign(new Page(), { flow, state: snapshot, editable: () => true, resetCheckSettings() {} });
  assert.deepEqual(page.activeSubscriptions(), [1]);
  page.checkSubscriptions([subscriptions[1].id]);
  // The production page intentionally dispatches without awaiting the owner.
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(downloads, [subscriptions[1].url]);
  assert.deepEqual(previews, [{ id: 2, document: JSON.stringify([reviewCandidate.bookSource]),
    expected: { subscription: subscriptions[1] } }]);
  assert.equal(snapshot.reviews[0].subscription.autoUpdate, false);
  assert.equal(snapshot.reviews[0].rows[0].kind, 'added');
});

test('transfer footer and dialog reserve only actual keyboard occlusion in this pane', () => {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 1000, 700));
  metrics.ready = true;
  metrics.systemInsets = new ReaderInsetsVp(0, 36, 0, 24);
  const Page = selectedProductionMethods(transferPage, 'SourceV9TransferPage',
    ['refreshLayout', 'visiblePaneHeight', 'modalViewportHeight', 'modalBodyHeight'], {
      ...actualSourceManagementGeometry(metrics), readerWindowMetrics: () => metrics,
      readerKeyboardHostBottom, readerReadableFontScale,
      TRANSFER_MAX_WIDTH: 640, TRANSFER_BODY_TAIL: 12, TRANSFER_FOOTER_TOP: 8,
    });
  const page = Object.assign(new Page(), {
    mounted: true, windowRevision: 1, embeddedWide: true, pane: 'import',
    paneX: 640, paneY: 40, paneWidth: 350, paneHeight: 636,
    headerHeight: 52, footerHeight: 53, footerButtonHeight: () => 44,
  });
  metrics.keyboardArea = new ReaderKeyboardAreaVp(true, true, [new ReaderRectVp(500, 418, 500, 282)]);
  page.refreshLayout();
  assert.deepEqual([page.modalViewportHeight(), page.modalBodyHeight()], [378, 222]);
  assert.equal(page.geometry.footer.bottom, 258);
  assert.equal(page.geometry.content.endInset, 311);

  page.paneHeight = 378;
  page.refreshLayout();
  assert.equal(page.modalViewportHeight(), 378, 'native resizing already consumed the same keyboard rectangle');
  assert.equal(page.geometry.footer.bottom, 24);

  page.paneX = 0;
  page.paneHeight = 636;
  page.refreshLayout();
  assert.equal(page.modalViewportHeight(), 636, 'keyboard beside the pane leaves the pane visible');
  assert.equal(page.geometry.footer.bottom, 24);
});

test('subscription cancel and system back both dismiss a pending write without dispatching a replacement', async () => {
  const Page = selectedProductionMethods(transferPage, 'SourceV9TransferPage',
    ['inputCurrent', 'editable', 'canDismissDialog', 'consumeBack', 'confirmDialog', 'retireClipboardPaste']);
  let retiredPastes = 0;
  const page = Object.assign(new Page(), {
    mounted: true, dialog: 'form', state: { writePending: true, busy: false, runningCheck: false, reviews: [] },
    flow: { saveSubscription: () => assert.fail('cancel must not issue a write') },
    draftPaste: { retire: () => retiredPastes += 1 },
  });
  assert.equal(page.canDismissDialog(), true);
  assert.equal(page.editable(), false);
  await page.confirmDialog('confirm');
  assert.equal(page.dialog, 'form');
  await page.confirmDialog('cancel');
  assert.equal(page.dialog, 'none');
  assert.equal(page.state.writePending, true);
  assert.equal(retiredPastes, 1);

  page.dialog = 'form';
  assert.equal(page.consumeBack(), true);
  assert.equal(page.dialog, 'none');
  assert.equal(retiredPastes, 2);

  page.dialog = 'form';
  page.state.busy = true;
  assert.equal(page.canDismissDialog(), false);
  await page.confirmDialog('cancel');
  assert.equal(page.consumeBack(), true);
  assert.equal(page.dialog, 'form');
  assert.equal(retiredPastes, 2);
});

test('short keyboard-constrained dialogs keep a scrollable input row', () => {
  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 800, 330));
  metrics.ready = true;
  metrics.systemFontScale = 1.3;
  metrics.keyboardArea = new ReaderKeyboardAreaVp(true, true, [new ReaderRectVp(0, 125, 800, 205)]);
  const dependencies = { readerWindowMetrics: () => metrics, readerReadableFontScale, readerKeyboardHostBottom };
  for (const [owner, body, viewport, methods] of [
    ['SourceV9CheckDialog', 'bodyHeight', 'visibleDialogHeight', ['keyboardClearance']],
    ['SourceV9GroupsPage', 'bodyLimit', 'visibleDialogHeight', ['keyboardClearance', 'fontScale']],
    ['SourceV9TransferPage', 'modalBodyHeight', 'modalViewportHeight', ['visiblePaneHeight']],
  ]) {
    const Page = selectedProductionMethods(new URL(owner + '.ets', transferPage), owner,
      [...methods, body, viewport], dependencies);
    const page = Object.assign(new Page(), {
      windowRevision: 1, paneWidth: 800, paneHeight: 330, paneTop: 0, paneLeft: 0, paneX: 0, paneY: 0,
    });
    assert.equal(page[viewport](), 125, owner + ' bounds the whole overlay above the keyboard');
    assert.ok(page[body]() >= 44, owner + ' preserves room for an input row');
    page.paneHeight = 125;
    assert.equal(page[viewport](), 125, owner + ' avoids subtracting the keyboard a second time');
  }
});
