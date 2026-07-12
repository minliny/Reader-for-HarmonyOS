// Production Reader UI HostRequest platform for HarmonyOS. Every one of the
// 58 generated wire types has an explicit branch. Branches that require an
// unavailable UI context or semantic callback fail closed through isAvailable.
import type { HostRequestType } from '../contract/generated/HostRequestTable';
import {
  ReaderUiHostFailure,
  type ReaderUiHostPayload,
  type ReaderUiHostPlatform,
  type ReaderUiHostRequest,
} from './ReaderUiHostContract';
import type {
  HostBackgroundCancelRequest,
  HostBackgroundScheduleRequest,
  HostCookieRecord,
  HostFileWriteRequest,
  HostForegroundTimerRequest,
  HostHttpRequest,
  HostPersistenceGetRequest,
  HostPersistencePutRequest,
  HostShareInvokeRequest,
  HostTtsSystemStartRequest,
} from './types';
import { HttpHostAdapter } from './adapters/HttpHostAdapter';
import { CookieHostAdapter } from './adapters/CookieHostAdapter';
import { WebViewHostAdapter } from './adapters/WebViewHostAdapter';
import { FileHostAdapter } from './adapters/FileHostAdapter';
import { ClipboardHostAdapter } from './adapters/ClipboardHostAdapter';
import { TtsHostAdapter } from './adapters/TtsHostAdapter';
import { ScreenHostAdapter } from './adapters/ScreenHostAdapter';
import { DeviceHostAdapter } from './adapters/DeviceHostAdapter';
import { NotificationHostAdapter } from './adapters/NotificationHostAdapter';
import { BackgroundHostAdapter } from './adapters/BackgroundHostAdapter';
import {
  ForegroundTimerHostAdapter,
  type ForegroundTimerFiredCallback,
} from './adapters/ForegroundTimerHostAdapter';
import { ShareHostAdapter } from './adapters/ShareHostAdapter';
import { PermissionHostAdapter } from './adapters/PermissionHostAdapter';
import { CredentialHostAdapter } from './adapters/CredentialHostAdapter';
import { FileSelectionHostAdapter } from './adapters/FileSelectionHostAdapter';
import { FontHostAdapter } from './adapters/FontHostAdapter';
import { CoreHostAdapter } from './adapters/CoreHostAdapter';
import { NetworkHostAdapter } from './adapters/NetworkHostAdapter';
import {
  WebDavHostAdapter,
  type ReaderWebDavCredentials,
} from './adapters/WebDavHostAdapter';

export type BackgroundScheduledWork = (taskId: string) => void;

type ReaderHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' |
  'PATCH' | 'PROPFIND' | 'MKCOL' | 'MOVE' | 'COPY';

interface ReaderUiPlatformResult {
  cleared?: boolean;
  armed?: boolean;
  cancelled?: boolean;
  written?: boolean;
  brightness?: number;
  applied?: boolean;
  keepAwake?: boolean;
  shared?: boolean;
  path?: string;
  ended?: boolean;
  taskId?: string;
  performed?: boolean;
  style?: string;
}

export interface HarmonyReaderUiHostPlatformOptions {
  httpAdapter: HttpHostAdapter;
  cookieAdapter: CookieHostAdapter;
  webViewAdapter: WebViewHostAdapter;
  fileAdapter: FileHostAdapter | null;
  clipboardAdapter: ClipboardHostAdapter;
  ttsAdapter: TtsHostAdapter;
  screenAdapter: ScreenHostAdapter | null;
  deviceAdapter: DeviceHostAdapter;
  notificationAdapter: NotificationHostAdapter | null;
  backgroundAdapter: BackgroundHostAdapter;
  foregroundTimerAdapter: ForegroundTimerHostAdapter;
  shareAdapter: ShareHostAdapter | null;
  permissionAdapter: PermissionHostAdapter | null;
  credentialAdapter: CredentialHostAdapter | null;
  fileSelectionAdapter: FileSelectionHostAdapter | null;
  fontAdapter: FontHostAdapter | null;
  persistenceAdapter: CoreHostAdapter;
  networkAdapter: NetworkHostAdapter;
  webDavAdapter: WebDavHostAdapter | null;
  foregroundTimerFired?: ForegroundTimerFiredCallback;
  backgroundScheduledWork?: BackgroundScheduledWork;
}

