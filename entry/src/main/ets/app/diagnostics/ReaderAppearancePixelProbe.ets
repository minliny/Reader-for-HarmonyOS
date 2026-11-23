import { image } from '@kit.ImageKit';
import { util } from '@kit.ArkTS';
import { window } from '@kit.ArkUI';
import { fileIo } from '@kit.CoreFileKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerMotionNowMs } from '../../ui/foundation/ReaderMotionClock';

export interface ReaderAppearancePixelAnchor {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AppearancePixelSample {
  callbackTimeNs: number;
  requestedAtMonoMs: number;
  returnedAtMonoMs: number;
  copiedAtMonoMs: number;
  sourcePixelFormat: image.PixelMapFormat;
  region: image.Region;
  pixels: ArrayBuffer;
}

interface AppearancePixelPhase {
  opening: boolean;
  triggeredAtMonoMs: number;
  current: () => boolean;
  attempts: number;
  failures: number;
  lastAttemptAtMs: number;
  samples: AppearancePixelSample[];
}

interface AppearancePixelRun {
  id: string;
  win: window.Window;
  windowId: number;
  windowRect: window.Rect;
  stageGeneration: number;
  cacheDir: string;
  current: () => boolean;
  timer: number;
  closingTimer: number;
  sealing: boolean;
  readingId: string;
  selectorId: string;
  generation: number;
  anchor?: ReaderAppearancePixelAnchor;
  open?: AppearancePixelPhase;
  close?: AppearancePixelPhase;
}

const ARM_MS = 45000;
const PHASE_MS = 400;
const MAX_ATTEMPTS = 10;
const MIN_ATTEMPT_GAP_MS = 20;
const TAG = 'ReaderAppearancePixel';

/** Records narrow, window-local pixel strips only after an explicit debug opt-in. */
export class ReaderAppearancePixelProbe {
  private static active: AppearancePixelRun | undefined = undefined;
  private static reading: boolean = false;

  static armed(): boolean { return ReaderAppearancePixelProbe.active !== undefined; }

  static arm(win: window.Window, stageGeneration: number, cacheDir: string,
    current: () => boolean): (() => void) | undefined {
    if (ReaderAppearancePixelProbe.active !== undefined || ReaderAppearancePixelProbe.reading || !current()) return undefined;
    const props = win.getWindowProperties();
    if (!Number.isSafeInteger(props.id) || props.isPrivacyMode !== false ||
      props.windowRect.width <= 0 || props.windowRect.height <= 0) return undefined;
    const run: AppearancePixelRun = {
      id: util.generateRandomUUID(), win: win, windowId: props.id, windowRect: props.windowRect,
      stageGeneration: stageGeneration, cacheDir: cacheDir, current: current, timer: -1, closingTimer: -1,
      sealing: false, readingId: '', selectorId: '', generation: -1,
    };
    ReaderAppearancePixelProbe.active = run;
    run.timer = setTimeout((): void => ReaderAppearancePixelProbe.retire(run, 'expired'), ARM_MS);
    hilog.info(0x5244, TAG, 'armed id=%{public}s window=%{public}d stage=%{public}d', run.id, run.windowId, stageGeneration);
    const id = run.id;
    return (): void => {
      const active = ReaderAppearancePixelProbe.active;
      if (active?.id === id) ReaderAppearancePixelProbe.retire(active, 'window-retired');
    };
  }

  static begin(windowId: number | undefined, readingId: string, selectorId: string, generation: number,
    opening: boolean, current: () => boolean): ((at: number, anchor?: ReaderAppearancePixelAnchor) => void) | undefined {
    const run = ReaderAppearancePixelProbe.active;
    if (run === undefined || windowId !== run.windowId || !ReaderAppearancePixelProbe.valid(run) || run.sealing || !current()) return undefined;
    if (opening) {
      if (run.open !== undefined) return undefined;
      run.readingId = readingId;
      run.selectorId = selectorId;
      run.generation = generation;
    } else if (run.open === undefined || run.close !== undefined || run.readingId !== readingId ||
      run.selectorId !== selectorId || run.generation !== generation) return undefined;
    const phase: AppearancePixelPhase = {
      opening: opening, triggeredAtMonoMs: readerMotionNowMs(), current: current, attempts: 0, failures: 0,
      lastAttemptAtMs: -MIN_ATTEMPT_GAP_MS, samples: [],
    };
    if (opening) run.open = phase;
    else {
      run.close = phase;
      run.closingTimer = setTimeout((): void => { void ReaderAppearancePixelProbe.publish(run); }, PHASE_MS);
    }
    return (at: number, anchor?: ReaderAppearancePixelAnchor): void => ReaderAppearancePixelProbe.sample(run, phase, at, anchor);
  }

