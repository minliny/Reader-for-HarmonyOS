// Slice11CapabilityPolicy — local admission table for the five Reader UI
// capability families closed in this HarmonyOS slice.
//
// The canonical demo may show a control before Core/Host has a durable
// command.  A visible row is therefore not evidence that the capability is
// executable.  Every family below records its actual owner and execution
// boundary so native UI can remain useful without inventing persistence,
// dictionary/AI results, authenticated WebDAV security, or remote book rows.

export enum Slice11ExecutionPolicy {
  Production = 'Production',
  ServiceProofRequired = 'ServiceProofRequired',
  ContractMissingFailClosed = 'ContractMissingFailClosed',
  HostSecurityBlockedFailClosed = 'HostSecurityBlockedFailClosed',
}

export interface Slice11CapabilityDefinition {
  id: string;
  owner: string;
  coreMethods: string[];
  executionPolicy: Slice11ExecutionPolicy;
  reason: string;
}

export class Slice11CapabilityPolicy {
  static readonly ALL: Slice11CapabilityDefinition[] = [
    {
      id: 'reader.bottom-bar',
      owner: 'ReaderUIRuntime + Harmony reducer',
      coreMethods: [],
      executionPolicy: Slice11ExecutionPolicy.Production,
      reason: 'Four canonical modules use exact routes; module-to-module navigation replaces the current overlay.',
    },
    {
      id: 'settings.app-language',
      owner: 'contract missing',
      coreMethods: [],
      executionPolicy: Slice11ExecutionPolicy.ContractMissingFailClosed,
      reason: 'No locale setting owner, persistence command, resource reload transaction or restart contract exists.',
    },
    {
      id: 'tts.locale-region-model',
      owner: 'contract missing',
      coreMethods: [],
      executionPolicy: Slice11ExecutionPolicy.ContractMissingFailClosed,
      reason: 'Current typed TTS config does not contain online locale, region or model fields.',
    },
    {
      id: 'rules.dictionary',
      owner: 'contract missing',
      coreMethods: [],
      executionPolicy: Slice11ExecutionPolicy.ContractMissingFailClosed,
      reason: 'No DictRule command, result, route payload or durable entity contract exists.',
    },
    {
      id: 'ai.large-model',
      owner: 'contract missing',
      coreMethods: [],
      executionPolicy: Slice11ExecutionPolicy.ContractMissingFailClosed,
      reason: 'No provider, credential, request, streaming, cancellation or result contract exists.',
    },
    {
      id: 'sync.webdav-transport',
      owner: 'Core plan + Harmony Host',
      coreMethods: ['sync.webdav.plan', 'runtime.storage.export', 'runtime.storage.apply'],
      executionPolicy: Slice11ExecutionPolicy.ServiceProofRequired,
      reason: 'Local transport and atomic Core snapshot flow are implemented; real-server and current-device proof is still required.',
    },
    {
      id: 'sync.webdav-authenticated-persistence',
      owner: 'Harmony Host',
      coreMethods: [],
      executionPolicy: Slice11ExecutionPolicy.HostSecurityBlockedFailClosed,
      reason: 'CredentialHostAdapter is Preferences-backed and does not provide HUKS-protected secret persistence.',
    },
    {
      id: 'sync.webdav-remote-books',
      owner: 'contract missing',
      coreMethods: [],
      executionPolicy: Slice11ExecutionPolicy.ContractMissingFailClosed,
      reason: 'The current WebDAV contract transports one complete Core snapshot and cannot enumerate per-book resources.',
    },
    {
      id: 'bookshelf.local-book-style',
      owner: 'Harmony reducer presentation',
      coreMethods: ['bookshelf.list'],
      executionPolicy: Slice11ExecutionPolicy.Production,
      reason: 'The badge is presentation-only and derives exclusively from Core sourceId=local.',
    },
    {
      id: 'bookshelf.local-book-style-persistence',
      owner: 'contract missing',
      coreMethods: [],
      executionPolicy: Slice11ExecutionPolicy.ContractMissingFailClosed,
      reason: 'No canonical settings owner/command exists; the visibility preference remains reducer-held for this run only.',
    },
  ];

  static byId(id: string): Slice11CapabilityDefinition | undefined {
    for (let index: number = 0; index < Slice11CapabilityPolicy.ALL.length; index += 1) {
      const definition: Slice11CapabilityDefinition = Slice11CapabilityPolicy.ALL[index];
      if (definition.id === id) return definition;
    }
    return undefined;
  }

  static isProduction(id: string): boolean {
    const definition: Slice11CapabilityDefinition | undefined = Slice11CapabilityPolicy.byId(id);
    return definition !== undefined && definition.executionPolicy === Slice11ExecutionPolicy.Production;
  }
}
