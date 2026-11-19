import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireEvidence } from '../../lib/evidence.mjs';

const probe = fileURLToPath(new URL('../../../reader-control-device-probe.mjs', import.meta.url));

/** One owned probe and exactly one in-flight, bounded request. */
export function openProbe({hdc, server, target, outputDir}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(http|https|all|socks|no)_proxy$/i.test(key)));
  Object.assign(env, {NO_PROXY: '*', no_proxy: '*'});
  const child = spawn(process.execPath, [probe, '--hdc', hdc, '--server', server, '--target', target, '--output-dir', outputDir],
    { stdio: ['pipe', 'pipe', 'pipe'], env });
  const records = [];
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let exited = null;
  let aborted = null;
  let pending;
  const ended = new Promise(resolve => {
    child.on('close', (code, signal) => {
      exited = {code, signal};
      reader.close();
      pending?.reject(new Error('Probe exited before reporting the requested operation'));
      resolve(exited);
    });
    child.on('error', () => { aborted = 'Probe failed to launch'; });
  });
  // Error contents could carry local command details or controlled inputs.
  child.stdin.on('error', () => {});
  child.stderr.resume();
  reader.on('line', line => {
    try {
      const record = JSON.parse(line);
      requireEvidence(record.seq === records.length + 1, 'Unexpected sequence in probe output');
      records.push(record);
      if (record.ok === false) throw Error('Probe device command failed');
      if (pending?.event === record.event) pending.resolve(record);
    } catch (error) {
      aborted = error.message;
      pending?.reject(new Error(aborted));
    }
  });
  function next(event, op, timeout) {
    requireEvidence(!pending && !exited && !aborted, aborted ?? 'Probe session unavailable');
    let timer;
    return new Promise((resolve, reject) => {
      pending = { event, resolve, reject };
      timer = setTimeout(() => reject(new Error(`Timed out waiting for probe ${event}`)), timeout);
      if (op) child.stdin.write(`${JSON.stringify(op.op === 'uiContractReadiness' ? op : {...op, preflightConfirmed:true})}\n`);
    }).finally(() => {
      clearTimeout(timer);
      pending = null;
    });
  }
  return {
    records,
    ready: () => next('ready', null, 34000),
    command: op => next(op.op === 'uiContractReadiness' ? 'readiness' : op.op === 'recv' ? 'capture-integrity' : 'command',
      op, op.op === 'recv' || op.op === 'uiContractReadiness' ? 122000 : 32000),
    async close() {
      if (!exited) child.stdin.end();
      const outcome = await Promise.race([ended, delay(2000, null, {ref: false})]);
      if (!outcome) {
        child.kill('SIGTERM');
        // Do not start another target operation or free resources while the
        // probe may still be waiting for its bounded in-flight HDC client.
        await ended;
      }
      return { ...exited, clean: !aborted && exited?.code === 0 &&
        records.at(-1)?.event === 'closed' && records.at(-1)?.reason === 'quit-or-eof' };
    },
    logPath: () => records[0]?.log,
    capturePath: remote => join(outputDir, remote.split('/').at(-1)),
  };
}
