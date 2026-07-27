// HostError — error types and error codes for Host capability failures.
// Source of truth: Reader-Core-Native docs/host-app-contracts/01-network-session.md §3.3.
// Phase 1 type layer; produced by Host adapters, consumed by HostDispatcher and Core Bridge.

import { HostOperationId } from './HostRequest';

export type HostErrorCode =
  | 'HTTP_TRANSPORT_TIMEOUT'
  | 'HTTP_TRANSPORT_DNS'
  | 'HTTP_TRANSPORT_TLS'
  | 'HTTP_TRANSPORT_CONNECT'
  | 'HTTP_TRANSPORT_HTTP_STATUS'
  | 'HTTP_TRANSPORT_CANCELED'
  | 'CAPABILITY_UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'FILE_PERMISSION_DENIED'
  | 'CACHE_MISS'
  | 'WEBVIEW_LOAD_FAILED'
  | 'WEBVIEW_SCRIPT_ERROR'
  | 'WEBVIEW_TIMEOUT'
  | 'TTS_UNAVAILABLE'
  | 'TTS_ERROR'
  | 'DOWNLOAD_FAILED'
  | 'INTERNAL';

export type HostErrorPhase =
  | 'Transport'
  | 'Runtime'
  | 'Script'
  | 'Storage'
  | 'Permission'
  | 'System';

export type HostChallengeKind =
  | 'captcha'
  | 'login'
  | 'cloudflare'
  | 'unknown';

export interface HostErrorDetails {
  phase?: HostErrorPhase;
  url?: string;
  finalUrl?: string;
  status?: number;
  challengeKind?: HostChallengeKind;
  loginRequired?: boolean;
  permission?: string;
  path?: string;
  script?: string;
  timeoutMs?: number;
  retryable?: boolean;
}

export interface HostError {
  code: HostErrorCode;
  message: string;
  retryable: boolean;
  details?: HostErrorDetails;
}

export interface HostErrorPayload {
  operationId: HostOperationId;
  error: HostError;
}

// ── Error classification helpers ──

export function isTransportError(code: HostErrorCode): boolean {
  return code.startsWith('HTTP_TRANSPORT_');
}

export function isRetryableTransportError(code: HostErrorCode): boolean {
  return code === 'HTTP_TRANSPORT_TIMEOUT' ||
    code === 'HTTP_TRANSPORT_DNS' ||
    code === 'HTTP_TRANSPORT_CONNECT';
}

// ── Error factory helpers ──

export function createTransportTimeoutError(url: string, phase: 'connect' | 'read'): HostError {
  return {
    code: 'HTTP_TRANSPORT_TIMEOUT',
    message: `${phase} timed out`,
    retryable: true,
    details: { phase: 'Transport', url: url },
  };
}

export function createTransportDnsError(url: string): HostError {
  return {
    code: 'HTTP_TRANSPORT_DNS',
    message: 'DNS resolution failed',
    retryable: true,
    details: { phase: 'Transport', url: url },
  };
}

export function createTransportTlsError(url: string, reason: string): HostError {
  return {
    code: 'HTTP_TRANSPORT_TLS',
    message: reason,
    retryable: false,
    details: { phase: 'Transport', url: url },
  };
}

export function createCapabilityUnavailableError(capability: string): HostError {
  return {
    code: 'CAPABILITY_UNAVAILABLE',
    message: `Capability '${capability}' not available on this platform`,
    retryable: false,
    details: { phase: 'Runtime' },
  };
}

export function createFileNotFoundError(path: string): HostError {
  return {
    code: 'FILE_NOT_FOUND',
    message: `File not found: ${path}`,
    retryable: false,
    details: { phase: 'Storage', path: path },
  };
}

export function createWebViewTimeoutError(url: string, timeoutMs: number): HostError {
  return {
    code: 'WEBVIEW_TIMEOUT',
    message: 'WebView operation timed out',
    retryable: true,
    details: { phase: 'Script', url: url, timeoutMs: timeoutMs },
  };
}

// HostErrorWrapper — wraps a HostError in an Error so it can be thrown in ArkTS,
// which requires throw targets to be Error instances. The original HostError is
// preserved on the `hostError` field for callers that need its structured data.
export class HostErrorWrapper extends Error {
  readonly hostError: HostError;

  constructor(hostError: HostError) {
    super(hostError.message);
    this.name = 'HostError';
    this.hostError = hostError;
  }
}
