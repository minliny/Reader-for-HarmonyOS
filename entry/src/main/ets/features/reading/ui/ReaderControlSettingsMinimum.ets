import type { UIContext } from '@ohos.arkui.UIContext';
import { TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK, TYPE_READER_SETTINGS_SEGMENT_LABEL_FULL,
  TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL, TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE,
  TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL, TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL }
  from '../../../ui/foundation/ReaderTypography';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { readerControlSettingsBar, readerControlSettingsChoice,
  type ReaderControlSettingsEndpointMinimum, type ReaderControlSettingsMinimumProfile }
  from './ReaderControlSettingsGeometry';
import type { ReaderControlCandidateWidths } from './ReaderLayoutGeometry';

export interface ReaderControlSettingsMinimumFacts {
  groupLabels: string[];
  optionLabels: string[][];
  toggleLabels: string[];
}
export function readerControlSettingsGroupLabel(group: string): string {
  return group === 'direction' ? '屏幕方向' : group === 'pageTurn' ? '翻页样式' : '屏幕超时';
}
export function readerControlSettingsOptionLabel(group: string, option: string): string {
  if (group === 'direction') return option === 'system' ? '跟随系统' : option === 'portrait' ? '竖屏' : '横屏';
  if (group === 'pageTurn') return option === 'simulation' ? '仿真' : option === 'cover' ? '覆盖' :
    option === 'slide' ? '滑动' : option === 'scroll' ? '滚动' : '无动画';
  return option === 'system' ? '跟随系统' : option === 'oneMinute' ? '1 分钟' : option === 'fiveMinutes' ? '5 分钟' :
    option === 'tenMinutes' ? '10 分钟' : '始终开启';
}
export function readerControlSettingsMinimumFacts(): ReaderControlSettingsMinimumFacts {
  return { groupLabels: ['direction', 'pageTurn', 'timeout'].map(readerControlSettingsGroupLabel),
    optionLabels: [ ['system', 'portrait', 'landscape'].map((value: string): string => readerControlSettingsOptionLabel('direction', value)),
      ['cover', 'slide', 'simulation', 'scroll', 'none'].map((value: string): string => readerControlSettingsOptionLabel('pageTurn', value)),
      ['system', 'oneMinute', 'fiveMinutes', 'tenMinutes', 'alwaysOn'].map((value: string): string => readerControlSettingsOptionLabel('timeout', value)) ],
    toggleLabels: ['隐藏状态栏', '隐藏底部导航栏', '拓展到刘海（灵动岛）', '文字两端对齐', '底部对齐', '音量键翻页', '息屏终止朗读', '长按选择文本'] };
}
/** Labels come from the actual module formatter; no command or component mounts. */
export function measureReaderControlSettingsMinimum(context: UIContext, widths: ReaderControlCandidateWidths,
  groupLabels: string[], optionLabels: string[][], toggleLabels: string[]): ReaderControlSettingsMinimumProfile | undefined {
  const quick = measureEndpoint(context, widths.quickContentWidthVp, false, groupLabels, optionLabels, toggleLabels);
  const full = measureEndpoint(context, widths.fullContentWidthVp, true, groupLabels, optionLabels, toggleLabels);
  if (quick === undefined || full === undefined) return undefined;
  return { quick, full };
}

function measureEndpoint(context: UIContext, width: number, full: boolean, groupLabels: string[],
  options: string[][], toggles: string[]): ReaderControlSettingsEndpointMinimum | undefined {
  const p = full ? 1 : 0;
  const role = full ? TYPE_READER_SETTINGS_SEGMENT_LABEL_FULL : TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK;
  const title = measureReaderControlText(context, '屏幕样式', TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL, Math.max(1, Math.min(160, width - 30)), 'wrap');
  const addedTitle = measureReaderControlText(context, '导航状态栏', TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL, Math.max(1, Math.min(160, width - 30)), 'wrap');
  if (title === undefined || addedTitle === undefined) return undefined;
  const labels: number[] = []; const optionHeights: number[] = []; const columns: number[] = [];
  let fits = title.fitsWidth && addedTitle.fitsWidth;
  for (let row = 0; row < groupLabels.length; row++) {
    const bar = readerControlSettingsBar(row, p, width);
    const label = measureReaderControlText(context, groupLabels[row], role, Math.max(1, width - 30));
    if (label === undefined) return undefined;
    labels.push(Math.max(role.lineHeightFp as number, label.heightVp)); fits = fits && label.fitsWidth;
    let naturalHeight = full ? 27 : 24; let largestWidth = 0; let originalFits = true;
    for (let i = 0; i < options[row].length; i++) {
      const original = readerControlSettingsChoice(options[row].length, i, p, bar.width);
      const measured = measureReaderControlText(context, options[row][i], TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE,
        Math.max(1, original.width - 6));
      if (measured === undefined) return undefined;
      naturalHeight = Math.max(naturalHeight, measured.heightVp + 6);
      largestWidth = Math.max(largestWidth, measured.singleLineWidthVp + 6);
      originalFits = originalFits && measured.fitsWidth;
    }
    const count = originalFits ? options[row].length :
      Math.max(1, Math.min(options[row].length, Math.floor((bar.width - 3) / (largestWidth + 3))));
    const cellWidth = (bar.width - 6 - 3 * (count - 1)) / count;
    fits = fits && (originalFits || largestWidth <= cellWidth + .1);
    optionHeights.push(naturalHeight); columns.push(count);
  }
  let toggleLabelHeight = 16;
  for (let i = 0; i < toggles.length; i++) {
    const measured = measureReaderControlText(context, toggles[i], TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL,
      Math.max(1, width - 30 - 20 - 44), 'wrap');
    if (measured === undefined) return undefined;
    toggleLabelHeight = Math.max(toggleLabelHeight, measured.heightVp);
  }
  const result: ReaderControlSettingsEndpointMinimum = { width, labelHeights: labels, optionHeights,
    columns, titleHeight: Math.max(16, title.heightVp), addedTitleHeight: Math.max(16, addedTitle.heightVp),
    toggleLabelHeight, toggleRowHeight: Math.max(38, toggleLabelHeight + 12), fits };
  return result;
}
