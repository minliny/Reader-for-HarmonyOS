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
//   module.json5 and requested at runtime via PermissionHostAdapter. If the
//   permission is not granted, paste() returns an empty string rather than
//   throwing, so Reducer can degrade gracefully.
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
    const systemPasteboard = pasteboard.getSystemPasteboard();
    const pasteData = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, request.text);
    await systemPasteboard.setData(pasteData);
    return { copied: true };
  }

  /**
   * clipboard.paste — read text from the system pasteboard.
   * getData requires ohos.permission.READ_PASTEBOARD (API 12+). If the
   * permission is missing, we return an empty string instead of throwing so
   * Reducer can degrade gracefully.
   */
  async paste(): Promise<HostClipboardPasteResponse> {
    const systemPasteboard = pasteboard.getSystemPasteboard();
    try {
      const data = await systemPasteboard.getData();
      const text = data.getPrimaryText();
      return { text: text };
    } catch (e) {
      // Permission denied or pasteboard empty — degrade to empty string.
      return { text: '' };
    }
  }
}
