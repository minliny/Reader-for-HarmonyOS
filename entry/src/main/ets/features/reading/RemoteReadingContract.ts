import type { JsonObject } from '@reader/core-harmony';
import { errorMessageOf, isNetworkEnvironmentFailure } from '../../app/ErrorMessage.ts';

export type RemoteReadingCommand =
  'book.detail' | 'book.toc' | 'chapter.content' |
  'reading.progress.get' | 'reader.location.resolve' | 'reading.progress.update' |
  'cache.book.status' | 'search.content' | 'source.list';

export type RemoteReadingErrorCode =
  'invalidInput' | 'unsupportedHostCapability' | 'invalidResponse' |
  'identityMismatch' | 'missingTocUrl' | 'emptyToc' |
  'chapterNotFound' | 'chapterNotDownloaded' | 'cachedSessionUnavailable' |
  'nonTextChapter' | 'commandFailed' | 'cancelled' | 'storageFailure' |
  'sourceVersionChanged' | 'cacheDerivedCorrupt' | 'positionContextStale' | 'networkEnvironment';

export type RemoteReadingFailureCategory = 'CACHE_MISSING' | 'CACHE_DERIVED_CORRUPT' |
  'STORAGE_FAILURE' | 'CANCELLED' | 'IDENTITY_MISMATCH' | 'SOURCE_VERSION_CHANGED' |
  'SOURCE_HTTP_FAILED' | 'SOURCE_RESPONSE_FORMAT' | 'SOURCE_RULE_FAILED' |
  'SOURCE_TOC_EMPTY' | 'SOURCE_CONTENT_EMPTY' | 'POSITION_CONTEXT_STALE' | 'NETWORK_ENVIRONMENT';

export type RemoteReadingHostCapabilityId =
  'httpExecute' | 'responseCharsetDecoding' | 'platformCookieJar' |
  'session' | 'nonUtf8RequestBody' | 'redirectFinalUrl';

export type RemoteReadingHostCapabilityStatus = 'attemptable' | 'unsupported';

export type RemoteReadingHostCapabilityFact = {
  id: RemoteReadingHostCapabilityId;
  status: RemoteReadingHostCapabilityStatus;
  reason: string;
};

export type RemoteReadingVariable = {
  name: string;
  value: string;
};

export type RemoteReadingIdentity = {
  sourceId: string;
  bookId: string;
};

export type RemoteReadingTocDiagnostic = {
  sourceId: string;
  bookId: string;
  tocUrl: string;
  returnedEntryCount: number;
  readableEntryCount?: number;
  responseBytes?: number;
  firstResponseBytes?: number;
  responseDigest?: string;
  firstResponseDigest?: string;
  finalUrlDigest?: string;
  httpStatus?: number;
  requestId?: number;
};

/** Bounded, log-safe facts. URLs, response text and continuation values never enter this record. */
export type RemoteReadingFailureRecord = {
  attemptId: number;
  category: RemoteReadingFailureCategory;
  stage?: RemoteReadingCommand;
  returnedEntryCount?: number;
  readableEntryCount?: number;
  responseBytes?: number;
  firstResponseBytes?: number;
  responseDigest?: string;
  firstResponseDigest?: string;
  finalUrlDigest?: string;
  httpStatus?: number;
  previousCategory?: RemoteReadingFailureCategory;
  requestId?: number;
  elapsedMs?: number;
  identityRef?: number;
  ruleVersion?: string;
  cacheDecision?: 'miss' | 'derivedCorrupt' | 'blocked' | 'refresh';
};

/**
 * A typed feature-boundary failure. UI code may classify it, but must not
 * replace a blocked transport capability with a fake remote-reading result.
 */
export class RemoteReadingGatewayError extends Error {
  readonly code: RemoteReadingErrorCode;
  readonly command: RemoteReadingCommand | undefined;
  readonly capability: RemoteReadingHostCapabilityId | undefined;
  readonly diagnostic: RemoteReadingTocDiagnostic | undefined;
  readonly category: RemoteReadingFailureCategory;
  readonly causeValue: unknown;
  readonly transientTransport: boolean;
  readonly previousCategory: RemoteReadingFailureCategory | undefined;

  constructor(
    code: RemoteReadingErrorCode,
    message: string,
    command: RemoteReadingCommand | undefined = undefined,
    capability: RemoteReadingHostCapabilityId | undefined = undefined,
    diagnostic: RemoteReadingTocDiagnostic | undefined = undefined,
    causeValue: unknown = undefined,
    category?: RemoteReadingFailureCategory,
    transientTransport: boolean = false,
    previousCategory?: RemoteReadingFailureCategory,
  ) {
    super(message);
    this.name = 'RemoteReadingGatewayError';
    this.code = code;
    this.command = command;
    this.capability = capability;
    this.diagnostic = diagnostic;
    this.causeValue = causeValue;
    this.category = category ?? remoteReadingCategoryForCode(code);
    this.transientTransport = transientTransport;
    this.previousCategory = previousCategory;
  }
}

