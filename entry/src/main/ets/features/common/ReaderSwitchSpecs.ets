import type { ReaderAppColorRole } from './ReaderThemeRegistry';

/** Shared switch/short-enum geometry; appearance differences are finite specs. */
export type ReaderToggleSpecId = 'standard-toggle' | 'bookshelf-update-toggle';
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
  thumbColor: 'app.toggle.thumb',
  checkedColor: 'TOK_PRIMARY_DARK', uncheckedColor: 'app.toggle.offTrack',
};
// Preserves the bookshelf settings page's pre-migration green track while
// adopting the one shared switch geometry and interaction contract.
const BOOKSHELF_UPDATE_TOGGLE: ReaderToggleSpec = {
  width: 44, height: 24, thumbSize: 20, thumbRadius: 10,
  thumbOffX: 2, thumbOnX: 22, thumbY: 2,
  radius: 999, pressedRadius: 12, responseY: -10, responseHeight: 44,
  thumbColor: 'app.toggle.thumb',
  checkedColor: 'TOK_GREEN', uncheckedColor: 'app.toggle.offTrack',
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
  activeText: 'app.segment.activeText',
  inactiveText: 'app.segment.inactiveText',
  selectedSurface: 'app.segment.selected',
  selectedBorder: 'TOK_GREEN',
  surface: 'app.segment.surface', border: 'app.segment.border',
};
export function resolveReaderToggleSpec(id: ReaderToggleSpecId): ReaderToggleSpec {
  if (id === 'bookshelf-update-toggle') return BOOKSHELF_UPDATE_TOGGLE;
  if (id !== 'standard-toggle') throw new Error('Unknown ReaderToggle specification');
  return STANDARD_TOGGLE;
}
export function resolveReaderSegmentSpec(id: ReaderSegmentSpecId): ReaderSegmentSpec {
  if (id !== 'app-theme-segment') throw new Error('Unknown ReaderSegmentedControl specification');
  return APP_THEME_SEGMENT;
}
