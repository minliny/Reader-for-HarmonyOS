// HDC can report a failed install in its textual payload while still exiting
// with code 0.  Device evidence must fail closed in that case: launching an
// older installed package cannot prove the HAP that was just built.

/**
 * Returns true only for an HDC install result that both exits cleanly and
 * explicitly reports success.  A zero exit status alone is insufficient.
 *
 * @param {{ status?: number | null, stdout?: string, stderr?: string }} result
 * @returns {boolean}
 */
export function isSuccessfulHdcInstall(result) {
  if (result.status !== 0) return false;

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  // Reject all known failure forms before accepting the optimistic success
  // marker.  This includes the observed `msg:error: failed to install bundle`
  // payload emitted with status 0 on some HDC versions.
  if (/\b(?:error|failed|failure|invalid)\b/i.test(output)) return false;
  return /\b(?:success|successful|successfully|succeeded)\b/i.test(output);
}
