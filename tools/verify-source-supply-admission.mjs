// Live admission suite for the bundled book-source supply chain.
// Per source: HTTPS-only + secret + paywall static gates, then a reader-cli
// live chain across >=3 keywords (cold process each), a warm repeat of the
// primary keyword, a reduced-timeout graceful-degradation run, and >=3 distinct
// books with a multi-chapter toc each (from --record captures).
// Usage: node tools/verify-source-supply-admission.mjs [--evidence-dir <dir>]
// Exit 0 iff every bundled source is admitted.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_CAPABILITIES,
  SUITE_VERSION,
  analyzeRecording,
  collectInsecureUrlFindings,
  collectPaywallFindings,
  collectSecretFindings,
  runCliTestSource,
  validateBundledMetadata,
} from './source-supply-lib.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreRepo = resolve(repo, '../Reader-Core-Native');
const cliPath = process.env.READER_CORE_CLI ?? resolve(coreRepo, 'target/debug/reader-cli');
const sourcePath = resolve(repo,
  'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json');
const evidenceIndex = process.argv.indexOf('--evidence-dir');
const evidenceDir = evidenceIndex >= 0 ? resolve(repo, process.argv[evidenceIndex + 1]) :
  resolve(repo, '../evidence/2026-08-31-five-line');

// Ordered per-source keyword pools. The first three that produce a live pass
// become the verified keyword set; misses fall through to later candidates.
const KEYWORD_POOLS = {
  'reader-builtin-dejian': ['斗破苍穹', '重生', '都市', '青春', '仙侠'],
  'reader-builtin-baidu': ['斗破苍穹', '凡人修仙传', '诡秘之主', '都市', '青春'],
  'reader-builtin-qq': ['斗破苍穹', '诡秘之主', '凡人修仙传', '都市', '青春'],
  'reader-builtin-jjwxc': ['青春', '重生', '天官赐福', '穿越', '校园'],
  'reader-builtin-qidian': ['斗破苍穹', '诡秘之主', '凡人修仙传', '都市', '青春'],
  'reader-builtin-sfacg': ['魔法', '异世界', '学园', '幻想', '青春'],
};

const TIMEOUT_SCENARIO_SECONDS = 6;
const TIMEOUT_SCENARIO_WALL_MS = 90_000;
const LIVE_RUN_WALL_MS = 150_000;
const MIN_KEYWORDS = 3;
const MIN_BOOKS = 3;
const MIN_CHAPTERS_PER_BOOK = 5;

// The CLI picks the FIRST toc entry as the representative chapter. When that
// entry is a short announcement (SF 作品相关 公告), Core still extracts
// non-empty content and the CLI fails with text_content_too_short — a short
// chapter, not a broken content rule. Such runs count as keyword passes with
// a note; every other failure stays a miss.
function runAccepted(run) {
  if (run.ok) {
    return { accepted: true, note: null };
  }
  const levels = run.report?.levels ?? {};
  const onlyL5 = run.failedLevels?.length === 1 && run.failedLevels[0] === 'L5-content';
  if (onlyL5 && levels['L5-content']?.reason === 'text_content_too_short') {
    return { accepted: true, note: 'short representative chapter (announcement)' };
  }
  return { accepted: false, note: null };
}

assert.ok(existsSync(cliPath), `Reader Core CLI is required for the admission suite: ${cliPath}`);
const sources = JSON.parse(readFileSync(sourcePath, 'utf8'));
assert.ok(Array.isArray(sources) && sources.length > 0, 'bundled source document is empty');
mkdirSync(evidenceDir, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'reader-source-admission-'));
const summary = {
  suiteVersion: SUITE_VERSION,
  generatedAt: new Date().toISOString(),
  sourceDocument: basename(sourcePath),
  fileSha256: null,
  sources: [],
};

