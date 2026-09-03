import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(path.join(tmpdir(), 'reader-bookturn-solver-'));
const binary = path.join(scratch, 'bookturn_solver_test');
try {
  const compile = spawnSync('c++', [
    '-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror',
    path.join(root, 'entry/src/main/cpp/bookturn/bookturn_solver.cpp'),
    path.join(root, 'entry/src/main/cpp/tests/bookturn_solver_test.cpp'),
    '-o', binary,
  ], { encoding: 'utf8' });
  assert.equal(compile.status, 0, `${compile.stdout}\n${compile.stderr}`);
  const execute = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(execute.status, 0, `${execute.stdout}\n${execute.stderr}`);
  process.stdout.write(execute.stdout);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
