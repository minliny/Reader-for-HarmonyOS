import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { MESSAGE_META } from '../../../ui/foundation/ReaderMessageStyle';
import { READER_ACTION_MIN_TARGET, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';

@Component
export struct ReaderSearchTaskTrigger {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop expanded: boolean = false;
  @Prop presentationIdentity: string = '';
  @Prop triggerFocusId: string = '';
  @Prop triggerWidth: number = 240;
  @Prop progressText: string = '';
  @Prop statusLabel: string = '';
  @Prop partialText: string = '';
  @Prop failed: number = 0;
  @Prop skipped: number = 0;
  onToggle: (identity: string, expanded: boolean) => void = (_identity: string, _expanded: boolean): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  private fontScale(): number {
    const value = this.metricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(value) && value > 0 ? Math.max(1, value) : 1;
  }
  private summaryLabel(): string {
    const parts: string[] = [this.progressText];
    if (this.partialText.length > 0) parts.push('部分未完成');
    if (this.failed > 0) parts.push(`${this.failed} 失败`);
    if (this.skipped > 0) parts.push(`${this.skipped} 跳过`);
    return parts.filter((value: string): boolean => value.length > 0).join(' · ');
  }
  private triggerHeight(): number { return (MESSAGE_META.lineHeightFp ?? 18) * this.fontScale() + 8; }
  private toggleAction(identity: string, expanded: boolean): () => void {
    return (): void => { if (this.mounted) this.onToggle(identity, expanded); };
  }
  build() {
    Row({ space: 8 }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: 4 }) {
        Text(this.summaryLabel()).layoutWeight(1).fontFamily(MESSAGE_META.fontFamily).fontWeight(MESSAGE_META.fontWeight)
          .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number).halfLeading(true)
          .fontColor(readerAppColor('TOK_MUTED', this.scheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Image(this.scheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
          .width(10).height(10).objectFit(ImageFit.Contain).accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
        }.width(this.triggerWidth).height(this.triggerHeight());
      }.width(this.triggerWidth).height(this.triggerHeight()).id(this.triggerFocusId)
        .padding(0).attributeModifier(new ReaderPressFeedback(Color.Transparent, this.scheme, this.triggerHeight() / 2))
        // Expanded response stays left of the filter's reserved right lane.
        .responseRegion(readerActionTouchRegion(this.triggerWidth, this.triggerHeight()))
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityText(`查看搜索进度，${this.summaryLabel()}`)
        .onClick(this.toggleAction(this.presentationIdentity, this.expanded));
      Text(this.statusLabel).width(READER_ACTION_MIN_TARGET).fontFamily(MESSAGE_META.fontFamily).fontSize(10).lineHeight(15)
        .fontColor(readerAppColor('TOK_MUTED', this.scheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
    }.width('100%').alignItems(VerticalAlign.Center);
  }
}
