import { DiscoverPage } from './DiscoverPage';
import { DiscoverScenePresentation } from '../presentation/DiscoverScenePresentation';
import type { DiscoverBook } from '../application/DiscoverGateway';

@Component
export struct DiscoverSurface {
  @ObjectLink presentation: DiscoverScenePresentation;
  @Prop expandedLayout: boolean = false;
  identity: string = '';
  onBack: () => void = (): void => {};
  onRss: () => void = (): void => {};
  onSettings: () => void = (): void => {};
  onOpenBook: (book: DiscoverBook) => void = (_book: DiscoverBook): void => {};

  build() {
    DiscoverPage({
      presentation: this.presentation.snapshot,
      expandedLayout: this.expandedLayout,
      onBack: (): void => { if (this.presentation.operations(this.identity) !== undefined) this.onBack(); },
      onRssRequested: (): void => { if (this.presentation.operations(this.identity) !== undefined) this.onRss(); },
      onSettingsRequested: (): void => { if (this.presentation.operations(this.identity) !== undefined) this.onSettings(); },
      onRetryRead: (expected: number): void => this.presentation.operations(this.identity)?.retryRead(expected),
      onRefresh: (): void => this.presentation.operations(this.identity)?.refresh(),
      onCycleSource: (): void => this.presentation.operations(this.identity)?.cycleSource(),
      onSelectKind: (index: number): void => this.presentation.operations(this.identity)?.selectKind(index),
      onPreviousPage: (): void => this.presentation.operations(this.identity)?.previousPage(),
      onNextPage: (): void => this.presentation.operations(this.identity)?.nextPage(),
      onOpenBook: (book: DiscoverBook): void => {
        if (this.presentation.operations(this.identity) !== undefined) this.onOpenBook(book);
      },
    });
  }
}