function remoteReadingCategoryForCode(code: RemoteReadingErrorCode): RemoteReadingFailureCategory {
  switch (code) {
    case 'networkEnvironment': return 'NETWORK_ENVIRONMENT';
    case 'positionContextStale': return 'POSITION_CONTEXT_STALE';
    case 'cancelled': return 'CANCELLED';
    case 'storageFailure': return 'STORAGE_FAILURE';
    case 'sourceVersionChanged': return 'SOURCE_VERSION_CHANGED';
    case 'identityMismatch': return 'IDENTITY_MISMATCH';
    case 'cachedSessionUnavailable': case 'chapterNotDownloaded': return 'CACHE_MISSING';
    case 'cacheDerivedCorrupt': return 'CACHE_DERIVED_CORRUPT';
    case 'emptyToc': return 'SOURCE_TOC_EMPTY';
    case 'commandFailed': case 'unsupportedHostCapability': return 'SOURCE_HTTP_FAILED';
    default: return 'SOURCE_RESPONSE_FORMAT';
  }
}

export function remoteReadingFailureRecord(error: RemoteReadingGatewayError, attemptId: number): RemoteReadingFailureRecord {
  const record: RemoteReadingFailureRecord = { attemptId, category: error.category, stage: error.command };
  for (const name of ['returnedEntryCount', 'readableEntryCount', 'responseBytes', 'firstResponseBytes', 'httpStatus', 'requestId'] as const) {
    const value = error.diagnostic?.[name];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) record[name] = value;
  }
  for (const name of ['responseDigest', 'firstResponseDigest', 'finalUrlDigest'] as const) {
    const value = error.diagnostic?.[name];
    if (typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)) record[name] = value;
  }
  if (error.previousCategory !== undefined) record.previousCategory = error.previousCategory;
  else if (error.causeValue instanceof RemoteReadingGatewayError) record.previousCategory = error.causeValue.category;
  return record;
}

/** Select summaries only; never copy Host headers, cookie sessions or URLs to logs. */
export function remoteReadingHttpSummary(value: unknown): Partial<RemoteReadingTocDiagnostic> {
  const summary: Partial<RemoteReadingTocDiagnostic> = {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return summary;
  const raw = value as JsonObject;
  for (const name of ['responseBytes', 'firstResponseBytes', 'httpStatus'] as const) {
    const candidate = raw[name] ?? (name === 'httpStatus' ? raw['status'] : undefined);
    if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0) summary[name] = candidate;
  }
  for (const name of ['responseDigest', 'firstResponseDigest', 'finalUrlDigest'] as const) {
    const candidate = raw[name];
    if (typeof candidate === 'string' && /^[a-f0-9]{64}$/i.test(candidate)) summary[name] = candidate;
  }
  return summary;
}

export function isRemoteReadingCacheRecoveryEligible(error: unknown): boolean {
  return error instanceof RemoteReadingGatewayError &&
    (error.code === 'cachedSessionUnavailable' || error.code === 'cacheDerivedCorrupt');
}

/**
 * Current source-grounded HarmonyOS Host capability facts.
 *
 * This product contract records only whether the current Host implementation
 * can attempt a capability. VM/device evidence belongs in the root audit and
 * must never be embedded as a runtime fact.
 */
export function remoteReadingHostCapabilitySnapshot(): RemoteReadingHostCapabilityFact[] {
  return [
    {
      id: 'httpExecute',
      status: 'attemptable',
      reason: 'Harmony Host registers bounded http.execute request handling',
    },
    {
      id: 'responseCharsetDecoding',
      status: 'attemptable',
      reason: 'Harmony Host decodes response bytes through the shared charset policy',
    },
    {
      id: 'platformCookieJar',
      status: 'attemptable',
      reason: 'Harmony Host owns a source-scoped persistent cookie session store',
    },
    {
      id: 'session',
      status: 'attemptable',
      reason: 'opaque source sessions are routed through the Host cookie store',
    },
    {
      id: 'nonUtf8RequestBody',
      status: 'attemptable',
      reason: 'Harmony Host encodes request bodies through the shared text encoding policy',
    },
    {
      id: 'redirectFinalUrl',
      status: 'attemptable',
      reason: 'Harmony Host follows bounded redirects and returns the final URL',
    },
  ];
}

