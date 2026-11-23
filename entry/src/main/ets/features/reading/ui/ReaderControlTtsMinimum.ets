import { READER_TTS_RATE_MIN, type ReaderTtsState, type ReaderTtsTimerMode } from '../application/ReaderTtsState';
import type { ReaderTtsVoiceOption } from '../application/ReaderTtsPreferencesState';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import { readerTtsLanguageLabel } from '../presentation/ReaderTtsConfigOptions';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderTextStyle, ReaderInheritedTextStyle,
  TYPE_READER_TTS_QUICK_PLAYBACK_LABEL, TYPE_READER_TTS_QUICK_SETTING_LABEL,
  TYPE_READER_TTS_SECTION_META, TYPE_READER_TTS_SECTION_SPEED_META,
  TYPE_READER_TTS_RETAINED_MODULE_HEADER_VALUE, TYPE_READER_TTS_RETAINED_QUICK_LABEL_VALUE,
  TYPE_READER_TTS_RETAINED_PLAYBACK_LABEL, TYPE_READER_TTS_RETAINED_ROUND_CONTROL_LABEL,
  TYPE_READER_TTS_RETAINED_TIMER_META, TYPE_READER_TTS_RETAINED_TIMER_LABEL,
  TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY, TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE,
  TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE, TYPE_READER_TTS_RETAINED_SPEED_VALUE,
  TYPE_READER_TTS_RETAINED_SPEED_VALUE_SECONDARY, TYPE_READER_TTS_RETAINED_RATE_PRESET_VALUE,
  TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL, TYPE_READER_TTS_RETAINED_SECTION_HEADER_META,
  TYPE_READER_TTS_RETAINED_VOICE_SELECTOR_ROW_LABEL,
  TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE,
  TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE_SECONDARY,
  TYPE_READER_TTS_RETAINED_TTS_CLOSED_CONFIG_ROW_VALUE,
  TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE,
  TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY,
  TYPE_READER_TTS_RETAINED_TOGGLE_ROW_VALUE,
  TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL,
  TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE } from '../../../ui/foundation/ReaderTypography';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import type { ReaderControlCandidateWidths, ReaderControlModuleMinimum } from './ReaderLayoutGeometry';
import { sampleReaderControlTts, type ReaderControlTtsFrame,
  type ReaderControlTtsNaturalProfile } from './ReaderControlPlaybackGeometry';
import { readerControlLerp } from './ReaderControlActorGeometry';
import { measureReaderControlText, type ReaderControlTextExtent } from './ReaderControlTextMeasurement';

