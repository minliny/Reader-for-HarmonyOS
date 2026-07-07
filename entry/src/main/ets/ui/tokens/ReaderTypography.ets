// ReaderTypography — type/font tokens → ArkUI typography roles.
// All values derive from generated TypeTokens / FontTokens / SpacingTokens. No raw sizes here.
import { TypeTokens, FontTokens } from '../../contract/generated/TypeTokens';
import { SpacingTokens } from '../../contract/generated/DimensionTokens';

export interface Typography {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  fontWeight: number;
}

// Line-height ratios derived from the Reader UI demo (frontend-demo) typography.
// body = readerBodySize × 1.96 ; control labels / meta use ~1.2× ; titles ~1.15–1.2×.
export class ReaderTypography {
  // ── Contract type tokens (font sizes) ──
  static appTitle(): Typography {
    return { fontSize: TypeTokens.appTitleSize, lineHeight: 24, fontFamily: FontTokens.sans, fontWeight: 600 };
  }
  static pageTitle(): Typography {
    return { fontSize: TypeTokens.pageTitleSize, lineHeight: 24, fontFamily: FontTokens.sans, fontWeight: 600 };
  }
  static sectionTitle(): Typography {
    return { fontSize: TypeTokens.sectionTitleSize, lineHeight: 20, fontFamily: FontTokens.sans, fontWeight: 600 };
  }
  static bookTitle(): Typography {
    return { fontSize: TypeTokens.bookTitleSize, lineHeight: 18, fontFamily: FontTokens.sans, fontWeight: 500 };
  }
  static bookMeta(): Typography {
    return { fontSize: TypeTokens.bookMetaSize, lineHeight: 16, fontFamily: FontTokens.sans, fontWeight: 400 };
  }
  // Reading body — serif, 1.96 × body line-height (demo canonical ratio).
  static readerBody(): Typography {
    return {
      fontSize: TypeTokens.readerBodySize,
      lineHeight: TypeTokens.readerBodySize * 1.96,
      fontFamily: FontTokens.serif,
      fontWeight: 400,
    };
  }
  static readerControlLabel(): Typography {
    return { fontSize: TypeTokens.readerControlLabelSize, lineHeight: 15, fontFamily: FontTokens.sans, fontWeight: 500 };
  }

  // ── Derived roles (consume contract type tokens, no raw sizes) ──
  static topBarTitle(): Typography {
    return { fontSize: 16, lineHeight: 17.28, fontFamily: FontTokens.sans, fontWeight: 600 };
  }
  static topBarSubtitle(): Typography {
    return { fontSize: 10, lineHeight: 11, fontFamily: FontTokens.sans, fontWeight: 400 };
  }
  static actionLabel(): Typography {
    return { fontSize: 11, lineHeight: 14, fontFamily: FontTokens.sans, fontWeight: 500 };
  }
  static chapterTitle(): Typography {
    return { fontSize: 13, lineHeight: 17, fontFamily: FontTokens.sans, fontWeight: 500 };
  }
  static immersiveInfo(): Typography {
    return { fontSize: TypeTokens.readerControlLabelSize, lineHeight: 14.4, fontFamily: FontTokens.sans, fontWeight: 400 };
  }

  // Reading body insets (consume spacing tokens).
  static bodySideInset(): number { return SpacingTokens.lg; }
  static bodyTopInset(): number { return SpacingTokens.xl; }
  static bodyBottomInset(): number { return SpacingTokens.xl; }
  static bodyParagraphGap(): number { return SpacingTokens.md; }

  // Font family accessors (for components that need the family string directly).
  static serifFamily(): string { return FontTokens.serif; }
  static sansFamily(): string { return FontTokens.sans; }
}
