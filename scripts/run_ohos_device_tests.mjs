// run_ohos_device_tests.mjs — strict emulator-only runner for the ArkTS suite.
//
// NAMING: the npm script is `test:arkts-emulator`, not `test:arkts-device`.
// This is an emulator behavior test runner, NOT a device delivery test and
// NOT a frontend visual delivery test. A 465/465 pass here only proves the
// ArkTS Hypium suite passed on the local emulator (127.0.0.1:5555); it does
// NOT prove Figma parity, Reader-UI source-side completion, HarmonyOS
// consumption, or real-device behavior. Do not report this suite's pass count
// as device evidence or frontend completion evidence.
//
// DevEco's supported command is `hvigorw onDeviceTest`, not `hvigorw test`.
// It builds the default + ohosTest HAPs, installs them, then starts
// /ets/testrunner/OpenHarmonyTestRunner through `aa test`. This wrapper fails
// before any build/install unless the dedicated local HarmonyOS emulator is
// the only HDC target, and rejects stale/missing test output after the command
// returns. Physical-device evidence has a separate explicit workflow; a test
// suite must never silently install over a user's real Reader data.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEVECO = '/Applications/DevEco-Studio.app/Contents';
const COVERAGE_LOG = path.join(REPO, 'entry/.test/default/intermediates/ohosTest/coverage_data/coverage.log');
const TEST_RESULT = path.join(REPO, 'entry/.test/default/intermediates/ohosTest/coverage_data/test_result.txt');
const REQUIRED_EMULATOR_TARGET = process.env.READER_OHOS_EMULATOR_TARGET || '127.0.0.1:5555';

function fail(message) {
  console.error(`✗ ArkTS emulator test: ${message}`);
  process.exit(1);
}

