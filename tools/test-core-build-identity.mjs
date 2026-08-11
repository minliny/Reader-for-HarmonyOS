import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const owner = readFileSync('entry/src/main/ets/app/ReaderRuntimeOwner.ts', 'utf8');
const smoke = readFileSync('entry/vendor/core-harmony/sdk/smoke_report.ts', 'utf8');

const capabilities = owner.indexOf("runtime.request('runtime.setHostCapabilities'");
const coreInfo = owner.indexOf("runtime.request('core.info'");
const publish = owner.indexOf('this.runtime = runtime');
assert.ok(capabilities >= 0 && coreInfo > capabilities && publish > coreInfo,
  'startup must validate core.info identity before publishing the runtime');
assert.match(owner, /requireCoreBuildIdentity\(coreInfo\.data\['buildIdentity'\]\)/);
assert.match(owner, /Core build identity: %\{public\}s/);
assert.match(owner, /schemaVersion.*buildId.*gitCommit.*gitDirty.*cargoLockSha256.*protocolSha256.*rustProfile/s);
assert.match(smoke, /buildCoreInfoCheck/);
assert.match(smoke, /isCoreBuildIdentity/);
assert.match(smoke, /\^\[0-9a-f\]\+\$/);

console.log('core build identity startup contract: PASS');
