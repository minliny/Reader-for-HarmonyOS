import assert from 'node:assert/strict';
import { ReaderNativeAlertOwner } from './lib/reader-native-alert-sdk-probe.mjs';

for (const [id, autoCancel, slots] of [
  ['notice', true, ['primaryButton']], ['confirmation', undefined, ['primaryButton', 'secondaryButton']],
  ['confirmation-cancelable', true, ['primaryButton', 'secondaryButton']],
  ['choice-blocking', false, ['primaryButton', 'secondaryButton']], ['retry-blocking', false, ['primaryButton']],
  ['preview', undefined, ['confirm']],
]) {
  const owner = new ReaderNativeAlertOwner(), calls = [], actions = [];
  const input = { title: '原标题', message: '原内容', cancel: () => actions.push('cancel') };
  for (const slot of slots) input[slot] = { value: slot, fontColor: '#123456', action: () => actions.push(slot) };
  const lease = owner.present(options => calls.push(options), id, input, () => true), actual = calls[0];
  assert.equal(actual.title, input.title); assert.equal(actual.message, input.message);
  assert.equal(Object.hasOwn(actual, 'autoCancel'), autoCancel !== undefined); assert.equal(actual.autoCancel, autoCancel);
  assert.equal(Object.hasOwn(actual, 'width'), false); assert.equal(Object.hasOwn(actual, 'fontSize'), false);
  for (const slot of slots) { assert.equal(actual[slot].value, slot); assert.equal(actual[slot].fontColor, '#123456'); }
  actual[slots[0]].action(); actual[slots[0]].action(); actual.cancel();
  assert.deepEqual(actions, [slots[0]]); assert.equal(await lease.decision, slots[0].replace('Button', ''));
}
{
  const owner = new ReaderNativeAlertOwner(), shown = []; let current = true, writes = 0;
  const options = { title: '删除', primaryButton: { value: '取消', action() {} }, secondaryButton: { value: '删除', action() { writes++; } } };
  const old = owner.present(o => shown.push(o), 'confirmation', options, () => current);
  current = false; shown[0].secondaryButton.action(); assert.equal(await old.decision, 'retired'); assert.equal(writes, 0);
  current = true; const next = owner.present(o => shown.push(o), 'confirmation', options, () => current);
  owner.retire(); shown[1].secondaryButton.action(); assert.equal(await next.decision, 'retired'); assert.equal(writes, 0);
}
{
  const owner = new ReaderNativeAlertOwner(), shown = [], options = { primaryButton: { value: '知道了', action() {} } };
  const first = owner.present(o => shown.push(o), 'notice', options, () => true);
  const second = owner.present(o => shown.push(o), 'notice', options, () => true);
  assert.equal(await first.decision, 'retired'); shown[1].cancel(); assert.equal(await second.decision, 'cancel');
  assert.throws(() => owner.present(() => { throw Error('platform show failed'); }, 'notice', options, () => true), /platform show failed/);
  assert.throws(() => owner.present(() => {}, 'preview', options, () => true), /button slots/);
}
{
  const owner = new ReaderNativeAlertOwner(); let shown;
  const lease = owner.present(o => { shown = o; }, 'retry-blocking', {
    primaryButton: { value: '重试', action() { throw Error('domain failure'); } },
  }, () => true);
  assert.throws(() => shown.primaryButton.action(), /domain failure/); assert.equal(await lease.decision, 'primary');
}
{
  const owner = new ReaderNativeAlertOwner(); let shown, broken = false;
  const lease = owner.present(options => { shown = options; }, 'notice', {
    primaryButton: { value: 'confirm', action() { assert.fail('broken identity cannot dispatch'); } },
  }, () => { if (broken) throw Error('identity port failed'); return true; });
  broken = true;
  assert.throws(() => shown.primaryButton.action(), /identity port failed/);
  assert.equal(await lease.decision, 'native-failure', 'failed guard still settles the presentation wait');
  shown.primaryButton.action(); owner.retire();
  assert.throws(() => owner.present(() => assert.fail('no native show on failed identity'), 'notice', {
    primaryButton: { value: 'confirm' },
  }, () => { throw Error('pre-show identity unavailable'); }), /pre-show identity unavailable/);
}
// Erased ArkTS Error assertions must preserve the exact original thrown
// value, including unsupported non-Error values from an external callback.
for (const phase of ['guard-entry', 'guard-action', 'native-show']) {
  for (const thrown of ['nonError', 17, null, { original: 'foreign thrown object' }]) {
    const owner = new ReaderNativeAlertOwner(); let shown, live = true, caught;
    try {
      owner.present(options => { shown = options; if (phase === 'native-show') throw thrown; },
        'notice', { primaryButton: { value: '原按钮', action() {} } }, () => {
          if (phase === 'guard-entry' || phase === 'guard-action' && !live) throw thrown;
          return true;
        });
      if (phase === 'guard-action') { live = false; shown.primaryButton.action(); }
    } catch (error) { caught = error; }
    assert.equal(caught, thrown, `${phase}: exact original non-Error rethrow`);
  }
}
for (const [id, slots] of [
  ['notice', ['primaryButton']], ['confirmation', ['primaryButton', 'secondaryButton']],
  ['confirmation-cancelable', ['primaryButton', 'secondaryButton']],
  ['choice-blocking', ['primaryButton', 'secondaryButton']], ['retry-blocking', ['primaryButton']],
  ['preview', ['confirm']],
]) {
  const owner = new ReaderNativeAlertOwner(), action = () => {}, input = {};
  for (const slot of slots) input[slot] = { value: '原按钮', action, fontColor: '#123456',
    backgroundColor: '#654321', enabled: false, defaultFocus: true, style: 1 };
  let native;
  owner.present(options => { native = options; }, id, input, () => true);
  for (const slot of slots) {
    assert.notEqual(native[slot], input[slot], 'native guarded button remains a separate copy');
    assert.equal(input[slot].action, action, 'caller button callback is untouched');
    assert.notEqual(native[slot].action, action);
    const { action: originalAction, ...before } = input[slot];
    const { action: nativeAction, ...after } = native[slot];
    assert.deepEqual(after, before, 'all enumerable original SDK fields are preserved');
  }
}
console.log('PASS actual native Alert owner: six finite native specs, AUTO, retained button order/labels/colors, single decision, cancel/retire/reopen, stale actions and native/dispatch/identity exceptions');
