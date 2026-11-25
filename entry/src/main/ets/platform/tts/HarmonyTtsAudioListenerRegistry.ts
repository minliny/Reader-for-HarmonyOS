import type { audio } from '@kit.AudioKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from '../../app/ErrorMessage.ts';

interface AudioListener {
  event: string;
  attach: () => void;
  detach: () => void;
  registered: boolean;
}

interface AudioListenerCallbacks {
  deactivated: (event: audio.AudioSessionDeactivatedEvent) => void;
  stateChanged: (event: audio.AudioSessionStateChangedEvent) => void;
  deviceChanged: (event: audio.CurrentOutputDeviceChangedEvent) => void;
}

/** Owns the exact native callback identities for one TTS transport. */
export class HarmonyTtsAudioListenerRegistry {
  private static retiring: HarmonyTtsAudioListenerRegistry[] = [];
  private readonly listeners: AudioListener[];
  private callbacks: AudioListenerCallbacks | undefined;
  private active: boolean = false;

  constructor(manager: audio.AudioSessionManager,
    onDeactivated: (event: audio.AudioSessionDeactivatedEvent) => void,
    onStateChanged: (event: audio.AudioSessionStateChangedEvent) => void,
    onDeviceChanged: (event: audio.CurrentOutputDeviceChangedEvent) => void) {
    this.callbacks = { deactivated: onDeactivated, stateChanged: onStateChanged, deviceChanged: onDeviceChanged };
    const deactivated = (event: audio.AudioSessionDeactivatedEvent): void => {
      if (this.active) this.callbacks?.deactivated(event);
    };
    const stateChanged = (event: audio.AudioSessionStateChangedEvent): void => {
      if (this.active) this.callbacks?.stateChanged(event);
    };
    const deviceChanged = (event: audio.CurrentOutputDeviceChangedEvent): void => {
      if (this.active) this.callbacks?.deviceChanged(event);
    };
    this.listeners = [
      { event: 'audioSessionDeactivated', registered: false,
        attach: (): void => manager.on('audioSessionDeactivated', deactivated),
        detach: (): void => manager.off('audioSessionDeactivated', deactivated) },
      { event: 'audioSessionStateChanged', registered: false,
        attach: (): void => manager.on('audioSessionStateChanged', stateChanged),
        detach: (): void => manager.off('audioSessionStateChanged', stateChanged) },
      { event: 'currentOutputDeviceChanged', registered: false,
        attach: (): void => manager.on('currentOutputDeviceChanged', deviceChanged),
        detach: (): void => manager.off('currentOutputDeviceChanged', deviceChanged) },
    ];
  }

  install(): void {
    if (this.active) return;
    // RuntimeOwner closes its TTS router only once. The next actual audio
    // activation retries any prior transport's remaining native subscriptions.
    for (const previous of HarmonyTtsAudioListenerRegistry.retiring.slice()) previous.close();
    const added: AudioListener[] = [];
    try {
      for (const listener of this.listeners) {
        if (listener.registered) continue;
        listener.attach();
        listener.registered = true;
        added.push(listener);
      }
    } catch (error) {
      this.remove(added.reverse());
      throw error;
    }
    this.active = true;
  }

  close(): void {
    this.active = false;
    // Retained native callbacks no longer own the retired transport or runtime.
    this.callbacks = undefined;
    this.remove(this.listeners);
    if (this.listeners.some((listener: AudioListener): boolean => listener.registered)) {
      if (!HarmonyTtsAudioListenerRegistry.retiring.includes(this)) HarmonyTtsAudioListenerRegistry.retiring.push(this);
    } else {
      HarmonyTtsAudioListenerRegistry.retiring = HarmonyTtsAudioListenerRegistry.retiring.filter(
        (registry: HarmonyTtsAudioListenerRegistry): boolean => registry !== this);
    }
  }

  private remove(listeners: AudioListener[]): void {
    for (const listener of listeners) {
      if (!listener.registered) continue;
      try {
        listener.detach();
        listener.registered = false;
      } catch (error) {
        try {
          hilog.warn(0x5244, 'Reader', 'TTS audio listener %{public}s cleanup pending: %{private}s',
            listener.event, errorMessageOf(error));
        } catch (_) { /* Logging does not own listener cleanup. */ }
      }
    }
  }
}
