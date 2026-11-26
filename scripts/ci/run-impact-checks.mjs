#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const impactTool = 'tools/gate-index-impact.mjs';
const gateTool = 'tools/gate-index.mjs';
const gateCatalog = 'tools/gate-index.json';
const impactArgumentBytes = 80 * 1024;
const nodeCosts = new Set(['plain-js', 'plain-js-and-fixtures', 'local-method']);
const testName = /^test-[A-Za-z0-9._-]+\.mjs$/;
const externalPrerequisite = /\b(?:[\w-]+-cli|(?:Core|Reader) CLI|Harmony(?:OS)? SDK|ETS(?: compiler| loader)?|Python\d*|fontTools|hvigorw?|ohpm|es2abc|openssl|clang|hdc|native (?:compiler|build|runtime)|shared build lease|Reader-UI)\b/i;
const externalDefinition = /\.(?:so|dylib|node)$|(?:^|\/)(?:ets-compiler-runtime|ets-pure-module-probe|[^/]+-sdk-probe|[^/]+-native-probe)\.mjs$/i;
const siblingReference = /(?:\.\.\/)+(?:Reader-Core|Reader-UI|Reader-for-Android|Reader-for-iOS)\b/;
const definitionDrift = /^(?:REVIEW_NEEDED for changed (?:definition |resource\/case declaration)|symlink definition input requires review:|definition input must be a regular file:)|reviewed case\/resource definition changed;/;