export class HarmonyReaderUiHostPlatform implements ReaderUiHostPlatform {
  private options: HarmonyReaderUiHostPlatformOptions;
  private timerFired: ForegroundTimerFiredCallback | null;
  private backgroundWork: BackgroundScheduledWork | null;

  constructor(options: HarmonyReaderUiHostPlatformOptions) {
    this.options = options;
    this.timerFired = options.foregroundTimerFired ?? null;
    this.backgroundWork = options.backgroundScheduledWork ?? null;
  }

  isAvailable(type: HostRequestType): boolean {
    switch (type) {
      case 'http.execute':
      case 'http.cancel': return this.options.httpAdapter !== null;
      case 'webview.open':
      case 'webview.close':
      case 'webview.evaluate': return this.options.webViewAdapter !== null;
      case 'cookie.get':
      case 'cookie.set':
      case 'cookie.clear': return this.options.cookieAdapter !== null;
      case 'file.read':
      case 'file.write':
      case 'file.delete':
      case 'storage.path': return this.options.fileAdapter !== null;
      case 'credential.get':
      case 'credential.set':
      case 'credential.delete': return this.options.credentialAdapter !== null;
      case 'tts.system.start':
      case 'tts.system.stop':
      case 'tts.system.pause':
      case 'tts.system.resume':
      case 'tts.start':
      case 'tts.stop':
      case 'tts.pause': return this.options.ttsAdapter !== null;
      case 'permission.request':
      case 'permission.check': return this.options.permissionAdapter !== null;
      case 'background.schedule': return this.backgroundWork !== null;
      case 'background.cancel': return this.options.backgroundAdapter !== null;
      case 'timer.foreground.arm': return this.timerFired !== null;
      case 'timer.foreground.cancel': return this.options.foregroundTimerAdapter !== null;
      case 'notification.show':
      case 'notification.cancel': return this.options.notificationAdapter !== null;
      case 'share.invoke':
      case 'share.text':
      case 'share.file': return this.options.shareAdapter !== null;
      case 'clipboard.copy':
      case 'clipboard.paste':
      case 'clipboard.read':
      case 'clipboard.write': return this.options.clipboardAdapter !== null;
      case 'device.vibrate':
      case 'haptics.light':
      case 'haptics.medium':
      case 'haptics.heavy': return this.options.deviceAdapter !== null;
      case 'device.screen.keep-on':
      case 'device.screen.release':
      case 'brightness.set':
      case 'brightness.get':
      case 'screen.keepAwake':
      case 'screen.allowSleep': return this.options.screenAdapter !== null;
      case 'file.select': return this.options.fileSelectionAdapter !== null;
      case 'font.registerFile': return this.options.fontAdapter !== null;
      case 'font.unregisterFile': return this.options.fontAdapter !== null;
      case 'persistence.get':
      case 'persistence.put': return this.options.persistenceAdapter !== null;
      case 'network.status': return this.options.networkAdapter !== null;
      case 'webdav.connect':
      case 'webdav.backup':
      case 'webdav.restore': return this.options.webDavAdapter !== null;
      case 'background.task.start':
      case 'background.task.end': return this.options.backgroundAdapter !== null;
      default: return false;
    }
  }

