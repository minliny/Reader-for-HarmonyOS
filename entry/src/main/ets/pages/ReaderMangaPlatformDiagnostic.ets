// Existing DEBUG pilot child. Fixed rawfile inputs; no reader session or user data writes.
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { MangaPlatformProbeRunner, type MangaProbeFrame, type MangaProbeReceipt } from '../app/MangaPlatformProbeRunner';

@Component
export struct ReaderMangaPlatformDiagnostic {
  @State private status: string = '固定32方向/长图、14条带、对照与3个大图区域；使用本机ImageKit和Native元数据';
  @State private busy: boolean = false;
  @State private passed: number = 0;
  @State private failed: number = 0;
  @State private frames: MangaProbeFrame[] = [];
  private mounted: boolean = false;
  private runner: MangaPlatformProbeRunner | undefined;
  private pendingId: string = '';
  private pendingResolve: ((loaded: boolean) => void) | undefined;
  private displayTimer: number = 0;
  private generation: number = 0;
  private receiptRunId: string = '';
  private receiptSequence: number = 0;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; void this.release(); }
  private acknowledge(id: string, loaded: boolean): void {
    if (id !== this.pendingId) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = undefined; this.pendingId = '';
    clearTimeout(this.displayTimer); this.displayTimer = 0;
    resolve?.(loaded);
  }
  private present(frame: MangaProbeFrame): Promise<boolean> {
    if (!this.mounted) return Promise.resolve(false);
    this.acknowledge(this.pendingId, false);
    const displayed: MangaProbeFrame = { id: `${this.generation}:${frame.id}`, fileUri: frame.fileUri, width: frame.width, height: frame.height };
    this.pendingId = displayed.id;
    this.frames = [displayed];
    return new Promise<boolean>((resolve: (loaded: boolean) => void): void => {
      this.pendingResolve = resolve;
      this.displayTimer = setTimeout((): void => { this.acknowledge(displayed.id, false); }, 10000);
    });
  }
  private receipt(value: MangaProbeReceipt): void {
    value.runId = this.receiptRunId; value.seq = ++this.receiptSequence; value.fixtureRevision = 'manga-platform-probe-v2-large';
    hilog.info(0x5244, 'ReaderMangaProbe', 'READER_MANGA_PLATFORM %{public}s', JSON.stringify(value));
    if (!this.mounted) return;
    if (value.checkResult !== false) { if (value.pass) this.passed++; else this.failed++; }
    this.status = `${value.caseId} · ${value.phase} · ${value.pass ? 'PASS' : 'FAIL'}${value.message === undefined ? '' : ` · ${value.message}`}`;
  }
  private async run(): Promise<void> {
    if (DEBUG !== true || BUILD_MODE_NAME !== 'debug') { this.status = '当前构建不提供图像诊断'; return; }
    if (this.busy) return;
    await this.release();
    if (!this.mounted) return;
    const context = this.getUIContext().getHostContext();
    if (context === undefined) { this.status = '无法读取固定rawfile资源'; return; }
    const generation = ++this.generation;
    this.receiptRunId = `${Date.now()}-${generation}`; this.receiptSequence = 0;
    this.busy = true; this.passed = 0; this.failed = 0;
    const runner = new MangaPlatformProbeRunner(
      (file: string): Promise<Uint8Array> => context.resourceManager.getRawFileContent(file),
      (value: MangaProbeReceipt): void => this.receipt(value),
      (frame: MangaProbeFrame): Promise<boolean> => this.present(frame), DEBUG, BUILD_MODE_NAME);
    this.runner = runner;
    try { await runner.run(); }
    catch (error) { this.receipt({ caseId: 'initialization', phase: 'native-owner', pass: false, message: (error as Error).message.slice(0, 240), presentationEvidence: false }); }
    finally { if (this.mounted && generation === this.generation) this.busy = false; }
  }
  private async release(): Promise<void> {
    this.generation++;
    const runner = this.runner; this.runner = undefined;
    runner?.cancel();
    this.acknowledge(this.pendingId, false);
    this.frames = [];
    if (runner !== undefined) await runner.dispose();
    if (this.mounted) this.busy = false;
  }
  build() {
    Column({ space: 10 }) {
      Text('漫画平台图像诊断').fontSize(18)
      Text('只验证固定夹具，不导入书源、不写阅读位置。Image.onComplete与截图验收分开记录。').fontSize(12)
      Row({ space: 8 }) {
        Button('运行本机图像检查').enabled(!this.busy).id('reader-manga-probe-run')
          .onClick((): void => { void this.run(); })
        Button('取消并释放').id('reader-manga-probe-release')
          .onClick((): void => { void this.release(); })
      }
      Text(`PASS ${this.passed} · FAIL ${this.failed}`).id('reader-manga-probe-counts')
      Text(this.status).fontSize(12).maxLines(5).id('reader-manga-probe-status')
      ForEach(this.frames, (frame: MangaProbeFrame) => {
        Image(frame.fileUri).width(180).height(270).objectFit(ImageFit.Contain)
          .id('reader-manga-probe-image')
          .onComplete((event): void => {
            if (event?.loadingStatus === 1 && event.width === frame.width && event.height === frame.height) this.acknowledge(frame.id, true);
          })
          .onError((): void => { this.acknowledge(frame.id, false); })
      }, (frame: MangaProbeFrame): string => frame.id)
      Text('最后一张保留显示租约供截图；点“取消并释放”记录归零结果。').fontSize(12)
    }.width('100%').padding(12)
  }
}
