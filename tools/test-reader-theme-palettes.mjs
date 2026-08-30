import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { register } from 'node:module';

import {
  READER_THEME_PALETTES,
  readerThemePalette,
} from '../entry/src/main/ets/features/reading/ReaderThemePalettes.ts';

// ReaderAppearanceRenderStyle.ts 运行时 import 无扩展名（ArkTS 惯例），
// node ESM 需要解析钩子兜底补 .ts/.ets 后才能直接消费源码。
register('./helpers/ts-extension-resolve.mjs', import.meta.url);
const { readerAppearanceThemeStyle } = await import(
  '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts'
);

const THEMES = ['day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'];
const ROLE_COUNT = 29;
const BOOLEAN_ROLES = new Set(['paperTexture', 'sourcePaperLighting']);

const DAY_ANCHOR = Object.freeze({
  paperStart: '#FFFFFF',
  paperEnd: '#FFFFFF',
  bodyInk: '#2B241D',
  paperTexture: false,
  sourcePaperLighting: false,
  surface: '#FAFFFAF4',
  surfaceElevated: '#BDFFFCF8',
  surfacePanelSoft: '#9EFFFCF8',
  ink: '#332C25',
  inkSecondary: '#5B5046',
  inkTertiary: '#8A7D6E',
  chromeMeta: '#766C61',
  primary: '#2F6373',
  onPrimary: '#FFFFFF',
  activeSoft: '#142F6373',
  icon: '#4D463F',
  handle: '#B9AD9F',
  lineStrong: '#57B4A697',
  borderSoft: '#3D9B8466',
  disabledBg: '#8FEEE6DB',
  hairline: '#1F5B5046',
  disabledBorder: '#C1C7CD',
  knob: '#FAFFFCF8',
  accent: '#F48B13',
  error: '#D7473E',
  warning: '#C08020',
  scrim: '#40FFFFFF',
  selection: '#33594632',
  surfaceFade: '#00FFFCF8',
});

// ── 1. 表完备性与结构 ──────────────────────────────────────────────
assert.deepEqual(Object.keys(READER_THEME_PALETTES).sort(), [...THEMES].sort(),
  'palette table must define exactly the 8 appearance themes');

for (const theme of THEMES) {
  const palette = READER_THEME_PALETTES[theme];
  assert.equal(Object.keys(palette).length, ROLE_COUNT,
    `${theme} palette must carry all ${ROLE_COUNT} roles`);
  for (const [role, value] of Object.entries(palette)) {
    if (BOOLEAN_ROLES.has(role)) {
      assert.equal(typeof value, 'boolean', `${theme}.${role} must be boolean`);
    } else {
      assert.match(value, /^#[0-9A-Fa-f]{6,8}$/, `${theme}.${role} must be an #RGBA/#RRGGBB literal`);
    }
  }
}

// ── 2. 查表语义：同一性 + fail-closed ─────────────────────────────
for (const theme of THEMES) {
  assert.equal(readerThemePalette(theme), READER_THEME_PALETTES[theme],
    `readerThemePalette('${theme}') must return the table entry itself`);
}
assert.equal(readerThemePalette('__unknown__'), READER_THEME_PALETTES.day,
  'unknown themes must fail closed to the day palette');

// ── 3. day 列回归锚（逐字节冻结，浮层日间观感不得漂移） ─────────────
assert.deepEqual({ ...READER_THEME_PALETTES.day }, DAY_ANCHOR,
  'day palette is the regression anchor and must stay byte-identical');

// ── 4. themeStyle 薄包装与表同步 ──────────────────────────────────
for (const theme of THEMES) {
  const palette = READER_THEME_PALETTES[theme];
  assert.deepEqual(readerAppearanceThemeStyle(theme), {
    paperStart: palette.paperStart,
    paperEnd: palette.paperEnd,
    ink: palette.bodyInk,
    paperTexture: palette.paperTexture,
    sourcePaperLighting: palette.sourcePaperLighting,
  }, `readerAppearanceThemeStyle('${theme}') must project the palette verbatim`);
}

// ── 5. 守卫：阅读域组件禁止十六进制字面量与颜色 token ───────────────
const url = (relative) => new URL(relative, import.meta.url).pathname;
const READING_DIR = url('../entry/src/main/ets/features/reading');
const SOURCE_FILES = [
  url('../entry/src/main/ets/features/source/SourceSwitchWindow.ets'),
  url('../entry/src/main/ets/features/source/CandidateRow.ets'),
  url('../entry/src/main/ets/features/source/LatencyBar.ets'),
];
const STYLE_FILE = url('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
// 阅读域浮层消费的 ReaderTokens 仅允许几何/间距常量；一切颜色 token 必须走矩阵。
const TOKEN_ALLOWLIST = /^(TOK_SPACE_[A-Z_]+|TOK_RADIUS_[A-Z]+|TOK_BORDER_W|TOK_HOME_TOP_BAR_INSET|TOK_SCREEN_INSET|TOK_CONTENT_(MAX_W_PHONE|MAX_W_TABLET|RAIL_W_TABLET))$/;

async function collectEtsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectEtsFiles(full));
    } else if (entry.name.endsWith('.ets')) {
      files.push(full);
    }
  }
  return files;
}

function stripShadowBlocks(source) {
  // .shadow(...) 的颜色不属矩阵角色（守卫白名单）。阴影参数只含数字/色值/字段名，
  // 无嵌套括号，非贪婪匹配到首个 `)` 即为调用尾（覆盖 .shadow({...}) 与
  // .shadow(cond ? {...} : {...}) 两种形态）。
  return source.replace(/\.shadow\([\s\S]*?\)/g, '');
}

const guardFiles = [
  ...await collectEtsFiles(READING_DIR),
  ...SOURCE_FILES,
];

for (const file of guardFiles) {
  const source = await readFile(file, 'utf8');
  const relative = file.replace(/^.*ets\/features\//, '');

  const hexHits = [];
  const lines = stripShadowBlocks(source).split('\n');
  lines.forEach((line, index) => {
    if (/'#[0-9A-Fa-f]{6,8}'/.test(line)) {
      hexHits.push(`${relative}:${index + 1}: ${line.trim()}`);
    }
  });
  assert.deepEqual(hexHits, [],
    `${relative} must source every color from ReaderThemePalettes (hex literal found)`);

  const tokenHits = [];
  for (const match of source.matchAll(/TOK_[A-Z0-9_]+/g)) {
    if (!TOKEN_ALLOWLIST.test(match[0])) {
      tokenHits.push(match[0]);
    }
  }
  assert.deepEqual([...new Set(tokenHits)], [],
    `${relative} must not consume color tokens; only geometry/spacing tokens are allowed`);
}

// 薄包装本体迁表后同样不得落字面量（ReaderThemePalettes.ts 是唯一例外）。
const styleSource = await readFile(STYLE_FILE, 'utf8');
assert.equal(/'#[0-9A-Fa-f]{6,8}'/.test(styleSource), false,
  'ReaderAppearanceRenderStyle.ts must not carry hex literals after palette migration');

console.log(`reader theme palette guard: 8 themes × ${ROLE_COUNT} roles, ` +
  `${guardFiles.length + 1} files clean, day anchor frozen`);
