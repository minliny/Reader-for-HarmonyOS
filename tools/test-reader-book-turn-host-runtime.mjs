import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cpp = fileURLToPath(new URL('../entry/src/main/cpp/', import.meta.url));
const scratch = mkdtempSync(path.join(tmpdir(), 'reader-bookturn-runtime-'));
try {
  for (const name of ['motion', 'render_state', 'present_barrier']) {
    const sources = [`tests/bookturn_${name}_test.cpp`, 'bookturn/bookturn_solver.cpp'];
    if (name !== 'render_state') sources.push('bookturn/bookturn_motion.cpp');
    if (name !== 'motion') sources.push('bookturn/bookturn_renderer.cpp', 'tests/glmock/gl_mock.cpp');
    if (name === 'present_barrier') sources.push('bookturn/bookturn_host.cpp', 'tests/mocksdk/ohos_host_mocks.cpp');
    const binary = path.join(scratch, name);
    const compiled = spawnSync('c++', ['-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror',
      '-I', 'bookturn', '-I', 'tests/glmock', '-I', 'tests/mocksdk', ...sources, '-o', binary],
      { cwd: cpp, encoding: 'utf8', timeout: 60000 });
    assert.equal(compiled.status, 0, `${name} compile: ${compiled.stdout}\n${compiled.stderr}`);
    const result = spawnSync(binary, [], { encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, `${name}: ${result.stdout}\n${result.stderr}`);
    process.stdout.write(result.stdout);
  }
} finally { rmSync(scratch, { recursive: true, force: true }); }
