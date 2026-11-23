import { ReaderFooterFrameStyle, ReaderFrameStyle, ReaderHeaderFrameStyle } from './ReaderFrameStyle';

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
    instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor).zIndex(10);
  }
}

/** A fixed dock masks the complete footer lane, including horizontal gutters
 * and bottom safe area. Floating/flowing footers keep their bounded card paint. */
export class ReaderFooterFrameModifier implements AttributeModifier<CommonAttribute> {
  private readonly style: ReaderFooterFrameStyle;
  constructor(style: ReaderFooterFrameStyle) { this.style = style; }
  applyNormalAttribute(instance: CommonAttribute): void {
    instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor).zIndex(0);
  }
}
