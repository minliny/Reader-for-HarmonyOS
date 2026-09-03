export const SVG_PROVENANCE_SCHEMA_VERSION = 1;
export const SVG_FIGMA_FILE_KEY = 'klhs2jMM4MncaJFqZMfqEK';
export const SVG_FIGMA_ICON_PAGE_NODE_ID = '259:4';
export const SVG_TABLER_VERSION = '3.44.0';
export const SVG_TABLER_LICENSE = 'MIT';

function icon(file, component, color, semanticRole, options = {}) {
  return {
    file,
    semanticRole,
    originType: 'figma-component-derived',
    component: `Icon/${component}`,
    sourceFile: `Icon__${component.replaceAll('/', '__')}.svg`,
    color,
    rotation: options.rotation ?? 0,
  };
}

function exact(file, sourceNodeId, semanticRole) {
  return {
    file,
    semanticRole,
    originType: 'figma-node-export',
    sourceNodeId,
    sourceFile: `${file}.svg`,
  };
}

function paper(file, sourceNodeId, semanticRole, width, height, gradientTransform, stops) {
  return {
    file,
    semanticRole,
    originType: 'figma-css-primitive',
    sourceNodeId,
    width,
    height,
    gradientTransform,
    stops,
  };
}

const icons = [
  icon('book_detail_back', 'Back', '#1F1B17', 'book detail back'),
  icon('book_detail_directory', 'Directory', '#1F3528', 'book detail directory'),

  icon('bookshelf_compass', 'Discover', '#756F69', 'bookshelf discover inactive'),
  icon('bookshelf_compass_active', 'Discover', '#FFFAF4', 'bookshelf discover active navigation'),
  icon('bookshelf_compass_outline', 'Discover', '#756F69', 'bookshelf discover inactive navigation'),
  icon('bookshelf_empty_library', 'Bookshelf', '#1F1B17', 'empty bookshelf library'),
  icon('bookshelf_filter', 'Filter', '#756F69', 'bookshelf filter'),
  icon('bookshelf_grid', 'Grid', '#2D4A3E', 'bookshelf grid mode active'),
  icon('bookshelf_library', 'Bookshelf', '#FFFAF4', 'bookshelf library active'),
  icon('bookshelf_library_active', 'Bookshelf', '#FFFAF4', 'bookshelf library active navigation'),
  icon('bookshelf_library_outline', 'Bookshelf', '#756F69', 'bookshelf library inactive navigation'),
  icon('bookshelf_list', 'List', '#756F69', 'bookshelf list mode'),
  icon('bookshelf_more', 'More', '#1F1B17', 'bookshelf more'),
  icon('bookshelf_multiselect_trash', 'Trash', '#D7473E', 'bookshelf multiselect delete'),
  icon('bookshelf_rss', 'Rss', '#756F69', 'bookshelf rss inactive'),
  icon('bookshelf_rss_active', 'Rss', '#FFFAF4', 'bookshelf rss active navigation'),
  icon('bookshelf_rss_outline', 'Rss', '#756F69', 'bookshelf rss inactive navigation'),
  icon('bookshelf_search', 'Search', '#1F1B17', 'bookshelf search'),
  icon('bookshelf_settings', 'Settings', '#756F69', 'bookshelf settings inactive'),
  icon('bookshelf_settings_active', 'Settings', '#FFFAF4', 'bookshelf settings active navigation'),
  icon('bookshelf_settings_outline', 'Settings', '#756F69', 'bookshelf settings inactive navigation'),

  icon('directory_bookmark', 'Bookmark', '#5B5046', 'directory bookmark inactive'),
  icon('directory_bookmark_on', 'Bookmark', '#2F6373', 'directory bookmark active'),
  icon('directory_directory', 'Directory', '#332C25', 'directory list'),

  icon('rc_arrow_left', 'Back', '#1F1B17', 'reader control back'),
  icon('rc_autopage', 'ReaderAutoPage', '#332C25', 'reader quick auto page'),
  icon('rc_chevron_left', 'ChevronLeft', '#4D463F', 'reader previous chapter'),
  icon('rc_chevron_right', 'ChevronRight', '#4D463F', 'reader next chapter'),
  icon('rc_dots', 'More', '#1F1B17', 'reader control more'),
  icon('rc_headphones', 'ReaderModuleTts', '#2F6373', 'reader tts module inactive'),
  icon('rc_list', 'ReaderModuleDirectory', '#2F6373', 'reader directory module inactive'),
  icon('rc_palette', 'ReaderModuleAppearance', '#2F6373', 'reader appearance module inactive'),
  icon('reader_appearance_header', 'ReaderModuleAppearance', '#332C25', 'full appearance header'),
  icon('rc_replace', 'ReaderContentReplace', '#332C25', 'reader quick replace'),
  icon('rc_search', 'ReaderContentSearch', '#332C25', 'reader quick search'),
  icon('rc_settings', 'ReaderModuleSettings', '#2F6373', 'reader settings module inactive'),
  icon('rc_sun', 'Sun', '#2F6373', 'reader brightness'),
  icon('rc_switch_horizontal', 'SourceSwitch', '#1F1B17', 'reader source switch'),

  icon('reader_auto_full_chevron_left', 'ChevronLeft', '#2F6373', 'full auto page previous'),
  icon('reader_auto_full_chevron_right', 'ChevronRight', '#2F6373', 'full auto page next'),
  icon('reader_auto_full_clock', 'Clock', '#1F1B17', 'full auto page interval'),
  icon('reader_auto_full_header', 'ReaderAutoPage', '#332C25', 'full auto page header'),
  icon('reader_auto_full_play', 'Play', '#FFFAF4', 'full auto page play'),
  icon('reader_auto_full_stop', 'Stop', '#2F6373', 'full auto page stop'),
  icon('reader_auto_play', 'Play', '#FFFAF4', 'quick auto page play'),
  icon('reader_auto_stop', 'Stop', '#8C3D36', 'quick auto page stop'),
  icon('reader_appearance_nav_active', 'Filled/ReaderModuleAppearance', '#FFFAF4',
    'reader appearance module active'),
  icon('reader_chevron_down', 'Chevron', '#41484C', 'select chevron down', { rotation: 90 }),
  icon('reader_chevron_right', 'Chevron', '#756F69', 'disclosure chevron'),

  icon('reader_directory_back', 'Back', '#332C25', 'full directory back'),
  icon('reader_directory_bottom', 'Bottom', '#2F6373', 'full directory bottom'),
  icon('reader_directory_directory', 'Directory', '#332C25', 'full directory list'),
  icon('reader_directory_input_search', 'Search', '#5B5046', 'full directory input search'),
  icon('reader_directory_list_active', 'Filled/ReaderModuleDirectory', '#FFFAF4', 'reader directory module active'),
  icon('reader_directory_marker_bookmark', 'Bookmark', '#5B5046', 'reader directory bookmark marker'),
  icon('reader_directory_marker_bookmark_active', 'Bookmark', '#2F6373', 'reader directory bookmark marker active'),
  icon('reader_directory_marker_check', 'Check', '#2F6373', 'reader directory downloaded marker'),
  icon('reader_directory_marker_download', 'Download', '#5B5046', 'reader directory download marker'),
  icon('reader_directory_more', 'More', '#332C25', 'full directory more'),
  icon('reader_directory_search', 'Search', '#2F6373', 'full directory search'),
  icon('reader_directory_sort_ascending', 'SortAsc', '#2F6373', 'full directory ascending sort'),
  icon('reader_directory_sort_descending', 'SortDesc', '#2F6373', 'full directory descending sort'),
  icon('reader_directory_switch', 'SourceSwitch', '#332C25', 'full directory source switch'),
  icon('reader_directory_top', 'Top', '#2F6373', 'full directory top'),
  icon('reader_quick_back', 'Back', '#2F6373', 'reader quick panel back'),
  icon('reader_quick_search', 'Search', '#2F6373', 'reader quick panel search'),
  icon('reader_replace_close', 'Close', '#2F6373', 'reader replace close'),
  icon('reader_replace_manage', 'Settings', '#FFFAF4', 'reader replace manage'),
  icon('reader_replace_preview', 'Eye', '#332C25', 'reader replace preview'),
  icon('reader_session_pause', 'Pause', '#FFFAF4', 'reader session capsule pause'),
  icon('reader_tts_clock', 'Clock', '#2F6373', 'reader tts timer'),
  icon('reader_tts_headphones', 'Tts', '#2F6373', 'reader tts heading'),
  icon('reader_tts_nav_active', 'Filled/ReaderModuleTts', '#FFFAF4', 'reader tts module active'),
  icon('reader_tts_next', 'ChevronRight', '#332C25', 'reader tts next'),
  icon('reader_tts_play', 'Play', '#FFFAF4', 'reader tts play'),
  icon('reader_tts_previous', 'ChevronLeft', '#332C25', 'reader tts previous'),
  icon('reader_tts_rate', 'Motion', '#2F6373', 'reader tts speed'),
  icon('reader_tts_stop', 'Stop', '#FFFAF4', 'reader tts stop'),
  icon('reader_settings_nav_active', 'Filled/ReaderModuleSettings', '#FFFAF4',
    'reader settings module active'),

  icon('rss_add', 'Plus', '#2D4A3E', 'rss add subscription'),
  icon('rss_bookmark', 'Bookmark', '#3F372F', 'rss bookmark'),
  icon('rss_edit', 'Edit', '#3F372F', 'rss edit'),
  icon('rss_empty', 'Rss', '#1F1B17', 'rss empty state'),
  icon('rss_error', 'Warning', '#1F1B17', 'rss error state'),
  icon('rss_external', 'Expand', '#3F372F', 'rss external link'),
  icon('rss_filter', 'Filter', '#3F372F', 'rss filter'),
  icon('rss_filter_chevron', 'Chevron', '#3F372F', 'rss filter disclosure'),
  icon('rss_item_chevron', 'Chevron', '#1F1B17', 'rss item disclosure'),
  icon('rss_link', 'Link', '#3F372F', 'rss link'),
  icon('rss_manage', 'Settings', '#756F69', 'rss manage'),
  icon('rss_refresh', 'Refresh', '#1F3528', 'rss refresh'),
  icon('rss_source', 'Rss', '#1F3528', 'rss source'),
  icon('rss_view_all', 'List', '#1F3528', 'rss view all'),

  icon('search_back', 'Back', '#1F1B17', 'search back'),
  icon('search_mag', 'Search', '#756F69', 'search field search'),

  icon('settings_gen_animation', 'Motion', '#2D4A3E', 'settings animation'),
  icon('settings_gen_battery', 'Battery', '#2D4A3E', 'settings battery'),
  icon('settings_gen_cache', 'Storage', '#2D4A3E', 'settings cache'),
  icon('settings_gen_crash', 'Bug', '#2D4A3E', 'settings crash log'),
  icon('settings_gen_file', 'File', '#2D4A3E', 'settings file access'),
  icon('settings_gen_language', 'Globe', '#2D4A3E', 'settings language'),
  icon('settings_gen_motion', 'Motion', '#2D4A3E', 'settings reduced motion'),
  icon('settings_gen_notification', 'Bell', '#756F69', 'settings notification'),
  icon('settings_gen_refresh', 'Refresh', '#2D4A3E', 'settings refresh'),
  icon('settings_gen_startup', 'Home', '#2D4A3E', 'settings startup'),
  icon('settings_gen_tap_top', 'Top', '#2D4A3E', 'settings tap to top'),
  icon('settings_gen_theme', 'Palette', '#2D4A3E', 'settings theme'),
  icon('settings_gen_update', 'Download', '#2D4A3E', 'settings update'),
  icon('settings_row_about', 'Info', '#2D4A3E', 'settings about'),
  icon('settings_row_general', 'Settings', '#2D4A3E', 'settings general'),
  icon('settings_row_shelf_search', 'Search', '#2D4A3E', 'settings bookshelf and search'),
  icon('settings_row_source', 'Source', '#2D4A3E', 'settings source'),
  icon('settings_row_sync', 'Sync', '#2D4A3E', 'settings sync'),
  icon('settings_select_check', 'Check', '#2D4A3E', 'settings select check'),
  icon('source_add', 'Plus', '#FFFAF4', 'source management add'),
  icon('source_group_chevron', 'Chevron', '#5B5046', 'source group select chevron', { rotation: 90 }),
  icon('source_switch_close', 'Close', '#332C25', 'source switch close'),
];

