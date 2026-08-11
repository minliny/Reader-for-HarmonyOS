import {
  type ReaderTtsHost,
  type ReaderTtsHostEvent,
  type ReaderTtsHostSpeakRequest,
} from '../features/reading/ReaderTtsSessionCoordinator.ts';
import type {
  ReaderTtsMediaSessionBridge,
  ReaderTtsPublishedPlaybackState,
} from './HarmonyTtsMediaSession.ts';

export interface ReaderTtsClosableHost extends ReaderTtsHost {
  close(): Promise<void>;
}

/** Chooses one Host transport from the Core-persisted `tts.config.engine`. */
export class HarmonyTtsHostRouter implements ReaderTtsHost {
  private readonly system: ReaderTtsClosableHost;
  private readonly http: ReaderTtsClosableHost;
  private active: ReaderTtsHost;
  private readonly mediaSession: ReaderTtsMediaSessionBridge;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;

  constructor(
    system: ReaderTtsClosableHost,
    http: ReaderTtsClosableHost,
    mediaSession: ReaderTtsMediaSessionBridge,
  ) {
    this.system = system;
    this.http = http;
    this.active = system;
    this.mediaSession = mediaSession;
    this.system.setEventListener((event: ReaderTtsHostEvent): void => this.forward(this.system, event));
    this.http.setEventListener((event: ReaderTtsHostEvent): void => this.forward(this.http, event));
    this.mediaSession.setEventListener((event: ReaderTtsHostEvent): void => this.listener?.(event));
  }

  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined): void {
    this.listener = listener;
  }

  async selectEngine(engine?: string): Promise<boolean> {
    if (engine?.startsWith('http-tts:')) {
      const selected = await this.http.selectEngine(engine);
      this.active = this.http;
      return selected;
    }
    const selected = await this.system.selectEngine(engine);
    this.active = this.system;
    return selected;
  }

  isAvailable(): Promise<boolean> {
    return this.active.isAvailable();
  }

  activateAudioSession(allowMixing: boolean): Promise<void> {
    return Promise.all([
      this.active.activateAudioSession(allowMixing),
      this.mediaSession.activate(),
    ]).then((): void => {});
  }

  deactivateAudioSession(): Promise<void> {
    return this.active.deactivateAudioSession();
  }

  speak(request: ReaderTtsHostSpeakRequest): Promise<void> {
    return this.active.speak(request);
  }

  stop(): Promise<void> {
    return this.active.stop();
  }

  publishPlaybackState(state: ReaderTtsPublishedPlaybackState): void {
    this.mediaSession.publish(state);
  }

  async close(): Promise<void> {
    this.listener = undefined;
    await this.system.close();
    await this.http.close();
    await this.mediaSession.close();
  }

  private forward(source: ReaderTtsHost, event: ReaderTtsHostEvent): void {
    if (source === this.active) this.listener?.(event);
  }
}
