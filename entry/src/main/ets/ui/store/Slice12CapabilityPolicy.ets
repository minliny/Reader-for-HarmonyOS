// Slice12CapabilityPolicy — auditable local admission table for the final
// lifecycle/settings/accessibility/platform-integration slice.
//
// A Host adapter existing in this repository is not enough to call a product
// journey complete. Every row records the current execution tier, while the
// settings table separately freezes owner/default/persistence/reset semantics.
// Missing Core, Host, HUKS, fold-posture or device evidence always remains
// visible and fail-closed.

export enum Slice12ExecutionPolicy {
  NativeLocal = 'NativeLocal',
  HostReadyDeviceProofRequired = 'HostReadyDeviceProofRequired',
  SessionOnly = 'SessionOnly',
  ContractMissingFailClosed = 'ContractMissingFailClosed',
  HostBlockedFailClosed = 'HostBlockedFailClosed',
  ReleaseBlocked = 'ReleaseBlocked',
}

export interface Slice12CapabilityDefinition {
  id: string;
  owner: string;
  executionPolicy: Slice12ExecutionPolicy;
  reason: string;
}

export interface Slice12SettingDefinition {
  id: string;
  owner: string;
  defaultValue: string;
  persistence: string;
  reset: string;
  executionPolicy: Slice12ExecutionPolicy;
}

export class Slice12CapabilityPolicy {
  static readonly ALL: Slice12CapabilityDefinition[] = [
    {
      id: 'onboarding.education',
      owner: 'ReaderUIRuntime + Harmony reducer',
      executionPolicy: Slice12ExecutionPolicy.NativeLocal,
      reason: 'Welcome and capability education routes use native navigation and never request permissions before a business action.',
    },
    {
      id: 'onboarding.first-run-persistence',
      owner: 'contract missing',
      executionPolicy: Slice12ExecutionPolicy.ContractMissingFailClosed,
      reason: 'The frozen platform persistence allowlist does not yet define a first-run completion key, version or migration.',
    },
    {
      id: 'permission.file-picker-recovery',
      owner: 'Harmony system document picker',
      executionPolicy: Slice12ExecutionPolicy.NativeLocal,
      reason: 'Harmony local-book import recovers by reopening the document picker; no broad storage grant is invented.',
    },
    {
      id: 'permission.clipboard-request',
      owner: 'Harmony PermissionHostAdapter',
      executionPolicy: Slice12ExecutionPolicy.HostReadyDeviceProofRequired,
      reason: 'Source-package paste checks and requests READ_PASTEBOARD only when the user invokes clipboard import.',
    },
    {
      id: 'permission.system-settings-return',
      owner: 'contract missing',
      executionPolicy: Slice12ExecutionPolicy.ContractMissingFailClosed,
      reason: 'No frozen Host request opens app settings or correlates the returned permission state with a route transaction.',
    },
    {
      id: 'accessibility.semantic-baseline',
      owner: 'Harmony ArkUI',
      executionPolicy: Slice12ExecutionPolicy.NativeLocal,
      reason: 'Shared navigation, settings and reader-selection controls publish explicit accessibility text and stable touch targets.',
    },
    {
      id: 'accessibility.screen-reader-dynamic-font',
      owner: 'Harmony system + device evidence',
      executionPolicy: Slice12ExecutionPolicy.HostReadyDeviceProofRequired,
      reason: 'Semantic traversal, focus return, system text scale and announcements still require physical-device evidence.',
    },
    {
      id: 'layout.viewport-class',
      owner: 'Harmony window metrics',
      executionPolicy: Slice12ExecutionPolicy.NativeLocal,
      reason: 'Phone, compact-landscape and tablet are derived only from live viewport dimensions.',
    },
    {
      id: 'layout.fold-posture',
      owner: 'Host contract missing',
      executionPolicy: Slice12ExecutionPolicy.HostBlockedFailClosed,
      reason: 'No hinge or fold-posture Host event is frozen; width alone must never be reported as fold posture.',
    },
    {
      id: 'background.lifecycle-checkpoint',
      owner: 'Core storage + Harmony Ability lifecycle',
      executionPolicy: Slice12ExecutionPolicy.HostReadyDeviceProofRequired,
      reason: 'onBackground suspends playback and flushes Core storage, but process-kill and resume evidence is still required.',
    },
    {
      id: 'background.rss-schedule',
      owner: 'contract missing',
      executionPolicy: Slice12ExecutionPolicy.ContractMissingFailClosed,
      reason: 'No durable RSS background job identity, result continuation, enabled-state owner or restart recovery contract exists.',
    },
    {
      id: 'notification.business-entry',
      owner: 'product mapping missing',
      executionPolicy: Slice12ExecutionPolicy.ContractMissingFailClosed,
      reason: 'NotificationHostAdapter and self-check are not a user business trigger; RSS/TTS notification policy is not frozen.',
    },
    {
      id: 'share.source-export',
      owner: 'Core source.export + Harmony ShareHostAdapter',
      executionPolicy: Slice12ExecutionPolicy.HostReadyDeviceProofRequired,
      reason: 'A real source export payload opens the system share sheet; cancellation and target behavior require device proof.',
    },
    {
      id: 'clipboard.selection-copy',
      owner: 'Harmony ClipboardHostAdapter',
      executionPolicy: Slice12ExecutionPolicy.HostReadyDeviceProofRequired,
      reason: 'Only an actual ArkUI text selection can be copied and the Host result controls visible feedback.',
    },
    {
      id: 'clipboard.source-import-paste',
      owner: 'Harmony permission + clipboard Host adapters, Core source.import',
      executionPolicy: Slice12ExecutionPolicy.HostReadyDeviceProofRequired,
      reason: 'Paste is permission-gated and the payload becomes durable only after Core validates and imports it.',
    },
    {
      id: 'release.full-product-gate',
      owner: 'cross-repository release gate',
      executionPolicy: Slice12ExecutionPolicy.ReleaseBlocked,
      reason: 'Slice 9-11 device evidence, corpus diff, immutable digests, consumer locks and rollback proof are not closed.',
    },
  ];

