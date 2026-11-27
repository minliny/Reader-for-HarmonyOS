import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderNavigation } from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderDetailSceneTransition, readerConditionalSceneMotion, readerDetailSceneOpacity, readerRouteMotionPose }
  from '../../entry/src/main/ets/app/navigation/ReaderRouteMotionModel.ts';
import type { ReaderRuntimeOwner } from '../../entry/src/main/ets/app/ReaderRuntimeOwner';

const width = 400;

test('book information pushes from the reader and Back restores the admitted reader as a pop', () => {
  const navigation = new ReaderNavigation();
  const owner = Object.create(null) as ReaderRuntimeOwner;
  navigation.show('detail');
  navigation.show('reading');
  const context = { owner, originRoute: 'bookshelf', detailParent: 'bookshelf', fromDownloads: false } as const;
  navigation.returns.requestBookInfoAfterExit({ readerIdentity: 'r1', request: () => {} }, 'local\u0000book', context);
  navigation.returns.dispatchAcceptedReaderExit('r1', 'local\u0000book', owner, {
    claimSystemFileExit: () => false, deliverSystemFile: assert.fail, openDownloads: assert.fail,
    showReaderDetail: () => { navigation.advance(); navigation.showReadingOrigin(); },
    afterReaderDetail: assert.fail, openRules: assert.fail, returnFromDetail: assert.fail,
    returnFromBookshelfPreparation: assert.fail, returnToReadingOrigin: assert.fail,
  });
  assert.equal(navigation.snapshot().route, 'detail');
  assert.equal(navigation.routeMotion(), 'push');
  navigation.returnFromDetail(owner, {
    resumeReader: () => {
      const restored = navigation.returns.restoreReaderBehindDetail(candidate => {
        assert.equal(candidate, context);
        navigation.returns.restoreReaderReturn(context, assert.fail);
        return true;
      });
      assert.equal(restored, true);
      navigation.advance();
      navigation.show('reading', restored ? 'pop' : undefined);
    },
    leaveForSearch: assert.fail, restoreSearch: assert.fail, showBookshelf: assert.fail, showDiscover: assert.fail,
  });
  assert.equal(navigation.snapshot().route, 'reading');
  assert.equal(navigation.routeMotion(), 'pop');
  assert.equal(navigation.returns.snapshot().readingOrigin, 'bookshelf');
  assert.equal(navigation.returns.restoreReaderBehindDetail(assert.fail), false);
});

test('back after a steady detail sends detail right and returns the lower reader from parallax', () => {
  const scene = new ReaderDetailSceneTransition();
  const push = scene.open(true);
  assert.equal(readerRouteMotionPose('push', 'child', width, push.coverage), 400);
  assert.equal(scene.sample(push.generation, 0.5)?.coverage, 0.5);
  const covered = scene.settle(push.generation);
  assert.equal(covered?.phase, 'covered');
  assert.equal(covered?.coverage, 1);
  const pop = scene.back();
  assert.ok(pop);
  assert.equal(pop.phase, 'pop');
  const detail: number[] = [], reader: number[] = [];
  for (const fraction of [0, 0.25, 0.5, 1]) {
    const coverage = scene.sample(pop.generation, fraction)?.coverage ?? -1;
    detail.push(readerRouteMotionPose('push', 'child', width, coverage));
    reader.push(readerRouteMotionPose('push', 'parent', width, coverage));
  }
  assert.deepEqual(detail, [0, 100, 200, 400]);
  assert.deepEqual(reader.map(value => value + 0), [-64, -48, -32, 0]);
  const retired = scene.settle(pop.generation);
  assert.ok(retired);
  assert.equal(retired.phase, 'retired');
  assert.equal(readerRouteMotionPose('push', 'child', width, retired.coverage), 400);
  assert.equal(readerRouteMotionPose('push', 'parent', width, retired.coverage) + 0, 0);
  assert.equal(scene.sample(pop.generation, 0.2), retired);
  assert.equal(scene.settle(pop.generation), retired);
  assert.equal(scene.back(), retired);
  const reopened = scene.open(true);
  assert.equal(scene.settle(retired.generation), reopened);
  assert.equal(scene.sample(pop.generation, 1), reopened);
});

