#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { assertVerifiedHostRelease } from '../../Reader-UI/tools/release/host-consumer-release-lib.mjs';
import {
  assertReaderUiReleaseBumpPaths,
  assertReaderUiReleaseLocksSynchronized,
  READER_UI_CONSUMER_LOCK_PATH,
  READER_UI_PACKAGE_LOCK_PATH,
  READER_UI_RELEASE_BUMP_PATHS,
} from './reader_ui_release_lock_lib.mjs';

const requiredFlags = new Set([
  '--base',
  '--consumer-lock',
  '--github-token-env',
  '--host-root',
  '--host-repository',
  '--package-lock',
  '--verified-release',
]);

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

function canonicalArgument(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value || /[\r\n\0]/.test(value)) {
    throw new Error(`${label} must be a non-empty canonical string`);
  }
  return value;
}

function run(command, args, { cwd, env = process.env, acceptedStatuses = [0] } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
  if (result.error) throw new Error(`${command} failed to start: ${result.error.message}`);
  if (!acceptedStatuses.includes(result.status)) {
    const detail = `${result.stderr || result.stdout}`.replace(/[\r\n]+/g, ' ').trim().slice(0, 800);
    throw new Error(`${command} ${args[0] ?? ''} failed with status ${result.status}${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function outputPaths(output) {
  return output.split(/\r?\n/).filter(Boolean);
}

function readReleaseLocks(consumerPath, packagePath) {
  const consumer = JSON.parse(fs.readFileSync(consumerPath, 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assertReaderUiReleaseLocksSynchronized(consumer, packageLock);
  return { consumer, packageLock };
}

try {
  const values = parseArguments(process.argv.slice(2));
  const hostRoot = path.resolve(values.get('--host-root'));
  const consumerPath = path.resolve(values.get('--consumer-lock'));
  const packagePath = path.resolve(values.get('--package-lock'));
  const relative = (file) => path.relative(hostRoot, file).split(path.sep).join('/');
  if (relative(consumerPath) !== READER_UI_CONSUMER_LOCK_PATH) {
    throw new Error(`--consumer-lock must resolve to ${READER_UI_CONSUMER_LOCK_PATH}`);
  }
  if (relative(packagePath) !== READER_UI_PACKAGE_LOCK_PATH) {
    throw new Error(`--package-lock must resolve to ${READER_UI_PACKAGE_LOCK_PATH}`);
  }

  const verified = assertVerifiedHostRelease(
    JSON.parse(fs.readFileSync(path.resolve(values.get('--verified-release')), 'utf8')),
  );
  if (verified.host !== 'harmonyos') throw new Error('verified release must target harmonyos');
  const hostRepository = canonicalArgument(values.get('--host-repository'), '--host-repository');
  if (verified.hostRepository !== hostRepository) {
    throw new Error(`verified host repository ${verified.hostRepository} does not match ${hostRepository}`);
  }
  const base = canonicalArgument(values.get('--base'), '--base');
  if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(base) || base.includes('..') || base.endsWith('/')) {
    throw new Error('--base is not a safe Git branch name');
  }
  const tokenEnvironment = canonicalArgument(values.get('--github-token-env'), '--github-token-env');
  if (!/^[A-Z_][A-Z0-9_]*$/.test(tokenEnvironment)) {
    throw new Error('--github-token-env must name a canonical environment variable');
  }
  const token = process.env[tokenEnvironment];
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`${tokenEnvironment} is required to push the bump branch and create the draft PR`);
  }
  const ghEnvironment = { ...process.env, GH_TOKEN: token };
  const locks = readReleaseLocks(consumerPath, packagePath);
  if (locks.consumer.releaseIdentity?.releaseId !== verified.releaseId) {
    throw new Error('consumer lock does not record the verified releaseId');
  }

  run('gh', ['auth', 'setup-git'], { cwd: hostRoot, env: ghEnvironment });
  run('git', ['rev-parse', '--is-inside-work-tree'], { cwd: hostRoot });
  const status = run('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: hostRoot }).stdout;
  const diffPaths = outputPaths(run(
    'git',
    ['diff', '--name-only', '--', ...READER_UI_RELEASE_BUMP_PATHS],
    { cwd: hostRoot },
  ).stdout);

  if (diffPaths.length === 0) {
    if (status.trim().length !== 0) {
      throw new Error('host repository has changes even though both Reader UI release locks are current');
    }
    console.log(`[reader-ui-bump-pr] PASS already-current releaseId=${verified.releaseId}`);
    process.exit(0);
  }
  assertReaderUiReleaseBumpPaths(diffPaths, 'working tree lock diff');
  const statusPaths = outputPaths(status).map((line) => line.slice(3));
  assertReaderUiReleaseBumpPaths(statusPaths, 'host repository status');
  run('git', ['diff', '--check', '--', ...READER_UI_RELEASE_BUMP_PATHS], { cwd: hostRoot });

  const remoteCheck = run(
    'git',
    ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${verified.branch}`],
    { cwd: hostRoot, env: ghEnvironment, acceptedStatuses: [0, 2] },
  );
  if (remoteCheck.status === 0) {
    const remoteRef = `refs/remotes/origin/${verified.branch}`;
    run('git', ['fetch', '--no-tags', 'origin', `refs/heads/${verified.branch}:${remoteRef}`], {
      cwd: hostRoot,
      env: ghEnvironment,
    });
    const parents = run('git', ['rev-list', '--parents', '-n', '1', remoteRef], { cwd: hostRoot })
      .stdout.trim().split(/\s+/);
    if (parents.length !== 2) throw new Error('existing deterministic bump branch must contain a single-parent commit');
    assertReaderUiReleaseBumpPaths(
      outputPaths(run(
        'git',
        ['diff-tree', '--no-commit-id', '--name-only', '-r', parents[1], remoteRef],
        { cwd: hostRoot },
      ).stdout),
      'existing deterministic bump commit',
    );
    for (const relativePath of READER_UI_RELEASE_BUMP_PATHS) {
      const remoteBytes = run('git', ['show', `${remoteRef}:${relativePath}`], { cwd: hostRoot }).stdout;
      if (remoteBytes !== fs.readFileSync(path.join(hostRoot, relativePath), 'utf8')) {
        throw new Error(`existing deterministic bump branch has a conflicting ${relativePath}`);
      }
    }
    const pulls = parseJson(
      run(
        'gh',
        [
          'pr', 'list', '--repo', hostRepository, '--base', base, '--head', verified.branch,
          '--state', 'all', '--json', 'baseRefName,headRefName,isDraft,number,state,url',
        ],
        { cwd: hostRoot, env: ghEnvironment },
      ).stdout,
      'gh pr list',
    );
    if (!Array.isArray(pulls) || pulls.length !== 1) {
      throw new Error('existing deterministic bump branch must have exactly one PR');
    }
    const pull = pulls[0];
    if (pull.state !== 'OPEN' || pull.isDraft !== true ||
      pull.baseRefName !== base || pull.headRefName !== verified.branch) {
      throw new Error('existing releaseId PR is not the expected open draft PR');
    }
    console.log(`[reader-ui-bump-pr] PASS existing-draft releaseId=${verified.releaseId} url=${pull.url}`);
    process.exit(0);
  }

  run('git', ['switch', '-c', verified.branch], { cwd: hostRoot });
  run('git', ['add', '--', ...READER_UI_RELEASE_BUMP_PATHS], { cwd: hostRoot });
  assertReaderUiReleaseBumpPaths(
    outputPaths(run('git', ['diff', '--cached', '--name-only'], { cwd: hostRoot }).stdout),
    'staged bump',
  );
  run(
    'git',
    [
      '-c', 'user.name=reader-ui-release-bot',
      '-c', 'user.email=reader-ui-release-bot@users.noreply.github.com',
      'commit', '-m', `chore: bump Reader UI to ${verified.tag}`,
    ],
    { cwd: hostRoot },
  );
  run('git', ['push', '--set-upstream', 'origin', verified.branch], { cwd: hostRoot, env: ghEnvironment });

  const title = `chore: bump Reader UI to ${verified.tag}`;
  const body = [
    'Automated Reader UI consumer and HarmonyOS package lock bump.',
    '',
    `- Release: \`${verified.releaseId}\``,
    `- Source SHA: \`${verified.sourceSha}\``,
    `- Manifest SHA-256: \`${verified.manifestSha256}\``,
    `- Target config SHA-256: \`${verified.targetConfigSha256}\``,
    `- Artifact ID: \`${verified.artifact.id}\``,
    `- Proof boundary: ${verified.proofBoundary}`,
    '',
    'This PR is intentionally draft and is never auto-merged.',
  ].join('\n');
  const url = run(
    'gh',
    [
      'pr', 'create', '--repo', hostRepository, '--base', base, '--head', verified.branch,
      '--draft', '--title', title, '--body', body,
    ],
    { cwd: hostRoot, env: ghEnvironment },
  ).stdout.trim();
  const pull = parseJson(
    run(
      'gh',
      [
        'pr', 'view', verified.branch, '--repo', hostRepository,
        '--json', 'baseRefName,headRefName,isDraft,number,state,url',
      ],
      { cwd: hostRoot, env: ghEnvironment },
    ).stdout,
    'gh pr view',
  );
  if (pull.state !== 'OPEN' || pull.isDraft !== true ||
    pull.baseRefName !== base || pull.headRefName !== verified.branch) {
    throw new Error('created Reader UI bump PR is not an open draft with the expected base/head');
  }
  console.log(`[reader-ui-bump-pr] PASS created releaseId=${verified.releaseId} url=${pull.url || url}`);
} catch (error) {
  console.error(`[reader-ui-bump-pr] FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
