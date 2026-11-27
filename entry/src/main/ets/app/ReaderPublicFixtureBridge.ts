import { buildReaderPublicFixtureDirectory, type ReaderPublicFixtureScope } from './diagnostics/ReaderPublicFixtureScope';
import { readerPublicSearchHttpFixtureMode } from './diagnostics/ReaderPublicSearchHttpFixture';

/** Binds isolated storage and HTTP permission to one verified fixture instance. */
export class ReaderPublicFixtureBridge {
  private readonly scope: ReaderPublicFixtureScope | undefined;
  private readonly ownerCurrent: () => boolean;
  private searchHttpVerified: boolean = false;

  constructor(scope: ReaderPublicFixtureScope | undefined, ownerCurrent: () => boolean) {
    this.scope = scope;
    this.ownerCurrent = ownerCurrent;
  }

  dataDirectory(filesDir: string): string | undefined {
    return this.scope === undefined ? filesDir + '/reader-core' : buildReaderPublicFixtureDirectory(filesDir, this.scope.id);
  }

  isCurrent(fixture: ReaderPublicFixtureScope): boolean {
    return this.ownerCurrent() && this.scope === fixture;
  }

  confirmSearchHttp(fixture: ReaderPublicFixtureScope): void {
    if (!this.isCurrent(fixture) || readerPublicSearchHttpFixtureMode(fixture.id) === undefined) {
      throw new Error('PUBLIC_SEARCH_HTTP_FIXTURE_NOT_CURRENT');
    }
    this.searchHttpVerified = true;
  }

  searchHttpReady(): boolean {
    return this.scope !== undefined && this.searchHttpVerified && this.isCurrent(this.scope);
  }

  allowsBundledSources(): boolean {
    return this.scope === undefined || this.scope.id === 'empty-shelf';
  }
}
