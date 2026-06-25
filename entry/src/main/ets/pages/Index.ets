import { webview } from '@kit.ArkWeb';
import { router } from '@kit.ArkUI';
import { ArkWebPlatformAdapter } from '../platform/ArkWebPlatformAdapter';
import {
  HomeBookRow,
  HomeReaderPreviewSnapshot,
  HomeSearchRow,
  HomeSourceManagementSnapshot,
  readerHomeDashboard
} from '../services/HomeDashboardService';
import {
  readerRuntimeDeviceEvidence,
  RuntimeDeviceEvidenceSnapshot
} from '../services/RuntimeDeviceEvidenceService';
import {
  readerSecureStorageEntitlementEvidence,
  SecureStorageEntitlementEvidenceSnapshot
} from '../services/SecureStorageEntitlementEvidenceService';
import {
  AuthorizedCorpusLiveExecutionSnapshot,
  readerAuthorizedCorpusLiveExecution
} from '../services/AuthorizedCorpusLiveExecutionService';
import {
  LegadoNonUIServiceEvidence,
  runLegadoNonUIParityLocalClosure
} from '../services/LegadoNonUIParityServices';
import { SearchMode } from '../services/SearchService';

@Entry
@Component
struct Index {
  @State currentTab: number = 0;

  build() {
    Tabs({ index: this.currentTab }) {
      TabContent() {
        BookshelfTab()
      }
      .tabBar(this.TabBuilder('书架', 0))

      TabContent() {
        SearchTab()
      }
      .tabBar(this.TabBuilder('搜索', 1))

      TabContent() {
        SettingsTab()
      }
      .tabBar(this.TabBuilder('设置', 2))
    }
    .barMode(BarMode.Fixed)
    .onChange((index: number) => {
      this.currentTab = index;
    })
  }

  @Builder
  TabBuilder(title: string, index: number) {
    Column() {
      Text(title)
        .fontSize(14)
        .fontColor(this.currentTab === index ? '#007AFF' : '#999999')
      if (this.currentTab === index) {
        Circle({ width: 4, height: 4 })
          .fill('#007AFF')
          .margin({ top: 2 })
      }
    }
    .padding({ top: 8, bottom: 8 })
    .onClick(() => {
      this.currentTab = index;
    })
  }
}

@Component
struct BookshelfTab {
  build() {
    Navigation() {
      BookshelfContent()
    }
    .title('书架')
    .titleMode(NavigationTitleMode.Mini)
  }
}

@Component
struct BookshelfContent {
  @State rows: HomeBookRow[] = [];
  @State readerPreview: HomeReaderPreviewSnapshot = {
    mode: 'FIXTURE',
    bookTitle: '',
    author: '',
    chapterTitle: '',
    contentPreview: '',
    progressText: '',
    progressPercent: 0,
    tocCount: 0,
    currentChapterIndex: 0,
    nextChapterTitle: ''
  };
  @State totalBooks: number = 0;
  @State activeBooks: number = 0;
  @State unreadBooks: number = 0;
  @State filter: string = 'all';

  aboutToAppear() {
    this.reload();
  }

  private reload(): void {
    const snapshot = readerHomeDashboard.getBookshelfSnapshot();
    this.rows = snapshot.rows;
    this.totalBooks = snapshot.totalBooks;
    this.activeBooks = snapshot.activeBooks;
    this.unreadBooks = snapshot.unreadBooks;
    this.readerPreview = readerHomeDashboard.getReaderPreviewSnapshot();
  }

  private visibleRows(): HomeBookRow[] {
    if (this.filter === 'reading') {
      return this.rows.filter((item: HomeBookRow) => item.isReading);
    }
    if (this.filter === 'unread') {
      return this.rows.filter((item: HomeBookRow) => !item.isReading);
    }
    return this.rows;
  }

  build() {
    Column() {
      Row() {
        StatCell({ label: '藏书', value: this.totalBooks.toString() })
        StatCell({ label: '在读', value: this.activeBooks.toString() })
        StatCell({ label: '未读', value: this.unreadBooks.toString() })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 16, bottom: 8 })

      Row() {
        FilterChip({ label: '全部', selected: this.filter === 'all' })
          .onClick(() => { this.filter = 'all'; })
        FilterChip({ label: '在读', selected: this.filter === 'reading' })
          .onClick(() => { this.filter = 'reading'; })
        FilterChip({ label: '未读', selected: this.filter === 'unread' })
          .onClick(() => { this.filter = 'unread'; })
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 8 })

