import { webview } from '@kit.ArkWeb';
import { ArkWebPlatformAdapter } from '../../platform/ArkWebPlatformAdapter';
import {
  HomeSourceManagementSnapshot,
  readerHomeDashboard
} from '../../services/HomeDashboardService';
import {
  readerRuntimeDeviceEvidence,
  RuntimeDeviceEvidenceSnapshot
} from '../../services/RuntimeDeviceEvidenceService';
import {
  readerSecureStorageEntitlementEvidence,
  SecureStorageEntitlementEvidenceSnapshot
} from '../../services/SecureStorageEntitlementEvidenceService';
import {
  AuthorizedCorpusLiveExecutionSnapshot,
  readerAuthorizedCorpusLiveExecution
} from '../../services/AuthorizedCorpusLiveExecutionService';
import {
  LegadoNonUIServiceEvidence,
  runLegadoNonUIParityLocalClosure
} from '../../services/LegadoNonUIParityServices';
import { runHostSmokeClosedLoop, ReaderHostSmokeClosedLoopResult } from '../../cabi/ReaderCoreNapiBridge';
import { ImportBookSourceViewModel, ImportState } from '../../viewmodel/ImportBookSourceViewModel';
import { runRustCoreEndToEndTests, RustCoreE2EResult } from '../../__tests__/RustCoreEndToEndValidator';
import { ReaderUiState } from '../ReaderUiState';

@Component
export struct SettingsTab {
  @Prop uiState: ReaderUiState;
  onToggleReducedMotion: (enabled: boolean) => void = (_enabled: boolean) => {};
  @State showDiagnostics: boolean = false;

  build() {
    Navigation() {
      Scroll() {
        Column() {
          UiMotionPanel({
            uiState: this.uiState,
            onToggleReducedMotion: this.onToggleReducedMotion
          })
          SourceManagementPanel()
          ImportBookSourcePanel()
          SettingsItem({ label: '本地导入', hint: '文件和书籍目录' })
          SettingsItem({ label: 'WebDAV 同步', hint: '备份与恢复' })
          SettingsItem({ label: '阅读偏好', hint: '字号、行距、主题' })

          Column() {
            Row() {
              Text('开发诊断')
                .fontSize(16)
                .fontWeight(FontWeight.Medium)
                .fontColor('#1A1A1A')
                .layoutWeight(1)
              Text(this.showDiagnostics ? '收起' : '展开')
                .fontSize(13)
                .fontColor('#007AFF')
            }
            .width('100%')
            .onClick(() => {
              this.showDiagnostics = !this.showDiagnostics;
            })

            if (this.showDiagnostics) {
              RustCoreE2ETestPanel()
              RuntimeDeviceEvidencePanel()
            }
          }
          .width('100%')
          .padding(16)
          .backgroundColor('#FFFFFF')
          .borderRadius(8)
          .margin({ bottom: 8 })

          Text('Reader for HarmonyOS')
            .fontSize(12)
            .fontColor('#999999')
            .margin({ top: 24, bottom: 32 })
        }
        .width('100%')
        .padding(16)
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#F5F5F5')
    }
    .title('设置')
    .titleMode(NavigationTitleMode.Mini)
  }
}

@Component
struct UiMotionPanel {
  @Prop uiState: ReaderUiState;
  onToggleReducedMotion: (enabled: boolean) => void = (_enabled: boolean) => {};

  build() {
    Column() {
      Row() {
        Text('减少动态效果')
          .fontSize(16)
          .fontColor('#1A1A1A')
          .fontWeight(FontWeight.Medium)
          .layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.uiState.reducedMotion })
          .onChange((isOn: boolean) => {
            this.onToggleReducedMotion(isOn);
          })
      }
      .width('100%')

      Text(this.uiState.reducedMotion ? '关闭大幅位移和长过渡。' : '保留 Tab 切换和阅读进入的短过渡。')
        .fontSize(13)
        .fontColor('#666666')
        .margin({ top: 8 })
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}

@Component
struct ImportBookSourcePanel {
  @State sourceJson: string = '';
  @State importing: boolean = false;
  @State importMessage: string = '';
  @State importSuccess: boolean = false;
  @State showPanel: boolean = false;
  private vm: ImportBookSourceViewModel | null = null;

  aboutToAppear() {
    this.vm = new ImportBookSourceViewModel();
  }

  private async doImport(): Promise<void> {
    if (this.vm === null) {
      return;
    }
    this.importing = true;
    this.importMessage = '';
    const state: ImportState = await this.vm.importBookSource(this.sourceJson);
    this.importing = false;
    this.importSuccess = state.success;
    this.importMessage = state.success ? '导入成功' : `导入失败: ${state.error}`;
  }

