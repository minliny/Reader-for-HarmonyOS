// CoreRuntime — singleton orchestrator for Reader-Core runtime + Host adapters.
// Phase 3-4 Host integration:
//   Phase 3: Core closed-set adapters (http.execute / cookie.get / cookie.set /
//            webview.evaluateJavaScript / file.read / file.write /
//            host.smoke.echo / cache.* / persistence.* / log.emit / time.now /
//            system.info / media.download) registered with
//            HostCapabilityRegistry — Core may request these over NAPI.
//   Phase 4: UI-Contract-only adapters (clipboard.copy/paste, tts.system.*,
//            device.screen.keep-on/release, notification.*, background.*,
//            timer.foreground.*,
//            share.invoke, permission.*, credential.*, webview.open/close/
//            evaluate, file.delete) NOT registered with the registry (Core
//            will never request them); exposed via getters for Reducer direct
//            dispatch.
import readerCoreNapi from 'libreader_core_napi.so';
import common from '@ohos.app.ability.common';

import {
  ReaderCoreRuntime,
  type JsonObject,
  type NativeReaderCoreModule,
  type ReaderCoreHostRequestEvent,
  type ReaderCoreResultEvent,
} from './core/sdk/reader_core';
import { HostCapabilityRegistry, HostDispatcher } from '../host';
import {
  HostCapabilityManifest,
  type HostCapabilityAvailabilityResolver,
} from '../host/HostCapabilityManifest';
import { ReaderUiHostDispatcher } from '../host/ReaderUiHostDispatcher';
import {
  ReaderUiHostCapabilityManifest,
} from '../host/ReaderUiHostCapabilityManifest';
import { HarmonyReaderUiHostPlatform } from '../host/HarmonyReaderUiHostPlatform';
import type {
  ReaderUiHostRequest,
  ReaderUiHostResponse,
} from '../host/ReaderUiHostContract';
import type { HostCapability } from '../host/types';
import { HttpHostAdapter } from '../host/adapters/HttpHostAdapter';
import { SourceImageCache } from '../host/adapters/SourceImageCache';
import { CoreHostAdapter } from '../host/adapters/CoreHostAdapter';
import { CookieHostAdapter } from '../host/adapters/CookieHostAdapter';
import { SourceSessionHostStore } from '../host/adapters/SourceSessionHostStore';
import { WebViewHostAdapter } from '../host/adapters/WebViewHostAdapter';
import { FileHostAdapter } from '../host/adapters/FileHostAdapter';
import { ClipboardHostAdapter } from '../host/adapters/ClipboardHostAdapter';
import { TtsHostAdapter } from '../host/adapters/TtsHostAdapter';
import { ScreenHostAdapter } from '../host/adapters/ScreenHostAdapter';
import { DeviceHostAdapter } from '../host/adapters/DeviceHostAdapter';
import { NotificationHostAdapter } from '../host/adapters/NotificationHostAdapter';
import { BackgroundHostAdapter } from '../host/adapters/BackgroundHostAdapter';
import { ForegroundTimerHostAdapter } from '../host/adapters/ForegroundTimerHostAdapter';
import { ShareHostAdapter } from '../host/adapters/ShareHostAdapter';
import { PermissionHostAdapter } from '../host/adapters/PermissionHostAdapter';
import { CredentialHostAdapter } from '../host/adapters/CredentialHostAdapter';
import { FileSelectionHostAdapter } from '../host/adapters/FileSelectionHostAdapter';
import { FontHostAdapter } from '../host/adapters/FontHostAdapter';
import { NetworkHostAdapter } from '../host/adapters/NetworkHostAdapter';
import { WebDavHostAdapter } from '../host/adapters/WebDavHostAdapter';
import { ReaderUiPreferenceHostAdapter } from '../host/adapters/ReaderUiPreferenceHostAdapter';
import {
  type HostHttpRequest,
  type HostCookieGetRequest,
  type HostCookieSetRequest,
  type HostWebViewEvaluateJavaScriptRequest,
  type HostFileReadRequest,
  type HostFileWriteRequest,
  type HostCacheGetRequest,
  type HostCachePutRequest,
  type HostPersistenceGetRequest,
  type HostPersistencePutRequest,
  type HostLogEmitRequest,
  type HostTimeNowRequest,
  type HostSystemInfoRequest,
  type HostMediaDownloadRequest,
} from '../host/types';
import {
  SourceDebugTranscriptRecorder,
  type SourceDebugDiagnosticAnnotation,
  type SourceDebugDiagnosticStage,
  type SourceDebugReplayInput,
  type SourceDebugStageProjection,
} from './SourceDebugTranscriptRecorder';

const nativeModule = readerCoreNapi as NativeReaderCoreModule;

function diagnoseNativeModule(): string {
  const parts: string[] = [];
  parts.push(`typeof=${typeof readerCoreNapi}`);
  parts.push(`value=${readerCoreNapi === null ? 'null' : (readerCoreNapi === undefined ? 'undefined' : 'object')}`);
  if (readerCoreNapi && typeof readerCoreNapi === 'object') {
    try {
      const keys = Object.keys(readerCoreNapi);
      parts.push(`keys=[${keys.join(',')}]`);
    } catch (e) {
      parts.push(`keys-error=${e}`);
    }
  }
  parts.push(`nativeModule.type=${typeof nativeModule}`);
  parts.push(`nativeModule.value=${nativeModule === null ? 'null' : (nativeModule === undefined ? 'undefined' : 'object')}`);
  if (nativeModule && typeof nativeModule === 'object') {
    try {
      parts.push(`hasCreateRuntime=${typeof (nativeModule as Record<string, object>).createRuntime === 'function'}`);
    } catch (e) {
      parts.push(`hasCreateRuntime-error=${e}`);
    }
  }
  return parts.join(' | ');
}

export interface CoreRuntimeConfig {
  dataDir?: string;
  cacheDir?: string;
  context?: common.Context;
}

/**
 * Sanitized output from one source-debug transaction.  The private recorder
 * owns raw response bodies only long enough to feed Core `source.debug`; this
 * projection is the only shape that may cross into ReaderEffects/UI state.
 */
export interface CoreSourceDebugRunProjection {
  sourceId: string;
  sourceCheckData: JsonObject | null;
  sourceCheckError: string;
  sourceDebugData: JsonObject | null;
  sourceDebugError: string;
  stages: SourceDebugStageProjection[];
  replayAttempted: boolean;
  replayLimited: boolean;
  replayNotice: string;
}

/** Core's `source.imageRequest` descriptor after the Host has restored its
 * source/session ownership fields.  It is intentionally kept out of UI state:
 * SourceCoverImage consumes it immediately to stream a binary file cache. */
export interface CoreSourceImageRequestDescriptor {
  request: HostHttpRequest;
}

function sourceDebugTraceKey(traceId: string, sourceId: string): string {
  return `${traceId}\u0000${sourceId}`;
}

function sourceDebugErrorMessage(error: Object): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  const message = String(error).trim();
  return message.length > 0 ? message : '未知 Host 或 Core 错误。';
}

/**
 * One in-flight Core command whose native request identity remains visible to
 * the Host coordinator.  The legacy convenience wrappers below still expose a
 * Promise<JsonObject>, while W2 transaction code can retain this handle and
 * cancel the exact Core request without cancelling an unrelated command.
 */
export class CoreCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  private runtime: ReaderCoreRuntime;
  private cancellationRequested: boolean = false;

  constructor(runtime: ReaderCoreRuntime, requestId: number, result: Promise<JsonObject>) {
    this.runtime = runtime;
    this.requestId = requestId;
    this.result = result;
  }

  cancel(): boolean {
    if (this.cancellationRequested) return false;
    this.cancellationRequested = true;
    this.runtime.cancel(this.requestId);
    return true;
  }

  get isCancellationRequested(): boolean {
    return this.cancellationRequested;
  }
}

export class CoreRuntime {
  private static instance: CoreRuntime | null = null;
  private runtime: ReaderCoreRuntime;
  private registry: HostCapabilityRegistry;
  private dispatcher: HostDispatcher;
  // Single declarative source of truth for capability routing/requirements/
  // device-evidence status. Built after adapters so the availability resolver
  // can query live adapter nullness + registry membership.
  private manifest: HostCapabilityManifest;
  private sourceSessionStore: SourceSessionHostStore;
  // Phase 3 — Core closed-set adapters (registered with HostCapabilityRegistry).
  private httpAdapter: HttpHostAdapter;
  // Binary cover transfer is deliberately separate from http.execute's text
  // path. It exists only when an app-private cache directory is available.
  private sourceImageCache: SourceImageCache | null;
  private coreAdapter: CoreHostAdapter;
  private cookieAdapter: CookieHostAdapter;
  private webViewAdapter: WebViewHostAdapter;
  private fileAdapter: FileHostAdapter | null;
  // Phase 4 — UI-Contract-only adapters (exposed via getters for Reducer).
  private clipboardAdapter: ClipboardHostAdapter;
  private ttsAdapter: TtsHostAdapter;
  private screenAdapter: ScreenHostAdapter | null;
  private deviceAdapter: DeviceHostAdapter;
  private notificationAdapter: NotificationHostAdapter | null;
  private backgroundAdapter: BackgroundHostAdapter;
  private foregroundTimerAdapter: ForegroundTimerHostAdapter;
  private shareAdapter: ShareHostAdapter | null;
  private permissionAdapter: PermissionHostAdapter | null;
  private credentialAdapter: CredentialHostAdapter | null;
  private readerUiPreferenceAdapter: ReaderUiPreferenceHostAdapter | null;
  // Reader UI HostRequest 1.2.0 is a separate exact 58-item boundary. The
  // historical mixed Core/UI manifest above remains 43 items.
  private fileSelectionAdapter: FileSelectionHostAdapter | null;
  private fontAdapter: FontHostAdapter | null;
  private networkAdapter: NetworkHostAdapter;
  private webDavAdapter: WebDavHostAdapter | null;
  private readerUiHostPlatform: HarmonyReaderUiHostPlatform;
  private readerUiHostDispatcher: ReaderUiHostDispatcher;
  private readerUiHostManifest: ReaderUiHostCapabilityManifest;
  // Source-debug bodies are held only in these in-memory, short-lived
  // recorders.  The first map gates an annotation by the original Core
  // command request id; after binding, the second map provides strict
  // traceId+sourceId isolation for overlapping source checks.
  private sourceDebugRecordersByCommandRequestId: Map<number, SourceDebugTranscriptRecorder> =
    new Map<number, SourceDebugTranscriptRecorder>();
  private sourceDebugRecordersByTraceAndSource: Map<string, SourceDebugTranscriptRecorder> =
    new Map<string, SourceDebugTranscriptRecorder>();

  /** True only after EntryAbility has created the native runtime. */
  static isInitialized(): boolean {
    return CoreRuntime.instance !== null;
  }

