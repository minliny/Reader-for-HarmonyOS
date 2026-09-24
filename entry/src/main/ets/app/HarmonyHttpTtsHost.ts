import { audio } from '@kit.AudioKit';
import { media } from '@kit.MediaKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from './ErrorMessage.ts';
import {
  type ReaderTtsHost,
  type ReaderTtsHostEvent,
  type ReaderTtsHostProbe,
  type ReaderTtsHostSpeakRequest,
} from '../features/reading/ReaderTtsSessionCoordinator';
import {
  ReaderHttpTtsGateway,
  type ReaderHttpTtsRuntime,
  type ReaderHttpTtsRequestDescriptor,
} from '../features/reading/ReaderHttpTtsGateway';
import { isReaderTtsCredentialAliasForConfig } from '../features/reading/ReaderOnlineTtsProfile';
import { ReaderTtsCredentialStore } from './ReaderTtsCredentialStore';
import { HttpExecuteHost } from './HttpExecuteHost';
import { isCrossOriginSensitiveHeader } from './HttpTransportPolicy';

const LOG_DOMAIN = 0x5244;
const HTTP_TTS_ENGINE_PREFIX = 'http-tts:';
const HTTP_TTS_MAX_REDIRECTS = 10;
const HTTP_TTS_MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const HTTP_TTS_MAX_URL_LENGTH = 2 * 1024 * 1024;
const HTTP_TTS_MAX_HEADER_VALUE_LENGTH = 64 * 1024;
const HTTP_TTS_PCM_SAMPLE_RATES: number[] = [8000, 16000, 22050, 24000, 32000, 44100, 48000];

type PrefetchedTtsAudio = {
  key: string;
  descriptor: Promise<ReaderHttpTtsRequestDescriptor>;
  audio: Promise<Uint8Array>;
};

/** Host-only network/audio transport for a Core-owned HttpTTS descriptor. */
export class HarmonyHttpTtsHost implements ReaderTtsHost {
  private readonly gateway: ReaderHttpTtsGateway;
  private audioSessionManager: audio.AudioSessionManager | undefined = undefined;
  private readonly audioSessionDeactivatedCallback: (event: audio.AudioSessionDeactivatedEvent) => void;
  private readonly audioSessionStateChangedCallback: (event: audio.AudioSessionStateChangedEvent) => void;
  private readonly outputDeviceChangedCallback: (event: audio.CurrentOutputDeviceChangedEvent) => void;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;
  private listenerOwner: string | undefined = undefined;
  private player: media.AVPlayer | undefined = undefined;
  private networkGeneration: number = 0;
  private configId: number | undefined = undefined;
  private currentRequestId: string | undefined = undefined;
  private audioBytes: Uint8Array | undefined = undefined;
  private prefetchedAudio: PrefetchedTtsAudio | undefined = undefined;
  private speakGeneration: number = 0;
  private startReported: boolean = false;
  private audioListenersInstalled: boolean = false;
  private audioSessionActive: boolean = false;
  private audioSessionAllowMixing: boolean | undefined = undefined;
  private closed: boolean = false;

