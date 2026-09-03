// Regenerates the bundled-source manifest metadata: builtinId, versions,
// rule fingerprints, verification timestamps, provenance, defaultEnabled.
// Also refreshes the whole-file SHA-256 pinned inside ReaderRuntimeOwner.ts.
// Run after any rule edit: node tools/refresh-source-supply-manifest.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILTIN_VERSION,
  SUITE_VERSION,
  collectInsecureUrlFindings,
  collectPaywallFindings,
  collectSecretFindings,
  ruleFingerprint,
  sha256Hex,
} from './source-supply-lib.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rawFile = resolve(repo, 'entry/src/main/resources/rawfile/reader-test-book-sources.json');
const ownerFile = resolve(repo, 'entry/src/main/ets/app/ReaderRuntimeOwner.ts');

// Distribution decisions recorded from the 2026-08-31 admission run
// (evidence/2026-08-31-five-line/supply-admission-results.json).
const SOURCE_TABLE = {
  'https://m.idejian.com': {
    builtinId: 'reader-builtin-dejian',
    defaultEnabled: true,
    provenance: {
      origin: 'reader-project-authored',
      upstreamSite: 'https://m.idejian.com',
      notes: 'Chapter-list API requires the fixed route param p4 (non-credential app route tag); the API 302-redirects to book.d.ireader.com over http (server-side, https available on target). Recorded as admission warning.',
    },
  },
  'https://dushu.baidu.com/': {
    builtinId: 'reader-builtin-baidu',
    defaultEnabled: true,
    provenance: {
      origin: 'reader-project-authored',
      upstreamSite: 'https://dushu.baidu.com',
      notes: 'Chapter content API switched from http to https in readerTestBuiltinVersion 2.',
    },
  },
  'https://ubook.reader.qq.com/': {
    builtinId: 'reader-builtin-qq',
    defaultEnabled: true,
    provenance: {
      origin: 'reader-project-authored',
      upstreamSite: 'https://ubook.reader.qq.com',
      notes: 'Toc API returns chapter entries without URLs; chapter URLs are constructed as book-read/{bookId}/{seq} by the ruleContent chapterUrl rule.',
    },
  },
  'https://www.jjwxc.net/': {
    builtinId: 'reader-builtin-jjwxc',
    defaultEnabled: false,
    capabilities: ['search', 'detail', 'toc'],
    provenance: {
      origin: 'reader-project-authored',
      upstreamSite: 'https://www.jjwxc.net',
      notes: 'Synthesized paid-chapter placeholder removed from ruleContent in version 2. Excluded from the default-enabled subset in version 3: the site serves GBK HTML without a charset in Content-Type, and Core has no source-level charset field, so content decodes as mojibake (verified 2026-08-31: GBK decode of onebook body is readable, UTF-8 decode is 99%+ replacement characters). Search/detail/toc are healthy; content capability is withheld until Core supports source-level charset.',
    },
  },
  'https://m.qidian.com#ReaderTestBuiltin': {
    builtinId: 'reader-builtin-qidian',
    defaultEnabled: true,
    provenance: {
      origin: 'reader-project-authored',
      upstreamSite: 'https://m.qidian.com',
      notes: 'The #ReaderTestBuiltin fragment is part of the stable unique source identity. In version 3 searchUrl moved from the /so/{{key}}.html path form to the /search?kw= query form: Core expands {{key}} only in the query component (path braces are percent-encoded during URL normalization before template expansion), which made every keyword return the same default ranking page.',
    },
  },
  'https://m.sfacg.com': {
    builtinId: 'reader-builtin-sfacg',
    defaultEnabled: true,
    provenance: {
      origin: 'reader-project-authored',
      upstreamSite: 'https://m.sfacg.com',
      notes: 'VIP chapters carry a display-only lock marker in toc names; content gate still applies to VIP fetches.',
    },
  },
};

const document = readFileSync(rawFile, 'utf8');
const sources = JSON.parse(document);
assert.ok(Array.isArray(sources) && sources.length > 0, 'bundled source document is empty');

const verifiedAt = new Date().toISOString();
const seenIds = new Set();
for (const source of sources) {
  const entry = SOURCE_TABLE[source.bookSourceUrl];
  assert.ok(entry, `no distribution table entry for ${source.bookSourceUrl}`);
  assert.equal(seenIds.has(entry.builtinId), false, `duplicate builtinId ${entry.builtinId}`);
  seenIds.add(entry.builtinId);
  const insecure = collectInsecureUrlFindings(source);
  assert.deepEqual(insecure, [], `${source.bookSourceName} still contains http:// URLs: ${JSON.stringify(insecure)}`);
  const secrets = collectSecretFindings(source);
  assert.deepEqual(secrets, [], `${source.bookSourceName} still contains fixed secrets: ${JSON.stringify(secrets)}`);
  const paywall = collectPaywallFindings(source);
  assert.deepEqual(paywall, [], `${source.bookSourceName} still synthesizes paywall text: ${JSON.stringify(paywall)}`);
  // Preserve key order for stable diffs: update known fields, append metadata.
  source.enabled = entry.defaultEnabled;
  source.builtinId = entry.builtinId;
  source.builtinVersion = BUILTIN_VERSION;
  source.readerTestBuiltinVersion = BUILTIN_VERSION;
  source.ruleFingerprint = ruleFingerprint(source);
  source.verifiedAt = verifiedAt;
  source.verificationSuiteVersion = SUITE_VERSION;
  source.capabilities = entry.capabilities ?? ['search', 'detail', 'toc', 'content'];
  source.provenance = entry.provenance;
  source.defaultEnabled = entry.defaultEnabled;
}

const updated = `${JSON.stringify(sources, null, 2)}\n`;
writeFileSync(rawFile, updated, 'utf8');
const fileSha256 = sha256Hex(updated);

const owner = readFileSync(ownerFile, 'utf8');
const marker = /const BUNDLED_RAW_FILE_SHA256 = '[0-9a-f]{64}';/;
assert.ok(marker.test(owner), 'pinned bundled-source digest constant missing from ReaderRuntimeOwner.ts');
writeFileSync(ownerFile, owner.replace(marker, `const BUNDLED_RAW_FILE_SHA256 = '${fileSha256}';`), 'utf8');

console.log(`refreshed ${sources.length} bundled sources; file sha256 ${fileSha256}`);
for (const source of sources) {
  console.log(`  ${source.builtinId} v${source.builtinVersion} defaultEnabled=${source.defaultEnabled} ` +
    `fingerprint=${source.ruleFingerprint.slice(0, 12)}…`);
}
