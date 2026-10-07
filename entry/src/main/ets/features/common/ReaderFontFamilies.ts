// Pure ArkTS/TS family identifiers. Both .ets presentation files and .ts
// pagination/render helpers may import this module without crossing the
// compiler's forbidden TS -> ETS boundary.
export const READER_FONT_INTER = 'ReaderInter';
export const READER_FONT_NOTO_SERIF_SC_BOLD = 'ReaderNotoSerifSCBold';
export const READER_FONT_NOTO_SERIF_SC_REGULAR = 'ReaderNotoSerifSCRegular';
export const READER_FONT_NOTO_SANS_SC = 'ReaderNotoSansSC';
// Static UI faces are used for compact navigation chrome where ArkUI does not
// interpolate variable-font weights reliably on every device.
export const READER_FONT_NOTO_SANS_SC_UI_BOLD = 'ReaderNotoSansSCUIBold';
export const READER_FONT_NOTO_SANS_SC_UI_REGULAR = 'ReaderNotoSansSCUIRegular';
export const READER_FONT_NOTO_SANS_SC_UI_MEDIUM = 'ReaderNotoSansSCUIMedium';
// Manga demo uses exact 550 / 600 / 900 outlines, loaded on demand as static
// faces. Requests against the custom variable face failed the VM visual check.
export const READER_FONT_NOTO_SANS_SC_UI_550 = 'ReaderMangaSans550';
export const READER_FONT_NOTO_SANS_SC_UI_600 = 'ReaderMangaSans600';
// Header 650 keeps the complete source cmap for arbitrary localized titles.
export const READER_FONT_NOTO_SANS_SC_UI_650 = 'ReaderMangaSans650';
export const READER_FONT_NOTO_SANS_SC_UI_900 = 'ReaderMangaSans900';
export const READER_FONT_LXGW_WENKAI_LITE = 'ReaderLXGWWenKaiLite';
export const READER_FONT_LXGW_WENKAI_GB_LITE = 'ReaderLXGWWenKaiGBLite';
export const READER_FONT_ZHUQUE_FANGSONG = 'ReaderZhuqueFangsong';
export const READER_FONT_SARASA_MONO_SC = 'ReaderSarasaMonoSC';
// Figma renders the Source Han Serif slot with Noto Serif SC. Both projects
// share the same CJK glyph source, so keep one bundled physical font instead
// of adding a second 14 MB copy solely for a different product label.
export const READER_FONT_SOURCE_HAN_SERIF = READER_FONT_NOTO_SERIF_SC_REGULAR;
export const READER_FONT_HARMONYOS_SANS = 'HarmonyOS Sans';
