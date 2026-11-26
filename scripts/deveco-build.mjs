#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portableSpawnSync, resolveHarmonyTool } from './lib/harmony-toolchain.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/deveco-build.mjs [--compile-only | Hvigor arguments]
Default: incremental debug assembleHap with project signing and output verification.
--compile-only: run incremental :entry:default@CompileArkTS with the Hvigor daemon.
Configure READER_DEVECO_HOME or HVIGORW. Delivery HAPs use scripts/hap-pipeline.mjs.`);
} else {
  try {
    const compileOnly = args.includes('--compile-only');
    if (compileOnly && args.length !== 1) throw new Error('--compile-only must be used on its own.');
    const hvigorArgs = !args.length || compileOnly ? [
      '--mode', 'module', '-p', 'module=entry@default', '-p', 'product=default',
      '-p', 'requiredDeviceType=phone', '-p', 'buildMode=debug',
      compileOnly ? 'default@CompileArkTS' : 'assembleHap',
      '--analyze=normal', '--parallel', '--incremental', '--daemon',
    ] : args;
    const hvigor = resolveHarmonyTool('hvigorw', { cwd: root });
    const result = portableSpawnSync(hvigor, hvigorArgs, { cwd: root, env: process.env, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status || (result.signal ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
