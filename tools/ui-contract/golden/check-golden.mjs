#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const usage = 'node tools/ui-contract/golden/check-golden.mjs --list | --all | --suite V1,V2,V5 | --case <name> [--suite 或 --case 均需 --evidence-root]';
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const receiptModule = new URL('../lib/receipt.mjs', import.meta.url).href;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function within(root, path) {
  assert(typeof path === 'string' && path && !isAbsolute(path), 'Expected a relative corpus path');
  const target = realpathSync(resolve(root, path));
  const rel = relative(root, target);
  assert(rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`), `Path leaves its bound root: ${path}`);
  return target;
}

const noNetwork = `data:text/javascript,${encodeURIComponent(`
  import { registerHooks } from 'node:module';
  registerHooks({resolve(specifier, context, next) {
    const result = next(specifier, context);
    if (/^node:(net|tls|http|https|http2|dns|dgram|quic|inspector)(?:\\/|$)/u.test(result.url)) {
      throw new Error('Network modules are disabled in historical replay');
    }
    return result;
  }});
`)}`;

// Node 22 需要显式关掉 fetch/websocket 才能配合 --permission 阻网；较新
// Node 已移除这两个否定开关，而 --permission 本身默认拒绝网络，故按需启用。
const supportedFlag = flag => spawnSync(process.execPath, ['--no-warnings', flag, '-e', '0'],
  {encoding: 'utf8', env: {}, timeout: 5000}).status === 0;
const historicalFlags = ['--no-experimental-fetch', '--no-experimental-websocket'].filter(supportedFlag);

function offline(args, reads, expectedExit, historical = false) {
  const result = spawnSync(process.execPath, [
    '--permission', '--no-warnings', ...reads.map(path => `--allow-fs-read=${path}`),
    ...(historical ? [...historicalFlags, '--import', noNetwork] : []),
    ...args,
  ], {encoding: 'utf8', env: {}, timeout: historical ? 90_000 : 30_000, maxBuffer: 16 * 1024 * 1024});
  if (result.error) throw result.error;
  assert(result.status === expectedExit && !result.stderr.trim(),
    `Runner exit ${result.status ?? result.signal}; expected ${expectedExit}${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
  return JSON.parse(result.stdout);
}

function unique(rows, predicate, label) {
  const matches = rows.filter(predicate);
  assert(matches.length === 1, `Expected exactly one result for ${label}, found ${matches.length}`);
  return matches[0];
}

function withArchivedTool(entry, root, run) {
  const archive = within(root, entry.frozenArchive);
  const stat = statSync(archive);
  assert(stat.isFile() && stat.size <= 8 * 1024 * 1024, 'Invalid frozen archive file');
  const bytes = readFileSync(archive);
  assert.equal(sha256(bytes), entry.frozenArchiveSha256, 'Frozen archive digest mismatch');
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), 'reader-golden-'));
  try {
    // 先校验完整成员清单，再从同一份已验哈希的字节提取，不恢复归档权限。
    const result = spawnSync('/usr/bin/python3', ['-I', '-B', '-c', String.raw`
import io, os, pathlib, re, shutil, sys, tarfile
os.umask(0o077)
with tarfile.open(fileobj=io.BytesIO(sys.stdin.buffer.read()), mode='r:gz') as archive:
    members = archive.getmembers()
    if len(members) > 1000 or sum(member.size for member in members) > 16 * 1024 * 1024:
        raise ValueError('Unexpected archive size')
    seen = {}
    for member in members:
        name = member.name
        parts = name.split('/')
        if (not re.fullmatch(r'[A-Za-z0-9_@./+-]+', name) or parts[0] != 'phase0-replay'
            or any(part in ('', '.', '..') for part in parts) or name.lower() in seen
            or member.type not in (tarfile.DIRTYPE, tarfile.REGTYPE, tarfile.AREGTYPE)
            or member.pax_headers or member.linkname or (member.isdir() and member.size != 0)):
            raise ValueError('Unsafe or duplicate archive member: ' + repr(name))
        seen[name.lower()] = member
    for member in members:
        if any((parent := seen.get(str(path).lower())) is None or not parent.isdir()
               or parent.name != str(path) for path in pathlib.PurePosixPath(member.name).parents if str(path) != '.'):
            raise ValueError('Missing or invalid archive parent: ' + repr(member.name))
    root = pathlib.Path(sys.argv[1])
    for member in sorted(members, key=lambda item: item.name.count('/')):
        target = root / member.name
        if member.isdir():
            target.mkdir()
        else:
            with archive.extractfile(member) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output)
`, scratch], {input:bytes, env:{}, encoding:'utf8', timeout:30_000});
    if (result.error) throw result.error;
    assert(result.status === 0 && !result.stderr.trim(), `Frozen archive inspection or extraction failed: ${result.stderr.trim()}`);
    return run(within(scratch, 'phase0-replay'));
  } finally {
    rmSync(scratch, {recursive:true, force:true});
  }
}