  build() {
    Column() {
      Row() {
        Text('导入书源')
          .fontSize(16)
          .fontColor('#1A1A1A')
          .fontWeight(FontWeight.Medium)
          .layoutWeight(1)
        Text(this.importSuccess ? 'Rust Core OK' : 'Rust Core')
          .fontSize(12)
          .fontColor(this.importSuccess ? '#1B7F4A' : '#999999')
      }
      .width('100%')
      .onClick(() => {
        this.showPanel = !this.showPanel;
      })

      if (this.showPanel) {
        Column() {
          Text('粘贴 Legado 书源 JSON:')
            .fontSize(13)
            .fontColor('#666666')
            .margin({ bottom: 6 })
          TextArea({ placeholder: '[{ "bookSourceUrl": "https://...", "bookSourceName": "...", ... }]', text: this.sourceJson })
            .width('100%')
            .height(120)
            .backgroundColor('#F8F8F8')
            .borderRadius(8)
            .padding(8)
            .fontSize(12)
            .onChange((value: string) => {
              this.sourceJson = value;
            })

          Row() {
            Button(this.importing ? '导入中...' : '导入')
              .height(36)
              .backgroundColor('#007AFF')
              .fontColor('#FFFFFF')
              .enabled(!this.importing && this.sourceJson.trim().length > 0)
              .onClick(() => {
                this.doImport();
              })
            Blank()
            if (this.importMessage.length > 0) {
              Text(this.importMessage)
                .fontSize(12)
                .fontColor(this.importSuccess ? '#1B7F4A' : '#B3261E')
            }
          }
          .width('100%')
          .margin({ top: 8 })
        }
        .width('100%')
        .margin({ top: 12 })
      }
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 8 })
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
        Text(this.snapshot.primarySourceName.length > 0 ? this.snapshot.primarySourceName : '未选择')
          .fontSize(12)
          .fontColor('#777777')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
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
        Text(this.snapshot.ruleChain)
          .fontSize(12)
          .fontColor('#777777')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.snapshot.redacted ? '已脱敏' : '待检查')
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
struct RustCoreE2ETestPanel {
  @State running: boolean = false;
  @State resultText: string = '';
  @State resultPassed: number = 0;
  @State resultFailed: number = 0;
  @State tier: string = '';

  private async runE2E(): Promise<void> {
    this.running = true;
    this.resultText = '运行中...';
    try {
      const result: RustCoreE2EResult = await runRustCoreEndToEndTests();
      this.resultPassed = result.runner.passed;
      this.resultFailed = result.runner.failed;
      this.tier = result.tier;
      const lines: string[] = [];
      lines.push(`Tier: ${result.tier}`);
      lines.push(`Summary: ${result.runner.summary()}`);
      lines.push(`Search results: ${result.searchResults.length}`);
      if (result.book) {
        lines.push(`Book: ${result.book.name} / ${result.book.author}`);
      }
      lines.push(`Chapters: ${result.chapters.length}`);
      lines.push(`Content[0..60]: ${result.firstChapterContent.substring(0, 60)}`);
      for (let i = 0; i < result.runner.results.length; i++) {
        const tr = result.runner.results[i];
        const status = tr.passed ? 'PASS' : 'FAIL';
        lines.push(`  [${status}] ${tr.name}${tr.error ? ' :: ' + tr.error : ''}`);
      }
      this.resultText = lines.join('\n');
    } catch (e) {
      this.resultText = `E2E 异常: ${e}`;
      this.resultFailed = 1;
    }
    this.running = false;
  }

  build() {
    Column() {
      Row() {
        Text('Rust Core E2E 测试')
          .fontSize(16)
          .fontColor('#1A1A1A')
          .fontWeight(FontWeight.Medium)
          .layoutWeight(1)
        Text(this.running ? '运行中' : (this.resultFailed === 0 && this.resultPassed > 0 ? 'PASS' : '待运行'))
          .fontSize(12)
          .fontColor(this.resultFailed === 0 && this.resultPassed > 0 ? '#1B7F4A' : '#999999')
      }
      .width('100%')
      .onClick(() => {
        if (!this.running) {
          this.runE2E();
        }
      })

      if (this.resultText.length > 0) {
        Scroll() {
          Text(this.resultText)
            .fontSize(11)
            .fontColor('#555555')
            .fontFamily('monospace')
            .width('100%')
            .textAlign(TextAlign.Start)
        }
        .width('100%')
        .height(200)
        .margin({ top: 8 })
        .backgroundColor('#F8F8F8')
        .borderRadius(8)
        .padding(8)
      }

      if (this.tier.length > 0) {
        Text(`证据分层: ${this.tier} (simulator ≠ real device)`)
          .fontSize(10)
          .fontColor('#999999')
          .margin({ top: 4 })
      }
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
  @State hostBus: string = 'RUNNING';
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

    // Host bus closed-loop: native hostSmoke() exercises host.request -> host.complete round-trip
    try {
      const hostResult: ReaderHostSmokeClosedLoopResult = runHostSmokeClosedLoop();
      if (hostResult.error !== null) {
        this.hostBus = `FAIL ${hostResult.error.substring(0, 20)}`;
      } else if (hostResult.hasHostRequest && hostResult.hasCompletion && hostResult.completionOk) {
        this.hostBus = `PASS op:${hostResult.hostOperationId ?? '?'}`;
      } else {
        this.hostBus = `FAIL req:${hostResult.hasHostRequest} cmp:${hostResult.hasCompletion} ok:${hostResult.completionOk}`;
      }
    } catch (e) {
      this.hostBus = 'FAIL native';
    }
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
        RuntimePill({ label: 'HostBus', value: this.hostBus })
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
