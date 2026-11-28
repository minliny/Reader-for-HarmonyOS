import type { UIContext } from '@ohos.arkui.UIContext';
import { TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY } from '../../../ui/foundation/ReaderTypography';
import {
  READER_TTS_TIMER_DEFAULT_MINUTES,
  READER_TTS_TIMER_MAX_MINUTES,
  READER_TTS_TIMER_MAX_SECONDS,
  READER_TTS_TIMER_MIN,
  type ReaderTtsState,
  type ReaderTtsTimerMode,
} from '../application/ReaderTtsState';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import { readerTtsLanguageLabel } from '../presentation/ReaderTtsConfigOptions';
import { readerControlTtsSessionLabel } from './ReaderControlTtsMinimum';
import type { ReaderControlTtsField, ReaderControlTtsToggle } from './ReaderControlTtsModifiers';

export interface TtsTimerUpdate {
  minutes: number;
  seconds: number;
  mode: ReaderTtsTimerMode;
}

export function ttsFieldLabel(kind: ReaderControlTtsField): string {
  if (kind === 'voice') return '音色选项';
  if (kind === 'engine') return '语音引擎';
  if (kind === 'language') return '朗读语言';
  return kind === 'session' ? '音频会话' : '不可用处理';
}

export function ttsFieldValueText(
  kind: ReaderControlTtsField,
  displayedEngine: string | undefined,
  displayedLanguage: string | undefined,
  displayedFailure: string | undefined,
  voiceLabel: string,
  systemEngineDisplay: string,
  httpSelected: boolean,
  language: string,
  allowMixing: boolean,
  failurePolicy: 'skip' | 'stop',
): string {
  if (kind === 'voice') return voiceLabel;
  if (kind === 'engine') return displayedEngine ?? systemEngineDisplay;
  if (kind === 'language') return displayedLanguage ?? (httpSelected ? '由在线服务提供' : readerTtsLanguageLabel(language));
  if (kind === 'session') return readerControlTtsSessionLabel(allowMixing);
  return displayedFailure ?? (failurePolicy === 'skip' ? '跳过不可用内容' : '停止并提示');
}

export function measureTtsFieldWidth(
  context: UIContext,
  kind: ReaderControlTtsField,
  valueText: string,
  configWidth: number,
): number {
  const style = TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY;
  const width = context.px2vp(context.getMeasureUtils().measureText({
    textContent: valueText,
    fontSize: style.fontSizeFp,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
  }));
  const chrome = kind === 'voice' ? 61 : 18;
  const cap = Math.max(70, Math.min(170, configWidth * 0.56));
  return Math.min(cap, Math.ceil(Number.isFinite(width) ? width : 0) + chrome);
}

export function measureTtsFieldHeight(
  context: UIContext,
  kind: ReaderControlTtsField,
  valueText: string,
): number {
  const style = TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY;
  const measured = context.getMeasureUtils().measureTextSize({
    textContent: valueText || '字',
    fontSize: style.fontSizeFp,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeightFp === undefined ? undefined : `${style.lineHeightFp}fp`,
  });
  const height = context.px2vp(Number(measured.height));
  return Math.max(kind === 'voice' ? 30 : 48, Math.ceil(Number.isFinite(height) ? height : 12) + 8);
}

export function ttsToggleLabel(kind: ReaderControlTtsToggle): string {
  if (kind === 'followHighlight') return '跟随高亮';
  if (kind === 'pauseOnInterruption') return '来电自动暂停';
  if (kind === 'allowMixing') return '允许与其他应用同时播放';
  return kind === 'backgroundPlayback' ? '后台继续朗读' : '朗读时屏幕常亮';
}

export function nextQuickTimerPreset(
  timerMode: ReaderTtsTimerMode,
  timerMinutes: number,
  timerSeconds: number,
): TtsTimerUpdate {
  const presets: Array<number | 'chapterEnd'> = [0, 15, 30, 60, 'chapterEnd'];
  const current = timerMode === 'chapterEnd' ? presets.length - 1 :
    (timerMode === 'off' || (timerSeconds === 0 && timerMinutes === 0) ? 0 :
      (timerSeconds === 0 ? presets.indexOf(timerMinutes) : -1));
  const next = presets[(current + 1) % presets.length];
  if (next === 'chapterEnd') return { minutes: 0, seconds: 0, mode: 'chapterEnd' };
  if (next === 0) return { minutes: 0, seconds: 0, mode: 'off' };
  return { minutes: next, seconds: 0, mode: 'duration' };
}

export function nextSteppedTimer(
  minutes: boolean,
  delta: number,
  timerMode: ReaderTtsTimerMode,
  timerMinutes: number,
  timerSeconds: number,
): TtsTimerUpdate {
  if (minutes) {
    const base = timerMode === 'duration' ? timerMinutes : 0;
    const nextMinutes = timerMode !== 'duration' ?
      (delta > 0 ? READER_TTS_TIMER_DEFAULT_MINUTES : READER_TTS_TIMER_MIN) :
      Math.max(delta < 0 ? READER_TTS_TIMER_MIN : 1, Math.min(READER_TTS_TIMER_MAX_MINUTES, base + delta));
    return { minutes: nextMinutes, seconds: timerMode === 'duration' ? timerSeconds : 0, mode: 'duration' };
  }
  const nextSeconds = Math.max(READER_TTS_TIMER_MIN, Math.min(READER_TTS_TIMER_MAX_SECONDS, timerSeconds + delta));
  return {
    minutes: timerMode === 'duration' ? timerMinutes : READER_TTS_TIMER_DEFAULT_MINUTES,
    seconds: nextSeconds,
    mode: 'duration',
  };
}

export function ttsTimerPresetLabel(minutes: number | 'chapterEnd'): string {
  return minutes === 'chapterEnd' ? '本章结束' : (minutes === 0 ? '不开启' : `${minutes} 分钟`);
}

export function ttsOnlineServiceDescription(
  displayedDescription: string | undefined,
  engineId: string,
  httpEngines: ReaderHttpTtsConfig[],
): string {
  if (displayedDescription !== undefined) return displayedDescription;
  return httpEngines.find((option: ReaderHttpTtsConfig): boolean => `http-tts:${option.id}` === engineId)?.name ?? '第三方语音服务';
}

export function ttsOnlineAccessibilityText(httpEngines: ReaderHttpTtsConfig[]): string {
  if (httpEngines.length === 0) return '在线 TTS，尚未配置第三方或自定义服务';
  return `在线 TTS，${httpEngines.length} 个已配置服务`;
}

export function ttsControlText(
  kind: 'previous' | 'toggle' | 'stop' | 'next',
  displayState: ReaderTtsState,
  activelySpeaking: boolean,
): string {
  if (kind === 'previous') return '上一句';
  if (kind === 'next') return '下一句';
  if (kind === 'stop') return '停止朗读';
  if (kind === 'toggle' && (displayState.status === 'error' || displayState.status === 'failed' || displayState.status === 'unavailable')) {
    return '重试朗读';
  }
  return activelySpeaking ? '暂停朗读' : '开始或继续朗读';
}

export function ttsHasActiveQueue(state: ReaderTtsState): boolean {
  return state.status === 'preparing' || state.status === 'playing' ||
    state.status === 'paused' || state.status === 'resuming' || state.status === 'interrupted';
}
