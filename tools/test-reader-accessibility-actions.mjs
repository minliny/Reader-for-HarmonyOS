import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectedProductionClasses, selectedProductionMethods } from './lib/selected-production-methods.mjs';

const root = new URL('../entry/src/main/ets/', import.meta.url);
function fixture(version, capability = true) {
  const calls = [];
  const { ReaderAccessibilityActions } = selectedProductionClasses(
    new URL('ui/controls/ReaderAccessibilityActions.ets', root), ['ReaderAccessibilityActions'], {
      deviceInfo: { distributionOSApiVersion: version, apiAvailable: sdk => { calls.push(sdk); return capability; } },
    });
  const attribute = {
    accessibilityCustomActions: actions => calls.push(actions),
    accessibilityNextFocusId: (id, options) => calls.push({ id, options }),
  };
  return { ReaderAccessibilityActions, attribute, calls };
}

test('API 23 and 24 preserve baseline accessibility; API 26 still verifies the system probe', () => {
  for (const version of [60100, 60101, 260000]) {
    const f = fixture(version, false);
    new f.ReaderAccessibilityActions([{ label: '下一章', run() {} }], 'next', () => true).applyNormalAttribute(f.attribute);
    assert.deepEqual(f.calls, version === 260000 ? ['26.0.0'] : []);
  }
});

test('enhanced directory actions and focus use the current directory opening', () => {
  const f = fixture(260000);
  const Toolbar = selectedProductionMethods(new URL('features/reading/ui/ReaderDirectoryToolbar.ets', root),
    'ReaderDirectoryToolbar', ['directoryAccessibility', 'currentDirectoryInput'], f);
  const invoked = [];
  const toolbar = Object.assign(new Toolbar(), {
    directoryMounted: true, directoryFocusId: 'query-2', directoryFocusAllowed: true, actionEnabled: true,
    showChapterTools: true, locateEnabled: true, variant: 'standard', directoryFocusCurrent: () => true,
    onLocateCurrent: () => invoked.push('locate'), onTop: () => invoked.push('top'), onBottom: () => invoked.push('bottom'),
  });
  const modifier = toolbar.directoryAccessibility('sort');
  modifier.applyNormalAttribute(f.attribute);
  const actions = f.calls[1];
  assert.deepEqual(actions.map(action => action.name), ['定位当前章节', '回到目录顶部', '前往目录底部']);
  assert.deepEqual(f.calls[2], { id: 'query-2', options: { isConsiderDescendants: true } });
  actions[0].onAction();
  toolbar.directoryFocusId = 'query-3';
  actions[1].onAction();
  modifier.applyNormalAttribute(f.attribute);
  assert.equal(f.calls.at(-2), undefined);
  assert.equal(f.calls.at(-1).id, '');
  assert.deepEqual(invoked, ['locate']);
});
