// Shared logic for the bundled-source supply chain: canonical rule payloads,
// rule fingerprints, static admission checks, and reader-cli live runners.
// Consumed by tools/refresh-source-supply-manifest.mjs,
// tools/verify-source-supply-admission.mjs and tools/test-source-supply-chain.mjs.
// The ArkTS mirror of canonicalRulePayloadJson lives in
// entry/src/main/ets/app/BundledBookSourceSupply.ts and must stay byte-identical.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const SUITE_VERSION = 'reader-source-admission/1';
export const BUILTIN_VERSION = 3;

// Fields whose content defines what the verification suite certified. Metadata
// (builtin*, verifiedAt, suite version, provenance, defaultEnabled) and user
// state (enabled) are deliberately excluded: they must never change a rule
// fingerprint.
export const RULE_PAYLOAD_FIELDS = [
  'bookSourceType',
  'bookSourceUrl',
  'enabledCookieJar',
  'header',
  'loginUrl',
  'loginUi',
  'jsLib',
  'searchUrl',
  'ruleSearch',
  'ruleBookInfo',
  'ruleToc',
  'ruleContent',
  'charset',
  'coverDecoderJs',
  'bookUrlPattern',
  'concurrentRate',
  'rateLimitUri',
];

export const REQUIRED_CAPABILITIES = ['search', 'detail', 'toc', 'content'];

// Metadata fields embedded per bundled source (distribution identity only,
// never part of the rule fingerprint).
export const BUNDLED_METADATA_FIELDS = [
  'builtinId',
  'builtinVersion',
  'readerTestBuiltinVersion',
  'ruleFingerprint',
  'verifiedAt',
  'verificationSuiteVersion',
  'capabilities',
  'provenance',
  'defaultEnabled',
];

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}

export function rulePayloadJson(source) {
  const picked = {};
  for (const field of RULE_PAYLOAD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      picked[field] = source[field];
    }
  }
  return JSON.stringify(canonicalize(picked));
}

export function ruleFingerprint(source) {
  return sha256Hex(rulePayloadJson(source));
}

// -- static admission checks -------------------------------------------------