  private constructor(config: CoreRuntimeConfig, nativeModuleOverride?: NativeReaderCoreModule) {
    // 1. Build JsonObject config for ReaderCoreRuntime (only JSON-serializable values).
    // Field names MUST match `protocol/reader-runtime-config.schema.json`:
    // `dataDirectory` / `cacheDirectory`. Schema sets additionalProperties:false,
    // so wrong names cause RC_CREATE_INVALID_CONFIG.
    const runtimeConfig: JsonObject = {};
    if (config.dataDir !== undefined) {
      runtimeConfig['dataDirectory'] = config.dataDir;
    }
    if (config.cacheDir !== undefined) {
      runtimeConfig['cacheDirectory'] = config.cacheDir;
    }

    // 2. Create ReaderCoreRuntime. Tests may inject a stub native module via
    // nativeModuleOverride to exercise adapter wiring without the NAPI .so.
    const effectiveNative = nativeModuleOverride ?? nativeModule;
    this.runtime = new ReaderCoreRuntime(effectiveNative, runtimeConfig);

    // 3. Create Host scheduling layer.
    this.registry = new HostCapabilityRegistry();
    this.dispatcher = new HostDispatcher({
      runtime: this.runtime,
      registry: this.registry,
    });

    // 4. Create Host adapters. Phase 3 (Core closed-set):
    this.sourceSessionStore = SourceSessionHostStore.shared();
    this.httpAdapter = new HttpHostAdapter(this.sourceSessionStore);
    this.sourceImageCache = config.cacheDir !== undefined
      ? new SourceImageCache(config.cacheDir, this.httpAdapter)
      : null;
    // CoreHostAdapter takes optional context — when present (on device),
    // persistence.* is backed by @ohos.data.preferences (survives restarts).
    // When absent (unit-test env), it falls back to an in-process Map so the
    // capability stays registered and callable for HostSmoke assertions.
    this.coreAdapter = new CoreHostAdapter(config.context);
    this.cookieAdapter = new CookieHostAdapter(this.sourceSessionStore);
    this.webViewAdapter = new WebViewHostAdapter();
    this.fileAdapter = config.context !== undefined
      ? new FileHostAdapter(config.context)
      : null;

    // Phase 4 (UI-Contract-only). Some require a UIAbilityContext; those are
    // created only when context is available and exposed as nullable getters.
    this.clipboardAdapter = new ClipboardHostAdapter();
    // TtsHostAdapter takes an optional BaseContext — TextReader needs it for
    // init(); if absent, it falls back to TextToSpeechEngine (start/stop only).
    this.ttsAdapter = config.context !== undefined
      ? new TtsHostAdapter(config.context)
      : new TtsHostAdapter();
    this.backgroundAdapter = new BackgroundHostAdapter();
    this.foregroundTimerAdapter = new ForegroundTimerHostAdapter();
    this.deviceAdapter = new DeviceHostAdapter();
    this.networkAdapter = new NetworkHostAdapter();
    if (config.context !== undefined) {
      // The context from EntryAbility is a UIAbilityContext at runtime; cast
      // is safe because EntryAbility passes `this.context` which is
      // UIAbilityContext-derived. Screen / Notification / Share / Permission /
      // Credential all need UIAbilityContext.
      const uiCtx = config.context as Object as common.UIAbilityContext;
      this.screenAdapter = new ScreenHostAdapter(uiCtx);
      this.notificationAdapter = new NotificationHostAdapter(uiCtx);
      this.credentialAdapter = new CredentialHostAdapter(uiCtx);
      this.shareAdapter = new ShareHostAdapter(uiCtx);
      this.permissionAdapter = new PermissionHostAdapter(uiCtx);
      this.fileSelectionAdapter = new FileSelectionHostAdapter(uiCtx);
      this.fontAdapter = new FontHostAdapter(uiCtx);
      this.readerUiPreferenceAdapter = new ReaderUiPreferenceHostAdapter(uiCtx);
    } else {
      this.screenAdapter = null;
      this.notificationAdapter = null;
      this.credentialAdapter = null;
      this.shareAdapter = null;
      this.permissionAdapter = null;
      this.fileSelectionAdapter = null;
      this.fontAdapter = null;
      this.readerUiPreferenceAdapter = null;
    }

    this.webDavAdapter = this.credentialAdapter !== null
      ? new WebDavHostAdapter(
        this.httpAdapter,
        this.credentialAdapter,
        (): Promise<JsonObject> => this.exportCoreStorage(),
        (manifest: JsonObject, payload: string): Promise<JsonObject> =>
          this.applyCoreStorage(manifest, payload),
      )
      : null;

    this.readerUiHostPlatform = new HarmonyReaderUiHostPlatform({
      httpAdapter: this.httpAdapter,
      cookieAdapter: this.cookieAdapter,
      webViewAdapter: this.webViewAdapter,
      fileAdapter: this.fileAdapter,
      clipboardAdapter: this.clipboardAdapter,
      ttsAdapter: this.ttsAdapter,
      screenAdapter: this.screenAdapter,
      deviceAdapter: this.deviceAdapter,
      notificationAdapter: this.notificationAdapter,
      backgroundAdapter: this.backgroundAdapter,
      foregroundTimerAdapter: this.foregroundTimerAdapter,
      shareAdapter: this.shareAdapter,
      permissionAdapter: this.permissionAdapter,
      credentialAdapter: this.credentialAdapter,
      fileSelectionAdapter: this.fileSelectionAdapter,
      fontAdapter: this.fontAdapter,
      persistenceAdapter: this.coreAdapter,
      networkAdapter: this.networkAdapter,
      webDavAdapter: this.webDavAdapter,
    });
    this.readerUiHostDispatcher = new ReaderUiHostDispatcher(this.readerUiHostPlatform);
    this.readerUiHostManifest = new ReaderUiHostCapabilityManifest(
      (type): boolean => this.readerUiHostPlatform.isAvailable(type),
    );

    // 5. Register Phase 3 adapter handlers against the registry.
    this.registerHandlers();

    // ReaderCoreRuntime.request() owns result/error delivery.  Routing host
    // requests inline through the same request loop avoids a second polling
    // consumer stealing result events from the native queue (which otherwise
    // surfaced on-device as "Reader-Core request timed out").
    this.runtime.setCapabilityRouter({
      has: (capability: string): boolean => this.registry.has(capability as HostCapability),
      route: (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => this.registry.dispatch(event),
    });

    // 6. Build the capability manifest. The resolver answers "is this
    // capability reachable right now?" by checking the registry (for
    // registry-routed caps) or the corresponding adapter getter (for
    // reducer-direct caps). This is the single queryable source of truth
    // for Reducer feature gating and for the [HostManifest] hilog broadcast.
    this.manifest = new HostCapabilityManifest(this.buildAvailabilityResolver());
  }

  private buildAvailabilityResolver(): HostCapabilityAvailabilityResolver {
    // Captures `this` — must be called after adapters are constructed.
    return (capability: HostCapability): boolean => {
      switch (capability) {
        // Registry-routed (Phase 3 closed set): available iff registered.
        case 'host.smoke.echo':
        case 'http.execute':
        case 'cookie.get':
        case 'cookie.set':
        case 'webview.evaluateJavaScript':
        case 'file.read':
        case 'file.write':
        case 'cache.get':
        case 'cache.put':
        case 'log.emit':
        case 'time.now':
        case 'system.info':
        case 'persistence.get':
        case 'persistence.put':
        case 'media.download':
          return this.registry.has(capability);
        // Reducer-direct — always-constructed adapters.
        case 'http.cancel':
        case 'cookie.clear':
        case 'webview.open':
        case 'webview.close':
        case 'webview.evaluate':
        case 'clipboard.copy':
        case 'clipboard.paste':
        case 'tts.system.start':
        case 'tts.system.stop':
        case 'tts.system.pause':
        case 'tts.system.resume':
        case 'background.schedule':
        case 'background.cancel':
        case 'timer.foreground.arm':
        case 'timer.foreground.cancel':
          return true;
        // Reducer-direct — nullable adapters (need UIAbilityContext).
        case 'file.delete':
        case 'storage.path':
          return this.fileAdapter !== null;
        case 'credential.get':
        case 'credential.set':
        case 'credential.delete':
          return this.credentialAdapter !== null;
        case 'permission.request':
        case 'permission.check':
          return this.permissionAdapter !== null;
        case 'notification.show':
        case 'notification.cancel':
          return this.notificationAdapter !== null;
        case 'share.invoke':
          return this.shareAdapter !== null;
        case 'device.screen.keep-on':
        case 'device.screen.release':
          return this.screenAdapter !== null;
        case 'device.vibrate':
          return this.deviceAdapter !== null;
        default:
          return false;
      }
    };
  }

  private registerHandlers(): void {
    // host.smoke.echo
    this.registry.register('host.smoke.echo', (event: ReaderCoreHostRequestEvent): JsonObject => {
      return (event.params ?? {}) as Object as JsonObject;
    });

    // http.execute
    this.registry.register('http.execute', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      const request = event.params as Object as HostHttpRequest;
      // `source.check.run` alone annotates descriptors with strict recorder
      // metadata. Ordinary HTTP work keeps exactly the same path and is never
      // retained.  Recording lives beside the Host completion so it observes
      // the actual adapter response, while ReaderCoreRuntime.waitForResult()
      // remains the sole native-event consumer.
      const recorder = this.claimSourceDebugRecorder(event);
      try {
        // Use the Core request id as the stable Host HTTP request id so a later
        // cancellation can target this execution without touching other clients.
        const resp = await this.httpAdapter.execute(request, String(event.requestId));
        if (recorder !== null) {
          const annotation = this.sourceDebugAnnotation(event);
          if (annotation !== null) recorder.recordResponse(annotation, request, resp);
        }
        return resp as Object as JsonObject;
      } catch (error) {
        if (recorder !== null) {
          const annotation = this.sourceDebugAnnotation(event);
          if (annotation !== null) recorder.recordFailure(annotation, request, sourceDebugErrorMessage(error));
        }
        throw new Error(sourceDebugErrorMessage(error));
      }
    });

    // cookie.get
    this.registry.register('cookie.get', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      const request = event.params as Object as HostCookieGetRequest;
      const resp = await this.cookieAdapter.get(request);
      return resp as Object as JsonObject;
    });