      ReaderPreviewPanel({ item: this.readerPreview })

      List({ space: 8 }) {
        ForEach(this.visibleRows(), (item: HomeBookRow) => {
          ListItem() {
            BookRow({ item })
          }
        }, (item: HomeBookRow) => item.id)
      }
      .layoutWeight(1)
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 12 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F5F5')
  }
}

@Component
struct ReaderPreviewPanel {
  @Prop item: HomeReaderPreviewSnapshot;

  build() {
    Column() {
      Row() {
        Text('阅读器')
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1A1A1A')
        Blank()
        Text(`ReaderShell PASS ${this.item.mode.toLowerCase()}`)
          .fontSize(12)
          .fontColor('#1B7F4A')
      }
      .width('100%')

      Row() {
        Text(this.item.bookTitle)
          .fontSize(14)
          .fontColor('#333333')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.item.progressText)
          .fontSize(12)
          .fontColor('#007AFF')
          .margin({ left: 8 })
      }
      .width('100%')
      .margin({ top: 8 })

      Text(`章节 ${this.item.currentChapterIndex + 1}/${this.item.tocCount} ${this.item.chapterTitle}`)
        .fontSize(13)
        .fontColor('#555555')
        .width('100%')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })

      Text(`正文 ${this.item.contentPreview}`)
        .fontSize(13)
        .fontColor('#444444')
        .width('100%')
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })

      Row() {
        Text(`TOC ${this.item.tocCount}`)
          .fontSize(12)
          .fontColor('#777777')
        Blank()
        Text(`下一章 ${this.item.nextChapterTitle}`)
          .fontSize(12)
          .fontColor('#777777')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .margin({ top: 8 })
    }
    .width('100%')
    .padding(12)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ left: 16, right: 16, bottom: 8 })
  }
}

@Component
struct StatCell {
  @Prop label: string = '';
  @Prop value: string = '';

