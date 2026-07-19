// Slice10CapabilityPolicy — one auditable admission table for the Reader UI
// Slice 10 reading-data / rule / cover / review / HTTP-TTS work.
//
// A Core runtime branch accepting a string method is not, by itself, a stable
// cross-repository contract.  Production admission therefore records both the
// command-schema tier and the native execution status.  Routes may become live
// only when their complete semantic is admitted here; every other row stays
// visibly fail-closed.

export enum Slice10SchemaTier {
  TypedCommand = 'TypedCommand',
  MethodExampleOnly = 'MethodExampleOnly',
  RuntimeOnly = 'RuntimeOnly',
  Missing = 'Missing',
}

export enum Slice10ExecutionPolicy {
  Production = 'Production',
  BridgeReady = 'BridgeReady',
  ExperimentalFailClosed = 'ExperimentalFailClosed',
  ContractMissingFailClosed = 'ContractMissingFailClosed',
  HostBlockedFailClosed = 'HostBlockedFailClosed',
}

export interface Slice10CapabilityDefinition {
  id: string;
  coreMethods: string[];
  schemaTier: Slice10SchemaTier;
  executionPolicy: Slice10ExecutionPolicy;
  reason: string;
}

export class Slice10CapabilityPolicy {
  static readonly ALL: Slice10CapabilityDefinition[] = [
    {
      id: 'reading.search-content',
      coreMethods: ['search.content'],
      schemaTier: Slice10SchemaTier.TypedCommand,
      executionPolicy: Slice10ExecutionPolicy.Production,
      reason: 'Core-owned durable chapter-cache search with sourceId + bookId scope.',
    },
    {
      id: 'reading.bookmarks',
      coreMethods: ['bookmark.create', 'bookmark.list', 'bookmark.update', 'bookmark.delete'],
      schemaTier: Slice10SchemaTier.MethodExampleOnly,
      executionPolicy: Slice10ExecutionPolicy.Production,
      reason: 'Existing exact Core vertical; schema tier remains visible and is not called frozen.',
    },
    {
      id: 'reading.search-history',
      coreMethods: ['search.history.list', 'search.history.add', 'search.history.clear'],
      schemaTier: Slice10SchemaTier.TypedCommand,
      executionPolicy: Slice10ExecutionPolicy.Production,
      reason: 'Core owns the global keyword collection and destructive clear.',
    },
    {
      id: 'reading.read-record',
      coreMethods: ['read-record.create', 'read-record.list', 'read-record.update', 'read-record.delete'],
      schemaTier: Slice10SchemaTier.MethodExampleOnly,
      executionPolicy: Slice10ExecutionPolicy.ExperimentalFailClosed,
      reason: 'No stable Host deviceId contract and no canonical sourceId/bookId locator.',
    },
    {
      id: 'rules.replace',
      coreMethods: ['replace-rule.create', 'replace-rule.list', 'replace-rule.update', 'replace-rule.delete'],
      schemaTier: Slice10SchemaTier.TypedCommand,
      executionPolicy: Slice10ExecutionPolicy.Production,
      reason: 'Existing Core-owned CRUD with the native pilot and explicit destructive confirmation.',
    },
    {
      id: 'rules.txt-toc',
      coreMethods: ['txt-toc-rule.create', 'txt-toc-rule.list', 'txt-toc-rule.update', 'txt-toc-rule.delete'],
      schemaTier: Slice10SchemaTier.TypedCommand,
      executionPolicy: Slice10ExecutionPolicy.BridgeReady,
      reason: 'Typed bridge is available; Reader UI 3.0 has no dedicated native route payload yet.',
    },
    {
      id: 'rules.dictionary',
      coreMethods: [],
      schemaTier: Slice10SchemaTier.Missing,
      executionPolicy: Slice10ExecutionPolicy.ContractMissingFailClosed,
      reason: 'No DictRule command contract exists.',
    },
    {
      id: 'source.switch',
      coreMethods: ['change.bookSource', 'bookshelf.add', 'bookshelf.remove', 'reading.progress.update'],
      schemaTier: Slice10SchemaTier.TypedCommand,
      executionPolicy: Slice10ExecutionPolicy.Production,
      reason: 'Existing serialized candidate verification, commit and rollback transaction.',
    },
    {
      id: 'content.edit',
      coreMethods: ['content-edit.put', 'content-edit.get', 'content-edit.list', 'content-edit.delete'],
      schemaTier: Slice10SchemaTier.RuntimeOnly,
      executionPolicy: Slice10ExecutionPolicy.ExperimentalFailClosed,
      reason: 'Runtime CRUD lacks command-schema registration, base revision and conflict/rollback fields.',
    },
    {
      id: 'cover.candidates',
      coreMethods: ['search.cover', 'change.cover'],
      schemaTier: Slice10SchemaTier.RuntimeOnly,
      executionPolicy: Slice10ExecutionPolicy.ExperimentalFailClosed,
      reason: 'Runtime returns URLs only; there is no typed candidate identity or apply mutation.',
    },
    {
      id: 'cover.apply',
      coreMethods: [],
      schemaTier: Slice10SchemaTier.Missing,
      executionPolicy: Slice10ExecutionPolicy.ContractMissingFailClosed,
      reason: 'Apply/decrypt/cache/version/rollback contracts are absent.',
    },
    {
      id: 'chapter-reviews.read',
      coreMethods: ['book.chapterReview'],
      schemaTier: Slice10SchemaTier.TypedCommand,
      executionPolicy: Slice10ExecutionPolicy.BridgeReady,
      reason: 'Typed extraction exists, but the current reader chain does not supply an explicit reviewUrl.',
    },
    {
      id: 'chapter-reviews.write',
      coreMethods: [],
      schemaTier: Slice10SchemaTier.Missing,
      executionPolicy: Slice10ExecutionPolicy.ContractMissingFailClosed,
      reason: 'No pagination, avatar, permalink or comment mutation contract exists.',
    },
    {
      id: 'tts.config',
      coreMethods: ['tts.config.get', 'tts.config.put'],
      schemaTier: Slice10SchemaTier.TypedCommand,
      executionPolicy: Slice10ExecutionPolicy.BridgeReady,
      reason: 'Typed Core config storage only; it does not claim playback or queue persistence.',
    },
    {
      id: 'http-tts.metadata',
      coreMethods: ['http-tts.put', 'http-tts.get', 'http-tts.list', 'http-tts.delete', 'http-tts.build-request'],
      schemaTier: Slice10SchemaTier.MethodExampleOnly,
      executionPolicy: Slice10ExecutionPolicy.ExperimentalFailClosed,
      reason: 'Params/results are not bound in command/event schemas and can contain credentials.',
    },
    {
      id: 'http-tts.playback',
      coreMethods: [],
      schemaTier: Slice10SchemaTier.Missing,
      executionPolicy: Slice10ExecutionPolicy.HostBlockedFailClosed,
      reason: 'No protected credential store, audio player, media-key, audio-focus or background contract.',
    },
    {
      id: 'reader.session',
      coreMethods: ['tts.queue.play', 'tts.queue.stop'],
      schemaTier: Slice10SchemaTier.TypedCommand,
      executionPolicy: Slice10ExecutionPolicy.Production,
      reason: 'Existing activeSession arbiter permits only reading, TTS or auto-page ownership at once.',
    },
  ];

  static byId(id: string): Slice10CapabilityDefinition | undefined {
    for (let index: number = 0; index < Slice10CapabilityPolicy.ALL.length; index += 1) {
      const definition: Slice10CapabilityDefinition = Slice10CapabilityPolicy.ALL[index];
      if (definition.id === id) return definition;
    }
    return undefined;
  }

  static isProduction(id: string): boolean {
    const definition: Slice10CapabilityDefinition | undefined = Slice10CapabilityPolicy.byId(id);
    return definition !== undefined && definition.executionPolicy === Slice10ExecutionPolicy.Production;
  }
}
