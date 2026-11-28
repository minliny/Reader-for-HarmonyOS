import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderVisualReview } from '../../scripts/lib/vm-visual-review.mjs';

test('renderVisualReview renders sizeAudit comparison table and surfaces BLOCK alerts at top', () => {
  const { markdown, html } = renderVisualReview([
    {
      journey: 'J1',
      status: 'PASS',
      relativeDirectory: 'J1',
      steps: [
        {
          step: '确认书架列表尺寸',
          report: { route: 'bookshelf', observedRules: ['R12', 'R13'] },
          sizeAudit: {
            screen: 'bookshelf',
            status: 'PASS',
            checks: [
              { id: 'bookshelf.viewportInset', label: '书架内容区左右边距', expected: 'insetX=16±1.5vp', actual: 'inset(16,16)', passed: true, severity: 'BLOCK' },
            ],
            violations: [],
          },
        },
        {
          step: '控制岛展开',
          report: { route: 'reading', observedRules: ['R12'] },
          sizeAudit: {
            screen: 'readerControlQuick',
            status: 'FAIL',
            checks: [
              { id: 'readerControl.dockHeight', label: '控制岛快捷态总高度', expected: 'h=[326, 334]vp', actual: 'h=372vp', passed: false, severity: 'BLOCK' },
            ],
            violations: [
              { ruleId: 'readerControl.dockHeight', label: '控制岛快捷态总高度', severity: 'BLOCK', expected: 'h=[326, 334]vp', actual: 'h=372vp' },
            ],
          },
        },
      ],
    },
  ]);

  assert.match(markdown, /SIZE\/BLOCK/);
  assert.match(markdown, /Size budget \(bookshelf\): PASS \(1 checks\)/);
  assert.match(html, /class="size-table"/);
  assert.match(html, /控制岛快捷态总高度/);
  assert.match(html, /h=372vp/);
  assert.match(html, /SIZE\/BLOCK/);
});
