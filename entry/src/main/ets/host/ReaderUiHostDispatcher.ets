// Exact Reader UI HostRequest 1.2.0 dispatcher. The generated table owns wire
// identity; this layer owns runtime DTO validation and fail-closed routing.
import {
  HostRequestTable,
  type HostRequestType,
} from '../contract/generated/HostRequestTable';
import {
  ReaderUiHostFailure,
  type ReaderUiHostPayload,
  type ReaderUiHostPlatform,
  type ReaderUiHostRequest,
  type ReaderUiHostResponse,
} from './ReaderUiHostContract';
import { HostErrorWrapper } from './types';

const HTTP_METHODS: string[] = [
  'GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH',
  'PROPFIND', 'MKCOL', 'MOVE', 'COPY',
];

export class ReaderUiHostDispatcher {
  private platform: ReaderUiHostPlatform;

  constructor(platform: ReaderUiHostPlatform) {
    this.platform = platform;
    if (HostRequestTable.SCHEMA_VERSION !== '1.2.0' || HostRequestTable.ALL.length !== 58) {
      throw new ReaderUiHostFailure('CONTRACT_DRIFT',
        `HostRequest 1.2.0 requires exactly 58 types; got ${HostRequestTable.ALL.length}`);
    }
  }

  registeredTypes(): HostRequestType[] {
    return HostRequestTable.ALL.slice();
  }

