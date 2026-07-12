// Reader UI 2.5 font.registerFile backed by the active ArkUI UIContext.
import fs from '@ohos.file.fs';
import window from '@ohos.window';
import common from '@ohos.app.ability.common';

export interface ReaderFontRegistrationResponse {
  registered: boolean;
  path: string;
  familyName: string;
  fontNames: string[];
}

export interface ReaderFontUnregistrationResponse {
  logicalUnregistered: boolean;
  physicallyUnregistered: boolean;
  restartRequired: boolean;
}

export class FontHostAdapter {
  private context: common.UIAbilityContext | null;
  private registrations: Map<string, string> = new Map<string, string>();

  constructor(context?: common.UIAbilityContext) {
    this.context = context ?? null;
  }

  async registerFile(path: string, requestedFamilyName?: string): Promise<ReaderFontRegistrationResponse> {
    const lower = path.toLowerCase();
    if (!lower.endsWith('.ttf') && !lower.endsWith('.otf') && !lower.endsWith('.ttc')) {
      throw new Error('font.registerFile supports .ttf, .otf, and .ttc files');
    }
    try {
      const stat = fs.statSync(path);
      if (stat.size <= 0) throw new Error('font file is empty');
    } catch (e) {
      throw new Error(`font.registerFile cannot read ${path}: ${e}`);
    }
    // ArkUI does not expose the embedded OpenType family after registration.
    // The Host therefore assigns the actual runtime family identifier and
    // returns that exact value. The reducer-supplied label is deliberately not
    // trusted as font identity.
    const familyName = this.hostAssignedFamily(path);

    try {
      if (this.context === null) throw new Error('UIAbilityContext is unavailable');
      const win = await window.getLastWindow(this.context as common.UIAbilityContext);
      win.getUIContext().getFont().registerFont({
        familyName: familyName,
        familySrc: path,
      });
    } catch (e) {
      throw new Error(`FontHostAdapter.registerFile failed: ${e}`);
    }
    this.registrations.set(path, familyName);
    return { registered: true, path: path, familyName: familyName, fontNames: [familyName] };
  }

  unregisterFile(path: string, _familyName: string): ReaderFontUnregistrationResponse {
    // ArkUI has no physical unregister API. Forget every logical registration
    // for the path (including provisional-cleanup calls whose requested family
    // can differ from the Host-assigned family) and report the restart fence.
    this.registrations.delete(path);
    return {
      logicalUnregistered: true,
      physicallyUnregistered: false,
      restartRequired: true,
    };
  }

  private hostAssignedFamily(path: string): string {
    let hash = 2166136261;
    for (let i = 0; i < path.length; i++) {
      hash = Math.imul(hash ^ path.charCodeAt(i), 16777619) >>> 0;
    }
    return `reader-font-${hash.toString(16).padStart(8, '0')}`;
  }
}