  constructor(runtime: ReaderHttpTtsRuntime) {
    this.gateway = new ReaderHttpTtsGateway(runtime);
    this.audioSessionDeactivatedCallback = (_event: audio.AudioSessionDeactivatedEvent): void => {
      this.emit({ type: 'interruption', action: 'stop' });
    };
    this.audioSessionStateChangedCallback = (event: audio.AudioSessionStateChangedEvent): void => {
      this.handleAudioStateHint(event.stateChangeHint);
    };
    this.outputDeviceChangedCallback = (event: audio.CurrentOutputDeviceChangedEvent): void => {
      const action = event.recommendedAction ===
        audio.OutputDeviceChangeRecommendedAction.DEVICE_CHANGE_RECOMMEND_TO_STOP ? 'stop' : 'continue';
      this.emit({ type: 'deviceChange', action });
    };
  }

  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined, owner: string): void {
    this.listener = listener;
    this.listenerOwner = owner;
  }

  clearEventListener(owner: string): void {
    if (this.listenerOwner !== owner) return;
    this.listener = undefined;
    this.listenerOwner = undefined;
  }

  async selectEngine(engine?: string): Promise<boolean> {
    this.cancelActiveRequest('Reader HttpTTS engine selection changed');
    if (engine === undefined || !engine.startsWith(HTTP_TTS_ENGINE_PREFIX)) return false;
    const idText = engine.slice(HTTP_TTS_ENGINE_PREFIX.length);
    const id = Number(idText);
    if (!Number.isSafeInteger(id) || id < 0 || `${id}` !== idText) {
      this.configId = undefined;
      return false;
    }
    this.configId = id;
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return (await this.probe()).available;
  }

  async probe(): Promise<ReaderTtsHostProbe> {
    if (this.closed) return { available: false, reason: '在线朗读服务已关闭' };
    if (this.configId === undefined) return { available: false, reason: '在线 TTS 引擎未选择有效配置' };
    try {
      const config = await this.gateway.get(this.configId);
      if (config === undefined) {
        return { available: false, reason: `在线 TTS 配置 ${this.configId} 不存在或已删除` };
      }
      return { available: true };
    } catch (error) {
      this.logError('HttpTTS config probe failed', error);
      return { available: false, reason: `在线 TTS 配置探测失败：${errorMessageOf(error)}` };
    }
  }

  async activateAudioSession(allowMixing: boolean): Promise<void> {
    this.assertOpen();
    let audioSessionManager = this.audioSessionManager;
    if (audioSessionManager === undefined) {
      audioSessionManager = audio.getAudioManager().getSessionManager();
      this.audioSessionManager = audioSessionManager;
    }
    this.installAudioListeners();
    if (this.audioSessionActive && this.audioSessionAllowMixing === allowMixing) return;
    audioSessionManager.setAudioSessionScene(audio.AudioSessionScene.AUDIO_SESSION_SCENE_MEDIA);
    const concurrencyMode = allowMixing
      ? audio.AudioConcurrencyMode.CONCURRENCY_MIX_WITH_OTHERS
      : audio.AudioConcurrencyMode.CONCURRENCY_PAUSE_OTHERS;
    await audioSessionManager.activateAudioSession({ concurrencyMode });
    this.audioSessionActive = true;
    this.audioSessionAllowMixing = allowMixing;
  }

  async deactivateAudioSession(): Promise<void> {
    if (!this.audioSessionActive) return;
    const audioSessionManager = this.audioSessionManager;
    if (audioSessionManager === undefined) return;
    try {
      await audioSessionManager.deactivateAudioSession();
    } finally {
      this.audioSessionActive = false;
      this.audioSessionAllowMixing = undefined;
    }
  }

  async speak(request: ReaderTtsHostSpeakRequest): Promise<void> {
    this.assertOpen();
    const generation = ++this.speakGeneration;
    const configId = this.configId;
    if (configId === undefined) throw new Error('Reader HttpTTS has no selected Core config');
    if (request.requestId.trim().length === 0 || request.text.trim().length === 0) {
      throw new Error('Reader HttpTTS requires requestId and text');
    }
    const candidate = this.prefetchedAudio;
    this.prefetchedAudio = undefined;
    const usePrefetch = candidate !== undefined && candidate.key === this.prefetchKey(request, configId);
    if (!usePrefetch) this.cancelActiveRequest('Reader HttpTTS audio request superseded');
    const ratePercent = Math.max(50, Math.min(200, Math.round(request.rate * 20) * 5));
    const descriptor = await this.gateway.buildRequest(configId, request.text, ratePercent);
    if (this.closed || generation !== this.speakGeneration) return;
    let bytes: Uint8Array;
    if (usePrefetch && candidate !== undefined) {
      let matches = false;
      try {
        matches = JSON.stringify(await candidate.descriptor) === JSON.stringify(descriptor);
      } catch (_) {
        // A failed lookahead is retried through the ordinary request path.
      }
      if (this.closed || generation !== this.speakGeneration) return;
      if (matches) {
        try {
          bytes = await candidate.audio;
        } catch (_) {
          if (this.closed || generation !== this.speakGeneration) return;
          this.cancelActiveRequest('Reader HttpTTS audio prefetch failed');
          bytes = await this.fetchAudio(descriptor, configId);
        }
      } else {
        this.cancelActiveRequest('Reader HttpTTS audio descriptor changed');
        bytes = await this.fetchAudio(descriptor, configId);
      }
    } else {
      bytes = await this.fetchAudio(descriptor, configId);
    }
    if (this.closed || generation !== this.speakGeneration) return;
    await this.releasePlayer();
    if (this.closed || generation !== this.speakGeneration) return;
    const player = await media.createAVPlayer();
    if (this.closed || generation !== this.speakGeneration) {
      await player.release();
      return;
    }
    this.player = player;
    this.currentRequestId = request.requestId;
    this.startReported = false;
    player.on('stateChange', (state: media.AVPlayerState): void => {
      this.handlePlayerState(player, request.requestId, state);
    });
    player.on('error', (error: Error): void => {
      if (this.closed || generation !== this.speakGeneration ||
        this.player !== player || this.currentRequestId !== request.requestId) return;
      this.emit({ type: 'error', requestId: request.requestId, message: error.message });
    });
    try {
      this.audioBytes = bytes;
      player.dataSrc = this.createDataSource(bytes);
      if (this.player !== player || this.currentRequestId !== request.requestId ||
        generation !== this.speakGeneration) return;
      player.audioRendererInfo = {
        usage: audio.StreamUsage.STREAM_USAGE_AUDIOBOOK,
        rendererFlags: 0,
      };
      await player.prepare();
      if (this.closed || generation !== this.speakGeneration ||
        this.player !== player || this.currentRequestId !== request.requestId) return;
      await player.play();
    } catch (error) {
      if (this.player === player && this.currentRequestId === request.requestId) {
        await this.releasePlayer();
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.speakGeneration += 1;
    this.cancelActiveRequest('Reader HttpTTS audio request stopped');
    this.currentRequestId = undefined;
    this.startReported = false;
    await this.releasePlayer();
  }

  /** At most one next sentence is retained (bounded by the normal 16 MiB
   * audio response limit). The next speak rechecks Core's descriptor before
   * consuming it so a changed profile cannot play a stale request. */
  prefetchNext(request: ReaderTtsHostSpeakRequest): void {
    const configId = this.configId;
    if (this.closed || configId === undefined || request.text.trim().length === 0) return;
    const key = this.prefetchKey(request, configId);
    if (this.prefetchedAudio?.key === key) return;
    this.cancelActiveRequest('Reader HttpTTS prefetch replaced');
    const admittedGeneration = this.networkGeneration;
    const ratePercent = Math.max(50, Math.min(200, Math.round(request.rate * 20) * 5));
    const descriptor = this.gateway.buildRequest(configId, request.text, ratePercent);
    const audio = descriptor.then((resolved: ReaderHttpTtsRequestDescriptor): Promise<Uint8Array> => {
      if (this.closed || admittedGeneration !== this.networkGeneration) {
        throw new Error('Reader HttpTTS prefetch cancelled');
      }
      return this.fetchAudio(resolved, configId);
    });
    // A speculative network failure must not become an unhandled rejection;
    // speak() retries the request through the normal path if this promise fails.
    void audio.catch((): void => {});
    this.prefetchedAudio = { key, descriptor, audio };
  }

  publishPlaybackState(_state: 'preparing' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error'): void {}

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.speakGeneration += 1;
    this.cancelActiveRequest('Reader HttpTTS audio request closed');
    this.listener = undefined;
    this.currentRequestId = undefined;
    await this.releasePlayer();
    try {
      await this.deactivateAudioSession();
    } catch (error) {
      this.logError('HttpTTS audio session teardown failed', error);
    }
    this.removeAudioListeners();
  }

  private handlePlayerState(player: media.AVPlayer, requestId: string, state: media.AVPlayerState): void {
    if (this.player !== player || this.currentRequestId !== requestId) return;
    if (state === 'playing' && !this.startReported) {
      this.startReported = true;
      this.emit({ type: 'start', requestId });
    } else if (state === 'completed') {
      this.emit({ type: 'complete', requestId, completion: 'audio' });
      if (this.player === player && this.currentRequestId === requestId) void this.releasePlayer();
    } else if (state === 'error') {
      this.emit({ type: 'error', requestId, message: 'Reader HttpTTS AVPlayer entered error state' });
    }
  }

  private async releasePlayer(): Promise<void> {
    const player = this.player;
    this.player = undefined;
    // Detach this owner's reference before awaiting native release. A later
    // utterance may install a new buffer while the old player is stopping.
    this.audioBytes = undefined;
    if (player === undefined) {
      this.audioBytes = undefined;
      return;
    }
    try {
      if (player.state === 'playing' || player.state === 'paused' || player.state === 'prepared' ||
        player.state === 'completed') {
        await player.stop();
      }
    } catch (_) {
      // Release remains mandatory even when the state changed concurrently.
    }
    try {
      await player.release();
    } catch (error) {
      this.logError('HttpTTS AVPlayer release failed', error);
    }
  }

  private async fetchAudio(descriptor: ReaderHttpTtsRequestDescriptor, configId: number): Promise<Uint8Array> {
    const admittedGeneration = this.networkGeneration;
    this.assertSafeDescriptorHeaders(descriptor.headers);
    const resolvedRequest = await this.resolveRequest(descriptor, configId);
    const headers = resolvedRequest.headers;
    if (descriptor.body !== undefined && descriptor.body.includes('{{apiKey}}')) {
      throw new Error('Reader HttpTTS request body contains an unresolved credential placeholder');
    }
    if (descriptor.body !== undefined && descriptor.contentType !== undefined &&
      !Object.keys(headers).some((key: string): boolean => key.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = descriptor.contentType;
    }
    const response = await HttpExecuteHost.instance.executeBytes({
      url: resolvedRequest.url,
      method: descriptor.method,
      headers,
      ...(descriptor.body === undefined ? {} : { body: descriptor.body }),
      followRedirects: true,
      maxRedirects: HTTP_TTS_MAX_REDIRECTS,
      // Core profile URLs are HTTPS-only; enforce the same policy on every
      // redirect hop so a provider cannot silently downgrade audio or
      // credentials to cleartext after the initial validation.
      httpsOnly: true,
      // A credential-bearing URL must never forward its query secret to a
      // different origin through a provider-controlled Location header. The
      // same boundary also covers custom credential headers (for example
      // X-API-Key), which the generic sensitive-header list cannot identify.
      sameOriginRedirectsOnly: descriptor.playback?.credentialRef !== undefined,
    }, HTTP_TTS_MAX_AUDIO_BYTES, undefined, (): boolean => this.closed || admittedGeneration !== this.networkGeneration);
    if (this.closed || admittedGeneration !== this.networkGeneration) {
      throw new Error('Reader HttpTTS audio request cancelled');
    }
    const status = response['status'];
    if (typeof status !== 'number' || status < 200 || status >= 300) {
      throw new Error(`Reader HttpTTS audio request failed with HTTP ${status ?? 'unknown'}`);
    }
    const bytes = response.bytes;
    if (bytes.length === 0 || bytes.length > HTTP_TTS_MAX_AUDIO_BYTES) {
      throw new Error(`Reader HttpTTS audio response size ${bytes.length} is outside the allowed range`);
    }
    return this.normalizeAudioBytes(bytes, descriptor.playback);
  }

  /** Resolve only opaque Core-issued credential aliases; raw secrets never
   * enter Core state, descriptors, or diagnostic logs. */
  private async resolveRequest(
    descriptor: ReaderHttpTtsRequestDescriptor,
    configId: number,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const headers: Record<string, string> = { ...descriptor.headers };
    const playback = descriptor.playback;
    let secret: string | undefined = undefined;
    if (playback?.credentialRef !== undefined) {
      if (!isReaderTtsCredentialAliasForConfig(playback.credentialRef, configId)) {
        throw new Error('Reader HttpTTS credential alias does not belong to the selected config');
      }
      const credentialHeader = playback.credentialHeader?.trim();
      if (credentialHeader !== undefined &&
        (credentialHeader.length === 0 || credentialHeader.length > 128 ||
          !/^[A-Za-z][A-Za-z0-9-]*$/.test(credentialHeader))) {
        throw new Error('Reader HttpTTS credential header is invalid');
      }
      if (typeof playback.credentialPrefix !== 'string' || playback.credentialPrefix.length > 256 ||
        /[\u0000-\u001f\u007f]/.test(playback.credentialPrefix)) {
        throw new Error('Reader HttpTTS credential prefix is invalid');
      }
      const hasPlaceholder = Object.keys(headers).some((key: string): boolean =>
        headers[key].includes('{{apiKey}}'));
      const hasUrlPlaceholder = descriptor.url.includes('{{apiKey}}');
      if ((credentialHeader === undefined || credentialHeader.length === 0) &&
        !hasPlaceholder && !hasUrlPlaceholder) {
        throw new Error('Reader HttpTTS credential header is missing');
      }
      // A tampered Core descriptor may contain a stale Authorization/Cookie
      // alongside the opaque alias. Drop every sensitive duplicate before
      // adding the one authenticated value for this selected config.
      for (const key of Object.keys(headers)) {
        if (isCrossOriginSensitiveHeader(key)) delete headers[key];
      }
      secret = await ReaderTtsCredentialStore.instance.read(playback.credentialRef, configId);
      if (credentialHeader !== undefined && credentialHeader.length > 0) {
        this.deleteHeaderCaseInsensitive(headers, credentialHeader);
        headers[credentialHeader] = `${playback.credentialPrefix ?? ''}${secret}`;
      }
    }
    // Validate the descriptor before expanding placeholders. Core bounds the
    // persisted URL/header strings, but a repeated placeholder can otherwise
    // expand a small descriptor into an unbounded request.
    if (descriptor.url.length > HTTP_TTS_MAX_URL_LENGTH) {
      throw new Error('Reader HttpTTS request URL exceeds the allowed range');
    }
    for (const key of Object.keys(headers)) {
      if (headers[key].includes('{{apiKey}}')) {
        if (secret === undefined) throw new Error('Reader HttpTTS credential placeholder has no secret alias');
        headers[key] = this.expandCredentialPlaceholder(
          headers[key], secret, HTTP_TTS_MAX_HEADER_VALUE_LENGTH,
          'Reader HttpTTS credential header exceeds the allowed range',
        );
      }
    }
    let requestUrl = descriptor.url;
    if (requestUrl.includes('{{apiKey}}')) {
      if (secret === undefined) throw new Error('Reader HttpTTS credential placeholder has no secret alias');
      let encodedSecret: string;
      try {
        // URL query/path placeholders are component values, never raw URL
        // fragments; this also prevents &, # or / in a key changing routing.
        encodedSecret = encodeURIComponent(secret);
      } catch (_) {
        throw new Error('Reader HttpTTS credential cannot be URL-encoded');
      }
      requestUrl = this.expandCredentialPlaceholder(
        requestUrl, encodedSecret, HTTP_TTS_MAX_URL_LENGTH,
        'Reader HttpTTS request URL exceeds the allowed range',
      );
    }
    this.assertSafeDescriptorHeaders(headers);
    return { url: requestUrl, headers };
  }

  private expandCredentialPlaceholder(
    value: string,
    replacement: string,
    maxLength: number,
    failureMessage: string,
  ): string {
    const placeholder = '{{apiKey}}';
    let count = 0;
    let offset = 0;
    while (true) {
      const found = value.indexOf(placeholder, offset);
      if (found < 0) break;
      count += 1;
      offset = found + placeholder.length;
    }
    const expandedLength = value.length + count * (replacement.length - placeholder.length);
    if (!Number.isSafeInteger(expandedLength) || expandedLength > maxLength) {
      throw new Error(failureMessage);
    }
    // Use a replacer callback: String.replace interprets `$&`, `$'`, and
    // similar sequences in a replacement string, so passing a raw secret
    // directly would corrupt or duplicate credential data.
    return count === 0 ? value : value.replace(/\{\{apiKey\}\}/g, (): string => replacement);
  }

  private deleteHeaderCaseInsensitive(headers: Record<string, string>, wanted: string): void {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === wanted.toLowerCase()) delete headers[key];
    }
  }

  private assertSafeDescriptorHeaders(headers: Record<string, string>): void {
    if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
      throw new Error('Reader HttpTTS request headers are invalid');
    }
    for (const key of Object.keys(headers)) {
      const value = headers[key];
      if (key === '__proto__' || key === 'constructor' || key === 'prototype' ||
        key.length > 128 || !/^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/.test(key) ||
        typeof value !== 'string' || value.length > 64 * 1024 ||
        /[\u0000-\u0008\u000a-\u001f\u007f]/.test(value)) {
        throw new Error('Reader HttpTTS request headers are invalid');
      }
    }
  }

  /** AVPlayer consumes containerized audio. Wrap validated s16le PCM in a
   * minimal RIFF/WAVE header so the Core-declared PCM profile is playable. */
  private normalizeAudioBytes(
    bytes: Uint8Array,
    playback: ReaderHttpTtsRequestDescriptor['playback'],
  ): Uint8Array {
    if (playback?.format !== 'pcm') return bytes;
    const sampleRate = playback.sampleRate;
    const channels = playback.channels;
    if (sampleRate === undefined || channels === undefined ||
      !Number.isSafeInteger(sampleRate) || HTTP_TTS_PCM_SAMPLE_RATES.indexOf(sampleRate) < 0 ||
      !Number.isSafeInteger(channels) || (channels !== 1 && channels !== 2) ||
      bytes.length % (channels * 2) !== 0) {
      throw new Error('Reader HttpTTS PCM response metadata or sample alignment is invalid');
    }
    if (bytes.length > HTTP_TTS_MAX_AUDIO_BYTES - 44) {
      throw new Error('Reader HttpTTS PCM response exceeds the allowed range');
    }
    const wav = new Uint8Array(bytes.length + 44);
    const view = new DataView(wav.buffer);
    const put = (offset: number, text: string): void => {
      for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
    };
    const writeU16 = (offset: number, value: number): void => view.setUint16(offset, value, true);
    const writeU32 = (offset: number, value: number): void => view.setUint32(offset, value, true);
    const byteRate = sampleRate * channels * 2;
    put(0, 'RIFF'); writeU32(4, wav.length - 8); put(8, 'WAVE'); put(12, 'fmt ');
    writeU32(16, 16); writeU16(20, 1); writeU16(22, channels); writeU32(24, sampleRate);
    writeU32(28, byteRate); writeU16(32, channels * 2); writeU16(34, 16);
    put(36, 'data'); writeU32(40, bytes.length); wav.set(bytes, 44);
    return wav;
  }

  private cancelActiveRequest(_message: string): void {
    // HttpExecuteHost polls this generation and destroys its active platform
    // request. The shared transport owns DNS pinning, redirect-by-redirect
    // target validation and cross-origin sensitive-header removal.
    this.networkGeneration += 1;
    this.prefetchedAudio = undefined;
  }

  private prefetchKey(request: ReaderTtsHostSpeakRequest, configId: number): string {
    return JSON.stringify([
      configId, request.text, request.rate, request.pitch,
      request.language, request.person, request.engine,
    ]);
  }

  private createDataSource(bytes: Uint8Array): media.AVDataSrcDescriptor {
    let sequentialPosition = 0;
    return {
      fileSize: bytes.length,
      callback: (buffer: ArrayBuffer, length: number, pos?: number): number => {
        const start = pos === undefined ? sequentialPosition : pos;
        if (!Number.isSafeInteger(start) || start < 0) return -2;
        if (start >= bytes.length) return -1;
        const target = new Uint8Array(buffer);
        const count = Math.min(length, target.length, bytes.length - start);
        if (count <= 0) return -2;
        target.set(bytes.subarray(start, start + count), 0);
        sequentialPosition = start + count;
        return count;
      },
    };
  }

  private emit(event: ReaderTtsHostEvent): void {
    if (!this.closed) this.listener?.(event);
  }

  private installAudioListeners(): void {
    if (this.audioListenersInstalled) return;
    const audioSessionManager = this.ensureAudioSessionManager();
    audioSessionManager.on('audioSessionDeactivated', this.audioSessionDeactivatedCallback);
    audioSessionManager.on('audioSessionStateChanged', this.audioSessionStateChangedCallback);
    audioSessionManager.on('currentOutputDeviceChanged', this.outputDeviceChangedCallback);
    this.audioListenersInstalled = true;
  }

  private removeAudioListeners(): void {
    if (!this.audioListenersInstalled) return;
    const audioSessionManager = this.audioSessionManager;
    if (audioSessionManager === undefined) return;
    audioSessionManager.off('audioSessionDeactivated', this.audioSessionDeactivatedCallback);
    audioSessionManager.off('audioSessionStateChanged', this.audioSessionStateChangedCallback);
    audioSessionManager.off('currentOutputDeviceChanged', this.outputDeviceChangedCallback);
    this.audioListenersInstalled = false;
  }

  private ensureAudioSessionManager(): audio.AudioSessionManager {
    if (this.audioSessionManager === undefined) {
      this.audioSessionManager = audio.getAudioManager().getSessionManager();
    }
    return this.audioSessionManager;
  }

  private handleAudioStateHint(hint: audio.AudioSessionStateChangeHint): void {
    if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_RESUME) {
      this.emit({ type: 'interruption', action: 'resume' });
    } else if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_PAUSE) {
      this.emit({ type: 'interruption', action: 'pause' });
    } else if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_STOP ||
      hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_TIME_OUT_STOP) {
      this.emit({ type: 'interruption', action: 'stop' });
    } else if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_DUCK ||
      hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_MUTE_SUGGESTION) {
      this.emit({ type: 'interruption', action: 'duck' });
    } else if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_UNDUCK ||
      hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_UNMUTE_SUGGESTION) {
      this.emit({ type: 'interruption', action: 'unduck' });
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Reader HttpTTS Host is closed');
  }

  private logError(message: string, error: Object): void {
    const detail = errorMessageOf(error);
    hilog.error(LOG_DOMAIN, 'Reader', '%{private}s: %{private}s', message, detail);
  }
}
