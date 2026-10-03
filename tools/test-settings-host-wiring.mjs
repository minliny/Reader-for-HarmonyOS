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
assert.match(host, /new SettingsOrchestrator\(/,
  'SettingsHost must be the single SettingsOrchestrator construction site');
assert.match(host, /getUIAbilityContext\(\)/,
  'SettingsHost must resolve the UI context lazily at first use');
for (const call of ['settingsHost.open()', 'settingsHost.toggle(', 'settingsHost.restoreDefaults()']) {
  assert.ok(index.includes(`this.${call}`), `Index must forward ${call}`);
}
console.log('Settings host wiring: PASS (Index dispatch boundary and lazy context ownership)');