// ─── Internal preflight: enforce the implementation-ready gate ─────────────
// npm lifecycle hooks (pretest:arkts-emulator) are NOT sufficient — an agent
// can invoke this script directly with `node scripts/run_ohos_device_tests.mjs`
// or through `hvigorw onDeviceTest`. This internal preflight re-runs the gate
// so direct invocation is also covered. On 2026-07-27 the user audit found
// that only `pretest` existed, leaving emulator/device/raw build invocation
// unguarded against stale artifacts and hand-edited registry bypasses.
{
  const gate = spawnSync('node', [path.join(SCRIPTS_DIR, 'enforce-implementation-ready-gate.mjs')], {
    cwd: REPO,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (gate.status !== 0) {
    fail('implementation-ready gate failed — refusing to start emulator test cycle.');
  }
}

function resolveHdc() {
  if (typeof process.env.HDC_PATH === 'string' && process.env.HDC_PATH.length > 0) return process.env.HDC_PATH;
  const onPath = spawnSync('sh', ['-lc', 'command -v hdc'], { encoding: 'utf8' });
  if (onPath.status === 0 && onPath.stdout.trim().length > 0) return onPath.stdout.trim();
  for (const candidate of [
    `${DEVECO}/sdk/default/openharmony/toolchains/hdc`,
    `${DEVECO}/sdk/default/hms/toolchains/hdc`,
    `${DEVECO}/tools/hdc`,
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'hdc';
}

function readExactlyOneTarget(hdc) {
  const listed = spawnSync(hdc, ['list', 'targets'], { encoding: 'utf8', timeout: 12000 });
  if (listed.error !== undefined || listed.status !== 0) {
    const detail = listed.error instanceof Error ? ` (${listed.error.message})` : '';
    fail(`HDC is unavailable at ${hdc}${detail}`);
  }
  const targets = listed.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== '[Empty]');
  if (targets.length === 0) fail('no device is connected; connect and unlock one USB-debuggable device, then retry');
  if (targets.length !== 1) fail(`expected exactly one target, found ${targets.length}; select one device before running destructive install-based tests`);
  return targets[0];
}

function isHarmonyEmulatorTarget(target) {
  // HDC exposes the local HarmonyOS emulator as a loopback socket.  It accepts
  // the project's local debug signature, unlike a physical device which must
  // remain protected by the AppGallery-issued profile gate below.
  return target.startsWith('127.0.0.1:') || target.startsWith('localhost:');
}

const hdc = resolveHdc();
const target = readExactlyOneTarget(hdc);
const emulatorTarget = isHarmonyEmulatorTarget(target);
if (!emulatorTarget || target !== REQUIRED_EMULATOR_TARGET) {
  fail(`emulator-only suite requires exactly ${REQUIRED_EMULATOR_TARGET}; found ${target}. Physical-device testing must use the separate evidence workflow.`);
}
console.log(`→ ${target} is the dedicated HarmonyOS emulator; physical-device signing is intentionally skipped.`);

const env = {
  ...process.env,
  DEVECO_SDK_HOME: process.env.DEVECO_SDK_HOME || DEVECO,
  JAVA_HOME: process.env.JAVA_HOME || `${DEVECO}/jbr/Contents/Home`,
  PATH: `${DEVECO}/tools/node/bin:${DEVECO}/tools/ohpm/bin:${process.env.JAVA_HOME || `${DEVECO}/jbr/Contents/Home`}/bin:${process.env.PATH}`,
};

console.log(`→ Running the ArkTS emulator suite on ${target} through DevEco onDeviceTest...`);
const startedAt = Date.now();
const executed = spawnSync('./hvigorw', [
  'onDeviceTest',
  '--mode', 'module',
  '-p', 'module=entry@default',
  '--no-daemon',
  // DevEco can otherwise reuse an ohosTest bundle after an ArkTS test source
  // changes, which would make an emulator run report a stale assertion.
  '--no-incremental',
], {
  cwd: REPO,
  env,
  stdio: 'inherit',
});
if (executed.status !== 0) fail(`onDeviceTest exited ${executed.status ?? 'unknown'}`);

if (!fs.existsSync(COVERAGE_LOG)) fail(`DevEco produced no emulator coverage log: ${COVERAGE_LOG}`);
if (!fs.existsSync(TEST_RESULT)) fail(`DevEco produced no emulator test result: ${TEST_RESULT}`);
const coverageStat = fs.statSync(COVERAGE_LOG);
const resultStat = fs.statSync(TEST_RESULT);
if (coverageStat.mtimeMs < startedAt || resultStat.mtimeMs < startedAt) {
  fail('DevEco emulator test output is stale; fresh emulator output was not produced');
}
const coverageOutput = fs.readFileSync(COVERAGE_LOG, 'utf8');
const hypiumSummary = coverageOutput.match(/Tests run:\s*(\d+),\s*Failure:\s*(\d+),\s*Error:\s*(\d+),\s*Pass:\s*(\d+),\s*Ignore:\s*(\d+)/);
let run = 0;
let failure = 0;
let error = 0;
let pass = 0;
let ignore = 0;
if (hypiumSummary !== null) {
  [, run, failure, error, pass, ignore] = hypiumSummary.map(Number);
} else {
  // Current DevEco/Hypium images write per-case result records to
  // test_result.txt while coverage.log carries only coverage frames. Accept
  // that supported format, but fail closed if no case result is present.
  const resultOutput = fs.readFileSync(TEST_RESULT, 'utf8');
  const results = [...resultOutput.matchAll(/^result=(Success|Failure|Error|Ignore)$/gm)].map((match) => match[1]);
  if (results.length === 0) fail('could not parse a Hypium test summary from fresh emulator output');
  for (const result of results) {
    if (result === 'Success') pass += 1;
    else if (result === 'Failure') failure += 1;
    else if (result === 'Error') error += 1;
    else ignore += 1;
  }
  run = results.length;
}
if (run === 0 || failure > 0 || error > 0 || pass + failure + error + ignore !== run) {
  fail(`Hypium reported ${pass} pass / ${failure} fail / ${error} error / ${run} run / ${ignore} ignore`);
}
console.log(`✓ ArkTS emulator tests: ${pass} pass / ${run} run / ${ignore} ignore.`);
