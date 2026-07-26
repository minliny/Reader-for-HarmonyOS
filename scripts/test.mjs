// test.mjs — compile-only readiness gate for the real on-device ArkTS suite.
//
// ArkTS assertions must run through `hvigorw onDeviceTest`, which installs the
// generated `ohosTest` HAP and invokes Hypium on an unlocked device. The
// previous `hvigorw test` command only compiled local UnitTest output on this
// macOS host and could hang without producing fresh results. It must never be
// interpreted as a test pass.
//
// This gate intentionally does only two things that are meaningful without a
// device: validate the Stage ohosTest wiring and compile the test HAP. The
// actual assertion gate is `npm run test:arkts-device`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEVECO = '/Applications/DevEco-Studio.app/Contents';
const REQUIRED = [
  ['entry/build-profile.json5', '"name": "ohosTest"'],
  ['entry/src/ohosTest/module.json5', '"name": "entry_test"'],
  ['entry/src/ohosTest/module.json5', '"mainElement": "TestAbility"'],
  ['entry/src/ohosTest/ets/testrunner/OpenHarmonyTestRunner.ets', '@ohos/hypium'],
  ['entry/src/ohosTest/ets/testrunner/OpenHarmonyTestRunner.ets', 'Hypium.hypiumTest'],
  ['entry/src/ohosTest/ets/testrunner/OpenHarmonyTestRunner.ets', 'abilityDelegatorRegistry'],
  ['entry/src/ohosTest/ets/test/List.test.ets', "../../../test/List.test"],
  ['entry/src/test/List.test.ets', 'export default'],
];

function fail(message) {
  console.error(`✗ ArkTS test-package gate: ${message}`);
  process.exit(1);
}

for (const [relativePath, expected] of REQUIRED) {
  const absolutePath = path.join(REPO, relativePath);
  if (!fs.existsSync(absolutePath)) fail(`missing ${relativePath}`);
  if (!fs.readFileSync(absolutePath, 'utf8').includes(expected)) {
    fail(`${relativePath} is missing required wiring: ${expected}`);
  }
}

const env = {
  ...process.env,
  DEVECO_SDK_HOME: process.env.DEVECO_SDK_HOME || DEVECO,
  JAVA_HOME: process.env.JAVA_HOME || `${DEVECO}/jbr/Contents/Home`,
  PATH: `${DEVECO}/tools/node/bin:${DEVECO}/tools/ohpm/bin:${process.env.JAVA_HOME || `${DEVECO}/jbr/Contents/Home`}/bin:${process.env.PATH}`,
};

console.log('→ Compiling the Stage ohosTest HAP (no assertions are claimed on this host)...');
const compiled = spawnSync('./hvigorw', [
  'assembleHap',
  '--mode', 'module',
  '-p', 'module=entry@ohosTest',
  '--no-daemon',
], {
  cwd: REPO,
  env,
  stdio: 'inherit',
});
if (compiled.status !== 0) fail(`ohosTest HAP compilation exited ${compiled.status ?? 'unknown'}`);

const testHap = path.join(REPO, 'entry/build/default/outputs/ohosTest/entry-ohosTest-signed.hap');
if (!fs.existsSync(testHap)) fail(`compiled test HAP is missing: ${testHap}`);
console.log('✓ ArkTS test package compiled. Run `npm run test:arkts-device` to execute assertions on a device.');