/** Fail before Core/Host I/O when a source is already known to need a blocked capability. */
export function assertRemoteReadingHostRequirements(requirements: RemoteReadingHostCapabilityId[]): void {
  const facts = remoteReadingHostCapabilitySnapshot();
  for (const requirement of requirements) {
    let matched: RemoteReadingHostCapabilityFact | undefined = undefined;
    for (const fact of facts) {
      if (fact.id === requirement) {
        matched = fact;
        break;
      }
    }
    if (matched === undefined) {
      throw new RemoteReadingGatewayError('invalidInput', `unknown remote-reading Host capability: ${requirement}`);
    }
    if (matched.status === 'unsupported') {
      throw new RemoteReadingGatewayError(
        'unsupportedHostCapability',
        matched.reason,
        undefined,
        matched.id,
      );
    }
  }
}

export function createRemoteReadingIdentity(sourceId: string, bookId: string): RemoteReadingIdentity {
  assertRemoteReadingNonBlankString(sourceId, 'sourceId');
  assertRemoteReadingNonBlankString(bookId, 'bookId');
  if (sourceId === 'local') {
    throw new RemoteReadingGatewayError(
      'invalidInput',
      'RemoteReadingFlowGateway does not accept the local source identity',
    );
  }
  return { sourceId, bookId };
}

export function assertRemoteReadingNonBlankString(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RemoteReadingGatewayError('invalidInput', `${field} must be a non-blank string`);
  }
}

/** Decode a Core string map without leaking JsonObject into page state. */
export function decodeRemoteReadingVariables(
  value: unknown,
  context: string,
  optional: boolean = false,
): RemoteReadingVariable[] {
  if ((value === undefined || value === null) && optional) {
    return [];
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RemoteReadingGatewayError('invalidResponse', `${context} returned invalid variables`);
  }
  const raw = value as JsonObject;
  const names = Object.keys(raw).sort();
  const variables: RemoteReadingVariable[] = [];
  for (const name of names) {
    const variableValue = raw[name];
    if (typeof variableValue !== 'string') {
      throw new RemoteReadingGatewayError('invalidResponse', `${context} returned non-string variables`);
    }
    variables.push({ name, value: variableValue });
  }
  return variables;
}

/**
 * Merge Legado continuation variables in protocol order. Later stages win:
 * search item < detail < individual TOC entry.
 */
export function mergeRemoteReadingVariables(
  base: RemoteReadingVariable[],
  override: RemoteReadingVariable[],
): RemoteReadingVariable[] {
  const merged: RemoteReadingVariable[] = [];
  for (const variable of base) {
    upsertRemoteReadingVariable(merged, variable);
  }
  for (const variable of override) {
    upsertRemoteReadingVariable(merged, variable);
  }
  merged.sort((left: RemoteReadingVariable, right: RemoteReadingVariable): number =>
    left.name.localeCompare(right.name));
  return merged;
}

export function encodeRemoteReadingVariables(variables: RemoteReadingVariable[]): JsonObject {
  const encoded: JsonObject = {};
  for (const variable of variables) {
    assertRemoteReadingNonBlankString(variable.name, 'variable.name');
    if (typeof variable.value !== 'string') {
      throw new RemoteReadingGatewayError('invalidInput', 'variable.value must be a string');
    }
    encoded[variable.name] = variable.value;
  }
  return encoded;
}

