import { ReaderFooterFrameStyle, ReaderFrameStyle, ReaderHeaderFrameStyle } from './ReaderFrameStyle';

/** Keep normal sibling ordering when a descendant is hit. An unpainted,
 * unclipped carrier has a zero-size response region of its own. */
export function readerLayoutCarrierResponseRegion(ownsSurface: boolean = false): Rectangle {
  return ownsSurface ? { x: 0, y: 0, width: '100%', height: '100%' } : { x: 0, y: 0, width: 0, height: 0 };
}

export class ReaderPageFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly style: ReaderFrameStyle;
  constructor(style: ReaderFrameStyle) { this.style = style; }
  applyNormalAttribute(instance: CommonAttribute): void {
    instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor).zIndex(0);
  }
}

/** The feature owns the resolved header surface; the frame only applies it. */
export class ReaderHeaderFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly style: ReaderHeaderFrameStyle;
  constructor(style: ReaderHeaderFrameStyle) { this.style = style; }
  applyNormalAttribute(instance: CommonAttribute): void {
    const blurred = !this.style.transparent && this.style.blurRadius > 0 && this.style.blurColor.length > 0;
    instance.clip(this.style.clip)
      .backgroundEffect(blurred ? { radius: this.style.blurRadius, color: this.style.blurColor } : undefined)
      .backgroundColor(blurred ? Color.Transparent : this.style.backgroundColor)
      .border(this.style.bottomDividerColor.length > 0 ?
        { width: { bottom: 1 }, color: this.style.bottomDividerColor } : { width: 0, color: Color.Transparent })
      .zIndex(10);
  }
}

/** A fixed dock masks the complete footer lane, including horizontal gutters
 * and bottom safe area. Floating/flowing footers keep their bounded card paint. */
export class ReaderFooterFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly style: ReaderFooterFrameStyle;
  constructor(style: ReaderFooterFrameStyle) { this.style = style; }
  applyNormalAttribute(instance: CommonAttribute): void {
    instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor);
  }
}
