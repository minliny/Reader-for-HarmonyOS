import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { svgAssetRecipes } from './svg-provenance.config.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (extname(entry.name) === '.ets' || extname(entry.name) === '.ts') {
      files.push(path);
    }
  }
  return files;
}

const slots = [
  ['reader directory active', 'entry/src/main/ets/features/reading/ReaderControlPanel.ets',
    ['reader_directory_list_active'], '943:9888'],
  ['reader tts active', 'entry/src/main/ets/features/reading/ReaderControlPanel.ets',
    ['reader_tts_nav_active'], '943:10354'],
  ['reader appearance active', 'entry/src/main/ets/features/reading/ReaderControlPanel.ets',
    ['reader_appearance_nav_active'], '943:10790'],
  ['reader settings active', 'entry/src/main/ets/features/reading/ReaderControlPanel.ets',
    ['reader_settings_nav_active'], '943:11211'],
  ['full tts header', 'entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets',
    ['reader_tts_header'], '943:12119'],
  ['full settings header', 'entry/src/main/ets/features/reading/ReaderSettingsFullPanel.ets',
    ['reader_settings_header'], '943:14749'],
  ['discover refresh', 'entry/src/main/ets/features/discover/DiscoverPage.ets',
    ['discover_refresh'], '943:1312'],
  ['discover source', 'entry/src/main/ets/features/discover/DiscoverPage.ets',
    ['discover_source_stack'], '943:1312'],
  ['discover source disclosure', 'entry/src/main/ets/features/discover/DiscoverPage.ets',
    ['discover_source_chevron'], '943:1312'],
  ['discover filter', 'entry/src/main/ets/features/discover/DiscoverPage.ets',
    ['discover_filter'], '943:1312'],
  ['discover filter disclosure', 'entry/src/main/ets/features/discover/DiscoverPage.ets',
    ['discover_filter_chevron'], '943:1312'],
  ['discover apply', 'entry/src/main/ets/features/discover/DiscoverPage.ets',
    ['discover_apply'], '943:1312'],
  ['webdav server', 'entry/src/main/ets/features/sync/SyncPage.ets', ['sync_server'], '943:4982'],
  ['webdav account', 'entry/src/main/ets/features/sync/SyncPage.ets', ['sync_account'], '943:4982'],
  ['webdav password', 'entry/src/main/ets/features/sync/SyncPage.ets', ['sync_password'], '943:4982'],
  ['webdav backup password', 'entry/src/main/ets/features/sync/SyncPage.ets',
    ['sync_backup_password'], 'product extension of 943:4982'],
  ['webdav folder', 'entry/src/main/ets/features/sync/SyncPage.ets', ['sync_folder'], '943:4982'],
  ['source management group', 'entry/src/main/ets/features/source/SourceManagementPage.ets',
    ['source_group_folder'], '943:4281'],
  ['rss management view', 'entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets',
    ['rss_manage_view_all'], '4198:3798'],
  ['rss management edit', 'entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets',
    ['rss_manage_edit'], '4198:3798'],
  ['rss management refresh', 'entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets',
    ['rss_manage_refresh'], '4198:3798'],
  ['rss management delete', 'entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets',
    ['rss_manage_delete'], '4198:3798'],
  ['rss entry bookmark', 'entry/src/main/ets/features/rss/RssEntryDetailPage.ets',
    ['rss_bookmark', 'rss_bookmark_active'], '4054:65493'],
];

assert.equal(slots.length, 23, 'the corrected Figma audit must retain all 23 confirmed icon slots');
for (const [slot, file, assets, figmaNode] of slots) {
  const source = read(file);
  for (const asset of assets) {
    assert.ok(source.includes(asset),
      `${slot} (${figmaNode}) must use fixed asset ${asset}`);
  }
}

