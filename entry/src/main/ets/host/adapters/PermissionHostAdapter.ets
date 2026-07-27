// PermissionHostAdapter — HarmonyOS @ohos.abilityAccessCtrl backed Host adapter
// for permission.request / permission.check.
//
// Source of truth: UI Contract host-request.schema.json — `permission.request`
// and `permission.check` are UI-Contract-only capabilities (NOT in the Core
// HostCapability closed set). Reducer dispatches these directly.
//
// HarmonyOS API mapping:
//   - permission.request → atManager.requestPermissionsFromUser(context, [scope])
//   - permission.check   → bundleManager.getBundleInfoForSelf() +
//                           atManager.checkAccessToken(tokenID, scope)
//
// The UI Contract `scope` field maps directly to the HarmonyOS permission name
// string (e.g. 'ohos.permission.READ_MEDIA'). The permission MUST be declared
// in module.json5 requestPermissions first; otherwise request returns
// authResults=2 (invalid request).
//
// Permission: none required to call these APIs (the user grants the requested
// permission through the system dialog).
import abilityAccessCtrl, { Permissions, PermissionRequestResult } from '@ohos.abilityAccessCtrl';
import bundleManager from '@ohos.bundle.bundleManager';
import common from '@ohos.app.ability.common';
import {
  HostPermissionRequest,
  HostPermissionResponse,
  HostPermissionCheckRequest,
  HostPermissionCheckResponse,
} from '../types';

// AtManager authResults values:
//   -1 = PERMISSION_DENIED
//    0 = PERMISSION_GRANTED
//    2 = invalid request (permission not declared in module.json5)
const AUTH_RESULT_GRANTED: number = 0;

export class PermissionHostAdapter {
  private context: common.UIAbilityContext;
  private atManager: abilityAccessCtrl.AtManager;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
    this.atManager = abilityAccessCtrl.createAtManager();
  }

  /**
   * permission.request — show the system permission dialog for the scope.
   * Returns granted: true if the user granted it, false otherwise.
   *
   * `request.scope` is a UI Contract string (e.g. 'ohos.permission.READ_MEDIA');
   * HarmonyOS `Permissions` is a string-literal union. We cast through Object
   * because the scope comes from the UI Contract at runtime, not from a
   * compile-time literal.
   */
  async request(request: HostPermissionRequest): Promise<HostPermissionResponse> {
    try {
      // `request.scope` is a UI Contract string (e.g. 'ohos.permission.READ_MEDIA');
      // HarmonyOS `Permissions` is a string-literal union. Cast through Object
      // because the scope comes from the UI Contract at runtime.
      const permList: Permissions[] = [request.scope as Object as Permissions];
      const result: PermissionRequestResult =
        await this.atManager.requestPermissionsFromUser(this.context, permList);
      const granted = result.authResults.length > 0 &&
        result.authResults[0] === AUTH_RESULT_GRANTED;
      return { granted: granted };
    } catch (e) {
      return { granted: false };
    }
  }

  /**
   * permission.check — check whether the scope is already granted, without
   * showing a dialog. Uses the app's own accessTokenId.
   */
  async check(request: HostPermissionCheckRequest): Promise<HostPermissionCheckResponse> {
    try {
      const bundleInfo = await bundleManager.getBundleInfoForSelf(
        bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_APPLICATION,
      );
      const tokenId = bundleInfo.appInfo.accessTokenId;
      const perm: Permissions = request.scope as Object as Permissions;
      const status = await this.atManager.checkAccessToken(tokenId, perm);
      return { granted: status === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED };
    } catch (e) {
      return { granted: false };
    }
  }
}
