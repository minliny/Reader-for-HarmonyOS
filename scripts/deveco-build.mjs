#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portableSpawnSync, resolveHarmonyTool } from './lib/harmony-toolchain.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/deveco-build.mjs [Hvigor arguments]\nDefault: incremental debug assembleHap. Uses the project signing and output verification hooks.\nConfigure READER_DEVECO_HOME or HVIGORW; delivery HAPs use scripts/hap-pipeline.mjs.');
} else {
  try {
    const hvigor = resolveHarmonyTool('hvigorw', { cwd: root });
    const result = portableSpawnSync(hvigor, args.length ? args : [
      '--mode', 'module', '-p', 'module=entry@default', '-p', 'product=default',
      '-p', 'requiredDeviceType=phone', '-p', 'buildMode=debug', 'assembleHap',
      '--analyze=normal', '--parallel', '--incremental', '--daemon',
    ], { cwd: root, env: process.env, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status || (result.signal ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
