export type ReaderTtsNativeSpeakPoint =
  'enter' | 'return' | 'engine-cache-hit' | 'engine-cache-alias-hit' | 'engine-cache-miss';

export type ReaderTtsHostSpeakRequest = {
  requestId: string;
  /** Process-local diagnostics identity, never speech/book/provider data. */
  traceOperationId?: number;
  traceNativeSpeak?: (point: ReaderTtsNativeSpeakPoint) => void;
  text: string;
  rate: number;
  pitch: number;
  language: string;
  person: number;
  engine?: string;
};

export type ReaderTtsHostEvent =
  | { type: 'start'; requestId: string }
  | { type: 'complete'; requestId: string; completion: 'audio' | 'synthesis' }
  | { type: 'stop'; requestId: string }
  | { type: 'error'; requestId: string; message: string }
  | { type: 'interruption'; action: 'pause' | 'resume' | 'stop' | 'duck' | 'unduck' }
  | { type: 'deviceChange'; action: 'continue' | 'stop' }
  | { type: 'mediaControl'; action: 'play' | 'pause' | 'stop' | 'next' | 'previous' }
  | { type: 'mediaRate'; rate: number }
  | { type: 'backgroundLeaseRevoked' };

export type ReaderTtsHostProbe = {
  available: boolean;
  /** Specific unavailability cause: capability, voice, or engine init failure. */
  reason?: string;
};

export interface ReaderTtsHost {
  /**
   * Owner-scoped listener registration: a later clearEventListener(owner) must
   * only detach the listener when `owner` is still the registered one, so a
   * torn-down page can never drop a newer page's listener on a shared Host.
   */
  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined, owner: string): void;
  clearEventListener(owner: string): void;
  selectEngine(engine?: string): Promise<boolean>;
  probe(language?: string, person?: number, exactVoice?: boolean): Promise<ReaderTtsHostProbe>;
  isAvailable(): Promise<boolean>;
  activateAudioSession(allowMixing: boolean): Promise<void>;
  deactivateAudioSession(): Promise<void>;
  speak(request: ReaderTtsHostSpeakRequest): Promise<void>;
  /** Optional one-slice lookahead; implementations must bound and cancel it. */
  prefetchNext?(request: ReaderTtsHostSpeakRequest): void;
  stop(): Promise<void>;
  publishPlaybackState(state: 'preparing' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error', rate?: number): void;
  /** Optional policy gate for the platform continuous-task lease. */
  setBackgroundPlaybackEnabled?(enabled: boolean): void;
}
