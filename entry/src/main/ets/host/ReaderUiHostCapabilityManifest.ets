// Independent Reader UI HostRequest 1.2.0 manifest. The legacy
// HostCapabilityManifest remains the Core closed-set + historical reducer
// boundary (43 items); it is intentionally not inflated to claim 58.
import {
  HostRequestTable,
  type HostRequestType,
} from '../contract/generated/HostRequestTable';
import { ReaderUiHostFailure } from './ReaderUiHostContract';

export type HarmonyHostProofTier = 'host-unit' | 'harmony-simulator' | 'physical-device';

export interface ReaderUiHostCapabilityDescriptor {
  type: HostRequestType;
  adapter: string;
  tier: HarmonyHostProofTier;
  requiresContext: boolean;
  requiresUiAbilityContext: boolean;
  requiresPermission?: string;
  available: boolean;
  deviceVerified: boolean;
}

export type ReaderUiHostAvailabilityResolver = (type: HostRequestType) => boolean;

export interface ReaderUiHostManifestSummary {
  total: number;
  available: number;
  hostUnit: number;
  simulator: number;
  physicalDevice: number;
  deviceVerified: number;
}

export class ReaderUiHostCapabilityManifest {
  private entriesValue: ReaderUiHostCapabilityDescriptor[];

  constructor(resolver: ReaderUiHostAvailabilityResolver) {
    this.entriesValue = HostRequestTable.ALL.map((type: HostRequestType): ReaderUiHostCapabilityDescriptor => {
      const descriptor = ReaderUiHostCapabilityManifest.describe(type);
      descriptor.available = resolver(type);
      return descriptor;
    });
    const unique = new Set<string>();
    for (let i = 0; i < this.entriesValue.length; i++) unique.add(this.entriesValue[i].type);
    if (this.entriesValue.length !== 58 || unique.size !== 58) {
      throw new ReaderUiHostFailure('CONTRACT_DRIFT',
        `Reader UI Host manifest must be 58/58; total=${this.entriesValue.length}, unique=${unique.size}`);
    }
  }

  entries(): ReaderUiHostCapabilityDescriptor[] {
    return this.entriesValue.slice();
  }

  summary(): ReaderUiHostManifestSummary {
    let available = 0;
    let hostUnit = 0;
    let simulator = 0;
    let physicalDevice = 0;
    let deviceVerified = 0;
    for (let i = 0; i < this.entriesValue.length; i++) {
      const entry = this.entriesValue[i];
      if (entry.available) available += 1;
      if (entry.tier === 'host-unit') hostUnit += 1;
      if (entry.tier === 'harmony-simulator') simulator += 1;
      if (entry.tier === 'physical-device') physicalDevice += 1;
      if (entry.deviceVerified) deviceVerified += 1;
    }
    return {
      total: this.entriesValue.length,
      available: available,
      hostUnit: hostUnit,
      simulator: simulator,
      physicalDevice: physicalDevice,
      deviceVerified: deviceVerified,
    };
  }

  toSummaryLine(): string {
    const value = this.summary();
    return `schema=1.2.0 total=${value.total} available=${value.available} ` +
      `hostUnit=${value.hostUnit} simulator=${value.simulator} physical=${value.physicalDevice} ` +
      `deviceVerified=${value.deviceVerified}`;
  }

  toDetailLines(): string[] {
    return this.entriesValue.map((entry: ReaderUiHostCapabilityDescriptor): string => {
      return `type=${entry.type} adapter=${entry.adapter} tier=${entry.tier} ` +
        `available=${entry.available} deviceVerified=${entry.deviceVerified}`;
    });
  }

  private static describe(type: HostRequestType): ReaderUiHostCapabilityDescriptor {
    const descriptor: ReaderUiHostCapabilityDescriptor = {
      type: type,
      adapter: ReaderUiHostCapabilityManifest.adapterFor(type),
      tier: ReaderUiHostCapabilityManifest.tierFor(type),
      requiresContext: ReaderUiHostCapabilityManifest.requiresContext(type),
      requiresUiAbilityContext: ReaderUiHostCapabilityManifest.requiresUiContext(type),
      available: false,
      deviceVerified: false,
    };
    const permission = ReaderUiHostCapabilityManifest.permissionFor(type);
    if (permission !== undefined) descriptor.requiresPermission = permission;
    return descriptor;
  }

