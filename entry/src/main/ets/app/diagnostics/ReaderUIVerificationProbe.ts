import { util } from '@kit.ArkTS';
import { hilog } from '@kit.PerformanceAnalysisKit';
import systemDateTime from '@ohos.systemDateTime';
import type { ReaderPublicFixtureId } from './ReaderPublicFixtureScope';

export type ReaderUIVerificationChannel = 'input' | 'business' | 'motion' | 'probe';

type ReaderVerificationWindowReporter = (windowId: number, windowRevision: number) => boolean;
const SOURCE_IMPORT_TOAST_FIXTURE: ReaderPublicFixtureId = 'import-research-center-v3';
const SOURCE_IMPORT_TOAST_MS = 2200;
const SOURCE_IMPORT_WINDOW_SAMPLE_MS = 250;

interface ReaderUIVerificationEvent {
  instanceId: string;
  eventSeq: number;
  semanticSeq: number;
  deviceMonoMs: number;
  windowRevision: number;
  kind: string;
  channel: ReaderUIVerificationChannel;
  payload: Object;
}

/** Observes the regular app in a developer-enabled debug build. */
export class ReaderUIVerificationProbe {
  private static debugBuild: boolean = false;
  private static instanceId: string = '';
  private static eventSeq: number = 0;
  private static semanticSeq: number = 0;
  private static localId: number = 0;
  private static publicFixture: ReaderPublicFixtureId | undefined = undefined;

  private static toastWindowReporter: ReaderVerificationWindowReporter | undefined = undefined;
  private static stopToastWindowPulse: (() => void) | undefined = undefined;

  static configure(debugBuild: boolean, publicFixture?: ReaderPublicFixtureId): void {
    ReaderUIVerificationProbe.stopToastWindowPulse?.();
    ReaderUIVerificationProbe.debugBuild = debugBuild;
    ReaderUIVerificationProbe.publicFixture = debugBuild ? publicFixture : undefined;
  }

  static publicFixtureScope(): ReaderPublicFixtureId | undefined {
    return ReaderUIVerificationProbe.publicFixture;
  }

  static enabled(): boolean {
    return ReaderUIVerificationProbe.debugBuild &&
      AppStorage.get<boolean>('readerDeveloperMode') === true &&
      AppStorage.get<boolean>('readerAppForeground') === true;
  }

  /** The regular layout overlay owns the window report and its attachment lifetime. */
  static attachSourceImportToastWindowReporter(report: ReaderVerificationWindowReporter): (() => void) | undefined {
    if (ReaderUIVerificationProbe.sourceImportToastPublishedAt(SOURCE_IMPORT_TOAST_MS) === undefined) return undefined;
    ReaderUIVerificationProbe.stopToastWindowPulse?.();
    ReaderUIVerificationProbe.toastWindowReporter = report;
    return (): void => {
      if (ReaderUIVerificationProbe.toastWindowReporter !== report) return;
      ReaderUIVerificationProbe.stopToastWindowPulse?.();
      ReaderUIVerificationProbe.toastWindowReporter = undefined;
    };
  }

  static sourceImportToastPublishedAt(durationMs: number): number | undefined {
    if (!ReaderUIVerificationProbe.enabled() || ReaderUIVerificationProbe.publicFixture !== SOURCE_IMPORT_TOAST_FIXTURE ||
      durationMs !== SOURCE_IMPORT_TOAST_MS) return undefined;
    try {
      return systemDateTime.getUptime(systemDateTime.TimeType.ACTIVE, false);
    } catch (_) {
      return undefined;
    }
  }

  /** Extra real window checkpoints, bounded by the original toast lifetime. */
  static sampleSourceImportToastWindow(publishedAt: number, durationMs: number, windowId: number, windowRevision: number,
    isCurrent: () => boolean): (() => void) | undefined {
    const report = ReaderUIVerificationProbe.toastWindowReporter;
    const now = ReaderUIVerificationProbe.sourceImportToastPublishedAt(durationMs);
    if (report === undefined || now === undefined || !Number.isFinite(publishedAt) || publishedAt > now ||
      publishedAt < 0 || now - publishedAt >= durationMs || !Number.isSafeInteger(windowId) || windowId <= 0 ||
      !Number.isSafeInteger(windowRevision) || windowRevision < 0) return undefined;
    ReaderUIVerificationProbe.stopToastWindowPulse?.();
    let timer = -1;
    let samples = 0;
    const stop = (): void => {
      if (timer >= 0) clearTimeout(timer);
      timer = -1;
      if (ReaderUIVerificationProbe.stopToastWindowPulse === stop) ReaderUIVerificationProbe.stopToastWindowPulse = undefined;
    };
    ReaderUIVerificationProbe.stopToastWindowPulse = stop;
    const tick = (): void => {
      timer = -1;
      try {
        const at = ReaderUIVerificationProbe.sourceImportToastPublishedAt(durationMs);
        if (ReaderUIVerificationProbe.stopToastWindowPulse !== stop || ReaderUIVerificationProbe.toastWindowReporter !== report ||
          at === undefined || at < publishedAt || at - publishedAt >= durationMs ||
          AppStorage.get<number>('readerWindowMetricsRevision') !== windowRevision || !isCurrent()) {
          stop();
          return;
        }
        if (!report(windowId, windowRevision)) {
          stop();
          return;
        }
        if (++samples < Math.ceil(durationMs / SOURCE_IMPORT_WINDOW_SAMPLE_MS) &&
          at + SOURCE_IMPORT_WINDOW_SAMPLE_MS - publishedAt < durationMs) {
          timer = setTimeout(tick, SOURCE_IMPORT_WINDOW_SAMPLE_MS);
        } else stop();
      } catch (_) {
        stop();
      }
    };
    tick();
    return stop;
  }

  static nextIdentity(prefix: string): string {
    return prefix + '-' + (++ReaderUIVerificationProbe.localId).toString();
  }

  static emit(kind: string, channel: ReaderUIVerificationChannel, payload: Object): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    try {
      if (ReaderUIVerificationProbe.instanceId.length === 0) {
        ReaderUIVerificationProbe.instanceId = util.generateRandomUUID();
      }
      const eventSeq = ++ReaderUIVerificationProbe.eventSeq;
      if (kind !== 'window-stable') ReaderUIVerificationProbe.semanticSeq = eventSeq;
      const event: ReaderUIVerificationEvent = {
        instanceId: ReaderUIVerificationProbe.instanceId,
        eventSeq: eventSeq,
        semanticSeq: ReaderUIVerificationProbe.semanticSeq,
        deviceMonoMs: systemDateTime.getUptime(systemDateTime.TimeType.ACTIVE, false),
        windowRevision: AppStorage.get<number>('readerWindowMetricsRevision') ?? 0,
        kind: kind,
        channel: channel,
        payload: payload,
      };
      // Hilog drops long messages. Independently indexed chunks let the host
      // detect missing, out-of-order, or truncated data before admission.
      const record = JSON.stringify(event);
      const chunkSize = 450;
      const count = Math.ceil(record.length / chunkSize);
      for (let index = 0; index < count; index++) {
        const marker = ReaderUIVerificationProbe.instanceId + '/' + eventSeq.toString() + '/' +
          index.toString() + '/' + count.toString() + ' ';
        const chunk = record.slice(index * chunkSize, (index + 1) * chunkSize);
        hilog.info(0x5244, 'ReaderUIContract', 'RUI1 %{public}s%{public}s', marker, chunk);
      }
    } catch (_) {
      // A lost record leaves a sequence gap without changing the app action.
    }
  }
}
