#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Keep Hvigor's supported major; never let its cold-cache fallback install 10.27.0.
export const REQUIRED_PNPM = '10.34.5';
export function sharedTools(env = process.env) {
  return resolve(env.HVIGOR_SHARED_TOOLS || resolve(env.HVIGOR_USER_HOME || resolve(homedir(), '.hvigor'), 'wrapper/tools'));
}
export function assertBuildTools(directory = sharedTools()) {
  const manifest = resolve(directory, 'node_modules/pnpm/package.json');
  if (!existsSync(manifest) || JSON.parse(readFileSync(manifest, 'utf8')).version !== REQUIRED_PNPM) {
    throw new Error(`Prepare Hvigor tools with: node tools/reader-build-tools.mjs --install (pnpm ${REQUIRED_PNPM} required)`);
  }
  const cli = resolve(directory, 'node_modules/pnpm/bin/pnpm.cjs');
  const result = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
  if (result.status !== 0 || result.stdout.trim() !== REQUIRED_PNPM) throw new Error('Hvigor pnpm executable/version mismatch');
  return { pnpm: REQUIRED_PNPM };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--install')) {
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
  console.log(JSON.stringify({ status: 'PASS', ...assertBuildTools() }));
}
