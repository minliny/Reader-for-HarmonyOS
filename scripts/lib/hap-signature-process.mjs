import { execFile } from 'node:child_process';
import { closeSync, openSync, readSync } from 'node:fs';
import { createDiagnosticSignalScope } from './hap-diagnostic-transport.mjs';

const SIGNER_OUTPUT_LIMIT = 256 * 1024 * 1024;
const NATIVE_MAGICS = new Set([0x7f454c46, 0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe,
  0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca]);

/** Async cancellation owns a direct JVM, so custom script launchers keep their portable sync path. */
export function canOverlapHapSignature(java) {
  if (/\.(?:[cm]?js|cmd|bat)$/i.test(java)) return false;
  let fd;
  try {
    fd = openSync(java, 'r');
    const header = Buffer.alloc(4);
    if (readSync(fd, header, 0, header.length, 0) !== header.length) return false;
    return process.platform === 'win32' ? header.readUInt16BE(0) === 0x4d5a :
      NATIVE_MAGICS.has(header.readUInt32BE(0));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Start one private verifier and reap it before its caller removes output files. */
export function startHapSignatureProcess(java, args, cwd) {
  const scope = createDiagnosticSignalScope();
  const stop = new AbortController();
  try {
    let finishCapture;
    const capture = new Promise(resolveResult => { finishCapture = resolveResult; });
    const child = execFile(java, args, {
      cwd, encoding: 'utf8', maxBuffer: SIGNER_OUTPUT_LIMIT, killSignal: 'SIGKILL',
      signal: AbortSignal.any([scope.signal, stop.signal]),
    }, (error, stdout, stderr) => {
      const commandError = error && typeof error.code !== 'number' && !error.signal ? error.code ?? 'UNKNOWN' : undefined;
      finishCapture({ status: child.exitCode, stdout, stderr, commandError });
    });
    const closed = new Promise(resolveClose => child.once('close', resolveClose));
    const result = Promise.all([capture, closed]).then(([value]) => {
      if (scope.reason) throw interrupted(scope.reason);
      return value;
    });
    // ZIP validation can fail before the caller starts waiting for the verifier.
    result.catch(() => {});
    return { result, async stop() {
      stop.abort();
      try {
        await closed;
        if (scope.reason) throw interrupted(scope.reason);
      } finally { scope.dispose(); }
    } };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}

function interrupted(signal) {
  const error = new Error(`HAP signature verification interrupted by ${signal}`);
  error.exitCode = signal === 'SIGINT' ? 130 : 143;
  return error;
}