export interface ReaderTtsMinimumFactsInput {
  state: ReaderTtsState;
  timerMode: ReaderTtsTimerMode;
  timerMinutes: number;
  timerSeconds: number;
  failurePolicy: 'skip' | 'stop';
  allowMixing: boolean;
  engine: string;
  httpEngines: ReaderHttpTtsConfig[];
  voiceOptions: ReaderTtsVoiceOption[];
  language: string;
  person: number;
  ratePreview: number;
  serviceTab: string;
}
export function readerControlTtsPlaybackLabel(state: ReaderTtsState): string {
  const status = state.status;
  return status === 'playing' ? '朗读中' : status === 'preparing' || status === 'resuming' ? '准备中' :
    status === 'paused' || status === 'interrupted' ? '继续' : status === 'error' || status === 'failed' ? '失败·重试' :
    status === 'unavailable' ? '不可用' : status === 'stopping' ? '停止中' : status === 'completed' ? '已完成' : status === 'probing' ? '检查中' : '未开始';
}
export function readerControlTtsStatusLabel(state: ReaderTtsState): string {
  const status = state.status;
  return status === 'playing' ? '朗读中' : status === 'paused' ? '已暂停' : status === 'interrupted' ? '已中断' :
    status === 'probing' ? '正在检查朗读可用性' : status === 'preparing' || status === 'resuming' ? '准备中' :
    status === 'completed' ? '已完成' : status === 'stopping' ? '停止中' : status === 'error' || status === 'failed' ? '播放失败' :
    status === 'unavailable' ? '当前引擎不可用' : '未开始';
}
export function readerControlTtsTwoDigits(value: number): string {
  const normalized = Math.max(0, Math.trunc(value));
  return normalized < 10 ? `0${normalized}` : `${normalized}`;
}
export function readerControlTtsTimerSummary(minutes: number, seconds: number): string {
  return `${readerControlTtsTwoDigits(minutes)}:${readerControlTtsTwoDigits(seconds)}`;
}
export function readerControlTtsTimerCaption(mode: ReaderTtsTimerMode, minutes: number, seconds: number): string {
  return mode === 'chapterEnd' ? '本章结束' : mode === 'off' || minutes === 0 && seconds === 0 ?
    '不开启' : seconds === 0 ? `${minutes} 分钟` : readerControlTtsTimerSummary(minutes, seconds);
}
export function readerControlTtsEngineLabel(engine: string, engines: ReaderHttpTtsConfig[]): string {
  if (!engine.startsWith('http-tts:')) return '系统离线';
  const id = Number(engine.slice('http-tts:'.length));
  return engines.find((entry: ReaderHttpTtsConfig): boolean => entry.id === id)?.name ?? '在线配置失效';
}
export function readerControlTtsVoiceLabel(engine: string, online: boolean, voices: ReaderTtsVoiceOption[], language: string, person: number): string {
  if (online && !engine.startsWith('http-tts:')) return '尚未配置在线服务';
  if (engine.startsWith('http-tts:')) return '由在线服务提供';
  if (voices.length === 0) return '暂无可用音色';
  return voices.find((entry: ReaderTtsVoiceOption): boolean => entry.language === language && entry.person === person)?.label ?? `${language} · 音色 ${person}`;
}
export function readerControlTtsMinimumFacts(input: ReaderTtsMinimumFactsInput): ReaderTtsMinimumFacts {
  const state = input.state;
  const http = input.engine.startsWith('http-tts:');
  const online = input.serviceTab === '' ? http : input.serviceTab === 'online';
  const engineId = http ? input.engine : input.httpEngines.length > 0 ? `http-tts:${input.httpEngines[0].id}` : '';
  const service = input.httpEngines.find((entry: ReaderHttpTtsConfig): boolean => `http-tts:${entry.id}` === engineId);
  const minutes = readerControlTtsTwoDigits(input.timerMinutes);
  const seconds = readerControlTtsTwoDigits(input.timerSeconds);
  const timer = readerControlTtsTimerSummary(input.timerMinutes, input.timerSeconds);
  return { readViewState: (): ReaderTtsState => state, viewTimerMode: input.timerMode,
    viewTimerMinutes: input.timerMinutes, viewTimerSeconds: input.timerSeconds,
    viewRate: input.ratePreview >= READER_TTS_RATE_MIN ? input.ratePreview : input.state.rate, playbackLabel: readerControlTtsPlaybackLabel(input.state), status: readerControlTtsStatusLabel(input.state),
    voice: readerControlTtsVoiceLabel(input.engine, online, input.voiceOptions, input.language, input.person),
    timerCaption: readerControlTtsTimerCaption(input.timerMode, input.timerMinutes, input.timerSeconds),
    timerSummary: timer, minutes: minutes, seconds: seconds,
    rate: (input.ratePreview >= READER_TTS_RATE_MIN ? input.ratePreview : input.state.rate).toFixed(2) + 'x',
    error: input.state.errorMessage ?? '', seek: input.state.totalSlices > 1, online: online,
    serviceDescription: service?.name ?? '第三方语音服务', manageLabel: input.httpEngines.length > 0 ? '已配置 · 编辑' : '立即配置',
    manageBorderWidth: input.httpEngines.length > 0 ? 0.5 : 0,
    engineValue: http ? readerControlTtsEngineLabel(input.engine, input.httpEngines) : '系统默认', languageValue: http ? '由在线服务提供' : readerTtsLanguageLabel(input.language),
    failureValue: input.failurePolicy === 'skip' ? '跳过不可用内容' : '停止并提示' };
}
/** Display facts captured by the mounted module, never another TTS state owner. */
export interface ReaderTtsMinimumFacts {
  readViewState: () => ReaderTtsState;
  viewTimerMode: ReaderTtsTimerMode;
  viewTimerMinutes: number;
  viewTimerSeconds: number;
  viewRate: number;
  playbackLabel: string;
  status: string;
  voice: string;
  timerCaption: string;
  timerSummary: string;
  minutes: string;
  seconds: string;
  rate: string;
  error: string;
  seek: boolean;
  online: boolean;
  serviceDescription: string;
  manageLabel: string;
  manageBorderWidth?: number;
  engineValue: string;
  languageValue: string;
  failureValue: string;
}

/** Only existing leaf frames whose text can outgrow its authored box. */
export interface ReaderTtsTextMinimum {
  quickPlaybackTitle: number;
  quickPlaybackStatus: number;
  quickSettingTitle: number;
  header: number;
  playbackMetaWidth: number;
  sectionHeader: number;
  stopLabel: number;
  stopLabelWidth: number;
  timerPreset: number;
  timerPresetPaint: number;
  quickTimerPaintHeight: number;
  timerPresetsWidth: number;
  timerCustom: number;
  timerCustomWidth: number;
  timerCustomLayout: 'inline' | 'labelAbove' | 'stacked';
  timerCustomLabelWidth: number;
  timerCustomLabelHeight: number;
  timerStepperWidth: number;
  timerUnitLabelHeight: number;
  timerStepButtonWidth: number;
  timerDigit: number;
  timerDigitWidth: number;
  timerStepper: number;
  timerStepButton: number;
  ratePreset: number;
  ratePresetPaint: number;
  speedRange: number;
  speedRangeWidth: number;
  speedRangeY: number;
  serviceTab: number;
  serviceTabTitle: number;
  serviceTabSubtitle: number;
  configRow: number;
  voiceRow: number;
  toggleRow: number;
  detailCard: number;
  systemCard: number;
  voiceBadge: number;
  voiceBadgeWidth: number;
  voiceField: number;
  configField: number;
  voiceFieldWidth: number;
  engineFieldWidth: number;
  languageFieldWidth: number;
  failureFieldWidth: number;
  manageButton: number;
  manageButtonWidth: number;
  seekY: number;
  errorY: number;
}

export interface ReaderTtsMinimumProfile extends ReaderControlTtsNaturalProfile {
  quickText: ReaderTtsTextMinimum;
  fullText: ReaderTtsTextMinimum;
  minimum: ReaderControlModuleMinimum;
}

export interface ReaderTtsTimerCardLayout {
  topPadding: number;
  rowGap: number;
  sectionGap: number;
  height: number;
}