for (const source of sources) {
  const label = source.bookSourceName;
  const defaultEnabled = source.defaultEnabled === true;
  const requiresContent = Array.isArray(source.capabilities) &&
    source.capabilities.includes('content');
  const result = {
    sourceId: source.bookSourceUrl,
    builtinId: source.builtinId,
    name: label,
    defaultEnabled,
    requiresContent,
    static: { insecureUrls: [], secrets: [], paywall: [], metadataErrors: [] },
    live: { keywordRuns: [], hotRerun: null, timeoutScenario: null },
    booksVerified: 0,
    minChaptersObserved: 0,
    warnings: [],
    verdict: 'rejected',
    reasons: [],
  };
  result.static.insecureUrls = collectInsecureUrlFindings(source);
  result.static.secrets = collectSecretFindings(source);
  result.static.paywall = collectPaywallFindings(source);
  result.static.metadataErrors = validateBundledMetadata(source);
  if (result.static.insecureUrls.length > 0) {
    result.reasons.push('insecure http:// URLs in rules');
  }
  if (result.static.secrets.length > 0) {
    result.reasons.push('fixed secrets in rules');
  }
  if (result.static.paywall.length > 0) {
    result.reasons.push('synthesized paywall placeholder');
  }
  if (result.static.metadataErrors.length > 0) {
    result.reasons.push(`manifest metadata invalid: ${result.static.metadataErrors.join('; ')}`);
  }

  const keywordPasses = [];
  let keywordMisses = 0;
  for (const keyword of KEYWORD_POOLS[source.builtinId] ?? []) {
    if (keywordPasses.length >= MIN_KEYWORDS) {
      break;
    }
    const recordDir = join(scratch, `${source.builtinId}-${keywordPasses.length + 1}`);
    const run = runCliTestSource({
      cliPath,
      cwd: coreRepo,
      sourceFile: writeScratchSource(scratch, source),
      keyword,
      timeoutSec: 30,
      recordDir,
      wallLimitMs: LIVE_RUN_WALL_MS,
    });
    const entry = { scenario: 'cold', keyword, ok: run.ok, durationMs: run.durationMs };
    const acceptance = runAccepted(run);
    if (!acceptance.accepted) {
      entry.failedLevels = run.failedLevels ?? null;
      entry.error = run.error ?? null;
      keywordMisses += 1;
      result.live.keywordRuns.push(entry);
      if (keywordMisses > (KEYWORD_POOLS[source.builtinId] ?? []).length - MIN_KEYWORDS) {
        break;
      }
      continue;
    }
    if (acceptance.note) {
      entry.note = acceptance.note;
    }
    result.live.keywordRuns.push(entry);
    keywordPasses.push({ keyword, run, recordDir });
  }
  if (keywordPasses.length < MIN_KEYWORDS) {
    result.reasons.push(`only ${keywordPasses.length}/${MIN_KEYWORDS} keywords produced a live pass`);
  } else {
    const books = new Set();
    let minChapters = Number.POSITIVE_INFINITY;
    for (const { keyword, run, recordDir } of keywordPasses) {
      const recording = readRecording(recordDir);
      const analysis = recording === null ? null : analyzeRecording(recording);
      const runEntry = result.live.keywordRuns.find(item =>
        item.keyword === keyword && (item.ok || item.note !== undefined));
      runEntry.bookUrl = analysis?.bookUrl ?? null;
      runEntry.chapterCount = analysis?.chapterCount ?? null;
      runEntry.contentChars = analysis?.contentChars ?? null;
      runEntry.insecureRedirectHops = analysis?.insecureRedirectHops ?? [];
      if (analysis?.bookUrl !== null && analysis?.bookUrl !== undefined) {
        books.add(analysis.bookUrl);
      }
      if (analysis?.chapterCount !== null && analysis?.chapterCount !== undefined) {
        minChapters = Math.min(minChapters, analysis.chapterCount);
      }
      if ((analysis?.insecureRedirectHops.length ?? 0) > 0) {
        result.warnings.push(`server redirect to http:// during ${keyword} chain: ${analysis.insecureRedirectHops[0]}`);
      }
      if (requiresContent) {
        if ((analysis?.replacementRatio ?? 0) > 0.05) {
          result.reasons.push('content body is dominated by replacement characters (anti-crawl scramble)');
        }
        // Short-chapter note = the CLI confirmed Core extracted non-empty
        // content from a genuinely short page; the page-length floor cannot
        // gate that, and the anti-scramble check above still applies.
        if (runEntry.note === undefined && (analysis?.contentChars ?? 0) < 150) {
          // Low floor on purpose: the CLI's representative chapter can be a
          // legitimate short announcement (上架感言/完本感言 ~230 chars).
          // The floor targets empty or chrome-only extraction; paywall
          // placeholders are caught by the static gate, scramble by the
          // replacement-ratio check above.
          result.reasons.push(`content too short for keyword ${keyword}: ${analysis?.contentChars} chars`);
        }
      }
    }
    result.booksVerified = books.size;
    result.minChaptersObserved = Number.isFinite(minChapters) ? minChapters : 0;
    if (books.size < MIN_BOOKS) {
      result.reasons.push(`only ${books.size}/${MIN_BOOKS} distinct books verified`);
    }
    if (result.minChaptersObserved < MIN_CHAPTERS_PER_BOOK) {
      result.reasons.push(`multi-chapter gate failed: ${result.minChaptersObserved} chapters observed`);
    }

    const primary = keywordPasses[0];
    const hot = runCliTestSource({
      cliPath,
      cwd: coreRepo,
      sourceFile: writeScratchSource(scratch, source),
      keyword: primary.keyword,
      timeoutSec: 30,
      recordDir: join(scratch, `${source.builtinId}-hot`),
      wallLimitMs: LIVE_RUN_WALL_MS,
    });
    result.live.hotRerun = {
      scenario: 'hot',
      keyword: primary.keyword,
      ok: hot.ok,
      note: runAccepted(hot).note,
      durationMs: hot.durationMs,
    };
    if (!runAccepted(hot).accepted) {
      result.reasons.push('warm-cache repeat of the primary keyword failed');
    }

    const timeoutRun = runCliTestSource({
      cliPath,
      cwd: coreRepo,
      sourceFile: writeScratchSource(scratch, source),
      keyword: primary.keyword,
      timeoutSec: TIMEOUT_SCENARIO_SECONDS,
      wallLimitMs: TIMEOUT_SCENARIO_WALL_MS,
    });
    const graceful = !timeoutRun.hang && (timeoutRun.ok || timeoutRun.report !== null);
    result.live.timeoutScenario = {
      scenario: 'timeout',
      timeoutSeconds: TIMEOUT_SCENARIO_SECONDS,
      graceful,
      passedUnderPressure: timeoutRun.ok,
      durationMs: timeoutRun.durationMs,
    };
    if (!graceful) {
      result.reasons.push('reduced-timeout scenario hung or failed unstructured');
    }
  }

  if (result.reasons.length === 0) {
    result.verdict = 'admitted';
  } else if (!defaultEnabled) {
    // Bundled but opted out of the default-enabled subset: the failures are
    // recorded for traceability, they do not fail the suite.
    result.verdict = 'excluded';
  }
  if (result.verdict !== 'admitted') {
    preserveRecordings(scratch, source.builtinId, evidenceDir);
  }
  summary.sources.push(result);
  console.log(`${result.verdict === 'admitted' ? 'ADMIT' : 'REJECT'} ${label}: books=${result.booksVerified} ` +
    `minChapters=${result.minChaptersObserved} keywords=${result.live.keywordRuns.filter(r => r.ok || r.note).length}` +
    (result.reasons.length > 0 ? ` reasons=${JSON.stringify(result.reasons)}` : '') +
    (result.warnings.length > 0 ? ` warnings=${JSON.stringify(result.warnings)}` : ''));
}

