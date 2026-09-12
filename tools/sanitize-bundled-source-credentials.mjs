// Removes fixed credentials accidentally retained in the portable bundled
// source collection. This is a local, deterministic repair: it never reads
// the network or prints credential values. A source whose tested rule carried
// a fixed credential is quarantined (disabled and import-only) after the rule
// is sanitized, while its historical test record remains intact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectSecretFindings,
  ruleFingerprint,
} from './source-supply-lib.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rawRelative = 'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json';
const rawFile = resolve(repo, rawRelative);
const ownerFile = resolve(repo, 'entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const EXPECTED_RECORDS = 1046;

const JWT_GLOBAL = /(?:^|[^A-Za-z0-9_-])(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})(?:$|[^A-Za-z0-9_-])/g;
const CREDENTIAL_KEY = /^(?:cookie|authorization|proxy-authorization|token|access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|auth[_-]?code|secret|password|passwd|session|sid|uid|user[-_]?id|device[-_]?uuid|device[-_]?id|imei|imsi|q[-_]?guid|guid|uuid|signature|sign)$/i;
const RUNTIME_TEMPLATE = /\{\{[^{}]+\}\}/;
const SECRET_PARAM = /([?&])(_?token|nid|access_?token|refresh_?token|api_?key|apikey|auth_?code|secret|password|passwd|session|sid|uid|user_?id|device_?(?:uuid|id)|imei|imsi|q[-_]?guid|guid|uuid|signature|sign)=([^&"'{}\s]+)/gi;
const ROOT_METADATA = new Set([
  'builtinId',
  'builtinVersion',
  'readerTestBuiltinVersion',
  'readerBuiltinWithdrawn',
  'readerTestBuiltinWithdrawn',
  'ruleFingerprint',
  'verifiedAt',
  'verificationSuiteVersion',
  'capabilities',
  'provenance',
  'defaultEnabled',
  'readerHistoricalTest',
]);

function redactText(value) {
  let result = value.replace(JWT_GLOBAL, (_whole, token) => `[redacted-jwt-${token.length}]`);
  result = result.replace(SECRET_PARAM, '$1$2={{key}}');
  // A UUID is only a secret when the admission scanner reported it. Keeping
  // unrelated source URLs stable avoids changing legitimate source identity.
  return result;
}

function isFixed(value) {
  return typeof value === 'string' && value.trim().length > 0 &&
    !RUNTIME_TEMPLATE.test(value) &&
    !/(?:^|\s)@(?:get|js|css|put|xpath)\s*:/i.test(value) &&
    !/(?:^|\s)\$\.?[A-Za-z_]/.test(value);
}

function sanitizeHeaderString(value) {
  try {
    const parsed = JSON.parse(value);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const cleaned = {};
      for (const [key, item] of Object.entries(parsed)) {
        if (CREDENTIAL_KEY.test(key) && isFixed(item)) {
          continue;
        }
        cleaned[key] = typeof item === 'string' ? redactText(item) : item;
      }
      return JSON.stringify(cleaned);
    }
  } catch (_) {
    // Fall through for line-oriented Legado headers.
  }
  return value
    .split(/\r?\n/)
    .filter(line => !/^\s*["']?(?:cookie|authorization|proxy-authorization|token|access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|auth[_-]?code|secret|password|passwd|session|sid|uid|user[-_]?id|device[-_]?uuid|device[-_]?id|imei|imsi|q[-_]?guid|guid|uuid|signature|sign)["']?\s*[:=]/i.test(line))
    .map(redactText)
    .join('\n');
}

function sanitizeValue(value, path = '', root = false) {
  if (typeof value === 'string') {
    return path === 'header' ? sanitizeHeaderString(value) : redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    const cleaned = {};
    for (const [key, item] of Object.entries(value)) {
      if (root && ROOT_METADATA.has(key)) {
        cleaned[key] = item;
        continue;
      }
      if (CREDENTIAL_KEY.test(key) && isFixed(item)) {
        continue;
      }
      cleaned[key] = sanitizeValue(item, path === '' ? key : `${path}.${key}`);
    }
    return cleaned;
  }
  return value;
}

const originalText = readFileSync(rawFile, 'utf8');
const sources = JSON.parse(originalText);
assert.equal(Array.isArray(sources), true, 'bundled collection must be an array');
assert.equal(sources.length, EXPECTED_RECORDS,
  `expected ${EXPECTED_RECORDS} bundled records before sanitization`);

let quarantined = 0;
let changed = 0;
const changedKinds = new Map();
for (const source of sources) {
  const findings = collectSecretFindings(source);
  if (findings.length === 0) {
    continue;
  }
  quarantined += 1;
  for (const finding of findings) {
    changedKinds.set(finding.kind, (changedKinds.get(finding.kind) ?? 0) + 1);
  }
  const sanitized = sanitizeValue(source, '', true);
  const residual = collectSecretFindings(sanitized);
  assert.equal(residual.length, 0,
    `sanitization left fixed credentials in ${source.builtinId}`);
  sanitized.enabled = false;
  sanitized.defaultEnabled = false;
  if (Object.hasOwn(sanitized, 'enabledExplore')) {
    sanitized.enabledExplore = false;
  }
  sanitized.capabilities = ['import'];
  sanitized.provenance = {
    ...sanitized.provenance,
    distributionDecision: 'quarantined-fixed-credential',
  };
  sanitized.ruleFingerprint = ruleFingerprint(sanitized);
  const index = sources.indexOf(source);
  sources[index] = sanitized;
  changed += 1;
}

assert.ok(quarantined === 0 || quarantined >= 11,
  'the repair must account for every audited fixed-credential record');
const updatedText = `${JSON.stringify(sources)}\n`;
if (updatedText !== originalText) {
  writeFileSync(rawFile, updatedText, 'utf8');
}
const digest = createHash('sha256').update(updatedText, 'utf8').digest('hex');
const owner = readFileSync(ownerFile, 'utf8');
const marker = /const BUNDLED_RAW_FILE_SHA256 = '[0-9a-f]{64}';/;
assert.match(owner, marker, 'bundled raw-file digest marker is missing');
const updatedOwner = owner.replace(marker, `const BUNDLED_RAW_FILE_SHA256 = '${digest}';`);
if (updatedOwner !== owner) {
  writeFileSync(ownerFile, updatedOwner, 'utf8');
}

console.log(`sanitized ${changed} bundled records; quarantined ${quarantined}; ` +
  `findingKinds=${JSON.stringify(Object.fromEntries(changedKinds))}; sha256=${digest}`);