  private static valid(run: AppearancePixelRun): boolean {
    return ReaderAppearancePixelProbe.active === run && run.current();
  }

  private static sameCapturableWindow(run: AppearancePixelRun): boolean {
    const props = run.win.getWindowProperties(), rect = props.windowRect, original = run.windowRect;
    return props.id === run.windowId && props.isPrivacyMode === false && run.win.isWindowShowing() &&
      rect.left === original.left && rect.top === original.top && rect.width === original.width && rect.height === original.height;
  }

  private static retire(run: AppearancePixelRun, reason: string): void {
    if (ReaderAppearancePixelProbe.active !== run) return;
    clearTimeout(run.timer);
    clearTimeout(run.closingTimer);
    ReaderAppearancePixelProbe.active = undefined;
    if (run.open !== undefined) run.open.samples.length = 0;
    if (run.close !== undefined) run.close.samples.length = 0;
    hilog.info(0x5244, TAG, 'finished id=%{public}s reason=%{public}s', run.id, reason);
  }

  private static sample(run: AppearancePixelRun, phase: AppearancePixelPhase, callbackTimeNs: number,
    observed?: ReaderAppearancePixelAnchor): void {
    const relativeMs = readerMotionNowMs() - phase.triggeredAtMonoMs;
    if (!ReaderAppearancePixelProbe.valid(run) || run.sealing || !phase.current() || relativeMs < 0 || relativeMs >= PHASE_MS ||
      (phase.opening && run.close !== undefined)) return;
    const prior = run.anchor;
    if (observed !== undefined) {
      if (![observed.id, observed.x, observed.y, observed.width, observed.height].every(Number.isSafeInteger) ||
        observed.x < 0 || observed.y < 0 || observed.width < 1 || observed.width > 64 ||
        observed.height < 1 || observed.height > 1024 || observed.x + observed.width > run.windowRect.width ||
        observed.y + observed.height > run.windowRect.height) return;
      if (prior !== undefined && (observed.id !== prior.id || observed.x !== prior.x || observed.y !== prior.y ||
        observed.width !== prior.width)) return;
      if (prior === undefined || observed.height > prior.height) run.anchor = observed;
    } else if (phase.opening) return;
    const anchor = run.anchor;
    if (anchor === undefined || ReaderAppearancePixelProbe.reading || phase.attempts >= MAX_ATTEMPTS ||
      relativeMs - phase.lastAttemptAtMs < MIN_ATTEMPT_GAP_MS) return;
    const region: image.Region = { x: anchor.x, y: anchor.y, size: { width: anchor.width, height: anchor.height } };
    phase.attempts += 1;
    phase.lastAttemptAtMs = relativeMs;
    ReaderAppearancePixelProbe.reading = true;
    void ReaderAppearancePixelProbe.readStrip(run, phase, callbackTimeNs, region);
  }

  private static async readStrip(run: AppearancePixelRun, phase: AppearancePixelPhase, callbackTimeNs: number,
    region: image.Region): Promise<void> {
    let snapshot: image.PixelMap | undefined;
    try {
      if (!ReaderAppearancePixelProbe.sameCapturableWindow(run)) {
        ReaderAppearancePixelProbe.retire(run, 'window-unavailable-or-private');
        return;
      }
      const requestedAt = readerMotionNowMs();
      snapshot = await run.win.snapshot();
      const returnedAt = readerMotionNowMs();
      if (!ReaderAppearancePixelProbe.valid(run) || run.sealing || !phase.current()) return;
      if (!ReaderAppearancePixelProbe.sameCapturableWindow(run)) {
        ReaderAppearancePixelProbe.retire(run, 'window-unavailable-or-private');
        return;
      }
      const info = snapshot.getImageInfoSync();
      if (info.size.width !== run.windowRect.width || info.size.height !== run.windowRect.height ||
        (info.pixelFormat !== image.PixelMapFormat.RGBA_8888 && info.pixelFormat !== image.PixelMapFormat.BGRA_8888)) {
        phase.failures += 1;
        hilog.info(0x5244, TAG, 'unsupported id=%{public}s width=%{public}d height=%{public}d format=%{public}d',
          run.id, info.size.width, info.size.height, info.pixelFormat);
        return;
      }
      const stride = region.size.width * 4;
      const pixels = new ArrayBuffer(stride * region.size.height);
      await snapshot.readPixels({ pixels: pixels, offset: 0, stride: stride, region: region });
      if (!ReaderAppearancePixelProbe.valid(run) || run.sealing || !phase.current()) return;
      phase.samples.push({
        callbackTimeNs: callbackTimeNs, requestedAtMonoMs: requestedAt, returnedAtMonoMs: returnedAt,
        copiedAtMonoMs: readerMotionNowMs(), sourcePixelFormat: info.pixelFormat, region: region, pixels: pixels,
      });
    } catch (_) {
      phase.failures += 1;
    } finally {
      try { await snapshot?.release(); } catch (_) {}
      ReaderAppearancePixelProbe.reading = false;
    }
  }

