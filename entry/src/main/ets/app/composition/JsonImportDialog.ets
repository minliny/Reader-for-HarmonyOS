import { ReaderDialogViewport } from '../../ui/surfaces/ReaderDialogViewport';
import { ReaderEditingVisibility } from '../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../ui/layout/ReaderEditingScrollBinding';
import { ReaderButton } from '../../ui/controls/ReaderButton';
import { ReaderFormField } from '../../ui/controls/ReaderFormField';
import { ReaderTransientFeedback } from '../../ui/feedback/ReaderTransientFeedback';
import { ReaderClipboardDraftPaste, readerClipboardPasteMessage,
  type ReaderClipboardPasteProblem } from '../../platform/clipboard/ReaderClipboardHost';
import { TYPE_FORM_ACTION } from '../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../ui/foundation/ReaderThemeRegistry';
import { registerReaderFonts } from '../../ui/foundation/ReaderFonts';
import { TOK_SPACE_XS } from '../../ui/foundation/ReaderTokens';
import { ReaderDialogSurface, DialogActionView } from '../../ui/surfaces/ReaderDialogSurface';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../ui/surfaces/ReaderSurfaceMaterial';
import type { ReaderNavigationPreferences } from '../HarmonyCapabilityPolicy';
import { readerImportCardTransition, readerImportOverlayTransition } from '../../ui/surfaces/ReaderImportDialogStyle';
import { MESSAGE_BODY, MESSAGE_META } from '../../ui/foundation/ReaderMessageStyle';
import { FrameCallback } from '@kit.ArkUI';
import type { JsonImportFocusReturn } from './JsonImportPresentation';

class JsonImportFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/**
 * Shared acquisition surface for portable JSON imports.
 *
 * The dialog owns only user intent and the URL draft. Local document access
 * and online HTTP remain Host capabilities; JSON validation and persistence
 * remain in each feature's existing Core import command.
 *
 * The framed card (header/actions/spec geometry) comes from the shared dialog
 * surface family under the 'json-import' spec; this struct keeps the
 * self-drawn full-height overlay (mask + zIndex), the URL draft, validation
 * and the import admission.
 */
@Component
export struct JsonImportDialog {
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();
  private readonly editingScroller: Scroller = new Scroller();
  private readonly draftPaste: ReaderClipboardDraftPaste = new ReaderClipboardDraftPaste();
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @StorageLink('readerAppForeground') @Watch('retireClipboardPaste') private foreground: boolean = true;
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;

