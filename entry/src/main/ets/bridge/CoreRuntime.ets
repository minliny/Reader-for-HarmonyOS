// CoreRuntime — singleton orchestrator for Reader-Core runtime + Host adapters.
// Phase 3-4 Host integration:
//   Phase 3: Core closed-set adapters (http.execute / cookie.get / cookie.set /
//            webview.evaluateJavaScript / file.read / file.write /
//            host.smoke.echo / cache.* / persistence.* / log.emit / time.now /
//            system.info / media.download) registered with
//            HostCapabilityRegistry — Core may request these over NAPI.
//   Phase 4: UI-Contract-only adapters (clipboard.copy/paste, tts.system.*,
//            device.screen.keep-on/release, notification.*, background.*,
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
} from './core/sdk/reader_core';
import { HostCapabilityRegistry, HostDispatcher } from '../host';
import {
  HostCapabilityManifest,
  type HostCapabilityAvailabilityResolver,
} from '../host/HostCapabilityManifest';
import type { HostCapability } from '../host/types';
import { HttpHostAdapter } from '../host/adapters/HttpHostAdapter';
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
import { ShareHostAdapter } from '../host/adapters/ShareHostAdapter';
import { PermissionHostAdapter } from '../host/adapters/PermissionHostAdapter';
import { CredentialHostAdapter } from '../host/adapters/CredentialHostAdapter';
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
  private shareAdapter: ShareHostAdapter | null;
  private permissionAdapter: PermissionHostAdapter | null;
  private credentialAdapter: CredentialHostAdapter | null;

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
    this.coreAdapter = new CoreHostAdapter();
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
    this.deviceAdapter = new DeviceHostAdapter();
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
    } else {
      this.screenAdapter = null;
      this.notificationAdapter = null;
      this.credentialAdapter = null;
      this.shareAdapter = null;
      this.permissionAdapter = null;
    }

    // 5. Register Phase 3 adapter handlers against the registry.
    this.registerHandlers();

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
      const resp = await this.httpAdapter.execute(request);
      return resp as Object as JsonObject;
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

    // persistence.get / persistence.put
    this.registry.register('persistence.get', (event: ReaderCoreHostRequestEvent): JsonObject => {
      const request = event.params as Object as HostPersistenceGetRequest;
      const resp = this.coreAdapter.persistenceGet(request);
      return resp as Object as JsonObject;
    });
    this.registry.register('persistence.put', (event: ReaderCoreHostRequestEvent): JsonObject => {
      const request = event.params as Object as HostPersistencePutRequest;
      const resp = this.coreAdapter.persistencePut(request);
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
    CoreRuntime.instance.backgroundAdapter.cancelAll();
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

  getRegistry(): HostCapabilityRegistry {
    return this.registry;
  }

  getCapabilityManifest(): HostCapabilityManifest {
    return this.manifest;
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
  }

  getHttpAdapter(): HttpHostAdapter {
    return this.httpAdapter;
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

  getShareAdapter(): ShareHostAdapter | null {
    return this.shareAdapter;
  }

  getPermissionAdapter(): PermissionHostAdapter | null {
    return this.permissionAdapter;
  }

  getCredentialAdapter(): CredentialHostAdapter | null {
    return this.credentialAdapter;
  }

  startDispatcher(): void {
    this.dispatcher.start();
  }

  stopDispatcher(): void {
    this.dispatcher.stop();
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
}
