/** Monochrome action-sheet foregrounds. Resource recipes own their theme
 * paint, avoiding a runtime tint matrix. Multi-colour artwork and ordinary
 * navigation use other families. */
export type ReaderActionIconKind = 'check' | 'info' | 'folder' | 'trash' | 'pause' | 'play' |
  'close' | 'refresh' | 'download' | 'storage' | 'more' | 'source' | 'import';

export function readerActionIcon(kind: ReaderActionIconKind, scheme: string): Resource {
  const night = scheme === 'night';
  if (kind === 'check') return night ? $r('app.media.reader_action_check_theme_night') : $r('app.media.reader_action_check');
  if (kind === 'info') return night ? $r('app.media.reader_action_info_theme_night') : $r('app.media.reader_action_info');
  if (kind === 'folder') return night ? $r('app.media.reader_action_folder_theme_night') : $r('app.media.reader_action_folder');
  if (kind === 'trash') return night ? $r('app.media.reader_action_trash_theme_night') : $r('app.media.reader_action_trash');
  if (kind === 'pause') return night ? $r('app.media.reader_action_pause_theme_night') : $r('app.media.reader_action_pause');
  if (kind === 'play') return night ? $r('app.media.reader_action_play_theme_night') : $r('app.media.reader_action_play');
  if (kind === 'close') return night ? $r('app.media.reader_action_close_theme_night') : $r('app.media.reader_action_close');
  if (kind === 'refresh') return night ? $r('app.media.reader_action_refresh_theme_night') : $r('app.media.reader_action_refresh');
  if (kind === 'download') return night ? $r('app.media.reader_action_download_theme_night') : $r('app.media.reader_action_download');
  if (kind === 'storage') return night ? $r('app.media.reader_action_storage_theme_night') : $r('app.media.reader_action_storage');
  if (kind === 'more') return night ? $r('app.media.reader_action_more_theme_night') : $r('app.media.reader_action_more');
  if (kind === 'source') return night ? $r('app.media.reader_action_source_theme_night') : $r('app.media.reader_action_source');
  return night ? $r('app.media.reader_action_import_theme_night') : $r('app.media.reader_action_import');
}
