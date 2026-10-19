import { readFileSync } from 'node:fs';
import { downloadVisualColor } from '../entry/src/main/ets/features/common/SharedDownloadVisualSpec.ts';
import { mangaDirectoryColor } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
export const SVG_PROVENANCE_SCHEMA_VERSION = 1;
export const SVG_FIGMA_FILE_KEY = 'klhs2jMM4MncaJFqZMfqEK';
export const SVG_FIGMA_ICON_PAGE_NODE_ID = '259:4';
export const SVG_TABLER_VERSION = '3.44.0';
export const SVG_TABLER_LICENSE = 'MIT';

export const SVG_MESSAGE_LUCIDE_PACKAGE = Object.freeze({
  name: 'lucide-static', version: '0.468.0', license: 'ISC',
  url: 'https://registry.npmjs.org/lucide-static/-/lucide-static-0.468.0.tgz',
  receiptSha256: 'dee2a4b335affa1fc2844658f78a039b3d93d12981762d8496f1a5271c7031c1',
  licenseSha256: '1e7290b35280a048667bbf0ebabac1c7fd52a75300e8b2946ac165715997f2bc',
  sourceSha256: '75c7294888945f16934a3e1d93b7cbcdb12241c4cfa2e851fece42a1c8e6c110',
});
export const svgMessageLucideRecipes = [
  { file: 'reader_image_unavailable', color: '#817A70' },
  { file: 'reader_image_unavailable_theme_night', color: '#AFA79A' },
].map(value => ({ ...value, semanticRole: 'approved C17 unavailable image icon',
  originType: 'lucide-static-svg-derived', component: 'ImageOff', sourceFile: 'image-off.svg' }));

export const SVG_DOWNLOAD_LUCIDE_PACKAGE = Object.freeze({
  name: 'lucide', version: '1.8.0', license: 'ISC',
  url: 'https://www.npmjs.com/package/lucide/v/1.8.0',
  licenseSha256: 'b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57',
  receiptSha256: 'da2d58dfbf08c2e8ac12638508611020061e209a152b76af48b5a83eb649cc35',
});
const downloadLucideReceipt = JSON.parse(readFileSync(new URL('../docs/ui-design/svg-provenance/download-lucide/SOURCE.json', import.meta.url), 'utf8'));
export const SVG_DOWNLOAD_LUCIDE_SOURCES = Object.freeze(downloadLucideReceipt.icons);
export const svgDownloadLucideRecipes = [
  ['back','ArrowLeft','ink'],['search','Search','muted'],
  ['filter','SlidersHorizontal','ink'],['storage','Settings2','ink'],['more','Ellipsis','ink'],
  ['close','X','ink'],['download','Download','muted'],['pause','Pause','green'],['play','Play','green'],
  ['retry','RotateCw','danger'],['check','CircleCheck','green'],['chevron','ChevronRight','muted'],
  ['empty','LibraryBig','muted'],
  ['trash','Trash2','greenInk'],['trash_disabled','Trash2','muted'],
  ['sort_asc','ChartNoAxesColumnIncreasing','ink'],['sort_desc','ChartNoAxesColumnIncreasing','ink'],
].flatMap(([name,component,role]) => ['day','night'].map(scheme => ({
  file: 'download_visual_' + name + (scheme === 'night' ? '_theme_night' : ''),
  semanticRole: 'approved shared download demo ' + name + ' ' + scheme,
  originType: 'lucide-component-derived', component,
  ...SVG_DOWNLOAD_LUCIDE_SOURCES[component],
  color: '#' + downloadVisualColor(role, scheme).slice(3),
  rotation: name.startsWith('sort_') ? 90 : 0,
  flipY: name === 'sort_desc',
})));

