import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyPrivateInputs } from '../docs/ui-design/app-baseline/private-inputs.mjs';

async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-reference-inputs-'));
  try {
    const files = {
      'evidence/session/registry.mjs': 'throw new Error("verification must not execute private code");',
      'evidence/session/captures/reader-control-redo-test.png': 'synthetic image bytes',
      'evidence/session/captures/reader-control-redo-test.json': '{"synthetic":true}',
      'evidence/session/session-preflight.json': '{"synthetic":true}',
    };
    for (const [name, content] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await fs.writeFile(path.join(root, name), content);
    }
    const contract = { registry: 'evidence/session/registry.mjs', sessions: ['evidence/session'],
      evidenceSnapshotAt: '2026-01-01T00:00:00Z', files: Object.fromEntries(Object.entries(files)
        .map(([name, content]) => [name, crypto.createHash('sha256').update(content).digest('hex')])) };
    await run(root, contract);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('private reference input verification binds real bytes without importing the registry', async () => fixture(async (root, contract) => {
  const result = await verifyPrivateInputs(root, contract);
  assert.equal(result.fileCount, 4);
  assert.equal(result.evidenceSnapshotAt, contract.evidenceSnapshotAt);
}));

test('missing private evidence fails with an explicit restore boundary', async () => fixture(async (root, contract) => {
  await fs.rename(path.join(root, 'evidence/session'), path.join(root, 'evidence/other'));
  await assert.rejects(verifyPrivateInputs(root, contract), /BASELINE_PRIVATE_INPUTS_MISSING/);
}));

test('changed private bytes cannot keep the previous approval hash', async () => fixture(async (root, contract) => {
  await fs.writeFile(path.join(root, 'evidence/session/registry.mjs'), 'changed private registry');
  await assert.rejects(verifyPrivateInputs(root, contract), /BASELINE_PRIVATE_INPUT_HASH_CHANGED/);
}));

test('an unreviewed new capture changes the closed input set', async () => fixture(async (root, contract) => {
  await fs.writeFile(path.join(root, 'evidence/session/captures/reader-control-redo-new.png'), 'new capture');
  await assert.rejects(verifyPrivateInputs(root, contract), /BASELINE_PRIVATE_INPUT_SET_CHANGED/);
}));
