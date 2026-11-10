import { pasteboard } from '@kit.BasicServicesKit';

/** Complete the user-triggered copy before consuming the native menu action. */
export function copyReaderSelection(text: string): void {
  const data = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, text);
  const property = data.getProperty();
  property.shareOption = pasteboard.ShareOption.INAPP;
  data.setProperty(property);
  pasteboard.getSystemPasteboard().setDataSync(data);
}
