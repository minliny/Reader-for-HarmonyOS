import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BOOK_TURN_CASE_TIMEOUT_MS = 60_000;
const cpp = fileURLToPath(new URL('../../entry/src/main/cpp/', import.meta.url));

/** Same C++ source and flags for focused and full selection. Each discovered
 * entry owns disjoint cases; the 60s deadline stays below the suite's 110s cap. */
export function runBookTurnNativeCase(name) {
  assert.ok(['motion', 'render_state', 'present_barrier'].includes(name), 'known native case');
  const sources = [`tests/bookturn_${name}_test.cpp`, 'bookturn/bookturn_solver.cpp'];
  if (name !== 'render_state') sources.push('bookturn/bookturn_motion.cpp');
  if (name !== 'motion') sources.push('bookturn/bookturn_renderer.cpp', 'tests/glmock/gl_mock.cpp');
  if (name === 'present_barrier') sources.push('bookturn/bookturn_host.cpp', 'tests/mocksdk/ohos_host_mocks.cpp');
  const scratch = mkdtempSync(path.join(tmpdir(), `reader-bookturn-${name}-`));
  try {
    const binary = path.join(scratch, process.platform === 'win32' ? `${name}.exe` : name);
    const options = { cwd: cpp, encoding: 'utf8', timeout: BOOK_TURN_CASE_TIMEOUT_MS };
    const compiled = spawnSync(process.env.CXX || (process.platform === 'win32' ? 'clang++' : 'c++'),
      ['-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror', '-I', 'bookturn', '-I', 'tests/glmock',
        '-I', 'tests/mocksdk', ...sources, '-o', binary], options);
    assert.equal(compiled.status, 0, `${name} compile: ${compiled.error ?? ''}\n${compiled.stdout}\n${compiled.stderr}`);
    const result = spawnSync(binary, [], options);
    assert.equal(result.status, 0, `${name}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    process.stdout.write(result.stdout);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
