import { util } from '@kit.ArkTS';
import { hilog } from '@kit.PerformanceAnalysisKit';
import systemDateTime from '@ohos.systemDateTime';

export type ReaderUIVerificationChannel = 'input' | 'business' | 'motion' | 'probe';

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

  static configure(debugBuild: boolean): void {
    ReaderUIVerificationProbe.debugBuild = debugBuild;
  }

  static enabled(): boolean {
    return ReaderUIVerificationProbe.debugBuild &&
      AppStorage.get<boolean>('readerDeveloperMode') === true &&
      AppStorage.get<boolean>('readerAppForeground') === true;
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
