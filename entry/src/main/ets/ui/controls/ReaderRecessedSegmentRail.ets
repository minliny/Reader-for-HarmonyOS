import { motionAnimateParam } from '../foundation/MotionSpec';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../foundation/ReaderFontFamilies';
import { readerMotionReducedFadeParam } from '../foundation/ReaderMotionPolicy';
import { readerAppColor, type ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerPageAreaLength } from '../layout/ReaderPageShell';
import { ReaderPostLayoutFrame } from '../layout/ReaderPostLayoutFrame';
import { ReaderActionAccessibility } from './ReaderActionAccessibility';
import { triggerReaderTouchHaptic } from './ReaderTouchHaptic';

export interface ReaderRecessedSegmentOption {
  id: string;
  label: string;
  elementId?: string;
  accessibilityText?: string;
}

/**
 * Equal-width segmented control rendered inside a recessed groove track with an
 * elevated sliding thumb. Uses only semantic roles from ReaderThemeRegistry.
 */
@Component
export struct ReaderRecessedSegmentRail {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
  @StorageProp('readerReduceMotion') @Watch('syncThumb') private reduceMotion: boolean = false;
  @Prop @Watch('syncThumb') options: ReaderRecessedSegmentOption[] = [];
  @Prop @Watch('moveThumb') selectedId: string = '';
  @Prop accessibilityGroupLabel: string = '';
  @Prop trackHeight: number = 34;
  @Prop trackInset: number = 3;
  @Prop pillShape: boolean = true;
  @Prop activeColorRole: ReaderAppColorRole = 'TOK_PRIMARY_DARK';
  @Prop inactiveColorRole: ReaderAppColorRole = 'TOK_MUTED';
  @Prop actionEnabled: boolean = true;
  onSelect: (id: string) => void = (_id: string): void => {};

