export type ReaderTtsJsonObject = { [key: string]: unknown };

export interface ReaderTtsRuntime {
  request(method: string, params?: ReaderTtsJsonObject): Promise<{ data: ReaderTtsJsonObject }>;
}

export type ReaderTtsChapterRef = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle?: string;
  chapterUrl?: string;
};

export type ReaderTtsSlice = {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  paragraphIndex: number;
};

export type ReaderTtsSlicingStrategy = 'paragraph' | 'sentence' | 'paragraph-then-sentence' | 'line-break';

export type ReaderTtsSlicePlan = {
  chapter: ReaderTtsChapterRef;
  strategy: ReaderTtsSlicingStrategy;
  slices: ReaderTtsSlice[];
  sourceCharCount: number;
};

export type ReaderTtsQueueState = 'idle' | 'playing' | 'paused' | 'completed' | 'stopped';
export type ReaderTtsSliceStatus = 'pending' | 'speaking' | 'done' | 'skipped' | 'failed';

export type ReaderTtsQueueSnapshot = {
  state: ReaderTtsQueueState;
  currentSliceIndex?: number;
  totalSlices: number;
  completedSlices: number;
  chapter: ReaderTtsChapterRef;
  sliceStatuses: ReaderTtsSliceStatus[];
  failurePolicy: 'skip' | 'stop';
  consecutiveFailures: number;
  failureLimit: number;
  drainBehavior: 'stop-on-boundary' | 'advance-to-next';
  restartPolicy: 'reset-on-core-restart';
};

export type ReaderTtsCallbackResult = {
  snapshot: ReaderTtsQueueSnapshot;
  callbackDisposition: 'applied' | 'duplicate' | 'stale';
  failureAction?: 'skip' | 'stop';
};

export type ReaderTtsConfig = {
  configId?: number;
  engine?: string;
  rate: number;
  ratePercent?: number;
  pitch: number;
  followSys: boolean;
};

export type ReaderTtsConfigUpdate = {
  engine?: string;
  rate: number;
  ratePercent?: number;
  pitch: number;
  followSys: boolean;
};

export type ReaderTtsChapterTransition = {
  current: ReaderTtsChapterRef;
  next?: ReaderTtsChapterRef;
  drainBehavior: 'stop-on-boundary' | 'advance-to-next';
};

/**
 * Strict page-facing boundary for Core TTS commands. ArkUI receives typed
 * plans and snapshots only; protocol envelopes and unchecked JSON stop here.
 */
export class ReaderTtsGateway {
  private readonly runtime: ReaderTtsRuntime;

  constructor(runtime: ReaderTtsRuntime) {
    this.runtime = runtime;
  }

  async getConfig(): Promise<ReaderTtsConfig | undefined> {
    const result = await this.runtime.request('tts.config.get', {});
    const raw = result.data['config'];
    if (raw === null || raw === undefined) {
      return undefined;
    }
    return this.decodeConfig(raw, 'tts.config.get');
  }

  async putConfig(update: ReaderTtsConfigUpdate): Promise<ReaderTtsConfig> {
    this.assertConfigUpdate(update);
    const params: ReaderTtsJsonObject = {
      rate: update.rate,
      pitch: update.pitch,
      followSys: update.followSys,
    };
    if (update.ratePercent !== undefined) params['ratePercent'] = update.ratePercent;
    if (update.engine !== undefined) {
      params['engine'] = update.engine;
    }
    const result = await this.runtime.request('tts.config.put', params);
    return this.decodeConfig(result.data['config'], 'tts.config.put');
  }

