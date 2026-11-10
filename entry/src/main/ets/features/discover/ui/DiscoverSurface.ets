import { DiscoverPage } from './DiscoverPage';
import { DiscoverScenePresentation } from '../presentation/DiscoverScenePresentation';

@Component
export struct DiscoverSurface {
  @ObjectLink presentation: DiscoverScenePresentation;
  @Prop expandedLayout: boolean = false;
  identity: string = '';
  onBack: () => void = (): void => {};
  onRss: () => void = (): void => {};
  onSettings: () => void = (): void => {};

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
    });
  }
}