  async execute(type: HostRequestType, payload: ReaderUiHostPayload,
    request: ReaderUiHostRequest): Promise<ReaderUiHostPayload> {
    switch (type) {
      case 'http.execute': {
        const headers = payload['headers'] === undefined
          ? {} as Record<string, string>
          : payload['headers'] as Object as Record<string, string>;
        const httpRequest: HostHttpRequest = {
          url: payload['url'] as string,
          method: payload['method'] as Object as ReaderHttpMethod,
          headers: headers,
        };
        if (typeof payload['body'] === 'string') httpRequest.body = payload['body'] as string;
        if (typeof payload['charset'] === 'string') httpRequest.charset = payload['charset'] as string;
        if (typeof payload['followRedirects'] === 'boolean') {
          httpRequest.followRedirects = payload['followRedirects'] as boolean;
        }
        if (typeof payload['maxRedirects'] === 'number') httpRequest.maxRedirects = payload['maxRedirects'] as number;
        if (typeof payload['sessionId'] === 'string') httpRequest.sessionId = payload['sessionId'] as string;
        const response = await this.options.httpAdapter.execute(httpRequest, request.requestId);
        return this.payload(response);
      }
      case 'http.cancel': {
        const target = typeof payload['requestId'] === 'string'
          ? payload['requestId'] as string : request.requestId as string;
        const response = this.options.httpAdapter.cancel(target);
        this.requireTrue(type, response.cancelled, 'target request is not active');
        return this.payload(response);
      }
      case 'webview.open': {
        const response = await this.options.webViewAdapter.open({
          url: payload['url'] as string,
          profileId: payload['profileId'] as string | undefined,
        });
        this.requireTrue(type, response.opened, 'no WebView controller is registered');
        return this.payload(response);
      }
      case 'webview.close': {
        const response = await this.options.webViewAdapter.close({
          profileId: payload['profileId'] as string | undefined,
        });
        this.requireTrue(type, response.closed, 'no WebView controller is registered');
        return this.payload(response);
      }
      case 'webview.evaluate': {
        const response = await this.options.webViewAdapter.evaluate({
          script: payload['script'] as string,
          profileId: payload['profileId'] as string | undefined,
        });
        return this.payload(response);
      }
      case 'cookie.get': {
        const response = await this.options.cookieAdapter.get(payload as Object as Record<string, Object>);
        return this.payload(response);
      }
      case 'cookie.set': {
        const cookieValue = payload['cookie'];
        const cookie = cookieValue !== undefined
          ? cookieValue as Object as HostCookieRecord
          : this.cookieFromFlatPayload(payload);
        const response = await this.options.cookieAdapter.set({
          cookie: cookie,
          sessionId: payload['sessionId'] as string | undefined,
        });
        this.requireTrue(type, response.stored, 'cookie was not stored');
        return this.payload(response);
      }
      case 'cookie.clear': {
        const sessionId = payload['sessionId'];
        if (typeof sessionId === 'string') this.options.cookieAdapter.clearSession(sessionId);
        else this.options.cookieAdapter.clearAll();
        return this.platformResult({ cleared: true });
      }
      case 'file.read': {
        const adapter = this.requireFile(type);
        const response = await adapter.read({
          path: payload['path'] as string,
          encoding: payload['encoding'] as string | undefined,
        });
        return this.payload(response);
      }
      case 'file.write': {
        const adapter = this.requireFile(type);
        const fileRequest: HostFileWriteRequest = { path: payload['path'] as string };
        if (typeof payload['content'] === 'string') fileRequest.content = payload['content'] as string;
        if (typeof payload['contentBase64'] === 'string') fileRequest.contentBase64 = payload['contentBase64'] as string;
        if (typeof payload['encoding'] === 'string') fileRequest.encoding = payload['encoding'] as string;
        if (typeof payload['append'] === 'boolean') fileRequest.append = payload['append'] as boolean;
        const response = await adapter.write(fileRequest);
        this.requireTrue(type, response.written, 'file was not written');
        return this.payload(response);
      }
      case 'file.delete': {
        const response = await this.requireFile(type).delete({ path: payload['path'] as string });
        this.requireTrue(type, response.deleted, 'file was not deleted');
        return this.payload(response);
      }
      case 'storage.path': {
        const scope = payload['scope'] as Object as 'cache' | 'files' | 'external';
        return this.payload(this.requireFile(type).storagePath(scope));
      }
      case 'persistence.get': {
        const persistenceRequest: HostPersistenceGetRequest = {
          namespace: payload['namespace'] as string,
          key: payload['key'] as string,
        };
        return this.payload(await this.options.persistenceAdapter.persistenceGet(persistenceRequest));
      }
      case 'persistence.put': {
        const persistenceRequest: HostPersistencePutRequest = {
          namespace: payload['namespace'] as string,
          key: payload['key'] as string,
          value: payload['value'] as string,
          expectedRevision: payload['expectedRevision'] as string,
        };
        const response = await this.options.persistenceAdapter.persistencePut(persistenceRequest);
        this.requireTrue(type, response.stored, 'appearance value was not stored');
        return this.payload(response);
      }
      case 'credential.get': {
        const response = await this.requireCredential(type).get({ key: payload['key'] as string });
        return this.payload(response);
      }
      case 'credential.set': {
        const response = await this.requireCredential(type).set({
          key: payload['key'] as string,
          value: payload['value'] as string,
        });
        this.requireTrue(type, response.stored, 'credential was not stored');
        return this.payload(response);
      }
      case 'credential.delete': {
        const response = await this.requireCredential(type).delete({ key: payload['key'] as string });
        return this.payload(response);
      }
      case 'tts.system.start':
      case 'tts.start': {
        const startRequest = this.ttsStartRequest(payload);
        const response = await this.options.ttsAdapter.start(startRequest);
        this.requireTrue(type, response.started, 'TTS engine did not start');
        return this.payload(response);
      }
      case 'tts.system.stop':
      case 'tts.stop': {
        const response = await this.options.ttsAdapter.stop();
        this.requireTrue(type, response.acknowledged, 'TTS stop was not acknowledged');
        return this.payload(response);
      }
      case 'tts.system.pause':
      case 'tts.pause': {
        const response = await this.options.ttsAdapter.pause();
        this.requireTrue(type, response.acknowledged, 'TTS pause is not supported by the active engine');
        return this.payload(response);
      }
      case 'tts.system.resume': {
        const response = await this.options.ttsAdapter.resume();
        this.requireTrue(type, response.acknowledged, 'TTS resume is not supported by the active engine');
        return this.payload(response);
      }
      case 'permission.request': {
        const response = await this.requirePermission(type).request({ scope: payload['scope'] as string });
        return this.payload(response);
      }
      case 'permission.check': {
        const response = await this.requirePermission(type).check({ scope: payload['scope'] as string });
        return this.payload(response);
      }
      case 'background.schedule': {
        if (this.backgroundWork === null) this.unavailable(type, 'no semantic work callback is installed');
        const bgRequest: HostBackgroundScheduleRequest = {
          taskId: payload['taskId'] as string,
          delayMs: payload['delayMs'] as number | undefined,
        };
        const taskId = bgRequest.taskId;
        const response = this.options.backgroundAdapter.schedule(bgRequest, (): void => {
          if (this.backgroundWork !== null) this.backgroundWork(taskId);
        });
        this.requireTrue(type, response.scheduled, 'background task was not scheduled');
        return this.payload(response);
      }
      case 'background.cancel': {
        const bgRequest: HostBackgroundCancelRequest = { taskId: payload['taskId'] as string };
        const response = this.options.backgroundAdapter.cancel(bgRequest);
        this.requireTrue(type, response.cancelled, 'background task is not active');
        return this.payload(response);
      }
      case 'timer.foreground.arm': {
        if (this.timerFired === null) this.unavailable(type, 'no foreground timer callback is installed');
        const armed = this.options.foregroundTimerAdapter.arm(
          payload as Object as HostForegroundTimerRequest,
          this.timerFired as ForegroundTimerFiredCallback,
        );
        this.requireTrue(type, armed, 'foreground timer invariants were rejected');
        return this.platformResult({ armed: true });
      }
      case 'timer.foreground.cancel': {
        const cancelled = this.options.foregroundTimerAdapter.cancel(
          payload as Object as HostForegroundTimerRequest,
        );
        this.requireTrue(type, cancelled, 'foreground timer is not active');
        return this.platformResult({ cancelled: true });
      }
      case 'notification.show': {
        const response = await this.requireNotification(type).show({
          title: payload['title'] as string,
          body: payload['body'] as string,
        });
        this.requireTrue(type, response.shown, 'notification was not published');
        return this.payload(response);
      }
      case 'notification.cancel': {
        const response = await this.requireNotification(type).cancel({ id: payload['id'] as string });
        this.requireTrue(type, response.cancelled, 'notification was not cancelled');
        return this.payload(response);
      }
      case 'share.invoke': {
        const response = await this.requireShare(type).invoke(payload as Object as HostShareInvokeRequest);
        this.requireTrue(type, response.shared, 'share panel was not shown');
        return this.payload(response);
      }
      case 'clipboard.copy':
      case 'clipboard.write': {
        const response = await this.options.clipboardAdapter.copy({ text: payload['text'] as string });
        this.requireTrue(type, response.copied, 'clipboard write was not acknowledged');
        return type === 'clipboard.write'
          ? this.platformResult({ written: true }) : this.payload(response);
      }
      case 'clipboard.paste':
      case 'clipboard.read': return this.payload(await this.options.clipboardAdapter.paste());
      case 'device.vibrate': {
        const response = await this.options.deviceAdapter.vibrate({
          durationMs: payload['durationMs'] as number | undefined,
        });
        this.requireTrue(type, response.vibrated, 'vibrator did not accept the effect');
        return this.payload(response);
      }
      case 'device.screen.keep-on': {
        const response = await this.requireScreen(type).keepOn({ enabled: payload['enabled'] as boolean });
        return this.payload(response);
      }
      case 'device.screen.release': {
        const response = await this.requireScreen(type).release();
        this.requireTrue(type, response.released, 'keep-screen-on flag was not released');
        return this.payload(response);
      }
      case 'file.select': {
        const mimeTypes = payload['mimeTypes'] === undefined
          ? ['*/*'] : payload['mimeTypes'] as Object as string[];
        const response = await this.requireFileSelection(type).select(
          mimeTypes,
          payload['allowsMultiple'] === true,
        );
        return this.payload(response);
      }
      case 'font.registerFile': {
        const response = await this.requireFont(type).registerFile(
          payload['path'] as string,
          payload['familyName'] as string | undefined,
        );
        this.requireTrue(type, response.registered, 'font was not registered');
        return this.payload(response);
      }
      case 'font.unregisterFile': {
        const response = this.requireFont(type).unregisterFile(
          payload['path'] as string,
          payload['familyName'] as string,
        );
        this.requireTrue(type, response.logicalUnregistered, 'font was not logically unregistered');
        return this.payload(response);
      }
      case 'brightness.set': {
        const brightness = await this.requireScreen(type).setBrightness(payload['value'] as number);
        return this.platformResult({ brightness: brightness });
      }
      case 'brightness.get': {
        const brightness = await this.requireScreen(type).getBrightness();
        return this.platformResult({ brightness: brightness });
      }
      case 'screen.keepAwake': {
        const response = await this.requireScreen(type).keepOn({ enabled: true });
        this.requireTrue(type, response.enabled, 'keep-screen-on flag was not applied');
        return this.platformResult({ applied: true, keepAwake: true });
      }
      case 'screen.allowSleep': {
        const response = await this.requireScreen(type).release();
        this.requireTrue(type, response.released, 'keep-screen-on flag was not released');
        return this.platformResult({ applied: true, keepAwake: false });
      }
      case 'haptics.light': return this.haptic(type, 'light');
      case 'haptics.medium': return this.haptic(type, 'medium');
      case 'haptics.heavy': return this.haptic(type, 'heavy');
      case 'network.status': return this.payload(await this.options.networkAdapter.status());
      case 'webdav.connect': {
        const response = await this.requireWebDav(type).connect(
          this.webDavOverride(payload),
          payload['url'] as string | undefined,
        );
        this.requireTrue(type, response.connected, 'WebDAV did not return HTTP 207');
        return this.payload(response);
      }
      case 'webdav.backup': {
        const response = await this.requireWebDav(type).backup(this.webDavOverride(payload));
        this.requireTrue(type, response.backedUp, 'WebDAV backup was not stored');
        return this.payload(response);
      }
      case 'webdav.restore': {
        const response = await this.requireWebDav(type).restore(
          payload['remoteURL'] as string,
          this.webDavOverride(payload),
        );
        this.requireTrue(type, response.restored && response.applied, 'Core backup was not applied');
        return this.payload(response);
      }
      case 'share.text': {
        const response = await this.requireShare(type).invoke({ text: payload['text'] as string });
        this.requireTrue(type, response.shared, 'share panel was not shown');
        return this.payload(response);
      }
      case 'share.file': {
        const path = payload['path'] as string;
        const response = await this.requireShare(type).invoke({ files: [path] });
        this.requireTrue(type, response.shared, 'share panel was not shown');
        return this.platformResult({ shared: true, path: path });
      }
      case 'background.task.start': {
        const response = this.options.backgroundAdapter.startTask(payload['name'] as string);
        this.requireTrue(type, response.started, 'transient background lease was not acquired');
        return this.payload(response);
      }
      case 'background.task.end': {
        const taskId = payload['taskId'] as string;
        const ended = this.options.backgroundAdapter.endTask(taskId);
        this.requireTrue(type, ended, 'background task is not active');
        return this.platformResult({ ended: true, taskId: taskId });
      }
      default:
        throw new ReaderUiHostFailure('CONTRACT_DRIFT', `${type} has no HarmonyOS executor`);
    }
  }

