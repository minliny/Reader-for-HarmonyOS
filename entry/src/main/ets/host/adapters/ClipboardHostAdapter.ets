// ClipboardHostAdapter — HarmonyOS @ohos.pasteboard backed Host adapter for
// clipboard.copy / clipboard.paste.
//
// Source of truth: UI Contract host-request.schema.json — `clipboard.copy` and
// `clipboard.paste` are UI-Contract-only capabilities (NOT in the Core
// HostCapability closed set). Reducer dispatches these directly to this adapter;
// they never cross the NAPI boundary.
//
// HarmonyOS API mapping:
//   - clipboard.copy   → pasteboard.createData(MIMETYPE_TEXT_PLAIN, text) +
//                        systemPasteboard.setData(Promise<void>)
//   - clipboard.paste   → systemPasteboard.getData(Promise<PasteData>) +
//                        pasteData.getPrimaryText()
//
// Permission: setData needs no permission. getData needs
//   ohos.permission.READ_PASTEBOARD (user_grant, API 12+) — declared in
//   module.json5 and requested at runtime via PermissionHostAdapter. A denied
//   permission is an execution failure; it must not be confused with a real,
//   successfully-read empty clipboard.
import pasteboard from '@ohos.pasteboard';
import {
  HostClipboardCopyRequest,
  HostClipboardCopyResponse,
  HostClipboardPasteResponse,
} from '../types';

export class ClipboardHostAdapter {
  /**
   * clipboard.copy — write text to the system pasteboard.
   * setData needs no permission.
   */
  async copy(request: HostClipboardCopyRequest): Promise<HostClipboardCopyResponse> {
    try {
      const systemPasteboard = pasteboard.getSystemPasteboard();
      const pasteData = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, request.text);
      await systemPasteboard.setData(pasteData);
      return { copied: true };
    } catch (e) {
      throw new Error(`ClipboardHostAdapter.copy failed: ${e}`);
    }
  }

  /**
   * clipboard.paste — read text from the system pasteboard.
   * getData requires ohos.permission.READ_PASTEBOARD (API 12+). Permission or
   * platform failures throw so HostRequest dispatch remains fail-closed.
   */
  async paste(): Promise<HostClipboardPasteResponse> {
    const systemPasteboard = pasteboard.getSystemPasteboard();
    try {
      const data = await systemPasteboard.getData();
      const text = data.getPrimaryText();
      return { text: text };
    } catch (e) {
      throw new Error(`ClipboardHostAdapter.paste failed: ${e}`);
    }
  }
}
