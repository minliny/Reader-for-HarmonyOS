// NotificationHostAdapter — HarmonyOS @ohos.notificationManager backed Host
// adapter for notification.show / notification.cancel.
//
// Source of truth: UI Contract host-request.schema.json — `notification.show`
// and `notification.cancel` are UI-Contract-only capabilities (NOT in the Core
// HostCapability closed set). Reducer dispatches these directly.
//
// HarmonyOS API mapping:
//   - notification.show   → notificationManager.publish(request: NotificationRequest)
//   - notification.cancel → notificationManager.cancel(id: number)
//
// Permission: publish/cancel need no system permission, but the user must
// enable notifications. Call requestEnableNotification(context) on first use;
// if the user denied it, publish throws 1600004 and we return shown: false.
//
// Field mapping:
//   UI Contract `body` → HarmonyOS `text` (NotificationRequest.content.normal.text)
//   UI Contract `id`   → HarmonyOS `id` (number; if the UI passes a string id,
//                        we hash it to a stable 32-bit number because
//                        notificationManager.cancel requires a numeric id).
import notificationManager from '@ohos.notificationManager';
import common from '@ohos.app.ability.common';
import {
  HostNotificationShowRequest,
  HostNotificationShowResponse,
  HostNotificationCancelRequest,
  HostNotificationCancelResponse,
} from '../types';

// NotificationManager only accepts numeric ids. Hash the string id to a stable
// 32-bit positive integer so cancel can find the same notification.
function hashStringToNumericId(s: string): number {
  let h: number = 0;
  for (let i = 0; i < s.length; i++) {
    // FNV-1a 32-bit, kept positive.
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h === 0 ? 1 : h;
}

export class NotificationHostAdapter {
  private context: common.UIAbilityContext;
  private enableRequested: boolean = false;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  /**
   * notification.show — publish a basic-text notification.
   * On first call, request the notification-enable permission from the user.
   */
  async show(request: HostNotificationShowRequest): Promise<HostNotificationShowResponse> {
    if (!this.enableRequested) {
      try {
        await notificationManager.requestEnableNotification(this.context);
      } catch (e) {
        // User denied — publish will throw 1600004 below; we return shown:false.
      }
      this.enableRequested = true;
    }
    const numericId = hashStringToNumericId(request.id);
    const notificationRequest: notificationManager.NotificationRequest = {
      id: numericId,
      content: {
        notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
        normal: {
          title: request.title,
          text: request.body,
        },
      },
    };
    try {
      await notificationManager.publish(notificationRequest);
      return { shown: true, id: request.id };
    } catch (e) {
      return { shown: false };
    }
  }

  /**
   * notification.cancel — cancel a previously shown notification by id.
   * The contract id is mapped through the same stable hash as show().
   */
  async cancel(request: HostNotificationCancelRequest): Promise<HostNotificationCancelResponse> {
    const numericId = hashStringToNumericId(request.id);
    try {
      await notificationManager.cancel(numericId);
      return { cancelled: true };
    } catch (e) {
      return { cancelled: false };
    }
  }
}
