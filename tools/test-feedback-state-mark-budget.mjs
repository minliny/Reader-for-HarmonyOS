import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { readerMessageStyles } from './lib/reader-typography-probe.mjs';
import * as feedback from '../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import { createDefaultReaderWindowMetrics, readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
const selected = selectContractCases({
  'mark-role': { description: 'Actual Toast native status-glyph and paint budget, 1x/2x unit resolution, with ordinary title/body retaining fp and legacy14fp negative', resources: [] },
});
const source = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderTransientToast.ets', import.meta.url), 'utf8');
for (const id of selected) {
  const sdk = boundedSurfaceSdk();
  const metrics = createDefaultReaderWindowMetrics();
  const owner = sdk.consumer(source, undefined, {
    ...feedback, ...readerMessageStyles, readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight,
    readerWindowMetrics: () => metrics,
    readerMotionAnimateParam: () => ({ duration: 0 }), readerReduceMotionFromStorage: () => true,
  });
  Object.assign(owner, {
    hostId: -1, toast: { ...feedback.createReaderTransientToastState(), visible: true, title: '保存结果', message: '原操作回执已确认', tone: 'success', generation: 1 },
    displayed: true, toastOpacity: 1, toastOffsetY: 0,
  });
  owner.initialRender();
  const nodes = [...owner.nodes.values()];
  const mark = nodes.find(node => node.type === 'Text' && node.create === '✓');
  const body = nodes.find(node => node.type === 'Text' && node.create === '原操作回执已确认');
  const title = nodes.find(node => node.type === 'Text' && node.create === '保存结果');
  assert.ok(mark && body && title, 'actual status, title and body declarations render');
  assert.equal(mark.fontSize, '14vp');
  assert.deepEqual([mark.width, mark.height], [22, 22]);
  assert.equal(body.fontSize, readerMessageStyles.MESSAGE_BODY.fontSizeFp);
  assert.equal(title.fontSize, readerMessageStyles.MESSAGE_TITLE.fontSizeFp);
  const nativeSize = (value, scale) => typeof value === 'number' ? value * scale : value.endsWith('vp') ? Number.parseFloat(value) : NaN;
  for (const scale of [1, 2]) {
    assert.ok(nativeSize(mark.fontSize, scale) <= mark.height, 'fixed status glyph fits its22vp icon budget');
    assert.equal(nativeSize(body.fontSize, scale), body.fontSize * scale, 'ordinary message text retains system font growth');
  }
  assert.ok(nativeSize(14, 2) > mark.height, 'legacy14fp status glyph exceeds its fixed icon at2x');
  assert.equal(nodes.find(node => node.type === 'Stack' && node.zIndex === 1000).hitTestBehavior, 'HitTestMode.None');
  console.log('PASS actual SDK Toast14vp status glyph,22vp paint and independent fp message growth');
  recordContractCasePass(id);
}