  private cookieFromFlatPayload(payload: ReaderUiHostPayload): HostCookieRecord {
    const cookie: HostCookieRecord = {
      name: payload['name'] as string,
      value: payload['value'] as string,
    };
    if (typeof payload['domain'] === 'string') cookie.domain = payload['domain'] as string;
    if (typeof payload['path'] === 'string') cookie.path = payload['path'] as string;
    return cookie;
  }

  private ttsStartRequest(payload: ReaderUiHostPayload): HostTtsSystemStartRequest {
    const result: HostTtsSystemStartRequest = { text: payload['text'] as string };
    if (typeof payload['rate'] === 'number') result.rate = payload['rate'] as number;
    if (typeof payload['pitch'] === 'number') result.pitch = payload['pitch'] as number;
    if (typeof payload['voice'] === 'string') result.voice = payload['voice'] as string;
    if (typeof payload['language'] === 'string') result.voice = payload['language'] as string;
    return result;
  }

  private webDavOverride(payload: ReaderUiHostPayload): ReaderWebDavCredentials | undefined {
    if (payload['serverURL'] === undefined) return undefined;
    return {
      serverURL: payload['serverURL'] as string,
      username: payload['username'] as string,
      password: payload['password'] as string,
    };
  }

  private async haptic(type: HostRequestType,
    style: 'light' | 'medium' | 'heavy'): Promise<ReaderUiHostPayload> {
    const performed = await this.options.deviceAdapter.haptic(style);
    this.requireTrue(type, performed, 'vibrator did not accept the haptic effect');
    return this.platformResult({ performed: true, style: style });
  }