  private static adapterFor(type: HostRequestType): string {
    switch (type) {
      case 'http.execute':
      case 'http.cancel': return 'HttpHostAdapter';
      case 'webview.open':
      case 'webview.close':
      case 'webview.evaluate': return 'WebViewHostAdapter';
      case 'cookie.get':
      case 'cookie.set':
      case 'cookie.clear': return 'CookieHostAdapter';
      case 'file.read':
      case 'file.write':
      case 'file.delete':
      case 'storage.path': return 'FileHostAdapter';
      case 'persistence.get':
      case 'persistence.put': return 'CoreHostAdapter';
      case 'credential.get':
      case 'credential.set':
      case 'credential.delete': return 'CredentialHostAdapter';
      case 'tts.system.start':
      case 'tts.system.stop':
      case 'tts.system.pause':
      case 'tts.system.resume':
      case 'tts.start':
      case 'tts.stop':
      case 'tts.pause': return 'TtsHostAdapter';
      case 'permission.request':
      case 'permission.check': return 'PermissionHostAdapter';
      case 'background.schedule':
      case 'background.cancel':
      case 'background.task.start':
      case 'background.task.end': return 'BackgroundHostAdapter';
      case 'timer.foreground.arm':
      case 'timer.foreground.cancel': return 'ForegroundTimerHostAdapter';
      case 'notification.show':
      case 'notification.cancel': return 'NotificationHostAdapter';
      case 'share.invoke':
      case 'share.text':
      case 'share.file': return 'ShareHostAdapter';
      case 'clipboard.copy':
      case 'clipboard.paste':
      case 'clipboard.read':
      case 'clipboard.write': return 'ClipboardHostAdapter';
      case 'device.vibrate':
      case 'haptics.light':
      case 'haptics.medium':
      case 'haptics.heavy': return 'DeviceHostAdapter';
      case 'device.screen.keep-on':
      case 'device.screen.release':
      case 'brightness.set':
      case 'brightness.get':
      case 'screen.keepAwake':
      case 'screen.allowSleep': return 'ScreenHostAdapter';
      case 'file.select': return 'FileSelectionHostAdapter';
      case 'font.registerFile':
      case 'font.unregisterFile': return 'FontHostAdapter';
      case 'network.status': return 'NetworkHostAdapter';
      case 'webdav.connect':
      case 'webdav.backup':
      case 'webdav.restore': return 'WebDavHostAdapter';
      default: throw new ReaderUiHostFailure('CONTRACT_DRIFT', `${type} has no adapter`);
    }
  }

  private static tierFor(type: HostRequestType): HarmonyHostProofTier {
    switch (type) {
      case 'cookie.get':
      case 'cookie.set':
      case 'cookie.clear':
      case 'timer.foreground.arm':
      case 'timer.foreground.cancel':
      case 'persistence.get':
      case 'persistence.put': return 'host-unit';
      case 'http.execute':
      case 'http.cancel':
      case 'file.read':
      case 'file.write':
      case 'file.delete':
      case 'storage.path':
      case 'credential.get':
      case 'credential.set':
      case 'credential.delete':
      case 'font.registerFile':
      case 'font.unregisterFile':
      case 'network.status':
      case 'webdav.connect':
      case 'webdav.backup':
      case 'webdav.restore': return 'harmony-simulator';
      case 'webview.open':
      case 'webview.close':
      case 'webview.evaluate':
      case 'tts.system.start':
      case 'tts.system.stop':
      case 'tts.system.pause':
      case 'tts.system.resume':
      case 'permission.request':
      case 'permission.check':
      case 'background.schedule':
      case 'background.cancel':
      case 'notification.show':
      case 'notification.cancel':
      case 'share.invoke':
      case 'clipboard.copy':
      case 'clipboard.paste':
      case 'device.vibrate':
      case 'device.screen.keep-on':
      case 'device.screen.release':
      case 'file.select':
      case 'clipboard.read':
      case 'clipboard.write':
      case 'tts.start':
      case 'tts.stop':
      case 'tts.pause':
      case 'brightness.set':
      case 'brightness.get':
      case 'screen.keepAwake':
      case 'screen.allowSleep':
      case 'haptics.light':
      case 'haptics.medium':
      case 'haptics.heavy':
      case 'share.text':
      case 'share.file':
      case 'background.task.start':
      case 'background.task.end': return 'physical-device';
      default: throw new ReaderUiHostFailure('CONTRACT_DRIFT', `${type} has no proof tier`);
    }
  }

  private static requiresContext(type: HostRequestType): boolean {
    switch (type) {
      case 'file.read':
      case 'file.write':
      case 'file.delete':
      case 'storage.path':
      case 'persistence.get':
      case 'persistence.put':
      case 'tts.system.start':
      case 'tts.system.stop':
      case 'tts.system.pause':
      case 'tts.system.resume':
      case 'tts.start':
      case 'tts.stop':
      case 'tts.pause': return true;
      default: return ReaderUiHostCapabilityManifest.requiresUiContext(type);
    }
  }

  private static requiresUiContext(type: HostRequestType): boolean {
    switch (type) {
      case 'webview.open':
      case 'webview.close':
      case 'webview.evaluate':
      case 'credential.get':
      case 'credential.set':
      case 'credential.delete':
      case 'permission.request':
      case 'permission.check':
      case 'notification.show':
      case 'notification.cancel':
      case 'share.invoke':
      case 'device.screen.keep-on':
      case 'device.screen.release':
      case 'file.select':
      case 'font.registerFile':
      case 'font.unregisterFile':
      case 'brightness.set':
      case 'brightness.get':
      case 'screen.keepAwake':
      case 'screen.allowSleep':
      case 'webdav.connect':
      case 'webdav.backup':
      case 'webdav.restore':
      case 'share.text':
      case 'share.file': return true;
      default: return false;
    }
  }

  private static permissionFor(type: HostRequestType): string | undefined {
    switch (type) {
      case 'http.execute':
      case 'webdav.connect':
      case 'webdav.backup':
      case 'webdav.restore': return 'ohos.permission.INTERNET';
      case 'clipboard.paste':
      case 'clipboard.read': return 'ohos.permission.READ_PASTEBOARD';
      case 'device.vibrate':
      case 'haptics.light':
      case 'haptics.medium':
      case 'haptics.heavy': return 'ohos.permission.VIBRATE';
      case 'network.status': return 'ohos.permission.GET_NETWORK_INFO';
      case 'tts.system.start':
      case 'tts.start':
      case 'background.task.start':
      case 'background.task.end': return 'ohos.permission.KEEP_BACKGROUND_RUNNING';
      default: return undefined;
    }
  }
}
