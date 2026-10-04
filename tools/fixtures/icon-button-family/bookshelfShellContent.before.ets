@Component struct OriginalIndexSearchWitness {
@Builder
  private bookshelfShellContent(owner: ReaderRuntimeOwner | undefined = this.mountedRuntimeOwner,
    navigation: number = this.navigationGeneration, mounting: number = this.detailShelfAdmissionMount) {
    BookshelfShell({
      navigationGeneration: this.navigationGeneration,
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, generation?: number): void => {
        if (generation !== undefined) this.registerTemporaryBackBridge('bookshelf', generation, owner, handler, identity);
      },
      populated: this.isBookshelfVisualAdmitted,
      recovery: this.shelfRecovery(),
      canContinueRemoval: this.canContinueShelfRemoval(),
      removalActionLabel: this.shelfOperation.removalMutation?.confirmation === 'confirmed' ? '完成原删除清理' : '继续原删除操作',
      onContinueRemoval: (generation: number, presentedNavigation: number): void => {
        if (this.isCurrentBookshelfPresentation(presentedNavigation, owner, mounting)) void this.continueShelfRemoval(generation);
      },
      readRecovery: this.shelfReadRecovery(),
      onRetryRead: (generation: number, presentedNavigation?: number): void => {
        if (this.isCurrentBookshelfPresentation(presentedNavigation ?? navigation, owner, mounting)) this.retryBookshelfRead(generation);
      },
      onReconcile: (generation: number, presentedNavigation?: number): void => {
        if (!this.isCurrentBookshelfPresentation(presentedNavigation ?? navigation, owner, mounting)) return;
        if (generation < 0) void this.reconcileBookshelfCatalogProjection(generation);
        else void this.reconcileShelfWrite(generation);
      },
      reduceMotion: this.settingsSnapshot.reduceMotion,
      canCheckUpdates: this.isBookshelfVisualAdmitted && (this.shelfProjectionRevision.length > 0 ?
        this.shelfHasOnlineBooks : this.shelfBooks.some((book: ShelfBook): boolean => book.sourceId !== 'local')),
      updateRunning: this.bookshelfUpdateRunning,
      backgroundUpdateRunning: this.bookshelfBackgroundRefreshRunning,
      updateProgressDone: this.bookshelfUpdateDone,
      updateProgressTotal: this.bookshelfUpdateTotal,
      onImportRequested: (): void => this.openImportDialog(),
      onSearchRequested: (): void => this.openSearch(),
      onBookshelfSettingsRequested: (): void => this.openBookshelfSettings(),
      onBatchManageRequested: (): void => this.openBookshelfMultiSelect(),
      onCheckUpdatesRequested: (): void => this.startManualBookshelfUpdate(),
      onMainTab: (key: string): void => {
        if (key === 'discover') this.openDiscover();
        else if (key === 'rss') this.openRss();
        else if (key === 'settings') this.openSettings();
      },
    }) {
      this.bookshelfContent();
    }
  }
build() { Column() {} }
}
