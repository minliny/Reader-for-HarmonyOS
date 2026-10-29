/** Make V17 PhoneScreen EqualiserBar / @keyframes wb; decorative, not audio level. */
export const READER_TTS_WAVEFORM_HEIGHTS: number[] = [7, 13, 9, 18, 12, 22, 15, 10, 20, 14, 8, 17,
  11, 21, 13, 9, 16, 12, 19, 10, 14, 8, 15, 11];
export const READER_TTS_WAVEFORM_BAR_COUNT = 24;
/** Decorative waveform clock; owned here because the sampler is not an ArkUI animation. */
export const READER_TTS_WAVEFORM_HEIGHT_MS = 300;
export const READER_TTS_WAVEFORM_COLOR_MS = 350;
export const READER_TTS_WAVEFORM_ACTIVE_TAIL_MS = 350;
export const READER_TTS_WAVEFORM_CYCLE_BASE_MS = 650;
export const READER_TTS_WAVEFORM_CYCLE_STEP_MS = 110;
export const READER_TTS_WAVEFORM_STAGGER_MS = 30;
export interface ReaderTtsWaveformSample {
  heights: number[];
  scales: number[];
  opacities: number[];
  colorProgress: number;
}
export interface ReaderTtsWaveformCurves {
  ease: (progress: number) => number;
  easeInOut: (progress: number) => number;
}
export function createReaderTtsWaveformSample(): ReaderTtsWaveformSample {
  return { heights: Array(READER_TTS_WAVEFORM_BAR_COUNT).fill(4),
    scales: Array(READER_TTS_WAVEFORM_BAR_COUNT).fill(1),
    opacities: Array(READER_TTS_WAVEFORM_BAR_COUNT).fill(1), colorProgress: 0 };
}

/** Thin track sampler. Cubic easing is supplied by the platform, not reimplemented. */
export class ReaderTtsWaveformMotion {
  private playing: boolean = false;
  private changedAt: number = -READER_TTS_WAVEFORM_ACTIVE_TAIL_MS;
  private lastTime: number = 0;
  private from: ReaderTtsWaveformSample = createReaderTtsWaveformSample();
  private value: ReaderTtsWaveformSample = createReaderTtsWaveformSample();
  private readonly curves: ReaderTtsWaveformCurves;
  constructor(curves: ReaderTtsWaveformCurves) { this.curves = curves; }

  setPlaying(playing: boolean, timeMs: number): void {
    this.sample(timeMs);
    if (playing === this.playing) return;
    this.from = this.value;
    this.playing = playing;
    this.changedAt = this.lastTime;
  }
  active(timeMs: number): boolean {
    return this.playing || timeMs - this.changedAt < READER_TTS_WAVEFORM_ACTIVE_TAIL_MS;
  }
  sample(timeMs: number, reduceMotion: boolean = false): ReaderTtsWaveformSample {
    if (Number.isFinite(timeMs)) this.lastTime = Math.max(this.lastTime, timeMs);
    const elapsed = Math.max(0, this.lastTime - this.changedAt);
    const heightProgress = reduceMotion ? 1 :
      this.curves.ease(Math.min(1, elapsed / READER_TTS_WAVEFORM_HEIGHT_MS));
    const colorProgress = reduceMotion ? 1 :
      this.curves.ease(Math.min(1, elapsed / READER_TTS_WAVEFORM_COLOR_MS));
    const heights: number[] = [], scales: number[] = [], opacities: number[] = [];
    for (let index = 0; index < READER_TTS_WAVEFORM_HEIGHTS.length; index += 1) {
      const target = this.playing ? READER_TTS_WAVEFORM_HEIGHTS[index] : 4;
      heights.push(this.from.heights[index] + (target - this.from.heights[index]) * heightProgress);
      let scale = 1;
      const localTime = elapsed - index * READER_TTS_WAVEFORM_STAGGER_MS;
      if (this.playing && !reduceMotion && localTime >= 0) {
        const duration = READER_TTS_WAVEFORM_CYCLE_BASE_MS +
          (index % 5) * READER_TTS_WAVEFORM_CYCLE_STEP_MS;
        const cycle = Math.floor(localTime / duration);
        const progress = (localTime % duration) / duration;
        const alternate = cycle % 2 === 0 ? progress : 1 - progress;
        scale = .4 + .75 * this.curves.easeInOut(alternate);
      }
      scales.push(scale);
      opacities.push(this.playing ? .75 + (index % 3) * .12 : 1);
    }
    this.value = { heights, scales, opacities,
      colorProgress: this.from.colorProgress + ((this.playing ? 1 : 0) - this.from.colorProgress) * colorProgress };
    return this.value;
  }
}

interface ReaderTtsWaveformSubscriber {
  id: number;
  playing: boolean;
  reduceMotion: boolean;
  receive: (sample: ReaderTtsWaveformSample) => void;
  schedule: (callback: () => void) => void;
}

/** One shared native-frame lane for quick/full live views. Frozen sources do not subscribe. */
export class ReaderTtsWaveformClock {
  private subscribers: ReaderTtsWaveformSubscriber[] = [];
  private sequence: number = 0;
  private frameGeneration: number = 0;
  private scheduled: boolean = false;
  private scheduledOwner: number = -1;
  private value: ReaderTtsWaveformSample = createReaderTtsWaveformSample();
  private readonly motion: ReaderTtsWaveformMotion;
  private readonly now: () => number;
  constructor(curves: ReaderTtsWaveformCurves, now: () => number) {
    this.now = now;
    this.motion = new ReaderTtsWaveformMotion(curves);
  }
  /** Capture the actual published source pose, never advance it at click time. */
  snapshot(): ReaderTtsWaveformSample { return this.value; }
  subscribe(playing: boolean, reduceMotion: boolean, receive: (sample: ReaderTtsWaveformSample) => void,
    schedule: (callback: () => void) => void): number {
    const id = ++this.sequence;
    this.subscribers.push({ id, playing, reduceMotion, receive, schedule });
    this.update(id, playing, reduceMotion);
    return id;
  }
  update(id: number, playing: boolean, reduceMotion: boolean): void {
    const owner = this.subscribers.find(item => item.id === id);
    if (owner === undefined) return;
    owner.playing = playing; owner.reduceMotion = reduceMotion;
    this.motion.setPlaying(this.subscribers.some(item => item.playing), this.now());
    this.publish(); this.arm();
  }
  unsubscribe(id: number): void {
    this.subscribers = this.subscribers.filter(item => item.id !== id);
    if (this.scheduledOwner === id || this.subscribers.length === 0) {
      this.frameGeneration += 1; this.scheduled = false; this.scheduledOwner = -1;
    }
    // An absent surface does not cancel audio or invent a new animation epoch.
    if (this.subscribers.length > 0) {
      this.motion.setPlaying(this.subscribers.some(item => item.playing), this.now());
      this.publish(); this.arm();
    }
  }
  private reduced(): boolean { return this.subscribers.some(item => item.reduceMotion); }
  private publish(): void {
    const sample = this.motion.sample(this.now(), this.reduced());
    this.value = sample;
    for (const owner of this.subscribers) owner.receive(sample);
  }
  private arm(): void {
    if (this.scheduled || this.subscribers.length === 0 || this.reduced() || !this.motion.active(this.now())) return;
    this.scheduled = true;
    const owner = this.subscribers[0]; this.scheduledOwner = owner.id;
    const generation = ++this.frameGeneration;
    owner.schedule((): void => {
      if (generation !== this.frameGeneration) return;
      this.scheduled = false; this.scheduledOwner = -1;
      this.publish(); this.arm();
    });
  }
}
