import { common } from '@kit.AbilityKit';
import { copyReaderShareText } from '../../../platform/clipboard/ReaderClipboardHost';
import { ReaderSystemShareHost } from '../../../platform/share/ReaderSystemShareHost';
import { ReaderShareActions, type ReaderShareResult } from '../application/ReaderShareActions';
import type { ReaderDocumentSaveResult } from '../../../platform/share/ReaderDocumentSaveHost';

let nextSelectionShareAnchor: number = 0;

export function readerSelectionShareAnchor(): string {
  return `reader-selection-share-${++nextSelectionShareAnchor}`;
}

export function readerSystemShareActions(context: () => UIContext, anchor?: string): ReaderShareActions {
  return new ReaderShareActions(new ReaderSystemShareHost(
    (): common.UIAbilityContext | undefined => context().getHostContext() as common.UIAbilityContext | undefined, anchor),
    copyReaderShareText);
}

export function readerShareMessage(result: ReaderShareResult, copiedMessage?: string): string | undefined {
  switch (result) {
    case 'copied': return copiedMessage ?? '系统分享不可用，已复制内容';
    case 'fileCopied': return '原文件暂时无法分享，已复制书籍信息';
    case 'quoteCopied': return '书摘图暂时无法分享，已复制选文';
    case 'quoteFailed': return '书摘图分享和选文复制均未完成，请重试';
    case 'copyFailed': return copiedMessage !== undefined ? '复制失败，请重试' : '系统分享和复制均未完成，请重试';
    case 'unsafeFile': return '此书籍原文件无法分享';
    default: return undefined;
  }
}

export function readerQuoteSelection(id: TextMenuItemId): boolean {
  return id.equals(TextMenuItemId.of('reader-share-quote-card'));
}

export function readerDocumentSaveMessage(result: ReaderDocumentSaveResult, subject: string): string | undefined {
  switch (result) {
    case 'saved': return `已保存${subject}`;
    case 'destinationNotEmpty': return '所选文件已有内容，请选择新文件';
    case 'failed': return `${subject}保存失败，请重试`;
    default: return undefined;
  }
}

export function readerShareSelectionMenu(items: TextMenuItem[], quoteAvailable: boolean = false): TextMenuItem[] {
  const result = items.slice();
  if (!result.some((item: TextMenuItem): boolean => item.id.equals(TextMenuItemId.SHARE))) {
    result.push({ id: TextMenuItemId.SHARE, content: '分享' });
  }
  if (quoteAvailable && !result.some((item: TextMenuItem): boolean => readerQuoteSelection(item.id))) {
    result.push({ id: TextMenuItemId.of('reader-share-quote-card'), content: '书摘图' });
  }
  return result;
}
