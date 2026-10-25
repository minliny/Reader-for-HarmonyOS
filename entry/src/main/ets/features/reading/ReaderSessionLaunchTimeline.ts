/**
 * Figma C/D/E/F launch timeline (capsule-figma-live.json, captured 2026-09-13).
 *
 * This sampler is pure TS and cannot import MotionSpec.ets across the ArkTS
 * boundary, so this file is the registered owner for every beat, phase
 * boundary and actor duration used by sampleReaderSessionLaunch(). MotionSpec
 * mirrors the public interval durations for UI-level consumers; start times and
 * per-actor overlap remain here.
 */
export const READER_SESSION_LAUNCH_DURATION_MS = 3500;
export const READER_SESSION_LAUNCH_SETTLED_MS = 2300;
export const READER_SESSION_LAUNCH_SOURCE_RELEASE_MS = 1400;
export const READER_SESSION_LAUNCH_CONTROL_RELEASE_MS = 700;
export const READER_SESSION_LAUNCH_BLUR_VP = 3.5;
export const READER_SESSION_LAUNCH_DOT_SIZE_VP = 24;
export const READER_SESSION_LAUNCH_PAUSE_GAP_VP = 4;

export const READER_SESSION_LAUNCH_FLIGHT_START_MS = 200;
export const READER_SESSION_LAUNCH_FLIGHT_MS = 1200;
export const READER_SESSION_LAUNCH_EXPAND_START_MS = 1700;
export const READER_SESSION_LAUNCH_EXPAND_MS = 600;
export const READER_SESSION_LAUNCH_HANDOFF_START_MS = 1100;
export const READER_SESSION_LAUNCH_HANDOFF_MS = 300;
export const READER_SESSION_LAUNCH_SHARP_START_MS = 700;
export const READER_SESSION_LAUNCH_SHARP_MS = 400;
export const READER_SESSION_LAUNCH_BLUR_IN_START_MS = 600;
export const READER_SESSION_LAUNCH_BLUR_IN_MS = 300;
export const READER_SESSION_LAUNCH_BLUR_OUT_START_MS = 900;
export const READER_SESSION_LAUNCH_BLUR_OUT_MS = 300;
export const READER_SESSION_LAUNCH_INFO_START_MS = 100;
export const READER_SESSION_LAUNCH_INFO_MS = 400;
export const READER_SESSION_LAUNCH_OUTGOING_START_MS = 100;
export const READER_SESSION_LAUNCH_OUTGOING_MS = 600;
export const READER_SESSION_LAUNCH_FOOTER_FIRST_START_MS = 100;
export const READER_SESSION_LAUNCH_FOOTER_FIRST_MS = 1300;
export const READER_SESSION_LAUNCH_FOOTER_SECOND_START_MS = 1700;
export const READER_SESSION_LAUNCH_FOOTER_SECOND_MS = 600;
