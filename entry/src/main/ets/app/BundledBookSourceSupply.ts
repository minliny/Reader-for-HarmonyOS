import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from './ErrorMessage';
import type { JsonObject } from '@reader/core-harmony';

const LOG_DOMAIN = 0x5244;
const LEDGER_FILE_NAME = 'reader-builtin-source-ledger.json';
const LEDGER_SCHEMA_VERSION = 1;

// Source identities shipped in readerTestBuiltinVersion 1. They seed the
// withdrawal ledger on devices upgrading from v1, where no ledger exists yet,
// so sources dropped from v2+ bundles are still detected and retired.
const KNOWN_V1_SOURCE_IDS: string[] = [
  'https://m.idejian.com',
  'https://dushu.baidu.com/',
  'https://ubook.reader.qq.com/',
  'https://www.jjwxc.net/',
  'https://m.qidian.com#ReaderTestBuiltin',
  'https://novel.cooks.tw',
  'https://fiction.fengduxiaoshuo.com',
  'https://m.sfacg.com',
];

// Must stay byte-identical with tools/source-supply-lib.mjs RULE_PAYLOAD_FIELDS.
const RULE_PAYLOAD_FIELDS: string[] = [
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

export type BundledSourceDecision = 'unchanged' | 'upgrade' | 'userCopy';

export type BundledSourceLedgerEntry = {
  builtinId: string;
  sourceId: string;
};

export async function sha256Hex(text: string): Promise<string> {
  const digest = cryptoFramework.createMd('SHA256');
  await digest.update({ data: new util.TextEncoder().encodeInto(text) });
  const output = await digest.digest();
  const alphabet = '0123456789abcdef';
  let result = '';
  for (const byte of output.data) {
    result += alphabet.charAt((byte >>> 4) & 0x0f);
    result += alphabet.charAt(byte & 0x0f);
  }
  return result;
}

function canonicalJson(value: object | string | number | boolean | null | undefined | object[]): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const item = (value as Record<string, object | string | number | boolean | null>)[key];
      parts.push(`${JSON.stringify(key)}:${canonicalJson(item)}`);
    }
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Canonical serialization of the fields that define what the verification
 * suite certified. Must stay byte-identical with the node implementation in
 * tools/source-supply-lib.mjs; both sides feed the same SHA-256.
 */
export function canonicalRulePayloadJson(source: JsonObject): string {
  const picked: JsonObject = {};
  for (const field of RULE_PAYLOAD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      picked[field] = source[field];
    }
  }
  return canonicalJson(picked);
}

/** Anything seeded or later managed by the bundled-source pipeline. */
export function hasBuiltinMarker(source: JsonObject): boolean {
  const builtinId = source['builtinId'];
  if (typeof builtinId === 'string' && builtinId.trim().length > 0) {
    return true;
  }
  return typeof source['readerTestBuiltinVersion'] === 'number';
}

export function isUserModifiedBuiltinCopy(stored: JsonObject, storedActualFingerprint: string): boolean {
  const recorded = stored['ruleFingerprint'];
  // v1-era copies carry no fingerprint, so modification cannot be proven and
  // the version-compare path decides.
  if (typeof recorded !== 'string' || recorded.length === 0) {
    return false;
  }
  return storedActualFingerprint !== recorded;
}

/**
 * Compares a bundled candidate against a clean stored builtin copy. A stored
 * copy whose rules no longer hash to their recorded fingerprint is a user
 * modification and is never force-overwritten.
 */
export function decideBundledUpgrade(
  bundledVersion: number,
  bundledFingerprint: string,
  stored: JsonObject,
  storedActualFingerprint: string,
): BundledSourceDecision {
  if (isUserModifiedBuiltinCopy(stored, storedActualFingerprint)) {
    return 'userCopy';
  }
  const storedVersion = typeof stored['builtinVersion'] === 'number'
    ? stored['builtinVersion'] as number
    : typeof stored['readerTestBuiltinVersion'] === 'number'
      ? stored['readerTestBuiltinVersion'] as number
      : 0;
  const recorded = stored['ruleFingerprint'];
  const recordedFingerprint = typeof recorded === 'string' ? recorded : undefined;
  if (storedVersion === bundledVersion && recordedFingerprint === bundledFingerprint) {
    return 'unchanged';
  }
  return 'upgrade';
}

