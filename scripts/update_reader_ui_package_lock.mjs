#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  assertReaderUiReleaseLocksSynchronized,
  assertVerifiedHarmonyReleaseMatchesConsumer,
  updateReaderUiRuntimePackageVersion,
} from './reader_ui_release_lock_lib.mjs';

const requiredFlags = new Set(['--consumer-lock', '--package-lock', '--verified-release']);

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!requiredFlags.has(flag)) throw new Error(`unknown argument: ${flag ?? '<missing>'}`);
    if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
      throw new Error(`${flag} requires a value`);
    }
    if (values.has(flag)) throw new Error(`duplicate argument: ${flag}`);
    values.set(flag, value);
  }
  for (const flag of requiredFlags) {
    if (!values.has(flag)) throw new Error(`${flag} is required`);
  }
  return values;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary);
  }
}

try {
  const values = parseArguments(process.argv.slice(2));
  const consumerPath = path.resolve(values.get('--consumer-lock'));
  const packagePath = path.resolve(values.get('--package-lock'));
  const verifiedPath = path.resolve(values.get('--verified-release'));
  const consumer = readJson(consumerPath, 'Reader UI consumer lock');
  const verified = readJson(verifiedPath, 'verified Reader UI release');
  assertVerifiedHarmonyReleaseMatchesConsumer(verified, consumer);
  const packageLock = readJson(packagePath, 'HarmonyOS package lock');
  const updated = updateReaderUiRuntimePackageVersion(packageLock, verified.readerUiVersion);
  assertReaderUiReleaseLocksSynchronized(consumer, updated);
  writeJsonAtomic(packagePath, updated);
  console.log(`[reader-ui-package-lock] PASS version=${verified.readerUiVersion}`);
} catch (error) {
  console.error(`[reader-ui-package-lock] FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
