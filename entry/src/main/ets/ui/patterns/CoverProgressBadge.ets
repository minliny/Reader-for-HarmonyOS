import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../foundation/ReaderFontFamilies';
import { readerAppColor } from '../foundation/ReaderAppColors';
import { readerSurfaceElevation } from '../surfaces/ReaderSurfaceSpecs';
import {
  coverProgressArcCommands,
  coverProgressBadgeText,
  coverProgressIsComplete,
} from './CoverProgressRing';

export type CoverProgressBadgeVariant = 'pill' | 'inline';

/**
 * Compact reading-progress indicator rendered directly on bookshelf covers.
 * - 'pill': dark frosted capsule for image covers.
 * - 'inline': native paper-printed pine ring + percentage for default covers.
 */
@Component
export struct CoverProgressBadge {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerUiConfigurationRevision') private configurationRevision: number = 0;
  @Prop percent: number = 0;
  @Prop variant: CoverProgressBadgeVariant = 'pill';
  @Prop compactScale: number = 1;

  build() {
    Stack() {
      if (this.hasProgress()) {
        if (this.variant === 'pill') {
          Row() {
            this.badgeContent();
          }
          .alignItems(VerticalAlign.Center)
          .height(15.5 * this.resolvedScale())
          .padding({ left: 4.5 * this.resolvedScale(), right: 5.5 * this.resolvedScale() })
          .borderRadius(8 * this.resolvedScale())
          .backgroundColor(readerAppColor('app.cover.progressPillBg', this.appThemeScheme))
          .border({ width: 0.5, color: readerAppColor('app.cover.progressPillBorder', this.appThemeScheme) })
          .shadow(readerSurfaceElevation('control', this.appThemeScheme));
        } else {
          this.badgeContent();
        }
      }
    }
    .hitTestBehavior(HitTestMode.None)
    .accessibilityLevel('no-hide-descendants');
  }

  @Builder
  private badgeContent() {
    Row({ space: 3.5 * this.resolvedScale() }) {
      Stack({ alignContent: Alignment.Center }) {
        Row()
          .width(this.ringSizeVp())
          .height(this.ringSizeVp())
          .borderRadius(this.ringSizeVp() / 2)
          .border({ width: this.strokeWidthVp(), color: this.trackColor() });

        if (coverProgressIsComplete(this.percent)) {
          Row()
            .width(this.ringSizeVp())
            .height(this.ringSizeVp())
            .borderRadius(this.ringSizeVp() / 2)
            .border({ width: this.strokeWidthVp(), color: this.inkColor() });
        } else {
          Path()
            .width(this.ringSizeVp())
            .height(this.ringSizeVp())
            .commands(coverProgressArcCommands(this.percent, this.ringSizeVp(), this.strokeWidthVp(), this.vpToPx()))
            .fill(Color.Transparent)
            .stroke(this.inkColor())
            .strokeWidth(this.strokeWidthVp())
            .strokeLineCap(LineCapStyle.Round);
        }
      }
      .width(this.ringSizeVp())
      .height(this.ringSizeVp());

      Text(coverProgressBadgeText(this.percent))
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
        .fontWeight(600)
        .fontSize(`${8.2 * this.resolvedScale()}vp`)
        .lineHeight(`${9.5 * this.resolvedScale()}vp`)
        .minFontScale(1)
        .maxFontScale(1)
        .fontFeature('"tnum" 1')
        .fontColor(this.inkColor())
        .maxLines(1);
    }
    .alignItems(VerticalAlign.Center);
  }

  private hasProgress(): boolean {
    return coverProgressBadgeText(this.percent).length > 0;
  }

  private resolvedScale(): number {
    return Number.isFinite(this.compactScale) ? Math.max(0.9, Math.min(1.35, this.compactScale)) : 1;
  }

  private ringSizeVp(): number {
    return (this.variant === 'pill' ? 7.5 : 7.0) * this.resolvedScale();
  }

  private strokeWidthVp(): number {
    return 1.35 * this.resolvedScale();
  }

  private inkColor(): ResourceColor {
    return readerAppColor(
      this.variant === 'pill' ? 'app.cover.progressPillInk' : 'app.cover.defaultProgressInk',
      this.appThemeScheme,
    );
  }

  private trackColor(): ResourceColor {
    return readerAppColor(
      this.variant === 'pill' ? 'app.cover.progressPillTrack' : 'app.cover.defaultProgressTrack',
      this.appThemeScheme,
    );
  }

  private vpToPx(): number {
    if (this.configurationRevision < 0) return 1;
    try {
      const px = this.getUIContext().vp2px(1);
      return Number.isFinite(px) && px > 0 ? px : 1;
    } catch (_error) {
      return 1;
    }
  }
}