  static readonly SETTINGS: Slice12SettingDefinition[] = [
    {
      id: 'reducedMotion',
      owner: 'ReaderUIRuntime + Harmony preferences',
      defaultValue: 'false',
      persistence: 'reader_ui_preferences_v1/reducedMotion',
      reset: 'false',
      executionPolicy: Slice12ExecutionPolicy.HostReadyDeviceProofRequired,
    },
    {
      id: 'appThemeMode',
      owner: 'Harmony reducer presentation',
      defaultValue: 'system',
      persistence: 'session-only; frozen durable setting contract missing',
      reset: 'system for current session',
      executionPolicy: Slice12ExecutionPolicy.SessionOnly,
    },
    {
      id: 'coverColumns',
      owner: 'Harmony reducer presentation',
      defaultValue: '3',
      persistence: 'session-only; frozen durable setting contract missing',
      reset: '3 for current session',
      executionPolicy: Slice12ExecutionPolicy.SessionOnly,
    },
    {
      id: 'mergeSameBooks',
      owner: 'Harmony reducer projection',
      defaultValue: 'true',
      persistence: 'session-only; frozen durable setting contract missing',
      reset: 'true for current session',
      executionPolicy: Slice12ExecutionPolicy.SessionOnly,
    },
    {
      id: 'enableSearchHistory',
      owner: 'Harmony reducer gate; history rows remain Core-owned',
      defaultValue: 'true',
      persistence: 'session-only; frozen durable setting contract missing',
      reset: 'true for current session without clearing Core history',
      executionPolicy: Slice12ExecutionPolicy.SessionOnly,
    },
    {
      id: 'showLocalBookBadge',
      owner: 'Harmony reducer presentation',
      defaultValue: 'true',
      persistence: 'session-only; frozen durable setting contract missing',
      reset: 'true for current session',
      executionPolicy: Slice12ExecutionPolicy.SessionOnly,
    },
    {
      id: 'durableDomainData',
      owner: 'Reader-Core-Native',
      defaultValue: 'Core-defined',
      persistence: 'Core storage only',
      reset: 'no all-data reset contract; destructive action unavailable',
      executionPolicy: Slice12ExecutionPolicy.ContractMissingFailClosed,
    },
  ];

  static byId(id: string): Slice12CapabilityDefinition | undefined {
    for (let index: number = 0; index < Slice12CapabilityPolicy.ALL.length; index += 1) {
      const definition: Slice12CapabilityDefinition = Slice12CapabilityPolicy.ALL[index];
      if (definition.id === id) return definition;
    }
    return undefined;
  }

  static setting(id: string): Slice12SettingDefinition | undefined {
    for (let index: number = 0; index < Slice12CapabilityPolicy.SETTINGS.length; index += 1) {
      const definition: Slice12SettingDefinition = Slice12CapabilityPolicy.SETTINGS[index];
      if (definition.id === id) return definition;
    }
    return undefined;
  }
}
