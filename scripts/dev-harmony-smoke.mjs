#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portableSpawnSync } from './lib/harmony-toolchain.mjs';
import { resolveHarmonyAbi } from './hap-pipeline.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_ROOT = resolve(REPO_ROOT, process.env.READER_CORE_ROOT || '../Reader-Core');

function usage() {
  console.log(`Usage: node scripts/dev-harmony-smoke.mjs [--abi arm64-v8a|x86_64] [--skip-core] [--skip-hap] [--timings] [--dry-run]
Daily iteration helper using Core smoke profile (no ThinLTO) + incremental HAP build.
Release/acceptance builds still require scripts/hap-pipeline.mjs directly.`);
}

function parseArgs(argv) {
  let abi = process.env.READER_HARMONY_ABI || 'arm64-v8a';
  let abiSeen = false;
  let skipCore = false;
  let skipHap = false;
  let timings = false;
  let dryRun = false;
  let help = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--skip-core' && !skipCore) skipCore = true;
    else if (arg === '--skip-hap' && !skipHap) skipHap = true;
    else if (arg === '--timings' && !timings) timings = true;
    else if (arg === '--dry-run' && !dryRun) dryRun = true;
    else if (arg === '--abi' && !abiSeen) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw Object.assign(new Error('--abi requires a value'), { exitCode: 2 });
      abi = value;
      abiSeen = true;
    } else {
      throw Object.assign(new Error(`unknown argument: ${arg}`), { exitCode: 2 });
    }
  }
  return { abi: resolveHarmonyAbi(abi), skipCore, skipHap, timings, dryRun, help };
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }
  const bash = process.env.READER_BASH || 'bash';
  const nodeBin = process.env.READER_NODE || process.env.NODE || process.execPath;
  const pipeline = resolve(REPO_ROOT, 'scripts/hap-pipeline.mjs');
  const steps = [];
  if (!options.skipCore) {
    steps.push({
      name: 'core-smoke-native',
      cwd: CORE_ROOT,
      command: bash,
      args: [resolve(CORE_ROOT, 'scripts/build-harmony-napi.sh'), '--abi', options.abi, '--profile', 'smoke'],
    });
    steps.push({
      name: 'sync-native',
      cwd: REPO_ROOT,
      command: nodeBin,
      args: [pipeline, 'sync-native', '--abi', options.abi, '--core-profile', 'smoke'],
    });
  }
  if (!options.skipHap) {
    steps.push({
      name: 'hap-iteration-incremental',
      cwd: REPO_ROOT,
      command: nodeBin,
      args: [pipeline, 'build', '--class', 'iteration', '--incremental', '--abi', options.abi, '--core-profile', 'smoke'],
      ...(options.timings ? { env: { READER_HAP_TIMINGS: '1' } } : {}),
    });
  }
  if (options.dryRun) {
    console.log(JSON.stringify({ status: 'DRY_RUN', abi: options.abi, steps }, null, 2));
    process.exit(0);
  }
  for (const step of steps) {
    const result = portableSpawnSync(step.command, step.args, {
      cwd: step.cwd,
      stdio: 'inherit',
      env: step.env ? { ...process.env, ...step.env } : process.env,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
}
