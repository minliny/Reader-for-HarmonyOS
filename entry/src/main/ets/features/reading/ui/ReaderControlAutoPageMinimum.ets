import type { UIContext } from '@ohos.arkui.UIContext';
import {
  ReaderInheritedTextStyle, type ReaderTextStyle,
  TYPE_READER_AUTO_SPEED_LABEL_QUICK, TYPE_READER_AUTO_SPEED_LABEL_FULL,
  TYPE_READER_AUTO_SPEED_VALUE_QUICK, TYPE_READER_AUTO_SPEED_VALUE_FULL,
  TYPE_READER_AUTO_PAGE_RETAINED_QUICK_HEADER_LABEL, TYPE_READER_AUTO_PAGE_RETAINED_QUICK_HEADER_META,
  TYPE_READER_AUTO_PAGE_RETAINED_MODULE_HEADER_VALUE, TYPE_READER_AUTO_PAGE_RETAINED_MODULE_HEADER_META,
  TYPE_READER_AUTO_PAGE_RETAINED_CHAPTER_BUTTON_VALUE, TYPE_READER_AUTO_PAGE_RETAINED_RUNNING_BUTTON_LABEL,
  TYPE_READER_AUTO_PAGE_RETAINED_STOP_BUTTON_LABEL, TYPE_READER_AUTO_PAGE_RETAINED_SPEED_STEP_BUTTON_VALUE,
  TYPE_READER_AUTO_PAGE_RETAINED_SPEED_ROW_LABEL, TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL,
  TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_META, TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL_SECONDARY,
  TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL_TERTIARY,
  TYPE_READER_AUTO_PAGE_RETAINED_FOLLOW_HIGHLIGHT_ROW_LABEL,
  TYPE_READER_TIMER_WHEEL_RETAINED_SELECTED, TYPE_READER_TIMER_WHEEL_RETAINED_NEIGHBOUR,
  TYPE_READER_TIMER_RETAINED_BUILD_VALUE,
} from '../../../ui/foundation/ReaderTypography';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { sampleReaderControlAutoPage, type ReaderControlAutoPageNaturalProfile,
  type ReaderControlAutoPageFrame } from './ReaderControlPlaybackGeometry';
import type { ReaderControlCandidateWidths, ReaderControlModuleMinimum } from './ReaderLayoutGeometry';

export interface ReaderControlAutoPageFactsInput { status: string; timerSummary: string; }
export interface ReaderControlAutoPageMinimumFacts { status: string; timerSummary: string; }
export function readerControlAutoPageStatusLabel(status: string): string {
  return status === 'running' ? '运行中' : status === 'paused' ? '已暂停' : '未开始';
}
export function readerControlAutoPageMinimumFacts(input: ReaderControlAutoPageFactsInput): ReaderControlAutoPageMinimumFacts {
  return { status: readerControlAutoPageStatusLabel(input.status), timerSummary: input.timerSummary };
}
export interface ReaderControlAutoPageTextMinimum {
  chapterLabelWidth: number; chapterLabelHeight: number;
  runningLabelWidth: number; runningLabelHeight: number;
  timerTitleHeight: number; timerMetaWidth: number; timerMetaHeight: number;
  timerLabelWidth: number; timerLabelHeight: number; timerColonHeight: number;
  timerPickerX: number; timerPickerY: number; timerLabelY: number;
  wheelWidth: number; wheelRowHeight: number; wheelUnitHeight: number;
  followLabelHeight: number;
  stepLabelWidth: number; stepLabelHeight: number;
  controlContentTop: number; controlContentHeight: number;
}

export interface ReaderControlAutoPageMinimumProfile extends ReaderControlAutoPageNaturalProfile {
  quickText: ReaderControlAutoPageTextMinimum;
  fullText: ReaderControlAutoPageTextMinimum;
  minimum: ReaderControlModuleMinimum;
}

/** Mirrors only the attributes the real AutoPage Text applies. AUTO and an
 * inherited weight remain AUTO/inherited in Native, rather than copied from
 * an unused role modifier. No component tree or playback owner is mounted. */
function autoRecipe(style: ReaderTextStyle | ReaderInheritedTextStyle, lineHeight: boolean = true,
  weight: boolean = true): ReaderInheritedTextStyle {
  return new ReaderInheritedTextStyle(style.fontFamily, weight ? style.fontWeight : undefined,
    style.fontSizeFp, lineHeight ? style.lineHeightFp : undefined, undefined, 'system', style.source);
}