// Only these eleven components from the approved demo's pinned Radix dependency
// may use this origin. Canonical SVG and license hashes are immutable inputs.
export const SVG_RADIX_PACKAGE = Object.freeze({
  name: '@radix-ui/react-icons', version: '1.3.2',
  url: 'https://registry.npmjs.org/@radix-ui/react-icons/-/react-icons-1.3.2.tgz',
  integrity: 'sha512-fyQIhGDhzfc9pK2kH6Pl9c4BDJGfMkPqkyIgYDthyNYoNg3wVhoJMMh19WS4Up/1KMPFVpNsT2q3WmXn2N1m6g==',
  gitHead: 'bde33b13aa5848555f5512ac12155930fb4beb7d', license: 'MIT',
  licenseSha256: '0e80a2d229d2fd4fc7e8636142ec5d0ff0bc031f14c15b682e2ac01dfd5b5138',
  receiptSha256: 'c52f64fde29ac1478bd8e803db93d35437cda48301c80071d54591e0cef38e8e',
});
export const SVG_RADIX_COMPONENT_SOURCES = Object.freeze({
  ViewVerticalIcon: { sourceFile: 'ViewVerticalIcon.svg', sourceSha256: '8e684a111955015001600344eba570030dadac0211173dcf4fd474776c1c532a' },
  ViewHorizontalIcon: { sourceFile: 'ViewHorizontalIcon.svg', sourceSha256: 'af807e15011aeec5f3d54ea141b21d475762892eb4d9c944a3a4b105a4a21712' },
  SunIcon: { sourceFile: 'SunIcon.svg', sourceSha256: 'ca6f9d89aca760da8f97d3130a6f9afaf851b78e161869858e71aae357f65fbb' },
  MoonIcon: { sourceFile: 'MoonIcon.svg', sourceSha256: '8f70f86ade7adcbc7eebc8248a9503c0c9982b88f3267363704497b8c6704b23' },
  Cross2Icon: { sourceFile: 'Cross2Icon.svg', sourceSha256: '1186d1a7398e930f758dfbe2e3c79b6dc80adc82389050a147058cf7b8cfc445' },
  MagnifyingGlassIcon: { sourceFile: 'MagnifyingGlassIcon.svg', sourceSha256: '0b0ebc14abcd66b557be65cffa893381db6bfcfa382fb7fbb0006aa58e678500' },
  ReaderIcon: { sourceFile: 'ReaderIcon.svg', sourceSha256: 'f22fe12200f68f674c506f7557158e2df27c80af3e1304c3bf92e5e15621b613' },
  CheckIcon: { sourceFile: 'CheckIcon.svg', sourceSha256: 'f63f6aa332d594e56bc30c76be129e1bbdd3caa53d62bffc74bb023cbead0daf' },
  ChevronRightIcon: { sourceFile: 'ChevronRightIcon.svg', sourceSha256: '338fddda60c9c0fd042b1162be06373fe87d0f7414686e258a67a2c30dd9a34b' },
  ChevronDownIcon: { sourceFile: 'ChevronDownIcon.svg', sourceSha256: '5a3b143885ce029882dc32d18350635b498d1b201bef641442902be27072a351' },
  ArrowLeftIcon: { sourceFile: 'ArrowLeftIcon.svg', sourceSha256: '9b281d3aa0c46ddd0f23a0bcd760e396ff9dbd1e8707fc62f0c0f56690b31018', canonicalColor: 'currentColor' },
});

function radixSheetIcon(suffix, component, color, semanticRole) {
  return { file: `manga_sheet_${suffix}`, semanticRole, originType: 'radix-component-derived',
    component, ...SVG_RADIX_COMPONENT_SOURCES[component], color };
}

