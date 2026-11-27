import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readReadingEntrySnapshot } from '../../entry/src/main/ets/features/reading/application/ReadingEntrySnapshot.ts';
import type { ReadingGatewayRuntime } from '../../entry/src/main/ets/features/reading/application/ReadingGatewayRuntime.ts';

test('an explicit remote target known missing omits the optional entry snapshot request', async () => {
  const runtime = {
    supportsCoreCapability: () => true,
    request: () => assert.fail('known-missing target dispatched the optional snapshot probe'),
  } as unknown as ReadingGatewayRuntime;
  assert.equal(await readReadingEntrySnapshot(runtime, 'source', 'book', 29,
    () => true, undefined, undefined, 'missing'), undefined);
});