  private platformResult(value: ReaderUiPlatformResult): ReaderUiHostPayload {
    return value as Object as ReaderUiHostPayload;
  }

  private payload(value: Object): ReaderUiHostPayload {
    return value as Object as ReaderUiHostPayload;
  }

  private requireTrue(type: HostRequestType, value: boolean, message: string): void {
    if (!value) throw new ReaderUiHostFailure('EXECUTION_FAILED', `${type}: ${message}`, true);
  }

  private unavailable(type: HostRequestType, message: string): never {
    throw new ReaderUiHostFailure('CAPABILITY_UNAVAILABLE', `${type}: ${message}`);
  }

  private requireFile(type: HostRequestType): FileHostAdapter {
    return this.options.fileAdapter ?? this.unavailable(type, 'application context is missing');
  }

  private requireCredential(type: HostRequestType): CredentialHostAdapter {
    return this.options.credentialAdapter ?? this.unavailable(type, 'UIAbilityContext is missing');
  }

  private requirePermission(type: HostRequestType): PermissionHostAdapter {
    return this.options.permissionAdapter ?? this.unavailable(type, 'UIAbilityContext is missing');
  }

  private requireNotification(type: HostRequestType): NotificationHostAdapter {
    return this.options.notificationAdapter ?? this.unavailable(type, 'UIAbilityContext is missing');
  }

  private requireShare(type: HostRequestType): ShareHostAdapter {
    return this.options.shareAdapter ?? this.unavailable(type, 'UIAbilityContext is missing');
  }

  private requireScreen(type: HostRequestType): ScreenHostAdapter {
    return this.options.screenAdapter ?? this.unavailable(type, 'UIAbilityContext is missing');
  }

  private requireFileSelection(type: HostRequestType): FileSelectionHostAdapter {
    return this.options.fileSelectionAdapter ?? this.unavailable(type, 'UIAbilityContext is missing');
  }

  private requireFont(type: HostRequestType): FontHostAdapter {
    return this.options.fontAdapter ?? this.unavailable(type, 'UIAbilityContext is missing');
  }

  private requireWebDav(type: HostRequestType): WebDavHostAdapter {
    return this.options.webDavAdapter ?? this.unavailable(type, 'credentials or Core storage are unavailable');
  }
}