const exactExports = [
  exact('import_cancel', '2657:797', 'local import cancel'),
  exact('import_choose_file', '2657:791', 'local import choose file'),
  exact('import_doc', '2657:825', 'local import document row'),
  exact('import_done', '2657:907', 'local import done'),
  exact('import_failure', '2657:901', 'local import failure'),
  exact('import_info', '2657:785', 'local import information'),
  exact('import_refresh', '2657:819', 'local import refresh'),
  exact('import_select_system', '2657:765', 'local import system picker'),
  exact('import_success', '2657:839', 'local import success'),
  exact('import_summary', '2657:809', 'local import result summary'),
  exact('importing_halo', '2899:59038', 'local import progress halo'),
  exact('importing_spinner_arc', '2899:59040', 'local import progress arc'),
  exact('importing_spinner_track', '2899:59039', 'local import progress track'),
  exact('search_clear', '2635:59016', 'search clear'),
  exact('search_empty', '2635:59036', 'search empty illustration'),
  exact('search_error', '2635:59126', 'search error illustration'),
  exact('reader_tts_online_engine', '930:948', 'reader online TTS service'),
  exact('reader_tts_speed_thumb', '750:1059', 'reader quick TTS speed thumb'),
  exact('reader_tts_system_engine', '930:936', 'reader system TTS service'),
];

