import { common } from '@kit.AbilityKit';
import { copyReaderShareText } from '../../../platform/clipboard/ReaderClipboardHost';
import { ReaderSystemShareHost } from '../../../platform/share/ReaderSystemShareHost';
import { ReaderShareActions, type ReaderShareResult } from '../application/ReaderShareActions';

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
    case 'copyFailed': return copiedMessage !== undefined ? '复制失败，请重试' : '系统分享和复制均未完成，请重试';
    case 'unsafeFile': return '此书籍原文件无法分享';
    default: return undefined;
  }
}

export function readerCopySelectionForShare(id: TextMenuItemId): boolean {
  return id.equals(TextMenuItemId.of('reader-copy-selection-for-share'));
}

export function readerShareSelectionMenu(items: TextMenuItem[]): TextMenuItem[] {
  const result = items.slice();
  if (!result.some((item: TextMenuItem): boolean => item.id.equals(TextMenuItemId.SHARE))) {
    result.push({ id: TextMenuItemId.SHARE, content: '分享' });
  }
  if (!result.some((item: TextMenuItem): boolean => readerCopySelectionForShare(item.id))) {
    result.push({ id: TextMenuItemId.of('reader-copy-selection-for-share'), content: '复制以分享' });
  }
  return result;
}
