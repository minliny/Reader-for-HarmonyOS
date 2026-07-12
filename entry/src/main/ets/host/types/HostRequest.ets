// HostRequest — request type definitions for all Host capabilities.
//
// Sources of truth (do NOT invent names here):
//   1. Reader UI Contract 1.2.0 — generated/HostRequestTable.ets (58 items) is
//      the authoritative Reducer/UI wire list. This file retains the original
//      33-item UI subset only for the historical mixed Core dispatcher types.
//   2. Reader-Core-Native — crates/reader-contract/src/host.rs HostCapability
//      enum (15-item closed set). This is the authoritative list of capabilities
//      Core may send via host.request events over the NAPI bridge.
//
// The two lists overlap but are NOT identical:
//   - Core-only capabilities (cache.get/cache.put, media.download, log.emit,
//     time.now, system.info, persistence.get/persistence.put, host.smoke.echo)
//     are NOT in the UI Contract enum. They are included here because
//     HostDispatcher must route them when Core requests them.
//   - UI-only capabilities (webview.open/close, http.cancel, cookie.clear,
//     file.delete, storage.path, credential.*, tts.system.*,
//     permission.request/check, background.schedule/cancel,
//     timer.foreground.arm/cancel, notification.show/cancel, share.invoke, clipboard.copy/paste,
//     device.vibrate, device.screen.keep-on/release) are NOT in the Core
//     HostCapability closed set. Reducer may dispatch them directly to Host
//     adapters without crossing the Core boundary.
//
// Naming conventions verified against both sources on 2026-07-07:
//   - cache: Core uses `cache.put` (NOT `cache.set`). No `cache.set` anywhere.
//   - clipboard: UI Contract uses `clipboard.copy` / `clipboard.paste`
//     (NOT `clipboard.get` / `clipboard.set`).
//   - tts: UI Contract uses `tts.system.start/stop/pause/resume`
//     (NOT `tts.speak` / `tts.stop`). Core TTS is a method, not a capability.
//   - screen: UI Contract uses `device.screen.keep-on` / `device.screen.release`
//     (NOT `screen.keepOn` / `screen.keepOff`; note the hyphen and the
//     `device.` prefix).
//   - background: UI Contract uses `background.schedule` / `background.cancel`
//     (NOT `background.start` / `background.stop`).
//   - share: UI Contract uses `share.invoke` (NOT `share.open`).
//   - notification: UI Contract has `notification.show` + `notification.cancel`.
//   - permission: UI Contract has `permission.request` + `permission.check`.

export type HostRequestId = number;
export type HostOperationId = number;

// Optional Core-owned annotation on `source.check.run` HTTP descriptors.
// It is not a Host correlation id: `operationId` remains the only value used
// for `host.complete` / `host.error`.  Hosts may use this strict tuple solely
// to keep a short-lived private source-debug recorder isolated.
export type HostHttpDiagnosticStage = 'L2' | 'L3' | 'L4' | 'L5';

export interface HostHttpDiagnostic {
  traceId: string;
  requestId: number;
  sourceId: string;
  stage: HostHttpDiagnosticStage;
}

// Historical union of Core closed-set capabilities + the original 33-item UI
// HostRequest subset. New Reader UI capabilities belong to HostRequestTable +
// ReaderUiHostDispatcher, not this Core-facing compatibility union.
export type HostCapability =
  // ── Core closed-set (host.rs HostCapability) — Core may request these ──
  | 'host.smoke.echo'
  | 'http.execute'
  | 'cookie.get'
  | 'cookie.set'
  | 'webview.evaluateJavaScript'
  | 'file.read'
  | 'file.write'
  | 'cache.get'
  | 'cache.put'
  | 'log.emit'
  | 'time.now'
  | 'system.info'
  | 'persistence.get'
  | 'persistence.put'
  | 'media.download'
  // ── Legacy UI-only subset — Reducer may request these directly ──
  | 'http.cancel'
  | 'webview.open'
  | 'webview.close'
  | 'webview.evaluate'
  | 'cookie.clear'
  | 'file.delete'
  | 'storage.path'
  | 'credential.get'
  | 'credential.set'
  | 'credential.delete'
  | 'tts.system.start'
  | 'tts.system.stop'
  | 'tts.system.pause'
  | 'tts.system.resume'
  | 'permission.request'
  | 'permission.check'
  | 'background.schedule'
  | 'background.cancel'
  | 'timer.foreground.arm'
  | 'timer.foreground.cancel'
  | 'notification.show'
  | 'notification.cancel'
  | 'share.invoke'
  | 'clipboard.copy'
  | 'clipboard.paste'
  | 'device.vibrate'
  | 'device.screen.keep-on'
  | 'device.screen.release';

// ── http.execute / http.cancel ──
// Mirrors Reader-Core-Native host-app-contracts/01-network-session.md §3.1.
export interface HostHttpRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH'
    | 'PROPFIND' | 'MKCOL' | 'MOVE' | 'COPY';
  headers: Record<string, string>;
  body?: string;
  charset?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
  usePlatformCookieJar?: boolean;
  sessionId?: string;
  sourceId?: string;
  diagnostic?: HostHttpDiagnostic;
}

export interface HostHttpCancelRequest {
  sessionId?: string;
  requestId?: string;
}

// ── cookie.get / cookie.set / cookie.clear ──
export interface HostCookieGetRequest {
  url?: string;
  domain?: string;
  name?: string;
  sessionId?: string;
}

export interface HostCookieRecord {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  secure?: boolean;
  httpOnly?: boolean;
}

export interface HostCookieSetRequest {
  cookie: HostCookieRecord;
  sessionId?: string;
}

