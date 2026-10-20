import { coreCliPath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function selectBundledSources(sources, ids) {
  assert.ok(Array.isArray(sources) && sources.length > 0, 'bundled source document is empty');
  assert.ok(Array.isArray(ids) && ids.length && ids.every(id => typeof id === 'string' && id.trim() === id && id.length), 'select exact source IDs');
  assert.equal(new Set(ids).size, ids.length, 'duplicate source selection');
  const byId = new Map();
  for (const source of sources) {
    assert.ok(typeof source.sourceId === 'string' && source.sourceId.length, 'sourceId is required');
    assert.ok(!byId.has(source.sourceId), 'duplicate bundled sourceId');
    byId.set(source.sourceId, source);
  }
  return ids.map(id => { assert.ok(byId.has(id), `unknown bundled source: ${id}`); return byId.get(id); });
}

export function runBundledSourceSelection(sources, ids, { cli, coreRepo, sourcePath, allSelected = false }) {
  const selected = selectBundledSources(sources, ids);
  assert.ok(existsSync(cli), `Reader Core CLI is required for selected sources: ${cli}`);
  const results = [];
  const cliSha256 = createHash('sha256').update(readFileSync(cli)).digest('hex');
  const scratch = mkdtempSync(join(tmpdir(), 'reader-bundled-source-live-'));
  console.log('Evidence scope: selected Core CLI L1-L5 diagnostics; Harmony HTTP/ArkWeb device evidence is separate.');
  try {
  for (const [index, source] of selected.entries()) {
    const ruleSha256 = createHash('sha256').update(JSON.stringify(source)).digest('hex');
    console.log(JSON.stringify({ stage: 'sourceSelection', sourceId: source.sourceId, ruleSha256 }));
    try {
    const keyword = source.ruleSearch?.checkKeyWord;
    assert.equal(typeof keyword, 'string', `${source.bookSourceName} has no checkKeyWord`);
    const candidate = join(scratch, `source-${index + 1}.json`);
    writeFileSync(candidate, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
    const run = spawnSync(cli, [
      '--test-source', candidate,
      '--keyword', keyword,
      '--timeout', '30',
    ], {
      cwd: coreRepo,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (run.error !== undefined) {
      throw run.error;
    }
    assert.equal(run.status, 0,
      `${source.bookSourceName} live gate process failed: ${run.stderr.trim()}`);
    let report;
    try {
      report = JSON.parse(run.stdout);
    } catch (_) {
      throw new Error(`${source.bookSourceName} live gate returned invalid JSON: ` +
        `${run.stdout.slice(-1200)} ${run.stderr.slice(-1200)}`);
    }
    for (const level of ['L1-import', 'L2-search', 'L3-detail', 'L4-toc', 'L5-content']) {
      assert.equal(report.levels?.[level]?.status, 'pass',
        `${source.bookSourceName} failed ${level}: ${JSON.stringify(report.levels?.[level] ?? {})}`);
    }
    console.log(`${basename(sourcePath)}: ${source.bookSourceName} CLI L1-L5 PASS ` +
      `(${report.duration_ms}ms)`);
    results.push({sourceId:source.sourceId,ruleSha256,status:'PASS',levels:Object.fromEntries(Object.entries(report.levels).map(([level,row])=>[level,row.status])),durationMs:report.duration_ms});
    } catch (error) {
      results.push({sourceId:source.sourceId,ruleSha256,status:'FAIL',error:{name:error.name,code:error.code,message:error.message}});
    }
    console.log(JSON.stringify({kind:'reader-live-source-result',...results.at(-1)}));
  }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  const report={kind:'reader-live-source-selection',status:results.every(row=>row.status==='PASS')?'PASS':'FAIL',cliSha256,selected:ids,results,omitted:sources.filter(source=>!ids.includes(source.sourceId)).map(source=>({sourceId:source.sourceId,status:'NOT_RUN'})),parentTimeoutBudgetMs:ids.length*120000,fullCollection:allSelected?(results.every(row=>row.status==='PASS')?'PASS':'FAIL'):'NOT_RUN'};
  console.log(JSON.stringify(report));return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { 'source-ids': { type: 'string' }, all: { type: 'boolean' }, rationale: { type: 'string' }, list: { type: 'boolean' } }, allowPositionals: false });
  const sourcePath = resolve(repo, 'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json');
  const sources = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (!values['source-ids'] && !values.all) {
    console.log(JSON.stringify({ status: 'NOT_RUN', sources: sources.map(source => ({ id: source.sourceId, name: source.bookSourceName })), selection: '--source-ids <exact IDs> --rationale <necessity>' }));
  } else {
    assert.ok(!values.list && !(values['source-ids'] && values.all), 'choose exact IDs or an explicit all-source plan');
    assert.ok(values.rationale?.trim(), 'selected live network sources require a concrete rationale');
    const ids = values.all ? sources.map(source => source.sourceId) : values['source-ids'].split(',');
    selectBundledSources(sources, ids); // Reject before tool discovery or network.
    const coreRepo = resolve(repo, '../Reader-Core');
    const report=runBundledSourceSelection(sources, ids, { cli: coreCliPath(coreRepo), coreRepo, sourcePath, allSelected: values.all === true });
    if(report.status!=='PASS')process.exitCode=1;
  }
}
