import type { JsonObject } from '@reader/core-harmony';
import { errorMessageOf } from '../../app/ErrorMessage.ts';

export type RemoteReadingCommand =
  'book.detail' | 'book.toc' | 'chapter.content' |
  'reading.progress.get' | 'reader.location.resolve' | 'reading.progress.update' |
  'cache.book.status';

export type RemoteReadingErrorCode =
  'invalidInput' | 'unsupportedHostCapability' | 'invalidResponse' |
  'identityMismatch' | 'missingTocUrl' | 'emptyToc' |
  'chapterNotFound' | 'chapterNotDownloaded' | 'cachedSessionUnavailable' |
  'nonTextChapter' | 'commandFailed';

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

  constructor(
    code: RemoteReadingErrorCode,
    message: string,
    command: RemoteReadingCommand | undefined = undefined,
    capability: RemoteReadingHostCapabilityId | undefined = undefined,
    diagnostic: RemoteReadingTocDiagnostic | undefined = undefined,
  ) {
    super(message);
    this.name = 'RemoteReadingGatewayError';
    this.code = code;
    this.command = command;
    this.capability = capability;
    this.diagnostic = diagnostic;
  }
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
  return new RemoteReadingGatewayError('commandFailed', `${command} failed: ${message}`, command);
}

/**
 * Only an unavailable online execution may fall back to an exact Core cache.
 * Contract, identity, and content-shape failures must remain visible instead
 * of being disguised by an older cached projection.
 */
export function isRemoteReadingCacheFallbackEligible(error: unknown): boolean {
  return error instanceof RemoteReadingGatewayError &&
    (error.code === 'commandFailed' || error.code === 'unsupportedHostCapability');
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