/** Adjacent44vp targets use the original8vp painted-row gap and surrounding
 * blank space. Default36vp paint therefore keeps the approved168vp card. */
export function readerTtsTimerCardLayout(targetHeight: number, paintHeight: number,
  customHeight: number): ReaderTtsTimerCardLayout {
  const extra = Math.max(0, targetHeight - paintHeight);
  const topPadding = Math.max(0, 14 - extra / 2);
  const rowGap = Math.max(0, 8 - extra);
  const sectionGap = Math.max(0, 12 - extra / 2);
  return { topPadding: topPadding, rowGap: rowGap, sectionGap: sectionGap,
    height: topPadding + 14 + targetHeight * 2 + rowGap + sectionGap + customHeight };
}

/** The custom timer owns one paid viewport. Only its vertical button carrier
 * requests44vp; the authored30vp horizontal slots remain independent. */
function customTimerLayout(text: ReaderTtsTextMinimum): void {
  const contentWidth = Math.max(0, text.timerCustomWidth - 16 - 1);
  const groupsWidth = text.timerStepperWidth * 2 + 4;
  if (text.timerCustomLabelWidth + 8 + text.timerStepperWidth * 2 <= contentWidth) {
    text.timerCustomLayout = 'inline';
    text.timerCustom = Math.max(48, text.timerCustomLabelHeight + 8, text.timerStepper + 4);
    return;
  }
  const groupHeight = text.timerUnitLabelHeight + 2 + text.timerStepper;
  text.timerCustomLayout = groupsWidth <= contentWidth ? 'labelAbove' : 'stacked';
  text.timerCustom = 1 + 8 + text.timerCustomLabelHeight + 4 + groupHeight +
    (text.timerCustomLayout === 'stacked' ? 4 + groupHeight : 0);
}

// These leaves do not call Text.lineHeight. Speed values additionally retain
// ArkUI's inherited weight. Do not measure a stronger recipe than is painted.
function actual(style: ReaderTextStyle | ReaderInheritedTextStyle, weight: boolean = true): ReaderInheritedTextStyle {
  return new ReaderInheritedTextStyle(style.fontFamily, weight ? style.fontWeight : undefined,
    style.fontSizeFp, undefined, undefined, 'system', 'appBaseline');
}

function largest(context: UIContext, texts: string[], style: ReaderTextStyle | ReaderInheritedTextStyle,
  width: number, wrap: boolean = false): ReaderControlTextExtent | undefined {
  let result: ReaderControlTextExtent | undefined = undefined;
  for (const text of texts) {
    const extent = measureReaderControlText(context, text, style, width, wrap ? 'wrap' : 'singleLine');
    if (extent === undefined) return undefined;
    if (result === undefined) result = extent;
    else result = { widthVp: Math.max(result.widthVp, extent.widthVp),
      heightVp: Math.max(result.heightVp, extent.heightVp),
      singleLineWidthVp: Math.max(result.singleLineWidthVp, extent.singleLineWidthVp),
      fitsWidth: result.fitsWidth && extent.fitsWidth };
  }
  return result;
}

interface ReaderTtsMeasuredForm {
  frame: ReaderControlTtsFrame;
  text: ReaderTtsTextMinimum;
  minWidth: number;
}

