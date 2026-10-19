import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"input-tools-and-lease": "临时目录pnpm身份与Node假HDC释放"};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase();
  recordContractCasePass(id);
}
async function runSelectedCase() {


const {default: assert} = await import('node:assert/strict');
const { spawnSync } = await import('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = await import('node:fs');
const { resolve, dirname } = await import('node:path');
const { tmpdir } = await import('node:os');
const { assertBuildTools, REQUIRED_PNPM } = await import('./reader-build-tools.mjs');
const root = mkdtempSync(resolve(tmpdir(), 'reader-input-safety-'));
const write = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
try {
  const tools = resolve(root, 'tools');
  assert.throws(() => assertBuildTools(tools), /Prepared pnpm is missing/);
  write(resolve(tools, 'node_modules/pnpm/package.json'), JSON.stringify({ name: 'unrelated', version: REQUIRED_PNPM }));
  assert.throws(() => assertBuildTools(tools), /Invalid prepared pnpm identity/);
  write(resolve(tools, 'node_modules/pnpm/package.json'), JSON.stringify({ name: 'pnpm', version: REQUIRED_PNPM }));
  write(resolve(tools, 'node_modules/pnpm/bin/pnpm.cjs'), `console.log('${REQUIRED_PNPM}');`);
  const development = assertBuildTools(tools);
  assert.equal(development.pnpm, REQUIRED_PNPM);
  assert.equal(development.profile, 'development');
  assert.equal(development.toolIdentity, 'VERIFIED');
  assert.equal(assertBuildTools(tools, { profile: 'release' }).pnpm, REQUIRED_PNPM);
  write(resolve(tools, 'node_modules/pnpm/bin/pnpm.cjs'), "console.log('10.27.0');");
  assert.throws(() => assertBuildTools(tools), /executable\/version mismatch/);
  write(resolve(tools, 'node_modules/pnpm/package.json'), JSON.stringify({ name: 'pnpm', version: '10.27.0' }));
  assert.equal(assertBuildTools(tools).pnpm, '10.27.0', 'development verifies the prepared identity without inventing a supported-version range');
  assert.throws(() => assertBuildTools(tools, { profile: 'release' }), /Release profile is pinned/);

  // Exercise the real default lease path under a custom temp directory, with
  // Node standing in for HDC. No actual device operation can occur.
  const env = { ...process.env, TMPDIR: root, TMP: root, TEMP: root }; delete env.READER_HDC_LEASE_ROOT; delete env.READER_LOCK_DIR;
  const defaultLease = spawnSync(process.execPath, [resolve('tools/reader-hdc-lease.mjs'),
    '--target', 'fixture', '--hdc', process.execPath, '--', '-e', 'process.exit(0)'], { encoding: 'utf8', env });
  assert.equal(defaultLease.status, 0, defaultLease.stderr);
  assert.match(readFileSync(resolve(root, 'reader-hdc-target-leases/events.jsonl'), 'utf8'), /"type":"release"/);
  console.log('PASS build input safety: prepared pnpm identity/release pin and portable Node-only target lease');
} finally { rmSync(root, { recursive: true, force: true }); }

}