function readArguments() {
  const { values, tokens } = parseArgs({
    allowPositionals: true,
    tokens: true,
    options: {
      base: { type: 'string' },
      head: { type: 'string', default: 'HEAD' },
      files: { type: 'string', multiple: true },
      'max-cases': { type: 'string', default: '20' },
      'summary-file': { type: 'string' },
      'output-file': { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  const files = [];
  let collectingFiles = false;
  for (const token of tokens) {
    if (token.kind === 'positional') {
      if (!collectingFiles) throw new Error(`Unexpected argument ${JSON.stringify(token.value)}. Use --files to list paths.`);
      files.push(token.value);
      continue;
    }
    collectingFiles = token.kind === 'option' && token.name === 'files';
    if (collectingFiles) files.push(token.value);
  }
  return { ...values, files };
}

function command(binary, args, stderr = 'inherit') {
  return execFileSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', stderr],
  });
}

function gitCommit(revision) {
  return command('git', ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`]).trim();
}

function changedPaths({ base, head, files }) {
  if (files.length) {
    if (base !== undefined) throw new Error('Choose --files or a --base/--head comparison.');
    if (head !== 'HEAD' && gitCommit(head) !== gitCommit('HEAD')) throw new Error('--head must match the checked-out commit.');
    return { paths: files };
  }
  if (!base) throw new Error('Provide --base or --files.');
  const headCommit = gitCommit(head);
  if (headCommit !== gitCommit('HEAD')) throw new Error('--head must match the checked-out commit.');
  const baseTree = command('git', ['rev-parse', '--verify', '--end-of-options', `${base}^{tree}`]).trim();
  // With rename detection off, Git returns the old and new paths separately.
  const paths = command('git', ['diff', '--name-only', '-z', '--no-renames', baseTree, headCommit, '--'])
    .split('\0').filter(Boolean);
  return { paths, baseTree };
}

function hostPath(path) {
  if (typeof path !== 'string' || !path || path.includes('\0')) return null;
  const normalized = posix.normalize(path.replaceAll('\\', '/'));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') ||
      posix.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) return null;
  return normalized;
}

function nonDocumentPaths(paths) {
  const unique = new Set();
  for (const path of paths) {
    const normalized = hostPath(path);
    if (!normalized) throw new Error(`Expected a Host-relative path, got ${JSON.stringify(path)}.`);
    if (!normalized.startsWith('docs/') && !normalized.startsWith('.reader-artifacts/') && !normalized.endsWith('.md')) {
      unique.add(normalized);
    }
  }
  return [...unique].sort();
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function catalogEntriesById(catalog) {
  if (!Array.isArray(catalog.entries) || !Array.isArray(catalog.caseEntries ?? [])) return null;
  const byId = new Map();
  for (const [group, entries] of [['entries', catalog.entries], ['caseEntries', catalog.caseEntries ?? []]]) {
    for (const entry of entries) {
      if (typeof entry?.id !== 'string' || !entry.id || byId.has(entry.id)) return null;
      byId.set(entry.id, { group, entry });
    }
  }
  return byId;
}

function changedCatalogGates(baseTree, catalog) {
  let previous;
  try {
    previous = JSON.parse(command('git', ['show', `${baseTree}:${gateCatalog}`], 'ignore'));
  } catch {
    return null;
  }
  if (previous?.schemaVersion !== 1 || catalog?.schemaVersion !== previous.schemaVersion ||
      catalog.completeReview !== previous.completeReview || catalog.reviewedDefinitionsFrozen !== previous.reviewedDefinitionsFrozen) return null;
  const before = catalogEntriesById(previous);
  const after = catalogEntriesById(catalog);
  if (!before || !after) return null;
  const changed = new Set();
  for (const [id, record] of after) {
    if (!isDeepStrictEqual(before.get(id), record)) changed.add(`gate:${id}`);
  }
  return changed;
}

function hasNoDeclaredResources(entry, manifest) {
  return entry.tests.every(test => {
    if (!testName.test(test)) return false;
    const cases = entry.caseSelection?.[test] ?? [];
    if (cases.length) {
      return cases.every(id => manifest.files?.[test]?.cases?.[id]?.resources?.length === 0);
    }
    return manifest.legacy?.[test]?.resources?.length === 0;
  });
}

function isNodeOnly(entry, manifest) {
  if (entry.qualification !== 'QUALIFIED' || entry.definitionInputProblems?.length !== 0 ||
      !nodeCosts.has(entry.estimatedCostType) || !entry.tests?.length || !entry.definitionInputs?.length ||
      entry.nestedActions?.length || entry.nestedCalls?.length || entry.resourceNeeds?.length ||
      entry.prerequisites?.some(prerequisite => externalPrerequisite.test(prerequisite))) return false;
  if (!entry.definitionInputs.every(({ path }) => hostPath(path) && !externalDefinition.test(path)) ||
      !Object.values(entry.executionEnvRoots ?? {}).every(hostPath)) return false;
  if (!hasNoDeclaredResources(entry, manifest)) return false;

  // Some historical plain-js entries still open a sibling checkout directly.
  return entry.tests.every(test => {
    try {
      return !siblingReference.test(readFileSync(resolve(root, 'tools', test), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  });
}

function affectedGates(paths, baseTree) {
  const catalog = readJson(gateCatalog);
  // The graph binds the catalog file to every gate. In a Git comparison the
  // changed records supply the exact catalog impact without widening other paths.
  const catalogGates = baseTree && paths.includes(gateCatalog) ? changedCatalogGates(baseTree, catalog) : null;
  const impacted = new Set(catalogGates ?? []);
  // Direct matches and reverse references are impacted. Prerequisites alone
  // are inputs to those checks, so the query does not select them for CI.
  const addBatch = args => {
    const impact = JSON.parse(command(process.execPath, [impactTool, ...args]));
    for (const id of [...impact.direct, ...impact.references]) impacted.add(id);
  };
  let args = [];
  let bytes = 0;
  for (const path of paths) {
    if (path === gateCatalog && catalogGates !== null) continue;
    const arg = `--affected=${path}`;
    const argBytes = Buffer.byteLength(arg) + 1;
    if (args.length && bytes + argBytes > impactArgumentBytes) {
      addBatch(args);
      args = [];
      bytes = 0;
    }
    args.push(arg);
    bytes += argBytes;
  }
  if (args.length) addBatch(args);
  if (!impacted.size) return [];
  const resources = readJson('tools/contract-case-manifest.json');
  return [...catalog.entries, ...(catalog.caseEntries ?? [])]
    .filter(entry => impacted.has(`gate:${entry.id}`) && isNodeOnly(entry, resources))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
}

function printResult(options, status, paths, results, started, reason = '') {
  const title = `${status} — Host incremental checks${reason ? ` (${reason})` : ''}`;
  const detail = `Non-document paths: ${paths.length}\nNode gates selected: ${results.length}, executed: ${started}`;
  const rows = results.map(({ id, status, reason }) => `- ${id}: ${status}${reason ? ` (${reason})` : ''}`).join('\n');
  const report = `${title}\n\n${detail}${rows ? `\n\n${rows}` : ''}`;
  console.log(report);
  if (options['summary-file'] !== undefined) appendFileSync(options['summary-file'], `\n## ${report}\n`);
  if (options['output-file'] !== undefined) {
    appendFileSync(options['output-file'], `non_document=${paths.length > 0}\nselected=${results.length}\nexecuted=${started}\n`);
  }
}

function hasDefinitionDrift(reason, inputs) {
  if (definitionDrift.test(reason)) return true;
  return reason.startsWith('ENOENT:') && inputs.some(({ path }) => reason.endsWith(`'${resolve(root, path)}'`));
}

function main() {
  const options = readArguments();
  if (options.help) {
    console.log('Usage: node scripts/ci/run-impact-checks.mjs (--base <commit> [--head <commit>] | --files <path>...) [--max-cases <count>] [--summary-file <path>] [--output-file <path>]');
    return;
  }
  const cap = Number(options['max-cases']);
  if (!/^\d+$/.test(options['max-cases']) || !Number.isSafeInteger(cap) || cap < 1) {
    throw new Error('--max-cases must be a positive integer.');
  }
  const changes = changedPaths(options);
  const paths = nonDocumentPaths(changes.paths);
  const results = [];
  const candidates = paths.length ? affectedGates(paths, changes.baseTree) : [];
  let started = 0;
  for (const { id, definitionInputs } of candidates) {
    if (started === cap) {
      results.push({ id, status: 'NOT_RUN', reason: `case limit ${cap} reached` });
      continue;
    }

    const { entries } = JSON.parse(command(process.execPath, [gateTool, '--id', id]));
    const admission = entries.find(entry => entry.id === id)?.admission;
    if (admission?.status !== 'READY') {
      const reason = admission?.reason ?? 'gate query did not return an admission';
      const status = admission?.status === 'BLOCKED' && hasDefinitionDrift(reason, definitionInputs) ? 'SKIPPED_DEFINITION_DRIFT' : 'FAIL';
      results.push({ id, status, reason });
      continue;
    }

    started++;
    const run = spawnSync(process.execPath, [gateTool, '--id', id, '--run', '--change', 'CI incremental PR check'], {
      cwd: root,
      stdio: 'inherit',
    });
    if (run.status === 0) results.push({ id, status: 'PASS' });
    else results.push({ id, status: 'FAIL', reason: run.error?.message ?? (run.signal ? `received ${run.signal}` : `exit ${run.status}`) });
  }

  const failed = results.some(result => result.status === 'FAIL');
  const status = failed ? 'FAIL' : started ? 'PASS' : 'NOT_RUN';
  const reason = candidates.length ? '' : paths.length ? 'no eligible impacted gate' : 'no non-document changes';
  printResult(options, status, paths, results, started, reason);
  if (failed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`FAIL — Host incremental checks (${error.message})`);
  process.exitCode = 1;
}
