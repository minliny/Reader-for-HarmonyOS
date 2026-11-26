import type { ReaderTtsPreferenceWriteFacts } from './ReaderTtsPreferencesGateway';
import {
  copyReaderTtsPreferencesPatch, copyReaderTtsPreferencesSnapshot, mergeReaderTtsPreferencesPatch,
  type ReaderTtsPreferencesPatch, type ReaderTtsPreferencesSnapshot, type ReaderTtsVoiceOption,
} from './ReaderTtsPreferencesState.ts';

export interface ReaderTtsPreferenceStore {
  load(): Promise<ReaderTtsPreferencesSnapshot>;
  writeFacts(): ReaderTtsPreferenceWriteFacts;
  patch(patch: ReaderTtsPreferencesPatch, isAdmitted?: () => boolean): Promise<ReaderTtsPreferencesSnapshot>;
  retryAccepted(isAdmitted?: () => boolean): Promise<ReaderTtsPreferencesSnapshot>;
}

export interface ReaderTtsPreferenceAdmission {
  readonly preferences: ReaderTtsPreferencesSnapshot;
  readonly voices: ReaderTtsVoiceOption[];
  readonly language: string;
  readonly person: number;
  readonly repairedVoice: boolean;
}

export interface ReaderTtsPreferencePresentation {
  captureOwner(): () => boolean;
  voices(): ReaderTtsVoiceOption[];
  publishVoices(voices: ReaderTtsVoiceOption[]): void;
  admit(input: ReaderTtsPreferenceAdmission, current: () => boolean): void;
  notice(message: string, canRetry: boolean, busy?: boolean): void;
  log(stage: string, error: Error): void;
}

interface ReaderTtsPreferenceSave {
  generation: number;
  current: () => boolean;
}

/** Presentation leases and accepted choices for one reader. The Preferences
 * gateway keeps the serialized durable write and unknown-flush recovery. */
export class ReaderTtsPreferenceHost {
  private mutationGeneration: number = 0;
  private savedGeneration: number = 0;
  private overrides: ReaderTtsPreferencesPatch = {};
  private base: ReaderTtsPreferencesSnapshot | undefined = undefined;
  private save: ReaderTtsPreferenceSave | undefined = undefined;
  private voiceGeneration: number = 0;
  private mixingGeneration: number = 0;
  private voicePending: boolean = false;
  private mixingPending: boolean = false;
  private readonly store: ReaderTtsPreferenceStore;
  private readonly view: ReaderTtsPreferencePresentation;

  constructor(store: ReaderTtsPreferenceStore, view: ReaderTtsPreferencePresentation) {
    this.store = store;
    this.view = view;
  }

  retireChoiceObservations(): void {
    this.voiceGeneration += 1;
    this.mixingGeneration += 1;
    this.voicePending = false;
    this.mixingPending = false;
  }

  voiceChangePending(): boolean { return this.voicePending; }
  mixingChangePending(): boolean { return this.mixingPending; }

  /** Configuration, preferences and voice discovery admit independently. */
  async refreshMetadata(isCurrent: () => boolean, refreshConfiguration: () => Promise<void>,
    listVoices: () => Promise<ReaderTtsVoiceOption[]>, log: (message: string) => void): Promise<void> {
    let preferencesLoaded = false;
    await Promise.all([
      refreshConfiguration(),
      this.store.load().then((preferences: ReaderTtsPreferencesSnapshot): void => {
        if (!isCurrent()) return;
        this.admit(preferences, this.view.voices());
        preferencesLoaded = true;
        this.retryPending();
      }).catch((error: Error): void => {
        log(`Reader TTS optional preferences failed: ${error.message}`);
      }),
      listVoices().then((voices: ReaderTtsVoiceOption[]): void => {
        if (!isCurrent()) return;
        this.view.publishVoices(voices);
        if (preferencesLoaded && this.base !== undefined) this.admit(this.base, voices);
      }).catch((error: Error): void => {
        log(`Reader TTS optional voices failed: ${error.message}`);
      }),
    ]);
  }

  private admit(loaded: ReaderTtsPreferencesSnapshot, voices: ReaderTtsVoiceOption[]): void {
    this.base = copyReaderTtsPreferencesSnapshot(loaded);
    const preferences = mergeReaderTtsPreferencesPatch(loaded, this.overrides);
    const current = this.view.captureOwner();
    let language = preferences.language;
    let person = preferences.person;
    let repairedVoice = false;
    if (voices.length > 0 && !voices.some((option: ReaderTtsVoiceOption): boolean =>
      option.language === language && option.person === person)) {
      const fallback = voices.find((option: ReaderTtsVoiceOption): boolean => option.language === language) ?? voices[0];
      language = fallback.language;
      person = fallback.person;
      repairedVoice = true;
    }
    this.view.admit({ preferences, voices, language, person, repairedVoice }, current);
  }

