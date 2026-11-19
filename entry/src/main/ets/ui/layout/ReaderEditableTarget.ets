import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderRectVp } from '../foundation/ReaderWindowMetrics';
import { ReaderPostLayoutFrame } from './ReaderPostLayoutFrame';
import { ReaderEditingVisibility, type ReaderEditingTarget, type ReaderEditingTargetRect } from './ReaderEditingVisibility';
import { KeyCode } from '@kit.InputKit';
import hilog from '@ohos.hilog';
import { DEBUG } from '../../../../../build/default/generated/profile/default/BuildProfile';

let nextEditingTarget: number = 0;

/** Thin native field adapter. Window positions include presentation transforms;
 * native caret offsets and ComponentInfo sizes are px, converted exactly once. */
export class ReaderEditableTarget implements ReaderEditingTarget {
  readonly id: string = `reader-editable-target:${++nextEditingTarget}`;
  private context: UIContext | undefined = undefined;
  private nativeId: string = '';
  private enabled: () => boolean = (): boolean => false;
  private controller: TextInputController | TextAreaController | undefined = undefined;
  private host: ReaderEditingVisibility | undefined = undefined;
  private focused: boolean = false;
  private lineHeightVp: number | (() => number) = 24;
  private revision: number = 0;
  private editingContext: ((field: ReaderRectVp) => ReaderRectVp | undefined) | undefined = undefined;
  private traceCount: number = 0;
  trace: ((event: string, detail: string) => void) | undefined = DEBUG ?
    (event: string, detail: string): void => {
      if (this.traceCount++ < 24) hilog.info(0xD004, 'ReaderEditingDiagnostic',
        'target=%{public}s event=%{public}s facts=%{public}s', this.id, event, detail);
    } : undefined;

  mount(context: UIContext, host: ReaderEditingVisibility | undefined, controller: TextInputController | TextAreaController,
    current: () => boolean, lineHeightVp: number | (() => number), nativeId: string = this.id,
    editingContext?: (field: ReaderRectVp) => ReaderRectVp | undefined): void {
    this.host?.blur(this);
    this.revision += 1; this.focused = false; this.context = context; this.host = host;
    this.controller = controller; this.enabled = current; this.nativeId = nativeId;
    this.editingContext = editingContext;
    this.lineHeightVp = lineHeightVp;
    this.trace?.('mount', JSON.stringify({ host: host !== undefined, revision: this.revision }));
  }
  unmount(nativeId?: string): void {
    if (nativeId !== undefined && nativeId !== this.nativeId) return;
    this.host?.blur(this); this.revision += 1; this.focused = false;
    this.context = undefined; this.controller = undefined; this.host = undefined;
  }
  nativeCurrent(id: string): boolean { return this.context !== undefined && id === this.nativeId; }
  current(): boolean {
    return this.context !== undefined && this.focused && this.enabled() &&
      AppStorage.get<boolean>('readerAppForeground') !== false;
  }
  edit(focused: boolean): void {
    this.focused = focused;
    this.trace?.('edit', JSON.stringify({ focused: focused, enabled: this.enabled(), host: this.host !== undefined,
      current: this.current() }));
    if (focused && this.enabled()) this.host?.focus(this);
    else this.host?.blur(this);
  }
  changed(): void { if (this.current()) this.host?.refresh(); }
  back(): void { this.host?.blur(this); }
  revealText(): void {
    try {
      const caret = this.controller?.getCaretOffset();
      if (caret !== undefined && caret !== null && Number.isInteger(caret.index) && caret.index >= 0)
        this.controller?.scrollToVisible({ start: caret.index, end: caret.index });
    } catch (_detached) {}
  }
  afterLayout(action: () => void): boolean {
    const context = this.context, revision = this.revision;
    if (context === undefined) return false;
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        // The host must receive an inactive-current receipt too, so it can
        // release its pending slot during background/disabled intervals.
        if (this.context === context && this.revision === revision) action();
      }));
      return true;
    } catch (_detached) { return false; }
  }
  measure(): ReaderEditingTargetRect | undefined {
    const context = this.context;
    if (context === undefined || !this.current()) return undefined;
    try {
      const node = context.getFrameNodeById(this.nativeId);
      if (node === null) return undefined;
      const info = context.getComponentUtils().getRectangleById(this.nativeId);
      if (info.scale.x !== 1 || info.scale.y !== 1 || info.rotate.angle !== 0) return undefined;
      const position = node.getPositionToWindowWithTransform();
      const width = context.px2vp(info.size.width), height = context.px2vp(info.size.height);
      if (!(width > 0 && height > 0)) return undefined;
      const field = new ReaderRectVp(position.x, position.y, width, height);
      const editingContext = this.editingContext?.(field);
      if (this.editingContext !== undefined && editingContext === undefined) return undefined;
      const caret = this.controller?.getCaretOffset();
      const lineHeight = typeof this.lineHeightVp === 'function' ? this.lineHeightVp() : this.lineHeightVp;
      return { field: field, context: editingContext, caret: caret === undefined || caret === null ? undefined :
        new ReaderRectVp(field.left + context.px2vp(caret.x), field.top + context.px2vp(caret.y),
          1, Math.min(height, lineHeight)) };
    } catch (_detached) { return undefined; }
  }
}

export class ReaderEditableInputModifier implements AttributeModifier<TextInputAttribute> {
  private target: ReaderEditableTarget;
  private nativeId: string;
  private editing: (editing: boolean) => void;
  constructor(target: ReaderEditableTarget, nativeId: string, editing: (editing: boolean) => void) {
    this.target = target; this.nativeId = nativeId; this.editing = editing;
  }
  applyNormalAttribute(instance: TextInputAttribute): void { this.apply(instance); }
  apply(instance: TextInputAttribute | TextAreaAttribute): void {
    instance.id(this.nativeId);
    instance.onEditChange((editing: boolean): void => { if (this.target.nativeCurrent(this.nativeId)) this.editing(editing); });
    instance.onAreaChange((): void => { if (this.target.nativeCurrent(this.nativeId)) this.target.changed(); });
    instance.onTextSelectionChange((): void => { if (this.target.nativeCurrent(this.nativeId)) this.target.changed(); });
    instance.onContentScroll((): void => { if (this.target.nativeCurrent(this.nativeId)) this.target.changed(); });
    instance.onKeyPreIme((event: KeyEvent): boolean => {
      if (this.target.nativeCurrent(this.nativeId) && event.type === KeyType.Down && event.keyCode === KeyCode.KEYCODE_BACK) this.target.back();
      return false;
    });
  }
}

export class ReaderEditableAreaModifier implements AttributeModifier<TextAreaAttribute> {
  private binding: ReaderEditableInputModifier;
  constructor(target: ReaderEditableTarget, nativeId: string, editing: (editing: boolean) => void) {
    this.binding = new ReaderEditableInputModifier(target, nativeId, editing);
  }
  applyNormalAttribute(instance: TextAreaAttribute): void { this.binding.apply(instance); }
}