// Walks every string in the source outside distribution metadata and reports
// paths where an insecure http:// URL literal appears.
export function collectInsecureUrlFindings(source) {
  const findings = [];
  const skip = new Set(BUNDLED_METADATA_FIELDS);
  const walk = (value, path) => {
    if (typeof value === 'string') {
      if (value.includes('http://')) {
        findings.push({ path, excerpt: value.slice(0, 160) });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (skip.has(key) && path === '') {
          continue;
        }
        walk(value[key], path === '' ? key : `${path}.${key}`);
      }
    }
  };
  walk(source, '');
  return findings;
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Query parameters that carry credentials when their value is a fixed literal
// (templates like {{key}} or $.bookId are runtime-substituted, not secrets).
const SECRET_PARAM_PATTERN =
  /[?&](_?token|nid|access_?token|api_?key|apikey|secret|password|passwd|session|sid|uid|account)=([^&"'{}\s]+)/gi;

export function collectSecretFindings(source) {
  const findings = [];
  const skip = new Set(BUNDLED_METADATA_FIELDS);
  const walk = (value, path) => {
    if (typeof value === 'string') {
      if (UUID_PATTERN.test(value)) {
        findings.push({ path, kind: 'fixed-uuid', excerpt: value.slice(0, 160) });
      }
      SECRET_PARAM_PATTERN.reset?.();
      let match;
      const pattern = new RegExp(SECRET_PARAM_PATTERN.source, 'gi');
      while ((match = pattern.exec(value)) !== null) {
        const candidate = match[2];
        if (candidate.length >= 6 && !candidate.includes('{{') && !candidate.includes('$')) {
          findings.push({ path, kind: `fixed-param:${match[1]}`, excerpt: match[0] });
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (skip.has(key) && path === '') {
          continue;
        }
        // Credential-bearing request headers are a static-secret vector.
        if (/^(cookie|authorization)$/i.test(key) && typeof value[key] === 'string' &&
          value[key].trim().length > 0) {
          findings.push({ path: path === '' ? key : `${path}.${key}`, kind: 'static-header', excerpt: key });
        }
        walk(value[key], path === '' ? key : `${path}.${key}`);
      }
    }
  };
  walk(source, '');
  return findings;
}

// Rules must never synthesize paywall placeholder text in place of content.
export function collectPaywallFindings(source) {
  const findings = [];
  const contentRules = [
    ['ruleContent', source.ruleContent],
    ['ruleBookInfo', source.ruleBookInfo],
  ];
  for (const [section, rules] of contentRules) {
    if (rules === undefined || rules === null || typeof rules !== 'object') {
      continue;
    }
    for (const [key, value] of Object.entries(rules)) {
      if (typeof value !== 'string') {
        continue;
      }
      if (/(这是[^'"]*付费|付费章节|请购买|订阅本章|VIP章节)/.test(value) ||
        /\|\|\s*['"][^'"]*[一-鿿]/.test(value) && /@js|<js>/.test(value)) {
        findings.push({ path: `${section}.${key}`, excerpt: value.slice(0, 160) });
      }
    }
  }
  return findings;
}

export function validateBundledMetadata(source, expectedSuiteVersion = SUITE_VERSION) {
  const errors = [];
  const label = String(source.bookSourceName ?? source.bookSourceUrl ?? '?');
  if (typeof source.builtinId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(source.builtinId)) {
    errors.push(`${label}: builtinId must be a slug`);
  }
  if (!Number.isSafeInteger(source.builtinVersion) || source.builtinVersion < BUILTIN_VERSION) {
    errors.push(`${label}: builtinVersion must be an integer >= ${BUILTIN_VERSION}`);
  }
  if (source.readerTestBuiltinVersion !== source.builtinVersion) {
    errors.push(`${label}: readerTestBuiltinVersion must equal builtinVersion`);
  }
  if (typeof source.ruleFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(source.ruleFingerprint)) {
    errors.push(`${label}: ruleFingerprint must be 64 lowercase hex chars`);
  } else if (source.ruleFingerprint !== ruleFingerprint(source)) {
    errors.push(`${label}: ruleFingerprint does not match the canonical rule payload`);
  }
  if (typeof source.verifiedAt !== 'string' || Number.isNaN(Date.parse(source.verifiedAt))) {
    errors.push(`${label}: verifiedAt must be an ISO timestamp`);
  }
  if (source.verificationSuiteVersion !== expectedSuiteVersion) {
    errors.push(`${label}: verificationSuiteVersion must be ${expectedSuiteVersion}`);
  }
  if (!Array.isArray(source.capabilities) || source.capabilities.length === 0) {
    errors.push(`${label}: capabilities must be a non-empty array`);
  } else if (source.defaultEnabled !== false &&
    !REQUIRED_CAPABILITIES.every(capability => source.capabilities.includes(capability))) {
    errors.push(`${label}: default-enabled sources must carry all of ${REQUIRED_CAPABILITIES.join('/')}`);
  }
  if (typeof source.provenance !== 'object' || source.provenance === null ||
    typeof source.provenance.origin !== 'string' || source.provenance.origin.length === 0) {
    errors.push(`${label}: provenance.origin is required`);
  }
  if (typeof source.defaultEnabled !== 'boolean') {
    errors.push(`${label}: defaultEnabled must be a boolean`);
  }
  if (typeof source.enabled !== 'boolean' || source.enabled !== source.defaultEnabled) {
    errors.push(`${label}: enabled must equal defaultEnabled in the bundled document`);
  }
  return errors;
}

// -- reader-cli live runner ---------------------------------------------------

export function runCliTestSource({ cliPath, cwd, sourceFile, keyword, timeoutSec, recordDir, wallLimitMs }) {
  const args = [
    '--test-source', sourceFile,
    '--keyword', keyword,
    '--timeout', String(timeoutSec),
  ];
  if (recordDir !== undefined) {
    args.push('--record', recordDir);
  }
  const startedAt = Date.now();
  const run = spawnSync(cliPath, args, {
    cwd,
    encoding: 'utf8',
    timeout: wallLimitMs,
    maxBuffer: 8 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt;
  if (run.error !== undefined) {
    return { ok: false, hang: false, durationMs, error: String(run.error) };
  }
  if (run.signal !== null) {
    return { ok: false, hang: true, durationMs, error: `terminated by ${run.signal}` };
  }
  let report = null;
  try {
    report = JSON.parse(run.stdout);
  } catch (_) {
    return { ok: false, hang: false, durationMs, error: `invalid JSON stdout: ${run.stdout.slice(-400)} ${run.stderr.slice(-400)}` };
  }
  const levels = report?.levels ?? {};
  const failed = ['L1-import', 'L2-search', 'L3-detail', 'L4-toc', 'L5-content']
    .filter(level => levels[level]?.status !== 'pass');
  return { ok: failed.length === 0, hang: false, durationMs, report, failedLevels: failed };
}

// Extracts multi-book / multi-chapter / transport evidence from one recording.
export function analyzeRecording(recording) {
  const steps = Array.isArray(recording?.steps) ? recording.steps : [];
  const byLevel = {};
  for (const step of steps) {
    (byLevel[step.level] ??= []).push(step);
  }
  const bookUrl = recording?.chain?.book_url ??
    byLevel['L3-detail']?.[0]?.url ?? null;
  const insecureRedirectHops = steps
    .filter(step => typeof step.final_url === 'string' && step.final_url.startsWith('http://'))
    .map(step => step.final_url);
  const tocBody = byLevel['L4-toc']?.[0]?.response_body ?? '';
  const chapterCount = countChapterCandidates(tocBody);
  const contentBody = byLevel['L5-content']?.[0]?.response_body ?? '';
  const contentChars = visibleTextLength(contentBody);
  const replacementChars = (contentBody.match(/�/g) ?? []).length;
  return {
    bookUrl,
    chapterCount,
    contentChars,
    replacementRatio: contentBody.length > 0 ? replacementChars / contentBody.length : 0,
    insecureRedirectHops,
    stepUrls: steps.map(step => step.url),
  };
}

function countChapterCandidates(body) {
  if (body.length === 0) {
    return 0;
  }
  const candidates = [];
  const trimmed = body.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(body);
      let maxArray = 0;
      const isChapterEntry = item =>
        item !== null && typeof item === 'object' &&
        Object.entries(item).some(([key, field]) => {
          if (typeof field === 'string' && /^https?:\/\/|^\//.test(field) && field.length > 4) {
            return true;
          }
          if (/^(seq|chapter_index|chapter_id|cid|idx)$/i.test(key)) {
            return typeof field === 'number' || /^\d+$/.test(String(field));
          }
          return typeof field === 'string' && /第.+[章回节]|Chapter\s*\d+/i.test(field);
        });
      const visit = value => {
        if (Array.isArray(value)) {
          const chapterLike = value.filter(isChapterEntry).length;
          if (chapterLike >= Math.max(1, value.length / 2)) {
            maxArray = Math.max(maxArray, value.length);
          }
          value.forEach(visit);
          return;
        }
        if (value !== null && typeof value === 'object') {
          Object.values(value).forEach(visit);
        }
      };
      visit(parsed);
      if (maxArray > 0) {
        candidates.push(maxArray);
      }
    } catch (_) {
      // fall through to markup heuristics
    }
  }
  candidates.push((body.match(/<a\s[^>]*href=/g) ?? []).length);
  candidates.push((body.match(/<(cp|item|chapter)[\s>/]/g) ?? []).length);
  return Math.max(0, ...candidates);
}

function visibleTextLength(body) {
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, '')
    .length;
}
