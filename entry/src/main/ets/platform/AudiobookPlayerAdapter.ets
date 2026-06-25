// AudiobookPlayerAdapter — clean-room HarmonyOS audiobook player platform module.
// Wraps @ohos.media.AVPlayer into a reusable adapter for audiobook chapter
// playback. No raw audio buffers or credentials are exported; only bounded
// status classes and redacted checksums are surfaced. Device execution
// requires a real media service; headless contexts should treat failure as
// ENV_BLOCKED.

import { media } from '@kit.MediaKit';
import { boundedChecksum } from '../adapters/FeedParserAdapter';

export type AudiobookState = 'idle' | 'prepared' | 'playing' | 'paused' | 'stopped' | 'error';

export interface AudiobookTrack {
  src: string;            // opaque media source (redacted in evidence)
  title: string;
  durationMs: number;
  checksum: string;
}

export interface AudiobookEvidence {
  backend: string;
  stateClass: AudiobookState;
  trackChecksum: string;
  positionMs: number;
  durationMs: number;
  errorClass: string;
  rawAudioExported: boolean;
}

export interface AudiobookPosition {
  positionMs: number;
  durationMs: number;
  stateClass: AudiobookState;
}

const AUDIOBOOK_BACKEND = 'harmonyos-avplayer-clean-room';

export class AudiobookPlayerAdapter {
  private player: media.AVPlayer | null = null;
  private state: AudiobookState = 'idle';
  private currentTrack: AudiobookTrack | null = null;
  private positionMs: number = 0;
  private durationMs: number = 0;

  /**
   * Prepare a track for playback. Device execution requires a real media
   * service and a valid source URI; in headless contexts this returns false
   * without faking success.
   */
  async prepare(track: AudiobookTrack): Promise<boolean> {
    if (this.player !== null) {
      this.release();
    }
    try {
      this.player = await media.createAVPlayer();
      this.currentTrack = track;
      this.state = 'idle';
      // SDK-COMPAT: AVPlayer.url is the correct property name in this SDK; assign directly.
      this.player.url = track.src;
      this.player.loop = false;
      this.player.on('stateChange', (state: string, reason: media.StateChangeReason) => {
        this.state = this.mapState(state);
      });
      this.player.on('timeUpdate', (timeMs: number) => {
        this.positionMs = timeMs;
      });
      this.player.on('durationUpdate', (durationMs: number) => {
        this.durationMs = durationMs;
      });
      await this.player.prepare();
      this.state = 'prepared';
      return true;
    } catch (_e) {
      this.state = 'error';
      this.player = null;
      return false;
    }
  }

  /** Start playback. */
  async play(): Promise<AudiobookEvidence> {
    if (this.player === null || this.currentTrack === null) {
      return this.errorEvidence('no_track_prepared');
    }
    try {
      await this.player.play();
      this.state = 'playing';
      return this.buildEvidence('none');
    } catch (e) {
      this.state = 'error';
      return this.errorEvidence(this.errorClass(e));
    }
  }

  /** Pause playback. */
  async pause(): Promise<AudiobookEvidence> {
    if (this.player === null) {
      return this.errorEvidence('no_track_prepared');
    }
    try {
      await this.player.pause();
      this.state = 'paused';
      return this.buildEvidence('none');
    } catch (e) {
      this.state = 'error';
      return this.errorEvidence(this.errorClass(e));
    }
  }

  /** Seek to a position. */
  async seek(positionMs: number): Promise<AudiobookEvidence> {
    if (this.player === null) {
      return this.errorEvidence('no_track_prepared');
    }
    try {
      this.player.seek(positionMs);
      return this.buildEvidence('none');
    } catch (e) {
      this.state = 'error';
      return this.errorEvidence(this.errorClass(e));
    }
  }

  /** Stop playback. */
  async stop(): Promise<AudiobookEvidence> {
    if (this.player === null) {
      return this.errorEvidence('no_track_prepared');
    }
    try {
      await this.player.stop();
      this.state = 'stopped';
      return this.buildEvidence('none');
    } catch (e) {
      this.state = 'error';
      return this.errorEvidence(this.errorClass(e));
    }
  }

  /** Release the player resources. */
  release(): void {
    if (this.player !== null) {
      try {
        this.player.release();
      } catch (_e) {
        // Bounded failure.
      }
    }
    this.player = null;
    this.state = 'idle';
    this.currentTrack = null;
    this.positionMs = 0;
    this.durationMs = 0;
  }

  /** Get current playback position. */
  getPosition(): AudiobookPosition {
    return {
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      stateClass: this.state
    };
  }

  /** Build redacted evidence for a fixture round-trip (no device media required). */
  buildFixtureEvidence(): AudiobookEvidence {
    const fixtureTrack: AudiobookTrack = {
      src: 'fixture://audiobook/chapter1.mp3',
      title: 'fixture-chapter',
      durationMs: 60000,
      checksum: boundedChecksum(`audiobook:fixture:chapter1`)
    };
    return {
      backend: AUDIOBOOK_BACKEND,
      stateClass: 'idle',
      trackChecksum: fixtureTrack.checksum,
      positionMs: 0,
      durationMs: fixtureTrack.durationMs,
      errorClass: 'none',
      rawAudioExported: false
    };
  }

  getState(): AudiobookState {
    return this.state;
  }

  private buildEvidence(errorClass: string): AudiobookEvidence {
    return {
      backend: AUDIOBOOK_BACKEND,
      stateClass: this.state,
      trackChecksum: this.currentTrack ? this.currentTrack.checksum : boundedChecksum('audiobook:empty'),
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      errorClass,
      rawAudioExported: false
    };
  }

  private errorEvidence(errorClass: string): AudiobookEvidence {
    return {
      backend: AUDIOBOOK_BACKEND,
      stateClass: this.state,
      trackChecksum: this.currentTrack ? this.currentTrack.checksum : boundedChecksum('audiobook:empty'),
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      errorClass,
      rawAudioExported: false
    };
  }

  private mapState(state: string): AudiobookState {
    if (state === 'idle') { return 'idle'; }
    if (state === 'prepared') { return 'prepared'; }
    if (state === 'playing') { return 'playing'; }
    if (state === 'paused') { return 'paused'; }
    if (state === 'stopped') { return 'stopped'; }
    return 'error';
  }

  private errorClass(e: Object): string {
    const text = JSON.stringify(e);
    if (text.indexOf('permission') !== -1 || text.indexOf('Permission') !== -1) { return 'permission'; }
    if (text.indexOf('unsupported') !== -1) { return 'unsupported'; }
    if (text.length === 0) { return 'unknown'; }
    return 'media_error';
  }
}
