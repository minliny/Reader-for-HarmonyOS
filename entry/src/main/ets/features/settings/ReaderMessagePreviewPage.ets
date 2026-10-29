import { CategorySection } from './CategorySection';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderStandardPage } from '../common/ReaderStandardPage';
import { ReaderButton } from '../common/ReaderButton';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../common/ReaderTransientFeedback';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { ReaderPageState } from '../common/ReaderPageState';
import { ReaderDialogSurface, DialogActionView } from '../common/ReaderDialogSurface';
import { LocalImportDialog } from '../bookshelf/LocalImportDialog';
import type { LocalImportBatch } from '../bookshelf/LocalBookImportGateway';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { MESSAGE_BODY, MESSAGE_META } from '../common/ReaderMessageStyle';
import { readerAppColor } from '../common/ReaderThemeRegistry';

type MessagePreviewScene = 'none' | 'toast' | 'notice' | 'notice-long' | 'notice-busy' |
  'page-loading' | 'page-empty' | 'page-failure' | 'dialog-normal' | 'dialog-danger' |
  'task-running' | 'task-success' | 'task-partial';
type MessagePreviewTone = 'info' | 'success' | 'error';

/** Fixture values never enter a gateway, persistent presentation or business owner. */
function previewImportBatch(partial: boolean): LocalImportBatch {
  return {
    state: 'completed', imported: partial ? 1 : 2, failed: partial ? 1 : 0,
    items: [
      { fileName: '示例书籍一.txt', state: 'success', disposition: 'created' },
      partial ? { fileName: '示例书籍二.epub', state: 'failed',
        failure: { code: 'invalidBook', message: '示例：文件格式无法识别，没有读取真实文件。' } } :
        { fileName: '示例书籍二.epub', state: 'success', disposition: 'existing' },
    ],
  };
}

/** Developer-only, in-memory presentation samples. Every action is local to
 * this mounted preview and its generation; no real operation is dispatched. */
@Component
export struct ReaderMessagePreviewPage {
  @Prop @Watch('admissionChanged') previewEnabled: boolean = false;
  @StorageLink('readerAppForeground') @Watch('admissionChanged') private foreground: boolean = true;
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @State private scene: MessagePreviewScene = 'none';
  @State private generation: number = 0;
  @State private batch: LocalImportBatch | undefined = undefined;
  private mounted: boolean = false;
  private timer: number = -1;
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private readonly scroller: Scroller = new Scroller();
  onBack: () => void = (): void => {};
  onBackHandlerChange: (handler: (() => boolean) | undefined) => void = (_handler: (() => boolean) | undefined): void => {};

  aboutToAppear(): void {
    this.mounted = true;
    this.onBackHandlerChange((): boolean => this.handleBack());
    this.admissionChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.clearPreview();
    this.onBackHandlerChange(undefined);
  }

  private admitted(): boolean { return this.mounted && this.previewEnabled && this.foreground; }
  private owns(expected: number): boolean { return this.admitted() && expected === this.generation; }

  private admissionChanged(): void {
    if (!this.admitted()) this.clearPreview();
  }

  private clearPreview(): void {
    this.generation += 1;
    if (this.timer >= 0) clearTimeout(this.timer);
    this.timer = -1;
    this.feedback.reset();
    this.scene = 'none';
    this.batch = undefined;
  }

  private handleBack(): boolean {
    if (!this.mounted || this.scene === 'none') return false;
    this.clearPreview();
    return true;
  }

  private back(): void { if (!this.handleBack() && this.mounted) this.onBack(); }

  private begin(scene: MessagePreviewScene): boolean {
    if (!this.admitted()) return false;
    this.clearPreview();
    this.scene = scene;
    return true;
  }

  private select(scene: MessagePreviewScene): void {
    if (!this.begin(scene)) return;
    if (scene === 'task-success' || scene === 'task-partial') this.batch = previewImportBatch(scene === 'task-partial');
    this.scroller.scrollEdge(Edge.Top);
  }

  private previewToast(tone: MessagePreviewTone, longText: boolean = false, message: string = ''): void {
    if (!this.begin('toast')) return;
    const expected = this.generation;
    const shown = this.feedback.show(() => this.getUIContext(), {
      title: longText ? '长文本消息预览' : '', tone,
      message: message.length > 0 ? message : longText ?
        '这是一条较长的示例消息，用来检查文字换行、内边距和显示边界；不会保存设置，也不会修改书籍或下载任务。' :
        tone === 'success' ? '成功反馈预览：示例操作已完成' :
        tone === 'error' ? '失败反馈预览：示例操作未完成' : '普通反馈预览：这是一条示例消息',
      key: `message-preview:${expected}`, duration: READER_FEEDBACK_BRIEF_MS,
    }, (): boolean => this.owns(expected));
    if (!shown) { this.clearPreview(); return; }
    this.timer = setTimeout((): void => {
      if (!this.owns(expected)) return;
      this.timer = -1;
      this.clearPreview();
    }, 2200);
  }

