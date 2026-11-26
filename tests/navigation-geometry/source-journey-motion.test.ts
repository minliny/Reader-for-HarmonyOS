import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readerConditionalSceneMotion, readerRouteMotionPose } from '../../entry/src/main/ets/app/navigation/ReaderRouteMotionModel.ts';
import { sourceV9BlocksOuterBackPreview, sourceV9ForegroundPane, sourceV9ParentView }
  from '../../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts';

test('source import, subscriptions and groups each enter and exit on the same right edge', () => {
  assert.equal(sourceV9ForegroundPane('list'), undefined);
  assert.equal(sourceV9ForegroundPane('login'), undefined);
  for (const pane of ['import', 'subscriptions', 'groups'] as const) {
    assert.equal(sourceV9ForegroundPane(pane), pane);
    assert.equal(sourceV9ParentView(pane), 'list');
    assert.equal(sourceV9BlocksOuterBackPreview(pane, false), true);
    const motion = readerConditionalSceneMotion(true);
    assert.deepEqual(motion, { enter: 'push', exit: 'pop' });
    assert.equal(readerRouteMotionPose('push', 'child', 320, 0), 320);
    assert.equal(readerRouteMotionPose('push', 'child', 320, 1), 0);
    assert.equal(readerRouteMotionPose('pop', 'child', 320, 0), 0);
    assert.equal(readerRouteMotionPose('pop', 'child', 320, 1), 320);
  }
});

test('group detail Back reveals the same group scene and list overlays own Back before the app stack', () => {
  assert.equal(sourceV9ParentView('group-detail'), 'groups');
  assert.equal(sourceV9ForegroundPane('group-detail'), sourceV9ForegroundPane('groups'));
  assert.deepEqual(readerConditionalSceneMotion(true, true), { enter: 'none', exit: 'none' });
  assert.equal(sourceV9BlocksOuterBackPreview('group-detail', false), true);
  assert.equal(sourceV9BlocksOuterBackPreview('list', true), true);
  assert.equal(sourceV9BlocksOuterBackPreview('list', false), false);
});