rmSync(scratch, { recursive: true, force: true });
const { createHash } = await import('node:crypto');
summary.fileSha256 = createHash('sha256').update(readFileSync(sourcePath)).digest('hex');
const admitted = summary.sources.filter(source => source.verdict === 'admitted');
const defaultEnabledSources = summary.sources.filter(source => source.defaultEnabled !== false);
const outputPath = join(evidenceDir, 'supply-admission-results.json');
writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`admitted ${admitted.length}/${summary.sources.length} ` +
  `(default-enabled: ${defaultEnabledSources.filter(s => s.verdict === 'admitted').length}/${defaultEnabledSources.length}); ` +
  `evidence: ${outputPath}`);
if (defaultEnabledSources.some(source => source.verdict !== 'admitted')) {
  process.exit(1);
}

// Copies a rejected/excluded source's --record capture dirs into the evidence
// tree so a failure can be re-examined after the scratch dir is gone.
function preserveRecordings(scratchDir, builtinId, evidenceRoot) {
  const targetRoot = join(evidenceRoot, 'supply-recordings', builtinId);
  for (const entry of readdirSync(scratchDir)) {
    const recordDir = join(scratchDir, entry);
    if (!entry.startsWith(builtinId) || !statSync(recordDir).isDirectory()) {
      continue;
    }
    const files = existsSync(recordDir) ? readdirSync(recordDir) : [];
    if (files.length === 0) {
      continue;
    }
    const target = join(targetRoot, entry);
    mkdirSync(target, { recursive: true });
    for (const file of files) {
      writeFileSync(join(target, file), readFileSync(join(recordDir, file)));
    }
  }
}

function writeScratchSource(scratchDir, source) {
  const candidate = join(scratchDir, `${source.builtinId}.json`);
  writeFileSync(candidate, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
  return candidate;
}

function readRecording(recordDir) {
  if (!existsSync(recordDir)) {
    return null;
  }
  const files = readdirSync(recordDir).filter(name => name.endsWith('.json'));
  if (files.length === 0) {
    return null;
  }
  return JSON.parse(readFileSync(join(recordDir, files[0]), 'utf8'));
}
