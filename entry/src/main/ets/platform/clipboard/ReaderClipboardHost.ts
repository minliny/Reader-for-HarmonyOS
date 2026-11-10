import { pasteboard } from '@kit.BasicServicesKit';

/** Complete the user-triggered copy before consuming the native menu action. */
export function copyReaderSelection(text: string): void {
  const data = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, text);
  const property = data.getProperty();
  property.shareOption = pasteboard.ShareOption.INAPP;
  data.setProperty(property);
  pasteboard.getSystemPasteboard().setDataSync(data);
}

/** Build identification is user-requested, non-secret text intended for issue reports. */
export function copyReaderBuildIdentity(text: string): void {
  const data = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, text);
  const property = data.getProperty();
  property.shareOption = pasteboard.ShareOption.LOCALDEVICE;
  data.setProperty(property);
  pasteboard.getSystemPasteboard().setDataSync(data);
}
