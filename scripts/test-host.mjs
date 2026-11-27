import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { journeys } from './lib/vm-journey-cases.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const testRoot = new URL('../tests/', import.meta.url);
const testsByDomain = new Map(readdirSync(testRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => [entry.name, readdirSync(new URL(`${entry.name}/`, testRoot))
    .filter(name => name.endsWith('.test.ts')).sort().map(name => `tests/${entry.name}/${name}`)])
  .filter(([, files]) => files.length > 0).sort(([left], [right]) => left.localeCompare(right)));

// These features share production seams. Paths outside known features need
// the full selection unless they are documentation or scoped Host tests.
const featureDomains = new Map([
  ['bookshelf', {
    hostDomains: ['bookshelf', 'contracts', 'search', 'detail-reading', 'downloads'],
    vmJourneys: ['J1', 'J2', 'J3', 'J14'],
  }],
  ['discover', { hostDomains: ['search', 'bookshelf'], vmJourneys: ['J7', 'J8'] }],
  ['downloads', { hostDomains: ['downloads', 'manga', 'navigation-geometry'], vmJourneys: ['J5'] }],
  ['manga', {
    hostDomains: ['manga', 'detail-reading', 'source-switch', 'downloads', 'navigation-geometry'],
    vmJourneys: ['J6'],
  }],
  ['reading', {
    hostDomains: ['detail-reading', 'bookshelf', 'manga', 'downloads', 'source-switch', 'settings-sync-rss', 'navigation-geometry'],
    vmJourneys: ['J2', 'J4', 'J6', 'J8', 'J9', 'J10', 'J11', 'J12', 'J14'],
  }],
  ['rss', { hostDomains: ['settings-sync-rss', 'navigation-geometry'], vmJourneys: ['J7', 'J8'] }],
  ['search', {
    hostDomains: ['search', 'bookshelf', 'contracts', 'detail-reading', 'source-switch', 'navigation-geometry'],
    vmJourneys: ['J2', 'J3', 'J6', 'J8'],
  }],
  ['settings', { hostDomains: ['settings-sync-rss', 'navigation-geometry'], vmJourneys: ['J7', 'J8', 'J11', 'J12', 'J14'] }],
  ['source', {
    hostDomains: ['bookshelf', 'contracts', 'search', 'source-management', 'source-switch'],
    vmJourneys: ['J2', 'J6', 'J7', 'J12', 'J13'],
  }],
  ['sync', { hostDomains: ['settings-sync-rss'], vmJourneys: ['J7', 'J8', 'J14'] }],
]);

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function committedHostChanges(baseRef, headRef = 'HEAD') {
  const base = git(['rev-parse', '--verify', '--end-of-options', `${baseRef}^{tree}`]).trim();
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  if (headRef !== 'HEAD' && git(['rev-parse', '--verify', '--end-of-options', `${headRef}^{commit}`]).trim() !== head) {
    throw new Error('--head must match the checked-out commit');
  }
  const paths = git(['diff', '--name-only', '--no-renames', '-z', base, head, '--']).split('\0').filter(Boolean);
  return { base, head, paths };
}

function workingHostChanges(baseRef) {
  const base = git(['rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`]).trim();
  const fork = git(['merge-base', base, 'HEAD']).trim();
  const tracked = git(['diff', '--no-renames', '--name-only', '-z', fork, '--']);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']);
  return [...tracked.split('\0'), ...untracked.split('\0')].filter(Boolean);
}

export function isHostDocument(path) {
  return path.endsWith('.md') || path.startsWith('docs/') || path.startsWith('.reader-artifacts/');
}

function featureImpact(path) {
  const feature = /^entry\/src\/main\/ets\/features\/([^/]+)\//.exec(path)?.[1];
  return featureDomains.get(feature);
}

export function affectedHostDomains(paths) {
  const selected = new Set();
  for (const path of paths) {
    if (isHostDocument(path)) continue;
    const ownDomain = /^tests\/([^/]+)\//.exec(path)?.[1];
    if (ownDomain && testsByDomain.has(ownDomain)) {
      selected.add(ownDomain);
      continue;
    }
    const affected = featureImpact(path)?.hostDomains;
    if (affected === undefined) return [...testsByDomain.keys()];
    for (const domain of affected) selected.add(domain);
  }
  return [...selected].sort();
}

export function suggestedVmJourneys(paths) {
  const selected = new Set();
  for (const path of paths) {
    if (isHostDocument(path) || path.startsWith('tests/')) continue;
    const affected = featureImpact(path)?.vmJourneys;
    if (affected === undefined) return Object.keys(journeys);
    for (const journey of affected) selected.add(journey);
  }
  return Object.keys(journeys).filter(journey => selected.has(journey));
}

const usage = 'Usage: node scripts/test-host.mjs --all | --domain <name> | --changed-from <baseRef> [--committed]';

function main(args) {
  const [flag, value, scope] = args;
  if (flag === '--help' && args.length === 1) {
    console.log(`${usage}\nDomains: ${[...testsByDomain.keys()].join(', ')}`);
    return;
  }
  if (testsByDomain.size === 0) throw new Error('No Host tests found');
  let domains;
  if (flag === '--all' && args.length === 1) domains = [...testsByDomain.keys()];
  else if (flag === '--domain' && args.length === 2 && testsByDomain.has(value)) domains = [value];
  else if (flag === '--changed-from' && value && (args.length === 2 || args.length === 3 && scope === '--committed')) {
    const paths = scope === '--committed' ? committedHostChanges(value).paths : workingHostChanges(value);
    domains = affectedHostDomains(paths);
  }
  else throw new Error(`${usage}\nDomains: ${[...testsByDomain.keys()].join(', ')}`);

  const files = domains.flatMap(domain => testsByDomain.get(domain) ?? []);
  if (files.length === 0) {
    console.log('Host tests NOT_RUN (no affected test domains)');
  } else {
    console.log(`Host domains: ${domains.join(', ')}`);
    const result = spawnSync(process.execPath, ['--import', './scripts/lib/register-reader-ts-module-loader.mjs',
      '--test', ...files], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
