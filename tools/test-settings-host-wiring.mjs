import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(new URL('..', import.meta.url).pathname);
const index = readFileSync(resolve(repo, 'entry/src/main/ets/pages/Index.ets'), 'utf8');
const host = readFileSync(resolve(repo, 'entry/src/main/ets/features/settings/SettingsHost.ets'), 'utf8');

assert.match(index, /import \{ SettingsHost \} from ['"]\.\.\/features\/settings\/SettingsHost['"]/,
  'Index must depend on the Settings host boundary');
assert.doesNotMatch(index, /import .*SettingsOrchestrator/,
  'Index must not construct or import the Settings orchestrator');
assert.doesNotMatch(index, /private getSettingsOrchestrator\(/,
  'Index must not own Settings orchestrator construction');
for (const method of ['open', 'toggle', 'restoreDefaults']) {
  assert.match(host, new RegExp(`\\b${method}\\(`), `SettingsHost must expose ${method}`);
}
const orchestrator = readFileSync(resolve(repo, 'entry/src/main/ets/features/settings/SettingsOrchestrator.ets'), 'utf8');
assert.match(host, /SettingsOrchestrator\.forRuntime\(owner, this\.context\(\)\)/, 'SettingsHost resolves the finite Runtime owner');
assert.equal((orchestrator.match(/new SettingsOrchestrator\(/g) ?? []).length, 1, 'only the finite Runtime factory constructs the business orchestrator');
assert.match(orchestrator, /owners: WeakMap<ReaderRuntimeOwner, SettingsOrchestrator>/, 'one warm business owner per actual Runtime');
assert.match(host, /getUIAbilityContext\(\)/,
  'SettingsHost must resolve the UI context lazily at first use');
for (const call of ['settingsHost.open()', 'settingsHost.toggle(']) {
  assert.ok(index.includes(`this.${call}`), `Index must forward ${call}`);
}
console.log('Settings host wiring: PASS (Index dispatch boundary and lazy context ownership)');

assert.match(index, /isCurrentSettingsPresentation\(generation, owner, mounting, host\) \? host\.restoreDefaults\(\) : Promise\.resolve\(false\)/, 'retained reset invokes only captured current Settings owner');