  changeVoice(language: string, person: number, setNativeVoice: (option: ReaderTtsVoiceOption) => Promise<boolean>,
    publish: (option: ReaderTtsVoiceOption) => void): void {
    const option = this.view.voices().find((candidate: ReaderTtsVoiceOption): boolean =>
      candidate.language === language && candidate.person === person);
    if (option === undefined) return;
    const owner = this.view.captureOwner();
    const generation = ++this.voiceGeneration;
    const current = (): boolean => owner() && generation === this.voiceGeneration;
    if (!current()) return;
    this.voicePending = true;
    void setNativeVoice(option).then((accepted: boolean): void => {
      if (!current()) return;
      if (accepted) {
        publish(option);
        this.accept({ voice: { language: option.language, person: option.person } });
      }
    }).catch((error: Error): void => { if (current()) this.view.log('voice', error); })
      .finally((): void => {
        if (!current()) return;
        this.voicePending = false;
        if (this.base !== undefined) this.admit(this.base, this.view.voices());
      });
  }

  changeMixing(enabled: boolean, setNativeMixing: (enabled: boolean) => Promise<boolean>,
    publish: (enabled: boolean) => void): void {
    const owner = this.view.captureOwner();
    const generation = ++this.mixingGeneration;
    const current = (): boolean => owner() && generation === this.mixingGeneration;
    if (!current()) return;
    this.mixingPending = true;
    void setNativeMixing(enabled).then((accepted: boolean): void => {
      if (!current()) return;
      if (accepted) {
        publish(enabled);
        this.accept({ allowMixing: enabled });
      }
    }).catch((error: Error): void => { if (current()) this.view.log('audio-session', error); })
      .finally((): void => {
        if (!current()) return;
        this.mixingPending = false;
        if (this.base !== undefined) this.admit(this.base, this.view.voices());
      });
  }

  accept(patch: ReaderTtsPreferencesPatch): void {
    const accepted = copyReaderTtsPreferencesPatch(this.overrides);
    if (patch.voice !== undefined) accepted.voice = { language: patch.voice.language, person: patch.voice.person };
    if (patch.pauseOnInterruption !== undefined) accepted.pauseOnInterruption = patch.pauseOnInterruption;
    if (patch.allowMixing !== undefined) accepted.allowMixing = patch.allowMixing;
    if (patch.failurePolicy !== undefined) accepted.failurePolicy = patch.failurePolicy;
    if (patch.followHighlight !== undefined) accepted.followHighlight = patch.followHighlight;
    if (patch.backgroundPlayback !== undefined) accepted.backgroundPlayback = patch.backgroundPlayback;
    if (patch.keepScreenOn !== undefined) accepted.keepScreenOn = patch.keepScreenOn;
    this.overrides = accepted;
    this.mutationGeneration = this.mutationGeneration >= Number.MAX_SAFE_INTEGER ? 1 : this.mutationGeneration + 1;
    this.persist();
  }

  retryPending(): void {
    if (this.savedGeneration !== this.mutationGeneration) {
      this.persist();
      return;
    }
    if (!this.store.writeFacts().pendingReconciliation) {
      this.view.notice('', false);
      return;
    }
    const current = this.captureAdmission(this.mutationGeneration);
    if (!current()) return;
    this.view.notice('正在核对并保存朗读设置…', false, true);
    void this.store.retryAccepted(current).then((): void => this.settleNotice(current))
      .catch((error: Error): void => this.notifyPending(error, current));
  }

  private captureAdmission(generation: number): () => boolean {
    const owner = this.view.captureOwner();
    return (): boolean => generation === this.mutationGeneration && owner();
  }

  private persist(): void {
    const current = this.captureAdmission(this.mutationGeneration);
    if (!current()) return;
    if (this.save?.generation === this.mutationGeneration && this.save.current()) return;
    void this.persistPatch(copyReaderTtsPreferencesPatch(this.overrides), current)
      .catch((error: Error): void => { if (current()) this.notifyPending(error, current); });
  }

  private async persistPatch(patch: ReaderTtsPreferencesPatch, current: () => boolean): Promise<void> {
    if (!current()) return;
    const generation = this.mutationGeneration;
    const save: ReaderTtsPreferenceSave = { generation, current };
    this.save = save;
    try {
      await this.store.patch(patch, save.current);
      if (save.current()) this.savedGeneration = generation;
      this.settleNotice(save.current);
    } finally {
      if (this.save === save) this.save = undefined;
    }
  }

  private settleNotice(current: () => boolean): void {
    if (!current()) return;
    const pending = this.store.writeFacts().pendingReconciliation;
    this.view.notice(pending ? '朗读设置保存尚未确认，当前选择已保留。' : '', pending);
  }

  private notifyPending(error: Error, current: () => boolean): void {
    if (!current() || error.message === 'TTS_PREFERENCE_OWNER_SUPERSEDED') return;
    this.view.notice(this.store.writeFacts().pendingReconciliation ?
      '朗读设置保存尚未确认，当前选择已保留。' : '朗读设置未能保存，当前选择已保留，请重试保存。', true);
    try { this.view.log('preference-save-pending', error); } catch (_diagnosticError) {}
  }
}