type StoredLedger = {
  schemaVersion: number;
  installed: BundledSourceLedgerEntry[];
};

/**
 * Persistent record of every builtin source identity this installation has
 * ever seeded. Only identities recorded here can be recognized as withdrawn
 * when they disappear from a newer bundle.
 */
export class BundledSourceLedger {
  private constructor(private readonly entries: BundledSourceLedgerEntry[]) {
  }

  static async load(context: common.UIAbilityContext): Promise<BundledSourceLedger> {
    const path = `${context.filesDir}/${LEDGER_FILE_NAME}`;
    try {
      if (!await fileIo.access(path)) {
        return BundledSourceLedger.seedV1();
      }
      const text = await this.readText(path);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const installed = parsed['installed'];
      if (parsed['schemaVersion'] !== LEDGER_SCHEMA_VERSION || !Array.isArray(installed)) {
        return BundledSourceLedger.seedV1();
      }
      const entries: BundledSourceLedgerEntry[] = [];
      for (const raw of installed) {
        if (typeof raw !== 'object' || raw === null) {
          continue;
        }
        const record = raw as Record<string, unknown>;
        if (typeof record['sourceId'] !== 'string' || record['sourceId'].length === 0) {
          continue;
        }
        entries.push({
          builtinId: typeof record['builtinId'] === 'string' ? record['builtinId'] : '',
          sourceId: record['sourceId'],
        });
      }
      if (entries.length === 0) {
        return BundledSourceLedger.seedV1();
      }
      return new BundledSourceLedger(entries);
    } catch (error) {
      hilog.error(LOG_DOMAIN, 'Reader',
        'Bundled source ledger unreadable, resetting to v1 seed: %{public}s', errorMessageOf(error));
      return BundledSourceLedger.seedV1();
    }
  }

  private static async readText(path: string): Promise<string> {
    const file = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
    try {
      const stat = await fileIo.stat(path);
      const buffer = new ArrayBuffer(stat.size);
      await fileIo.read(file.fd, buffer);
      return util.TextDecoder.create('utf-8').decodeToString(new Uint8Array(buffer));
    } finally {
      await fileIo.close(file);
    }
  }

  private static seedV1(): BundledSourceLedger {
    return new BundledSourceLedger(KNOWN_V1_SOURCE_IDS.map(sourceId => ({
      builtinId: '',
      sourceId,
    })));
  }

  all(): BundledSourceLedgerEntry[] {
    return [...this.entries];
  }

  has(sourceId: string): boolean {
    return this.entries.some(entry => entry.sourceId === sourceId);
  }

  /** Upserts the current bundle so future removals are detectable. */
  syncCurrentBundle(bundled: JsonObject[]): void {
    for (const source of bundled) {
      const sourceId = source['bookSourceUrl'];
      const builtinId = source['builtinId'];
      if (typeof sourceId !== 'string' || typeof builtinId !== 'string') {
        continue;
      }
      const existing = this.entries.find(entry => entry.sourceId === sourceId);
      if (existing !== undefined) {
        existing.builtinId = builtinId;
      } else {
        this.entries.push({ builtinId, sourceId });
      }
    }
  }

  remove(sourceId: string): void {
    const index = this.entries.findIndex(entry => entry.sourceId === sourceId);
    if (index >= 0) {
      this.entries.splice(index, 1);
    }
  }

  async save(context: common.UIAbilityContext): Promise<void> {
    const path = `${context.filesDir}/${LEDGER_FILE_NAME}`;
    const stored: StoredLedger = {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      installed: this.entries,
    };
    const writer = new fileIo.AtomicFile(path);
    try {
      const stream = writer.startWrite();
      await new Promise<void>((resolve: () => void, reject: (reason?: Error) => void): void => {
        stream.on('error', (): void => reject(new Error('bundled source ledger write failed')));
        stream.end(JSON.stringify(stored), 'utf-8', resolve);
      });
      writer.finishWrite();
    } catch (error) {
      try {
        writer.failWrite();
      } catch (_) {
        // There may be no temporary file when startWrite itself failed.
      }
      throw error;
    }
  }
}
