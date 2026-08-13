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

const source = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
assert.match(source, /@Prop groups: string\[\] = \[\]/);
assert.match(source, /options: this\.groupOptions\(\)/);
assert.match(source, /controlWidth: GROUP_SELECT_WIDTH/);
assert.doesNotMatch(source, /\['全部分组', '已启用', '已禁用'\]/);

const sync = read('entry/src/main/ets/features/sync/SyncPage.ets');
assert.match(sync, /FIGMA_MULTISELECT_EXPANDED_STATE_MISSING/);
assert.match(sync, /this\.scopeRow\(\)/);
assert.doesNotMatch(sync, /this\.autoRow\('备份范围'/);
assert.doesNotMatch(sync, /this\.openSelect === 'scope'/);
assert.doesNotMatch(sync, /this\.openSelect === 'location'|this\.openSelect === 'frequency'/,
  'disabled automatic-backup rows must not retain selectable state');
assert.match(sync, /this\.gatedRow\('保存位置'/);
assert.match(sync, /this\.gatedRow\('备份频率'/);

const select = read('entry/src/main/ets/features/common/ReaderSelect.ets');
const panel = read('entry/src/main/ets/features/common/ReaderSelectPanel.ets');
assert.match(select, /@Prop controlWidth: number = 0/);
assert.match(panel, /@Prop controlWidth: number = 0/);

console.log('select semantic contract: PASS');
