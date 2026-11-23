import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  reveal: 'Actual visibility owner: native-text reveal then minimal existing-host scroll, bounded observations.',
  'retired-target': 'Actual visibility owner: delayed old field cannot scroll its successor.',
  'back-cancel': 'Actual visibility owner: Back cancels pending frames without keyboard/focus operations.',
  translation: 'Actual visibility owner: limited fallback translation requires a final observed position.',
  'no-space': 'Actual visibility owner: impossible editing region is explicit and does not loop.',
  'task-context': 'Actual owner: an already visible query still reveals its module result region; an impossible task minimum cannot fall back to a caret.',
  'inactive-layout': 'Actual owner releases a pending slot on a real inactive receipt, then admits a new foreground event; scheduler failure remains unknown.',
  'native-adapter': 'Actual SDK-emitted input adapter: transformed window vp, caret-local px conversion, composed events and retired post-layout delivery.',
  'scroll-scope': 'Actual SDK scroll binding: scoped native IDs and old opening teardown cannot detach the successor host.',
});
if (selected.length) {
  registerHooks({ resolve(s, c, n) {
    if (s.startsWith('.') && !/\.[a-z]+$/i.test(s)) {
      const u = new URL(s + '.ts', c.parentURL);
      if (existsSync(fileURLToPath(u))) return n(u.href, c);
    }
    return n(s, c);
  } });
  const { ReaderEditingVisibility } = await import('../entry/src/main/ets/ui/layout/ReaderEditingVisibility.ts');
  const { ReaderRectVp: Rect, ReaderKeyboardAreaVp: Area, ReaderWindowMetricsSnapshot: Metrics } =
    await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  for (const id of selected) {
    if (id === 'scroll-scope') {
      const { readerEditingSdk } = await import('./lib/reader-editing-sdk-probe.mjs');
      const { ReaderEditingScrollBinding } = readerEditingSdk();
      const binding = new ReaderEditingScrollBinding('root');
      let previous, next, detached = 0;
      const context = {};
      binding.mount(context, { mount(value) { previous = value; }, unmount() { detached++; } }, {}, () => 0, 'old');
      binding.mount(context, { mount(value) { next = value; }, unmount() { detached++; } }, {}, () => 0, 'next');
      assert.equal(previous.current(), false); assert.equal(next.current(), true);
      assert.notEqual(binding.idFor('old'), binding.idFor('next'));
      binding.unmount('old'); assert.equal(detached, 0); assert.equal(next.current(), true);
      binding.unmount('next'); assert.equal(detached, 1); assert.equal(next.current(), false);
      recordContractCasePass(id); continue;
    }
    if (id === 'native-adapter') {
      const { readerEditingSdk } = await import('./lib/reader-editing-sdk-probe.mjs');
      let foreground = true;
      const sdk = readerEditingSdk({ foreground: () => foreground }), target = new sdk.ReaderEditableTarget(), nativeFrames = [], scrolls = [], edits = [];
      let accepted = true, delivered = 0;
      const context = {
        px2vp: value => value / 3.5,
        getFrameNodeById: () => ({ getPositionToWindowWithTransform: () => ({ x: 12, y: 34 }) }),
        getComponentUtils: () => ({ getRectangleById: () => ({
          size: { width: 700, height: 112 }, scale: { x: 1, y: 1 }, rotate: { angle: 0 },
        }) }),
        postFrameCallback: callback => nativeFrames.push(callback),
        getFocusController() { assert.fail('visibility cannot own focus'); },
      };
      const controller = {
        getCaretOffset: () => ({ index: 7, x: 35, y: 70 }),
        scrollToVisible: range => scrolls.push(range),
      };
      target.mount(context, undefined, controller, () => accepted, 24);
      const events = {};
      const native = Object.fromEntries(['id', 'onEditChange', 'onAreaChange', 'onTextSelectionChange', 'onContentScroll', 'onKeyPreIme']
        .map(name => [name, value => { events[name] = value; }]));
      new sdk.ReaderEditableInputModifier(target, target.id, value => { target.edit(value); edits.push(value); }).applyNormalAttribute(native);
      events.onEditChange(true);
      assert.deepEqual(edits, [true]);
      const measured = target.measure();
      assert.deepEqual({ ...measured.field }, { left: 12, top: 34, width: 200, height: 32 });
      assert.deepEqual({ ...measured.caret }, { left: 22, top: 54, width: 1, height: 24 });
      target.mount(context, undefined, controller, () => accepted, 24, target.id,
        field => new Rect(field.left, field.top, field.width, 120));
      target.edit(true); assert.equal(target.measure().context.height, 120, 'module context is read at the native position');
      target.mount(context, undefined, controller, () => accepted, 24, target.id, () => undefined);
      target.edit(true); assert.equal(target.measure(), undefined, 'pending module geometry cannot claim input-only visibility');
      target.mount(context, undefined, controller, () => accepted, 24); target.edit(true);
      target.revealText(); assert.deepEqual(scrolls, [{ start: 7, end: 7 }]);
      foreground = false; assert.equal(target.current(), false); foreground = true;
      events.onAreaChange(); events.onTextSelectionChange(); events.onContentScroll();
      target.afterLayout(() => delivered++);
      const previousEvents = { ...events }, previousId = target.id, successorId = target.id + ':next';
      target.mount(context, undefined, controller, () => accepted, 24, successorId);
      new sdk.ReaderEditableInputModifier(target, successorId, value => { target.edit(value); edits.push(value); }).applyNormalAttribute(native);
      events.onEditChange(true); previousEvents.onEditChange(false);
      assert.deepEqual(edits, [true, true], 'late old native blur cannot retire the successor');
      target.unmount(previousId); assert.equal(target.current(), true, 'late old native teardown is scoped');
      target.unmount(); accepted = false;
      while (nativeFrames.length) { const frame = nativeFrames.shift(); frame.onFrame(0); frame.onIdle(0); }
      assert.equal(delivered, 0, 'retired layout cannot follow a successor');
      recordContractCasePass(id);
      continue;
    }
    const owner = new ReaderEditingVisibility(), frames = [], calls = [];
    const metrics = new Metrics(); metrics.ready = true; metrics.windowRect = new Rect(0, 0, 390, 800);
    metrics.keyboardArea = new Area(true, true, [new Rect(0, 500, 390, 300)]);
    let y = 560, current = true;
    const target = { id: 'actual-field-port', current: () => current,
      measure: () => ({ field: new Rect(20, y, 200, 44), caret: new Rect(25, y, 1, 24) }),
      revealText: () => calls.push('native-text'), afterLayout: action => { frames.push(action); return true; } };
    const host = { current: () => current, metrics: () => metrics, viewport: () => new Rect(0, 0, 390, 800),
      scroll(delta) { calls.push(['scroll', delta]); if (id !== 'translation' && id !== 'no-space') y -= delta; },
      translate(delta) { calls.push(['translate', delta]); if (id !== 'no-space') y -= delta; } };
    if (id === 'task-context') {
      y = 430;
      target.measure = () => ({ field: new Rect(20, y, 200, 44), caret: new Rect(25, y, 1, 24),
        context: new Rect(10, y, 300, 120) });
    }
    owner.mount(host); owner.focus(target);
    if (id === 'inactive-layout') {
      current = false; frames.shift()(); assert.deepEqual(calls, []);
      current = true; owner.refresh();
    }
    if (id === 'back-cancel') owner.dismiss();
    if (id === 'retired-target') { owner.focus({ ...target, id: 'successor', current: () => false }); }
    if (id === 'no-space') { host.viewport = () => new Rect(0, 510, 390, 0); target.measure = () => undefined; }
    let turns = 0;
    while (frames.length) { assert(++turns <= 6, 'no polling loop'); frames.shift()(); }
    if (id === 'reveal' || id === 'inactive-layout') { assert.deepEqual(calls, ['native-text', ['scroll', 112]]); assert.equal(owner.capacity, 'visible'); }
    if (id === 'translation') {
      assert.deepEqual(calls, ['native-text', ['scroll', 112], ['translate', 112]]);
      assert.equal(owner.capacity, 'visible');
    }
    if (id === 'back-cancel' || id === 'retired-target') assert.deepEqual(calls, []);
    if (id === 'no-space') { assert.deepEqual(calls, ['native-text']); assert.equal(owner.capacity, 'space-insufficient'); }
    if (id === 'task-context') {
      assert.deepEqual(calls, ['native-text', ['scroll', 58]], 'query alone was visible but its results were covered');
      assert.equal(owner.capacity, 'visible');
      calls.length = 0;
      target.measure = () => ({ field: new Rect(20, 30, 200, 44), caret: new Rect(25, 30, 1, 24),
        context: new Rect(10, 30, 300, 600) });
      owner.refresh();
      while (frames.length) frames.shift()();
      assert.deepEqual(calls, ['native-text']);
      assert.equal(owner.capacity, 'space-insufficient', 'semantic search minimum cannot degrade to the query caret');
    }
    owner.unmount(); current = false;
    recordContractCasePass(id);
  }
  console.log('Boundary: actual production geometry/owner with finite native layout/Scroller ports; no native editing or VM.');
}
