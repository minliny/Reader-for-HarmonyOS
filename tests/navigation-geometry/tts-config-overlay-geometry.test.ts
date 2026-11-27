import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderInsetsVp, ReaderKeyboardAreaVp, ReaderRectVp, ReaderWindowMetricsSnapshot }
  from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerTtsConfigChoiceHeight, readerTtsConfigChoiceTextWidth, readerTtsConfigCompactVoicePreview, readerTtsConfigPanelBudget,
  readerTtsConfigPanelLayout, readerTtsConfigViewport }
  from '../../entry/src/main/ets/features/reading/ui/ReaderTtsConfigGeometry.ts';

function metrics(width: number, height: number, scale: number, bottom: number,
  left: number = 0, right: number = 0, keyboard: ReaderKeyboardAreaVp = new ReaderKeyboardAreaVp()): ReaderWindowMetricsSnapshot {
  const window = new ReaderRectVp(0, 0, width, height);
  return new ReaderWindowMetricsSnapshot(window, window, new ReaderInsetsVp(0, 28), new ReaderInsetsVp(left, 0, right),
    new ReaderInsetsVp(0, 0, 0, bottom), new ReaderInsetsVp(), new ReaderInsetsVp(), 2, scale, 1, true,
    28, new ReaderRectVp(0, 0, width, 28), new ReaderRectVp(), undefined, undefined, keyboard);
}

test('one and two choice rows fit their full heights, spaces, padding and frame', () => {
  const viewport = readerTtsConfigViewport(metrics(320, 720, 1, 24), 364);
  const one = readerTtsConfigPanelBudget(44, [44], 0, 0.5);
  const two = readerTtsConfigPanelBudget(44, [54, 64], 0, 0.5);
  assert.equal(one.panelHeight, 101);
  assert.equal(two.panelHeight, 181);
  const layout = readerTtsConfigPanelLayout(viewport, 364, two, 'bottom');
  assert.deepEqual(layout.rect, new ReaderRectVp(16, 503, 288, 181));
  assert.equal(layout.bodyHeight, 136);
  assert.equal(layout.scrollRequired, false);
});

test('status and trailing action share the six-point item gaps and the form footer budgets separately', () => {
  const budget = readerTtsConfigPanelBudget(58, [62, 368, 44, 36], 76, 0.5);
  assert.equal(budget.bodyHeight, 540);
  assert.equal(budget.panelHeight, 675);
  const viewport = readerTtsConfigViewport(metrics(700, 310, 1.6, 0, 28, 12), 364);
  const layout = readerTtsConfigPanelLayout(viewport, 364, budget, 'bottom');
  assert.equal(layout.rect.left, 176);
  assert.equal(layout.rect.height, 258);
  assert.equal(layout.bodyHeight, 123);
  assert.equal(layout.compact, false);
  assert.equal(layout.scrollRequired, true);
});

test('large voice rows fit narrow portrait and scroll in landscape without charging safe edges twice', () => {
  for (const fontScale of [1.6, 2.0]) {
    for (const safeBottom of [0, 28]) {
      for (const [width, height] of [[320, 568], [568, 320]]) {
        const viewport = readerTtsConfigViewport(metrics(width, height, fontScale, safeBottom, 14, 26), 364);
        const row = readerTtsConfigChoiceHeight(34 * fontScale, 14 * fontScale, 44, true, 0.5);
        const budget = readerTtsConfigPanelBudget(48, Array<number>(12).fill(row), 0, 0.5);
        const layout = readerTtsConfigPanelLayout(viewport, 364, budget, 'bottom');
        assert.ok(readerTtsConfigChoiceTextWidth(layout.rect.width, 0.5, true, 66, 0.5) >= 40);
        assert.equal(layout.rect.top + layout.rect.height, height - safeBottom - 12);
        assert.ok(layout.rect.left >= 30);
        assert.ok(layout.rect.left + layout.rect.width <= width - 42);
        assert.equal(layout.scrollRequired, true);
        assert.equal(layout.compact, false);
      }
    }
  }
});

test('a docked keyboard reserves the bottom and leaves compact form controls in one reachable scroll', () => {
  const keyboard = new ReaderKeyboardAreaVp(true, true, [new ReaderRectVp(0, 166, 320, 402)]);
  const viewport = readerTtsConfigViewport(metrics(320, 568, 2, 24, 0, 0, keyboard), 364);
  const budget = readerTtsConfigPanelBudget(68, [488], 96, 0.5);
  const layout = readerTtsConfigPanelLayout(viewport, 364, budget, 'bottom');
  assert.deepEqual(layout.rect, new ReaderRectVp(16, 40, 288, 114));
  assert.equal(layout.compact, true);
  assert.equal(layout.bodyHeight, 113);
  assert.equal(layout.scrollRequired, true);
});

test('a legacy picker flips above the measured trigger inside the native host', () => {
  const host = new ReaderRectVp(40, 70, 230, 310);
  const viewport = readerTtsConfigViewport(metrics(320, 400, 1, 20), 364, host);
  const budget = readerTtsConfigPanelBudget(44, [44, 44], 0, 0.5);
  const anchor = new ReaderRectVp(155, 316, 100, 44);
  const layout = readerTtsConfigPanelLayout(viewport, 364, budget, 'anchor-end', anchor);
  assert.deepEqual(layout.rect, new ReaderRectVp(56, 161, 198, 151));
  assert.equal(layout.scrollRequired, false);
});

test('narrow 2x voice rows leave their preview action reachable while preserving label width', () => {
  assert.equal(readerTtsConfigCompactVoicePreview(248, 0.5, 95, 1, 26), true);
  assert.equal(readerTtsConfigCompactVoicePreview(364, 0.5, 95, 1, 26), false);
  assert.equal(readerTtsConfigChoiceTextWidth(248, 0.5, true, 44, 1), 81);
});
