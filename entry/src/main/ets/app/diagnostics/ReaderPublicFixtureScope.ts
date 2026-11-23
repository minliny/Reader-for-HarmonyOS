export const READER_PUBLIC_FIXTURE_PARAMETER = 'readerPublicFixture';
export const READER_NAMED_PUBLIC_FIXTURE_IDS = ['single-reserved', 'group-options-12', 'row-actions',
  'row-detect-center', 'row-detect-edge', 'row-detect-center-v2', 'row-detect-edge-v2',
  'search-delayed', 'search-http-503', 'search-http-503-body',
  'import-research-center', 'import-research-edge', 'import-research-center-v2', 'import-research-edge-v2',
  'import-research-center-v3', 'import-research-edge-v3', 'all-disabled-layout', 'search-detail-scroll-corpus'] as const;
export const READER_PUBLIC_FIXTURE_IDS = ['empty-shelf', 'empty-sources', ...READER_NAMED_PUBLIC_FIXTURE_IDS] as const;

export type ReaderPublicFixtureId = (typeof READER_PUBLIC_FIXTURE_IDS)[number];
export type ReaderNamedPublicFixtureId = (typeof READER_NAMED_PUBLIC_FIXTURE_IDS)[number];

export function isReaderNamedPublicFixture(id: ReaderPublicFixtureId): id is ReaderNamedPublicFixtureId {
  return READER_NAMED_PUBLIC_FIXTURE_IDS.some(value => value === id);
}

interface ReaderNormalDataSelection {
  kind: 'normal';
}

export interface ReaderPublicFixtureScope {
  kind: 'fixture';
  id: ReaderPublicFixtureId;
}

interface ReaderRejectedFixtureSelection {
  kind: 'rejected';
  reason: 'debug-required' | 'invalid-selection';
}

export type ReaderPublicFixtureSelection = ReaderNormalDataSelection | ReaderPublicFixtureScope |
  ReaderRejectedFixtureSelection;

/** Select the fixture before the cold-start entry creates the production owner. */
export function selectReaderPublicFixture(debug: boolean, buildModeName: string,
  parameters: Record<string, Object> | undefined): ReaderPublicFixtureSelection {
  if (parameters === undefined || !Object.prototype.hasOwnProperty.call(parameters, READER_PUBLIC_FIXTURE_PARAMETER)) {
    return { kind: 'normal' };
  }
  if (debug !== true || buildModeName !== 'debug') return { kind: 'rejected', reason: 'debug-required' };

  const requested: Object = parameters[READER_PUBLIC_FIXTURE_PARAMETER];
  const id = READER_PUBLIC_FIXTURE_IDS.find(fixtureId => fixtureId === requested);
  return id === undefined ? { kind: 'rejected', reason: 'invalid-selection' } : { kind: 'fixture', id };
}

/** Use only the filesDir read from the selected ability context. */
export function buildReaderPublicFixtureDirectory(sandboxFilesDir: string, id: ReaderPublicFixtureId): string | undefined {
  const components = sandboxFilesDir.slice(1).split('/');
  if (!READER_PUBLIC_FIXTURE_IDS.includes(id) || !sandboxFilesDir.startsWith('/data/') ||
    !sandboxFilesDir.endsWith('/files') ||
    (isReaderNamedPublicFixture(id) && !sandboxFilesDir.startsWith('/data/storage/el4/')) ||
    components.some(part =>
      part.length === 0 || part === '.' || part === '..' || /[^a-zA-Z0-9._-]/.test(part))) return undefined;
  return `${sandboxFilesDir}/reader-public-ui-fixtures/${id}`;
}

/** EL4 fixtures share native Context area paths. Scope Reader-owned
 * stores separately while leaving the previously provisioned fixture intact. */
let namedFixture: ReaderNamedPublicFixtureId | undefined;
let fixtureFilesDir: string | undefined;
let fixtureCacheDir: string | undefined;

export function bindReaderNamedPublicStorage(id: ReaderNamedPublicFixtureId, filesDir: string, cacheDir: string): void {
  if (!isReaderNamedPublicFixture(id) || buildReaderPublicFixtureDirectory(filesDir, id) === undefined ||
    cacheDir !== `${filesDir.slice(0, -'/files'.length)}/cache` ||
    (namedFixture !== undefined && (id !== namedFixture || filesDir !== fixtureFilesDir || cacheDir !== fixtureCacheDir))) {
    throw new Error('PUBLIC_FIXTURE_STORAGE_NOT_ISOLATED');
  }
  namedFixture = id;
  fixtureFilesDir = filesDir;
  fixtureCacheDir = cacheDir;
}

export function readerHostFilesDirectory(filesDir: string): string {
  if (namedFixture === undefined) return filesDir;
  if (filesDir !== fixtureFilesDir) throw new Error('PUBLIC_FIXTURE_FILES_CONTEXT_CHANGED');
  return `${filesDir}/reader-public-ui-fixtures/${namedFixture}`;
}

export function readerHostCacheDirectory(cacheDir: string): string {
  if (namedFixture === undefined) return cacheDir;
  if (cacheDir !== fixtureCacheDir) throw new Error('PUBLIC_FIXTURE_CACHE_CONTEXT_CHANGED');
  return `${cacheDir}/reader-public-ui-fixtures/${namedFixture}`;
}

export function readerHostPreferencesName(filesDir: string, name: string): string {
  if (namedFixture === undefined) return name;
  if (filesDir !== fixtureFilesDir) throw new Error('PUBLIC_FIXTURE_PREFERENCES_CONTEXT_CHANGED');
  return `reader_fixture_${namedFixture}_${name}`;
}
