/** Visual frame policy resolved by the feature that owns the route. The common
 * scaffold consumes only this object, so it never branches on page kinds. */
export type ReaderFrameAlignment = 'top' | 'topStart';
export type ReaderSafeAreaPolicy = 'none' | 'systemVertical' | 'systemCutoutAll';

export class ReaderHeaderFrameStyle {
  readonly transparent: boolean;
  readonly clip: boolean;
  readonly backgroundColor: string;
  readonly blurRadius: number;
  readonly blurColor: string;
  readonly bottomDividerColor: string;

  constructor(
    transparent: boolean,
    backgroundColor: string,
    blurRadius: number = 0,
    blurColor: string = '',
    bottomDividerColor: string = '',
  ) {
    this.transparent = transparent;
    this.clip = !transparent;
    this.backgroundColor = transparent ? '#00000000' : backgroundColor;
    this.blurRadius = transparent ? 0 : blurRadius;
    this.blurColor = transparent ? '' : blurColor;
    this.bottomDividerColor = transparent ? '' : bottomDividerColor;
  }
}

export class ReaderFooterFrameStyle {
  readonly solid: boolean;
  readonly clip: boolean;
  readonly backgroundColor: string;

  constructor(solid: boolean, backgroundColor: string) {
    this.solid = solid;
    this.clip = solid;
    this.backgroundColor = solid ? backgroundColor : '#00000000';
  }
}

export class ReaderFrameStyle {
  readonly backgroundColor: string;
  readonly clip: boolean;
  readonly alignment: ReaderFrameAlignment;
  readonly safeArea: ReaderSafeAreaPolicy;
  readonly header: ReaderHeaderFrameStyle;
  readonly footer: ReaderFooterFrameStyle;

  constructor(backgroundColor: string, clip: boolean, alignment: ReaderFrameAlignment,
    safeArea: ReaderSafeAreaPolicy, header: ReaderHeaderFrameStyle, footer: ReaderFooterFrameStyle) {
    this.backgroundColor = backgroundColor;
    this.clip = clip;
    this.alignment = alignment;
    this.safeArea = safeArea;
    this.header = header;
    this.footer = footer;
  }
}

export interface ReaderFrameStyleOptions {
  backgroundColor: string;
  clip?: boolean;
  alignment?: ReaderFrameAlignment;
  safeArea?: ReaderSafeAreaPolicy;
  headerBackground: string;
  headerTransparent?: boolean;
  headerBlurRadius?: number;
  headerBlurColor?: string;
  headerBottomDividerColor?: string;
  footerBackground: string;
  footerSolid?: boolean;
}

export function readerFrameStyle(options: ReaderFrameStyleOptions): ReaderFrameStyle {
  return new ReaderFrameStyle(options.backgroundColor, options.clip !== false,
    options.alignment ?? 'topStart', options.safeArea ?? 'none',
    new ReaderHeaderFrameStyle(
      options.headerTransparent === true,
      options.headerBackground,
      options.headerBlurRadius ?? 0,
      options.headerBlurColor ?? '',
      options.headerBottomDividerColor ?? '',
    ),
    new ReaderFooterFrameStyle(options.footerSolid === true, options.footerBackground));
}
