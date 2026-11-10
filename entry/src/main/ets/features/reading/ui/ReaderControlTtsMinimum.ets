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

/** Display facts captured by the mounted module, never another TTS state owner. */
export interface ReaderTtsMinimumFacts {
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
  sectionHeader: number;
  stopLabel: number;
  stopLabelWidth: number;
  timerPreset: number;
  timerCustom: number;
  timerDigit: number;
  timerDigitWidth: number;
  timerStepper: number;
  timerStepButton: number;
  ratePreset: number;
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
  seekY: number;
  errorY: number;
}

export interface ReaderTtsMinimumProfile extends ReaderControlTtsNaturalProfile {
  quickText: ReaderTtsTextMinimum;
  fullText: ReaderTtsTextMinimum;
  minimum: ReaderControlModuleMinimum;
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
  const qPlayback = largest(context, ['播放'], actual(TYPE_READER_TTS_QUICK_PLAYBACK_LABEL), inner);
  const qStatus = largest(context, [facts.playbackLabel], actual(TYPE_READER_TTS_RETAINED_QUICK_LABEL_VALUE), inner);
  const qSetting = largest(context, ['定时', '语速'], actual(TYPE_READER_TTS_QUICK_SETTING_LABEL), inner);
  const header = largest(context, ['朗读控制', '定时停止', '语速'], actual(TYPE_READER_TTS_RETAINED_MODULE_HEADER_VALUE), inner);
  const playbackMeta = largest(context, [facts.status, facts.timerSummary], TYPE_READER_TTS_SECTION_META, inner);
  const speedMeta = largest(context, [facts.rate], TYPE_READER_TTS_SECTION_SPEED_META, inner);
  const voice = largest(context, ['当前音色 · ' + facts.voice], actual(TYPE_READER_TTS_RETAINED_PLAYBACK_LABEL), Math.max(1, frame.voice.width - 22));
  const stop = largest(context, ['停止'], actual(TYPE_READER_TTS_RETAINED_ROUND_CONTROL_LABEL), inner);
  const caption = largest(context, [facts.timerCaption], actual(TYPE_READER_TTS_RETAINED_TIMER_META), inner);
  const timerPreset = largest(context, ['不开启', '15 分钟', '30 分钟', '45 分钟', '60 分钟', '本章结束'],
    actual(TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE), Math.max(1, (inner - 44) / 3));
  const custom = largest(context, ['自定义时长'], actual(TYPE_READER_TTS_RETAINED_TIMER_LABEL), inner);
  const customMeta = largest(context, ['分 · 秒'], actual(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY), inner);
  const digit = largest(context, [facts.minutes, facts.seconds], actual(TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE), inner);
  const rate = largest(context, [facts.rate], actual(TYPE_READER_TTS_RETAINED_SPEED_VALUE, false), inner);
  const range = largest(context, ['0.50x', '2.00x'], actual(TYPE_READER_TTS_RETAINED_SPEED_VALUE_SECONDARY, false), inner);
  const ratePreset = largest(context, ['0.50x', '0.75x', '1.00x', '1.25x', '1.50x'],
    actual(TYPE_READER_TTS_RETAINED_RATE_PRESET_VALUE), Math.max(1, (inner - 64) / 5));
  const section = largest(context, ['播放配置', '朗读引擎'], actual(TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL), inner);
  const sectionMeta = largest(context, ['即时生效'], actual(TYPE_READER_TTS_RETAINED_SECTION_HEADER_META), inner);
  const tabTitle = largest(context, ['系统 TTS', '在线 TTS'], actual(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE),
    Math.max(1, (inner - 38) / 2 - 24));
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
  const manageTitle = largest(context, ['服务信息'], actual(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL), inner);
  const error = measureReaderControlText(context, facts.error, MESSAGE_BODY, inner - 32, 'wrap');
  const values: (ReaderControlTextExtent | undefined)[] = [qPlayback, qStatus, qSetting, header, playbackMeta,
    speedMeta, voice, stop, caption, timerPreset, custom, customMeta, digit, rate, range, ratePreset,
    section, sectionMeta, tabTitle, tabSubtitle, labels, field, voiceBadge, toggle, manage, manageTitle, error];
  for (const value of values) if (value === undefined) return undefined;
  // Narrow explicitly after the complete native-read failure check.
  if (qPlayback === undefined || qStatus === undefined || qSetting === undefined || header === undefined ||
    playbackMeta === undefined || speedMeta === undefined || voice === undefined || stop === undefined ||
    caption === undefined || timerPreset === undefined || custom === undefined || customMeta === undefined ||
    digit === undefined || rate === undefined || range === undefined || ratePreset === undefined || section === undefined ||
    sectionMeta === undefined || tabTitle === undefined || tabSubtitle === undefined || labels === undefined ||
    field === undefined || fieldGlyph === undefined || voiceBadge === undefined || voiceTitle === undefined ||
    toggle === undefined || toggleLine === undefined || manage === undefined ||
    manageTitle === undefined || error === undefined) return undefined;

