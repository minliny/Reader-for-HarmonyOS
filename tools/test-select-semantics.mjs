import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const rss = read('entry/src/main/ets/features/rss/RssPage.ets');
assert.doesNotMatch(rss, /import \{ ReaderSelect \}/);
assert.doesNotMatch(rss, /ReaderSelect\(\{/);
assert.match(rss, /筛选 = 内联展开 \(非下拉\)/);
assert.match(rss, /if \(this\.filterOpen\) \{\s*this\.filterExpand\(\)/);

const settings = read('entry/src/main/ets/features/settings/SettingsPage.ets');
assert.match(settings, /this\.segmentRow\('App主题'/);
assert.doesNotMatch(settings, /this\.selectRow\('App主题'/);
assert.equal((settings.match(/variant: this\.isTablet \? 'settingsTablet' : 'settingsPhone'/g) ?? []).length, 1,
  'Settings keeps the shared trigger but delegates its responsive overlay to its Figma-specific component');
assert.match(settings, /SettingsSelectOverlay\(\{/);
assert.doesNotMatch(settings, /ReaderSelectPanel\(\{/,
  'Settings Phone sheet and Tablet popover must not inherit the generic inline dropdown panel');
assert.match(settings, /const SELECT_TRIGGER_H = 34/);

const source = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
assert.match(source, /const GROUP_SELECT_WIDTH = 276/,
  'SourceManagement group select keeps the final 276vp Figma width at the 390vp reference viewport');
assert.match(source, /@Prop groups: string\[\] = \[\]/);
assert.match(source, /options: this\.groupOptions\(\)/);
assert.equal((source.match(/variant: 'sourceGroup'/g) ?? []).length, 2,
  'Source trigger and panel must select one complete source-group contract');
assert.equal((source.match(/controlWidth: this\.groupSelectWidth\(\)/g) ?? []).length, 2,
  'the trigger and overlay must share the same viewport-clamped width');
assert.match(source, /return Math\.max\(0, this\.filterControlWidth\(\) - \(GROUP_FILTER_WIDTH - GROUP_SELECT_WIDTH\)\)/);
assert.doesNotMatch(source, /\['全部分组', '已启用', '已禁用'\]/);

const sync = read('entry/src/main/ets/features/sync/SyncPage.ets');
assert.match(sync, /FIGMA_MULTISELECT_EXPANDED_STATE_MISSING/);
assert.match(sync, /this\.scopeRow\(\)/);
assert.doesNotMatch(sync, /this\.autoRow\('备份范围'/);
assert.doesNotMatch(sync, /this\.openSelect === 'scope'/);
assert.doesNotMatch(sync, /this\.openSelect === 'location'|this\.openSelect === 'frequency'/,
  'disabled automatic-backup rows must not retain selectable state');
assert.match(sync, /private scopeRow[\s\S]*?TextAlign\.Start[\s\S]*?app\.media\.sync_scope_chevron/,
  'the disabled multi-select trigger must retain the WebDAV-specific left-aligned field presentation');
assert.match(sync, /this\.gatedRow\('保存位置'/);
assert.match(sync, /this\.gatedRow\('备份频率'/);

const select = read('entry/src/main/ets/features/common/ReaderSelect.ets');
const panel = read('entry/src/main/ets/features/common/ReaderSelectPanel.ets');
const motion = read('entry/src/main/ets/features/common/MotionSpec.ets');
assert.match(select, /@Prop controlWidth: number = 0/);
assert.match(panel, /@Prop controlWidth: number = 0/);
assert.match(select, /export type ReaderSelectVariant =[\s\S]*'appearanceCompact'[\s\S]*'settingsPhone'[\s\S]*'settingsTablet'[\s\S]*'sourceGroup'/);
assert.match(select, /@Prop variant: ReaderSelectVariant = 'default'/);
assert.match(panel, /@Prop variant: ReaderSelectVariant = 'default'/);
assert.doesNotMatch(select, /@Prop (appearanceCompact|settingsPage|settingsTablet|sourceGroup): boolean/,
  'the trigger must not allow contradictory independent visual flags');
assert.doesNotMatch(panel, /@Prop (appearanceCompact|settingsPage|settingsTablet|sourceGroup): boolean/,
  'the overlay must consume the same typed variant contract');
assert.match(select, /@Prop reduceMotion: boolean = false/);
assert.match(panel, /@Prop reduceMotion: boolean = false/);
assert.match(select,
  /private settingsTrigger[\s\S]*?\.height\(34\)[\s\S]*?\.backgroundColor\('#0F2D4A3E'\)[\s\S]*?\.borderRadius\(7\)/,
  'Settings/SelectTrigger must use its page-specific Figma geometry and surface');
assert.match(select,
  /private sourceGroupTrigger[\s\S]*?TYPE_SELECT_SOURCE_GROUP_VALUE\.fontFamily[\s\S]*?TYPE_SELECT_SOURCE_GROUP_VALUE\.fontSizeFp[\s\S]*?\.backgroundColor\('#FFFCF8'\)[\s\S]*?\.borderRadius\(8\)/,
  'SourceManagement/GroupFilter must not inherit the generic Reader select styling');
assert.match(select,
  /private appearanceTrigger[\s\S]*?Text\(this\.value\)[\s\S]*?TYPE_SELECT_APPEARANCE_VALUE\.fontFamily[\s\S]*?app\.media\.reader_chevron_down[\s\S]*?TOK_SURFACE_FIELD[\s\S]*?'#C1C7CD'[\s\S]*?responseRegion\(\{ x: 0, y: -4, width: '100%', height: 44 \}\)/,
  'the Reader Appearance trigger must render its selected value, chevron, field, border, and 44vp hit target');
assert.doesNotMatch(select,
  /appearancePortGradient|linearGradient\(\{[\s\S]*?Color\.Transparent[\s\S]*?'#41484C'/,
  'a chevron artwork layer must not be stretched into a hard-stop gradient across the whole trigger');
assert.match(select,
  /private defaultTrigger[\s\S]*?TextAlign\.Start[\s\S]*?TOK_SURFACE_PANEL_SOFT[\s\S]*?TOK_BORDER/,
  'the unified selected row must remain left-aligned on its authored selected surface');
assert.match(motion,
  /id: 'dropdown\.menu\.expand', durationMs: 160, curve: curves\.cubicBezierCurve\(0\.16, 1, 0\.3, 1\)/,
  'the shared registry must preserve the Figma production duration and easing');
assert.match(motion,
  /id: 'dropdown\.menu\.collapse', durationMs: 120, curve: curves\.cubicBezierCurve\(0\.5, 0, 1, 1\)/,
  'the shared registry must preserve the Figma production collapse duration and easing');
assert.match(panel,
  /@State private expandedHeight: number = OPTION_H[\s\S]*?\.height\(this\.expandedHeight\)[\s\S]*?\.clip\(true\)[\s\S]*?\.onAppear\(\(\): void => this\.expandPanel\(\)\)/,
  'the same panel must reveal from its selected 36vp row without opacity or translation');
assert.match(panel,
  /private expandPanel\(\): void[\s\S]*?if \(this\.reduceMotion\)[\s\S]*?animateTo\(motionAnimateParam\('dropdown\.menu\.expand'\)/,
  'the Figma motion must animate once and switch directly under reduced motion');
assert.match(panel, /this\.chevronAngle = -180/,
  'the selected-row chevron must rotate around its fixed center while the panel expands');
assert.match(panel,
  /private sourceGroupSelectedRow[\s\S]*?TYPE_SELECT_SOURCE_GROUP_VALUE\.fontFamily[\s\S]*?app\.media\.source_group_chevron[\s\S]*?\.backgroundColor\('#FFFCF8'\)/,
  'the expanded source-group selected row must preserve the trigger typography, icon, and surface');
assert.match(panel,
  /private panelBorderColor[\s\S]*?this\.variant === 'sourceGroup'[\s\S]*?return '#85B4A697'/,
  'the expanded source-group panel must preserve the source-management field border');
assert.match(panel,
  /private collapsePanel\(onFinish: \(\) => void, onCommit\?: \(\) => void\): void[\s\S]*?motionAnimateParam\('dropdown\.menu\.collapse'[\s\S]*?this\.expandedHeight = OPTION_H[\s\S]*?this\.chevronAngle = 0/,
  'selection and outside-dismissal must contract the same fixed-top panel before unmounting it');
assert.match(select,
  /motionAnimateParam\(this\.isOpen \? 'dropdown\.menu\.expand' : 'dropdown\.menu\.collapse'\)/,
  'the trigger chevron must use asymmetric Figma expand/collapse timing');
assert.doesNotMatch(panel, /\.opacity\(|\.translate\(/,
  'the Figma dropdown expansion explicitly forbids opacity and translation');
assert.equal((settings.match(/reduceMotion: this\.reduceMotionValue/g) ?? []).length, 1,
  'Settings trigger must honor the app reduced-motion setting');
assert.equal((source.match(/reduceMotion: this\.reduceMotion/g) ?? []).length, 2,
  'Source trigger and panel must share their reduced-motion contract');

console.log('select semantic contract: PASS');
