import type { BookAcquisitionCoordinator } from '../../reading/application/BookAcquisitionCoordinator';
import { LibrarySearchPresentation } from '../presentation/LibrarySearchPresentation';
import type { SearchBook } from '../application/SearchGateway';
import { SearchPage } from './SearchPage';

@Component
export struct LibrarySearchResults {
  @ObjectLink presentation: LibrarySearchPresentation;
  @Prop reduceMotion: boolean = false;
  @Prop expandedLayout: boolean = false;
  coordinator: BookAcquisitionCoordinator | undefined;
  isCurrent: () => boolean = (): boolean => false;
  isVisible: () => boolean = (): boolean => false;
  onBack: () => void = (): void => {};
  onQuery: (keyword: string, scope?: string[]) => void = (_keyword: string, _scope?: string[]): void => {};
  onManageSources: () => void = (): void => {};
  onResult: (book: SearchBook, variants: SearchBook[], cover?: string, focusKey?: string) => void =
    (_book: SearchBook, _variants: SearchBook[], _cover?: string): void => {};

  build() {
    SearchPage({
      externalHeaderHeight: this.presentation.headerBottom,
      surfaceModel: this.presentation.model,
      isPresentationCurrent: this.isCurrent,
      isPresentationVisible: this.isVisible,
      viewState: this.presentation.host.viewState,
      publication: this.presentation.host.publication,
      publicationRevision: this.presentation.publicationRevision,
      reduceMotion: this.reduceMotion,
      expandedLayout: this.expandedLayout,
      onBack: (): void => { if (this.isCurrent()) this.onBack(); },
      onSearch: (keyword: string, scopeSourceIds?: string[]): void => {
        if (this.isCurrent()) this.onQuery(keyword, scopeSourceIds);
      },
      onStop: (): void => {
        if (!this.isCurrent()) return;
        this.presentation.host.stop();
        this.coordinator?.endSearch();
      },
      onClearHistory: (): void => { if (this.isCurrent()) this.presentation.host.clearHistory(); },
      onRetryHistory: (): void => { if (this.isCurrent()) this.presentation.host.retryHistory(); },
      onSelectResult: (book: SearchBook, variants: SearchBook[], cover?: string, focusKey?: string): void => {
        if (this.isCurrent()) this.onResult(book, variants, cover, focusKey);
      },
      onVisibleGroups: (groups: SearchBook[][]): void => {
        if (this.isCurrent() && this.coordinator !== undefined)
          this.presentation.prepareGroups(this.coordinator, groups, this.isVisible());
      },
      onRetry: (): void => {
        if (!this.isCurrent()) return;
        this.coordinator?.beginSearch();
        this.presentation.host.retry();
      },
      onManageSources: (): void => { if (this.isCurrent()) this.onManageSources(); },
    });
  }
}
