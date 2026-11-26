import { pasteboard } from '@kit.BasicServicesKit';

/** Complete the user-triggered copy before consuming the native menu action. */
export function copyReaderSelection(text: string): void {
  copyReaderShareText(text);
}

/** Build identification is user-requested, non-secret text intended for issue reports. */
export function copyReaderBuildIdentity(text: string): void {
  copyReaderShareText(text);
}

/** Explicit copy from the share action may be pasted into another app. */
export function copyReaderShareText(text: string): void {
  const data = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, text);
  const property = data.getProperty();
  property.shareOption = pasteboard.ShareOption.LOCALDEVICE;
  data.setProperty(property);
  pasteboard.getSystemPasteboard().setDataSync(data);
}

export type ReaderClipboardPasteProblem = 'denied' | 'empty' | 'failed';

export function readerClipboardPasteMessage(problem: ReaderClipboardPasteProblem): string {
  switch (problem) {
    case 'denied': return '未获准读取剪贴板，可重试或手动输入';
    case 'empty': return '剪贴板中没有可粘贴的文字';
    case 'failed': return '暂时无法读取剪贴板，请重试';
  }
}

/** Each draft owner retires the pending read when its editing context changes. */
export class ReaderClipboardDraftPaste {
  private revision: number = 0;

  retire(): void { this.revision += 1; }

  async paste(authorized: boolean, isCurrent: () => boolean, onText: (text: string) => void,
    onProblem: (problem: ReaderClipboardPasteProblem) => void): Promise<void> {
    if (!isCurrent()) return;
    const revision = ++this.revision;
    if (!authorized) {
      onProblem('denied');
      return;
    }
    let text: string | undefined;
    try {
      const data = await pasteboard.getSystemPasteboard().getData();
      text = data.getPrimaryText();
    } catch (_) {
      if (revision === this.revision && isCurrent()) onProblem('failed');
      return;
    }
    if (revision !== this.revision || !isCurrent()) return;
    if (typeof text !== 'string' || text.trim().length === 0) {
      onProblem('empty');
      return;
    }
    onText(text);
  }
}
