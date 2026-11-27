import type { ReaderTtsVoiceOption } from '../application/ReaderTtsPreferencesState';
import type { ReaderTtsState, ReaderTtsTimerMode } from '../application/ReaderTtsState';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import { ReaderControlAutoPageContent } from './ReaderControlAutoPageContent';
import type { ReaderControlLaunchSource } from './ReaderControlPanelNativeContract';
import { ReaderControlTtsContent } from './ReaderControlTtsContent';

interface ReaderSessionLaunchAutomaticSource {
  readonly status: ReaderAutoPageStatus;
  readonly speedSeconds: number;
  readonly timerSummary: string;
  readonly timerMinutes: number;
  readonly timerSeconds: number;
  readonly followHighlight: boolean;
}

interface ReaderSessionLaunchSpeechSource {
  readonly state: ReaderTtsState;
  readonly timerMode: ReaderTtsTimerMode;
  readonly timerMinutes: number;
  readonly timerSeconds: number;
  readonly engine: string;
  readonly language: string;
  readonly person: number;
  readonly voiceOptions: ReaderTtsVoiceOption[];
  readonly followHighlight: boolean;
}

export interface ReaderSessionLaunchSharpSourceInput {
  readonly generation: number;
  readonly source: ReaderControlLaunchSource | undefined;
  readonly reduceMotion: boolean;
  readonly automatic: ReaderSessionLaunchAutomaticSource;
  readonly speech: ReaderSessionLaunchSpeechSource;
}

/** Renders the frozen sharp source only while its measured control pose is current. */
@Builder
export function ReaderSessionLaunchSharpSource($$: ReaderSessionLaunchSharpSourceInput) {
  if ($$.source !== undefined && $$.source.generation === $$.generation && $$.source.current()) {
    if ($$.source.kind === 'quickAutoPage' || $$.source.kind === 'fullAutoPagePlayback') {
      ReaderControlAutoPageContent({
        fixedIsland: true,
        sourceMinimum: $$.source.minimum,
        sourceMinimumIdentity: $$.source.minimum?.identity ?? '',
        sourceMinimumKey: $$.source.minimum?.key ?? '',
        sourceMinimumMetricsRevision: $$.source.minimum?.metricsRevision ?? -1,
        sourceOnly: $$.source.kind === 'quickAutoPage' ? 'quick' : 'full',
        form: $$.source.kind === 'quickAutoPage' ? 'quick' : 'full',
        motionProgress: $$.source.motionProgress, availableWidth: $$.source.width,
        availableHeight: $$.source.height, fullViewportHeight: $$.source.fullHeight,
        interactionEnabled: false, status: $$.automatic.status, speedSeconds: $$.automatic.speedSeconds,
        timerSummaryText: $$.automatic.timerSummary, timerMinutes: $$.automatic.timerMinutes,
        timerSeconds: $$.automatic.timerSeconds, followHighlight: $$.automatic.followHighlight,
        canPreviousChapter: $$.source.canPrevious, canNextChapter: $$.source.canNext,
      });
    } else {
      ReaderControlTtsContent({
        fixedIsland: true,
        sourceMinimum: $$.source.minimum,
        sourceMinimumIdentity: $$.source.minimum?.identity ?? '',
        sourceMinimumKey: $$.source.minimum?.key ?? '',
        sourceMinimumMetricsRevision: $$.source.minimum?.metricsRevision ?? -1,
        sourceOnly: $$.source.kind === 'quickTts' ? 'quick' : 'full',
        frozenWaveformSample: $$.source.waveform, reduceMotion: $$.reduceMotion,
        form: $$.source.kind === 'quickTts' ? 'quick' : 'full',
        motionProgress: $$.source.motionProgress, availableWidth: $$.source.width,
        availableHeight: $$.source.height, fullViewportHeight: $$.source.fullHeight,
        interactionEnabled: false, state: $$.speech.state, timerMode: $$.speech.timerMode,
        timerMinutes: $$.speech.timerMinutes, timerSeconds: $$.speech.timerSeconds,
        engine: $$.speech.engine, language: $$.speech.language, person: $$.speech.person,
        voiceOptions: $$.speech.voiceOptions, followHighlight: $$.speech.followHighlight,
      });
    }
  }
}