const paperPrimitives = [
  paper('reading_paper_phone_highlight', '1023:18356', 'phone paper highlight', 388.89, 842.88,
    'matrix(0 -71.799 -71.799 0 194.44 151.72)', [
      ['rgba(255,255,255,0.7)', 0],
      ['rgba(191,191,191,0.525)', 0.105],
      ['rgba(128,128,128,0.35)', 0.21],
      ['rgba(64,64,64,0.175)', 0.315],
      ['rgba(0,0,0,0)', 0.42],
    ]),
  paper('reading_paper_phone_shade', '1023:18356', 'phone paper shade', 388.89, 842.88,
    'matrix(0 -59.601 -27.499 0 194.44 421.44)', [
      ['rgba(0,0,0,0)', 0.56],
      ['rgba(89,70,50,0.1)', 1],
    ]),
  paper('reading_paper_tablet_highlight', '1023:18372', 'tablet paper highlight', 758.89, 958.89,
    'matrix(0 -81.681 -140.11 0 379.44 172.6)', [
      ['rgba(255,255,255,0.7)', 0],
      ['rgba(191,191,191,0.525)', 0.105],
      ['rgba(128,128,128,0.35)', 0.21],
      ['rgba(64,64,64,0.175)', 0.315],
      ['rgba(0,0,0,0)', 0.42],
    ]),
  paper('reading_paper_tablet_shade', '1023:18372', 'tablet paper shade', 758.89, 958.89,
    'matrix(0 -67.804 -53.662 0 379.44 479.44)', [
      ['rgba(0,0,0,0)', 0.56],
      ['rgba(89,70,50,0.1)', 1],
    ]),
];

export const svgAssetRecipes = [...icons, ...exactExports, ...paperPrimitives]
  .sort((left, right) => left.file.localeCompare(right.file));