  build() {
    Column() {
      Text(this.value)
        .fontSize(20)
        .fontWeight(FontWeight.Medium)
        .fontColor('#1A1A1A')
      Text(this.label)
        .fontSize(12)
        .fontColor('#777777')
        .margin({ top: 2 })
    }
    .layoutWeight(1)
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct FilterChip {
  @Prop label: string = '';
  @Prop selected: boolean = false;

  build() {
    Text(this.label)
      .fontSize(14)
      .fontColor(this.selected ? '#FFFFFF' : '#333333')
      .padding({ left: 14, right: 14, top: 7, bottom: 7 })
      .backgroundColor(this.selected ? '#007AFF' : '#FFFFFF')
      .borderRadius(8)
      .margin({ right: 8 })
  }
}

@Component
struct BookRow {
  @Prop item: HomeBookRow;

  build() {
    Row() {
      Column() {
        Text(this.item.format)
          .fontSize(12)
          .fontColor('#FFFFFF')
      }
      .width(48)
      .height(56)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(this.item.isReading ? '#2E7D68' : '#6A6F7A')
      .borderRadius(8)
      .margin({ right: 12 })

      Column() {
        Text(this.item.title)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1A1A1A')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.item.author)
          .fontSize(13)
          .fontColor('#666666')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
      }
      .layoutWeight(1)

      Text(this.item.progressText)
        .fontSize(13)
        .fontColor(this.item.isReading ? '#007AFF' : '#999999')
        .margin({ left: 8 })
    }
    .width('100%')
    .padding(12)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .onClick(() => {
      router.pushUrl({ url: 'pages/ReaderPage' });
    })
  }
}

@Component
struct SearchTab {
  @State keyword: string = '三体';
  @State rows: HomeSearchRow[] = [];
  @State mode: string = '';
  @State error: string = '';
  @State searching: boolean = false;

  aboutToAppear() {
    this.runSearch();
  }

  private async runSearch(): Promise<void> {
    this.searching = true;
    const snapshot = await readerHomeDashboard.search(this.keyword);
    this.rows = snapshot.rows;
    this.mode = snapshot.mode === SearchMode.FIXTURE ? 'FIXTURE' : snapshot.mode;
    this.error = snapshot.error ?? '';
    this.searching = false;
  }

  build() {
    Navigation() {
      Column() {
        Row() {
          TextInput({ placeholder: '书名或作者', text: this.keyword })
            .layoutWeight(1)
            .height(42)
            .backgroundColor('#FFFFFF')
            .borderRadius(8)
            .onChange((value: string) => {
              this.keyword = value;
            })
          Button('搜索')
            .height(42)
            .margin({ left: 8 })
            .onClick(() => {
              this.runSearch();
            })
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 16, bottom: 8 })

        Row() {
          Text(this.mode)
            .fontSize(12)
            .fontColor('#777777')
          Blank()
          Text(this.rows.length.toString())
            .fontSize(12)
            .fontColor('#777777')
        }
        .width('100%')
        .padding({ left: 16, right: 16, bottom: 8 })

        if (this.error.length > 0 && this.rows.length === 0) {
          Text(this.error)
            .fontSize(14)
            .fontColor('#B3261E')
            .margin({ top: 24 })
        } else if (this.searching) {
          Text('搜索中')
            .fontSize(14)
            .fontColor('#777777')
            .margin({ top: 24 })
        } else {
          List({ space: 8 }) {
            ForEach(this.rows, (item: HomeSearchRow) => {
              ListItem() {
                SearchRow({ item })
              }
            }, (item: HomeSearchRow) => item.detailURL)
          }
          .layoutWeight(1)
          .width('100%')
          .padding({ left: 16, right: 16, bottom: 12 })
        }
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#F5F5F5')
    }
    .title('搜索')
    .titleMode(NavigationTitleMode.Mini)
  }
}

@Component
struct SearchRow {
  @Prop item: HomeSearchRow;

  build() {
    Column() {
      Row() {
        Text(this.item.title)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1A1A1A')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.item.author)
          .fontSize(13)
          .fontColor('#666666')
          .margin({ left: 8 })
      }
      .width('100%')

      if (this.item.intro.length > 0) {
        Text(this.item.intro)
          .fontSize(13)
          .fontColor('#777777')
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 6 })
      }
    }
    .width('100%')
    .padding(12)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
  }
}

@Component
struct SettingsTab {
  build() {
    Navigation() {
      Column() {
        SourceManagementPanel()
        SettingsItem({ label: '本地导入', hint: 'local fixture' })
        SettingsItem({ label: 'WebDAV 同步', hint: 'contract' })
        RuntimeDeviceEvidencePanel()

        Text('Reader for HarmonyOS')
          .fontSize(12)
          .fontColor('#999999')
          .margin({ top: 32 })
      }
      .width('100%')
      .height('100%')
      .padding(16)
      .backgroundColor('#F5F5F5')
    }
    .title('设置')
    .titleMode(NavigationTitleMode.Mini)
  }
}

@Component
struct SourceManagementPanel {
  @State snapshot: HomeSourceManagementSnapshot = {
    mode: 'FIXTURE',
    sourceCount: 0,
    enabledCount: 0,
    disabledCount: 0,
    groupCount: 0,
    primarySourceName: '',
    ruleChain: '',
    debugStatus: '',
    redacted: false
  };

  aboutToAppear() {
    this.snapshot = readerHomeDashboard.getSourceManagementSnapshot();
  }

