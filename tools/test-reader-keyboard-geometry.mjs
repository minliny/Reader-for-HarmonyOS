import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  docked: 'Actual shared resolver: field under a docked IME, viewport and minimal reveal; stable outer width/height.',
  'native-resize': 'Actual host intersection after native resize; no second subtraction.',
  'nested-host': 'Actual nested/offset host intersection, not window-height minus child-height inference.',
  'floating-reported': 'Actual reported floating rectangles, X intersection and target-containing free lane.',
  unknown: 'Unavailable platform geometry cannot become an editing visibility receipt.',
  'no-space': 'Zero/tiny viewport and tall multiline target use explicit capacity/caret behavior.',
});
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const { ReaderRectVp: Rect, ReaderInsetsVp: Insets, ReaderKeyboardAreaVp: Area,
    ReaderWindowMetricsSnapshot: Metrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { readerKeyboardViewport: viewport, readerEditingReveal: reveal, readerControlStructureKey: structure } =
    await import('../entry/src/main/ets/ui/layout/ReaderKeyboardGeometry.ts');
  const { resolveReaderControlLayout: outer } = await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
  const metrics = () => {
    const m = new Metrics(new Rect(17, 29, 390, 800), new Rect(17, 29, 390, 800),
      new Insets(0, 24, 0, 0), new Insets(), new Insets(), new Insets(0, 0, 0, 28),
      new Insets(0, 0, 0, 300), 3.5, 1, 4, true);
    m.keyboardArea = new Area(true, true, [new Rect(0, 500, 390, 300)]);
    return m;
  };
  for (const id of selected) {
    const m = metrics(), full = new Rect(0, 0, 390, 800);
    if (id === 'docked') {
      const v = viewport(m, full);
      assert.equal(v.rect.top + v.rect.height, 500);
      assert.deepEqual(reveal(v, new Rect(20, 560, 200, 44)), { capacity: 'reveal', scrollDeltaVp: 112 });
      assert.deepEqual(reveal(v, new Rect(20, 100, 200, 44)), { capacity: 'visible', scrollDeltaVp: 0 });
      const withIme = outer(390, 800, false, m), key = structure(m, 390, 800, false);
      m.keyboardArea = new Area(true, false, []); m.keyboardInsets.bottom = 0; m.revision++;
      const withoutIme = outer(390, 800, false, m);
      for (const name of ['fullPanelHeight', 'quickPanelHeight', 'fullPanelWidth', 'dockBottomGap', 'fullPanelTop'])
        assert.equal(withIme[name], withoutIme[name], name + ' must not resize for IME');
      assert.equal(structure(m, 390, 800, false), key);
      m.systemFontScale = 1.45;
      assert.notEqual(structure(m, 390, 800, false), key);
    }
    if (id === 'native-resize') {
      const v = viewport(m, new Rect(0, 0, 390, 500));
      assert.equal(v.rect.height, 476);
      assert.equal(v.rect.top + v.rect.height, 500);
    }
    if (id === 'nested-host') {
      const v = viewport(m, new Rect(20, 200, 340, 260));
      assert.equal(v.rect.height, 260);
      assert.equal(v.occluded, false);
    }
    if (id === 'floating-reported') {
      m.keyboardArea = new Area(true, true, [new Rect(200, 300, 120, 140)]);
      assert.equal(viewport(m, full, new Rect(20, 400, 100, 44)).occluded, false);
      const v = viewport(m, full, new Rect(220, 460, 80, 44));
      assert.equal(v.rect.top, 440);
      assert.equal(reveal(v, new Rect(220, 460, 80, 44)).capacity, 'visible');
    }
    if (id === 'unknown') {
      m.keyboardArea = new Area();
      assert.equal(reveal(viewport(m, full), new Rect(20, 100, 200, 44)).capacity, 'geometry-unknown');
    }
    if (id === 'no-space') {
      assert.equal(reveal(viewport(m, new Rect(0, 300, 390, 32)),
        new Rect(20, 300, 200, 32)).capacity, 'visible', 'drop optional margin before declaring an impossible line');
      assert.equal(reveal(viewport(m, new Rect(0, 510, 390, 20)), new Rect(20, 510, 200, 44)).capacity, 'space-insufficient');
      const v = viewport(m, new Rect(0, 300, 390, 200));
      assert.equal(reveal(v, new Rect(20, 300, 200, 320), new Rect(24, 400, 1, 24)).capacity, 'caret-only');
      assert.equal(reveal(v, new Rect(20, 300, 200, 320), new Rect(24, 400, 1, 240)).capacity, 'space-insufficient');
    }
    recordContractCasePass(id);
  }
}
