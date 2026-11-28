import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DOWNLOAD_VISUAL } from '../../entry/src/main/ets/features/downloads/ui/SharedDownloadVisualSpec.ts';
import {
  READER_CONTROL_BRIGHTNESS_RAIL_WIDTH,
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT,
  READER_CONTROL_REGULAR_DOCK_HEIGHT,
  ReaderControlGeometry,
} from '../../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';
import {
  resolveSourceManagementLayout,
  SOURCE_FOOTER_ACTION_HEIGHT,
  SOURCE_ROW_ICON_WIDTH,
} from '../../entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts';
import { SOURCE_SWITCH_VISUAL } from '../../entry/src/main/ets/features/source/ui/SourceSwitchVisual.ts';
import { TOK_SCREEN_INSET } from '../../entry/src/main/ets/ui/foundation/ReaderLayoutTokens.ts';
import { readerAppColor, type ReaderAppColorRole } from '../../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

interface DesignSizeContract {
  schemaVersion: number;
  specName: string;
  narrowViewportWidthVp: number;
  theme: {
    day: Record<string, string>;
    night: Record<string, string>;
    distinctSurfacePairs: [string, string][];
  };
  constants: {
    TOK_SCREEN_INSET: number;
    READER_CONTROL_REGULAR_DOCK_HEIGHT: number;
    READER_CONTROL_BRIGHTNESS_RAIL_WIDTH: number;
    READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT: number;
    SOURCE_ROW_ICON_WIDTH: number;
    downloadVisual: Record<string, number>;
    sourceSwitchVisual: Record<string, number>;
    sourceManagement: {
      rowMaxMinHeightInlineAt366: number;
      footerHeight: number;
    };
  };
}

const hostContractPath = fileURLToPath(new URL('./design-size-contract.json', import.meta.url));
const contractRaw = readFileSync(hostContractPath, 'utf8');
const contract = JSON.parse(contractRaw) as DesignSizeContract;

test('host design-size-contract.json stays byte-identical to Reader-UI authoritative source when present', () => {
  const authoritativePath = resolve(
    dirname(hostContractPath),
    '../../../Reader-UI/design/harmonyos-ui-redesign/design-size-contract.json',
  );
  if (existsSync(authoritativePath)) {
    assert.equal(contractRaw, readFileSync(authoritativePath, 'utf8'));
  }
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.specName, '墨纸青松 2.0');
});

test('production layout tokens and geometry constants match the single-source design contract', () => {
  const expected = contract.constants;
  assert.equal(TOK_SCREEN_INSET, expected.TOK_SCREEN_INSET);
  assert.equal(READER_CONTROL_REGULAR_DOCK_HEIGHT, expected.READER_CONTROL_REGULAR_DOCK_HEIGHT);
  assert.equal(new ReaderControlGeometry(false).sheetH, expected.READER_CONTROL_REGULAR_DOCK_HEIGHT);
  assert.equal(new ReaderControlGeometry(true).sheetH, expected.READER_CONTROL_REGULAR_DOCK_HEIGHT);
  assert.equal(READER_CONTROL_BRIGHTNESS_RAIL_WIDTH, expected.READER_CONTROL_BRIGHTNESS_RAIL_WIDTH);
  assert.equal(READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT, expected.READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT);
  assert.equal(SOURCE_ROW_ICON_WIDTH, expected.SOURCE_ROW_ICON_WIDTH);

  for (const [key, value] of Object.entries(expected.downloadVisual)) {
    assert.equal(DOWNLOAD_VISUAL[key as keyof typeof DOWNLOAD_VISUAL], value, `DOWNLOAD_VISUAL.${key}`);
  }
  for (const [key, value] of Object.entries(expected.sourceSwitchVisual)) {
    assert.equal(SOURCE_SWITCH_VISUAL[key as keyof typeof SOURCE_SWITCH_VISUAL], value, `SOURCE_SWITCH_VISUAL.${key}`);
  }

  assert.equal(SOURCE_FOOTER_ACTION_HEIGHT, expected.sourceManagement.footerHeight);
});

test('source management row stays inline and compact on narrow 365.7vp phone viewport', () => {
  const contentWidth = contract.narrowViewportWidthVp - contract.constants.TOK_SCREEN_INSET * 2;
  const layout = resolveSourceManagementLayout({
    availableWidth: contentWidth,
    fontScale: 1,
    hasLogin: false,
    detectWidth: 28,
    actionWidth: 58,
    actionHeight: 36,
    loginHeight: 26,
    filterHeight: 40,
    footerHeight: contract.constants.sourceManagement.footerHeight,
    titleLineHeight: 19,
    metaLineHeight: 15,
  });
  assert.equal(layout.rowForm, 'inline');
  assert.ok(layout.rowMinHeight <= contract.constants.sourceManagement.rowMaxMinHeightInlineAt366);
  assert.equal(layout.footerHeight, contract.constants.sourceManagement.footerHeight);
});

test('Paper & Pine 2.0 day and night surface tokens match contract and preserve elevation separation', () => {
  for (const scheme of ['day', 'night'] as const) {
    const tokens = contract.theme[scheme];
    for (const [role, expectedHex] of Object.entries(tokens)) {
      assert.equal(readerAppColor(role as ReaderAppColorRole, scheme), expectedHex, `${scheme}.${role}`);
    }
    for (const [roleA, roleB] of contract.theme.distinctSurfacePairs) {
      assert.notEqual(
        readerAppColor(roleA as ReaderAppColorRole, scheme),
        readerAppColor(roleB as ReaderAppColorRole, scheme),
        `${scheme} surface elevation collapsed: ${roleA} === ${roleB}`,
      );
    }
  }
});