function assertionChecks(rows, entry) {
  return entry.checks.map(expected => {
    const row = unique(rows, row => row.id === expected.id, expected.id);
    assert.equal(row.verdict, expected.verdict, expected.id);
    if (expected.expected) assert.deepEqual(row.expected, expected.expected, `${expected.id}.expected`);
    const actual = Object.fromEntries(Object.entries(expected.actual ?? {}).map(([key, value]) => {
      assert.deepEqual(row.actual?.[key], value, `${expected.id}.${key}`);
      return [key, row.actual[key]];
    }));
    return {id: row.id, verdict: row.verdict, ...(expected.expected && {expected:row.expected}),
      ...(expected.actual && {actual})};
  });
}

function replayFrozen(entry, tool, receipt) {
  const cli = within(tool, 'tools/ui-contract/cli.mjs');
  const result = offline([
    cli, '--case', entry.caseId, '--replay', receipt, '--expected-root', entry.rootSha256,
  ], [tool, dirname(receipt)], entry.execution === 'PASS' ? 0 : 1, Boolean(entry.frozenArchive));
  const replay = result.receipt;
  assert.equal(result.rootSha256, entry.rootSha256, 'Frozen receipt root mismatch');
  assert.equal(replay.tool.sha256, entry.toolSha256, 'Frozen tool digest mismatch');
  if (entry.toolVersion) assert.equal(replay.tool.version, entry.toolVersion, 'Frozen tool version mismatch');
  assert.equal(replay.caseId, entry.caseId, 'Frozen case mismatch');
  assert.equal(replay.caseSha256, entry.caseSha256, 'Frozen case digest mismatch');
  assert.equal(replay.observations, 'COMPLETE', 'Frozen evidence is incomplete');
  assert.equal(replay.execution, entry.execution, 'Frozen execution mismatch');
  const checks = assertionChecks(replay.assertions, entry);
  return {toolSha256: replay.tool.sha256, ...(entry.frozenArchive && {
    observations:replay.observations, execution:replay.execution, toolVersion:replay.tool.version,
    archiveSha256:entry.frozenArchiveSha256,
  }), checks};
}

function checkFrozen(entry, root, receipt) {
  const run = tool => replayFrozen(entry, tool, receipt);
  return entry.frozenArchive ? withArchivedTool(entry, root, run) : run(within(root, entry.frozenTool));
}

