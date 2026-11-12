import type { UIContext } from '@ohos.arkui.UIContext';
import { TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK, TYPE_READER_SETTINGS_SEGMENT_LABEL_FULL,
  TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL, TYPE_READER_SETTINGS_RETAINED_SEGMENT_ROW_VALUE,
  TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL, TYPE_READER_SETTINGS_RETAINED_TOGGLE_ROW_LABEL, ReaderTextStyle }
  from '../../../ui/foundation/ReaderTypography';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { readerControlSettingsBar, readerControlSettingsChoice,
  type ReaderControlSettingsEndpointMinimum, type ReaderControlSettingsMinimumProfile }
  from './ReaderControlSettingsGeometry';
import type { ReaderControlCandidateWidths } from './ReaderLayoutGeometry';

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
  // The live label uses an explicit 12fp -> 16fp line recipe, not these role aliases' AUTO.
  const labelStyle = new ReaderTextStyle(role.fontFamily, TYPE_READER_SETTINGS_SEGMENT_LABEL_QUICK.fontWeight,
    role.fontSizeFp, full ? 16 : 12, undefined, role.scalePolicy, role.source);
  const title = measureReaderControlText(context, '屏幕样式', TYPE_READER_SETTINGS_RETAINED_SCREEN_GROUP_LABEL, Math.max(1, Math.min(160, width - 30)), 'wrap');
  const addedTitle = measureReaderControlText(context, '导航状态栏', TYPE_READER_SETTINGS_RETAINED_ADDED_GROUP_LABEL, Math.max(1, Math.min(160, width - 30)), 'wrap');
  if (title === undefined || addedTitle === undefined) return undefined;
  const labels: number[] = []; const optionHeights: number[] = []; const columns: number[] = [];
  let fits = title.fitsWidth && addedTitle.fitsWidth;
  for (let row = 0; row < groupLabels.length; row++) {
    const bar = readerControlSettingsBar(row, p, width);
    const label = measureReaderControlText(context, groupLabels[row], labelStyle, Math.max(1, width - 30));
    if (label === undefined) return undefined;
    labels.push(Math.max(full ? 16 : 12, label.heightVp)); fits = fits && label.fitsWidth;
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