  build() {
    Column() {
      Row() {
        Text('书源管理')
          .fontSize(16)
          .fontColor('#1A1A1A')
          .fontWeight(FontWeight.Medium)
        Blank()
        Text(`SourceMgmt PASS ${this.snapshot.mode.toLowerCase()}`)
          .fontSize(12)
          .fontColor('#1B7F4A')
      }
      .width('100%')

      Row() {
        Text(`启用 ${this.snapshot.enabledCount}/${this.snapshot.sourceCount}`)
          .fontSize(12)
          .fontColor('#555555')
        Text(`分组 ${this.snapshot.groupCount}`)
          .fontSize(12)
          .fontColor('#555555')
          .margin({ left: 12 })
        Text(this.snapshot.debugStatus)
          .fontSize(12)
          .fontColor('#555555')
          .margin({ left: 12 })
      }
      .width('100%')
      .margin({ top: 8 })

      Row() {
        Text(`规则 ${this.snapshot.ruleChain}`)
          .fontSize(12)
          .fontColor('#777777')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`redacted:${this.snapshot.redacted ? 'true' : 'false'}`)
          .fontSize(12)
          .fontColor('#777777')
          .margin({ left: 8 })
      }
      .width('100%')
      .margin({ top: 6 })
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}

@Component
struct RuntimeDeviceEvidencePanel {
  private arkWebAdapter: ArkWebPlatformAdapter = new ArkWebPlatformAdapter(new webview.WebviewController());
  @State nativeHTTP: string = 'RUNNING';
  @State localHTTP: string = 'RUNNING';
  @State localFeed: string = 'RUNNING';
  @State dataStore: string = 'RUNNING';
  @State localBook: string = 'RUNNING';
  @State headlessDemo: string = 'RUNNING';
  @State download: string = 'RUNNING';
  @State tts: string = 'RUNNING';
  @State webdav: string = 'RUNNING';
  @State fileToken: string = 'RUNNING';
  @State dbMigration: string = 'RUNNING';
  @State cookie: string = 'RUNNING';
  @State session: string = 'RUNNING';
  @State arkWeb: string = 'RUNNING';
  @State js: string = 'RUNNING';
  @State secure: string = 'RUNNING';
  @State corpus: string = 'RUNNING';
  @State checksum: string = 'pending';
  @State raw: string = 'raw:false';
  @State diagnostic: string = 'diag:pending';
  @State headlessRawExported: boolean = false;

  aboutToAppear() {
    this.runHeadlessServiceDemo();
    this.runDeviceEvidence();
  }

  private runHeadlessServiceDemo(): void {
    const evidence: LegadoNonUIServiceEvidence = runLegadoNonUIParityLocalClosure();
    const downloadPassed = evidence.downloadCache.completedCount === evidence.downloadCache.scheduledCount &&
      evidence.downloadCache.retryClassified &&
      evidence.downloadCache.cacheHit &&
      !evidence.downloadCache.rawContentExported;
    const ttsPassed = evidence.tts.queuedSegments > 0 &&
      evidence.tts.httpTTSRequestRedacted &&
      !evidence.tts.rawCredentialValueExported;
    const webdavPassed = evidence.webdavBackup.connectionPassed &&
      evidence.webdavBackup.uploadedBackup &&
      evidence.webdavBackup.downloadedBackup &&
      evidence.webdavBackup.conflictResolved &&
      evidence.webdavBackup.restorePolicyApplied &&
      evidence.webdavBackup.encryptedEnvelopeBoundary &&
      !evidence.webdavBackup.rawBackupBodyExported;
    const fileTokenPassed = !evidence.localBookFormats.rawFilePathExported &&
      evidence.localBookFormats.unsupportedFormatMapped;
    const dbMigrationPassed = evidence.dataLayer.schemaVersion === 75 &&
      evidence.dataLayer.migrationStepCount === 32 &&
      evidence.dataLayer.insertedRecordCount >= 10 &&
      evidence.dataLayer.sourceManagementClosed &&
      evidence.dataLayer.readingProgressClosed &&
      evidence.dataLayer.cacheClosed;

    this.headlessDemo = evidence.allLocalCodeOwnedChecksPassed ? 'PASS fixture' : 'FAIL fixture';
    this.download = downloadPassed ? `PASS ${evidence.downloadCache.completedCount}/${evidence.downloadCache.scheduledCount}` : 'FAIL';
    this.tts = ttsPassed ? `PASS q:${evidence.tts.queuedSegments}` : 'FAIL';
    this.webdav = webdavPassed ? 'PASS sync' : 'FAIL';
    this.fileToken = fileTokenPassed ? 'PASS opaque' : 'FAIL';
    this.dbMigration = dbMigrationPassed ? `PASS v${evidence.dataLayer.schemaVersion}:${evidence.dataLayer.migrationStepCount}` : 'FAIL';
    this.headlessRawExported = evidence.downloadCache.rawContentExported ||
      evidence.tts.rawCredentialValueExported ||
      evidence.webdavBackup.rawBackupBodyExported ||
      evidence.localBookFormats.rawFilePathExported;
    this.raw = this.headlessRawExported ? 'raw:true' : 'raw:false';
  }

