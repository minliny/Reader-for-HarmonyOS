/**
 * Reader control composition metrics.
 *
 * Values live here only when the control owner coordinates more than one
 * child or when Phone/Tablet variants select the value. Component-local leaf
 * geometry stays beside its component; equal numbers alone never imply shared
 * ownership.
 */
export const READER_CONTROL_REGULAR_DOCK_HEIGHT = 330;
export const READER_CONTROL_CONTENT_SLOT_HEIGHT = 196;
export const READER_CONTROL_HOME_TOP_ROW_HEIGHT = 190;
export const READER_CONTROL_TOP_COMPONENT_GAP = 14;
export const READER_CONTROL_CONTENT_PADDING_LEFT = 12.44;
export const READER_CONTROL_CONTENT_PADDING_RIGHT = 13.56;

// Home owns the equality: quick-control column height = brightness rail height.
export const READER_CONTROL_BRIGHTNESS_RAIL_WIDTH = 38;
export const READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT = READER_CONTROL_HOME_TOP_ROW_HEIGHT;
export const READER_CONTROL_BRIGHTNESS_ICON_SIZE = 20;
export const READER_CONTROL_BRIGHTNESS_ICON_TOP = 13;
export const READER_CONTROL_BRIGHTNESS_TRACK_WIDTH = 8;
export const READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT = 92;
export const READER_CONTROL_BRIGHTNESS_TRACK_HIT_WIDTH = 24;
export const READER_CONTROL_BRIGHTNESS_AUTO_HIT_WIDTH = 24;
export const READER_CONTROL_BRIGHTNESS_CONTROL_GAP = 14;
export const READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE = 20;
export const READER_CONTROL_AUTO_PAGE_BRIGHTNESS_X = 312.44;
export const READER_CONTROL_AUTO_PAGE_BRIGHTNESS_Y = 28;

export const READER_CONTROL_HOME_SECTION_GAP = 6;
export const READER_CONTROL_HOME_QUICK_ACTION_HEIGHT = 75.438;
// The Figma export rounds the two child heights to three decimals: 190.001vp.
export const READER_CONTROL_HOME_FIGMA_ROUNDING_ADJUSTMENT = 0.001;
export const READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT =
  READER_CONTROL_HOME_TOP_ROW_HEIGHT - READER_CONTROL_HOME_QUICK_ACTION_HEIGHT -
  READER_CONTROL_HOME_SECTION_GAP + READER_CONTROL_HOME_FIGMA_ROUNDING_ADJUSTMENT;

// Full TTS currently has its own Figma anchor. It is intentionally not tied to
// the regular dock's Phone bottom gap even though both currently equal 19vp.
export const READER_CONTROL_FULL_TTS_BOTTOM_GAP = 19;

export const READER_CONTROL_PROGRESS_MIN = 0;
export const READER_CONTROL_PROGRESS_MAX = 100;
export const READER_CONTROL_PROGRESS_STEP = 0.1;
export const READER_CONTROL_BRIGHTNESS_MIN = 1;
export const READER_CONTROL_BRIGHTNESS_MAX = 100;
export const READER_CONTROL_BRIGHTNESS_STEP = 1;

/** Phone/Tablet values whose variation is owned by the control composition. */
export class ReaderControlGeometry {
  sheetH: number;
  sheetRadiusBottom: number;
  moduleNavH: number;
  moduleNavBottomGap: number;
  moduleNavRadiusTop: number;

  constructor(tablet: boolean) {
    if (tablet) {
      this.sheetH = 252;
      this.sheetRadiusBottom = 0;
      this.moduleNavH = 79;
      this.moduleNavBottomGap = 0;
      this.moduleNavRadiusTop = 0;
    } else {
      this.sheetH = 330;
      this.sheetRadiusBottom = 24;
      this.moduleNavH = 80;
      this.moduleNavBottomGap = 14;
      this.moduleNavRadiusTop = 12;
    }
  }
}
