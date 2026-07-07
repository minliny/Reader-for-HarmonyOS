// ShareHostAdapter — HarmonyOS @kit.ShareKit (systemShare) backed Host adapter
// for share.invoke.
//
// Source of truth: UI Contract host-request.schema.json — `share.invoke` is a
// UI-Contract-only capability (NOT in the Core HostCapability closed set).
// Reducer dispatches this directly.
//
// HarmonyOS API mapping:
//   - share.invoke → new systemShare.ShareController(sharedData) +
//                    controller.show(uiAbilityContext, options)
//
// Share Kit requires a UIAbilityContext (not ExtensionContext). The context
// must be supplied by the Reducer / page that initiates share.
//
// Permission: none required.
//
// Note: Share Kit does NOT expose which target app the user picked or whether
// the share succeeded vs. was cancelled — `show()` resolves when the panel
// closes. We return `shared: true` on resolve, `shared: false` on throw.
import { systemShare } from '@kit.ShareKit';
import { uniformTypeDescriptor as utd } from '@kit.ArkData';
import common from '@ohos.app.ability.common';
import {
  HostShareInvokeRequest,
  HostShareInvokeResponse,
} from '../types';

export class ShareHostAdapter {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  /**
   * share.invoke — show the system share panel with text/url/files.
   * The fields are mapped to SharedRecord entries:
   *   - text  → PLAIN_TEXT record (content = text)
   *   - url   → HYPERLINK record (content = url)
   *   - files → one record per file URI (utd inferred from extension; defaults
   *             to PLAIN_TEXT if unknown)
   */
  async invoke(request: HostShareInvokeRequest): Promise<HostShareInvokeResponse> {
    const sharedData = new systemShare.SharedData({
      utd: utd.UniformDataType.PLAIN_TEXT,
      content: request.text ?? '',
    });

    if (request.title !== undefined) {
      // SharedData's first record doesn't take a title in the ctor; add a
      // titled record if a title was supplied.
      sharedData.addRecord({
        utd: utd.UniformDataType.PLAIN_TEXT,
        content: request.title,
      });
    }

    if (request.url !== undefined && request.url.length > 0) {
      sharedData.addRecord({
        utd: utd.UniformDataType.HYPERLINK,
        content: request.url,
      });
    }

    if (request.files !== undefined) {
      for (let i = 0; i < request.files.length; i++) {
        const fileUri = request.files[i];
        sharedData.addRecord({
          utd: utd.UniformDataType.PLAIN_TEXT,
          uri: fileUri,
        });
      }
    }

    const controller = new systemShare.ShareController(sharedData);
    try {
      await controller.show(this.context, {
        previewMode: systemShare.SharePreviewMode.DEFAULT,
        selectionMode: systemShare.SelectionMode.SINGLE,
      });
      // show() resolves when the panel closes — success vs. cancel is not
      // distinguishable. We report shared: true because the user engaged.
      return { shared: true };
    } catch (e) {
      return { shared: false };
    }
  }
}