  private static async publish(run: AppearancePixelRun): Promise<void> {
    if (!ReaderAppearancePixelProbe.valid(run) || run.close?.current() !== true || run.open === undefined) {
      ReaderAppearancePixelProbe.retire(run, 'observer-changed');
      return;
    }
    run.sealing = true;
    try {
      for (const phase of [run.open, run.close]) {
        for (let index = 0; index < phase.samples.length; index++) {
          if (!ReaderAppearancePixelProbe.valid(run) || !run.close.current()) return;
          await ReaderAppearancePixelProbe.writeStrip(run, phase, phase.samples[index], index);
        }
        hilog.info(0x5244, TAG, 'phase id=%{public}s opening=%{public}s attempts=%{public}d failures=%{public}d strips=%{public}d',
          run.id, String(phase.opening), phase.attempts, phase.failures, phase.samples.length);
      }
    } catch (_) {
      ReaderAppearancePixelProbe.retire(run, 'encode-failed');
    } finally {
      ReaderAppearancePixelProbe.retire(run, 'qualification-ended');
    }
  }

  private static async writeStrip(run: AppearancePixelRun, phase: AppearancePixelPhase, sample: AppearancePixelSample,
    index: number): Promise<void> {
    const map = await image.createPixelMap(sample.pixels, {
      size: sample.region.size, srcPixelFormat: image.PixelMapFormat.BGRA_8888, pixelFormat: image.PixelMapFormat.RGBA_8888,
    });
    let packer: image.ImagePacker | undefined;
    let file: fileIo.File | undefined;
    let created = false;
    let published = false;
    const name = 'reader-appearance-pixels-' + run.id + '-' + (phase.opening ? 'open' : 'close') + '-' + index.toString() + '.png';
    const path = run.cacheDir + '/' + name;
    try {
      if (!ReaderAppearancePixelProbe.valid(run) || run.close?.current() !== true) return;
      packer = image.createImagePacker();
      file = await fileIo.open(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.WRITE_ONLY);
      created = true;
      await packer.packToFile(map, file.fd, { format: 'image/png', quality: 100 });
      await fileIo.close(file);
      file = undefined;
      published = ReaderAppearancePixelProbe.valid(run) && run.close?.current() === true;
      if (!published) return;
      hilog.info(0x5244, TAG, 'strip %{public}s', JSON.stringify({
        id: run.id, name: name, windowId: run.windowId, stageGeneration: run.stageGeneration, readingId: run.readingId,
        selectorId: run.selectorId, generation: run.generation, actorId: run.anchor?.id, opening: phase.opening,
        triggeredAtMonoMs: phase.triggeredAtMonoMs, callbackTimeNs: sample.callbackTimeNs, requestedAtMonoMs: sample.requestedAtMonoMs,
        returnedAtMonoMs: sample.returnedAtMonoMs, copiedAtMonoMs: sample.copiedAtMonoMs, region: sample.region,
        sourcePixelFormat: sample.sourcePixelFormat, roiPixelFormat: 'BGRA_8888',
      }));
    } finally {
      try { if (file !== undefined) await fileIo.close(file); } catch (_) {}
      try { if (created && !published) await fileIo.unlink(path); } catch (_) {}
      try { await packer?.release(); } catch (_) {}
      try { await map.release(); } catch (_) {}
    }
  }
}