function measureForm(context: UIContext, width: number, full: boolean,
  facts: ReaderTtsMinimumFacts): ReaderTtsMeasuredForm | undefined {
  const frame = sampleReaderControlTts(full ? 1 : 0, width, 1 / 3, 0, facts.online);
  const inner = frame.playback.width;
  if (inner <= 100) return undefined;
  const qPlayback = largest(context, ['播放'], TYPE_READER_TTS_QUICK_PLAYBACK_LABEL, inner);
  const qStatus = largest(context, [facts.playbackLabel], TYPE_READER_TTS_RETAINED_QUICK_LABEL_VALUE, inner);
  const qSetting = largest(context, ['定时', '语速'], actual(TYPE_READER_TTS_QUICK_SETTING_LABEL), inner);
  const header = largest(context, ['朗读控制', '定时停止', '语速'], actual(TYPE_READER_TTS_RETAINED_MODULE_HEADER_VALUE), inner);
  const playbackMeta = largest(context, [facts.status], TYPE_READER_TTS_SECTION_META, inner);
  const timerMeta = largest(context, [facts.timerSummary], TYPE_READER_TTS_SECTION_META, inner);
  const speedMeta = largest(context, [facts.rate], TYPE_READER_TTS_SECTION_SPEED_META, inner);
  const voice = largest(context, ['当前音色 · ' + facts.voice], actual(TYPE_READER_TTS_RETAINED_PLAYBACK_LABEL), Math.max(1, frame.voice.width - 22));
  const stop = largest(context, ['停止'], TYPE_READER_TTS_RETAINED_ROUND_CONTROL_LABEL, inner);
  const caption = largest(context, [facts.timerCaption], TYPE_READER_TTS_RETAINED_TIMER_META, inner);
  const timerPreset = largest(context, ['不开启', '15 分钟', '30 分钟', '45 分钟', '60 分钟', '本章结束'],
    TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE, Math.max(1, (inner - 44) / 3));
  const custom = largest(context, ['自定义时长'], actual(TYPE_READER_TTS_RETAINED_TIMER_LABEL), inner);
  const customMeta = largest(context, ['分 · 秒'], actual(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY), inner);
  const timerUnit = largest(context, ['分', '秒'], actual(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY), inner);
  const digit = largest(context, [facts.minutes, facts.seconds], actual(TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE), inner);
  const rate = largest(context, [facts.rate], actual(TYPE_READER_TTS_RETAINED_SPEED_VALUE, false), inner);
  const range = largest(context, ['0.50x', '2.00x'], actual(TYPE_READER_TTS_RETAINED_SPEED_VALUE_SECONDARY, false), inner);
  const ratePreset = largest(context, ['0.50x', '0.75x', '1.00x', '1.25x', '1.50x'],
    TYPE_READER_TTS_RETAINED_RATE_PRESET_VALUE, Math.max(1, (inner - 64) / 5));
  const section = largest(context, ['播放配置', '朗读引擎'], actual(TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL), inner);
  const sectionMeta = largest(context, ['即时生效'], actual(TYPE_READER_TTS_RETAINED_SECTION_HEADER_META), inner);
  const tabTitle = largest(context, ['系统 TTS', '在线 TTS'], actual(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE),
    Math.max(1, (inner - 38) / 2 - 27), true);
  const tabSubtitle = largest(context, ['设备内置语音', facts.serviceDescription],
    actual(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE_SECONDARY), Math.max(1, (inner - 38) / 2 - 24));
  const labels = largest(context, ['语音引擎', '朗读语言', '不可用处理'],
    actual(TYPE_READER_TTS_RETAINED_TTS_CLOSED_CONFIG_ROW_VALUE), inner);
  const field = largest(context, [facts.voice, facts.engineValue, facts.languageValue, facts.failureValue],
    actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  const fieldGlyph = largest(context, ['字'], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  const voiceBadge = largest(context, ['女', '男', '声'], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE), inner);
  const voiceTitle = largest(context, ['音色'], actual(TYPE_READER_TTS_RETAINED_VOICE_SELECTOR_ROW_LABEL), inner);
  const toggle = largest(context, ['跟随高亮', '来电自动暂停', '允许与其他应用同时播放', '后台继续朗读', '朗读时屏幕常亮'],
    actual(TYPE_READER_TTS_RETAINED_TOGGLE_ROW_VALUE), Math.max(1, inner - 78), true);
  const toggleLine = largest(context, ['高'], actual(TYPE_READER_TTS_RETAINED_TOGGLE_ROW_VALUE), inner);
  const manage = largest(context, [facts.manageLabel], actual(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE), inner);
  const manageHorizontalReserve = 38 + (facts.manageBorderWidth ?? 0.5) * 2;
  const manageTitle = largest(context, ['服务信息'], actual(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL), inner);
  const error = measureReaderControlText(context, facts.error, MESSAGE_BODY, inner - 32, 'wrap');
  const values: (ReaderControlTextExtent | undefined)[] = [qPlayback, qStatus, qSetting, header, playbackMeta, timerMeta,
    speedMeta, voice, stop, caption, timerPreset, custom, customMeta, digit, rate, range, ratePreset,
    section, sectionMeta, tabTitle, tabSubtitle, labels, field, voiceBadge, toggle, manage, manageTitle, error];
  for (const value of values) if (value === undefined) return undefined;
  // Narrow explicitly after the complete native-read failure check.
  if (qPlayback === undefined || qStatus === undefined || qSetting === undefined || header === undefined ||
    playbackMeta === undefined || timerMeta === undefined || speedMeta === undefined || voice === undefined || stop === undefined ||
    caption === undefined || timerPreset === undefined || custom === undefined || customMeta === undefined ||
    digit === undefined || rate === undefined || range === undefined || ratePreset === undefined || section === undefined ||
    sectionMeta === undefined || tabTitle === undefined || tabSubtitle === undefined || labels === undefined ||
    field === undefined || fieldGlyph === undefined || voiceBadge === undefined || voiceTitle === undefined ||
    toggle === undefined || toggleLine === undefined || manage === undefined || timerUnit === undefined ||
    manageTitle === undefined || error === undefined) return undefined;

  const cap = Math.max(70, Math.min(170, inner * 0.56));
  const voiceValue = largest(context, [facts.voice], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  const engineValue = largest(context, [facts.engineValue], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  const languageValue = largest(context, [facts.languageValue], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  const failureValue = largest(context, [facts.failureValue], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  if (voiceValue === undefined || engineValue === undefined || languageValue === undefined || failureValue === undefined) return undefined;
  const text: ReaderTtsTextMinimum = {
    quickPlaybackTitle: Math.max(16, qPlayback.heightVp), quickPlaybackStatus: Math.max(13, qStatus.heightVp),
    quickSettingTitle: Math.max(18, qSetting.heightVp), header: Math.max(18, header.heightVp, playbackMeta.heightVp, timerMeta.heightVp, speedMeta.heightVp),
    playbackMetaWidth: playbackMeta.singleLineWidthVp,
    sectionHeader: Math.max(18, section.heightVp, sectionMeta.heightVp), stopLabel: Math.max(14, stop.heightVp),
    stopLabelWidth: Math.max(24, stop.singleLineWidthVp), timerPreset: Math.max(44, timerPreset.heightVp + 8),
    timerPresetPaint: Math.max(36, timerPreset.heightVp + 8), quickTimerPaintHeight: Math.max(30, caption.heightVp + 12),
    timerPresetsWidth: Math.max(inner - 28, 3 * Math.max(44, Math.ceil(timerPreset.singleLineWidthVp) + 12) + 16),
    timerCustomWidth: Math.max(0, inner - 28), timerCustomLayout: 'inline',
    timerCustomLabelWidth: Math.max(custom.singleLineWidthVp, customMeta.singleLineWidthVp),
    timerCustomLabelHeight: custom.heightVp + 2 + customMeta.heightVp,
    timerStepperWidth: 30 * 2 + Math.max(23, digit.singleLineWidthVp) + 2,
    timerUnitLabelHeight: timerUnit.heightVp, timerStepButtonWidth: 30,
    timerCustom: 48,
    timerDigit: Math.max(24, digit.heightVp), timerDigitWidth: Math.max(23, digit.singleLineWidthVp),
    timerStepper: Math.max(44, digit.heightVp + 8), timerStepButton: Math.max(44, digit.heightVp + 6),
    ratePreset: Math.max(44, ratePreset.heightVp + 8), ratePresetPaint: Math.max(32, ratePreset.heightVp + 8), speedRange: Math.max(14, range.heightVp),
    speedRangeWidth: Math.max(21, range.singleLineWidthVp), speedRangeY: 75,
    serviceTab: Math.max(87, 27 + 20 + 7 + Math.max(17, tabTitle.heightVp) + 3 + Math.max(14, tabSubtitle.heightVp)),
    serviceTabTitle: Math.max(17, tabTitle.heightVp), serviceTabSubtitle: Math.max(14, tabSubtitle.heightVp),
    configRow: Math.max(48, labels.heightVp + 12, field.heightVp + 8, manageTitle.heightVp + 12, manage.heightVp + 20),
    voiceRow: Math.max(52, field.heightVp + 20, voiceBadge.heightVp + 28),
    toggleRow: Math.max(48, Math.min(toggle.heightVp, toggleLine.heightVp * 2) + 16),
    detailCard: 340, systemCard: facts.online ? 164 : 212,
    voiceBadge: Math.max(24, voiceBadge.heightVp), voiceBadgeWidth: Math.max(24, voiceBadge.singleLineWidthVp),
    voiceField: Math.max(30, field.heightVp + 8, voiceBadge.heightVp + 6),
    configField: Math.max(48, field.heightVp + 8),
    voiceFieldWidth: Math.max(37 + Math.max(24, voiceBadge.singleLineWidthVp) + fieldGlyph.singleLineWidthVp,
      Math.min(cap, Math.ceil(voiceValue.singleLineWidthVp) + 37 + Math.max(24, voiceBadge.singleLineWidthVp))),
    engineFieldWidth: Math.max(44, Math.min(cap, Math.ceil(engineValue.singleLineWidthVp) + 18)),
    languageFieldWidth: Math.max(44, Math.min(cap, Math.ceil(languageValue.singleLineWidthVp) + 18)),
    failureFieldWidth: Math.max(44, Math.min(cap, Math.ceil(failureValue.singleLineWidthVp) + 18)),
    manageButton: Math.max(44, manage.heightVp + 8), manageButtonWidth: Math.max(44, Math.min(cap, manage.singleLineWidthVp + manageHorizontalReserve)), seekY: 198, errorY: facts.seek ? 230 : 198,
  };
  const closedLabel = largest(context, ['语音引擎', '朗读语言', '不可用处理'],
    actual(TYPE_READER_TTS_RETAINED_TTS_CLOSED_CONFIG_ROW_VALUE),
    Math.max(1, inner - 28 - 8 - Math.max(text.engineFieldWidth, text.languageFieldWidth, text.failureFieldWidth)), true);
  const voiceLabel = largest(context, ['音色'], actual(TYPE_READER_TTS_RETAINED_VOICE_SELECTOR_ROW_LABEL),
    Math.max(1, inner - 28 - text.voiceFieldWidth), true);
  const serviceLabel = largest(context, ['服务信息'], actual(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL),
    Math.max(1, inner - 28 - 8 - text.manageButtonWidth), true);
  const serviceAction = largest(context, [facts.manageLabel], actual(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE),
    Math.max(1, text.manageButtonWidth - manageHorizontalReserve), true);
  if (closedLabel === undefined || voiceLabel === undefined || serviceLabel === undefined || serviceAction === undefined) return undefined;
  text.manageButton = Math.max(44, serviceAction.heightVp + 8);
  text.configRow = Math.max(text.configRow, closedLabel.heightVp + 12, serviceLabel.heightVp + 12, text.manageButton + 12);
  text.voiceRow = Math.max(text.voiceRow, voiceLabel.heightVp + 12);
  text.configRow = Math.max(text.configRow, text.configField);
  text.voiceRow = Math.max(text.voiceRow, text.voiceField + 12);
  text.timerStepper = Math.max(text.timerStepper, text.timerStepButton, text.timerDigit);
  const customContentWidth = Math.max(1, text.timerCustomWidth - 16 - 1);
  const customLabel = largest(context, ['自定义时长'], actual(TYPE_READER_TTS_RETAINED_TIMER_LABEL), customContentWidth, true);
  const customLabelMeta = largest(context, ['分 · 秒'], actual(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY), customContentWidth, true);
  if (customLabel === undefined || customLabelMeta === undefined) return undefined;
  text.timerCustomLabelHeight = customLabel.heightVp + 2 + customLabelMeta.heightVp;
  customTimerLayout(text);
  text.detailCard = text.voiceRow + text.toggleRow * 5 + text.configRow;
  text.systemCard = 14 + text.serviceTab + 15 + text.configRow * (facts.online ? 1 : 2);

  let minWidth = 0;
  if (!full) {
    frame.quickPlaybackLabel.height = Math.max(34, text.quickPlaybackTitle + text.quickPlaybackStatus);
    // The existing status Text is one-line ellipsis. Preserve its meaning
    // and a readable first code point rather than requiring the whole status
    // or the transparent 110vp reference root at every candidate width.
    const statusPoint = facts.playbackLabel.codePointAt(0);
    const statusFirst = statusPoint === undefined ? '字' : String.fromCodePoint(statusPoint);
    const statusReadable = facts.playbackLabel === statusFirst ? qStatus :
      measureReaderControlText(context, `${statusFirst}…`, actual(TYPE_READER_TTS_RETAINED_QUICK_LABEL_VALUE), inner);
    if (statusReadable === undefined) return undefined;
    const statusMinimumWidth = Math.min(qStatus.singleLineWidthVp, statusReadable.singleLineWidthVp);
    const labelMinimumWidth = 34 + 9 + Math.max(qPlayback.singleLineWidthVp, 5 + 4 + statusMinimumWidth);
    frame.quickPlaybackLabel.width = Math.max(frame.quickPlaybackLabel.width, labelMinimumWidth);
    // The original row fits label + four compact paints at the reference
    // width. Only real text/width collision triggers a second transport row.
    const transports = [frame.previous, frame.toggle, frame.stop, frame.next];
    const transportWidth = 28 + 3 + 36 + 3 + 28 + 3 + 28;
    const inline = 13 + labelMinimumWidth + 2 + transportWidth + 10 <= inner;
    if (inline) {
      frame.quickPlaybackLabel.width = Math.max(labelMinimumWidth, Math.min(110, inner - 13 - transportWidth - 12));
      const left = inner - transportWidth - 10;
      for (let index = 0; index < transports.length; index++) {
        transports[index].x = left + [0, 31, 70, 101][index];
        transports[index].y = 15 + (index === 1 ? 0 : 4);
      }
      frame.playback.height = Math.max(66, frame.quickPlaybackLabel.y + frame.quickPlaybackLabel.height + 16);
    } else {
      const columns = inner >= transportWidth + 16 ? 4 : 2;
      const cellWidth = Math.max(36, (inner - 16 - (columns - 1) * 4) / columns);
      const controlsTop = frame.quickPlaybackLabel.y + frame.quickPlaybackLabel.height + 10;
      for (let index = 0; index < transports.length; index++) {
        const target = transports[index];
        target.x = 8 + index % columns * (cellWidth + 4) + (cellWidth - target.width) / 2;
        target.y = controlsTop + Math.floor(index / columns) * 44 + (36 - target.height) / 2;
      }
      const rows = Math.ceil(4 / columns);
      frame.playback.height = controlsTop + rows * 36 + (rows - 1) * 8 + 8;
    }
    frame.playbackCard.height = frame.playback.height;
    frame.quickTimerLabel.height = Math.max(26, text.quickSettingTitle);
    frame.quickTimerLabel.width = Math.max(72, 34 + qSetting.singleLineWidthVp);
    frame.quickTimerSelect.height = Math.max(30, caption.heightVp + 12);
    frame.quickTimerSelect.width = Math.max(78, caption.singleLineWidthVp + 32);
    frame.quickTimerSelect.x = inner - frame.quickTimerSelect.width - 11;
    frame.timer.y = frame.playback.y + frame.playback.height + 8;
    frame.timer.height = Math.max(42, frame.quickTimerLabel.height + 16, frame.quickTimerSelect.height);
    frame.quickTimerSelect.y = (frame.timer.height - frame.quickTimerSelect.height) / 2;
    if (frame.quickTimerLabel.width + frame.quickTimerSelect.width + 34 > inner) {
      frame.quickTimerSelect.x = 11;
      frame.quickTimerSelect.width = Math.max(44, inner - 22);
      frame.quickTimerSelect.y = 8 + frame.quickTimerLabel.height + 8;
      frame.timer.height = frame.quickTimerSelect.y + frame.quickTimerSelect.height + 8;
    }
    frame.quickSpeedLabel.height = Math.max(26, text.quickSettingTitle);
    frame.quickSpeedLabel.width = Math.max(72, 34 + qSetting.singleLineWidthVp);
    frame.quickSpeedValue.height = Math.max(18, rate.heightVp);
    frame.quickSpeedValue.width = Math.max(34, rate.singleLineWidthVp);
    frame.quickSpeedValue.x = inner - frame.quickSpeedValue.width - 11;
    frame.speed.y = frame.timer.y + frame.timer.height + 8;
    frame.speed.height = Math.max(42, frame.quickSpeedLabel.height + 16, frame.quickSpeedValue.height + 16);
    frame.quickSpeedValue.y = (frame.speed.height - frame.quickSpeedValue.height) / 2;
    frame.speedTrack.y = frame.speed.height / 2 - 3;
    frame.speedTrack.x = Math.max(frame.speedTrack.x, 11 + 34 + qSetting.singleLineWidthVp + 10);
    frame.speedTrack.width = Math.max(0, frame.quickSpeedValue.x - 15 - frame.speedTrack.x);
    if (frame.speedTrack.width < 44) {
      frame.speedTrack.x = 11; frame.speedTrack.width = Math.max(0, inner - 22);
      frame.speedTrack.y = 8 + Math.max(frame.quickSpeedLabel.height, frame.quickSpeedValue.height) + 8 + 19;
      frame.speed.height = frame.speedTrack.y + 25 + 8;
      frame.quickSpeedValue.y = 8;
    }
    frame.speedThumb.y = frame.speedTrack.y - 6;
    frame.speedCard.height = frame.speed.height;
    frame.contentHeight = frame.speed.y + frame.speed.height + 11;
    minWidth = width - inner + Math.max(16 + 36 * 2 + 4, 13 + labelMinimumWidth + 11,
      frame.quickTimerLabel.width + 22, 44 + 22,
      frame.quickSpeedLabel.width + frame.quickSpeedValue.width + 34);
  } else {
    const headerGrowth = text.header - 18;
    frame.playbackHeader.height = text.header;
    frame.timerHeader.height = text.header; frame.speedHeader.height = text.header;
    frame.playbackCard.y += headerGrowth;
    frame.waveform.y += headerGrowth;
    frame.previous.x -= Math.max(0, 44 - frame.previous.width) / 2;
    frame.previous.y -= Math.max(0, 44 - frame.previous.height) / 2;
    frame.next.x -= Math.max(0, 44 - frame.next.width) / 2;
    frame.next.y -= Math.max(0, 44 - frame.next.height) / 2;
    frame.previous.width = Math.max(44, frame.previous.width); frame.previous.height = Math.max(44, frame.previous.height);
    frame.next.width = Math.max(44, frame.next.width); frame.next.height = Math.max(44, frame.next.height);
    frame.previous.y += headerGrowth; frame.toggle.y += headerGrowth;
    frame.stop.y += headerGrowth; frame.next.y += headerGrowth;
    frame.voice.y += headerGrowth; frame.voice.height = Math.max(frame.voice.height, voice.heightVp, 16);
    const stopPaintHeight = frame.stop.height;
    frame.stop.height = Math.max(44, frame.stop.height, text.stopLabel + 12);
    frame.stop.y -= (frame.stop.height - stopPaintHeight) / 2;
    frame.stop.width = Math.max(frame.stop.width, 10 + 4 + text.stopLabelWidth + 14);
    frame.stop.x = inner - frame.stop.width - 16;
    frame.voice.width = Math.max(0, frame.stop.x - 8 - frame.voice.x);
    frame.voice.y -= Math.max(0, (frame.voice.height - 21) / 2);
    text.seekY = Math.max(198 + headerGrowth + Math.max(0, frame.voice.height - 21), frame.stop.y + frame.stop.height + 4.5);
    text.errorY = text.seekY + (facts.seek ? 52 : 0);
    frame.playback.height = text.seekY + (facts.seek ? 52 : 0) + (facts.error.length > 0 ? error.heightVp + 12 : 0);
    frame.playbackCard.height = frame.playback.height - frame.playbackCard.y;
    frame.speed.y = frame.playback.y + frame.playback.height + 20;
    frame.speedCard.y = 26 + headerGrowth;
    frame.speedTrack.y += headerGrowth;
    frame.speedThumb.y += headerGrowth;
    text.speedRangeY = 75 + headerGrowth;
    const speedPresetPaintY = text.speedRangeY + text.speedRange + 10.5;
    frame.speedPresets.y = speedPresetPaintY - (text.ratePreset - text.ratePresetPaint) / 2;
    frame.speedPresets.height = text.ratePreset;
    frame.speedPresets.width = Math.max(frame.speedPresets.width,
      Math.max(44, Math.ceil(ratePreset.singleLineWidthVp) + 12) * 5 + 32);
    frame.speed.height = Math.max(speedPresetPaintY + text.ratePresetPaint + 16,
      frame.speedPresets.y + text.ratePreset + 4);
    frame.speedCard.height = frame.speed.height - frame.speedCard.y;
    frame.timer.y = frame.speed.y + frame.speed.height + 20;
    frame.timerCard.y = 26 + headerGrowth;
    frame.timerCard.height = readerTtsTimerCardLayout(text.timerPreset, text.timerPresetPaint, text.timerCustom).height;
    frame.timer.height = frame.timerCard.y + frame.timerCard.height;
    frame.config.y = frame.timer.y + frame.timer.height + 20;
    frame.config.height = text.sectionHeader + 8 + text.systemCard;
    frame.detail.y = frame.config.y + frame.config.height + 20;
    frame.detail.height = text.sectionHeader + 8 + text.detailCard;
    frame.contentHeight = frame.detail.y + frame.detail.height + 16;
    minWidth = width - inner + Math.max(32 + 44, 38 + 2 * (27 + 36),
      28 + 16 + 1 + text.timerStepperWidth,
      28 + 8 + 44 + Math.max(text.engineFieldWidth, text.languageFieldWidth, text.failureFieldWidth),
      28 + 44 + text.voiceFieldWidth, 28 + 8 + 44 + text.manageButtonWidth);

  }
  return { frame: frame, text: text, minWidth: minWidth };
}

export function measureReaderTtsMinimum(context: UIContext, widths: ReaderControlCandidateWidths,
  facts: ReaderTtsMinimumFacts): ReaderTtsMinimumProfile | undefined {
  const quick = measureForm(context, widths.quickContentWidthVp, false, facts);
  const full = measureForm(context, widths.fullContentWidthVp, true, facts);
  if (quick === undefined || full === undefined) return undefined;
  return { quick: quick.frame, full: full.frame, quickText: quick.text, fullText: full.text,
    minimum: { module: 'tts',
      quick: { heightVp: quick.frame.contentHeight, minWidthVp: quick.minWidth,
        fits: widths.quickContentWidthVp >= quick.minWidth },
      // Full keeps its one Scroll. Its first usable Playback region is the
      // minimum viewport; lower modules remain reachable through that Scroll.
      full: { heightVp: full.frame.playback.y + full.text.seekY + 12,
        minWidthVp: full.minWidth, fits: widths.fullContentWidthVp >= full.minWidth } } };
}

export function sampleReaderTtsTextMinimum(profile: ReaderTtsMinimumProfile,
  progress: number): ReaderTtsTextMinimum {
  const q = profile.quickText; const f = profile.fullText;
  const text: ReaderTtsTextMinimum = {
    quickPlaybackTitle: readerControlLerp(q.quickPlaybackTitle, f.quickPlaybackTitle, progress),
    quickPlaybackStatus: readerControlLerp(q.quickPlaybackStatus, f.quickPlaybackStatus, progress),
    quickSettingTitle: readerControlLerp(q.quickSettingTitle, f.quickSettingTitle, progress),
    header: readerControlLerp(q.header, f.header, progress),
    playbackMetaWidth: readerControlLerp(q.playbackMetaWidth ?? 0, f.playbackMetaWidth ?? 0, progress),
    sectionHeader: readerControlLerp(q.sectionHeader, f.sectionHeader, progress),
    stopLabel: readerControlLerp(q.stopLabel, f.stopLabel, progress), stopLabelWidth: readerControlLerp(q.stopLabelWidth, f.stopLabelWidth, progress),
    timerPresetsWidth: readerControlLerp(q.timerPresetsWidth, f.timerPresetsWidth, progress),
    // This is Full-only natural content. The animated timer viewport reveals
    // it through its existing clip; changing its layout at an intermediate
    // width would introduce a second, discontinuous reflow during the morph.
    timerCustomWidth: f.timerCustomWidth,
    timerCustomLayout: f.timerCustomLayout,
    timerCustomLabelWidth: f.timerCustomLabelWidth,
    timerCustomLabelHeight: f.timerCustomLabelHeight,
    timerStepperWidth: f.timerStepperWidth,
    timerUnitLabelHeight: f.timerUnitLabelHeight,
    timerStepButtonWidth: f.timerStepButtonWidth,
    timerPresetPaint: readerControlLerp(q.timerPresetPaint ?? 36, f.timerPresetPaint ?? 36, progress),
    quickTimerPaintHeight: readerControlLerp(q.quickTimerPaintHeight ?? 30, f.quickTimerPaintHeight ?? 30, progress),
    timerPreset: readerControlLerp(q.timerPreset, f.timerPreset, progress), timerCustom: f.timerCustom,
    timerDigit: f.timerDigit, timerDigitWidth: f.timerDigitWidth,
    timerStepper: f.timerStepper, timerStepButton: f.timerStepButton,
    ratePresetPaint: readerControlLerp(q.ratePresetPaint ?? 32, f.ratePresetPaint ?? 32, progress),
    ratePreset: readerControlLerp(q.ratePreset, f.ratePreset, progress), speedRange: readerControlLerp(q.speedRange, f.speedRange, progress),
    speedRangeWidth: readerControlLerp(q.speedRangeWidth, f.speedRangeWidth, progress),
    speedRangeY: readerControlLerp(q.speedRangeY, f.speedRangeY, progress), serviceTab: readerControlLerp(q.serviceTab, f.serviceTab, progress),
    serviceTabTitle: readerControlLerp(q.serviceTabTitle, f.serviceTabTitle, progress),
    serviceTabSubtitle: readerControlLerp(q.serviceTabSubtitle, f.serviceTabSubtitle, progress),
    configRow: readerControlLerp(q.configRow, f.configRow, progress), voiceRow: readerControlLerp(q.voiceRow, f.voiceRow, progress),
    toggleRow: readerControlLerp(q.toggleRow, f.toggleRow, progress), detailCard: readerControlLerp(q.detailCard, f.detailCard, progress),
    systemCard: readerControlLerp(q.systemCard, f.systemCard, progress), voiceBadge: readerControlLerp(q.voiceBadge, f.voiceBadge, progress),
    voiceBadgeWidth: readerControlLerp(q.voiceBadgeWidth, f.voiceBadgeWidth, progress),
    voiceField: readerControlLerp(q.voiceField, f.voiceField, progress), configField: readerControlLerp(q.configField, f.configField, progress),
    voiceFieldWidth: readerControlLerp(q.voiceFieldWidth, f.voiceFieldWidth, progress),
    engineFieldWidth: readerControlLerp(q.engineFieldWidth, f.engineFieldWidth, progress),
    languageFieldWidth: readerControlLerp(q.languageFieldWidth, f.languageFieldWidth, progress),
    failureFieldWidth: readerControlLerp(q.failureFieldWidth, f.failureFieldWidth, progress),
    manageButton: readerControlLerp(q.manageButton, f.manageButton, progress),
    manageButtonWidth: readerControlLerp(q.manageButtonWidth, f.manageButtonWidth, progress),
    seekY: readerControlLerp(q.seekY, f.seekY, progress), errorY: readerControlLerp(q.errorY, f.errorY, progress) };
  return text;
}
