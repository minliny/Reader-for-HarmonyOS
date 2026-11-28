import { TYPE_APP_SEGMENT_LABEL, TYPE_APP_SEGMENT_LABEL_SELECTED } from '../foundation/ReaderTypography';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import type { ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';
import { CapsuleSegmentButtonV2, SegmentButtonV2Items, type SegmentButtonV2ItemOptions } from '@ohos.arkui.advanced.SegmentButtonV2';
import { TextModifier } from '@ohos.arkui.modifier';
import { ColorMetrics, LengthMetrics } from '@ohos.arkui.node';
import { FrameCallback } from '@kit.ArkUI';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerUnionTouchRegion } from './ReaderActionAccessibility';
import { triggerReaderTouchHaptic } from './ReaderTouchHaptic';

interface ReaderSegmentOpening { identity: string; ids: string[]; }

class ReaderSegmentPolicyFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_time: number): void {}
}

type ReaderSegmentSpecId = 'app-theme-segment';
interface ReaderSegmentSpec {
  width: number;
  padding: number;
  radius: number;
  itemRadius: number;
  borderWidth: number;
  activeText: ReaderAppColorRole;
  inactiveText: ReaderAppColorRole;
  selectedSurface: ReaderAppColorRole;
  surface: ReaderAppColorRole;
  border: ReaderAppColorRole;
}
export const READER_APP_THEME_SEGMENT_WIDTH = 162;
const APP_THEME_SEGMENT: ReaderSegmentSpec = {
  width: READER_APP_THEME_SEGMENT_WIDTH, padding: 3, radius: 11, itemRadius: 8, borderWidth: 0.75,
  activeText: 'app.segment.activeText',
  inactiveText: 'TOK_MUTED',
  selectedSurface: 'app.segment.selected',
  surface: 'app.segment.surface', border: 'app.segment.border',
};
function resolveReaderSegmentSpec(id: ReaderSegmentSpecId): ReaderSegmentSpec {
  if (id !== 'app-theme-segment') throw new Error('Unknown ReaderSegmentedControl specification');
  return APP_THEME_SEGMENT;
}