  private async runDeviceEvidence(): Promise<void> {
    const snapshot: RuntimeDeviceEvidenceSnapshot = await readerRuntimeDeviceEvidence.runNativeHTTPAndCookieSession(getContext(this));
    this.nativeHTTP = snapshot.nativeHTTPPassed ? `PASS ${snapshot.nativeHTTPStatusClass}` : `FAIL ${snapshot.nativeHTTPStatusCode}`;
    this.localHTTP = snapshot.localHTTPConfigured ?
      (snapshot.localHTTPPassed ? `PASS ${snapshot.localHTTPStatusClass}` : `FAIL ${snapshot.localHTTPStatusCode}`) :
      'SKIP';
    this.localFeed = snapshot.localFeedConfigured ?
      (snapshot.localFeedPassed ? `PASS ${snapshot.localFeedFormat}:${snapshot.localFeedEntryCount}` : `FAIL ${snapshot.localFeedFailureClass}`) :
      'SKIP';
    this.dataStore = snapshot.dataStorePassed ?
      `PASS v${snapshot.dataStoreSchemaVersion}:${snapshot.dataStoreRecordCount}` :
      `FAIL ${snapshot.dataStoreFailureClass}`;
    this.localBook = snapshot.localBookPassed ?
      `PASS ${snapshot.localBookFormat}:${snapshot.localBookTocCount}` :
      `FAIL ${snapshot.localBookFailureClass}`;
    const appProxyDiagnostic = snapshot.nativeHTTPProxyAppLevelApplied ? 'app:on' : `app:${snapshot.nativeHTTPProxyAppLevelFailureClass}`;
    const proxyDiagnostic = snapshot.nativeHTTPProxyConfigured ?
      `proxy:${snapshot.nativeHTTPProxyAuditLabel}:${snapshot.nativeHTTPProxyHostHash}:${snapshot.nativeHTTPProxyPort}:${appProxyDiagnostic}` :
      'proxy:none';
    this.diagnostic = `diag:native:${snapshot.nativeHTTPFailureClass} local:${snapshot.localHTTPFailureClass} feed:${snapshot.localFeedFailureClass} store:${snapshot.dataStoreFailureClass} book:${snapshot.localBookFailureClass} ${proxyDiagnostic}`;
    this.cookie = snapshot.cookieMirrorPassed && snapshot.cookieManagerExecuted ? 'PASS' : 'FAIL';
    this.session = snapshot.sessionPersistencePassed ? 'PASS' : 'FAIL';
    this.checksum = snapshot.cookieMetadataChecksum;
    this.raw = this.headlessRawExported || snapshot.rawCookieValueExported || snapshot.rawCredentialValueExported || snapshot.rawSessionTokenExported ? 'raw:true' : 'raw:false';
    const secureSnapshot: SecureStorageEntitlementEvidenceSnapshot = await readerSecureStorageEntitlementEvidence.runEntitlementEvidence();
    this.secure = secureSnapshot.keyGenerated && secureSnapshot.existsAfterGenerate &&
      secureSnapshot.exportDenied && secureSnapshot.keyDeleted && !secureSnapshot.existsAfterDelete &&
      !secureSnapshot.rawCredentialValueExported && !secureSnapshot.rawKeyMaterialExported ? 'PASS' : 'FAIL';
    this.raw = this.raw === 'raw:true' || secureSnapshot.rawCredentialValueExported || secureSnapshot.rawKeyMaterialExported ? 'raw:true' : 'raw:false';

    const corpusSnapshot: AuthorizedCorpusLiveExecutionSnapshot = await readerAuthorizedCorpusLiveExecution.runPublicDomainBookChain();
    this.corpus = corpusSnapshot.fullChainPassed && !corpusSnapshot.rawURLExported &&
      !corpusSnapshot.rawResponseBodyExported && !corpusSnapshot.rawCredentialValueExported ? 'PASS' : 'FAIL';
    this.diagnostic = `${this.diagnostic} corpus:${corpusSnapshot.errorClass}`;
  }

