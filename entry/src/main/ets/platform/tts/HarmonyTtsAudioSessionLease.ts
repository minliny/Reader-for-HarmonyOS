import { audio } from '@kit.AudioKit';
import { ReaderTtsAudioSessionLease, type ReaderTtsAudioSessionDriver } from './ReaderTtsAudioSessionLease';

class HarmonyTtsAudioSessionDriver implements ReaderTtsAudioSessionDriver {
  private manager: audio.AudioSessionManager | undefined = undefined;

  async activate(allowMixing: boolean): Promise<void> {
    const manager = this.sessionManager();
    manager.setAudioSessionScene(audio.AudioSessionScene.AUDIO_SESSION_SCENE_MEDIA);
    const concurrencyMode = allowMixing
      ? audio.AudioConcurrencyMode.CONCURRENCY_MIX_WITH_OTHERS
      : audio.AudioConcurrencyMode.CONCURRENCY_PAUSE_OTHERS;
    await manager.activateAudioSession({ concurrencyMode });
  }

  async deactivate(): Promise<void> { await this.sessionManager().deactivateAudioSession(); }

  private sessionManager(): audio.AudioSessionManager {
    if (this.manager === undefined) this.manager = audio.getAudioManager().getSessionManager();
    return this.manager;
  }
}

// Platform access stays lazy. Both system and HTTP transports use this one
// resource owner; constructing a runtime does not acquire audio focus.
export const harmonyTtsAudioSessionLease = new ReaderTtsAudioSessionLease(new HarmonyTtsAudioSessionDriver());
