import { readFileSync } from 'node:fs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { actualReaderPostLayoutFrame } from './reader-post-layout-frame-probe.mjs';

/** Actual SDK-emitted adapters; callers supply the explicit native ports. */
export function readerEditingSdk({ foreground = () => true } = {}) {
  const read = name => readFileSync(new URL('../../entry/src/main/ets/ui/layout/' + name, import.meta.url), 'utf8');
  const metrics = pureModuleProbe(read('../foundation/ReaderWindowMetrics.ts'), 'ReaderWindowMetrics.ts', {},
    ['ReaderRectVp', 'readerInteractiveSafeTop', 'readerInteractiveSafeBottom']);
  const { ReaderRectVp } = metrics;
  const geometry = pureModuleProbe(read('ReaderKeyboardGeometry.ts'), 'ReaderKeyboardGeometry.ts', metrics,
    ['readerKeyboardViewport', 'readerEditingReveal', 'readerKeyboardHostBottom']);
  const { ReaderEditingVisibility } = pureModuleProbe(read('ReaderEditingVisibility.ts'), 'ReaderEditingVisibility.ts',
    geometry, ['ReaderEditingVisibility']);
  const target = pureModuleProbe(read('ReaderEditableTarget.ets'), 'ReaderEditableTarget.ets', {
    ReaderRectVp, ReaderPostLayoutFrame: actualReaderPostLayoutFrame(), KeyCode: { KEYCODE_BACK: 2 },
    KeyType: { Down: 0 }, AppStorage: { get: foreground }, DEBUG: false, hilog: { info() {} },
  }, ['ReaderEditableTarget', 'ReaderEditableInputModifier', 'ReaderEditableAreaModifier']);
  const scroll = pureModuleProbe(read('ReaderEditingScrollBinding.ets'), 'ReaderEditingScrollBinding.ets', {
    ReaderRectVp, AppStorage: { get: foreground },
    readerWindowMetrics: () => { throw new Error('native host metrics must be supplied by the selected test'); },
  }, ['ReaderEditingScrollBinding']);
  return { ReaderEditingVisibility, readerKeyboardHostBottom: geometry.readerKeyboardHostBottom,
    ...target, ...scroll, TextAreaController: class {} };
}
