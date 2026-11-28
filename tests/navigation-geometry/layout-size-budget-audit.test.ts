import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditDumpLayout, renderLayoutAuditHtml } from '../../scripts/lib/layout-size-budget-audit.mjs';

const D = 3.5;

function node(type, id, vpRect, children = [], text = '') {
  const [x1, y1, x2, y2] = vpRect.map(v => Math.round(v * D));
  return {
    attributes: { type, id, text, bounds: `[${x1},${y1}][${x2},${y2}]` },
    children,
  };
}

test('auditor blocks historical reader control regressions and passes fixed 330vp island', () => {
  const regressed = node('Stack', 'root', [0, 0, 365.7, 809.1], [
    node('Stack', 'reader-control-motion-dock', [12.3, 418.3, 353.7, 790.3], [
      node('Stack', 'reader-control-quick-content-surface', [25.4, 447.4, 288.9, 647.4], [
        node('Column', 'reader-control-chapter-progress-card', [25.4, 529.4, 288.9, 647.4], [
          node('Row', 'reader-control-chapter-bookmark-lane', [26.3, 566.3, 288.0, 610.3]),
        ]),
      ]),
      node('Button', 'reader-control-entry-autoPage', [34.0, 708.0, 105.4, 770.0]),
    ]),
  ]);
  const failed = auditDumpLayout(regressed, { source: 'regressed-control.json' });
  assert.equal(failed.screen, 'readerControlQuick');
  assert.equal(failed.status, 'FAIL');
  const ruleIds = failed.violations.map(v => v.ruleId);
  assert.ok(ruleIds.includes('readerControl.dockHeight'));
  assert.ok(ruleIds.includes('readerControl.chapterProgressCard'));
  assert.ok(ruleIds.includes('readerControl.chapterBookmarkLane'));
  assert.ok(ruleIds.includes('readerControl.islandGrabber'));
  assert.ok(ruleIds.includes('readerControl.quickToDockDeadGap'));

  const fixed = node('Stack', 'root', [0, 0, 365.7, 809.1], [
    node('Stack', 'reader-control-motion-dock', [12.3, 460.3, 353.7, 790.3], [
      node('Row', 'reader-control-island-grabber', [165.1, 471.4, 201.1, 475.4]),
      node('Stack', 'reader-control-quick-content-surface', [25.4, 486.3, 292.9, 684.3], [
        node('Column', 'reader-control-chapter-progress-card', [25.4, 574.3, 292.9, 682.3], [
          node('Row', 'reader-control-chapter-bookmark-lane', [26.3, 611.1, 292.0, 645.1]),
        ]),
      ]),
      node('Button', 'reader-control-entry-autoPage', [31.1, 705.4, 104.0, 769.4]),
    ]),
  ]);
  const passed = auditDumpLayout(fixed, { source: 'fixed-control.json' });
  assert.equal(passed.status, 'PASS');
  assert.deepEqual(passed.violations, []);
});

test('auditor blocks stretched download covers, oversized insets, and oversized source footers', () => {
  const regressedDownloads = node('Stack', 'root', [0, 0, 365.7, 809.1], [
    node('TextInput', 'reader-editable-target:1', [54.9, 118.0, 334.9, 156.0]),
    node('Row', 'reader-download:book-title:test', [18.0, 280.0, 347.7, 400.0], [
      node('Stack', '', [18.0, 292.0, 66.0, 382.0]),
    ]),
  ]);
  const dlResult = auditDumpLayout(regressedDownloads, { source: 'regressed-dl.json' });
  assert.equal(dlResult.screen, 'downloads');
  assert.equal(dlResult.status, 'FAIL');
  assert.ok(dlResult.violations.some(v => v.ruleId === 'downloads.bookRowInset'));
  assert.ok(dlResult.violations.some(v => v.ruleId === 'downloads.bookCover'));

  const cleanDownloads = node('Stack', 'root', [0, 0, 365.7, 809.1], [
    node('TextInput', 'reader-editable-target:1', [54.9, 118.0, 334.9, 156.0]),
    node('Row', 'reader-download:book-title:test', [16.0, 280.0, 349.7, 376.0], [
      node('Stack', '', [16.0, 292.0, 64.0, 358.0]),
    ]),
  ]);
  const dlPass = auditDumpLayout(cleanDownloads, { source: 'clean-dl.json' });
  assert.equal(dlPass.status, 'PASS');

  const regressedSource = node('Stack', 'root', [0, 0, 365.7, 809.1], [
    node('Column', 'reader-source-filter-block', [19.1, 106.9, 346.6, 244.9], [
      node('Button', 'reader-source-status-all', [19.1, 162.9, 97.4, 194.9]),
    ]),
    node('Column', '', [19.1, 248.0, 346.6, 314.0], [
      node('Toggle', 'reader-toggle:source-back:1:x:0', [291.7, 268.0, 335.7, 294.0]),
    ]),
    node('Button', 'source-back:1:import:footer', [141.1, 735.1, 346.9, 779.1]),
  ]);
  const srcResult = auditDumpLayout(regressedSource, { source: 'regressed-src.json' });
  assert.equal(srcResult.screen, 'sourceManagement');
  assert.equal(srcResult.status, 'FAIL');
  assert.ok(srcResult.violations.some(v => v.ruleId === 'sourceManagement.filterBlockInset'));
  assert.ok(srcResult.violations.some(v => v.ruleId === 'sourceManagement.statusChips'));
  assert.ok(srcResult.violations.some(v => v.ruleId === 'sourceManagement.sourceRows'));
  assert.ok(srcResult.violations.some(v => v.ruleId === 'sourceManagement.footerButtons'));

  const html = renderLayoutAuditHtml([dlResult, srcResult]);
  assert.ok(html.includes('Alerts (6)'));
  assert.ok(html.includes('墨纸青松 2.0'));
});
