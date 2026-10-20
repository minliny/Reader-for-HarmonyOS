#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

// Reproducible release-profile pin, not an upstream compatibility range.
export const REQUIRED_PNPM = '10.34.5';
export function sharedTools(env = process.env) {
  return resolve(env.HVIGOR_SHARED_TOOLS || resolve(env.HVIGOR_USER_HOME || resolve(homedir(), '.hvigor'), 'wrapper/tools'));
}
export function assertBuildTools(directory = sharedTools(), { profile = 'development' } = {}) {
  if (!['development', 'release'].includes(profile)) throw new Error('Unknown build-tool profile');
  const manifest = resolve(directory, 'node_modules/pnpm/package.json');
  if (!existsSync(manifest)) throw new Error('Prepared pnpm is missing; install it explicitly, never during a build');
  const { name, version } = JSON.parse(readFileSync(manifest, 'utf8'));
  if (name !== 'pnpm' || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('Invalid prepared pnpm identity');
  if (profile === 'release' && version !== REQUIRED_PNPM) {
    throw new Error(`Release profile is pinned to pnpm ${REQUIRED_PNPM}; this is not a development compatibility verdict`);
  }
  const cli = resolve(directory, 'node_modules/pnpm/bin/pnpm.cjs');
  const result = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8', timeout: 10_000 });
  if (result.error || result.status !== 0 || result.stdout.trim() !== version) throw new Error('Hvigor pnpm executable/version mismatch');
  return { pnpm: version, profile, toolIdentity: 'VERIFIED', compatibility: 'Actual Hvigor execution determines compatibility; no unverified version range is asserted.' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { install: { type: 'boolean' }, profile: { type: 'string', default: 'development' } }, allowPositionals: false });
  if (values.install) {
    const configuredCli = process.env.READER_NPM_CLI || process.env.NPM_CLI_JS;
    const candidates = [configuredCli,
      resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
    try { candidates.push(createRequire(import.meta.url).resolve('npm/bin/npm-cli.js')); } catch {}
    const npmCli = candidates.find(candidate => existsSync(candidate));
    if (configuredCli && !existsSync(configuredCli)) throw new Error('READER_NPM_CLI / NPM_CLI_JS must identify npm-cli.js');
    if (!npmCli && process.platform === 'win32') throw new Error('npm-cli.js not found. Set READER_NPM_CLI to the Node installation npm/bin/npm-cli.js entry point.');
    const result = spawnSync(npmCli ? process.execPath : 'npm',
      [...(npmCli ? [resolve(npmCli)] : []), 'install', '--prefix', sharedTools(), '--save-exact', '--ignore-scripts', '--no-fund', `pnpm@${REQUIRED_PNPM}`],
      { stdio: 'inherit', shell: false });
    if (result.status !== 0) process.exit(result.status || 1);
  }
  console.log(JSON.stringify({ status: 'AVAILABLE', ...assertBuildTools(sharedTools(), { profile: values.profile }) }));
}