export const svgRadixSheetRecipes = [
  ...[['vertical', 'ViewVerticalIcon'], ['horizontal', 'ViewHorizontalIcon'], ['sun', 'SunIcon'], ['moon', 'MoonIcon']]
    .flatMap(([name, component]) => [
      radixSheetIcon(name, component, '#756F69', `manga sheet ${name} inactive`),
      radixSheetIcon(`${name}_theme_night`, component, '#ABA99F', `manga sheet ${name} night inactive`),
      radixSheetIcon(`${name}_active`, component, '#FFFAF4', `manga sheet ${name} selected`),
    ]),
  ...[['close', 'Cross2Icon'], ['search', 'MagnifyingGlassIcon']].flatMap(([name, component]) => [
    radixSheetIcon(name, component, '#756F69', `manga sheet ${name}`),
    radixSheetIcon(`${name}_theme_night`, component, '#ABA99F', `manga sheet ${name} night`),
  ]),
  ...[['locate', 'ReaderIcon'], ['check', 'CheckIcon']].flatMap(([name, component]) => [
    radixSheetIcon(name, component, '#425D45', `manga sheet ${name} accent`),
    radixSheetIcon(`${name}_theme_night`, component, '#B9CEB1', `manga sheet ${name} night accent`),
  ]),
  radixSheetIcon('chevron_right', 'ChevronRightIcon', '#A39C90', 'manga sheet chapter disclosure'),
  radixSheetIcon('chevron_right_theme_night', 'ChevronRightIcon', '#767D71', 'manga sheet chapter disclosure night'),
  radixSheetIcon('chevron_down', 'ChevronDownIcon', '#756F69', 'manga sheet volume group disclosure'),
  radixSheetIcon('chevron_down_theme_night', 'ChevronDownIcon', '#ABA99F', 'manga sheet volume group disclosure night'),
  ...[['back', 'ArrowLeftIcon', 'ink'], ['previous', 'ArrowLeftIcon', 'accent'], ['clear', 'Cross2Icon', 'ink'],
    ['chevron_right_accent', 'ChevronRightIcon', 'accent'], ['chevron_down_accent', 'ChevronDownIcon', 'accent']]
    .flatMap(([slot, component, role]) => ['day', 'night'].map(scheme => ({
      file: `manga_directory_${slot}${scheme === 'night' ? '_theme_night' : ''}`,
      semanticRole: `manga directory ${slot} ${scheme}`, originType: 'radix-component-derived',
      component, ...SVG_RADIX_COMPONENT_SOURCES[component], color: mangaDirectoryColor(role, scheme),
    }))),
];

