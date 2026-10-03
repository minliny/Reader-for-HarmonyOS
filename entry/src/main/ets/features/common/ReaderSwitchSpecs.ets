import type { ReaderAppColorRole } from './ReaderThemeRegistry';

/** Existing switch/short-enum geometry; no per-page appearance overrides. */
export type ReaderToggleSpecId = 'standard-toggle';
export type ReaderSegmentSpecId = 'app-theme-segment';
export interface ReaderToggleSpec {
  width: number;
  height: number;
  thumbSize: number;
  thumbRadius: number;
  thumbOffX: number;
  thumbOnX: number;
  thumbY: number;
  radius: number;
  pressedRadius: number;
  responseY: number;
  responseHeight: number;
  thumbColor: ReaderAppColorRole;
  checkedColor: ReaderAppColorRole;
  uncheckedColor: ReaderAppColorRole;
}
const STANDARD_TOGGLE: ReaderToggleSpec = {
  width: 44, height: 24, thumbSize: 20, thumbRadius: 10,
  thumbOffX: 2, thumbOnX: 22, thumbY: 2,
  radius: 999, pressedRadius: 12, responseY: -10, responseHeight: 44,
  thumbColor: 'app.ReaderToggle.build.backgroundColor.FFFFFFFF',
  checkedColor: 'TOK_PRIMARY_DARK', uncheckedColor: 'app.toggle.offTrack',
};
export interface ReaderSegmentSpec {
  width: number;
  height: number;
  itemHeight: number;
  padding: number;
  radius: number;
  itemRadius: number;
  borderWidth: number;
  activeText: ReaderAppColorRole;
  inactiveText: ReaderAppColorRole;
  selectedSurface: ReaderAppColorRole;
  selectedBorder: ReaderAppColorRole;
  surface: ReaderAppColorRole;
  border: ReaderAppColorRole;
}
const APP_THEME_SEGMENT: ReaderSegmentSpec = {
  width: 168, height: 36, itemHeight: 30, padding: 2, radius: 8, itemRadius: 6, borderWidth: 1,
  activeText: 'app.ReaderSegmentedControl.SEG_TEXT_ACTIVE',
  inactiveText: 'app.ReaderSegmentedControl.SEG_TEXT_INACTIVE',
  selectedSurface: 'app.ReaderSegmentedControl.SEG_SELECTED_BG',
  selectedBorder: 'app.ReaderSegmentedControl.SEG_SELECTED_BORDER',
  surface: 'app.ReaderSegmentedControl.SEG_BG', border: 'app.ReaderSegmentedControl.SEG_BORDER',
};
export function resolveReaderToggleSpec(id: ReaderToggleSpecId): ReaderToggleSpec {
  if (id !== 'standard-toggle') throw new Error('Unknown ReaderToggle specification');
  return STANDARD_TOGGLE;
}
export function resolveReaderSegmentSpec(id: ReaderSegmentSpecId): ReaderSegmentSpec {
  if (id !== 'app-theme-segment') throw new Error('Unknown ReaderSegmentedControl specification');
  return APP_THEME_SEGMENT;
}