/** Controlled short enum. Native choice controls render only the owner's accepted projection. */
@Component
export struct ReaderSegmentedControl {
  @StorageLink('readerAppScheme') @Watch('syncNativeThemeItems') private appThemeScheme: string = 'day';
  @StorageProp('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageLink('readerUiConfigurationRevision') @Watch('refreshThemeFontPolicy')
  private uiConfigurationRevision: number = 0;
  @State private themeFontPolicyReady: boolean = false;
  @State private themeMaxFontScale: number = 1;
  @State private trackHeight: number = 36;
  @Prop @Watch('refreshThemeFontPolicy') specId: ReaderSegmentSpecId = 'app-theme-segment';
  @Prop controlWidth: number = 0;
  @Prop @Watch('syncNativeThemeItems') options: string[] = [];
  @Prop @Watch('syncNativeThemeItems') optionIds: string[] = [];
  @Prop @Watch('syncNativeThemeItems') selectedIndex: number = 0;
  @Prop @Watch('syncNativeThemeItems') actionEnabled: boolean = true;
  @Prop @Watch('syncNativeThemeItems') isBusy: boolean = false;
  @Prop @Watch('syncNativeThemeItems') inputIdentity: string = '';
  @Prop accessibilityLabel: string = '';
  onSelect: (index: number) => void = (_index: number): void => {};
  private mounted: boolean = false;
  private fontPolicyGeneration: number = 0;
  private nativeItemsOpening: ReaderSegmentOpening | undefined = undefined;
  private nativeThemeItems: SegmentButtonV2Items | undefined = undefined;
  aboutToAppear(): void { this.mounted = true; this.refreshThemeFontPolicy(); }
  aboutToDisappear(): void {
    this.mounted = false; this.fontPolicyGeneration += 1;
    this.nativeItemsOpening = undefined; this.nativeThemeItems = undefined;
  }
  build() {
    ForEach([this.inputIdentity], (identity: string): void => {
      Stack({ alignContent: Alignment.Center }) {
        // Bottom bevel catchlight beneath the recessed groove.
        Row()
          .width('100%')
          .height(this.trackHeight)
          .translate({ y: 0.75 })
          .borderRadius(this.spec().radius)
          .backgroundColor(readerAppColor(this.appThemeScheme === 'night' ? 'TOK_LINE' : 'TOK_SURFACE_ELEVATED', this.appThemeScheme))
          .opacity(this.appThemeScheme === 'night' ? 1 : 0.85)
          .accessibilityLevel('no')
          .hitTestBehavior(HitTestMode.None);
        Row() {
          if (this.themeFontPolicyReady && this.themeInputIsValid()) {
            this.nativeThemeOptions(identity);
          } else {
            Text(`${this.options[this.selectedIndex] ?? ''}（暂不可用）`)
              .fontFamily(TYPE_APP_SEGMENT_LABEL.fontFamily).fontWeight(TYPE_APP_SEGMENT_LABEL.fontWeight)
              .fontSize(TYPE_APP_SEGMENT_LABEL.fontSizeFp).fontColor(readerAppColor(this.spec().inactiveText, this.appThemeScheme))
              .constraintSize({ minHeight: 44 }).layoutWeight(1).textAlign(TextAlign.Center)
              .accessibilityText(`${this.accessibilityLabel} ${this.options[this.selectedIndex] ?? ''}，暂不可用`);
          }
        }
        .width('100%')
        .padding(this.spec().padding)
        .clip(true)
        .backgroundColor(readerAppColor(this.spec().surface, this.appThemeScheme))
        .linearGradient({
          direction: GradientDirection.Bottom,
          colors: [
            [readerAppColor(this.appThemeScheme === 'night' ? 'app.segment.border' : 'app.chrome.raisedShadowAmbient', this.appThemeScheme), 0.0],
            [readerAppColor('app.surface.transparent', this.appThemeScheme), 0.36],
          ],
        })
        .border({ width: this.spec().borderWidth, color: readerAppColor(this.spec().border, this.appThemeScheme) })
        .borderRadius(this.spec().radius)
        .onAreaChange((_oldArea: Area, area: Area): void => {
          const measured = Number(area.height);
          if (Number.isFinite(measured) && measured > 0 && Math.abs(measured - this.trackHeight) > 0.5) {
            this.trackHeight = measured;
          }
        })
        .alignItems(VerticalAlign.Center);
      }
      .width(this.controlWidth < 0 ? '100%' : this.controlWidth > 0 ? this.controlWidth : this.spec().width)
      .responseRegion(readerUnionTouchRegion('100%', this.trackHeight))
      .accessibilityText(this.accessibilityLabel);
    }, (identity: string): string => identity);
  }
  private refreshThemeFontPolicy(): void {
    if (!this.mounted) return;
    const generation = ++this.fontPolicyGeneration;
    this.themeFontPolicyReady = false;
    this.syncNativeThemeItems();
    if (this.specId !== 'app-theme-segment' || this.readThemeFontPolicy()) return;
    // One lifecycle/configuration retry; no polling and no old-stage writes.
    try {
      this.getUIContext().postFrameCallback(new ReaderSegmentPolicyFrame((): void => {
        if (!this.mounted || generation !== this.fontPolicyGeneration || this.specId !== 'app-theme-segment') return;
        this.readThemeFontPolicy();
      }));
    } catch (_) { /* The accepted value stays readable while this context is unavailable. */ }
  }
  private readThemeFontPolicy(): boolean {
    try {
      const context = this.getUIContext();
      if (!context.isAvailable()) return false;
      const following = context.isFollowingSystemFontScale();
      const maximum = context.getMaxFontScale();
      if (typeof following !== 'boolean' || !Number.isFinite(maximum) || maximum < 1) return false;
      // Both paths use the same App policy. following=false does not mean max=1.
      this.themeMaxFontScale = maximum;
      this.themeFontPolicyReady = true;
      this.syncNativeThemeItems();
      return true;
    } catch (_) { return false; }
  }
  private themeOpening(identity: string): ReaderSegmentOpening { return { identity, ids: this.optionIds.slice() }; }
  private themeInputIsValid(): boolean {
    // Native V2 normalizes invalid indices to its first item. Never present
    // that as an accepted owner choice, and never construct an empty list.
    return this.optionIds.length > 0 && this.optionIds.length === this.options.length &&
      Number.isInteger(this.selectedIndex) && this.selectedIndex >= 0 && this.selectedIndex < this.optionIds.length &&
      this.optionIds.every((value: string, index: number): boolean => value.length > 0 && this.optionIds.indexOf(value) === index);
  }
  private themeItems(): SegmentButtonV2Items {
    if (this.nativeThemeItems === undefined) this.syncNativeThemeItems();
    return this.nativeThemeItems!;
  }
  private syncNativeThemeItems(): void {
    if (!this.mounted || this.specId !== 'app-theme-segment' || !this.themeInputIsValid()) {
      this.nativeItemsOpening = undefined; this.nativeThemeItems = undefined;
      return;
    }
    if (!this.themeFontPolicyReady) {
      this.nativeThemeItems?.forEach((item): void => { item.enabled = false; });
      return;
    }
    const opening = this.themeOpening(this.inputIdentity);
    if (this.nativeThemeItems === undefined || this.nativeItemsOpening === undefined ||
      this.nativeItemsOpening.identity !== opening.identity || this.nativeItemsOpening.ids.length !== opening.ids.length ||
      !this.nativeItemsOpening.ids.every((id: string, index: number): boolean => id === opening.ids[index])) {
      this.nativeItemsOpening = opening;
      this.nativeThemeItems = new SegmentButtonV2Items(opening.ids.map((id: string): SegmentButtonV2ItemOptions => ({
        text: this.optionLabel(id), accessibilityText: this.optionLabel(id),
        enabled: this.canAct(opening.identity, id), textModifier: this.themeTextModifier(id),
      })));
      return;
    }
    // V2 owns selection/focus. Keep its items stable and publish fresh styling
    // through each item's public @Trace fields instead of replacing the list.
    opening.ids.forEach((id: string, index: number): void => {
      const item = this.nativeThemeItems![index];
      item.text = this.optionLabel(id);
      item.accessibilityText = this.optionLabel(id);
      item.enabled = this.canAct(opening.identity, id);
      item.textModifier = this.themeTextModifier(id);
    });
  }
  private themeTextModifier(id: string): TextModifier {
    const style = this.isSelected(id) ? TYPE_APP_SEGMENT_LABEL_SELECTED : TYPE_APP_SEGMENT_LABEL;
    return new TextModifier().fontFamily(style.fontFamily)
        .fontSize(style.fontSizeFp).fontWeight(style.fontWeight)
        .minFontScale(0).maxFontScale(this.themeMaxFontScale)
        .maxLines(Math.max(1, this.optionLabel(id).length)).textOverflow({ overflow: TextOverflow.Clip })
        .width('100%').constraintSize({ minHeight: 30 }).padding(0).textAlign(TextAlign.Center)
        .backgroundColor(Color.Transparent).borderRadius(this.spec().itemRadius);
  }
  @Builder
  private nativeThemeOptions(identity: string) {
    ForEach([this.themeOpening(identity)], (opening: ReaderSegmentOpening): void => {
      CapsuleSegmentButtonV2({ items: this.themeItems(), selectedIndex: this.selectedIndex,
        onItemClicked: (index: number): void => {
          if (!this.themeFontPolicyReady || !this.themeInputIsValid() || this.specId !== 'app-theme-segment' ||
            opening.ids.length !== this.optionIds.length ||
            !opening.ids.every((id: string, i: number): boolean => this.optionIds[i] === id)) return;
          this.select(opening.identity, opening.ids[index] ?? '');
        },
        itemSpace: LengthMetrics.vp(0), itemMinHeight: LengthMetrics.vp(30),
        itemPadding: { top: LengthMetrics.vp(0), bottom: LengthMetrics.vp(0), start: LengthMetrics.vp(0), end: LengthMetrics.vp(0) },
        itemBorderRadius: LengthMetrics.vp(this.spec().itemRadius),
        itemFontColor: ColorMetrics.resourceColor(readerAppColor(this.spec().inactiveText, this.appThemeScheme)),
        itemSelectedFontColor: ColorMetrics.resourceColor(readerAppColor(this.spec().activeText, this.appThemeScheme)),
        buttonPadding: LengthMetrics.vp(0), buttonMinHeight: LengthMetrics.vp(30),
        itemSelectedBackgroundColor: ColorMetrics.resourceColor(readerAppColor(this.spec().selectedSurface, this.appThemeScheme)),
        itemShadow: { radius: 3.5 * this.density(),
          color: readerAppColor('app.shadow.cover', this.appThemeScheme),
          offsetX: 0, offsetY: 1.5 * this.density() },
        buttonBackgroundColor: ColorMetrics.resourceColor(readerAppColor('app.surface.transparent', this.appThemeScheme)), buttonBorderRadius: LengthMetrics.vp(this.spec().radius),
      }).width('100%');
    }, (opening: ReaderSegmentOpening): string => opening.identity + JSON.stringify(opening.ids));
  }
  private density(): number {
    const value = readerWindowMetrics().densityPixels;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  private spec(): ReaderSegmentSpec { return resolveReaderSegmentSpec(this.specId); }
  private optionLabel(id: string): string { return this.options[this.optionIds.indexOf(id)] ?? ''; }
  private isSelected(id: string): boolean { return this.optionIds.indexOf(id) === this.selectedIndex; }
  private canAct(identity: string, id: string): boolean {
    return this.mounted && identity.length > 0 && this.actionEnabled && !this.isBusy && identity === this.inputIdentity &&
      this.optionIds.length === this.options.length && this.optionIds.indexOf(id) >= 0 &&
      this.optionIds.every((value: string, index: number): boolean => value.length > 0 && this.optionIds.indexOf(value) === index);
  }
  private select(identity: string, id: string): void {
    if (!this.canAct(identity, id)) return;
    const nextIndex = this.optionIds.indexOf(id);
    if (nextIndex !== this.selectedIndex) triggerReaderTouchHaptic(this.reduceMotion);
    this.onSelect(nextIndex);
  }
}
