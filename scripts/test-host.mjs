import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const testRoot = new URL('../tests/', import.meta.url);
const testsByDomain = new Map(readdirSync(testRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => [entry.name, readdirSync(new URL(`${entry.name}/`, testRoot))
    .filter(name => name.endsWith('.test.ts')).sort().map(name => `tests/${entry.name}/${name}`)])
  .filter(([, files]) => files.length > 0).sort(([left], [right]) => left.localeCompare(right)));

// These features share production seams. App, platform, test infrastructure,
// and any unfamiliar path can change multiple domains, so they select all.
const featureDomains = new Map([
  ['bookshelf', ['bookshelf', 'contracts', 'search', 'detail-reading', 'downloads']],
  ['discover', ['search', 'bookshelf']],
  ['downloads', ['downloads', 'manga', 'navigation-geometry']],
  ['manga', ['manga', 'detail-reading', 'source-switch', 'downloads', 'navigation-geometry']],
  ['reading', ['detail-reading', 'bookshelf', 'manga', 'downloads', 'source-switch', 'settings-sync-rss', 'navigation-geometry']],
  ['rss', ['settings-sync-rss', 'navigation-geometry']],
  ['search', ['search', 'bookshelf', 'contracts', 'detail-reading', 'source-switch', 'navigation-geometry']],
  ['settings', ['settings-sync-rss', 'navigation-geometry']],
  ['sync', ['settings-sync-rss']],
]);

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function changedDomains(baseRef) {
  const base = git(['rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`]).trim();
  const fork = git(['merge-base', base, 'HEAD']).trim();
  const tracked = git(['diff', '--no-renames', '--name-only', '-z', fork, '--']);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']);
  const selected = new Set();
  for (const path of [...tracked.split('\0'), ...untracked.split('\0')]) {
    if (!path || path.startsWith('docs/') || /^[^/]+\.md$/i.test(path)) continue;
    const ownDomain = /^tests\/([^/]+)\//.exec(path)?.[1];
    if (ownDomain && testsByDomain.has(ownDomain)) {
      selected.add(ownDomain);
      continue;
    }
    const feature = /^entry\/src\/main\/ets\/features\/([^/]+)\//.exec(path)?.[1];
    const affected = featureDomains.get(feature);
    if (affected === undefined) return [...testsByDomain.keys()];
    for (const domain of affected) selected.add(domain);
  }
  return [...selected].sort();
}

const args = process.argv.slice(2);
const usage = 'Usage: node scripts/test-host.mjs --all | --domain <name> | --changed-from <baseRef>';
const [flag, value] = args;
if (flag === '--help' && args.length === 1) {
  console.log(`${usage}\nDomains: ${[...testsByDomain.keys()].join(', ')}`);
  process.exit(0);
}

try {
  if (testsByDomain.size === 0) throw new Error('No Host tests found');
  let domains;
  if (flag === '--all' && args.length === 1) domains = [...testsByDomain.keys()];
  else if (flag === '--domain' && args.length === 2 && testsByDomain.has(value)) domains = [value];
  else if (flag === '--changed-from' && args.length === 2 && value.length > 0) domains = changedDomains(value);
  else throw new Error(`${usage}\nDomains: ${[...testsByDomain.keys()].join(', ')}`);

  const files = domains.flatMap(domain => testsByDomain.get(domain) ?? []);
  if (files.length === 0) {
    console.log('Host tests NOT_RUN (no affected test domains)');
  } else {
    console.log(`Host domains: ${domains.join(', ')}`);
    const result = spawnSync(process.execPath, ['--experimental-loader', './scripts/reader-ts-module-loader.mjs',
      '--test', ...files], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