  private noticeView(): ReaderRecoveryView {
    return { visible: this.noticeActive(), canRetry: this.scene !== 'notice-busy', generation: this.generation,
      message: this.scene === 'notice-long' ?
        '示例操作的结果还没有确认。这段较长的说明用于检查多行文字、展开与收起、动作按钮和大字号下的排版。现有书籍与设置都不会改变，点击核对只会演示提示从处理中变为完成。' :
        this.scene === 'notice-busy' ? '示例核对正在处理中，不会执行实际操作。' : '示例操作结果待确认，请核对示例。' };
  }

  private reconcileNotice(expected: number): void {
    if (!this.owns(expected) || !this.noticeActive() || this.scene === 'notice-busy') return;
    this.scene = 'notice-busy';
    this.timer = setTimeout((): void => {
      if (!this.owns(expected)) return;
      this.timer = -1;
      this.previewToast('success', false, '预览：示例核对完成，未修改任何数据');
    }, 900);
  }

  private retryPage(expected: number): void {
    if (!this.owns(expected) || this.scene !== 'page-failure') return;
    this.scene = 'page-loading';
    this.timer = setTimeout((): void => {
      if (!this.owns(expected)) return;
      this.timer = -1;
      this.scene = 'page-empty';
    }, 900);
  }

  private end(expected: number): void { if (this.owns(expected)) this.clearPreview(); }

  private noticeActive(): boolean { return this.scene === 'notice' || this.scene === 'notice-long' || this.scene === 'notice-busy'; }
  private pageActive(): boolean { return this.scene === 'page-loading' || this.scene === 'page-empty' || this.scene === 'page-failure'; }
  private dialogActive(): boolean { return this.scene === 'dialog-normal' || this.scene === 'dialog-danger'; }
  private taskActive(): boolean { return this.scene === 'task-running' || this.scene === 'task-success' || this.scene === 'task-partial'; }

  build() {
    ReaderStandardPage({ variant: 'settingsGeneral', scroller: this.scroller,
      header: (): void => { this.header(); }, content: (): void => { this.content(); },
      overlayContent: (contentStartInset: number): void => { this.previewOverlay(contentStartInset); } });
  }

  @Builder
  private header() { PageBackBar({ title: '消息样式预览', onBack: (): void => this.back() }); }

