import {
  type ReaderTtsHost,
  type ReaderTtsHostEvent,
  type ReaderTtsHostProbe,
  type ReaderTtsHostSpeakRequest,
} from '../features/reading/ReaderTtsSessionCoordinator.ts';
import type { ReaderTtsVoiceOption } from '../features/reading/ReaderTtsPreferencesState';
import type {
  ReaderTtsMediaSessionBridge,
  ReaderTtsPublishedPlaybackState,
} from './HarmonyTtsMediaSession.ts';

export interface ReaderTtsClosableHost extends ReaderTtsHost {
  close(): Promise<void>;
}

export interface ReaderTtsSystemHost extends ReaderTtsClosableHost {
  listVoices(): Promise<ReaderTtsVoiceOption[]>;
}

export interface ReaderTtsBackgroundSessionBridge {
  activate(): Promise<boolean>;
  deactivate(): Promise<void>;
  isActive(): boolean;
  close(): Promise<void>;
}

/** Chooses one Host transport from the Core-persisted `tts.config.engine`. */
export class HarmonyTtsHostRouter implements ReaderTtsHost {
  private readonly system: ReaderTtsSystemHost;
  private readonly http: ReaderTtsClosableHost;
  private active: ReaderTtsHost;
  private readonly mediaSession: ReaderTtsMediaSessionBridge;
  private readonly backgroundSession: ReaderTtsBackgroundSessionBridge | undefined;
  private backgroundPlaybackEnabled: boolean = true;
  private foregroundSessionActive: boolean = false;
  private foregroundActivation: Promise<void> | undefined = undefined;
  private mediaActivationAttempted: boolean = false;
  private backgroundActivationAttempted: boolean = false;
  private mediaActivation: Promise<void> | undefined = undefined;
  private backgroundActivation: Promise<void> | undefined = undefined;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;
  private listenerOwner: string | undefined = undefined;

  constructor(
    system: ReaderTtsSystemHost,
    http: ReaderTtsClosableHost,
    mediaSession: ReaderTtsMediaSessionBridge,
    backgroundSession?: ReaderTtsBackgroundSessionBridge,
  ) {
    this.system = system;
    this.http = http;
    this.active = system;
    this.mediaSession = mediaSession;
    this.backgroundSession = backgroundSession;
    this.system.setEventListener((event: ReaderTtsHostEvent): void => this.forward(this.system, event), 'router');
    this.http.setEventListener((event: ReaderTtsHostEvent): void => this.forward(this.http, event), 'router');
    this.mediaSession.setEventListener((event: ReaderTtsHostEvent): void => this.listener?.(event));
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

  probe(): Promise<ReaderTtsHostProbe> {
    return this.active.probe();
  }

  async activateAudioSession(allowMixing: boolean): Promise<void> {
    // The selected speech transport is the only mandatory foreground lease.
    // Media controls and background admission are additive platform bridges;
    // a device without either capability must still be able to speak locally.
    const activation = this.active.activateAudioSession(allowMixing);
    this.foregroundActivation = activation;
    try {
      await activation;
      this.foregroundSessionActive = true;
      this.activateOptionalSessions();
    } finally {
      if (this.foregroundActivation === activation) this.foregroundActivation = undefined;
    }
  }

  setBackgroundPlaybackEnabled(enabled: boolean): void {
    this.backgroundPlaybackEnabled = enabled;
    if (enabled) {
      this.activateOptionalSessions();
    } else {
      this.backgroundActivationAttempted = false;
      void this.backgroundSession?.deactivate().catch((): void => {});
    }
  }

  async deactivateAudioSession(): Promise<void> {
    this.foregroundSessionActive = false;
    this.backgroundActivationAttempted = false;
    await Promise.all([
      this.active.deactivateAudioSession(),
      this.backgroundSession?.deactivate() ?? Promise.resolve(),
    ]);
  }

  isBackgroundPlaybackActive(): boolean {
    return this.backgroundSession?.isActive() ?? false;
  }

  /** A quick background transition may arrive while the optional lease is
   * still being admitted. Wait only at that transition, with a finite bound. */
  async waitForBackgroundPlaybackAdmission(): Promise<boolean> {
    if (!this.backgroundPlaybackEnabled || this.backgroundSession === undefined) return false;
    if (this.backgroundSession.isActive()) return true;
    let timeout = -1;
    try {
      const admission = async (): Promise<boolean> => {
        if (!this.foregroundSessionActive) {
          const foreground = this.foregroundActivation;
          if (foreground === undefined) return false;
          try { await foreground; } catch (_) { return false; }
        }
        if (!this.foregroundSessionActive || !this.backgroundPlaybackEnabled) return false;
        const background = this.backgroundActivation;
        if (background !== undefined) await background;
        return this.backgroundPlaybackEnabled && this.backgroundSession?.isActive() === true;
      };
      return await Promise.race([admission(), new Promise<boolean>((resolve): void => {
        timeout = setTimeout((): void => resolve(false), 1500);
      })]);
    } finally {
      if (timeout >= 0) clearTimeout(timeout);
    }
  }

  speak(request: ReaderTtsHostSpeakRequest): Promise<void> {
    return this.active.speak(request);
  }

  prefetchNext(request: ReaderTtsHostSpeakRequest): void {
    this.active.prefetchNext?.(request);
  }

  listSystemVoices(): Promise<ReaderTtsVoiceOption[]> {
    return this.system.listVoices();
  }

  stop(): Promise<void> {
    return this.active.stop();
  }

  publishPlaybackState(state: ReaderTtsPublishedPlaybackState): void {
    this.mediaSession.publish(state);
  }

  async close(): Promise<void> {
    this.listener = undefined;
    this.listenerOwner = undefined;
    this.foregroundSessionActive = false;
    await Promise.all([
      this.mediaActivation ?? Promise.resolve(),
      this.backgroundActivation ?? Promise.resolve(),
    ]);
    await this.system.close();
    await this.http.close();
    await this.backgroundSession?.close();
    await this.mediaSession.close();
  }

  private forward(source: ReaderTtsHost, event: ReaderTtsHostEvent): void {
    if (source === this.active) this.listener?.(event);
  }

  private activateOptionalSessions(): void {
    if (!this.foregroundSessionActive) return;
    // Neither optional platform bridge belongs on the per-slice speech path.
    // A single attempt per foreground lease also avoids repeated native calls
    // when the coordinator asks to keep the same audio focus for each slice.
    if (!this.mediaActivationAttempted) {
      this.mediaActivationAttempted = true;
      this.mediaActivation = this.mediaSession.activate().catch((): void => {});
    }
    if (this.backgroundPlaybackEnabled && this.backgroundSession !== undefined &&
      !this.backgroundActivationAttempted) {
      this.backgroundActivationAttempted = true;
      this.backgroundActivation = this.backgroundSession.activate().then((): void => {}, (): void => {});
    }
  }
}
