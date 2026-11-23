import { LengthMetrics } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { ReaderDirectoryRecoverySurface } from '../features/reading/ui/ReaderDirectoryRecoverySurface';
import { ReaderLegacyBookmarkFixtureOwner } from './ReaderLegacyBookmarkFixtureOwner';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../features/reading/presentation/ReadingDirectoryRecovery';

@Component
export struct ReaderLegacyBookmarkRecoveryStructureFixture {
  @Prop fontsReady: boolean = false;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void = (): void => {};
  @State private revision: number = 0;
  @State private opened: boolean = false;
  private mounted: boolean = false;
  @State private opening: number = 0;
  private owner: ReaderLegacyBookmarkFixtureOwner | undefined;

  aboutToAppear(): void {
    this.mounted = true;
    if (this.admitted()) this.onTemporaryBackBridge((): boolean => this.back(), 'legacy-bookmark-fixture');
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.owner?.close();
    this.owner = undefined;
    this.onTemporaryBackBridge(undefined, 'legacy-bookmark-fixture');
  }

  private admitted(): boolean { return this.mounted && this.fontsReady && DEBUG === true && BUILD_MODE_NAME === 'debug'; }

  private current(opening: number): boolean { return this.admitted() && opening === this.opening && this.opened; }

  private open(): void {
    if (!this.admitted()) return;
    this.owner?.close();
    const opening = ++this.opening;
    this.opened = true;
    const owner = new ReaderLegacyBookmarkFixtureOwner(`legacy-native:${opening}`,
      (): boolean => this.current(opening), (): void => {
        if (this.current(opening)) { this.revision += 1; this.record('owner-change'); }
      });
    this.owner = owner;
    void owner.load().then((): void => this.record('loaded')).catch((): void => this.record('load-failed'));
  }

  private back(): boolean {
    if (!this.admitted() || !this.opened) return false;
    this.opened = false;
    this.owner?.close();
    this.owner = undefined;
    this.record('closed');
    return true;
  }

  private record(kind: string): void {
    if (!this.admitted()) return;
    hilog.info(0x5244, 'ReaderPageStructure', 'READER_LEGACY_BOOKMARK_FIXTURE %{public}s', JSON.stringify({
      kind, opening: this.opening, opened: this.opened,
      reconcileCount: this.owner?.gateway.reconcileCount ?? 0,
      rawOriginal: this.owner?.gateway.rawOriginal() ?? '',
      unexpectedRequests: this.owner?.runtime.unexpectedRequests ?? 0,
      recovery: this.owner?.recovery().originalBookmarks,
    }));
  }

  private hasRequest(_revision: number): boolean { return this.owner?.gateway.hasRequest() === true; }

  private recovery(_revision: number): ReadingDirectoryRecovery {
    return this.owner?.recovery() ?? EMPTY_READING_DIRECTORY_RECOVERY;
  }

  build() {
    if (this.admitted()) {
      Column({ space: 12 }) {
        Text('旧版原书签记录 · 内存端口').fontSize(18);
        Text('实际ReaderDirectoryHost与恢复组件，回执由以下内存按钮提供。').fontSize(14);
        Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
          Button('打开原记录').id('reader-legacy-open').onClick((): void => this.open());
          Button('回执仍不可用').id('reader-legacy-unavailable').enabled(this.hasRequest(this.revision))
            .onClick((): void => this.owner?.complete(false));
          Button('提供内存确认回执').id('reader-legacy-confirmed').enabled(this.hasRequest(this.revision))
            .onClick((): void => this.owner?.complete(true));
        }.width('100%');
        Text(`核对 ${this.owner?.gateway.reconcileCount ?? 0} · 观察 ${this.revision}`).fontSize(14)
          .id('reader-legacy-observation');
        if (this.opened && this.owner !== undefined) {
          ForEach([this.opening], (opening: number): void => {
            ReaderDirectoryRecoverySurface({ recovery: this.recovery(this.revision),
              presentationActive: this.current(opening), isPresentationCurrent: (): boolean => this.current(opening),
              onReconcileBookmarks: (generation: number, presentation: string): void => {
                if (this.current(opening)) void this.owner?.reconcile(generation, presentation);
              } });
          }, (opening: number): string => opening.toString());
        }
      }.width('100%').padding(12);
    }
  }
}
