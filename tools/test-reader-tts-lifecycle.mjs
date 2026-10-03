import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manager = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderTtsConfigOverlay.ets', import.meta.url), 'utf8');
const host = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlTtsContent.ets', import.meta.url), 'utf8');
const identity = manager.match(/private onIdentityChanged\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? '';
const disappear = manager.match(/aboutToDisappear\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? '';
const dismiss = host.match(/onWillDismiss: \(action: DismissContentCoverAction\): void => \{([\s\S]*?)\n        \}/)?.[1] ?? '';

assert.match(identity, /this\.stopPreview\(\)/,
  'identity replacement must stop an active preview');
assert.match(identity, /this\.generation \+= 1/,
  'identity replacement must invalidate late async callbacks');
assert.match(identity, /this\.busy = false/,
  'identity replacement must clear stale local busy state');
assert.match(identity, /this\.onBusyChange\(false\)/,
  'identity replacement must release the parent content-cover dismiss gate');
assert.match(disappear, /this\.stopPreview\(\)/);
assert.match(disappear, /this\.mounted = false/);
assert.match(disappear, /this\.generation \+= 1/);
assert.match(disappear, /this\.onBusyChange\(false\)/,
  'dismissal must release the parent busy gate');
assert.match(disappear, /this\.getUIContext\(\)\.setKeyboardAvoidMode\(this\.previousKeyboardAvoidMode\)/,
  'dismissal must restore the host keyboard mode');
assert.match(dismiss, /if \(!this\.managerBusy\)/,
  'content-cover dismissal must remain blocked while a real write is busy');
for (const method of ['submit', 'selectEngine', 'deleteEngine']) {
  const body = manager.match(new RegExp(`private ${method}\\([\\s\\S]*?\\n  \\}`, 'm'))?.[0] ?? '';
  assert.match(body, /const generation = \+\+this\.generation/,
    `${method} must capture an operation generation`);
  assert.match(body, /this\.current\(generation\)/,
    `${method} must ignore callbacks after dismissal or identity replacement`);
}
assert.match(manager, /private stopPreview\(\): void \{[\s\S]*?this\.onPreviewStop\(\);/,
  'preview teardown must notify the owning playback resource');

console.log('reader TTS manager lifecycle and dismissal gate contract: PASS');