  @State private trackWidth: number = 0;
  @State private thumbLane: number = 0;
  @State private thumbOpacity: number = 1;
  private thumbGeneration: number = 0;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.syncThumb();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.thumbGeneration += 1;
  }

  private selectedIndex(): number {
    return this.options.findIndex((item: ReaderRecessedSegmentOption): boolean => item.id === this.selectedId);
  }

  private thumbHeight(): number {
    return Math.max(0, this.trackHeight - this.trackInset * 2);
  }

  private trackRadius(): number {
    return this.pillShape ? this.trackHeight / 2 : 11;
  }

  private thumbRadius(): number {
    return this.pillShape ? this.thumbHeight() / 2 : 8;
  }

  private slotWidth(): number {
    if (this.trackWidth <= 0 || this.options.length <= 0) return 0;
    return Math.max(0, (this.trackWidth - this.trackInset * 2) / this.options.length);
  }

  private density(): number {
    const observed = this.windowRevision < 0 ? 1 : readerWindowMetrics().densityPixels;
    return Number.isFinite(observed) && observed > 0 ? observed : 1;
  }

  private thumbShadow(): ShadowOptions {
    const density = this.density();
    return {
      radius: 3.5 * density,
      color: readerAppColor('app.shadow.cover', this.appThemeScheme),
      offsetX: 0,
      offsetY: 1.5 * density,
    };
  }

  private syncThumb(): void {
    this.thumbGeneration += 1;
    this.thumbLane = Math.max(0, this.selectedIndex());
    this.thumbOpacity = 1;
  }

  private moveThumb(): void {
    if (!this.mounted) return;
    const lane = this.selectedIndex();
    if (lane < 0 || lane === this.thumbLane) return;
    const context = this.getUIContext();
    if (!this.reduceMotion) {
      try {
        context.animateTo(motionAnimateParam('app.navigation.pill'), (): void => {
          this.thumbLane = lane;
        });
      } catch (_) {
        this.syncThumb();
      }
      return;
    }
    const generation = ++this.thumbGeneration;
    this.thumbOpacity = 0;
    this.thumbLane = lane;
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!this.mounted || generation !== this.thumbGeneration) return;
        try {
          context.animateTo(readerMotionReducedFadeParam(), (): void => {
            this.thumbOpacity = 1;
          });
        } catch (_) {
          this.thumbOpacity = 1;
        }
      }));
    } catch (_) {
      this.thumbOpacity = 1;
    }
  }

  private optionAccessibility(option: ReaderRecessedSegmentOption): string {
    if (option.accessibilityText && option.accessibilityText.length > 0) return option.accessibilityText;
    return this.accessibilityGroupLabel.length > 0 ? `${this.accessibilityGroupLabel}：${option.label}` : option.label;
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      // Bottom rim catchlight beneath the recessed groove.
      Row()
        .width('100%')
        .height(this.trackHeight)
        .borderRadius(this.trackRadius())
        .translate({ y: 0.75 })
        .backgroundColor(readerAppColor(this.appThemeScheme === 'night' ? 'TOK_LINE' : 'TOK_SURFACE_ELEVATED', this.appThemeScheme))
        .opacity(this.appThemeScheme === 'night' ? 1 : 0.85)
        .accessibilityLevel('no')
        .hitTestBehavior(HitTestMode.None);

      // Recessed groove track (darker than canvas/card with subtle top inner shade).
      Row()
        .width('100%')
        .height(this.trackHeight)
        .borderRadius(this.trackRadius())
        .clip(true)
        .backgroundColor(readerAppColor('app.segment.surface', this.appThemeScheme))
        .linearGradient({
          direction: GradientDirection.Bottom,
          colors: [
            [readerAppColor(this.appThemeScheme === 'night' ? 'app.segment.border' : 'app.chrome.raisedShadowAmbient', this.appThemeScheme), 0.0],
            [readerAppColor('app.surface.transparent', this.appThemeScheme), 0.36],
          ],
        })
        .border({ width: 0.75, color: readerAppColor('app.segment.border', this.appThemeScheme) })
        .accessibilityLevel('no')
        .hitTestBehavior(HitTestMode.None);

      // Elevated sliding thumb inside the groove.
      if (this.trackWidth > 0 && this.selectedIndex() >= 0) {
        Stack({ alignContent: Alignment.Start }) {
          Row()
            .width(this.slotWidth())
            .height(this.thumbHeight())
            .borderRadius(this.thumbRadius())
            .backgroundColor(readerAppColor('app.segment.selected', this.appThemeScheme))
            .border({ width: 0.5, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
            .shadow(this.thumbShadow())
            .translate({ x: this.thumbLane * this.slotWidth() })
            .opacity(this.thumbOpacity)
            .accessibilityLevel('no')
            .hitTestBehavior(HitTestMode.None);
        }
        .width('100%')
        .height(this.thumbHeight())
        .padding({ left: this.trackInset, right: this.trackInset })
        .accessibilityLevel('no')
        .hitTestBehavior(HitTestMode.None);
      }

      // Interactive equal-width segment buttons.
      Row() {
        ForEach(this.options, (option: ReaderRecessedSegmentOption): void => {
          Button({ type: ButtonType.Normal, stateEffect: false }) {
            Text(option.label)
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
              .fontWeight(option.id === this.selectedId ? 600 : 500)
              .fontSize(12)
              .maxLines(1)
              .minFontSize(10)
              .maxFontSize(12)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .textAlign(TextAlign.Center)
              .fontColor(readerAppColor(
                option.id === this.selectedId ? this.activeColorRole : this.inactiveColorRole,
                this.appThemeScheme));
          }
          .id(option.elementId ?? '')
          .layoutWeight(1)
          .height('100%')
          .padding({ left: 6, right: 6 })
          .borderRadius(this.thumbRadius())
          .backgroundColor(this.trackWidth <= 0 && option.id === this.selectedId
            ? readerAppColor('app.segment.selected', this.appThemeScheme)
            : Color.Transparent)
          .responseRegion({
            x: 0,
            y: -Math.max(0, (44 - this.thumbHeight()) / 2),
            width: '100%',
            height: Math.max(44, this.thumbHeight()),
          })
          .enabled(this.actionEnabled)
          .attributeModifier(new ReaderActionAccessibility(
            this.optionAccessibility(option),
            this.actionEnabled,
            option.id === this.selectedId,
            true,
            undefined,
            'nativeButton',
          ))
          .onClick((): void => {
            if (!this.actionEnabled) return;
            if (option.id !== this.selectedId) triggerReaderTouchHaptic(this.reduceMotion);
            this.onSelect(option.id);
          });
        }, (option: ReaderRecessedSegmentOption): string => `${option.id}:${option.label}`);
      }
      .width('100%')
      .height(this.trackHeight)
      .padding({ left: this.trackInset, right: this.trackInset });
    }
    .width('100%')
    .height(this.trackHeight)
    .opacity(this.actionEnabled ? 1 : 0.45)
    .hitTestBehavior(HitTestMode.Transparent)
    .onAreaChange((_oldArea: Area, area: Area): void => {
      const measured = readerPageAreaLength(area.width);
      if (Number.isFinite(measured) && measured > 0 && Math.abs(measured - this.trackWidth) > 0.5) {
        this.trackWidth = measured;
      }
    });
  }
}