export function readerControlAutoPageMinimumFonts(): string[] {
  const styles: Array<ReaderTextStyle | ReaderInheritedTextStyle> = [TYPE_READER_AUTO_SPEED_LABEL_QUICK,
    TYPE_READER_AUTO_SPEED_VALUE_QUICK, TYPE_READER_AUTO_PAGE_RETAINED_QUICK_HEADER_LABEL,
    TYPE_READER_AUTO_PAGE_RETAINED_MODULE_HEADER_VALUE, TYPE_READER_AUTO_PAGE_RETAINED_CHAPTER_BUTTON_VALUE,
    TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL, TYPE_READER_TIMER_WHEEL_RETAINED_SELECTED,
    TYPE_READER_TIMER_WHEEL_RETAINED_NEIGHBOUR, TYPE_READER_TIMER_RETAINED_BUILD_VALUE];
  const families: Set<string> = new Set();
  for (const style of styles) if (style.fontFamily !== undefined) families.add(style.fontFamily);
  return Array.from(families);
}

interface ReaderControlAutoPageMeasuredEndpoint {
  frame: ReaderControlAutoPageFrame;
  text: ReaderControlAutoPageTextMinimum;
  minWidth: number;
  fits: boolean;
}

function measureAutoEndpoint(context: UIContext, width: number, full: boolean,
  status: string, timerSummary: string): ReaderControlAutoPageMeasuredEndpoint | undefined {
  const frame = sampleReaderControlAutoPage(full ? 1 : 0, width);
  const inner = frame.content.width;
  const title = measureReaderControlText(context, '自动翻页', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_QUICK_HEADER_LABEL, false), inner);
  const statusText = measureReaderControlText(context, status,
    autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_QUICK_HEADER_META, false, false), inner);
  const moduleTitle = measureReaderControlText(context, '自动翻页控制',
    autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_MODULE_HEADER_VALUE, false), inner);
  const moduleMeta = measureReaderControlText(context, status,
    autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_MODULE_HEADER_META, false, false), inner);
  const chapter = measureReaderControlText(context, '上一章', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_CHAPTER_BUTTON_VALUE), 62, 'wrap');
  const running = measureReaderControlText(context, '自动翻页', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_RUNNING_BUTTON_LABEL), 95, 'wrap');
  const stop = measureReaderControlText(context, '停止', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_STOP_BUTTON_LABEL), 24, 'wrap');
  const speedTitleStyle = full ? new ReaderInheritedTextStyle(TYPE_READER_AUTO_SPEED_LABEL_QUICK.fontFamily,
    TYPE_READER_AUTO_SPEED_LABEL_QUICK.fontWeight, TYPE_READER_AUTO_SPEED_LABEL_FULL.fontSizeFp,
    TYPE_READER_AUTO_SPEED_LABEL_QUICK.lineHeightFp, undefined, 'system', 'appBaseline') : autoRecipe(TYPE_READER_AUTO_SPEED_LABEL_QUICK);
  const speedValueStyle = full ? new ReaderInheritedTextStyle(TYPE_READER_AUTO_SPEED_VALUE_QUICK.fontFamily,
    TYPE_READER_AUTO_SPEED_VALUE_FULL.fontWeight, TYPE_READER_AUTO_SPEED_VALUE_FULL.fontSizeFp,
    TYPE_READER_AUTO_SPEED_VALUE_QUICK.lineHeightFp, undefined, 'system', 'appBaseline') : autoRecipe(TYPE_READER_AUTO_SPEED_VALUE_QUICK);
  const speedTitle = measureReaderControlText(context, '翻页速度', speedTitleStyle, frame.speed.width, 'wrap');
  const speedValue = measureReaderControlText(context, '20 秒', speedValueStyle, frame.speed.width);
  const speedRange = measureReaderControlText(context, '20 秒', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_SPEED_ROW_LABEL, true, false), frame.speed.width);
  const step = measureReaderControlText(context, '+', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_SPEED_STEP_BUTTON_VALUE, true, false), frame.speed.width);
  const timerTitle = measureReaderControlText(context, '定时', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL), inner);
  const timerMeta = measureReaderControlText(context, timerSummary, autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_META), inner);
  const timerLabel = measureReaderControlText(context, '自动停止', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL_SECONDARY), inner);
  const colon = measureReaderControlText(context, ':', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_TIMER_SECTION_LABEL_TERTIARY), inner);
  const wheel = measureReaderControlText(context, '59', autoRecipe(TYPE_READER_TIMER_WHEEL_RETAINED_SELECTED, false), inner);
  const neighbour = measureReaderControlText(context, '59', autoRecipe(TYPE_READER_TIMER_WHEEL_RETAINED_NEIGHBOUR, false), inner);
  const unit = measureReaderControlText(context, '分', autoRecipe(TYPE_READER_TIMER_RETAINED_BUILD_VALUE, false), inner);
  const followHorizontalPadding = 2 * 9;
  const followVerticalPadding = 2 * 6;
  const followBorder = 2 * TOK_BORDER_W;
  const followSwitchWidth = 44;
  const followSwitchHeight = 24;
  const followSwitchMargin = 8;
  const followLabelWidth = Math.min(236, Math.max(1, inner - 8 - followHorizontalPadding -
    followBorder - followSwitchMargin - followSwitchWidth));
  const follow = measureReaderControlText(context, '跟随高亮', autoRecipe(TYPE_READER_AUTO_PAGE_RETAINED_FOLLOW_HIGHLIGHT_ROW_LABEL), followLabelWidth, 'wrap');
  if (title === undefined || statusText === undefined || moduleTitle === undefined || moduleMeta === undefined ||
    chapter === undefined || running === undefined || stop === undefined || speedTitle === undefined || speedValue === undefined ||
    speedRange === undefined || step === undefined || timerTitle === undefined || timerMeta === undefined ||
    timerLabel === undefined || colon === undefined || wheel === undefined || neighbour === undefined || unit === undefined || follow === undefined) return undefined;
  const chapterWidth = Math.max(27, chapter.singleLineWidthVp);
  const chapterHeight = Math.max(9, chapter.heightVp);
  const runningWidth = Math.max(36, running.singleLineWidthVp);
  const runningHeight = Math.max(9, running.heightVp);
  const stopHeight = Math.max(9, stop.heightVp);
  const naturalCellHeight = Math.max(52, 39 + chapterHeight + 4, 39 + runningHeight + 4, 34.5 + stopHeight + 4);
  const rowWidth = Math.max(0, frame.control.width - 8);
  const transports = [frame.previous, frame.toggle, frame.stop, frame.next];
  // Preserve each original actor and its distinct glyph/label origin while
  // text fits. A true width collision can use two rows without enlarging paint.
  let controlExtra = Math.max(0, naturalCellHeight - 52);
  if (rowWidth < 208 || chapterWidth > frame.previous.width || runningWidth > frame.toggle.width && full) {
    const columns = rowWidth >= 208 ? 4 : 2;
    const cellWidth = Math.max(36, (rowWidth - (columns - 1) * 4) / columns);
    for (let index = 0; index < transports.length; index++) {
      const target = transports[index];
      target.x = index % columns * (cellWidth + 4);
      target.y = 5 + Math.floor(index / columns) * (naturalCellHeight + 8);
      target.width = index === 2 ? 24 : cellWidth;
      target.height = index === 2 ? 24 : naturalCellHeight;
    }
    frame.stop.x += (cellWidth - 24) / 2;
    frame.stopLabel.x = frame.stop.x + (24 - stop.singleLineWidthVp) / 2;
    frame.stopLabel.y = frame.stop.y + 28.5;
    frame.playIcon.x = (cellWidth - frame.playIcon.width) / 2;
    controlExtra = 5 + Math.ceil(4 / columns) * (naturalCellHeight + 8) - 8 - 62;
  } else {
    frame.previous.height += controlExtra;
    frame.next.height += controlExtra;
    if (full) frame.toggle.height += controlExtra;
  }
  const headerExtra = Math.max(0, moduleTitle.heightVp - 14.3906, moduleMeta.heightVp - 14.3906);
  const quickHeaderExtra = Math.max(0, title.heightVp - 24, statusText.heightVp - 24);
  frame.back.height = Math.max(24, title.heightVp);
  frame.quickHeader.height += quickHeaderExtra;
  if (!full) frame.content.y += quickHeaderExtra;
  frame.controlHeader.height += headerExtra;
  frame.detailsHeader.height += headerExtra;

  frame.stopLabel.height = stopHeight;
  frame.stopLabel.width = Math.max(18, stop.singleLineWidthVp);
  frame.control.height += headerExtra + controlExtra;
  frame.timer.y += headerExtra + controlExtra;
  frame.details.y += headerExtra + controlExtra;
  const stepWidth = Math.max(18, step.singleLineWidthVp);
  const stepHeight = Math.max(18, step.heightVp);
  const stepSize = Math.max(24, stepWidth + 6, stepHeight + 6);
  const valueWidth = Math.max(full ? 25 : 30, speedValue.singleLineWidthVp);
  const titleWidth = Math.max(full ? 80.56 : 0, speedTitle.singleLineWidthVp);
  const speedTitleWidth = full ? titleWidth : Math.max(1, frame.speed.width - stepSize * 2 - valueWidth - 26);
  const speedTitleActual = measureReaderControlText(context, '翻页速度', speedTitleStyle, speedTitleWidth, 'wrap');
  const speedGlyph = measureReaderControlText(context, '翻', speedTitleStyle, frame.speed.width);
  if (speedTitleActual === undefined || speedGlyph === undefined) return undefined;
  let speedHeight = Math.max(frame.speed.height, speedTitleActual.heightVp + (full ? 50 : 2),
    speedValue.heightVp + (full ? 50 : 19), stepSize + (full ? 0 : 6), speedRange.heightVp + (full ? 51 : 0));
  frame.speed.height = speedHeight;
  frame.speedContent.title.height = Math.max(frame.speedContent.title.height, speedTitleActual.heightVp);
  frame.speedContent.title.width = speedTitleWidth;
  frame.speedContent.current.height = Math.max(frame.speedContent.current.height, speedValue.heightVp);
  frame.speedContent.current.width = valueWidth;
  if (full) {
    frame.speedContent.current.x = frame.speedContent.title.x + titleWidth + 8;
    frame.speedContent.minimum.x = frame.speedContent.current.x + valueWidth + 4;
    frame.speedContent.minimum.width = Math.max(frame.speedContent.minimum.width, speedRange.singleLineWidthVp);
    frame.speedContent.maximum.width = Math.max(frame.speedContent.maximum.width, speedRange.singleLineWidthVp);
    frame.speedContent.maximum.x = frame.speed.width - frame.speedContent.maximum.width - 11;
    frame.speedContent.slider.x = frame.speedContent.minimum.x + frame.speedContent.minimum.width + 9;
    frame.speedContent.slider.width = Math.max(0, frame.speedContent.maximum.x - 9 - frame.speedContent.slider.x);
    if (frame.speedContent.slider.width < 44) {
      const titleAvailable = Math.max(1, frame.speed.width - 22 - valueWidth - 8);
      const wrapped = measureReaderControlText(context, '翻页速度', speedTitleStyle, titleAvailable, 'wrap');
      if (wrapped === undefined) return undefined;
      frame.speedContent.title.width = titleAvailable;
      frame.speedContent.title.height = Math.max(14, wrapped.heightVp);
      frame.speedContent.current.x = frame.speed.width - valueWidth - 11;
      const secondRow = 25 + Math.max(frame.speedContent.title.height, frame.speedContent.current.height) + 12;
      frame.speedContent.minimum.x = 11; frame.speedContent.minimum.y = secondRow + 15.5;
      frame.speedContent.maximum.y = secondRow + 15.5;
      frame.speedContent.slider.x = 11 + frame.speedContent.minimum.width + 9;
      frame.speedContent.slider.y = secondRow;
      frame.speedContent.slider.width = Math.max(0, frame.speedContent.maximum.x - 9 - frame.speedContent.slider.x);
      speedHeight = Math.max(speedHeight, secondRow + 44 + 10);
      frame.speed.height = speedHeight;
    }
  } else {
    frame.speedContent.plus.width = stepSize; frame.speedContent.plus.height = stepSize;
    frame.speedContent.minus.width = stepSize; frame.speedContent.minus.height = stepSize;
    frame.speedContent.plus.x = frame.speed.width - stepSize - 8;
    frame.speedContent.current.x = frame.speedContent.plus.x - valueWidth - 4;
    frame.speedContent.minus.x = frame.speedContent.current.x - stepSize - 4;
  }
  frame.speedContent.minimum.height = Math.max(frame.speedContent.minimum.height, speedRange.heightVp);
  frame.speedContent.maximum.height = Math.max(frame.speedContent.maximum.height, speedRange.heightVp);
  const rowHeight = Math.max(44, wheel.heightVp, neighbour.heightVp);
  const unitHeight = Math.max(8, unit.heightVp);
  const wheelMinimumWidth = Math.max(44, wheel.singleLineWidthVp, neighbour.singleLineWidthVp);
  const timerLabelWidth = Math.max(84, timerLabel.singleLineWidthVp + 38);
  const timerLabelHeight = Math.max(30, timerLabel.heightVp);
  const pickerInline = inner - 8 >= timerLabelWidth + 31 + 15 + wheelMinimumWidth * 2 + 24;
  const pickerX = pickerInline ? timerLabelWidth + 31 : 15;
  const pickerY = pickerInline ? 12 : 12 + timerLabelHeight + 8;
  const labelY = pickerInline ? 54 : 12;
  const wheelWidth = Math.max(wheelMinimumWidth, (inner - 8 - pickerX - 15 - 24) / 2);
  const timerTitleHeight = Math.max(14.4, timerTitle.heightVp, timerMeta.heightVp);
  const timerHeaderExtra = timerTitleHeight - 14.4;
  const timerBodyExtra = Math.max(0, pickerY + rowHeight * 3 + 4 + unitHeight + 12 - 138, labelY + timerLabelHeight + 12 - 138);
  frame.timer.height += timerHeaderExtra + timerBodyExtra;
  if (full) frame.details.y += timerHeaderExtra + timerBodyExtra;
  const followHeight = Math.max(36, Math.max(follow.heightVp, followSwitchHeight) + followVerticalPadding + followBorder);
  frame.follow.height = followHeight;
  frame.follow.y += speedHeight - (full ? 64 : 32);
  frame.details.height += headerExtra + speedHeight - (full ? 64 : 32) + followHeight - 36;
  frame.content.height += headerExtra * 2 + controlExtra + timerHeaderExtra + timerBodyExtra +
    speedHeight - (full ? 64 : 32) + followHeight - 36;
  frame.contentHeight = full ? frame.content.y + frame.content.height + 12 :
    Math.max(frame.content.y + frame.control.height + 12, frame.content.y + frame.details.y + frame.speed.y + frame.speed.height + 7.45);
  const minWidth = full ? Math.max(24 + 8 + 30 + wheelMinimumWidth * 2 + 24,
    24 + Math.max(speedGlyph.singleLineWidthVp + 8 + valueWidth + 22,
      speedRange.singleLineWidthVp * 2 + 18 + 44 + 22),
    24 + moduleTitle.singleLineWidthVp + moduleMeta.singleLineWidthVp + 8) :
    Math.max(24 + speedGlyph.singleLineWidthVp + stepSize * 2 + valueWidth + 26,
      24 + title.singleLineWidthVp + statusText.singleLineWidthVp + 8);
  const text: ReaderControlAutoPageTextMinimum = { chapterLabelWidth: chapterWidth, chapterLabelHeight: chapterHeight,
    runningLabelWidth: runningWidth, runningLabelHeight: runningHeight,
    timerTitleHeight: timerTitleHeight, timerMetaWidth: Math.max(27.8, timerMeta.singleLineWidthVp),
    timerMetaHeight: Math.max(12, timerMeta.heightVp), timerLabelWidth: timerLabelWidth,
    timerLabelHeight: timerLabelHeight, timerColonHeight: Math.max(22, colon.heightVp),
    timerPickerX: pickerX, timerPickerY: pickerY, timerLabelY: labelY,
    wheelWidth: wheelWidth, wheelRowHeight: rowHeight, wheelUnitHeight: unitHeight,
    followLabelHeight: Math.max(13, follow.heightVp), stepLabelWidth: stepWidth, stepLabelHeight: stepHeight,
    controlContentTop: 32.3906 + headerExtra, controlContentHeight: 62 + controlExtra };
  return { frame: frame, text: text, minWidth: minWidth, fits: width >= minWidth };
}

export function measureReaderControlAutoPageMinimum(context: UIContext, widths: ReaderControlCandidateWidths,
  status: string, timerSummary: string): ReaderControlAutoPageMinimumProfile | undefined {
  const quick = measureAutoEndpoint(context, widths.quickContentWidthVp, false, status, timerSummary);
  const full = measureAutoEndpoint(context, widths.fullContentWidthVp, true, status, timerSummary);
  if (quick === undefined || full === undefined) return undefined;
  const minimum: ReaderControlModuleMinimum = { module: 'autoPage',
    quick: { heightVp: quick.frame.contentHeight, minWidthVp: quick.minWidth, fits: quick.fits },
    full: { heightVp: full.frame.content.y + full.frame.control.height + 12,
      minWidthVp: full.minWidth, fits: full.fits } };
  return { quick: quick.frame, full: full.frame, quickText: quick.text, fullText: full.text, minimum: minimum };
}