function icon(file, component, color, semanticRole, options = {}) {
  return {
    file,
    semanticRole,
    originType: 'figma-component-derived',
    component: `Icon/${component}`,
    sourceFile: `Icon__${component.replaceAll('/', '__')}.svg`,
    color,
    rotation: options.rotation ?? 0,
    // HarmonyOS svg parsing does not inherit the root fill="none", so closed
    // stroke paths render as filled silhouettes once Image.fillColor applies.
    fillNone: options.fillNone ?? false,
    fillInterior: options.fillInterior ?? false,
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

function adaptedPopover(file, sourceNodeId, semanticRole, sourceFile) {
  return {
    file,
    semanticRole,
    originType: 'figma-node-adapted',
    sourceNodeId,
    sourceFile,
    bodyExtension: 50,
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

  icon('bookshelf_compass_active', 'Discover', '#FFFAF4', 'bookshelf discover active navigation'),
  icon('bookshelf_compass_outline', 'Discover', '#756F69', 'bookshelf discover inactive navigation'),
  icon('bookshelf_filter', 'Filter', '#756F69', 'bookshelf filter', { fillNone: true }),
  icon('bookshelf_filter_active', 'Filter', '#2D4A3E', 'bookshelf filter active', { fillNone: true }),
  icon('bookshelf_grid', 'Grid', '#2D4A3E', 'bookshelf grid mode active', { fillNone: true }),
  icon('bookshelf_grid_outline', 'Grid', '#756F69', 'bookshelf grid mode inactive', { fillNone: true }),
  icon('bookshelf_library_active', 'Bookshelf', '#FFFAF4', 'bookshelf library active navigation'),
  icon('bookshelf_library_outline', 'Bookshelf', '#756F69', 'bookshelf library inactive navigation'),
  icon('bookshelf_list', 'List', '#756F69', 'bookshelf list mode', { fillNone: true }),
  icon('bookshelf_list_active', 'List', '#2D4A3E', 'bookshelf list mode active', { fillNone: true }),
  icon('bookshelf_more_download', 'Download', '#1F1B17', 'bookshelf more ordinary download action'),
  icon('bookshelf_more_update', 'Refresh', '#1F1B17', 'bookshelf more ordinary update action'),
  icon('bookshelf_multiselect_trash', 'Trash', '#D7473E', 'bookshelf multiselect delete'),
  ...['day', 'night'].map(scheme => icon(
    `reader_danger_trash${scheme === 'night' ? '_theme_night' : ''}`, 'Trash',
    '#' + downloadVisualColor('danger', scheme).slice(3),
    `bookshelf multiselect destructive action ${scheme}`)),
  ...[['ascending', 'SortAsc'], ['descending', 'SortDesc']].flatMap(([name, component]) =>
    ['day', 'night'].map(scheme => icon(
      `manga_directory_sort_${name}${scheme === 'night' ? '_theme_night' : ''}`, component,
      mangaDirectoryColor('accent', scheme), `manga directory ${name} sort ${scheme}`))),
  icon('bookshelf_rss_active', 'Rss', '#FFFAF4', 'bookshelf rss active navigation'),
  icon('bookshelf_rss_outline', 'Rss', '#756F69', 'bookshelf rss inactive navigation'),
  icon('bookshelf_search', 'Search', '#1F1B17', 'bookshelf search', { fillNone: true }),
  icon('bookshelf_settings', 'Settings', '#756F69', 'bookshelf settings inactive', { fillNone: true }),
  icon('bookshelf_settings_active', 'Settings', '#FFFAF4', 'bookshelf settings active navigation'),
  icon('bookshelf_settings_outline', 'Settings', '#756F69', 'bookshelf settings inactive navigation'),

  icon('discover_apply', 'Check', '#FFFFFF', 'discover apply filters', { fillNone: true }),
  icon('discover_filter', 'Filter', '#3F372F', 'discover filter', { fillNone: true }),
  icon('discover_filter_chevron', 'ChevronRight', '#3F372F', 'discover filter disclosure', { fillNone: true }),
  icon('discover_refresh', 'Refresh', '#1F1B17', 'discover refresh', { fillNone: true }),
  icon('discover_source_chevron', 'ChevronRight', '#1F1B17', 'discover source disclosure', { fillNone: true }),
  icon('discover_source_stack', 'SourceStack', '#1F3528', 'discover current source', { fillNone: true }),

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
  icon('reader_auto_full_play', 'Play', '#FFFAF4', 'full auto page play'),
  icon('reader_auto_full_stop', 'Stop', '#2F6373', 'full auto page stop'),
  icon('reader_auto_stop', 'Stop', '#8C3D36', 'quick auto page stop'),
  icon('reader_appearance_nav_active', 'ReaderModuleAppearance', '#FFFAF4',
    'reader appearance module active outline', { fillNone: true }),
  icon('reader_chevron_down', 'Chevron', '#41484C', 'select chevron down', { rotation: 90 }),
  icon('reader_chevron_down_primary', 'Chevron', '#2F6373', 'disabled select chevron down',
    { rotation: 90, fillNone: true }),
  icon('reader_chevron_right', 'Chevron', '#756F69', 'disclosure chevron'),

  icon('reader_directory_back', 'Back', '#332C25', 'full directory back'),
  icon('reader_directory_bottom', 'Bottom', '#2F6373', 'full directory bottom'),
  icon('reader_directory_directory', 'Directory', '#332C25', 'full directory list'),
  icon('reader_directory_input_search', 'Search', '#5B5046', 'full directory input search'),
  icon('reader_directory_list_active', 'ReaderModuleDirectory', '#FFFAF4',
    'reader directory module active outline', { fillNone: true }),
  icon('reader_directory_marker_bookmark', 'Bookmark', '#5B5046', 'reader directory bookmark marker'),
  icon('reader_page_bookmark_filled', 'Bookmark', '#2F6373', 'PH59 page bookmark armed and confirmed fill; original Figma/Tabler contour', { fillInterior: true }),
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
  icon('reader_replace_close', 'Close', '#2F6373', 'reader replace close'),
  icon('reader_replace_manage', 'Settings', '#FFFAF4', 'reader replace manage'),
  icon('reader_replace_preview', 'Eye', '#332C25', 'reader replace preview'),
  icon('reader_settings_header', 'ReaderModuleSettings', '#332C25', 'full settings header', { fillNone: true }),
  icon('reader_tts_clock', 'Clock', '#2F6373', 'reader tts timer'),
  icon('reader_tts_timer_cycle', 'Refresh', '#2F6373', 'reader tts timer preset cycle'),
  icon('reader_tts_headphones', 'Tts', '#2F6373', 'reader tts heading'),
  icon('reader_tts_header', 'Tts', '#332C25', 'full tts header', { fillNone: true }),
  icon('reader_tts_nav_active', 'ReaderModuleTts', '#FFFAF4',
    'reader tts module active outline', { fillNone: true }),
  icon('reader_tts_rate', 'Motion', '#2F6373', 'reader tts speed'),
  icon('reader_tts_stop', 'Stop', '#FFFAF4', 'reader tts stop'),
  icon('reader_settings_nav_active', 'ReaderModuleSettings', '#FFFAF4',
    'reader settings module active outline', { fillNone: true }),

  icon('rss_add', 'Plus', '#2D4A3E', 'rss add subscription'),
  icon('rss_bookmark', 'Bookmark', '#756F69', 'rss bookmark inactive', { fillNone: true }),
  icon('rss_bookmark_active', 'Bookmark', '#1F3528', 'rss bookmark active', { fillNone: true }),
  icon('rss_edit', 'Edit', '#3F372F', 'rss edit'),
  icon('rss_empty', 'Rss', '#1F1B17', 'rss empty state'),
  icon('rss_error', 'Warning', '#1F1B17', 'rss error state'),
  icon('rss_external', 'Expand', '#3F372F', 'rss external link'),
  icon('rss_filter', 'Filter', '#3F372F', 'rss filter'),
  icon('rss_filter_chevron', 'Chevron', '#3F372F', 'rss filter disclosure'),
  icon('rss_item_chevron', 'Chevron', '#1F1B17', 'rss item disclosure'),
  icon('rss_link', 'Link', '#3F372F', 'rss link'),
  icon('rss_manage', 'Settings', '#756F69', 'rss manage'),
  icon('rss_manage_delete', 'Trash', '#AB2E28', 'rss management delete', { fillNone: true }),
  icon('rss_manage_edit', 'Edit', '#1F1B17', 'rss management edit', { fillNone: true }),
  icon('rss_manage_view_all', 'List', '#1F1B17', 'rss management view all', { fillNone: true }),
  icon('rss_refresh', 'Refresh', '#1F3528', 'rss refresh'),
  icon('rss_source', 'Rss', '#1F3528', 'rss source'),
  icon('rss_view_all', 'List', '#1F3528', 'rss view all'),

  icon('search_mag', 'Search', '#756F69', 'search field search'),

  icon('settings_gen_animation', 'Motion', '#2D4A3E', 'settings animation'),
  icon('settings_gen_battery', 'Battery', '#2D4A3E', 'settings battery'),
  icon('settings_gen_cache', 'Storage', '#2D4A3E', 'settings cache'),
  icon('settings_gen_crash', 'Bug', '#2D4A3E', 'settings crash log'),
  icon('settings_gen_file', 'File', '#2D4A3E', 'settings file access'),
  icon('settings_gen_language', 'Globe', '#2D4A3E', 'settings language'),
  icon('settings_gen_notification', 'Bell', '#756F69', 'settings notification'),
  icon('settings_gen_refresh', 'Refresh', '#2D4A3E', 'settings refresh'),
  icon('settings_reset_defaults', 'Refresh', '#D62222', 'settings destructive restore defaults'),
  icon('settings_gen_startup', 'Home', '#2D4A3E', 'settings startup'),
  icon('settings_gen_tap_top', 'Top', '#2D4A3E', 'settings tap to top'),
  icon('settings_gen_theme', 'Palette', '#2D4A3E', 'settings theme'),
  icon('settings_row_about', 'Info', '#2D4A3E', 'settings about'),
  icon('settings_row_download', 'Download', '#2D4A3E', 'settings download navigation'),
  icon('settings_row_general', 'Settings', '#2D4A3E', 'settings general'),
  icon('settings_row_shelf_search', 'Search', '#2D4A3E', 'settings bookshelf and search'),
  icon('settings_row_source', 'Source', '#2D4A3E', 'settings source'),
  icon('settings_row_sync', 'Sync', '#2D4A3E', 'settings sync'),
  icon('settings_select_check', 'Check', '#2D4A3E', 'settings select check'),
  icon('source_add', 'Plus', '#FFFAF4', 'source management add'),
  icon('source_group_folder', 'Folder', '#2D4A3E', 'source management group', { fillNone: true }),
  icon('source_group_chevron', 'Chevron', '#5B5046', 'source group select chevron', { rotation: 90 }),
  icon('source_switch_close', 'Close', '#332C25', 'source switch close'),

  icon('sync_account', 'People', '#2D4A3E', 'webdav account', { fillNone: true }),
  icon('sync_backup_password', 'Lock', '#2D4A3E', 'webdav backup encryption password', { fillNone: true }),
  icon('sync_password', 'Shield', '#2D4A3E', 'webdav password', { fillNone: true }),
  icon('sync_scope_chevron', 'Chevron', '#41484C', 'webdav backup scope chevron',
    { rotation: 90, fillNone: true }),
  icon('sync_server', 'Link', '#2D4A3E', 'webdav server address', { fillNone: true }),
];

const exactExports = [
  exact('reader_control_replace_header', '1938:12008', 'restored in-reader replace header'),
  exact('reader_control_replace_add', '1938:12021', 'restored in-reader replace add rule'),
  exact('reader_control_replace_import', '1938:12029', 'restored in-reader replace import rules'),
  exact('reader_control_replace_export', '1938:12037', 'restored in-reader replace export rules'),
  exact('reader_control_replace_edit', '1939:1255', 'restored in-reader replace edit rule'),
  exact('reader_control_replace_delete', '1939:1261', 'restored in-reader replace delete rule'),
  exact('reader_control_replace_back', 'I1938:12631;411:72', 'restored in-reader replace Quick back'),
  exact('bookshelf_more', '4578:583', 'bookshelf more vertical override'),
  exact('bookshelf_more_batch', '4575:5', 'bookshelf more batch action'),
  exact('bookshelf_more_import', '4575:14', 'bookshelf more local import action'),
  exact('bookshelf_more_settings', '4575:24', 'bookshelf more settings action'),
  exact('import_cancel', '2657:797', 'local import cancel'),
  exact('import_choose_file', '2657:791', 'local import choose file'),
  exact('import_doc', '2657:825', 'local import document row'),
  exact('import_done', '2657:907', 'local import done'),
  exact('import_info', '2657:785', 'local import information'),
  exact('import_select_system', '2657:765', 'local import system picker'),
  exact('import_success', '2657:839', 'local import success'),
  exact('import_summary', '2657:809', 'local import result summary'),
  exact('search_clear', '2635:59016', 'search clear'),
  exact('search_empty', '2635:59036', 'search empty illustration'),
  exact('search_error', '2635:59126', 'search error illustration'),
  exact('reader_tts_online_engine', '930:948', 'reader online TTS service'),
  exact('reader_session_pause', '4624:26', 'reader session solid pause'),
  exact('reader_session_play', '4624:29', 'reader session solid play'),
  exact('reader_tts_speed_thumb', '750:1059', 'reader quick TTS speed thumb'),
  exact('reader_tts_system_engine', '930:936', 'reader system TTS service'),
];

// Exact inline SVG paths read from the user-supplied Make preview, version 17.
// DOM selectors identify these assets because Make does not expose design nodes.
const makeExports = [
  ['stop', 'button[aria-label="停止"] svg'],
  ['minus', 'svg:has(path[d="M3 7h8"]):not(:has(path[d="M7 3v8"]))'],
  ['plus', 'svg:has(path[d="M7 3v8"])'],
].map(([name, sourceSelector]) => ({
  file: `reader_tts_make_${name}`, semanticRole: `reader TTS ${name}`,
  originType: 'figma-make-dom-export', figmaFileKey: 'DEu3TuYhaJPLMEdSxorhwE',
  sourceSelector, sourceVersion: 17, sourceFile: `reader_tts_make_${name}.svg`,
}));

// Exact SVG element bytes from the official Make v17 downloaded PhoneScreen.tsx.
const makeSourceExports = ['close', 'pause', 'play', 'engine_check'].map(name => ({
  file: `reader_tts_make_${name}`, semanticRole: `reader TTS ${name}`,
  originType: 'figma-make-source-export', figmaFileKey: 'DEu3TuYhaJPLMEdSxorhwE',
  sourceSelector: `src/PhoneScreen.tsx SVG ${name}`, sourceVersion: 17,
  sourceFile: `reader_tts_make_${name}.svg`,
}));

const adaptedExports = [
];

const appearanceMakeExports = [
  ['chevron', 'button svg:has(path[d="M4.5 3L7.5 6L4.5 9"])'],
  ['check', 'button svg:has(path[d="M1.25 4.75L4 7.5L9.75 1.25"])'],
].map(([name, sourceSelector]) => ({
  file: `reader_appearance_make_${name}`, semanticRole: `reader appearance ${name}`,
  originType: 'figma-make-dom-export', figmaFileKey: 'LOYUJr93KwespD5j7N6icw',
  sourceSelector, sourceVersion: 9, sourceFile: `reader_appearance_make_${name}.svg`,
}));

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

const themeVariants = JSON.parse(readFileSync(new URL('./theme-svg-variants.json', import.meta.url), 'utf8')).map(baseFile => ({
  file: `${baseFile}_theme_night`, baseFile, semanticRole: `${baseFile} night app palette`, originType: 'theme-palette-derived',
}));
export const SVG_TTS_SELECTED_C = Object.freeze({
  selectionId: 'TTS-TRANSPORT-C',
  sourceSha256: '301b61aeb0b2bd833b761388d9bef401ede3e79af08269fa1af0d443c043be01',
  receiptSha256: '8753b65b9566b919f088a5e90c3b17d700ae07b3e90b6ea80091273d8d8677a3',
});
export const svgTtsSelectedCRecipes = [
  ['reader_tts_make_previous', 26, '332C25', false],
  ['reader_tts_make_next', 26, '332C25', true],
  ['reader_tts_make_previous_quick', 17, '4D463F', false],
  ['reader_tts_make_next_quick', 17, '4D463F', true],
  ['reader_tts_previous', 48, '332C25', false],
  ['reader_tts_next', 48, '332C25', true],
].map(([file, size, color, mirrorX]) => ({
  file, semanticRole: `reader TTS ${mirrorX ? 'next' : 'previous'} user-selected C spacing`,
  originType: 'user-selected-icon-adapted', selectionId: SVG_TTS_SELECTED_C.selectionId,
  size, mirrorX, colorRole: `app.icon.${file}.${color}`,
}));
// The approved action-sheet family uses the original icon geometry with a
// foreground palette selected before SVG rasterization, without a runtime
// ColorFilter. These aliases do not recolor their original page/status assets.
export const svgActionForegroundRecipes = [
  ['check', 'bookshelf_more_batch'], ['info', 'settings_row_about'],
  ['folder', 'source_group_folder'], ['trash', 'download_visual_trash'],
  ['pause', 'download_visual_pause'], ['play', 'download_visual_play'],
  ['close', 'download_visual_close'], ['refresh', 'download_visual_retry'],
  ['download', 'download_visual_download'], ['storage', 'download_visual_storage'],
  ['more', 'download_visual_more'], ['source', 'reader_directory_switch'],
  ['import', 'bookshelf_more_import'],
].flatMap(([kind, baseFile]) => ['day', 'night'].map(scheme => ({
  file: `reader_action_${kind}${scheme === 'night' ? '_theme_night' : ''}`,
  baseFile, scheme, paletteRole: 'TOK_DOWNLOAD_GREEN_INK',
  semanticRole: `reader action-sheet ${kind} ${scheme} on action background`,
  originType: 'theme-palette-derived',
  ...(kind === 'trash' ? { strokeWidth: 1.75 } : {}),
})));
export const svgControlForegroundRecipes = [
  { file: 'reader_control_replace_add_theme_night', baseFile: 'reader_control_replace_add', scheme: 'night',
    paletteRole: 'app.ReaderControlReplaceContent.toolbarButton.fontColor.FFFFFFFF', namedWhiteStroke: true,
    semanticRole: 'reader replace add night foreground on the light primary control surface' },
  ...['day', 'night'].map(scheme => ({
    file: `reader_tts_configure_chevron${scheme === 'night' ? '_theme_night' : ''}`,
    baseFile: 'reader_appearance_make_chevron', scheme, paletteRole: 'app.control.paint.FFFAF4',
    semanticRole: `reader TTS unconfigured service action chevron ${scheme} on primary control surface`,
  })),
].map(recipe => ({ ...recipe, originType: 'theme-palette-derived' }));
export const svgAssetRecipes = [...icons, ...exactExports, ...makeExports, ...makeSourceExports, ...appearanceMakeExports, ...adaptedExports, ...paperPrimitives, ...themeVariants, ...svgRadixSheetRecipes, ...svgDownloadLucideRecipes, ...svgMessageLucideRecipes, ...svgActionForegroundRecipes, ...svgControlForegroundRecipes, ...svgTtsSelectedCRecipes]
  .sort((left, right) => left.file.localeCompare(right.file));
