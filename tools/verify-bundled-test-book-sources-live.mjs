import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreRepo = resolve(repo, '../Reader-Core-Native');
const cli = process.env.READER_CORE_CLI ?? resolve(coreRepo, 'target/debug/reader-cli');
const sourcePath = resolve(repo,
  'entry/src/main/resources/rawfile/reader-test-book-sources.json');

assert.ok(existsSync(cli),
  `Reader Core CLI is required for the package live gate: ${cli}`);
const sources = JSON.parse(readFileSync(sourcePath, 'utf8'));
assert.ok(Array.isArray(sources) && sources.length > 0, 'bundled source document is empty');

const scratch = mkdtempSync(join(tmpdir(), 'reader-bundled-source-live-'));
try {
  for (const [index, source] of sources.entries()) {
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
    console.log(`${basename(sourcePath)}: ${source.bookSourceName} L1-L5 PASS ` +
      `(${report.duration_ms}ms)`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
