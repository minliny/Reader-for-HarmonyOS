// Test evidence never changes the content identity of a verified Native input.
export function sdkSmokeEvidence(value) {
  const states = { pass: 'PASS', PASS: 'PASS', fail: 'FAIL', failed: 'FAIL', FAIL: 'FAIL', NOT_RUN: 'NOT_RUN' };
  const status = value === undefined ? 'MISSING' : Object.hasOwn(states, value) ? states[value] : 'INVALID';
  return { status, selected: status === 'NOT_RUN' ? false : status === 'MISSING' || status === 'INVALID' ? null : true,
    complete: status === 'PASS' || status === 'FAIL', acceptanceEligible: status === 'PASS',
    ...(status === 'MISSING' || status === 'INVALID' ? { issue: 'Selected test evidence is not established; preserve the missing/invalid result, never substitute NOT_RUN or PASS.' } : {}) };
}
