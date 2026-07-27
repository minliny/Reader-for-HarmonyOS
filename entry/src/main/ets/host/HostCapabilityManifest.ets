// HostCapabilityManifest — single declarative source of truth for every
// Host capability's routing, requirements, and device-evidence status.
//
// Why this exists:
//   - The historical HostCapability union has 43 entries split across two
//     sources (Core closed-set host.rs × 15, original UI-only subset × 28).
//     Reader UI HostRequest 1.2.0 has its own exact 58-entry manifest and must
//     not be collapsed into this Core-facing compatibility boundary.
//   - Routing differs: Core closed-set is registered with
//     HostCapabilityRegistry (Core requests them over NAPI); UI-Contract-only
//     is exposed via CoreRuntime getters for Reducer direct dispatch.
//   - Requirements differ: some need common.Context (file), some need
//     UIAbilityContext (screen/notification/share/permission/credential),
//     some need a declared permission (background needs
//     KEEP_BACKGROUND_RUNNING).
//   - Device-evidence status must be tracked honestly per AGENTS.md rule 4
//     ("Core-missing features must be marked accurately until measured
//     evidence exists") and rule 8 ("Do not fake ... device ... success").
//
// What this does NOT do:
//   - It does not invent new capability names. `host.capabilities` is NOT
//     added as a registry capability — Core never asks for it over NAPI.
//   - It does not change routing. Descriptors only describe what already
//     exists in CoreRuntime.registerHandlers() / CoreRuntime getters.
//   - It does not itself execute anything. `available` is a read-only
//     predicate delegated to a resolver supplied at construction time.

import type { HostCapability } from './types';

export type HostCapabilitySource = 'core-closed-set' | 'ui-contract-only';

// `registry`     — routed via HostCapabilityRegistry (Core may request over NAPI).
// `reducer-direct` — exposed via CoreRuntime getter, Reducer calls adapter directly.
// `unimplemented` — declared in HostCapability union but no adapter exists yet.
export type HostCapabilityDispatch = 'registry' | 'reducer-direct' | 'unimplemented';

export interface HostCapabilityDescriptor {
  capability: HostCapability;
  source: HostCapabilitySource;
  dispatch: HostCapabilityDispatch;
  // Adapter class name (e.g. 'HttpHostAdapter'). Empty string when unimplemented.
  adapter: string;
  requiresContext: boolean;          // needs common.Context (file / legacy reader initialization)
  requiresUiAbilityContext: boolean; // needs UIAbilityContext (screen/notif/share/perm/cred)
  requiresPermission?: string;       // module.json5 permission required
  // True only when device-executed hdc evidence exists for this capability.
  // Build-success alone does NOT flip this to true (AGENTS.md rule 8).
  deviceVerified: boolean;
}

// Resolver supplied by CoreRuntime: returns true iff the capability is
// reachable right now (adapter constructed and non-null, or registry has it).
export type HostCapabilityAvailabilityResolver = (capability: HostCapability) => boolean;

// Tag → capabilities mapping for evidence-driven deviceVerified.
// Each tag is emitted by a runXxxSelfCheck method in EntryAbility.ets.
// After a self-check completes successfully, markVerifiedByTag flips
// deviceVerified to true for all capabilities covered by that tag.
// Keep this mapping limited to real HostCapability values. Meta evidence such
// as [HostManifest] broadcast is parsed offline by scripts/collect_device_evidence.mjs
// and must not flip deviceVerified for an unrelated capability.
export const HOST_EVIDENCE_TAG_MAP: Record<string, HostCapability[]> = {
  // CoreSelfCheck marks host.smoke.echo only after hostSmoke succeeds.
  'CoreSelfCheck': ['host.smoke.echo' as HostCapability],
  'ReadingChain': [
    'http.execute' as HostCapability,
    'cookie.set' as HostCapability,
    'cookie.get' as HostCapability,
    'file.write' as HostCapability,
    'file.read' as HostCapability,
  ],
  'RssChain': [
    'http.execute' as HostCapability,
    'file.write' as HostCapability,
    'file.read' as HostCapability,
  ],
  'LocalBook': [
    'file.write' as HostCapability,
    'file.read' as HostCapability,
    'persistence.put' as HostCapability,
    'persistence.get' as HostCapability,
  ],
  'SyncWebDav': [
    'credential.get' as HostCapability,
    'http.execute' as HostCapability,
    'file.write' as HostCapability,
  ],
  'UiAdapter': [
    'webview.open' as HostCapability,
    'webview.close' as HostCapability,
    'permission.check' as HostCapability,
    'notification.show' as HostCapability,
    'notification.cancel' as HostCapability,
    'device.vibrate' as HostCapability,
  ],
  'TtsSelfCheck': [
    'tts.system.start' as HostCapability,
    'tts.system.stop' as HostCapability,
  ],
  'ReadingChainUi': [
    'http.execute' as HostCapability,
    'cookie.set' as HostCapability,
    'cookie.get' as HostCapability,
    'file.write' as HostCapability,
    'file.read' as HostCapability,
    'webview.open' as HostCapability,
    'webview.close' as HostCapability,
  ],
};

