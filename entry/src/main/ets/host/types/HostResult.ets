// HostResult — response type definitions for all Host capabilities.
//
// Sources of truth (must match HostRequest.ets capability names exactly):
//   1. Reader UI Contract — host-request.schema.json enum (31 items).
//   2. Reader-Core-Native — host.rs HostCapability enum (15-item closed set).
//
// Naming drift fixed on 2026-07-07:
//   - `cache.set` → `cache.put` (Core closed-set name).
//   - `clipboard.get/set` → `clipboard.copy/paste` (UI Contract).
//   - `tts.speak/stop` → `tts.system.start/stop/pause/resume` (UI Contract).
//   - `screen.keepOn/keepOff` → `device.screen.keep-on/release` (UI Contract).
//   - `background.start/stop` → `background.schedule/cancel` (UI Contract).
//   - `share.open` → `share.invoke` (UI Contract).

import { HostOperationId } from './HostRequest';

// ── http.execute ──
export interface HostHttpRedirect {
  from: string;
  to: string;
  status: number;
}

export interface HostHttpCookie {
  name: string;
  value: string;
  domain?: string;
}

export interface HostHttpResponse {
  status: number;
  body: string;
  bodyBase64?: string;
  headers?: Record<string, string | string[]>;
  finalUrl?: string;
  charsetHint?: string;
  redirects?: HostHttpRedirect[];
  cookies?: HostHttpCookie[];
  sessionId?: string;
}

export interface HostHttpCancelResponse {
  cancelled: boolean;
}

// ── cookie.get / cookie.set / cookie.clear ──
export interface HostCookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export interface HostCookieGetResponse {
  cookies: HostCookieEntry[];
}

export interface HostCookieSetResponse {
  stored: boolean;
}

export interface HostCookieClearResponse {
  cleared: boolean;
}

// ── webview.evaluateJavaScript / webview.open / webview.close / webview.evaluate ──
export interface HostWebViewEvaluateJavaScriptResponse {
  value: Object;
  finalUrl?: string;
  title?: string;
}

export interface HostWebViewOpenResponse {
  opened: boolean;
  profileId?: string;
}

export interface HostWebViewCloseResponse {
  closed: boolean;
}

export interface HostWebViewEvaluateResponse {
  result: Record<string, Object>;
}

// ── file.read / file.write / file.delete ──
export interface HostFileReadResponse {
  content?: string;
  contentBase64?: string;
  encoding?: string;
  byteLength?: number;
}

export interface HostFileWriteResponse {
  written: boolean;
  byteLength?: number;
}

export interface HostFileDeleteResponse {
  deleted: boolean;
}

// ── storage.path ──
export interface HostStoragePathResponse {
  path: string;
}

// ── cache.get / cache.put (Core closed-set) ──
export interface HostCacheGetResponse {
  hit: boolean;
  value?: string;
  valueBase64?: string;
  expiresAt?: string;
}

export interface HostCachePutResponse {
  stored: boolean;
  expiresAt?: string;
}

// ── persistence.get / persistence.put (Core closed-set) ──
export interface HostPersistenceGetResponse {
  found: boolean;
  value?: string;
  valueBase64?: string;
  revision?: string;
}

export interface HostPersistencePutResponse {
  stored: boolean;
  revision?: string;
}

// ── credential.get / credential.set / credential.delete ──
export interface HostCredentialGetResponse {
  value?: string;
  exists: boolean;
}

export interface HostCredentialSetResponse {
  stored: boolean;
}

export interface HostCredentialDeleteResponse {
  deleted: boolean;
}

// ── media.download (Core closed-set) ──
export interface HostMediaDownloadResponse {
  resourceId: string;
  tempPath?: string;
  statusCode: number;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  byteLength: number;
  sha256?: string;
  fromCache: boolean;
  finalUrl?: string;
}

// ── log.emit (Core closed-set) ──
export interface HostLogEmitResponse {
  emitted: boolean;
}

// ── time.now (Core closed-set) ──
export interface HostTimeNowResponse {
  unixMillis: number;
  iso8601: string;
  timezone?: string;
}

// ── system.info (Core closed-set) ──
export interface HostSystemInfoResponse {
  info: Object;
}

// ── permission.request / permission.check ──
export interface HostPermissionResponse {
  granted: boolean;
}

export interface HostPermissionCheckResponse {
  granted: boolean;
}

// ── background.schedule / background.cancel ──
export interface HostBackgroundScheduleResponse {
  scheduled: boolean;
}

export interface HostBackgroundCancelResponse {
  cancelled: boolean;
}

// ── notification.show / notification.cancel ──
export interface HostNotificationShowResponse {
  shown: boolean;
  id?: string;
}

export interface HostNotificationCancelResponse {
  cancelled: boolean;
}

// ── tts.system.start / stop / pause / resume ──
export interface HostTtsSystemStartResponse {
  started: boolean;
}

export interface HostTtsSystemControlResponse {
  // Used by stop / pause / resume.
  acknowledged: boolean;
}

// ── share.invoke ──
export interface HostShareInvokeResponse {
  shared: boolean;
}

// ── clipboard.copy / clipboard.paste ──
export interface HostClipboardCopyResponse {
  copied: boolean;
}

export interface HostClipboardPasteResponse {
  text: string;
}

// ── device.vibrate ──
export interface HostDeviceVibrateResponse {
  vibrated: boolean;
}

// ── device.screen.keep-on / device.screen.release ──
export interface HostDeviceScreenKeepOnResponse {
  enabled: boolean;
}

export interface HostDeviceScreenReleaseResponse {
  released: boolean;
}

// ── Generic result envelope ──
export type HostResult = Record<string, Object>;

export interface HostCompletePayload {
  operationId: HostOperationId;
  result: HostResult;
}
