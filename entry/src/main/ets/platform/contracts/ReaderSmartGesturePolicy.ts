export type ReaderSmartGesture = 'tap' | 'slideForward' | 'backPress';
export type ReaderSmartTapAction = 'next' | 'toggleControls' | 'none';
export type ReaderSmartGestureAction = 'pass' | 'block' | 'pageNext' | 'scrollNext' | 'toggleControls' | 'back';

export interface ReaderSmartGestureSettings {
  enabled: boolean;
  tapAction: ReaderSmartTapAction;
}

export const DEFAULT_READER_SMART_GESTURES: ReaderSmartGestureSettings = { enabled: false, tapAction: 'next' };
export const READER_SMART_GESTURE_VIEWPORT_FRACTION: number = 0.85;

export function normalizeReaderSmartGestureSettings(enabled: boolean, tapAction: string): ReaderSmartGestureSettings {
  return { enabled, tapAction: tapAction === 'toggleControls' || tapAction === 'none' ? tapAction : 'next' };
}

export interface ReaderSmartGestureBoundary {
  foreground: boolean;
  controlsOpen: boolean;
  directoryOpen: boolean;
  sourceSwitchOpen: boolean;
  settingsOpen: boolean;
  dialogOpen: boolean;
  selectionActive: boolean;
  zoomed: boolean;
  chapterLoading: boolean;
  sourceSwitching: boolean;
  continuous: boolean;
}

export function readerSmartGestureAction(gesture: ReaderSmartGesture, settings: ReaderSmartGestureSettings,
  boundary: ReaderSmartGestureBoundary): ReaderSmartGestureAction {
  if (!settings.enabled) return 'pass';
  if (!boundary.foreground || boundary.controlsOpen || boundary.directoryOpen || boundary.sourceSwitchOpen ||
    boundary.settingsOpen || boundary.dialogOpen || boundary.selectionActive || boundary.zoomed ||
    boundary.chapterLoading || boundary.sourceSwitching) return 'block';
  if (gesture === 'backPress') return 'back';
  if (gesture === 'tap') {
    if (settings.tapAction === 'none') return 'block';
    if (settings.tapAction === 'toggleControls') return 'toggleControls';
  }
  return boundary.continuous ? 'scrollNext' : 'pageNext';
}