  async dispatch(request: ReaderUiHostRequest): Promise<ReaderUiHostResponse> {
    if (!HostRequestTable.has(request.type)) {
      throw new ReaderUiHostFailure('UNKNOWN_CAPABILITY',
        `Unknown Reader UI HostRequest type: ${request.type}`);
    }
    const type = request.type as HostRequestType;
    const rawPayload = request.payload as Object;
    if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', `${type} payload must be an object`);
    }
    if (request.requestId !== undefined && request.requestId.trim().length === 0) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', `${type} requestId must not be blank`);
    }
    if (request.correlationId !== undefined && request.correlationId.trim().length === 0) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', `${type} correlationId must not be blank`);
    }
    const payload = rawPayload as ReaderUiHostPayload;
    this.validate(type, payload, request);
    if (!this.platform.isAvailable(type)) {
      throw new ReaderUiHostFailure('CAPABILITY_UNAVAILABLE',
        `${type} is not available in the current HarmonyOS context`);
    }
    let result: ReaderUiHostPayload;
    try {
      result = await this.platform.execute(type, payload, request);
    } catch (e) {
      if (e instanceof ReaderUiHostFailure) throw e;
      if (e instanceof HostErrorWrapper) {
        throw new ReaderUiHostFailure(
          e.hostError.code,
          `${type} failed: ${e.hostError.message}`,
          e.hostError.retryable,
        );
      }
      const message = e instanceof Error ? e.message : String(e);
      throw new ReaderUiHostFailure('EXECUTION_FAILED', `${type} failed: ${message}`, true);
    }
    const rawResult = result as Object;
    if (rawResult === null || typeof rawResult !== 'object' || Array.isArray(rawResult)) {
      throw new ReaderUiHostFailure('INVALID_RESULT', `${type} returned a non-object result`);
    }
    const response: ReaderUiHostResponse = { type: type, result: result };
    if (request.requestId !== undefined) response.requestId = request.requestId;
    if (request.correlationId !== undefined) response.correlationId = request.correlationId;
    return response;
  }

  private validate(type: HostRequestType, payload: ReaderUiHostPayload,
    request: ReaderUiHostRequest): void {
    this.optionalGeneration(payload);
    switch (type) {
      case 'http.execute': {
        this.httpUrl(payload, 'url', type);
        const rawMethod = this.requiredString(payload, 'method');
        const method = rawMethod.toUpperCase();
        if (rawMethod !== method) this.invalid(type, 'method must use the canonical uppercase wire value');
        if (HTTP_METHODS.indexOf(method) < 0) this.invalid(type, 'method is unsupported');
        const headers = this.optionalObject(payload, 'headers');
        if (headers !== undefined) this.validateStringMap(headers, type, 'headers');
        this.optionalString(payload, 'body', true);
        this.optionalBoolean(payload, 'followRedirects');
        const maxRedirects = this.optionalNumber(payload, 'maxRedirects');
        if (maxRedirects !== undefined && (!Number.isInteger(maxRedirects) || maxRedirects < 0)) {
          this.invalid(type, 'maxRedirects must be a non-negative integer');
        }
        this.optionalString(payload, 'sessionId');
        return;
      }
      case 'http.cancel': {
        const target = this.optionalString(payload, 'requestId');
        if ((target === undefined || target.length === 0) && request.requestId === undefined) {
          this.invalid(type, 'requestId is required');
        }
        return;
      }
      case 'webview.open': this.httpUrl(payload, 'url', type); this.optionalString(payload, 'profileId'); return;
      case 'webview.close': this.optionalString(payload, 'profileId'); return;
      case 'webview.evaluate': this.requiredString(payload, 'script'); this.optionalString(payload, 'profileId'); return;
      case 'cookie.get':
        this.optionalString(payload, 'url'); this.optionalString(payload, 'domain');
        this.optionalString(payload, 'name'); this.optionalString(payload, 'sessionId'); return;
      case 'cookie.set': this.validateCookieSet(payload, type); return;
      case 'cookie.clear':
        this.optionalString(payload, 'url'); this.optionalString(payload, 'domain');
        this.optionalString(payload, 'sessionId'); return;
      case 'file.read': {
        this.requiredString(payload, 'path');
        this.optionalString(payload, 'encoding');
        const byteOffset = this.optionalNumber(payload, 'byteOffset');
        const maxBytes = this.optionalNumber(payload, 'maxBytes');
        if (byteOffset !== undefined && (!Number.isInteger(byteOffset) || byteOffset < 0)) {
          this.invalid(type, 'byteOffset must be a non-negative integer');
        }
        if (maxBytes !== undefined && (!Number.isInteger(maxBytes) || maxBytes < 1)) {
          this.invalid(type, 'maxBytes must be a positive integer');
        }
        return;
      }
      case 'file.write': this.validateFileWrite(payload, type); return;
      case 'file.delete': this.requiredString(payload, 'path'); return;
      case 'storage.path': {
        const scope = this.requiredString(payload, 'scope');
        if (scope !== 'cache' && scope !== 'files' && scope !== 'external') {
          this.invalid(type, 'scope must be cache, files, or external');
        }
        return;
      }
      case 'persistence.get':
        this.exactPayloadKeys(payload, ['namespace', 'key'], type);
        this.requiredString(payload, 'namespace');
        this.requiredString(payload, 'key');
        return;
      case 'persistence.put': {
        this.exactPayloadKeys(payload, ['namespace', 'key', 'value', 'expectedRevision'], type);
        this.requiredString(payload, 'namespace');
        this.requiredString(payload, 'key');
        this.requiredString(payload, 'value');
        const expectedRevision = this.requiredString(payload, 'expectedRevision');
        if (!/^(0|[1-9]\d*)$/.test(expectedRevision)) {
          this.invalid(type, 'expectedRevision must be a non-negative decimal string');
        }
        return;
      }
      case 'credential.get':
      case 'credential.delete': this.requiredString(payload, 'key'); return;
      case 'credential.set':
        this.requiredString(payload, 'key'); this.requiredString(payload, 'value', true); return;
      case 'tts.system.start': this.validateTtsSystem(payload, type); return;
      case 'tts.system.stop':
      case 'tts.system.pause':
      case 'tts.system.resume': return;
      case 'permission.request':
      case 'permission.check': this.requiredString(payload, 'scope'); return;
      case 'background.schedule':
        this.requiredString(payload, 'taskId'); this.optionalNonNegativeNumber(payload, 'delayMs'); return;
      case 'background.cancel': this.requiredString(payload, 'taskId'); return;
      case 'timer.foreground.arm':
      case 'timer.foreground.cancel': this.validateForegroundTimer(payload, type); return;
      case 'notification.show':
        this.requiredString(payload, 'id'); this.requiredString(payload, 'title');
        this.requiredString(payload, 'body', true); return;
      case 'notification.cancel': this.requiredString(payload, 'id'); return;
      case 'share.invoke': this.validateShareInvoke(payload, type); return;
      case 'clipboard.copy': this.requiredString(payload, 'text', true); return;
      case 'clipboard.paste': return;
      case 'device.vibrate': this.optionalPositiveNumber(payload, 'durationMs'); return;
      case 'device.screen.keep-on': this.requiredBoolean(payload, 'enabled'); return;
      case 'device.screen.release': return;
      case 'file.select': this.validateFileSelect(payload, type); return;
      case 'font.registerFile': this.validateFont(payload, type); return;
      case 'font.unregisterFile':
        this.exactPayloadKeys(payload, ['path', 'familyName'], type);
        this.validateFontPath(payload, type);
        this.requiredString(payload, 'familyName');
        return;
      case 'clipboard.read': return;
      case 'clipboard.write': this.requiredString(payload, 'text', true); return;
      case 'tts.start': this.validateTts25(payload, type); return;
      case 'tts.stop':
      case 'tts.pause': return;
      case 'brightness.set': {
        const value = this.requiredNumber(payload, 'value');
        if (value < 0 || value > 1) this.invalid(type, 'value must be within 0...1');
        return;
      }
      case 'brightness.get':
      case 'screen.keepAwake':
      case 'screen.allowSleep':
      case 'haptics.light':
      case 'haptics.medium':
      case 'haptics.heavy':
      case 'network.status': return;
      case 'webdav.connect': this.validateWebDavConnect(payload, type); return;
      case 'webdav.backup': this.validateWebDavOverride(payload, type); return;
      case 'webdav.restore':
        this.httpUrl(payload, 'remoteURL', type); this.validateWebDavOverride(payload, type); return;
      case 'share.text': this.requiredString(payload, 'text'); return;
      case 'share.file': this.requiredString(payload, 'path'); return;
      case 'background.task.start': {
        const name = this.requiredString(payload, 'name');
        if (name.length > 128) this.invalid(type, 'name must contain at most 128 characters');
        return;
      }
      case 'background.task.end': this.requiredString(payload, 'taskId'); return;
      default:
        throw new ReaderUiHostFailure('CONTRACT_DRIFT', `${type} has no DTO validator`);
    }
  }

  private validateCookieSet(payload: ReaderUiHostPayload, type: HostRequestType): void {
    const cookie = payload['cookie'];
    if (cookie !== undefined) {
      if (cookie === null || typeof cookie !== 'object' || Array.isArray(cookie)) {
        this.invalid(type, 'cookie must be an object');
      }
      const fields = cookie as Object as ReaderUiHostPayload;
      this.requiredString(fields, 'name');
      this.requiredString(fields, 'value', true);
      return;
    }
    this.requiredString(payload, 'name');
    this.requiredString(payload, 'value', true);
  }

  private validateFileWrite(payload: ReaderUiHostPayload, type: HostRequestType): void {
    this.requiredString(payload, 'path');
    const content = payload['content'];
    const contentBase64 = payload['contentBase64'];
    const hasContent = typeof content === 'string';
    const hasContentBase64 = typeof contentBase64 === 'string';
    if (hasContent === hasContentBase64) {
      this.invalid(type, 'exactly one of content or contentBase64 is required');
    }
    this.optionalString(payload, 'encoding');
    this.optionalBoolean(payload, 'createDirectories');
    this.optionalBoolean(payload, 'append');
  }

  private validateTtsSystem(payload: ReaderUiHostPayload, type: HostRequestType): void {
    this.requiredString(payload, 'text');
    const rate = this.optionalNumber(payload, 'rate');
    const pitch = this.optionalNumber(payload, 'pitch');
    if (rate !== undefined && (rate < 0.1 || rate > 4)) this.invalid(type, 'rate must be within 0.1...4');
    if (pitch !== undefined && (pitch < 0.5 || pitch > 2)) this.invalid(type, 'pitch must be within 0.5...2');
    this.optionalString(payload, 'voice');
  }

  private validateForegroundTimer(payload: ReaderUiHostPayload, type: HostRequestType): void {
    const timerId = this.requiredString(payload, 'timerId');
    const correlationId = this.requiredString(payload, 'correlationId');
    const delayMs = this.requiredNumber(payload, 'delayMs');
    const generation = this.requiredNumber(payload, 'generation');
    if (timerId !== correlationId || !Number.isInteger(delayMs) || delayMs < 250 || delayMs > 3600000 ||
      !Number.isInteger(generation) || generation < 0 || this.requiredBoolean(payload, 'oneShot') !== true ||
      this.requiredBoolean(payload, 'foregroundOnly') !== true) {
      this.invalid(type, 'foreground timer invariants are invalid');
    }
  }

  private validateShareInvoke(payload: ReaderUiHostPayload, type: HostRequestType): void {
    const text = this.optionalString(payload, 'text', true);
    const url = this.optionalString(payload, 'url');
    const files = this.optionalStringArray(payload, 'files');
    this.optionalString(payload, 'title', true);
    if ((text === undefined || text.length === 0) && url === undefined &&
      (files === undefined || files.length === 0)) {
      this.invalid(type, 'text, url, or files is required');
    }
  }

  private validateFileSelect(payload: ReaderUiHostPayload, type: HostRequestType): void {
    const mimeTypes = this.optionalStringArray(payload, 'mimeTypes');
    if (mimeTypes !== undefined) {
      if (mimeTypes.length < 1 || mimeTypes.length > 32) this.invalid(type, 'mimeTypes requires 1..32 values');
      for (let i = 0; i < mimeTypes.length; i++) {
        if (mimeTypes[i].trim().length === 0 || mimeTypes[i].indexOf('/') <= 0) {
          this.invalid(type, 'mimeTypes contains an invalid MIME type');
        }
      }
    }
    this.optionalBoolean(payload, 'allowsMultiple');
  }

  private validateFont(payload: ReaderUiHostPayload, type: HostRequestType): void {
    this.validateFontPath(payload, type);
    this.optionalString(payload, 'familyName');
  }

  private validateFontPath(payload: ReaderUiHostPayload, type: HostRequestType): void {
    const path = this.requiredString(payload, 'path');
    const lower = path.toLowerCase();
    if (!lower.endsWith('.ttf') && !lower.endsWith('.otf') && !lower.endsWith('.ttc')) {
      this.invalid(type, 'path must identify a .ttf, .otf, or .ttc file');
    }
  }

  private exactPayloadKeys(payload: ReaderUiHostPayload, expected: string[], type: HostRequestType): void {
    const actual = Object.keys(payload);
    if (actual.length !== expected.length) this.invalid(type, 'payload has missing or unknown fields');
    for (let i = 0; i < actual.length; i++) {
      if (expected.indexOf(actual[i]) < 0) this.invalid(type, `payload field ${actual[i]} is not allowed`);
    }
  }

  private validateTts25(payload: ReaderUiHostPayload, type: HostRequestType): void {
    this.requiredString(payload, 'text');
    const rate = this.optionalNumber(payload, 'rate');
    const pitch = this.optionalNumber(payload, 'pitch');
    if (rate !== undefined && (rate < 0.1 || rate > 4)) this.invalid(type, 'rate must be within 0.1...4');
    if (pitch !== undefined && (pitch < 0.5 || pitch > 2)) this.invalid(type, 'pitch must be within 0.5...2');
    this.optionalString(payload, 'language');
  }

  private validateWebDavConnect(payload: ReaderUiHostPayload, type: HostRequestType): void {
    this.validateWebDavOverride(payload, type);
    const url = this.optionalString(payload, 'url');
    if (url !== undefined) {
      this.ensureHttpString(url, type, 'url');
      if (payload['serverURL'] !== undefined) this.invalid(type, 'url and serverURL are mutually exclusive');
    }
  }

  private validateWebDavOverride(payload: ReaderUiHostPayload, type: HostRequestType): void {
    const keys: string[] = ['serverURL', 'username', 'password'];
    let present = 0;
    for (let i = 0; i < keys.length; i++) if (payload[keys[i]] !== undefined) present += 1;
    if (present !== 0 && present !== 3) {
      this.invalid(type, 'serverURL, username, and password must be provided together');
    }
    if (present === 3) {
      this.httpUrl(payload, 'serverURL', type);
      this.requiredString(payload, 'username', true);
      this.requiredString(payload, 'password', true);
    }
  }

  private optionalGeneration(payload: ReaderUiHostPayload): void {
    const generation = this.optionalNumber(payload, 'generation');
    if (generation !== undefined && (!Number.isInteger(generation) || generation < 0)) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', 'generation must be a non-negative integer');
    }
  }

  private httpUrl(payload: ReaderUiHostPayload, key: string, type: HostRequestType): string {
    const value = this.requiredString(payload, key);
    this.ensureHttpString(value, type, key);
    return value;
  }

  private validateStringMap(value: ReaderUiHostPayload, type: HostRequestType, key: string): void {
    const names = Object.keys(value);
    for (let i = 0; i < names.length; i++) {
      if (typeof value[names[i]] !== 'string') this.invalid(type, `${key} values must be strings`);
    }
  }

  private ensureHttpString(value: string, type: HostRequestType, key: string): void {
    const lower = value.toLowerCase();
    if ((!lower.startsWith('https://') && !lower.startsWith('http://')) || value.indexOf(' ') >= 0) {
      this.invalid(type, `${key} must be an absolute http(s) URL`);
    }
  }

  private requiredString(payload: ReaderUiHostPayload, key: string,
    allowEmpty: boolean = false): string {
    const value = payload[key];
    if (typeof value !== 'string') throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be a string`);
    if (!allowEmpty && value.trim().length === 0) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must not be blank`);
    }
    return value;
  }

  private optionalString(payload: ReaderUiHostPayload, key: string,
    allowEmpty: boolean = false): string | undefined {
    const value = payload[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be a string`);
    if (!allowEmpty && value.trim().length === 0) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must not be blank`);
    }
    return value;
  }

  private requiredNumber(payload: ReaderUiHostPayload, key: string): number {
    const value = payload[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be a finite number`);
    }
    return value;
  }

  private optionalNumber(payload: ReaderUiHostPayload, key: string): number | undefined {
    const value = payload[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be a finite number`);
    }
    return value;
  }

  private optionalNonNegativeNumber(payload: ReaderUiHostPayload, key: string): void {
    const value = this.optionalNumber(payload, key);
    if (value !== undefined && value < 0) throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be >= 0`);
  }

  private optionalPositiveNumber(payload: ReaderUiHostPayload, key: string): void {
    const value = this.optionalNumber(payload, key);
    if (value !== undefined && value <= 0) throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be > 0`);
  }

  private requiredBoolean(payload: ReaderUiHostPayload, key: string): boolean {
    const value = payload[key];
    if (typeof value !== 'boolean') throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be a boolean`);
    return value;
  }

  private optionalBoolean(payload: ReaderUiHostPayload, key: string): boolean | undefined {
    const value = payload[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be a boolean`);
    return value;
  }

  private optionalObject(payload: ReaderUiHostPayload, key: string): ReaderUiHostPayload | undefined {
    const value = payload[key];
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be an object`);
    }
    return value as Object as ReaderUiHostPayload;
  }

  private optionalStringArray(payload: ReaderUiHostPayload, key: string): string[] | undefined {
    const value = payload[key];
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be a string array`);
    const raw = value as Object[];
    const result: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      if (typeof raw[i] !== 'string') throw new ReaderUiHostFailure('INVALID_PARAMS', `${key} must be a string array`);
      result.push(raw[i] as string);
    }
    return result;
  }

  private invalid(type: HostRequestType, message: string): never {
    throw new ReaderUiHostFailure('INVALID_PARAMS', `${type} ${message}`);
  }
}
