import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { prepareDuringNativePreflight } from '../hap-pipeline.mjs';

function childFixture(t, exitCode = 0) {
  const root = mkdtempSync(join(tmpdir(), 'reader-native-preparation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const child = join(root, 'preflight.mjs');
  const preparationStarted = join(root, 'preparation-started');
  const childStarted = join(root, 'child-started');
  const childFinished = join(root, 'child-finished');
  // The actual child waits for the independent main-thread preparation.
  // Both the old serialized order and early rejection strand this fixture.
  writeFileSync(child, [
    "import { existsSync, writeFileSync } from 'node:fs';",
    "import { setTimeout } from 'node:timers/promises';",
    'const [preparation, started, finished, code] = process.argv.slice(2);',
    "writeFileSync(started, 'running');",
    'const deadline = Date.now() + 5000;',
    'while (!existsSync(preparation) && Date.now() < deadline) await setTimeout(10);',
    "if (!existsSync(preparation)) throw new Error('preparation was never started');",
    'await setTimeout(20);',
    "writeFileSync(finished, 'settled');",
    "if (Number(code) !== 0) console.error('Native admission fixture refused inputs');",
    'process.exitCode = Number(code);',
  ].join('\n'));
  return {
    args: [child, preparationStarted, childStarted, childFinished, String(exitCode)],
    async waitForChild() {
      const deadline = Date.now() + 5000;
      while (!existsSync(childStarted) && Date.now() < deadline) await setTimeout(10);
      assert.equal(existsSync(childStarted), true, 'preflight child never started');
    },
    notePreparation() { writeFileSync(preparationStarted, 'started'); },
    childFinished() { return existsSync(childFinished); },
  };
}

test('overlaps the child and read-only preparation and waits for the child to finish', async t => {
  const fixture = childFixture(t);
  let timing;
  const prepared = await prepareDuringNativePreflight(fixture.args, async () => {
    await fixture.waitForChild();
    assert.equal(fixture.childFinished(), false);
    fixture.notePreparation();
    return { admitted: 'identity and tools' };
  }, value => { timing = value; });
  assert.deepEqual(prepared, { admitted: 'identity and tools' });
  assert.equal(fixture.childFinished(), true);
  assert.ok(Number.isFinite(timing) && timing > 0);
});

test('preserves native failure precedence and drains the child when preparation also fails', async t => {
  const fixture = childFixture(t, 17);
  let timing;
  await assert.rejects(prepareDuringNativePreflight(fixture.args, () => {
    fixture.notePreparation();
    throw new Error('toolchain preparation failure');
  }, value => { timing = value; }), error =>
    error.exitCode === 1 && /\(17\): Native admission fixture refused inputs/.test(error.message));
  assert.equal(fixture.childFinished(), true);
  assert.ok(Number.isFinite(timing) && timing > 0);
});

test('returns the original preparation error after a successful native command has drained', async t => {
  const fixture = childFixture(t);
  const failure = new Error('invalid app identity');
  await assert.rejects(prepareDuringNativePreflight(fixture.args, () => {
    fixture.notePreparation();
    throw failure;
  }), error => error === failure);
  assert.equal(fixture.childFinished(), true);
});