const recipes = new Map(svgAssetRecipes.map((recipe) => [recipe.file, recipe]));
const recipeContracts = [
  ['reader_directory_list_active', 'Icon/ReaderModuleDirectory', '#FFFAF4', 0],
  ['reader_tts_nav_active', 'Icon/ReaderModuleTts', '#FFFAF4', 0],
  ['reader_appearance_nav_active', 'Icon/ReaderModuleAppearance', '#FFFAF4', 0],
  ['reader_settings_nav_active', 'Icon/ReaderModuleSettings', '#FFFAF4', 0],
  ['reader_tts_header', 'Icon/Tts', '#332C25', 0],
  ['reader_settings_header', 'Icon/ReaderModuleSettings', '#332C25', 0],
  ['reader_chevron_down_primary', 'Icon/Chevron', '#2F6373', 90],
  ['discover_refresh', 'Icon/Refresh', '#1F1B17', 0],
  ['discover_source_stack', 'Icon/SourceStack', '#1F3528', 0],
  ['discover_source_chevron', 'Icon/ChevronRight', '#1F1B17', 0],
  ['discover_filter', 'Icon/Filter', '#3F372F', 0],
  ['discover_filter_chevron', 'Icon/ChevronRight', '#3F372F', 0],
  ['discover_apply', 'Icon/Check', '#FFFFFF', 0],
  ['sync_server', 'Icon/Link', '#2D4A3E', 0],
  ['sync_account', 'Icon/People', '#2D4A3E', 0],
  ['sync_password', 'Icon/Shield', '#2D4A3E', 0],
  ['sync_backup_password', 'Icon/Lock', '#2D4A3E', 0],
  ['sync_folder', 'Icon/Folder', '#2D4A3E', 0],
  ['sync_scope_chevron', 'Icon/Chevron', '#41484C', 90],
  ['source_group_folder', 'Icon/Folder', '#2D4A3E', 0],
  ['rss_manage_view_all', 'Icon/List', '#1F1B17', 0],
  ['rss_manage_edit', 'Icon/Edit', '#1F1B17', 0],
  ['rss_manage_refresh', 'Icon/Refresh', '#1F1B17', 0],
  ['rss_manage_delete', 'Icon/Trash', '#AB2E28', 0],
  ['rss_bookmark', 'Icon/Bookmark', '#756F69', 0],
  ['rss_bookmark_active', 'Icon/Bookmark', '#1F3528', 0],
];

for (const [asset, component, color, rotation] of recipeContracts) {
  const recipe = recipes.get(asset);
  assert.ok(recipe, `${asset} must be registered in SVG provenance`);
  assert.equal(recipe.component, component, `${asset} must use ${component}`);
  assert.equal(recipe.color, color, `${asset} must use Figma color ${color}`);
  assert.equal(recipe.rotation, rotation, `${asset} rotation must match Figma`);
  assert.equal(recipe.fillNone, true, `${asset} must preserve its outline geometry`);
}

for (const asset of [
  'reader_directory_list_active',
  'reader_tts_nav_active',
  'reader_appearance_nav_active',
  'reader_settings_nav_active',
]) {
  assert.ok(!recipes.get(asset).component.includes('/Filled/'),
    `${asset} must not regress to a filled Reader module variant`);
}

const bannedAliases = [
  ['entry/src/main/ets/features/discover/DiscoverPage.ets',
    ['rss_refresh', 'rss_source', 'bookshelf_filter', 'reader_chevron_right', 'import_success']],
  ['entry/src/main/ets/features/sync/SyncPage.ets',
    ['bookshelf_rss', 'directory_bookmark', 'directory_bookmark_on', 'reader_directory_directory',
      'reader_chevron_down']],
  ['entry/src/main/ets/features/source/SourceManagementPage.ets', ['directory_directory']],
  ['entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets', ['settings_gen_cache']],
];
for (const [file, aliases] of bannedAliases) {
  const source = read(file);
  for (const alias of aliases) {
    assert.ok(!source.includes(`app.media.${alias}`), `${file} must not reuse ${alias}`);
  }
}

const arkSources = sourceFiles(resolve(repo, 'entry/src/main/ets'));
for (const file of arkSources) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /\.fillColor\(/,
    `${file}: Image.fillColor is forbidden for SVG icons; generate a fixed-color asset variant instead`);
}

console.log('icon design contract: PASS (23 confirmed slots + 2 latent coupling/tint risks)');