  @Builder
  private content() {
    Text('仅供开发预览，以下内容均为示例。不会修改书籍、设置或下载任务。')
      .width('100%').fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
      .lineHeight(MESSAGE_BODY.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
    if (this.pageActive()) {
      this.pagePreview();
    } else if (!this.dialogActive() && !this.taskActive()) {
      this.sampleSections();
    }
    if (this.scene !== 'none' && !this.dialogActive() && !this.taskActive()) {
      ForEach([this.generation], (expected: number): void => {
        ReaderButton({ label: '结束当前预览', layout: 'full', scheme: this.appThemeScheme,
          actionEnabled: this.admitted(), onAction: (): void => this.end(expected) });
      }, (expected: number): string => expected.toString());
    }
  }

  @Builder
  private sampleSections() {
    CategorySection({ title: '短时反馈' }) {
      Column({ space: 8 }) {
        this.sampleButton('普通消息预览', (): void => this.previewToast('info'));
        this.sampleButton('成功消息预览', (): void => this.previewToast('success'));
        this.sampleButton('失败消息预览', (): void => this.previewToast('error'));
        this.sampleButton('长文本消息预览', (): void => this.previewToast('info', true));
      }.width('100%').padding(12);
    }
    CategorySection({ title: '持续提醒' }) {
      Column({ space: 8 }) {
        this.sampleButton('待核对提醒预览', (): void => this.select('notice'));
        this.sampleButton('长文本与双动作预览', (): void => this.select('notice-long'));
        this.sampleButton('处理中提醒预览', (): void => this.select('notice-busy'));
      }.width('100%').padding(12);
    }
    CategorySection({ title: '内容区状态' }) {
      Column({ space: 8 }) {
        this.sampleButton('加载状态预览', (): void => this.select('page-loading'));
        this.sampleButton('空状态预览', (): void => this.select('page-empty'));
        this.sampleButton('失败与重试预览', (): void => this.select('page-failure'));
      }.width('100%').padding(12);
    }
    CategorySection({ title: '确认弹窗' }) {
      Column({ space: 8 }) {
        this.sampleButton('普通确认预览', (): void => this.select('dialog-normal'));
        this.sampleButton('危险操作确认预览', (): void => this.select('dialog-danger'));
      }.width('100%').padding(12);
    }
    CategorySection({ title: '任务与逐项结果' }) {
      Column({ space: 8 }) {
        this.sampleButton('任务进行中预览', (): void => this.select('task-running'));
        this.sampleButton('全部成功结果预览', (): void => this.select('task-success'));
        this.sampleButton('部分失败结果预览', (): void => this.select('task-partial'));
      }.width('100%').padding(12);
    }
    Text('样式随当前日间 / 夜间主题显示。阅读手势、锁屏媒体和系统权限提醒不在此页触发。')
      .width('100%').fontFamily(MESSAGE_META.fontFamily).fontSize(MESSAGE_META.fontSizeFp)
      .lineHeight(MESSAGE_META.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
  }

  @Builder
  private sampleButton(label: string, action: () => void) {
    ReaderButton({ label, scheme: this.appThemeScheme, layout: 'full', actionEnabled: this.admitted(), onAction: action });
  }

  @Builder
  private pagePreview() {
    ForEach([this.generation], (expected: number): void => {
      ReaderPageState({ loading: this.scene === 'page-loading', loadingActive: this.admitted(),
        title: this.scene === 'page-loading' ? '加载状态预览' : this.scene === 'page-empty' ? '空状态预览' : '失败状态预览',
        message: this.scene === 'page-loading' ? '示例内容正在加载，不会发起网络请求。' :
          this.scene === 'page-empty' ? '示例内容为空，没有读取或修改真实书籍。' : '示例内容加载失败，点击重试可查看演示状态变化。',
        actionLabel: this.scene === 'page-failure' ? '重试示例' : '',
        secondaryActionLabel: this.scene === 'page-failure' ? '结束预览' : '',
        actionEnabled: this.owns(expected), secondaryActionEnabled: this.owns(expected),
        onAction: (): void => this.retryPage(expected), onSecondaryAction: (): void => this.end(expected) });
    }, (expected: number): string => expected.toString());
  }

  @Builder
  private previewOverlay(contentStartInset: number) {
    if (this.noticeActive()) {
      Column({ space: 8 }) {
        ReaderRecoveryNotice({ view: this.noticeView(), tag: '预览', actionLabel: '核对示例',
          secondaryActionLabel: this.scene === 'notice-long' ? '结束预览' : '', busy: this.scene === 'notice-busy',
          onReconcile: (expected: number): void => this.reconcileNotice(expected),
          onSecondaryAction: (expected: number): void => this.end(expected) });
        ForEach([this.generation], (expected: number): void => {
          ReaderButton({ label: '结束提醒预览', scheme: this.appThemeScheme, actionEnabled: this.owns(expected),
            onAction: (): void => this.end(expected) });
        }, (expected: number): string => expected.toString());
      }.width('100%').padding({ left: 19, right: 19, top: contentStartInset })
        .hitTestBehavior(HitTestMode.Transparent);
    } else if (this.dialogActive() || this.taskActive()) {
      Column() {
        ForEach([this.generation], (expected: number): void => {
          Row({ space: 8 }) {
            Text(this.taskActive() ? '任务消息示例 · 不会导入文件' : '确认弹窗示例 · 不会执行操作')
              .layoutWeight(1).fontFamily(MESSAGE_META.fontFamily).fontSize(MESSAGE_META.fontSizeFp)
              .lineHeight(MESSAGE_META.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
            ReaderButton({ label: '结束预览', scheme: this.appThemeScheme, actionEnabled: this.owns(expected),
              onAction: (): void => this.end(expected) });
          }.width('100%').padding({ left: 19, right: 19, top: 8, bottom: 8 })
            .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme));
        }, (expected: number): string => expected.toString());
        if (this.dialogActive()) this.dialogPreview();
        else this.taskPreview();
      }.width('100%').height('100%').padding({ top: contentStartInset })
        .hitTestBehavior(HitTestMode.Transparent);
    }
  }

  @Builder
  private dialogPreview() {
    Stack({ alignContent: Alignment.Center }) {
      Scroll() {
        Column() {
          ForEach([this.generation], (expected: number): void => {
            ReaderDialogSurface({ specId: 'book-removal',
              title: this.scene === 'dialog-danger' ? '危险操作预览' : '确认操作预览',
              body: (): void => { this.dialogBody(); },
              actions: [new DialogActionView('cancel', '取消预览'),
                new DialogActionView('confirm', '确认示例', this.scene === 'dialog-danger' ? 'danger' : 'primary')],
              onAction: (id: string): void => {
                if (!this.owns(expected) || !this.dialogActive()) return;
                if (id === 'confirm') this.previewToast('success', false, '预览：已点击确认，没有执行实际操作');
                else this.end(expected);
              }, onClose: (): void => this.end(expected) });
          }, (expected: number): string => expected.toString());
        }.width('100%').padding({ top: 20, bottom: 20 });
      }.width('100%').constraintSize({ maxHeight: '100%' }).scrollBar(BarState.Off);
    }.width('100%').layoutWeight(1)
      .backgroundColor(readerAppColor('app.scrim.warmModal', this.appThemeScheme));
  }

  @Builder
  private dialogBody() {
    Text(this.scene === 'dialog-danger' ?
      '这是危险操作样式示例。确认后仅显示预览反馈，不会删除书籍、缓存或其他数据。' :
      '这是普通确认样式示例。确认和取消仅结束本次预览，不会执行真实业务。')
      .width('100%').fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
      .lineHeight(MESSAGE_BODY.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
  }

  @Builder
  private taskPreview() {
    ForEach([this.generation], (expected: number): void => {
      LocalImportDialog({ state: this.scene === 'task-running' ? 'importing' : 'result', batch: this.batch,
        reduceMotion: this.reduceMotion, selectionEnabled: false, originalPending: false,
        onClose: (): void => this.end(expected) }).width('100%').layoutWeight(1);
    }, (expected: number): string => expected.toString());
  }
}
