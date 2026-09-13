import assert from 'node:assert/strict';
import { readerAppColor } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

/** Existing Figma geometry contracts name the original design tokens. Resolve
 * only the new app-palette call sites back to those names for these static
 * geometry checks. Runtime Builder tests execute the actual palette adapter. */
export function themeDayDesignSource(source) {
  return source.replace(/readerAppColor\('(TOK_[A-Z0-9_]+)', this\.[A-Za-z0-9_]+\)/g, (_call, role) => {
    assert.match(readerAppColor(role, 'day'), /^#[0-9A-F]{8}$/i, `${role} has a complete day palette binding`);
    assert.match(readerAppColor(role, 'night'), /^#[0-9A-F]{8}$/i, `${role} has a complete night palette binding`);
    return role;
  });
}
