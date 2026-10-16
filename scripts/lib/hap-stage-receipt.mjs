import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

// Record the existing pipeline's commands; this module never executes tasks.
export function hapStageReceipt(root, inputs) {
  const id = `${Date.now()}-${randomUUID()}`, directory = join(root, id);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, 'stages.json'), secrets = new Set();
  const redact = value => {
    let text = String(value ?? '');
    for (const secret of secrets) text = text.split(secret).join('<private>');
    return text.replace(/-----BEGIN[\s\S]*?-----END[^\n]*-----/g, '<private material>')
      .split(/\r?\n/).map(line => /password|keyalias|storefile|certpath|certificate|subject:|issuer:|profile.*(?:path|content)/i.test(line) ? '<private signing diagnostic redacted>' : line).join('\n');
  };
  const report = { schemaVersion: 1, name: 'reader-hap-build-stages', id, inputs, status: 'RUNNING', startedAt: new Date().toISOString(), stages: [] };
  const persist = () => writeFileSync(file, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  persist();
  return { file, report, redact, bindInputs(value) { report.inputs = value; persist(); }, protect(value) {
    if (typeof value === 'string' && value.length > 3) secrets.add(value);
    else if (value && typeof value === 'object') for (const child of Object.values(value)) this.protect(child);
  }, begin(binary, args) {
    const row = { id: report.stages.length + 1, executable: basename(binary), args: args.map(redact), status: 'RUNNING', startedAt: new Date().toISOString() };
    report.stages.push(row); persist(); return row;
  }, end(row, result, milliseconds) {
    const output = redact(`${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}`);
    const log = `${row.id}.log`; writeFileSync(join(directory, log), output, { mode: 0o600 });
    Object.assign(row, { status: result.status === 0 && !result.error ? 'PASS' : 'FAIL', exitCode: result.status, signal: result.signal,
      milliseconds, endedAt: new Date().toISOString(), log, logSha256: createHash('sha256').update(output).digest('hex') }); persist();
  }, finish(error) {
    report.status = error ? 'FAIL' : 'PASS'; report.endedAt = new Date().toISOString();
    if (error) report.failure = redact(error.message);
    persist(); console.log(JSON.stringify({ stage: 'hapBuildAttempt', status: report.status, receipt: file }));
  } };
}
