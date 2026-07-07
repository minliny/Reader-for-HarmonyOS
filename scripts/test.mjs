// test.mjs — trustworthy test gate.
//
// Problem: `hvigorw test` exits 0 even when hypium assertions fail — the build
// turns green regardless of test results, so "tests pass" is an unreliable
// signal. HostSmoke's Layer B NAPI tests (ping/coreInfo_round_trip_through_napi)
// are DESIGNED to fail on host (no device CoreRuntime) — see
// host/tests/HostSmoke.test.ets — they must not be skipped-as-pass. So on host
// the gate is RED (honest); it only goes green on a real device with the
// native .so loaded.
//
// This wrapper:
//   1. Runs `hvigorw test`, capturing stdout+stderr to a log file.
//   2. Parses the hypium test_result.txt summary + per-test result lines.
//   3. ALSO scans the hvigorw log for `ERROR: Error in <name>` lines as a
//      belt-and-suspenders check (catches failures even if test_result.txt
//      format drifts).
//   4. Classifies failures into BY_DESIGN_HOST (the 2 known NAPI tests) vs
//      REGRESSION (everything else). Both fail the gate on host; the
//      classification only affects the printed guidance.
//   5. Exits non-zero on any failure/error.
//
// Env vars:
//   READER_TEST_ALLOW_HOST_NAPI_FAIL=1 — downgrade BY_DESIGN_HOST failures
//   to warnings (CI that knowingly runs on host). Still fails on REGRESSION.
//   Does NOT affect device runs (the 2 tests pass on device).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

// DevEco toolchain env (same paths the memory documents). Must be set for
// hvigorw to find the SDK + JDK.
const DEVECO = '/Applications/DevEco-Studio.app/Contents';
const env = {
  ...process.env,
  DEVECO_SDK_HOME: process.env.DEVECO_SDK_HOME || DEVECO,
  JAVA_HOME: process.env.JAVA_HOME || `${DEVECO}/jbr/Contents/Home`,
  PATH: `${DEVECO}/tools/node/bin:${DEVECO}/tools/ohpm/bin:${process.env.JAVA_HOME || `${DEVECO}/jbr/Contents/Home`}/bin:${process.env.PATH}`,
};

// Tests that fail BY DESIGN on host (no libreader_core_napi.so). They pass on
// a real device. Listed here so the gate can classify failures honestly.
const BY_DESIGN_HOST_TESTS = new Set([
  'ping_round_trip_through_napi',
  'coreInfo_round_trip_through_napi',
]);
const ALLOW_HOST_NAPI_FAIL = process.env.READER_TEST_ALLOW_HOST_NAPI_FAIL === '1';

// 1. Run hvigorw test, capturing combined stdout+stderr to a log file for
//    secondary `ERROR: Error in` scanning. Stdio is still inherited so the
//    hvigor output is visible in real time.
const LOG = path.join(REPO, 'entry/.test/default/intermediates/test/coverage_data/hvigor_test_output.log');
try {
  // mkdir -p the log dir so the redirect doesn't fail.
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
} catch (e) { /* may already exist */ }

let hvigorStdioOk = true;
try {
  // `tee` to both inherit (visible) and capture (for scanning). On macOS the
  // default shell supports this. 2>&1 merges stderr into stdout for capture.
  const cmd = `./hvigorw test --no-daemon 2>&1 | tee "${LOG}"`;
  execSync(cmd, { cwd: REPO, env, stdio: 'inherit' });
} catch (e) {
  // hvigorw exited non-zero — could be compile error or test runner crash.
  // The gate should still parse results if they exist, then fail.
  hvigorStdioOk = false;
  console.error(`✗ test gate: hvigorw test exited ${e.status ?? 'unknown'} (will still parse results if present)`);
}

// 2. Locate + parse the hypium result file.
const RESULT = path.join(REPO, 'entry/.test/default/intermediates/test/coverage_data/test_result.txt');
if (!fs.existsSync(RESULT)) {
  console.error(`✗ test gate: no test_result.txt at ${RESULT}`);
  if (!hvigorStdioOk) process.exit(1);
  // hvigorw succeeded but no result file — that's a gate setup error.
  process.exit(1);
}
const txt = fs.readFileSync(RESULT, 'utf8');