test('back during a push reverses detail from its sampled position and discards the old finish', () => {
  for (const interruptedAt of [0, 0.25, 0.9]) {
    const scene = new ReaderDetailSceneTransition();
    const push = scene.open(true);
    const partial = scene.sample(push.generation, interruptedAt);
    const pop = scene.back();
    assert.ok(partial && pop);
    assert.equal(pop.phase, 'pop');
    assert.equal(pop.coverage, interruptedAt);
    assert.equal(scene.settle(push.generation), pop);
    const outward = scene.sample(pop.generation, 0.5);
    assert.ok(outward);
    assert.ok(readerRouteMotionPose('push', 'child', width, outward.coverage) >=
      readerRouteMotionPose('push', 'child', width, partial.coverage));
    assert.equal(scene.sample(pop.generation, 0.1)?.coverage, outward.coverage);
    const retired = scene.settle(pop.generation);
    assert.ok(retired);
    assert.equal(retired.phase, 'retired');
    assert.equal(readerRouteMotionPose('push', 'child', width, retired.coverage), 400);
  }
});

test('side swipe cancel moves back to detail, while a committed swipe continues from the finger position', () => {
  const scene = new ReaderDetailSceneTransition();
  scene.open(false);
  const first = scene.preview(width);
  assert.ok(first);
  assert.equal(scene.previewViewportMatches(width), true);
  assert.equal(scene.previewViewportMatches(width + 2), false);
  scene.updatePreview(first.generation, 80);
  assert.equal(scene.shouldCommitPreview(), false);
  const cancel = scene.cancelPreview();
  assert.ok(cancel);
  assert.equal(cancel.phase, 'cancel');
  assert.equal(cancel.coverage, 0.8);
  assert.ok((scene.sample(cancel.generation, 0.4)?.coverage ?? 0) > cancel.coverage);
  assert.equal(scene.settle(cancel.generation)?.coverage, 1);

  const second = scene.preview(width);
  assert.ok(second);
  scene.updatePreview(second.generation, 160);
  assert.equal(scene.shouldCommitPreview(), true);
  const pop = scene.back();
  assert.ok(pop);
  assert.equal(pop.coverage, 0.6);
  assert.equal(scene.cancelPreview(), undefined);
  assert.equal(scene.updatePreview(second.generation, 20), pop);
  assert.equal(scene.sample(pop.generation, 0.5)?.coverage, 0.3);
});

test('reduced-motion detail Back settles invisible at the same horizontal position', () => {
  const scene = new ReaderDetailSceneTransition();
  const steady = scene.open(false);
  const pop = scene.back();
  assert.ok(pop);
  const retired = scene.settle(pop.generation);
  assert.ok(retired);
  assert.equal(retired.phase, 'retired');
  assert.equal(readerRouteMotionPose('push', 'child', width, steady.coverage, true), 0);
  assert.equal(readerRouteMotionPose('push', 'child', width, retired.coverage, true), 0);
  assert.equal(readerDetailSceneOpacity(retired.coverage, true), 0);
});

test('conditional children use push and pop; the retained parent and reduced motion suppress translation', () => {
  assert.deepEqual(readerConditionalSceneMotion(true), { enter: 'push', exit: 'pop' });
  assert.deepEqual(readerConditionalSceneMotion(true, true), { enter: 'none', exit: 'none' });
  assert.deepEqual(readerConditionalSceneMotion(false), { enter: 'none', exit: 'none' });
  for (const role of ['child', 'parent'] as const) {
    assert.equal(readerRouteMotionPose('push', role, width, 0.4, true), 0);
    assert.equal(readerRouteMotionPose('pop', role, width, 0.4, true), 0);
  }
  assert.equal(readerDetailSceneOpacity(0.75, true), 0.75);
  assert.equal(readerDetailSceneOpacity(0.75, false), 1);
  assert.equal(readerRouteMotionPose('pop', 'child', width, 0.4), 160);
});
