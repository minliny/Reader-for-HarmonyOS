import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderContinuousViewport,
  type ReaderContinuousViewportFragment } from '../../entry/src/main/ets/features/reading/ui/ReaderContinuousViewport.ts';

const paragraph: ReaderContinuousViewportFragment = {
  id: 'text', startScalar: 0, endScalar: 8, isParagraphStart: true, nativeParagraph: { key: 'measured' },
};
const image: ReaderContinuousViewportFragment = {
  id: 'image', startScalar: 9, endScalar: 10, isParagraphStart: true,
};

test('initial scroll uses the real chapter head and leaves an exact receipt unprotected', () => {
  const viewport = new ReaderContinuousViewport<ReaderContinuousViewportFragment>();
  assert.equal(viewport.allowSemanticReport, false);
  viewport.beginInitialScroll();
  const generation = viewport.initialGeneration;
  assert.equal(viewport.canIssueInitialScroll(generation), false);
  assert.equal(viewport.listIndex([paragraph, image], 0, () => 0, () => true), 0);
  assert.equal(viewport.listIndex([paragraph, image], 0, () => 0.5, () => true), 1);
  const target = viewport.initialTarget([paragraph, image], 99, () => 0.6, () => 12);
  assert.deepEqual(target, { fragment: image, progress: 0.6, scalar: 10, paragraphSpace: 12 });
  viewport.setInitialCommand(2, 14, target.paragraphSpace, () => true);
  assert.equal(viewport.initialOffset, 26);
  assert.equal(viewport.canIssueInitialScroll(generation), true);
  viewport.markInitialScrollIssued();
  assert.equal(viewport.canIssueInitialScroll(generation), false);
  assert.equal(viewport.canConfirmInitialScroll(generation), true);
  assert.equal(viewport.admitInitialGeometry({ y: -6, height: 50 }, () => 20,
    () => assert.fail('an exact receipt must not read the end status'), () => 100), 'exact');
  assert.equal(viewport.allowSemanticReport, true);
});

test('EOF clamp protects the canonical line until observed movement and a pointer retires an old receipt', () => {
  const viewport = new ReaderContinuousViewport<ReaderContinuousViewportFragment>();
  viewport.beginInitialScroll();
  viewport.setInitialCommand(1, 14, 10, () => true);
  const generation = viewport.initialGeneration;
  viewport.markInitialScrollIssued();
  assert.equal(viewport.admitInitialGeometry({ y: 40, height: 20 }, () => 20, () => true, () => 100), undefined);
  assert.equal(viewport.admitInitialGeometry({ y: 40, height: 70 }, () => 20, () => false, () => 100), undefined);
  assert.equal(viewport.admitInitialGeometry({ y: 40, height: 70 }, () => 20, () => true, () => 100), 'clamped');
  assert.equal(viewport.initialPending, false);
  assert.equal(viewport.allowSemanticReport, false);
  viewport.cancelInitialForInput();
  assert.equal(viewport.canConfirmInitialScroll(generation), false);
  assert.equal(viewport.allowSemanticReport, false);
  viewport.admitListMovement();
  assert.equal(viewport.allowSemanticReport, true);

  viewport.beginInitialScroll();
  viewport.setInitialCommand(1, 10, 0, () => false);
  viewport.markInitialScrollIssued();
  const nextGeneration = viewport.initialGeneration;
  viewport.retireInitialReceipt();
  assert.equal(viewport.canConfirmInitialScroll(nextGeneration), false);
});

test('visible text requires the current paragraph lease and image progress uses the real row span', () => {
  const viewport = new ReaderContinuousViewport<ReaderContinuousViewportFragment>();
  const fragments = [paragraph, image];
  viewport.reindex(fragments);
  assert.deepEqual(viewport.updateVisibleItems(2, 2, 9, 1), { start: 1, end: 1 });
  const rect = { y: -40, height: 100 };
  const readProgress = () => viewport.progressForVisibleRow(paragraph, 0, rect, () => 20, () => 15);
  assert.equal(readProgress(), undefined);
  viewport.acceptParagraphPosition('text', 'stale', { scalarForY: () => 8 }, () => fragments);
  assert.equal(readProgress(), undefined);
  viewport.acceptParagraphPosition('text', 'measured', { scalarForY(y) { assert.equal(y, 60); return 2; } }, () => fragments);
  viewport.acceptParagraphPosition('text', 'stale', undefined, () => assert.fail('removal never reads fragments'));
  assert.equal(readProgress(), 0.25);
  viewport.acceptParagraphPosition('text', 'measured', undefined, () => assert.fail('removal never reads fragments'));
  assert.equal(readProgress(), undefined);
  assert.equal(viewport.progressForVisibleRow(image, 1, rect, () => 20, () => 15), 0.45);
});

test('image reflow corrects cached row coordinates while retaining actual scroll and rejecting old callbacks', () => {
  const viewport = new ReaderContinuousViewport<ReaderContinuousViewportFragment>();
  viewport.reindex([paragraph, image]);
  viewport.updateVisibleItems(2, 1, 1, 0);
  const old = viewport.captureImageAnchor('image', { y: 10, height: 100 }, () => 60);
  viewport.retireImageAnchor();
  const current = viewport.captureImageAnchor('image', { y: 10, height: 100 }, () => 60);
  assert.equal(viewport.consumeImageAnchor(old), undefined);
  viewport.accumulateImageScroll(-15);
  viewport.reindex([{ ...paragraph, id: 'prefix' }, paragraph, image]);
  viewport.retainVisibleRows('image', 3);
  assert.equal(viewport.visibleStart, 2);
  assert.equal(viewport.consumeImageAnchor(current), 2);
  assert.equal(viewport.imageAnchorDelta(current, { y: 15, height: 140 }), 10);
  assert.equal(viewport.consumeImageAnchor(current), undefined);
});
