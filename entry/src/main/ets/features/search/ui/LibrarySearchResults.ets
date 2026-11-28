import type { BookAcquisitionCoordinator } from '../../reading/application/BookAcquisitionCoordinator';
import { LibrarySearchPresentation } from '../presentation/LibrarySearchPresentation';
import type { SearchBook } from '../application/SearchGateway';
import { SearchPage } from './SearchPage';

@Component
export struct LibrarySearchResults {
  @ObjectLink presentation: LibrarySearchPresentation;
  @Prop presented: boolean = true;
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

  private inputCurrent(): boolean { return this.isCurrent() && this.isVisible(); }

  build() {
    SearchPage({
      externalHeaderHeight: this.presentation.headerBottom,
      surfaceModel: this.presentation.model,
      presented: this.presented,
      isPresentationCurrent: this.isCurrent,
      isPresentationVisible: this.isVisible,
      viewState: this.presentation.host.viewState,
      publication: this.presentation.host.publication,
      publicationRevision: this.presentation.publicationRevision,
      reduceMotion: this.reduceMotion,
      expandedLayout: this.expandedLayout,
      onBack: (): void => { if (this.inputCurrent()) this.onBack(); },
      onSearch: (keyword: string, scopeSourceIds?: string[]): void => {
        if (this.inputCurrent()) this.onQuery(keyword, scopeSourceIds);
      },
      onNeedMore: (): void => { if (this.inputCurrent()) this.presentation.host.needMoreResults(); },
      onStop: (): void => {
        if (!this.inputCurrent()) return;
        this.presentation.host.stop();
        this.coordinator?.endSearch();
      },
      onClearHistory: (): void => { if (this.inputCurrent()) this.presentation.host.clearHistory(); },
      onRetryHistory: (): void => { if (this.inputCurrent()) this.presentation.host.retryHistory(); },
      onDeleteHistory: (keyword: string): void => {
        if (this.inputCurrent()) {
          void this.presentation.host.deleteHistory(keyword).catch((): void => {});
        }
      },
      onSelectResult: (book: SearchBook, variants: SearchBook[], cover?: string, focusKey?: string): void => {
        if (this.inputCurrent()) this.onResult(book, variants, cover, focusKey);
      },
      onVisibleGroups: (groups: SearchBook[][]): void => {
        if (this.isCurrent() && this.coordinator !== undefined)
          this.presentation.prepareGroups(this.coordinator, groups, this.presented && this.isVisible());
      },
      onRetry: (): void => {
        if (!this.inputCurrent()) return;
        if (this.presentation.host.presentation().kind !== 'sourceLoadError') this.coordinator?.beginSearch();
        this.presentation.host.retry();
      },
      onManageSources: (): void => { if (this.inputCurrent()) this.onManageSources(); },
    });
  }
}
