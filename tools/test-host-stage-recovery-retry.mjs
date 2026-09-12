import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync('entry/src/main/ets/app/ReaderHostRegistry.ts', 'utf8');
assert.match(source, /private stageRecovery: Promise<void>/,
  'the per-Host recovery promise must be replaceable after a transient failure');
assert.match(source, /await this\.ensureStageRecovery\(\)/,
  'the picker must re-enter the retryable recovery boundary');
assert.match(source, /private async ensureStageRecovery\(\)/,
  'the Host must expose an instance-level recovery retry path');
const start = source.indexOf('  private static stageRecoveryFor(');
const end = source.indexOf('\n  getContext()', start);
assert.ok(start >= 0 && end > start, 'stage recovery single-flight helper must exist');
const method = source.slice(start, end).replaceAll('ReaderHostRegistry', 'Harness');
const Harness = new Function(`${stripTypeScriptTypes(`
  class Harness {
    static stageRecoveries = new Map();
    ${method}
  }
`)}; return Harness;`)();

let attempts = 0;
let rejectFirst;
const first = Harness.stageRecoveryFor('/stage', () => {
  attempts += 1;
  return new Promise((_resolve, reject) => { rejectFirst = reject; });
});
const joined = Harness.stageRecoveryFor('/stage', async () => { attempts += 1; });
assert.equal(first, joined, 'concurrent callers must share one recovery attempt');
assert.equal(attempts, 1);
rejectFirst(new Error('transient I/O'));
await assert.rejects(first, /transient I\/O/);
await Harness.stageRecoveryFor('/stage', async () => { attempts += 1; });
assert.equal(attempts, 2, 'a rejected recovery must be evicted so a later Host can retry');

console.log('Host staging recovery retry: PASS');
