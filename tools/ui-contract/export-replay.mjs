#!/usr/bin/env node
import { mkdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { equalJson, replayToolFiles, toolIdentity, toolRoot } from './lib/cases.mjs';
import { evidenceStore, requireEvidence } from './lib/evidence.mjs';

export function exportReplayTool(directory) {
  const output = resolve(directory);
  const repo = fileURLToPath(new URL('../../', toolRoot));
  const sourceIdentity = toolIdentity();
  mkdirSync(output, {mode:0o700});
  const store = evidenceStore(output);
  for (const path of replayToolFiles()) {
    const file = new URL(path, toolRoot);
    store.write(relative(repo, fileURLToPath(file)), readFileSync(file));
  }
  const identity = toolIdentity(pathToFileURL(join(output, 'tools/ui-contract') + '/'));
  requireEvidence(equalJson(sourceIdentity, identity), 'Replay tool inputs changed during export');
  store.writeJson('tool-identity.json', identity);
  return identity;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireEvidence(process.argv.length === 3 && !process.argv[2].startsWith('-'),
      'Supply one new replay tool output directory');
    console.log(JSON.stringify(exportReplayTool(process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