  const cap = Math.max(70, Math.min(170, inner * 0.56));
  const voiceValue = largest(context, [facts.voice], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  const engineValue = largest(context, [facts.engineValue], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  const languageValue = largest(context, [facts.languageValue], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  const failureValue = largest(context, [facts.failureValue], actual(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY), inner);
  if (voiceValue === undefined || engineValue === undefined || languageValue === undefined || failureValue === undefined) return undefined;
  const text: ReaderTtsTextMinimum = {
    quickPlaybackTitle: Math.max(16, qPlayback.heightVp), quickPlaybackStatus: Math.max(13, qStatus.heightVp),
    quickSettingTitle: Math.max(18, qSetting.heightVp), header: Math.max(18, header.heightVp, playbackMeta.heightVp, speedMeta.heightVp),
    sectionHeader: Math.max(18, section.heightVp, sectionMeta.heightVp), stopLabel: Math.max(14, stop.heightVp),
    stopLabelWidth: Math.max(24, stop.singleLineWidthVp), timerPreset: Math.max(36, timerPreset.heightVp + 8),
    timerCustom: Math.max(48, custom.heightVp + 2 + customMeta.heightVp + 8, digit.heightVp + 16),
    timerDigit: Math.max(24, digit.heightVp), timerDigitWidth: Math.max(23, digit.singleLineWidthVp),
    timerStepper: Math.max(32, digit.heightVp + 8), timerStepButton: Math.max(30, digit.heightVp + 6),
    ratePreset: Math.max(32, ratePreset.heightVp + 8), speedRange: Math.max(14, range.heightVp),
    speedRangeWidth: Math.max(21, range.singleLineWidthVp), speedRangeY: 75,
    serviceTab: Math.max(87, 24 + 20 + 7 + Math.max(17, tabTitle.heightVp) + 3 + Math.max(14, tabSubtitle.heightVp)),
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
    engineFieldWidth: Math.min(cap, Math.ceil(engineValue.singleLineWidthVp) + 18),
    languageFieldWidth: Math.min(cap, Math.ceil(languageValue.singleLineWidthVp) + 18),
    failureFieldWidth: Math.min(cap, Math.ceil(failureValue.singleLineWidthVp) + 18),
    manageButton: Math.max(30, manage.heightVp + 8), seekY: 198, errorY: facts.seek ? 230 : 198,
  };
  text.configRow = Math.max(text.configRow, text.configField);
  text.voiceRow = Math.max(text.voiceRow, text.voiceField + 12);
  text.timerStepper = Math.max(text.timerStepper, text.timerStepButton, text.timerDigit);
  text.timerCustom = Math.max(text.timerCustom, text.timerStepper + 16);
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
    frame.playback.height = Math.max(66, frame.quickPlaybackLabel.y + frame.quickPlaybackLabel.height + 16);
    frame.playbackCard.height = frame.playback.height;
    const playbackGrowth = frame.playback.height - 66;
    frame.previous.y += playbackGrowth / 2; frame.toggle.y += playbackGrowth / 2;
    frame.stop.y += playbackGrowth / 2; frame.next.y += playbackGrowth / 2;
    frame.quickTimerLabel.height = Math.max(26, text.quickSettingTitle);
    frame.quickTimerSelect.height = Math.max(30, caption.heightVp + 12);
    frame.quickTimerSelect.width = Math.max(78, caption.singleLineWidthVp + 32);
    frame.quickTimerSelect.x = inner - frame.quickTimerSelect.width - 11;
    frame.timer.y = frame.playback.y + frame.playback.height + 8;
    frame.timer.height = Math.max(42, frame.quickTimerLabel.height + 16, frame.quickTimerSelect.height + 12);
    frame.quickTimerSelect.y = (frame.timer.height - frame.quickTimerSelect.height) / 2;
    frame.quickSpeedLabel.height = Math.max(26, text.quickSettingTitle);
    frame.quickSpeedLabel.width = Math.max(72, 34 + qSetting.singleLineWidthVp);
    frame.quickSpeedValue.height = Math.max(24, rate.heightVp);
    frame.quickSpeedValue.width = Math.max(40, rate.singleLineWidthVp);
    frame.quickSpeedValue.x = inner - frame.quickSpeedValue.width - 11;
    frame.speed.y = frame.timer.y + frame.timer.height + 8;
    frame.speed.height = Math.max(42, frame.quickSpeedLabel.height + 16, frame.quickSpeedValue.height + 16, 44);
    frame.quickSpeedValue.y = (frame.speed.height - frame.quickSpeedValue.height) / 2;
    frame.speedTrack.y = frame.speed.height / 2 - 3;
    frame.speedTrack.x = Math.max(frame.speedTrack.x, 11 + 34 + qSetting.singleLineWidthVp + 10);
    frame.speedTrack.width = Math.max(0, frame.quickSpeedValue.x - 15 - frame.speedTrack.x);
    frame.speedThumb.y = frame.speedTrack.y - 6;
    frame.speedCard.height = frame.speed.height;
    frame.contentHeight = frame.speed.y + frame.speed.height + 11;
    minWidth = width - inner + Math.max(13 + labelMinimumWidth + 2 + 129 + 10,
      11 + 26 + 8 + qSetting.singleLineWidthVp + 12 + frame.quickTimerSelect.width + 11,
      11 + 26 + 8 + qSetting.singleLineWidthVp + 10 + 64 + 15 + frame.quickSpeedValue.width + 11);
  } else {
    const headerGrowth = text.header - 18;
    frame.playbackHeader.height = text.header;
    frame.timerHeader.height = text.header; frame.speedHeader.height = text.header;
    frame.playbackCard.y += headerGrowth;
    frame.waveform.y += headerGrowth;
    frame.previous.y += headerGrowth; frame.toggle.y += headerGrowth;
    frame.stop.y += headerGrowth; frame.next.y += headerGrowth;
    frame.voice.y += headerGrowth; frame.voice.height = Math.max(frame.voice.height, voice.heightVp, 16);
    frame.stop.height = Math.max(frame.stop.height, text.stopLabel, 10);
    frame.stop.width = Math.max(frame.stop.width, 10 + 4 + text.stopLabelWidth + 14);
    frame.stop.x = inner - frame.stop.width - 16;
    frame.voice.width = Math.max(0, frame.stop.x - 8 - frame.voice.x);
    text.seekY = 198 + headerGrowth + Math.max(0, frame.voice.height - 21);
    text.errorY = text.seekY + (facts.seek ? 32 : 0);
    frame.playback.height = text.seekY + (facts.seek ? 32 : 0) + (facts.error.length > 0 ? error.heightVp + 12 : 0);
    frame.playbackCard.height = frame.playback.height - frame.playbackCard.y;
    frame.speed.y = frame.playback.y + frame.playback.height + 20;
    frame.speedCard.y = 26 + headerGrowth;
    frame.speedTrack.y += headerGrowth;
    frame.speedThumb.y += headerGrowth;
    text.speedRangeY = 75 + headerGrowth;
    frame.speedPresets.y = text.speedRangeY + text.speedRange + 10.5;
    frame.speedPresets.height = text.ratePreset;
    frame.speed.height = frame.speedPresets.y + text.ratePreset + 16;
    frame.speedCard.height = frame.speed.height - frame.speedCard.y;
    frame.timer.y = frame.speed.y + frame.speed.height + 20;
    frame.timerCard.y = 26 + headerGrowth;
    frame.timerCard.height = 28 + text.timerPreset * 2 + 8 + 12 + text.timerCustom;
    frame.timer.height = frame.timerCard.y + frame.timerCard.height;
    frame.config.y = frame.timer.y + frame.timer.height + 20;
    frame.config.height = text.sectionHeader + 8 + text.systemCard;
    frame.detail.y = frame.config.y + frame.config.height + 20;
    frame.detail.height = text.sectionHeader + 8 + text.detailCard;
    frame.contentHeight = frame.detail.y + frame.detail.height + 16;
    minWidth = width - inner + Math.max(32 + 32 + ratePreset.singleLineWidthVp * 5,
      28 + 16 + timerPreset.singleLineWidthVp * 3,
      28 + 16 + 8 + custom.singleLineWidthVp + (text.timerDigitWidth + 50) * 2,
      // Service descriptions explicitly keep maxLines(1); long provider names
      // do not demand an unbounded phone width. The fixed title/icon row does.
      38 + 2 * (24 + Math.max(tabTitle.singleLineWidthVp, 36)),
      28 + 8 + labels.singleLineWidthVp + Math.max(text.engineFieldWidth, text.languageFieldWidth, text.failureFieldWidth),
      28 + voiceTitle.singleLineWidthVp + text.voiceFieldWidth,
      28 + 8 + manageTitle.singleLineWidthVp + manage.singleLineWidthVp + 38,
      6 + header.singleLineWidthVp + 16 + Math.min(playbackMeta.singleLineWidthVp, inner * 0.45));
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
  return { quickPlaybackTitle: readerControlLerp(q.quickPlaybackTitle, f.quickPlaybackTitle, progress),
    quickPlaybackStatus: readerControlLerp(q.quickPlaybackStatus, f.quickPlaybackStatus, progress),
    quickSettingTitle: readerControlLerp(q.quickSettingTitle, f.quickSettingTitle, progress),
    header: readerControlLerp(q.header, f.header, progress), sectionHeader: readerControlLerp(q.sectionHeader, f.sectionHeader, progress),
    stopLabel: readerControlLerp(q.stopLabel, f.stopLabel, progress), stopLabelWidth: readerControlLerp(q.stopLabelWidth, f.stopLabelWidth, progress),
    timerPreset: readerControlLerp(q.timerPreset, f.timerPreset, progress), timerCustom: readerControlLerp(q.timerCustom, f.timerCustom, progress),
    timerDigit: readerControlLerp(q.timerDigit, f.timerDigit, progress), timerDigitWidth: readerControlLerp(q.timerDigitWidth, f.timerDigitWidth, progress),
    timerStepper: readerControlLerp(q.timerStepper, f.timerStepper, progress), timerStepButton: readerControlLerp(q.timerStepButton, f.timerStepButton, progress),
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
    seekY: readerControlLerp(q.seekY, f.seekY, progress), errorY: readerControlLerp(q.errorY, f.errorY, progress) };
}