/** Convert known Host fail-closed messages into stable feature capability errors. */
export function classifyRemoteReadingCommandFailure(
  command: RemoteReadingCommand,
  error: unknown,
): RemoteReadingGatewayError {
  if (error instanceof RemoteReadingGatewayError) {
    return error;
  }
  const message = errorMessageOf(error);
  const raw = error !== null && typeof error === 'object' ? error as {
    code?: unknown; details?: JsonObject; error?: { code?: unknown; details?: JsonObject };
    event?: { requestId?: number; error?: { code?: unknown; details?: JsonObject } };
  } : undefined;
  const code = raw?.event?.error?.code ?? raw?.code ?? raw?.error?.code;
  const details = raw?.event?.error?.details ?? raw?.details ?? raw?.error?.details;
  const diagnostic: RemoteReadingTocDiagnostic = {sourceId:'',bookId:'',tocUrl:'',returnedEntryCount:0,
    requestId:raw?.event?.requestId,
    ...remoteReadingHttpSummary(details)};
  const category = details?.['category'];
  if (isNetworkEnvironmentFailure(error)) {
    return new RemoteReadingGatewayError('networkEnvironment', message, command, undefined, diagnostic, error);
  }
  if (code === 'CANCELLED' || /cancelled|canceled|已取消/i.test(message)) {
    return new RemoteReadingGatewayError('cancelled', message, command, undefined, diagnostic, error);
  }
  if (command === 'search.content' && (details?.['reason'] === 'CONTENT_SEARCH_STALE' || details?.['reason'] === 'CONTENT_SEARCH_EXPIRED')) {
    return new RemoteReadingGatewayError('positionContextStale',
      '搜索期间正文或处理状态已更新，请重新搜索。', command, undefined, diagnostic, error);
  }
  if (details?.['requiresPositionMigration'] === true || details?.['reason'] === 'POSITION_CONTEXT_STALE' ||
    details?.['reason'] === 'PROCESSING_CONTEXT_STALE') {
    const recovery = details?.['reason'] === 'PROCESSING_CONTEXT_STALE' ?
      '当前正文处理结果与原阅读位置暂时无法核对，原位置已保留。可在阅读设置中检查简繁转换和正文替换后重试，或切换书源。' :
      '正文版本与原阅读位置暂时无法核对，已保留原位置。请重新打开章节，或从目录选择其他章节。';
    return new RemoteReadingGatewayError('positionContextStale', recovery, command, undefined, diagnostic, error);
  }
  if (details?.['reason'] === 'sourceVersionDrift' || category === 'SOURCE_VERSION_CHANGED') {
    return new RemoteReadingGatewayError('sourceVersionChanged', message, command, undefined, diagnostic, error);
  }
  if (category === 'CACHE_MISSING' && command === 'chapter.content') {
    return new RemoteReadingGatewayError('chapterNotDownloaded', message, command, undefined, diagnostic, error);
  }
  if (category === 'CACHE_DERIVED_CORRUPT') return new RemoteReadingGatewayError('cacheDerivedCorrupt', message, command, undefined, diagnostic, error);
  if (category === 'STORAGE_FAILURE' || command === 'cache.book.status') {
    return new RemoteReadingGatewayError('storageFailure', message, command, undefined, diagnostic, error);
  }
  if (category === 'SOURCE_HTTP_FAILED') {
    const cause = details?.['cause'];
    const transport = cause !== null && typeof cause === 'object' && !Array.isArray(cause) ? cause as JsonObject : details;
    const transient = transport?.['category'] === 'SOURCE_HTTP_FAILED' && transport['phase'] === 'transport' &&
      transport['transient'] === true;
    return new RemoteReadingGatewayError('commandFailed', message, command, undefined, diagnostic, error,
      'SOURCE_HTTP_FAILED', transient);
  }
  if (category === 'SOURCE_RULE_FAILED' || category === 'SOURCE_RESPONSE_FORMAT') {
    return new RemoteReadingGatewayError('invalidResponse', message, command, undefined,
      diagnostic, error, category);
  }
  if (message.indexOf('usePlatformCookieJar is not supported') >= 0) {
    return new RemoteReadingGatewayError(
      'unsupportedHostCapability', message, command, 'platformCookieJar',
    );
  }
  if (message.indexOf('session is not supported') >= 0) {
    return new RemoteReadingGatewayError('unsupportedHostCapability', message, command, 'session');
  }
  if (message.indexOf('non-UTF-8 request charset is not supported') >= 0) {
    return new RemoteReadingGatewayError(
      'unsupportedHostCapability', message, command, 'nonUtf8RequestBody',
    );
  }
  return new RemoteReadingGatewayError('commandFailed', `${command} failed: ${message}`, command, undefined, diagnostic, error);
}

/**
 * Only an unavailable online execution may fall back to an exact Core cache.
 * Contract, identity, and content-shape failures must remain visible instead
 * of being disguised by an older cached projection.
 */
export function isRemoteReadingCacheFallbackEligible(error: unknown): boolean {
  return error instanceof RemoteReadingGatewayError &&
    (error.code === 'commandFailed' || error.code === 'unsupportedHostCapability' || error.code === 'networkEnvironment');
}

function upsertRemoteReadingVariable(
  variables: RemoteReadingVariable[],
  candidate: RemoteReadingVariable,
): void {
  assertRemoteReadingNonBlankString(candidate.name, 'variable.name');
  if (typeof candidate.value !== 'string') {
    throw new RemoteReadingGatewayError('invalidInput', 'variable.value must be a string');
  }
  for (let index = 0; index < variables.length; index += 1) {
    if (variables[index].name === candidate.name) {
      variables[index] = { name: candidate.name, value: candidate.value };
      return;
    }
  }
  variables.push({ name: candidate.name, value: candidate.value });
}
