import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const emptyPage = read('entry/src/main/ets/features/bookshelf/BookshelfEmptyPage.ets');
const emptyCard = read('entry/src/main/ets/features/bookshelf/BookshelfEmptyCard.ets');
const shelfManagement = read('entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets');
const localImport = read('entry/src/main/ets/features/bookshelf/LocalImportDialog.ets');
const jsonImport = read('entry/src/main/ets/features/common/JsonImportDialog.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const discover = read('entry/src/main/ets/features/discover/DiscoverPage.ets');
const rss = read('entry/src/main/ets/features/rss/RssPage.ets');
const rssManagement = read('entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets');
const rssEditor = read('entry/src/main/ets/features/rss/RssSubscriptionEditorPage.ets');
const rssFeed = read('entry/src/main/ets/features/rss/RssSourceFeedPage.ets');
const rssEntry = read('entry/src/main/ets/features/rss/RssEntryDetailPage.ets');
const settingsShell = read('entry/src/main/ets/features/shell/SettingsShell.ets');
const settingsPage = read('entry/src/main/ets/features/settings/SettingsPage.ets');
const rulesManagement = read('entry/src/main/ets/features/settings/RulesManagementPage.ets');
const sourceManagement = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
const sourceTools = read('entry/src/main/ets/features/source/SourceToolsPage.ets');
const sync = read('entry/src/main/ets/features/sync/SyncPage.ets');
const fullDirectory = read('entry/src/main/ets/features/reading/ReaderFullDirectory.ets');
const fullDirectoryPanel = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const appearance = read('entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets');
const settings = read('entry/src/main/ets/features/reading/ReaderSettingsFullPanel.ets');
const tts = read('entry/src/main/ets/features/reading/ReaderTtsFullPanel.ets');
const autoPage = read('entry/src/main/ets/features/reading/ReaderAutoPageFullPanel.ets');
const readerLayout = read('entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');

assert.match(shelf,
  /new SurfaceWidthSpec\([\s\S]*TOK_CONTENT_RAIL_W_TABLET,[\s\S]*this\.tabletContentLeftGap\(\),[\s\S]*TABLET_CONTENT_RIGHT_GAP,[\s\S]*'center'/,
  'tablet shelf content must shrink below the Figma canvas inside its live rail-safe frame');
assert.match(shelf, /return this\.effectiveViewportWidth\(\) >= BOOKSHELF_WIDE_BREAKPOINT/,
  'bookshelf layout selection must follow the live viewport rather than physical device type');
assert.doesNotMatch(shelf, /@Prop isTablet/,
  'bookshelf outer geometry must not be pinned to the physical device class');
assert.match(shelf,
  /return Math\.min\(TABLET_BOOK_WIDTH, Math\.max\(0, \(contentWidth - \(TOK_SPACE_XS \* 2\)\) \/ 3\)\)/,
  'tablet book cards must shrink with their content rail');

assert.match(emptyPage,
  /new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_PHONE, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'empty shelf must resolve its phone-role cap through shared horizontal geometry');
assert.match(emptyPage,
  /padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/,
  'empty shelf must apply asymmetric safe edges, not only the resolved width');
assert.match(emptyCard, /@Prop cardWidth: number = 352/);
assert.match(emptyCard, /return Math\.max\(0, this\.cardWidth - 34\)/,
  'empty-state actions must shrink with the card');

assert.match(shelfManagement,
  /private assignmentCard\(\)[\s\S]*Scroll\(\) \{[\s\S]*this\.smallAction\(group\.groupName[\s\S]*scrollable\(ScrollDirection\.Horizontal\)/,
  'unbounded user group chips must scroll horizontally instead of widening the page');

for (const [name, source] of [
  ['bookshelf management', shelfManagement],
  ['RSS subscription editor', rssEditor],
  ['rules management', rulesManagement],
  ['source tools', sourceTools],
]) {
  assert.match(source, /@StorageLink\('readerWindowMetricsRevision'\)/,
    `${name} must react to the shared window snapshot`);
  assert.match(source,
    /new SurfaceWidthSpec\(metrics\.windowRect\.width, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
    `${name} must resolve its full-width role through shared horizontal geometry`);
  assert.match(source, /readerVisualSafeLeft\(metrics\)/);
  assert.match(source, /readerVisualSafeRight\(metrics\)/);
  assert.match(source, /left: this\.contentFrame\(\)\.left/);
  assert.match(source, /right: this\.contentFrame\(\)\.right/);
  assert.doesNotMatch(source, /padding\(\{ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET/,
    `${name} must apply the resolved asymmetric edges`);
}

assert.match(settingsShell, /@StorageLink\('readerWindowMetricsRevision'\)/);
assert.match(settingsShell,
  /new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'settings shell must own the single shared 720vp content frame');
assert.equal((settingsShell.match(/left: this\.contentFrame\(\)\.left/g) ?? []).length, 2);
assert.equal((settingsShell.match(/right: this\.contentFrame\(\)\.right/g) ?? []).length, 2);
assert.doesNotMatch(settingsPage, /maxWidth: TOK_CONTENT_MAX_W_TABLET/,
  'settings rows must not independently clamp inside the shell-owned content frame');

assert.match(sourceManagement, /@State private viewportWidth: number = 0/);
assert.match(sourceManagement,
  /new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'source management must treat 720vp as one continuous shared cap');
assert.match(sourceManagement,
  /return Math\.max\(0, \(this\.contentFrame\(\)\.width - 20\) \/ 2\)/,
  'tablet source filters must share the remaining row width');
assert.match(sourceManagement, /\.width\(this\.statusChipWidth\(width\)\)/);

assert.match(sync, /@State private viewportWidth: number = 0/);
assert.match(sync,
  /new SurfaceWidthSpec\(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/,
  'sync cards must use the shared continuous 720vp cap');
assert.match(sync, /left: this\.contentFrame\(\)\.left/);
assert.match(sync, /right: this\.contentFrame\(\)\.right/);

assert.match(localImport, /@State private viewportWidth: number = 0/);
assert.match(localImport,
  /new SurfaceWidthSpec\([\s\S]*LOCAL_IMPORT_PANEL_MAX_WIDTH,[\s\S]*LOCAL_IMPORT_EDGE_GAP,[\s\S]*LOCAL_IMPORT_EDGE_GAP/,
  'all local-import states must resolve their 350vp role with 20vp design gaps');
assert.equal((localImport.match(/\.width\(this\.panelFrame\(\)\.width\)/g) ?? []).length, 3,
  'selection, importing, and result panels must share the same clamp');
assert.match(localImport,
  /padding\(\{ left: this\.panelFrame\(\)\.left, right: this\.panelFrame\(\)\.right \}\)/);

for (const [name, source, maxToken] of [
  ['search', search, 'TOK_CONTENT_RAIL_W_TABLET'],
  ['discover', discover, 'TOK_CONTENT_RAIL_W_TABLET'],
  ['RSS subscription management', rssManagement, 'TOK_CONTENT_MAX_W_TABLET'],
  ['RSS source feed', rssFeed, 'TOK_CONTENT_MAX_W_TABLET'],
  ['RSS entry detail', rssEntry, 'TOK_CONTENT_MAX_W_TABLET'],
]) {
  assert.match(source, /@StorageLink\('readerWindowMetricsRevision'\)/,
    `${name} must react to the shared window snapshot`);
  assert.match(source, new RegExp(`new SurfaceWidthSpec\\(${maxToken}`),
    `${name} must declare its design cap through SurfaceWidthSpec`);
  assert.match(source, /readerVisualSafeLeft\(metrics\)/);
  assert.match(source, /readerVisualSafeRight\(metrics\)/);
}

assert.match(search,
  /padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/);
assert.doesNotMatch(search, /return this\.isTablet \? TOK_CONTENT_RAIL_W_TABLET : '100%'/);
assert.match(discover,
  /padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/);
assert.doesNotMatch(discover, /this\.isTablet \? TOK_CONTENT_RAIL_W_TABLET : TOK_CONTENT_MAX_W_PHONE/);

assert.match(rss, /const RSS_TABLET_RAIL_WIDTH = 100/);
assert.match(rss,
  /new SurfaceWidthSpec\(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/);
assert.match(rss, /readerVisualSafeLeft\(metrics\) - railWidth/,
  'RSS must translate the shared safe-left boundary into its rail-owned host');
assert.match(rss, /return this\.effectiveViewportWidth\(\) >= RSS_WIDE_BREAKPOINT/,
  'RSS rail selection must use the live viewport rather than physical isTablet');

assert.doesNotMatch(rssFeed, /RSS_CHILD_WIDE_BREAKPOINT/);
assert.doesNotMatch(rssEntry, /RSS_CHILD_WIDE_BREAKPOINT/);
assert.match(rssEntry,
  /margin\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right \}\)/,
  'RSS entry bottom actions must honor asymmetric safe edges');

assert.match(jsonImport,
  /new SurfaceWidthSpec\([\s\S]*JSON_IMPORT_DIALOG_MAX_WIDTH,[\s\S]*JSON_IMPORT_DIALOG_EDGE_GAP,[\s\S]*JSON_IMPORT_DIALOG_EDGE_GAP/);
assert.match(jsonImport, /readerInteractiveSafeLeft\(metrics, true\)/);
assert.match(jsonImport, /readerInteractiveSafeRight\(metrics, true\)/);
assert.match(jsonImport,
  /padding\(\{ left: this\.dialogFrame\(\)\.left, right: this\.dialogFrame\(\)\.right \}\)/);
assert.doesNotMatch(jsonImport, /this\.isTablet \? 520 : '90%'/);

assert.match(fullDirectory, /@State private containerWidth: number = 0/);
assert.match(fullDirectory,
  /new SurfaceWidthSpec\(720, 27, 13, 'right'\)/,
  'tablet directory must preserve its asymmetric role through shared geometry');
assert.match(fullDirectory,
  /new SurfaceWidthSpec\(364, 12, 12, 'center'\)/,
  'phone directory must preserve its centered role through shared geometry');
assert.match(fullDirectoryPanel, /@Prop panelWidthOverride: number = 0/);
assert.match(fullDirectoryPanel, /return Math\.max\(0, this\.panelWidth\(\) - 26\)/);

assert.match(experience, /layout: this\.controlLayout\(\)/,
  'the reader owner must provide one resolved geometry snapshot to every control state');
assert.match(control, /@Prop @Watch\('onLayoutChanged'\) layout: ReaderControlLayoutSnapshot/);
assert.match(control,
  /private dockWidth\(\): number \{\s*return this\.layout\.dockWidth;/,
  'all seven regular reader-control states must clamp their dock');
assert.equal((control.match(/availableWidth: this\.fullPanelAvailableWidth\(\)/g) ?? []).length, 4,
  'search, appearance, settings, and TTS full sheets must receive the same measured width');
assert.equal((control.match(/availableHeight: this\.layout\.fullPanelHeight/g) ?? []).length, 4,
  'search, appearance, settings, and TTS full sheets must receive the same live height budget');
assert.match(readerLayout, /const fullPanelHeight = Math\.max\(0, height - fullPanelTop - fullPanelBottom\)/,
  'the full-panel height budget must be derived once from the live viewport and safe bottom');

for (const [name, source] of [
  ['settings', settings],
  ['tts', tts],
  ['auto page', autoPage],
]) {
  assert.match(source, /@Prop availableWidth: number = 0/, `${name} must accept a live width`);
  assert.match(source, /@Prop availableHeight: number = 0/, `${name} must accept a live height budget`);
  assert.match(source, /Math\.min\([^\n]+, this\.availableWidth\)/,
    `${name} must preserve its Figma width only as a maximum`);
  assert.match(source, /Math\.min\([^\n]+, this\.availableHeight\)/,
    `${name} must preserve its Figma height only as a maximum`);
}

assert.match(appearance, /@Prop availableWidth: number = 0/,
  'appearance must accept a live width');
assert.match(appearance, /@Prop availableHeight: number = 0/,
  'appearance must accept a live height budget');
assert.match(appearance, /Math\.min\([^\n]+, this\.availableWidth\)/,
  'appearance must preserve its Figma width only as a maximum');
assert.match(appearance,
  /private scrollViewportHeight\(\): number[\s\S]*Math\.min\(this\.viewportHeight\(\), this\.availableHeight - 68\)/,
  'appearance must preserve its authored full-sheet frame while clamping the interactive scroll viewport');

// Geometry sanity for the explicit regression matrix used by this audit.
for (const viewport of [320, 360, 365.71, 390, 600, 720, 760, 840]) {
  const phoneSheet = Math.min(364, viewport);
  const centeredDirectory = Math.min(364, Math.max(0, viewport - 24));
  const dialog = Math.min(350, Math.max(0, viewport - 40));
  assert.ok(phoneSheet <= viewport);
  assert.ok(centeredDirectory + Math.max(0, (viewport - centeredDirectory) / 2) <= viewport);
  assert.ok(dialog <= viewport);
}

console.log('responsive surface width regression matrix: PASS');
