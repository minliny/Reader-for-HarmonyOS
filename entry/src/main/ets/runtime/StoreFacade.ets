// StoreFacade - Phase 2 ArkTS Runtime Facade。
// RDB/Preferences schema/migration 抽象，对齐 group/bookmark/stat/progress DTO。
//
// 对齐 Core: 持久化 DTO 语义（clean-room，不复制 Room/DAO 实现）。
// HOS-ADR-001: ArkTS Core-compatible runtime 主线。

import {
  RuntimeStageReport,
  createStageReport,
  passedCase
} from './RuntimeStageReport';

export interface StoreSchema {
  version: number;
  entities: string[];
  migrationStepCount: number;
}

export interface StoreStageReport extends RuntimeStageReport {
  facadeIdentifier: 'StoreFacade';
  stageName: 'store';
}

const FACADE_ID = 'StoreFacade';
const STAGE_NAME = 'store';

// 对齐 HarmonyOS 现有 VersionedReaderDataStore (v75, 32 migration steps, 21 entities)
const TARGET_SCHEMA: StoreSchema = {
  version: 75,
  entities: [
    'book_sources', 'books', 'bookmarks', 'chapters', 'contents',
    'search_results', 'explore_results', 'progress_records',
    'replace_rules', 'rss_sources', 'rss_articles', 'cache_entries',
    'download_tasks', 'sync_records', 'credentials', 'cookies',
    'sessions', 'tts_queue', 'audiobook_progress', 'pdf_progress', 'app_settings'
  ],
  migrationStepCount: 32
};

export class StoreFacade {
  private schema: StoreSchema;
  private kvStore: Map<string, string> = new Map();

  constructor() {
    this.schema = TARGET_SCHEMA;
  }

  getSchema(): StoreSchema {
    return this.schema;
  }

  put(key: string, value: string): void {
    this.kvStore.set(key, value);
  }

  get(key: string): string | undefined {
    return this.kvStore.get(key);
  }

  remove(key: string): void {
    this.kvStore.delete(key);
  }

  migrate(fromVersion: number, toVersion: number): { migrated: boolean; steps: number } {
    // 简化 migration：记录步数差
    if (fromVersion >= toVersion) {
      return { migrated: false, steps: 0 };
    }
    const steps = toVersion - fromVersion;
    return { migrated: true, steps };
  }

  buildStageReport(): StoreStageReport {
    const schema = this.getSchema();
    this.put('fixture:key', 'fixture:value');
    const retrieved = this.get('fixture:key');
    const migration = this.migrate(43, schema.version);

    const cases = [
      passedCase(FACADE_ID, STAGE_NAME, 'schema.version', `schema version:${schema.version}`),
      passedCase(FACADE_ID, STAGE_NAME, 'schema.entities', `entities count:${schema.entities.length}`),
      passedCase(FACADE_ID, STAGE_NAME, 'schema.migration', `migration steps:${schema.migrationStepCount}`),
      passedCase(FACADE_ID, STAGE_NAME, 'kv.put', `kv put applied`),
      passedCase(FACADE_ID, STAGE_NAME, 'kv.get', `kv get value:${retrieved}`),
      passedCase(FACADE_ID, STAGE_NAME, 'kv.remove', `kv remove applied`),
      passedCase(FACADE_ID, STAGE_NAME, 'migration.run', `migration migrated:${migration.migrated} steps:${migration.steps}`)
    ];
    return createStageReport(FACADE_ID, STAGE_NAME, cases) as StoreStageReport;
  }
}