    // cookie.set
    this.registry.register('cookie.set', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      const request = event.params as Object as HostCookieSetRequest;
      const resp = await this.cookieAdapter.set(request);
      return resp as Object as JsonObject;
    });

    // webview.evaluateJavaScript
    this.registry.register('webview.evaluateJavaScript', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      const request = event.params as Object as HostWebViewEvaluateJavaScriptRequest;
      const resp = await this.webViewAdapter.evaluateJavaScript(request);
      return resp as Object as JsonObject;
    });

    // file.read / file.write — only when a context is available.
    // NOTE: `file.delete` is intentionally NOT registered here. It is a
    // UI-Contract-only HostRequest (host-request.schema.json) and is NOT in
    // the Core HostCapability closed set (host.rs). Core will never request
    // `file.delete` over the NAPI boundary; Reducer dispatches it directly to
    // the FileHostAdapter without crossing Core. Registering it here would
    // imply Core might request it, which is a contract lie.
    if (this.fileAdapter !== null) {
      const fileAdapter = this.fileAdapter;
      this.registry.register('file.read', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
        const request = event.params as Object as HostFileReadRequest;
        const resp = await fileAdapter.read(request);
        return resp as Object as JsonObject;
      });
      this.registry.register('file.write', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
        const request = event.params as Object as HostFileWriteRequest;
        const resp = await fileAdapter.write(request);
        return resp as Object as JsonObject;
      });
    }

    // cache.get / cache.put
    this.registry.register('cache.get', (event: ReaderCoreHostRequestEvent): JsonObject => {
      const request = event.params as Object as HostCacheGetRequest;
      const resp = this.coreAdapter.cacheGet(request);
      return resp as Object as JsonObject;
    });
    this.registry.register('cache.put', (event: ReaderCoreHostRequestEvent): JsonObject => {
      const request = event.params as Object as HostCachePutRequest;
      const resp = this.coreAdapter.cachePut(request);
      return resp as Object as JsonObject;
    });

    // log.emit / time.now / system.info
    this.registry.register('log.emit', (event: ReaderCoreHostRequestEvent): JsonObject => {
      const request = event.params as Object as HostLogEmitRequest;
      const resp = this.coreAdapter.logEmit(request);
      return resp as Object as JsonObject;
    });
    this.registry.register('time.now', (event: ReaderCoreHostRequestEvent): JsonObject => {
      const request = event.params as Object as HostTimeNowRequest;
      const resp = this.coreAdapter.timeNow(request);
      return resp as Object as JsonObject;
    });
    this.registry.register('system.info', (event: ReaderCoreHostRequestEvent): JsonObject => {
      const request = event.params as Object as HostSystemInfoRequest;
      const resp = this.coreAdapter.systemInfo(request);
      return resp as Object as JsonObject;
    });

    // persistence.get / persistence.put — async because the on-device backend
    // (@ohos.data.preferences) is async. Falls back to sync Map when no context.
    this.registry.register('persistence.get', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      const request = event.params as Object as HostPersistenceGetRequest;
      const resp = await this.coreAdapter.persistenceGet(request);
      return resp as Object as JsonObject;
    });
    this.registry.register('persistence.put', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      const request = event.params as Object as HostPersistencePutRequest;
      const resp = await this.coreAdapter.persistencePut(request);
      return resp as Object as JsonObject;
    });

    // media.download — registered in the Core closed set. It requires the
    // FileHostAdapter at runtime and will fail closed when no context exists.
    this.registry.register('media.download', async (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      const request = event.params as Object as HostMediaDownloadRequest;
      const resp = await this.coreAdapter.mediaDownload(request, this.httpAdapter, this.fileAdapter);
      return resp as Object as JsonObject;
    });
  }

  /** Parse only the strict Core recorder annotation.  Unknown/malformed
   * metadata is ignored rather than changing ordinary HTTP behavior. */
  private sourceDebugAnnotation(event: ReaderCoreHostRequestEvent): SourceDebugDiagnosticAnnotation | null {
    // JsonObject deliberately uses `unknown` at the generated JS boundary.
    // Narrow through ArkTS' supported Object record before inspecting it so
    // the consuming HAP never leaks `unknown` into strict ArkTS source.
    const parameterFields = event.params as Object as Record<string, Object>;
    const rawDiagnostic = parameterFields['diagnostic'];
    if (rawDiagnostic === null || rawDiagnostic === undefined || typeof rawDiagnostic !== 'object' ||
      Array.isArray(rawDiagnostic)) {
      return null;
    }
    const fields = rawDiagnostic as Object as Record<string, Object>;
    const traceValue = fields['traceId'];
    const requestIdValue = fields['requestId'];
    const sourceIdValue = fields['sourceId'];
    const stageValue = fields['stage'];
    const traceId = typeof traceValue === 'string' ? traceValue.trim() : '';
    const requestId = typeof requestIdValue === 'number' ? requestIdValue : -1;
    const sourceId = typeof sourceIdValue === 'string' ? sourceIdValue.trim() : '';
    const stage = typeof stageValue === 'string' ? stageValue : '';
    if (traceId.length === 0 || sourceId.length === 0 || !Number.isSafeInteger(requestId) ||
      requestId !== event.requestId) {
      return null;
    }
    if (stage !== 'L2' && stage !== 'L3' && stage !== 'L4' && stage !== 'L5') return null;
    const annotation: SourceDebugDiagnosticAnnotation = {
      traceId,
      requestId,
      sourceId,
      stage: stage as SourceDebugDiagnosticStage,
    };
    return annotation;
  }

  /**
   * Return the recorder that owns this exact command + trace + source tuple.
   * This deliberately rejects a descriptor from a concurrent source check
   * even when the two requests happen to arrive interleaved.
   */
  private claimSourceDebugRecorder(
    event: ReaderCoreHostRequestEvent,
  ): SourceDebugTranscriptRecorder | null {
    this.pruneSourceDebugRecorders();
    const annotation = this.sourceDebugAnnotation(event);
    if (annotation === null) return null;
    const recorder = this.sourceDebugRecordersByCommandRequestId.get(annotation.requestId);
    if (recorder === undefined || !recorder.accepts(annotation)) return null;
    const traceKey = sourceDebugTraceKey(annotation.traceId, annotation.sourceId);
    const traceRecorder = this.sourceDebugRecordersByTraceAndSource.get(traceKey);
    if (traceRecorder !== undefined && traceRecorder !== recorder) return null;
    if (!recorder.bind(annotation)) return null;
    this.sourceDebugRecordersByTraceAndSource.set(traceKey, recorder);
    return recorder;
  }

  private pruneSourceDebugRecorders(): void {
    const expired: SourceDebugTranscriptRecorder[] = [];
    this.sourceDebugRecordersByCommandRequestId.forEach((recorder: SourceDebugTranscriptRecorder): void => {
      if (recorder.isExpired()) expired.push(recorder);
    });
    for (let i = 0; i < expired.length; i++) {
      this.releaseSourceDebugRecorder(expired[i]);
    }
  }

  private releaseSourceDebugRecorder(recorder: SourceDebugTranscriptRecorder): void {
    const commandRecorder = this.sourceDebugRecordersByCommandRequestId.get(recorder.commandRequestId);
    if (commandRecorder === recorder) {
      this.sourceDebugRecordersByCommandRequestId.delete(recorder.commandRequestId);
    }
    const traceId = recorder.trace();
    if (traceId.length > 0) {
      const traceKey = sourceDebugTraceKey(traceId, recorder.sourceId);
      const traceRecorder = this.sourceDebugRecordersByTraceAndSource.get(traceKey);
      if (traceRecorder === recorder) this.sourceDebugRecordersByTraceAndSource.delete(traceKey);
    }
    recorder.dispose();
  }

  private releaseAllSourceDebugRecorders(): void {
    const recorders: SourceDebugTranscriptRecorder[] = [];
    this.sourceDebugRecordersByCommandRequestId.forEach((recorder: SourceDebugTranscriptRecorder): void => {
      recorders.push(recorder);
    });
    for (let i = 0; i < recorders.length; i++) {
      this.releaseSourceDebugRecorder(recorders[i]);
    }
  }

  static init(config: CoreRuntimeConfig = {}): CoreRuntime {
    console.info(`[CoreRuntime] diagnose start: ${diagnoseNativeModule()}`);
    if (CoreRuntime.instance !== null) {
      throw new Error('CoreRuntime already initialized');
    }
    CoreRuntime.instance = new CoreRuntime(config);
    console.info('[CoreRuntime] init success');
    // Broadcast the capability manifest to hilog so hdc can harvest it as
    // device-executed evidence of which capabilities are wired up. This is a
    // read-only declaration; it does not execute any capability.
    CoreRuntime.instance.broadcastManifest();
    return CoreRuntime.instance;
  }

  /**
   * Test-only factory: construct a CoreRuntime backed by an injected native
   * module stub, WITHOUT setting the singleton. Lets HostSmoke.test exercise
   * registerHandlers() wiring in the unit-test environment where
   * libreader_core_napi.so is absent. Production code MUST NOT call this.
   */
  static createForTest(nativeModuleStub: NativeReaderCoreModule, config: CoreRuntimeConfig = {}): CoreRuntime {
    return new CoreRuntime(config, nativeModuleStub);
  }

  static get(): CoreRuntime {
    if (CoreRuntime.instance === null) {
      throw new Error('CoreRuntime not initialized; call CoreRuntime.init() first');
    }
    return CoreRuntime.instance;
  }

  static close(): void {
    if (CoreRuntime.instance === null) {
      return;
    }
    CoreRuntime.instance.stopDispatcher();
    CoreRuntime.instance.releaseAllSourceDebugRecorders();
    CoreRuntime.instance.httpAdapter.destroy();
    CoreRuntime.instance.backgroundAdapter.cancelAll();
    CoreRuntime.instance.foregroundTimerAdapter.cancelAll();
    // TtsHostAdapter.shutdown is async (releases TextReader / fallback engine),
    // but CoreRuntime.close is sync (called from onDestroy). We fire-and-forget
    // the shutdown — the adapter's resources are best-effort released.
    CoreRuntime.instance.ttsAdapter.shutdown().then((): void => {});
    CoreRuntime.instance.runtime.close();
    CoreRuntime.instance = null;
  }

  getReaderCoreRuntime(): ReaderCoreRuntime {
    return this.runtime;
  }

  /**
   * Start a Core command without hiding its numeric requestId.  Dedicated
   * bridge wrappers use this single seam so DTO construction is not duplicated
   * in the future book.open effect executor.
   */
  private beginCoreCommand(method: string, params: JsonObject, timeoutMs: number): CoreCommandHandle {
    const requestId = this.runtime.send(method, params);
    const result = this.runtime.waitForResult(requestId, { timeoutMs: timeoutMs })
      .then((event: ReaderCoreResultEvent): JsonObject => event.data);
    return new CoreCommandHandle(this.runtime, requestId, result);
  }

  getRegistry(): HostCapabilityRegistry {
    return this.registry;
  }

  getCapabilityManifest(): HostCapabilityManifest {
    return this.manifest;
  }

  getReaderUiHostCapabilityManifest(): ReaderUiHostCapabilityManifest {
    return this.readerUiHostManifest;
  }

  getReaderUiHostDispatcher(): ReaderUiHostDispatcher {
    return this.readerUiHostDispatcher;
  }

  dispatchReaderUiHostRequest(request: ReaderUiHostRequest): Promise<ReaderUiHostResponse> {
    return this.readerUiHostDispatcher.dispatch(request);
  }

  /**
   * Broadcast the capability manifest to hilog. Emits one summary line plus
   * one detail line per capability, all under the [HostManifest] tag so
   * `hdc shell hilog | grep HostManifest` harvests the full picture.
   *
   * This is declaration-only evidence: it proves the manifest was built and
   * which adapters are reachable at init time. It does NOT prove any
   * capability actually works — that requires per-capability device evidence
   * (Phase 7 of the host integration roadmap).
   */
  private broadcastManifest(): void {
    console.info(`[HostManifest] summary ${this.manifest.toSummaryLine()}`);
    const detailLines = this.manifest.toDetailLines();
    for (const line of detailLines) {
      console.info(`[HostManifest] ${line}`);
    }
    console.info(`[ReaderUiHostManifest] summary ${this.readerUiHostManifest.toSummaryLine()}`);
    const readerUiDetailLines = this.readerUiHostManifest.toDetailLines();
    for (const line of readerUiDetailLines) {
      console.info(`[ReaderUiHostManifest] ${line}`);
    }
  }

  getHttpAdapter(): HttpHostAdapter {
    return this.httpAdapter;
  }

  /** Returns the app-private protected cover cache on device, or null in the
   * context-free host unit environment. UI must leave its placeholder visible
   * when this is null; it must never fall back to a raw remote cover URL. */
  getSourceImageCache(): SourceImageCache | null {
    return this.sourceImageCache;
  }

  getCoreAdapter(): CoreHostAdapter {
    return this.coreAdapter;
  }

  getSourceSessionStore(): SourceSessionHostStore {
    return this.sourceSessionStore;
  }

  getCookieAdapter(): CookieHostAdapter {
    return this.cookieAdapter;
  }

  getWebViewAdapter(): WebViewHostAdapter {
    return this.webViewAdapter;
  }

  getFileAdapter(): FileHostAdapter | null {
    return this.fileAdapter;
  }

  // ── Phase 4: UI-Contract-only adapter getters (Reducer direct dispatch) ──
  // These are NOT registered with HostCapabilityRegistry because Core will
  // never request them over NAPI. Reducer accesses them via CoreRuntime.get()
  // and calls the adapter methods directly.

  getClipboardAdapter(): ClipboardHostAdapter {
    return this.clipboardAdapter;
  }

  getTtsAdapter(): TtsHostAdapter {
    return this.ttsAdapter;
  }

  getScreenAdapter(): ScreenHostAdapter | null {
    return this.screenAdapter;
  }

  getDeviceAdapter(): DeviceHostAdapter {
    return this.deviceAdapter;
  }

  getNotificationAdapter(): NotificationHostAdapter | null {
    return this.notificationAdapter;
  }

  getBackgroundAdapter(): BackgroundHostAdapter {
    return this.backgroundAdapter;
  }

  getForegroundTimerAdapter(): ForegroundTimerHostAdapter {
    return this.foregroundTimerAdapter;
  }

  getShareAdapter(): ShareHostAdapter | null {
    return this.shareAdapter;
  }

  getPermissionAdapter(): PermissionHostAdapter | null {
    return this.permissionAdapter;
  }

  getCredentialAdapter(): CredentialHostAdapter | null {
    return this.credentialAdapter;
  }

  getReaderUiPreferenceAdapter(): ReaderUiPreferenceHostAdapter | null {
    return this.readerUiPreferenceAdapter;
  }

  getFileSelectionAdapter(): FileSelectionHostAdapter | null {
    return this.fileSelectionAdapter;
  }

  getFontAdapter(): FontHostAdapter | null {
    return this.fontAdapter;
  }

  getNetworkAdapter(): NetworkHostAdapter {
    return this.networkAdapter;
  }

  getWebDavAdapter(): WebDavHostAdapter | null {
    return this.webDavAdapter;
  }

  startDispatcher(): void {
    // Host requests are routed by ReaderCoreRuntime.waitForResult(), which is
    // the only consumer allowed to drain its result/error queue.  Retain this
    // method as an API-compatible no-op for existing EntryAbility callers.
  }

  stopDispatcher(): void {
    // See startDispatcher(): no independent queue poller is started.
  }

  /**
   * Hydrate the complete Core-owned storage snapshot before any reducer effect
   * reads bookshelf/source/RSS state. Host persistence routing is already
   * installed in the constructor, so this request owns the only native event
   * consumer and can complete its `persistence.get` inline.
   */
  async restoreCoreStorage(): Promise<JsonObject> {
    // Make the Core-side fail-closed manifest truthful before it emits the
    // restore host.request. `registeredWithRegistry` contains only Core's
    // closed-set HostCapability values, never UI-only reducer adapters.
    await this.runtime.request('runtime.setHostCapabilities', {
      capabilities: this.manifest.registeredWithRegistry(),
      platform: 'harmonyos',
    }, { timeoutMs: 5000 });
    const result = await this.runtime.request('runtime.storage.restore', {}, { timeoutMs: 30000 });
    return result.data;
  }

  /** Flush the Core-owned snapshot at a lifecycle boundary. Normal Core
   * mutators also write-through after restore; this is an explicit final
   * durability checkpoint for backgrounding. */
  async flushCoreStorage(): Promise<JsonObject> {
    const result = await this.runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
    return result.data;
  }

  /**
   * Produce Core's portable storage snapshot and its integrity manifest.
   * The result is transport-neutral: callers may write it to the app sandbox,
   * a user-selected document, or WebDAV, but must preserve manifest + payload
   * exactly for `applyCoreStorage` to verify.
   */
  async exportCoreStorage(): Promise<JsonObject> {
    const result = await this.runtime.request('runtime.storage.export', {}, { timeoutMs: 30000 });
    return result.data;
  }

  /**
   * Atomically validate, migrate and apply a portable Core snapshot. Core
   * rejects checksum/schema mismatches and rolls its in-memory replacement
   * back when the Host persistence CAS cannot be completed.
   */
  async applyCoreStorage(manifest: JsonObject, payload: string): Promise<JsonObject> {
    const params: JsonObject = {};
    params['manifest'] = manifest;
    params['payload'] = payload;
    const result = await this.runtime.request('runtime.storage.apply', params, { timeoutMs: 30000 });
    return result.data;
  }

  async ping(): Promise<boolean> {
    try {
      await this.runtime.ping();
      return true;
    } catch (e) {
      return false;
    }
  }

  async coreInfo(): Promise<JsonObject> {
    const result = await this.runtime.coreInfo();
    return result.data;
  }

  // ── RemoteContentPipeline: book.search / book.detail / book.toc / ───────
  //    chapter.content. Host prefetches HTML via HttpHostAdapter, then passes
  //    the response + inline Legado source to Core for parsing. Core uses the
  //    source rules (ruleSearch / ruleBookInfo / ruleToc / ruleContent) to
  //    extract structured data. No http.execute round-trip — Path A.

  /**
   * book.search — parse search results from prefetched HTML using Legado rules.
   * Returns { sourceId, books: [{ bookId, title, author?, ... }] }.
   */
  async bookSearch(html: string, source: JsonObject, keyword: string, page: number = 1): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = '';
    params['searchResponse'] = html;
    params['source'] = source;
    params['keyword'] = keyword;
    params['page'] = page;
    const result = await this.runtime.request('book.search', params, { timeoutMs: 15000 });
    return result.data;
  }

  /**
   * book.search using one source persisted in Core.  Core resolves the raw
   * Legado BookSource and emits its own http.execute request; HarmonyOS only
   * supplies the registered Host HTTP capability.  This is the normal app
   * path — callers must never substitute an inline/demo source on failure.
   */
  async bookSearchFromSource(sourceId: string, keyword: string, page: number = 1): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['keyword'] = keyword;
    params['page'] = page;
    const result = await this.runtime.request('book.search', params, { timeoutMs: 30000 });
    return result.data;
  }

  /**
   * book.detail — parse book detail metadata from prefetched HTML.
   * `book` is the base book object (must contain at least bookId).
   * Returns { sourceId, book: { bookId, title, author, ... }, tocUrl?, variables? }.
   */
  async bookDetail(html: string, source: JsonObject, book: JsonObject): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = '';
    params['book'] = book;
    params['detailResponse'] = html;
    params['source'] = source;
    const result = await this.runtime.request('book.detail', params, { timeoutMs: 15000 });
    return result.data;
  }

  /** book.detail using a source already stored in Core. Core builds the
   * request and resumes through the registered http.execute Host callback. */
  beginBookDetailFromSource(sourceId: string, bookUrl: string, book: JsonObject): CoreCommandHandle {
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['bookUrl'] = bookUrl;
    params['book'] = book;
    return this.beginCoreCommand('book.detail', params, 30000);
  }

  async bookDetailFromSource(sourceId: string, bookUrl: string, book: JsonObject): Promise<JsonObject> {
    return this.beginBookDetailFromSource(sourceId, bookUrl, book).result;
  }

  /**
   * book.toc — parse table of contents from prefetched HTML.
   * Returns { sourceId, bookId, toc: [{ index, title, url, variables? }] }.
   */
  async bookToc(html: string, source: JsonObject, bookId: string, variables?: JsonObject): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = '';
    params['bookId'] = bookId;
    params['tocResponse'] = html;
    params['source'] = source;
    if (variables !== undefined) {
      params['variables'] = variables;
    }
    const result = await this.runtime.request('book.toc', params, { timeoutMs: 15000 });
    return result.data;
  }

  beginBookTocFromSource(sourceId: string, bookId: string, tocUrl: string,
    variables?: JsonObject): CoreCommandHandle {
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['bookId'] = bookId;
    params['tocUrl'] = tocUrl;
    if (variables !== undefined) {
      params['variables'] = variables;
    }
    return this.beginCoreCommand('book.toc', params, 30000);
  }

  async bookTocFromSource(sourceId: string, bookId: string, tocUrl: string,
    variables?: JsonObject): Promise<JsonObject> {
    return this.beginBookTocFromSource(sourceId, bookId, tocUrl, variables).result;
  }

  /**
   * chapter.content — parse chapter body content from prefetched HTML.
   * Returns { sourceId, bookId, chapterTitle, content (string), via }.
   */
  async chapterContent(html: string, source: JsonObject, bookId: string, chapterUrl: string, variables?: JsonObject): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = '';
    params['bookId'] = bookId;
    params['chapterResponse'] = html;
    params['source'] = source;
    params['chapterUrl'] = chapterUrl;
    if (variables !== undefined) {
      params['variables'] = variables;
    }
    const result = await this.runtime.request('chapter.content', params, { timeoutMs: 15000 });
    return result.data;
  }

  beginChapterContentFromSource(sourceId: string, bookId: string, chapterUrl: string,
    chapterTitle: string = '', chapterIndex?: number, variables?: JsonObject): CoreCommandHandle {
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['bookId'] = bookId;
    params['chapterUrl'] = chapterUrl;
    params['chapterTitle'] = chapterTitle;
    if (chapterIndex !== undefined) {
      params['chapterIndex'] = chapterIndex;
    }
    if (variables !== undefined) {
      params['variables'] = variables;
    }
    return this.beginCoreCommand('chapter.content', params, 30000);
  }

  async chapterContentFromSource(sourceId: string, bookId: string, chapterUrl: string,
    chapterTitle: string = '', chapterIndex?: number, variables?: JsonObject): Promise<JsonObject> {
    return this.beginChapterContentFromSource(sourceId, bookId, chapterUrl, chapterTitle, chapterIndex,
      variables).result;
  }

  // ── Sync bridge: sync.webdav.plan ──────────────────────────────────────
  //    Core owns WebDAV request semantics and emits HostHttpRequest
  //    descriptors. The HarmonyOS Host owns the actual network execution.

  /**
   * sync.webdav.plan — translate typed WebDAV descriptors to Host requests.
   * It does not open a socket and must never be treated as connection proof.
   */
  async syncWebdavPlan(baseUrl: string, auth: string | undefined,
    requests: JsonObject[]): Promise<JsonObject> {
    const params: JsonObject = {};
    params['baseUrl'] = baseUrl;
    if (auth !== undefined && auth.length > 0) {
      params['auth'] = auth;
    }
    params['requests'] = requests;
    const result = await this.runtime.request('sync.webdav.plan', params, { timeoutMs: 30000 });
    return result.data;
  }

  // ── P0 CoreCommand wrappers (core-bridge-mapping.md §4) ──────────────
  //    reading.progress.update / bookshelf.list / reader.location.resolve
  //    These are pure storage/compute commands — no http.execute round-trip.

  /**
   * reading.progress.update — persist reading progress to Core storage.
   * Pure storage write, no host bus. Returns { stored: true, ... }.
   */
  async readingProgressUpdate(bookId: string, sourceId: string, chapterIndex: number,
    chapterOffset: number, chapterProgress: number, locationRevision?: string): Promise<JsonObject> {
    const params: JsonObject = {};
    params['bookId'] = bookId;
    params['sourceId'] = sourceId;
    params['chapterIndex'] = chapterIndex;
    params['chapterOffset'] = chapterOffset;
    params['chapterProgress'] = chapterProgress;
    if (locationRevision !== undefined) {
      params['locationRevision'] = locationRevision;
    }
    const result = await this.runtime.request('reading.progress.update', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * Read the one durable progress row for this exact shelf identity. Core
   * returns `{ found: false, progress: null }` for a book that has never been
   * read; callers must not infer a position from history or another source.
   */
  async readingProgressGet(bookId: string, sourceId?: string): Promise<JsonObject> {
    if (bookId.trim().length === 0) {
      throw new Error('reading.progress.get requires a non-empty bookId');
    }
    if (sourceId !== undefined && sourceId.trim().length === 0) {
      throw new Error('reading.progress.get sourceId must be omitted or non-empty');
    }
    const params: JsonObject = {};
    params['bookId'] = bookId;
    if (sourceId !== undefined) {
      params['sourceId'] = sourceId;
    }
    const result = await this.runtime.request('reading.progress.get', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * bookshelf.list — query bookshelf from Core storage.
   * Pure storage read, no host bus. Returns { books: [...], total }.
   */
  async bookshelfList(sortBy: string = 'manual', sortDirection: string = 'ascending',
    offset: number = 0, limit?: number): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sortBy'] = sortBy;
    params['sortDirection'] = sortDirection;
    params['offset'] = offset;
    if (limit !== undefined) {
      params['limit'] = limit;
    }
    const result = await this.runtime.request('bookshelf.list', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * reader.location.resolve — compute canonical location from chapter anchor + layout.
   * Pure function, no storage write, no host bus.
   * Returns { canonicalLocation: { ... }, resolverVersion, resolved: true, reflow: { ... } }.
   */
  beginReaderLocationResolve(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, viewportWidth: number, viewportHeight: number,
    fontScale: number, sourceId: string = '', chapterTitle: string = ''): CoreCommandHandle {
    // ArkUI's display API reports physical pixels divided by density.  That is
    // intentionally a floating-point value on some devices (for example,
    // 1280 / 3.5 = 365.714…), while Core's location contract requires an
    // integer logical viewport.  Normalize at this bridge boundary so every
    // reader owner sends the same valid DTO instead of relying on each caller
    // to remember device-density semantics.
    const coreViewportWidth = CoreRuntime.normalizeCoreViewportDimension(viewportWidth, 'viewportWidth');
    const coreViewportHeight = CoreRuntime.normalizeCoreViewportDimension(viewportHeight, 'viewportHeight');
    const params: JsonObject = {};
    if (sourceId.length > 0) params['sourceId'] = sourceId;
    params['bookId'] = bookId;
    params['chapterIndex'] = chapterIndex;
    if (chapterTitle.length > 0) params['chapterTitle'] = chapterTitle;
    const anchor: JsonObject = {};
    anchor['chapterOffset'] = chapterOffset;
    anchor['chapterProgress'] = chapterProgress;
    params['anchor'] = anchor;
    const layout: JsonObject = {};
    layout['viewportWidth'] = coreViewportWidth;
    layout['viewportHeight'] = coreViewportHeight;
    layout['fontScale'] = fontScale;
    params['layout'] = layout;
    return this.beginCoreCommand('reader.location.resolve', params, 5000);
  }

  async readerLocationResolve(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, viewportWidth: number, viewportHeight: number,
    fontScale: number, sourceId: string = '', chapterTitle: string = ''): Promise<JsonObject> {
    return this.beginReaderLocationResolve(bookId, chapterIndex, chapterOffset, chapterProgress,
      viewportWidth, viewportHeight, fontScale, sourceId, chapterTitle).result;
  }

  // ── R8 request-scoped TTS queue bridge ─────────────────────────────────
  // ReaderUIRuntime names these semantic steps `tts.queue.plan/start`; Core's
  // V1 protocol names them `tts.slice/tts.queue.play`.  Keep that translation
  // here so the Pilot executor never copies a second command-name table.

  beginTtsSlice(chapter: JsonObject, content: string,
    strategy: string = 'paragraph-then-sentence'): CoreCommandHandle {
    const params: JsonObject = {};
    params['chapter'] = chapter;
    params['content'] = content;
    params['strategy'] = strategy;
    return this.beginCoreCommand('tts.slice', params, 5000);
  }

  beginTtsPlay(plan: JsonObject, startSliceIndex: number = 0): CoreCommandHandle {
    const params: JsonObject = {};
    params['plan'] = plan;
    params['startSliceIndex'] = startSliceIndex;
    return this.beginCoreCommand('tts.queue.play', params, 5000);
  }

  beginTtsStop(chapter: JsonObject): CoreCommandHandle {
    const params: JsonObject = {};
    params['chapter'] = chapter;
    return this.beginCoreCommand('tts.queue.stop', params, 5000);
  }

  beginTtsNext(chapter: JsonObject): CoreCommandHandle {
    const params: JsonObject = {};
    params['chapter'] = chapter;
    return this.beginCoreCommand('tts.queue.next', params, 5000);
  }

  beginTtsReportStatus(chapter: JsonObject, sliceIndex: number,
    status: string): CoreCommandHandle {
    const params: JsonObject = {};
    params['chapter'] = chapter;
    params['sliceIndex'] = sliceIndex;
    params['status'] = status;
    return this.beginCoreCommand('tts.queue.report-status', params, 5000);
  }

  // ── local_book.parse (core-bridge-mapping.md §4.2) ────────────────────
  //    Parse local book text/bytes into structured book + chapter list.
  //    Pure parsing, no host bus. Uses local SQLite txt-toc-rules.

  /**
   * local_book.parse — parse a local book file into structured metadata + catalog.
   * Prefer `bytesBase64` for every file format, including TXT, so Core can
   * preserve and detect the original encoding (UTF-8/BOM, UTF-16, GBK/GB18030)
   * and apply enabled TXT chapter rules. `text` is a legacy already-decoded path.
   * At least one input must be non-empty.
   * Returns { book: { bookId, title, author, ... }, format, encoding, byteLen, charLen, chapterCount }.
   */
  async localBookParse(bookId: string, options: LocalBookParseOptions): Promise<JsonObject> {
    const params: JsonObject = {};
    params['bookId'] = bookId;
    if (options.text !== undefined) {
      params['text'] = options.text;
    }
    if (options.bytesBase64 !== undefined) {
      params['bytesBase64'] = options.bytesBase64;
    }
    if (options.title !== undefined) {
      params['title'] = options.title;
    }
    if (options.author !== undefined) {
      params['author'] = options.author;
    }
    if (options.fileName !== undefined) {
      params['fileName'] = options.fileName;
    }
    if (options.format !== undefined) {
      params['format'] = options.format;
    }
    const result = await this.runtime.request('local_book.parse', params, { timeoutMs: 30000 });
    return result.data;
  }

  /**
   * local_book.import — materialize a confirmed local import in Core storage.
   * Its input deliberately matches localBookParse, but it persists the book,
   * TOC and chapter bodies so later reader sessions do not depend on a picker
   * URI or an in-memory byte buffer.
   */
  async localBookImport(bookId: string, options: LocalBookParseOptions): Promise<JsonObject> {
    const params: JsonObject = {};
    params['bookId'] = bookId;
    if (options.text !== undefined) params['text'] = options.text;
    if (options.bytesBase64 !== undefined) params['bytesBase64'] = options.bytesBase64;
    if (options.title !== undefined) params['title'] = options.title;
    if (options.author !== undefined) params['author'] = options.author;
    if (options.fileName !== undefined) params['fileName'] = options.fileName;
    if (options.format !== undefined) params['format'] = options.format;
    const result = await this.runtime.request('local_book.import', params, { timeoutMs: 30000 });
    return result.data;
  }

  /** Read the durable local-book table of contents from Core storage. */
  beginLocalBookToc(bookId: string): CoreCommandHandle {
    const params: JsonObject = {};
    params['bookId'] = bookId;
    return this.beginCoreCommand('local_book.toc', params, 5000);
  }

  async localBookToc(bookId: string): Promise<JsonObject> {
    return this.beginLocalBookToc(bookId).result;
  }

  /** Read one durable local-book chapter by its zero-based Core TOC index. */
  beginLocalBookChapterContent(bookId: string, chapterIndex: number): CoreCommandHandle {
    const params: JsonObject = {};
    params['bookId'] = bookId;
    params['chapterIndex'] = chapterIndex;
    return this.beginCoreCommand('local_book.chapter.content', params, 30000);
  }

  async localBookChapterContent(bookId: string, chapterIndex: number): Promise<JsonObject> {
    return this.beginLocalBookChapterContent(bookId, chapterIndex).result;
  }

  // ── bookshelf.add / change.bookSource / replace-rule.* ───────────────
  //    W1/W3/W5 bridge wrappers for the audit-driven bridge coverage gaps.

  /**
   * bookshelf.add — add a book to the Core bookshelf storage.
   * Pure storage write. Returns the added bookshelf entry.
   */
  async bookshelfAdd(book: JsonObject): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = CoreRuntime.stringField(book, 'sourceId', 'local');
    params['bookId'] = CoreRuntime.stringField(book, 'bookId');
    params['title'] = CoreRuntime.stringField(book, 'title');
    params['author'] = CoreRuntime.stringField(book, 'author');
    CoreRuntime.copyOptionalString(book, params, 'coverUrl');
    CoreRuntime.copyOptionalString(book, params, 'intro');
    CoreRuntime.copyOptionalString(book, params, 'kind');
    CoreRuntime.copyOptionalString(book, params, 'lastChapter');
    CoreRuntime.copyOptionalString(book, params, 'group');
    const numericFields = book as Object as Record<string, number>;
    const sortIndex: number = numericFields['sortIndex'];
    params['sortIndex'] = typeof sortIndex === 'number' ? sortIndex : 0;
    const result = await this.runtime.request('bookshelf.add', params, { timeoutMs: 5000 });
    return result.data;
  }

  async bookshelfRemove(sourceId: string, bookId: string): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['bookId'] = bookId;
    const result = await this.runtime.request('bookshelf.remove', params, { timeoutMs: 5000 });
    return result.data;
  }

  // One Core transaction for the approved Figma Bookshelf/MultiSelect flow.
  // Do not replace this with a client loop around `bookshelf.remove`: Core owns
  // duplicate/missing accounting and atomic rollback semantics.
  async bookshelfRemoveBatch(targets: CoreBookshelfRemoveTarget[]): Promise<JsonObject> {
    if (targets.length === 0) throw new Error('bookshelf.removeBatch requires at least one target.');
    const values: JsonObject[] = [];
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const sourceId = target.sourceId.trim();
      const bookId = target.bookId.trim();
      if (sourceId.length === 0 || bookId.length === 0) {
        throw new Error('bookshelf.removeBatch targets require sourceId and bookId.');
      }
      const value: JsonObject = {};
      value['sourceId'] = sourceId;
      value['bookId'] = bookId;
      values.push(value);
    }
    const params: JsonObject = {};
    params['targets'] = values;
    const result = await this.runtime.request('bookshelf.removeBatch', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * bookshelf.group.assign — change exactly one persisted shelf entry's
   * group.  `group` is deliberately required by Core: an empty string means
   * clear the membership, while omitting it is a DTO error.
   */
  async bookshelfGroupAssign(sourceId: string, bookId: string, group: string): Promise<JsonObject> {
    const normalizedSourceId = sourceId.trim();
    const normalizedBookId = bookId.trim();
    if (normalizedSourceId.length === 0 || normalizedBookId.length === 0) {
      throw new Error('bookshelf.group.assign requires non-empty sourceId and bookId.');
    }
    const params: JsonObject = {};
    params['sourceId'] = normalizedSourceId;
    params['bookId'] = normalizedBookId;
    // Do not trim the payload away: Core owns the exact empty-string = clear
    // semantic, and rejects a missing group field.
    params['group'] = group;
    const result = await this.runtime.request('bookshelf.group.assign', params, { timeoutMs: 5000 });
    return result.data;
  }

  async sourceList(enabledOnly?: boolean): Promise<JsonObject> {
    const params: JsonObject = {};
    if (enabledOnly !== undefined) {
      params['enabledOnly'] = enabledOnly;
    }
    const result = await this.runtime.request('source.list', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * source.imageRequest — ask Core to resolve a persisted source's raw cover
   * URL into its protected GET descriptor.  This does not issue a Host
   * continuation or download any bytes.  The Host restores `sourceId` and
   * cookie-jar ownership here, then SourceImageCache performs the binary
   * transfer.  UI never supplies an inline BookSource and never executes the
   * raw URL directly.
   */
  async sourceImageRequest(sourceId: string, imageUrl: string): Promise<CoreSourceImageRequestDescriptor> {
    const normalizedSourceId = sourceId.trim();
    const normalizedImageUrl = imageUrl.trim();
    if (normalizedSourceId.length === 0 || normalizedImageUrl.length === 0) {
      throw new Error('source.imageRequest requires persisted sourceId and imageUrl.');
    }
    const params: JsonObject = {};
    params['sourceId'] = normalizedSourceId;
    params['imageUrl'] = normalizedImageUrl;
    // Do not add `source`: Core must resolve this through its persisted source
    // store so source headers / base URL / cookie rules remain authoritative.
    const result = await this.runtime.request('source.imageRequest', params, { timeoutMs: 10000 });
    const data = result.data as Object as Record<string, Object>;
    const rawRequest = data['request'];
    if (rawRequest === null || rawRequest === undefined || typeof rawRequest !== 'object') {
      throw new Error('source.imageRequest returned no request descriptor.');
    }
    const fields = rawRequest as Record<string, Object>;
    const urlValue = fields['url'];
    const methodValue = fields['method'];
    const rawHeaders = fields['headers'];
    const rawBody = fields['body'];
    if (typeof urlValue !== 'string' || urlValue.trim().length === 0 || methodValue !== 'GET' ||
      rawHeaders === null || rawHeaders === undefined || typeof rawHeaders !== 'object' ||
      (rawBody !== undefined && rawBody !== null)) {
      throw new Error('source.imageRequest returned an invalid protected GET descriptor.');
    }
    const headers: Record<string, string> = {};
    const headerFields = rawHeaders as Record<string, Object>;
    const headerKeys = Object.keys(headerFields);
    for (let index = 0; index < headerKeys.length; index++) {
      const key = headerKeys[index];
      const value = headerFields[key];
      // Core's contract emits string header values. Reject anything else
      // rather than coercing an object that could bypass Host header rules.
      if (typeof value !== 'string') {
        throw new Error('source.imageRequest returned a non-string header.');
      }
      headers[key] = value;
    }
    const request: HostHttpRequest = {
      url: urlValue.trim(),
      method: 'GET',
      headers,
      // Host-owned restoration — Core's descriptor intentionally has no
      // platform session state. This also lets HttpHostAdapter merge prior
      // source/login cookies with any static Cookie Core supplied.
      sourceId: normalizedSourceId,
      usePlatformCookieJar: true,
    };
    const followRedirects = fields['followRedirects'];
    if (typeof followRedirects === 'boolean') request.followRedirects = followRedirects;
    const maxRedirects = fields['maxRedirects'];
    if (typeof maxRedirects === 'number' && Number.isInteger(maxRedirects) && maxRedirects >= 0) {
      request.maxRedirects = maxRedirects;
    }
    // A Core descriptor can carry an opaque session object.  Preserve its id
    // for SourceSessionHostStore while still forcing the Host cookie jar on.
    const rawSession = fields['session'];
    if (rawSession !== null && rawSession !== undefined && typeof rawSession === 'object') {
      const sessionFields = rawSession as Record<string, Object>;
      const sessionId = sessionFields['id'];
      if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
        request.sessionId = sessionId;
      }
    }
    return { request };
  }

  /**
   * Replay a source.check transaction against responses that the Host already
   * fetched for the same diagnostic flow.  source.check does not initiate
   * network requests itself: callers must not pass an empty or synthetic
   * response list and present the result as an online source diagnostic.
   */
  async sourceCheck(
    sourceIds: string[],
    levels: string[],
    responses: JsonObject[],
  ): Promise<JsonObject> {
    if (sourceIds.length === 0) {
      throw new Error('source.check requires at least one persisted Core sourceId.');
    }
    if (responses.length === 0) {
      throw new Error('source.check requires Host-prefetched diagnostic responses; use source.list for source existence.');
    }
    const params: JsonObject = {};
    params['sourceIds'] = sourceIds;
    params['levels'] = levels;
    params['responses'] = responses;
    const result = await this.runtime.request('source.check', params, { timeoutMs: 15000 });
    return result.data;
  }

  /**
   * Run a persisted-source L1–L5 diagnostic through Core.
   *
   * Unlike the legacy `source.check` replay API above, this command accepts
   * no response bodies.  Core builds each diagnostic request from the stored
   * BookSource and resumes it through the registered `http.execute` Host
   * capability, so a transport or parse failure is returned as that source's
   * real verdict instead of being inferred by ArkTS.
   */
  async sourceCheckRun(
    sourceIds: string[],
    keyword: string = '我的',
    levels: string[] = ['L1', 'L2', 'L3', 'L4', 'L5'],
    timeoutMs: number = 90000,
  ): Promise<JsonObject> {
    if (sourceIds.length === 0) {
      throw new Error('source.check.run requires at least one persisted Core sourceId.');
    }
    for (let i = 0; i < sourceIds.length; i++) {
      if (sourceIds[i].trim().length === 0) {
        throw new Error('source.check.run sourceIds must be non-blank.');
      }
    }
    if (keyword.trim().length === 0) {
      throw new Error('source.check.run keyword must be non-empty.');
    }
    const params: JsonObject = {};
    params['sourceIds'] = sourceIds;
    params['keyword'] = keyword;
    params['levels'] = levels;
    params['timeoutMs'] = timeoutMs;
    // Four sequential Host HTTP stages can each consume the adapter's
    // transport timeout.  Keep the native waiter above that realistic budget
    // rather than converting a late Core failure verdict into a UI timeout.
    const result = await this.runtime.request('source.check.run', params, { timeoutMs: timeoutMs });
    return result.data;
  }

  /**
   * Run one real persisted-source check and replay the Host-captured annotated
   * responses through Core `source.debug`.
   *
   * There is intentionally no second dispatcher here: the command's own
   * `ReaderCoreRuntime.waitForResult()` routes Host requests and consumes the
   * terminal native result.  The recorder is registered before that wait,
   * keyed first by the Core command id and then by diagnostic traceId+sourceId.
   */
  async sourceDebugRun(
    sourceId: string,
    key: string = '我的',
    timeoutMs: number = 90000,
  ): Promise<CoreSourceDebugRunProjection> {
    const normalizedSourceId = sourceId.trim();
    const normalizedKey = key.trim();
    if (normalizedSourceId.length === 0) {
      throw new Error('source.debug requires a non-empty persisted Core sourceId.');
    }
    if (normalizedKey.length === 0) {
      throw new Error('source.debug requires a non-empty diagnostic keyword.');
    }
    const safeTimeoutMs = Math.max(1000, timeoutMs);
    const checkParams: JsonObject = {};
    checkParams['sourceIds'] = [normalizedSourceId];
    checkParams['keyword'] = normalizedKey;
    checkParams['levels'] = ['L1', 'L2', 'L3', 'L4', 'L5'];
    checkParams['timeoutMs'] = safeTimeoutMs;

    const commandRequestId = this.runtime.send('source.check.run', checkParams);
    const recorder = new SourceDebugTranscriptRecorder(
      commandRequestId,
      normalizedSourceId,
      Date.now() + safeTimeoutMs + 20000,
    );
    this.sourceDebugRecordersByCommandRequestId.set(commandRequestId, recorder);

    let sourceCheckData: JsonObject | null = null;
    let sourceCheckError = '';
    let sourceDebugData: JsonObject | null = null;
    let sourceDebugError = '';
    let replayAttempted = false;
    try {
      try {
        const event = await this.runtime.waitForResult(commandRequestId, { timeoutMs: safeTimeoutMs });
        sourceCheckData = event.data;
      } catch (error) {
        sourceCheckError = sourceDebugErrorMessage(error);
        // A timeout/error must not leave a recorder accepting a late Host
        // completion.  Cancellation is request-scoped and never affects an
        // overlapping source check.
        try {
          this.runtime.cancel(commandRequestId);
        } catch (_cancelError) {
          // The result error is already the authoritative outcome; teardown
          // still happens in finally even if the runtime was closed first.
        }
      }

      const replay = recorder.replayInput();
      if (replay === null) {
        sourceDebugError = sourceCheckError.length > 0
          ? `未收集到可重放的 L2 真实响应：${sourceCheckError}`
          : '未收集到可重放的 L2 真实响应；Core source.debug 未执行。';
      } else {
        replayAttempted = true;
        try {
          const debugParams = this.sourceDebugReplayParams(normalizedSourceId, normalizedKey, replay);
          const debugEvent = await this.runtime.request('source.debug', debugParams, { timeoutMs: 15000 });
          sourceDebugData = debugEvent.data;
        } catch (error) {
          sourceDebugError = sourceDebugErrorMessage(error);
        }
      }

      const transcript = recorder.projection();
      const projection: CoreSourceDebugRunProjection = {
        sourceId: normalizedSourceId,
        sourceCheckData,
        sourceCheckError,
        sourceDebugData,
        sourceDebugError,
        stages: transcript.stages,
        replayAttempted,
        replayLimited: transcript.replayLimited,
        replayNotice: transcript.replayNotice,
      };
      return projection;
    } finally {
      // `projection` intentionally carries no response body.  Scrub every
      // transcript entry immediately after the optional Core replay returns.
      this.releaseSourceDebugRecorder(recorder);
    }
  }

  private sourceDebugReplayParams(
    sourceId: string,
    key: string,
    replay: SourceDebugReplayInput,
  ): JsonObject {
    const responses: JsonObject = {};
    responses['sourceId'] = replay.sourceId;
    responses['searchResponse'] = replay.searchResponse;
    responses['detailResponse'] = replay.detailResponse;
    responses['tocResponse'] = replay.tocResponse;
    responses['contentResponse'] = replay.contentResponse;
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['key'] = key;
    params['responses'] = responses;
    return params;
  }

  /**
   * source.exploreKinds using one persisted source.  The Core sourceId is the
   * only authority for its Legado exploreUrl; HarmonyOS must not inject a demo
   * category list when parsing returns no executable entries.
   */
  async sourceExploreKinds(sourceId: string): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    const result = await this.runtime.request('source.exploreKinds', params, { timeoutMs: 10000 });
    return result.data;
  }

  /**
   * source.explore using a URL returned by source.exploreKinds for the same
   * persisted source.  Core owns URL analysis, headers and the http.execute
   * continuation; the host only supplies its registered network capability.
   */
  async sourceExplore(sourceId: string, url: string, page: number = 1): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['url'] = url;
    params['page'] = page;
    const result = await this.runtime.request('source.explore', params, { timeoutMs: 30000 });
    return result.data;
  }

  /**
   * search.content — search only Core's durable chapter cache.
   *
   * This wrapper deliberately requires the caller to pass the currently open
   * sourceId + bookId.  Leaving either scope out would turn a reader-panel
   * query into a cross-library result list and make duplicate book IDs from
   * different sources ambiguous.
   */
  async searchContent(keyword: string, sourceId: string, bookId: string,
    maxResults: number = 50): Promise<JsonObject> {
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword.length === 0) {
      throw new Error('search.content requires a non-empty keyword.');
    }
    if (sourceId.trim().length === 0 || bookId.trim().length === 0) {
      throw new Error('search.content requires the current Core sourceId and bookId.');
    }
    const params: JsonObject = {};
    params['keyword'] = normalizedKeyword;
    params['sourceId'] = sourceId;
    params['bookId'] = bookId;
    params['maxResults'] = Math.max(1, Math.min(200, Math.floor(maxResults)));
    const result = await this.runtime.request('search.content', params, { timeoutMs: 10000 });
    return result.data;
  }

  // ── Bookmark / search-history Core verticals ─────────────────────────
  // Keep these wrappers typed and narrow instead of letting UI components
  // construct arbitrary DTOs.  The Core owns persistence and validation.

  async bookmarkList(bookName: string, bookAuthor: string): Promise<JsonObject> {
    if (bookName.trim().length === 0 || bookAuthor.trim().length === 0) {
      throw new Error('bookmark.list requires the current Core book title and author.');
    }
    const params: JsonObject = {};
    // Core Bookmark V1 can filter only the (bookName, bookAuthor) pair; it
    // intentionally has no sourceId/bookId field to invent here.
    // Preserve Core's exact persisted pair. Trimming is validation only:
    // changing the payload could make a cross-platform bookmark unreachable.
    params['bookName'] = bookName;
    params['bookAuthor'] = bookAuthor;
    const result = await this.runtime.request('bookmark.list', params, { timeoutMs: 5000 });
    return result.data;
  }

  async bookmarkCreate(input: CoreBookmarkCreateInput): Promise<JsonObject> {
    if (input.bookName.trim().length === 0 || input.bookAuthor.trim().length === 0) {
      throw new Error('bookmark.create requires the current Core book title and author.');
    }
    if (!Number.isFinite(input.chapterIndex) || input.chapterIndex < 0 ||
      !Number.isFinite(input.chapterPos) || input.chapterPos < 0) {
      throw new Error('bookmark.create requires a non-negative Core chapter index and offset.');
    }
    const params: JsonObject = {};
    params['bookName'] = input.bookName;
    params['bookAuthor'] = input.bookAuthor;
    params['chapterIndex'] = Math.floor(input.chapterIndex);
    params['chapterPos'] = Math.floor(input.chapterPos);
    params['chapterName'] = input.chapterName;
    params['bookText'] = input.bookText;
    params['content'] = input.content;
    const result = await this.runtime.request('bookmark.create', params, { timeoutMs: 5000 });
    return result.data;
  }

  async bookmarkDelete(time: number): Promise<JsonObject> {
    if (!Number.isFinite(time) || time < 0) {
      throw new Error('bookmark.delete requires a non-negative Core bookmark time.');
    }
    const params: JsonObject = {};
    params['time'] = Math.floor(time);
    const result = await this.runtime.request('bookmark.delete', params, { timeoutMs: 5000 });
    return result.data;
  }

  /** Update one existing Core bookmark.  `time` is Core's exact primary key;
   * the bridge never derives it from a row index or a visual fixture. */
  async bookmarkUpdate(input: CoreBookmarkUpdateInput): Promise<JsonObject> {
    if (!Number.isSafeInteger(input.time) || input.time < 0) {
      throw new Error('bookmark.update requires a non-negative Core bookmark time.');
    }
    const params: JsonObject = {};
    params['time'] = input.time;
    if (input.bookName !== undefined) params['bookName'] = input.bookName;
    if (input.bookAuthor !== undefined) params['bookAuthor'] = input.bookAuthor;
    if (input.chapterIndex !== undefined) {
      CoreRuntime.requireNonNegativeInt32(input.chapterIndex, 'bookmark.update chapterIndex');
      params['chapterIndex'] = input.chapterIndex;
    }
    if (input.chapterPos !== undefined) {
      CoreRuntime.requireNonNegativeInt32(input.chapterPos, 'bookmark.update chapterPos');
      params['chapterPos'] = input.chapterPos;
    }
    if (input.chapterName !== undefined) params['chapterName'] = input.chapterName;
    if (input.bookText !== undefined) params['bookText'] = input.bookText;
    if (input.content !== undefined) params['content'] = input.content;
    const result = await this.runtime.request('bookmark.update', params, { timeoutMs: 5000 });
    return result.data;
  }

  async searchHistoryList(limit?: number): Promise<JsonObject> {
    const params: JsonObject = {};
    if (limit !== undefined) {
      if (!Number.isFinite(limit) || limit < 1) {
        throw new Error('search.history.list limit must be a positive number.');
      }
      params['limit'] = Math.floor(limit);
    }
    const result = await this.runtime.request('search.history.list', params, { timeoutMs: 5000 });
    return result.data;
  }

  async searchHistoryAdd(keyword: string): Promise<JsonObject> {
    const normalized = keyword.trim();
    if (normalized.length === 0) {
      throw new Error('search.history.add requires a non-empty keyword.');
    }
    const params: JsonObject = {};
    params['keyword'] = normalized;
    const result = await this.runtime.request('search.history.add', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * source.import — import exactly one raw Legado BookSource payload.
   *
   * The raw object stays intact under `bookSource`, including sourceId.  Core
   * owns validation, storage and duplicate/upsert semantics; the bridge only
   * mirrors the optional sourceId and canonical Legado base-url field into the
   * transport DTO so no imported source is silently assigned a new identity.
   */
  async sourceImport(bookSource: JsonObject): Promise<JsonObject> {
    const params: JsonObject = {};
    params['bookSource'] = bookSource;
    const fields = bookSource as Object as Record<string, string>;
    const sourceId = fields['sourceId'];
    if (typeof sourceId === 'string' && sourceId.trim().length > 0) {
      params['sourceId'] = sourceId;
    }
    const baseUrl = fields['bookSourceUrl'];
    if (typeof baseUrl === 'string' && baseUrl.trim().length > 0) {
      params['baseUrl'] = baseUrl;
    }
    const result = await this.runtime.request('source.import', params, { timeoutMs: 15000 });
    return result.data;
  }

  async sourceDelete(sourceIds: string[]): Promise<JsonObject> {
    const params: JsonObject = {};
    params['sourceIds'] = sourceIds;
    const result = await this.runtime.request('source.delete', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * change.bookSource — discover candidates for the selected source ids.
   * The final selection remains a Host/UI responsibility by Core contract.
   */
  async changeBookSource(bookId: string, sourceIds: string[], keyword?: string): Promise<JsonObject> {
    const params: JsonObject = {};
    params['bookId'] = bookId;
    params['sourceIds'] = sourceIds;
    if (keyword !== undefined && keyword.length > 0) {
      params['keyword'] = keyword;
    }
    const result = await this.runtime.request('change.bookSource', params, { timeoutMs: 30000 });
    return result.data;
  }

  /**
   * replace-rule.create — persist a new replace rule to Core storage.
   * Returns the created rule with its canonical id.  Create deliberately
   * never forwards an id: Core owns allocation and treats a supplied id as
   * an upsert target.
   */
  async replaceRuleCreate(rule: JsonObject): Promise<JsonObject> {
    const params = CoreRuntime.replaceRuleParams(rule, false);
    const result = await this.runtime.request('replace-rule.create', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * replace-rule.update — update an existing replace rule in Core storage.
   * Returns the updated rule.
   */
  async replaceRuleUpdate(rule: JsonObject): Promise<JsonObject> {
    const params = CoreRuntime.replaceRuleParams(rule, true);
    const result = await this.runtime.request('replace-rule.update', params, { timeoutMs: 5000 });
    return result.data;
  }

  /**
   * replace-rule.delete — remove a replace rule from Core storage by id.
   * Returns { deleted: true } on success.
   */
  async replaceRuleDelete(ruleId: string): Promise<JsonObject> {
    const params: JsonObject = {};
    params['id'] = CoreRuntime.numericRuleId(ruleId);
    const result = await this.runtime.request('replace-rule.delete', params, { timeoutMs: 5000 });
    return result.data;
  }

  async replaceRuleList(enabledOnly?: boolean): Promise<JsonObject> {
    const params: JsonObject = {};
    if (enabledOnly !== undefined) {
      params['enabledOnly'] = enabledOnly;
    }
    const result = await this.runtime.request('replace-rule.list', params, { timeoutMs: 5000 });
    return result.data;
  }

  // ── Slice 10 typed-schema Core verticals ─────────────────────────────
  // These methods are the complete production bridge for commands whose
  // params are bound through reader-command.schema.json.  They deliberately
  // do not wrap runtime-only/content-edit/cover or examples-only HTTP-TTS and
  // read-record commands: those remain fail-closed in Slice10CapabilityPolicy.

  async txtTocRuleCreate(input: CoreTxtTocRuleCreateInput): Promise<JsonObject> {
    const name = input.name.trim();
    const rule = input.rule.trim();
    if (name.length === 0 || rule.length === 0) {
      throw new Error('txt-toc-rule.create requires non-empty name and rule.');
    }
    const params: JsonObject = {};
    params['name'] = input.name;
    params['rule'] = input.rule;
    if (input.example !== undefined) params['example'] = input.example;
    if (input.serialNumber !== undefined) {
      CoreRuntime.requireInt32(input.serialNumber, 'txt-toc-rule.create serialNumber');
      params['serialNumber'] = input.serialNumber;
    }
    if (input.enable !== undefined) params['enable'] = input.enable;
    if (input.id !== undefined) {
      CoreRuntime.requirePositiveSafeInteger(input.id, 'txt-toc-rule.create id');
      params['id'] = input.id;
    }
    const result = await this.runtime.request('txt-toc-rule.create', params, { timeoutMs: 5000 });
    return result.data;
  }

  async txtTocRuleList(enabledOnly?: boolean): Promise<JsonObject> {
    const params: JsonObject = {};
    if (enabledOnly !== undefined) params['enabledOnly'] = enabledOnly;
    const result = await this.runtime.request('txt-toc-rule.list', params, { timeoutMs: 5000 });
    return result.data;
  }

  async txtTocRuleUpdate(input: CoreTxtTocRuleUpdateInput): Promise<JsonObject> {
    CoreRuntime.requirePositiveSafeInteger(input.id, 'txt-toc-rule.update id');
    const params: JsonObject = {};
    params['id'] = input.id;
    if (input.name !== undefined) params['name'] = input.name;
    if (input.rule !== undefined) params['rule'] = input.rule;
    if (input.example !== undefined) params['example'] = input.example;
    if (input.serialNumber !== undefined) {
      CoreRuntime.requireInt32(input.serialNumber, 'txt-toc-rule.update serialNumber');
      params['serialNumber'] = input.serialNumber;
    }
    if (input.enable !== undefined) params['enable'] = input.enable;
    if (Object.keys(params).length === 1) {
      throw new Error('txt-toc-rule.update requires at least one changed field.');
    }
    const result = await this.runtime.request('txt-toc-rule.update', params, { timeoutMs: 5000 });
    return result.data;
  }

  async txtTocRuleDelete(id: number): Promise<JsonObject> {
    CoreRuntime.requirePositiveSafeInteger(id, 'txt-toc-rule.delete id');
    const params: JsonObject = {};
    params['id'] = id;
    const result = await this.runtime.request('txt-toc-rule.delete', params, { timeoutMs: 5000 });
    return result.data;
  }

  /** Persist only Core's singleton system-TTS configuration.  This call does
   * not start speech and does not claim HTTP-TTS/audio-player support. */
  async ttsConfigPut(input: CoreTtsConfigInput): Promise<JsonObject> {
    CoreRuntime.requireInt32(input.rate, 'tts.config.put rate');
    CoreRuntime.requireInt32(input.pitch, 'tts.config.put pitch');
    const params: JsonObject = {};
    if (input.engine !== undefined) params['engine'] = input.engine;
    params['rate'] = input.rate;
    params['pitch'] = input.pitch;
    params['followSys'] = input.followSys;
    const result = await this.runtime.request('tts.config.put', params, { timeoutMs: 5000 });
    return result.data;
  }

  async ttsConfigGet(): Promise<JsonObject> {
    const params: JsonObject = {};
    const result = await this.runtime.request('tts.config.get', params, { timeoutMs: 5000 });
    return result.data;
  }

  /** Load read-only chapter reviews for one current, persisted Core source.
   * `reviewUrl` is mandatory: Core cannot derive a request from chapterUrl and
   * the Host must not invent or prefetch a response outside this command. */
  async bookChapterReview(sourceId: string, bookId: string, reviewUrl: string,
    chapterUrl?: string): Promise<JsonObject> {
    const normalizedSourceId = sourceId.trim();
    const normalizedBookId = bookId.trim();
    const normalizedReviewUrl = reviewUrl.trim();
    if (normalizedSourceId.length === 0 || normalizedBookId.length === 0 ||
      normalizedReviewUrl.length === 0) {
      throw new Error('book.chapterReview requires current sourceId, bookId and reviewUrl.');
    }
    const params: JsonObject = {};
    params['sourceId'] = normalizedSourceId;
    params['bookId'] = normalizedBookId;
    params['reviewUrl'] = normalizedReviewUrl;
    if (chapterUrl !== undefined && chapterUrl.trim().length > 0) {
      params['chapterUrl'] = chapterUrl.trim();
    }
    const result = await this.runtime.request('book.chapterReview', params, { timeoutMs: 30000 });
    return result.data;
  }

  /** Execute an actual Core-Native method for contract translations that do
   * not need a dedicated convenience wrapper. Core still validates the DTO. */
  async executeCoreMethod(method: string, params: JsonObject = {}, timeoutMs: number = 15000): Promise<JsonObject> {
    const result = await this.runtime.request(method, params, { timeoutMs: timeoutMs });
    return result.data;
  }

  /**
   * search.history.clear — clear all search history entries in Core storage.
   * Returns { cleared: true } on success.
   */
  async searchHistoryClear(): Promise<JsonObject> {
    const params: JsonObject = {};
    const result = await this.runtime.request('search.history.clear', params, { timeoutMs: 5000 });
    return result.data;
  }

  private static stringField(value: JsonObject, key: string, fallback: string = ''): string {
    const fields = value as Object as Record<string, string>;
    const raw: string = fields[key];
    return typeof raw === 'string' ? raw : fallback;
  }

  private static copyOptionalString(from: JsonObject, to: JsonObject, key: string): void {
    const fields = from as Object as Record<string, string>;
    const raw: string = fields[key];
    if (typeof raw === 'string' && raw.length > 0) {
      to[key] = raw;
    }
  }

  private static numericRuleId(ruleId: string): number {
    const normalized = ruleId.startsWith('rule-') ? ruleId.substring(5) : ruleId;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`replace-rule id must contain a positive numeric Core id: ${ruleId}`);
    }
    return Math.floor(parsed);
  }

  private static replaceRuleParams(rule: JsonObject, requireCoreId: boolean): JsonObject {
    const params: JsonObject = {};
    if (requireCoreId) {
      const stringFields = rule as Object as Record<string, string>;
      const numberFields = rule as Object as Record<string, number>;
      const rawStringId: string = stringFields['id'];
      const rawNumberId: number = numberFields['id'];
      if (typeof rawStringId === 'string' && rawStringId.length > 0) {
        params['id'] = CoreRuntime.numericRuleId(rawStringId);
      } else if (typeof rawNumberId === 'number') {
        params['id'] = Math.floor(rawNumberId);
      } else {
        throw new Error('replace-rule.update requires a Core rule id');
      }
    }
    const pattern = CoreRuntime.stringField(rule, 'pattern');
    params['name'] = CoreRuntime.stringField(rule, 'name', pattern);
    params['pattern'] = pattern;
    params['replacement'] = CoreRuntime.stringField(rule, 'replacement');
    params['scope'] = CoreRuntime.stringField(rule, 'scope', 'chapter');
    const booleanFields = rule as Object as Record<string, boolean>;
    const enabled: boolean = booleanFields['enabled'];
    params['isEnabled'] = typeof enabled === 'boolean' ? enabled : true;
    const isRegex: boolean = booleanFields['isRegex'];
    params['isRegex'] = typeof isRegex === 'boolean' ? isRegex : true;
    params['scopeContent'] = true;
    return params;
  }

  private static requirePositiveSafeInteger(value: number, label: string): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${label} must be a positive safe integer.`);
    }
  }

  private static requireInt32(value: number, label: string): void {
    if (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647) {
      throw new Error(`${label} must be an Int32.`);
    }
  }

  private static requireNonNegativeInt32(value: number, label: string): void {
    CoreRuntime.requireInt32(value, label);
    if (value < 0) throw new Error(`${label} must be non-negative.`);
  }

  /** Convert a device-density-derived ArkUI dimension to Core's u32 DTO. */
  private static normalizeCoreViewportDimension(value: number, label: string): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${label} must be a finite positive viewport dimension.`);
    }
    const normalized = Math.max(1, Math.round(value));
    if (!Number.isSafeInteger(normalized) || normalized <= 0 || normalized > 4294967295) {
      throw new Error(`${label} must fit Core's positive uint32 viewport dimension.`);
    }
    return normalized;
  }
}

// ── Local book parse options (for localBookParse wrapper) ──────────────
export interface CoreBookshelfRemoveTarget {
  sourceId: string;
  bookId: string;
}

export interface LocalBookParseOptions {
  // Legacy already-decoded text path. New host imports must send bytesBase64
  // so Core owns encoding detection and TXT rule evaluation.
  text?: string;
  bytesBase64?: string;
  title?: string;
  author?: string;
  fileName?: string;
  format?: string;
}

/** Exact UI-to-Core shape for creating a Bookmark V1 record. */
export interface CoreBookmarkCreateInput {
  bookName: string;
  bookAuthor: string;
  chapterIndex: number;
  chapterPos: number;
  chapterName: string;
  // Actual current-page/chapter text selected by the reader, never a fixture.
  bookText: string;
  // Bookmark V1's user-note field. The one-tap reader action has no note
  // editor yet, so it is explicitly persisted as empty rather than invented.
  content: string;
}

/** Exact optional fields of Core BookmarkUpdateParams. */
export interface CoreBookmarkUpdateInput {
  time: number;
  bookName?: string;
  bookAuthor?: string;
  chapterIndex?: number;
  chapterPos?: number;
  chapterName?: string;
  bookText?: string;
  content?: string;
}

export interface CoreTxtTocRuleCreateInput {
  name: string;
  rule: string;
  example?: string;
  serialNumber?: number;
  enable?: boolean;
  id?: number;
}

export interface CoreTxtTocRuleUpdateInput {
  id: number;
  name?: string;
  rule?: string;
  example?: string;
  serialNumber?: number;
  enable?: boolean;
}

export interface CoreTtsConfigInput {
  engine?: string;
  rate: number;
  pitch: number;
  followSys: boolean;
}
