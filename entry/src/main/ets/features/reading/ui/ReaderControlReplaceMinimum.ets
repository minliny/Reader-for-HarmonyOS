import type { UIContext } from '@ohos.arkui.UIContext';
import { TYPE_READER_REPLACE_RULE_NAME, TYPE_READER_REPLACE_RETAINED_RULE_ROW_PATTERN,
  TYPE_READER_REPLACE_RETAINED_RULE_ROW_META, TYPE_READER_REPLACE_RETAINED_TEXT_ACTION_LABEL,
  TYPE_READER_REPLACE_RETAINED_TOOLBAR_BUTTON_LABEL, TYPE_READER_REPLACE_RETAINED_STATUS_CONTENT_STATUS,
  TYPE_READER_REPLACE_RETAINED_QUICK_BACK_BACK, TYPE_READER_REPLACE_RETAINED_EDITOR_FLAG_LABEL,
  TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_BACK, TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_VALUE, ReaderTextStyle } from '../../../ui/foundation/ReaderTypography';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import type { ReaderControlCandidateWidths } from './ReaderLayoutGeometry';
import type { ReaderControlReplaceMinimumProfile, ReaderControlReplaceEndpointMinimum } from './ReaderControlReplaceGeometry';

export function measureReaderControlReplaceMinimum(context: UIContext, widths: ReaderControlCandidateWidths,
  statusText: string, recoveryLabel: string, nameText: string, patternText: string, metaText: string, headerTitle: string, editorOpen: boolean): ReaderControlReplaceMinimumProfile | undefined {
  const quick = measureEndpoint(context, widths.quickContentWidthVp, false, statusText, recoveryLabel, nameText, patternText, metaText, headerTitle, editorOpen);
  const full = measureEndpoint(context, widths.fullContentWidthVp, true, statusText, recoveryLabel, nameText, patternText, metaText, headerTitle, editorOpen);
  if (quick === undefined || full === undefined) return undefined;
  return { quick, full };
}
function measureEndpoint(context: UIContext, width: number, full: boolean,
  statusText: string, recoveryLabel: string, nameText: string, patternText: string, metaText: string, headerTitle: string, editorOpen: boolean): ReaderControlReplaceEndpointMinimum | undefined {
  const listWidth = width - (full ? 28 : 36);
  // Metadata keeps its existing one-line ellipsis contract. Heights still use native glyphs.
  const name = measureReaderControlText(context, nameText || '字', TYPE_READER_REPLACE_RULE_NAME, Math.max(1, listWidth - 155));
  const pattern = measureReaderControlText(context, patternText || '字', TYPE_READER_REPLACE_RETAINED_RULE_ROW_PATTERN, Math.max(1, listWidth - 155));
  const meta = measureReaderControlText(context, metaText || '字', TYPE_READER_REPLACE_RETAINED_RULE_ROW_META, Math.max(1, listWidth - 155));
  const back = measureReaderControlText(context, '返回', TYPE_READER_REPLACE_RETAINED_QUICK_BACK_BACK, width - 36);
  const status = measureReaderControlText(context, statusText || '规则载入中…', TYPE_READER_REPLACE_RETAINED_STATUS_CONTENT_STATUS,
    Math.max(1, listWidth), 'wrap');
  if (name === undefined || pattern === undefined || meta === undefined || back === undefined || status === undefined) return undefined;
  const editorFlag = measureReaderControlText(context, '作用于书源导入', TYPE_READER_REPLACE_RETAINED_EDITOR_FLAG_LABEL,
    Math.max(1, width - 24 - 44 - 10), 'wrap');
  const editorBack = measureReaderControlText(context, '返回', TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_BACK, width - 24);
  if (editorFlag === undefined || editorBack === undefined) return undefined;
  const toolbarLabels: string[] = ['新增规则', '导入', '导出'];
  const weights: number[] = [100.66, 96.67, 96.67];
  let toolbarHeight = 40; let toolbarFits = true;
  for (let i = 0; i < toolbarLabels.length; i++) {
    const text = measureReaderControlText(context, toolbarLabels[i], TYPE_READER_REPLACE_RETAINED_TOOLBAR_BUTTON_LABEL,
      Math.max(1, (width - 28 - 16) * weights[i] / 294 - 26));
    if (text === undefined) return undefined;
    toolbarHeight = Math.max(toolbarHeight, text.heightVp + 12); toolbarFits = toolbarFits && text.fitsWidth;
  }
  // Keep all three original Native buttons; only their finite row allocation changes.
  const columns = toolbarFits ? 3 : 1;
  if (!toolbarFits) {
    toolbarFits = true;
    for (let i = 0; i < toolbarLabels.length; i++) {
      const text = measureReaderControlText(context, toolbarLabels[i], TYPE_READER_REPLACE_RETAINED_TOOLBAR_BUTTON_LABEL,
        Math.max(1, width - 28 - 26));
      if (text === undefined) return undefined;
      toolbarHeight = Math.max(toolbarHeight, text.heightVp + 12); toolbarFits = toolbarFits && text.fitsWidth;
    }
  }
  const actionLabels = full ? ['预览当前章节已保存规则', recoveryLabel || '核对原规则操作', '确认删除', '选择文件并导入', '重试预览'] : ['预览效果', '完整管理', recoveryLabel || '核对原规则操作'];
  let actionHeight = 28;
  for (let i = 0; i < actionLabels.length; i++) {
    const constraint = !full && i < 2 ? (width - 35.1 - 6) / 2 - 12 : listWidth - 12;
    const text = measureReaderControlText(context, actionLabels[i], TYPE_READER_REPLACE_RETAINED_TEXT_ACTION_LABEL, Math.max(1, constraint), 'wrap');
    if (text === undefined) return undefined;
    actionHeight = Math.max(actionHeight, text.heightVp + 10);
  }
  const editorBackHeight = Math.max(28, editorBack.heightVp + 10);
  const editorBackWidth = Math.max(38, editorBack.singleLineWidthVp + 12);
  const headerBodyWidth = Math.max(1, width - 24);
  const cancelWidth = Math.max(1, (headerBodyWidth - 8) / 2);
  const cancel = measureReaderControlText(context, '取消', TYPE_READER_REPLACE_RETAINED_TEXT_ACTION_LABEL,
    Math.max(1, cancelWidth - 12), 'wrap');
  const titleRole = TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_VALUE;
  const titleStyle = new ReaderTextStyle(titleRole.fontFamily, titleRole.fontWeight, titleRole.fontSizeFp,
    undefined, undefined, titleRole.scalePolicy, titleRole.source);
  const title = measureReaderControlText(context, headerTitle, titleStyle,
    editorOpen ? Math.max(1, headerBodyWidth - editorBackWidth - 8) : cancelWidth, 'wrap');
  if (cancel === undefined || title === undefined) return undefined;
  const editorHeaderHeight = Math.max(28, title.heightVp, editorOpen ? editorBackHeight : cancel.heightVp + 10);
  if (full && !editorOpen) actionHeight = Math.max(actionHeight, cancel.heightVp + 10);
  const nameHeight = Math.max(17, name.heightVp);
  const metaHeight = Math.max(34, pattern.heightVp + meta.heightVp + 4);
  return { width, nameHeight, metaHeight, actionHeight,
    editorFlagHeight: Math.max(32, editorFlag.heightVp + 12), editorHeaderHeight,
    editorBackHeight, editorBackWidth,
    rowHeight: full ? Math.max(77, 11 + nameHeight + 4 + metaHeight + 11) : Math.max(28, nameHeight + 11),
    backHeight: Math.max(24, back.heightVp + 8), backWidth: Math.max(51, 11 + 5 + back.singleLineWidthVp + 8),
    toolbarColumns: columns, toolbarCellHeight: toolbarHeight,
    statusHeight: Math.max(76, status.heightVp + actionHeight + 4), fits: (full ? toolbarFits : true) && back.fitsWidth };
}