function checkCurrentLayout(entry, _root, receipt) {
  const tool = new URL('../', import.meta.url);
  const result = offline(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {basename, dirname} from 'node:path';
    import {evidenceStore, jsonDigest, validate, verifyChain} from ${JSON.stringify(new URL('lib/evidence.mjs', tool).href)};
    import {evaluateLayout} from ${JSON.stringify(new URL('lib/layout.mjs', tool).href)};
    import {fixtureAdmission, loadCandidate} from ${JSON.stringify(new URL('collectors/harmonyos/run.mjs', tool).href)};
    import {sessionContext} from ${JSON.stringify(new URL('collectors/harmonyos/records.mjs', tool).href)};
    const [receipt, expectedRoot, caseId, caseSha256, assertionId] = process.argv.slice(1);
    const store = evidenceStore(dirname(receipt));
    const ref = store.reference(basename(receipt));
    assert.equal(ref.sha256, expectedRoot, 'Historical receipt root mismatch');
    const sealed = validate('receipt', store.json(ref));
    const contract = validate('case', store.json(sealed.case));
    assert.equal(sealed.caseId, caseId);
    assert.equal(contract.id, caseId);
    assert.equal(contract.version, sealed.caseVersion);
    assert.equal(sealed.caseSha256, caseSha256);
    assert.equal(sealed.case.sha256, caseSha256);
    assert.equal(jsonDigest(contract), caseSha256);
    const session = validate('session', store.json(sealed.session));
    assert.equal(sealed.observations, 'COMPLETE');
    assert.equal(session.result, 'COMPLETED');
    assert.equal(session.runId, sealed.runId);
    assert.equal(verifyChain(session.chain), sealed.chainTail);
    const candidate = loadCandidate(store, sealed.candidate, contract);
    for (const [key, value] of Object.entries(sealed.candidate.identity)) assert.deepEqual(candidate[key], value, key);
    const fixtureAt = fixtureAdmission(store.json(session.fixture), contract, candidate);
    const context = sessionContext({store, session, sessionRef:sealed.session, candidate, contract});
    assert.deepEqual(context.problems, [], 'Historical capture failed current admission');
    const start = Date.parse(context.records[0].recordedAt);
    assert(fixtureAt <= start && start - fixtureAt <= 10 * 60 * 1000, 'Historical fixture does not cover collection start');
    const assertions = contract.assertions.filter(row => row.id === assertionId);
    const historical = sealed.assertions.filter(row => row.id === assertionId);
    assert(assertions.length === 1 && historical.length === 1, 'Historical layout assertion must be unique');
    const [assertion] = assertions;
    assert(assertion.evaluator === 'layout' && assertion.kind === 'visibleFraction' && assertion.sample === 'ime-ready');
    assert(Object.hasOwn(context.samples, assertion.sample) && !context.sampleReadiness[assertion.sample]);
    const measured = evaluateLayout({...assertion, acceptedSources:assertion.sources}, context.samples);
    assert.deepEqual(measured.evidenceRefs, historical[0].evidenceRefs, 'Current evaluation used different historical evidence');
    for (const evidence of measured.evidenceRefs) store.bytes(evidence);
    assert.deepEqual(measured.actual, historical[0].actual, 'Current layout measurements differ from the sealed result');
    process.stdout.write(JSON.stringify({sampleId:assertion.sample, assertions:[{id:assertionId, ...measured}]}));
  `, receipt, entry.rootSha256, entry.caseId, entry.caseSha256, entry.checks[0].id], [repo, dirname(receipt)], 0, true);
  return {sampleId:result.sampleId, checks:assertionChecks(result.assertions, entry)};
}

function checkCurrent(entry, root, receipt) {
  const bindings = within(root, entry.bindings);
  // 与 reassess-structure.mjs 共用求值入口；只读返回报告，不另存派生文件。
  const result = offline(['--input-type=module', '-e', `
    import {readFileSync} from 'node:fs';
    import {createHash} from 'node:crypto';
    import {reassessOriginalStructure} from ${JSON.stringify(receiptModule)};
    const [receiptPath, expectedRoot, bindings, bindingSha256] = process.argv.slice(1);
    const bytes = readFileSync(bindings);
    if (createHash('sha256').update(bytes).digest('hex') !== bindingSha256) {
      throw new Error('Historical bindings digest mismatch');
    }
    const report = reassessOriginalStructure({receiptPath, expectedRoot, historicalDefinition: JSON.parse(bytes)});
    process.stdout.write(JSON.stringify(report));
    process.exitCode = report.execution === 'PASS' ? 0 : 1;
  `, receipt, entry.rootSha256, bindings, entry.bindingsSha256],
  [repo, dirname(receipt), bindings], entry.execution === 'PASS' ? 0 : 1);
  assert.equal(result.source.rootSha256, entry.rootSha256, 'Historical receipt root mismatch');
  assert.equal(result.source.caseId, entry.caseId, 'Historical case mismatch');
  assert.equal(result.source.caseSha256, entry.caseSha256, 'Historical case digest mismatch');
  assert.equal(result.observations, 'COMPLETE', 'Reassessment evidence is incomplete');
  assert.equal(result.execution, entry.execution, 'Reassessment execution mismatch');
  assert.equal(result.structure.behavior, entry.execution, 'Reassessed structure behavior mismatch');
  const checks = entry.checks.map(expected => {
    const {sampleId, ruleId, verdict} = expected;
    const state = unique(result.structure.states, row => row.sampleId === sampleId, sampleId);
    const label = `${sampleId}/${ruleId}`;
    const check = unique(state.checks, row => row.ruleId === ruleId, label);
    assert(state.observationsComplete && check.observationsComplete, `Incomplete structure check: ${label}`);
    assert.equal(state.verdict, verdict, sampleId);
    assert.equal(check.verdict, verdict, label);
    return {sampleId, ruleId, verdict: check.verdict};
  });
  return {structureDefinitionSha256: result.structure.definitionSha256, bindingsSha256: entry.bindingsSha256, checks};
}

const runners = {'frozen-compatibility': checkFrozen, 'current-structure-regression': checkCurrent,
  'current-layout-regression': checkCurrentLayout};

function resolveEntry(corpus, name) {
  if (!Object.hasOwn(corpus.cases, name)) throw new Error(`Unknown golden case: ${name}`);
  const selected = corpus.cases[name];
  let entry = selected;
  if (selected.mode === 'current-layout-regression') {
    const historical = corpus.cases[selected.historicalCase];
    assert(historical?.mode === 'frozen-compatibility' && historical.checks.length === 1,
      `Invalid historical golden binding: ${name}`);
    entry = {...historical, mode:selected.mode};
  }
  assert(Object.hasOwn(runners, entry.mode) && ['PASS', 'FAIL'].includes(entry.execution) && entry.checks.length,
    `Invalid golden case: ${name}`);
  return entry;
}

function runOne(corpus, name, root) {
  const entry = resolveEntry(corpus, name);
  const receipt = within(root, entry.receipt);
  return {golden: 'MATCH', name, mode: entry.mode, caseId: entry.caseId,
    rootSha256: entry.rootSha256, ...runners[entry.mode](entry, root, receipt)};
}

function main() {
  const {values, tokens} = parseArgs({options: {
    list: {type: 'boolean'}, all: {type: 'boolean'}, case: {type: 'string'}, suite: {type: 'string'},
    'evidence-root': {type: 'string'},
  }, tokens: true});
  const corpus = JSON.parse(readFileSync(new URL('corpus.json', import.meta.url), 'utf8'));
  assert.equal(corpus.schema, 'reader-ui-golden-corpus-v1');
  if (values.list && tokens.length === 1) {
    console.log(Object.entries(corpus.cases).map(([name, entry]) => `${name}\t${entry.mode}`).join('\n'));
    return;
  }
  if (values.list) throw new Error(usage);
  if (values.all || values.suite) {
    if (tokens.length !== 2 || values.case || !values['evidence-root'] || (values.all && values.suite)) throw new Error(usage);
    const root = realpathSync(values['evidence-root']);
    const requested = values.suite ? values.suite.split(',').map(name => name.trim()).filter(Boolean) : [];
    for (const suite of requested) {
      if (!Object.hasOwn(corpus.suites ?? {}, suite)) throw new Error(`Unknown golden suite: ${suite}`);
    }
    const names = values.all ? Object.keys(corpus.cases)
      : [...new Set(requested.flatMap(suite => corpus.suites[suite]))];
    const failed = [];
    for (const name of names) {
      try {
        console.log(JSON.stringify(runOne(corpus, name, root)));
      } catch (error) {
        failed.push(name);
        console.log(JSON.stringify({golden: 'ERROR', name, reason: error.message}));
      }
    }
    console.log(JSON.stringify({golden: failed.length ? 'MISMATCH' : 'ALL_MATCH',
      ...(values.suite ? {suites: requested} : {}), total: names.length, matched: names.length - failed.length, failed}));
    if (failed.length) process.exitCode = 1;
    return;
  }
  if (tokens.length !== 2 || !values.case || !values['evidence-root']) throw new Error(usage);
  const root = realpathSync(values['evidence-root']);
  console.log(JSON.stringify(runOne(corpus, values.case, root)));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({golden: 'ERROR', reason: error.message}));
  process.exitCode = 2;
}