  async slice(
    chapter: ReaderTtsChapterRef,
    content: string,
    strategy: ReaderTtsSlicingStrategy = 'paragraph-then-sentence',
  ): Promise<ReaderTtsSlicePlan> {
    this.assertChapter(chapter, 'tts.slice chapter');
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('tts.slice requires non-empty content');
    }
    this.assertStrategy(strategy);
    const result = await this.runtime.request('tts.slice', { chapter, content, strategy });
    const plan = this.decodePlan(result.data['plan'], 'tts.slice');
    this.assertSameChapter(plan.chapter, chapter, 'tts.slice');
    return plan;
  }

  async play(plan: ReaderTtsSlicePlan, startSliceIndex: number): Promise<ReaderTtsQueueSnapshot> {
    this.assertPlan(plan, 'tts.queue.play plan');
    this.assertNonNegativeInteger(startSliceIndex, 'tts.queue.play startSliceIndex');
    if (startSliceIndex >= plan.slices.length) {
      throw new Error('tts.queue.play startSliceIndex is outside the plan');
    }
    return this.requestSnapshot('tts.queue.play', { plan, startSliceIndex }, plan.chapter);
  }

  async pause(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot> {
    return this.requestSnapshot('tts.queue.pause', { chapter }, chapter);
  }

  async resume(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot> {
    return this.requestSnapshot('tts.queue.resume', { chapter }, chapter);
  }

  async stop(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot> {
    return this.requestSnapshot('tts.queue.stop', { chapter }, chapter);
  }

  async next(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot> {
    return this.requestSnapshot('tts.queue.next', { chapter }, chapter);
  }

  async previous(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot> {
    return this.requestSnapshot('tts.queue.prev', { chapter }, chapter);
  }

  async seek(chapter: ReaderTtsChapterRef, sliceIndex: number): Promise<ReaderTtsQueueSnapshot> {
    this.assertNonNegativeInteger(sliceIndex, 'tts.queue.seek sliceIndex');
    return this.requestSnapshot('tts.queue.seek', { chapter, sliceIndex }, chapter);
  }

  async skip(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot> {
    return this.requestSnapshot('tts.queue.skip', { chapter }, chapter);
  }

  async status(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot> {
    return this.requestSnapshot('tts.queue.status', { chapter }, chapter);
  }

  async setRate(chapter: ReaderTtsChapterRef, rate: number): Promise<ReaderTtsQueueSnapshot> {
    this.assertNonNegativeInteger(rate, 'tts.queue.set-rate rate');
    const result = await this.runtime.request('tts.queue.set-rate', { chapter, rate });
    if (result.data['rate'] !== rate) {
      throw new Error('tts.queue.set-rate returned a mismatched rate');
    }
    const snapshot = this.decodeSnapshot(result.data['snapshot'], 'tts.queue.set-rate');
    this.assertSameChapter(snapshot.chapter, chapter, 'tts.queue.set-rate');
    return snapshot;
  }

  async reportStatus(
    chapter: ReaderTtsChapterRef,
    sliceIndex: number,
    status: 'speaking' | 'done' | 'failed',
  ): Promise<ReaderTtsQueueSnapshot> {
    this.assertNonNegativeInteger(sliceIndex, 'tts.queue.report-status sliceIndex');
    const result = await this.runtime.request('tts.queue.report-status', { chapter, sliceIndex, status });
    const snapshot = this.decodeSnapshot(result.data['snapshot'], 'tts.queue.report-status');
    this.assertSameChapter(snapshot.chapter, chapter, 'tts.queue.report-status');
    return snapshot;
  }

  async reportCallback(
    chapter: ReaderTtsChapterRef,
    sliceIndex: number,
    status: 'speaking' | 'done' | 'failed',
    callbackId: string,
    failurePolicy: 'skip' | 'stop',
    failureLimit: number = 3,
  ): Promise<ReaderTtsCallbackResult> {
    this.assertNonNegativeInteger(sliceIndex, 'tts.queue.report-callback sliceIndex');
    if (callbackId.trim().length === 0 || !Number.isSafeInteger(failureLimit) || failureLimit <= 0) {
      throw new Error('tts.queue.report-callback requires callbackId and a positive failureLimit');
    }
    const result = await this.runtime.request('tts.queue.report-callback', {
      chapter,
      sliceIndex,
      status,
      callbackId,
      failurePolicy,
      failureLimit,
    });
    const snapshot = this.decodeSnapshot(result.data['snapshot'], 'tts.queue.report-callback');
    this.assertSameChapter(snapshot.chapter, chapter, 'tts.queue.report-callback');
    const disposition = result.data['callbackDisposition'];
    if (disposition !== 'applied' && disposition !== 'duplicate' && disposition !== 'stale') {
      throw new Error('tts.queue.report-callback returned invalid callbackDisposition');
    }
    const action = result.data['failureAction'];
    if (action !== undefined && action !== null && action !== 'skip' && action !== 'stop') {
      throw new Error('tts.queue.report-callback returned invalid failureAction');
    }
    const decoded: ReaderTtsCallbackResult = { snapshot, callbackDisposition: disposition };
    if (action === 'skip' || action === 'stop') decoded.failureAction = action;
    return decoded;
  }

  async chapterPlan(
    chapter: ReaderTtsChapterRef,
    nextChapter: ReaderTtsChapterRef | undefined,
    drainBehavior: 'stop-on-boundary' | 'advance-to-next' = 'advance-to-next',
  ): Promise<ReaderTtsChapterTransition> {
    this.assertChapter(chapter, 'tts.chapter.plan chapter');
    const params: ReaderTtsJsonObject = { chapter, drainBehavior };
    if (nextChapter !== undefined) {
      this.assertChapter(nextChapter, 'tts.chapter.plan nextChapter');
      params['nextChapter'] = nextChapter;
    }
    const result = await this.runtime.request('tts.chapter.plan', params);
    const transition = this.decodeTransition(result.data['transition']);
    this.assertSameChapter(transition.current, chapter, 'tts.chapter.plan');
    if (nextChapter !== undefined) {
      if (transition.next === undefined) {
        throw new Error('tts.chapter.plan omitted the supplied next chapter');
      }
      this.assertSameChapter(transition.next, nextChapter, 'tts.chapter.plan next');
    }
    return transition;
  }

  private async requestSnapshot(
    method: string,
    params: ReaderTtsJsonObject,
    chapter: ReaderTtsChapterRef,
  ): Promise<ReaderTtsQueueSnapshot> {
    this.assertChapter(chapter, `${method} chapter`);
    const result = await this.runtime.request(method, params);
    const snapshot = this.decodeSnapshot(result.data['snapshot'], method);
    this.assertSameChapter(snapshot.chapter, chapter, method);
    return snapshot;
  }

  private decodePlan(value: unknown, command: string): ReaderTtsSlicePlan {
    const plan = this.requireObject(value, `${command} plan`);
    this.assertAllowedKeys(plan, ['chapter', 'strategy', 'slices', 'sourceCharCount'], `${command} plan`);
    const chapter = this.decodeChapter(plan['chapter'], `${command} plan.chapter`);
    const strategy = plan['strategy'];
    this.assertStrategy(strategy);
    const sourceCharCount = this.requireNonNegativeInteger(plan, 'sourceCharCount', `${command} plan`);
    const rawSlices = plan['slices'];
    if (!Array.isArray(rawSlices) || rawSlices.length === 0) {
      throw new Error(`${command} returned an empty or invalid slice plan`);
    }
    const slices: ReaderTtsSlice[] = [];
    let priorEnd = 0;
    for (let index = 0; index < rawSlices.length; index += 1) {
      const raw = this.requireObject(rawSlices[index], `${command} slice`);
      this.assertAllowedKeys(raw, ['index', 'text', 'charStart', 'charEnd', 'paragraphIndex'], `${command} slice`);
      const decodedIndex = this.requireNonNegativeInteger(raw, 'index', `${command} slice`);
      const text = this.requireString(raw, 'text', `${command} slice`);
      const charStart = this.requireNonNegativeInteger(raw, 'charStart', `${command} slice`);
      const charEnd = this.requireNonNegativeInteger(raw, 'charEnd', `${command} slice`);
      const paragraphIndex = this.requireNonNegativeInteger(raw, 'paragraphIndex', `${command} slice`);
      if (decodedIndex !== index || text.trim().length === 0 || charEnd <= charStart ||
        charEnd > sourceCharCount || (index > 0 && charStart < priorEnd)) {
        throw new Error(`${command} returned an inconsistent slice plan`);
      }
      priorEnd = charEnd;
      slices.push({ index: decodedIndex, text, charStart, charEnd, paragraphIndex });
    }
    return { chapter, strategy, slices, sourceCharCount };
  }

  private assertPlan(plan: ReaderTtsSlicePlan, command: string): void {
    this.decodePlan(plan, command);
  }

  private decodeSnapshot(value: unknown, command: string): ReaderTtsQueueSnapshot {
    const snapshot = this.requireObject(value, `${command} snapshot`);
    this.assertAllowedKeys(
      snapshot,
      [
        'state', 'currentSliceIndex', 'totalSlices', 'completedSlices', 'chapter', 'sliceStatuses',
        'failurePolicy', 'consecutiveFailures', 'failureLimit', 'drainBehavior', 'restartPolicy',
      ],
      `${command} snapshot`,
    );
    const state = snapshot['state'];
    if (state !== 'idle' && state !== 'playing' && state !== 'paused' && state !== 'completed' && state !== 'stopped') {
      throw new Error(`${command} returned invalid queue state`);
    }
    const totalSlices = this.requireNonNegativeInteger(snapshot, 'totalSlices', `${command} snapshot`);
    const completedSlices = this.requireNonNegativeInteger(snapshot, 'completedSlices', `${command} snapshot`);
    if (completedSlices > totalSlices) {
      throw new Error(`${command} returned completedSlices above totalSlices`);
    }
    const rawCurrent = snapshot['currentSliceIndex'];
    let currentSliceIndex: number | undefined = undefined;
    if (rawCurrent !== undefined && rawCurrent !== null) {
      if (!Number.isSafeInteger(rawCurrent) || (rawCurrent as number) < 0 || (rawCurrent as number) >= totalSlices) {
        throw new Error(`${command} returned invalid currentSliceIndex`);
      }
      currentSliceIndex = rawCurrent as number;
    }
    const rawStatuses = snapshot['sliceStatuses'];
    const sliceStatuses: ReaderTtsSliceStatus[] = [];
    if (rawStatuses !== undefined) {
      if (!Array.isArray(rawStatuses) || (rawStatuses.length !== 0 && rawStatuses.length !== totalSlices)) {
        throw new Error(`${command} returned invalid sliceStatuses length`);
      }
      for (const rawStatus of rawStatuses) {
        if (rawStatus !== 'pending' && rawStatus !== 'speaking' && rawStatus !== 'done' &&
          rawStatus !== 'skipped' && rawStatus !== 'failed') {
          throw new Error(`${command} returned invalid slice status`);
        }
        sliceStatuses.push(rawStatus);
      }
    }
    const failurePolicy = snapshot['failurePolicy'];
    const drainBehavior = snapshot['drainBehavior'];
    const restartPolicy = snapshot['restartPolicy'];
    if ((failurePolicy !== 'skip' && failurePolicy !== 'stop') ||
      (drainBehavior !== 'stop-on-boundary' && drainBehavior !== 'advance-to-next') ||
      restartPolicy !== 'reset-on-core-restart') {
      throw new Error(`${command} returned invalid queue policy`);
    }
    const consecutiveFailures = this.requireNonNegativeInteger(
      snapshot,
      'consecutiveFailures',
      `${command} snapshot`,
    );
    const failureLimit = this.requireNonNegativeInteger(snapshot, 'failureLimit', `${command} snapshot`);
    if (failureLimit === 0) throw new Error(`${command} returned zero failureLimit`);
    const decoded: ReaderTtsQueueSnapshot = {
      state,
      totalSlices,
      completedSlices,
      chapter: this.decodeChapter(snapshot['chapter'], `${command} snapshot.chapter`),
      sliceStatuses,
      failurePolicy,
      consecutiveFailures,
      failureLimit,
      drainBehavior,
      restartPolicy,
    };
    if (currentSliceIndex !== undefined) {
      decoded.currentSliceIndex = currentSliceIndex;
    }
    return decoded;
  }

  private decodeTransition(value: unknown): ReaderTtsChapterTransition {
    const transition = this.requireObject(value, 'tts.chapter.plan transition');
    this.assertAllowedKeys(transition, ['current', 'next', 'drainBehavior'], 'tts.chapter.plan transition');
    const drainBehavior = transition['drainBehavior'];
    if (drainBehavior !== 'stop-on-boundary' && drainBehavior !== 'advance-to-next') {
      throw new Error('tts.chapter.plan returned invalid drainBehavior');
    }
    const decoded: ReaderTtsChapterTransition = {
      current: this.decodeChapter(transition['current'], 'tts.chapter.plan current'),
      drainBehavior,
    };
    if (transition['next'] !== undefined && transition['next'] !== null) {
      decoded.next = this.decodeChapter(transition['next'], 'tts.chapter.plan next');
    }
    return decoded;
  }

  private decodeChapter(value: unknown, label: string): ReaderTtsChapterRef {
    const chapter = this.requireObject(value, label);
    this.assertAllowedKeys(chapter, ['sourceId', 'bookId', 'chapterIndex', 'chapterTitle', 'chapterUrl'], label);
    const decoded: ReaderTtsChapterRef = {
      sourceId: this.requireNonBlankString(chapter, 'sourceId', label),
      bookId: this.requireNonBlankString(chapter, 'bookId', label),
      chapterIndex: this.requireNonNegativeInteger(chapter, 'chapterIndex', label),
    };
    const chapterTitle = this.optionalString(chapter, 'chapterTitle', label);
    const chapterUrl = this.optionalString(chapter, 'chapterUrl', label);
    if (chapterTitle !== undefined) decoded.chapterTitle = chapterTitle;
    if (chapterUrl !== undefined) decoded.chapterUrl = chapterUrl;
    return decoded;
  }

  private assertChapter(chapter: ReaderTtsChapterRef, label: string): void {
    this.decodeChapter(chapter, label);
  }

  private assertSameChapter(
    actual: ReaderTtsChapterRef,
    expected: ReaderTtsChapterRef,
    command: string,
  ): void {
    if (actual.sourceId !== expected.sourceId || actual.bookId !== expected.bookId ||
      actual.chapterIndex !== expected.chapterIndex) {
      throw new Error(`${command} returned a mismatched chapter identity`);
    }
  }

  private decodeConfig(value: unknown, command: string): ReaderTtsConfig {
    const config = this.requireObject(value, `${command} config`);
    this.assertAllowedKeys(config, ['configId', 'engine', 'rate', 'ratePercent', 'pitch', 'followSys'], `${command} config`);
    const decoded: ReaderTtsConfig = {
      rate: this.requireSafeInteger(config, 'rate', `${command} config`),
      pitch: this.requireSafeInteger(config, 'pitch', `${command} config`),
      followSys: this.requireBoolean(config, 'followSys', `${command} config`),
    };
    if (config['ratePercent'] !== undefined && config['ratePercent'] !== null) {
      decoded.ratePercent = this.requireSafeInteger(config, 'ratePercent', `${command} config`);
      this.assertRatePercent(decoded.ratePercent);
    }
    if (config['configId'] !== undefined && config['configId'] !== null) {
      decoded.configId = this.requireSafeInteger(config, 'configId', `${command} config`);
    }
    const engine = this.optionalString(config, 'engine', `${command} config`);
    if (engine !== undefined) decoded.engine = engine;
    return decoded;
  }

  private assertRatePercent(value: number): void {
    if (!Number.isSafeInteger(value) || value < 50 || value > 200 || value % 5 !== 0)
      throw new Error('朗读语速必须在0.5–2.0倍之间，步长0.05');
  }

  private assertConfigUpdate(update: ReaderTtsConfigUpdate): void {
    if (update.ratePercent !== undefined) this.assertRatePercent(update.ratePercent);
    if (!Number.isSafeInteger(update.rate) || !Number.isSafeInteger(update.pitch) ||
      typeof update.followSys !== 'boolean') {
      throw new Error('tts.config.put requires integer rate/pitch and boolean followSys');
    }
    if (update.engine !== undefined && typeof update.engine !== 'string') {
      throw new Error('tts.config.put engine must be a string when provided');
    }
  }

  private assertStrategy(value: unknown): asserts value is ReaderTtsSlicingStrategy {
    if (value !== 'paragraph' && value !== 'sentence' && value !== 'paragraph-then-sentence' && value !== 'line-break') {
      throw new Error('Reader TTS received an invalid slicing strategy');
    }
  }

  private requireObject(value: unknown, label: string): ReaderTtsJsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${label} must be an object`);
    }
    return value as ReaderTtsJsonObject;
  }

  private assertAllowedKeys(value: ReaderTtsJsonObject, keys: string[], label: string): void {
    const actualKeys = Object.keys(value);
    for (const key of actualKeys) {
      if (keys.indexOf(key) < 0) {
        throw new Error(`${label} returned unexpected field ${key}`);
      }
    }
  }

  private requireString(value: ReaderTtsJsonObject, key: string, label: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
      throw new Error(`${label} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireNonBlankString(value: ReaderTtsJsonObject, key: string, label: string): string {
    const candidate = this.requireString(value, key, label);
    if (candidate.trim().length === 0) {
      throw new Error(`${label} returned blank ${key}`);
    }
    return candidate;
  }

  private optionalString(value: ReaderTtsJsonObject, key: string, label: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) return undefined;
    if (typeof candidate !== 'string') {
      throw new Error(`${label} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireBoolean(value: ReaderTtsJsonObject, key: string, label: string): boolean {
    const candidate = value[key];
    if (typeof candidate !== 'boolean') {
      throw new Error(`${label} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireSafeInteger(value: ReaderTtsJsonObject, key: string, label: string): number {
    const candidate = value[key];
    if (!Number.isSafeInteger(candidate)) {
      throw new Error(`${label} returned invalid ${key}`);
    }
    return candidate as number;
  }

  private requireNonNegativeInteger(value: ReaderTtsJsonObject, key: string, label: string): number {
    const candidate = this.requireSafeInteger(value, key, label);
    if (candidate < 0) {
      throw new Error(`${label} returned negative ${key}`);
    }
    return candidate;
  }

  private assertNonNegativeInteger(value: number, label: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative safe integer`);
    }
  }
}