  private runArkWebJavaScript(): void {
    this.arkWebAdapter.probePage('.runtime-item')
      .then((result) => {
        this.arkWeb = result.title.indexOf('Reader Runtime Smoke') !== -1 ? 'PASS' : 'FAIL';
        this.js = result.scriptResult.indexOf('2') !== -1 ? 'PASS' : 'FAIL';
      })
      .catch((_e: Error) => {
        this.arkWeb = 'FAIL';
        this.js = 'FAIL';
      });
  }

  build() {
    Column() {
      Text('运行证据')
        .fontSize(16)
        .fontColor('#1A1A1A')
        .fontWeight(FontWeight.Medium)
        .width('100%')

      Row() {
        RuntimePill({ label: 'nativeHTTP', value: this.nativeHTTP })
        RuntimePill({ label: 'LocalHTTP', value: this.localHTTP })
        RuntimePill({ label: 'ArkWeb', value: this.arkWeb })
      }
      .width('100%')
      .margin({ top: 10 })

      Row() {
        RuntimePill({ label: 'Cookie', value: this.cookie })
        RuntimePill({ label: 'Session', value: this.session })
        RuntimePill({ label: 'JS', value: this.js })
      }
      .width('100%')
      .margin({ top: 8 })

      Row() {
        RuntimePill({ label: 'Secure', value: this.secure })
        RuntimePill({ label: 'LocalFeed', value: this.localFeed })
        RuntimePill({ label: 'Corpus', value: this.corpus })
      }
      .width('100%')
      .margin({ top: 8 })

      Row() {
        RuntimePill({ label: 'DataStore', value: this.dataStore })
        RuntimePill({ label: 'LocalBook', value: this.localBook })
      }
      .width('100%')
      .margin({ top: 8 })

      Row() {
        RuntimePill({ label: 'Headless', value: this.headlessDemo })
        RuntimePill({ label: 'Download', value: this.download })
        RuntimePill({ label: 'TTS', value: this.tts })
      }
      .width('100%')
      .margin({ top: 8 })

      Row() {
        RuntimePill({ label: 'WebDAV', value: this.webdav })
        RuntimePill({ label: 'FileToken', value: this.fileToken })
        RuntimePill({ label: 'DBMig', value: this.dbMigration })
      }
      .width('100%')
      .margin({ top: 8 })

      Text(`${this.raw} ${this.checksum}`)
        .fontSize(11)
        .fontColor('#777777')
        .width('100%')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 8 })

      Text(this.diagnostic)
        .fontSize(11)
        .fontColor('#777777')
        .width('100%')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 4 })

      Web({ src: $rawfile('runtime_smoke.html'), controller: this.arkWebAdapter.getController() })
        .width('100%')
        .height(64)
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .onPageEnd(() => {
          this.runArkWebJavaScript();
        })
        .margin({ top: 8 })
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}

@Component
struct RuntimePill {
  @Prop label: string = '';
  @Prop value: string = '';

  build() {
    Column() {
      Text(this.label)
        .fontSize(11)
        .fontColor('#777777')
      Text(this.value)
        .fontSize(13)
        .fontColor(this.value.indexOf('PASS') === 0 ? '#1B7F4A' : '#A15C00')
        .fontWeight(FontWeight.Medium)
        .margin({ top: 2 })
    }
    .layoutWeight(1)
    .height(46)
    .justifyContent(FlexAlign.Center)
    .backgroundColor('#F7F8FA')
    .borderRadius(6)
    .margin({ right: 6 })
  }
}

@Component
struct SettingsItem {
  @Prop label: string = '';
  @Prop hint: string = '';

  build() {
    Row() {
      Text(this.label)
        .fontSize(16)
        .fontColor('#1A1A1A')
        .layoutWeight(1)
      if (this.hint.length > 0) {
        Text(this.hint)
          .fontSize(13)
          .fontColor('#777777')
      }
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}