  title: string = '导入 JSON';
  description: string = '支持选择本地 JSON 文件，或从在线链接下载后导入。';
  expandedLayout: boolean = false;
  openingId: number = 0;
  captureFocusReturn: (() => JsonImportFocusReturn | undefined) | undefined = undefined;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onDismiss: () => void = (): void => {};
  onSelectLocal: () => void = (): void => {};
  onImportOnline: (url: string) => void = (_url: string): void => {};
  @State private urlDraft: string = '';
  @State private validationMessage: string = '';
  @State private urlInputRevision: number = 0;
  private mounted: boolean = false;
  private focusRevision: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    this.focusRevision += 1;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.focusRevision += 1;
    this.urlInputRevision += 1;
    this.retireClipboardPaste();
    this.transientFeedback.reset();
  }

  private inputIsCurrent(): boolean { return this.mounted && (this.isInputAllowed?.() ?? true); }

  private dismissIfCurrent(): void { if (this.foreground && this.inputIsCurrent()) this.onDismiss(); }

  private focusScopeKey(): string { return `reader-json-import:${this.openingId}`; }
  private localFocusKey(): string { return `${this.focusScopeKey()}:local`; }

  private requestInitialFocus(): void {
    const opening = this.openingId, revision = this.focusRevision;
    this.requestFocusAfterFrame((): boolean => this.inputIsCurrent() && opening === this.openingId &&
      revision === this.focusRevision, this.localFocusKey(), this.focusScopeKey());
  }

  private restoreFocusAction(): () => void {
    const restore = this.captureFocusReturn?.();
    return (): void => {
      if (restore !== undefined) this.requestFocusAfterFrame(restore.isCurrent, restore.preferred, restore.fallback);
    };
  }

  private requestFocusAfterFrame(current: () => boolean, preferred: string, fallback: string): void {
    try {
      this.getUIContext().postFrameCallback(new JsonImportFocusFrame((): void => {
        try {
          if (!this.foreground || !current()) return;
          const context = this.getUIContext(), focus = context.getFocusController();
          for (const target of [preferred, fallback]) {
            if (target.length === 0) continue;
            try {
              const rect = context.getComponentUtils().getRectangleById(target);
              if (!Number.isFinite(rect.size.width) || !Number.isFinite(rect.size.height) ||
                rect.size.width <= 0 || rect.size.height <= 0) continue;
              // API 23 returns void; an unavailable or unfocusable actor may throw.
              focus.requestFocus(target);
              return;
            } catch (_unavailableTarget) {}
          }
        } catch (_retiredContext) {}
      }));
    } catch (_detachedContext) {}
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.appThemeScheme,
          readerAppColor('app.scrim.modal', this.appThemeScheme)))
        .accessibilityLevel('no')
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
        .onClick((): void => this.dismissIfCurrent());
      ReaderDialogViewport({ scroller: this.editingScroller, nativeId: this.editingScroll.id,
        onScrollAppeared: (): void => this.editingScroll.mount(this.getUIContext(), this.editingHost, this.editingScroller),
        onScrollDisappeared: (): void => this.editingScroll.unmount(),
        onScrollChanged: (): void => this.editingHost.refresh(),
        content: (widthVp: number, _heightVp: number): void => {
          ReaderDialogSurface({ specId: 'json-import', containerWidthVp: widthVp, title: this.title, showCloseButton: true,
            actions: [new DialogActionView('importOnline', '从在线链接导入', 'primary', true, false)],
            onAction: (id: string): void => { if (id === 'importOnline') this.submitOnlineImport(); },
            onClose: (): void => this.dismissIfCurrent(),
            body: (): void => { this.formBody(); },
          }).transition(readerImportCardTransition(this.reduceMotion)).hitTestBehavior(HitTestMode.Default);
        },
      });
    }
    .width('100%')
    .height('100%')
    .id(this.focusScopeKey()).focusable(true).focusScopeId(this.focusScopeKey(), true, false)
    .onAppear((): void => this.requestInitialFocus())
    .onDisAppear(this.restoreFocusAction())
    .transition(readerImportOverlayTransition(this.reduceMotion))
    .zIndex(200);
  }

  @Builder
  private formBody() {
    Column({ space: 12 }) {
      Text(this.description)
        .width('100%')
        .fontFamily(MESSAGE_BODY.fontFamily as string)
        .fontSize(MESSAGE_BODY.fontSizeFp)
        .lineHeight(MESSAGE_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));

      this.localButton();

      Column({ space: TOK_SPACE_XS }) {
        Row({ space: TOK_SPACE_XS }) {
          Text('或输入在线链接')
            .layoutWeight(1)
            .fontFamily(TYPE_FORM_ACTION.fontFamily)
            .fontWeight(TYPE_FORM_ACTION.fontWeight)
            .fontSize(TYPE_FORM_ACTION.fontSizeFp)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          PasteButton()
            .enabled(this.foreground && this.inputIsCurrent())
            .onClick((_event: ClickEvent, result: PasteButtonOnClickResult): void => this.pasteUrlDraft(result));
        }.width('100%');
        ForEach([this.urlInputRevision], (revision: number): void => {
          ReaderFormField({ editingHost: this.editingHost, isEditable: this.inputIsCurrent(), scheme: this.appThemeScheme, specId: 'form-url', text: this.urlDraft,
            placeholder: 'https://example.com/data.json',
            onTextChange: (value: string): void => this.updateUrlDraft(revision, value),
            onSubmit: (): void => { if (revision === this.urlInputRevision) this.submitOnlineImport(); } });
        }, (revision: number): string => `json-import-url:${revision}`);
        Text('GitHub 仓库文件请使用 Raw 链接；普通 blob 页面不是 JSON。')
          .width('100%')
          .fontFamily(MESSAGE_META.fontFamily as string)
          .fontSize(MESSAGE_META.fontSizeFp)
          .lineHeight(MESSAGE_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
        if (this.validationMessage.length > 0) {
          Text(this.validationMessage)
            .width('100%')
            .fontFamily(MESSAGE_BODY.fontFamily as string)
            .fontSize(MESSAGE_BODY.fontSizeFp)
            .lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MESSAGE_DANGER', this.appThemeScheme));
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start);
  }

  // The original business order keeps the local-file action between the
  // description and the URL form; it is a content action, not a trailing
  // dialog action, so the body renders it in place.
  @Builder
  private localButton() {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'form-action', label: '选择本地 JSON 文件', primary: true, layout: 'full',
      focusId: this.localFocusKey(),
      onAction: (): void => { if (this.inputIsCurrent()) this.onSelectLocal(); } });
  }

  private updateUrlDraft(revision: number, value: string): void {
    if (!this.mounted || revision !== this.urlInputRevision) return;
    if (!this.inputIsCurrent()) {
      if (value !== this.urlDraft) this.urlInputRevision += 1;
      return;
    }
    if (value !== this.urlDraft) this.retireClipboardPaste();
    this.urlDraft = value;
    if (this.validationMessage.length > 0) this.validationMessage = '';
  }

  private retireClipboardPaste(): void { this.draftPaste.retire(); }

  private pasteUrlDraft(result: PasteButtonOnClickResult): void {
    const opening = this.openingId;
    const revision = this.urlInputRevision;
    const isCurrent = (): boolean => this.foreground && this.inputIsCurrent() &&
      opening === this.openingId && revision === this.urlInputRevision;
    void this.draftPaste.paste(result === PasteButtonOnClickResult.SUCCESS, isCurrent,
      (text: string): void => this.updateUrlDraft(revision, text), (problem: ReaderClipboardPasteProblem): void => {
        this.transientFeedback.show((): UIContext => this.getUIContext(),
          { message: readerClipboardPasteMessage(problem), tone: 'error' }, isCurrent);
      });
  }

  private submitOnlineImport(): void {
    if (!this.inputIsCurrent()) return;
    this.retireClipboardPaste();
    const onlineUrl = this.urlDraft.trim();
    if (onlineUrl.length === 0) {
      this.validationMessage = '请输入在线 JSON 的 HTTP/HTTPS 地址';
      return;
    }
    if (!/^https?:\/\//i.test(onlineUrl)) {
      this.validationMessage = '请使用以 http:// 或 https:// 开头的 JSON 链接';
      return;
    }
    this.onImportOnline(onlineUrl);
  }
}
