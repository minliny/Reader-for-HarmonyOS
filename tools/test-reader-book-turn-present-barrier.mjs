import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../entry/src/main/cpp/', import.meta.url));
const scratch = mkdtempSync(path.join(tmpdir(), 'reader-bookturn-barrier-'));
try {
  const binary = path.join(scratch, 'barrier');
  const compile = spawnSync('c++', ['-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror',
    '-I', 'bookturn', '-I', 'tests/glmock', '-I', 'tests/mocksdk',
    'tests/bookturn_present_barrier_test.cpp', 'tests/mocksdk/ohos_host_mocks.cpp',
    'tests/glmock/gl_mock.cpp', 'bookturn/bookturn_host.cpp', 'bookturn/bookturn_motion.cpp',
    'bookturn/bookturn_renderer.cpp', 'bookturn/bookturn_solver.cpp', '-o', binary],
  { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(compile.status, 0, `${compile.stdout}\n${compile.stderr}`);
  const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 120000 });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  process.stdout.write(run.stdout);
} finally { rmSync(scratch, { recursive: true, force: true }); }