// Summary line: "Tests run: 71, Failure: 2, Error: 0, Pass: 69, Ignore: 0"
const summary = txt.match(/Tests run:\s*(\d+),\s*Failure:\s*(\d+),\s*Error:\s*(\d+),\s*Pass:\s*(\d+),\s*Ignore:\s*(\d+)/);
if (!summary) {
  console.error('✗ test gate: could not parse "Tests run:" summary line');
  process.exit(1);
}
const [, run, failure, error, pass, ignore] = summary.map(Number);

// Collect failing test names from test_result.txt. Format: "test=<name>" then
// (optional error block) then "result=Failure". Pair them in order.
const failures = [];
const lines = txt.split('\n');
let pendingName = null;
for (const line of lines) {
  const tm = line.match(/^test=(.+)$/);
  if (tm) { pendingName = tm[1].trim(); continue; }
  if (/^result=Failure\s*$/.test(line) && pendingName) {
    failures.push(pendingName);
    pendingName = null;
  } else if (/^result=Success\s*$/.test(line)) {
    pendingName = null;
  }
}

// 3. Belt-and-suspenders: scan hvigorw log for `ERROR: Error in <name>` lines.
//    This catches failures even if test_result.txt format drifts or the file
//    is missing. Each match is a test that hypium reported as errored.
const logFailures = new Set(failures);
const extraFromLog = [];
if (fs.existsSync(LOG)) {
  const logTxt = fs.readFileSync(LOG, 'utf8');
  const re = /ERROR: Error in (\S+?),/g;
  let m;
  while ((m = re.exec(logTxt)) !== null) {
    const name = m[1];
    if (!logFailures.has(name)) {
      logFailures.add(name);
      extraFromLog.push(name);
    }
  }
}

// 4. Classify failures: BY_DESIGN_HOST vs REGRESSION.
const byDesign = [];
const regression = [];
for (const f of logFailures) {
  if (BY_DESIGN_HOST_TESTS.has(f)) {
    byDesign.push(f);
  } else {
    regression.push(f);
  }
}

console.log('');
console.log(`Tests: ${pass} pass / ${failure} fail / ${error} error / ${run} run / ${ignore} ignore`);
if (byDesign.length > 0) {
  console.log(`By-design host failures (need real device + libreader_core_napi.so):`);
  for (const f of byDesign) console.log(`  • ${f}`);
}
if (regression.length > 0) {
  console.log(`Regression failures (real failures, must fix):`);
  for (const f of regression) console.log(`  • ${f}`);
}
if (extraFromLog.length > 0) {
  console.log(`Extra failures detected from hvigorw log (not in test_result.txt):`);
  for (const f of extraFromLog) console.log(`  • ${f}`);
}

// 5. Gate decision.
const hasRegression = regression.length > 0;
const hasByDesign = byDesign.length > 0;

if (hasRegression) {
  console.error(`✗ test gate FAILED: ${regression.length} regression(s).`);
  console.error('  These are NOT by-design host failures — they must be fixed.');
  process.exit(1);
}

if (hasByDesign && !ALLOW_HOST_NAPI_FAIL) {
  console.error(`✗ test gate FAILED: ${byDesign.length} by-design host failure(s).`);
  console.error('  On host, the 2 NAPI round-trip tests fail BY DESIGN — they need a real');
  console.error('   device with libreader_core_napi.so. Run on device to make them pass.');
  console.error('  (Set READER_TEST_ALLOW_HOST_NAPI_FAIL=1 to downgrade to warning.)');
  process.exit(1);
}

if (hasByDesign && ALLOW_HOST_NAPI_FAIL) {
  console.warn(`⚠ test gate PASSED with host allowance: ${byDesign.length} by-design host failure(s) downgraded to warning.`);
  console.warn('  READER_TEST_ALLOW_HOST_NAPI_FAIL=1 is set. Device run still required for full proof.');
  process.exit(0);
}

if (failure > 0 || error > 0) {
  // Untracked failure path — fail loudly.
  console.error(`✗ test gate FAILED: ${failure} failure(s), ${error} error(s) — none matched known patterns.`);
  process.exit(1);
}

console.log('✓ test gate passed.');
