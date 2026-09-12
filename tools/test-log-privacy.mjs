import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diagnosticCodeOf } from '../entry/src/main/ets/app/LogPrivacy.ts';

const cases = [
  ['https://user:password@example.test/private?token=secret', 'NETWORK'],
  ['Set-Cookie: sid=private-session-value', 'OPERATION_FAILED'],
  ['Bearer a-private-access-token', 'OPERATION_FAILED'],
  ['ENOSPC while writing /user/private/path', 'NO_SPACE'],
  ['deadline exceeded at https://example.test/?secret=value', 'TIMEOUT'],
  ['parse failed with private body text', 'INVALID_DATA'],
  ['cancelled session=private-session', 'CANCELLED'],
];
for (const [message, expected] of cases) assert.equal(diagnosticCodeOf(message), expected);
const read = relative => readFileSync(new URL('../entry/src/main/ets/' + relative, import.meta.url), 'utf8');
for (const name of ['ReadingSessionFlowGateway.ts', 'ReadingOfflineGateway.ts', 'ReaderTtsSessionCoordinator.ts']) {
  const source = read('features/reading/' + name);
  for (const call of source.matchAll(/console\.(?:error|warn)\((`[^\n]+`)\)/g)) {
    assert.match(call[1], /diagnosticCodeOf\(/, `${name} publishes unclassified detail`);
  }
}
assert.doesNotMatch(read('features/reading/LocalReadingExperience.ets'), /console\.(?:error|warn)\(`/,
  'reading UI details must use native private fields, not public console interpolation');
console.log('log privacy: PASS (finite public error codes; reading details use private fields)');
