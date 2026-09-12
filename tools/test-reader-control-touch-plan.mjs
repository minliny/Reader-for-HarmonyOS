import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The host build excludes every OH_Input call at compile time. It executes the
// production parser, not a JS copy and not native input or authorization tests.
const source = fileURLToPath(new URL('native/reader-control-touch-sequence.c', import.meta.url));
const output = join(mkdtempSync(join(tmpdir(), 'reader-control-touch-parser-')), 'plan-check');
const compile = spawnSync('/usr/bin/clang', ['-std=c11', '-Wall', '-Wextra', '-Werror',
  '-DREADER_CONTROL_DRY_ONLY', source, '-o', output], { encoding: 'utf8' });
assert.equal(compile.status, 0, `${compile.stdout}\n${compile.stderr}`);
const dryArgs = ['--dry-run', '1320', '2856', '--display', '0'];
// The parser itself is synchronous and normally completes in milliseconds, but
// this suite runs alongside the full contract matrix on constrained CI hosts.
// Keep a bounded timeout while allowing process startup under contention.
const run = (input, args = dryArgs) => spawnSync(output, args, { input, encoding: 'utf8', timeout: 5000 });
const single = '0 DOWN 0 660 1500\n100 MOVE 0 660 1200\n600 MOVE 0 660 1400\n800 UP 0 660 1400\n';
const dual = '0 DOWN 0 660 1500\n100 DOWN 1 600 1500\n200 MOVE 1 600 1700\n300 UP 1 600 1700\n500 MOVE 0 660 1300\n700 UP 0 660 1300\n';
const cancelled = '0 DOWN 0 660 1500\n100 DOWN 1 600 1500\n300 CANCEL 0 660 1500\n300 CANCEL 1 600 1500\n';
for (const plan of [single, dual, cancelled, '# comment\n0 DOWN 0 0 0\n10000 UP 0 1319 2855']) {
  const result = run(plan);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).dryRun, true);
  assert.doesNotMatch(result.stdout, /request-authorization|cleanup-cancel|"event":"touch"/);
}
const malformed = [
  '', '0 DOWN 0 100 100\n', '0 MOVE 0 100 100\n', '0 UP 0 100 100\n',
  '0 DOWN 0 100 100\n1 DOWN 0 100 100\n2 UP 0 100 100\n',
  '0 DOWN 2 100 100\n1 UP 2 100 100\n',
  '1 DOWN 0 100 100\n0 UP 0 100 100\n',
  '0 DOWN 0 -1 100\n1 UP 0 0 100\n',
  '0 DOWN 0 1320 100\n1 UP 0 100 100\n',
  '0 DOWN 0 100 2856\n1 UP 0 100 100\n',
  '0 DOWN 0 100 100\n10001 UP 0 100 100\n',
  '0 DOWN 0 100 100\n5e2 UP 0 100 100\n',
  '0 DOWN 0 100 100 extra\n1 UP 0 100 100\n',
  '0 DOWN 0 100 100\n1 CANCEL 0 100 100\n2 DOWN 0 100 100\n3 UP 0 100 100\n',
  '0 DOWN 0 100 100\n0 DOWN 1 100 100\n2 CANCEL 0 100 100\n3 CANCEL 1 100 100\n',
  '0 DOWN 0 100 100\n1 SHELL 0 100 100\n2 UP 0 100 100\n',
  `0 DOWN 0 ${'9'.repeat(120)} 100\n1 UP 0 100 100\n`,
  Array.from({ length: 258 }, (_, i) => `${i} ${i % 2 ? 'UP' : 'DOWN'} 0 100 100`).join('\n'),
];
for (const plan of malformed) {
  const result = run(plan);
  assert.equal(result.status, 2, `${JSON.stringify(plan)}\n${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /request-authorization|"event":"touch"/);
}
for (const args of [[], ['--execute', ...dryArgs.slice(1)],
  ['--dry-run', '0', '2856', '--display', '0'],
  ['--dry-run', '1320', '2856', '--display', '-1']]) assert.equal(run(single, args).status, 2);
const hostExecute = run(single, ['--execute', ...dryArgs.slice(1), '--request-authorization']);
assert.equal(hostExecute.status, 3, 'host parser can never inject even with explicit runtime flags');
assert.match(hostExecute.stderr, /cannot inject/);
assert.doesNotMatch(hostExecute.stdout, /request-authorization|"event":"touch"/);

const c = readFileSync(source, 'utf8');
assert.ok(c.indexOf('int count = read_plan') < c.lastIndexOf('return run_plan('), 'parse precedes execution');
assert.match(c, /request_code != INPUT_SUCCESS/);
assert.match(c, /initial != UNAUTHORIZED/);
assert.match(c, /current != AUTHORIZED/);
assert.match(c, /STEP_CANCEL, finger, fingers\[finger\]\.x/);
assert.match(c, /OH_Input_CancelInjection\(\);\n    int final_code = query_authorization/);
console.log(`Native diagnostic production parser: 4 valid + ${malformed.length} malformed plans, CLI and non-injecting host gates PASS; authorization/runtime cleanup not executed.`);
