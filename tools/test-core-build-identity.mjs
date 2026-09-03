import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const owner = readFileSync('entry/src/main/ets/app/ReaderRuntimeOwner.ts', 'utf8');
const smoke = readFileSync('entry/vendor/core-harmony/sdk/smoke_report.ts', 'utf8');

const capabilities = owner.indexOf("runtime.request('runtime.setHostCapabilities'");
const coreInfo = owner.indexOf("runtime.request('core.info'");
const sourceSwitchRecover = owner.indexOf("runtime.request('source.switch.recover'");
const publish = owner.indexOf('this.runtime = runtime');
assert.ok(capabilities >= 0 && coreInfo > capabilities && sourceSwitchRecover > coreInfo &&
  publish > sourceSwitchRecover,
  'startup must validate identity and recover pending source switches before publishing the runtime');
assert.match(owner, /requireCoreBuildIdentity\(coreInfo\.data\['buildIdentity'\]\)/);
assert.match(owner, /Core build identity: %\{public\}s/);
assert.match(owner, /schemaVersion.*buildId.*gitCommit.*gitDirty.*cargoLockSha256.*protocolSha256.*rustProfile/s);
assert.match(owner, /requireSourceSwitchRecoveryCount\(recovery\.data\['recovered'\]\)/);
assert.match(owner, /transaction\['phase'\] !== 'rolledBack'/);
assert.match(smoke, /buildCoreInfoCheck/);
assert.match(smoke, /isCoreBuildIdentity/);
assert.match(smoke, /\^\[0-9a-f\]\+\$/);

console.log('core build identity startup contract: PASS');
