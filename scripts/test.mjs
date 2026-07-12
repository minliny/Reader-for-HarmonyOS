// test.mjs — trustworthy test gate.
//
// Problem: `hvigorw test` exits 0 even when hypium assertions fail — the build
// turns green regardless of test results, so "tests pass" is an unreliable
// signal. This script is the host-only unit gate. Real NAPI proof is owned by
// `npm run test:device`, which requires a connected hdc target and fresh
// EntryAbility [CoreSelfCheck] evidence.
//
// This wrapper:
//   1. Runs the entry module's `hvigorw test`, capturing stdout+stderr to a
//      log file. Source HAR dependencies are still compiled, while their own
//      optional unit-test targets are not treated as app test suites.
//   2. Parses the hypium test_result.txt summary + per-test result lines.
//   3. ALSO scans the hvigorw log for `ERROR: Error in <name>` lines as a
//      belt-and-suspenders check (catches failures even if test_result.txt
//      format drifts).
//   4. Exits non-zero on any assertion failure, compile failure, missing result,
//      or stale result file. There are no device-only exceptions in this lane.
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

// 1. Run hvigorw test, capturing combined stdout+stderr to a log file for
//    secondary `ERROR: Error in` scanning. Stdio is still inherited so the
//    hvigor output is visible in real time.
//
// CRITICAL: `hvigorw | tee` without pipefail returns exit 0 even when hvigorw
// fails (tee succeeds), so execSync doesn't throw, and the gate then reads a
// STALE test_result.txt from a previous run — masking real failures. We fix
// this by:
//   a) Running hvigorw WITHOUT the pipe first (capture exit code honestly),
//      streaming output to both the log file and the terminal via inherit.
//   b) Recording hvigorw START time and validating test_result.txt mtime > start
//      before trusting it (reject stale files from prior runs).
const LOG = path.join(REPO, 'entry/.test/default/intermediates/test/coverage_data/hvigor_test_output.log');
try {
  // mkdir -p the log dir so the redirect doesn't fail.
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
} catch (e) { /* may already exist */ }

const HVIGOR_START_MS = Date.now();
let hvigorStdioOk = true;
try {
  // Run hvigorw directly (no pipe) so its exit code propagates honestly.
  // stdio: 'inherit' keeps output visible in real time; we separately tee
  // to the log file by re-running capture is unnecessary — instead we write
  // the log by redirecting stdout+stderr to the file AND the terminal.
  // On macOS, `bash -c 'set -o pipefail; cmd | tee file'` is the portable way.
  const cmd = `bash -c 'set -o pipefail; ./hvigorw test --mode module -p module=entry@default --no-daemon 2>&1 | tee "${LOG}"'`;
  execSync(cmd, { cwd: REPO, env, stdio: 'inherit' });
} catch (e) {
  // hvigorw exited non-zero — could be compile error or test runner crash.
  // The gate should still parse results if they exist, then fail.
  hvigorStdioOk = false;
  console.error(`✗ test gate: hvigorw test exited ${e.status ?? 'unknown'} (will still parse results if present and fresh)`);
}

// 2. Locate + parse the hypium result file.
const RESULT = path.join(REPO, 'entry/.test/default/intermediates/test/coverage_data/test_result.txt');
if (!fs.existsSync(RESULT)) {
  console.error(`✗ test gate: no test_result.txt at ${RESULT}`);
  if (!hvigorStdioOk) process.exit(1);
  // hvigorw succeeded but no result file — that's a gate setup error.
  process.exit(1);
}
// Stale-file guard: reject test_result.txt older than hvigorw start. A stale
// file means hvigorw never produced fresh results (e.g. compile error before
// test phase) — reading it would mask the real failure.
const resultStat = fs.statSync(RESULT);
const resultMtimeMs = resultStat.mtimeMs;
if (resultMtimeMs < HVIGOR_START_MS) {
  console.error(`✗ test gate: test_result.txt is STALE (mtime ${new Date(resultMtimeMs).toISOString()} < hvigorw start ${new Date(HVIGOR_START_MS).toISOString()})`);
  console.error('  hvigorw did not produce fresh test results — likely a compile error or test runner crash.');
  if (!hvigorStdioOk) process.exit(1);
  // Even if hvigorw reported success, a stale result file is a gate error.
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

console.log('');
console.log(`Host tests: ${pass} pass / ${failure} fail / ${error} error / ${run} run / ${ignore} ignore`);
if (logFailures.size > 0) {
  console.log('Host unit failures:');
  for (const f of logFailures) console.log(`  • ${f}`);
}
if (extraFromLog.length > 0) {
  console.log(`Extra failures detected from hvigorw log (not in test_result.txt):`);
  for (const f of extraFromLog) console.log(`  • ${f}`);
}

// 4. Gate decision. Any host assertion/error is a real regression.
if (!hvigorStdioOk || failure > 0 || error > 0 || logFailures.size > 0) {
  console.error(`✗ host test gate FAILED: ${failure} failure(s), ${error} error(s).`);
  process.exit(1);
}

console.log('✓ host test gate passed. Run `npm run test:device` for real NAPI proof.');
