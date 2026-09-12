/** Public console diagnostics use a finite classification, never error text.
 * Native hilog callers may separately use private fields for detailed errors.
 */
export function diagnosticCodeOf(message: string): string {
  const text = message.toLowerCase();
  if (/cancel|abort|取消/.test(text)) return 'CANCELLED';
  if (/timeout|timed out|deadline|超时/.test(text)) return 'TIMEOUT';
  if (/enospc|no space|disk full|空间不足/.test(text)) return 'NO_SPACE';
  if (/network|connection|dns|http|tls|网络/.test(text)) return 'NETWORK';
  if (/decode|parse|invalid|损坏|格式/.test(text)) return 'INVALID_DATA';
  return 'OPERATION_FAILED';
}