export interface HostCookieClearRequest {
  url?: string;
  domain?: string;
  sessionId?: string;
}

// ── webview.evaluateJavaScript / webview.open / webview.close / webview.evaluate ──
export interface HostWebViewEvaluateJavaScriptRequest {
  document: HostWebViewDocument;
  javaScript: string;
  timeoutMillis?: number;
  profileId?: string;
}

export interface HostWebViewDocument {
  kind: 'html' | 'url';
  body?: string;
  url?: string;
  baseUrl?: string;
}

export interface HostWebViewOpenRequest {
  url: string;
  profileId?: string;
}

export interface HostWebViewCloseRequest {
  profileId?: string;
}

export interface HostWebViewEvaluateRequest {
  script: string;
  profileId?: string;
}

// ── file.read / file.write / file.delete ──
export interface HostFileReadRequest {
  path: string;
  encoding?: string;
  byteOffset?: number;
  maxBytes?: number;
}

export interface HostFileWriteRequest {
  path: string;
  content?: string;
  contentBase64?: string;
  encoding?: string;
  createDirectories?: boolean;
  append?: boolean;
}

export interface HostFileDeleteRequest {
  path: string;
}

// ── storage.path ──
export interface HostStoragePathRequest {
  scope: 'cache' | 'files' | 'external';
}

// ── cache.get / cache.put (Core closed-set) ──
// Core uses `cache.put`, NOT `cache.set`. DTO mirrors host.rs HostCachePutRequest.
export interface HostCacheGetRequest {
  namespace: string;
  key: string;
}

export interface HostCachePutRequest {
  namespace: string;
  key: string;
  value?: string;
  valueBase64?: string;
  ttlMillis?: number;
}

// ── persistence.get / persistence.put (Core closed-set) ──
export interface HostPersistenceGetRequest {
  namespace: string;
  key: string;
}

export interface HostPersistencePutRequest {
  namespace: string;
  key: string;
  value?: string;
  valueBase64?: string;
  expectedRevision?: string;
}

// ── credential.get / credential.set / credential.delete ──
export interface HostCredentialGetRequest {
  key: string;
}

export interface HostCredentialSetRequest {
  key: string;
  value: string;
}

export interface HostCredentialDeleteRequest {
  key: string;
}

// ── media.download (Core closed-set) ──
export interface HostMediaDownloadRequest {
  url: string;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  rangeStart?: number;
  rangeEnd?: number;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  cacheKey?: string;
  savePath?: string;
  maxBytes?: number;
  sessionId?: string;
  timeoutMillis?: number;
}

// ── log.emit (Core closed-set) ──
export interface HostLogEmitRequest {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  target?: string;
  fields?: Record<string, Object>;
}

// ── time.now / system.info (Core closed-set) ──
export interface HostTimeNowRequest {
  clock?: string;
  timezone?: string;
}

export interface HostSystemInfoRequest {
  keys?: string[];
}

// ── permission.request / permission.check ──
export interface HostPermissionRequest {
  scope: string;
}

export interface HostPermissionCheckRequest {
  scope: string;
}

// ── background.schedule / background.cancel ──
export interface HostBackgroundScheduleRequest {
  taskId: string;
  delayMs?: number;
}

export interface HostBackgroundCancelRequest {
  taskId: string;
}

// ── timer.foreground.arm / timer.foreground.cancel ──
// Reader auto-page owns a cancellable foreground one-shot. It is deliberately
// separate from background.schedule: no timer may survive app backgrounding.
export interface HostForegroundTimerRequest {
  timerId: string;
  correlationId: string;
  delayMs: number;
  generation: number;
  oneShot: boolean;
  foregroundOnly: boolean;
}

// ── notification.show / notification.cancel ──
export interface HostNotificationShowRequest {
  title: string;
  body: string;
}

export interface HostNotificationCancelRequest {
  id: string;
}

// ── tts.system.start / stop / pause / resume ──
// UI Contract uses `tts.system.*` (NOT `tts.speak`). Core TTS queue control is
// a CoreCommand (tts.queue.*), not a HostRequest.
export interface HostTtsSystemStartRequest {
  text: string;
  rate?: number;
  pitch?: number;
  voice?: string;
  // Optional correlation metadata used by the R8 Pilot. Each real slice gets
  // a unique article id so a late TextReader completion cannot advance a
  // replacement queue.
  articleId?: string;
  correlationId?: string;
  generation?: number;
  sliceIndex?: number;
}

export interface HostTtsSystemControlRequest {
  // Used by stop / pause / resume — no payload fields.
}

// ── share.invoke ──
export interface HostShareInvokeRequest {
  text?: string;
  title?: string;
  url?: string;
  files?: string[];
}

// ── clipboard.copy / clipboard.paste ──
// UI Contract uses `clipboard.copy` / `clipboard.paste`
// (NOT `clipboard.get` / `clipboard.set`).
export interface HostClipboardCopyRequest {
  text: string;
}

// clipboard.paste takes no params; Host returns the pasted text.

// ── device.vibrate ──
export interface HostDeviceVibrateRequest {
  durationMs?: number;
}

// ── device.screen.keep-on / device.screen.release ──
// UI Contract uses `device.screen.keep-on` (hyphen) / `device.screen.release`
// (NOT `screen.keepOn` / `screen.keepOff`).
export interface HostDeviceScreenKeepOnRequest {
  enabled: boolean;
}

// device.screen.release takes no params.

// ── Generic request envelope ──
export interface HostRequestBase {
  capability: HostCapability;
  operationId: HostOperationId;
  requestId: HostRequestId;
}

export interface HostRequest extends HostRequestBase {
  params: Record<string, Object>;
}
