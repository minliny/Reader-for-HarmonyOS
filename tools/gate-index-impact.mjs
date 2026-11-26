#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createImpactView, diffImpactViews } from './lib/gate-index-impact.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const usage = `Reader gate index, read-only impact queries
  node tools/gate-index-impact.mjs --affected entry/src/main/ets/features/search/ui/SearchPage.ets
  node tools/gate-index-impact.mjs --affected old/path new/path
  node tools/gate-index-impact.mjs --deps ui-case:bookshelf.search-no-sources
  node tools/gate-index-impact.mjs --deps structure-rule:<rule-id> --compare <earlier-query.json>
  node tools/gate-index-impact.mjs --check-deps --deps ui-case:bookshelf.search-no-sources

Use repository-relative paths. For a rename, supply both paths. The full JSON
contains known dependencies, reverse references and gaps. --check-deps validates
only the canonical structure definition and explicitly selected scenario/case
bindings (or select a structure-rule: for the definition alone). No evidence is
admitted or executed. Use tools/gate-index.mjs for reviewed --id/--run.`;

function identity(command, fallback) {
  try {
    return execFileSync('git', ['-C', root, ...command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim() || fallback;
  } catch {
    return fallback;
  }
}

export function parseImpactArguments(args = process.argv.slice(2)) {
  const { values, tokens } = parseArgs({ args, options: {
    affected: { type: 'string', multiple: true },
    deps: { type: 'string', multiple: true },
    compare: { type: 'string' },
    'check-deps': { type: 'boolean' },
    help: { type: 'boolean' },
  }, allowPositionals: true, tokens: true });
  const affected = [];
  let collectingPaths = false;
  for (const token of tokens) {
    if (token.kind === 'positional') {
      if (!collectingPaths) throw new Error(`Unexpected positional argument '${token.value}'. Use --affected to group paths.`);
      affected.push(token.value);
      continue;
    }
    collectingPaths = token.kind === 'option' && token.name === 'affected';
    if (collectingPaths) affected.push(token.value);
  }
  if (affected.length > 0) values.affected = affected;
  return values;
}

function main() {
  const values = parseImpactArguments();
  if (values.help || !Object.keys(values).length) {
    console.log(usage);
    return;
  }
  if (values['check-deps'] && (!values.deps || values.affected)) {
    throw new Error('--check-deps requires --deps source-qualified IDs and does not accept --affected.');
  }
  if (Boolean(values.affected) === Boolean(values.deps)) {
    throw new Error('Provide --affected paths or --deps source-qualified IDs.');
  }
  const view = createImpactView({ root, affected: values.affected, deps: values.deps, checkDeps: values['check-deps'] });
  view.maintenance = {
    root,
    branch: identity(['branch', '--show-current'], null),
    head: identity(['rev-parse', 'HEAD'], null),
    entry: fileURLToPath(import.meta.url),
    reviewedEntry: resolve(root, 'tools/gate-index.mjs'),
    impactReaderSha256: createHash('sha256')
      .update(readFileSync(fileURLToPath(import.meta.url)))
      .update(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'lib/gate-index-impact.mjs')))
      .update(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'lib/gate-resource-definition.mjs')))
      .update(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'ui-contract/lib/case-registry.mjs')))
      .update(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'ui-contract/lib/structure-contract.mjs')))
      .update(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'ui-contract/lib/capsule-model-inputs.mjs')))
      .update(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'ui-contract/lib/control-input.mjs')))
      .digest('hex'),
  };
  if (values.compare) view.diff = diffImpactViews(JSON.parse(readFileSync(values.compare, 'utf8')), view);
  console.log(JSON.stringify(view, null, 2));
  if (view.dependencyCheck.status === 'FAIL') process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