export interface HostCapabilityManifestSummary {
  total: number;
  registry: number;
  reducerDirect: number;
  unimplemented: number;
  available: number;
  deviceVerified: number;
}

// Static descriptor table. Order mirrors HostCapability union grouping in
// HostRequest.ets so drift is easy to spot in review.
// `deviceVerified` defaults to false for every entry; it is flipped only
// when hdc evidence is captured and recorded in docs/evidence/.
const HOST_CAPABILITY_DESCRIPTORS: HostCapabilityDescriptor[] = [
  // ── Core closed-set (host.rs HostCapability) — registry-routed ──
  {
    capability: 'host.smoke.echo', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'http.execute', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'HttpHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'cookie.get', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CookieHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'cookie.set', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CookieHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'webview.evaluateJavaScript', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'WebViewHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'file.read', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'FileHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'file.write', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'FileHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'cache.get', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'cache.put', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'log.emit', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'time.now', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'system.info', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'persistence.get', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'persistence.put', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'media.download', source: 'core-closed-set', dispatch: 'registry',
    adapter: 'CoreHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },

  // ── UI Contract only (host-request.schema.json) — reducer-direct ──
  {
    capability: 'http.cancel', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'HttpHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'webview.open', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'WebViewHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'webview.close', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'WebViewHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'webview.evaluate', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'WebViewHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'cookie.clear', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'CookieHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'file.delete', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'FileHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'storage.path', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'FileHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'credential.get', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'CredentialHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'credential.set', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'CredentialHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'credential.delete', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'CredentialHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'tts.system.start', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'TtsHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'tts.system.stop', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'TtsHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'tts.system.pause', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'TtsHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'tts.system.resume', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'TtsHostAdapter', requiresContext: true, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'permission.request', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'PermissionHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'permission.check', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'PermissionHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'background.schedule', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'BackgroundHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    requiresPermission: 'ohos.permission.KEEP_BACKGROUND_RUNNING',
    deviceVerified: false,
  },
  {
    capability: 'background.cancel', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'BackgroundHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    requiresPermission: 'ohos.permission.KEEP_BACKGROUND_RUNNING',
    deviceVerified: false,
  },
  {
    capability: 'timer.foreground.arm', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'ForegroundTimerHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'timer.foreground.cancel', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'ForegroundTimerHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'notification.show', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'NotificationHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'notification.cancel', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'NotificationHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'share.invoke', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'ShareHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'clipboard.copy', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'ClipboardHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'clipboard.paste', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'ClipboardHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'device.vibrate', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'DeviceHostAdapter', requiresContext: false, requiresUiAbilityContext: false,
    deviceVerified: false,
  },
  {
    capability: 'device.screen.keep-on', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'ScreenHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
  {
    capability: 'device.screen.release', source: 'ui-contract-only', dispatch: 'reducer-direct',
    adapter: 'ScreenHostAdapter', requiresContext: false, requiresUiAbilityContext: true,
    deviceVerified: false,
  },
];

export class HostCapabilityManifest {
  // Mutable: deviceVerified is flipped from false→true by markVerified/
  // markVerifiedByTag when a self-check produces device evidence.
  private descriptors = new Map<HostCapability, HostCapabilityDescriptor>();
  private readonly resolver: HostCapabilityAvailabilityResolver;

  constructor(resolver: HostCapabilityAvailabilityResolver) {
    this.resolver = resolver;
    for (const d of HOST_CAPABILITY_DESCRIPTORS) {
      this.descriptors.set(d.capability, d);
    }
  }

  get(capability: HostCapability): HostCapabilityDescriptor | undefined {
    return this.descriptors.get(capability);
  }

  all(): HostCapabilityDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  /**
   * Mark a single capability as device-verified. Called by self-check methods
   * after they produce device evidence (hdc hilog). Idempotent: calling again
   * on an already-verified capability is a no-op.
   */
  markVerified(capability: HostCapability): void {
    const d = this.descriptors.get(capability);
    if (d === undefined || d.deviceVerified) {
      return;
    }
    // Copy-on-write to avoid mutating the static table.
    const updated: HostCapabilityDescriptor = {
      capability: d.capability,
      source: d.source,
      dispatch: d.dispatch,
      adapter: d.adapter,
      requiresContext: d.requiresContext,
      requiresUiAbilityContext: d.requiresUiAbilityContext,
      requiresPermission: d.requiresPermission,
      deviceVerified: true,
    };
    this.descriptors.set(capability, updated);
  }

  /**
   * Mark all capabilities covered by an evidence tag as device-verified.
   * Uses HOST_EVIDENCE_TAG_MAP to resolve tag → capabilities. Called by
   * self-check methods at their DONE log line.
   */
  markVerifiedByTag(tag: string): void {
    const caps = HOST_EVIDENCE_TAG_MAP[tag];
    if (caps === undefined) {
      return;
    }
    for (const cap of caps) {
      this.markVerified(cap);
    }
  }

  /**
   * Re-broadcast the updated manifest summary to hilog. Called after all
   * self-checks complete to show the evidence-driven deviceVerified count.
   */
  rebroadcastSummary(): void {
    const s = this.summary();
    console.info(`[HostManifest] post-self-check summary total=${s.total} registry=${s.registry}` +
      ` reducerDirect=${s.reducerDirect} unimplemented=${s.unimplemented}` +
      ` available=${s.available} deviceVerified=${s.deviceVerified}`);
  }

  registeredWithRegistry(): HostCapability[] {
    const out: HostCapability[] = [];
    for (const d of this.descriptors.values()) {
      if (d.dispatch === 'registry') {
        out.push(d.capability);
      }
    }
    return out;
  }

  reducerDirect(): HostCapability[] {
    const out: HostCapability[] = [];
    for (const d of this.descriptors.values()) {
      if (d.dispatch === 'reducer-direct') {
        out.push(d.capability);
      }
    }
    return out;
  }

  unimplemented(): HostCapability[] {
    const out: HostCapability[] = [];
    for (const d of this.descriptors.values()) {
      if (d.dispatch === 'unimplemented') {
        out.push(d.capability);
      }
    }
    return out;
  }

  // Runtime availability: combines static dispatch with the live resolver.
  // `unimplemented` is always false; `registry`/`reducer-direct` ask resolver.
  isAvailable(capability: HostCapability): boolean {
    const d = this.descriptors.get(capability);
    if (d === undefined) {
      return false;
    }
    if (d.dispatch === 'unimplemented') {
      return false;
    }
    return this.resolver(capability);
  }

  // Summary counts for the one-line broadcast log.
  summary(): HostCapabilityManifestSummary {
    let registry = 0;
    let reducerDirect = 0;
    let unimplemented = 0;
    let available = 0;
    let deviceVerified = 0;
    for (const d of this.descriptors.values()) {
      if (d.dispatch === 'registry') { registry++; }
      else if (d.dispatch === 'reducer-direct') { reducerDirect++; }
      else { unimplemented++; }
      if (d.deviceVerified) { deviceVerified++; }
      if (this.isAvailable(d.capability)) { available++; }
    }
    return {
      total: this.descriptors.size,
      registry,
      reducerDirect,
      unimplemented,
      available,
      deviceVerified,
    };
  }

  // Single-line summary for the [HostManifest] broadcast log line.
  toSummaryLine(): string {
    const s = this.summary();
    return `total=${s.total} registry=${s.registry} reducerDirect=${s.reducerDirect}` +
      ` unimplemented=${s.unimplemented} available=${s.available} deviceVerified=${s.deviceVerified}`;
  }

  // Per-capability detail lines for the full broadcast dump.
  toDetailLines(): string[] {
    const lines: string[] = [];
    for (const d of this.descriptors.values()) {
      const avail = this.isAvailable(d.capability);
      const reqs: string[] = [];
      if (d.requiresContext) { reqs.push('ctx'); }
      if (d.requiresUiAbilityContext) { reqs.push('uiCtx'); }
      if (d.requiresPermission !== undefined) { reqs.push(`perm:${d.requiresPermission}`); }
      const reqStr = reqs.length > 0 ? reqs.join('+') : '-';
      lines.push(
        `  ${d.capability.padEnd(32)} ${d.source.padEnd(16)} ${d.dispatch.padEnd(16)}` +
        ` ${d.adapter.padEnd(24)} reqs=${reqStr.padEnd(20)} avail=${avail} verified=${d.deviceVerified}`
      );
    }
    return lines;
  }
}
