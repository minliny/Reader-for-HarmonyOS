import { readFileSync } from 'node:fs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';

/** Actual platform adapter with only the abstract native callback base replaced. */
export function actualReaderPostLayoutFrame() {
  const source = readFileSync(new URL('../../entry/src/main/ets/ui/layout/ReaderPostLayoutFrame.ets', import.meta.url), 'utf8');
  return pureModuleProbe(source, 'ReaderPostLayoutFrame.ets', { FrameCallback: class {} }, ['ReaderPostLayoutFrame']).ReaderPostLayoutFrame;
}

/** Complete no-op fallbacks after an explicitly idle-eligible fixture frame.
 * Ordinary owner continuations remain queued for their independent next frame.
 * Frame-starvation regressions use the full queue and never call this helper.
 */
export function drainReaderPostLayoutFallbacks(queue) {
  for (let index = 0; index < queue.length;) {
    if (queue[index].constructor.name !== 'ReaderPostLayoutFallbackFrame') {
      index += 1;
      continue;
    }
    const [fallback] = queue.splice(index, 1);
    fallback.onFrame(0);
  }
}
